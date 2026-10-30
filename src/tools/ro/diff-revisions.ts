/*
 * SPDX-License-Identifier: BSD-2-Clause
 *
 * Copyright (c) 2026 Xie Youtian
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot } from '../../common/nodemwBot.js';
import { callApi, jsonResult, errorResult } from '../../common/utils.js';
import { getReadRecord } from '../../common/pageState.js';
import { parseCompareDiff, formatDiffLines, callCompareApi } from '../../common/compareOutput.js';

interface PageInfo {
    pageid?: number;
    ns?: number;
    title?: string;
    missing?: boolean;
    revisions?: Array<{ revid?: number }>;
}

interface CompareMeta {
    fromrevid?: number;
    torevid?: number;
    fromtitle?: string;
    totitle?: string;
    fromuser?: string;
    touser?: string;
    fromcomment?: string;
    tocomment?: string;
    fromtimestamp?: string;
    totimestamp?: string;
    '*': string;
}

interface CompareResponse {
    error?: { code: string; info: string };
    compare?: CompareMeta;
}

function getFirstItem<T>(obj: Record<string, T> | null | undefined): T | null {
    if (!obj) return null;
    for (const key in obj) {
        return obj[key];
    }
    return null;
}

export function diffRevisionsTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'diff-revisions',
        'Compare two revisions of a wiki page with the server-side diff engine (action=compare). ' +
        'Defaults: from_rev = the revision recorded when this session last read the page (via get-article), ' +
        'to_rev = the current latest revision — so calling with just {"title"} shows what changed since you last read it. ' +
        'Both from_rev and to_rev may be given without title/id. ' +
        'Output is line-based diff text (@@ line @@ headers, - removed, + added; ' +
        'inline word changes use [-removed-] / {+added+}, GNU wdiff convention); ' +
        'added/removed count changed lines. Read-only, nothing is modified.',
        {
            title: z.string().optional().describe( 'Page title (required unless both from_rev and to_rev are given)' ),
            id: z.number().optional().describe( 'Page ID (required unless both from_rev and to_rev are given)' ),
            from_rev: z.number().optional().describe( 'Older revision ID. Default: the revision from this session\'s last read of the page' ),
            to_rev: z.number().optional().describe( 'Newer revision ID. Default: the page\'s current latest revision' ),
            maxlen: z.number().int().min( 0 ).optional().describe(
                'Maximum diff length in characters. Longer diffs are truncated with a marker; increase to read more.' ),
        },
        {
            title: 'Diff revisions',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        } as ToolAnnotations,
        async ( { title, id, from_rev, to_rev, maxlen } ) =>
            handleDiffRevisionsTool( title, id, from_rev, to_rev, maxlen )
    );
    tool.update({
        outputSchema: {
            title: z.string(),
            from: z.object({
                revid: z.number(),
                user: z.string().optional(),
                timestamp: z.string().optional(),
                comment: z.string().optional(),
            }),
            to: z.object({
                revid: z.number(),
                user: z.string().optional(),
                timestamp: z.string().optional(),
                comment: z.string().optional(),
            }),
            diff: z.string(),
            added: z.number(),
            removed: z.number(),
            truncated: z.boolean(),
            identical: z.boolean(),
        },
    });
    return tool;
}

async function handleDiffRevisionsTool(
    title: string | undefined,
    id: number | undefined,
    fromRev: number | undefined,
    toRev: number | undefined,
    maxlen: number | undefined
): Promise<CallToolResult> {
    try {
        const bothExplicit = fromRev !== undefined && toRev !== undefined;
        if (!title && id == null && !bothExplicit) {
            return errorResult('Provide "title" or "id", or both "from_rev" and "to_rev".');
        }
        if (title && id != null) {
            return errorResult('Provide either "title" or "id", not both.');
        }

        const bot = await getBot();

        // Resolve the page unless both revisions were named explicitly.
        let pageid: number | undefined;
        let pageTitle: string | undefined = title;
        let latestRevid: number | undefined;

        if (!bothExplicit) {
            const raw = await callApi<{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query?: { pages?: Record<string, any> };
            }>(bot, {
                action: 'query',
                prop: 'info|revisions',
                rvprop: 'ids',
                rvlimit: 1,
                ...(id != null ? { pageids: id } : { titles: title }),
            }, 'GET');
            const page = getFirstItem(raw.query?.pages) as PageInfo | null;
            if (!page || page.missing !== undefined) {
                return errorResult(`Page "${title ?? id}" not found.`);
            }
            pageid = page.pageid;
            pageTitle = page.title ?? title;
            latestRevid = page.revisions?.[0]?.revid;
        }

        let from = fromRev;
        if (from === undefined) {
            const record = pageid != null ? getReadRecord(pageid) : undefined;
            if (!record) {
                return errorResult(
                    `No read state recorded for page "${pageTitle}" in this session. ` +
                    'Call get-article (or get-article-with-lineno) first to establish a baseline, ' +
                    'or pass "from_rev" explicitly.'
                );
            }
            from = record.revid;
        }

        let to = toRev;
        if (to === undefined) {
            if (latestRevid == null) {
                return errorResult(`Could not determine the latest revision of page "${pageTitle ?? pageid}".`);
            }
            to = latestRevid;
        }

        const raw = await callCompareApi(bot, {
            action: 'compare',
            fromrev: from,
            torev: to,
        }, 'GET') as CompareResponse;

        if (raw?.error) {
            const { code, info } = raw.error as { code?: string; info?: string };
            if (code === 'nosuchrevid' || code === 'missingrev') {
                return errorResult(`Revision not found (from_rev ${from} → to_rev ${to}): ${info ?? code}`);
            }
            return errorResult(`Compare failed: ${info ?? code ?? 'unknown error'}`);
        }

        const compare = raw?.compare as CompareMeta | undefined;
        const parsed = parseCompareDiff(compare?.['*'] ?? '');
        const { diff, truncated } = formatDiffLines(parsed.lines, maxlen);

        return jsonResult({
            // MW <1.24's compare response has no fromtitle/totitle — fall
            // back to the resolved page title, then to the revision pair.
            title: compare?.totitle ?? compare?.fromtitle ?? pageTitle ?? `revisions ${from}→${to}`,
            from: {
                revid: compare?.fromrevid ?? from,
                user: compare?.fromuser,
                timestamp: compare?.fromtimestamp,
                comment: compare?.fromcomment,
            },
            to: {
                revid: compare?.torevid ?? to,
                user: compare?.touser,
                timestamp: compare?.totimestamp,
                comment: compare?.tocomment,
            },
            diff,
            added: parsed.added,
            removed: parsed.removed,
            truncated,
            identical: parsed.added === 0 && parsed.removed === 0,
        });
    } catch ( error ) {
        const message = ( error as Error ).message ?? '';
        // nodemw converts API errors into thrown exceptions — match message text.
        if (/nosuchrevid/i.test(message) || (/revision|revid|版本/i.test(message) && /not exist|不存在|not found|no revision|no such/i.test(message))) {
            return errorResult(
                `Revision not found (${message.replace(/^Error returned by API: /, '')}). ` +
                'Use get-article-revisions to list valid revision IDs.'
            );
        }
        return errorResult('Failed to diff revisions', error as Error);
    }
}

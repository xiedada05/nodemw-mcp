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
import { getBot, getMediaWikiVersion } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';
import { parseCompareDiff, formatDiffLines, callCompareApi } from '../../common/compareOutput.js';

interface CompareMeta {
    fromrevid?: number;
    fromtitle?: string;
    totitle?: string;
    '*': string;
}

interface CompareResponse {
    error?: { code: string; info: string };
    compare?: CompareMeta;
}

export function diffPreviewTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'diff-preview',
        'Preview what saving new content would change: diffs the proposed full-page wikitext against ' +
        'the page\'s current revision via the server-side diff engine (action=compare). ' +
        'Nothing is written — use it before write to review the exact change. ' +
        'Provide the COMPLETE new page text (for edit/append workflows, assemble the full resulting text first); ' +
        'topst applies pre-save transform so {{subst:}}-style expansions match a real save on MediaWiki 1.27+. ' +
        'Output is line-based diff text (@@ line @@ headers, - removed, + added; ' +
        'inline word changes use [-removed-] / {+added+}, GNU wdiff convention).',
        {
            title: z.string().describe( 'Page title to preview the change against' ),
            content: z.string().describe( 'Proposed COMPLETE new page content (wikitext) to diff against the current revision' ),
            maxlen: z.number().int().min( 0 ).optional().describe(
                'Maximum diff length in characters. Longer diffs are truncated with a marker; increase to read more.' ),
        },
        {
            title: 'Diff preview',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        } as ToolAnnotations,
        async ( { title, content, maxlen } ) => handleDiffPreviewTool( title, content, maxlen )
    );
    tool.update({
        outputSchema: {
            title: z.string(),
            current_revid: z.number().optional(),
            diff: z.string(),
            added: z.number(),
            removed: z.number(),
            truncated: z.boolean(),
            identical: z.boolean(),
        },
    });
    return tool;
}

async function handleDiffPreviewTool(
    title: string,
    content: string,
    maxlen: number | undefined
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        // Text comparison (totext) landed in MediaWiki 1.24; on 1.23 the API
        // answers inputneeded because the "to" side then has no revision.
        const mwVersion = getMediaWikiVersion();
        if (mwVersion !== null && mwVersion < 1.24) {
            return errorResult(
                `diff-preview needs MediaWiki 1.24+ (this wiki runs ${mwVersion}). ` +
                'Fetch both versions with get-article / get-article-by-revision and compare them directly instead.'
            );
        }

        const params: Record<string, unknown> = {
            action: 'compare',
            fromtitle: title,
            totext: content,
        };
        // topst (pre-save transform) is 1.27+; older MediaWiki reject the parameter.
        if (mwVersion === null || mwVersion >= 1.27) {
            params.topst = 1;
        }

        let raw: CompareResponse;
        try {
            raw = await callCompareApi(bot, params, 'POST') as CompareResponse;
        } catch ( error ) {
            const message = ( error as Error ).message ?? '';
            if (/unrecognized parameter[^]*topst/i.test(message)) {
                delete params.topst;
                raw = await callCompareApi(bot, params, 'POST') as CompareResponse;
            } else {
                throw error;
            }
        }

        if (raw?.error) {
            const { code, info } = raw.error;
            if (code === 'missingtitle') {
                return errorResult(
                    `Page "${title}" does not exist yet — creating it is a new-page write with ` +
                    'no existing content to diff. Confirm with get-article, then use write directly.'
                );
            }
            return errorResult(`Compare failed: ${info ?? code ?? 'unknown error'}`);
        }

        const compare = raw?.compare;
        const parsed = parseCompareDiff(compare?.['*'] ?? '');
        const { diff, truncated } = formatDiffLines(parsed.lines, maxlen);

        return jsonResult({
            title: compare?.fromtitle ?? title,
            current_revid: compare?.fromrevid,
            diff,
            added: parsed.added,
            removed: parsed.removed,
            truncated,
            identical: parsed.added === 0 && parsed.removed === 0,
        });
    } catch ( error ) {
        const message = ( error as Error ).message ?? '';
        // nodemw converts API errors (e.g. missingtitle) into thrown
        // exceptions, so match the message text.
        if (/missingtitle/i.test(message) || /does not exist|不存在/i.test(message)) {
            return errorResult(
                `Page "${title}" does not exist yet — creating it is a new-page write with ` +
                'no existing content to diff. Confirm with get-article, then use write directly.'
            );
        }
        if (/inputneeded/i.test(message) || /unrecognized parameter[^]*totext/i.test(message)) {
            return errorResult(
                `diff-preview needs MediaWiki 1.24+ (text comparison). ` +
                'Fetch both versions with get-article / get-article-by-revision and compare them directly instead.'
            );
        }
        return errorResult('Failed to build diff preview', error as Error);
    }
}

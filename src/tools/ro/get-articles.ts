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
import { markAsRead } from '../../common/pageState.js';

interface BatchPage {
    pageid?: number;
    ns?: number;
    title?: string;
    missing?: boolean | string;
    revisions?: Array<{ '*': string; revid?: number }>;
}

interface BatchResult {
    title: string;
    pageid?: number;
    ns?: number;
    revid?: number;
    content: string;
    missing: boolean;
}

export function getArticlesTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'get-articles',
        'Batch-read multiple wiki pages in a single API call. ' +
        'MediaWiki natively supports fetching multiple pages at once via ' +
        'pipe-separated titles — this tool avoids N separate API round-trips. ' +
        'Useful for reading multiple modules, templates, or related pages at once.',
        {
            titles: z.array(z.string()).min(1).max(50).describe(
                'Array of page titles to fetch (e.g., ["Module:QRCode", "Module:QRSVG"]). ' +
                'Max 50 titles per call.'
            ),
            ids: z.array(z.number()).min(1).max(50).optional().describe(
                'Array of page IDs to fetch — alternative to titles. Max 50 IDs per call.'
            )
        },
        {
            title: 'Batch read articles',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { titles, ids } ) => handleGetArticlesTool( titles, ids )
    );
}

async function handleGetArticlesTool(
    titles: string[],
    ids?: number[]
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        // Build API params — use titles XOR ids
        const params: Record<string, unknown> = {
            action: 'query',
            prop: 'revisions',
            rvprop: 'ids|content'
        };

        if (ids && ids.length > 0) {
            params.pageids = ids.join('|');
        } else {
            params.titles = titles.join('|');
        }

        const apiResult = await callApi(bot, params, 'GET');

        const pages = (apiResult.query as Record<string, BatchPage> | undefined)?.pages;
        if (!pages) {
            return jsonResult({ pages: [] });
        }

        const results: BatchResult[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalizedPages = ((apiResult as any).query?.normalized) as Array<{ from: string; to: string }> | undefined;

        for (const [, page] of Object.entries(pages)) {
            // Resolve normalized title if applicable
            let displayTitle = page.title;
            if (!displayTitle && normalizedPages) {
                // Try to find the original title from the input that normalized to this page
                for (const n of normalizedPages) {
                    if (n.to === page.title) {
                        displayTitle = n.from;
                        break;
                    }
                }
            }

            const rev = page.revisions?.[0];
            const content = rev?.['*'];

            const isMissing = page.missing !== undefined && page.missing !== false;

            const entry: BatchResult = {
                title: displayTitle ?? '(unknown)',
                pageid: page.pageid,
                ns: page.ns,
                revid: rev?.revid,
                content: content ?? (isMissing ? '' : '(empty page)'),
                missing: isMissing
            };

            // Record read state for each page
            if (page.pageid != null && rev?.revid != null) {
                markAsRead(page.pageid, rev.revid);
            }

            results.push(entry);
        }

        return jsonResult({ pages: results });
    } catch ( error ) {
        return errorResult('Failed to batch-read pages', error as Error);
    }
}

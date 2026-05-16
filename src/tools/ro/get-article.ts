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
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { markAsRead } from '../../common/pageState.js';

interface PageInfo {
    pageid?: number;
    lastrevid?: number;
    missing?: boolean;
}

async function recordReadState(title: string | number): Promise<void> {
    try {
        const bot = await getBot();
        const pages = await promisifyBotMethod<PageInfo[]>(
            bot,
            'getArticleInfo',
            title,
            { prop: 'info' }
        );
        const page = Array.isArray(pages) ? pages[0] : null;
        if (page?.pageid != null && page?.lastrevid != null) {
            markAsRead(page.pageid, page.lastrevid);
        }
    } catch {
        // Non-critical: read-state recording failure should not break the tool
    }
}

function getFirstItem<T>(obj: Record<string, T> | null | undefined): T | null {
    if (!obj) return null;
    for (const key in obj) {
        return obj[key];
    }
    return null;
}

export function getArticleTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'get-article',
        'Retrieve the content of a wiki article',
        {
            title: z.string().describe( 'Article title' ),
            followRedirect: z.boolean().optional().default( true ).describe( 'Follow redirects' ),
            redirectInfo: z.boolean().optional().default( false ).describe( 'Include information about redirects' ),
            revision: z.number().optional().describe( 'Specific revision ID to fetch. If omitted, returns the latest version.' )
        },
        {
            title: 'Get article',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title, followRedirect, redirectInfo, revision } ) => handleGetArticleTool( title, followRedirect, redirectInfo, revision )
    );
}

async function handleGetArticleTool(
    title: string,
    followRedirect: boolean,
    redirectInfo: boolean,
    revision?: number
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        if (revision !== undefined) {
            // Bypass bot.getArticle — call the API directly with rvstartid to fetch a specific revision
            const params: Record<string, unknown> = {
                action: 'query',
                prop: 'revisions',
                rvprop: 'content',
                rvstartid: revision,
                rvlimit: 1,
                titles: title,
                ...(followRedirect && { redirects: '' })
            };

            const info = await new Promise<Record<string, unknown>>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (bot as any).api.call(params, (err: Error | null, info: Record<string, unknown>) => {
                    if (err) reject(err);
                    else resolve(info);
                }, 'GET');
            });

            const pages = info.pages as Record<string, Record<string, unknown>> | undefined;
            const page = getFirstItem(pages);
            if (!page || page.missing) {
                return {
                    content: [{ type: 'text', text: `Page "${title}" not found.` }],
                    isError: true
                };
            }
            const revisions = page.revisions as Array<{ '*': string }> | undefined;
            const rev = revisions?.[0];
            if (!rev || rev['*'] == null) {
                return {
                    content: [{ type: 'text', text: `Revision ${revision} not found for page "${title}".` }],
                    isError: true
                };
            }

            await recordReadState(title);
            return {
                content: [{ type: 'text', text: rev['*'] }]
            };
        }

        // Original path: fetch latest version via bot.getArticle
        if (redirectInfo) {
            const result = await new Promise<[string, unknown]>((resolve, reject) => {
                const callback = (err: Error | null, content: string, redirectInfo: unknown) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve([content, redirectInfo]);
                    }
                };

                // @ts-expect-error: any method call
                bot.getArticle(title, followRedirect, callback);
            });
            const [content, redirect] = result;
            if (content == null) {
                return {
                    content: [{ type: 'text', text: `Page "${title}" not found or has no content.` }],
                    isError: true
                };
            }
            const responseText = redirect
                ? `Content:\n\n${content}\n\nRedirect Information:\n\n${JSON.stringify(redirect, null, 2)}`
                : content;

            await recordReadState(title);
            return {
                content: [ { type: 'text', text: responseText } ]
            };
        } else {
            const result = await promisifyBotMethod<string>(
                bot,
                'getArticle',
                title,
                followRedirect
            );
            if (result == null) {
                return {
                    content: [{ type: 'text', text: `Page "${title}" not found or has no content.` }],
                    isError: true
                };
            }
            await recordReadState(title);
            return {
                content: [ { type: 'text', text: result } ]
            };
        }
    } catch ( error ) {
        return {
            content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
            isError: true
        };
    }
}

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
import { callApi } from '../../common/utils.js';
import { markAsRead } from '../../common/pageState.js';

interface PageInfo {
    pageid?: number;
    lastrevid?: number;
    missing?: boolean;
}

async function recordReadState(identifier: string | number): Promise<void> {
    try {
        const bot = await getBot();
        const pages = await promisifyBotMethod<PageInfo[]>(
            bot,
            'getArticleInfo',
            identifier,
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
            title: z.string().optional().describe( 'Article title (required if "id" is not provided)' ),
            id: z.number().optional().describe( 'Page ID (required if "title" is not provided)' ),
            followRedirect: z.boolean().optional().default( true ).describe( 'Follow redirects (only applies when using "title")' ),
            redirectInfo: z.boolean().optional().default( false ).describe( 'Include information about redirects' ),
            revision: z.number().optional().describe( 'Specific revision ID to fetch. If omitted, returns the latest version.' ),
            maxlen: z.number().int().min( 0 ).optional().describe(
                'Maximum response length in characters. ' +
                'If the article exceeds this length, it will be truncated with a "[truncated]" marker. ' +
                'Useful when deploying behind HTTP proxies with response size limits (e.g. Alibaba Cloud FC). ' +
                'Omit for full content.' ),
            offset: z.number().int().min( 0 ).optional().describe(
                'Character offset into the article content to start from. ' +
                'Combine with maxlen to paginate through long articles: first call with maxlen, ' +
                'then continue with offset = maxlen to read the next chunk.' )
        },
        {
            title: 'Get article',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title, id, followRedirect, redirectInfo, revision, maxlen, offset } ) =>
            handleGetArticleTool( title, id, followRedirect, redirectInfo, revision, maxlen, offset )
    );
}

function applyMaxlen(content: string, maxlen?: number, offset?: number): string {
    let text = content;
    if (offset !== undefined && offset > 0) {
        if (offset >= text.length) {
            return '(reached end of article)';
        }
        text = text.slice(offset);
    }
    if (maxlen === undefined || maxlen <= 0) return text;
    if (text.length <= maxlen) return text;
    return text.slice(0, maxlen) + '\n\n[truncated — article exceeds maxlen, call get-article again with offset=<n> to continue reading]';
}

async function handleGetArticleTool(
    title: string | undefined,
    id: number | undefined,
    followRedirect: boolean,
    redirectInfo: boolean,
    revision?: number,
    maxlen?: number,
    offset?: number
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        // Validate: exactly one of title or id must be provided
        if (!title && id == null) {
            return {
                content: [{ type: 'text', text: 'Either "title" or "id" must be provided.' }],
                isError: true
            };
        }
        if (title && id != null) {
            return {
                content: [{ type: 'text', text: 'Provide either "title" or "id", not both.' }],
                isError: true
            };
        }

        const useDirectApi = revision !== undefined || id !== undefined;

        if (useDirectApi) {
            // Use direct API call (for revision lookup and/or page-id lookup)
            const params: Record<string, unknown> = {
                action: 'query',
                prop: 'revisions',
                rvprop: 'content',
                rvlimit: 1,
                ...(id !== undefined ? { pageids: id } : { titles: title }),
                ...(revision !== undefined && { rvstartid: revision }),
                // redirects param is ignored by MW API when pageids is used
                ...(id === undefined && followRedirect && { redirects: '' })
            };

            const raw = await callApi(bot, params, 'GET');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
const pages = (raw.query as any)?.pages as Record<string, Record<string, any>> | undefined;
            const page = getFirstItem(pages);
            if (!page || page.missing !== undefined) {
                const identifier = title ?? `id ${id}`;
                return {
                    content: [{ type: 'text', text: `Page "${identifier}" not found.` }],
                    isError: true
                };
            }

            if (revision !== undefined) {
                const revisions = page.revisions as Array<{ '*': string }> | undefined;
                const rev = revisions?.[0];
                if (!rev || rev['*'] == null) {
                    const identifier = title ?? `id ${id}`;
                    return {
                        content: [{ type: 'text', text: `Revision ${revision} not found for page "${identifier}".` }],
                        isError: true
                    };
                }
                await recordReadState(id ?? title!);
                return {
                    content: [{ type: 'text', text: applyMaxlen(rev['*'], maxlen, offset) }]
                };
            }

            // id-only path: page content is in revisions[0]['*']
            const revisions = page.revisions as Array<{ '*': string }> | undefined;
            const content = revisions?.[0]?.['*'];
            if (content == null) {
                return {
                    content: [{ type: 'text', text: page.title ? `Page "${page.title}" is empty.` : `Page ID ${id} is empty.` }],
                    isError: false
                };
            }
            await recordReadState(id ?? title!);
            return {
                content: [{ type: 'text', text: applyMaxlen(content === '' ? '(empty page)' : content, maxlen, offset) }]
            };
        }

        // Original path: fetch latest version via bot.getArticle (title-only)
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
                    content: [{ type: 'text', text: `Page "${title}" not found.` }],
                    isError: true
                };
            }
            const responseText = redirect
                ? `Content:\n\n${applyMaxlen(content, maxlen, offset)}\n\nRedirect Information:\n\n${JSON.stringify(redirect, null, 2)}`
                : applyMaxlen(content === '' ? '(empty page)' : content, maxlen, offset);

            await recordReadState(title!);
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
                    content: [{ type: 'text', text: `Page "${title}" not found.` }],
                    isError: true
                };
            }
            await recordReadState(title!);
            return {
                content: [ { type: 'text', text: applyMaxlen(result === '' ? '(empty page)' : result, maxlen, offset) } ]
            };
        }
    } catch ( error ) {
        return {
            content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
            isError: true
        };
    }
}

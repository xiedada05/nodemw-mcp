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
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ArticleInfo extends Record<string, any> {
    title: string;
    pageid: number;
    ns: number;
}

export function getArticleInfoTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-article-info',
        'Get detailed information about one or more articles',
        {
            title: z.union([
                z.string(),
                z.array(z.string())
            ]).optional().describe('Article title or array of titles (required if "id" is not provided)'),
            id: z.union([
                z.number(),
                z.array(z.number())
            ]).optional().describe('Page ID or array of page IDs (required if "title" is not provided)'),
            properties: z.array(z.string()).optional().describe('Specific properties to retrieve (e.g. protection, talkid, url)')
        },
        {
            title: 'Get article info',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title, id, properties } ) => handleGetArticleInfoTool( title, id, properties )
    );
    tool.update({ outputSchema: { identifier: z.union([z.string(), z.number(), z.array(z.unknown())]), results: z.array(z.record(z.unknown())), count: z.number() } });
    return tool;
}

async function handleGetArticleInfoTool(
    title: string | string[] | undefined,
    id: number | number[] | undefined,
    properties?: string[]
): Promise<CallToolResult> {
    try {
        const hasTitle = typeof title === 'string' ? title.length > 0 : Array.isArray(title) ? title.length > 0 : false;
        const hasId = typeof id === 'number' ? id > 0 : Array.isArray(id) ? id.length > 0 : false;

        if (!hasTitle && !hasId) {
            return errorResult('Either "title" or "id" must be provided');
        }
        if (hasTitle && hasId) {
            return errorResult('Provide either "title" or "id", not both');
        }

        const bot = await getBot();

        if (hasId) {
            // Use low-level API: the high-level Bot method may not support page IDs
            const ids = Array.isArray(id) ? id : [id];
            const pageids = ids.join('|');
            const apiParams: Record<string, unknown> = {
                action: 'query',
                prop: 'info',
                pageids,
                inprop: properties?.join('|') || 'protection|talkid|url'
            };

            const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
                (bot as any).api.call(
                    apiParams,
                    (err: Error | null, data: Record<string, unknown>) => {
                        if (err) reject(err);
                        else resolve(data);
                    },
                    'GET'
                );
            });

            const pages = result.pages as Record<string, Record<string, unknown>> | undefined;
            const results = pages ? Object.values(pages).filter(p => p.missing === undefined) : [];

            return jsonResult({
                identifier: Array.isArray(id) ? id : id,
                results,
                count: results.length
            });
        }

        if (Array.isArray(title)) {
            // Use low-level API for array titles: nodemw's getArticleInfo
            // iterates arrays with for..in (yielding indices, not values).
            const titles = title.join('|');
            const apiParams: Record<string, unknown> = {
                action: 'query',
                prop: 'info',
                titles,
                inprop: properties?.join('|') || 'protection|talkid|url'
            };

            const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
                (bot as any).api.call(
                    apiParams,
                    (err: Error | null, data: Record<string, unknown>) => {
                        if (err) reject(err);
                        else resolve(data);
                    },
                    'GET'
                );
            });

            const pages = result.pages as Record<string, Record<string, unknown>> | undefined;
            const results = pages ? Object.values(pages).filter(p => p.missing === undefined) : [];

            return jsonResult({
                identifier: title,
                results,
                count: results.length
            });
        }

        const info = await promisifyBotMethod<ArticleInfo>(
            bot,
            'getArticleInfo',
            title,
            {}
        );

        const results = Array.isArray(info) ? info : [info];

        return jsonResult({
            identifier: title,
            results,
            count: results.length
        });
    } catch ( error ) {
        return errorResult('Failed to get article info', error as Error);
    }
}

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

export function getArticleCategoriesTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-article-categories',
        'Get all categories that an article belongs to',
        {
            title: z.string().optional().describe('Article title (required if "id" is not provided)'),
            id: z.number().optional().describe('Page ID (required if "title" is not provided)')
        },
        {
            title: 'Get article categories',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title, id } ) => handleGetArticleCategoriesTool( title, id )
    );
    tool.update({ outputSchema: { title: z.union([z.string(), z.number()]), categories: z.array(z.string()), count: z.number() } });
    return tool;
}

function getFirstItem<T>(obj: Record<string, T> | null | undefined): T | null {
    if (!obj) return null;
    for (const key in obj) {
        return obj[key];
    }
    return null;
}

async function handleGetArticleCategoriesTool(
    title: string | undefined,
    id: number | undefined
): Promise<CallToolResult> {
    try {
        if (!title && id == null) {
            return errorResult('Either "title" or "id" must be provided');
        }
        if (title && id != null) {
            return errorResult('Provide either "title" or "id", not both');
        }

        const bot = await getBot();

        if (id !== undefined) {
            // Use low-level API: the high-level Bot method may not support page IDs
            const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
                (bot as any).api.call(
                    { action: 'query', prop: 'categories', pageids: id, cllimit: 'max' },
                    (err: Error | null, data: Record<string, unknown>) => {
                        if (err) reject(err);
                        else resolve(data);
                    },
                    'GET'
                );
            });

            const pages = result.pages as Record<string, Record<string, unknown>> | undefined;
            const page = getFirstItem(pages);
            if (!page || page.missing !== undefined) {
                return errorResult(`Page with ID ${id} not found`);
            }
            const rawCategories = page.categories as Array<{ title: string }> | undefined;
            const categories = (rawCategories || []).map(c => c.title);

            return jsonResult({
                title: page.title ?? id,
                categories,
                count: categories.length
            });
        }

        const categories = await promisifyBotMethod<string[]>(
            bot,
            'getArticleCategories',
            title
        );

        return jsonResult({
            title,
            categories,
            count: categories.length
        });
    } catch ( error ) {
        return errorResult('Failed to get article categories', error as Error);
    }
}

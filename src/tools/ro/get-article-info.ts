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
                z.number(),
                z.array(z.union([z.string(), z.number()]))
            ]).describe('Article title, page ID, or array of titles/IDs'),
            properties: z.array(z.string()).optional().describe('Specific properties to retrieve (e.g. protection, talkid, url)')
        },
        {
            title: 'Get article info',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title, properties } ) => handleGetArticleInfoTool( title, properties )
    );
    tool.update({ outputSchema: { title: z.string(), results: z.array(z.record(z.unknown())), count: z.number() } });
    return tool;
}

async function handleGetArticleInfoTool(
    title: string | number | (string | number)[],
    properties?: string[]
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const options = properties ? { inprop: properties } : {};
        const info = await promisifyBotMethod<ArticleInfo>(
            bot,
            'getArticleInfo',
            title,
            options
        );

        // Handle array of results vs single result
        const results = Array.isArray(info) ? info : [info];

        return jsonResult({
            title,
            results,
            count: results.length
        });
    } catch ( error ) {
        return errorResult('Failed to get article info', error as Error);
    }
}

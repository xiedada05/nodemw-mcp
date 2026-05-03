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
interface PageByPrefix extends Record<string, any> {
    title: string;
    pageid: number;
    ns: number;
}

export function getPagesByPrefixTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-pages-by-prefix',
        'Get pages starting with a specific prefix',
        {
            prefix: z.string().describe('Prefix to match page titles')
        },
        {
            title: 'Get pages by prefix',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { prefix } ) => handleGetPagesByPrefixTool( prefix )
    );
    tool.update({ outputSchema: { prefix: z.string(), pages: z.array(z.record(z.unknown())), count: z.number() } });
    return tool;
}

async function handleGetPagesByPrefixTool(
    prefix: string
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const results = await promisifyBotMethod<PageByPrefix[]>(
            bot,
            'getPagesByPrefix',
            prefix
        );

        return jsonResult({
            prefix,
            pages: results,
            count: results.length
        });
    } catch ( error ) {
        return errorResult('Failed to get pages by prefix', error as Error);
    }
}

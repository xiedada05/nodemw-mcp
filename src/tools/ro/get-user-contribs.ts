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
interface UserContrib extends Record<string, any> {
    title: string;
    revid: number;
    timestamp: string;
    comment: string;
}

export function getUserContribsTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-user-contribs',
        'Get contributions made by a specific user',
        {
            username: z.string().describe('Username to get contributions for'),
            namespace: z.number().optional().describe('Filter contributions by namespace'),
            limit: z.number().optional().default(50).describe('Maximum number of contributions to return')
        },
        {
            title: 'Get user contributions',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { username, namespace, limit } ) => handleGetUserContribsTool( username, namespace, limit )
    );
    tool.update({ outputSchema: { username: z.string(), namespace: z.number(), limit: z.number(), total: z.number(), displayed: z.number(), contributions: z.array(z.record(z.unknown())) } });
    return tool;
}

async function handleGetUserContribsTool(
    username: string,
    namespace?: number,
    limit: number = 50
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const options = {
            user: username,
            ...(namespace !== undefined && { namespace })
        };

        const callbackArgs = await promisifyBotMethod<[Error | null, UserContrib[], string | boolean]>(
            bot,
            'getUserContribs',
            options
        );

        const contribs = Array.isArray(callbackArgs[1]) ? callbackArgs[1] : [];

        // Limit results
        const limitedContribs = contribs.slice(0, limit);

        return jsonResult({
            username,
            namespace,
            limit,
            total: contribs.length,
            displayed: limitedContribs.length,
            contributions: limitedContribs
        });
    } catch ( error ) {
        return errorResult('Failed to get user contributions', error as Error);
    }
}

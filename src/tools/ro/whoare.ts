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

export function whoareTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'whoare',
        'Get information about multiple wiki users',
        {
            usernames: z.array( z.string() ).optional().describe( 'Array of usernames to query (required if "ids" is not provided)' ),
            ids: z.array( z.number() ).optional().describe( 'Array of user IDs to query (required if "usernames" is not provided)' )
        },
        {
            title: 'Who are',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { usernames, ids } ) => handleWhoareTool( usernames, ids )
    );
    tool.update({ outputSchema: { users: z.array(z.record(z.unknown())), count: z.number() } });
    return tool;
}

async function handleWhoareTool(
    usernames?: string[],
    ids?: number[]
): Promise<CallToolResult> {
    try {
        if ( (!usernames || usernames.length === 0) && (!ids || ids.length === 0) ) {
            return errorResult('Either "usernames" or "ids" must be provided and non-empty');
        }
        if ( usernames && usernames.length > 0 && ids && ids.length > 0 ) {
            return errorResult('Provide either "usernames" or "ids", not both');
        }

        const bot = await getBot();

        if ( ids && ids.length > 0 ) {
            const data = await new Promise<Record<string, any>>((resolve, reject) => {
                (bot as any).api.call(
                    { action: 'query', list: 'users', ususerids: ids.join('|'), usprop: 'blockinfo|groups|rights|editcount|registration' },
                    (err: Error | null, result: Record<string, any>) => {
                        if (err) reject(err);
                        else resolve(result);
                    },
                    'GET'
                );
            });

            const users = (data?.query?.users as any[]) || [];
            const normalized = users.map(u =>
                u && u.missing !== undefined ? { ...u, missing: true } : u
            );

            return jsonResult({ users: normalized, count: normalized.length });
        }

        const users = await promisifyBotMethod<any[]>(
            bot,
            'whoare',
            usernames
        );

        const normalized = users.map(u =>
            u && u.missing !== undefined ? { ...u, missing: true } : u
        );

        return jsonResult({ users: normalized, count: normalized.length });
    } catch ( error ) {
        return errorResult('Failed to get user information', error as Error);
    }
}

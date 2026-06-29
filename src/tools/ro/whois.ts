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

export function whoisTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'whois',
        'Get information about a specific user',
        {
            username: z.string().optional().describe('Username to look up (required if "id" is not provided)'),
            id: z.number().optional().describe('User ID to look up (required if "username" is not provided)')
        },
        {
            title: 'Whois',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { username, id } ) => handleWhoisTool( username, id )
    );
    tool.update({ outputSchema: { user: z.record(z.unknown()) } });
    return tool;
}

async function handleWhoisTool(
    username?: string,
    id?: number
): Promise<CallToolResult> {
    try {
        if (!username && id == null) {
            return errorResult('Either "username" or "id" must be provided');
        }
        if (username && id != null) {
            return errorResult('Provide either "username" or "id", not both');
        }

        const bot = await getBot();

        if (id !== undefined) {
            const data = await new Promise<Record<string, any>>((resolve, reject) => {
                (bot as any).api.call(
                    { action: 'query', list: 'users', ususerids: id, usprop: 'blockinfo|groups|rights|editcount|registration' },
                    (err: Error | null, result: Record<string, any>) => {
                        if (err) reject(err);
                        else resolve(result);
                    },
                    'GET'
                );
            });

            const users = data?.query?.users as any[] | undefined;
            if (!users || users.length === 0 || users[0].missing !== undefined) {
                return errorResult(`User with ID ${id} not found.`);
            }

            return jsonResult({ user: users[0] });
        }

        const userInfo = await promisifyBotMethod<any>(
            bot,
            'whois',
            username
        );

        if (userInfo.missing !== undefined) {
            return errorResult(`User "${username}" not found.`);
        }

        return jsonResult({ user: userInfo });
    } catch ( error ) {
        return errorResult('Failed to get user info', error as Error);
    }
}

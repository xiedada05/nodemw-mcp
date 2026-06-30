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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UserInfo extends Record<string, any> {
    name: string;
    userid: number;
}

export function getUsersTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-users',
        'Get all users matching a prefix',
        {
            prefix: z.string().optional().default('').describe('Prefix to filter usernames'),
            onlyWithEdits: z.boolean().optional().default(false).describe('Only include users with at least one edit'),
            limit: z.number().int().min(1).max(5000).optional().default(50).describe('Maximum number of users to return (1-5000)')
        },
        {
            title: 'Get users',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { prefix, onlyWithEdits, limit } ) => handleGetUsersTool( prefix, onlyWithEdits, limit )
    );
    tool.update({ outputSchema: { prefix: z.string(), onlyWithEdits: z.boolean(), limit: z.number(), users: z.array(z.record(z.unknown())), count: z.number() } });
    return tool;
}

async function handleGetUsersTool(
    prefix: string,
    onlyWithEdits: boolean,
    limit: number
): Promise<CallToolResult> {
    try {
        const bot = getBot();
        // Use low-level API: nodemw's getUsers always passes auwitheditsonly=0
        // which MediaWiki incorrectly interprets as a filter, hiding users.
        const params: Record<string, string | number> = {
            action: 'query',
            list: 'allusers',
            aulimit: limit
        };
        if ( prefix ) {
            params.auprefix = prefix;
        }
        if ( onlyWithEdits ) {
            params.auwitheditsonly = 1;
        }

        const raw = await callApi(bot, params, 'GET');
        const results = ((raw.query as { allusers?: UserInfo[] } | undefined)?.allusers) || [];

        return jsonResult({
            prefix,
            onlyWithEdits,
            limit,
            users: results,
            count: results.length
        });
    } catch ( error ) {
        return errorResult('Failed to get users', error as Error);
    }
}

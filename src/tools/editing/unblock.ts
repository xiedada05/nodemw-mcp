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
import { getBot, getMediaWikiVersion } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function unblockTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'unblock',
        'Unblock a wiki user (requires authentication). ' +
        'HIGH RISK: Blocks exist for a reason — removing them may release vandals, spammers, or blocked abusers back onto the wiki. ' +
        'Only unblock when the human operator explicitly commands it.',
        {
            username: z.string().optional().describe( 'Username to unblock (required if "id" is not provided)' ),
            id: z.number().optional().describe( 'User ID to unblock (required if "username" is not provided)' ),
            reason: z.string().describe( 'Reason for unblocking (visible in block log)' ),
        },
        {
            title: 'Unblock user',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( { username, id, reason } ) => handleUnblockTool( username, id, reason )
    );
    tool.update({ outputSchema: { result: z.string(), unblocked: z.string().optional(), id: z.number().optional() } });
    return tool;
}

async function handleUnblockTool(
    username?: string,
    id?: number,
    reason: string = ''
): Promise<CallToolResult> {
    try {
        if (!username && id == null) {
            return errorResult('Either "username" or "id" must be provided');
        }
        if (username && id != null) {
            return errorResult('Provide either "username" or "id", not both');
        }

        const bot = getBot();

        const tokenTitle = `User:${username ?? id}`;
        const mwVersion = getMediaWikiVersion();
        const tokenType = (mwVersion !== null && mwVersion >= 1.24) ? 'csrf' : 'block';

        const token = await new Promise<string>((resolve, reject) => {
            (bot as any).getToken(tokenTitle, tokenType, (err: Error | null, t: string) => {
                if (err) reject(err);
                else resolve(t);
            });
        });

        const prefixedReason = `[nodemw-mcp.unblock] ${reason}`;

        const params: Record<string, string | number | boolean> = {
            action: 'unblock',
            reason: prefixedReason,
            token
        };
        if (id !== undefined) {
            params.userid = id;
        } else {
            params.user = username!;
        }

        const data = await new Promise<Record<string, any>>((resolve, reject) => {
            (bot as any).api.call(params, (err: Error | null, result: Record<string, any>) => {
                if (err) reject(err);
                else resolve(result);
            }, 'POST');
        });

        if (data.error) {
            return errorResult(`Unblock failed: ${data.error.info || data.error.code}`, new Error(JSON.stringify(data.error)));
        }

        const unblocked = id !== undefined ? `user ID ${id}` : username;
        const result = data.unblock || { result: 'Success', unblocked };

        return jsonResult({
            result: 'Success',
            unblocked: result.unblocked ?? unblocked,
            id: result.id ?? data.unblock?.id
        });
    } catch ( error ) {
        return errorResult('Failed to unblock user', error as Error);
    }
}

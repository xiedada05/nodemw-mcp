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

export function blockTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'block',
        'Block a wiki user (requires authentication). ' +
        'HIGH RISK: This prevents a real person from editing. ' +
        'Use ONLY when the human operator explicitly commands it — never suggest blocks proactively. ' +
        'Supports both username and user ID targeting.',
        {
            username: z.string().optional().describe( 'Username to block (required if "id" is not provided)' ),
            id: z.number().optional().describe( 'User ID to block (required if "username" is not provided)' ),
            reason: z.string().describe( 'Reason for blocking (visible in block log)' ),
            expiry: z.string().optional().default( 'indefinite' ).describe(
                'Block duration: "indefinite" (default), "1 day", "1 week", "2026-12-31", etc. ' +
                'Use relative (e.g. "31 hours") or absolute timestamps.' ),
            anononly: z.boolean().optional().default( false ).describe( 'Only block anonymous users from this IP' ),
            nocreate: z.boolean().optional().default( true ).describe( 'Prevent account creation (recommended)' ),
            autoblock: z.boolean().optional().default( true ).describe( 'Auto-block IPs used by this user (recommended)' ),
            noemail: z.boolean().optional().default( true ).describe( 'Prevent user from sending email via wiki' ),
            allowusertalk: z.boolean().optional().default( false ).describe( 'Allow blocked user to edit own talk page' ),
            reblock: z.boolean().optional().default( false ).describe( 'Re-block if already blocked (overwrites existing block)' ),
        },
        {
            title: 'Block user',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( { username, id, reason, expiry, anononly, nocreate, autoblock, noemail, allowusertalk, reblock } ) =>
            handleBlockTool( username, id, reason, expiry, anononly, nocreate, autoblock, noemail, allowusertalk, reblock )
    );
    tool.update({ outputSchema: { result: z.string(), blocked: z.string().optional(), id: z.number().optional() } });
    return tool;
}

async function handleBlockTool(
    username?: string,
    id?: number,
    reason: string = '',
    expiry: string = 'indefinite',
    anononly: boolean = false,
    nocreate: boolean = true,
    autoblock: boolean = true,
    noemail: boolean = true,
    allowusertalk: boolean = false,
    reblock: boolean = false
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

        const prefixedReason = `[nodemw-mcp.block] ${reason}`;

        const params: Record<string, string | number | boolean> = {
            action: 'block',
            reason: prefixedReason,
            expiry,
            anononly,
            nocreate,
            autoblock,
            noemail,
            allowusertalk,
            reblock,
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
            return errorResult(`Block failed: ${data.error.info || data.error.code}`, new Error(JSON.stringify(data.error)));
        }

        const blocked = id !== undefined ? `user ID ${id}` : username;
        const result = data.block || { result: 'Success', blocked };

        return jsonResult({
            result: 'Success',
            blocked: result.blocked ?? blocked,
            id: result.id ?? data.block?.id
        });
    } catch ( error ) {
        return errorResult('Failed to block user', error as Error);
    }
}

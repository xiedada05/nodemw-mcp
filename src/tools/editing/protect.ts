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
import { requireRead } from '../../common/pageState.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function protectTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'protect',
        'Protect or unprotect a wiki page to restrict editing/moving (requires authentication). ' +
        'HIGH RISK: Protection locks out legitimate editors and can be abused to win edit wars. ' +
        'Only protect pages when there is a clear, ongoing need (vandalism, edit war, high-risk template). ' +
        'To remove protection, set level to "all". ' +
        'Available levels: "all" (anyone), "autoconfirmed" (trusted users), "sysop" (admins only).',
        {
            title: z.string().describe( 'Page title to protect or unprotect' ),
            protections: z.array(
                z.object({
                    type: z.enum(['edit', 'move']).describe( 'Action to restrict: "edit" or "move"' ),
                    level: z.enum(['all', 'autoconfirmed', 'sysop']).optional().default('all').describe(
                        'Who can perform this action: "all" = no restriction, "autoconfirmed" = trusted users only, "sysop" = admins only' ),
                    expiry: z.string().optional().describe( 'How long protection lasts (e.g. "1 day", "1 week", "infinite"). Default is indefinite.' )
                })
            ).describe( 'Protection rules — typically one entry for "edit" and optionally one for "move". Example: [{type:"edit",level:"sysop",expiry:"1 week"}]' ),
            reason: z.string().optional().describe( 'Reason for changing protection, visible in the page log' ),
            cascade: z.boolean().optional().default(false).describe( 'If true, transcluded templates/pages inherit this protection. Only works with full sysop protection on edit. Use with caution.' )
        },
        {
            title: 'Protect page',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleProtectTool( params )
    );
    tool.update({ outputSchema: { title: z.string(), reason: z.string().optional(), protections: z.array(z.record(z.unknown())), cascade: z.boolean().optional() } });
    return tool;
}

async function handleProtectTool(
    params: {
        title: string;
        protections: Array<{ type: string; level?: string; expiry?: string }>;
        reason?: string;
        cascade?: boolean;
    }
): Promise<CallToolResult> {
    try {
        const bot = getBot();
        await requireRead(params.title);

        const mwVersion = getMediaWikiVersion();
        const tokenType = (mwVersion !== null && mwVersion >= 1.24) ? 'csrf' : 'protect';

        const token = await new Promise<string>((resolve, reject) => {
            (bot as any).getToken(params.title, tokenType, (err: Error | null, t: string) => {
                if (err) reject(err);
                else resolve(t);
            });
        });

        // Build protections string: "edit=sysop|move=autoconfirmed"
        const protectionStr = params.protections
            .map(p => `${p.type}=${p.level || 'all'}`)
            .join('|');

        // Build expiry string: "1 week|infinite"
        const expiryStr = params.protections
            .map(p => p.expiry || 'infinite')
            .join('|');

        const apiParams: Record<string, string | number | boolean> = {
            action: 'protect',
            title: params.title,
            protections: protectionStr,
            expiry: expiryStr,
            token
        };
        if (params.reason) {
            apiParams.reason = `[nodemw-mcp.protect] ${params.reason}`;
        }
        if (params.cascade) {
            apiParams.cascade = true;
        }

        const data = await new Promise<Record<string, any>>((resolve, reject) => {
            (bot as any).api.call(apiParams, (err: Error | null, result: Record<string, any>) => {
                if (err) reject(err);
                else resolve(result);
            }, 'POST');
        });

        if (data.error) {
            return errorResult(`Protect failed: ${data.error.info || data.error.code}`, new Error(JSON.stringify(data.error)));
        }

        return jsonResult(data.protect || data);
    } catch ( error ) {
        return errorResult('Failed to protect page', error as Error);
    }
}

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
import { requireRead } from '../../common/pageState.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function protectTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'protect',
        'Protect or unprotect a wiki page to restrict editing/moving (requires authentication). ' +
        'CRITICAL: Protection can lock out legitimate editors — only protect pages when there is a clear need ' +
        '(ongoing vandalism, edit war, high-risk template, policy page). ' +
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
    tool.update({ outputSchema: { title: z.string(), reason: z.string().optional(), protections: z.array(z.record(z.unknown())), cascade: z.boolean() } });
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
        const bot = await getBot();
        await requireRead(params.title);
        const options: any = {};
        if (params.reason) {
            options.reason = `[nodemw-mcp.protect] ${params.reason}`;
        }
        if (params.cascade) {
            options.cascade = params.cascade;
        }

        const result = await promisifyBotMethod<{
            title: string;
            protections: any[];
        }>(
            bot,
            'protect',
            params.title,
            params.protections,
            options
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to protect page', error as Error);
    }
}

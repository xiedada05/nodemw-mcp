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

export function protectTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'protect',
        'Protect a wiki page (requires authentication)',
        {
            title: z.string().describe( 'Page title to protect' ),
            protections: z.array(
                z.object({
                    type: z.string().describe( 'Action type (e.g., edit, move)' ),
                    level: z.string().optional().default('all').describe( 'Protection level (e.g., sysop, autoconfirmed)' ),
                    expiry: z.string().optional().describe( 'Expiry time (e.g., 1 week, never)' )
                })
            ).describe( 'Protection settings' ),
            reason: z.string().optional().describe( 'Reason for protection' ),
            cascade: z.boolean().optional().default(false).describe( 'Apply cascade protection' )
        },
        {
            title: 'Protect page',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleProtectTool( params )
    );
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
        const options: any = {};
        if (params.reason) {
            options.reason = `[nodemw-mcp] ${params.reason}`;
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

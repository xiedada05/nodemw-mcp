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

export function moveTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'move',
        'Move (rename) a wiki page — changes the page title and creates a redirect from the old name (requires authentication). ' +
        'The old page title becomes a redirect to the new title. All page history moves with the page.',
        {
            from: z.string().describe( 'Current/existing page title to rename' ),
            to: z.string().describe( 'New target page title — must not already exist (unless moving to overwrite)' ),
            summary: z.string().describe( 'Reason for the move (visible in move log)' ),
        },
        {
            title: 'Move page',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleMoveTool( params )
    );
    tool.update({ outputSchema: { from: z.string(), to: z.string(), reason: z.string(), redirectcreated: z.boolean().optional() } });
    return tool;
}

async function handleMoveTool(
    params: {
        from: string;
        to: string;
        summary: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        await requireRead(params.from);
        const prefixedSummary = `[nodemw-mcp.move] ${params.summary}`;

        const result = await promisifyBotMethod<{
            from: string;
            to: string;
            reason: string;
        }>(
            bot,
            'move',
            params.from,
            params.to,
            prefixedSummary
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to move page', error as Error);
    }
}

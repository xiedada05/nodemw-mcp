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

export function deleteTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'delete',
        'PERMANENTLY delete a wiki page (requires authentication). ' +
        'HIGH RISK: This removes all page content and history from public view. ' +
        'While undelete may recover it on some wikis, deletion should never be taken lightly. ' +
        'Only delete when the user explicitly asks. Always verify the title is correct before proceeding.',
        {
            title: z.string().describe( 'Exact page title to permanently delete — double-check this is correct' ),
            reason: z.string().describe( 'Detailed reason for deletion (visible in deletion log)' ),
        },
        {
            title: 'Delete page',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleDeleteTool( params )
    );
    tool.update({ outputSchema: { title: z.string(), reason: z.string(), logid: z.number().optional() } });
    return tool;
}

async function handleDeleteTool(
    params: {
        title: string;
        reason: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        await requireRead(params.title);
        const prefixedReason = `[nodemw-mcp.delete] ${params.reason}`;

        const result = await promisifyBotMethod<{
            title: string;
            reason: string;
        }>(
            bot,
            'delete',
            params.title,
            prefixedReason
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to delete page', error as Error);
    }
}

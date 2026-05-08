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

export function prependTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'prepend',
        'Prepend content to the TOP of a wiki page without changing existing content (requires authentication). ' +
        'Useful for adding notices, templates, or cleanup tags that belong at the top of a page.',
        {
            title: z.string().describe( 'Page title to prepend to' ),
            content: z.string().describe( 'Content to prepend to the top of the page (e.g., "{{Cleanup}}\\n")' ),
            summary: z.string().describe( 'Edit summary' ),
        },
        {
            title: 'Prepend to page',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handlePrependTool( params )
    );
    tool.update({ outputSchema: {} });
    return tool;
}

async function handlePrependTool(
    params: {
        title: string;
        content: string;
        summary: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        await requireRead(params.title);
        const prefixedSummary = `[nodemw-mcp.prepend] ${params.summary}`;

        const result = await promisifyBotMethod<{
            title: string;
            pageid?: number;
            oldrevid?: number;
            newrevid?: number;
        }>(
            bot,
            'prepend',
            params.title,
            params.content,
            prefixedSummary
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to prepend to page', error as Error);
    }
}

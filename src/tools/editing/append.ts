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
import { conflictGuardParams, markAsWritten, requireRead } from '../../common/pageState.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function appendTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'append',
        'Append content to the END of a wiki page without changing existing content (requires authentication). ' +
        'LOW RISK: Additive only, easy to revert. Safe for adding categories, interwiki links, or bottom-of-page content. ' +
        'Read state is per session — after reconnecting you must get-article again. ' +
        'The save fails with an edit-conflict error if the page changed after you read it; re-read and retry in that case.',
        {
            title: z.string().describe( 'Page title' ),
            content: z.string().describe( 'Content to append to the end of the page (e.g., "\\n[[Category:MyCategory]]")' ),
            summary: z.string().describe( 'Edit summary' )
        },
        {
            title: 'Append to page',
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true
        } as ToolAnnotations,
        async ( params ) => handleAppendTool( params )
    );
    // Handler also reports pageid/newrevid — the schema must cover them or
    // strict MCP clients reject the structured content.
    tool.update({ outputSchema: { success: z.boolean(), title: z.string(), pageid: z.number().optional(), newrevid: z.number().optional() } });
    return tool;
}

async function handleAppendTool(
    params: {
        title: string;
        content: string;
        summary: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const pageid = await requireRead(params.title);
        const prefixedSummary = `[nodemw-mcp.append] ${params.summary}`;

        // doEdit (public nodemw API) keeps version-aware token fetching and
        // dry-run enforcement, and merges our params into action=edit —
        // bot.append() can't pass starttimestamp, so conflict protection needs it.
        const result = await promisifyBotMethod<{
            title: string;
            pageid?: number;
            oldrevid?: number;
            newrevid?: number;
            newtimestamp?: string;
        }>(
            bot,
            'doEdit',
            'append',
            params.title,
            prefixedSummary,
            {
                appendtext: params.content,
                notminor: '',
                ...conflictGuardParams(pageid),
            }
        );

        // Cache the write so subsequent operations skip the read guard
        if (result.pageid != null && result.newrevid != null) {
            markAsWritten(params.title, result.pageid, result.newrevid, result.newtimestamp);
        }

        return jsonResult({ success: true, title: params.title, pageid: result.pageid, newrevid: result.newrevid });
    } catch ( error ) {
        return errorResult('Failed to append to page', error as Error);
    }
}

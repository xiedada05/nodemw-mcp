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

export function editTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'edit',
        'Replace the ENTIRE content of a wiki page (requires authentication). ' +
        'CRITICAL: This is a FULL replacement — content you provide becomes the complete page, not an addition. ' +
        'There is NO undelete/undo tool — any damage you cause must be manually reverted by a human. ' +
        'To add a category or make a small change, you MUST first call get-article to retrieve the current content, ' +
        'modify it as needed, then pass the FULL modified content here. ' +
        'For appending or prepending without fetching the full page first, use the append/prepend tools instead.',
        {
            title: z.string().describe( 'Page title to edit' ),
            content: z.string().describe( 'COMPLETE new wikitext for the ENTIRE page — not a snippet, not a prefix, not an appendage. ' +
                'This replaces everything. Always fetch the current content with get-article first, then modify and resubmit the full text.' ),
            intent: z.enum(['add', 'revise', 'delete']).describe(
                'Your editing intent: "add" = adding content (page should grow), ' +
                '"revise" = modifying content (small net change, must keep ≥3/4 of existing bytes), ' +
                '"delete" = removing significant content (page should shrink significantly)' ),
            summary: z.string().describe( 'Edit summary describing what was changed and why' ),
            minor: z.boolean().optional().default( false ).describe( 'Mark as minor edit' )
        },
        {
            title: 'Edit page',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleEditTool( params )
    );
    tool.update({ outputSchema: { result: z.string(), pageid: z.number(), title: z.string(), contentmodel: z.string(), newrevid: z.number(), newtimestamp: z.string(), oldrevid: z.number().optional() } });
    return tool;
}

async function handleEditTool(
    params: {
        title: string;
        content: string;
        intent: 'add' | 'revise' | 'delete';
        summary: string;
        minor?: boolean;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        await requireRead(params.title);

        // Fetch current page content for size validation
        const currentContent = await promisifyBotMethod<string>(bot, 'getArticle', params.title, false);
        if (currentContent != null) {
            const currentBytes = Buffer.byteLength(currentContent, 'utf8');
            const proposedBytes = Buffer.byteLength(params.content, 'utf8');

            const delta = currentBytes - proposedBytes;
            if (delta > 200) {
                // Only enforce ratio checks when the absolute change is significant
                switch (params.intent) {
                    case 'add':
                        if (proposedBytes < currentBytes) {
                            return errorResult(
                                `Size mismatch: intent is "add" but proposed (${proposedBytes} B) < current (${currentBytes} B). ` +
                                `Add operations should not shrink the page. If you meant to remove content, use intent "delete".`
                            );
                        }
                        break;
                    case 'revise':
                        if (proposedBytes < currentBytes * 3 / 4) {
                            return errorResult(
                                `Size mismatch: intent is "revise" but proposed (${proposedBytes} B) < 3/4 of current (${currentBytes} B, threshold ${Math.floor(currentBytes * 3 / 4)} B). ` +
                                `Revise should keep most content intact. For larger removals, use intent "delete".`
                            );
                        }
                        break;
                    case 'delete':
                        if (proposedBytes < currentBytes * 1 / 10) {
                            return errorResult(
                                `Size mismatch: intent is "delete" but proposed (${proposedBytes} B) < 1/10 of current (${currentBytes} B, threshold ${Math.floor(currentBytes / 10)} B). ` +
                                `This looks like an accidental page wipe. If intentional, verify the content is correct and retry.`
                            );
                        }
                        break;
                }
            }
        }

        const prefixedSummary = `[nodemw-mcp.edit] ${params.summary}`;

        const result = await promisifyBotMethod<{
            title: string;
            pageid?: number;
            oldrevid?: number;
            newrevid?: number;
        }>(
            bot,
            'edit',
            params.title,
            params.content,
            prefixedSummary,
            params.minor || false
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to edit page', error as Error);
    }
}

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

export function addFlowTopicTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'add-flow-topic',
        'Add a new Flow/Structured Discussions topic to a wiki talk page (requires authentication). ' +
        'Creates a publicly visible discussion thread on the wiki. Ensure the content is appropriate and relevant.',
        {
            title: z.string().describe( 'Talk page title to add the topic to (e.g., "Talk:Main Page")' ),
            subject: z.string().describe( 'Topic title/heading — should summarize the discussion topic' ),
            content: z.string().describe( 'Topic body content in wikitext format' ),
        },
        {
            title: 'Add Flow topic',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleAddFlowTopicTool( params )
    );
    tool.update({ outputSchema: { 'new-topic': z.record(z.unknown()) } });
    return tool;
}

async function handleAddFlowTopicTool(
    params: {
        title: string;
        subject: string;
        content: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        const result = await promisifyBotMethod<{
            'new-topic': {
                status: string;
                workflow: string;
            };
        }>(
            bot,
            'addFlowTopic',
            params.title,
            params.subject,
            params.content
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to add Flow topic', error as Error);
    }
}

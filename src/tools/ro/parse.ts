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

export function parseTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'parse',
        'Parse wikitext to HTML',
        {
            text: z.string().describe('Wikitext to parse'),
            title: z.string().optional().describe('Context page title')
        },
        {
            title: 'Parse wikitext',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { text, title } ) => handleParseTool( text, title )
    );
}

async function handleParseTool(
    text: string,
    title?: string
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const callbackArgs = await promisifyBotMethod<[Error | null, string, string[]]>(
            bot,
            'parse',
            text,
            title || ''
        );

        const xml = callbackArgs[1] || '';
        const images = Array.isArray(callbackArgs[2]) ? callbackArgs[2] : [];

        const output = [
            'Parsed XML structure:',
            '',
            xml,
            '',
            `Images found: ${images.length > 0 ? images.join(', ') : 'none'}`
        ].join( '\n' );

        return {
            content: [ { type: 'text', text: output } ]
        };
    } catch ( error ) {
        return {
            content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
            isError: true
        };
    }
}

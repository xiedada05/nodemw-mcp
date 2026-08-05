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
import { getBot } from '../../common/nodemwBot.js';
import { callApi, errorResult } from '../../common/utils.js';

export function expandTemplatesTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'expand-templates',
        'Expand templates in wikitext and return the EXPANDED wikitext ' +
        '(not the parse tree). Use action=expandtemplates — for example ' +
        '{{#invoke:Navbox|...}} becomes the fully expanded wikitext.',
        {
            text: z.string().describe('Wikitext with templates to expand'),
            title: z.string().optional().describe('Context page title (for resolving {{PAGENAME}} and similar magic words)'),
        },
        {
            title: 'Expand templates',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { text, title } ) => handleExpandTemplatesTool( text, title )
    );
}

async function handleExpandTemplatesTool(
    text: string,
    title?: string
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        // Use low-level API: nodemw's expandTemplates() hardcodes generatexml=1
        // (removed in MW 1.36, and on older versions it returns the parse tree
        // instead of the expanded wikitext). action=expandtemplates without
        // generatexml returns the expanded wikitext on all versions.
        const apiParams: Record<string, unknown> = {
            action: 'expandtemplates',
            text,
            prop: 'wikitext',
        };

        if (title) {
            apiParams.title = title;
        }

        const raw = await callApi<{
            error?: { code: string; info: string };
            expandtemplates?: { wikitext?: string };
        }>(bot, apiParams, 'POST');

        if (raw.error) {
            throw new Error(raw.error.info || raw.error.code);
        }

        const expanded = raw.expandtemplates?.wikitext;
        if (expanded == null) {
            return errorResult('expandtemplates returned no wikitext.');
        }

        return {
            content: [ { type: 'text', text: expanded } ]
        };
    } catch ( error ) {
        return errorResult('Failed to expand templates', error as Error);
    }
}

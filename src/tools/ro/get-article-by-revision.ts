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
import { callApi, jsonResult, errorResult } from '../../common/utils.js';

export function getArticleByRevisionTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'get-article-by-revision',
        'Retrieve the content of a wiki article by a specific revision ID, without needing the page title or ID',
        {
            revision: z.number().describe( 'Revision ID to fetch' )
        },
        {
            title: 'Get article by revision',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { revision } ) => handleGetArticleByRevisionTool( revision )
    );
}

async function handleGetArticleByRevisionTool(
    revision: number
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        const result = await callApi(
            bot,
            {
                action: 'query',
                prop: 'revisions',
                rvprop: 'content',
                revids: revision
            },
            'GET'
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
const pages = (result.query as any)?.pages as Record<string, Record<string, any>> | undefined;
        if (!pages) {
            return errorResult(`Revision ${revision} not found.`);
        }

        // revids response pages are keyed by page ID; get the first (and only) page
        const pageIds = Object.keys(pages);
        if (pageIds.length === 0) {
            return errorResult(`Revision ${revision} not found.`);
        }

        const page = pages[pageIds[0]];
        if (!page || page.missing !== undefined) {
            return errorResult(`Revision ${revision} not found.`);
        }

        const revisions = page.revisions as Array<{ '*': string }> | undefined;
        const rev = revisions?.[0];
        if (!rev || rev['*'] == null) {
            return errorResult(`Revision ${revision} not found or has no content.`);
        }

        return {
            content: [{ type: 'text', text: rev['*'] }]
        };
    } catch ( error ) {
        return {
            content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
            isError: true
        };
    }
}

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

// Maximum results per API request for list=search.
// Bot users get 500, regular users get 50.
const API_LIMIT = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SearchResult extends Record<string, any> {
    title: string;
    snippet?: string;
    timestamp?: string;
    pageid: number;
    ns: number;
}

export function searchTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'search',
        'Search for wiki pages by keyword. By default searches all namespaces.',
        {
            keyword: z.string().describe( 'Search keyword' ),
            limit: z.number().optional().default( 10 ).describe( 'Maximum number of results' ),
            namespace: z.union([
                z.number(),
                z.array(z.number())
            ]).optional().describe(
                'Namespace number(s) to filter by (e.g. 0 for main, 10 for Template, 2 for User, 14 for Category). ' +
                'Omit to search all namespaces. ' +
                'Note: search matches page titles within the specified namespace(s) — ' +
                'you do NOT need to include the namespace prefix in the keyword. ' +
                'For example, keyword="Cite" + namespace=10 finds "Template:Cite web", ' +
                'not keyword="Template:Cite".'
            )
        },
        {
            title: 'Search',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { keyword, limit, namespace } ) => handleSearchTool( keyword, limit, namespace )
    );
    tool.update({ outputSchema: {
        total: z.number(),
        limit: z.number(),
        keyword: z.string(),
        namespace: z.union([z.number(), z.array(z.number())]).optional(),
        results: z.array(z.record(z.unknown()))
    }});
    return tool;
}

async function handleSearchTool(
    keyword: string,
    limit: number,
    namespace?: number | number[]
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        // Use low-level API: nodemw's bot.search() does not support srnamespace,
        // which defaults to 0 (main namespace only). We bypass it to support
        // namespace filtering and proper continuation-based pagination.
        const baseParams: Record<string, unknown> = {
            action: 'query',
            list: 'search',
            srsearch: keyword,
            srprop: 'timestamp',
            srlimit: API_LIMIT,
        };

        if (namespace !== undefined) {
            const ns = Array.isArray(namespace) ? namespace.join('|') : String(namespace);
            baseParams.srnamespace = ns;
        }

        const allResults: SearchResult[] = [];
        let continueParams: Record<string, unknown> | undefined;

        do {
            const params = { ...baseParams, ...(continueParams || {}) };

            const raw = await callApi<{
                error?: { code: string; info: string };
                query?: { search?: SearchResult[] };
                continue?: Record<string, unknown>;
            }>(bot, params, 'GET');

            if (raw.error) {
                throw new Error(raw.error.info || raw.error.code);
            }
            const query = raw.query;
            if (query?.search) {
                allResults.push(...query.search);
            }

            if (raw.continue) {
                continueParams = raw.continue as Record<string, unknown>;
            } else {
                continueParams = undefined;
            }
        } while (continueParams && allResults.length < 10000);

        const limitedResults = allResults.slice(0, limit);

        return jsonResult({
            total: allResults.length,
            limit,
            keyword,
            namespace,
            results: limitedResults
        });
    } catch ( error ) {
        return errorResult('Failed to search', error as Error);
    }
}

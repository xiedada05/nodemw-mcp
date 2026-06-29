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
import { jsonResult, errorResult } from '../../common/utils.js';

const API_LIMIT = 5000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PageByPrefix extends Record<string, any> {
    title: string;
    pageid: number;
    ns: number;
}

export function getPagesByPrefixTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-pages-by-prefix',
        'Get pages whose titles start with a specific prefix. By default searches the main namespace (0).',
        {
            prefix: z.string().describe('Prefix to match page titles (e.g. "Module:QR" for Scribunto modules)'),
            namespace: z.union([
                z.number(),
                z.array(z.number())
            ]).optional().describe(
                'Namespace number(s) to filter by (e.g. 828 for Module, 10 for Template). ' +
                'If omitted, defaults to the main namespace (0). ' +
                'Set to a specific namespace when searching for non-mainspace pages.'
            )
        },
        {
            title: 'Get pages by prefix',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { prefix, namespace } ) => handleGetPagesByPrefixTool( prefix, namespace )
    );
    tool.update({ outputSchema: {
        prefix: z.string(),
        namespace: z.union([z.number(), z.array(z.number())]).optional(),
        pages: z.array(z.record(z.unknown())),
        count: z.number()
    }});
    return tool;
}

async function handleGetPagesByPrefixTool(
    prefix: string,
    namespace?: number | number[]
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        // Use low-level API: nodemw's bot.getPagesByPrefix() does not support
        // apnamespace (defaults to 0 = main namespace) and uses api.call
        // without continuation, truncating results at API_LIMIT.
        const baseParams: Record<string, unknown> = {
            action: 'query',
            list: 'allpages',
            apprefix: prefix,
            aplimit: API_LIMIT,
        };

        if (namespace !== undefined) {
            const ns = Array.isArray(namespace) ? namespace.join('|') : String(namespace);
            baseParams.apnamespace = ns;
        }

        const allResults: PageByPrefix[] = [];
        let continueParams: Record<string, unknown> | undefined;

        do {
            const params = { ...baseParams, ...(continueParams || {}) };

            const raw = await new Promise<Record<string, unknown>>((resolve, reject) => {
                (bot as any).api.call(
                    params,
                    (err: Error | null, data: Record<string, unknown>) => {
                        if (err) reject(err);
                        else resolve(data);
                    },
                    'GET'
                );
            });

            const query = raw.query as { allpages?: PageByPrefix[] } | undefined;
            if (query?.allpages) {
                allResults.push(...query.allpages);
            }

            if (raw.continue) {
                continueParams = raw.continue as Record<string, unknown>;
            } else {
                continueParams = undefined;
            }
        } while (continueParams && allResults.length < 10000);

        return jsonResult({
            prefix,
            namespace,
            pages: allResults,
            count: allResults.length
        });
    } catch ( error ) {
        return errorResult('Failed to get pages by prefix', error as Error);
    }
}

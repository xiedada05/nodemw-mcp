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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RecentChange extends Record<string, any> {
    title: string;
    timestamp: string;
    user: string;
    comment: string;
}

export function getRecentChangesTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-recent-changes',
        'Get recent changes on the wiki. ' +
        'Pagination: the response includes total (matching changes found) and displayed (returned in this batch). ' +
        'If displayed < total, more results exist — use the timestamp of the LAST returned change as the start parameter for the next page.' +
        {
            start: z.string().optional().describe(
                'Timestamp to start listing from — only return changes before this time. ' +
                'Accepts ISO 8601 (e.g. "2026-05-10T22:54:37Z"), MediaWiki format "YYYYMMDDHHMMSS", or unix timestamp. ' +
                'All times are UTC — MW ignores timezone offsets. ' +
                'To paginate: pass the timestamp of the LAST item from the previous page as start.'),
            limit: z.number().optional().default(50).describe('Maximum number of changes to return')
        },
        {
            title: 'Get recent changes',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { start, limit } ) => handleGetRecentChangesTool( start, limit )
    );
    tool.update({ outputSchema: { total: z.number(), limit: z.number(), start: z.string().optional(), changes: z.array(z.record(z.unknown())) } });
    return tool;
}

async function handleGetRecentChangesTool(
    start?: string,
    limit: number = 50
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        // Handle getRecentChanges's callback signature manually
        const changes = await new Promise<RecentChange[]>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bot as any).getRecentChanges(start, (err: Error | null, ...args: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    const chgs = args[0];
                    resolve(Array.isArray(chgs) ? chgs : []);
                }
            });
        });

        // Limit results
        const limitedChanges = changes.slice(0, limit);

        return jsonResult({
            total: changes.length,
            limit,
            start,
            changes: limitedChanges
        });
    } catch ( error ) {
        return errorResult('Failed to get recent changes', error as Error);
    }
}

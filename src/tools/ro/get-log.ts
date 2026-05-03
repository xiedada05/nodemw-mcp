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
interface LogEntry extends Record<string, any> {
    title: string;
    timestamp: string;
    user: string;
    action: string;
    comment: string;
}

export function getLogTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-log',
        'Get log entries of a specific type',
        {
            type: z.string().describe('Log type (e.g. delete, block, move)'),
            start: z.string().optional().default('').describe('Start timestamp (YYYYMMDDHHMMSS format)'),
            limit: z.number().optional().default(50).describe('Maximum number of entries to return')
        },
        {
            title: 'Get log entries',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { type, start, limit } ) => handleGetLogTool( type, start, limit )
    );
    tool.update({ outputSchema: { type: z.string(), start: z.string(), limit: z.number(), total: z.number(), displayed: z.number(), entries: z.array(z.record(z.unknown())) } });
    return tool;
}

async function handleGetLogTool(
    type: string,
    start: string,
    limit: number
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        // Handle getLog's callback signature manually
        const entries = await new Promise<LogEntry[]>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bot as any).getLog(type, start, (err: Error | null, ...args: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    const ents = args[0];
                    resolve(Array.isArray(ents) ? ents : []);
                }
            });
        });

        // Limit results
        const limitedEntries = entries.slice(0, limit);

        return jsonResult({
            type,
            start,
            limit,
            total: entries.length,
            displayed: limitedEntries.length,
            entries: limitedEntries
        });
    } catch ( error ) {
        return errorResult('Failed to get log entries', error as Error);
    }
}

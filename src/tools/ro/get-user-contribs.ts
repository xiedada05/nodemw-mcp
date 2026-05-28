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
interface UserContrib extends Record<string, any> {
    title: string;
    revid: number;
    timestamp: string;
    comment: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ApiResponse extends Record<string, any> {
    query?: {
        usercontribs?: UserContrib[];
    };
    continue?: Record<string, unknown>;
    'query-continue'?: Record<string, Record<string, unknown>>;
}

export function getUserContribsTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-user-contribs',
        'Get contributions made by a specific user. ' +
        'Pagination: the response includes total (matching edits found) and displayed (returned in this batch). ' +
        'If displayed < total, more results exist — use the timestamp of the LAST returned contribution as the start parameter for the next page. ' +
        'Repeat until displayed < limit to get all results.',
        {
            username: z.string().optional().describe('Username to get contributions for (required if "id" is not provided)'),
            id: z.number().optional().describe('User ID to get contributions for (required if "username" is not provided)'),
            namespace: z.number().optional().describe('Filter contributions by namespace'),
            limit: z.number().optional().default(50).describe('Maximum number of contributions to return'),
            start: z.string().optional().describe(
                'Timestamp to start listing from — only return edits before this time (not inclusive). ' +
                'Accepts ISO 8601 (e.g. "2026-05-10T22:54:37Z"), MediaWiki format "YYYYMMDDHHMMSS", or unix timestamp. ' +
                'All times are UTC — MW ignores timezone offsets. ' +
                'To paginate: pass the timestamp of the LAST item from the previous page as start. ' +
                'The returned contributions are guaranteed to be strictly older than this timestamp.')
        },
        {
            title: 'Get user contributions',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { username, id, namespace, limit, start } ) => handleGetUserContribsTool( username, id, namespace, limit, start )
    );
    tool.update({ outputSchema: { username: z.string().optional(), id: z.number().optional(), namespace: z.number().optional(), limit: z.number(), start: z.string().optional(), total: z.number(), displayed: z.number(), contributions: z.array(z.record(z.unknown())) } });
    return tool;
}

async function handleGetUserContribsTool(
    username?: string,
    id?: number,
    namespace?: number,
    limit: number = 50,
    start?: string
): Promise<CallToolResult> {
    try {
        if (!username && id == null) {
            return errorResult('Either "username" or "id" must be provided');
        }
        if (username && id != null) {
            return errorResult('Provide either "username" or "id", not both');
        }

        const bot = await getBot();

        // Verify user exists (only for username path; for id path, MW returns empty results if stale)
        if (username) {
            const userInfo = await promisifyBotMethod<{ missing?: string }>(
                bot,
                'whois',
                username
            );
            if (userInfo.missing !== undefined) {
                return errorResult(`User "${username}" not found.`);
            }
        }

        const allContribs: UserContrib[] = [];

        const perPage = Math.min(limit, 500);

        const userParam = id !== undefined
            ? { ucuserids: id }
            : { ucuser: username };

        const baseParams: Record<string, unknown> = {
            action: 'query',
            list: 'usercontribs',
            ...userParam,
            uclimit: perPage,
            ucprop: 'ids|title|timestamp|comment|size|flags',
            ...(namespace !== undefined && { ucnamespace: namespace }),
            ...(start && { ucstart: start })
        };

        let continueParams: Record<string, unknown> | undefined;

        do {
            const params = { ...baseParams, ...(continueParams || {}) };
            const rawData = await new Promise<ApiResponse>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (bot as any).api.call(params, (_err: Error | null, _info: unknown, _next: unknown, raw: ApiResponse) => {
                    if (_err) reject(_err);
                    else resolve(raw);
                });
            });

            const usercontribs = rawData.query?.usercontribs;
            if (usercontribs) {
                allContribs.push(...usercontribs);
            }

            if (allContribs.length >= limit) {
                break;
            }

            if (rawData.continue) {
                continueParams = rawData.continue as Record<string, unknown>;
            } else if (rawData['query-continue']) {
                const qc = rawData['query-continue'] as Record<string, Record<string, unknown>>;
                continueParams = qc.usercontribs || qc[Object.keys(qc)[0]];
            } else {
                continueParams = undefined;
            }
        } while (continueParams);

        const limitedContribs = allContribs.slice(0, limit);

        return jsonResult({
            username,
            id,
            namespace,
            limit,
            start,
            total: allContribs.length,
            displayed: limitedContribs.length,
            contributions: limitedContribs
        });
    } catch ( error ) {
        return errorResult('Failed to get user contributions', error as Error);
    }
}

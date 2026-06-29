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
import { getBot, getMediaWikiVersion } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function undeleteTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'undelete',
        'Restore a previously deleted wiki page (requires authentication). ' +
        'HIGH RISK: Deleted pages may contain content hidden for legal, privacy, or safety reasons. ' +
        'Only undelete when the human operator explicitly commands it. ' +
        'Optionally specify which revisions to restore via timestamps array.',
        {
            title: z.string().describe( 'Page title to restore' ),
            reason: z.string().describe( 'Reason for undeleting (visible in deletion log)' ),
            timestamps: z.array( z.string() ).optional().describe(
                'Specific revision timestamps to restore. Omit to restore all deleted revisions.' )
        },
        {
            title: 'Undelete page',
            readOnlyHint: false,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title, reason, timestamps } ) => handleUndeleteTool( title, reason, timestamps )
    );
    tool.update({ outputSchema: { result: z.string(), title: z.string(), restored: z.number().optional() } });
    return tool;
}

async function handleUndeleteTool(
    title: string,
    reason: string,
    timestamps?: string[]
): Promise<CallToolResult> {
    try {
        const bot = getBot();

        const mwVersion = getMediaWikiVersion();
        const tokenType = (mwVersion !== null && mwVersion >= 1.24) ? 'csrf' : 'undelete';

        const token = await new Promise<string>((resolve, reject) => {
            (bot as any).getToken(title, tokenType, (err: Error | null, t: string) => {
                if (err) reject(err);
                else resolve(t);
            });
        });

        const prefixedReason = `[nodemw-mcp.undelete] ${reason}`;

        const params: Record<string, string | number | boolean> = {
            action: 'undelete',
            title,
            reason: prefixedReason,
            token
        };
        if (timestamps && timestamps.length > 0) {
            params.timestamps = timestamps.join('|');
        }

        const data = await new Promise<Record<string, any>>((resolve, reject) => {
            (bot as any).api.call(params, (err: Error | null, result: Record<string, any>) => {
                if (err) reject(err);
                else resolve(result);
            }, 'POST');
        });

        if (data.error) {
            return errorResult(`Undelete failed: ${data.error.info || data.error.code}`, new Error(JSON.stringify(data.error)));
        }

        return jsonResult({
            result: 'Success',
            title: data.undelete?.title || title,
            restored: data.undelete?.revisions
        });
    } catch ( error ) {
        return errorResult('Failed to undelete page', error as Error);
    }
}

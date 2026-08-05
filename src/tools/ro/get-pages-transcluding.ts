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

const API_LIMIT = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TranscludingPage extends Record<string, any> {
    title: string;
    pageid: number;
    ns: number;
}

export function getPagesTranscludingTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-pages-transcluding',
        'Get all pages that transclude (include) a specific template. ' +
        'Accepts a title with or without the "Template:" prefix — ' +
        'the prefix is added automatically when the input has no namespace.',
        {
            template: z.string().describe('Template title to find transclusions (with or without "Template:" prefix)')
        },
        {
            title: 'Get pages transcluding template',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { template } ) => handleGetPagesTranscludingTool( template )
    );
    tool.update({ outputSchema: { template: z.string(), pages: z.array(z.record(z.unknown())), count: z.number() } });
    return tool;
}

async function handleGetPagesTranscludingTool(
    template: string
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        // Use low-level API: nodemw's getPagesTranscluding relies on a
        // getAll() iterator that fails to terminate/fetch on older MediaWiki
        // versions (returns empty). list=embeddedin is the canonical way to
        // enumerate transclusions and works on all versions.
        // Without an explicit namespace prefix, old MediaWiki treats the title
        // as main-namespace — so default to the Template namespace.
        const effectiveTitle = template.includes( ':' ) ? template : `Template:${template}`;

        const baseParams: Record<string, unknown> = {
            action: 'query',
            list: 'embeddedin',
            eititle: effectiveTitle,
            eilimit: API_LIMIT
        };

        const allPages: TranscludingPage[] = [];
        let continueParams: Record<string, unknown> | undefined;

        do {
            const params = { ...baseParams, ...(continueParams || {}) };
            const raw = await callApi<{
                error?: { code: string; info: string };
                query?: { embeddedin?: TranscludingPage[] };
                continue?: Record<string, unknown>;
            }>(bot, params, 'GET');

            if (raw.error) {
                throw new Error(raw.error.info || raw.error.code);
            }
            if (raw.query?.embeddedin) {
                allPages.push(...raw.query.embeddedin);
            }

            if (raw.continue) {
                continueParams = raw.continue as Record<string, unknown>;
            } else {
                continueParams = undefined;
            }
        } while (continueParams && allPages.length < 10000);

        return jsonResult({
            template,
            pages: allPages,
            count: allPages.length
        });
    } catch ( error ) {
        return errorResult('Failed to get pages transcluding template', error as Error);
    }
}

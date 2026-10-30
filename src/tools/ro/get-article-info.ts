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

export function getArticleInfoTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-article-info',
        'Get detailed information about one or more articles. ' +
        'With templates=true, also lists every template transcluded on the page(s) — ' +
        'use it to trace the template chain before editing complex pages (e.g. a homepage that is just {{首页}}).',
        {
            title: z.union([
                z.string(),
                z.array(z.string())
            ]).optional().describe('Article title or array of titles (required if "id" is not provided)'),
            id: z.union([
                z.number(),
                z.array(z.number())
            ]).optional().describe('Page ID or array of page IDs (required if "title" is not provided)'),
            properties: z.array(z.string()).optional().describe('Extra info properties to retrieve (inprop), e.g. protection, talkid, url. Default: protection|talkid|url'),
            templates: z.boolean().optional().default(false).describe('Also return the list of templates transcluded on the page(s)')
        },
        {
            title: 'Get article info',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        } as ToolAnnotations,
        async ( { title, id, properties, templates } ) => handleGetArticleInfoTool( title, id, properties, templates )
    );
    tool.update({ outputSchema: { identifier: z.union([z.string(), z.number(), z.array(z.unknown())]), results: z.array(z.record(z.unknown())), count: z.number() } });
    return tool;
}

async function handleGetArticleInfoTool(
    title: string | string[] | undefined,
    id: number | number[] | undefined,
    properties?: string[],
    templates: boolean = false
): Promise<CallToolResult> {
    try {
        const hasTitle = typeof title === 'string' ? title.length > 0 : Array.isArray(title) ? title.length > 0 : false;
        const hasId = typeof id === 'number' ? id > 0 : Array.isArray(id) ? id.length > 0 : false;

        if (!hasTitle && !hasId) {
            return errorResult('Either "title" or "id" must be provided');
        }
        if (hasTitle && hasId) {
            return errorResult('Provide either "title" or "id", not both');
        }

        const bot = await getBot();

        // Low-level API for every shape: one request path, one response
        // shaping. nodemw's getArticleInfo can't take page IDs, iterates
        // arrays with for..in (yielding indices), and doesn't support
        // prop=templates.
        const prop = templates ? 'info|templates' : 'info';
        const inprop = properties?.join('|') || 'protection|talkid|url';
        const apiParams: Record<string, unknown> = hasId
            ? { action: 'query', prop, pageids: (Array.isArray(id) ? id : [id]).join('|'), inprop }
            : { action: 'query', prop, titles: Array.isArray(title) ? title.join('|') : title, inprop };

        const raw = await callApi<{
            error?: { code: string; info: string };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query?: { pages?: Record<string, Record<string, any>> };
        }>(bot, apiParams, 'GET');
        if (raw.error) {
            throw new Error(raw.error.info || raw.error.code);
        }

        const pages = raw.query?.pages;
        const rawResults = pages ? Object.values(pages).filter(p => p.missing === undefined) : [];
        const results = templates
            ? rawResults.map((page) => ({
                ...page,
                templates: Array.isArray(page.templates)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? (page.templates as any[]).map(t => t.title)
                    : []
            }))
            : rawResults;

        return jsonResult({
            identifier: hasId ? id : title,
            results,
            count: results.length
        });
    } catch ( error ) {
        return errorResult('Failed to get article info', error as Error);
    }
}

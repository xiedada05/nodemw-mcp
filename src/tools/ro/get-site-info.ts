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
import { compactSiteInfo } from '../../common/siteInfo.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function getSiteInfoTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-site-info',
        'Get site information from MediaWiki (meta=siteinfo). ' +
        'Request only the sections you need, e.g. ["general"], ["extensions"], ["namespaces"] — ' +
        'each section adds thousands of tokens to the response. ' +
        'By default the extensions list is compacted to name/type/version; pass full=true for complete extension metadata.',
        {
            properties: z.array(z.string()).describe('List of site information properties to retrieve'),
            full: z.boolean().optional().default(false).describe('Return extensions with ALL metadata (description, author, url, …). Default: compact {name, type, version} entries.')
        },
        {
            title: 'Get site info',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        } as ToolAnnotations,
        async ( { properties, full } ) => handleGetSiteInfoTool( properties, full )
    );
    tool.update({ outputSchema: { siteinfo: z.record(z.unknown()) } });
    return tool;
}

async function handleGetSiteInfoTool(
    properties: string[],
    full: boolean
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const info = await promisifyBotMethod<Record<string, unknown>>(
            bot,
            'getSiteInfo',
            properties
        );

        return jsonResult({ siteinfo: compactSiteInfo(info || {}, full) });
    } catch ( error ) {
        return errorResult('Failed to get site info', error as Error);
    }
}

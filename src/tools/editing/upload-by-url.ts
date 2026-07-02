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

export function uploadByUrlTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'upload-by-url',
        'Upload a file to the wiki by downloading it from a URL (requires authentication). ' +
        'MEDIUM RISK: Source URLs may be untrusted. Existing files WILL BE OVERWRITTEN silently. ' +
        'You must have rights to the content. Only use when explicitly requested.',
        {
            filename: z.string().describe( 'Destination filename on wiki (e.g., "Diagram.png") — existing file will be overwritten!' ),
            url: z.string().url().describe( 'Source URL to download the file from — must be publicly accessible' ),
            summary: z.string().optional().describe( 'Upload summary' ),
            initial_description: z.string().optional().describe(
                'OPTIONAL (not required for upload). Initial wikitext for the file description page (File:xxx). ' +
                'Only used when the file page does NOT already exist — if the page already exists, this is silently ignored. ' +
                'Without it, the upload may fail on some wikis when creating a new file page. ' +
                'Do NOT treat this as required — only provide it when you have meaningful description content (e.g., ' +
                '{{File info}}, license tags, categories).'
            ),
        },
        {
            title: 'Upload file by URL',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleUploadByUrlTool( params )
    );
    tool.update({ outputSchema: { result: z.string(), filename: z.string(), imageinfo: z.record(z.unknown()).optional() } });
    return tool;
}

async function handleUploadByUrlTool(
    params: {
        filename: string;
        url: string;
        summary?: string;
        initial_description?: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const prefixedSummary = params.summary ? `[nodemw-mcp.upload-by-url] ${params.summary}` : '[nodemw-mcp.upload-by-url] File upload from URL';

        const extraParams: Record<string, string> = { comment: prefixedSummary };
        if (params.initial_description !== undefined) {
            extraParams.text = params.initial_description;
        }

        const result = await promisifyBotMethod<{
            result: string;
            filename: string;
            imageinfo?: any;
        }>(
            bot,
            'uploadByUrl',
            params.filename,
            params.url,
            extraParams
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to upload file by URL', error as Error);
    }
}

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

export function uploadTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'upload',
        'Upload a file to the wiki (requires authentication). ' +
        'MEDIUM RISK: Existing files with the same name WILL BE OVERWRITTEN silently. ' +
        'You must have rights to the content. Only use when explicitly requested.',
        {
            filename: z.string().describe( 'Destination filename on wiki (e.g., "MyImage.png") — existing file will be overwritten!' ),
            content: z.string().describe( 'File content encoded as base64 string' ),
            comment: z.string().optional().describe( 'Upload comment describing the file' ),
        },
        {
            title: 'Upload file',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleUploadTool( params )
    );
    tool.update({ outputSchema: { result: z.string(), filename: z.string(), imageinfo: z.record(z.unknown()).optional() } });
    return tool;
}

async function handleUploadTool(
    params: {
        filename: string;
        content: string;
        comment?: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const fileContent = Buffer.from(params.content, 'base64');
        const comment = params.comment ? `[nodemw-mcp.upload] ${params.comment}` : '[nodemw-mcp.upload] File upload';

        const result = await promisifyBotMethod<{
            result: string;
            filename: string;
            imageinfo?: any;
        }>(
            bot,
            'upload',
            params.filename,
            fileContent,
            comment
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to upload file', error as Error);
    }
}

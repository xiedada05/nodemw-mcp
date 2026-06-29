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
interface ImageInfo extends Record<string, any> {
    timestamp: string;
    user: string;
    width: number;
    height: number;
    size: number;
    url: string;
    descriptionurl: string;
    exif?: Record<string, string>;
}

export function getImageInfoTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-image-info',
        'Get detailed information about an image file',
        {
            filename: z.string().describe('Image filename with File: prefix')
        },
        {
            title: 'Get image info',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { filename } ) => handleGetImageInfoTool( filename )
    );
    tool.update({ outputSchema: { filename: z.string(), info: z.record(z.unknown()) } });
    return tool;
}

async function handleGetImageInfoTool(
    filename: string
): Promise<CallToolResult> {
    try {
        const bot = await getBot();
        const info = await promisifyBotMethod<ImageInfo | undefined>(
            bot,
            'getImageInfo',
            filename
        );

        if (!info) {
            return errorResult(`Image "${filename}" not found.`);
        }

        return jsonResult({
            filename,
            info
        });
    } catch ( error ) {
        return errorResult('Failed to get image info', error as Error);
    }
}

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
interface Image extends Record<string, any> {
	name: string;
	img_timestamp: string;
	user: string;
}

export function getImagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-images',
		'Get list of images starting from a specific name',
		{
			startFrom: z.string().optional().default('').describe('Start from this image name'),
			limit: z.number().optional().default(50).describe('Maximum number of images to return')
		},
		{
			title: 'Get images',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { startFrom, limit } ) => handleGetImagesTool( startFrom, limit )
	);
}

async function handleGetImagesTool(
	startFrom: string,
	limit: number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		// getImages has a different callback signature - let's handle it manually
		const images = await new Promise<Image[]>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(bot as any).getImages(startFrom, (err: Error | null, ...args: any[]) => {
				if (err) {
					reject(err);
				} else {
					const imgs = args[0];
					resolve(Array.isArray(imgs) ? imgs : []);
				}
			});
		});

		// Limit results
		const limitedImages = images.slice(0, limit);

		return jsonResult({
			total: images.length,
			limit,
			startFrom,
			images: limitedImages
		});
	} catch ( error ) {
		return errorResult('Failed to get images', error as Error);
	}
}

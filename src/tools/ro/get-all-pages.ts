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
interface AllPage extends Record<string, any> {
	title: string;
	pageid: number;
	ns: number;
}

export function getAllPagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-all-pages',
		'Get all non-redirect pages from the wiki',
		{
			limit: z.number().optional().default(500).describe('Maximum number of pages to return')
		},
		{
			title: 'Get all pages',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { limit } ) => handleGetAllPagesTool( limit )
	);
}

async function handleGetAllPagesTool(
	limit: number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const allResults = await promisifyBotMethod<AllPage[]>(
			bot,
			'getAllPages'
		);

		// Limit results
		const results = allResults.slice(0, limit);

		return jsonResult({
			total: allResults.length,
			displayed: results.length,
			pages: results,
			limit
		});
	} catch ( error ) {
		return errorResult('Failed to get all pages', error as Error);
	}
}

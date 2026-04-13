import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function getCategoriesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-categories',
		'Get all categories matching a prefix',
		{
			prefix: z.string().optional().default('').describe('Prefix to filter categories')
		},
		{
			title: 'Get categories',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { prefix } ) => handleGetCategoriesTool( prefix )
	);
}

async function handleGetCategoriesTool(
	prefix: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const results = await promisifyBotMethod<string[]>(
			bot,
			'getCategories',
			prefix
		);

		return jsonResult({
			prefix,
			categories: results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get categories', error as Error);
	}
}

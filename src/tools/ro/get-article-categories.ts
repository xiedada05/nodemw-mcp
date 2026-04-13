import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function getArticleCategoriesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-article-categories',
		'Get all categories that an article belongs to',
		{
			title: z.union([z.string(), z.number()]).describe('Article title or page ID')
		},
		{
			title: 'Get article categories',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title } ) => handleGetArticleCategoriesTool( title )
	);
}

async function handleGetArticleCategoriesTool(
	title: string | number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const categories = await promisifyBotMethod<string[]>(
			bot,
			'getArticleCategories',
			title
		);

		return jsonResult({
			title,
			categories,
			count: categories.length
		});
	} catch ( error ) {
		return errorResult('Failed to get article categories', error as Error);
	}
}

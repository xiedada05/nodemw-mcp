import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PageInCategory extends Record<string, any> {
	title: string;
	pageid?: number;
	ns?: number;
}

export function getPagesInCategoryTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-pages-in-category',
		'Get all pages in a category',
		{
			category: z.string().describe( 'Category name (with or without Category: prefix)' )
		},
		{
			title: 'Get pages in category',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { category } ) => handleGetPagesInCategoryTool( category )
	);
}

async function handleGetPagesInCategoryTool(
	category: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		// Remove "Category:" prefix if present
		const cleanCategory = category.replace( /^Category:/i, '' );

		const results = await promisifyBotMethod<PageInCategory[]>(
			bot,
			'getPagesInCategory',
			cleanCategory
		);

		return jsonResult({
			category: cleanCategory,
			pages: results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get pages in category', error as Error);
	}
}

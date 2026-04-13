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

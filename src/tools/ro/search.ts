import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SearchResult extends Record<string, any> {
	title: string;
	snippet?: string;
	url?: string;
	pageId?: number;
}

export function searchTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'search',
		'Search for wiki pages by keyword',
		{
			keyword: z.string().describe( 'Search keyword' ),
			limit: z.number().optional().default( 10 ).describe( 'Maximum number of results' )
		},
		{
			title: 'Search',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { keyword, limit } ) => handleSearchTool( keyword, limit )
	);
}

async function handleSearchTool(
	keyword: string,
	limit: number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		// nodemw search returns array of results directly
		const results = await promisifyBotMethod<SearchResult[]>(
			bot,
			'search',
			keyword
		);

		// Limit results
		const limitedResults = results.slice( 0, limit );

		return jsonResult({
			total: results.length,
			limit,
			keyword,
			results: limitedResults
		});
	} catch ( error ) {
		return errorResult('Failed to search', error as Error);
	}
}

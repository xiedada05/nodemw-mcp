import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface QueryPageResult extends Record<string, any> {
	title: string;
	value: number;
}

export function getQueryPageTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-query-page',
		'Get results from a query page (special page)',
		{
			name: z.string().describe('Name of the query page')
		},
		{
			title: 'Get query page results',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { name } ) => handleGetQueryPageTool( name )
	);
}

async function handleGetQueryPageTool(
	name: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const results = await promisifyBotMethod<QueryPageResult[]>(
			bot,
			'getQueryPage',
			name
		);

		return jsonResult({
			name,
			results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get query page results', error as Error);
	}
}

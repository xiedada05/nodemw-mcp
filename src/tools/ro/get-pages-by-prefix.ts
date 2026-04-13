import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PageByPrefix extends Record<string, any> {
	title: string;
	pageid: number;
	ns: number;
}

export function getPagesByPrefixTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-pages-by-prefix',
		'Get pages starting with a specific prefix',
		{
			prefix: z.string().describe('Prefix to match page titles')
		},
		{
			title: 'Get pages by prefix',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { prefix } ) => handleGetPagesByPrefixTool( prefix )
	);
}

async function handleGetPagesByPrefixTool(
	prefix: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const results = await promisifyBotMethod<PageByPrefix[]>(
			bot,
			'getPagesByPrefix',
			prefix
		);

		return jsonResult({
			prefix,
			pages: results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get pages by prefix', error as Error);
	}
}

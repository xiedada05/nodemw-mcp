import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PageProperties extends Record<string, any> {
	[key: string]: string | undefined;
}

export function getArticlePropertiesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-article-properties',
		'Get page properties for a wiki article',
		{
			title: z.string().describe('Article title')
		},
		{
			title: 'Get article properties',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title } ) => handleGetArticlePropertiesTool( title )
	);
}

async function handleGetArticlePropertiesTool(
	title: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const properties = await promisifyBotMethod<PageProperties>(
			bot,
			'getArticleProperties',
			title
		);

		return jsonResult({
			title,
			properties
		});
	} catch ( error ) {
		return errorResult('Failed to get article properties', error as Error);
	}
}

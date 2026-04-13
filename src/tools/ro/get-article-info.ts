import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ArticleInfo extends Record<string, any> {
	title: string;
	pageid: number;
	ns: number;
}

export function getArticleInfoTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-article-info',
		'Get detailed information about one or more articles',
		{
			title: z.union([
				z.string(),
				z.number(),
				z.array(z.union([z.string(), z.number()]))
			]).describe('Article title, page ID, or array of titles/IDs'),
			properties: z.array(z.string()).optional().describe('Specific properties to retrieve')
		},
		{
			title: 'Get article info',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title, properties } ) => handleGetArticleInfoTool( title, properties )
	);
}

async function handleGetArticleInfoTool(
	title: string | number | (string | number)[],
	properties?: string[]
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const options = properties ? { inprop: properties } : {};
		const info = await promisifyBotMethod<ArticleInfo>(
			bot,
			'getArticleInfo',
			title,
			options
		);

		// Handle array of results vs single result
		const results = Array.isArray(info) ? info : [info];

		return jsonResult({
			title,
			results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get article info', error as Error);
	}
}

import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TranscludingPage extends Record<string, any> {
	title: string;
	pageid: number;
	ns: number;
}

export function getPagesTranscludingTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-pages-transcluding',
		'Get all pages that transclude (include) a specific template',
		{
			template: z.string().describe('Template title to find transclusions')
		},
		{
			title: 'Get pages transcluding template',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { template } ) => handleGetPagesTranscludingTool( template )
	);
}

async function handleGetPagesTranscludingTool(
	template: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const callbackArgs = await promisifyBotMethod<[Error | null, TranscludingPage[] | [undefined]]>(
			bot,
			'getPagesTranscluding',
			template
		);

		// Extract results from callback args (ignore first arg if it's error, which promisifyBotMethod already handles)
		const rawResults = callbackArgs[1];
		const results = Array.isArray(rawResults) 
			? rawResults.filter((page): page is TranscludingPage => page != null && typeof page === 'object' && 'title' in page)
			: [];

		return jsonResult({
			template,
			pages: results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get pages transcluding template', error as Error);
	}
}

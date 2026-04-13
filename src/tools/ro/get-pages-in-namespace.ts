import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PageInNamespace extends Record<string, any> {
	title: string;
	pageid: number;
	ns: number;
}

export function getPagesInNamespaceTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-pages-in-namespace',
		'Get all non-redirect pages in a specific namespace',
		{
			namespace: z.number().describe('Namespace number to filter pages')
		},
		{
			title: 'Get pages in namespace',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { namespace } ) => handleGetPagesInNamespaceTool( namespace )
	);
}

async function handleGetPagesInNamespaceTool(
	namespace: number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const results = await promisifyBotMethod<PageInNamespace[]>(
			bot,
			'getPagesInNamespace',
			namespace
		);

		return jsonResult({
			namespace,
			pages: results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get pages in namespace', error as Error);
	}
}

import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Backlink extends Record<string, any> {
	title: string;
	pageid: number;
}

export function getBacklinksTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-backlinks',
		'Get all backlinks to a specific page',
		{
			title: z.string().describe('Target page title to find backlinks for')
		},
		{
			title: 'Get backlinks',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title } ) => handleGetBacklinksTool( title )
	);
}

async function handleGetBacklinksTool(
	title: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const backlinks = await promisifyBotMethod<Backlink[]>(
			bot,
			'getBacklinks',
			title
		);

		return jsonResult({
			target: title,
			backlinks,
			count: backlinks.length
		});
	} catch ( error ) {
		return errorResult('Failed to get backlinks', error as Error);
	}
}

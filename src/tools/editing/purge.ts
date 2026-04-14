import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function purgeTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'purge',
		'Purge cache for wiki pages',
		{
			titles: z.union([z.string(), z.array(z.string())]).describe( 'Page title(s) or category to purge' ),
		},
		{
			title: 'Purge pages',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handlePurgeTool( params )
	);
}

async function handlePurgeTool(
	params: {
		titles: string | string[];
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		const result = await promisifyBotMethod<any[]>(
			bot,
			'purge',
			params.titles
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to purge pages', error as Error);
	}
}

import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function appendTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'append',
		'Append content to a wiki page (requires authentication)',
		{
			title: z.string().describe( 'Page title' ),
			content: z.string().describe( 'Content to append' ),
			summary: z.string().describe( 'Edit summary' )
		},
		{
			title: 'Append to page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( params ) => handleAppendTool( params )
	);
}

async function handleAppendTool(
	params: {
		title: string;
		content: string;
		summary: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		await promisifyBotMethod<void>(
			bot,
			'append',
			params.title,
			params.content,
			params.summary
		);

		return jsonResult({ success: true, title: params.title });
	} catch ( error ) {
		return errorResult('Failed to append to page', error as Error);
	}
}

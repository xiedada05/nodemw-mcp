import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function deleteTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'delete',
		'Delete a wiki page (requires authentication)',
		{
			title: z.string().describe( 'Page title to delete' ),
			reason: z.string().describe( 'Reason for deletion' ),
		},
		{
			title: 'Delete page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( params ) => handleDeleteTool( params )
	);
}

async function handleDeleteTool(
	params: {
		title: string;
		reason: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const prefixedReason = `[nodemw-mcp] ${params.reason}`;

		const result = await promisifyBotMethod<{
			title: string;
			reason: string;
		}>(
			bot,
			'delete',
			params.title,
			prefixedReason
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to delete page', error as Error);
	}
}

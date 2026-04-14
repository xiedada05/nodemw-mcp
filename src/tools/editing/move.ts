import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function moveTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'move',
		'Move (rename) a wiki page (requires authentication)',
		{
			from: z.string().describe( 'Current page title' ),
			to: z.string().describe( 'New page title' ),
			summary: z.string().describe( 'Move summary' ),
		},
		{
			title: 'Move page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( params ) => handleMoveTool( params )
	);
}

async function handleMoveTool(
	params: {
		from: string;
		to: string;
		summary: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const prefixedSummary = `[nodemw-mcp] ${params.summary}`;

		const result = await promisifyBotMethod<{
			from: string;
			to: string;
			reason: string;
		}>(
			bot,
			'move',
			params.from,
			params.to,
			prefixedSummary
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to move page', error as Error);
	}
}

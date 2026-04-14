import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function prependTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'prepend',
		'Prepend content to a wiki page (requires authentication)',
		{
			title: z.string().describe( 'Page title to prepend to' ),
			content: z.string().describe( 'Content to prepend' ),
			summary: z.string().describe( 'Edit summary' ),
		},
		{
			title: 'Prepend to page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( params ) => handlePrependTool( params )
	);
}

async function handlePrependTool(
	params: {
		title: string;
		content: string;
		summary: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const prefixedSummary = `[nodemw-mcp] ${params.summary}`;

		const result = await promisifyBotMethod<{
			title: string;
			pageid?: number;
			oldrevid?: number;
			newrevid?: number;
		}>(
			bot,
			'prepend',
			params.title,
			params.content,
			prefixedSummary
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to prepend to page', error as Error);
	}
}

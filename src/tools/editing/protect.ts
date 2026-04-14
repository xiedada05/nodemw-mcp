import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function protectTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'protect',
		'Protect a wiki page (requires authentication)',
		{
			title: z.string().describe( 'Page title to protect' ),
			protections: z.array(
				z.object({
					type: z.string().describe( 'Action type (e.g., edit, move)' ),
					level: z.string().optional().default('all').describe( 'Protection level (e.g., sysop, autoconfirmed)' ),
					expiry: z.string().optional().describe( 'Expiry time (e.g., 1 week, never)' )
				})
			).describe( 'Protection settings' ),
			reason: z.string().optional().describe( 'Reason for protection' ),
			cascade: z.boolean().optional().default(false).describe( 'Apply cascade protection' )
		},
		{
			title: 'Protect page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( params ) => handleProtectTool( params )
	);
}

async function handleProtectTool(
	params: {
		title: string;
		protections: Array<{ type: string; level?: string; expiry?: string }>;
		reason?: string;
		cascade?: boolean;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const options: any = {};
		if (params.reason) {
			options.reason = `[nodemw-mcp] ${params.reason}`;
		}
		if (params.cascade) {
			options.cascade = params.cascade;
		}

		const result = await promisifyBotMethod<{
			title: string;
			protections: any[];
		}>(
			bot,
			'protect',
			params.title,
			params.protections,
			options
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to protect page', error as Error);
	}
}

import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { botService } from '../../common/botService.js';
import { clearBotCache } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function removeBotTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'remove-bot',
		'Remove a Bot configuration',
		{
			key: z.string().describe( 'Key of the bot configuration to remove' )
		},
		{
			title: 'Remove bot',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { key } ) => handleRemoveBotTool( key )
	);
}

async function handleRemoveBotTool( key: string ): Promise<CallToolResult> {
	try {
		const current = botService.getCurrent();
		if ( current.key === key ) {
			return errorResult('Cannot remove the currently active bot. Switch to another bot first.');
		}

		botService.remove( key );
		return jsonResult({
			success: true,
			key,
			message: `Bot "${key}" removed successfully`
		});
	} catch ( error ) {
		return errorResult('Failed to remove bot', error as Error);
	}
}

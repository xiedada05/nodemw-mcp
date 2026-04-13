import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { botService } from '../../common/botService.js';
import { clearBotCache } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function setBotTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'set-bot',
		'Set the current Bot configuration',
		{
			key: z.string().describe( 'Key of the bot configuration to use' )
		},
		{
			title: 'Set bot',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { key } ) => handleSetBotTool( key )
	);
}

async function handleSetBotTool( key: string ): Promise<CallToolResult> {
	try {
		botService.setCurrent( key );
		clearBotCache();

		return jsonResult({
			success: true,
			key,
			message: `Switched to bot "${key}"`
		});
	} catch ( error ) {
		return errorResult('Failed to switch bot', error as Error);
	}
}

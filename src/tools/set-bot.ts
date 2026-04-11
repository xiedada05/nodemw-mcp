import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { botService } from '../common/botService.js';
import { clearBotCache } from '../common/nodemwBot.js';

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

		return {
			content: [ { type: 'text', text: `Switched to bot "${ key }"` } ]
		};
	} catch ( error ) {
		return {
			content: [ { type: 'text', text: `Error switching bot: ${ ( error as Error ).message }` } ],
			isError: true
		};
	}
}

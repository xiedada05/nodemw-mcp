import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';

export function parseTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'parse',
		'Parse wikitext to HTML',
		{
			text: z.string().describe('Wikitext to parse'),
			title: z.string().optional().describe('Context page title')
		},
		{
			title: 'Parse wikitext',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { text, title } ) => handleParseTool( text, title )
	);
}

async function handleParseTool(
	text: string,
	title?: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const callbackArgs = await promisifyBotMethod<[Error | null, string, string[]]>(
			bot,
			'parse',
			text,
			title || ''
		);

		const xml = callbackArgs[1] || '';
		const images = Array.isArray(callbackArgs[2]) ? callbackArgs[2] : [];

		const output = [
			'Parsed XML structure:',
			'',
			xml,
			'',
			`Images found: ${images.length > 0 ? images.join(', ') : 'none'}`
		].join( '\n' );

		return {
			content: [ { type: 'text', text: output } ]
		};
	} catch ( error ) {
		return {
			content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
			isError: true
		};
	}
}

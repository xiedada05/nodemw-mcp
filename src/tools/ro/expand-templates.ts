import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';

export function expandTemplatesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'expand-templates',
		'Expand templates in wikitext',
		{
			text: z.string().describe('Wikitext with templates to expand'),
			title: z.string().optional().describe('Context page title'),
		},
		{
			title: 'Expand templates',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { text, title } ) => handleExpandTemplatesTool( text, title )
	);
}

async function handleExpandTemplatesTool(
	text: string,
	title?: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const expandedXml = await promisifyBotMethod<string>(
			bot,
			'expandTemplates',
			text,
			title || ''
		);

		return {
			content: [ { type: 'text', text: expandedXml } ]
		};
	} catch ( error ) {
		return {
			content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
			isError: true
		};
	}
}

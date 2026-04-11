import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../common/nodemwBot.js';

export function getArticleTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-article',
		'Retrieve the content of a wiki article',
		{
			title: z.string().describe( 'Article title' ),
			followRedirect: z.boolean().optional().default( true ).describe( 'Follow redirects' )
		},
		{
			title: 'Get article',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title, followRedirect } ) => handleGetArticleTool( title, followRedirect )
	);
}

async function handleGetArticleTool(
	title: string,
	followRedirect: boolean
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const result = await promisifyBotMethod<string>(
			bot,
			'getArticle',
			title,
			followRedirect
		);
		return {
			content: [ { type: 'text', text: result } ]
		};
	} catch ( error ) {
		return {
			content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
			isError: true
		};
	}
}

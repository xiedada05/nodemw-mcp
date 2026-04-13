import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';

export function getArticleTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-article',
		'Retrieve the content of a wiki article',
		{
			title: z.string().describe( 'Article title' ),
			followRedirect: z.boolean().optional().default( true ).describe( 'Follow redirects' ),
			redirectInfo: z.boolean().optional().default( false ).describe( 'Include information about redirects' )
		},
		{
			title: 'Get article',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title, followRedirect, redirectInfo } ) => handleGetArticleTool( title, followRedirect, redirectInfo )
	);
}

async function handleGetArticleTool(
	title: string,
	followRedirect: boolean,
	redirectInfo: boolean
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		if (redirectInfo) {
			// When redirectInfo is requested, get both content and redirect info
			const result = await new Promise<[string, unknown]>((resolve, reject) => {
				const callback = (err: Error | null, content: string, redirectInfo: unknown) => {
					if (err) {
						reject(err);
					} else {
						resolve([content, redirectInfo]);
					}
				};

				// @ts-expect-error: any method call
				bot.getArticle(title, followRedirect, callback);
			});
			const [content, redirect] = result;
			const responseText = redirect 
				? `Content:\n\n${content}\n\nRedirect Information:\n\n${JSON.stringify(redirect, null, 2)}`
				: content;
			
			return {
				content: [ { type: 'text', text: responseText } ]
			};
		} else {
			// Original behavior: just return content
			const result = await promisifyBotMethod<string>(
				bot,
				'getArticle',
				title,
				followRedirect
			);
			return {
				content: [ { type: 'text', text: result } ]
			};
		}
	} catch ( error ) {
		return {
			content: [ { type: 'text', text: `Error: ${ ( error as Error ).message }` } ],
			isError: true
		};
	}
}

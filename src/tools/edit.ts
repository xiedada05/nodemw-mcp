import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../common/nodemwBot.js';

export function editTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'edit',
		'Edit a wiki page (requires authentication)',
		{
			title: z.string().describe( 'Page title to edit' ),
			content: z.string().describe( 'New content for the page' ),
			summary: z.string().describe( 'Edit summary' ),
			minor: z.boolean().optional().default( false ).describe( 'Mark as minor edit' )
		},
		{
			title: 'Edit page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( params ) => handleEditTool( params )
	);
}

async function handleEditTool(
	params: {
		title: string;
		content: string;
		summary: string;
		minor?: boolean;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		const result = await promisifyBotMethod<{
			title: string;
			pageid?: number;
			oldrevid?: number;
			newrevid?: number;
		}>(
			bot,
			'edit',
			params.title,
			params.content,
			params.summary,
			params.minor || false
		);

		const output = [
			`Page "${ result.title }" edited successfully`,
			''
		];

		if ( result.pageid ) {
			output.push( `Page ID: ${ result.pageid }` );
		}
		if ( result.oldrevid ) {
			output.push( `Previous revision: ${ result.oldrevid }` );
		}
		if ( result.newrevid ) {
			output.push( `New revision: ${ result.newrevid }` );
		}

		return {
			content: [ { type: 'text', text: output.join( '\n' ) } ]
		};
	} catch ( error ) {
		return {
			content: [ { type: 'text', text: `Error editing page: ${ ( error as Error ).message }` } ],
			isError: true
		};
	}
}

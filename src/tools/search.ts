import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../common/nodemwBot.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SearchResult extends Record<string, any> {
	title: string;
	snippet?: string;
	url?: string;
	pageId?: number;
}

export function searchTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'search',
		'Search for wiki pages by keyword',
		{
			keyword: z.string().describe( 'Search keyword' ),
			limit: z.number().optional().default( 10 ).describe( 'Maximum number of results' )
		},
		{
			title: 'Search',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { keyword, limit } ) => handleSearchTool( keyword, limit )
	);
}

async function handleSearchTool(
	keyword: string,
	limit: number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		// nodemw search returns array of results directly
		const results = await promisifyBotMethod<SearchResult[]>(
			bot,
			'search',
			keyword
		);

		// Limit results
		const limitedResults = results.slice( 0, limit );

		const formattedResults = limitedResults.map( ( result, index ) => {
			const lines = [ `${ index + 1 }. ${ result.title }` ];
			if ( result.snippet ) {
				lines.push( `   Snippet: ${ result.snippet }` );
			}
			if ( result.url ) {
				lines.push( `   URL: ${ result.url }` );
			}
			if ( result.pageId ) {
				lines.push( `   Page ID: ${ result.pageId }` );
			}
			return lines.join( '\n' );
		} );

		const output = [
			`Found ${ results.length } result(s) for "${ keyword }"` + ( results.length > limit ? ` (showing first ${ limit })` : '' ),
			'',
			...formattedResults
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

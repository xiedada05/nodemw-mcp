import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../common/nodemwBot.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PageInCategory extends Record<string, any> {
	title: string;
	pageid?: number;
	ns?: number;
}

export function getPagesInCategoryTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-pages-in-category',
		'Get all pages in a category',
		{
			category: z.string().describe( 'Category name (with or without Category: prefix)' )
		},
		{
			title: 'Get pages in category',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { category } ) => handleGetPagesInCategoryTool( category )
	);
}

async function handleGetPagesInCategoryTool(
	category: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		// Remove "Category:" prefix if present
		const cleanCategory = category.replace( /^Category:/i, '' );

		const results = await promisifyBotMethod<PageInCategory[]>(
			bot,
			'getPagesInCategory',
			cleanCategory
		);

		const formattedResults = results.map( ( result, index ) => {
			const lines = [ `${ index + 1 }. ${ result.title }` ];
			if ( result.pageid ) {
				lines.push( `   Page ID: ${ result.pageid }` );
			}
			if ( result.ns !== undefined ) {
				lines.push( `   Namespace: ${ result.ns }` );
			}
			return lines.join( '\n' );
		} );

		const output = [
			`Found ${ results.length } page(s) in category "${ cleanCategory }"`,
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

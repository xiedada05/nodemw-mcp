import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { botService } from '../common/botService.js';
import { clearBotCache } from '../common/nodemwBot.js';

export function addBotTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'add-bot',
		'Add a new Bot configuration',
		{
			key: z.string().describe( 'Unique key for this bot configuration' ),
			server: z.string().describe( 'Wiki server URL (e.g., https://en.wikipedia.org)' ),
			protocol: z.string().optional().describe( 'Protocol, defaults to https' ),
			port: z.number().optional().describe( 'Port number' ),
			path: z.string().optional().describe( 'API path, defaults to /w' ),
			proxy: z.string().optional().describe( 'Proxy server URL' ),
			userAgent: z.string().optional().describe( 'Custom user agent string' ),
			concurrency: z.number().optional().describe( 'Concurrency limit' ),
			debug: z.boolean().optional().default( false ).describe( 'Enable debug mode' ),
			username: z.string().optional().describe( 'Username for authentication' ),
			password: z.string().optional().describe( 'Password for authentication' ),
			domain: z.string().optional().describe( 'Domain for LDAP authentication' ),
			dryRun: z.boolean().optional().default( false ).describe( 'Dry run mode' )
		},
		{
			title: 'Add bot',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handleAddBotTool( params )
	);
}

async function handleAddBotTool(
	params: {
		key: string;
		server: string;
		protocol?: string;
		port?: number;
		path?: string;
		proxy?: string;
		userAgent?: string;
		concurrency?: number;
		debug?: boolean;
		username?: string;
		password?: string;
		domain?: string;
		dryRun?: boolean;
	}
): Promise<CallToolResult> {
	try {
		botService.add( params.key, {
			server: params.server,
			protocol: params.protocol,
			port: params.port,
			path: params.path || '/w',
			proxy: params.proxy,
			userAgent: params.userAgent,
			concurrency: params.concurrency,
			debug: params.debug || false,
			username: params.username || null,
			password: params.password || null,
			domain: params.domain,
			dryRun: params.dryRun || false
		} );

		return {
			content: [ { type: 'text', text: `Bot "${ params.key }" added successfully` } ]
		};
	} catch ( error ) {
		return {
			content: [ { type: 'text', text: `Error adding bot: ${ ( error as Error ).message }` } ],
			isError: true
		};
	}
}

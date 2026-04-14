import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function whoareTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'whoare',
		'Get information about multiple wiki users',
		{
			usernames: z.array( z.string() ).describe( 'Array of usernames to query' ),
		},
		{},
		async ( params ) => handleWhoareTool( params )
	);
}

async function handleWhoareTool(
	params: {
		usernames: string[];
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		const users = await promisifyBotMethod<any[]>(
			bot,
			'whoare',
			params.usernames
		);

		return jsonResult(users);
	} catch ( error ) {
		return errorResult('Failed to get user information', error as Error);
	}
}

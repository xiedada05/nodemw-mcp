import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function createAccountTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'create-account',
		'Create a new MediaWiki user account (requires authentication)',
		{
			username: z.string().describe( 'New account username' ),
			password: z.string().describe( 'New account password' ),
		},
		{
			title: 'Create user account',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handleCreateAccountTool( params )
	);
}

async function handleCreateAccountTool(
	params: {
		username: string;
		password: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		const result = await promisifyBotMethod<any>(
			bot,
			'createAccount',
			params.username,
			params.password
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to create account', error as Error);
	}
}

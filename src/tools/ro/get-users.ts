import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UserInfo extends Record<string, any> {
	name: string;
	userid: number;
}

export function getUsersTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-users',
		'Get all users matching a prefix',
		{
			prefix: z.string().optional().default('').describe('Prefix to filter usernames'),
			onlyWithEdits: z.boolean().optional().default(false).describe('Only include users with at least one edit')
		},
		{
			title: 'Get users',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { prefix, onlyWithEdits } ) => handleGetUsersTool( prefix, onlyWithEdits )
	);
}

async function handleGetUsersTool(
	prefix: string,
	onlyWithEdits: boolean
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const results = await promisifyBotMethod<UserInfo[]>(
			bot,
			'getUsers',
			{ prefix, witheditsonly: onlyWithEdits }
		);

		return jsonResult({
			prefix,
			onlyWithEdits,
			users: results,
			count: results.length
		});
	} catch ( error ) {
		return errorResult('Failed to get users', error as Error);
	}
}

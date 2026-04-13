import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface WhoisUserInfo extends Record<string, any> {
	name: string;
	userid: number;
	groups: string[];
	rights: string[];
}

export function whoisTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'whois',
		'Get information about a specific user',
		{
			username: z.string().describe('Username to look up')
		},
		{
			title: 'Whois',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { username } ) => handleWhoisTool( username )
	);
}

async function handleWhoisTool(
	username: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const userInfo = await promisifyBotMethod<WhoisUserInfo & { missing?: string }>(
			bot,
			'whois',
			username
		);

		if (userInfo.missing) {
			return errorResult(`User "${username}" not found.`);
		}

		return jsonResult(userInfo);
	} catch ( error ) {
		return errorResult('Failed to get user info', error as Error);
	}
}

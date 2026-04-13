import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UserInfo extends Record<string, any> {
	name: string;
	id: number;
	groups: string[];
	rights: string[];
}

export function whoamiTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'whoami',
		'Get information about the currently logged in user',
		{},
		{
			title: 'Who am I',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async () => handleWhoamiTool()
	);
}

async function handleWhoamiTool(): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const userInfo = await promisifyBotMethod<UserInfo>(
			bot,
			'whoami'
		);

		return jsonResult(userInfo);
	} catch ( error ) {
		return errorResult('Failed to get current user info', error as Error);
	}
}

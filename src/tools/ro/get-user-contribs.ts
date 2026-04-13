import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UserContrib extends Record<string, any> {
	title: string;
	revid: number;
	timestamp: string;
	comment: string;
}

export function getUserContribsTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-user-contribs',
		'Get contributions made by a specific user',
		{
			username: z.string().describe('Username to get contributions for'),
			namespace: z.number().optional().describe('Filter contributions by namespace'),
			limit: z.number().optional().default(50).describe('Maximum number of contributions to return')
		},
		{
			title: 'Get user contributions',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { username, namespace, limit } ) => handleGetUserContribsTool( username, namespace, limit )
	);
}

async function handleGetUserContribsTool(
	username: string,
	namespace?: number,
	limit: number = 50
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const options = {
			user: username,
			...(namespace !== undefined && { namespace })
		};

		const callbackArgs = await promisifyBotMethod<[Error | null, UserContrib[], string | boolean]>(
			bot,
			'getUserContribs',
			options
		);

		const contribs = Array.isArray(callbackArgs[1]) ? callbackArgs[1] : [];

		// Limit results
		const limitedContribs = contribs.slice(0, limit);

		return jsonResult({
			username,
			namespace,
			limit,
			total: contribs.length,
			displayed: limitedContribs.length,
			contributions: limitedContribs
		});
	} catch ( error ) {
		return errorResult('Failed to get user contributions', error as Error);
	}
}

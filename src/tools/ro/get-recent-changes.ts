import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RecentChange extends Record<string, any> {
	title: string;
	timestamp: string;
	user: string;
	comment: string;
}

export function getRecentChangesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-recent-changes',
		'Get recent changes on the wiki',
		{
			start: z.string().optional().describe('Start timestamp'),
			limit: z.number().optional().default(50).describe('Maximum number of changes to return')
		},
		{
			title: 'Get recent changes',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { start, limit } ) => handleGetRecentChangesTool( start, limit )
	);
}

async function handleGetRecentChangesTool(
	start?: string,
	limit: number = 50
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		// Handle getRecentChanges's callback signature manually
		const changes = await new Promise<RecentChange[]>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(bot as any).getRecentChanges(start, (err: Error | null, ...args: any[]) => {
				if (err) {
					reject(err);
				} else {
					const chgs = args[0];
					resolve(Array.isArray(chgs) ? chgs : []);
				}
			});
		});

		// Limit results
		const limitedChanges = changes.slice(0, limit);

		return jsonResult({
			total: changes.length,
			limit,
			start,
			changes: limitedChanges
		});
	} catch ( error ) {
		return errorResult('Failed to get recent changes', error as Error);
	}
}

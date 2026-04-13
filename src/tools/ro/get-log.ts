import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface LogEntry extends Record<string, any> {
	title: string;
	timestamp: string;
	user: string;
	action: string;
	comment: string;
}

export function getLogTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-log',
		'Get log entries of a specific type',
		{
			type: z.string().describe('Log type (e.g. delete, block, move)'),
			start: z.string().optional().default('').describe('Start timestamp (YYYYMMDDHHMMSS format)'),
			limit: z.number().optional().default(50).describe('Maximum number of entries to return')
		},
		{
			title: 'Get log entries',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { type, start, limit } ) => handleGetLogTool( type, start, limit )
	);
}

async function handleGetLogTool(
	type: string,
	start: string,
	limit: number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		// Handle getLog's callback signature manually
		const entries = await new Promise<LogEntry[]>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(bot as any).getLog(type, start, (err: Error | null, ...args: any[]) => {
				if (err) {
					reject(err);
				} else {
					const ents = args[0];
					resolve(Array.isArray(ents) ? ents : []);
				}
			});
		});

		// Limit results
		const limitedEntries = entries.slice(0, limit);

		return jsonResult({
			type,
			start,
			limit,
			total: entries.length,
			displayed: limitedEntries.length,
			entries: limitedEntries
		});
	} catch ( error ) {
		return errorResult('Failed to get log entries', error as Error);
	}
}

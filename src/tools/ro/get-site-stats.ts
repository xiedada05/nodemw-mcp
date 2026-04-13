import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SiteStats extends Record<string, any> {
	pages: number;
	articles: number;
	edits: number;
	images: number;
	users: number;
	activeusers: number;
	admins: number;
	jobs: number;
}

export function getSiteStatsTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-site-stats',
		'Get site statistics',
		{},
		{
			title: 'Get site stats',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async () => handleGetSiteStatsTool()
	);
}

async function handleGetSiteStatsTool(): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const stats = await promisifyBotMethod<SiteStats>(
			bot,
			'getSiteStats'
		);

		return jsonResult(stats);
	} catch ( error ) {
		return errorResult('Failed to get site stats', error as Error);
	}
}

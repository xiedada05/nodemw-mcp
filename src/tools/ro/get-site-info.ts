import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function getSiteInfoTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-site-info',
		'Get site information from MediaWiki',
		{
			properties: z.array(z.string()).describe('List of site information properties to retrieve')
		},
		{
			title: 'Get site info',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { properties } ) => handleGetSiteInfoTool( properties )
	);
}

async function handleGetSiteInfoTool(
	properties: string[]
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const info = await promisifyBotMethod<Record<string, unknown>>(
			bot,
			'getSiteInfo',
			properties
		);

		return jsonResult(info || {});
	} catch ( error ) {
		return errorResult('Failed to get site info', error as Error);
	}
}

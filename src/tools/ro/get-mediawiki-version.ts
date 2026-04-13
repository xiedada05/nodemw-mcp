import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function getMediaWikiVersionTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-mediawiki-version',
		'Get MediaWiki version running on the server',
		{},
		{
			title: 'Get MediaWiki version',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async () => handleGetMediaWikiVersionTool()
	);
}

async function handleGetMediaWikiVersionTool(): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const version = await promisifyBotMethod<string>(
			bot,
			'getMediaWikiVersion'
		);

		return jsonResult({ version });
	} catch ( error ) {
		return errorResult('Failed to get MediaWiki version', error as Error);
	}
}

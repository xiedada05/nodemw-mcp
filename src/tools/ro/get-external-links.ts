import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ExternalLink extends Record<string, any> {
	'*': string;
}

export function getExternalLinksTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-external-links',
		'Get all external links from an article',
		{
			title: z.union([z.string(), z.number()]).describe('Article title or page ID')
		},
		{
			title: 'Get external links',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title } ) => handleGetExternalLinksTool( title )
	);
}

async function handleGetExternalLinksTool(
	title: string | number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const links = await promisifyBotMethod<ExternalLink[]>(
			bot,
			'getExternalLinks',
			title
		);

		return jsonResult({
			title,
			links: links.map(link => link['*']),
			count: links.length
		});
	} catch ( error ) {
		return errorResult('Failed to get external links', error as Error);
	}
}

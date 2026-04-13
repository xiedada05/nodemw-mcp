import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Revision extends Record<string, any> {
	revid: number;
	timestamp: string;
	user: string;
	comment: string;
	size: number;
}

export function getArticleRevisionsTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-article-revisions',
		'Get all revisions of a wiki article',
		{
			title: z.union([z.string(), z.number()]).describe('Article title or page ID')
		},
		{
			title: 'Get article revisions',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title } ) => handleGetArticleRevisionsTool( title )
	);
}

async function handleGetArticleRevisionsTool(
	title: string | number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const allRevisions = await promisifyBotMethod<Revision[][]>(
			bot,
			'getArticleRevisions',
			title
		);

		// Flatten the results
		const revisions = allRevisions.flat();

		return jsonResult({
			title,
			revisions,
			count: revisions.length
		});
	} catch ( error ) {
		return errorResult('Failed to get article revisions', error as Error);
	}
}

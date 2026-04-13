import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ArticleImage extends Record<string, any> {
	title: string;
	ns: number;
}

export function getImagesFromArticleTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-images-from-article',
		'Get all images embedded in a specific article',
		{
			title: z.union([z.string(), z.number()]).describe('Article title or page ID')
		},
		{
			title: 'Get images from article',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { title } ) => handleGetImagesFromArticleTool( title )
	);
}

async function handleGetImagesFromArticleTool(
	title: string | number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const images = await promisifyBotMethod<ArticleImage[]>(
			bot,
			'getImagesFromArticle',
			title
		);

		return jsonResult({
			title,
			images,
			count: images.length
		});
	} catch ( error ) {
		return errorResult('Failed to get images from article', error as Error);
	}
}

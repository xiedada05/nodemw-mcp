import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Image extends Record<string, any> {
	name: string;
	img_timestamp: string;
	user: string;
}

export function getImagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-images',
		'Get list of images starting from a specific name',
		{
			startFrom: z.string().optional().default('').describe('Start from this image name'),
			limit: z.number().optional().default(50).describe('Maximum number of images to return')
		},
		{
			title: 'Get images',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { startFrom, limit } ) => handleGetImagesTool( startFrom, limit )
	);
}

async function handleGetImagesTool(
	startFrom: string,
	limit: number
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		// getImages has a different callback signature - let's handle it manually
		const images = await new Promise<Image[]>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(bot as any).getImages(startFrom, (err: Error | null, ...args: any[]) => {
				if (err) {
					reject(err);
				} else {
					const imgs = args[0];
					resolve(Array.isArray(imgs) ? imgs : []);
				}
			});
		});

		// Limit results
		const limitedImages = images.slice(0, limit);

		return jsonResult({
			total: images.length,
			limit,
			startFrom,
			images: limitedImages
		});
	} catch ( error ) {
		return errorResult('Failed to get images', error as Error);
	}
}

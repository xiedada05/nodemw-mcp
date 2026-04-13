import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {CallToolResult, ToolAnnotations} from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ImageUsage extends Record<string, any> {
	title: string;
	pageid: number;
	ns: number;
}

export function getImageUsageTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-image-usage',
		'Get all pages that use a specific image',
		{
			filename: z.string().describe('Image filename with File: prefix')
		},
		{
			title: 'Get image usage',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { filename } ) => handleGetImageUsageTool( filename )
	);
}

async function handleGetImageUsageTool(
	filename: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const pages = await promisifyBotMethod<ImageUsage[]>(
			bot,
			'getImageUsage',
			filename
		);

		return jsonResult({
			filename,
			pages,
			count: pages.length
		});
	} catch ( error ) {
		return errorResult('Failed to get image usage', error as Error);
	}
}

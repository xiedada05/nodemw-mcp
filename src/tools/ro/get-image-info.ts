import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ImageInfo extends Record<string, any> {
	timestamp: string;
	user: string;
	width: number;
	height: number;
	size: number;
	url: string;
	descriptionurl: string;
	exif?: Record<string, string>;
}

export function getImageInfoTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-image-info',
		'Get detailed information about an image file',
		{
			filename: z.string().describe('Image filename with File: prefix')
		},
		{
			title: 'Get image info',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { filename } ) => handleGetImageInfoTool( filename )
	);
}

async function handleGetImageInfoTool(
	filename: string
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const info = await promisifyBotMethod<ImageInfo | undefined>(
			bot,
			'getImageInfo',
			filename
		);

		if (!info) {
			return errorResult(`Image "${filename}" not found.`);
		}

		return jsonResult({
			filename,
			info
		});
	} catch ( error ) {
		return errorResult('Failed to get image info', error as Error);
	}
}

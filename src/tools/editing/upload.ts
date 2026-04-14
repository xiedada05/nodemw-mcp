import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function uploadTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'upload',
		'Upload a file to wiki (requires authentication)',
		{
			filename: z.string().describe( 'Destination filename on wiki' ),
			content: z.string().describe( 'File content as base64 string' ),
			comment: z.string().optional().describe( 'Upload comment' ),
		},
		{
			title: 'Upload file',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handleUploadTool( params )
	);
}

async function handleUploadTool(
	params: {
		filename: string;
		content: string;
		comment?: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const fileContent = Buffer.from(params.content, 'base64');
		const comment = params.comment ? `[nodemw-mcp] ${params.comment}` : '[nodemw-mcp] File upload';

		const result = await promisifyBotMethod<{
			result: string;
			filename: string;
			imageinfo?: any;
		}>(
			bot,
			'upload',
			params.filename,
			fileContent,
			comment
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to upload file', error as Error);
	}
}

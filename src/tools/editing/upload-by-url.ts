import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function uploadByUrlTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'upload-by-url',
		'Upload a file to wiki from URL (requires authentication)',
		{
			filename: z.string().describe( 'Destination filename on wiki' ),
			url: z.string().url().describe( 'Source URL to download file from' ),
			summary: z.string().optional().describe( 'Upload summary' ),
		},
		{
			title: 'Upload file by URL',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handleUploadByUrlTool( params )
	);
}

async function handleUploadByUrlTool(
	params: {
		filename: string;
		url: string;
		summary?: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();
		const prefixedSummary = params.summary ? `[nodemw-mcp] ${params.summary}` : '[nodemw-mcp] File upload from URL';

		const result = await promisifyBotMethod<{
			result: string;
			filename: string;
			imageinfo?: any;
		}>(
			bot,
			'uploadByUrl',
			params.filename,
			params.url,
			prefixedSummary
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to upload file by URL', error as Error);
	}
}

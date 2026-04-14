import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function sendEmailTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'send-email',
		'Send email to a wiki user (requires authentication)',
		{
			username: z.string().describe( 'Username to email' ),
			subject: z.string().describe( 'Email subject' ),
			text: z.string().describe( 'Email content' ),
		},
		{
			title: 'Send email',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handleSendEmailTool( params )
	);
}

async function handleSendEmailTool(
	params: {
		username: string;
		subject: string;
		text: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		const result = await promisifyBotMethod<{
			result: string;
		}>(
			bot,
			'sendEmail',
			params.username,
			params.subject,
			params.text
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to send email', error as Error);
	}
}

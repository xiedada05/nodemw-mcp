import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function addFlowTopicTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'add-flow-topic',
		'Add a new Flow topic to a wiki page (requires authentication)',
		{
			title: z.string().describe( 'Page title to add topic to' ),
			subject: z.string().describe( 'Topic subject' ),
			content: z.string().describe( 'Topic content in wikitext' ),
		},
		{
			title: 'Add Flow topic',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handleAddFlowTopicTool( params )
	);
}

async function handleAddFlowTopicTool(
	params: {
		title: string;
		subject: string;
		content: string;
	}
): Promise<CallToolResult> {
	try {
		const bot = await getBot();

		const result = await promisifyBotMethod<{
			'new-topic': {
				status: string;
				workflow: string;
			};
		}>(
			bot,
			'addFlowTopic',
			params.title,
			params.subject,
			params.content
		);

		return jsonResult(result);
	} catch ( error ) {
		return errorResult('Failed to add Flow topic', error as Error);
	}
}

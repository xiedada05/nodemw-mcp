import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';

export const USER_AGENT = 'nodemw-mcp-server/1.0';

export function createServer(): McpServer {
	const capabilities: ServerCapabilities = {
		resources: {},
		tools: {}
	};

	const server = new McpServer(
		{
			name: 'nodemw-mcp-server',
			version: '1.0.0'
		},
		{ capabilities }
	);

	return server;
}

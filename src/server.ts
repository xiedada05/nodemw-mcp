import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const USER_AGENT = 'nodemw-mcp-server/1.0';

export function createServer(): McpServer {
	return new McpServer(
		{
			name: 'nodemw-mcp-server',
			version: '1.0.0'
		},
		{ capabilities: { tools: {} } }
	);
}

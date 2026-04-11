import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { registerAllResources } from './resources/index.js';
import { registerAllTools } from './tools/index.js';

async function main(): Promise<void> {
	const server = createServer();

	registerAllResources( server );
	registerAllTools( server );

	const transport = new StdioServerTransport();
	await server.connect( transport );
}

main().catch( console.error );

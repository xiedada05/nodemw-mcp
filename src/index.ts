#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'util';
import { createServer } from './server.js';
import { registerAllTools } from './tools/index.js';
import { initServerConfig, type ServerConfig } from './common/nodemwBot.js';

function parseCliArgs(): ServerConfig {
	const { values } = parseArgs({
		options: {
			server: { type: 'string' },
			endpoint: { type: 'string' },
			user: { type: 'string' },
			pass: { type: 'string' },
			token: { type: 'string' },
			'dry-run': { type: 'boolean' },
		},
		strict: false,
		allowPositionals: true,
	});

	if (!values.server) {
		console.error('Error: --server is required (e.g., --server en.wikipedia.org or --server https://en.wikipedia.org)');
		process.exit(1);
	}

	const serverUrl = values.server as string;
	let server: string;
	let protocol: string | undefined;
	let port: number | undefined;

	try {
		if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
			const url = new URL(serverUrl);
			server = url.hostname;
			protocol = url.protocol.replace(':', '');
			if (url.port) {
				port = parseInt(url.port, 10);
			}
		} else {
			server = serverUrl;
		}
	} catch {
		server = serverUrl;
	}

	return {
		server,
		protocol,
		port,
		endpoint: (values.endpoint as string) ?? '/w',
		username: values.user as string | undefined,
		password: values.pass as string | undefined,
		token: values.token as string | undefined,
		dryRun: values['dry-run'] as boolean | undefined,
	};
}

async function main(): Promise<void> {
	const config = parseCliArgs();
	initServerConfig(config);

	const server = createServer();
	registerAllTools(server);

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);

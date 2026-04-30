/*
 * SPDX-License-Identifier: BSD-2-Clause
 *
 * Copyright (c) 2026 Xie Youtian
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'util';
import { createServer } from './server.js';
import { registerAllTools } from './tools/index.js';
import {
    initServerConfig,
    getBot,
    initBot,
    autoDetectPath,
    promisifyBotMethod,
    isAuthenticated,
    type ServerConfig
} from './common/nodemwBot.js';

function parseCliArgs(): { config: ServerConfig; pathExplicit: boolean } {
    const { values, positionals } = parseArgs({
        options: {
            server: { type: 'string', short: 's' },
            path: { type: 'string' },
            endpoint: { type: 'string' },
            user: { type: 'string', short: 'u' },
            pass: { type: 'string', short: 'p' },
            token: { type: 'string' },
            'dry-run': { type: 'boolean' },
        },
        strict: false,
        allowPositionals: true,
    });

    // Server can be specified via --server/-s or as the first positional argument
    const serverUrl = (values.server as string) ?? positionals[0] ?? process.env.NODEMW_MCP_SERVER;
    if (!serverUrl) {
        console.error('Error: target server is required (-s, positional arg, or NODEMW_MCP_SERVER env)');
        process.exit(1);
    }
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

    const pathFromEnv = process.env.NODEMW_MCP_ENDPOINT_PATH;
    const pathExplicit = !!(values.path ?? values.endpoint ?? pathFromEnv);

    return {
        config: {
            server,
            protocol,
            port,
            path: (values.path as string) ?? (values.endpoint as string) ?? pathFromEnv ?? '/w',
            username: (values.user as string) ?? process.env.NODEMW_MCP_MW_USER,
            password: (values.pass as string) ?? process.env.NODEMW_MCP_MW_PASS,
            token: values.token as string | undefined,
            dryRun: values['dry-run'] as boolean | undefined,
        },
        pathExplicit,
    };
}

async function main(): Promise<void> {
    const { config, pathExplicit } = parseCliArgs();

    // Step 1: Auto-detect API path if not explicitly specified
    if (!pathExplicit) {
        try {
            config.path = await autoDetectPath(config);
            console.error(`Auto-detected API path: ${config.path}`);
        } catch (err) {
            console.error('Error:', (err as Error).message);
            process.exit(1);
        }
    }

    initServerConfig(config);

    // Step 2: Initialize bot — creates connection and logs in if credentials provided
    try {
        await initBot(config);
    } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
    }

    // Step 3: Fetch site info to enrich the server description
    const bot = getBot();
    let siteInfo: { sitename: string; base: string; generator: string } | undefined;
    try {
        const info = await promisifyBotMethod<{ general?: { sitename?: string; base?: string; generator?: string } }>(bot, 'getSiteInfo', ['general']);
        const general = info?.general;
        if (general) {
            siteInfo = {
                sitename: general.sitename || 'Unknown',
                base: general.base || '',
                generator: general.generator || 'MediaWiki',
            };
        }
    } catch {
        console.error('Warning: Could not fetch site info for server description.');
    }

    // Step 4: Create server with site-aware description
    const auth = isAuthenticated();
    const server = createServer(siteInfo, auth);
    registerAllTools(server, auth);

    // Step 5: Connect stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);

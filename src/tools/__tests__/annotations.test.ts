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

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerAllTools, readToolRegistrars, writeToolRegistrars } from '../index.js';

// Keep the real bot module from constructing a network client at import time.
vi.mock('../../common/nodemwBot.js', async () => {
    const { createNodemwBotMock } = await import('./fakeNodemwBot.js');
    return createNodemwBotMock();
});

interface Annotations {
    readOnlyHint?: unknown;
    destructiveHint?: unknown;
    idempotentHint?: unknown;
    openWorldHint?: unknown;
}

function pickHints(a: Annotations | undefined): Annotations {
    return {
        readOnlyHint: a?.readOnlyHint,
        destructiveHint: a?.destructiveHint,
        idempotentHint: a?.idempotentHint,
        openWorldHint: a?.openWorldHint,
    };
}

// Write tools that converge to the same wiki state when an identical call is
// repeated; everything else must be advertised as non-idempotent.
const IDEMPOTENT_WRITES = new Set(['purge', 'protect', 'unblock', 'write']);
// Cache invalidation and restoring deleted revisions don't destroy data.
const NON_DESTRUCTIVE_WRITES = new Set(['purge', 'undelete']);

function expectedHints(name: string, isWrite: boolean): Annotations {
    if (!isWrite) {
        return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
    }
    return {
        readOnlyHint: false,
        destructiveHint: !NON_DESTRUCTIVE_WRITES.has(name),
        idempotentHint: IDEMPOTENT_WRITES.has(name),
        openWorldHint: true,
    };
}

describe('tool registry annotations', () => {
    const client = new Client({ name: 'vitest-client', version: '0.0.0' });
    const readOnlyClient = new Client({ name: 'vitest-client-ro', version: '0.0.0' });
    let server: McpServer;
    let readOnlyServer: McpServer;
    let toolNames: string[];
    let readToolNames: Set<string>;

    beforeAll(async () => {
        server = new McpServer({ name: 'test-server', version: '0.0.0' }, { capabilities: { tools: {} } });
        registerAllTools(server);
        readOnlyServer = new McpServer({ name: 'test-server-ro', version: '0.0.0' }, { capabilities: { tools: {} } });
        registerAllTools(readOnlyServer, false);

        const connect = async (srv: McpServer, cli: Client) => {
            const [a, b] = InMemoryTransport.createLinkedPair();
            await Promise.all([srv.connect(b), cli.connect(a)]);
        };
        await connect(server, client);
        await connect(readOnlyServer, readOnlyClient);

        const { tools } = await client.listTools();
        toolNames = tools.map((t) => t.name);
        const { tools: roTools } = await readOnlyClient.listTools();
        readToolNames = new Set(roTools.map((t) => t.name));
    });

    afterAll(async () => {
        await Promise.all([client.close(), readOnlyClient.close(), server.close(), readOnlyServer.close()]);
    });

    it('registers exactly the read + write tool registrars', async () => {
        expect(toolNames.length).toBe(readToolRegistrars.length + writeToolRegistrars.length);
        expect(readToolRegistrars.length).toBe(37);
        expect(writeToolRegistrars.length).toBe(17);
        expect(new Set(toolNames).size).toBe(toolNames.length); // unique names
        // read-only registration must be a strict subset of the full set
        expect(readToolNames.size).toBe(readToolRegistrars.length);
        for (const name of readToolNames) {
            expect(toolNames, `${name} is a read tool`).toContain(name);
        }
    });

    it('declares all four hints as explicit booleans on every tool', async () => {
        const { tools } = await client.listTools();
        for (const tool of tools) {
            const hints = pickHints((tool.annotations ?? {}) as Annotations);
            for (const hint of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
                expect(
                    typeof hints[hint],
                    `${tool.name}.${hint} must be an explicit boolean`
                ).toBe('boolean');
            }
            expect(
                hints,
                `${tool.name} hints must match expectations`
            ).toEqual(expectedHints(tool.name, !readToolNames.has(tool.name)));
        }
    });

    it('every tool describes itself for the host', async () => {
        const { tools } = await client.listTools();
        for (const tool of tools) {
            expect(tool.description?.length ?? 0, `${tool.name} must have a description`).toBeGreaterThan(10);
        }
    });
});

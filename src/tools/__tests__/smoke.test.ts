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
import { registerAllTools } from '../index.js';
import { clearReadState, conflictGuardParams, markAsRead } from '../../common/pageState.js';
import { CONTENT, PAGE_ID, REVID } from './fakeNodemwBot.js';

vi.mock('../../common/nodemwBot.js', async () => {
    const { createNodemwBotMock } = await import('./fakeNodemwBot.js');
    return createNodemwBotMock();
});

// upload-by-url fetches its source through src/common/safeFetch.ts (global
// fetch + node:dns/promises lookup). Keep the smoke test offline: resolve
// every hostname to a public address and serve a fake PNG body.
vi.mock('node:dns/promises', () => ({
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
}));
vi.stubGlobal('fetch', async () => ({
    status: 200,
    body: (function* () { yield new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); })(),
}));

/** Minimal valid arguments for every declared tool. Extra keys are stripped by zod. */
const TOOL_ARGUMENTS: Record<string, Record<string, unknown>> = {
    // Read tools
    'get-article': { title: 'Test Page' },
    'get-article-with-lineno': { title: 'Test Page' },
    'get-article-by-revision': { revision: REVID },
    'get-article-info': { title: 'Test Page' },
    'get-article-revisions': { title: 'Test Page' },
    'get-article-categories': { title: 'Test Page' },
    'get-article-properties': { title: 'Test Page' },
    'get-articles': { titles: ['Test Page'] },
    search: { keyword: 'Test' },
    'get-pages-in-category': { category: 'Test Category' },
    'get-categories': {},
    'get-users': { prefix: 'Test' },
    'get-all-pages': {},
    'get-pages-in-namespace': { namespace: 0 },
    'get-pages-by-prefix': { prefix: 'Test' },
    'get-pages-transcluding': { template: 'Template:Test' },
    'get-user-contribs': { username: 'TestUser' },
    whoami: {},
    whois: { username: 'TestUser' },
    whoare: { usernames: ['TestUser'] },
    'get-images': {},
    'get-images-from-article': { title: 'Test Page' },
    'get-image-usage': { filename: 'Test.png' },
    'get-image-info': { filename: 'Test.png' },
    'get-log': { type: 'delete' },
    'expand-templates': { text: 'Hello {{test}}' },
    parse: { text: 'Hello' },
    'get-recent-changes': {},
    'get-site-info': { properties: ['general'] },
    'get-site-stats': {},
    'get-mediawiki-version': {},
    'get-query-page': { name: 'Ancientpages' },
    'get-external-links': { title: 'Test Page' },
    'get-backlinks': { title: 'Test Page' },
    'get-module-source': { title: 'Module:Test' },
    'diff-revisions': { title: 'Test Page' },
    'diff-preview': { title: 'Test Page', content: 'New full page content' },

    // Write tools (read guard is satisfied by seeding read state below).
    // revert runs BEFORE write/edit: it no longer re-seeds the read record
    // with its own revision, so tools that run after a markAsWritten write
    // would see a CAS mismatch against the fake page's static lastrevid.
    revert: { title: 'Test Page', revid: 99, summary: 'test revert' },
    write: { title: 'Test Page', content: 'Full replacement content', intent: 'revise', summary: 'test write' },
    edit: { title: 'Test Page', old_lines: CONTENT.trimEnd(), new_lines: 'Replaced content', summary: 'test edit' },
    append: { title: 'Test Page', content: 'Appended', summary: 'test append' },
    prepend: { title: 'Test Page', content: 'Prepended', summary: 'test prepend' },
    move: { from: 'Test Page', to: 'Moved Page', summary: 'test move' },
    delete: { title: 'Test Page', reason: 'test delete' },
    protect: { title: 'Test Page', protections: [{ type: 'edit', level: 'sysop' }], reason: 'test protect' },
    purge: { titles: ['Test Page'] },
    'send-email': { username: 'TestUser', subject: 'Hi', text: 'Body' },
    upload: { filename: 'Test.png', content: Buffer.from('fake png').toString('base64'), comment: 'test upload' },
    'upload-by-url': { filename: 'Test.png', url: 'https://example.com/Test.png' },
    'add-flow-topic': { title: 'Talk:Test Page', subject: 'Hello', content: 'World' },
    'create-account': { username: 'NewUser', password: 'secret123' },
    block: { username: 'Vandal', reason: 'test block' },
    unblock: { username: 'Vandal', reason: 'test unblock' },
    undelete: { title: 'Test Page', reason: 'test undelete' },
};

describe('tool smoke tests (offline fake bot)', () => {
    const client = new Client({ name: 'vitest-client', version: '0.0.0' });
    let server: McpServer;
    let close: () => Promise<void>;

    beforeAll(async () => {
        markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');

        server = new McpServer({ name: 'test-server', version: '0.0.0' }, { capabilities: { tools: {} } });
        registerAllTools(server);
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
        close = async () => {
            await client.close();
            await server.close();
        };
    });

    afterAll(async () => {
        clearReadState();
        await close();
    });

    it('exposes every declared tool over MCP', async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name).sort();
        expect(names.length).toBe(Object.keys(TOOL_ARGUMENTS).length);
        for (const name of Object.keys(TOOL_ARGUMENTS)) {
            expect(names, `${name} should be registered`).toContain(name);
        }
    });

    for (const [name, args] of Object.entries(TOOL_ARGUMENTS)) {
        it(`handles ${name}`, async () => {
            const result = await client.callTool({ name, arguments: args });
            expect(result.content, `${name} must return content`).toBeTruthy();
            const textParts = (result.content as Array<{ type: string; text?: string }>).filter(
                (p) => p.type === 'text'
            );
            expect(textParts.length, `${name} must return a text part`).toBeGreaterThan(0);
            // Validation errors would show up as isError results — a handler
            // failing on the canned bot data is a bug worth surfacing here.
            expect(result.isError, `${name} errored: ${JSON.stringify(textParts[0])}`).toBeFalsy();
        });
    }

    // Reads/writes must record the revision timestamp so the next save on the
    // page carries basetimestamp (MediaWiki's base-revision conflict check).
    describe('read-state timestamps propagate to the conflict guard', () => {
        const cases: Array<[string, Record<string, unknown>, string]> = [
            ['get-module-source', { title: 'Module:Test' }, '2026-09-01T00:00:00Z'],
            ['get-articles', { titles: ['Test Page'] }, '2026-09-01T00:00:00Z'],
        ];

        for (const [name, args, expectedTimestamp] of cases) {
            it(`${name} records a revision timestamp`, async () => {
                await client.callTool({ name, arguments: args });
                const params = conflictGuardParams(PAGE_ID);
                expect(params, `${name} must leave a read record for pageid ${PAGE_ID}`).toHaveProperty('starttimestamp');
                expect(params.basetimestamp, `${name} must record the revision timestamp`).toBe(expectedTimestamp);
            });
        }

        // A revert is a WRITE, not a read: it must not re-seed the session's
        // read evidence with its own output revision (that would let a
        // follow-up write skip the staleness CAS on never-re-read content).
        it('revert does not re-certify the read record with its own revision', async () => {
            markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');
            await client.callTool({ name: 'revert', arguments: { title: 'Test Page', revid: 99, summary: 'test revert' } });
            const params = conflictGuardParams(PAGE_ID);
            expect(params.basetimestamp, 'revert must leave the pre-revert read record untouched')
                .toBe('2026-09-01T00:00:00Z');
        });
    });
});

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

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerAllTools } from '../index.js';
import { clearReadState, markAsRead, markAsWritten } from '../../common/pageState.js';
import {
    CONTENT,
    PAGE_ID,
    REVID,
    setFakePageContent,
    setFakePageMissing,
    setFakeLastrevid,
    setFakeHistoricalContent,
} from './fakeNodemwBot.js';

vi.mock('../../common/nodemwBot.js', async () => {
    const { createNodemwBotMock } = await import('./fakeNodemwBot.js');
    return createNodemwBotMock();
});

// Spy on markAsWritten so tests can assert that revert does NOT re-seed the
// session's read evidence (the actual implementation still runs).
vi.mock('../../common/pageState.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../common/pageState.js')>();
    return { ...actual, markAsWritten: vi.fn(actual.markAsWritten) };
});

interface ToolOutcome {
    isError: boolean;
    text: string;
}

describe('read-before-write guard hardening (offline fake bot)', () => {
    const client = new Client({ name: 'vitest-client', version: '0.0.0' });
    let server: McpServer;
    let close: () => Promise<void>;

    const markAsWrittenMock = vi.mocked(markAsWritten);

    beforeAll(async () => {
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

    afterEach(() => {
        setFakePageContent(CONTENT);
        setFakeHistoricalContent(CONTENT);
        setFakeLastrevid(REVID);
        setFakePageMissing(false);
        clearReadState();
        markAsWrittenMock.mockClear();
    });

    async function call(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
        const result = await client.callTool({ name, arguments: args });
        const parts = (result.content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === 'text');
        return {
            isError: !!result.isError,
            text: parts.map((p) => p.text ?? '').join('\n'),
        };
    }

    describe('partial reads must not unlock writes', () => {
        it('get-article with an out-of-range offset records no read state', async () => {
            await call('get-article', { title: 'Test Page', offset: 999_999 });
            const write = await call('write', { title: 'Test Page', content: 'x', intent: 'add', summary: 's' });
            expect(write.isError).toBe(true);
            expect(write.text).toContain('has NOT been read');
        });

        it('get-article with a truncating maxlen records no read state', async () => {
            await call('get-article', { title: 'Test Page', maxlen: 1 });
            const write = await call('write', { title: 'Test Page', content: 'x', intent: 'add', summary: 's' });
            expect(write.isError).toBe(true);
            expect(write.text).toContain('has NOT been read');
        });

        it('get-article with a revision parameter records no read state', async () => {
            await call('get-article', { title: 'Test Page', revision: 99 });
            const write = await call('write', { title: 'Test Page', content: 'x', intent: 'add', summary: 's' });
            expect(write.isError).toBe(true);
            expect(write.text).toContain('has NOT been read');
        });

        it('get-article-with-lineno with a line limit records no read state', async () => {
            await call('get-article-with-lineno', { title: 'Test Page', limit: 1 });
            const write = await call('write', { title: 'Test Page', content: 'x', intent: 'add', summary: 's' });
            expect(write.isError).toBe(true);
            expect(write.text).toContain('has NOT been read');
        });

        it('get-article-with-lineno with a truncating maxlen records no read state', async () => {
            await call('get-article-with-lineno', { title: 'Test Page', maxlen: 2 });
            const write = await call('write', { title: 'Test Page', content: 'x', intent: 'add', summary: 's' });
            expect(write.isError).toBe(true);
            expect(write.text).toContain('has NOT been read');
        });

        it('a full get-article still unlocks writes', async () => {
            const read = await call('get-article', { title: 'Test Page' });
            expect(read.isError).toBe(false);
            const write = await call('write', { title: 'Test Page', content: 'Full replacement content', intent: 'revise', summary: 's' });
            expect(write.isError, write.text).toBe(false);
        });
    });

    describe('title rebinding (stale writeCache)', () => {
        it('requireRead rejects a title that now resolves to a different page', async () => {
            markAsWritten('Test Page', 999, 50); // session wrote pageid 999
            const write = await call('write', { title: 'Test Page', content: 'x', intent: 'add', summary: 's' });
            expect(write.isError).toBe(true);
            expect(write.text).toContain('moved or recreated');
        });

        it('requireRead rejects re-creating a title deleted out-of-session', async () => {
            markAsWritten('Test Page', PAGE_ID, REVID);
            setFakePageMissing(true);
            const write = await call('write', { title: 'Test Page', content: 'recreated', intent: 'add', summary: 's' });
            expect(write.isError).toBe(true);
            expect(write.text).toContain('no longer exists');
        });
    });

    describe('revert hardening', () => {
        it('refuses when the page changed since the session read it (CAS)', async () => {
            markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');
            setFakeLastrevid(105);
            const revert = await call('revert', { title: 'Test Page', revid: 99, summary: 's' });
            expect(revert.isError).toBe(true);
            expect(revert.text).toContain('Page was modified');
        });

        it('refuses a near-total-wipe restore (below 1/10 of current size)', async () => {
            markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');
            setFakePageContent('A'.repeat(3000));
            setFakeHistoricalContent('stub');
            const revert = await call('revert', { title: 'Test Page', revid: 99, summary: 's' });
            expect(revert.isError).toBe(true);
            expect(revert.text).toContain('accidental page wipe');
        });

        it('does not re-seed the read evidence with its own write output', async () => {
            markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');
            const revert = await call('revert', { title: 'Test Page', revid: 99, summary: 's' });
            expect(revert.isError, revert.text).toBe(false);
            expect(markAsWrittenMock).not.toHaveBeenCalled();
            // A follow-up write still passes the CAS (read record untouched,
            // page unchanged) — but the guard state was not laundered.
        });

        it('still marks writes as written for ordinary content tools', async () => {
            markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');
            await call('edit', { title: 'Test Page', old_lines: 'Test content', new_lines: 'Edited', summary: 's' });
            expect(markAsWrittenMock).toHaveBeenCalled();
        });
    });

    describe('edit hardening', () => {
        it('refuses a splice that collapses the page below 1/10 of its size', async () => {
            markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');
            setFakePageContent('B'.repeat(3000));
            const edit = await call('edit', { title: 'Test Page', old_lines: 'B'.repeat(3000), new_lines: '', summary: 's' });
            expect(edit.isError).toBe(true);
            expect(edit.text).toContain('accidental page wipe');
        });

        it('still allows small deletions', async () => {
            markAsRead(PAGE_ID, REVID, '2026-09-01T00:00:00Z');
            setFakePageContent('A'.repeat(2990) + 'UNIQUEEND');
            const edit = await call('edit', { title: 'Test Page', old_lines: 'UNIQUEEND', new_lines: '', summary: 's' });
            expect(edit.isError, edit.text).toBe(false);
        });
    });
});

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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isPrivateAddress, assertSafeFetchUrl, fetchSourceSafely, MAX_SOURCE_BYTES } from '../safeFetch.js';

// DNS resolution is controlled per test: default resolves every hostname to
// a public address.
const lookupMock = vi.hoisted(() =>
    vi.fn(async () => [{ address: '93.184.216.34', family: 4 }])
);
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }));

describe('isPrivateAddress', () => {
    it('flags IPv4 private/reserved ranges', () => {
        expect(isPrivateAddress('10.0.0.1')).toBe(true);
        expect(isPrivateAddress('127.0.0.1')).toBe(true);
        expect(isPrivateAddress('0.1.2.3')).toBe(true);
        expect(isPrivateAddress('100.64.0.1')).toBe(true);
        expect(isPrivateAddress('100.127.255.254')).toBe(true);
        expect(isPrivateAddress('169.254.169.254')).toBe(true); // cloud metadata
        expect(isPrivateAddress('172.16.0.1')).toBe(true);
        expect(isPrivateAddress('172.31.255.254')).toBe(true);
        expect(isPrivateAddress('192.168.1.1')).toBe(true);
    });

    it('accepts public IPv4', () => {
        expect(isPrivateAddress('8.8.8.8')).toBe(false);
        expect(isPrivateAddress('93.184.216.34')).toBe(false);
        expect(isPrivateAddress('172.32.0.1')).toBe(false);
        expect(isPrivateAddress('100.128.0.1')).toBe(false);
        expect(isPrivateAddress('172.15.255.255')).toBe(false);
    });

    it('refuses malformed IPv4 literals', () => {
        expect(isPrivateAddress('999.1.1.1')).toBe(true);
        expect(isPrivateAddress('1.2.3')).toBe(true);
        expect(isPrivateAddress('not-an-ip')).toBe(true);
    });

    it('flags IPv6 loopback, ULA and link-local (incl. IPv4-mapped)', () => {
        expect(isPrivateAddress('::')).toBe(true);
        expect(isPrivateAddress('::1')).toBe(true);
        expect(isPrivateAddress('fd00::1')).toBe(true);
        expect(isPrivateAddress('fc00::abcd')).toBe(true);
        expect(isPrivateAddress('fe80::1')).toBe(true);
        expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
        expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
    });

    it('accepts public IPv6', () => {
        expect(isPrivateAddress('2001:db8::1')).toBe(false);
        expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
    });
});

describe('assertSafeFetchUrl', () => {
    it('rejects non-http(s) schemes', async () => {
        await expect(assertSafeFetchUrl('file:///etc/passwd')).rejects.toThrow(/scheme/i);
        await expect(assertSafeFetchUrl('ftp://example.com/x')).rejects.toThrow(/scheme/i);
    });

    it('rejects localhost names and the unix pseudo-host', async () => {
        await expect(assertSafeFetchUrl('http://localhost/x')).rejects.toThrow(/local target/i);
        await expect(assertSafeFetchUrl('http://api.localhost/x')).rejects.toThrow(/local target/i);
        await expect(assertSafeFetchUrl('http://unix:/var/run/docker.sock:/containers/json')).rejects.toThrow(/local target/i);
    });

    it('rejects direct private IP literals', async () => {
        await expect(assertSafeFetchUrl('http://127.0.0.1:8080/')).rejects.toThrow(/private\/reserved/i);
        await expect(assertSafeFetchUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/private\/reserved/i);
        await expect(assertSafeFetchUrl('http://[::1]:9000/')).rejects.toThrow(/private\/reserved/i);
    });

    it('rejects hostnames that resolve to a private address', async () => {
        lookupMock.mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }]);
        await expect(assertSafeFetchUrl('https://internal.example/')).rejects.toThrow(/resolves to a private/i);
    });

    it('accepts public http(s) URLs', async () => {
        await expect(assertSafeFetchUrl('https://example.com/Test.png')).resolves.toBeUndefined();
        await expect(assertSafeFetchUrl('http://example.com:8080/x')).resolves.toBeUndefined();
    });
});

describe('fetchSourceSafely', () => {
    const realFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = realFetch;
        lookupMock.mockReset();
        lookupMock.mockImplementation(async () => [{ address: '93.184.216.34', family: 4 }]);
    });

    function respond(status: number, headers: Record<string, string> = {}, body: Iterable<Uint8Array> = []): Response {
        return {
            status,
            headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
            body,
        } as unknown as Response;
    }

    it('returns the body buffer for a plain 200', async () => {
        globalThis.fetch = vi.fn(async () =>
            respond(200, {}, [new Uint8Array([1, 2, 3]), new Uint8Array([4])])
        );
        const buf = await fetchSourceSafely('https://example.com/a.png');
        expect(Buffer.from(buf).toString('hex')).toBe('01020304');
    });

    it('follows public redirects hop by hop', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(respond(302, { location: 'https://cdn.example.org/b.png' }))
            .mockResolvedValueOnce(respond(200, {}, [new Uint8Array([9])]));
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        const buf = await fetchSourceSafely('https://example.com/a.png');
        expect(Buffer.from(buf)[0]).toBe(9);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('refuses a redirect that pivots to a private address', async () => {
        globalThis.fetch = vi.fn(async () =>
            respond(302, { location: 'http://169.254.169.254/latest/meta-data/' })
        );
        await expect(fetchSourceSafely('https://example.com/a.png')).rejects.toThrow(/private\/reserved/i);
    });

    it('refuses a redirect that pivots to the unix pseudo-host', async () => {
        globalThis.fetch = vi.fn(async () =>
            respond(302, { location: 'http://unix:/var/run/docker.sock:/info' })
        );
        await expect(fetchSourceSafely('https://example.com/a.png')).rejects.toThrow(/local target/i);
    });

    it('refuses non-200 responses', async () => {
        globalThis.fetch = vi.fn(async () => respond(403));
        await expect(fetchSourceSafely('https://example.com/a.png')).rejects.toThrow(/HTTP status 403/);
    });

    it('caps the download size', async () => {
        const bigChunk = new Uint8Array(10 * 1024 * 1024); // 10 MiB
        function* endless(): Generator<Uint8Array> {
            while (true) {
                yield bigChunk;
            }
        }
        globalThis.fetch = vi.fn(async () => respond(200, {}, endless()));
        await expect(fetchSourceSafely('https://example.com/huge.bin')).rejects.toThrow(/download limit/);
        expect(MAX_SOURCE_BYTES).toBe(50 * 1024 * 1024);
    });
});

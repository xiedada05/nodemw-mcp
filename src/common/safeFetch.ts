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

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/** Hard bounds for source downloads: size, wall-clock time, redirect hops. */
export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const SOURCE_USER_AGENT = 'nodemw-mcp-server (upload-by-url)';

/**
 * True for local/private/reserved targets: IPv4 loopback, RFC1918, CGNAT,
 * link-local (incl. cloud metadata 169.254.169.254) and this-network; IPv6
 * unspecified, loopback, ULA and link-local, plus IPv4-mapped forms.
 * A string that is not a well-formed IPv4 literal is treated as private
 * (refuse rather than guess).
 */
export function isPrivateAddress(address: string): boolean {
    if (isIP(address) === 6) {
        const a = address.toLowerCase();
        return a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') ||
            a.startsWith('fe80') || (a.startsWith('::ffff:') && isPrivateAddress(a.slice(7)));
    }
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
        return true; // not a well-formed IPv4 literal — refuse
    }
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||   // CGNAT 100.64/10
        (a === 169 && b === 254) ||             // link-local / cloud metadata
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168);
}

/**
 * Reject non-http(s) schemes, the @cypress/request `unix` pseudo-host,
 * localhost names and private/reserved addresses (direct IP literals and
 * hostnames resolving to any private address).
 */
export async function assertSafeFetchUrl(rawUrl: string): Promise<void> {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error(`Invalid source URL: ${rawUrl}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported source URL scheme: ${parsed.protocol} (only http/https)`);
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === 'unix' || host.endsWith('.localhost')) {
        throw new Error(`Refusing to fetch from local target: ${host}`);
    }
    if (isIP(host) !== 0) {
        if (isPrivateAddress(host)) {
            throw new Error(`Refusing to fetch from private/reserved address: ${host}`);
        }
        return;
    }
    const addresses = await lookup(host, { all: true });
    if (addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new Error(`Refusing to fetch: ${host} resolves to a private/reserved address`);
    }
}

/**
 * Fetch a source URL with hard safety bounds:
 * - public http(s) targets only, re-validated on EVERY redirect hop
 *   (a public URL must not be able to pivot to localhost, a unix-socket
 *   pseudo-host or an internal address via a 302);
 * - a wall-clock deadline (AbortController plus an explicit elapsed check
 *   in the body loop — Node 18's undici does not reliably abort mid-body);
 * - a hard byte cap so an endless stream cannot grow the process to OOM;
 * - no cookie jar, no proxy passthrough, no wiki session credentials.
 */
export async function fetchSourceSafely(rawUrl: string): Promise<Buffer> {
    const deadline = Date.now() + FETCH_TIMEOUT_MS;
    let current = rawUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertSafeFetchUrl(current);

        let response: Response;
        try {
            response = await fetch(current, {
                redirect: 'manual',
                signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)),
                headers: { 'User-Agent': SOURCE_USER_AGENT }
            });
        } catch (error) {
            throw new Error(`Failed to fetch <${current}>: ${(error as Error).message}`);
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) {
                throw new Error(`HTTP status ${response.status} without Location`);
            }
            current = new URL(location, current).toString();
            continue;
        }
        if (response.status !== 200 || !response.body) {
            throw new Error(`HTTP status ${response.status}`);
        }

        const chunks: Uint8Array[] = [];
        let total = 0;
        const body = response.body;
        const cancelBody = async (): Promise<void> => {
            try {
                await body.cancel();
            } catch {
                // best-effort: the socket close is the resource that matters
            }
        };
        for await (const chunk of body) {
            total += chunk.byteLength;
            if (total > MAX_SOURCE_BYTES) {
                await cancelBody();
                throw new Error(`Source exceeds the ${MAX_SOURCE_BYTES / (1024 * 1024)} MB download limit`);
            }
            if (Date.now() > deadline) {
                await cancelBody();
                throw new Error(`Fetch from <${current}> exceeded ${FETCH_TIMEOUT_MS / 1000}s`);
            }
            chunks.push(chunk);
        }
        return Buffer.concat(chunks.map((c) => Buffer.from(c)));
    }
    throw new Error(`Too many redirects (more than ${MAX_REDIRECTS})`);
}

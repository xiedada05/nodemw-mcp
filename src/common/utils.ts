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

import type Bot from 'nodemw';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Promisify nodemw's low-level api.call().
 *
 * nodemw's api.call callback is 4-arg: (err, info, next, data).
 * - info  = data[actionName] or data.query (unwrapped)
 * - data  = the full raw JSON response (has query, continue, error keys)
 *
 * This helper resolves with `data` (the 4th arg) so callers always
 * get the raw response with correct query / continue / error topology.
 */
export function callApi<T = Record<string, unknown>>(
    bot: Bot,
    params: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET'
): Promise<T> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bot as any).api.call(
            params,
            (_err: Error | null, _info: unknown, _next: unknown, data: T) => {
                if (_err) reject(_err);
                else resolve(data);
            },
            method
        );
    });
}

export function promisifyBotMethod<T>(
    bot: Bot,
    method: string,
    ...args: unknown[]
): Promise<T> {
    return new Promise( ( resolve, reject ) => {
        const callback = ( err: Error | null, result: T ) => {
            if ( err ) {
                reject( err );
            } else {
                resolve( result );
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ( bot as any )[ method ]( ...args, callback );
    } );
}

export function isNonNullish<T>(
    value: T | null | undefined
): value is T {
    return value !== null && value !== undefined;
}

export function jsonResult(data: unknown): CallToolResult {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2)
        }],
        structuredContent: data as Record<string, unknown>
    };
}

// Error messages MediaWiki returns when the session cookie has expired and
// the request fell back to anonymous — often misread as a permission problem.
const LOGIN_EXPIRED_PATTERNS = [
    /You're not allowed to edit this wiki through the API/,
    /not logged in/i,
    /login required/i,
    /assertuserfailed/i,
];

/** Append a hint when an error smells like a silently expired session. */
function annotateLoginError(message: string, error?: Error): string {
    const details = error?.message ?? '';
    if (LOGIN_EXPIRED_PATTERNS.some((re) => re.test(message) || re.test(details))) {
        return details
            ? `${details} — your login session has likely expired. Reconnect via /mcp to log in again.`
            : message;
    }
    return details;
}

export function errorResult(message: string, error?: Error): CallToolResult {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                error: message,
                details: annotateLoginError(message, error)
            }, null, 2)
        }],
        isError: true
    };
}

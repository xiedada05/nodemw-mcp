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

import Bot from 'nodemw';
import { DEFAULT_USER_AGENT } from '../server.js';

export interface ServerConfig {
    server: string;
    path: string;
    protocol?: string;
    port?: number;
    proxy?: string;
    userAgent?: string;
    userAgentAppend?: boolean;
    concurrency?: number;
    debug?: boolean;
    username?: string;
    password?: string;
    token?: string;
    domain?: string;
    dryRun?: boolean;
}

let botInstance: Bot | null = null;
let serverConfig: ServerConfig | null = null;
let authenticated = false;

export interface WhoamiUser {
    id?: number;
    name?: string;
    anon?: boolean;
    groups?: string[];
    rights?: string[];
}

export interface WhoamiResult {
    userinfo?: WhoamiUser;
}

/**
 * Query the wiki for the current session's user info.
 * An anonymous (logged-out) session returns an anonymous userinfo,
 * and an expired/invalid session returns an error.
 */
export function fetchWhoami(bot: Bot): Promise<WhoamiResult> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bot as any).api.call(
            { action: 'query', meta: 'userinfo', uiprop: 'groups|rights' },
            (err: Error | null, _info: unknown, _next: unknown, data: WhoamiResult) => {
                if (err) reject(err);
                else resolve(data);
            },
            'GET'
        );
    });
}

/**
 * Detect whether the current session is logged in.
 * Anonymous sessions report anon=true with id 0; a session that silently
 * dropped to anonymous (e.g. expired cookie) shows the same shape.
 */
export function isWhoamiAuthenticated(whoami: WhoamiResult): boolean {
    const u = whoami?.userinfo;
    return !!u && u.id != null && u.id > 0 && !u.anon;
}

let heartbeatTimer: NodeJS.Timeout | null = null;

/** Start a periodic login-alive check. On drop, `onDisconnect` fires once. */
export function startLoginHeartbeat(onDisconnect: () => void): void {
    stopLoginHeartbeat();
    heartbeatTimer = setInterval(() => {
        const bot = botInstance;
        if (!bot) return;
        fetchWhoami(bot)
            .then((whoami) => {
                if (authenticated && !isWhoamiAuthenticated(whoami)) {
                    authenticated = false;
                    onDisconnect();
                }
            })
            .catch(() => {
                // Transient network/API errors are NOT login loss — keep the
                // session state as-is and let the next beat re-check.
            });
    }, 60_000);
    // Do not block process exit
    heartbeatTimer.unref();
}

export function stopLoginHeartbeat(): void {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

export function initServerConfig(config: ServerConfig): void {
    serverConfig = config;
}

export function getServerConfig(): ServerConfig | null {
    return serverConfig;
}

function createBotFromConfig(config: ServerConfig): Bot {
    const {
        server,
        path,
        protocol,
        port,
        proxy,
        userAgent,
        userAgentAppend,
        concurrency,
        debug,
        username,
        password,
        domain,
        dryRun
    } = config;

    let resolvedUA: string;
    if (userAgent && userAgentAppend) {
        resolvedUA = DEFAULT_USER_AGENT + ' ' + userAgent;
    } else if (userAgent) {
        resolvedUA = userAgent;
    } else {
        resolvedUA = DEFAULT_USER_AGENT;
    }

    return new Bot({
        server,
        protocol: protocol || 'https',
        port,
        path,
        proxy,
        userAgent: resolvedUA,
        concurrency,
        debug,
        username: username || undefined,
        password: password || undefined,
        domain,
        // @ts-expect-error: dryRun is supported by nodemw at runtime but missing from BotOptions types
        dryRun
    });
}

async function testApiConnection(bot: Bot): Promise<boolean> {
    try {
        await promisifyBotMethod(bot, 'getSiteInfo', ['general']);
        return true;
    } catch {
        return false;
    }
}

export async function autoDetectPath(baseConfig: ServerConfig): Promise<string> {
    // nodemw constructs URL as ${server}${path}/api.php — so /w means /w/api.php, '' means /api.php
    const pathsToTry = ['/w', ''];
    for (const path of pathsToTry) {
        const testConfig = { ...baseConfig, path };
        const bot = createBotFromConfig(testConfig);
        if (await testApiConnection(bot)) {
            return path;
        }
    }
    throw new Error(
        'Could not auto-detect MediaWiki API path. ' +
        'Tried /w/api.php and /api.php. ' +
        'Please specify --path explicitly (e.g., --path /w or --path "" for root).'
    );
}

export async function initBot(config: ServerConfig): Promise<Bot> {
    botInstance = createBotFromConfig(config);

    const { username, password } = config;
    if (username && password) {
        await new Promise<void>((resolve, reject) => {
            botInstance!.logIn((err: Error | null) => {
                if (err) {
                    reject(new Error(`Login failed for user '${username}': ${err.message}`));
                } else {
                    authenticated = true;
                    resolve();
                }
            });
        });
    }

    return botInstance;
}

export function getBot(): Bot {
    if (!botInstance) {
        throw new Error('Bot not initialized. Server must be started first.');
    }
    return botInstance;
}

export function clearBotCache(): void {
    botInstance = null;
    authenticated = false;
}

let mediaWikiVersion: string | null = null;

export function setMediaWikiVersion(version: string): void {
    mediaWikiVersion = version;
}

/** Return the major+minor version as a number, e.g. 1.23 → 1.23, 1.43 → 1.43 */
export function getMediaWikiVersion(): number | null {
    if (!mediaWikiVersion) return null;
    const m = mediaWikiVersion.match(/^(\d+)\.(\d+)/);
    if (!m) return null;
    return parseFloat(m[1] + '.' + m[2]);
}

export function isAuthenticated(): boolean {
    return authenticated;
}

export function promisifyBotMethod<T>(
    bot: Bot,
    method: string,
    ...args: unknown[]
): Promise<T> {
    return new Promise((resolve, reject) => {
        const callback = (err: Error | null, result: T) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bot as any)[method](...args, callback);
    });
}

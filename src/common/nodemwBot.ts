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
import { USER_AGENT } from '../server.js';

export interface ServerConfig {
    server: string;
    path: string;
    protocol?: string;
    port?: number;
    proxy?: string;
    userAgent?: string;
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

export function initServerConfig(config: ServerConfig): void {
    serverConfig = config;
}

function createBotFromConfig(config: ServerConfig): Bot {
    const {
        server,
        path,
        protocol,
        port,
        proxy,
        userAgent,
        concurrency,
        debug,
        username,
        password,
        domain,
        dryRun
    } = config;

    return new Bot({
        server,
        protocol: protocol || 'https',
        port,
        path,
        proxy,
        userAgent: userAgent || USER_AGENT,
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

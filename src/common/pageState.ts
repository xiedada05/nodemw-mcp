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

import { getBot, promisifyBotMethod } from './nodemwBot.js';

/** Tracks (pageid, revid) pairs for pages whose content has been read. */
const readState = new Map<number, number>();

/**
 * Write cache: tracks pages that were just written in this session.
 * Keyed by title so requireRead() can skip the API call entirely.
 */
const writeCache = new Map<string, { pageid: number; revid: number }>();

interface PageInfo {
    pageid?: number;
    ns?: number;
    title?: string;
    lastrevid?: number;
    missing?: boolean;
}

interface ArticleInfoResult {
    title?: string;
    results?: PageInfo[];
}

export function markAsRead(pageid: number, revid: number): void {
    readState.set(pageid, revid);
}

/**
 * Mark a page as both written and read in this session.
 * Call this after a successful write/edit/append/prepend so that
 * subsequent requireRead() calls skip the API round-trip.
 */
export function markAsWritten(title: string, pageid: number, revid: number): void {
    markAsRead(pageid, revid);
    writeCache.set(title, { pageid, revid });
}

export function isRead(pageid: number): boolean {
    return readState.has(pageid);
}

/**
 * Resolves a page title to its pageid via API, then checks whether the page
 * has been read (via get-article or another content-reading tool).
 * Throws if the page exists but has NOT been read, forcing the agent to
 * fetch current content before making any edits.
 */
export async function requireRead(title: string): Promise<number> {
    // Check write cache first: pages just written in this session are
    // already "read" and don't need an API round-trip.
    const cached = writeCache.get(title);
    if (cached) {
        return cached.pageid;
    }

    const bot = getBot();
    const pages = await promisifyBotMethod<PageInfo[]>(
        bot,
        'getArticleInfo',
        title,
        { prop: 'info' }
    );

    if (!Array.isArray(pages) || pages.length === 0) {
        return 0;
    }

    const page = pages[0];
    if (!page || page.missing) {
        // Page does not exist — allow creation
        return 0;
    }

    if (page.pageid != null && page.lastrevid != null) {
        if (!isRead(page.pageid)) {
            throw new Error(
                `Page "${title}" (pageid ${page.pageid}) has NOT been read. ` +
                `You MUST call get-article or get-article-with-lineno first to fetch the current page content before editing. ` +
                `This is a safety requirement to prevent accidental data loss.`
            );
        }
    }

    return page.pageid ?? 0;
}

export function clearReadState(): void {
    readState.clear();
    writeCache.clear();
}

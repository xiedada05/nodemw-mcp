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

interface PageInfo {
    pageid?: number;
    ns?: number;
    title?: string;
    lastrevid?: number;
    missing?: boolean;
}

export function markAsRead(pageid: number, revid: number): void {
    readState.set(pageid, revid);
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
    const bot = getBot();
    const info = await promisifyBotMethod<{ query?: { pages?: Record<string, PageInfo> } }>(
        bot,
        'getArticleInfo',
        title,
        { prop: 'info' }
    );

    const pages = info?.query?.pages;
    if (!pages) {
        // Can't verify — allow through but warn via low-confidence
        return 0;
    }

    const page = Object.values(pages)[0];
    if (!page || page.missing) {
        // Page does not exist — allow creation
        return 0;
    }

    if (page.pageid != null && page.lastrevid != null) {
        if (!isRead(page.pageid)) {
            throw new Error(
                `Page "${title}" (pageid ${page.pageid}) has NOT been read. ` +
                `You MUST call get-article first to fetch the current page content before editing. ` +
                `This is a safety requirement to prevent accidental data loss.`
            );
        }
    }

    return page.pageid ?? 0;
}

export function clearReadState(): void {
    readState.clear();
}

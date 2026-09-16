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
import { callApi } from './utils.js';

/**
 * Tracks pages whose content has been read, with the moment of reading and
 * the revision that was seen. The revision timestamp (revTimestamp) powers
 * MediaWiki's own edit-conflict detection (basetimestamp); readAt is the
 * session-side fallback (starttimestamp).
 */
interface ReadRecord {
    revid: number;
    revTimestamp?: string;
    readAt: Date;
}
const readState = new Map<number, ReadRecord>();

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

export function markAsRead(pageid: number, revid: number, revTimestamp?: string): void {
    readState.set(pageid, { revid, revTimestamp, readAt: new Date() });
}

/**
 * Record read state straight from the API: resolves the page's current
 * revision (id + timestamp) and marks it as read. Best-effort — failures are
 * swallowed because the read guard then just falls back to its strict mode.
 */
export async function recordReadFromApi(identifier: string | number): Promise<void> {
    try {
        const bot = getBot();
        const raw = await callApi<{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query?: { pages?: Record<string, any> };
        }>(bot, {
            action: 'query',
            prop: 'revisions',
            rvprop: 'ids|timestamp',
            rvlimit: 1,
            ...(typeof identifier === 'number' ? { pageids: identifier } : { titles: identifier }),
        }, 'GET');

        const pages = Object.values(raw.query?.pages ?? {});
        const page = pages.find(p => p.missing === undefined) as PageInfo & {
            revisions?: Array<{ revid?: number; timestamp?: string }>;
        } | undefined;
        const rev = page?.revisions?.[0];
        if (page?.pageid != null && rev?.revid != null) {
            markAsRead(page.pageid, rev.revid, rev.timestamp);
        }
    } catch {
        // Best-effort only — see doc comment.
    }
}

/** When this page's content was last read/written in this session, for edit-conflict detection. */
export function getReadTime(pageid: number): Date | undefined {
    return readState.get(pageid)?.readAt;
}

/** The revision recorded when this session last read the page, if any. */
export function getReadRecord(pageid: number): { revid: number; revTimestamp?: string } | undefined {
    const record = readState.get(pageid);
    return record ? { revid: record.revid, revTimestamp: record.revTimestamp } : undefined;
}

/** Format a date as a MediaWiki API timestamp (ISO 8601, e.g. 2026-09-12T01:58:40Z). */
export function toMwTimestamp(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Extra action=edit params that make the save fail with an edit conflict when
 * the page changed after it was read in this session:
 * - basetimestamp (revision timestamp we saw): MediaWiki's native conflict
 *   check — but note it only fires when the textual changes OVERLAP
 *   (3-way merge); a clean full-page overwrite merges "successfully".
 * - starttimestamp (when we read): catches pages deleted/created mid-edit.
 */
export function conflictGuardParams(pageid: number): Record<string, string> {
    const record = readState.get(pageid);
    if (!record) return {};
    const params: Record<string, string> = { starttimestamp: toMwTimestamp(record.readAt) };
    if (record.revTimestamp) {
        params.basetimestamp = record.revTimestamp;
    }
    return params;
}

/**
 * Hard CAS pre-check for full-page overwrites (the write tool): rejects the
 * edit when the page's latest revision differs from the revision recorded at
 * read time. MediaWiki's native basetimestamp check can't catch this case
 * (a total replacement always 3-way-merges cleanly), so we compare revids
 * ourselves. Returns a rejection message, or null when the write may proceed.
 */
export async function findStaleWrite(title: string, pageid: number): Promise<string | null> {
    const record = readState.get(pageid);
    if (!record || !record.revid) {
        return null; // never read, or page created this session — nothing to compare
    }
    try {
        const bot = getBot();
        const pages = await promisifyBotMethod<PageInfo[]>(bot, 'getArticleInfo', title, { prop: 'info' });
        const page = Array.isArray(pages) ? pages[0] : null;
        if (!page?.lastrevid) {
            return null; // page gone or info unavailable — let MediaWiki decide
        }
        if (page.lastrevid !== record.revid) {
            return (
                `Page was modified after it was read in this session ` +
                `(read revid ${record.revid}, current revid ${page.lastrevid}). ` +
                `Overwrite refused to prevent data loss. ` +
                `Re-read the page with get-article, re-apply your change, then save again.`
            );
        }
    } catch {
        return null; // fail open — MediaWiki's own 3-way merge still applies
    }
    return null;
}

/**
 * Mark a page as both written and read in this session.
 * Call this after a successful write/edit/append/prepend so that
 * subsequent requireRead() calls skip the API round-trip.
 * revTimestamp (the edit's newtimestamp) keeps basetimestamp conflict
 * protection working for follow-up edits.
 */
export function markAsWritten(title: string, pageid: number, revid: number, revTimestamp?: string): void {
    markAsRead(pageid, revid, revTimestamp);
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

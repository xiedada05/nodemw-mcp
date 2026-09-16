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
import { callApi } from './utils.js';

/**
 * Helpers around MediaWiki action=compare.
 *
 * The compare API computes the (wikitext) diff server-side but only returns
 * it rendered as an HTML table fragment (`compare.*`). parseCompareDiff() /
 * formatDiffLines() are a pure format conversion — no diffing happens here.
 * The diff-* class names (diff-lineno, diff-context, diff-deletedline,
 * diff-addedline, diffchange) have been stable across MediaWiki versions and
 * are skin-independent.
 */

export interface CompareDiff {
    /**
     * Line-based diff: '@@ … @@' headers, ' ' context, '-' removed, '+' added.
     * Inline word changes inside changed lines use GNU wdiff / git
     * --word-diff=plain notation: [-removed-] and {+added+}.
     */
    lines: string[];
    /** Count of '+' lines. */
    added: number;
    /** Count of '-' lines. */
    removed: number;
}

// Same entity set as parseOutput.ts, plus numeric references.
const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
    return text
        .replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (e) => ENTITIES[e] ?? e)
        .replace(/&#(\d+);/g, (_, code) => safeCodePoint(parseInt(code, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => safeCodePoint(parseInt(code, 16)));
}

function safeCodePoint(code: number): string {
    if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return '';
    const s = String.fromCodePoint(code);
    return s ? s : '';
}

/**
 * Wrap inline changed fragments in GNU wdiff / git word-diff plain notation:
 * [-removed-] inside deleted lines, {+added+} inside added lines. The diff*
 * element appears in both single- and double-quoted attribute styles across
 * MediaWiki versions.
 */
function markInlineChanges(html: string, direction: 'del' | 'add'): string {
    const open = direction === 'del' ? '[-' : '{+';
    const close = direction === 'del' ? '-]' : '+}';
    return html.replace(
        /<(ins|del|span|div)\b[^>]*class\s*=\s*(?:"[^"]*diffchange[^"]*"|'[^']*diffchange[^']*')[^>]*>([\s\S]*?)<\/\1>/gi,
        `${open}$2${close}`
    );
}

interface DiffCell {
    cls: string;
    html: string;
}

function extractCells(rowHtml: string): DiffCell[] {
    const cells: DiffCell[] = [];
    const re = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(rowHtml)) !== null) {
        const attrs = match[1] ?? '';
        const cls = /class="([^"]*)"/i.exec(attrs)?.[1]
            ?? /class='([^']*)'/i.exec(attrs)?.[1]
            ?? '';
        cells.push({ cls, html: match[2] ?? '' });
    }
    return cells;
}

function cellToText(html: string, direction?: 'del' | 'add'): string {
    const marked = direction ? markInlineChanges(html, direction) : html;
    return decodeEntities(
        marked
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]+>/g, '')
    )
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Convert the compare API's HTML table fragment into line-based diff text.
 * Line-number headers are localized (e.g. "第112行：", "Line 112:") and are
 * passed through verbatim (trailing colon stripped, identical halves
 * deduplicated). Unrecognized rows degrade to their tag-stripped text — this
 * parser never throws.
 */
export function parseCompareDiff(html: string): CompareDiff {
    const lines: string[] = [];
    let added = 0;
    let removed = 0;
    if (!html) return { lines, added, removed };

    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(html)) !== null) {
        const linenos: string[] = [];
        const out: string[] = [];
        let lastContext: string | undefined;

        for (const cell of extractCells(row[1] ?? '')) {
            const { cls } = cell;
            if (/\bdiff-marker\b/.test(cls)) continue; // −/+ marker cells

            if (/\bdiff-deletedline\b/.test(cls)) {
                out.push('-' + cellToText(cell.html, 'del'));
                removed++;
                continue;
            }
            if (/\bdiff-addedline\b/.test(cls)) {
                out.push('+' + cellToText(cell.html, 'add'));
                added++;
                continue;
            }

            const text = cellToText(cell.html);
            if (/\bdiff-lineno\b/.test(cls)) {
                if (text) linenos.push(text);
                continue;
            }
            if (!text) continue; // empty marker/context cells

            if (/\bdiff-context\b/.test(cls) || /\bdiff-side-(?:deleted|added)\b/.test(cls)) {
                // Context appears as a deleted-side/added-side pair with
                // identical content — keep one copy.
                if (text !== lastContext) {
                    out.push(' ' + text);
                    lastContext = text;
                }
            } else {
                out.push(text); // unknown row type — degrade to raw text
            }
        }

        if (linenos.length > 0) {
            const uniq = [...new Set(linenos.map((f) => f.replace(/[:：]\s*$/, '')))];
            out.unshift('@@ ' + uniq.join(' | ') + ' @@');
        }
        lines.push(...out);
    }

    return { lines, added, removed };
}

/**
 * Bound the rendered diff to a character budget (style matches get-article's
 * maxlen truncation). Always keeps at least one line; reports what was cut.
 */
export function formatDiffLines(
    lines: string[],
    maxlen?: number
): { diff: string; truncated: boolean } {
    const full = lines.join('\n');
    if (maxlen === undefined || maxlen <= 0 || full.length <= maxlen) {
        return { diff: full, truncated: false };
    }
    const kept: string[] = [];
    let budget = maxlen;
    for (const line of lines) {
        if (kept.length > 0 && budget - line.length < 0) break;
        kept.push(line);
        budget -= line.length + 1;
    }
    const omitted = lines.length - kept.length;
    return {
        diff: kept.join('\n') + `\n\n[truncated — diff exceeds maxlen; ${omitted} more line(s) omitted]`,
        truncated: true,
    };
}

const RICH_PROP = 'diff|ids|title|user|comment|timestamp';
const MINIMAL_PROP = 'diff';

/**
 * Call action=compare with rich metadata props (user/comment/timestamp are
 * 1.32+); older MediaWiki reject unknown prop values, so fall back to the
 * minimal diff-only request when that happens. Works around nodemw losing
 * the error code by matching the message text.
 */
export async function callCompareApi(
    bot: Bot,
    params: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    try {
        return await callApi(bot, { ...params, prop: RICH_PROP }, method);
    } catch (error) {
        const message = (error as Error).message ?? '';
        if (/unrecognized (?:value for parameter|parameter)[^]*"?prop/i.test(message)) {
            return callApi(bot, { ...params, prop: MINIMAL_PROP }, method);
        }
        throw error;
    }
}

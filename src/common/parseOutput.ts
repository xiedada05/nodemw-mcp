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

/**
 * Heuristic detection of error elements embedded in rendered parser output.
 *
 * Extensions report failures inside the HTML instead of failing the API call:
 * the Widgets extension emits <div class="error">…</div> for widgets that fail
 * to compile, parser functions like #iferror emit <span class="error">, and
 * Scribunto emits <strong class="error">. The API still returns isError=false,
 * so an agent that skims the HTML would silently ship a broken page.
 */

export interface HtmlErrorReport {
    /** Number of error-classed elements found. */
    count: number;
    /** Up to 3 plain-text excerpts of the error content. */
    samples: string[];
}

const ERROR_CLASS_RE = /class="[^"]*\berror[^"]*"/g;
const MAX_SAMPLES = 3;
const SAMPLE_MAX_CHARS = 160;

const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
};

function stripHtml(fragment: string): string {
    return fragment
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e] ?? e);
}

/**
 * Scan rendered HTML for error-classed elements and return a count plus
 * plain-text samples of what went wrong. Pure function, no API access.
 */
export function detectHtmlErrors(html: string): HtmlErrorReport {
    if (!html) {
        return { count: 0, samples: [] };
    }

    const samples: string[] = [];
    let count = 0;

    ERROR_CLASS_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ERROR_CLASS_RE.exec(html)) !== null) {
        count++;
        if (samples.length < MAX_SAMPLES) {
            // Take a window around the match: some context before, the
            // element itself after — then strip tags for a readable excerpt.
            const start = Math.max(0, match.index - 100);
            const chunk = html.slice(start, match.index + 400);
            const text = stripHtml(chunk).replace(/\s+/g, ' ').trim().slice(0, SAMPLE_MAX_CHARS);
            if (text) {
                samples.push(text);
            }
        }
    }

    return { count, samples };
}

/** Render an HtmlErrorReport as warning lines for plain-text tool output. */
export function formatHtmlErrorWarnings(report: HtmlErrorReport): string[] {
    if (report.count === 0) {
        return [];
    }
    const lines = [
        `[parse warning] ${report.count} error element(s) detected in the rendered output:`
    ];
    for (const sample of report.samples) {
        lines.push(`  - ${sample}`);
    }
    if (report.count > report.samples.length) {
        lines.push(`  … and ${report.count - report.samples.length} more`);
    }
    lines.push('The API call itself succeeded — inspect the HTML around these markers before publishing.');
    return lines;
}

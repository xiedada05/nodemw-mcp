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

import { describe, it, expect } from 'vitest';
import { parseCompareDiff, formatDiffLines } from '../compareOutput.js';

// Fixture mirrors a real action=compare response captured from
// zh.minecraft.wiki (MediaWiki 1.43): localized diff-lineno pair,
// context delivered as a deleted-side/added-side pair, and one changed row
// with marker cells plus <ins>/<del class="diffchange diffchange-inline">.
const REAL_STYLE_FIXTURE = '<tr>\n'
    + '  <td colspan="2" class="diff-lineno">第112行：</td>\n'
    + '  <td colspan="2" class="diff-lineno">第112行：</td>\n'
    + '</tr>'
    + '<tr>\n'
    + '  <td class="diff-marker"></td>\n'
    + '  <td class="diff-context diff-side-deleted">=== 附加包 ===</td>\n'
    + '  <td class="diff-marker"></td>\n'
    + '  <td class="diff-context diff-side-added">=== 附加包 ===</td>\n'
    + '</tr>'
    + '<tr>\n'
    + '  <td class="diff-marker" data-marker="−"></td>\n'
    + '  <td class="diff-deletedline">map_icon_BE.<del class="diffchange diffchange-inline">png</del></td>\n'
    + '  <td class="diff-marker" data-marker="+"></td>\n'
    + '  <td class="diff-addedline">map_icon_BE2.<ins class="diffchange diffchange-inline">jpg</ins></td>\n'
    + '</tr>';

describe('parseCompareDiff', () => {
    it('parses the real compare HTML fragment into line-based diff text', () => {
        const result = parseCompareDiff(REAL_STYLE_FIXTURE);
        expect(result.lines).toEqual([
            '@@ 第112行 @@',
            ' === 附加包 ===',
            '-map_icon_BE.[-png-]',
            '+map_icon_BE2.{+jpg+}',
        ]);
        expect(result.added).toBe(1);
        expect(result.removed).toBe(1);
    });

    it('handles the legacy <div class="diffchange"> inline format', () => {
        const result = parseCompareDiff(
            '<tr><td class="diff-marker">−</td>'
            + '<td class="diff-deletedline"><div class="diffchange">old text</div></td>'
            + '<td class="diff-marker">+</td>'
            + '<td class="diff-addedline"><div class="diffchange">new text</div></td></tr>'
        );
        expect(result.lines).toEqual(['-[-old text-]', '+{+new text+}']);
    });

    it('matches single-quoted class attributes (older MediaWiki)', () => {
        const result = parseCompareDiff(
            '<tr><td class=\'diff-marker\'>&#160;</td>'
            + '<td class=\'diff-deletedline\'>keep <div class=\'diffchange\'>word</div></td></tr>'
        );
        expect(result.lines).toEqual(['-keep [-word-]']);
    });

    it('decodes entities after stripping tags', () => {
        const result = parseCompareDiff(
            '<tr><td class="diff-marker" data-marker="+"></td>'
            + '<td class="diff-addedline">use &lt;nowiki&gt; &amp; {{templates}}</td></tr>'
        );
        expect(result.lines).toEqual(['+use <nowiki> & {{templates}}']);
    });

    it('keeps both localized line numbers when they differ', () => {
        const result = parseCompareDiff(
            '<tr><td colspan="2" class="diff-lineno">Line 5:</td>'
            + '<td colspan="2" class="diff-lineno">Line 7:</td></tr>'
            + '<tr><td class="diff-marker" data-marker="-"></td>'
            + '<td class="diff-deletedline">gone</td></tr>'
        );
        expect(result.lines[0]).toBe('@@ Line 5 | Line 7 @@');
        expect(result.lines[1]).toBe('-gone');
        expect(result.removed).toBe(1);
    });

    it('degrades unrecognized rows to their tag-stripped text instead of throwing', () => {
        const result = parseCompareDiff(
            '<tr><td class="diff-somefutureclass">mystery cell</td></tr>'
        );
        expect(result.lines).toEqual(['mystery cell']);
    });

    it('returns empty results for empty and identical diffs', () => {
        expect(parseCompareDiff('')).toEqual({ lines: [], added: 0, removed: 0 });
        expect(parseCompareDiff('<tr><td class="diff-marker"></td>'
            + '<td class="diff-context diff-side-deleted">same</td>'
            + '<td class="diff-marker"></td>'
            + '<td class="diff-context diff-side-added">same</td></tr>'))
            .toEqual({ lines: [' same'], added: 0, removed: 0 });
    });
});

describe('formatDiffLines', () => {
    it('returns the full diff when within budget', () => {
        const result = formatDiffLines(['@@ 1 @@', '-old', '+new'], 100);
        expect(result).toEqual({ diff: '@@ 1 @@\n-old\n+new', truncated: false });
    });

    it('truncates at the character budget and reports omitted lines', () => {
        const lines = ['aaaaa', 'bbbbb', 'ccccc'];
        const result = formatDiffLines(lines, 12);
        expect(result.truncated).toBe(true);
        expect(result.diff).toBe('aaaaa\nbbbbb\n\n[truncated — diff exceeds maxlen; 1 more line(s) omitted]');
    });

    it('always keeps at least one line', () => {
        const result = formatDiffLines(['x'.repeat(50)], 10);
        expect(result.truncated).toBe(true);
        expect(result.diff).toContain('xxxxx');
        expect(result.diff).toContain('[truncated');
    });
});

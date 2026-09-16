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
import { detectHtmlErrors, formatHtmlErrorWarnings } from '../parseOutput.js';

describe('detectHtmlErrors', () => {
    it('returns zero for clean HTML', () => {
        const r = detectHtmlErrors('<div class="mw-parser-output"><p>hello</p></div>');
        expect(r.count).toBe(0);
        expect(r.samples).toEqual([]);
    });

    it('returns zero for empty input', () => {
        expect(detectHtmlErrors('').count).toBe(0);
    });

    it('detects a widget compile error div', () => {
        const html = '<p>text</p><div class="error">微件Foo出错: Unable to load template</div>';
        const r = detectHtmlErrors(html);
        expect(r.count).toBe(1);
        expect(r.samples[0]).toContain('微件Foo出错');
    });

    it('counts multiple error elements', () => {
        const html = '<span class="error">a</span><strong class="error">b</strong>';
        expect(detectHtmlErrors(html).count).toBe(2);
    });

    it('matches errorbox-style classes', () => {
        const html = '<div class="errorbox">Preview failed</div>';
        expect(detectHtmlErrors(html).count).toBe(1);
    });

    it('ignores non-error classes that merely contain "err"', () => {
        const html = '<div class="errata">no</div><span class="terror">no</span>';
        expect(detectHtmlErrors(html).count).toBe(0);
    });

    it('decodes entities and collapses whitespace in samples', () => {
        const html = '<div class="error">A &amp; B\n  <b>C</b> &lt;tag&gt;</div>';
        const r = detectHtmlErrors(html);
        expect(r.samples[0]).toContain('A & B');
        expect(r.samples[0]).toContain('C <tag>');
    });

    it('caps samples at 3 but keeps the full count', () => {
        const html = Array.from({ length: 5 }, (_, i) => `<div class="error">err ${i}</div>`).join('');
        const r = detectHtmlErrors(html);
        expect(r.count).toBe(5);
        expect(r.samples).toHaveLength(3);
    });

    it('truncates samples to 160 chars', () => {
        const html = `<div class="error">${'x'.repeat(500)}</div>`;
        expect(detectHtmlErrors(html).samples[0].length).toBeLessThanOrEqual(160);
    });
});

describe('formatHtmlErrorWarnings', () => {
    it('returns no lines for a clean report', () => {
        expect(formatHtmlErrorWarnings({ count: 0, samples: [] })).toEqual([]);
    });

    it('renders count, samples, and an overflow note', () => {
        const lines = formatHtmlErrorWarnings({ count: 5, samples: ['boom', 'bang', 'crash'] });
        expect(lines[0]).toContain('5 error element(s)');
        expect(lines.join('\n')).toContain('- boom');
        expect(lines.join('\n')).toContain('… and 2 more');
    });
});

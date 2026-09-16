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
import { compactSiteInfo } from '../siteInfo.js';

const fixture = {
    general: { sitename: 'TestWiki', generator: 'MediaWiki 1.43.9' },
    extensions: [
        {
            name: 'Widgets', type: 'parserhook', version: '1.7.1',
            author: ['Someone'], descriptionmsg: 'widgets-desc',
            url: 'https://www.mediawiki.org/wiki/Extension:Widgets',
            license: 'BSD-2-Clause', credits: []
        },
        { name: 'Tiny', type: 'other' },
    ],
    namespaces: { '0': { id: 0 } },
};

describe('compactSiteInfo', () => {
    it('passes everything through in full mode', () => {
        const out = compactSiteInfo(fixture, true);
        expect(out).toBe(fixture);
    });

    it('keeps other sections untouched in compact mode', () => {
        const out = compactSiteInfo(fixture, false);
        expect(out.general).toEqual(fixture.general);
        expect(out.namespaces).toEqual(fixture.namespaces);
    });

    it('compacts extensions to name/type/version', () => {
        const out = compactSiteInfo(fixture, false);
        expect(out.extensions).toEqual([
            { name: 'Widgets', type: 'parserhook', version: '1.7.1' },
            { name: 'Tiny', type: 'other' },
        ]);
    });

    it('tolerates a missing extensions array', () => {
        expect(compactSiteInfo({ general: {} }, false)).toEqual({ general: {} });
        expect(compactSiteInfo(null, false)).toBeNull();
    });
});

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
import { setNamespaceCache, lookupNamespaceId } from '../nodemwBot.js';

// Shape mirrors meta=siteinfo siprop=namespaces (formatversion=1)
const namespaces = {
    '-2': { id: -2, '*': 'Media' },
    '-1': { id: -1, '*': 'Special' },
    '0': { id: 0, '*': '' },
    '1': { id: 1, '*': 'Talk', canonical: 'Talk' },
    '2': { id: 2, '*': '用户', canonical: 'User', alias: 'User' },
    '10': { id: 10, '*': '模板', canonical: 'Template' },
    '274': { id: 274, '*': 'Widget', canonical: 'Widget' },
};

describe('namespace cache', () => {
    it('resolves canonical, localized, and alias names case-insensitively', () => {
        setNamespaceCache(namespaces);
        expect(lookupNamespaceId('Widget')).toBe(274);
        expect(lookupNamespaceId('widget')).toBe(274);
        expect(lookupNamespaceId('模板')).toBe(10);
        expect(lookupNamespaceId('Template')).toBe(10);
        expect(lookupNamespaceId('User')).toBe(2);
        expect(lookupNamespaceId('用户')).toBe(2);
    });

    it('skips negative pseudo-namespaces and the empty main-ns name', () => {
        setNamespaceCache(namespaces);
        expect(lookupNamespaceId('Special')).toBeNull();
        expect(lookupNamespaceId('Media')).toBeNull();
    });

    it('returns null for unknown names', () => {
        setNamespaceCache(namespaces);
        expect(lookupNamespaceId('NoSuchNamespace')).toBeNull();
        expect(lookupNamespaceId('')).toBeNull();
    });
});

// Verified live against zh.minecraft.wiki and a production wiki: namespaces
// objects carry NO inline `alias` field — localized/canonical aliases arrive
// via a separate siprop=namespacealiases flat list.
describe('namespace cache with siprop=namespacealiases', () => {
    const realShapeNamespaces = {
        '-2': { id: -2, case: 'first-letter', canonical: 'Media', '*': 'Media' },
        '-1': { id: -1, case: 'first-letter', canonical: 'Special', '*': 'Special' },
        '6': { id: 6, case: 'first-letter', canonical: 'File', '*': 'File' },
        '10': { id: 10, case: 'first-letter', canonical: 'Template', '*': 'Template' },
        '828': { id: 828, case: 'first-letter', canonical: 'Module', '*': 'Module' },
    };
    const realShapeAliases = [
        { id: -2, '*': '媒体' }, // negative-id aliases must be skipped
        { id: 6, '*': 'Image' },
        { id: 6, '*': '文件' },
        { id: 6, '*': '檔案' },
        { id: 10, '*': '模板' },
        { id: 828, '*': '模组' },
    ];

    it('registers aliases from the namespacealiases list', () => {
        setNamespaceCache(realShapeNamespaces, realShapeAliases);
        expect(lookupNamespaceId('Image')).toBe(6);
        expect(lookupNamespaceId('文件')).toBe(6);
        expect(lookupNamespaceId('檔案')).toBe(6);
        expect(lookupNamespaceId('模组')).toBe(828);
    });

    it('skips aliases of negative pseudo-namespaces', () => {
        setNamespaceCache(realShapeNamespaces, realShapeAliases);
        expect(lookupNamespaceId('媒体')).toBeNull();
    });

    it('still works when namespacealiases is not provided', () => {
        setNamespaceCache(realShapeNamespaces);
        expect(lookupNamespaceId('File')).toBe(6);
        expect(lookupNamespaceId('文件')).toBeNull();
    });

    it('accepts an inline alias array when a wiki ships one', () => {
        setNamespaceCache({
            '6': { id: 6, '*': 'File', alias: ['Image', 'Bild'] },
        });
        expect(lookupNamespaceId('Image')).toBe(6);
        expect(lookupNamespaceId('bild')).toBe(6);
    });
});

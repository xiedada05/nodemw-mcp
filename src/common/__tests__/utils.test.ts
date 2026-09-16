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
import { errorResult } from '../utils.js';

function detailsOf(result: ReturnType<typeof errorResult>): string {
    return JSON.parse((result.content[0] as { text: string }).text).details as string;
}

describe('errorResult conflict annotation', () => {
    it('annotates English edit-conflict messages with a recovery hint', () => {
        const err = new Error('Error returned by API: The save has failed. An edit conflict occurred.');
        const d = detailsOf(errorResult('Failed to write page', err));
        expect(d).toContain('Edit conflict');
        expect(d).toContain('Re-read it with get-article');
    });

    it('annotates localized (Chinese) conflict messages', () => {
        const err = new Error('Error returned by API: 检测到编辑冲突。');
        const d = detailsOf(errorResult('Failed to edit page', err));
        expect(d).toContain('Edit conflict');
    });

    it('leaves unrelated errors untouched', () => {
        const err = new Error('Error returned by API: permissiondenied');
        expect(detailsOf(errorResult('Failed to write page', err))).toBe(err.message);
    });

    it('still annotates login-expiry errors', () => {
        const err = new Error('assertuserfailed');
        const d = detailsOf(errorResult('Failed to write page', err));
        expect(d).toContain('login session has likely expired');
    });
});

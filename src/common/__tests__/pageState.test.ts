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
import {
    markAsRead,
    getReadTime,
    toMwTimestamp,
    conflictGuardParams,
    markAsWritten,
} from '../pageState.js';

describe('toMwTimestamp', () => {
    it('formats ISO 8601 without milliseconds', () => {
        const d = new Date('2026-09-11T17:58:40.123Z');
        expect(toMwTimestamp(d)).toBe('2026-09-11T17:58:40Z');
    });
});

describe('read-time tracking', () => {
    it('records readAt on markAsRead and returns it', () => {
        const pageid = 90_001; // unique per test run
        const before = new Date();
        markAsRead(pageid, 42);
        const at = getReadTime(pageid);
        expect(at).toBeInstanceOf(Date);
        expect(at!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    });

    it('returns undefined for never-read pages', () => {
        expect(getReadTime(90_002)).toBeUndefined();
    });

    it('conflictGuardParams yields starttimestamp only when read', () => {
        expect(conflictGuardParams(90_003)).toEqual({});
        markAsRead(90_003, 7);
        const params = conflictGuardParams(90_003);
        expect(Object.keys(params)).toEqual(['starttimestamp']);
        expect(params.starttimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('conflictGuardParams adds basetimestamp when the revision timestamp is known', () => {
        markAsRead(90_005, 11, '2026-09-12T05:27:14Z');
        const params = conflictGuardParams(90_005);
        expect(params.starttimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(params.basetimestamp).toBe('2026-09-12T05:27:14Z');
    });

    it('markAsWritten also stamps the read time', () => {
        markAsWritten('Test:markAsWritten-stamp', 90_004, 9);
        expect(getReadTime(90_004)).toBeInstanceOf(Date);
    });
});

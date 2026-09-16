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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SiteInfo = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ExtensionEntry extends Record<string, any> {
    name?: string;
    type?: string;
    version?: string;
}

/**
 * Shrink a raw meta=siteinfo response for agent consumption.
 *
 * The extensions list dominates the payload (a 100-extension wiki ships
 * ~70KB of description/author/url/license text the agent rarely needs),
 * so compact mode keeps only name/type/version per extension. All other
 * siprop sections pass through untouched.
 */
export function compactSiteInfo(info: SiteInfo, full: boolean): SiteInfo;
export function compactSiteInfo(info: null, full: boolean): null;
export function compactSiteInfo(info: SiteInfo | null, full: boolean): SiteInfo | null {
    if (full || !info || !Array.isArray(info.extensions)) {
        return info;
    }

    const extensions = (info.extensions as ExtensionEntry[]).map((ext) => {
        const compact: ExtensionEntry = {};
        if (ext.name !== undefined) compact.name = ext.name;
        if (ext.type !== undefined) compact.type = ext.type;
        if (ext.version !== undefined) compact.version = ext.version;
        return compact;
    });

    return { ...info, extensions };
}

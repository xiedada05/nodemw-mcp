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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import pkg from '../package.json';

export const USER_AGENT = 'nodemw-mcp-server/1.0';

export interface SiteInfoSummary {
    sitename: string;
    base: string;
    generator: string;
}

export function createServer(siteInfo?: SiteInfoSummary, authenticated = false): McpServer {
    let description: string;
    const authSuffix = authenticated
        ? ' Write operations are available.'
        : ' Running in guest mode — only read operations are available.';
    if (siteInfo) {
        description = `Connected to ${siteInfo.sitename} (${siteInfo.base}). Running ${siteInfo.generator}.${authSuffix} When connecting for the first time, call the get-site-info tool for full site details.`;
    } else {
        description = `When connecting to this server for the first time, call the get-site-info tool to understand the target MediaWiki site (version, namespaces, extensions, etc.) before using other tools.${authSuffix}`;
    }

    return new McpServer(
        {
            name: 'nodemw-mcp-server',
            version: pkg.version,
            description
        },
        { capabilities: { tools: {} } }
    );
}

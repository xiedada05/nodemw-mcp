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

import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { getBot } from '../../common/nodemwBot.js';
import { callApi, jsonResult, errorResult } from '../../common/utils.js';
import { markAsRead } from '../../common/pageState.js';

interface ModuleRevision {
    revid?: number;
    timestamp?: string;
    contentmodel?: string;
    contentformat?: string;
    '*': string;
}

interface ModulePage {
    pageid?: number;
    ns?: number;
    title?: string;
    missing?: boolean;
    revisions?: ModuleRevision[];
}

export function getModuleSourceTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'get-module-source',
        'Get the RAW source code of a Scribunto module (e.g. Module:XXX). ' +
        'Unlike get-article, this uses prop=revisions&rvprop=content to return ' +
        'the exact source code as stored, bypassing any pre-save transformation ' +
        '(strip markers, etc.) that the normal page fetch may apply. ' +
        'Essential for downloading modules for local editing where byte-for-byte ' +
        'accuracy is required. Works on all MediaWiki versions (rvslots is 1.32+, ' +
        'so this falls back to the legacy slot-less revisions format).',
        {
            title: z.string().describe( 'Module title with Module: prefix (e.g., "Module:QRCode")' )
        },
        {
            title: 'Get module source',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title } ) => handleGetModuleSourceTool( title )
    );
}

async function handleGetModuleSourceTool(
    title: string
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        const apiResult = await callApi(
            bot,
            {
                action: 'query',
                prop: 'revisions',
                titles: title,
                rvprop: 'ids|timestamp|content',
                rvlimit: 1
            },
            'GET'
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
const pages = (apiResult.query as any)?.pages as Record<string, ModulePage> | undefined;
        if (!pages) {
            return errorResult(`Module "${title}" not found.`);
        }

        const pageIds = Object.keys(pages);
        if (pageIds.length === 0) {
            return errorResult(`Module "${title}" not found.`);
        }

        const page = pages[pageIds[0]];
        if (!page || page.missing) {
            return errorResult(`Module "${title}" not found.`);
        }

        const rev = page.revisions?.[0];
        if (!rev) {
            return errorResult(`Module "${title}" has no revisions.`);
        }

        // Slots API is MW 1.32+; on older wikis the content sits directly on the
        // revision object. Accept both shapes.
        const legacyContent = rev['*'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const slotContent = (rev as any).slots?.main?.['*'];
        const content = slotContent ?? legacyContent;
        const contentmodel = (rev as any).slots?.main?.contentmodel ?? rev.contentmodel;
        const contentformat = (rev as any).slots?.main?.contentformat ?? rev.contentformat;
        if (content == null) {
            return errorResult(`Module "${title}" has no main slot content.`);
        }

        // Record read state for the read-before-write guard
        if (page.pageid != null && rev.revid != null) {
            markAsRead(page.pageid, rev.revid);
        }

        return jsonResult({
            title: page.title ?? title,
            pageid: page.pageid,
            ns: page.ns,
            revid: rev.revid,
            timestamp: rev.timestamp,
            contentmodel,
            contentformat,
            content
        });
    } catch ( error ) {
        return errorResult('Failed to get module source', error as Error);
    }
}

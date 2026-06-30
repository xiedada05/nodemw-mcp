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
import { getBot, promisifyBotMethod } from '../../common/nodemwBot.js';
import { markAsWritten, requireRead } from '../../common/pageState.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function revertTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'revert',
        'Revert a wiki page to a specific historical revision (requires authentication). ' +
        'MEDIUM RISK: Overwrites current page content with an old version — subsequent edits since that revision will be lost. ' +
        'The revert is itself a new revision, so it can be reverted if needed. ' +
        'Use get-article-revisions first to find the target revid. ' +
        'Combines get-article-by-revision + write into one atomic step.',
        {
            title: z.string().describe( 'Page title to revert' ),
            revid: z.number().describe( 'Target revision ID to restore — use get-article-revisions to find the revision to revert to' ),
            summary: z.string().describe( 'Edit summary explaining why this revert is being performed (e.g., "Revert vandalism to revision 12345")' )
        },
        {
            title: 'Revert page',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( { title, revid, summary } ) =>
            handleRevertTool( title, revid, summary )
    );
    tool.update({ outputSchema: {
        result: z.string(),
        pageid: z.number(),
        title: z.string(),
        contentmodel: z.string().optional(),
        newrevid: z.number(),
        newtimestamp: z.string().optional(),
        oldrevid: z.number().optional()
    }});
    return tool;
}

async function handleRevertTool(
    title: string,
    revid: number,
    summary: string
): Promise<CallToolResult> {
    try {
        const bot = getBot();
        await requireRead(title);

        // Fetch the target revision content via the API
        const apiResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bot as any).api.call(
                {
                    action: 'query',
                    prop: 'revisions',
                    rvprop: 'content',
                    revids: revid
                },
                (err: Error | null, data: Record<string, unknown>) => {
                    if (err) reject(err);
                    else resolve(data);
                },
                'GET'
            );
        });

        const pages = apiResult.pages as Record<string, Record<string, unknown>> | undefined;
        if (!pages) {
            return errorResult(`Revision ${revid} not found.`);
        }

        const pageIds = Object.keys(pages);
        if (pageIds.length === 0 || pages[pageIds[0]]?.missing !== undefined) {
            return errorResult(`Revision ${revid} not found.`);
        }

        const page = pages[pageIds[0]];
        const revisions = page.revisions as Array<{ '*': string }> | undefined;
        const rev = revisions?.[0];
        if (!rev || rev['*'] == null) {
            return errorResult(`Revision ${revid} not found or has no content.`);
        }

        const oldContent: string = rev['*'];

        // Verify the revision actually belongs to the target page
        const revisionPageTitle = page.title as string | undefined;
        if (revisionPageTitle && revisionPageTitle !== title) {
            return errorResult(
                `Revision ${revid} belongs to "${revisionPageTitle}", not "${title}". ` +
                'Please verify the target page title matches the revision.'
            );
        }

        const prefixedSummary = `[nodemw-mcp.revert] ${summary}`;

        const result = await promisifyBotMethod<{
            result: string;
            title: string;
            pageid?: number;
            newrevid?: number;
            oldrevid?: number;
        }>(
            bot,
            'edit',
            title,
            oldContent,
            prefixedSummary,
            false
        );

        // Cache the write so subsequent operations skip the read guard
        if (result.pageid != null && result.newrevid != null) {
            markAsWritten(title, result.pageid, result.newrevid);
        }

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to revert page', error as Error);
    }
}

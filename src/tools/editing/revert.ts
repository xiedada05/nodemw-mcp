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
import { conflictGuardParams, findStaleWrite, requireRead } from '../../common/pageState.js';
import { callApi, jsonResult, errorResult } from '../../common/utils.js';

export function revertTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'revert',
        'Revert a wiki page to a specific historical revision (requires authentication). ' +
        'MEDIUM RISK: Overwrites current page content with an old version — subsequent edits since that revision will be lost. ' +
        'The revert is itself a new revision, so it can be reverted if needed. ' +
        'Use get-article-revisions first to find the target revid. ' +
        'Combines get-article-by-revision + write into one atomic step. ' +
        'Reverting does NOT count as reading: to edit or write the page afterwards, call get-article again first. ' +
        'A revert whose target content is < 1/10 of the current page is refused as a suspected accidental wipe.',
        {
            title: z.string().describe( 'Page title to revert' ),
            revid: z.number().describe( 'Target revision ID to restore — use get-article-revisions to find the revision to revert to' ),
            summary: z.string().describe( 'Edit summary explaining why this revert is being performed (e.g., "Revert vandalism to revision 12345")' )
        },
        {
            title: 'Revert page',
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true
        } as ToolAnnotations,
        async ( { title, revid, summary } ) =>
            handleRevertTool( title, revid, summary )
    );
    tool.update({ outputSchema: {
        result: z.string(),
        pageid: z.number(),
        title: z.string(),
        contentmodel: z.string().optional(),
        newrevid: z.number().optional(),
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
        const pageid = await requireRead(title);

        // Same staleness CAS as the write tool: a revert is a full-page
        // overwrite that silently discards everything after the restored
        // revision — including concurrent edits the agent never saw. Refuse
        // when the page changed since it was last read in this session.
        const stale = await findStaleWrite(title, pageid);
        if (stale) {
            return errorResult(stale);
        }

        // Fetch the target revision content via the API
        const apiResult = await callApi(
            bot,
            {
                action: 'query',
                prop: 'revisions',
                rvprop: 'content',
                revids: revid
            },
            'GET'
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
const pages = (apiResult.query as any)?.pages as Record<string, Record<string, any>> | undefined;
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

        // Same near-total-wipe floor as the write tool (write.ts intents
        // "rewrite"/"delete"): restoring a revision far smaller than the
        // current page looks like an accidental page wipe and must be
        // refused — revert must not be a lower-friction path around
        // write's size heuristics. Also catches the blanked-revision edge
        // (empty restored content) for any non-trivial current page.
        const currentContent = await promisifyBotMethod<string>(bot, 'getArticle', title, false);
        if (currentContent != null) {
            const currentBytes = Buffer.byteLength(currentContent, 'utf8');
            const restoreBytes = Buffer.byteLength(oldContent, 'utf8');
            if (currentBytes - restoreBytes > 200 && restoreBytes < currentBytes / 10) {
                return errorResult(
                    `Size mismatch: revision ${revid} (${restoreBytes} B) is < 1/10 of the current page ` +
                    `(${currentBytes} B, threshold ${Math.floor(currentBytes / 10)} B). ` +
                    'This looks like an accidental page wipe. Verify the revision ID, re-read the page, ' +
                    'and use write with verified content if a near-total replacement is truly intended.'
                );
            }
        }

        const prefixedSummary = `[nodemw-mcp.revert] ${summary}`;

        // doEdit (public nodemw API) keeps version-aware token fetching and
        // dry-run enforcement, and merges our params into action=edit —
        // bot.edit() can't pass starttimestamp, so conflict protection
        // (MediaWiki's native check against edits landing mid-revert) needs
        // these params, same as the write tool.
        const result = await promisifyBotMethod<{
            result: string;
            title: string;
            pageid?: number;
            newrevid?: number;
            oldrevid?: number;
            newtimestamp?: string;
        }>(
            bot,
            'doEdit',
            'edit',
            title,
            prefixedSummary,
            {
                text: oldContent,
                notminor: '',
                ...conflictGuardParams(pageid),
            }
        );

        // Deliberately NO markAsWritten() here: a revert must not re-seed the
        // session's read evidence with its own write output. Leaving the read
        // record pointing at the pre-revert revision makes findStaleWrite in
        // a subsequent write/edit refuse until the agent genuinely re-reads
        // the page (get-article), preserving the read-before-write contract.

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to revert page', error as Error);
    }
}

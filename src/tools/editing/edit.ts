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
import { requireRead } from '../../common/pageState.js';
import { jsonResult, errorResult } from '../../common/utils.js';

export function editTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'edit',
        'Replace specific lines in a wiki page by exact string match (requires authentication). ' +
        'Like a code editor: provide old_lines (the text to find) and new_lines (the replacement). ' +
        'LOW RISK: Only replaces one exact match — safer than full-page write. ' +
        'Use get-article-with-lineno first to see the current content with line numbers, ' +
        'then copy the exact text you want to replace into old_lines. ' +
        'Only ONE occurrence will be replaced. If the text appears multiple times, the match will fail. ' +
        'For full-page replacement, use the write tool instead.',
        {
            title: z.string().describe( 'Page title to edit' ),
            old_lines: z.string().describe(
                'Exact text to replace — copy verbatim from get-article-with-lineno output. ' +
                'JSON string rules (ONLY these apply): ' +
                '" → \\" (backslash-doublequote), ' +
                '\\ → \\\\ (double backslash), ' +
                'literal newline → \\n. ' +
                'Do NOT "HTML-escape" anything — <, >, & are just normal characters in JSON. ' +
                'The get-article-with-lineno result IS the raw wikitext; match against it directly.' ),
            new_lines: z.string().describe( 'Replacement text to insert in place of old_lines' ),
            summary: z.string().describe( 'Edit summary describing what was changed and why' ),
            minor: z.boolean().optional().default(false).describe( 'Mark as minor edit' )
        },
        {
            title: 'Edit page (line-based)',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( { title, old_lines, new_lines, summary, minor } ) =>
            handleEditTool( title, old_lines, new_lines, summary, minor )
    );
    tool.update({ outputSchema: {
        result: z.string(),
        title: z.string(),
        newrevid: z.number().optional(),
        oldrevid: z.number().optional()
    }});
    return tool;
}

async function handleEditTool(
    title: string,
    old_lines: string,
    new_lines: string,
    summary: string,
    minor: boolean = false
): Promise<CallToolResult> {
    try {
        const bot = getBot();
        await requireRead(title);

        // Fetch current content
        const currentContent = await promisifyBotMethod<string>(
            bot,
            'getArticle',
            title,
            true
        );

        if (currentContent == null) {
            return errorResult(`Page "${title}" not found.`);
        }

        // Exact match replacement (single occurrence only)
        const firstIdx = currentContent.indexOf(old_lines);
        if (firstIdx === -1) {
            return errorResult(
                'old_lines not found in the current page content. ' +
                'The text must match EXACTLY (whitespace, newlines, etc.). ' +
                'Use get-article-with-lineno to verify the current content before retrying.'
            );
        }

        // Verify uniqueness
        const secondIdx = currentContent.indexOf(old_lines, firstIdx + 1);
        if (secondIdx !== -1) {
            const line1 = currentContent.substring(0, firstIdx).split('\n').length;
            const line2 = currentContent.substring(0, secondIdx).split('\n').length;
            return errorResult(
                `old_lines matches multiple locations in the page (lines ${line1} and ${line2}). ` +
                'Provide more surrounding context to make the match unique.'
            );
        }

        const newContent = currentContent.slice(0, firstIdx) + new_lines + currentContent.slice(firstIdx + old_lines.length);

        const prefixedSummary = `[nodemw-mcp.edit] ${summary}`;

        const result = await promisifyBotMethod<{
            result: string;
            title: string;
            newrevid?: number;
            oldrevid?: number;
        }>(
            bot,
            'edit',
            title,
            newContent,
            prefixedSummary,
            minor
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to edit page', error as Error);
    }
}

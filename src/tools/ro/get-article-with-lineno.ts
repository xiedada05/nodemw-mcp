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
import { markAsRead } from '../../common/pageState.js';
import { jsonResult, errorResult } from '../../common/utils.js';

interface LineEntry {
    lineno: number;
    content: string;
}

export function getArticleWithLinenoTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'get-article-with-lineno',
        'Retrieve a wiki article with line numbers. ' +
        'Like a code editor: each line is numbered starting from 1. ' +
        'Useful for precise line-based editing with replace-some-lines — ' +
        'the content returned here can be copy-pasted directly into old_lines without any escaping. ' +
        'Supports offset/limit for reading specific line ranges.',
        {
            title: z.string().optional().describe( 'Article title (required if "id" is not provided)' ),
            id: z.number().optional().describe( 'Page ID (required if "title" is not provided)' ),
            offset: z.number().int().min(0).optional().default(0).describe( 'Skip first N lines (0-based). Use 0 to start from the first line.' ),
            limit: z.number().int().min(1).optional().describe( 'Max lines to return. Omit for all remaining lines.' ),
            maxlen: z.number().int().min(0).optional().describe( 'Max total characters in response. Truncates with [truncated] marker if exceeded.' )
        },
        {
            title: 'Get article with line numbers',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ( { title, id, offset, limit, maxlen } ) =>
            handleGetArticleWithLinenoTool( title, id, offset, limit, maxlen )
    );
    tool.update({ outputSchema: {
        title: z.string(),
        totalLines: z.number(),
        shownLines: z.number(),
        offset: z.number(),
        lines: z.array(z.object({ lineno: z.number(), content: z.string() }))
    }});
    return tool;
}

function truncateLines(lines: LineEntry[], maxlen?: number): { lines: LineEntry[]; truncated: boolean } {
    if (maxlen === undefined || maxlen <= 0) return { lines, truncated: false };

    let total = 0;
    const result: LineEntry[] = [];
    for (const line of lines) {
        // +1 for newline separator in original text
        const needed = line.content.length + (result.length > 0 ? 1 : 0);
        if (total + needed > maxlen) {
            return { lines: result, truncated: true };
        }
        total += needed;
        result.push(line);
    }
    return { lines: result, truncated: false };
}

async function fetchArticleContent(
    title: string | undefined,
    id: number | undefined
): Promise<{ content: string; pageTitle: string; pageid: number; lastrevid: number }> {
    const bot = await getBot();

    if (id !== undefined) {
        const info = await new Promise<Record<string, unknown>>((resolve, reject) => {
            (bot as any).api.call(
                { action: 'query', prop: 'revisions', rvprop: 'content', rvlimit: 1, pageids: id },
                (err: Error | null, data: Record<string, unknown>) => {
                    if (err) reject(err);
                    else resolve(data);
                },
                'GET'
            );
        });

        const pages = info.pages as Record<string, Record<string, unknown>> | undefined;
        const firstKey = Object.keys(pages || {})[0];
        const page = pages?.[firstKey];
        if (!page || page.missing !== undefined) {
            throw new Error(`Page with ID ${id} not found.`);
        }
        const revisions = page.revisions as Array<{ '*': string }> | undefined;
        return {
            content: revisions?.[0]?.['*'] || '',
            pageTitle: (page.title as string) || `id:${id}`,
            pageid: page.pageid as number,
            lastrevid: page.lastrevid as number
        };
    }

    const content = await promisifyBotMethod<string>(bot, 'getArticle', title, true);
    if (content == null) {
        throw new Error(`Page "${title}" not found.`);
    }

    const pageInfos = await promisifyBotMethod<Array<{ pageid: number; lastrevid: number }>>(
        bot, 'getArticleInfo', title, { prop: 'info' }
    );
    const pageInfo = Array.isArray(pageInfos) ? pageInfos[0] : null;

    return {
        content,
        pageTitle: title!,
        pageid: pageInfo?.pageid ?? 0,
        lastrevid: pageInfo?.lastrevid ?? 0
    };
}

async function handleGetArticleWithLinenoTool(
    title: string | undefined,
    id: number | undefined,
    offset: number = 0,
    limit?: number,
    maxlen?: number
): Promise<CallToolResult> {
    try {
        if (!title && id == null) {
            return errorResult('Either "title" or "id" must be provided.');
        }
        if (title && id != null) {
            return errorResult('Provide either "title" or "id", not both.');
        }

        const { content, pageTitle, pageid, lastrevid } = await fetchArticleContent(title, id);

        // Record read state for write-before-read guard
        if (pageid && lastrevid) {
            markAsRead(pageid, lastrevid);
        }

        const allLines: LineEntry[] = content.split('\n').map((text, i) => ({
            lineno: i + 1,
            content: text
        }));

        // Apply offset
        const sliced = allLines.slice(offset);

        // Apply limit
        const limited = limit !== undefined ? sliced.slice(0, limit) : sliced;

        // Apply maxlen (character-level truncation)
        const { lines, truncated } = truncateLines(limited, maxlen);

        let resultLines = lines;
        if (truncated) {
            resultLines = [...lines, { lineno: lines.length > 0 ? lines[lines.length - 1].lineno + 1 : offset + 1, content: '[truncated]' }];
        }

        return jsonResult({
            title: pageTitle,
            totalLines: allLines.length,
            shownLines: resultLines.length,
            offset,
            lines: resultLines
        });
    } catch ( error ) {
        return errorResult('Failed to get article with line numbers', error as Error);
    }
}

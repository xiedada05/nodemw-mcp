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
import { callApi, errorResult, jsonResult } from '../../common/utils.js';
import { detectHtmlErrors, formatHtmlErrorWarnings } from '../../common/parseOutput.js';

type ParseFormat = 'html' | 'xml';
type ParseInclude = 'modules' | 'jsconfigvars' | 'headhtml' | 'sections';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ParseResponse extends Record<string, any> {
    error?: { code: string; info: string };
    parse?: {
        title?: string;
        pageid?: number;
        revid?: number;
        text?: Record<string, string>;
        parsetree?: Record<string, string>;
        images?: string[];
        modules?: string[];
        modulescripts?: string[];
        modulestyles?: string[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jsconfigvars?: Record<string, any>;
        headhtml?: Record<string, string>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sections?: any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        limitreportdata?: any[];
    };
}

export function parseTool( server: McpServer ): RegisteredTool {
    return server.tool(
        'parse',
        'Render wikitext (or an existing page) and return the HTML, the XML parse tree, and optional render context. ' +
        'Use text= to preview NOT-YET-SAVED wikitext; use page=<title> to verify how an EXISTING page renders ' +
        '(recommended right after writing a page). ' +
        'Error elements in the HTML (e.g. broken {{#widget:}} or template output, class="error") are detected and ' +
        'reported as warnings — the API call itself succeeds even when the page content is broken. ' +
        'For complex HTML/widget work, add include=["modules","jsconfigvars","headhtml"] to get the ResourceLoader ' +
        'modules and JS config a faithful render environment needs.',
        {
            text: z.string().optional().describe('Wikitext to parse (required unless "page" is given)'),
            page: z.string().optional().describe('Title of an EXISTING page to parse — its current saved content is rendered as-is. Mutually exclusive with "text".'),
            title: z.string().optional().describe('Context page title for text mode (resolves {{PAGENAME}} and similar magic words)'),
            section: z.number().optional().describe('Only parse this section number (0 = section between the lead and the first heading)'),
            pst: z.boolean().optional().default(false).describe('Pre-save transform before parsing (expands ~~~~ signatures, substitution stamps, etc.)'),
            contentmodel: z.string().optional().describe('Content model of "text" for non-wikitext rendering: css, javascript, or json. Not valid with "page".'),
            format: z.enum(['html', 'xml']).optional().default('html').describe('Output format: "html" for rendered HTML (default), "xml" for parse tree'),
            include: z.array(z.enum(['modules', 'jsconfigvars', 'headhtml', 'sections'])).optional().describe(
                'Extra parse properties: "modules" (ResourceLoader modules/scripts/styles), ' +
                '"jsconfigvars" (JS config globals), "headhtml" (the <head> HTML), "sections" (section list). ' +
                'Switches the response to structured JSON.'),
            limit_report: z.boolean().optional().default(false).describe('Include the structured parser-limit report (CPU time, expansion depth, cache status). Switches the response to structured JSON.')
        },
        {
            title: 'Parse wikitext',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        } as ToolAnnotations,
        async ( { text, page, title, section, pst, contentmodel, format, include, limit_report } ) =>
            handleParseTool( { text, page, title, section, pst, contentmodel, format, include, limit_report } )
    );
}

async function handleParseTool( args: {
    text?: string;
    page?: string;
    title?: string;
    section?: number;
    pst?: boolean;
    contentmodel?: string;
    format: ParseFormat;
    include?: ParseInclude[];
    limit_report?: boolean;
} ): Promise<CallToolResult> {
    const { text, page, title, section, pst, contentmodel, format, include, limit_report } = args;

    if (!text && !page) {
        return errorResult('Provide either "text" (wikitext to parse) or "page" (title of an existing page to render).');
    }
    if (text && page) {
        return errorResult('Provide EITHER "text" OR "page", not both — parsing saved pages and ad-hoc wikitext are separate modes.');
    }
    if (page && contentmodel) {
        return errorResult('"contentmodel" applies to ad-hoc "text" only; an existing page already has its own content model.');
    }

    try {
        const bot = await getBot();

        // Use low-level API: nodemw's bot.parse() hardcodes generatexml=1
        // (removed in MW 1.36, fails silently on 1.43) and its callback
        // signature is incompatible with promisifyBotMethod (promisifyBotMethod
        // only captures the first arg, dropping images).
        const propParts: string[] = [format === 'html' ? 'text' : 'parsetree', 'images'];
        if (include?.includes('modules')) {
            propParts.push('modules', 'modulescripts', 'modulestyles');
        }
        if (include?.includes('jsconfigvars')) {
            propParts.push('jsconfigvars');
        }
        if (include?.includes('headhtml')) {
            propParts.push('headhtml');
        }
        if (include?.includes('sections')) {
            propParts.push('sections');
        }
        if (limit_report) {
            propParts.push('limitreportdata');
        }

        const apiParams: Record<string, unknown> = {
            action: 'parse',
            prop: propParts.join('|'),
        };

        // Strip the NewPP limit-report HTML comment from text output to save
        // tokens — unless the caller asked for the report, in which case the
        // comment is harmless duplication of the structured data.
        if (!limit_report) {
            apiParams.disablelimitreport = '';
        }

        if (page) {
            apiParams.page = page;
        } else {
            apiParams.text = text;
            if (title) apiParams.title = title;
            if (contentmodel) apiParams.contentmodel = contentmodel;
        }
        if (section !== undefined) apiParams.section = section;
        if (pst) apiParams.pst = '';

        const raw = await callApi<ParseResponse>(bot, apiParams, 'POST');

        if (raw.error) {
            throw new Error(raw.error.info || raw.error.code);
        }

        const parsed = raw.parse;
        if (!parsed) {
            return errorResult('Parse returned no result.');
        }

        const parsedText = format === 'html'
            ? (parsed.text?.['*'] || '')
            : (parsed.parsetree?.['*'] || '');
        const images = parsed.images || [];
        const warnings = format === 'html' ? formatHtmlErrorWarnings(detectHtmlErrors(parsedText)) : [];

        const structured = (include?.length ?? 0) > 0 || limit_report === true;

        if (!structured) {
            // Backward-compatible plain-text output (with warning prepended)
            if (format === 'html') {
                const parts = [ ...warnings, '' ];
                parts.push(parsedText);
                if (images.length > 0) {
                    parts.push('', `Images found: ${images.join(', ')}`);
                }
                return {
                    content: [{ type: 'text', text: parts.filter(s => s !== '').join('\n') }]
                };
            }

            const output = [ ...warnings, '' ];
            output.push('Parsed XML structure:', '', parsedText, '');
            output.push(`Images found: ${images.length > 0 ? images.join(', ') : 'none'}`);
            return {
                content: [ { type: 'text', text: output.filter(s => s !== '').join('\n') } ]
            };
        }

        // Structured mode: JSON with the requested render context
        const result: Record<string, unknown> = {
            title: parsed.title,
            pageid: parsed.pageid,
            revid: parsed.revid,
        };
        if (format === 'html') {
            result.html = parsedText;
        } else {
            result.parsetree = parsedText;
        }
        result.images = images;
        if (include?.includes('modules')) {
            result.modules = parsed.modules || [];
            result.modulescripts = parsed.modulescripts || [];
            result.modulestyles = parsed.modulestyles || [];
        }
        if (include?.includes('jsconfigvars')) {
            result.jsconfigvars = parsed.jsconfigvars || {};
        }
        if (include?.includes('headhtml')) {
            result.headhtml = parsed.headhtml?.['*'] || '';
        }
        if (include?.includes('sections')) {
            result.sections = parsed.sections || [];
        }
        if (limit_report) {
            result.limit_report = parsed.limitreportdata || [];
        }
        result.warnings = warnings;

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to parse wikitext', error as Error);
    }
}

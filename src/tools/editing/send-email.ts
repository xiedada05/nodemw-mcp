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
import { jsonResult, errorResult } from '../../common/utils.js';

export function sendEmailTool( server: McpServer ): RegisteredTool {
    const tool = server.tool(
        'send-email',
        'Send an ACTUAL email to a wiki user via the wiki\'s built-in email system (requires authentication). ' +
        'CRITICAL: This sends a real email to the user\'s registered address — it is NOT a simulation. ' +
        'The recipient will see it came from the authenticated bot operator\'s wiki account. ' +
        'Abuse (spam, harassment, unsolicited messages) WILL result in the bot account being blocked. ' +
        'ONLY use this when the human user has explicitly asked you to send an email.',
        {
            username: z.string().describe( 'Target wiki username — email goes to their registered email address' ),
            subject: z.string().describe( 'Email subject line — be clear and professional, no misleading subjects' ),
            text: z.string().describe( 'Plain text email body — will be delivered as-is to the recipient\'s inbox' ),
        },
        {
            title: 'Send email',
            readOnlyHint: false,
            destructiveHint: true
        } as ToolAnnotations,
        async ( params ) => handleSendEmailTool( params )
    );
    tool.update({ outputSchema: {} });
    return tool;
}

async function handleSendEmailTool(
    params: {
        username: string;
        subject: string;
        text: string;
    }
): Promise<CallToolResult> {
    try {
        const bot = await getBot();

        const result = await promisifyBotMethod<{
            result: string;
        }>(
            bot,
            'sendEmail',
            params.username,
            params.subject,
            params.text
        );

        return jsonResult(result);
    } catch ( error ) {
        return errorResult('Failed to send email', error as Error);
    }
}

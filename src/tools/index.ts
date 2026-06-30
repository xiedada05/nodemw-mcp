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

import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

// Read tools
import { getArticleTool } from './ro/get-article.js';
import { searchTool } from './ro/search.js';
import { getPagesInCategoryTool } from './ro/get-pages-in-category.js';
import { getCategoriesTool } from './ro/get-categories.js';
import { getUsersTool } from './ro/get-users.js';
import { getAllPagesTool } from './ro/get-all-pages.js';
import { getPagesInNamespaceTool } from './ro/get-pages-in-namespace.js';
import { getPagesByPrefixTool } from './ro/get-pages-by-prefix.js';
import { getPagesTranscludingTool } from './ro/get-pages-transcluding.js';
import { getArticleRevisionsTool } from './ro/get-article-revisions.js';
import { getArticleCategoriesTool } from './ro/get-article-categories.js';
import { getArticlePropertiesTool } from './ro/get-article-properties.js';
import { getArticleInfoTool } from './ro/get-article-info.js';
import { getUserContribsTool } from './ro/get-user-contribs.js';
import { whoamiTool } from './ro/whoami.js';
import { whoisTool } from './ro/whois.js';
import { whoareTool } from './ro/whoare.js';
import { getImagesTool } from './ro/get-images.js';
import { getImagesFromArticleTool } from './ro/get-images-from-article.js';
import { getImageUsageTool } from './ro/get-image-usage.js';
import { getImageInfoTool } from './ro/get-image-info.js';
import { getLogTool } from './ro/get-log.js';
import { expandTemplatesTool } from './ro/expand-templates.js';
import { parseTool } from './ro/parse.js';
import { getRecentChangesTool } from './ro/get-recent-changes.js';
import { getSiteInfoTool } from './ro/get-site-info.js';
import { getSiteStatsTool } from './ro/get-site-stats.js';
import { getMediaWikiVersionTool } from './ro/get-mediawiki-version.js';
import { getQueryPageTool } from './ro/get-query-page.js';
import { getExternalLinksTool } from './ro/get-external-links.js';
import { getBacklinksTool } from './ro/get-backlinks.js';
import { getArticleByRevisionTool } from './ro/get-article-by-revision.js';
import { getArticleWithLinenoTool } from './ro/get-article-with-lineno.js';
import { getModuleSourceTool } from './ro/get-module-source.js';
import { getArticlesTool } from './ro/get-articles.js';

// Write tools
import { editTool } from './editing/edit.js';
import { writeTool } from './editing/write.js';
import { appendTool } from './editing/append.js';
import { prependTool } from './editing/prepend.js';
import { moveTool } from './editing/move.js';
import { deleteTool } from './editing/delete.js';
import { protectTool } from './editing/protect.js';
import { purgeTool } from './editing/purge.js';
import { sendEmailTool } from './editing/send-email.js';
import { uploadTool } from './editing/upload.js';
import { uploadByUrlTool } from './editing/upload-by-url.js';
import { addFlowTopicTool } from './editing/add-flow-topic.js';
import { createAccountTool } from './editing/create-account.js';
import { blockTool } from './editing/block.js';
import { unblockTool } from './editing/unblock.js';
import { undeleteTool } from './editing/undelete.js';
import { revertTool } from './editing/revert.js';

export const readToolRegistrars = [
    getArticleTool,
    searchTool,
    getPagesInCategoryTool,
    getCategoriesTool,
    getUsersTool,
    getAllPagesTool,
    getPagesInNamespaceTool,
    getPagesByPrefixTool,
    getPagesTranscludingTool,
    getArticleRevisionsTool,
    getArticleCategoriesTool,
    getArticlePropertiesTool,
    getArticleInfoTool,
    getUserContribsTool,
    whoamiTool,
    whoisTool,
    whoareTool,
    getImagesTool,
    getImagesFromArticleTool,
    getImageUsageTool,
    getImageInfoTool,
    getLogTool,
    expandTemplatesTool,
    parseTool,
    getRecentChangesTool,
    getSiteInfoTool,
    getSiteStatsTool,
    getMediaWikiVersionTool,
    getQueryPageTool,
    getExternalLinksTool,
    getBacklinksTool,
    getArticleByRevisionTool,
    getArticleWithLinenoTool,
    getModuleSourceTool,
    getArticlesTool,
];

export const writeToolRegistrars = [
    writeTool,
    editTool,
    revertTool,
    appendTool,
    prependTool,
    moveTool,
    deleteTool,
    protectTool,
    purgeTool,
    sendEmailTool,
    uploadTool,
    uploadByUrlTool,
    addFlowTopicTool,
    createAccountTool,
    blockTool,
    unblockTool,
    undeleteTool,
];

export function registerAllTools(server: McpServer, includeWriteTools = true): RegisteredTool[] {
    const registrars = includeWriteTools
        ? [...readToolRegistrars, ...writeToolRegistrars]
        : readToolRegistrars;

    const registeredTools: RegisteredTool[] = [];
    for (const registrar of registrars) {
        try {
            registeredTools.push(registrar(server));
        } catch (error) {
            console.error(`Error registering tool: ${(error as Error).message}`);
        }
    }
    return registeredTools;
}

import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

// Resource management tools
import { addBotTool } from './meta/add-bot.js';
import { removeBotTool } from './meta/remove-bot.js';
import { setBotTool } from './meta/set-bot.js';
import { quickAddBotTool } from './meta/quick-add-bot.js';

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

// Write tools
import { editTool } from './editing/edit.js';
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

const toolRegistrars = [
	// Resource management
	addBotTool,
	quickAddBotTool,
	removeBotTool,
	setBotTool,

	// Read tools
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

	// Write tools
	editTool,
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
	createAccountTool
];

export function registerAllTools( server: McpServer ): RegisteredTool[] {
	const registeredTools: RegisteredTool[] = [];
	for ( const registrar of toolRegistrars ) {
		try {
			registeredTools.push( registrar( server ) );
		} catch ( error ) {
			console.error( `Error registering tool: ${ ( error as Error ).message }` );
		}
	}
	return registeredTools;
}

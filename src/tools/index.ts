import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

// Resource management tools
import { addBotTool } from './add-bot.js';
import { removeBotTool } from './remove-bot.js';
import { setBotTool } from './set-bot.js';

// Read tools
import { getArticleTool } from './get-article.js';
import { searchTool } from './search.js';
import { getPagesInCategoryTool } from './get-pages-in-category.js';

// Write tools
import { editTool } from './edit.js';
import { appendTool } from './append.js';

const toolRegistrars = [
	// Resource management
	addBotTool,
	removeBotTool,
	setBotTool,

	// Read tools
	getArticleTool,
	searchTool,
	getPagesInCategoryTool,

	// Write tools
	editTool,
	appendTool
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

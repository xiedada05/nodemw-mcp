import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { botService } from '../common/botService.js';
import { BOT_RESOURCE_URI_PREFIX } from '../common/constants.js';

export function registerAllResources( server: McpServer ): void {
	const resourceTemplate = new ResourceTemplate(
		`${ BOT_RESOURCE_URI_PREFIX }{botKey}`,
		{
			list: () => {
				const allBots = botService.getAll();
				const resources: Resource[] = [];
				for ( const botKey in allBots ) {
					const botConfig = allBots[ botKey ];
					resources.push( {
						uri: `${ BOT_RESOURCE_URI_PREFIX }${ botKey }`,
						name: `bots/${ botKey }`,
						title: botConfig.server,
						description: `Bot config for ${ botConfig.server }`
					} );
				}
				return { resources };
			}
		}
	);

	server.resource( 'bots', resourceTemplate, ( uri, variables ) => {
		const botKey = variables.botKey as string;
		const botConfig = botService.get( botKey );

		if ( !botConfig ) {
			return { contents: [] };
		}

		return {
			contents: [
				{
					uri: uri.toString(),
					text: JSON.stringify( botService.sanitize( botConfig ), null, 2 ),
					mimeType: 'application/json'
				}
			]
		};
	} );
}

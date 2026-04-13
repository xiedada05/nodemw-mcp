import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { botService } from '../../common/botService.js';
import { clearBotCache } from '../../common/nodemwBot.js';
import { jsonResult, errorResult } from '../../common/utils.js';

interface WikiInfo {
	sitename: string;
	articlepath: string;
	scriptpath: string;
	server: string;
	servername: string;
}

interface MediaWikiActionApiResponse {
	query?: {
		general?: {
			sitename: string;
			articlepath: string;
			scriptpath: string;
			server: string;
			servername: string;
		};
	};
}

const COMMON_SCRIPT_PATHS = [ '/w', '' ];

async function fetchWikiInfoFromApi(
	wikiServer: string,
	scriptPath: string
): Promise<WikiInfo | null> {
	const baseUrl = `${ wikiServer }${ scriptPath }/api.php`;
	const params = new URLSearchParams( {
		action: 'query',
		meta: 'siteinfo',
		siprop: 'general',
		format: 'json',
		origin: '*'
	} );

	try {
		const response = await fetch( `${ baseUrl }?${ params.toString() }` );
		if ( !response.ok ) {
			return null;
		}
		const data: MediaWikiActionApiResponse = await response.json() as MediaWikiActionApiResponse;

		if ( !data.query?.general ) {
			return null;
		}

		const general = data.query.general;

		return {
			sitename: general.sitename,
			scriptpath: general.scriptpath,
			articlepath: general.articlepath.replace( '/$1', '' ),
			server: general.server,
			servername: general.servername
		};
	} catch {
		return null;
	}
}

async function fetchUsingCommonScriptPaths( wikiServer: string ): Promise<WikiInfo | null> {
	for ( const candidatePath of COMMON_SCRIPT_PATHS ) {
		const apiResult = await fetchWikiInfoFromApi( wikiServer, candidatePath );
		if ( apiResult ) {
			return apiResult;
		}
	}
	return null;
}

async function fetchPageHtml( wikiUrl: string ): Promise<string | null> {
	try {
		const response = await fetch( wikiUrl );
		if ( !response.ok ) {
			return null;
		}
		return await response.text();
	} catch {
		return null;
	}
}

function extractScriptPathFromSearchForm( htmlContent: string, wikiServer: string ): string | null {
	const searchFormMatch = htmlContent.match( /<form[^>]+id=['"]searchform['"][^>]+action=['"]([^'"]*index\.php[^'"]*)['"]/i );
	if ( searchFormMatch && searchFormMatch[ 1 ] ) {
		const actionAttribute = searchFormMatch[ 1 ];
		try {
			const fullActionUrl = new URL( actionAttribute, wikiServer );
			const path = fullActionUrl.pathname;
			const indexPathIndex = path.toLowerCase().lastIndexOf( '/index.php' );
			if ( indexPathIndex !== -1 ) {
				return path.slice( 0, indexPathIndex );
			}
		} catch {
			// Ignore URL parsing errors
		}
	}
	return null;
}

function extractScriptPathsFromHtml( htmlContent: string | null, wikiServer: string ): string[] {
	const candidatesFromHtml: string[] = [];
	if ( htmlContent ) {
		const fromSearchForm = extractScriptPathFromSearchForm( htmlContent, wikiServer );
		if ( fromSearchForm !== null ) {
			candidatesFromHtml.push( fromSearchForm );
		}
	}

	const uniqueCandidatesFromHtml = [ ...new Set( candidatesFromHtml ) ];
	return uniqueCandidatesFromHtml.filter( ( p ) => typeof p === 'string' && ( p === '' || p.trim() !== '' ) );
}

async function fetchUsingScriptPathsFromHtml(
	wikiServer: string,
	originalWikiUrl: string
): Promise<WikiInfo | null> {
	const htmlContent = await fetchPageHtml( originalWikiUrl );
	const htmlScriptPathCandidates = extractScriptPathsFromHtml( htmlContent, wikiServer );
	const pathsToTry = htmlScriptPathCandidates.length > 0 ?
		htmlScriptPathCandidates :
		COMMON_SCRIPT_PATHS;

	for ( const candidatePath of pathsToTry ) {
		const apiResult = await fetchWikiInfoFromApi( wikiServer, candidatePath );
		if ( apiResult ) {
			return apiResult;
		}
	}

	return null;
}

async function getWikiInfo( wikiServer: string, originalWikiUrl: string ): Promise<WikiInfo | null> {
	return ( await fetchUsingCommonScriptPaths( wikiServer ) ) ??
		( await fetchUsingScriptPathsFromHtml( wikiServer, originalWikiUrl ) );
}

function parseWikiUrl( wikiUrl: string ): string {
	const url = new URL( wikiUrl );
	return `${ url.protocol }//${ url.host }`;
}

async function discoverWiki( wikiUrl: string ): Promise<WikiInfo | null> {
	const wikiServer = parseWikiUrl( wikiUrl );
	return getWikiInfo( wikiServer, wikiUrl );
}

export function quickAddBotTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'quick-add-bot',
		'Quickly add an anonymous read-only bot from a wiki URL. Automatically discovers the wiki API endpoint.',
		{
			wikiUrl: z.string().url().describe( 'Any URL from the target wiki (e.g. https://en.wikipedia.org/wiki/Main_Page)' ),
			key: z.string().optional().describe( 'Custom key for this bot configuration. If not provided, the server name will be used.' )
		},
		{
			title: 'Quick add bot',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( params ) => handleQuickAddBotTool( params.wikiUrl, params.key )
	);
}

async function handleQuickAddBotTool(
	wikiUrl: string,
	customKey?: string
): Promise<CallToolResult> {
	try {
		// Step 1: Discover wiki info
		const wikiInfo = await discoverWiki( wikiUrl );

		if ( wikiInfo === null ) {
			return {
				content: [
					{
						type: 'text',
						text: 'Failed to determine wiki info. Please ensure the URL is correct and the wiki is accessible.'
					}
				],
				isError: true
			};
		}

		// Step 2: Generate key
		const key = customKey || wikiInfo.servername;

		// Check if key already exists
		if ( botService.get( key ) ) {
			return {
				content: [
					{
						type: 'text',
						text: `Bot with key "${ key }" already exists. Use a different key or remove the existing bot first.`
					}
				],
				isError: true
			};
		}

		// Step 3: Add the bot configuration (anonymous, no credentials)
		botService.add( key, {
			server: wikiInfo.server,
			path: wikiInfo.scriptpath !== undefined ? wikiInfo.scriptpath : '/w',
			debug: false,
			username: null,
			password: null,
			dryRun: false
		} );

		// Step 4: Test the connection by fetching site info
		const testBot = {
			server: wikiInfo.server,
			path: wikiInfo.scriptpath !== undefined ? wikiInfo.scriptpath : '/w',
			username: null,
			password: null
		};

		// Perform a simple API test
		const apiUrl = `${ wikiInfo.server }${ wikiInfo.scriptpath != null ? wikiInfo.scriptpath : '/w' }/api.php`;
		const testParams = new URLSearchParams( {
			action: 'query',
			meta: 'siteinfo',
			siprop: 'general',
			format: 'json'
		} );

		try {
			const testResponse = await fetch( `${ apiUrl }?${ testParams.toString() }` );
			if ( !testResponse.ok ) {
				// Remove the bot we just added since connection failed
				botService.remove( key );
				return {
					content: [
						{
							type: 'text',
							text: `Failed to connect to the wiki API (${ apiUrl }). The wiki may require authentication or the API may be disabled. Error: ${ testResponse.status } ${ testResponse.statusText }`
						}
					],
					isError: true
				};
			}
		} catch ( error ) {
			// Remove the bot we just added since connection failed
			botService.remove( key );
			return {
				content: [
					{
						type: 'text',
						text: `Failed to connect to the wiki API. Error: ${ ( error as Error ).message }`
					}
				],
				isError: true
			};
		}

		// Step 5: Set as current bot and return success
		botService.setCurrent( key );
		clearBotCache();

		return {
			content: [
				{
					type: 'text',
					text: `Successfully added and connected to "${ wikiInfo.sitename }" (key: ${ key })\n\n` +
						`Server: ${ wikiInfo.server }\n` +
						`Script Path: ${ wikiInfo.scriptpath || '/w' }\n` +
						`Article Path: ${ wikiInfo.articlepath }\n\n` +
						`This bot is now set as the current active bot and ready for read-only operations.`
				}
			]
		};
	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Error adding bot: ${ ( error as Error ).message }`
				}
			],
			isError: true
		};
	}
}

import * as fs from 'fs';

export interface BotConfig {
	/**
	 * Wiki 服务器地址 (如 https://en.wikipedia.org)
	 */
	server: string;
	/**
	 * 协议，默认 "https"
	 */
	protocol?: string;
	/**
	 * 端口
	 */
	port?: number;
	/**
	 * API 路径
	 */
	path?: string;
	/**
	 * 代理服务器
	 */
	proxy?: string;
	/**
	 * 用户代理
	 */
	userAgent?: string;
	/**
	 * 并发数
	 */
	concurrency?: number;
	/**
	 * 调试模式
	 */
	debug?: boolean;
	/**
	 * 用户名（可选）
	 */
	username?: string | null;
	/**
	 * 密码（可选）
	 */
	password?: string | null;
	/**
	 * 域（用于 LDAP 等）
	 */
	domain?: string;
	/**
	 * 干跑模式
	 */
	dryRun?: boolean;
}

export type PublicBotConfig = Omit< BotConfig, 'password' >;

export interface Config {
	bots: { [ key: string ]: BotConfig };
	defaultBot: string;
}

export const defaultConfig: Config = {
	defaultBot: 'en.wikipedia.org',
	bots: {
		'en.wikipedia.org': {
			server: 'https://en.wikipedia.org',
			path: '/w',
			debug: false,
			username: null,
			password: null,
			dryRun: false
		},
		'localhost:8080': {
			server: 'http://localhost:8080',
			path: '/w',
			debug: false,
			username: null,
			password: null,
			dryRun: false
		}
	}
};

import { parseArgs } from 'util';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'config-path': {
      type: 'string',
      short: 'c',
    },
  },
  strict: false, // Allow other args to pass through (for MCP stdio transport)
  allowPositionals: true,
});

// Determine config path in order of priority:
// 1. --config-path (or -c) command line option (ensure it's a string)
// 2. NODEMW_MCP_CONF environment variable
// 3. CONFIG environment variable (backward compatibility)
// 4. Default: 'config.json'
const configPath = 
  (typeof values['config-path'] === 'string' ? values['config-path'] : undefined) || 
  process.env.NODEMW_MCP_CONF || 
  process.env.CONFIG || 
  'config.json';

function replaceEnvVars( value: string ): string {
	return value.replace( /\$\{([^}]+)\}/g, ( match, envVar: string ) => {
		const envValue = process.env[ envVar ];
		return envValue !== undefined ? envValue : match;
	} );
}

function replaceEnvVarsInObject( obj: unknown ): unknown {
	if ( typeof obj === 'string' ) {
		return replaceEnvVars( obj );
	}
	if ( Array.isArray( obj ) ) {
		return obj.map( ( item ) => replaceEnvVarsInObject( item ) );
	}
	if ( obj !== null && typeof obj === 'object' ) {
		const result: Record< string, unknown > = {};
		for ( const [ key, value ] of Object.entries( obj ) ) {
			result[ key ] = replaceEnvVarsInObject( value );
		}
		return result;
	}
	return obj;
}

export function loadConfigFromFile(): Config {
	if ( !fs.existsSync( configPath ) ) {
		return defaultConfig;
	}
	const rawData = fs.readFileSync( configPath, 'utf-8' );
	const parsed = JSON.parse( rawData );
	return replaceEnvVarsInObject( parsed ) as Config;
}

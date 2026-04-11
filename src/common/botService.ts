import {
	BotConfig,
	PublicBotConfig,
	loadConfigFromFile
} from './config.js';

type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

const config = loadConfigFromFile();

let currentBotKey: string = config.defaultBot;

function sanitize( botConfig: DeepReadonly<BotConfig> ): PublicBotConfig {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { password: _password, ...publicConfig } = botConfig as BotConfig;
	return publicConfig;
}

function getAll(): DeepReadonly<Record<string, BotConfig>> {
	return config.bots as DeepReadonly<Record<string, BotConfig>>;
}

function get( key: string ): DeepReadonly<BotConfig> | undefined {
	return config.bots[ key ] as DeepReadonly<BotConfig> | undefined;
}

function add( key: string, botConfig: BotConfig ): void {
	if ( !key || key.trim() === '' ) {
		throw new Error( 'Bot key cannot be empty' );
	}

	if ( config.bots[ key ] ) {
		throw new Error( `Bot "${ key }" already exists in configuration` );
	}

	config.bots[ key ] = botConfig;
}

function remove( key: string ): void {
	delete config.bots[ key ];
}

function getCurrent(): { key: string; config: DeepReadonly<BotConfig> } {
	return {
		key: currentBotKey,
		config: config.bots[ currentBotKey ] as DeepReadonly<BotConfig>
	};
}

function setCurrent( key: string ): void {
	if ( !config.bots[ key ] ) {
		throw new Error( `Bot "${ key }" not found in config.json` );
	}
	currentBotKey = key;
}

function reset(): void {
	if ( config.bots[ config.defaultBot ] ) {
		currentBotKey = config.defaultBot;
	} else {
		throw new Error( `Default bot "${ config.defaultBot }" not found in config.json` );
	}
}

export const botService = {
	getAll,
	get,
	add,
	remove,
	getCurrent,
	setCurrent,
	sanitize,
	reset
};

import Bot from 'nodemw';
import { botService } from './botService.js';
import { USER_AGENT } from '../server.js';

let botInstance: Bot | null = null;

export async function getBot(): Promise<Bot> {
	if ( botInstance ) {
		return botInstance;
	}

	const { config } = botService.getCurrent();

	// Parse server URL if it's a full URL
	let server = config.server;
	let protocol = config.protocol;
	let port = config.port;

	try {
		// If server is a full URL (starts with http:// or https://), parse it
		if (server.startsWith('http://') || server.startsWith('https://')) {
			const url = new URL(server);
			server = url.hostname;
			protocol = url.protocol.replace(':', '');
			if (url.port) {
				port = parseInt(url.port, 10);
			}
		}
	} catch {
		// If parsing fails, use original values
	}

	// Create Bot instance
	botInstance = new Bot( {
		server,
		protocol,
		port,
		path: config.path,
		proxy: config.proxy,
		userAgent: config.userAgent || USER_AGENT,
		concurrency: config.concurrency,
		debug: config.debug,
		username: config.username || undefined,
		password: config.password || undefined,
		domain: config.domain
	} );

	// If credentials provided, login automatically
	if ( config.username && config.password ) {
		await new Promise<void>( ( resolve, reject ) => {
			botInstance!.logIn( ( err: Error | null ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve();
				}
			} );
		} );
	}

	return botInstance;
}

export function clearBotCache(): void {
	botInstance = null;
}

export function promisifyBotMethod<T>(
	bot: Bot,
	method: string,
	...args: unknown[]
): Promise<T> {
	return new Promise( ( resolve, reject ) => {
		const callback = ( err: Error | null, result: T ) => {
			if ( err ) {
				reject( err );
			} else {
				resolve( result );
			}
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		( bot as any )[ method ]( ...args, callback );
	} );
}

import Bot from 'nodemw';
import { botService } from './botService.js';
import { USER_AGENT } from '../server.js';

let botInstance: Bot | null = null;

export async function getBot(): Promise<Bot> {
	if ( botInstance ) {
		return botInstance;
	}

	const { config } = botService.getCurrent();

	// Create Bot instance
	botInstance = new Bot( {
		server: config.server,
		protocol: config.protocol,
		port: config.port,
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

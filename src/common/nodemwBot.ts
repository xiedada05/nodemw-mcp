import Bot from 'nodemw';
import { USER_AGENT } from '../server.js';

export interface ServerConfig {
	server: string;
	endpoint: string;
	protocol?: string;
	port?: number;
	proxy?: string;
	userAgent?: string;
	concurrency?: number;
	debug?: boolean;
	username?: string;
	password?: string;
	token?: string;
	domain?: string;
	dryRun?: boolean;
}

let botInstance: Bot | null = null;
let serverConfig: ServerConfig | null = null;

export function initServerConfig(config: ServerConfig): void {
	serverConfig = config;
}

export async function getBot(): Promise<Bot> {
	if (botInstance) {
		return botInstance;
	}

	if (!serverConfig) {
		throw new Error('Server not configured. Use --server to specify the MediaWiki server.');
	}

	const {
		server,
		endpoint,
		protocol,
		port,
		proxy,
		userAgent,
		concurrency,
		debug,
		username,
		password,
		token,
		domain,
		dryRun
	} = serverConfig;

	botInstance = new Bot({
		server,
		protocol: protocol || 'https',
		port,
		path: endpoint,
		proxy,
		userAgent: userAgent || USER_AGENT,
		concurrency,
		debug,
		username: username || undefined,
		password: password || undefined,
		domain,
		// @ts-expect-error: dryRun is supported by nodemw at runtime but missing from BotOptions types
		dryRun
	});

	if (username && password) {
		await new Promise<void>((resolve, reject) => {
			botInstance!.logIn((err: Error | null) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
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
	return new Promise((resolve, reject) => {
		const callback = (err: Error | null, result: T) => {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(bot as any)[method](...args, callback);
	});
}

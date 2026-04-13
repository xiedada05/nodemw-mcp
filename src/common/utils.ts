import Bot = require('nodemw');
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

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

export function isNonNullish<T>(
	value: T | null | undefined
): value is T {
	return value !== null && value !== undefined;
}

export function jsonResult(data: unknown): CallToolResult {
	return {
		content: [{
			type: 'text',
			text: JSON.stringify(data, null, 2)
		}]
	};
}

export function errorResult(message: string, error?: Error): CallToolResult {
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({
				error: message,
				details: error?.message
			}, null, 2)
		}],
		isError: true
	};
}

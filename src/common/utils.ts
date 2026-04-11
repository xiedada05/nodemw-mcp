import Bot = require('nodemw');

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

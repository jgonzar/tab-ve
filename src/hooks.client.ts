import type { ClientInit } from '@sveltejs/kit';
import { gateHref } from '$lib/gate';

// Any /api/* call that comes back 401 means the session expired or the
// signing secret was rotated: send the user to the PIN gate, then back here.
//
// Wrapping fetch catches every call site, present and future. The response is
// still returned unchanged, so callers keep treating it as a server error,
// never as "offline": a queued ride stays in the queue, and nothing new is
// queued because of a 401. The queue syncs once the PIN is entered again.
export const init: ClientInit = () => {
	const nativeFetch = window.fetch;
	let leaving = false;

	window.fetch = async (input, init) => {
		const response = await nativeFetch.call(window, input, init);
		if (response.status === 401 && !leaving && isOwnApi(input)) {
			leaving = true;
			location.assign(gateHref(location.pathname + location.search, true));
		}
		return response;
	};
};

function isOwnApi(input: RequestInfo | URL): boolean {
	const url = new URL(input instanceof Request ? input.url : String(input), location.href);
	return url.origin === location.origin && url.pathname.startsWith('/api/');
}

// The household PIN gate's shared pieces: its path and the PIN format (its
// copy lives in messages/ with every other string). Used by the server hook,
// the gate route, the client 401 handler and scripts/hash-pin.ts, so keep this
// module free of $env and $app imports.

export const GATE_PATH = '/acceso';

/** Query params on the gate URL: where to return to, and why the user is here. */
export const NEXT_PARAM = 'next';
export const EXPIRED_PARAM = 'expirada';

// The one place the PIN format lives. If it becomes a passphrase, change these
// three together with the input's attributes in routes/acceso/+page.svelte.
export const PIN_LENGTH = 6;
export const PIN_PATTERN = '\\d{6}';
const PIN_FORMAT = new RegExp(`^${PIN_PATTERN}$`);

export function isPinFormat(pin: string): boolean {
	return PIN_FORMAT.test(pin);
}

/** The gate URL that returns to `next` after the PIN. `expired` shows the "session expired" notice. */
export function gateHref(next: string, expired = false): string {
	const params = new URLSearchParams();
	if (next !== '/') params.set(NEXT_PARAM, next);
	if (expired) params.set(EXPIRED_PARAM, '1');
	const query = params.toString();
	return query ? `${GATE_PATH}?${query}` : GATE_PATH;
}

/**
 * The `next` param, reduced to a same-origin path. Anything else (another
 * origin, `//host`, `/\host`, tabs and newlines the URL parser strips, the gate
 * itself) falls back to the home page, so the gate is never an open redirect.
 */
export function safeNext(raw: string | null): string {
	if (!raw || !raw.startsWith('/')) return '/';
	const base = 'http://gate.invalid';
	let url: URL;
	try {
		url = new URL(raw, base);
	} catch {
		return '/';
	}
	if (url.origin !== base || url.pathname === GATE_PATH) return '/';
	return url.pathname + url.search + url.hash;
}

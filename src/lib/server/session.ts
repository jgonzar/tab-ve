import { createHmac, timingSafeEqual } from 'node:crypto';

// The household session cookie:
//
//   tab_session=<payload>.<signature>
//
// payload is base64url JSON { v, iat } (format version, issued-at in Unix
// seconds); signature is base64url HMAC-SHA256 of the payload string, keyed
// with SESSION_SECRET. Rotating SESSION_SECRET invalidates every device.

export const SESSION_COOKIE = 'tab_session';

/** About 400 days, the browsers' cap on cookie lifetime. In seconds. */
export const SESSION_MAX_AGE = 400 * 24 * 60 * 60;

/** Shorter secrets are refused (fail closed). `openssl rand -base64 48` gives 64 characters. */
export const MIN_SECRET_LENGTH = 32;

const VERSION = 1;
const CLOCK_SKEW = 5 * 60;

// `secure` is left to SvelteKit's default: on everywhere except plain
// http://localhost, which is what lets the local harness log in.
export const SESSION_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	maxAge: SESSION_MAX_AGE
} as const;

function sign(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(secret: string, now = Date.now()): string {
	const payload = Buffer.from(JSON.stringify({ v: VERSION, iat: Math.floor(now / 1000) })).toString(
		'base64url'
	);
	return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string, secret: string, now = Date.now()): boolean {
	const dot = token.indexOf('.');
	if (dot < 1) return false;
	const payload = token.slice(0, dot);

	// Compare the encoded strings, not decoded bytes: Node's base64url decoder
	// skips stray characters, so a padded or altered signature could decode
	// to the right bytes.
	const given = Buffer.from(token.slice(dot + 1));
	const expected = Buffer.from(sign(payload, secret));
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

	let data: unknown;
	try {
		data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
	} catch {
		return false;
	}
	if (typeof data !== 'object' || data === null) return false;
	const { v, iat } = data as { v?: unknown; iat?: unknown };
	if (v !== VERSION || typeof iat !== 'number') return false;

	const age = now / 1000 - iat;
	return age >= -CLOCK_SKEW && age <= SESSION_MAX_AGE;
}

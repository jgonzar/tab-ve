// What the demo adds to each request: the per-IP write cap, the lazy 4-hour
// reset, the hard cap on total rides, and the Reiniciar button's checks.
// Everything starts with isDemo(): with DEMO_MODE off, nothing here reads the
// database or counts anything. The dependencies are passed in, so the tests
// run it with no network and no SvelteKit env.

import {
	createWindowLimiter,
	MAX_RESETS,
	MAX_RIDES,
	MAX_WRITES,
	RESET_WINDOW_MS,
	WRITE_WINDOW_MS
} from './limits';
import { countRides, createLazyReset, MIN_RESET_GAP_MS, resetDemo, type DemoSql } from './reset';

export type DemoRequest = { method: string; pathname: string; ip: string };

/** Why a request was refused, with a 429. */
export type DemoBlock = { reason: 'writes' | 'full'; retryAfterMs: number };

export type ResetPress =
	| { result: 'not-demo' }
	| { result: 'reset' }
	| { result: 'limited'; retryAfterMs: number }
	| { result: 'too-soon'; retryAfterMs: number };

const STATIC_PATHS = new Set(['/manifest.webmanifest', '/og.png', '/favicon.ico']);
const STATIC_PREFIXES = ['/_app/', '/icons/'];

// The interface-language cookie and Reiniciar (which has its own limit) don't count as edits
const NOT_EDITS = new Set(['/api/language', '/api/demo/reset']);

function isStatic(pathname: string): boolean {
	return STATIC_PATHS.has(pathname) || STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isWrite({ method, pathname }: DemoRequest): boolean {
	return (
		method !== 'GET' &&
		method !== 'HEAD' &&
		pathname.startsWith('/api/') &&
		!NOT_EDITS.has(pathname)
	);
}

export function createDemo(deps: { isDemo: () => boolean; getSql: () => DemoSql; now?: () => number }) {
	const now = deps.now ?? Date.now;
	const writes = createWindowLimiter(MAX_WRITES, WRITE_WINDOW_MS);
	const resets = createWindowLimiter(MAX_RESETS, RESET_WINDOW_MS);
	const maybeReset = createLazyReset(deps.getSql);

	/** Runs before the request is handled. Null lets it through. */
	async function guard(request: DemoRequest): Promise<DemoBlock | null> {
		if (!deps.isDemo() || isStatic(request.pathname)) return null;

		if (isWrite(request)) {
			const hit = writes.hit(request.ip, now());
			if (!hit.ok) return { reason: 'writes', retryAfterMs: hit.retryAfterMs };
		}

		await maybeReset(new Date(now()));

		if (request.method === 'POST' && request.pathname === '/api/viajes') {
			try {
				const sql = deps.getSql();
				if ((await countRides(sql)) >= MAX_RIDES) {
					const outcome = await resetDemo(sql, new Date(now()), MIN_RESET_GAP_MS);
					if (outcome !== 'reset') return { reason: 'full', retryAfterMs: MIN_RESET_GAP_MS };
				}
			} catch (e) {
				// The ride's own insert reports a database failure
				console.error('[demo] ride cap check failed:', e);
			}
		}
		return null;
	}

	/** Reiniciar: rate-limited per IP here, and to once a minute overall by the reset itself. */
	async function pressReset(ip: string): Promise<ResetPress> {
		if (!deps.isDemo()) return { result: 'not-demo' };
		const hit = resets.hit(ip, now());
		if (!hit.ok) return { result: 'limited', retryAfterMs: hit.retryAfterMs };
		const outcome = await resetDemo(deps.getSql(), new Date(now()), MIN_RESET_GAP_MS);
		return outcome === 'reset' ? { result: 'reset' } : { result: 'too-soon', retryAfterMs: MIN_RESET_GAP_MS };
	}

	return { guard, pressReset };
}

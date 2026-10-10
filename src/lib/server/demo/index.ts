// The demo wired to the real deployment: DEMO_MODE and the runtime
// DATABASE_URL. On the demo that URL is the demo's own Neon database; the
// client is only created when a demo request first needs it, so with
// DEMO_MODE off nothing here ever connects.

import { json, type RequestEvent } from '@sveltejs/kit';
import { neon } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';
import { m } from '$lib/paraglide/messages.js';
import { isDemo } from '../flags';
import { createDemo, type DemoBlock } from './guard';
import type { DemoSql } from './reset';

/**
 * The banner's Reiniciar. Answered by the demo hook (hooks.server.ts) rather
 * than a route file, so the real app has no such route at all: there it's the
 * same 404 as any unknown path.
 */
export const RESET_PATH = '/api/demo/reset';

let client: DemoSql | undefined;

function getSql(): DemoSql {
	if (!client) {
		const url = env.DATABASE_URL;
		if (!url) throw new Error('DATABASE_URL is not set.');
		const sql = neon(url);
		client = {
			query: (text, params = []) => sql(text, params),
			transaction: async (statements) => {
				await sql.transaction(statements.map((s) => sql(s.text, s.params)));
			}
		};
	}
	return client;
}

export const demo = createDemo({ isDemo, getSql });

const retryAfter = (ms: number) => ({ 'Retry-After': String(Math.ceil(ms / 1000)) });

const LIMIT_MESSAGES = { writes: m.demo_too_many_writes, full: m.demo_full };

/** The 429 for a request the guard refused. */
export function blockedResponse(block: DemoBlock): Response {
	return json({ message: LIMIT_MESSAGES[block.reason]() }, { status: 429, headers: retryAfter(block.retryAfterMs) });
}

/** POST /api/demo/reset: wipes the shared data and reseeds it. */
export async function resetResponse(event: RequestEvent): Promise<Response> {
	try {
		const press = await demo.pressReset(event.getClientAddress());
		switch (press.result) {
			case 'reset':
				return json({ ok: true });
			case 'limited':
				return json({ message: m.demo_reset_limited() }, { status: 429, headers: retryAfter(press.retryAfterMs) });
			case 'too-soon':
				return json({ message: m.demo_reset_too_soon() }, { status: 429, headers: retryAfter(press.retryAfterMs) });
			case 'not-demo':
				// The hook only calls this on the demo; kept for completeness
				return json({ message: 'Not Found' }, { status: 404 });
		}
	} catch (e) {
		console.error(`[POST ${RESET_PATH}]`, e);
		return json({ message: m.demo_reset_failed() }, { status: 500 });
	}
}

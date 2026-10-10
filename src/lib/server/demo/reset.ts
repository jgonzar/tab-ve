// Wiping and reseeding the shared demo database. Only the demo deployment
// runs any of this (hooks.server.ts and /api/demo/reset check isDemo()).
//
// The whole reset is one transaction, sent as one batch: over Neon's HTTP
// driver every query is its own session, so a session advisory lock would be
// released as soon as it was taken. The transaction holds
// pg_try_advisory_xact_lock instead, and a guard inside it raises if another
// reset holds the lock or the last reset is too recent. A raise rolls the
// whole batch back, so a reset either happens in full or not at all, and two
// concurrent ones never both seed.
//
// The time of the last reset lives in its own schema, `demo`, created by the
// reset itself: schema.ts doesn't change, production never touches it, and
// drizzle-kit (which only looks at `public`) never sees or drops it.

import { seedStatements, type Statement } from './seed';

/** The slice of a Postgres client the reset needs. lib/server/demo/client.ts wraps Neon; the tests wrap PGlite. */
export interface DemoSql {
	query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
	/** Runs every statement in one transaction; any error rolls them all back. */
	transaction(statements: Statement[]): Promise<void>;
}

/** The data starts over this often (decision 6), checked lazily on requests. */
export const RESET_EVERY_MS = 4 * 60 * 60 * 1000;
/** Each instance reads the last reset time at most this often. */
export const CHECK_EVERY_MS = 60 * 1000;
/** Reiniciar and the ride cap can't reset more often than this, across all instances. */
export const MIN_RESET_GAP_MS = 60 * 1000;

const LOCK_KEY = 7_260_301; // any constant; only the demo's resets take it
const BUSY = 'demo_reset_busy';
const NOT_DUE = 'demo_reset_not_due';

const STATE_TABLE = 'demo.reset_state';

export type ResetOutcome = 'reset' | 'busy' | 'not-due';

/**
 * The statements of one reset. `notBefore`: skip (raise NOT_DUE) if the last
 * reset is newer than this. It's written into the guard as an ISO literal,
 * which is only digits, dashes, colons, a dot and the letters T and Z.
 */
export function resetStatements(now: Date, notBefore: Date): Statement[] {
	const cutoff = notBefore.toISOString();
	return [
		{
			text: `DO $$ BEGIN IF NOT pg_try_advisory_xact_lock(${LOCK_KEY}) THEN RAISE EXCEPTION '${BUSY}'; END IF; END $$`,
			params: []
		},
		{ text: 'CREATE SCHEMA IF NOT EXISTS demo', params: [] },
		{
			text: `CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (id integer PRIMARY KEY CHECK (id = 1), reset_at timestamptz NOT NULL)`,
			params: []
		},
		{
			text: `DO $$ BEGIN IF EXISTS (SELECT 1 FROM ${STATE_TABLE} WHERE reset_at > '${cutoff}'::timestamptz) THEN RAISE EXCEPTION '${NOT_DUE}'; END IF; END $$`,
			params: []
		},
		{
			text: 'TRUNCATE viaje_paradas, viaje_clientes, viajes, ubicaciones, usuarios RESTART IDENTITY CASCADE',
			params: []
		},
		...seedStatements(now),
		{
			text: `INSERT INTO ${STATE_TABLE} (id, reset_at) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET reset_at = excluded.reset_at`,
			params: [now.toISOString()]
		}
	];
}

function raised(e: unknown, marker: string): boolean {
	return e instanceof Error && e.message.includes(marker);
}

/** Wipes and reseeds, unless another reset holds the lock or the last one is newer than `minAgeMs`. */
export async function resetDemo(sql: DemoSql, now: Date, minAgeMs: number): Promise<ResetOutcome> {
	try {
		await sql.transaction(resetStatements(now, new Date(now.getTime() - minAgeMs)));
		return 'reset';
	} catch (e) {
		if (raised(e, BUSY)) return 'busy';
		if (raised(e, NOT_DUE)) return 'not-due';
		throw e;
	}
}

// undefined_table, invalid_schema_name: no reset has ever run
const NEVER_RESET_CODES = new Set(['42P01', '3F000']);

/** When the data was last reseeded, or null if it never was. */
export async function lastResetAt(sql: DemoSql): Promise<Date | null> {
	try {
		const [row] = await sql.query(`SELECT reset_at FROM ${STATE_TABLE} WHERE id = 1`);
		return row ? new Date(row.reset_at as string | Date) : null;
	} catch (e) {
		const code = (e as { code?: string })?.code;
		if (code && NEVER_RESET_CODES.has(code)) return null;
		throw e;
	}
}

export async function countRides(sql: DemoSql): Promise<number> {
	const [row] = await sql.query('SELECT count(*)::int AS n FROM viajes');
	return Number(row?.n ?? 0);
}

/**
 * The lazy 4-hour reset. Each instance reads the last reset time at most once
 * a minute; when it's older than 4 hours (or missing, on a fresh database), it
 * resets. Requests on the same instance that arrive meanwhile wait for the
 * same check, so they read the fresh data. A failed check is logged and the
 * request goes on; the next one tries again a minute later.
 */
export function createLazyReset(getSql: () => DemoSql) {
	let lastCheck = -Infinity;
	let inFlight: Promise<void> | null = null;

	async function check(now: Date) {
		const sql = getSql();
		const at = await lastResetAt(sql);
		if (at && now.getTime() - at.getTime() < RESET_EVERY_MS) return;
		await resetDemo(sql, now, RESET_EVERY_MS);
	}

	return async function maybeReset(now = new Date()): Promise<void> {
		if (inFlight) return inFlight;
		if (now.getTime() - lastCheck < CHECK_EVERY_MS) return;
		lastCheck = now.getTime();
		inFlight = check(now)
			.catch((e) => console.error('[demo] lazy reset failed:', e))
			.finally(() => (inFlight = null));
		return inFlight;
	};
}

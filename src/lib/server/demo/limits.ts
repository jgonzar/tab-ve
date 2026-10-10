// The demo's abuse limits, in memory and best effort: each serverless
// instance keeps its own counts, so the real ceiling is per instance. The
// hard cap on total rides (guard.ts) is counted in the database and holds
// across instances.

/** Writes (POST, PUT, PATCH, DELETE on /api/*) per IP inside the window, then 429. */
export const MAX_WRITES = 30;
export const WRITE_WINDOW_MS = 10 * 60 * 1000;

/** Reiniciar presses per IP inside the window, then 429. The database also allows one reset a minute overall. */
export const MAX_RESETS = 5;
export const RESET_WINDOW_MS = 60 * 60 * 1000;

/** Rides in the database (any state) before the next new ride forces a reset. */
export const MAX_RIDES = 300;

const MAX_TRACKED_IPS = 10_000;

export type Hit = { ok: true } | { ok: false; retryAfterMs: number };

/** A sliding window per key: at most `max` hits inside any `windowMs`. */
export function createWindowLimiter(max: number, windowMs: number) {
	const hits = new Map<string, number[]>();

	return {
		hit(key: string, now = Date.now()): Hit {
			const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
			if (recent.length >= max) {
				hits.set(key, recent);
				return { ok: false, retryAfterMs: windowMs - (now - recent[0]) };
			}
			recent.push(now);
			// Re-insert so Map order tracks recency, then drop the stalest key if full
			hits.delete(key);
			hits.set(key, recent);
			if (hits.size > MAX_TRACKED_IPS) hits.delete(hits.keys().next().value!);
			return { ok: true };
		}
	};
}

// Best-effort brute-force protection for the PIN gate, in memory. Each
// serverless instance keeps its own map, so the real ceiling is per instance;
// paired with a 6-digit PIN, that still keeps guessing impractical.

/** Failures allowed per IP inside the window before a lockout. */
export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_MS = 15 * 60 * 1000;
/** Added to every attempt (right, wrong or locked), so timing says nothing and scripts slow down. */
export const ATTEMPT_DELAY_MS = 500;

const MAX_TRACKED_IPS = 10_000;

type Entry = { failures: number[]; lockedUntil: number };
export type LimitState = { locked: false } | { locked: true; retryAfterMs: number };

export function createLimiter() {
	const entries = new Map<string, Entry>();

	function current(ip: string, now: number): Entry | undefined {
		const entry = entries.get(ip);
		if (!entry) return undefined;
		entry.failures = entry.failures.filter((t) => now - t < FAILURE_WINDOW_MS);
		if (entry.lockedUntil <= now && entry.failures.length === 0) {
			entries.delete(ip);
			return undefined;
		}
		return entry;
	}

	return {
		check(ip: string, now = Date.now()): LimitState {
			const entry = current(ip, now);
			return entry && entry.lockedUntil > now
				? { locked: true, retryAfterMs: entry.lockedUntil - now }
				: { locked: false };
		},

		/** Records a wrong PIN; the MAX_FAILURES-th one inside the window starts the lockout. */
		fail(ip: string, now = Date.now()): LimitState {
			const entry = current(ip, now) ?? { failures: [], lockedUntil: 0 };
			entry.failures.push(now);
			if (entry.failures.length >= MAX_FAILURES) {
				entry.failures = [];
				entry.lockedUntil = now + LOCKOUT_MS;
			}
			// Re-insert so Map order tracks recency, then drop the stalest IP if full.
			entries.delete(ip);
			entries.set(ip, entry);
			if (entries.size > MAX_TRACKED_IPS) entries.delete(entries.keys().next().value!);
			return entry.lockedUntil > now
				? { locked: true, retryAfterMs: entry.lockedUntil - now }
				: { locked: false };
		},

		reset(ip: string) {
			entries.delete(ip);
		}
	};
}

export const pinLimiter = createLimiter();

export function lockoutMinutes(retryAfterMs: number): number {
	return Math.max(1, Math.ceil(retryAfterMs / 60_000));
}

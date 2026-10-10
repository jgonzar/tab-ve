import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemo } from './guard';
import { createWindowLimiter, MAX_RESETS, MAX_WRITES, WRITE_WINDOW_MS } from './limits';
import { resetDemo, type DemoSql } from './reset';

// No database and no network: these cover the limits and the isDemo() gating.

vi.mock('$env/dynamic/private', () => ({ env: {} as Record<string, string | undefined> }));

/** A database that must never be reached. */
const untouchable: DemoSql = {
	query: () => {
		throw new Error('the database was queried');
	},
	transaction: () => {
		throw new Error('the database was written');
	}
};

/** A database where the last reset was a moment ago, so nothing is due. */
function quietDatabase(now: () => number) {
	const calls: string[] = [];
	const sql: DemoSql = {
		query: async (text) => {
			calls.push(text);
			if (text.includes('reset_state')) return [{ reset_at: new Date(now()) }];
			if (text.includes('count(*)')) return [{ n: 14 }];
			return [];
		},
		transaction: async () => {
			calls.push('transaction');
		}
	};
	return { sql, calls };
}

const ip = '203.0.113.7';
const write = (pathname = '/api/viajes', method = 'POST') => ({ method, pathname, ip });

describe('with DEMO_MODE off', () => {
	it('lets every request through without touching the database', async () => {
		const demo = createDemo({ isDemo: () => false, getSql: () => untouchable });
		for (let i = 0; i < MAX_WRITES * 2; i++) {
			expect(await demo.guard(write())).toBeNull();
		}
		expect(await demo.guard({ method: 'GET', pathname: '/', ip })).toBeNull();
	});

	it('refuses Reiniciar as if it did not exist', async () => {
		const demo = createDemo({ isDemo: () => false, getSql: () => untouchable });
		expect(await demo.pressReset(ip)).toEqual({ result: 'not-demo' });
	});
});

describe('isDemo()', () => {
	afterEach(async () => {
		const { env } = await import('$env/dynamic/private');
		delete env.DEMO_MODE;
	});

	it('is on only for DEMO_MODE=on', async () => {
		const { env } = await import('$env/dynamic/private');
		const { isDemo } = await import('../flags');
		expect(isDemo()).toBe(false);
		for (const value of ['', 'true', '1', 'ON', 'off']) {
			env.DEMO_MODE = value;
			expect(isDemo()).toBe(false);
		}
		env.DEMO_MODE = 'on';
		expect(isDemo()).toBe(true);
	});

	it('switches the people the app shows', async () => {
		const { env } = await import('$env/dynamic/private');
		const { isDemo } = await import('../flags');
		const { registerServerDemoCheck } = await import('$lib/demo');
		const { users } = await import('$lib/stores/user.svelte');
		const { defaultConductor } = await import('$lib/rideDefaults');
		registerServerDemoCheck(isDemo);

		expect(users().map((u) => `${u.iniciales} ${u.nombre}`)).toEqual(['JA JA', 'M Marcela', 'MC Maria Carolina']);
		expect(defaultConductor(isDemo())).toBe('MC');

		env.DEMO_MODE = 'on';
		expect(users().map((u) => `${u.iniciales} ${u.nombre}`)).toEqual(['A Ana', 'L Luis', 'C Carla']);
		expect(users().map((u) => u.id)).toEqual([1, 2, 3]);
		expect(defaultConductor(isDemo())).toBe('C');
	});
});

describe('the write cap', () => {
	it(`allows ${MAX_WRITES} writes per IP in ${WRITE_WINDOW_MS / 60_000} minutes, then 429`, async () => {
		let now = 1_000_000;
		const { sql } = quietDatabase(() => now);
		const demo = createDemo({ isDemo: () => true, getSql: () => sql, now: () => now });

		for (let i = 0; i < MAX_WRITES; i++) {
			expect(await demo.guard(write(i % 2 ? '/api/viajes/3' : '/api/viajes', i % 2 ? 'PATCH' : 'POST'))).toBeNull();
		}
		expect(await demo.guard(write('/api/viajes/3', 'DELETE'))).toMatchObject({ reason: 'writes' });

		// Reads, the language switch and other visitors are unaffected
		expect(await demo.guard({ method: 'GET', pathname: '/api/ubicaciones', ip })).toBeNull();
		expect(await demo.guard(write('/api/language'))).toBeNull();
		expect(await demo.guard({ ...write(), ip: '198.51.100.2' })).toBeNull();

		now += WRITE_WINDOW_MS;
		expect(await demo.guard(write())).toBeNull();
	});

	it('reports how long until the oldest write leaves the window', () => {
		const limiter = createWindowLimiter(2, 1000);
		expect(limiter.hit('a', 0)).toEqual({ ok: true });
		expect(limiter.hit('a', 400)).toEqual({ ok: true });
		expect(limiter.hit('a', 500)).toEqual({ ok: false, retryAfterMs: 500 });
		expect(limiter.hit('a', 1000)).toEqual({ ok: true });
	});

	it('skips static assets entirely', async () => {
		const demo = createDemo({ isDemo: () => true, getSql: () => untouchable });
		for (const pathname of ['/_app/immutable/entry/start.js', '/icons/icon-180.png', '/manifest.webmanifest']) {
			expect(await demo.guard({ method: 'GET', pathname, ip })).toBeNull();
		}
	});
});

describe('Reiniciar', () => {
	it(`allows ${MAX_RESETS} presses per IP, then 429`, async () => {
		let now = 5_000_000;
		const sql: DemoSql = { query: async () => [], transaction: async () => {} };
		const demo = createDemo({ isDemo: () => true, getSql: () => sql, now: () => now });
		for (let i = 0; i < MAX_RESETS; i++) {
			expect(await demo.pressReset(ip)).toEqual({ result: 'reset' });
			now += 61_000;
		}
		expect(await demo.pressReset(ip)).toMatchObject({ result: 'limited' });
		expect(await demo.pressReset('198.51.100.2')).toEqual({ result: 'reset' });
	});

	it('is refused while another reset holds the lock or one just ran', async () => {
		const failing = (message: string): DemoSql => ({
			query: async () => [],
			transaction: async () => {
				throw new Error(message);
			}
		});
		expect(await resetDemo(failing('demo_reset_busy'), new Date(), 0)).toBe('busy');
		expect(await resetDemo(failing('demo_reset_not_due'), new Date(), 0)).toBe('not-due');
		await expect(resetDemo(failing('connection refused'), new Date(), 0)).rejects.toThrow('connection refused');

		const demo = createDemo({ isDemo: () => true, getSql: () => failing('demo_reset_not_due') });
		expect(await demo.pressReset(ip)).toMatchObject({ result: 'too-soon' });
	});
});

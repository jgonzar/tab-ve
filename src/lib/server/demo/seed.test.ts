import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './pglite.test-helper';
import { caracasParts, DEMO_LOCATIONS } from './seed';
import {
	countRides,
	createLazyReset,
	lastResetAt,
	MIN_RESET_GAP_MS,
	RESET_EVERY_MS,
	resetDemo,
	type DemoSql
} from './reset';
import { createDemo } from './guard';
import { MAX_RIDES } from './limits';
import type { PGlite } from '@electric-sql/pglite';

// A fixed "now": Thursday 17 September 2026, 3:45 p.m. in Caracas
const NOW = new Date('2026-09-17T15:45:00-04:00');
const QUICK_ROUTE_PLACES = ['El Rocío', 'El Limón', 'Rosalito', 'La Redoma', 'Fresco Market'];

type Ride = {
	id: number;
	creado_en: Date;
	pagado_en: Date | null;
	borrado_en: Date | null;
	conductor_nombre: string;
	precio_usd: string | null;
	minutos_espera: number | null;
	notas: string | null;
};

let pg: PGlite;
let sql: DemoSql;

beforeEach(async () => {
	({ pg, sql } = await freshDatabase());
});

async function rows<T>(text: string): Promise<T[]> {
	return (await pg.query<T>(text)).rows;
}

async function count(table: string): Promise<number> {
	const [row] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
	return row.n;
}

/** "2026-09-17 07:40" in Caracas */
function caracasWall(d: Date): string {
	const p = caracasParts(d);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

async function rides(): Promise<Ride[]> {
	return rows<Ride>('SELECT * FROM viajes ORDER BY id');
}

/** Adds visitor-made data: a ride with a new place, as the API would. */
async function addVisitorRide() {
	await pg.exec(`
		INSERT INTO ubicaciones (nombre) VALUES ('Casa de un visitante');
		INSERT INTO viajes (precio_usd, notas) VALUES ('99.00', 'hecho por un visitante');
		INSERT INTO viaje_clientes (viaje_id, usuario_id) SELECT max(id), 1 FROM viajes;
		INSERT INTO viaje_paradas (viaje_id, orden, ubicacion_id) SELECT (SELECT max(id) FROM viajes), 0, max(id) FROM ubicaciones;
	`);
}

describe('the demo seed', () => {
	beforeEach(async () => {
		expect(await resetDemo(sql, NOW, RESET_EVERY_MS)).toBe('reset');
	});

	it('inserts the expected counts', async () => {
		expect(await count('usuarios')).toBe(3);
		expect(await count('ubicaciones')).toBe(DEMO_LOCATIONS.length);
		expect(await count('viajes')).toBe(14);
		expect(await count('viaje_clientes')).toBe(26);
		expect(await count('viaje_paradas')).toBe(30);
	});

	it('has the neutral people, with the clients as ids 1 and 2', async () => {
		expect(await rows('SELECT id, nombre, iniciales, rol FROM usuarios ORDER BY id')).toEqual([
			{ id: 1, nombre: 'Ana', iniciales: 'A', rol: 'cliente' },
			{ id: 2, nombre: 'Luis', iniciales: 'L', rol: 'cliente' },
			{ id: 3, nombre: 'Carla', iniciales: 'C', rol: 'conductora' }
		]);
		const drivers = await rows<{ conductor_nombre: string }>('SELECT DISTINCT conductor_nombre FROM viajes');
		expect(drivers).toEqual([{ conductor_nombre: 'C' }]);
	});

	it('includes every quick-route place', async () => {
		const names = (await rows<{ nombre: string }>('SELECT nombre FROM ubicaciones')).map((r) => r.nombre);
		for (const place of QUICK_ROUTE_PLACES) expect(names).toContain(place);
	});

	it('covers every state the UI shows', async () => {
		const all = await rides();
		const pending = all.filter((r) => !r.pagado_en && !r.borrado_en);
		const paid = all.filter((r) => r.pagado_en && !r.borrado_en);
		const deleted = all.filter((r) => r.borrado_en);
		const stops = await rows<{ viaje_id: number; n: number }>(
			'SELECT viaje_id, count(*)::int AS n FROM viaje_paradas GROUP BY viaje_id'
		);

		expect(pending).toHaveLength(5);
		expect(pending.some((r) => r.precio_usd !== null)).toBe(true);
		expect(pending.some((r) => r.precio_usd === null)).toBe(true); // "Sin precio"
		expect(pending.some((r) => r.minutos_espera)).toBe(true);
		expect(pending.some((r) => r.notas)).toBe(true);
		expect(stops.some((s) => pending.some((r) => r.id === s.viaje_id) && s.n > 2)).toBe(true); // a stop
		expect(paid).toHaveLength(7); // Historial
		expect(deleted).toHaveLength(2); // Papelera
	});

	it('places rides at exact Caracas wall times relative to now', async () => {
		const all = await rides();
		const at = (id: number) => all.find((r) => r.id === id)!;

		expect(caracasWall(at(1).creado_en)).toBe('2026-09-17 07:40');
		expect(at(1).creado_en.toISOString()).toBe('2026-09-17T11:40:00.000Z');
		expect(caracasWall(at(2).creado_en)).toBe('2026-09-17 12:50');
		expect(caracasWall(at(3).creado_en)).toBe('2026-09-16 16:30');
		expect(caracasWall(at(5).creado_en)).toBe('2026-09-15 18:20');
		expect(caracasWall(at(6).pagado_en!)).toBe('2026-09-14 19:30');
		expect(caracasWall(at(10).pagado_en!)).toBe('2026-09-09 19:00');
		expect(caracasWall(at(13).borrado_en!)).toBe('2026-09-15 09:45');

		for (const r of all) {
			expect(r.creado_en.getTime()).toBeLessThanOrEqual(NOW.getTime());
			if (r.pagado_en) expect(r.pagado_en.getTime()).toBeGreaterThanOrEqual(r.creado_en.getTime());
			if (r.borrado_en) expect(r.borrado_en.getTime()).toBeGreaterThanOrEqual(r.creado_en.getTime());
		}
	});

	it('records the reset time in its own table', async () => {
		expect((await lastResetAt(sql))?.toISOString()).toBe(NOW.toISOString());
	});

	it('leaves the sequences past the seeded ids', async () => {
		const [ride] = await rows<{ id: number }>("INSERT INTO viajes (notas) VALUES ('x') RETURNING id");
		const [place] = await rows<{ id: number }>("INSERT INTO ubicaciones (nombre) VALUES ('Nueva') RETURNING id");
		expect(ride.id).toBe(15);
		expect(place.id).toBe(DEMO_LOCATIONS.length + 1);
	});
});

describe('the reset', () => {
	it('has no reset time on a fresh database', async () => {
		expect(await lastResetAt(sql)).toBeNull();
	});

	it('wipes visitor data and reseeds whole, ids starting over', async () => {
		await resetDemo(sql, NOW, RESET_EVERY_MS);
		const before = await rides();
		await addVisitorRide();
		await pg.exec('UPDATE viajes SET pagado_en = now() WHERE id = 1; UPDATE viajes SET borrado_en = now() WHERE id = 2;');

		const later = new Date(NOW.getTime() + RESET_EVERY_MS + 1000);
		expect(await resetDemo(sql, later, RESET_EVERY_MS)).toBe('reset');

		expect(await count('viajes')).toBe(14);
		expect(await count('ubicaciones')).toBe(DEMO_LOCATIONS.length);
		expect(await rows("SELECT * FROM ubicaciones WHERE nombre = 'Casa de un visitante'")).toEqual([]);
		const after = await rides();
		expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
		expect(after.filter((r) => !r.pagado_en && !r.borrado_en)).toHaveLength(5);
		expect((await lastResetAt(sql))?.toISOString()).toBe(later.toISOString());
	});

	it('skips a reset that is not due, and leaves the data alone', async () => {
		await resetDemo(sql, NOW, RESET_EVERY_MS);
		await addVisitorRide();
		const hourLater = new Date(NOW.getTime() + 60 * 60 * 1000);
		expect(await resetDemo(sql, hourLater, RESET_EVERY_MS)).toBe('not-due');
		expect(await count('viajes')).toBe(15);
		expect((await lastResetAt(sql))?.toISOString()).toBe(NOW.toISOString());
	});

	it('allows Reiniciar a minute after the last reset, not sooner', async () => {
		await resetDemo(sql, NOW, RESET_EVERY_MS);
		expect(await resetDemo(sql, new Date(NOW.getTime() + 30_000), MIN_RESET_GAP_MS)).toBe('not-due');
		expect(await resetDemo(sql, new Date(NOW.getTime() + 61_000), MIN_RESET_GAP_MS)).toBe('reset');
	});

	it('keeps rides in the past early in the morning', async () => {
		const early = new Date('2026-09-17T06:00:00-04:00');
		await resetDemo(sql, early, RESET_EVERY_MS);
		const all = await rides();
		for (const r of all) expect(r.creado_en.getTime()).toBeLessThanOrEqual(early.getTime());
		// 7:40 hasn't happened yet today, so the morning ride is yesterday's
		expect(caracasWall(all[0].creado_en)).toBe('2026-09-16 07:40');
	});
});

describe('the lazy reset', () => {
	it('seeds a fresh database on the first request, then waits a minute to check again', async () => {
		let queries = 0;
		const counted: DemoSql = {
			query: (t, p) => (queries++, sql.query(t, p)),
			transaction: (s) => sql.transaction(s)
		};
		const maybeReset = createLazyReset(() => counted);

		await maybeReset(NOW);
		expect(await count('viajes')).toBe(14);
		expect(queries).toBe(1);

		await maybeReset(new Date(NOW.getTime() + 30_000));
		expect(queries).toBe(1); // throttled

		await addVisitorRide();
		await maybeReset(new Date(NOW.getTime() + 2 * 60_000));
		expect(queries).toBe(2); // checked, not due
		expect(await count('viajes')).toBe(15);

		await maybeReset(new Date(NOW.getTime() + RESET_EVERY_MS + 60_000));
		expect(await count('viajes')).toBe(14); // due: reseeded
	});
});

describe('the ride cap', () => {
	it('forces a reset when the rides reach the cap', async () => {
		await resetDemo(sql, NOW, RESET_EVERY_MS);
		await pg.exec(`INSERT INTO viajes (notas) SELECT 'relleno' FROM generate_series(1, ${MAX_RIDES - 14})`);
		expect(await countRides(sql)).toBe(MAX_RIDES);

		let now = NOW.getTime() + 10 * 60_000;
		const demo = createDemo({ isDemo: () => true, getSql: () => sql, now: () => now });
		const post = { method: 'POST', pathname: '/api/viajes', ip: '203.0.113.1' };

		expect(await demo.guard(post)).toBeNull();
		expect(await countRides(sql)).toBe(14);

		// Filled up again within a minute of that reset: refused, not reset again
		await pg.exec(`INSERT INTO viajes (notas) SELECT 'relleno' FROM generate_series(1, ${MAX_RIDES - 14})`);
		now += 20_000;
		expect(await demo.guard(post)).toMatchObject({ reason: 'full' });
		expect(await countRides(sql)).toBe(MAX_RIDES);
	});
});

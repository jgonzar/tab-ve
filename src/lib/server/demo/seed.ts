// The demo's sample data. Separate from scripts/seed.ts, which has the real
// names. Everything here is plain data plus the SQL that inserts it, with no
// database import, so the reset (./reset.ts) and its tests run it against any
// Postgres: Neon on the demo deployment, PGlite in the tests.
//
// Ride times are wall-clock times in Caracas, relative to "now", so the demo
// always looks current: this morning's ride, yesterday's stop at Fresco
// Market, last week's paid rides. Content is neutral Spanish. Notes are data,
// so they are never translated.

import { DEFAULT_CLIENT_IDS, DEMO_CONDUCTOR } from '$lib/rideDefaults';

export const DEMO_TIME_ZONE = 'America/Caracas';

/** A parameterized statement, run inside the reset's single transaction. */
export type Statement = { text: string; params: unknown[] };

export const DEMO_USERS = [
	{ id: 1, nombre: 'Ana', iniciales: 'A', rol: 'cliente' },
	{ id: 2, nombre: 'Luis', iniciales: 'L', rol: 'cliente' },
	{ id: 3, nombre: 'Carla', iniciales: 'C', rol: 'conductora' }
] as const;

/** Public places in Caracas, including every quick-route place (QuickRides, LocationChips). */
export const DEMO_LOCATIONS = [
	'Sambil Chacao',
	'Sambil La Candelaria',
	'San Ignacio',
	'Cerro Verde',
	'CCCT',
	'Las Mercedes',
	'Altamira',
	'Los Palos Grandes',
	'El Picacho',
	'El Retiro',
	'Líder',
	'Millenium',
	'El Limón',
	'El Rocío',
	'Rosalito',
	'Bello Monte',
	'Prime',
	'El 93',
	'Galerías Las Américas',
	'Ferretotal',
	'El Coliseo',
	'La Casona',
	'La Superior',
	'Los Altos',
	'La Redoma',
	'Fresco Market'
] as const;

type Place = (typeof DEMO_LOCATIONS)[number];

/** A Caracas wall-clock time, `daysAgo` days before today. */
type Wall = { daysAgo: number; hour: number; minute: number };

type RideSpec = {
	at: Wall;
	route: Place[];
	precioUsd: string | null;
	minutosEspera?: number;
	notas?: string;
	clientes?: number[];
	pagadoEn?: Wall;
	borradoEn?: Wall;
};

const wall = (daysAgo: number, hour: number, minute: number): Wall => ({ daysAgo, hour, minute });

// Paid in two batches, the way the household settles up
const PAID_THIS_WEEK = wall(3, 19, 30);
const PAID_LAST_WEEK = wall(8, 19, 0);

/** Every state the UI shows. Pending first (Inicio), then paid (Historial), then deleted (Papelera). */
const RIDES: RideSpec[] = [
	// Pending
	{ at: wall(0, 7, 40), route: ['El Rocío', 'El Limón'], precioUsd: '6.00' },
	{ at: wall(0, 12, 50), route: ['El Limón', 'El Rocío'], precioUsd: null },
	{ at: wall(1, 16, 30), route: ['Rosalito', 'Fresco Market', 'El Limón'], precioUsd: '9.50' },
	{ at: wall(1, 8, 5), route: ['La Redoma', 'El Rocío'], precioUsd: '7.00', minutosEspera: 15 },
	{
		at: wall(2, 18, 20),
		route: ['Sambil Chacao', 'El Rocío'],
		precioUsd: '12.00',
		notas: 'Recoger en la entrada principal.',
		clientes: [1]
	},
	// Paid
	{ at: wall(4, 7, 40), route: ['El Rocío', 'El Limón'], precioUsd: '6.00', pagadoEn: PAID_THIS_WEEK },
	{ at: wall(4, 17, 10), route: ['Las Mercedes', 'El Rocío'], precioUsd: '10.00', minutosEspera: 10, pagadoEn: PAID_THIS_WEEK },
	{ at: wall(5, 9, 0), route: ['El Limón', 'CCCT', 'El Rocío'], precioUsd: '11.50', clientes: [2], pagadoEn: PAID_THIS_WEEK },
	{ at: wall(6, 13, 20), route: ['Rosalito', 'El Limón'], precioUsd: '8.00', notas: 'Con dos maletas.', pagadoEn: PAID_THIS_WEEK },
	{ at: wall(9, 7, 35), route: ['El Rocío', 'El Limón'], precioUsd: '6.00', pagadoEn: PAID_LAST_WEEK },
	{ at: wall(10, 18, 0), route: ['Altamira', 'La Redoma'], precioUsd: '14.00', pagadoEn: PAID_LAST_WEEK },
	{ at: wall(11, 10, 15), route: ['El Limón', 'Bello Monte'], precioUsd: '9.00', pagadoEn: PAID_LAST_WEEK },
	// Deleted
	{ at: wall(2, 9, 30), route: ['El Rocío', 'El Limón'], precioUsd: '6.00', notas: 'Registrada dos veces.', borradoEn: wall(2, 9, 45) },
	{ at: wall(5, 15, 0), route: ['Los Palos Grandes', 'El Rocío'], precioUsd: null, borradoEn: wall(4, 8, 0) }
];

// --- Caracas wall time to an instant, with Intl rather than the server's zone

const partsFormat = new Intl.DateTimeFormat('en-US', {
	timeZone: DEMO_TIME_ZONE,
	hourCycle: 'h23',
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	hour: 'numeric',
	minute: 'numeric',
	second: 'numeric'
});

/** The Caracas calendar date and clock time of an instant. */
export function caracasParts(instant: Date) {
	const parts: Record<string, number> = {};
	for (const p of partsFormat.formatToParts(instant)) {
		if (p.type !== 'literal') parts[p.type] = Number(p.value);
	}
	return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** How far Caracas wall time is from UTC at this instant, in ms. */
function offsetMs(instant: Date): number {
	const p = caracasParts(instant);
	const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant of a Caracas wall-clock time, `daysAgo` days before now's Caracas date. */
export function caracasTime(now: Date, { daysAgo, hour, minute }: Wall): Date {
	const today = caracasParts(now);
	const guess = Date.UTC(today.year, today.month - 1, today.day - daysAgo, hour, minute);
	// Two passes, so a zone with daylight saving would land right too
	const first = guess - offsetMs(new Date(guess));
	return new Date(guess - offsetMs(new Date(first)));
}

/** A wall time, moved back a day if it hasn't happened yet today. */
function past(now: Date, at: Wall): Date {
	const t = caracasTime(now, at);
	return t > now ? caracasTime(now, { ...at, daysAgo: at.daysAgo + 1 }) : t;
}

// --- The rows

export type DemoRide = {
	id: number;
	creadoEn: Date;
	pagadoEn: Date | null;
	borradoEn: Date | null;
	precioUsd: string | null;
	minutosEspera: number | null;
	notas: string | null;
	clientes: number[];
	paradas: number[]; // ubicaciones ids, origin first, destination last
};

const locationId = (name: Place) => DEMO_LOCATIONS.indexOf(name) + 1;

export function demoRides(now: Date): DemoRide[] {
	return RIDES.map((spec, i) => {
		const creadoEn = past(now, spec.at);
		// Never before the ride itself, never after now
		const after = (w?: Wall) => {
			if (!w) return null;
			const t = past(now, w);
			return t < creadoEn ? creadoEn : t;
		};
		return {
			id: i + 1,
			creadoEn,
			pagadoEn: after(spec.pagadoEn),
			borradoEn: after(spec.borradoEn),
			precioUsd: spec.precioUsd,
			minutosEspera: spec.minutosEspera ?? null,
			notas: spec.notas ?? null,
			clientes: spec.clientes ?? DEFAULT_CLIENT_IDS,
			paradas: spec.route.map(locationId)
		};
	});
}

// --- The SQL

const quote = (identifier: string) => `"${identifier}"`;

/** One multi-row INSERT with numbered parameters. */
function insert(table: string, columns: string[], rows: unknown[][]): Statement {
	const params: unknown[] = [];
	const values = rows.map(
		(row) =>
			`(${row
				.map((value) => {
					params.push(value);
					return `$${params.length}`;
				})
				.join(', ')})`
	);
	return {
		text: `INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES ${values.join(', ')}`,
		params
	};
}

/** Points a serial column's sequence past the explicit ids, so later inserts don't collide. */
const syncSequence = (table: string): Statement => ({
	text: `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT max(id) FROM ${quote(table)}))`,
	params: []
});

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * The inserts for a freshly truncated database. Ids are explicit, so the
 * clients are 1 and 2 (DEFAULT_CLIENT_IDS) and the rides can reference their
 * places without a round trip.
 */
export function seedStatements(now: Date): Statement[] {
	const rides = demoRides(now);
	return [
		insert(
			'usuarios',
			['id', 'nombre', 'iniciales', 'rol'],
			DEMO_USERS.map((u) => [u.id, u.nombre, u.iniciales, u.rol])
		),
		insert(
			'ubicaciones',
			['id', 'nombre'],
			DEMO_LOCATIONS.map((name, i) => [i + 1, name])
		),
		insert(
			'viajes',
			['id', 'creado_en', 'pagado_en', 'borrado_en', 'conductor_nombre', 'precio_usd', 'minutos_espera', 'notas'],
			rides.map((r) => [
				r.id,
				iso(r.creadoEn),
				iso(r.pagadoEn),
				iso(r.borradoEn),
				DEMO_CONDUCTOR,
				r.precioUsd,
				r.minutosEspera,
				r.notas
			])
		),
		insert(
			'viaje_clientes',
			['viaje_id', 'usuario_id'],
			rides.flatMap((r) => r.clientes.map((c) => [r.id, c]))
		),
		insert(
			'viaje_paradas',
			['viaje_id', 'orden', 'ubicacion_id'],
			rides.flatMap((r) => r.paradas.map((place, orden) => [r.id, orden, place]))
		),
		syncSequence('usuarios'),
		syncSequence('ubicaciones'),
		syncSequence('viajes')
	];
}

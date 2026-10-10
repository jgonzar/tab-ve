import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { viajes, viajeClientes, viajeParadas, ubicaciones } from '$lib/server/schema';
import { sql, isNull, and } from 'drizzle-orm';
import { m } from '$lib/paraglide/messages.js';

type FormLoc = { id: number | null; nombre: string };

async function resolveLocation(loc: FormLoc): Promise<number> {
	if (loc.id !== null) return loc.id;
	const [row] = await db
		.insert(ubicaciones)
		.values({ nombre: loc.nombre.trim() })
		.onConflictDoUpdate({
			target: ubicaciones.nombre,
			set: { nombre: sql`excluded.nombre` }
		})
		.returning({ id: ubicaciones.id });
	return row.id;
}

export const PATCH: RequestHandler = async () => {
	const updated = await db
		.update(viajes)
		.set({ pagadoEn: new Date() })
		.where(and(isNull(viajes.pagadoEn), isNull(viajes.borradoEn)))
		.returning({ id: viajes.id });
	return json({ count: updated.length });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body) error(400, m.api_invalid_body());

	const {
		clienteIds,
		conductorNombre,
		origen,
		paradas = [],
		destino,
		precioUsd,
		minutosEspera,
		notas,
		creadoEn
	} = body;

	if (!clienteIds?.length) error(400, m.api_client_required());
	if (!origen) error(400, m.api_origin_required());
	if (!destino) error(400, m.api_destination_required());

	try {
		const origenId = await resolveLocation(origen);
		const paradaIds: number[] = [];
		for (const p of paradas) {
			paradaIds.push(await resolveLocation(p));
		}
		const destinoId = await resolveLocation(destino);

		const [newViaje] = await db
			.insert(viajes)
			.values({
				conductorNombre: conductorNombre || 'MC',
				precioUsd: precioUsd ? String(precioUsd) : null,
				minutosEspera: minutosEspera ?? null,
				notas: notas || null,
				...(creadoEn ? { creadoEn: new Date(creadoEn + 'T12:00:00Z') } : {})
			})
			.returning();

		await db.insert(viajeClientes).values(
			clienteIds.map((uid: number) => ({ viajeId: newViaje.id, usuarioId: uid }))
		);

		const stops = [
			{ viajeId: newViaje.id, ubicacionId: origenId, orden: 0 },
			...paradaIds.map((id, i) => ({
				viajeId: newViaje.id,
				ubicacionId: id,
				orden: i + 1
			})),
			{ viajeId: newViaje.id, ubicacionId: destinoId, orden: paradaIds.length + 1 }
		];
		await db.insert(viajeParadas).values(stops);

		return json(newViaje, { status: 201 });
	} catch (e) {
		console.error('[POST /api/viajes]', e);
		error(500, m.api_create_failed());
	}
};

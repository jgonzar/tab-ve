import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { viajes, viajeClientes, viajeParadas, ubicaciones } from '$lib/server/schema';
import { eq, isNull, sql } from 'drizzle-orm';

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

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'ID inválido');

	const body = await request.json().catch(() => null);

	// Restore deleted ride
	if (body?.restore === true) {
		const [updated] = await db
			.update(viajes)
			.set({ borradoEn: null })
			.where(eq(viajes.id, id))
			.returning();
		if (!updated) error(404, 'Carrera no encontrada');
		return json(updated);
	}

	// Undo a payment — the ride goes back to pending
	if (body?.unpay === true) {
		const [updated] = await db
			.update(viajes)
			.set({ pagadoEn: null })
			.where(eq(viajes.id, id))
			.returning();
		if (!updated) error(404, 'Carrera no encontrada');
		return json(updated);
	}

	// Price update
	if (body?.precioUsd !== undefined) {
		const val = parseFloat(body.precioUsd);
		if (isNaN(val) || val < 0) error(400, 'Precio inválido');
		const [updated] = await db
			.update(viajes)
			.set({ precioUsd: String(val) })
			.where(eq(viajes.id, id))
			.returning();
		if (!updated) error(404, 'Carrera no encontrada');
		return json(updated);
	}

	// Default: mark as paid
	const [updated] = await db
		.update(viajes)
		.set({ pagadoEn: new Date() })
		.where(eq(viajes.id, id))
		.returning();
	if (!updated) error(404, 'Carrera no encontrada');
	return json(updated);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'ID inválido');

	const body = await request.json().catch(() => null);
	if (!body) error(400, 'Cuerpo de solicitud inválido');

	const { clienteIds, conductorNombre, origen, paradas = [], destino, precioUsd, minutosEspera, notas, creadoEn } = body;

	if (!clienteIds?.length) error(400, 'Se requiere al menos un cliente');
	if (!origen) error(400, 'Origen requerido');
	if (!destino) error(400, 'Destino requerido');

	try {
		const origenId = await resolveLocation(origen);
		const paradaIds: number[] = [];
		for (const p of paradas) {
			paradaIds.push(await resolveLocation(p));
		}
		const destinoId = await resolveLocation(destino);

		const [updated] = await db
			.update(viajes)
			.set({
				conductorNombre: conductorNombre || 'MC',
				precioUsd: precioUsd ? String(precioUsd) : null,
				minutosEspera: minutosEspera ?? null,
				notas: notas || null,
				...(creadoEn ? { creadoEn: new Date(creadoEn + 'T12:00:00Z') } : {})
			})
			.where(eq(viajes.id, id))
			.returning();

		if (!updated) error(404, 'Carrera no encontrada');

		await db.delete(viajeClientes).where(eq(viajeClientes.viajeId, id));
		await db.insert(viajeClientes).values(
			clienteIds.map((uid: number) => ({ viajeId: id, usuarioId: uid }))
		);

		await db.delete(viajeParadas).where(eq(viajeParadas.viajeId, id));
		await db.insert(viajeParadas).values([
			{ viajeId: id, ubicacionId: origenId, orden: 0 },
			...paradaIds.map((pid, i) => ({ viajeId: id, ubicacionId: pid, orden: i + 1 })),
			{ viajeId: id, ubicacionId: destinoId, orden: paradaIds.length + 1 }
		]);

		return json(updated);
	} catch (e) {
		console.error('[PUT /api/viajes/:id]', e);
		error(500, 'Error al actualizar la carrera');
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'ID inválido');

	const [updated] = await db
		.update(viajes)
		.set({ borradoEn: new Date() })
		.where(eq(viajes.id, id))
		.returning();
	if (!updated) error(404, 'Carrera no encontrada');

	return new Response(null, { status: 204 });
};

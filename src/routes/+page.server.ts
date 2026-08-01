import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { viajes, viajeClientes, viajeParadas, ubicaciones, usuarios } from '$lib/server/schema';
import { isNull, desc, asc, inArray, eq, and } from 'drizzle-orm';
import { getTasaBcv } from '$lib/server/bcv';

export const load: PageServerLoad = async () => {
	const [pendientes, tasaResult] = await Promise.all([
		db.select().from(viajes).where(and(isNull(viajes.pagadoEn), isNull(viajes.borradoEn))).orderBy(desc(viajes.creadoEn)),
		getTasaBcv()
	]);

	const tasa = tasaResult ? { tasa: tasaResult.tasa, stale: tasaResult.stale } : null;

	if (pendientes.length === 0) return { viajes: [], tasa };

	const ids = pendientes.map((v) => v.id);

	const [clienteRows, paradaRows] = await Promise.all([
		db
			.select({ viajeId: viajeClientes.viajeId, usuarioId: usuarios.id, nombre: usuarios.nombre })
			.from(viajeClientes)
			.innerJoin(usuarios, eq(viajeClientes.usuarioId, usuarios.id))
			.where(inArray(viajeClientes.viajeId, ids)),

		db
			.select({
				viajeId: viajeParadas.viajeId,
				orden: viajeParadas.orden,
				ubicacionId: ubicaciones.id,
				nombre: ubicaciones.nombre
			})
			.from(viajeParadas)
			.innerJoin(ubicaciones, eq(viajeParadas.ubicacionId, ubicaciones.id))
			.where(inArray(viajeParadas.viajeId, ids))
			.orderBy(asc(viajeParadas.orden))
	]);

	return {
		tasa,
		viajes: pendientes.map((v) => ({
			id: v.id,
			creadoEn: v.creadoEn,
			precioUsd: v.precioUsd,
			minutosEspera: v.minutosEspera,
			notas: v.notas,
			clientes: clienteRows
				.filter((c) => c.viajeId === v.id)
				.map((c) => ({ id: c.usuarioId, nombre: c.nombre })),
			paradas: paradaRows
				.filter((p) => p.viajeId === v.id)
				.sort((a, b) => a.orden - b.orden)
				.map((p) => ({ id: p.ubicacionId, nombre: p.nombre }))
		}))
	};
};

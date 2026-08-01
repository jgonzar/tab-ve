import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { viajes, viajeClientes, viajeParadas, ubicaciones, usuarios } from '$lib/server/schema';
import { isNotNull, isNull, desc, asc, inArray, eq, and } from 'drizzle-orm';
import { getTasaBcv } from '$lib/server/bcv';

export const load: PageServerLoad = async () => {
	const [pagados, borrados, tasaResult] = await Promise.all([
		db.select().from(viajes).where(and(isNotNull(viajes.pagadoEn), isNull(viajes.borradoEn))).orderBy(desc(viajes.pagadoEn)),
		db.select().from(viajes).where(isNotNull(viajes.borradoEn)).orderBy(desc(viajes.borradoEn)),
		getTasaBcv()
	]);

	const tasa = tasaResult ? { tasa: tasaResult.tasa, stale: tasaResult.stale } : null;

	async function enrichViajes(rows: typeof pagados) {
		if (rows.length === 0) return [];
		const ids = rows.map((v) => v.id);
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

		return rows.map((v) => ({
			id: v.id,
			creadoEn: v.creadoEn,
			pagadoEn: v.pagadoEn,
			borradoEn: v.borradoEn,
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
		}));
	}

	const [viajesData, borradosData] = await Promise.all([
		enrichViajes(pagados),
		enrichViajes(borrados)
	]);

	return { tasa, viajes: viajesData, borrados: borradosData };
};

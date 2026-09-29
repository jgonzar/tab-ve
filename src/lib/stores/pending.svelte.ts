import { USERS } from './user.svelte';

const STORAGE_KEY = 'tab_pending_rides';

export type PendingRide = {
	localId: string;
	creadoEn: string;
	clienteIds: number[];
	origenNombre: string;
	paradaNombres: string[];
	destinoNombre: string;
	precioUsd: string;
	minutosEspera?: number;
	notas?: string;
	payload: unknown;
};

class PendingStore {
	rides = $state<PendingRide[]>([]);

	init() {
		if (typeof window === 'undefined') return;
		try {
			this.rides = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		} catch {
			this.rides = [];
		}
	}

	add(ride: PendingRide) {
		this.rides = [...this.rides, ride];
		this.save();
	}

	remove(localId: string) {
		this.rides = this.rides.filter((r) => r.localId !== localId);
		this.save();
	}

	toRideData(ride: PendingRide) {
		return {
			id: -parseInt(ride.localId.slice(-9)), // negative local ID, never collides with server
			creadoEn: ride.creadoEn,
			pagadoEn: null,
			precioUsd: ride.precioUsd,
			minutosEspera: ride.minutosEspera ?? null,
			notas: ride.notas ?? null,
			clientes: ride.clienteIds
				.map((id) => USERS.find((u) => u.id === id))
				.filter((u) => u !== undefined)
				.map((u) => ({ id: u!.id, nombre: u!.nombre })),
			paradas: [
				{ id: -1, nombre: ride.origenNombre },
				...ride.paradaNombres.map((n, i) => ({ id: -(i + 2), nombre: n })),
				{ id: -(ride.paradaNombres.length + 2), nombre: ride.destinoNombre }
			]
		};
	}

	private save() {
		if (typeof window === 'undefined') return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rides));
	}
}

export const pendingStore = new PendingStore();

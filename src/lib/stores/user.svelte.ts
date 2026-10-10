import { demoMode } from '$lib/demo';

export type User = {
	id: number;
	nombre: string;
	iniciales: string;
	rol: 'cliente' | 'conductora';
};

const HOUSEHOLD: User[] = [
	{ id: 1, nombre: 'JA', iniciales: 'JA', rol: 'cliente' },
	{ id: 2, nombre: 'Marcela', iniciales: 'M', rol: 'cliente' },
	{ id: 3, nombre: 'Maria Carolina', iniciales: 'MC', rol: 'conductora' }
];

// The demo's people, with the same ids and roles. They match the demo seed
// (lib/server/demo/seed.ts), so the real names never appear in the demo.
const DEMO_PEOPLE: User[] = [
	{ id: 1, nombre: 'Ana', iniciales: 'A', rol: 'cliente' },
	{ id: 2, nombre: 'Luis', iniciales: 'L', rol: 'cliente' },
	{ id: 3, nombre: 'Carla', iniciales: 'C', rol: 'conductora' }
];

/** The three people on "¿Quién eres?" and in the user menu. */
export function users(): User[] {
	return demoMode() ? DEMO_PEOPLE : HOUSEHOLD;
}

const STORAGE_KEY = 'tab_active_user';

class UserState {
	activeUser = $state<User | null>(null);

	init() {
		if (typeof window === 'undefined') return;
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return;
		try {
			this.activeUser = JSON.parse(stored);
		} catch {
			this.activeUser = null;
		}
	}

	setUser(user: User) {
		this.activeUser = user;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
		}
	}
}

export const userState = new UserState();

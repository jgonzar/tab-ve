export type User = {
	id: number;
	nombre: string;
	iniciales: string;
	rol: 'cliente' | 'conductora';
};

export const USERS: User[] = [
	{ id: 1, nombre: 'JA', iniciales: 'JA', rol: 'cliente' },
	{ id: 2, nombre: 'Marcela', iniciales: 'M', rol: 'cliente' },
	{ id: 3, nombre: 'Maria Carolina', iniciales: 'MC', rol: 'conductora' }
];

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

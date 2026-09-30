<script lang="ts">
	import { networkState } from '$lib/stores/network.svelte';
	import { DEFAULT_CLIENT_IDS } from '$lib/rideDefaults';
	import { pendingStore } from '$lib/stores/pending.svelte';
	import QuickRideModal, { type QuickRoute, type SubmitResult } from './QuickRideModal.svelte';

	const ROUTES: QuickRoute[] = [
		{ label: 'El Rocío → El Limón',           origen: 'El Rocío',  destino: 'El Limón' },
		{ label: 'El Limón → El Rocío',           origen: 'El Limón',  destino: 'El Rocío' },
		{ label: 'Rosalito → El Limón',           origen: 'Rosalito',  destino: 'El Limón' },
		{ label: 'La Redoma → El Rocío',          origen: 'La Redoma', destino: 'El Rocío' },
		{ label: 'Rosalito → Fresco → El Limón',  origen: 'Rosalito',  paradas: ['Fresco Market'], destino: 'El Limón' }
	];


	let { onCreated }: { onCreated?: () => void } = $props();

	let modal: QuickRideModal;

	// Runs from the modal's "Registrar carrera" (and "Reintentar"). The modal
	// shows the outcome, so there are no toasts here.
	async function submit(route: QuickRoute): Promise<SubmitResult> {
		const paradaObjs = (route.paradas ?? []).map((n) => ({ id: null, nombre: n }));

		const payload = {
			clienteIds: DEFAULT_CLIENT_IDS,
			origen: { id: null, nombre: route.origen },
			paradas: paradaObjs,
			destino: { id: null, nombre: route.destino },
			precioUsd: '',
			minutosEspera: undefined,
			notas: undefined
		};

		if (!networkState.online) {
			pendingStore.add({
				localId: Date.now().toString(),
				creadoEn: new Date().toISOString(),
				clienteIds: DEFAULT_CLIENT_IDS,
				origenNombre: route.origen,
				paradaNombres: route.paradas ?? [],
				destinoNombre: route.destino,
				precioUsd: '',
				payload
			});
			// No onCreated: the queued card shows straight from pendingStore, and
			// refetching the page data offline fails into SvelteKit's error page
			return 'queued';
		}

		try {
			const res = await fetch('/api/viajes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) throw new Error();
			onCreated?.();
			return 'saved';
		} catch {
			return 'error';
		}
	}
</script>

<!-- -mx-4 px-4: the row scrolls out to the screen edge while the first chip
     stays on the gutter. py-1 leaves room for the focus ring inside the scroll
     box; -mt-1 and mb-3 pay it back, keeping the 16px gap to the summary bar. -->
<div class="-mx-4 px-4 -mt-1 py-1 mb-3 flex gap-2 overflow-x-auto no-scrollbar">
	{#each ROUTES as route}
		<button
			class="badge badge-outline border border-base-content/20 h-11 px-4 text-sm shrink-0 cursor-pointer"
			aria-haspopup="dialog"
			onclick={(e) => modal.open(route, e.currentTarget)}
		>
			{route.label}
		</button>
	{/each}
</div>

<QuickRideModal bind:this={modal} onSubmit={submit} />

<script lang="ts">
	import { networkState } from '$lib/stores/network.svelte';
	import { DEFAULT_CLIENT_IDS } from '$lib/rideDefaults';
	import { pendingStore } from '$lib/stores/pending.svelte';
	import { sileo } from 'svelte-sileo';

	type QuickRoute = { label: string; origen: string; paradas?: string[]; destino: string };

	const ROUTES: QuickRoute[] = [
		{ label: 'El Rocío → El Limón',           origen: 'El Rocío',  destino: 'El Limón' },
		{ label: 'El Limón → El Rocío',           origen: 'El Limón',  destino: 'El Rocío' },
		{ label: 'Rosalito → El Limón',           origen: 'Rosalito',  destino: 'El Limón' },
		{ label: 'La Redoma → El Rocío',          origen: 'La Redoma', destino: 'El Rocío' },
		{ label: 'Rosalito → Fresco → El Limón',  origen: 'Rosalito',  paradas: ['Fresco Market'], destino: 'El Limón' }
	];


	let { onCreated }: { onCreated?: () => void } = $props();

	let confirming = $state<number | null>(null); // index of route awaiting confirmation
	let loading = $state<number | null>(null);    // index of route being submitted

	// Auto-cancel confirmation after 3s if no second tap
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

	function tap(index: number) {
		if (loading !== null) return;

		if (confirming === index) {
			clearTimer();
			submit(index);
		} else {
			clearTimer();
			confirming = index;
			confirmTimer = setTimeout(() => { confirming = null; }, 3000);
		}
	}

	function clearTimer() {
		if (confirmTimer !== null) { clearTimeout(confirmTimer); confirmTimer = null; }
	}

	async function submit(index: number) {
		const route = ROUTES[index];
		loading = index;
		confirming = null;

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
			sileo.success({ title: 'Carrera guardada', description: 'Se enviará cuando vuelva la conexión.' });
			loading = null;
			onCreated?.();
			return;
		}

		try {
			const res = await fetch('/api/viajes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) throw new Error();
			sileo.success({ title: 'Carrera creada', description: 'Agregada a pendientes.' });
			onCreated?.();
		} catch {
			sileo.error({ title: 'No se pudo crear la carrera', description: 'Intenta de nuevo.' });
		} finally {
			loading = null;
		}
	}
</script>

<!-- -mx-4 px-4: the row scrolls out to the screen edge while the first chip
     stays on the gutter. py-1 leaves room for the focus ring inside the scroll
     box; -mt-1 and mb-3 pay it back, keeping the 16px gap to the summary bar. -->
<div class="-mx-4 px-4 -mt-1 py-1 mb-3 flex gap-2 overflow-x-auto no-scrollbar">
	{#each ROUTES as route, i}
		<button
			class="badge h-11 px-4 text-sm shrink-0 gap-1 cursor-pointer transition-all duration-150 border {confirming === i ? 'badge-primary' : 'badge-outline border-base-content/20'}"
			class:opacity-50={loading !== null && loading !== i}
			disabled={loading !== null}
			onclick={() => tap(i)}
		>
			{#if loading === i}
				<span class="loading loading-spinner loading-xs"></span>
			{:else if confirming === i}
				<span class="font-semibold">¿Confirmar?</span>
			{:else}
				<span>{route.label}</span>
			{/if}
		</button>
	{/each}
</div>

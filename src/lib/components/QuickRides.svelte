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

<div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
	{#each ROUTES as route, i}
		<button
			class="badge badge-lg shrink-0 gap-1 cursor-pointer transition-all duration-150 border"
			class:badge-primary={confirming === i}
			class:badge-outline={confirming !== i}
			class:opacity-50={loading !== null && loading !== i}
			disabled={loading !== null}
			onclick={() => tap(i)}
		>
			{#if loading === i}
				<span class="loading loading-spinner loading-xs"></span>
			{:else if confirming === i}
				<span class="text-xs font-semibold">¿Confirmar?</span>
			{:else}
				<span class="text-xs">{route.label}</span>
			{/if}
		</button>
	{/each}
</div>

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import RideCard from '$lib/components/RideCard.svelte';
	import type { RideData } from '$lib/components/RideCard.svelte';

	let { data } = $props();

	// DaisyUI dims inactive tabs to 50%; the floor for text is 60%
	const ACTIVE_TAB = 'text-base-content before:text-accent';
	const INACTIVE_TAB = 'text-base-content/60 hover:text-base-content';

	let tab = $state<'pagadas' | 'papelera'>('pagadas');
	let hiddenIds = $state(new Set<number>());

	const visibleBorrados = $derived(data.borrados.filter((v: RideData) => !hiddenIds.has(v.id)));
	const visiblePagadas = $derived(data.viajes.filter((v: RideData) => !hiddenIds.has(v.id)));

	async function handleRestore(id: number) {
		hiddenIds = new Set([...hiddenIds, id]);
		await invalidateAll();
	}

	// Same optimistic hide: the ride leaves Historial and reappears on Inicio
	async function handleUnpaid(id: number) {
		hiddenIds = new Set([...hiddenIds, id]);
		await invalidateAll();
	}
</script>

<!-- No inset of its own: main's 16px gutter already lines the first tab up
     with the cards, and mb-4 is the 16px section gap.
     The active tab's underline is its ::before, drawn in currentColor, so
     before:text-accent turns only the underline Lime. -->
<div class="tabs tabs-border mb-4">
	<button
		class={['tab h-11', tab === 'pagadas' ? ACTIVE_TAB : INACTIVE_TAB]}
		class:tab-active={tab === 'pagadas'}
		onclick={() => (tab = 'pagadas')}
	>
		Pagadas
	</button>
	<button
		class={['tab h-11', tab === 'papelera' ? ACTIVE_TAB : INACTIVE_TAB]}
		class:tab-active={tab === 'papelera'}
		onclick={() => (tab = 'papelera')}
	>
		Papelera
		{#if data.borrados.length > 0}
			<span class="badge badge-sm badge-primary ml-1">{data.borrados.length}</span>
		{/if}
	</button>
</div>

{#if tab === 'pagadas'}
	{#if visiblePagadas.length === 0}
		<div class="flex flex-col items-center justify-center py-24 gap-2">
			<p class="text-base-content/60 text-sm">No hay carreras pagadas</p>
		</div>
	{:else}
		<div class="space-y-3 pb-8">
			{#each visiblePagadas as viaje (viaje.id)}
				<RideCard {viaje} tasa={data.tasa?.tasa ?? null} onUnpaid={handleUnpaid} />
			{/each}
		</div>
	{/if}
{:else}
	{#if visibleBorrados.length === 0}
		<div class="flex flex-col items-center justify-center py-24 gap-2">
			<p class="text-base-content/60 text-sm">No hay carreras eliminadas</p>
		</div>
	{:else}
		<div class="space-y-3 pb-8">
			{#each visibleBorrados as viaje (viaje.id)}
				<RideCard {viaje} tasa={data.tasa?.tasa ?? null} onRestore={handleRestore} />
			{/each}
		</div>
	{/if}
{/if}

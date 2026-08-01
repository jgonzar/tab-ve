<script lang="ts">
	import type { FormLocation } from './LocationSelect.svelte';

	const QUICK_LOCATIONS = ['El Rocío', 'El Limón', 'Rosalito', 'La Redoma', 'Fresco Market'];

	let {
		value = null,
		onSelect
	}: {
		value?: FormLocation | null;
		onSelect: (loc: FormLocation) => void;
	} = $props();
</script>

<div class="flex gap-2 overflow-x-auto no-scrollbar pt-2 pb-1">
	{#each QUICK_LOCATIONS as nombre}
		<button
			type="button"
			class="badge badge-lg min-h-10 px-4 shrink-0 cursor-pointer transition-colors"
			class:badge-primary={value?.nombre === nombre}
			class:badge-outline={value?.nombre !== nombre}
			onclick={() => onSelect({ id: null, nombre })}
		>
			{nombre}
		</button>
	{/each}
</div>

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

<!-- -mx-4 px-4: bleeds to the sheet edge while the first chip stays on the
     sheet's 16px inset. py-1 is room for the focus ring inside the scroll box. -->
<div class="-mx-4 px-4 py-1 flex gap-2 overflow-x-auto no-scrollbar">
	{#each QUICK_LOCATIONS as nombre}
		<button
			type="button"
			class="badge h-11 px-4 text-sm shrink-0 cursor-pointer transition-colors {value?.nombre === nombre ? 'badge-primary' : 'badge-outline border-base-content/20'}"
			onclick={() => onSelect({ id: null, nombre })}
		>
			{nombre}
		</button>
	{/each}
</div>

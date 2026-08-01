<script lang="ts">
	export type FormLocation = { id: number | null; nombre: string };
	type Location = { id: number; nombre: string };

	let {
		value = $bindable<FormLocation | null>(null),
		locations,
		placeholder = 'Buscar ubicación...'
	}: {
		value: FormLocation | null;
		locations: Location[];
		placeholder?: string;
	} = $props();

	let inputValue = $state(value?.nombre ?? '');
	let open = $state(false);
	let containerEl: HTMLDivElement;

	let filtered = $derived(
		inputValue.length === 0
			? locations
			: locations.filter((l) => l.nombre.toLowerCase().includes(inputValue.toLowerCase()))
	);

	let showCreate = $derived(
		inputValue.trim().length > 1 &&
			!locations.some((l) => l.nombre.toLowerCase() === inputValue.trim().toLowerCase())
	);

	function select(loc: Location) {
		value = loc;
		inputValue = loc.nombre;
		open = false;
	}

	function createNew() {
		value = { id: null, nombre: inputValue.trim() };
		open = false;
	}

	function onInput() {
		open = true;
		if (value !== null && inputValue !== value.nombre) {
			value = null;
		}
	}

	function onBlur() {
		// Delay so click on dropdown item fires first
		setTimeout(() => (open = false), 150);
	}
</script>

<div class="relative w-full" bind:this={containerEl}>
	<input
		type="text"
		bind:value={inputValue}
		oninput={onInput}
		onfocus={() => (open = true)}
		onblur={onBlur}
		{placeholder}
		autocomplete="off"
		class="input input-bordered input-lg w-full"
		class:input-error={value === null && inputValue.length > 0 && !open}
	/>

	{#if open && (filtered.length > 0 || showCreate)}
		<ul class="absolute z-50 w-full bg-base-200 border border-base-300 rounded-box shadow-xl mt-1 max-h-52 overflow-y-auto">
			{#each filtered as loc (loc.id)}
				<li>
					<button
						type="button"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => select(loc)}
						class="w-full text-left px-4 py-3.5 hover:bg-base-300 active:bg-base-300 text-base"
					>
						{loc.nombre}
					</button>
				</li>
			{/each}
			{#if showCreate}
				<li class="border-t border-base-300">
					<button
						type="button"
						onmousedown={(e) => e.preventDefault()}
						onclick={createNew}
						class="w-full text-left px-4 py-3.5 hover:bg-base-300 text-base text-primary font-medium"
					>
						+ Crear "{inputValue.trim()}"
					</button>
				</li>
			{/if}
		</ul>
	{/if}
</div>

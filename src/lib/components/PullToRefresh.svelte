<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { sileo } from 'svelte-sileo';
	import { networkState } from '$lib/stores/network.svelte';

	let { children } = $props();

	const THRESHOLD = 64; // pull needed before a release fires a refresh
	const MAX_PULL = 96; // hard stop so it can't be dragged forever
	const RESISTANCE = 0.5; // finger travel -> visual travel

	let pull = $state(0);
	let refreshing = $state(false);
	let dragging = $state(false); // drives the transition on/off

	// plain — gesture bookkeeping, never rendered
	let startX = 0;
	let startY = 0;
	let tracking = false;
	let axisLocked = false;

	function onTouchStart(e: TouchEvent) {
		if (refreshing || window.scrollY > 0) return;
		// The bottom sheet and the drawer scroll on their own; overlays (the
		// quick-ride card) own their touches
		if ((e.target as Element | null)?.closest('.modal, .drawer-side, [data-overlay]')) return;

		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		tracking = true;
		axisLocked = false;
	}

	function onTouchMove(e: TouchEvent) {
		if (!tracking || refreshing) return;

		const dx = e.touches[0].clientX - startX;
		const dy = e.touches[0].clientY - startY;

		if (!axisLocked) {
			if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // wait for clear intent
			axisLocked = true;
			// Upward is a normal scroll; horizontal belongs to whatever is under the
			// finger (the quick-rides strip scrolls sideways)
			if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
				tracking = false;
				return;
			}
			dragging = true;
		}

		e.preventDefault();
		pull = Math.min(MAX_PULL, dy * RESISTANCE);
	}

	async function onTouchEnd() {
		if (!tracking) return;
		tracking = false;
		dragging = false;

		if (pull < THRESHOLD) {
			pull = 0;
			return;
		}

		// Offline the refetch fails into SvelteKit's error page rather than
		// throwing, so don't try: say so and let the pull spring back
		if (!networkState.online) {
			pull = 0;
			sileo.error({ title: 'No se pudo actualizar', description: 'Revisa tu conexión e intenta de nuevo.' });
			return;
		}

		refreshing = true;
		pull = THRESHOLD; // hold the spinner in place while it loads
		try {
			await invalidateAll();
		} catch {
			sileo.error({ title: 'No se pudo actualizar', description: 'Revisa tu conexión e intenta de nuevo.' });
		} finally {
			refreshing = false;
			pull = 0;
		}
	}

	function onTouchCancel() {
		tracking = false;
		dragging = false;
		if (!refreshing) pull = 0;
	}

	$effect(() => {
		window.addEventListener('touchstart', onTouchStart, { passive: true });
		window.addEventListener('touchmove', onTouchMove, { passive: false });
		window.addEventListener('touchend', onTouchEnd);
		window.addEventListener('touchcancel', onTouchCancel);
		return () => {
			window.removeEventListener('touchstart', onTouchStart);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('touchend', onTouchEnd);
			window.removeEventListener('touchcancel', onTouchCancel);
		};
	});

	const progress = $derived(Math.min(1, pull / THRESHOLD));
	const ready = $derived(pull >= THRESHOLD);
</script>

<!--
	The spacer doubles as the indicator well: content below simply flows down.
	Deliberately not a transform — a transformed ancestor becomes the containing
	block for `position: fixed`, which would break the floating "+" on Inicio.
-->
<div
	class="flex items-end justify-center overflow-hidden"
	style="height: {pull}px; transition: {dragging ? 'none' : 'height 200ms ease-out'}"
	aria-hidden="true"
>
	<div
		class="flex items-center gap-2 pb-2 text-xs text-base-content/60"
		style="opacity: {progress}"
	>
		{#if refreshing}
			<span class="loading loading-spinner loading-xs"></span>
			Actualizando…
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2.5"
				style="transform: rotate({ready ? 180 : 0}deg); transition: transform 150ms ease-out"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
			</svg>
			{ready ? 'Suelta para actualizar' : 'Desliza para actualizar'}
		{/if}
	</div>
</div>

{@render children()}

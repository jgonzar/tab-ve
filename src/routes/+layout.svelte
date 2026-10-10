<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { GATE_PATH } from '$lib/gate';
	import { userState } from '$lib/stores/user.svelte';
	import { networkState } from '$lib/stores/network.svelte';
	import { pendingStore } from '$lib/stores/pending.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import UserSelect from '$lib/components/UserSelect.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import { Toaster } from 'svelte-sileo';

	let { children } = $props();
	let drawerOpen = $state(false);

	// Static, not $derived: the app is dark-only (data-theme is hardcoded in
	// app.html), so there's exactly one pill to style.
	//
	// This is the playbook's *dark pill* branch. It keeps the state-coloured
	// title — that only becomes illegible on a white pill, which is what the
	// playbook warns about. fill is --color-base-300, the top step of the Tab
	// theme's surface ramp, so the toast reads as app chrome rather than a
	// white card dropped on top of it. roundness 16 matches --radius-box, the
	// radius of every surface. The `!` is Tailwind v4's important modifier, needed
	// to beat the package's baked-in colours.
	const toasterOptions = {
		duration: 5000,
		// Read from the theme, not copied: sileo writes this straight into the
		// SVG `fill` attribute, and both WebKit and Chromium resolve var() there.
		// base-300 sits two steps above the page (base-100), but surface-vs-surface
		// contrast in a dark theme stays low, so the separation still comes from
		// the drop shadow on [data-sileo-canvas] in app.css, not this value alone.
		fill: 'var(--color-base-300)',
		roundness: 16,
		autopilot: true,
		styles: {
			title: 'font-semibold',
			description: 'text-white/80!',
			badge: 'bg-white/10!'
		}
	};

	$effect(() => {
		userState.init();
		networkState.init();
		pendingStore.init();
	});
</script>

{#if page.route.id === GATE_PATH}
	<!-- The PIN gate is a full screen of its own, before "¿Quién eres?" -->
	{@render children()}
{:else if !userState.activeUser}
	<UserSelect />
{:else}
	<div class="drawer">
		<input id="main-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

		<div class="drawer-content flex flex-col min-h-screen">
			<NavBar />
			<main class="flex-1 p-4 pwa-main-inset w-full max-w-lg mx-auto">
				<PullToRefresh>
					{@render children()}
				</PullToRefresh>
			</main>
		</div>

		<div class="drawer-side z-40">
			<label for="main-drawer" aria-label="Cerrar menú" class="drawer-overlay"></label>
			<Drawer onNavigate={() => (drawerOpen = false)} />
		</div>
	</div>

	<!-- offset clears the sticky navbar -->
	<Toaster position="top-center" offset={{ top: '4.5rem' }} options={toasterOptions} />

	<!-- Offline banner -->
	{#if !networkState.online}
		<div
			class="fixed bottom-0 inset-x-0 z-50 bg-warning text-warning-content text-center text-xs pt-2 pwa-offline-banner font-medium"
		>
			Sin conexión — las carreras se guardarán al reconectar
		</div>
	{/if}
{/if}

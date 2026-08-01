<script lang="ts">
	import '../app.css';
	import { userState } from '$lib/stores/user.svelte';
	import { networkState } from '$lib/stores/network.svelte';
	import { pendingStore } from '$lib/stores/pending.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import UserSelect from '$lib/components/UserSelect.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import Toaster from '$lib/components/Toaster.svelte';

	let { children } = $props();
	let drawerOpen = $state(false);

	$effect(() => {
		userState.init();
		networkState.init();
		pendingStore.init();
	});
</script>

{#if !userState.activeUser}
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

	<Toaster />

	<!-- Offline banner -->
	{#if !networkState.online}
		<div
			class="fixed bottom-0 inset-x-0 z-50 bg-warning text-warning-content text-center text-xs pt-2 pwa-offline-banner font-medium"
		>
			Sin conexión — las carreras se guardarán al reconectar
		</div>
	{/if}
{/if}

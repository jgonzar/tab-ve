<script lang="ts">
	import { page } from '$app/state';
	import { CURRENT_ROW } from '$lib/current';
	import Wordmark from './Wordmark.svelte';

	let { onNavigate }: { onNavigate: () => void } = $props();

	const isHome = $derived(page.url.pathname === '/');
	const isHistorial = $derived(page.url.pathname === '/historial');
</script>

<!-- DaisyUI's menu rows are grids that stack from the top, so content-center
     is what centres the icon and label in the 44px row -->
<ul class="menu bg-base-200 min-h-full w-64 p-4 gap-1">
	<li class="menu-title mb-1"><Wordmark class="h-5 self-start" /></li>
	<li>
		<a
			href="/"
			class={['min-h-11 content-center', isHome && ['menu-active', CURRENT_ROW]]}
			aria-current={isHome ? 'page' : undefined}
			onclick={onNavigate}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class={['h-4 w-4', isHome && 'text-accent']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
			</svg>
			Inicio
		</a>
	</li>
	<li>
		<a
			href="/historial"
			class={['min-h-11 content-center', isHistorial && ['menu-active', CURRENT_ROW]]}
			aria-current={isHistorial ? 'page' : undefined}
			onclick={onNavigate}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class={['h-4 w-4', isHistorial && 'text-accent']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Historial
		</a>
	</li>
</ul>

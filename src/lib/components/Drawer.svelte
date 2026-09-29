<script lang="ts">
	import { page } from '$app/state';
	import Wordmark from './Wordmark.svelte';

	let { onNavigate }: { onNavigate: () => void } = $props();
</script>

<ul class="menu bg-base-200 min-h-full w-64 p-4 gap-1">
	<li class="menu-title mb-1"><Wordmark class="h-5 self-start" /></li>
	<li>
		<a
			href="/"
			onclick={onNavigate}
			class:active={page.url.pathname === '/'}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
			</svg>
			Inicio
		</a>
	</li>
	<li>
		<a
			href="/historial"
			onclick={onNavigate}
			class:active={page.url.pathname === '/historial'}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Historial
		</a>
	</li>
</ul>

<script lang="ts">
	import Wordmark from './Wordmark.svelte';
	import { m } from '$lib/paraglide/messages.js';
</script>

<!-- Below lg only: from lg the drawer is an always-open sidebar -->
<div class="navbar bg-base-200 sticky top-0 z-30 shadow-sm lg:hidden">
	<div class="navbar-start">
		<label for="main-drawer" aria-label={m.nav_open_menu()} class="btn btn-ghost btn-circle size-11" data-tour="menu">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</label>
	</div>

	<div class="navbar-center">
		<Wordmark class="h-6" />
	</div>

	<!-- Empty, the width of the ☰, so the wordmark stays centred -->
	<div class="navbar-end">
		<span class="size-11" aria-hidden="true"></span>
	</div>
</div>

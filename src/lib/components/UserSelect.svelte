<script lang="ts">
	import { goto } from '$app/navigation';
	import { userState, users, type User } from '$lib/stores/user.svelte';
	import { TOUR_HREF, offerFirstTour } from '$lib/tour';
	import Wordmark from './Wordmark.svelte';
	import LanguageToggle from './LanguageToggle.svelte';
	import { m } from '$lib/paraglide/messages.js';

	const ROLES = { cliente: m.role_cliente, conductora: m.role_conductora };

	function select(user: User) {
		userState.setUser(user);
		// The demo's first pick on this device opens Inicio with the tour
		if (offerFirstTour()) goto(TOUR_HREF);
	}
</script>

<div class="fixed inset-0 z-50 bg-base-100 flex flex-col items-center justify-center p-8 gap-10">
	<LanguageToggle from="app" />

	<div class="text-center">
		<h1><Wordmark class="h-12 mx-auto" /></h1>
		<p class="text-base-content/60 mt-2 text-sm">{m.who_prompt()}</p>
	</div>

	<div class="flex flex-col gap-3 w-full max-w-xs">
		{#each users() as user}
			<button
				onclick={() => select(user)}
				class="card bg-base-200 hover:bg-base-300 active:scale-95 transition-all duration-150 cursor-pointer text-left"
			>
				<div class="card-body flex-row items-center gap-4 p-4">
					<div class="avatar placeholder shrink-0">
						<div class="bg-primary text-primary-content rounded-full w-12 flex items-center justify-center">
							<span class="text-base font-bold leading-none">{user.iniciales}</span>
						</div>
					</div>
					<div>
						<p class="font-semibold">{user.nombre}</p>
						<p class="text-xs text-base-content/60 capitalize">{ROLES[user.rol]()}</p>
					</div>
				</div>
			</button>
		{/each}
	</div>
</div>

<script lang="ts">
	import { page } from '$app/state';
	import { userState, USERS } from '$lib/stores/user.svelte';
	import Wordmark from './Wordmark.svelte';

	let menuOpen = $state(false);

	// Close on any click outside the user menu
	$effect(() => {
		if (!menuOpen) return;
		function handleClick(e: MouseEvent) {
			if (!(e.target as Element).closest('[data-user-menu]')) menuOpen = false;
		}
		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	});
</script>

<div class="navbar bg-base-200 sticky top-0 z-30 shadow-sm">
	<!-- Mobile: hamburger -->
	<div class="navbar-start md:hidden">
		<label for="main-drawer" aria-label="Abrir menú" class="btn btn-ghost btn-circle size-11">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</label>
	</div>

	<!-- Desktop: brand + links on left -->
	<div class="navbar-start hidden md:flex items-center gap-1">
		<Wordmark class="h-6 mx-2" />
		<a
			href="/"
			class="btn btn-ghost h-11"
			class:btn-active={page.url.pathname === '/'}
		>
			Inicio
		</a>
		<a
			href="/historial"
			class="btn btn-ghost h-11"
			class:btn-active={page.url.pathname === '/historial'}
		>
			Historial
		</a>
	</div>

	<!-- Mobile: brand in center -->
	<div class="navbar-center md:hidden">
		<Wordmark class="h-6" />
	</div>

	<!-- User avatar — always on right -->
	<div class="navbar-end">
		<div class="relative" data-user-menu>
			<button
				aria-label="Cambiar usuario"
				class="btn btn-ghost btn-circle size-11 avatar placeholder"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<div class="bg-primary text-primary-content rounded-full w-9 flex items-center justify-center">
					<span class="text-sm font-bold leading-none">{userState.activeUser?.iniciales ?? '?'}</span>
				</div>
			</button>

			{#if menuOpen}
				<ul class="absolute right-0 top-full mt-2 menu bg-base-200 rounded-box shadow-lg z-50 w-52 p-2 gap-1">
					<li class="menu-title text-xs">Cambiar usuario</li>
					{#each USERS as user}
						<li>
							<button
								class="min-h-11"
								onclick={() => { userState.setUser(user); menuOpen = false; }}
								class:bg-base-300={userState.activeUser?.id === user.id}
							>
								<span class="badge badge-primary badge-sm font-bold">{user.iniciales}</span>
								{user.nombre}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

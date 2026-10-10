<script lang="ts">
	import { page } from '$app/state';
	import { userState, users } from '$lib/stores/user.svelte';
	import { CURRENT_ROW } from '$lib/current';
	import Wordmark from './Wordmark.svelte';
	import { sileo } from 'svelte-sileo';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { m } from '$lib/paraglide/messages.js';
	import { LANGUAGES, switchLanguage } from '$lib/language';

	let menuOpen = $state(false);
	const currentLang = getLocale();

	async function pickLanguage(lang: (typeof LANGUAGES)[number]['code']) {
		menuOpen = false;
		if (!(await switchLanguage(lang, 'app'))) {
			sileo.error({ title: m.lang_switch_failed(), description: m.common_check_connection() });
		}
	}

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
		<label for="main-drawer" aria-label={m.nav_open_menu()} class="btn btn-ghost btn-circle size-11">
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
			class={['btn btn-ghost h-11', page.url.pathname === '/' && CURRENT_ROW]}
			aria-current={page.url.pathname === '/' ? 'page' : undefined}
		>
			{m.nav_home()}
		</a>
		<a
			href="/historial"
			class={['btn btn-ghost h-11', page.url.pathname === '/historial' && CURRENT_ROW]}
			aria-current={page.url.pathname === '/historial' ? 'page' : undefined}
		>
			{m.nav_history()}
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
				aria-label={m.nav_switch_user()}
				class="btn btn-ghost btn-circle size-11 avatar placeholder"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<div class="bg-primary text-primary-content rounded-full w-9 flex items-center justify-center">
					<span class="text-sm font-bold leading-none">{userState.activeUser?.iniciales ?? '?'}</span>
				</div>
			</button>

			{#if menuOpen}
				<ul class="absolute right-0 top-full mt-2 menu bg-base-200 rounded-box shadow-lg z-50 w-52 p-2 gap-1">
					<li class="menu-title text-xs text-base-content/60">{m.nav_switch_user()}</li>
					{#each users() as user}
						<li>
							<!-- content-center: the menu row grid stacks from the top otherwise -->
							<button
								class={['min-h-11 content-center', userState.activeUser?.id === user.id && ['menu-active', CURRENT_ROW]]}
								aria-current={userState.activeUser?.id === user.id ? 'true' : undefined}
								onclick={() => { userState.setUser(user); menuOpen = false; }}
							>
								<span class="badge badge-primary badge-sm font-bold">{user.iniciales}</span>
								{user.nombre}
							</button>
						</li>
					{/each}

					<!-- The language switch, reachable from every screen -->
					<li class="menu-title mt-1 text-xs text-base-content/60" data-lang-switch>{m.lang_label()}</li>
					{#each LANGUAGES as lang}
						<li data-lang-switch>
							<button
								lang={lang.code}
								class={['min-h-11 content-center', currentLang === lang.code && ['menu-active', CURRENT_ROW]]}
								aria-current={currentLang === lang.code ? 'true' : undefined}
								onclick={() => pickLanguage(lang.code)}
							>
								{lang.name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

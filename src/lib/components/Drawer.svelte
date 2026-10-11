<script lang="ts">
	import { page } from '$app/state';
	import { CURRENT_ROW } from '$lib/current';
	import { userState, users } from '$lib/stores/user.svelte';
	import { LANGUAGES, switchLanguage } from '$lib/language';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { sileo } from 'svelte-sileo';
	import { TOUR_HREF } from '$lib/tour';
	import Wordmark from './Wordmark.svelte';
	import { m } from '$lib/paraglide/messages.js';

	/**
	 * The one menu: the pages at the top; Recorrido (the tour), the language
	 * and the active user pinned to the bottom. A slide-in drawer on phones
	 * and tablets, and an always-open sidebar from lg (the layout's
	 * lg:drawer-open).
	 */
	let { onClose }: { onClose: () => void } = $props();

	const ROLES = { cliente: m.role_cliente, conductora: m.role_conductora };

	const isHome = $derived(page.url.pathname === '/');
	const isHistorial = $derived(page.url.pathname === '/historial');

	// Looked up by id, so the demo always shows its own people
	const user = $derived(
		userState.activeUser && (users().find((u) => u.id === userState.activeUser?.id) ?? userState.activeUser)
	);

	const currentLang = getLocale();
	const currentLangName = LANGUAGES.find((l) => l.code === currentLang)?.name;

	let langOpen = $state(false);
	let langWrap: HTMLDivElement;
	let langTrigger: HTMLButtonElement;

	function closeLang(refocus = false) {
		langOpen = false;
		if (refocus) langTrigger.focus();
	}

	async function pickLanguage(lang: (typeof LANGUAGES)[number]['code']) {
		closeLang();
		if (!(await switchLanguage(lang, 'app'))) {
			sileo.error({ title: m.lang_switch_failed(), description: m.common_check_connection() });
		}
	}

	function switchUser() {
		userState.clearUser();
		onClose();
	}

	// Close on a click outside the language row or its list, and on Escape
	$effect(() => {
		if (!langOpen) return;
		function handleClick(e: MouseEvent) {
			if (!langWrap.contains(e.target as Node)) closeLang();
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				closeLang(true);
			}
		}
		document.addEventListener('click', handleClick);
		document.addEventListener('keydown', handleKey);
		return () => {
			document.removeEventListener('click', handleClick);
			document.removeEventListener('keydown', handleKey);
		};
	});
</script>

<!-- DaisyUI's menu rows are grids that stack from the top, so content-center
     is what centres the icon and label in the 44px row -->
<div class="bg-base-200 min-h-full w-64 flex flex-col pwa-drawer">
	<ul class="menu w-full px-4 py-0 gap-1">
		<li class="menu-title mb-1"><Wordmark class="h-5 self-start" /></li>
		<li>
			<a
				href="/"
				class={['min-h-11 content-center', isHome && ['menu-active', CURRENT_ROW]]}
				aria-current={isHome ? 'page' : undefined}
				onclick={onClose}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class={['h-4 w-4', isHome && 'text-accent']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
				{m.nav_home()}
			</a>
		</li>
		<li>
			<a
				href="/historial"
				class={['min-h-11 content-center', isHistorial && ['menu-active', CURRENT_ROW]]}
				data-tour="history"
				aria-current={isHistorial ? 'page' : undefined}
				onclick={onClose}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class={['h-4 w-4', isHistorial && 'text-accent']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				{m.nav_history()}
			</a>
		</li>
	</ul>

	<!-- Pinned to the bottom -->
	<div class="mt-auto pt-4">
		<!-- Replays the guided tour, in both apps. Closing the phone drawer
		     first: the tour waits until it's shut. -->
		<ul class="menu w-full px-4 py-0 mb-1">
			<li>
				<a href={TOUR_HREF} class="min-h-11 content-center" onclick={onClose}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
					</svg>
					{m.nav_tour()}
				</a>
			</li>
		</ul>

		<!-- The language row and its list. The list sits after the row, so Tab
		     reaches it next, and opens upwards over the free space. -->
		<div
			class="relative"
			bind:this={langWrap}
			onfocusout={(e) => {
				// Tabbing past the list closes it. A null target is a click
				// (Safari doesn't focus buttons), which the click handler covers.
				const next = e.relatedTarget as Node | null;
				if (next && !langWrap.contains(next)) closeLang();
			}}
		>
			<ul class="menu w-full px-4 py-0">
				<li>
					<button
						bind:this={langTrigger}
						type="button"
						aria-expanded={langOpen}
						aria-controls="lang-list"
						class={['min-h-11 content-center', langOpen && 'menu-active']}
						onclick={() => (langOpen = !langOpen)}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
						</svg>
						<span class="flex-1">{m.lang_label()}</span>
						<span class="text-sm text-base-content/60" lang={currentLang}>{currentLangName}</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class={['h-3.5 w-3.5 text-base-content/60 transition-transform duration-150 motion-reduce:transition-none', langOpen && 'rotate-180']}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 9l6 6 6-6" />
						</svg>
					</button>
				</li>
			</ul>

			<!-- Always rendered, so it can fade; invisible also takes it out of
			     the tab order and the accessibility tree while closed -->
			<ul
				id="lang-list"
				aria-label={m.lang_label()}
				class={[
					'menu absolute bottom-full inset-x-4 w-auto mb-1 z-10 gap-1 p-1.5 bg-base-300 rounded-box shadow-lg',
					'transition-[opacity,translate,visibility] duration-150 ease-out motion-reduce:transition-none',
					langOpen ? 'visible opacity-100 translate-y-0' : 'invisible opacity-0 translate-y-1'
				]}
			>
				{#each LANGUAGES as lang}
					<li>
						<button
							type="button"
							lang={lang.code}
							class={[
								'min-h-11 content-center active:bg-base-content/10',
								currentLang === lang.code && ['menu-active', CURRENT_ROW]
							]}
							aria-current={currentLang === lang.code ? 'true' : undefined}
							onclick={() => pickLanguage(lang.code)}
						>
							<span class="flex-1">{lang.name}</span>
							{#if currentLang === lang.code}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<div class="h-px bg-base-content/10 mx-7 my-2.5"></div>

		<!-- The active user, and the way back to "¿Quién eres?" -->
		{#if user}
			<div class="mx-4 flex items-center gap-2.5 rounded-box bg-base-100 py-2.5 pl-3 pr-1">
				<div class="bg-primary text-primary-content rounded-full size-10 shrink-0 flex items-center justify-center">
					<span class="text-sm font-bold leading-none">{user.iniciales}</span>
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-semibold break-words">{user.nombre}</p>
					<p class="text-xs text-base-content/60 capitalize">{ROLES[user.rol]()}</p>
				</div>
				<button
					type="button"
					aria-label={m.nav_switch_user()}
					class="btn btn-ghost h-11 min-h-11 px-2 shrink-0 text-accent text-sm"
					onclick={switchUser}
				>
					{m.nav_change_user()}
				</button>
			</div>
		{/if}
	</div>
</div>

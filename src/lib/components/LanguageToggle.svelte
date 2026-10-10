<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { m } from '$lib/paraglide/messages.js';
	import { LANGUAGES, switchLanguage } from '$lib/language';

	/**
	 * The small ES / EN switch on the first screens (the PIN gate and
	 * "¿Quién eres?"), pinned to the top corner. In the app itself the switch
	 * lives in the avatar menu.
	 */
	let { from }: { from: 'gate' | 'app' } = $props();

	const current = getLocale();
</script>

<div
	role="group"
	aria-label={m.lang_label()}
	data-lang-switch
	class="absolute right-2 top-[calc(var(--safe-top)+0.5rem)] flex items-center text-sm"
>
	{#each LANGUAGES as lang, i}
		{#if i > 0}<span class="text-base-content/60" aria-hidden="true">/</span>{/if}
		<button
			type="button"
			lang={lang.code}
			aria-label={lang.name}
			aria-pressed={lang.code === current}
			class={[
				'h-11 min-w-11 px-2 rounded-field font-semibold',
				lang.code === current ? 'text-base-content' : 'text-base-content/60 hover:text-base-content'
			]}
			onclick={() => switchLanguage(lang.code, from)}
		>
			{lang.short}
		</button>
	{/each}
</div>

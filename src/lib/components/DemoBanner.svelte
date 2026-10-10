<script lang="ts">
	import { onMount } from 'svelte';
	import { sileo } from 'svelte-sileo';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { m } from '$lib/paraglide/messages.js';

	/**
	 * The demo's banner, under the navbar (at the top of the content column
	 * from lg, where the navbar is hidden): the data is shared and starts over
	 * every 4 hours, plus Reiniciar. Only rendered when demoMode() (the
	 * layout checks). Short copy on phones, the long one from md up.
	 */

	// Set just before the reload, so the toast shows once the fresh page is up
	const RESET_FLAG = 'tab_demo_reset';

	let confirmOpen = $state(false);
	let busy = $state(false);

	onMount(() => {
		try {
			if (sessionStorage.getItem(RESET_FLAG)) {
				sessionStorage.removeItem(RESET_FLAG);
				sileo.success({ title: m.demo_reset_done(), description: m.demo_reset_done_desc() });
			}
		} catch {
			// Storage blocked: the reload alone shows the reset worked
		}
	});

	async function reset() {
		busy = true;
		let message: string | null = null;
		try {
			const res = await fetch('/api/demo/reset', { method: 'POST' });
			if (res.ok) {
				try {
					sessionStorage.setItem(RESET_FLAG, '1');
				} catch {
					// See onMount
				}
				// A full reload, not invalidateAll: ride ids start over, and a page's
				// optimistic state (rides hidden after paying) would hide the new ones
				location.reload();
				return;
			}
			message = (await res.json().catch(() => null))?.message ?? null;
		} catch {
			// Offline or unreachable: the generic description below
		}
		busy = false;
		confirmOpen = false;
		sileo.error({ title: m.demo_reset_failed(), description: message ?? m.common_check_connection() });
	}
</script>

<div class="bg-base-300 text-base-content/80" data-demo-banner>
	<div class="max-w-lg md:max-w-3xl mx-auto flex items-center gap-3 pl-4 pr-2">
		<p class="flex-1 text-xs md:text-sm py-2">
			<span class="md:hidden">{m.demo_banner_short()}</span>
			<span class="hidden md:inline">{m.demo_banner_long()}</span>
		</p>
		<button class="btn btn-ghost h-11 px-3 shrink-0 text-accent" onclick={() => (confirmOpen = true)}>
			{m.demo_reset_button()}
		</button>
	</div>
</div>

<ConfirmDialog
	bind:open={confirmOpen}
	title={m.demo_reset_confirm_title()}
	confirmLabel={m.demo_reset_confirm()}
	confirmClass="btn-error"
	{busy}
	onConfirm={reset}
>
	{m.demo_reset_confirm_body()}
</ConfirmDialog>

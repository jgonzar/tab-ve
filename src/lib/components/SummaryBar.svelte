<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatBs, formatUsd } from '$lib/format';
	import { rich } from '$lib/rich';

	let {
		count,
		totalUsd,
		tasa = null,
		stale = false,
		onPayAll,
		onExport
	}: {
		count: number;
		totalUsd: number;
		tasa?: number | null;
		stale?: boolean;
		onPayAll?: () => Promise<void>;
		onExport?: () => void;
	} = $props();

	const totalUsdFmt = $derived(formatUsd(totalUsd));
	const totalVes = $derived(tasa ? formatBs(totalUsd * tasa) : null);
	const payAllBody = $derived(
		rich(count === 1 ? m.summary_pay_all_body_one : m.summary_pay_all_body_other, ['count', 'total'])
	);

	let confirming = $state(false);
	let paying = $state(false);

	// Dismissal, Escape and the mid-request lock all live in ConfirmDialog now.
	async function confirm() {
		paying = true;
		try {
			await onPayAll?.();
			confirming = false;
		} finally {
			paying = false;
		}
	}
</script>

<div class="card bg-brand-indigo shadow-sm sticky top-16 lg:top-0 z-20 mb-4">
	<div class="card-body p-4 gap-3">
		<!-- Labels above their values, so both columns share a top edge however
		     many lines the total stacks under it -->
		<div class="flex items-start">
			<div class="flex-1 text-center">
				<p class="text-xs text-base-content/60 uppercase tracking-wide">{m.summary_pending()}</p>
				<p class="text-2xl font-bold">{count}</p>
			</div>
			<div class="w-px self-stretch bg-base-content/15"></div>
			<div class="flex-1 text-center">
				<p class="text-xs text-base-content/60 uppercase tracking-wide">{m.summary_total()}</p>
				<p class="text-2xl font-bold">{totalUsdFmt}</p>
				{#if totalVes}
					<p class="text-sm text-base-content/60">{totalVes}</p>
				{/if}
				{#if stale}
					<p class="text-xs text-warning">{m.summary_stale_rate()}</p>
				{/if}
			</div>
		</div>

		{#if count > 0 && (onPayAll || onExport)}
			<!-- -mb-2, and -ml-3 / -mr-3 on the buttons: the ghost buttons' text lines
			     up with the content edges, and the 44px boxes don't pad out the bottom -->
			<div class="border-t border-base-content/15 pt-2 -mb-2 flex items-center justify-between">
				{#if onExport}
					<button
						class="btn btn-ghost h-11 px-3 -ml-3 text-base-content/60 gap-1"
						onclick={onExport}
						aria-label={m.summary_share_label()}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
						</svg>
						{m.summary_share()}
					</button>
				{:else}
					<span></span>
				{/if}

				{#if onPayAll}
					<button class="btn btn-ghost h-11 px-3 -mr-3 text-base-content/60" onclick={() => (confirming = true)}>
						{m.summary_pay_all()}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!--
	Sibling of the card, not a child: the card is `sticky z-20`, which opens a
	stacking context. A dialog nested inside it would paint at z-20 and end up
	underneath the z-30 navbar, however high its own z-index is.
-->
{#if onPayAll}
	<ConfirmDialog
		bind:open={confirming}
		title={m.summary_pay_all_title()}
		confirmLabel={m.summary_pay_all_confirm()}
		confirmClass="btn-accent"
		busy={paying}
		onConfirm={confirm}
	>
		{#each payAllBody as part}{#if part.slot === 'count'}<span class="font-semibold text-base-content">{count}</span
			>{:else if part.slot === 'total'}<span class="font-semibold text-base-content">{totalUsdFmt}</span
			>{#if totalVes}{' '}<span class="text-base-content/60">({totalVes})</span>{/if}{:else}{part.text}{/if}{/each}
	</ConfirmDialog>
{/if}

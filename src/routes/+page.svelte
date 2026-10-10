<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { pendingStore } from '$lib/stores/pending.svelte';
	import { networkState } from '$lib/stores/network.svelte';
	import { sileo } from 'svelte-sileo';
	import AddRideSheet from '$lib/components/AddRideSheet.svelte';
	import RideCard, { type RideData } from '$lib/components/RideCard.svelte';
	import SummaryBar from '$lib/components/SummaryBar.svelte';
	import QuickRides from '$lib/components/QuickRides.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatBs, formatDayMonth, formatLongDate, formatUsd } from '$lib/format';

	let { data } = $props();
	let showSheet = $state(false);
	let editViaje = $state<RideData | null>(null);
	let hiddenIds = $state(new Set<number>());
	let syncing = $state(false);
	let mounted = false; // plain boolean — only used at transition-creation time

	const pendingRides = $derived(pendingStore.rides.map((r) => pendingStore.toRideData(r)));
	const serverViajes = $derived(data.viajes.filter((v) => !hiddenIds.has(v.id)));
	const visibleViajes = $derived([...pendingRides, ...serverViajes]);
	const totalUsd = $derived(visibleViajes.reduce((sum, v) => sum + (v.precioUsd ? parseFloat(v.precioUsd) : 0), 0));

	onMount(() => {
		mounted = true;

		// Sync any pending rides that were queued while offline
		if (navigator.onLine && pendingStore.rides.length > 0) syncPending();

		function handleOnline() {
			if (pendingStore.rides.length > 0) syncPending();
		}
		window.addEventListener('online', handleOnline);
		return () => window.removeEventListener('online', handleOnline);
	});

	async function syncPending() {
		if (syncing) return;
		syncing = true;
		const snapshot = [...pendingStore.rides];
		let synced = 0;
		for (const pending of snapshot) {
			try {
				const res = await fetch('/api/viajes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(pending.payload)
				});
				if (res.ok) {
					pendingStore.remove(pending.localId);
					synced++;
				}
			} catch {
				// Stay in queue — still offline or server error
			}
		}
		if (synced > 0) await invalidateAll();
		syncing = false;
	}

	function openCreate() {
		editViaje = null;
		showSheet = true;
	}

	function handlePaid(id: number) {
		hiddenIds = new Set([...hiddenIds, id]);
		invalidateAll();
	}

	function handleDeleted(id: number) {
		hiddenIds = new Set([...hiddenIds, id]);
		invalidateAll();
	}

	function handleEdit(viaje: RideData) {
		editViaje = viaje;
		showSheet = true;
	}

	async function onSaved(_viaje?: unknown, queued = false) {
		// A queued ride already shows from pendingStore, and syncPending refetches
		// once it's sent. Refetching with no connection fails into SvelteKit's
		// error page: `queued` covers a drop mid-request, before the browser has
		// noticed it's offline.
		if (queued || !networkState.online) return;
		await invalidateAll();
	}

	async function handlePriceUpdated() {
		await invalidateAll();
	}

	async function handlePayAll() {
		const res = await fetch('/api/viajes', { method: 'PATCH' });
		if (!res.ok) {
			sileo.error({ title: m.home_pay_all_failed(), description: m.common_try_again() });
			return;
		}
		sileo.success({ title: m.home_pay_all_done(), description: m.home_pay_all_done_desc() });
		hiddenIds = new Set();
		await invalidateAll();
	}

	// The shared text receipt, in the interface language. Place names and
	// people stay as typed.
	function buildReceipt(viajes: RideData[]): string {
		const tasa = data.tasa?.tasa ?? null;
		const div = '─'.repeat(36);

		const lines: string[] = [
			'TAB',
			m.receipt_heading({ date: formatLongDate(new Date()) }),
			div,
			''
		];

		for (let i = 0; i < viajes.length; i++) {
			const v = viajes[i];
			if (v.id < 0) continue; // skip offline-queued
			const ruta = v.paradas.map(p => p.nombre).join(' → ');
			const pasajeros = v.clientes.map(c => c.nombre).join(', ');
			const usd = v.precioUsd ? parseFloat(v.precioUsd) : null;
			const precioLine = usd != null
				? tasa ? `${formatUsd(usd)}  (${formatBs(usd * tasa)})` : formatUsd(usd)
				: m.common_no_price();

			lines.push(`${i + 1}. ${formatDayMonth(v.creadoEn)}  •  ${ruta}`);
			lines.push(`   ${pasajeros}`);
			lines.push(`   ${precioLine}`);
			lines.push('');
		}

		const total = viajes.filter(v => v.id >= 0).reduce((s, v) => s + (v.precioUsd ? parseFloat(v.precioUsd) : 0), 0);
		const count = viajes.filter(v => v.id >= 0).length;
		const totalLine = tasa
			? `${formatUsd(total)}  (${formatBs(total * tasa)})`
			: formatUsd(total);

		lines.push(div);
		const footer = count === 1 ? m.receipt_footer_one : m.receipt_footer_other;
		lines.push(footer({ count, total: totalLine }));

		return lines.join('\n');
	}

	async function handleExport() {
		const text = buildReceipt(visibleViajes);
		if (typeof navigator !== 'undefined' && navigator.share) {
			try {
				await navigator.share({ text });
				return;
			} catch {
				// user cancelled — fall through to clipboard
			}
		}
		await navigator.clipboard.writeText(text);
		sileo.success({ title: m.home_summary_copied(), description: m.home_summary_copied_desc() });
	}
</script>

<QuickRides onCreated={onSaved} />

<SummaryBar
	count={visibleViajes.length}
	{totalUsd}
	tasa={data.tasa?.tasa ?? null}
	stale={data.tasa?.stale ?? false}
	onPayAll={handlePayAll}
	onExport={handleExport}
/>

{#if visibleViajes.length === 0}
	<div class="flex flex-col items-center justify-center py-24 gap-2">
		<p class="text-base-content/60 text-sm">{m.home_empty()}</p>
	</div>
{:else}
	<div class="space-y-3 pwa-list-inset">
		{#each visibleViajes as viaje (viaje.id)}
			<div
				in:fly={mounted ? { y: 24, duration: 220, easing: cubicOut } : { duration: 0 }}
				out:fly={{ x: 400, duration: 300, easing: cubicIn }}
			>
				<RideCard
					{viaje}
					tasa={data.tasa?.tasa ?? null}
					pending={viaje.id < 0}
					onPaid={handlePaid}
					onDeleted={handleDeleted}
					onEdit={handleEdit}
					onPriceUpdated={handlePriceUpdated}
				/>
			</div>
		{/each}
	</div>
{/if}

<AddRideSheet bind:open={showSheet} {editViaje} {onSaved} />

<button
	onclick={openCreate}
	class="btn btn-primary btn-circle btn-lg fixed pwa-fab right-4 shadow-lg z-20"
	aria-label={m.home_add_ride()}
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-7 w-7"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2.5"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
	</svg>
</button>

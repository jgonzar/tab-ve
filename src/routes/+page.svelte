<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { pendingStore } from '$lib/stores/pending.svelte';
	import { sileo } from 'svelte-sileo';
	import AddRideSheet from '$lib/components/AddRideSheet.svelte';
	import RideCard, { type RideData } from '$lib/components/RideCard.svelte';
	import SummaryBar from '$lib/components/SummaryBar.svelte';
	import QuickRides from '$lib/components/QuickRides.svelte';

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

	async function onSaved() {
		await invalidateAll();
	}

	async function handlePriceUpdated() {
		await invalidateAll();
	}

	async function handlePayAll() {
		const res = await fetch('/api/viajes', { method: 'PATCH' });
		if (!res.ok) {
			sileo.error({ title: 'No se pudieron marcar todas', description: 'Intenta de nuevo.' });
			return;
		}
		sileo.success({ title: 'Todo pagado', description: 'Las carreras se movieron al historial.' });
		hiddenIds = new Set();
		await invalidateAll();
	}

	function buildReceipt(viajes: RideData[]): string {
		const tasa = data.tasa?.tasa ?? null;
		const today = new Intl.DateTimeFormat('es-VE', {
			day: 'numeric', month: 'long', year: 'numeric'
		}).format(new Date());
		const div = '─'.repeat(36);
		const fmtFecha = (d: Date | string) =>
			new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short' }).format(new Date(d));
		const fmtUsd = (n: number) =>
			new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
		const fmtVes = (n: number) =>
			'Bs. ' + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

		const lines: string[] = [
			'YUMMY TRACK',
			`Carreras pendientes — ${today}`,
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
				? tasa ? `${fmtUsd(usd)}  (${fmtVes(usd * tasa)})` : fmtUsd(usd)
				: 'Sin precio';

			lines.push(`${i + 1}. ${fmtFecha(v.creadoEn)}  •  ${ruta}`);
			lines.push(`   ${pasajeros}`);
			lines.push(`   ${precioLine}`);
			lines.push('');
		}

		const total = viajes.filter(v => v.id >= 0).reduce((s, v) => s + (v.precioUsd ? parseFloat(v.precioUsd) : 0), 0);
		const count = viajes.filter(v => v.id >= 0).length;
		const totalLine = tasa
			? `${fmtUsd(total)}  (${fmtVes(total * tasa)})`
			: fmtUsd(total);

		lines.push(div);
		lines.push(`${count} carrera${count !== 1 ? 's' : ''}  •  Total: ${totalLine}`);

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
		sileo.success({ title: 'Resumen copiado', description: 'Pégalo donde quieras compartirlo.' });
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
		<p class="text-base-content/60 text-sm">No hay carreras pendientes</p>
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
	class="btn btn-primary btn-circle btn-lg fixed pwa-fab right-6 shadow-lg z-20"
	aria-label="Agregar carrera"
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

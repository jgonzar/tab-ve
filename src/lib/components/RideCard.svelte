<script lang="ts">
	import { untrack } from 'svelte';
	import { sileo } from 'svelte-sileo';
	import ConfirmDialog from './ConfirmDialog.svelte';

	export type RideData = {
		id: number;
		creadoEn: Date | string;
		pagadoEn?: Date | string | null;
		borradoEn?: Date | string | null;
		precioUsd: string | null;
		minutosEspera: number | null;
		notas: string | null;
		clientes: { id: number; nombre: string }[];
		paradas: { id: number; nombre: string }[]; // ordered: [origen, ...stops, destino]
	};

	let {
		viaje,
		tasa = null,
		pending = false,
		onPaid,
		onDeleted,
		onEdit,
		onPriceUpdated,
		onRestore,
		onUnpaid
	}: {
		viaje: RideData;
		tasa?: number | null;
		pending?: boolean;
		onPaid?: (id: number) => void;
		onDeleted?: (id: number) => void;
		onEdit?: (viaje: RideData) => void;
		onPriceUpdated?: (id: number) => void;
		onRestore?: (id: number) => void;
		onUnpaid?: (id: number) => void;
	} = $props();

	// ── price state ───────────────────────────────────────────────────────────
	let paying = $state(false);
	let deleting = $state(false);
	let restoring = $state(false);
	let unpaying = $state(false);
	let confirmingDelete = $state(false);
	let editingPrice = $state(false);
	let menuOpen = $state(false);
	let priceInput = $state('');
	let savingPrice = $state(false);

	let localPriceUsd = $state(viaje.precioUsd);
	$effect(() => {
		const p = viaje.precioUsd;
		untrack(() => { localPriceUsd = p; });
	});

	// ── deriveds ─────────────────────────────────────────────────────────────
	const origen = $derived(viaje.paradas[0]?.nombre ?? '—');
	const destino = $derived(viaje.paradas[viaje.paradas.length - 1]?.nombre ?? '—');
	const stops = $derived(viaje.paradas.slice(1, -1).map((p) => p.nombre));

	const precio = $derived(
		localPriceUsd
			? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
					parseFloat(localPriceUsd)
				)
			: null
	);

	const precioVes = $derived(
		tasa && localPriceUsd
			? 'Bs. ' +
					new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
						parseFloat(localPriceUsd) * tasa
					)
			: null
	);

	const fecha = $derived(
		new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }).format(
			new Date(viaje.creadoEn)
		)
	);

	const fechaPago = $derived(
		viaje.pagadoEn
			? new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }).format(
					new Date(viaje.pagadoEn)
				)
			: null
	);

	const fechaBorrado = $derived(
		viaje.borradoEn
			? new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }).format(
					new Date(viaje.borradoEn)
				)
			: null
	);

	// A ride is actionable only while it's live: not paid, not queued offline,
	// and not in the trash. Gates the price editor, the ••• menu and the sheet.
	const actionable = $derived(!fechaPago && !pending && !viaje.borradoEn);

	// ── actions ───────────────────────────────────────────────────────────────
	function startEditPrice() {
		if (!actionable) return;
		priceInput = localPriceUsd ?? '';
		editingPrice = true;
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	async function savePrice() {
		const val = parseFloat(priceInput.replace(',', '.').trim());
		if (isNaN(val) || val < 0) return;
		savingPrice = true;
		try {
			const res = await fetch(`/api/viajes/${viaje.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ precioUsd: val })
			});
			if (!res.ok) throw new Error();
			localPriceUsd = String(val);
			editingPrice = false;
			onPriceUpdated?.(viaje.id);
		} catch {
			// keep input open
		} finally {
			savingPrice = false;
		}
	}

	async function markPaid() {
		paying = true;
		try {
			const res = await fetch(`/api/viajes/${viaje.id}`, { method: 'PATCH' });
			if (!res.ok) throw new Error();
			sileo.success({ title: 'Carrera pagada', description: 'Movida al historial.' });
			onPaid?.(viaje.id);
		} catch {
			sileo.error({ title: 'No se pudo marcar como pagada', description: 'Intenta de nuevo.' });
			paying = false;
		}
	}

	async function deleteRide() {
		deleting = true;
		try {
			const res = await fetch(`/api/viajes/${viaje.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error();
			sileo.success({ title: 'Carrera eliminada', description: 'Puedes restaurarla desde la papelera.' });
			// Close explicitly rather than relying on the parent unmounting the card —
			// a call site without onDeleted would otherwise leave the dialog spinning.
			confirmingDelete = false;
			onDeleted?.(viaje.id);
		} catch {
			sileo.error({ title: 'No se pudo eliminar', description: 'Intenta de nuevo.' });
		} finally {
			deleting = false;
		}
	}

	async function unpayRide() {
		unpaying = true;
		try {
			const res = await fetch(`/api/viajes/${viaje.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ unpay: true })
			});
			if (!res.ok) throw new Error();
			sileo.success({ title: 'Carrera devuelta a pendientes', description: 'Vuelve a aparecer en Inicio.' });
			onUnpaid?.(viaje.id);
		} catch {
			sileo.error({ title: 'No se pudo devolver', description: 'Intenta de nuevo.' });
			unpaying = false;
		}
	}

	async function restoreRide() {
		restoring = true;
		try {
			const res = await fetch(`/api/viajes/${viaje.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ restore: true })
			});
			if (!res.ok) throw new Error();
			sileo.success({ title: 'Carrera restaurada', description: 'Vuelve a aparecer en Inicio.' });
			onRestore?.(viaje.id);
		} catch {
			sileo.error({ title: 'No se pudo restaurar', description: 'Intenta de nuevo.' });
			restoring = false;
		}
	}
</script>

<div class="card bg-base-200 shadow-sm" class:opacity-80={pending}>
	<div class="card-body p-4 gap-3">

		<!-- Price edit: full-width overlay at top of card when active -->
		{#if editingPrice}
			<div class="flex items-center gap-2">
				<!-- The prefix comes after the input so it paints on top (see AddRideSheet) -->
				<div class="relative flex-1">
					<input
						use:focusAndSelect
						type="text"
						bind:value={priceInput}
						inputmode="decimal"
						pattern="^\d*\.?\d*$"
						class="input input-bordered w-full pl-9 text-xl font-bold"
						onkeydown={(e) => {
							if (e.key === 'Enter') savePrice();
							if (e.key === 'Escape') editingPrice = false;
						}}
					/>
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60 font-medium">$</span>
				</div>
				<button
					class="btn btn-accent btn-square"
					onclick={savePrice}
					disabled={savingPrice}
					aria-label="Guardar precio"
				>
					{#if savingPrice}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						✓
					{/if}
				</button>
				<button
					class="btn btn-ghost btn-square"
					onclick={() => (editingPrice = false)}
					aria-label="Cancelar"
				>
					✕
				</button>
			</div>
		{:else}
			<!-- Header: clients + price display + menu -->
			<div class="flex items-start justify-between gap-2">
				<div class="flex flex-wrap gap-1">
					{#each viaje.clientes as cliente}
						<span class="badge badge-primary badge-sm">{cliente.nombre}</span>
					{/each}
				</div>

				<div class="flex items-start gap-10 shrink-0">
					<div class="flex flex-col">
						{#if precio}
							<button
								class="font-bold text-base"
								class:cursor-default={!actionable}
								onclick={startEditPrice}
								aria-label={actionable ? 'Editar precio' : undefined}
							>
								{precio}
							</button>
						{:else}
							<button class="flex flex-col text-left" onclick={startEditPrice}>
								<span class="text-xs text-info font-medium leading-tight">Sin precio</span>
								<span class="font-bold text-base text-base-content/60 leading-tight">Pendiente</span>
							</button>
						{/if}
						{#if precioVes}
							<span class="text-xs text-base-content/60">{precioVes}</span>
						{/if}
					</div>

					{#if actionable}
						<button
							class="btn btn-ghost btn-sm btn-circle text-base-content/80"
							onclick={() => (menuOpen = true)}
							aria-label="Opciones"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
								<circle cx="5" cy="12" r="2" />
								<circle cx="12" cy="12" r="2" />
								<circle cx="19" cy="12" r="2" />
							</svg>
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Route -->
		<div class="text-sm">
			<p class="font-medium text-base-content">{origen}</p>
			{#each stops as stop}
				<p class="text-base-content/60 pl-3 leading-6">↓ {stop}</p>
			{/each}
			<p class="text-base-content/60 leading-6">→ {destino}</p>
		</div>

		<!-- Meta -->
		{#if viaje.minutosEspera}
			<div class="text-xs text-base-content/60">{viaje.minutosEspera} min espera</div>
		{/if}

		{#if viaje.notas}
			<p class="text-xs text-base-content/60 italic">{viaje.notas}</p>
		{/if}

		<!-- Footer -->
		{#if onRestore}
			<div class="flex items-center justify-between pt-2 border-t border-base-300">
				<span class="text-xs text-base-content/60">Borrado {fechaBorrado}</span>
				<button class="btn btn-primary btn-xs" onclick={restoreRide} disabled={restoring}>
					{#if restoring}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						Restaurar
					{/if}
				</button>
			</div>
		{:else}
			<div class="flex items-center justify-between pt-2 border-t border-base-300">
				<span class="text-xs text-base-content/60">{fecha}</span>
				{#if pending}
					<span class="flex items-center gap-1 text-xs text-base-content/60">
						<span class="loading loading-spinner loading-xs"></span>
						Pendiente
					</span>
				{:else if fechaPago}
					<div class="flex items-center gap-3">
						<span class="text-xs text-success">Pagado {fechaPago}</span>
						{#if onUnpaid}
							<button
								class="btn btn-ghost btn-sm text-base-content/80"
								onclick={unpayRide}
								disabled={unpaying}
							>
								{#if unpaying}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									Devolver a pendientes
								{/if}
							</button>
						{/if}
					</div>
				{:else}
					<button class="btn btn-accent btn-sm" onclick={markPaid} disabled={paying}>
						{#if paying}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Marcar Pagado
						{/if}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Action sheet — kept at the component root, outside the card's own layout. -->
{#if actionable}
	<div class="modal modal-bottom" class:modal-open={menuOpen} role="dialog" aria-modal="true">
		<div class="modal-box bg-base-200 p-0">
			<div class="px-5 pt-4 pb-3 text-center">
				<p class="text-sm text-base-content/60 truncate">{origen} → {destino}</p>
			</div>

			<button
				class="w-full flex items-center gap-4 px-5 py-4 text-base border-t border-base-300 active:bg-base-300"
				onclick={() => { menuOpen = false; onEdit?.(viaje); }}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
				Editar
			</button>

			<button
				class="w-full flex items-center gap-4 px-5 py-4 text-base text-error border-t border-base-300 active:bg-base-300"
				onclick={() => { menuOpen = false; confirmingDelete = true; }}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
				Eliminar
			</button>

			<div class="border-t border-base-300 px-5 pt-3 pwa-sheet-footer">
				<button class="btn btn-ghost w-full" onclick={() => (menuOpen = false)}>Cancelar</button>
			</div>
		</div>

		<div class="modal-backdrop" role="none">
			<button type="button" onclick={() => (menuOpen = false)}>cerrar</button>
		</div>
	</div>
{/if}

<ConfirmDialog
	bind:open={confirmingDelete}
	title="¿Eliminar esta carrera?"
	confirmLabel="Sí, eliminar"
	confirmClass="btn-error"
	busy={deleting}
	onConfirm={deleteRide}
>
	Se eliminará <span class="font-semibold text-base-content">{origen} → {destino}</span>.
	Podrás restaurarla desde la papelera en Historial.
</ConfirmDialog>

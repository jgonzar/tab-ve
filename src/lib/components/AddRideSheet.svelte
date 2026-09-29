<script module lang="ts">
	let locationCache: { id: number; nombre: string }[] | null = null;
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { DEFAULT_CLIENT_IDS } from '$lib/rideDefaults';
	import { networkState } from '$lib/stores/network.svelte';
	import { pendingStore, type PendingRide } from '$lib/stores/pending.svelte';
	import { sileo } from 'svelte-sileo';
	import LocationSelect, { type FormLocation } from './LocationSelect.svelte';
	import LocationChips from './LocationChips.svelte';
	import type { RideData } from './RideCard.svelte';

	type StopItem = { key: number; location: FormLocation | null };

	let {
		open = $bindable(false),
		editViaje = null,
		onSaved
	}: {
		open: boolean;
		editViaje?: RideData | null;
		onSaved?: (viaje: unknown) => void;
	} = $props();

	// No longer collected in the form — see $lib/rideDefaults. Kept in state so an
	// edit preserves whatever the ride was originally assigned, rather than
	// silently rewriting older JA-only rides to the shared default.
	let clienteIds = $state<number[]>([...DEFAULT_CLIENT_IDS]);
	let origen = $state<FormLocation | null>(null);
	let paradas = $state<StopItem[]>([]);
	let destino = $state<FormLocation | null>(null);
	let precioUsd = $state('');
	let minutosEspera = $state('');
	let notas = $state('');
	let fechaViaje = $state('');
	let errors = $state<Record<string, string>>({});
	let submitting = $state(false);
	let formKey = $state(0);
	let locations = $state<{ id: number; nombre: string }[]>([]);
	let stopCounter = $state(0);

	// Fetch once on mount; reuse cache on subsequent opens.
	// Cache is cleared after a save so new locations appear next time.
	$effect(() => {
		if (locationCache) {
			locations = locationCache;
			return;
		}
		fetch('/api/ubicaciones')
			.then((r) => r.json())
			.then((data) => {
				locationCache = data;
				locations = data;
			});
	});

	// Form init — runs when sheet opens.
	// All state writes are inside untrack() so Svelte doesn't reschedule this effect.
	$effect(() => {
		if (open) {
			untrack(() => {
				const ev = editViaje;
				if (ev) populateFromEdit(ev);
				else resetForm();
			});
		}
	});

	function toDateInput(d: Date | string): string {
		return new Date(d).toISOString().slice(0, 10);
	}

	function normalizePrecio(s: string): string {
		return s.replace(',', '.').trim();
	}

	function populateFromEdit(v: RideData) {
		clienteIds = v.clientes.map((c) => c.id);
		origen = v.paradas[0] ?? null;
		paradas = v.paradas
			.slice(1, -1)
			.map((p) => ({ key: stopCounter++, location: p as FormLocation }));
		destino = v.paradas[v.paradas.length - 1] ?? null;
		precioUsd = v.precioUsd ?? '';
		minutosEspera = v.minutosEspera?.toString() ?? '';
		notas = v.notas ?? '';
		fechaViaje = toDateInput(v.creadoEn);
		errors = {};
		formKey++;
	}

	function addParada() {
		paradas = [...paradas, { key: stopCounter++, location: null }];
	}

	function removeParada(key: number) {
		paradas = paradas.filter((p) => p.key !== key);
	}

	function resetForm() {
		clienteIds = [...DEFAULT_CLIENT_IDS];
		origen = null;
		paradas = [];
		destino = null;
		precioUsd = '';
		minutosEspera = '';
		notas = '';
		fechaViaje = new Date().toISOString().slice(0, 10);
		errors = {};
		formKey++;
	}

	function close() {
		open = false;
		resetForm();
	}

	const FIELD_LABELS: Record<string, string> = {
		origen: 'Origen',
		destino: 'Destino',
		paradas: 'Paradas',
		precio: 'Precio'
	};

	const validationSummary = $derived(
		Object.keys(errors)
			.filter((k) => k !== 'submit')
			.map((k) => FIELD_LABELS[k] ?? k)
			.join(', ')
	);

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!origen) e.origen = 'Requerido';
		if (!destino) e.destino = 'Requerido';
		const normalizedPrecio = normalizePrecio(precioUsd);
		if (normalizedPrecio && (isNaN(parseFloat(normalizedPrecio)) || parseFloat(normalizedPrecio) < 0))
			e.precio = 'Ingresa un precio válido';
		if (paradas.some((p) => !p.location)) e.paradas = 'Completa todas las paradas';
		errors = e;
		return Object.keys(e).length === 0;
	}

	function buildPayload() {
		const normalizedPrecio = normalizePrecio(precioUsd);
		return {
			clienteIds,
			origen,
			paradas: paradas.map((p) => p.location),
			destino,
			precioUsd: normalizedPrecio || null,
			minutosEspera: minutosEspera ? parseInt(minutosEspera) : undefined,
			notas: notas.trim() || undefined,
			creadoEn: fechaViaje || undefined
		};
	}

	function queueOffline(payload: ReturnType<typeof buildPayload>) {
		const pending: PendingRide = {
			localId: Date.now().toString(),
			creadoEn: new Date().toISOString(),
			clienteIds,
			origenNombre: origen!.nombre,
			paradaNombres: paradas.map((p) => p.location!.nombre),
			destinoNombre: destino!.nombre,
			precioUsd,
			minutosEspera: minutosEspera ? parseInt(minutosEspera) : undefined,
			notas: notas.trim() || undefined,
			payload
		};
		pendingStore.add(pending);
		locationCache = null;
		sileo.success({ title: 'Carrera guardada', description: 'Se enviará cuando vuelva la conexión.' });
		close();
		onSaved?.(pending);
	}

	async function submit() {
		if (!validate()) return;
		submitting = true;
		errors = {};

		const payload = buildPayload();

		// Offline and creating — queue immediately without attempting fetch
		if (!networkState.online && !editViaje) {
			queueOffline(payload);
			submitting = false;
			return;
		}

		const url = editViaje ? `/api/viajes/${editViaje.id}` : '/api/viajes';
		const method = editViaje ? 'PUT' : 'POST';

		try {
			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Error al guardar');
			}

			const viaje = await res.json();
			locationCache = null;
			sileo.success(
				editViaje
					? { title: 'Carrera actualizada', description: 'Los cambios se guardaron.' }
					: { title: 'Carrera creada', description: 'Agregada a pendientes.' }
			);
			close();
			onSaved?.(viaje);
		} catch (e) {
			// Network failure mid-request (went offline) — fall back to queue for creates
			if (e instanceof TypeError && !editViaje) {
				queueOffline(payload);
			} else {
				errors = { submit: e instanceof Error ? e.message : 'No se pudo guardar la carrera' };
			}
		} finally {
			submitting = false;
		}
	}
</script>

<!-- modal-open class drives visibility — no showModal()/close() -->
<div class="modal modal-bottom" class:modal-open={open} role="dialog" aria-modal="true">
	<div class="modal-box bg-base-200 max-h-[92vh] flex flex-col p-0">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
			<h3 class="font-bold text-lg">{editViaje ? 'Editar Carrera' : 'Nueva Carrera'}</h3>
			<button
				type="button"
				onclick={close}
				class="btn btn-circle bg-base-300 border-none text-base-content hover:bg-base-100"
				aria-label="Cerrar"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Scrollable form body -->
		<div class="overflow-y-auto flex-1 px-4 py-4 space-y-5">
			{#key formKey}
				<!-- Ruta -->
				<div class="space-y-2">
					<label class="text-base font-semibold text-base-content/80">Ruta</label>

					<div class="space-y-1">
						<span class="text-sm text-base-content/60">Origen</span>
						<LocationSelect bind:value={origen} {locations} placeholder="¿Desde dónde?" />
						<LocationChips value={origen} onSelect={(loc) => (origen = loc)} />
						{#if errors.origen}
							<p class="text-error text-sm">{errors.origen}</p>
						{/if}
					</div>

					{#each paradas as parada (parada.key)}
						<div class="flex gap-2 items-start">
							<!-- min-w-0: a flex child defaults to min-width:auto, so the chips row's
							     intrinsic width would push this column past the sheet and scroll the
							     whole form sideways instead of just the chips. -->
							<div class="flex-1 min-w-0 space-y-1">
								<span class="text-sm text-base-content/60">Parada</span>
								<LocationSelect
									bind:value={parada.location}
									{locations}
									placeholder="¿Dónde para?"
								/>
								<LocationChips value={parada.location} onSelect={(loc) => (parada.location = loc)} />
							</div>
							<button
								type="button"
								onclick={() => removeParada(parada.key)}
								class="btn btn-circle shrink-0 mt-7 bg-base-300 border-none text-error hover:bg-error hover:text-error-content"
								aria-label="Eliminar parada"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/each}

					{#if errors.paradas}
						<p class="text-error text-sm">{errors.paradas}</p>
					{/if}

					<button
						type="button"
						onclick={addParada}
						class="btn btn-ghost btn-sm h-10 text-sm text-base-content/60 px-2 -ml-2"
					>
						+ Agregar parada
					</button>

					<div class="space-y-1">
						<span class="text-sm text-base-content/60">Destino</span>
						<LocationSelect bind:value={destino} {locations} placeholder="¿A dónde?" />
						<LocationChips value={destino} onSelect={(loc) => (destino = loc)} />
						{#if errors.destino}
							<p class="text-error text-sm">{errors.destino}</p>
						{/if}
					</div>
				</div>

				<!-- Precio -->
				<div class="space-y-1">
					<label class="text-base font-semibold text-base-content/80">Precio</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60 text-base">$</span>
						<input
							type="text"
							bind:value={precioUsd}
							inputmode="decimal"
							pattern="^\d*\.?\d*$"
							placeholder="0.00"
							class="input input-bordered input-lg w-full pl-8"
						/>
					</div>
					{#if errors.precio}
						<p class="text-error text-sm">{errors.precio}</p>
					{/if}
				</div>

				<!-- Espera (opcional) -->
				<div class="space-y-1">
					<label class="text-base font-semibold text-base-content/80">
						Tiempo de espera
						<span class="text-base-content/60 font-normal">(opcional)</span>
					</label>
					<div class="relative">
						<input
							type="number"
							bind:value={minutosEspera}
							min="0"
							inputmode="numeric"
							placeholder="0"
							class="input input-bordered input-lg w-full pr-16"
						/>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/60 text-base">min</span>
					</div>
				</div>

				<!-- Notas (opcional) -->
				<div class="space-y-1">
					<label class="text-base font-semibold text-base-content/80">
						Notas
						<span class="text-base-content/60 font-normal">(opcional)</span>
					</label>
					<textarea
						bind:value={notas}
						rows="2"
						placeholder="Algún detalle del viaje..."
						class="textarea textarea-bordered textarea-lg w-full resize-none"
					></textarea>
				</div>

				<!-- Fecha -->
				<div class="space-y-1">
					<label for="fecha-viaje" class="text-base font-semibold text-base-content/80">Fecha</label>
					<input
						id="fecha-viaje"
						type="date"
						bind:value={fechaViaje}
						class="input input-bordered input-lg w-full"
					/>
				</div>
			{/key}

		</div>

		<!-- Footer actions -->
		<div class="px-4 pt-3 pwa-sheet-footer border-t border-base-300 shrink-0 space-y-2">
		{#if validationSummary}
			<p class="text-error text-sm">Faltan: {validationSummary}</p>
		{:else if errors.submit}
			<p class="text-error text-sm">{errors.submit}</p>
		{/if}
		<div class="flex gap-2">
			<button type="button" onclick={close} class="btn btn-ghost flex-1" disabled={submitting}>
				Cancelar
			</button>
			<button
				type="button"
				onclick={submit}
				class="btn btn-primary flex-1"
				disabled={submitting}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					{editViaje ? 'Guardar Cambios' : 'Guardar Carrera'}
				{/if}
			</button>
		</div>
		</div>
	</div>

	<!-- Backdrop -->
	<div class="modal-backdrop" role="none">
		<button type="button" onclick={close}>cerrar</button>
	</div>
</div>

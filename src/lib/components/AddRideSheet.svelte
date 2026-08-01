<script module>
	let locationCache: { id: number; nombre: string }[] | null = null;
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { USERS } from '$lib/stores/user.svelte';
	import { networkState } from '$lib/stores/network.svelte';
	import { pendingStore, type PendingRide } from '$lib/stores/pending.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
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

	const CLIENTES = USERS.filter((u) => u.rol === 'cliente');

	let clienteIds = $state<number[]>([]);
	let conductorNombre = $state('MC');
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
		conductorNombre = v.conductorNombre;
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

	function toggleCliente(id: number) {
		clienteIds = clienteIds.includes(id) ? clienteIds.filter((c) => c !== id) : [...clienteIds, id];
	}

	function addParada() {
		paradas = [...paradas, { key: stopCounter++, location: null }];
	}

	function removeParada(key: number) {
		paradas = paradas.filter((p) => p.key !== key);
	}

	function resetForm() {
		clienteIds = [];
		conductorNombre = 'MC';
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
		clientes: 'Para quién',
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
		if (clienteIds.length === 0) e.clientes = 'Selecciona al menos un cliente';
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
			conductorNombre,
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
			conductorNombre,
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
		toastStore.add('Carrera creada exitosamente', 'success');
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
			toastStore.add(editViaje ? 'Carrera actualizada' : 'Carrera creada exitosamente', 'success');
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
	<div class="modal-box max-h-[92vh] flex flex-col p-0">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
			<h3 class="font-bold text-base">{editViaje ? 'Editar Carrera' : 'Nueva Carrera'}</h3>
			<button
				type="button"
				onclick={close}
				class="btn btn-ghost btn-sm btn-circle"
				aria-label="Cerrar"
			>
				✕
			</button>
		</div>

		<!-- Scrollable form body -->
		<div class="overflow-y-auto flex-1 px-4 py-4 space-y-5">
			{#key formKey}
				<!-- Clientes -->
				<div class="space-y-1">
					<label class="text-sm font-medium text-base-content/70">Para quién</label>
					<div class="flex gap-2">
						{#each CLIENTES as cliente}
							<button
								type="button"
								onclick={() => toggleCliente(cliente.id)}
								class="badge badge-lg gap-1 cursor-pointer transition-colors"
								class:badge-primary={clienteIds.includes(cliente.id)}
								class:badge-outline={!clienteIds.includes(cliente.id)}
							>
								{cliente.nombre}
							</button>
						{/each}
					</div>
					{#if errors.clientes}
						<p class="text-error text-xs">{errors.clientes}</p>
					{/if}
				</div>

				<!-- Conductor -->
				<div class="space-y-1">
					<label class="text-sm font-medium text-base-content/70">Conductor</label>
					<input
						type="text"
						bind:value={conductorNombre}
						class="input input-bordered w-full"
						placeholder="MC"
					/>
				</div>

				<!-- Ruta -->
				<div class="space-y-2">
					<label class="text-sm font-medium text-base-content/70">Ruta</label>

					<div class="space-y-1">
						<span class="text-xs text-base-content/50">Origen</span>
						<LocationSelect bind:value={origen} {locations} placeholder="¿Desde dónde?" />
						<LocationChips value={origen} onSelect={(loc) => (origen = loc)} />
						{#if errors.origen}
							<p class="text-error text-xs">{errors.origen}</p>
						{/if}
					</div>

					{#each paradas as parada (parada.key)}
						<div class="flex gap-2 items-start">
							<div class="flex-1 space-y-1">
								<span class="text-xs text-base-content/50">Parada</span>
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
								class="btn btn-ghost btn-sm btn-circle mt-6"
								aria-label="Eliminar parada"
							>
								✕
							</button>
						</div>
					{/each}

					{#if errors.paradas}
						<p class="text-error text-xs">{errors.paradas}</p>
					{/if}

					<button
						type="button"
						onclick={addParada}
						class="btn btn-ghost btn-xs text-base-content/50 pl-0"
					>
						+ Agregar parada
					</button>

					<div class="space-y-1">
						<span class="text-xs text-base-content/50">Destino</span>
						<LocationSelect bind:value={destino} {locations} placeholder="¿A dónde?" />
						<LocationChips value={destino} onSelect={(loc) => (destino = loc)} />
						{#if errors.destino}
							<p class="text-error text-xs">{errors.destino}</p>
						{/if}
					</div>
				</div>

				<!-- Precio -->
				<div class="space-y-1">
					<label class="text-sm font-medium text-base-content/70">Precio</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 text-sm">$</span>
						<input
							type="text"
							bind:value={precioUsd}
							inputmode="decimal"
							pattern="^\d*\.?\d*$"
							placeholder="0.00"
							class="input input-bordered w-full pl-7"
						/>
					</div>
					{#if errors.precio}
						<p class="text-error text-xs">{errors.precio}</p>
					{/if}
				</div>

				<!-- Espera (opcional) -->
				<div class="space-y-1">
					<label class="text-sm font-medium text-base-content/70">
						Tiempo de espera
						<span class="text-base-content/40 font-normal">(opcional)</span>
					</label>
					<div class="relative">
						<input
							type="number"
							bind:value={minutosEspera}
							min="0"
							inputmode="numeric"
							placeholder="0"
							class="input input-bordered w-full pr-14"
						/>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm">min</span>
					</div>
				</div>

				<!-- Notas (opcional) -->
				<div class="space-y-1">
					<label class="text-sm font-medium text-base-content/70">
						Notas
						<span class="text-base-content/40 font-normal">(opcional)</span>
					</label>
					<textarea
						bind:value={notas}
						rows="2"
						placeholder="Algún detalle del viaje..."
						class="textarea textarea-bordered w-full resize-none"
					></textarea>
				</div>

				<!-- Fecha -->
				<div class="space-y-1">
					<label for="fecha-viaje" class="text-sm font-medium text-base-content/70">Fecha</label>
					<input
						id="fecha-viaje"
						type="date"
						bind:value={fechaViaje}
						class="input input-bordered w-full"
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

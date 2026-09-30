<script lang="ts" module>
	export type QuickRoute = { label: string; origen: string; paradas?: string[]; destino: string };
	/** What the submit did: sent to the server, queued offline, or failed. */
	export type SubmitResult = 'saved' | 'queued' | 'error';
</script>

<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { DEFAULT_CLIENT_IDS } from '$lib/rideDefaults';
	import { USERS } from '$lib/stores/user.svelte';

	/**
	 * The quick-ride confirmation: a card with a header tab (the Tab
	 * silhouette). Open it with `open(route, chip)`. It asks, then runs the
	 * submit and morphs through saving into success, queued or error.
	 *
	 * Open and close are transform and opacity only, on promoted layers. The
	 * shadow is a box-shadow painted once on those layers (never a filter over
	 * moving content), so nothing repaints while they move. The fold on press
	 * is a clip-path wipe on the whole shape. Height changes are never
	 * animated: the card's top is pinned when it opens, and the DOM is swapped
	 * in the same frame the wipe ends (or starts, when growing). So the tab
	 * never moves.
	 */
	let { onSubmit }: { onSubmit: (route: QuickRoute) => Promise<SubmitResult> } = $props();

	type Phase = 'confirm' | 'saving' | 'success' | 'queued' | 'error';
	/** What sits under the route. Every change goes through 'none'. */
	type Tail = 'confirm' | 'none' | 'queued' | 'error';

	const TITLES: Record<Phase, string> = {
		confirm: '¿Registrar esta carrera?',
		saving: 'Registrando…',
		success: 'Carrera registrada',
		queued: 'Carrera guardada',
		error: 'No se pudo registrar'
	};
	const NOTES = {
		queued: 'Se enviará cuando vuelva la conexión.',
		error: 'Revisa tu conexión e intenta de nuevo.'
	};

	// Timings (ms)
	const OPEN_MS = 280; // open: tab and card rise and fade in together...
	const OPEN_STAGGER_MS = 60; // ...the card 60ms behind the tab (340ms in all)
	const CLOSE_MS = 180; // close: the reverse, card first...
	const CLOSE_STAGGER_MS = 40; // ...the tab 40ms behind (220ms in all)
	const FOLD_MS = 200; // the actions fold away on press
	const GROW_MS = 220; // the note (and error actions) unfold
	const MIN_SAVING_MS = 400; // the ring never just flashes
	const TRAVEL_MS = 700; // the dot runs along the arc, once
	const FADE_MS = 200; // reduced motion: open and close are a plain fade
	const AUTO_CLOSE_MS = { success: 1500, queued: 2500 };
	const EASE_OUT = 'cubic-bezier(0.2, 0, 0, 1)';
	const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
	const EASE_IN_EXPO = 'cubic-bezier(0.7, 0, 0.84, 0)'; // its mirror, for the close
	const EASE_IN_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';

	/** The card radius (rounded-3xl): clip-path wipes keep the corners round. */
	const clip = (bottom: string) => `inset(0px 0px ${bottom} 0px round 24px)`;

	const clients = DEFAULT_CLIENT_IDS.map((id) => USERS.find((u) => u.id === id)).filter(
		(u) => u !== undefined
	);
	const hora = new Intl.DateTimeFormat('es-VE', { hour: 'numeric', minute: '2-digit' });
	const titleId = 'quick-ride-title';

	let route = $state<QuickRoute | null>(null);
	let phase = $state<Phase>('confirm');
	let tail = $state<Tail>('confirm');
	let top = $state(0);
	let time = $state('');
	let announcement = $state('');
	let arcW = $state(0);
	let reduced = $state(false); // prefers-reduced-motion, read on open

	let overlay = $state<HTMLDivElement>();
	let backdrop = $state<HTMLDivElement>();
	let shell = $state<HTMLDivElement>();
	let tabGroup = $state<HTMLDivElement>();
	let bodyPlate = $state<HTMLDivElement>();
	let bodyEl = $state<HTMLDivElement>();
	let tailEl = $state<HTMLDivElement>();
	let registerBtn = $state<HTMLButtonElement>();
	let travelDot = $state<SVGCircleElement>();

	// Plain: bookkeeping, never rendered
	let closing = false;
	let trigger: HTMLElement | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const stops = $derived(route?.paradas ?? []);

	// The arc spans the room between the two badges: the mock's
	// M2,34 Q88,-8 174,34 at 176px, stretched to the measured width.
	const P0 = $derived({ x: 2, y: 34 });
	const P1 = $derived({ x: arcW / 2, y: -8 });
	const P2 = $derived({ x: arcW - 2, y: 34 });
	const arcPath = $derived(`M${P0.x},${P0.y} Q${P1.x},${P1.y} ${P2.x},${P2.y}`);
	function arcAt(t: number) {
		const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
		return { x: a * P0.x + b * P1.x + c * P2.x, y: a * P0.y + b * P1.y + c * P2.y };
	}
	// One dot per stop, spread along the arc (a single stop sits at the top)
	const stopPoints = $derived(stops.map((_, i) => arcAt((i + 1) / (stops.length + 1))));

	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

	export async function open(r: QuickRoute, from?: HTMLElement | null) {
		if (route) return;
		trigger = from ?? null;
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		closing = false;
		phase = 'confirm';
		tail = 'confirm';
		announcement = '';
		time = hora.format(new Date());
		route = r;
		await tick();

		// Pin the top where the confirm card sits centred. Later states only
		// change what's below the route, so the tab keeps this position.
		top = Math.round((overlay!.clientHeight - shell!.offsetHeight) / 2);
		await tick();

		window.addEventListener('keydown', onKeydown);
		registerBtn?.focus({ preventScroll: true });

		if (reduced) {
			overlay!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' });
			return;
		}
		const anims = await rise(true);
		anims.forEach((a) => a.cancel()); // settled at rest: hand back to plain CSS
	}

	const HIDDEN = { opacity: 0, transform: 'translateY(8px) scale(0.96)' };
	const SHOWN = { opacity: 1, transform: 'none' };

	/**
	 * Open (show) or close: the tab and the card (with its shadow plate) rise or
	 * sink as one motion, one lagging the other slightly. Both scale about the
	 * seam between them, so they stay joined.
	 */
	async function rise(show: boolean) {
		const tab = [tabGroup!];
		const card = [bodyPlate!, bodyEl!];
		const [lead, lag] = show ? [tab, card] : [card, tab];
		const duration = show ? OPEN_MS : CLOSE_MS;
		const delay = show ? OPEN_STAGGER_MS : CLOSE_STAGGER_MS;
		const easing = show ? EASE_OUT_EXPO : EASE_IN_EXPO;
		const frames = show ? [HIDDEN, SHOWN] : [SHOWN, HIDDEN];
		for (const el of [...lead, ...lag]) el.style.willChange = 'transform, opacity';
		const anims = [
			backdrop!.animate([{ opacity: show ? 0 : 1 }, { opacity: show ? 1 : 0 }], {
				duration: duration + delay,
				easing: show ? 'ease-out' : 'ease-in',
				fill: 'forwards'
			}),
			...lead.map((el) => el.animate(frames, { duration, easing, fill: 'both' })),
			...lag.map((el) => el.animate(frames, { duration, delay, easing, fill: 'both' }))
		];
		await Promise.all(anims.map((a) => a.finished)).catch(() => {});
		for (const el of [...lead, ...lag]) el.style.willChange = '';
		return anims;
	}

	async function close() {
		if (!route || closing || phase === 'saving') return;
		closing = true;
		if (timer) clearTimeout(timer);
		timer = null;

		if (reduced) {
			await overlay!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-in', fill: 'forwards' }).finished;
		} else {
			// An open still settling (a quick Escape) stops where it is
			for (const el of [backdrop, tabGroup, bodyPlate, bodyEl, shell]) el?.getAnimations().forEach((a) => a.cancel());
			await rise(false); // the fills hold it hidden until it unmounts
		}

		window.removeEventListener('keydown', onKeydown);
		route = null;
		closing = false;
		await tick();
		trigger?.focus({ preventScroll: true });
		trigger = null;
	}

	async function register() {
		if (!route || closing || (phase !== 'confirm' && phase !== 'error')) return;
		const r = route;
		phase = 'saving';
		// The pressed button is about to fold away; keep focus in the dialog
		shell?.focus({ preventScroll: true });

		const request = onSubmit(r).catch((): SubmitResult => 'error');
		const minSaving = wait(MIN_SAVING_MS);
		await fold();
		const result = await request;
		await minSaving;
		if (route !== r) return;

		if (result === 'saved') {
			phase = 'success';
			announcement = TITLES.success;
			timer = setTimeout(close, AUTO_CLOSE_MS.success);
			await tick();
			runTravelDot();
		} else if (result === 'queued') {
			phase = 'queued';
			announcement = `${TITLES.queued}. ${NOTES.queued}`;
			timer = setTimeout(close, AUTO_CLOSE_MS.queued);
			await grow('queued');
		} else {
			phase = 'error';
			announcement = `${TITLES.error}. ${NOTES.error}`;
			await grow('error');
			registerBtn?.focus({ preventScroll: true });
		}
	}

	/** Wipe the tail off the bottom, then drop it in the frame the wipe ends. */
	async function fold() {
		const el = tailEl;
		if (tail === 'none' || !el || !shell) return;
		el.inert = true;
		if (reduced) {
			tail = 'none';
			await tick();
			return;
		}
		const d = el.offsetHeight;
		const wipe = shell.animate([{ clipPath: clip('0px') }, { clipPath: clip(`${d}px`) }], {
			duration: FOLD_MS,
			easing: EASE_IN_OUT,
			fill: 'forwards'
		});
		el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], {
			duration: FOLD_MS * 0.7,
			easing: 'ease-in',
			fill: 'forwards'
		});
		await wipe.finished.catch(() => {});
		tail = 'none';
		await tick(); // the DOM is shorter by exactly d before the next paint...
		wipe.cancel(); // ...so lifting the clip shows no jump
	}

	/** Add the tail clipped away, in the same frame, then wipe it into view. */
	async function grow(next: Tail) {
		tail = next;
		await tick();
		const el = tailEl;
		if (!el || !shell || reduced) return;
		const d = el.offsetHeight;
		el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: GROW_MS, easing: 'ease-out' });
		await shell
			.animate([{ clipPath: clip(`${d}px`) }, { clipPath: clip('0px') }], { duration: GROW_MS, easing: EASE_OUT })
			.finished.catch(() => {});
	}

	function runTravelDot() {
		if (!travelDot) return;
		const frames = Array.from({ length: 25 }, (_, i) => {
			const p = arcAt(i / 24);
			return { transform: `translate(${p.x}px, ${p.y}px)` };
		});
		travelDot.animate(frames, { duration: TRAVEL_MS, easing: EASE_IN_OUT, fill: 'forwards' });
	}

	function onOverlayClick(e: MouseEvent) {
		if (closing) return;
		// Success and queued close on a tap anywhere, the card included
		if (phase === 'success' || phase === 'queued') return void close();
		if ((phase === 'confirm' || phase === 'error') && !shell?.contains(e.target as Node)) close();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'Tab' && shell) {
			// Keep focus inside the card
			const items = [...shell.querySelectorAll<HTMLElement>('button:not([disabled])')].filter((b) => !b.closest('[inert]'));
			e.preventDefault();
			if (items.length === 0) return shell.focus({ preventScroll: true });
			const i = items.indexOf(document.activeElement as HTMLElement);
			const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
			items[next].focus();
		}
	}

	onDestroy(() => {
		if (timer) clearTimeout(timer);
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
	});
</script>

{#snippet arrow(d: string)}
	<span class="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-accent" aria-hidden="true">
		<svg class="size-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path {d} /></svg>
	</span>
{/snippet}

{#if route}
	<!-- Escape and Tab are handled on window while it's open (onKeydown) -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		bind:this={overlay}
		class="fixed inset-0 z-[60] flex touch-none items-start justify-center px-4"
		data-overlay
		role="presentation"
		onclick={onOverlayClick}
	>
		<div bind:this={backdrop} class="absolute inset-0 bg-black/60" aria-hidden="true"></div>

		<div
			class="relative w-full max-w-sm"
			style="margin-top: max({top}px, calc(var(--safe-top) + 1rem))"
		>
			<div
				bind:this={shell}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabindex="-1"
				class="relative isolate outline-none"
			>
				<!-- The card's shadow, on a plate behind everything: the tab paints over
				     its top edge, as a drop-shadow of the whole shape would. It moves
				     with the card. The plate is positioned, so the tab group (isolate) and the
				     body (relative) are positioned too, to paint after it. -->
				<div
					bind:this={bodyPlate}
					class="pointer-events-none absolute inset-x-0 top-[39px] bottom-0 origin-top rounded-3xl shadow-[0_12px_30px_rgb(0_0_0/0.55)]"
					aria-hidden="true"
				></div>

				<!-- Header tab: 40px tall, 18px top corners, 12px inverse joins into the
				     card. The joins come after the tab so they paint over its shadow;
				     the card paints over the rest of it. -->
				<div class="flex justify-center">
					<div bind:this={tabGroup} class="relative isolate origin-bottom">
						<div class="h-10 rounded-t-[18px] bg-base-200 px-4 pt-1.5 shadow-[0_12px_30px_rgb(0_0_0/0.55)]">
							<!-- Every title is laid out, invisibly, so the tab is as wide as
							     the longest one and never changes width between states -->
							<div class="grid">
								{#each Object.values(TITLES) as t}
									<span class="invisible flex items-center gap-2 text-sm font-semibold whitespace-nowrap [grid-area:1/1]" aria-hidden="true">
										<span class="size-7"></span>{t}
									</span>
								{/each}
								{#key phase}
									<span class="qr-fade flex h-7 items-center gap-2 justify-self-center text-sm font-semibold whitespace-nowrap [grid-area:1/1]">
										<span
											class="grid size-7 shrink-0 place-items-center rounded-full {phase === 'error' ? 'bg-error text-error-content' : 'bg-primary text-accent'}"
											aria-hidden="true"
										>
											{#if phase === 'confirm'}
												<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 16.5 C 12 14, 12 10, 15.5 7.5" /></svg>
											{:else if phase === 'saving'}
												<svg class="qr-spin size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="8" stroke-opacity="0.3" /><path d="M12 4 a8 8 0 0 1 8 8" /></svg>
											{:else if phase === 'success'}
												<svg class="size-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path class="qr-draw" d="M5 13l4 4L19 7" /></svg>
											{:else if phase === 'queued'}
												<svg class="qr-pop size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
											{:else}
												<svg class="qr-pop size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 7v6" /><circle cx="12" cy="17.5" r="0.6" fill="currentColor" /></svg>
											{/if}
										</span>
										<span id={titleId} class={phase === 'error' ? 'text-error' : 'text-accent'}>{TITLES[phase]}</span>
									</span>
								{/key}
							</div>
						</div>
						<span class="qr-join qr-join-l" aria-hidden="true"></span>
						<span class="qr-join qr-join-r" aria-hidden="true"></span>
					</div>
				</div>

				<div bind:this={bodyEl} class="relative -mt-px origin-top rounded-3xl bg-base-200 px-4 pt-4 pb-5">
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-wrap gap-1">
							{#each clients as cliente}
								<span class="badge badge-primary badge-sm">{cliente.nombre}</span>
							{/each}
						</div>
						<span class="text-xs whitespace-nowrap text-base-content/60">Hoy · {time}</span>
					</div>

					<!-- Route: the badges and the arc on their own row, the names below -->
					<div class="mt-5 flex items-center gap-1.5">
						{@render arrow('M7 17L17 7M9 7h8v8')}
						<span class="relative h-7 flex-1" bind:clientWidth={arcW}>
							{#if arcW}
								<svg class="absolute -top-3.5 left-0 overflow-visible" width={arcW} height="40" viewBox="0 0 {arcW} 40" aria-hidden="true">
									<path class="qr-march text-accent/60" d={arcPath} fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="5 5" />
									{#each stopPoints as p}
										<circle class="fill-accent stroke-base-200" cx={p.x} cy={p.y} r="5" stroke-width="6" paint-order="stroke" />
									{/each}
									{#if phase === 'success' && !reduced}
										<circle bind:this={travelDot} class="fill-accent stroke-base-200" r="5" stroke-width="6" paint-order="stroke" style="transform: translate({P0.x}px, {P0.y}px)" />
									{/if}
								</svg>
							{/if}
							{#if stops.length}
								<span class="absolute top-2.5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-base-content/60">vía {stops.join(', ')}</span>
							{/if}
						</span>
						{@render arrow('M7 7l10 10M17 9v8H9')}
					</div>
					<div class="mt-1.5 flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-xs text-base-content/60">Desde</p>
							<p class="text-[21px] leading-[1.15] font-bold">{route.origen}</p>
						</div>
						<div class="min-w-0 text-right">
							<p class="text-xs text-base-content/60">Hasta</p>
							<p class="text-[21px] leading-[1.15] font-bold">{route.destino}</p>
						</div>
					</div>

					<!-- The tail folds away and unfolds as a unit. flex-col so the ghost
					     button's -mb-3 counts in its height (no margin collapsing):
					     a 44px target that sits on the card's 20px bottom inset. -->
					{#if tail !== 'none'}
						<div bind:this={tailEl} class="flex flex-col">
							{#if tail === 'queued' || tail === 'error'}
								<p class="pt-3 text-center text-sm text-base-content/60">{NOTES[tail]}</p>
							{/if}
							{#if tail === 'confirm' || tail === 'error'}
								<button
									bind:this={registerBtn}
									class="btn btn-accent mt-5 h-11 w-full"
									onclick={register}
								>
									{tail === 'error' ? 'Reintentar' : 'Registrar carrera'}
								</button>
								<button class="btn btn-ghost mt-1 -mb-3 h-11 w-full text-base-content/80" onclick={close}>Cancelar</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

<style>
	/* Inverse-radius joins: a 12px square beside each bottom corner of the tab,
	   with a 12px quarter circle cut out, so the tab flares into the card */
	.qr-join {
		position: absolute;
		bottom: 0;
		width: 12px;
		height: 12px;
	}
	.qr-join-l {
		right: 100%;
		background: radial-gradient(circle at 0 0, transparent 11.5px, var(--color-base-200) 12px);
	}
	.qr-join-r {
		left: 100%;
		background: radial-gradient(circle at 100% 0, transparent 11.5px, var(--color-base-200) 12px);
	}

	/* The dashes flow from Desde to Hasta: one 10px dash cycle a second */
	.qr-march {
		animation: qr-march 1s linear infinite;
	}
	@keyframes qr-march {
		from { stroke-dashoffset: 10; }
		to { stroke-dashoffset: 0; }
	}

	.qr-spin {
		animation: qr-spin 0.8s linear infinite;
	}
	@keyframes qr-spin {
		to { transform: rotate(360deg); }
	}

	/* The ✓ draws itself (its path is about 19.8 units long) */
	.qr-draw {
		stroke-dasharray: 22;
		animation: qr-draw 250ms ease-out both;
	}
	@keyframes qr-draw {
		from { stroke-dashoffset: 22; }
		to { stroke-dashoffset: 0; }
	}

	.qr-pop {
		animation: qr-pop 200ms ease-out both;
	}
	@keyframes qr-pop {
		from { opacity: 0; transform: scale(0.6); }
	}

	.qr-fade {
		animation: qr-fade 150ms ease-out both;
	}
	@keyframes qr-fade {
		from { opacity: 0; }
	}

	/* Static dashes, a ✓ that just appears, no pops. The ring keeps turning:
	   it's the only sign that something is happening. */
	@media (prefers-reduced-motion: reduce) {
		.qr-march,
		.qr-draw,
		.qr-pop,
		.qr-fade {
			animation: none;
		}
	}

	/* Lock the page behind it, as DaisyUI does for its modals */
	:global(:root:has([data-overlay])) {
		overflow: hidden;
		scrollbar-gutter: stable;
	}
</style>

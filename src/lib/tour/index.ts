// The guided tour's trigger: everything that runs before a tour starts. The
// tour itself (driver.js, its CSS and the steps) is in ./tour, loaded with a
// dynamic import only when a tour actually starts.
//
// Nothing is stored server-side. Inicio starts a tour when it arrives with
// ?tour=1 and drops the parameter from the address straight away, so a reload
// never brings it back. Two things link there: the demo's first person pick
// on a device (offerFirstTour), and the drawer's Recorrido row (TOUR_HREF).

import { demoMode } from '$lib/demo';

export const TOUR_PARAM = 'tour';
export const TOUR_HREF = `/?${TOUR_PARAM}=1`;

/** Dispatched on window by QuickRideModal once it has closed. The tour's
 *  hands-on step waits for it to come back. */
export const QUICK_RIDE_CLOSED = 'tab:quick-ride-closed';

// Set on the demo's first pick, so later picks (Cambiar) don't offer it again
const OFFERED_KEY = 'tab_tour_offered';

/** The demo only: true on the first person pick on this device. */
export function offerFirstTour(): boolean {
	if (!demoMode()) return false;
	try {
		if (localStorage.getItem(OFFERED_KEY)) return false;
		localStorage.setItem(OFFERED_KEY, '1');
		return true;
	} catch {
		// Storage blocked: no tour, rather than one on every pick
		return false;
	}
}

const LG = '(min-width: 1024px)';

/** Something the tour must not start over: a modal or sheet, the phone
 *  drawer (open, or still sliding shut), or the language list. From lg the
 *  drawer is an always-open sidebar, which doesn't count. In the demo, the
 *  banner has to be on screen first. */
function blocked(): boolean {
	if (document.querySelector('.modal.modal-open, [data-overlay], dialog[open]')) return true;
	if (document.querySelector('[aria-controls="lang-list"][aria-expanded="true"]')) return true;
	if (!matchMedia(LG).matches) {
		const toggle = document.getElementById('main-drawer') as HTMLInputElement | null;
		const side = document.querySelector('.drawer-side');
		if (toggle?.checked || (side && getComputedStyle(side).visibility !== 'hidden')) return true;
	}
	return demoMode() && !document.querySelector('[data-demo-banner]');
}

const frame = () => new Promise((r) => requestAnimationFrame(r));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolves once nothing blocks the tour for two frames in a row. */
async function whenClear(signal: AbortSignal) {
	while (!signal.aborted) {
		if (!blocked()) {
			await frame();
			await frame();
			if (!blocked()) return;
		}
		await sleep(100);
	}
}

let queued = false;

/**
 * Starts the tour once the page is clear. Called by Inicio on ?tour=1; the
 * signal is Inicio's, so leaving the page drops a waiting tour and ends a
 * running one. A second call while one is waiting or running is ignored.
 */
export async function queueTour(signal: AbortSignal) {
	if (queued || signal.aborted) return;
	queued = true;
	let started = false;
	try {
		await document.fonts?.ready;
		await whenClear(signal);
		if (signal.aborted) return;
		const { startTour } = await import('./tour');
		// The import takes a moment; something may have opened meanwhile
		await whenClear(signal);
		if (signal.aborted) return;
		const stop = startTour({ demo: demoMode(), onEnd: () => (queued = false) });
		started = true;
		signal.addEventListener('abort', stop, { once: true });
	} finally {
		if (!started) queued = false;
	}
}

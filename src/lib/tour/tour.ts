// The guided tour on Inicio: a welcome card, five steps, a done card. Only
// ever loaded through queueTour (./index), so driver.js and both stylesheets
// stay out of the normal bundle.

import { driver, type DriveStep, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { m } from '$lib/paraglide/messages.js';
import { QUICK_RIDE_CLOSED } from './index';

// Step indexes: 0 is the welcome card, 1 to 5 the steps, 6 the done card
const QUICK = 1; // the hands-on step
const FIRST_BACK = 2; // Atrás shows on steps 2 to 5
const LAST_STEP = 5;
const DONE = 6;

/** How long the hands-on step waits for the quick-ride card to show up
 *  after a chip is tapped, before moving on anyway. */
const MODAL_OPEN_FALLBACK_MS = 1500;

const STAGE_PADDING = 6;
const STAGE_RADIUS = 16; // the app's box radius

// driver.js writes titles, text and button labels as HTML
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Laid out, visible and at least partly on screen horizontally. A link in
 *  the closed phone drawer is hidden and off to the left, so it fails. */
function shown(el: Element) {
	const r = el.getBoundingClientRect();
	if (r.width === 0 || r.height === 0 || r.right <= 0 || r.left >= window.innerWidth) return false;
	return getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert]');
}

/** The first element on screen for any of the selectors, in order. With
 *  none, driver.js shows the step as a centred card. */
const anchor = (...selectors: string[]) => () => {
	for (const s of selectors) {
		for (const el of document.querySelectorAll(s)) if (shown(el)) return el;
	}
	return undefined as unknown as Element;
};

/** The highlight's lime ring: a stroke that follows the hole driver.js cuts
 *  in its overlay, through every move, scroll and resize. */
function holeOf(d: string | null) {
	return d ? d.slice(d.indexOf('Z') + 1).trim() : '';
}

export function startTour({ demo, onEnd }: { demo: boolean; onEnd: () => void }): () => void {
	// Touch-first screens get "Toca" / "Tap", the rest "Haz clic" / "Click":
	// the primary input, as the CSS media features report it
	const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
	const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const wide = matchMedia('(min-width: 1024px)').matches;
	const returnFocus = document.activeElement;

	let ended = false;
	let disarm = () => {};
	let unwait = () => {};
	let ring: SVGPathElement | null = null;
	let ringOn = false;
	let ringWatch: MutationObserver | null = null;

	const text = (title: string, body: string) => ({ title: esc(title), description: esc(body) });
	const step = (n: number) => ({
		showProgress: true,
		progressText: esc(m.tour_progress({ n })),
		nextBtnText: esc(m.tour_next()),
		prevBtnText: esc(m.tour_back())
	});

	const steps: DriveStep[] = [
		{
			popover: {
				...text(m.tour_welcome_title(), m.tour_welcome_body()),
				showButtons: ['next', 'close'],
				showProgress: false,
				nextBtnText: esc(m.tour_start())
			}
		},
		{
			element: anchor('[data-tour="quick-routes"]'),
			popover: {
				...text(m.tour_quick_title(), touch ? m.tour_quick_body_touch() : m.tour_quick_body_mouse()),
				...step(1),
				showButtons: ['next', 'close'],
				side: 'bottom',
				align: 'center'
			}
		},
		{
			element: anchor('[data-tour="summary"]'),
			popover: {
				...text(m.tour_summary_title(), m.tour_summary_body()),
				...step(2),
				side: 'bottom',
				align: 'center'
			}
		},
		{
			element: anchor('[data-tour="ride"]'),
			popover: {
				...text(m.tour_ride_title(), touch ? m.tour_ride_body_touch() : m.tour_ride_body_mouse()),
				...step(3),
				side: 'bottom',
				align: 'center'
			}
		},
		{
			element: anchor('[data-tour="add"]'),
			popover: {
				...text(m.tour_add_title(), touch ? m.tour_add_body_touch() : m.tour_add_body_mouse()),
				...step(4),
				side: 'top',
				align: 'end'
			}
		},
		{
			// Historial in the sidebar from lg; below it, the ☰ that opens it
			element: anchor('[data-tour="history"]', '[data-tour="menu"]'),
			popover: {
				...text(m.tour_history_title(), m.tour_history_body()),
				...step(5),
				side: wide ? 'right' : 'bottom',
				align: 'start'
			}
		},
		{
			popover: {
				...text(m.tour_done_title(), demo ? `${m.tour_done_body()} ${m.tour_done_demo()}` : m.tour_done_body()),
				showButtons: ['next', 'close'],
				showProgress: false,
				nextBtnText: esc(m.tour_done())
			}
		}
	];

	/** The hole (and its ring) follows the element's own corners, 6px out: a
	 *  circle round the + and the ☰, at least the 16px radius elsewhere. */
	function fitHole(el: Element | undefined) {
		const own = el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 0;
		const radius = Math.max(STAGE_RADIUS, own + STAGE_PADDING);
		if (tour.getConfig().stageRadius !== radius) tour.setConfig({ ...tour.getConfig(), stageRadius: radius });
	}

	function setRing(on: boolean) {
		ringOn = on;
		if (ring) ring.style.display = on ? '' : 'none';
	}

	function ensureRing() {
		const svg = tour.getState('__overlaySvg') as SVGSVGElement | undefined;
		const stage = svg?.firstElementChild;
		if (!svg || !stage || svg.contains(ring)) return;
		ringWatch?.disconnect();
		ring = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		ring.classList.add('tab-tour-ring');
		svg.append(ring);
		const copy = () => ring?.setAttribute('d', holeOf(stage.getAttribute('d')));
		copy();
		ringWatch = new MutationObserver(copy);
		ringWatch.observe(stage, { attributes: true, attributeFilter: ['d'] });
		setRing(ringOn);
	}

	/** driver.js moves its marker class from the step it thinks is current, and
	 *  only settles that at the end of the 400ms move. Siguiente tapped before
	 *  then leaves the class on an element two steps back; drop any such. */
	function dropStale(current: Element | undefined) {
		for (const old of document.querySelectorAll('.driver-active-element')) {
			if (old === current) continue;
			old.classList.remove('driver-active-element', 'driver-no-interaction');
			for (const a of ['aria-haspopup', 'aria-expanded', 'aria-controls']) old.removeAttribute(a);
		}
	}

	/** Step 1: a tap on a chip opens the quick-ride card. The tour steps aside
	 *  once the tap has been handled, and comes back at step 2 when the card
	 *  closes. */
	function armHandsOn(row: Element) {
		disarm();
		const onClick = (e: Event) => {
			if (!(e.target as Element).closest('button')) return;
			disarm();
			// After the app's own click handler (Svelte's, delegated to the root)
			setTimeout(pauseForModal, 0);
		};
		row.addEventListener('click', onClick);
		disarm = () => {
			row.removeEventListener('click', onClick);
			disarm = () => {};
		};
	}

	function pauseForModal() {
		if (ended || !tour.isActive()) return;
		// The card has focused its own button; destroying the tour would move
		// focus back to where the step started. destroy() itself, not leave():
		// the tour is set aside, not ended.
		const focused = document.activeElement;
		tour.destroy();
		if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });

		const resume = () => {
			unwait();
			if (!ended) tour.drive(QUICK + 1);
		};
		const timer = setTimeout(() => {
			if (!document.querySelector('[data-overlay]')) resume();
		}, MODAL_OPEN_FALLBACK_MS);
		window.addEventListener(QUICK_RIDE_CLOSED, resume);
		unwait = () => {
			clearTimeout(timer);
			window.removeEventListener(QUICK_RIDE_CLOSED, resume);
			unwait = () => {};
		};
	}

	/** The app's buttons in driver.js's popover, plus Omitir, and the ✕ kept
	 *  for screen readers only. */
	function restyle(p: PopoverDOM, index: number) {
		for (const b of [p.previousButton, p.nextButton]) {
			b.classList.remove('driver-popover-footer-btn');
			b.classList.add('btn', 'h-11', 'min-h-11', 'px-4');
			// driver.js shows its buttons with display: block; a .btn is inline-flex
			if (b.style.display === 'block') b.style.display = '';
		}
		p.nextButton.classList.add('btn-accent');
		p.previousButton.classList.add('btn-ghost');

		if (index !== DONE) {
			const skip = document.createElement('button');
			skip.type = 'button';
			skip.className = 'btn btn-ghost h-11 min-h-11 px-4 text-base-content/80';
			skip.textContent = m.tour_skip();
			skip.addEventListener('click', leave);
			p.footerButtons.prepend(skip);
		}

		// Last in the tab order, after the footer
		p.closeButton.setAttribute('aria-label', m.tour_close());
		p.wrapper.append(p.closeButton);

		// driver.js focuses the first button right after this; the forward
		// button is the one to start on
		queueMicrotask(() => p.nextButton.focus({ preventScroll: true }));
	}

	/** Every way out: Omitir, Listo, Escape, the ✕, and leaving Inicio. Not
	 *  driver.js's onDestroyed, which it skips when the tour closes before its
	 *  first move has finished. */
	function leave() {
		if (tour.isActive()) tour.destroy();
		finish();
	}

	function finish() {
		if (ended) return;
		ended = true;
		disarm();
		unwait();
		ringWatch?.disconnect();
		onEnd();
		if (returnFocus instanceof HTMLElement && returnFocus.isConnected && shown(returnFocus)) {
			returnFocus.focus({ preventScroll: true });
		}
	}

	const tour = driver({
		steps,
		animate: !reduced,
		smoothScroll: !reduced,
		allowClose: true, // Escape and the ✕
		allowKeyboardControl: true, // arrow keys
		overlayClickBehavior: () => {}, // leaving is explicit
		overlayColor: '#000',
		overlayOpacity: 0.6,
		stagePadding: STAGE_PADDING,
		stageRadius: STAGE_RADIUS,
		popoverOffset: 10,
		popoverClass: 'tab-tour',
		onPopoverRender: (p, { state }) => restyle(p, state.activeIndex ?? 0),
		// The buttons and the arrow keys: no going back from step 1 or the
		// done card, and the done card's forward button ends the tour
		onNextClick: () => (tour.getActiveIndex() === DONE ? leave() : tour.moveNext()),
		onPrevClick: () => {
			const i = tour.getActiveIndex() ?? 0;
			if (i >= FIRST_BACK && i <= LAST_STEP) tour.movePrevious();
		},
		// Everything is set up as a step starts, not when driver.js's move ends:
		// with animation on, the popover is up and tappable halfway through it
		onHighlightStarted: (el, _step, { state }) => {
			dropStale(el);
			fitHole(el);
			setRing(!!el);
			// The overlay is drawn on the next frame, the first time round
			requestAnimationFrame(() => requestAnimationFrame(ensureRing));
			if (state.activeIndex === QUICK && el) armHandsOn(el);
		},
		onHighlighted: () => ensureRing(),
		onDeselected: () => disarm(),
		// Escape and the ✕. Stepping aside for the quick-ride card calls
		// destroy() directly, which skips this, so it's never reported as ended.
		onDestroyStarted: () => leave()
	});

	tour.drive(0);

	return () => {
		if (!ended) leave();
	};
}

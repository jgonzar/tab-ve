// The guided tour on Inicio: a full-screen welcome, five steps, a done
// card. Only ever loaded through queueTour (./index), so driver.js, the
// welcome screen and every stylesheet stay out of the normal bundle.

import { mount, unmount } from 'svelte';
import { driver, type DriveStep, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { m } from '$lib/paraglide/messages.js';
import { QUICK_RIDE_CLOSED } from './index';
import { CHECK, STEP_ICONS, iconSvg } from './icons';
import Welcome from './Welcome.svelte';

// driver.js's step indexes: 0 to 4 are steps 1 to 5, 5 the done card. The
// welcome is a screen of its own, before driver.js starts.
const QUICK = 0; // the hands-on step 1
const FIRST_BACK = 1; // Atrás shows on steps 2 to 5
const LAST_STEP = 4;
const DONE = 5;
const STEPS = 5;

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

/** The hole driver.js cuts in its overlay: the part of its path after the
 *  outer rectangle */
function holeOf(d: string) {
	return d.slice(d.indexOf('Z') + 1).trim();
}

const make = (tag: string, className: string) => Object.assign(document.createElement(tag), { className });

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
	let marks: SVGSVGElement | null = null; // the overlay the ring was drawn in
	let ringOn = false;
	let handsOn = false;
	let ringWatch: MutationObserver | null = null;
	let closeWelcome: (fade: boolean) => Promise<void> = async () => {};
	let begun = false;

	const text = (title: string, body: string) => ({ title: esc(title), description: esc(body) });
	const step = () => ({ nextBtnText: esc(m.tour_next()), prevBtnText: esc(m.tour_back()) });

	const steps: DriveStep[] = [
		{
			element: anchor('[data-tour="quick-routes"]'),
			popover: {
				...text(m.tour_quick_title(), touch ? m.tour_quick_body_touch() : m.tour_quick_body_mouse()),
				...step(),
				showButtons: ['next', 'close'],
				side: 'bottom',
				align: 'center'
			}
		},
		{
			element: anchor('[data-tour="summary"]'),
			popover: {
				...text(m.tour_summary_title(), m.tour_summary_body()),
				...step(),
				side: 'bottom',
				align: 'center'
			}
		},
		{
			element: anchor('[data-tour="ride"]'),
			popover: {
				...text(m.tour_ride_title(), touch ? m.tour_ride_body_touch() : m.tour_ride_body_mouse()),
				...step(),
				side: 'bottom',
				align: 'center'
			}
		},
		{
			element: anchor('[data-tour="add"]'),
			popover: {
				...text(m.tour_add_title(), touch ? m.tour_add_body_touch() : m.tour_add_body_mouse()),
				...step(),
				side: 'top',
				align: 'end'
			}
		},
		{
			// Historial in the sidebar from lg; below it, the ☰ that opens it
			element: anchor('[data-tour="history"]', '[data-tour="menu"]'),
			popover: {
				...text(m.tour_history_title(), m.tour_history_body()),
				...step(),
				side: wide ? 'right' : 'bottom',
				align: 'start'
			}
		},
		{
			popover: {
				...text(m.tour_done_title(), demo ? `${m.tour_done_body()} ${m.tour_done_demo()}` : m.tour_done_body()),
				showButtons: ['next', 'close'],
				nextBtnText: esc(m.tour_done()),
				popoverClass: 'tab-tour tab-tour-done'
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

	function setRing(on: boolean, quick: boolean) {
		ringOn = on;
		handsOn = quick;
		marks?.classList.toggle('tab-tour-has-ring', on);
		marks?.classList.toggle('tab-tour-hands-on', on && quick);
	}

	/**
	 * Drawn inside driver.js's overlay, so it follows the hole through every
	 * move, scroll and change of size: the lime ring on its edge and, for step 1, a
	 * halo that breathes outwards (clipped to outside the hole, so it never
	 * covers the chips) and a beacon on the top right corner.
	 */
	function ensureRing() {
		const svg = tour.getState('__overlaySvg') as SVGSVGElement | undefined;
		const stage = svg?.firstElementChild;
		if (!svg || !stage || marks === svg) return;
		ringWatch?.disconnect();
		svg.insertAdjacentHTML(
			'beforeend',
			'<defs><clipPath id="tab-tour-outside"><path clip-rule="evenodd"/></clipPath></defs>' +
				'<path class="tab-tour-breath" clip-path="url(#tab-tour-outside)"/>' +
				'<path class="tab-tour-ring"/>' +
				'<g class="tab-tour-beacon"><circle class="tab-tour-beacon-halo" r="7"/><circle r="7"/></g>'
		);
		const outside = svg.querySelector('#tab-tour-outside path')!;
		const ring = svg.querySelector<SVGPathElement>('.tab-tour-ring')!;
		const breath = svg.querySelector('.tab-tour-breath')!;
		const beacon = svg.querySelector('.tab-tour-beacon')!;
		const copy = () => {
			const d = stage.getAttribute('d') ?? '';
			outside.setAttribute('d', d);
			ring.setAttribute('d', holeOf(d));
			breath.setAttribute('d', holeOf(d));
			try {
				const box = ring.getBBox();
				beacon.setAttribute('transform', `translate(${box.x + box.width} ${box.y})`);
			} catch {
				// Not laid out yet (hidden): placed on the next change
			}
		};
		marks = svg;
		setRing(ringOn, handsOn);
		copy();
		ringWatch = new MutationObserver(copy);
		ringWatch.observe(stage, { attributes: true, attributeFilter: ['d'] });
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
		marks = null;

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

	/** Steps 1 to 5: the five-part bar, filled up to this step, then the
	 *  step's icon in a tile beside "n de 5" and the title */
	function stepHeader(p: PopoverDOM, index: number) {
		const bar = make('div', 'tab-tour-bar');
		bar.setAttribute('aria-hidden', 'true');
		for (let i = 0; i < STEPS; i++) {
			const segment = make('span', i < index ? 'tab-tour-past' : i === index ? 'tab-tour-now' : '');
			segment.append(make('span', ''));
			bar.append(segment);
		}
		const head = make('div', 'tab-tour-head');
		const tile = make('span', 'tab-tour-tile');
		tile.innerHTML = iconSvg(STEP_ICONS[index], 18);
		const words = make('div', '');
		const count = make('p', 'tab-tour-count');
		count.textContent = m.tour_progress({ n: index + 1 });
		words.append(count, p.title);
		head.append(tile, words);
		p.wrapper.insertBefore(bar, p.description);
		p.wrapper.insertBefore(head, p.description);
	}

	/** The done card: the five step icons, which light up lime one after
	 *  another and turn into checks */
	function doneHeader(p: PopoverDOM) {
		const row = make('div', 'tab-tour-checks');
		row.setAttribute('aria-hidden', 'true');
		STEP_ICONS.forEach((d, i) => {
			const tile = make('span', '');
			tile.style.setProperty('--lit-at', `${300 + i * 180}ms`);
			const icon = make('span', 'tab-tour-step-icon');
			icon.innerHTML = iconSvg(d, 17);
			const tick = make('span', 'tab-tour-tick');
			tick.innerHTML = iconSvg(CHECK, 18, 3);
			tile.append(icon, tick);
			row.append(tile);
		});
		p.wrapper.insertBefore(row, p.title);
	}

	/** The app's buttons in driver.js's popover, plus Omitir, and the ✕ kept
	 *  for screen readers only. */
	function restyle(p: PopoverDOM, index: number) {
		if (index === DONE) doneHeader(p);
		else stepHeader(p, index);

		for (const b of [p.previousButton, p.nextButton]) {
			b.classList.remove('driver-popover-footer-btn');
			b.classList.add('btn', 'min-h-11');
			// driver.js shows its buttons with display: block; a .btn is inline-flex
			if (b.style.display === 'block') b.style.display = '';
		}
		p.nextButton.classList.add('btn-accent');
		p.previousButton.classList.add('btn-ghost');

		if (index !== DONE) {
			const skip = document.createElement('button');
			skip.type = 'button';
			skip.className = 'btn btn-ghost min-h-11 text-base-content/80';
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
		closeWelcome(false);
		finish();
	}

	/**
	 * The welcome screen, over the whole app: the app is inert (out of reach
	 * of focus and screen readers) and doesn't scroll until it closes.
	 * Empezar fades it out and starts the steps; Omitir and Escape leave.
	 */
	function openWelcome() {
		const host = make('div', '');
		const inerted = [...document.body.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.inert);
		for (const c of inerted) c.inert = true;
		const root = document.documentElement;
		const overflow = root.style.overflow;
		root.style.overflow = 'hidden';
		document.body.append(host);
		const screen = mount(Welcome, {
			target: host,
			props: {
				// Once: a tap and an arrow key, or two quick taps, start it once
				onStart: () => {
					if (begun) return;
					begun = true;
					closeWelcome(true).then(() => ended || tour.drive(0));
				},
				onSkip: leave
			}
		});
		closeWelcome = async (fade) => {
			closeWelcome = async () => {};
			for (const c of inerted) c.inert = false;
			root.style.overflow = overflow;
			const shown = host.firstElementChild;
			if (fade && !reduced && shown) {
				await shown
					.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' })
					.finished.catch(() => {});
			}
			unmount(screen);
			host.remove();
		};
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
		onHighlightStarted: (target, _step, { state }) => {
			dropStale(target);
			fitHole(target);
			setRing(!!target, state.activeIndex === QUICK);
			// The overlay is drawn on the next frame, the first time round
			requestAnimationFrame(() => requestAnimationFrame(ensureRing));
			if (state.activeIndex === QUICK && target) armHandsOn(target);
		},
		onHighlighted: () => ensureRing(),
		onDeselected: () => disarm(),
		// Escape and the ✕. Stepping aside for the quick-ride card calls
		// destroy() directly, which skips this, so it's never reported as ended.
		onDestroyStarted: () => leave()
	});

	openWelcome();

	return () => {
		if (!ended) leave();
	};
}

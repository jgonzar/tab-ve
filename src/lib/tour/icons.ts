// The five steps' icons, shared by the welcome list, the step cards and the
// done card, so each step looks the same wherever it appears. 24px grid,
// stroked in currentColor.

export const STEP_ICONS = [
	'M13 2L3 14h7l-1 8 10-12h-7z', // 1, quick routes: a bolt
	'M4 19h16M7 16V9M12 16V5M17 16v-4', // 2, what's owed: bars
	'M5 4h14v16H5zM8 9h8M8 13h5', // 3, each ride: a card
	'M12 5v14M5 12h14', // 4, any other ride: the +
	'M12 7v5l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' // 5, history: a clock
];

export const CHECK = 'M5 13l4 4L19 7';

/** An inline icon, for markup built outside Svelte (driver.js's popover) */
export function iconSvg(d: string, size: number, strokeWidth = 2) {
	return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

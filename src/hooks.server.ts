import type { Handle } from '@sveltejs/kit';

// SvelteKit preloads only JS and CSS by default. Adding fonts emits a
// <link rel="preload" as="font"> for each Poppins file app.css pulls in, so
// the text doesn't paint in the fallback stack first and then swap.
//
// woff2 only: each @font-face also lists a .woff fallback that no supported
// browser picks, and a preload is fetched whether or not it's ever used.
export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		preload: ({ type, path }) =>
			type === 'js' || type === 'css' || (type === 'font' && path.endsWith('.woff2'))
	});

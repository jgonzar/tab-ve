import { json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { isDemo } from '$lib/server/flags';
import { hasValidSession } from '$lib/server/auth';
import { SESSION_COOKIE } from '$lib/server/session';
import { GATE_PATH, gateHref } from '$lib/gate';
import { resolveLanguage, withLanguage } from '$lib/server/language';
import { m } from '$lib/paraglide/messages.js';
import { DEMO_ATTRIBUTE, registerServerDemoCheck } from '$lib/demo';
import { blockedResponse, demo, RESET_PATH, resetResponse } from '$lib/server/demo';

// Shared code (components, stores) asks lib/demo.ts; on the server it answers with this.
registerServerDemoCheck(isDemo);

// Reachable without a session: the gate itself (its page, its form POST and
// its __data.json, which SvelteKit reports under the page's path), plus the
// static and PWA assets. On Vercel the CDN serves static/ before this hook
// runs; the list keeps the preview server and any fallthrough consistent.
const PUBLIC_PATHS = new Set([GATE_PATH, '/manifest.webmanifest', '/og.png', '/favicon.ico']);
const PUBLIC_PREFIXES = ['/_app/', '/icons/'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApi(pathname: string): boolean {
	return pathname === '/api' || pathname.startsWith('/api/');
}

// The demo deployment only: its abuse limits, the lazy reset and Reiniciar
// (lib/server/demo), and data-demo="on" on <html> for the client
// (lib/demo.ts). With DEMO_MODE off this hands the request straight on,
// untouched.
const demoMode: Handle = async ({ event, resolve }) => {
	if (!isDemo()) return resolve(event);

	const block = await demo.guard({
		method: event.request.method,
		pathname: event.url.pathname,
		ip: event.getClientAddress()
	});
	if (block) return blockedResponse(block);

	if (event.url.pathname === RESET_PATH && event.request.method === 'POST') {
		return resetResponse(event);
	}

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('<html ', `<html ${DEMO_ATTRIBUTE}="on" `)
	});
};

// The household PIN gate. Skipped entirely on the demo deployment.
const gate: Handle = ({ event, resolve }) => {
	if (isDemo() || isPublic(event.url.pathname) || hasValidSession(event.cookies)) {
		return resolve(event);
	}

	// A cookie that doesn't validate was tampered with, has aged out, or was
	// signed with a secret that has since been rotated. Clear it, and tell the
	// gate so it can say the session expired.
	const hadCookie = event.cookies.get(SESSION_COOKIE) !== undefined;
	if (hadCookie) event.cookies.delete(SESSION_COOKIE, { path: '/' });

	if (isApi(event.url.pathname)) {
		return json({ message: m.api_unauthorized() }, { status: 401 });
	}

	// Thrown, not returned: for a client-side navigation (__data.json) SvelteKit
	// turns this into a JSON redirect that the router follows.
	redirect(303, gateHref(event.url.pathname + event.url.search, hadCookie));
};

// Runs first, so everything after it (the gate's 401 included) renders in the
// request's language. The page shell gets it in <html lang>, which is also
// where the client reads it from.
const language: Handle = ({ event, resolve }) => {
	const lang = resolveLanguage(event);
	return withLanguage(lang, event, () =>
		resolve(event, { transformPageChunk: ({ html }) => html.replace('%lang%', lang) })
	);
};

// SvelteKit preloads only JS and CSS by default. Adding fonts emits a
// <link rel="preload" as="font"> for each Poppins file app.css pulls in, so
// the text doesn't paint in the fallback stack first and then swap.
//
// woff2 only: each @font-face also lists a .woff fallback that no supported
// browser picks, and a preload is fetched whether or not it's ever used.
const preloadFonts: Handle = ({ event, resolve }) =>
	resolve(event, {
		preload: ({ type, path }) =>
			type === 'js' || type === 'css' || (type === 'font' && path.endsWith('.woff2'))
	});

export const handle = sequence(language, demoMode, gate, preloadFonts);

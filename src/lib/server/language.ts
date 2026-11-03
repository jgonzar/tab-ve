import { AsyncLocalStorage } from 'node:async_hooks';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import {
	baseLocale,
	extractLocaleFromHeader,
	isLocale,
	overwriteServerAsyncLocalStorage,
	type Locale
} from '$lib/paraglide/runtime.js';
import { LANG_COOKIE, LANG_MAX_AGE } from '$lib/language';
import { isDemo } from './flags';

/**
 * The language for this request: a saved choice (the cookie) first. With no
 * choice, the demo follows the browser's Accept-Language and the real app
 * stays Spanish, so a household phone set to English doesn't flip the app.
 */
export function resolveLanguage(event: RequestEvent): Locale {
	const saved = event.cookies.get(LANG_COOKIE);
	if (saved && isLocale(saved)) return saved;
	if (isDemo()) return extractLocaleFromHeader(event.request) ?? baseLocale;
	return baseLocale;
}

/**
 * How the server saves the language cookie. Not httpOnly: it's a preference,
 * not a secret, and the gate's switch writes the same cookie from the page.
 */
export const LANG_COOKIE_OPTIONS: Parameters<Cookies['set']>[2] = {
	path: '/',
	maxAge: LANG_MAX_AGE,
	httpOnly: false,
	sameSite: 'lax'
};

/** The demo link's language, `?lang=en`, from the landing page's "Try the demo". */
export const LANG_PARAM = 'lang';

/**
 * The demo only: a `?lang=` naming a language is saved (the same cookie as the
 * switch), and this returns the same address without the param, for a 303.
 * Anything else returns null and changes nothing, so an unknown value is
 * ignored and the real app never reads the param. Only for GET and HEAD, so a
 * write is never redirected.
 */
export function takeLanguageParam(event: Pick<RequestEvent, 'url' | 'request' | 'cookies'>): string | null {
	if (!isDemo()) return null;
	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') return null;
	const lang = event.url.searchParams.get(LANG_PARAM);
	if (!lang || !isLocale(lang)) return null;

	event.cookies.set(LANG_COOKIE, lang, LANG_COOKIE_OPTIONS);
	const params = new URLSearchParams(event.url.search);
	params.delete(LANG_PARAM);
	const query = params.toString();
	// The request's own path, with leading slashes collapsed to one, so
	// `//host/?lang=en` can't become a redirect to another origin.
	const path = event.url.pathname.replace(/^\/+/, '/');
	return query ? `${path}?${query}` : path;
}

// Paraglide's getLocale() reads the request's language from here, so messages
// rendered anywhere during the request (pages, API errors, the gate) use it.
// Concurrent requests each get their own.
type Store = { locale?: Locale; origin?: string; messageCalls?: Set<string> };
const storage = new AsyncLocalStorage<Store>();
overwriteServerAsyncLocalStorage(storage);

export function withLanguage<T>(lang: Locale, event: RequestEvent, fn: () => T): T {
	return storage.run({ locale: lang, origin: event.url.origin, messageCalls: new Set() }, fn);
}

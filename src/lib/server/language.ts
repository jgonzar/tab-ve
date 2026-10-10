import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestEvent } from '@sveltejs/kit';
import {
	baseLocale,
	extractLocaleFromHeader,
	isLocale,
	overwriteServerAsyncLocalStorage,
	type Locale
} from '$lib/paraglide/runtime.js';
import { LANG_COOKIE } from '$lib/language';
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

// Paraglide's getLocale() reads the request's language from here, so messages
// rendered anywhere during the request (pages, API errors, the gate) use it.
// Concurrent requests each get their own.
type Store = { locale?: Locale; origin?: string; messageCalls?: Set<string> };
const storage = new AsyncLocalStorage<Store>();
overwriteServerAsyncLocalStorage(storage);

export function withLanguage<T>(lang: Locale, event: RequestEvent, fn: () => T): T {
	return storage.run({ locale: lang, origin: event.url.origin, messageCalls: new Set() }, fn);
}

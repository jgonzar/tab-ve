// The interface language: the cookie that remembers a choice, the switch, and
// the client side of how Paraglide reads the language. The server resolves the
// language per request (lib/server/language.ts) and writes it into
// <html lang>; the client only ever reads that back, so both sides agree.

import { defineCustomClientStrategy, getLocale, isLocale, type Locale } from '$lib/paraglide/runtime.js';

export const LANG_COOKIE = 'tab_lang';
export const LANG_STORAGE_KEY = 'tab_lang';
/** About 400 days, the longest a browser keeps a cookie. The same as the session cookie. */
export const LANG_MAX_AGE = 34560000;

/** Each language under its own name, so the switch reads the same in either language. */
export const LANGUAGES: { code: Locale; short: string; name: string }[] = [
	{ code: 'es', short: 'ES', name: 'Español' },
	{ code: 'en', short: 'EN', name: 'English' }
];

/** Mirrors the language into localStorage, for client code that reads it from there. */
function remember(lang: string) {
	try {
		localStorage.setItem(LANG_STORAGE_KEY, lang);
	} catch {
		// Storage can be blocked (private mode); the cookie still holds the choice
	}
}

/**
 * Registers the strategy named in the `i18n` script (`custom-tab`) on the
 * client: the language is whatever the server rendered into <html lang>.
 * Called once from hooks.client.ts, before the app hydrates.
 */
export function initClientLanguage() {
	defineCustomClientStrategy('custom-tab', {
		getLocale: () => {
			const lang = document.documentElement.lang;
			return isLocale(lang) ? lang : undefined;
		},
		setLocale: remember
	});
	remember(getLocale());
}

/**
 * Saves a new language for this device and reloads into it. The gate has no
 * session yet, so it can't call the (gated) endpoint and sets the cookie here
 * instead. Resolves false if the endpoint couldn't be reached.
 */
export async function switchLanguage(lang: Locale, from: 'gate' | 'app'): Promise<boolean> {
	if (lang === getLocale()) return true;
	if (from === 'gate') {
		const secure = location.protocol === 'https:' ? '; Secure' : '';
		document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_MAX_AGE}; SameSite=Lax${secure}`;
	} else {
		try {
			const res = await fetch('/api/language', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lang })
			});
			if (!res.ok) return false;
		} catch {
			return false;
		}
	}
	remember(lang);
	location.reload();
	return true;
}

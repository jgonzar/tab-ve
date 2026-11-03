import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isLocale } from '$lib/paraglide/runtime.js';
import { m } from '$lib/paraglide/messages.js';
import { LANG_COOKIE } from '$lib/language';
import { LANG_COOKIE_OPTIONS } from '$lib/server/language';

// Saves the interface language for this device. The client reloads after it.
// Behind the PIN gate like every API route; the gate screen sets the same
// cookie on the client instead (lib/language.ts).
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	const lang = body?.lang;
	if (typeof lang !== 'string' || !isLocale(lang)) error(400, m.api_invalid_language());

	cookies.set(LANG_COOKIE, lang, LANG_COOKIE_OPTIONS);
	return new Response(null, { status: 204 });
};

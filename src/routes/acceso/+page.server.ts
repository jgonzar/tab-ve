import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env as publicEnv } from '$env/dynamic/public';
import { isDemo } from '$lib/server/flags';
import { hasValidSession, pinHash, sessionSecret } from '$lib/server/auth';
import { verifyPin } from '$lib/server/pin-hash';
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '$lib/server/session';
import { ATTEMPT_DELAY_MS, lockoutMinutes, pinLimiter } from '$lib/server/rate-limit';
import { EXPIRED_PARAM, NEXT_PARAM, isPinFormat, safeNext } from '$lib/gate';

/** The demo link, only when PUBLIC_DEMO_URL holds an http(s) URL (F5 sets it). */
function demoUrl(): string | null {
	const raw = publicEnv.PUBLIC_DEMO_URL;
	if (!raw) return null;
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = ({ url, cookies }) => {
	// Already in (or no gate at all): go straight on.
	if (isDemo() || hasValidSession(cookies)) {
		redirect(303, safeNext(url.searchParams.get(NEXT_PARAM)));
	}
	return { demoUrl: demoUrl(), expired: url.searchParams.has(EXPIRED_PARAM) };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		await sleep(ATTEMPT_DELAY_MS);

		const ip = getClientAddress();
		const limit = pinLimiter.check(ip);
		if (limit.locked) return fail(429, { error: 'locked' as const, minutes: lockoutMinutes(limit.retryAfterMs) });

		const pin = String((await request.formData()).get('pin') ?? '');
		// A PIN in the wrong format can never match, so it isn't counted as a guess.
		if (!isPinFormat(pin)) return fail(400, { error: 'wrong' as const });

		const hash = pinHash();
		const secret = sessionSecret();
		if (!hash || !secret) return fail(503, { error: 'unavailable' as const });

		if (!(await verifyPin(pin, hash))) {
			const after = pinLimiter.fail(ip);
			return after.locked
				? fail(429, { error: 'locked' as const, minutes: lockoutMinutes(after.retryAfterMs) })
				: fail(400, { error: 'wrong' as const });
		}

		pinLimiter.reset(ip);
		cookies.set(SESSION_COOKIE, createSessionToken(secret), SESSION_COOKIE_OPTIONS);
		redirect(303, safeNext(url.searchParams.get(NEXT_PARAM)));
	}
};

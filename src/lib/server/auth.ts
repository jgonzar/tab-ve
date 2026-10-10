import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { MIN_SECRET_LENGTH, SESSION_COOKIE, verifySessionToken } from './session';

// The gate's runtime secrets, read per request (the Vercel project's env, or
// the shell in the local harness), like DATABASE_URL. A missing or weak value
// fails closed: no session validates and no PIN is accepted.

export function sessionSecret(): string | null {
	const secret = env.SESSION_SECRET;
	if (!secret || secret.length < MIN_SECRET_LENGTH) {
		console.error(`[gate] SESSION_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters`);
		return null;
	}
	return secret;
}

export function pinHash(): string | null {
	const hash = env.HOUSEHOLD_PIN_HASH;
	if (!hash) {
		console.error('[gate] HOUSEHOLD_PIN_HASH is not set');
		return null;
	}
	return hash;
}

export function hasValidSession(cookies: Cookies): boolean {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return false;
	const secret = sessionSecret();
	return secret !== null && verifySessionToken(token, secret);
}

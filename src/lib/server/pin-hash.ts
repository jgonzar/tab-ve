import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// HOUSEHOLD_PIN_HASH holds one of these, never the PIN:
//
//   scrypt:<N>:<r>:<p>:<salt>:<key>      (salt and key in base64url)
//
// Colons, not `$`: Vite's .env loader expands `$NAME`, which would corrupt a
// `$`-separated hash pasted into a local .env. No $env imports here, so
// scripts/hash-pin.ts can load this module with tsx.

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function derive(pin: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(pin, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)))
	);
}

// scrypt needs 128 * N * r bytes; Node's default cap (32 MiB) is exactly that
// at N=2^15, r=8, so give it headroom.
function options(n: number, r: number, p: number): ScryptOptions {
	return { N: n, r, p, maxmem: 256 * n * r };
}

export async function hashPin(pin: string): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const key = await derive(pin, salt, KEY_BYTES, options(N, R, P));
	return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join(':');
}

/** False for a wrong PIN and for a malformed hash; never throws on bad input. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
	const parts = stored.trim().split(':');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const [n, r, p] = parts.slice(1, 4).map(Number);
	const salt = Buffer.from(parts[4], 'base64url');
	const expected = Buffer.from(parts[5], 'base64url');
	const sane = [n, r, p].every((x) => Number.isInteger(x) && x > 0) && n <= 2 ** 20 && r <= 32 && p <= 16;
	if (!sane || salt.length === 0 || expected.length === 0) return false;
	try {
		const key = await derive(pin, salt, expected.length, options(n, r, p));
		return timingSafeEqual(key, expected);
	} catch {
		return false;
	}
}

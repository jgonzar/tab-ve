import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANG_COOKIE } from '$lib/language';
import { LANG_COOKIE_OPTIONS, takeLanguageParam } from './language';

// No server: a request is a URL, a method and a cookie jar that records writes.

vi.mock('$env/dynamic/private', () => ({ env: {} as Record<string, string | undefined> }));

function visit(path: string, method = 'GET') {
	// Appended, not resolved, so a path like //host stays a path, as it would on a real request
	const url = new URL(`https://tab-ve-demo.vercel.app${path}`);
	const set = vi.fn();
	const event = { url, request: new Request(url, { method }), cookies: { set } };
	return { location: takeLanguageParam(event as unknown as Parameters<typeof takeLanguageParam>[0]), set };
}

async function setDemo(value: string | undefined) {
	const { env } = await import('$env/dynamic/private');
	env.DEMO_MODE = value;
}

afterEach(() => setDemo(undefined));

describe('?lang= with DEMO_MODE off (the real app)', () => {
	it('is ignored entirely: no cookie, no redirect', async () => {
		for (const demo of [undefined, '', 'off', 'true', 'ON']) {
			await setDemo(demo);
			for (const path of ['/?lang=en', '/?lang=es', '/historial?lang=en', '/acceso?lang=en', '/?lang=xx']) {
				const result = visit(path);
				expect(result.location).toBeNull();
				expect(result.set).not.toHaveBeenCalled();
			}
		}
	});
});

describe('?lang= in the demo', () => {
	it('saves a known language with the switch cookie options, then drops the param', async () => {
		await setDemo('on');
		const en = visit('/?lang=en');
		expect(en.location).toBe('/');
		expect(en.set).toHaveBeenCalledOnce();
		expect(en.set).toHaveBeenCalledWith(LANG_COOKIE, 'en', LANG_COOKIE_OPTIONS);

		const es = visit('/historial?lang=es');
		expect(es.location).toBe('/historial');
		expect(es.set).toHaveBeenCalledWith(LANG_COOKIE, 'es', LANG_COOKIE_OPTIONS);
	});

	it('keeps the other params', async () => {
		await setDemo('on');
		expect(visit('/?tour=1&lang=en').location).toBe('/?tour=1');
		expect(visit('/?lang=en&lang=xx&tour=1').location).toBe('/?tour=1');
		expect(visit('/?lang=en', 'HEAD').location).toBe('/');
	});

	it('ignores values that are not a language', async () => {
		await setDemo('on');
		for (const path of ['/?lang=xx', '/?lang=', '/?lang=EN', '/?lang=en-US', '/?lang=es%0d%0a', '/?lang']) {
			const result = visit(path);
			expect(result.location).toBeNull();
			expect(result.set).not.toHaveBeenCalled();
		}
	});

	it('never redirects a write', async () => {
		await setDemo('on');
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			const result = visit('/api/viajes?lang=en', method);
			expect(result.location).toBeNull();
			expect(result.set).not.toHaveBeenCalled();
		}
	});

	it('stays on this origin, whatever the path looks like', async () => {
		await setDemo('on');
		expect(visit('//evil.example/?lang=en').location).toBe('/evil.example/');
		expect(visit('///evil.example?lang=en').location).toBe('/evil.example');
		expect(visit('/\\evil.example/?lang=en').location).toBe('/evil.example/');
		expect(visit('/%2F%2Fevil.example/?lang=en').location).toBe('/%2F%2Fevil.example/');
	});
});

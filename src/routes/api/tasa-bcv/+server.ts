import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTasaBcv } from '$lib/server/bcv';
import { m } from '$lib/paraglide/messages.js';

export const GET: RequestHandler = async () => {
	const result = await getTasaBcv();
	if (!result) error(503, m.api_rate_unavailable());
	return json(result);
};

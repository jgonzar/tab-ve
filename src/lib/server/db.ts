import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

type Db = NeonHttpDatabase<typeof schema>;

let instance: Db | undefined;

// DATABASE_URL is read at runtime (the Vercel project's env, or .env in dev),
// so it is never baked into the build. The client is created on first use.
function getDb(): Db {
	if (!instance) {
		const url = env.DATABASE_URL;
		if (!url) {
			throw new Error(
				'DATABASE_URL is not set. Add it to the Vercel project env (runtime), or to .env for local dev.'
			);
		}
		instance = drizzle(neon(url), { schema });
	}
	return instance;
}

// Same `db` as before for every caller; the first property access creates the client.
export const db = new Proxy({} as Db, {
	get(_target, prop) {
		const real = getDb();
		const value = Reflect.get(real, prop, real);
		return typeof value === 'function' ? value.bind(real) : value;
	}
});

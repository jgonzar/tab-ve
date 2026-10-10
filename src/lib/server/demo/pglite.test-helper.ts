// A fresh in-memory Postgres with the app's real schema pushed, for the demo
// tests. Never a network database.

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../schema';
import type { DemoSql } from './reset';

export async function freshDatabase() {
	const pg = new PGlite();
	const db = drizzle(pg, { schema });
	// drizzle-kit's push is chatty; it's the same diff `pnpm db:push` applies
	const log = console.log;
	console.log = () => {};
	try {
		const { apply } = await pushSchema(schema, db as never);
		await apply();
	} finally {
		console.log = log;
	}

	const sql: DemoSql = {
		query: async (text, params = []) => (await pg.query<Record<string, unknown>>(text, params)).rows,
		transaction: async (statements) => {
			await pg.transaction(async (tx) => {
				for (const s of statements) await tx.query(s.text, s.params);
			});
		}
	};

	return { pg, db, sql };
}

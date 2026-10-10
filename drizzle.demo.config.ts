import { defineConfig } from 'drizzle-kit';

// Migrations for the demo's own Neon database, and nothing else. It reads only
// DEMO_DATABASE_URL from the process environment and never loads .env, so it
// can't fall back to production's DATABASE_URL. Run it with the demo URL
// passed in from a private file outside the repo:
//
//   env $(cat ~/.config/tab/demo.env) pnpm drizzle-kit push --config drizzle.demo.config.ts
//
// Before pushing, print only the host, confirm it isn't production's, and
// confirm the database has no tables yet (docs/prd.md, "Demo").

const url = process.env.DEMO_DATABASE_URL;
if (!url) {
	throw new Error(
		'DEMO_DATABASE_URL is not set. This config never reads .env; pass the demo URL in the environment.'
	);
}

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './drizzle-demo',
	dialect: 'postgresql',
	// The reset keeps its timestamp in a `demo` schema of its own; only
	// `public` is drizzle's, so a push never sees or drops it.
	schemaFilter: ['public'],
	dbCredentials: { url }
});

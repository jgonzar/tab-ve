import { env } from '$env/dynamic/private';

// Keep this module free of database imports, so low-level modules and their
// tests can check the flag without pulling in a connection.

/** True only on the demo deployment, which sets DEMO_MODE=on. Production never sets it. */
export function isDemo(): boolean {
	return env.DEMO_MODE === 'on';
}

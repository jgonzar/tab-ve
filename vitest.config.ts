import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// The app's Vite config (SvelteKit's aliases, and the Paraglide compile the
// messages need), plus the tests. They never reach a network or a real
// database: the seed and reset run against PGlite, in memory.
export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			include: ['src/**/*.test.ts'],
			environment: 'node'
		}
	})
);

import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Pinned explicitly: adapter-vercel infers the runtime from the *build*
		// machine's Node version and only recognises 18/20/22, so it errors out
		// on Node 24 (local dev, and Vercel's current default).
		adapter: adapter({ runtime: 'nodejs22.x' })
	}
};

export default config;

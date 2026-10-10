import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';

/**
 * Compiles the messages with Paraglide's CLI, in a child process, before
 * anything imports them. Paraglide's own Vite plugin segfaults on Node 24
 * (docs/feature-playbook.md §1). Running it here covers `vite dev`,
 * `vite build` and `vercel build`, whichever command the build runs; `pnpm
 * check` calls the same `i18n` script itself. In dev, an edit to messages/
 * recompiles.
 */
function paraglideCli(): Plugin {
	const root = process.cwd();
	const command: string = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts.i18n;
	const env = { ...process.env, PATH: `${resolve(root, 'node_modules/.bin')}${delimiter}${process.env.PATH}` };

	function compile() {
		const result = spawnSync(command, { shell: true, cwd: root, env, encoding: 'utf8' });
		const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
		// The CLI exits 0 even when the message-format plugin fails to load, and
		// then every message is missing. Treat any warning as a failure.
		if (result.status !== 0 || /WARN|Error/.test(output)) {
			throw new Error(`Paraglide compile failed:\n${output}`);
		}
	}

	return {
		name: 'paraglide-cli',
		config() {
			compile();
		},
		configureServer(server) {
			const dir = resolve(root, 'messages');
			server.watcher.add(dir);
			server.watcher.on('change', (file) => {
				if (!file.startsWith(dir)) return;
				try {
					compile();
				} catch (e) {
					server.config.logger.error(String(e));
				}
			});
		}
	};
}

export default defineConfig({
	plugins: [paraglideCli(), tailwindcss(), sveltekit()]
});

// Hashes the household PIN for HOUSEHOLD_PIN_HASH. Prints only the hash, on
// stdout with no newline, so it can go straight into the Vercel env store.
//
//   umask 077 && pnpm exec tsx scripts/hash-pin.ts > ~/.tab-pin-hash
//   vercel env add HOUSEHOLD_PIN_HASH production --sensitive < ~/.tab-pin-hash
//
// Typed at a terminal, the PIN is read twice without echo (prompts go to
// stderr). Piped in, it is read from stdin, minus one trailing newline.
// Either way it never reaches a command line or the shell history.

import { hashPin } from '../src/lib/server/pin-hash.js';
import { isPinFormat, PIN_LENGTH } from '../src/lib/gate.js';

function readHidden(prompt: string): Promise<string> {
	const stdin = process.stdin;
	process.stderr.write(prompt);
	stdin.setRawMode(true);
	stdin.setEncoding('utf8');
	stdin.resume();
	return new Promise((resolve) => {
		let value = '';
		const onData = (chunk: string) => {
			for (const ch of chunk) {
				if (ch === '\r' || ch === '\n') {
					stdin.off('data', onData);
					stdin.setRawMode(false);
					stdin.pause();
					process.stderr.write('\n');
					resolve(value);
					return;
				}
				if (ch === '\u0003') {
					process.stderr.write('\n');
					process.exit(130);
				}
				if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
				else value += ch;
			}
		};
		stdin.on('data', onData);
	});
}

async function readPiped(): Promise<string> {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data.replace(/\r?\n$/, '');
}

async function main() {
	let pin: string;
	if (process.stdin.isTTY) {
		pin = await readHidden('PIN: ');
		if ((await readHidden('PIN again: ')) !== pin) {
			process.stderr.write('The two PINs differ. Nothing was printed.\n');
			process.exit(1);
		}
	} else {
		pin = await readPiped();
	}

	if (!isPinFormat(pin)) {
		process.stderr.write(`The PIN must be exactly ${PIN_LENGTH} digits. Nothing was printed.\n`);
		process.exit(1);
	}

	process.stdout.write(await hashPin(pin));
}

main();

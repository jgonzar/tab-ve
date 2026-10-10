// Messages with markup inside them ("Se marcarán <b>3</b> carreras…"). Each
// language puts the parameters wherever its grammar wants them, so the
// component can't hardcode the order. This splits the message into text and
// named slots, and the template renders each slot with its own markup.

const OPEN = '\u{E000}';
const CLOSE = '\u{E001}';
const SLOT = new RegExp(`${OPEN}([^${CLOSE}]*)${CLOSE}`, 'gu');

export type RichPart<K extends string> = { text: string; slot?: undefined } | { slot: K; text?: undefined };

export function rich<K extends string>(message: (inputs: Record<K, string>) => string, slots: K[]): RichPart<K>[] {
	const inputs = Object.fromEntries(slots.map((k) => [k, `${OPEN}${k}${CLOSE}`])) as Record<K, string>;
	const out = message(inputs);
	const parts: RichPart<K>[] = [];
	let last = 0;
	for (const match of out.matchAll(SLOT)) {
		if (match.index > last) parts.push({ text: out.slice(last, match.index) });
		parts.push({ slot: match[1] as K });
		last = match.index + match[0].length;
	}
	if (last < out.length) parts.push({ text: out.slice(last) });
	return parts;
}

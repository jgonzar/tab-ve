// Whether this is the demo deployment, readable from shared code (components
// and stores) on both sides. The server knows it from DEMO_MODE
// (lib/server/flags.ts), which shared code can't import; hooks.server.ts
// registers that check here, and on the demo it also writes
// data-demo="on" into <html>, which is what the client reads. Production
// never sets DEMO_MODE, so its page is byte for byte what it was.

import { browser } from '$app/environment';

export const DEMO_ATTRIBUTE = 'data-demo';

let serverCheck: () => boolean = () => false;

/** Called once from hooks.server.ts with isDemo(). */
export function registerServerDemoCheck(check: () => boolean) {
	serverCheck = check;
}

export function demoMode(): boolean {
	return browser ? document.documentElement.getAttribute(DEMO_ATTRIBUTE) === 'on' : serverCheck();
}

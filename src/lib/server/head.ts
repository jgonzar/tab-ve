// The head tags that differ between the real app and the demo: the title,
// the description, robots and the link-preview card. app.html holds the
// HEAD_PLACEHOLDER comment, and the head handle in hooks.server.ts swaps it
// for headTags(isDemo()) on every page.
//
// Neither deployment is meant to be found by search. The landing page
// (tab-ve-site) is Tab's public face; the real app is private and the demo is
// a shared sandbox. So both say noindex here, and in the X-Robots-Tag header.

/** An HTML comment, so a page rendered without the hook's transform shows nothing. */
export const HEAD_PLACEHOLDER = '<!-- tab.head -->';

export const ROBOTS = 'noindex, nofollow';

// Absolute on purpose: scrapers don't resolve relative URLs. Each deployment
// names its production alias, so previews advertise it too (they're noindex
// and behind Vercel Authentication anyway).
const REAL_ORIGIN = 'https://tab-ve.vercel.app';
const DEMO_ORIGIN = 'https://tab-ve-demo.vercel.app';

// The demo card's copy is English, for one card that every visitor shares.
const DEMO_TITLE = 'Tab · demo';
const DEMO_DESCRIPTION = 'Sample data, shared by every visitor. Resets every 4 hours.';

/**
 * The real app gets a plain card: "Tab", no description, the app icon
 * (static/icons/icon-512.png, the lime "b." on its violet tile). The demo gets
 * its own card, static/og-demo.png, 1200x630, from design/og-demo.svg. The
 * dimension hints let a scraper lay out the card without fetching the image.
 */
export function headTags(demo: boolean): string {
	const tags = demo
		? [
				`<title>${DEMO_TITLE}</title>`,
				`<meta name="description" content="${DEMO_DESCRIPTION}" />`,
				`<meta name="robots" content="${ROBOTS}" />`,
				`<meta property="og:type" content="website" />`,
				`<meta property="og:url" content="${DEMO_ORIGIN}/" />`,
				`<meta property="og:site_name" content="Tab" />`,
				`<meta property="og:title" content="${DEMO_TITLE}" />`,
				`<meta property="og:description" content="${DEMO_DESCRIPTION}" />`,
				`<meta property="og:image" content="${DEMO_ORIGIN}/og-demo.png" />`,
				`<meta property="og:image:width" content="1200" />`,
				`<meta property="og:image:height" content="630" />`,
				`<meta property="og:image:alt" content="${DEMO_TITLE}" />`,
				`<meta name="twitter:card" content="summary_large_image" />`
			]
		: [
				`<title>Tab</title>`,
				`<meta name="robots" content="${ROBOTS}" />`,
				`<meta property="og:type" content="website" />`,
				`<meta property="og:url" content="${REAL_ORIGIN}/" />`,
				`<meta property="og:site_name" content="Tab" />`,
				`<meta property="og:title" content="Tab" />`,
				`<meta property="og:image" content="${REAL_ORIGIN}/icons/icon-512.png" />`,
				`<meta property="og:image:width" content="512" />`,
				`<meta property="og:image:height" content="512" />`,
				`<meta property="og:image:alt" content="Tab" />`,
				`<meta name="twitter:card" content="summary" />`
			];
	return tags.join('\n\t\t');
}

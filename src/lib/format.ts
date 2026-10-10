// Every date, time and amount the app shows, keyed by language. Each language
// has its own patterns rather than a translation of one pattern: Spanish keeps
// the es-VE output the app had before English existed, byte for byte, and
// English reads the en-US way ("Sep 17, 2026", "3:45 PM", "Bs 5,919.42").

import { getLocale, type Locale } from '$lib/paraglide/runtime.js';
import { m } from '$lib/paraglide/messages.js';

const PATTERNS: Record<Locale, { intl: string; bsPrefix: string }> = {
	es: { intl: 'es-VE', bsPrefix: 'Bs. ' },
	en: { intl: 'en-US', bsPrefix: 'Bs ' }
};

const NUMBER_STYLES = {
	bs: { minimumFractionDigits: 2, maximumFractionDigits: 2 }
} satisfies Record<string, Intl.NumberFormatOptions>;

const DATE_STYLES = {
	date: { day: 'numeric', month: 'short', year: 'numeric' },
	dayMonth: { day: 'numeric', month: 'short' },
	longDate: { day: 'numeric', month: 'long', year: 'numeric' },
	time: { hour: 'numeric', minute: '2-digit' }
} satisfies Record<string, Intl.DateTimeFormatOptions>;

// USD keeps the en-US currency style in both languages ("$1,234.50")
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

function numberFormat(style: keyof typeof NUMBER_STYLES): Intl.NumberFormat {
	const intl = PATTERNS[getLocale()].intl;
	const key = `${intl}|${style}`;
	let f = numberCache.get(key);
	if (!f) numberCache.set(key, (f = new Intl.NumberFormat(intl, NUMBER_STYLES[style])));
	return f;
}

function dateFormat(style: keyof typeof DATE_STYLES): Intl.DateTimeFormat {
	const intl = PATTERNS[getLocale()].intl;
	const key = `${intl}|${style}`;
	let f = dateCache.get(key);
	if (!f) dateCache.set(key, (f = new Intl.DateTimeFormat(intl, DATE_STYLES[style])));
	return f;
}

type DateLike = Date | string;

/** "$1,234.50" */
export const formatUsd = (n: number) => usdFormat.format(n);

/** "Bs. 5.919,42" in Spanish, "Bs 5,919.42" in English */
export const formatBs = (n: number) => PATTERNS[getLocale()].bsPrefix + numberFormat('bs').format(n);

/** "17 sept. 2026" / "Sep 17, 2026": ride cards */
export const formatDate = (d: DateLike) => dateFormat('date').format(new Date(d));

/** "17 sept." / "Sep 17": receipt lines */
export const formatDayMonth = (d: DateLike) => dateFormat('dayMonth').format(new Date(d));

/** "17 de septiembre de 2026" / "September 17, 2026": the receipt heading */
export const formatLongDate = (d: DateLike) => dateFormat('longDate').format(new Date(d));

/** "3:45 p. m." / "3:45 PM" */
export const formatTime = (d: DateLike) => dateFormat('time').format(new Date(d));

/** "Hoy · 3:45 p. m." / "Today · 3:45 PM", "Ayer · …" / "Yesterday · …", else the date and time */
export function formatDayAndTime(d: DateLike, now = new Date()): string {
	const date = new Date(d);
	const time = formatTime(date);
	const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
	if (days === 0) return m.date_today_at({ time });
	if (days === 1) return m.date_yesterday_at({ time });
	return `${formatDate(date)} · ${time}`;
}

function startOfDay(d: Date): number {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

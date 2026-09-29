# Tab

## Overview
Tab is a private, Spanish-language, mobile-first web app that lets one household in Venezuela keep a running tab of rides with their trusted driver. It shows what's owed in USD and in bolívares (VES) at the official BCV rate, and lets the household settle up in batches. It installs to the home screen as a PWA.

Production: https://tab-ve.vercel.app

The product requirements, in Spanish, are in [docs/prd.md](docs/prd.md). The app was called Yummy Track until the rebrand to Tab on 2026-09-29.

## Core Features
* **Ride Tracking:** Log origin, ordered stops and destination, an optional USD price, wait time, notes and an editable ride date. New locations typed into the search become shared entries.
* **Quick Rides:** One-tap presets for the most frequent routes, with a second tap to confirm.
* **Currency Conversion:** The official BCV rate comes from `ve.dolarapi.com`, is cached server-side for 24 hours, and shows a staleness indicator when the cached rate is out of date.
* **Payment Management:** A summary bar with the pending count and total, per-ride "mark as paid", "pay all" behind a confirmation, and a History page for paid rides. A paid ride can be sent back to pending.
* **Soft Delete:** Deleted rides go to a trash tab in History and can be restored.
* **Export:** Pending rides become a plain-text receipt, shared through the system share sheet or copied to the clipboard.
* **User Access:** Passwordless user selection, stored in `localStorage` (`tab_active_user`).
* **Offline Resilience:** New rides created offline are queued in `localStorage` (`tab_pending_rides`) and synced when the connection returns, with an offline banner while disconnected.
* **Installable PWA:** Standalone display on iOS and Android, safe-area insets and a custom pull-to-refresh. There is no service worker, so launching with no signal shows the browser's error page.

## Technical Stack
* **Frontend:** SvelteKit 2 (Svelte 5 runes), Tailwind CSS v4 and DaisyUI 5 with a custom dark `tab` theme, self-hosted Poppins
* **Database:** Neon (serverless Postgres) through Drizzle ORM
* **Hosting:** Vercel (`adapter-vercel`, `nodejs22.x` runtime)
* **Toasts:** `svelte-sileo`

## Application Structure
* **Navigation:** Top bar with the "tab." wordmark and the active user's avatar; a side drawer for routing.
* **Home (Inicio):** Quick rides, a sticky summary bar (pending count, total in USD and Bs, share and pay-all actions) and the pending ride cards.
* **History (Historial):** Two tabs: paid rides and the trash.

## Development
```sh
pnpm install
cp .env.example .env   # set DATABASE_URL to a Neon connection string
pnpm db:push           # apply the Drizzle schema
pnpm db:seed           # load the 3 users and 25 starter locations
pnpm dev
```

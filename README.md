# Tab

## Overview
Tab is a private, mobile-first web app, in Spanish with English as a second language, that lets one household in Venezuela keep a running tab of rides with their trusted driver. It shows what's owed in USD and in bolívares (VES) at the official BCV rate, and lets the household settle up in batches. It installs to the home screen as a PWA.

Production: https://tab-ve.vercel.app

The product requirements, in Spanish, are in [docs/prd.md](docs/prd.md). The app was called Yummy Track until the rebrand to Tab on 2026-09-29.

## Core Features
* **Ride Tracking:** Log origin, ordered stops and destination, an optional USD price, wait time, notes and an editable ride date. New locations typed into the search become shared entries.
* **Quick Rides:** Presets for the most frequent routes. A tap opens a confirmation card with the route, and "Registrar carrera" saves it. The card then shows the result: saved or queued offline (both close on their own), or an error with "Reintentar".
* **Currency Conversion:** The official BCV rate comes from `ve.dolarapi.com`, is cached server-side for 24 hours, and shows a staleness indicator when the cached rate is out of date.
* **Payment Management:** A summary bar with the pending count and total, per-ride "mark as paid", "pay all" behind a confirmation, and a History page for paid rides. A paid ride can be sent back to pending.
* **Soft Delete:** Deleted rides go to a trash tab in History and can be restored.
* **Export:** Pending rides become a plain-text receipt, shared through the system share sheet or copied to the clipboard.
* **Household PIN:** Production is public, so every page and `/api/*` route sits behind one shared 6-digit PIN (see [Access](#access)). The demo deployment skips it.
* **User Access:** Passwordless user selection, stored in `localStorage` (`tab_active_user`).
* **Offline Resilience:** New rides created offline are queued in `localStorage` (`tab_pending_rides`) and synced when the connection returns, with an offline banner while disconnected.
* **Two languages:** Spanish by default, and English. See [Languages](#languages).
* **Installable PWA:** Standalone display on iOS and Android, safe-area insets and a custom pull-to-refresh. There is no service worker, so launching with no signal shows the browser's error page.

## Technical Stack
* **Frontend:** SvelteKit 2 (Svelte 5 runes), Tailwind CSS v4 and DaisyUI 5 with a custom dark `tab` theme, self-hosted Poppins
* **Database:** Neon (serverless Postgres) through Drizzle ORM
* **Hosting:** Vercel (`adapter-vercel`, `nodejs22.x` runtime)
* **Toasts:** `svelte-sileo`
* **Messages:** Paraglide JS, compiled with its CLI

## Application Structure
* **Navigation:** one side drawer holds everything: Inicio and Historial at the top; Recorrido, the language row and the active user's tile (with "Cambiar", back to "¿Quién eres?") pinned to the bottom. On phones and tablets a top bar with ☰ and the centred "tab." wordmark opens it; from 1024px (`lg`) it stays open as a sidebar and the top bar goes away.
* **Guided tour:** a full-screen welcome, five steps on Inicio (one hands-on: tap a quick route) and a done card, on driver.js loaded only when a tour starts (`src/lib/tour/`). Demo visitors get it once per device after their first pick on "¿Quién eres?"; anyone replays it from the drawer's Recorrido row. Both link to `/?tour=1`, which Inicio drops from the address at once, so nothing is stored and a reload doesn't bring it back. See the PRD, section 5.8.
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

`pnpm test` runs the unit tests (Vitest). The demo's seed and reset run against PGlite, an in-memory Postgres with the real schema pushed, so the tests never touch a network database.

`pnpm dev`, `pnpm build` and `pnpm check` compile the messages first (see [Languages](#languages)).

`pnpm dev` is behind the PIN gate too. Put a `HOUSEHOLD_PIN_HASH` (from `scripts/hash-pin.ts`, for a local PIN) and a `SESSION_SECRET` in `.env`, or set `DEMO_MODE=on` there to skip the gate.

## Languages
The interface is in Spanish (the base language) and English. Place names, notes and anything else typed into the app are never translated.

* **Which language:** decided on the server for each request. A saved choice (the `tab_lang` cookie) wins. Without one, **the real app always starts in Spanish**, whatever the phone's language, and **the demo follows the browser's `Accept-Language`**. The result goes into `<html lang>`, which is where the client reads it, and is mirrored into `localStorage` (`tab_lang`).
* **The switch:** the "Idioma / Language" row in the drawer, whose small list offers Español and English, plus a small ES / EN toggle on the PIN gate and on "¿Quién eres?". It saves the cookie for about 400 days and reloads. `POST /api/language` sets it (behind the PIN like every API route); the gate has no session yet, so it sets the same cookie from the page.
* **Messages** live in `messages/es.json` and `messages/en.json`, with the same keys and `{parameters}` in both. Every visible string is there, API errors included (the server answers in the request's language). Paraglide compiles them into `src/lib/paraglide/` (git-ignored) with `pnpm i18n`. Its Vite plugin segfaults on Node 24, so `vite.config.ts` runs the CLI in a child process instead, before every `vite dev` or `vite build` (and so `vercel build`), and recompiles when a message file changes in dev. `pnpm check` runs `pnpm i18n` itself. A message with markup inside it (a bold amount mid-sentence) goes through `src/lib/rich.ts`, so each language can put its parameters in its own order.
* **Dates and amounts** go through `src/lib/format.ts`, with a pattern table per language. Spanish keeps the es-VE output it always had ("17 sept. 2026", "Bs. 5.919,42", "Hoy · 3:45 p. m."); English uses en-US ("Sep 17, 2026", "Bs 5,919.42", "Today · 3:45 PM"). Dollars are en-US in both ("$1,234.50").
* **The shared receipt** follows the interface language.
* **Adding a string:** add the key to both files, then use `m.key()` from `$lib/paraglide/messages.js`. Call messages while rendering, never in a module-level constant, or the text freezes in whichever language loaded the module first.

## Access
`src/hooks.server.ts` enforces one household PIN on every page and API route. Without a valid session, pages answer 303 to `/acceso?next=<path>` and `/api/*` answers 401 JSON for every method. The gate page, its POST and the static and PWA assets (`/manifest.webmanifest`, `/icons/*`, `/og.png`, `/_app/*`) stay public. With `DEMO_MODE=on` the gate is off entirely.

* **Secrets (runtime, `$env/dynamic/private`):**
  * `HOUSEHOLD_PIN_HASH`: `scrypt:<N>:<r>:<p>:<salt>:<key>` (N=32768, r=8, p=1, 16-byte salt, 32-byte key, base64url). Never the PIN.
  * `SESSION_SECRET`: at least 32 characters (`openssl rand -base64 48`). It signs the session cookie.
  * Either one missing (or a short secret) fails closed: no one gets in, and the function log says which.
* **`scripts/hash-pin.ts`** reads the PIN (exactly 6 digits) without echo at a terminal, or from stdin, and prints only the hash. Write it to a private file, then redirect the file into `vercel env add` (the CLI waits only half a second for piped input, so don't pipe the script straight in):
  ```sh
  (umask 077; pnpm exec tsx scripts/hash-pin.ts > ~/.tab-pin-hash) && vercel env add HOUSEHOLD_PIN_HASH production --sensitive < ~/.tab-pin-hash
  ```
* **Session cookie:** `tab_session=<payload>.<signature>`, where the payload is base64url JSON `{ v: 1, iat }` and the signature is base64url HMAC-SHA256 of the payload, compared timing-safely. `httpOnly`, `Secure` (except on plain `http://localhost`), `SameSite=Lax`, `path=/`, 400 days. A cookie that fails to verify is cleared, and the gate says the session expired.
* **Revoking:** rotate `SESSION_SECRET` and redeploy to log out every device. A new PIN hash alone doesn't end existing sessions.
* **Brute force:** 5 wrong PINs within 15 minutes from one IP lock that IP out for 15 minutes, and every attempt takes at least 500 ms. It's in memory, per serverless instance: best effort.
* **Client:** `src/hooks.client.ts` wraps `fetch`; any `/api/*` 401 sends the user to the gate and back. A 401 is never treated as offline, so queued rides stay queued and sync after the PIN.
* **Installed PWA:** it has its own cookie jar, so each phone enters the PIN once inside the installed app.
* **`PUBLIC_DEMO_URL`:** when set, the gate shows "¿Solo quieres probar? Ver demo" linking there.

## Demo
`tab-ve-demo.vercel.app` is the same code on a second Vercel project with `DEMO_MODE=on` and its own Neon database. Production never sets `DEMO_MODE`, and with it off none of the code below runs (no extra queries, no banner, no demo table).

* **No gate.** `/acceso` redirects into the app.
* **Shared sample data, reset every 4 hours.** `src/lib/server/demo/` holds it all. On a demo request, each instance reads the last reset time at most once a minute; when it's older than 4 hours (or missing, on a fresh database), it truncates the ride, place and user tables (`RESTART IDENTITY`) and reseeds them (`seed.ts`): Ana and Luis (ids 1 and 2, the default clients), the driver Carla, the public place list plus Fresco Market, and 14 rides at Caracas wall times relative to now covering every state the UI shows. The BCV cache is kept.
* **One transaction.** The reset is a single batch over Neon's HTTP driver, guarded by `pg_try_advisory_xact_lock` (HTTP has no sessions, so a session lock would release immediately). Concurrent resets can't both seed, and a failed one changes nothing. The last reset time lives in `demo.reset_state`, a schema of its own the reset creates; `schema.ts` doesn't change and drizzle-kit only manages `public`.
* **Reiniciar** in the banner (`POST /api/demo/reset`, answered by the hook, so the real app has no such route) asks through the standard confirm dialog, reseeds, and reloads the page. Limits: 5 per IP per hour, and once a minute overall (checked in the database).
* **Abuse limits:** 30 writes per IP per 10 minutes, then 429 (in memory, per instance); a hard cap of 300 rides, after which the next new ride forces a reset.
* **People:** `src/lib/demo.ts` tells shared code whether it's the demo (`data-demo="on"` on `<html>`, written by the hook). "¿Quién eres?" and the drawer's user tile then show Ana, Luis and Carla, and the API's default `conductor_nombre` is "C". Ride and receipt names come from the database, which only has the demo people.
* **Migrations:** `drizzle.demo.config.ts` reads only `DEMO_DATABASE_URL` from the process environment and never loads `.env`. Keep the demo URL in a private file outside the repo:
  ```sh
  env $(cat ~/.config/tab/demo.env) pnpm drizzle-kit push --config drizzle.demo.config.ts
  ```
  Print only the host first, and confirm it isn't production's and has no tables.
* **Deploying the demo:** from a clean export, so the repo's `.vercel` link to production is never rewritten and no local env file uploads:
  ```sh
  dir=$(mktemp -d) && git archive <commit> | tar -x -C "$dir" && cd "$dir" && pnpm install --frozen-lockfile
  VERCEL_ORG_ID=<team> VERCEL_PROJECT_ID=<tab-ve-demo> vercel build --prod && VERCEL_ORG_ID=<team> VERCEL_PROJECT_ID=<tab-ve-demo> vercel deploy --prebuilt --prod
  ```
  The demo project's env is `DATABASE_URL` (the demo database, sensitive) and `DEMO_MODE=on`, with no PIN secrets. The first request seeds the database.

## Deploy
Deploys are pushed from the Vercel CLI, not from git:

```sh
vercel build --prod && vercel deploy --prebuilt --prod
```

* **`DATABASE_URL` is a runtime env var on the Vercel project** (sensitive, Production environment). `src/lib/server/db.ts` reads it through `$env/dynamic/private` when the first query runs, so it is never baked into the build and the build itself needs no database URL. If it's missing at runtime, every page or API call that queries the database fails with a 500 and the function log says `DATABASE_URL is not set`.
* **The local `.env` is only for local tooling and dev:** `pnpm dev` (Vite loads it), `drizzle.config.ts` (`db:push`, `db:studio`) and `scripts/seed.ts`. It doesn't affect what gets deployed.
* **Always run `vercel build` right before `vercel deploy --prebuilt`.** Otherwise whatever is already in `.vercel/output` gets shipped, which may be a stale build.
* **A preview deploy (the same two commands without `--prod`) reads the Preview environment's `DATABASE_URL`.** Without one, its database pages fail. If it holds the production value, any ride created or paid there is real.
* **The Preview environment also needs `HOUSEHOLD_PIN_HASH` and `SESSION_SECRET`,** or a preview can't be entered (the gate fails closed). `vercel env add ... preview` asks for a branch or `--value`, so add them through the REST API with the body on stdin, as for `DATABASE_URL`.

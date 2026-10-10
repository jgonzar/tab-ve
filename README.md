# Tab

## Overview
Tab is a private, Spanish-language, mobile-first web app that lets one household in Venezuela keep a running tab of rides with their trusted driver. It shows what's owed in USD and in bolívares (VES) at the official BCV rate, and lets the household settle up in batches. It installs to the home screen as a PWA.

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

`pnpm dev` is behind the PIN gate too. Put a `HOUSEHOLD_PIN_HASH` (from `scripts/hash-pin.ts`, for a local PIN) and a `SESSION_SECRET` in `.env`, or set `DEMO_MODE=on` there to skip the gate.

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

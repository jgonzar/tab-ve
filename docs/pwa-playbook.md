# Playbook: make a web app installable on iPhone/iPad (+ shared account/logout)

Derived from doing this to memo-app (SvelteKit 2 + Tailwind 4 + DaisyUI 5 on Vercel,
commit `0ba3bc2`). Ordered so each phase is independently shippable and verifiable.

Phases 1–3 are the PWA itself. Phase 4 is the one that most often breaks and is easiest
to forget. Phases 5–6 are the account/logout work. Phase 7 is optional.

**Assumed target: the same stack** — SvelteKit 2 (`adapter-vercel`, runes), Tailwind 4,
DaisyUI 5, Lucia-style session cookies, deployed on Vercel. On that stack most of this is
file-copy plus four patches; see the bottom line below. On a different stack, only the
templating and asset directory change (`app.html` → `index.html` / `_document.tsx`,
`static/` → `public/`); the head tags, safe-area CSS, and logout semantics carry over.

---

## Bottom line — the seamless same-stack port

Roughly **1–2 hours**, most of it the icon design and the on-device test.

### 1. Copy, unchanged

```sh
SRC=~/projects/memo-app
DST=~/projects/<target-app>

mkdir -p $DST/src/lib/components $DST/static/icons $DST/design
cp $SRC/src/lib/components/LogoutButton.svelte $DST/src/lib/components/
cp $SRC/src/lib/components/AccountMenu.svelte  $DST/src/lib/components/
cp $SRC/static/manifest.webmanifest            $DST/static/
cp -r $SRC/design/icons                        $DST/design/
```

`LogoutButton.svelte` is fully generic. `AccountMenu.svelte` is generic provided the
target has a `$lib/stores/theme` exposing `{ subscribe, toggle }` — if not, that import is
the only edit.

Also lift these two blocks verbatim:
- the **PWA section of `src/app.css`** (`--safe-bottom` / `--safe-top`, `.pwa-bottom-nav`,
  `.pwa-main-inset`, the `overscroll-behavior` reset)
- the **PWA head block of `src/app.html`** (manifest, apple-touch-icon, PNG favicons,
  `apple-mobile-web-app-*`, `theme-color`), plus `viewport-fit=cover` on the viewport meta

### 2. Patch four files

| File | Change |
|---|---|
| `src/lib/stores/theme.ts` | Add the `THEME_COLOR` map + `applyThemeColor()`; call it from `toggle()` |
| `src/app.html` | In the existing before-paint theme script, also set the `theme-color` meta |
| `src/routes/(app)/+layout.svelte` | Render `<AccountMenu>`; swap the bottom nav / main padding to `.pwa-bottom-nav` / `.pwa-main-inset` |
| settings route | Add the **Cuenta** section (identity + `<LogoutButton>`) — the mobile sign-out path |

Plus, if the target has a separate admin shell: render `<AccountMenu>` there too, and
normalize its server load to return `user: { name, email, picture }`.

Confirm `src/routes/auth/logout/+server.ts` exports **`POST`** (not `GET`), then grep for
`<a href="/auth/logout"` — that exact mismatch is what produced `GET method not allowed`
in memo-app.

### 3. Decide three things

1. **Names** — `name`, `short_name`, `apple-mobile-web-app-title`, and `start_url` (the
   post-login route, not `/`).
2. **Brand colors** — recolor `design/icons/*.svg`, then set `theme_color` /
   `background_color` / the `THEME_COLOR` map from the target's `--color-base-100`.
3. **Whether a logout already exists**, and whether it's reachable on mobile.

`theme-color` can't take a CSS variable or `oklch()` reliably, so it must be a hardcoded
hex. To convert the target's tokens, run this in its devtools console under each theme:

```js
const c = document.createElement('canvas').getContext('2d');
const v = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-base-100').trim();
c.fillStyle = v; c.fillRect(0, 0, 1, 1);
const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
console.log(v, '→ #' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''));
```

### 4. Regenerate icons, deploy, verify

Run the `sips` block from Phase 1b, **look at the 512 PNG**, deploy, then run the curl
verification from Phase 7 against the production alias. Delete any previously added
home-screen icon before re-adding on device.

### What will still bite you

Three things no amount of copying prevents, in descending order of likelihood:

1. **Nothing is live until deployed**, and iOS reports a missing manifest as *no icon*
   rather than an error. Curl the alias before touching the phone.
2. **OAuth inside the standalone container** — separate cookie jar, and the redirect has to
   survive leaving and re-entering. Device-test only. Still unverified in memo-app.
3. **A logout that's unreachable on mobile**, because the account menu lives in
   `hidden md:flex` chrome. This is why step 2 patches the settings route.

---

## Phase 0 — Preflight audit

Answer these before writing anything; each one changes later phases.

- [ ] **Is there a `<link rel="manifest">` and an `apple-touch-icon` already?** Grep the
      HTML template. Absence is the norm; a half-done manifest is worse than none.
- [ ] **Where do static assets live, and what's the URL prefix?** Confirm a file dropped
      in `static/` is served at `/`. Deploy a throwaway file and curl it if unsure.
- [ ] **Does the app have a manual light/dark toggle, or does it follow
      `prefers-color-scheme`?** Determines whether `theme-color` can be a static
      media-query pair or must be updated in JS (Phase 2).
- [ ] **Is there a `position: fixed` bottom nav or bottom-anchored bar?** If yes, Phase 3
      is mandatory, not optional.
- [ ] **Is any nav chrome desktop-only** (e.g. `hidden md:flex`)? Anything reachable only
      from that chrome is unreachable on the installed phone app. List those actions now
      — this is what drives Phase 6.
- [ ] **What's the auth mechanism, and is there third-party OAuth?** Drives Phase 4.
- [ ] **Do preview deploys work?** Check whether env vars exist for the Preview
      environment, not just Production. If secrets are Production-only, preview builds
      fail at build time and your only test target is production.
- [ ] **Is the project git-connected for deploys, or CLI-push?** CLI-push means the deploy
      ships your whole working tree — audit uncommitted work before shipping.

---

## Phase 1 — Icons and manifest

### 1a. Design one full-bleed square source

- [ ] Author a **1024×1024 SVG**, artwork bleeding to all four edges. iOS applies its own
      rounded-corner mask; padding it yourself yields a shrunken icon inside a border.
- [ ] Pull colors from the app's own theme tokens so it can't drift from the UI.
- [ ] Author a **second maskable variant** with the glyph scaled to **~74–80%** about the
      centre. Android's maskable crop is aggressive and will clip a full-bleed glyph.
- [ ] Author a **separate, chunkier favicon** (fewer elements, thicker strokes) — the
      1024 icon turns to mush at 16–32px. Verify by rendering at 128px and eyeballing it.
- [ ] Commit the SVG sources plus a regeneration command to `design/icons/` (or similar).
      Without this, the next icon change means redoing the whole job.

### 1b. Rasterize

macOS needs no dependencies — `sips` rasterizes SVG:

```sh
for s in 1024 512 192 180; do
  sips -s format png --resampleHeightWidth $s $s design/icons/icon.svg \
    --out static/icons/icon-$s.png
done
sips -s format png --resampleHeightWidth 512 512 design/icons/icon-maskable.svg \
  --out static/icons/icon-maskable-512.png
sips -s format png --resampleHeightWidth 32 32 design/icons/favicon.svg \
  --out static/icons/favicon-32.png
sips -s format png --resampleHeightWidth 48 48 design/icons/favicon.svg \
  --out static/icons/favicon-48.png
```

- [ ] Verify every output's real dimensions (`sips -g pixelWidth -g pixelHeight`) — a
      silent failure yields a 0-byte or wrong-size PNG that 200s in production.
- [ ] **Open the 512 and look at it.** Non-negotiable. Gradient direction, clipPath
      support, and font rendering all differ between rasterizers.

### 1c. Manifest

- [ ] `static/manifest.webmanifest`:
  - `display: "standalone"` — this is what removes browser chrome
  - `start_url` — the post-login landing route, not `/`
  - `scope: "/"`
  - `background_color` / `theme_color` — the app's base surface color
  - `lang`, `dir`
  - `icons`: 192 + 512 at `purpose: "any"`, plus the 512 at `purpose: "maskable"`
  - `shortcuts` (optional) — long-press actions on the home-screen icon
- [ ] For a **multi-tenant** app, name the manifest after the *product*, not the tenant.
      A static manifest is one file; per-tenant manifests mean a dynamic route and are
      rarely worth it initially.

---

## Phase 2 — HTML head

In the root HTML template:

- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
      — **`viewport-fit=cover` is what makes Phase 3 necessary.** Adding it without
      Phase 3 pushes UI under the home indicator. They ship together.
- [ ] `<link rel="manifest" href="/manifest.webmanifest">`
- [ ] `<link rel="apple-touch-icon" href="/icons/icon-180.png">`
- [ ] **Real PNG favicons**, e.g. `<link rel="icon" type="image/png" sizes="32x32" ...>`.
      See the `data:` URI trap in Gotchas — an SVG favicon alone is not enough.
- [ ] `apple-mobile-web-app-capable` = `yes` and `mobile-web-app-capable` = `yes`
- [ ] `apple-mobile-web-app-title` = short app name (this is the home-screen label)
- [ ] `apple-mobile-web-app-status-bar-style` = `default`. Only use `black-translucent`
      if you're prepared to inset *top* content too — it puts your UI under the clock.
- [ ] `<meta name="theme-color">` — tints the iOS status bar and Android toolbar.

**theme-color with a manual theme toggle.** A media-queried pair
(`<meta media="(prefers-color-scheme: dark)">`) is *wrong* when the user can override the
theme in-app. Instead:

- [ ] Emit one `<meta name="theme-color">` with the light value.
- [ ] In the existing before-first-paint theme script, set its `content` from the resolved
      theme (the same place the `data-theme` attribute gets set).
- [ ] In the theme store/toggle, update it on change. Keep the two color values in one
      exported map next to the toggle so they can't drift.

---

## Phase 3 — Standalone chrome and safe areas

- [ ] Expose the insets as CSS variables once, globally:

```css
:root {
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
}
```

  The `, 0px` fallback matters — these resolve to nothing in a browser tab and on
  hardware without a home indicator.

- [ ] Pad any `fixed` bottom bar by `--safe-bottom`.
- [ ] **Grow whatever reserves space for that bar by the same inset.** A hardcoded
      `padding-bottom: 4rem` becomes `calc(4rem + var(--safe-bottom))`. Missing this
      clips the last row of scrollable content.
- [ ] Reset that inset at the breakpoint where the bottom bar disappears.
- [ ] `overscroll-behavior-y: none` on `html, body` — kills the rubber-band scroll that
      instantly reads as "this is a website".
- [ ] `-webkit-text-size-adjust: 100%` and `-webkit-tap-highlight-color: transparent`.
- [ ] Prefer named utility classes (`.pwa-bottom-nav`, `.pwa-main-inset`) over inline
      arbitrary values, so the intent is greppable later.

---

## Phase 4 — Auth in standalone mode

**The highest-risk phase, and invisible until tested on a physical device.**

- [ ] Understand that **an installed PWA has its own cookie jar**, separate from Safari.
      Every user will be logged out on first launch and must sign in inside the app.
      Communicate this or it reads as a bug.
- [ ] **Test third-party OAuth from inside the installed app**, not in Safari. The flow
      leaves your origin and returns; standalone containers have historically been fussy
      about whether the session cookie set on the callback lands inside the container.
      Modern iOS usually handles it. Verify rather than assume.
- [ ] Failure signature: you pick your account, get redirected back, and land on the
      login screen still unauthenticated.
- [ ] If it fails, the fix is in the redirect hop, not the cookie config.

> Status in memo-app: **unverified.** Deployed but not yet confirmed on device.

---

## Phase 5 — One shared logout mechanism

- [ ] **Audit first: how many logout implementations exist, and does each work?**
      In memo-app there was exactly one, it was broken, and it was admin-only — regular
      users had no way to sign out at all. Expect to find something similar.
- [ ] Build **one** component that owns the logout mechanism. Everything else renders it.
- [ ] **Use POST, not a link.** If the framework preloads links on hover (SvelteKit's
      `data-sveltekit-preload-data="hover"`, Next's `<Link prefetch>`), a GET-able logout
      URL logs users out when a cursor or thumb grazes it.
- [ ] Match the framework's endpoint semantics. In SvelteKit, don't put `use:enhance` on a
      form posting to a `+server.ts` endpoint — enhance expects a form-action response and
      will swallow the endpoint's redirect.
- [ ] Verify: `curl -o /dev/null -w '%{http_code}' https://host/auth/logout` should return
      **405**. A 200 or 302 means it's GET-reachable and preload can fire it.
- [ ] Give the component `class` / `iconClass` props so each call site can match its local
      row idiom without duplicating the form.

---

## Phase 6 — One common account surface

- [ ] Build an account dropdown (avatar → identity, theme, sign out) and use it on every
      shell that has a header: the main app chrome *and* any separate admin/settings shell.
- [ ] Normalize the server payloads so the same component takes the same props everywhere
      (e.g. return `user: { name, email, picture }` rather than a bare `adminName`).
- [ ] Avatar fallback: first initial on a brand-colored circle when there's no picture.
- [ ] **Cover the mobile path explicitly.** If the account menu lives in desktop-only
      chrome, add a reachable equivalent — a "Account" section at the bottom of the
      settings route that the mobile nav already links to. Same shared logout component.
- [ ] Check whether the settings route *already* has a theme toggle before adding another.

### Styling traps in this phase

- [ ] **Don't wrap a form-based button in a component library's menu markup.** DaisyUI
      styles items via `li > *`, which only matches direct children — a `<form>` wrapper
      means the *form* gets the item padding and hover background while the button paints
      its own inside it. Result: doubled hover states at mismatched widths and labels that
      don't share a left edge. Drop the library's `menu` class and define one row spec.
- [ ] Define the row spec **once** as a constant and have every row consume it. Padding,
      gap, icon column, radius, and text size then match by construction.
- [ ] **Append hover colors per row, never bake them into the shared spec.** Two competing
      `hover:bg-*` utilities on one element resolve by stylesheet order, not by the order
      you wrote them — it's a coin flip.
- [ ] Use the icon library's fixed-width modifier (`fa-fw`) rather than a hand-set width,
      so every label starts at the same offset.
- [ ] Give the identity block the same horizontal padding as the rows so every line in the
      panel shares one left edge.

---

## Phase 7 — Deploy and verify

- [ ] **Assume nothing is live until you've curled it.** None of this exists for iOS until
      deployed; a phone will silently show no icon rather than an error.
- [ ] If secrets are Production-only, preview deploys fail — production is the only target.
      Budget for that (commit first so there's a rollback point).
- [ ] Verify against the **production alias**, not the deployment URL:

```sh
B=https://your-app.example.com
for p in /manifest.webmanifest /icons/icon-180.png /icons/icon-512.png \
         /icons/icon-maskable-512.png /icons/favicon-32.png; do
  printf "%-32s HTTP %s  %s\n" "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' $B$p)" \
    "$(curl -s -o /dev/null -w '%{content_type}' $B$p)"
done
curl -s $B/login | grep -oE 'rel="(manifest|apple-touch-icon|icon)"[^>]*|name="(apple-mobile-web-app-[a-z-]*|theme-color)" content="[^"]*"|viewport-fit=cover'
```

- [ ] Confirm the manifest serves as `application/manifest+json`.
- [ ] If asset hrefs come out **relative** (`./icons/...`), check depth-2 and depth-3
      routes before declaring a bug — SvelteKit computes the `../` prefix per route depth
      and resolves correctly. A 404 page is a convenient deep-route test target.
- [ ] On device: **delete any previously added home-screen icon** — it's a stale snapshot
      and won't pick up the new manifest. Then hard-refresh in Safari (its favicon cache
      is aggressive; closing and reopening the tab helps), and re-add.
- [ ] Device checklist: no address bar; correct icon and label; status bar tint follows the
      in-app theme toggle; bottom nav clear of the home indicator; sign-in works; sign-out
      reachable and working.

---

## Phase 8 — Optional, only when a requirement demands it

- [ ] **Service worker.** *Not* required for iOS Add to Home Screen. Required for Chrome's
      Android install prompt, and for offline. Skip it for a live-data app until offline is
      an actual requirement — it mostly adds stale-data bugs.
- [ ] **Launch splash.** iOS shows a plain `background_color` screen without one. A real
      splash needs an `apple-touch-startup-image` per device resolution — a large matrix.
      Add only if the blank flash is objectionable.
- [ ] **Push notifications.** Work on iOS only for home-screen-installed PWAs.

---

## Gotchas quick reference

| Trap | Consequence | Fix |
|---|---|---|
| SVG favicon inlined as a `data:` URI (bundlers inline assets under ~4 KB) | iOS won't use a `data:` URI for share-sheet or home-screen icons — no icon appears | Ship real PNG files and reference them by path |
| `viewport-fit=cover` without safe-area insets | Fixed bottom nav sits under the home indicator | Ship Phases 2 and 3 together |
| Hardcoded `padding-bottom` reserving space for a bottom bar | Last row of content clipped once the bar grows by the inset | `calc(<original> + var(--safe-bottom))` |
| Media-queried `theme-color` in an app with a manual toggle | Status bar disagrees with the UI | Update the meta in JS from the resolved theme |
| Full-bleed glyph in the maskable icon | Android crops the artwork | Separate variant at ~74–80% scale |
| GET-able logout + hover link preloading | Users signed out by hovering | POST-only; assert 405 |
| `use:enhance` on a form posting to an endpoint | Redirect swallowed, user stuck on a dead page | Plain form POST |
| Form-wrapped button inside a component library's menu | Doubled hover backgrounds, mismatched padding | Drop the `menu` class; one shared row spec |
| Two `hover:bg-*` utilities on one element | Wrong color wins unpredictably | Append hover per row, not in the shared spec |
| Account menu only in desktop-only chrome | Action unreachable on the installed phone app | Mirror it into a mobile-reachable route |
| Installed PWA's separate cookie jar | "It logged me out" reported as a bug | Expect re-login; test OAuth in standalone |
| Preview env missing Production-only secrets | Preview build fails; production is the only test target | Commit before deploying |
| Assuming a deploy happened | Phone shows no icon, with no error to explain why | Curl the alias for HTTP codes and head tags |

---

## Related: Google OAuth "unverified app" (if the target app uses Google sign-in)

Not PWA work, but it surfaces during device testing and has a long lead time.

- A **sensitive** scope (e.g. `.../auth/calendar`) plus **Testing** publishing status
  produces the "Google hasn't verified this app" screen. Test users see it too; there's no
  way to suppress it. Click through via "Continuar" / "Advanced → Go to app".
- **Testing status also expires refresh tokens after 7 days.** Publishing to production
  removes that expiry and needs no verification — do it early. Cost: unverified production
  apps cap at 100 users and still show the warning.
- Removing the warning needs verification: homepage, privacy policy, and terms on a domain
  you own; **domain ownership verified in Google Search Console**; a demo video; scope
  justification. Days to weeks of review.
- **`*.vercel.app` subdomains cannot be Search Console verified** (public suffix list), so
  verification requires buying a custom domain first. Plan for it.

# Sileo Toast Playbook

How `svelte-sileo` is wired in Memo, written as a portable recipe for dropping the
same toast system into another app. API details below were read off
`node_modules/svelte-sileo@1.1.0/dist/*.d.ts`, not from memory.

---

## 0. Prerequisites

| Requirement | Notes |
| --- | --- |
| **Svelte 5** | Hard peer dep (`"svelte": "^5.0.0"`). Uses runes internally. |
| Tailwind | **Optional.** The package ships self-contained plain CSS (`dist/styles.css`) with its own `--sileo-*` variables. Tailwind is only needed if you want to pass utility classes via the `styles` option. |
| SvelteKit | Not required — any Svelte 5 app works. Memo happens to use SvelteKit. |

> **Not a Svelte app?** `svelte-sileo` is a port of the React library `sileo`. For a
> React/Next target, install that instead — the mental model below (single mount,
> singleton imperative API, theme-reactive options) transfers, but the import
> paths and component names do not.

---

## 1. Install

```bash
pnpm add svelte-sileo
```

No CSS import needed. `Toaster` does `import "./styles.css"` internally, so the
stylesheet ships automatically as soon as the component is bundled.

---

## 2. Mount one `<Toaster>` at the layout root

Exactly **one** per app, placed in the highest layout that should show toasts. In
Memo that's the authenticated shell — `src/routes/(app)/+layout.svelte` — so
public/login routes deliberately have none.

```svelte
<script lang="ts">
  import { Toaster } from 'svelte-sileo';
</script>

<Toaster position="bottom-right" options={toasterOptions} />
```

### `<Toaster>` props

| Prop | Type | Purpose |
| --- | --- | --- |
| `position` | `"top-left" \| "top-center" \| "top-right" \| "bottom-left" \| "bottom-center" \| "bottom-right"` | Default corner for all toasts. |
| `offset` | `number \| string \| { top?, right?, bottom?, left? }` | Inset from the viewport edge. Useful to clear a mobile bottom nav. |
| `multiple` | `boolean` | Stack several toasts vs. swap in place. |
| `options` | `Partial<SileoOptions>` | Global defaults merged into every toast. |
| `children` | `Snippet` | Custom render slot. |

---

## 3. Define theme-reactive global options

This is the part worth copying. Memo derives `options` from its theme store so the
pill always contrasts with the page: **dark pill on light theme, light pill on dark
theme**.

```svelte
<script lang="ts">
  import { theme } from '$lib/stores/theme';

  const toasterOptions = $derived(
    $theme === 'light'
      ? {
          duration: 5000,
          fill: '#171717',        // dark pill
          roundness: 8,
          autopilot: true,
          styles: {
            title: 'font-semibold',
            description: 'text-white/70!',
            badge: 'bg-white/10!'
          }
        }
      : {
          duration: 5000,
          fill: '#ffffff',        // light pill
          roundness: 8,
          autopilot: true,
          styles: {
            title: 'text-zinc-900! font-semibold',
            description: 'text-zinc-600!',
            badge: 'bg-black/5!'
          }
        }
  );
</script>
```

Two learned details:

- **The `!` suffix is Tailwind v4's important modifier** (`text-white/70!`), needed
  to beat the package's own baked-in colors.
- **Only the dark pill keeps a state-colored title.** On the white pill, the
  success-green / error-red title is too low-contrast, so it's forced to neutral
  `text-zinc-900`. Don't skip this — it's the difference between legible and not.

### Full `SileoOptions` surface

```ts
interface SileoOptions {
  id?: string;
  title?: string;
  description?: string | Component;
  position?: SileoPosition;
  duration?: number | null;              // null = never auto-dismiss
  icon?: Component | null;
  styles?: { title?; description?; badge?; button? };  // class strings
  fill?: string;                          // pill background
  roundness?: number;                     // px corner radius (default 16)
  autopilot?: boolean | { expand?: number; collapse?: number };
  button?: { title: string; onClick: () => void };
}
```

Package defaults worth knowing (`dist/constants.js`): height `40px`, width `350px`,
roundness `16`, toast duration `6000ms`.

---

## 4. Fire toasts from anywhere

Import the singleton — no context, no provider, no prop drilling.

```ts
import { sileo } from 'svelte-sileo';

sileo.success({ title: 'Saved', description: 'Your changes were stored.' });
sileo.error({ title: 'Save failed', description: 'Try again.' });
```

### Full `sileo` API

| Method | Signature | Returns |
| --- | --- | --- |
| `show` / `success` / `error` / `warning` / `info` / `action` | `(opts: SileoOptions)` | toast `id` |
| `promise` | `(promise, { loading, success, error, action?, position? })` | the promise's value |
| `dismiss` | `(id: string)` | — |
| `clear` | `(position?)` | — |
| `setPosition` / `setOptions` / `setMultiple` | imperative equivalents of the `<Toaster>` props | — |

### The `promise` pattern

Best for uploads and anything with a visible latency. Memo uses it in
`FileSection.svelte`:

```ts
try {
  await sileo.promise(work, {
    loading: { title: 'Uploading…' },
    success: { title: 'Uploaded', description: 'File attached.' },
    error:   { title: 'Upload failed', description: 'Check the file and retry.' }
  });
} catch {
  // the error toast already surfaced the failure — swallow so it doesn't bubble
} finally {
  uploading = false;
}
```

`sileo.promise` **re-throws** on rejection. Wrap it in `try/catch` or you get an
unhandled rejection on top of the toast you already showed.

`success` and `error` also accept a function (`(data) => SileoOptions`), so the
message can include values from the resolved response.

---

## 5. Conventions to carry over

These are Memo's house rules, not library requirements — but they're what make the
toasts feel consistent instead of ad hoc.

1. **Always `title` + `description`.** Title is the outcome ("Payment recorded"),
   description is the consequence ("Added to the history"). Never title-only.
2. **Pair every mutation.** Each `await fetch(...)` gets a success branch and an
   error branch. Memo's error copy is uniform: `"Couldn't save the changes. Try
   again."`
3. **Toast the mutation, not the read.** Loads use inline/skeleton states; only
   writes toast. The one exception is a load failure inside a modal.
4. **Interpolate tenant vocabulary, don't hardcode nouns.** Memo writes
   `` `${data.business.clientSingularCap} updated` `` so "Patient" / "Client" /
   "Student" follows the tenant config. Copy this if the target app is
   multi-tenant.
5. **Match the app's language.** All of Memo's strings are Spanish. Pick one and
   don't mix.

---

## 6. Rollout order for the new app

1. `pnpm add svelte-sileo`; confirm the app is on Svelte 5.
2. Mount a single `<Toaster>` in the root layout with hardcoded options; verify one
   `sileo.success()` renders.
3. Wire options to the theme store (step 3) and check both themes for title
   contrast on the light pill.
4. Set `offset` if a fixed bottom nav or banner overlaps the toast.
5. Replace existing `alert()` / inline banner error states route by route.
6. Convert long-running actions (uploads, imports) to `sileo.promise`.

---

## 7. Known wart in Memo (don't copy)

`src/app.css` has a Sileo section header comment describing a taller/chunkier pill
and advising "keep `<Toaster roundness>` at half this height for fully-rounded
ends" — but **the rule block underneath is empty**. The CSS it documents was
removed or never written, so `roundness: 8` is just a plain 8px radius. Either
write the rules or delete the comment; don't port it forward.

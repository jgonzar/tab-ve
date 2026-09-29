# Tab brand sources

- `wordmark.svg`: the "tab." wordmark, master. Outlined paths from the supplied artwork (a modified Glitz), filled with `currentColor`. No font file is needed or shipped.
- `wordmark-offwhite.svg`, `wordmark-lime.svg`, `wordmark-violet.svg`, `wordmark-indigo.svg`: the same paths in each palette colour.

The square mark (app icon, maskable icon, favicon) is the wordmark's "b" plus its period, cut from these same paths. Its sources are in `../icons/`.

## Palette

| Name | Hex |
| --- | --- |
| Indigo | `#1c1a9b` |
| Violet | `#4342f5` |
| Lime | `#d7fe65` |
| Off-white | `#f8f8f8` |

## Never pair

- **Violet on Indigo** (2.00:1). No Violet wordmark, icon or text on an Indigo field.
- **Lime with Off-white** (1.08:1), either one on the other. Their brightness is nearly identical.

On a dark UI the wordmark is Off-white, optionally with a Lime period. The Violet and Indigo wordmarks are for light backgrounds.

#!/usr/bin/env python3
"""Convert the OG cards' text lines to SVG outlines, set in Poppins.

design/og.svg and design/og-demo.svg carry their text as outlined <path>s so
that rasterising them with sips never depends on which fonts are installed.
This script is how those paths were made. Rerun it only when the copy or
layout changes, and paste the printed elements over the matching ones in the
card's SVG.

    python3 design/og-text.py /path/to/poppins-ttf-dir [og | og-demo]

The card defaults to og. Needs fontTools (pip install fonttools) and the OFL
Poppins TTFs from https://github.com/google/fonts/tree/main/ofl/poppins
(Poppins-Regular.ttf, Poppins-SemiBold.ttf). The TTFs are not committed.
The latin @fontsource/poppins files in node_modules give the same outlines:
copy poppins-latin-400-normal.woff and poppins-latin-600-normal.woff into a
folder under the two TTF names (fontTools reads WOFF either way).

Glyphs are placed on their plain advance widths. That matches a browser:
Poppins ships no pair kerning (its GPOS holds only mark-positioning
features, and it has no legacy kern table). Coordinates are rounded to
0.01 px.
"""

import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

STACK_LINE = ("stack line", "Poppins-SemiBold.ttf", 19, 2.2, 97, 478, "#97a1ff",
              "SVELTEKIT  ·  DRIZZLE  ·  POSTGRES  ·  PWA")

# Per card: (label, font file, size px, tracking px, x, baseline y, fill, text)
CARDS = {
    # static/og.png, the original English card
    "og": [
        ("description, line 1", "Poppins-Regular.ttf", 30, 0, 96, 368, "#b6b5be",
         "Offline-first ride payment tracker with"),
        ("description, line 2", "Poppins-Regular.ttf", 30, 0, 96, 412, "#b6b5be",
         "live BCV exchange-rate conversion."),
        STACK_LINE,
    ],
    # static/og-demo.png, the demo's card: its description, in the same slots
    "og-demo": [
        ("description, line 1", "Poppins-Regular.ttf", 30, 0, 96, 368, "#b6b5be",
         "Sample data, shared by every visitor."),
        ("description, line 2", "Poppins-Regular.ttf", 30, 0, 96, 412, "#b6b5be",
         "Resets every 4 hours."),
        STACK_LINE,
    ],
}


def outline(font, text, size, tracking, x, y):
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    cursor = x
    for c in text:
        glyph = glyphs[cmap[ord(c)]]
        # Flip the font's y-up space into SVG's y-down, baseline at y.
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, y)))
        cursor += glyph.width * scale + tracking
    return pen.getCommands(), cursor - tracking


def main():
    font_dir = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    card = sys.argv[2] if len(sys.argv) > 2 else "og"
    fonts = {}
    for label, file, size, tracking, x, y, fill, text in CARDS[card]:
        font = fonts.setdefault(file, TTFont(font_dir / file))
        d, right = outline(font, text, size, tracking, x, y)
        print(f"  <!-- {label}: \"{text}\", {file[:-4]} {size}px, "
              f"tracking {tracking}, ends at x={right:.1f} -->")
        print(f'  <path fill="{fill}" d="{d}"/>')


if __name__ == "__main__":
    main()

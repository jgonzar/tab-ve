#!/bin/sh
# Regenerate all PWA raster icons from the SVG sources.
# Run from the repo root:  sh design/icons/regenerate.sh
# macOS only — sips ships with the OS, no dependencies needed.
set -e

mkdir -p static/icons

# No 1024 raster: nothing references it and sips writes ~900KB for it.
# design/icons/icon.svg is the archival master.
for s in 512 192 180; do
  sips -s format png --resampleHeightWidth $s $s design/icons/icon.svg \
    --out static/icons/icon-$s.png
done

sips -s format png --resampleHeightWidth 512 512 design/icons/icon-maskable.svg \
  --out static/icons/icon-maskable-512.png

for s in 32 48; do
  sips -s format png --resampleHeightWidth $s $s design/icons/favicon.svg \
    --out static/icons/favicon-$s.png
done

echo "--- verifying real output dimensions ---"
for f in static/icons/*.png; do
  printf "%-38s %s\n" "$f" \
    "$(sips -g pixelWidth -g pixelHeight "$f" | tail -2 | tr -d ' \n' | sed 's/pixelWidth:/w=/;s/pixelHeight:/ h=/')"
done

#!/usr/bin/env bash
# Copy downloaded Vecteezy/Freepik SVGs into the Stop Making Sense vendor folder.
# Usage: ./scripts/import-stage-graphics.sh [SOURCE_DIR]
#   SOURCE_DIR defaults to ~/Downloads

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/design/stop-making-sense/graphics/vendor"
SRC="${1:-$HOME/Downloads}"
SOURCES_JSON="$ROOT/design/stop-making-sense/graphics/sources.json"

if [[ ! -d "$SRC" ]]; then
  echo "Source directory not found: $SRC" >&2
  exit 1
fi

mkdir -p "$VENDOR"

# Expected filenames from sources.json
FILES=(
  backdrop.svg floor.svg amp-stack.svg drums.svg keys.svg
  bass.svg guitar.svg vocal.svg lights.svg cables.svg
  crowd.svg hall.svg full-band.svg
)

copied=0
for name in "${FILES[@]}"; do
  # Exact name in source dir
  if [[ -f "$SRC/$name" ]]; then
    cp -f "$SRC/$name" "$VENDOR/$name"
    echo "Copied $name"
    copied=$((copied + 1))
    continue
  fi
  # Vecteezy / Freepik zip often extracts as vecteezy_*.svg or similar — fuzzy match
  match="$(find "$SRC" -maxdepth 3 -type f -iname "*${name%.svg}*" \( -iname '*.svg' -o -iname '*.SVG' \) 2>/dev/null | head -1)"
  if [[ -n "$match" ]]; then
    cp -f "$match" "$VENDOR/$name"
    echo "Copied $(basename "$match") -> $name"
    copied=$((copied + 1))
  fi
done

echo ""
echo "Imported $copied file(s) into $VENDOR"
if [[ $copied -eq 0 ]]; then
  echo "No matches. Download SVGs from links in graphics/sources.json, then re-run."
  echo "Example Vecteezy band silhouette:"
  echo "  https://www.vecteezy.com/vector-art/68247942-black-silhouette-of-a-rock-band-performing-on-stage-with-guitars-and-drums-music-performance"
fi

if command -v python3 >/dev/null && [[ -f "$SOURCES_JSON" ]]; then
  echo ""
  echo "Layer map: design/stop-making-sense/graphics/sources.json"
fi

#!/usr/bin/env bash
#
# Build build/icon.icns (and a 256px preview) from build/icon.svg.
# Rasterizes the SVG with Electron's Chromium, then assembles the iconset
# with the macOS-native sips + iconutil.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BUILD="$ROOT/build"

echo "▸ Rasterizing SVG → PNG (1024) via Electron…"
node_modules/.bin/electron "$BUILD/render-icon.js" >/dev/null 2>&1 || true
[ -f "$BUILD/icon.png" ] || { echo "error: build/icon.png not produced" >&2; exit 1; }

echo "▸ Assembling .iconset…"
ICONSET="$(mktemp -d)/icon.iconset"
mkdir -p "$ICONSET"
gen() { sips -z "$2" "$2" "$BUILD/icon.png" --out "$ICONSET/icon_$1.png" >/dev/null; }
gen 16x16 16;    gen 16x16@2x 32
gen 32x32 32;    gen 32x32@2x 64
gen 128x128 128; gen 128x128@2x 256
gen 256x256 256; gen 256x256@2x 512
gen 512x512 512; gen 512x512@2x 1024

iconutil -c icns "$ICONSET" -o "$BUILD/icon.icns"
sips -z 256 256 "$BUILD/icon.png" --out "$BUILD/icon-256.png" >/dev/null
rm -rf "$(dirname "$ICONSET")"

echo "✓ $BUILD/icon.icns"
echo "✓ $BUILD/icon-256.png"

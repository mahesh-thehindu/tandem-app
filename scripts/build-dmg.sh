#!/usr/bin/env bash
#
# Build Tandem.app from the local Electron runtime and package it into a DMG.
# This is a dependency-light alternative to electron-forge's packager: it clones
# the Electron.app shell, injects our app + runtime node_modules, fixes the
# Info.plist, ad-hoc signs (required to launch on Apple Silicon), and makes a DMG.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="Tandem"
BUNDLE_ID="com.tandem.app"
VERSION="$(node -p "require('./package.json').version")"
ARCH="$(uname -m)"            # arm64 or x86_64
[ "$ARCH" = "x86_64" ] && ARCH="x64"

DIST="$ROOT/dist"
APP="$DIST/$APP_NAME.app"
ELECTRON_APP="$ROOT/node_modules/electron/dist/Electron.app"
DMG="$DIST/$APP_NAME-$VERSION-$ARCH.dmg"

if [ ! -d "$ELECTRON_APP" ]; then
  echo "error: $ELECTRON_APP missing — run 'npm install' first." >&2
  exit 1
fi

echo "▸ Cloning Electron runtime…"
rm -rf "$DIST"
mkdir -p "$DIST"
cp -R "$ELECTRON_APP" "$APP"

echo "▸ Renaming executable + clearing demo app…"
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/$APP_NAME"
rm -f "$APP/Contents/Resources/default_app.asar"

echo "▸ Staging app source + runtime deps…"
APPDIR="$APP/Contents/Resources/app"
mkdir -p "$APPDIR/node_modules/@xterm"
cp -R "$ROOT/src" "$APPDIR/"
cp "$ROOT/package.json" "$APPDIR/"
cp -R "$ROOT/node_modules/@xterm/xterm" "$APPDIR/node_modules/@xterm/"
cp -R "$ROOT/node_modules/@xterm/addon-fit" "$APPDIR/node_modules/@xterm/"
cp -R "$ROOT/node_modules/node-pty" "$APPDIR/node_modules/"

echo "▸ Installing app icon…"
if [ ! -f "$ROOT/build/icon.icns" ]; then
  bash "$ROOT/scripts/make-icon.sh"
fi
cp "$ROOT/build/icon.icns" "$APP/Contents/Resources/tandem.icns"
rm -f "$APP/Contents/Resources/electron.icns"

echo "▸ Patching Info.plist…"
PLIST="$APP/Contents/Info.plist"
PB=/usr/libexec/PlistBuddy
$PB -c "Set :CFBundleName $APP_NAME" "$PLIST"
$PB -c "Set :CFBundleDisplayName $APP_NAME" "$PLIST"
$PB -c "Set :CFBundleExecutable $APP_NAME" "$PLIST"
$PB -c "Set :CFBundleIconFile tandem" "$PLIST"
$PB -c "Set :CFBundleIdentifier $BUNDLE_ID" "$PLIST"
$PB -c "Set :CFBundleShortVersionString $VERSION" "$PLIST" 2>/dev/null || true
$PB -c "Set :CFBundleVersion $VERSION" "$PLIST" 2>/dev/null || true

echo "▸ Ad-hoc signing…"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || codesign --force --sign - "$APP"

echo "▸ Building DMG…"
STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"

SHA="$(shasum -a 256 "$DMG" | awk '{print $1}')"
echo ""
echo "✓ Built: $APP"
echo "✓ DMG:   $DMG"
echo "✓ sha256: $SHA"

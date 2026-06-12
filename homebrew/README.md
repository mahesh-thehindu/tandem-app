# Installing Tandem with Homebrew

Tandem ships as a Homebrew **Cask** (it distributes the built `Tandem.app`).
Homebrew requires casks to live in a *tap*, so installation is two steps:
build the app, then install the cask from a tap.

## Local install (this machine)

```bash
# 1. Build Tandem.app + the DMG  (writes dist/Tandem-<version>-arm64.dmg)
npm install
npm run dist

# 2. Create a local tap and drop the cask in it
brew tap-new "$USER/tandem" --no-git
cp homebrew/Casks/tandem.rb "$(brew --repository)/Library/Taps/$USER/homebrew-tandem/Casks/"

# 3. Install
brew install --cask "$USER/tandem/tandem"
```

Update/uninstall:

```bash
brew reinstall --cask "$USER/tandem/tandem"
brew uninstall --cask "$USER/tandem/tandem"
```

> The cask is **ad-hoc signed**, not notarized. First launch: right-click
> `Tandem.app` → *Open*, or run
> `xattr -dr com.apple.quarantine "/Applications/Tandem.app"`.

## Sharing it (real `brew install` for others)

To let anyone run `brew install <you>/tandem/tandem`:

1. **Publish the artifact.** Push this repo to GitHub, create a Release, and
   attach `dist/Tandem-<version>-arm64.dmg`.
2. **Point the cask at it.** In `Casks/tandem.rb` replace the local `file://`
   URL and `sha256` with the release URL + its hash:

   ```ruby
   version "0.1.0"
   sha256 "<shasum -a 256 of the dmg>"
   url "https://github.com/<you>/tandem/releases/download/v#{version}/Tandem-#{version}-arm64.dmg"
   ```

3. **Publish the tap.** Create a public repo named `homebrew-tandem`, put the
   cask under `Casks/tandem.rb`, and push. Then anyone can:

   ```bash
   brew tap <you>/tandem
   brew install --cask tandem
   ```

## Notes

- The current build is **arm64-only** (`depends_on arch: :arm64`). For Intel,
  build on / cross-build for `x64` and publish a second DMG, or use a single
  universal build.
- For a smoother install, notarize the app with an Apple Developer ID and add
  `xattr` removal isn't needed once notarized.

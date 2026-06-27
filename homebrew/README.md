# Installing Buckthorn Orbit with Homebrew

Buckthorn Orbit ships as a Homebrew **Cask** (it distributes the built
`BuckthornOrbit.app`). Homebrew requires casks to live in a *tap*, so
installation is two steps: build the app, then install the cask from a tap.

> The cask token is **`buckthorn-orbit`** (not `tandem`) — the bare `tandem`
> token belongs to an unrelated public cask, so this app uses its own name.

## Local install (this machine)

```bash
# 1. Build BuckthornOrbit.app + the DMG  (writes dist/BuckthornOrbit-<version>-arm64.dmg)
npm install
npm run dist

# 2. Create a local tap and drop the cask in it
brew tap-new "$USER/tandem" --no-git
cp homebrew/Casks/buckthorn-orbit.rb "$(brew --repository)/Library/Taps/$USER/homebrew-tandem/Casks/"

# 3. Install
brew install --cask "$USER/tandem/buckthorn-orbit"
```

Update/uninstall:

```bash
brew reinstall --cask "$USER/tandem/buckthorn-orbit"
brew uninstall --cask "$USER/tandem/buckthorn-orbit"
```

> The cask is **ad-hoc signed**, not notarized. First launch: right-click
> `BuckthornOrbit.app` → *Open*, or run
> `xattr -dr com.apple.quarantine "/Applications/BuckthornOrbit.app"`.

## Sharing it (real `brew install` for others)

To let anyone run `brew install <you>/tandem/buckthorn-orbit`:

1. **Publish the artifact.** Push this repo to GitHub, create a Release, and
   attach `dist/BuckthornOrbit-<version>-arm64.dmg`.
2. **Point the cask at it.** In `Casks/buckthorn-orbit.rb` replace the local
   `file://` URL and `sha256` with the release URL + its hash:

   ```ruby
   version "0.1.0"
   sha256 "<shasum -a 256 of the dmg>"
   url "https://github.com/<you>/tandem/releases/download/v#{version}/BuckthornOrbit-#{version}-arm64.dmg"
   ```

3. **Publish the tap.** Create a public repo named `homebrew-tandem`, put the
   cask under `Casks/buckthorn-orbit.rb`, and push. Then anyone can:

   ```bash
   brew tap <you>/tandem
   brew install --cask buckthorn-orbit
   ```

## Notes

- The current build is **arm64-only** (`depends_on arch: :arm64`). For Intel,
  build on / cross-build for `x64` and publish a second DMG, or use a single
  universal build.
- For a smoother install, notarize the app with an Apple Developer ID; then the
  `xattr` quarantine removal isn't needed.

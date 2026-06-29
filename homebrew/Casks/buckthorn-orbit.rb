cask "buckthorn-orbit" do
  version "0.1.0"
  sha256 "bc7ad0ab8be39b67dec0174eef62872841f470a1740a9931c293542fb9db578e"

  # Local build produced by `npm run dist`. For a shared/public release,
  # replace this with a GitHub Releases URL (see homebrew/README.md).
  url "file:///Users/maheshsv/PycharmProjects/pythonProject/tandem/dist/BuckthornOrbit-#{version}-arm64.dmg"
  name "Buckthorn Orbit"
  desc "Unified glass workspace — browser, terminal, code, and canvas in one window"
  homepage "https://github.com/maheshsv/tandem"

  depends_on arch: :arm64
  depends_on formula: "code-server" # powers the in-app VS Code "Code" tab

  app "BuckthornOrbit.app"

  caveats <<~EOS
    Buckthorn Orbit is ad-hoc signed (not notarized). On first launch macOS may block it:
      • Right-click Buckthorn Orbit in /Applications and choose "Open", or
      • Run: xattr -dr com.apple.quarantine "/Applications/BuckthornOrbit.app"
  EOS
end

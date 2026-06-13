cask "tandem" do
  version "0.1.0"
  sha256 "9711815ce9b3d16a263c34957792703bebf0b80ccfd1c654d400d36f1e90a14e"

  # Local build produced by `npm run dist`. For a shared/public release,
  # replace this with a GitHub Releases URL (see homebrew/README.md).
  url "file:///Users/maheshsv/PycharmProjects/pythonProject/tandem/dist/Tandem-#{version}-arm64.dmg"
  name "Tandem"
  desc "Embedded Chromium browser + Warp-style terminal in one window"
  homepage "https://github.com/maheshsv/tandem"

  depends_on arch: :arm64
  depends_on formula: "code-server" # powers the in-app VS Code "Code" tab

  app "Tandem.app"

  caveats <<~EOS
    Tandem is ad-hoc signed (not notarized). On first launch macOS may block it:
      • Right-click Tandem in /Applications and choose "Open", or
      • Run: xattr -dr com.apple.quarantine "/Applications/Tandem.app"
  EOS
end

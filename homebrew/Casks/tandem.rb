cask "tandem" do
  version "0.1.0"
  sha256 "0364124e9f6a5a7e4a7c25a92f56d295f9fd234a27bfe624a607f2a19d29e8d2"

  # Local build produced by `npm run dist`. For a shared/public release,
  # replace this with a GitHub Releases URL (see homebrew/README.md).
  url "file:///Users/maheshsv/PycharmProjects/pythonProject/tandem/dist/Tandem-#{version}-arm64.dmg"
  name "Tandem"
  desc "Embedded Chromium browser + Warp-style terminal in one window"
  homepage "https://github.com/maheshsv/tandem"

  depends_on arch: :arm64

  app "Tandem.app"

  caveats <<~EOS
    Tandem is ad-hoc signed (not notarized). On first launch macOS may block it:
      • Right-click Tandem in /Applications and choose "Open", or
      • Run: xattr -dr com.apple.quarantine "/Applications/Tandem.app"
  EOS
end

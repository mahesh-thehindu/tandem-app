cask "tandem" do
  version "0.1.0"
  sha256 "db6e7b8de0a67da61d36aa3dda350fd126eb0e8d399e1df19e8dc7d282fb3c3a"

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

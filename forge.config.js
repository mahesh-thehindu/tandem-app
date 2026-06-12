'use strict';

// electron-forge automatically rebuilds native modules (node-pty) against
// Electron's ABI on `npm start`. The auto-unpack-natives plugin keeps the
// compiled .node binary outside the asar archive so it loads when packaged.
module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Tandem',
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-dmg', config: {} },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
  ],
  plugins: [
    { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
  ],
};

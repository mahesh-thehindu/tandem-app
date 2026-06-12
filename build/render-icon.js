'use strict';
// Rasterize build/icon.svg -> build/icon.png (1024) using Electron's Chromium,
// on a transparent window so the squircle's corners stay transparent.
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false },
  });

  win.loadFile(path.join(__dirname, '_icon.html'));

  win.webContents.on('did-finish-load', async () => {
    await new Promise((r) => setTimeout(r, 500)); // let fonts settle
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
    fs.writeFileSync(path.join(__dirname, 'icon.png'), img.toPNG());
    console.log('icon.png written');
    app.quit();
  });
});

setTimeout(() => app.quit(), 12000);

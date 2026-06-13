'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

const WINDOW_DEFAULTS = {
  width: 1320,
  height: 860,
  minWidth: 860,
  minHeight: 540,
};

// Single source of truth for window creation — used by app startup and the
// "New Window" menu item alike.
function createWindow() {
  const win = new BrowserWindow({
    ...WINDOW_DEFAULTS,
    backgroundColor: '#0e0e13',
    titleBarStyle: 'hiddenInset', // macOS: keep traffic lights, reclaim the bar
    trafficLightPosition: { x: 20, y: 17 }, // center the lights in the 46px top bar
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

module.exports = { createWindow };

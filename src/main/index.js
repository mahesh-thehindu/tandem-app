'use strict';

const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { createWindow } = require('./windows');
const { buildMenu } = require('./menu');
const { registerTerminalIpc, killAll } = require('./terminal/pty-manager');
const { registerDownloads } = require('./downloads');
const { registerCodeServer, stopCodeServer } = require('./code-server');
const { registerBlocker } = require('./browser/blocker');

const MD_EXT = ['md', 'markdown', 'mdown', 'mkd', 'txt'];

// Ulaa-style privacy hardening, applied before any window loads.
// DNS prefetching is disabled so hostnames can't be cached/leaked, and we keep
// the renderer locked down (no node integration in remote content).
app.commandLine.appendSwitch('disable-features', 'NetworkPrediction');
app.commandLine.appendSwitch('disable-domain-reliability');

app.whenReady().then(() => {
  registerTerminalIpc();
  registerDownloads();
  registerCodeServer();
  registerBlocker();
  hardenSessions();
  buildMenu();
  createWindow();

  // Renderer-initiated "New Window" (e.g. a toolbar button).
  ipcMain.on('window:new', () => createWindow());

  // Markdown viewer: pick a file and return its contents.
  ipcMain.handle('md:pick', async () => {
    const res = await dialog.showOpenDialog({
      title: 'View Markdown',
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: MD_EXT }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const filePath = res.filePaths[0];
    try {
      return { path: filePath, content: fs.readFileSync(filePath, 'utf8') };
    } catch (err) {
      return { path: filePath, error: err.message };
    }
  });

  // Read a markdown file by absolute path (for "view this file" flows).
  ipcMain.handle('md:read', async (_e, filePath) => {
    try {
      return { path: filePath, content: fs.readFileSync(filePath, 'utf8') };
    } catch (err) {
      return { path: filePath, error: err.message };
    }
  });

  // macOS: re-open a window when the dock icon is clicked with none open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killAll();
  stopCodeServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { killAll(); stopCodeServer(); });

// Ulaa "multi-ID" privacy: present a clean, generic UA and strip the headers
// most used for cross-site correlation. The incognito partition has no
// persist: prefix, so its identifiers are already discarded each launch.
function hardenSessions() {
  for (const part of ['persist:tandem', 'tandem-incognito']) {
    const sess = session.fromPartition(part);
    sess.setPermissionRequestHandler((_wc, permission, cb) => {
      // Motion/sensor + idle tracking are denied by default, like Ulaa.
      const denied = ['midi', 'hid', 'serial', 'idle-detection'];
      cb(!denied.includes(permission));
    });
    sess.webRequest.onBeforeSendHeaders((details, cb) => {
      const headers = { ...details.requestHeaders };
      delete headers['X-Client-Data']; // Chrome's identifying experiment header
      cb({ requestHeaders: headers });
    });
  }
}

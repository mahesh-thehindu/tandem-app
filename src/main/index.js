'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const { createWindow } = require('./windows');
const { buildMenu } = require('./menu');
const { registerTerminalIpc, killAll } = require('./terminal/pty-manager');
const { registerDownloads } = require('./downloads');

app.whenReady().then(() => {
  registerTerminalIpc();
  registerDownloads();
  buildMenu();
  createWindow();

  // Renderer-initiated "New Window" (e.g. a toolbar button).
  ipcMain.on('window:new', () => createWindow());

  // macOS: re-open a window when the dock icon is clicked with none open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', killAll);

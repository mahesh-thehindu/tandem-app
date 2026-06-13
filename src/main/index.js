'use strict';

const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { createWindow } = require('./windows');
const { buildMenu } = require('./menu');
const { registerTerminalIpc, killAll } = require('./terminal/pty-manager');
const { registerDownloads } = require('./downloads');
const { registerCodeServer, stopCodeServer } = require('./code-server');

const MD_EXT = ['md', 'markdown', 'mdown', 'mkd', 'txt'];

app.whenReady().then(() => {
  registerTerminalIpc();
  registerDownloads();
  registerCodeServer();
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

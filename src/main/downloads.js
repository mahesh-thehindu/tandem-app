'use strict';

const { session, ipcMain, BrowserWindow, shell } = require('electron');

// Real downloads for the embedded Chromium. webviews use these partitions, so
// we hook each partition's session and stream progress to the renderer.
const PARTITIONS = ['persist:tandem', 'tandem-incognito'];

let seq = 0;
const items = new Map(); // id -> Electron DownloadItem (kept for open/show/cancel)

function broadcast(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.webContents.isDestroyed()) w.webContents.send(channel, payload);
  }
}

function attach(ses) {
  ses.on('will-download', (_event, item) => {
    const id = `dl-${++seq}`;
    items.set(id, item);
    broadcast('download:started', {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      total: item.getTotalBytes(),
    });

    item.on('updated', (_e, state) => {
      broadcast('download:updated', {
        id,
        received: item.getReceivedBytes(),
        total: item.getTotalBytes(),
        state, // 'progressing' | 'interrupted'
        paused: item.isPaused(),
      });
    });

    item.once('done', (_e, state) => {
      broadcast('download:done', { id, state, path: item.getSavePath() }); // 'completed' | 'cancelled' | 'interrupted'
    });
  });
}

function registerDownloads() {
  for (const p of PARTITIONS) attach(session.fromPartition(p));

  ipcMain.on('download:open', (_e, { path }) => { if (path) shell.openPath(path); });
  ipcMain.on('download:show', (_e, { path }) => { if (path) shell.showItemInFolder(path); });
  ipcMain.on('download:cancel', (_e, { id }) => { const it = items.get(id); if (it) it.cancel(); });
}

module.exports = { registerDownloads };

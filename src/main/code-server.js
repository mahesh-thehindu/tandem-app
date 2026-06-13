'use strict';

const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const { app, ipcMain, dialog } = require('electron');

// Runs a local code-server (real VS Code) and serves a folder over loopback,
// which the renderer loads in a <webview>. One server at a time; reused when
// the same folder is reopened.

const BIN_CANDIDATES = [
  '/opt/homebrew/bin/code-server',
  '/usr/local/bin/code-server',
  '/opt/homebrew/opt/code-server/bin/code-server',
];

let proc = null;
let current = null; // { port, folder, url }

function findBinary() {
  for (const c of BIN_CANDIDATES) {
    try { if (fs.existsSync(c)) return c; } catch (_e) { /* skip */ }
  }
  return 'code-server'; // fall back to PATH
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitUntilUp(port, timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.destroy();
        resolve(); // any HTTP response means it's listening
      });
      req.on('error', () => (Date.now() - start > timeoutMs ? reject(new Error('code-server did not start in time')) : setTimeout(attempt, 400)));
      req.on('timeout', () => { req.destroy(); (Date.now() - start > timeoutMs ? reject(new Error('timeout')) : setTimeout(attempt, 400)); });
    };
    attempt();
  });
}

function stop() {
  if (proc) { try { proc.kill(); } catch (_e) { /* noop */ } proc = null; }
  current = null;
}

async function start(folder) {
  if (current && current.folder === folder && proc) return current;
  stop();
  const port = await freePort();
  proc = spawn(findBinary(), [
    '--auth', 'none',
    '--disable-telemetry',
    '--disable-update-check',
    '--bind-addr', `127.0.0.1:${port}`,
    folder,
  ], { env: { ...process.env }, stdio: 'ignore' });
  proc.on('exit', () => { proc = null; });
  await waitUntilUp(port);
  current = { port, folder, url: `http://127.0.0.1:${port}/?folder=${encodeURIComponent(folder)}` };
  return current;
}

function registerCodeServer() {
  ipcMain.handle('code:open-folder', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Open Folder in Code',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    try {
      return await start(res.filePaths[0]);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('code:status', async () => current);

  app.on('before-quit', stop);
  app.on('will-quit', stop);
}

module.exports = { registerCodeServer, stopCodeServer: stop };

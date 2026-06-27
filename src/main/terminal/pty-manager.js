'use strict';

const os = require('os');
const pty = require('node-pty');
const { ipcMain } = require('electron');
const { getDefaultShell, getShellArgs } = require('./shell');
const { integrationEnv } = require('./shell-integration');

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

// Live pty sessions keyed by an id the renderer assigns.
// A Map (not an object) keeps insertion order and clean delete semantics.
const sessions = new Map();

function createSession(webContents, { id, cols, rows }) {
  if (sessions.has(id)) return;

  const shell = getDefaultShell();
  const proc = pty.spawn(shell, getShellArgs(), {
    name: 'xterm-256color',
    cols: cols || DEFAULT_COLS,
    rows: rows || DEFAULT_ROWS,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM_PROGRAM: 'BuckthornOrbit',
      COLORTERM: 'truecolor', // advertise 24-bit color so prompts render vivid, not grey
      CLICOLOR: '1', // colorize macOS/BSD ls
      FORCE_COLOR: '1', // colorize node-based CLIs (npm, etc.)
      ...integrationEnv(shell),
    },
  });

  proc.onData((data) => {
    if (!webContents.isDestroyed()) {
      webContents.send('terminal:data', { id, data });
    }
  });

  proc.onExit(({ exitCode }) => {
    if (!webContents.isDestroyed()) {
      webContents.send('terminal:exit', { id, exitCode });
    }
    sessions.delete(id);
  });

  sessions.set(id, proc);
}

function registerTerminalIpc() {
  ipcMain.on('terminal:create', (event, payload) => {
    createSession(event.sender, payload);
  });

  ipcMain.on('terminal:input', (_event, { id, data }) => {
    const proc = sessions.get(id);
    if (proc) proc.write(data);
  });

  ipcMain.on('terminal:resize', (_event, { id, cols, rows }) => {
    const proc = sessions.get(id);
    if (!proc) return;
    try {
      proc.resize(cols, rows);
    } catch (_err) {
      // Resize can race with exit; a stale resize is harmless to drop.
    }
  });

  ipcMain.on('terminal:kill', (_event, { id }) => {
    const proc = sessions.get(id);
    if (proc) {
      proc.kill();
      sessions.delete(id);
    }
  });
}

function killAll() {
  for (const proc of sessions.values()) {
    try {
      proc.kill();
    } catch (_err) {
      // Best-effort cleanup on quit.
    }
  }
  sessions.clear();
}

module.exports = { registerTerminalIpc, killAll };

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The only bridge between the isolated renderer and the main process.
// Keeping this surface small and explicit is what lets contextIsolation stay on.
contextBridge.exposeInMainWorld('tandem', {
  platform: process.platform,

  terminal: {
    create: (payload) => ipcRenderer.send('terminal:create', payload),
    write: (id, data) => ipcRenderer.send('terminal:input', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.send('terminal:kill', { id }),
    onData: (cb) => {
      const handler = (_event, msg) => cb(msg);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
    onExit: (cb) => {
      const handler = (_event, msg) => cb(msg);
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    },
  },

  window: {
    newWindow: () => ipcRenderer.send('window:new'),
  },

  // Native menu bar -> renderer action routing.
  menu: {
    onCommand: (cb) => {
      const handler = (_event, msg) => cb(msg);
      ipcRenderer.on('menu:command', handler);
      return () => ipcRenderer.removeListener('menu:command', handler);
    },
  },
});

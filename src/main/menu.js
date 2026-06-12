'use strict';

const { Menu, app, shell, BrowserWindow } = require('electron');
const { createWindow } = require('./windows');

// Forward a UI action to the focused renderer. The renderer's dispatch()
// decides what each action does (see js/app.js).
function send(action) {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('menu:command', { action });
}

// A native macOS menu bar that merges Chromium's menus (File/Edit/View/History/
// Bookmarks) with Warp's terminal menus (sessions, clear, palette).
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('app:settings') },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => send('browser:new-tab') },
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        {
          label: 'New Terminal Session',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => send('terminal:new-session'),
        },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('browser:close-tab') },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => send('browser:find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Show Browser', accelerator: 'CmdOrCtrl+1', click: () => send('view:browser') },
        { label: 'Show Terminal', accelerator: 'CmdOrCtrl+2', click: () => send('view:terminal') },
        { type: 'separator' },
        { label: 'Reload Page', accelerator: 'CmdOrCtrl+R', click: () => send('browser:reload') },
        {
          label: 'Toggle Bookmarks Bar',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => send('browser:toggle-bookmarks'),
        },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => send('browser:zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('browser:zoom-out') },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => send('browser:zoom-reset') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+Left', click: () => send('browser:back') },
        { label: 'Forward', accelerator: 'CmdOrCtrl+Right', click: () => send('browser:forward') },
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('browser:home') },
        { type: 'separator' },
        { label: 'Show Full History', click: () => send('browser:history') },
      ],
    },
    {
      label: 'Bookmarks',
      submenu: [
        { label: 'Bookmark This Tab', accelerator: 'CmdOrCtrl+D', click: () => send('browser:bookmark') },
        { label: 'Show Bookmarks Bar', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('browser:toggle-bookmarks') },
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        { label: 'New Session', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('terminal:new-session') },
        { label: 'Clear Session', accelerator: 'CmdOrCtrl+K', click: () => send('terminal:clear') },
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+P', click: () => send('palette:open') },
        { type: 'separator' },
        { label: 'Close Session', click: () => send('terminal:close-session') },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Tandem on GitHub', click: () => shell.openExternal('https://github.com') },
        { label: 'Keyboard Shortcuts', click: () => send('palette:open') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };

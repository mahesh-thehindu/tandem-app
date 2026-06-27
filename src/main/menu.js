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
        { label: 'New Incognito Tab', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('browser:new-incognito') },
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        {
          label: 'New Terminal Session',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => send('terminal:new-session'),
        },
        { type: 'separator' },
        { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('browser:reopen-tab') },
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
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => send('find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Show Browser', accelerator: 'CmdOrCtrl+1', click: () => send('view:browser') },
        { label: 'Show Terminal', accelerator: 'CmdOrCtrl+2', click: () => send('view:terminal') },
        { label: 'Show Code', accelerator: 'CmdOrCtrl+3', click: () => send('view:code') },
        { label: 'Show Canvas', accelerator: 'CmdOrCtrl+4', click: () => send('view:draw') },
        { label: 'Open Folder in Code…', click: () => send('code:open-folder') },
        { label: 'New Canvas', click: () => send('draw:new') },
        { type: 'separator' },
        { label: 'Reload Page', accelerator: 'CmdOrCtrl+R', click: () => send('browser:reload') },
        { label: 'Downloads', accelerator: 'CmdOrCtrl+Shift+J', click: () => send('browser:downloads') },
        { label: 'View Source', accelerator: 'CmdOrCtrl+Alt+U', click: () => send('browser:view-source') },
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
        { label: 'Developer Tools', accelerator: 'CmdOrCtrl+Alt+I', click: () => send('browser:devtools') },
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
        { label: 'Bookmark This Tab', click: () => send('browser:bookmark') },
        { label: 'Show Bookmarks Bar', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('browser:toggle-bookmarks') },
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        { label: 'New Session', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('terminal:new-session') },
        { label: 'Clear Session', accelerator: 'CmdOrCtrl+K', click: () => send('terminal:clear') },
        { label: 'Close Session', click: () => send('terminal:close-session') },
        { type: 'separator' },
        { label: 'Split Right', accelerator: 'CmdOrCtrl+D', click: () => send('cmd-d') },
        { label: 'Split Down', accelerator: 'CmdOrCtrl+Shift+D', click: () => send('terminal:split-down') },
        { label: 'Focus Next Pane', accelerator: 'CmdOrCtrl+]', click: () => send('terminal:focus-pane') },
        { label: 'Close Pane', accelerator: 'CmdOrCtrl+Shift+W', click: () => send('cmd-shift-w') },
        { type: 'separator' },
        { label: 'Jump to Previous Command', accelerator: 'CmdOrCtrl+Up', click: () => send('cmd-up') },
        { label: 'Jump to Next Command', accelerator: 'CmdOrCtrl+Down', click: () => send('cmd-down') },
        { label: 'Copy Last Command Output', click: () => send('terminal:copy-output') },
        { type: 'separator' },
        { label: 'Bookmark Command', accelerator: 'CmdOrCtrl+Shift+K', click: () => send('terminal:bookmark-command') },
        { label: 'Command Bookmarks…', click: () => send('terminal:command-bookmarks') },
        { label: 'View Markdown File…', click: () => send('md:view') },
        { type: 'separator' },
        { label: 'Cycle Theme', click: () => send('terminal:theme') },
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+P', click: () => send('palette:open') },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Buckthorn Orbit on GitHub', click: () => shell.openExternal('https://github.com') },
        { label: 'Keyboard Shortcuts', click: () => send('palette:open') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };

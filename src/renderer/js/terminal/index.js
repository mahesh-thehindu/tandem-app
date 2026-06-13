'use strict';

import { Session } from './session.js';

// Curated terminal themes (xterm theme objects).
const THEMES = {
  'Tokyo Night': {
    background: '#16161d', foreground: '#c0caf5', cursor: '#4fd6b8', cursorAccent: '#16161d',
    selectionBackground: '#283457', black: '#15161e', red: '#f7768e', green: '#9ece6a',
    yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
    brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68',
    brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5',
  },
  'Warp Dark': {
    background: '#1e2128', foreground: '#d6dae0', cursor: '#6d9bff', cursorAccent: '#1e2128',
    selectionBackground: '#33405a', black: '#1e2128', red: '#ff6b6b', green: '#4fd6b8',
    yellow: '#ffcf6b', blue: '#6d9bff', magenta: '#c39bff', cyan: '#6be7e0', white: '#d6dae0',
    brightBlack: '#6f7488', brightRed: '#ff8585', brightGreen: '#7ee8d0', brightYellow: '#ffe09a',
    brightBlue: '#9dbcff', brightMagenta: '#d6bcff', brightCyan: '#9af0e8', brightWhite: '#ffffff',
  },
  'Solarized Dark': {
    background: '#002b36', foreground: '#93a1a1', cursor: '#93a1a1', cursorAccent: '#002b36',
    selectionBackground: '#073642', black: '#073642', red: '#dc322f', green: '#859900',
    yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#586e75', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
  },
  'Snow (Light)': {
    background: '#f7f8fb', foreground: '#2b2f38', cursor: '#6d9bff', cursorAccent: '#f7f8fb',
    selectionBackground: '#cfe0ff', black: '#2b2f38', red: '#d11d4b', green: '#1a8f5e',
    yellow: '#9a6a00', blue: '#2563c9', magenta: '#9334e6', cyan: '#0e8aa0', white: '#dfe3ea',
    brightBlack: '#8a8f9a', brightRed: '#e0436a', brightGreen: '#23a06c', brightYellow: '#b07d00',
    brightBlue: '#3b78e0', brightMagenta: '#a04ff0', brightCyan: '#1aa0b8', brightWhite: '#ffffff',
  },
};
const THEME_NAMES = Object.keys(THEMES);
const FONT_MIN = 9;
const FONT_MAX = 22;

export function initTerminal(root, ctx) {
  const els = {
    // Session tabs live in the shared #topbar (outside this root).
    tabs: document.getElementById('warp-tabs'),
    newTab: document.getElementById('warp-newtab'),
    surface: root.querySelector('#warp-sessions'),
  };

  const shellName =
    window.tandem.platform === 'win32' ? 'powershell' : (window.tandem.platform === 'darwin' ? 'zsh' : 'bash');

  const api = window.tandem.terminal;
  const panesById = new Map(); // ptyId -> Pane (for data routing)
  const sessions = new Map(); // sessionEl id -> { session, tabEl }
  let activeKey = null;
  let themeName = THEME_NAMES[0];
  let fontSize = 13;
  let seq = 0;

  api.onData(({ id, data }) => panesById.get(id)?.write(data));
  api.onExit(({ id }) => panesById.get(id)?.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n'));

  const sessionCtx = {
    api,
    shellName,
    theme: () => THEMES[themeName],
    fontSize: () => fontSize,
    openUrl: ctx.openUrl,
    toast: ctx.toast,
    showContextMenu: ctx.showContextMenu,
    bookmarkCommand: (text) => addBookmark(text),
    registerPane: (p) => panesById.set(p.id, p),
    unregisterPane: (p) => panesById.delete(p.id),
    onEmpty: (s) => closeSession(keyOf(s)),
  };

  /* ---- command bookmarks (persisted) ---- */

  const BM_KEY = 'tandem:cmd-bookmarks';
  let bookmarks = loadBookmarks();
  function loadBookmarks() { try { return JSON.parse(localStorage.getItem(BM_KEY)) || []; } catch { return []; } }
  function saveBookmarks() { localStorage.setItem(BM_KEY, JSON.stringify(bookmarks)); }
  function addBookmark(text) {
    const t = (text || '').trim();
    if (!t) { ctx.toast('Nothing to bookmark'); return; }
    if (!bookmarks.includes(t)) {
      bookmarks.unshift(t);
      if (bookmarks.length > 100) bookmarks.pop();
      saveBookmarks();
    }
    ctx.toast('Command bookmarked');
    if (ctx.currentPanel && ctx.currentPanel() === 'Command Bookmarks') showBookmarks();
  }
  function removeBookmark(t) { bookmarks = bookmarks.filter((b) => b !== t); saveBookmarks(); showBookmarks(); }

  function showBookmarks() {
    ctx.showPanel('Command Bookmarks', (body) => {
      if (!bookmarks.length) { body.innerHTML = '<div class="panel-empty">No bookmarked commands yet.<br><small>Right-click a terminal → “Bookmark command”.</small></div>'; return; }
      for (const cmd of bookmarks) {
        const row = document.createElement('div');
        row.className = 'bm-row';
        row.innerHTML = `<code class="bm-cmd"></code>
          <div class="bm-actions">
            <button class="dl-act" data-a="run">Run</button>
            <button class="dl-act" data-a="insert">Insert</button>
            <button class="dl-act" data-a="del" title="Delete">✕</button>
          </div>`;
        row.querySelector('.bm-cmd').textContent = cmd;
        row.querySelector('[data-a="run"]').addEventListener('click', () => { active()?.typeIntoActive(cmd + '\r'); ctx.hidePanel(); });
        row.querySelector('[data-a="insert"]').addEventListener('click', () => { active()?.typeIntoActive(cmd); ctx.hidePanel(); });
        row.querySelector('[data-a="del"]').addEventListener('click', () => removeBookmark(cmd));
        body.appendChild(row);
      }
    });
  }

  function keyOf(session) {
    for (const [k, v] of sessions) if (v.session === session) return k;
    return null;
  }

  function createSession() {
    const key = `sess-${++seq}`;
    const session = new Session(sessionCtx).mount();
    els.surface.appendChild(session.el);

    const tabEl = document.createElement('button');
    tabEl.className = 'warp-tab';
    tabEl.innerHTML = `<span class="wt-dot"></span><span class="wt-label">${shellName} ${session.num}</span><span class="wt-close" title="Close">✕</span>`;
    tabEl.addEventListener('click', (e) => {
      if (e.target.closest('.wt-close')) { closeSession(key); return; }
      activateSession(key);
    });
    els.tabs.appendChild(tabEl);

    sessions.set(key, { session, tabEl });
    activateSession(key);
    return key;
  }

  function activateSession(key) {
    const entry = sessions.get(key);
    if (!entry) return;
    activeKey = key;
    for (const [k, v] of sessions) {
      const on = k === key;
      v.session.el.classList.toggle('is-hidden', !on);
      v.tabEl.classList.toggle('is-active', on);
    }
    entry.session.activate();
  }

  function closeSession(key) {
    const entry = sessions.get(key);
    if (!entry) return;
    const keys = [...sessions.keys()];
    const idx = keys.indexOf(key);
    entry.session.dispose();
    entry.tabEl.remove();
    sessions.delete(key);
    if (sessions.size === 0) { createSession(); return; }
    if (activeKey === key) activateSession(keys[idx + 1] || keys[idx - 1]);
  }

  function active() { return sessions.get(activeKey)?.session; }

  /* ---- themes + zoom ---- */

  function applyTheme() { for (const { session } of sessions.values()) session.setTheme(THEMES[themeName]); }
  function cycleTheme() {
    themeName = THEME_NAMES[(THEME_NAMES.indexOf(themeName) + 1) % THEME_NAMES.length];
    applyTheme();
    ctx.toast(`Theme: ${themeName}`);
  }
  function setTheme(name) { if (THEMES[name]) { themeName = name; applyTheme(); ctx.toast(`Theme: ${name}`); } }
  function zoom(delta) {
    fontSize = Math.max(FONT_MIN, Math.min(FONT_MAX, delta === 0 ? 13 : fontSize + delta));
    for (const { session } of sessions.values()) session.setFontSize(fontSize);
  }

  els.newTab?.addEventListener('click', () => createSession()); // legacy + (now the unified +)
  window.addEventListener('resize', () => { if (!root.classList.contains('is-hidden')) active()?.fitAll(); });

  function handleCommand(action) {
    const s = active();
    switch (action) {
      case 'terminal:new-session': createSession(); break;
      case 'terminal:close-session': if (activeKey) closeSession(activeKey); break;
      case 'terminal:clear': s?.clear(); break;
      case 'terminal:split-right': s?.split('row'); break;
      case 'terminal:split-down': s?.split('col'); break;
      case 'terminal:close-pane': s?.closePane(); break;
      case 'terminal:focus-pane': s?.focusNext(); break;
      case 'terminal:search': s?.find(); break;
      case 'terminal:prev-command': s?.jump(-1); break;
      case 'terminal:next-command': s?.jump(1); break;
      case 'terminal:copy-output': s?.copyOutput(); break;
      case 'terminal:bookmark-command': addBookmark(s?.currentCommand()); break;
      case 'terminal:command-bookmarks': showBookmarks(); break;
      case 'terminal:theme': cycleTheme(); break;
      case 'terminal:zoom-in': zoom(1); break;
      case 'terminal:zoom-out': zoom(-1); break;
      case 'terminal:zoom-reset': zoom(0); break;
      default:
        if (action.startsWith('terminal:theme:')) setTheme(action.slice('terminal:theme:'.length));
        break;
    }
  }

  function activate() {
    // Sessions are created explicitly via the "+" menu; just refit/focus here.
    active()?.activate();
  }

  return { handleCommand, activate, themeNames: () => THEME_NAMES, currentTheme: () => themeName };
}

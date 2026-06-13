'use strict';

// Warp-style terminal surface: multiple sessions, each a real pty rendered
// with xterm inside a rounded "block" surface with a session header.

const THEME = {
  background: '#16161d',
  foreground: '#d7dbe8',
  cursor: '#4fd6b8',
  cursorAccent: '#16161d',
  selectionBackground: '#2c3a4d',
  black: '#1b1c24', red: '#ff6b6b', green: '#4fd6b8', yellow: '#ffcf6b',
  blue: '#6d9bff', magenta: '#c39bff', cyan: '#6be7e0', white: '#d7dbe8',
  brightBlack: '#6f7488', brightRed: '#ff8585', brightGreen: '#7ee8d0',
  brightYellow: '#ffe09a', brightBlue: '#9dbcff', brightMagenta: '#d6bcff',
  brightCyan: '#9af0e8', brightWhite: '#ffffff',
};

// Nerd Font first (Powerline + glyphs), then graceful fallbacks.
const FONT_STACK = '"MesloLGS NF", ui-monospace, "SF Mono", Menlo, monospace';
const FALLBACK_STACK = 'ui-monospace, "SF Mono", Menlo, monospace';

export function initTerminal(root, ctx) {
  const els = {
    tabs: root.querySelector('#warp-tabs'),
    newTab: root.querySelector('#warp-newtab'),
    sessions: root.querySelector('#warp-sessions'),
    menuBtn: root.querySelector('#warp-menu-btn'),
  };

  const shellName =
    window.tandem.platform === 'win32' ? 'powershell' : (window.tandem.platform === 'darwin' ? 'zsh' : 'bash');

  const sessions = new Map(); // id -> { id, term, fit, dom, tabDom }
  let activeId = null;
  let seq = 0;
  let booted = false;

  const api = window.tandem.terminal;
  // One shared data/exit subscription dispatches to the right session by id.
  api.onData(({ id, data }) => sessions.get(id)?.term.write(data));
  api.onExit(({ id }) => sessions.get(id)?.term.write('\r\n\x1b[90m[process exited — ⌘⇧T for a new session]\x1b[0m\r\n'));

  function createSession() {
    const id = `term-${++seq}`;

    const dom = document.createElement('div');
    dom.className = 'warp-session';
    dom.dataset.id = id;
    dom.innerHTML = `
      <div class="warp-session-head">
        <span class="wsh-dots"><i></i><i></i><i></i></span>
        <span class="wsh-title"><b>${shellName}</b> &nbsp;~</span>
        <span class="wsh-badge">live</span>
      </div>
      <div class="warp-term"></div>
      <div class="warp-hint">
        <span><kbd>⌘P</kbd> palette</span>
        <span><kbd>⌘K</kbd> clear</span>
        <span><kbd>⌘⇧T</kbd> new session</span>
      </div>`;
    els.sessions.appendChild(dom);

    const term = new window.Terminal({
      fontFamily: FALLBACK_STACK,
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      allowProposedApi: true,
      theme: THEME,
    });
    const fit = new window.FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(dom.querySelector('.warp-term'));
    fit.fit();

    // Swap to the Nerd Font once it has loaded so xterm rebuilds its glyph
    // atlas with the Powerline/Nerd glyphs available (avoids tofu).
    Promise.all([
      document.fonts.load('13px "MesloLGS NF"'),
      document.fonts.load('italic 13px "MesloLGS NF"'),
      document.fonts.load('700 13px "MesloLGS NF"'),
    ]).then(() => {
      try {
        term.options.fontFamily = FONT_STACK;
        fit.fit();
        api.resize(id, term.cols, term.rows);
      } catch (_e) { /* terminal may have been closed */ }
    });

    api.create({ id, cols: term.cols, rows: term.rows });
    term.onData((data) => api.write(id, data));

    const tabDom = document.createElement('button');
    tabDom.className = 'warp-tab';
    tabDom.dataset.id = id;
    tabDom.innerHTML = `<span class="wt-dot"></span><span class="wt-label">${shellName} ${seq}</span>
                        <span class="wt-close" title="Close">✕</span>`;
    tabDom.addEventListener('click', (e) => {
      if (e.target.closest('.wt-close')) { closeSession(id); return; }
      activateSession(id);
    });
    els.tabs.appendChild(tabDom);

    sessions.set(id, { id, term, fit, dom, tabDom });
    activateSession(id);
    return id;
  }

  function activateSession(id) {
    const s = sessions.get(id);
    if (!s) return;
    activeId = id;
    for (const other of sessions.values()) {
      const on = other.id === id;
      other.dom.classList.toggle('is-hidden', !on);
      other.tabDom.classList.toggle('is-active', on);
    }
    requestAnimationFrame(() => {
      s.fit.fit();
      api.resize(id, s.term.cols, s.term.rows);
      s.term.focus();
    });
  }

  function closeSession(id) {
    const s = sessions.get(id);
    if (!s) return;
    const ids = [...sessions.keys()];
    const idx = ids.indexOf(id);
    api.kill(id);
    s.term.dispose();
    s.dom.remove();
    s.tabDom.remove();
    sessions.delete(id);

    if (sessions.size === 0) { createSession(); return; }
    if (activeId === id) activateSession(ids[idx + 1] || ids[idx - 1]);
  }

  function refit() {
    const s = sessions.get(activeId);
    if (!s) return;
    s.fit.fit();
    api.resize(activeId, s.term.cols, s.term.rows);
  }

  window.addEventListener('resize', () => {
    if (!root.classList.contains('is-hidden')) refit();
  });

  els.newTab.addEventListener('click', () => createSession());

  function handleCommand(action) {
    switch (action) {
      case 'terminal:new-session': createSession(); break;
      case 'terminal:clear': sessions.get(activeId)?.term.clear(); break;
      case 'terminal:close-session': if (activeId) closeSession(activeId); break;
      default: break;
    }
  }

  function activate() {
    if (!booted) { createSession(); booted = true; }
    else refit();
    requestAnimationFrame(() => sessions.get(activeId)?.term.focus());
  }

  return { handleCommand, activate };
}

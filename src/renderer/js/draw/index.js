'use strict';

// Canvas mode: multiple independent drawing boards, each its own persistent
// scene (separate webview partition). Built on the open-source Excalidraw
// engine but presented entirely as "Canvas" — the engine's branding is
// stripped on load. Boards (names) persist across restarts.

const CANVAS_URL = 'https://excalidraw.com';
const BOARDS_KEY = 'tandem:canvas-boards';

const HIDE_CSS = `
  [class*="welcome-screen"] { display: none !important; }
  a[href*="excalidraw.com/plus"], a[href*="plus.excalidraw"] { display: none !important; }
`;
const SCRUB_JS = `(function () {
  function scrub() {
    document.querySelectorAll('button, a').forEach(function (el) {
      var t = (el.textContent || '').trim();
      if (/excalidraw/i.test(t) || t === 'Sign up') {
        var host = el.closest('.dropdown-menu-item, button, a, li') || el;
        host.style.display = 'none';
      }
    });
    if (/excalidraw/i.test(document.title)) document.title = 'Canvas';
  }
  scrub();
  try { new MutationObserver(scrub).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
})();`;

export function initDraw(root, ctx) {
  const stage = root.querySelector('#draw-stage');
  const empty = root.querySelector('#draw-empty');
  const tabsEl = document.getElementById('draw-tabs');

  let boards = load();
  const live = new Map(); // board id -> webview
  let activeId = null;

  function load() { try { return JSON.parse(localStorage.getItem(BOARDS_KEY)) || []; } catch { return []; } }
  function save() { localStorage.setItem(BOARDS_KEY, JSON.stringify(boards)); }

  function debrand(wv) {
    wv.insertCSS(HIDE_CSS).catch(() => {});
    wv.executeJavaScript(SCRUB_JS).catch(() => {});
  }

  function selectBoard(id) {
    const board = boards.find((b) => b.id === id);
    if (!board) return;
    activeId = id;
    if (!live.has(id)) {
      const wv = document.createElement('webview');
      wv.className = 'draw-webview';
      wv.setAttribute('partition', board.partition);
      wv.setAttribute('src', CANVAS_URL);
      wv.addEventListener('dom-ready', () => debrand(wv));
      wv.addEventListener('did-finish-load', () => debrand(wv));
      stage.appendChild(wv);
      live.set(id, wv);
    }
    for (const [bid, wv] of live) wv.classList.toggle('is-hidden', bid !== id);
    if (empty) empty.hidden = true;
    renderTabs();
  }

  function newBoard() {
    const n = boards.reduce((m, b) => Math.max(m, b.n || 0), 0) + 1;
    const id = `cv${Date.now().toString(36)}`;
    boards.push({ id, name: `Canvas ${n}`, partition: `persist:tandem-draw-${id}`, n });
    save();
    renderTabs();
    selectBoard(id);
  }

  function closeBoard(id) {
    const idx = boards.findIndex((b) => b.id === id);
    if (idx < 0) return;
    boards.splice(idx, 1);
    save();
    const wv = live.get(id);
    if (wv) { wv.remove(); live.delete(id); }
    if (activeId === id) {
      activeId = null;
      const next = boards[idx] || boards[idx - 1];
      if (next) selectBoard(next.id);
      else updateEmpty();
    }
    renderTabs();
  }

  function renameBoard(id, name) {
    const b = boards.find((x) => x.id === id);
    if (b && name) { b.name = name; save(); }
    renderTabs();
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const b of boards) {
      const pill = document.createElement('button');
      pill.className = 'draw-board' + (b.id === activeId ? ' is-active' : '');
      pill.innerHTML = `<span class="db-dot"></span><span class="db-name"></span><span class="db-close" title="Close">✕</span>`;
      pill.querySelector('.db-name').textContent = b.name;
      pill.addEventListener('click', (e) => {
        if (e.target.closest('.db-close')) { closeBoard(b.id); return; }
        selectBoard(b.id);
      });
      pill.addEventListener('dblclick', (e) => { e.stopPropagation(); startRename(b, pill); });
      tabsEl.appendChild(pill);
    }
  }

  function startRename(b, pill) {
    const nameEl = pill.querySelector('.db-name');
    const input = document.createElement('input');
    input.className = 'db-rename';
    input.value = b.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => renameBoard(b.id, input.value.trim());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') renderTabs(); });
    input.addEventListener('blur', commit);
  }

  function updateEmpty() { if (empty) empty.hidden = activeId !== null; }

  document.getElementById('draw-newboard')?.addEventListener('click', newBoard);
  root.querySelector('#draw-new-cta')?.addEventListener('click', newBoard);

  function handleCommand(action) {
    if (action === 'draw:new') newBoard();
  }
  function activate() {
    if (activeId == null && boards.length) selectBoard(boards[0].id);
    else if (activeId) live.get(activeId)?.focus();
    updateEmpty();
  }

  renderTabs(); // show any persisted boards in the title bar

  return { handleCommand, activate, hasBoard: () => boards.length > 0 };
}

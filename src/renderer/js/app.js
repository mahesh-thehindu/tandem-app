'use strict';

import { initBrowser } from './browser.js';
import { initTerminal } from './terminal.js';

const browserRoot = document.getElementById('browser-mode');
const terminalRoot = document.getElementById('terminal-mode');

/* ---------------- Toast ---------------- */

const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastEl.hidden = true; }, 240);
  }, 1800);
}

/* ---------------- Slide-over panel ---------------- */

const panelScrim = document.getElementById('panel');
const panelTitle = document.getElementById('panel-title');
const panelBody = document.getElementById('panel-body');

function showPanel(title, fill) {
  panelTitle.textContent = title;
  panelBody.innerHTML = '';
  fill(panelBody);
  panelScrim.hidden = false;
}
function hidePanel() {
  panelScrim.hidden = true;
}
panelScrim.addEventListener('mousedown', (e) => { if (e.target === panelScrim) hidePanel(); });
document.getElementById('panel-close').addEventListener('click', hidePanel);

/* ---------------- Context shared with feature modules ---------------- */

const ctx = { dispatch, toast, showPanel, hidePanel };

const browser = initBrowser(browserRoot, ctx);
const terminal = initTerminal(terminalRoot, ctx);

/* ---------------- Mode switching ---------------- */

let mode = 'browser';
function setMode(next) {
  if (next === mode) {
    (next === 'browser' ? browser : terminal).activate();
    return;
  }
  mode = next;
  browserRoot.classList.toggle('is-hidden', next !== 'browser');
  terminalRoot.classList.toggle('is-hidden', next !== 'terminal');
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === next));
  (next === 'browser' ? browser : terminal).activate();
}
document.querySelectorAll('.mode-btn').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
});

/* ---------------- Central action router ---------------- */

function dispatch(action) {
  closeDropdowns();
  if (action.startsWith('view:')) { setMode(action.slice(5)); return; }
  if (action === 'palette:open') { openPalette(); return; }
  if (action === 'window:new') { window.tandem.window.newWindow(); return; }
  if (action === 'app:settings') { showSettings(); return; }
  if (action.startsWith('stub:')) { toast(`${labelOf(action)} — coming soon`); return; }
  if (action.startsWith('browser:')) {
    if (mode !== 'browser') setMode('browser');
    browser.handleCommand(action);
    return;
  }
  if (action.startsWith('terminal:')) {
    if (mode !== 'terminal') setMode('terminal');
    terminal.handleCommand(action);
  }
}

function labelOf(action) {
  return action.split(':')[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Native menu bar -> dispatch.
window.tandem.menu.onCommand(({ action }) => dispatch(action));

/* ---------------- Dropdown menus (Chrome ⋮ + Warp) ---------------- */

const chromeMenuEl = document.getElementById('chrome-menu');
const warpMenuEl = document.getElementById('warp-menu');

const CHROME_MENU = [
  { label: 'New tab', key: '⌘T', action: 'browser:new-tab' },
  { label: 'New window', key: '⌘N', action: 'window:new' },
  { sep: true },
  { label: 'History', action: 'browser:history' },
  { label: 'Downloads', key: '⌘⇧J', action: 'stub:downloads' },
  { label: 'Bookmark this tab', key: '⌘D', action: 'browser:bookmark' },
  { label: 'Show bookmarks bar', key: '⌘⇧B', action: 'browser:toggle-bookmarks' },
  { sep: true },
  { zoom: true },
  { label: 'Find…', key: '⌘F', action: 'browser:find' },
  { label: 'Print…', key: '⌘P', action: 'stub:print' },
  { sep: true },
  { label: 'Settings', action: 'app:settings' },
  { label: 'Help', action: 'stub:help' },
];

const WARP_MENU = [
  { section: 'Session' },
  { label: 'New session', key: '⌘⇧T', action: 'terminal:new-session' },
  { label: 'Clear session', key: '⌘K', action: 'terminal:clear' },
  { label: 'Close session', action: 'terminal:close-session' },
  { sep: true },
  { label: 'Command palette…', key: '⌘P', action: 'palette:open' },
  { label: 'Split pane right', action: 'stub:split' },
  { sep: true },
  { label: 'Settings', action: 'app:settings' },
];

function renderMenu(el, spec) {
  el.innerHTML = '';
  for (const item of spec) {
    if (item.sep) { el.appendChild(div('menu-sep')); continue; }
    if (item.section) { const s = div('menu-section'); s.textContent = item.section; el.appendChild(s); continue; }
    if (item.zoom) { el.appendChild(buildZoomRow()); continue; }
    const btn = document.createElement('button');
    btn.className = 'menu-item';
    btn.innerHTML = `<span class="mi-ico"></span><span class="mi-label">${item.label}</span>
                     ${item.key ? `<span class="mi-key">${item.key}</span>` : ''}`;
    btn.addEventListener('click', () => dispatch(item.action));
    el.appendChild(btn);
  }
}

function buildZoomRow() {
  const row = div('menu-zoom');
  row.innerHTML = `<span class="mz-label">Zoom</span>
    <button class="mz-btn" data-z="out">−</button>
    <span class="mz-val">${browser.zoomPercent()}%</span>
    <button class="mz-btn" data-z="in">+</button>`;
  const val = row.querySelector('.mz-val');
  row.querySelector('[data-z="out"]').addEventListener('click', (e) => {
    e.stopPropagation(); browser.handleCommand('browser:zoom-out'); val.textContent = `${browser.zoomPercent()}%`;
  });
  row.querySelector('[data-z="in"]').addEventListener('click', (e) => {
    e.stopPropagation(); browser.handleCommand('browser:zoom-in'); val.textContent = `${browser.zoomPercent()}%`;
  });
  return row;
}

function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }

function openDropdown(el, anchor) {
  closeDropdowns();
  el.hidden = false;
  const r = anchor.getBoundingClientRect();
  el.style.top = `${r.bottom + 6}px`;
  el.style.right = `${window.innerWidth - r.right}px`;
}
function closeDropdowns() {
  chromeMenuEl.hidden = true;
  warpMenuEl.hidden = true;
}

document.getElementById('chrome-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!chromeMenuEl.hidden) { closeDropdowns(); return; }
  renderMenu(chromeMenuEl, CHROME_MENU);
  openDropdown(chromeMenuEl, e.currentTarget);
});
document.getElementById('warp-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!warpMenuEl.hidden) { closeDropdowns(); return; }
  renderMenu(warpMenuEl, WARP_MENU);
  openDropdown(warpMenuEl, e.currentTarget);
});
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.dropdown')) closeDropdowns();
});

/* ---------------- Settings panel ---------------- */

function showSettings() {
  showPanel('Settings', (body) => {
    const rows = [
      ['Engine', 'Chromium (embedded) · node-pty shell'],
      ['Shell', window.tandem.platform === 'win32' ? 'powershell' : 'zsh -l'],
      ['Theme', 'Tandem Dark'],
      ['Default search', 'DuckDuckGo'],
      ['Platform', window.tandem.platform],
    ];
    for (const [t, s] of rows) {
      const row = div('panel-row');
      row.innerHTML = `<span class="pr-title">${t}</span><span class="pr-sub">${s}</span>`;
      body.appendChild(row);
    }
  });
}

/* ---------------- Command palette ---------------- */

const paletteScrim = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteList = document.getElementById('palette-list');

const COMMANDS = [
  { label: 'Show Browser', cat: 'View', key: '⌘1', action: 'view:browser' },
  { label: 'Show Terminal', cat: 'View', key: '⌘2', action: 'view:terminal' },
  { label: 'New Tab', cat: 'Browser', key: '⌘T', action: 'browser:new-tab' },
  { label: 'Close Tab', cat: 'Browser', key: '⌘W', action: 'browser:close-tab' },
  { label: 'Reload Page', cat: 'Browser', key: '⌘R', action: 'browser:reload' },
  { label: 'Back', cat: 'Browser', action: 'browser:back' },
  { label: 'Forward', cat: 'Browser', action: 'browser:forward' },
  { label: 'Home', cat: 'Browser', action: 'browser:home' },
  { label: 'Find in Page', cat: 'Browser', key: '⌘F', action: 'browser:find' },
  { label: 'Bookmark This Tab', cat: 'Browser', key: '⌘D', action: 'browser:bookmark' },
  { label: 'Toggle Bookmarks Bar', cat: 'Browser', key: '⌘⇧B', action: 'browser:toggle-bookmarks' },
  { label: 'Zoom In', cat: 'Browser', action: 'browser:zoom-in' },
  { label: 'Zoom Out', cat: 'Browser', action: 'browser:zoom-out' },
  { label: 'Reset Zoom', cat: 'Browser', action: 'browser:zoom-reset' },
  { label: 'Show History', cat: 'Browser', action: 'browser:history' },
  { label: 'New Terminal Session', cat: 'Terminal', key: '⌘⇧T', action: 'terminal:new-session' },
  { label: 'Clear Session', cat: 'Terminal', key: '⌘K', action: 'terminal:clear' },
  { label: 'Close Session', cat: 'Terminal', action: 'terminal:close-session' },
  { label: 'New Window', cat: 'App', key: '⌘N', action: 'window:new' },
  { label: 'Settings', cat: 'App', key: '⌘,', action: 'app:settings' },
];

let paletteIdx = 0;
let paletteFiltered = COMMANDS;

function openPalette() {
  closeDropdowns();
  paletteScrim.hidden = false;
  paletteInput.value = '';
  renderPalette('');
  paletteInput.focus();
}
function closePalette() {
  paletteScrim.hidden = true;
}
function renderPalette(query) {
  const q = query.trim().toLowerCase();
  paletteFiltered = COMMANDS.filter(
    (c) => !q || c.label.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q)
  );
  paletteIdx = 0;
  paletteList.innerHTML = '';
  if (paletteFiltered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = 'No matching commands';
    paletteList.appendChild(empty);
    return;
  }
  paletteFiltered.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = 'palette-item' + (i === 0 ? ' is-active' : '');
    li.innerHTML = `<span class="pi-ico">›</span><span class="pi-label">${c.label}</span>
                    <span class="pi-cat">${c.cat}</span>
                    ${c.key ? `<span class="pi-key">${c.key}</span>` : ''}`;
    li.addEventListener('mouseenter', () => setPaletteIdx(i));
    li.addEventListener('click', () => runPalette(i));
    paletteList.appendChild(li);
  });
}
function setPaletteIdx(i) {
  paletteIdx = i;
  [...paletteList.children].forEach((el, idx) => el.classList.toggle('is-active', idx === i));
}
function runPalette(i) {
  const cmd = paletteFiltered[i];
  if (!cmd) return;
  closePalette();
  dispatch(cmd.action);
}
paletteInput.addEventListener('input', () => renderPalette(paletteInput.value));
paletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIdx(Math.min(paletteIdx + 1, paletteFiltered.length - 1)); scrollActive(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIdx(Math.max(paletteIdx - 1, 0)); scrollActive(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteIdx); }
  else if (e.key === 'Escape') closePalette();
});
function scrollActive() {
  paletteList.children[paletteIdx]?.scrollIntoView({ block: 'nearest' });
}
paletteScrim.addEventListener('mousedown', (e) => { if (e.target === paletteScrim) closePalette(); });

/* ---------------- Global keys ---------------- */

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDropdowns(); if (!paletteScrim.hidden) closePalette(); if (!panelScrim.hidden) hidePanel(); }
});

/* ---------------- Boot ---------------- */

setMode('browser');

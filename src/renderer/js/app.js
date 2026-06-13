'use strict';

import { initBrowser } from './browser/index.js';
import { initTerminal } from './terminal/index.js';
import { initCode } from './code/index.js';

const browserRoot = document.getElementById('browser-mode');
const terminalRoot = document.getElementById('terminal-mode');
const codeRoot = document.getElementById('code-mode');

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
function currentPanel() {
  return panelScrim.hidden ? null : panelTitle.textContent;
}
panelScrim.addEventListener('mousedown', (e) => { if (e.target === panelScrim) hidePanel(); });
document.getElementById('panel-close').addEventListener('click', hidePanel);

/* ---------------- Context shared with feature modules ---------------- */

function openUrl(url) { setMode('browser'); browser.openUrl(url); }

const ctx = { dispatch, toast, showPanel, hidePanel, currentPanel, showContextMenu, openUrl };

const browser = initBrowser(browserRoot, ctx);
const terminal = initTerminal(terminalRoot, ctx);
const code = initCode(codeRoot, ctx);

/* ---------------- Mode switching ---------------- */

let mode = 'browser';
const browserTabs = document.getElementById('browser-tabcluster');
const terminalTabs = document.getElementById('terminal-tabcluster');
const codeTabs = document.getElementById('code-tabcluster');
const terminalTrail = document.getElementById('terminal-trail');
const FEATURES = { browser, terminal, code };

function setMode(next) {
  mode = next;
  browserRoot.classList.toggle('is-hidden', next !== 'browser');
  terminalRoot.classList.toggle('is-hidden', next !== 'terminal');
  codeRoot.classList.toggle('is-hidden', next !== 'code');
  // Swap which tab cluster (and trailing actions) the shared title bar shows.
  browserTabs.hidden = next !== 'browser';
  terminalTabs.hidden = next !== 'terminal';
  codeTabs.hidden = next !== 'code';
  terminalTrail.hidden = next !== 'terminal';
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === next));
  FEATURES[next].activate();
}
document.querySelectorAll('.mode-btn').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
});
// Title-bar action buttons (e.g. the terminal command-palette button).
document.querySelectorAll('#topbar [data-act]').forEach((b) => {
  b.addEventListener('click', () => dispatch(b.dataset.act));
});

/* ---------------- Central action router ---------------- */

function dispatch(action) {
  closeDropdowns();
  // Context-aware shortcuts: same key, different meaning per mode.
  if (action === 'find') return dispatch(mode === 'terminal' ? 'terminal:search' : 'browser:find');
  if (action === 'cmd-d') return dispatch(mode === 'terminal' ? 'terminal:split-right' : 'browser:bookmark');
  if (action === 'cmd-up') { if (mode === 'terminal') dispatch('terminal:prev-command'); return; }
  if (action === 'cmd-down') { if (mode === 'terminal') dispatch('terminal:next-command'); return; }
  if (action === 'cmd-shift-w') { if (mode === 'terminal') dispatch('terminal:close-pane'); else dispatch('browser:close-tab'); return; }
  if (action.startsWith('view:')) { setMode(action.slice(5)); return; }
  if (action === 'palette:open') { openPalette(); return; }
  if (action === 'window:new') { window.tandem.window.newWindow(); return; }
  if (action === 'app:settings') { showSettings(); return; }
  if (action === 'md:view') { openMarkdown(); return; }
  if (action === 'app:theme-cycle') { cycleAppTheme(); return; }
  if (action.startsWith('app:theme:')) { setAppTheme(action.slice('app:theme:'.length)); return; }
  if (action.startsWith('stub:')) { toast(`${labelOf(action)} — coming soon`); return; }
  if (action.startsWith('browser:')) {
    if (mode !== 'browser') setMode('browser');
    browser.handleCommand(action);
    return;
  }
  if (action.startsWith('terminal:')) {
    if (mode !== 'terminal') setMode('terminal');
    terminal.handleCommand(action);
    return;
  }
  if (action.startsWith('code:')) {
    if (mode !== 'code') setMode('code');
    code.handleCommand(action);
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
  { label: 'New incognito tab', key: '⌘⇧N', action: 'browser:new-incognito' },
  { label: 'New window', key: '⌘N', action: 'window:new' },
  { label: 'Reopen closed tab', key: '⌘⇧O', action: 'browser:reopen-tab' },
  { sep: true },
  { label: 'Add tab to new group', action: 'browser:group' },
  { label: 'Pin / unpin tab', action: 'browser:pin' },
  { label: 'Duplicate tab', action: 'browser:duplicate' },
  { sep: true },
  { label: 'History', action: 'browser:history' },
  { label: 'Downloads', key: '⌘⇧J', action: 'browser:downloads' },
  { label: 'Bookmark this tab', key: '⌘D', action: 'browser:bookmark' },
  { label: 'Show bookmarks bar', key: '⌘⇧B', action: 'browser:toggle-bookmarks' },
  { sep: true },
  { zoom: true },
  { label: 'Find…', key: '⌘F', action: 'browser:find' },
  { label: 'Print…', action: 'browser:print' },
  { label: 'View source', key: '⌘⌥U', action: 'browser:view-source' },
  { sep: true },
  { label: 'Developer tools', key: '⌘⌥I', action: 'browser:devtools' },
  { label: 'Settings', action: 'app:settings' },
];

const WARP_MENU = [
  { section: 'Session' },
  { label: 'New session', key: '⌘⇧T', action: 'terminal:new-session' },
  { label: 'Clear session', key: '⌘K', action: 'terminal:clear' },
  { label: 'Close session', action: 'terminal:close-session' },
  { sep: true },
  { section: 'Panes' },
  { label: 'Split right', key: '⌘D', action: 'terminal:split-right' },
  { label: 'Split down', key: '⌘⇧D', action: 'terminal:split-down' },
  { label: 'Focus next pane', key: '⌘]', action: 'terminal:focus-pane' },
  { label: 'Close pane', key: '⌘⇧W', action: 'terminal:close-pane' },
  { sep: true },
  { label: 'Find…', key: '⌘F', action: 'terminal:search' },
  { label: 'Jump to previous command', key: '⌘↑', action: 'terminal:prev-command' },
  { label: 'Jump to next command', key: '⌘↓', action: 'terminal:next-command' },
  { label: 'Copy last command output', action: 'terminal:copy-output' },
  { sep: true },
  { label: 'Bookmark command', action: 'terminal:bookmark-command' },
  { label: 'Command bookmarks…', action: 'terminal:command-bookmarks' },
  { label: 'View Markdown file…', action: 'md:view' },
  { sep: true },
  { label: 'Cycle terminal theme', action: 'terminal:theme' },
  { label: 'Appearance / themes…', action: 'app:settings' },
  { label: 'Command palette…', key: '⌘P', action: 'palette:open' },
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
  contextMenuEl.hidden = true;
}

/* ---------------- Context menu (tabs / groups) ---------------- */

const contextMenuEl = document.getElementById('context-menu');

// items: {label,onClick,danger,swatchColor} | {sep} | {section} | {swatches,onPick}
function showContextMenu(items, x, y) {
  closeDropdowns();
  contextMenuEl.innerHTML = '';
  for (const it of items) {
    if (it.sep) { contextMenuEl.appendChild(div('menu-sep')); continue; }
    if (it.section) { const s = div('menu-section'); s.textContent = it.section; contextMenuEl.appendChild(s); continue; }
    if (it.swatches) { contextMenuEl.appendChild(buildSwatchRow(it)); continue; }
    const btn = document.createElement('button');
    btn.className = 'menu-item' + (it.danger ? ' danger' : '');
    const dot = it.swatchColor ? `<span class="mi-swatch" style="background:${it.swatchColor}"></span>` : '<span class="mi-ico"></span>';
    btn.innerHTML = `${dot}<span class="mi-label">${it.label}</span>`;
    btn.addEventListener('click', () => { closeDropdowns(); it.onClick && it.onClick(); });
    contextMenuEl.appendChild(btn);
  }
  contextMenuEl.hidden = false;
  const w = contextMenuEl.offsetWidth || 248;
  const h = contextMenuEl.offsetHeight || 320;
  contextMenuEl.style.right = 'auto';
  contextMenuEl.style.left = `${Math.min(x, window.innerWidth - w - 8)}px`;
  contextMenuEl.style.top = `${Math.min(y, window.innerHeight - h - 8)}px`;
}

function buildSwatchRow(it) {
  const row = div('menu-swatches');
  for (const c of it.swatches) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.addEventListener('click', (e) => { e.stopPropagation(); closeDropdowns(); it.onPick(c); });
    row.appendChild(b);
  }
  return row;
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

/* ---------------- App themes ---------------- */

// Each maps to a [data-theme] block in tokens.css; '' is the built-in default.
const APP_THEMES = [
  { id: '', name: 'Midnight', dot: '#6d9bff' },
  { id: 'graphite', name: 'Graphite', dot: '#a0a4b8' },
  { id: 'nord', name: 'Nord', dot: '#88c0d0' },
  { id: 'aurora', name: 'Aurora', dot: '#c58af9' },
];
const THEME_KEY = 'tandem:app-theme';
let appTheme = localStorage.getItem(THEME_KEY) || '';

function applyAppTheme() {
  if (appTheme) document.documentElement.dataset.theme = appTheme;
  else delete document.documentElement.dataset.theme;
}
function setAppTheme(id) {
  appTheme = id;
  localStorage.setItem(THEME_KEY, id);
  applyAppTheme();
  const t = APP_THEMES.find((x) => x.id === id);
  toast(`Theme: ${t ? t.name : 'Midnight'}`);
  if (currentPanel() === 'Settings') showSettings();
}
function cycleAppTheme() {
  const i = APP_THEMES.findIndex((x) => x.id === appTheme);
  setAppTheme(APP_THEMES[(i + 1) % APP_THEMES.length].id);
}
applyAppTheme();

/* ---------------- Settings panel ---------------- */

function showSettings() {
  showPanel('Settings', (body) => {
    // App theme picker
    body.appendChild(sectionLabel('Appearance'));
    const appRow = div('theme-grid');
    for (const t of APP_THEMES) {
      const b = document.createElement('button');
      b.className = 'theme-chip' + (t.id === appTheme ? ' is-active' : '');
      b.innerHTML = `<span class="theme-dot" style="background:${t.dot}"></span>${t.name}`;
      b.addEventListener('click', () => setAppTheme(t.id));
      appRow.appendChild(b);
    }
    body.appendChild(appRow);

    // Terminal theme picker
    body.appendChild(sectionLabel('Terminal theme'));
    const termRow = div('theme-grid');
    for (const name of terminal.themeNames()) {
      const b = document.createElement('button');
      b.className = 'theme-chip' + (name === terminal.currentTheme() ? ' is-active' : '');
      b.textContent = name;
      b.addEventListener('click', () => { dispatch(`terminal:theme:${name}`); showSettings(); });
      termRow.appendChild(b);
    }
    body.appendChild(termRow);

    // Info rows
    body.appendChild(sectionLabel('About'));
    const rows = [
      ['Engine', 'Chromium (embedded) · node-pty shell'],
      ['Shell', window.tandem.platform === 'win32' ? 'powershell' : 'zsh -l'],
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

function sectionLabel(text) {
  const el = div('panel-section');
  el.textContent = text;
  return el;
}

/* ---------------- Markdown viewer ---------------- */

const mdScrim = document.getElementById('md-viewer');
const mdTitle = document.getElementById('md-title');
const mdBody = document.getElementById('md-body');

async function openMarkdown() {
  const res = await window.tandem.markdown.pick();
  if (!res) return;
  if (res.error) { toast(`Cannot open: ${res.error}`); return; }
  renderMarkdown(res.path, res.content);
}
function renderMarkdown(path, content) {
  mdTitle.textContent = path.split('/').pop();
  mdBody.innerHTML = window.marked.parse(content, { gfm: true, breaks: true });
  // Markdown links should open in the browser, not navigate the app shell.
  mdBody.querySelectorAll('a[href]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); openUrl(a.getAttribute('href')); closeMarkdown(); });
  });
  mdScrim.hidden = false;
}
function closeMarkdown() { mdScrim.hidden = true; }
mdScrim.addEventListener('mousedown', (e) => { if (e.target === mdScrim) closeMarkdown(); });
document.getElementById('md-close').addEventListener('click', closeMarkdown);

/* ---------------- Command palette ---------------- */

const paletteScrim = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteList = document.getElementById('palette-list');

const COMMANDS = [
  { label: 'Show Browser', cat: 'View', key: '⌘1', action: 'view:browser' },
  { label: 'Show Terminal', cat: 'View', key: '⌘2', action: 'view:terminal' },
  { label: 'Show Code', cat: 'View', key: '⌘3', action: 'view:code' },
  { label: 'Open Folder in Code', cat: 'Code', action: 'code:open-folder' },
  { label: 'New Tab', cat: 'Browser', key: '⌘T', action: 'browser:new-tab' },
  { label: 'New Incognito Tab', cat: 'Browser', key: '⌘⇧N', action: 'browser:new-incognito' },
  { label: 'Reopen Closed Tab', cat: 'Browser', key: '⌘⇧O', action: 'browser:reopen-tab' },
  { label: 'Add Tab to New Group', cat: 'Browser', action: 'browser:group' },
  { label: 'Pin / Unpin Tab', cat: 'Browser', action: 'browser:pin' },
  { label: 'Duplicate Tab', cat: 'Browser', action: 'browser:duplicate' },
  { label: 'Mute / Unmute Tab', cat: 'Browser', action: 'browser:mute' },
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
  { label: 'Show Downloads', cat: 'Browser', key: '⌘⇧J', action: 'browser:downloads' },
  { label: 'Search Tabs', cat: 'Browser', action: 'browser:tab-search' },
  { label: 'Print', cat: 'Browser', action: 'browser:print' },
  { label: 'View Source', cat: 'Browser', action: 'browser:view-source' },
  { label: 'Developer Tools', cat: 'Browser', action: 'browser:devtools' },
  { label: 'New Terminal Session', cat: 'Terminal', key: '⌘⇧T', action: 'terminal:new-session' },
  { label: 'Clear Session', cat: 'Terminal', key: '⌘K', action: 'terminal:clear' },
  { label: 'Close Session', cat: 'Terminal', action: 'terminal:close-session' },
  { label: 'Split Pane Right', cat: 'Terminal', key: '⌘D', action: 'terminal:split-right' },
  { label: 'Split Pane Down', cat: 'Terminal', key: '⌘⇧D', action: 'terminal:split-down' },
  { label: 'Focus Next Pane', cat: 'Terminal', key: '⌘]', action: 'terminal:focus-pane' },
  { label: 'Close Pane', cat: 'Terminal', key: '⌘⇧W', action: 'terminal:close-pane' },
  { label: 'Find in Terminal', cat: 'Terminal', key: '⌘F', action: 'terminal:search' },
  { label: 'Jump to Previous Command', cat: 'Terminal', key: '⌘↑', action: 'terminal:prev-command' },
  { label: 'Jump to Next Command', cat: 'Terminal', key: '⌘↓', action: 'terminal:next-command' },
  { label: 'Copy Last Command Output', cat: 'Terminal', action: 'terminal:copy-output' },
  { label: 'Cycle Terminal Theme', cat: 'Terminal', action: 'terminal:theme' },
  { label: 'Terminal Zoom In', cat: 'Terminal', action: 'terminal:zoom-in' },
  { label: 'Terminal Zoom Out', cat: 'Terminal', action: 'terminal:zoom-out' },
  { label: 'Bookmark Command', cat: 'Terminal', action: 'terminal:bookmark-command' },
  { label: 'Command Bookmarks', cat: 'Terminal', action: 'terminal:command-bookmarks' },
  { label: 'View Markdown File', cat: 'Terminal', action: 'md:view' },
  { label: 'Change App Theme', cat: 'App', action: 'app:theme-cycle' },
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
  if (e.key === 'Escape') {
    closeDropdowns();
    if (!paletteScrim.hidden) closePalette();
    if (!panelScrim.hidden) hidePanel();
    if (!mdScrim.hidden) closeMarkdown();
  }
});

/* ---------------- Boot ---------------- */

setMode('browser');

'use strict';

// Tab engine: ordinary + incognito tabs, tab groups (color/name/collapse),
// pinned tabs, duplicate/mute, and the right-click context menus. Owns the
// webviews (in a separate stack) and renders the Chrome-style tab strip.

export const START_URL = 'https://duckduckgo.com';
const PERSIST = 'persist:tandem';
const INCOGNITO = 'tandem-incognito'; // no persist: -> shared in-memory session
const CLOSED_MAX = 25;

// Chrome-like group colors tuned for a dark UI.
export const GROUP_COLORS = [
  { name: 'grey', c: '#9aa0a6' },
  { name: 'blue', c: '#8ab4f8' },
  { name: 'red', c: '#f28b82' },
  { name: 'yellow', c: '#fdd663' },
  { name: 'green', c: '#81c995' },
  { name: 'pink', c: '#ff8bcb' },
  { name: 'purple', c: '#c58af9' },
  { name: 'cyan', c: '#78d9ec' },
  { name: 'orange', c: '#fcad70' },
];

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

export class TabManager {
  constructor(els, ctx) {
    this.els = els; // { tabs, stack }
    this.ctx = ctx; // { showContextMenu, onActiveChange, toast }
    this.tabs = new Map();
    this.groups = new Map();
    this.order = []; // tab ids in display order (group members contiguous)
    this.activeId = null;
    this.history = [];
    this.closed = [];
    this.colorSeq = 0;
  }

  /* ------------------------------------------------ creation */

  createTab({ url = START_URL, incognito = false, groupId = null, index = null } = {}) {
    const id = nextId('tab');
    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('partition', incognito ? INCOGNITO : PERSIST);
    webview.classList.add('is-hidden');
    this.els.stack.appendChild(webview);

    const tab = {
      id, webview, incognito, groupId,
      title: incognito ? 'Incognito tab' : 'New Tab',
      url, favicon: null, loading: true, pinned: false, muted: false, audible: false,
      ready: false, el: null,
    };
    this.tabs.set(id, tab);

    if (index === null || index < 0 || index >= this.order.length) this.order.push(id);
    else this.order.splice(index, 0, id);

    this._wire(tab);
    if (groupId) this._normalize();
    this.activate(id);
    return tab;
  }

  _wire(tab) {
    const wv = tab.webview;
    wv.addEventListener('dom-ready', () => { tab.ready = true; if (tab.id === this.activeId) this.ctx.onActiveChange(this.activeTab()); });
    wv.addEventListener('did-start-loading', () => { tab.loading = true; this._paintTab(tab); });
    wv.addEventListener('did-stop-loading', () => { tab.loading = false; this._paintTab(tab); });

    const onNav = (e) => {
      if (!e.url) return;
      tab.url = e.url;
      if (!tab.incognito) this.history.push({ url: e.url, title: tab.title, time: Date.now() });
      if (tab.id === this.activeId) this.ctx.onActiveChange(this.activeTab());
    };
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);

    wv.addEventListener('page-title-updated', (e) => { tab.title = e.title || tab.url; this._paintTab(tab); });
    wv.addEventListener('page-favicon-updated', (e) => { tab.favicon = (e.favicons && e.favicons[0]) || null; this._paintTab(tab); });
    wv.addEventListener('media-started-playing', () => { tab.audible = true; this._paintTab(tab); });
    wv.addEventListener('media-paused', () => { tab.audible = false; this._paintTab(tab); });
    wv.addEventListener('new-window', (e) => { if (e.url) this.createTab({ url: e.url, incognito: tab.incognito, index: this._indexOf(tab.id) + 1 }); });
  }

  /* ------------------------------------------------ activation / close */

  activeTab() { return this.tabs.get(this.activeId); }
  _indexOf(id) { return this.order.indexOf(id); }

  activate(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    // Expand a collapsed group when one of its tabs is activated.
    if (tab.groupId) { const g = this.groups.get(tab.groupId); if (g && g.collapsed) g.collapsed = false; }
    this.activeId = id;
    for (const t of this.tabs.values()) t.webview.classList.toggle('is-hidden', t.id !== id);
    this.render();
    this.ctx.onActiveChange(tab);
  }

  closeTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    const idx = this._indexOf(id);
    this.closed.push({ url: tab.url, incognito: tab.incognito });
    if (this.closed.length > CLOSED_MAX) this.closed.shift();

    tab.webview.remove();
    this.tabs.delete(id);
    this.order.splice(idx, 1);
    this._cleanupGroups();

    if (this.tabs.size === 0) { this.createTab(); return; }
    if (this.activeId === id) {
      const nextId = this.order[idx] || this.order[idx - 1] || this.order[0];
      this.activate(nextId);
    } else {
      this.render();
    }
  }

  closeOthers(id) { for (const oid of [...this.order]) if (oid !== id) this.closeTab(oid); }
  closeRight(id) {
    const idx = this._indexOf(id);
    for (const oid of this.order.slice(idx + 1)) this.closeTab(oid);
  }
  reopenClosed() {
    const last = this.closed.pop();
    if (last) this.createTab({ url: last.url, incognito: last.incognito });
    else this.ctx.toast('No recently closed tabs');
  }

  /* ------------------------------------------------ navigation */

  navigate(raw) {
    const tab = this.activeTab();
    const url = this._normalizeUrl(raw);
    if (tab && tab.ready && url) tab.webview.loadURL(url);
  }
  back() { const t = this.activeTab(); if (t?.ready && t.webview.canGoBack()) t.webview.goBack(); }
  forward() { const t = this.activeTab(); if (t?.ready && t.webview.canGoForward()) t.webview.goForward(); }
  reload() { const t = this.activeTab(); if (t?.ready) t.webview.reload(); }
  home() { this.navigate(START_URL); }
  canBack() { const t = this.activeTab(); try { return !!(t?.ready && t.webview.canGoBack()); } catch { return false; } }
  canForward() { const t = this.activeTab(); try { return !!(t?.ready && t.webview.canGoForward()); } catch { return false; } }

  zoom(delta) {
    const t = this.activeTab();
    if (!t?.ready) return;
    if (delta === 0) t.webview.setZoomLevel(0);
    else t.webview.setZoomLevel(t.webview.getZoomLevel() + delta);
  }
  zoomPercent() {
    const t = this.activeTab();
    if (!t?.ready) return 100;
    return Math.round(100 * 1.2 ** t.webview.getZoomLevel());
  }
  find(query, forward = true) {
    const t = this.activeTab();
    if (t?.ready && query) t.webview.findInPage(query, { forward, findNext: true });
  }
  stopFind() { const t = this.activeTab(); if (t?.ready) t.webview.stopFindInPage('clearSelection'); }

  _normalizeUrl(raw) {
    const v = (raw || '').trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[^\s]+\.[^\s]+$/.test(v)) return `https://${v}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(v)}`;
  }

  /* ------------------------------------------------ tab ops */

  duplicate(id) {
    const t = this.tabs.get(id);
    if (t) this.createTab({ url: t.url, incognito: t.incognito, groupId: t.groupId, index: this._indexOf(id) + 1 });
  }
  togglePin(id) {
    const t = this.tabs.get(id);
    if (!t) return;
    t.pinned = !t.pinned;
    if (t.pinned) t.groupId = null; // pinned tabs are never grouped
    this._cleanupGroups();
    this.render();
  }
  toggleMute(id) {
    const t = this.tabs.get(id);
    if (!t?.ready) return;
    t.muted = !t.muted;
    t.webview.setAudioMuted(t.muted);
    this._paintTab(t);
  }
  print() { const t = this.activeTab(); if (t?.ready) t.webview.print(); }
  viewSource() {
    const t = this.activeTab();
    if (t && !t.url.startsWith('view-source:')) {
      this.createTab({ url: `view-source:${t.url}`, incognito: t.incognito, index: this._indexOf(t.id) + 1 });
    }
  }
  toggleDevtools() {
    const t = this.activeTab();
    if (!t?.ready) return;
    if (t.webview.isDevToolsOpened()) t.webview.closeDevTools();
    else t.webview.openDevTools();
  }
  // For the tab-search dropdown: one menu entry per open tab.
  tabList() {
    return this.order.map((id) => {
      const t = this.tabs.get(id);
      const g = t.groupId ? this.groups.get(t.groupId) : null;
      return {
        label: `${t.pinned ? '📌 ' : ''}${t.incognito ? '🕶 ' : ''}${t.title || t.url}`,
        swatchColor: g ? g.color : undefined,
        onClick: () => this.activate(id),
      };
    });
  }

  /* ------------------------------------------------ groups */

  addToNewGroup(id) {
    const color = GROUP_COLORS[this.colorSeq++ % GROUP_COLORS.length].c;
    const gid = nextId('grp');
    this.groups.set(gid, { id: gid, name: '', color, collapsed: false, el: null });
    this.addToGroup(id, gid);
  }
  addToGroup(id, gid) {
    const t = this.tabs.get(id);
    if (!t || !this.groups.has(gid)) return;
    t.pinned = false;
    t.groupId = gid;
    this._normalize();
    this.render();
  }
  removeFromGroup(id) {
    const t = this.tabs.get(id);
    if (!t) return;
    t.groupId = null;
    this._cleanupGroups();
    this._normalize();
    this.render();
  }
  ungroup(gid) {
    for (const t of this.tabs.values()) if (t.groupId === gid) t.groupId = null;
    this.groups.delete(gid);
    this.render();
  }
  closeGroup(gid) {
    for (const id of this.order.filter((id) => this.tabs.get(id).groupId === gid)) this.closeTab(id);
  }
  setGroupColor(gid, c) { const g = this.groups.get(gid); if (g) { g.color = c; this.render(); } }
  renameGroup(gid, name) { const g = this.groups.get(gid); if (g) { g.name = name; this.render(); } }
  toggleCollapse(gid) {
    const g = this.groups.get(gid);
    if (!g) return;
    g.collapsed = !g.collapsed;
    // If we collapsed the active tab away, move focus to a visible tab.
    const active = this.activeTab();
    if (g.collapsed && active && active.groupId === gid) {
      const visible = this.order.find((id) => {
        const t = this.tabs.get(id);
        const tg = t.groupId ? this.groups.get(t.groupId) : null;
        return !(tg && tg.collapsed);
      });
      if (visible) { this.activate(visible); return; }
    }
    this.render();
  }

  _cleanupGroups() {
    for (const gid of [...this.groups.keys()]) {
      const has = [...this.tabs.values()].some((t) => t.groupId === gid);
      if (!has) this.groups.delete(gid);
    }
  }
  // Make group members contiguous, anchored at each group's first appearance.
  _normalize() {
    const seen = new Set();
    const out = [];
    for (const id of this.order) {
      const t = this.tabs.get(id);
      if (!t) continue;
      const key = t.groupId || `t:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (t.groupId) {
        for (const mid of this.order) if (this.tabs.get(mid)?.groupId === t.groupId) out.push(mid);
      } else out.push(id);
    }
    this.order = out;
  }

  /* ------------------------------------------------ rendering */

  render() {
    const strip = this.els.tabs;
    strip.innerHTML = '';
    for (const t of this.tabs.values()) t.el = null;

    const pinned = this.order.filter((id) => this.tabs.get(id).pinned);
    const rest = this.order.filter((id) => !this.tabs.get(id).pinned);

    for (const id of pinned) strip.appendChild(this._tabEl(this.tabs.get(id)));

    let cur = null;
    for (const id of rest) {
      const tab = this.tabs.get(id);
      const g = tab.groupId ? this.groups.get(tab.groupId) : null;
      if (g && g !== cur) { strip.appendChild(this._groupEl(g)); cur = g; }
      if (!g) cur = null;
      if (g && g.collapsed) continue;
      strip.appendChild(this._tabEl(tab));
    }
  }

  _paintTab(tab) {
    // Light update of an existing tab node (title/favicon/loading/audio).
    if (!tab.el) return;
    const fav = tab.el.querySelector('.tab-favicon');
    const title = tab.el.querySelector('.tab-title');
    if (title) { title.textContent = tab.title; title.title = tab.title; }
    if (fav) {
      fav.classList.toggle('spinner', tab.loading && !tab.favicon);
      fav.style.backgroundImage = tab.favicon ? `url("${tab.favicon}")` : '';
    }
    const audio = tab.el.querySelector('.tab-audio');
    if (audio) audio.hidden = !(tab.audible || tab.muted);
    if (audio) audio.dataset.state = tab.muted ? 'muted' : 'playing';
  }

  _tabEl(tab) {
    const el = document.createElement('div');
    el.className = 'chrome-tab';
    if (tab.pinned) el.classList.add('pinned');
    if (tab.incognito) el.classList.add('incognito');
    if (tab.id === this.activeId) el.classList.add('is-active');
    if (tab.groupId) { el.classList.add('in-group'); el.style.setProperty('--group-color', this.groups.get(tab.groupId).color); }
    el.dataset.id = tab.id;

    const incoBadge = tab.incognito
      ? `<span class="tab-inco" title="Incognito"><svg viewBox="0 0 24 24"><path d="M5 14h14l-1.2-3.5a2 2 0 0 0-1.9-1.3H8.1a2 2 0 0 0-1.9 1.3z" fill="currentColor"/><circle cx="8" cy="17" r="2.4" fill="currentColor"/><circle cx="16" cy="17" r="2.4" fill="currentColor"/></svg></span>`
      : '';
    el.innerHTML = `
      ${incoBadge}
      <span class="tab-favicon"></span>
      <span class="tab-title">${escapeHtml(tab.title)}</span>
      <span class="tab-audio" hidden></span>
      <button class="tab-close" title="Close tab">✕</button>`;

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.tab-close')) return;
      this.activate(tab.id);
    });
    el.querySelector('.tab-close').addEventListener('click', (e) => { e.stopPropagation(); this.closeTab(tab.id); });
    el.querySelector('.tab-audio').addEventListener('click', (e) => { e.stopPropagation(); this.toggleMute(tab.id); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.ctx.showContextMenu(this._tabMenu(tab), e.clientX, e.clientY); });

    tab.el = el;
    this._paintTab(tab);
    return el;
  }

  _groupEl(g) {
    const el = document.createElement('div');
    el.className = 'tab-group-label' + (g.collapsed ? ' collapsed' : '');
    el.style.setProperty('--group-color', g.color);
    el.innerHTML = `<span class="tg-dot"></span>${g.name ? `<span class="tg-name">${escapeHtml(g.name)}</span>` : ''}`;
    el.addEventListener('click', () => this.toggleCollapse(g.id));
    el.addEventListener('dblclick', (e) => { e.stopPropagation(); this._startRename(g, el); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.ctx.showContextMenu(this._groupMenu(g), e.clientX, e.clientY); });
    g.el = el;
    return el;
  }

  _startRename(g, el) {
    const input = document.createElement('input');
    input.className = 'tg-rename';
    input.value = g.name;
    input.placeholder = 'Name';
    el.innerHTML = `<span class="tg-dot"></span>`;
    el.appendChild(input);
    input.focus();
    input.select();
    const commit = () => { this.renameGroup(g.id, input.value.trim()); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') this.render(); });
    input.addEventListener('blur', commit);
  }

  /* ------------------------------------------------ context menus */

  _tabMenu(tab) {
    const idx = this._indexOf(tab.id);
    const m = [
      { label: 'New tab to the right', onClick: () => this.createTab({ index: idx + 1, incognito: tab.incognito }) },
      { label: 'Duplicate', onClick: () => this.duplicate(tab.id) },
      { label: tab.pinned ? 'Unpin tab' : 'Pin tab', onClick: () => this.togglePin(tab.id) },
      { label: tab.muted ? 'Unmute site' : 'Mute site', onClick: () => this.toggleMute(tab.id) },
      { sep: true },
    ];
    if (tab.groupId) m.push({ label: 'Remove from group', onClick: () => this.removeFromGroup(tab.id) });
    m.push({ label: 'Add to new group', onClick: () => this.addToNewGroup(tab.id) });
    for (const g of this.groups.values()) {
      if (g.id !== tab.groupId) m.push({ label: `Add to “${g.name || 'group'}”`, swatchColor: g.color, onClick: () => this.addToGroup(tab.id, g.id) });
    }
    m.push({ sep: true });
    m.push({ label: 'Close', onClick: () => this.closeTab(tab.id) });
    m.push({ label: 'Close other tabs', onClick: () => this.closeOthers(tab.id) });
    m.push({ label: 'Close tabs to the right', onClick: () => this.closeRight(tab.id) });
    return m;
  }

  _groupMenu(g) {
    return [
      { swatches: GROUP_COLORS.map((x) => x.c), onPick: (c) => this.setGroupColor(g.id, c) },
      { label: 'Rename group', onClick: () => { if (g.el) this._startRename(g, g.el); } },
      { label: g.collapsed ? 'Expand group' : 'Collapse group', onClick: () => this.toggleCollapse(g.id) },
      { sep: true },
      { label: 'Ungroup', onClick: () => this.ungroup(g.id) },
      { label: 'Close group', danger: true, onClick: () => this.closeGroup(g.id) },
    ];
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

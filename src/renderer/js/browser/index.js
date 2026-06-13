'use strict';

import { TabManager, START_URL } from './tabs.js';

// Wires the Chrome-style chrome (omnibox, nav cluster, bookmarks, find, history)
// around the TabManager and exposes the command API used by the app router.

export function initBrowser(root, ctx) {
  const els = {
    // Tabs live in the shared #topbar now (outside this root), so look them up globally.
    tabs: document.getElementById('chrome-tabs'),
    newTab: document.getElementById('chrome-newtab'),
    stack: root.querySelector('#webview-stack'),
    omnibox: root.querySelector('#omnibox-input'),
    lock: root.querySelector('#omni-lock'),
    star: root.querySelector('#omni-star'),
    bookmarks: root.querySelector('#bookmarks-bar'),
    incoPill: root.querySelector('#incognito-pill'),
    findBar: root.querySelector('#find-bar'),
    findInput: root.querySelector('#find-input'),
    findCount: root.querySelector('#find-count'),
    back: root.querySelector('[data-act="browser:back"]'),
    fwd: root.querySelector('[data-act="browser:forward"]'),
    tabSearch: document.getElementById('chrome-tabsearch'),
    dlBadge: root.querySelector('#dl-badge'),
    dlBtn: root.querySelector('#downloads-btn'),
  };

  const bookmarks = [
    { title: 'DuckDuckGo', url: 'https://duckduckgo.com' },
    { title: 'GitHub', url: 'https://github.com' },
    { title: 'MDN', url: 'https://developer.mozilla.org' },
  ];

  const manager = new TabManager(els, {
    showContextMenu: ctx.showContextMenu,
    onActiveChange: syncActive,
    toast: ctx.toast,
  });

  /* -------- active-tab sync (omnibox, lock, star, incognito, nav) -------- */

  function syncActive(tab) {
    if (!tab) return;
    els.omnibox.value = tab.url;
    els.lock.classList.toggle('insecure', !tab.url.startsWith('https://'));
    els.star.classList.toggle('is-saved', bookmarks.some((b) => b.url === tab.url));
    els.incoPill.hidden = !tab.incognito;
    root.classList.toggle('is-incognito', !!tab.incognito);
    els.back.disabled = !manager.canBack();
    els.fwd.disabled = !manager.canForward();
  }

  /* -------- omnibox + nav cluster -------- */

  els.omnibox.addEventListener('keydown', (e) => { if (e.key === 'Enter') manager.navigate(els.omnibox.value); });
  els.omnibox.addEventListener('focus', () => els.omnibox.select());
  els.newTab?.addEventListener('click', () => manager.createTab()); // legacy per-cluster + (now the unified +)
  els.tabSearch.addEventListener('click', (e) => ctx.showContextMenu(manager.tabList(), e.clientX - 40, e.clientY + 8));
  root.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => ctx.dispatch(btn.dataset.act)));

  /* -------- bookmarks -------- */

  function renderBookmarks() {
    els.bookmarks.innerHTML = '';
    for (const bm of bookmarks) {
      const chip = document.createElement('button');
      chip.className = 'bookmark-chip';
      chip.innerHTML = `<span class="bm-dot"></span>${bm.title}`;
      chip.addEventListener('click', () => manager.navigate(bm.url));
      els.bookmarks.appendChild(chip);
    }
  }
  renderBookmarks();

  function toggleBookmark() {
    const tab = manager.activeTab();
    if (!tab) return;
    const i = bookmarks.findIndex((b) => b.url === tab.url);
    if (i >= 0) { bookmarks.splice(i, 1); ctx.toast('Bookmark removed'); }
    else { bookmarks.push({ title: tab.title || tab.url, url: tab.url }); ctx.toast('Bookmarked'); }
    renderBookmarks();
    syncActive(tab);
  }

  /* -------- find in page -------- */

  function openFind() { els.findBar.hidden = false; els.findInput.focus(); els.findInput.select(); }
  function closeFind() { els.findBar.hidden = true; els.findCount.textContent = ''; manager.stopFind(); }
  function runFind(forward) { manager.find(els.findInput.value, forward); }
  els.findInput.addEventListener('input', () => runFind(true));
  els.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runFind(!e.shiftKey);
    if (e.key === 'Escape') closeFind();
  });
  root.querySelector('#find-next').addEventListener('click', () => runFind(true));
  root.querySelector('#find-prev').addEventListener('click', () => runFind(false));
  root.querySelector('#find-close').addEventListener('click', closeFind);

  // found-in-page bubbles from each webview; capture it at the stack.
  els.stack.addEventListener('found-in-page', (e) => {
    const r = e.result;
    if (r) els.findCount.textContent = r.matches ? `${r.activeMatchOrdinal}/${r.matches}` : 'No results';
  }, true);

  /* -------- history panel -------- */

  function showHistory() {
    const rows = [...manager.history].reverse().slice(0, 100);
    ctx.showPanel('History', (body) => {
      if (!rows.length) { body.innerHTML = '<div class="panel-empty">No history yet.<br><small>Incognito tabs are never recorded.</small></div>'; return; }
      for (const h of rows) {
        const row = document.createElement('div');
        row.className = 'panel-row';
        row.innerHTML = `<span class="pr-title">${esc(h.title || h.url)}</span>
                         <span class="pr-sub">${esc(h.url)} · ${new Date(h.time).toLocaleTimeString()}</span>`;
        row.addEventListener('click', () => { manager.navigate(h.url); ctx.hidePanel(); });
        body.appendChild(row);
      }
    });
  }

  /* -------- downloads -------- */

  const downloads = []; // newest first
  const dlById = new Map();

  window.tandem.downloads.onEvent((type, msg) => {
    if (type === 'started') {
      const d = { ...msg, received: 0, state: 'progressing' };
      downloads.unshift(d);
      dlById.set(msg.id, d);
      ctx.toast(`Downloading ${msg.filename}`);
    } else {
      const d = dlById.get(msg.id);
      if (d) Object.assign(d, msg);
    }
    updateDlBadge();
    renderDownloadsIfOpen();
  });

  function activeDownloads() { return downloads.filter((d) => d.state === 'progressing'); }
  function updateDlBadge() {
    const n = activeDownloads().length;
    els.dlBadge.hidden = n === 0;
    els.dlBadge.textContent = n || '';
    els.dlBtn.classList.toggle('downloading', n > 0);
  }

  function renderDownloadsIfOpen() { if (ctx.currentPanel && ctx.currentPanel() === 'Downloads') showDownloads(); }
  function fmtBytes(n) {
    if (!n || n < 0) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
  }

  function showDownloads() {
    ctx.showPanel('Downloads', (body) => {
      if (!downloads.length) { body.innerHTML = '<div class="panel-empty">No downloads yet.</div>'; return; }
      for (const d of downloads) {
        const row = document.createElement('div');
        row.className = 'dl-row';
        const pct = d.total > 0 ? Math.round((d.received / d.total) * 100) : 0;
        const done = d.state === 'completed';
        const meta = done ? fmtBytes(d.total)
          : d.state === 'progressing' ? `${fmtBytes(d.received)} / ${fmtBytes(d.total) || '…'}`
          : d.state;
        row.innerHTML = `
          <div class="dl-info">
            <span class="pr-title">${esc(d.filename)}</span>
            <span class="pr-sub">${esc(meta)}</span>
            ${d.state === 'progressing' ? `<span class="dl-bar"><i style="width:${pct}%"></i></span>` : ''}
          </div>
          <div class="dl-actions"></div>`;
        const actions = row.querySelector('.dl-actions');
        if (done) {
          actions.innerHTML = `<button class="dl-act" data-a="open">Open</button><button class="dl-act" data-a="show">Show</button>`;
          actions.querySelector('[data-a="open"]').addEventListener('click', () => window.tandem.downloads.open(d.path));
          actions.querySelector('[data-a="show"]').addEventListener('click', () => window.tandem.downloads.showInFolder(d.path));
        } else if (d.state === 'progressing') {
          actions.innerHTML = `<button class="dl-act" data-a="cancel">Cancel</button>`;
          actions.querySelector('[data-a="cancel"]').addEventListener('click', () => window.tandem.downloads.cancel(d.id));
        }
        body.appendChild(row);
      }
    });
  }

  /* -------- command routing -------- */

  function handleCommand(action) {
    switch (action) {
      case 'browser:new-tab': manager.createTab(); break;
      case 'browser:new-incognito': manager.createTab({ incognito: true }); break;
      case 'browser:reopen-tab': manager.reopenClosed(); break;
      case 'browser:close-tab': if (manager.activeId) manager.closeTab(manager.activeId); break;
      case 'browser:duplicate': if (manager.activeId) manager.duplicate(manager.activeId); break;
      case 'browser:pin': if (manager.activeId) manager.togglePin(manager.activeId); break;
      case 'browser:mute': if (manager.activeId) manager.toggleMute(manager.activeId); break;
      case 'browser:group': if (manager.activeId) manager.addToNewGroup(manager.activeId); break;
      case 'browser:reload': manager.reload(); break;
      case 'browser:back': manager.back(); break;
      case 'browser:forward': manager.forward(); break;
      case 'browser:home': manager.home(); break;
      case 'browser:find': openFind(); break;
      case 'browser:zoom-in': manager.zoom(0.5); break;
      case 'browser:zoom-out': manager.zoom(-0.5); break;
      case 'browser:zoom-reset': manager.zoom(0); break;
      case 'browser:bookmark': toggleBookmark(); break;
      case 'browser:toggle-bookmarks': els.bookmarks.classList.toggle('is-hidden'); break;
      case 'browser:history': showHistory(); break;
      case 'browser:downloads': showDownloads(); break;
      case 'browser:print': manager.print(); break;
      case 'browser:view-source': manager.viewSource(); break;
      case 'browser:devtools': manager.toggleDevtools(); break;
      case 'browser:tab-search': ctx.showContextMenu(manager.tabList(), window.innerWidth - 280, 96); break;
      default: break;
    }
  }

  manager.createTab(); // boot first tab

  return {
    handleCommand,
    activate: () => manager.activeTab()?.webview.focus(),
    zoomPercent: () => manager.zoomPercent(),
    openUrl: (url) => manager.createTab({ url }),
  };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

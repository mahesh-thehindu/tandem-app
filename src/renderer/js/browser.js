'use strict';

// Chromium-style browser surface: multi-tab webview management, omnibox,
// bookmarks bar, in-page find, and zoom. Returns an API the app router uses.

const START_URL = 'https://duckduckgo.com';

export function initBrowser(root, ctx) {
  const els = {
    tabs: root.querySelector('#chrome-tabs'),
    newTab: root.querySelector('#chrome-newtab'),
    stack: root.querySelector('#webview-stack'),
    omnibox: root.querySelector('#omnibox-input'),
    lock: root.querySelector('#omni-lock'),
    star: root.querySelector('#omni-star'),
    bookmarks: root.querySelector('#bookmarks-bar'),
    findBar: root.querySelector('#find-bar'),
    findInput: root.querySelector('#find-input'),
    findCount: root.querySelector('#find-count'),
  };

  const tabs = new Map(); // id -> { id, webview, dom, title, url, ready }
  const history = [];
  const bookmarks = [
    { title: 'DuckDuckGo', url: 'https://duckduckgo.com' },
    { title: 'GitHub', url: 'https://github.com' },
    { title: 'MDN', url: 'https://developer.mozilla.org' },
  ];
  let activeId = null;
  let seq = 0;

  /* -------- tab creation -------- */

  function createTab(url = START_URL) {
    const id = `tab-${++seq}`;

    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('partition', 'persist:tandem');
    webview.classList.add('is-hidden');
    els.stack.appendChild(webview);

    const dom = document.createElement('div');
    dom.className = 'chrome-tab';
    dom.dataset.id = id;
    dom.innerHTML = `
      <span class="tab-favicon spinner"></span>
      <span class="tab-title">New Tab</span>
      <button class="tab-close" title="Close tab">✕</button>`;
    dom.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tab-close')) return;
      activateTab(id);
    });
    dom.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });
    els.tabs.appendChild(dom);

    const tab = { id, webview, dom, title: 'New Tab', url, ready: false };
    tabs.set(id, tab);
    wireWebview(tab);
    activateTab(id);
    return tab;
  }

  function wireWebview(tab) {
    const { webview } = tab;
    const favicon = tab.dom.querySelector('.tab-favicon');
    const titleEl = tab.dom.querySelector('.tab-title');

    webview.addEventListener('dom-ready', () => { tab.ready = true; updateNav(); });

    webview.addEventListener('did-start-loading', () => favicon.classList.add('spinner'));
    webview.addEventListener('did-stop-loading', () => favicon.classList.remove('spinner'));

    const onNav = (e) => {
      if (!e.url) return;
      tab.url = e.url;
      history.push({ url: e.url, title: tab.title, time: Date.now() });
      if (tab.id === activeId) syncOmnibox(tab);
      updateNav();
    };
    webview.addEventListener('did-navigate', onNav);
    webview.addEventListener('did-navigate-in-page', onNav);

    webview.addEventListener('page-title-updated', (e) => {
      tab.title = e.title || tab.url;
      titleEl.textContent = tab.title;
      titleEl.title = tab.title;
    });

    webview.addEventListener('page-favicon-updated', (e) => {
      const url = e.favicons && e.favicons[0];
      if (url) {
        favicon.classList.remove('spinner');
        favicon.style.backgroundImage = `url("${url}")`;
        favicon.style.backgroundSize = 'cover';
      }
    });

    // target=_blank / window.open -> open as a new tab instead of a popup.
    webview.addEventListener('new-window', (e) => {
      if (e.url) createTab(e.url);
    });

    webview.addEventListener('found-in-page', (e) => {
      const r = e.result;
      els.findCount.textContent = r.matches ? `${r.activeMatchOrdinal}/${r.matches}` : 'No results';
    });
  }

  /* -------- activation / closing -------- */

  function activateTab(id) {
    const tab = tabs.get(id);
    if (!tab) return;
    activeId = id;
    for (const t of tabs.values()) {
      const on = t.id === id;
      t.dom.classList.toggle('is-active', on);
      t.webview.classList.toggle('is-hidden', !on);
    }
    syncOmnibox(tab);
    updateNav();
  }

  function closeTab(id) {
    const tab = tabs.get(id);
    if (!tab) return;
    const ids = [...tabs.keys()];
    const idx = ids.indexOf(id);
    tab.dom.remove();
    tab.webview.remove();
    tabs.delete(id);

    if (tabs.size === 0) {
      createTab();
      return;
    }
    if (activeId === id) {
      const next = ids[idx + 1] || ids[idx - 1];
      activateTab(next);
    }
  }

  /* -------- omnibox + nav -------- */

  function activeTab() {
    return tabs.get(activeId);
  }

  function syncOmnibox(tab) {
    els.omnibox.value = tab.url;
    const secure = tab.url.startsWith('https://');
    els.lock.classList.toggle('insecure', !secure);
    const saved = bookmarks.some((b) => b.url === tab.url);
    els.star.classList.toggle('is-saved', saved);
  }

  function updateNav() {
    const tab = activeTab();
    const back = root.querySelector('[data-act="browser:back"]');
    const fwd = root.querySelector('[data-act="browser:forward"]');
    if (!tab || !tab.ready) {
      back.disabled = true;
      fwd.disabled = true;
      return;
    }
    try {
      back.disabled = !tab.webview.canGoBack();
      fwd.disabled = !tab.webview.canGoForward();
    } catch {
      back.disabled = fwd.disabled = true;
    }
  }

  function normalizeUrl(raw) {
    const v = raw.trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[^\s]+\.[^\s]+$/.test(v)) return `https://${v}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(v)}`;
  }

  function navigate(raw) {
    const tab = activeTab();
    const url = normalizeUrl(raw);
    if (tab && tab.ready && url) tab.webview.loadURL(url);
  }

  els.omnibox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigate(els.omnibox.value);
  });
  els.omnibox.addEventListener('focus', () => els.omnibox.select());
  els.newTab.addEventListener('click', () => createTab());

  // Toolbar buttons that carry a data-act dispatch through the app router.
  root.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => ctx.dispatch(btn.dataset.act));
  });

  /* -------- bookmarks -------- */

  function renderBookmarks() {
    els.bookmarks.innerHTML = '';
    for (const bm of bookmarks) {
      const chip = document.createElement('button');
      chip.className = 'bookmark-chip';
      chip.innerHTML = `<span class="bm-dot"></span>${bm.title}`;
      chip.addEventListener('click', () => navigate(bm.url));
      els.bookmarks.appendChild(chip);
    }
  }
  renderBookmarks();

  function toggleBookmark() {
    const tab = activeTab();
    if (!tab) return;
    const i = bookmarks.findIndex((b) => b.url === tab.url);
    if (i >= 0) {
      bookmarks.splice(i, 1);
      ctx.toast('Bookmark removed');
    } else {
      bookmarks.push({ title: tab.title || tab.url, url: tab.url });
      ctx.toast('Bookmarked');
    }
    renderBookmarks();
    syncOmnibox(tab);
  }

  /* -------- find in page -------- */

  function openFind() {
    els.findBar.hidden = false;
    els.findInput.focus();
    els.findInput.select();
  }
  function closeFind() {
    els.findBar.hidden = true;
    els.findCount.textContent = '';
    const tab = activeTab();
    if (tab && tab.ready) tab.webview.stopFindInPage('clearSelection');
  }
  function runFind(forward = true) {
    const tab = activeTab();
    const q = els.findInput.value;
    if (tab && tab.ready && q) tab.webview.findInPage(q, { forward, findNext: true });
  }
  els.findInput.addEventListener('input', () => runFind(true));
  els.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runFind(!e.shiftKey);
    if (e.key === 'Escape') closeFind();
  });
  root.querySelector('#find-next').addEventListener('click', () => runFind(true));
  root.querySelector('#find-prev').addEventListener('click', () => runFind(false));
  root.querySelector('#find-close').addEventListener('click', closeFind);

  /* -------- zoom -------- */

  function zoom(delta) {
    const tab = activeTab();
    if (!tab || !tab.ready) return;
    if (delta === 0) tab.webview.setZoomLevel(0);
    else tab.webview.setZoomLevel(tab.webview.getZoomLevel() + delta);
  }
  function zoomPercent() {
    const tab = activeTab();
    if (!tab || !tab.ready) return 100;
    return Math.round(100 * 1.2 ** tab.webview.getZoomLevel());
  }

  /* -------- command routing -------- */

  function handleCommand(action) {
    const tab = activeTab();
    switch (action) {
      case 'browser:new-tab': createTab(); break;
      case 'browser:close-tab': if (activeId) closeTab(activeId); break;
      case 'browser:reload': if (tab && tab.ready) tab.webview.reload(); break;
      case 'browser:back': if (tab && tab.ready && tab.webview.canGoBack()) tab.webview.goBack(); break;
      case 'browser:forward': if (tab && tab.ready && tab.webview.canGoForward()) tab.webview.goForward(); break;
      case 'browser:home': navigate(START_URL); break;
      case 'browser:find': openFind(); break;
      case 'browser:zoom-in': zoom(0.5); break;
      case 'browser:zoom-out': zoom(-0.5); break;
      case 'browser:zoom-reset': zoom(0); break;
      case 'browser:bookmark': toggleBookmark(); break;
      case 'browser:toggle-bookmarks': els.bookmarks.classList.toggle('is-hidden'); break;
      case 'browser:history': showHistory(); break;
      default: break;
    }
  }

  function showHistory() {
    const rows = [...history].reverse().slice(0, 100);
    ctx.showPanel('History', (body) => {
      if (rows.length === 0) {
        body.innerHTML = '<div class="panel-empty">No history yet.</div>';
        return;
      }
      for (const h of rows) {
        const row = document.createElement('div');
        row.className = 'panel-row';
        const t = new Date(h.time);
        row.innerHTML = `<span class="pr-title">${escapeHtml(h.title || h.url)}</span>
                         <span class="pr-sub">${escapeHtml(h.url)} · ${t.toLocaleTimeString()}</span>`;
        row.addEventListener('click', () => { navigate(h.url); ctx.hidePanel(); });
        body.appendChild(row);
      }
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Boot the first tab.
  createTab();

  return { handleCommand, activate: () => activeTab()?.webview.focus(), zoomPercent };
}

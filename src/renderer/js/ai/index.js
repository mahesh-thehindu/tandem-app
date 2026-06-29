'use strict';

// AI workspace: embeds LLM assistants (Claude, Kimi) as full webviews so you can
// chat without leaving the app. Logins persist via the dedicated partition.
// Add a provider by appending to PROVIDERS — everything else is data-driven.

const PARTITION = 'persist:tandem-ai';
const PROVIDER_KEY = 'tandem:ai-provider';

export const PROVIDERS = [
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', dot: '#d97757' },
  { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com', dot: '#6d5efc' },
];

export function initAi(root, ctx) {
  const stack = root.querySelector('#ai-stack');
  const switcher = root.querySelector('#ai-switcher');
  const views = new Map(); // providerId -> webview (created lazily)

  let current = localStorage.getItem(PROVIDER_KEY) || PROVIDERS[0].id;
  if (!PROVIDERS.some((p) => p.id === current)) current = PROVIDERS[0].id;

  function ensureView(id) {
    if (views.has(id)) return views.get(id);
    const p = PROVIDERS.find((x) => x.id === id);
    const wv = document.createElement('webview');
    wv.setAttribute('partition', PARTITION);
    wv.setAttribute('src', p.url);
    wv.setAttribute('allowpopups', ''); // OAuth/login popups
    wv.classList.add('is-hidden');
    stack.appendChild(wv);
    views.set(id, wv);
    return wv;
  }

  function select(id) {
    const p = PROVIDERS.find((x) => x.id === id);
    if (!p) return;
    current = id;
    localStorage.setItem(PROVIDER_KEY, id);
    ensureView(id);
    for (const [vid, wv] of views) wv.classList.toggle('is-hidden', vid !== id);
    renderSwitcher();
  }

  function renderSwitcher() {
    switcher.innerHTML = '';
    for (const p of PROVIDERS) {
      const b = document.createElement('button');
      b.className = 'ai-pill' + (p.id === current ? ' is-active' : '');
      b.innerHTML = `<span class="ai-dot" style="background:${p.dot}"></span>${p.name}`;
      b.addEventListener('click', () => select(p.id));
      switcher.appendChild(b);
    }
    const reload = document.createElement('button');
    reload.className = 'ai-reload';
    reload.title = 'Reload';
    reload.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-.5 4M20 5v6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    reload.addEventListener('click', () => { try { views.get(current)?.reload(); } catch { /* not ready */ } });
    switcher.appendChild(reload);
  }
  renderSwitcher();

  function handleCommand(action) {
    if (action === 'ai:open') { select(current); return; }
    if (action === 'ai:reload') { try { views.get(current)?.reload(); } catch { /* not ready */ } return; }
    if (action.startsWith('ai:provider:')) select(action.slice('ai:provider:'.length));
  }

  return {
    handleCommand,
    activate: () => { select(current); try { views.get(current)?.focus(); } catch { /* not ready */ } },
  };
}

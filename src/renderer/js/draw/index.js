'use strict';

// Canvas mode: an infinite drawing surface in a <webview>, built on the
// open-source Excalidraw engine but presented entirely as "Canvas" — the
// engine's own branding (welcome logo, upsell buttons) is stripped on load.

const CANVAS_URL = 'https://excalidraw.com';

// Hide the embedded app's branding so nothing reads "Excalidraw" in-app.
const HIDE_CSS = `
  [class*="welcome-screen"] { display: none !important; }   /* big logo + onboarding */
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
  let webview = null;

  function debrand() {
    if (!webview) return;
    webview.insertCSS(HIDE_CSS).catch(() => {});
    webview.executeJavaScript(SCRUB_JS).catch(() => {});
  }

  function open() {
    if (!webview) {
      webview = document.createElement('webview');
      webview.className = 'draw-webview';
      webview.setAttribute('partition', 'persist:tandem-draw');
      webview.setAttribute('src', CANVAS_URL);
      // Strip branding once the page is ready and after any in-app navigation.
      webview.addEventListener('dom-ready', debrand);
      webview.addEventListener('did-finish-load', debrand);
      stage.appendChild(webview);
    }
    if (empty) empty.hidden = true;
  }

  root.querySelector('#draw-new-cta')?.addEventListener('click', open);

  function handleCommand(action) {
    if (action === 'draw:new') open();
  }
  function activate() { webview?.focus(); }

  return { handleCommand, activate, open, hasBoard: () => !!webview };
}

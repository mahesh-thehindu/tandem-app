'use strict';

// Whiteboard mode: an Excalidraw canvas in a <webview>. Excalidraw is a web app,
// so it slots in like the browser/code surfaces. Drawings persist locally via
// the dedicated partition.

const EXCALIDRAW_URL = 'https://excalidraw.com';

export function initDraw(root, ctx) {
  const stage = root.querySelector('#draw-stage');
  const empty = root.querySelector('#draw-empty');
  let webview = null;

  function open() {
    if (!webview) {
      webview = document.createElement('webview');
      webview.className = 'draw-webview';
      webview.setAttribute('partition', 'persist:tandem-draw');
      webview.setAttribute('src', EXCALIDRAW_URL);
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

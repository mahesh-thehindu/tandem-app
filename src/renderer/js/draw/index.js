'use strict';

// Canvas mode: an infinite drawing surface in a <webview>, built on the
// open-source Excalidraw web app. Two flavors share one view:
//   • Canvas      — the free board (excalidraw.com), saved locally
//   • Excalidraw+ — the pro app (plus.excalidraw.com) for sync/collaboration

const CANVAS_URL = 'https://excalidraw.com';
const PLUS_URL = 'https://plus.excalidraw.com';

export function initDraw(root, ctx) {
  const stage = root.querySelector('#draw-stage');
  const empty = root.querySelector('#draw-empty');
  const label = () => document.getElementById('draw-tab-label');
  let webview = null;
  let current = null; // 'canvas' | 'plus'

  function open(which) {
    const url = which === 'plus' ? PLUS_URL : CANVAS_URL;
    if (!webview) {
      webview = document.createElement('webview');
      webview.className = 'draw-webview';
      webview.setAttribute('partition', 'persist:tandem-draw');
      stage.appendChild(webview);
    }
    if (current !== which) {
      webview.setAttribute('src', url);
      current = which;
    }
    if (label()) label().textContent = which === 'plus' ? 'Excalidraw+' : 'Canvas';
    if (empty) empty.hidden = true;
  }

  root.querySelector('#draw-new-cta')?.addEventListener('click', () => open('canvas'));
  root.querySelector('#draw-plus-cta')?.addEventListener('click', () => open('plus'));

  function handleCommand(action) {
    if (action === 'draw:new') open('canvas');
    else if (action === 'draw:plus') open('plus');
  }
  function activate() { webview?.focus(); }

  return { handleCommand, activate, open, hasBoard: () => !!webview };
}

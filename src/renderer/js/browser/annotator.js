'use strict';

// Ulaa's screen-capture + annotate tool. Grabs the current page, lets you draw
// on it, then copy or download the result. Pure renderer-side (canvas + webview
// capturePage); nothing is uploaded.

const PEN_COLORS = ['#ff5c39', '#ffd166', '#4fd6b8', '#6d9bff', '#ff8bcb', '#ffffff'];

export async function captureAndAnnotate(webview, toast) {
  if (!webview || typeof webview.capturePage !== 'function') {
    toast?.('Nothing to capture');
    return;
  }
  let image;
  try {
    image = await webview.capturePage();
  } catch {
    toast?.('Capture failed');
    return;
  }
  const dataUrl = image.toDataURL();
  if (!dataUrl || dataUrl.length < 30) { toast?.('Capture failed'); return; }

  openEditor(dataUrl, toast);
}

function openEditor(dataUrl, toast) {
  const scrim = document.createElement('div');
  scrim.className = 'annotate-scrim';
  scrim.innerHTML = `
    <div class="annotate-card">
      <div class="annotate-bar">
        <span class="annotate-title">Capture &amp; annotate</span>
        <span class="annotate-pens"></span>
        <span class="annotate-grow"></span>
        <button class="annotate-btn" data-a="clear">Clear</button>
        <button class="annotate-btn" data-a="copy">Copy</button>
        <button class="annotate-btn primary" data-a="save">Save</button>
        <button class="annotate-btn" data-a="close">✕</button>
      </div>
      <div class="annotate-stage"><canvas class="annotate-canvas"></canvas></div>
    </div>`;
  document.body.appendChild(scrim);

  const canvas = scrim.querySelector('.annotate-canvas');
  const ctx2d = canvas.getContext('2d');
  const img = new Image();
  let pen = PEN_COLORS[0];

  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx2d.drawImage(img, 0, 0);
  };
  img.src = dataUrl;

  // Pen swatches
  const pens = scrim.querySelector('.annotate-pens');
  PEN_COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'annotate-pen' + (i === 0 ? ' is-active' : '');
    b.style.background = c;
    b.addEventListener('click', () => {
      pen = c;
      pens.querySelectorAll('.annotate-pen').forEach((p) => p.classList.remove('is-active'));
      b.classList.add('is-active');
    });
    pens.appendChild(b);
  });

  // Freehand drawing in canvas pixel space.
  let drawing = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    const p = pos(e);
    ctx2d.beginPath();
    ctx2d.moveTo(p.x, p.y);
    ctx2d.lineWidth = 4;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
    ctx2d.strokeStyle = pen;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx2d.lineTo(p.x, p.y);
    ctx2d.stroke();
  });
  window.addEventListener('mouseup', () => { drawing = false; });

  const close = () => scrim.remove();

  scrim.querySelector('[data-a="close"]').addEventListener('click', close);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  scrim.querySelector('[data-a="clear"]').addEventListener('click', () => {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    ctx2d.drawImage(img, 0, 0);
  });
  scrim.querySelector('[data-a="save"]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `ulaa-capture-${stamp()}.png`;
    a.click();
    toast?.('Saved capture');
  });
  scrim.querySelector('[data-a="copy"]').addEventListener('click', async () => {
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast?.('Copied to clipboard');
    } catch {
      toast?.('Copy not available');
    }
  });
}

function stamp() {
  // Avoid Date in a way that's stable enough for a filename suffix.
  return String(performance.now()).replace('.', '').slice(0, 13);
}

'use strict';

// Code mode: opens a folder in a local code-server (real VS Code) and shows it
// in a <webview>. The heavy lifting (spawning the server) is in the main process.

export function initCode(root, ctx) {
  const stage = root.querySelector('#code-stage');
  const empty = root.querySelector('#code-empty');
  const folderLabel = document.getElementById('code-folder');
  let webview = null;
  let folder = null;
  let starting = false;

  async function openFolder() {
    if (starting) return;
    starting = true;
    ctx.toast('Starting VS Code…');
    try {
      const res = await window.tandem.code.openFolder();
      if (!res) return;
      if (res.error) { ctx.toast(`Code: ${res.error}`); return; }
      loadWorkspace(res.url, res.folder);
    } finally {
      starting = false;
    }
  }

  function loadWorkspace(url, f) {
    folder = f;
    folderLabel.textContent = f.split('/').filter(Boolean).pop() || f;
    folderLabel.title = f;
    empty.hidden = true;
    if (!webview) {
      webview = document.createElement('webview');
      webview.className = 'code-webview';
      webview.setAttribute('partition', 'persist:tandem-code');
      stage.appendChild(webview);
    }
    webview.src = url;
  }

  // The cluster button opens the picker only when no folder is open yet;
  // otherwise it just acts as the tab (the cluster's mousedown switches mode).
  document.getElementById('code-open').addEventListener('click', () => { if (!folder) openFolder(); });
  root.querySelector('#code-open-2')?.addEventListener('click', openFolder);

  function handleCommand(action) {
    if (action === 'code:open-folder') openFolder();
  }

  function activate() {
    if (webview) webview.focus();
  }

  return { handleCommand, activate, openFolder, hasFolder: () => !!folder };
}

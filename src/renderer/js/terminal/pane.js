'use strict';

// A single terminal pane: one xterm bound to one pty, with fit/search/web-links
// addons and OSC 133 command-block decorations (the colored status bars at the
// left edge of each command, Warp-style).

let seq = 0;

export class Pane {
  constructor(ctx) {
    this.ctx = ctx; // { api, theme, fontSize, onFocus, openUrl, registerPane, unregisterPane }
    this.id = `pane-${++seq}`;
    this.blocks = [];
    this.el = document.createElement('div');
    this.el.className = 'warp-pane';
    this.el.innerHTML = `
      <div class="pane-term"></div>
      <div class="pane-find" hidden>
        <input class="pane-find-input" type="text" placeholder="Find" spellcheck="false" />
        <span class="pane-find-count"></span>
        <button class="pane-find-btn" data-f="prev" title="Previous">‹</button>
        <button class="pane-find-btn" data-f="next" title="Next">›</button>
        <button class="pane-find-btn" data-f="close" title="Close">✕</button>
      </div>`;
  }

  mount() {
    const term = new window.Terminal({
      fontFamily: '"MesloLGS NF", ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: this.ctx.fontSize(),
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
      theme: this.ctx.theme(),
    });
    const fit = new window.FitAddon.FitAddon();
    const search = new window.SearchAddon.SearchAddon();
    const links = new window.WebLinksAddon.WebLinksAddon((_e, uri) => this.ctx.openUrl(uri));
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(links);
    term.open(this.el.querySelector('.pane-term'));
    fit.fit();

    this.term = term;
    this.fitAddon = fit;
    this.searchAddon = search;

    // Block markers from the shell (OSC 133).
    term.parser.registerOscHandler(133, (data) => { this.onOsc(data); return true; });

    this.ctx.api.create({ id: this.id, cols: term.cols, rows: term.rows });
    term.onData((d) => this.ctx.api.write(this.id, d));
    this.el.querySelector('.pane-term').addEventListener('mousedown', () => this.ctx.onFocus(this));
    term.textarea?.addEventListener('focus', () => this.ctx.onFocus(this));

    this.ctx.registerPane(this);
    this.wireFind();
    return this;
  }

  write(data) { this.term.write(data); }

  /* ---- OSC 133 command blocks ---- */

  onOsc(data) {
    const [kind, arg] = data.split(';');
    if (kind === 'A') this.startBlock();
    else if (kind === 'D') this.endBlock(arg);
  }

  startBlock() {
    const marker = this.term.registerMarker(0);
    if (!marker) return;
    const block = { marker, exit: null, el: null };
    try {
      const deco = this.term.registerDecoration({ marker, x: 0, width: 1 });
      deco.onRender((el) => { block.el = el; this.paintBlock(block); });
      block.deco = deco;
    } catch (_e) { /* decoration unsupported */ }
    this.blocks.push(block);
    this.ctx.onBlocks?.(this);
  }

  endBlock(code) {
    const block = this.blocks[this.blocks.length - 1];
    if (!block) return;
    block.exit = Number.parseInt(code, 10);
    this.paintBlock(block);
  }

  paintBlock(b) {
    if (!b.el) return;
    b.el.className = 'cmd-bar' + (b.exit === null ? ' running' : b.exit === 0 ? ' ok' : ' err');
  }

  jumpCommand(dir) {
    const lines = this.blocks.map((b) => b.marker?.line).filter((l) => typeof l === 'number');
    if (!lines.length) return;
    const top = this.term.buffer.active.viewportY;
    let target;
    if (dir > 0) target = lines.find((l) => l > top + 1);
    else target = [...lines].reverse().find((l) => l < top - 1);
    if (typeof target === 'number') this.term.scrollToLine(target);
  }

  copyLastOutput() {
    if (this.blocks.length < 1) return;
    const buf = this.term.buffer.active;
    const start = this.blocks[this.blocks.length - 1].marker?.line ?? 0;
    const end = buf.length;
    let text = '';
    for (let i = start; i < end; i++) text += (buf.getLine(i)?.translateToString(true) ?? '') + '\n';
    navigator.clipboard.writeText(text.trim());
    this.ctx.toast('Copied command output');
  }

  /* ---- find ---- */

  wireFind() {
    const bar = this.el.querySelector('.pane-find');
    const input = this.el.querySelector('.pane-find-input');
    const count = this.el.querySelector('.pane-find-count');
    const opts = { decorations: { matchOverviewRuler: '#6d9bff', activeMatchColorOverviewRuler: '#4fd6b8' } };
    this.searchAddon.onDidChangeResults?.((r) => {
      count.textContent = r && r.resultCount >= 0 ? `${r.resultIndex + 1}/${r.resultCount}` : '';
    });
    this._find = {
      open: () => { bar.hidden = false; input.focus(); input.select(); },
      close: () => { bar.hidden = true; this.searchAddon.clearDecorations?.(); this.term.focus(); },
    };
    input.addEventListener('input', () => this.searchAddon.findNext(input.value, opts));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchAddon.findNext(input.value, { ...opts, incremental: false });
      if (e.key === 'Enter' && e.shiftKey) this.searchAddon.findPrevious(input.value, opts);
      if (e.key === 'Escape') this._find.close();
    });
    bar.querySelector('[data-f="next"]').addEventListener('click', () => this.searchAddon.findNext(input.value, opts));
    bar.querySelector('[data-f="prev"]').addEventListener('click', () => this.searchAddon.findPrevious(input.value, opts));
    bar.querySelector('[data-f="close"]').addEventListener('click', () => this._find.close());
  }
  openFind() { this._find.open(); }

  /* ---- lifecycle ---- */

  fit() {
    try {
      this.fitAddon.fit();
      this.ctx.api.resize(this.id, this.term.cols, this.term.rows);
    } catch (_e) { /* not yet laid out */ }
  }
  focus() { this.term.focus(); }
  setActive(on) { this.el.classList.toggle('is-focused', on); }
  setTheme(theme) { this.term.options.theme = theme; }
  setFontSize(px) { this.term.options.fontSize = px; this.fit(); }
  clear() { this.term.clear(); }

  dispose() {
    this.ctx.api.kill(this.id);
    this.ctx.unregisterPane(this);
    try { this.term.dispose(); } catch (_e) { /* already gone */ }
    this.el.remove();
  }
}

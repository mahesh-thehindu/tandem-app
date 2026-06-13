'use strict';

import { Pane } from './pane.js';

// A terminal session (one tab) holding a binary split tree of panes.
// Leaf nodes are Pane instances; internal nodes are { split, dir, children }.

let seq = 0;

export class Session {
  constructor(ctx) {
    this.ctx = ctx;
    this.num = ++seq;
    this.activePane = null;
    this.el = document.createElement('div');
    this.el.className = 'warp-session';
    // No in-window header — the attached tab already identifies the session.
    this.el.innerHTML = `
      <div class="session-body"></div>
      <div class="warp-hint">
        <span><kbd>⌘P</kbd> palette</span>
        <span><kbd>⌘D</kbd> split</span>
        <span><kbd>⌘F</kbd> find</span>
        <span><kbd>⌘↑/↓</kbd> jump command</span>
      </div>`;
  }

  mount() {
    const pane = new Pane(this.paneCtx()).mount();
    this.root = pane;
    this.activePane = pane;
    this.layout();
    return this;
  }

  paneCtx() {
    return {
      ...this.ctx, // api, theme, fontSize, openUrl, toast, showContextMenu, bookmarkCommand, ...
      onFocus: (p) => this.setActivePane(p),
      onBlocks: () => this.updateBlockCount(),
      split: (dir) => this.split(dir),
      closePane: () => this.closePane(),
    };
  }

  currentCommand() { return this.activePane?.currentCommand() || ''; }
  typeIntoActive(text) { this.activePane?.type(text); }

  /* ---- tree ops ---- */

  panes() {
    const acc = [];
    (function walk(n) { n.split ? n.children.forEach(walk) : acc.push(n); })(this.root);
    return acc;
  }

  setActivePane(p) {
    this.activePane = p;
    for (const pane of this.panes()) pane.setActive(pane === p);
    this.updateBlockCount();
  }

  split(dir) {
    const target = this.activePane;
    const fresh = new Pane(this.paneCtx()).mount();
    const node = { split: true, dir, children: [target, fresh] };
    this.root = this._replace(this.root, target, node);
    this.layout();
    this.setActivePane(fresh);
    fresh.focus();
  }

  closePane() {
    const target = this.activePane;
    const remaining = this.panes().filter((p) => p !== target);
    if (remaining.length === 0) { this.ctx.onEmpty(this); return; } // last pane -> close session
    target.dispose();
    this.root = this._remove(this.root, target);
    this.layout();
    this.setActivePane(remaining[0]);
    remaining[0].focus();
  }

  focusNext() {
    const list = this.panes();
    if (list.length < 2) return;
    const i = list.indexOf(this.activePane);
    const next = list[(i + 1) % list.length];
    this.setActivePane(next);
    next.focus();
  }

  _replace(node, target, replacement) {
    if (node === target) return replacement;
    if (node.split) node.children = node.children.map((c) => this._replace(c, target, replacement));
    return node;
  }
  _remove(node, target) {
    if (!node.split) return node === target ? null : node;
    node.children = node.children.map((c) => this._remove(c, target)).filter(Boolean);
    return node.children.length === 1 ? node.children[0] : node;
  }

  /* ---- layout ---- */

  layout() {
    const body = this.el.querySelector('.session-body');
    body.replaceChildren(this._build(this.root));
    requestAnimationFrame(() => this.panes().forEach((p) => p.fit()));
  }
  _build(node) {
    if (!node.split) return node.el;
    const wrap = document.createElement('div');
    wrap.className = `warp-split ${node.dir}`;
    node.children.forEach((c, i) => {
      if (i > 0) {
        const d = document.createElement('div');
        d.className = 'split-divider';
        wrap.appendChild(d);
      }
      wrap.appendChild(this._build(c));
    });
    return wrap;
  }

  updateBlockCount() {
    const el = this.el.querySelector('.wsh-blocks');
    if (!el) return; // header removed; nothing to update
    const n = this.activePane ? this.activePane.blocks.length : 0;
    el.textContent = n ? `${n} ⌘` : '';
  }

  /* ---- delegation to active pane ---- */

  activate() { this.fitAll(); this.activePane?.focus(); }
  fitAll() { this.panes().forEach((p) => p.fit()); }
  clear() { this.activePane?.clear(); }
  find() { this.activePane?.openFind(); }
  jump(dir) { this.activePane?.jumpCommand(dir); }
  copyOutput() { this.activePane?.copyLastOutput(); }
  setTheme(t) { this.panes().forEach((p) => p.setTheme(t)); }
  setFontSize(px) { this.panes().forEach((p) => p.setFontSize(px)); }
  dispose() { this.panes().forEach((p) => p.dispose()); this.el.remove(); }
}

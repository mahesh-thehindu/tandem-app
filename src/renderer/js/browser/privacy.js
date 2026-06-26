'use strict';

// Ulaa's tracker shield + privacy dashboard. Listens to the main-process
// blocker's telemetry, shows a live count for the active page, and keeps a
// cumulative "blocked today" tally.

const TODAY_KEY = 'ulaa:blocked-today';

export class PrivacyShield {
  constructor(els, getActiveWcId) {
    this.btn = els.btn; // shield button
    this.badge = els.badge; // count badge inside the button
    this.getActiveWcId = getActiveWcId; // () => number | null
    this.pageCounts = new Map(); // wcId -> blocked on current page
    this.lastSeen = new Map(); // wcId -> last absolute count (for deltas)
    this.today = this._loadToday();

    window.tandem.ulaa.onBlocked(({ wcId, count }) => this._onBlocked(wcId, count));
  }

  _loadToday() {
    try {
      const raw = JSON.parse(localStorage.getItem(TODAY_KEY) || '{}');
      const key = new Date().toISOString().slice(0, 10);
      return raw.date === key ? raw.n : 0;
    } catch { return 0; }
  }
  _saveToday() {
    const key = new Date().toISOString().slice(0, 10);
    localStorage.setItem(TODAY_KEY, JSON.stringify({ date: key, n: this.today }));
  }

  _onBlocked(wcId, count) {
    const prev = this.lastSeen.get(wcId) || 0;
    const delta = count > prev ? count - prev : 0; // new page resets to 0 -> no delta
    if (delta > 0) { this.today += delta; this._saveToday(); }
    this.lastSeen.set(wcId, count);
    this.pageCounts.set(wcId, count);
    this.refresh();
  }

  activeCount() {
    const id = this.getActiveWcId();
    return id != null ? (this.pageCounts.get(id) || 0) : 0;
  }
  blockedToday() { return this.today; }

  refresh() {
    const n = this.activeCount();
    this.badge.textContent = n > 99 ? '99+' : String(n);
    this.badge.hidden = n === 0;
    this.btn.classList.toggle('has-blocks', n > 0);
  }

  openDashboard(ctx, modeController) {
    const mode = modeController.mode();
    const blocking = mode.id !== 'openseason';
    ctx.showPanel('Privacy', (body) => {
      // Hero numbers
      const hero = document.createElement('div');
      hero.className = 'pv-hero';
      hero.innerHTML = `
        <div class="pv-stat"><b>${this.activeCount()}</b><span>blocked on this page</span></div>
        <div class="pv-stat"><b>${this.today}</b><span>blocked today</span></div>`;
      body.appendChild(hero);

      // Active mode
      const modeRow = document.createElement('div');
      modeRow.className = 'pv-mode';
      modeRow.innerHTML = `
        <span class="pv-dot" style="background:${mode.dot}"></span>
        <div><b>${mode.name} Mode</b><span>${mode.blurb}</span></div>`;
      body.appendChild(modeRow);

      // Protection list — state derived from the active mode.
      const protections = [
        ['Ad &amp; tracker blocking', blocking],
        ['Fingerprint protection', blocking],
        ['DNS prefetch disabled', true],
        ['Motion &amp; sensor blocking', true],
        ['Lookalike-URL guard', true],
        ['Auto-reset browser IDs', true],
        ['Distraction blocking', mode.id === 'work'],
        ['Safe search &amp; unsafe-site filter', mode.id === 'kids'],
      ];
      const list = document.createElement('div');
      list.className = 'pv-list';
      for (const [label, on] of protections) {
        const row = document.createElement('div');
        row.className = 'pv-prot' + (on ? ' on' : '');
        row.innerHTML = `<span>${label}</span><span class="pv-pill">${on ? 'On' : 'Off'}</span>`;
        list.appendChild(row);
      }
      body.appendChild(list);
    });
  }
}

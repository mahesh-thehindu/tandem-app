'use strict';

// Ulaa's five browsing modes. Each maps to a rule-set the main-process blocker
// enforces (see src/main/browser/blocker.js); here we own the UI + persistence.

export const MODES = [
  {
    id: 'personal', name: 'Personal', dot: '#ff5c39',
    blurb: 'Enhanced privacy with full browsing history and saved logins.',
  },
  {
    id: 'work', name: 'Work', dot: '#6d9bff',
    blurb: 'Blocks distracting sites and ads to keep you focused.',
  },
  {
    id: 'kids', name: 'Kids', dot: '#4fd6b8',
    blurb: 'Safe browsing — filters unsafe sites and forces safe search.',
  },
  {
    id: 'developer', name: 'Developer', dot: '#f6a350',
    blurb: 'Privacy on, with quick access to developer tools and extensions.',
  },
  {
    id: 'openseason', name: 'Open Season', dot: '#a78bfa',
    blurb: 'Unrestricted browsing — ad and tracker blocking turned off.',
  },
];

const KEY = 'ulaa:mode';

export class ModeController {
  constructor(onChange) {
    this.onChange = onChange; // (mode) => void
    this.current = localStorage.getItem(KEY) || 'personal';
    if (!MODES.some((m) => m.id === this.current)) this.current = 'personal';
    // Sync the persisted choice down to the main-process blocker at boot.
    window.tandem.ulaa.setMode(this.current);
  }

  mode() { return MODES.find((m) => m.id === this.current); }
  name() { return this.mode().name + ' Mode'; }

  set(id) {
    if (!MODES.some((m) => m.id === id) || id === this.current) {
      if (id === this.current) this.onChange?.(this.mode());
      return;
    }
    this.current = id;
    localStorage.setItem(KEY, id);
    window.tandem.ulaa.setMode(id);
    this.onChange?.(this.mode());
  }

  // Menu spec for the shared context-menu renderer.
  menu() {
    return MODES.map((m) => ({
      label: m.id === this.current ? `${m.name}  ✓` : m.name,
      swatchColor: m.dot,
      onClick: () => this.set(m.id),
    }));
  }
}

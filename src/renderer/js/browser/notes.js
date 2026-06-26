'use strict';

// Ulaa's built-in Notes: a lightweight scratchpad that lives across every mode.
// Stored locally; never leaves the machine.

const KEY = 'ulaa:notes';

export function openNotes(ctx) {
  ctx.showPanel('Notes', (body) => {
    const wrap = document.createElement('div');
    wrap.className = 'ulaa-notes';

    const ta = document.createElement('textarea');
    ta.className = 'ulaa-notes-area';
    ta.placeholder = 'Jot something down… your notes stay on this device.';
    ta.value = localStorage.getItem(KEY) || '';
    ta.spellcheck = false;

    const status = document.createElement('div');
    status.className = 'ulaa-notes-status';
    status.textContent = ta.value ? 'Saved' : 'Empty';

    let timer = null;
    ta.addEventListener('input', () => {
      status.textContent = 'Saving…';
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(KEY, ta.value);
        status.textContent = 'Saved';
      }, 300);
    });

    wrap.appendChild(ta);
    wrap.appendChild(status);
    body.appendChild(wrap);
    requestAnimationFrame(() => ta.focus());
  });
}

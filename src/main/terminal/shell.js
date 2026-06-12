'use strict';

// Platform-specific shell resolution lives here alone.
// Adding/adjusting OS support is a localized change, not a rewrite.

const DEFAULT_POSIX_SHELL = '/bin/zsh';

function getDefaultShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || DEFAULT_POSIX_SHELL;
}

function getShellArgs() {
  if (process.platform === 'win32') {
    return [];
  }
  // Login + interactive so the user's dotfiles (aliases, PATH) load.
  return ['-l'];
}

module.exports = { getDefaultShell, getShellArgs };

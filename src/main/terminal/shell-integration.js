'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Warp/iTerm-style command blocks need to know where each command begins and
// ends. We get that with OSC 133 "semantic prompt" marks emitted by the shell:
//   133;A  prompt start   133;C  output start   133;D;<exit>  command done
//
// For zsh we inject these via a wrapper ZDOTDIR that sources the user's real
// config first (so Powerlevel10k etc. keep working), then adds precmd/preexec
// hooks. The marks only print at prompt time, never during startup, so P10k's
// instant prompt stays clean.

let zdotdir = null;

function sourceUser(file) {
  return `if [[ -n "$TANDEM_USER_ZDOTDIR" && -f "$TANDEM_USER_ZDOTDIR/${file}" ]]; then\n  source "$TANDEM_USER_ZDOTDIR/${file}"\nfi\n`;
}

function prepareZshIntegration() {
  if (zdotdir && fs.existsSync(path.join(zdotdir, '.zshrc'))) return zdotdir;
  const dir = path.join(os.tmpdir(), 'tandem-zsh-integration');
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, '.zshenv'), sourceUser('.zshenv'));
  fs.writeFileSync(path.join(dir, '.zprofile'), sourceUser('.zprofile'));
  fs.writeFileSync(path.join(dir, '.zlogin'), sourceUser('.zlogin'));

  const zshrc =
    sourceUser('.zshrc') +
    `
# --- Buckthorn Orbit shell integration (OSC 133 command blocks) ---
if [[ -o interactive ]]; then
  __tandem_osc() { builtin printf '\\033]133;%s\\007' "$1"; }
  __tandem_precmd() { local __s=$?; __tandem_osc "D;$__s"; __tandem_osc "A"; }
  __tandem_preexec() { __tandem_osc "C"; }
  # Arm on the FIRST precmd so our hooks are appended after Powerlevel10k's
  # instant-prompt teardown — otherwise P10k treats our marks as "console
  # output during initialization" and prints a warning.
  __tandem_arm() {
    add-zsh-hook -d precmd __tandem_arm
    add-zsh-hook precmd __tandem_precmd
    add-zsh-hook preexec __tandem_preexec
  }
  if autoload -Uz add-zsh-hook 2>/dev/null; then
    add-zsh-hook precmd __tandem_arm
  fi
fi
`;
  fs.writeFileSync(path.join(dir, '.zshrc'), zshrc);
  zdotdir = dir;
  return dir;
}

// Extra env that turns on block markers for the given shell, or {} if we don't
// have integration for it (the terminal still works — just no block marks).
function integrationEnv(shellPath) {
  if (!/zsh$/.test(shellPath)) return {};
  const dir = prepareZshIntegration();
  return { ZDOTDIR: dir, TANDEM_USER_ZDOTDIR: process.env.ZDOTDIR || os.homedir() };
}

module.exports = { integrationEnv };

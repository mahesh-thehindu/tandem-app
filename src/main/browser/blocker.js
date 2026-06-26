'use strict';

const { session, ipcMain, BrowserWindow } = require('electron');

// Ulaa-style multi-tier content blocker.
//
// Ulaa ships an ad/tracker blocker (EasyList / EasyPrivacy / uBlock badware)
// that is on by default, plus five browsing modes that change what is blocked.
// We can't bundle the full EasyList here, but we ship a curated, representative
// set of well-known ad/tracker hosts that produces real, visible blocking, and
// we layer per-mode rules (distraction sites for Work, unsafe sites for Kids)
// on top exactly like Ulaa does.

const PARTITIONS = ['persist:tandem', 'tandem-incognito'];

// ---- Tier 1: ads + trackers (always blocked unless Open Season) -------------
const AD_TRACKER_HOSTS = [
  // Google ad / analytics stack
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com', 'analytics.google.com',
  // Facebook / Meta
  'connect.facebook.net', 'facebook.net', 'pixel.facebook.com',
  // Amazon ads
  'amazon-adsystem.com', 'aax.amazon-adsystem.com',
  // Common ad networks
  'adnxs.com', 'adsrvr.org', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
  'casalemedia.com', 'smartadserver.com', 'adform.net', 'media.net',
  'moatads.com', 'rlcdn.com', 'bidswitch.net', 'sharethrough.com',
  '3lift.com', 'gumgum.com', 'teads.tv', 'yieldmo.com', 'indexww.com',
  // Trackers / analytics
  'scorecardresearch.com', 'quantserve.com', 'quantcount.com',
  'hotjar.com', 'mouseflow.com', 'fullstory.com', 'mixpanel.com',
  'segment.com', 'segment.io', 'amplitude.com', 'heap.io', 'heapanalytics.com',
  'crazyegg.com', 'optimizely.com', 'newrelic.com', 'nr-data.net',
  'branch.io', 'kissmetrics.com', 'chartbeat.com', 'chartbeat.net',
  'bugsnag.com', 'sentry.io', 'mc.yandex.ru', 'matomo.cloud',
  'clarity.ms', 'bat.bing.com', 'snowplowanalytics.com',
  'demdex.net', 'omtrdc.net', 'everesttech.net', '2o7.net',
  'adobedtm.com', 'krxd.net', 'agkn.com', 'addthis.com', 'sharethis.com',
  'zopim.com', 'tapad.com', 'bluekai.com', 'exelator.com', 'eyeota.net',
  'adroll.com', 'mathtag.com', 'ml314.com', 'pippio.com', 'rfihub.com',
  'turn.com', 'spotxchange.com', 'contextweb.com', 'districtm.io',
  'onesignal.com', 'pushcrew.com', 'cdn.onesignal.com',
];

// ---- Tier 2: distracting sites (blocked in Work mode) -----------------------
const DISTRACTION_HOSTS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
  'reddit.com', 'netflix.com', 'youtube.com', 'twitch.tv', 'pinterest.com',
  'snapchat.com', 'tumblr.com', '9gag.com', 'primevideo.com', 'hotstar.com',
];

// ---- Tier 3: unsafe / adult sites (blocked in Kids mode) --------------------
const UNSAFE_HOSTS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'onlyfans.com', 'chaturbate.com', 'bet365.com',
  'stake.com', 'pokerstars.com', '888casino.com',
];

// Modes mirror Ulaa's: Personal, Work, Kids, Developer, Open Season.
const MODE_RULES = {
  personal: { ads: true, distractions: false, unsafe: false, safeSearch: false },
  work: { ads: true, distractions: true, unsafe: false, safeSearch: false },
  kids: { ads: true, distractions: false, unsafe: true, safeSearch: true },
  developer: { ads: true, distractions: false, unsafe: false, safeSearch: false },
  openseason: { ads: false, distractions: false, unsafe: false, safeSearch: false },
};

let currentMode = 'personal';
const counts = new Map(); // webContentsId -> trackers blocked on current page
const dirty = new Set(); // wcIds with un-broadcast count changes

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function matches(host, list) {
  if (!host) return false;
  return list.some((d) => host === d || host.endsWith('.' + d));
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

// A small "site blocked" page rendered when Work/Kids blocks a top-level page.
function blockedPage(host, reason) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      :root{color-scheme:dark}
      body{margin:0;height:100vh;display:grid;place-items:center;
        font:15px -apple-system,system-ui,sans-serif;
        background:#0e0e13;color:#e6e8f0}
      .card{max-width:420px;text-align:center;padding:40px}
      .mark{width:54px;height:54px;border-radius:16px;margin:0 auto 22px;
        display:grid;place-items:center;background:#ff5c39;color:#fff;
        font-size:26px;font-weight:800}
      h1{font-size:21px;margin:0 0 8px}
      p{color:#b6bacb;line-height:1.55;margin:0 0 6px}
      code{color:#ff8b6b}
      .mode{margin-top:18px;display:inline-block;padding:5px 12px;border-radius:999px;
        background:#1d1e27;color:#9aa0a6;font-size:12px}
    </style></head>
    <body><div class="card">
      <div class="mark">U</div>
      <h1>${reason}</h1>
      <p><code>${host}</code> is blocked while Ulaa is in this mode.</p>
      <p>Switch modes from the toolbar to allow it.</p>
      <span class="mode">${reason}</span>
    </div></body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function attach(sess) {
  sess.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, cb) => {
    const rule = MODE_RULES[currentMode] || MODE_RULES.personal;
    const host = hostOf(details.url);
    const wcId = details.webContentsId;
    const isMain = details.resourceType === 'mainFrame';

    // New top-level navigation resets the per-page tracker count.
    if (isMain && wcId != null) { counts.set(wcId, 0); dirty.add(wcId); }

    // Full-site blocks (Work distractions / Kids unsafe) only gate top-level nav.
    if (isMain) {
      if (rule.distractions && matches(host, DISTRACTION_HOSTS)) {
        return cb({ redirectURL: blockedPage(host, 'Work Mode') });
      }
      if (rule.unsafe && matches(host, UNSAFE_HOSTS)) {
        return cb({ redirectURL: blockedPage(host, 'Kids Mode') });
      }
    }

    // Ad / tracker blocking on any sub-resource.
    if (rule.ads && !isMain && matches(host, AD_TRACKER_HOSTS)) {
      if (wcId != null) { counts.set(wcId, (counts.get(wcId) || 0) + 1); dirty.add(wcId); }
      return cb({ cancel: true });
    }

    cb({ cancel: false });
  });
}

function registerBlocker() {
  for (const p of PARTITIONS) attach(session.fromPartition(p));

  ipcMain.handle('ulaa:set-mode', (_e, mode) => {
    if (MODE_RULES[mode]) currentMode = mode;
    return currentMode;
  });
  ipcMain.handle('ulaa:get-mode', () => currentMode);
  ipcMain.handle('ulaa:blocked-count', (_e, wcId) => counts.get(wcId) || 0);

  // Flush changed counters a few times a second instead of per-request.
  setInterval(() => {
    if (dirty.size === 0) return;
    for (const wcId of dirty) broadcast('ulaa:blocked', { wcId, count: counts.get(wcId) || 0 });
    dirty.clear();
  }, 350);
}

module.exports = { registerBlocker };

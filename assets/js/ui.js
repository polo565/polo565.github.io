/* HAMDI ITALIE — shared UI helpers (no framework). */

/** Escapes text for safe insertion into HTML strings. Use for ALL data. */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Accepts only https:/tel:/mailto: URLs; anything else becomes '#'. */
function safeUrl(url) {
  url = String(url || '').trim();
  return /^(https:\/\/|tel:|mailto:)/i.test(url) ? url : '#';
}

/*
 * In-app navigation with "#/..." routes (works on GitHub Pages without server rewrites).
 * Each move adds a browser history entry, so Back/Forward and shared links work.
 */
var currentRoute = null;
function routeHash() { return currentRoute !== null ? currentRoute : (location.hash || ''); }

function navigate(hash, onRoute) {
  currentRoute = hash;
  try { if (location.hash !== hash) history.pushState(null, '', hash); } catch (e) {}
  onRoute();
}

function interceptLinks(onRoute) {
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navigate(a.getAttribute('href'), onRoute);
  });
  // Back/Forward and hand-typed addresses.
  window.addEventListener('hashchange', function () { currentRoute = location.hash; onRoute(); });
}

function initRouting(onRoute) {
  interceptLinks(onRoute);
  onRoute();
}

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

/**
 * Calls a backend function (an api_* function of the Apps Script project) and returns a
 * Promise of its result. The request goes to HAMDI_CONFIG.API_URL (assets/js/config.js),
 * answered by apps-script/backend/HttpApi.gs. text/plain avoids a CORS preflight; Apps
 * Script answers with a redirect to script.googleusercontent.com, which allows any origin.
 * Errors are rejected as Error("CODE: message") — the format the pages translate.
 */
function api(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  var path = publicPath(fn, args);
  if (path) return publicRead(path, fn, args);
  if (/^api_admin_/.test(fn)) return adminApi(fn, args);
  return apiCall(fn, args);
}

/*
 * Administration: screens already opened in this session show at once from memory, then
 * are checked in the background. Admin data is private, so it is kept in memory only
 * (never in the browser's storage) and is gone when the page is closed or reloaded.
 * Any write (save, delete, status, payment, login, logout…) empties the memory, and a
 * read that started before a write is not kept. Edit forms always load the current
 * record (they read with filters, which is a different request from the lists).
 */
var ADMIN_READS = {
  api_admin_list: 1, api_admin_listRequests: 1, api_admin_listPayments: 1, api_admin_listRoles: 1,
  api_admin_listAdmins: 1, api_admin_getDashboard: 1, api_admin_translationReport: 1,
  api_admin_paymentReport: 1, api_admin_driveStatus: 1
};
/** Reads that are not cached but change nothing (they must not empty the memory). */
var ADMIN_PLAIN_READS = { api_admin_me: 1, api_admin_getAttachment: 1, api_admin_downloadDocument: 1 };
var ADMIN_FRESH_MS = 15000;   // younger copies are shown without asking the API again
var ADMIN_FRESH_ENTITIES = { service_translations: 1 };
var adminMem = {}, adminInflight = {}, adminMemToken = null, adminGen = 0;

function adminCacheClear() { adminMem = {}; adminInflight = {}; adminFreshInflight = {}; adminGen++; }

function adminApi(fn, args) {
  if (ADMIN_READS[fn]) return adminRead(fn, args);
  if (ADMIN_PLAIN_READS[fn]) return apiCall(fn, args);
  adminCacheClear();
  var done = function () { adminCacheClear(); };
  return apiCall(fn, args).then(function (r) { done(); return r; }, function (e) { done(); throw e; });
}

function adminRead(fn, args) {
  if (args[0] !== adminMemToken) { adminCacheClear(); adminMemToken = args[0]; }
  // What an edit form loads (one record, a service's texts) is always read fresh; two
  // identical requests at the same time share one call (the form starts it early).
  var opts = args[2];
  var key = fn + JSON.stringify(args.slice(1));
  var forEditing = fn === 'api_admin_list' && opts && ((opts.limit === 1 && opts.filters && Object.keys(opts.filters).length) ||
    ADMIN_FRESH_ENTITIES[args[1]]);
  if (forEditing) return adminFresh(key, fn, args);
  var hit = adminMem[key];
  if (hit) {
    if (Date.now() - hit.t > ADMIN_FRESH_MS) adminFetch(key, fn, args, true).catch(function () {});
    return Promise.resolve(JSON.parse(hit.json));
  }
  return adminFetch(key, fn, args, false).then(function (json) { return JSON.parse(json); });
}

/**
 * Fresh read for edit forms: never kept. Identical requests running at the same time share
 * one call. A read started early by the form (adminFreshEarly) is handed to the form once —
 * while running or up to 10 s after it ended — and then forgotten.
 */
var adminFreshInflight = {};
function adminFreshStart(key, fn, args) {
  var p = apiCall(fn, args).then(function (d) { p.doneAt = Date.now(); return JSON.stringify(d); });
  p.then(function () {
    if (!p.early && adminFreshInflight[key] === p) delete adminFreshInflight[key];
  }, function () { if (adminFreshInflight[key] === p) delete adminFreshInflight[key]; });
  adminFreshInflight[key] = p;
  return p;
}

function adminFresh(key, fn, args) {
  var p = adminFreshInflight[key];
  if (p && p.early) {
    delete adminFreshInflight[key];                       // used once
    if (p.doneAt && Date.now() - p.doneAt > 10000) p = null;
  }
  if (!p) p = adminFreshStart(key, fn, args);
  return p.then(function (json) { return JSON.parse(json); });
}

function adminFreshEarly(fn, args) {
  var key = fn + JSON.stringify(args.slice(1));
  if (adminFreshInflight[key]) return;
  var p = adminFreshStart(key, fn, args);
  p.early = true;
  p.catch(function () {});
}

/** One API call per key at a time (a prefetch in progress is reused by the page). */
function adminFetch(key, fn, args, background) {
  if (adminInflight[key]) return adminInflight[key];
  var gen = adminGen;
  var p = apiCall(fn, args).then(function (d) {
    var json = JSON.stringify(d);
    if (adminInflight[key] === p) delete adminInflight[key];
    if (gen !== adminGen) return json;   // something was written meanwhile: don't keep it
    var old = adminMem[key];
    adminMem[key] = { json: json, t: Date.now() };
    if (background && old && old.json !== json) window.dispatchEvent(new CustomEvent('hi:admin-data', { detail: { fn: fn } }));
    return json;
  }, function (err) {
    if (adminInflight[key] === p) delete adminInflight[key];
    throw err;
  });
  adminInflight[key] = p;
  return p;
}

/** The network call itself (see api()). */
function apiCall(fn, args) {
  var url = window.HAMDI_CONFIG && HAMDI_CONFIG.API_URL;
  if (!url) {
    console.error('HAMDI ITALIE: API_URL is empty in assets/js/config.js');
    return Promise.reject(new Error('INTERNAL: API not configured.'));
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args }),
    credentials: 'omit',
    redirect: 'follow'
  }).then(function (r) {
    if (!r.ok) throw new Error('INTERNAL: HTTP ' + r.status);
    return r.json();
  }).then(function (res) {
    if (res && res.ok === true) return res.result;
    throw new Error(String((res && res.error) || 'INTERNAL: An error occurred.'));
  }, function (err) {
    // Network failure, or the API is not deployed (no CORS headers → TypeError).
    var msg = String((err && err.message) || err || '');
    throw new Error(/^[A-Z][A-Z_]*: /.test(msg) ? msg : 'INTERNAL: ' + msg);
  });
}

/*
 * Public content (home, catalog, guide, category and service pages) is shown at once
 * from the fastest copy available, then checked against the API in the background:
 *   1. memory (this visit)   2. this browser (localStorage, earlier visits)
 *   3. data/*.json on GitHub Pages (written by tools/snapshot.js)
 *   4. the API.
 * When the API answers with something different, the copy is replaced and the event
 * "hi:public-data" (detail: {path, data}) lets the page redraw. The API stays the only
 * source of truth: a copy is only ever shown until the API has answered once.
 */
var PUBLIC_READS = {
  api_getHome: { path: 'home', snapshot: true },
  api_getCatalog: { path: 'catalog', snapshot: true },
  api_getGuide: { path: 'guide', snapshot: true },
  api_getCategory: { path: 'category/', snapshot: true, arg: true },
  // The page is read without counting a view; the page counts it with api_countView.
  api_getService: { path: 'service/', snapshot: true, arg: true, net: 'api_getServicePage' }
};
var PUBLIC_STORE = 'hi_pub_v1:';
var publicMem = {};
var publicChecked = {};
var publicGone = {};  // removed since the copies were made: always ask the API

function publicPath(fn, args) {
  var def = PUBLIC_READS[fn];
  if (!def) return null;
  if (!def.arg) return args.length ? null : def.path;
  var slug = args.length === 1 ? String(args[0]) : '';
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(slug) ? def.path + slug : null;
}

/** The API function that answers a public read (may differ from the name the pages use). */
function publicNet(fn) { return PUBLIC_READS[fn].net || fn; }

/**
 * True when the deployed API is older than this page (no api_getServicePage): service
 * pages then come from api_getService, which counts the view itself.
 */
var publicLegacyApi = false;

/** Calls the API for a public read, falling back to the older function name if needed. */
function publicFetch(fn, args) {
  var net = publicNet(fn);
  if (net === fn) return apiCall(fn, args);
  return apiCall(net, args).catch(function (err) {
    if (!/^NOT_FOUND: Unknown function/.test(String(err && err.message))) throw err;
    PUBLIC_READS[fn].net = null;
    publicLegacyApi = true;
    return apiCall(fn, args);
  });
}

function publicStored(path) {
  try { var v = JSON.parse(localStorage.getItem(PUBLIC_STORE + path)); return v && v.d !== undefined ? v.d : null; } catch (e) { return null; }
}

function publicStore(path, data) {
  publicMem[path] = data;
  try { localStorage.setItem(PUBLIC_STORE + path, JSON.stringify({ t: Date.now(), d: data })); } catch (e) {
    // Storage full or blocked: drop older copies, the site still works from the API.
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PUBLIC_STORE) === 0) localStorage.removeItem(k); }); } catch (x) {}
  }
}

function publicForget(path) {
  delete publicMem[path];
  try { localStorage.removeItem(PUBLIC_STORE + path); } catch (e) {}
}

function publicRead(path, fn, args) {
  if (publicGone[path]) return publicFetch(fn, args);
  if (publicMem[path] !== undefined) { publicRevalidate(path, fn, args); return Promise.resolve(publicMem[path]); }
  var stored = publicStored(path);
  if (stored !== null) { publicMem[path] = stored; publicRevalidate(path, fn, args); return Promise.resolve(stored); }
  var network = function () {
    publicChecked[path] = true;
    return publicFetch(fn, args).then(function (d) { publicStore(path, d); return d; });
  };
  if (!PUBLIC_READS[fn].snapshot) return network();
  return fetch('/data/' + path + '.json', { credentials: 'omit' }).then(function (r) {
    if (!r.ok) throw new Error('no snapshot');
    return r.json();
  }).then(function (d) {
    publicMem[path] = d;
    publicRevalidate(path, fn, args);
    return d;
  }, network);
}

/** Asks the API once per visit; replaces the copy and notifies the page if it changed. */
function publicRevalidate(path, fn, args) {
  if (publicChecked[path]) return;
  publicChecked[path] = true;
  publicFetch(fn, args).then(function (fresh) {
    var changed = JSON.stringify(fresh) !== JSON.stringify(publicMem[path]);
    publicStore(path, fresh);
    if (changed) window.dispatchEvent(new CustomEvent('hi:public-data', { detail: { path: path, data: fresh } }));
  }, function (err) {
    // Removed or unpublished since the copy was made: forget it and let the page redraw.
    if (/^NOT_FOUND/.test(String(err && err.message))) {
      publicForget(path);
      publicGone[path] = true;
      window.dispatchEvent(new CustomEvent('hi:public-data', { detail: { path: path, data: null } }));
    }
  });
}

function toast(message, type) {
  var host = $('.toasts');
  if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  var node = document.createElement('div');
  node.className = 'toast ' + (type || '');
  node.innerHTML = icon(type === 'error' ? 'alert' : type === 'success' ? 'checkCircle' : 'info') + '<span></span>';
  node.querySelector('span').textContent = message;
  host.appendChild(node);
  setTimeout(function () { node.remove(); }, 4500);
}

/** Opens a modal. `body` is an HTML string built with esc(). Returns a close() function. */
function openModal(title, body, actions) {
  var back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
    '<h3 id="modal-title"></h3><div class="modal-body">' + body + '</div><div class="modal-actions"></div></div>';
  back.querySelector('#modal-title').textContent = title;
  var bar = back.querySelector('.modal-actions');
  var lastFocus = document.activeElement;
  function close() { back.remove(); document.removeEventListener('keydown', onKey); if (lastFocus) lastFocus.focus(); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  (actions || [{ label: t('common.close') }]).forEach(function (a) {
    var b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.onclick = function () { if (!a.onClick || a.onClick() !== false) close(); };
    bar.appendChild(b);
  });
  back.addEventListener('click', function (e) { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  var first = back.querySelector('input, select, textarea, button');
  if (first) first.focus();
  return close;
}

/** Confirmation dialog for destructive actions. Resolves true/false. */
function confirmDialog(title, message, dangerLabel) {
  return new Promise(function (resolve) {
    openModal(title, '<p>' + esc(message) + '</p>', [
      { label: t('common.cancel'), onClick: function () { resolve(false); } },
      { label: dangerLabel || t('common.confirm'), cls: 'btn-primary', onClick: function () { resolve(true); } }
    ]);
  });
}

function skeletonCards(n, height) {
  var out = '';
  for (var i = 0; i < n; i++) out += '<div class="card"><div class="skeleton" style="height:' + (height || 120) + 'px"></div></div>';
  return out;
}

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(currentLang === 'ar' ? 'ar' : currentLang, { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch (e) { return amount + ' ' + (currency || 'EUR'); }
}

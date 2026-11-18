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

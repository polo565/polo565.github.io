/*
 * HAMDI ITALIE — GitHub Pages shell.
 * The real site (pages, data, accounts, admin) is the Google Apps Script web app.
 * This page only shows it full screen and forwards deep links:
 *   https://polo565.github.io/#/service/spid  →  <exec URL>#/service/spid
 * Nothing is computed or stored here; every check happens on the Apps Script server.
 */
(function () {
  var TEXT = {
    ar: { dir: 'rtl', loading: 'جارٍ التحميل…', slow: 'التحميل يستغرق وقتاً أطول من المعتاد.', open: 'فتح الموقع مباشرة' },
    fr: { dir: 'ltr', loading: 'Chargement…', slow: 'Le chargement prend plus de temps que prévu.', open: 'Ouvrir le site directement' },
    en: { dir: 'ltr', loading: 'Loading…', slow: 'Loading is taking longer than usual.', open: 'Open the site directly' }
  };
  var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0, 2).toLowerCase();
  var lang = TEXT[nav] ? nav : 'ar'; // Arabic is the default language of the platform.
  var tx = TEXT[lang];

  var base = (window.HAMDI_CONFIG && window.HAMDI_CONFIG.APPS_SCRIPT_DEPLOYMENT_URL) || '';
  var isAdmin = document.documentElement.getAttribute('data-app') === 'admin';
  var ok = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(base);

  // Only in-app routes ("#/...") are forwarded; anything else is ignored.
  var hash = /^#\/[A-Za-z0-9\-_/.~%]*$/.test(location.hash) ? location.hash : '';
  var target = ok ? base + (isAdmin ? '?app=admin' : '') + hash : '';

  document.documentElement.lang = lang;
  document.documentElement.dir = tx.dir;
  document.getElementById('loading-text').textContent = tx.loading;
  document.getElementById('slow-text').textContent = tx.slow;
  var direct = document.getElementById('direct');
  direct.textContent = tx.open;

  var overlay = document.getElementById('overlay');
  var slow = document.getElementById('slow');
  if (!ok) { document.getElementById('spinner').hidden = true; slow.hidden = false; direct.hidden = true; return; }
  direct.href = target;

  var frame = document.getElementById('app');
  var timer = setTimeout(function () { slow.hidden = false; }, 15000);
  frame.addEventListener('load', function () {
    clearTimeout(timer);
    overlay.classList.add('fade');
    setTimeout(function () { overlay.hidden = true; }, 400);
    frame.focus();
  });
  frame.src = target;
})();

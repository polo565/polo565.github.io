/* HAMDI ITALIE — visitor SPA (hash router). Content comes from api_getHome();
   every value is escaped with esc() before insertion. */
var state = { home: null };

var HERO_ART =
  '<svg viewBox="0 0 400 340" class="hero-art" role="img" aria-hidden="true">' +
  '<defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#E9C77B"/><stop offset="1" stop-color="#B8903E"/></linearGradient></defs>' +
  '<circle cx="200" cy="170" r="150" fill="rgba(255,255,255,.06)"/>' +
  '<circle cx="200" cy="170" r="105" fill="rgba(255,255,255,.06)"/>' +
  // colonnade
  '<g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3">' +
  '<path d="M80 250h240M90 250V150M310 250V150M70 150h260l-130-60-130 60z"/>' +
  '<path d="M130 250v-75a20 20 0 0 1 40 0v75M230 250v-75a20 20 0 0 1 40 0v75"/></g>' +
  // document card
  '<g transform="translate(212 120) rotate(8)"><rect width="120" height="150" rx="14" fill="#fff"/>' +
  '<rect x="16" y="20" width="60" height="10" rx="5" fill="#244B68"/>' +
  '<rect x="16" y="44" width="88" height="7" rx="3.5" fill="#cfd9e4"/><rect x="16" y="60" width="70" height="7" rx="3.5" fill="#cfd9e4"/>' +
  '<rect x="16" y="76" width="80" height="7" rx="3.5" fill="#cfd9e4"/>' +
  '<circle cx="92" cy="122" r="16" fill="#36866C"/><path d="m84 122 6 6 10-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>' +
  // pin
  '<g transform="translate(66 70)"><path d="M28 70S0 44 0 26a28 28 0 0 1 56 0c0 18-28 44-28 44z" fill="url(#hg)"/><circle cx="28" cy="26" r="10" fill="#244B68"/></g>' +
  // tricolore ribbon
  '<g transform="translate(120 290)"><rect width="54" height="8" rx="4" fill="#2E8B57"/><rect x="54" width="54" height="8" fill="#fff"/><rect x="108" width="54" height="8" rx="4" fill="#C0392B"/></g>' +
  '</svg>';

function renderHome(d) {
  var site = d.site || {};
  var html = '';

  // B. Hero
  html += '<section class="hero"><div class="container hero-inner"><div>' +
    '<h1>' + esc(t('hero.title')) + '</h1>' +
    '<p class="lead">' + esc(t('hero.subtitle')) + '</p>' +
    '<form class="search" role="search" id="hero-search">' + icon('search') +
    '<label class="sr-only" for="q">' + esc(t('hero.search')) + '</label>' +
    '<input class="input" id="q" type="search" autocomplete="off" placeholder="' + esc(t('hero.search')) + '">' +
    '<button class="btn btn-primary btn-sm" type="submit">' + icon('arrow', 'flip-rtl') + '<span class="sr-only">' + esc(t('hero.search')) + '</span></button></form>' +
    '<div class="hero-actions">' +
    '<a class="btn btn-accent" href="#/request">' + esc(t('hero.cta')) + '</a>' +
    '<a class="btn btn-glass" href="#/services">' + esc(t('hero.explore')) + '</a>' +
    '<a class="btn btn-glass" href="#/guide">' + icon('route') + esc(t('hero.guide')) + '</a>' +
    '</div></div>' + HERO_ART + '</div><div class="hero-wave"></div></section>';

  // C. Categories
  html += '<section class="section" id="services"><div class="container">' +
    '<div class="section-head"><div><h2>' + esc(t('cats.title')) + '</h2><p class="muted">' + esc(t('cats.subtitle')) + '</p></div></div>' +
    '<div class="grid cat-grid">' + (d.categories || []).map(function (c) {
      return '<a class="card interactive cat-card" href="#/category/' + encodeURIComponent(c.slug) + '">' +
        (c.image_url ? '<div class="media cat-media"><img src="' + esc(safeUrl(c.image_url)) + '" alt="' + esc(tf(c, 'title')) + '" loading="lazy"></div>' : '') +
        '<div class="cat-top"><span class="icon-badge">' + icon(c.icon) + '</span><span class="cat-code">' + esc(c.code) + '</span></div>' +
        '<h3>' + esc(tf(c, 'title')) + '</h3><p>' + esc(tf(c, 'description')) + '</p>' +
        '<span class="link">' + esc(t('cats.view')) + icon('arrow', 'flip-rtl') + '</span></a>';
    }).join('') + '</div></div></section>';

  // D. Popular services
  if ((d.popular || []).length) {
    html += '<section class="section" style="padding-block-start:0"><div class="container">' +
      '<h2>' + esc(t('popular.title')) + '</h2><div class="popular">' + d.popular.map(function (s) {
        return '<a class="chip" href="#/service/' + encodeURIComponent(s.slug) + '">' + icon('sparkle') + esc(tf(s, 'title')) + '</a>';
      }).join('') + '</div></div></section>';
  }

  // E. New immigrant guide
  html += '<section class="section" style="padding-block-start:0"><div class="container"><div class="card guide-band">' +
    '<span class="icon-badge">' + icon('cat13') + '</span>' +
    '<div><h2>' + esc(t('guide.title')) + '</h2><p class="muted" style="margin:0">' + esc(t('guide.text')) + '</p></div>' +
    '<a class="btn btn-primary" href="#/guide">' + esc(t('guide.cta')) + icon('arrow', 'flip-rtl') + '</a></div></div></section>';

  // F. How it works
  html += '<section class="section" style="padding-block-start:0"><div class="container">' +
    '<h2>' + esc(t('how.title')) + '</h2><div class="steps-wrap"><div class="grid steps">' + [1, 2, 3, 4].map(function (n) {
      return '<div class="card step"><h3>' + esc(t('how.' + n + '.t')) + '</h3><p class="muted" style="margin:0">' + esc(t('how.' + n + '.d')) + '</p></div>';
    }).join('') + '</div></div>' +
    (d.cashAvailable ? '<div class="notice success" style="margin-block-start:var(--s5)">' + icon('cash') +
      '<div><strong>' + esc(t('cash.title')) + '</strong><br>' + esc(t('cash.text')) + '</div></div>' : '') +
    '</div></section>';

  // G. Featured documents
  if ((d.documents || []).length) {
    html += '<section class="section" style="padding-block-start:0"><div class="container"><h2>' + esc(t('docs.title')) + '</h2>' +
      '<div class="grid grid-auto">' + d.documents.map(function (doc) {
        return '<div class="card card-sm doc-card"><span class="icon-badge">' + icon('file') + '</span>' +
          '<div class="doc-meta"><strong>' + esc(tf(doc, 'title')) + '</strong><span class="muted" style="font-size:.8rem">' + esc((doc.mime || '').split('/').pop().toUpperCase()) + '</span></div>' +
          '<a class="btn btn-icon" href="' + esc(safeUrl(doc.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(t('docs.download')) + '">' + icon('download') + '</a></div>';
      }).join('') + '</div></div></section>';
  }

  // H. FAQ
  if ((d.faqs || []).length) {
    html += '<section class="section" style="padding-block-start:0"><div class="container faq"><h2>' + esc(t('faq.title')) + '</h2>' +
      d.faqs.map(function (f) {
        return '<details><summary>' + esc(tf(f, 'question')) + '</summary><p>' + esc(tf(f, 'answer')) + '</p></details>';
      }).join('') + '</div></section>';
  }

  // I. Contact — the form is shown only when the backend can store messages
  // (d.contactEnabled); contact links only when the admin has configured them.
  var links = contactLinks(site);
  if (links || d.contactEnabled) {
  html += '<section class="section" id="contact" style="padding-block-start:0"><div class="container"><h2>' + esc(t('contact.title')) + '</h2>' +
    '<div class="grid' + (links && d.contactEnabled ? ' contact-grid' : '') + '">' + (links ? '<div class="card contact-list">' + links + '</div>' : '') +
    (d.contactEnabled ? '<form class="card form-grid" id="contact-form" novalidate>' +
    field('c-name', 'contact.name', '<input class="input" id="c-name" name="name" required maxlength="100" autocomplete="name">') +
    field('c-phone', 'contact.phone', '<input class="input" id="c-phone" name="phone" type="tel" maxlength="30" autocomplete="tel" dir="ltr">') +
    field('c-email', 'contact.email', '<input class="input" id="c-email" name="email" type="email" maxlength="120" autocomplete="email" dir="ltr">', true) +
    field('c-msg', 'contact.message', '<textarea class="textarea" id="c-msg" name="message" required maxlength="2000"></textarea>', true) +
    '<label class="check full"><input type="checkbox" name="consent" required><span>' + esc(t('contact.consent')) + '</span></label>' +
    '<div class="full"><button class="btn btn-primary" type="submit">' + esc(t('contact.send')) + '</button></div>' +
    '</form>' : '') + '</div></div></section>';
  }

  $('#main').innerHTML = html;
  $('#footer-contact').innerHTML = '<div class="contact-list">' + contactLinks(site) + '</div>';
  bindHome();
}

function field(id, labelKey, control, full) {
  return '<div class="field' + (full ? ' full' : '') + '"><label for="' + id + '">' + esc(t(labelKey)) + '</label>' + control + '</div>';
}

function contactLinks(site) {
  var out = '';
  if (site.phone) out += '<a href="' + esc(safeUrl('tel:' + site.phone)) + '" target="_top"><span class="icon-badge">' + icon('phone') + '</span><span dir="ltr">' + esc(site.phone) + '</span></a>';
  if (site.whatsapp) out += '<a href="' + esc(safeUrl('https://wa.me/' + String(site.whatsapp).replace(/\D/g, ''))) + '" target="_blank" rel="noopener"><span class="icon-badge">' + icon('chat') + '</span><span>WhatsApp</span></a>';
  if (site.email) out += '<a href="' + esc(safeUrl('mailto:' + site.email)) + '" target="_top"><span class="icon-badge">' + icon('mail') + '</span><span dir="ltr">' + esc(site.email) + '</span></a>';
  if (site.address) out += '<div class="row"><span class="icon-badge">' + icon('mapPin') + '</span><span>' + esc(site.address) + '</span></div>';
  return out;
}

function bindHome() {
  $('#hero-search').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('#q').value.trim();
    if (q) navigate('#/search/' + encodeURIComponent(q), route);
  });
  if ($('#contact-form')) $('#contact-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (!f.checkValidity()) { f.reportValidity(); return; }
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    api('api_submitContact', {
      name: f.name.value, phone: f.phone.value, email: f.email.value,
      message: f.message.value, consent: f.consent.checked, lang: currentLang
    }).then(function () { f.reset(); toast(t('contact.sent'), 'success'); })
      .catch(function () { toast(t('common.error'), 'error'); })
      .then(function () { btn.disabled = false; });
  });
}

function loadHome() {
  $('#main').innerHTML = '<section class="section"><div class="container grid grid-auto">' + skeletonCards(6) + '</div></section>';
  var p = state.home ? Promise.resolve(state.home) : api('api_getHome');
  p.then(function (d) { state.home = d; renderHome(d); })
    .catch(function () {
      $('#main').innerHTML = '<section class="section"><div class="container"><div class="card stack">' +
        '<div class="notice warning">' + icon('alert') + '<span>' + esc(t('common.error')) + '</span></div>' +
        '<button class="btn btn-primary" id="retry">' + esc(t('common.retry')) + '</button></div></div></section>';
      $('#retry').onclick = loadHome;
    });
}

function route() {
  var hash = routeHash() || '#/';
  if (hash === '#contact') { var c = $('#contact'); if (c) { c.scrollIntoView(); return; } hash = '#/'; }
  var parts = hash.replace(/^#\/?/, '').split('/');
  $$('.main-nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#/' + parts[0] || (parts[0] === '' && a.getAttribute('href') === '#/')); });
  $('#main-nav').classList.remove('open');
  $('#menu-btn').setAttribute('aria-expanded', 'false');
  var arg = function (i) { try { return decodeURIComponent(parts.slice(i).join('/')); } catch (e) { return ''; } };
  currentLoad = null;
  switch (parts[0]) {
    case '': loadHome(); break;
    case 'services': renderServicesIndex(); break;
    case 'category': renderCategory(arg(1)); break;
    case 'service': renderService(arg(1)); break;
    case 'search': renderSearch(arg(1)); break;
    case 'request': renderRequest(arg(1)); break;
    case 'track': renderTrack(arg(1)); break;
    case 'guide': renderGuide(); break;
    case 'account': renderAccount(arg(1)); break;
    case 'about': case 'privacy': case 'terms': renderStatic(parts[0]); break;
    default: errorPage({ message: 'NOT_FOUND' });
  }
  window.scrollTo(0, 0);
}

function initShell() {
  var sel = $('#lang');
  sel.innerHTML = APP_LANGS.map(function (l) { return '<option value="' + l + '">' + esc(LANG_NAMES[l]) + '</option>'; }).join('');
  sel.value = currentLang;
  sel.onchange = function () { setLang(sel.value); route(); };
  $('#lang-icon').innerHTML = icon('globe');
  $('#account-link').innerHTML = icon('user');
  $('#menu-btn').innerHTML = icon('menu');
  $('#menu-btn').onclick = function () {
    var open = $('#main-nav').classList.toggle('open');
    this.setAttribute('aria-expanded', String(open));
  };
  $('#year').textContent = new Date().getFullYear();
  // Restore an optional visitor session (used to prefill forms).
  var tok = visitorToken();
  if (tok) api('api_visitorMe', tok).then(function (p) { window.visitorProfile = p; })
    .catch(function (e) { if (/SESSION_EXPIRED/.test((e && e.message) || '')) setVisitorToken(''); });
}

/*
 * Newer public content arrived from the API (see publicRevalidate in ui.js): update the
 * page caches and redraw the current page in place, unless the visitor is filling a form.
 */
var PUBLIC_PAGE_KEYS = { home: 'home', catalog: 'catalog', guide: 'guide' };
window.addEventListener('hi:public-data', function (e) {
  var path = e.detail.path, data = e.detail.data;
  var key = PUBLIC_PAGE_KEYS[path] || (path.indexOf('category/') === 0 ? 'cat:' + path.slice(9) : 'svc:' + path.slice(8));
  if (data === null) delete PAGE_CACHE[key]; else PAGE_CACHE[key] = data;
  if (path === 'home') state.home = data;
  var page = (routeHash() || '#/').replace(/^#\/?/, '').split('/')[0];
  if (['request', 'track', 'account', 'search', 'guide'].indexOf(page) >= 0) return;
  var a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  var y = window.scrollY;
  route();
  window.scrollTo(0, y);
});

var APP_LANGS = ['ar', 'fr', 'en'];
setLang(detectLang());
initShell();
setLang(currentLang);
initRouting(route);

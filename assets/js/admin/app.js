/* HAMDI CAF — administrator SPA.
   The token in sessionStorage is only a handle: every api_admin_* call is
   re-authorized on the server (session + role permission). */
(function addAdminStrings() {
  var A = {
    en: { 'a.dashboard': 'Dashboard', 'a.categories': 'Categories', 'a.services': 'Services', 'a.appointments': 'Requests', 'a.payments': 'Payments', 'a.contacts': 'Messages', 'a.documents': 'Documents', 'a.drive': 'Google Drive', 'a.visitors': 'Visitors', 'a.faqs': 'FAQ', 'a.homepage': 'Homepage editor', 'a.media': 'Media library', 'a.guidance': 'Immigrant guide', 'a.languages': 'Languages', 'a.notifications': 'Notifications', 'a.cities': 'Cities', 'a.admins': 'Administrators', 'a.roles': 'Roles & permissions', 'a.settings': 'Settings', 'a.reports': 'Reports', 'a.audit': 'Audit logs',
      'g.content': 'Content', 'g.operations': 'Operations', 'g.system': 'System',
      'k.services': 'Published services', 'k.categories': 'Categories', 'k.requests': 'Total requests', 'k.pending': 'Pending', 'k.approved': 'Approved', 'k.rejected': 'Rejected', 'k.documents': 'Documents', 'k.cashPending': 'Payments to collect',
      'd.requests': 'Requests per month', 'd.status': 'Request status', 'd.popular': 'Most viewed services', 'd.activity': 'Recent activity', 'd.tasks': 'Pending tasks', 'd.quick': 'Quick actions', 'd.newService': 'New service', 'd.upload': 'Upload document', 'd.recordCash': 'Record cash payment',
      'a.logout': 'Sign out', 'a.pw.title': 'Change your password', 'a.pw.text': 'For security, choose a new password before continuing.', 'a.pw.old': 'Current (temporary) password', 'a.pw.new': 'New password', 'a.pw.repeat': 'Repeat new password', 'a.pw.hint': 'At least 12 characters.', 'a.pw.mismatch': 'The two passwords do not match.', 'a.pw.done': 'Password updated.', 'a.pending': 'This section is implemented in phase 6.' },
    fr: { 'a.dashboard': 'Tableau de bord', 'a.categories': 'Catégories', 'a.services': 'Services', 'a.appointments': 'Demandes', 'a.payments': 'Paiements', 'a.contacts': 'Messages', 'a.documents': 'Documents', 'a.drive': 'Google Drive', 'a.visitors': 'Visiteurs', 'a.faqs': 'FAQ', 'a.homepage': 'Page d’accueil', 'a.media': 'Médiathèque', 'a.guidance': 'Guide arrivants', 'a.languages': 'Langues', 'a.notifications': 'Notifications', 'a.cities': 'Villes', 'a.admins': 'Administrateurs', 'a.roles': 'Rôles et permissions', 'a.settings': 'Paramètres', 'a.reports': 'Rapports', 'a.audit': 'Journal d’audit',
      'g.content': 'Contenu', 'g.operations': 'Opérations', 'g.system': 'Système',
      'k.services': 'Services publiés', 'k.categories': 'Catégories', 'k.requests': 'Demandes totales', 'k.pending': 'En attente', 'k.approved': 'Approuvées', 'k.rejected': 'Refusées', 'k.documents': 'Documents', 'k.cashPending': 'Paiements à encaisser',
      'd.requests': 'Demandes par mois', 'd.status': 'État des demandes', 'd.popular': 'Services les plus vus', 'd.activity': 'Activité récente', 'd.tasks': 'Tâches en attente', 'd.quick': 'Actions rapides', 'd.newService': 'Nouveau service', 'd.upload': 'Importer un document', 'd.recordCash': 'Enregistrer un paiement',
      'a.logout': 'Se déconnecter', 'a.pw.title': 'Changer le mot de passe', 'a.pw.text': 'Par sécurité, choisissez un nouveau mot de passe avant de continuer.', 'a.pw.old': 'Mot de passe actuel (temporaire)', 'a.pw.new': 'Nouveau mot de passe', 'a.pw.repeat': 'Répéter le nouveau mot de passe', 'a.pw.hint': 'Au moins 12 caractères.', 'a.pw.mismatch': 'Les deux mots de passe ne correspondent pas.', 'a.pw.done': 'Mot de passe mis à jour.', 'a.pending': 'Cette section est réalisée en phase 6.' },
    ar: { 'a.dashboard': 'لوحة التحكم', 'a.categories': 'الفئات', 'a.services': 'الخدمات', 'a.appointments': 'الطلبات', 'a.payments': 'المدفوعات', 'a.contacts': 'الرسائل', 'a.documents': 'الوثائق', 'a.drive': 'جوجل درايف', 'a.visitors': 'الزوار', 'a.faqs': 'الأسئلة الشائعة', 'a.homepage': 'محرر الصفحة الرئيسية', 'a.media': 'مكتبة الوسائط', 'a.guidance': 'دليل المهاجرين', 'a.languages': 'اللغات', 'a.notifications': 'الإشعارات', 'a.cities': 'المدن', 'a.admins': 'المسؤولون', 'a.roles': 'الأدوار والصلاحيات', 'a.settings': 'الإعدادات', 'a.reports': 'التقارير', 'a.audit': 'سجل التدقيق',
      'g.content': 'المحتوى', 'g.operations': 'العمليات', 'g.system': 'النظام',
      'k.services': 'الخدمات المنشورة', 'k.categories': 'الفئات', 'k.requests': 'إجمالي الطلبات', 'k.pending': 'قيد الانتظار', 'k.approved': 'مقبولة', 'k.rejected': 'مرفوضة', 'k.documents': 'الوثائق', 'k.cashPending': 'مدفوعات قيد التحصيل',
      'd.requests': 'الطلبات شهرياً', 'd.status': 'حالة الطلبات', 'd.popular': 'الخدمات الأكثر مشاهدة', 'd.activity': 'النشاط الأخير', 'd.tasks': 'مهام معلّقة', 'd.quick': 'إجراءات سريعة', 'd.newService': 'خدمة جديدة', 'd.upload': 'رفع وثيقة', 'd.recordCash': 'تسجيل دفعة نقدية',
      'a.logout': 'تسجيل الخروج', 'a.pw.title': 'تغيير كلمة المرور', 'a.pw.text': 'لأسباب أمنية، اختر كلمة مرور جديدة قبل المتابعة.', 'a.pw.old': 'كلمة المرور الحالية (المؤقتة)', 'a.pw.new': 'كلمة المرور الجديدة', 'a.pw.repeat': 'أعد كتابة كلمة المرور الجديدة', 'a.pw.hint': '12 حرفاً على الأقل.', 'a.pw.mismatch': 'كلمتا المرور غير متطابقتين.', 'a.pw.done': 'تم تحديث كلمة المرور.', 'a.pending': 'يتم تنفيذ هذا القسم في المرحلة 6.' }
  };
  Object.keys(A).forEach(function (l) { Object.keys(A[l]).forEach(function (k) { I18N[l][k] = A[l][k]; }); });
})();

var NAV = [
  { key: 'dashboard', icon: 'grid' },
  { group: 'g.content' },
  { key: 'categories', icon: 'layers' }, { key: 'services', icon: 'file' }, { key: 'documents', icon: 'file' },
  { key: 'drive', icon: 'drive' }, { key: 'faqs', icon: 'help' }, { key: 'homepage', icon: 'home' },
  { key: 'media', icon: 'image' }, { key: 'guidance', icon: 'route' }, { key: 'languages', icon: 'language' },
  { group: 'g.operations' },
  { key: 'appointments', icon: 'calendar' }, { key: 'payments', icon: 'cash' }, { key: 'contacts', icon: 'chat' },
  { key: 'visitors', icon: 'users' }, { key: 'notifications', icon: 'bell' }, { key: 'cities', icon: 'mapPin' },
  { key: 'reports', icon: 'chart' },
  { group: 'g.system' },
  { key: 'admins', icon: 'user' }, { key: 'roles', icon: 'shield' }, { key: 'settings', icon: 'settings' },
  { key: 'audit', icon: 'log' }
];

var session = { token: null, admin: null };
try { session.token = sessionStorage.getItem('hi_admin_token'); } catch (e) {}

function canRead(section) {
  var p = session.admin && session.admin.permissions;
  return !!p && p[section] && p[section] !== 'none';
}

/* ---- Login ------------------------------------------------------------------ */
function renderLogin(errorMsg) {
  $('#app').innerHTML =
    '<div class="login-wrap"><form class="card login-card stack" id="login" novalidate>' +
    '<div class="brand-mark" aria-hidden="true">HI</div>' +
    '<h1>' + esc(t('admin.login.title')) + '</h1>' +
    '<div class="field"><label for="email">' + esc(t('admin.login.email')) + '</label>' +
    '<input class="input" id="email" type="email" required autocomplete="username" dir="ltr"></div>' +
    '<div class="field"><label for="password">' + esc(t('admin.login.password')) + '</label>' +
    '<input class="input" id="password" type="password" required autocomplete="current-password" dir="ltr"></div>' +
    (errorMsg ? '<div class="notice warning" role="alert">' + icon('alert') + '<span>' + esc(errorMsg) + '</span></div>' : '') +
    '<button class="btn btn-primary btn-block" type="submit">' + icon('lock') + esc(t('admin.login.submit')) + '</button>' +
    '<p class="muted" style="font-size:.8rem;text-align:center;margin:0">' + esc(t('admin.login.note')) + '</p>' +
    langSelectHtml() + '</form></div>';
  bindLangSelect();
  $('#login').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    api('api_admin_login', $('#email').value.trim(), $('#password').value)
      .then(function (res) {
        session.token = res.token; session.admin = res.admin;
        try { sessionStorage.setItem('hi_admin_token', res.token); } catch (err) {}
        currentRoute = '#/dashboard';
        enterApp();
      })
      .catch(function (err) { renderLogin(apiMessage(err)); });
  });
}

/** Server errors arrive as "CODE: message"; show only the message. */
function apiMessage(err) {
  var m = (err && err.message) || '';
  return m.replace(/^[A-Z_]+:\s*/, '') || t('common.error');
}

function enterApp() {
  if (session.admin.must_change_password) renderChangePassword(); else renderShell();
}

/* ---- Forced password change (first login / after reset) ------------------------- */
function renderChangePassword(errorMsg) {
  $('#app').innerHTML =
    '<div class="login-wrap"><form class="card login-card stack" id="pwform" novalidate>' +
    '<div class="brand-mark" aria-hidden="true">HI</div>' +
    '<h1>' + esc(t('a.pw.title')) + '</h1>' +
    '<p class="muted" style="text-align:center">' + esc(t('a.pw.text')) + '</p>' +
    '<div class="field"><label for="pw-old">' + esc(t('a.pw.old')) + '</label><input class="input" id="pw-old" type="password" required autocomplete="current-password" dir="ltr"></div>' +
    '<div class="field"><label for="pw-new">' + esc(t('a.pw.new')) + '</label><input class="input" id="pw-new" type="password" required minlength="12" autocomplete="new-password" dir="ltr"><span class="hint">' + esc(t('a.pw.hint')) + '</span></div>' +
    '<div class="field"><label for="pw-new2">' + esc(t('a.pw.repeat')) + '</label><input class="input" id="pw-new2" type="password" required minlength="12" autocomplete="new-password" dir="ltr"></div>' +
    (errorMsg ? '<div class="notice warning" role="alert">' + icon('alert') + '<span>' + esc(errorMsg) + '</span></div>' : '') +
    '<button class="btn btn-primary btn-block" type="submit">' + icon('lock') + esc(t('common.save')) + '</button>' +
    '<button class="btn btn-ghost btn-block" type="button" id="pw-cancel">' + esc(t('a.logout')) + '</button>' +
    '</form></div>';
  $('#pw-cancel').onclick = logout;
  $('#pwform').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
    if ($('#pw-new').value !== $('#pw-new2').value) { renderChangePassword(t('a.pw.mismatch')); return; }
    e.target.querySelector('button[type=submit]').disabled = true;
    api('api_admin_changePassword', session.token, $('#pw-old').value, $('#pw-new').value)
      .then(function (admin) { session.admin = admin; toast(t('a.pw.done'), 'success'); renderShell(); })
      .catch(function (err) { renderChangePassword(apiMessage(err)); });
  });
}

function langSelectHtml() {
  return '<label class="row" style="justify-content:center">' + icon('globe') +
    '<select class="select" id="lang" style="width:auto;min-height:40px">' +
    SUPPORTED_LANGS.map(function (l) { return '<option value="' + l + '"' + (l === currentLang ? ' selected' : '') + '>' + esc(LANG_NAMES[l]) + '</option>'; }).join('') +
    '</select></label>';
}
function bindLangSelect() {
  var s = $('#lang');
  if (s) s.onchange = function () { setLang(s.value); session.admin ? renderShell() : renderLogin(); };
}

/* ---- Shell --------------------------------------------------------------------- */
function renderShell() {
  var a = session.admin;
  var initials = (a.name || a.email || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  $('#app').innerHTML =
    '<div class="shell"><aside class="sidebar" id="sidebar"><a class="brand" href="#/dashboard"><span class="brand-mark" aria-hidden="true" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--primary),var(--secondary));font-weight:700;font-size:.85rem">HI</span>HAMDI CAF</a>' +
    '<nav class="side-nav" aria-label="Admin">' + NAV.map(function (n) {
      if (n.group) return '<div class="side-group">' + esc(t(n.group)) + '</div>';
      return '<a href="#/' + n.key + '" data-key="' + n.key + '"' + (canRead(n.key) ? '' : ' aria-disabled="true"') + '>' + icon(n.icon) + '<span>' + esc(t('a.' + n.key)) + '</span></a>';
    }).join('') + '</nav>' +
    '<div style="margin-block-start:var(--s5)">' + langSelectHtml() + '</div></aside>' +
    '<div><header class="topbar"><button class="btn btn-icon side-toggle" id="side-toggle" aria-label="Menu">' + icon('menu') + '</button>' +
    '<h1 id="page-title"></h1><span class="spacer"></span>' +
    '<button class="btn btn-icon" aria-label="Notifications">' + icon('bell') + '</button>' +
    '<span class="user-chip"><span class="avatar">' + esc(initials) + '</span><span class="name">' + esc(a.name || a.email) + '</span></span>' +
    '<button class="btn btn-icon" id="logout" aria-label="' + esc(t('a.logout')) + '" title="' + esc(t('a.logout')) + '">' + icon('logout', 'flip-rtl') + '</button>' +
    '</header><div class="content-tabs" id="subtabs"></div><main class="content" id="content"></main></div></div>';
  bindLangSelect();
  $('#side-toggle').onclick = toggleSidebar;
  $('#logout').onclick = logout;
  route();
}

function toggleSidebar(force) {
  var sb = $('#sidebar');
  var open = typeof force === 'boolean' ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  var ov = $('.overlay');
  if (open && !ov) { ov = document.createElement('div'); ov.className = 'overlay'; ov.onclick = function () { toggleSidebar(false); }; document.body.appendChild(ov); }
  if (!open && ov) ov.remove();
}

function logout() {
  var token = session.token;
  SOURCES = {}; REQ_CACHE = []; PAY_CACHE = [];
  adminCacheClear();          // no admin data stays in memory after signing out
  prefetchDone = false;
  session = { token: null, admin: null };
  try { sessionStorage.removeItem('hi_admin_token'); } catch (e) {}
  api('api_admin_logout', token).catch(function () {});
  currentRoute = '';
  renderLogin();
}

/* ---- Router ----------------------------------------------------------------------- */
var NAV_ALIAS = { 'guidance-rules': 'guidance', payment_methods: 'payments' };

function route() {
  if (!session.admin) return;
  var parts = routeHash().replace(/^#\/?/, '').split('/');
  var key = parts[0] || 'dashboard', sub = parts[1] || '', id = '';
  try { id = decodeURIComponent(parts.slice(2).join('/')); } catch (e) {}
  var cfg = SECTIONS[key];
  var perm = (cfg && cfg.perm) || NAV_ALIAS[key] || key;
  if (!canRead(perm)) { key = 'dashboard'; sub = ''; cfg = null; }
  var navKey = NAV_ALIAS[key] || key;
  $$('.side-nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-key') === navKey); });
  $('#page-title').textContent = t(key === 'payment_methods' ? 'ops.methods' : 'a.' + navKey);
  $('#subtabs').innerHTML = (key === 'guidance' || key === 'guidance-rules')
    ? '<a class="chip' + (key === 'guidance' ? ' active' : '') + '" href="#/guidance">' + esc(t('ui.questions')) + '</a>' +
      '<a class="chip' + (key === 'guidance-rules' ? ' active' : '') + '" href="#/guidance-rules">' + esc(t('ui.rules')) + '</a>' : '';
  toggleSidebar(false);
  window.scrollTo(0, 0);
  switch (key) {
    case 'dashboard': return loadDashboard();
    case 'appointments': return sub === 'edit' ? renderRequestDetail(id) : renderRequests();
    case 'payments': return sub === 'edit' ? renderPaymentDetail(id) : renderPayments(sub === 'q' ? id : undefined);
    case 'reports': return renderReports();
    case 'admins': return renderAdmins(sub === 'edit' ? id : null);
    case 'roles': return renderRoles(sub === 'edit' ? id : (sub === 'new' ? 'new' : null));
    case 'languages': return renderLanguages();
    case 'drive': return renderDrive();
    case 'media': return sub === 'new' ? renderDocumentUpload(true) : renderMedia();
  }
  if (!cfg) return loadDashboard();
  if (key === 'documents' && sub === 'new') return renderDocumentUpload(false);
  var pre = (cfg.preload || []).map(loadSource);
  Promise.all(pre).then(function () {
    if (sub === 'new') renderForm(key, cfg, null);
    else if (sub === 'edit') renderForm(key, cfg, id);
    else if (sub === 'view') renderView(key, cfg, id);
    else renderList(key, cfg);
  }).catch(handleApiError);
}

/* ---- Dashboard -------------------------------------------------------------------- */
function loadDashboard() {
  $('#content').innerHTML = '<div class="grid kpis">' + skeletonCards(8, 70) + '</div>';
  api('api_admin_getDashboard', session.token).then(function (d) {
    renderDashboard(d);
    schedulePrefetch();
  }).catch(handleApiError);
}

/* ---- Speed: prefetch and in-place refresh (see adminApi in ui.js) ---------------- */
/** Starts loading a section's first screen in the background (nothing is shown). */
function prefetchSection(key) {
  if (!session.admin) return;
  var cfg = SECTIONS[key];
  if (!canRead((cfg && cfg.perm) || NAV_ALIAS[key] || key)) return;
  var quiet = function (p) { if (p && p.catch) p.catch(function () {}); };
  if (key === 'dashboard') return quiet(api('api_admin_getDashboard', session.token));
  if (key === 'appointments') { quiet(loadSource('categories')); return quiet(api('api_admin_listRequests', session.token, REQ_FILTER)); }
  if (key === 'payments') { quiet(loadSource('payment_methods')); return quiet(api('api_admin_listPayments', session.token, PAY_FILTER)); }
  if (!cfg) return;
  (cfg.preload || []).concat(listSources(cfg)).forEach(function (e) { quiet(loadSource(e)); });
  quiet(api('api_admin_list', session.token, cfg.entity, listArgs(cfg, listState(key))));
}

var prefetchDone = false;
/** After the first dashboard: load the busiest sections, a little apart. */
function schedulePrefetch() {
  if (prefetchDone) return;
  prefetchDone = true;
  ['appointments', 'payments', 'services', 'categories'].forEach(function (k, i) {
    setTimeout(function () { prefetchSection(k); }, 400 + i * 300);
  });
}

/** Touching or pointing at a menu entry starts loading it before the tap ends. */
document.addEventListener('pointerover', onNavIntent, { passive: true });
document.addEventListener('touchstart', onNavIntent, { passive: true });
function onNavIntent(e) {
  var a = e.target && e.target.closest ? e.target.closest('.side-nav a[data-key]') : null;
  if (!a || a.getAttribute('data-prefetched')) return;
  a.setAttribute('data-prefetched', '1');
  setTimeout(function () { a.removeAttribute('data-prefetched'); }, 15000);
  prefetchSection(a.getAttribute('data-key'));
}

/**
 * Newer data arrived for a screen shown from memory: redraw list-type screens in place.
 * Never under the admin's hands: not on edit/detail pages, with a dialog open or while typing.
 */
window.addEventListener('hi:admin-data', function () {
  if (!session.admin || document.querySelector('.modal-backdrop')) return;
  var parts = routeHash().replace(/^#\/?/, '').split('/');
  if (parts[1]) return;
  var a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  var y = window.scrollY;
  route();
  setTimeout(function () { window.scrollTo(0, y); }, 0);
});

function kpi(labelKey, value, iconName, sub) {
  return '<div class="card card-sm kpi"><span class="kpi-label">' + icon(iconName) + esc(t(labelKey)) + '</span>' +
    '<span class="kpi-value">' + esc(value) + '</span>' + (sub ? '<span class="kpi-sub">' + esc(sub) + '</span>' : '') + '</div>';
}

function donut(segments) {
  var total = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
  var r = 52, c = 2 * Math.PI * r, offset = 0;
  var arcs = segments.map(function (s) {
    var len = c * s.value / total;
    var out = '<circle r="' + r + '" cx="70" cy="70" fill="none" stroke="' + s.color + '" stroke-width="18" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 70 70)"/>';
    offset += len;
    return out;
  }).join('');
  return '<svg viewBox="0 0 140 140" width="160" height="160" role="img" aria-label="' + esc(t('d.status')) + '">' +
    '<circle r="' + r + '" cx="70" cy="70" fill="none" stroke="rgba(163,177,198,.25)" stroke-width="18"/>' + arcs +
    '<text x="70" y="76" text-anchor="middle" font-size="20" font-weight="700" fill="#243746">' + total + '</text></svg>';
}

function renderDashboard(d) {
  var s = d.stats;
  var max = Math.max.apply(null, d.requestsByMonth.map(function (m) { return m.count; }).concat([1]));
  var statusColors = { pending: '#B57E22', under_review: '#527D91', approved: '#36866C', rejected: '#C45A5A', completed: '#244B68' };
  var segments = Object.keys(d.statusBreakdown).map(function (k) { return { label: k, value: d.statusBreakdown[k], color: statusColors[k] || '#718096' }; });

  $('#content').innerHTML =
    '<div class="grid kpis">' +
      kpi('k.services', s.services, 'file') + kpi('k.categories', s.categories, 'layers') +
      kpi('k.requests', s.requests, 'calendar') + kpi('k.pending', s.pending, 'bell') +
      kpi('k.approved', s.approved, 'checkCircle') + kpi('k.rejected', s.rejected, 'close') +
      kpi('k.documents', s.documents, 'file') + kpi('k.cashPending', formatMoney(s.cashPending, 'EUR'), 'cash', s.cashPendingCount + ' × AWAITING_CASH_PAYMENT') +
    '</div>' +
    '<div class="grid dash-grid">' +
      '<div class="card"><div class="card-head"><h2>' + esc(t('d.requests')) + '</h2></div><div class="bars">' +
        d.requestsByMonth.map(function (m) {
          return '<div class="bar"><span class="track"><span class="fill" style="height:' + Math.round(m.count / max * 100) + '%"></span></span><span>' + esc(m.label) + '</span></div>';
        }).join('') + '</div></div>' +
      '<div class="card donut-wrap"><div class="card-head" style="width:100%"><h2>' + esc(t('d.status')) + '</h2></div>' + donut(segments) +
        '<div class="legend">' + segments.map(function (x) { return '<div><span style="background:' + x.color + '"></span>' + esc(x.label) + ' · ' + x.value + '</div>'; }).join('') + '</div></div>' +
    '</div>' +
    '<div class="grid dash-grid">' +
      '<div class="card"><div class="card-head"><h2>' + esc(t('d.activity')) + '</h2></div><div class="table-wrap"><table class="table"><tbody>' +
        d.activity.map(function (a) { return '<tr><td>' + esc(a.at) + '</td><td>' + esc(a.who) + '</td><td>' + esc(a.what) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="stack"><div class="card"><div class="card-head"><h2>' + esc(t('d.quick')) + '</h2></div><div class="quick">' +
        '<a class="btn btn-sm btn-primary" href="#/services">' + icon('plus') + esc(t('d.newService')) + '</a>' +
        '<a class="btn btn-sm" href="#/documents">' + icon('upload') + esc(t('d.upload')) + '</a>' +
        '<a class="btn btn-sm" href="#/payments">' + icon('cash') + esc(t('d.recordCash')) + '</a></div></div>' +
      '<div class="card"><div class="card-head"><h2>' + esc(t('d.popular')) + '</h2></div><ul class="list-plain">' +
        d.popular.map(function (p) { return '<li>' + icon('eye') + '<span style="flex:1">' + esc(tf(p.titles, 'title') || p.title) + '</span><strong>' + esc(p.views) + '</strong></li>'; }).join('') +
      '</ul></div></div>' +
    '</div>';
}

function handleApiError(err) {
  if (err && /SESSION_EXPIRED/.test(err.message || '')) { logout(); toast(apiMessage(err), 'error'); return; }
  if (err && /PASSWORD_CHANGE_REQUIRED/.test(err.message || '')) { renderChangePassword(); return; }
  $('#content').innerHTML = '<div class="card"><div class="notice warning">' + icon('alert') + '<span>' + esc(t('common.error')) + '</span></div></div>';
}

/* ---- Boot -------------------------------------------------------------------------- */
setLang(detectLang());
initRouting(route);
if (session.token) {
  // Reopening with a session: load the dashboard while the session is being checked
  // (the server checks the session for that call too; a refused answer is ignored).
  var bootRoute = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  if (!bootRoute || bootRoute === 'dashboard') api('api_admin_getDashboard', session.token).catch(function () {});
  api('api_admin_me', session.token)
    .then(function (admin) { session.admin = admin; enterApp(); })
    .catch(function () { session.token = null; try { sessionStorage.removeItem('hi_admin_token'); } catch (e) {} renderLogin(); });
} else {
  renderLogin();
}

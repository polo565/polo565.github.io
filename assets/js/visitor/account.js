/* HAMDI ITALIE — optional visitor accounts (spec §21). Guests never need one. */

function setVisitorToken(tok) {
  try { if (tok) localStorage.setItem('hi_visitor_token', tok); else localStorage.removeItem('hi_visitor_token'); } catch (e) {}
}

function renderAccount(mode) {
  var tok = visitorToken();
  if (!tok) return renderAuth(mode === 'register' ? 'register' : 'login');
  loadingPage();
  Promise.all([api('api_visitorMe', tok), api('api_visitorRequests', tok)]).then(function (r) {
    window.visitorProfile = r[0];
    renderDashboardV(r[0], r[1]);
  }).catch(function (e) {
    if (/SESSION_EXPIRED/.test((e && e.message) || '')) { setVisitorToken(''); window.visitorProfile = null; renderAuth('login'); }
    else errorPage(e, function () { renderAccount(mode); });
  });
}

function renderAuth(mode) {
  var reg = mode === 'register';
  setMain(pageSection(crumbs([{ label: t('acc.title') }]) +
    '<div class="auth-wrap"><form class="card stack" id="auth-form" novalidate>' +
      '<h1>' + esc(t(reg ? 'acc.register' : 'acc.login')) + '</h1>' +
      '<div class="notice small">' + icon('info') + '<span>' + esc(t('acc.optional')) + '</span></div>' +
      (reg ? '<div class="field"><label for="a-name">' + esc(t('acc.name')) + '</label><input class="input" id="a-name" required maxlength="100" autocomplete="name"></div>' : '') +
      '<div class="field"><label for="a-phone">' + esc(t('acc.phone')) + '</label><input class="input" id="a-phone" type="tel" required maxlength="30" autocomplete="tel" dir="ltr" placeholder="+39 …"></div>' +
      (reg ? '<div class="field"><label for="a-email">' + esc(t('acc.emailOpt')) + '</label><input class="input" id="a-email" type="email" maxlength="120" autocomplete="email" dir="ltr"></div>' : '') +
      '<div class="field"><label for="a-pw">' + esc(t('acc.password')) + '</label><input class="input" id="a-pw" type="password" required minlength="8" maxlength="200" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" dir="ltr">' +
        (reg ? '<span class="hint">' + esc(t('acc.passwordHint')) + '</span>' : '') + '</div>' +
      (reg ? '<label class="check"><input type="checkbox" id="a-consent" required><span>' + esc(t('contact.consent')) + '</span></label>' : '') +
      '<div class="err" id="a-err" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">' + icon(reg ? 'user' : 'lock') + esc(t(reg ? 'acc.register' : 'acc.login')) + '</button>' +
      '<p class="small" style="text-align:center;margin:0">' + esc(t(reg ? 'acc.haveAccount' : 'acc.noAccount')) + ' <a href="#/account/' + (reg ? 'login' : 'register') + '">' + esc(t(reg ? 'acc.login' : 'acc.register')) + '</a></p>' +
      (!reg ? '<p class="small muted" style="margin:0">' + esc(t('acc.forgot')) + '</p>' : '') +
    '</form></div>'));
  $('#auth-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
    var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    var call = reg
      ? api('api_visitorRegister', { name: $('#a-name').value, phone: $('#a-phone').value, email: $('#a-email').value, password: $('#a-pw').value, consent: $('#a-consent').checked, preferred_lang: currentLang })
      : api('api_visitorLogin', $('#a-phone').value, $('#a-pw').value);
    call.then(function (res) { setVisitorToken(res.token); window.visitorProfile = res.visitor; navigate('#/account', route); })
      .catch(function (err) { $('#a-err').textContent = cleanError(err); btn.disabled = false; });
  });
}

function renderDashboardV(me, requests) {
  setMain(pageSection(crumbs([{ label: t('acc.title') }]) +
    '<div class="row" style="justify-content:space-between"><h1 style="margin:0">' + esc(me.name) + '</h1>' +
      '<button class="btn btn-sm" id="v-logout">' + icon('logout', 'flip-rtl') + esc(t('acc.logout')) + '</button></div>' +
    '<div class="grid acc-grid"><div class="stack-lg"><h2>' + esc(t('acc.myRequests')) + '</h2>' +
      (requests.length ? requests.map(requestCard).join('') : '<div class="card"><p class="muted" style="margin:0">' + esc(t('acc.noRequests')) + '</p></div>') +
      '<a class="btn btn-accent" href="#/request">' + icon('plus') + esc(t('svc.request')) + '</a></div>' +
    '<div class="stack-lg"><form class="card stack" id="v-profile" novalidate><h2>' + esc(t('acc.profile')) + '</h2>' +
      '<p class="small muted" style="margin:0" dir="ltr">' + esc(me.phone) + (me.phone_verified ? '' : ' · ' + esc(t('acc.unverified'))) + '</p>' +
      '<div class="field"><label for="p-name">' + esc(t('acc.name')) + '</label><input class="input" id="p-name" required maxlength="100" value="' + esc(me.name) + '"></div>' +
      '<div class="field"><label for="p-email">' + esc(t('acc.emailOpt')) + '</label><input class="input" id="p-email" type="email" maxlength="120" dir="ltr" value="' + esc(me.email || '') + '"></div>' +
      '<button class="btn btn-primary" type="submit">' + esc(t('common.save')) + '</button></form>' +
    '<form class="card stack" id="v-pw" novalidate><h2>' + esc(t('acc.changePw')) + '</h2>' +
      '<div class="field"><label for="p-old">' + esc(t('acc.oldPw')) + '</label><input class="input" id="p-old" type="password" required autocomplete="current-password" dir="ltr"></div>' +
      '<div class="field"><label for="p-new">' + esc(t('acc.newPw')) + '</label><input class="input" id="p-new" type="password" required minlength="8" autocomplete="new-password" dir="ltr"><span class="hint">' + esc(t('acc.passwordHint')) + '</span></div>' +
      '<button class="btn" type="submit">' + esc(t('common.save')) + '</button></form>' +
    '<button class="btn btn-danger btn-ghost" id="v-delete">' + icon('trash') + esc(t('acc.delete')) + '</button></div></div>'));

  $('#v-logout').onclick = function () {
    var tok = visitorToken(); setVisitorToken(''); window.visitorProfile = null;
    api('api_visitorLogout', tok).catch(function () {});
    navigate('#/', route);
  };
  $('#v-profile').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
    api('api_visitorUpdateProfile', visitorToken(), { name: $('#p-name').value, email: $('#p-email').value, preferred_lang: currentLang })
      .then(function (p) { window.visitorProfile = p; toast(t('acc.saved'), 'success'); })
      .catch(function (err) { toast(cleanError(err), 'error'); });
  });
  $('#v-pw').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
    api('api_visitorChangePassword', visitorToken(), $('#p-old').value, $('#p-new').value)
      .then(function () { e.target.reset(); toast(t('acc.saved'), 'success'); })
      .catch(function (err) { toast(cleanError(err), 'error'); });
  });
  $('#v-delete').onclick = function () {
    openModal(t('acc.delete'), '<p>' + esc(t('acc.deleteConfirm')) + '</p><div class="field"><label for="d-pw">' + esc(t('acc.password')) + '</label>' +
      '<input class="input" id="d-pw" type="password" autocomplete="current-password" dir="ltr"></div>', [
      { label: t('common.cancel') },
      { label: t('acc.delete'), cls: 'btn-danger', onClick: function () {
        var pw = $('#d-pw').value;
        api('api_visitorDeleteAccount', visitorToken(), pw).then(function () {
          setVisitorToken(''); window.visitorProfile = null; toast(t('acc.deleted'), 'success'); navigate('#/', route);
        }).catch(function (err) { toast(cleanError(err), 'error'); });
      } }
    ]);
  };
}

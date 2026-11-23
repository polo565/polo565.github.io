/* HAMDI CAF — request form, one-time receipt and status tracking. */

var STATUS_TONE = { pending: 'warning', under_review: 'info', info_required: 'warning', approved: 'success', rejected: 'error', completed: 'success', cancelled: '' };
var PAY_TONE = { PAID: 'success', REFUNDED: '', CANCELLED: '', PAYMENT_FAILED: 'error', PARTIALLY_PAID: 'warning', AWAITING_CASH_PAYMENT: 'warning', UNPAID: 'warning', PAYMENT_PENDING: 'info', REFUND_REQUESTED: 'info' };

function statusBadge(st) { return '<span class="badge ' + (STATUS_TONE[st] || '') + '">' + esc(t('st.' + st)) + '</span>'; }
function payBadge(st) { return '<span class="badge ' + (PAY_TONE[st] || '') + '">' + esc(t('pst.' + st)) + '</span>'; }

function visitorToken() { try { return localStorage.getItem('hi_visitor_token') || ''; } catch (e) { return ''; } }

/* ---- Request form ------------------------------------------------------------- */
function renderRequest(slug) {
  loadData('catalog', function () { return api('api_getCatalog'); }, function (cat) {
    var all = [];
    cat.categories.forEach(function (c) { c.services.forEach(function (s) { all.push({ s: s, c: c }); }); });
    var options = cat.categories.map(function (c) {
      return '<optgroup label="' + esc(tf(c, 'title')) + '">' + c.services.map(function (s) {
        return '<option value="' + esc(s.slug) + '"' + (s.slug === slug ? ' selected' : '') + '>' + esc(tf(s, 'title')) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    var me = window.visitorProfile || null;
    setMain(pageSection(crumbs([{ label: t('req.title') }]) +
      '<div><h1>' + esc(t('req.title')) + '</h1><p class="muted">' + esc(t('req.intro')) + '</p></div>' +
      '<form class="card form-grid" id="req-form" novalidate>' +
        '<div class="field full"><label for="r-svc">' + esc(t('req.service')) + '</label><select class="select" id="r-svc" required><option value="">' + esc(t('req.choose')) + '</option>' + options + '</select></div>' +
        '<div class="full" id="r-details"></div>' +
        field('r-name', 'contact.name', '<input class="input" id="r-name" required maxlength="100" autocomplete="name" value="' + esc(me ? me.name : '') + '">') +
        field('r-phone', 'contact.phone', '<input class="input" id="r-phone" type="tel" maxlength="30" autocomplete="tel" dir="ltr" value="' + esc(me ? me.phone : '') + '">') +
        field('r-email', 'contact.email', '<input class="input" id="r-email" type="email" maxlength="120" autocomplete="email" dir="ltr" value="' + esc(me ? me.email || '' : '') + '">', true) +
        field('r-msg', 'contact.message', '<textarea class="textarea" id="r-msg" maxlength="2000"></textarea>', true) +
        '<div class="notice small full">' + icon('lock') + '<span>' + esc(t('req.noDocs')) + '</span></div>' +
        '<div class="field full"><label for="r-files">' + esc(t('req.files')) + '</label>' +
          '<input class="input" type="file" id="r-files" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">' +
          '<span class="hint">' + esc(t('req.filesHint')) + '</span></div>' +
        '<label class="check full"><input type="checkbox" id="r-consent" required><span>' + esc(t('contact.consent')) + '</span></label>' +
        '<div class="full err" id="r-err" role="alert"></div>' +
        '<div class="full"><button class="btn btn-primary" type="submit">' + icon('arrow', 'flip-rtl') + esc(t('req.submit')) + '</button></div>' +
      '</form>'));
    var details = {};
    function loadDetails() {
      var sl = $('#r-svc').value;
      $('#r-details').innerHTML = '';
      if (!sl) return;
      $('#r-details').innerHTML = '<div class="skeleton" style="height:60px"></div>';
      var p = PAGE_CACHE['svc:' + sl] ? Promise.resolve(PAGE_CACHE['svc:' + sl]) : api('api_getService', sl);
      p.then(function (d) {
        PAGE_CACHE['svc:' + sl] = d; details = d;
        if ($('#r-svc').value !== sl) return;
        var methods = d.paymentMethods || [];
        var defaultMethod = (methods.filter(function (m) { return m.cash; })[0] || methods[0] || {}).id;
        $('#r-details').innerHTML =
          (d.cities.length ? '<div class="field"><label for="r-city">' + esc(t('req.city')) + '</label><select class="select" id="r-city"><option value="">' + esc(t('req.anyCity')) + '</option>' +
            d.cities.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.province ? ' (' + esc(c.province) + ')' : '') + '</option>'; }).join('') + '</select></div>' : '') +
          (d.price.amount_due > 0 && methods.length ? '<fieldset class="field pay-choice"><legend>' + esc(t('req.payment')) + ' — ' + esc(formatMoney(d.price.amount_due, d.price.currency)) + '</legend>' +
            methods.map(function (m) {
              return '<label class="check"><input type="radio" name="r-pay" value="' + esc(m.id) + '"' + (m.id === defaultMethod ? ' checked' : '') + '><span><strong>' + esc(tf(m, 'name')) + '</strong>' +
                (m.cash ? ' · ' + esc(t('price.noBank')) : '') + '</span></label>';
            }).join('') + '<div class="well small" id="r-pay-info"></div></fieldset>' : '');
        var showInfo = function () {
          var sel = $('input[name=r-pay]:checked'), box = $('#r-pay-info');
          if (!box) return;
          var m = methods.filter(function (x) { return sel && x.id === sel.value; })[0];
          box.innerHTML = m ? '<p style="margin:0 0 var(--s2)"><strong>' + esc(t('price.howItWorks')) + '</strong> ' + esc(t('price.step1')) + ' ' +
            esc(tvP('price.step2', { method: tf(m, 'name') })) + ' ' + esc(t('price.step3')) + '</p>' +
            (tf(m, 'provider_fee_text') ? '<p class="muted" style="margin:0">' + esc(tf(m, 'provider_fee_text')) + '</p>' : '') : '';
          box.hidden = !m;
        };
        $$('input[name=r-pay]').forEach(function (r) { r.onchange = showInfo; });
        showInfo();
      }).catch(function () { $('#r-details').innerHTML = ''; });
    }
    $('#r-svc').onchange = loadDetails;
    if (slug) loadDetails();
    $('#req-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, err = $('#r-err');
      err.textContent = '';
      if (!f.checkValidity()) { f.reportValidity(); return; }
      if (!$('#r-phone').value.trim() && !$('#r-email').value.trim()) { err.textContent = t('req.phoneOrEmail'); $('#r-phone').focus(); return; }
      var svc = details.service;
      if (!svc || svc.slug !== $('#r-svc').value) { err.textContent = t('common.loading'); return; }
      var pay = f.querySelector('input[name=r-pay]:checked');
      var btn = f.querySelector('button[type=submit]');
      var picked = Array.prototype.slice.call(($('#r-files') && $('#r-files').files) || []);
      if (picked.length > 3) { err.textContent = t('req.filesMax'); return; }
      var bad = picked.filter(function (x) { return x.size > 10 * 1024 * 1024 || !/\.(pdf|jpe?g|png)$/i.test(x.name); })[0];
      if (bad) { err.textContent = t('req.fileBad') + ' (' + bad.name + ')'; return; }
      btn.disabled = true;
      Promise.all(picked.map(readUpload)).then(function (files) {
      return api('api_submitRequest', {
        service_id: svc.id, city_id: $('#r-city') ? $('#r-city').value : '', name: $('#r-name').value, phone: $('#r-phone').value,
        email: $('#r-email').value, message: $('#r-msg').value, payment_method_id: pay ? pay.value : '', consent: $('#r-consent').checked,
        preferred_lang: currentLang, files: files
      }, visitorToken() || null);
      }).then(function (res) {
        renderReceipt(res, svc);
      }).catch(function (e2) {
        err.textContent = cleanError(e2);
        btn.disabled = false;
      });
    });
  });
}

/** Reads a picked file as {name, base64} for the server (which re-checks type and size). */
function readUpload(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve({ name: file.name, base64: String(r.result).replace(/^data:[^,]*,/, '') }); };
    r.onerror = function () { reject(new Error(t('common.error'))); };
    r.readAsDataURL(file);
  });
}

/** Server errors come as "CODE: message"; show the message part only. */
function cleanError(e) {
  var m = (e && e.message) || '';
  var code = (m.match(/^([A-Z_]+):/) || [])[1];
  // Known codes are shown in the visitor's language; field validation keeps the server detail.
  var map = { AUTH: 'err.auth', NOT_FOUND: 'err.notFound', RATE_LIMITED: 'err.rate', LOCKED: 'err.locked', CONFLICT: 'err.conflict', WEAK_PASSWORD: 'acc.passwordHint', INTERNAL: 'common.error' };
  if (code && map[code]) return t(map[code]);
  if (code === 'VALIDATION' && /files?: /.test(m)) return t('req.fileBad');
  if (code === 'VALIDATION') return t('err.validation') + ' (' + m.replace(/^VALIDATION:\s*/, '') + ')';
  return m.replace(/^[A-Z_]+:\s*/, '') || t('common.error');
}

/* ---- One-time receipt ------------------------------------------------------------- */
function renderReceipt(res, svc) {
  var p = res.payment;
  setMain(pageSection('<div class="card stack receipt">' +
    '<div class="row">' + '<span class="icon-badge" style="color:var(--success)">' + icon('checkCircle') + '</span><h1 style="margin:0">' + esc(t('rec.title')) + '</h1></div>' +
    '<p>' + esc(tf(svc, 'title')) + '</p>' +
    '<div class="codes">' + codeBox(t('rec.ref'), res.reference) + codeBox(t('rec.code'), res.trackingCode) + '</div>' +
    '<div class="notice warning">' + icon('alert') + '<span>' + esc(t('rec.keep')) + '</span></div>' +
    (p ? '<div class="well stack"><h2>' + icon('cash') + esc(t('rec.payTitle')) + '</h2>' +
      '<div class="price-row"><span>' + esc(t('rec.amount')) + '</span><strong>' + esc(formatMoney(p.amount_due, p.currency)) + '</strong></div>' +
      '<div class="price-row"><span>' + esc(t('track.status')) + '</span>' + payBadge(p.status) + '</div>' +
      (p.method ? '<p><strong>' + esc(tf(p.method, 'name')) + '</strong>' + (p.method.cash ? ' · ' + esc(t('price.noBank')) : '') + '</p>' +
        (methodLink(p.method)
          ? '<p class="small">' + esc(tvP('rec.payNote', { ref: res.reference, amount: formatMoney(p.amount_due, p.currency) })) + '</p>' +
            methodInstructions(p.method, tvP('rec.payNow', { method: tf(p.method, 'name') })) +
            '<p class="small muted">' + esc(t('rec.afterPay')) + '</p>'
          : (tf(p.method, 'instructions') ? textBlock(tf(p.method, 'instructions')) : '')) +
        (tf(p.method, 'location') ? '<p class="row">' + icon('mapPin') + esc(tf(p.method, 'location')) + '</p>' : '') : '') +
      (p.deadline_at ? '<p class="small muted">' + esc(t('rec.deadline')) + ': ' + esc(String(p.deadline_at).slice(0, 10)) + '</p>' : '') +
      '</div>' : '') +
    '<div class="notice small">' + icon('info') + '<span>' + esc(t('track.notOfficial')) + '</span></div>' +
    '<div class="row"><a class="btn btn-primary" href="#/track/' + encodeURIComponent(res.reference) + '">' + esc(t('rec.track')) + '</a>' +
    '<a class="btn" href="#/">' + esc(t('nav.home')) + '</a></div></div>'));
  $$('.copy-btn').forEach(function (b) {
    b.onclick = function () {
      var v = b.getAttribute('data-copy');
      try { navigator.clipboard.writeText(v).then(function () { toast(t('common.copied'), 'success'); }); }
      catch (e) { toast(v); }
    };
  });
}

function codeBox(label, value) {
  return '<div class="code-box"><span class="small muted">' + esc(label) + '</span><strong dir="ltr">' + esc(value) + '</strong>' +
    '<button class="btn btn-sm copy-btn" type="button" data-copy="' + esc(value) + '">' + esc(t('common.copy')) + '</button></div>';
}

/* ---- Tracking --------------------------------------------------------------------- */
function renderTrack(ref) {
  setMain(pageSection(crumbs([{ label: t('track.title') }]) +
    '<div><h1>' + esc(t('track.title')) + '</h1><p class="muted">' + esc(t('track.intro')) + '</p></div>' +
    '<form class="card form-grid" id="track-form" novalidate>' +
      field('t-ref', 'track.ref', '<input class="input" id="t-ref" required maxlength="20" dir="ltr" placeholder="HI-2026-000001" value="' + esc(ref || '') + '" autocapitalize="characters">') +
      field('t-code', 'track.code', '<input class="input" id="t-code" required maxlength="12" dir="ltr" autocomplete="off" autocapitalize="characters">') +
      '<div class="full err" id="t-err" role="alert"></div>' +
      '<div class="full"><button class="btn btn-primary" type="submit">' + icon('search') + esc(t('track.submit')) + '</button></div>' +
    '</form><div id="t-result"></div>'));
  $('#track-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
    var btn = e.target.querySelector('button'); btn.disabled = true;
    $('#t-err').textContent = '';
    api('api_trackRequest', $('#t-ref').value.trim(), $('#t-code').value.trim())
      .then(function (v) { $('#t-result').innerHTML = requestCard(v); })
      .catch(function (err) { $('#t-err').textContent = cleanError(err); $('#t-result').innerHTML = ''; })
      .then(function () { btn.disabled = false; });
  });
}

/** Status card shared by tracking and the account area. */
function requestCard(v) {
  var p = v.payment;
  return '<div class="card stack req-card"><div class="row" style="justify-content:space-between"><strong dir="ltr">' + esc(v.reference) + '</strong>' + statusBadge(v.status) + '</div>' +
    '<p style="margin:0">' + esc(tf(v.service, 'title')) + '</p>' +
    (v.request_type === 'official_confirmed' && v.official_confirmation_ref
      ? '<div class="notice success">' + icon('checkCircle') + '<span>' + esc(t('track.official')) + ': <strong dir="ltr">' + esc(v.official_confirmation_ref) + '</strong></span></div>'
      : '<p class="small muted" style="margin:0">' + esc(t('track.notOfficial')) + '</p>') +
    (p ? '<div class="price-row"><span>' + esc(t('rec.payTitle')) + ' · ' + esc(formatMoney(p.amount_due, p.currency)) + '</span>' + payBadge(p.status) + '</div>' : '') +
    '<p class="small muted" style="margin:0">' + esc(t('track.updated')) + ': ' + esc(String(v.updated_at || v.created_at).slice(0, 10)) + '</p></div>';
}

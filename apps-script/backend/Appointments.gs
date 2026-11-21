/**
 * HAMDI ITALIE — service requests (spec §3.3, §10, §21).
 * A request here is NEVER an official government appointment unless an admin
 * sets request_type = official_confirmed with the external confirmation ref.
 */

/** Visitor submits a request (guest or signed-in). Returns reference + one-time tracking code. */
function appt_submit_(input, visitor) {
  var d = validate_(input, {
    service_id: { type: 'id', required: true },
    city_id: { type: 'id' },
    name: { type: 'string', required: true, max: 100 },
    phone: { type: 'phone' },
    email: { type: 'email' },
    preferred_lang: { type: 'lang', default: APP.DEFAULT_LANG },
    message: { type: 'text', max: 2000 },
    payment_method_id: { type: 'id' },
    consent: { type: 'bool' }
  });
  if (!d.consent) vfail_('consent', 'required');
  if (visitor) {
    d.phone = d.phone || visitor.phone;
    d.email = d.email || visitor.email || '';
  }
  if (!d.phone && !d.email) vfail_('phone', 'phone or email required');
  rateLimit_('appt:' + (d.phone || d.email), 5, 3600);

  var service = db_get_('Services', d.service_id);
  if (!service || !toBool_(service.published) || !toBool_(service.requestable)) throw AppError_('NOT_FOUND', 'Service not available.');
  if (d.city_id && !db_get_('Cities', d.city_id)) vfail_('city_id', 'unknown city');

  var methods = pay_methodsForService_(service);
  var method = null;
  if (d.payment_method_id) {
    method = methods.filter(function (m) { return m.id === d.payment_method_id; })[0];
    if (!method) vfail_('payment_method_id', 'not available for this service');
  }
  var breakdown = pay_breakdown_(service, method);
  if (breakdown.amount_due > 0 && !method) {
    // Cash-first default: never block a request because no method was chosen.
    method = methods.filter(pay_isCash_)[0] || methods[0] || null;
    breakdown = pay_breakdown_(service, method);
  }

  // Files are checked before anything is written (type from content, size, count).
  var checkedFiles = upload_checkVisitorFiles_(input && input.files);
  var trackingCode = randomCode_(8);
  var retentionDays = settings_get_('upload_retention_days', 90);
  var result = db_withLock_(function () {
    var reference = formatRef_('HI', nextSequence_('HI'));
    var appt = db_insert_('Appointments', {
      reference: reference, service_id: service.id, city_id: d.city_id, visitor_id: visitor ? visitor.id : '',
      request_type: 'assistance', name: d.name, email: d.email, phone: d.phone, preferred_lang: d.preferred_lang,
      message: d.message, status: 'pending', internal_notes_json: '[]', attachments_json: '[]',
      tracking_code_hash: appt_trackingHash_(reference, trackingCode),
      payment_method_id: method ? method.id : '', amount_due: breakdown.amount_due,
      payment_status: '', consent_at: nowIso_(), retention_until: addMinutesIso_(retentionDays * 1440)
    });
    if (checkedFiles.length) {
      appt = db_update_('Appointments', appt.id, { attachments_json: JSON.stringify(upload_saveVisitorFiles_(checkedFiles, reference)) });
    }
    var payment = null;
    if (breakdown.amount_due > 0) {
      payment = pay_createForRequest_(appt, method, breakdown);
      appt = db_update_('Appointments', appt.id, { payment_status: payment.status });
    }
    return { appt: appt, payment: payment };
  });

  notify_requestReceived_(result.appt, service);
  return {
    reference: result.appt.reference,
    trackingCode: trackingCode, // shown ONCE; only its hash is stored
    status: result.appt.status,
    price: breakdown,
    payment: result.payment ? appt_paymentPublic_(result.payment, method) : null
  };
}

function appt_trackingHash_(reference, code) {
  return sha256Hex_(auth_pepper_() + '|track|' + String(reference).toUpperCase() + '|' + String(code).toUpperCase());
}

/** Guest status lookup: requires reference AND tracking code (spec §21). */
function appt_track_(reference, code) {
  reference = cleanText_(reference).toUpperCase();
  code = cleanText_(code).toUpperCase().replace(/[^0-9A-Z]/g, '');
  rateLimit_('track:' + reference, 10, 900);
  var appt = /^HI-\d{4}-\d{6}$/.test(reference) ? db_findOne_('Appointments', function (a) { return a.reference === reference; }) : null;
  // Same error for unknown reference and wrong code.
  if (!appt || !code || !safeEquals_(appt_trackingHash_(reference, code), appt.tracking_code_hash)) {
    throw AppError_('NOT_FOUND', 'Invalid reference or code.');
  }
  return appt_publicView_(appt);
}

/** What a visitor may see. Internal notes and contact data are never included. */
function appt_publicView_(appt) {
  var service = db_get_('Services', appt.service_id) || {};
  var payment = db_findOne_('Payments', function (p) { return p.appointment_id === appt.id; });
  var method = payment ? db_get_('PaymentMethods', payment.method_id) : null;
  var view = {
    reference: appt.reference, status: appt.status, request_type: appt.request_type,
    service: pick_(service, ['slug'].concat(L_('title'))),
    created_at: appt.created_at, updated_at: appt.updated_at,
    payment: payment ? appt_paymentPublic_(payment, method) : null
  };
  if (appt.request_type === 'official_confirmed') view.official_confirmation_ref = appt.official_confirmation_ref;
  return view;
}

function appt_paymentPublic_(p, method) {
  var out = pick_(p, ['payment_ref', 'amount_due', 'amount_received', 'currency', 'status', 'deadline_at']);
  if (method) {
    out.method = pick_(method, ['code', 'type'].concat(L_('name'), L_('instructions'), L_('location')));
    out.method.cash = pay_isCash_(method);
    out.method.requires_bank_account = toBool_(method.requires_bank_account);
    out.method.requires_card = toBool_(method.requires_card);
  }
  return out;
}

function appt_forVisitor_(visitorId) {
  return db_where_('Appointments', function (a) { return a.visitor_id === visitorId; })
    .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
    .map(appt_publicView_);
}

/* ---- Admin --------------------------------------------------------------------- */
function appt_adminList_(filters) {
  filters = filters || {};
  var services = {};
  db_all_('Services').forEach(function (s) { services[s.id] = s; });
  var q = cleanText_(filters.q).toLowerCase();
  var list = db_all_('Appointments').filter(function (a) {
    var svc = services[a.service_id] || {};
    if (filters.status && a.status !== filters.status) return false;
    if (filters.city_id && a.city_id !== filters.city_id) return false;
    if (filters.category_id && svc.category_id !== filters.category_id) return false;
    if (filters.payment_status && a.payment_status !== filters.payment_status) return false;
    if (q && [a.reference, a.name, a.email, a.phone].join(' ').toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
  return list.map(function (a) {
    var out = Object.assign({}, a);
    delete out.tracking_code_hash;
    out.internal_notes = parseJson_(a.internal_notes_json, []);
    delete out.internal_notes_json;
    var svc = services[a.service_id] || {};
    out.service = pick_(svc, L_('title'));
    out.service_title = pickLang_(svc, 'title', 'en');
    return out;
  });
}

function appt_adminUpdate_(ctx, id, input) {
  var before = db_get_('Appointments', id);
  if (!before) throw AppError_('NOT_FOUND', 'Request not found.');
  var d = validate_(input, {
    status: { type: 'enum', values: APPOINTMENT_STATUSES },
    request_type: { type: 'enum', values: REQUEST_TYPES },
    official_confirmation_ref: { type: 'string', max: 120 },
    note: { type: 'text', max: 2000 }
  });
  var patch = {};
  if (d.status) patch.status = d.status;
  if (d.request_type) patch.request_type = d.request_type;
  var type = d.request_type || before.request_type;
  var confirmation = d.official_confirmation_ref || before.official_confirmation_ref;
  if (type === 'official_confirmed' && !confirmation) {
    vfail_('official_confirmation_ref', 'required to mark an official appointment as confirmed');
  }
  if (d.official_confirmation_ref) patch.official_confirmation_ref = d.official_confirmation_ref;
  if (d.note) {
    var notes = parseJson_(before.internal_notes_json, []);
    notes.push({ at: nowIso_(), by: ctx.adminEmail, text: d.note });
    patch.internal_notes_json = JSON.stringify(notes);
  }
  var after = db_update_('Appointments', id, patch);
  audit_(ctx, 'update', 'Appointments', id, before, after, '');
  if (patch.status && patch.status !== before.status) notify_statusChanged_(after);
  return after;
}

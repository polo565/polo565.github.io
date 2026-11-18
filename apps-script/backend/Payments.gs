/**
 * HAMDI ITALIE — cash-first payments (spec §22).
 * Rules enforced here:
 *  - choosing a cash method only creates AWAITING_CASH_PAYMENT, never PAID;
 *  - PAID / PARTIALLY_PAID come only from pay_recordReceipt_ (admin, payments:write),
 *    with amount, date, receipt reference and confirming admin;
 *  - every change is audited; no card data is ever handled.
 */

var CASH_TYPES_ = ['cash_office', 'cash_partner', 'cash_network'];
var ADMIN_SETTABLE_PAYMENT_STATUSES_ = ['UNPAID', 'PAYMENT_PENDING', 'AWAITING_CASH_PAYMENT', 'PAYMENT_FAILED', 'REFUND_REQUESTED', 'CANCELLED'];

function pay_isCash_(method) { return method && CASH_TYPES_.indexOf(method.type) >= 0; }

/** Active methods available for a service (empty list on the service = all active). */
function pay_methodsForService_(service) {
  var allowed = parseJson_(service && service.payment_method_ids_json, []);
  return db_where_('PaymentMethods', function (m) {
    return toBool_(m.active) && (!allowed.length || allowed.indexOf(m.id) >= 0);
  }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
}

/**
 * Price breakdown, always separated (spec §22.6). Only HAMDI ITALIE charges
 * (+ provider fee for non-cash methods) are collected; official fees are shown
 * for information and only when verified.
 */
function pay_breakdown_(service, method) {
  var num = function (v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
  var extras = parseJson_(service.additional_charges_json, []).map(function (c) { return { label: c, amount: num(c.amount) }; });
  var hamdi = num(service.service_price) + num(service.assistance_fee) + extras.reduce(function (s, x) { return s + x.amount; }, 0);
  var discount = 0;
  var d = parseJson_(service.discount_json, null);
  if (d && (!d.until || Date.now() <= new Date(d.until).getTime())) {
    discount = d.type === 'percent' ? Math.round(hamdi * Math.min(100, num(d.value))) / 100 : Math.min(hamdi, num(d.value));
  }
  var provider = method && !pay_isCash_(method) ? num(service.provider_fee) : 0;
  return {
    currency: service.currency || 'EUR',
    hamdi_fee: hamdi, discount: discount, provider_fee: provider,
    amount_due: Math.round((hamdi - discount + provider) * 100) / 100,
    official_fee: toBool_(service.official_fee_verified) ? num(service.official_fee_amount) : null,
    official_fee_verified: toBool_(service.official_fee_verified)
  };
}

/** Creates the payment for a new request (called inside appt_submit_). */
function pay_createForRequest_(appt, method, breakdown) {
  var deadline = method && Number(method.deadline_days) > 0 ? addMinutesIso_(Number(method.deadline_days) * 1440) : '';
  return db_insert_('Payments', {
    payment_ref: formatRef_('PAY', nextSequence_('PAY')),
    appointment_id: appt.id, visitor_id: appt.visitor_id || '', method_id: method ? method.id : '',
    amount_due: breakdown.amount_due, amount_received: 0, currency: breakdown.currency,
    status: pay_isCash_(method) ? 'AWAITING_CASH_PAYMENT' : 'UNPAID',
    deadline_at: deadline, evidence_file_ids_json: '[]'
  });
}

/** Admin records money actually received (cash or other). The ONLY path to PAID. */
function pay_recordReceipt_(ctx, paymentId, input) {
  var d = validate_(input, {
    amount: { type: 'number', required: true, min: 0.01, max: 100000 },
    payment_date: { type: 'string', required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ },
    receipt_ref: { type: 'string', required: true, max: 80 },
    notes: { type: 'text', max: 1000 }
  });
  var before = db_get_('Payments', paymentId);
  if (!before) throw AppError_('NOT_FOUND', 'Payment not found.');
  if (['CANCELLED', 'REFUNDED'].indexOf(before.status) >= 0) throw AppError_('INVALID_STATE', 'Payment is ' + before.status + '.');
  var received = Math.round((Number(before.amount_received || 0) + d.amount) * 100) / 100;
  var due = Number(before.amount_due || 0);
  var after = db_update_('Payments', paymentId, {
    amount_received: received,
    status: received + 0.001 >= due ? 'PAID' : 'PARTIALLY_PAID',
    payment_date: d.payment_date, receipt_ref: d.receipt_ref,
    recorded_by: ctx.adminId, confirmed_by: ctx.adminId, confirmed_at: nowIso_(),
    notes: d.notes ? (before.notes ? before.notes + '\n' : '') + d.notes : before.notes
  });
  audit_(ctx, 'payment_received', 'Payments', paymentId, before, after, d.amount + ' ' + after.currency);
  pay_syncAppointment_(after);
  notify_paymentStatus_(after);
  return after;
}

function pay_recordRefund_(ctx, paymentId, input) {
  var d = validate_(input, {
    amount: { type: 'number', required: true, min: 0.01, max: 100000 },
    refund_date: { type: 'string', required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ },
    reason: { type: 'text', required: true, max: 1000 }
  });
  var before = db_get_('Payments', paymentId);
  if (!before) throw AppError_('NOT_FOUND', 'Payment not found.');
  var refunded = Number(before.refund_amount || 0) + d.amount;
  if (refunded > Number(before.amount_received || 0) + 0.001) throw AppError_('VALIDATION', 'amount: refund exceeds amount received');
  var after = db_update_('Payments', paymentId, {
    refund_amount: refunded, refund_date: d.refund_date, refund_reason: d.reason, refunded_by: ctx.adminId, status: 'REFUNDED'
  });
  audit_(ctx, 'payment_refunded', 'Payments', paymentId, before, after, d.amount + ' ' + after.currency);
  pay_syncAppointment_(after);
  return after;
}

/** Other status changes (never PAID / PARTIALLY_PAID / REFUNDED). */
function pay_setStatus_(ctx, paymentId, status, note) {
  status = validateField_('status', status, { type: 'enum', values: ADMIN_SETTABLE_PAYMENT_STATUSES_, required: true });
  var before = db_get_('Payments', paymentId);
  if (!before) throw AppError_('NOT_FOUND', 'Payment not found.');
  // Once money has been received, the record can only move towards a refund.
  if (Number(before.amount_received || 0) > 0 && status !== 'REFUND_REQUESTED') {
    throw AppError_('INVALID_STATE', 'Money has already been received: record a refund instead.');
  }
  var after = db_update_('Payments', paymentId, { status: status });
  audit_(ctx, 'payment_status', 'Payments', paymentId, before, after, cleanText_(note).slice(0, 500));
  pay_syncAppointment_(after);
  return after;
}

function pay_syncAppointment_(payment) {
  if (payment.appointment_id && db_get_('Appointments', payment.appointment_id)) {
    db_update_('Appointments', payment.appointment_id, { payment_status: payment.status });
  }
}

/**
 * Financial summary (spec §22.5). Distinguishes money received, pending and
 * refunded. Revenue recognition for accounting is the owner's responsibility.
 */
function pay_report_(fromIso, toIso) {
  var from = fromIso ? new Date(fromIso).getTime() : 0;
  var to = toIso ? new Date(toIso).getTime() + 86400000 : Infinity;
  var methods = {};
  db_all_('PaymentMethods').forEach(function (m) { methods[m.id] = m; });
  var appts = {};
  db_all_('Appointments').forEach(function (a) { appts[a.id] = a; });
  var services = {};
  db_all_('Services').forEach(function (s) { services[s.id] = s; });

  var r = { received: 0, cash: 0, card: 0, online: 0, other: 0, pending: 0, refunded: 0, byDay: {}, byMonth: {}, byCategory: {}, count: 0 };
  db_all_('Payments').forEach(function (p) {
    var t = new Date(p.payment_date || p.created_at).getTime();
    if (t < from || t >= to) return;
    r.count++;
    var received = Number(p.amount_received || 0), refunded = Number(p.refund_amount || 0);
    var type = (methods[p.method_id] || {}).type || 'other';
    if (['UNPAID', 'PAYMENT_PENDING', 'AWAITING_CASH_PAYMENT', 'PARTIALLY_PAID'].indexOf(p.status) >= 0) {
      r.pending += Math.max(0, Number(p.amount_due || 0) - received);
    }
    r.refunded += refunded;
    if (!received) return;
    r.received += received;
    if (CASH_TYPES_.indexOf(type) >= 0) r.cash += received;
    else if (type === 'card' || type === 'prepaid') r.card += received;
    else if (type === 'online_gateway') r.online += received;
    else r.other += received;
    var day = String(p.payment_date || p.created_at).slice(0, 10);
    r.byDay[day] = (r.byDay[day] || 0) + received;
    r.byMonth[day.slice(0, 7)] = (r.byMonth[day.slice(0, 7)] || 0) + received;
    var appt = appts[p.appointment_id], svc = appt && services[appt.service_id];
    var cat = svc ? svc.category_id : 'unknown';
    r.byCategory[cat] = (r.byCategory[cat] || 0) + received;
  });
  ['received', 'cash', 'card', 'online', 'other', 'pending', 'refunded'].forEach(function (k) { r[k] = Math.round(r[k] * 100) / 100; });
  return r;
}

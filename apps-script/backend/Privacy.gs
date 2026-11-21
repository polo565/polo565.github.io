/**
 * HAMDI ITALIE — privacy: retention and erasure (spec §11, GDPR).
 *
 * - The daily job anonymises service requests and contact messages older than the
 *   `request_retention_days` setting (default 730 days).
 * - An administrator can anonymise one request or message, or erase one visitor
 *   (account + all their requests), e.g. after a deletion request.
 * - A visitor who deletes their account gets the same erasure.
 *
 * Anonymising keeps what accounting and statistics need (reference, service, city, status,
 * dates, amounts, payment records) and removes everything that identifies the person:
 * name, phone, email, message, internal notes, attachments (moved to the Drive trash) and the
 * tracking code. Personal fields are also removed from the audit rows of that record
 * (audit_ no longer stores them at all — see PERSONAL_FIELDS_ in AuditLogs.gs).
 */
var ANON_NAME_ = '[anonymised]';

function privacy_isAnon_(rec) { return rec && rec.name === ANON_NAME_; }

/** Removes personal fields from the audit rows of one record (kept: who, what, when). */
function privacy_scrubAudit_(entity, id) {
  var fields = PERSONAL_FIELDS_[entity] || [];
  db_where_('AuditLogs', function (l) { return l.entity === entity && l.entity_id === id; }).forEach(function (l) {
    var patch = {};
    ['before_json', 'after_json'].forEach(function (k) {
      var o = parseJson_(l[k], null);
      if (!o || typeof o !== 'object') return;
      var changed = false;
      fields.forEach(function (f) { if (f in o && o[f] !== '[removed]') { o[f] = '[removed]'; changed = true; } });
      if (changed) patch[k] = JSON.stringify(o);
    });
    if (Object.keys(patch).length) db_update_('AuditLogs', l.id, patch);
  });
}

/** Anonymises one request. Returns false when it already was. */
function privacy_anonymiseRequest_(appt, ctx, reason) {
  if (!appt || privacy_isAnon_(appt)) return false;
  parseJson_(appt.attachments_json, []).forEach(function (x) { drive_trash_(x.file_id); });
  db_update_('Appointments', appt.id, {
    name: ANON_NAME_, email: '', phone: '', message: '', internal_notes_json: '[]',
    attachments_json: '[]', tracking_code_hash: '', retention_until: ''
  });
  privacy_scrubAudit_('Appointments', appt.id);
  audit_(ctx, 'anonymise', 'Appointments', appt.id, null, null, reason || '');
  return true;
}

function privacy_anonymiseContact_(msg, ctx, reason) {
  if (!msg || privacy_isAnon_(msg)) return false;
  db_update_('ContactRequests', msg.id, { name: ANON_NAME_, email: '', phone: '', subject: '', message: '' });
  privacy_scrubAudit_('ContactRequests', msg.id);
  audit_(ctx, 'anonymise', 'ContactRequests', msg.id, null, null, reason || '');
  return true;
}

/** Erases a visitor account and anonymises all their requests. */
function privacy_eraseVisitor_(visitorId, ctx, reason) {
  var v = db_get_('Visitors', visitorId);
  if (!v) throw AppError_('NOT_FOUND', 'Visitor not found.');
  db_update_('Visitors', v.id, {
    active: false, deletion_requested_at: v.deletion_requested_at || nowIso_(), name: '[deleted]', email: '',
    phone: 'deleted:' + v.id, password_hash: '', salt: ''
  });
  auth_revokeAll_('visitor', v.id);
  var n = 0;
  db_where_('Appointments', function (a) { return a.visitor_id === v.id; }).forEach(function (a) {
    if (privacy_anonymiseRequest_(a, ctx, 'visitor erased')) n++;
  });
  privacy_scrubAudit_('Visitors', v.id);
  audit_(ctx, 'erase', 'Visitors', v.id, null, null, (reason || '') + ' (' + n + ' requests anonymised)');
  return { requestsAnonymised: n };
}

/** Daily: anonymise requests and messages past the retention period. */
function privacy_retention_() {
  var days = Number(settings_get_('request_retention_days', 730)) || 730;
  if (days < 30) days = 30; // safety net against a typo wiping recent data
  var cutoff = Date.now() - days * 86400000;
  var old = function (r) { return !privacy_isAnon_(r) && r.created_at && new Date(r.created_at).getTime() < cutoff; };
  var reason = 'retention ' + days + ' days';
  var reqs = 0, msgs = 0;
  db_where_('Appointments', old).forEach(function (a) { if (privacy_anonymiseRequest_(a, SYSTEM_CTX_, reason)) reqs++; });
  db_where_('ContactRequests', old).forEach(function (m) { if (privacy_anonymiseContact_(m, SYSTEM_CTX_, reason)) msgs++; });
  return { requests: reqs, messages: msgs };
}

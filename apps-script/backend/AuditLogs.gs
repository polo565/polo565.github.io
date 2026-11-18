/**
 * HAMDI ITALIE — append-only audit log (spec §11, §22.4). Secrets are redacted.
 */
var AUDIT_REDACT_ = ['password_hash', 'salt', 'iterations', 'tracking_code_hash', 'token', 'password'];

/** Personal data of visitors: never copied into the audit log (privacy, spec §11). */
var PERSONAL_FIELDS_ = {
  Appointments: ['name', 'email', 'phone', 'message', 'internal_notes_json', 'attachments_json'],
  Visitors: ['name', 'email', 'phone'],
  ContactRequests: ['name', 'email', 'phone', 'subject', 'message']
};

function audit_redact_(obj, entity) {
  if (!obj || typeof obj !== 'object') return obj;
  var personal = PERSONAL_FIELDS_[entity] || [];
  var out = {};
  Object.keys(obj).forEach(function (k) {
    out[k] = AUDIT_REDACT_.indexOf(k) >= 0 ? '[redacted]' : personal.indexOf(k) >= 0 ? '[removed]' : obj[k];
  });
  return out;
}

/** ctx: { adminId, adminEmail } (from requireAdmin_) or a system context. */
function audit_(ctx, action, entity, entityId, before, after, note) {
  try {
    db_insert_('AuditLogs', {
      at: nowIso_(), admin_id: (ctx && ctx.adminId) || '', admin_email: (ctx && ctx.adminEmail) || 'system',
      action: action, entity: entity || '', entity_id: entityId || '',
      before_json: before ? JSON.stringify(audit_redact_(before, entity)).slice(0, 20000) : '',
      after_json: after ? JSON.stringify(audit_redact_(after, entity)).slice(0, 20000) : '',
      note: note || ''
    });
  } catch (e) {
    // Logging must never break the action itself, but failures are visible in Stackdriver.
    console.error('AUDIT FAILURE', action, entity, entityId, e);
  }
}

var SYSTEM_CTX_ = { adminId: '', adminEmail: 'system' };

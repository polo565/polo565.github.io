/**
 * HAMDI ITALIE — administrator API. EVERY function verifies the session token
 * and the role permission server-side via requireAdmin_() before doing anything.
 */

/* ---- Session ---------------------------------------------------------------------- */
function api_admin_login(email, password) {
  return handle_(function () { return auth_adminLogin_(email, password); });
}

function api_admin_logout(token) {
  return handle_(function () { auth_revokeSession_(token); return true; });
}

function api_admin_me(token) {
  return handle_(function () { return requireAdmin_(token, null, null, { allowPasswordChange: true }).profile; });
}

function api_admin_changePassword(token, oldPassword, newPassword) {
  return handle_(function () {
    var ctx = requireAdmin_(token, null, null, { allowPasswordChange: true });
    auth_changePassword_('Admins', 'admin', ctx.adminId, oldPassword, newPassword, token);
    audit_(ctx, 'password_change', 'Admins', ctx.adminId, null, null, '');
    return authz_adminProfile_(db_get_('Admins', ctx.adminId));
  });
}

/* ---- Dashboard ------------------------------------------------------------------------ */
function api_admin_getDashboard(token) {
  return handle_(function () {
    requireAdmin_(token, 'dashboard', 'read');
    // Reading every sheet costs several seconds in Apps Script: cache 60 s.
    var cache = CacheService.getScriptCache();
    var hit = cache.get('dash:v1');
    if (hit) return JSON.parse(hit);
    var data = dashboard_();
    var json = JSON.stringify(data);
    if (json.length < 95000) cache.put('dash:v1', json, 60);
    return data;
  });
}

function dashboard_() {
    var appts = db_all_('Appointments');
    var count = function (st) { return appts.filter(function (a) { return a.status === st; }).length; };
    var breakdown = {};
    APPOINTMENT_STATUSES.forEach(function (st) { var n = count(st); if (n) breakdown[st] = n; });
    var payments = db_all_('Payments');
    var awaiting = payments.filter(function (p) { return ['AWAITING_CASH_PAYMENT', 'UNPAID', 'PARTIALLY_PAID'].indexOf(p.status) >= 0; });

    var months = [];
    var d = new Date();
    for (var i = 5; i >= 0; i--) {
      var m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      var key = m.getFullYear() + '-' + ('0' + (m.getMonth() + 1)).slice(-2);
      months.push({ key: key, label: key.slice(5) + '/' + String(m.getFullYear()).slice(2), count: 0 });
    }
    appts.forEach(function (a) {
      var k = String(a.created_at).slice(0, 7);
      months.forEach(function (m) { if (m.key === k) m.count++; });
    });

    var services = db_all_('Services');
    return {
      stats: {
        services: services.filter(function (s) { return toBool_(s.published); }).length,
        categories: db_all_('Categories').length,
        requests: appts.length, pending: count('pending'), approved: count('approved'), rejected: count('rejected'),
        documents: db_all_('Documents').length,
        visitors: db_where_('Visitors', function (v) { return toBool_(v.active); }).length,
        newContacts: db_where_('ContactRequests', function (c) { return c.status === 'new'; }).length,
        cashPending: Math.round(awaiting.reduce(function (s, p) { return s + Math.max(0, Number(p.amount_due || 0) - Number(p.amount_received || 0)); }, 0) * 100) / 100,
        cashPendingCount: awaiting.length
      },
      requestsByMonth: months,
      statusBreakdown: breakdown,
      popular: services.filter(function (s) { return Number(s.view_count) > 0; })
        .sort(function (a, b) { return Number(b.view_count) - Number(a.view_count); }).slice(0, 5)
        .map(function (s) { return { title: pickLang_(s, 'title', 'fr'), titles: pick_(s, L_('title')), views: Number(s.view_count) }; }),
      activity: db_all_('AuditLogs').sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 8)
        .map(function (l) { return { at: String(l.at).replace('T', ' ').slice(0, 16), who: l.admin_email, what: l.action + ' ' + l.entity + (l.entity_id ? ' ' + l.entity_id : '') }; })
    };
}

/** Missing translations per content type and language (Languages screen). */
function api_admin_translationReport(token) {
  return handle_(function () {
    requireAdmin_(token, 'languages', 'read');
    var checks = [
      { entity: 'categories', sheet: 'Categories', fields: ['title', 'description'], label: 'title' },
      { entity: 'services', sheet: 'Services', fields: ['title', 'summary'], label: 'title' },
      { entity: 'faqs', sheet: 'FAQs', fields: ['question', 'answer'], label: 'question' },
      { entity: 'homepage', sheet: 'Homepage', fields: ['value'], label: 'key' },
      { entity: 'payment_methods', sheet: 'PaymentMethods', fields: ['name', 'instructions'], label: 'name' },
      { entity: 'guidance_questions', sheet: 'GuidanceQuestions', fields: ['question'], label: 'question' },
      { entity: 'guidance_rules', sheet: 'GuidanceRules', fields: ['title', 'explanation'], label: 'title' }
    ];
    var svcContent = {};
    db_all_('ServiceTranslations').forEach(function (t) { (svcContent[t.service_id] = svcContent[t.service_id] || {})[t.lang] = !!(t.description || t.procedure); });
    var out = checks.map(function (c) {
      var rows = db_all_(c.sheet);
      var missing = {};
      APP.LANGS.forEach(function (l) {
        missing[l] = rows.filter(function (r) {
          // Missing in `l` = another language has text for the field but `l` is empty.
          return c.fields.some(function (f) {
            return !r[f + '_' + l] && APP.LANGS.some(function (o) { return o !== l && r[f + '_' + o]; });
          });
        }).map(function (r) { return { id: r.id, label: String((c.label === 'key' ? r.key : pickLang_(r, c.label, 'fr')) || r.id).slice(0, 80) }; });
      });
      return { entity: c.entity, total: rows.length, missing: missing };
    });
    var services = db_all_('Services');
    var content = {};
    APP.LANGS.forEach(function (l) { content[l] = services.filter(function (x) { return (svcContent[x.id] || {})[l]; }).length; });
    return { entities: out, serviceContent: { total: services.length, withContent: content } };
  });
}

/* ---- Generic content CRUD --------------------------------------------------------------- */
function api_admin_list(token, entity, opts) {
  return handle_(function () {
    requireAdmin_(token, ent_def_(entity).section, 'read');
    return ent_list_(entity, opts);
  });
}

function api_admin_save(token, entity, id, data) {
  return handle_(function () {
    var ctx = requireAdmin_(token, ent_def_(entity).section, 'write');
    return ent_save_(ctx, entity, id || null, data);
  });
}

function api_admin_delete(token, entity, id) {
  return handle_(function () {
    var ctx = requireAdmin_(token, ent_def_(entity).section, 'delete');
    return ent_delete_(ctx, entity, id);
  });
}

/* ---- Requests --------------------------------------------------------------------------- */
function api_admin_listRequests(token, filters) {
  return handle_(function () { requireAdmin_(token, 'appointments', 'read'); return appt_adminList_(filters); });
}

function api_admin_updateRequest(token, id, data) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'appointments', 'write');
    return appt_adminUpdate_(ctx, id, data);
  });
}

/* ---- Payments ---------------------------------------------------------------------------- */
function api_admin_listPayments(token, opts) {
  return handle_(function () {
    requireAdmin_(token, 'payments', 'read');
    opts = opts || {};
    var q = cleanText_(opts.q).toLowerCase();
    var appts = {}, adminEmail = {};
    db_all_('Appointments').forEach(function (a) { appts[a.id] = a; });
    db_all_('Admins').forEach(function (a) { adminEmail[a.id] = a.email; });
    var items = db_all_('Payments').filter(function (p) {
      if (opts.status && p.status !== opts.status) return false;
      if (opts.method_id && p.method_id !== opts.method_id) return false;
      var a = appts[p.appointment_id] || {};
      if (q && [p.payment_ref, p.receipt_ref, a.reference, a.name, a.phone, a.email].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .map(function (p) {
        var a = appts[p.appointment_id] || {};
        return Object.assign({}, p, {
          request_reference: a.reference || '', visitor_name: a.name || '', visitor_phone: a.phone || '',
          confirmed_by_email: adminEmail[p.confirmed_by] || p.confirmed_by || '', refunded_by_email: adminEmail[p.refunded_by] || p.refunded_by || ''
        });
      });
    return { total: items.length, items: items.slice(0, 500) };
  });
}

function api_admin_recordPayment(token, paymentId, data) {
  return handle_(function () { return pay_recordReceipt_(requireAdmin_(token, 'payments', 'write'), paymentId, data); });
}

function api_admin_refundPayment(token, paymentId, data) {
  return handle_(function () { return pay_recordRefund_(requireAdmin_(token, 'payments', 'write'), paymentId, data); });
}

function api_admin_setPaymentStatus(token, paymentId, status, note) {
  return handle_(function () { return pay_setStatus_(requireAdmin_(token, 'payments', 'write'), paymentId, status, note); });
}

function api_admin_paymentReport(token, from, to) {
  return handle_(function () { requireAdmin_(token, 'reports', 'read'); return pay_report_(from, to); });
}

/* ---- Administrators & roles (super-admin only for writes) --------------------------------- */
function admin_public_(a) {
  return pick_(a, ['id', 'email', 'name', 'role_id', 'active', 'must_change_password', 'last_login_at', 'locked_until', 'created_at']);
}

function api_admin_listAdmins(token) {
  return handle_(function () { requireAdmin_(token, 'admins', 'read'); return db_all_('Admins').map(admin_public_); });
}

/** Creates or updates an admin. On creation returns a one-time temporary password. */
function api_admin_saveAdmin(token, id, data) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'admins', 'write');
    var d = validate_(data, {
      email: { type: 'email', required: !id }, name: { type: 'string', required: true, max: 100 },
      role_id: { type: 'string', required: true, max: 40 }, active: { type: 'bool', default: true }
    });
    if (!db_get_('Roles', d.role_id)) vfail_('role_id', 'unknown role');
    if (id) {
      var before = db_get_('Admins', id);
      if (!before) throw AppError_('NOT_FOUND', 'Admin not found.');
      if (id === ctx.adminId && (d.role_id !== before.role_id || !d.active)) throw AppError_('FORBIDDEN', 'You cannot change your own role or deactivate yourself.');
      if (before.role_id === 'ROL-SUPERADMIN' && (d.role_id !== 'ROL-SUPERADMIN' || !d.active) && admin_activeSuperCount_() <= 1) {
        throw AppError_('FORBIDDEN', 'At least one active super-administrator is required.');
      }
      var after = db_update_('Admins', id, { name: d.name, role_id: d.role_id, active: d.active });
      if (!d.active || d.role_id !== before.role_id) auth_revokeAll_('admin', id);
      CacheService.getScriptCache().remove('role:' + d.role_id);
      audit_(ctx, 'update', 'Admins', id, before, after, '');
      return { admin: admin_public_(after) };
    }
    if (db_findOne_('Admins', function (a) { return String(a.email).toLowerCase() === d.email; })) vfail_('email', 'already used');
    var temp = auth_tempPassword_();
    var rec = db_insert_('Admins', Object.assign({
      email: d.email, name: d.name, role_id: d.role_id, active: d.active, must_change_password: true, failed_attempts: 0
    }, auth_newPasswordFields_(temp)));
    audit_(ctx, 'create', 'Admins', rec.id, null, rec, '');
    return { admin: admin_public_(rec), temporaryPassword: temp };
  });
}

function api_admin_resetAdminPassword(token, id) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'admins', 'write');
    if (!db_get_('Admins', id)) throw AppError_('NOT_FOUND', 'Admin not found.');
    var temp = auth_tempPassword_();
    db_update_('Admins', id, Object.assign({ must_change_password: true, failed_attempts: 0, locked_until: '' }, auth_newPasswordFields_(temp)));
    auth_revokeAll_('admin', id);
    audit_(ctx, 'password_reset', 'Admins', id, null, null, '');
    return { temporaryPassword: temp };
  });
}

function admin_activeSuperCount_() {
  return db_where_('Admins', function (a) { return a.role_id === 'ROL-SUPERADMIN' && toBool_(a.active); }).length;
}

function api_admin_listRoles(token) {
  return handle_(function () {
    requireAdmin_(token, 'roles', 'read');
    return db_all_('Roles').map(function (r) {
      return { id: r.id, name: r.name, system: toBool_(r.system), permissions: authz_permissions_(r.id).permissions };
    });
  });
}

function api_admin_saveRole(token, id, data) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'roles', 'write');
    var d = validate_(data, { name: { type: 'string', required: true, max: 60, pattern: /^[a-z0-9_]+$/ } });
    var perms = {};
    PERM_SECTIONS.forEach(function (s) {
      var lvl = data && data.permissions ? data.permissions[s] : 'none';
      perms[s] = PERM_LEVELS.indexOf(lvl) >= 0 ? lvl : 'none';
    });
    var before = id ? db_get_('Roles', id) : null;
    if (id && !before) throw AppError_('NOT_FOUND', 'Role not found.');
    if (before && before.name === SUPER_ADMIN_ROLE_) throw AppError_('FORBIDDEN', 'The super_admin role cannot be modified.');
    if (db_findOne_('Roles', function (r) { return r.name === d.name && (!before || r.id !== before.id); })) vfail_('name', 'already used');
    var rec = before
      ? db_update_('Roles', id, { name: before.system ? before.name : d.name, permissions_json: JSON.stringify(perms) })
      : db_insert_('Roles', { name: d.name, permissions_json: JSON.stringify(perms), system: false });
    CacheService.getScriptCache().remove('role:' + rec.id);
    audit_(ctx, before ? 'update' : 'create', 'Roles', rec.id, before, rec, '');
    return { id: rec.id, name: rec.name, system: toBool_(rec.system), permissions: perms };
  });
}

function api_admin_deleteRole(token, id) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'roles', 'delete');
    var role = db_get_('Roles', id);
    if (!role) throw AppError_('NOT_FOUND', 'Role not found.');
    if (toBool_(role.system)) throw AppError_('FORBIDDEN', 'Built-in roles cannot be deleted.');
    if (db_findOne_('Admins', function (a) { return a.role_id === id; })) throw AppError_('IN_USE', 'Role is assigned to administrators.');
    db_delete_('Roles', id);
    CacheService.getScriptCache().remove('role:' + id);
    audit_(ctx, 'delete', 'Roles', id, role, null, '');
    return true;
  });
}

/* ---- Visitors: in-office password reset (spec §21 recovery without email/SMS) ------------- */
function api_admin_resetVisitorPassword(token, visitorId) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'visitors', 'write');
    var v = db_get_('Visitors', visitorId);
    if (!v || !toBool_(v.active)) throw AppError_('NOT_FOUND', 'Visitor not found.');
    var temp = auth_tempPassword_();
    db_update_('Visitors', visitorId, Object.assign({ must_change_password: true, failed_attempts: 0, locked_until: '' }, auth_newPasswordFields_(temp)));
    auth_revokeAll_('visitor', visitorId);
    audit_(ctx, 'password_reset', 'Visitors', visitorId, null, null, 'in-person identity check');
    return { temporaryPassword: temp };
  });
}

/* ---- Documents & Drive (Phase 7) ---------------------------------------------------------- */
function api_admin_uploadDocument(token, meta, file) {
  return handle_(function () { return doc_upload_(requireAdmin_(token, 'documents', 'write'), meta, file); });
}

function api_admin_replaceDocument(token, id, file) {
  return handle_(function () { return doc_replace_(requireAdmin_(token, 'documents', 'write'), id, file); });
}

function api_admin_deleteDocument(token, id) {
  return handle_(function () { return doc_delete_(requireAdmin_(token, 'documents', 'delete'), id); });
}

/** Any admin with documents:read can download, even documents that are not public. */
function api_admin_downloadDocument(token, id) {
  return handle_(function () {
    requireAdmin_(token, 'documents', 'read');
    var rec = db_get_('Documents', id);
    if (!rec) throw AppError_('NOT_FOUND', 'Document not found.');
    return drive_readBase64_(rec.drive_file_id);
  });
}

function api_admin_driveStatus(token) {
  return handle_(function () { requireAdmin_(token, 'drive', 'read'); return drive_status_(); });
}

/** Visitor attachment of a request. The file must belong to that request. */
function api_admin_getAttachment(token, appointmentId, fileId) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'appointments', 'read');
    var appt = db_get_('Appointments', appointmentId);
    if (!appt) throw AppError_('NOT_FOUND', 'Request not found.');
    var att = parseJson_(appt.attachments_json, []).filter(function (a) { return a.file_id === fileId; })[0];
    if (!att) throw AppError_('NOT_FOUND', 'Attachment not found.');
    audit_(ctx, 'attachment_view', 'Appointments', appointmentId, null, null, att.name);
    return drive_readBase64_(fileId);
  });
}

/* ---- Privacy (GDPR): anonymise / erase on request --------------------------------------- */
function api_admin_anonymiseRequest(token, id) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'appointments', 'delete');
    var a = db_get_('Appointments', id);
    if (!a) throw AppError_('NOT_FOUND', 'Request not found.');
    privacy_anonymiseRequest_(a, ctx, 'admin: data deletion request');
    return true;
  });
}

function api_admin_anonymiseContact(token, id) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'contacts', 'delete');
    var m = db_get_('ContactRequests', id);
    if (!m) throw AppError_('NOT_FOUND', 'Message not found.');
    privacy_anonymiseContact_(m, ctx, 'admin: data deletion request');
    return true;
  });
}

function api_admin_eraseVisitor(token, visitorId) {
  return handle_(function () {
    var ctx = requireAdmin_(token, 'visitors', 'delete');
    return privacy_eraseVisitor_(visitorId, ctx, 'admin: data deletion request');
  });
}

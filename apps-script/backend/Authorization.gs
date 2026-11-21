/**
 * HAMDI ITALIE — role-based access control for administrators.
 * Levels: none < read < write < delete. Checked on EVERY admin API call.
 */

var SUPER_ADMIN_ROLE_ = 'super_admin';

/** Built-in roles (seeded by setup; super_admin is fixed in code). */
function authz_builtinRoles_() {
  function all(level, except) {
    var p = {};
    PERM_SECTIONS.forEach(function (s) { p[s] = (except && except[s]) || level; });
    return p;
  }
  return [
    { id: 'ROL-SUPERADMIN', name: 'super_admin', system: true, permissions: all('delete') },
    { id: 'ROL-ADMIN', name: 'admin', system: true, permissions: all('delete', { admins: 'read', roles: 'read' }) },
    { id: 'ROL-CONTENT', name: 'content_manager', system: true, permissions: all('none', {
      dashboard: 'read', categories: 'write', services: 'read', documents: 'delete', drive: 'write', faqs: 'delete',
      homepage: 'write', media: 'delete', languages: 'write', guidance: 'write', cities: 'read' }) },
    { id: 'ROL-SERVICE', name: 'service_manager', system: true, permissions: all('none', {
      dashboard: 'read', categories: 'read', services: 'write', appointments: 'write', payments: 'write',
      contacts: 'write', documents: 'read', visitors: 'read', notifications: 'write', cities: 'write', reports: 'read' }) },
    { id: 'ROL-READONLY', name: 'readonly', system: true, permissions: all('read', { admins: 'none', roles: 'none', audit: 'none' }) }
  ];
}

function authz_level_(level) { return Math.max(0, PERM_LEVELS.indexOf(level)); }

/** Permissions map for a role id (cached 60 s so revocations apply quickly). */
function authz_permissions_(roleId) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('role:' + roleId);
  if (hit) return JSON.parse(hit);
  var role = db_get_('Roles', roleId);
  var perms = {};
  if (role) {
    if (role.name === SUPER_ADMIN_ROLE_) PERM_SECTIONS.forEach(function (s) { perms[s] = 'delete'; });
    else perms = parseJson_(role.permissions_json, {});
  }
  var out = { name: role ? role.name : '', permissions: perms };
  cache.put('role:' + roleId, JSON.stringify(out), CACHE_TTL.ROLE);
  return out;
}

function authz_adminProfile_(admin) {
  var r = authz_permissions_(admin.role_id);
  return {
    id: admin.id, email: admin.email, name: admin.name, role_id: admin.role_id, role: r.name,
    permissions: r.permissions, must_change_password: toBool_(admin.must_change_password)
  };
}

/**
 * Verifies the session token AND the permission. Returns a context object used
 * for audit logging. Throws SESSION_EXPIRED / FORBIDDEN / PASSWORD_CHANGE_REQUIRED.
 */
function requireAdmin_(token, section, level, opts) {
  var s = auth_resolveSession_(token, 'admin');
  var admin = db_get_('Admins', s.subject_id);
  if (!admin || !toBool_(admin.active)) {
    auth_revokeSession_(token);
    throw AppError_('SESSION_EXPIRED', 'Session expired.');
  }
  var profile = authz_adminProfile_(admin);
  if (profile.must_change_password && !(opts && opts.allowPasswordChange)) {
    throw AppError_('PASSWORD_CHANGE_REQUIRED', 'You must change your password.');
  }
  if (section && authz_level_(profile.permissions[section] || 'none') < authz_level_(level || 'read')) {
    throw AppError_('FORBIDDEN', 'Permission denied.');
  }
  return { token: token, adminId: admin.id, adminEmail: admin.email, profile: profile };
}

function requireVisitor_(token) {
  var s = auth_resolveSession_(token, 'visitor');
  var v = db_get_('Visitors', s.subject_id);
  if (!v || !toBool_(v.active)) { auth_revokeSession_(token); throw AppError_('SESSION_EXPIRED', 'Session expired.'); }
  return v;
}

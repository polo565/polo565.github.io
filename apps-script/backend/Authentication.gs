/**
 * HAMDI ITALIE — authentication: password hashing, sessions, admin and
 * visitor sign-in. See docs/SECURITY.md §2.
 */

var AUTH_GENERIC_ERROR_ = 'Invalid credentials.';
var SESSION_POLICY_ = {
  admin: { idleMinutes: SECURITY.SESSION_IDLE_MINUTES, absoluteHours: SECURITY.SESSION_ABSOLUTE_HOURS },
  visitor: { idleMinutes: SECURITY.VISITOR_SESSION_IDLE_DAYS * 1440, absoluteHours: 90 * 24 }
};

/* ---- Password hashing ------------------------------------------------------ */
function auth_pepper_() {
  var pepper = getProp_(PROP.PASSWORD_PEPPER, false);
  if (!pepper) throw AppError_('NOT_INITIALISED', 'Run setup() first.');
  return pepper;
}

/** Iterated, salted, peppered SHA-256. Returns base64. */
function auth_hash_(password, saltB64, iterations) {
  var salt = Utilities.base64Decode(saltB64);
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, auth_pepper_() + '|' + saltB64 + '|' + password);
  for (var i = 1; i < iterations; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(salt));
  }
  return Utilities.base64Encode(h);
}

/** Iteration count tuned by setup() for this runtime (see auth_calibrate_). */
function auth_iterations_() {
  var n = Number(PropertiesService.getScriptProperties().getProperty('HASH_ITERATIONS'));
  return n >= 2000 ? n : SECURITY.HASH_ITERATIONS;
}

/**
 * Measures digest speed and picks iterations so one hash takes ~1.5 s
 * (bounded 2,000–10,000). Stored per record, so changing it never breaks
 * existing passwords.
 */
function auth_calibrate_() {
  var sample = 300, start = Date.now();
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'calibration');
  for (var i = 0; i < sample; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(h.slice(0, 16)));
  var perIteration = Math.max(0.001, (Date.now() - start) / sample);
  var n = Math.max(2000, Math.min(SECURITY.HASH_ITERATIONS, Math.round(1500 / perIteration / 500) * 500));
  setProp_('HASH_ITERATIONS', n);
  return { iterations: n, msPerIteration: Math.round(perIteration * 1000) / 1000 };
}

function auth_newPasswordFields_(password) {
  var salt = Utilities.base64Encode(randomBytes_(16));
  var it = auth_iterations_();
  return { salt: salt, iterations: it, password_hash: auth_hash_(password, salt, it) };
}

function auth_verifyPassword_(record, password) {
  if (!record || !record.password_hash || !record.salt) return false;
  return safeEquals_(auth_hash_(password, record.salt, Number(record.iterations) || SECURITY.HASH_ITERATIONS), record.password_hash);
}

function auth_checkPasswordPolicy_(password, minLength) {
  password = String(password || '');
  if (password.length < minLength) throw AppError_('WEAK_PASSWORD', 'Password must be at least ' + minLength + ' characters.');
  if (password.length > 200) throw AppError_('WEAK_PASSWORD', 'Password too long.');
  return password;
}

/** Readable temporary password (shown once, must be changed at first login). */
function auth_tempPassword_() {
  return randomCode_(4) + '-' + randomCode_(4) + '-' + randomCode_(4) + '-' + randomCode_(4);
}

/* ---- Rate limiting -------------------------------------------------------- */
/** Counts hits for `key` in a fixed window; throws RATE_LIMITED above `max`. */
function rateLimit_(key, max, windowSeconds) {
  var c = CacheService.getScriptCache();
  var k = 'rl:' + sha256Hex_(key).slice(0, 32);
  var n = Number(c.get(k) || 0) + 1;
  c.put(k, String(n), windowSeconds);
  if (n > max) throw AppError_('RATE_LIMITED', 'Too many attempts, try again later.');
}

/* ---- Sessions --------------------------------------------------------------- */
function auth_createSession_(kind, subjectId) {
  var policy = SESSION_POLICY_[kind];
  var token = randomToken_();
  var now = nowIso_();
  var rec = {
    id: sha256Hex_(token), kind: kind, subject_id: subjectId, created_at: now, last_seen_at: now,
    idle_minutes: policy.idleMinutes, expires_at: addMinutesIso_(policy.absoluteHours * 60), revoked: false
  };
  db_insert_('Sessions', rec);
  CacheService.getScriptCache().put('sess:' + rec.id, JSON.stringify(rec), 600);
  return token;
}

/** Returns the live session for this token and kind, or throws SESSION_EXPIRED. */
function auth_resolveSession_(token, kind) {
  if (!token || typeof token !== 'string' || token.length < 20 || token.length > 100) throw AppError_('SESSION_EXPIRED', 'Session expired.');
  var id = sha256Hex_(token);
  var cache = CacheService.getScriptCache();
  var cached = cache.get('sess:' + id);
  var s = cached ? JSON.parse(cached) : db_get_('Sessions', id);
  var now = Date.now();
  if (!s || s.kind !== kind || toBool_(s.revoked) ||
      now > new Date(s.expires_at).getTime() ||
      now > new Date(s.last_seen_at).getTime() + Number(s.idle_minutes) * 60000) {
    cache.remove('sess:' + id);
    throw AppError_('SESSION_EXPIRED', 'Session expired.');
  }
  // Sliding expiry: persist last_seen at most every 5 minutes to limit writes.
  if (now - new Date(s.last_seen_at).getTime() > 5 * 60000) {
    s.last_seen_at = nowIso_();
    db_update_('Sessions', id, { last_seen_at: s.last_seen_at });
  }
  cache.put('sess:' + id, JSON.stringify(s), 600);
  return s;
}

function auth_revokeSession_(token) {
  if (!token) return;
  var id = sha256Hex_(token);
  CacheService.getScriptCache().remove('sess:' + id);
  if (db_get_('Sessions', id)) db_update_('Sessions', id, { revoked: true });
}

/** Revokes every session of a subject (password change, deactivation). */
function auth_revokeAll_(kind, subjectId, exceptToken) {
  var keep = exceptToken ? sha256Hex_(exceptToken) : null;
  var cache = CacheService.getScriptCache();
  db_where_('Sessions', function (s) {
    return s.kind === kind && s.subject_id === subjectId && !toBool_(s.revoked) && s.id !== keep;
  }).forEach(function (s) {
    cache.remove('sess:' + s.id);
    db_update_('Sessions', s.id, { revoked: true });
  });
}

/** Deletes expired/revoked sessions (daily trigger). */
function auth_purgeSessions_() {
  var now = Date.now();
  var dead = db_where_('Sessions', function (s) { return toBool_(s.revoked) || now > new Date(s.expires_at).getTime(); });
  dead.forEach(function (s) { db_delete_('Sessions', s.id); });
  return dead.length;
}

/* ---- Shared sign-in logic ------------------------------------------------------- */
function auth_signIn_(table, kind, record, password) {
  if (record && record.locked_until && Date.now() < new Date(record.locked_until).getTime()) {
    throw AppError_('LOCKED', 'Account temporarily locked. Try again in ' + SECURITY.LOCKOUT_MINUTES + ' minutes.');
  }
  var ok = record && toBool_(record.active) && auth_verifyPassword_(record, password);
  if (!ok) {
    if (record) {
      var fails = Number(record.failed_attempts || 0) + 1;
      var patch = { failed_attempts: fails };
      if (fails >= SECURITY.MAX_FAILED_LOGINS) { patch.locked_until = addMinutesIso_(SECURITY.LOCKOUT_MINUTES); patch.failed_attempts = 0; }
      db_update_(table, record.id, patch);
    }
    return null;
  }
  db_update_(table, record.id, { failed_attempts: 0, locked_until: '', last_login_at: nowIso_() });
  return auth_createSession_(kind, record.id);
}

/* ---- Administrators ------------------------------------------------------------- */
function auth_adminLogin_(email, password) {
  email = cleanText_(email).toLowerCase();
  rateLimit_('admin-login:' + email, 20, 900);
  var admin = email ? db_findOne_('Admins', function (a) { return String(a.email).toLowerCase() === email; }) : null;
  var token = auth_signIn_('Admins', 'admin', admin, String(password || ''));
  if (!token) {
    audit_({ adminId: admin ? admin.id : '', adminEmail: email }, 'login_failed', 'Admins', admin ? admin.id : '', null, null, '');
    throw AppError_('AUTH', AUTH_GENERIC_ERROR_);
  }
  audit_({ adminId: admin.id, adminEmail: admin.email }, 'login', 'Admins', admin.id, null, null, '');
  return { token: token, admin: authz_adminProfile_(db_get_('Admins', admin.id)) };
}

function auth_changePassword_(table, kind, id, oldPassword, newPassword, token) {
  var rec = db_get_(table, id);
  if (!auth_verifyPassword_(rec, String(oldPassword || ''))) throw AppError_('AUTH', AUTH_GENERIC_ERROR_);
  auth_checkPasswordPolicy_(newPassword, kind === 'admin' ? SECURITY.PASSWORD_MIN_LENGTH : 8);
  if (oldPassword === newPassword) throw AppError_('WEAK_PASSWORD', 'New password must differ.');
  var fields = auth_newPasswordFields_(newPassword);
  fields.must_change_password = false;
  db_update_(table, id, fields);
  auth_revokeAll_(kind, id, token);
  return true;
}

/* ---- Visitors (optional accounts, spec §21) --------------------------------------------- */
function auth_visitorRegister_(input) {
  if (!settings_get_('registration_enabled', true)) throw AppError_('DISABLED', 'Registration is disabled.');
  var d = validate_(input, {
    phone: { type: 'phone', required: true },
    email: { type: 'email' },
    name: { type: 'string', required: true, max: 100 },
    preferred_lang: { type: 'lang', default: APP.DEFAULT_LANG },
    consent: { type: 'bool' }
  });
  if (!d.consent) vfail_('consent', 'required');
  rateLimit_('visitor-register:' + d.phone, 5, 3600);
  var password = auth_checkPasswordPolicy_(input.password, 8);
  var exists = db_findOne_('Visitors', function (v) {
    return v.phone === d.phone || (d.email && String(v.email).toLowerCase() === d.email);
  });
  // Same message either way so the form cannot be used to discover accounts.
  if (exists) throw AppError_('CONFLICT', 'Cannot create an account with these details; if you already have one, sign in.');
  var rec = Object.assign({
    phone: d.phone, email: d.email, name: d.name, preferred_lang: d.preferred_lang,
    phone_verified: false, email_verified: false, active: true, must_change_password: false,
    failed_attempts: 0, consent_at: nowIso_()
  }, auth_newPasswordFields_(password));
  rec = db_insert_('Visitors', rec);
  return { token: auth_createSession_('visitor', rec.id), visitor: auth_visitorProfile_(rec) };
}

function auth_visitorLogin_(phone, password) {
  var p = normalizePhone_(phone);
  rateLimit_('visitor-login:' + (p || phone), 20, 900);
  var v = p ? db_findOne_('Visitors', function (x) { return x.phone === p; }) : null;
  var token = auth_signIn_('Visitors', 'visitor', v, String(password || ''));
  if (!token) throw AppError_('AUTH', AUTH_GENERIC_ERROR_);
  return { token: token, visitor: auth_visitorProfile_(db_get_('Visitors', v.id)) };
}

/** Fields a visitor may see about their own account. */
function auth_visitorProfile_(v) {
  return pick_(v, ['id', 'phone', 'email', 'name', 'preferred_lang', 'phone_verified', 'email_verified', 'must_change_password', 'created_at']);
}

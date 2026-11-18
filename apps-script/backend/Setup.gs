/**
 * HAMDI ITALIE — one-time / idempotent initialisation.
 *
 * Run `setup` from the Apps Script editor (owner only). It is safe to run again:
 * it only ADDS missing sheets, columns, seed rows, folders and the first
 * super-administrator. It never deletes or overwrites existing data.
 */
function setup() {
  ownerOnly_();
  var report = [];
  var props = PropertiesService.getScriptProperties();

  // 1. Configuration
  ['SPREADSHEET_ID', 'DRIVE_ROOT_FOLDER_ID', 'SUPER_ADMIN_EMAIL'].forEach(function (k) {
    if (!props.getProperty(PROP[k])) {
      throw new Error('Missing Script Property "' + k + '". Add it in Project Settings → Script properties, then run setup again.');
    }
  });
  if (!props.getProperty(PROP.PASSWORD_PEPPER)) {
    // A new pepper would make every existing password (admins and visitors) invalid.
    // When the spreadsheet already has administrators, the pepper must be copied from
    // the project that created them, never regenerated.
    var adminsSheet = SpreadsheetApp.openById(props.getProperty(PROP.SPREADSHEET_ID)).getSheetByName('Admins');
    if (adminsSheet && adminsSheet.getLastRow() > 1) {
      throw new Error('Missing Script Property "PASSWORD_PEPPER" while the spreadsheet already has administrators. ' +
        'Copy PASSWORD_PEPPER (and HASH_ITERATIONS) from the previous Apps Script project\'s Script properties, then run setup again.');
    }
    props.setProperty(PROP.PASSWORD_PEPPER, randomToken_());
    report.push('Generated PASSWORD_PEPPER');
  }

  var cal = auth_calibrate_();
  report.push('Password hashing: ' + cal.iterations + ' iterations (' + cal.msPerIteration + ' ms each)');

  // 2. Sheets and headers
  report = report.concat(setup_sheets_());
  DB_MEMO_ = {};

  // 3. Seed data (only into empty tables)
  report = report.concat(setup_seed_());

  // 4. Drive folders
  try { report = report.concat(setup_drive_()); } catch (e) { report.push('⚠ Drive setup failed: ' + e.message); }

  // 5. First super-administrator
  report = report.concat(setup_superAdmin_());

  // 6. Daily maintenance trigger
  report = report.concat(setup_triggers_());

  cache_bust_public_();
  // Never persist the one-time password: it appears only in the execution log.
  var safeReport = report.filter(function (line) { return line.indexOf('PASSWORD') < 0 || line.indexOf('PEPPER') >= 0; });
  audit_(SYSTEM_CTX_, 'setup', 'System', '', null, null, safeReport.join(' | ').slice(0, 2000));
  report.forEach(function (line) { console.log(line); });
  return report;
}

function setup_sheets_() {
  var out = [];
  var ss = db_ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var cols = SCHEMA[name].columns;
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); out.push('Created sheet ' + name); }
    var lastCol = sh.getLastColumn();
    var existing = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    var missing = cols.filter(function (c) { return existing.indexOf(c) < 0; });
    if (missing.length) {
      sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      sh.getRange(1, 1, 1, existing.length + missing.length).setFontWeight('bold').setBackground('#E9EDF3');
      sh.setFrozenRows(1);
      if (existing.length) out.push('Added columns to ' + name + ': ' + missing.join(', '));
    }
  });
  // Remove the default empty sheet created with new spreadsheets, if untouched.
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Foglio1') || ss.getSheetByName('Feuille 1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1 && ss.deleteSheet) { ss.deleteSheet(def); out.push('Removed empty default sheet'); }
  return out;
}

function setup_isEmpty_(name) { return db_all_(name).length === 0; }

function setup_seed_() {
  var out = [];
  if (setup_isEmpty_('Roles')) {
    db_insertMany_('Roles', authz_builtinRoles_().map(function (r) {
      return { id: r.id, name: r.name, permissions_json: JSON.stringify(r.permissions), system: r.system };
    }));
    out.push('Seeded 5 roles');
  }
  if (setup_isEmpty_('Categories')) {
    db_insertMany_('Categories', SEED_CATEGORIES.map(function (c, i) {
      var rec = { code: c.code, slug: c.slug, icon: c.icon, order: i + 1, published: true };
      APP.LANGS.forEach(function (l) { rec['title_' + l] = c['title_' + l]; rec['description_' + l] = c['description_' + l]; });
      return rec;
    }));
    out.push('Seeded 13 categories');
  }
  // Add any seed method whose code is missing (never overwrites the owner's edits).
  var methodCodes = db_all_('PaymentMethods').map(function (m) { return m.code; });
  var newMethods = SEED_PAYMENT_METHODS.filter(function (m) { return methodCodes.indexOf(m.code) < 0; });
  if (newMethods.length) {
    db_insertMany_('PaymentMethods', newMethods.map(function (m) { return Object.assign({}, m); }));
    out.push('Added payment methods: ' + newMethods.map(function (m) { return m.code; }).join(', ') +
      (newMethods.some(function (m) { return !m.active; }) ? ' (inactive: fill in the [placeholders] in Admin, then activate)' : ''));
  }
  if (setup_isEmpty_('Services')) {
    var catByCode = {};
    db_all_('Categories').forEach(function (c) { catByCode[String(c.code)] = c.id; });
    var rows = seed_serviceRows_(catByCode).filter(function (r) { return r.category_id; });
    db_insertMany_('Services', rows);
    out.push('Seeded ' + rows.length + ' services (titles and official links only; fees to be set by admins)');
  }
  if (setup_isEmpty_('GuidanceQuestions')) {
    db_insertMany_('GuidanceQuestions', seed_guideQuestionRows_());
    out.push('Seeded ' + SEED_GUIDE_QUESTIONS.length + ' guide questions');
  }
  if (setup_isEmpty_('GuidanceRules')) {
    var svcBySlug = {};
    db_all_('Services').forEach(function (s) { svcBySlug[s.slug] = s.id; });
    db_insertMany_('GuidanceRules', seed_guideRuleRows_(svcBySlug));
    out.push('Seeded ' + SEED_GUIDE_RULES.length + ' guide rules');
  }
  // Italian was removed from the platform: migrate the old language settings once.
  var dl = db_get_('Settings', 'default_lang');
  if (dl && APP.LANGS.indexOf(String(dl.value)) < 0) { db_update_('Settings', 'default_lang', { value: APP.DEFAULT_LANG, description: 'ar | fr | en' }); out.push('default_lang set to ' + APP.DEFAULT_LANG); }
  var sl = db_get_('Settings', 'supported_langs');
  if (sl && /"it"/.test(String(sl.value))) { db_update_('Settings', 'supported_langs', { value: JSON.stringify(APP.LANGS) }); out.push('supported_langs updated'); }
  var existingKeys = db_all_('Settings').map(function (s) { return s.key; });
  var newSettings = SEED_SETTINGS.filter(function (s) { return existingKeys.indexOf(s.key) < 0; });
  if (newSettings.length) {
    db_insertMany_('Settings', newSettings.map(function (s) { return Object.assign({ updated_at: nowIso_() }, s); }));
    out.push('Added ' + newSettings.length + ' settings');
  }
  return out;
}

function setup_drive_() {
  var out = [];
  var root = DriveApp.getFolderById(getProp_(PROP.DRIVE_ROOT_FOLDER_ID, true));
  if (root.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    out.push('⚠ SECURITY: the root Drive folder is shared (' + root.getSharingAccess() + '). Set it to Restricted.');
  }
  DRIVE_FOLDERS.concat([PRIVATE_UPLOADS_FOLDER_NAME]).forEach(function (name) {
    var it = root.getFoldersByName(name);
    var folder = it.hasNext() ? it.next() : null;
    if (!folder) { folder = root.createFolder(name); out.push('Created Drive folder ' + name); }
    if (name === PRIVATE_UPLOADS_FOLDER_NAME) setProp_(PROP.PRIVATE_UPLOADS_FOLDER_ID, folder.getId());
  });
  return out;
}

function setup_superAdmin_() {
  var email = String(getProp_(PROP.SUPER_ADMIN_EMAIL, false) || '').trim().toLowerCase();
  if (!email) {
    return ['⚠ No SUPER_ADMIN_EMAIL Script Property: add it (Project Settings → Script properties) and run setup again.'];
  }
  if (db_findOne_('Admins', function (a) { return String(a.email).toLowerCase() === email; })) return ['Super-admin already exists'];
  var temp = auth_tempPassword_();
  var rec = db_insert_('Admins', Object.assign({
    email: email, name: 'Super Admin', role_id: 'ROL-SUPERADMIN', active: true,
    must_change_password: true, failed_attempts: 0
  }, auth_newPasswordFields_(temp)));
  audit_(SYSTEM_CTX_, 'create', 'Admins', rec.id, null, rec, 'initial super-admin');
  return ['Created super-admin ' + email, '>>> TEMPORARY PASSWORD (shown once, change it at first login): ' + temp];
}

/** Owner-only recovery: run from the editor if the super-admin password is lost. */
function setup_resetSuperAdminPassword() {
  ownerOnly_();
  var email = String(getProp_(PROP.SUPER_ADMIN_EMAIL, true)).trim().toLowerCase();
  var admin = db_findOne_('Admins', function (a) { return String(a.email).toLowerCase() === email; });
  if (!admin) throw new Error('Super-admin not found; run setup().');
  var temp = auth_tempPassword_();
  db_update_('Admins', admin.id, Object.assign({ must_change_password: true, failed_attempts: 0, locked_until: '', active: true }, auth_newPasswordFields_(temp)));
  auth_revokeAll_('admin', admin.id);
  audit_(SYSTEM_CTX_, 'password_reset', 'Admins', admin.id, null, null, 'owner reset from editor');
  console.log('>>> TEMPORARY PASSWORD (shown once): ' + temp);
}

/**
 * setup, setup_resetSuperAdminPassword and maintenance_daily are global so the owner can run
 * them from the Apps Script editor (and the daily trigger can call maintenance_daily). Apps Script
 * also lets ANY visitor's browser call global functions through google.script.run, so each of them
 * starts here: only the owner's own account (editor) or the project's real trigger may continue.
 * Anonymous visitors have no active-user email, and a trigger id cannot be guessed.
 */
function ownerOnly_(e) {
  if (e && e.triggerUid && typeof ScriptApp !== 'undefined') {
    var uid = String(e.triggerUid);
    if (ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === uid; })) return;
  }
  var owner = String(PropertiesService.getScriptProperties().getProperty(PROP.SUPER_ADMIN_EMAIL) || '').trim().toLowerCase();
  var me = '';
  try { me = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (x) { me = ''; }
  if (!me || (owner && me !== owner)) {
    throw new Error('FORBIDDEN: run this from the Apps Script editor, signed in with the owner account.');
  }
}

function setup_triggers_() {
  if (typeof ScriptApp === 'undefined') return [];
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'maintenance_daily'; });
  if (exists) return [];
  ScriptApp.newTrigger('maintenance_daily').timeBased().everyDays(1).atHour(3).create();
  return ['Installed daily maintenance trigger'];
}

/** Daily: purge dead sessions, flush view counts, trash expired uploads, anonymise old requests/messages. */
function maintenance_daily(e) {
  ownerOnly_(e);
  var n = auth_purgeSessions_();
  var v = views_flush_();
  var u = upload_purgeExpired_();
  var r = privacy_retention_();
  console.log('Purged sessions: ' + n + '; view counts flushed for ' + v + ' services; expired uploads trashed: ' + u +
    '; anonymised requests: ' + r.requests + ', messages: ' + r.messages);
}

var SEED_SETTINGS = [
  { key: 'site_name', value: 'HAMDI ITALIE', type: 'string', public: true, description: 'Website name' },
  { key: 'contact_phone', value: '', type: 'string', public: true, description: 'Public phone number (+39…)' },
  { key: 'contact_whatsapp', value: '', type: 'string', public: true, description: 'WhatsApp number (+39…)' },
  { key: 'contact_email', value: '', type: 'string', public: true, description: 'Public contact email' },
  { key: 'contact_address', value: '', type: 'string', public: true, description: 'Office address (cash payments)' },
  { key: 'social_links', value: '[]', type: 'json', public: true, description: '[{"label":"Facebook","url":"https://…"}]' },
  { key: 'default_lang', value: 'ar', type: 'string', public: true, description: 'ar | fr | en' },
  { key: 'admin_lang', value: 'fr', type: 'string', public: false, description: 'Language of emails sent to administrators (ar | fr | en)' },
  { key: 'supported_langs', value: '["ar","fr","en"]', type: 'json', public: true, description: 'Languages offered' },
  { key: 'currency', value: 'EUR', type: 'string', public: true, description: 'Currency' },
  { key: 'registration_enabled', value: 'TRUE', type: 'bool', public: true, description: 'Allow optional visitor accounts' },
  { key: 'upload_retention_days', value: '90', type: 'number', public: false, description: 'Days before visitor uploads are deleted' },
  { key: 'request_retention_days', value: '730', type: 'number', public: false, description: 'Days before requests are anonymised' },
  { key: 'notify_email', value: '', type: 'string', public: false, description: 'Where admin notifications are sent' },
  { key: 'brand_colors', value: '{"primary":"#244B68","secondary":"#527D91","accent":"#B8903E"}', type: 'json', public: true, description: 'Brand colours' }
];

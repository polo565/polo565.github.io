/**
 * Backend unit tests: loads every .gs file into a sandbox with in-memory
 * Apps Script fakes and exercises setup, auth, RBAC, CRUD, requests, payments.
 * Usage: node scripts/test/run-tests.js
 */
const assert = require('assert');
const { loadBackend, newExecution } = require('./load-backend');

function expectError(fn, code) {
  try { fn(); } catch (e) {
    if (code && !String(e.message).startsWith(code)) throw new Error('Expected ' + code + ' but got: ' + e.message);
    return e;
  }
  throw new Error('Expected error ' + (code || ''));
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const { ctx, g } = loadBackend();
const S = {}; // shared state between tests

test('setup creates all sheets, seeds data, folders and super-admin', () => {
  const report = ctx.setup();
  const sheets = g._ss.getSheets().map(s => s.getName());
  assert.strictEqual(sheets.length, Object.keys(ctx.SCHEMA).length);
  newExecution(ctx);
  assert.strictEqual(ctx.db_all_('Categories').length, 13);
  assert.strictEqual(ctx.db_all_('Roles').length, 5);
  assert.strictEqual(ctx.db_all_('PaymentMethods').length, 3);
  assert.deepStrictEqual(ctx.db_all_('PaymentMethods').filter(m => m.active === true).map(m => m.code).join(), 'cash_office');
  assert.ok(ctx.db_all_('Settings').length >= 14);
  const admins = ctx.db_all_('Admins');
  assert.strictEqual(admins.length, 1);
  assert.strictEqual(admins[0].email, 'owner@example.com');
  assert.ok(!JSON.stringify(admins[0]).includes('TEMPORARY'));
  const line = report.find(l => l.includes('TEMPORARY PASSWORD'));
  assert.ok(line, 'temp password reported');
  S.tempPassword = line.split(': ').pop();
  assert.strictEqual(g._root.children.length, 16);
  assert.ok(g._props.getProperty('PRIVATE_UPLOADS_FOLDER_ID'));
  assert.ok(g._props.getProperty('PASSWORD_PEPPER').length >= 40);
});

test('setup is idempotent', () => {
  newExecution(ctx);
  ctx.setup();
  newExecution(ctx);
  assert.strictEqual(ctx.db_all_('Categories').length, 13);
  assert.strictEqual(ctx.db_all_('Admins').length, 1);
  assert.strictEqual(g._root.children.length, 16);
});

test('passwords are hashed, never stored in clear', () => {
  const a = ctx.db_all_('Admins')[0];
  assert.ok(a.password_hash && a.salt && a.iterations >= 2000 && a.iterations <= 10000);
  assert.strictEqual(a.iterations, Number(g._props.getProperty('HASH_ITERATIONS')));
  assert.ok(!JSON.stringify(g._ss.sheets).includes(S.tempPassword));
});

test('setup seeds the service catalogue and the guide consistently', () => {
  newExecution(ctx);
  const services = ctx.db_all_('Services');
  assert.ok(services.length >= 130, 'services seeded: ' + services.length);
  const slugs = services.map(s => s.slug);
  assert.strictEqual(new Set(slugs).size, slugs.length, 'unique slugs');
  slugs.forEach(sl => assert.match(sl, /^[a-z0-9]+(?:-[a-z0-9]+)*$/));
  const cats = ctx.db_all_('Categories');
  cats.forEach(c => assert.ok(services.some(s => s.category_id === c.id), 'category ' + c.code + ' has services'));
  services.forEach(s => ['ar', 'fr', 'en'].forEach(l => assert.ok(s['title_' + l], s.slug + ' title_' + l)));
  assert.ok(!g._ss.getSheetByName('Services').rows[0].includes('title_it'), 'no Italian columns on a fresh install');
  services.forEach(s => assert.strictEqual(s.official_fee_verified, false));
  assert.strictEqual(services.filter(s => s.popular === true).length, 7);
  const rules = ctx.db_all_('GuidanceRules');
  assert.strictEqual(ctx.db_all_('GuidanceQuestions').length, 10);
  rules.forEach(r => assert.ok(r.service_id, 'rule ' + r.task_key + ' links to a service'));
  const keys = ctx.db_all_('GuidanceQuestions').map(q => q.key);
  rules.forEach(r => { const c = JSON.parse(r.condition_json); (c.all || c.any).forEach(x => assert.ok(keys.includes(x.q), r.task_key + ' uses unknown question ' + x.q)); });
});

test('catalog, guide, category and service pages', () => {
  newExecution(ctx);
  const cat = ctx.api_getCatalog();
  assert.strictEqual(cat.categories.length, 13);
  assert.ok(cat.categories[0].services.length >= 10);
  const g = ctx.api_getGuide();
  assert.strictEqual(g.questions.length, 10);
  assert.strictEqual(g.questions[1].options.length, 5);
  assert.ok(g.rules.every(r => r.service_slug && r.condition));
  const c = ctx.api_getCategory('immigrazione');
  assert.strictEqual(c.services.length, 15);
  const sp = ctx.api_getService('codice-fiscale');
  assert.strictEqual(sp.service.official_links[0].url, 'https://www.agenziaentrate.gov.it');
  assert.strictEqual(sp.price.amount_due, 0);
  expectError(() => ctx.api_getCategory('../etc'), 'VALIDATION');
});

test('service views are counted in cache and flushed to the sheet', () => {
  newExecution(ctx);
  ctx.views_flush_(); // counts from earlier tests
  ctx.api_getService('spid'); ctx.api_getService('spid'); ctx.api_getService('isee');
  assert.strictEqual(ctx.views_flush_(), 2);
  newExecution(ctx);
  assert.strictEqual(ctx.db_findOne_('Services', s => s.slug === 'spid').view_count, 2);
  assert.strictEqual(ctx.views_flush_(), 0);
});

test('home serves DB content after setup', () => {
  newExecution(ctx);
  const h = ctx.api_getHome();
  assert.strictEqual(h.source, 'db');
  assert.strictEqual(h.categories.length, 13);
  assert.strictEqual(h.contactEnabled, true);
  assert.strictEqual(h.cashAvailable, true);
  assert.ok(!('notify_email' in h.site));
});

test('admin login: wrong password rejected with generic error', () => {
  expectError(() => ctx.api_admin_login('owner@example.com', 'wrong-password'), 'AUTH');
  expectError(() => ctx.api_admin_login('nobody@example.com', 'x'), 'AUTH');
});

test('admin login with temp password requires a password change', () => {
  newExecution(ctx);
  const r = ctx.api_admin_login('OWNER@example.com ', S.tempPassword);
  assert.ok(r.token.length > 30);
  assert.strictEqual(r.admin.must_change_password, true);
  S.token = r.token;
  expectError(() => ctx.api_admin_getDashboard(S.token), 'PASSWORD_CHANGE_REQUIRED');
  expectError(() => ctx.api_admin_changePassword(S.token, S.tempPassword, 'short'), 'WEAK_PASSWORD');
  const p = ctx.api_admin_changePassword(S.token, S.tempPassword, 'A-much-better-password-2026');
  assert.strictEqual(p.must_change_password, false);
  const d = ctx.api_admin_getDashboard(S.token);
  assert.strictEqual(d.stats.categories, 13);
});

test('session token is stored only as a hash', () => {
  const ids = ctx.db_all_('Sessions').map(s => s.id);
  assert.ok(!ids.includes(S.token));
  assert.ok(ids.includes(ctx.sha256Hex_(S.token)));
});

test('invalid or missing tokens are rejected on admin APIs', () => {
  expectError(() => ctx.api_admin_getDashboard('x'.repeat(43)), 'SESSION_EXPIRED');
  expectError(() => ctx.api_admin_list(undefined, 'services', {}), 'SESSION_EXPIRED');
  expectError(() => ctx.api_admin_save('', 'categories', null, {}), 'SESSION_EXPIRED');
});

test('account locks after 5 failed logins', () => {
  newExecution(ctx);
  const r = ctx.api_admin_saveAdmin(S.token, null, { email: 'reader@example.com', name: 'Reader', role_id: 'ROL-READONLY' });
  assert.ok(r.temporaryPassword);
  S.readerTemp = r.temporaryPassword; S.readerId = r.admin.id;
  for (let i = 0; i < 5; i++) expectError(() => ctx.api_admin_login('reader@example.com', 'bad'), 'AUTH');
  expectError(() => ctx.api_admin_login('reader@example.com', S.readerTemp), 'LOCKED');
  // Super-admin unlocks by resetting the password.
  S.readerTemp = ctx.api_admin_resetAdminPassword(S.token, S.readerId).temporaryPassword;
  const login = ctx.api_admin_login('reader@example.com', S.readerTemp);
  ctx.api_admin_changePassword(login.token, S.readerTemp, 'Reader-password-123456');
  S.readerToken = login.token;
});

test('RBAC: read-only role can read but not write; cannot touch admins', () => {
  newExecution(ctx);
  assert.strictEqual(ctx.api_admin_list(S.readerToken, 'categories', {}).total, 13);
  expectError(() => ctx.api_admin_save(S.readerToken, 'cities', null, { name: 'Roma', active: true }), 'FORBIDDEN');
  expectError(() => ctx.api_admin_listAdmins(S.readerToken), 'FORBIDDEN');
  assert.ok(ctx.api_admin_getDashboard(S.readerToken).stats);
  expectError(() => ctx.api_admin_list(S.readerToken, 'audit', {}), 'FORBIDDEN');
  expectError(() => ctx.api_admin_delete(S.readerToken, 'categories', S.catId || 'CAT-X'), 'FORBIDDEN');
});

test('cannot remove the last super-admin', () => {
  const me = ctx.api_admin_me(S.token);
  expectError(() => ctx.api_admin_saveAdmin(S.token, me.id, { name: 'X', role_id: 'ROL-READONLY', active: true }), 'FORBIDDEN');
});

test('validation: bad slug, http link, missing title are rejected', () => {
  const cat = ctx.db_all_('Categories')[0];
  S.catId = cat.id;
  const base = { category_id: cat.id, slug: 'rinnovo-permesso', title_it: 'Rinnovo permesso di soggiorno', published: true, requestable: true };
  expectError(() => ctx.api_admin_save(S.token, 'services', null, Object.assign({}, base, { slug: 'Bad Slug!' })), 'VALIDATION');
  expectError(() => ctx.api_admin_save(S.token, 'services', null, Object.assign({}, base, { official_links_json: '[{"label":"x","url":"http://insecure"}]' })), 'VALIDATION');
  expectError(() => ctx.api_admin_save(S.token, 'services', null, Object.assign({}, base, { title_it: '' })), 'VALIDATION');
  expectError(() => ctx.api_admin_save(S.token, 'services', null, Object.assign({}, base, { category_id: 'CAT-ZZZZZZZZZZ' })), 'VALIDATION');
});

test('services CRUD, unique slug, audit log and cache invalidation', () => {
  newExecution(ctx);
  const before = ctx.api_getHome();
  const svc = ctx.api_admin_save(S.token, 'services', null, {
    category_id: S.catId, slug: 'rinnovo-permesso', title_it: 'Rinnovo permesso di soggiorno', title_ar: 'تجديد تصريح الإقامة',
    service_price: 40, assistance_fee: 10, official_fee_amount: 70.46, official_fee_verified: false, provider_fee: 2,
    official_links_json: '[{"label":"Portale","url":"https://www.portaleimmigrazione.it"}]',
    published: true, requestable: true, popular: true, mark_verified: true
  });
  S.svcId = svc.id;
  assert.ok(svc.verified_by);
  expectError(() => ctx.api_admin_save(S.token, 'services', null, { category_id: S.catId, slug: 'rinnovo-permesso', title_it: 'Dup' }), 'VALIDATION');
  newExecution(ctx);
  const after = ctx.api_getHome();
  assert.strictEqual(after.popular.length, before.popular.length + 1, 'cache busted after save');
  assert.ok(ctx.db_all_('AuditLogs').some(l => l.action === 'create' && l.entity === 'Services' && l.entity_id === svc.id));
});

test('public service page: separated price, unverified official fee hidden', () => {
  newExecution(ctx);
  const p = ctx.api_getService('rinnovo-permesso');
  assert.strictEqual(p.price.hamdi_fee, 50);
  assert.strictEqual(p.price.provider_fee, 0, 'no provider fee for cash');
  assert.strictEqual(p.price.amount_due, 50);
  assert.strictEqual(p.price.official_fee, null, 'unverified official fee not shown');
  assert.strictEqual(p.paymentMethods[0].cash, true);
  assert.strictEqual(p.paymentMethods[0].requires_bank_account, false);
  assert.ok(!('verified_by' in p.service));
  expectError(() => ctx.api_getService('does-not-exist'), 'NOT_FOUND');
  assert.ok(ctx.api_search('rinnovo').services.some(x => x.slug === 'rinnovo-permesso'));
  assert.ok(ctx.api_search('تجديد').services.some(x => x.slug === 'rinnovo-permesso'));
  assert.ok(ctx.api_search('codice FISCALE').services.some(x => x.slug === 'codice-fiscale'));
  assert.strictEqual(ctx.api_search('x').services.length, 0);
});

test('formula injection is neutralised in stored text', () => {
  newExecution(ctx);
  const r = ctx.api_submitContact({ name: '=HYPERLINK("http://evil","x")', phone: '333 123 4567', message: '+cmd|calc', consent: true });
  assert.ok(r.ok);
  newExecution(ctx);
  const c = ctx.db_get_('ContactRequests', r.id);
  assert.strictEqual(c.name, '=HYPERLINK("http://evil","x")'); // stored as literal text
  assert.strictEqual(c.phone, '+393331234567');
  expectError(() => ctx.api_submitContact({ name: 'A', message: 'hi', consent: true }), 'VALIDATION');
  expectError(() => ctx.api_submitContact({ name: 'A', phone: '3331234567', message: 'hi' }), 'VALIDATION');
});

test('guest request: reference + one-time code; cash never auto-paid', () => {
  newExecution(ctx);
  const r = ctx.api_submitRequest({ service_id: S.svcId, name: 'Amina', phone: '+39 333 000 1111', email: 'amina@example.com', message: 'Aiuto', consent: true, preferred_lang: 'ar' });
  assert.match(r.reference, /^HI-\d{4}-000001$/);
  assert.strictEqual(r.trackingCode.length, 8);
  assert.strictEqual(r.payment.status, 'AWAITING_CASH_PAYMENT');
  assert.strictEqual(r.payment.amount_due, 50);
  assert.strictEqual(r.payment.method.cash, true);
  S.ref = r.reference; S.code = r.trackingCode;
  newExecution(ctx);
  const appt = ctx.db_findOne_('Appointments', a => a.reference === S.ref);
  assert.ok(!JSON.stringify(appt).includes(S.code), 'tracking code not stored in clear');
  assert.strictEqual(appt.request_type, 'assistance');
  assert.ok(g._mails.some(m => m.to === 'amina@example.com' && /ليس موعداً رسمياً/.test(m.body)));
  S.apptId = appt.id;
  S.paymentId = ctx.db_findOne_('Payments', p => p.appointment_id === appt.id).id;
});

test('tracking requires the right code; no private data exposed', () => {
  newExecution(ctx);
  expectError(() => ctx.api_trackRequest(S.ref, 'WRONG123'), 'NOT_FOUND');
  expectError(() => ctx.api_trackRequest('HI-2026-999999', S.code), 'NOT_FOUND');
  const v = ctx.api_trackRequest(S.ref.toLowerCase(), S.code.toLowerCase());
  assert.strictEqual(v.status, 'pending');
  const json = JSON.stringify(v);
  ['internal_notes', 'phone', 'email', 'Amina', 'tracking_code_hash'].forEach(k => assert.ok(!json.includes(k), 'leaks ' + k));
  assert.ok(!('official_confirmation_ref' in v));
});

test('tracking lookups are rate limited', () => {
  for (let i = 0; i < 8; i++) { try { ctx.api_trackRequest(S.ref, 'BAD00000'); } catch (e) {} }
  expectError(() => ctx.api_trackRequest(S.ref, S.code), 'RATE_LIMITED');
  g._cache._store.clear();
});

test('official_confirmed requires an external confirmation reference', () => {
  newExecution(ctx);
  expectError(() => ctx.api_admin_updateRequest(S.token, S.apptId, { request_type: 'official_confirmed' }), 'VALIDATION');
  const u = ctx.api_admin_updateRequest(S.token, S.apptId, { status: 'approved', request_type: 'official_confirmed', official_confirmation_ref: 'QUESTURA-PRENOT-123', note: 'Chiamata la Questura' });
  assert.strictEqual(u.status, 'approved');
  newExecution(ctx);
  const v = ctx.api_trackRequest(S.ref, S.code);
  assert.strictEqual(v.official_confirmation_ref, 'QUESTURA-PRENOT-123');
  assert.ok(!JSON.stringify(v).includes('Chiamata'), 'internal note hidden');
  const list = ctx.api_admin_listRequests(S.token, { q: 'amina' });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].internal_notes.length, 1);
  assert.ok(!('tracking_code_hash' in list[0]));
});

test('payments: only admin receipts reach PAID; partial, then full, then refund', () => {
  newExecution(ctx);
  expectError(() => ctx.api_admin_setPaymentStatus(S.token, S.paymentId, 'PAID'), 'VALIDATION');
  expectError(() => ctx.api_admin_recordPayment(S.readerToken, S.paymentId, { amount: 50, payment_date: '2026-11-16', receipt_ref: 'R-1' }), 'FORBIDDEN');
  expectError(() => ctx.api_admin_recordPayment(S.token, S.paymentId, { amount: 20, payment_date: '2026-11-16' }), 'VALIDATION');
  let p = ctx.api_admin_recordPayment(S.token, S.paymentId, { amount: 20, payment_date: '2026-11-16', receipt_ref: 'RIC-001' });
  assert.strictEqual(p.status, 'PARTIALLY_PAID');
  p = ctx.api_admin_recordPayment(S.token, S.paymentId, { amount: 30, payment_date: '2026-11-16', receipt_ref: 'RIC-002' });
  assert.strictEqual(p.status, 'PAID');
  assert.strictEqual(p.amount_received, 50);
  assert.ok(p.confirmed_by);
  newExecution(ctx);
  assert.strictEqual(ctx.db_get_('Appointments', S.apptId).payment_status, 'PAID');
  const rep = ctx.api_admin_paymentReport(S.token, '2026-11-01', '2026-11-30');
  assert.strictEqual(rep.received, 50); assert.strictEqual(rep.cash, 50); assert.strictEqual(rep.pending, 0);
  expectError(() => ctx.api_admin_refundPayment(S.token, S.paymentId, { amount: 60, refund_date: '2026-11-17', reason: 'x' }), 'VALIDATION');
  expectError(() => ctx.api_admin_setPaymentStatus(S.token, S.paymentId, 'UNPAID'), 'INVALID_STATE');
  expectError(() => ctx.api_admin_setPaymentStatus(S.token, S.paymentId, 'CANCELLED'), 'INVALID_STATE');
  p = ctx.api_admin_refundPayment(S.token, S.paymentId, { amount: 50, refund_date: '2026-11-17', reason: 'Servizio annullato' });
  assert.strictEqual(p.status, 'REFUNDED');
  const logs = ctx.db_all_('AuditLogs').filter(l => l.entity === 'Payments');
  assert.strictEqual(logs.length, 3);
});

test('visitor accounts: phone-only registration, login, own requests, deletion', () => {
  newExecution(ctx);
  expectError(() => ctx.api_visitorRegister({ phone: '3330002222', name: 'Omar', password: '1234567', consent: true }), 'WEAK_PASSWORD');
  const r = ctx.api_visitorRegister({ phone: '333 000 2222', name: 'Omar', password: 'omar-pass-1', consent: true });
  assert.strictEqual(r.visitor.phone, '+393330002222');
  assert.strictEqual(r.visitor.email, '');
  expectError(() => ctx.api_visitorRegister({ phone: '+393330002222', name: 'X', password: 'another-pass', consent: true }), 'CONFLICT');
  newExecution(ctx);
  const l = ctx.api_visitorLogin('0039 333 000 2222', 'omar-pass-1');
  const req = ctx.api_submitRequest({ service_id: S.svcId, name: 'Omar', message: 'x', consent: true }, l.token);
  newExecution(ctx);
  const mine = ctx.api_visitorRequests(l.token);
  assert.strictEqual(mine.length, 1);
  assert.strictEqual(mine[0].reference, req.reference);
  expectError(() => ctx.api_admin_getDashboard(l.token), 'SESSION_EXPIRED'); // visitor token is not an admin token
  ctx.api_visitorDeleteAccount(l.token, 'omar-pass-1');
  newExecution(ctx);
  expectError(() => ctx.api_visitorMe(l.token), 'SESSION_EXPIRED');
  expectError(() => ctx.api_visitorLogin('3330002222', 'omar-pass-1'), 'AUTH');
});

test('sessions expire after the idle timeout', () => {
  newExecution(ctx);
  const l = ctx.api_admin_login('owner@example.com', 'A-much-better-password-2026');
  ctx.api_admin_me(l.token);
  const id = ctx.sha256Hex_(l.token);
  ctx.db_update_('Sessions', id, { last_seen_at: new Date(Date.now() - 31 * 60000).toISOString() });
  g._cache._store.clear();
  newExecution(ctx);
  expectError(() => ctx.api_admin_me(l.token), 'SESSION_EXPIRED');
  ctx.api_admin_logout(S.token);
  newExecution(ctx);
  g._cache._store.clear();
  expectError(() => ctx.api_admin_me(S.token), 'SESSION_EXPIRED');
});

test('dashboard is cached and the translation report counts missing languages', () => {
  newExecution(ctx);
  g._cache._store.clear();
  const l = ctx.api_admin_login('owner@example.com', 'A-much-better-password-2026');
  const d1 = ctx.api_admin_getDashboard(l.token);
  assert.ok(g._cache.get('dash:v1'));
  assert.strictEqual(JSON.stringify(ctx.api_admin_getDashboard(l.token).stats), JSON.stringify(d1.stats));
  const r = ctx.api_admin_translationReport(l.token);
  const svc = r.entities.find(e => e.entity === 'services');
  assert.ok(svc.total >= 130);
  assert.ok(svc.missing.en.length >= 1, 'service created in tests has only it/ar titles');
  expectError(() => ctx.api_admin_translationReport('x'.repeat(43)), 'SESSION_EXPIRED');
});

test('PostePay / PayPal.me are seeded inactive, hidden, and cannot be activated with placeholders', () => {
  newExecution(ctx);
  const l = ctx.api_admin_login('owner@example.com', 'A-much-better-password-2026');
  const pp = ctx.db_findOne_('PaymentMethods', m => m.code === 'postepay');
  assert.strictEqual(pp.type, 'cash_network');
  assert.ok(ctx.api_getService('isee').paymentMethods.every(m => m.code === 'cash_office'), 'inactive methods hidden from visitors');
  expectError(() => ctx.api_admin_save(l.token, 'payment_methods', pp.id, Object.assign({}, pp, { active: true })), 'VALIDATION');
  const filled = Object.assign({}, pp, { active: true });
  ['ar', 'fr', 'en'].forEach(lg => { filled['instructions_' + lg] = filled['instructions_' + lg].replace('[NOME INTESTATARIO]', 'Mario Rossi').replace('[NUMERO CARTA]', '0000'); });
  const saved = ctx.api_admin_save(l.token, 'payment_methods', pp.id, filled);
  assert.strictEqual(saved.active, true);
  assert.strictEqual(saved.requires_bank_account, false);
  newExecution(ctx);
  const methods = ctx.api_getService('isee').paymentMethods;
  assert.ok(methods.some(m => m.code === 'postepay' && m.cash === true && m.requires_bank_account === false));
  // setup is idempotent and does not overwrite the owner's edits
  ctx.setup(); newExecution(ctx);
  assert.strictEqual(ctx.db_all_('PaymentMethods').length, 3);
  assert.ok(!/NUMERO CARTA/.test(ctx.db_findOne_('PaymentMethods', m => m.code === 'postepay').instructions_fr));
});

test('Italian removed: ar/fr/en only, a title in any one language is enough', () => {
  newExecution(ctx);
  assert.strictEqual(ctx.APP.LANGS.join(), 'ar,fr,en');
  assert.strictEqual(ctx.APP.DEFAULT_LANG, 'ar');
  const l = ctx.api_admin_login('owner@example.com', 'A-much-better-password-2026');
  const cat = ctx.db_all_('Categories')[0];
  const base = { category_id: cat.id, published: true, requestable: true, currency: 'EUR' };
  const e = expectError(() => ctx.api_admin_save(l.token, 'services', null, Object.assign({ slug: 'only-it', title_it: 'Solo italiano' }, base)), 'VALIDATION');
  assert.ok(/at least one language/.test(e.message));
  const ok = ctx.api_admin_save(l.token, 'services', null, Object.assign({ slug: 'only-fr', title_fr: 'Seulement en français' }, base));
  assert.strictEqual(ok.title_fr, 'Seulement en français');
  const lang = expectError(() => ctx.api_visitorRegister({ phone: '3339990000', name: 'X', password: 'password-123', consent: true, preferred_lang: 'it' }), 'VALIDATION');
  assert.ok(/preferred_lang/.test(lang.message));
  // Old settings are migrated by setup
  ctx.db_update_('Settings', 'default_lang', { value: 'it' });
  ctx.db_update_('Settings', 'supported_langs', { value: '["ar","it","fr","en"]' });
  ctx.setup(); newExecution(ctx);
  assert.strictEqual(ctx.db_get_('Settings', 'default_lang').value, 'ar');
  assert.strictEqual(ctx.db_get_('Settings', 'supported_langs').value, '["ar","fr","en"]');
  // Emails: no Italian text
  assert.ok(g._mails.every(m => !/Richiesta|Abbiamo|servizio indipendente/.test(m.subject + m.body)));
});

/* ---- Phase 7: Google Drive ------------------------------------------------------------- */
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 32)]).toString('base64');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(100)]).toString('base64');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]).toString('base64');
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.alloc(100)]).toString('base64');

test('documents: upload to the category folder, private until published + public', () => {
  newExecution(ctx);
  const l = ctx.api_admin_login('owner@example.com', 'A-much-better-password-2026');
  S.adminTok = l.token;
  const cat = ctx.db_findOne_('Categories', c => c.code === '01');
  expectError(() => ctx.api_admin_uploadDocument(l.token, { title_fr: 'Virus' }, { name: 'virus.pdf', base64: EXE }), 'VALIDATION');
  expectError(() => ctx.api_admin_uploadDocument(l.token, { title_fr: 'x' }, { name: 'a.zip', base64: DOCX }), 'VALIDATION');
  expectError(() => ctx.api_admin_uploadDocument(l.token, {}, { name: 'a.pdf', base64: PDF }), 'VALIDATION'); // title needed
  const doc = ctx.api_admin_uploadDocument(l.token, { title_fr: 'Formulaire', category_id: cat.id, visibility: 'public', published: false }, { name: '../../etc/Form "1".pdf', base64: PDF });
  S.docId = doc.id;
  assert.strictEqual(doc.mime, 'application/pdf');
  assert.ok(!/[\/"]/.test(doc.file_name), 'file name sanitised: ' + doc.file_name);
  const file = g._files[doc.drive_file_id];
  assert.strictEqual(file.folder.name, '01_IMMIGRATION');
  assert.strictEqual(file.sharing, 'PRIVATE', 'not shared while unpublished');
  newExecution(ctx);
  assert.strictEqual(ctx.api_getCategory(cat.slug).documents.length, 0);
  // Publish through the generic metadata editor → shared with link, visible to visitors
  const rec = ctx.db_get_('Documents', doc.id);
  ctx.api_admin_save(l.token, 'documents', doc.id, Object.assign({}, rec, { published: true }));
  assert.strictEqual(g._files[doc.drive_file_id].sharing, 'ANYONE_WITH_LINK');
  newExecution(ctx);
  assert.strictEqual(ctx.api_getCategory(cat.slug).documents.length, 1);
  // Admin-only visibility → private again
  ctx.api_admin_save(l.token, 'documents', doc.id, Object.assign({}, ctx.db_get_('Documents', doc.id), { visibility: 'admin' }));
  assert.strictEqual(g._files[doc.drive_file_id].sharing, 'PRIVATE');
  const docx = ctx.api_admin_uploadDocument(l.token, { title_en: 'Word form' }, { name: 'modulo.docx', base64: DOCX });
  assert.ok(/wordprocessingml/.test(docx.mime));
  assert.strictEqual(g._files[docx.drive_file_id].folder.name, '14_GENERAL_MEDIA');
});

test('documents: replace keeps the id and trashes the old file; delete moves to trash', () => {
  newExecution(ctx);
  const before = ctx.db_get_('Documents', S.docId);
  const after = ctx.api_admin_replaceDocument(S.adminTok, S.docId, { name: 'v2.pdf', base64: PDF });
  assert.strictEqual(after.id, S.docId);
  assert.notStrictEqual(after.drive_file_id, before.drive_file_id);
  assert.strictEqual(g._files[before.drive_file_id].trashed, true);
  const dl = ctx.api_admin_downloadDocument(S.adminTok, S.docId);
  assert.ok(Buffer.from(dl.base64, 'base64').toString().startsWith('%PDF'));
  expectError(() => ctx.api_admin_deleteDocument(S.readerToken, S.docId), 'FORBIDDEN');
  ctx.api_admin_deleteDocument(S.adminTok, S.docId);
  assert.strictEqual(g._files[after.drive_file_id].trashed, true);
  assert.strictEqual(ctx.db_get_('Documents', S.docId), null);
});

test('category image: shown only when the image document is published and public', () => {
  newExecution(ctx);
  const img = ctx.api_admin_uploadDocument(S.adminTok, { title_fr: 'Image', visibility: 'public', published: true }, { name: 'photo.png', base64: PNG });
  const cat = ctx.db_findOne_('Categories', c => c.code === '02');
  ctx.api_admin_save(S.adminTok, 'categories', cat.id, Object.assign({}, cat, { image_document_id: img.id }));
  newExecution(ctx);
  const c = ctx.api_getCatalog().categories.find(x => x.id === cat.id);
  assert.ok(/drive\.google\.com\/thumbnail\?id=/.test(c.image_url));
  assert.ok(!('image_document_id' in c));
  expectError(() => ctx.api_admin_deleteDocument(S.adminTok, img.id), 'IN_USE');
});

test('visitor uploads: private folder, never shared, checked before the request is created', () => {
  newExecution(ctx);
  const svc = ctx.db_findOne_('Services', s => s.slug === 'codice-fiscale');
  const countBefore = ctx.db_all_('Appointments').length;
  expectError(() => ctx.api_submitRequest({ service_id: svc.id, name: 'A', phone: '3335550001', consent: true, files: [{ name: 'x.pdf', base64: EXE }] }), 'VALIDATION');
  expectError(() => ctx.api_submitRequest({ service_id: svc.id, name: 'A', phone: '3335550001', consent: true, files: [1, 2, 3, 4].map(() => ({ name: 'a.pdf', base64: PDF })) }), 'VALIDATION');
  assert.strictEqual(ctx.db_all_('Appointments').length, countBefore, 'no half-created request');
  const r = ctx.api_submitRequest({ service_id: svc.id, name: 'A', phone: '3335550001', consent: true, files: [{ name: 'passaporto.pdf', base64: PDF }, { name: 'foto.png', base64: PNG }] });
  newExecution(ctx);
  const appt = ctx.db_findOne_('Appointments', a => a.reference === r.reference);
  const att = JSON.parse(appt.attachments_json);
  assert.strictEqual(att.length, 2);
  att.forEach(a => {
    const file = g._files[a.file_id];
    assert.strictEqual(file.sharing, 'PRIVATE');
    assert.strictEqual(file.folder.parent.name, '99_PRIVATE_UPLOADS');
    assert.ok(file.name.startsWith(r.reference));
  });
  assert.ok(!JSON.stringify(ctx.api_trackRequest(r.reference, r.trackingCode)).includes(att[0].file_id), 'visitor view does not expose file ids');
  const got = ctx.api_admin_getAttachment(S.adminTok, appt.id, att[0].file_id);
  assert.strictEqual(got.mime, 'application/pdf');
  expectError(() => ctx.api_admin_getAttachment(S.adminTok, appt.id, 'FILE-999'), 'NOT_FOUND');
  // Retention: expired uploads are trashed by the daily job
  ctx.db_update_('Appointments', appt.id, { retention_until: new Date(Date.now() - 1000).toISOString() });
  newExecution(ctx);
  assert.strictEqual(ctx.upload_purgeExpired_(), 2);
  att.forEach(a => assert.strictEqual(g._files[a.file_id].trashed, true));
  assert.strictEqual(ctx.db_get_('Appointments', appt.id).attachments_json, '[]');
});

test('Drive status lists folders and flags a shared root', () => {
  newExecution(ctx);
  const st = ctx.api_admin_driveStatus(S.adminTok);
  assert.strictEqual(st.rootPrivate, true);
  assert.ok(st.folders.length >= 16);
  assert.ok(st.folders.some(f => f.name === '99_PRIVATE_UPLOADS' && f.private));
  g._root.sharing = 'ANYONE_WITH_LINK';
  assert.strictEqual(ctx.api_admin_driveStatus(S.adminTok).rootPrivate, false);
  g._root.sharing = 'PRIVATE';
});

test('internal errors are hidden from the client', () => {
  newExecution(ctx);
  const e = expectError(() => ctx.handle_(() => { null.x; }), 'INTERNAL');
  assert.ok(!/null/.test(e.message));
});

/* ---- Phase 10: security & acceptance checks ------------------------------------------- */

function ownerLogin() {
  newExecution(ctx);
  g._cache._store.clear();
  return ctx.api_admin_login('owner@example.com', 'A-much-better-password-2026').token;
}

function makeAdmin(owner, email, roleId) {
  newExecution(ctx);
  const r = ctx.api_admin_saveAdmin(owner, null, { email, name: email.split('@')[0], role_id: roleId });
  newExecution(ctx);
  const l = ctx.api_admin_login(email, r.temporaryPassword);
  ctx.api_admin_changePassword(l.token, r.temporaryPassword, 'Strong-password-for-' + email);
  return l.token;
}

test('every admin API refuses a missing, forged or visitor token', () => {
  const names = Object.keys(ctx).filter(k => /^api_admin_/.test(k) && typeof ctx[k] === 'function' && k !== 'api_admin_login');
  assert.ok(names.length >= 25, 'found ' + names.length + ' admin APIs');
  newExecution(ctx);
  const visitor = ctx.api_visitorRegister({ phone: '333 000 7777', name: 'V', password: 'visitor-pass-7', consent: true }).token;
  for (const fn of names) {
    for (const tok of [undefined, '', 'x'.repeat(43), visitor]) {
      newExecution(ctx);
      let err = null;
      try { ctx[fn](tok, 'services', 'ID-1', { name: 'x' }); } catch (e) { err = e; }
      if (fn === 'api_admin_logout') continue; // logging out an unknown token is a harmless no-op
      assert.ok(err, fn + ' accepted token ' + String(tok).slice(0, 8));
      assert.match(err.message, /^SESSION_EXPIRED/, fn + ': ' + err.message);
    }
  }
});

test('each built-in role gets exactly its permissions', () => {
  const owner = ownerLogin();
  const content = makeAdmin(owner, 'content@example.com', 'ROL-CONTENT');
  const service = makeAdmin(owner, 'service@example.com', 'ROL-SERVICE');
  const admin = makeAdmin(owner, 'admin2@example.com', 'ROL-ADMIN');
  newExecution(ctx);
  // Content manager: content yes, requests/payments/admins no.
  assert.ok(ctx.api_admin_list(content, 'faqs', {}));
  expectError(() => ctx.api_admin_listRequests(content, {}), 'FORBIDDEN');
  expectError(() => ctx.api_admin_listPayments(content, {}), 'FORBIDDEN');
  expectError(() => ctx.api_admin_save(content, 'services', null, { slug: 'x-y', title_fr: 'X' }), 'FORBIDDEN');
  expectError(() => ctx.api_admin_listAdmins(content), 'FORBIDDEN');
  // Service manager: requests and payments yes, homepage/admins/roles no.
  assert.ok(Array.isArray(ctx.api_admin_listRequests(service, {})));
  assert.ok(ctx.api_admin_listPayments(service, {}));
  expectError(() => ctx.api_admin_save(service, 'homepage', null, { key: 'x' }), 'FORBIDDEN');
  expectError(() => ctx.api_admin_delete(service, 'services', 'SVC-X'), 'FORBIDDEN');
  expectError(() => ctx.api_admin_listRoles(service), 'FORBIDDEN');
  // Administrator: everything except managing administrators and roles.
  assert.ok(ctx.api_admin_listAdmins(admin));
  expectError(() => ctx.api_admin_saveAdmin(admin, null, { email: 'x@example.com', name: 'X', role_id: 'ROL-SUPERADMIN' }), 'FORBIDDEN');
  expectError(() => ctx.api_admin_saveRole(admin, null, { name: 'hacker', permissions: { admins: 'delete' } }), 'FORBIDDEN');
  S.contentToken = content; S.ownerToken = owner;
});

test('roles are configurable: a permission change takes effect at once', () => {
  newExecution(ctx);
  expectError(() => ctx.api_admin_listRequests(S.contentToken, {}), 'FORBIDDEN');
  const role = ctx.db_findOne_('Roles', r => r.id === 'ROL-CONTENT');
  const perms = JSON.parse(role.permissions_json); perms.appointments = 'read';
  ctx.api_admin_saveRole(S.ownerToken, 'ROL-CONTENT', { name: role.name, permissions: perms });
  newExecution(ctx);
  assert.ok(Array.isArray(ctx.api_admin_listRequests(S.contentToken, {})));
  expectError(() => ctx.api_admin_updateRequest(S.contentToken, S.apptId, { status: 'approved' }), 'FORBIDDEN');
  // The super_admin role itself can never be edited.
  expectError(() => ctx.api_admin_saveRole(S.ownerToken, 'ROL-SUPERADMIN', { name: 'super_admin', permissions: {} }), 'FORBIDDEN');
  const log = ctx.db_all_('AuditLogs').filter(l => l.entity === 'Roles' && l.entity_id === 'ROL-CONTENT');
  assert.ok(log.length >= 1, 'role change audited');
});

test('a visitor never sees another visitor\'s requests', () => {
  newExecution(ctx);
  const a = ctx.api_visitorRegister({ phone: '333 111 0001', name: 'A', password: 'visitor-a-pass', consent: true }).token;
  const b = ctx.api_visitorRegister({ phone: '333 111 0002', name: 'B', password: 'visitor-b-pass', consent: true }).token;
  newExecution(ctx);
  const ra = ctx.api_submitRequest({ service_id: S.svcId, name: 'A', message: 'mine', consent: true }, a);
  newExecution(ctx);
  assert.strictEqual(JSON.stringify(ctx.api_visitorRequests(b).map(r => r.reference)), '[]');
  assert.strictEqual(JSON.stringify(ctx.api_visitorRequests(a).map(r => r.reference)), JSON.stringify([ra.reference]));
  // Knowing the reference is not enough: the tracking code is required.
  expectError(() => ctx.api_trackRequest(ra.reference, ''), 'NOT_FOUND');
});

test('public pages never contain private data or secrets', () => {
  newExecution(ctx);
  g._cache._store.clear();
  const pepper = g._props.getProperty('PASSWORD_PEPPER');
  const privateFolder = g._props.getProperty('PRIVATE_UPLOADS_FOLDER_ID');
  const cat = ctx.api_getCatalog();
  const svcSlug = ctx.db_get_('Services', S.svcId).slug;
  const payloads = [ctx.api_getHome(), cat, ctx.api_getGuide(), ctx.api_search('permesso'), ctx.api_getService(svcSlug),
    ctx.api_getCategory(ctx.db_all_('Categories')[0].slug)];
  const json = JSON.stringify(payloads);
  const forbidden = ['owner@example.com', 'password', 'pepper', 'tracking_code', 'internal_notes', 'token', g._root.id];
  if (pepper) forbidden.push(pepper);
  if (privateFolder) forbidden.push(privateFolder);
  forbidden.forEach(k => assert.ok(!json.toLowerCase().includes(String(k).toLowerCase()), 'public payload contains ' + k));
  // Only settings marked public are sent.
  const privateKeys = ctx.db_all_('Settings').filter(s => !ctx.toBool_(s.public)).map(s => s.key);
  const home = payloads[0];
  privateKeys.forEach(k => assert.ok(!(home.settings && k in home.settings), 'private setting exposed: ' + k));
});

test('administrative actions are audited with who, what and when', () => {
  newExecution(ctx);
  const logs = ctx.db_all_('AuditLogs');
  ['Services', 'Payments', 'Roles', 'Admins', 'Documents'].forEach(e =>
    assert.ok(logs.some(l => l.entity === e), 'no audit entry for ' + e));
  logs.slice(-20).forEach(l => {
    assert.ok(l.at && l.action, 'audit row has time and action');
    assert.ok(l.admin_email || l.admin_id, 'audit row names the admin');
  });
  // The audit log is append-only: no delete through the generic API.
  expectError(() => ctx.api_admin_delete(S.ownerToken, 'audit', logs[0].id));
});

test('admin sessions end after 8 hours even when active', () => {
  const tok = ownerLogin();
  const id = ctx.sha256Hex_(tok);
  // Active a minute ago, but the 8-hour absolute limit (expires_at, set at login) has passed.
  ctx.db_update_('Sessions', id, { expires_at: new Date(Date.now() - 60000).toISOString(), last_seen_at: new Date().toISOString() });
  g._cache._store.clear();
  newExecution(ctx);
  expectError(() => ctx.api_admin_me(tok), 'SESSION_EXPIRED');
});

test('contact form: validated, consent required, rate limited', () => {
  newExecution(ctx);
  g._cache._store.clear();
  expectError(() => ctx.api_submitContact({ name: 'X', phone: '333', message: 'hi' }), 'VALIDATION');
  ctx.api_submitContact({ name: 'Sara', phone: '+39 333 444 5555', message: 'Domanda', consent: true });
  let limited = false;
  for (let i = 0; i < 15; i++) {
    try { ctx.api_submitContact({ name: 'Sara', phone: '+39 333 444 5555', message: 'again ' + i, consent: true }); }
    catch (e) { if (/^RATE_LIMITED/.test(e.message)) { limited = true; break; } }
  }
  assert.ok(limited, 'contact form is rate limited');
  g._cache._store.clear();
});

test('privacy: audit log never stores visitors\' personal data', () => {
  newExecution(ctx);
  const owner = ownerLogin();
  const r = ctx.api_submitRequest({ service_id: S.svcId, name: 'Karim Audit', phone: '+39 333 909 0909', email: 'karim@example.com', message: 'secret details', consent: true });
  newExecution(ctx);
  const appt = ctx.db_findOne_('Appointments', a => a.reference === r.reference);
  ctx.api_admin_updateRequest(owner, appt.id, { status: 'under_review', note: 'called Karim at home' });
  newExecution(ctx);
  const logs = JSON.stringify(ctx.db_all_('AuditLogs').filter(l => l.entity_id === appt.id));
  ['Karim', '909 0909', 'karim@example.com', 'secret details', 'called Karim'].forEach(x => assert.ok(!logs.includes(x), 'audit contains ' + x));
  assert.ok(logs.includes('under_review'), 'the change itself is still audited');
  S.karim = { id: appt.id, ref: r.reference, code: r.trackingCode };
});

test('privacy: admin anonymises a request on demand; tracking stops; role required', () => {
  newExecution(ctx);
  // Attach a file first, to check it goes to the trash.
  const pdf = Buffer.from('%PDF-1.4 karim').toString('base64');
  const withFile = ctx.api_submitRequest({ service_id: S.svcId, name: 'Karim File', phone: '+39 333 909 0910', message: 'x', consent: true, files: [{ name: 'id.pdf', base64: pdf }] });
  newExecution(ctx);
  const a2 = ctx.db_findOne_('Appointments', a => a.reference === withFile.reference);
  const fileId = JSON.parse(a2.attachments_json)[0].file_id;
  expectError(() => ctx.api_admin_anonymiseRequest(S.contentToken, a2.id), 'FORBIDDEN');
  const owner = ownerLogin();
  ctx.api_admin_anonymiseRequest(owner, a2.id);
  newExecution(ctx);
  const after = ctx.db_get_('Appointments', a2.id);
  assert.strictEqual(after.name, '[anonymised]');
  ['phone', 'email', 'message'].forEach(k => assert.strictEqual(after[k], '', k));
  assert.strictEqual(after.attachments_json, '[]');
  assert.strictEqual(after.reference, withFile.reference, 'reference kept');
  assert.strictEqual(ctx.DriveApp.getFileById(fileId).isTrashed(), true, 'attachment trashed');
  expectError(() => ctx.api_trackRequest(withFile.reference, withFile.trackingCode), 'NOT_FOUND');
  assert.ok(ctx.db_all_('AuditLogs').some(l => l.action === 'anonymise' && l.entity_id === a2.id));
});

test('privacy: daily job anonymises requests and messages past the retention period', () => {
  newExecution(ctx);
  ctx.api_submitContact({ name: 'Old Contact', phone: '+39 333 121 2121', message: 'old message', consent: true });
  g._cache._store.clear();
  newExecution(ctx);
  const msg = ctx.db_findOne_('ContactRequests', m => m.name === 'Old Contact');
  assert.ok(msg, 'contact saved');
  const longAgo = new Date(Date.now() - 800 * 86400000).toISOString();
  ctx.db_update_('ContactRequests', msg.id, { created_at: longAgo });
  ctx.db_update_('Appointments', S.karim.id, { created_at: longAgo });
  const recent = ctx.db_findOne_('Appointments', a => a.reference === S.ref);
  newExecution(ctx);
  ctx.maintenance_daily();
  newExecution(ctx);
  assert.strictEqual(ctx.db_get_('Appointments', S.karim.id).name, '[anonymised]');
  assert.strictEqual(ctx.db_get_('ContactRequests', msg.id).name, '[anonymised]');
  assert.strictEqual(ctx.db_get_('ContactRequests', msg.id).message, '');
  assert.notStrictEqual(ctx.db_get_('Appointments', recent.id).name, '[anonymised]', 'recent requests untouched');
  // A typo in the setting cannot wipe recent data (minimum 30 days).
  const st = ctx.db_findOne_('Settings', s => s.key === 'request_retention_days');
  ctx.db_update_('Settings', st.key, { value: '0' }); // Settings are keyed by `key`
  newExecution(ctx); g._cache._store.clear();
  ctx.maintenance_daily();
  newExecution(ctx);
  assert.notStrictEqual(ctx.db_get_('Appointments', recent.id).name, '[anonymised]');
  ctx.db_update_('Settings', st.key, { value: '730' });
  g._cache._store.clear();
});

test('privacy: deleting a visitor account also anonymises their requests; admin can erase', () => {
  newExecution(ctx);
  const v = ctx.api_visitorRegister({ phone: '333 555 0001', name: 'Leila', password: 'leila-pass-123', consent: true });
  newExecution(ctx);
  const r = ctx.api_submitRequest({ service_id: S.svcId, name: 'Leila', message: 'help', consent: true }, v.token);
  newExecution(ctx);
  ctx.api_visitorDeleteAccount(v.token, 'leila-pass-123');
  newExecution(ctx);
  const a = ctx.db_findOne_('Appointments', x => x.reference === r.reference);
  assert.strictEqual(a.name, '[anonymised]');
  assert.strictEqual(ctx.db_get_('Visitors', v.visitor.id).name, '[deleted]');
  // Admin erasure of another visitor, with the right permission only.
  const w = ctx.api_visitorRegister({ phone: '333 555 0002', name: 'Yusuf', password: 'yusuf-pass-123', consent: true });
  newExecution(ctx);
  ctx.api_submitRequest({ service_id: S.svcId, name: 'Yusuf', message: 'x', consent: true }, w.token);
  newExecution(ctx);
  expectError(() => ctx.api_admin_eraseVisitor(S.contentToken, w.visitor.id), 'FORBIDDEN');
  const res = ctx.api_admin_eraseVisitor(ownerLogin(), w.visitor.id);
  assert.strictEqual(res.requestsAnonymised, 1);
  newExecution(ctx);
  expectError(() => ctx.api_visitorMe(w.token), 'SESSION_EXPIRED');
  assert.ok(!JSON.stringify(ctx.db_all_('AuditLogs')).includes('Yusuf'));
});

test('owner-only functions refuse visitors calling them from the browser', () => {
  const callable = ['setup', 'setup_resetSuperAdminPassword', 'maintenance_daily'];
  const before = ctx.db_all_('Admins').map(a => a.password_hash).join();
  for (const who of ['', 'someone.else@gmail.com']) {
    g._setActiveUser(who);
    for (const fn of callable) {
      newExecution(ctx);
      expectError(() => ctx[fn]({ triggerUid: 'guessed-123' }), 'FORBIDDEN');
    }
  }
  g._setActiveUser('owner@example.com');
  newExecution(ctx);
  assert.strictEqual(ctx.db_all_('Admins').map(a => a.password_hash).join(), before, 'no password was reset');
  ctx.maintenance_daily(); // the owner (editor) may run it
  // Only api_* functions, doGet/doPost and these guarded entry points are callable from a browser.
  const fs2 = require('fs'), p2 = require('path');
  const names = [];
  (function walk(d) { for (const f of fs2.readdirSync(d)) { const q = p2.join(d, f); if (fs2.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.gs')) names.push(...(fs2.readFileSync(q, 'utf8').match(/^function ([A-Za-z0-9_]*[A-Za-z0-9])\s*\(/gm) || []).map(x => x.replace(/^function |\s*\($/g, ''))); } })(p2.resolve(__dirname, '../../apps-script'));
  const unexpected = names.filter(n => !/^api_/.test(n) && n !== 'doGet' && n !== 'doPost' && !callable.includes(n));
  assert.strictEqual(JSON.stringify(unexpected), '[]', 'browser-callable functions: ' + unexpected);
});

/* ---- Frontend helpers (escaping, links, translations) ---------------------------------- */
const fs = require('fs');
const path = require('path');
const vmod = require('vm');
const SITE = path.resolve(__dirname, '../..');
/** Source of a site script, e.g. scriptOf('assets/js/ui.js'). */
function scriptOf(file) { return fs.readFileSync(path.join(SITE, file), 'utf8'); }

test('frontend escaping: HTML is escaped and only https/tel/mailto links survive', () => {
  const ui = scriptOf('assets/js/ui.js');
  const box = { document: { querySelector: () => null, addEventListener() {}, documentElement: {} }, window: {}, console };
  vmod.createContext(box);
  const pick = name => (ui.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n}')) || [])[0];
  vmod.runInContext(pick('esc') + '\n' + pick('safeUrl'), box);
  assert.strictEqual(box.esc('<img src=x onerror=alert(1)>"\''), '&lt;img src=x onerror=alert(1)&gt;&quot;&#39;');
  ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'http://example.com', '//evil.example', 'vbscript:x'].forEach(u =>
    assert.strictEqual(box.safeUrl(u), '#', u));
  ['https://www.poliziadistato.it', 'tel:+39123', 'mailto:a@b.it'].forEach(u => assert.strictEqual(box.safeUrl(u), u));
});

test('every interface text exists in Arabic, French and English', () => {
  // Shared + visitor strings: I18N = { ar: {...}, fr: {...}, en: {...} }
  const box = { localStorage: { getItem() { return null; }, setItem() {} }, document: { documentElement: { setAttribute() {} } }, navigator: { language: 'ar' }, window: {} };
  vmod.createContext(box);
  vmod.runInContext(scriptOf('assets/js/i18n.js') + '\n' + scriptOf('assets/js/visitor/strings.js') + '\nthis.__I18N = I18N;', box);
  const I = box.__I18N;
  const keys = new Set([...Object.keys(I.ar), ...Object.keys(I.fr), ...Object.keys(I.en)]);
  const missing = [];
  keys.forEach(k => ['ar', 'fr', 'en'].forEach(l => { if (!I[l][k] || !String(I[l][k]).trim()) missing.push(l + ':' + k); }));
  assert.deepStrictEqual(missing, [], 'missing visitor/shared texts');
  // Admin labels: 'key': ['', en, fr, ar]
  const labels = scriptOf('assets/js/admin/labels.js');
  const bad = [];
  const re = /'([\w.-]+)':\s*\[\s*'([^']*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\s*\]/g;
  let m, n = 0;
  while ((m = re.exec(labels))) { n++; [3, 4, 5].forEach((i, j) => { if (!m[i].trim()) bad.push(['en', 'fr', 'ar'][j] + ':' + m[1]); }); }
  assert.ok(n > 100, 'parsed ' + n + ' admin labels');
  assert.deepStrictEqual(bad, [], 'missing admin labels');
});

/* ---- GitHub Pages API (backend/HttpApi.gs) and safe re-setup -------------------------- */
test('JSON API: only api_* functions, errors as CODE: message, no internals', () => {
  const call = body => { newExecution(ctx); const out = ctx.doPost({ postData: { contents: body } }); assert.strictEqual(out.mime, 'application/json'); return JSON.parse(out.text); };
  const cat = call(JSON.stringify({ fn: 'api_getCatalog', args: [] }));
  assert.ok(cat.ok && cat.result.categories.length === 13, 'catalog through doPost');
  ['setup', 'maintenance_daily', 'auth_changePassword_', 'db_all_', 'doPost', 'doGet', 'constructor', '__proto__', 'api_x_'].forEach(fn =>
    assert.strictEqual(call(JSON.stringify({ fn, args: [] })).error, 'NOT_FOUND: Unknown function.', fn));
  assert.strictEqual(call('not json').error, 'VALIDATION: Bad request.');
  assert.strictEqual(call('').error, 'VALIDATION: Bad request.');
  assert.strictEqual(call(JSON.stringify({ fn: 'api_getHome', args: 'x' })).error, 'VALIDATION: Bad request.');
  assert.strictEqual(call(JSON.stringify({ fn: 'api_getHome', args: [1, 2, 3, 4, 5, 6, 7, 8, 9] })).error, 'VALIDATION: Bad request.');
  assert.ok(/^SESSION_EXPIRED: /.test(call(JSON.stringify({ fn: 'api_admin_getDashboard', args: ['bad'] })).error));
  assert.strictEqual(JSON.parse(ctx.doGet().text).api, 'ok');
});

test('setup never regenerates the password pepper over existing administrators', () => {
  const before = g._props.getProperty('PASSWORD_PEPPER');
  g._props.deleteProperty('PASSWORD_PEPPER');
  g._setActiveUser('owner@example.com');
  newExecution(ctx);
  assert.ok(/PASSWORD_PEPPER/.test(expectError(() => ctx.setup()).message));
  assert.ok(!g._props.getProperty('PASSWORD_PEPPER'), 'no new pepper was written');
  g._props.setProperty('PASSWORD_PEPPER', before);
  const sid = g._props.getProperty('SPREADSHEET_ID');
  g._props.deleteProperty('SPREADSHEET_ID');
  newExecution(ctx);
  assert.ok(/SPREADSHEET_ID/.test(expectError(() => ctx.setup()).message));
  g._props.setProperty('SPREADSHEET_ID', sid);
  newExecution(ctx);
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log('  ✓ ' + t.name); }
  catch (e) { failed++; console.log('  ✗ ' + t.name + '\n      ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n      ')); }
}
console.log('\n' + (tests.length - failed) + '/' + tests.length + ' passed');
process.exit(failed ? 1 : 0);

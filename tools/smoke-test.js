#!/usr/bin/env node
/**
 * Browser test of the static site (start tools/dev-server.js first).
 *   node tools/smoke-test.js [siteUrl=http://127.0.0.1:8810] [screenshotDir]
 * Visitor: home, services, service page (deep link), back button, language switch,
 * search, guide, request + tracking. Admin: wrong password refused, login, dashboard,
 * requests list. Fails on page/console errors.
 */
const { chromium, devices } = require('playwright');
const SITE = (process.argv[2] || 'http://127.0.0.1:8810').replace(/\/$/, '');
const SHOTS = process.argv[3] || '';
const API = SITE.replace(/:\d+$/, ':8812');

let failures = 0;
function check(name, ok, info) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : ''));
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + n + '.png' }); };

  /* ---------------- Visitor (phone) ---------------- */
  const vctx = await browser.newContext(Object.assign({}, devices['Pixel 5'], { locale: 'ar' }));
  const p = await vctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // A missing public copy (data/…json → 404) is expected for new pages: the API answers instead.
  p.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errs.push(m.text()); });
  p.on('response', r => { if (r.status() === 404 && !/\/data\/.+\.json$/.test(new URL(r.url()).pathname)) errs.push('404 ' + r.url()); });
  await p.goto(SITE + '/');
  await p.waitForSelector('a[href^="#/category/"]', { timeout: 20000 });
  const cats = await p.$$eval('a[href^="#/category/"]', a => new Set(a.map(x => x.getAttribute('href'))).size);
  check('home shows the 13 categories', cats >= 13, cats + ' categories');
  check('Arabic phone → Arabic RTL page', (await p.getAttribute('html', 'dir')) === 'rtl' && (await p.getAttribute('html', 'lang')) === 'ar');
  await shot(p, 'v-home');

  await p.goto(SITE + '/#/services');
  await p.waitForTimeout(1500);
  const svcLinks = await p.$$eval('a[href^="#/service/"]', a => a.length);
  check('services index lists services', svcLinks > 100, svcLinks + ' links');

  await p.goto(SITE + '/#/service/rinnovo-del-permesso-di-soggiorno');
  await p.waitForTimeout(1500);
  check('service page renders (deep link)', /تجديد|Permesso di Soggiorno/i.test(await p.innerText('main')));
  await shot(p, 'v-service');

  await p.goto(SITE + '/');
  await p.waitForSelector('a[href^="#/category/"]');
  await p.click('a[href^="#/category/"]');
  await p.waitForTimeout(1200);
  const catHash = await p.evaluate(() => location.hash);
  await p.goBack();
  await p.waitForTimeout(1200);
  const backHash = await p.evaluate(() => location.hash);
  check('back button returns to home', catHash.startsWith('#/category/') && (backHash === '' || backHash === '#/'), catHash + ' → "' + backHash + '"');

  await p.evaluate(() => {
    const s = document.getElementById('lang');
    s.value = 'fr';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(1500);
  check('language switch to French (LTR)', (await p.getAttribute('html', 'dir')) === 'ltr' && (await p.getAttribute('html', 'lang')) === 'fr');

  const results = await p.evaluate(() => api('api_search', 'codice fiscale'));
  check('search works', JSON.stringify(results).length > 20, JSON.stringify(results).slice(0, 80));

  await p.goto(SITE + '/#/guide');
  await p.waitForTimeout(1500);
  check('new immigrant guide loads', (await p.innerText('main')).length > 100);
  await shot(p, 'v-guide');

  const receipt = await p.evaluate(async () => {
    const cat = await api('api_getCatalog');
    const svc = cat.categories[0].services[0];
    return api('api_submitRequest', { service_id: svc.id, name: 'Test Pages', phone: '3331234567', consent: true, preferred_lang: 'fr' });
  });
  check('request submitted, reference returned', /^HI-\d{4}-\d+/.test(receipt.reference || ''), receipt.reference);
  const tracked = await p.evaluate(r => api('api_trackRequest', r.reference, r.trackingCode), receipt);
  check('tracking with reference + code', !!tracked && !!tracked.status, tracked && tracked.status);
  const wrong = await p.evaluate(r => api('api_trackRequest', r.reference, 'WRONG1').then(() => 'accepted', e => e.message), receipt);
  check('tracking refuses a wrong code', wrong !== 'accepted', wrong);
  check('no console errors (visitor)', errs.length === 0, errs.join(' | ').slice(0, 300));

  /* ---------------- Admin (desktop) ---------------- */
  const creds = await (await fetch(API + '/__local/creds')).json();
  const actx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await actx.newPage();
  const aerrs = [];
  a.on('pageerror', e => aerrs.push(e.message));
  a.on('console', m => { if (m.type() === 'error') aerrs.push(m.text()); });
  await a.goto(SITE + '/admin/');
  await a.waitForSelector('input[type="password"]', { timeout: 20000 });
  const email = 'input[type="email"], input[name="email"], input[autocomplete="username"]';
  await a.fill(email, creds.email);
  await a.fill('input[type="password"]', 'wrong-password-123');
  await a.press('input[type="password"]', 'Enter');
  await a.waitForTimeout(1500);
  check('admin refuses a wrong password', !!(await a.$('input[type="password"]')));
  await a.fill(email, creds.email);
  await a.fill('input[type="password"]', creds.password);
  await a.press('input[type="password"]', 'Enter');
  await a.waitForTimeout(3000);
  check('admin dashboard after login', !(await a.$('input[type="password"]')));
  await shot(a, 'a-dashboard');
  await a.goto(SITE + '/admin/#/appointments');
  await a.waitForTimeout(2500);
  check('admin sees the test request', (await a.innerText('body')).includes(receipt.reference), receipt.reference);
  await shot(a, 'a-requests');
  check('no page errors (admin)', aerrs.filter(e => !/status of 4\d\d/.test(e)).length === 0, aerrs.join(' | ').slice(0, 300));

  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * Writes a copy of the PUBLIC content into data/*.json, so GitHub Pages can show the
 * first page at once (each page then checks the API in the background — see ui.js).
 *
 *   node tools/snapshot.js        then commit and push data/
 *
 * Copies: home, catalog, guide, every category page and every service page. Service pages
 * are read with api_getServicePage, which counts no view (statistics stay right).
 * Only public data is read (what any visitor sees). A file is rewritten only when its
 * content changed. An old copy is never wrong for long: the API answer replaces it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data');
const config = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8');
const API_URL = (config.match(/API_URL:\s*'([^']+)'/) || [])[1];
if (!API_URL) { console.error('API_URL not found in assets/js/config.js'); process.exit(1); }

async function call(fn, args = [], attempt = 1) {
  try {
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const res = await r.json();
    if (!res.ok) throw new Error(res.error);
    return res.result;
  } catch (e) {
    if (attempt >= 3 || /^NOT_FOUND/.test(e.message)) throw e;
    await new Promise(r => setTimeout(r, 2000 * attempt));
    return call(fn, args, attempt + 1);
  }
}

const written = new Set();
let changed = 0;
function save(rel, data) {
  const file = path.join(OUT, rel + '.json');
  const json = JSON.stringify(data);
  written.add(file);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === json) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json);
  changed++;
  console.log('updated data/' + rel + '.json');
}

(async () => {
  const [home, catalog, guide] = await Promise.all([call('api_getHome'), call('api_getCatalog'), call('api_getGuide')]);
  save('home', home);
  save('catalog', catalog);
  save('guide', guide);
  const slugs = catalog.categories.map(c => c.slug).filter(s => /^[a-z0-9][a-z0-9-]{0,80}$/.test(s));
  for (let i = 0; i < slugs.length; i += 4) {
    const pages = await Promise.all(slugs.slice(i, i + 4).map(s => call('api_getCategory', [s])));
    pages.forEach((p, j) => save('category/' + slugs[i + j], p));
  }
  const services = [].concat(...catalog.categories.map(c => c.services || []))
    .map(s => s.slug).filter(s => /^[a-z0-9][a-z0-9-]{0,80}$/.test(s));
  for (let i = 0; i < services.length; i += 4) {
    const pages = await Promise.all(services.slice(i, i + 4).map(s => call('api_getServicePage', [s])));
    pages.forEach((p, j) => save('service/' + services[i + j], p));
  }
  // A page that no longer exists must not be served from an old copy.
  for (const dir of ['category', 'service']) {
    const full = path.join(OUT, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      const file = path.join(full, f);
      if (!written.has(file)) { fs.unlinkSync(file); changed++; console.log('removed data/' + dir + '/' + f); }
    }
  }
  console.log(changed ? changed + ' file(s) changed' : 'snapshot unchanged');
})().catch(e => { console.error('snapshot failed: ' + e.message); process.exit(1); });

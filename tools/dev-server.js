#!/usr/bin/env node
/**
 * Local test of the GitHub Pages site against the REAL backend code, without deploying.
 *
 *   node tools/dev-server.js <path to hamdi_italia> [sitePort=8810] [apiPort=8812]
 *
 * - http://localhost:<sitePort>/      this repository, served as GitHub Pages would.
 * - http://localhost:<apiPort>/exec   the backend (*.gs from the hamdi_italia checkout +
 *   apps-script/HttpApi.gs) running in Node on the in-memory Apps Script fakes of
 *   hamdi_italia/scripts/test. Like Apps Script, POST /exec answers with a 302 to a
 *   one-time GET URL that carries Access-Control-Allow-Origin: *, so the browser does the
 *   same cross-origin requests as on the live site.
 * Data is in memory and lost on restart. The admin login is printed at start (localhost only).
 * Nothing from the backend is written into this repository.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const src = process.argv[2];
if (!src) { console.error('Usage: node tools/dev-server.js <path to hamdi_italia> [sitePort] [apiPort]'); process.exit(1); }
const SITE_PORT = Number(process.argv[3] || 8810);
const API_PORT = Number(process.argv[4] || 8812);
const ROOT = path.resolve(__dirname, '..');
const { loadBackend, newExecution } = require(path.resolve(src, 'scripts/test/load-backend.js'));

const { ctx } = loadBackend({ superAdminEmail: 'admin@example.test' });
ctx.ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput(text) { return { text, mime: 'text/plain', setMimeType(m) { this.mime = m; return this; } }; },
};
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/HttpApi.gs'), 'utf8'), ctx, { filename: 'HttpApi.gs' });
const report = ctx.setup();
newExecution(ctx);
const temp = report.find(l => l.includes('TEMPORARY PASSWORD')).split(': ').pop();
const password = 'Local-' + crypto.randomBytes(6).toString('hex');
const admin = ctx.db_all_('Admins')[0];
ctx.auth_changePassword_('Admins', 'admin', admin.id, temp, password, null);
ctx.ent_save_({ adminId: admin.id, adminEmail: 'local' }, 'cities', null, { name: 'Roma', province: 'RM', region: 'Lazio', active: true });

/* ---- API (emulates script.google.com/…/exec) ---- */
const echoes = new Map();
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__local/creds') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ email: 'admin@example.test', password }));
  }
  if (url.pathname === '/exec' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      newExecution(ctx);
      const out = ctx.doPost({ postData: { contents: body, type: req.headers['content-type'] } });
      const id = crypto.randomBytes(8).toString('hex');
      echoes.set(id, out);
      res.writeHead(302, { location: 'http://' + (req.headers.host || '127.0.0.1:' + API_PORT) + '/echo?id=' + id, 'access-control-allow-origin': '*' });
      res.end();
    });
    return;
  }
  if (url.pathname === '/echo' && req.method === 'GET' && echoes.has(url.searchParams.get('id'))) {
    const out = echoes.get(url.searchParams.get('id'));
    echoes.delete(url.searchParams.get('id'));
    res.writeHead(200, { 'content-type': out.mime, 'access-control-allow-origin': '*' });
    return res.end(out.text);
  }
  res.writeHead(404); res.end();
}).listen(API_PORT, '127.0.0.1');

/* ---- Static site (emulates GitHub Pages, with the API URL pointed at localhost) ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || file.includes(path.sep + '.git') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, '404.html'); res.statusCode = 404;
  }
  let body = fs.readFileSync(file);
  if (rel === '/assets/js/config.js') body = 'window.HAMDI_CONFIG = { API_URL: "http://127.0.0.1:' + API_PORT + '/exec" };';
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}).listen(SITE_PORT, '127.0.0.1');

console.log('Site:  http://127.0.0.1:' + SITE_PORT + '/   (admin: /admin/)');
console.log('API:   http://127.0.0.1:' + API_PORT + '/exec');
console.log('Admin: admin@example.test / ' + password);

#!/usr/bin/env node
/**
 * Updates the ?v=<hash> of every local CSS/JS link in index.html and admin/index.html,
 * so browsers load the new files right after a change (GitHub Pages caches for 10 min).
 * Run after editing anything in assets/:   node tools/stamp.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');

['index.html', 'admin/index.html'].forEach(page => {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/(href|src)="(\/assets\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g, (m, attr, rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel));
    return attr + '="' + rel + '?v=' + crypto.createHash('sha256').update(content).digest('hex').slice(0, 10) + '"';
  });
  fs.writeFileSync(file, html);
  console.log('stamped ' + page);
});

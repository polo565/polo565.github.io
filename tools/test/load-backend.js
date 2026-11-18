/**
 * Loads every apps-script/**.gs file into a Node sandbox backed by the
 * in-memory Apps Script fakes. Shared by the unit tests and the preview builder.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createGlobals } = require('./gas-fakes');

const GAS = path.resolve(__dirname, '../../apps-script');

function loadBackend(opts = {}) {
  const g = createGlobals({ spreadsheetId: 'SS-TEST' });
  const ctx = vm.createContext(Object.assign({}, g, { Date, JSON, Math, Object, Array, String, Number, RegExp, Error, isFinite }));
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.gs')) files.push(p);
    }
  })(GAS);
  // Config first (as filePushOrder does), then the order Apps Script uses.
  files.sort((a, b) => (b.includes(path.sep + 'config' + path.sep) ? 1 : 0) - (a.includes(path.sep + 'config' + path.sep) ? 1 : 0));
  for (const f of files) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.relative(GAS, f) });
  g._props.setProperty('SPREADSHEET_ID', 'SS-TEST');
  g._props.setProperty('DRIVE_ROOT_FOLDER_ID', g._root.id);
  g._props.setProperty('SUPER_ADMIN_EMAIL', opts.superAdminEmail || 'Owner@Example.com');
  // The owner runs setup from the editor: the active user is the owner.
  g._setActiveUser(String(opts.superAdminEmail || 'Owner@Example.com').toLowerCase());
  return { ctx, g };
}

/** Resets per-execution memo, like a new Apps Script execution. */
function newExecution(ctx) { vm.runInContext('DB_MEMO_ = {}; DB_SS_ = null;', ctx); }

module.exports = { loadBackend, newExecution, GAS };

/**
 * HAMDI ITALIE — data access layer. The ONLY module that touches Google Sheets.
 * Records are plain objects keyed by header name; rows are found by stable ID,
 * never by row number. Reads are memoised per execution; writes take the
 * script lock and invalidate the memo.
 */

var DB_MEMO_ = {};
var DB_SS_ = null;
var MAX_CELL_CHARS_ = 50000;

function db_ready_() {
  return !!PropertiesService.getScriptProperties().getProperty(PROP.SPREADSHEET_ID);
}

function db_ss_() {
  if (!DB_SS_) DB_SS_ = SpreadsheetApp.openById(getProp_(PROP.SPREADSHEET_ID, true));
  return DB_SS_;
}

function db_sheet_(name) {
  if (!SCHEMA[name]) throw new Error('Unknown table ' + name);
  var sh = db_ss_().getSheetByName(name);
  if (!sh) throw AppError_('NOT_INITIALISED', 'Database not initialised: run setup().');
  return sh;
}

function db_key_(name) { return SCHEMA[name].columns[0]; }

/** Converts a JS value to a safe cell value (blocks formula injection and auto-conversion). */
function db_toCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'object') v = JSON.stringify(v);
  v = String(v);
  if (v.length > MAX_CELL_CHARS_) throw AppError_('VALIDATION', 'Text too long.');
  // Leading apostrophe = literal text: no formulas, no date/number auto-parsing.
  return v === '' ? '' : "'" + v;
}

/** Reads a whole table: { headers, records, rowById }. Memoised per execution. */
function db_table_(name) {
  if (DB_MEMO_[name]) return DB_MEMO_[name];
  var sh = db_sheet_(name);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var values = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
  var key = db_key_(name), keyIdx = headers.indexOf(key);
  var records = [], rowById = {};
  values.forEach(function (row, i) {
    if (keyIdx < 0 || row[keyIdx] === '') return;
    var rec = {};
    headers.forEach(function (h, c) { if (h) rec[h] = row[c]; });
    records.push(rec);
    rowById[String(row[keyIdx])] = i + 2;
  });
  return (DB_MEMO_[name] = { headers: headers, records: records, rowById: rowById });
}

function db_invalidate_(name) { delete DB_MEMO_[name]; }

/** Returns copies so callers cannot mutate the memo. */
function db_all_(name) {
  return db_table_(name).records.map(function (r) { return Object.assign({}, r); });
}

function db_where_(name, predicate) { return db_all_(name).filter(predicate); }

function db_get_(name, id) {
  var t = db_table_(name);
  var row = t.rowById[String(id)];
  if (!row) return null;
  var key = db_key_(name);
  for (var i = 0; i < t.records.length; i++) if (String(t.records[i][key]) === String(id)) return Object.assign({}, t.records[i]);
  return null;
}

function db_findOne_(name, predicate) {
  var list = db_where_(name, predicate);
  return list.length ? list[0] : null;
}

function db_rowValues_(headers, rec) {
  return headers.map(function (h) { return db_toCell_(rec[h]); });
}

/** Inserts a record; assigns id/created_at/updated_at when the table has them. */
function db_insert_(name, record) {
  return db_withLock_(function () {
    var t = db_table_(name);
    var rec = Object.assign({}, record);
    var key = db_key_(name);
    if (!rec[key]) {
      if (!SCHEMA[name].prefix) throw new Error('Key required for ' + name);
      rec[key] = newId_(SCHEMA[name].prefix);
    }
    if (t.rowById[String(rec[key])]) throw AppError_('CONFLICT', 'Duplicate key.');
    var now = nowIso_();
    if (t.headers.indexOf('created_at') >= 0 && !rec.created_at) rec.created_at = now;
    if (t.headers.indexOf('updated_at') >= 0) rec.updated_at = now;
    var sh = db_sheet_(name);
    sh.getRange(sh.getLastRow() + 1, 1, 1, t.headers.length).setValues([db_rowValues_(t.headers, rec)]);
    db_invalidate_(name);
    return rec;
  });
}

/** Inserts many records in one write (used by setup and imports). */
function db_insertMany_(name, records) {
  if (!records.length) return [];
  return db_withLock_(function () {
    var t = db_table_(name), key = db_key_(name), now = nowIso_();
    var rows = records.map(function (r) {
      var rec = Object.assign({}, r);
      if (!rec[key]) rec[key] = newId_(SCHEMA[name].prefix);
      if (t.headers.indexOf('created_at') >= 0 && !rec.created_at) rec.created_at = now;
      if (t.headers.indexOf('updated_at') >= 0) rec.updated_at = now;
      return rec;
    });
    var sh = db_sheet_(name);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, t.headers.length)
      .setValues(rows.map(function (r) { return db_rowValues_(t.headers, r); }));
    db_invalidate_(name);
    return rows;
  });
}

/** Merges `patch` into the record with this id. Returns the updated record. */
function db_update_(name, id, patch) {
  return db_withLock_(function () {
    db_invalidate_(name); // re-read inside the lock to avoid lost updates
    var t = db_table_(name);
    var row = t.rowById[String(id)];
    if (!row) throw AppError_('NOT_FOUND', 'Record not found.');
    var current = db_get_(name, id);
    var key = db_key_(name);
    var next = Object.assign(current, patch);
    next[key] = current[key];
    if (t.headers.indexOf('updated_at') >= 0) next.updated_at = nowIso_();
    db_sheet_(name).getRange(row, 1, 1, t.headers.length).setValues([db_rowValues_(t.headers, next)]);
    db_invalidate_(name);
    return next;
  });
}

function db_delete_(name, id) {
  return db_withLock_(function () {
    db_invalidate_(name);
    var row = db_table_(name).rowById[String(id)];
    if (!row) throw AppError_('NOT_FOUND', 'Record not found.');
    db_sheet_(name).deleteRow(row);
    db_invalidate_(name);
    return true;
  });
}

var DB_LOCK_DEPTH_ = 0;
/** Runs fn under the script lock (re-entrant within one execution). */
function db_withLock_(fn) {
  if (DB_LOCK_DEPTH_ > 0) return fn();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  DB_LOCK_DEPTH_++;
  try { return fn(); } finally { DB_LOCK_DEPTH_--; lock.releaseLock(); }
}

/* ---- Settings (key/value table) ----------------------------------------- */
function settings_get_(key, fallback) {
  if (!db_ready_()) return fallback;
  var rec = db_get_('Settings', key);
  if (!rec) return fallback;
  return settings_decode_(rec);
}

function settings_decode_(rec) {
  switch (rec.type) {
    case 'number': return Number(rec.value);
    case 'bool': return toBool_(rec.value);
    case 'json': return parseJson_(rec.value, null);
    default: return rec.value === undefined ? '' : String(rec.value);
  }
}

/** Public settings only (`public = TRUE`), as a key → value map. */
function settings_public_() {
  var out = {};
  db_all_('Settings').forEach(function (r) { if (toBool_(r.public)) out[r.key] = settings_decode_(r); });
  return out;
}

/* ---- Public content cache --------------------------------------------- */
var PUBLIC_CACHE_KEYS_ = ['home:v2'];

function cache_bust_public_() {
  var c = CacheService.getScriptCache();
  var gen = Number(c.get('public:gen') || 0) + 1;
  c.put('public:gen', String(gen), 21600);
  c.removeAll(PUBLIC_CACHE_KEYS_);
}

function cache_public_key_(base) {
  return base + ':' + (CacheService.getScriptCache().get('public:gen') || '0');
}

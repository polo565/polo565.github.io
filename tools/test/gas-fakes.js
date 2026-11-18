/**
 * Minimal in-memory fakes of the Apps Script services used by the backend,
 * so the server code can be unit-tested with Node. Behaviour mirrors Apps
 * Script where it matters (signed digest bytes, leading-apostrophe text,
 * cache TTL caps, lock semantics).
 */
const crypto = require('crypto');

function toSigned(buf) { return Array.from(buf, b => (b > 127 ? b - 256 : b)); }
function toBuf(input) {
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  return Buffer.from(input.map(b => (b < 0 ? b + 256 : b)));
}

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) { Object.assign(this, { sheet, row, col, numRows, numCols }); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = [];
      for (let c = 0; c < this.numCols; c++) line.push(this.sheet._get(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.numRows || values.some(v => v.length !== this.numCols)) throw new Error('Range dimension mismatch');
    values.forEach((line, r) => line.forEach((v, c) => this.sheet._set(this.row + r, this.col + c, v)));
    return this;
  }
  setFontWeight() { return this; } setBackground() { return this; } setNumberFormat() { return this; }
}

class FakeSheet {
  constructor(name) { this.name = name; this.rows = []; this.frozen = 0; }
  getName() { return this.name; }
  _get(r, c) { const v = (this.rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; }
  _set(r, c, v) {
    while (this.rows.length < r) this.rows.push([]);
    // Apps Script: a leading apostrophe forces text and is not returned by getValues.
    if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1);
    else if (typeof v === 'string' && /^[=]/.test(v)) throw new Error('Formula written to sheet: ' + v);
    this.rows[r - 1][c - 1] = v;
  }
  getLastRow() { let n = this.rows.length; while (n > 0 && (this.rows[n - 1] || []).every(v => v === '' || v === undefined)) n--; return n; }
  getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); }
  getMaxColumns() { return Math.max(26, this.getLastColumn()); }
  getRange(row, col, numRows = 1, numCols = 1) {
    if (row < 1 || col < 1 || numRows < 1 || numCols < 1) throw new Error('Bad range ' + [row, col, numRows, numCols]);
    return new FakeRange(this, row, col, numRows, numCols);
  }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  setFrozenRows(n) { this.frozen = n; }
}

class FakeSpreadsheet {
  constructor(id) { this.id = id; this.sheets = {}; }
  getId() { return this.id; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { if (this.sheets[n]) throw new Error('exists'); return (this.sheets[n] = new FakeSheet(n)); }
  getSheets() { return Object.values(this.sheets); }
}

function makeCache() {
  const store = new Map();
  return {
    get(k) { const e = store.get(k); if (!e) return null; if (e.exp < Date.now()) { store.delete(k); return null; } return e.v; },
    getAll(keys) { const o = {}; keys.forEach(k => { const v = this.get(k); if (v !== null) o[k] = v; }); return o; },
    put(k, v, ttl = 600) {
      if (typeof v !== 'string') throw new Error('Cache value must be string');
      if (v.length > 100 * 1024) throw new Error('Cache value too large');
      store.set(k, { v, exp: Date.now() + Math.min(ttl, 21600) * 1000 });
    },
    putAll(o, ttl) { Object.keys(o).forEach(k => this.put(k, o[k], ttl)); },
    remove(k) { store.delete(k); },
    removeAll(keys) { keys.forEach(k => store.delete(k)); },
    _store: store
  };
}

function makeProps() {
  const p = {};
  return {
    getProperty: k => (k in p ? p[k] : null),
    setProperty(k, v) { p[k] = String(v); return this; },
    deleteProperty(k) { delete p[k]; return this; },
    getProperties: () => Object.assign({}, p),
    _p: p
  };
}

function createGlobals(opts = {}) {
  const ss = new FakeSpreadsheet(opts.spreadsheetId || 'SS-TEST');
  const scriptCache = makeCache();
  const scriptProps = makeProps();
  const mails = [];
  const logs = [];
  const folders = {};
  const files = {};
  let folderSeq = 0, fileSeq = 0;
  let activeUser = 'owner@example.com';
  const iter = list => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };
  function makeBlob(bytes, mime, name) {
    const b = { bytes: bytes || [], mime: mime || 'application/octet-stream', name: name || 'blob',
      getBytes: () => b.bytes.slice(), getContentType: () => b.mime, getName: () => b.name,
      setName(n) { b.name = n; return b; }, setContentType(m) { b.mime = m; return b; } };
    return b;
  }
  function makeFile(blob, folder) {
    const id = 'FILE-' + (++fileSeq);
    const file = { id, folder, name: blob.getName(), mime: blob.getContentType(), bytes: blob.getBytes(), sharing: 'PRIVATE', permission: 'NONE', trashed: false,
      getId: () => id, getName: () => file.name, setName(n) { file.name = n; return file; }, getMimeType: () => file.mime, getSize: () => file.bytes.length,
      getBlob: () => makeBlob(file.bytes, file.mime, file.name), getUrl: () => 'https://drive.google.com/file/d/' + id + '/view',
      setSharing(access, perm) { file.sharing = access; file.permission = perm; return file; }, getSharingAccess: () => file.sharing,
      setTrashed(t) { file.trashed = !!t; return file; }, isTrashed: () => file.trashed,
      getParents: () => iter([folder]) };
    files[id] = file;
    folder.files.push(file);
    return file;
  }
  function makeFolder(name, parent) {
    const id = 'FOLDER-' + (++folderSeq);
    const f = {
      id, name, parent, sharing: 'PRIVATE', children: [], files: [],
      getId: () => id, getName: () => name, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      createFolder(n) { const c = makeFolder(n, f); f.children.push(c); return c; },
      createFile(blob) { return makeFile(blob, f); },
      getFoldersByName(n) { return iter(f.children.filter(c => c.name === n)); },
      getFolders() { return iter(f.children.slice()); },
      getFiles() { return iter(f.files.filter(x => !x.trashed)); },
      getSharingAccess: () => f.sharing
    };
    folders[id] = f;
    return f;
  }
  const root = makeFolder('HAMDI_ITALIE', null);

  return {
    _ss: ss, _cache: scriptCache, _props: scriptProps, _mails: mails, _logs: logs, _root: root, _folders: folders, _files: files,
    SpreadsheetApp: {
      openById: id => { if (id !== ss.id) throw new Error('No spreadsheet ' + id); return ss; },
      flush() {}
    },
    CacheService: { getScriptCache: () => scriptCache },
    PropertiesService: { getScriptProperties: () => scriptProps },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, input) => toSigned(crypto.createHash(alg).update(toBuf(input)).digest()),
      base64Encode: input => toBuf(input).toString('base64'),
      base64EncodeWebSafe: input => toBuf(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Decode: s => toSigned(Buffer.from(s, 'base64')),
      getUuid: () => crypto.randomUUID(),
      sleep() {},
      formatDate: (d, tz, fmt) => d.toISOString(),
      newBlob: (bytes, mime, name) => makeBlob(Array.isArray(bytes) ? bytes : toSigned(Buffer.from(String(bytes), 'utf8')), mime, name)
    },
    DriveApp: {
      getFolderById: id => { if (!folders[id]) throw new Error('No folder ' + id); return folders[id]; },
      getFileById: id => { if (!files[id]) throw new Error('No file ' + id); return files[id]; },
      Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', ANYONE: 'ANYONE' },
      Permission: { VIEW: 'VIEW', NONE: 'NONE', EDIT: 'EDIT' }
    },
    MailApp: {
      getRemainingDailyQuota: () => 100 - mails.length,
      sendEmail: m => { mails.push(m); }
    },
    Session: { getScriptTimeZone: () => 'Europe/Rome', getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }), getActiveUser: () => ({ getEmail: () => activeUser }) },
    // '' = an anonymous visitor calling through google.script.run
    _setActiveUser: e => { activeUser = e; },
    Logger: { log: (...a) => logs.push(a.join(' ')) },
    console: { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) { return { text, mime: 'text/plain', setMimeType(m) { this.mime = m; return this; }, getContent() { return this.text; } }; },
    },
  };
}

module.exports = { createGlobals };

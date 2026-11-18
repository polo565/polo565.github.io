/**
 * HAMDI ITALIE — small shared helpers (private: names end with "_").
 */

/** Error shown to the client as-is. Anything else becomes a generic message. */
function AppError_(code, message) {
  var e = new Error(message || code);
  e.name = 'AppError';
  e.code = code;
  return e;
}

/** Wraps an API body: AppErrors pass through as "CODE: message"; others are logged and hidden. */
function handle_(fn) {
  try {
    return fn();
  } catch (e) {
    if (e && e.name === 'AppError') throw new Error(e.code + ': ' + e.message);
    console.error(e && e.stack ? e.stack : e);
    throw new Error('INTERNAL: An error occurred.');
  }
}

/** Value of `field` in `lang`, else in the first language that has one (APP.LANGS order). */
function pickLang_(rec, field, lang) {
  if (!rec) return '';
  if (lang && rec[field + '_' + lang]) return rec[field + '_' + lang];
  for (var i = 0; i < APP.LANGS.length; i++) if (rec[field + '_' + APP.LANGS[i]]) return rec[field + '_' + APP.LANGS[i]];
  return '';
}

function nowIso_() { return new Date().toISOString(); }

function addMinutesIso_(minutes, from) {
  var base = from ? new Date(from).getTime() : Date.now();
  return new Date(base + minutes * 60000).toISOString();
}

var ID_ALPHABET_ = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I

/** Cryptographically random string from the unambiguous alphabet. */
function randomCode_(length) {
  var bytes = randomBytes_(length);
  var out = '';
  for (var i = 0; i < length; i++) out += ID_ALPHABET_.charAt((bytes[i] + 256) % ID_ALPHABET_.length);
  return out;
}

/** Random bytes derived from UUIDv4 (Apps Script has no direct CSPRNG API). */
function randomBytes_(n) {
  var out = [];
  while (out.length < n) {
    out = out.concat(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Utilities.getUuid() + Date.now()));
  }
  return out.slice(0, n);
}

/** 256-bit random token, URL-safe. */
function randomToken_() {
  return Utilities.base64EncodeWebSafe(randomBytes_(32)).replace(/=+$/, '');
}

function newId_(prefix) { return (prefix ? prefix + '-' : '') + randomCode_(10); }

function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text))
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

/** Constant-time comparison of two strings. */
function safeEquals_(a, b) {
  a = String(a || ''); b = String(b || '');
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function parseJson_(text, fallback) {
  if (text === '' || text == null) return fallback;
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

function toBool_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1'; }

function pick_(obj, keys) {
  var out = {};
  keys.forEach(function (k) { if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; });
  return out;
}

/** Sequential, human-readable reference, e.g. HI-2026-000125. Must run inside a lock. */
function nextSequence_(name) {
  var props = PropertiesService.getScriptProperties();
  var year = new Date().getFullYear();
  var key = 'SEQ_' + name + '_' + year;
  var n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return { year: year, n: n };
}

function formatRef_(prefix, seq) {
  return prefix + '-' + seq.year + '-' + ('000000' + seq.n).slice(-6);
}

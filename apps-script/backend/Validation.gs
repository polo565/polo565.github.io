/**
 * HAMDI ITALIE — server-side input validation. Never trust the client.
 *
 * validate_(input, spec) returns a clean object containing ONLY the fields in
 * spec, or throws AppError VALIDATION naming the first bad field.
 * Field spec: { type, required, max, min, pattern, values, default }
 *   types: string | text | email | phone | url | slug | enum | bool | number | json | id | lang
 */

var RE_EMAIL_ = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
var RE_SLUG_ = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var RE_ID_ = /^[A-Z]{2,3}-[0-9A-Z]{6,12}$/;

/** Strips control characters (keeps \n and \t) and trims. */
function cleanText_(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

/** Normalises a phone number to +<digits>; Italian numbers without prefix get +39. */
function normalizePhone_(v) {
  var s = cleanText_(v).replace(/[\s().-]/g, '');
  if (!s) return '';
  if (s.indexOf('00') === 0) s = '+' + s.slice(2);
  if (s.charAt(0) !== '+') s = '+39' + s;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

function vfail_(field, msg) { throw AppError_('VALIDATION', field + ': ' + msg); }

function validateField_(name, value, f) {
  var empty = value === undefined || value === null || (typeof value === 'string' && cleanText_(value) === '');
  if (empty) {
    if (f.required) vfail_(name, 'required');
    if (f.type === 'bool') return f.default === undefined ? false : f.default;
    return f.default === undefined ? '' : f.default;
  }
  var max = f.max || (f.type === 'text' ? 5000 : 300);
  switch (f.type) {
    case 'string': case 'text': {
      var s = cleanText_(value);
      if (s.length > max) vfail_(name, 'too long (max ' + max + ')');
      if (f.min && s.length < f.min) vfail_(name, 'too short');
      if (f.pattern && !f.pattern.test(s)) vfail_(name, 'invalid format');
      return s;
    }
    case 'email': {
      var e = cleanText_(value).toLowerCase();
      if (e.length > 254 || !RE_EMAIL_.test(e)) vfail_(name, 'invalid email');
      return e;
    }
    case 'phone': {
      var p = normalizePhone_(value);
      if (!p) vfail_(name, 'invalid phone number');
      return p;
    }
    case 'url': {
      var u = cleanText_(value);
      if (!/^https:\/\/[^\s<>"']+$/i.test(u) || u.length > 2000) vfail_(name, 'must be an https:// link');
      return u;
    }
    case 'slug': {
      var sl = cleanText_(value).toLowerCase();
      if (!RE_SLUG_.test(sl) || sl.length > 80) vfail_(name, 'use lowercase letters, numbers and dashes');
      return sl;
    }
    case 'id': {
      var id = cleanText_(value);
      if (!RE_ID_.test(id)) vfail_(name, 'invalid id');
      return id;
    }
    case 'lang': {
      var l = cleanText_(value);
      if (APP.LANGS.indexOf(l) < 0) vfail_(name, 'unsupported language');
      return l;
    }
    case 'enum': {
      var en = cleanText_(value);
      if (f.values.indexOf(en) < 0) vfail_(name, 'invalid value');
      return en;
    }
    case 'bool': return toBool_(value);
    case 'number': {
      var n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
      if (!isFinite(n)) vfail_(name, 'must be a number');
      if (f.min !== undefined && n < f.min) vfail_(name, 'must be ≥ ' + f.min);
      if (f.max !== undefined && n > f.max) vfail_(name, 'must be ≤ ' + f.max);
      return n;
    }
    case 'json': {
      var obj = typeof value === 'string' ? parseJson_(value, undefined) : value;
      if (obj === undefined || obj === null || typeof obj !== 'object') vfail_(name, 'invalid JSON');
      var str = JSON.stringify(obj);
      if (str.length > 20000) vfail_(name, 'too large');
      if (f.check) f.check(obj, name);
      return str;
    }
    default: throw new Error('Unknown field type ' + f.type);
  }
}

function validate_(input, spec) {
  input = input || {};
  var out = {}, groups = {};
  Object.keys(spec).forEach(function (k) {
    out[k] = validateField_(k, input[k], spec[k]);
    if (spec[k].anyLangOf) (groups[spec[k].anyLangOf] = groups[spec[k].anyLangOf] || []).push(k);
  });
  // Multilingual fields marked required:'any' need text in at least one language.
  Object.keys(groups).forEach(function (field) {
    if (!groups[field].some(function (k) { return out[k] !== '' && out[k] != null; })) {
      vfail_(groups[field][0], 'required in at least one language');
    }
  });
  return out;
}

/**
 * Adds one field per language. required: 'any' = text needed in at least one
 * language; required: true = needed in every language.
 */
function L_spec_(field, f) {
  var out = {};
  APP.LANGS.forEach(function (l) {
    var spec = Object.assign({}, f, { required: f.required === true });
    if (f.required === 'any') spec.anyLangOf = field;
    out[field + '_' + l] = spec;
  });
  return out;
}

/** JSON check: array of {label, url(https)} links. */
function checkLinks_(arr, name) {
  if (!Array.isArray(arr) || arr.length > 30) vfail_(name, 'must be a list (max 30)');
  arr.forEach(function (l) {
    if (!l || typeof l.url !== 'string' || !/^https:\/\//i.test(l.url)) vfail_(name, 'every link must be https://');
  });
}

function checkStringArray_(arr, name) {
  if (!Array.isArray(arr) || arr.some(function (x) { return typeof x !== 'string' || x.length > 40; })) vfail_(name, 'must be a list of ids');
}

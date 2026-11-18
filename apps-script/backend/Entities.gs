/**
 * HAMDI ITALIE — generic admin CRUD for content tables. Each entity declares
 * its sheet, permission section, validation spec and integrity rules, so the
 * admin dashboard can edit everything without code changes (spec §3, §12).
 */

/*
 * Built lazily on first use: Apps Script runs files in order, so top-level code
 * here must not call functions defined in later files (Validation.gs).
 */
var ENTITIES_CACHE_ = null;
function ent_defs_() {
  if (!ENTITIES_CACHE_) ENTITIES_CACHE_ = ent_build_();
  return ENTITIES_CACHE_;
}

function ent_build_() {
var NUM0_ = { type: 'number', min: 0, max: 100000, default: 0 };

return {
  categories: {
    sheet: 'Categories', section: 'categories', unique: ['slug', 'code'], publicContent: true,
    spec: Object.assign({
      code: { type: 'string', required: true, pattern: /^\d{2}$/ },
      slug: { type: 'slug', required: true },
      icon: { type: 'string', max: 40, pattern: /^[a-zA-Z0-9]+$/ },
      image_document_id: { type: 'string', max: 40 },
      order: { type: 'number', min: 0, max: 9999, default: 0 },
      published: { type: 'bool' }
    }, L_spec_('title', { type: 'string', required: 'any', max: 150 }), L_spec_('description', { type: 'text', max: 1000 })),
    beforeDelete: function (rec) {
      if (db_findOne_('Services', function (s) { return s.category_id === rec.id; })) throw AppError_('IN_USE', 'Category has services; move or delete them first.');
    }
  },
  services: {
    sheet: 'Services', section: 'services', unique: ['slug'], publicContent: true,
    spec: Object.assign({
      category_id: { type: 'id', required: true },
      slug: { type: 'slug', required: true },
      service_price: NUM0_, assistance_fee: NUM0_, official_fee_amount: NUM0_, provider_fee: NUM0_,
      official_fee_verified: { type: 'bool' },
      additional_charges_json: { type: 'json', default: '[]', check: function (a, n) { if (!Array.isArray(a)) vfail_(n, 'must be a list'); } },
      discount_json: { type: 'json', default: '' },
      payment_method_ids_json: { type: 'json', default: '[]', check: checkStringArray_ },
      currency: { type: 'enum', values: ['EUR'], default: 'EUR' },
      official_links_json: { type: 'json', default: '[]', check: checkLinks_ },
      city_ids_json: { type: 'json', default: '[]', check: checkStringArray_ },
      requestable: { type: 'bool' }, popular: { type: 'bool' },
      order: { type: 'number', min: 0, max: 9999, default: 0 },
      published: { type: 'bool' },
      mark_verified: { type: 'bool' }
    }, L_spec_('title', { type: 'string', required: 'any', max: 200 }), L_spec_('summary', { type: 'text', max: 1000 }),
      L_spec_('official_fee_text', { type: 'text', max: 1000 }), L_spec_('institutions', { type: 'string', max: 300 })),
    beforeSave: function (d, before, ctx) {
      if (!db_get_('Categories', d.category_id)) vfail_('category_id', 'unknown category');
      if (d.mark_verified) { d.verified_by = ctx.adminEmail; d.verified_at = nowIso_(); }
      delete d.mark_verified;
      if (!before) d.view_count = 0;
    },
    beforeDelete: function (rec) {
      if (db_findOne_('Appointments', function (a) { return a.service_id === rec.id; })) throw AppError_('IN_USE', 'Service has requests; unpublish it instead.');
    }
  },
  service_translations: {
    sheet: 'ServiceTranslations', section: 'services', publicContent: true,
    spec: {
      service_id: { type: 'id', required: true }, lang: { type: 'lang', required: true },
      description: { type: 'text', max: 15000 }, eligibility: { type: 'text', max: 15000 },
      procedure: { type: 'text', max: 15000 }, required_documents: { type: 'text', max: 15000 }, notes: { type: 'text', max: 5000 }
    },
    beforeSave: function (d, before) {
      if (!db_get_('Services', d.service_id)) vfail_('service_id', 'unknown service');
      var dup = db_findOne_('ServiceTranslations', function (t) { return t.service_id === d.service_id && t.lang === d.lang && (!before || t.id !== before.id); });
      if (dup) throw AppError_('CONFLICT', 'A translation for this language already exists.');
    }
  },
  faqs: {
    sheet: 'FAQs', section: 'faqs', publicContent: true,
    spec: Object.assign({
      scope: { type: 'enum', values: ['home', 'category', 'service', 'guide'], required: true },
      ref_id: { type: 'string', max: 40 },
      order: { type: 'number', min: 0, max: 9999, default: 0 }, published: { type: 'bool' }
    }, L_spec_('question', { type: 'string', required: 'any', max: 300 }), L_spec_('answer', { type: 'text', required: 'any', max: 5000 }))
  },
  homepage: {
    sheet: 'Homepage', section: 'homepage', publicContent: true,
    spec: Object.assign({
      block: { type: 'enum', values: ['hero', 'categories', 'popular', 'guide', 'how', 'documents', 'faq', 'contact', 'footer', 'about', 'privacy', 'terms'], required: true },
      key: { type: 'string', required: true, max: 60, pattern: /^[a-z0-9_.-]+$/ },
      order: { type: 'number', min: 0, max: 9999, default: 0 }, published: { type: 'bool' }
    }, L_spec_('value', { type: 'text', max: 20000 }))
  },
  cities: {
    sheet: 'Cities', section: 'cities', unique: ['name'], publicContent: true,
    spec: { name: { type: 'string', required: true, max: 100 }, province: { type: 'string', max: 60 }, region: { type: 'string', max: 60 }, active: { type: 'bool' } },
    beforeDelete: function (rec) {
      if (db_findOne_('Appointments', function (a) { return a.city_id === rec.id; })) throw AppError_('IN_USE', 'City is used by requests; deactivate it instead.');
    }
  },
  settings: {
    sheet: 'Settings', section: 'settings', key: 'key', publicContent: true,
    spec: {
      key: { type: 'string', required: true, max: 60, pattern: /^[a-z0-9_]+$/ },
      value: { type: 'text', max: 20000 },
      type: { type: 'enum', values: ['string', 'number', 'bool', 'json'], default: 'string' },
      public: { type: 'bool' }, description: { type: 'string', max: 300 }
    },
    beforeSave: function (d) {
      if (d.type === 'number' && d.value !== '' && !isFinite(Number(d.value))) vfail_('value', 'must be a number');
      if (d.type === 'json' && d.value !== '' && parseJson_(d.value, undefined) === undefined) vfail_('value', 'invalid JSON');
    },
    beforeDelete: function () { throw AppError_('FORBIDDEN', 'Settings cannot be deleted; clear the value instead.'); }
  },
  payment_methods: {
    sheet: 'PaymentMethods', section: 'payments', unique: ['code'], publicContent: true,
    spec: Object.assign({
      code: { type: 'string', required: true, max: 40, pattern: /^[a-z0-9_]+$/ },
      type: { type: 'enum', values: PAYMENT_METHOD_TYPES, required: true },
      requires_bank_account: { type: 'bool' }, requires_card: { type: 'bool' },
      deadline_days: { type: 'number', min: 0, max: 365, default: 0 },
      active: { type: 'bool' }, order: { type: 'number', min: 0, max: 9999, default: 0 }
    }, L_spec_('name', { type: 'string', required: 'any', max: 150 }), L_spec_('instructions', { type: 'text', max: 3000 }),
      L_spec_('location', { type: 'text', max: 1000 }), L_spec_('provider_fee_text', { type: 'string', max: 300 })),
    beforeSave: function (d) {
      if (CASH_TYPES_.indexOf(d.type) >= 0) { d.requires_bank_account = false; d.requires_card = false; }
      // Seeded methods contain [PLACEHOLDERS] (card number, PayPal.me link) that must be replaced first.
      if (d.active) {
        APP.LANGS.forEach(function (l) {
          ['instructions_', 'location_', 'name_'].forEach(function (p) {
            if (/\[[A-Z][A-Z .]+\]/.test(String(d[p + l] || ''))) vfail_(p + l, 'replace the [PLACEHOLDERS] with your real details before activating');
          });
        });
      }
    },
    beforeDelete: function (rec) {
      if (db_findOne_('Payments', function (p) { return p.method_id === rec.id; })) throw AppError_('IN_USE', 'Method has payments; deactivate it instead.');
    }
  },
  guidance_questions: {
    sheet: 'GuidanceQuestions', section: 'guidance', unique: ['key'], publicContent: true,
    spec: Object.assign({
      key: { type: 'string', required: true, max: 60, pattern: /^[a-z0-9_]+$/ },
      order: { type: 'number', min: 0, max: 9999, default: 0 },
      type: { type: 'enum', values: ['yes_no', 'single_choice'], default: 'yes_no' },
      options_json: { type: 'json', default: '[]', check: function (a, n) { if (!Array.isArray(a)) vfail_(n, 'must be a list'); } },
      published: { type: 'bool' }
    }, L_spec_('question', { type: 'string', required: 'any', max: 300 }), L_spec_('help', { type: 'text', max: 1000 }))
  },
  guidance_rules: {
    sheet: 'GuidanceRules', section: 'guidance', publicContent: true,
    spec: Object.assign({
      order: { type: 'number', min: 0, max: 9999, default: 0 },
      condition_json: { type: 'json', required: true },
      task_key: { type: 'string', required: true, max: 60, pattern: /^[a-z0-9_]+$/ },
      official_link: { type: 'url' }, service_id: { type: 'string', max: 40 },
      depends_on_status: { type: 'bool' }, published: { type: 'bool' }
    }, L_spec_('title', { type: 'string', required: 'any', max: 200 }), L_spec_('explanation', { type: 'text', max: 5000 }),
      L_spec_('institution', { type: 'string', max: 200 }), L_spec_('documents', { type: 'text', max: 3000 }))
  },
  contacts: {
    sheet: 'ContactRequests', section: 'contacts', updateOnly: true,
    spec: { status: { type: 'enum', values: ['new', 'read', 'answered', 'closed'], required: true } }
  },
  documents: {
    sheet: 'Documents', section: 'documents', updateOnly: true, publicContent: true, // files are created by DriveManager
    beforeSave: function (d) { doc_checkLinks_(d); },
    afterSave: function (after) { drive_syncSharing_(after); },
    spec: Object.assign({
      category_id: { type: 'string', max: 40 }, service_id: { type: 'string', max: 40 }, lang: { type: 'string', max: 2 },
      visibility: { type: 'enum', values: ['public', 'admin'], default: 'admin' }, published: { type: 'bool' }
    }, L_spec_('title', { type: 'string', max: 200 }), L_spec_('description', { type: 'text', max: 2000 }))
  },
  visitors: { sheet: 'Visitors', section: 'visitors', readOnly: true, hide: ['password_hash', 'salt', 'iterations'] },
  notifications: { sheet: 'Notifications', section: 'notifications', readOnly: true },
  audit: { sheet: 'AuditLogs', section: 'audit', readOnly: true }
};
}

function ent_def_(entity) {
  var def = Object.prototype.hasOwnProperty.call(ent_defs_(), entity) ? ent_defs_()[entity] : null;
  if (!def) throw AppError_('VALIDATION', 'Unknown entity.');
  return def;
}

function ent_strip_(def, rec) {
  var out = Object.assign({}, rec);
  (def.hide || []).forEach(function (h) { delete out[h]; });
  return out;
}

/** List with simple filtering, text search, sorting and pagination. */
function ent_list_(entity, opts) {
  var def = ent_def_(entity);
  opts = opts || {};
  var q = cleanText_(opts.q).toLowerCase();
  var filters = opts.filters || {};
  var items = db_all_(def.sheet).filter(function (r) {
    for (var k in filters) if (Object.prototype.hasOwnProperty.call(filters, k) && filters[k] !== '' && String(r[k]) !== String(filters[k])) return false;
    if (q && JSON.stringify(ent_strip_(def, r)).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var sort = opts.sort || (items.length && 'order' in items[0] ? 'order' : 'created_at');
  var dir = opts.dir === 'desc' || (!opts.sort && sort === 'created_at') ? -1 : 1;
  items.sort(function (a, b) {
    var x = a[sort], y = b[sort];
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y)) * dir;
  });
  var offset = Math.max(0, Number(opts.offset) || 0), limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
  return { total: items.length, items: items.slice(offset, offset + limit).map(function (r) { return ent_strip_(def, r); }) };
}

function ent_save_(ctx, entity, id, input) {
  var def = ent_def_(entity);
  if (def.readOnly) throw AppError_('FORBIDDEN', 'Read-only.');
  var keyField = def.key || 'id';
  var before = id ? db_get_(def.sheet, id) : null;
  if (id && !before) throw AppError_('NOT_FOUND', 'Record not found.');
  if (!id && def.updateOnly) throw AppError_('FORBIDDEN', 'Records of this type cannot be created here.');
  var d = validate_(input, def.spec);
  (def.unique || []).forEach(function (field) {
    if (d[field] === '' || d[field] === undefined) return;
    var clash = db_findOne_(def.sheet, function (r) {
      return String(r[field]).toLowerCase() === String(d[field]).toLowerCase() && (!before || r[keyField] !== before[keyField]);
    });
    if (clash) vfail_(field, 'already used');
  });
  if (def.beforeSave) def.beforeSave(d, before, ctx);
  var after;
  if (before) {
    if (keyField !== 'id') delete d[keyField]; // natural keys are immutable
    after = db_update_(def.sheet, before[keyField], d);
  } else {
    if (keyField !== 'id' && db_get_(def.sheet, d[keyField])) vfail_(keyField, 'already used');
    after = db_insert_(def.sheet, d);
  }
  if (def.afterSave) def.afterSave(after, before);
  audit_(ctx, before ? 'update' : 'create', def.sheet, after[keyField], before, after, '');
  if (def.publicContent) cache_bust_public_();
  return ent_strip_(def, after);
}

function ent_delete_(ctx, entity, id) {
  var def = ent_def_(entity);
  if (def.readOnly || def.updateOnly) throw AppError_('FORBIDDEN', 'Cannot delete this type of record.');
  var rec = db_get_(def.sheet, id);
  if (!rec) throw AppError_('NOT_FOUND', 'Record not found.');
  if (def.beforeDelete) def.beforeDelete(rec, ctx);
  db_delete_(def.sheet, id);
  audit_(ctx, 'delete', def.sheet, id, rec, null, '');
  if (def.publicContent) cache_bust_public_();
  return true;
}

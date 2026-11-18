/**
 * HAMDI ITALIE — public (visitor) API. Every function here is callable by
 * anonymous visitors via google.script.run: it must only return public data,
 * validate all input and never trust client-supplied identity.
 */

/* ---- Content ------------------------------------------------------------------ */

/** Homepage content (all languages; the client picks). Cached 10 min. */
function api_getHome() {
  return handle_(function () {
    if (!db_ready_()) return homeFromSeed_();
    var cache = CacheService.getScriptCache();
    var key = cache_public_key_('home:v2');
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);
    var data = homeFromDb_();
    var json = JSON.stringify(data);
    if (json.length < 95000) cache.put(key, json, CACHE_TTL.PUBLIC_CONTENT);
    return data;
  });
}

function pub_category_(c) {
  var out = pick_(c, ['id', 'code', 'slug', 'icon', 'order'].concat(L_('title'), L_('description')));
  var img = c.image_document_id ? db_get_('Documents', c.image_document_id) : null;
  if (img && pub_isPublicDoc_(img) && /^image\//.test(String(img.mime))) out.image_url = drive_imageUrl_(img.drive_file_id);
  return out;
}

function pub_serviceCard_(s) {
  return pick_(s, ['id', 'slug', 'category_id', 'order'].concat(L_('title'), L_('summary')));
}

function pub_document_(d) {
  var out = pick_(d, ['id', 'mime', 'size', 'lang', 'category_id', 'service_id'].concat(L_('title'), L_('description')));
  out.url = 'https://drive.google.com/file/d/' + encodeURIComponent(d.drive_file_id) + '/view';
  return out;
}

function pub_isPublicDoc_(d) { return toBool_(d.published) && d.visibility === 'public' && d.drive_file_id; }

function homeFromDb_() {
  var s = settings_public_();
  var byOrder = function (a, b) { return Number(a.order || 0) - Number(b.order || 0); };
  return {
    source: 'db',
    contactEnabled: true,
    registrationEnabled: s.registration_enabled !== false,
    cashAvailable: db_all_('PaymentMethods').some(function (m) { return toBool_(m.active) && pay_isCash_(m); }),
    site: {
      name: s.site_name, phone: s.contact_phone, whatsapp: s.contact_whatsapp, email: s.contact_email,
      address: s.contact_address, social: s.social_links || [], colors: s.brand_colors || null
    },
    blocks: db_where_('Homepage', function (h) { return toBool_(h.published); }).sort(byOrder)
      .map(function (h) { return pick_(h, ['block', 'key'].concat(L_('value'))); }),
    categories: db_where_('Categories', function (c) { return toBool_(c.published); }).sort(byOrder).map(pub_category_),
    popular: db_where_('Services', function (x) { return toBool_(x.published) && toBool_(x.popular); }).sort(byOrder).slice(0, 12).map(pub_serviceCard_),
    documents: db_where_('Documents', pub_isPublicDoc_).slice(0, 6).map(pub_document_),
    faqs: db_where_('FAQs', function (f) { return toBool_(f.published) && f.scope === 'home'; }).sort(byOrder)
      .map(function (f) { return pick_(f, L_('question').concat(L_('answer'))); })
  };
}

/** Homepage payload from SeedData.gs, used before setup() has run. */
function homeFromSeed_() {
  return {
    source: 'seed',
    contactEnabled: false,
    cashAvailable: SEED_PAYMENT_METHODS.some(function (m) { return m.active && !m.requires_bank_account; }),
    site: { phone: '', whatsapp: '', email: '', address: '' },
    categories: SEED_CATEGORIES.map(function (c, i) {
      var out = { code: c.code, slug: c.slug, icon: c.icon, order: i + 1 };
      APP.LANGS.forEach(function (l) { out['title_' + l] = c['title_' + l]; out['description_' + l] = c['description_' + l]; });
      return out;
    }),
    popular: [], documents: [], faqs: []
  };
}

/** Caches a public payload under the current public-content generation. */
function cachedPublic_(base, ttl, build) {
  var cache = CacheService.getScriptCache();
  var key = cache_public_key_(base);
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var data = build();
  var json = JSON.stringify(data);
  if (json.length < 95000) cache.put(key, json, ttl || CACHE_TTL.PUBLIC_CONTENT);
  return data;
}

/** All published categories with their published services (services index + search). */
function api_getCatalog() {
  return handle_(function () {
    return cachedPublic_('catalog:v1', CACHE_TTL.PUBLIC_CONTENT, function () {
      var byOrder = function (a, b) { return Number(a.order || 0) - Number(b.order || 0); };
      var cats = db_where_('Categories', function (c) { return toBool_(c.published); }).sort(byOrder);
      var services = db_where_('Services', function (x) { return toBool_(x.published); }).sort(byOrder);
      return {
        categories: cats.map(function (c) {
          var out = pub_category_(c);
          out.services = services.filter(function (x) { return x.category_id === c.id; }).map(pub_serviceCard_);
          return out;
        })
      };
    });
  });
}

/** New immigrant guide: published questions and rules (evaluated in the browser). */
function api_getGuide() {
  return handle_(function () {
    return cachedPublic_('guide:v1', CACHE_TTL.PUBLIC_CONTENT, function () {
      var byOrder = function (a, b) { return Number(a.order || 0) - Number(b.order || 0); };
      var services = {};
      db_all_('Services').forEach(function (x) { if (toBool_(x.published)) services[x.id] = x.slug; });
      return {
        questions: db_where_('GuidanceQuestions', function (q) { return toBool_(q.published); }).sort(byOrder).map(function (q) {
          var o = pick_(q, ['key', 'type'].concat(L_('question'), L_('help')));
          o.options = parseJson_(q.options_json, []);
          return o;
        }),
        rules: db_where_('GuidanceRules', function (r) { return toBool_(r.published); }).sort(byOrder).map(function (r) {
          var o = pick_(r, ['task_key', 'official_link', 'depends_on_status'].concat(L_('title'), L_('explanation'), L_('institution'), L_('documents')));
          o.depends_on_status = toBool_(r.depends_on_status);
          o.condition = parseJson_(r.condition_json, {});
          o.service_slug = services[r.service_id] || '';
          return o;
        })
      };
    });
  });
}

/* ---- View counts (batched: counted in cache, flushed daily) ------------------- */
function views_bump_(serviceId) {
  try {
    var c = CacheService.getScriptCache();
    var n = Number(c.get('views:' + serviceId) || 0) + 1;
    c.put('views:' + serviceId, String(n), 21600);
    var ids = parseJson_(c.get('views:ids'), []);
    if (ids.indexOf(serviceId) < 0 && ids.length < 500) { ids.push(serviceId); c.put('views:ids', JSON.stringify(ids), 21600); }
  } catch (e) { /* counting must never break a page */ }
}

/** Adds cached view counts to Services.view_count (maintenance trigger). */
function views_flush_() {
  var c = CacheService.getScriptCache();
  var ids = parseJson_(c.get('views:ids'), []);
  if (!ids.length) return 0;
  var counts = c.getAll(ids.map(function (id) { return 'views:' + id; }));
  var n = 0;
  ids.forEach(function (id) {
    var add = Number(counts['views:' + id] || 0);
    var svc = add && db_get_('Services', id);
    if (svc) { db_update_('Services', id, { view_count: Number(svc.view_count || 0) + add }); n++; }
  });
  c.removeAll(ids.map(function (id) { return 'views:' + id; }).concat(['views:ids']));
  return n;
}

/** Category page: category + its published services + category FAQs and documents. */
function api_getCategory(slug) {
  return handle_(function () {
    slug = validateField_('slug', slug, { type: 'slug', required: true });
    return cachedPublic_('cat:' + slug, CACHE_TTL.PUBLIC_CONTENT, function () { return categoryPage_(slug); });
  });
}

function categoryPage_(slug) {
    var c = db_findOne_('Categories', function (x) { return x.slug === slug && toBool_(x.published); });
    if (!c) throw AppError_('NOT_FOUND', 'Not found.');
    var byOrder = function (a, b) { return Number(a.order || 0) - Number(b.order || 0); };
    return {
      category: pub_category_(c),
      services: db_where_('Services', function (s) { return s.category_id === c.id && toBool_(s.published); }).sort(byOrder).map(pub_serviceCard_),
      documents: db_where_('Documents', function (d) { return pub_isPublicDoc_(d) && d.category_id === c.id; }).map(pub_document_),
      faqs: db_where_('FAQs', function (f) { return toBool_(f.published) && f.scope === 'category' && f.ref_id === c.id; }).sort(byOrder)
        .map(function (f) { return pick_(f, L_('question').concat(L_('answer'))); })
    };
}

/** Service page: full content, price breakdown (separated), payment methods, docs, FAQs. */
function api_getService(slug) {
  return handle_(function () {
    slug = validateField_('slug', slug, { type: 'slug', required: true });
    var page = cachedPublic_('svc:' + slug, CACHE_TTL.PUBLIC_CONTENT, function () { return servicePage_(slug); });
    views_bump_(page.service.id);
    return page;
  });
}

function servicePage_(slug) {
    var s = db_findOne_('Services', function (x) { return x.slug === slug && toBool_(x.published); });
    if (!s) throw AppError_('NOT_FOUND', 'Not found.');
    var cat = db_get_('Categories', s.category_id);
    var cityIds = parseJson_(s.city_ids_json, []);
    var methods = pay_methodsForService_(s);
    var cash = methods.filter(pay_isCash_)[0] || null;
    return {
      service: Object.assign(pick_(s, ['id', 'slug', 'category_id', 'requestable', 'currency', 'verified_at']
        .concat(L_('title'), L_('summary'), L_('official_fee_text'), L_('institutions'))),
        { official_links: parseJson_(s.official_links_json, []) }),
      category: cat ? pub_category_(cat) : null,
      content: db_where_('ServiceTranslations', function (t) { return t.service_id === s.id; })
        .map(function (t) { return pick_(t, ['lang', 'description', 'eligibility', 'procedure', 'required_documents', 'notes']); }),
      price: pay_breakdown_(s, cash || methods[0] || null),
      paymentMethods: methods.map(function (m) {
        var o = pick_(m, ['id', 'code', 'type'].concat(L_('name'), L_('instructions'), L_('location'), L_('provider_fee_text')));
        o.cash = pay_isCash_(m); o.requires_bank_account = toBool_(m.requires_bank_account); o.requires_card = toBool_(m.requires_card);
        return o;
      }),
      cities: db_where_('Cities', function (c) { return toBool_(c.active) && (!cityIds.length || cityIds.indexOf(c.id) >= 0); })
        .map(function (c) { return pick_(c, ['id', 'name', 'province', 'region']); }),
      documents: db_where_('Documents', function (d) { return pub_isPublicDoc_(d) && d.service_id === s.id; }).map(pub_document_),
      faqs: db_where_('FAQs', function (f) { return toBool_(f.published) && f.scope === 'service' && f.ref_id === s.id; })
        .map(function (f) { return pick_(f, L_('question').concat(L_('answer'))); })
    };
}

/** Simple full-text search over published categories and services (all languages). */
function api_search(q) {
  return handle_(function () {
    q = cleanText_(q).toLowerCase().slice(0, 100);
    if (q.length < 2) return { categories: [], services: [] };
    var match = function (rec, fields) {
      return fields.some(function (f) { return String(rec[f] || '').toLowerCase().indexOf(q) >= 0; });
    };
    var tFields = L_('title').concat(L_('summary'), L_('description'), ['slug']);
    return {
      categories: db_where_('Categories', function (c) { return toBool_(c.published) && match(c, tFields); }).map(pub_category_),
      services: db_where_('Services', function (s) { return toBool_(s.published) && match(s, tFields); }).slice(0, 50).map(pub_serviceCard_)
    };
  });
}

/* ---- Forms ------------------------------------------------------------------------ */
function api_submitContact(data) {
  return handle_(function () { return contact_submit_(data); });
}

/** Guest or signed-in request. Returns reference + one-time tracking code. */
function api_submitRequest(data, visitorToken) {
  return handle_(function () {
    var visitor = visitorToken ? requireVisitor_(visitorToken) : null;
    return appt_submit_(data, visitor);
  });
}

function api_trackRequest(reference, code) {
  return handle_(function () { return appt_track_(reference, code); });
}

/* ---- Optional visitor accounts (spec §21) ---------------------------------------- */
function api_visitorRegister(data) { return handle_(function () { return auth_visitorRegister_(data); }); }
function api_visitorLogin(phone, password) { return handle_(function () { return auth_visitorLogin_(phone, password); }); }
function api_visitorLogout(token) { return handle_(function () { auth_revokeSession_(token); return true; }); }
function api_visitorMe(token) { return handle_(function () { return auth_visitorProfile_(requireVisitor_(token)); }); }
function api_visitorRequests(token) { return handle_(function () { return appt_forVisitor_(requireVisitor_(token).id); }); }

function api_visitorUpdateProfile(token, data) {
  return handle_(function () {
    var v = requireVisitor_(token);
    var d = validate_(data, { name: { type: 'string', required: true, max: 100 }, email: { type: 'email' }, preferred_lang: { type: 'lang', default: APP.DEFAULT_LANG } });
    if (d.email && d.email !== String(v.email).toLowerCase() &&
        db_findOne_('Visitors', function (x) { return String(x.email).toLowerCase() === d.email && x.id !== v.id; })) vfail_('email', 'already used');
    var patch = { name: d.name, preferred_lang: d.preferred_lang };
    if (d.email !== String(v.email || '').toLowerCase()) { patch.email = d.email; patch.email_verified = false; }
    return auth_visitorProfile_(db_update_('Visitors', v.id, patch));
  });
}

function api_visitorChangePassword(token, oldPassword, newPassword) {
  return handle_(function () {
    var v = requireVisitor_(token);
    return auth_changePassword_('Visitors', 'visitor', v.id, oldPassword, newPassword, token);
  });
}

/** Account deletion: erases the account and anonymises the visitor's requests (Privacy.gs). */
function api_visitorDeleteAccount(token, password) {
  return handle_(function () {
    var v = requireVisitor_(token);
    if (!auth_verifyPassword_(v, String(password || ''))) throw AppError_('AUTH', AUTH_GENERIC_ERROR_);
    privacy_eraseVisitor_(v.id, { adminId: '', adminEmail: 'visitor' }, 'deleted by the visitor');
    return true;
  });
}

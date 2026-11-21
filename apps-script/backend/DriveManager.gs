/**
 * HAMDI ITALIE — Google Drive layer. The ONLY module that touches Drive.
 *
 * Rules (docs/SECURITY.md §5):
 *  - the root folder and every folder stay private;
 *  - a document file is shared "anyone with the link: view" ONLY while it is
 *    published AND visibility = public; otherwise it is private;
 *  - visitor uploads go to 99_PRIVATE_UPLOADS/<year>/ and are never shared;
 *  - file types are checked from the content (magic bytes), not the name.
 */

var DRIVE_LIMITS_ = Object.freeze({
  ADMIN_MAX_BYTES: 20 * 1024 * 1024,
  VISITOR_MAX_BYTES: SECURITY.UPLOAD_MAX_BYTES,
  VISITOR_MAX_FILES: SECURITY.UPLOAD_MAX_FILES
});

/** Allowed types detected from the first bytes. ZIP-based Office files are admin-only. */
var FILE_SIGNATURES_ = [
  { mime: 'application/pdf', ext: 'pdf', sig: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/png', ext: 'png', sig: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/jpeg', ext: 'jpg', sig: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/webp', ext: 'webp', sig: [0x52, 0x49, 0x46, 0x46], at8: [0x57, 0x45, 0x42, 0x50] },
  { mime: 'application/zip', ext: 'zip', sig: [0x50, 0x4B, 0x03, 0x04], office: true }
];
var OFFICE_TYPES_ = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text'
};
var VISITOR_MIMES_ = ['application/pdf', 'image/png', 'image/jpeg'];

function drive_root_() { return DriveApp.getFolderById(getProp_(PROP.DRIVE_ROOT_FOLDER_ID, true)); }

/** Finds (or creates) a direct sub-folder of `parent`. */
function drive_subfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Folder for a document: the category's numbered folder, else general media. */
function drive_folderFor_(categoryId, isImage) {
  var root = drive_root_();
  var cat = categoryId ? db_get_('Categories', categoryId) : null;
  var code = cat ? String(cat.code) : '';
  var name = DRIVE_FOLDERS.filter(function (f) { return code && f.indexOf(code + '_') === 0; })[0];
  return drive_subfolder_(root, name || (isImage ? '14_GENERAL_MEDIA' : '14_GENERAL_MEDIA'));
}

function drive_privateYearFolder_() {
  var id = getProp_(PROP.PRIVATE_UPLOADS_FOLDER_ID, false);
  var base = id ? DriveApp.getFolderById(id) : drive_subfolder_(drive_root_(), PRIVATE_UPLOADS_FOLDER_NAME);
  return drive_subfolder_(base, String(new Date().getFullYear()));
}

/** Safe file name: no path characters or control chars, max 120 chars, keeps the extension. */
function drive_cleanName_(name, ext) {
  var n = cleanText_(name).replace(/[\\/:*?"<>|#%{}~&\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').slice(0, 120);
  if (!n) n = 'file';
  if (ext && !new RegExp('\\.' + ext + '$', 'i').test(n)) n = n.replace(/\.[A-Za-z0-9]{1,5}$/, '') + '.' + ext;
  return n;
}

function drive_bytesStartWith_(bytes, sig, offset) {
  offset = offset || 0;
  for (var i = 0; i < sig.length; i++) if (((bytes[offset + i] + 256) % 256) !== sig[i]) return false;
  return true;
}

/**
 * Decodes and checks an uploaded file {name, base64}. Returns {bytes, mime, name, size}.
 * `allowed` = list of mimes; Office ZIP files only when `allowOffice`.
 */
function drive_checkUpload_(file, maxBytes, allowed, allowOffice) {
  if (!file || typeof file.base64 !== 'string' || !file.base64) vfail_('file', 'missing');
  if (file.base64.length > Math.ceil(maxBytes * 4 / 3) + 16) vfail_('file', 'too large (max ' + Math.round(maxBytes / 1048576) + ' MB)');
  var bytes;
  try { bytes = Utilities.base64Decode(file.base64.replace(/^data:[^,]*,/, '')); } catch (e) { vfail_('file', 'unreadable'); }
  if (!bytes.length) vfail_('file', 'empty');
  if (bytes.length > maxBytes) vfail_('file', 'too large (max ' + Math.round(maxBytes / 1048576) + ' MB)');
  var match = FILE_SIGNATURES_.filter(function (s) {
    return drive_bytesStartWith_(bytes, s.sig) && (!s.at8 || drive_bytesStartWith_(bytes, s.at8, 8));
  })[0];
  if (!match) vfail_('file', 'type not allowed');
  var mime = match.mime, ext = match.ext;
  if (match.office) {
    var given = String(file.name || '').toLowerCase().match(/\.(docx|xlsx|odt)$/);
    if (!allowOffice || !given) vfail_('file', 'type not allowed');
    ext = given[1]; mime = OFFICE_TYPES_[ext];
  }
  if (allowed.indexOf(mime) < 0 && !(match.office && allowOffice)) vfail_('file', 'type not allowed');
  return { bytes: bytes, mime: mime, size: bytes.length, name: drive_cleanName_(file.name, ext) };
}

function drive_create_(folder, checked) {
  return folder.createFile(Utilities.newBlob(checked.bytes, checked.mime, checked.name));
}

/** Applies the sharing rule for a Documents record. Never throws on missing files. */
function drive_syncSharing_(doc) {
  if (!doc || !doc.drive_file_id) return;
  try {
    var file = DriveApp.getFileById(doc.drive_file_id);
    if (toBool_(doc.published) && doc.visibility === 'public') file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    else file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  } catch (e) { console.error('sharing sync failed for ' + doc.id, e); }
}

function drive_trash_(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { console.error('trash failed ' + fileId, e); }
}

function drive_readBase64_(fileId) {
  var blob = DriveApp.getFileById(fileId).getBlob();
  return { base64: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType(), name: blob.getName() };
}

/** Public image URL for a document shared with link (used for category/service images). */
function drive_imageUrl_(fileId) {
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1200';
}

/* ---- Documents (admin) ----------------------------------------------------------- */
var DOC_META_SPEC_ = null;
function doc_metaSpec_() {
  if (!DOC_META_SPEC_) DOC_META_SPEC_ = Object.assign({
    category_id: { type: 'string', max: 40 }, service_id: { type: 'string', max: 40 }, lang: { type: 'string', max: 2 },
    visibility: { type: 'enum', values: ['public', 'admin'], default: 'admin' }, published: { type: 'bool' }
  }, L_spec_('title', { type: 'string', required: 'any', max: 200 }), L_spec_('description', { type: 'text', max: 2000 }));
  return DOC_META_SPEC_;
}

function doc_checkLinks_(d) {
  if (d.category_id && !db_get_('Categories', d.category_id)) vfail_('category_id', 'unknown category');
  if (d.service_id && !db_get_('Services', d.service_id)) vfail_('service_id', 'unknown service');
  if (d.lang && APP.LANGS.indexOf(d.lang) < 0) vfail_('lang', 'unsupported language');
}

function doc_upload_(ctx, meta, file) {
  var d = validate_(meta, doc_metaSpec_());
  doc_checkLinks_(d);
  var checked = drive_checkUpload_(file, DRIVE_LIMITS_.ADMIN_MAX_BYTES,
    ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], true);
  var f = drive_create_(drive_folderFor_(d.category_id, /^image\//.test(checked.mime)), checked);
  var rec = db_insert_('Documents', Object.assign(d, {
    drive_file_id: f.getId(), file_name: checked.name, mime: checked.mime, size: checked.size, uploaded_by: ctx.adminEmail
  }));
  drive_syncSharing_(rec);
  audit_(ctx, 'upload', 'Documents', rec.id, null, rec, checked.name);
  cache_bust_public_();
  return rec;
}

/** New file content; the Documents id (and every link to it) stays the same. */
function doc_replace_(ctx, id, file) {
  var before = db_get_('Documents', id);
  if (!before) throw AppError_('NOT_FOUND', 'Document not found.');
  var checked = drive_checkUpload_(file, DRIVE_LIMITS_.ADMIN_MAX_BYTES,
    ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], true);
  var f = drive_create_(drive_folderFor_(before.category_id, /^image\//.test(checked.mime)), checked);
  var after = db_update_('Documents', id, { drive_file_id: f.getId(), file_name: checked.name, mime: checked.mime, size: checked.size, uploaded_by: ctx.adminEmail });
  drive_syncSharing_(after);
  drive_trash_(before.drive_file_id);
  audit_(ctx, 'replace', 'Documents', id, before, after, checked.name);
  cache_bust_public_();
  return after;
}

function doc_delete_(ctx, id) {
  var rec = db_get_('Documents', id);
  if (!rec) throw AppError_('NOT_FOUND', 'Document not found.');
  var usedBy = db_findOne_('Categories', function (c) { return c.image_document_id === id; });
  if (usedBy) throw AppError_('IN_USE', 'This image is used by a category; choose another image first.');
  drive_trash_(rec.drive_file_id); // trash, not permanent delete: recoverable from Drive for 30 days
  db_delete_('Documents', id);
  audit_(ctx, 'delete', 'Documents', id, rec, null, 'file moved to Drive trash');
  cache_bust_public_();
  return true;
}

/* ---- Visitor uploads (private) ------------------------------------------------------ */
/** Validates visitor files BEFORE the request is created (so a bad file never leaves a half request). */
function upload_checkVisitorFiles_(files) {
  if (!files || !files.length) return [];
  if (!Array.isArray(files) || files.length > DRIVE_LIMITS_.VISITOR_MAX_FILES) vfail_('files', 'max ' + DRIVE_LIMITS_.VISITOR_MAX_FILES + ' files');
  return files.map(function (f) { return drive_checkUpload_(f, DRIVE_LIMITS_.VISITOR_MAX_BYTES, VISITOR_MIMES_, false); });
}

/** Saves already-checked visitor files privately, named after the request reference. */
function upload_saveVisitorFiles_(checked, reference) {
  if (!checked.length) return [];
  var folder = drive_privateYearFolder_();
  return checked.map(function (c, i) {
    c.name = drive_cleanName_(reference + '_' + (i + 1) + '_' + c.name);
    var f = drive_create_(folder, c); // never shared
    return { file_id: f.getId(), name: c.name, mime: c.mime, size: c.size };
  });
}

/** Daily: trash visitor uploads whose retention period has ended. */
function upload_purgeExpired_() {
  var now = Date.now(), n = 0;
  db_where_('Appointments', function (a) {
    return a.retention_until && now > new Date(a.retention_until).getTime() && parseJson_(a.attachments_json, []).length;
  }).forEach(function (a) {
    parseJson_(a.attachments_json, []).forEach(function (x) { drive_trash_(x.file_id); n++; });
    db_update_('Appointments', a.id, { attachments_json: '[]' });
    audit_(SYSTEM_CTX_, 'retention_purge', 'Appointments', a.id, null, null, 'attachments moved to Drive trash');
  });
  return n;
}

/* ---- Drive status (admin) ----------------------------------------------------------- */
function drive_status_() {
  var root = drive_root_();
  var out = { rootName: root.getName(), rootUrl: root.getUrl(), rootSharing: String(root.getSharingAccess()), rootPrivate: root.getSharingAccess() === DriveApp.Access.PRIVATE, folders: [] };
  var it = root.getFolders();
  while (it.hasNext()) {
    var f = it.next(), count = 0, files = f.getFiles();
    while (files.hasNext() && count < 1000) { files.next(); count++; }
    out.folders.push({ name: f.getName(), url: f.getUrl(), files: count, private: f.getName() === PRIVATE_UPLOADS_FOLDER_NAME });
  }
  out.folders.sort(function (a, b) { return a.name.localeCompare(b.name); });
  var docs = db_all_('Documents');
  out.documents = docs.length;
  out.publicDocuments = docs.filter(function (d) { return toBool_(d.published) && d.visibility === 'public'; }).length;
  return out;
}

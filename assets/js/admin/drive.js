/* HAMDI CAF — admin Documents upload/replace, Media library, Drive status,
   request attachments. Files are sent as base64 and checked again on the server. */

var ADMIN_MAX_UPLOAD = 20 * 1024 * 1024;

/** Reads a File into {name, base64}. Rejects files over `max` bytes before upload. */
function readFileBase64(file, max) {
  return new Promise(function (resolve, reject) {
    if (!file) return reject(new Error(t('doc.chooseFile')));
    if (file.size > max) return reject(new Error(tvA('doc.tooBig', { mb: Math.round(max / 1048576) })));
    var r = new FileReader();
    r.onload = function () { resolve({ name: file.name, base64: String(r.result).replace(/^data:[^,]*,/, '') }); };
    r.onerror = function () { reject(new Error(t('common.error'))); };
    r.readAsDataURL(file);
  });
}

/** Saves a {base64, mime, name} payload as a download in the browser. */
function saveBase64(d) {
  deliverFile(d.name || 'file', d.mime, d.base64);
}

/** Translates server file errors ("VALIDATION: file: type not allowed") for the admin. */
function fileError(err) {
  var m = (err && err.message) || '';
  if (/file: type not allowed/.test(m)) return t('doc.badType');
  if (/file: too large/.test(m)) return tvA('doc.tooBig', { mb: 20 });
  if (/file: (empty|unreadable|missing)/.test(m)) return t('doc.chooseFile');
  return null;
}

function fileSize(n) { n = Number(n || 0); return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function isImageDoc(d) { return /^image\//.test(String(d.mime || '')); }
function isPublicDoc(d) { return (d.published === true || d.published === 'TRUE') && d.visibility === 'public'; }
function thumbUrl(d) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(d.drive_file_id) + '&sz=w400'; }

/* ---- Upload page (documents and media) ------------------------------------------------- */
function renderDocumentUpload(imageMode) {
  var back = imageMode ? '#/media' : '#/documents';
  Promise.all([loadSource('categories'), loadSource('services')]).then(function () {
    $('#content').innerHTML =
      '<div class="toolbar"><a class="btn btn-sm btn-ghost" href="' + back + '">' + icon('arrow', 'back-arrow') + esc(t('ui.back')) + '</a></div>' +
      '<form class="card stack entity-form" id="up-form" novalidate><h2>' + esc(t(imageMode ? 'media.upload' : 'doc.upload')) + '</h2>' +
        '<div class="notice small">' + icon('info') + '<span>' + esc(t(imageMode ? 'media.hint' : 'doc.hint')) + '</span></div>' +
        '<div class="field"><label for="up-file">' + esc(t('doc.file')) + ' *</label>' +
          '<input class="input" type="file" id="up-file" required accept="' + (imageMode ? 'image/png,image/jpeg,image/webp' : '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.odt') + '">' +
          '<span class="hint">' + esc(tvA('doc.limits', { mb: 20 })) + '</span></div>' +
        langTabs() +
        '<div class="form-grid">' +
          fieldHtml({ k: 'title', label: 'f.title', ml: true, required: 'any' }, {}, true) +
          fieldHtml({ k: 'description', label: 'f.description', ml: true, type: 'textarea', rows: 2 }, {}, true) +
          fieldHtml({ k: 'category_id', label: 'f.category', type: 'select', source: 'categories' }, {}, true) +
          fieldHtml({ k: 'service_id', label: 'f.service', type: 'select', source: 'services' }, {}, true) +
          fieldHtml({ k: 'lang', label: 'f.lang', type: 'select', options: SUPPORTED_LANGS }, {}, true) +
          fieldHtml({ k: 'visibility', label: 'f.visibility', type: 'select', options: [['public', t('doc.visPublic')], ['admin', t('doc.visAdmin')]], required: true }, { visibility: imageMode ? 'public' : 'admin' }, true) +
          fieldHtml({ k: 'published', label: 'f.published', type: 'bool' }, { published: !!imageMode }, true) +
        '</div><div class="err" id="f-err" role="alert"></div>' +
        '<div class="row"><button class="btn btn-primary" type="submit">' + icon('upload') + esc(t('doc.uploadBtn')) + '</button><span class="small muted" id="up-progress"></span></div>' +
      '</form>';
    bindLangTabs();
    $('#up-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = e.target.querySelector('button[type=submit]');
      $('#f-err').textContent = '';
      readFileBase64($('#up-file').files[0], ADMIN_MAX_UPLOAD).then(function (file) {
        btn.disabled = true; $('#up-progress').textContent = t('doc.uploading');
        var meta = collectForm({ fields: [{ k: 'title', ml: true }, { k: 'description', ml: true }, { k: 'category_id' }, { k: 'service_id' }, { k: 'lang' }, { k: 'visibility' }, { k: 'published', type: 'bool' }] }, {});
        return api('api_admin_uploadDocument', session.token, meta, file);
      }).then(function (doc) {
        delete SOURCES.documents; delete SOURCES.images;
        toast(t('ui.saved'), 'success');
        navigate('#/documents/edit/' + encodeURIComponent(doc.id), route);
      }).catch(function (err) {
        btn.disabled = false; $('#up-progress').textContent = '';
        if (fileError(err)) $('#f-err').textContent = fileError(err);
        else if (/^VALIDATION/.test(err.message || '')) showFieldError(err); else $('#f-err').textContent = apiMsg(err);
      });
    });
  }).catch(handleApiError);
}

/* ---- File panel under the document metadata form ---------------------------------------- */
function documentFilePanel(doc, host, editable) {
  var pub = isPublicDoc(doc);
  host.innerHTML = '<div class="card stack"><h3>' + icon('file') + esc(t('doc.file')) + '</h3>' +
    '<dl class="dl">' + dlRow('f.fileName', doc.file_name) + dlRow('f.type', doc.mime) + dlRow('doc.size', fileSize(doc.size)) +
      dlRow('f.updatedAt', String(doc.updated_at || '').replace('T', ' ').slice(0, 16)) + '</dl>' +
    (isImageDoc(doc) && pub ? '<img class="doc-thumb" src="' + esc(thumbUrl(doc)) + '" alt="' + esc(tf(doc, 'title')) + '" loading="lazy">' : '') +
    '<div class="notice small ' + (pub ? 'success' : '') + '">' + icon(pub ? 'globe' : 'lock') + '<span>' + esc(t(pub ? 'doc.isPublic' : 'doc.isPrivate')) + '</span></div>' +
    '<div class="row"><button class="btn btn-sm" type="button" id="doc-dl">' + icon('download') + esc(t('doc.download')) + '</button>' +
      (pub ? '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(safeUrl('https://drive.google.com/file/d/' + doc.drive_file_id + '/view')) + '">' + icon('eye') + esc(t('doc.publicLink')) + '</a>' : '') + '</div>' +
    (editable ? '<form class="stack" id="doc-replace" novalidate><label class="small" for="rep-file"><strong>' + esc(t('doc.replace')) + '</strong> · ' + esc(t('doc.replaceHint')) + '</label>' +
      '<input class="input" type="file" id="rep-file"><div class="row"><button class="btn btn-sm" type="submit">' + icon('upload') + esc(t('doc.replace')) + '</button><span class="small muted" id="rep-progress"></span></div></form>' : '') +
    (canDelete('documents') ? '<button class="btn btn-sm btn-danger" type="button" id="doc-del">' + icon('trash') + esc(t('doc.delete')) + '</button>' : '') +
    '<div class="err" id="doc-err"></div></div>';
  $('#doc-dl').onclick = function () {
    api('api_admin_downloadDocument', session.token, doc.id).then(saveBase64).catch(function (e) { toast(apiMsg(e), 'error'); });
  };
  if ($('#doc-replace')) $('#doc-replace').addEventListener('submit', function (e) {
    e.preventDefault();
    readFileBase64($('#rep-file').files[0], ADMIN_MAX_UPLOAD).then(function (file) {
      $('#rep-progress').textContent = t('doc.uploading');
      return api('api_admin_replaceDocument', session.token, doc.id, file);
    }).then(function () { toast(t('ui.saved'), 'success'); delete SOURCES.images; route(); })
      .catch(function (err) { $('#rep-progress').textContent = ''; $('#doc-err').textContent = fileError(err) || apiMsg(err); });
  });
  if ($('#doc-del')) $('#doc-del').onclick = function () {
    confirmDialog(t('doc.delete'), t('doc.deleteConfirm'), t('ui.delete')).then(function (ok) {
      if (!ok) return;
      api('api_admin_deleteDocument', session.token, doc.id).then(function () {
        delete SOURCES.documents; delete SOURCES.images; toast(t('ui.deleted'), 'success'); navigate(isImageDoc(doc) ? '#/media' : '#/documents', route);
      }).catch(function (err) { $('#doc-err').textContent = apiMsg(err); });
    });
  };
}

/* ---- Media library: image documents as a grid ------------------------------------------- */
function renderMedia() {
  $('#content').innerHTML = '<div class="card"><div class="skeleton" style="height:240px"></div></div>';
  api('api_admin_list', session.token, 'documents', { limit: 500 }).then(function (r) {
    var imgs = r.items.filter(isImageDoc);
    $('#content').innerHTML = '<div class="notice small" style="margin-block-end:var(--s4)">' + icon('info') + '<span>' + esc(t('media.intro')) + '</span></div>' +
      '<div class="toolbar"><span class="spacer"></span>' + (canWrite('documents') ? '<a class="btn btn-sm btn-primary" href="#/media/new">' + icon('upload') + esc(t('media.upload')) + '</a>' : '') + '</div>' +
      (imgs.length ? '<div class="media-grid">' + imgs.map(function (d) {
        return '<a class="card card-sm interactive media-item" href="#/documents/edit/' + encodeURIComponent(d.id) + '">' +
          (isPublicDoc(d) ? '<img src="' + esc(thumbUrl(d)) + '" alt="' + esc(tf(d, 'title')) + '" loading="lazy">' : '<div class="media-private">' + icon('lock') + '</div>') +
          '<span class="small">' + esc(tf(d, 'title') || d.file_name) + '</span></a>';
      }).join('') + '</div>' : '<div class="card"><p class="muted" style="margin:0">' + esc(t('media.none')) + '</p></div>');
  }).catch(handleApiError);
}

/* ---- Drive status --------------------------------------------------------------------------- */
function renderDrive() {
  $('#content').innerHTML = '<div class="card"><div class="skeleton" style="height:240px"></div></div>';
  api('api_admin_driveStatus', session.token).then(function (st) {
    $('#content').innerHTML =
      '<div class="grid kpis">' + kpi('drive.documents', st.documents, 'file') + kpi('drive.public', st.publicDocuments, 'globe') + kpi('drive.folders', st.folders.length, 'drive') + '</div>' +
      '<div class="card stack" style="margin-block-start:var(--s5)"><h3>' + icon('drive') + esc(st.rootName) + '</h3>' +
        (st.rootPrivate ? '<div class="notice success small">' + icon('lock') + '<span>' + esc(t('drive.rootPrivate')) + '</span></div>'
          : '<div class="notice warning">' + icon('alert') + '<span>' + esc(t('drive.rootShared')) + ' (' + esc(st.rootSharing) + ')</span></div>') +
        '<p class="small muted">' + esc(t('drive.ownerOnly')) + '</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>' + esc(t('drive.folder')) + '</th><th>' + esc(t('drive.files')) + '</th><th></th></tr></thead><tbody>' +
        st.folders.map(function (f) {
          return '<tr><td>' + (f.private ? icon('lock') + ' ' : '') + esc(f.name) + '</td><td>' + f.files + '</td>' +
            '<td><a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(safeUrl(f.url)) + '">' + esc(t('drive.open')) + '</a></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(safeUrl(st.rootUrl)) + '">' + icon('drive') + esc(t('drive.openRoot')) + '</a></div>';
  }).catch(handleApiError);
}

/* ---- Request attachments (inside the request detail) ------------------------------------- */
function attachmentsHtml(a) {
  var list = parseJsonSafe(a.attachments_json, []);
  return '<div class="card stack"><h3>' + icon('file') + esc(t('att.title')) + '</h3>' +
    (list.length ? '<ul class="att-list">' + list.map(function (x) {
      return '<li><span>' + esc(x.name) + ' <span class="small muted">' + esc(fileSize(x.size)) + '</span></span>' +
        '<button class="btn btn-sm att-dl" type="button" data-file="' + esc(x.file_id) + '">' + icon('download') + esc(t('doc.download')) + '</button></li>';
    }).join('') + '</ul><p class="small muted">' + esc(t('att.retention')) + '</p>' : '<p class="small muted" style="margin:0">' + esc(t('att.none')) + '</p>') + '</div>';
}

function bindAttachments(apptId) {
  $$('.att-dl').forEach(function (b) {
    b.onclick = function () {
      b.disabled = true;
      api('api_admin_getAttachment', session.token, apptId, b.getAttribute('data-file')).then(saveBase64)
        .catch(function (e) { toast(apiMsg(e), 'error'); }).then(function () { b.disabled = false; });
    };
  });
}

/* ---- Lookup: images for category pictures ------------------------------------------------- */
var _loadSourceDrive = loadSource;
loadSource = function (entity) {
  if (entity !== 'images') return _loadSourceDrive(entity);
  if (SOURCES.images) return Promise.resolve(SOURCES.images);
  return api('api_admin_list', session.token, 'documents', { limit: 500 }).then(function (r) {
    return (SOURCES.images = r.items.filter(isImageDoc).map(function (d) {
      return { id: d.id, name: (tf(d, 'title') || d.file_name) + (isPublicDoc(d) ? '' : ' 🔒') };
    }));
  });
};

/* HAMDI CAF — generic admin list + form engine.
   Sections are described in Sections.html; the server validates everything
   again (this UI is a convenience, never the security boundary). */

var LANGS = SUPPORTED_LANGS; // ar, fr, en
var SOURCES = {}; // entity -> items (lookup lists for selects)

function permLevel(section) {
  var p = (session.admin && session.admin.permissions && session.admin.permissions[section]) || 'none';
  return ['none', 'read', 'write', 'delete'].indexOf(p);
}
/** Sub-sections (e.g. guidance-rules, payment_methods) use their parent's permission. */
function sectionPerm(section) {
  var cfg = window.SECTIONS && SECTIONS[section];
  return (cfg && cfg.perm) || (window.NAV_ALIAS && NAV_ALIAS[section]) || section;
}
function canWrite(section) { return permLevel(sectionPerm(section)) >= 2; }
function canDelete(section) { return permLevel(sectionPerm(section)) >= 3; }

function apiMsg(e) { return apiMessage(e); }

/** Loads a lookup list once per session (refreshed after saves of that entity). */
function loadSource(entity) {
  if (SOURCES[entity]) return Promise.resolve(SOURCES[entity]);
  return api('api_admin_list', session.token, entity, { limit: 500 }).then(function (r) { return (SOURCES[entity] = r.items); });
}
function sourceLabel(entity, rec) {
  if (!rec) return '';
  if (entity === 'cities') return rec.name + (rec.province ? ' (' + rec.province + ')' : '');
  if (entity === 'roles') return rec.name;
  return tf(rec, 'title') || tf(rec, 'name') || tf(rec, 'question') || rec.name || rec.key || rec.id;
}

function boolBadge(v) { return v === true || v === 'TRUE' ? '<span class="badge success">' + esc(t('ui.yes')) + '</span>' : '<span class="badge">' + esc(t('ui.no')) + '</span>'; }

/* ---- List ------------------------------------------------------------------------ */
var LIST_STATE = {};

/** The list request of a section (same object for the page and the prefetch). */
function listState(section) { return LIST_STATE[section] || { q: '', offset: 0, filters: {} }; }
function listArgs(cfg, st) { return { q: st.q, offset: st.offset, limit: 50, filters: st.filters, sort: cfg.sort, dir: cfg.dir }; }
function listSources(cfg) {
  return (cfg.cols || []).concat(cfg.filters || []).filter(function (x) { return x.source; }).map(function (x) { return x.source; });
}

function renderList(section, cfg) {
  var st = LIST_STATE[section] = listState(section);
  var c = $('#content');
  c.innerHTML = '<div class="card"><div class="skeleton" style="height:240px"></div></div>';
  // The list and its lookup lists are requested together, not one after the other.
  Promise.all([api('api_admin_list', session.token, cfg.entity, listArgs(cfg, st))].concat(listSources(cfg).map(loadSource))).then(function (all) {
    var res = all[0];
    var cols = cfg.cols;
    c.innerHTML =
      (cfg.intro ? '<div class="notice small" style="margin-block-end:var(--s4)">' + icon('info') + '<span>' + esc(t(cfg.intro)) + '</span></div>' : '') +
      '<div class="toolbar">' +
        '<form class="search" id="list-search">' + icon('search') + '<input class="input" id="list-q" type="search" placeholder="' + esc(t('ui.search')) + '" value="' + esc(st.q) + '"></form>' +
        (cfg.filters || []).map(function (f) {
          var opts = f.options || (SOURCES[f.source] || []).map(function (r) { return [r.id, sourceLabel(f.source, r)]; });
          return '<select class="select filter" data-k="' + f.k + '"><option value="">' + esc(t(f.label)) + ': ' + esc(t('ui.all')) + '</option>' +
            opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (st.filters[f.k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
        }).join('') +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" id="list-export">' + icon('download') + esc(t('ui.export')) + '</button>' +
        (!cfg.readOnly && !cfg.noCreate && canWrite(section) ? '<a class="btn btn-sm btn-primary" href="#/' + section + '/new">' + icon('plus') + esc(t('ui.new')) + '</a>' : '') +
      '</div>' +
      '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr>' +
        cols.map(function (col) { return '<th>' + esc(t(col.label)) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
        (res.items.length ? res.items.map(function (r) {
          var key = r[cfg.key || 'id'];
          return '<tr>' + cols.map(function (col) { return '<td>' + cellHtml(col, r) + '</td>'; }).join('') +
            '<td class="row-actions">' + (cfg.readOnly ? '<a class="btn btn-sm btn-ghost" href="#/' + section + '/view/' + encodeURIComponent(key) + '">' + icon('eye') + '</a>'
              : '<a class="btn btn-sm btn-ghost" href="#/' + section + '/edit/' + encodeURIComponent(key) + '" aria-label="' + esc(t('ui.edit')) + '">' + icon(canWrite(section) ? 'edit' : 'eye') + '</a>') + '</td></tr>';
        }).join('') : '<tr><td colspan="' + (cols.length + 1) + '" class="muted">' + esc(t('ui.empty')) + '</td></tr>') +
      '</tbody></table></div>' +
      '<div class="pager"><span class="small muted">' + esc(tvA('ui.count', { n: res.total })) + '</span><span class="spacer"></span>' +
        '<button class="btn btn-sm" id="pg-prev"' + (st.offset ? '' : ' disabled') + '>' + esc(t('ui.prev')) + '</button>' +
        '<button class="btn btn-sm" id="pg-next"' + (st.offset + 50 < res.total ? '' : ' disabled') + '>' + esc(t('ui.next')) + '</button></div></div>';
    $('#list-search').addEventListener('submit', function (e) { e.preventDefault(); st.q = $('#list-q').value.trim(); st.offset = 0; renderList(section, cfg); });
    $$('.filter').forEach(function (s) { s.onchange = function () { st.filters[s.getAttribute('data-k')] = s.value; st.offset = 0; renderList(section, cfg); }; });
    $('#pg-prev').onclick = function () { st.offset = Math.max(0, st.offset - 50); renderList(section, cfg); };
    $('#pg-next').onclick = function () { st.offset += 50; renderList(section, cfg); };
    $('#list-export').onclick = function () { exportCsv(section, res.items, cols); };
  }).catch(handleApiError);
}

function cellHtml(col, r) {
  var v = col.ml ? tf(r, col.k) : r[col.k];
  if (col.type === 'bool') return boolBadge(v);
  if (col.type === 'date') return '<span class="small">' + esc(String(v || '').replace('T', ' ').slice(0, 16)) + '</span>';
  if (col.source) return esc(sourceLabel(col.source, (SOURCES[col.source] || []).filter(function (x) { return x.id === v; })[0]) || v || '');
  if (col.type === 'money') return esc(formatMoney(Number(v || 0), 'EUR'));
  if (col.badge) return '<span class="badge ' + (col.badge[v] || '') + '">' + esc(v) + '</span>';
  return esc(String(v == null ? '' : v).slice(0, 120));
}

function tvA(key, vars) { return t(key).replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; }); }

/** CSV export of the current page. Cells are neutralised against spreadsheet formula injection. */
function exportCsv(name, items, cols) {
  var keys = [];
  cols.forEach(function (c) { if (c.ml) LANGS.forEach(function (l) { keys.push(c.k + '_' + l); }); else keys.push(c.k); });
  var cell = function (v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  var csv = '﻿' + [keys.map(cell).join(',')].concat(items.map(function (r) { return keys.map(function (k) { return cell(r[k]); }).join(','); })).join('\r\n');
  var b64 = btoa(unescape(encodeURIComponent(csv)));
  deliverFile('hamdi-' + name + '-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv;charset=utf-8', b64);
}

/**
 * Tapping anywhere on a table row opens it, like its ✏ button. On a phone that button
 * is in the last column, off-screen until the table is scrolled sideways.
 */
document.addEventListener('click', function (e) {
  var el = e.target;
  if (!el || !el.closest || el.closest('a, button, input, select, textarea, label')) return;
  var row = el.closest('.table tbody tr');
  var link = row && row.querySelector('a[href^="#/"]');
  if (link) link.click();
});

/**
 * Gives a file to the user. Inside the HAMDI CAF Admin Android app the WebView cannot save
 * page downloads, so the file goes to the app (window.HamdiApp), which saves it in
 * Downloads/HAMDI CAF. In a normal browser it is a regular download.
 */
function deliverFile(name, mime, base64) {
  if (window.HamdiApp && typeof window.HamdiApp.postMessage === 'function') {
    window.HamdiApp.postMessage(JSON.stringify({ type: 'file', name: name, mime: mime, base64: base64 }));
    return;
  }
  var bin = atob(base64), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
  a.download = name || 'file';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
}

/* ---- Form ------------------------------------------------------------------------------ */
function renderForm(section, cfg, id) {
  var c = $('#content');
  c.innerHTML = '<div class="card"><div class="skeleton" style="height:320px"></div></div>';
  var sources = cfg.fields.filter(function (f) { return f.source; }).map(function (f) { return f.source; });
  // Start what the form loads after its first part (e.g. a service's texts) right now.
  if (id && cfg.editPrefetch) cfg.editPrefetch(id);
  var getRec = id ? api('api_admin_list', session.token, cfg.entity, { filters: (function () { var o = {}; o[cfg.key || 'id'] = id; return o; })(), limit: 1 })
    .then(function (r) { if (!r.items.length) throw new Error('NOT_FOUND: Not found.'); return r.items[0]; }) : Promise.resolve(cfg.defaults ? Object.assign({}, cfg.defaults) : {});
  Promise.all([getRec].concat(sources.map(loadSource))).then(function (res) {
    var rec = res[0];
    var editable = !cfg.readOnly && canWrite(section);
    var hasMl = cfg.fields.some(function (f) { return f.ml; });
    c.innerHTML =
      '<div class="toolbar"><a class="btn btn-sm btn-ghost" href="#/' + section + '">' + icon('arrow', 'back-arrow') + esc(t('ui.back')) + '</a><span class="spacer"></span>' +
        (id && !cfg.readOnly && !cfg.noDelete && canDelete(section) ? '<button class="btn btn-sm btn-danger" id="f-delete">' + icon('trash') + esc(t('ui.delete')) + '</button>' : '') + '</div>' +
      '<form class="card stack entity-form" id="entity-form" novalidate>' +
        '<h2>' + esc(id ? (cfg.titleOf ? cfg.titleOf(rec) : (tf(rec, 'title') || tf(rec, 'name') || rec.name || rec.key || id)) : t('ui.new')) + '</h2>' +
        (cfg.formNote ? '<div class="notice small">' + icon('info') + '<span>' + esc(t(cfg.formNote)) + '</span></div>' : '') +
        (hasMl ? langTabs() : '') +
        '<div class="form-grid">' + cfg.fields.map(function (f) { return fieldHtml(f, rec, editable && !(f.readOnlyOnEdit && id)); }).join('') + '</div>' +
        '<div class="err" id="f-err" role="alert"></div>' +
        (editable ? '<div class="row"><button class="btn btn-primary" type="submit">' + esc(t('common.save')) + '</button></div>' : '<p class="small muted">' + esc(t('ui.readOnly')) + '</p>') +
      '</form>' + (cfg.after && id ? '<div id="form-after"></div>' : '');
    bindFieldWidgets();
    if (hasMl) bindLangTabs();
    if (!editable) $$('#entity-form input, #entity-form select, #entity-form textarea, #entity-form button.link-add, #entity-form button.link-del').forEach(function (n) { n.disabled = true; });
    if ($('#f-delete')) $('#f-delete').onclick = function () {
      confirmDialog(t('ui.delete'), t('ui.deleteConfirm'), t('ui.delete')).then(function (ok) {
        if (!ok) return;
        api('api_admin_delete', session.token, cfg.entity, id).then(function () {
          delete SOURCES[cfg.entity]; toast(t('ui.deleted'), 'success'); navigate('#/' + section, route);
        }).catch(function (e) { toast(apiMsg(e), 'error'); });
      });
    };
    $('#entity-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = collectForm(cfg, rec);
      var btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
      $$('.field .err').forEach(function (n) { n.textContent = ''; });
      $('#f-err').textContent = '';
      api('api_admin_save', session.token, cfg.entity, id || null, data).then(function (saved) {
        delete SOURCES[cfg.entity];
        toast(t('ui.saved'), 'success');
        var key = saved[cfg.key || 'id'];
        if (!id) navigate('#/' + section + '/edit/' + encodeURIComponent(key), route); else renderForm(section, cfg, id);
      }).catch(function (err) {
        btn.disabled = false;
        showFieldError(err);
      });
    });
    if (cfg.after && id) cfg.after(rec, $('#form-after'), editable);
  }).catch(handleApiError);
}

function showFieldError(err) {
  var m = (err && err.message) || '';
  var v = m.match(/^VALIDATION:\s*([a-z0-9_]+):\s*(.*)$/i);
  if (v) {
    var holder = $('[data-field="' + v[1] + '"]');
    if (holder) {
      var e = holder.querySelector('.err'); if (e) e.textContent = v[2];
      var lang = v[1].match(/_(it|en|fr|ar)$/);
      if (lang) selectLangTab(lang[1]);
      holder.scrollIntoView({ block: 'center' });
      return;
    }
  }
  $('#f-err').textContent = apiMsg(err);
}

function langTabs() {
  return '<div class="lang-tabs" role="tablist">' + LANGS.map(function (l, i) {
    return '<button type="button" class="btn btn-sm lang-tab' + (i === 0 ? ' active' : '') + '" data-lang="' + l + '" role="tab">' + l.toUpperCase() + '</button>';
  }).join('') + '</div>';
}
function bindLangTabs() { $$('.lang-tab').forEach(function (b) { b.onclick = function () { selectLangTab(b.getAttribute('data-lang')); }; }); selectLangTab(LANGS.indexOf(currentLang) >= 0 ? currentLang : LANGS[0]); }
function selectLangTab(l) {
  $$('.lang-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === l); });
  $$('[data-ml-lang]').forEach(function (n) { n.hidden = n.getAttribute('data-ml-lang') !== l; });
}

function fieldHtml(f, rec, editable) {
  var full = f.full || f.type === 'textarea' || f.type === 'links' || f.type === 'json' || f.type === 'multicheck';
  if (f.ml) {
    return LANGS.map(function (l) {
      var k = f.k + '_' + l;
      return '<div class="field' + (full ? ' full' : '') + '" data-field="' + k + '" data-ml-lang="' + l + '">' +
        '<label for="fld-' + k + '">' + esc(t(f.label)) + ' · ' + l.toUpperCase() + (f.required === true ? ' *' : '') + '</label>' +
        control(f, k, rec[k], l) + '<span class="err"></span></div>';
    }).join('');
  }
  return '<div class="field' + (full ? ' full' : '') + '" data-field="' + f.k + '">' +
    (f.type === 'bool' ? '' : '<label for="fld-' + f.k + '">' + esc(t(f.label)) + (f.required ? ' *' : '') + '</label>') +
    control(f, f.k, rec[f.k], null) + (f.hint ? '<span class="hint">' + esc(t(f.hint)) + (f.hintExtra ? ' ' + esc(f.hintExtra()) : '') + '</span>' : '') +
    '<span class="err"></span></div>';
}

function control(f, k, v, lang) {
  var dir = lang === 'ar' ? ' dir="rtl"' : (lang ? ' dir="ltr"' : '');
  var id = ' id="fld-' + k + '" name="' + k + '"';
  v = v == null ? '' : v;
  switch (f.type) {
    case 'textarea': return '<textarea class="textarea"' + id + dir + (f.rows ? ' rows="' + f.rows + '"' : '') + '>' + esc(v) + '</textarea>';
    case 'number': return '<input class="input" type="number" step="' + (f.step || '0.01') + '" min="' + (f.min == null ? 0 : f.min) + '"' + id + ' value="' + esc(v) + '" dir="ltr">';
    case 'bool': return '<label class="check"><input type="checkbox"' + id + (v === true || v === 'TRUE' ? ' checked' : '') + '><span>' + esc(t(f.label)) + '</span></label>';
    case 'select': {
      var opts = f.options ? f.options.map(function (o) { return Array.isArray(o) ? o : [o, o]; })
        : (SOURCES[f.source] || []).map(function (r) { return [r.id, sourceLabel(f.source, r)]; });
      return '<select class="select"' + id + '>' + (f.required ? '' : '<option value="">' + esc(t('ui.none')) + '</option>') +
        opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    }
    case 'multicheck': {
      var sel = parseJsonSafe(v, []);
      return '<div class="multicheck"' + id.replace('name=', 'data-name=') + ' data-multicheck="' + k + '">' + (SOURCES[f.source] || []).map(function (r) {
        return '<label class="check"><input type="checkbox" value="' + esc(r.id) + '"' + (sel.indexOf(r.id) >= 0 ? ' checked' : '') + '><span>' + esc(sourceLabel(f.source, r)) + '</span></label>';
      }).join('') + '</div>';
    }
    case 'links': {
      var links = parseJsonSafe(v, []);
      return '<div class="links-editor" data-links="' + k + '">' + links.map(linkRow).join('') + '</div>' +
        '<button type="button" class="btn btn-sm link-add" data-for="' + k + '">' + icon('plus') + esc(t('ui.addLink')) + '</button>';
    }
    case 'json': return '<textarea class="textarea mono"' + id + ' rows="3" dir="ltr" spellcheck="false">' + esc(v) + '</textarea>';
    default: return '<input class="input"' + id + dir + ' value="' + esc(v) + '"' + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + (f.ltr ? ' dir="ltr"' : '') + '>';
  }
}

function linkRow(l) {
  return '<div class="link-row"><input class="input" placeholder="' + esc(t('f.name')) + '" value="' + esc(l.label || '') + '" data-part="label">' +
    '<input class="input" placeholder="https://…" dir="ltr" value="' + esc(l.url || '') + '" data-part="url">' +
    '<button type="button" class="btn btn-icon btn-ghost link-del" aria-label="' + esc(t('ui.remove')) + '">' + icon('close') + '</button></div>';
}

function bindFieldWidgets() {
  $$('.link-add').forEach(function (b) {
    b.onclick = function () {
      var host = $('[data-links="' + b.getAttribute('data-for') + '"]');
      host.insertAdjacentHTML('beforeend', linkRow({}));
      bindFieldWidgets();
    };
  });
  $$('.link-del').forEach(function (b) { b.onclick = function () { b.parentNode.remove(); }; });
}

function parseJsonSafe(v, fb) { if (!v) return fb; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return fb; } }

/** Reads the form into the payload the server expects (all fields of the entity). */
function collectForm(cfg, rec) {
  var out = {};
  cfg.fields.forEach(function (f) {
    var keys = f.ml ? LANGS.map(function (l) { return f.k + '_' + l; }) : [f.k];
    keys.forEach(function (k) {
      if (f.type === 'multicheck') {
        out[k] = JSON.stringify($$('[data-multicheck="' + k + '"] input:checked').map(function (i) { return i.value; }));
      } else if (f.type === 'links') {
        out[k] = JSON.stringify($$('[data-links="' + k + '"] .link-row').map(function (row) {
          return { label: row.querySelector('[data-part=label]').value.trim(), url: row.querySelector('[data-part=url]').value.trim() };
        }).filter(function (l) { return l.label || l.url; }));
      } else {
        var el = document.getElementById('fld-' + k);
        if (!el) return;
        out[k] = f.type === 'bool' ? el.checked : el.value;
      }
    });
  });
  // Keep fields the form does not show (e.g. hidden settings), so a save never wipes them.
  (cfg.keep || []).forEach(function (k) { if (!(k in out)) out[k] = rec[k]; });
  return out;
}

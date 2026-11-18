(function () {
  var root = document.documentElement;
  root.classList.add('hi-pickers');
  var open = null; // { panel, backdrop, field }

  var TEXT = {
    ar: { today: 'اليوم', prev: 'الشهر السابق', next: 'الشهر التالي' },
    fr: { today: 'Aujourd’hui', prev: 'Mois précédent', next: 'Mois suivant' },
    en: { today: 'Today', prev: 'Previous month', next: 'Next month' }
  };
  function lang() { var l = (root.lang || 'ar').slice(0, 2); return TEXT[l] ? l : 'en'; }
  function tx(k) { return TEXT[lang()][k]; }
  function isPhone() { return window.matchMedia('(max-width: 640px)').matches; }
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function isPickable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === 'SELECT') return el.classList.contains('select') && !el.multiple;
    return el.tagName === 'INPUT' && el.type === 'date' && el.classList.contains('input');
  }

  function fieldLabel(el) {
    if (el.id) {
      var l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
      if (l) return l.textContent.trim();
    }
    var wrap = el.closest('label');
    if (wrap) return wrap.textContent.replace(el.textContent || '', '').trim();
    return el.getAttribute('aria-label') || el.title || '';
  }

  function close(refocus) {
    if (!open) return;
    var f = open.field;
    open.panel.remove(); open.backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onViewport);
    open = null;
    if (refocus && f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
  }

  function onViewport() { close(false); }

  function commit(field, value) {
    if (field.value !== value) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close(true);
  }

  /** Shows panel as a bottom sheet (phones) or under the field (larger screens). */
  function show(field, inner, title) {
    close(false);
    var backdrop = document.createElement('div');
    backdrop.className = 'pk-backdrop';
    var panel = document.createElement('div');
    panel.className = 'pk-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (title) panel.setAttribute('aria-label', title);
    panel.dir = root.dir || 'auto';
    var sheet = isPhone();
    if (sheet) {
      panel.classList.add('pk-sheet');
      panel.innerHTML = '<div class="pk-grip" aria-hidden="true"></div>' + (title ? '<div class="pk-title">' + h(title) + '</div>' : '') + inner;
    } else {
      panel.innerHTML = inner;
    }
    backdrop.addEventListener('click', function () { close(true); });
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    if (!sheet) {
      var r = field.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      var w = Math.max(r.width, panel.classList.contains('pk-calendar') ? 320 : 220);
      w = Math.min(w, vw - 16);
      panel.style.width = w + 'px';
      var below = vh - r.bottom - 12, above = r.top - 12;
      var maxH = Math.max(below, above, 160);
      panel.style.maxHeight = Math.min(maxH, 420) + 'px';
      var ph = Math.min(panel.scrollHeight, Math.min(maxH, 420));
      var top = (below >= ph || below >= above) ? r.bottom + 6 : r.top - 6 - ph;
      var left = root.dir === 'rtl' ? r.right - w : r.left;
      panel.style.top = Math.max(8, top) + 'px';
      panel.style.left = Math.min(Math.max(8, left), vw - w - 8) + 'px';
      backdrop.style.background = 'transparent';
    }
    open = { panel: panel, backdrop: backdrop, field: field };
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { window.addEventListener('resize', onViewport); }, 300);
    return panel;
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'Tab') { close(false); return; }
    var items = Array.prototype.slice.call(open.panel.querySelectorAll('.pk-opt:not([disabled]), .pk-day:not([disabled])'));
    var i = items.indexOf(document.activeElement);
    var grid = open.panel.querySelector('.pk-grid');
    var step = { ArrowDown: grid ? 7 : 1, ArrowUp: grid ? -7 : -1, ArrowRight: grid ? (root.dir === 'rtl' ? -1 : 1) : 0, ArrowLeft: grid ? (root.dir === 'rtl' ? 1 : -1) : 0 }[e.key];
    if (step) {
      e.preventDefault();
      var n = i < 0 ? 0 : Math.min(items.length - 1, Math.max(0, i + step));
      if (items[n]) items[n].focus();
    }
  }

  /* ---- Select ------------------------------------------------------------------------- */
  function openSelect(sel) {
    var html = '<div role="listbox">', current = sel.value;
    Array.prototype.forEach.call(sel.children, function (node) {
      if (node.tagName === 'OPTGROUP') {
        html += '<div class="pk-group" role="presentation">' + h(node.label) + '</div>';
        Array.prototype.forEach.call(node.children, function (o) { html += optHtml(o, current, node.disabled); });
      } else if (node.tagName === 'OPTION') {
        html += optHtml(node, current, false);
      }
    });
    html += '</div>';
    var panel = show(sel, html, fieldLabel(sel));
    panel.querySelector('[role=listbox]').addEventListener('click', function (e) {
      var b = e.target.closest('.pk-opt');
      if (b && !b.disabled) commit(sel, b.getAttribute('data-v'));
    });
    var focusEl = panel.querySelector('.pk-opt[aria-selected="true"]') || panel.querySelector('.pk-opt:not([disabled])');
    if (focusEl) { focusEl.scrollIntoView({ block: 'center' }); focusEl.focus({ preventScroll: true }); }
  }

  function optHtml(o, current, groupDisabled) {
    if (o.hidden) return '';
    var sel = o.value === current;
    return '<button type="button" class="pk-opt" role="option" data-v="' + h(o.value) + '" aria-selected="' + sel + '"' +
      (o.disabled || groupDisabled ? ' disabled' : '') + '><span class="pk-radio" aria-hidden="true"></span><span class="pk-label">' + h(o.textContent) + '</span></button>';
  }

  /* ---- Date --------------------------------------------------------------------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }

  function openDate(input, month) {
    var value = parse(input.value), today = new Date();
    var view = month || new Date((value || today).getFullYear(), (value || today).getMonth(), 1);
    var min = parse(input.min), max = parse(input.max);
    var loc = lang() === 'ar' ? 'ar-u-nu-latn' : lang();
    var title;
    try { title = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(view); } catch (e) { title = view.getFullYear() + '-' + pad(view.getMonth() + 1); }
    var wd = [];
    for (var k = 0; k < 7; k++) {
      var d0 = new Date(2024, 0, 1 + k); // 1 Jan 2024 is a Monday
      try { wd.push(new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(d0)); } catch (e) { wd.push('MTWTFSS'[k]); }
    }
    var first = (view.getDay() + 6) % 7; // Monday first
    var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    var html = '<div class="pk-cal"><div class="pk-cal-head">' +
      '<button type="button" class="pk-nav" data-m="-1" aria-label="' + h(tx('prev')) + '">' + (root.dir === 'rtl' ? '›' : '‹') + '</button>' +
      '<strong aria-live="polite">' + h(title) + '</strong>' +
      '<button type="button" class="pk-nav" data-m="1" aria-label="' + h(tx('next')) + '">' + (root.dir === 'rtl' ? '‹' : '›') + '</button></div>' +
      '<div class="pk-grid" role="grid">' + wd.map(function (w) { return '<div class="pk-wd" aria-hidden="true">' + h(w) + '</div>'; }).join('');
    for (var b = 0; b < first; b++) html += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var date = new Date(view.getFullYear(), view.getMonth(), d), v = iso(date);
      var off = (min && date < min) || (max && date > max);
      html += '<button type="button" class="pk-day' + (v === iso(today) ? ' pk-today' : '') + '" data-v="' + v + '" aria-selected="' + (value && v === iso(value)) + '"' +
        (off ? ' disabled' : '') + ' aria-label="' + h(v) + '">' + d + '</button>';
    }
    html += '</div><div class="pk-cal-foot"><button type="button" class="btn btn-sm pk-todaybtn">' + h(tx('today')) + '</button></div></div>';
    var panel = show(input, html, fieldLabel(input));
    panel.classList.add('pk-calendar');
    panel.addEventListener('click', function (e) {
      var nav = e.target.closest('.pk-nav');
      if (nav) { openDate(input, new Date(view.getFullYear(), view.getMonth() + Number(nav.getAttribute('data-m')), 1)); var again = open && open.panel.querySelector('.pk-nav[data-m="' + nav.getAttribute('data-m') + '"]'); if (again) again.focus(); return; }
      if (e.target.closest('.pk-todaybtn')) { commit(input, iso(today)); return; }
      var day = e.target.closest('.pk-day');
      if (day && !day.disabled) commit(input, day.getAttribute('data-v'));
    });
    if (!month) {
      var f = panel.querySelector('.pk-day[aria-selected="true"]') || panel.querySelector('.pk-day.pk-today') || panel.querySelector('.pk-day:not([disabled])');
      if (f) f.focus({ preventScroll: true });
    }
  }

  function openFor(el) { if (el.tagName === 'SELECT') openSelect(el); else openDate(el); }

  /* Taps: the native fields ignore the pointer (CSS above), so find the field under it. */
  document.addEventListener('click', function (e) {
    if (open || e.defaultPrevented) return;
    var x = e.clientX, y = e.clientY;
    if (!x && !y) return; // keyboard-generated click
    var fields = document.querySelectorAll('select.select:not([multiple]), input.input[type="date"]');
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (!isPickable(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.width && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        e.preventDefault();
        openFor(el);
        return;
      }
    }
  }, true);

  /* Keyboard: Enter, Space, Alt+ArrowDown or F4 on a focused field opens the themed picker. */
  document.addEventListener('keydown', function (e) {
    var el = e.target;
    if (open || !isPickable(el)) return;
    var isSelect = el.tagName === 'SELECT';
    if (e.key === 'Enter' || e.key === 'F4' || (e.altKey && e.key === 'ArrowDown') || (isSelect && e.key === ' ')) {
      e.preventDefault();
      openFor(el);
    }
  });

  window.closePicker = function () { close(false); };
})();

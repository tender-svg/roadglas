/* The repeating parts of the solution template page (solution-reference.html, address /product-detail-<name>.html):
 *   figures strip, key feature cards, product type tabs, coating items, application table (rows / columns), installation steps and the Q&A.
 * Each one is a list that is drawn here from the data saved for THIS solution page (page element "tpl-<name>", a JSON text) or from the defaults below
 * (the Q&A starts with the questions of the Paving Mat page). In edit mode every item is editable in place and has a remove button, and every list has an
 * "add" button; SAVE (js/cms.js) stores the changed lists. Visitors only get the drawn page.
 * js/rg-content.js (solutionRef) calls RGTPL.init(pageName, savedRows).
 */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var editing = function () { return !!(window.RGCMS && window.RGCMS.editing); };
  var LABEL = { stats: 'Figures', features: 'Key features', types: 'Product types', coating: 'Coating', table: 'Application table', steps: 'Installation steps', faq: 'Q&A' };

  var FAQ = [
    ['Is construction traffic allowed on the products during installation?', 'Necessary construction traffic is permitted. Steel drum rollers are prohibited.'],
    ['Is public/transportation traffic allowed on the products during installation?', 'Minimal traffic is allowed; however, product should be covered by asphalt same day to minimize damage to the material.'],
    ['How many linear lane miles can be installed on a standard 8-hour day?', 'An Industrial Fabrics, Inc. crew can install up to 4 to 6 miles of ROADGLAS® PM per day.'],
    ['Can installed material stay uncovered overnight?', 'It is recommended that asphalt be applied over installed material same day or within 24 hours of installation. If left unpaved, material must be coned off from traffic, or light sanding applied on top before traffic is allowed.'],
    ['How do I repair damaged material?', 'Cut out as much damaged material as possible, retack area and install new material overlapping 6-8 inches.'],
    ['What if material gets rained on?', 'Cease paving operations, no traffic allowed, wait until material is completely dry and then begin paving.']
  ];
  var rep = function (n, f) { var a = []; for (var i = 0; i < n; i++) a.push(f(i)); return a; };
  var DEF = {
    stats: function () { return rep(3, function () { return { v: '00', l: 'Figure label (Placeholder)' }; }); },
    features: function () { return rep(3, function () { return { t: 'Feature title (Placeholder)', d: 'Describe this feature. (Placeholder)' }; }); },
    types: function () { return [{ n: 'Type I', b: 'T1', t: 'Type I (Placeholder)', d: 'Describe this product type. (Placeholder)' }, { n: 'Type II', b: 'T2', t: 'Type II (Placeholder)', d: 'Describe this product type. (Placeholder)' }]; },
    coating: function () { return rep(3, function () { return { t: 'Title (Placeholder)', d: 'Describe it. (Placeholder)' }; }); },
    table: function () { return { cols: ['Column 1', 'Column 2', 'Column 3'], rows: rep(3, function () { return ['Row label', 'Value', 'Value']; }) }; },
    steps: function () { return rep(3, function () { return 'Describe this step. (Placeholder)'; }); },
    faq: function () { return FAQ.map(function (x) { return { q: x[0], a: x[1] }; }); }
  };
  var valid = function (n, d) {
    if (n === 'table') return d && Array.isArray(d.cols) && Array.isArray(d.rows) && d.rows.every(Array.isArray);
    return Array.isArray(d);
  };

  var state = {}, dirty = {}, pslug = '', cur = 0, started = false;
  // sections that are switched off for this solution in the Dashboard (page element "tpl-sections": { "types": false, ... }; no entry = shown)
  function sections(rows) {
    var off = {}; (rows || []).forEach(function (r) { if (r.element_id === 'tpl-sections') { try { off = JSON.parse(r.content_value) || {}; } catch (e) { /* all shown */ } } });
    [].slice.call(document.querySelectorAll('[data-tsec]')).forEach(function (el) { el.style.display = off[el.getAttribute('data-tsec')] === false ? 'none' : ''; });
  }
  var mark = function (n) { dirty[n] = true; if (window.RGCMS && RGCMS.refresh) RGCMS.refresh(); };

  /* ----- markup helpers (only produce anything in edit mode) */
  var ed = function (n, i, f, extra) { return editing() ? ' contenteditable="true" spellcheck="false" data-tp="' + n + '" data-ti="' + i + '"' + (f != null ? ' data-tf="' + f + '"' : '') + (extra || '') : ''; };
  var rel = function () { return editing() ? ' style="position:relative"' : ''; };
  var xBtn = function (n, i, what, extra) { return editing() ? '<button type="button" class="tp-x" data-tact="del" data-tp="' + n + '" data-ti="' + i + '"' + (extra || '') + ' title="Remove this ' + what + '">×</button>' : ''; };
  var addBtn = function (n, label, act) { return editing() ? '<button type="button" class="dyn-add tp-add" data-tact="' + (act || 'add') + '" data-tp="' + n + '">＋ ' + label + '</button>' : ''; };
  var cell = function (inner) { return editing() ? '<div style="display:flex;align-items:center;justify-content:center;padding:14px">' + inner + '</div>' : ''; };
  var num = function (i) { return ('0' + (i + 1)).slice(-2); };

  /* ----- one renderer per list */
  var RENDER = {
    stats: function (d) { return d.map(function (s, i) { return '<div class="rg-101"' + rel() + '><div class="rg-102"' + ed('stats', i, 'v') + '>' + esc(s.v) + '</div><div class="rg-103"' + ed('stats', i, 'l') + '>' + esc(s.l) + '</div>' + xBtn('stats', i, 'figure') + '</div>'; }).join('') + cell(addBtn('stats', 'Add figure')); },
    features: function (d) { return d.map(function (c, i) { return '<div class="rg-110"' + rel() + '><div class="rg-111">' + num(i) + '</div><h3 class="rg-112"' + ed('features', i, 't') + '>' + esc(c.t) + '</h3><p class="rg-36"' + ed('features', i, 'd') + '>' + esc(c.d) + '</p>' + xBtn('features', i, 'feature') + '</div>'; }).join('') + cell(addBtn('features', 'Add feature')); },
    coating: function (d) { return d.map(function (c, i) { return '<div class="rg-127"' + rel() + '><div class="rg-128">' + num(i) + '</div><h3 class="rg-129"' + ed('coating', i, 't') + '>' + esc(c.t) + '</h3><p class="rg-130"' + ed('coating', i, 'd') + '>' + esc(c.d) + '</p>' + xBtn('coating', i, 'item') + '</div>'; }).join('') + cell(addBtn('coating', 'Add item')); },
    steps: function (d) { return d.map(function (t, i) { return '<div class="rg-141"' + rel() + '><span class="rg-142">' + (i + 1) + '</span><p class="rg-143"' + ed('steps', i) + '>' + esc(t) + '</p>' + (editing() ? '<button type="button" class="app-x" data-tact="del" data-tp="steps" data-ti="' + i + '" title="Remove this step" style="color:#2C2E35;background:rgba(0,0,0,.08)">×</button>' : '') + '</div>'; }).join('') + addBtn('steps', 'Add step'); },
    faq: function (d) {
      return d.map(function (x, i) {
        return '<details class="rg-150"' + (editing() ? ' open' : '') + rel() + '><summary class="rg-151"><span' + ed('faq', i, 'q') + '>' + esc(x.q) + '</span><span class="rg-152"></span></summary><p class="rg-153"' + ed('faq', i, 'a') + '>' + esc(x.a) + '</p>' + (editing() ? '<button type="button" class="tp-x" data-tact="del" data-tp="faq" data-ti="' + i + '" title="Remove this question" style="top:20px;right:64px">×</button>' : '') + '</details>';
      }).join('') + (editing() ? '<div style="padding:16px 26px">' + addBtn('faq', 'Add question') + '</div>' : '');
    },
    table: function (d) {
      var n = d.cols.length, grid = ' style="grid-template-columns:' + (n === 3 ? '1fr 1.3fr 1.5fr' : 'repeat(' + Math.max(1, n) + ',1fr)') + (editing() ? ';position:relative' : '') + '"';
      var head = '<div class="rg-135"' + grid + '>' + d.cols.map(function (c, j) { return '<span class="rg-136"' + (editing() ? ' style="position:relative;padding-right:30px"' : '') + '><span' + ed('table', 0, null, ' data-tr="h" data-tc="' + j + '"') + '>' + esc(c) + '</span>' + (editing() && n > 1 ? '<button type="button" class="tp-x" data-tact="delcol" data-tp="table" data-tc="' + j + '" title="Remove this column" style="top:50%;right:2px;margin-top:-13px;width:22px;height:22px;background:#fff;color:#E52C1A">×</button>' : '') + '</span>'; }).join('') + '</div>';
      var body = d.rows.map(function (r, i) {
        return '<div class="rg-137"' + grid + '>' + d.cols.map(function (c, j) { return '<span class="' + (j === 0 ? 'rg-138' : 'rg-136') + '"' + ed('table', 0, null, ' data-tr="' + i + '" data-tc="' + j + '"') + '>' + esc(r[j] == null ? '' : r[j]) + '</span>'; }).join('') + (editing() ? '<button type="button" class="tp-x" data-tact="delrow" data-tp="table" data-tr="' + i + '" title="Remove this row" style="top:50%;right:6px;margin-top:-13px">×</button>' : '') + '</div>';
      }).join('');
      return head + body + (editing() ? '<div style="display:flex;gap:10px;flex-wrap:wrap;padding:12px;border-top:1px solid #ECECED">' + addBtn('table', 'Add row', 'addrow') + addBtn('table', 'Add column', 'addcol') + '</div>' : '');
    },
    types: function (d) {
      if (!d.length) return editing() ? '<div class="rg-116">' + addBtn('types', 'Add product type') + '</div>' : '';
      if (cur >= d.length) cur = d.length - 1; var t = d[cur];
      var tabs = d.map(function (x, i) {
        var on = i === cur, st = "border:2px solid #E52C1A;background:" + (on ? '#E52C1A;color:#fff' : 'transparent;color:#2C2E35') + ";padding:18px 28px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:0.04em;font-size:20px";
        return '<span' + (editing() ? ' style="position:relative;display:inline-block"' : '') + '><button type="button" data-ttab="' + i + '" style="' + st + '"' + ed('types', i, 'n') + '>' + esc(x.n) + '</button>' + (editing() && d.length > 1 ? '<button type="button" class="tp-x" data-tact="del" data-tp="types" data-ti="' + i + '" title="Remove this type" style="top:-10px;right:-10px;width:22px;height:22px">×</button>' : '') + '</span>';
      }).join('');
      return '<div class="rg-116">' + tabs + addBtn('types', 'Add product type') + '</div><div class="rg-117"><div class="rg-118"' + ed('types', cur, 'b') + '>' + esc(t.b) + '</div><div class="rg-119"><div class="rg-86"' + ed('types', cur, 't') + '>' + esc(t.t) + '</div><p class="rg-120"' + ed('types', cur, 'd') + '>' + esc(t.d) + '</p></div></div><div class="rg-121"><button data-href="resources.html" class="rg-122 hv-4">View Resources →</button></div>';
    }
  };
  function draw(n) { var host = $('[data-tpl="' + n + '"]'); if (host && state[n]) host.innerHTML = RENDER[n](state[n]); }
  function drawAll() { Object.keys(RENDER).forEach(draw); if (!editing()) [].slice.call(document.querySelectorAll('details.rg-150')).forEach(function (d) { d.open = false; }); }

  /* ----- changes */
  var NEW = {
    stats: function () { return { v: '00', l: 'Figure label (Placeholder)' }; }, features: function () { return { t: 'Feature title (Placeholder)', d: 'Describe this feature. (Placeholder)' }; },
    coating: function () { return { t: 'Title (Placeholder)', d: 'Describe it. (Placeholder)' }; }, steps: function () { return 'Describe this step. (Placeholder)'; },
    faq: function () { return { q: 'New question (Placeholder)', a: 'Answer. (Placeholder)' }; },
    types: function (d) { var k = d.length + 1; return { n: 'Type ' + k, b: 'T' + k, t: 'Type ' + k + ' (Placeholder)', d: 'Describe this product type. (Placeholder)' }; }
  };
  function setText(el) {
    var n = el.getAttribute('data-tp'), d = state[n], i = +el.getAttribute('data-ti'), f = el.getAttribute('data-tf'), t = el.textContent.split(String.fromCharCode(160)).join(' ');
    if (!d) return;
    if (n === 'table') { var tr = el.getAttribute('data-tr'), tc = +el.getAttribute('data-tc'); if (tr === 'h') d.cols[tc] = t; else d.rows[+tr][tc] = t; }
    else if (n === 'steps') d[i] = t; else if (d[i]) d[i][f] = t;
    mark(n);
  }
  function act(btn) {
    var a = btn.getAttribute('data-tact'), n = btn.getAttribute('data-tp'), d = state[n], i = +btn.getAttribute('data-ti'), focus = null;
    if (a === 'add') { d.push(NEW[n](d)); if (n === 'types') cur = d.length - 1; focus = '[data-tp="' + n + '"][data-ti="' + (d.length - 1) + '"]'; }
    else if (a === 'del') { RGDialog.confirm({ title: 'Remove this item?', message: 'It is removed from the page when you press SAVE.', ok: 'Remove', danger: true }).then(function (go) { if (!go) return; d.splice(i, 1); if (n === 'types' && cur >= d.length) cur = Math.max(0, d.length - 1); mark(n); draw(n); }); return; }
    else if (a === 'addrow') { d.rows.push(d.cols.map(function (c, j) { return j === 0 ? 'Row label' : 'Value'; })); }
    else if (a === 'delrow') { d.rows.splice(+btn.getAttribute('data-tr'), 1); }
    else if (a === 'addcol') { d.cols.push('Column ' + (d.cols.length + 1)); d.rows.forEach(function (r) { r.push('Value'); }); }
    else if (a === 'delcol') { var c = +btn.getAttribute('data-tc'); d.cols.splice(c, 1); d.rows.forEach(function (r) { r.splice(c, 1); }); }
    mark(n); draw(n);
    if (focus) { var el = $(focus); if (el) el.focus(); }
  }

  function bind() {
    document.addEventListener('input', function (e) { var el = e.target.closest && e.target.closest('[data-tp][contenteditable="true"]'); if (el && editing()) setText(el); });
    document.addEventListener('keydown', function (e) {
      var el = e.target.closest && e.target.closest('[data-tp][contenteditable="true"]'); if (!el || !editing()) return;
      if (e.key === 'Enter') e.preventDefault();
      else if (e.key === ' ' && el.tagName === 'BUTTON') { e.preventDefault(); document.execCommand('insertText', false, ' '); }
    });
    document.addEventListener('paste', function (e) { var el = e.target.closest && e.target.closest('[data-tp][contenteditable="true"]'); if (!el || !editing()) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\n\s*/g, ' ')); });
    document.addEventListener('click', function (e) {
      if (!editing() && !e.target.closest('[data-ttab]')) return;
      var b = e.target.closest && e.target.closest('[data-tact]'); if (b) { e.preventDefault(); e.stopPropagation(); act(b); return; }
      var tab = e.target.closest && e.target.closest('[data-ttab]');
      if (tab) { var i = +tab.getAttribute('data-ttab'); if (i !== cur) { cur = i; draw('types'); } return; }
      var sum = e.target.closest && e.target.closest('details.rg-150 > summary'); if (sum && editing()) e.preventDefault();   // all answers stay open while editing
    }, true);
    document.addEventListener('rg-edit-mode', drawAll);
  }

  function register() {
    if (!(window.RGCMS && RGCMS.registerHook)) { setTimeout(register, 100); return; }
    RGCMS.registerHook('tpl', {
      count: function () { return Object.keys(dirty).length; },
      run: function () {
        var names = Object.keys(dirty), log = {}, p = Promise.resolve(); if (window.RGE) RGE.pending = false;
        names.forEach(function (n) {
          p = p.then(function () { return RGE.api('POST', 'page-elements', { page_slug: pslug, element_id: 'tpl-' + n, content_type: 'text', content_value: JSON.stringify(state[n]) }); })
            .then(function () { delete dirty[n]; log[LABEL[n]] = 'Updated'; });
        });
        return p.then(function () { return RGE.pending ? null : RGE.history(pslug, log); }).then(function () { return names.length; });
      }
    });
  }

  window.RGTPL = {
    // pageName = the page name of this solution page (product-detail-<name>), rows = its saved page elements
    init: function (pageName, rows) {
      pslug = pageName; var saved = {};
      (rows || []).forEach(function (r) { if (/^tpl-/.test(r.element_id || '')) { try { saved[r.element_id.slice(4)] = JSON.parse(r.content_value); } catch (e) { /* use the default */ } } });
      Object.keys(DEF).forEach(function (n) { state[n] = valid(n, saved[n]) ? saved[n] : DEF[n](); });
      dirty = {}; sections(rows); drawAll();
      if (!started) { started = true; bind(); register(); }
    }
  };
})();

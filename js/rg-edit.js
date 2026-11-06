/* RoadGlas inline editing of the CMS lists (applications, solutions, project highlights, resources).
 * A small framework used by js/rg-content.js:
 *   RGE.store(cfg)      one list of items in memory (edited on the page) + what has to be saved: changed items, new items, removed items.
 *                       It joins the SAVE button of the admin bar (js/cms.js: RGCMS.registerHook).
 *   RGE.bind(host, st, o)   makes the markup inside `host` editable with plain attributes, so every list only has to draw its HTML:
 *        data-e="field" data-id="<id>"          text (contenteditable) / input / select / checkbox bound to item[field]
 *        data-arr="field" data-i="n" data-id    one point of a list field (item[field][n]); Enter adds a point, Backspace on an empty one removes it
 *        data-eact="photo|photo-add|file|addarr|rmarr|add|del"  buttons (photo / file upload, add / remove a point, add / delete an item)
 * Only active while the admin is in edit mode (RGCMS.editing); visitors just get the drawn page.
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var RGE = window.RGE = {};
  RGE.editing = function () { return !!(window.RGCMS && window.RGCMS.editing); };
  /* formatted text (colour / font / size / bold / italic from the text toolbar) lives in the same text field as a small piece of HTML.
   rich() draws it safely (only span / b / i / u / br with a few style properties survive), plain() is the text without the tags, clean() turns what the
   editor shows back into the stored value (plain text stays plain text). */
  var RICH_TAG = /<(span|b|i|u|strong|em|br)[\s>\/]/i, KEEP_STYLE = /^(color|font-family|font-size|font-weight|font-style|text-decoration|text-align|display)$/;
  var escText = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function sanitizeNode(src, dst) {
    [].slice.call(src.childNodes).forEach(function (n) {
      if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toLowerCase();
      if (tag === 'br') { dst.appendChild(document.createElement('br')); return; }
      if (!/^(span|b|i|u|strong|em|font)$/.test(tag)) { sanitizeNode(n, dst); return; }   // any other tag: keep its text only
      var o = document.createElement(tag === 'font' ? 'span' : tag);
      if (tag === 'font') { if (n.getAttribute('color')) o.style.color = n.getAttribute('color'); if (n.getAttribute('face')) o.style.fontFamily = n.getAttribute('face'); }
      for (var i = 0; i < n.style.length; i++) {
        var p = n.style[i], v = n.style.getPropertyValue(p);
        if (KEEP_STYLE.test(p) && !/url\s*\(|expression|javascript:|[<>]/i.test(v)) o.style.setProperty(p, v, n.style.getPropertyPriority(p));
      }
      sanitizeNode(n, o); dst.appendChild(o);
    });
  }
  var parse = function (html) { var t = document.createElement('template'); t.innerHTML = html; var out = document.createElement('div'); sanitizeNode(t.content, out); return out; };
  RGE.isRich = function (s) { return RICH_TAG.test(String(s == null ? '' : s)); };
  RGE.rich = function (s) { s = String(s == null ? '' : s); return RICH_TAG.test(s) ? parse(s).innerHTML : escText(s); };
  RGE.plain = function (s) { s = String(s == null ? '' : s); return RICH_TAG.test(s) ? parse(s).textContent : s; };
  RGE.clean = function (el) {
    var out = parse(el.innerHTML), hasTag = !!out.querySelector('span,b,i,u,strong,em,br');
    [].slice.call(out.querySelectorAll('span')).forEach(function (sp) { if (!sp.getAttribute('style') && sp.attributes.length <= 1) { while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp); sp.remove(); } });
    hasTag = !!out.querySelector('span,b,i,u,strong,em,br');
    return hasTag ? out.innerHTML.replace(/&nbsp;/g, ' ') : out.textContent.split(String.fromCharCode(160)).join(' ');
  };
  /* ---- formatting of the texts of cards / lists that come from the Dashboard (data-e / data-arr) ----
     The text stays plain in its record (a record is shown on several pages: Home card, Applications page ...). The colour / font / size made with the text toolbar
     belongs to ONE page: it is kept in the page element "rt-fmt" of that page ({ "<id>|<field>[|<n>]": html }) and laid over the text while the text is unchanged. */
  var fmt = { map: null, dirty: false }, fmtP = null;
  var normSp = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
  function fmtLoad() {
    if (fmtP) return fmtP; var slug = window.RGCMS && RGCMS.slug; if (!slug) return Promise.resolve();
    fmtP = fetch('/api/v2/page-elements/' + encodeURIComponent(slug), { cache: 'no-store', credentials: 'include' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      fmt.map = fmt.map || {};
      (Array.isArray(rows) ? rows : []).forEach(function (r) { if (r.element_id === 'rt-fmt') { try { var m = JSON.parse(r.content_value) || {}; Object.keys(m).forEach(function (k) { if (!(k in fmt.map)) fmt.map[k] = m[k]; }); } catch (e) { /* no formatting */ } } });
    }).catch(function () { fmt.map = fmt.map || {}; });
    return fmtP;
  }
  function fmtApply() {
    var els = [].slice.call(document.querySelectorAll('[data-fk]:not([data-fk-done])')); if (!els.length) return;
    fmtLoad().then(function () {
      els.forEach(function (el) {
        if (el.getAttribute('data-fk-done') || !document.body.contains(el)) return; el.setAttribute('data-fk-done', '1');
        var h = fmt.map && fmt.map[el.getAttribute('data-fk')];
        if (h && normSp(RGE.plain(h)) === normSp(el.textContent)) el.innerHTML = RGE.rich(h);   // a changed text drops the old formatting
      });
    });
  }
  RGE.fmtSet = function (key, html) {
    if (!key) return; fmt.map = fmt.map || {};
    if (RGE.isRich(html)) fmt.map[key] = html; else if (key in fmt.map) delete fmt.map[key]; else return;
    fmt.dirty = true; if (window.RGCMS && RGCMS.refresh) RGCMS.refresh();
  };
  (function startFmt() {
    var go = function () { fmtApply(); if (window.MutationObserver) new MutationObserver(fmtApply).observe(document.body, { childList: true, subtree: true }); };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
    (function register() {
      if (!(window.RGCMS && RGCMS.registerHook)) { setTimeout(register, 100); return; }
      RGCMS.registerHook('rtfmt', {
        count: function () { return fmt.dirty ? 1 : 0; },
        run: function () {
          if (!fmt.dirty) return Promise.resolve(0);
          return RGE.api('POST', 'page-elements', { page_slug: RGCMS.slug, element_id: 'rt-fmt', content_type: 'text', content_value: JSON.stringify(fmt.map || {}) }).then(function () { fmt.dirty = false; return 1; });
        }
      });
    })();
  })();
  RGE.slugify = function (s) { return RGE.plain(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var refresh = function () { if (window.RGCMS && window.RGCMS.refresh) window.RGCMS.refresh(); };

  /* ---------------------------------------------------------------- backend */
  RGE.api = function (method, path, body) {
    return fetch('/api/v2/' + path, { method: method, credentials: 'include', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          if (r.status === 401 || r.status === 403) throw new Error('Session expired. Please sign in again.');
          var j = null; try { j = JSON.parse(t); } catch (e) { /* not json */ }
          if (!r.ok) throw new Error((j && (j.error || j.message)) || ('Error ' + r.status));
          if (j && j.status === 'PENDING_APPROVAL') RGE.pending = true;   // an editor's change: queued for an admin
          return j;
        });
      });
  };
  RGE.upload = function (file, folder) {
    var fd = new FormData(); fd.append('file', file); fd.append('folder', folder || 'OTHERS');
    return fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd }).then(function (r) { if (!r.ok) throw new Error('Upload failed (' + r.status + ')'); return r.json(); }).then(function (j) { if (!j || !j.url) throw new Error('Upload failed'); return j.url; });
  };
  var picker;
  RGE.pickFile = function (accept) {
    return new Promise(function (resolve) {
      if (!picker) { picker = document.createElement('input'); picker.type = 'file'; picker.style.display = 'none'; document.body.appendChild(picker); }
      picker.accept = accept || ''; picker.value = ''; picker.onchange = function () { resolve(picker.files && picker.files[0] || null); }; picker.click();
    });
  };

  /* Link / file dialog (same look as the link editor): paste a link address OR upload a file.
   * RGE.fileLink({ title, url, accept, folder, hint }) -> Promise<{ url } | { clear: true } | null> */
  RGE.fileLink = function (o) {
    return new Promise(function (resolve) {
      var old = document.getElementById('cms-linked'); if (old) old.remove();
      var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
      var nameOf = function (u) { try { return decodeURIComponent(String(u).split('?')[0].split('/').pop() || ''); } catch (e) { return String(u); } };
      var m = document.createElement('div'); m.id = 'cms-linked'; m.className = 'cms-filelink';
      m.innerHTML = '<div class="card" role="dialog" aria-modal="true"><div class="hd"><h3>' + esc(o.title || 'Edit link') + '</h3><button type="button" class="x" aria-label="Close">×</button></div><div class="bd">' +
        '<label><span>Link address</span><input type="text" id="fl-url" value="' + esc(o.url || '') + '" placeholder="https://… (a web page or a PDF link)"></label>' +
        '<div class="fl-or"><i></i><b>or</b><i></i></div>' +
        '<div class="fl-up"><button type="button" class="fl-btn">⬆ Upload a file' + (o.accept && /pdf/i.test(o.accept) ? ' (PDF)' : '') + '</button><span class="fl-name" id="fl-name">' + (o.url ? 'Current: ' + esc(nameOf(o.url)) : 'No file chosen') + '</span></div>' +
        (o.hint ? '<p class="note">' + esc(o.hint) + '</p>' : '') +
        '<div class="err" id="fl-err" role="alert"></div></div><div class="ft">' + (o.url ? '<button type="button" class="rm">Remove</button>' : '') + '<button type="button" class="no">Cancel</button><button type="button" class="yes">Apply</button></div></div>';
      document.body.appendChild(m);
      var url = m.querySelector('#fl-url'), nm = m.querySelector('#fl-name'), err = m.querySelector('#fl-err'), up = m.querySelector('.fl-btn'), busy = false;
      url.focus(); url.select();
      var close = function (v) { document.removeEventListener('keydown', key, true); m.remove(); resolve(v); };
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(null); } else if (e.key === 'Enter' && !busy && e.target !== up) { e.preventDefault(); apply(); } }
      document.addEventListener('keydown', key, true);
      function apply() {
        var u = url.value.trim();
        if (busy) { err.textContent = 'Wait until the upload has finished.'; return; }
        if (!u) { err.textContent = 'Enter a link address or upload a file.'; return; }
        if (/^\s*javascript:/i.test(u)) { err.textContent = 'This address is not allowed.'; return; }
        close({ url: u });
      }
      up.onclick = function () {
        err.textContent = '';
        RGE.pickFile(o.accept || '').then(function (file) {
          if (!file) return;
          busy = true; up.disabled = true; nm.textContent = 'Uploading ' + file.name + '…';
          return RGE.upload(file, o.folder || 'OTHERS').then(function (u) { url.value = u; nm.textContent = 'Uploaded: ' + file.name; })
            .catch(function (e) { nm.textContent = o.url ? 'Current: ' + nameOf(o.url) : 'No file chosen'; err.textContent = e.message; })
            .then(function () { busy = false; up.disabled = false; });
        });
      };
      m.querySelector('.x').onclick = function () { close(null); }; m.querySelector('.no').onclick = function () { close(null); };
      m.querySelector('.yes').onclick = apply;
      var rm = m.querySelector('.rm'); if (rm) rm.onclick = function () { close({ clear: true }); };
      m.addEventListener('mousedown', function (e) { if (e.target === m) close(null); });
    });
  };

  // change history of a list (shown in the dashboard under Change History): one entry per save with the items that were added / updated / deleted
  RGE.history = function (slug, changes) {
    var keys = Object.keys(changes); if (!keys.length) return Promise.resolve(); var snap = {}; keys.forEach(function (k) { snap[k] = { type: 'text', value: changes[k] }; });
    return fetch('/api/v2/history', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_slug: slug, snapshot: snap, changed_keys: keys }) }).catch(function () { });
  };

  /* ---------------------------------------------------------------- the store */
  RGE.store = function (cfg) {
    var st = { rows: [], dirty: {}, removed: [], titles: {}, seq: 0, onSaved: null };
    st.load = function (rows) { if (!st.reg && window.RGCMS && window.RGCMS.registerHook) { st.reg = true; window.RGCMS.registerHook(cfg.name, { count: st.count, run: st.save }); }   // (cms.js runs after this file: register on first load)
      st.rows = rows.filter(cfg.live || function () { return true; }).sort(cfg.sort || function () { return 0; }).map(cfg.toModel); st.dirty = {}; st.removed = []; st.titles = {}; return st; };
    st.by = function (id) { return st.rows.filter(function (m) { return String(m.id) === String(id); })[0]; };
    st.mark = function (m) { if (m) st.dirty[m.id] = 1; refresh(); };
    st.count = function () { return Object.keys(st.dirty).length + st.removed.length; };
    st.add = function (extra) { var m = cfg.defaults(st); m.id = 'new-' + (++st.seq); m.isNew = true; if (extra) for (var k in extra) m[k] = extra[k]; st.rows.push(m); st.mark(m); return m; };
    st.remove = function (m) { if (!m.isNew) { st.removed.push(m.id); st.titles[m.id] = m.title; } st.rows = st.rows.filter(function (x) { return x !== m; }); delete st.dirty[m.id]; refresh(); };
    st.save = function () {
      var n = 0, p = Promise.resolve(), log = {};
      st.rows.forEach(function (m) {
        if (!st.dirty[m.id]) return;
        p = p.then(function () {
          if (m.isNew) return RGE.api('POST', cfg.path, cfg.toBody(m, true, st)).then(function (res) { return cfg.afterCreate ? cfg.afterCreate(m, res) : null; });
          return RGE.api('PATCH', cfg.path + '/' + m.id, cfg.toBody(m, false, st));
        }).then(function () { n++; log[m.title || '(untitled)'] = m.isNew ? 'Added' : 'Updated'; });
      });
      st.removed.forEach(function (id) { p = p.then(function () { return RGE.api('DELETE', cfg.path + '/' + id); }).then(function () { n++; log[st.titles[id] || '(untitled)'] = 'Deleted'; }); });
      return p.then(function () { return RGE.pending ? null : RGE.history(cfg.name, log); }).then(function () { return RGE.api('GET', cfg.list || cfg.path); }).then(function (fresh) {
        var keep = st.onBeforeReload ? st.onBeforeReload() : null; st.load(Array.isArray(fresh) ? fresh : []);
        if (st.onSaved) st.onSaved(keep); refresh(); return n;
      });
    };
    return st;
  };

  /* ---------------------------------------------------------------- the binder */
  var isField = function (t) { return /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName); };
  RGE.bind = function (host, st, o) {
    function onEdit(e) {
      if (!RGE.editing()) return; var t = e.target;
      var arr = t.closest && t.closest('[data-arr]');
      if (arr && !isField(t)) { var m = st.by(arr.getAttribute('data-id')); if (!m) return; var an = arr.getAttribute('data-arr'), ai = parseInt(arr.getAttribute('data-i'), 10), rv = RGE.clean(arr), pv = RGE.plain(rv); RGE.fmtSet(arr.getAttribute('data-fk'), rv); if (m[an][ai] !== pv) { m[an][ai] = pv; st.mark(m); } if (o.onField) o.onField(m, arr.getAttribute('data-arr'), arr); return; }
      var f = t.getAttribute && t.getAttribute('data-e'); if (!f) return;
      var item = st.by(t.getAttribute('data-id')); if (!item) return;
      var v = isField(t) ? (t.type === 'checkbox' ? t.checked : t.type === 'number' ? (parseInt(t.value, 10) || 0) : t.value) : t.hasAttribute('data-multi') ? t.innerText.split(String.fromCharCode(160)).join(' ') : null;
      if (v === null) { var rf = RGE.clean(t); v = RGE.plain(rf); RGE.fmtSet(t.getAttribute('data-fk'), rf); }   // the text goes to its record plain, the formatting to this page
      if (item[f] !== v) { item[f] = v; st.mark(item); } if (o.onField) o.onField(item, f, t);
    }
    host.addEventListener('input', onEdit); host.addEventListener('change', onEdit);

    host.addEventListener('keydown', function (e) {
      if (!RGE.editing()) return; var t = e.target.closest && e.target.closest('[data-arr][contenteditable="true"]');
      if (t) {
        var m = st.by(t.getAttribute('data-id')), k = t.getAttribute('data-arr'), i = parseInt(t.getAttribute('data-i'), 10); if (!m) return;
        if (e.key === 'Enter') { e.preventDefault(); m[k].splice(i + 1, 0, ''); st.mark(m); o.redraw('[data-arr="' + k + '"][data-i="' + (i + 1) + '"][data-id="' + m.id + '"]'); }
        else if (e.key === 'Backspace' && t.textContent === '' && m[k].length > 1) { e.preventDefault(); m[k].splice(i, 1); st.mark(m); o.redraw('[data-arr="' + k + '"][data-i="' + Math.max(0, i - 1) + '"][data-id="' + m.id + '"]'); }
        return;
      }
      var line = e.target.closest && e.target.closest('[data-e][contenteditable="true"]');
      if (line && e.key === 'Enter' && !line.hasAttribute('data-multi')) e.preventDefault();   // single paragraph texts: no line breaks (data-multi texts keep them)
    });
    host.addEventListener('paste', function (e) {
      var t = e.target.closest && e.target.closest('[contenteditable="true"]'); if (!RGE.editing() || !t || t.hasAttribute('data-cms')) return;
      e.preventDefault(); var txt = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t.hasAttribute('data-multi') ? txt : txt.replace(/\s*\n\s*/g, ' '));
    });

    host.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-eact]'); if (!b || !RGE.editing()) return;
      e.preventDefault(); e.stopPropagation();
      var act = b.getAttribute('data-eact'), id = b.getAttribute('data-id'), m = id ? st.by(id) : null, field = b.getAttribute('data-field'), i = parseInt(b.getAttribute('data-i'), 10);
      if (o.action && o.action(act, b, m) === true) return;
      if (act === 'add') { var n = o.add ? o.add() : st.add(); o.redraw(null, n); }
      else if (act === 'del' && m) { RGDialog.confirm({ title: 'Delete this item?', message: 'Delete "' + (m.title || 'this item') + '"?\nIt is removed from the website when you press SAVE.', ok: 'Delete', danger: true }).then(function (go) { if (!go) return; st.remove(m); if (o.afterDelete) o.afterDelete(m); o.redraw(); }); }
      else if (act === 'clear' && m) { m[field] = ''; st.mark(m); o.redraw(); }
      else if (act === 'filelink' && m) { RGE.fileLink({ title: b.getAttribute('data-title') || 'Edit link', url: m[field], accept: b.getAttribute('data-accept') || '', folder: b.getAttribute('data-folder') || 'OTHERS', hint: b.getAttribute('data-hint') || '' }).then(function (r) { if (!r) return; m[field] = r.clear ? '' : r.url; st.mark(m); o.redraw(); }); }
      else if (act === 'addarr' && m) { m[field].push(''); st.mark(m); o.redraw('[data-arr="' + field + '"][data-i="' + (m[field].length - 1) + '"][data-id="' + m.id + '"]'); }
      else if (act === 'rmarr' && m) { m[field].splice(i, 1); st.mark(m); o.redraw(); }
      else if ((act === 'photo' || act === 'photo-add' || act === 'file') && m) {
        RGE.pickFile(act === 'file' ? (b.getAttribute('data-accept') || '') : 'image/*').then(function (file) {
          if (!file) return; b.textContent = 'Uploading…';
          return RGE.upload(file, b.getAttribute('data-folder') || 'OTHERS').then(function (url) {
            if (act === 'photo-add') m[field].push(url); else if (!isNaN(i)) m[field][i] = url; else m[field] = url;
            st.mark(m); o.redraw();
          });
        }).catch(function (err) { RGDialog.alert(err.message, { title: 'Upload failed', danger: true }); o.redraw(); });
      }
    });
  };
})();

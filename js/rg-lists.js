/* RoadGlas editable lists of the fixed pages: a list of items the admin can add to and remove from (the tick list and the "Top 10 benefits" cards of the home page).
 *   <div data-rlist="name" data-rl-new='["text of the 1st text", ...]' data-rl-num="0">  item  item  item  </div>
 * An item is a child of the list that holds one or more editable texts (data-cms key; the item itself may be such a text). The items written in the page are the
 * defaults. The texts stay ordinary editable texts (saved by the SAVE button as before); what this script adds is the list itself: which items there are and in
 * which order. It is saved with the page as the page element "rl-<name>" (a list of { k: [keys of the texts], t: [their texts] }).
 *   data-rl-new  the texts of a new item (in the order of the texts of an item)
 *   data-rl-num  index of the text of an item that is its number: all numbers are written again as 01, 02 ... after an add / remove
 * Edit mode only: an "x" on each item and a "+ Add" button below the list. Visitors just get the list as it was saved.
 * After a change the event "rg-list-changed" ({ name, added }) is sent so a slider around the list can measure it again.
 */
(function () {
  'use strict';
  var lists = [];   // { name, host, items: [{ k: [...], t: [...] }], tpl, news, num, dirty, btn }
  var editing = function () { return !!(window.RGCMS && window.RGCMS.editing); };
  var slug = function () { return window.RGCMS && window.RGCMS.slug; };
  var textOf = function (n) { return [].slice.call(n.childNodes).filter(function (c) { return c.nodeType === 3; }).map(function (c) { return c.nodeValue; }).join('').trim(); };
  var setText = function (n, t) { [].slice.call(n.childNodes).forEach(function (c) { if (c.nodeType === 3) c.remove(); }); n.appendChild(document.createTextNode(t)); };
  var textsOf = function (item) { var a = item.matches('[data-cms]') ? [item] : []; return a.concat([].slice.call(item.querySelectorAll('[data-cms]'))); };
  var newKey = function (name, i) { return 'txt-' + name + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '-' + i; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var itemsOf = function (l) { return [].slice.call(l.host.children).filter(function (c) { return !c.classList.contains('rl-add'); }).map(function (c) { return c.classList.contains('rl-w') ? c.firstElementChild : c; }); };

  // an item of the page, as the entry of the list
  function entryOf(item) { var ts = textsOf(item); return { k: ts.map(function (n) { return n.getAttribute('data-cms'); }), t: ts.map(textOf) }; }
  // a new item: a copy of the first one with its own keys and the texts of data-rl-new
  function makeItem(l, e) {
    var n = l.tpl.cloneNode(true); textsOf(n).forEach(function (t, i) { t.setAttribute('data-cms', e.k[i]); t.removeAttribute('contenteditable'); t.removeAttribute('spellcheck'); setText(t, e.t[i] == null ? '' : e.t[i]); });
    [].slice.call(n.querySelectorAll('.rl-x')).forEach(function (x) { x.remove(); }); n.style.position = ''; return n;
  }
  // (re)draw the list from l.items, keeping the item nodes that already exist (an unsaved text stays as it was typed)
  function draw(l) {
    var have = {}; itemsOf(l).forEach(function (it) { var k = textsOf(it)[0]; if (k) have[k.getAttribute('data-cms')] = it; });
    l.host.innerHTML = '';
    l.items.forEach(function (e, i) {
      var n = have[e.k[0]] || makeItem(l, e);
      [].slice.call(n.querySelectorAll('.rl-x')).forEach(function (x) { x.remove(); });
      var self = n.matches('[data-cms]'), x = null;
      if (editing()) { x = document.createElement('button'); x.type = 'button'; x.className = 'rl-x'; x.setAttribute('data-rl-del', i); x.title = 'Remove this item'; x.textContent = '×'; }
      if (editing() && self) {   // the item is a text itself: the button must stay out of it (it would be saved with the text)
        var w = document.createElement('div'); w.className = 'rl-w'; w.appendChild(n); w.appendChild(x); l.host.appendChild(w);
      } else { if (x) { n.style.position = 'relative'; n.appendChild(x); } l.host.appendChild(n); }
    });
    if (l.btn) { l.btn.remove(); l.btn = null; }
    if (editing()) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dyn-add rl-add'; b.textContent = '＋ Add item'; b.setAttribute('data-rl-add', l.name);
      l.host.insertAdjacentElement('afterend', b); l.btn = b;
    }
    if (window.RGCMS && RGCMS.reapply) RGCMS.reapply();   // saved texts + editable texts of the drawn items
  }
  var find = function (name) { return lists.filter(function (l) { return l.name === name; })[0]; };
  var touch = function (l) { l.dirty = true; if (window.RGCMS && RGCMS.refresh) RGCMS.refresh(); };
  var changed = function (l, added) { document.dispatchEvent(new CustomEvent('rg-list-changed', { detail: { name: l.name, added: !!added } })); };
  // numbers 01, 02 ... of the items (only the texts that are numbers)
  function renumber(l) {
    if (l.num < 0) return;
    itemsOf(l).forEach(function (it, i) {
      var t = textsOf(it)[l.num], want = pad(i + 1); if (!t || !/^\d{1,3}$/.test(textOf(t)) || textOf(t) === want) return;
      setText(t, want); if (window.RGCMS && RGCMS.markDirty) RGCMS.markDirty(t);
    });
    l.items = itemsOf(l).map(entryOf);
  }

  document.addEventListener('click', function (e) {
    if (!editing()) return;
    var x = e.target.closest && e.target.closest('[data-rl-del]'), a = e.target.closest && e.target.closest('[data-rl-add]');
    if (x) {
      e.preventDefault(); var l = lists.filter(function (o) { return o.host.contains(x); })[0]; if (!l) return;
      l.items = itemsOf(l).map(entryOf); l.items.splice(parseInt(x.getAttribute('data-rl-del'), 10), 1);
      touch(l); draw(l); renumber(l); draw(l); changed(l, false);
    } else if (a) {
      e.preventDefault(); var l2 = find(a.getAttribute('data-rl-add')); if (!l2) return;
      l2.items = itemsOf(l2).map(entryOf);
      var ref = l2.items.length ? l2.items[0] : entryOf(l2.tpl), en = { k: ref.k.map(function (_, i) { return newKey(l2.name, i); }), t: ref.k.map(function (_, i) { return l2.news[i] != null ? l2.news[i] : 'New item'; }) };
      l2.items.push(en); touch(l2); draw(l2); renumber(l2); draw(l2);
      var nodes = textsOf(itemsOf(l2)[l2.items.length - 1]); nodes.forEach(function (n) { if (window.RGCMS && RGCMS.markDirty) RGCMS.markDirty(n); });
      changed(l2, true);
      var f = nodes.filter(function (n) { return !/^\d+$/.test(textOf(n)); })[0] || nodes[0]; if (f) { f.focus(); try { var r = document.createRange(); r.selectNodeContents(f); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (err) { /* ignore */ } }
    }
  });
  document.addEventListener('rg-edit-mode', function () { lists.forEach(function (l) { draw(l); changed(l, false); }); });

  function register() {
    if (!(window.RGCMS && RGCMS.registerHook)) { setTimeout(register, 100); return; }
    RGCMS.registerHook('rlist', {
      count: function () { return lists.filter(function (l) { return l.dirty; }).length; },
      run: function () {
        var p = Promise.resolve(), n = 0;
        lists.filter(function (l) { return l.dirty; }).forEach(function (l) {
          var val = itemsOf(l).map(entryOf);
          p = p.then(function () { return RGE.api('POST', 'page-elements', { page_slug: slug(), element_id: 'rl-' + l.name, content_type: 'text', content_value: JSON.stringify(val) }); })
            .then(function () { l.dirty = false; n++; });
        });
        return p.then(function () { return n; });
      }
    });
  }

  var sameKeys = function (a, b) { return JSON.stringify(a.map(function (x) { return x.k; })) === JSON.stringify(b.map(function (x) { return x.k; })); };
  function valid(v) { return Array.isArray(v) && v.length && v.every(function (x) { return x && Array.isArray(x.k) && Array.isArray(x.t) && x.k.length && x.k.length === x.t.length && x.k.every(function (s) { return typeof s === 'string'; }); }); }

  function init() {
    [].slice.call(document.querySelectorAll('[data-rlist]')).forEach(function (host) {
      var first = host.firstElementChild; if (!first) return;
      var news = []; try { news = JSON.parse(host.getAttribute('data-rl-new') || '[]'); } catch (e) { news = []; }
      var num = host.hasAttribute('data-rl-num') ? parseInt(host.getAttribute('data-rl-num'), 10) : -1;
      var l = { name: host.getAttribute('data-rlist'), host: host, items: [], tpl: first.cloneNode(true), news: news, num: isNaN(num) ? -1 : num, dirty: false, btn: null };
      l.items = itemsOf(l).map(entryOf); lists.push(l);
    });
    if (!lists.length) return;
    register();
    fetch('/api/v2/page-elements/' + encodeURIComponent(slug()), { cache: 'no-store', credentials: 'include' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      (Array.isArray(rows) ? rows : []).forEach(function (r) {
        var m = /^rl-(.+)$/.exec(r.element_id || ''), l = m && find(m[1]); if (!l || l.dirty) return;
        var v; try { v = JSON.parse(r.content_value); } catch (e) { return; }
        if (!valid(v)) return;
        if (!sameKeys(v, l.items)) { l.items = v; draw(l); changed(l, false); }
      });
    }).catch(function () { /* the list written in the page stays */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

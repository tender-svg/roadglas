/* RoadGlas: the pages read their lists from the CMS (what is added / edited in the dashboard OR directly on the page shows up).
 * Pages are shipped with the same content already written in (tools/build-pages.js); this script replaces it with the live CMS data
 * as soon as the API answers. If the API cannot be reached the shipped content simply stays.
 * An admin in EDIT MODE (js/cms.js) can change everything right here: text, photos, points, add / delete items; SAVE sends it
 * to the CMS (js/rg-edit.js does the editing + saving, this file only draws the HTML).
 * Backend (the site's own /api path): /api/v2/applications, /solutions, /stories, /resources, /api/upload. */
(function () {
  'use strict';
  var page = document.body.getAttribute('data-page');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var RGE = window.RGE;
  var RGC = window.RGC || { usable: function () { return false; }, list: function () { return null; }, setList: function () { } };   // data cache (js/rg-cache.js)
  function get(path) {
    var fresh = fetch('/api/v2/' + path, { credentials: 'include', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { if (!Array.isArray(j)) throw new Error('bad data'); RGC.setList(path, j); return j; });
    var cached = RGC.usable() ? RGC.list(path) : null;
    if (cached) { if (window.RGL) RGL.cachedUsed = true; fresh.catch(function () { }); return Promise.resolve(cached); }   // drawn from the cache at once; the newer data is kept for the next page
    if (window.RGL) { if (RGL.miss) RGL.miss(); RGL.hold(); }   // not cached yet: the page loader stays until the list is drawn (the page code runs right after this resolves)
    var done = function () { setTimeout(function () { if (window.RGL) RGL.release(); }, 120); };
    fresh.then(done, done); return fresh;
  }
  var byOrder = function (a, b) { return (a.display_order || 0) - (b.display_order || 0); };
  var live = function (r) { return r.is_active !== false && r.is_deleted !== true; };
  var IMG = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block';
  var img = function (u, alt) { return u ? '<img src="' + esc(u) + '" alt="' + esc(alt || '') + '" loading="lazy" style="' + IMG + '">' : ''; };
  var editing = function () { return RGE && RGE.editing(); };
  var slugOf = RGE.slugify;
  var uniqueSlug = function (base, taken) { var s = slugOf(base) || 'item'; if (taken.indexOf(s) >= 0) s += '-' + Date.now().toString(36).slice(-4); return s; };
  var reapply = function () { if (window.RGCMS && window.RGCMS.reapply) window.RGCMS.reapply(); };   // saved fixed texts + editable keyed texts of the drawn markup
  var onEditMode = function (fn) { document.addEventListener('rg-edit-mode', fn); };
  function focusEnd(host, sel) { if (!sel) return; var f = $(sel, host); if (!f) return; f.focus(); try { var r = document.createRange(); r.selectNodeContents(f); r.collapse(false); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ignore */ } }

  /* ---------- markup helpers for the editable parts (they only produce anything in edit mode) ---------- */
  var ed = function (m, f) { return editing() ? ' contenteditable="true" spellcheck="false" data-e="' + f + '" data-id="' + esc(m.id) + '"' : ''; };
  var arrEd = function (m, f, i) { return editing() ? ' contenteditable="true" spellcheck="false" data-arr="' + f + '" data-i="' + i + '" data-id="' + esc(m.id) + '"' : ''; };
  var photoBtn = function (m, f, folder, label, i) { return editing() ? '<button type="button" class="dyn-photo" data-eact="photo" data-id="' + esc(m.id) + '" data-field="' + f + '"' + (i != null ? ' data-i="' + i + '"' : '') + ' data-folder="' + folder + '">📷 ' + (label || 'Change photo') + '</button>' : ''; };
  var addBtn = function (label, extra) { return editing() ? '<button type="button" class="dyn-add" data-eact="add"' + (extra || '') + '>＋ ' + label + '</button>' : ''; };
  var delBtn = function (m, label) { return editing() ? '<button type="button" class="dyn-del" data-eact="del" data-id="' + esc(m.id) + '">🗑 ' + (label || 'Delete') + '</button>' : ''; };
  var addPoint = function (m, f, label) { return editing() ? '<button type="button" class="dyn-add" data-eact="addarr" data-id="' + esc(m.id) + '" data-field="' + f + '">＋ ' + (label || 'Add point') + '</button>' : ''; };
  var selectF = function (m, f, opts) { return '<select data-e="' + f + '" data-id="' + esc(m.id) + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(m[f]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
  var inputF = function (m, f, type, ph) { return '<input data-e="' + f + '" data-id="' + esc(m.id) + '" type="' + (type || 'text') + '" value="' + esc(m[f]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'; };
  var points = function (m, f, check) {
    return m[f].map(function (t, i) { return '<div class="' + check.cls + '"><span class="' + check.mark + '">' + check.ch + '</span><span class="app-t"' + arrEd(m, f, i) + '>' + esc(t) + '</span>' + (editing() ? '<button type="button" class="app-x" data-eact="rmarr" data-id="' + esc(m.id) + '" data-field="' + f + '" data-i="' + i + '" title="Remove this point">×</button>' : '') + '</div>'; }).join('') + addPoint(m, f);
  };

  /* ---------- how the CMS rows are read / written (the dashboard uses the same formats) ---------- */
  var appMeta = function (r) { var t = Array.isArray(r.application_tabs) ? r.application_tabs : []; var o = {}; t.forEach(function (x) { if (x && x.type) o[x.type] = x; }); return { short: (o.meta && o.meta.short) || r.title, invest: (o.invest && o.invest.items) || [], triggers: (o.triggers && o.triggers.items) || [] }; };
  var storyX = function (r) { try { var j = JSON.parse(r.result_text || '{}'); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } };
  var PROD_RE = /^\[product:([a-z0-9\-]+)\]\s*/;
  var prodOf = function (d) { var m = PROD_RE.exec(d || ''); return m ? m[1] : 'all'; };
  var textOf = function (d) { return String(d || '').replace(PROD_RE, ''); };
  var isArt = function (t) { return t === 'Blog Post' || t === 'Webinar'; };
  // the description holds two texts: the short one (the card on the Resources page) and, for a blog post / webinar, the text of its own page after a line "[page]"
  var splitDesc = function (text, type) {
    text = String(text || ''); var m = /(^|\n)[ \t]*\[page\][ \t]*(\n|$)/.exec(text);
    if (m) return { desc: text.slice(0, m.index).trim(), body: text.slice(m.index + m[0].length).trim() };
    return isArt(type) ? { desc: '', body: text.trim() } : { desc: text.trim(), body: '' };   // an old blog / webinar has only the page text
  };

  /* ---------- products = the solutions made in the Dashboard (the filters of Project Highlights and Resources, the product selects) ---------- */
  var prodList = [];   // [{ key: slug of the solution, full: its title, name: title without "ROADGLAS® ", image, family }]
  function setProducts(rows) {
    prodList = (rows || []).filter(function (r) { return r.is_active !== false && r.is_deleted !== true; }).sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); })
      .map(function (r) { return { key: r.slug, full: r.title || r.slug, name: String(r.title || r.slug).replace(/^ROADGLAS®\s*/i, ''), image: r.icon_image_url || '', family: r.product_family || '' }; });
  }
  function getProducts() { return get('solutions').then(setProducts).catch(function () { }); }
  // old saved values: mat / grid (the first two products) -> the solution of that family; all / other / empty = no product
  var normProd = function (v) {
    v = String(v || ''); if (!v || v === 'all' || v === 'other') return v || 'all';
    if (prodList.some(function (p) { return p.key === v; })) return v;
    var p = prodList.filter(function (x) { return x.family === v; })[0]; return p ? p.key : v;
  };
  var prodFull = function (k) { var p = prodList.filter(function (x) { return x.key === k; })[0]; return p ? p.full : (!k || k === 'all' || k === 'other' ? 'All Products' : ''); };
  var prodName = function (k) { var p = prodList.filter(function (x) { return x.key === k; })[0]; return p ? p.name : (!k || k === 'all' ? 'All Products' : 'Other'); };
  var prodSel = function (noneKey, noneLabel) { return prodList.map(function (p) { return [p.key, p.name]; }).concat([[noneKey, noneLabel]]); };
  var solutionText = function (r) {   // first lines = text, lines starting with "- " = ticked points
    var ls = String(r.short_description || '').replace(/\s*\[Images:\d+\]/g, '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    return { text: ls.filter(function (l) { return !/^[-•]\s+/.test(l); }).join(' '), bullets: ls.filter(function (l) { return /^[-•]\s+/.test(l); }).map(function (l) { return l.replace(/^[-•]\s+/, ''); }) };
  };
  var maxOrder = function (st) { return st.rows.reduce(function (mx, x) { return Math.max(mx, x.order || 0); }, 0) + 1; };
  var clean = function (a) { return a.map(function (s) { return String(s).trim(); }).filter(Boolean); };

  /* ---------- the four lists ---------- */
  var apps = RGE.store({
    name: 'applications', path: 'applications', sort: byOrder, live: live,
    toModel: function (r) { var x = appMeta(r); return { id: r.id, slug: r.slug, title: r.title || '', short: x.short === r.title ? '' : x.short, desc: r.description || '', image: r.image_url || '', invest: x.invest.slice(), triggers: x.triggers.slice(), order: r.display_order || 0 }; },
    toBody: function (m, isNew, st) {   // the applications API saves with an upsert: slug is needed on every save
      return { title: m.title || 'Untitled', slug: isNew ? uniqueSlug(m.title, st.rows.map(function (x) { return x.slug; })) : m.slug, description: m.desc, image_url: m.image, display_order: m.order, is_active: true,
        application_tabs: [{ type: 'meta', short: m.short || m.title }, { type: 'invest', items: clean(m.invest) }, { type: 'triggers', items: clean(m.triggers) }] };
    },
    defaults: function (st) { return { title: 'New application', short: '', desc: '', image: '', invest: [''], triggers: [''], order: maxOrder(st) }; },
  });
  var sols = RGE.store({
    name: 'solutions', path: 'solutions', sort: byOrder, live: live,
    toModel: function (r) { var t = solutionText(r); return { id: r.id, slug: r.slug, title: r.title || '', kicker: r.category || '', text: t.text, bullets: t.bullets, image: r.icon_image_url || '', link: r.custom_link || '', family: r.product_family || 'other', order: r.display_order || 0 }; },
    toBody: function (m, isNew, st) {
      var b = clean(m.bullets), body = { title: m.title || 'Untitled', short_description: m.text + (b.length ? '\n' + b.map(function (x) { return '- ' + x; }).join('\n') : ''), icon_image_url: m.image, category: m.kicker, product_family: m.family, display_order: m.order, is_active: true };
      if (isNew) body.slug = uniqueSlug(m.title, st.rows.map(function (x) { return x.slug; })); else body.custom_link = m.link;
      return body;
    },
    afterCreate: function (m, res) { var id = res && res.solution && res.solution.id; return id && m.link ? RGE.api('PATCH', 'solutions/' + id, { custom_link: m.link }) : null; },   // the create call always sets a default link
    defaults: function (st) { return { title: 'New solution', kicker: '', text: '', bullets: [''], image: '', link: '', family: 'other', order: maxOrder(st) }; },
  });
  var stories = RGE.store({
    name: 'stories', path: 'stories',
    toModel: function (r) { var x = storyX(r); return { id: r.id, slug: r.slug, title: r.title || '', location: r.location || '', year: x.year || '', owner: r.application || '', products: r.products_used || '', prod: normProd(x.prod || 'other'), cTitle: x.challengeTitle || '', challenge: r.challenge_text || '', solution: r.solution_text || '', images: (x.images && x.images.length ? x.images : (r.hero_image_url ? [r.hero_image_url] : [])).slice() }; },
    toBody: function (m, isNew, st) {
      var imgs = m.images.filter(Boolean);
      var b = { title: m.title || 'Untitled', location: m.location, application: m.owner, products_used: m.products, hero_image_url: imgs[0] || '', challenge_text: m.challenge, solution_text: m.solution, result_text: JSON.stringify({ year: m.year, prod: m.prod, challengeTitle: m.cTitle, images: imgs }) };
      if (isNew) { b.slug = uniqueSlug(m.title, st.rows.map(function (x) { return x.slug; })); b.project_benefits = ''; }
      return b;
    },
    defaults: function () { return { title: 'New project highlight', location: '', year: '', owner: '', products: '', prod: (prodList[0] && prodList[0].key) || 'other', cTitle: '', challenge: '', solution: '', images: [] }; },
  });
  var TYPES = ['Data Sheet', 'Application Guide', 'Installation', 'Q&A', 'Specification', 'Technical Note', 'Webinar', 'Video', 'Blog Post'];
  var ress = RGE.store({
    name: 'resources', path: 'resources', live: live,
    toModel: function (r) { return { id: r.id, title: r.title || '', slug: slugOf(r.title), type: r.document_type || 'Data Sheet', product: normProd(prodOf(r.description)), desc: splitDesc(textOf(r.description), r.document_type).desc, body: splitDesc(textOf(r.description), r.document_type).body, file: r.file_url || '', thumb: r.thumbnail_url || '', date: r.published_date || '' }; },
    toBody: function (m, isNew) { var b = { title: m.title || 'Untitled', document_type: m.type, description: '[product:' + m.product + '] ' + m.desc + (m.body && isArt(m.type) ? '\n\n[page]\n\n' + m.body : ''), file_url: m.file, thumbnail_url: m.thumb, is_active: true }; if (isNew) b.published_date = new Date().toISOString(); return b; },
    defaults: function () { return { title: 'New resource', type: 'Data Sheet', product: 'all', desc: '', body: '', file: '', thumb: '' }; },
  });

  /* ---------- shared: replace the shipped variants of a part of the page by one live host ---------- */
  function dropVariants(group) {
    var blocks = $$('[data-vgroup="' + group + '"]'); if (!blocks.length) return null;
    var host = document.createElement('div'); host.setAttribute('data-dyn', group); host.style.display = 'contents';
    blocks[0].parentNode.insertBefore(host, blocks[0]); blocks.forEach(function (b) { b.remove(); }); return host;
  }

  /* ================================================================= HOME */
  function home() {
    var solBox = $('.rg-31'), appBox = $('.rg-39');
    // more cards than fit in a row: a slider (arrows at the sides, moves by itself every 4 seconds, stops while the mouse is over it); while editing, a plain grid
    function Slider(box, gap) {
      var timer = 0, idx = 0, n = 0, total = 0, w0 = window.innerWidth, me = { redraw: null };
      var per = function () { var w = window.innerWidth; return w >= 1100 ? 3 : w >= 720 ? 2 : 1; };
      me.to = function (i) {
        var track = $('.sl-track', box); if (!track) return; var max = Math.max(0, total - n);
        idx = i > max ? 0 : i < 0 ? max : i;   // after the last one it starts again
        track.style.transform = 'translateX(calc(' + (-idx) + ' * (100% + ' + gap + 'px) / ' + n + '))';
      };
      me.start = function () { clearInterval(timer); timer = setInterval(function () { if (!document.hidden && !box.matches(':hover') && !editing()) me.to(idx + 1); }, 4000); };
      me.draw = function (cards, count) {
        n = per(); total = count; clearInterval(timer);
        if (editing() || count <= n) { box.innerHTML = cards; return false; }
        box.innerHTML = '<div class="sl-wrap"><button type="button" class="sl-arr sl-prev" aria-label="Previous">‹</button><div class="sl-view"><div class="sl-track" style="--sl-n:' + n + ';--sl-gap:' + gap + 'px">' + cards + '</div></div><button type="button" class="sl-arr sl-next" aria-label="Next">›</button></div>';
        idx = Math.min(idx, total - n); me.to(idx); me.start();
        $('.sl-prev', box).onclick = function () { me.to(idx - 1); me.start(); };
        $('.sl-next', box).onclick = function () { me.to(idx + 1); me.start(); };
        return true;
      };
      window.addEventListener('resize', function () { if (window.innerWidth !== w0 && per() !== n && me.redraw) { w0 = window.innerWidth; me.redraw(); } });
      return me;
    }
    var solSlider = Slider(solBox, 28), appSlider = Slider(appBox, 20);
    function drawSol(focus) {
      if (!solBox || !sols.rows.length) return;
      var cards = sols.rows.map(function (m) { return '<article class="rg-32"><div class="rg-33">' + img(m.image, m.title) + photoBtn(m, 'image', 'solutions') + '</div><div class="rg-34"><h3 class="rg-35"' + ed(m, 'title') + '>' + esc(m.title) + '</h3><p class="rg-36"' + ed(m, 'text') + '>' + esc(m.text) + '</p><button data-href="' + esc(m.link || '#') + '" class="rg-37 dyn-h-blue">Read More</button></div></article>'; }).join('');
      if (!solSlider.draw(cards, sols.rows.length)) focusEnd(solBox, focus);
    }
    function drawApps(focus) {
      if (!appBox || !apps.rows.length) return; var tag = editing() ? 'div' : 'button';
      var cards = apps.rows.map(function (m, i) { return '<' + tag + ' data-href="applications.html#app-' + i + '" class="rg-40">' + img(m.image, m.title) + photoBtn(m, 'image', 'applications') + '<div class="rg-41"><div class="rg-42"' + ed(m, 'title') + '>' + esc(m.title) + '</div></div></' + tag + '>'; }).join('');
      if (!appSlider.draw(cards, apps.rows.length)) focusEnd(appBox, focus);
    }
    solSlider.redraw = function () { drawSol(); }; appSlider.redraw = function () { drawApps(); };
    get('solutions').then(function (rows) { sols.load(rows); drawSol(); if (solBox) RGE.bind(solBox, sols, { redraw: drawSol }); }).catch(function () { });
    get('applications').then(function (rows) { apps.load(rows); drawApps(); if (appBox) RGE.bind(appBox, apps, { redraw: drawApps }); }).catch(function () { });
    onEditMode(function () { drawSol(); drawApps(); });
    sols.onSaved = function () { drawSol(); }; apps.onSaved = function () { drawApps(); };
  }

  /* ================================================================= SOLUTIONS */
  function solutions() {
    var box = $('.rg-83'); if (!box) return;
    function draw(focus) {
      box.innerHTML = sols.rows.map(function (m, i) {
        var strip = editing() ? '<div class="app-strip"><label>Page it opens ' + inputF(m, 'link', 'text', 'paving-mat.html') + '</label><label>Order ' + inputF(m, 'order', 'number') + '</label>' + delBtn(m, 'Delete this solution') + '</div>' : '';
        return '<article style="display:flex;flex-wrap:wrap;flex-direction:' + (i % 2 ? 'row-reverse' : 'row') + '"><div class="rg-84">' + img(m.image, m.title) + photoBtn(m, 'image', 'solutions') + '</div><div class="rg-85"><div class="rg-86"' + ed(m, 'kicker') + '>' + esc(m.kicker) + '</div><h3 class="rg-87"' + ed(m, 'title') + '>' + esc(m.title) + '</h3><p class="rg-88"' + ed(m, 'text') + '>' + esc(m.text) + '</p>' +
          ((m.bullets.length || editing()) ? '<div class="rg-89">' + points(m, 'bullets', { cls: 'rg-49', mark: 'rg-50', ch: '✓' }) + '</div>' : '') + '<button data-href="' + esc(m.link || '#') + '" class="rg-90 dyn-h-blue">View Solution →</button>' + strip + '</div></article>';
      }).join('') + (editing() ? '<div style="grid-column:1/-1">' + addBtn('New solution') + '</div>' : '');
      reapply(); focusEnd(box, focus);
    }
    get('solutions').then(function (rows) { sols.load(rows); if (!sols.rows.length && !editing()) return; draw(); RGE.bind(box, sols, { redraw: draw }); }).catch(function () { });
    onEditMode(function () { if (sols.rows.length || editing()) draw(); }); sols.onSaved = function () { draw(); };
  }

  /* ================================================================= APPLICATIONS */
  function applications() {
    get('applications').then(function (rows) {
      apps.load(rows); if (!apps.rows.length) return;
      var host = dropVariants('app'); if (!host) return;
      var m0 = /^#app-(\d+)$/.exec(location.hash), sel = m0 ? Math.min(parseInt(m0[1], 10), apps.rows.length - 1) : 0;
      var label = function (a) { return a.short || a.title || 'New'; };
      function draw(focus) {
        sel = Math.min(sel, apps.rows.length - 1); var a = apps.rows[sel];
        if (!a) { host.innerHTML = '<section class="rg-79"><div class="rg-27"><div class="rg-155">' + addBtn('New application') + '</div></div></section>'; return; }
        var tabs = apps.rows.map(function (x, i) { var on = i === sel; return '<button data-app="' + i + '" style="border:2px solid #0E3692;padding:10px 18px;cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:15px;background:' + (on ? '#0E3692' : '#fff') + ';color:' + (on ? '#fff' : '#0E3692') + '">' + esc(label(x)) + '</button>'; }).join('') + addBtn('New application');
        var strip = editing() ? '<div class="app-strip"><label>Tab name ' + inputF(a, 'short', 'text', a.title) + '</label>' + delBtn(a, 'Delete this application') + '<span>Editing <b>' + esc(label(a)) + '</b>. Click any text below to change it, then press SAVE in the bar above.</span></div>' : '';
        host.innerHTML = '<section class="rg-79"><div class="rg-27"><div class="rg-155">' + tabs + '</div>' + strip + '<div class="rg-156"><div class="rg-157">' + img(a.image, a.title) + photoBtn(a, 'image', 'applications') + '</div><div class="rg-158"><h2 class="rg-159"' + ed(a, 'title') + '>' + esc(a.title) + '</h2><p class="rg-88"' + ed(a, 'desc') + '>' + esc(a.desc) + '</p></div></div></div></section>' +
          '<section class="rg-160"><div class="rg-161"><div><div class="rg-162">Strategic Applications · ' + esc(label(a)) + '</div><h2 class="rg-163" data-cms="applications-invest-heading" data-cms-type="text">Where the Investment Makes Sense</h2><div class="rg-140">' + points(a, 'invest', { cls: 'rg-164', mark: 'rg-165', ch: '✓' }) + '</div></div>' +
          '<div><div class="rg-162">Structural Triggers · ' + esc(label(a)) + '</div><h2 class="rg-166" data-cms="applications-triggers-heading" data-cms-type="text">Primary Structural Triggers for Use</h2><p class="rg-167" data-cms="applications-triggers-intro" data-cms-type="text">Public and private civil engineering agencies routinely require structural glass reinforcement interlayers:</p><div class="rg-140">' + points(a, 'triggers', { cls: 'rg-164', mark: 'rg-165', ch: '!' }) + '</div></div></div></section>';
        reapply(); focusEnd(host, focus);
      }
      host.addEventListener('click', function (e) { var t = e.target.closest('[data-app]'); if (!t) return; sel = parseInt(t.getAttribute('data-app'), 10); draw(); try { history.replaceState(null, '', '#app-' + sel); } catch (x) { } });
      RGE.bind(host, apps, {
        redraw: draw, add: function () { var n = apps.add(); sel = apps.rows.length - 1; return n; }, afterDelete: function () { sel = Math.max(0, sel - 1); },
        onField: function (m, f) { if (f === 'short' || f === 'title') { var b = $('[data-app="' + sel + '"]', host); if (b) b.textContent = label(m); $$('.rg-162', host).forEach(function (n, i) { n.textContent = (i ? 'Structural Triggers · ' : 'Strategic Applications · ') + label(m); }); } },
      });
      apps.onBeforeReload = function () { var a = apps.rows[sel]; return a && !a.isNew ? a.id : null; };
      apps.onSaved = function (keepId) { var i = keepId ? apps.rows.map(function (x) { return x.id; }).indexOf(keepId) : -1; sel = i >= 0 ? i : Math.max(0, apps.rows.length - 1); draw(); };
      onEditMode(function () { draw(); }); draw();
    }).catch(function () { });
  }

  /* ================================================================= PROJECT HIGHLIGHTS (list) */
  function projects() {
    Promise.all([get('stories'), getProducts()]).then(function (res) {
      var rows = res[0]; stories.load(rows); if (!stories.rows.length) return;
      var f = 'all', mode = 'grid', host = dropVariants('pf'); if (!host) return;
      var PRODS = prodSel('other', 'Other');
      function draw(focus) {
        var shown = stories.rows.filter(function (m) { return f === 'all' || m.prod === f || m.isNew; }), isList = mode === 'list';
        var filters = [['all', 'All']].concat(prodList.map(function (p) { return [p.key, p.name]; })).map(function (p) { var on = p[0] === f; return '<button data-f="' + p[0] + '" style="border:0;border-bottom:3px solid ' + (on ? '#E52C1A' : 'transparent') + ';margin-bottom:-1px;background:none;padding:22px 18px 20px;cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:17px;white-space:nowrap;flex-shrink:0;color:' + (on ? '#E52C1A' : '#5A5B60') + '">' + p[1] + '</button>'; }).join('');
        var vb = function (on) { return 'width:40px;height:40px;border:1px solid ' + (on ? '#E52C1A' : '#CECFD1') + ';background:' + (on ? '#E52C1A' : '#fff') + ';color:' + (on ? '#fff' : '#5A5B60') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0'; };
        var cards = shown.map(function (m) {
          var strip = editing() ? '<div class="app-strip" style="margin:0;border-width:1px 0 0">' + selectF(m, 'prod', PRODS) + delBtn(m, 'Delete') + '</div>' : '';
          return '<article data-href="' + (m.isNew ? '#' : 'project-highlight.html?slug=' + encodeURIComponent(m.slug)) + '" class="dyn-card" style="border:1px solid #ECECED;display:flex;flex-direction:' + (isList ? 'row' : 'column') + ';flex-wrap:wrap;cursor:pointer;background:#fff"><div style="position:relative;overflow:hidden;background:#ECECED;height:' + (isList ? 'auto' : '230px') + ';min-height:' + (isList ? '200px' : '0') + ';flex:' + (isList ? '0 1 340px' : 'none') + ';width:' + (isList ? 'auto' : '100%') + '">' + img(m.images[0], m.title) + '<span class="rg-181"' + ed(m, 'year') + '>' + esc(m.year) + '</span>' + photoBtn(m, 'images', 'projects', 'Change photo', 0) + '</div><div class="rg-182"><div class="rg-183"' + ed(m, 'products') + '>' + esc(m.products) + '</div><h3 class="rg-184"' + ed(m, 'title') + '>' + esc(m.title) + '</h3><div class="rg-185"' + ed(m, 'location') + '>' + esc(m.location) + '</div><span class="rg-186">View Project →</span>' + strip + '</div></article>';
        }).join('');
        host.innerHTML = '<section class="rg-79"><div class="rg-27"><div class="rg-170" data-cms="projects-eyebrow" data-cms-type="text">Project Highlights</div><h2 class="rg-171" data-cms="projects-heading" data-cms-type="text">Pavement Reinforcement <strong class="rg-172">Product Solutions</strong></h2><div class="rg-173"><div class="rg-174">' + filters + '</div><div class="rg-175"><span class="rg-176">View Mode:</span>' +
          '<button data-m="grid" aria-label="Grid view" style="' + vb(!isList) + '"><span class="rg-177"><i class="rg-178"></i><i class="rg-178"></i><i class="rg-178"></i><i class="rg-178"></i></span></button><button data-m="list" aria-label="List view" style="' + vb(isList) + '"><span class="rg-179"><i class="rg-180"></i><i class="rg-180"></i><i class="rg-180"></i></span></button></div></div>' +
          (editing() ? '<div style="margin:0 0 18px">' + addBtn('New project highlight') + '</div>' : '') +
          '<div style="' + (isList ? 'display:grid;gap:20px' : 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:24px') + '">' + cards + '</div>' + (shown.length ? '' : '<div class="rg-187">No projects for this product yet.</div>') + '</div></section>';
        reapply(); focusEnd(host, focus);
      }
      host.addEventListener('click', function (e) { var b = e.target.closest('[data-f],[data-m]'); if (!b) return; if (b.hasAttribute('data-f')) f = b.getAttribute('data-f'); else mode = b.getAttribute('data-m'); draw(); });
      RGE.bind(host, stories, { redraw: draw }); stories.onSaved = function () { draw(); }; onEditMode(function () { draw(); }); draw();
    }).catch(function () { });
  }

  /* ================================================================= ONE PROJECT HIGHLIGHT (project-highlight.html?slug=...) */
  function project() {
    Promise.all([get('stories'), getProducts()]).then(function (res) {
      var rows = res[0]; stories.load(rows); if (!stories.rows.length) return;
      var slug = routeSlug('project-highlight');
      var pid = (stories.rows.filter(function (x) { return x.slug === slug; })[0] || stories.rows[0]).id, gi = 0, tab = 'c';
      var hero = $('section.rg-75'), host = dropVariants('pj'); if (!hero || !host) return;
      var PRODS = prodSel('other', 'Other');
      function draw(focus) {
        var r = stories.by(pid); if (!r) { location.href = 'project-highlights.html'; return; }
        var imgs = r.images, n = imgs.length || 1; gi = Math.min(gi, Math.max(0, imgs.length - 1)); document.title = (r.title || 'Project') + ' | RoadGlas® Project Highlights';
        hero.innerHTML = '<img src="' + esc(imgs[0] || '') + '" alt="" class="rg-63"><div class="rg-16"></div><div class="rg-76"><h1 class="rg-154"' + ed(r, 'title') + '>' + esc(r.title) + '</h1><div class="rg-168"><button data-href="index.html" class="rg-169 dyn-h-pink">Home</button> / <button data-href="project-highlights.html" class="rg-169 dyn-h-pink">Project Highlights</button> / <span>' + esc(r.title) + '</span></div></div>';
        var thumbs = imgs.map(function (s, k) { return '<div style="position:relative"><button data-g="' + k + '" style="position:relative;display:block;width:100%;aspect-ratio:1 / 1;border:0;padding:0;cursor:pointer;overflow:hidden;background:#ECECED;outline:' + (k === gi ? '3px solid #E52C1A' : 'none') + ';outline-offset:-3px;opacity:' + (k === gi ? 1 : 0.7) + '"><img src="' + esc(s) + '" alt="" class="rg-63"></button>' + (editing() ? '<button type="button" class="app-x thumb-x" data-eact="rmarr" data-id="' + esc(r.id) + '" data-field="images" data-i="' + k + '" title="Remove this photo">×</button>' : '') + '</div>'; }).join('');
        var tabs = [['c', "Client's Challenge"], ['s', 'RoadGlas® Solution']].map(function (t) { var on = t[0] === tab; return '<button data-t="' + t[0] + '" style="border:2px solid #E52C1A;background:' + (on ? '#E52C1A' : 'transparent') + ';color:' + (on ? '#fff' : '#2C2E35') + ';padding:18px 28px;cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;letter-spacing:0.04em;font-size:20px">' + t[1] + '</button>'; }).join('');
        var strip = editing() ? '<div class="app-strip" style="margin-bottom:18px"><label>Product ' + selectF(r, 'prod', PRODS) + '</label>' + delBtn(r, 'Delete this project') + '<span>Click any text to edit it. Use the photo buttons to change, add or remove photos. Press SAVE in the bar above.</span></div>' : '';
        host.innerHTML = '<section class="rg-79"><div class="rg-131"><div class="rg-188">' + strip + '<div class="rg-189"><img src="' + esc(imgs[gi] || '') + '" alt="' + esc(r.title) + '" class="rg-63">' + (n > 1 ? '<button data-g="prev" aria-label="Previous image" class="rg-190 dyn-h-red">‹</button><button data-g="next" aria-label="Next image" class="rg-191 dyn-h-red">›</button>' : '') + '<span class="rg-192">' + (imgs.length ? gi + 1 : 0) + ' / ' + imgs.length + '</span>' + (imgs.length ? photoBtn(r, 'images', 'projects', 'Change this photo', gi) : '') + '</div>' +
          (imgs.length > 1 || editing() ? '<div class="rg-193">' + thumbs + '</div>' : '') + (editing() ? '<div>' + '<button type="button" class="dyn-add" data-eact="photo-add" data-id="' + esc(r.id) + '" data-field="images" data-folder="projects">＋ Add photo</button></div>' : '') + '</div>' +
          '<div class="rg-194"><div class="rg-195">Project Highlights</div><h2 class="rg-196"' + ed(r, 'title') + '>' + esc(r.title) + '</h2><div class="rg-197"><span class="rg-198"></span><span' + ed(r, 'location') + '>' + esc(r.location) + '</span></div><div class="rg-199"><div><strong' + ed(r, 'year') + '>' + esc(r.year) + '</strong></div><div><strong>Owner:</strong> <span' + ed(r, 'owner') + '>' + esc(r.owner) + '</span></div><div><strong>Products Used:</strong> <span' + ed(r, 'products') + '>' + esc(r.products) + '</span></div></div><div class="rg-200"><a href="roadglas-brochure.pdf" target="_blank" class="rg-145 dyn-h-blue2">Download Case Study ↓</a></div></div></div></section>' +
          '<section class="rg-201"><div class="rg-202"><div class="rg-203">' + tabs + '</div><h3 class="rg-204"' + (tab === 'c' ? ed(r, 'cTitle') : '') + '>' + esc(tab === 'c' ? (r.cTitle || (editing() ? '' : "Client's Challenge")) : 'RoadGlas® Engineered Solution') + '</h3><p class="rg-205"' + ed(r, tab === 'c' ? 'challenge' : 'solution') + '>' + esc(tab === 'c' ? r.challenge : r.solution) + '</p></div></section>';
        reapply(); focusEnd(host, focus);
      }
      host.addEventListener('click', function (e) {
        var r = stories.by(pid), g = e.target.closest('[data-g]'), t = e.target.closest('[data-t]');
        if (g && r) { var v = g.getAttribute('data-g'), n = r.images.length || 1; gi = v === 'prev' ? (gi - 1 + n) % n : v === 'next' ? (gi + 1) % n : parseInt(v, 10); draw(); }
        else if (t) { tab = t.getAttribute('data-t'); draw(); }
      });
      // the h1 in the hero + the other texts are bound too (hero is outside the host)
      RGE.bind(host, stories, { redraw: draw, afterDelete: function () { stories.deleted = true; } }); RGE.bind(hero, stories, { redraw: draw });
      stories.onSaved = function () { if (stories.deleted || !stories.by(pid)) { location.href = 'project-highlights.html'; return; } draw(); };
      onEditMode(function () { draw(); }); draw();
    }).catch(function () { });
  }

  /* ================================================================= RESOURCES */
  var RES_TABS = [['downloads', 'Downloads'], ['datasheets', 'Technical Datasheets'], ['webinars', 'Webinars'], ['videos', 'Videos'], ['blog', 'Blog Posts'], ['notes', 'Technical Notes']];
  var MEDIA = ['Webinar', 'Video', 'Blog Post'];
  var inTab = { downloads: function (r) { return MEDIA.indexOf(r.type) < 0; }, datasheets: function (r) { return r.type === 'Data Sheet'; }, webinars: function (r) { return r.type === 'Webinar'; }, videos: function (r) { return r.type === 'Video'; }, blog: function (r) { return r.type === 'Blog Post'; }, notes: function (r) { return MEDIA.indexOf(r.type) < 0 && r.type !== 'Data Sheet'; } };
  var tabType = { downloads: 'Data Sheet', datasheets: 'Data Sheet', webinars: 'Webinar', videos: 'Video', blog: 'Blog Post', notes: 'Technical Note' };
  function resources() {
    Promise.all([get('resources'), getProducts()]).then(function (res) {
      var rows = res[0]; ress.load(rows); if (!ress.rows.length) return;
      var tab = 'downloads', prod = normProd((/[?&]prod=([a-z0-9\-]+)/.exec(location.search) || [])[1] || 'all'), host = dropVariants('res'); if (!host) return;
      if (prod !== 'all' && !prodList.some(function (p) { return p.key === prod; })) prod = 'all';
      var TILES = [['all', 'All Products', 'images/img_p0_1.webp']].concat(prodList.map(function (p) { return [p.key, p.full, p.image || 'images/img_p5_1.webp']; }));   // one card per solution
      var PSEL = prodSel('all', 'All products');
      // search: 2+ letters filter the cards of the current tab and list suggestions from every tab
      var cardsOf, emptyOf, q = '', sugOpen = false, SEARCH_ICON = '<svg class="rs-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
      var qn = function () { var t = q.trim().toLowerCase(); return t.length >= 2 ? t : ''; };
      var hay = function (r) { return (String(r.title || '') + ' ' + String(r.desc || '') + ' ' + String(r.type || '') + ' ' + prodFull(r.product)).toLowerCase(); };
      var hl = function (txt, t) { var i = String(txt).toLowerCase().indexOf(t); if (i < 0) return esc(txt); return esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + t.length)) + '</mark>' + esc(txt.slice(i + t.length)); };
      var getList = function () { var t = qn(); return ress.rows.filter(function (r) { return (prod === 'all' || r.product === prod) && inTab[tab](r) && (!t || hay(r).indexOf(t) >= 0); }); };
      var sugHtml = function () {
        var t = qn(); if (!sugOpen || !t) return '';
        var m = ress.rows.filter(function (r) { return hay(r).indexOf(t) >= 0; });
        m.sort(function (a, b) { return (String(b.title || '').toLowerCase().indexOf(t) >= 0) - (String(a.title || '').toLowerCase().indexOf(t) >= 0); });
        if (!m.length) return '<div class="rs-sug"><div class="rs-none">No resources match “' + esc(q.trim()) + '”</div></div>';
        return '<div class="rs-sug" role="listbox">' + m.slice(0, 6).map(function (r) { return '<button type="button" class="rs-it" role="option" data-sug="' + esc(r.id) + '"><b>' + hl(String(r.title || ''), t) + '</b><span>' + esc(r.type) + ' · ' + esc(prodFull(r.product)) + '</span></button>'; }).join('') + '</div>';
      };
      var searchBox = function () { return '<div class="rs-box">' + SEARCH_ICON + '<input type="text" data-rsq value="' + esc(q) + '" placeholder="Search resources…" autocomplete="off" spellcheck="false" aria-label="Search resources"><button type="button" class="rs-x" data-rsx aria-label="Clear search"' + (q ? '' : ' hidden') + '>×</button><div class="rs-sugbox">' + sugHtml() + '</div></div>'; };
      function draw(focus) {
        var list = getList();
        var tiles = TILES.map(function (t) { var on = t[0] === prod, n = ress.rows.filter(function (r) { return t[0] === 'all' || r.product === t[0]; }).length;
          return '<button data-p="' + t[0] + '" style="position:relative;overflow:hidden;border:0;outline:' + (on ? '3px solid #E52C1A' : '0') + ';outline-offset:-3px;background:#2C2E35;min-height:150px;padding:24px 24px 28px;cursor:pointer;display:flex;align-items:flex-end;opacity:' + (on ? 1 : 0.85) + ';transition:opacity .2s"><img src="' + t[2] + '" alt="" class="rg-63"><span class="rg-219"></span><span class="rg-220"><span class="rg-221">' + n + ' documents</span><span class="rg-222">' + t[1] + '</span></span><span style="position:absolute;left:0;right:0;bottom:0;height:6px;background:' + (on ? '#E52C1A' : 'transparent') + '"></span></button>'; }).join('');
        var tabs = RES_TABS.map(function (t) { var on = t[0] === tab; return '<button data-tab="' + t[0] + '" style="border:0;border-bottom:3px solid ' + (on ? '#E52C1A' : 'transparent') + ';margin-bottom:-1px;background:none;padding:26px 18px 24px;cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:17px;white-space:nowrap;flex-shrink:0;color:' + (on ? '#E52C1A' : '#5A5B60') + '">' + t[1] + '</button>'; }).join('');
        cardsOf = function (list) { return list.map(function (r) { var f = r.file || '', pdf = /\.pdf(\?|$)/i.test(f), has = !!f, own = r.type === 'Blog Post' ? 'blog-' + r.slug + '.html' : r.type === 'Webinar' ? 'webinar-' + r.slug + '.html' : '';
          var strip = editing() ? '<div class="app-strip" style="margin:10px 0 0"><label>Type ' + selectF(r, 'type', TYPES.map(function (x) { return [x, x]; })) + '</label><label>Product ' + selectF(r, 'product', PSEL) + '</label><button type="button" class="dyn-add" data-eact="file" data-id="' + esc(r.id) + '" data-field="file" data-folder="resources">⬆ ' + (has ? 'Replace file' : 'Upload file') + '</button><label>or link ' + inputF(r, 'file', 'text', 'https://… or file link') + '</label>' + delBtn(r, 'Delete') + '</div>' : '';
          return '<article class="rg-32"><div class="rg-229"><div class="rg-230"><span class="rg-231">' + esc(r.type) + '</span><span class="rg-232">' + (pdf ? 'PDF' : has ? 'LINK' : '') + '</span></div><div class="rg-183">' + esc(prodFull(r.product)) + '</div><h3 class="rg-233"' + ed(r, 'title') + '>' + esc(r.title) + '</h3>' +
            ((r.desc || editing()) ? '<p class="rg-36" style="margin:0"' + ed(r, 'desc') + '>' + esc(r.desc) + '</p>' : '') + (own && !r.isNew ? '<a href="' + esc(own) + '" class="rg-234 dyn-h-red-text">' + (r.type === 'Blog Post' ? 'Read article →' : 'View webinar →') + '</a>' : has ? '<a href="' + esc(f) + '" target="_blank" rel="noopener" class="rg-234 dyn-h-red-text">' + (pdf ? 'Download PDF ↓' : 'Open ↗') + '</a>' : '') + strip + '</div></article>'; }).join(''); };
        emptyOf = function (list) { if (list.length) return ''; if (qn()) return '<div class="rg-225"><h3 class="rg-226">No results</h3><p class="rg-227">Nothing in this tab matches “' + esc(q.trim()) + '”. Try another tab or product, or clear the search.</p></div>'; return '<div class="rg-225"><h3 class="rg-226">' + ({ webinars: 'Webinars coming soon', videos: 'Videos coming soon', blog: 'Blog posts coming soon' }[tab] || 'Coming soon') + '</h3><p class="rg-227">Contact the RoadGlas® team to request this content or be notified when it is published.</p><button data-href="contact.html" aria-label="Contact Us" class="rg-72 dyn-h-lift"><img src="images/contact-shield.webp" alt="Contact Us" class="rg-73"><span aria-hidden="true" class="rg-74">→</span></button></div>'; };
        var cards = cardsOf(list), empty = emptyOf(list);
        host.innerHTML = '<section class="rg-206"><div class="rg-27"><div class="rg-207"><img src="images/img_p0_3.webp" alt="RoadGlas" class="rg-208"><div class="rg-209"><div class="rg-210" data-cms="resources-brochure-eyebrow" data-cms-type="text">Full Brochure</div><h2 class="rg-211" data-cms="resources-brochure-title" data-cms-type="text">Engineered to Perform.</h2><p class="rg-212" data-cms="resources-brochure-text" data-cms-type="text">Reinforcement solutions that extend pavement life and maximize value.</p></div><a href="roadglas-brochure.pdf" target="_blank" class="rg-213 dyn-h-blue2" data-cms="resources-brochure-button" data-cms-type="text">Download PDF ↓</a></div>' +
          '<div class="rg-214"><div class="rg-215"><div><div class="rg-210" data-cms="resources-browse-eyebrow" data-cms-type="text">Browse by Product</div><h2 class="rg-216">' + esc(prodName(prod)) + '</h2></div></div><div class="rg-218">' + tiles + '</div><div class="rg-223"><div class="rs-bar"><div class="rg-224">' + tabs + '</div>' + searchBox() + '</div>' + (editing() ? '<div style="margin:0 0 18px">' + addBtn('New resource') + '</div>' : '') + '<div class="rs-res">' + empty + '<div class="rg-228">' + cards + '</div></div></div></div></div></section>';
        reapply(); focusEnd(host, focus);
      }
      // typing only refreshes the cards + suggestion list (the rest of the page is not redrawn, so the input keeps focus)
      function refresh() {
        var l = getList(), res = $('.rs-res', host), sb = $('.rs-sugbox', host), x = $('[data-rsx]', host);
        if (res) res.innerHTML = emptyOf(l) + '<div class="rg-228">' + cardsOf(l) + '</div>';
        if (sb) sb.innerHTML = sugHtml();
        if (x) x.hidden = !q;
      }
      host.addEventListener('input', function (e) { var i = e.target.closest && e.target.closest('[data-rsq]'); if (!i) return; q = i.value; sugOpen = true; refresh(); });
      host.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('[data-rsq]') && qn() && !sugOpen) { sugOpen = true; var sb = $('.rs-sugbox', host); if (sb) sb.innerHTML = sugHtml(); } });
      host.addEventListener('keydown', function (e) {
        var i = e.target.closest && e.target.closest('[data-rsq]'); if (!i) return;
        var items = $$('.rs-it', host), cur = items.findIndex(function (b) { return b.classList.contains('on'); });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!items.length) return; e.preventDefault(); if (cur >= 0) items[cur].classList.remove('on'); cur = e.key === 'ArrowDown' ? (cur + 1) % items.length : (cur <= 0 ? items.length - 1 : cur - 1); items[cur].classList.add('on'); items[cur].scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter') { e.preventDefault(); if (cur >= 0) items[cur].click(); else { sugOpen = false; refresh(); } }
        else if (e.key === 'Escape') { sugOpen = false; refresh(); }
      });
      document.addEventListener('click', function (e) { if (sugOpen && !(e.target.closest && e.target.closest('.rs-box'))) { sugOpen = false; var sb = $('.rs-sugbox', host); if (sb) sb.innerHTML = ''; } });
      host.addEventListener('click', function (e) {
        var sg = e.target.closest('[data-sug]'), x = e.target.closest('[data-rsx]');
        if (sg) { var r = ress.by(sg.getAttribute('data-sug')); if (r) { prod = 'all'; tab = (RES_TABS.filter(function (t) { return inTab[t[0]](r); })[0] || RES_TABS[0])[0]; q = String(r.title || ''); sugOpen = false; draw(); } return; }
        if (x) { q = ''; sugOpen = false; refresh(); var i = $('[data-rsq]', host); if (i) { i.value = ''; i.focus(); } return; }
        var p = e.target.closest('[data-p]'), t = e.target.closest('[data-tab]'); if (p) prod = p.getAttribute('data-p'); else if (t) tab = t.getAttribute('data-tab'); else return; sugOpen = false; draw();
      });
      RGE.bind(host, ress, { redraw: draw, add: function () { return ress.add({ product: prod, type: tabType[tab] }); } });
      ress.onSaved = function () { draw(); }; onEditMode(function () { draw(); }); draw();
    }).catch(function () { });
  }


  /* ================================================================= REFERENCE PAGES
   * One page per CMS item. The host (Vercel / Netlify, see vercel.json) shows these files for the addresses of items that have no file of their own:
   *   /product-detail-<slug>.html -> solution-reference.html     /application-<slug>.html -> application-reference.html
   *   /project-highlight-<slug>.html -> project-highlight.html   /blog-<slug>.html -> blog-details.html    /webinar-<slug>.html -> webinar-details.html
   * (?slug=<slug> works as well.) The page is drawn from the CMS item with that slug, so a new item made in the dashboard has its page at once. */
  function routeSlug(prefix) {
    var q = /[?&]slug=([^&]+)/.exec(location.search); if (q) return decodeURIComponent(q[1]);
    var m = new RegExp('/' + prefix + '-([^/]+?)\\.html$', 'i').exec(location.pathname); return m ? decodeURIComponent(m[1]) : null;
  }
  var refHost = function () { return $('[data-ref]'); };
  // the saved page elements of a solution page (its lists, "tpl-..."): from the data cache when there is one, else from the CMS
  function tplRows(pname) {
    var net = function () { return fetch('/api/v2/page-elements/' + encodeURIComponent(pname), { credentials: 'include', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (rows) { RGC.setPage(pname, rows); return rows; }); };
    var c = RGC.usable() ? RGC.page(pname) : null;
    if (c) { net(); return Promise.resolve(c); }   // from the cache at once; the newer data is kept for the next visit
    if (window.RGL && RGL.miss) RGL.miss();       // not cached yet: the loader stays until it is here
    return net();
  }
  // the sections that are switched off for a solution (page element "tpl-sections" of its page, set in the Dashboard under Solutions > Edit)
  function applySections(rows) {
    var off = {}; (rows || []).forEach(function (r) { if (r.element_id === 'tpl-sections') { try { off = JSON.parse(r.content_value) || {}; } catch (e) { /* all shown */ } } });
    $$('[data-tsec]').forEach(function (el) { el.style.display = off[el.getAttribute('data-tsec')] === false ? 'none' : ''; });
  }
  // paving-mat.html / reinforcement-grid.html: the sections the Dashboard switched off for THIS solution are hidden (the solution is found by the page its "View Solution" button opens)
  function productPage() {
    var file = location.pathname.split('/').pop() || ''; if (window.RGL) RGL.hold();
    get('solutions').then(function (rows) {
      sols.load(rows); var m = sols.rows.filter(function (x) { return String(x.link || '').split('/').pop().split('?')[0] === file; })[0]; if (!m) return;
      return tplRows(('product-detail-' + m.slug).toLowerCase().replace(/[^a-z0-9\-_]/g, '-')).then(applySections);
    }).catch(function () { }).then(function () { if (window.RGL) RGL.release(); });
  }
  function notFound(host, what, back) { host.innerHTML = '<section class="rg-26" style="text-align:center"><div class="rg-27"><h2 class="rg-29">' + what + ' not found</h2><p class="rg-82">This page does not exist (any more).</p><button data-href="' + back + '" class="rg-98" style="margin-top:20px">Go back</button></div></section>'; }
  var crumb = function (items) { return items.map(function (c, i) { return i === items.length - 1 ? '<span>' + esc(c[0]) + '</span>' : '<button data-href="' + c[1] + '" class="rg-94">' + c[0] + '</button><span>/</span>'; }).join(''); };
  var stripBox = function () { return ''; };   // no grey "edit this page" box (order / page / product / delete live in the Dashboard)
  var CONTAIN = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block';

  function solutionRef() {
    var host = $('[data-ref-hero]'); if (!host) return;   // the rest of the page is the template (js/../tools/build-pages.js solutionTemplate), edited as normal page texts
    get('solutions').then(function (rows) {
      sols.load(rows); var slug = routeSlug('product-detail');
      var m = sols.rows.filter(function (x) { return x.slug === slug; })[0] || sols.rows.filter(function (x) { return slug && (x.link || '').indexOf('product-detail-' + slug) >= 0; })[0];
      if (!m) { notFound(host, 'Solution', 'solutions.html'); return; } var pid = m.id;
      var pname = ('product-detail-' + slug).toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
      if (window.RGTPL) {   // the lists of the page (figures, features, product types ...) and the sections that are switched on
        if (window.RGL) RGL.hold();
        tplRows(pname).then(function (prow) { RGTPL.init(pname, prow); }).catch(function () { RGTPL.init(pname, []); }).then(function () { if (window.RGL) RGL.release(); });
      }
      function draw(focus) {
        var r = sols.by(pid); if (!r) { location.href = 'solutions.html'; return; } document.title = r.title + ' | RoadGlas®';
        var photo = r.image || 'images/img_p15_2.webp';   // a solution without its own photo yet gets the default road photo
        host.innerHTML = '<section class="rg-91"><div class="rg-15">' + img(photo, r.title) + photoBtn(r, 'image', 'solutions') + '</div><div class="rg-16"></div><div class="rg-92"><div class="rg-93">' + crumb([['Home', 'index.html'], ['Solutions', 'solutions.html'], [r.title]]) + '</div>' +
          '<div class="rg-95"' + ed(r, 'kicker') + '>' + esc(r.kicker) + '</div><h1 class="rg-96"' + ed(r, 'title') + '>' + esc(r.title) + '</h1><p class="rg-97"' + ed(r, 'text') + '>' + esc(r.text) + '</p><div class="rg-22"><button data-href="contact.html" class="rg-98 hv-7">Request Information</button><button data-href="resources.html" class="rg-23 hv-2">Documents</button></div></div></section>';
        reapply(); focusEnd(host, focus);
      }
      RGE.bind(host, sols, { redraw: draw, afterDelete: function () { sols.deleted = true; } });
      sols.onSaved = function () { if (sols.deleted || !sols.by(pid)) { location.href = 'solutions.html'; return; } draw(); };
      var openQA = function (on) { [].slice.call(document.querySelectorAll('details.rg-150')).forEach(function (d) { d.open = !!on; }); };   // all answers are open while editing
      onEditMode(function (e) { draw(); openQA(e.detail && e.detail.on); }); draw(); openQA(editing());
    }).catch(function () { });
  }

  function applicationRef() {
    var host = refHost(); if (!host) return;
    get('applications').then(function (rows) {
      apps.load(rows); var slug = routeSlug('application'), m = apps.rows.filter(function (x) { return x.slug === slug; })[0];
      if (!m) { notFound(host, 'Application', 'applications.html'); return; } var pid = m.id, label = function (a) { return a.short || a.title; };
      function draw(focus) {
        var a = apps.by(pid); if (!a) { location.href = 'applications.html'; return; } document.title = a.title + ' | RoadGlas® Applications';
        host.innerHTML = stripBox('<label>Tab name ' + inputF(a, 'short', 'text', a.title) + '</label>' + delBtn(a, 'Delete this application') + '<span>Click any text to edit it, then press SAVE in the bar above.</span>') +
          '<section class="rg-75">' + (a.image ? '<img src="' + esc(a.image) + '" alt="" class="rg-63">' : '') + '<div class="rg-16"></div><div class="rg-76"><h1 class="rg-154"' + ed(a, 'title') + '>' + esc(a.title) + '</h1><div class="rg-168">' + crumb([['Home', 'index.html'], ['Applications', 'applications.html'], [a.title]]).replace(/class="rg-94"/g, 'class="rg-169 dyn-h-pink"') + '</div></div></section>' +
          '<section class="rg-79"><div class="rg-27"><div class="rg-156"><div class="rg-157">' + img(a.image, a.title) + photoBtn(a, 'image', 'applications') + '</div><div class="rg-158"><h2 class="rg-159"' + ed(a, 'title') + '>' + esc(a.title) + '</h2><p class="rg-88"' + ed(a, 'desc') + '>' + esc(a.desc) + '</p></div></div></div></section>' +
          '<section class="rg-160"><div class="rg-161"><div><div class="rg-162">Strategic Applications · ' + esc(label(a)) + '</div><h2 class="rg-163" data-cms="applications-invest-heading" data-cms-type="text">Where the Investment Makes Sense</h2><div class="rg-140">' + points(a, 'invest', { cls: 'rg-164', mark: 'rg-165', ch: '✓' }) + '</div></div>' +
          '<div><div class="rg-162">Structural Triggers · ' + esc(label(a)) + '</div><h2 class="rg-166" data-cms="applications-triggers-heading" data-cms-type="text">Primary Structural Triggers for Use</h2><p class="rg-167" data-cms="applications-triggers-intro" data-cms-type="text">Public and private civil engineering agencies routinely require structural glass reinforcement interlayers:</p><div class="rg-140">' + points(a, 'triggers', { cls: 'rg-164', mark: 'rg-165', ch: '!' }) + '</div></div></div></section>';
        reapply(); focusEnd(host, focus);
      }
      RGE.bind(host, apps, { redraw: draw, afterDelete: function () { apps.deleted = true; } });
      apps.onSaved = function () { if (apps.deleted || !apps.by(pid)) { location.href = 'applications.html'; return; } draw(); }; onEditMode(function () { draw(); }); draw();
    }).catch(function () { });
  }

  // blog posts and webinars: resources of that type, one page each (address = type + title)
  // the text of a blog post / webinar as typed (plain text) -> paragraphs; a short first line of a block = sub-heading; lines starting with "• " / "- " = a list
  function fmtArticle(t, cards) {
    return String(t || '').split(/\n\s*\n/).map(function (blk) {
      var ls = blk.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); }), out = '';
      if (!ls.length) return '';
      if (ls.length > 1 && ls[0].length <= 70 && !/[.:;!?]$/.test(ls[0].trim()) && !/^\s*([•\-*]|\d+[.)])\s/.test(ls[0]) && !/^\s*\[image:/i.test(ls[0])) { out += '<h3 class="art-h">' + esc(ls.shift().trim()) + '</h3>'; }
      var para = [], list = [], flush = function () { if (para.length) out += '<p>' + para.join('<br>') + '</p>'; if (list.length) out += '<ul>' + list.join('') + '</ul>'; para = []; list = []; };
      ls.forEach(function (l) {
        var im = /^\s*\[image:\s*([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\s*$/i.exec(l);
        if (im) {   // a picture inside the text: only own images (/images/..., images/...) or https links
          if (!/^(\/?images\/|\/|https:\/\/)/i.test(im[1]) || /^\s*javascript:/i.test(im[1])) return;
          flush(); out += '<figure class="art-fig"><img src="' + esc(im[1]) + '" alt="' + esc(im[2] || '') + '" loading="lazy">' + (im[2] ? '<figcaption>' + esc(im[2]) + '</figcaption>' : '') + '</figure>'; return;
        }
        var m = /^\s*(?:[•\-*]|\d+[.)])\s+(.*)$/.exec(l); if (m) { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } var tx = m[1], k = cards ? tx.indexOf(':') : -1; list.push('<li>' + (k > 0 && k <= 48 ? '<strong>' + esc(tx.slice(0, k)) + '</strong> ' + esc(tx.slice(k + 1).trim().replace(/^./, function (c) { return c.toUpperCase(); })) : esc(tx)) + '</li>'); } else { if (list.length) { out += '<ul>' + list.join('') + '</ul>'; list = []; } para.push(esc(l.trim())); } });
      flush(); return out;
    }).join('');
  }
  // the page of a webinar: hero, the text (list = numbered cards) beside a card with the photo + play button, the facts and the register button, and a contact band
  var insBtn = function () { return editing() ? '<div class="art-ins"><button type="button" class="dyn-add" data-ins-img="1">＋ Insert image in the text</button><span>The picture is put where the cursor is in the text below (or at the end). It is a line like [image: /photo.webp | caption].</span></div>' : ''; };
  function webinarPage(r, when) {
    var cover = r.thumb || 'images/img_p5_1.webp', ph = '800 848 4500';
    var hero = '<section class="rg-75 wb-hero"><img src="' + esc(cover) + '" alt="" class="rg-63"><div class="rg-16"></div><div class="rg-76"><span class="wb-pill"><i></i>Webinar</span><h1 class="rg-154"' + ed(r, 'title') + '>' + esc(r.title) + '</h1><div class="rg-168">' + crumb([['Home', 'index.html'], ['Resources', 'resources.html'], [r.title]]).replace(/class="rg-94"/g, 'class="rg-169 dyn-h-pink"') + '</div>' + (editing() ? '<div style="margin-top:16px;position:relative">' + photoBtn(r, 'thumb', 'resources', 'Cover photo') + '</div>' : '') + '</div></section>';
    var rows = [['Product', prodFull(r.product)], ['Posted', when], ['Questions?', '<a href="tel:+18008484500">' + ph + '</a>']].filter(function (x) { return x[1]; }).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + (x[0] === 'Questions?' ? x[1] : esc(x[1])) + '</dd></div>'; }).join('');
    var cta = r.file ? '<a href="' + esc(r.file) + '"' + (/^https?:/i.test(r.file) ? ' target="_blank" rel="noopener"' : '') + ' class="wb-cta">Watch / Register →</a>' : '<a href="contact.html" class="wb-cta">Contact us to register →</a>';
    var card = '<aside class="wb-side"><div class="wb-card"><div class="wb-img"><img src="' + esc(cover) + '" alt="' + esc(r.title) + '"><span class="wb-play" aria-hidden="true"></span>' + photoBtn(r, 'thumb', 'resources', 'Change photo') + '</div><div class="wb-body"><span class="wb-badge">Webinar</span><dl class="wb-dl">' + rows + '</dl>' + cta + '</div></div></aside>';
    var text = '<div class="wb-main">' + insBtn() + '<div class="rg-88' + (editing() ? ' ed-multi' : ' art art-cards') + '" style="font-size:18px;line-height:1.8;min-height:60px"' + (editing() ? ' contenteditable="true" spellcheck="false" data-multi="1" data-e="body" data-id="' + esc(r.id) + '"' : '') + '>' + (editing() ? esc(r.body) : fmtArticle(r.body, true)) + '</div></div>';
    var band = '<section class="rg-342"><div class="rg-343"><img src="' + esc(cover) + '" alt="" class="rg-63"><div class="rg-64"></div><div class="rg-65"><div class="rg-66"><div class="rg-67"><span class="rg-68"></span>Bring it to your team</div><h3 class="rg-69">Want this session for your crew?</h3><p class="rg-344">Contact the RoadGlas® team to be notified of the next session or to schedule one.</p></div><div class="rg-71"><button data-href="contact.html" aria-label="Contact Us" class="rg-72 hv-6"><img src="images/contact-shield.webp" alt="Contact Us" class="rg-73"><span aria-hidden="true" class="rg-74">→</span></button></div></div></div></section>';
    return hero + '<section class="rg-79"><div class="rg-27 wb-wrap">' + text + card + '</div></section>' + band;
  }
  // the page of a blog post: hero, the text (numbered lines = cards) with the cover photo on top, and a side card with the facts + a link to the resources of the product
  function blogPage(r, when) {
    var cover = r.thumb || 'images/img_p15_2.webp', words = String(r.body || '').split(/\s+/).filter(Boolean).length, mins = Math.max(1, Math.round(words / 200));
    var hero = '<section class="rg-75 wb-hero"><img src="' + esc(cover) + '" alt="" class="rg-63"><div class="rg-16"></div><div class="rg-76"><span class="wb-pill"><i></i>Blog Post</span><h1 class="rg-154"' + ed(r, 'title') + '>' + esc(r.title) + '</h1><div class="rg-168">' + crumb([['Home', 'index.html'], ['Resources', 'resources.html'], [r.title]]).replace(/class="rg-94"/g, 'class="rg-169 dyn-h-pink"') + '</div>' +
      '<div class="bl-meta">' + (when ? esc(when) + ' · ' : '') + mins + ' min read</div>' + (editing() ? '<div style="margin-top:16px;position:relative">' + photoBtn(r, 'thumb', 'resources', 'Cover photo') + '</div>' : '') + '</div></section>';
    var more = r.product && r.product !== 'all' && r.product !== 'other' ? '<a href="resources.html?prod=' + encodeURIComponent(r.product) + '" class="wb-cta">More about ' + esc(prodName(r.product)) + ' →</a>' : '<a href="resources.html" class="wb-cta">More resources →</a>';
    var rows = [['Product', prodFull(r.product)], ['Posted', when], ['Reading time', mins + ' min']].filter(function (x) { return x[1]; }).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('');
    var side = '<aside class="wb-side"><div class="wb-card"><div class="wb-body"><span class="wb-badge">Blog Post</span><dl class="wb-dl">' + rows + '</dl>' + more + '</div></div>' +
      '<div class="bl-help"><b>Need specifications or installation support?</b><span>Talk to the RoadGlas® team.</span><a href="contact.html">Contact us →</a></div></aside>';
    var text = '<div class="wb-main">' + insBtn() + '<figure class="bl-fig"><img src="' + esc(cover) + '" alt="' + esc(r.title) + '">' + photoBtn(r, 'thumb', 'resources', 'Change photo') + '</figure><div class="rg-88' + (editing() ? ' ed-multi' : ' art art-cards') + '" style="font-size:18px;line-height:1.8;min-height:60px"' + (editing() ? ' contenteditable="true" spellcheck="false" data-multi="1" data-e="body" data-id="' + esc(r.id) + '"' : '') + '>' + (editing() ? esc(r.body) : fmtArticle(r.body, true)) + '</div></div>';
    var band = '<section class="rg-342"><div class="rg-343"><img src="' + esc(cover) + '" alt="" class="rg-63"><div class="rg-64"></div><div class="rg-65"><div class="rg-66"><div class="rg-67"><span class="rg-68"></span>Plan your project</div><h3 class="rg-69">Talk to our team about your overlay</h3><p class="rg-344">Contact us for specifications, tack coat guidance and installation support.</p></div><div class="rg-71"><button data-href="contact.html" aria-label="Contact Us" class="rg-72 hv-6"><img src="images/contact-shield.webp" alt="Contact Us" class="rg-73"><span aria-hidden="true" class="rg-74">→</span></button></div></div></div></section>';
    return hero + '<section class="rg-79"><div class="rg-27 wb-wrap">' + text + side + '</div></section>' + band;
  }
  function articleRef(kind) {
    var host = refHost(); if (!host) return; var type = kind === 'blog' ? 'Blog Post' : 'Webinar';
    Promise.all([get('resources'), getProducts()]).then(function (res) {
      var rows = res[0]; ress.load(rows); var slug = routeSlug(kind), m = ress.rows.filter(function (x) { return x.type === type && x.slug === slug; })[0];
      if (!m) { notFound(host, kind === 'blog' ? 'Blog post' : 'Webinar', 'resources.html'); return; } var pid = m.id;
      var PSEL = prodSel('all', 'All products');
      function draw(focus) {
        var r = ress.by(pid); if (!r) { location.href = 'resources.html'; return; } document.title = r.title + ' | RoadGlas®';
        var d = r.date ? new Date(r.date) : null, when = d && !isNaN(d) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
        var link = r.file ? '<a href="' + esc(r.file) + '" target="_blank" rel="noopener" class="rg-145 dyn-h-blue2" style="margin-top:28px;display:inline-block">' + (kind === 'webinar' ? 'Watch / Register →' : 'Download ↓') + '</a>' : '';
        host.innerHTML = kind === 'webinar' ? webinarPage(r, when) : blogPage(r, when);
        reapply(); focusEnd(host, focus);
      }
      RGE.bind(host, ress, { redraw: draw, afterDelete: function () { ress.deleted = true; } });
      host.addEventListener('click', function (e) {   // "Insert image in the text": pick a photo, upload it, put its line at the cursor
        var b = e.target.closest('[data-ins-img]'); if (!b || !editing()) return; e.preventDefault();
        var box = host.querySelector('[data-e="body"][contenteditable]'); if (!box) return;
        RGE.pickFile('image/*').then(function (file) {
          if (!file) return; b.textContent = 'Uploading…';
          return RGE.upload(file, 'resources').then(function (url) {
            box.focus(); var sel = window.getSelection();
            if (!sel.rangeCount || !box.contains(sel.anchorNode)) { var rg = document.createRange(); rg.selectNodeContents(box); rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg); }
            document.execCommand('insertText', false, '\n\n[image: ' + url + ' | ]\n\n'); b.textContent = '＋ Insert image in the text';
          });
        }).catch(function (err) { alert(err.message); b.textContent = '＋ Insert image in the text'; });
      });
      ress.onSaved = function () { if (ress.deleted || !ress.by(pid)) { location.href = 'resources.html'; return; } draw(); }; onEditMode(function () { draw(); }); draw();
    }).catch(function () { });
  }

  var run = { home: home, solutions: solutions, applications: applications, projects: projects, 'project-dyn': project, resources: resources, 'ref-solution': solutionRef, mat: productPage, grid: productPage, 'ref-application': applicationRef, 'ref-blog': function () { articleRef('blog'); }, 'ref-webinar': function () { articleRef('webinar'); } }[page];
  if (run) run();
})();

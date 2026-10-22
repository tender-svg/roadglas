/* Scroll animations: text rises/wipes in, photos unveil with a soft zoom, cards cascade, a progress bar on top.
 * Only touches classes (no text is split or rewritten), so the CMS / editor keep working on the same elements. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!('IntersectionObserver' in window) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { root.classList.remove('rgm-pre'); return; }
  if (document.body.getAttribute('data-page') === 'login') { root.classList.remove('rgm-pre'); return; }

  var SKIP = 'header, footer, nav, #rg-loader, .sl-arr, button, [data-screen-label="Home hero"], .rg-25';
  var seen = new WeakSet();

  // whole boxes (cards, brochure box, feature tiles) animate as one piece; their texts / photos then do not animate again
  var BLOCK = 'article, .rg-207, .rg-110, .rg-127, .rg-101';
  function skip(el, isBlock) { return !!el.closest(SKIP) || !!el.closest('.rgm-banner') || (!isBlock && !!el.closest(BLOCK)); }

  var pending = [];   // seen on the first screen while the loader / banner entrance is still running
  function reveal(el, extra) {
    if (extra) el.style.setProperty('--rgm-d', ((parseInt(el.style.getPropertyValue('--rgm-d'), 10) || 0) + extra) + 'ms');
    el.classList.add('rgm-in');
    // after the entrance, drop the heavy transition so hovers / sliders stay snappy (boxes lose the animation classes completely)
    setTimeout(function () {
      el.style.setProperty('--rgm-d', '0ms');
      if (el.classList.contains('rgm-block')) { el.classList.remove('rgm', 'rgm-up', 'rgm-block', 'rgm-in'); el.style.removeProperty('--rgm-d'); }
    }, 1800 + (extra || 0));
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      if (!ready) { pending.push(en.target); return; }
      reveal(en.target, 0);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  function inView(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }

  // late = content (re)drawn after load (CMS text/cards, tabs, edits): what is already on screen must never hide and re-animate
  function add(el, cls, delay, late) {
    if (seen.has(el) || skip(el, cls === 'rgm-block')) return;
    seen.add(el);
    if (late && ready && inView(el)) return;
    el.classList.add('rgm', cls);
    if (delay) el.style.setProperty('--rgm-d', delay + 'ms');
    io.observe(el);
  }

  // children of the same row get a small cascade (cards, columns, list items)
  function stagger(el) {
    var p = el.parentElement; if (!p) return 0;
    var sibs = [].filter.call(p.children, function (c) { return c.tagName === el.tagName || c.tagName === 'DIV'; });
    var i = sibs.indexOf(el); return i < 0 ? 0 : Math.min(i, 5) * 110;
  }

  function scan(scope, late) {
    scope = scope || document;
    [].forEach.call(scope.querySelectorAll('h2'), function (h) {   // the small red label above a section heading
      var e = h.previousElementSibling;
      if (e && e.tagName === 'DIV' && !e.children.length && e.textContent.trim().length > 0 && e.textContent.trim().length < 60) add(e, 'rgm-up', 0, late);
    });
    [].forEach.call(scope.querySelectorAll(BLOCK), function (b) {
      if (b.closest('.sl-view') || b.closest('[data-vgroup][hidden]')) return;
      add(b, 'rgm-block', Math.min(stagger(b), 440), late);
    });
    [].forEach.call(scope.querySelectorAll('h1, h2, h3'), function (el) { add(el, 'rgm-head', 0, late); });
    [].forEach.call(scope.querySelectorAll('p, li, form, table'), function (el) {
      if (el.closest('.sl-view, [data-vgroup][hidden]')) { if (!el.closest('.sl-view')) return; }
      add(el, 'rgm-up', Math.min(stagger(el), 330), late);
    });
    [].forEach.call(scope.querySelectorAll('main img, section img, article img'), function (img) {
      if (img.closest('.sl-view')) return;                 // carousels move their own cards
      var frame = img.parentElement, clipped = false;
      try { var o = getComputedStyle(frame).overflow; clipped = o === 'hidden'; } catch (e) {}
      add(img, 'rgm-img', stagger(img), late);
      if (clipped) img.classList.add('rgm-zoom');
    });
  }

  // run fn once the page loader has gone, so an entrance animation is actually seen
  function afterLoader(fn) {
    if (!root.classList.contains('rg-loading') && !document.getElementById('rg-loader')) { fn(); return; }
    var started = false;
    function begin() { if (started) return; started = true; setTimeout(fn, 200); }
    new MutationObserver(function (m, o) { if (!root.classList.contains('rg-loading')) { o.disconnect(); begin(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
    setTimeout(begin, 6000);
  }

  // The hero / banner text is held invisible by css (html.rgm-pre, set in <head>) from the very first paint, so it never
  // shows and then vanishes: release() starts the entrance animations and lifts that hold in the same frame.
  var ready = false, heroPlay = null;
  function release() {
    ready = true;
    if (heroPlay) heroPlay();
    [].forEach.call(document.querySelectorAll('.rgm-banner:not(.rgm-banner-on)'), function (s) { void s.offsetWidth; s.classList.add('rgm-banner-on'); });
    root.classList.remove('rgm-pre');
    var q = pending; pending = [];
    q.forEach(function (el) { reveal(el, 450); });
  }

  // inner pages: the title banner (photo + h1 + breadcrumb / text / buttons) gets the same entrance as the home hero
  function markBanner() {
    if (document.querySelector('section[data-screen-label="Home hero"]')) return;
    var h = document.querySelector('main h1, section h1'); if (!h) return;
    var sec = h.closest('section'); if (!sec || sec.classList.contains('rgm-banner')) return;
    if (sec.getBoundingClientRect().top > innerHeight * 0.8) return;   // only a banner at the top of the page
    sec.classList.add('rgm-banner');
    if (ready) { void sec.offsetWidth; sec.classList.add('rgm-banner-on'); }
  }

  // home hero: mark the visible slide (class restarts the CSS animations each time a slide comes round)
  function heroMotion() {
    var hero = document.querySelector('section[data-screen-label="Home hero"]'); if (!hero) return;
    var slides = [].filter.call(hero.children, function (c) { return c.style && c.style.position === 'absolute'; });
    function sync() {
      slides.forEach(function (sl) {
        var on = sl.style.opacity === '1';
        if (on && !sl.classList.contains('rgm-slide-on')) { void sl.offsetWidth; sl.classList.add('rgm-slide-on'); }
        else if (!on) sl.classList.remove('rgm-slide-on');
      });
    }
    slides.forEach(function (sl) { sl.classList.remove('rgm-slide-on'); });
    heroPlay = function () {
      sync();
      var mo = new MutationObserver(sync);
      slides.forEach(function (sl) { mo.observe(sl, { attributes: true, attributeFilter: ['style'] }); });
    };
  }

  function start() {
    root.classList.add('rg-motion');
    heroMotion();
    markBanner();
    scan();
    afterLoader(release);
    // content that appears later (CMS content, tabs, filters): pick up new nodes
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { markBanner(); scan(document, true); }, 120); })
      .observe(document.body, { childList: true, subtree: true });

    // top progress bar
    var bar = document.createElement('div'); bar.id = 'rgm-bar'; document.body.appendChild(bar);
    var tick = false;
    function upd() {
      tick = false;
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
    }
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();

    // safety net: never leave content invisible
    setTimeout(function () {
      [].forEach.call(document.querySelectorAll('.rgm:not(.rgm-in)'), function (el) {
        var r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('rgm-in');
      });
    }, 3500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

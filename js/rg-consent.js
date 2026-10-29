/* RoadGlas cookie banner + cookie preferences (self-contained: injects its own CSS).
 *   - First visit: a small card at the bottom right: Accept / Deny / View preferences (+ link to the privacy policy).
 *   - "View preferences" (and every [data-cookie-prefs] link, e.g. "Cookie Preferences" in the footer) opens the preferences window:
 *     strictly necessary storage (always on) and third-party tracking (ZoomInfo, off until accepted).
 *   - The choice is kept in the browser (localStorage "rg-cookie-consent"); nothing is sent anywhere.
 *   - A third-party tag is only ever loaded AFTER the visitor accepted it: put the ZoomInfo script address in THIRD_PARTY.src below.
 *   RGConsent.get() -> { thirdParty: bool, t: ms } | null     RGConsent.open()     document event "rg-consent" after every choice.
 * The text of the banner follows the Industrial Fabrics site; the policy itself is privacy-policy.html. */
(function () {
  'use strict';
  if (window.RGConsent) return;
  var body = document.body; if (!body || body.getAttribute('data-page') === 'login') return;

  // third-party tags that may only load after the visitor accepted them. Paste the ZoomInfo tag address into src
  // (the address of the <script> ZoomInfo gives you) and it is loaded after "Accept" only; empty = nothing is loaded.
  var THIRD_PARTY = { name: 'ZoomInfo', src: '' };
  var KEY = 'rg-cookie-consent', POLICY = 'privacy-policy.html';

  function read() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && typeof j === 'object' ? j : null; } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode: the choice just is not remembered */ } }

  var loaded = false;
  function applyChoice() {
    var c = read();
    if (c && c.thirdParty && THIRD_PARTY.src && !loaded) {
      loaded = true; var s = document.createElement('script'); s.src = THIRD_PARTY.src; s.async = true; s.setAttribute('data-consent', 'third-party'); document.head.appendChild(s);
    }
  }
  function choose(thirdParty) {
    write({ v: 1, thirdParty: !!thirdParty, t: Date.now() });
    applyChoice();
    try { document.dispatchEvent(new CustomEvent('rg-consent', { detail: { thirdParty: !!thirdParty } })); } catch (e) { /* old browser */ }
  }

  /* ------------------------------------------------------------ css */
  var css = '' +
    '#rgc-banner{position:fixed;right:24px;bottom:24px;z-index:2147482800;width:420px;max-width:calc(100vw - 32px);animation:rgc-in .45s cubic-bezier(.16,1,.3,1)}' +
    '@keyframes rgc-in{from{opacity:0;transform:translateY(26px) scale(.97)}to{opacity:1;transform:none}}' +
    '.rgc-card{background:#fff;color:#2C2E35;border-top:5px solid #E52C1A;box-shadow:0 14px 44px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.1);padding:18px 22px 16px;font-family:"Barlow",Arial,sans-serif;font-size:15px;line-height:1.55;text-align:left}' +
    '.rgc-h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding-bottom:10px;border-bottom:1px solid #ECECED}' +
    '.rgc-h h3{margin:0;font-family:"Barlow Condensed",Arial Narrow,Arial,sans-serif;font-weight:800;font-size:22px;line-height:1.1;text-transform:uppercase;letter-spacing:.02em}' +
    '.rgc-x{border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:#6b6c72;padding:0 2px}.rgc-x:hover{color:#E52C1A}' +
    '.rgc-card p{margin:0 0 10px;color:#4a4c53}' +
    '.rgc-card a{color:#E52C1A;font-weight:600;text-decoration:underline}.rgc-card a:hover{color:#c42312}' +
    '.rgc-b{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 12px}' +
    '.rgc-btn{flex:1 1 auto;padding:11px 14px;cursor:pointer;font-family:"Barlow Condensed",Arial Narrow,Arial,sans-serif;font-weight:800;font-size:15px;letter-spacing:.08em;text-transform:uppercase;border:2px solid #CECFD1;background:#fff;color:#2C2E35;transition:background .15s,color .15s,border-color .15s}' +
    '.rgc-btn:hover{background:#F3F4F6}' +
    '.rgc-btn.rgc-yes{background:#E52C1A;border-color:#E52C1A;color:#fff}.rgc-btn.rgc-yes:hover{background:#c42312;border-color:#c42312}' +
    '.rgc-btn.rgc-pref{border-color:#0E3692;color:#0E3692}.rgc-btn.rgc-pref:hover{background:#0E3692;color:#fff}' +
    '.rgc-btn:focus-visible,.rgc-x:focus-visible,.rgc-card a:focus-visible{outline:3px solid #F2B8A8;outline-offset:2px}' +
    '.rgc-dns{font-size:13.5px}' +
    /* compact banner styling */
    '#rgc-banner{position:fixed;right:20px;bottom:20px;z-index:2147482800;width:340px;max-width:calc(100vw - 32px);animation:rgc-in .45s cubic-bezier(.16,1,.3,1)}' +
    '#rgc-banner .rgc-card{padding:12px 15px 11px;font-size:12.5px;line-height:1.4;border-top-width:4px;box-shadow:0 10px 30px rgba(0,0,0,.22),0 2px 6px rgba(0,0,0,.08)}' +
    '#rgc-banner .rgc-h{margin:0 0 6px;padding-bottom:5px;gap:8px}' +
    '#rgc-banner .rgc-h h3{font-size:15px;letter-spacing:.02em}' +
    '#rgc-banner .rgc-x{font-size:19px}' +
    '#rgc-banner .rgc-card p{margin:0 0 6px;font-size:12px;line-height:1.38}' +
    '#rgc-banner .rgc-b{display:grid;grid-template-columns:1fr 1fr 1.35fr;gap:5px;margin:8px 0 6px}' +
    '#rgc-banner .rgc-btn{padding:6px 3px;font-size:11.5px;letter-spacing:.04em;border-width:1.5px;text-align:center;line-height:1.15;white-space:nowrap}' +
    '#rgc-banner .rgc-dns{font-size:11px;line-height:1.3}' +
    /* preferences window */
    '#rgc-pref{position:fixed;inset:0;z-index:2147482900;background:rgba(10,12,16,.62);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .18s ease}' +
    '#rgc-pref.in{opacity:1}' +
    '#rgc-pref .rgc-card{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:22px 26px 20px;transform:translateY(14px);transition:transform .22s cubic-bezier(.2,.8,.2,1)}' +
    '#rgc-pref.in .rgc-card{transform:none}' +
    '.rgc-row{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:14px 0;border-top:1px solid #ECECED}' +
    '.rgc-row b{display:block;font-family:"Barlow Condensed",Arial Narrow,Arial,sans-serif;font-weight:800;font-size:18px;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px}' +
    '.rgc-row span.rgc-d{display:block;font-size:14px;color:#5A5B60;line-height:1.5}' +
    '.rgc-on{flex:none;font-family:"Barlow Condensed",Arial Narrow,Arial,sans-serif;font-weight:800;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#1f7a3a;background:#E4F4E9;padding:4px 10px;white-space:nowrap}' +
    '.rgc-sw{flex:none;position:relative;width:48px;height:26px;margin-top:2px}' +
    '.rgc-sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;width:100%;height:100%;z-index:2}' +
    '.rgc-sw i{position:absolute;inset:0;background:#CECFD1;border-radius:26px;transition:background .2s}' +
    '.rgc-sw i:after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}' +
    '.rgc-sw input:checked+i{background:#0E3692}.rgc-sw input:checked+i:after{transform:translateX(22px)}' +
    '.rgc-sw input:focus-visible+i{outline:3px solid #F2B8A8;outline-offset:2px}' +
    /* phones: a compact card (small type, tight spacing, the three buttons in one row) */
    '@media (max-width:520px){' +
      '#rgc-banner{right:10px;left:10px;bottom:10px;width:auto;max-width:none}' +
      '.rgc-card{padding:9px 13px 9px;font-size:12px;line-height:1.35}' +
      '.rgc-h{margin:0 0 4px;padding-bottom:4px}.rgc-h h3{font-size:15px}.rgc-x{font-size:20px}' +
      '.rgc-card p{margin:0 0 4px}' +
      '.rgc-b{display:grid;grid-template-columns:1fr 1fr 1.35fr;gap:5px;margin:6px 0 5px}' +
      '.rgc-btn{padding:7px 3px;font-size:12px;letter-spacing:.03em;line-height:1.1;border-width:1.5px}' +
      '.rgc-dns{font-size:11px}' +
      '#rgc-pref{padding:10px}#rgc-pref .rgc-card{padding:14px 14px 12px}' +
      '.rgc-row{padding:10px 0;gap:10px}.rgc-row b{font-size:15px}.rgc-row span.rgc-d{font-size:12.5px}.rgc-on{font-size:12px;padding:3px 8px}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){#rgc-banner,#rgc-pref,#rgc-pref .rgc-card{animation:none;transition:none}}';
  var styled = false;
  function addCss() { if (styled) return; styled = true; var s = document.createElement('style'); s.id = 'rgc-css'; s.textContent = css; document.head.appendChild(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ------------------------------------------------------------ banner */
  function closeBanner() { var b = document.getElementById('rgc-banner'); if (b) b.remove(); }
  function showBanner() {
    if (document.getElementById('rgc-banner') || document.getElementById('rgc-pref')) return;
    addCss();
    var b = el('div'); b.id = 'rgc-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Cookie notice');
    b.innerHTML = '<div class="rgc-card"><div class="rgc-h"><h3>Our Site Uses Cookies</h3><button type="button" class="rgc-x" aria-label="Close">&times;</button></div>' +
      '<p>We use cookies to make our website work and to remember your preferences. See our <a href="' + POLICY + '#cookies">Cookie Policy</a> and <a href="' + POLICY + '">Privacy Statement</a> for details, including your privacy rights.</p>' +
      '<div class="rgc-b"><button type="button" class="rgc-btn rgc-yes" data-a="accept">Accept</button><button type="button" class="rgc-btn" data-a="deny">Deny</button><button type="button" class="rgc-btn rgc-pref" data-a="prefs">View preferences</button></div>' +
      '<a class="rgc-dns" href="' + POLICY + '#california">Do Not Sell or Share My Personal Information</a></div>';
    document.body.appendChild(b);
    b.querySelector('.rgc-x').onclick = closeBanner;
    b.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
      var k = a.getAttribute('data-a');
      if (k === 'accept') { choose(true); closeBanner(); } else if (k === 'deny') { choose(false); closeBanner(); } else if (k === 'prefs') { closeBanner(); openPrefs(); }
    });
  }

  /* ------------------------------------------------------------ preferences window */
  function openPrefs() {
    var old = document.getElementById('rgc-pref'); if (old) old.remove(); closeBanner(); addCss();
    var c = read(), prev = document.activeElement;
    var ov = el('div'); ov.id = 'rgc-pref';
    ov.innerHTML = '<div class="rgc-card" role="dialog" aria-modal="true" aria-labelledby="rgc-pt"><div class="rgc-h"><h3 id="rgc-pt">Cookie Preferences</h3><button type="button" class="rgc-x" aria-label="Close">&times;</button></div>' +
      '<p>Choose which cookies and similar technologies this website may use. You can change this at any time with the &ldquo;Cookie Preferences&rdquo; link in the footer.</p>' +
      '<div class="rgc-row"><div><b>Strictly necessary</b><span class="rgc-d">Needed for the site to work: remembering this choice, a temporary copy of pages so they load fast, and the sign-in of our staff on the content dashboard. These cannot be switched off and are not used for tracking.</span></div><span class="rgc-on">Always on</span></div>' +
      '<div class="rgc-row"><div><b>Third-party tracking (' + THIRD_PARTY.name + ')</b><span class="rgc-d">A tracking tag from ' + THIRD_PARTY.name + ' that may set cookies and collect your IP address, browser information and the pages you visit, to help us understand which businesses visit our website. Off until you allow it.</span></div>' +
      '<label class="rgc-sw"><input type="checkbox" id="rgc-tp"' + (c && c.thirdParty ? ' checked' : '') + ' aria-label="Allow third-party tracking"><i></i></label></div>' +
      '<div class="rgc-b"><button type="button" class="rgc-btn rgc-yes" data-a="save">Save preferences</button><button type="button" class="rgc-btn" data-a="all">Accept all</button><button type="button" class="rgc-btn" data-a="none">Deny all</button></div>' +
      '<a class="rgc-dns" href="' + POLICY + '">Read the full Privacy Policy</a></div>';
    document.body.appendChild(ov);
    var done = false;
    function close() { if (done) return; done = true; document.removeEventListener('keydown', key, true); ov.classList.remove('in'); setTimeout(function () { if (ov.parentNode) ov.remove(); }, 190); try { if (prev && prev.focus) prev.focus(); } catch (e) { /* gone */ } }
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab') { var f = [].slice.call(ov.querySelectorAll('button,input,a[href]')).filter(function (x) { return !x.disabled; }), i = f.indexOf(document.activeElement); if (!f.length) return; e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    }
    document.addEventListener('keydown', key, true);
    ov.querySelector('.rgc-x').onclick = close;
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
      var k = a.getAttribute('data-a');
      choose(k === 'all' ? true : k === 'none' ? false : ov.querySelector('#rgc-tp').checked); close();
    });
    requestAnimationFrame(function () { ov.classList.add('in'); var f = ov.querySelector('.rgc-yes'); if (f) f.focus(); });
  }

  /* ------------------------------------------------------------ start */
  document.addEventListener('click', function (e) { var l = e.target.closest && e.target.closest('[data-cookie-prefs]'); if (l) { e.preventDefault(); openPrefs(); } });
  window.RGConsent = { get: read, open: openPrefs };
  applyChoice();   // a returning visitor who accepted: the third-party tag loads again
  if (!read()) {
    // first visit: show it once the page loader has gone (never on top of the loading screen)
    var t0 = Date.now(), wait = setInterval(function () {
      if (!document.documentElement.classList.contains('rg-loading') || Date.now() - t0 > 4500) { clearInterval(wait); setTimeout(function () { if (!read()) showBanner(); }, 600); }
    }, 150);
  }
})();

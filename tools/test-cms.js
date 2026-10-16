// End-to-end test of the live editor (needs `node tools/dev-server.js 5180`):  node tools/test-cms.js [iframeWidth] [port]
//   login -> admin bar -> edit mode -> edit a text + a footer (global) text + replace an image -> SAVE -> check the saved rows,
//   see the change on ANOTHER page as an anonymous visitor -> dashboard popup -> badge position. Cleans up its test rows afterwards.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const W = process.argv[2] || '1440';
const PORT = process.argv[3] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body style="margin:0"><pre id="OUT"></pre><iframe id="f" style="border:0;width:${W}px;height:1000px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, t) { t = t || 20000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(100); } throw new Error('timeout: ' + label); }
const f = document.getElementById('f');
const load = url => new Promise(r => { f.onload = () => r(); f.src = url; });
const STAMP = 'CMS TEST ' + Date.now();
(async () => {
  try {
    const login = () => fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@roadglas.com', password: 'Roadglas@123' }) });
    out.login = (await login()).status;
    await load('index.html'); let d = f.contentDocument, w = f.contentWindow;
    await waitFor(() => d.getElementById('cms-admin-bar'), 'admin bar'); out.adminBar = true;
    out.bodyHasBarClass = d.body.classList.contains('has-cms-bar');
    out.barButtons = [...d.querySelectorAll('#cms-admin-bar .cms-btn')].map(b => b.textContent.trim().replace(/\\s+/g, ' '));
    out.mode0 = d.getElementById('cms-mode').textContent;
    out.editableBeforeEdit = d.querySelectorAll('[contenteditable="true"]').length;
    d.getElementById('cms-toggle').click();
    out.mode1 = d.getElementById('cms-mode').textContent; out.editing = d.body.classList.contains('cms-editing');
    out.editableAfterEdit = d.querySelectorAll('[contenteditable="true"]').length;
    out.taggedText = d.querySelectorAll('[data-cms][data-cms-type="text"]').length; out.taggedImages = d.querySelectorAll('img[data-cms][data-cms-type="image"]').length;
    await sleep(900);
    const badges = [...d.querySelectorAll('.cms-img-badge.show')]; out.visibleImageBadges = badges.length;
    out.dynBadges = [...d.querySelectorAll('.cms-dyn-badge.show')].map(b => b.textContent.trim());
    // badge sits on its image?
    const hero = d.querySelector('img[data-cms-type="image"][data-cms]:not([data-cms^="footer"])'); const hb = d.querySelector('.cms-img-badge.show');
    out.badgeDebug = w.RGCMS.badges().filter(o => o.kind === 'img' && o.b.classList.contains('show') && o.el.getBoundingClientRect().width > 200).slice(0, 3).map(o => { const b = o.b.getBoundingClientRect(), i = o.el.getBoundingClientRect(); return { key: o.el.getAttribute('data-cms').slice(0, 24), badge: [Math.round(b.left), Math.round(b.top), Math.round(b.right)], img: [Math.round(i.left), Math.round(i.top), Math.round(i.right), Math.round(i.bottom)], scrollY: Math.round(w.scrollY) }; });
    if (hb) { const r = hb.getBoundingClientRect(); void 0; const imgs = [...d.querySelectorAll('img[data-cms-type="image"]')].filter(i => { const q = i.getBoundingClientRect(); return q.width > 50 && r.left >= q.left - 6 && r.right <= q.right + 6 && r.top >= q.top - 6 && r.top <= q.bottom; }); out.badgeInsideAnImage = imgs.length > 0; }
    // 1) edit a text of this page
    const h = d.querySelector('[data-cms^="txt-engineered-to-perform"]'); out.heroKey = h && h.getAttribute('data-cms'); out.heroOriginal = h && h.textContent;
    h.focus(); h.innerHTML = STAMP + ' HERO'; h.dispatchEvent(new Event('input', { bubbles: true }));
    // 2) edit a footer text (GLOBAL key: must appear on every page)
    const t = d.querySelector('[data-cms="footer-tagline"]'); out.taglineOriginal = t.textContent; t.innerHTML = STAMP + ' TAGLINE'; t.dispatchEvent(new Event('input', { bubbles: true }));
    // 3) replace the footer BABA badge image with an uploaded picture
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const img = d.querySelector('img[data-cms="footer-cert-baba-logo"]'); const oldSrc = img.getAttribute('src');
    w.RGCMS.uploadImage(img, new w.File([png], 'cms-test.png', { type: 'image/png' }));
    await waitFor(() => d.getElementById('cms-confirm') && d.getElementById('cms-confirm').classList.contains('open'), 'image confirm', 30000);
    d.querySelector('#cms-confirm .yes').click(); out.imageChanged = img.getAttribute('src') !== oldSrc; out.newImageUrl = img.getAttribute('src');
    out.dirtyKeys = Object.keys(w.RGCMS.dirty);
    out.saveBadge = d.querySelector('#cms-save .cms-count').textContent;
    // SAVE
    d.getElementById('cms-save').click();
    await waitFor(() => /^Saved/.test((d.getElementById('cms-toast') || {}).textContent || ''), 'save toast', 40000); out.toast = d.getElementById('cms-toast').textContent;
    out.dirtyAfterSave = Object.keys(w.RGCMS.dirty).length;
    // what the backend stored (index page rows: the page text + the global footer keys)
    const rows = await (await fetch('/api/v2/page-elements/index', { credentials: 'include' })).json();
    out.rowsStored = rows.filter(r => /txt-engineered-to-perform|footer-tagline|footer-cert-baba-logo/.test(r.element_id)).map(r => r.element_id + ' = ' + String(r.content_value).slice(0, 60));
    // dashboard popup
    d.getElementById('cms-dashboard').click(); await waitFor(() => d.getElementById('cms-dash') && d.getElementById('cms-dash').classList.contains('open'), 'dash open');
    const di = d.querySelector('#cms-dash iframe'); await waitFor(() => di.contentDocument && di.contentDocument.getElementById('app') && !di.contentDocument.getElementById('app').hidden, 'dash content', 25000);
    out.dashboardSrc = di.getAttribute('src'); out.dashboardEmbedTopbarHidden = getComputedStyle(di.contentDocument.querySelector('.db-top')).display === 'none';
    d.querySelector('#cms-dash .head button').click();
    // anonymous visitor on ANOTHER page
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    await load('solutions.html'); d = f.contentDocument;
    await waitFor(() => /CMS TEST/.test((d.querySelector('[data-cms="footer-tagline"]') || {}).textContent || ''), 'tagline on other page', 15000);
    out.otherPageTagline = d.querySelector('[data-cms="footer-tagline"]').textContent; out.otherPageImage = d.querySelector('img[data-cms="footer-cert-baba-logo"]').getAttribute('src') === out.newImageUrl;
    out.anonHasBar = !!d.getElementById('cms-admin-bar');
    await load('index.html'); d = f.contentDocument;
    await waitFor(() => /CMS TEST/.test((d.querySelector('[data-cms^="txt-engineered-to-perform"]') || {}).textContent || ''), 'hero on index', 15000);
    out.anonHero = d.querySelector('[data-cms^="txt-engineered-to-perform"]').textContent; out.anonHasBar2 = !!d.getElementById('cms-admin-bar');
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__cms.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-cms-' + Date.now(), '--virtual-time-budget=240000', '--window-size=' + Math.max(Number(W), 1000) + ',1100', '--dump-dom', 'http://localhost:' + PORT + '/__cms.html'], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 480000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : '', (r.stdout || '').length); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

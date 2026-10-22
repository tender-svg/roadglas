// Checks the add / remove lists of paving-mat.html and reinforcement-grid.html (real texts as defaults, add / remove buttons in edit mode; nothing is saved; needs `node tools/dev-server.js 5180`):  node tools/test-product-lists.js [port]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1300px;height:900px"></iframe>
<script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
setInterval(() => { document.getElementById('OUT').textContent = JSON.stringify(out); }, 200);
const load = (fr, url) => new Promise(r => { fr.onload = () => r(); fr.src = url; });
async function waitFor(fn, label, t) { t = t || 25000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(100); } throw new Error('timeout: ' + label); }
const LISTS = { stats: '.rg-101', features: '.rg-110', coating: '.rg-127', steps: '.rg-141', faq: 'details.rg-150', table: '.rg-137' };
(async () => {
  try {
    localStorage.clear();
    for (const pg of ['paving-mat.html', 'reinforcement-grid.html']) {
      const r = out[pg] = {};
      const f = document.getElementById('f'); await load(f, pg); const d = f.contentDocument, w = f.contentWindow;
      await waitFor(() => w.RGTPL && !d.documentElement.classList.contains('rg-loading') && d.querySelector('[data-tpl="faq"] details'), 'lists drawn');
      await sleep(500);
      r.hosts = [].map.call(d.querySelectorAll('[data-tpl]'), h => h.getAttribute('data-tpl')).join(',');
      r.counts = {}; Object.keys(LISTS).forEach(n => { r.counts[n] = d.querySelectorAll('[data-tpl="' + n + '"] ' + LISTS[n]).length; });
      r.types = [].map.call(d.querySelectorAll('[data-tpl="types"] [data-ttab]'), b => b.textContent);
      r.viewRes = (d.querySelector('[data-tpl="types"] .rg-121 button') || {}).getAttribute && d.querySelector('[data-tpl="types"] .rg-121 button').getAttribute('data-href');
      r.firstFeature = (d.querySelector('[data-tpl="features"] .rg-112') || {}).textContent;
      r.noEditButtons = d.querySelectorAll('.tp-x, .tp-add').length;
      // edit mode (faked)
      w.RGCMS = Object.assign(w.RGCMS || {}, { editing: true }); d.dispatchEvent(new Event('rg-edit-mode')); await sleep(400);
      r.removeBtns = d.querySelectorAll('.tp-x, .app-x[data-tact]').length; r.addBtns = [].map.call(d.querySelectorAll('.tp-add'), b => b.getAttribute('data-tp') + ':' + b.getAttribute('data-tact')).join(',');
      const n0 = d.querySelectorAll('[data-tpl="features"] .rg-110').length;
      d.querySelector('[data-tp="features"][data-tact="add"]').click(); await sleep(300);
      r.featuresAfterAdd = d.querySelectorAll('[data-tpl="features"] .rg-110').length;
      d.querySelector('[data-tpl="features"] .tp-x[data-tact="del"]').click(); await sleep(500);
      r.dialog = !!d.querySelector('#rgd-ov'); if (r.dialog) { d.querySelector('#rgd-ov .rgd-yes').click(); await sleep(500); }
      r.featuresAfterRemove = d.querySelectorAll('[data-tpl="features"] .rg-110').length; r.featuresStart = n0;
      d.querySelector('[data-tp="table"][data-tact="addrow"]').click(); await sleep(300); r.tableRowsAfterAdd = d.querySelectorAll('[data-tpl="table"] .rg-137').length;
      r.dirtyHook = (w.RGCMS && w.RGCMS.hooks) ? 'hooks' : 'n/a';
    }
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__plists.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-pl-' + Date.now(), '--virtual-time-budget=90000', '--window-size=1400,1000', '--dump-dom', 'http://localhost:' + PORT + '/__plists.html'], { encoding: 'utf8', timeout: 170000, maxBuffer: 50 * 1024 * 1024 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

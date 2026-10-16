// Checks the data cache (js/rg-cache.js) in headless Chrome (needs `node tools/dev-server.js 5180`):  node tools/test-cache.js [port]
// 1st visit: loader + data from the CMS, everything else is cached in the background; 2nd page: drawn from the cache without the loader.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1300px;height:900px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
setInterval(() => { document.getElementById('OUT').textContent = JSON.stringify(out); }, 200);
const f = document.getElementById('f'); const load = url => new Promise(r => { f.onload = () => r(); f.src = url; });
async function waitFor(fn, label, t) { t = t || 20000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(50); } throw new Error('timeout: ' + label); }
(async () => {
  try {
    localStorage.clear();
    // --- first visit: no cache -> loader
    await load('index.html'); let w = f.contentWindow, d = f.contentDocument;
    out.first = { cachedMode: w.RGL.cached, cachedUsed: w.RGL.cachedUsed };
    await waitFor(() => !d.getElementById('rg-loader'), 'loader gone (first)');
    out.first.cardsDrawn = d.querySelectorAll('.rg-31 article').length;
    await sleep(4500);   // background warm-up of the other pages
    const c = JSON.parse(localStorage.getItem('rg-cache-v1') || '{}');
    out.cache = { pages: Object.keys(c.pages || {}).length, lists: Object.keys(c.lists || {}).length, stamp: !!localStorage.getItem('rg-cache-t') };
    // --- second page: from the cache
    await load('about:blank'); await load('solutions.html'); w = f.contentWindow; d = f.contentDocument;
    out.second = { cachedMode: w.RGL.cached, cachedUsed: w.RGL.cachedUsed, htmlClass: d.documentElement.className, loaderShown: !!d.getElementById('rg-loader') && getComputedStyle(d.getElementById('rg-loader')).display !== 'none' };
    await waitFor(() => d.querySelectorAll('.rg-83 article').length > 0, 'solutions drawn');
    out.second.cards = d.querySelectorAll('.rg-83 article').length;
    await waitFor(() => !d.documentElement.classList.contains('rg-cached'), 'page shown');
    out.second.shownAfterMs = 'ok';
    // --- admin flag -> no cache
    localStorage.setItem('rg-admin', '1');
    await load('about:blank'); await load('resources.html'); w = f.contentWindow;
    out.admin = { cachedMode: w.RGL.cached };
    localStorage.clear();
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__cache.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-cache-' + Date.now(), '--virtual-time-budget=120000', '--window-size=1400,1000', '--dump-dom', 'http://localhost:' + PORT + '/__cache.html'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 200000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

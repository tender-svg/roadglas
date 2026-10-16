// Checks the sliders of the home page (applications; the solutions only when there are more than fit in a row; needs `node tools/dev-server.js 5180`):  node tools/test-slider.js [port]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1400px;height:900px"></iframe><iframe id="g" style="width:900px;height:900px"></iframe><iframe id="h" style="width:420px;height:900px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
setInterval(() => { document.getElementById('OUT').textContent = JSON.stringify(out); }, 200);
const load = (fr, url) => new Promise(r => { fr.onload = () => r(); fr.src = url; });
async function waitFor(fn, label, t) { t = t || 25000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(50); } throw new Error('timeout: ' + label); }
const info = (d, root) => { const t = d.querySelector(root + ' .sl-track'); if (!t) return null; const v = d.querySelector(root + ' .sl-view').getBoundingClientRect(); const cards = [...t.children];
  const vis = cards.filter(c => { const r = c.getBoundingClientRect(); return r.left >= v.left - 2 && r.right <= v.right + 2; }).length;
  const prev = d.querySelector(root + ' .sl-prev').getBoundingClientRect(), next = d.querySelector(root + ' .sl-next').getBoundingClientRect(), first = cards[0].getBoundingClientRect();
  return { cards: cards.length, visible: vis, n: t.style.getPropertyValue('--sl-n'), transform: t.style.transform, arrowsOutsideCards: prev.right <= first.left + 1 && next.left >= v.right - 1 }; };
(async () => {
  try {
    localStorage.clear();
    const f = document.getElementById('f'); await load(f, 'index.html'); let d = f.contentDocument;
    await waitFor(() => d.querySelector('.rg-39 .sl-track'), 'applications slider');
    out.solutionsSlider = info(d, '.rg-31'); out.appsWide = info(d, '.rg-39'); await sleep(4400); out.appsAfter4s = info(d, '.rg-39').transform;
    d.querySelector('.rg-39 .sl-next').click(); await sleep(100); out.appsAfterNext = info(d, '.rg-39').transform;
    for (let i = 0; i < 3; i++) d.querySelector('.rg-39 .sl-prev').click(); await sleep(100); out.appsAfter3Prev = info(d, '.rg-39').transform;
    const g = document.getElementById('g'); localStorage.clear(); await load(g, 'index.html'); d = g.contentDocument;
    await waitFor(() => d.querySelector('.rg-39 .sl-track'), 'slider (tablet)'); out.appsTablet = info(d, '.rg-39');
    const h = document.getElementById('h'); localStorage.clear(); await load(h, 'index.html'); d = h.contentDocument;
    await waitFor(() => d.querySelector('.rg-39 .sl-track'), 'slider (phone)'); out.appsPhone = info(d, '.rg-39');
    localStorage.clear();
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__slider.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-sl-' + Date.now(), '--virtual-time-budget=90000', '--window-size=1500,1000', '--dump-dom', 'http://localhost:' + PORT + '/__slider.html'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 150000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

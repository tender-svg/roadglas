// Checks the search box of the Resources page (suggestions after 2 letters, card filter, pick a suggestion, clear; needs `node tools/dev-server.js 5180`):  node tools/test-resources-search.js [port]
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
(async () => {
  try {
    localStorage.clear();
    const f = document.getElementById('f'); await load(f, 'resources.html'); const d = f.contentDocument;
    const inp = await waitFor(() => d.querySelector('[data-rsq]'), 'search input');
    const cards = () => d.querySelectorAll('.rs-res article').length;
    out.cardsAll = cards();
    const type = v => { inp.focus(); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); };
    type('p'); await sleep(100); out.sugAfter1Letter = d.querySelectorAll('.rs-it').length;
    const firstTitle = d.querySelector('.rg-228 .rg-233').textContent;
    const word = firstTitle.trim().slice(0, 2).toLowerCase();
    type(word); await sleep(100);
    out.word = word; out.sugAfter2Letters = d.querySelectorAll('.rs-it').length; out.firstSug = (d.querySelector('.rs-it b') || {}).textContent;
    out.cardsFiltered = cards(); out.inputStillFocused = d.activeElement === inp; out.clearVisible = !d.querySelector('[data-rsx]').hidden;
    type('zzqq'); await sleep(100); out.noMatchMsg = (d.querySelector('.rs-none') || {}).textContent; out.noMatchCards = cards(); out.emptyBox = !!d.querySelector('.rs-res .rg-225');
    type(word); await sleep(100);
    const sug = d.querySelector('.rs-it'); const label = sug && sug.querySelector('b').textContent; if (sug) sug.click(); await sleep(300);
    out.afterPick = { q: d.querySelector('[data-rsq]').value, cards: d.querySelectorAll('.rs-res article').length, activeTab: (d.querySelector('[data-tab]') && [].slice.call(d.querySelectorAll('[data-tab]')).filter(b => /E52C1A|rgb\\(229, 44, 26\\)/.test(b.style.color)).map(b => b.textContent)), pickedLabel: label, sugClosed: !d.querySelector('.rs-it') };
    d.querySelector('[data-rsx]').click(); await sleep(150); out.afterClear = { q: d.querySelector('[data-rsq]').value, cards: d.querySelectorAll('.rs-res article').length };
    out.barRect = (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(d.querySelector('.rs-box').getBoundingClientRect());
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__rsearch.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-rs-' + Date.now(), '--virtual-time-budget=60000', '--window-size=1400,1000', '--dump-dom', 'http://localhost:' + PORT + '/__rsearch.html'], { encoding: 'utf8', timeout: 150000, maxBuffer: 50 * 1024 * 1024 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

// Checks that the public pages show the CMS data (needs `node tools/dev-server.js 5180`):  node tools/test-public.js [port]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1300px;height:900px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, t) { t = t || 20000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(100); } throw new Error('timeout: ' + label); }
setInterval(() => { document.getElementById('OUT').textContent = JSON.stringify(out); }, 200);   // progress is visible even if a step stalls
const f = document.getElementById('f'); const load = url => new Promise(r => { f.onload = () => r(); f.src = url; });
(async () => {
  try {
    let d;
    await load('index.html'); d = f.contentDocument;
    await waitFor(() => d.querySelectorAll('.rg-31 article .rg-37.dyn-h-blue').length === 2, 'home solutions');
    out.home = { solutionCards: d.querySelectorAll('.rg-31 article').length, appButtons: d.querySelectorAll('.rg-39 button').length, firstApp: (d.querySelector('.rg-39 .rg-42') || {}).textContent, solutionLink: d.querySelector('.rg-31 .rg-37').getAttribute('data-href') };
    await load('solutions.html'); d = f.contentDocument; await waitFor(() => d.querySelectorAll('.rg-83 article .rg-49').length >= 4, 'solutions bullets');
    out.solutions = { cards: d.querySelectorAll('.rg-83 article').length, bullets: d.querySelectorAll('.rg-83 .rg-49').length, noImagesTag: !/\\[Images/.test(d.querySelector('.rg-83').textContent) };
    await load('applications.html'); d = f.contentDocument; await waitFor(() => d.querySelectorAll('[data-dyn="app"] [data-app]').length === 6, 'applications');
    const first = d.querySelector('[data-dyn="app"] .rg-159').textContent; d.querySelectorAll('[data-dyn="app"] [data-app]')[3].click(); await sleep(200);
    out.applications = { tabs: 6, firstTitle: first, afterClick: d.querySelector('[data-dyn="app"] .rg-159').textContent, investItems: d.querySelectorAll('[data-dyn="app"] .rg-164').length };
    await load('about:blank'); await load('applications.html#app-2'); d = f.contentDocument; await waitFor(() => d.querySelector('[data-dyn="app"] .rg-159'), 'app hash'); out.applications.hash2 = d.querySelector('[data-dyn="app"] .rg-159').textContent;
    await load('project-highlights.html'); d = f.contentDocument; await waitFor(() => d.querySelectorAll('[data-dyn="pf"] article').length === 3, 'projects');
    const link = d.querySelector('[data-dyn="pf"] article').getAttribute('data-href');
    d.querySelectorAll('[data-dyn="pf"] [data-f]')[1].click(); await sleep(200); const mat = d.querySelectorAll('[data-dyn="pf"] article').length;
    d.querySelector('[data-dyn="pf"] [data-m="list"]').click(); await sleep(200);
    out.projects = { cards: 3, link, matOnly: mat, listStillMat: d.querySelectorAll('[data-dyn="pf"] article').length };
    await load(link); d = f.contentDocument; await waitFor(() => d.querySelector('[data-dyn="pj"] .rg-196'), 'project detail');
    const t0 = d.querySelector('[data-dyn="pj"] .rg-196').textContent; const main0 = d.querySelector('[data-dyn="pj"] .rg-189 img').getAttribute('src');
    d.querySelectorAll('[data-dyn="pj"] .rg-193 button')[2].click(); await sleep(200);
    const main1 = d.querySelector('[data-dyn="pj"] .rg-189 img').getAttribute('src'); const counter = d.querySelector('[data-dyn="pj"] .rg-192').textContent;
    d.querySelectorAll('[data-dyn="pj"] [data-t]')[1].click(); await sleep(200);
    out.projectDetail = { title: t0, heroTitle: d.querySelector('h1').textContent, galleryChanged: main0 !== main1, counter, tab2: d.querySelector('[data-dyn="pj"] .rg-204').textContent, pageTitle: d.title };
    await load('resources.html'); d = f.contentDocument; await waitFor(() => d.querySelectorAll('[data-dyn="res"] .rg-228 article').length === 10, 'resources');
    const c = () => d.querySelectorAll('[data-dyn="res"] .rg-228 article').length; const all = c();
    d.querySelectorAll('[data-dyn="res"] [data-p]')[1].click(); await sleep(200); const matRes = c();
    d.querySelectorAll('[data-dyn="res"] [data-tab]')[1].click(); await sleep(200); const ds = c();
    d.querySelectorAll('[data-dyn="res"] [data-tab]')[2].click(); await sleep(200);
    out.resources = { all, paving: matRes, paving_datasheets: ds, webinarsEmpty: !!d.querySelector('[data-dyn="res"] .rg-225'), webinarTitle: (d.querySelector('[data-dyn="res"] .rg-226') || {}).textContent };
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out);
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__pub.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-pub-' + Date.now(), '--virtual-time-budget=120000', '--window-size=1400,1000', '--dump-dom', 'http://localhost:' + PORT + '/__pub.html'], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 300000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

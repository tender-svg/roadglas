// Tests the lists + section switches of the solution template page (needs `node tools/dev-server.js 5180`):  node tools/test-soltpl.js [port]
// It SAVES to the CMS (page elements "tpl-..." of the page product-detail-roadglas-paving-mat): remove them afterwards (tools/ notes in the session) -
// the test asks the backend only; the cleanup is done by whoever runs it (DELETE of the rows "tpl-*" in cms_page_elements of the roadglas schema).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGE = 'product-detail-roadglas-paving-mat.html';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1400px;height:900px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
setInterval(() => { document.getElementById('OUT').textContent = JSON.stringify(out); }, 200);
const f = document.getElementById('f'); const load = url => new Promise(r => { f.onload = () => r(); f.src = url; });
async function waitFor(fn, label, t) { t = t || 25000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(50); } throw new Error('timeout: ' + label); }
const counts = d => ({ stats: d.querySelectorAll('[data-tpl=stats] .rg-101').length, features: d.querySelectorAll('[data-tpl=features] .rg-110').length, tabs: d.querySelectorAll('[data-tpl=types] [data-ttab]').length, coating: d.querySelectorAll('[data-tpl=coating] .rg-127').length,
  rows: d.querySelectorAll('[data-tpl=table] .rg-137').length, cols: d.querySelectorAll('[data-tpl=table] .rg-135 > span').length, steps: d.querySelectorAll('[data-tpl=steps] .rg-141').length, faq: d.querySelectorAll('[data-tpl=faq] details').length });
(async () => {
  try {
    localStorage.clear();
    await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@roadglas.com', password: 'Roadglas@123' }) });
    localStorage.setItem('rg-admin', '1');
    await load('${PAGE}'); let w = f.contentWindow, d = f.contentDocument; const $ = s => d.querySelector(s);
    w.confirm = () => true;
    await waitFor(() => d.querySelectorAll('[data-tpl=faq] details').length && $('#cms-admin-bar'), 'drawn');
    out.preview = counts(d); out.firstQuestion = $('[data-tpl=faq] summary span').textContent.slice(0, 50); out.noButtonsInPreview = !d.querySelector('.tp-x,.tp-add');
    w.RGCMS.setEditing(true); await sleep(400);
    out.edit = { remove: d.querySelectorAll('.tp-x').length, add: d.querySelectorAll('.tp-add').length, faqOpen: d.querySelectorAll('[data-tpl=faq] details[open]').length };
    const click = s => { const el = $(s); if (!el) throw new Error('no ' + s); el.click(); };
    // Q&A: add a question, write it, remove the first one
    click('[data-tact=add][data-tp=faq]'); await sleep(150);
    const nq = d.querySelectorAll('[data-tpl=faq] details')[6].querySelector('summary span'); nq.textContent = 'ZZ new question'; nq.dispatchEvent(new Event('input', { bubbles: true }));
    click('[data-tact=del][data-tp=faq][data-ti="0"]'); await sleep(150);
    // product types: add a tab, switch to it, rename it, remove tab 1
    click('[data-tact=add][data-tp=types]'); await sleep(150); out.tabsAfterAdd = d.querySelectorAll('[data-ttab]').length;
    const t3 = $('[data-ttab="2"]'); t3.textContent = 'ZZ Type'; t3.dispatchEvent(new Event('input', { bubbles: true }));
    click('[data-tact=del][data-tp=types][data-ti="0"]'); await sleep(150);
    // table: add a row, add a column, remove the last column again, then add one more column
    click('[data-tact=addrow]'); await sleep(100); click('[data-tact=addcol]'); await sleep(100); click('[data-tact=addcol]'); await sleep(100); click('[data-tact=delcol][data-tc="4"]'); await sleep(100);
    // steps + features + stats + coating: add one each
    ['steps', 'features', 'stats', 'coating'].forEach(n => click('[data-tact=add][data-tp=' + n + ']')); await sleep(200);
    out.afterEdit = counts(d); out.dirty = $('#cms-save .cms-count').textContent;
    $('#cms-save').click(); await waitFor(() => /^Saved/.test((d.getElementById('cms-toast') || {}).textContent || ''), 'save', 60000); out.toast = d.getElementById('cms-toast').textContent;
    out.dirtyAfter = $('#cms-save .cms-count').textContent;
    // as a visitor: the saved lists
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }); localStorage.clear();
    await load('about:blank'); await load('${PAGE}'); w = f.contentWindow; d = f.contentDocument;
    await waitFor(() => d.querySelectorAll('[data-tpl=faq] details').length, 'visitor drawn');
    out.visitor = counts(d); out.visitorFirstQ = d.querySelector('[data-tpl=faq] summary span').textContent.slice(0, 40); out.visitorLastQ = [...d.querySelectorAll('[data-tpl=faq] summary span:first-child')].pop().textContent;
    out.visitorTabs = [...d.querySelectorAll('[data-ttab]')].map(b => b.textContent); out.visitorNoUi = !d.querySelector('.tp-x,.tp-add,[contenteditable]');
    // tab switch for a visitor
    d.querySelector('[data-ttab="1"]').click(); await sleep(150); out.tabSwitch = d.querySelector('[data-tpl=types] .rg-86').textContent;
    // sections: switch Product Types and Q&A off for this page (what the Dashboard does), then another solution page keeps them
    await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@roadglas.com', password: 'Roadglas@123' }) });
    const post = await fetch('/api/v2/page-elements', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_slug: 'product-detail-roadglas-paving-mat', element_id: 'tpl-sections', content_type: 'text', content_value: JSON.stringify({ types: false, faq: false }) }) }); out.sectionsSaved = post.status;
    localStorage.clear(); await load('about:blank'); await load('${PAGE}'); d = f.contentDocument;
    await waitFor(() => d.querySelectorAll('[data-tpl=features] .rg-110').length, 'sections page');
    const vis = n => [...d.querySelectorAll('[data-tsec="' + n + '"]')].every(e => getComputedStyle(e).display !== 'none');
    out.sections = { types: vis('types'), faq: vis('faq'), stats: vis('stats'), overview: vis('overview'), coating: vis('coating'), guide: vis('guide') };
    localStorage.clear(); await load('about:blank'); await load('product-detail-roadglas-reinforcement-grid.html'); d = f.contentDocument;
    await waitFor(() => d.querySelectorAll('[data-tpl=faq] details').length, 'other solution');
    out.otherSolution = { types: [...d.querySelectorAll('[data-tsec=types]')].every(e => getComputedStyle(e).display !== 'none'), faq: counts(d).faq };
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }); localStorage.clear();
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__soltpl.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-st-' + Date.now(), '--virtual-time-budget=240000', '--window-size=1500,1000', '--dump-dom', 'http://localhost:' + PORT + '/__soltpl.html'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 300000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

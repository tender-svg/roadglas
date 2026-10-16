// Checks the case-study PDF of a project highlight page (public link, edit-mode upload / replace / remove; the upload is faked, nothing is saved; needs `node tools/dev-server.js 5180`):  node tools/test-case-study.js [port]
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
    const f = document.getElementById('f'); await load(f, 'project-highlight.html'); const d = f.contentDocument, w = f.contentWindow;
    await waitFor(() => d.querySelector('.rg-200 a'), 'download link');
    out.publicLink = d.querySelector('.rg-200 a').getAttribute('href'); out.publicIsAnchor = d.querySelector('.rg-200 a').tagName;
    // edit mode (faked): the button becomes an upload button
    w.RGCMS = Object.assign(w.RGCMS || {}, { editing: true }); d.dispatchEvent(new Event('rg-edit-mode'));
    const btn = await waitFor(() => d.querySelector('.rg-200 button[data-eact="file"]'), 'edit button');
    out.editButtonAccept = btn.getAttribute('data-accept'); out.stripBefore = (d.querySelector('.rg-194 .app-strip') || {}).textContent;
    let picked = 0; w.RGE.pickFile = (acc) => { picked++; out.pickAccept = acc; return Promise.resolve(new w.File(['%PDF-1.4'], 'My Case Study.pdf', { type: 'application/pdf' })); };
    w.RGE.upload = (file, folder) => { out.uploadFolder = folder; out.uploadName = file.name; return Promise.resolve('https://files.example.com/projects/My%20Case%20Study.pdf'); };
    btn.click(); await sleep(400);
    out.stripAfterUpload = (d.querySelector('.rg-194 .app-strip') || {}).textContent; out.removeBtn = !!d.querySelector('[data-eact="clear"]');
    // back to public view: the link must now point to the uploaded PDF
    w.RGCMS.editing = false; d.dispatchEvent(new Event('rg-edit-mode')); await sleep(300);
    out.publicLinkAfter = (d.querySelector('.rg-200 a') || {}).getAttribute && d.querySelector('.rg-200 a').getAttribute('href');
    // edit again and remove
    w.RGCMS.editing = true; d.dispatchEvent(new Event('rg-edit-mode')); await sleep(300);
    d.querySelector('[data-eact="clear"]').click(); await sleep(300);
    out.stripAfterRemove = (d.querySelector('.rg-194 .app-strip') || {}).textContent; out.removeBtnAfter = !!d.querySelector('[data-eact="clear"]');
    w.RGCMS.editing = false; d.dispatchEvent(new Event('rg-edit-mode')); await sleep(300);
    out.publicLinkRemoved = d.querySelector('.rg-200 a').getAttribute('href');
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__cstudy.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-cs-' + Date.now(), '--virtual-time-budget=60000', '--window-size=1400,1000', '--dump-dom', 'http://localhost:' + PORT + '/__cstudy.html'], { encoding: 'utf8', timeout: 150000, maxBuffer: 50 * 1024 * 1024 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

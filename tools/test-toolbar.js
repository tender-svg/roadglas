// Tests the text format toolbar of the live editor (js/rg-toolbar.js) in headless Chrome (needs `node tools/dev-server.js 5180`):  node tools/test-toolbar.js [port]
// Nothing is saved to the CMS: the changes are only made in the page and checked.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1400px;height:900px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
setInterval(() => { document.getElementById('OUT').textContent = JSON.stringify(out); }, 200);
const f = document.getElementById('f'); const load = url => new Promise(r => { f.onload = () => r(); f.src = url; });
async function waitFor(fn, label, t) { t = t || 20000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(50); } throw new Error('timeout: ' + label); }
(async () => {
  try {
    localStorage.clear();
    await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@roadglas.com', password: 'Roadglas@123' }) });
    localStorage.setItem('rg-admin', '1');
    await load('index.html'); const w = f.contentWindow, d = f.contentDocument;
    const $ = s => d.querySelector(s);
    await waitFor(() => $('#cms-text-toolbar') && w.RGCMS && w.RGCMS.setEditing, 'toolbar');
    out.preview = { off: $('#cms-text-toolbar').classList.contains('off') };
    w.RGCMS.setEditing(true); await sleep(300);
    out.edit = { off: $('#cms-text-toolbar').classList.contains('off'), tools: ['[data-cmd=bold]', '[data-cmd=italic]', '#rgtb-align', '#rgtb-case', '#rgtb-font', '#rgtb-size', '#rgtb-up', '#rgtb-down', '#rgtb-color', '[data-cmd=reset]'].filter(s => !$(s)) };
    // a plain paragraph of the home page
    const p = [...d.querySelectorAll('p[data-cms][contenteditable="true"]')].find(e => e.textContent.trim().length > 40);
    out.target = p.textContent.slice(0, 40);
    const cs = d.defaultView.getComputedStyle(p);
    const select = (el, a, b) => { const w2 = d.createTreeWalker(el, NodeFilter.SHOW_TEXT); let i = 0, n, sn, so, en, eo; while ((n = w2.nextNode())) { const l = n.textContent.length; if (!sn && i + l > a) { sn = n; so = a - i; } if (!en && i + l >= b) { en = n; eo = b - i; break; } i += l; } const r = d.createRange(); r.setStart(sn, so); r.setEnd(en, eo); const s = d.defaultView.getSelection(); el.focus(); s.removeAllRanges(); s.addRange(r); d.dispatchEvent(new Event('selectionchange')); };
    select(p, 0, 12); await sleep(200);
    out.reflect = { size: $('#rgtb-size').value, expectSize: parseInt(cs.fontSize, 10), font: $('#rgtb-font').value, expectFont: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), swatch: $('#rgtb-color').style.background, boldActive: $('[data-cmd=bold]').classList.contains('active'), italicActive: $('[data-cmd=italic]').classList.contains('active') };
    // size 31 on the selection
    const size = $('#rgtb-size'); size.value = '31'; size.dispatchEvent(new Event('input', { bubbles: true })); await sleep(150);
    out.size = { html: p.innerHTML.slice(0, 120), dirty: Object.keys(w.RGCMS.dirty).length };
    // size arrows
    $('#rgtb-up').click(); await sleep(100); out.sizeUp = $('#rgtb-size').value;
    // bold on the selection (toggle)
    select(p, 0, 12); await sleep(100);
    $('[data-cmd=bold]').click(); await sleep(150); out.bold = { html: p.innerHTML.slice(0, 160), active: $('[data-cmd=bold]').classList.contains('active') };
    // italic
    select(p, 0, 12); await sleep(100); $('[data-cmd=italic]').click(); await sleep(150); out.italic = { html: p.innerHTML.slice(0, 200) };
    // font
    select(p, 0, 12); await sleep(100); const fs2 = $('#rgtb-font'); fs2.value = 'Georgia'; fs2.dispatchEvent(new Event('change', { bubbles: true })); await sleep(150);
    out.font = { html: p.innerHTML.slice(0, 220), reflected: (select(p, 2, 6), true) }; await sleep(150); out.font.shown = $('#rgtb-font').value;
    // colour picker: open, type 255 / 0 / 0, apply
    select(p, 0, 12); await sleep(100); $('#rgtb-color').click(); await sleep(150);
    const pk = d.getElementById('rgtb-picker'); out.picker = !!pk;
    if (pk) { const ins = pk.querySelectorAll('input'); ins[0].value = '255'; ins[1].value = '0'; ins[2].value = '0'; ins[0].dispatchEvent(new Event('input', { bubbles: true })); await sleep(100); pk.querySelector('.yes').click(); await sleep(150); }
    out.color = { html: p.innerHTML.slice(0, 260), picker_closed: !d.getElementById('rgtb-picker'), swatch: $('#rgtb-color').style.background };
    // align centre
    $('#rgtb-align').click(); await sleep(100); const opt = d.querySelector('#rgtb-align-menu [data-align="center"]'); out.alignMenuShown = !d.getElementById('rgtb-align-menu').hidden; opt.click(); await sleep(150);
    out.align = { style: p.style.textAlign, computed: d.defaultView.getComputedStyle(p).textAlign };
    // case: UPPERCASE on the selection
    select(p, 0, 12); await sleep(100); $('#rgtb-case').click(); await sleep(100); d.querySelector('#rgtb-case-menu [data-case="upper"]').click(); await sleep(150);
    out.caseUpper = p.textContent.slice(0, 20);
    out.dirtyKeys = Object.keys(w.RGCMS.dirty).length;
    // the value that SAVE would send keeps the formatting
    out.savedHasStyle = /style=/.test(p.innerHTML);
    // reset
    $('[data-cmd=reset]').click(); await sleep(150); out.reset = { html: p.innerHTML.slice(0, 60), text: p.textContent.slice(0, 20) };
    // a heading: toolbar shows bold + big size
    const h = [...d.querySelectorAll('h1[data-cms][contenteditable="true"],h2[data-cms][contenteditable="true"]')][0];
    if (h) { select(h, 0, 3); await sleep(200); out.heading = { tag: h.tagName, size: $('#rgtb-size').value, bold: $('[data-cmd=bold]').classList.contains('active'), font: $('#rgtb-font').value }; }
    // preview mode: the toolbar is dim again
    w.RGCMS.setEditing(false); await sleep(200); out.afterPreview = $('#cms-text-toolbar').classList.contains('off');
    localStorage.clear();
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__tb.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-tb-' + Date.now(), '--virtual-time-budget=120000', '--window-size=1500,1000', '--dump-dom', 'http://localhost:' + PORT + '/__tb.html'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 200000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

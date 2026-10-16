// checks every page for horizontal overflow at several screen widths (each page is loaded in an iframe of that width)
//   node tools/test-responsive.js [widths comma separated]      e.g. node tools/test-responsive.js 360,390,768
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const widths = (process.argv[2] || '360,390,768,1024,1440').split(',').map(Number);
const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !f.startsWith('__'));

const harness = `<!DOCTYPE html><html><body style="margin:0"><pre id="OUT"></pre><iframe id="f" style="border:0;position:absolute;left:0;top:0;height:900px"></iframe><script>
const pages = ${JSON.stringify(pages)}, widths = ${JSON.stringify(widths)};
const out = {}; let pi = 0, wi = 0;
const f = document.getElementById('f');
function next() {
  if (pi >= pages.length) { document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE'; return; }
  f.style.width = widths[wi] + 'px'; f.src = pages[pi] + '?w=' + widths[wi];
}
f.onload = () => setTimeout(() => {
  const d = f.contentDocument, W = widths[wi];
  const sw = d.documentElement.scrollWidth, bad = [];
  d.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') { let p = el, clipped = false; while ((p = p.parentElement)) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll') { clipped = true; break; } } if (!clipped) bad.push((el.className || el.tagName) + ' ' + Math.round(r.right)); } });
  (out[pages[pi]] = out[pages[pi]] || {})[W] = { overflow: sw > W + 1 ? sw : 0, wide: bad.slice(0, 3) };
  if (++wi >= widths.length) { wi = 0; pi++; }
  next();
}, 400);
next();
</script></body></html>`;

fs.writeFileSync(path.join(ROOT, '__rwd.html'), harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-rwd-' + Date.now(), '--allow-file-access-from-files',
  '--virtual-time-budget=300000', '--window-size=1600,1000', '--dump-dom', 'file:///' + ROOT.replace(/\\/g, '/') + '/__rwd.html'], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024, timeout: 580000 });
fs.unlinkSync(path.join(ROOT, '__rwd.html'));
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : '', (r.stdout || '').length); process.exit(1); }
const res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
let problems = 0;
for (const p of pages) {
  const line = widths.map(w => { const o = res[p] && res[p][w]; if (!o) return w + ':?'; if (o.overflow) { problems++; return w + ':OVERFLOW(' + o.overflow + ') ' + o.wide.join(', '); } return w + ':ok'; }).join('  ');
  console.log(p.padEnd(28), line);
}
console.log(problems ? problems + ' overflow case(s)' : 'no horizontal overflow at: ' + widths.join(', '));

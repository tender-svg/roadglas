// screenshot helper:  node tools/shot.js <page.html> <width> <height> <out.png> [open-menu]
// the page is shown inside an iframe of exactly <width> px so phone widths are real (a headless window is never narrower than ~500px)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const [page, w, h, out, openMenu] = process.argv.slice(2);
const html = `<!DOCTYPE html><html><body style="margin:0;background:#888"><iframe id="f" src="${page}" style="border:0;width:${w}px;height:${h}px;display:block"></iframe>
<script>${openMenu ? "document.getElementById('f').onload=()=>{const b=document.getElementById('f').contentDocument.querySelector('.rg-burger');if(b)b.click();};" : ''}</script></body></html>`;
const tmp = path.join(ROOT, '__shot.html');
fs.writeFileSync(tmp, html);
const win = Math.max(Number(w), 520);
spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-shot-' + Date.now(), '--allow-file-access-from-files', '--hide-scrollbars',
  '--window-size=' + win + ',' + h, '--virtual-time-budget=12000', '--screenshot=' + out, 'file:///' + ROOT.replace(/\\/g, '/') + '/__shot.html'], { timeout: 120000 });
fs.unlinkSync(tmp);
console.log(fs.existsSync(out) ? 'saved ' + out : 'FAILED');

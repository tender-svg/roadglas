// node tools/build-dist.js
// Regenerates the pages, then copies everything the live site needs into ./dist
// (pages, css, js, images, brochure, vercel.json). tools/, _original/ and notes are left out.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

execFileSync(process.execPath, [path.join(__dirname, 'build-pages.js')], { stdio: 'ignore' });

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);

const FOLDERS = ['css', 'js', 'images'];
const FILE_RE = /\.(html|pdf)$|^vercel\.json$/;

let files = 0;
for (const f of fs.readdirSync(ROOT)) {
  if (FILE_RE.test(f) && fs.statSync(path.join(ROOT, f)).isFile()) { fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f)); files++; }
}
for (const d of FOLDERS) {
  fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });
}
console.log('dist ready: ' + files + ' root files + ' + FOLDERS.join(', '));

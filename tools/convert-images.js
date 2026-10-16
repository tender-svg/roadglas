// converts every JPG/PNG in ../images to WebP (same pixel size, visually lossless); originals are moved to ../_original/images
//   node tools/convert-images.js            JPG -> WebP quality 85, PNG -> lossless WebP
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMG = path.join(__dirname, '..', 'images');
const ORIG = path.join(__dirname, '..', '_original', 'images');
fs.mkdirSync(ORIG, { recursive: true });

(async () => {
  const rows = [];
  let before = 0, after = 0;
  for (const f of fs.readdirSync(IMG)) {
    const ext = path.extname(f).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
    const src = path.join(IMG, f);
    const out = path.join(IMG, path.basename(f, ext) + '.webp');
    // already converted on an earlier run (webp exists and the original is backed up): just remove the leftover source
    if (fs.existsSync(out) && fs.existsSync(path.join(ORIG, f))) { try { fs.unlinkSync(src); } catch (e) { /* ignore */ } continue; }
    const img = sharp(fs.readFileSync(src), { failOn: 'none' }); // from a buffer: no open file handle (Windows cannot delete open files)
    const meta = await img.metadata();
    const opts = ext === '.png'
      ? { lossless: true, effort: 6 }
      : { quality: 85, effort: 6, smartSubsample: true };
    await img.webp(opts).toFile(out);
    const a = fs.statSync(src).size, b = fs.statSync(out).size;
    // keep the smaller one if (rarely) WebP came out bigger than the original
    if (b >= a) { fs.unlinkSync(out); rows.push([f, 'kept original (webp not smaller)', a, a, meta.width + 'x' + meta.height]); continue; }
    fs.copyFileSync(src, path.join(ORIG, f));
    fs.unlinkSync(src);
    before += a; after += b;
    rows.push([f + ' -> ' + path.basename(out), ext === '.png' ? 'lossless' : 'q85', a, b, meta.width + 'x' + meta.height]);
  }
  const kb = n => Math.round(n / 1024) + ' KB';
  rows.forEach(r => console.log(r[0].padEnd(44), String(r[1]).padEnd(10), kb(r[2]).padStart(8), '->', kb(r[3]).padStart(8), ' ', r[4]));
  console.log('TOTAL', (before / 1048576).toFixed(1) + ' MB ->', (after / 1048576).toFixed(1) + ' MB  (saved ' + Math.round((1 - after / before) * 100) + '%)');
})();

// Brings every image in ../images that is bigger than 100 KB under 100 KB (the same rule the CMS upload uses): node tools/compress-images.js
//  - WebP, longest side at most 1920 px; the quality goes down step by step to 50 first, then the picture is made smaller (x0.8) until it fits (not below 480 px)
//  - transparency is kept; originals are copied to ../../RoadGlas_images_backup/images-before-compress (outside the project) first (never overwritten)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMG = path.join(__dirname, '..', 'images');
const BAK = path.join(__dirname, '..', '..', 'RoadGlas_images_backup', 'images-before-compress');
const TARGET = 100 * 1024, MAX_DIM = 1920, MIN_DIM = 480, QUALITIES = [80, 72, 65, 58, 50];
fs.mkdirSync(BAK, { recursive: true });

(async () => {
  const rows = []; let before = 0, after = 0;
  for (const f of fs.readdirSync(IMG).sort()) {
    const file = path.join(IMG, f), ext = path.extname(f).toLowerCase();
    if (!['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) continue;
    const size = fs.statSync(file).size; if (size <= TARGET) continue;
    const buf = fs.readFileSync(file);                               // read from a buffer: no open handle on Windows
    const meta = await sharp(buf).metadata();
    if (!fs.existsSync(path.join(BAK, f))) fs.writeFileSync(path.join(BAK, f), buf);
    let dim = Math.min(Math.max(meta.width, meta.height), MAX_DIM), best = null, q = 0;
    for (;;) {
      const img = sharp(buf).rotate().resize({ width: meta.width >= meta.height ? dim : null, height: meta.height > meta.width ? dim : null, withoutEnlargement: true });
      for (q of QUALITIES) {
        best = await img.clone().webp({ quality: q, effort: 6, smartSubsample: true, alphaQuality: 90 }).toBuffer();
        if (best.length <= TARGET) break;
      }
      if (best.length <= TARGET || dim <= MIN_DIM) break;
      dim = Math.max(MIN_DIM, Math.round(dim * 0.8));
    }
    if (best.length >= size) { rows.push([f, 'kept (not smaller)', size, size, '']); continue; }
    const out = ext === '.webp' ? file : path.join(IMG, path.basename(f, ext) + '.webp');
    fs.writeFileSync(out, best); if (out !== file) fs.unlinkSync(file);
    const m2 = await sharp(best).metadata();
    before += size; after += best.length;
    rows.push([f, 'q' + q, size, best.length, meta.width + 'x' + meta.height + ' -> ' + m2.width + 'x' + m2.height]);
  }
  const kb = n => Math.round(n / 1024) + ' KB';
  rows.forEach(r => console.log(r[0].padEnd(28), String(r[1]).padEnd(18), kb(r[2]).padStart(7), '->', kb(r[3]).padStart(7), ' ', r[4]));
  console.log('TOTAL', kb(before), '->', kb(after), ' (' + rows.length + ' files)');
})();

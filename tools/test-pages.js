// headless-Chrome smoke test of the interactions (clicks are done by JS inside a temporary copy of each page)
//   node tools/test-pages.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// each test: page file + a function body (runs in the page, after site.js) that returns an object of observations
const TESTS = {
  'paving-mat.html': `
    const r = {};
    const ty = [...document.querySelectorAll('[data-vgroup="ty"]:not([hidden]) button[data-set]')]; r.typeTabs = ty.length;
    const before = document.querySelector('[data-vgroup="ty"]:not([hidden])').textContent.slice(0,60);
    ty[1].click(); r.typeChanged = before !== document.querySelector('[data-vgroup="ty"]:not([hidden])').textContent.slice(0,60);
    r.faqOpenStart = document.querySelectorAll('[data-vgroup="faq"]:not([hidden]) p').length;
    const q = [...document.querySelectorAll('[data-vgroup="faq"]:not([hidden]) button[data-set]')]; r.faqButtons = q.length;
    q[2].click(); r.faqAfter = document.querySelectorAll('[data-vgroup="faq"]:not([hidden]) p').length;
    r.visibleFaqBlocks = document.querySelectorAll('[data-vgroup="faq"]:not([hidden])').length;
    return r;`,
  'reinforcement-grid.html': `
    const r = {}; const ty = [...document.querySelectorAll('[data-vgroup="ty"]:not([hidden]) button[data-set]')]; r.typeTabs = ty.length; ty[1].click();
    r.visibleTy = document.querySelectorAll('[data-vgroup="ty"]:not([hidden])').length; return r;`,
  'contact.html': `
    const r = {}; const form = document.querySelector('form[data-submit="contact"]');
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    r.errorsAfterEmpty = [...form.querySelectorAll('span')].filter(s => /Required|valid/.test(s.textContent)).map(s => s.textContent);
    const set = (k, v) => { form.querySelector('[data-f="' + k + '"]').value = v; };
    set('first', 'Asha'); set('last', 'K'); set('email', 'bad'); set('message', 'hi');
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    r.badEmail = [...form.querySelectorAll('span')].map(s => s.textContent).filter(t => /valid/.test(t));
    set('email', 'a@b.co'); form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    const sent = document.querySelector('[data-vgroup="sent"]:not([hidden])'); r.sentBlock = sent && sent.textContent.trim().slice(0, 40);
    r.formHidden = !document.querySelector('[data-vgroup="sent"]:not([hidden]) form');
    document.querySelector('[data-act="form-reset"]').click(); r.formBack = !!document.querySelector('[data-vgroup="sent"]:not([hidden]) form');
    return r;`,
  'lunch-learn.html': `
    const r = {}; const form = document.querySelector('form[data-submit="lunch"]');
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    r.errors = [...form.querySelectorAll('span')].filter(s => /Required|valid|confirm/.test(s.textContent)).length;
    r.fields = form.querySelectorAll('[data-f]').length;
    r.scrollBtn = !!document.querySelector('[data-scroll="lunch-form"]'); r.target = !!document.getElementById('lunch-form');
    return r;`,
  'credit-application.html': `
    const r = {}; const form = document.querySelector('form[data-submit="credit"]');
    r.fields = form.querySelectorAll('[data-f]').length;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    r.errors = [...form.querySelectorAll('span')].filter(s => /Required|valid|confirm/.test(s.textContent)).length;
    const b = document.querySelector('[data-act="toggle-sale"]'); const terms = document.querySelector('[data-sale]');
    r.saleStart = terms.hidden; b.click(); r.saleAfter = terms.hidden; r.label = b.textContent.slice(0, 12);
    return r;`,
  'index.html': `
    const r = {}; const dots = [...document.querySelectorAll('.rg-25 button')]; r.dots = dots.length;
    dots[2].click(); r.activeDotWidth = dots[2].style.width;
    const hero = document.querySelector('section[data-screen-label="Home hero"]');
    r.slideOpacity = [...hero.children].filter(c => c.style.position === 'absolute').map(c => c.style.opacity).join(',');
    const track = document.querySelector('[data-hover-on="benPause"]').firstElementChild; const t0 = track.style.transform;
    document.querySelector('[data-act="ben-next"]').click(); r.carouselMoved = t0 !== track.style.transform;
    const dd = document.querySelector('[data-dd]'); r.ddHiddenStart = dd.hidden; dd.parentElement.querySelector('button').click(); r.ddOpen = !dd.hidden;
    return r;`,
};

function runPage(file, code) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const tmp = '__t_' + file;
  const script = `<script defer>window.addEventListener('load', () => setTimeout(() => { let out; try { out = (function(){${code}})(); } catch (e) { out = { ERROR: String(e && e.stack || e) }; } const pre = document.createElement('pre'); pre.id = 'TESTRESULT'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre); }, 300));</script>`;
  fs.writeFileSync(path.join(ROOT, tmp), html.replace('</body>', script + '</body>'));
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-t-' + Date.now(),
    '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', 'file:///' + ROOT.replace(/\\/g, '/') + '/' + tmp], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 90000 });
  fs.unlinkSync(path.join(ROOT, tmp));
  const m = /<pre id="TESTRESULT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : 'NO RESULT (page JS error?) ' + (r.error ? r.error.message : '');
}

const only = process.argv[2];
for (const [file, code] of Object.entries(TESTS)) {
  if (only && file !== only) continue;
  console.log(file.padEnd(28), runPage(file, code));
}

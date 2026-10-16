// End-to-end test of the CMS dashboard in headless Chrome (needs `node tools/dev-server.js 5180` running):
// signs in, opens the dashboard, and for each section: add -> edit -> delete (and one image upload). Cleans up after itself.
//   node tools/test-dashboard.js [port]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1200px;height:900px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, t) { t = t || 20000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(100); } throw new Error('timeout: ' + label); }
(async () => {
  try {
    const lr = await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@roadglas.com', password: 'Roadglas@123' }) });
    out.login = lr.status;
    const f = document.getElementById('f'); f.src = 'dashboard.html'; await new Promise(r => { f.onload = r; });
    const d = f.contentDocument, w = f.contentWindow; w.confirm = () => true;
    await waitFor(() => !d.getElementById('app').hidden, 'dashboard visible');
    out.who = d.getElementById('who').textContent;
    await waitFor(() => [...d.querySelectorAll('#side .db-count')].every(c => /\\d/.test(c.textContent)), 'counts loaded');
    out.counts = [...d.querySelectorAll('#side button')].map(b => b.textContent.trim().replace(/\\s+/g, ' '));
    const rows = () => d.querySelectorAll('.db-table tbody tr').length;
    const setv = (name, v) => { const el = d.getElementById('editor').elements[name]; if (!el) throw new Error('no field ' + name); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; };
    const submit = () => d.getElementById('editor').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    async function cycle(key, fields, editField, expectBefore) {
      const r = {};
      d.querySelector('[data-go=' + key + ']').click();
      await waitFor(() => d.querySelector('.db-head h1') && rows() >= expectBefore, key + ' list');
      r.before = rows();
      d.querySelector('[data-add=' + key + ']').click(); await waitFor(() => !d.getElementById('modal').hidden, key + ' modal');
      Object.keys(fields).forEach(k => setv(k, fields[k]));
      if (key === 'applications') { // image upload through the form
        const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
        const dt = new DataTransfer(); dt.items.add(new File([png], 'cms-test.png', { type: 'image/png' }));
        const inp = d.querySelector('[data-up="image"] input[type=file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => /^https?:/.test(d.getElementById('editor').elements.image.value), 'image upload', 25000);
        r.uploadedUrl = d.getElementById('editor').elements.image.value.replace(/.*\\/(cms_upload_[^/]+)\\//, '$1/');
      }
      submit(); await waitFor(() => d.getElementById('modal').hidden, key + ' saved');
      await waitFor(() => rows() === r.before + 1, key + ' row added', 25000); r.afterAdd = rows();
      const tr = [...d.querySelectorAll('.db-table tbody tr')].find(x => x.textContent.indexOf(fields.title) >= 0); r.found = !!tr;
      tr.querySelector('[data-edit]').click(); await waitFor(() => !d.getElementById('modal').hidden, key + ' edit modal');
      r.editFormTitle = d.getElementById('editor').elements.title.value === fields.title;
      setv('title', fields.title + ' EDITED'); submit(); await waitFor(() => d.getElementById('modal').hidden, key + ' edit saved');
      await waitFor(() => [...d.querySelectorAll('.db-table tbody tr')].some(x => x.textContent.indexOf('EDITED') >= 0), key + ' edit shown', 25000); r.edited = true;
      const tr2 = [...d.querySelectorAll('.db-table tbody tr')].find(x => x.textContent.indexOf('EDITED') >= 0);
      tr2.querySelector('[data-del]').click();
      await waitFor(() => rows() === r.before, key + ' deleted', 25000); r.afterDelete = rows();
      return r;
    }
    const T = 'ZZ CMS test ' + Date.now();
    out.applications = await cycle('applications', { title: T, short: 'Test', description: 'test description', invest: 'one\\ntwo', triggers: 'a\\nb', display_order: 99, is_active: true }, 'title', 6);
    out.solutions = await cycle('solutions', { title: T, category: 'Test kicker', short_description: 'test tagline', product_family: 'other', custom_link: 'paving-mat.html', display_order: 99, is_active: true }, 'title', 2);
    out.stories = await cycle('stories', { title: T, location: 'Test City', year: '2026', owner: 'Test Owner', product: 'mat', products_used: 'RoadGlas', challenge_title: 'Challenge', challenge_text: 'ct', solution_text: 'st' }, 'title', 3);
    out.resources = await cycle('resources', { title: T, document_type: 'Data Sheet', product: 'grid', description: 'test doc', file_url: '/roadglas-brochure.pdf', is_active: true }, 'title', 10);
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__dash.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-dash-' + Date.now(), '--virtual-time-budget=240000', '--window-size=1300,1000', '--dump-dom', 'http://localhost:' + PORT + '/__dash.html'], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 480000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : '', (r.stdout || '').length); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

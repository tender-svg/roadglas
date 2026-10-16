// End-to-end test of the inline editing of the Applications page (needs `node tools/dev-server.js 5180`):  node tools/test-apps-edit.js [port]
// edits an application (title, description, tab name, points), adds / removes points, adds a new application, SAVE, checks the CMS,
// then undoes everything (restores the first application, deletes the new one) and checks the data is exactly as before.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.argv[2] || '5180';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harness = `<!DOCTYPE html><html><body><pre id="OUT"></pre><iframe id="f" style="width:1300px;height:1000px"></iframe><script>
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
setInterval(() => { document.getElementById('OUT').textContent = JSON.stringify(out); }, 200);
async function waitFor(fn, label, t) { t = t || 25000; const s = Date.now(); while (Date.now() - s < t) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(100); } throw new Error('timeout: ' + label); }
const f = document.getElementById('f'); const load = url => new Promise(r => { f.onload = () => r(); f.src = url; });
const snap = async () => (await (await fetch('/api/v2/applications', { credentials: 'include', cache: 'no-store' })).json()).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(a => ({ title: a.title, description: a.description, image_url: a.image_url, tabs: JSON.stringify(a.application_tabs) }));
(async () => {
  try {
    const before = await snap(); out.appsBefore = before.length;
    await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@roadglas.com', password: 'Roadglas@123' }) });
    await load('applications.html'); let d = f.contentDocument, w = f.contentWindow;
    w.confirm = () => true;
    const H = () => d.querySelector('[data-dyn="app"]');
    await waitFor(() => d.getElementById('cms-admin-bar') && H() && H().querySelectorAll('[data-app]').length === 6, 'page ready');
    out.editableBefore = H().querySelectorAll('[contenteditable="true"]').length;
    w.RGCMS.setEditing(true); await sleep(300);
    out.editableAfter = H().querySelectorAll('[contenteditable="true"]').length;
    out.hasStrip = !!H().querySelector('.app-strip'); out.hasAddBtn = !!H().querySelector('[data-eact="add"]'); out.hasPhotoBtn = !!H().querySelector('[data-eact="photo"]');
    out.removeButtons = H().querySelectorAll('.app-x').length; out.addPointButtons = H().querySelectorAll('[data-act="addli"]').length;
    out.fixedHeadingsEditable = [...H().querySelectorAll('[data-cms]')].map(e => e.getAttribute('data-cms') + ':' + e.getAttribute('contenteditable')).join(' | ');
    const type = (el, text) => { el.focus(); el.textContent = text; el.dispatchEvent(new Event('input', { bubbles: true })); };
    const tabBtn = i => H().querySelectorAll('[data-app]')[i];
    // --- application 1 (tab 0): title, description, tab name, edit a point, add a point, remove a point
    const origInvest0 = [...H().querySelectorAll('[data-arr="invest"]')].map(e => e.textContent);
    type(H().querySelector('[data-e="title"]'), 'ZZ Title Edited');
    type(H().querySelector('[data-e="desc"]'), 'ZZ Description edited');
    const sh = H().querySelector('input[data-e="short"]'); sh.value = 'ZZTab'; sh.dispatchEvent(new Event('input', { bubbles: true }));
    out.tabLabelLive = tabBtn(0).textContent;
    type(H().querySelectorAll('[data-arr="invest"]')[0], 'ZZ first point edited');
    H().querySelector('[data-eact="addarr"][data-field="invest"]').click(); await sleep(150);
    const items = H().querySelectorAll('[data-arr="invest"]'); out.itemsAfterAdd = items.length; type(items[items.length - 1], 'ZZ added point');
    H().querySelector('[data-eact="rmarr"][data-field="invest"][data-i="1"]').click(); await sleep(150); out.itemsAfterRemove = H().querySelectorAll('[data-arr="invest"]').length;
    out.dirtyBadge1 = d.querySelector('#cms-save .cms-count').textContent;
    // --- switch to tab 3 and edit a trigger, then back: edits of tab 0 must still be there
    tabBtn(3).click(); await sleep(200);
    type(H().querySelectorAll('[data-arr="triggers"]')[0], 'ZZ trigger edited on tab 3'); out.tab3Title = H().querySelector('[data-e="title"]').textContent;
    tabBtn(0).click(); await sleep(200);
    out.tab0KeptTitle = H().querySelector('[data-e="title"]').textContent; out.tab0KeptFirstPoint = H().querySelectorAll('[data-arr="invest"]')[0].textContent;
    out.dirtyBadge2 = d.querySelector('#cms-save .cms-count').textContent;
    // --- a NEW application
    H().querySelector('[data-eact="add"]').click(); await sleep(200);
    out.tabsAfterAdd = H().querySelectorAll('[data-app]').length;
    type(H().querySelector('[data-e="title"]'), 'ZZ Brand new application');
    type(H().querySelector('[data-e="desc"]'), 'ZZ new description');
    type(H().querySelectorAll('[data-arr="invest"]')[0], 'ZZ new point one');
    out.dirtyBadge3 = d.querySelector('#cms-save .cms-count').textContent;
    // --- SAVE
    d.getElementById('cms-save').click();
    await waitFor(() => /^Saved/.test((d.getElementById('cms-toast') || {}).textContent || ''), 'save toast', 60000); out.toast = d.getElementById('cms-toast').textContent;
    out.dirtyAfterSave = d.querySelector('#cms-save .cms-count').textContent;
    const mid = await snap(); out.appsAfterSave = mid.length;
    const a0 = mid.find(a => a.title === 'ZZ Title Edited'); out.savedFirst = !!a0 && a0.description === 'ZZ Description edited' && /ZZTab/.test(a0.tabs) && /ZZ first point edited/.test(a0.tabs) && /ZZ added point/.test(a0.tabs);
    const a3 = mid.find(a => /ZZ trigger edited on tab 3/.test(a.tabs)); out.savedTab3Trigger = !!a3;
    const aNew = mid.find(a => a.title === 'ZZ Brand new application'); out.savedNew = !!aNew && /ZZ new point one/.test(aNew.tabs);
    // --- the public page shows it (reload as a visitor would)
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    await load('about:blank'); await load('applications.html'); d = f.contentDocument;
    await waitFor(() => H() && H().querySelectorAll('[data-app]').length === 7, 'page after save');
    out.visitorTabs = H().querySelectorAll('[data-app]').length; out.visitorFirstTab = H().querySelector('[data-app="0"]').textContent;
    out.visitorSeesEdit = [...H().querySelectorAll('.app-t,h2,p')].some(e => /ZZ first point edited/.test(e.textContent)); out.visitorHasEditUi = !!H().querySelector('.app-strip, .dyn-add, .app-x');
    // --- UNDO everything through the same editor: restore application 1 + tab 3 trigger, delete the new application
    await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@roadglas.com', password: 'Roadglas@123' }) });
    await load('about:blank'); await load('applications.html'); d = f.contentDocument; w = f.contentWindow; w.confirm = () => true;
    await waitFor(() => d.getElementById('cms-admin-bar') && H() && H().querySelectorAll('[data-app]').length === 7, 'page for undo');
    w.RGCMS.setEditing(true); await sleep(300);
    const restore = (idx, mut) => { tabBtn(idx).click(); };
    // delete the new application (last tab)
    tabBtn(6).click(); await sleep(200); H().querySelector('[data-eact="del"]').click(); await sleep(200);
    // restore tab 0 from the snapshot taken before the test
    const orig0 = before[0], orig3 = before[3]; const tabs0 = JSON.parse(orig0.tabs), tabs3 = JSON.parse(orig3.tabs);
    tabBtn(0).click(); await sleep(200);
    type(H().querySelector('[data-e="title"]'), orig0.title); type(H().querySelector('[data-e="desc"]'), orig0.description);
    const sh0 = H().querySelector('input[data-e="short"]'); const shortOrig = tabs0.find(t => t.type === 'meta').short; sh0.value = shortOrig === orig0.title ? '' : shortOrig; sh0.dispatchEvent(new Event('input', { bubbles: true }));
    // points: make the list the same length as the original, then fill
    const wantInvest = tabs0.find(t => t.type === 'invest').items;
    while (H().querySelectorAll('[data-arr="invest"]').length > wantInvest.length) { H().querySelector('[data-eact="rmarr"][data-field="invest"][data-i="' + (H().querySelectorAll('[data-arr="invest"]').length - 1) + '"]').click(); await sleep(120); }
    while (H().querySelectorAll('[data-arr="invest"]').length < wantInvest.length) { H().querySelector('[data-eact="addarr"][data-field="invest"]').click(); await sleep(120); }
    wantInvest.forEach((t, i) => type(H().querySelectorAll('[data-arr="invest"]')[i], t));
    tabBtn(3).click(); await sleep(200);
    const wantTrig3 = tabs3.find(t => t.type === 'triggers').items; wantTrig3.forEach((t, i) => type(H().querySelectorAll('[data-arr="triggers"]')[i], t));
    d.getElementById('cms-save').click();
    await waitFor(() => /^Saved/.test((d.getElementById('cms-toast') || {}).textContent || ''), 'undo save', 60000); out.undoToast = d.getElementById('cms-toast').textContent;
    const after = await snap(); out.appsAfterUndo = after.length;
    out.restoredExactly = after.length === before.length && before.every((b, i) => b.title === after[i].title && b.description === after[i].description && b.image_url === after[i].image_url && b.tabs === after[i].tabs);
    if (!out.restoredExactly) out.diff = before.map((b, i) => (after[i] && (b.title !== after[i].title || b.description !== after[i].description || b.tabs !== after[i].tabs)) ? i : null).filter(x => x !== null);
  } catch (e) { out.ERROR = String(e && e.message || e); }
  document.getElementById('OUT').textContent = JSON.stringify(out); document.title = 'DONE';
})();
</script></body></html>`;

const tmp = path.join(ROOT, '__apps.html');
fs.writeFileSync(tmp, harness);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-apps-' + Date.now(), '--virtual-time-budget=300000', '--window-size=1400,1100', '--dump-dom', 'http://localhost:' + PORT + '/__apps.html'], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 560000 });
fs.unlinkSync(tmp);
const m = /<pre id="OUT">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m || !m[1]) { console.log('NO RESULT', r.error ? r.error.message : ''); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log(JSON.stringify(j, null, 1));
process.exit(j.ERROR ? 1 : 0);

#!/usr/bin/env node
/*
 * seed-content: puts the content of the CURRENT pages (Applications, Solutions, Project Highlights, Resources) into the
 * roadglas site of the CMS backend, so it can be edited from the dashboard.
 *
 *   node tools/seed-content.js            (needs the test admin; set RG_USER / RG_PASS to use another admin)
 *   node tools/seed-content.js --dry-run  (shows what would be created, writes nothing)
 *
 * Source of truth for the texts/images: _original/index.original.html (the design). Images are uploaded to the roadglas
 * storage bucket through the CMS upload endpoint. Items that already exist (same title) are skipped, so it can be re-run.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API = process.env.RG_API || 'https://cmsapi.qpaix.com/roadglas';
const USER = process.env.RG_USER || 'test@roadglas.com';
const PASS = process.env.RG_PASS || 'Roadglas@123';
const DRY = process.argv.includes('--dry-run');

// ------------------------------------------------------------------ the original content (run the design's own logic)
const SRC = fs.readFileSync(path.join(ROOT, '_original', 'index.original.html'), 'utf8');
const script = SRC.slice(SRC.indexOf('data-dc-script>') + 15, SRC.lastIndexOf('</script>'));
class DCLogic { }
const Component = new Function('DCLogic', 'React', script + '\nreturn Component;')(DCLogic, { createRef: () => ({ current: null }) });
function vals(view, patch) {
  const inst = new Component();
  inst.state = Object.assign({}, inst.state, { view }, patch || {});
  return inst.renderVals();
}
const webp = s => String(s || '').replace(/(images\/[\w.-]+?)\.(?:jpe?g|png)\b/g, '$1.webp');
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const apps = vals('applications').apps.map((a, i) => {
  const v = vals('applications', { app: i });
  return { title: a.name, short: a.short, text: a.text, image: webp(a.src), invest: v.invest, triggers: v.triggers, order: i };
});
const prods = ['mat', 'grid'].map((k, i) => {
  const p = vals(k).prod; const card = vals('solutions').solutionCards[i];
  // text first, then one "- point" per line (the public pages show those as ticked points)
  return { key: k, title: p.name, kicker: p.kicker, tagline: p.tagline + '\n' + card.bullets.map(b => '- ' + b).join('\n'), image: webp(card.src), order: i, link: k === 'mat' ? 'paving-mat.html' : 'reinforcement-grid.html' };
});
const projects = vals('projects').projList.map((p, i) => ({
  title: p.title, location: p.location, year: p.year, owner: p.owner, products: p.products, prod: p.prod,
  challengeTitle: p.challengeTitle, challenge: p.challenge, solution: p.solution, images: p.imgs.map(webp), order: i,
}));
const resources = vals('resources', { res: 'downloads', resP: 'all' }).resourceList.map((r, i) => ({
  title: r.title, type: r.type, text: r.text, image: webp(r.src), product: /Mat/.test(r.product) ? 'mat' : 'grid', order: i,
}));

// ------------------------------------------------------------------ backend helpers
let cookie = '';
async function call(method, url, body, extraHeaders) {
  const headers = Object.assign({ Cookie: cookie }, extraHeaders || {});
  let payload = body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(API + url, { method, headers, body: payload });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
  if (!r.ok) throw new Error(method + ' ' + url + ' -> ' + r.status + ' ' + text.slice(0, 200));
  return { json, res: r };
}
const uploaded = new Map();
async function upload(localPath, folder) {
  if (uploaded.has(localPath)) return uploaded.get(localPath);
  const buf = fs.readFileSync(path.join(ROOT, localPath));
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'image/webp' }), path.basename(localPath)); fd.append('folder', folder);
  const { json } = await call('POST', '/api/upload', fd);
  uploaded.set(localPath, json.url); return json.url;
}

(async () => {
  console.log('to seed:', apps.length, 'applications,', prods.length, 'solutions,', projects.length, 'project highlights,', resources.length, 'resources');
  if (DRY) { console.log(JSON.stringify({ apps: apps.map(a => a.title), prods: prods.map(p => p.title), projects: projects.map(p => p.title), resources: resources.map(r => r.title) }, null, 1)); return; }
  const login = await fetch(API + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) });
  if (!login.ok) throw new Error('login failed ' + login.status);
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('no session cookie');
  console.log('logged in as', USER);
  const have = async p => (await call('GET', p)).json || [];

  // Applications
  const haveApps = new Set((await have('/api/v2/applications')).map(a => a.title));
  for (const a of apps) {
    if (haveApps.has(a.title)) { console.log('skip application', a.title); continue; }
    await call('POST', '/api/v2/applications', {
      title: a.title, slug: slugify(a.title), description: a.text, image_url: await upload(a.image, 'applications'), display_order: a.order, is_active: true,
      application_tabs: [{ type: 'meta', short: a.short }, { type: 'invest', items: a.invest }, { type: 'triggers', items: a.triggers }],
    });
    console.log('+ application', a.title);
  }
  // Solutions (cards): the rich product page content stays in paving-mat.html / reinforcement-grid.html for now
  const haveSol = new Map((await have('/api/v2/solutions')).map(s => [s.title, s]));
  for (const p of prods) {
    if (haveSol.has(p.title)) { // already there: only refresh the text (adds the ticked points)
      await call('PATCH', '/api/v2/solutions/' + haveSol.get(p.title).id, { short_description: p.tagline }); console.log('updated solution text', p.title); continue;
    }
    const created = (await call('POST', '/api/v2/solutions', {
      title: p.title, slug: slugify(p.title), short_description: p.tagline, icon_image_url: await upload(p.image, 'solutions'), category: p.kicker, product_family: p.key, display_order: p.order,
    })).json;
    const id = created && created.solution && created.solution.id;
    if (id) await call('PATCH', '/api/v2/solutions/' + id, { custom_link: p.link });
    console.log('+ solution', p.title);
  }
  // Project highlights
  const haveStories = new Set((await have('/api/v2/stories')).map(s => s.slug));
  for (const p of projects) {
    const slug = slugify(p.title) + (/Placeholder/.test(p.title) ? '-' + (p.order + 1) : '');
    if (haveStories.has(slug)) { console.log('skip project', p.title, '(' + slug + ')'); continue; }
    const imgs = []; for (const im of p.images) imgs.push(await upload(im, 'projects'));
    const date = new Date(Date.now() - p.order * 86400000).toISOString();
    await call('POST', '/api/v2/stories', {
      title: p.title, slug, location: p.location, application: p.owner, products_used: p.products,
      hero_image_url: imgs[0], challenge_text: p.challenge, solution_text: p.solution, project_benefits: '', published_date: date,
      result_text: JSON.stringify({ year: p.year, prod: p.prod, challengeTitle: p.challengeTitle, images: imgs }),
    });
    console.log('+ project', p.title);
  }
  // Resources
  const haveRes = new Set((await have('/api/v2/resources?all=true')).map(r => r.title + '|' + r.document_type + '|' + (r.description || '').slice(0, 14)));
  for (const r of resources) {
    const desc = '[product:' + r.product + '] ' + r.text;
    if (haveRes.has(r.title + '|' + r.type + '|' + desc.slice(0, 14))) { console.log('skip resource', r.title); continue; }
    await call('POST', '/api/v2/resources', {
      title: r.title, document_type: r.type, description: desc, file_url: '/roadglas-brochure.pdf', thumbnail_url: await upload(r.image, 'resources'),
      is_active: true, published_date: new Date(Date.now() - r.order * 3600000).toISOString(),
    });
    console.log('+ resource', r.type + ' - ' + r.title + ' (' + r.product + ')');
  }
  console.log('done. uploaded images:', uploaded.size);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

#!/usr/bin/env node
/*
 * build-pages: turns the single-file design (_original/index.original.html - an "x-dc" component with state-driven
 * screens) into ONE STATIC HTML FILE PER PAGE, same look, no framework at run time.
 *
 *   node tools/build-pages.js
 *
 * How: the original component logic + template are run here in Node; every page is rendered once for its default
 * state. Parts the original switched by state (tabs, filters, FAQ, project gallery, forms "sent" message ...) are
 * rendered once per state into <div data-vgroup=.. data-vstate=..> blocks; js/site.js shows the right block.
 * Images are referenced as .webp (see tools/convert-images.js). Hover rules (style-hover) become CSS in css/site.css.
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, '_original', 'index.original.html'), 'utf8');

// ------------------------------------------------------------------ pages
const PAGES = {
  home:         { file: 'index.html',                title: 'RoadGlas® Asphalt Reinforcement | Industrial Fabrics, Inc.', desc: 'RoadGlas® fiberglass reinforcement interlayers extend pavement life and delay reflective cracking. Manufactured in the USA by Industrial Fabrics, Inc.' },
  solutions:    { file: 'solutions.html',            title: 'Solutions | RoadGlas® Asphalt Reinforcement', desc: 'RoadGlas® Paving Mat and Reinforcement Grid: interlayer design solutions that enhance pavement life.' },
  mat:          { file: 'paving-mat.html',           title: 'ROADGLAS® Paving Mat | RoadGlas®', desc: 'ROADGLAS® Paving Mat: a hybrid geosynthetic that seals the pavement and slows reflective cracking.' },
  grid:         { file: 'reinforcement-grid.html',   title: 'ROADGLAS® Reinforcement Grid | RoadGlas®', desc: 'ROADGLAS® Reinforcement Grid: fiberglass reinforcement with pressure-activated adhesive backing that extends asphalt service life two to three times.' },
  applications: { file: 'applications.html',         title: 'Applications | RoadGlas® Asphalt Reinforcement', desc: 'RoadGlas® for highways, heavy trucking routes, airports, municipal roads, parking lots and industrial facilities.' },
  projects:     { file: 'project-highlights.html',   title: 'Project Highlights | RoadGlas® Asphalt Reinforcement', desc: 'Pavement reinforcement product solutions in the field: RoadGlas® project highlights.' },
  resources:    { file: 'resources.html',            title: 'Resources | RoadGlas® Asphalt Reinforcement', desc: 'RoadGlas® downloads, technical datasheets, installation guides and project specifications.' },
  contact:      { file: 'contact.html',              title: 'Contact Us | RoadGlas® Asphalt Reinforcement', desc: 'Contact the RoadGlas® team at Industrial Fabrics, Inc. for specifications, pricing and installation support.' },
  lunch:        { file: 'lunch-learn.html',          title: 'Lunch & Learn | RoadGlas® Asphalt Reinforcement', desc: 'Request a RoadGlas® Lunch & Learn session for your team.' },
  credit:       { file: 'credit-application.html',   title: 'Apply for Credit | RoadGlas® Asphalt Reinforcement', desc: 'Apply for a credit account with Industrial Fabrics, Inc.' },
};
const PROJECT_COUNT = 3;
const projectFile = i => 'project-highlight-' + (i + 1) + '.html';
const VIEW_FILE = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.file]));

// which parts of a page are switched by state: [first section index, last section index, state patches]
// (section index = position of the <section> among the view's own top-level elements)
const range = (key, from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ [key]: from + i }));
const cross = (a, b) => a.flatMap(x => b.map(y => ({ ...x, ...y })));
const GROUPS = {
  home: [],
  solutions: [],
  mat: [{ id: 'ty', from: 3, to: 3, def: { ty: 0 }, states: range('ty', 0, 1) }, { id: 'faq', from: 6, to: 6, def: { faq: 0 }, states: range('faq', -1, 5) }],
  grid: [{ id: 'ty', from: 3, to: 3, def: { ty: 0 }, states: range('ty', 0, 1) }, { id: 'faq', from: 6, to: 6, def: { faq: 0 }, states: range('faq', -1, 5) }],
  applications: [{ id: 'app', from: 1, to: 2, def: { app: 0 }, states: range('app', 0, 5) }],
  projects: [{ id: 'pf', from: 1, to: 1, def: { pf: 'all', pm: 'grid' }, states: cross([{ pf: 'all' }, { pf: 'mat' }, { pf: 'grid' }], [{ pm: 'grid' }, { pm: 'list' }]) }],
  project: [{ id: 'pj', from: 1, to: 2, def: { gi: 0, ptab: 'c' }, states: cross(range('gi', 0, 3), [{ ptab: 'c' }, { ptab: 's' }]) }],
  resources: [{ id: 'res', from: 1, to: 1, def: { res: 'downloads', resP: 'all' }, states: cross([{ res: 'downloads' }, { res: 'datasheets' }, { res: 'webinars' }, { res: 'videos' }, { res: 'blog' }, { res: 'notes' }], [{ resP: 'all' }, { resP: 'mat' }, { resP: 'grid' }]) }],
  contact: [{ id: 'sent', from: 2, to: 2, def: { sent: false }, states: [{ sent: false }, { sent: true }] }],
  lunch: [{ id: 'lsent', from: 2, to: 2, def: { lsent: false }, states: [{ lsent: false }, { lsent: true }], patch: st => ({ s2: { lunch: st.lsent } }) }],
  credit: [{ id: 'csent', from: 1, to: 1, def: { csent: false }, states: [{ csent: false }, { csent: true }], patch: st => ({ s2: { credit: st.csent } }) }],
};

// ------------------------------------------------------------------ pull the template and the logic out of the original
const tpl = SRC.slice(SRC.indexOf('<x-dc>') + 6, SRC.indexOf('</x-dc>'));
const script = SRC.slice(SRC.indexOf('data-dc-script>') + 15, SRC.lastIndexOf('</script>'));
class DCLogic { }
const React = { createRef: () => ({ current: null }) };
const Component = new Function('DCLogic', 'React', script + '\nreturn Component;')(DCLogic, React);
const $ = cheerio.load(tpl, { _useHtmlParser2: true, decodeEntities: false, lowerCaseAttributeNames: true });
const rootNodes = $.root()[0].children;

// ------------------------------------------------------------------ render helpers
const UNITLESS = new Set(['opacity', 'flex', 'flexGrow', 'flexShrink', 'fontWeight', 'zIndex', 'lineHeight', 'order', 'aspectRatio', 'orphans', 'widows', 'zoom']);
const kebab = k => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
const styleStr = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => kebab(k) + ':' + (typeof v === 'number' && !UNITLESS.has(k) && v !== 0 ? v + 'px' : v)).join(';');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source']);
const getPath = (scope, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
const exprOf = s => { const m = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/.exec(s || ''); return m ? m[1] : null; };

// webp: every images/*.jpg|png reference points at the converted file
const toWebp = s => String(s).replace(/(images\/[\w.-]+?)\.(?:jpe?g|png)\b/g, '$1.webp');

const hoverRules = new Map(); // style-hover text -> class name
const hoverClass = css => { if (!hoverRules.has(css)) hoverRules.set(css, 'hv-' + (hoverRules.size + 1)); return hoverRules.get(css); };

function makeInstance(view, patch) {
  const inst = new Component();
  inst.state = Object.assign({}, inst.state, { view, sup: true }, patch || {});
  inst.__rec = null;
  inst.show = (v, extra) => { inst.__rec = { show: v, extra: extra || {} }; };
  inst.setState = p => { inst.__rec = { set: typeof p === 'function' ? p(inst.state) : p }; };
  return inst;
}
function descriptorOf(inst, fn) {
  inst.__rec = null;
  try { fn({ preventDefault() { }, target: { value: '', checked: false, type: 'text' } }); } catch (e) { /* ignore */ }
  return inst.__rec;
}
function targetOf(rec) {
  if (rec.show === 'project') return projectFile(rec.extra.proj || 0);
  let f = VIEW_FILE[rec.show]; if (!f) return null;
  if (rec.extra && rec.extra.resP) f += '?prod=' + rec.extra.resP;
  if (rec.show === 'applications' && rec.extra && rec.extra.app !== undefined) f += '#app-' + rec.extra.app;
  return f;
}

const VIEW_FLAGS = new Set(['isHome', 'isSolutions', 'isProduct', 'isApps', 'isProjects', 'isProject', 'isResources', 'isContact', 'isLunch', 'isCredit']);
const FORM_PATH = /^(?:(l|c)(?:on|v|err|box)|(f)(?:on|v|err|box))\.(\w+)$/;

function renderAttrs(el, scope, inst, ctx) {
  const out = []; const tag = el.name;
  for (const [name, raw] of Object.entries(el.attribs)) {
    if (name.startsWith('hint-placeholder')) continue;
    if (name === 'style-hover') { out.push('class-hv:' + hoverClass(raw)); continue; }
    if (name === 'ref') { if (/lunchRef/.test(raw)) out.push('id="lunch-form"'); continue; }
    if (name === 'onclick') {
      const e = exprOf(raw);
      if (e === 'benPrev') { out.push('data-act="ben-prev"'); continue; }
      if (e === 'benNext') { out.push('data-act="ben-next"'); continue; }
      if (e === 'toLunchForm') { out.push('data-scroll="lunch-form"'); continue; }
      if (e === 'resetForm' || /(^|\.)reset$/.test(e || '') || e === 'lreset' || e === 'creset') { out.push('data-act="form-reset"'); continue; }
      if (e === 'toggleSale') { out.push('data-act="toggle-sale"'); continue; }
      const fn = e ? getPath(scope, e) : null; if (typeof fn !== 'function') continue;
      const rec = descriptorOf(inst, fn); if (!rec) continue;
      if (rec.show === 'applications' && inst.state.view === 'applications' && rec.extra && rec.extra.app !== undefined) out.push("data-set='{\"app\":" + rec.extra.app + "}'");
      else if (rec.show) { const t = targetOf(rec); if (t) out.push('data-href="' + t + '"'); }
      else if (rec.set) out.push("data-set='" + JSON.stringify(rec.set).replace(/'/g, '&#39;') + "'");
      continue;
    }
    if (name === 'onmouseenter' || name === 'onmouseleave') { out.push(name === 'onmouseenter' ? 'data-hover-on="' + (exprOf(raw) || '') + '"' : ''); continue; }
    if (name === 'onchange') {
      const e = exprOf(raw) || ''; const m = FORM_PATH.exec(e);
      if (m) out.push('data-f="' + m[3] + '"');
      continue;
    }
    if (name === 'onsubmit') {
      const e = exprOf(raw) || '';
      out.push('data-submit="' + (e === 'submit' ? 'contact' : e === 'lsubmit' ? 'lunch' : e === 'csubmit' ? 'credit' : e) + '"'); continue;
    }
    if (name === 'checked') { const e = exprOf(raw); const v = e ? getPath(scope, e) : raw; if (v) out.push('checked'); continue; }
    if (name === 'value' && (tag === 'select' || tag === 'textarea')) continue;
    if (name === 'style' && exprOf(raw)) {
      const v = getPath(scope, exprOf(raw));
      if (v && typeof v === 'object') out.push('style="' + escAttr(styleStr(v)) + '"'); else if (typeof v === 'string') out.push('style="' + escAttr(v) + '"');
      continue;
    }
    const val = raw.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => { const v = getPath(scope, p); return v == null || v === false ? '' : escAttr(v); });
    out.push(name + '="' + toWebp(val) + '"');
  }
  return out.filter(Boolean);
}

function joinAttrs(parts) {
  // merge hover classes into one class attribute
  const hv = parts.filter(p => p.startsWith('class-hv:')).map(p => p.slice(9));
  const rest = parts.filter(p => !p.startsWith('class-hv:'));
  if (hv.length) {
    const i = rest.findIndex(p => p.startsWith('class="'));
    if (i >= 0) rest[i] = rest[i].replace(/"$/, ' ' + hv.join(' ') + '"'); else rest.push('class="' + hv.join(' ') + '"');
  }
  return rest.length ? ' ' + rest.join(' ') : '';
}

function renderNodes(nodes, scope, inst, ctx) { return nodes.map(n => renderNode(n, scope, inst, ctx)).join(''); }

function renderNode(n, scope, inst, ctx) {
  if (n.type === 'comment') return '';
  if (n.type === 'text') {
    return n.data.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => {
      const v = getPath(scope, p); const s = v == null || v === false ? '' : esc(v);
      return /^(fv|lv|cv)\./.test(p) ? '<span data-fill="' + p.split('.')[1] + '">' + s + '</span>' : s;
    });
  }
  if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') return '';
  const tag = n.name;
  if (tag === 'helmet') return ''; // design-tool head block (font preconnect + image-slot.js): not needed, the page head has its own links
  if (tag === 'x-dc') return renderNodes(n.children || [], scope, inst, ctx);
  if (tag === 'sc-if') {
    const p = exprOf(n.attribs.value); const v = p ? getPath(scope, p) : false;
    if (!v) return '';
    if (VIEW_FLAGS.has(p)) {
      let idx = 0;
      return (n.children || []).map(c => {
        if (c.type !== 'tag') return renderNode(c, scope, inst, ctx);
        const html = renderNode(c, scope, inst, ctx); const i = idx++;
        return html.replace(/^<([a-zA-Z0-9]+)/, '<$1 data-sec="' + i + '"');
      }).join('');
    }
    let html = renderNodes(n.children || [], scope, inst, ctx);
    if (p === 'supShown') html = html.replace(/^(\s*<div)/, '$1 data-dd hidden');
    if (p === 'showSale') html = html.replace(/^(\s*<ol)/, '$1 data-sale hidden');
    return html;
  }
  if (tag === 'sc-for') {
    const p = exprOf(n.attribs.list); const list = p ? getPath(scope, p) : [];
    const as = n.attribs.as || 'item';
    return (Array.isArray(list) ? list : []).map((item, i) => renderNodes(n.children || [], Object.assign({}, scope, { [as]: item, $index: i }), inst, ctx)).join('');
  }
  if (tag === 'image-slot') {
    const g = k => (n.attribs[k] || '').replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => { const v = getPath(scope, p); return v == null ? '' : v; });
    const fit = g('fit') === 'contain' ? 'contain' : 'cover';
    const eager = /hero-1$/.test(g('id'));
    return '<img src="' + escAttr(toWebp(g('src'))) + '" alt="' + escAttr(g('placeholder')) + '"' + (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' style="display:block;width:100%;height:100%;object-fit:' + fit + '">';
  }
  const attrs = joinAttrs(renderAttrs(n, scope, inst, ctx));
  if (VOID.has(tag)) return '<' + tag + attrs + '>';
  return '<' + tag + attrs + '>' + renderNodes(n.children || [], scope, inst, ctx) + '</' + tag + '>';
}

function renderView(view, patch, projIndex) {
  const stateView = view === 'project' ? 'project' : view;
  const inst = makeInstance(stateView, Object.assign(view === 'project' ? { proj: projIndex || 0 } : {}, patch || {}));
  const vals = inst.renderVals();
  const html = renderNodes(rootNodes, vals, inst, {});
  return { html, inst };
}

// ------------------------------------------------------------------ assemble a page
const parse = html => cheerio.load('<div id="__root">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false, lowerCaseAttributeNames: true });
function assemble(viewKey, projIndex) {
  const basePatch = viewKey === 'credit' ? { sale: true } : {};
  const base = renderView(viewKey, basePatch, projIndex);
  const $p = parse(base.html);
  const defaults = {};
  for (const g of GROUPS[viewKey] || []) {
    const blocks = g.states.map(st => {
      const r = renderView(viewKey, Object.assign({}, basePatch, g.patch ? g.patch(st) : st), projIndex);
      const $v = parse(r.html);
      let inner = '';
      for (let i = g.from; i <= g.to; i++) inner += $v.html($v('[data-sec="' + i + '"]').first());
      const active = Object.keys(g.def).every(k => st[k] === g.def[k]);
      return '<div data-vgroup="' + g.id + '" data-vstate="' + escAttr(JSON.stringify(st)) + '"' + (active ? '' : ' hidden') + '>' + inner + '</div>';
    }).join('');
    Object.assign(defaults, g.def);
    for (let i = g.to; i > g.from; i--) $p('[data-sec="' + i + '"]').first().remove();
    $p('[data-sec="' + g.from + '"]').first().replaceWith(blocks);
  }
  $p('[data-sec]').each((i, el) => { delete el.attribs['data-sec']; });
  let out = $p('#__root').html();
  // mobile menu button (shown by css/site.css below 1100px) in front of the main navigation
  out = out.replace('<nav class="rg-11">', '<button class="rg-burger" aria-label="Open menu" aria-expanded="false" aria-controls="rg-nav"><span></span><span></span><span></span></button><nav class="rg-11" id="rg-nav">');
  return { html: out, defaults };
}

// one footer for every page (tools/footer.html): link columns, contact details, CMS login
const FOOTER = fs.readFileSync(path.join(__dirname, 'footer.html'), 'utf8').replace('__YEAR__', String(new Date().getFullYear())).trim();
const withFooter = html => /<footer/.test(html) ? html.replace(/<footer[\s\S]*<\/footer>/, () => FOOTER) : html + '\n' + FOOTER;   // the reference pages (blog, webinar, application) have no footer in their shell: it is added at the end

// stable CMS keys (see tools/cms-tag.js); the registry file keeps every key that was ever handed out
const { tagPage } = require('./cms-tag');
const REG_FILE = path.join(__dirname, 'cms-keys.json');
const registry = fs.existsSync(REG_FILE) ? JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) : {};
const tagStats = {};

// hero / banner text is held invisible from the first paint until js/rg-motion.js starts its entrance animation (css/rg-motion.css, html.rgm-pre)
const PRE_HOLD = '<script>(function(){var d=document.documentElement;if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("rgm-pre");setTimeout(function(){d.classList.remove("rgm-pre")},9000)})();</script>' + '\n';

// page loader: visible from the first paint until the CMS data (page texts + lists) has been applied; js/cms.js and js/rg-content.js hold / release it (window.RGL)
const LOADER_HEAD = '<style>' +
  '#rg-loader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;overflow:hidden;color:#fff;text-align:center;' +
  'background:radial-gradient(ellipse at 50% 38%,#1b46b8 0%,#0E3692 28%,#0a2468 62%,#06133a 100%);transition:opacity .6s ease,transform .6s ease,visibility .6s}' +
  '#rg-loader.done{opacity:0;transform:scale(1.06);visibility:hidden;pointer-events:none}html.rg-loading{overflow:hidden}html.rg-cached #rg-loader{display:none}html.rg-cached{visibility:hidden}' +
  '#rg-loader:before{content:"";position:absolute;left:0;right:0;bottom:15%;height:3px;opacity:.5;background:repeating-linear-gradient(90deg,#fff 0 46px,transparent 46px 92px);animation:rgl-road .9s linear infinite}' +
  '#rg-loader:after{content:"";position:absolute;left:0;right:0;bottom:calc(15% - 14px);height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent)}' +
  '#rg-loader .rgl-mark{position:relative;width:132px;height:132px;display:grid;place-items:center}' +
  '#rg-loader .rgl-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,#E52C1A,rgba(229,44,26,0) 38%,rgba(255,255,255,0) 52%,#fff 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));animation:rgl-spin 1.25s linear infinite}' +
  '#rg-loader .rgl-glow{position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.28),rgba(255,255,255,0) 68%);animation:rgl-glow 2.2s ease-in-out infinite}' +
  '#rg-loader img{position:relative;width:58px;height:auto;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45));animation:rgl-pop 2.2s ease-in-out infinite}' +
  '#rg-loader .rgl-word{font:800 clamp(34px,7vw,52px)/1 "Barlow Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;animation:rgl-up .8s .1s both cubic-bezier(.2,.8,.2,1)}' +
  '#rg-loader .rgl-word i{font-style:normal;color:#ff4a36}#rg-loader .rgl-word sup{font-size:.4em;vertical-align:top;margin-left:2px;opacity:.85}' +
  '#rg-loader .rgl-tag{margin-top:-8px;font:600 clamp(12px,2.6vw,14px)/1.2 "Barlow Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.72);animation:rgl-up .8s .25s both cubic-bezier(.2,.8,.2,1)}' +
  '#rg-loader .rgl-bar{width:min(230px,60vw);height:4px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;position:relative;animation:rgl-up .8s .4s both cubic-bezier(.2,.8,.2,1)}' +
  '#rg-loader .rgl-bar:after{content:"";position:absolute;top:0;bottom:0;width:44%;border-radius:4px;background:linear-gradient(90deg,transparent,#fff 45%,#ff4a36);animation:rgl-slide 1.1s ease-in-out infinite}' +
  '@keyframes rgl-spin{to{transform:rotate(360deg)}}@keyframes rgl-slide{0%{left:-48%}100%{left:104%}}@keyframes rgl-road{to{background-position:92px 0}}' +
  '@keyframes rgl-pop{0%,100%{transform:scale(1)}50%{transform:scale(.93)}}@keyframes rgl-glow{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.06)}}@keyframes rgl-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
  '@media (prefers-reduced-motion:reduce){#rg-loader *,#rg-loader:before{animation:none!important}#rg-loader .rgl-bar:after{left:0;width:100%}}' +
  '</style>\n' +
  '<noscript><style>#rg-loader{display:none}html.rg-loading{overflow:auto}</style></noscript>\n' +
  '<script>(function(){var d=document,n=0,ready=false,hid=false,t0=Date.now(),c=false;d.documentElement.classList.add("rg-loading");' +
  'try{var nv=performance.getEntriesByType("navigation")[0];if(nv&&nv.type==="reload"){localStorage.removeItem("rg-cache-v1");localStorage.removeItem("rg-cache-t")}var t=+localStorage.getItem("rg-cache-t");c=!!(t&&Date.now()-t<864e5&&!localStorage.getItem("rg-admin"))}catch(e){}if(c)d.documentElement.classList.add("rg-cached");' +
  'function hide(){if(hid)return;hid=true;var e=d.getElementById("rg-loader");d.documentElement.classList.remove("rg-loading");d.documentElement.classList.remove("rg-cached");if(e){e.classList.add("done");setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},600)}}' +
  'function check(){if(ready&&n<=0)setTimeout(function(){if(n<=0)hide()},Math.max(30,(RGL.cached?0:380)-(Date.now()-t0)))}' +
  'window.RGL={cached:c,cachedUsed:false,hold:function(){n++},release:function(){n=Math.max(0,n-1);check()},miss:function(){RGL.cached=false;d.documentElement.classList.remove("rg-cached")}};' +
  'd.addEventListener("DOMContentLoaded",function(){ready=true;check()});setTimeout(hide,c?2500:12000)})();</script>\n';
const LOADER_BODY = '<div id="rg-loader" role="status" aria-live="polite" aria-label="Loading"><div class="rgl-mark"><span class="rgl-glow"></span><span class="rgl-ring"></span><img src="images/logo-shield-sm.webp" alt="" width="58" height="75"></div>' +
  '<div class="rgl-word">ROAD<i>GLAS</i><sup>®</sup></div><div class="rgl-tag">Pound for pound | Stronger than steel</div><div class="rgl-bar"></div></div>\n';

function page(file, title, desc, bodyHtml, defaults, bodyClass, extraHead) {
  bodyHtml = withFooter(bodyHtml);
  // top bar (phone + address): one text for all pages; "g-" keys are stored with the home page and shown everywhere (js/cms.js)
  bodyHtml = bodyHtml.replace(/(<div class="rg-3"><span)(>[^<]*<\/span><\/div>\s*<span)(>[^<]*<\/span>)/, '$1 data-cms="g-topbar-phone" data-cms-type="text"$2 data-cms="g-topbar-address" data-cms-type="text"$3');
  bodyHtml = bodyHtml.replace(/<img([^>]*?)class="rg-7">/, '<img$1class="rg-7" data-cms="site-logo" data-cms-type="image">');   // header logo: the backend's global key
  const tagged = tagPage(bodyHtml, bodyClass, registry); bodyHtml = tagged.html; tagStats[file] = tagged.tagged + (tagged.created ? ' (' + tagged.created + ' new keys)' : '');
  const editor = bodyClass !== 'login';   // the live editor (admin bar, inline editing) is on every page except the login page
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n<meta name="description" content="' + escAttr(desc) + '">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link rel="icon" type="image/png" sizes="64x64" href="images/favicon.png">\n<link rel="apple-touch-icon" href="images/apple-touch-icon.png">\n' +
    (extraHead || '') + (bodyClass !== 'login' ? LOADER_HEAD : '') + '<link rel="stylesheet" href="css/styles.css">\n<link rel="stylesheet" href="css/site.css">\n' + (bodyClass !== 'login' ? PRE_HOLD : '') + '<link rel="stylesheet" href="css/rg-motion.css">\n' + (editor ? '<link rel="stylesheet" href="css/cms.css">\n' : '') + '</head>\n' +
    '<body data-page="' + escAttr(bodyClass) + '" data-state=\'' + JSON.stringify(defaults) + '\'>\n' + (bodyClass !== 'login' ? LOADER_BODY : '') + bodyHtml + '\n<script src="js/site.js" defer></script>\n<script src="js/rg-edit.js" defer></script>\n<script src="js/rg-cache.js" defer></script>\n<script src="js/rg-motion.js" defer></script>\n' + (bodyClass === 'ref-solution' ? '<script src="js/rg-solution-tpl.js" defer></script>\n' : '') + '<script src="js/rg-content.js" defer></script>\n' + (editor ? '<script src="js/cms.js" defer></script>\n<script src="js/rg-toolbar.js" defer></script>\n' : '') + '</body>\n</html>\n';
}

// the sections of a product page that can be switched off per solution in the Dashboard (see js/rg-content.js productPage / js/rg-solution-tpl.js)
function markSections(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load('<div id="__r">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false });
  $('section.rg-99').attr('data-tsec', 'stats'); $('section.rg-26').eq(0).attr('data-tsec', 'overview'); $('.rg-113, .rg-115').attr('data-tsec', 'types');
  $('section.rg-123').attr('data-tsec', 'coating'); $('section.rg-26').eq(1).attr('data-tsec', 'guide'); $('[data-vgroup="faq"]').attr('data-tsec', 'faq');
  return $('#__r').html();
}

// ------------------------------------------------------------------ run
const written = [];
for (const [key, meta] of Object.entries(PAGES)) {
  const viewKey = key;
  const a0 = assemble(viewKey, 0), defaults = a0.defaults;
  let html = (key === 'mat' || key === 'grid') ? markSections(a0.html) : a0.html;
  if (key === 'resources') html = html.replace(/<p class="rg-217"[^>]*>[\s\S]*?<\/p>/g, '');   // no "Pavement Reinforcement Resources" line beside the product heading
  fs.writeFileSync(path.join(ROOT, meta.file), page(meta.file, meta.title, meta.desc, html, defaults, key));
  written.push(meta.file);
}
// project highlight detail pages (one per project)
const projTitles = [];
for (let i = 0; i < PROJECT_COUNT; i++) {
  const { html, defaults } = assemble('project', i);
  const t = /<h1[^>]*>([^<]*)<\/h1>/.exec(html);
  const title = (t ? t[1] : 'Project Highlight') + ' | RoadGlas® Project Highlights';
  fs.writeFileSync(path.join(ROOT, projectFile(i)), page(projectFile(i), title, 'RoadGlas® project highlight: ' + (t ? t[1] : ''), html, defaults, 'project'));
  written.push(projectFile(i));
}
// one project highlight, filled from the CMS by js/rg-content.js (?slug=...); the first project stays as the no-JS fallback
{
  const { html, defaults } = assemble('project', 0);
  fs.writeFileSync(path.join(ROOT, 'project-highlight.html'), page('project-highlight.html', 'Project Highlight | RoadGlas® Asphalt Reinforcement', 'RoadGlas® project highlight.', html, defaults, 'project-dyn'));
  written.push('project-highlight.html');
}

// the template page of a solution made in the dashboard: exactly the layout of paving-mat.html (hero, figures, overview, key features, product types, coating,
// application guide + installation steps, Q&A, contact band) with generic placeholder texts. The hero (title, small heading, text, photo) comes from the solution row;
// every other text / photo / link is a normal page element of ITS page ("product-detail-<name>"), edited live in edit mode and saved with SAVE.
function solutionTemplate() {
  const cheerio = require('cheerio');
  const { html, defaults } = assemble('mat', 0);
  const $ = cheerio.load('<div id="__r">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false });
  const set = (sel, v) => $(sel).each((i, e) => { $(e).html(v); });
  $('section.rg-91').replaceWith('<div data-ref-hero></div>');
  set('.rg-102', '00'); set('.rg-103', 'Figure label (Placeholder)');
  set('.rg-105', 'Overview heading (Placeholder)'); set('.rg-106', 'Add your overview text here. (Placeholder)');
  set('.rg-108', 'Why choose <span class="rg-30">this product</span>'); set('.rg-110 .rg-112', 'Feature title (Placeholder)'); set('.rg-110 p.rg-36', 'Describe this feature. (Placeholder)');
  set('.rg-113 .rg-114', 'Choose the right <span class="rg-30">product type</span>');
  $('[data-vgroup="ty"]').each((vi, blk) => {
    const roman = ['I', 'II', 'III'];
    $(blk).find('.rg-116 button').each((bi, b) => { $(b).html('Type ' + roman[bi]); b.attribs['data-edit-label'] = '1'; });
    $(blk).find('.rg-118').html('T' + (vi + 1)); $(blk).find('.rg-119 .rg-86').html('Type ' + roman[vi] + ' (Placeholder)'); $(blk).find('.rg-120').html('Describe this product type. (Placeholder)');
  });
  set('.rg-124 .rg-114', 'Section heading (Placeholder)'); set('.rg-125', 'Add your technology / coating text here. (Placeholder)'); set('.rg-129', 'Title (Placeholder)'); set('.rg-130', 'Describe it. (Placeholder)');
  $('.rg-132').each((i, e) => { $(e).html(i === 0 ? 'Table heading (Placeholder)' : 'Installation heading (Placeholder)'); });
  let cell = 0; $('.rg-132').first().closest('section').find('span.rg-136, span.rg-138').each((i, e) => { const header = cell < 3; cell++; $(e).html(header ? 'Column ' + cell : (e.attribs.class || '').includes('rg-138') ? 'Row label' : 'Value'); });
  set('.rg-139', 'Add a note here. (Placeholder)'); set('.rg-143', 'Describe this step. (Placeholder)');
  set('.rg-67', '<span class="rg-68"></span>Specify this product'); set('.rg-69', 'Heading (Placeholder)'); set('.rg-344', 'Add your text here. (Placeholder)');
  // the overview photo fills its whole box (a photo uploaded later is cropped to the same box, not shrunk into it)
  $('section.rg-26 img').attr('src', 'images/img_p27_1.webp').attr('style', 'display:block;width:100%;height:100%;object-fit:cover');
  const qa = [1, 2, 3, 4, 5, 6].map(i => '<details class="rg-150"><summary class="rg-151"><span>Question ' + i + ' (Placeholder)</span><span class="rg-152"></span></summary><p class="rg-153">Answer ' + i + '. (Placeholder)</p></details>').join('');
  const faq = '<section class="rg-38" data-tsec="faq"><div class="rg-146"><div class="rg-147">Q&amp;A</div><h2 class="rg-148">Frequently Asked <span class="rg-30">Questions</span></h2><div class="rg-149" data-tpl="faq"></div></div></section>';
  const faqs = $('[data-vgroup="faq"]'); faqs.slice(1).remove(); faqs.first().replaceWith(faq);
  delete defaults.faq; delete defaults.ty;
  // product types: one list instead of the two state variants
  const blks = $('[data-vgroup="ty"]').toArray(); if (blks.length) { $(blks[0]).replaceWith($(blks[0]).contents()); blks.slice(1).forEach(b => $(b).remove()); }
  // the lists (figures, features, product types, coating, table, steps, Q&A) are drawn by js/rg-solution-tpl.js from the data of the solution page
  [['.rg-100', 'stats'], ['.rg-109', 'features'], ['.rg-115', 'types'], ['.rg-126', 'coating'], ['.rg-134', 'table'], ['.rg-140', 'steps']].forEach(([sel, n]) => { $(sel).html('').attr('data-tpl', n); });
  // sections that can be switched off per solution in the Dashboard (Solutions > edit > "Sections shown")
  $('section.rg-99').attr('data-tsec', 'stats'); $('section.rg-26').eq(0).attr('data-tsec', 'overview'); $('.rg-113, .rg-115').attr('data-tsec', 'types');
  $('section.rg-123').attr('data-tsec', 'coating'); $('section.rg-26').eq(1).attr('data-tsec', 'guide');
  return { html: $('#__r').html(), defaults };
}

// reference (template) pages: header + footer of the site and an empty [data-ref] host that js/rg-content.js fills from the CMS item of the address.
// vercel.json / netlify.toml / tools/dev-server.js show them for the addresses of items that have no file of their own.
{
  const cheerio = require('cheerio');
  const { html } = assemble('project', 0);
  const $ = cheerio.load('<div id="__r">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false });
  const shell = $('#__r').children().slice(0, 2).map((i, e) => $.html(e)).get().join('\n');   // top bar + header, no sections
  const REFS = [
    ['solution-reference.html', 'ref-solution', 'Solution | RoadGlas® Asphalt Reinforcement', 'RoadGlas® solution.'],
    ['application-reference.html', 'ref-application', 'Application | RoadGlas® Applications', 'RoadGlas® application.'],
    ['blog-details.html', 'ref-blog', 'Blog | RoadGlas®', 'RoadGlas® blog post.'],
    ['webinar-details.html', 'ref-webinar', 'Webinar | RoadGlas®', 'RoadGlas® webinar.']
  ];
  const ACTIVE = { 'ref-solution': 'solutions.html', 'ref-application': 'applications.html', 'ref-blog': 'resources.html', 'ref-webinar': 'resources.html' };
  const setActive = (html, target) => {   // blue text + red line on the menu item of this section, the others plain
    const $s = cheerio.load(html, { _useHtmlParser2: true, decodeEntities: false });
    $s('header nav button[data-href]').each((i, e) => {
      if (!/border-bottom:3px solid/.test(e.attribs.style || '')) return;
      const on = e.attribs['data-href'] === target;
      e.attribs.style = e.attribs.style.replace(/color:#[0-9A-Fa-f]{6};border-bottom:3px solid (#[0-9A-Fa-f]{6}|transparent)/, on ? 'color:#0E3692;border-bottom:3px solid #E52C1A' : 'color:#2C2E35;border-bottom:3px solid transparent');
    });
    return $s.root().html();
  };
  for (const [file, key, title, desc] of REFS) {
    if (key === 'ref-solution') { const t = solutionTemplate(); fs.writeFileSync(path.join(ROOT, file), page(file, title, desc, t.html, t.defaults, key)); written.push(file); continue; }
    fs.writeFileSync(path.join(ROOT, file), page(file, title, desc, setActive(shell, ACTIVE[key]) + '\n<main data-ref="' + key + '"></main>', {}, key));
    written.push(file);
  }
}
// (login.html is a hand-written page, not generated here: split login screen like the other CMS sites)
// hover rules -> css/site.css (kept above the hand-written responsive part)
const SITE_CSS = path.join(ROOT, 'css', 'site.css');
const marker = '/* ==== generated by tools/build-pages.js: hover rules (do not edit between the markers) ==== */';
const endMarker = '/* ==== end generated ==== */';
const gen = marker + '\n' + [...hoverRules].map(([css, cls]) => '.' + cls + ':hover{' + css.split(';').filter(Boolean).map(d => d.trim() + ' !important').join(';') + '}').join('\n') + '\n' + endMarker;
let existing = fs.existsSync(SITE_CSS) ? fs.readFileSync(SITE_CSS, 'utf8') : '';
if (existing.includes(marker)) existing = existing.slice(0, existing.indexOf(marker)) + gen + existing.slice(existing.indexOf(endMarker) + endMarker.length);
else existing = gen + '\n' + existing;
fs.writeFileSync(SITE_CSS, existing);
// save the registry (sorted, so it diffs cleanly)
const sortedReg = {}; for (const p of Object.keys(registry).sort()) { sortedReg[p] = {}; for (const s of Object.keys(registry[p]).sort()) sortedReg[p][s] = registry[p][s]; }
fs.writeFileSync(REG_FILE, JSON.stringify(sortedReg, null, 1));
console.log('pages written:', written.join(', '));
console.log('CMS keys per page:', JSON.stringify(tagStats));
console.log('hover rules:', hoverRules.size);

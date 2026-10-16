/* RoadGlas site behaviour (replaces the old x-dc component runtime).
 * Every page is static HTML; this file only adds the interactions:
 *   - navigation buttons ([data-href])
 *   - tabs / filters / FAQ / gallery: the page contains one block per state ([data-vgroup][data-vstate]); a click on an
 *     element with [data-set='{"key":value}'] changes the state and shows the matching block
 *   - Support dropdown, home hero slider, "Top 10 benefits" carousel
 *   - forms (validation + thank-you message)
 */
(function () {
  'use strict';
  var body = document.body;
  var state = {};
  try { state = JSON.parse(body.getAttribute('data-state') || '{}'); } catch (e) { state = {}; }

  /* ------------------------------------------------------------ state <-> visible blocks */
  var groups = [].slice.call(document.querySelectorAll('[data-vgroup]'));
  function matches(vs) { return Object.keys(vs).every(function (k) { return state[k] === vs[k]; }); }
  function render() {
    groups.forEach(function (el) {
      var vs; try { vs = JSON.parse(el.getAttribute('data-vstate')); } catch (e) { return; }
      el.hidden = !matches(vs);
    });
  }
  function setState(patch) {
    var changed = false;
    Object.keys(patch).forEach(function (k) { if (state[k] !== patch[k]) { state[k] = patch[k]; changed = true; } });
    if (changed) render();
  }

  // entry points from other pages: resources.html?prod=mat  /  applications.html#app-3
  (function initFromUrl() {
    var m = /[?&]prod=(all|mat|grid)\b/.exec(location.search); if (m && 'resP' in state) state.resP = m[1];
    var a = /^#app-(\d+)$/.exec(location.hash); if (a && 'app' in state) state.app = parseInt(a[1], 10);
  })();
  render();

  /* ------------------------------------------------------------ clicks */
  function smoothTo(id) {
    var el = document.getElementById(id); if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-href],[data-set],[data-act],[data-scroll]');
    if (!t) return;
    if (t.hasAttribute('data-href')) { location.href = t.getAttribute('data-href'); return; }
    if (t.hasAttribute('data-scroll')) { smoothTo(t.getAttribute('data-scroll')); return; }
    if (t.hasAttribute('data-set')) {
      var patch; try { patch = JSON.parse(t.getAttribute('data-set')); } catch (err) { return; }
      if ('slide' in patch) { slider && slider.go(patch.slide); }
      else if ('ben' in patch) { bens && bens.go(patch.ben); }
      else if ('sup' in patch) { /* handled by the dropdown below */ }
      else setState(patch);
      return;
    }
    var act = t.getAttribute('data-act');
    if (act === 'ben-prev') bens && bens.step(-1);
    else if (act === 'ben-next') bens && bens.step(1);
    else if (act === 'toggle-sale') toggleSale(t);
    else if (act === 'form-reset') resetForm(t);
  });

  /* ------------------------------------------------------------ mobile menu */
  (function () {
    var burger = document.querySelector('.rg-burger'); if (!burger) return;
    function set(open) { body.classList.toggle('nav-open', open); burger.setAttribute('aria-expanded', open ? 'true' : 'false'); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); }
    burger.addEventListener('click', function (e) { e.stopPropagation(); set(!body.classList.contains('nav-open')); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1100) set(false); });
  })();

  /* ------------------------------------------------------------ Support dropdown */
  (function () {
    var dd = document.querySelector('[data-dd]'); if (!dd) return;
    var wrap = dd.parentElement;
    var btn = wrap.querySelector('button');
    var open = function () { dd.hidden = false; }, close = function () { dd.hidden = true; };
    wrap.addEventListener('mouseenter', open);
    wrap.addEventListener('mouseleave', close);
    btn.addEventListener('click', function (e) { e.stopPropagation(); dd.hidden = !dd.hidden; });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
  })();

  /* ------------------------------------------------------------ home: hero slider */
  var slider = (function () {
    var hero = document.querySelector('section[data-screen-label="Home hero"]'); if (!hero) return null;
    var slides = [].slice.call(hero.children).filter(function (c) { return c.style && c.style.position === 'absolute'; });
    var dots = [].slice.call(hero.querySelectorAll('.rg-25 button'));
    var cur = 0, timer;
    function show(i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        s.style.opacity = k === cur ? 1 : 0;
        s.style.pointerEvents = k === cur ? 'auto' : 'none';
        s.style.zIndex = k === cur ? 2 : 1;
      });
      dots.forEach(function (d, k) {
        d.style.width = (k === cur ? 36 : 12) + 'px';
        d.style.background = k === cur ? '#E52C1A' : 'rgba(255,255,255,0.6)';
      });
    }
    function auto() { clearInterval(timer); timer = setInterval(function () { if (!body.classList.contains('cms-editing')) show(cur + 1); }, 7000); }
    show(0); auto();
    return { go: function (i) { show(i); auto(); } };
  })();

  /* ------------------------------------------------------------ home: "Top 10 benefits" carousel */
  var bens = (function () {
    var host = document.querySelector('[data-hover-on="benPause"]'); if (!host) return null;
    var track = host.firstElementChild, cards = [].slice.call(track.children);
    var dotsBox = host.nextElementSibling;
    var cur = 0, paused = false, timer, N = cards.length;
    var pv = function () { var w = window.innerWidth; return w >= 1100 ? 4 : w >= 780 ? 3 : w >= 540 ? 2 : 1; };
    function layout() {
      var p = pv(), max = N - p; if (cur > max) cur = max;
      track.style.transform = 'translateX(calc(' + (-cur) + ' * (100% + 22px) / ' + p + '))';
      cards.forEach(function (c) { c.style.flex = '0 0 calc((100% - ' + ((p - 1) * 22) + 'px) / ' + p + ')'; });
      dotsBox.innerHTML = '';
      for (var i = 0; i <= max; i++) {
        var b = document.createElement('button');
        b.setAttribute('aria-label', 'Go to slide'); b.setAttribute('data-set', '{"ben":' + i + '}');
        b.style.cssText = 'width:' + (i === cur ? 36 : 12) + 'px;height:12px;border:0;padding:0;cursor:pointer;background:' + (i === cur ? '#E52C1A' : '#D3D4D8') + ';transition:width 0.3s';
        dotsBox.appendChild(b);
      }
    }
    function step(n) { var max = N - pv(); cur += n; if (cur > max) cur = 0; if (cur < 0) cur = max; layout(); }
    host.addEventListener('mouseenter', function () { paused = true; });
    host.addEventListener('mouseleave', function () { paused = false; });
    window.addEventListener('resize', layout);
    timer = setInterval(function () { if (!paused && !body.classList.contains('cms-editing')) step(1); }, 4000);
    layout();
    return { step: step, go: function (i) { cur = i; layout(); } };
  })();

  /* ------------------------------------------------------------ forms */
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var RULES = {
    contact: { req: ['first', 'last', 'email', 'message'], sent: 'sent' },
    lunch: { req: ['first', 'last', 'title', 'company', 'phone', 'email', 'country', 'attending'], sent: 'lsent' },
    credit: { req: ['company', 'address', 'country', 'state', 'city', 'zip', 'county', 'phone', 'owners', 'taxid', 'accounting', 'email', 'btype', 'amount', 'po', 'r1', 'bank', 'agreeTerms', 'gname', 'agreeGuaranty', 'agreeSale', 'pname', 'sig', 'stitle'], sent: 'csent' },
  };
  function fieldsOf(form, key) { return [].slice.call(form.querySelectorAll('[data-f="' + key + '"]')); }
  function valueOf(form, key) {
    var els = fieldsOf(form, key); if (!els.length) return '';
    if (els[0].type === 'radio') { var on = els.filter(function (x) { return x.checked; })[0]; return on ? on.value : ''; }
    if (els[0].type === 'checkbox') return els[0].checked;
    return els[0].value.trim();
  }
  function errBox(el) { var n = el.nextElementSibling; return n && n.tagName === 'SPAN' ? n : null; }
  function setErr(form, key, msg) {
    fieldsOf(form, key).forEach(function (el) {
      if (el.type !== 'radio' && el.type !== 'checkbox') el.style.borderColor = msg ? '#E52C1A' : '#CECFD1';
      var b = errBox(el); if (b && (el.type !== 'radio' && el.type !== 'checkbox')) b.textContent = msg || '';
    });
    var grp = fieldsOf(form, key)[0];
    if (grp && (grp.type === 'radio' || grp.type === 'checkbox')) {
      var holder = grp.closest('label,div'); if (holder) { holder.style.outline = msg ? '2px solid #E52C1A' : ''; holder.title = msg || ''; }
    }
  }
  document.addEventListener('input', function (e) {
    var el = e.target; var key = el.getAttribute && el.getAttribute('data-f'); if (!key) return;
    var form = el.closest('form'); if (form) setErr(form, key, '');
  });
  document.addEventListener('change', function (e) {
    var el = e.target; var key = el.getAttribute && el.getAttribute('data-f'); if (!key) return;
    var form = el.closest('form'); if (form) setErr(form, key, '');
  });
  document.addEventListener('submit', function (e) {
    var form = e.target; var kind = form.getAttribute('data-submit'); if (!kind || !RULES[kind]) return;
    e.preventDefault();
    var rules = RULES[kind], first = null, bad = 0;
    rules.req.forEach(function (k) {
      if (!fieldsOf(form, k).length) return;
      var v = valueOf(form, k);
      var msg = '';
      if (!v) msg = /^agree/.test(k) ? 'Please confirm to continue' : 'Required';
      else if (/email/.test(k) && !EMAIL.test(v)) msg = 'Enter a valid email';
      setErr(form, k, msg);
      if (msg) { bad++; if (!first) first = fieldsOf(form, k)[0]; }
    });
    // optional e-mail fields (credit references) still have to look like an e-mail when filled
    fieldsOf(form, 'x'); [].slice.call(form.querySelectorAll('[data-f*="email"]')).forEach(function (el) {
      var k = el.getAttribute('data-f'); if (rules.req.indexOf(k) >= 0) return;
      if (el.value.trim() && !EMAIL.test(el.value.trim())) { setErr(form, k, 'Enter a valid email'); bad++; if (!first) first = el; }
    });
    if (bad) { if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    // send it to the CMS backend (it mails the form through the SMTP account set in the dashboard, with the CC rows of this form); the "sent" block shows only once that worked
    var btn = form.querySelector('button[type="submit"]'), label = btn ? btn.textContent : '', msg = form.querySelector('.form-err');
    if (!msg) { msg = document.createElement('div'); msg.className = 'form-err'; msg.setAttribute('role', 'alert'); msg.style.cssText = 'color:#E52C1A;font-size:15px;margin-top:12px;font-weight:600'; (btn ? btn.parentNode : form).appendChild(msg); }
    msg.textContent = ''; if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadOf(kind, form)) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.success === false) throw new Error(j.message || ('Error ' + r.status)); }); })
      .then(function () {
        // fill the thank-you message with the first name, then show the "sent" block
        var name = valueOf(form, 'first') || valueOf(form, 'gname') || '';
        [].slice.call(document.querySelectorAll('[data-fill="first"]')).forEach(function (s) { s.textContent = name; });
        var patch = {}; patch[rules.sent] = true; setState(patch);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) { msg.textContent = 'Sorry, your message could not be sent (' + (err && err.message || 'network error') + '). Please try again in a moment or call us.'; })
      .then(function () { if (btn) { btn.disabled = false; btn.textContent = label; } });
  });
  // what the backend (ContactController /api/contact) expects, per form; form_type decides which CC rows of the dashboard apply
  function payloadOf(kind, form) {
    var v = function (k) { var x = valueOf(form, k); return x === true ? 'Yes' : x === false ? '' : String(x || ''); }, join = function () { return [].slice.call(arguments).filter(Boolean).join(' '); };
    if (kind === 'contact') {
      return { form_type: 'support', subject: 'Contact form', name: join(v('first'), v('last')), email: v('email'), phone: v('phone'), company: v('company'), product: v('product'),
        message: [v('sector') && 'Sector: ' + v('sector'), v('location') && 'Project location: ' + v('location'), '', v('message')].join('\n').replace(/^\n+/, '') };
    }
    if (kind === 'lunch') {
      return { form_type: 'lunch_learn', subject: 'Lunch & Learn request', name: join(v('first'), v('last')), email: v('email'), phone: v('phone'), company: v('company'), product: v('products'),
        project_country: v('country'), project_state: v('state'), project_city: v('city'),
        message: ['Title: ' + v('title'), 'People attending: ' + v('attending'), v('date') && 'Preferred date: ' + v('date'), v('notes') && 'Notes: ' + v('notes')].filter(Boolean).join('\n') };
    }
    return { form_type: 'credit_application', subject: 'Credit Application', name: v('pname') || v('company'), email: v('email'), phone: v('phone'), company: v('company'), product: v('products'), message: '',
      company_address: v('address'), project_country: v('country'), project_state: v('state'), project_city: v('city'), zip: v('zip'), county: v('county'), fax: v('fax'), salesperson: v('salesperson'), date_started: v('started'),
      mailing_address: v('maddress'), mailing_city: v('mcity'), mailing_state: v('mstate'), mailing_zip: v('mzip'), owners: v('owners'), fed_tax_id: v('taxid'), duns: v('duns'), accounting_contact: v('accounting'),
      business_type: v('btype'), credit_amount: v('amount'), po_required: v('po'),
      ref1_company: v('r1'), ref1_email: v('r1email'), ref1_phone: v('r1phone'), ref2_company: v('r2'), ref2_email: v('r2email'), ref2_phone: v('r2phone'), ref3_company: v('r3'), ref3_email: v('r3email'), ref3_phone: v('r3phone'),
      bank_name: v('bank'), bank_phone: v('bankphone'), bank_account: v('bankacct'), bank_contact: v('bankcontact'), bank_address: v('bankaddr'), bank_city: v('bankcity'), bank_state: v('bankstate'), bank_zip: v('bankzip'),
      tax_business_type: v('taxbiz'), tax_exempt_all: v('exall'), tax_exempt_some: v('exsome'), agree_terms: v('agreeTerms'), agree_guaranty: v('agreeGuaranty'), agree_tos: v('agreeSale'),
      guarantor_name: v('gname'), guarantor_title: v('gtitle'), sign_name: v('pname'), sign_signature: v('sig'), sign_title: v('stitle') };
  }
  function resetForm(btn) {
    var kind = body.getAttribute('data-page');
    var key = kind === 'contact' ? 'sent' : kind === 'lunch' ? 'lsent' : kind === 'credit' ? 'csent' : null; if (!key) return;
    [].slice.call(document.querySelectorAll('form[data-submit]')).forEach(function (f) { f.reset(); });
    var patch = {}; patch[key] = false; setState(patch);
  }
  function toggleSale(btn) {
    var terms = document.querySelector('[data-sale]'); if (!terms) return;
    terms.hidden = !terms.hidden;
    btn.textContent = terms.hidden ? 'Show full Terms & General Conditions of Sale' : 'Hide full Terms & General Conditions of Sale';
  }
  // the credit page ships with the sale terms folded away
  (function () { var b = document.querySelector('[data-act="toggle-sale"]'); if (b) b.textContent = 'Show full Terms & General Conditions of Sale'; })();
})();

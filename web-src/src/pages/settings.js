/* ===================================================================
   Page: Settings (#page=settings&section=start|startpage|company|brand|rules|locations|menu|dash|ic)   Owner: builder 5
   Opened from the avatar menu. Getting started, the person's own start page, then the company-wide cards: company
   profile, brand colours, rules and amounts, our locations, menu layout, dashboard layout and IC check accounts.
   Each card saves on its own; nothing saves until its Save is pressed (location ticks save at once, as in the reference).
   =================================================================== */
var SET_ORIG = {}; BRANDS.forEach(function (b) { SET_ORIG[b.id] = [b.primary, b.secondary, b.accent]; });
var SET_SECTIONS = [
  { id: 'start', label: 'Getting started', icon: 'rocket', group: 'Set up', need: 'billing.settings' },
  { id: 'startpage', label: 'Start page', icon: 'home', group: 'Just for you', need: null },
  { id: 'company', label: 'Company profile', icon: 'building', group: 'For everyone', need: 'billing.settings' },
  { id: 'brand', label: 'Brand colours', icon: 'palette', group: 'For everyone', need: 'billing.settings' },
  { id: 'rules', label: 'Rules and amounts', icon: 'list-check', group: 'For everyone', need: 'billing.settings' },
  { id: 'locations', label: 'Our locations', icon: 'map-pin', group: 'For everyone', need: 'bookings.manage_locations' },
  { id: 'menu', label: 'Menu layout', icon: 'menu-2', group: 'For everyone', need: 'users.manage_menu' },
  { id: 'dash', label: 'Dashboard layout', icon: 'layout-dashboard', group: 'For everyone', need: 'users.manage_menu' },
  { id: 'ic', label: 'IC check accounts', icon: 'id', group: 'For everyone', need: 'ic_check.view' }
];
function setCard(title, desc, body, foot, o) {
  o = o || {};
  return '<div class="card set-card"><div class="card-h"><div><h3>' + esc(title) + '</h3>' + (desc ? '<p>' + desc + '</p>' : '') + '</div>' + (o.actions || '') + '</div><div class="card-b">' + body + '</div>' + (foot ? '<div class="card-f">' + foot + '</div>' : '') + '</div>';
}
function setLog(text, changes) { DB.log('Changed', 'Settings', '', text, changes || []); }
function setSame(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---------- getting started ---------- */
function setGuide(b, d) {
  var done = (d.settings.gsDone = d.settings.gsDone || {}), pub = S.ws.published[b.id];
  var list = [
    { id: 'company', t: 'Fill in your company details', d: 'Name, registration number, address, phone and email. They print on invoices, receipts and the agreement.', ok: !!(b.legal && b.reg && b.address && b.phone && b.email), act: ['Company profile', function (ctx) { setGoSec(ctx, 'company'); }] },
    { id: 'logo', t: 'Add your logo and colours', d: 'Every page, the booking form, the documents and the website use them.', ok: !!(b.logoImg || b.mark), act: ['Brand colours', function (ctx) { setGoSec(ctx, 'brand'); }] },
    { id: 'bank', t: 'Add your bank details', d: 'Customers see them on invoices so they can pay by transfer.', ok: !!(d.company && d.company.bank && d.company.bank.accNo), act: ['Company details', function (ctx) { ctx.go('invoices', { action: 'company' }); }] },
    { id: 'rules', t: 'Check the rules and amounts', d: 'Fines, the usual deposit and the hours in the rental terms the customer signs.', ok: !!d.settings.rulesChecked, act: ['Rules and amounts', function (ctx) { setGoSec(ctx, 'rules'); }] },
    { id: 'locations', t: 'Add where customers pick up and drop off', d: 'Each place becomes a choice in the booking form.', ok: b.locations.length > 0, act: ['Our locations', function (ctx) { setGoSec(ctx, 'locations'); }] },
    { id: 'cars', t: 'Add your cars', d: 'With plates, rates and deposits, and the road tax and insurance dates.', ok: d.cars.length > 0, act: ['Cars', function (ctx) { ctx.go('cars'); }] },
    { id: 'damage', t: 'Set your damage cover packages', d: 'Offered to the customer with each booking.', ok: (d.damagePackages || []).length > 0, act: ['Damage packages', function (ctx) { ctx.go('damage-packages'); }] },
    { id: 'sign', t: 'Add a company signature', d: 'It is placed on every rental agreement.', ok: (d.signatures || []).length > 0, act: ['Signatures', function (ctx) { ctx.go('signatures'); }] },
    { id: 'team', t: 'Add your team and choose what each person can use', d: 'Logins for the office, field agents for deliveries and returns.', ok: d.users.length > 1, act: ['Team', function (ctx) { ctx.go('team'); }] },
    { id: 'web', t: 'Write your FAQs and reviews, then publish the website', d: 'The website shows your cars, prices, FAQs, reviews and social links.', ok: d.faqs.some(function (f) { return f.active; }) && !!pub, act: ['Website', function (ctx) { ctx.go('website'); }] },
  ];
  list.forEach(function (x) { x.done = x.ok || !!done[x.id]; x.byHand = !x.ok && !!done[x.id]; });
  return list;
}
function setGoSec(ctx, id) { ctx.state.sec = id; ctx.setParams({ section: id }); ctx.refresh(); window.scrollTo(0, 0); }

PAGES['settings'] = {
  title: 'Settings',
  render: function (root, ctx) {
    var st = ctx.state, b = ctx.brand, d = ctx.data, u = ctx.me;
    var secs = SET_SECTIONS.filter(function (s) { return !s.need || ctx.can(s.need); });
    var want = ctx.params.section || (S.set && S.set !== 'company' ? { locations: 'locations', start: 'startpage', brand: 'brand', rules: 'rules' }[S.set] : null) || st.sec;
    if (S.set && S.set !== 'company') S.set = 'company';
    st.sec = secs.some(function (s) { return s.id === want; }) ? want : secs[0].id;
    var nav = '', g = null;
    secs.forEach(function (s) { if (s.group !== g) { g = s.group; nav += '<div class="set-ng">' + esc(g) + '</div>'; } nav += '<button type="button" class="set-ni" data-set="' + s.id + '"' + (s.id === st.sec ? ' aria-current="page"' : '') + '>' + i(s.icon) + '<span>' + esc(s.label) + '</span></button>'; });
    root.innerHTML = '<div class="pg-h"><div><h1>Settings</h1><p>Your own choices are listed first. Other people keep their own. The cards under "For everyone" change the dashboard for every team member.</p></div></div>' +
      '<div class="set-wrap"><nav class="set-nav" aria-label="Settings sections">' + nav + '</nav><div class="set-main" id="set-main"></div></div>';
    UI.on(root, 'click', '[data-set]', function (ev, el) { setGoSec(ctx, el.getAttribute('data-set')); });
    var main = root.querySelector('#set-main');
    var draw = function () { var fresh = main.cloneNode(false); main.replaceWith(fresh); main = fresh; (SET_DRAW[st.sec] || SET_DRAW.startpage)(main, ctx, draw); };
    draw();
  },
  onData: function (root, ctx) { if (ctx.state.sec === 'start') ctx.refresh(); },
  search: [
    { label: 'Getting started', icon: 'rocket', keywords: 'setup checklist', run: function (ctx) { setGoSec(ctx, 'start'); } },
    { label: 'Company profile', icon: 'building', keywords: 'name address registration', run: function (ctx) { setGoSec(ctx, 'company'); } },
    { label: 'Brand colours and logo', icon: 'palette', keywords: 'colors logo theme', run: function (ctx) { setGoSec(ctx, 'brand'); } },
    { label: 'Rules and amounts', icon: 'list-check', keywords: 'fines deposit', run: function (ctx) { setGoSec(ctx, 'rules'); } },
    { label: 'Our locations', icon: 'map-pin', keywords: 'pick-up drop-off', run: function (ctx) { setGoSec(ctx, 'locations'); } },
    { label: 'Menu layout', icon: 'menu-2', keywords: 'sidebar groups', run: function (ctx) { setGoSec(ctx, 'menu'); } },
    { label: 'Dashboard layout', icon: 'layout-dashboard', keywords: 'sections order', run: function (ctx) { setGoSec(ctx, 'dash'); } },
    { label: 'IC check accounts', icon: 'id', keywords: 'ic check login', run: function (ctx) { setGoSec(ctx, 'ic'); } }
  ]
};

var SET_DRAW = {};
/* ---------- Getting started ---------- */
SET_DRAW.start = function (el, ctx, redraw) {
  var b = ctx.brand, d = ctx.data, list = setGuide(b, d), n = list.filter(function (x) { return x.done; }).length;
  el.innerHTML = '<div class="card set-card set-gs"><div class="card-h"><div><h3>Getting started</h3><p>The things to set up before ' + esc(b.short) + ' takes bookings on Orbique FMS. Ticks appear by themselves as you go.</p></div>' + UI.chip(n + ' of ' + list.length + ' done', n === list.length ? 'ok' : 'pri') + '</div>' +
    '<div class="card-b"><div class="set-gs-bar">' + UI.progress(n / list.length * 100, n === list.length ? 'ok' : '') + '</div>' + (n === list.length ? UI.alert('Everything is set up. Well done.', 'ok') : '') +
    '<ol class="set-gs-list">' + list.map(function (x, k) {
      return '<li class="' + (x.done ? 'done' : '') + '"><span class="set-gs-ck">' + (x.done ? i('check') : k + 1) + '</span><div class="grow"><div class="t1c fw5">' + esc(x.t) + (x.byHand ? ' ' + UI.chip('Marked done', 'grey') : '') + '</div><div class="b2">' + esc(x.d) + '</div></div><div class="row gap6 set-gs-acts">' +
        (!x.ok ? UI.btn(x.byHand ? 'Not done' : 'Mark done', { kind: 't', size: 'sm', attrs: { 'data-gs-mark': x.id } }) : '') + UI.btn(x.act[0], { kind: x.done ? 'o' : 'c', size: 'sm', icon: 'arrow-right', attrs: { 'data-gs-go': x.id } }) + '</div></li>';
    }).join('') + '</ol></div></div>' +
    setCard('Set up a new company', 'The first-time setup a new business goes through: upload the logo, the name and colours are picked from it, and the dashboard is ready. In this sample it adds your company next to the three made-up ones.',
      '<div class="row wrap gap16"><span class="set-logo-ph">' + i('photo-plus') + '</span><div class="grow b2">PNG, JPG or SVG. A square logo works best. The colours can be changed afterwards in Brand colours.</div><label class="btn c">' + i('upload') + 'Start setup with a logo<input type="file" accept="image/*" data-file="logo" hidden></label></div>');
  el.querySelectorAll('[data-gs-go]').forEach(function (x) { x.addEventListener('click', function () { var it = list.filter(function (z) { return z.id === x.getAttribute('data-gs-go'); })[0]; it.act[1](ctx); }); });
  el.querySelectorAll('[data-gs-mark]').forEach(function (x) { x.addEventListener('click', function () { var id = x.getAttribute('data-gs-mark'), dn = d.settings.gsDone; dn[id] = !dn[id]; setLog(me().name + (dn[id] ? ' marked "' : ' unmarked "') + list.filter(function (z) { return z.id === id; })[0].t + '" in Getting started'); redraw(); }); });
};
/* ---------- Start page (per person) ---------- */
SET_DRAW.startpage = function (el, ctx, redraw) {
  var st = ctx.state, d = ctx.data, u = ctx.me, saved = d.settings.startPage[u.id] || 'dashboard';
  if (!pageAllowed(saved)) saved = 'dashboard';
  st.spDraft = st.spDraft || saved;
  var groups = menuGroups(), any = pageAllowed('dashboard') || groups.length;
  var tile = function (id, def) { var m = PAGE_META[id]; return '<button type="button" class="set-tile" data-sp="' + id + '" aria-pressed="' + (st.spDraft === id) + '">' + i(m[1]) + '<span>' + esc(m[0]) + '</span>' + (def ? '<small>Default</small>' : '') + (st.spDraft === id ? '<span class="set-tick">' + i('check') + '</span>' : '') + '</button>'; };
  var body = !any ? UI.alert('You cannot open any page yet. Ask the owner to switch on a section for you on the Team page.', 'warn') :
    (pageAllowed('dashboard') ? '<div class="set-tiles">' + tile('dashboard', true) + '</div>' : '') + groups.map(function (g) { return '<div class="set-tg">' + esc(g.label) + '</div><div class="set-tiles">' + g.items.map(function (id) { return tile(id); }).join('') + '</div>'; }).join('');
  el.innerHTML = setCard('Start page', 'The page you see first after you sign in or open ' + esc(ctx.brand.short) + '. You can still open any other page from the menu.', body,
    '<span class="b2 grow">' + (st.spMsg ? '<b class="set-ok">' + esc(st.spMsg) + '</b>' : 'You start on <b>' + esc(PAGE_META[st.spDraft][0]) + '</b>.') + '</span>' + UI.btn('Save', { icon: 'device-floppy', disabled: st.spDraft === saved, attrs: { 'data-sp-save': '1' } }), {}) ;
  el.querySelector('.card-f').classList.add('set-sticky');
  el.querySelectorAll('[data-sp]').forEach(function (x) { x.addEventListener('click', function () { st.spDraft = x.getAttribute('data-sp'); st.spMsg = ''; redraw(); }); });
  var sv = el.querySelector('[data-sp-save]'); if (sv) sv.addEventListener('click', function () { d.settings.startPage[u.id] = st.spDraft; st.spMsg = 'Saved. You will start on ' + PAGE_META[st.spDraft][0] + '.'; setLog(u.name + ' chose ' + PAGE_META[st.spDraft][0] + ' as their start page'); redraw(); });
};
/* ---------- Company profile ---------- */
var SET_CO_FIELDS = [['name', 'Company name', 'The name customers see'], ['short', 'Short name', 'Used in the menu and on small screens'], ['legal', 'Registered name', 'Printed on invoices and the agreement'], ['reg', 'Registration no.', ''], ['phone', 'Phone and WhatsApp', ''], ['email', 'Email', ''], ['address', 'Address', 'On invoices and the agreement', 1], ['city', 'City', 'Shown on the website'], ['code', 'Booking code', '']];
SET_DRAW.company = function (el, ctx, redraw) {
  var st = ctx.state, b = ctx.brand;
  var cur = {}; SET_CO_FIELDS.forEach(function (f) { cur[f[0]] = b[f[0]] || ''; });
  st.coDraft = st.coDraft && st.coBrand === b.id ? st.coDraft : Object.assign({}, cur); st.coBrand = b.id;
  var dirty = !setSame(st.coDraft, cur);
  el.innerHTML = setCard('Company profile', 'Shown on the booking form, the agreement, invoices, receipts, WhatsApp messages and your website.',
    '<div class="grid g2 set-form">' + SET_CO_FIELDS.map(function (f) { return UI.input({ key: f[0], label: f[1], value: st.coDraft[f[0]], required: ['name', 'short', 'legal', 'phone', 'code'].indexOf(f[0]) >= 0, help: f[0] === 'code' ? 'New bookings are numbered ' + (st.coDraft.code || b.code) + '-00001, ' + (st.coDraft.code || b.code) + '-00002 ... Bookings you already have keep their number.' : f[2], full: !!f[3], maxlength: f[0] === 'code' ? 4 : 120 }); }).join('') +
      UI.input({ key: 'plan', label: 'Plan', value: planName(b.plan) + ' (from Orbique)', readonly: true, help: 'Ask Orbique to change your plan.' }) + '</div><p class="ui-err set-err" hidden></p>',
    '<span class="b2 grow">Your addresses: <b class="t1c">' + b.slug + '.orbiquefms.com</b> (dashboard), <b class="t1c">' + b.slug + '.orbiquefms.com/book</b> (booking form), <b class="t1c">' + b.slug + '.orbiquefms.site</b> (website)</span>' +
      UI.btn('Discard', { kind: 'o', disabled: !dirty, attrs: { 'data-co-disc': '1' } }) + UI.btn('Save changes', { icon: 'device-floppy', disabled: !dirty, attrs: { 'data-co-save': '1' } }));
  el.addEventListener('input', function onIn(ev) { var k = ev.target.getAttribute('data-key'); if (!k || k === 'plan' || !el.contains(ev.target)) return; st.coDraft[k] = ev.target.value; var dd = !setSame(st.coDraft, cur); el.querySelector('[data-co-save]').disabled = !dd; el.querySelector('[data-co-disc]').disabled = !dd; });
  el.querySelector('[data-co-disc]').addEventListener('click', function () { st.coDraft = null; redraw(); });
  el.querySelector('[data-co-save]').addEventListener('click', function () {
    var f = st.coDraft, er = el.querySelector('.set-err'), miss = ['name', 'short', 'legal', 'phone', 'code'].filter(function (k) { return !String(f[k]).trim(); });
    if (miss.length) { er.textContent = 'Fill in: ' + miss.map(function (k) { return SET_CO_FIELDS.filter(function (x) { return x[0] === k; })[0][1]; }).join(', ') + '.'; er.hidden = false; return; }
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { er.textContent = 'The email does not look right.'; er.hidden = false; return; }
    f.code = String(f.code).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || b.code;
    var changes = []; SET_CO_FIELDS.forEach(function (x) { if (String(b[x[0]] || '') !== String(f[x[0]])) changes.push({ f: x[1], from: b[x[0]] || '', to: f[x[0]] }); b[x[0]] = String(f[x[0]]).trim(); });
    var co = ctx.data.company; if (co) { co.legal = b.legal; co.trading = b.name; co.reg = b.reg; co.phone = b.phone; co.address = b.address; co.email = b.email; }
    setLog(me().name + ' changed the company profile', changes); st.coDraft = null;
    render(); UI.toast('Company profile saved. The menu, documents and website now use it.');
  });
};
/* ---------- Brand colours ---------- */
SET_DRAW.brand = function (el, ctx, redraw) {
  var b = ctx.brand, d = ctx.data;
  var sw = function (k, label, help) { return '<div class="set-sw"><label class="set-swatch" style="background:' + b[k] + '"><input type="color" value="' + b[k].toLowerCase() + '" data-col="' + k + '" aria-label="' + label + '"></label><div class="grow"><div class="t1c fw5">' + label + ' <span class="b2 num">' + b[k] + '</span></div><div class="b2">' + help + '</div></div></div>'; };
  var orig = SET_ORIG[b.id], changed = orig && (orig[0] !== b.primary || orig[1] !== b.secondary || orig[2] !== b.accent);
  el.innerHTML = '<div class="set-brand">' + setCard('Brand colours', 'Picked from your logo. Change any of them; every page, the booking form, the agreement, invoices and the website follow.',
    '<div class="row wrap gap16 set-logo-row"><div class="set-logo">' + (b.logoImg ? '<img src="' + b.logoImg + '" alt="Logo">' : b.mark || i('photo')) + '</div><div class="col gap8"><div class="t1c fw5">Logo</div><div class="b2">PNG, JPG or SVG. A square logo works best.</div><div class="row wrap gap8"><label class="btn o sm">' + i('upload') + 'Upload new logo<input type="file" accept="image/*" data-set-logo hidden></label>' + UI.btn('Pick colours from logo again', { kind: 't', size: 'sm', icon: 'color-picker', attrs: { 'data-repick': '1' } }) + '</div></div></div>' +
      '<div class="set-sws">' + sw('primary', 'Main colour', 'Buttons, the selected menu item, links, money coming in, the booking form buttons.') + sw('secondary', 'Dark colour', 'The big income card, table header bands on Excel files and PDFs, the plate badge, the rule pictures.') + sw('accent', 'Second colour', 'Small highlights and some website designs.') + '</div>' +
      UI.alert('Only the colours and the logo change. Pages, layout and functions stay the same for every company.', 'pri'),
    '<span class="b2 grow">' + esc(b.colorsLabel || '') + '</span>' + UI.btn('Back to the original colours', { kind: 'o', icon: 'arrow-back-up', disabled: !changed, attrs: { 'data-col-reset': '1' } })) +
    setCard('Preview', 'How the colours look in use', '<div class="col gap16"><div class="row wrap gap8">' + UI.btn('Add Booking', { icon: 'plus' }) + UI.btn('Export', { kind: 'o' }) + UI.chip('Selected', 'pri') + '</div><div class="d-item set-pv-nav" aria-current="page">' + i('calendar-event') + '<span>Bookings</span></div>' +
      '<div class="set-pv-hero"><span>Income</span><b>' + UI.fmt.money(sum(d.days), { dp: 0 }) + '</b></div><div class="set-pv-bf"><div class="row gap8">' + mark(b) + '<b>' + esc(b.short) + '</b></div><div class="b2">Step 1 of 4 · Check your booking</div><span class="set-pv-btn">Yes, this is correct</span></div></div>') + '</div>';
  var apply = function (label) { b.colorsLabel = label; applyTheme(b); };
  el.querySelectorAll('[data-col]').forEach(function (inp) {
    inp.addEventListener('input', function () { var k = inp.getAttribute('data-col'); b[k] = inp.value.toUpperCase(); inp.parentNode.style.background = inp.value; applyTheme(b); });
    inp.addEventListener('change', function () { var k = inp.getAttribute('data-col'); apply('Your own colours'); setLog(me().name + ' changed the ' + { primary: 'main', secondary: 'dark', accent: 'second' }[k] + ' colour to ' + b[k]); render(); UI.toast('Colour saved. Every page now uses ' + b[k] + '.'); });
  });
  el.querySelector('[data-col-reset]').addEventListener('click', function () { b.primary = orig[0]; b.secondary = orig[1]; b.accent = orig[2]; apply('Original colours'); setLog(me().name + ' went back to the original colours'); render(); UI.toast('Back to the original colours.'); });
  el.querySelector('[data-set-logo]').addEventListener('change', function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { UI.toast('Choose an image file (PNG, JPG or SVG).', { tone: 'warn' }); return; }
    UI.readImage(f, { max: 600 }).then(function (r) { var img = new Image(); img.onload = function () { var c = colorsFromImage(img); b.logoImg = r.dataUrl; b.primary = c.primary; b.secondary = c.secondary; b.accent = c.accent; apply('Picked from your logo'); setLog(me().name + ' uploaded a new logo'); render(); UI.toast('Logo saved. Colours picked from it: ' + c.primary + ' and ' + c.secondary + '.'); }; img.src = r.dataUrl; });
  });
  el.querySelector('[data-repick]').addEventListener('click', function () {
    if (b.logoImg) { var img = new Image(); img.onload = function () { var c = colorsFromImage(img); b.primary = c.primary; b.secondary = c.secondary; b.accent = c.accent; apply('Picked from your logo'); render(); UI.toast('Colours picked from your logo again.'); }; img.src = b.logoImg; return; }
    if (orig) { b.primary = orig[0]; b.secondary = orig[1]; b.accent = orig[2]; apply('Picked from the logo'); render(); UI.toast('Colours picked from the logo: ' + orig[0] + ' and ' + orig[1] + '.'); }
  });
};
/* ---------- Rules and amounts ---------- */
var SET_RULES = [['smoking', 'Smoking fine', 'RM'], ['dashcam', 'Touching the dashcam', 'RM'], ['key', 'Lost car key', 'RM'], ['late', 'Late return, each started hour', 'RM'], ['toll', 'Lost toll card', 'RM'], ['deposit', 'Usual deposit', 'RM'], ['extendHours', 'Ask to extend at least', 'hours before return'], ['refundHours', 'Deposit refunded within', 'hours after return']];
SET_DRAW.rules = function (el, ctx, redraw) {
  var st = ctx.state, b = ctx.brand, d = ctx.data, val = function (k) { return k in b.fines ? b.fines[k] : b[k]; };
  var cur = {}; SET_RULES.forEach(function (r) { cur[r[0]] = val(r[0]); });
  st.rDraft = st.rDraft && st.rBrand === b.id ? st.rDraft : Object.assign({}, cur); st.rBrand = b.id;
  var dirty = !setSame(st.rDraft, cur);
  el.innerHTML = setCard('Rules and amounts', 'The must know rules, the 22 rental terms and the agreement read these. Change a number and the booking form shows it straight away.',
    '<div class="grid g2 set-form">' + SET_RULES.map(function (r) { return UI.input({ key: r[0], label: r[1], type: 'number', min: 0, value: st.rDraft[r[0]], prefix: r[2] === 'RM' ? 'RM' : '', help: r[2] === 'RM' ? '' : r[2] }); }).join('') + '</div>' +
    (d.settings.rulesChecked ? '<p class="b2 mt16">' + i('circle-check') + ' Checked and saved ' + UI.fmt.ago(d.settings.rulesChecked) + '.</p>' : ''),
    UI.btn('See the booking form', { kind: 't', icon: 'device-mobile', attrs: { 'data-a': 'sec', 'data-v': 'bf' } }) + '<span class="grow"></span>' + UI.btn('Discard', { kind: 'o', disabled: !dirty, attrs: { 'data-r-disc': '1' } }) + UI.btn('Save', { icon: 'device-floppy', disabled: !dirty && !!d.settings.rulesChecked, attrs: { 'data-r-save': '1' } }));
  el.addEventListener('input', function (ev) { var k = ev.target.getAttribute('data-key'); if (!k || !(k in cur)) return; st.rDraft[k] = ev.target.value === '' ? '' : Math.max(0, Math.round(+ev.target.value)); var dd = !setSame(st.rDraft, cur); el.querySelector('[data-r-disc]').disabled = !dd; el.querySelector('[data-r-save]').disabled = !dd && !!d.settings.rulesChecked; });
  el.querySelector('[data-r-disc]').addEventListener('click', function () { st.rDraft = null; redraw(); });
  el.querySelector('[data-r-save]').addEventListener('click', function () {
    var bad = SET_RULES.filter(function (r) { return st.rDraft[r[0]] === '' || isNaN(st.rDraft[r[0]]); });
    if (bad.length) { UI.toast('Type a number for ' + bad[0][1] + '.', { tone: 'warn' }); return; }
    var changes = [];
    SET_RULES.forEach(function (r) { var k = r[0], v = +st.rDraft[k]; if (v !== val(k)) changes.push({ f: r[1], from: String(val(k)), to: String(v) }); if (k in b.fines) b.fines[k] = v; else b[k] = v; });
    d.settings.rulesChecked = NOW(); st.rDraft = null;
    setLog(me().name + ' changed the rules and amounts', changes); redraw();
    UI.toast(changes.length ? 'Saved. The booking form and the rental terms now show the new amounts.' : 'Saved. The amounts are marked as checked.');
  });
};
/* ---------- Our locations ---------- */
SET_DRAW.locations = function (el, ctx, redraw) {
  var st = ctx.state, b = ctx.brand;
  el.innerHTML = setCard('Our locations', 'Where customers pick up and drop off cars. Each one becomes a choice in the booking form.',
    (b.locations.length ? '' : UI.empty({ icon: 'map-pin', title: 'No locations yet', text: 'Add the first place below.' })) +
    b.locations.map(function (l, k) {
      if (st.locRen === k) return '<div class="set-loc"><div class="inp grow"><input data-ren-v value="' + esc(l.n) + '" aria-label="New name" maxlength="80"></div>' + UI.btn('Save', { size: 'sm', attrs: { 'data-ren-save': k } }) + UI.btn('Cancel', { kind: 't', size: 'sm', attrs: { 'data-ren-cancel': '1' } }) + '</div>';
      return '<div class="set-loc"><span class="set-loc-n">' + i('map-pin') + esc(l.n) + '</span>' + UI.check({ key: 'p' + k, label: 'Pick-up', checked: l.p, attrs: { 'data-loc': k + '|p' } }) + UI.check({ key: 'd' + k, label: 'Drop-off', checked: l.d, attrs: { 'data-loc': k + '|d' } }) + '<span class="row gap4">' + UI.btn('Rename', { kind: 't', size: 'sm', icon: 'edit', attrs: { 'data-ren': k } }) + UI.btn('Remove', { kind: 'err', size: 'sm', attrs: { 'data-locdel': k } }) + '</span></div>';
    }).join('') +
    '<div class="set-loc set-loc-new"><div class="inp grow"><label for="set-newloc">New location</label><input id="set-newloc" placeholder="e.g. Midtown Mega Mall" maxlength="80"></div>' + UI.check({ key: 'np', label: 'Pick-up', checked: true }) + UI.check({ key: 'nd', label: 'Drop-off', checked: true }) + UI.btn('Add location', { icon: 'plus', size: 'sm', attrs: { 'data-locadd': '1' } }) + '</div>');
  el.querySelectorAll('[data-loc]').forEach(function (x) { x.addEventListener('change', function () { var p = x.getAttribute('data-loc').split('|'), l = b.locations[+p[0]]; l[p[1]] = x.checked; setLog(me().name + ' changed location ' + l.n, [{ f: p[1] === 'p' ? 'Pick-up' : 'Drop-off', from: x.checked ? 'Off' : 'On', to: x.checked ? 'On' : 'Off' }]); UI.toast('Saved.'); }); });
  el.querySelectorAll('[data-ren]').forEach(function (x) { x.addEventListener('click', function () { st.locRen = +x.getAttribute('data-ren'); redraw(); var f = el.querySelector('[data-ren-v]'); if (f) { f.focus(); f.select(); } }); });
  var rc = el.querySelector('[data-ren-cancel]'); if (rc) rc.addEventListener('click', function () { st.locRen = null; redraw(); });
  var rs = el.querySelector('[data-ren-save]'); if (rs) { var doRen = function () { var k = +rs.getAttribute('data-ren-save'), v = el.querySelector('[data-ren-v]').value.trim(); if (!v) { UI.toast('Type the name of the place.', { tone: 'warn' }); return; } var old = b.locations[k].n; b.locations[k].n = v; st.locRen = null; setLog(me().name + ' renamed location ' + old, [{ f: 'Name', from: old, to: v }]); redraw(); UI.toast('Renamed.'); }; rs.addEventListener('click', doRen); el.querySelector('[data-ren-v]').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doRen(); if (ev.key === 'Escape') { ev.stopPropagation(); st.locRen = null; redraw(); } }); }
  el.querySelectorAll('[data-locdel]').forEach(function (x) { x.addEventListener('click', function () {
    var k = +x.getAttribute('data-locdel'), l = b.locations[k];
    UI.confirm({ title: 'Remove ' + l.n + '?', text: 'The booking form stops offering it. Bookings that already use it keep it.', ok: 'Remove', danger: true }).then(function (y) { if (!y) return; b.locations.splice(k, 1); setLog(me().name + ' removed location ' + l.n); redraw(); UI.toast(l.n + ' removed.', { action: { label: 'Undo', run: function () { b.locations.splice(k, 0, l); redraw(); } } }); });
  }); });
  var add = function () {
    var f = el.querySelector('#set-newloc'), v = f.value.trim();
    if (!v) { UI.toast('Type the name of the place first.', { tone: 'warn' }); f.focus(); return; }
    if (b.locations.some(function (l) { return l.n.toLowerCase() === v.toLowerCase(); })) { UI.toast(v + ' is already on the list.', { tone: 'warn' }); return; }
    var p = el.querySelector('[data-key="np"]').checked, dd = el.querySelector('[data-key="nd"]').checked;
    if (!p && !dd) { UI.toast('Tick Pick-up, Drop-off or both.', { tone: 'warn' }); return; }
    b.locations.push({ n: v, p: p, d: dd }); setLog(me().name + ' added location ' + v); redraw(); UI.toast('Location added.');
  };
  el.querySelector('[data-locadd]').addEventListener('click', add);
  el.querySelector('#set-newloc').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') add(); });
};
/* ---------- Menu layout ---------- */
SET_DRAW.menu = function (el, ctx, redraw) {
  var st = ctx.state, d = ctx.data, saved = d.settings.menu;
  if (!st.mDraft || st.mBrand !== ctx.brand.id) { st.mDraft = JSON.parse(JSON.stringify(saved)); st.mBrand = ctx.brand.id; }
  var g = st.mDraft, dirty = !setSame(g, saved), isDefault = setSame(saved, DEFAULT_MENU.map(function (x) { return { label: x.label, items: x.items }; }));
  var status = dirty ? 'You have changes that are not saved yet.' : isDefault ? 'The menu uses the built-in groups.' : 'This is the saved menu.';
  var body = '<div class="set-groups">' + g.map(function (grp, k) {
    return '<div class="set-grp"><div class="row wrap gap8 set-grp-h"><div class="inp grow"><label for="mg-' + k + '">Group name</label><input id="mg-' + k + '" data-mg-name="' + k + '" value="' + esc(grp.label) + '" maxlength="40"' + (!grp.label.trim() ? ' aria-invalid="true"' : '') + '>' + (!grp.label.trim() ? '<span class="ui-err">Give the group a name.</span>' : '') + '</div><span class="row gap4 set-grp-acts">' +
      UI.iconBtn('arrow-up', 'Move group up', { size: 'sm', disabled: k === 0, attrs: { 'data-mg-up': k } }) + UI.iconBtn('arrow-down', 'Move group down', { size: 'sm', disabled: k === g.length - 1, attrs: { 'data-mg-down': k } }) +
      UI.iconBtn('trash', g.length === 1 ? 'Keep at least one group' : 'Remove group (its items move to the group ' + (k ? 'above' : 'below') + ')', { size: 'sm', disabled: g.length === 1, attrs: { 'data-mg-del': k } }) + '</span></div>' +
      (grp.items.length ? grp.items.map(function (id, j) { var m = PAGE_META[id] || [id, 'point']; return '<div class="set-mi">' + i(m[1]) + '<span class="grow">' + esc(m[0]) + '</span><div class="inp set-mi-sel"><select data-mi-move="' + k + '|' + j + '" aria-label="Group for ' + esc(m[0]) + '">' + g.map(function (x, gi) { return '<option value="' + gi + '"' + (gi === k ? ' selected' : '') + '>' + esc(x.label || 'Group ' + (gi + 1)) + '</option>'; }).join('') + '</select></div>' + UI.iconBtn('arrow-up', 'Move up', { size: 'sm', disabled: j === 0, attrs: { 'data-mi-up': k + '|' + j } }) + UI.iconBtn('arrow-down', 'Move down', { size: 'sm', disabled: j === grp.items.length - 1, attrs: { 'data-mi-down': k + '|' + j } }) + '</div>'; }).join('') : '<p class="b2 set-empty">No pages in this group yet. Move pages here with their group list. A group with nothing in it is hidden from the menu.</p>') + '</div>';
  }).join('') + '</div>' +
    '<div class="row wrap gap8 set-newgrp"><div class="inp grow"><label for="set-ng">New group</label><input id="set-ng" placeholder="e.g. Finance" maxlength="40"></div>' + UI.btn('Add group', { kind: 'o', icon: 'plus', disabled: g.length >= 10, title: g.length >= 10 ? 'At most 10 groups.' : '', attrs: { 'data-mg-add': '1' } }) + '</div>' + (g.length >= 10 ? '<p class="b2">At most 10 groups.</p>' : '') +
    '<div class="set-pv"><div class="h6">Preview: pages in their menu</div><div class="set-pv-g"><div class="set-pv-h">Dashboard</div><span class="chip pri">' + i('layout-dashboard') + 'Dashboard</span></div>' + g.filter(function (x) { return x.items.length; }).map(function (x) { return '<div class="set-pv-g"><div class="set-pv-h">' + esc(x.label || 'No name') + '</div><div class="row wrap gap6">' + x.items.map(function (id) { return '<span class="chip pri">' + i((PAGE_META[id] || [0, 'point'])[1]) + esc((PAGE_META[id] || [id])[0]) + '</span>'; }).join('') + '</div></div>'; }).join('') + '<p class="b2">Shown for someone who can open everything. Each person still sees only the pages they may open.</p></div>' +
    '<p class="b2">Built-in groups: Bookings, Operations, Fleet Management, System Settings, Team & access.</p>';
  el.innerHTML = setCard('Menu layout', 'Choose which group each feature sits under in the left-hand menu. This changes the menu for everyone. It does not change who can open a page.', body,
    '<span class="b2 grow' + (dirty ? ' set-warn' : '') + '">' + status + '</span>' + UI.btn('Reset to default', { kind: 'o', disabled: isDefault && !dirty, attrs: { 'data-m-reset': '1' } }) + UI.btn('Save', { icon: 'device-floppy', disabled: !dirty, attrs: { 'data-m-save': '1' } }));
  var move = function (arr, a, bb) { var x = arr.splice(a, 1)[0]; arr.splice(bb, 0, x); };
  el.addEventListener('input', function (ev) { var k = ev.target.getAttribute('data-mg-name'); if (k == null) return; g[+k].label = ev.target.value; var dd = !setSame(g, saved); el.querySelector('[data-m-save]').disabled = !dd; var s = el.querySelector('.card-f .b2'); s.textContent = dd ? 'You have changes that are not saved yet.' : status; });
  el.addEventListener('change', function (ev) { var v = ev.target.getAttribute('data-mi-move'); if (!v) { if (ev.target.getAttribute('data-mg-name') != null) redraw(); return; } var p = v.split('|').map(Number), id = g[p[0]].items.splice(p[1], 1)[0]; g[+ev.target.value].items.push(id); redraw(); });
  el.addEventListener('click', function (ev) {
    var x = ev.target.closest('button'); if (!x || x.disabled) return; var a;
    if ((a = x.getAttribute('data-mg-up')) != null) { move(g, +a, +a - 1); redraw(); }
    else if ((a = x.getAttribute('data-mg-down')) != null) { move(g, +a, +a + 1); redraw(); }
    else if ((a = x.getAttribute('data-mg-del')) != null) { var k = +a, to = k ? k - 1 : 1; g[to].items = g[to].items.concat(g[k].items); g.splice(k, 1); redraw(); }
    else if ((a = x.getAttribute('data-mi-up')) != null) { var p = a.split('|').map(Number); move(g[p[0]].items, p[1], p[1] - 1); redraw(); }
    else if ((a = x.getAttribute('data-mi-down')) != null) { var q = a.split('|').map(Number); move(g[q[0]].items, q[1], q[1] + 1); redraw(); }
    else if (x.hasAttribute('data-mg-add')) { var f = el.querySelector('#set-ng'), v = f.value.trim(); if (!v) { UI.toast('Give the group a name.', { tone: 'warn' }); f.focus(); return; } if (g.length >= 10) { UI.toast('At most 10 groups.', { tone: 'warn' }); return; } g.push({ label: v.slice(0, 40), items: [] }); redraw(); }
    else if (x.hasAttribute('data-m-reset')) { st.mDraft = DEFAULT_MENU.map(function (z) { return { label: z.label, items: z.items.slice() }; }); redraw(); }
    else if (x.hasAttribute('data-m-save')) {
      if (g.some(function (z) { return !z.label.trim(); })) { UI.toast('Give every group a name.', { tone: 'warn' }); return; }
      d.settings.menu = JSON.parse(JSON.stringify(g)); setLog(me().name + ' changed the menu layout', [{ f: 'Groups', from: String(saved.length), to: String(g.length) }]);
      st.mDraft = null; render(); UI.toast('Menu layout saved');
    }
  });
};
/* ---------- Dashboard layout ---------- */
SET_DRAW.dash = function (el, ctx, redraw) {
  var st = ctx.state, d = ctx.data, saved = d.settings.dashLayout, def = LISTS.dashSections.map(function (s) { return { id: s[0], on: true }; });
  if (!st.dDraft || st.dBrand !== ctx.brand.id) { st.dDraft = JSON.parse(JSON.stringify(saved)); st.dBrand = ctx.brand.id; }
  var L = st.dDraft, dirty = !setSame(L, saved), meta = function (id) { return LISTS.dashSections.filter(function (s) { return s[0] === id; })[0]; };
  var status = dirty ? 'You have changes that are not saved yet.' : L.every(function (x) { return !x.on; }) ? 'Every section is off, so the Dashboard will show only its heading.' : setSame(saved, def) ? 'The Dashboard uses its built-in order, with everything on.' : 'This is the saved layout.';
  el.innerHTML = setCard('Dashboard layout', 'Choose the order of the sections on the Dashboard and switch any of them off. This changes the Dashboard for everyone.',
    UI.alert('People only see the sections they have access to. Switching a section on here does not give anyone access to it.', 'pri') + '<ol class="set-dl">' + L.map(function (x, k) { var m = meta(x.id); return '<li class="' + (x.on ? '' : 'off') + '"><span class="set-dl-n">' + (k + 1) + '</span><div class="grow"><div class="t1c fw5">' + esc(m[1]) + '</div><div class="b2">' + esc(m[2]) + '</div></div><label class="sw" title="' + (x.on ? 'Switch off' : 'Switch on') + '"><input type="checkbox" data-dl-on="' + k + '"' + (x.on ? ' checked' : '') + ' aria-label="Show ' + esc(m[1]) + '"><span></span></label>' + UI.iconBtn('arrow-up', 'Move up', { size: 'sm', disabled: k === 0, attrs: { 'data-dl-up': k } }) + UI.iconBtn('arrow-down', 'Move down', { size: 'sm', disabled: k === L.length - 1, attrs: { 'data-dl-down': k } }) + '</li>'; }).join('') + '</ol>',
    '<span class="b2 grow' + (dirty ? ' set-warn' : '') + '">' + status + '</span>' + UI.btn('Reset to default', { kind: 'o', disabled: setSame(L, def), attrs: { 'data-dl-reset': '1' } }) + UI.btn('Save', { icon: 'device-floppy', disabled: !dirty, attrs: { 'data-dl-save': '1' } }));
  el.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-dl-on'); if (k == null) return; L[+k].on = ev.target.checked; redraw(); });
  el.addEventListener('click', function (ev) {
    var x = ev.target.closest('button'); if (!x || x.disabled) return; var a;
    if ((a = x.getAttribute('data-dl-up')) != null) { L.splice(+a - 1, 0, L.splice(+a, 1)[0]); redraw(); }
    else if ((a = x.getAttribute('data-dl-down')) != null) { L.splice(+a + 1, 0, L.splice(+a, 1)[0]); redraw(); }
    else if (x.hasAttribute('data-dl-reset')) { st.dDraft = JSON.parse(JSON.stringify(def)); redraw(); }
    else if (x.hasAttribute('data-dl-save')) { d.settings.dashLayout = JSON.parse(JSON.stringify(L)); setLog(me().name + ' changed the dashboard layout', L.map(function (z, k) { return { f: (k + 1) + '. ' + meta(z.id)[1], from: '', to: z.on ? 'On' : 'Off' }; })); st.dDraft = null; redraw(); UI.toast('Dashboard layout saved'); }
  });
};
/* ---------- IC check accounts ---------- */
SET_DRAW.ic = function (el, ctx, redraw) {
  var d = ctx.data, edit = ctx.can('ic_check.manage_accounts'), sites = d.settings.icSites;
  el.innerHTML = setCard('IC check accounts', 'The logins used to check a customer IC on outside sites. These accounts drive the Check IC button on the customer and booking screens.',
    UI.alert('The logins are stored encrypted and are never shown again. Use an account made for this app with a password you use nowhere else, and check that each site\'s rules and your account allow automatic checking: those rules apply.', 'pri') +
    (edit ? '' : UI.alert('You can see these accounts but not change them. That needs "Manage IC check accounts".', 'warn', { icon: 'lock' })) +
    sites.map(function (s) {
      return '<div class="set-ic"><div class="row wrap gap8"><b class="t1c">' + esc(s.name) + '</b>' + (s.saved ? UI.chip('Login saved', 'ok') : UI.chip('No login saved', 'grey')) + '<span class="b2">Last checked: ' + (s.lastChecked ? UI.fmt.dateTime(s.lastChecked) : '-') + '</span></div><div class="b2">' + esc(s.url) + ' · searches by ' + esc(s.searchBy) + '</div>' +
        '<div class="grid g2 set-form">' + UI.input({ key: 'user-' + s.id, label: 'Username or email', value: s.user || '', disabled: !edit, attrs: { autocomplete: 'off' } }) + UI.input({ key: 'pw-' + s.id, label: 'Password', type: 'password', placeholder: s.saved ? 'Saved (type to replace)' : '', disabled: !edit, attrs: { autocomplete: 'new-password' } }) + '</div>' +
        '<div class="row wrap gap8">' + UI.btn('Save login', { size: 'sm', icon: 'device-floppy', disabled: !edit, attrs: { 'data-ic-save': s.id } }) + (s.saved ? UI.btn('Remove saved login', { kind: 'err', size: 'sm', disabled: !edit, attrs: { 'data-ic-rm': s.id } }) : '') + UI.btn('Test the login', { kind: 't', size: 'sm', icon: 'player-play', disabled: !s.saved, attrs: { 'data-ic-test': s.id } }) + '</div>' +
        UI.switch({ key: 'on-' + s.id, label: 'Use this site when checking an IC', checked: s.on, disabled: !edit || !s.saved, help: s.saved ? '' : 'Save a login first.', attrs: { 'data-ic-on': s.id } }) +
        '<div class="row wrap gap8 set-ic-words">' + UI.input({ key: 'words-' + s.id, label: 'Words the site shows for a warning', value: s.words || '', placeholder: 'e.g. flagged, default, warning', help: 'Comma separated. Leave empty until you have seen what a warning looks like on the site.', disabled: !edit }) + UI.btn('Save words', { kind: 'o', size: 'sm', disabled: !edit, attrs: { 'data-ic-words': s.id } }) + '</div>' +
        (s.wired ? '' : UI.alert('The automatic check for this site is not switched on yet: it still needs to be set up with the site\'s real search page. Until then it shows "Not set up" when staff check an IC.', 'warn')) + '</div>';
    }).join(''));
  var site = function (x, a) { return byId(sites, x.getAttribute(a)); };
  el.querySelectorAll('[data-ic-save]').forEach(function (x) { x.addEventListener('click', function () {
    var s = site(x, 'data-ic-save'), un = el.querySelector('[data-key="user-' + s.id + '"]').value.trim(), pw = el.querySelector('[data-key="pw-' + s.id + '"]').value;
    if (!un) { UI.toast('Type the username or email.', { tone: 'warn' }); return; }
    if (!pw && !s.saved) { UI.toast('Type the password.', { tone: 'warn' }); return; }
    s.user = un; s.saved = true; DB.log('Changed', 'Settings', s.id, me().name + ' saved the login for ' + s.name); redraw(); UI.toast('Login saved. The password is not shown again.');
  }); });
  el.querySelectorAll('[data-ic-rm]').forEach(function (x) { x.addEventListener('click', function () { var s = site(x, 'data-ic-rm'); UI.confirm({ title: 'Remove the saved login for ' + s.name + '?', text: 'Staff cannot check ICs on this site until a login is saved again.', ok: 'Remove', danger: true }).then(function (y) { if (!y) return; s.saved = false; s.user = ''; s.on = false; DB.log('Changed', 'Settings', s.id, me().name + ' removed the saved login for ' + s.name); redraw(); UI.toast('Login removed.'); }); }); });
  el.querySelectorAll('[data-ic-on]').forEach(function (x) { x.addEventListener('change', function () { var s = site(x, 'data-ic-on'); s.on = x.checked; DB.log('Changed', 'Settings', s.id, me().name + (s.on ? ' switched on ' : ' switched off ') + s.name, [{ f: 'Use when checking an IC', from: s.on ? 'Off' : 'On', to: s.on ? 'On' : 'Off' }]); UI.toast(s.on ? 'Switched on.' : 'Switched off.'); }); });
  el.querySelectorAll('[data-ic-words]').forEach(function (x) { x.addEventListener('click', function () { var s = site(x, 'data-ic-words'); s.words = el.querySelector('[data-key="words-' + s.id + '"]').value.split(',').map(function (w) { return w.trim(); }).filter(Boolean).join(', '); DB.log('Changed', 'Settings', s.id, me().name + ' changed the warning words for ' + s.name); redraw(); UI.toast('Words saved.'); }); });
  el.querySelectorAll('[data-ic-test]').forEach(function (x) { x.addEventListener('click', function () { var s = site(x, 'data-ic-test'); s.lastChecked = NOW(); UI.dialog({ title: 'Test: ' + s.name, width: 'sm', body: s.wired ? UI.alert('Signed in to the site. The login works.', 'ok') : UI.alert('Not set up: the site\'s search page is not wired up yet, so the sample cannot sign in. The saved login is kept.', 'warn'), buttons: [{ label: 'Close' }] }); redraw(); }); });
};

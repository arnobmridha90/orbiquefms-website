/* ===================================================================
   Core: state, formatting, theme from the company's colours, the sample bar, events.
   =================================================================== */
var S = {
  b: 0, sec: 'dash', page: 'dashboard', params: {}, pg: {}, user: {}, lang: 'en', drawer: null, modal: null, rail: false, nav: false, toast: null,
  period: 'month', bk: { q: '', st: 'all', pay: 'all', page: 1, sel: {} }, cust: 'all', custQ: '', dep: 'waiting', inv: 'invoices', carView: 'cards', carTab: 'papers',
  av: { len: 1, show: false }, set: 'company', heroTable: false,
  bf: { screen: 0, agreed: false, sig: null, licence: false, idType: 'ic', termsOpen: false },
  ws: { full: null, device: 'desktop', page: 'gallery', published: { kilat: { t: 0, at: '2 Oct 2026, 4:20 PM', by: 'Irfan' }, padi: null, bara: { t: 2, at: '28 Sep 2026, 11:05 AM', by: 'Arun' } }, cur: { kilat: 0, padi: 0, bara: 2 } },
  pf: { tab: 'companies', q: '', filter: 'all', nav: false, status: {}, plans: {}, extra: [], reqs: null }
};
function B() { return BRANDS[S.b]; }
function D() { return B().data; }

/* ---------------- page registry ----------------
   PAGES.<id> = { title, render(root, ctx) }   (see BUILDERS.md). The website page in sites.js still registers the
   older way (a function returning HTML); the shell accepts both. DRAWERS / MODALS hold the older string drawers. */
var PAGES = {}, DRAWERS = {}, MODALS = {};

/* ---------------- who is signed in, and what they may do ---------------- */
function me() { var d = D(); if (!d || !d.users) return null; var id = S.user[B().id]; return byId(d.users, id) || d.users[0]; }
function myCodes(u) {
  u = u || me(); if (!u) return [];
  if (u.superAdmin) return PERM_CODES;
  var role = byId(D().roles, u.role), set = {};
  (role ? role.codes : []).forEach(function (c) { set[c] = 1; });
  (u.extra || []).forEach(function (c) { set[c] = 1; });
  (u.removed || []).forEach(function (c) { delete set[c]; });
  return Object.keys(set);
}
/* can('bookings.delete') -> true / false for the person signed in */
function can(code, u) { u = u || me(); if (!u) return false; if (u.superAdmin) return true; return myCodes(u).indexOf(code) >= 0; }

/* ---------------- formatting ---------------- */
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function n0(v) { return Math.round(v).toLocaleString('en-US'); }
function rm(v) { return 'RM ' + n0(v); }
function rm2(v) { return 'RM ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function rmk(v) { return v >= 1000 ? 'RM ' + (Math.round(v / 100) / 10) + 'k' : 'RM ' + Math.round(v); }
function tm(d) { var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }
function tml(d) { return tm(d).toLowerCase(); }
function dShort(d) { return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
function dDay(d) { return d.getDate() + ' ' + MON[d.getMonth()]; }
function dFull(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
function dNum(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
function ago(d) { var h = Math.round((TODAY - d) / 36e5); if (h < 1) return 'just now'; if (h < 24) return h + ' hr' + (h === 1 ? '' : 's') + ' ago'; var dd = Math.round(h / 24); return dd + ' day' + (dd === 1 ? '' : 's') + ' ago'; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function initials(n) { return n.split(' ').filter(Boolean).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase(); }
function maskId(id) { return id.length > 8 ? id.slice(0, 2) + '••••' + id.slice(-4) : id.slice(0, 1) + '•••' + id.slice(-3); }
function i(name, extra) { return '<i class="tabler-' + name + (extra ? ' ' + extra : '') + '" aria-hidden="true"></i>'; }
function mark(b, cls) { b = b || B(); return '<span class="mk' + (cls ? ' ' + cls : '') + '">' + (b.logoImg ? '<img src="' + b.logoImg + '" alt="">' : b.mark) + '</span>'; }
function carName(c) { return c.make + ' ' + c.model; }
function carModel(c) { return c.make + ' ' + c.model.split(' ')[0]; }

/* status colours: the template system's own */
var BOOKING_COLORS = { 'Pending': '#94a3b8', 'Confirmed': '#94a3b8', 'Agreement Sent': '#ef4444', 'Agreement Signed': '#ef4444', 'Car Delivered': '#22c55e', 'Car Returned': '#3b82f6', 'Completed': '#6b7280', 'Cancelled': '#9ca3af' };
var PAY_COLORS = { 'Deposit due': '#ef4444', 'Deposit Received': '#eab308', 'Full Payment Received': '#10b981', 'Extension due': '#ef4444', 'Extension paid': '#22c55e', 'Refund Pending': '#3b82f6', 'Deposit Refunded': '#f97316' };
function schip(label, color) { return '<span class="schip" style="color:' + color + ';border-color:' + color + '4d;background:' + color + '26">' + esc(label) + '</span>'; }
function bchip(b) { return schip(b.status, BOOKING_COLORS[b.status] || '#94a3b8'); }
function pchip(b) { return schip(b.pay || 'None', PAY_COLORS[b.pay] || '#94a3b8'); }
function planName(p) { var x = PLANS.filter(function (q) { return q[0] === p; })[0]; return x ? x[1] : p; }

/* ---------------- theme from the company's colours ---------------- */
function applyTheme(b) {
  var p = b.primary, s = b.secondary, a = b.accent || b.primary, r = document.documentElement.style;
  var sec = s; while (C.lum(sec) > .06) sec = C.mix(sec, '#000000', .15);
  var heroB = C.mix(sec, '#000000', .45), heroA = C.mix(sec, '#FFFFFF', .07);
  var set = {
    '--primary': p, '--primary-rgb': C.ch(p), '--primary-light': C.mix(p, '#FFFFFF', .25), '--primary-dark': C.mix(p, '#000000', .22),
    '--on-primary': C.onColor(p), '--primary-text-l': C.readable(p, 4.5), '--primary-text-d': C.onDark(p, '#2F3349', 4.5), '--primary-tint-l': C.mix(p, '#FFFFFF', .88),
    '--secondary': s, '--secondary-rgb': C.ch(s), '--on-secondary': C.onColor(s),
    '--accent': a, '--accent-rgb': C.ch(a), '--on-accent': C.onColor(a),
    '--hero-a': heroA, '--hero-b': heroB, '--hero-line': C.onDark(p, heroB, 4),
    '--t1-glow': C.mix(p, '#000000', .72), '--t1-red': C.onDark(p, '#020202', 4)
  };
  /* a red brand makes focus rings and ticked rows look like errors: use the dark brand colour for those instead
     (the mobile app does the same). Buttons and the menu keep the brand colour. */
  var hs = C.hsl(p), nearRed = hs[1] > .35 && Math.min(hs[0], 360 - hs[0]) <= 25;
  var dk = nearRed ? (C.lum(s) < .2 ? s : C.mix(s, '#000000', .5)) : p;
  set['--focus-l'] = nearRed ? dk : p; set['--focus-d'] = nearRed ? '#C9CCD6' : C.onDark(p, '#2F3349', 3);
  set['--sel-rgb'] = C.ch(nearRed ? dk : p);
  for (var k in set) r.setProperty(k, set[k]);
  document.documentElement.classList.toggle('brand-dark-accent', nearRed);
}

/* ---------------- picking colours from an uploaded logo ---------------- */
function colorsFromImage(img) {
  var cv = document.createElement('canvas'), N = 64; cv.width = N; cv.height = N;
  var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, N, N);
  var px = cx.getImageData(0, 0, N, N).data, bins = {};
  for (var k = 0; k < px.length; k += 4) {
    if (px[k + 3] < 140) continue;
    var key = (px[k] >> 4) + ',' + (px[k + 1] >> 4) + ',' + (px[k + 2] >> 4);
    var e = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 }); e.n++; e.r += px[k]; e.g += px[k + 1]; e.b += px[k + 2];
  }
  var list = Object.keys(bins).map(function (key) { var e = bins[key]; var h = C.hex([e.r / e.n, e.g / e.n, e.b / e.n]); return { hex: h, n: e.n, hsl: C.hsl(h) }; });
  var vivid = list.filter(function (c) { return c.hsl[1] > .28 && c.hsl[2] > .16 && c.hsl[2] < .82; }).sort(function (a, b) { return b.n * (.4 + b.hsl[1]) - a.n * (.4 + a.hsl[1]); });
  var darks = list.filter(function (c) { return c.hsl[2] < .3; }).sort(function (a, b) { return b.n - a.n; });
  var primary = vivid.length ? vivid[0].hex : (darks.length ? C.mix(darks[0].hex, '#3366FF', .5) : '#3366FF');
  var accent = primary;
  for (var j = 1; j < vivid.length; j++) { if (Math.abs(vivid[j].hsl[0] - C.hsl(primary)[0]) > 30 && vivid[j].n > vivid[0].n * .08) { accent = vivid[j].hex; break; } }
  var secondary = darks.length && darks[0].n > 20 ? darks[0].hex : C.mix(primary, '#000000', .78);
  return { primary: primary, secondary: secondary, accent: accent };
}
function addLogo(file) {
  if (!file || !/^image\//.test(file.type)) { toast('Choose an image file (PNG, JPG or SVG).'); return; }
  var rd = new FileReader();
  rd.onload = function () {
    var img = new Image();
    img.onload = function () {
      var col = colorsFromImage(img), base = BRANDS[0];
      var nm = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b(logo|final|copy|v\d+)\b/gi, '').trim();
      nm = nm ? nm.replace(/\b\w/g, function (c) { return c.toUpperCase(); }).slice(0, 28) : 'Your Company';
      var mine = BRANDS.filter(function (b) { return b.id === 'mine'; })[0];
      if (!mine) {
        mine = { id: 'mine', sub: 'Car Rental', legal: nm + ' Sdn. Bhd.', reg: '000000000000 (Sample)', code: 'YRC', startNo: 101, owner: 'You', staff: ['You', 'Aina', 'Ken'], city: 'Kuala Lumpur',
          address: 'Your address, from Settings', phone: '+60 00-000 0000', email: 'hello@yourcompany.example', slug: 'yourcompany', plan: 'trial',
          fines: { smoking: 200, dashcam: 200, key: 600, late: 20, toll: 10 }, deposit: 200, extendHours: 12, refundHours: 24, locations: base.locations.slice(), fleet: base.fleet, tag: 'Car rental, made simple', mark: '' };
        mine.data = buildAll(mine, 4242); BRANDS.push(mine); S.ws.published.mine = null; S.ws.cur.mine = 0;
      }
      mine.name = nm; mine.short = nm.split(' ')[0]; mine.logoImg = rd.result; mine.custom = true;
      mine.primary = col.primary; mine.secondary = col.secondary; mine.accent = col.accent; mine.colorsLabel = 'Picked from your logo';
      S.b = BRANDS.indexOf(mine); applyTheme(mine); toast('Colours picked from your logo: ' + col.primary + ' and ' + col.secondary + '. Change them in Settings > Brand colours.'); render();
    };
    img.onerror = function () { toast('That image could not be read. Try a PNG or JPG.'); };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}

/* ---------------- sample bar ---------------- */
function sampleBar() {
  var secs = [['dash', 'Staff dashboard', 'layout-dashboard'], ['bf', 'Booking form', 'device-mobile'], ['web', 'Website templates', 'world'], ['pf', 'Platform admin', 'building-skyscraper']];
  var cur = S.sec === 'dash' && S.page === 'website' ? 'web' : S.sec;
  return '<div class="sx" role="region" aria-label="Sample controls"><div class="sx-in">' +
    '<span class="sx-tag"><span class="sx-orb"><svg width="12" height="12" viewBox="0 0 24 24"><circle cx="11" cy="13" r="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="18" cy="6" r="3" fill="#C9A227"/></svg></span>Orbique FMS <small>v2 sample, made-up data</small></span>' +
    '<div class="sx-group" role="group" aria-label="Rental company"><span class="sx-lbl">Company</span>' +
    BRANDS.map(function (b, k) {
      return '<button type="button" class="sx-b" data-a="brand" data-v="' + k + '" aria-pressed="' + (k === S.b) + '" title="' + esc(b.name + ': ' + b.colorsLabel) + '">' + mark(b, 'sx-mk') + '<span>' + esc(b.short) + '</span><span class="sx-dots"><i style="background:' + b.primary + '"></i><i style="background:' + b.secondary + '"></i></span></button>';
    }).join('') +
    '<label class="sx-b sx-add" title="Pick the colours from your own logo">' + i('photo-plus') + '<span>Add your logo</span><input type="file" accept="image/*" data-file="logo" hidden></label></div>' +
    '<span class="sx-sp"></span>' +
    '<div class="sx-group sx-sec" role="group" aria-label="What to show">' + secs.map(function (s) {
      return '<button type="button" class="sx-b" data-a="sec" data-v="' + s[0] + '" aria-pressed="' + (cur === s[0]) + '">' + i(s[2]) + '<span>' + s[1] + '</span></button>';
    }).join('') + '</div></div></div>';
}

/* ---------------- rendering ---------------- */
var POST = [];
/* draws everything: the sample bar, then the dashboard shell (shell.js mounts the page into it), the booking form or the platform */
function render() {
  var b = B();
  POST = [];
  var html = sampleBar();
  if (S.sec === 'pf') html += platformView(); else if (S.sec === 'bf') html += bookingFormView(); else if (S.sec === 'login') html += loginView(); else html += dashShell();
  document.getElementById('app').innerHTML = html;
  document.title = S.sec === 'pf' ? 'Orbique FMS platform' : (S.sec === 'dash' ? pageTitle(S.page) + ' · ' : '') + b.name;
  if (S.sec === 'dash') mountPage();
  POST.forEach(function (f) { try { f(); } catch (e) { console.warn(e); } });
  fitThumbs();
  writeHash();
}
/* the older toast, now shown by the UI kit */
function toast(msg, o) { return UI.toast(msg, o); }

/* actions, by name */
var A = {
  brand: function (v) { UI.leave(function () { UI.closeAll(); UI.clearToasts(0); S.b = +v; applyTheme(B()); S.drawer = null; S.modal = null; render(); emit('brand', B()); }, { onStay: function () { render(); } }); },
  sec: function (v) { UI.leave(function () { A.sec0(v); }); },
  sec0: function (v) { UI.closeAll(); UI.clearToasts(); S.drawer = null; S.modal = null; S.nav = false; S.ws.full = null; if (v === 'web') { S.sec = 'dash'; S.page = 'website'; } else { S.sec = v; if (v === 'dash' && S.page === 'website') S.page = 'dashboard'; } if (v === 'pf') applyTheme(B()); render(); window.scrollTo(0, 0); },
  nav: function (v) { go(v); },
  close: function () { S.drawer = null; S.modal = null; render(); },
  go: function (v, el) { var p = {}; (el.getAttribute('data-p') || '').split('&').forEach(function (kv) { if (kv) { var q = kv.split('='); p[q[0]] = decodeURIComponent(q[1] || ''); } }); go(v, p); },
  rail: function () { S.rail = !S.rail; render(); },
  burger: function () { S.nav = !S.nav; render(); },
  theme: function () { var r = document.documentElement, dark = r.getAttribute('data-theme') === 'dark' || (!r.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches); r.setAttribute('data-theme', dark ? 'light' : 'dark'); },
  toast: function (v) { toast(v); },
  booking: function (v) { S.drawer = { kind: 'booking', code: v }; render(); },
  car: function (v) { S.drawer = { kind: 'car', i: +v }; render(); },
  cust: function (v) { S.drawer = { kind: 'cust', i: +v }; render(); },
  modal: function (v, el) { S.modal = { kind: v, ref: el.getAttribute('data-ref') }; render(); }
};
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]');
  if (el) { var stop = e.target.closest('[data-stop]'); if (stop && stop !== el && el.contains(stop)) return; }
  if (!el) { if (e.target.classList && e.target.classList.contains('ov')) A.close(); if (e.target.classList && (e.target.classList.contains('d-scrim') || e.target.classList.contains('pm-scrim'))) { S.nav = false; S.pf.nav = false; render(); } return; }
  var f = A[el.getAttribute('data-a')];
  if (f) { e.preventDefault(); f(el.getAttribute('data-v'), el, e); }
});
document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.matches('[data-file]')) { var f = el.files && el.files[0]; if (f) addLogo(f); el.value = ''; return; }
  var k = el.getAttribute('data-ch'); if (k && CH[k]) CH[k](el.type === 'checkbox' ? el.checked : el.value, el);
});
document.addEventListener('input', function (e) {
  var el = e.target, k = el.getAttribute('data-in'); if (k && IN[k]) IN[k](el.value, el);
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (document.querySelector('.ui-pop')) { UI.closePops(); return; }
  if (UI.top()) { UI.top().close(); return; }
  if (S.drawer || S.modal || S.ws.full) { S.drawer = null; S.modal = null; S.ws.full = null; render(); }
});
var CH = {}, IN = {};
var resizeT = null;
window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(fitThumbs, 80); });
function fitThumbs() {
  document.querySelectorAll('[data-fit]').forEach(function (box) { var shot = box.querySelector('.wg-shot'); if (shot) shot.style.transform = 'scale(' + (box.clientWidth / 1280) + ')'; });
}

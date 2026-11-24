/* ===================================================================
   Staff dashboard: the template system's layout (sidebar, top bar, footer) and its pages, with made-up data.
   =================================================================== */
var NAV = [
  { g: '', items: [['dashboard', 'Dashboard', 'layout-dashboard']] },
  { g: 'Bookings', items: [['bookings', 'Bookings', 'calendar-event'], ['customers', 'Customers', 'users'], ['signatures', 'Signatures', 'signature'], ['damage', 'Damage Packages', 'shield-check'], ['reports', 'Reports', 'report-analytics'], ['invoices', 'Invoices', 'file-invoice'], ['expenses', 'Expenses', 'receipt-2'], ['summons', 'Summons', 'gavel'], ['deposits', 'Deposit refunds', 'cash-banknote']] },
  { g: 'Operations', items: [['tasks', 'Tasks', 'checklist', 1], ['calendar', 'Calendar', 'calendar']] },
  { g: 'Fleet Management', items: [['cars', 'Cars', 'car'], ['availability', 'Availability Checker', 'calendar-search'], ['maintenance', 'Maintenance', 'tool'], ['tracking', 'Tracking', 'radar-2'], ['schedules', 'Schedules', 'calendar-time'], ['installments', 'Instalments', 'calendar-dollar']] },
  { g: 'System Settings', items: [['website', 'Website', 'world'], ['faqs', 'FAQs', 'help-circle'], ['reviews', 'Reviews', 'star'], ['settings', 'Settings', 'settings']] },
  { g: 'Team & access', items: [['team', 'Team', 'users-group'], ['activity', 'Activity log', 'history']] }
];
function navLabel(id) { var r = null; NAV.forEach(function (g) { g.items.forEach(function (it) { if (it[0] === id) r = it; }); }); return r; }

function dashShell(content) {
  var b = B(), d = D();
  var nav = NAV.map(function (g) {
    return (g.g ? '<div class="d-sec">' + esc(g.g) + '</div>' : '') + g.items.map(function (it) {
      return '<button type="button" class="d-item" data-a="nav" data-v="' + it[0] + '"' + (S.page === it[0] ? ' aria-current="page"' : '') + ' title="' + esc(it[1]) + '">' + i(it[2]) + '<span class="lbl">' + esc(it[1]) + '</span>' + (it[3] ? i('chevron-right', 'chev') : '') + '</button>';
    }).join('');
  }).join('');
  var feed = d.bookings.filter(function (x) { return x.created <= TODAY; }).slice(-6).reverse().map(function (x, k) {
    var who = x.agent || b.staff[0];
    var what = k % 3 === 0 ? 'created booking' : k % 3 === 1 ? 'recorded a payment for' : 'sent the agreement for';
    return '<span><b>' + esc(who) + '</b> ' + what + ' ' + esc(x.code) + ' · ' + esc(carModel(x.car)) + ' (' + esc(x.car.plate.replace(' ', '')) + ') <em>' + (k === 0 ? 'just now' : (k * 7 + 3) + ' min ago') + '</em></span>';
  }).join('');
  return '<div class="d-shell' + (S.rail ? ' rail' : '') + (S.nav ? ' open' : '') + '">' +
    '<aside class="d-nav" aria-label="Menu"><div class="d-nav-head"><button type="button" class="d-logo" data-a="nav" data-v="dashboard" style="border:0;background:none;padding:0" aria-label="' + esc(b.name) + ' dashboard">' + mark(b) + '<span class="wm"><b>' + esc(b.short) + '</b><small>' + esc(b.sub || '') + '</small></span></button>' +
    '<button type="button" class="d-pin" data-a="rail" title="' + (S.rail ? 'Keep the menu open' : 'Fold the menu to icons') + '" aria-label="Fold or open the menu">' + i(S.rail ? 'circle' : 'circle-dot') + '</button></div>' +
    '<nav class="d-menu">' + nav + '</nav></aside><div class="d-scrim"></div>' +
    '<div class="d-body"><header class="d-top"><div class="d-bar">' +
    '<button type="button" class="ib d-burger" data-a="burger" aria-label="Open the menu">' + i('menu-2') + '</button>' +
    '<div class="d-search"><button type="button" data-a="toast" data-v="Search finds bookings, customers, cars and pages. It is not part of this sample.">' + i('search') + '<span>Search</span><kbd>Ctrl K</kbd></button></div>' +
    '<div class="d-icons"><span class="d-live" title="Live updates are on"><i></i>Live</span>' +
    '<button type="button" class="ib" aria-label="Notifications" data-a="toast" data-v="3 new notifications">' + i('bell') + '<span class="dot"></span></button>' +
    '<button type="button" class="ib hide-sm" aria-label="Language" data-a="toast" data-v="English, Bahasa Melayu and more">' + i('language') + '</button>' +
    '<button type="button" class="ib hide-sm" aria-label="Light or dark" data-a="theme">' + i('device-laptop') + '</button>' +
    '<button type="button" class="d-av" aria-label="' + esc(b.owner) + '" title="' + esc(b.owner) + '">' + initials(b.owner) + '</button></div></div>' +
    '<div class="d-ticker" aria-hidden="true"><div class="d-ticker-in">' + feed + feed + '</div></div></header>' +
    '<main class="d-main">' + content + '</main>' +
    '<footer class="d-foot"><span>© 2026 ' + esc(b.legal) + '</span><span class="row gap16"><a>Help</a><a>Privacy</a><span>Runs on Orbique FMS</span></span></footer></div>' +
    '<button type="button" class="d-gear" data-a="nav" data-v="settings" aria-label="Settings">' + i('settings') + '</button>' +
    (S.drawer ? drawerView() : '') + (S.modal ? modalView() : '') + '</div>';
}

function dashPage() {
  var p = PAGES[S.page];
  if (p) return p();
  var it = navLabel(S.page) || [S.page, 'Page', 'file'];
  return '<div class="pg-h"><div><h1>' + esc(it[1]) + '</h1><p>This page is part of the template system and every company gets it as it is.</p></div></div>' +
    '<div class="card"><div class="empty">' + i(it[2]) + '<div class="h6">' + esc(it[1]) + ' is the same page your team uses today</div><div class="b2" style="max-width:460px">This sample shows the pages that change most with a company: the Dashboard, Bookings, Calendar, Availability, Cars, Customers, Deposit refunds, Invoices, Reports, Website and Settings.</div><button type="button" class="btn c mt8" data-a="nav" data-v="dashboard">Back to the Dashboard</button></div></div>';
}

/* ---------------- charts ---------------- */
function niceMax(v) { if (v <= 0) return 10; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function lineChart(vals, prev, labels, o) {
  o = o || {};
  var nar = window.innerWidth < 620, W = nar ? 380 : 640, H = o.h || (nar ? 220 : 230), L = 52, Rr = 10, T = 12, Bt = 26, max = niceMax(Math.max.apply(0, vals.concat(prev || [0])) * 1.08), n = vals.length;
  var x = function (k) { return L + (n === 1 ? 0 : k * (W - L - Rr) / (n - 1)); }, y = function (v) { return T + (H - T - Bt) * (1 - v / max); };
  var pts = vals.map(function (v, k) { return x(k).toFixed(1) + ' ' + y(v).toFixed(1); });
  var line = 'M' + pts.join(' L'), area = line + ' L' + x(n - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + 'Z';
  var grid = '', k;
  for (k = 0; k <= 4; k++) { var v = max * k / 4; grid += '<line class="vd-grid" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="vd-axis" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (o.fmt ? o.fmt(v) : rmk(v)) + '</text>'; }
  var step = Math.ceil(n / 7), xl = '';
  labels.forEach(function (lb, k) { if (k % step === 0 || k === n - 1) xl += '<text class="vd-axis" x="' + x(k) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
  var pl = prev ? '<path d="M' + prev.map(function (v, k) { return x(k).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' L') + '" fill="none" stroke="var(--vd-ink2)" stroke-width="1.6" stroke-dasharray="5 5" opacity=".8"/>' : '';
  var id = 'g' + Math.floor(Math.random() * 1e6);
  var last = '<circle cx="' + x(n - 1) + '" cy="' + y(vals[n - 1]) + '" r="4.5" fill="var(--vd-revenue)" stroke="var(--vd-paper)" stroke-width="2"/>';
  return '<div class="vd-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Chart') + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--vd-revenue)" stop-opacity=".32"/><stop offset="1" stop-color="var(--vd-revenue)" stop-opacity="0"/></linearGradient></defs>' +
    grid + xl + pl + '<path d="' + area + '" fill="url(#' + id + ')"/><path class="vd-draw" pathLength="1" d="' + line + '" fill="none" stroke="var(--vd-revenue)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' + last + '</svg></div>';
}
function spark(vals, color) {
  var W = 200, H = 38, max = Math.max.apply(0, vals) || 1, min = Math.min.apply(0, vals), n = vals.length;
  var p = vals.map(function (v, k) { return (k * W / (n - 1)).toFixed(1) + ' ' + (H - 3 - (H - 8) * (v - min) / ((max - min) || 1)).toFixed(1); });
  return '<svg class="vd-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="M' + p.join(' L') + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
}
function changeChip(now, before, goodUp, label) {
  if (!before) return '<span class="vd-chip">New</span>';
  var pc = Math.round((now - before) / before * 100), up = pc >= 0, good = goodUp ? up : !up;
  return '<span class="row gap6" style="flex-wrap:wrap"><span class="vd-chip" data-good="' + (pc === 0 ? '' : good) + '">' + i(up ? 'arrow-up-right' : 'arrow-down-right') + (up ? '+' : '') + pc + '%</span>' + (label ? '<span class="vd-chip-note">' + esc(label) + '</span>' : '') + '</span>';
}

/* ---------------- page: Dashboard ---------------- */
function heroData() {
  var d = D(), lab = [], vals, prev, range, cmp, gran = 'day';
  if (S.period === '7d') { vals = d.days.slice(-7); prev = d.prev.slice(-7); for (var k = 13; k <= 19; k++) lab.push(k + ' Oct'); range = '13 Oct to 19 Oct'; cmp = 'the 7 days before'; }
  else if (S.period === 'year') { vals = d.months.map(function (m) { return m.income; }); prev = d.months.map(function (m, k) { return Math.round(m.income * (.78 + ((k * 37) % 10) / 40)); }); lab = MON.slice(0, 10); range = '1 Jan to 19 Oct'; cmp = 'the same months of 2025'; gran = 'month'; }
  else { vals = d.days.slice(); prev = d.prev.slice(); for (var j = 1; j <= 19; j++) lab.push(j + ' Oct'); range = '1 Oct to 19 Oct'; cmp = '1 Sep to 19 Sep'; }
  return { vals: vals, prev: prev, lab: lab, range: range, cmp: cmp, gran: gran, label: S.period === '7d' ? '7 days' : S.period === 'year' ? 'This year' : 'This month' };
}
var PAGES = {};
PAGES.dashboard = function () {
  var b = B(), d = D(), h = heroData(), total = sum(h.vals), ptotal = sum(h.prev);
  var bestK = h.vals.indexOf(Math.max.apply(0, h.vals)), noun = h.gran;
  var out = d.bookings.filter(function (x) { return x.status === 'Car Delivered'; });
  var work = d.cars.filter(function (c) { return c.status === 'workshop'; }).length;
  var todayStart = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && sameDay(x.start, TODAY); });
  var todayEnd = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && sameDay(x.end, TODAY); });
  var tomorrow = new Date(TODAY.getTime() + DAY);
  var goingOut = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && (sameDay(x.start, TODAY) || sameDay(x.start, tomorrow)); });
  var comingBack = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && (sameDay(x.end, TODAY) || sameDay(x.end, tomorrow)); });
  var soon = function (x) { return x.start - TODAY < 7 * DAY; };
  var unsigned = d.bookings.filter(function (x) { return x.status === 'Agreement Sent' && soon(x); }).length;
  var depDue = d.bookings.filter(function (x) { return (x.pay === 'Deposit due' && soon(x)) || x.pay === 'Extension due'; }).length;
  var refunds = d.bookings.filter(function (x) { return x.pay === 'Refund Pending'; });
  var taxDue = d.cars.filter(function (c) { var dd = (c.tax - TODAY) / DAY; return dd < 30; }).length;
  var inc = sum(d.days), exp = sum(d.exp), pinc = sum(d.prev), pexp = Math.round(exp * 1.12), bk = sum(d.cnt), pbk = Math.max(1, Math.round(bk * .86)), ut = Math.round(sum(d.util) / d.util.length), put = Math.max(1, ut - 6);
  var kpis = [
    ['Income', rm(inc), changeChip(inc, pinc, true, 'vs 1 Sep to 19 Sep'), spark(d.days, 'var(--vd-revenue)'), 'revenue', 'Rent and charges received, without deposits.'],
    ['Expenses', rm(exp), changeChip(exp, pexp, false, 'vs 1 Sep to 19 Sep'), spark(d.exp, 'var(--vd-expense)'), 'expense', 'Everything recorded under Expenses.'],
    ['Net result', rm(inc - exp), changeChip(inc - exp, pinc - pexp, true, 'vs 1 Sep to 19 Sep'), spark(d.days.map(function (v, k) { return v - d.exp[k]; }), 'var(--vd-net)'), 'net', 'Income less expenses.'],
    ['Bookings', n0(bk), changeChip(bk, pbk, true, 'vs 1 Sep to 19 Sep'), spark(d.cnt, 'var(--vd-count)'), 'count', 'Bookings that started in the period.'],
    ['Utilisation', ut + '%', changeChip(ut, put, true, 'vs 1 Sep to 19 Sep'), spark(d.util, 'var(--vd-count)'), 'count', 'Share of car days that were rented.']
  ];
  var hr = TODAY.getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  var segs = [['today', 'Today'], ['7d', '7 days'], ['month', 'This month'], ['last', 'Last month'], ['year', 'This year'], ['dates', 'Dates']];
  var mmax = niceMax(Math.max.apply(0, d.months.map(function (m) { return m.income; })));
  var fleetFree = d.cars.length - out.length - work;
  var list = function (arr, kind) {
    if (!arr.length) return '<div class="empty" style="padding:24px">' + i('mood-smile') + '<div class="b2">Nothing ' + (kind === 'out' ? 'going out' : 'coming back') + ' today or tomorrow.</div></div>';
    return '<div class="vd-list">' + arr.slice(0, 5).map(function (x) {
      var t = kind === 'out' ? x.start : x.end;
      return '<div class="vd-li"><span class="vd-time">' + (sameDay(t, TODAY) ? tm(t).replace(':00', '') : 'Tmrw') + '</span><div style="min-width:0"><div class="t1c fw5 ellip">' + esc(x.cust.name) + ' · ' + esc(carModel(x.car)) + '</div><div class="b2 ellip">' + esc(x.car.plate) + ' · ' + esc(kind === 'out' ? x.pickup : x.drop) + '</div></div><button type="button" class="btn t sm" data-a="booking" data-v="' + x.code + '">Open</button></div>';
    }).join('') + '</div>';
  };
  return '<div class="vd">' +
    '<div class="col gap16"><div class="vd-head"><div><h1 class="h4">' + greet + ', ' + esc(b.owner.split(' ')[0]) + '</h1><div class="muted">' + WDL[TODAY.getDay()] + ', ' + TODAY.getDate() + ' ' + MONTHS[TODAY.getMonth()] + ' ' + TODAY.getFullYear() + '</div></div>' +
    '<div class="row wrap gap8"><span class="cap">Updated ' + tm(TODAY) + ' · refreshes every minute</span><button type="button" class="btn c sm" data-a="toast" data-v="Add booking opens the booking drawer">' + i('plus') + 'Add booking</button><button type="button" class="btn o sm" data-a="toast" data-v="Record an expense: fuel, service, parking...">' + i('receipt-2') + 'Record expense</button><button type="button" class="btn o sm" data-a="toast" data-v="Up to date">' + i('refresh') + 'Refresh</button></div></div>' +
    '<nav class="vd-navs" aria-label="Parts of the page">' + ['Today', 'This period', 'Month by month', 'Fleet and papers', 'Cash'].map(function (t) { return '<button type="button" class="vd-navchip" data-a="jump" data-v="' + t.toLowerCase().replace(/ /g, '-') + '">' + t + '</button>'; }).join('') + '</nav></div>' +

    '<div class="vd-top"><div class="vd-card vd-hero vd-rise" id="this-period"><div class="vd-hero-body">' +
    '<div class="vd-hero-top"><div><span class="vd-kicker">Income</span><span class="vd-hero-range">' + h.label + ' · ' + h.range + '</span></div>' +
    '<div class="vd-seg" role="group" aria-label="Period">' + segs.map(function (s) { return '<button type="button" data-a="period" data-v="' + s[0] + '" aria-pressed="' + (S.period === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="vd-hero-figure"><span class="vd-hero-value num">' + rm(total) + '</span>' + changeChip(total, ptotal, true, 'vs ' + h.cmp) + '</div>' +
    (S.heroTable ? '<div style="max-height:230px;overflow:auto"><table class="tbl" style="font-size:13px;color:#fff"><thead><tr><th style="color:#fff">Date</th><th style="color:#fff" class="r">Income</th><th style="color:#fff" class="r">Before</th></tr></thead><tbody>' + h.vals.map(function (v, k) { return '<tr><td style="color:#ddd">' + h.lab[k] + '</td><td class="r" style="color:#fff">' + rm(v) + '</td><td class="r" style="color:#bbb">' + rm(h.prev[k]) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : lineChart(h.vals, h.prev, h.lab, { label: 'Income for each ' + noun + ' of the period' })) +
    '<div class="vd-hero-foot"><div class="vd-legend"><span><i class="ln"></i>This period</span><span><i class="ds"></i>Before: ' + h.cmp + '</span></div><button type="button" class="ib sm" style="color:var(--vd-ink2)" data-a="heroTable" aria-label="Show as a table" title="Show as a table">' + i(S.heroTable ? 'chart-line' : 'table') + '</button></div>' +
    '<div class="vd-facts"><div class="vd-fact"><span class="vd-fact-label">Best ' + noun + '</span><span class="vd-fact-value">' + rm(h.vals[bestK]) + '</span><span class="vd-fact-note">' + (h.gran === 'month' ? MONTHS[bestK] : WD[new Date(2026, 9, (S.period === '7d' ? 13 : 1) + bestK).getDay()] + ' ' + h.lab[bestK]) + '</span></div>' +
    '<div class="vd-fact"><span class="vd-fact-label">Average a ' + noun + '</span><span class="vd-fact-value">' + rm(total / h.vals.length) + '</span><span class="vd-fact-note">over ' + plural(h.vals.length, noun) + '</span></div>' +
    '<div class="vd-fact"><span class="vd-fact-label">Before</span><span class="vd-fact-value">' + rm(ptotal) + '</span><span class="vd-fact-note">' + h.cmp + '</span></div></div></div></div>' +

    '<div class="vd-card vd-now vd-rise" style="--i:1"><h2>' + (out.length ? '<span class="vd-live"></span>' : i('bolt')) + 'Right now</h2><div class="vd-now-tiles">' +
    [['Cars out now', out.length, fleetFree + ' free, ' + work + ' in the workshop', 'road', 'cars'], ['Going out today', todayStart.filter(function (x) { return x.start > TODAY; }).length, plural(todayStart.length, 'pick-up') + ' in all', 'key', 'calendar'], ['Coming back today', todayEnd.filter(function (x) { return x.end > TODAY; }).length, plural(todayEnd.length, 'return') + ' in all', 'arrow-back-up', 'calendar']].map(function (t, k) {
      return '<button type="button" class="vd-now-tile vd-rise" style="--i:' + (k + 2) + '" data-a="nav" data-v="' + t[4] + '">' + i(t[3], 'vd-now-icon') + '<span class="vd-now-text"><span class="vd-now-label">' + t[0] + '</span><span class="vd-now-hint">' + t[2] + '</span></span><span class="vd-now-value">' + t[1] + '</span></button>';
    }).join('') + '</div><div class="col gap4"><div class="ovl" style="letter-spacing:.1em">Needs you</div><ul class="vd-now-alerts">' +
    [['signature', 'Agreements not signed yet', unsigned, '', 'bookings'], ['cash-off', 'Deposit or extension not paid', depDue, 'error', 'bookings'], ['arrow-back', 'Deposits to give back', refunds.length, '', 'deposits'], ['license', 'Road tax due within 30 days', taxDue, taxDue ? 'error' : '', 'cars']].filter(function (a) { return a[2] > 0; }).map(function (a, k) {
      return '<li class="vd-rise" style="--i:' + (k + 4) + '"><button type="button" class="vd-now-alert" data-tone="' + a[3] + '" data-a="nav" data-v="' + a[4] + '">' + i(a[0]) + '<span>' + a[1] + '</span><b>' + a[2] + '</b></button></li>';
    }).join('') + '</ul></div></div></div>' +

    '<div class="vd-kpi-grid">' + kpis.map(function (k, j) {
      return '<div class="vd-kpi vd-rise vd-h-' + k[4] + '" style="--i:' + j + '"><span class="lab">' + k[0] + ' <i class="tabler-info-circle" title="' + esc(k[5]) + '"></i></span><span class="vd-kpi-value num">' + k[1] + '</span>' + k[2] + k[3] + '</div>';
    }).join('') + '</div>' +

    '<section class="col gap24" id="today"><div class="vd-chapter"><div><h2>Today</h2><p>What is going out, coming back and waiting for you.</p></div><button type="button" class="btn t sm" data-a="nav" data-v="calendar">' + i('calendar') + 'Open the calendar</button></div>' +
    '<div class="grid g2"><div class="card"><div class="card-h"><div><h3>' + i('key') + ' Going out</h3><p>Today and tomorrow</p></div><span class="chip pri">' + goingOut.length + '</span></div><div class="card-b" style="padding-top:12px">' + list(goingOut, 'out') + '</div></div>' +
    '<div class="card"><div class="card-h"><div><h3>' + i('arrow-back-up') + ' Coming back</h3><p>Today and tomorrow</p></div><span class="chip pri">' + comingBack.length + '</span></div><div class="card-b" style="padding-top:12px">' + list(comingBack, 'back') + '</div></div></div></section>' +

    '<section class="col gap24" id="month-by-month"><div class="vd-chapter"><div><h2>Month by month</h2><p>2026 so far. October runs to today.</p></div><div class="inp"><select aria-label="Year"><option>2026</option><option>2025</option></select></div></div>' +
    '<div class="card"><div class="card-h"><div><h3>Income and expenses</h3><p>Money in against money out, each month</p></div><div class="vd-legend"><span><i class="ln" style="background:var(--vd-revenue)"></i>Income</span><span><i class="ln" style="background:var(--vd-expense)"></i>Expenses</span></div></div><div class="card-b"><div class="vd-bars">' +
    d.months.map(function (m, k) { return '<div class="vd-bar" title="' + MONTHS[k] + ': income ' + rm(m.income) + ', expenses ' + rm(m.expense) + '"><div class="pair"><i style="--i:' + k + ';height:' + (m.income / mmax * 100) + '%;background:var(--vd-revenue)"></i><i style="--i:' + k + ';height:' + (m.expense / mmax * 100) + '%;background:var(--vd-expense)"></i></div><small>' + MON[k] + '</small></div>'; }).join('') +
    '</div></div></div></section>' +

    '<section class="col gap24" id="fleet-and-papers"><div class="vd-chapter"><div><h2>Fleet and papers</h2><p>Where every car is, and what is due.</p></div></div><div class="grid g12">' +
    '<div class="card s7"><div class="card-h"><div><h3>Fleet</h3><p>' + plural(d.cars.length, 'car') + '</p></div></div><div class="card-b col gap16"><div class="vd-fleet" role="img" aria-label="Fleet status"><i style="width:' + (out.length / d.cars.length * 100) + '%;background:var(--primary)"></i><i style="width:' + (fleetFree / d.cars.length * 100) + '%;background:var(--success)"></i><i style="width:' + (work / d.cars.length * 100) + '%;background:var(--warning)"></i></div>' +
    '<div class="legend"><span><i style="background:var(--primary)"></i>Out ' + out.length + '</span><span><i style="background:var(--success)"></i>Free ' + fleetFree + '</span><span><i style="background:var(--warning)"></i>Workshop ' + work + '</span></div>' +
    '<div class="vd-list">' + d.cars.slice(0, 5).map(function (c) { var o = out.filter(function (x) { return x.car === c; })[0]; return '<div class="vd-li"><span class="plate" style="font-size:13px;min-width:78px">' + esc(c.plate) + '</span><span class="ellip">' + esc(carName(c)) + '</span>' + (c.status === 'workshop' ? '<span class="chip warn">Workshop</span>' : o ? '<span class="chip pri">Out until ' + dDay(o.end) + '</span>' : '<span class="chip ok">Free</span>') + '</div>'; }).join('') + '</div></div></div>' +
    '<div class="card s5"><div class="card-h"><div><h3>Papers due</h3><p>Road tax and insurance</p></div><button type="button" class="btn t sm" data-a="nav" data-v="cars">All cars</button></div><div class="card-b"><div class="vd-list">' +
    d.cars.slice().sort(function (a, c) { return a.tax - c.tax; }).slice(0, 5).map(function (c) { var dd = Math.round((c.tax - TODAY) / DAY); return '<div class="vd-li">' + i('license', 'faint') + '<div style="min-width:0"><div class="t1c fw5">' + esc(c.plate) + ' road tax</div><div class="b2">' + dFull(c.tax) + '</div></div><span class="chip ' + (dd < 0 ? 'bad' : dd <= 30 ? 'warn' : 'ok') + '">' + (dd < 0 ? 'Expired ' + (-dd) + ' days ago' : dd <= 30 ? 'In ' + dd + ' days' : 'Valid') + '</span></div>'; }).join('') +
    '</div></div></div></div></section>' +

    '<section class="col gap24" id="cash"><div class="vd-chapter"><div><h2>Cash</h2><p>Deposits held, and cash your team is holding.</p></div></div><div class="grid g3">' +
    '<div class="card stat" style="--c:var(--info-rgb)"><div><div class="v">' + rm(sum(refunds.map(function (x) { return x.dep; }))) + '</div><div class="l">Deposits to give back</div><div class="s">' + plural(refunds.length, 'booking') + '</div></div><span class="ic">' + i('arrow-back') + '</span></div>' +
    '<div class="card stat" style="--c:var(--primary-rgb)"><div><div class="v">' + rm(sum(d.bookings.filter(function (x) { return x.status === 'Car Delivered' || x.status === 'Agreement Signed'; }).map(function (x) { return x.dep; }))) + '</div><div class="l">Deposits held now</div><div class="s">For cars out and about to go</div></div><span class="ic">' + i('lock') + '</span></div>' +
    '<div class="card stat" style="--c:var(--warning-rgb)"><div><div class="v">' + rm(380 + S.b * 120) + '</div><div class="l">Cash held by staff</div><div class="s">Not banked yet</div></div><span class="ic">' + i('wallet') + '</span></div></div></section></div>';
};
A.period = function (v) { if (v === 'today' || v === 'last' || v === 'dates') { toast('In this sample try 7 days, This month or This year.'); return; } S.period = v; render(); };
A.heroTable = function () { S.heroTable = !S.heroTable; render(); };
A.jump = function (v) { var el = document.getElementById(v); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: 'smooth' }); };

/* ---------------- page: Bookings ---------------- */
function moneyBar(x) {
  if (x.status === 'Cancelled') return '';
  var due = x.payable - x.received, tone = due <= 0 ? 'var(--success-rgb)' : x.received > 0 ? 'var(--warning-rgb)' : 'var(--error-rgb)';
  return '<div class="money" style="--c:' + tone + '"><span>Total <b>' + rm2(x.payable) + '</b></span><span>Received <b>' + rm2(x.received) + '</b></span><span>' + (due <= 0 ? '<b>Paid in full</b>' : 'Still due <b>' + rm2(due) + '</b>') + '</span></div>';
}
PAGES.bookings = function () {
  var d = D(), q = S.bk.q.toLowerCase();
  var rows = d.bookings.slice().reverse().filter(function (x) {
    if (S.bk.st !== 'all' && x.status !== S.bk.st) return false;
    if (S.bk.pay !== 'all' && x.pay !== S.bk.pay) return false;
    return !q || (x.code + ' ' + x.cust.name + ' ' + x.car.plate + ' ' + carName(x.car)).toLowerCase().indexOf(q) >= 0;
  });
  var per = 10, pages = Math.max(1, Math.ceil(rows.length / per)); if (S.bk.page > pages) S.bk.page = pages;
  var shown = rows.slice((S.bk.page - 1) * per, S.bk.page * per);
  var counts = {}; d.bookings.forEach(function (x) { counts[x.status] = (counts[x.status] || 0) + 1; });
  var period = function (x) { return '<dl class="bk-period"><dt>Pick-up</dt><dd>' + dShort(x.start) + ', ' + tml(x.start) + '</dd><dt>Return</dt><dd>' + dShort(x.end) + ', ' + tml(x.end) + '</dd></dl>'; };
  return '<div class="pg-h"><div><h1>Bookings</h1><p>Every booking, its agreement, payments and inspections.</p></div><div class="acts"><button type="button" class="btn o" data-a="toast" data-v="Bookings_' + B().code + '_Oct2026.xlsx downloaded (sample)">' + i('file-spreadsheet') + 'Export Excel</button><button type="button" class="btn c" data-a="toast" data-v="The Add Booking drawer opens here">' + i('plus') + 'Add Booking</button></div></div>' +
    '<div class="grid g4 mb24">' +
    [['Agreement Sent', 'Waiting for the customer', 'var(--error-rgb)', 'send'], ['Car Delivered', 'Cars out now', 'var(--success-rgb)', 'road'], ['Car Returned', 'Deposits to check', 'var(--info-rgb)', 'arrow-back-up'], ['Completed', 'Closed this period', 'var(--grey-rgb)', 'circle-check']].map(function (s) {
      return '<button type="button" class="card stat" style="--c:' + s[2] + ';text-align:left;border-top:0;border-right:0;border-bottom:0" data-a="bkst" data-v="' + s[0] + '"><div><div class="v">' + (counts[s[0]] || 0) + '</div><div class="l">' + s[0] + '</div><div class="s">' + s[1] + '</div></div><span class="ic">' + i(s[3]) + '</span></button>';
    }).join('') + '</div>' +
    '<div class="card"><div class="tb"><div class="inp srch">' + i('search') + '<input type="search" placeholder="Search booking, customer, plate" aria-label="Search bookings" value="' + esc(S.bk.q) + '" data-ch="bkq"></div>' +
    '<div class="inp"><select aria-label="Booking status" data-ch="bkst"><option value="all">All booking statuses</option>' + Object.keys(BOOKING_COLORS).map(function (s) { return '<option' + (S.bk.st === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
    '<div class="inp"><select aria-label="Payment status" data-ch="bkpay"><option value="all">All payment statuses</option>' + Object.keys(PAY_COLORS).map(function (s) { return '<option' + (S.bk.pay === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
    '<span class="grow"></span><span class="cap">' + plural(rows.length, 'booking') + '</span></div>' +
    '<div class="tbl-wrap bk-desk"><table class="bk-tbl"><colgroup><col style="width:44px"><col style="width:108px"><col style="width:150px"><col style="width:220px"><col style="width:190px"><col style="width:92px"><col style="width:128px"><col style="width:96px"><col style="width:72px"></colgroup>' +
    '<thead><tr><th><span class="cb"><input type="checkbox" aria-label="Tick every booking on this page"><span class="box">' + i('check') + '</span></span></th><th>Booking ID</th><th>Customer</th><th>Car details &amp;<br>rental period</th><th>Booking &amp;<br>payment status</th><th>Documents</th><th>Inspection</th><th>Assigned<br>agent</th><th>Assign<br>task</th></tr></thead><tbody>' +
    (shown.length ? shown.map(function (x) {
      return '<tr data-a="booking" data-v="' + x.code + '"><td><label class="cb" data-stop><input type="checkbox" aria-label="Tick ' + x.code + '"><span class="box">' + i('check') + '</span></label></td><td class="id">' + x.code + '</td>' +
        '<td class="cust"><b>' + esc(x.cust.name) + '</b><small>' + esc(x.cust.phone) + '</small></td>' +
        '<td><span class="bk-plate">' + esc(x.car.plate) + '</span> <span class="bk-model">' + esc(carModel(x.car)) + ' · ' + esc(x.car.color) + '</span><br>' + period(x) + '</td>' +
        '<td><div class="col gap4" style="align-items:center">' + bchip(x) + pchip(x) + moneyBar(x) + '</div></td>' +
        '<td><div class="icons"><span class="ib" title="Copy Link">' + i('copy') + '</span>' + (x.status !== 'Agreement Sent' && x.status !== 'Cancelled' ? '<span class="ib" title="View PDF">' + i('file-type-pdf') + '</span>' : '') + '</div></td>' +
        '<td><div class="icons"><span class="ib" title="View Inspection Data" style="' + (x.inspected ? 'color:var(--success)' : '') + '">' + i('clipboard-check') + '</span><span class="ib" title="Copy Agent Inspection Link">' + i('user-scan') + '</span><span class="ib" title="Copy Customer Inspection Link">' + i('link') + '</span></div></td>' +
        '<td class="b2">' + esc(x.agent || '-') + '</td><td><div class="icons"><span class="ib" title="Assign Task">' + i('calendar-plus') + '</span></div></td></tr>';
    }).join('') : '<tr><td colspan="9"><div class="empty">' + i('calendar-off') + 'No bookings match. Clear the search or the filters.</div></td></tr>') +
    '</tbody></table></div>' +
    '<div class="bk-cards">' + shown.map(function (x) {
      return '<button type="button" class="bk-card" data-a="booking" data-v="' + x.code + '"><div class="row" style="justify-content:space-between"><b class="t1c">' + x.code + '</b>' + bchip(x) + '</div><div class="row gap12"><span class="av">' + initials(x.cust.name) + '</span><div class="grow"><div class="t1c fw5 ellip">' + esc(x.cust.name) + '</div><div class="b2">' + esc(x.cust.phone) + '</div></div></div><div><span class="bk-plate">' + esc(x.car.plate) + '</span> <span class="bk-model">' + esc(carModel(x.car)) + '</span></div>' + period(x) + '<div class="row wrap gap6">' + pchip(x) + '</div>' + moneyBar(x).replace('class="money"', 'class="money" style="align-items:flex-start;--c:' + (x.payable - x.received <= 0 ? 'var(--success-rgb)' : x.received > 0 ? 'var(--warning-rgb)' : 'var(--error-rgb)') + '"') + '</button>';
    }).join('') + '</div>' +
    '<div class="pager"><span>Showing ' + (rows.length ? (S.bk.page - 1) * per + 1 : 0) + ' to ' + Math.min(rows.length, S.bk.page * per) + ' of ' + rows.length + '</span><div class="pgs">' +
    Array.from({ length: Math.min(pages, 6) }, function (_, k) { return '<button type="button" data-a="bkpage" data-v="' + (k + 1) + '" aria-current="' + (S.bk.page === k + 1) + '">' + (k + 1) + '</button>'; }).join('') + '</div></div></div>';
};
CH.bkq = function (v) { S.bk.q = v; S.bk.page = 1; render(); };
CH.bkst = function (v) { S.bk.st = v; S.bk.page = 1; render(); };
CH.bkpay = function (v) { S.bk.pay = v; S.bk.page = 1; render(); };
A.bkpage = function (v) { S.bk.page = +v; render(); };
A.bkst = function (v) { S.bk.st = S.bk.st === v ? 'all' : v; S.bk.page = 1; render(); };
document.addEventListener('click', function (e) { if (e.target.closest('[data-stop]')) e.stopPropagation(); }, true);

/* ---------------- page: Calendar (timeline) ---------------- */
PAGES.calendar = function () {
  var d = D(), first = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - 4), N = 18, colW = 62;
  var cols = '200px repeat(' + N + ',' + colW + 'px)';
  var dayCells = '', rowsHtml = '';
  for (var k = 0; k < N; k++) {
    var dt = new Date(first.getTime() + k * DAY), today = sameDay(dt, TODAY), we = dt.getDay() === 0 || dt.getDay() === 6;
    dayCells += '<div class="cal-day' + (today ? ' today' : we ? ' we' : '') + '">' + WD[dt.getDay()] + '<b>' + dt.getDate() + '</b></div>';
  }
  d.cars.forEach(function (c) {
    var bg = '';
    for (var k = 0; k < N; k++) { var dt = new Date(first.getTime() + k * DAY); bg += '<i class="' + (sameDay(dt, TODAY) ? 'today' : (dt.getDay() === 0 || dt.getDay() === 6) ? 'we' : '') + '"></i>'; }
    var evs = d.bookings.filter(function (x) { return x.car === c && x.status !== 'Cancelled' && x.end > first && x.start < new Date(first.getTime() + N * DAY); }).map(function (x) {
      var s = Math.max(0, (x.start - first) / DAY), e = Math.min(N, (x.end - first) / DAY), col = BOOKING_COLORS[x.status];
      return '<button type="button" class="cal-ev" style="left:' + (s * colW + 2) + 'px;width:' + Math.max(18, (e - s) * colW - 4) + 'px;background:' + col + '" data-a="booking" data-v="' + x.code + '" title="' + esc(x.code + ' · ' + x.cust.name + ' · ' + x.status) + '"><b>' + esc(x.cust.name) + '</b>' + x.code + '</button>';
    }).join('');
    if (c.status === 'workshop') evs += '<span class="cal-ev" style="left:' + (2 * colW + 2) + 'px;width:' + (6 * colW - 4) + 'px;background:repeating-linear-gradient(45deg,#8a8d96 0 8px,#9a9da6 8px 16px)"><b>Workshop</b>Service and tyres</span>';
    var nowX = ((TODAY - first) / DAY) * colW;
    rowsHtml += '<div class="cal-car">' + carSVG(c.color, c.shape, { label: carName(c) }).replace('<svg', '<svg style="width:46px;flex:none"') + '<div style="min-width:0"><b>' + esc(c.plate) + '</b><small>' + esc(carName(c)) + '</small></div></div>' +
      '<div class="cal-row" style="grid-column:span ' + N + ';grid-template-columns:repeat(' + N + ',' + colW + 'px)">' + bg + evs + '<span class="cal-now" style="left:' + nowX + 'px"></span></div>';
  });
  return '<div class="pg-h"><div><h1>Calendar</h1><p>Every car, every booking, day by day.</p></div><div class="acts"><button type="button" class="btn c" data-a="toast" data-v="Drag on the calendar to add a booking">' + i('plus') + 'Add Booking</button></div></div>' +
    '<div class="card"><div class="tb" style="justify-content:space-between"><div class="row gap8"><button type="button" class="btn o sm">Today</button><button type="button" class="ib sm" aria-label="Earlier">' + i('chevron-left') + '</button><button type="button" class="ib sm" aria-label="Later">' + i('chevron-right') + '</button><span class="h5" style="margin-left:6px">' + dDay(first) + ' to ' + dFull(new Date(first.getTime() + (N - 1) * DAY)) + '</span></div>' +
    '<div class="ptabs"><button type="button" class="ptab" data-a="toast" data-v="Month view lists bookings in a month grid">Month</button><button type="button" class="ptab" data-a="toast" data-v="Week view shows hours">Week</button><button type="button" class="ptab" aria-selected="true">Timeline</button></div></div>' +
    '<div style="padding:0 24px 14px" class="legend">' + Object.keys(BOOKING_COLORS).filter(function (s) { return s !== 'Agreement Signed'; }).map(function (s) { return '<span><i style="background:' + BOOKING_COLORS[s] + '"></i>' + (s === 'Agreement Sent' ? 'Agreement sent or signed' : s) + '</span>'; }).join('') + '<span><i style="background:#8a8d96"></i>Workshop</span></div>' +
    '<div class="cal-wrap"><div class="cal" style="grid-template-columns:' + cols + '"><div class="cal-car" style="min-height:0;font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px">Car</div>' + dayCells + rowsHtml + '</div></div></div>';
};

/* ---------------- page: Availability checker ---------------- */
PAGES.availability = function () {
  var d = D(), from = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 1, 10, 0), hrs = S.av.len === 0.5 ? 12 : S.av.len * 24, to = new Date(from.getTime() + hrs * 36e5), gapMs = 3 * 36e5;
  var free = [], check = [], booked = [];
  d.cars.forEach(function (c) {
    if (c.status === 'workshop') { booked.push({ c: c, why: 'In the workshop' }); return; }
    var bs = d.bookings.filter(function (x) { return x.car === c && x.status !== 'Cancelled'; });
    var over = bs.filter(function (x) { return x.start < to && x.end > from; })[0];
    if (over) { booked.push({ c: c, why: over.code + ', ' + dShort(over.start) + ' to ' + dShort(over.end) }); return; }
    var near = bs.filter(function (x) { return (x.end <= from && from - x.end < gapMs) || (x.start >= to && x.start - to < gapMs); })[0];
    if (near) { var before = near.end <= from; var hh = Math.round(Math.abs((before ? from - near.end : near.start - to)) / 36e5 * 10) / 10; check.push({ c: c, why: before ? 'Back at ' + tm(near.end) + ', ' + (hh || 'right') + (hh ? ' hr' + (hh === 1 ? '' : 's') + ' before start' : ' at start') : 'Next booking at ' + tm(near.start) + ', ' + (hh ? hh + ' hrs after end' : 'exactly at end') }); return; }
    free.push({ c: c });
  });
  var card = function (x, tone) { return '<div class="av-card" style="--c:' + tone + '"><div class="t">' + esc(carModel(x.c)) + '</div><div class="bd"><div><div class="pl">' + esc(x.c.plate) + '</div><div class="muted">' + esc(x.c.color) + '</div></div>' + carSVG(x.c.color, x.c.shape, { label: carName(x.c) }) + '</div>' + (x.why ? '<div class="note" style="' + (tone === 'var(--grey-rgb)' ? 'color:var(--text2)' : '') + '">' + i(tone === 'var(--grey-rgb)' ? 'calendar-off' : 'alert-triangle') + '<span>' + esc(x.why) + '</span></div>' : '') + '</div>'; };
  var lens = [[1, '1 day'], [2, '2 days'], [3, '3 days'], [4, '4 days'], [5, '5 days'], [7, '1 week'], [0.5, '12 hours']];
  return '<div class="card"><div class="card-b" style="padding:28px 24px"><h1 class="h4" style="margin-bottom:2px">Car Availability</h1><div class="muted mb24">Pick a period to see which cars are free.</div>' +
    '<div class="grid g2" style="gap:16px"><div class="inp"><label>From</label><input type="text" value="' + dNum(from) + ', ' + tm(from) + '" readonly></div><div class="inp"><label>To</label><input type="text" value="' + dNum(to) + ', ' + tm(to) + '" readonly></div></div>' +
    '<div class="cap mt24" style="margin-bottom:8px">Rental length</div><div class="av-chips">' + lens.map(function (l) { return '<button type="button" class="av-chip" data-a="avlen" data-v="' + l[0] + '" aria-pressed="' + (S.av.len === l[0]) + '">' + (l[0] === 0.5 ? i('plus') : '') + l[1] + '</button>'; }).join('') + '</div>' +
    '<div class="av-sum">' + i('calendar') + dShort(from) + ', ' + tm(from) + ' to ' + dShort(to) + ', ' + tm(to) + ' (' + (S.av.len === 0.5 ? '12 hours' : plural(S.av.len, 'day')) + ')</div></div></div>' +
    '<div class="av-h">' + i('circle-check', '" style="color:var(--success)') + free.length + ' available</div><div class="av-grid">' + free.map(function (x) { return card(x, 'var(--success-rgb)'); }).join('') + '</div>' +
    (check.length ? '<div class="av-h">' + i('alert-triangle', '" style="color:var(--warning)') + 'Check ' + plural(check.length, 'car') + '</div><div class="muted">They have bookings ending within 3 hours of your start time or starting within 3 hours of your end time.</div><div class="av-grid">' + check.map(function (x) { return card(x, 'var(--warning-rgb)'); }).join('') + '</div>' : '') +
    '<div class="av-h" style="justify-content:space-between"><span class="row">' + i('circle-x', '" style="color:var(--error)') + booked.length + ' booked</span><label class="row cap" style="font-size:15px">Show <span class="sw"><input type="checkbox" data-ch="avshow"' + (S.av.show ? ' checked' : '') + ' aria-label="Show booked cars"><span></span></span></label></div>' +
    (S.av.show ? '<div class="av-grid">' + booked.map(function (x) { return card(x, 'var(--grey-rgb)'); }).join('') + '</div>' : '');
};
A.avlen = function (v) { S.av.len = +v; render(); };
CH.avshow = function (v) { S.av.show = v; render(); };

/* ---------------- page: Cars ---------------- */
function taxChip(c) { var dd = Math.round((c.tax - TODAY) / DAY); return '<span class="chip ' + (dd < 0 ? 'bad' : dd <= 30 ? 'warn' : 'ok') + '">' + (dd < 0 ? 'Expired ' + (-dd) + ' day' + (dd === -1 ? '' : 's') + ' ago' : dd === 0 ? 'Expires today' : dd <= 30 ? 'Expires in ' + dd + ' days' : 'Valid') + '</span>'; }
PAGES.cars = function () {
  var d = D();
  var grid = '<div class="car-grid">' + d.cars.map(function (c) {
    return '<button type="button" class="car-card" data-a="car" data-v="' + c.i + '"><div class="car-photo">' + carSVG(c.color, c.shape, { label: carName(c) }) + '<span class="acts"><span class="ib sm" title="Edit">' + i('edit') + '</span><span class="ib sm" title="Delete">' + i('trash') + '</span></span></div>' +
      '<div class="car-body"><div class="car-row"><span class="t1c fw5 ellip">' + esc(carName(c)) + '</span><span class="row gap4">' + (c.status === 'workshop' ? '<span class="chip warn">Workshop</span>' : '<span class="chip ok">Active</span>') + '</span></div>' +
      '<span class="plate">' + esc(c.plate) + '</span><span class="b2">' + c.year + ' · ' + c.type + ' · ' + (c.cc / 1000).toFixed(1) + 'L · ' + c.seats + ' seats · ' + c.trans + '</span>' + (c.web ? '' : '<span class="chip info" style="align-self:flex-start">Hidden from website</span>') +
      '<div class="car-row"><span class="b2">Road tax</span>' + taxChip(c) + '</div><div class="car-row"><span class="b2">Odometer</span><span class="b2 t1c">' + n0(c.odo) + ' km</span></div><div class="car-row"><span class="b2">Daily rate</span><span class="b2 t1c fw6">' + rm(c.rate) + '</span></div></div></button>';
  }).join('') + '</div>';
  var table = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Car</th><th>Plate</th><th>Year</th><th>Road tax</th><th>Insurance</th><th class="r">Daily rate</th><th>Status</th></tr></thead><tbody>' + d.cars.map(function (c) {
    return '<tr class="click" data-a="car" data-v="' + c.i + '"><td><div class="who">' + carSVG(c.color, c.shape).replace('<svg', '<svg style="width:56px"') + '<b>' + esc(carName(c)) + '</b></div></td><td class="t1c fw6">' + esc(c.plate) + '</td><td>' + c.year + '</td><td>' + taxChip(c) + '</td><td>' + dFull(c.insExp) + '</td><td class="r t1c">' + rm(c.rate) + '</td><td>' + (c.status === 'workshop' ? '<span class="chip warn">Workshop</span>' : '<span class="chip ok">Active</span>') + '</td></tr>';
  }).join('') + '</tbody></table></div>';
  return '<div class="pg-h"><div><h1>Cars</h1><p>' + plural(d.cars.length, 'car') + '. Add the papers and the system reads them for you.</p></div><div class="acts"><div class="ptabs"><button type="button" class="ptab" data-a="carview" data-v="cards" aria-selected="' + (S.carView === 'cards') + '">' + i('layout-grid') + 'Cards</button><button type="button" class="ptab" data-a="carview" data-v="table" aria-selected="' + (S.carView === 'table') + '">' + i('list') + 'Table</button></div><button type="button" class="btn c" data-a="toast" data-v="Add a car: photo, plate and papers">' + i('plus') + 'Add Car</button></div></div>' +
    (S.carView === 'cards' ? grid : '<div class="card">' + table + '</div>');
};
A.carview = function (v) { S.carView = v; render(); };
A.cartab = function (v) { S.carTab = v; render(); };

/* ---------------- page: Customers ---------------- */
PAGES.customers = function () {
  var d = D(), q = S.custQ.toLowerCase();
  var count = function (p) { return d.bookings.filter(function (x) { return x.cust === p; }).length; };
  var tabs = [['all', 'Everyone'], ['repeat', 'Repeat customers'], ['VIP', 'VIP'], ['Be careful', 'Be careful'], ['Blacklisted', 'Blacklisted']];
  var rows = d.people.filter(function (p) {
    if (S.cust === 'repeat' && count(p) < 2) return false;
    if (S.cust !== 'all' && S.cust !== 'repeat' && p.flag !== S.cust) return false;
    return !q || (p.name + ' ' + p.phone + ' ' + p.email).toLowerCase().indexOf(q) >= 0;
  });
  var flag = function (p) { return p.flag === 'VIP' ? '<span class="chip pri">' + i('crown') + 'VIP</span>' : p.flag === 'Be careful' ? '<span class="chip warn">' + i('alert-triangle') + 'Be careful</span>' : p.flag === 'Blacklisted' ? '<span class="chip bad">' + i('ban') + 'Blacklisted</span>' : '<span class="faint">-</span>'; };
  return '<div class="pg-h"><div><h1>Customers</h1><p>Everyone who has booked, with their IC check and history.</p></div><div class="acts"><button type="button" class="btn c" data-a="toast" data-v="New booking for a customer">' + i('plus') + 'New Booking</button></div></div>' +
    '<div class="card"><div style="padding:8px 24px 0"><div class="tabs">' + tabs.map(function (t) { return '<button type="button" class="tab" data-a="custtab" data-v="' + t[0] + '" aria-selected="' + (S.cust === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="tb"><div class="inp srch">' + i('search') + '<input type="search" placeholder="Search name, phone, email" aria-label="Search customers" value="' + esc(S.custQ) + '" data-ch="custq"></div><span class="grow"></span><span class="cap">' + plural(rows.length, 'customer') + '</span></div>' +
    '<div class="tbl-wrap"><table class="tbl" style="min-width:860px"><thead><tr><th>Customer</th><th>Phone</th><th>IC / Passport No</th><th>Nationality</th><th class="c">Bookings</th><th>Flags</th><th class="c">Actions</th></tr></thead><tbody>' +
    rows.map(function (p) {
      return '<tr class="click" data-a="cust" data-v="' + p.i + '"><td><div class="who"><span class="av" style="--c:' + ['var(--primary-rgb)', 'var(--success-rgb)', 'var(--warning-rgb)', 'var(--info-rgb)', 'var(--grey-rgb)'][p.i % 5] + '">' + initials(p.name) + '</span><div style="min-width:0"><b>' + esc(p.name) + '</b><small>' + esc(p.email) + '</small></div></div></td><td><span class="row gap6">' + esc(p.phone) + i('brand-whatsapp', '" style="color:#25D366') + '</span></td><td class="num">' + esc(maskId(p.ic)) + '</td><td>' + esc(p.nat) + '</td><td class="c t1c">' + count(p) + '</td><td>' + flag(p) + '</td><td class="c"><span class="icons"><span class="ib sm" title="View customer">' + i('eye') + '</span><span class="ib sm" title="New booking">' + i('calendar-plus') + '</span></span></td></tr>';
    }).join('') + '</tbody></table></div></div>';
};
A.custtab = function (v) { S.cust = v; render(); };
CH.custq = function (v) { S.custQ = v; render(); };

/* ---------------- page: Deposit refunds ---------------- */
PAGES.deposits = function () {
  var d = D();
  var waiting = d.bookings.filter(function (x) { return x.pay === 'Refund Pending'; });
  var done = d.bookings.filter(function (x) { return x.pay === 'Deposit Refunded' && x.status === 'Completed'; }).slice(-10).reverse();
  var kept = function (x) { return (x.n % 5 === 0) ? 35 : (x.n % 7 === 0 ? 20 : 0); };
  var list = S.dep === 'waiting' ? waiting : done;
  return '<div class="pg-h"><div><h1>Deposit refunds</h1><p>Deposits to give back once the car is back and checked. ' + esc(B().short) + ' refunds within ' + B().refundHours + ' hours.</p></div></div>' +
    '<div class="grid g4 mb24">' +
    [['Waiting to be returned', waiting.length, 'Bookings', 'var(--info-rgb)', 'clock'], ['To return in total', rm(sum(waiting.map(function (x) { return x.dep; }))), 'Before deductions', 'var(--primary-rgb)', 'cash-banknote'], ['Returned this month', rm(sum(done.map(function (x) { return x.dep - kept(x); }))), plural(done.length, 'refund'), 'var(--success-rgb)', 'arrow-back'], ['Kept this month', rm(sum(done.map(kept))), 'Fuel, tolls, late return', 'var(--warning-rgb)', 'scissors']].map(function (s) {
      return '<div class="card stat" style="--c:' + s[3] + '"><div><div class="v">' + s[1] + '</div><div class="l">' + s[0] + '</div><div class="s">' + s[2] + '</div></div><span class="ic">' + i(s[4]) + '</span></div>';
    }).join('') + '</div>' +
    '<div class="card"><div style="padding:8px 24px 0"><div class="tabs"><button type="button" class="tab" data-a="deptab" data-v="waiting" aria-selected="' + (S.dep === 'waiting') + '">Waiting <span class="chip pri">' + waiting.length + '</span></button><button type="button" class="tab" data-a="deptab" data-v="done" aria-selected="' + (S.dep === 'done') + '">Refunded</button></div></div>' +
    (list.length ? '<div class="tbl-wrap"><table class="tbl" style="min-width:820px"><thead><tr><th>Booking ID</th><th>Customer</th><th>Car back</th><th class="r">Deposit received</th><th class="r">' + (S.dep === 'waiting' ? 'To give back' : 'Given back') + '</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (x) {
        return '<tr><td class="t1c fw5">' + x.code + '</td><td><div class="who"><span class="av">' + initials(x.cust.name) + '</span><div><b>' + esc(x.cust.name) + '</b><small>' + esc(x.car.plate) + ' · ' + esc(carModel(x.car)) + '</small></div></div></td><td>' + dShort(x.end) + ', ' + tml(x.end) + '<div class="b2">' + ago(x.end) + '</div></td><td class="r t1c">' + rm2(x.dep) + '</td><td class="r t1c">' + rm2(x.dep - kept(x)) + (kept(x) ? '<div class="b2">' + rm(kept(x)) + ' kept</div>' : '') + '</td><td>' + (S.dep === 'waiting' ? '<span class="chip info">Car checked</span>' : '<span class="chip ok">Refunded</span>') + '</td><td class="r">' + (S.dep === 'waiting' ? '<button type="button" class="btn c sm" data-a="modal" data-v="refund" data-ref="' + x.code + '">Refund</button>' : '<button type="button" class="btn t sm" data-a="toast" data-v="Statement sent on WhatsApp">Send statement</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="empty">' + i('circle-check') + '<div class="h6">No deposits are waiting to be returned</div></div>') + '</div>';
};
A.deptab = function (v) { S.dep = v; render(); };

/* ---------------- page: Invoices ---------------- */
PAGES.invoices = function () {
  var d = D(), list = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.created <= TODAY; }).slice(-14).reverse();
  var tabs = [['invoices', 'Invoices', 'file-invoice'], ['receipts', 'Receipts', 'receipt'], ['payments', 'Payments', 'credit-card'], ['cash', 'Cash held by staff', 'wallet']];
  var body;
  if (S.inv === 'cash') {
    body = '<div class="card-b"><div class="grid g3">' + B().staff.map(function (s, k) { return '<div class="sect"><div class="sect-h"><span class="av">' + initials(s) + '</span>' + esc(s) + '</div><div style="padding:16px" class="col gap4"><span class="h5">' + rm(k === 0 ? 0 : 120 + k * 140 + S.b * 60) + '</span><span class="b2">' + (k === 0 ? 'Nothing held' : plural(k + 1, 'payment') + ' in cash, not banked yet') + '</span></div></div>'; }).join('') + '</div></div>';
  } else {
    var head = S.inv === 'payments' ? '<th>Date</th><th>Booking</th><th>Customer</th><th>Method</th><th>Payment slip</th><th class="r">Amount</th>' : '<th>Number</th><th>Booking</th><th>Customer</th><th>Issued</th><th class="r">Amount</th><th>Status</th><th class="c">Actions</th>';
    body = '<div class="tbl-wrap"><table class="tbl" style="min-width:860px"><thead><tr>' + head + '</tr></thead><tbody>' + list.map(function (x, k) {
      var no = (S.inv === 'receipts' ? 'RCT-' : 'INV-') + '2026-' + String(x.n * 2 + 1000).padStart(5, '0');
      if (S.inv === 'payments') return '<tr><td>' + dShort(x.created) + '</td><td class="t1c fw5">' + x.code + '</td><td>' + esc(x.cust.name) + '</td><td>' + ['Bank transfer', 'DuitNow QR', 'Cash', 'Card'][k % 4] + '</td><td>' + (k % 4 === 2 ? '<span class="faint">-</span>' : '<span class="chip ok">' + i('paperclip') + 'Slip attached</span>') + '</td><td class="r t1c">' + rm2(x.received || x.dep) + '</td></tr>';
      var paid = x.received >= x.payable, st = S.inv === 'receipts' ? '<span class="chip ok">Paid</span>' : paid ? '<span class="chip ok">Paid</span>' : x.received > 0 ? '<span class="chip warn">Part paid</span>' : '<span class="chip info">Issued</span>';
      return '<tr class="click" data-a="modal" data-v="invoice" data-ref="' + x.code + '"><td class="t1c fw5">' + no + '</td><td>' + x.code + '</td><td>' + esc(x.cust.name) + '</td><td>' + dShort(x.created) + '</td><td class="r t1c">' + rm2(S.inv === 'receipts' ? x.received || x.dep : x.payable) + '</td><td>' + st + '</td><td class="c"><span class="icons"><span class="ib sm" title="Preview">' + i('eye') + '</span><span class="ib sm" title="Send on WhatsApp">' + i('brand-whatsapp') + '</span><span class="ib sm" title="Download PDF">' + i('download') + '</span></span></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  return '<div class="pg-h"><div><h1>Invoices &amp; Receipts</h1><p>Every invoice and receipt carries your logo, colours and company details.</p></div><div class="acts"><button type="button" class="btn o" data-a="nav" data-v="settings">' + i('building') + 'Company details</button><button type="button" class="btn c" data-a="toast" data-v="Create an invoice for a booking">' + i('plus') + 'Create Invoice</button></div></div>' +
    '<div class="ptabs mb24">' + tabs.map(function (t) { return '<button type="button" class="ptab" data-a="invtab" data-v="' + t[0] + '" aria-selected="' + (S.inv === t[0]) + '">' + i(t[2]) + t[1] + '</button>'; }).join('') + '</div>' +
    '<div class="card"><div class="tb"><div class="inp srch">' + i('search') + '<input type="search" placeholder="Search" aria-label="Search"></div><div class="inp"><select aria-label="Status"><option>All</option><option>Issued</option><option>Paid</option><option>Void</option></select></div></div>' + body + '</div>';
};
A.invtab = function (v) { S.inv = v; render(); };
function invoicePaper(x) {
  var b = B(), no = 'INV-2026-' + String(x.n * 2 + 1000).padStart(5, '0');
  var lines = [['Rent: ' + carName(x.car) + ' (' + x.car.plate + '), ' + plural(x.days, 'day') + ' at ' + rm2(x.car.rate), x.rent]];
  if (x.dmg) lines.push(['Damage coverage (Basic)', x.dmg]); if (x.deliv) lines.push(['Delivery to ' + x.pickup, x.deliv]); if (x.ret) lines.push(['Return pick-up', x.ret]); if (x.disc) lines.push(['Discount', -x.disc]);
  lines.push(['Security deposit (refundable)', x.dep]);
  return '<div class="inv"><div class="inv-h"><div class="row gap12" style="align-items:flex-start">' + mark(b) + '<div><div style="font-weight:800;font-size:16px;color:#111">' + esc(b.legal) + '</div><div style="color:#666;line-height:1.5">Reg. ' + esc(b.reg) + '<br>' + esc(b.address) + '<br>' + esc(b.phone) + ' · ' + esc(b.email) + '</div></div></div><div><div class="inv-t">INVOICE</div><div style="text-align:right;color:#555;line-height:1.6">' + no + '<br>Date ' + dFull(x.created) + '<br>Booking ' + x.code + '</div></div></div>' +
    '<div style="margin-top:14px;line-height:1.6"><div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.06em">Bill to</div><b style="color:#111">' + esc(x.cust.name) + '</b><br>' + esc(x.cust.phone) + '</div>' +
    '<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + lines.map(function (l) { return '<tr><td>' + esc(l[0]) + '</td><td style="text-align:right">' + (l[1] < 0 ? '- ' + rm2(-l[1]) : rm2(l[1])) + '</td></tr>'; }).join('') +
    '<tr class="tot"><td>Total payable</td><td style="text-align:right">' + rm2(x.payable) + '</td></tr></tbody></table>' +
    '<div style="margin-top:16px;color:#777;font-size:11.5px;line-height:1.5">Pay by bank transfer or DuitNow to the account shown in your booking link. Thank you for renting with ' + esc(b.name) + '.</div></div>';
}

/* ---------------- page: Reports ---------------- */
PAGES.reports = function () {
  var b = B(), d = D(), rows = d.bookings.filter(function (x) { return x.start.getMonth() === 9 && x.start <= TODAY; }).slice(0, 7);
  return '<div class="pg-h"><div><h1>Reports</h1><p>Download your figures as Excel files, in the ' + esc(b.short) + ' colours.</p></div></div><div class="grid g2">' +
    '<div class="card"><div class="card-h"><div><h3>' + i('file-spreadsheet') + ' Bookings</h3><p>Every booking in the period with its money, one row each.</p></div></div><div class="card-b col gap16"><div class="ptabs"><button type="button" class="ptab" aria-selected="true">This month</button><button type="button" class="ptab">Last month</button><button type="button" class="ptab">This year</button><button type="button" class="ptab">Dates</button></div>' +
    '<div class="xl"><div class="xl-bar">' + i('file-spreadsheet') + 'Bookings_' + b.code + '_Oct2026.xlsx</div><div class="title">' + mark(b) + esc(b.name) + ': bookings, 1 to 19 Oct 2026</div><div style="overflow-x:auto"><table><thead><tr><th>Booking</th><th>Customer</th><th>Car</th><th>Days</th><th>Rent</th><th>Total</th></tr></thead><tbody>' +
    rows.map(function (x) { return '<tr><td>' + x.code + '</td><td>' + esc(x.cust.name) + '</td><td>' + esc(x.car.plate) + '</td><td>' + x.days + '</td><td>' + rm2(x.rent) + '</td><td>' + rm2(x.payable - x.dep) + '</td></tr>'; }).join('') +
    '<tr class="sum"><td>Total</td><td></td><td></td><td>' + sum(rows.map(function (x) { return x.days; })) + '</td><td>' + rm2(sum(rows.map(function (x) { return x.rent; }))) + '</td><td>' + rm2(sum(rows.map(function (x) { return x.payable - x.dep; }))) + '</td></tr></tbody></table></div></div>' +
    '<div><button type="button" class="btn c" data-a="toast" data-v="Bookings_' + b.code + '_Oct2026.xlsx downloaded (sample)">' + i('download') + 'Download Excel</button></div></div></div>' +
    '<div class="card"><div class="card-h"><div><h3>' + i('cash') + ' Money in</h3><p>Payments received by day and by method.</p></div></div><div class="card-b col gap16"><div class="ptabs"><button type="button" class="ptab" aria-selected="true">This month</button><button type="button" class="ptab">Last month</button><button type="button" class="ptab">This year</button></div>' +
    '<div class="xl"><div class="xl-bar">' + i('file-spreadsheet') + 'MoneyIn_' + b.code + '_Oct2026.xlsx</div><div class="title">' + mark(b) + esc(b.name) + ': money in, October 2026</div><table><thead><tr><th>Method</th><th>Payments</th><th>Amount</th><th>Share</th></tr></thead><tbody>' +
    [['Bank transfer', .46], ['DuitNow QR', .31], ['Cash', .15], ['Card', .08]].map(function (m) { var v = sum(d.days) * m[1]; return '<tr><td>' + m[0] + '</td><td>' + Math.round(sum(d.cnt) * m[1] + 1) + '</td><td>' + rm2(v) + '</td><td><span style="display:inline-block;height:8px;border-radius:4px;background:var(--primary);width:' + Math.round(m[1] * 120) + 'px;vertical-align:middle"></span> ' + Math.round(m[1] * 100) + '%</td></tr>'; }).join('') +
    '<tr class="sum"><td>Total</td><td>' + (sum(d.cnt) + 4) + '</td><td>' + rm2(sum(d.days)) + '</td><td>100%</td></tr></tbody></table></div>' +
    '<div><button type="button" class="btn c" data-a="toast" data-v="MoneyIn_' + b.code + '_Oct2026.xlsx downloaded (sample)">' + i('download') + 'Download Excel</button></div></div></div></div>';
};

/* ---------------- page: Settings ---------------- */
PAGES.settings = function () {
  var b = B(), tabs = [['company', 'Company profile', 'building'], ['brand', 'Brand colours', 'palette'], ['rules', 'Rules and amounts', 'list-check'], ['locations', 'Our locations', 'map-pin'], ['start', 'Start page', 'home']];
  var body = '';
  if (S.set === 'company') {
    var f = function (k, label, help, full) { return '<div class="inp' + (full ? '" style="grid-column:1/-1' : '') + '"><label for="co-' + k + '">' + label + '</label><input id="co-' + k + '" value="' + esc(b[k]) + '" data-ch="co" data-k="' + k + '">' + (help ? '<span class="help">' + help + '</span>' : '') + '</div>'; };
    body = '<div class="card"><div class="card-h"><div><h3>Company profile</h3><p>Shown on the booking form, the agreement, invoices, receipts, WhatsApp messages and your website.</p></div></div><div class="card-b"><div class="grid g2" style="gap:18px">' +
      f('name', 'Company name', 'The name customers see') + f('short', 'Short name', 'Used in the menu and on small screens') + f('legal', 'Registered name') + f('reg', 'Registration no.') + f('phone', 'Phone and WhatsApp') + f('email', 'Email') + f('address', 'Address', 'On invoices and the agreement', true) + f('code', 'Booking code', 'Bookings are numbered ' + b.code + '-00001, ' + b.code + '-00002 ...') +
      '<div class="inp"><label>Plan</label><input value="' + esc(planName(b.plan)) + ' (from Orbique)" readonly></div></div></div>' +
      '<div class="card-f"><span class="b2 grow">Your addresses: <b class="t1c">' + b.slug + '.orbiquefms.com</b> (dashboard), <b class="t1c">' + b.slug + '.orbiquefms.com/book</b> (booking form), <b class="t1c">' + b.slug + '.orbiquefms.site</b> (website)</span><button type="button" class="btn c" data-a="toast" data-v="Company profile saved">Save changes</button></div></div>';
  } else if (S.set === 'brand') {
    var sw = function (k, label, help) { return '<div class="sw-row"><span class="swatch" style="background:' + b[k] + '"><input type="color" value="' + b[k].toLowerCase() + '" data-in="col" data-ch="colset" data-k="' + k + '" aria-label="' + label + '"></span><div class="grow"><div class="t1c fw5">' + label + ' <span class="b2 num" style="margin-left:6px">' + b[k] + '</span></div><div class="b2">' + help + '</div></div></div>'; };
    body = '<div class="grid g12"><div class="card s7"><div class="card-h"><div><h3>Brand colours</h3><p>Picked from your logo. Change any of them; every page, the booking form, the agreement, invoices and the website follow.</p></div></div><div class="card-b col gap16">' +
      '<div class="row gap16 wrap"><div class="logo-box">' + (b.logoImg ? '<img src="' + b.logoImg + '" alt="Logo">' : b.mark) + '</div><div class="col gap8"><div class="t1c fw5">Logo</div><div class="b2">PNG, JPG or SVG. A square logo works best.</div><div class="row wrap gap8"><label class="btn o sm">' + i('upload') + 'Upload new logo<input type="file" accept="image/*" data-file="logo" hidden></label><button type="button" class="btn t sm" data-a="repick">' + i('color-picker') + 'Pick colours from logo again</button></div></div></div>' +
      '<div>' + sw('primary', 'Main colour', 'Buttons, the selected menu item, links, money coming in, the booking form buttons.') + sw('secondary', 'Dark colour', 'The big income card, table header bands on Excel files and PDFs, the plate badge, the rule pictures.') + sw('accent', 'Second colour', 'Small highlights and some website designs.') + '</div>' +
      '<div class="alert pri">' + i('info-circle') + '<div>Only the colours and the logo change. Pages, layout and functions stay the same for every company.</div></div></div></div>' +
      '<div class="card s5"><div class="card-h"><div><h3>Preview</h3><p>How the colours look in use</p></div></div><div class="card-b col gap16"><div class="preview-strip"><button type="button" class="btn c">Add Booking</button><button type="button" class="btn o">Export</button><span class="chip pri">Selected</span></div>' +
      '<div class="d-item" aria-current="page" style="max-width:240px">' + i('calendar-event') + '<span>Bookings</span></div>' +
      '<div class="vd"><div class="vd-card vd-hero" style="padding:18px 20px"><span class="vd-kicker">Income</span><div class="vd-hero-value" style="font-size:34px">' + rm(sum(D().days)) + '</div></div></div>' +
      '<div class="bf" style="border:1px solid var(--divider);border-radius:14px;padding:14px;flex:none"><div class="bf-brand">' + mark(b) + esc(b.short) + '</div><div class="bf-step" style="margin:10px 0 8px">Step 1 of 4 · Check your booking</div><button type="button" class="bf-p">Yes, this is correct</button></div></div></div></div>';
  } else if (S.set === 'rules') {
    var r = function (k, label, unit) { return '<div class="inp"><label for="fn-' + k + '">' + label + '</label><input id="fn-' + k + '" type="number" min="0" value="' + (k in b.fines ? b.fines[k] : b[k]) + '" data-ch="fine" data-k="' + k + '"><span class="help">' + unit + '</span></div>'; };
    body = '<div class="card"><div class="card-h"><div><h3>Rules and amounts</h3><p>The must know rules, the 22 rental terms and the agreement read these. Change a number and the booking form shows it straight away.</p></div><button type="button" class="btn o sm" data-a="sec" data-v="bf">' + i('device-mobile') + 'See the booking form</button></div><div class="card-b"><div class="rule-amt">' +
      r('smoking', 'Smoking fine', 'RM') + r('dashcam', 'Touching the dashcam', 'RM') + r('key', 'Lost car key', 'RM') + r('late', 'Late return, each started hour', 'RM') + r('toll', 'Lost toll card', 'RM') + r('deposit', 'Usual deposit', 'RM') + r('extendHours', 'Ask to extend at least', 'hours before return') + r('refundHours', 'Deposit refunded within', 'hours after return') +
      '</div></div></div>';
  } else if (S.set === 'locations') {
    body = '<div class="card"><div class="card-h"><div><h3>Our locations</h3><p>Where customers pick up and drop off cars. Each one becomes a choice in the booking form.</p></div></div><div class="card-b" style="padding-top:12px">' +
      b.locations.map(function (l, k) { return '<div class="loc"><span class="nm">' + esc(l.n) + '</span><label class="cb"><input type="checkbox"' + (l.p ? ' checked' : '') + ' data-ch="loc" data-k="' + k + '" data-f="p"><span class="box">' + i('check') + '</span>Pick-up</label><label class="cb"><input type="checkbox"' + (l.d ? ' checked' : '') + ' data-ch="loc" data-k="' + k + '" data-f="d"><span class="box">' + i('check') + '</span>Drop-off</label><button type="button" class="btn err sm" data-a="locdel" data-v="' + k + '">Remove</button></div>'; }).join('') +
      '<div class="loc" style="border-top:1px solid var(--divider);margin-top:6px;padding-top:16px"><div class="inp nm"><label>New location</label><input placeholder="e.g. City mall, level 1 entrance" id="newloc"></div><label class="cb"><input type="checkbox" checked><span class="box">' + i('check') + '</span>Pick-up</label><label class="cb"><input type="checkbox" checked><span class="box">' + i('check') + '</span>Drop-off</label><button type="button" class="btn c sm" data-a="locadd">Add location</button></div></div></div>';
  } else {
    body = '<div class="card"><div class="card-h"><div><h3>Start page</h3><p>The page each team member sees first after signing in.</p></div></div><div class="card-b col gap12">' + ['Dashboard', 'Bookings', 'Calendar', 'Schedules'].map(function (p, k) { return '<label class="row gap8 t1c"><input type="radio" name="sp"' + (k === 0 ? ' checked' : '') + ' style="accent-color:var(--primary)"> ' + p + '</label>'; }).join('') + '</div></div>';
  }
  return '<div class="pg-h"><div><h1>Settings</h1><p>These change the dashboard for every team member.</p></div><span class="chip out lg">' + i('users') + 'For everyone</span></div>' +
    '<div class="ptabs mb24">' + tabs.map(function (t) { return '<button type="button" class="ptab" data-a="settab" data-v="' + t[0] + '" aria-selected="' + (S.set === t[0]) + '">' + i(t[2]) + t[1] + '</button>'; }).join('') + '</div>' + body;
};
function planName(p) { var x = PLANS.filter(function (q) { return q[0] === p; })[0]; return x ? x[1] : p; }
A.settab = function (v) { S.set = v; render(); };
CH.co = function (v, el) { var k = el.getAttribute('data-k'); if (k === 'code') v = v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || B().code; B()[k] = v; if (k === 'code') B().data.bookings.forEach(function (x) { x.code = v + '-' + String(x.n).padStart(5, '0'); }); render(); };
IN.col = function (v, el) { var b = B(); b[el.getAttribute('data-k')] = v.toUpperCase(); applyTheme(b); var s = el.parentNode; s.style.background = v; };
CH.colset = function (v, el) { B()[el.getAttribute('data-k')] = v.toUpperCase(); B().colorsLabel = 'Your own colours'; applyTheme(B()); render(); };
CH.fine = function (v, el) { var k = el.getAttribute('data-k'), b = B(), n = Math.max(0, Math.round(+v || 0)); if (k in b.fines) b.fines[k] = n; else b[k] = n; toast('Saved. The booking form now shows ' + (k === 'extendHours' || k === 'refundHours' ? n + ' hours' : 'RM ' + n) + '.'); };
CH.loc = function (v, el) { B().locations[+el.getAttribute('data-k')][el.getAttribute('data-f')] = v; };
A.locdel = function (v) { B().locations.splice(+v, 1); render(); };
A.locadd = function () { var el = document.getElementById('newloc'), v = el && el.value.trim(); if (!v) { toast('Type the name of the place first.'); return; } B().locations.push({ n: v, p: true, d: true }); render(); };
A.repick = function () {
  var b = B();
  if (b.logoImg) { var img = new Image(); img.onload = function () { var c = colorsFromImage(img); b.primary = c.primary; b.secondary = c.secondary; b.accent = c.accent; applyTheme(b); render(); toast('Colours picked from your logo again.'); }; img.src = b.logoImg; return; }
  var orig = { kilat: ['#1E6BFF', '#0B0D12', '#1E6BFF'], padi: ['#17603F', '#0F2A1D', '#D9A520'], bara: ['#D7192D', '#26282B', '#D7192D'] }[b.id];
  if (orig) { b.primary = orig[0]; b.secondary = orig[1]; b.accent = orig[2]; applyTheme(b); render(); toast('Colours picked from the logo: ' + orig[0] + ' and ' + orig[1] + '.'); }
};

/* ---------------- drawers and dialogs ---------------- */
function findBooking(code) { return D().bookings.filter(function (x) { return x.code === code; })[0]; }
function kv(l, v) { return '<div class="kv"><span>' + l + '</span><b>' + v + '</b></div>'; }
function drawerView() {
  var dr = S.drawer, d = D(), b = B(), h = '', body = '', foot = '';
  if (dr.kind === 'booking') {
    var x = findBooking(dr.code); if (!x) return '';
    h = '<div class="grow"><h2>Booking ' + x.code + '</h2><div class="row wrap gap6 mt8">' + bchip(x) + pchip(x) + '</div></div>';
    var docs = ['IC front', 'IC back', 'Driving licence', 'Proof of address'];
    body = '<div class="sect"><div class="sect-h">' + i('user') + 'Customer</div><div class="sect-b">' + kv('Full Name', esc(x.cust.name)) + kv('Phone', esc(x.cust.phone)) + kv('Email', esc(x.cust.email)) + kv('IC / Passport no.', esc(maskId(x.cust.ic))) + kv('Nationality', esc(x.cust.nat)) + kv('Licence expiry', dFull(new Date(2028, x.cust.i % 12, 10))) + '<div class="full">' + kv('Emergency contact', 'Family member, ' + esc(PEOPLE[(x.cust.i + 5) % PEOPLE.length][0].split(' ')[0]) + ' (' + '+60 00-' + (200 + x.cust.i * 13) + ' ' + (4100 + x.cust.i * 7) + ')') + '</div></div></div>' +
      '<div class="sect"><div class="sect-h">' + i('car') + 'Rental</div><div class="sect-b">' + kv('Car', esc(carName(x.car)) + ' · ' + esc(x.car.plate)) + kv('Rental Duration', plural(x.days, 'day')) + kv('Booking start date &amp; time', dShort(x.start) + ', ' + tm(x.start)) + kv('Booking end date &amp; time', dShort(x.end) + ', ' + tm(x.end)) + kv('Start of rental', esc(x.pickup)) + kv('End of rental', esc(x.drop)) + kv('Daily rate', rm2(x.car.rate)) + kv('Assigned agent', esc(x.agent || 'No staff assigned')) + '</div></div>' +
      '<div class="sect"><div class="sect-h">' + i('calculator') + 'Calculated charges</div><div class="sect-b">' + kv('Total Rent (RM)', rm2(x.rent)) + kv('Damage cover', x.dmg ? rm2(x.dmg) + ' (Basic)' : 'Not chosen') + kv('Delivery', rm2(x.deliv)) + kv('Return', rm2(x.ret)) + kv('Discount', rm2(x.disc)) + kv('Deposit', rm2(x.dep)) + '<div class="full">' + kv('Total Payable Amount (RM)', '<span style="color:var(--primary-text);font-size:18px">' + rm2(x.payable) + '</span>') + '</div><div class="full">' + moneyBar(x).replace('class="money"', 'class="money" style="flex-direction:row;justify-content:space-around;flex-wrap:wrap;--c:' + (x.payable - x.received <= 0 ? 'var(--success-rgb)' : x.received > 0 ? 'var(--warning-rgb)' : 'var(--error-rgb)') + '"') + '</div></div></div>' +
      '<div class="sect"><div class="sect-h">' + i('credit-card') + 'Payment status</div><div class="sect-b"><div class="inp"><label>Booking Status</label><select>' + Object.keys(BOOKING_COLORS).map(function (s) { return '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="inp"><label>Payment Status</label><select>' + Object.keys(PAY_COLORS).map(function (s) { return '<option' + (s === x.pay ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="inp"><label>Payment Method</label><select><option>Bank transfer</option><option>DuitNow QR</option><option>Cash</option><option>Card</option></select></div></div></div>' +
      '<div class="sect"><div class="sect-h">' + i('id') + 'Documents</div><div class="sect-b">' + docs.map(function (dc, k) { var have = x.status !== 'Agreement Sent' || k < 2; return '<div class="row gap12"><span class="paper" style="display:contents"><span class="thumb" style="width:56px;height:40px;border-radius:6px;border:1px solid var(--divider);display:grid;place-items:center;color:var(--text3);background:var(--hover)">' + i(have ? 'photo' : 'photo-off') + '</span></span><div><div class="t1c fw5">' + dc + '</div><div class="b2">' + (have ? 'Uploaded by the customer' : 'Not uploaded yet') + '</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="sect"><div class="sect-h">' + i('clipboard-check') + 'Handover and inspection</div><div class="sect-b">' + kv('Start of rental', x.inspected ? '24 photos · ' + dShort(x.start) + ', ' + tm(new Date(x.start.getTime() + 9 * 6e4)) : 'Not done yet') + kv('End of rental', x.status === 'Completed' || x.status === 'Car Returned' ? '24 photos · ' + dShort(x.end) + ', ' + tm(new Date(x.end.getTime() + 6 * 6e4)) : 'Not done yet') + kv('Delivery / pick-up note', '-') + kv('Return / drop-off note', '-') + '</div></div>' +
      '<div class="sect"><div class="sect-h">' + i('history') + 'Record</div><div class="sect-b">' + kv('Created At', dFull(x.created) + ', ' + tm(new Date(x.created.getTime() + 37e6))) + kv('Submitted At', x.status === 'Agreement Sent' ? 'Not signed yet' : dFull(new Date(x.created.getTime() + DAY)) + ', 9:12 PM') + '</div></div>';
    foot = '<button type="button" class="btn o" data-a="toast" data-v="Customer link copied: ' + b.slug + '.orbiquefms.com/book/' + x.code.toLowerCase() + '">' + i('copy') + 'Copy customer link</button><button type="button" class="btn o" data-a="sec" data-v="bf">' + i('device-mobile') + 'Open booking form</button><button type="button" class="btn c" data-a="close">Save changes</button>';
  } else if (dr.kind === 'car') {
    var c = d.cars[dr.i];
    h = '<div class="grow row gap12">' + carSVG(c.color, c.shape).replace('<svg', '<svg style="width:74px;flex:none"') + '<div style="min-width:0"><h2 class="ellip">' + esc(carName(c)) + '</h2><span class="plate">' + esc(c.plate) + '</span></div></div>';
    var tabsC = [['papers', 'Papers'], ['details', 'Details'], ['bookings', 'Bookings']];
    var papers = [
      ['Registration card (grant)', 'read', [['Plate number', c.plate, 'same'], ['Make and model', c.make + ' ' + c.model.split(' ')[0], 'same'], ['Chassis no.', c.chassis, 'new'], ['Engine no.', c.engine, 'new'], ['Year made', String(c.year), 'same']]],
      ['Insurance cover note', 'read', [['Plate number', c.plate, 'same'], ['Insurer', c.insurer, 'new'], ['Valid until', dFull(c.insExp), 'new']]],
      ['Road tax', (c.tax - TODAY) / DAY < 30 ? 'check' : 'read', [['Plate number', c.plate, 'same'], ['Valid until', dFull(c.tax), (c.tax - TODAY) / DAY < 30 ? 'check' : 'new']]],
      ['Puspakom inspection', 'none', []]
    ];
    var chipFor = function (s) { return s === 'same' ? '<span class="chip ok">Same as the car</span>' : s === 'check' ? '<span class="chip warn">Check this</span>' : '<span class="chip info">New</span>'; };
    body = '<div class="tabs">' + tabsC.map(function (t) { return '<button type="button" class="tab" data-a="cartab" data-v="' + t[0] + '" aria-selected="' + (S.carTab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (S.carTab === 'papers') {
      body += '<div class="alert pri">' + i('scan') + '<div>Add a photo or PDF of each paper. The system reads the plate, dates and numbers and checks them against the car.</div></div>' + papers.map(function (p) {
        return '<div class="sect"><div class="sect-h">' + i('file-text') + '<span class="grow">' + p[0] + '</span>' + (p[1] === 'read' ? '<span class="chip ok">' + i('check') + 'Read</span>' : p[1] === 'check' ? '<span class="chip warn">Check this</span>' : '<span class="chip">Not uploaded yet</span>') + '</div><div style="padding:8px 16px 14px">' +
          (p[2].length ? p[2].map(function (r) { return '<div class="read-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b>' + chipFor(r[2]) + '</div>'; }).join('') + '<label class="cb mt8"><input type="checkbox"' + (p[1] === 'read' ? ' checked' : '') + '><span class="box">' + i('check') + '</span>I checked: this paper belongs to this car</label>'
            : '<div class="row wrap gap8"><span class="b2 grow">Nothing uploaded. Due with the next road tax renewal.</span><button type="button" class="btn o sm" data-a="toast" data-v="Choose a photo or PDF of the paper">' + i('upload') + 'Upload</button></div>') + '</div></div>';
      }).join('') + '<div class="sect"><div class="sect-h">' + i('lock') + '<span class="grow">Owner documents</span><span class="chip">Private</span></div><div style="padding:12px 16px" class="b2">Loan and instalment papers. Only people allowed to see the owner\'s details can open them.</div></div>';
    } else if (S.carTab === 'details') {
      body += '<div class="sect"><div class="sect-b">' + kv('Make', c.make) + kv('Model', c.model) + kv('Year', c.year) + kv('Type', c.type) + kv('Engine', (c.cc / 1000).toFixed(1) + ' L (' + n0(c.cc) + ' cc)') + kv('Seats', c.seats) + kv('Transmission', c.trans) + kv('Fuel', c.fuel) + kv('Colour', c.color) + kv('Odometer', n0(c.odo) + ' km') + kv('Daily rate', rm2(c.rate)) + kv('Website', c.web ? 'Shown on the website' : 'Hidden from website') + '</div></div>';
    } else {
      var bs = d.bookings.filter(function (x) { return x.car === c; }).slice(-6).reverse();
      body += '<div class="vd-list">' + bs.map(function (x) { return '<div class="vd-li"><span class="vd-time">' + dDay(x.start) + '</span><div style="min-width:0"><div class="t1c fw5">' + x.code + ' · ' + esc(x.cust.name) + '</div><div class="b2">' + plural(x.days, 'day') + ' · ' + rm2(x.rent) + '</div></div>' + bchip(x) + '</div>'; }).join('') + '</div>';
    }
    foot = '<button type="button" class="btn o" data-a="close">Close</button><button type="button" class="btn c" data-a="close">Save changes</button>';
  } else if (dr.kind === 'cust') {
    var p = d.people[dr.i], bks = d.bookings.filter(function (x) { return x.cust === p; }).reverse();
    h = '<div class="grow row gap12"><span class="av lg">' + initials(p.name) + '</span><div><h2>' + esc(p.name) + '</h2><div class="b2">Customer since ' + MONTHS[p.since.getMonth()] + ' ' + p.since.getFullYear() + '</div></div></div>';
    body = '<div class="sect"><div class="sect-h">' + i('user') + 'Details</div><div class="sect-b">' + kv('Phone', esc(p.phone)) + kv('Email', esc(p.email)) + kv('IC / Passport no.', esc(maskId(p.ic))) + kv('Nationality', esc(p.nat)) + kv('IC check', p.flag === 'Blacklisted' ? '<span class="chip bad">Blacklisted</span>' : '<span class="chip ok">Passed</span>') + kv('Flags', p.flag || 'None') + '</div></div>' +
      '<div class="sect"><div class="sect-h">' + i('calendar-event') + 'Bookings (' + bks.length + ')</div><div style="padding:4px 16px 8px"><div class="vd-list">' + (bks.length ? bks.map(function (x) { return '<div class="vd-li"><span class="vd-time">' + dDay(x.start) + '</span><div style="min-width:0"><div class="t1c fw5">' + x.code + ' · ' + esc(carModel(x.car)) + '</div><div class="b2">' + plural(x.days, 'day') + ' · ' + rm2(x.payable) + '</div></div>' + bchip(x) + '</div>'; }).join('') : '<div class="b2" style="padding:12px 0">No bookings yet.</div>') + '</div></div></div>' +
      '<div class="inp"><label>Notes for the team</label><textarea placeholder="Only staff see this"></textarea></div>';
    foot = '<button type="button" class="btn o" data-a="close">Close</button><button type="button" class="btn c" data-a="toast" data-v="New booking for ' + esc(p.name) + '">' + i('plus') + 'New Booking</button>';
  }
  return '<div class="ov" role="dialog" aria-modal="true"><aside class="drw"><div class="drw-h">' + h + '<button type="button" class="ib" data-a="close" aria-label="Close">' + i('x') + '</button></div><div class="drw-b">' + body + '</div><div class="drw-f">' + foot + '</div></aside></div>';
}
function modalView() {
  var m = S.modal, x = findBooking(m.ref), b = B();
  if (m.kind === 'invoice' && x) {
    return '<div class="ov" role="dialog" aria-modal="true"><div class="dlg wide"><div class="dlg-h"><div class="grow"><h2>Invoice preview</h2><p>' + x.code + ' · ' + esc(x.cust.name) + '</p></div><button type="button" class="ib" data-a="close" aria-label="Close">' + i('x') + '</button></div><div class="dlg-b" style="background:var(--hover);padding:20px">' + invoicePaper(x) + '</div><div class="dlg-f"><button type="button" class="btn o" data-a="toast" data-v="PDF downloaded (sample)">' + i('download') + 'Download PDF</button><button type="button" class="btn c" data-a="toast" data-v="Invoice sent to ' + esc(x.cust.name) + ' on WhatsApp">' + i('brand-whatsapp') + 'Send on WhatsApp</button></div></div></div>';
  }
  if (m.kind === 'refund' && x) {
    var keep = x.n % 5 === 0 ? 35 : 0;
    return '<div class="ov" role="dialog" aria-modal="true"><div class="dlg"><div class="dlg-h"><div class="grow"><h2>Refund the deposit</h2><p>' + x.code + ' · ' + esc(x.cust.name) + ' · ' + esc(x.car.plate) + '</p></div><button type="button" class="ib" data-a="close" aria-label="Close">' + i('x') + '</button></div><div class="dlg-b">' +
      '<div class="sect"><div style="padding:14px 16px" class="col gap8"><div class="row" style="justify-content:space-between"><span class="muted">Deposit received</span><b class="t1c">' + rm2(x.dep) + '</b></div><div class="row" style="justify-content:space-between"><span class="muted">Missing fuel</span><b class="t1c">' + (keep ? '- ' + rm2(keep) : rm2(0)) + '</b></div><div class="row" style="justify-content:space-between"><span class="muted">Tolls and fines</span><b class="t1c">' + rm2(0) + '</b></div><div style="border-top:1px solid var(--divider)"></div><div class="row" style="justify-content:space-between"><span class="t1c fw6">To give back</span><b style="color:var(--primary-text);font-size:18px">' + rm2(x.dep - keep) + '</b></div></div></div>' +
      '<div class="inp"><label>Refunded by</label><select><option>' + b.staff.join('</option><option>') + '</option></select></div><div class="inp"><label>Refund to</label><select><option>The customer\'s bank account on file</option><option>Cash</option></select></div>' +
      '<div class="sect" style="border-style:dashed;padding:18px;text-align:center" ><div class="b2">' + i('upload') + ' Drop the transfer slip here, or click to choose</div></div></div><div class="dlg-f"><button type="button" class="btn g" data-a="close">Cancel</button><button type="button" class="btn c" data-a="refundDone" data-v="' + x.code + '">Mark refunded</button></div></div></div>';
  }
  return '';
}
A.refundDone = function (v) { var x = findBooking(v); if (x) { x.pay = 'Deposit Refunded'; x.status = 'Completed'; } S.modal = null; render(); toast('Refund recorded. ' + (x ? x.cust.name.split(' ')[0] : 'The customer') + ' gets a statement on WhatsApp.'); };

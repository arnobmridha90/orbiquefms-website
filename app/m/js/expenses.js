/* ---------------- EXPENSES (M8) ----------------
   #expenses           month list: sticky month stepper, summary ("Spent in November"), where the money went, filters, cards by day
   #expenses?add=1     opens Add expense straight away (Home quick action)
   #expense/<id>       one expense: facts, receipt, Change / Delete inside the company edit window
   Expenses.add({car, booking, kind})   the Add expense sheet (receipt first, auto-read, several kinds in one entry)
   Expenses.rows(from, to, {all})        every expense row in a period: recorded + finished service jobs + car papers (reports.js uses it)
   Rules follow the reference: the receipt total fills the one ticked kind still without an amount; each ticked kind is saved
   as its own expense sharing the day, car, booking, payment details and the one receipt; a client key stops a double tap
   saving twice; handover fees go through Fees.claim (once per booking, the person's own rate). */

var EX_MAX_LINES = 20, EX_MAX_PAYEE = 120, EX_MAX_NOTE = 500, EX_MAX_AMOUNT = 1000000;
var EX_PAID = ['Cash', 'Card', 'Bank transfer', 'E-wallet', 'Other'];
var EX_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var EX_ORDERS = [['-date', 'Newest first'], ['date', 'Oldest first'], ['-amount', 'Biggest first'], ['amount', 'Smallest first']];

/* ---------- days and months ('2026-11-24', '2026-11') ---------- */
function exToday() { return toLocalInput(new Date()); }
function exAddDays(day, n) { var p = day.split('-'); return toLocalInput(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
function exDayDate(day) { var p = day.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function exMonthOf(d) { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function exStepMonth(m, n) { var t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n; return Math.floor(t / 12) + '-' + pad(t % 12 + 1); }
function exMonthLabel(m) { return EX_MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
function exMonthRange(m) { var a = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1); return { from: a, to: new Date(a.getFullYear(), a.getMonth() + 1, 1) }; }
/* 'Today', 'Yesterday', 'Tue 17 Nov' (with the year when it is not this year) */
function exDayLabel(d) { var w = dayWord(d); if (w === 'Today' || w === 'Yesterday' || w === 'Tomorrow') return w; d = new Date(d); return dLong(d) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); }
/* '18 hours' / '45 minutes' / '3 days' */
function exLeft(ms) { var m = Math.round(ms / MIN); if (m < 60) return Math.max(1, m) + ' minute' + (m === 1 ? '' : 's'); var h = Math.floor(m / 60); if (h < 48) return h + ' hour' + (h === 1 ? '' : 's'); var d = Math.floor(h / 24); return d + ' day' + (d === 1 ? '' : 's'); }

/* ---------- kinds ---------- */
function exKinds() { return B().expenseKinds || []; }
function exKind(name) { return exKinds().filter(function (k) { return k.name === name; })[0] || null; }
function exFeeRow(name) { return (B().handoverFees || []).filter(function (f) { return f.kind === name; })[0] || null; }
function exUsable() { var biz = can('expenses.add_business'); return exKinds().filter(function (k) { return !k.business || biz; }); }
function exGroupOf(e) {
  if (e.src === 'job') return 'Service job'; if (e.src === 'paper') return 'Car paper';
  if (e.agentFee || exFeeRow(e.kind)) return 'Handover fee'; if (e.toStaff) return 'To staff';
  var k = exKind(e.kind); return k && k.business ? 'Office and admin' : 'Everyday';
}
function exIcon(e) {
  var k = (exKind(e.kind) || {}).id || '';
  if (e.src === 'job') return 'wrench'; if (e.src === 'paper') return 'file'; if (e.agentFee || exFeeRow(e.kind)) return 'key'; if (e.toStaff) return 'users';
  return { fuel: 'fuel', delivery_fuel: 'fuel', wash: 'car', service: 'wrench', tyres: 'wrench', repair: 'wrench', roadtax: 'file', insurance: 'shield', hp: 'bank', summons: 'warn', toll: 'map', parking: 'pin', taxi: 'car', meal: 'clock', rent: 'home', salary: 'users', ads: 'star', utilities: 'activity', phone: 'phone', stationery: 'note' }[k] || 'receipt';
}
/* the receipt of an expense: lines saved together keep the picture once (on the first) */
function exReceipt(e) { if (!e) return null; if (e.receipt) return e.receipt; if (e.receiptOf) { var f = byId(S.expenses, e.receiptOf); return f ? f.receipt : null; } return null; }

/* ---------- every expense row of a period (recorded + finished service jobs + papers with a cost) ---------- */
function exRows(from, to, opts) {
  opts = opts || {}; var f = from ? new Date(from).getTime() : -Infinity, t = to ? new Date(to).getTime() : Infinity, now = Date.now(), out = [];
  var inR = function (at) { var x = new Date(at).getTime(); return x >= f && x < t; };
  (S.expenses || []).forEach(function (e) {
    if (e.voided || !e.at || !inR(e.at)) return;
    if (!opts.all && e.by !== S.me) return;
    out.push({ id: e.id, src: 'recorded', kind: e.kind, amt: +e.amt || 0, at: e.at, car: e.car || null, booking: e.booking || null, by: e.by, receipt: exReceipt(e), paidWith: e.paidWith || '', paidTo: e.paidTo || '', note: e.note || '', toStaff: e.toStaff || null, agentFee: !!e.agentFee, e: e });
  });
  if (opts.all) {
    (S.jobs || []).forEach(function (j) { if (j.status !== 'done' || !(+j.cost > 0) || !j.at || new Date(j.at) > now || !inR(j.at)) return; var v = byId(S.vendors, j.vendor); out.push({ id: 'job-' + j.id, src: 'job', kind: j.type || 'Service job', amt: +j.cost, at: j.at, car: j.car, booking: null, by: j.by, receipt: j.photo || null, paidWith: '', paidTo: v ? v.name : '', note: j.note || '', j: j }); });
    (S.papers || []).forEach(function (p) { if (!(+p.cost > 0) || !p.at || new Date(p.at) > now || !inR(p.at)) return; out.push({ id: 'paper-' + p.id, src: 'paper', kind: p.type, amt: +p.cost, at: p.at, car: p.car, booking: null, by: p.by, receipt: p.photo || null, paidWith: '', paidTo: p.insurer || '', note: p.ref ? 'Ref ' + p.ref : '', p: p }); });
  }
  return out;
}
/* a money gift to a staff member ('Float from the company') moves cash, it is not spending: never in a total */
function exCounts(r) { return !r.toStaff; }
function exSum(rows) { return Math.round(rows.filter(exCounts).reduce(function (s, r) { return s + r.amt; }, 0) * 100) / 100; }
function exRowById(id) {
  if (/^job-/.test(id)) { var j = byId(S.jobs, id.slice(4)); return j ? exRows(null, null, { all: true }).filter(function (r) { return r.id === id; })[0] || null : null; }
  if (/^paper-/.test(id)) return exRows(null, null, { all: true }).filter(function (r) { return r.id === id; })[0] || null;
  var e = byId(S.expenses, id); if (!e) return null;
  return { id: e.id, src: 'recorded', kind: e.kind, amt: +e.amt || 0, at: e.at, car: e.car || null, booking: e.booking || null, by: e.by, receipt: exReceipt(e), paidWith: e.paidWith || '', paidTo: e.paidTo || '', note: e.note || '', toStaff: e.toStaff || null, agentFee: !!e.agentFee, e: e };
}

/* who may change a recorded row, and for how long */
function exEditState(e) {
  if (!e) return { can: false, text: '' };
  if (e.voided) return { can: false, text: 'This expense was deleted.' };
  if (/^installment-/.test(e.id)) return { can: false, text: 'Recorded from Instalments. Change it there.' };
  if (can('expenses.edit_all')) return { can: true, text: '' };
  var hrs = +B().expenseEditHours || 24;
  if (e.by === S.me && can('expenses.edit_own')) {
    var until = new Date(e.created || e.at).getTime() + hrs * HOUR, left = until - Date.now();
    if (left > 0) return { can: true, timed: true, text: 'You can change this for ' + exLeft(left).replace(' ', ' more ') + '.' };
    return { can: false, text: 'The ' + hrs + '-hour window to change this has passed. Ask the owner if it needs fixing.' };
  }
  return { can: false, text: e.by === S.me ? 'Ask the owner for Edit my expenses access to change this.' : 'Only the person who recorded it, or someone allowed to edit all expenses, can change it.' };
}

/* ---------- made-up extras: office costs and a two-line receipt, so the month looks like a real one ---------- */
SEEDERS.push({ key: 'expSeededM8', fn: function (d, x) {
  d.expSeededM8 = true; d.expenses = d.expenses || [];
  var now = Date.now(), staffIds = x.staffIds(), cars = (d.cars || []).filter(function (c) { return c.status === 'active'; });
  var add = function (o) { var at = new Date(Math.min(now - 30 * MIN, o.t)).toISOString(); d.expenses.push(Object.assign({ id: uid(), kind: 'Other', amt: 0, at: at, car: null, booking: null, paidWith: 'Cash', paidTo: '', note: '', receipt: null, by: 's1', created: at, agentFee: false, group: null, changedBy: null, changedAt: null, voided: false }, o, { t: undefined })); };
  [0, 1, 2].forEach(function (mo) {
    var t0 = new Date(new Date().getFullYear(), new Date().getMonth() - mo, 3, 11).getTime();
    add({ kind: 'Electric and water', amt: x.ri(280, 460) + .4, t: t0 + 2 * DAY, paidWith: 'Bank transfer', paidTo: 'Utility company', receipt: 'demo:receipt:Bill' });
    add({ kind: 'Advertising', amt: [450, 300, 600][mo], t: t0 + 6 * DAY, paidWith: 'Card', paidTo: 'Social media ads', note: 'Boosted post for the school holidays' });
    if (cars[mo * 3]) add({ kind: 'Summons paid', amt: 150, t: t0 + 9 * DAY, car: cars[mo * 3].id, paidWith: 'E-wallet', paidTo: 'Police', by: x.pick(staffIds), receipt: 'demo:receipt:Summons receipt' });
  });
  /* one receipt for fuel and a car wash, saved together this morning */
  var c = cars[2]; if (c) {
    var t = sod(new Date()).getTime() + 9 * HOUR + 20 * MIN, first = uid(), by = staffIds.indexOf('s4') >= 0 ? 's4' : 's1';
    add({ id: first, kind: 'Fuel', amt: 80, t: t, car: c.id, paidWith: 'Card', paidTo: 'Petron', receipt: 'demo:receipt:Fuel and wash', by: by, clientKey: 'seed-m8' });
    add({ kind: 'Car wash', amt: 20, t: t, car: c.id, paidWith: 'Card', paidTo: 'Petron', receiptOf: first, by: by, clientKey: 'seed-m8' });
  }
} });

/* =====================================================================
   The list
   ===================================================================== */
var EXV = null;
function exvReset() { EXV = { month: exMonthOf(new Date()), kind: '', car: '', who: '', src: 'all', order: '-date', q: '', allKinds: false, limit: 40 }; }
exvReset();
VIEW_STATE.push(exvReset);
function exFilterCount() { return [EXV.kind, EXV.car, EXV.who, EXV.src !== 'all' ? EXV.src : '', EXV.order !== '-date' ? EXV.order : ''].filter(Boolean).length; }
function exMatches(r, f) {
  f = f || EXV;
  if (f.kind && r.kind !== f.kind) return false;
  if (f.car && r.car !== f.car) return false;
  if (f.src && f.src !== 'all' && r.src !== f.src) return false;
  if (f.who === 'me' && r.by !== S.me) return false;
  if (f.who && f.who !== 'me' && r.by !== f.who) return false;
  if (f.q && f.q.trim()) {
    var q = f.q.trim(), k = car(r.car) || {}, b = r.booking ? bk(r.booking) : null;
    if (b && matchBookingCode(q, b)) return true;
    if (normPlate(q).length >= 3 && normPlate(k.plate).indexOf(normPlate(q)) >= 0) return true;
    return wordsMatch(q, [r.kind, k.plate, k.make, k.model, b ? b.code : '', r.note, r.paidTo, who(r.by), r.paidWith].join(' '));
  }
  return true;
}
function exSort(list, order) {
  var by = { '-date': function (a, b) { return new Date(b.at) - new Date(a.at); }, 'date': function (a, b) { return new Date(a.at) - new Date(b.at); }, '-amount': function (a, b) { return b.amt - a.amt || new Date(b.at) - new Date(a.at); }, 'amount': function (a, b) { return a.amt - b.amt || new Date(b.at) - new Date(a.at); } }[order] || null;
  return list.sort(by);
}
function exCard(r) {
  var k = car(r.car), b = r.booking ? bk(r.booking) : null, rc = r.receipt;
  var sub = [k ? k.plate : '', b ? b.code : '', r.src === 'job' ? 'Service job' : r.src === 'paper' ? 'Car paper' : r.paidWith, r.toStaff ? 'To ' + firstName(who(r.toStaff)) : r.paidTo, can('expenses.view_all') && r.src === 'recorded' && r.by !== S.me ? firstName(who(r.by)) : ''].filter(Boolean).join(' · ');
  return '<a class="card2 ex-card' + (r.toStaff ? ' ex-muted' : '') + '" href="#expense/' + esc(r.id) + '">' +
    '<span class="ex-ic' + (r.src !== 'recorded' ? ' alt' : '') + '">' + I(exIcon(r)) + '</span>' +
    '<span class="c2-main"><span class="c2-t1">' + esc(r.kind) + (rc ? '<span class="ex-clip" title="Has a receipt" aria-label="Has a receipt">' + I('receipt', 2) + '</span>' : '') + '</span><span class="c2-t2">' + esc(sub || exGroupOf(r)) + '</span></span>' +
    '<span class="c2-end money">' + rm(r.amt) + (r.toStaff ? '<small>Not a cost</small>' : '') + '</span></a>';
}
VIEWS.expenses = function (r) {
  if (!can('expenses.view') && !can('expenses.add')) return { html: topbar('Expenses', { back: '#more' }) + '<main>' + noAccess('expenses.view') + '</main>' };
  if (r.q && r.q.add) {
    var pre = { car: r.q.car, booking: r.q.booking, kind: r.q.kind };
    return { html: '', after: function () { replaceHash('#expenses'); setTimeout(function () { Expenses.add(pre); }, 30); } };
  }
  var all = can('expenses.view_all'), thisMonth = exMonthOf(new Date());
  if (EXV.month > thisMonth) EXV.month = thisMonth;
  var rng = exMonthRange(EXV.month), rows = exRows(rng.from, rng.to, { all: all });
  var prevR = exMonthRange(exStepMonth(EXV.month, -1)), prevTot = exSum(exRows(prevR.from, prevR.to, { all: all }));
  var shown = exSort(rows.filter(function (x) { return exMatches(x); }), EXV.order), total = exSum(rows), shownTot = exSum(shown), nf = exFilterCount() + (EXV.q.trim() ? 1 : 0);
  var monthName = EX_MONTHS[+EXV.month.slice(5, 7) - 1];
  /* summary */
  var pct = prevTot > 0 ? Math.round((total - prevTot) / prevTot * 100) : null;
  var cmp = pct === null ? '' : pct === 0 ? 'About the same as ' + exMonthLabel(exStepMonth(EXV.month, -1)) : Math.abs(pct) + '% ' + (pct > 0 ? 'more' : 'less') + ' than ' + EX_MONTHS[+exStepMonth(EXV.month, -1).slice(5, 7) - 1];
  var parts = function (s) { return exSum(rows.filter(function (x) { return x.src === s; })); };
  var byKind = {}; rows.filter(exCounts).forEach(function (x) { byKind[x.kind] = (byKind[x.kind] || 0) + x.amt; });
  var kinds = Object.keys(byKind).map(function (k) { return { k: k, v: byKind[k] }; }).sort(function (a, b) { return b.v - a.v; });
  var maxV = kinds.length ? kinds[0].v : 1, kShow = EXV.allKinds ? kinds : kinds.slice(0, 5);
  var summary = '<section class="card ex-sum">' +
    '<div class="ex-sum-k">' + (all ? 'Spent in ' + monthName : 'You recorded in ' + monthName) + '</div><div class="ex-sum-v money">' + rm(total) + '</div>' +
    '<div class="ex-sum-n">' + rows.filter(exCounts).length + ' expense' + (rows.filter(exCounts).length === 1 ? '' : 's') + (cmp ? ' · ' + esc(cmp) : '') + '</div>' +
    (all ? '<div class="ex-parts"><button type="button" data-src="recorded"><small>Recorded</small><b class="money">' + rm(parts('recorded')) + '</b><span>By the team</span></button><button type="button" data-src="job"><small>Service jobs</small><b class="money">' + rm(parts('job')) + '</b><span>From Maintenance</span></button><button type="button" data-src="paper"><small>Papers</small><b class="money">' + rm(parts('paper')) + '</b><span>Road tax, insurance</span></button></div>' : '') +
    (kinds.length ? '<div class="ex-where"><div class="ex-where-h">Where the money went</div>' + kShow.map(function (x) {
      return '<button type="button" class="ex-wrow' + (EXV.kind === x.k ? ' on' : '') + '" data-kind="' + esc(x.k) + '"><span class="ex-wname">' + esc(x.k) + '<i style="width:' + Math.max(3, Math.round(x.v / maxV * 100)) + '%"></i></span><span class="ex-wpct">' + (total ? Math.round(x.v / total * 100) : 0) + '%</span><span class="money">' + rm(x.v) + '</span></button>';
    }).join('') + (kinds.length > 5 ? '<button type="button" class="btn link ex-morek" id="exMoreK">' + (EXV.allKinds ? 'Show fewer' : 'Show all ' + kinds.length + ' kinds') + '</button>' : '') + '</div>' : '') +
    '</section>';
  /* filter chips that are on */
  var on = [];
  if (EXV.kind) on.push(['kind', EXV.kind]);
  if (EXV.car) on.push(['car', (car(EXV.car) || {}).plate || 'Car']);
  if (EXV.who) on.push(['who', EXV.who === 'me' ? 'Recorded by me' : 'By ' + firstName(who(EXV.who))]);
  if (EXV.src !== 'all') on.push(['src', { recorded: 'Recorded', job: 'Service jobs', paper: 'Papers' }[EXV.src]]);
  if (EXV.order !== '-date') on.push(['order', (EX_ORDERS.filter(function (o) { return o[0] === EXV.order; })[0] || [])[1]]);
  var chipsOn = on.length ? '<div class="chiprow ex-on">' + on.map(function (o) { return '<button type="button" class="fchip on" data-off="' + o[0] + '">' + esc(o[1]) + I('x', 2.4) + '</button>'; }).join('') + (on.length > 1 ? '<button type="button" class="fchip" data-off="all">Clear all</button>' : '') + '</div>' : '';
  /* cards by day */
  var body = '', more = shown.length - EXV.limit;
  var page = shown.slice(0, EXV.limit);
  if (!shown.length) {
    body = '<div class="list"><div class="empty">' + I('receipt') + '<b>' + (nf ? 'Nothing matches these choices' : 'No expenses in ' + exMonthLabel(EXV.month) + ' yet') + '</b><br>' +
      (nf ? 'Clear the filters to see the whole month.' : can('expenses.add') ? 'When you pay for fuel, a toll or a car wash, add it here with the day and the amount. A photo of the receipt helps later.' : 'Nothing has been recorded for this month.') + '</div></div>';
  } else if (EXV.order === '-date' || EXV.order === 'date') {
    var groups = [], cur = null;
    page.forEach(function (x) { var d = toLocalInput(x.at); if (!cur || cur.d !== d) { cur = { d: d, at: x.at, rows: [] }; groups.push(cur); } cur.rows.push(x); });
    body = groups.map(function (g) { return '<div class="ex-day"><span>' + esc(exDayLabel(g.at)) + '</span><span class="money">' + rm(exSum(g.rows)) + '</span></div><div class="list">' + g.rows.map(exCard).join('') + '</div>'; }).join('');
  } else body = '<div class="list">' + page.map(exCard).join('') + '</div>';
  if (more > 0) body += '<button type="button" class="btn ghost ex-more" id="exMore">Show ' + Math.min(more, 40) + ' more <span class="muted">(' + more + ' left)</span></button>';
  var html = topbar('Expenses', { back: '#more', sub: all ? 'Everything the business spent' : 'What you recorded' }) +
    '<div class="ex-month"><button type="button" class="iconbtn" id="exPrev" aria-label="Earlier month">' + I('back', 2.2) + '</button><div class="ex-mlabel"><b>' + esc(exMonthLabel(EXV.month)) + '</b>' + (EXV.month !== thisMonth ? '<button type="button" id="exNow">Back to this month</button>' : '<span>This month</span>') + '</div><button type="button" class="iconbtn ex-next" id="exNext" aria-label="Later month"' + (EXV.month >= thisMonth ? ' disabled' : '') + '>' + I('back', 2.2) + '</button></div>' +
    '<main class="ex-main">' + summary +
    '<div class="ex-tools"><label class="search ex-search">' + I('search') + '<input id="exq" type="search" placeholder="Kind, plate, booking or note" value="' + esc(EXV.q) + '" autocomplete="off"></label><button type="button" class="ex-fbtn" id="exFilt">' + I('filter') + 'Filters' + (exFilterCount() ? '<span class="ex-badge">' + exFilterCount() + '</span>' : '') + '</button></div>' +
    chipsOn + (nf ? '<div class="ex-match">' + shown.length + ' shown · <span class="money">' + rm(shownTot) + '</span></div>' : '') +
    '<div id="exBody">' + body + '</div></main>' +
    (can('expenses.add') ? '<button type="button" class="fab fab-x" id="exFab" aria-label="Add expense">' + I('receipt', 2.2) + '<span>Expense</span></button>' : '');
  return { html: html, keepScroll: true, after: function () {
    $('#exPrev').onclick = function () { EXV.limit = 40; EXV.month = exStepMonth(EXV.month, -1); render(); };
    $('#exNext').onclick = function () { if (EXV.month < thisMonth) { EXV.limit = 40; EXV.month = exStepMonth(EXV.month, 1); render(); } };
    var nw = $('#exNow'); if (nw) nw.onclick = function () { EXV.month = thisMonth; render(); };
    $$('.ex-wrow').forEach(function (b) { b.onclick = function () { EXV.kind = EXV.kind === b.dataset.kind ? '' : b.dataset.kind; render(); var l = $('.ex-tools'); if (l && EXV.kind) l.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; });
    $$('.ex-parts button').forEach(function (b) { b.onclick = function () { EXV.src = EXV.src === b.dataset.src ? 'all' : b.dataset.src; render(); }; });
    var mk = $('#exMoreK'); if (mk) mk.onclick = function () { EXV.allKinds = !EXV.allKinds; render(); };
    $$('[data-off]').forEach(function (b) { b.onclick = function () { var k = b.dataset.off; if (k === 'all') { EXV.kind = ''; EXV.car = ''; EXV.who = ''; EXV.src = 'all'; EXV.order = '-date'; } else if (k === 'src') EXV.src = 'all'; else if (k === 'order') EXV.order = '-date'; else EXV[k] = ''; render(); }; });
    $('#exFilt').onclick = exFilters;
    var q = $('#exq'), tm = null; q.oninput = function () { clearTimeout(tm); tm = setTimeout(function () { EXV.q = q.value; render(); var q2 = $('#exq'); if (q2) { q2.focus(); try { q2.setSelectionRange(q2.value.length, q2.value.length); } catch (e) {} } }, 250); };
    var mo = $('#exMore'); if (mo) mo.onclick = function () { EXV.limit += 40; render(); };
    var fab = $('#exFab'); if (fab) fab.onclick = function () { Expenses.add({}); };
  } };
};

/* the Filters sheet: kind, car, recorded by, where from, order. The button shows how many it would show. */
function exFilters() {
  var all = can('expenses.view_all'), f = { kind: EXV.kind, car: EXV.car, who: EXV.who, src: EXV.src, order: EXV.order, q: EXV.q };
  var rng = exMonthRange(EXV.month), rows = exRows(rng.from, rng.to, { all: all });
  var names = {}; rows.forEach(function (x) { names[x.kind] = 1; });
  var groups = { 'Everyday': [], 'Office and admin': [], 'Handover fees': [], 'From Maintenance': [] };
  exKinds().forEach(function (k) { (k.business ? groups['Office and admin'] : groups['Everyday']).push(k.name); delete names[k.name]; });
  rows.forEach(function (x) { if (!names[x.kind]) return; (x.src !== 'recorded' ? groups['From Maintenance'] : exFeeRow(x.kind) || x.agentFee ? groups['Handover fees'] : groups['Everyday']).push(x.kind); delete names[x.kind]; });
  var opt = function (n) { return '<option value="' + esc(n) + '"' + (f.kind === n ? ' selected' : '') + '>' + esc(n) + '</option>'; };
  var sel = '<select class="inp" id="exfKind"><option value="">All kinds</option>' + Object.keys(groups).filter(function (g) { return groups[g].length; }).map(function (g) { return '<optgroup label="' + esc(g) + '">' + groups[g].map(opt).join('') + '</optgroup>'; }).join('') + '</select>';
  var seg = function (id, list, cur) { return '<div class="seg ex-seg" id="' + id + '">' + list.map(function (o) { return '<button type="button" data-v="' + esc(o[0]) + '" class="' + (cur === o[0] ? 'on' : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; };
  var sh = sheet(sheetHead('Filters', exMonthLabel(EXV.month)) +
    '<label class="field"><span>Kind</span>' + sel + '</label>' +
    '<div class="field"><span>Car</span><div id="exfCar"></div></div>' +
    (all ? '<div class="field"><span>Recorded by</span><div id="exfWho"></div></div>' + '<div class="field"><span>Where it comes from</span>' + seg('exfSrc', [['all', 'All'], ['recorded', 'Recorded'], ['job', 'Service jobs'], ['paper', 'Papers']], f.src) + '</div>' : '') +
    '<div class="field"><span>Order</span>' + seg('exfOrd', EX_ORDERS, f.order) + '</div>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="exfGo"></button><button type="button" class="btn link" id="exfClear">Clear filters</button></div>', null, { cls: 'ex-fsheet' });
  var drawCar = function () {
    var c = car(f.car);
    $('#exfCar', sh).innerHTML = '<div class="ex-pickrow"><button type="button" class="carfield ' + (c ? 'picked-car' : 'empty-car') + '" id="exfCarB">' + (c ? '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model) + '</span></span>' : I('car') + '<span class="grow">All cars</span>') + I('chev') + '</button>' + (c ? '<button type="button" class="iconbtn ex-clr" id="exfCarX" aria-label="Clear the car">' + I('x', 2.2) + '</button>' : '') + '</div>';
    $('#exfCarB', sh).onclick = function () { Pickers.car({ title: 'Expenses of which car?', selected: f.car, onPick: function (k) { f.car = k.id; drawCar(); count(); } }); };
    var x = $('#exfCarX', sh); if (x) x.onclick = function () { f.car = ''; drawCar(); count(); };
  };
  var drawWho = function () {
    var box = $('#exfWho', sh); if (!box) return;
    var other = f.who && f.who !== 'me';
    box.innerHTML = '<div class="seg ex-seg"><button type="button" data-w=""' + (!f.who ? ' class="on"' : '') + '>Everyone</button><button type="button" data-w="me"' + (f.who === 'me' ? ' class="on"' : '') + '>Me</button><button type="button" data-w="pick"' + (other ? ' class="on"' : '') + '>' + (other ? esc(who(f.who)) : 'Choose a person') + '</button></div>';
    $$('[data-w]', box).forEach(function (b) { b.onclick = function () { if (b.dataset.w === 'pick') Pickers.staff({ title: 'Recorded by', includeOff: true, onPick: function (p) { if (p) { f.who = p.id === S.me ? 'me' : p.id; drawWho(); count(); } } }); else { f.who = b.dataset.w; drawWho(); count(); } }; });
  };
  var count = function () { var n = rows.filter(function (x) { return exMatches(x, f); }).length; $('#exfGo', sh).textContent = n ? 'Show ' + n + ' expense' + (n === 1 ? '' : 's') : 'Nothing matches'; $('#exfGo', sh).disabled = false; };
  drawCar(); drawWho(); count();
  $('#exfKind', sh).onchange = function () { f.kind = this.value; count(); };
  ['exfSrc', 'exfOrd'].forEach(function (id) { var el = $('#' + id, sh); if (!el) return; $$('button', el).forEach(function (b) { b.onclick = function () { $$('button', el).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); if (id === 'exfSrc') f.src = b.dataset.v; else f.order = b.dataset.v; count(); }; }); });
  $('#exfGo', sh).onclick = function () { EXV.limit = 40; EXV.kind = f.kind; EXV.car = f.car; EXV.who = f.who; EXV.src = f.src; EXV.order = f.order; closeSheet(); render(); };
  $('#exfClear', sh).onclick = function () { EXV.kind = ''; EXV.car = ''; EXV.who = ''; EXV.src = 'all'; EXV.order = '-date'; EXV.q = ''; closeSheet(); render(); };
}

/* =====================================================================
   One expense
   ===================================================================== */
VIEWS.expense = function (r) {
  var x = exRowById(r.a || '');
  var top = function (sub) { return topbar('Expense', { back: '#expenses', sub: sub }); };
  if (!can('expenses.view') && !can('expenses.add')) return { html: top() + '<main>' + noAccess('expenses.view') + '</main>' };
  if (!x || (x.e && x.e.voided)) return { html: top() + '<main><div class="empty">' + I('receipt') + '<b>This expense is not here any more</b><br>It may have been deleted. Deleted entries stay in the activity log.<br><br><a class="btn ghost sm" href="#expenses">All expenses</a></div></main>' };
  if (x.src === 'recorded' && x.by !== S.me && !can('expenses.view_all')) return { html: top() + '<main>' + noAccess('expenses.view_all') + '</main>' };
  var k = car(x.car), b = x.booking ? bk(x.booking) : null, e = x.e, es = x.src === 'recorded' ? exEditState(e) : { can: false };
  var grp = exGroupOf(x), tone = { 'Everyday': 'blue', 'Office and admin': 'grey', 'Handover fee': 'emerald', 'To staff': 'amber', 'Service job': 'orange', 'Car paper': 'orange' }[grp] || 'grey';
  var sibs = e ? (S.expenses || []).filter(function (o) { return !o.voided && o.id !== e.id && ((e.receiptOf && (o.id === e.receiptOf || o.receiptOf === e.receiptOf)) || (!e.receiptOf && o.receiptOf === e.id)); }) : [];
  var kv = function (label, val, sub) { return '<div><div class="k">' + esc(label) + '</div><div class="v">' + val + (sub ? '<small>' + sub + '</small>' : '') + '</div></div>'; };
  var html = top(exDayLabel(x.at)) + '<main>' +
    '<section class="hero ex-hero"><div class="ex-hero-ic">' + I(exIcon(x)) + '</div><h3>' + esc(x.kind) + '</h3><div class="ex-hero-amt money">' + rm(x.amt) + '</div>' +
    '<div class="ex-hero-chips">' + chip(grp, tone) + (x.toStaff ? chip('Not counted as a cost', 'grey') : '') + (e && e.changedAt ? chip('Changed', 'grey') : '') + '</div>' +
    (x.toStaff ? '<p class="small muted ex-hero-note">Money from the company to ' + esc(who(x.toStaff)) + '. It shows on their money page as cash they hold.</p>' : '') + '</section>' +
    (es.text ? '<div class="banner ' + (es.can ? 'blue' : 'amber') + ' ex-win">' + I(es.can ? 'clock' : 'lock') + '<div>' + esc(es.text) + '</div></div>' : '') +
    '<div class="kv ex-kv">' +
    kv('Day', esc(dFull(x.at)), e && e.created && !sameDay(e.created, x.at) ? 'Recorded ' + esc(dShort(e.created)) : '') +
    kv(x.src === 'recorded' ? 'Paid with' : 'From', esc(x.src === 'job' ? 'Service job' : x.src === 'paper' ? 'Car paper' : x.paidWith || 'Not given')) +
    kv('Car', k ? '<a href="#car/' + k.id + '">' + esc(k.plate) + '</a>' : 'Not tied to a car', k ? esc(k.make + ' ' + k.model) : '') +
    kv('Booking', b ? '<a href="#booking/' + b.id + '">' + esc(b.code) + '</a>' : 'None', b ? esc(cust(b.cust).name) : '') +
    kv(x.src === 'paper' ? 'Insurer or office' : x.src === 'job' ? 'Workshop' : 'Paid to', esc(x.paidTo || 'Not given')) +
    kv('Recorded by', esc(who(x.by) || 'Not known'), e && e.created ? esc(when(e.created)) : '') +
    (e && e.changedBy ? kv('Last changed by', esc(who(e.changedBy)), esc(when(e.changedAt))) : '') +
    '</div>' +
    (x.note ? '<div class="card ex-note"><div class="k">Note</div><div>' + esc(x.note) + '</div></div>' : '') +
    '<div class="sec"><h2>Receipt</h2>' + (es.can && x.src === 'recorded' && !x.agentFee ? '<button type="button" id="exRcAdd">' + (x.receipt ? 'Replace' : 'Add a receipt') + '</button>' : '') + '</div>' +
    (x.receipt ? '<button type="button" class="ex-rcview" id="exRcOpen"><img alt="The receipt" src="' + imgSrc(x.receipt) + '"><span>' + I('eye') + 'Tap to see it full size</span></button>' : '<div class="list"><div class="empty small">' + (x.src !== 'recorded' ? 'The receipt is kept with the ' + (x.src === 'job' ? 'service record' : 'paper') + ' in Maintenance.' : x.agentFee ? 'Handover fees need no receipt.' : 'No receipt was added.') + '</div></div>') +
    (sibs.length ? '<p class="small muted ex-sibs">Saved from the same receipt: ' + sibs.map(function (o) { return '<a href="#expense/' + o.id + '">' + esc(o.kind) + ' ' + rm(o.amt) + '</a>'; }).join(', ') + '</p>' : '') +
    (x.src !== 'recorded' ? '<p class="small muted ex-sibs">Shown here from Maintenance. It is counted once.' + (k ? ' <a href="#car/' + k.id + '">Open the car</a>' : '') + '</p>' : '') +
    (es.can ? '<div class="btnrow ex-acts"><button type="button" class="btn ghost" id="exDel">' + I('trash') + 'Delete</button><button type="button" class="btn" id="exChg">' + I('edit') + 'Change</button></div><p class="small muted ex-sibs">Deleted entries stay in the activity log.</p>' : '') +
    '</main>';
  return { html: html, after: function () {
    var o = $('#exRcOpen'); if (o) o.onclick = function () { exViewReceipt(x.receipt, x.kind + ' ' + rm(x.amt)); };
    var a = $('#exRcAdd'); if (a) a.onclick = function () { exReplaceReceipt(e); };
    var c = $('#exChg'); if (c) c.onclick = function () { Expenses.edit(e.id); };
    var d = $('#exDel'); if (d) d.onclick = function () { exDelete(e); };
  } };
};
function exViewReceipt(src, title) {
  sheet(sheetHead('Receipt', title) + '<div class="ex-full noswipe"><img alt="The receipt" src="' + imgSrc(src) + '"></div>', null, { stack: true, full: true, cls: 'ex-rcsheet' });
}
function exReplaceReceipt(e) {
  Media.photo({ maxPx: 1100, quality: .62 }).then(function (res) {
    var first = e.receiptOf ? byId(S.expenses, e.receiptOf) : e;
    var old = exReceipt(e);
    if (e.receiptOf) { e.receiptOf = null; }
    e.receipt = res.dataUrl; e.receiptHash = res.hash; e.changedBy = S.me; e.changedAt = new Date().toISOString();
    audit((old ? 'Receipt replaced on expense: ' : 'Receipt added to expense: ') + e.kind + ' ' + rm(e.amt), { booking: e.booking, car: e.car, link: '#expense/' + e.id });
    save(); render(true); say(res.note ? 'Receipt saved. ' + res.note : 'Receipt saved');
    void first;
  }, function () {});
}
function exDelete(e) {
  confirm({ icon: 'danger', title: 'Delete this expense?', text: e.kind + ', ' + rm(e.amt) + ', ' + dShort(e.at) + '. It leaves every total. Deleted entries stay in the activity log.', ok: 'Delete', cancel: 'Keep it', primary: 'cancel', danger: true }).then(function (yes) {
    if (!yes) return;
    /* a line that holds the shared receipt hands it to the next line first */
    var heir = (S.expenses || []).filter(function (o) { return o.receiptOf === e.id && !o.voided; });
    if (heir.length && e.receipt) { var h = heir[0]; h.receipt = e.receipt; h.receiptOf = null; heir.slice(1).forEach(function (o) { o.receiptOf = h.id; }); }
    e.voided = true; e.changedBy = S.me; e.changedAt = new Date().toISOString();
    var b = e.booking ? bk(e.booking) : null;
    if (b) bLog(b, 'Expense deleted: ' + e.kind + ' ' + rm(e.amt)); else audit('Expense deleted: ' + e.kind + ' ' + rm(e.amt), { car: e.car, link: '#expense/' + e.id });
    save();
    later(function () { replaceHash('#expenses'); }, 80);
    undoSnack('Expense deleted', function () {
      e.voided = false; e.changedAt = new Date().toISOString();
      if (heir.length && e.receipt) { heir.forEach(function (o) { o.receipt = null; o.receiptOf = e.id; }); }
      audit('Expense brought back: ' + e.kind + ' ' + rm(e.amt), { car: e.car, link: '#expense/' + e.id }); save(); render(); say('Expense brought back');
    });
  });
}

/* =====================================================================
   Add expense / Change expense sheet
   ===================================================================== */
var Expenses = (function () {
  var st = null, sh = null, readTicket = 0;

  function newKey() { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function blank(keep) {
    keep = keep || {};
    return { edit: null, key: newKey(), receipt: null, reading: null, total: null, dupe: null, lines: [], q: '', all: false, day: keep.day || exToday(), car: keep.car || null, booking: null,
      paidWith: keep.paidWith || 'Cash', paidTo: '', note: '', saved: keep.saved || 0, fees: keep.fees || [], busy: false, closing: false, touched: {} };
  }
  function snap() { return JSON.stringify([st.lines.map(function (l) { return l.kind + '=' + l.amt; }), st.car, st.booking, st.paidTo.trim(), st.note.trim()]); }
  function lineOf(k) { return st.lines.filter(function (l) { return l.kind === k; })[0]; }
  function linesTotal() { return Math.round(st.lines.reduce(function (s, l) { var v = parseMoney(l.amt); return s + (isNaN(v) ? 0 : v); }, 0) * 100) / 100; }
  function amtProblem(t) { t = String(t || '').trim(); if (!t) return 'Enter the amount.'; var v = parseMoney(t); if (isNaN(v)) return 'Enter the amount as a number, for example 12.50.'; if (v <= 0) return 'The amount must be more than 0.'; if (v > EX_MAX_AMOUNT) return 'That amount looks too large. Check for an extra digit.'; return ''; }
  /* the receipt total goes into the one ticked kind still open; nothing when two or more are open */
  function fillRemainder() {
    if (st.edit || st.total == null || st.total <= 0) return false;
    var open = st.lines.filter(function (l) { return !l.fixed && (l.auto || !String(l.amt).trim()); });
    if (open.length !== 1) return false;
    var typed = st.lines.filter(function (l) { return l !== open[0]; }).reduce(function (s, l) { var v = parseMoney(l.amt); return s + (isNaN(v) ? 0 : v); }, 0);
    var left = Math.round((st.total - typed) * 100) / 100, amt = left > 0 ? money2(left) : '';
    if (open[0].amt === amt && open[0].auto) return false;
    open[0].amt = amt; open[0].auto = amt !== ''; return true;
  }
  function needs() {
    var nb = [], nc = [];
    st.lines.forEach(function (l) { var k = exKind(l.kind); if (k && k.needsBooking) nb.push(k.name); if (k && k.needsCar) nc.push(k.name); });
    return { booking: nb, car: nc };
  }
  function dirty() {
    if (st.edit) { var e = st.edit, l = st.lines[0] || {}; return !!(st.receipt || st.removeRc || e.kind !== l.kind || money2(e.amt) !== money2(parseMoney(l.amt)) || toLocalInput(e.at) !== st.day || (e.car || null) !== st.car || (e.booking || null) !== st.booking || (e.paidWith || 'Cash') !== st.paidWith || (e.paidTo || '') !== st.paidTo.trim() || (e.note || '') !== st.note.trim()); }
    return !!(st.receipt || snap() !== st.base);
  }
  function problems() {
    var miss = [], wrong = 0, n = needs(), list = function (w) { return w.length <= 1 ? w.join('') : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1]; };
    if (!st.lines.length) miss.push('what it was for');
    if (st.lines.length > EX_MAX_LINES) wrong++;
    st.lines.forEach(function (l) { var p = amtProblem(l.amt); if (p && !String(l.amt).trim()) miss.push('the amount of ' + l.kind); else if (p) wrong++; });
    var needWord = function (w) { return w.length > 1 ? ' need it)' : ' needs it)'; };
    if (n.booking.length && !st.booking) miss.push('the booking (' + list(n.booking) + needWord(n.booking));
    if (n.car.length && !st.car) miss.push('the car (' + list(n.car) + needWord(n.car));
    if (!st.day) miss.push('the day'); else if (st.day > exAddDays(exToday(), 1)) wrong++;
    if (st.paidTo.trim().length > EX_MAX_PAYEE || st.note.trim().length > EX_MAX_NOTE) wrong++;
    var text = miss.length && wrong ? 'To save, choose ' + list(miss) + ', and fix what is marked in red.' : miss.length ? 'To save, choose ' + list(miss) + '.' : wrong ? 'To save, fix what is marked in red.' : '';
    if (!text && st.edit && !dirty()) text = 'Nothing changed yet.';
    return { ok: !text, text: text };
  }

  /* ---------- drawing ---------- */
  function rcHtml() {
    var r = st.receipt, ex = st.edit ? exReceipt(st.edit) : null;
    if (r || (ex && !st.removeRc)) {
      var src = r ? r.dataUrl : ex, rd = st.reading;
      return '<div class="ex-rc has"><button type="button" class="ex-rc-th" id="exRcBig" aria-label="See the receipt"><img alt="The receipt you chose" src="' + imgSrc(src) + '"></button><div class="grow">' +
        '<b>' + (r ? 'Receipt added' : 'Receipt') + '</b>' + (r && r.note ? '<span class="small muted">' + esc(r.note) + '</span>' : '') +
        (rd ? '<div class="ex-read ' + (rd.busy ? 'busy' : rd.tone) + '">' + (rd.busy ? '<i class="ex-spin"></i>' : I(rd.tone === 'ok' ? 'check' : 'info', 2.2)) + '<span>' + esc(rd.text).replace(/RM /g, 'RM&nbsp;') + '</span></div>' : '') +
        (st.dupe ? '<div class="ex-read warn">' + I('warn', 2) + '<span>' + esc(st.dupe) + '</span></div>' : '') +
        '<div class="ex-rc-acts"><button type="button" class="btn link" id="exRcNew">' + I('camera') + 'Take again</button><button type="button" class="btn link red" id="exRcDel">Remove</button></div></div></div>';
    }
    return '<div class="ex-rc"><div class="ex-rc-h"><b>Receipt first</b><span>The total and the day are read from it.</span></div>' +
      '<div class="ex-rc-btns"><button type="button" class="btn" id="exRcCam">' + I('camera') + 'Take photo</button><button type="button" class="btn ghost" id="exRcFile">' + I('image') + 'Choose file</button><button type="button" class="btn ghost" id="exRcPaste">' + I('copy') + 'Paste</button></div>' +
      '<button type="button" class="btn link ex-rc-demo" id="exRcDemo">No receipt here? Use a sample receipt (demo)</button></div>';
  }
  function kindRow(k) {
    var l = lineOf(k.name), dis = !l && st.lines.length >= EX_MAX_LINES;
    var tags = [k.fixed ? rm(k.fixed) + ' set' : '', k.needsBooking ? 'Needs a booking' : k.needsCar ? 'Needs a car' : ''].filter(Boolean).join(' · ');
    return '<button type="button" class="ex-krow' + (l ? ' on' : '') + '" data-k="' + esc(k.name) + '"' + (dis ? ' disabled' : '') + '><span class="ex-box">' + I('check', 3) + '</span><span class="grow">' + esc(k.name) + (tags ? '<small>' + esc(tags) + '</small>' : '') + '</span></button>';
  }
  function kindsHtml() {
    var all = exUsable(), every = all.filter(function (k) { return k.everyday; }), quick = (every.length >= 3 ? every : all).slice(0, 6);
    var q = st.q.trim(), found = q ? all.filter(function (k) { return wordsMatch(q, k.name); }) : null;
    var rest = all.filter(function (k) { return quick.indexOf(k) < 0; });
    var html = '<div class="ex-quick">' + quick.map(function (k) { var on = !!lineOf(k.name); return '<button type="button" class="fchip' + (on ? ' on' : '') + '" data-k="' + esc(k.name) + '">' + (on ? I('check', 2.6) : '') + esc(k.name) + '</button>'; }).join('') + '</div>' +
      '<label class="search ex-ksearch">' + I('search') + '<input id="exKq" type="search" placeholder="Search kinds, for example road tax" value="' + esc(st.q) + '" autocomplete="off"></label>';
    if (found) html += '<div class="ex-klist">' + (found.length ? found.map(kindRow).join('') : '<div class="empty small">No kind called “' + esc(q) + '”. Pick Other and say what it was in the note.</div>') + '</div>';
    else {
      if (st.all) {
        var grp = function (name, list) { return list.length ? '<div class="ex-kgrp">' + esc(name) + '</div>' + list.map(kindRow).join('') : ''; };
        html += '<div class="ex-klist">' + grp('Everyday', rest.filter(function (k) { return k.everyday; })) + grp('Car costs and other', rest.filter(function (k) { return !k.everyday && !k.business; })) + grp('Office and admin', rest.filter(function (k) { return k.business; })) + '</div>';
      }
      if (rest.length && !st.edit) html += '<button type="button" class="btn link ex-allk" id="exAllK">' + I(st.all ? 'back' : 'down', 2.2) + (st.all ? 'Show fewer kinds' : 'Show all kinds (' + rest.length + ' more)') + '</button>';
      else if (rest.length && st.edit) html += '<button type="button" class="btn link ex-allk" id="exAllK">' + (st.all ? 'Show fewer kinds' : 'Show all kinds (' + rest.length + ' more)') + '</button>';
    }
    return html;
  }
  function linesHtml() {
    if (!st.lines.length) return '<div class="ex-lines empty-l">' + (st.edit ? 'Choose what it was for.' : 'Nothing ticked yet. Tick every kind the money paid for; each gets its own amount.') + '</div>';
    return '<div class="ex-lines">' + st.lines.map(function (l) {
      var p = st.touched[l.kind] || String(l.amt).trim() ? amtProblem(l.amt) : '';
      return '<div class="ex-line' + (p ? ' bad' : '') + '" data-line="' + esc(l.kind) + '"><div class="ex-lrow"><button type="button" class="ex-lx" data-untick="' + esc(l.kind) + '" aria-label="Untick ' + esc(l.kind) + '">' + I('x', 2.4) + '</button><span class="ex-lname">' + esc(l.kind) + (l.auto ? '<small>From the receipt total</small>' : l.fixed ? '<small>Set in Settings</small>' : '') + '</span>' +
        (l.fixed ? '<span class="ex-lfix money">' + I('lock', 2) + rm(parseMoney(l.amt)) + '</span>' : '<label class="rmfield ex-lamt"><input class="inp' + (p ? ' bad' : '') + '" inputmode="decimal" autocomplete="off" data-amt="' + esc(l.kind) + '" value="' + esc(l.amt) + '" placeholder="0.00" aria-label="Amount of ' + esc(l.kind) + '"></label>') + '</div>' +
        (p ? '<span class="err">' + esc(p) + '</span>' : '') + '</div>';
    }).join('') + '<div id="exTot">' + totHtml() + '</div></div>' + (st.lines.length > 1 ? '<p class="hint">Each ticked kind is saved as its own expense. The day, car, booking, payment details and the receipt go on all of them.</p>' : '');
  }
  function totHtml() {
    var t = linesTotal(), out = '<div class="ex-tot"><span>' + (st.lines.length === 1 ? '1 expense' : st.lines.length + ' expenses') + '</span><b class="money">Total ' + rm(t) + '</b></div>';
    if (st.total != null && st.lines.length && !st.edit) {
      var complete = st.lines.every(function (l) { return !isNaN(parseMoney(l.amt)); }), diff = Math.round((t - st.total) * 100) / 100;
      out += '<div class="ex-check' + (complete && diff !== 0 ? ' off' : '') + '"><span>Receipt says <b class="money">' + rm(st.total) + '</b></span>' +
        (!complete ? '<span class="muted">Fill every amount</span>' : diff === 0 ? '<span class="ok">' + I('check', 2.6) + 'Adds up</span>' : '<span class="warn">' + I('warn', 2) + rm(Math.abs(diff)) + (diff < 0 ? ' short' : ' more than the receipt') + '</span>') + '</div>';
    }
    return out;
  }
  function dayHtml() {
    var t = exToday(), y = exAddDays(t, -1), other = st.day !== t && st.day !== y;
    return '<div class="ex-days"><button type="button" class="fchip' + (st.day === t ? ' on' : '') + '" data-day="' + t + '">Today<span class="n">' + esc(dShort(exDayDate(t))) + '</span></button>' +
      '<button type="button" class="fchip' + (st.day === y ? ' on' : '') + '" data-day="' + y + '">Yesterday<span class="n">' + esc(dShort(exDayDate(y))) + '</span></button>' +
      '<label class="fchip ex-datechip' + (other ? ' on' : '') + '">' + I('cal', 2) + '<span>' + (other ? esc(dLong(exDayDate(st.day))) : 'Other day') + '</span><input type="date" id="exDay" max="' + exAddDays(t, 1) + '" min="' + exAddDays(t, -3650) + '" value="' + esc(st.day) + '" aria-label="Choose the day"></label></div>' +
      (st.day > exAddDays(t, 1) ? '<span class="err">That day has not happened yet. Choose today or an earlier day.</span>' : st.day === exAddDays(t, 1) ? '<span class="hint">Tomorrow: only for a cost paid ahead, like a booked car wash.</span>' : '');
  }
  function linkHtml() {
    var c = car(st.car), b = st.booking ? bk(st.booking) : null, n = needs();
    var carBtn = '<div class="ex-pickrow"><button type="button" class="carfield ' + (c ? 'picked-car' : 'empty-car') + '" id="exCar">' + (c ? '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model) + (b && b.car === c.id ? ' · from the booking' : '') + '</span></span>' : I('car') + '<span class="grow">' + (n.car.length ? 'Choose the car' : 'Choose a car (optional)') + '</span>') + I('chev') + '</button>' + (c ? '<button type="button" class="iconbtn ex-clr" id="exCarX" aria-label="Clear the car">' + I('x', 2.2) + '</button>' : '') + '</div>';
    var bkBtn = '<div class="ex-pickrow"><button type="button" class="carfield ' + (b ? 'picked-car' : 'empty-car') + '" id="exBk">' + (b ? I('list') + '<span class="grow"><span class="pk-plate ex-bcode">' + esc(b.code) + '</span><span class="pk-sub">' + esc(cust(b.cust).name) + ' · ' + esc(dShort(b.start)) + ' to ' + esc(dShort(b.end)) + '</span></span>' : I('list') + '<span class="grow">' + (n.booking.length ? 'Choose the booking' : 'Choose a booking (optional)') + '</span>') + I('chev') + '</button>' + (b ? '<button type="button" class="iconbtn ex-clr" id="exBkX" aria-label="Clear the booking">' + I('x', 2.2) + '</button>' : '') + '</div>';
    return '<div class="field"><span>Car' + (n.car.length ? ' <em class="ex-req">needed for ' + esc(n.car.join(', ')) + '</em>' : '') + '</span>' + carBtn + '</div>' +
      '<div class="field"><span>Booking' + (n.booking.length ? ' <em class="ex-req">needed for ' + esc(n.booking.join(', ')) + '</em>' : '') + '</span>' + bkBtn + '<span class="hint">Picking a booking fills in its car.</span></div>';
  }
  function feeGroups() {
    if (st.edit || typeof Fees === 'undefined' || !Fees.claim || !Fees.amountFor) return [];
    var hf = B().handoverFees || [];
    return ['delivery', 'return', 'companion'].filter(function (g) { return hf.some(function (f) { return f.group === g && Fees.amountFor(f.kind, S.me) > 0; }); });
  }
  function feesHtml() {
    var gs = feeGroups(); if (!gs.length) return '';
    var b = st.booking ? bk(st.booking) : null, label = { delivery: 'My pick-up or delivery fee', return: 'My return or drop-off fee', companion: 'Companion fee (I came along)' };
    return '<div class="ex-fees"><div class="ex-kgrp">Handover fees (amount set in Settings)</div>' + gs.map(function (g) {
      var info = '', taken = false, amt = null;
      if (b) {
        if (g === 'companion') { taken = !Fees.companionOpen(b); info = taken ? 'Already recorded by you on this booking' : 'For coming along on the trip. Once per person.'; var ck = (B().handoverFees || []).filter(function (f) { return f.group === 'companion'; })[0]; amt = ck ? Fees.amountFor(ck.kind, S.me) : null; }
        else { var s = Fees.state(b, g); amt = s.amt; taken = !!s.taken; info = s.kind; if (s.taken) info = 'Already recorded ' + Fees.byText(s.taken); else if (!s.kind) info = 'No ' + g + ' trip on this booking'; }
      } else info = 'Pick the booking, then record it. Once per booking.';
      var mine = st.fees.filter(function (f) { return f.group === g && f.booking === st.booking; })[0];
      return '<button type="button" class="ex-fee' + (taken ? ' done' : '') + '" data-fee="' + g + '"' + (taken ? ' disabled' : '') + '><span class="ex-fee-ic">' + I(taken ? 'check' : 'key', 2.2) + '</span><span class="grow"><b>' + esc(label[g]) + '</b><small>' + esc(mine ? 'Recorded just now' : info) + '</small></span>' + (amt != null ? '<span class="money ex-fee-amt">' + rm(amt) + '</span>' : I('chev')) + '</button>';
    }).join('') + '</div>';
  }
  function footHtml() {
    var p = problems();
    return '<div class="ex-hintline' + (p.ok ? ' ok' : '') + '" id="exHint">' + (p.ok ? (st.edit ? 'Ready to save the changes.' : st.lines.length > 1 ? st.lines.length + ' expenses, ' + rm(linesTotal()) + ' in total.' : 'Ready to save.') : esc(p.text)) + '</div>' +
      (st.edit ? '<button type="button" class="btn" id="exSave"' + (p.ok ? '' : ' disabled') + '>' + I('check', 2.4) + 'Save changes</button>'
        : '<div class="btnrow"><button type="button" class="btn ghost" id="exAgain"' + (p.ok ? '' : ' disabled') + '>Save and add another</button><button type="button" class="btn" id="exSave"' + (p.ok ? '' : ' disabled') + '>' + I('check', 2.4) + 'Save</button></div>');
  }
  function bodyHtml() {
    var head = '<div class="sheet-head"><div class="grow"><h3>' + (st.edit ? 'Change expense' : 'Add expense') + '</h3>' + (st.saved ? '<p class="lead">' + st.saved + ' saved so far. Add the next one.</p>' : st.edit ? '<p class="lead">' + esc(st.edit.kind) + ' · ' + esc(dShort(st.edit.at)) + '</p>' : '') + '</div><button class="iconbtn" type="button" id="exClose" aria-label="Close">' + I('x', 2.2) + '</button></div>';
    return head + '<div id="exRc">' + rcHtml() + '</div>' +
      '<div class="ex-sec"><div class="ex-lbl">What was it for?</div><div id="exKinds">' + kindsHtml() + '</div><div id="exLines">' + linesHtml() + '</div></div>' +
      (feeGroups().length ? '<div id="exFees">' + feesHtml() + '</div>' : '') +
      '<div class="ex-sec"><div class="ex-lbl">Day</div><div id="exDayBox">' + dayHtml() + '</div></div>' +
      '<div class="ex-sec" id="exLink">' + linkHtml() + '</div>' +
      '<div class="ex-sec"><div class="ex-lbl">Paid with</div><div class="seg ex-paid" id="exPaid">' + EX_PAID.map(function (p) { return '<button type="button" data-p="' + p + '"' + (st.paidWith === p ? ' class="on"' : '') + '>' + p + '</button>'; }).join('') + '</div>' +
      '<label class="field"><span>Paid to (optional)</span><input class="inp" id="exTo" maxlength="' + EX_MAX_PAYEE + '" placeholder="Shop, station, driver or company" value="' + esc(st.paidTo) + '" autocomplete="off"></label>' +
      '<label class="field"><span>Note (optional)</span><textarea class="inp ex-note-in" id="exNote" maxlength="' + EX_MAX_NOTE + '" rows="2" placeholder="Anything that helps later, for example why it was needed">' + esc(st.note) + '</textarea><span class="hint ex-count" id="exNoteN">' + st.note.length + ' / ' + EX_MAX_NOTE + '</span></label></div>' +
      '<div class="sheet-foot ex-foot" id="exFoot">' + footHtml() + '</div>';
  }
  function redraw(part) {
    if (!sh || !document.body.contains(sh)) return;
    var map = { rc: ['#exRc', rcHtml], kinds: ['#exKinds', kindsHtml], lines: ['#exLines', linesHtml], day: ['#exDayBox', dayHtml], link: ['#exLink', linkHtml], fees: ['#exFees', feesHtml], foot: ['#exFoot', footHtml], tot: ['#exTot', totHtml] };
    var parts = part ? [].concat(part) : Object.keys(map), foot = !!part && parts.indexOf('foot') >= 0;
    if (foot) parts = parts.filter(function (p) { return p !== 'foot'; });
    parts.forEach(function (p) { var m = map[p], el = m && $(m[0], sh); if (el) el.innerHTML = m[1](); });
    wire();
    if (foot) updateFoot();
  }
  /* the footer is updated in place, so a tap on Save that blurs an amount box is not lost */
  function updateFoot() {
    var f = sh && $('#exFoot', sh); if (!f) return;
    var p = problems(), h = $('#exHint', f);
    if (!h) { f.innerHTML = footHtml(); wire(); return; }
    h.className = 'ex-hintline' + (p.ok ? ' ok' : '');
    h.textContent = p.ok ? (st.edit ? 'Ready to save the changes.' : st.lines.length > 1 ? st.lines.length + ' expenses, ' + rm(linesTotal()) + ' in total.' : 'Ready to save.') : p.text;
    $$('#exSave, #exAgain', f).forEach(function (b) { b.disabled = !p.ok || !!st.busy; });
  }
  function wireOnce() {
    /* text fields keep focus: they are wired once */
    var to = $('#exTo', sh), nt = $('#exNote', sh);
    to.oninput = function () { st.paidTo = to.value; redraw('foot'); };
    nt.oninput = function () { st.note = nt.value; $('#exNoteN', sh).textContent = nt.value.length + ' / ' + EX_MAX_NOTE; redraw('foot'); };
    $('#exClose', sh).onclick = function () { tryClose(); };
    $$('#exPaid button', sh).forEach(function (b) { b.onclick = function () { st.paidWith = b.dataset.p; $$('#exPaid button', sh).forEach(function (x) { x.classList.toggle('on', x === b); }); redraw('foot'); }; });
    sh.addEventListener('paste', function (ev) { var it = ev.clipboardData && Array.prototype.slice.call(ev.clipboardData.items || []).filter(function (i) { return /^image\//.test(i.type); })[0]; if (!it) return; ev.preventDefault(); Media.fromFile(it.getAsFile(), { maxPx: 1100, quality: .62 }).then(setReceipt, function () { say('That picture could not be read. Try another.'); }); });
  }
  function wire() {
    var q = function (s) { return $(s, sh); };
    var cam = q('#exRcCam'); if (cam) cam.onclick = function () { pickPhoto({ capture: 'environment' }); };
    var fi = q('#exRcFile'); if (fi) fi.onclick = function () { pickPhoto({ capture: false, accept: 'image/*,application/pdf' }); };
    var ps = q('#exRcPaste'); if (ps) ps.onclick = pasteReceipt;
    var dm = q('#exRcDemo'); if (dm) dm.onclick = function () { var lb = ['Petrol station', 'Car wash', 'Toll receipt', 'Hardware shop', 'Bank transfer slip'][Math.floor(Math.random() * 5)]; Media.sample('receipt', lb).then(function (res) { res.name = lb; setReceipt(res); }); };
    var nw = q('#exRcNew'); if (nw) nw.onclick = function () { pickPhoto({ capture: 'environment' }); };
    var dl = q('#exRcDel'); if (dl) dl.onclick = function () { if (st.receipt) { st.receipt = null; st.reading = null; st.total = null; st.dupe = null; readTicket++; st.lines.forEach(function (l) { if (l.auto) { l.amt = ''; l.auto = false; } }); } else st.removeRc = true; redraw(['rc', 'lines', 'foot']); };
    var big = q('#exRcBig'); if (big) big.onclick = function () { exViewReceipt(st.receipt ? st.receipt.dataUrl : exReceipt(st.edit), 'Receipt'); };
    $$('[data-k]', q('#exKinds')).forEach(function (b) { b.onclick = function () { toggle(b.dataset.k); }; });
    var kq = q('#exKq'); if (kq) kq.oninput = function () { st.q = kq.value; var pos = kq.selectionStart; redraw('kinds'); var k2 = q('#exKq'); if (k2) { k2.focus(); try { k2.setSelectionRange(pos, pos); } catch (e) {} } };
    var ak = q('#exAllK'); if (ak) ak.onclick = function () { st.all = !st.all; redraw('kinds'); };
    $$('[data-untick]', sh).forEach(function (b) { b.onclick = function () { toggle(b.dataset.untick); }; });
    $$('[data-amt]', sh).forEach(function (inp) {
      inp.oninput = function () { var l = lineOf(inp.dataset.amt); if (!l) return; l.amt = inp.value; l.auto = false; if (fillRemainder()) syncAmts(inp); refreshLineErr(inp, false); var t = q('#exTot'); if (t) t.innerHTML = totHtml(); redraw('foot'); };
      inp.onblur = function () { var l = lineOf(inp.dataset.amt); if (!l) return; st.touched[l.kind] = true; var v = parseMoney(l.amt); if (!isNaN(v)) { l.amt = money2(v); inp.value = l.amt; } refreshLineErr(inp, true); redraw(['tot', 'foot']); };
    });
    $$('[data-day]', sh).forEach(function (b) { b.onclick = function () { st.day = b.dataset.day; redraw(['day', 'foot']); }; });
    var dy = q('#exDay'); if (dy) dy.onchange = function () { if (dy.value) { st.day = dy.value; redraw(['day', 'foot']); } };
    var cb = q('#exCar'); if (cb) cb.onclick = function () { Pickers.car({ title: 'Which car was it for?', selected: st.car, onPick: function (c) { st.car = c.id; if (st.booking && (bk(st.booking) || {}).car !== c.id) { st.booking = null; say('The booking was cleared: it is for another car'); } redraw(['link', 'fees', 'foot']); } }); };
    var cx = q('#exCarX'); if (cx) cx.onclick = function () { st.car = null; redraw(['link', 'foot']); };
    var bb = q('#exBk'); if (bb) bb.onclick = function () { Pickers.booking({ title: 'Which booking was it for?', selected: st.booking, onPick: function (b) { st.booking = b.id; st.car = b.car; redraw(['link', 'fees', 'foot']); } }); };
    var bx = q('#exBkX'); if (bx) bx.onclick = function () { st.booking = null; redraw(['link', 'fees', 'foot']); };
    $$('[data-fee]', sh).forEach(function (b) { b.onclick = function () { claimFee(b.dataset.fee); }; });
    var sv = q('#exSave'); if (sv) sv.onclick = function () { doSave(false); };
    var ag = q('#exAgain'); if (ag) ag.onclick = function () { doSave(true); };
  }
  function refreshLineErr(inp, force) {
    var l = lineOf(inp.dataset.amt), row = inp.closest('.ex-line'); if (!l || !row) return;
    var p = (force || String(l.amt).trim()) ? amtProblem(l.amt) : '';
    row.classList.toggle('bad', !!p); inp.classList.toggle('bad', !!p);
    var er = $('.err', row); if (p) { if (!er) { er = document.createElement('span'); er.className = 'err'; row.appendChild(er); } er.textContent = p; } else if (er) er.remove();
    var small = $('.ex-lname small', row); if (small && !l.auto && /receipt/.test(small.textContent)) small.remove();
  }
  function syncAmts(except) { $$('[data-amt]', sh).forEach(function (i) { if (i === except) return; var l = lineOf(i.dataset.amt); if (l && i.value !== l.amt) { i.value = l.amt; var row = i.closest('.ex-line'), nm = row && $('.ex-lname', row); if (nm && l.auto && !$('small', nm)) nm.insertAdjacentHTML('beforeend', '<small>From the receipt total</small>'); } }); }

  /* ---------- actions ---------- */
  function toggle(name) {
    var l = lineOf(name), k = exKind(name);
    if (l) st.lines = st.lines.filter(function (x) { return x !== l; });
    else {
      if (st.lines.length >= EX_MAX_LINES) { say('Tick at most ' + EX_MAX_LINES + ' kinds in one go.'); return; }
      if (st.edit) st.lines = [];
      var nl = k && k.fixed ? { kind: name, amt: money2(k.fixed), fixed: true } : { kind: name, amt: st.edit && st.edit.kind !== name ? '' : st.edit ? money2(st.edit.amt) : '' };
      st.lines.push(nl);
      fillRemainder();
      if (k && k.needsCar && !st.car && !st.booking) later(function () { var el = $('#exCar', sh); if (el) el.classList.add('ex-pulse'); }, 50);
    }
    redraw(['kinds', 'lines', 'link', 'foot']);
    if (!l) later(function () { var inp = $('[data-amt="' + name.replace(/"/g, '\\"') + '"]', sh); if (inp && !inp.value) try { inp.focus({ preventScroll: false }); } catch (e) {} }, 60);
  }
  function pickPhoto(o) {
    Media.photo(Object.assign({ maxPx: 1100, quality: .62 }, o)).then(setReceipt, function (err) { if (err !== 'cancel') say('That file could not be read. Try a photo or a PDF.'); });
  }
  function pasteReceipt() {
    if (!navigator.clipboard || !navigator.clipboard.read) { say('Press and hold in the note box and choose Paste, or press Ctrl+V.'); return; }
    navigator.clipboard.read().then(function (items) {
      var it = null, type = ''; items.forEach(function (c) { (c.types || []).forEach(function (t) { if (!it && /^image\//.test(t)) { it = c; type = t; } }); });
      if (!it) { say('There is no picture on the clipboard. Copy the receipt or take a screenshot first, then paste.'); return; }
      return it.getType(type).then(function (blob) { return Media.fromFile(blob, { maxPx: 1100, quality: .62 }); }).then(setReceipt);
    }).catch(function () { say('This browser did not let the app read the clipboard. Press Ctrl+V in the form instead.'); });
  }
  function setReceipt(res) {
    if (!st) return;
    st.receipt = { dataUrl: res.dataUrl, hash: res.hash, note: res.note && res.note !== 'Sample picture (demo)' ? res.note : res.note, name: res.name || '' };
    st.removeRc = false;
    var same = (S.expenses || []).filter(function (e) { return !e.voided && e.receiptHash && e.receiptHash === res.hash; })[0];
    st.dupe = same ? 'This receipt looks like one saved on ' + dShort(same.at) + ' (' + same.kind + ' ' + rm(same.amt) + '). Check it is not the same one.' : null;
    if (st.edit) { st.reading = null; redraw(['rc', 'foot']); return; }
    st.reading = { busy: true, text: 'Reading the receipt...' };
    redraw(['rc', 'foot']);
    var ticket = ++readTicket;
    Media.readSlip(res.dataUrl, {}).then(function (rd) {
      if (!st || ticket !== readTicket || !sh || !document.body.contains(sh)) return;
      var read = [];
      if (rd.amount > 0) { st.total = Math.round(rd.amount * 100) / 100; read.push(rm(st.total)); fillRemainder(); }
      var t = exToday();
      if (rd.date && rd.date <= exAddDays(t, 1) && rd.date >= exAddDays(t, -3650)) { st.day = rd.date; read.push(rd.date === t ? 'today' : rd.date === exAddDays(t, -1) ? 'yesterday' : dLong(exDayDate(rd.date))); }
      /* a bank transfer slip says how it was paid */
      var slip = /slip|transfer|bank|duitnow/i.test(st.receipt.name || '');
      if (slip) { st.paidWith = 'Bank transfer'; read.push('paid by bank transfer'); $$('#exPaid button', sh).forEach(function (x) { x.classList.toggle('on', x.dataset.p === 'Bank transfer'); }); }
      st.reading = read.length ? { tone: 'ok', text: 'Read from the receipt: ' + read.join(', ') + '. Check it against the receipt.' } : { tone: 'info', text: 'Nothing could be read from this receipt. Type the amounts and the day in.' };
      redraw(['rc', 'lines', 'day', 'foot']);
    });
  }
  function claimFee(group) {
    var go = function (b) {
      later(function () {
        Fees.claim(b.id, group, function () { st.fees.push({ group: group, booking: b.id }); redraw(['fees']); });
      }, 80);
    };
    var b = st.booking ? bk(st.booking) : null;
    if (b) go(b);
    else Pickers.booking({ title: 'Which booking is the fee for?', filter: function (x) { return x.bookingStatus !== 'Pending'; }, onPick: function (x) { st.booking = x.id; st.car = x.car; redraw(['link', 'fees', 'foot']); go(x); } });
  }
  function atFor(day) {
    var t = exToday(), n = new Date();
    if (day === t) return n.toISOString();
    var d = exDayDate(day); if (st.edit && toLocalInput(st.edit.at) !== day) { var o = new Date(st.edit.at); d.setHours(o.getHours(), o.getMinutes()); } else d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }
  function doSave(another) {
    if (!st || st.busy) return;
    var p = problems(); if (!p.ok) { say(p.text); return; }
    st.busy = true;
    $$('#exSave, #exAgain', sh).forEach(function (b) { b.disabled = true; });
    S.expenses = S.expenses || [];
    var now = new Date().toISOString();
    if (st.edit) return saveEdit(now);
    /* the same entry sent twice (double tap, slow phone) is saved once */
    if (S.expenses.some(function (e) { return e.clientKey === st.key; })) { st.busy = false; say('That one was already saved a moment ago, so it was not added twice.'); return; }
    var at = atFor(st.day), saved = [], rc = st.receipt;
    st.lines.forEach(function (l, i) {
      var e = { id: uid(), kind: l.kind, amt: parseMoney(l.amt), at: at, car: st.car || null, booking: st.booking || null, paidWith: st.paidWith, paidTo: st.paidTo.trim(), note: st.note.trim(),
        receipt: rc && i === 0 ? rc.dataUrl : null, receiptOf: rc && i > 0 ? saved[0].id : null, receiptHash: rc && i === 0 ? rc.hash : null,
        by: S.me, created: now, clientKey: st.key, agentFee: false, group: null, changedBy: null, changedAt: null, voided: false };
      saved.push(e);
    });
    saved.slice().reverse().forEach(function (e) { S.expenses.unshift(e); });
    var total = Math.round(saved.reduce(function (s, e) { return s + e.amt; }, 0) * 100) / 100;
    var what = saved.map(function (e) { return e.kind + ' ' + rm(e.amt); }).join(', '), b = st.booking ? bk(st.booking) : null;
    if (b) bLog(b, 'Expense recorded: ' + what); else audit('Expense recorded: ' + what, { car: st.car, link: '#expense/' + saved[0].id });
    save();
    var msg = saved.length > 1 ? saved.length + ' expenses saved (' + rm(total) + ' in total)' : 'Expense saved';
    var undo = function () { var ids = saved.map(function (e) { return e.id; }); S.expenses = S.expenses.filter(function (e) { return ids.indexOf(e.id) < 0; }); audit('Expense taken back right after saving: ' + what, { car: saved[0].car }); save(); if (/^(expenses|expense|home|mymoney)$/.test(route().name)) render(); say(saved.length > 1 ? 'Expenses taken back' : 'Expense taken back'); };
    if (another) {
      st = blank({ day: st.day, car: st.car, paidWith: st.paidWith, saved: st.saved + saved.length, fees: st.fees });
      st.base = snap();
      readTicket++;
      sh.innerHTML = '<div class="grab"></div>' + bodyHtml(); wireOnce(); wire(); sh.scrollTop = 0;
      undoSnack(msg + '. Add the next one.', undo);
      if (/^(expenses|home)$/.test(route().name)) render(false, true);
    } else {
      st.closing = true; closeSheet();
      undoSnack(msg, undo);
      if (/^(expenses|home|mymoney)$/.test(route().name)) render(false, true);
    }
  }
  function saveEdit(now) {
    var e = st.edit, l = st.lines[0], ch = {}, set = function (f, v) { var o = e[f] == null ? null : e[f]; if (String(o) !== String(v == null ? null : v)) { ch[f] = [o, v]; e[f] = v; } };
    set('kind', l.kind); set('amt', parseMoney(l.amt));
    if (toLocalInput(e.at) !== st.day) set('at', atFor(st.day));
    set('car', st.car || null); set('booking', st.booking || null); set('paidWith', st.paidWith); set('paidTo', st.paidTo.trim()); set('note', st.note.trim());
    if (st.receipt) { if (e.receiptOf) e.receiptOf = null; e.receipt = st.receipt.dataUrl; e.receiptHash = st.receipt.hash; ch.receipt = ['', 'new picture']; }
    else if (st.removeRc) { e.receipt = null; e.receiptOf = null; e.receiptHash = null; ch.receipt = ['picture', 'removed']; }
    e.changedBy = S.me; e.changedAt = now;
    var b = e.booking ? bk(e.booking) : null, text = 'Expense changed: ' + e.kind + ' ' + rm(e.amt) + ' (' + Object.keys(ch).map(function (k) { return { amt: 'amount', at: 'day', paidWith: 'paid with', paidTo: 'paid to' }[k] || k; }).join(', ') + ')';
    if (b) bLog(b, text, ch); else audit(text, { car: e.car, changes: ch, link: '#expense/' + e.id });
    save(); st.closing = true; closeSheet(); render(false, true); say('Changes saved');
  }
  function tryClose() { if (st && dirty() && !st.closing) askLeave(); else { if (st) st.closing = true; closeSheet(); } }
  function askLeave() {
    return confirm({ icon: 'warn', title: 'Leave without saving?', text: 'What you typed on this expense will be lost.', ok: 'Leave', cancel: 'Keep editing', primary: 'cancel' }).then(function (leave) {
      if (leave) { st.closing = true; if (SHEETS.length && SHEETS[SHEETS.length - 1].sh === sh) closeSheet(); }
      return leave;
    });
  }
  function open(keepSt) {
    var hash = location.hash;
    sh = sheet('<div id="exBody"></div>', null, { full: true, cls: 'ex-sheet', onClose: function () {
      var mine = st;
      if (!mine || mine.closing || location.hash !== hash || !dirty()) { sh = null; return; }
      /* swiped down, tapped outside or pressed Back with something typed: ask, and bring the sheet back on Keep editing */
      sh = null;
      setTimeout(function () {
        confirm({ icon: 'warn', title: 'Leave without saving?', text: 'What you typed on this expense will be lost.', ok: 'Leave', cancel: 'Keep editing', primary: 'cancel' }).then(function (leave) {
          if (st !== mine) return;
          if (leave) { mine.closing = true; return; }
          setTimeout(function () { if (st === mine && !SHEETS.length) open(true); }, 320);
        });
      }, 0);
    } });
    sh.innerHTML = '<div class="grab"></div>' + bodyHtml();
    wireOnce(); wire();
    void keepSt;
    return sh;
  }

  /* ---------- the API ---------- */
  function add(opts) {
    opts = opts || {};
    if (!can('expenses.add')) { sheet(sheetHead('Add expense') + noAccess('expenses.add')); return; }
    st = blank();
    if (opts.booking && bk(opts.booking)) { st.booking = opts.booking; st.car = bk(opts.booking).car; }
    if (opts.car && car(opts.car)) st.car = opts.car;
    if (opts.kind && exKind(opts.kind)) { var k = exKind(opts.kind); if (!k.business || can('expenses.add_business')) st.lines.push(k.fixed ? { kind: k.name, amt: money2(k.fixed), fixed: true } : { kind: k.name, amt: '' }); }
    st.base = snap();
    open();
    /* receipt first: the camera opens straight away when this came from a tap */
    if (opts.camera !== false && navigator.userActivation && navigator.userActivation.isActive) pickPhoto({ capture: 'environment' });
  }
  function edit(id) {
    var e = byId(S.expenses, id); if (!e) return;
    var es = exEditState(e); if (!es.can) { say(es.text || 'You cannot change this expense'); return; }
    if (e.agentFee) { say('A handover fee comes from the rate in Settings. Delete it and record it again if it is wrong.'); return; }
    st = blank({ day: toLocalInput(e.at), car: e.car, paidWith: e.paidWith || 'Cash' });
    st.edit = e; st.booking = e.booking || null; st.paidTo = e.paidTo || ''; st.note = e.note || '';
    var k = exKind(e.kind);
    st.lines = [k && k.fixed ? { kind: e.kind, amt: money2(e.amt), fixed: +k.fixed === +e.amt } : { kind: e.kind, amt: money2(e.amt) }];
    open();
  }
  VIEW_STATE.push(function () { st = null; sh = null; readTicket++; });
  return { add: add, edit: edit, rows: exRows, sum: exSum, editState: exEditState, receipt: exReceipt, isOpen: function () { return !!(sh && document.body.contains(sh)); } };
})();

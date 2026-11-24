/* ---------------- REPORTS (M8) ----------------
   #reports   simple reports on the phone (reports.view): period chips, five report cards with key figures first and the
   top 8 rows, 'Share PDF' (reports.export_excel), amounts hidden without reports.see_amounts.
   The rules are the web reports' rules:
   - Bookings and income: Confirmed to Completed bookings only (Pending and Cancelled never count). Each booking is cut into
     24-hour blocks from pick-up; a block counts in the period it starts in. Rental income = (rent - discount) spread evenly
     over the blocks; damage coverage spread the same way; delivery fee and other charges in the first block, return fee in
     the last. The security deposit is never income (shown as Deposits held).
   - Money in: every payment received in the period, void ones left out, payments made from a deposit already held left out.
   - Money in and out: money in, against expenses (not money handed to staff) and deposits given back.
   - Profit by car: income as above against what each car cost (running costs, service jobs, papers, instalments).
   - Expenses by kind: recorded expenses + finished service jobs + car papers (Expenses.rows). */

var RP_ST = ['Confirmed', 'Agreement Sent', 'Agreement Signed', 'Car Delivered', 'Car Returned', 'Completed'];
var RP_PER = [['this', 'This month'], ['last', 'Last month'], ['year', 'This year'], ['custom', 'Custom']];
var RP_TOP = 8;
var RPV = null;
function rpReset() { RPV = { per: 'this', from: '', to: '', open: {} }; }
rpReset();
VIEW_STATE.push(rpReset);

function rpParse(s) { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); return d.getMonth() === +p[1] - 1 ? d : null; }
function rpDay(d) { var y = d.getFullYear() !== new Date().getFullYear(); return d.getDate() + ' ' + MO[d.getMonth()] + (y ? ' ' + d.getFullYear() : ''); }
/* the period: {from, to (last day), end (day after), days, label} or {err} */
function rpRange(v) {
  var n = new Date(), from, to;
  if (v.per === 'this') { from = new Date(n.getFullYear(), n.getMonth(), 1); to = new Date(n.getFullYear(), n.getMonth() + 1, 0); }
  else if (v.per === 'last') { from = new Date(n.getFullYear(), n.getMonth() - 1, 1); to = new Date(n.getFullYear(), n.getMonth(), 0); }
  else if (v.per === 'year') { from = new Date(n.getFullYear(), 0, 1); to = new Date(n.getFullYear(), 11, 31); }
  else { from = rpParse(v.from); to = rpParse(v.to); }
  if (!from || !to) return { err: 'Choose a start and an end date.' };
  if (to < from) return { err: 'The end date is before the start date.' };
  var days = Math.round((to - from) / DAY) + 1;
  if (days > 366) return { err: 'Choose a period of at most 366 days.' };
  return { from: from, to: to, end: new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1), days: days, label: 'From ' + rpDay(from) + ' to ' + rpDay(to) + ', ' + days + ' day' + (days === 1 ? '' : 's') };
}
function rpSum(list, f) { return Math.round(list.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0) * 100) / 100; }
function rpPct(v) { return Math.round(v * 100) + '%'; }
function rpCarName(c) { return c ? c.plate + ' · ' + c.make + ' ' + c.model : 'Not tied to a car'; }

/* ---------- the numbers ---------- */
function rpIncome(r) {
  var list = [], t0 = r.from.getTime(), t1 = r.end.getTime();
  S.bookings.forEach(function (b) {
    if (RP_ST.indexOf(b.bookingStatus) < 0) return;
    var s = new Date(b.start).getTime(), e = new Date(b.end).getTime(); if (!(s < t1 && e > t0)) return;
    var m = calcBooking(b), n = Math.max(1, m.coverDays), ks = [];
    for (var k = 0; k < n; k++) { var bs = s + k * DAY; if (bs >= t0 && bs < t1) ks.push(k); }
    if (!ks.length) return;
    var per = (m.rent - m.discount) / n, first = ks[0] === 0, last = ks.indexOf(n - 1) >= 0;
    var it = { b: b, n: ks.length, rental: per * ks.length, deliv: first ? m.delivery : 0, ret: last ? m['return'] : 0, dmg: m.coverTotal / n * ks.length, other: first ? m.others : 0, dep: m.deposit };
    it.total = it.rental + it.deliv + it.ret + it.dmg + it.other; list.push(it);
  });
  var tot = { n: list.length }; ['rental', 'deliv', 'ret', 'dmg', 'other', 'total', 'dep'].forEach(function (k) { tot[k] = rpSum(list, function (it) { return it[k]; }); });
  tot.days = rpSum(list, function (it) { return it.n; });
  var cars = S.cars.filter(function (c) { return c.status !== 'sold' || list.some(function (it) { return it.b.car === c.id; }); });
  var byCar = cars.map(function (c) { var l = list.filter(function (it) { return it.b.car === c.id; }); return { car: c, n: l.length, days: Math.min(r.days, rpSum(l, function (it) { return it.n; })), total: rpSum(l, function (it) { return it.total; }) }; });
  tot.util = cars.length ? rpSum(byCar, function (x) { return x.days; }) / (cars.length * r.days) : 0;
  return { list: list, tot: tot, byCar: byCar, cars: cars };
}
function rpPayments(r) {
  var list = [], voided = 0, fromDep = 0;
  S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) {
    var at = new Date(p.at); if (at < r.from || at >= r.end) return;
    if (p.voided) { voided++; return; }
    if (p.method === 'Deposit adjustment') { fromDep++; return; }
    list.push({ p: p, b: b, at: at, amt: payTotal(p), dep: (p.items || []).reduce(function (s, it) { return s + (it.kind === 'Security deposit' ? +it.amt || 0 : 0); }, 0) });
  }); });
  list.sort(function (a, b) { return b.at - a.at; });
  return { list: list, voided: voided, fromDep: fromDep, total: rpSum(list, function (x) { return x.amt; }), dep: rpSum(list, function (x) { return x.dep; }), cash: rpSum(list.filter(function (x) { return x.p.method === 'Cash'; }), function (x) { return x.amt; }) };
}
function rpHideHP() { return !can('cars.see_instalment'); }
function rpInOut(r) {
  var M = rpPayments(r), days = {}, now = Date.now(), hide = rpHideHP();
  var day = function (at) { var k = toLocalInput(at); return days[k] = days[k] || { k: k, at: sod(at), inn: 0, out: 0, n: 0 }; };
  M.list.forEach(function (x) { var d = day(x.at); d.inn += x.amt; d.n++; });
  var ex = (S.expenses || []).filter(function (e) { var at = new Date(e.at); return !e.voided && !e.toStaff && at >= r.from && at < r.end && at.getTime() <= now && !(hide && e.kind === 'Hire purchase'); });
  var rf = (S.refunds || []).filter(function (f) { var at = new Date(f.at); return !f.voided && at >= r.from && at < r.end; });
  ex.forEach(function (e) { var d = day(e.at); d.out += +e.amt || 0; d.n++; });
  rf.forEach(function (f) { var d = day(f.at); d.out += +f.amt || 0; d.n++; });
  var list = Object.keys(days).map(function (k) { var d = days[k]; d.net = d.inn - d.out; return d; }).sort(function (a, b) { return b.at - a.at; });
  var exT = rpSum(ex, function (e) { return +e.amt || 0; }), rfT = rpSum(rf, function (f) { return +f.amt || 0; });
  return { list: list, inn: M.total, out: rpSum([exT, rfT]), ex: exT, rf: rfT, nPay: M.list.length, nEx: ex.length, nRf: rf.length, hide: hide };
}
function rpProfit(r) {
  var BI = rpIncome(r), rows = Expenses.rows(r.from, r.end, { all: true });
  var res = S.cars.map(function (c) {
    var inc = (BI.byCar.filter(function (x) { return x.car === c; })[0] || {}).total || 0, ex = rows.filter(function (x) { return x.car === c.id && !x.toStaff; });
    var part = function (f) { return rpSum(ex.filter(f), function (x) { return x.amt; }); };
    var run = part(function (x) { return x.src === 'recorded' && x.kind !== 'Hire purchase'; }), job = part(function (x) { return x.src === 'job'; }), pap = part(function (x) { return x.src === 'paper'; }), inst = part(function (x) { return x.src === 'recorded' && x.kind === 'Hire purchase'; });
    var cost = rpSum([run, job, pap, inst]);
    return { car: c, inc: inc, run: run, job: job, pap: pap, inst: inst, cost: cost, profit: inc - cost };
  }).filter(function (x) { return x.inc || x.cost; }).sort(function (a, b) { return b.profit - a.profit; });
  var company = rows.filter(function (x) { return !x.car && !x.toStaff; });
  var t = { inc: rpSum(res, function (x) { return x.inc; }), cost: rpSum(res, function (x) { return x.cost; }), company: rpSum(company, function (x) { return x.amt; }) };
  t.profit = t.inc - t.cost; t.after = t.profit - t.company;
  return { list: res, t: t, companyN: company.length };
}
function rpExpenses(r) {
  var rows = Expenses.rows(r.from, r.end, { all: true }).filter(function (x) { return !x.toStaff; });
  var g = {}; rows.forEach(function (x) { var k = x.src === 'job' ? 'Service and repair jobs' : x.src === 'paper' ? 'Road tax, insurance and other papers' : x.kind; g[k] = g[k] || { k: k, n: 0, v: 0 }; g[k].n++; g[k].v += x.amt; });
  var list = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.v - a.v; });
  var bs = function (s) { return rpSum(rows.filter(function (x) { return x.src === s; }), function (x) { return x.amt; }); };
  return { list: list, total: rpSum(rows, function (x) { return x.amt; }), n: rows.length, rec: bs('recorded'), job: bs('job'), pap: bs('paper'), withRc: rows.filter(function (x) { return x.receipt; }).length };
}

/* ---------- report models: {id, title, icon, desc, kpis[{l, v (number), t:'money'|'int'|'pct', note, hero, split}], rows[{t1, t2, v, t, tone}], rowsTitle, totalRow, notes[]} ---------- */
function rpModels(r) {
  var out = [];
  var I1 = rpIncome(r), t = I1.tot;
  out.push({ id: 'income', title: 'Bookings and income', icon: 'list', desc: 'Income from bookings, spread over the days of each rental.',
    kpis: [{ l: 'Total income', v: t.total, t: 'money', hero: true, note: t.n + ' booking' + (t.n === 1 ? '' : 's'), split: [['Rental', t.rental], ['Delivery fee', t.deliv], ['Return fee', t.ret], ['Damage coverage', t.dmg]].concat(t.other ? [['Other charges', t.other]] : []) },
      { l: 'Days booked', v: t.days, t: 'int', note: 'Utilisation ' + rpPct(t.util) }, { l: 'Average per booking', v: t.n ? t.total / t.n : 0, t: 'money' }, { l: 'Deposits held', v: t.dep, t: 'money', note: 'Not income' }, { l: 'Cars', v: I1.cars.length, t: 'int', note: 'In the fleet' }],
    rowsTitle: 'Income by car', rows: I1.byCar.filter(function (x) { return x.n; }).sort(function (a, b) { return b.total - a.total; }).map(function (x) { return { t1: rpCarName(x.car), t2: x.n + ' booking' + (x.n === 1 ? '' : 's') + ' · ' + x.days + ' day' + (x.days === 1 ? '' : 's') + ' · ' + rpPct(x.days / r.days) + ' used', v: x.total, link: '#car/' + x.car.id }; }),
    totalRow: { l: 'Total income', v: t.total },
    notes: ['Rental income = rent minus any discount, spread evenly over the 24-hour blocks of the booking (the first block starts at pick-up). Damage coverage is spread the same way.', 'The delivery fee and other charges count in the period of the first block, the return fee in the period of the last block.', 'The security deposit is never income: it is held and given back, so it is shown apart as Deposits held.', 'Pending and cancelled bookings are never counted as income.'] });
  var M = rpPayments(r);
  out.push({ id: 'money', title: 'Money in', icon: 'cash', desc: 'Every payment received in the period, newest first.',
    kpis: [{ l: 'Money in', v: M.total, t: 'money', hero: true, note: M.list.length + ' payment' + (M.list.length === 1 ? '' : 's'), split: [['Income', M.total - M.dep], ['Deposits received', M.dep], ['Taken in cash', M.cash]] }, { l: 'Income', v: M.total - M.dep, t: 'money', note: 'Rental and charges' }, { l: 'Deposits received', v: M.dep, t: 'money', note: 'Held, not income' }, { l: 'Void payments', v: M.voided, t: 'int', note: 'Left out' }],
    rowsTitle: 'Payments', rows: M.list.map(function (x) { return { t1: x.b.code + ' · ' + cust(x.b.cust).name, t2: dShort(x.at) + ', ' + hm(x.at) + ' · ' + (x.p.items || []).map(function (i) { return i.kind; }).join(', ') + ' · ' + x.p.method, v: x.amt, link: '#booking/' + x.b.id }; }),
    totalRow: { l: 'Total money in', v: M.total },
    notes: ['Void payments are left out' + (M.voided ? ' (' + M.voided + ' in this period)' : '') + '. Payments made from a deposit already held are left out too' + (M.fromDep ? ' (' + M.fromDep + ')' : '') + ': no money came in.', 'Payments on Pending or Cancelled bookings are listed, because the money came in. Deposit refunds are not listed here.'] });
  var IO = rpInOut(r);
  out.push({ id: 'inout', title: 'Money in and out', icon: 'activity', desc: 'What came in and what went out, day by day.',
    kpis: [{ l: 'Net', v: IO.inn - IO.out, t: 'money', hero: true, signed: true, note: 'Money in minus money out', split: [['Money in', IO.inn], ['Expenses', IO.ex], ['Deposits returned', IO.rf]] }, { l: 'Money in', v: IO.inn, t: 'money', note: IO.nPay + ' payment' + (IO.nPay === 1 ? '' : 's') }, { l: 'Money out', v: IO.out, t: 'money', note: IO.nEx + ' expense' + (IO.nEx === 1 ? '' : 's') + ', ' + IO.nRf + ' refund' + (IO.nRf === 1 ? '' : 's') }],
    rowsTitle: 'By day', rows: IO.list.map(function (d) { return { t1: dLong(d.at), t2: 'In ' + rm(d.inn) + ' · Out ' + rm(d.out), t2money: true, v: d.net, signed: true }; }),
    totalRow: { l: 'Net', v: IO.inn - IO.out, signed: true },
    notes: ['Money in = every payment received (void ones and payments from a deposit left out). Money out = every expense and every deposit given back.', 'Cash banked in and money handed to staff are left out: no money left or entered the company.'].concat(IO.hide ? ['Car instalments are hidden for your role.'] : []) });
  var P = rpProfit(r);
  out.push({ id: 'profit', title: 'Profit by car', icon: 'chart', desc: 'Income from bookings against what each car cost.',
    kpis: [{ l: 'Profit from the cars', v: P.t.profit, t: 'money', hero: true, signed: true, note: P.t.inc && can('reports.see_amounts') ? Math.round(P.t.profit / P.t.inc * 100) + '% of income' : '', split: [['Income from bookings', P.t.inc], ['What the cars cost', P.t.cost]] }, { l: 'Company costs', v: P.t.company, t: 'money', note: 'Not tied to a car' }, { l: 'Profit after all costs', v: P.t.after, t: 'money', signed: true }],
    rowsTitle: 'By car', rows: P.list.map(function (x) { return { t1: rpCarName(x.car), t2: 'Income ' + rm(x.inc) + ' · Costs ' + rm(x.cost), t2money: true, v: x.profit, signed: true, link: '#car/' + x.car.id }; }),
    totalRow: { l: 'Profit from the cars', v: P.t.profit, signed: true },
    notes: ['Income is worked out like Bookings and income: Confirmed to Completed bookings, spread over their 24-hour blocks.', 'Car costs = expenses recorded on the car (fuel, toll, car wash, handover fees), finished service jobs, papers and instalments.', 'Costs not tied to a car (rent, salaries) are shown apart as company costs.'] });
  var E = rpExpenses(r);
  out.push({ id: 'expenses', title: 'Expenses by kind', icon: 'receipt', desc: 'What was spent: recorded by the team, service jobs and car papers.',
    kpis: [{ l: 'Total spent', v: E.total, t: 'money', hero: true, note: E.n + (E.n === 1 ? ' entry' : ' entries'), split: [['Recorded', E.rec], ['Service jobs', E.job], ['Papers', E.pap]] }, { l: 'Recorded', v: E.rec, t: 'money', note: 'By the team' }, { l: 'With a receipt', v: E.withRc, t: 'int', note: 'Of ' + E.n }],
    rowsTitle: 'Where the money went', rows: E.list.map(function (g) { return { t1: g.k, t2: g.n + (g.n === 1 ? ' entry' : ' entries') + ' · ' + (E.total ? Math.round(g.v / E.total * 100) : 0) + '% of the total', v: g.v, bar: E.total ? g.v / E.total : 0 }; }),
    totalRow: { l: 'Total spent', v: E.total },
    notes: ['Recorded: what the team added in Expenses, on the day it was spent. Service jobs and papers come from Maintenance, counted once.', 'Money handed to staff (a float from the company) is not spending, so it is left out.'] });
  return out;
}

/* ---------- drawing ---------- */
function rpMoney(v, signed) { if (!can('reports.see_amounts')) return '<span class="rp-hid">Hidden</span>'; return '<span class="money' + (signed && v < 0 ? ' rp-neg' : '') + '">' + rm(v) + '</span>'; }
function rpVal(k) { return k.t === 'money' ? rpMoney(k.v, k.signed) : k.t === 'pct' ? rpPct(k.v) : '<span class="num">' + Math.round(k.v).toLocaleString('en-MY') + '</span>'; }
function rpCard(m, r) {
  var hero = m.kpis.filter(function (k) { return k.hero; })[0], rest = m.kpis.filter(function (k) { return !k.hero; });
  var n = m.rows.length, top = m.rows.slice(0, RP_TOP), see = can('reports.see_amounts');
  return '<section class="card rp-card" id="rp-' + m.id + '"><div class="rp-head"><span class="rp-ic">' + I(m.icon) + '</span><div class="grow"><h3>' + esc(m.title) + '</h3><p>' + esc(m.desc) + '</p></div></div>' +
    (hero ? '<div class="rp-hero"><div class="rp-hero-k">' + esc(hero.l) + '</div><div class="rp-hero-v">' + rpVal(hero) + '</div>' + (hero.note ? '<div class="rp-hero-n">' + esc(hero.note) + '</div>' : '') +
      (hero.split && see ? '<div class="rp-split">' + hero.split.map(function (s) { return '<div><small>' + esc(s[0]) + '</small>' + rpMoney(s[1]) + '</div>'; }).join('') + '</div>' : '') + '</div>' : '') +
    (rest.length ? '<div class="rp-kpis">' + rest.map(function (k) { return '<div class="rp-kpi"><small>' + esc(k.l) + '</small><b>' + rpVal(k) + '</b>' + (k.note ? '<span>' + esc(k.note) + '</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
    '<div class="rp-rows-h">' + esc(m.rowsTitle) + '</div>' +
    (n ? '<div class="rp-rows">' + top.map(function (x) {
      var tag = x.link ? 'a' : 'div';
      return '<' + tag + ' class="card2 rp-row"' + (x.link ? ' href="' + x.link + '"' : '') + '><div class="c2-main"><div class="c2-t1">' + esc(x.t1) + '</div><div class="c2-t2">' + (x.t2money && !see ? esc(x.t2.replace(/RM [\d,.]+/g, 'Hidden')) : esc(x.t2)) + '</div>' + (x.bar != null ? '<i class="rp-bar" style="width:' + Math.max(2, Math.round(x.bar * 100)) + '%"></i>' : '') + '</div><div class="c2-end">' + rpMoney(x.v, x.signed) + '</div></' + tag + '>';
    }).join('') + '<div class="rp-total"><span>' + esc(m.totalRow.l) + '</span>' + rpMoney(m.totalRow.v, m.totalRow.signed) + '</div></div>' +
      (n > RP_TOP ? '<p class="rp-first">First ' + RP_TOP + ' of ' + n + ' rows; the total is for all ' + n + '.</p>' : '') : '<div class="empty small">Nothing in this period.</div>') +
    '<details class="rp-notes"><summary>How it is worked out</summary><ul>' + m.notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>' +
    (can('reports.export_excel') ? '<button type="button" class="btn ghost rp-pdf" data-pdf="' + m.id + '">' + I('share') + 'Share PDF</button>' : '') +
    '</section>';
}
VIEWS.reports = function () {
  if (!can('reports.view')) return { html: topbar('Reports', { back: '#more' }) + '<main>' + noAccess('reports.view') + '</main>' };
  var r = rpRange(RPV), models = r.err ? [] : rpModels(r);
  var html = topbar('Reports', { back: '#more', sub: r.err ? 'Choose a period' : r.label }) + '<main class="rp-main">' +
    '<div class="rp-per"><div class="chiprow rp-chips">' + RP_PER.map(function (p) { return '<button type="button" class="fchip' + (RPV.per === p[0] ? ' on' : '') + '" data-per="' + p[0] + '">' + esc(p[1]) + '</button>'; }).join('') + '</div>' +
    (RPV.per === 'custom' ? '<div class="rp-dates"><label class="field"><span>From</span><input type="date" class="inp' + (r.err && RPV.from ? ' bad' : '') + '" id="rpFrom" value="' + esc(RPV.from) + '"></label><label class="field"><span>To</span><input type="date" class="inp' + (r.err && RPV.to ? ' bad' : '') + '" id="rpTo" value="' + esc(RPV.to) + '"></label></div>' : '') +
    (r.err ? '<p class="rp-err">' + I('warn', 2) + esc(r.err) + '</p>' : '<p class="rp-label">' + esc(r.label) + '</p>') + '</div>' +
    (!can('reports.see_amounts') ? '<div class="banner amber">' + I('lock') + '<div>Amounts are hidden for your role. Ask the owner for <b>Report amounts</b> access to see them.</div></div>' : '') +
    (models.length ? '<div class="chiprow rp-jump">' + models.map(function (m) { return '<button type="button" class="fchip" data-jump="' + m.id + '">' + esc(m.title) + '</button>'; }).join('') + '</div>' + models.map(function (m) { return rpCard(m, r); }).join('') : '') +
    '<p class="demo-note">Made from this phone’s demo data. The big screen has the full reports and Excel files.</p></main>';
  return { html: html, keepScroll: true, after: function () {
    $$('[data-per]').forEach(function (b) { b.onclick = function () {
      var p = b.dataset.per;
      if (p === 'custom' && !RPV.from) { var cur = rpRange(RPV); if (!cur.err) { RPV.from = toLocalInput(cur.from); RPV.to = toLocalInput(cur.to); } }
      RPV.per = p; render();
    }; });
    var f = $('#rpFrom'), t = $('#rpTo');
    if (f) f.onchange = function () { RPV.from = f.value; render(); };
    if (t) t.onchange = function () { RPV.to = t.value; render(); };
    $$('[data-jump]').forEach(function (b) { b.onclick = function () { var el = $('#rp-' + b.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    $$('[data-pdf]').forEach(function (b) { b.onclick = function () { rpPdf(b.dataset.pdf); }; });
  } };
};
function rpPdf(id) {
  if (!can('reports.export_excel')) { say('Ask the owner for Export reports access'); return; }
  var r = rpRange(RPV); if (r.err) { say(r.err); return; }
  var m = rpModels(r).filter(function (x) { return x.id === id; })[0]; if (!m) return;
  var see = can('reports.see_amounts');
  var kpiLines = m.kpis.map(function (k) { return { text: k.l, sub: k.note || '', amt: k.t === 'money' && see ? k.v : null, val: k.t !== 'money' ? (k.t === 'pct' ? rpPct(k.v) : String(Math.round(k.v))) : '' }; });
  var lines = kpiLines.map(function (k) { return { text: k.text + (k.val ? ': ' + k.val : ''), sub: k.sub, amt: k.amt }; })
    .concat([{ text: m.rowsTitle.toUpperCase(), sub: m.rows.length + ' row' + (m.rows.length === 1 ? '' : 's'), amt: null }])
    .concat(m.rows.map(function (x) { return { text: x.t1, sub: see ? x.t2 : x.t2.replace(/RM [\d,.]+/g, 'Hidden'), amt: see ? x.v : null }; }));
  pdfDoc('report', { no: m.title, title: m.title, date: new Date(), to: { name: r.label, phone: B().name, extra: 'Made by ' + myName() }, lines: lines,
    totals: see ? [{ label: m.totalRow.l, amt: m.totalRow.v, big: true }] : [], notes: m.notes.join('\n') + (see ? '' : '\nAmounts are hidden for this role.'),
    footer: B().name + ' · ' + m.title + ' · ' + r.label, shareText: m.title + ', ' + r.label + (see ? ': ' + rm(m.totalRow.v) : '') });
  audit('Report shared: ' + m.title + ' (' + r.label + ')'); save();
}

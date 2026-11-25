/* ---------------- MONEY (M4) ----------------
   moneyIn(from, to), MONEY_TODAY(), INSTALMENTS_DUE_SOON()   shared figures (Home uses MONEY_TODAY)
   #money        money overview (replaces the old one in more.js)
   #cash         cash I hold, cash held by staff, bank-ins
   #mymoney      balance at hand, income, expenses, bank-ins (per person; everyone for the office)
   #instalments  car instalments, mark paid
   BankIn.open({staff}) the Bank in cash sheet; BankIn.view(id) one bank-in (void) */

/* ---------- shared figures ---------- */
/* money received between two times: every active payment item, all kinds, from <= at <= min(to, now). Payments taken
   from a deposit ('Deposit adjustment') are not new money, so they are left out. */
function moneyIn(from, to, split) {
  var f = new Date(from).getTime(), t = Math.min(to == null ? Date.now() : new Date(to).getTime(), Date.now()), sum = 0, dep = 0;
  S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) {
    if (p.voided || p.method === 'Deposit adjustment') return;
    var a = new Date(p.at).getTime(); if (a < f || a > t) return;
    (p.items || []).forEach(function (it) { var v = +it.amt || 0; sum += v; if (it.kind === 'Security deposit') dep += v; });
  }); });
  sum = Math.round(sum * 100) / 100;
  return split ? { total: sum, deposits: Math.round(dep * 100) / 100, income: Math.round((sum - dep) * 100) / 100 } : sum;
}
function MONEY_TODAY() { return moneyIn(sod(new Date()), new Date()); }
window.MONEY_TODAY = MONEY_TODAY;
window.moneyIn = moneyIn;
/* unpaid instalments that are overdue or due in the next 3 days (for a Home banner); [] without access */
function INSTALMENTS_DUE_SOON() {
  if (!S || !can('cars.see_instalment')) return [];
  var today = toLocalInput(new Date());
  return (S.instalments || []).filter(function (r) { return !r.paidAt && instDays(today, r.due) <= 3 && (car(r.car) || {}).status !== 'sold'; })
    .sort(function (a, b) { return a.due < b.due ? -1 : 1; })
    .map(function (r) { var c = car(r.car) || {}, d = instDays(today, r.due); return { id: r.id, car: r.car, plate: c.plate, due: r.due, amt: r.amt, overdueDays: d < 0 ? -d : 0, dueIn: d > 0 ? d : 0, text: instWhen(r, today) }; });
}
window.INSTALMENTS_DUE_SOON = INSTALMENTS_DUE_SOON;

function m4sum(list, f) { return Math.round(list.reduce(function (s, x) { return s + (+(f ? f(x) : x) || 0); }, 0) * 100) / 100; }
function m4inRange(at, from, to) { var t = new Date(at).getTime(); return (from == null || t >= from.getTime()) && (to == null || t <= to.getTime()); }
function m4kindShort(k) { return { 'Security deposit': 'Deposit', 'Rental payment': 'Rent', 'Delivery charge': 'Delivery', 'Return charge': 'Return', 'Damage coverage': 'Damage cover', 'Extension payment': 'Extension', 'Other payment': 'Other' }[k] || k; }
function m4method(m) { return methodText(m); }
function m4av(name, sm) { return '<span class="av' + (sm ? ' sm' : '') + '" style="background:' + avColor(name) + '">' + initials(name) + '</span>'; }
/* periods: 'today', 'week' (from Monday), 'month', 'last' (last month), or {from, to} */
function m4period(k) {
  var now = new Date(), d0 = sod(now);
  if (k && typeof k === 'object') return { from: sod(k.from), to: new Date(sod(k.to).getTime() + DAY - 1), label: dShort(k.from) + ' to ' + dShort(k.to) };
  if (k === 'today') return { from: d0, to: now, label: 'Today' };
  if (k === 'week') { var w = new Date(d0); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); return { from: w, to: now, label: 'This week' }; }
  if (k === 'last') { var a = new Date(now.getFullYear(), now.getMonth() - 1, 1), b = new Date(now.getFullYear(), now.getMonth(), 1); return { from: a, to: new Date(b.getTime() - 1), label: MO[a.getMonth()] + ' ' + a.getFullYear() }; }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, label: MO[now.getMonth()] + ' ' + now.getFullYear() };
}

/* ---------- cash held: one figure for "cash this person holds", the same as the closing balance on My money (staffEntries):
   cash from customers + floats from the company - everyday expenses and handover fees paid from it - deposits handed back - bank-ins.
   The oldest cash still held comes from the same entries: what went out is taken from the oldest money in first. ---------- */
function cashHeld() {
  var all = staffEntries(), out = {}, now = new Date();
  Object.keys(all).forEach(function (id) {
    var es = all[id].filter(function (e) { return new Date(e.at) <= now; }), f = staffFigures(es, null, null);
    var g = out[id] = { id: id, received: f.cash_received, floats: f.from_owners, spent: f.expenses, fees: f.income, refunded: f.refunds_given, banked: f.handed_in, held: f.change, count: 0, oldest: null };
    var ins = es.filter(function (e) { return e.side === 'in'; }), left = f.expenses + f.income + f.refunds_given + f.handed_in;
    ins.forEach(function (e) { if (left >= e.amt - 0.001) { left -= e.amt; return; } var rest = e.amt - Math.max(0, left); left = 0; if (rest > 0.009) { if (e.part === 'cash_received') g.count++; if (!g.oldest) g.oldest = e.at; } });
  });
  return out;
}

/* ---------- staff report (balance at hand), the reference's rules:
   in hand = cash from customers + from the company - expenses paid - cash deposits handed back - cash banked in - handover fees */
var M4_PARTS = ['income', 'expenses', 'from_owners', 'cash_received', 'refunds_given', 'handed_in'];
function staffEntries() {
  var all = {}, add = function (pid, e) { if (!pid) return; (all[pid] = all[pid] || []).push(e); };
  var everyday = {}; (B().expenseKinds || []).forEach(function (k) { if (k.everyday) everyday[k.name] = 1; });
  S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) {
    if (p.voided || p.method !== 'Cash' || !p.cashTo) return;
    var kinds = (p.items || []).map(function (i) { return m4kindShort(i.kind); }).filter(function (k, i, a) { return a.indexOf(k) === i; }).join(', ');
    add(p.cashTo, { at: p.at, part: 'cash_received', side: 'in', amt: payTotal(p), desc: 'Cash from customer: ' + kinds, code: b.code, link: '#booking/' + b.id });
  }); });
  (S.expenses || []).forEach(function (e) {
    if (e.voided) return;
    if (e.toStaff) add(e.toStaff, { at: e.at, part: 'from_owners', side: 'in', amt: +e.amt || 0, desc: 'From the company: ' + e.kind, note: e.note || '', code: '', exp: e });
    else if (e.agentFee) add(e.by, { at: e.at, part: 'income', side: 'out', amt: +e.amt || 0, desc: e.kind, code: e.booking ? (bk(e.booking) || {}).code || '' : '', exp: e });
    else if (everyday[e.kind]) add(e.by, { at: e.at, part: 'expenses', side: 'out', amt: +e.amt || 0, desc: 'Expense paid: ' + e.kind, note: e.note || e.paidTo || '', code: e.booking ? (bk(e.booking) || {}).code || '' : '', exp: e });
  });
  (S.refunds || []).forEach(function (r) { if (r.voided || r.method !== 'Cash' || !(+r.amt > 0)) return; var b = bk(r.booking) || {}; add(r.refundBy || r.by, { at: r.at, part: 'refunds_given', side: 'out', amt: +r.amt, desc: 'Deposit handed back', code: b.code || '', link: b.id ? '#booking/' + b.id : '' }); });
  (S.bankIns || []).forEach(function (x) { if (x.voided) return; add(x.staff, { at: x.at, part: 'handed_in', side: 'out', amt: +x.amt || 0, desc: 'Cash banked in', note: x.note || (x.ref ? 'Ref ' + x.ref : ''), code: '', bankIn: x.id }); });
  Object.keys(all).forEach(function (k) { all[k].sort(function (a, b) { return new Date(a.at) - new Date(b.at) || (a.side === 'out') - (b.side === 'out'); }); });
  return all;
}
function staffFigures(entries, from, to) {
  var f = {}; M4_PARTS.forEach(function (p) { f[p] = 0; });
  (entries || []).forEach(function (e) { if (m4inRange(e.at, from, to)) f[e.part] += e.amt; });
  M4_PARTS.forEach(function (p) { f[p] = Math.round(f[p] * 100) / 100; });
  f.change = Math.round((f.cash_received + f.from_owners - f.expenses - f.refunds_given - f.handed_in - f.income) * 100) / 100;
  return f;
}
function staffReport(pid, per, all) {
  all = all || staffEntries();
  var es = all[pid] || [], before = staffFigures(es, null, new Date(per.from.getTime() - 1)), during = staffFigures(es, per.from, per.to);
  var opening = before.change, closing = Math.round((opening + during.change) * 100) / 100, bal = opening;
  var ledger = es.filter(function (e) { return m4inRange(e.at, per.from, per.to); }).map(function (e) { bal = Math.round((bal + (e.side === 'in' ? e.amt : -e.amt)) * 100) / 100; return Object.assign({ balance: bal }, e); });
  return { pid: pid, opening: opening, closing: closing, f: during, ledger: ledger };
}

/* ---------- view state ---------- */
var moneyV = { per: 'month', mm: { per: 'month', custom: null, tab: 'bal' }, inst: { f: 'unpaid', month: null }, cash: { voided: false } };
VIEW_STATE.push(function () { moneyV = { per: 'month', mm: { per: 'month', custom: null, tab: 'bal' }, inst: { f: 'unpaid', month: null }, cash: { voided: false } }; });
function m4canMoney() { return can('bookings.see_revenue') || can('billing.view'); }
function m4noMoney(title, back) { return { html: topbar(title, { back: back || '#more' }) + '<main><div class="empty noaccess">' + I('lock') + '<div>Ask the owner for <b>Money</b> access</div></div></main>' }; }
function m4chips(cur, list, attr) { return '<div class="chiprow m4-chips">' + list.map(function (c) { return '<button type="button" class="fchip ' + (cur === c[0] ? 'on' : '') + '" data-' + attr + '="' + c[0] + '">' + esc(c[1]) + (c[2] != null ? ' <span class="n">' + c[2] + '</span>' : '') + '</button>'; }).join('') + '</div>'; }

/* ---------- #money overview ---------- */
function m4payRows(per) {
  var rows = [];
  S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (!p.voided && p.method !== 'Deposit adjustment' && m4inRange(p.at, per.from, per.to) && new Date(p.at) <= new Date()) rows.push({ p: p, b: b }); }); });
  return rows.sort(function (a, b) { return new Date(b.p.at) - new Date(a.p.at); });
}
function m4payCard(r) {
  var p = r.p, b = r.b, kinds = (p.items || []).map(function (i) { return m4kindShort(i.kind); }).filter(function (k, i, a) { return a.indexOf(k) === i; }).join(', ');
  return '<a class="card2 m4-a" href="#booking/' + b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(cust(b.cust).name) + ' · ' + esc(b.code) + '</div><div class="c2-t2">' + esc(dShort(p.at)) + ', ' + hm(p.at) + ' · ' + esc(kinds) + ' · ' + esc(m4method(p.method)) + '</div></div><div class="c2-end">' + rm(payTotal(p)) + '</div></a>';
}
function m4outRows(per) {
  var rows = [];
  (S.expenses || []).forEach(function (e) { if (!e.voided && !e.toStaff && m4inRange(e.at, per.from, per.to) && new Date(e.at) <= new Date()) rows.push({ at: e.at, amt: +e.amt || 0, t1: e.kind, t2: (e.agentFee ? 'Handover fee · ' + who(e.by) : (e.paidTo || who(e.by))) + (e.car ? ' · ' + ((car(e.car) || {}).plate || '') : ''), kind: e.agentFee ? 'fee' : 'exp', link: e.booking ? '#booking/' + e.booking : '' }); });
  (S.refunds || []).forEach(function (r) { if (!r.voided && +r.amt > 0 && m4inRange(r.at, per.from, per.to)) { var b = bk(r.booking) || {}; rows.push({ at: r.at, amt: +r.amt, t1: 'Deposit returned', t2: (b.code || '') + ' · ' + (b.cust ? cust(b.cust).name : '') + ' · ' + r.method, kind: 'ref', link: b.id ? '#booking/' + b.id : '' }); } });
  /* the card company keeps its charge: Money in counts the full card payment, so the charge goes out here and Net matches what reaches the bank */
  S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) {
    if (p.voided || p.method !== 'Card' || p.afterCharge == null || !m4inRange(p.at, per.from, per.to) || new Date(p.at) > new Date()) return;
    var fee = Math.round((payTotal(p) - p.afterCharge) * 100) / 100; if (fee > 0.004) rows.push({ at: p.at, amt: fee, t1: 'Card charge', t2: b.code + ' · ' + cust(b.cust).name + ' · card payment ' + rm(payTotal(p)), kind: 'card', link: '#booking/' + b.id });
  }); });
  return rows.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
}
function m4figures(per) {
  var inn = moneyIn(per.from, per.to, true), out = m4outRows(per), outT = m4sum(out, function (r) { return r.amt; });
  var due = S.bookings.filter(BK_TESTS.collect); /* the same rule as Home's Balance to collect and #bookings/collect */
  var ix = Deposit.index(), held = [], give = [];
  S.bookings.forEach(function (b) {
    if (b.paymentStatus === 'Deposit Refunded') return;
    var m = calcBooking(b); if (m.depositReceived <= 0 && b.paymentStatus !== 'Refund Pending') return;
    var x = Deposit.info(b, ix);
    if (x.net > 0 || m.depositReceived > 0) held.push({ b: b, x: x });
    if (b.paymentStatus === 'Refund Pending') give.push({ b: b, x: x });
  });
  var ch = cashHeld(), cashT = m4sum(Object.keys(ch).map(function (k) { return ch[k].held; }).filter(function (v) { return v > 0; }));
  var today = toLocalInput(new Date()), overdue = (S.instalments || []).filter(function (r) { return !r.paidAt && r.due < today && (car(r.car) || {}).status !== 'sold'; });
  return { inn: inn, out: out, outT: outT, net: Math.round((inn.total - outT) * 100) / 100, due: due, dueT: m4sum(due, function (b) { return calcBooking(b).due; }),
    held: held, heldT: m4sum(held, function (r) { return r.x.net; }), give: give, giveT: m4sum(give, function (r) { return r.x.net; }), cashT: cashT, cashN: Object.keys(ch).filter(function (k) { return ch[k].held > 0; }).length,
    overdue: overdue, overdueT: m4sum(overdue, function (r) { return r.amt; }) };
}
VIEWS.money = function () {
  if (!m4canMoney()) return m4noMoney('Money');
  var per = m4period(moneyV.per), F = m4figures(per), pays = m4payRows(per);
  var tile = function (key, icon, k, v, sub, tone) { return '<button type="button" class="tile m4-tile' + (tone ? ' ' + tone : '') + '" data-open="' + key + '"><div class="k">' + I(icon) + esc(k) + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="m4-sub">' + sub + '</div>' : '') + '</button>'; };
  var html = topbar('Money', { back: '#more', sub: per.label }) + '<main class="m4-main">' +
    m4chips(moneyV.per, [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['last', 'Last month']], 'per') +
    '<button type="button" class="card m4-hero" data-open="in"><div class="m4-hero-k">Money in · ' + esc(per.label) + '</div><div class="m4-hero-v money">' + rm(F.inn.total) + '</div>' +
    '<div class="m4-hero-split"><span><small>Rent and charges</small><b class="money">' + rm(F.inn.income) + '</b></span><span><small>Deposits taken</small><b class="money">' + rm(F.inn.deposits) + '</b></span><span><small>Payments</small><b>' + pays.length + '</b></span></div></button>' +
    '<div class="tiles m4-tiles">' +
    tile('out', 'out', 'Money out', rm(F.outT), 'Expenses and refunds') +
    tile('net', 'chart', 'Net', rm(F.net), F.net < 0 ? 'More out than in' : 'In minus out', F.net < 0 ? 'neg' : '') +
    tile('due', 'clock', 'Balance to collect', rm(F.dueT), F.due.length + ' booking' + (F.due.length === 1 ? '' : 's'), F.dueT > 0 ? 'warnv' : '') +
    tile('held', 'shield', 'Deposits held', rm(F.heldT), F.held.length + ' booking' + (F.held.length === 1 ? '' : 's')) +
    (can('deposits.view') ? tile('give', 'bank', 'Deposits to give back', rm(F.giveT), F.give.length + ' waiting') : '') +
    tile('cash', 'cash', 'Cash held by staff', rm(F.cashT), F.cashN + ' ' + (F.cashN === 1 ? 'person' : 'people')) +
    (can('cars.see_instalment') ? tile('inst', 'car', 'Overdue instalments', rm(F.overdueT), F.overdue.length ? F.overdue.length + ' overdue' : 'None overdue', F.overdue.length ? 'neg' : '') : '') +
    '</div>' +
    '<div class="sec"><h2>Latest payments</h2>' + (pays.length > 8 ? '<button type="button" data-open="in">All ' + pays.length + '</button>' : '') + '</div>' +
    '<div class="list">' + (pays.length ? pays.slice(0, 8).map(m4payCard).join('') : '<div class="empty">No payments ' + (moneyV.per === 'today' ? 'today yet' : 'in this period') + '</div>') + '</div>' +
    '<div class="sec"><h2>More</h2></div><div class="list m4-links">' +
    (can('deposits.view') ? '<a class="row" href="#deposits">' + I('bank') + '<div class="grow"><div class="t1">Deposits</div><div class="t2">Adjustments and refunds</div></div><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>' : '') +
    '<a class="row" href="#cash">' + I('cash') + '<div class="grow"><div class="t1">Cash and bank-ins</div><div class="t2">Who holds cash, bank in cash</div></div><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>' +
    '<a class="row" href="#mymoney">' + I('user') + '<div class="grow"><div class="t1">' + (can('expenses.staff_reports_all') ? 'Staff money' : 'My money') + '</div><div class="t2">Balance at hand, income and expenses</div></div><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>' +
    (can('cars.see_instalment') ? '<a class="row" href="#instalments">' + I('cal') + '<div class="grow"><div class="t1">Instalments</div><div class="t2">Car loans due and paid</div></div><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>' : '') +
    '</div></main>';
  return { html: html, keepScroll: true, after: function () {
    $$('[data-per]').forEach(function (el) { el.onclick = function () { moneyV.per = el.dataset.per; render(false, true); }; });
    $$('[data-open]').forEach(function (el) { el.onclick = function () { m4open(el.dataset.open, per, F); }; });
  } };
};
function m4open(k, per, F) {
  if (k === 'give') { location.hash = '#deposits'; return; }
  if (k === 'cash') { location.hash = '#cash'; return; }
  if (k === 'inst') { moneyV.inst = { f: 'overdue', month: null }; location.hash = '#instalments'; return; }
  var title, sub = per.label, body = '';
  if (k === 'in') {
    var rows = m4payRows(per), by = {};
    rows.forEach(function (r) { (r.p.items || []).forEach(function (i) { var g = m4kindShort(i.kind); by[g] = (by[g] || 0) + (+i.amt || 0); }); });
    var byM = {}; rows.forEach(function (r) { var mm = m4method(r.p.method); byM[mm] = (byM[mm] || 0) + payTotal(r.p); });
    title = 'Money in';
    body = '<div class="card m4-sum">' + Object.keys(by).map(function (g) { return '<div class="sumline"><span>' + esc(g) + '</span><span class="money">' + rm(by[g]) + '</span></div>'; }).join('') + '<div class="sumline big"><span>Total</span><span class="money">' + rm(F.inn.total) + '</span></div></div>' +
      '<div class="m4-meths">' + Object.keys(byM).map(function (m) { return '<span>' + esc(m) + ' <b class="money">' + rm(byM[m]) + '</b></span>'; }).join('') + '</div>' +
      '<div class="sec"><h2>' + rows.length + ' payment' + (rows.length === 1 ? '' : 's') + '</h2></div><div class="list">' + (rows.length ? rows.slice(0, 200).map(m4payCard).join('') : '<div class="empty">No payments in this period</div>') + '</div>';
  } else if (k === 'out' || k === 'net') {
    var out = F.out, ex = m4sum(out.filter(function (r) { return r.kind === 'exp'; }), function (r) { return r.amt; }), fee = m4sum(out.filter(function (r) { return r.kind === 'fee'; }), function (r) { return r.amt; }), rf = m4sum(out.filter(function (r) { return r.kind === 'ref'; }), function (r) { return r.amt; }), cc = m4sum(out.filter(function (r) { return r.kind === 'card'; }), function (r) { return r.amt; });
    title = k === 'out' ? 'Money out' : 'Net';
    body = '<div class="card m4-sum">' + (k === 'net' ? '<div class="sumline"><span>Money in</span><span class="money">' + rm(F.inn.total) + '</span></div>' : '') +
      '<div class="sumline"><span>Expenses</span><span class="money">' + (k === 'net' ? '-' : '') + rm(ex) + '</span></div><div class="sumline"><span>Handover fees</span><span class="money">' + (k === 'net' ? '-' : '') + rm(fee) + '</span></div><div class="sumline"><span>Deposits returned</span><span class="money">' + (k === 'net' ? '-' : '') + rm(rf) + '</span></div>' +
      (cc ? '<div class="sumline"><span>Card charges</span><span class="money">' + (k === 'net' ? '-' : '') + rm(cc) + '</span></div>' : '') +
      '<div class="sumline big"><span>' + (k === 'net' ? 'Net' : 'Total') + '</span><span class="money">' + rm(k === 'net' ? F.net : F.outT) + '</span></div></div>' +
      (k === 'net' ? '<p class="small muted m4-note">Money in counts every payment received, deposits included. Money out counts expenses, handover fees, deposits given back and the charges the card company keeps.</p>' : '') +
      '<div class="sec"><h2>' + out.length + ' item' + (out.length === 1 ? '' : 's') + '</h2></div><div class="list">' + (out.length ? out.slice(0, 200).map(function (r) {
        return '<' + (r.link ? 'a href="' + r.link + '"' : 'div') + ' class="card2 m4-a"><div class="c2-main"><div class="c2-t1">' + esc(r.t1) + '</div><div class="c2-t2">' + esc(dShort(r.at)) + ' · ' + esc(r.t2) + '</div></div><div class="c2-end">' + rm(r.amt) + '</div></' + (r.link ? 'a' : 'div') + '>';
      }).join('') : '<div class="empty">Nothing paid out in this period</div>') + '</div>';
  } else if (k === 'due') {
    title = 'Balance to collect'; sub = 'Cars out, back, or going out in the next 2 days';
    var list = F.due.slice().sort(function (a, b) { return calcBooking(b).due - calcBooking(a).due; });
    body = '<div class="list">' + (list.length ? list.map(function (b) { return '<a class="card2 m4-a" href="#booking/' + b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(cust(b.cust).name) + ' · ' + esc(b.code) + '</div><div class="c2-t2">' + esc(liveStatus(b)) + ' · ' + esc(dShort(b.start)) + ' to ' + esc(dShort(b.end)) + '</div></div><div class="c2-end bal due">' + rm(calcBooking(b).due) + '<small>due</small></div></a>'; }).join('') : '<div class="empty">Nothing to collect. Every booking that started is paid.</div>') + '</div>';
  } else if (k === 'held') {
    title = 'Deposits held'; sub = 'Deposits received and not given back yet';
    var hl = F.held.slice().sort(function (a, b) { return new Date(a.b.end) - new Date(b.b.end); });
    body = '<div class="list">' + (hl.length ? hl.map(function (r) { return '<button type="button" class="card2" data-dep="' + r.b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(cust(r.b.cust).name) + ' · ' + esc(r.b.code) + '</div><div class="c2-t2">' + esc(r.b.paymentStatus || 'No payment status') + ' · back ' + esc(dShort(r.b.end)) + '</div></div><div class="c2-end">' + rm(r.x.net) + '</div></button>'; }).join('') : '<div class="empty">No deposits held</div>') + '</div>';
  }
  sheet(sheetHead(title, sub) + body, function (sh) { $$('[data-dep]', sh).forEach(function (el) { el.onclick = function () { Deposit.open(el.dataset.dep, { stack: true }); }; }); $$('a[href^="#"]', sh).forEach(function (a) { a.addEventListener('click', function () { closeAllSheets(); }); }); }, { full: true });
}

/* ---------- Bank in cash ---------- */
var BankIn = (function () {
  function office() { return can('expenses.staff_reports_all'); }
  function mayVoid(x) { if (x.voided) return false; if (office()) return true; return x.by === S.me && Date.now() - new Date(x.created || x.at) <= DAY; }
  function open(o) {
    o = o || {};
    if (!can('expenses.add') && !office()) { say('Ask the owner for access to record a bank-in'); return; }
    var now = new Date(), st = { staff: o.staff && (o.staff === S.me || office()) ? o.staff : S.me, slip: null, hash: null, read: null, busy: false };
    var keep = { amt: '', date: toLocalInput(now), time: toTimeInput(now), ref: '', note: '' };
    var sh = sheet('<div id="biBody"></div>', null, { stack: !!o.stack, full: true });
    var grab = function () { ['amt', 'date', 'time', 'ref', 'note'].forEach(function (k) { var el = $('#bi_' + k, sh); if (el) keep[k] = el.value; }); };
    var draw = function () {
      if (!sh.isConnected) return;
      var held = (cashHeld()[st.staff] || { held: 0 }).held, nm = who(st.staff);
      var h = sheetHead('Bank in cash', 'Cash paid into the company bank account') +
        '<div class="field"><span>Whose cash?</span>' + (office() ? '<button type="button" class="carfield" id="biWho">' + m4av(nm, true) + '<span class="grow"><b>' + esc(nm) + (st.staff === S.me ? ' (me)' : '') + '</b><small class="muted">Holds ' + rm(held) + ' in cash</small></span>' + I('down') + '</button>' :
          '<div class="carfield m4-static">' + m4av(nm, true) + '<span class="grow"><b>' + esc(nm) + '</b><small class="muted">Cash you hold: ' + rm(held) + '</small></span></div>') + '</div>' +
        '<div class="field"><span>Bank slip</span>' + (st.slip ? '<div class="dep-ph"><span class="thumb"><img alt="Slip" src="' + imgSrc(st.slip) + '"></span><div class="grow small">' + (st.busy ? '<span class="dep-reading">Reading the slip…</span>' : st.read ? 'Read from the slip: ' + esc(rm(st.read.amount) + ', ' + dShort(st.read.date + 'T00:00') + ', ' + hm(fromInputs(st.read.date, st.read.time)) + (st.read.ref ? ', ref ' + st.read.ref : '')) + '. Check they are right.' : '') + '</div><button type="button" class="btn sm ghost" id="biSlipX" aria-label="Remove the slip">' + I('trash') + '</button></div>' :
          '<div class="btnrow"><button type="button" class="btn ghost" id="biSlipT">' + I('camera') + 'Take a photo</button><button type="button" class="btn ghost" id="biSlipS">' + I('image') + 'Sample slip</button></div><small class="hint">Take a photo of the slip from the bank or the cash deposit machine.</small>') + '<small class="err" id="biErr_slip"></small></div>' +
        '<label class="field"><span>Amount banked in</span><div class="rmfield"><input class="inp num" id="bi_amt" inputmode="decimal" placeholder="0.00" value="' + esc(keep.amt) + '"></div><small class="hint">Any part of the cash is fine.</small><small class="err" id="biErr_amt"></small></label>' +
        '<div class="dep-dt"><label class="field"><span>Day</span><input class="inp" type="date" id="bi_date" max="' + toLocalInput(new Date()) + '" value="' + esc(keep.date) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="bi_time" value="' + esc(keep.time) + '"></label></div><small class="err dep-dterr" id="biErr_date"></small>' +
        '<label class="field"><span>Bank reference (optional)</span><input class="inp" id="bi_ref" maxlength="100" value="' + esc(keep.ref) + '"><small class="err" id="biErr_ref"></small></label>' +
        '<label class="field"><span>Note (optional)</span><input class="inp" id="bi_note" maxlength="300" value="' + esc(keep.note) + '"></label>' +
        '<div class="sheet-foot"><button type="button" class="btn big" id="biSave"' + (st.busy ? ' disabled' : '') + '>' + I('check', 2.4) + 'Save bank-in</button></div>';
      $('#biBody', sh).innerHTML = h;
      var w = $('#biWho', sh); if (w) w.onclick = function () { grab(); Pickers.staff({ title: 'Whose cash was banked in?', selected: [st.staff], includeOff: true, onPick: function (p) { if (p) { st.staff = p.id; draw(); } } }); };
      var take = function (sample) {
        grab();
        var p = sample ? Media.sample('slip', 'Cash deposit').then(function (r) { return { dataUrl: 'demo:slip:Cash deposit', hash: r.hash }; }) : Media.photo({ maxPx: 900, quality: .55, accept: 'image/*' });
        p.then(function (r) {
          var dup = Deposit.slipUsed(r.hash, '');
          if (dup) { say('This slip was already uploaded: it is on ' + dup + '. The same slip cannot be recorded twice.'); return; }
          st.slip = r.dataUrl; st.hash = r.hash; st.busy = true; st.read = null; draw();
          Media.readSlip(r.dataUrl + (sample ? r.hash : ''), { expect: held > 0 ? Math.floor(held / 10) * 10 : null }).then(function (rd) {
            if (!sh.isConnected) return;
            st.busy = false; st.read = rd; keep.amt = money2(rd.amount); keep.date = rd.date; keep.time = rd.time; keep.ref = rd.ref; draw();
          });
        }, function () {});
      };
      var t = $('#biSlipT', sh), s = $('#biSlipS', sh), x = $('#biSlipX', sh);
      if (t) t.onclick = function () { take(false); }; if (s) s.onclick = function () { take(true); };
      if (x) x.onclick = function () { grab(); st.slip = null; st.hash = null; st.read = null; st.busy = false; draw(); };
      $('#biSave', sh).onclick = function () { grab(); save1(held); };
    };
    var err = function (k, t) { var el = $('#biErr_' + k, sh); if (el) el.textContent = t; return false; };
    var save1 = function (held, checked) {
      $$('.err', sh).forEach(function (e) { e.textContent = ''; });
      var ok = true, amt = parseMoney(keep.amt);
      if (!st.slip) ok = err('slip', 'Add a photo of the bank slip.');
      if (st.busy) ok = err('slip', 'Wait for the slip to be read.');
      if (!(amt > 0)) ok = err('amt', 'Enter the amount you paid into the bank.');
      else if (amt > 999999.99) ok = err('amt', 'That amount is too large. Check the number.');
      var when = /^\d{4}-\d{2}-\d{2}$/.test(keep.date) && /^\d{2}:\d{2}$/.test(keep.time) ? fromInputs(keep.date, keep.time) : null;
      if (!when) ok = err('date', 'Choose the day and time you paid the cash in.');
      else if (when.getTime() > Date.now() + 15 * MIN) ok = err('date', 'The day and time cannot be in the future.');
      if (!ok) { var e1 = $$('.err', sh).filter(function (e) { return e.textContent; })[0]; if (e1) e1.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      var dupPic = Deposit.slipUsed(st.hash, ''), dupRef = dupPic ? null : Deposit.slipUsed(null, keep.ref);
      if (dupPic || dupRef) {
        if (dupPic) err('slip', 'This slip was already uploaded: it is on ' + dupPic + '. The same slip cannot be recorded twice.');
        else err('ref', 'This reference is already on ' + dupRef + '. The same slip cannot be recorded twice.');
        var de = $(dupPic ? '#biErr_slip' : '#biErr_ref', sh); if (de) de.scrollIntoView({ block: 'center', behavior: 'smooth' });
        say(dupPic ? 'This slip was already used' : 'This reference was already used'); return;
      }
      /* a typo (one digit too many) or an amount that is not what the slip says: ask before saving */
      var warn = [];
      if (held != null && amt > held + 0.009) warn.push(rm(amt) + ' is more than the ' + rm(Math.max(0, held)) + ' ' + (st.staff === S.me ? 'you hold' : firstName(who(st.staff)) + ' holds') + '.');
      if (st.read && Math.abs(+st.read.amount - amt) >= 0.01) warn.push('The slip shows ' + rm(st.read.amount) + '.');
      if (warn.length && !checked) {
        confirm({ icon: 'warn', title: 'Check the amount', text: warn.join(' '), ok: 'Save anyway', cancel: 'Go back', primary: 'cancel' }).then(function (y) { if (y) save1(held, true); else { var a = $('#bi_amt', sh); if (a) a.focus(); } });
        return;
      }
      var rec = { id: uid(), staff: st.staff, amt: amt, at: when.toISOString(), slip: st.slip, slipHash: st.hash, ref: keep.ref.trim(), note: keep.note.trim(), by: S.me, created: new Date().toISOString(), voided: false, voidReason: null };
      S.bankIns = S.bankIns || []; S.bankIns.push(rec);
      audit('Bank-in of ' + rm(amt) + ' saved for ' + who(st.staff) + (rec.ref ? ' (ref ' + rec.ref + ')' : ''), { link: '#cash' });
      save(); closeSheet();
      notify('pay', 'Bank-in of ' + rm(amt) + ' saved.', st.staff === S.me ? '' : 'For ' + who(st.staff), '#cash', { self: true });
      if (o.onDone) o.onDone(rec);
      render(false, true);
    };
    draw();
  }
  function view(id, onDone) {
    var x = byId(S.bankIns, id); if (!x) return;
    var sh = sheet(sheetHead('Bank-in ' + rm(x.amt), who(x.staff) + ' · ' + dFull(x.at) + ', ' + hm(x.at)) +
      (x.voided ? '<div class="banner red">' + I('warn') + '<div><b>Voided</b>' + (x.voidedBy ? ' by ' + esc(who(x.voidedBy)) : '') + (x.voidedAt ? ' on ' + esc(dFull(x.voidedAt)) : '') + '. ' + esc(x.voidReason || '') + '</div></div>' : '') +
      '<div class="kv"><div><div class="k">Amount</div><div class="v money">' + rm(x.amt) + '</div></div><div><div class="k">Whose cash</div><div class="v">' + esc(who(x.staff)) + '</div></div><div><div class="k">Reference</div><div class="v">' + esc(x.ref || 'None') + '</div></div><div><div class="k">Recorded by</div><div class="v">' + esc(who(x.by)) + '</div></div></div>' +
      (x.note ? '<p class="small muted dep-note">' + esc(x.note) + '</p>' : '') +
      (x.slip ? '<div class="dep-pic m4-slip"><img alt="Bank slip" src="' + imgSrc(x.slip) + '"></div>' : '') +
      (mayVoid(x) ? '<div class="sheet-foot"><button type="button" class="btn danger" id="biVoid">' + I('trash') + 'Void this bank-in</button></div>' : ''), null, { stack: true });
    var v = $('#biVoid', sh);
    if (v) v.onclick = function () {
      var s2 = sheet(sheetHead('Void this bank-in?', rm(x.amt) + ' · ' + who(x.staff)) + '<p class="lead">The cash goes back onto what ' + esc(x.staff === S.me ? 'you hold' : firstName(who(x.staff)) + ' holds') + '.</p>' +
        '<label class="field"><span>Why is it wrong?</span><textarea class="inp dep-ta" id="bvWhy" maxlength="300" placeholder="For example: typed the wrong amount"></textarea><small class="err" id="bvErr"></small></label>' +
        '<div class="sheet-foot"><button type="button" class="btn danger solid" id="bvGo">Void the bank-in</button></div>', null, { stack: true });
      $('#bvGo', s2).onclick = function () {
        var why = $('#bvWhy', s2).value.trim(); if (!why) { $('#bvErr', s2).textContent = 'Say why this bank-in is wrong.'; return; }
        if (!mayVoid(x)) { say('Only the office can void this bank-in now (your own can be voided within 24 hours).'); return; }
        x.voided = true; x.voidReason = why; x.voidedAt = new Date().toISOString(); x.voidedBy = S.me;
        audit('Bank-in of ' + rm(x.amt) + ' for ' + who(x.staff) + ' voided: ' + why, { link: '#cash' });
        save(); closeAllSheets(); say('Bank-in voided.'); if (onDone) onDone(); render(false, true);
      };
    };
  }
  function row(x, showWho) {
    return '<button type="button" class="card2 m4-bi' + (x.voided ? ' voided' : '') + '" data-bi="' + x.id + '">' + (showWho ? m4av(who(x.staff), true) : '<span class="dep-ic">' + I('bank') + '</span>') +
      '<div class="c2-main"><div class="c2-t1">' + (showWho ? esc(who(x.staff)) : 'Cash banked in') + (x.voided ? ' ' + chip('Voided', 'grey') : '') + '</div><div class="c2-t2">' + esc(dShort(x.at)) + ', ' + hm(x.at) + (x.ref ? ' · Ref ' + esc(x.ref) : '') + '</div></div><div class="c2-end">' + rm(x.amt) + '</div></button>';
  }
  return { open: open, view: view, row: row, mayVoid: mayVoid, office: office };
})();
function m4wireBankIns(root) { $$('[data-bi]', root || document).forEach(function (el) { el.onclick = function () { BankIn.view(el.dataset.bi); }; }); }

/* ---------- #cash ---------- */
VIEWS.cash = function () {
  var mine = can('expenses.add') || BankIn.office(), all = can('billing.manage_cash') || BankIn.office();
  if (!mine && !all) return { html: topbar('Cash and bank-ins', { back: '#more' }) + '<main>' + noAccess('billing.manage_cash') + '</main>' };
  var ch = cashHeld(), my = ch[S.me] || { held: 0, count: 0, oldest: null };
  var myBi = (S.bankIns || []).filter(function (x) { return x.staff === S.me; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
  var html = topbar('Cash and bank-ins', { back: '#more' }) + '<main class="m4-main">' +
    '<div class="card m4-hero m4-cash"><div class="m4-hero-k">Cash I hold</div><div class="m4-hero-v money' + (my.held < 0 ? ' neg' : '') + '">' + rm(my.held) + '</div>' +
    '<div class="m4-hero-note">' + (my.held > 0 && my.oldest ? 'Oldest cash from ' + esc(dFull(my.oldest)) + (my.count ? ' · ' + my.count + ' cash payment' + (my.count === 1 ? '' : 's') : '') : my.held < 0 ? 'You paid out, banked in or handed back more than you took in cash.' : 'You hold no company cash right now.') + '</div>' +
    (mine ? '<button type="button" class="btn big m4-bibtn" id="cashBi">' + I('bank') + 'Bank in cash</button>' : '') + '</div>';
  if (all) {
    var people = Object.keys(ch).map(function (k) { return ch[k]; }).filter(function (g) { return Math.abs(g.held) > 0.009; }).sort(function (a, b) { return b.held - a.held; });
    var tot = m4sum(people.filter(function (g) { return g.held > 0; }), function (g) { return g.held; });
    html += '<div class="sec"><h2>Cash held by staff</h2><span class="small muted money">' + rm(tot) + '</span></div><div class="list">' + (people.length ? people.map(function (g) {
      var nm = who(g.id), old = g.oldest ? Math.floor((Date.now() - new Date(g.oldest)) / DAY) : 0;
      return '<div class="card2 m4-person">' + m4av(nm) + '<div class="c2-main"><div class="c2-t1">' + esc(nm) + (g.id === S.me ? ' <span class="muted">(me)</span>' : '') + '</div><div class="c2-t2">' + (g.held > 0 ? (g.count ? g.count + ' payment' + (g.count === 1 ? '' : 's') + ' · ' : '') + 'since ' + esc(dShort(g.oldest)) : 'Paid out more than held') + '</div>' +
        (g.held > 0 && old >= 7 ? '<div class="dep-chips">' + chip('Held ' + old + ' days', old >= 14 ? 'red' : 'amber') + '</div>' : '') + '</div>' +
        '<div class="m4-pend"><b class="money' + (g.held < 0 ? ' neg' : '') + '">' + rm(g.held) + '</b>' + (BankIn.office() || g.id === S.me ? '<button type="button" class="btn sm ghost" data-bifor="' + g.id + '">Bank in</button>' : '') + '</div></div>';
    }).join('') : '<div class="empty">No cash is being held</div>') + '</div>';
  }
  var list = all ? (S.bankIns || []).slice() : myBi;
  if (!moneyV.cash.voided) list = list.filter(function (x) { return !x.voided; });
  list.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
  var nVoid = (all ? S.bankIns || [] : myBi).filter(function (x) { return x.voided; }).length;
  html += '<div class="sec"><h2>' + (all ? 'Recent bank-ins' : 'My bank-ins') + '</h2>' + (nVoid ? '<button type="button" id="cashVoided">' + (moneyV.cash.voided ? 'Hide voided' : 'Show voided (' + nVoid + ')') + '</button>' : '') + '</div>' +
    '<div class="list">' + (list.length ? list.slice(0, 30).map(function (x) { return BankIn.row(x, all); }).join('') : '<div class="empty">No bank-ins yet. When you pay cash into the bank, record it here with the slip.</div>') + '</div>' +
    '<p class="small muted m4-note">Cash held = cash taken from customers and money from the company, less expenses and handover fees paid from it, deposits handed back in cash and bank-ins. It is the same as the balance at hand on ' + (can('expenses.staff_reports_all') ? 'Staff money' : 'My money') + '. A bank-in is never an expense or income.</p></main>';
  return { html: html, keepScroll: true, after: function () {
    var b = $('#cashBi'); if (b) b.onclick = function () { BankIn.open({ staff: S.me }); };
    $$('[data-bifor]').forEach(function (el) { el.onclick = function () { BankIn.open({ staff: el.dataset.bifor }); }; });
    var v = $('#cashVoided'); if (v) v.onclick = function () { moneyV.cash.voided = !moneyV.cash.voided; render(false, true); };
    m4wireBankIns();
  } };
};

/* ---------- #mymoney ---------- */
VIEWS.mymoney = function (r) {
  var mm = moneyV.mm, office = can('expenses.staff_reports_all');
  var pid = office ? (r.q.p || 'all') : S.me;
  if (pid !== 'all' && !staff(pid)) pid = office ? 'all' : S.me;
  var per = m4period(mm.per === 'custom' && mm.custom ? mm.custom : mm.per === 'custom' ? 'month' : mm.per), all = staffEntries();
  var perChips = m4chips(mm.per, [['month', 'This month'], ['last', 'Last month'], ['custom', mm.per === 'custom' && mm.custom ? per.label : 'Pick dates']], 'mper');
  var title = office ? 'Staff money' : 'My money';
  var html = topbar(pid === 'all' || pid === S.me ? title : firstName(who(pid)) + '’s money', { back: office && r.q.p ? '#mymoney' : '#more', sub: per.label }) + '<main class="m4-main">';
  if (office) html += '<button type="button" class="carfield m4-whobtn" id="mmWho">' + (pid === 'all' ? '<span class="dep-ic">' + I('users') + '</span><span class="grow"><b>Everyone</b><small class="muted">Tap to see one person</small></span>' : m4av(who(pid), true) + '<span class="grow"><b>' + esc(who(pid)) + (pid === S.me ? ' (me)' : '') + '</b><small class="muted">' + esc(roleName((staff(pid) || {}).role)) + '</small></span>') + I('down') + '</button>';
  html += perChips;
  if (pid === 'all') {
    var people = S.staff.map(function (p) { return staffReport(p.id, per, all); }).filter(function (x) { var f = x.f; return Math.abs(x.closing) > 0.009 || M4_PARTS.some(function (k) { return f[k]; }) || (staff(x.pid) || {}).loginActive !== false; })
      .sort(function (a, b) { return who(a.pid).toLowerCase() < who(b.pid).toLowerCase() ? -1 : 1; });
    var tot = m4sum(people, function (x) { return x.closing; });
    html += '<div class="card m4-hero"><div class="m4-hero-k">Balance at hand, everyone</div><div class="m4-hero-v money' + (tot < 0 ? ' neg' : '') + '">' + rm(tot) + '</div><div class="m4-hero-split"><span><small>Income</small><b class="money">' + rm(m4sum(people, function (x) { return x.f.income; })) + '</b></span><span><small>Expenses paid</small><b class="money">' + rm(m4sum(people, function (x) { return x.f.expenses; })) + '</b></span><span><small>Staff</small><b>' + people.length + '</b></span></div></div>' +
      '<div class="sec"><h2>Everyone</h2></div><div class="m4-people">' + people.map(function (x) {
        var nm = who(x.pid);
        return '<a class="card m4-pcard" href="' + hashWith('mymoney', { p: x.pid }) + '"><div class="m4-pcard-h">' + m4av(nm, true) + '<div class="grow"><b>' + esc(nm) + '</b><small class="muted">' + esc(roleName((staff(x.pid) || {}).role)) + '</small></div><div class="m4-pbal"><small>Balance at hand</small><b class="money' + (x.closing < 0 ? ' neg' : '') + '">' + rm(x.closing) + '</b></div></div>' +
          '<div class="m4-pfig"><span><small>Income</small><b class="money">' + rm(x.f.income) + '</b></span><span><small>Expenses</small><b class="money">' + rm(x.f.expenses) + '</b></span><span><small>Cash in</small><b class="money">' + rm(x.f.cash_received) + '</b></span></div></a>';
      }).join('') + '</div><p class="small muted m4-note">Positive: they hold that much of the company’s money. Negative: the company owes them that much.</p></main>';
    return { html: html, keepScroll: true, after: function () { m4mmWire(r); } };
  }
  var R = staffReport(pid, per, all), f = R.f, isMe = pid === S.me, fn = firstName(who(pid));
  var tabs = [['bal', 'Balance', R.ledger.length], ['inc', isMe ? 'My income' : 'Income', null], ['exp', isMe ? 'My expenses' : 'Expenses', null], ['bi', 'Bank-ins', null]];
  html += '<div class="card m4-hero"><div class="m4-hero-k">Balance at hand</div><div class="m4-hero-v money' + (R.closing < 0 ? ' neg' : '') + '">' + rm(R.closing) + '</div>' +
    '<div class="m4-hero-note">' + (R.closing > 0.009 ? (isMe ? 'You hold ' : fn + ' holds ') + rm(R.closing) + ' of the company’s money.' : R.closing < -0.009 ? 'The company owes ' + (isMe ? 'you ' : fn + ' ') + rm(-R.closing) + '.' : 'All square.') + ' Brought forward ' + rm(R.opening) + '.</div>' +
    ((isMe && can('expenses.add')) || BankIn.office() ? '<button type="button" class="btn big m4-bibtn" id="mmBi">' + I('bank') + 'Bank in cash</button>' : '') + '</div>' +
    '<div class="tiles m4-tiles">' +
    '<button type="button" class="tile m4-tile" data-mtab="inc"><div class="k">' + I('star') + 'Income</div><div class="v">' + rm(f.income) + '</div><div class="m4-sub">Handover fees</div></button>' +
    '<button type="button" class="tile m4-tile" data-mtab="exp"><div class="k">' + I('receipt') + 'Expenses paid</div><div class="v">' + rm(f.expenses) + '</div><div class="m4-sub">Everyday costs</div></button>' +
    '<button type="button" class="tile m4-tile" data-mtab="bal"><div class="k">' + I('cash') + 'Cash from customers</div><div class="v">' + rm(f.cash_received) + '</div><div class="m4-sub">' + rm(f.handed_in) + ' banked in' + (f.refunds_given ? '<br>' + rm(f.refunds_given) + ' deposits paid back' : '') + '</div></button>' +
    '<button type="button" class="tile m4-tile" data-mtab="bal"><div class="k">' + I('in') + 'From the company</div><div class="v">' + rm(f.from_owners) + '</div><div class="m4-sub">Floats and top-ups</div></button></div>' +
    '<div class="seg2 m4-tabs4">' + tabs.map(function (t) { return '<a href="javascript:void 0" data-mtab="' + t[0] + '" class="' + (mm.tab === t[0] ? 'on' : '') + '">' + t[1] + '</a>'; }).join('') + '</div>';
  var tab = mm.tab, body = '';
  if (tab === 'bal') {
    var led = R.ledger.slice().reverse();
    body = '<div class="list">' + (led.length ? led.map(function (e) {
      var inside = (e.code ? esc(e.code) + ' · ' : '') + esc(dShort(e.at)) + (e.note ? ' · ' + esc(e.note) : '');
      var tag = e.link ? 'a href="' + e.link + '"' : e.bankIn ? 'button type="button" data-bi="' + e.bankIn + '"' : 'div';
      return '<' + tag + ' class="card2 m4-led m4-a"><div class="c2-main"><div class="c2-t1">' + esc(e.desc) + '</div><div class="c2-t2">' + inside + '</div></div><div class="c2-end"><span class="' + (e.side === 'in' ? 'm4-in' : 'm4-out') + '">' + (e.side === 'in' ? '+' : '-') + rm(e.amt).replace('RM ', 'RM ') + '</span><small>Balance ' + rm(e.balance) + '</small></div></' + tag.split(' ')[0] + '>';
    }).join('') : '') + '<div class="card2 m4-led m4-bf"><div class="c2-main"><div class="c2-t1">Balance brought forward</div><div class="c2-t2">' + esc(dFull(per.from)) + '</div></div><div class="c2-end">' + rm(R.opening) + '</div></div></div>' +
      (led.length ? '' : '<p class="small muted m4-note">Nothing moved in this period.</p>');
  } else if (tab === 'inc') {
    var inc = R.ledger.filter(function (e) { return e.part === 'income'; }), by = {};
    inc.forEach(function (e) { var g = by[e.desc] = by[e.desc] || { n: 0, t: 0 }; g.n++; g.t += e.amt; });
    body = (inc.length ? '<div class="card m4-sum">' + Object.keys(by).sort(function (a, b) { return by[b].t - by[a].t; }).map(function (k) { return '<div class="sumline"><span>' + esc(k) + ' <span class="muted">× ' + by[k].n + '</span></span><span class="money">' + rm(by[k].t) + '</span></div>'; }).join('') + '<div class="sumline big"><span>Total</span><span class="money">' + rm(f.income) + '</span></div></div>' : '') +
      '<div class="list">' + (inc.length ? inc.slice().reverse().map(function (e) { return '<div class="card2"><div class="c2-main"><div class="c2-t1">' + esc(e.desc) + '</div><div class="c2-t2">' + esc(dShort(e.at)) + (e.code ? ' · ' + esc(e.code) : '') + '</div></div><div class="c2-end">' + rm(e.amt) + '</div></div>'; }).join('') : '<div class="empty">No handover fees in this period</div>') + '</div>' +
      '<p class="small muted m4-note">Handover fees are kept out of the cash held, so they come off the balance at hand.</p>';
  } else if (tab === 'exp') {
    var ex = R.ledger.filter(function (e) { return e.part === 'expenses'; });
    body = '<div class="list">' + (ex.length ? ex.slice().reverse().map(function (e) { var x = e.exp || {}, rcp = typeof Expenses !== 'undefined' && Expenses.receipt ? Expenses.receipt(x) : x.receipt; return '<div class="card2">' + (rcp ? '<span class="thumb dep-th"><img alt="" src="' + imgSrc(rcp) + '"></span>' : '<span class="dep-ic">' + I('receipt') + '</span>') + '<div class="c2-main"><div class="c2-t1">' + esc(x.kind || e.desc) + '</div><div class="c2-t2">' + esc(dShort(e.at)) + ' · ' + esc(x.paidWith || '') + (x.car ? ' · ' + esc((car(x.car) || {}).plate || '') : '') + (x.paidTo ? ' · ' + esc(x.paidTo) : '') + '</div></div><div class="c2-end">' + rm(e.amt) + '</div></div>'; }).join('') + '<div class="sumline big"><span>Total</span><span class="money">' + rm(f.expenses) + '</span></div>' : '<div class="empty">No everyday expenses in this period</div>') + '</div>';
  } else {
    var bis = (S.bankIns || []).filter(function (x) { return x.staff === pid && m4inRange(x.at, per.from, per.to); }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    body = '<div class="list">' + (bis.length ? bis.map(function (x) { return BankIn.row(x, false); }).join('') : '<div class="empty">No bank-ins in this period</div>') + '</div>';
  }
  html += body + '</main>';
  return { html: html, keepScroll: true, after: function () {
    m4mmWire(r);
    $$('[data-mtab]').forEach(function (el) { el.onclick = function () { moneyV.mm.tab = el.dataset.mtab; render(false, true); var t = $('.m4-tabs4'); if (t && el.classList.contains('tile')) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; });
    var b = $('#mmBi'); if (b) b.onclick = function () { BankIn.open({ staff: pid }); };
    m4wireBankIns();
  } };
};
function m4mmWire(r) {
  $$('[data-mper]').forEach(function (el) { el.onclick = function () {
    var k = el.dataset.mper;
    if (k !== 'custom') { moneyV.mm.per = k; render(false, true); return; }
    var c = moneyV.mm.custom || { from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() };
    var sh = sheet(sheetHead('Pick dates') + '<div class="dep-dt"><label class="field"><span>From</span><input class="inp" type="date" id="mmF" value="' + toLocalInput(c.from) + '" max="' + toLocalInput(new Date()) + '"></label><label class="field"><span>To</span><input class="inp" type="date" id="mmT" value="' + toLocalInput(c.to) + '" max="' + toLocalInput(new Date()) + '"></label></div><small class="err" id="mmErr"></small>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="mmGo">Show</button></div>');
    $('#mmGo', sh).onclick = function () {
      var a = $('#mmF', sh).value, b = $('#mmT', sh).value;
      if (!a || !b) { $('#mmErr', sh).textContent = 'Choose both days.'; return; }
      if (a > b) { $('#mmErr', sh).textContent = 'The first day must be before the last day.'; return; }
      moneyV.mm.custom = { from: fromInputs(a, '00:00'), to: fromInputs(b, '00:00') }; moneyV.mm.per = 'custom'; closeSheet(); render(false, true);
    };
  }; });
  var w = $('#mmWho'); if (w) w.onclick = function () {
    var cur = r.q.p || 'all';
    var sh = sheet(sheetHead('Whose money?') + '<div class="list"><button type="button" class="row" data-who="all"><span class="dep-ic">' + I('users') + '</span><div class="grow"><div class="t1">Everyone</div><div class="t2">One card per person</div></div>' + (cur === 'all' ? I('check', 2.4) : '') + '</button>' +
      S.staff.map(function (p) { return '<button type="button" class="row" data-who="' + p.id + '">' + m4av(p.name, true) + '<div class="grow"><div class="t1">' + esc(p.name) + (p.id === S.me ? ' (me)' : '') + '</div><div class="t2">' + esc(roleName(p.role)) + '</div></div>' + (cur === p.id ? I('check', 2.4) : '') + '</button>'; }).join('') + '</div>', null, { full: false });
    $$('[data-who]', sh).forEach(function (el) { el.onclick = function () { var id = el.dataset.who; moneyV.mm.tab = 'bal'; closeSheet(); if (id === cur) return; later(function () { location.hash = id === 'all' ? '#mymoney' : hashWith('mymoney', { p: id }); }, 60); }; });
  };
}

/* ---------- #instalments ---------- */
function instDays(from, to) { return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY); }
function instDay(d) { var p = String(d).split('-'); return +p[2] + ' ' + MO[+p[1] - 1] + ' ' + p[0]; }
function instWhen(r, today) {
  if (r.paidAt) return 'Paid on ' + instDay(r.paidAt);
  var n = instDays(today, r.due);
  if (n < 0) return 'Overdue by ' + (-n) + ' day' + (n === -1 ? '' : 's');
  if (n === 0) return 'Due today';
  return 'Due in ' + n + ' day' + (n === 1 ? '' : 's');
}
function instState(r, today) { return r.paidAt ? 'paid' : r.due < today ? 'overdue' : 'unpaid'; }
VIEWS.instalments = function () {
  if (!can('cars.see_instalment')) return { html: topbar('Instalments', { back: '#more' }) + '<main>' + noAccess('cars.see_instalment') + '</main>' };
  var V = moneyV.inst, today = toLocalInput(new Date());
  var rows = (S.instalments || []).filter(function (r) { var c = car(r.car); return c && (c.status !== 'sold' || r.paidAt); });
  /* search by plate, make, model or bank (the same matching as the car lists) */
  var q = String(V.q || '').trim(), hitQ = function (r) { if (!q) return true; var c = car(r.car) || {}; return normPlate(c.plate).indexOf(normPlate(q)) >= 0 || wordsMatch(q, [c.plate, c.make, c.model, (c.instalment || {}).bank].join(' ')); };
  var inMonth = rows.filter(function (r) { return (!V.month || r.due.slice(0, 7) === V.month) && hitQ(r); });
  var cnt = function (f) { return inMonth.filter(function (r) { var s = instState(r, today); return f === 'all' || s === f || (f === 'unpaid' && s === 'overdue'); }).length; };
  var list = inMonth.filter(function (r) { var s = instState(r, today); return V.f === 'all' || s === V.f || (V.f === 'unpaid' && s === 'overdue'); })
    .sort(function (a, b) { return V.f === 'paid' ? (a.paidAt < b.paidAt ? 1 : -1) : (a.due < b.due ? -1 : a.due > b.due ? 1 : 0); });
  var mLabel = V.month ? MO[+V.month.slice(5, 7) - 1] + ' ' + V.month.slice(0, 4) : 'All months';
  var unpaidT = m4sum(list.filter(function (r) { return !r.paidAt; }), function (r) { return r.amt; });
  var html = topbar('Instalments', { back: '#more', sub: S.cars.filter(function (c) { return c.instalment && c.status !== 'sold'; }).length + ' cars on a loan' }) + '<main class="m4-main">' +
    '<div class="m4-month"><button type="button" class="iconbtn" id="imPrev" aria-label="Previous month">' + I('back', 2.2) + '</button><button type="button" class="m4-mlabel" id="imAll">' + esc(mLabel) + (V.month ? '<small>Tap for all months</small>' : '<small>Use the arrows for one month</small>') + '</button><button type="button" class="iconbtn m4-next" id="imNext" aria-label="Next month">' + I('back', 2.2) + '</button></div>' +
    '<label class="search m4-instq">' + I('search') + '<input id="imq" type="search" placeholder="Plate, model or bank" value="' + esc(V.q || '') + '" autocomplete="off" autocapitalize="characters" enterkeyhint="search"></label>' +
    m4chips(V.f, [['unpaid', 'Unpaid', cnt('unpaid')], ['overdue', 'Overdue', cnt('overdue')], ['paid', 'Paid', cnt('paid')], ['all', 'All', cnt('all')]], 'if') +
    (unpaidT && V.f !== 'paid' ? '<div class="m4-insttot small muted">Still to pay: <b class="money">' + rm(unpaidT) + '</b></div>' : '') +
    '<div class="list">' + (list.length ? list.map(function (r) {
      var c = car(r.car) || {}, s = instState(r, today), n = instDays(today, r.due), tone = s === 'paid' ? 'green' : s === 'overdue' ? 'red' : n <= 3 ? 'amber' : 'grey';
      return '<button type="button" class="card2 m4-inst" data-inst="' + r.id + '"><div class="c2-main"><div class="c2-t1">' + esc(c.plate) + ' · ' + esc(c.make + ' ' + c.model) + '</div><div class="c2-t2">Due ' + esc(instDay(r.due)) + ((c.instalment || {}).bank ? ' · ' + esc(c.instalment.bank) : '') + '</div><div class="dep-chips">' + chip(instWhen(r, today), tone) + '</div></div><div class="c2-end">' + rm(r.paidAt && r.paidAmt != null ? r.paidAmt : r.amt) + (r.paidAt && r.paidWith ? '<small>' + esc(r.paidWith) + '</small>' : '') + '</div></button>';
    }).join('') : '<div class="empty">' + (V.f === 'paid' ? 'No paid instalments here yet.' : q ? 'No instalment matches “' + esc(q) + '”.' : V.f === 'overdue' ? 'Nothing overdue. Well done.' : 'Nothing to show. Instalments appear for cars that have an instalment day and amount.') + '</div>') + '</div></main>';
  return { html: html, keepScroll: true, after: function () {
    $$('[data-if]').forEach(function (el) { el.onclick = function () { V.f = el.dataset.if; render(false, true); }; });
    var step = function (k) { var b = V.month ? new Date(+V.month.slice(0, 4), +V.month.slice(5, 7) - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth() - (k > 0 ? 1 : -1), 1); b.setMonth(b.getMonth() + k); V.month = b.getFullYear() + '-' + pad(b.getMonth() + 1); render(false, true); };
    $('#imPrev').onclick = function () { step(-1); }; $('#imNext').onclick = function () { step(1); };
    $('#imAll').onclick = function () { V.month = V.month ? null : toLocalInput(new Date()).slice(0, 7); render(false, true); };
    $$('[data-inst]').forEach(function (el) { el.onclick = function () { instSheet(el.dataset.inst); }; });
    var qi = $('#imq'), tm = null;
    if (qi) {
      if (V.qFocus) { V.qFocus = false; qi.focus(); var n = qi.value.length; try { qi.setSelectionRange(n, n); } catch (e) {} }
      qi.addEventListener('input', function () { V.q = qi.value; clearTimeout(tm); tm = setTimeout(function () { V.qFocus = document.activeElement === qi; render(false, true); }, 180); });
    }
  } };
};
function instSheet(id) {
  var r = byId(S.instalments, id); if (!r) return;
  var c = car(r.car) || {}, today = toLocalInput(new Date());
  if (r.paidAt) {
    var ex = byId(S.expenses, r.expenseId || 'installment-' + r.id);
    var sh0 = sheet(sheetHead('Instalment paid', c.plate + ' · due ' + instDay(r.due)) +
      '<div class="kv"><div><div class="k">Paid on</div><div class="v">' + esc(instDay(r.paidAt)) + '</div></div><div><div class="k">Amount</div><div class="v money">' + rm(r.paidAmt != null ? r.paidAmt : r.amt) + '</div></div><div><div class="k">Paid with</div><div class="v">' + esc(r.paidWith || 'Not given') + '</div></div><div><div class="k">Expense</div><div class="v">' + (ex && !ex.voided ? 'Hire purchase recorded' : 'None') + '</div></div></div>' +
      (can('expenses.edit_all') || can('expenses.add_business') ? '<div class="sheet-foot"><button type="button" class="btn link red" id="imUndo">Mark as not paid</button></div>' : ''), null, {});
    var u = $('#imUndo', sh0); if (u) u.onclick = function () {
      confirm({ icon: 'warn', title: 'Mark as not paid?', text: 'The hire purchase expense for this instalment is voided too.', ok: 'Mark as not paid', cancel: 'Keep it paid', primary: 'cancel', danger: true }).then(function (yes) {
        if (!yes) return;
        if (ex) { ex.voided = true; ex.changedBy = S.me; ex.changedAt = new Date().toISOString(); }
        var was = r.paidAt; r.paidAt = null; r.paidAmt = null; r.paidWith = null;
        audit('Instalment of ' + c.plate + ' due ' + instDay(r.due) + ' marked as not paid (was paid on ' + instDay(was) + ')', { car: c.id, link: '#instalments' });
        save(); closeAllSheets(); say('Marked as not paid'); render(false, true);
      });
    };
    return;
  }
  var st = { with: 'Bank transfer' };
  var sh = sheet(sheetHead('Mark instalment paid', c.plate + ' · ' + c.make + ' ' + c.model) +
    '<div class="card dep-due"><span>Due ' + esc(instDay(r.due)) + '</span><b class="money">' + rm(r.amt) + '</b></div>' +
    '<label class="field"><span>Paid on</span><input class="inp" type="date" id="imOn" max="' + today + '" value="' + (r.due <= today ? r.due : today) + '"><small class="err" id="imOnErr"></small></label>' +
    '<label class="field"><span>Amount paid (optional)</span><div class="rmfield"><input class="inp num" id="imAmt" inputmode="decimal" placeholder="' + money2(r.amt) + '"></div><small class="hint">Leave empty if you paid the amount due. Type it only if you paid a different amount.</small><small class="err" id="imAmtErr"></small></label>' +
    '<div class="field"><span>Paid with</span><div class="seg" id="imWith">' + ['Bank transfer', 'Cash', 'Card', 'Other'].map(function (m) { return '<button type="button" class="' + (m === st.with ? 'on' : '') + '">' + m + '</button>'; }).join('') + '</div></div>' +
    '<div class="sheet-foot"><button type="button" class="btn big" id="imGo">' + I('check', 2.4) + 'Mark paid</button></div>', null, {});
  segPick('#imWith', function (t) { st.with = t; });
  $('#imGo', sh).onclick = function () {
    var on = $('#imOn', sh).value, typed = $('#imAmt', sh).value.trim(), amt = typed ? parseMoney(typed) : r.amt, ok = true;
    $('#imOnErr', sh).textContent = ''; $('#imAmtErr', sh).textContent = '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) { $('#imOnErr', sh).textContent = 'Choose the day it was paid.'; ok = false; }
    else if (on > toLocalInput(new Date())) { $('#imOnErr', sh).textContent = 'That day is in the future.'; ok = false; }
    if (!(amt > 0)) { $('#imAmtErr', sh).textContent = 'Enter the amount as a number, for example 850 or 850.50.'; ok = false; }
    if (!ok) return;
    if (r.paidAt) { say('This instalment was already marked paid.'); closeSheet(); render(false, true); return; }
    var eid = 'installment-' + r.id, at = fromInputs(on, '10:00').toISOString();
    var e = byId(S.expenses, eid), data = { kind: 'Hire purchase', amt: amt, at: at, car: c.id, booking: null, paidWith: st.with, paidTo: (c.instalment || {}).bank || '', note: 'Instalment ' + MO[+r.due.slice(5, 7) - 1] + ' ' + r.due.slice(0, 4), receipt: null, by: S.me, agentFee: false, group: null, voided: false };
    if (e) Object.assign(e, data, { changedBy: S.me, changedAt: new Date().toISOString() }); else { S.expenses = S.expenses || []; S.expenses.push(Object.assign({ id: eid, created: new Date().toISOString() }, data)); }
    r.paidAt = on; r.paidAmt = amt; r.paidWith = st.with; r.expenseId = eid;
    audit('Instalment of ' + c.plate + ' due ' + instDay(r.due) + ' marked paid: ' + rm(amt) + ' by ' + st.with.toLowerCase(), { car: c.id, link: '#instalments' });
    save(); closeSheet(); notify('pay', 'Instalment of ' + c.plate + ' marked paid.', rm(amt), '#instalments', { self: true }); render(false, true);
  };
}

/* ---------- seed: regular bank-ins so the cash held looks like a real week, and who handed cash deposits back ---------- */
SEEDERS.push({ key: 'm4Cash', fn: function (d, x) {
  d.m4Cash = 1;
  d.bankIns = d.bankIns || [];
  var now = Date.now(), monday = sod(new Date()); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  (d.refunds || []).forEach(function (r) { if (r.method === 'Cash' && !r.refundBy) r.refundBy = r.by; });
  var per = {};
  d.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (!p.voided && p.method === 'Cash' && p.cashTo) (per[p.cashTo] = per[p.cashTo] || []).push({ t: new Date(p.at).getTime(), a: payTotal(p) }); }); });
  /* what a person keeps or is given out of that cash: their handover fees and everyday expenses come off, company floats add */
  var everyday = {}; ((d.settings || {}).expenseKinds || []).forEach(function (k) { if (k.everyday) everyday[k.name] = 1; });
  (d.expenses || []).forEach(function (e) {
    if (e.voided) return;
    var pid = e.toStaff || e.by, sign = e.toStaff ? 1 : (e.agentFee || everyday[e.kind]) ? -1 : 0;
    if (sign && per[pid]) per[pid].push({ t: new Date(e.at).getTime(), a: sign * (+e.amt || 0) });
  });
  var refundsBy = {}; (d.refunds || []).forEach(function (r) { if (!r.voided && r.method === 'Cash' && r.refundBy) refundsBy[r.refundBy] = (refundsBy[r.refundBy] || 0) + (+r.amt || 0); });
  var existing = {}; d.bankIns.forEach(function (bi) { if (!bi.voided) existing[bi.staff] = (existing[bi.staff] || 0) + (+bi.amt || 0); });
  Object.keys(per).forEach(function (pid, pi) {
    var pays = per[pid].sort(function (a, b) { return a.t - b.t; }), banked = (existing[pid] || 0) + (refundsBy[pid] || 0), mine = [];
    var recv = function (upto) { return pays.reduce(function (s, p) { return s + (p.t <= upto ? p.a : 0); }, 0); };
    var lazy = pi === 2; /* one person banks in every two weeks, so their cash is older */
    for (var w = 10; w >= 0; w--) {
      if (lazy && w % 2) continue;
      var day = monday.getTime() - w * 7 * DAY + (16 + (pi % 3)) * HOUR + (pi * 7 % 50) * MIN, cut = day - 3 * DAY;
      var amt = Math.floor((recv(cut) - banked) * (0.82 + x.R() * 0.18) / 10) * 10;
      if (w === 10) amt = Math.floor((recv(cut) - banked) / 10) * 10; /* the first one clears everything older */
      if (amt < 50 || day > now) continue;
      var rec = { id: uid(), staff: pid, amt: amt, at: new Date(day).toISOString(), slip: 'demo:slip:Cash deposit', slipHash: uid(), ref: 'CDM' + x.ri(100000, 999999), by: pid, created: new Date(day).toISOString(), voided: false };
      d.bankIns.push(rec); mine.push(rec); banked += amt;
    }
    /* never leave anyone owed by the bank-ins themselves */
    var held = recv(now) - banked;
    while (held < 0 && mine.length) { var last = mine.pop(), cutBy = Math.min(last.amt, Math.ceil((-held + 120) / 10) * 10); last.amt -= cutBy; held += cutBy; if (last.amt <= 0) d.bankIns.splice(d.bankIns.indexOf(last), 1); }
  });
  /* one voided by mistake, to show the rule */
  var v = d.bankIns.filter(function (bi) { return bi.staff === 's3'; })[0];
  if (v) d.bankIns.push({ id: uid(), staff: 's3', amt: v.amt, at: v.at, slip: 'demo:slip:Cash deposit', slipHash: uid(), ref: '', by: 's3', created: v.created || v.at, voided: true, voidReason: 'Recorded twice by mistake', voidedBy: 's2', voidedAt: new Date(new Date(v.at).getTime() + 3 * HOUR).toISOString() });
} });

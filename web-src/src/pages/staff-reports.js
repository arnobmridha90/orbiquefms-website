/* ===================================================================
   Page: Staff income and expenses (#page=staff-reports)   Owner: W3
   Each staff member's income (handover fees), expenses (everyday kinds they paid) and the balance they have in hand:
     + cash they received from customers (cash payments they took)
     + payments from the company to them (the "Payment to staff" kind, which names the person)
     - what they paid for the company (their everyday expenses)
     - deposits they handed back in cash
     - cash handed in (their bank-ins, not voided)
     - their handover fees (they keep their fee out of the cash they hold)
   Positive: they hold that much of the company's money. Negative: the company owes them that much.
   Each person sees their own; someone with expenses.staff_reports_all sees everyone and can pick one person.
   =================================================================== */
var SR_PARTS = [['income', 'Income'], ['expenses', 'Expenses'], ['from_owners', 'From company'], ['cash_received', 'Cash received'], ['refunds_given', 'Deposits handed back'], ['handed_in', 'Cash handed in'], ['opening', 'Balance at start'], ['closing', 'Balance at hand']];
function srDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function srIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function srParse(s) { if (!s) return null; var p = String(s).split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
/* every entry behind a person's figures between two moments (from inclusive, to exclusive; null = open) */
function srEntries(uid, from, to) {
  var d = D(), u = byId(d.users, uid); if (!u) return [];
  var inR = function (t) { return (!from || t >= from) && (!to || t < to); }, out = [];
  d.expenses.forEach(function (e) {
    if (e.source && e.source !== 'recorded') return;
    var c = byId(d.expenseCats, e.cat); if (!c || !inR(e.day)) return;
    var car = carById(e.car), base = { date: e.day, at: new Date(e.day.getFullYear(), e.day.getMonth(), e.day.getDate(), 12), booking: e.booking || '', plate: car ? car.plate : '', note: e.note || '', ref: e.id, amount: e.amount };
    if (c.agentFee && e.by === uid) out.push(Object.assign({ part: 'income', kind: c.name, way: 'out', desc: c.name }, base));
    else if (!c.agentFee && !c.paysStaff && c.group !== 'Office and admin' && e.by === uid) out.push(Object.assign({ part: 'expenses', kind: c.name, way: 'out', desc: 'Expense paid: ' + c.name }, base));
    if (c.paysStaff && e.staff === uid) out.push(Object.assign({ part: 'from_owners', kind: c.name, way: 'in', desc: 'From the company: ' + c.name }, base));
  });
  d.payments.forEach(function (p) {
    if (p.void || p.method !== 'Cash' || (p.heldBy || p.by) !== u.name || !inR(p.at)) return;
    var x = findBooking(p.booking);
    out.push({ part: 'cash_received', kind: p.kind, way: 'in', desc: 'Cash from customer: ' + p.kind, date: p.at, at: p.at, booking: p.booking || '', plate: x ? x.car.plate : '', note: x ? x.cust.name : '', amount: p.amount, ref: p.id });
  });
  d.deposits.forEach(function (z) {
    var f = z.refund; if (!f || f.method !== 'Cash' || f.by !== u.name || !(f.amount > 0) || !inR(f.at)) return;
    var x = findBooking(z.booking);
    out.push({ part: 'refunds_given', kind: 'Deposit refund', way: 'out', desc: 'Deposit handed back', date: f.at, at: f.at, booking: z.booking, plate: x ? x.car.plate : '', note: x ? x.cust.name : '', amount: f.amount, ref: z.id });
  });
  (d.bankIns || []).forEach(function (b) {
    if (b.voided || b.staff !== uid || !inR(b.at)) return;
    out.push({ part: 'handed_in', kind: 'Cash banked in', way: 'out', desc: 'Cash banked in', date: b.at, at: b.at, booking: '', plate: '', note: b.note || (b.ref ? 'Ref ' + b.ref : ''), amount: b.amount, ref: b.id });
  });
  return out;
}
function srFigures(list) { var f = {}; SR_PARTS.slice(0, 6).forEach(function (p) { f[p[0]] = 0; }); list.forEach(function (e) { f[e.part] += e.amount; }); return f; }
function srInHand(f) { return Math.round((f.cash_received + f.from_owners - f.expenses - f.refunds_given - f.handed_in - f.income) * 100) / 100; }
/* the report for a period: {people [{id, name, ...parts, opening, closing}], detail for one person} */
function srBuild(from, to, person, everyone) {
  var end = new Date(to.getTime() + DAY), ids = everyone ? D().users.map(function (u) { return u.id; }) : [me().id];
  var people = [];
  ids.forEach(function (uid) {
    var u = byId(D().users, uid), before = srFigures(srEntries(uid, null, from)), during = srEntries(uid, from, end), f = srFigures(during), opening = srInHand(before);
    if (everyone && !u.active && !during.length && !opening) return;
    people.push(Object.assign({ id: uid, name: u.name, entries: during, opening: opening, closing: Math.round((opening + srInHand(f)) * 100) / 100 }, f));
  });
  people.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
  var who = person ? people.filter(function (p) { return p.id === person; })[0] || null : everyone ? null : people[0];
  var ledger = null;
  if (who) {
    var bal = who.opening; ledger = [{ date: from, booking: '', desc: 'Balance brought forward', note: '', inn: null, out: null, balance: bal, first: true }];
    who.entries.slice().sort(function (a, b) { return a.at - b.at || (a.way === 'out') - (b.way === 'out'); }).forEach(function (e) {
      bal = Math.round((bal + (e.way === 'in' ? e.amount : -e.amount)) * 100) / 100;
      ledger.push({ date: e.date, booking: e.booking, desc: e.desc, note: e.note, inn: e.way === 'in' ? e.amount : null, out: e.way === 'out' ? e.amount : null, balance: bal });
    });
  }
  return { people: people, who: who, ledger: ledger };
}
function srModel(R, from, to, everyone) {
  var period = UI.fmt.date(from) + ' to ' + UI.fmt.date(to), who = R.who, m = { title: 'Staff income and expenses', period: period, info: [], kpis: [], sections: [], notes: [] };
  m.desc = 'Income, expenses and the balance at hand. All amounts in RM.';
  m.file = 'staff-income-and-expenses' + (who ? '-' + who.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '') + '-' + srIso(from) + '_to_' + srIso(to);
  var ec = [{ l: 'Date', t: 'date', w: 11 }, { l: 'Booking ID', w: 12 }, { l: 'Car', w: 11 }, { l: 'Kind', w: 30 }, { l: 'Amount', t: 'money', w: 13 }];
  var rows = function (part, note) { return who.entries.filter(function (e) { return e.part === part; }).sort(function (a, b) { return b.at - a.at; }).map(function (e) { return [e.date, e.booking || '', e.plate || '', note && e.note ? { t: e.kind, s: e.note } : e.kind, e.amount]; }); };
  if (who) {
    m.info = [['Staff member', who.name]];
    m.kpis = [{ l: 'Balance at hand', raw: who.closing, t: 'money', hero: true, note: who.closing < 0 ? 'The company owes them this' : 'Company money they hold' }, { l: 'Income', raw: who.income, t: 'money', note: 'Handover fees' }, { l: 'Expenses paid', raw: who.expenses, t: 'money' }, { l: 'Cash from customers', raw: who.cash_received, t: 'money' }, { l: 'From the company', raw: who.from_owners, t: 'money' }];
    var tin = sum(R.ledger.map(function (r) { return r.inn || 0; })), tout = sum(R.ledger.map(function (r) { return r.out || 0; }));
    m.sections.push({ title: 'Balance', sheet: 'Balance', noFormula: true, cols: [{ l: 'Date', t: 'date', w: 11 }, { l: 'Booking ID', w: 12 }, { l: 'Description', w: 38 }, { l: 'In', t: 'money', w: 12 }, { l: 'Out', t: 'money', w: 12 }, { l: 'Balance at hand', t: 'money', w: 14, strong: true }],
      rows: R.ledger.map(function (r) { return [r.date, r.booking || '', r.note ? { t: r.desc, s: r.note } : r.desc, r.inn == null ? '' : r.inn, r.out == null ? '' : r.out, r.balance]; }), total: ['Total, and balance at hand', '', '', tin, tout, who.closing] });
    m.sections.push({ title: 'Staff-wise income (handover fees)', sheet: 'Staff-wise income', cols: ec, rows: rows('income'), total: ['Total', '', '', '', who.income], empty: 'No handover fees in this period.' });
    m.sections.push({ title: 'Staff-wise expense (everyday kinds they paid)', sheet: 'Staff-wise expense', cols: ec, rows: rows('expenses', true), total: ['Total', '', '', '', who.expenses], empty: 'No expenses in this period.' });
  } else {
    m.info = [['Staff', 'Everyone']];
    var t = function (k) { return sum(R.people.map(function (p) { return p[k]; })); };
    m.kpis = [{ l: 'Balance at hand', raw: t('closing'), t: 'money', hero: true, note: 'Everyone together' }, { l: 'Income', raw: t('income'), t: 'money', note: 'Handover fees' }, { l: 'Expenses paid', raw: t('expenses'), t: 'money' }, { l: 'Staff', raw: R.people.length, t: 'int' }];
    m.sections.push({ title: 'Everyone', sheet: 'Everyone', cols: [{ l: 'Staff', w: 16 }].concat(SR_PARTS.map(function (p) { return { l: p[1], t: 'money', w: 12 }; })), rows: R.people.map(function (p) { return [p.name].concat(SR_PARTS.map(function (q) { return p[q[0]]; })); }), total: ['Total'].concat(SR_PARTS.map(function (q) { return t(q[0]); })) });
  }
  m.notes = ['Income = the handover fees they recorded. Expenses = the everyday kinds they recorded and paid (not handover fees, not office and admin costs, which the office pays).', 'Balance at hand = cash from customers + money from the company - expenses paid - deposits handed back in cash - cash banked in - their handover fees. Positive: they hold company money. Negative: the company owes them.', 'Balance at start is the same sum for everything before the period.'];
  m.sheets = function () { return rptAutoBook(m); };
  return m;
}
function srLedgerTable(el, rows, closing) {
  var neg = function (v) { return '<span class="' + (v < 0 ? 'sr-neg' : '') + '">' + UI.money(v) + '</span>'; };
  UI.table(el, { rows: rows.map(function (r, k) { return Object.assign({ k: k }, r); }), rowKey: 'k', density: 'compact', pageSize: false, minWidth: 760, maxHeight: '70vh',
    columns: [{ key: 'date', label: 'Date', render: function (r) { return '<span class="nowrap">' + esc(UI.fmt.date(r.date)) + '</span>'; } }, { key: 'booking', label: 'Booking ID', render: function (r) { return r.booking ? '<button type="button" class="inv-link" data-bk="' + esc(r.booking) + '" data-stop>' + esc(r.booking) + '</button>' : ''; } },
      { key: 'desc', label: 'Description', render: function (r) { return (r.first ? '<b>' + esc(r.desc) + '</b>' : esc(r.desc)) + (r.note ? '<small class="sr-sm">' + esc(r.note) + '</small>' : ''); } },
      { key: 'inn', label: 'In', money: true, render: function (r) { return r.inn == null ? '' : '<span class="sr-in">' + UI.money(r.inn) + '</span>'; } }, { key: 'out', label: 'Out', money: true, render: function (r) { return r.out == null ? '' : '<span class="sr-out">' + UI.money(r.out) + '</span>'; } },
      { key: 'balance', label: 'Balance at hand', money: true, render: function (r) { return '<b>' + neg(r.balance) + '</b>'; } }],
    card: function (r) { return '<div class="sr-card"><div class="row"><span class="grow">' + (r.first ? '<b>' + esc(r.desc) + '</b>' : esc(r.desc)) + '<small class="sr-sm">' + esc(UI.fmt.date(r.date)) + (r.booking ? ' · ' + esc(r.booking) : '') + (r.note ? ' · ' + esc(r.note) : '') + '</small></span><span class="sr-amt">' + (r.inn != null ? '<span class="sr-in">+' + UI.money(r.inn) + '</span>' : r.out != null ? '<span class="sr-out">-' + UI.money(r.out) + '</span>' : '') + '<small>Balance <b>' + neg(r.balance) + '</b></small></span></div></div>'; },
    footer: function () { return '<tr><td colspan="3"><b>Total, and balance at hand</b></td><td class="c">' + UI.money(sum(rows.map(function (r) { return r.inn || 0; }))) + '</td><td class="c">' + UI.money(sum(rows.map(function (r) { return r.out || 0; }))) + '</td><td class="c"><b>' + neg(closing) + '</b></td></tr>'; } });
}
function srEntryTable(el, list, note, empty) {
  UI.table(el, { rows: list, rowKey: 'ref', density: 'compact', pageSize: false, minWidth: 640, maxHeight: '70vh',
    columns: [{ key: 'date', label: 'Date', render: function (e) { return '<span class="nowrap">' + esc(UI.fmt.date(e.date)) + '</span>'; } }, { key: 'booking', label: 'Booking ID', render: function (e) { return e.booking ? '<button type="button" class="inv-link" data-bk="' + esc(e.booking) + '" data-stop>' + esc(e.booking) + '</button>' : ''; } }, { key: 'plate', label: 'Car' },
      { key: 'kind', label: 'Kind', render: function (e) { return esc(e.kind) + (note && e.note ? '<small class="sr-sm">' + esc(e.note) + '</small>' : ''); } }, { key: 'amount', label: 'Amount', money: true }],
    onRowClick: function (e) { if (API.openExpense) API.openExpense(e.ref); },
    card: function (e) { return '<div class="row gap10"><div class="grow"><b>' + esc(e.kind) + '</b><small class="sr-sm">' + esc(UI.fmt.date(e.date)) + (e.booking ? ' · ' + esc(e.booking) : '') + (e.plate ? ' · ' + esc(e.plate) : '') + (note && e.note ? ' · ' + esc(e.note) : '') + '</small></div><b>' + UI.money(e.amount) + '</b></div>'; },
    footer: list.length ? function () { return '<tr><td colspan="4"><b>Total</b></td><td class="c"><b>' + UI.money(sum(list.map(function (e) { return e.amount; }))) + '</b></td></tr>'; } : null,
    empty: { icon: 'receipt-off', title: empty, text: 'Choose a longer period to see more.' } });
}

PAGES['staff-reports'] = {
  title: 'Staff income and expenses',
  search: [{ label: 'My staff report (balance at hand)', icon: 'user-dollar', run: function () { go('staff-reports'); } }],
  render: function (root, ctx) {
    if (!ctx.can('expenses.view')) { root.innerHTML = UI.empty({ icon: 'lock', title: 'You do not have access to this page', text: 'Ask the owner to give your account the Expenses permission.' }); return; }
    var st = ctx.state, P = ctx.params, everyone = ctx.can('expenses.staff_reports_all'), n = NOW();
    if (!st.from) { st.from = srIso(new Date(n.getFullYear(), n.getMonth(), 1)); st.to = srIso(new Date(n.getFullYear(), n.getMonth() + 1, 0)); }
    if (P.person !== undefined && st.pp !== P.person) { st.pp = P.person; st.person = P.person || ''; }
    if (!everyone) st.person = me().id;
    st.tab = st.tab || 'balance';
    var from = srParse(st.from), to = srParse(st.to), bad = !from || !to ? 'Choose the first and the last day.' : to < from ? 'The last day is before the first day.' : '';
    var R = bad ? null : srBuild(from, to, st.person, everyone), who = R && R.who, m = R ? srModel(R, from, to, everyone) : null;
    var canBank = typeof API.bankIn === 'function';
    root.innerHTML = '<div class="sr-head"><h1>Staff income and expenses</h1><p>' + (everyone ? 'Each staff member\'s income, expenses and the balance they have in hand. Each person sees only their own.' : 'Your income, your expenses and the company money you hold. Only you and the owners can see this.') + '</p></div>' +
      '<div class="card sr-card0"><div class="sr-bar"><div class="sr-dates">' + UI.dateField({ key: 'from', label: 'From', value: st.from, chips: false }) + UI.dateField({ key: 'to', label: 'To', value: st.to, chips: false }) +
      (everyone ? UI.select({ key: 'person', label: 'Person', value: st.person || '', placeholder: 'Everyone', options: (R ? R.people : D().users).map(function (p) { return [p.id, p.name + (p.id === me().id ? ' (Me)' : '')]; }) }) : '') + '</div>' +
      '<div class="sr-acts">' + (canBank ? UI.btn('Bank in cash', { icon: 'building-bank', attrs: { 'data-bank': '1' } }) : '') + UI.btn('Excel', { kind: 'o', icon: 'file-spreadsheet', disabled: !!bad, attrs: { 'data-xl': '1' } }) + UI.btn('PDF', { kind: 'o', icon: 'file-type-pdf', disabled: !!bad, attrs: { 'data-pdf': '1' } }) + '</div></div>' +
      (bad ? '<p class="sr-bad">' + i('alert-circle') + esc(bad) + '</p>' : '') + '<div id="sr-body"></div></div>';
    var body = root.querySelector('#sr-body');
    if (R) {
      body.innerHTML = '<div class="pg-reports sr-k">' + rptKpisHtml(m, true) + '</div>' + (who ? (everyone ? '<button type="button" class="inv-link sr-back" data-all>' + i('arrow-left') + 'Everyone</button>' : '') + '<div class="sr-tabs" id="sr-tabs"></div><div id="sr-tab"></div>' : '<h4 class="sr-h">EVERYONE</h4><div id="sr-all"></div><p class="b2 sr-tip">Tap a name for that person\'s details.</p>');
      if (!who) {
        UI.table(body.querySelector('#sr-all'), { rows: R.people, rowKey: 'id', density: 'compact', pageSize: false, minWidth: 1100, onRowClick: function (p) { st.person = p.id; st.tab = 'balance'; ctx.setParams({ person: p.id }); st.pp = p.id; ctx.refresh(); },
          columns: [{ key: 'name', label: 'Staff', render: function (p) { return '<button type="button" class="inv-link" data-sp="' + esc(p.id) + '">' + esc(p.name) + '</button>'; } }].concat(SR_PARTS.map(function (q) { return { key: q[0], label: q[1], money: true, render: function (p) { var v = p[q[0]], h = UI.money(v); return q[0] === 'closing' ? '<b class="' + (v < 0 ? 'sr-neg' : '') + '">' + h + '</b>' : h; } }; })),
          footer: function () { return '<tr><td><b>Total</b></td>' + SR_PARTS.map(function (q) { return '<td class="c"><b>' + UI.money(sum(R.people.map(function (p) { return p[q[0]]; }))) + '</b></td>'; }).join('') + '</tr>'; },
          card: function (p) { return '<div class="sr-pc"><div class="row"><b class="grow">' + esc(p.name) + '</b><span class="sr-amt"><small>Balance at hand</small><b class="' + (p.closing < 0 ? 'sr-neg' : '') + '">' + UI.money(p.closing) + '</b></span></div><div class="sr-pg">' + SR_PARTS.slice(0, 7).map(function (q) { return '<span><small>' + esc(q[1]) + '</small>' + UI.money(p[q[0]]) + '</span>'; }).join('') + '</div></div>'; } });
      } else {
        var tabs = [{ id: 'balance', label: 'Balance' }, { id: 'income', label: 'Staff-wise income', count: who.entries.filter(function (e) { return e.part === 'income'; }).length }, { id: 'expense', label: 'Staff-wise expense', count: who.entries.filter(function (e) { return e.part === 'expenses'; }).length }, { id: 'bankins', label: 'Bank-ins' }];
        var drawTab = function () {
          var el = body.querySelector('#sr-tab');
          if (st.tab === 'balance') srLedgerTable(el, R.ledger, who.closing);
          else if (st.tab === 'income') srEntryTable(el, who.entries.filter(function (e) { return e.part === 'income'; }).sort(function (a, b) { return b.at - a.at; }), false, 'No handover fees in this period');
          else if (st.tab === 'expense') srEntryTable(el, who.entries.filter(function (e) { return e.part === 'expenses'; }).sort(function (a, b) { return b.at - a.at; }), true, 'No expenses in this period');
          else {
            var bl = (D().bankIns || []).filter(function (b) { return b.staff === who.id; });
            el.innerHTML = '<div class="sr-bih"><p class="b2">Cash ' + esc(who.name.split(' ')[0]) + ' paid into the company bank. A voided one is not counted.</p>' + (canBank ? UI.btn('Bank in cash', { kind: 'tonal', size: 'sm', icon: 'plus', attrs: { 'data-bank': '1' } }) : '') + '</div><div id="sr-bit"></div>';
            UI.table(el.querySelector('#sr-bit'), { rows: bl, rowKey: 'id', density: 'compact', pageSize: 10, minWidth: 640,
              columns: [{ key: 'at', label: 'Banked in', render: function (b) { return '<span class="nowrap">' + esc(UI.fmt.dt(b.at)) + '</span>'; } }, { key: 'ref', label: 'Reference', render: function (b) { return esc(b.ref || '-') + (b.note ? '<small class="sr-sm">' + esc(b.note) + '</small>' : ''); } }, { key: 'slip', label: 'Slip', render: function (b) { return b.slip ? i('paperclip') + ' ' + esc(b.slip.name) : '-'; } }, { key: 'st', label: 'Status', render: function (b) { return b.voided ? UI.chip('Voided', 'grey') + '<small class="sr-sm">' + esc(b.voided.reason || '') + '</small>' : UI.chip('Counted', 'ok'); } }, { key: 'amount', label: 'Amount', money: true, render: function (b) { return '<span class="' + (b.voided ? 'sr-void' : '') + '">' + UI.money(b.amount) + '</span>'; } }],
              card: function (b) { return '<div class="row gap10"><div class="grow"><b>' + esc(UI.fmt.dt(b.at)) + '</b><small class="sr-sm">' + esc(b.ref || '') + (b.note ? ' · ' + esc(b.note) : '') + '</small>' + (b.voided ? UI.chip('Voided', 'grey') : '') + '</div><b class="' + (b.voided ? 'sr-void' : '') + '">' + UI.money(b.amount) + '</b></div>'; },
              empty: { icon: 'building-bank', title: 'No bank-ins yet', text: canBank ? 'Press Bank in cash when the cash goes into the bank.' : '' } });
          }
        };
        UI.tabs(body.querySelector('#sr-tabs'), { items: tabs, value: st.tab, kind: 'line', onChange: function (v) { st.tab = v; drawTab(); } });
        drawTab();
      }
    }
    root.addEventListener('change', function (ev) {
      var k = ev.target.getAttribute('data-key');
      if (k === 'from' || k === 'to') { st[k] = ev.target.value; ctx.refresh(); }
      else if (k === 'person') { st.person = ev.target.value; st.pp = st.person; st.tab = 'balance'; ctx.setParams({ person: st.person || null }); ctx.refresh(); }
    });
    UI.on(root, 'click', '[data-sp]', function (ev, el) { var id = el.getAttribute('data-sp'); st.person = id; st.pp = id; st.tab = 'balance'; ctx.setParams({ person: id }); ctx.refresh(); });
    UI.on(root, 'click', '[data-all]', function () { st.person = ''; st.pp = ''; ctx.setParams({ person: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-bk]', function (ev, el) { API.openBooking(el.getAttribute('data-bk')); });
    UI.on(root, 'click', '[data-bank]', function () { API.bankIn(who ? who.id : me().id); });
    UI.on(root, 'click', '[data-xl]', function () { if (!m) return; rptXlsx(m.file + '.xlsx', m.sheets()); DB.log('Exported', 'Expense', '', me().name + ' downloaded the staff report (Excel, ' + m.period + ')'); });
    UI.on(root, 'click', '[data-pdf]', function () { if (!m) return; rptPdf(m, m.file + '.pdf'); DB.log('Exported', 'Expense', '', me().name + ' downloaded the staff report (PDF, ' + m.period + ')'); });
  }
};
API.openStaffReport = function (userId, params) { var p = Object.assign({}, params || {}); if (userId) p.person = userId; go('staff-reports', p); };

/* ===================================================================
   Page: Income (#page=income)   Owner: W3
   Handover fees each person earned (the "Handover fees" kinds on Expenses > Add expense), by kind and by booking.
   Each person sees only their own; someone with expenses.view_all sees everyone and can pick one person.
   Params: person (user id, empty = everyone), from, to (YYYY-MM-DD).
   =================================================================== */
function incIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function incParse(s) { if (!s) return null; var p = String(s).split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
/* handover fee entries between two days (both inclusive), for one person or everyone */
function incRows(from, to, uid) {
  var d = D(), end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  return d.expenses.filter(function (e) {
    if (e.source && e.source !== 'recorded') return false;
    var c = byId(d.expenseCats, e.cat); if (!c || !c.agentFee) return false;
    return e.day >= from && e.day < end && (!uid || e.by === uid);
  }).map(function (e) {
    var c = byId(d.expenseCats, e.cat), car = carById(typeof rptExpCar === 'function' ? rptExpCar(e) : e.car);
    return { id: e.id, day: e.day, booking: e.booking || '', plate: car ? car.plate : '', car: car ? carName(car) : '', kind: c.name, by: e.by, who: staffName(e.by), amount: e.amount, note: e.note || '' };
  }).sort(function (a, b) { return b.day - a.day || (a.booking < b.booking ? -1 : 1); });
}

PAGES['income'] = {
  title: 'Income',
  search: [{ label: 'My income (handover fees)', icon: 'coins', run: function () { go('income'); } }],
  render: function (root, ctx) {
    if (!ctx.can('expenses.view')) { root.innerHTML = UI.empty({ icon: 'lock', title: 'You do not have access to this page', text: 'Ask the owner to give your account the Expenses permission.' }); return; }
    var st = ctx.state, P = ctx.params, everyone = ctx.can('expenses.view_all'), n = NOW(), d = D();
    if (!st.from) { st.from = P.from || incIso(new Date(n.getFullYear(), n.getMonth(), 1)); st.to = P.to || incIso(new Date(n.getFullYear(), n.getMonth() + 1, 0)); }
    var pp0 = P.person || ''; if (st.pp !== pp0) { st.pp = pp0; st.person = pp0; }
    if (st.person && !byId(d.users, st.person)) st.person = '';
    if (!everyone) st.person = me().id;
    var from = incParse(st.from), to = incParse(st.to), bad = !from || !to ? 'Choose the first and the last day.' : to < from ? 'The last day is before the first day.' : '';
    var rows = bad ? [] : incRows(from, to, st.person || null), total = sum(rows.map(function (r) { return r.amount; }));
    var who = st.person ? byId(d.users, st.person) : null;
    root.innerHTML = '<div class="inc-head"><h1>Income</h1><p>' + (everyone ? 'Handover fees each person earned, by kind and by booking. Each person sees only their own.' : 'The handover fees you earned, by kind and by booking. Only you and the owners can see this.') + '</p></div>' +
      '<div class="card inc-card0"><div class="inc-bar">' + UI.dateField({ key: 'from', label: 'From', value: st.from, chips: false }) + UI.dateField({ key: 'to', label: 'To', value: st.to, chips: false }) +
      (everyone ? UI.select({ key: 'person', label: 'Person', value: st.person || '', placeholder: 'Everyone', options: d.users.map(function (u) { return [u.id, u.name + (u.id === me().id ? ' (Me)' : '')]; }) }) : '') + '</div>' +
      (bad ? '<p class="inc-bad">' + i('alert-circle') + esc(bad) + '</p>' : '') + '<div id="inc-body"></div></div>';
    var body = root.querySelector('#inc-body');
    if (bad) return;
    /* KPI tiles: total, handovers and (for everyone) one per person */
    var people = {}; rows.forEach(function (r) { var p = people[r.by] || (people[r.by] = { id: r.by, name: r.who, amount: 0, n: 0 }); p.amount += r.amount; p.n++; });
    var plist = Object.keys(people).map(function (k) { return people[k]; }).sort(function (a, b) { return b.amount - a.amount; });
    var tile = function (l, v, s, cls, attrs) { return '<' + (attrs ? 'button type="button" ' + attrs : 'div') + ' class="inc-k ' + (cls || '') + '"><span>' + esc(l) + '</span><b>' + v + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</' + (attrs ? 'button' : 'div') + '>'; };
    var handovers = {}; rows.forEach(function (r) { handovers[r.booking || r.id] = 1; });
    var kh = '<div class="inc-kpis">' + tile('Total income', UI.money(total), who ? who.name : (everyone ? 'Everyone' : ''), 'hero') + tile('Handovers', String(Object.keys(handovers).length), plural(rows.length, 'fee') + ' recorded') +
      (!st.person && everyone ? plist.map(function (p) { return tile(p.name, UI.money(p.amount), plural(p.n, 'fee'), 'person', 'data-pp="' + esc(p.id) + '"'); }).join('') : '') + '</div>';
    /* by kind: kinds with nothing are left out */
    var kinds = {}; rows.forEach(function (r) { var k = kinds[r.kind] || (kinds[r.kind] = { kind: r.kind, n: 0, amount: 0 }); k.n++; k.amount += r.amount; });
    var klist = Object.keys(kinds).map(function (k) { return kinds[k]; }).sort(function (a, b) { return b.amount - a.amount; });
    body.innerHTML = kh + (who && everyone ? '<button type="button" class="inv-link inc-back" data-pp="">' + i('arrow-left') + 'Everyone</button>' : '') +
      '<div class="inc-grid"><section><h4 class="inc-h">BY KIND</h4><div id="inc-kind"></div></section><section><h4 class="inc-h">HANDOVERS</h4><div id="inc-list"></div></section></div>';
    var emptyText = { icon: 'coins', title: 'No handover fees in this period', text: 'They are recorded on Expenses > Add expense.', action: ctx.can('expenses.add') ? UI.btn('Add expense', { kind: 'tonal', icon: 'plus', attrs: { 'data-add': '1' } }) : '' };
    /* a narrow table: the kind name wraps so the count and the amount always show (no sideways scroll) */
    UI.table(body.querySelector('#inc-kind'), { rows: klist, rowKey: 'kind', density: 'compact', pageSize: false, minWidth: 300,
      columns: [{ key: 'kind', label: 'Kind', render: function (k) { return '<span class="inc-kind">' + esc(k.kind) + '</span>'; } }, { key: 'n', label: 'Count', money: true, render: function (k) { return String(k.n); } }, { key: 'amount', label: 'Amount', money: true }],
      footer: klist.length ? function () { return '<tr><td><b>Total</b></td><td class="c"><b>' + rows.length + '</b></td><td class="c"><b>' + UI.money(total) + '</b></td></tr>'; } : null,
      card: function (k) { return '<div class="row gap10"><div class="grow"><b>' + esc(k.kind) + '</b><small class="inc-sm">' + plural(k.n, 'fee') + '</small></div><b>' + UI.money(k.amount) + '</b></div>'; },
      empty: { icon: 'coins', title: 'Nothing yet', text: '' } });
    UI.table(body.querySelector('#inc-list'), { rows: rows, rowKey: 'id', density: 'compact', pageSize: 15, minWidth: 720,
      onRowClick: function (r) { if (r.booking && API.openBooking) API.openBooking(r.booking); },
      columns: [
        { key: 'day', label: 'Date', render: function (r) { return '<span class="nowrap">' + esc(UI.fmt.date(r.day)) + '</span>'; } },
        { key: 'booking', label: 'Booking', render: function (r) { return r.booking ? '<button type="button" class="inv-link" data-bk="' + esc(r.booking) + '">' + esc(r.booking) + '</button>' : '-'; } },
        { key: 'car', label: 'Car', render: function (r) { return r.plate ? '<b>' + esc(r.plate) + '</b><small class="inc-sm">' + esc(r.car) + '</small>' : '-'; } },
        { key: 'kind', label: 'Kind', render: function (r) { return esc(r.kind); } },
        { key: 'who', label: 'Recorded by', render: function (r) { return everyone && !st.person ? '<button type="button" class="inv-link" data-pp="' + esc(r.by) + '" title="Show only ' + esc(r.who) + '">' + esc(r.who) + '</button>' : esc(r.who); } },
        { key: 'amount', label: 'Amount', money: true }],
      footer: rows.length ? function () { return '<tr><td colspan="5"><b>Total (' + plural(rows.length, 'fee') + ')</b></td><td class="c"><b>' + UI.money(total) + '</b></td></tr>'; } : null,
      card: function (r) { return '<div class="row gap10"><div class="grow"><b>' + esc(r.kind) + '</b><small class="inc-sm">' + esc(UI.fmt.date(r.day)) + (r.booking ? ' · ' + esc(r.booking) : '') + (r.plate ? ' · ' + esc(r.plate) : '') + (everyone && !st.person ? ' · ' + esc(r.who) : '') + '</small></div><b>' + UI.money(r.amount) + '</b></div>'; },
      empty: emptyText });
    root.addEventListener('change', function (ev) {
      var k = ev.target.getAttribute('data-key');
      if (k === 'from' || k === 'to') { st[k] = ev.target.value; ctx.refresh(); }
      else if (k === 'person') { st.person = ev.target.value; st.pp = st.person; ctx.setParams({ person: st.person || null }); ctx.refresh(); }
    });
    UI.on(root, 'click', '[data-pp]', function (ev, el) { ev.stopPropagation(); if (!everyone) return; st.person = el.getAttribute('data-pp'); st.pp = st.person; ctx.setParams({ person: st.person || null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-bk]', function (ev, el) { ev.stopPropagation(); API.openBooking(el.getAttribute('data-bk')); });
    UI.on(root, 'click', '[data-add]', function () { go('expenses', { action: 'add' }); });
  },
  onData: function (root, ctx, ev) { if (!ev || !ev.coll || ev.coll === 'expenses' || ev.coll === 'expenseCats' || ev.coll === 'users') ctx.refresh(); }
};
API.openIncome = function (userId) { go('income', userId ? { person: userId } : {}); };

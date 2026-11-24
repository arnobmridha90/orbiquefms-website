/* ===================================================================
   Page: Instalments (#page=instalments)   Owner: builder 2
   The monthly loan / hire-purchase payment of each car (from the car's instalment day and amount). Mark paid
   records the payment on the Expenses page as a car loan / hire-purchase instalment.
   =================================================================== */
function insToday() { var n = NOW(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function insState(it) { if (it.paid) return 'paid'; var d = Math.round((it.due - insToday()) / DAY); return d < 0 ? 'overdue' : 'unpaid'; }
function insChip(it) {
  if (it.paid) return UI.chip('Paid on ' + UI.fmt.date(it.paid.on), 'ok');
  var d = Math.round((new Date(it.due.getFullYear(), it.due.getMonth(), it.due.getDate()) - insToday()) / DAY);
  return d < 0 ? UI.chip('Overdue by ' + plural(-d, 'day'), 'bad') : d === 0 ? UI.chip('Due today', 'warn') : UI.chip('Due in ' + plural(d, 'day'), 'warn');
}
function insCatId() { var c = D().expenseCats.filter(function (x) { return /hire-purchase instalment/.test(x.name); })[0]; return c ? c.id : null; }
function insMarkPaid(it) {
  if (!can('expenses.add_business')) { UI.toast('You cannot mark instalments paid. It needs the right to add office and admin expenses.', { tone: 'warn' }); return; }
  var car = carById(it.car), st = { on: rptIso(insToday()), amount: '', method: 'Bank transfer', note: '' };
  var body = function () {
    var on = rptParse(st.on), err = !on ? 'Choose the day it was paid.' : on > insToday() ? 'The day cannot be in the future.' : '';
    return '<p class="ins-dl"><b>' + esc(car.plate) + '</b> · due ' + esc(UI.fmt.date(it.due)) + ' · ' + UI.money(it.amount) + '</p>' +
      UI.input({ id: 'ins-on', key: 'on', label: 'Paid on', type: 'date', value: st.on, max: rptIso(insToday()), required: true, error: err }) +
      UI.input({ id: 'ins-amt', key: 'amount', label: 'Amount paid (RM)', prefix: 'RM', value: st.amount, placeholder: it.amount.toFixed(2), attrs: { inputmode: 'decimal' }, help: 'Leave empty if you paid the amount due. Type it only if you paid a different amount.' }) +
      '<div class="exp-f"><label class="exp-l">Paid with</label><div class="exp-qc">' + [['Cash', 'cash'], ['Card', 'credit-card'], ['Bank transfer', 'building-bank'], ['E-wallet', 'device-mobile'], ['Other', 'dots']].map(function (m) { return '<button type="button" class="exp-chip" data-pm="' + m[0] + '" aria-pressed="' + (st.method === m[0]) + '">' + i(m[1]) + m[0] + '</button>'; }).join('') + '</div></div>' +
      UI.input({ id: 'ins-note', key: 'note', label: 'Note (optional)', value: st.note, placeholder: 'For example: reference of the bank transfer', maxlength: 120 }) +
      '<p class="b2 ins-hint">' + i('info-circle') + 'This records the payment on the Expenses page as a car loan / hire-purchase instalment for ' + esc(car.plate) + '.</p>';
  };
  var keep = function (el) { var f = UI.form(el); st.on = f.on; st.amount = f.amount; st.note = f.note; };
  var dl = UI.dialog({ title: 'Mark instalment paid', width: 'sm', body: body, buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Mark paid', icon: 'check', onClick: function (d) {
    keep(d.body); var on = rptParse(st.on), a = st.amount === '' ? it.amount : Number(String(st.amount).replace(/,/g, ''));
    if (!on || on > insToday()) { d.refresh(); UI.toast('Choose a day that is not in the future', { tone: 'warn' }); return false; }
    if (!(a > 0)) { UI.toast('Type an amount above 0, or leave it empty', { tone: 'warn' }); return false; }
    a = Math.round(a * 100) / 100;
    var n = D().expenses.length + 1; while (byId(D().expenses, 'exp-' + n)) n++;
    var ex = { id: 'exp-' + n, day: on, amount: a, cat: insCatId(), car: it.car, booking: null, method: st.method, paidTo: '', note: st.note || ('Instalment for ' + car.plate + ' (' + it.month + ')'), receipt: null, by: me().id, at: NOW(), source: 'recorded', ref: it.id };
    DB.add('expenses', ex, { first: true, where: 'Expense', text: me().name + ' created expense Car loan / hire-purchase instalment: ' + UI.fmt.money(a) + ' (' + car.plate + ')' });
    DB.update('instalments', it, { paid: { on: on, amount: a, method: st.method, expense: ex.id, by: me().name } }, { where: 'Car instalment', text: me().name + ' marked the instalment of ' + car.plate + ' due ' + UI.fmt.date(it.due) + ' paid' });
    UI.toast('Instalment of ' + car.plate + ' marked paid.');
  } }] });
  dl.el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-pm]'); if (b) { keep(dl.body); st.method = b.getAttribute('data-pm'); dl.refresh(); } });
  dl.body.addEventListener('change', function (ev) { if (ev.target.getAttribute('data-key') === 'on') { keep(dl.body); dl.refresh(); } });
}
function insUndo(it) {
  var car = carById(it.car);
  UI.confirm({ title: 'Mark this instalment not paid?', text: car.plate + ', due ' + UI.fmt.date(it.due) + '. The expense recorded for it is deleted too.', ok: 'Mark not paid', danger: true }).then(function (y) {
    if (!y) return;
    var ex = it.paid && it.paid.expense ? byId(D().expenses, it.paid.expense) : null;
    if (ex) DB.remove('expenses', ex, { where: 'Expense', text: me().name + ' deleted the instalment expense of ' + car.plate });
    DB.update('instalments', it, { paid: null }, { where: 'Car instalment', text: me().name + ' marked the instalment of ' + car.plate + ' due ' + UI.fmt.date(it.due) + ' not paid' });
    UI.toast('Instalment of ' + car.plate + ' is unpaid again.');
  });
}
PAGES['instalments'] = {
  title: 'Instalments',
  render: function (root, ctx) {
    if (!ctx.can('expenses.view_all') && !ctx.can('cars.see_instalment')) { root.innerHTML = UI.empty({ icon: 'lock', title: 'You do not have access to Instalments', text: 'Ask the owner to let your account see everyone\'s expenses.' }); return; }
    var P = ctx.params, show = ['unpaid', 'overdue', 'paid', 'all'].indexOf(P.show) >= 0 ? P.show : 'unpaid', mon = /^\d{4}-\d{2}$/.test(P.m || '') ? P.m : '';
    var list = D().instalments.slice().sort(function (a, b) { return a.due - b.due; }), inMon = list.filter(function (it) { return !mon || it.month === mon; });
    var un = inMon.filter(function (it) { return !it.paid; }), od = inMon.filter(function (it) { return insState(it) === 'overdue'; });
    var rows = inMon.filter(function (it) { var s = insState(it); return show === 'all' || (show === 'unpaid' ? s !== 'paid' : s === show); });
    if (show === 'paid') rows.reverse();
    var mlabel = mon ? expMonthName(expMonthOf(mon)) : 'All months', canPay = ctx.can('expenses.add_business');
    var shift = function (k) { var b = mon ? expMonthOf(mon) : new Date(NOW().getFullYear(), NOW().getMonth(), 1); return expMonthKey(new Date(b.getFullYear(), b.getMonth() + k, 1)); };
    root.innerHTML = '<div class="ins-head"><div class="grow"><h1>Instalments</h1><p>The monthly payment on each car\'s loan or hire-purchase. Set the day and amount on the car\'s page. Reminders show on the Dashboard.</p></div>' + (ctx.can('reports.view') ? UI.btn('Excel report', { kind: 'o', icon: 'file-spreadsheet', attrs: { 'data-rep': '1' } }) : '') + '</div>' +
      '<div class="ins-top"><div class="card ins-k"><span>Unpaid</span><b>' + UI.money(sum(un.map(function (it) { return it.amount; }))) + '</b><small>' + plural(un.length, 'instalment') + ' · ' + esc(mlabel) + '</small></div>' +
      '<div class="card ins-k bad"><span>Overdue</span><b>' + UI.money(sum(od.map(function (it) { return it.amount; }))) + '</b><small>' + od.length + ' past the due date</small></div>' +
      '<div class="card ins-f">' + UI.select({ id: 'ins-show', key: 'show', label: 'Show', value: show, options: [['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['all', 'All']] }) +
      '<div class="inp"><label for="ins-m">Month</label><div class="ins-mon"><button type="button" class="ib sm" data-mon="-1" aria-label="Previous month">' + i('chevron-left') + '</button><input id="ins-m" type="month" data-key="m" value="' + esc(mon) + '" aria-label="Month"><button type="button" class="ib sm" data-mon="1" aria-label="Next month">' + i('chevron-right') + '</button>' + UI.btn('All', { kind: mon ? 'o' : 'c', size: 'sm', attrs: { 'data-all': '1', 'aria-pressed': !mon } }) + '</div></div></div></div>' +
      '<div class="card ins-list">' + (rows.length ? rows.map(function (it) { var car = carById(it.car), diff = it.paid && Math.abs(it.paid.amount - it.amount) > .001; return '<div class="ins-row"><div class="grow"><b>' + esc(car.plate) + ' ' + esc(carName(car)) + '</b><small>Due ' + esc(UI.fmt.date(it.due)) + (it.paid ? ' · paid with ' + esc(it.paid.method) : '') + '</small></div><div class="ins-amt"><b>' + UI.money(it.paid ? it.paid.amount : it.amount) + '</b>' + (diff ? '<small>' + UI.fmt.money(it.amount) + ' was due</small>' : '') + '</div>' + insChip(it) +
        (it.paid ? '<span class="ins-act">' + (it.paid.expense ? UI.iconBtn('receipt-2', 'Open the expense', { size: 'sm', attrs: { 'data-exp': it.paid.expense } }) : '') + (canPay ? UI.iconBtn('arrow-back-up', 'Mark not paid', { size: 'sm', attrs: { 'data-undo': it.id } }) : '') + '</span>' : UI.btn('Mark paid', { size: 'sm', disabled: !canPay, cls: 'ins-pay', attrs: { 'data-pay': it.id, title: canPay ? '' : 'Needs the right to add office and admin expenses' } })) + '</div>'; }).join('')
        : UI.empty({ icon: 'calendar-dollar', title: show === 'paid' ? 'No paid instalments here yet.' : 'Nothing to show.', text: show === 'paid' ? 'Paid instalments show here once they are marked paid.' : 'Instalments appear for cars that have an instalment day and amount.' + (mon ? ' Try All months.' : '') })) + '</div>';
    root.querySelector('#ins-show').addEventListener('change', function (ev) { ctx.setParams({ show: ev.target.value === 'unpaid' ? null : ev.target.value }); ctx.refresh(); });
    root.querySelector('#ins-m').addEventListener('change', function (ev) { ctx.setParams({ m: ev.target.value || null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-mon]', function (ev, el) { ctx.setParams({ m: shift(+el.getAttribute('data-mon')) }); ctx.refresh(); });
    UI.on(root, 'click', '[data-all]', function () { ctx.setParams({ m: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-pay]', function (ev, el) { insMarkPaid(byId(D().instalments, el.getAttribute('data-pay'))); });
    UI.on(root, 'click', '[data-undo]', function (ev, el) { insUndo(byId(D().instalments, el.getAttribute('data-undo'))); });
    UI.on(root, 'click', '[data-exp]', function (ev, el) { if (byId(D().expenses, el.getAttribute('data-exp'))) expOpen(el.getAttribute('data-exp')); else UI.toast('That expense was deleted', { tone: 'info' }); });
    UI.on(root, 'click', '[data-rep]', function () { go('reports', { report: 'instalments' }); });
  }
};

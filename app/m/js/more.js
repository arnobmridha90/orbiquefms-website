/* ---------------- MORE (M9) ----------------
   Every section as grouped tiles, hidden when the person cannot open it. Badges: Maintenance (overdue now), Deposits (waiting).
   The old Schedule / Cars / Customers / Money screens that lived here now belong to their own modules. */
function moreBadges() {
  var out = { maint: 0, dep: 0, tasks: 0 };
  try { if (can('maintenance.view') && typeof Maint !== 'undefined') out.maint = Maint.dueItems().filter(function (i) { return i.level === 'overdue'; }).length; } catch (e) {}
  if (can('deposits.view')) out.dep = S.bookings.filter(function (b) { return b.paymentStatus === 'Refund Pending'; }).length;
  if (can('tasks.view')) out.tasks = openTasksOf(S.me);
  return out;
}
var MORE_GROUPS = function (bd) {
  var cashOk = can('billing.manage_cash') || can('expenses.add') || can('expenses.staff_reports_all');
  return [
    ['Daily', [
      ['#schedule', 'cal', 'Schedule', can('bookings.view')],
      ['#tasks', 'task', 'Tasks', can('tasks.view'), bd.tasks, 'blue'],
      ['#availability', 'search', 'Availability', can('bookings.view')],
      ['#calendar', 'grid', 'Calendar', can('bookings.view')]]],
    ['Money', [
      ['#money', 'chart', 'Money', can('bookings.see_revenue') || can('billing.view')],
      ['#deposits', 'shield', 'Deposits', can('deposits.view'), bd.dep, 'amber'],
      ['#cash', 'bank', 'Cash and bank-ins', cashOk],
      ['#mymoney', 'cash', can('expenses.staff_reports_all') ? 'Staff money' : 'My money', can('expenses.view') || can('expenses.add')],
      ['#invoices', 'receipt', 'Invoices and receipts', can('billing.view')],
      ['#instalments', 'cal', 'Instalments', can('cars.see_instalment')],
      ['#expenses', 'tag', 'Expenses', can('expenses.view') || can('expenses.add')],
      ['#reports', 'activity', 'Reports', can('reports.view')]]],
    ['Fleet', [
      ['#cars', 'car', 'Cars', can('cars.view')],
      ['#maintenance', 'wrench', 'Maintenance', can('maintenance.view'), bd.maint, 'red'],
      ['#summons', 'file', 'Summons', can('summons.view')],
      ['#tracking', 'map', 'Where is it now', can('tracking.view')]]],
    ['People', [
      ['#customers', 'users', 'Customers', can('customers.view')],
      ['#team', 'user', 'Team', can('users.view') || can('employees.view')]]]
  ];
};
VIEWS.more = function () {
  var b = B(), p = me(), bd = moreBadges();
  var t = function (x) { return '<a class="gtile mo-tile" href="' + x[0] + '"><span class="gi">' + I(x[1]) + (x[4] ? '<i class="mo-badge tone-' + (x[5] || 'red') + '">' + (x[4] > 99 ? '99+' : x[4]) + '</i>' : '') + '</span>' + esc(x[2]) + '</a>'; };
  var row = function (href, icon, label, sub, extra) { return '<a class="row" href="' + href + '"' + (extra || '') + '>' + I(icon) + '<div class="grow"><div class="t1">' + label + '</div>' + (sub ? '<div class="t2">' + sub + '</div>' : '') + '</div>' + CHEV + '</a>'; };
  var groups = MORE_GROUPS(bd).map(function (g) {
    var items = g[1].filter(function (x) { return x[3]; });
    return items.length ? '<div class="sec"><h2>' + g[0] + '</h2></div><div class="grid4 mo-grid">' + items.map(t).join('') + '</div>' : '';
  }).join('');
  var html = topbar('More') + '<main>' +
    '<a class="card mo-me" href="#person/' + esc(p.id) + '"><div class="av" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</div><div class="grow"><div class="b">' + esc(p.name) + '</div><div class="small muted">' + esc(roleName(p.role)) + (p.codes && p.codes.length ? ' (own access)' : '') + ' · ' + esc(b.short) + '</div></div><span class="chip tone-green">Signed in</span></a>' +
    groups +
    '<div class="sec"><h2>Set-up</h2></div><div class="list mo-set">' +
    row('#settings', 'gear', 'Settings', can('users.manage') ? 'Company, places, fees, signature' : 'Company details and my start tab') +
    row('#notifs', 'bell', 'Notifications', PUSH.sub ? 'Phone notifications on' : 'Choose what you get') +
    (can('users.view_audit') ? row('#activity', 'activity', 'Activity', 'Who did what, and when') : '') +
    row('#install', 'install', 'Install app', standalone() ? 'Installed' : 'Add to Home Screen') +
    row('#company', 'paint', 'Switch company', 'Demo: try another company and brand') +
    '<button class="row" type="button" onclick="moreSignOut()">' + I('signout') + '<div class="grow"><div class="t1">Sign out</div><div class="t2">Sign in as someone else to try their role</div></div></button>' +
    '<button class="row" type="button" onclick="resetDemo()">' + I('reset') + '<div class="grow"><div class="t1">Reset demo data</div><div class="t2">Start again with fresh made-up bookings</div></div></button></div>' +
    '<p class="demo-note">Orbique FMS · staff app demo<br>All names, numbers and amounts are made up.</p></main>';
  return { html: html };
};
function moreSignOut() {
  confirm({ title: 'Sign out?', text: 'You will need your username and password to sign in again on this phone.', ok: 'Sign out', cancel: 'Stay signed in' }).then(function (ok) { if (ok) signOut(); });
}
function resetDemo() {
  confirm({ icon: 'warn', title: 'Reset the demo?', text: 'Your dummy bookings, payments and chats for ' + B().short + ' will be replaced by fresh made-up data.', ok: 'Reset', cancel: 'Keep my data', danger: true }).then(function (ok) { if (ok) doResetDemo(); });
}
function doResetDemo() {
  /* the New booking drafts (one per person) and the handover drafts point at the old data: start clean */
  try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('fms.nbdraft.' + CO + '.') === 0 || k === 'fms.hodraft.' + CO) localStorage.removeItem(k); }); } catch (e) {}
  var keepMe = S.me; resetViewState(); S = seed(CO); runSeeders(S); if (keepMe && staff(keepMe)) S.me = keepMe; usePrefs(); save(); closeAllSheets(); applyTheme();
  history.replaceState(null, '', location.pathname + location.search + '#home'); render(true); say('Fresh demo data loaded');
}

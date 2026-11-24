/* ===================================================================
   Page: Activity log (#page=activity)   Owner: builder 5
   Who did what and when. Filters (search, person, what happened, where, from, to) live in the address:
   #page=activity&person=Irfan%20Hakimi&what=Changed&where=Booking&q=KLT-00412
   =================================================================== */

/* a month of history so the log, its filters and its pages have something to show (made up, deterministic) */
DATA_INIT.push(function (d, brand) {
  if (d.activityExtra) return; d.activityExtra = true;
  var R = rng(7300 + brand.id.length * 31), ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var users = d.users.filter(function (u) { return u.active; }), bk = d.bookings.filter(function (x) { return x.created <= TODAY; });
  var at = function (dd) { var x = new Date(TODAY.getTime() - dd * DAY); x.setHours(ri(8, 21), ri(0, 59), 0, 0); return x; };
  var add = function (when, who, action, where, ref, text, changes) { d.activity.push({ id: 'act-h' + d.activity.length, at: when, who: who, action: action, where: where, ref: ref, text: text, changes: changes || [], ip: '10.0.' + ri(0, 9) + '.' + ri(2, 250) }); };
  for (var day = 1; day <= 30; day++) {
    users.forEach(function (u) { if (R() < .55) add(at(day), u.name, 'Signed in', 'Team member', u.id, u.name + ' signed in'); });
    var n = ri(2, 5);
    for (var k = 0; k < n; k++) {
      var u = pick(users).name, x = pick(bk), r = R();
      if (r < .3) add(at(day), u, 'Changed', 'Booking', x.code, u + ' changed booking ' + x.code + ' (' + x.car.plate + ')', [{ f: 'Status', from: pick(['Pending', 'Confirmed', 'Agreement Sent']), to: pick(['Agreement Signed', 'Car Delivered', 'Car Returned']) }].concat(R() < .4 ? [{ f: 'Discount', from: 'RM 0.00', to: 'RM ' + ri(2, 10) * 10 + '.00', money: 1 }] : []));
      else if (r < .45) add(at(day), u, 'Created', 'Payment', 'pay-h' + day + k, u + ' recorded a payment of RM ' + ri(10, 90) * 10 + '.00 on ' + x.code, [{ f: 'Type', from: '', to: pick(LISTS.payKinds) }, { f: 'Method', from: '', to: pick(LISTS.methods) }, { f: 'Amount', from: '', to: 'RM ' + ri(10, 90) * 10 + '.00', money: 1 }]);
      else if (r < .55) add(at(day), u, 'Sent', pick(['Invoice', 'Receipt']), '', u + ' sent a document for ' + x.code + ' on WhatsApp to ' + x.cust.name);
      else if (r < .63) add(at(day), u, 'Changed', 'Car', x.car.id, u + ' changed car ' + x.car.plate, [{ f: 'Odometer', from: String(ri(30000, 60000)), to: String(ri(60001, 90000)) }]);
      else if (r < .7) add(at(day), u, 'Created', 'Task', '', u + ' created task "' + pick(['Deliver', 'Collect']) + ' ' + x.car.plate + '" for ' + x.code);
      else if (r < .76) add(at(day), u, 'Viewed a document', 'Booking', x.code, u + ' opened the IC of ' + x.cust.name + ' on ' + x.code);
      else if (r < .81) add(at(day), u, 'Exported', pick(['Booking', 'Expense', 'Maintenance record']), '', u + ' downloaded ' + pick(['the bookings report', 'the expenses to Excel', 'the maintenance records']));
      else if (r < .86) add(at(day), u, 'Changed', 'Deposit refund', 'dep-' + x.code, u + ' changed deposit refund for ' + x.code, [{ f: 'Deductions', from: 'RM 0.00', to: 'RM ' + ri(2, 15) * 10 + '.00', money: 1 }]);
      else if (r < .9) add(at(day), u, 'Created', 'Customer', x.cust.id, u + ' added a note on ' + x.cust.name, [{ f: 'Note', from: '', to: pick(['Returned the car clean', 'Late by two hours', 'Asked for a child seat']) }]);
      else if (r < .93) add(at(day), u, 'Failed sign-in', 'Team member', '', 'A sign-in with the username "' + pick(['admin', 'staff', u.split(' ')[0].toLowerCase()]) + '" failed');
      else if (r < .96) add(at(day), u, 'Signed out', 'Team member', '', u + ' signed out');
      else add(at(day), u, 'Other', 'Settings', '', u + ' changed the menu layout');
    }
  }
  d.activity.sort(function (a, b) { return b.at - a.at; });
});

/* money in a log line follows the reader's money rights */
var ACT_MONEY_RIGHT = { 'Payment': 'billing.view', 'Invoice': 'billing.view', 'Receipt': 'billing.view', 'Expense': 'expenses.view_all', 'Deposit refund': 'deposits.view', 'Car instalment': 'cars.see_instalment', 'Summons': 'summons.view', 'Maintenance record': 'maintenance.see_costs', 'Booking': 'bookings.see_amounts' };
function actSeesMoney(a) { return can(ACT_MONEY_RIGHT[a.where] || 'dashboard.see_revenue'); }
function actIsMoney(c) { return c.money || /amount|rate|price|total|deposit|discount|cost|fee|fine|charge|instalment|deduction|paid|payable|received/i.test(c.f) || /RM ?\d/.test(String(c.from) + String(c.to)); }
function actText(a) { return actSeesMoney(a) ? a.text : a.text.replace(/RM ?-?[\d,]+(\.\d+)?/g, 'RM ••••'); }
function actVal(a, c, v) { if (actIsMoney(c) && !actSeesMoney(a)) return 'Hidden'; return v === '' || v == null ? '(empty)' : String(v); }
function actChangeLine(a) { return (a.changes || []).slice(0, 3).map(function (c) { return c.f + ': ' + (c.from === '' || c.from == null ? actVal(a, c, c.to) : actVal(a, c, c.from) + ' → ' + actVal(a, c, c.to)); }).join('; ') + ((a.changes || []).length > 3 ? '; +' + (a.changes.length - 3) + ' more' : ''); }
function actStamp(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function actOpenRef(a) {
  var r = a.ref; if (!r) return null;
  if (a.where === 'Booking' && findBooking(r)) return ['Open booking', function () { API.openBooking(r); }];
  if (a.where === 'Car' && carById(r)) return ['Open car', function () { API.openCar(r); }];
  if (a.where === 'Customer' && byId(D().people, r)) return ['Open customer', function () { API.openCustomer(r); }];
  if (a.where === 'Team member' && (userById(r) || employeeById(r))) return ['Open person', function () { API.openPerson(r); }];
  if ((a.where === 'Invoice' || a.where === 'Receipt') && /^(INV|RCP)/.test(r)) return ['Open document', function () { API.previewDoc(r); }];
  if (a.where === 'Deposit refund') return ['Open deposit', function () { API.openDeposit(r.replace(/^dep-/, '')); }];
  if (a.where === 'Summons') return ['Open summons', function () { API.openSummons(r); }];
  if (a.where === 'Task') return ['Open task', function () { API.openTask(r); }];
  return null;
}
function actFilter(list, f) {
  var q = (f.q || '').toLowerCase().trim(), from = f.from ? UI.parseDate(f.from) : null, to = f.to ? new Date(UI.parseDate(f.to).getTime() + DAY) : null;
  return list.filter(function (a) {
    if (f.person && a.who !== f.person) return false;
    if (f.what && a.action !== f.what) return false;
    if (f.where && a.where !== f.where) return false;
    if (from && a.at < from) return false; if (to && a.at >= to) return false;
    if (q && (a.text + ' ' + a.who + ' ' + a.ref + ' ' + a.where + ' ' + a.action).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function actDownload(kind, rows) {
  rows = rows.slice(0, 10000);
  var aoa = [['When', 'Person', 'Action', 'Area', 'Record', 'Details', 'IP address']].concat(rows.map(function (a) {
    var det = (a.changes || []).map(function (c) { return c.f + ': ' + actVal(a, c, c.from) + ' -> ' + actVal(a, c, c.to); }).join('; ');
    return [actStamp(a.at), a.who, a.action, a.where, a.ref || '', actText(a) + (det ? ' (' + det + ')' : ''), a.ip || ''];
  }));
  var name = 'activity-log-' + UI.isoDate(NOW());
  if (kind === 'csv') UI.csv(name + '.csv', aoa); else UI.xlsx(name + '.xlsx', [{ name: 'Activity', rows: aoa, cols: [18, 18, 16, 18, 16, 70, 14], filter: true }]);
  DB.log('Exported', 'Team member', '', me().name + ' downloaded the activity log as ' + (kind === 'csv' ? 'CSV' : 'Excel') + ' (' + plural(rows.length, 'row') + ')');
  UI.toast('Download started. The file holds up to 10,000 of the newest matching rows.', { tone: 'info' });
}

PAGES['activity'] = {
  title: 'Activity log',
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data;
    st.f = st.f || {}; st.open = st.open || {}; st.page = st.page || 1; st.size = st.size || 25;
    ['person', 'what', 'where', 'q', 'from', 'to'].forEach(function (k) { if (ctx.params[k] && st['p_' + k] !== ctx.params[k]) { st.f[k] = ctx.params[k]; st['p_' + k] = ctx.params[k]; st.page = 1; } });
    root.innerHTML = '<div class="pg-h"><div><h1>Activity log</h1><p>Who did what, and when. The newest entries are first.</p></div><div class="acts">' +
      UI.btn('Download as Excel', { kind: 'tonal', icon: 'file-spreadsheet', attrs: { 'data-act': 'xlsx' } }) + UI.btn('Download as CSV', { kind: 'o', icon: 'download', attrs: { 'data-act': 'csv' } }) + '</div></div>' +
      '<div class="card"><div class="card-b tight" id="ac-f"></div><div id="ac-list"></div></div>';
    var people = d.users.map(function (u) { return u.name; }); d.activity.forEach(function (a) { if (people.indexOf(a.who) < 0) people.push(a.who); });
    var wheres = LISTS.activityWhere.slice(); d.activity.forEach(function (a) { if (wheres.indexOf(a.where) < 0) wheres.push(a.where); });
    UI.filters(root.querySelector('#ac-f'), { values: st.f, fields: [
      { type: 'search', key: 'q', placeholder: 'Booking number, name...' },
      { type: 'select', key: 'person', label: 'Person', all: 'Everyone', options: people.sort() },
      { type: 'select', key: 'what', label: 'What happened', all: 'Anything', options: LISTS.activityActions },
      { type: 'select', key: 'where', label: 'Where', all: 'Anywhere', options: wheres },
      { type: 'daterange', from: 'from', to: 'to', label: 'From' }],
      extra: '<span class="b2 ac-count"></span>',
      onChange: function () { st.page = 1; var p = {}; ['person', 'what', 'where', 'q'].forEach(function (k) { p[k] = st.f[k] || ''; st['p_' + k] = st.f[k] || ''; }); ctx.setParams(p); list(); } });
    function list() {
      var rows = actFilter(d.activity.filter(function (a) { return a.at <= NOW(); }), st.f), pages = Math.max(1, Math.ceil(rows.length / st.size));
      if (st.page > pages) st.page = pages;
      var shown = rows.slice((st.page - 1) * st.size, st.page * st.size);
      var c = root.querySelector('.ac-count'); if (c) c.textContent = plural(rows.length, 'entry').replace('entrys', 'entries');
      var head = '<div class="ac-row ac-head" role="row"><span>When</span><span>Who</span><span>What happened</span><span>Where</span><span></span></div>';
      var body = shown.map(function (a) {
        var open = st.open[a.id], line = actChangeLine(a), ref = actOpenRef(a);
        return '<div class="ac-item' + (open ? ' open' : '') + '"><div class="ac-row" role="button" tabindex="0" data-ac="' + a.id + '" aria-expanded="' + !!open + '"><span class="ac-when">' + actStamp(a.at) + (a.live ? ' <span class="chip ok">New</span>' : '') + '</span><span class="ac-who">' + esc(a.who) + '</span><span class="ac-what"><span class="chip grey">' + esc(a.action) + '</span> <span class="ac-txt">' + esc(actText(a)) + '</span>' + (line ? '<span class="ac-line">' + esc(line) + '</span>' : '') + '</span><span class="ac-where b2">' + esc(a.where) + '</span><span class="ac-chev">' + i(open ? 'chevron-up' : 'chevron-down') + '</span></div>' +
          (open ? '<div class="ac-det">' + ((a.changes || []).length ? '<ul>' + a.changes.map(function (ch) { return '<li><b>' + esc(ch.f) + ':</b> <s>' + esc(actVal(a, ch, ch.from)) + '</s> → <span>' + esc(actVal(a, ch, ch.to)) + '</span></li>'; }).join('') + '</ul>' : '<p>No field changes were recorded for this entry.</p>') +
            '<div class="row wrap gap8"><span class="b2 grow">' + actStamp(a.at) + ' · from ' + esc(a.ip || '-') + (a.ref ? ' · record ' + esc(a.ref) : '') + '</span>' + (ref ? UI.btn(ref[0], { kind: 't', size: 'sm', icon: 'external-link', attrs: { 'data-ac-open': a.id } }) : '') + '</div></div>' : '') + '</div>';
      }).join('');
      var nums = []; for (var p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - st.page) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
      var from = rows.length ? (st.page - 1) * st.size + 1 : 0, to = Math.min(rows.length, st.page * st.size);
      root.querySelector('#ac-list').innerHTML = (rows.length ? '<div class="ac-tbl" role="table">' + head + body + '</div>' : UI.empty({ icon: 'history', title: 'No entries match', text: 'Clear the filters or pick other dates.' })) +
        '<div class="pager ui-pager"><span>Showing ' + from + ' to ' + to + ' of ' + rows.length + '</span><span class="row gap8"><label class="row gap6 b2">Rows<span class="inp"><select data-ac-size aria-label="Rows per page">' + [10, 25, 50, 100].map(function (n) { return '<option' + (n === st.size ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></span></label>' +
        '<span class="pgs"><button type="button" data-ac-page="' + (st.page - 1) + '"' + (st.page === 1 ? ' disabled' : '') + ' aria-label="Previous page">' + i('chevron-left') + '</button>' + nums.map(function (n) { return n === '…' ? '<span class="ui-gap">…</span>' : '<button type="button" data-ac-page="' + n + '" aria-current="' + (n === st.page) + '">' + n + '</button>'; }).join('') + '<button type="button" data-ac-page="' + (st.page + 1) + '"' + (st.page === pages ? ' disabled' : '') + ' aria-label="Next page">' + i('chevron-right') + '</button></span></span></div>';
      st.rows = rows;
    }
    var box = root.querySelector('#ac-list');
    box.addEventListener('click', function (ev) {
      var x;
      if ((x = ev.target.closest('[data-ac-open]'))) { var a = byId(d.activity, x.getAttribute('data-ac-open')); var r = a && actOpenRef(a); if (r) r[1](); return; }
      if ((x = ev.target.closest('[data-ac-page]'))) { st.page = +x.getAttribute('data-ac-page'); list(); root.scrollIntoView({ block: 'start' }); return; }
      if ((x = ev.target.closest('[data-ac]'))) { var id = x.getAttribute('data-ac'); st.open[id] = !st.open[id]; list(); }
    });
    box.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-ac]')) { ev.preventDefault(); ev.target.click(); } });
    box.addEventListener('change', function (ev) { if (ev.target.matches('[data-ac-size]')) { st.size = +ev.target.value; st.page = 1; list(); } });
    UI.on(root, 'click', '[data-act="xlsx"]', function () { actDownload('xlsx', st.rows || []); });
    UI.on(root, 'click', '[data-act="csv"]', function () { actDownload('csv', st.rows || []); });
    ctx.on('activity', function () { if (S.page === 'activity') list(); });
    list();
  },
  onData: function (root, ctx) { /* the list follows the activity bus; nothing else on this page changes with data */ },
  search: [{ label: 'Download the activity log', icon: 'file-spreadsheet', keywords: 'excel audit export', run: function (ctx) { actDownload('xlsx', actFilter(D().activity, {})); } }]
};

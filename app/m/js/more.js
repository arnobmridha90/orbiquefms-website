/* ---------------- MORE ---------------- */
VIEWS.more = function () {
  var b = B();
  var t = function (href, icon, label) { return '<a class="gtile" href="' + href + '"><span class="gi">' + I(icon) + '</span>' + label + '</a>'; };
  var html = topbar('More') + '<main>' +
    '<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin-top:6px"><div class="av" style="background:' + avColor(S.me) + '">' + initials(S.me) + '</div><div style="flex:1;min-width:0"><div class="b">' + esc(S.me) + '</div><div class="small muted">Owner · ' + esc(b.name) + '</div></div><span class="chip ok">Signed in</span></div>' +
    '<div class="sec"><h2>Work</h2></div><div class="grid4">' + t('#schedules', 'cal', 'Schedule') + t('#cars', 'car', 'Cars') + t('#customers', 'users', 'Customers') + t('#money', 'chart', 'Money') + '</div>' +
    '<div class="sec"><h2>App</h2></div><div class="list">' +
    '<a class="row" href="#notifs">' + I('bell') + '<div class="grow"><div class="t1">Notifications</div><div class="t2">' + (PUSH.sub ? 'Phone notifications on' : 'Choose what you get on your phone') + '</div></div><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>' +
    '<a class="row" href="#install">' + I('install') + '<div class="grow"><div class="t1">Install on this phone</div><div class="t2">' + (standalone() ? 'Installed ✓' : 'Add to Home Screen') + '</div></div><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>' +
    '<a class="row" href="#company">' + I('paint') + '<div class="grow"><div class="t1">Company and colours</div><div class="t2">Demo: try another company’s brand</div></div><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>' +
    '<button class="row" onclick="resetDemo()">' + I('reset') + '<div class="grow"><div class="t1">Reset demo data</div><div class="t2">Start again with fresh made-up bookings</div></div></button></div>' +
    '<p class="demo-note">Orbique FMS · staff app demo<br>All names, numbers and amounts are made up.</p></main>';
  return { html: html };
};
function resetDemo() {
  sheet('<h3>Reset the demo?</h3><p class="lead">Your dummy bookings, payments and chats for ' + esc(B().short) + ' will be replaced by fresh made-up data.</p><div class="btnrow"><button class="btn ghost" onclick="closeSheet()">Keep</button><button class="btn danger" onclick="S=runSeeders(seed(CO));save();closeSheet();location.hash=\'#home\';render();say(\'Fresh demo data loaded\')">Reset</button></div>');
}

/* schedule */
var schedDay = 0;
VIEWS.schedules = function () {
  var base = sod(new Date()), day = new Date(base.getTime() + schedDay * DAY), list = handovers(day);
  var tabs = ''; for (var i = -1; i < 9; i++) { var d = new Date(base.getTime() + i * DAY), n = handovers(d).length; tabs += '<button class="dt ' + (i === schedDay ? 'on' : '') + '" onclick="schedDay=' + i + ';render()"><span>' + (i === 0 ? 'Today' : WD[d.getDay()]) + '</span><b>' + d.getDate() + '</b><i class="' + (n ? '' : 'none') + '"></i></button>'; }
  var outs = list.filter(function (h) { return h.type === 'out'; }), ins = list.filter(function (h) { return h.type === 'in'; });
  var html = topbar('Schedule', { back: '#more', sub: dayWord(day) + ' · ' + outs.length + ' out, ' + ins.length + ' back' }) + '<main><div class="daytabs" id="daytabs">' + tabs + '</div>' +
    (list.length ? '<div class="list">' + list.map(hoRow).join('') + '</div>' : '<div class="list"><div class="empty">No handovers on this day.</div></div>') + '</main>';
  return { html: html, after: function () { var on = $('.dt.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); } };
};
/* cars */
VIEWS.cars = function () {
  var now = new Date();
  var html = topbar('Cars', { back: '#more', sub: S.cars.length + ' cars' }) + '<main><div class="list">' + S.cars.map(function (c) {
    var cur = S.bookings.filter(function (b) { return b.car === c.id && b.status === 'Picked up'; })[0];
    var next = S.bookings.filter(function (b) { return b.car === c.id && b.status === 'Confirmed'; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0];
    var st = cur ? '<span class="chip warn">On road</span>' : '<span class="chip ok">Available</span>';
    var sub = cur ? 'With ' + cust(cur.cust).name + ' until ' + dShort(cur.end) : next ? 'Next: ' + when(next.start) : 'No bookings ahead';
    return '<a class="row" href="' + (cur ? '#booking/' + cur.id : next ? '#booking/' + next.id : '#cars') + '"><span style="width:56px;flex:none">' + carSVG(c.color, c.shape) + '</span><div class="grow"><div class="t1">' + esc(c.plate) + ' <span class="muted" style="font-weight:500">' + esc(c.make + ' ' + c.model) + '</span></div><div class="t2">' + esc(sub) + '</div></div>' + st + '</a>';
  }).join('') + '</div></main>';
  return { html: html };
};
/* customers */
var cuSearch = '';
VIEWS.customers = function () {
  var q = cuSearch.toLowerCase(), d = q.replace(/\D/g, '');
  var list = S.customers.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0 || (d.length > 2 && c.phone.replace(/\D/g, '').indexOf(d.replace(/^0/, '')) >= 0); });
  var count = function (c) { return S.bookings.filter(function (b) { return b.cust === c.id && b.status !== 'Cancelled'; }).length; };
  list.sort(function (a, b) { return count(b) - count(a); });
  var html = topbar('Customers', { back: '#more', sub: S.customers.length + ' customers' }) + '<main><label class="search">' + I('search') + '<input id="cuq" type="search" placeholder="Name or phone number" value="' + esc(cuSearch) + '"></label>' +
    '<div class="list">' + list.map(function (c) {
      var n = count(c); return '<div class="row"><div class="av sm" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</div><div class="grow"><div class="t1">' + esc(c.name) + '</div><div class="t2 nowrap">' + esc(c.phone) + ' · ' + n + ' booking' + (n === 1 ? '' : 's') + '</div></div>' + (c.flag ? flagChip(c.flag) : n >= 3 ? '<span class="chip brand">Repeat</span>' : '') + '</div>';
    }).join('') + '</div></main>';
  return { html: html, after: function () { var i = $('#cuq'); i.oninput = function () { cuSearch = i.value; render(); var j = $('#cuq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }; } };
};
/* money */
VIEWS.money = function () {
  var now = new Date(), wk = sod(new Date(now.getTime() - 6 * DAY)), mo = new Date(now.getFullYear(), now.getMonth(), 1), pays = [];
  S.bookings.forEach(function (b) { b.payments.forEach(function (p) { pays.push({ p: p, b: b }); }); });
  pays.sort(function (a, b) { return new Date(b.p.at) - new Date(a.p.at); });
  var sum = function (from, kind) { return pays.filter(function (x) { return new Date(x.p.at) >= from && x.p.kind === kind; }).reduce(function (s, x) { return s + x.p.amt; }, 0); };
  var owed = S.bookings.filter(function (b) { return b.status !== 'Cancelled'; }).reduce(function (s, b) { return s + Math.max(0, priceOf(b).balance); }, 0);
  var html = topbar('Money', { back: '#more', sub: 'Rental income and deposits' }) + '<main><div class="tiles" style="margin-top:6px">' +
    '<div class="tile"><div class="k">Today</div><div class="v num" style="font-size:19px">' + rm0(sum(sod(now), 'Rental')) + '</div></div>' +
    '<div class="tile"><div class="k">Last 7 days</div><div class="v num" style="font-size:19px">' + rm0(sum(wk, 'Rental')) + '</div></div>' +
    '<div class="tile"><div class="k">This month</div><div class="v num" style="font-size:19px">' + rm0(sum(mo, 'Rental')) + '</div></div>' +
    '<a class="tile" href="#bookings/unpaid"><div class="k">Still to collect</div><div class="v num bal due" style="font-size:19px">' + rm0(owed) + '</div></a></div>' +
    '<div class="sec"><h2>Latest payments</h2></div><div class="list"><table class="money"><thead><tr><th>Booking</th><th>Date</th><th>Kind</th><th>Amount</th></tr></thead><tbody>' +
    pays.slice(0, 25).map(function (x) { return '<tr onclick="location.hash=\'#booking/' + x.b.id + '\'" style="cursor:pointer"><td class="small"><b>' + esc(cust(x.b.cust).name.split(' ')[0]) + '</b><br><span class="muted tiny">' + x.b.code + '</span></td><td class="small">' + dShort(x.p.at) + '</td><td class="small">' + x.p.kind + '</td><td class="small b">' + rm(x.p.amt) + '</td></tr>'; }).join('') +
    '</tbody></table></div><p class="demo-note">The full reports (same figures as today) stay on the big-screen dashboard.</p></main>';
  return { html: html };
};


/* ---------------- HOME ---------------- */
function handovers(day) {
  var out = [];
  S.bookings.forEach(function (b) {
    if (b.status === 'Cancelled') return;
    if (sameDay(b.start, day) && b.status === 'Confirmed') out.push({ b: b, at: new Date(b.start), type: 'out' });
    else if (sameDay(b.start, day) && b.status !== 'Confirmed') out.push({ b: b, at: new Date(b.start), type: 'out', done: true });
    if (sameDay(b.end, day)) out.push({ b: b, at: new Date(b.end), type: 'in', done: b.status === 'Returned' });
  });
  return out.sort(function (a, b) { return a.at - b.at; });
}
function hoRow(h) {
  var b = h.b, c = car(b.car), cu = cust(b.cust);
  return '<a class="row" href="#booking/' + b.id + '"><div class="ho"><div class="time"><b class="num">' + hm(h.at).replace(/ (am|pm)/, '') + '</b><span class="' + h.type + '">' + (h.type === 'out' ? 'Out' : 'Back') + '</span></div></div>' +
    '<div class="grow"><div class="t1">' + esc(cu.name) + '</div><div class="t2">' + esc(c.plate) + ' · ' + esc(h.type === 'out' ? b.pickPlace : b.retPlace) + '</div></div>' +
    (h.done ? '<span class="chip ok">' + I('check', 2.6) + 'Done</span>' : (h.type === 'in' && h.at < new Date() ? '<span class="chip bad">Late</span>' : '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg>')) + '</a>';
}
VIEWS.home = function () {
  var now = new Date(), today = handovers(now), b = B();
  var outs = today.filter(function (h) { return h.type === 'out'; }), ins = today.filter(function (h) { return h.type === 'in'; });
  var onRoad = S.bookings.filter(function (x) { return x.status === 'Picked up'; }).length;
  var moneyToday = 0; S.bookings.forEach(function (x) { x.payments.forEach(function (p) { if (sameDay(p.at, now) && p.kind === 'Rental') moneyToday += p.amt; }); });
  var due = S.bookings.filter(function (x) { return x.status !== 'Cancelled' && priceOf(x).balance > 0 && new Date(x.start) < new Date(now.getTime() + 2 * DAY); });
  var next = today.filter(function (h) { return !h.done; });
  var h = now.getHours(), hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  var html = topbar(b.short, { sub: WD[now.getDay()] + ', ' + now.getDate() + ' ' + MO[now.getMonth()] }) + '<main>' + installBanner() +
    '<div style="margin:8px 0 12px"><div style="font-size:22px;font-weight:780;letter-spacing:-.02em">' + hi + ', ' + esc(S.me.split(' ')[0]) + '</div><div class="muted small">' + (next.length ? next.length + ' handover' + (next.length > 1 ? 's' : '') + ' still to do today' : 'All handovers done for today') + '</div></div>' +
    '<div class="tiles">' +
    '<a class="tile" href="#schedules"><div class="k">' + I('out') + 'Going out today</div><div class="v num">' + outs.length + '</div></a>' +
    '<a class="tile" href="#schedules"><div class="k">' + I('in') + 'Coming back</div><div class="v num">' + ins.length + '</div></a>' +
    '<a class="tile" href="#cars"><div class="k">' + I('car') + 'Cars on the road</div><div class="v num">' + onRoad + '<small> / ' + S.cars.length + '</small></div></a>' +
    '<a class="tile" href="#money"><div class="k">' + I('cash') + 'Money in today</div><div class="v num" style="font-size:19px">' + rm0(moneyToday) + '</div></a></div>' +
    '<div class="sec"><h2>Next handovers</h2><a href="#schedules">Schedule</a></div>' +
    (next.length ? '<div class="list">' + next.slice(0, 5).map(hoRow).join('') + '</div>' : '<div class="list"><div class="empty">Nothing left for today. Tomorrow has ' + handovers(new Date(now.getTime() + DAY)).length + '.</div></div>') +
    (due.length ? '<div class="sec"><h2>Balance to collect</h2><a href="#bookings/unpaid">All</a></div><div class="list">' + due.slice(0, 3).map(function (x) {
      var p = priceOf(x); return '<a class="row" href="#booking/' + x.id + '"><div class="grow"><div class="t1">' + esc(cust(x.cust).name) + '</div><div class="t2">' + esc(x.code) + ' · ' + when(x.start) + '</div></div><div class="end bal due num">' + rm(p.balance) + '</div></a>';
    }).join('') + '</div>' : '') +
    '<div class="sec"><h2>Latest</h2><a href="#inbox">All</a></div><div class="list">' + (S.notifs.slice(0, 3).map(notifRow).join('') || '<div class="empty">No news yet</div>') + '</div>' +
    '<p class="demo-note">Demo with made-up data · saved on this phone only</p></main>';
  return { html: html };
};
function installBanner() {
  if (standalone()) return '';
  return '<a class="banner" href="#install">' + I('install') + '<div><b>Install the app on this phone.</b> It opens full screen from your Home Screen and can send you notifications. <u>How</u></div></a>';
}


/* ---------------- HOME (M9) ----------------
   Needs you (what is late or waiting, by access), quick actions, drafts to continue, the next handover with a countdown,
   money tiles (MONEY_TODAY, the same number as Money), today's board and the latest news. Pull down to refresh. */

/* handovers of one day: [{b, at, type 'out'|'in', done}] (kept for older callers) */
function handovers(day) {
  var out = [];
  S.bookings.forEach(function (b) {
    var st = b.bookingStatus; if (st === 'Cancelled') return;
    if (sameDay(b.start, day)) out.push({ b: b, at: new Date(b.start), type: 'out', done: UPCOMING.indexOf(st) < 0 });
    if (sameDay(b.end, day)) out.push({ b: b, at: new Date(b.end), type: 'in', done: st === 'Car Returned' || st === 'Completed' });
  });
  return out.sort(function (a, b) { return a.at - b.at; });
}
var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg>';
/* one row of the Today board */
function hoRow(h) {
  var b = h.b, c = car(b.car) || {}, cu = cust(b.cust), late = !h.done && h.at < new Date();
  var end = h.done ? '<span class="chip tone-green">' + I('check', 2.6) + (h.type === 'out' ? 'Handed over' : 'Back') + '</span>'
    : late ? chip(h.type === 'out' ? 'Not picked up' : 'Late', 'red')
    : (can('bookings.see_amounts') || can('billing.view')) && b.paymentStatus ? payChip(b) : CHEV;
  return '<a class="row hm-ho' + (h.done ? ' done' : '') + '" href="#booking/' + b.id + '"><div class="ho"><div class="time"><b class="num">' + hm(h.at).replace(/ (am|pm)/i, '<small>$1</small>') + '</b><span class="' + h.type + '">' + (h.type === 'out' ? 'Out' : 'Back') + '</span></div></div>' +
    '<div class="grow"><div class="t1">' + esc(cu.name) + '</div><div class="t2">' + esc(c.plate || '') + ' · ' + esc(placeText(b, h.type === 'out' ? 'pick' : 'ret')) + '</div></div>' + end + '</a>';
}
function installBanner() {
  if (standalone()) return '';
  var dis = false; try { dis = localStorage.getItem('fms.installHide') === '1'; } catch (e) {}
  if (dis) return '';
  return '<div class="banner hm-install"><a href="#install" class="hm-install-a">' + I('install') + '<div><b>Install the app on this phone.</b> It opens full screen and can send you notifications. <u>How</u></div></a>' +
    '<button type="button" class="iconbtn" aria-label="Hide" onclick="try{localStorage.setItem(\'fms.installHide\',\'1\')}catch(e){};render(false,true)">' + I('x', 2.2) + '</button></div>';
}

var HOME = { updated: null };
VIEW_STATE.push(function () { HOME.updated = null; });

function hmHoursLate(t) { var h = Math.max(1, Math.floor((Date.now() - new Date(t)) / HOUR)); return h >= 48 ? Math.floor(h / 24) + ' days late' : h + (h === 1 ? ' hour late' : ' hours late'); }
function hmWait(n) { n = Math.max(0, n | 0); return n === 0 ? 'less than a day' : n + (n === 1 ? ' day' : ' days'); }
function hmCount(n) { return n + (n === 1 ? ' booking' : ' bookings'); }
function hmBkRow(b, right, sub) {
  var c = car(b.car) || {}, cu = cust(b.cust);
  return '<a class="card2" href="#booking/' + b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(cu.name) + ' · ' + esc(b.code) + '</div><div class="c2-t2">' + esc((c.plate || 'No car') + (sub ? ' · ' + sub : '')) + '</div></div><div class="c2-end">' + right + '</div></a>';
}
/* every 'Needs you' group the signed-in person may see */
function needsYou() {
  var now = Date.now(), out = [], money = can('bookings.see_amounts') || can('billing.view'), live = S.bookings.filter(function (b) { return b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Completed'; });
  if (can('bookings.view')) {
    var late = live.filter(isLate).sort(function (a, b) { return new Date(a.end) - new Date(b.end); });
    if (late.length) out.push({ key: 'late', title: 'Cars not back', tone: 'red', n: late.length, hint: 'Oldest ' + hmHoursLate(late[0].end), more: '#bookings/late', moreLabel: 'Open late bookings',
      rows: late.map(function (b) { return hmBkRow(b, chip(hmHoursLate(b.end), 'red'), 'due back ' + when(b.end)); }) });
    var missed = live.filter(function (b) { return (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Agreement Signed') && new Date(b.start).getTime() < now; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (missed.length) out.push({ key: 'missed', title: 'Missed pick-ups', tone: 'red', n: missed.length, hint: 'Booked to go out, not handed over', more: '#bookings/late', moreLabel: 'Open late bookings',
      rows: missed.map(function (b) { return hmBkRow(b, chip(b.bookingStatus === 'Confirmed' ? 'Confirmed' : 'Signed', 'grey'), 'was due ' + when(b.start)); }) });
    var unsigned = live.filter(function (b) { return b.bookingStatus === 'Agreement Sent' && new Date(b.end).getTime() >= now; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (unsigned.length && (can('bookings.edit') || can('bookings.change_status'))) out.push({ key: 'unsigned', title: 'Agreement sent, not signed', tone: 'amber', n: unsigned.length, hint: 'Next pick-up ' + when(unsigned[0].start), more: '#bookings/unsigned', moreLabel: 'Open unsigned bookings',
      rows: unsigned.map(function (b) { return hmBkRow(b, '<span class="small muted">' + esc(dayWord(b.start)) + '</span>', 'pick-up ' + when(b.start)); }) });
  }
  if (can('bookings.view') && money) {
    var depNo = live.filter(function (b) { var m; if (['Confirmed', 'Agreement Sent', 'Agreement Signed', 'Car Delivered'].indexOf(b.bookingStatus) < 0 || new Date(b.start).getTime() > now + 2 * DAY || new Date(b.end).getTime() < now) return false; if (b.paymentStatus && b.paymentStatus !== 'Deposit Due') return false; m = calcBooking(b); return m.deposit > 0 && m.depositReceived + 0.99 < m.deposit; })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (depNo.length) out.push({ key: 'deposit', title: 'Deposit not received', tone: 'amber', n: depNo.length, hint: 'Pick-up within 2 days or already started', more: '#bookings/upcoming', moreLabel: 'Open upcoming bookings',
      rows: depNo.map(function (b) { var m = calcBooking(b); return hmBkRow(b, '<span class="bal due money">' + rm(m.deposit - m.depositReceived) + '</span>', 'pick-up ' + when(b.start)); }) });
    var due = live.filter(function (b) { return new Date(b.start).getTime() < now + 2 * DAY && calcBooking(b).due > 0.99; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (due.length) out.push({ key: 'due', title: 'Balance to collect', tone: new Date(due[0].start).getTime() < now ? 'red' : 'amber', n: due.length, hint: rm(due.reduce(function (s, b) { return s + calcBooking(b).due; }, 0)) + ' within 48 hours', more: '#bookings/unpaid', moreLabel: 'Open money due',
      rows: due.map(function (b) { return hmBkRow(b, '<span class="bal due money">' + rm(calcBooking(b).due) + '</span>', (new Date(b.start).getTime() < now ? 'out since ' : 'pick-up ') + when(b.start)); }) });
  }
  if (can('deposits.view')) {
    var dix = typeof Deposit !== 'undefined' ? Deposit.index() : null;
    var dep = S.bookings.filter(function (b) { return b.paymentStatus === 'Refund Pending'; }).map(function (b) { var x = dix ? Deposit.info(b, dix) : { net: calcBooking(b).depositReceived, wait: Math.floor((now - new Date(b.refundPendingAt || b.end)) / DAY) }; return { b: b, x: x }; })
      .sort(function (a, b) { return b.x.wait - a.x.wait; });
    if (dep.length) out.push({ key: 'refund', title: 'Deposits to give back', tone: dep[0].x.wait >= 7 ? 'red' : 'amber', n: dep.length, hint: 'Longest waiting ' + hmWait(dep[0].x.wait), more: '#deposits', moreLabel: 'Open Deposits',
      rows: dep.map(function (r) { return '<button type="button" class="card2" onclick="closeSheet();Deposit.open(\'' + r.b.id + '\')"><div class="c2-main"><div class="c2-t1">' + esc(cust(r.b.cust).name) + ' · ' + esc(r.b.code) + '</div><div class="c2-t2">' + (r.x.wait > 0 ? 'Waiting ' + hmWait(r.x.wait) : 'Waiting since today') + '</div></div><div class="c2-end">' + (money ? rm(r.x.net) : '') + '</div></button>'; }) });
  }
  if (can('maintenance.view') && typeof Maint !== 'undefined') {
    var od = []; try { od = Maint.dueItems().filter(function (i) { return i.level === 'overdue'; }); } catch (e) { od = []; }
    if (od.length) out.push({ key: 'maint', title: 'Papers or services overdue', tone: 'red', n: od.length, hint: od.slice(0, 2).map(function (i) { return i.car.plate + ' ' + i.title.toLowerCase(); }).join(', '), more: '#maintenance', moreLabel: 'Open Maintenance',
      rows: od.map(function (i) { return '<a class="card2" href="#car/' + i.car.id + '"><div class="c2-main"><div class="c2-t1">' + esc(i.car.plate) + ' · ' + esc(i.title) + '</div><div class="c2-t2">' + esc(i.words || '') + '</div></div><div class="c2-end">' + chip('Overdue', 'red') + '</div></a>'; }) });
  }
  if (typeof INSTALMENTS_DUE_SOON === 'function') {
    var ins = INSTALMENTS_DUE_SOON();
    if (ins.length) out.push({ key: 'inst', title: 'Instalments due', tone: ins.some(function (r) { return r.overdueDays > 0; }) ? 'red' : 'amber', n: ins.length, hint: 'Within 3 days', more: '#instalments', moreLabel: 'Open Instalments',
      rows: ins.map(function (r) { return '<a class="card2" href="#instalments"><div class="c2-main"><div class="c2-t1">' + esc(r.plate || '') + '</div><div class="c2-t2">' + esc(r.text || dFull(r.due)) + '</div></div><div class="c2-end">' + rm(r.amt) + '</div></a>'; }) });
  }
  return out;
}
function hmNeedsOpen(key) {
  var g = needsYou().filter(function (x) { return x.key === key; })[0];
  if (!g) { say('All clear here now'); render(false, true); return; }
  sheet(sheetHead(g.title, g.n + (g.n === 1 ? ' item' : ' items') + ' · ' + g.hint) + '<div class="list hm-needs-list">' + g.rows.join('') + '</div>' +
    '<div class="sheet-foot"><a class="btn ghost" href="' + g.more + '">' + esc(g.moreLabel) + '</a></div>', { full: g.n > 6 });
}

/* the next handover still to do: mine first for field staff, then anyone's, up to 2 days ahead */
function hmNextHandover() {
  var now = Date.now(), ev = [];
  S.bookings.forEach(function (b) {
    if (UPCOMING.indexOf(b.bookingStatus) >= 0 && b.bookingStatus !== 'Pending') { var t = new Date(b.start).getTime(); if (t > now - 6 * HOUR && t < now + 2 * DAY) ev.push({ b: b, at: t, type: 'out' }); }
    if (b.bookingStatus === 'Car Delivered') { var e = new Date(b.end).getTime(); if (e > now - 6 * HOUR && e < now + 2 * DAY) ev.push({ b: b, at: e, type: 'in' }); }
  });
  ev.sort(function (a, b) { return a.at - b.at; });
  var mine = typeof myJob === 'function' ? ev.filter(function (x) { return myJob(x.b); }) : [];
  return (me().isAgent || me().role === 'agent') && mine.length ? { e: mine[0], mine: true } : ev.length ? { e: ev[0], mine: typeof myJob === 'function' && myJob(ev[0].b) } : null;
}
function hmCountdown(t) {
  var m = Math.round((t - Date.now()) / MIN), late = m < 0; m = Math.abs(m);
  var txt = m < 1 ? 'now' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
  if (m >= 24 * 60) txt = Math.floor(m / 1440) + (Math.floor(m / 1440) === 1 ? ' day' : ' days') + (Math.floor((m % 1440) / 60) ? ' ' + Math.floor((m % 1440) / 60) + ' h' : '');
  return m < 1 ? 'Due now' : late ? txt + ' late' : 'In ' + txt;
}
function hmStartHandover(id, dir) { if (typeof Handover !== 'undefined' && Handover.start) Handover.start(id, dir); else location.hash = '#booking/' + id; }

VIEWS.home = function () {
  var now = new Date(), today = handovers(now), b = B(), money = can('bookings.see_revenue') || can('billing.view');
  if (!HOME.updated) HOME.updated = now.toISOString();
  var outs = today.filter(function (h) { return h.type === 'out'; }), ins = today.filter(function (h) { return h.type === 'in'; });
  var onRoad = S.bookings.filter(function (x) { return x.bookingStatus === 'Car Delivered'; }).length;
  var todo = today.filter(function (h) { return !h.done; });
  var hr = now.getHours(), hi = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  /* Needs you */
  var nd = needsYou();
  var needs = '<div class="sec"><h2>Needs you</h2>' + (nd.length ? '<span class="small muted">' + nd.reduce(function (s, g) { return s + g.n; }, 0) + ' to look at</span>' : '') + '</div>' +
    (nd.length ? '<div class="list hm-needs">' + nd.map(function (g) {
      return '<button type="button" class="row hm-need" data-need="' + g.key + '"><span class="hm-n tone-' + g.tone + '">' + g.n + '</span><div class="grow"><div class="t1">' + esc(g.title) + '</div><div class="t2">' + esc(g.hint) + '</div></div>' + CHEV + '</button>';
    }).join('') + '</div>' : '<div class="card hm-clear">' + I('check', 2.4) + '<div><b>All clear</b><div class="small muted">Nothing late or waiting on you right now.</div></div></div>');

  /* quick actions */
  var qa = [];
  if (can('bookings.create')) qa.push(['#new', 'plus', 'New booking']);
  if (can('bookings.view')) qa.push(['#availability', 'search', 'Check availability']);
  if (can('billing.record_payment')) qa.push(['js:slip', 'receipt', 'Upload slip']);
  if (can('expenses.add')) qa.push(['js:expense', 'tag', 'Add expense']);
  var bankOk = can('expenses.add') || can('expenses.staff_reports_all');
  if (bankOk && typeof BankIn !== 'undefined') qa.push(['js:bankin', 'bank', 'Bank in cash']);
  var quick = qa.length ? '<div class="hm-quick">' + qa.map(function (q) {
    return q[0].indexOf('js:') === 0 ? '<button type="button" class="gtile" data-qa="' + q[0].slice(3) + '"><span class="gi">' + I(q[1]) + '</span>' + q[2] + '</button>' : '<a class="gtile" href="' + q[0] + '"><span class="gi">' + I(q[1]) + '</span>' + q[2] + '</a>';
  }).join('') + '</div>' : '';
  if (bankOk && typeof cashHeld === 'function') {
    var held = (cashHeld()[S.me] || { held: 0 }).held;
    quick = quick.replace(/<\/div>$/, '<a class="gtile hm-cash" href="#cash"><span class="hm-cash-k">Cash I hold</span><b class="money">' + rm(held) + '</b></a></div>');
  }
  /* drafts */
  var drafts = '';
  if (typeof NB_DRAFT === 'function' && can('bookings.create')) { try { drafts += NB_DRAFT(); } catch (e) {} }
  if (typeof HANDOVER_DRAFTS === 'function') {
    try {
      HANDOVER_DRAFTS().slice(0, 2).forEach(function (d) {
        drafts += '<div class="nb-draftcard hm-hodraft"><div class="nb-draft-ic">' + I(d.dir === 'in' ? 'in' : 'out') + '</div><div class="grow"><div class="b">Resume handover</div><div class="small muted">' + esc((d.dir === 'in' ? 'Return' : 'Pick-up') + ' · ' + d.code + ' · ' + d.plate + ' · step ' + (d.step + 1) + ' of ' + d.steps + ' · saved ' + ago(d.at)) + '</div></div>' +
          '<div class="nb-draft-act"><button type="button" class="btn sm" onclick="hmStartHandover(\'' + d.bookingId + '\',\'' + d.dir + '\')">Resume</button></div></div>';
      });
    } catch (e) {}
  }

  /* next handover */
  var nx = hmNextHandover(), next = '';
  if (nx) {
    var e = nx.e, eb = e.b, ec = car(eb.car) || {}, late = e.at < Date.now();
    var canStart = e.type === 'out' ? UPCOMING.indexOf(eb.bookingStatus) >= 0 : eb.bookingStatus === 'Car Delivered';
    next = '<div class="sec"><h2>Next handover</h2><a href="#schedule">Schedule</a></div>' +
      '<div class="card hm-next' + (late ? ' late' : '') + '"><a class="hm-next-top" href="#booking/' + eb.id + '">' +
      '<div class="hm-next-when"><span class="hm-cd" data-at="' + e.at + '">' + esc(hmCountdown(e.at)) + '</span><small>' + esc((e.type === 'out' ? 'Pick-up ' : 'Return ') + when(e.at)) + '</small></div>' +
      '<div class="hm-next-who"><b>' + esc(cust(eb.cust).name) + '</b><span>' + esc((ec.plate || '') + ' · ' + (ec.make || '') + ' ' + (ec.model || '')) + '</span><span>' + I('pin') + esc(placeText(eb, e.type === 'out' ? 'pick' : 'ret')) + '</span></div></a>' +
      '<div class="hm-next-act">' + (nx.mine ? chip('Your job', 'blue') : '') + (money && eb.paymentStatus ? payChip(eb) : '') + '<span class="grow"></span>' +
      (canStart ? '<button type="button" class="btn sm" onclick="hmStartHandover(\'' + eb.id + '\',\'' + e.type + '\')">' + I(e.type === 'out' ? 'key' : 'in') + 'Start handover</button>' : '') + '</div></div>';
  }

  /* tiles */
  var tiles = '<div class="tiles hm-tiles">' +
    '<a class="tile" href="#schedule"><div class="k">' + I('out') + 'Going out today</div><div class="v num">' + outs.length + '</div></a>' +
    '<a class="tile" href="#schedule"><div class="k">' + I('in') + 'Coming back today</div><div class="v num">' + ins.length + '</div></a>' +
    '<a class="tile" href="' + (can('cars.view') ? '#cars' : '#bookings/road') + '"><div class="k">' + I('car') + 'Cars on the road</div><div class="v num">' + onRoad + '<small> / ' + S.cars.filter(function (c) { return c.status === 'active'; }).length + '</small></div></a>' +
    (money ? '<a class="tile" href="#money"><div class="k">' + I('cash') + 'Money in today</div><div class="v money hm-money">' + rm(typeof MONEY_TODAY === 'function' ? MONEY_TODAY() : 0) + '</div></a>'
      : '<a class="tile" href="#bookings/upcoming"><div class="k">' + I('list') + 'Upcoming</div><div class="v num">' + S.bookings.filter(function (x) { return UPCOMING.indexOf(x.bookingStatus) >= 0 && new Date(x.start) > now; }).length + '</div></a>') + '</div>';

  /* today board */
  var board = '<div class="sec"><h2>Today</h2><a href="#schedule">All</a></div>' +
    (today.length ? '<div class="list">' + today.map(hoRow).join('') + '</div>' : '<div class="list"><div class="empty">No pick-ups or returns today. Tomorrow has ' + handovers(new Date(now.getTime() + DAY)).length + '.</div></div>');

  var html = topbar(b.short, { sub: WD[now.getDay()] + ', ' + now.getDate() + ' ' + MO[now.getMonth()] }) + '<main class="hm-main"><div class="hm-ptr" id="hmPtr">' + I('reset', 2.2) + '<span>Pull to refresh</span></div>' + installBanner() +
    '<div class="hm-hello"><div class="hm-hi">' + hi + ', ' + esc(firstName(myName())) + '</div><div class="muted small">' + (todo.length ? todo.length + ' handover' + (todo.length > 1 ? 's' : '') + ' still to do today' : 'All handovers done for today') + ' · Updated ' + hm(HOME.updated) + '</div></div>' +
    needs + (quick ? '<div class="sec"><h2>Quick actions</h2></div>' + quick : '') + (drafts ? '<div class="hm-drafts">' + drafts + '</div>' : '') + next + '<div class="sec"><h2>At a glance</h2></div>' + tiles + board +
    '<div class="sec"><h2>Latest</h2><a href="#inbox">All</a></div><div class="list">' + (S.notifs.slice(0, 3).map(notifRow).join('') || '<div class="empty">No news yet</div>') + '</div>' +
    '<p class="demo-note">Demo with made-up data · saved on this phone only</p></main>';
  return { html: html, after: function () {
    $$('[data-need]').forEach(function (el) { el.onclick = function () { hmNeedsOpen(el.dataset.need); }; });
    $$('[data-qa]').forEach(function (el) { el.onclick = function () {
      var k = el.dataset.qa;
      if (k === 'slip') { if (typeof Pay !== 'undefined' && Pay.slip) Pay.slip(null); else comingSoon('Upload slip'); }
      else if (k === 'expense') { if (typeof Expenses !== 'undefined') Expenses.add({}); else comingSoon('Add expense'); }
      else if (k === 'bankin') BankIn.open({ staff: S.me });
    }; });
  } };
};
/* countdown ticks every 30 s while Home is on screen */
setInterval(function () { $$('.hm-cd').forEach(function (el) { el.textContent = hmCountdown(+el.dataset.at); }); }, 30000);
/* pull down at the top of Home to refresh */
(function () {
  var y0 = null, dy = 0, TH = 70;
  function ok() { return S && route().name === 'home' && !SHEETS.length && window.scrollY <= 0; }
  window.addEventListener('touchstart', function (e) { if (!ok()) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (y0 == null) return; dy = e.touches[0].clientY - y0; var p = $('#hmPtr'); if (!p) return;
    if (dy > 4 && window.scrollY <= 0) { var h = Math.min(dy * 0.5, 60); p.style.height = h + 'px'; p.style.opacity = String(Math.min(1, h / 35)); p.classList.toggle('ready', dy > TH); $('span', p).textContent = dy > TH ? 'Let go to refresh' : 'Pull to refresh'; }
  }, { passive: true });
  window.addEventListener('touchend', function () {
    if (y0 == null) return; var p = $('#hmPtr'), go = dy > TH; y0 = null;
    if (p) { p.style.height = ''; p.style.opacity = ''; p.classList.remove('ready'); }
    if (go) hmRefresh();
  });
})();
function hmRefresh() { HOME.updated = new Date().toISOString(); render(false, true); say('Updated ' + hm(HOME.updated)); }

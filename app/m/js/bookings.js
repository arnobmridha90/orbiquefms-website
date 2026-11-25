/* ---------------- BOOKINGS (M1 builder owns this file) ----------------
   List with quick chips, filters and search; booking detail with next step, two status axes, money, documents,
   customer, deposit, inspection, staff and history; change, extend, cancel and delete sheets.
   Payments go through Pay.open (payments.js), handovers and take backs through Handover.start (handover.js). */

/* ---------------- list state ---------------- */
var bkSearch = '';
var BKF = { bs: [], ps: [], car: '', from: '', to: '' };
var _bkTimer = null;
VIEW_STATE.push(function () { bkSearch = ''; BKF = { bs: [], ps: [], car: '', from: '', to: '' }; });
/* entering the tab from the bottom nav starts with a clean search */
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest && e.target.closest('.nav a[href="#bookings"]'); if (!a) return;
  bkSearch = '';
  /* already on the list: no hashchange will redraw it, so redraw here */
  if (location.hash === '#bookings') setTimeout(function () { if (route().name === 'bookings') render(false); }, 0);
}, true);

function bkWhen(d) { return dLong(d) + ' ' + hm(d); }
function bkWhenNw(d) { return '<span class="nowrap">' + dLong(d) + '</span> <span class="nowrap">' + hm(d) + '</span>'; }
var BK_CHIPS = [
  ['upcoming', 'Upcoming'], ['out', 'Going out today'], ['back', 'Coming back today'], ['road', 'Out now'], ['late', 'Late'],
  ['unpaid', 'Money due'], ['unsigned', 'Sent, not signed'], ['notsent', 'Form not sent'], ['done', 'Returned'], ['all', 'All'], ['cancelled', 'Cancelled']
];
/* lists that Home's 'Needs you' opens: same rule, same count. Shown as a chip only while open. */
var BK_EXTRA = { notback: 'Cars not back', missed: 'Missed pick-ups', depositdue: 'Deposit not received', collect: 'Balance to collect' };
function bkLive(b) { return b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Completed'; }
var BK_TESTS = {
  upcoming: function (b) { return UPCOMING.indexOf(b.bookingStatus) >= 0; },
  out: function (b) { return UPCOMING.indexOf(b.bookingStatus) >= 0 && sameDay(b.start, new Date()); },
  back: function (b) { return b.bookingStatus === 'Car Delivered' && sameDay(b.end, new Date()); },
  road: function (b) { return b.bookingStatus === 'Car Delivered'; },
  late: function (b) { return isLate(b) || isMissedPickup(b); },
  unpaid: function (b) { return b.bookingStatus !== 'Cancelled' && calcBooking(b).due > 0; },
  unsigned: function (b) { return b.bookingStatus === 'Agreement Sent' && new Date(b.end).getTime() >= Date.now(); },
  notsent: function (b) { return (b.bookingStatus === 'Pending' || b.bookingStatus === 'Confirmed') && !b.submitted && new Date(b.end).getTime() >= Date.now(); },
  notback: function (b) { return isLate(b); },
  missed: function (b) { return (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Agreement Signed') && new Date(b.start).getTime() < Date.now(); },
  depositdue: function (b) {
    var now = Date.now(), m;
    if (['Confirmed', 'Agreement Sent', 'Agreement Signed', 'Car Delivered'].indexOf(b.bookingStatus) < 0 || new Date(b.start).getTime() > now + 2 * DAY || new Date(b.end).getTime() < now) return false;
    if (b.paymentStatus && b.paymentStatus !== 'Deposit Due') return false;
    m = calcBooking(b); return m.deposit > 0 && m.depositReceived + 0.99 < m.deposit;
  },
  collect: function (b) { return bkLive(b) && new Date(b.start).getTime() < Date.now() + 2 * DAY && calcBooking(b).due > 0.99; },
  done: function (b) { return b.bookingStatus === 'Car Returned' || b.bookingStatus === 'Completed'; },
  cancelled: function (b) { return b.bookingStatus === 'Cancelled'; },
  all: function () { return true; }
};
function bkFilterCount() { return (BKF.bs.length ? 1 : 0) + (BKF.ps.length ? 1 : 0) + (BKF.car ? 1 : 0) + (BKF.from || BKF.to ? 1 : 0); }
function bkPassFilters(b) {
  if (BKF.bs.length && BKF.bs.indexOf(b.bookingStatus) < 0) return false;
  if (BKF.ps.length && BKF.ps.indexOf(b.paymentStatus || 'None') < 0) return false;
  if (BKF.car && b.car !== BKF.car) return false;
  if (BKF.from || BKF.to) {
    var f = fromInputs(BKF.from || BKF.to, '00:00'), t = fromInputs(BKF.to || BKF.from, '00:00'); t = new Date(t.getTime() + DAY - 1);
    if (!(new Date(b.end) >= f && new Date(b.start) <= t)) return false;
  }
  return true;
}
function bkBase() { var q = bkSearch.trim(); return S.bookings.filter(function (b) { return bkPassFilters(b) && Pickers.bookingMatches(b, q); }); }

VIEWS.bookings = function (r) {
  var f = BK_TESTS[r.a] ? r.a : 'upcoming';
  var nUp = S.bookings.filter(BK_TESTS.upcoming).length, nRoad = S.bookings.filter(BK_TESTS.road).length;
  var html = topbar('Bookings', { sub: nUp + ' upcoming · ' + nRoad + ' on the road' }) + '<main class="bkpage">' +
    '<div class="bk-tools"><label class="search bk-search">' + I('search') + '<input id="bkq" type="search" placeholder="Name, phone, plate, no." value="' + esc(bkSearch) + '" autocomplete="off" enterkeyhint="search">' +
    '<button type="button" class="bk-clear" id="bkclear" aria-label="Clear search"' + (bkSearch ? '' : ' hidden') + '>' + I('x', 2.2) + '</button></label>' +
    '<button type="button" class="bk-fbtn' + (bkFilterCount() ? ' on' : '') + '" id="bkfbtn" onclick="bkFilterSheet()">' + I('filter') + '<span>Filters</span>' + (bkFilterCount() ? '<b class="bk-badge">' + bkFilterCount() + '</b>' : '') + '</button></div>' +
    '<div class="bk-quick"><a href="#availability">' + I('car') + 'Free cars</a><a href="#calendar">' + I('cal') + 'Calendar</a></div>' +
    (typeof NB_DRAFT === 'function' && can('bookings.create') ? (function () { try { return NB_DRAFT(); } catch (e) { return ''; } })() : '') +
    '<div class="chiprow" id="bkchips"></div><div id="bkfon"></div>' +
    '<div id="bklist" style="margin-top:8px"></div></main>';
  return { html: html, after: function () {
    bkDraw(f);
    var i = $('#bkq'), clr = $('#bkclear');
    i.addEventListener('input', function () {
      bkSearch = i.value; clr.hidden = !i.value; clearTimeout(_bkTimer);
      _bkTimer = setTimeout(function () { bkDraw(f); bkMaybeOpen(); }, 150);
    });
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); bkMaybeOpen(true); i.blur(); } });
    clr.onclick = function () { i.value = ''; bkSearch = ''; clr.hidden = true; bkDraw(f); i.focus(); };
  } };
};
/* a bare booking number that matches exactly one booking (and cannot grow into another) opens it */
function bkMaybeOpen(enter) {
  var q = bkSearch.trim(); if (!/^#?([a-z]{2,5})?[\s\-]*\d{1,7}$/i.test(q)) return;
  var hits = S.bookings.filter(function (b) { return matchBookingCode(q, b); });
  if (hits.length !== 1) return;
  var n = digits(q).replace(/^0+/, ''), longer = S.bookings.some(function (b) { return String(b.no) !== n && String(b.no).indexOf(n) === 0; });
  if (longer && !enter) return;
  location.hash = '#booking/' + hits[0].id;
}
function bkDraw(f) {
  var base = bkBase();
  var chipsNow = BK_EXTRA[f] ? [[f, BK_EXTRA[f]]].concat(BK_CHIPS) : BK_CHIPS;
  $('#bkchips').innerHTML = chipsNow.map(function (l) {
    var n = base.filter(BK_TESTS[l[0]]).length;
    return '<a class="fchip ' + (f === l[0] ? 'on' : '') + '" href="#bookings/' + l[0] + '" onclick="bkGo(event,\'' + l[0] + '\')">' + l[1] + ' <span class="n">' + n + '</span></a>';
  }).join('');
  var on = $('#bkchips .on'); if (on && on.scrollIntoView && !bkDraw._done) { bkDraw._done = true; var row = $('#bkchips'); row.scrollLeft = Math.max(0, on.offsetLeft - 40); }
  var nf = bkFilterCount();
  $('#bkfon').innerHTML = nf ? '<div class="bk-fon">' + nf + ' filter' + (nf > 1 ? 's' : '') + ' on · <button type="button" onclick="bkClearFilters()">Clear</button></div>' : '';
  var list = base.filter(BK_TESTS[f]);
  var newest = f === 'done' || f === 'all' || f === 'cancelled';
  list.sort(function (a, b) { return newest ? new Date(b.start) - new Date(a.start) : f === 'back' || f === 'road' || f === 'late' || f === 'notback' ? new Date(a.end) - new Date(b.end) : new Date(a.start) - new Date(b.start); });
  $('#bklist').innerHTML = bkList(list, f);
}
/* chip taps replace the hash: the chips are a view setting, not a Back step */
function bkGo(e, f) { e.preventDefault(); bkDraw._done = true; history.replaceState(history.state, '', location.pathname + location.search + '#bookings/' + f); bkDraw(f); }
function bkClearFilters() { BKF = { bs: [], ps: [], car: '', from: '', to: '' }; render(false, true); }
function bkList(list, f) {
  if (!list.length) return '<div class="empty">No bookings here' + (bkSearch ? ' for “' + esc(bkSearch) + '”' : '') + '.' + (bkFilterCount() ? '<br><button class="btn link" onclick="bkClearFilters()">Clear the filters</button>' : '') + '</div>';
  var out = '', last = '', max = 120;
  list.slice(0, max).forEach(function (b) {
    if (f === 'upcoming') { var d = dayWord(b.start); if (d !== last) { out += '<div class="sec bk-day"><h2>' + d + '</h2></div>'; last = d; } }
    out += bkCard(b);
  });
  if (list.length > max) out += '<div class="empty small">Showing the first ' + max + ' of ' + list.length + '. Search or filter to find the rest.</div>';
  return out;
}
function bkCard(b) {
  var c = car(b.car) || {}, cu = cust(b.cust);
  return '<a class="bk bk2" href="#booking/' + b.id + '"><div class="l1"><span class="who">' + esc(cu.name) + '</span>' + flagChip(custFlag(cu)) + '<span class="code">' + esc(b.code) + '</span></div>' +
    '<div class="bk-chips">' + statusChip(b) + payChip(b) + '</div>' +
    '<div class="bk-l3"><span class="car">' + carSVG(c.color, c.shape) + '</span><span class="bk-plate"><b>' + esc(c.plate || '') + '</b><small>' + esc(c.model || '') + '</small></span>' +
    '<span class="bk-dates"><span>' + bkWhen(b.start) + '</span><span>→ ' + bkWhen(b.end) + '</span></span></div>' +
    (b.bookingStatus !== 'Cancelled' && can('bookings.see_amounts') ? '<div class="bk-money">' + moneyLine(b) + '</div>' : '') + '</a>';
}

/* ---------------- filters sheet ---------------- */
function bkFilterSheet() {
  var d = JSON.parse(JSON.stringify(BKF));
  var chips = function (id, list, on) { return '<div class="seg bk-multi" id="' + id + '">' + list.map(function (s) { return '<button type="button" data-v="' + esc(s) + '" class="' + (on.indexOf(s) >= 0 ? 'on' : '') + '">' + esc(s) + '</button>'; }).join('') + '</div>'; };
  var carBtn = function () { var c = car(d.car); return c ? '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model) + '</span></span><span class="btn sm ghost" data-x>Remove</span>' : I('car') + '<span class="grow">Any car</span>' + I('chevdown'); };
  sheet(sheetHead('Filters', 'Only show bookings that match all of these') +
    '<div class="field"><span>Booking status</span>' + chips('fbs', BK_STATUSES, d.bs) + '</div>' +
    '<div class="field"><span>Payment status</span>' + chips('fps', ['None'].concat(PAY_STATUSES), d.ps) + '</div>' +
    '<div class="field"><span>Car</span><button type="button" class="carfield' + (d.car ? ' picked-car' : ' empty-car') + '" id="fcar">' + carBtn() + '</button></div>' +
    '<div class="field"><span>Dates (bookings on these days)</span><div class="bk-range"><label><small>From</small><input class="inp" type="date" id="ffrom" value="' + esc(d.from) + '"></label><label><small>To</small><input class="inp" type="date" id="fto" value="' + esc(d.to) + '"></label></div>' +
    '<div class="seg bk-qd"><button type="button" data-q="0">Today</button><button type="button" data-q="1">Tomorrow</button><button type="button" data-q="7">Next 7 days</button><button type="button" data-q="x">Any date</button></div></div>' +
    '<div class="sheet-foot"><div class="btnrow"><button class="btn ghost" id="freset">Clear all</button><button class="btn" id="fapply">Show bookings</button></div></div>', function (sh) {
      $$('.bk-multi button', sh).forEach(function (btn) { btn.onclick = function () { btn.classList.toggle('on'); }; });
      $('#fcar', sh).onclick = function (e) {
        if (e.target.closest('[data-x]')) { d.car = ''; this.className = 'carfield empty-car'; this.innerHTML = carBtn(); return; }
        var el = this; Pickers.car({ showBusy: true, all: true, selected: d.car, title: 'Bookings of which car?', onPick: function (c) { d.car = c.id; el.className = 'carfield picked-car'; el.innerHTML = carBtn(); } });
      };
      $$('.bk-qd button', sh).forEach(function (btn) { btn.onclick = function () {
        var q = btn.dataset.q, t = sod(new Date());
        if (q === 'x') { $('#ffrom').value = ''; $('#fto').value = ''; return; }
        var a = new Date(t.getTime() + (q === '1' ? DAY : 0)), z = q === '7' ? new Date(t.getTime() + 6 * DAY) : a;
        $('#ffrom').value = toLocalInput(a); $('#fto').value = toLocalInput(z);
      }; });
      $('#freset', sh).onclick = function () { BKF = { bs: [], ps: [], car: '', from: '', to: '' }; closeSheet(); render(false, true); };
      $('#fapply', sh).onclick = function () {
        var f = $('#ffrom').value, t = $('#fto').value;
        if (f && t && t < f) { var x = f; f = t; t = x; }
        BKF = { bs: $$('#fbs .on', sh).map(function (x) { return x.dataset.v; }), ps: $$('#fps .on', sh).map(function (x) { return x.dataset.v; }), car: d.car, from: f, to: t };
        closeSheet(); render(false, true);
      };
    });
}

/* ---------------- BOOKING DETAIL ---------------- */
function bkNextStep(b) {
  var st = b.bookingStatus, id = "'" + b.id + "'", mine = (b.assigned || []).indexOf(S.me) >= 0;
  /* status steps need the status right; handing over and taking back also suit the agent assigned to the booking */
  var canSt = can('bookings.change_status'), canHand = canSt || can('bookings.edit') || mine;
  if ((st === 'Pending' || st === 'Confirmed') && !(canSt || can('bookings.edit'))) return null;
  if ((st === 'Agreement Sent' || st === 'Car Returned') && !canSt) return null;
  if ((st === 'Agreement Signed' || st === 'Car Delivered') && !canHand) return null;
  if (st === 'Pending' || st === 'Confirmed') return { label: 'Send agreement', icon: 'send', on: 'bkSendAgreement(' + id + ')', hint: 'Sends the booking form link to the customer' };
  if (st === 'Agreement Sent') return { label: 'Mark signed', icon: 'check', on: 'bkMarkSigned(' + id + ')', hint: 'Waiting for the customer to sign the form' };
  if (st === 'Agreement Signed') return { label: 'Hand over the car', icon: 'key', on: 'Handover.start(' + id + ',\'out\')', hint: 'Ends at Car Delivered' };
  if (st === 'Car Delivered') return { label: 'Take the car back', icon: 'in', on: 'Handover.start(' + id + ',\'in\')', hint: isLate(b) ? 'The car is late. It was due back ' + when(b.end) : 'Ends at Car Returned' };
  if (st === 'Car Returned') return { label: 'Complete', icon: 'check', on: 'completeBk(' + id + ')', hint: b.paymentStatus === 'Refund Pending' ? 'The deposit is still waiting to be returned' : 'Closes the booking' };
  return null;
}
function bkRepeat(b) { return repeatText(b.cust, b.id); }
function bkCustBanner(b, cu) {
  var notes = (S.notes || []).filter(function (n) { return n.cust === cu.id; }).sort(function (a, z) { return (z.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(z.at) - new Date(a.at); });
  var lines = function (flag) { return notes.filter(function (n) { return n.flag === flag; }).slice(0, 2).map(function (n) { return n.text; }); };
  var rep = bkRepeat(b), box = function (tone, icon, title, ls) { ls = ls.filter(Boolean); return '<div class="banner ' + tone + ' bk-cb">' + I(icon) + '<div><b>' + esc(title) + '</b>' + (ls.length ? '<ul>' + ls.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>'; };
  if (cu.blacklist) return box('red', 'warn', 'Blacklisted customer' + (cu.blacklist.at ? ', since ' + dFull(cu.blacklist.at) : ''), ['Reason: ' + (cu.blacklist.reason || 'not given')].concat(lines('careful'), [rep]));
  if (notes.some(function (n) { return n.flag === 'careful'; })) return box('amber', 'warn', 'Be careful with this customer', lines('careful').concat([rep]));
  if (notes.some(function (n) { return n.flag === 'vip'; })) return box('blue', 'star', 'VIP customer', lines('vip').concat([rep]));
  if (notes.length) return box('blue', 'note', 'Notes about this customer', lines('info').concat([rep]));
  if (rep) return box('blue', 'user', rep, []);
  return '';
}
function bkCarBanner(b, c) {
  if (!c || b.bookingStatus === 'Completed' || b.bookingStatus === 'Cancelled') return '';
  var out = [], today = toLocalInput(new Date());
  ['Road tax', 'Insurance'].forEach(function (t) { var p = carPaper(c.id, t); if (p && p.until < today) out.push(t + ' expired on ' + dFull(p.until + 'T00:00:00')); else if (p && p.until < toLocalInput(b.end)) out.push(t + ' ends on ' + dFull(p.until + 'T00:00:00') + ', before this rental ends'); });
  if (c.serviceEveryKm && c.km && (c.km - (c.lastServiceKm || 0)) >= c.serviceEveryKm) out.push('Service overdue: ' + (c.km - (c.lastServiceKm || 0)).toLocaleString('en-US') + ' km since the last one');
  var s = new Date(b.start).getTime(), e = new Date(b.end).getTime();
  (S.downtime || []).forEach(function (d) { if (d.car !== c.id) return; var f = new Date(d.from).getTime(), t = d.to ? new Date(d.to).getTime() : Infinity; if (f < e && t > s) out.push('Blocked for the workshop' + (d.to ? ' until ' + dShort(d.to) : ', no return date yet') + (d.reason ? ': ' + d.reason : '')); });
  if (!out.length) return '';
  return '<div class="banner red bk-cb">' + I('car') + '<div><b>Check the car ' + esc(c.plate) + '</b><ul>' + out.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div></div>';
}
function bkMoneyCard(b, p) {
  if (!can('bookings.see_amounts')) return '<div class="card muted small bk-hidden">' + I('lock') + 'Amounts hidden for your role</div>';
  var st = b.bookingStatus;
  var line = function (label, v, neg, cls) { return '<div class="sumline' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><span class="money">' + (neg ? rm(-v) : rm(v)) + '</span></div>'; };
  var status = st === 'Cancelled' ? '<span>Cancelled. Nothing more is due.</span>' :
    p.overpaid ? '<b>Paid in full, ' + rm(p.overpaid) + ' extra</b>' : p.settled || p.payable <= 0 ? '<b>Paid in full</b>' : '<span>Still due <b class="money">' + rm(p.due) + '</b></span>';
  return '<div class="list bk-money-card">' + line('Rent · ' + esc(p.duration), p.rent) +
    (p.coverTotal ? line(esc(b.cover.name) + ' · ' + p.coverDays + ' day' + (p.coverDays > 1 ? 's' : ''), p.coverTotal) : line('Damage cover', 0, false, 'faint')) +
    (p.delivery ? line('Delivery', p.delivery) : '') + (p['return'] ? line('Return', p['return']) : '') + (function () { var oc = Math.min(+b.overCharge || 0, p.others); return (p.others - oc > 0.004 ? line('Others', p.others - oc) : '') + (oc > 0.004 ? line('Kept over the deposit', oc) : ''); })() + (p.discount ? line('Discount', p.discount, true) : '') +
    line('Deposit (refundable)', p.deposit) + '<div class="sumline big"><span>Total payable</span><span class="money">' + rm(p.payable) + '</span></div>' +
    line('Received', p.received, false, 'muted') + (p.extra ? line('Other payments (extension, extras)', p.extra, false, 'muted') : '') + bkDepositLeftLine(b, p) +
    '<div class="bk-bar tone-' + p.tone + '" role="status">' + status + '</div></div>';
}
/* 'Deposit left RM 8.00 (RM 492.00 used for payments)' once part of the deposit received is used, kept or returned */
function bkDepositLeftLine(b, p) {
  if (!(p.depositReceived > 0) || b.bookingStatus === 'Cancelled' || !window.Pay || !Pay.depositLeft) return '';
  var left = Pay.depositLeft(b); if (left >= p.depositReceived - 0.004) return '';
  var ds = (S.deductions || []).filter(function (d) { return d.booking === b.id; }), sum = function (l) { return l.reduce(function (s, d) { return s + (+d.amt || 0); }, 0); };
  var used = sum(ds.filter(function (d) { return d.kind === 'Used for a payment'; })), kept = sum(ds.filter(function (d) { return d.kind !== 'Used for a payment'; }));
  var back = (S.refunds || []).filter(function (r) { return r.booking === b.id && !r.voided; }).reduce(function (s, r) { return s + (+r.amt || 0); }, 0);
  var why = [used ? rm(used) + ' used for payments' : '', kept ? rm(kept) + ' kept' : '', back ? rm(back) + ' returned' : ''].filter(Boolean).join(', ');
  return '<div class="sumline bk-depleft"><span>Deposit left' + (why ? '<small>' + esc(why) + '</small>' : '') + '</span><span class="money">' + rm(left) + '</span></div>';
}
function bkDocRow(b, kind, cu) {
  var url, title, sub, icon, ok = true;
  if (kind === 'form') { url = Links.form(b); title = 'Customer form'; icon = 'file'; sub = b.submitted ? 'Form signed on ' + dFull(b.submittedAt || b.created) : 'Form not signed yet'; }
  else if (kind === 'pdf') { url = Links.pdf(b); title = 'Agreement PDF'; icon = 'receipt'; ok = !!b.submitted; sub = ok ? 'Signed agreement, ready to send' : 'Form not signed yet'; }
  else if (kind === 'agent') { url = Links.agent(b); title = 'Agent inspection link'; icon = 'camera'; ok = !!url; sub = ok ? 'For the staff who hands over the car' : 'No link yet for this booking'; }
  else { url = Links.customer(b); title = 'Customer inspection link'; icon = 'image'; sub = 'The customer takes photos before driving off'; }
  var a = "'" + b.id + "','" + kind + "'", dis = ok ? '' : ' disabled';
  return '<div class="row bk-doc' + (ok ? '' : ' off') + '">' + I(icon) + '<div class="grow"><div class="t1">' + title + '</div><div class="t2">' + esc(sub) + '</div></div>' +
    '<div class="bk-docbtns"><button class="iconbtn" aria-label="Send on WhatsApp" onclick="bkShare(' + a + ',\'wa\')"' + dis + '>' + I('wa') + '</button>' +
    '<button class="iconbtn" aria-label="Share" onclick="bkShare(' + a + ',\'share\')"' + dis + '>' + I('share') + '</button>' +
    '<button class="iconbtn" aria-label="Copy link" onclick="bkShare(' + a + ',\'copy\')"' + dis + '>' + I('copy') + '</button></div></div>';
}
function bkShareText(b, kind) {
  var cu = cust(b.cust), c = car(b.car) || {}, hi = 'Hi ' + callName(cu.name) + ', ', co = B().name;
  if (kind === 'form') return hi + 'here is your booking form for ' + b.code + ' with ' + co + ' (' + c.plate + ', ' + dShort(b.start) + ' to ' + dShort(b.end) + '). Please fill it in and sign: ' + Links.form(b);
  if (kind === 'pdf') return hi + 'here is your signed rental agreement for ' + b.code + ' with ' + co + ': ' + Links.pdf(b);
  if (kind === 'agent') return 'Inspection for ' + b.code + ' (' + c.plate + ', ' + cu.name + ', ' + when(b.start) + '). Take the photos here: ' + Links.agent(b);
  return hi + 'before you drive off, please take a few photos of the car here. It protects you and us: ' + Links.customer(b) + ' Thank you, ' + co;
}
function bkShareTo(b, kind) {
  if (kind !== 'agent') return cust(b.cust).phone;
  var p = staff((b.assigned || [])[0]); return p ? (p.wa || p.phone || '') : '';
}
function bkShare(id, kind, how) {
  var b = bk(id), text = bkShareText(b, kind), url = { form: Links.form, pdf: Links.pdf, agent: Links.agent, customer: Links.customer }[kind](b);
  if (kind === 'form') { bkFormSent(b, how); if (how === 'wa') Share.wa(bkShareTo(b, kind), text); else if (how === 'share') Share.native({ title: b.code, text: text.replace(url, '').trim(), url: url }); else Share.copy(url, 'Link copied'); return; }
  if (how === 'wa') { Share.wa(bkShareTo(b, kind), text); bLog(b, { form: 'Customer form', pdf: 'Agreement PDF', agent: 'Agent inspection link', customer: 'Customer inspection link' }[kind] + ' sent on WhatsApp'); save(); say('WhatsApp opened with the message'); return; }
  if (how === 'share') { Share.native({ title: b.code, text: text.replace(url, '').trim(), url: url }); return; }
  Share.copy(url, 'Link copied');
}
/* the form really left the phone: only now does the booking move to Agreement Sent */
function bkFormSent(b, how) {
  markFormSent(b, { wa: 'on WhatsApp', share: 'by share', copy: '(link copied)' }[how] || '');
  if (route().name === 'booking' || route().name === 'bookings') render(false, true);
}
/* opens the send sheet; the status changes only when the form is sent, shared or its link copied */
function bkSendAgreement(id) { bkShareSheet(id, 'form'); }
function bkShareSheet(id, kind) {
  var b = bk(id), cu = cust(b.cust);
  sheet(sheetHead(kind === 'form' ? 'Send the booking form' : 'Send', cu.name + ' · ' + cu.phone) +
    '<label class="field"><span>Message</span><textarea class="inp bk-msg" id="bkmsg">' + esc(bkShareText(b, kind)) + '</textarea></label>' +
    '<div class="sheet-foot stack"><button class="btn" id="bkwa">' + I('wa') + 'Send on WhatsApp</button><div class="btnrow"><button class="btn ghost" id="bksh">' + I('share') + 'Share</button><button class="btn ghost" id="bkcp">' + I('copy') + 'Copy link</button></div></div>', function (sh) {
      var sent = function (how) { if (kind === 'form') bkFormSent(b, how); };
      $('#bkwa', sh).onclick = function () { var t = $('#bkmsg').value; Share.wa(cu.phone, t); closeSheet(); if (kind === 'form') sent('wa'); else { bLog(b, 'Message sent on WhatsApp'); save(); } say('WhatsApp opened with the message'); };
      $('#bksh', sh).onclick = function () { var t = $('#bkmsg').value; Share.native({ title: b.code, text: t }); sent('share'); };
      $('#bkcp', sh).onclick = function () { Share.copy(Links.form(b), 'Link copied'); sent('copy'); };
    });
}
function bkMarkSigned(id) {
  confirm({ icon: 'info', title: 'Mark the form as signed?', text: 'Do this only when the customer signed on paper or told you they signed. Normally the form marks itself when they sign.', ok: 'Yes, mark signed', cancel: 'Go back' }).then(function (yes) {
    if (!yes) return; var b = bk(id), prev = b.bookingStatus;
    b.submitted = true; b.submittedAt = b.submittedAt || new Date().toISOString();
    var ch = applyStatusRules(b, prev);
    bLog(b, 'Form marked as signed by ' + myName() + (ch.length ? ' (' + ch.join(', ') + ')' : ''), { bookingStatus: [prev, b.bookingStatus] }); save();
    notify('change', b.code + ' is signed', '', '#booking/' + id, { self: true }); render(false, true);
  });
}
function completeBk(id) {
  var b = bk(id), m = calcBooking(b), open = [];
  if (m.due > 0.99) open.push(rm(m.due) + ' still due');
  if (b.paymentStatus === 'Refund Pending') open.push(m.depositReceived > 0 ? 'deposit of ' + rm(m.depositReceived) + ' not returned' : 'deposit not closed');
  var go = function () {
    var prev = b.bookingStatus, prevPay = b.paymentStatus || null;
    setBookingStatus(b, 'Completed', { text: 'Booking completed' + (open.length ? ' with ' + open.join(', ') : '') });
    render(false, true);
    undoSnack(b.code + ' completed', function () { b.bookingStatus = prev; b.paymentStatus = prevPay; bLog(b, 'Complete undone, back to ' + prev, { bookingStatus: ['Completed', prev] }); save(); render(false, true); say('Booking is back to ' + prev); });
  };
  if (!open.length) { go(); return; }
  var t = open.join(', '); t = t.charAt(0).toUpperCase() + t.slice(1);
  confirm({ icon: 'warn', title: 'Complete ' + b.code + '?', text: t + '. Complete anyway?', ok: 'Complete anyway', cancel: 'Go back', primary: 'cancel' }).then(function (y) { if (y) go(); });
}

function bkThumb(src, label) { return src ? '<button type="button" class="thumb bk-thumb" onclick="bkZoom(this)" data-label="' + esc(label) + '"><img src="' + esc(imgSrc(src)) + '" alt="' + esc(label) + '"><span>' + esc(label) + '</span></button>' : ''; }
function bkZoom(el) {
  var src = $('img', el).getAttribute('src'), label = el.dataset.label || 'Photo';
  sheet(sheetHead(label) + '<div class="bk-zoom"><img src="' + esc(src) + '" alt="' + esc(label) + '"></div>', { stack: true, full: true });
}
function bkCustCard(b, cu) {
  var docs = Object.assign({}, b.docs || {}), cd = cu.docs || {};
  ['icFront', 'icBack', 'passport', 'licence', 'poa'].forEach(function (k) { if (!docs[k] && cd[k]) docs[k] = cd[k]; });
  var exp = cu.licenceExp, expired = exp && exp < toLocalInput(new Date()), endsBefore = exp && !expired && exp < toLocalInput(b.end);
  var thumbs = can('customers.view_documents') ? [bkThumb(docs.icFront, 'IC front'), bkThumb(docs.icBack, 'IC back'), bkThumb(docs.passport, 'Passport'), bkThumb(docs.licence, 'Licence'), bkThumb(docs.poa, 'Proof of address')].join('') : '';
  var tel = String(cu.phone || '').replace(/[^\d+]/g, '');
  return '<div class="card bk-cust"><div class="bk-cust-top"><span class="av" style="background:' + avColor(cu.name) + '">' + initials(cu.name) + '</span><div class="grow"><div class="b">' + esc(cu.name) + ' ' + custFlags(cu).map(flagChip).join('') + '</div><div class="small muted nowrap">' + esc(cu.phone || 'No phone') + '</div></div>' +
    (tel ? '<a class="iconbtn round" href="tel:' + esc(tel) + '" aria-label="Call">' + I('phone') + '</a><button class="iconbtn round" onclick="Share.wa(\'' + esc(cu.phone) + '\', \'\')" aria-label="WhatsApp">' + I('wa') + '</button>' : '') + '</div>' +
    '<div class="bk-facts"><div><small>IC / passport</small><b>' + esc(cu.ic ? maskIC(cu.ic) : cu.passport || 'Not given') + '</b></div>' +
    '<div><small>Licence expiry</small><b class="' + (expired ? 'tone-red-text' : endsBefore ? 'tone-amber-text' : '') + '">' + (exp ? esc(dFull(exp + 'T00:00:00')) + (expired ? ' (expired)' : endsBefore ? ' (before return)' : '') : 'Not given') + '</b></div></div>' +
    (thumbs ? '<div class="thumbs bk-thumbs">' + thumbs + '</div>' : can('customers.view_documents') ? '<div class="small muted bk-nodocs">No IC or licence photos yet</div>' : '') +
    (byId(S.customers, cu.id) ? '<button class="btn ghost sm bk-open" onclick="Cust.open(\'' + cu.id + '\')">' + I('user') + 'Open customer</button>' : '') + '</div>';
}
function bkDepositChip(b) {
  var ps = b.paymentStatus;
  if (ps === 'Refund Pending') return '<div class="bk-dep wait">' + I('bank') + '<div class="grow"><b>Deposit: waiting to be returned</b><small>' + rm(Math.max(0, calcBooking(b).depositReceived)) + ' held' + (b.refundPendingAt ? ' since ' + dShort(b.refundPendingAt) : '') + '</small></div><button class="btn sm" onclick="Deposit.open(\'' + b.id + '\')">Return the deposit</button></div>';
  if (ps === 'Deposit Refunded') return '<div class="bk-dep done">' + I('check', 2.2) + '<div class="grow"><b>Deposit: returned to the customer</b></div><button class="btn sm ghost" onclick="Deposit.open(\'' + b.id + '\')">See details</button></div>';
  return '';
}
function bkInspection(b) {
  var ins = b.inspection || {}, ag = ins.agent, cu = ins.customer;
  var agent = ag ? '<div class="bk-insp"><div class="bk-insp-h">' + chip('Done', 'green') + '<b>Agent check</b><span class="muted small">' + esc(when(ag.at)) + (ag.by ? ' · ' + esc(who(ag.by)) : '') + '</span></div>' +
      '<div class="small muted">' + (ag.km ? (+ag.km).toLocaleString('en-US') + ' km' : 'No km') + (ag.fuel ? ' · Fuel ' + esc(ag.fuel) : '') + ' · ' + ((ag.photos && ag.photos.handover) || []).length + ' photos</div>' +
      '<div class="thumbs">' + ((ag.photos && ag.photos.handover) || []).map(function (s, i) { return bkThumb(s, ['Front', 'Back', 'Left', 'Right'][i] || 'Photo ' + (i + 1)); }).join('') + (ag.photos && ag.photos.odometer ? bkThumb(ag.photos.odometer, 'Odometer') : '') + '</div></div>' :
    '<div class="bk-insp"><div class="bk-insp-h">' + chip('Not done', 'grey') + '<b>Agent check</b></div><div class="small muted">4 photos, km and fuel at handover</div></div>';
  var custH = cu ? '<div class="bk-insp"><div class="bk-insp-h">' + chip('Done', 'green') + '<b>Customer check</b><span class="muted small">' + esc(when(cu.at)) + '</span></div><div class="small muted">' + (cu.photos || []).length + ' photo' + ((cu.photos || []).length === 1 ? '' : 's') + '</div>' +
      '<div class="thumbs">' + (cu.photos || []).map(function (s, i) { return bkThumb(s, 'Customer ' + (i + 1)); }).join('') + '</div></div>' :
    '<div class="bk-insp"><div class="bk-insp-h">' + chip('Not done', 'grey') + '<b>Customer check</b></div><div class="small muted">Send the customer inspection link above</div></div>';
  var rt = ins.ret, retH = '';
  if (rt) {
    var dp = rt.damagePhotos || [];
    retH = '<div class="bk-insp"><div class="bk-insp-h">' + chip('Done', 'green') + '<b>Return check</b><span class="muted small">' + esc(when(rt.at)) + (rt.by ? ' · ' + esc(who(rt.by)) : '') + '</span></div>' +
      '<div class="small muted">' + (rt.km ? (+rt.km).toLocaleString('en-US') + ' km' : 'No km') + (rt.trusted === false ? ' (not trusted)' : '') + (ag && ag.km && rt.km > ag.km ? ' · ' + (rt.km - ag.km).toLocaleString('en-US') + ' km driven' : '') + (rt.fuel ? ' · Fuel ' + esc(rt.fuel) : '') + '</div>' +
      '<div class="small">' + (rt.lateHours ? chip(rt.lateHours + ' hour' + (rt.lateHours === 1 ? '' : 's') + ' late', 'red') + ' ' : '') + (rt.damage ? chip('New damage', 'amber') : chip('No new damage', 'green')) + '</div>' +
      (rt.damage && rt.damageNote ? '<div class="small bk-dmgnote">' + esc(rt.damageNote) + '</div>' : '') +
      (dp.length || rt.odometer ? '<div class="thumbs">' + dp.map(function (s, i) { return bkThumb(s, 'Damage ' + (i + 1)); }).join('') + (rt.odometer ? bkThumb(rt.odometer, 'Odometer at return') : '') + '</div>' : '') + '</div>';
  }
  return '<div class="card bk-insps">' + agent + retH + custH + '</div>';
}
function bkStaff(b) {
  var ppl = (b.assigned || []).map(staff).filter(Boolean);
  return '<div class="card bk-staff">' + (ppl.length ? ppl.map(function (p) { return '<span class="bk-person"><span class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</span>' + esc(p.name) + '</span>'; }).join('') : '<span class="muted small">Nobody assigned yet</span>') +
    (can('tasks.create') && b.bookingStatus !== 'Cancelled' ? '<button class="btn sm ghost" onclick="Tasks.newFor(\'' + b.id + '\')">' + I('task') + 'Assign task</button>' : '') + '</div>';
}

VIEWS.booking = function (r) {
  var b = bk(r.a); if (!b) return { html: topbar('Booking', { back: '#bookings' }) + '<main><div class="empty">This booking is not here any more.</div></main>' };
  var c = car(b.car) || {}, cu = cust(b.cust), p = calcBooking(b), st = b.bookingStatus, seeAmt = can('bookings.see_amounts');
  var step = bkNextStep(b), canEdit = can('bookings.edit') && st !== 'Cancelled' && st !== 'Completed';
  var dueTag = !seeAmt || st === 'Cancelled' ? '' : p.overpaid ? '<span class="small b bal extra">' + rm(p.overpaid) + ' overpaid, to refund</span>' : p.due > 0 ? '<span class="small b bal due">' + rm(p.due) + ' to collect</span>' : '<span class="small b bal paid">Paid in full</span>';
  var pays = activePays(b).concat((b.payments || []).filter(function (x) { return x.voided; }));
  var payBtn = st === 'Cancelled' ? (p.received + p.extra > 0 && can('deposits.refund') ? '<button class="btn sm" onclick="Deposit.open(\'' + b.id + '\')">' + I('cash') + 'Refund money paid</button>' : '') :
    can('billing.record_payment') ? '<button class="btn sm" onclick="Pay.open(\'' + b.id + '\')">' + I('cash') + 'Record payment</button>' : '';
  var moneyBtns = seeAmt ? '<div class="bk-mbtns">' + payBtn + (st !== 'Cancelled' && can('billing.record_payment') ? '<button class="btn sm ghost" onclick="Pay.slip(\'' + b.id + '\')">' + I('camera') + 'Upload slip</button>' : '') +
    '<button class="btn sm ghost" onclick="Docs.open(\'' + b.id + '\')">' + I('receipt') + 'Invoice and receipts</button></div>' : '';
  var tel = String(cu.phone || '').replace(/[^\d+]/g, '');
  var html = topbar(b.code, { back: '#bookings', sub: 'Made ' + ago(b.created) + (b.source && b.source !== 'Staff' ? ' on ' + b.source : ' by ' + who(b.createdBy)) }) + '<main class="bkd">' +
    bkCustBanner(b, cu) + bkCarBanner(b, c) +
    '<div class="hero"><div class="bk-hchips">' + statusChip(b) + payChip(b) + '<span class="chip tone-grey">' + esc(p.duration) + '</span></div>' +
    '<div class="carpic">' + carSVG(c.color, c.shape) + '</div>' +
    '<h3>' + esc(cu.name) + '</h3><div class="muted small">' + esc((c.make || '') + ' ' + (c.model || '')) + ' · <b style="color:var(--text)">' + esc(c.plate || '') + '</b>' + (b.cover ? ' · ' + esc(b.cover.name) : '') + '</div>' +
    '<div class="kv"><div><div class="k">Pick-up</div><div class="v">' + bkWhenNw(b.start) + '<small>' + esc(placeText(b, 'pick')) + '</small></div></div><div><div class="k">Return</div><div class="v">' + bkWhenNw(b.end) + '<small>' + esc(placeText(b, 'ret')) + '</small></div></div></div>' +
    (st === 'Cancelled' && b.cancelReason ? '<div class="small muted bk-why">Cancelled: ' + esc(b.cancelReason) + '</div>' : '') + '</div>' +
    (step ? '<div class="bk-next"><button class="btn big" onclick="' + step.on + '">' + I(step.icon, 2.2) + esc(step.label) + '</button><div class="small muted">' + esc(step.hint) + '</div></div>' : '') +
    '<div class="bk-links">' + (can('bookings.change_status') ? '<button class="btn link" onclick="bkStatusSheet(\'' + b.id + '\')">Change status</button>' : '') +
    (st === 'Agreement Sent' ? '<button class="btn link" onclick="bkShareSheet(\'' + b.id + '\',\'form\')">Send the form again</button>' : '') + '</div>' +
    '<div class="actions">' + (tel ? '<a class="act" href="tel:' + esc(tel) + '">' + I('phone') + 'Call</a>' : '<button class="act" disabled>' + I('phone') + 'Call</button>') +
    '<button class="act" onclick="Share.wa(\'' + esc(cu.phone) + '\', \'\')">' + I('wa') + 'WhatsApp</button>' +
    (canEdit ? '<button class="act" onclick="editBk(\'' + b.id + '\')">' + I('edit') + (st === 'Car Returned' ? 'Note' : 'Change') + '</button>' : '<button class="act" onclick="document.getElementById(\'bkdocs\').scrollIntoView({behavior:\'smooth\'})">' + I('file') + 'Papers</button>') +
    '<button class="act" onclick="Docs.open(\'' + b.id + '\')">' + I('receipt') + 'Invoice</button></div>' +
    '<div class="sec"><h2>Money</h2>' + dueTag + '</div>' + bkMoneyCard(b, p) + moneyBtns + bkDepositChip(b) +
    (pays.length && seeAmt ? '<div class="sec"><h2>Payments</h2><span class="small muted">Tap one to see or void it</span></div><div class="list">' + pays.map(function (x) {
      return '<button class="card2' + (x.voided ? ' muted' : '') + '" onclick="Pay.open(\'' + b.id + '\',{voidId:\'' + x.id + '\'})"><div class="c2-main"><div class="c2-t1">' + esc((x.items || []).map(function (i) { return i.kind; }).join(', ')) + (x.voided ? ' · voided' : '') + '</div><div class="c2-t2">' + dShort(x.at) + ', ' + hm(x.at) + ' · ' + esc(methodText(x.method)) + (x.cashTo ? ' to ' + esc(firstName(who(x.cashTo))) : '') + '</div></div><div class="c2-end money"' + (x.voided ? ' style="text-decoration:line-through"' : '') + '>' + rm(payTotal(x)) + '</div></button>';
    }).join('') + '</div>' : '') +
    '<div class="sec"><h2>Customer</h2></div>' + bkCustCard(b, cu) +
    '<div class="sec" id="bkdocs"><h2>Documents</h2><span class="small ' + (b.submitted ? 'tone-green-text' : 'muted') + '">' + (b.submitted ? 'Form signed on ' + dShort(b.submittedAt || b.created) : 'Form not signed yet') + '</span></div><div class="list">' +
    bkDocRow(b, 'form', cu) + bkDocRow(b, 'pdf', cu) + bkDocRow(b, 'agent', cu) + bkDocRow(b, 'customer', cu) + '</div>' +
    '<div class="sec"><h2>Inspection</h2></div>' + bkInspection(b) +
    (window.Summons && Summons.forBooking ? Summons.forBooking(b.id) || '' : '') +
    '<div class="sec"><h2>Staff</h2></div>' + bkStaff(b) +
    (b.note ? '<div class="sec"><h2>Note</h2></div><div class="card bk-note">' + esc(b.note) + '</div>' : '') +
    '<div class="sec"><h2>History</h2></div><div class="list"><div class="log">' + ((b.log || []).length ? (b.log || []).slice().reverse().map(function (l) { return '<div>' + esc(l.text) + '<time>' + esc(who(l.by) || 'System') + ' · ' + esc(when(l.at)) + '</time></div>'; }).join('') : '<div>Nothing yet</div>') + '</div></div>' +
    '<div class="bk-danger">' + (UPCOMING.indexOf(st) >= 0 && can('bookings.edit') ? '<button class="btn danger" onclick="cancelBk(\'' + b.id + '\')">Cancel booking</button>' : '') +
    (can('bookings.delete') ? '<button class="btn link red" onclick="deleteBk(\'' + b.id + '\')">' + I('trash') + 'Delete booking</button>' : '') + '</div>' +
    '</main>';
  return { html: html };
};

/* ---------------- change status: two radio sheets ---------------- */
function bkStatusSheet(id) {
  var b = bk(id);
  sheet(sheetHead('Change status', b.code + ' · ' + cust(b.cust).name) +
    '<div class="list"><button class="row" onclick="bkStatusPick(\'' + id + '\',\'booking\')"><div class="grow"><div class="t2">Booking status</div><div class="t1">' + esc(b.bookingStatus) + '</div></div>' + statusChip(b) + '</button>' +
    '<button class="row" onclick="bkStatusPick(\'' + id + '\',\'payment\')"><div class="grow"><div class="t2">Payment status</div><div class="t1">' + esc(b.paymentStatus || 'None') + '</div></div>' + (payChip(b) || chip('None', 'grey')) + '</button></div>' +
    '<p class="hint" style="margin-top:10px">Most changes happen by themselves: signing the form, recording payments, handing over and taking back the car.</p>');
}
function bkStatusPick(id, axis) {
  var b = bk(id), isB = axis === 'booking', cur = isB ? b.bookingStatus : (b.paymentStatus || 'None');
  var list = isB ? BK_STATUSES : ['None'].concat(PAY_STATUSES), lockRef = !canPickRefunded(b);
  sheet(sheetHead(isB ? 'Update booking status' : 'Update payment status', b.code + ' · now ' + cur) +
    '<div class="list bk-radios">' + list.map(function (s) {
      var off = !isB && s === 'Deposit Refunded' && lockRef;
      var tone = isB ? BK_TONE[s] : PAY_TONE[s] || 'grey';
      return '<label class="bk-radio' + (off ? ' off' : '') + '"><input type="radio" name="bkst" value="' + esc(s) + '"' + (s === cur ? ' checked' : '') + (off ? ' disabled' : '') + '><span class="dot tone-' + tone + '"></span><span class="grow"><span class="t1">' + esc(s) + '</span>' +
        (off ? '<span class="t2">Set by recording the refund on Deposits</span>' : s === 'Cancelled' ? '<span class="t2">Asks for a reason first</span>' : '') + '</span></label>';
    }).join('') + '</div>' +
    '<div class="sheet-foot"><button class="btn" id="bkstsave">Save</button></div>', function (sh) {
      $('#bkstsave', sh).onclick = function () {
        var v = ($('input[name=bkst]:checked', sh) || {}).value;
        if (!v || v === cur) { closeSheet(); return; }
        if (isB && v === 'Cancelled') { closeSheet(true); setTimeout(function () { cancelBk(id); }, 30); return; }
        if (isB && (cur === 'Cancelled' || cur === 'Completed') && v !== 'Cancelled' && v !== 'Completed') { var cl = bkClash(b); if (cl) { closeSheet(true); setTimeout(function () { bkClashSheet(b, cl); }, 30); return; } }
        if (isB && cur === 'Cancelled' && v !== 'Completed') { delete b.cancelMoney; if (b.paymentStatus === 'Refund Pending' && !(window.Deposit && Deposit.refundOf(b.id))) { b.paymentStatus = calcBooking(b).depositReceived > 0 ? 'Deposit Received' : 'Deposit Due'; delete b.refundPendingAt; } }
        if (isB) { var ch = setBookingStatus(b, v); notify('change', b.code + ': ' + b.bookingStatus, ch.length ? ch.join(', ') : '', '#booking/' + id, { self: true }); }
        else { if (v === 'Deposit Refunded' && lockRef) { say('Record the refund on Deposits'); return; } setPaymentStatus(b, v === 'None' ? null : v, 'changed by hand'); say('Payment status: ' + v); }
        closeSheet(); render(false, true);
      };
    });
}

/* ---------------- change booking ---------------- */
function placeSelect(id, end, kind, locId) {
  var cur = kind === 'our' ? 'our:' + locId : kind === 'place' ? 'place:' + locId : 'client';
  return '<select class="inp" id="' + id + '">' + placeChoices(end).map(function (o) { return '<option value="' + o.v + '"' + (o.v === cur ? ' selected' : '') + '>' + esc(o.label) + (o.fee ? ' (+' + rm(o.fee) + ')' : '') + '</option>'; }).join('') + '</select>';
}
function parsePlace(v) { if (v === 'client') return { kind: 'client', id: null }; var p = String(v).split(':'); return { kind: p[0], id: p[1] }; }
function editBk(id) {
  var b = bk(id), st = b.bookingStatus;
  if (st === 'Completed' || st === 'Cancelled') { say('A ' + st.toLowerCase() + ' booking cannot be changed'); return; }
  if (st === 'Car Returned') return bkEditNote(id);
  var canAmt = can('bookings.edit_amounts'), seeAmt = can('bookings.see_amounts'), d = { car: b.car, rates: Object.assign({}, b.rates), cover: b.cover ? Object.assign({}, b.cover) : null };
  var carLine = function () { var c = car(d.car); return '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model) + ' · <span class="money">' + rm(c.rate) + '</span> / day</span></span><span class="btn sm ghost">Change</span>'; };
  var amt = function (k, label) { return '<label class="field"><span>' + label + '</span><div class="rmfield"><input class="inp num" inputmode="decimal" data-rate="' + k + '" value="' + money2(d.rates[k]) + '"></div></label>'; };
  var pk = (B().packages || []);
  /* a custom cover (or a package that is no longer offered) stays as it is unless staff pick something else */
  var ownCover = !!(b.cover && (!b.cover.packageId || !pkg(b.cover.packageId)));
  var started = st === 'Car Delivered';
  sheet(sheetHead('Change booking', b.code + '. Changes are saved in the history.') +
    '<div class="bk-ext"><span class="small muted">Quick</span><button type="button" class="fchip" data-ext="1">Extend 1 day</button><button type="button" class="fchip" data-ext="2">Extend 2 days</button></div>' +
    '<div class="two"><label class="field"><span>Pick-up date</span><input class="inp" type="date" id="es_d" value="' + toLocalInput(b.start) + '"' + (started ? ' disabled' : '') + '></label><label class="field"><span>Time</span><input class="inp" type="time" step="900" id="es_t" value="' + toTimeInput(b.start) + '"' + (started ? ' disabled' : '') + '></label></div>' +
    '<div class="two"><label class="field"><span>Return date</span><input class="inp" type="date" id="ee_d" value="' + toLocalInput(b.end) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" step="900" id="ee_t" value="' + toTimeInput(b.end) + '"></label></div>' +
    '<div id="e_bz"></div>' +
    '<div class="field"><span>Car</span><button type="button" class="carfield picked-car" id="e_car"' + (started ? ' disabled' : '') + '>' + carLine() + '</button>' + (started ? '<span class="hint">The car is out. Swap the car after it comes back.</span>' : '') + '</div>' +
    '<label class="field"><span>Pick-up</span>' + placeSelect('e_pp', 'pick', b.pickKind, b.pickLoc) + '</label>' +
    '<label class="field" id="e_ppn_w"' + (b.pickKind === 'client' ? '' : ' hidden') + '><span>Delivery address</span><input class="inp" id="e_ppn" value="' + esc(b.pickNote) + '" placeholder="Address or landmark"></label>' +
    '<label class="field"><span>Return</span>' + placeSelect('e_rp', 'ret', b.retKind, b.retLoc) + '</label>' +
    '<label class="field" id="e_rpn_w"' + (b.retKind === 'client' ? '' : ' hidden') + '><span>Collection address</span><input class="inp" id="e_rpn" value="' + esc(b.retNote) + '" placeholder="Address or landmark"></label>' +
    '<label class="field"><span>Damage cover</span><select class="inp" id="e_cov"><option value="">No cover</option>' + (ownCover ? '<option value="custom" selected>' + esc(b.cover.name || 'Custom cover') + ' (' + rm(b.cover.daily) + ' a day)</option>' : '') + pk.map(function (x) { return '<option value="' + x.id + '"' + (!ownCover && d.cover && d.cover.packageId === x.id ? ' selected' : '') + '>' + esc(x.name) + ' (' + rm(x.daily) + ' a day)</option>'; }).join('') + '</select></label>' +
    (canAmt ? '<div class="bk-amts"><div class="two even">' + amt('daily', 'Daily rate') + amt('hourly', 'Hourly rate') + '</div><div class="two even">' + amt('deposit', 'Deposit') + amt('discount', 'Discount') + '</div><div class="two even">' + amt('delivery', 'Delivery') + amt('return', 'Return') + '</div>' + amt('others', 'Others') + '</div>' :
      seeAmt ? '<div class="card bk-locked">' + I('lock') + '<div class="grow small">Rates: <b class="money">' + rm(d.rates.daily) + '</b> a day, <b class="money">' + rm(d.rates.hourly) + '</b> an hour, deposit <b class="money">' + rm(d.rates.deposit) + '</b>' + (d.rates.discount ? ', discount <b class="money">' + rm(d.rates.discount) + '</b>' : '') + '<br><span class="muted">Ask the owner to change amounts</span></div></div>' : '') +
    '<label class="field"><span>Note for staff</span><textarea class="inp" id="e_note">' + esc(b.note) + '</textarea></label>' +
    '<div class="sheet-foot"><div id="e_prev" class="bk-prev"></div><button class="btn" id="e_save">Save changes</button></div>', function (sh) {
      var get = function () {
        var s = started ? new Date(b.start) : fromInputs($('#es_d').value, $('#es_t').value), e = fromInputs($('#ee_d').value, $('#ee_t').value);
        var pp = parsePlace($('#e_pp').value), rp = parsePlace($('#e_rp').value), cv = $('#e_cov').value, cov = pkg(cv);
        return { s: s, e: e, pp: pp, rp: rp, cover: cv === 'custom' ? b.cover : cov ? { packageId: cov.id, name: cov.name, daily: cov.daily, max: cov.max } : null };
      };
      var preview = function () {
        var v = get(), t = Object.assign({}, b, { start: v.s.toISOString(), end: v.e.toISOString(), rates: d.rates, cover: v.cover });
        var bad = !(v.e > v.s), bz = bad ? null : busy(d.car, v.s, v.e, b.id);
        $('#e_bz').innerHTML = bad ? '<div class="banner red">' + I('warn') + '<div>Return must be after pick-up</div></div>' : !bz.free ? '<div class="banner red">' + I('warn') + '<div><b>' + esc(car(d.car).plate) + ' is not free:</b> ' + esc(bz.reason) + '. ' + (bz.booking && started ? 'The car is out, so move ' + esc(bz.booking.code) + ' to another car first.' : 'Pick other dates or another car.') +
          (bz.booking && can('bookings.edit') ? '<button type="button" class="btn sm ghost bk-openclash" data-open="' + bz.booking.id + '">Open ' + esc(bz.booking.code) + ' to give it another car</button>' : '') + '</div></div>' : bz.soon ? '<div class="banner amber">' + I('clock') + '<div>Check the turnaround: ' + esc(bz.soon) + '.</div></div>' : '';
        var was = calcBooking(b).payable, now = calcBooking(t).payable, diff = now - was;
        $('#e_prev').innerHTML = bad ? '' : seeAmt ? 'New total <b class="money">' + rm(now) + '</b> <span class="muted">(was ' + rm(was) + (Math.abs(diff) >= 0.01 ? ', ' + (diff > 0 ? '+' : '') + rm(diff) : ', no change') + ')</span> · ' + esc(durationText(v.s, v.e)) : esc(durationText(v.s, v.e));
        $('#e_save').disabled = bad || !bz.free;
        var oc = $('.bk-openclash', sh); if (oc) oc.onclick = function () { var to = oc.dataset.open; closeAllSheets(); location.hash = '#booking/' + to; setTimeout(function () { if (route().a === to) editBk(to); }, 120); };
      };
      $('#es_t', sh).addEventListener('change', function () { if ($('#ee_d').value) $('#ee_t').value = $('#es_t').value; preview(); });
      $('#ee_d', sh).addEventListener('change', function () { if (!started) $('#ee_t').value = $('#es_t').value; preview(); });
      ['#es_d', '#ee_t', '#e_cov'].forEach(function (s) { $(s, sh).addEventListener('change', preview); });
      $('#e_pp', sh).addEventListener('change', function () { var v = parsePlace(this.value); $('#e_ppn_w').hidden = v.kind !== 'client'; d.rates.delivery = placeFee(v.kind, v.id, 'pick'); var i = $('[data-rate=delivery]', sh); if (i) i.value = money2(d.rates.delivery); preview(); });
      $('#e_rp', sh).addEventListener('change', function () { var v = parsePlace(this.value); $('#e_rpn_w').hidden = v.kind !== 'client'; d.rates['return'] = placeFee(v.kind, v.id, 'ret'); var i = $('[data-rate=return]', sh); if (i) i.value = money2(d.rates['return']); preview(); });
      $$('[data-rate]', sh).forEach(function (i) { i.addEventListener('input', function () { var v = parseMoney(i.value); i.classList.toggle('bad', i.value !== '' && isNaN(v)); d.rates[i.dataset.rate] = isNaN(v) ? 0 : v; preview(); }); });
      $$('[data-ext]', sh).forEach(function (btn) { btn.onclick = function () { var e = new Date(fromInputs($('#ee_d').value, $('#ee_t').value).getTime() + (+btn.dataset.ext) * DAY); $('#ee_d').value = toLocalInput(e); $('#ee_t').value = toTimeInput(e); preview(); var bz = busy(d.car, get().s, e, b.id); say(bz.free ? 'Return moved to ' + bkWhen(e) : 'Not free: ' + bz.reason); }; });
      $('#e_car', sh).onclick = function () {
        var v = get(); if (!(v.e > v.s)) { say('Fix the dates first'); return; }
        Pickers.car({ start: v.s, end: v.e, exceptId: b.id, selected: d.car, title: 'Swap the car', onPick: function (c) {
          if (c.id !== d.car) { d.car = c.id; d.rates.daily = c.rate; d.rates.hourly = c.hourly; if (c.deposit != null) d.rates.deposit = c.deposit; $$('[data-rate]', sh).forEach(function (i) { i.value = money2(d.rates[i.dataset.rate]); }); say('Rates follow the new car'); }
          $('#e_car').innerHTML = carLine(); preview();
        } });
      };
      $('#e_save', sh).onclick = function () { bkSaveEdit(id, get(), d); };
      preview();
    });
}
function bkSaveEdit(id, v, d) {
  var b = bk(id), ch = [], changes = {};
  if (!(v.e > v.s)) { say('Return must be after pick-up'); return; }
  var bz = busy(d.car, v.s, v.e, b.id); if (!bz.free) { say(car(d.car).plate + ': ' + bz.reason); return; }
  if ($$('.bk-amts .inp.bad').length) { say('Fix the amounts in red, for example 150.00'); return; }
  var before = calcBooking(b).payable;
  var set = function (k, val, text) { var old = b[k]; if (JSON.stringify(old) === JSON.stringify(val)) return; changes[k] = [old, val]; b[k] = val; if (text) ch.push(text); };
  if (v.s.getTime() !== new Date(b.start).getTime() || v.e.getTime() !== new Date(b.end).getTime()) ch.push('dates to ' + dShort(v.s) + ' ' + hm(v.s) + ' to ' + dShort(v.e) + ' ' + hm(v.e));
  set('start', v.s.toISOString()); set('end', v.e.toISOString());
  if (d.car !== b.car) set('car', d.car, 'car to ' + car(d.car).plate);
  var pn = v.pp.kind === 'client' ? $('#e_ppn').value.trim() : '', rn = v.rp.kind === 'client' ? $('#e_rpn').value.trim() : '';
  if (v.pp.kind !== b.pickKind || v.pp.id !== (b.pickLoc || null) && v.pp.kind !== 'client' || pn !== (b.pickNote || '')) { set('pickKind', v.pp.kind); set('pickLoc', v.pp.id); set('pickNote', pn); ch.push('pick-up to ' + placeText(b, 'pick')); }
  if (v.rp.kind !== b.retKind || v.rp.id !== (b.retLoc || null) && v.rp.kind !== 'client' || rn !== (b.retNote || '')) { set('retKind', v.rp.kind); set('retLoc', v.rp.id); set('retNote', rn); ch.push('return to ' + placeText(b, 'ret')); }
  if (JSON.stringify(v.cover || null) !== JSON.stringify(b.cover || null)) set('cover', v.cover, v.cover ? 'cover to ' + v.cover.name : 'cover removed');
  var r0 = b.rates || {}, rch = Object.keys(d.rates).filter(function (k) { return +(r0[k] || 0) !== +(d.rates[k] || 0); });
  if (rch.length) { set('rates', Object.assign({}, d.rates)); var RL = { daily: 'daily rate', hourly: 'hourly rate', deposit: 'deposit', discount: 'discount', delivery: 'delivery', 'return': 'return charge', others: 'others' };
    ch.push(rch.map(function (k) { return (RL[k] || k) + ' ' + rm(r0[k]) + ' to ' + rm(d.rates[k]); }).join(', ')); }
  var note = $('#e_note').value.trim(); if (note !== (b.note || '')) set('note', note, 'note');
  closeSheet();
  if (!ch.length) { say('Nothing changed'); return; }
  var after = calcBooking(b).payable;
  bLog(b, 'Changed ' + ch.join('; ') + (Math.abs(after - before) >= 0.01 ? ' (total ' + rm(before) + ' to ' + rm(after) + ')' : ''), changes); save();
  /* a paid booking that now costs more has money due again */
  if (after > before + 0.99 && calcBooking(b).due > 0.99 && (b.paymentStatus === 'Full Payment Received' || b.paymentStatus === 'Extension Paid')) setPaymentStatus(b, 'Extension Due', 'the total went up by ' + rm(after - before));
  notify('change', b.code + ' changed', after > before + 0.99 ? rm(after - before) + ' more to collect' : '', '#booking/' + b.id, { self: true }); render(false, true);
}
function bkEditNote(id) {
  var b = bk(id);
  sheet(sheetHead('Note for staff', b.code + '. The car is back, so only the note can change.') +
    '<label class="field"><span>Note</span><textarea class="inp" id="e_note">' + esc(b.note) + '</textarea></label>' +
    '<div class="sheet-foot"><button class="btn" id="e_save">Save note</button></div>', function (sh) {
      $('#e_save', sh).onclick = function () { var n = $('#e_note').value.trim(); closeSheet(); if (n === (b.note || '')) { say('Nothing changed'); return; } var old = b.note; b.note = n; bLog(b, 'Changed note', { note: [old, n] }); save(); say('Note saved'); render(false, true); };
    });
}
function doEdit(id) { editBk(id); } /* old name */

/* ---------------- cancel and delete ---------------- */
function cancelBk(id) {
  var b = bk(id), p = calcBooking(b), paid = p.received + p.extra, dep = b.paymentStatus === 'Deposit Refunded' ? 0 : p.depositReceived;
  var reasons = ['Customer cancelled', 'No-show', 'Car problem', 'Other'];
  var hints = { refund: 'It goes on Deposits > To refund, so someone gives it back.', credit: 'It stays as credit for ' + firstName(cust(b.cust).name) + ' and can pay a later booking (Record payment > From deposit > Another booking).', fee: 'The money is kept. Nothing goes back to the customer.' };
  sheet(sheetHead('Cancel ' + b.code + '?', 'The car becomes free for these dates again. You can find it later under Cancelled.') +
    '<div class="field"><span>Why?</span><div class="seg" id="cxr">' + reasons.map(function (r, i) { return '<button type="button" class="' + (i === 0 ? 'on' : '') + '">' + r + '</button>'; }).join('') + '</div></div>' +
    '<label class="field"><span>Note (optional)</span><input class="inp" id="cxn" placeholder="For example: flight moved to next week"></label>' +
    (paid > 0 && can('bookings.see_amounts') ? '<div class="field"><span><b class="money">' + rm(paid) + '</b> paid. What happens to it?</span><div class="seg" id="cxm"><button type="button" class="on" data-m="refund">Refund</button><button type="button" data-m="credit">Keep as credit</button><button type="button" data-m="fee">Keep as cancellation fee</button></div><small class="hint" id="cxmh">' + esc(hints.refund) + '</small></div>' : '') +
    (dep > 0 ? '<div class="banner amber" id="cxdep">' + I('bank') + '<div><b class="money">' + rm(dep) + '</b> deposit is still held: return it on Deposits.</div></div>' : '') +
    '<div class="sheet-foot stack"><button class="btn danger solid" id="cxgo">Cancel booking</button><button class="btn link" onclick="closeSheet()">Keep it</button></div>', function (sh) {
      segPick('#cxr');
      if ($('#cxm', sh)) segPick('#cxm', function () { var m = ($('#cxm .on', sh) || {}).dataset || {}; $('#cxmh', sh).textContent = hints[m.m] || ''; var d = $('#cxdep', sh); if (d) d.style.display = m.m === 'refund' ? '' : 'none'; });
      $('#cxgo', sh).onclick = function () {
        var r = $('#cxr .on').textContent, n = $('#cxn').value.trim(), m = ($('#cxm .on') || {}).dataset;
        if (r === 'Other' && !n) { say('Write a short note for Other'); $('#cxn').focus(); return; }
        closeSheet(); doCancel(id, r + (n ? ': ' + n : ''), m ? m.m : null, paid);
      };
    });
}
/* money paid on a cancelled booking: refund (goes to Deposits > To refund as Refund Pending), credit (stays on the booking for the customer's next payment
   through 'From deposit > Another booking'), fee (kept: closed with nothing to return). Returns an undo function. */
function bkCancelMoney(b, money) {
  var before = { ps: b.paymentStatus, rp: b.refundPendingAt, dedN: (S.deductions || []).length, refN: (S.refunds || []).length };
  var undo = function () { b.paymentStatus = before.ps; b.refundPendingAt = before.rp; if (S.deductions) S.deductions.length = before.dedN; if (S.refunds) S.refunds.length = before.refN; };
  if (typeof Deposit === 'undefined' || b.paymentStatus === 'Deposit Refunded') return undo;
  var x = Deposit.info(b); if (x.refund || x.net <= 0.004) return undo;
  if (money === 'credit') { b.cancelMoney = 'credit'; return undo; }
  b.refundPendingAt = new Date().toISOString(); setPaymentStatus(b, 'Refund Pending', 'money paid on a cancelled booking');
  if (money === 'fee') {
    S.deductions = S.deductions || [];
    S.deductions.push({ id: uid(), booking: b.id, kind: 'Other', amt: x.net, note: 'Kept as cancellation fee', photo: null, by: S.me, at: new Date().toISOString(), paymentId: null });
    Deposit.closeKept(b, 'Kept as cancellation fee');
  }
  return undo;
}
function doCancel(id, reason, money, paid) {
  var b = bk(id), prev = b.bookingStatus, prevReason = b.cancelReason;
  b.cancelReason = reason || 'Customer cancelled';
  var mt = money === 'refund' ? ', money paid to be refunded' : money === 'credit' ? ', ' + rm(paid) + ' kept as credit' : money === 'fee' ? ', ' + rm(paid) + ' kept as cancellation fee' : '';
  setBookingStatus(b, 'Cancelled', { text: 'Booking cancelled (' + b.cancelReason + mt + ')' });
  if (money) b.cancelMoney = money;
  var undoMoney = bkCancelMoney(b, money);
  save(); render(false, true);
  undoSnack(b.code + ' cancelled', function () {
    if (SHEETS.length) closeAllSheets();
    var clash = bkClash(b); if (clash) { bkClashSheet(b, clash); return; }
    undoMoney(); b.cancelReason = prevReason; delete b.cancelMoney; setBookingStatus(b, prev, { text: 'Cancel undone' }); render(false, true); say('Booking is back');
  }, 6000);
  if (money === 'refund') later(function () { if (bk(id) && bk(id).bookingStatus === 'Cancelled' && b.paymentStatus === 'Refund Pending') Deposit.open(id); }, 400);
}
/* a cancelled or completed booking that goes back to an active status needs its car free again */
function bkClash(b) {
  var r = busy(b.car, new Date(b.start), new Date(b.end), b.id);
  return r.free ? null : r;
}
function bkClashSheet(b, r) {
  var c = car(b.car) || {}, other = r.booking;
  sheet(sheetHead('The car is not free', b.code + ' · ' + (c.plate || '')) +
    '<div class="banner red">' + I('warn') + '<div><b>' + esc(c.plate || 'This car') + ' is ' + (other ? 'booked by ' + esc(other.code) : esc(r.reason.toLowerCase())) + '</b> for ' + esc(dShort(b.start)) + ' to ' + esc(dShort(b.end)) + '. Nothing was changed.</div></div>' +
    '<div class="sheet-foot stack">' + (other ? '<button type="button" class="btn" id="bkcOpen">Open ' + esc(other.code) + '</button>' : '') +
    '<button type="button" class="btn ' + (other ? 'ghost' : '') + '" id="bkcCar">Change the car</button><button type="button" class="btn link" onclick="closeSheet()">Close</button></div>', function (sh) {
      var o = $('#bkcOpen', sh); if (o) o.onclick = function () { closeAllSheets(); setTimeout(function () { location.hash = '#booking/' + other.id; }, 60); };
      $('#bkcCar', sh).onclick = function () { closeSheet(true); setTimeout(function () { bkMoveCar(b.id); }, 60); };
    });
}
/* pick another free car for a cancelled booking, then it can be brought back */
function bkMoveCar(id) {
  var b = bk(id); if (!b) return;
  Pickers.car({ title: 'Choose a free car', start: new Date(b.start), end: new Date(b.end), exceptId: b.id, selected: b.car, onPick: function (c) {
    var r = busy(c.id, new Date(b.start), new Date(b.end), b.id); if (!r.free) { say(c.plate + ': ' + r.reason); return; }
    var old = b.car; b.car = c.id; b.rates = Object.assign({}, b.rates, { daily: c.rate, hourly: c.hourly }); if (c.deposit != null) b.rates.deposit = c.deposit;
    bLog(b, 'Car changed from ' + ((car(old) || {}).plate || '') + ' to ' + c.plate, { car: [(car(old) || {}).plate || '', c.plate] }); save(); render(false, true); say('Car changed to ' + c.plate + '. Set the status again.');
  } });
}
function deleteBk(id) {
  var b = bk(id), ins = b.inspection || {};
  if (ins.agent || ins.customer) { confirm({ icon: 'info', title: 'This booking cannot be deleted', text: 'It has an inspection with photos. Set its status to Cancelled instead.', ok: 'OK', cancel: 'Close' }); return; }
  var p = calcBooking(b), holds = p.depositReceived > 0 && b.paymentStatus !== 'Deposit Refunded';
  var warn = holds ? '<p class="bk-delwarn">' + esc(b.code) + ' still holds a deposit of ' + rm(p.depositReceived) + ' that has not been returned. Deleting it removes its refund case from Deposit refunds.</p>' : '';
  confirm({ icon: 'danger', title: 'Delete booking?', text: 'Delete ' + b.code + '? This cannot be undone.', danger: true,
    html: warn + '<p class="hint" style="text-align:center">Invoices and receipts already issued stay on file, and so do the customer\'s documents (IC, licence, proof of address).</p>',
    ok: holds ? 'Delete anyway' : 'Delete booking', cancel: 'Keep it' }).then(function (yes) {
      if (!yes) return;
      S.bookings = S.bookings.filter(function (x) { return x.id !== id; });
      S.recentBookings = (S.recentBookings || []).filter(function (x) { return x !== id; });
      if (matchBookingCode(bkSearch, b)) bkSearch = ''; /* the search pointed at this booking: do not land on an empty list */
      audit('Booking ' + b.code + ' deleted (' + cust(b.cust).name + ', ' + dShort(b.start) + ')', { cust: b.cust, car: b.car, link: '#bookings/all' }); save();
      /* wait until the confirm sheet has taken its history step back, then swap the page without a Back step */
      setTimeout(function () { if (window.__nav > 0) goBack('#bookings/all'); else replaceHash('#bookings/all'); say(b.code + ' deleted'); }, 180);
    });
}


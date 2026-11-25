/* ---------------- SCHEDULE (M5) ----------------
   #schedule (and the old #schedules): every pick-up, delivery and return, like the reference's Handovers & Schedules.
   Search across all upcoming days, range chips, day strip with counts, All / Deliveries / Returns, Mine, per-kind chips,
   rows with Call, WhatsApp, Navigate, Start handover, Assign task and inspection links. Pull down to refresh.
   Always opens on Today when entered from Home or More. */

var sched = { range: 'today', date: '', tab: 'all', mine: false, kind: '', q: '', updated: null };
function schedReset() { sched = { range: 'today', date: '', tab: 'all', mine: false, kind: '', q: '', updated: new Date().toISOString() }; }
VIEW_STATE.push(schedReset);
window.addEventListener('hashchange', function (e) {
  var nm = route().name, old = '';
  try { old = (new URL(e.oldURL).hash || '#home').slice(1).split(/[/?]/)[0] || 'home'; } catch (x) {}
  if ((nm === 'schedule' || nm === 'schedules') && ['schedule', 'schedules', 'booking', 'task', 'tasks', 'customer', 'car', 'deposit'].indexOf(old) < 0) {
    var q = route().q || {};
    schedReset();
    if (q.range) sched.range = q.range;
    if (q.date) { sched.range = 'date'; sched.date = q.date; }
    render(false);
  }
});

/* all handover events: {key, b, at, type 'out'|'in', label, done, overdue} */
function schedEvents() {
  var out = [], now = Date.now();
  S.bookings.forEach(function (b) {
    var st = b.bookingStatus; if (st === 'Cancelled' || !b.start || !b.end) return;
    var oDone = UPCOMING.indexOf(st) < 0, iDone = st === 'Car Returned' || st === 'Completed';
    var s = new Date(b.start), e = new Date(b.end);
    out.push({ key: 'o' + b.id, b: b, at: s, type: 'out', label: placeKindText(b, 'pick'), done: oDone, overdue: !oDone && s.getTime() < now });
    out.push({ key: 'i' + b.id, b: b, at: e, type: 'in', label: placeKindText(b, 'ret'), done: iDone, overdue: !iDone && st === 'Car Delivered' && e.getTime() < now });
  });
  return out;
}
function schedInRange(ev, range, date) {
  var t0 = sod(new Date()).getTime(), t = ev.at.getTime();
  if (range === 'today') return t >= t0 && t < t0 + DAY;
  if (range === 'tomorrow') return t >= t0 + DAY && t < t0 + 2 * DAY;
  if (range === 'week') return t >= t0 && t < t0 + 7 * DAY;
  if (range === 'date') { var d = date ? sod(fromInputs(date, '00:00')).getTime() : t0; return t >= d && t < d + DAY; }
  return t >= t0; /* all upcoming */
}
function schedMine(b) {
  if ((b.assigned || []).indexOf(S.me) >= 0) return true;
  return (S.tasks || []).some(function (t) { return t.booking === b.id && (t.staff || []).indexOf(S.me) >= 0 && t.status !== 'Cancelled'; });
}
function schedStaff(b) {
  var ids = (b.assigned || []).slice();
  (S.tasks || []).forEach(function (t) { if (t.booking === b.id && t.status !== 'Cancelled') (t.staff || []).forEach(function (s) { if (ids.indexOf(s) < 0) ids.push(s); }); });
  return ids.map(staff).filter(Boolean);
}
function schedMatch(ev, q) {
  if (!q) return true;
  var b = ev.b, c = cust(b.cust), k = car(b.car) || {};
  if (tidySearch(q) && phoneMatch(q, c.phone)) return true;
  if (matchBookingCode(q, b)) return true;
  if (normPlate(q).length >= 2 && normPlate(k.plate).indexOf(normPlate(q)) >= 0) return true;
  return wordsMatch(q, [c.name, k.make, k.model, k.plate, b.code, ev.label, b.pickNote, b.retNote].join(' '));
}
/* kind chips in the booking form's order: our locations, the client, other places */
function schedKinds(evs, type) {
  var s = B(), list = [];
  (s.locations || []).forEach(function (l) { if (type === 'out' ? l.pickup : l.dropoff) list.push((type === 'out' ? 'Pick-up' : 'Drop-off') + ' · ' + (l.short || l.name)); });
  list.push((type === 'out' ? 'Delivery' : 'Return') + ' · Client');
  (s.places || []).forEach(function (p) { list.push((type === 'out' ? 'Delivery' : 'Return') + ' · ' + p.name); });
  var counts = {}; evs.forEach(function (e) { if (e.type === type) counts[e.label] = (counts[e.label] || 0) + 1; });
  Object.keys(counts).forEach(function (l) { if (list.indexOf(l) < 0) list.push(l); });
  return list.map(function (l) { return { label: l, type: type, n: counts[l] || 0 }; });
}
function schedRel(ev) {
  if (ev.done) return chip('Done', 'green');
  var d = ev.at.getTime() - Date.now(), a = Math.abs(d), txt;
  var fmt = function (ms) { var m = Math.round(ms / MIN); if (m < 60) return m + ' min'; var h = Math.floor(m / 60), r = m % 60; if (h < 24) return h + 'h' + (r && h < 6 ? ' ' + r + 'm' : ''); var dd = Math.floor(h / 24); return dd + ' day' + (dd > 1 ? 's' : ''); };
  if (d < 0) { txt = 'Late ' + fmt(a); return chip(ev.type === 'out' ? txt + ', not picked up' : txt, 'red'); }
  if (d < 12 * HOUR) return chip('in ' + fmt(a), d < HOUR ? 'amber' : 'blue');
  return '';
}
function schedMapUrl(b, type) {
  var end = type === 'out' ? 'pick' : 'ret', k = end === 'pick' ? b.pickKind : b.retKind, id = end === 'pick' ? b.pickLoc : b.retLoc, note = end === 'pick' ? b.pickNote : b.retNote, q;
  if (k === 'client') q = note || cust(b.cust).address || '';
  else if (k === 'place') q = ((place(id) || {}).name || '') + (B().city ? ', ' + B().city : '');
  else { var l = loc(id); q = l ? l.name + ', ' + (B().address || B().city || '') : B().address || ''; }
  return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
}
function schedRow(ev) {
  var b = ev.b, c = cust(b.cust), k = car(b.car) || {}, m = calcBooking(b), note = ev.type === 'out' ? b.pickNote : b.retNote;
  var team = schedStaff(b), map = schedMapUrl(b, ev.type), draft = hoDraftGet(b.id, ev.type);
  var collect = !ev.done && m.due > 0 && can('bookings.see_amounts') ? '<span class="bal due money">' + rm(m.due) + ' to collect</span>' : '';
  var prim = '';
  if (!ev.done && ev.type === 'out' && UPCOMING.indexOf(b.bookingStatus) >= 0) prim = '<button type="button" class="btn sm sc-go" data-ho="out" data-id="' + b.id + '">' + I('key') + (draft ? 'Resume' : 'Hand over') + '</button>';
  else if (!ev.done && ev.type === 'in' && b.bookingStatus === 'Car Delivered') prim = '<button type="button" class="btn sm sc-go" data-ho="in" data-id="' + b.id + '">' + I('in') + (draft ? 'Resume' : 'Take back') + '</button>';
  var tm = hm(ev.at).split(' ');
  return '<div class="sc-card' + (ev.done ? ' done' : '') + (ev.overdue ? ' late' : '') + '">' +
    '<a class="sc-main" href="#booking/' + b.id + '"><div class="sc-time"><b class="num">' + tm[0] + '</b><small>' + tm[1] + '</small>' + (ev.overdue && !ev.done && !sameDay(ev.at, new Date()) ? '<small class="sc-dw">' + esc(dayWord(ev.at)) + '</small>' : '') + '<span class="sc-dir ' + ev.type + '">' + (ev.type === 'out' ? 'Out' : 'Back') + '</span></div>' +
    '<div class="sc-body"><div class="sc-l1"><b>' + esc(c.name) + '</b>' + payChip(b) + '</div>' +
    '<div class="sc-l2"><b class="sc-plate">' + esc(k.plate || 'No car') + '</b> ' + esc((k.make || '') + ' ' + (k.model || '')) + ' · ' + esc(b.code) + '</div>' +
    '<div class="sc-l3">' + I('pin') + '<span>' + esc(ev.label) + (note ? ' · ' + esc(note) : '') + '</span></div>' +
    '<div class="sc-l4">' + schedRel(ev) + (draft && !ev.done ? chip('Half done', 'orange') : '') + collect + (team.length ? '<span class="sc-team">' + team.slice(0, 3).map(function (p) { return '<span class="av xs" title="' + esc(p.name) + '" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</span>'; }).join('') + '</span>' : '<span class="sc-none">Nobody assigned</span>') + '</div></div></a>' +
    (ev.done ? '' : '<div class="sc-acts">' + (c.phone ? '<a class="sc-ic" href="tel:+' + normPhone(c.phone) + '" aria-label="Call ' + esc(c.name) + '">' + I('phone') + '</a><button type="button" class="sc-ic wa" data-wa="' + ev.key + '" aria-label="WhatsApp">' + I('wa') + '</button>' : '') +
    (map ? '<a class="sc-ic" href="' + esc(map) + '" target="_blank" rel="noopener" aria-label="Navigate">' + I('map') + '</a>' : '') +
    '<span class="grow"></span>' + prim + '<button type="button" class="sc-ic" data-more="' + ev.key + '" aria-label="More actions">' + I('more') + '</button></div>') + '</div>';
}

VIEWS.schedule = function (r) {
  if (!sched.updated) sched.updated = new Date().toISOString();
  var all = schedEvents(), q = sched.q.trim(), now = new Date();
  var showOverdue = q || sched.range === 'today' || sched.range === 'all' || sched.range === 'week';
  var inRange = all.filter(function (e) { return q ? (e.at >= sod(now) || e.overdue) : (schedInRange(e, sched.range, sched.date) || (showOverdue && e.overdue)); });
  if (sched.mine) inRange = inRange.filter(function (e) { return schedMine(e.b); });
  if (q) inRange = inRange.filter(function (e) { return schedMatch(e, q); });
  var kinds = (sched.tab !== 'in' ? schedKinds(inRange, 'out') : []).concat(sched.tab !== 'out' ? schedKinds(inRange, 'in') : []).filter(function (k) { return k.n > 0 || k.label === sched.kind; });
  var list = inRange.filter(function (e) { return (sched.tab === 'all' || e.type === sched.tab) && (!sched.kind || e.label === sched.kind); });
  list.sort(function (a, b) { return (b.overdue - a.overdue) || (a.at - b.at); });
  var nOut = inRange.filter(function (e) { return e.type === 'out'; }).length, nIn = inRange.length - nOut;
  /* the header counts the days picked; late ones from earlier days are counted apart */
  var early = inRange.filter(function (e) { return e.overdue && !sameDay(e.at, now) && (q || !schedInRange(e, sched.range, sched.date)); }), hOut = nOut - early.filter(function (e) { return e.type === 'out'; }).length, hIn = nIn - early.filter(function (e) { return e.type !== 'out'; }).length;

  /* day strip: two weeks with counts */
  var base = sod(now), strip = '';
  for (var i = 0; i < 14; i++) {
    var d = new Date(base.getTime() + i * DAY), dv = toLocalInput(d), o = 0, n = 0;
    all.forEach(function (e) { if (sameDay(e.at, d) && (!sched.mine || schedMine(e.b))) { if (e.type === 'out') o++; else n++; } });
    var on = !q && ((sched.range === 'today' && i === 0) || (sched.range === 'tomorrow' && i === 1) || (sched.range === 'date' && sched.date === dv));
    strip += '<button type="button" class="sc-day' + (on ? ' on' : '') + '" data-day="' + dv + '"><span>' + (i === 0 ? 'Today' : WD[d.getDay()]) + ' <b>' + d.getDate() + '</b></span><small>' + (o || n ? o + ' out · ' + n + ' back' : 'Nothing') + '</small></button>';
  }
  var rangeChip = function (v, t) { return '<button type="button" class="fchip' + (!q && sched.range === v ? ' on' : '') + '" data-range="' + v + '">' + t + '</button>'; };
  var pickTxt = sched.range === 'date' && sched.date ? dLong(fromInputs(sched.date, '00:00')) : 'Pick a date';
  var rangeName = q ? 'All upcoming days' : { today: 'Today', tomorrow: 'Tomorrow', week: 'Next 7 days', all: 'All upcoming', date: sched.date ? dLong(fromInputs(sched.date, '00:00')) : 'Today' }[sched.range];

  var body = '';
  if (!list.length) body = '<div class="empty">' + (q ? 'Nothing upcoming matches “' + esc(q) + '”.' : sched.mine ? 'No handovers for you here. Turn off Mine to see everyone’s.' : 'No handovers ' + (sched.range === 'today' ? 'today' : 'in these days') + '.') + '</div>';
  else {
    var lastDay = '', late = list.filter(function (e) { return e.overdue && !sameDay(e.at, now); }), rest = list.filter(function (e) { return late.indexOf(e) < 0; });
    if (late.length) body += '<div class="sc-sec red">' + I('warn') + 'Needs attention · ' + late.length + '</div>' + late.map(schedRow).join('');
    var multi = q || sched.range === 'week' || sched.range === 'all' || late.length;
    rest.forEach(function (e) {
      var dk = toLocalInput(e.at);
      if (multi && dk !== lastDay) { lastDay = dk; var cnt = rest.filter(function (x) { return toLocalInput(x.at) === dk; }); body += '<div class="sc-sec">' + esc(dayWord(e.at)) + (dayWord(e.at).indexOf(' ') < 0 ? ', ' + dShort(e.at) : '') + '<span>' + cnt.filter(function (x) { return x.type === 'out'; }).length + ' out · ' + cnt.filter(function (x) { return x.type === 'in'; }).length + ' back</span></div>'; }
      body += schedRow(e);
    });
  }

  var html = topbar('Schedule', { back: '#more', sub: rangeName + ' · ' + hOut + ' out, ' + hIn + ' back' + (early.length ? ' · ' + early.length + ' late' : ''), right: '<button type="button" class="iconbtn" id="scRefresh" aria-label="Refresh">' + I('reset') + '</button>' }) +
    '<main class="sc"><div class="sc-ptr" id="scPtr"><span>' + I('reset') + '<i id="scPtrT">Pull to refresh</i></span></div>' +
    '<div class="sc-sticky"><label class="search">' + I('search') + '<input id="scQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="Name, plate, model, booking or phone" value="' + esc(sched.q) + '">' + (sched.q ? '<button type="button" class="sc-x" id="scX" aria-label="Clear search">' + I('x', 2.2) + '</button>' : '') + '</label></div>' +
    (q ? '<div class="sc-searching">Searching all upcoming days</div>' : '<div class="chiprow sc-range">' + rangeChip('today', 'Today') + rangeChip('tomorrow', 'Tomorrow') + rangeChip('week', 'This week') +
      '<button type="button" class="fchip' + (sched.range === 'date' ? ' on' : '') + '" id="scPick">' + I('cal') + esc(pickTxt) + '</button>' + rangeChip('all', 'All upcoming') + '</div>' +
      '<div class="sc-days" id="scDays">' + strip + '</div>') +
    '<input type="date" id="scDate" class="sc-date" value="' + esc(sched.date || toLocalInput(now)) + '" tabindex="-1" aria-hidden="true">' +
    '<div class="sc-tabs"><div class="seg2 sc-seg">' + [['all', 'All', inRange.length], ['out', 'Deliveries', nOut], ['in', 'Returns', nIn]].map(function (t) { return '<a href="javascript:void 0" role="button" data-tab="' + t[0] + '" class="' + (sched.tab === t[0] ? 'on' : '') + '">' + t[1] + ' <small>' + t[2] + '</small></a>'; }).join('') + '</div>' +
    '<button type="button" class="fchip sc-mine' + (sched.mine ? ' on' : '') + '" id="scMine" aria-pressed="' + sched.mine + '">' + I('user') + 'Mine</button></div>' +
    (kinds.length ? '<div class="chiprow sc-kinds">' + kinds.map(function (k) { return '<button type="button" class="fchip' + (sched.kind === k.label ? ' on' : '') + '" data-kind="' + esc(k.label) + '">' + esc(k.label) + ' <span class="n">' + k.n + '</span></button>'; }).join('') + '</div>' : '') +
    '<div class="sc-list">' + body + '</div><p class="sc-upd">Updated ' + hm(sched.updated) + '</p></main>';
  return { html: html, after: schedWire };
};
VIEWS.schedules = VIEWS.schedule;

function schedWire() {
  var main = $('main.sc'); if (!main) return;
  var all = null, evOf = function (key) { all = all || schedEvents(); return all.filter(function (e) { return e.key === key; })[0]; };
  var q = $('#scQ'), t = null;
  q.oninput = function () { clearTimeout(t); t = setTimeout(function () { sched.q = q.value; sched.kind = ''; render(); var j = $('#scQ'); if (j) { j.focus(); j.setSelectionRange(j.value.length, j.value.length); } }, 160); };
  var x = $('#scX'); if (x) x.onclick = function () { sched.q = ''; render(); };
  $$('[data-range]').forEach(function (el) { el.onclick = function () { sched.range = el.dataset.range; sched.kind = ''; sched.q = ''; render(); }; });
  $$('[data-day]').forEach(function (el) { el.onclick = function () { var i = Math.round((sod(fromInputs(el.dataset.day, '00:00')) - sod(new Date())) / DAY); if (i === 0) sched.range = 'today'; else if (i === 1) sched.range = 'tomorrow'; else { sched.range = 'date'; sched.date = el.dataset.day; } sched.kind = ''; sched.q = ''; render(); }; });
  var di = $('#scDate'), pk = $('#scPick');
  if (pk) pk.onclick = function () { try { if (di.showPicker) { di.showPicker(); return; } } catch (e) {} di.focus(); di.click(); };
  di.onchange = function () { if (!di.value) return; sched.range = 'date'; sched.date = di.value; sched.kind = ''; render(); };
  $$('[data-tab]').forEach(function (el) { el.onclick = function () { sched.tab = el.dataset.tab; sched.kind = ''; render(); }; });
  $('#scMine').onclick = function () { sched.mine = !sched.mine; render(); };
  $$('[data-kind]').forEach(function (el) { el.onclick = function () { var k = el.dataset.kind; if (sched.kind === k) { sched.kind = ''; sched.tab = 'all'; } else { sched.kind = k; sched.tab = /^(Pick-up|Delivery)/.test(k) ? 'out' : 'in'; } render(); }; });
  $$('[data-ho]').forEach(function (el) { el.onclick = function () { Handover.start(el.dataset.id, el.dataset.ho); }; });
  $$('[data-wa]').forEach(function (el) { el.onclick = function () { var ev = evOf(el.dataset.wa); if (ev) schedWa(ev); }; });
  $$('[data-more]').forEach(function (el) { el.onclick = function () { var ev = evOf(el.dataset.more); if (ev) schedMore(ev); }; });
  $('#scRefresh').onclick = function () { schedRefresh(); };
  var on = $('.sc-day.on'); if (on) { var days = $('#scDays'); days.scrollLeft = Math.max(0, on.offsetLeft - 16); }
  /* pull to refresh */
  var y0 = null, dy = 0, ptr = $('#scPtr');
  main.ontouchstart = function (e) { y0 = window.scrollY <= 0 && !SHEETS.length ? e.touches[0].clientY : null; dy = 0; };
  main.ontouchmove = function (e) { if (y0 == null) return; dy = Math.max(0, Math.min(110, (e.touches[0].clientY - y0) * .5)); ptr.style.height = dy + 'px'; ptr.classList.toggle('ready', dy > 60); $('#scPtrT').textContent = dy > 60 ? 'Let go to refresh' : 'Pull to refresh'; };
  main.ontouchend = function () { if (y0 == null) return; y0 = null; if (dy > 60) schedRefresh(); else ptr.style.height = '0'; };
}
function schedRefresh() {
  var ptr = $('#scPtr'); if (ptr) { ptr.style.height = '48px'; ptr.classList.add('spin'); $('#scPtrT').textContent = 'Refreshing...'; }
  later(function () { sched.updated = new Date().toISOString(); render(); say('Schedule up to date'); }, 650);
}
function schedWa(ev) {
  var b = ev.b, c = cust(b.cust), k = car(b.car) || {}, out = ev.type === 'out';
  var txt = 'Hi ' + callName(c.name) + ', this is ' + B().short + '. ' + (out ? 'Your car ' + (k.make || '') + ' ' + (k.model || '') + ' (' + (k.plate || '') + ') is ready for ' : 'A reminder that the car ' + (k.plate || '') + ' is due back ') +
    dayWord(ev.at).toLowerCase().replace(/^(mon|tue|wed|thu|fri|sat|sun)/, function (m) { return m.charAt(0).toUpperCase() + m.slice(1); }) + ' at ' + hm(ev.at) + ', ' + placeText(b, out ? 'pick' : 'ret') + '. See you!';
  Share.wa(c.phone, txt);
}
function schedMore(ev) {
  var b = ev.b, c = cust(b.cust), agent = Links.agent(b), item = function (id, icon, t, sub) { return '<button type="button" class="sc-mi" id="' + id + '">' + I(icon) + '<span class="grow"><b>' + esc(t) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; };
  var sh = sheet(sheetHead((ev.type === 'out' ? 'Out · ' : 'Back · ') + b.code, c.name + ' · ' + dShort(ev.at) + ', ' + hm(ev.at)) + '<div class="sc-menu">' +
    item('scmOpen', 'list', 'Open booking') +
    (can('tasks.create') ? item('scmTask', 'task', 'Assign task', 'Give this handover to someone') : '') +
    (agent ? item('scmAgCopy', 'copy', 'Copy agent inspection link', 'For the staff who hands over the car') + item('scmAgWa', 'wa', 'Send agent link on WhatsApp', 'To the person doing the handover') : '') +
    item('scmCuCopy', 'copy', 'Copy customer inspection link', 'The customer takes photos before driving off') +
    (c.phone ? item('scmCuWa', 'wa', 'Send customer link on WhatsApp', c.phone) : '') + '</div>');
  var on = function (id, fn) { var el = $('#' + id, sh); if (el) el.onclick = fn; };
  on('scmOpen', function () { closeSheet(true); location.hash = '#booking/' + b.id; });
  on('scmTask', function () { closeSheet(true); setTimeout(function () { Tasks.newFor(b.id, ev.type); }, 30); });
  on('scmAgCopy', function () { Share.copy(agent, 'Agent link copied'); bLog(b, 'Agent inspection link copied'); save(); });
  on('scmAgWa', function () {
    var team = schedStaff(b).filter(function (p) { return p.phone; });
    var send = function (p) { Share.wa(p.wa || p.phone, 'Hi ' + firstName(p.name) + ', please do the ' + (ev.type === 'out' ? 'handover' : 'return') + ' check for ' + b.code + ' (' + ((car(b.car) || {}).plate || '') + ') ' + dayWord(ev.at).toLowerCase() + ' at ' + hm(ev.at) + ': ' + agent); bLog(b, 'Agent inspection link sent to ' + p.name + ' on WhatsApp'); save(); };
    if (team.length === 1) { send(team[0]); return; }
    Pickers.staff({ title: 'Send the agent link to', preferIds: team.map(function (p) { return p.id; }), onPick: function (p) { if (p) send(p); } });
  });
  on('scmCuCopy', function () { Share.copy(Links.customer(b), 'Customer link copied'); });
  on('scmCuWa', function () { Share.wa(c.phone, 'Hi ' + callName(c.name) + ', before you drive off please take a few photos of the car here: ' + Links.customer(b)); bLog(b, 'Customer inspection link sent on WhatsApp'); save(); });
}

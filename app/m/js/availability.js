/* ---------------- AVAILABILITY (M1 builder owns this file) ----------------
   #availability?from=YYYY-MM-DDTHH:MM&to=...&len=2&h12=1&booked=1
   Which cars are free for a period, which need a check (a booking ends or starts within 3 hours), and which are booked. */
var AV_LENS = [['1', '1d'], ['2', '2d'], ['3', '3d'], ['4', '4d'], ['5', '5d'], ['7', '7d']];
var avQ = '';
VIEW_STATE.push(function () { avQ = ''; });
function avLocal(d) { d = new Date(d); return toLocalInput(d) + 'T' + toTimeInput(d); }
function avParse(s) { if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null; var p = s.split('T'); return fromInputs(p[0], p[1]); }
function avState(q) {
  q = q || {};
  var t = sod(new Date()); t = new Date(t.getTime() + DAY); t.setHours(10, 0, 0, 0);
  var from = avParse(q.from) || t, len = q.len != null ? q.len : (q.to ? '' : '2'), h12 = q.h12 === '1', to = avParse(q.to);
  if (len) to = new Date(from.getTime() + (+len) * DAY + (h12 ? 12 * HOUR : 0));
  if (!to) to = new Date(from.getTime() + 2 * DAY);
  return { from: from, to: to, len: len, h12: h12, booked: q.booked === '1' };
}
function avHash(st) { return hashWith('availability', { from: avLocal(st.from), to: st.len ? '' : avLocal(st.to), len: st.len, h12: st.h12 && st.len ? '1' : '', booked: st.booked ? '1' : '' }); }
/* the end of the period, shown once: 'to Sat 28 Nov, 10:00 AM · 2 days' */
function avToLine(st) { return '<span class="grow">to <b class="nowrap">' + dLong(st.to) + ', ' + hm(st.to) + '</b> · ' + esc(durationText(st.from, st.to)) + '</span>'; }
VIEWS.availability = function (r) {
  var st = avState(r.q);
  var html = topbar('Check availability', { back: '#bookings', sub: 'Which cars are free' }) + '<main class="avpage">' +
    '<div class="card av-form">' +
    '<div class="av-row"><span class="av-lbl">From</span><input class="inp" type="date" id="av_fd" value="' + toLocalInput(st.from) + '" aria-label="From date"><input class="inp" type="time" step="900" id="av_ft" value="' + toTimeInput(st.from) + '" aria-label="From time"></div>' +
    '<div class="av-lens" id="av_lens" role="group" aria-label="How long">' + AV_LENS.map(function (l) { return '<button type="button" class="fchip' + (st.len === l[0] ? ' on' : '') + '" data-len="' + l[0] + '" aria-label="' + l[0] + (l[0] === '1' ? ' day' : ' days') + '">' + l[1] + '</button>'; }).join('') +
    '<button type="button" class="fchip av-h12' + (st.h12 ? ' on' : '') + '" id="av_h12" aria-pressed="' + (st.h12 ? 'true' : 'false') + '" aria-label="Add 12 hours">+12h</button></div>' +
    '<button type="button" class="av-toline" id="av_tobtn" aria-expanded="' + (st.len ? 'false' : 'true') + '"></button>' +
    '<div class="av-row av-torow" id="av_torow"' + (st.len ? ' hidden' : '') + '><span class="av-lbl">To</span><input class="inp" type="date" id="av_td" value="' + toLocalInput(st.to) + '" aria-label="To date"><input class="inp" type="time" step="900" id="av_tt" value="' + toTimeInput(st.to) + '" aria-label="To time"></div>' +
    '<div id="av_err"></div></div>' +
    '<label class="search av-search">' + I('search') + '<input id="avq" type="search" placeholder="Search by plate or model" value="' + esc(avQ) + '" autocomplete="off" autocapitalize="characters"><button type="button" class="bk-clear" id="avclear" aria-label="Clear search"' + (avQ ? '' : ' hidden') + '>' + I('x', 2.2) + '</button></label>' +
    '<div id="avlist"></div></main>';
  return { html: html, after: function () {
    var cur = st, tmr = null;
    var push = function () { history.replaceState(history.state, '', location.pathname + location.search + avHash(cur)); };
    var draw = function () {
      $('#av_td').value = toLocalInput(cur.to); $('#av_tt').value = toTimeInput(cur.to);
      $$('#av_lens button').forEach(function (b) { b.classList.toggle('on', b.dataset.len === cur.len); });
      var bad = !(cur.to > cur.from);
      $('#av_err').innerHTML = bad ? '<div class="err-text">End must be after start</div>' : '';
      $('#av_td').classList.toggle('bad', bad); $('#av_tt').classList.toggle('bad', bad);
      $('#av_tobtn').innerHTML = bad ? '<span class="grow">Pick an end after the start</span>' : avToLine(cur) + I('edit');
      var h = $('#av_h12'); h.classList.toggle('on', cur.h12); h.setAttribute('aria-pressed', cur.h12 ? 'true' : 'false');
      if (bad) $('#av_torow').hidden = false;
      $('#avlist').innerHTML = bad ? '<div class="empty">Pick an end after the start.</div>' : avList(cur);
    };
    var fromChanged = function () {
      var f = fromInputs($('#av_fd').value || toLocalInput(cur.from), $('#av_ft').value || '10:00');
      cur.from = f;
      if (cur.len) cur.to = new Date(f.getTime() + (+cur.len) * DAY + (cur.h12 ? 12 * HOUR : 0));
      else { var t = new Date(cur.to); t.setHours(f.getHours(), f.getMinutes(), 0, 0); cur.to = t; }
      push(); draw();
    };
    $('#av_fd').addEventListener('change', fromChanged); $('#av_ft').addEventListener('change', fromChanged);
    var toChanged = function (e) {
      var t = fromInputs($('#av_td').value || toLocalInput(cur.to), $('#av_tt').value || toTimeInput(cur.from));
      if (e && e.target.id === 'av_td') t.setHours(cur.from.getHours(), cur.from.getMinutes(), 0, 0);
      cur.to = t; cur.len = ''; cur.h12 = false; push(); draw();
    };
    $('#av_td').addEventListener('change', toChanged); $('#av_tt').addEventListener('change', toChanged);
    $$('#av_lens button').forEach(function (b) { b.onclick = function () { cur.len = b.dataset.len; cur.to = new Date(cur.from.getTime() + (+cur.len) * DAY + (cur.h12 ? 12 * HOUR : 0)); push(); draw(); }; });
    $('#av_tobtn').onclick = function () { var row = $('#av_torow'); row.hidden = !row.hidden; this.setAttribute('aria-expanded', row.hidden ? 'false' : 'true'); if (!row.hidden) $('#av_td').focus(); };
    $('#av_h12').addEventListener('click', function () {
      cur.h12 = !cur.h12;
      if (!cur.len) { cur.len = String(Math.max(1, Math.min(7, Math.round((cur.to - cur.from) / DAY) || 1))); }
      cur.to = new Date(cur.from.getTime() + (+cur.len) * DAY + (cur.h12 ? 12 * HOUR : 0)); push(); draw();
    });
    var q = $('#avq'), clr = $('#avclear');
    q.addEventListener('input', function () { avQ = q.value; clr.hidden = !q.value; clearTimeout(tmr); tmr = setTimeout(function () { $('#avlist').innerHTML = cur.to > cur.from ? avList(cur) : '<div class="empty">Pick an end after the start.</div>'; }, 150); });
    clr.onclick = function () { q.value = ''; avQ = ''; clr.hidden = true; $('#avlist').innerHTML = cur.to > cur.from ? avList(cur) : '<div class="empty">Pick an end after the start.</div>'; q.focus(); };
    window.avToggleBooked = function (on) { cur.booked = on; push(); $('#avlist').innerHTML = avList(cur); };
    draw();
  } };
};
function avList(st) {
  var term = avQ.trim(), np = normPlate(term), free = [], check = [], booked = [];
  S.cars.forEach(function (c) {
    if (c.status === 'sold' || c.status === 'inactive') return;
    if (term && normPlate(c.plate).indexOf(np) < 0 && !wordsMatch(term, [c.make, c.model, c.color, c.type].join(' '))) return;
    var bz = busy(c.id, st.from, st.to);
    if (!bz.free) booked.push({ c: c, bz: bz }); else if (bz.soon) check.push({ c: c, bz: bz }); else free.push({ c: c, bz: bz });
  });
  var byPlate = function (a, b) { return (a.c.make + a.c.model).localeCompare(b.c.make + b.c.model) || a.c.plate.localeCompare(b.c.plate); };
  free.sort(byPlate); check.sort(byPlate); booked.sort(byPlate);
  /* the same count as New booking and the car picker: every free car, with the ones close to another booking called out */
  var html = '<div class="sec av-sec"><h2 class="tone-green-text">' + (free.length + check.length) + ' free' + (check.length ? ' (' + check.length + ' need' + (check.length === 1 ? 's' : '') + ' a check)' : '') + '</h2></div>' +
    (free.length ? '<div class="av-cards">' + free.map(function (x) { return avCard(x, st, 'free'); }).join('') + '</div>' :
      '<div class="empty small">' + (term ? 'No free car matches “' + esc(term) + '”.' : 'No cars are free for the whole period. ' + (check.length ? 'Some cars below are close. Moving the times a little may free them.' : 'Try a shorter period or different times.')) + '</div>');
  if (check.length) html += '<div class="sec av-sec"><h2 class="tone-amber-text">Free, but check ' + (check.length > 1 ? 'these ' + check.length : 'this one') + '</h2></div><p class="hint av-hint">' + (check.length === 1 ? 'It has a booking' : 'They have bookings') + ' ending within 3 hours before your start, or starting within 3 hours after your end.</p>' +
    '<div class="av-cards">' + check.map(function (x) { return avCard(x, st, 'check'); }).join('') + '</div>';
  html += '<label class="av-showbooked"><span><b class="tone-red-text">' + booked.length + ' booked</b><small>Cars that are not free in this period</small></span><span class="sw"><input type="checkbox" onchange="avToggleBooked(this.checked)"' + (st.booked ? ' checked' : '') + '><i></i></span></label>';
  if (st.booked && booked.length) html += '<div class="av-cards">' + booked.map(function (x) { return avCard(x, st, 'booked'); }).join('') + '</div>';
  return html;
}
function avCard(x, st, kind) {
  var c = x.c, bz = x.bz, rent = calcBooking({ start: st.from, end: st.to, rates: { daily: c.rate, hourly: c.hourly } }).rent;
  var note = kind === 'check' ? '<div class="av-note amber">' + I('clock') + esc(bz.soon) + '</div>' : kind === 'booked' ? '<div class="av-note red">' + I('lock') + esc(bz.reason) + '</div>' : '';
  var act = kind === 'booked' ? (bz.booking ? '<a class="btn sm ghost" href="#booking/' + bz.booking.id + '">Open ' + esc(bz.booking.code) + '</a>' : '') :
    can('bookings.create') ? '<a class="btn sm' + (kind === 'check' ? ' ghost' : '') + '" href="' + hashWith('new', { car: c.id, start: st.from.toISOString(), end: st.to.toISOString() }) + '">' + I('plus', 2.2) + 'Book this car</a>' : '';
  return '<div class="card av-card ' + kind + '"><div class="av-top"><span class="av-pic">' + carSVG(c.color, c.shape) + '</span><div class="grow"><div class="av-plate">' + esc(c.plate) + '</div><div class="small muted av-model">' + esc(c.make + ' ' + c.model + ' · ' + (c.type || '') + ' · ' + c.color) + '</div></div>' +
    (can('bookings.see_amounts') ? '<div class="av-price"><b class="money">' + rm(rent) + '</b><small>rent for ' + esc(durationText(st.from, st.to)) + '</small><small>plus deposit</small></div>' : '') + '</div>' + note + (act ? '<div class="av-act">' + act + '</div>' : '') + '</div>';
}

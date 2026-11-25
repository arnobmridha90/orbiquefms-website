/* ---------------- CALENDAR (M1 builder owns this file) ----------------
   #calendar?d=YYYY-MM-DD : one row per car, 14 days across. Bars are bookings coloured by status, striped bars are workshop time.
   Tap a bar to open the booking, tap an empty day to start a booking for that car at 10:00. */
var CAL_DAYS = 14, CAL_W = 54;
var calQ = '';
VIEW_STATE.push(function () { calQ = ''; });
function calStart(q) { var d = q && /^\d{4}-\d{2}-\d{2}$/.test(q.d || '') ? fromInputs(q.d, '00:00') : sod(new Date()); return d; }
VIEWS.calendar = function (r) {
  var s = calStart(r.q), e = new Date(s.getTime() + CAL_DAYS * DAY);
  var shift = function (n) { return hashWith('calendar', { d: toLocalInput(new Date(s.getTime() + n * DAY)) }); };
  var label = dShort(s) + ' to ' + dShort(new Date(e.getTime() - 1)) + (s.getFullYear() !== new Date().getFullYear() ? ' ' + s.getFullYear() : '');
  var html = topbar('Car calendar', { back: '#bookings', sub: label }) + '<main class="calpage">' +
    '<div class="cal-tools"><a class="iconbtn cal-nav" href="' + shift(-7) + '" onclick="calGo(event,this)" aria-label="Previous week">' + I('back', 2.2) + '</a>' +
    '<a class="btn sm ghost" href="' + hashWith('calendar', {}) + '" onclick="calGo(event,this)">Today</a>' +
    '<a class="iconbtn cal-nav next" href="' + shift(7) + '" onclick="calGo(event,this)" aria-label="Next week">' + I('back', 2.2) + '</a>' +
    '<label class="search cal-search">' + I('search') + '<input id="calq" type="search" placeholder="Plate" value="' + esc(calQ) + '" autocomplete="off" autocapitalize="characters"></label></div>' +
    '<div class="cal-legend">' + [['Confirmed', 'grey'], ['Agreement Sent', 'red'], ['Agreement Signed', 'orange'], ['Car Delivered', 'green'], ['Car Returned', 'blue']].map(function (x) { return '<span><i class="tone-' + x[1] + '"></i>' + x[0] + '</span>'; }).join('') + '<span><i class="cal-ws"></i>Workshop</span></div>' +
    '<div class="cal-wrap" id="calwrap"><div class="cal-grid" id="calgrid"></div></div></main>';
  return { html: html, keepScroll: false, after: function () {
    var draw = function () { $('#calgrid').innerHTML = calGrid(s, e); };
    draw();
    var t = null, q = $('#calq');
    q.addEventListener('input', function () { calQ = q.value; clearTimeout(t); t = setTimeout(draw, 150); });
    /* start scrolled so today is in view when the range starts earlier */
    var ti = Math.floor((sod(new Date()) - s) / DAY); if (ti > 1 && ti < CAL_DAYS) $('#calwrap').scrollLeft = (ti - 1) * CAL_W;
  } };
};
/* moving between weeks is a view setting: no Back step for each tap */
function calGo(e, a) { e.preventDefault(); history.replaceState(history.state, '', location.pathname + location.search + a.getAttribute('href')); render(false); }
function calGrid(s, e) {
  var S0 = s.getTime(), E0 = e.getTime(), today = sod(new Date()).getTime(), term = normPlate(calQ.trim());
  var inRange = function (a, b) { return new Date(a).getTime() < E0 && (b ? new Date(b).getTime() : Infinity) > S0; };
  var head = '<div class="cal-row cal-head"><div class="cal-car">Car</div><div class="cal-track" style="width:' + CAL_DAYS * CAL_W + 'px">';
  for (var i = 0; i < CAL_DAYS; i++) {
    var d = new Date(S0 + i * DAY), wk = d.getDay() === 0 || d.getDay() === 6;
    head += '<div class="cal-day' + (d.getTime() === today ? ' today' : '') + (wk ? ' wk' : '') + '" style="left:' + i * CAL_W + 'px;width:' + CAL_W + 'px"><small>' + WD[d.getDay()] + '</small><b>' + d.getDate() + '</b>' + (d.getDate() === 1 || i === 0 ? '<em>' + MO[d.getMonth()] + '</em>' : '') + '</div>';
  }
  head += '</div></div>';
  var rows = '', n = 0;
  S.cars.slice().sort(function (a, b) { return a.plate.localeCompare(b.plate); }).forEach(function (c) {
    var bks = S.bookings.filter(function (b) { return b.car === c.id && b.bookingStatus !== 'Cancelled' && inRange(b.start, b.end); });
    var dts = (S.downtime || []).filter(function (d) { return d.car === c.id && inRange(d.from, d.to); });
    if ((c.status === 'inactive' || c.status === 'sold') && !bks.length) return;
    if (term && normPlate(c.plate).indexOf(term) < 0 && !wordsMatch(calQ.trim(), c.make + ' ' + c.model)) return;
    n++;
    var cells = '';
    for (var i = 0; i < CAL_DAYS; i++) {
      var d = new Date(S0 + i * DAY), past = d.getTime() < today, wk = d.getDay() === 0 || d.getDay() === 6, st = new Date(d); st.setHours(10, 0, 0, 0); if (d.getTime() === today && st.getTime() < Date.now()) { st = new Date(); st.setHours(st.getHours() + 1, 0, 0, 0); } /* today after 10 am: the next full hour */
      cells += '<button type="button" class="cal-cell' + (wk ? ' wk' : '') + (d.getTime() === today ? ' today' : '') + '" style="left:' + i * CAL_W + 'px;width:' + CAL_W + 'px"' +
        (past || c.status !== 'active' ? ' disabled aria-hidden="true" tabindex="-1"' : ' aria-label="New booking for ' + esc(c.plate) + ' on ' + dLong(d) + '" onclick="location.hash=\'' + hashWith('new', { car: c.id, start: st.toISOString() }) + '\'"') + '></button>';
    }
    var px = function (t) { return Math.max(0, Math.min(CAL_DAYS * CAL_W, (t - S0) / DAY * CAL_W)); };
    var bars = dts.map(function (d) {
      var a = px(new Date(d.from).getTime()), z = px(d.to ? new Date(d.to).getTime() : E0);
      return '<div class="cal-bar ws" style="left:' + a + 'px;width:' + Math.max(8, z - a - 2) + 'px" title="' + esc(d.reason || 'Workshop') + '"><span>' + esc(d.reason || 'Workshop') + '</span></div>';
    }).join('') + bks.map(function (b) {
      var a = px(new Date(b.start).getTime()), z = px(new Date(b.end).getTime()), w = Math.max(10, z - a - 2), tone = isLate(b) ? 'red' : BK_TONE[b.bookingStatus] || 'grey';
      var hrs = (new Date(b.end) - new Date(b.start)) / HOUR, len = hrs < 24 ? Math.round(hrs) + 'h' : Math.round(hrs / 24 * 10) / 10 + 'd';
      var cu = cust(b.cust);
      return '<button type="button" class="cal-bar tone-' + tone + (b.bookingStatus === 'Completed' ? ' done' : '') + (new Date(b.start).getTime() < S0 ? ' cut-l' : '') + (new Date(b.end).getTime() > E0 ? ' cut-r' : '') + '" style="left:' + a + 'px;width:' + w + 'px" onclick="location.hash=\'#booking/' + b.id + '\'" aria-label="' + esc(b.code + ', ' + cu.name + ', ' + b.bookingStatus) + '"><span>' + esc(firstName(cu.name)) + ' · ' + len + '</span></button>';
    }).join('');
    rows += '<div class="cal-row"><a class="cal-car" href="#car/' + c.id + '"><b>' + esc(c.plate) + '</b><small>' + esc(c.model) + (c.status !== 'active' ? ' · ' + (c.status === 'sold' ? 'Sold' : 'Not in use') : '') + '</small></a><div class="cal-track" style="width:' + CAL_DAYS * CAL_W + 'px">' + cells + bars + '</div></div>';
  });
  if (!n) rows = '<div class="empty cal-empty">No car matches “' + esc(calQ) + '”.</div>';
  return head + rows;
}

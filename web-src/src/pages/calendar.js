/* ===================================================================
   Page: Calendar (#page=calendar)   Owner: builder 3
   A fleet timeline: one row per car, bookings as coloured bars across days, workshop time as striped bars.
   Address: #page=calendar&view=timeline|month|week|day|list&date=2026-10-19&q=plate
   Cars that are Not in use or Sold are left off unless a booking in the dates is on them. Clicking an empty day on a car's
   row starts a New Booking for that car and day at 10:00 AM. A plate box filters the rows. The list opens at today.
   =================================================================== */
var CL_VIEWS = [['timeline', 'Timeline'], ['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['list', 'List']];
/* bar colour from booking status + payment status (red, yellow, green, blue, grey) */
var CL_TONES = { red: ['Deposit or extension due', 'error'], yellow: ['Signed, deposit or full payment in', 'warning'], green: ['Out with the renter, paid', 'success'], blue: ['Returned, refund pending', 'info'], grey: ['Other', 'grey'] };
function clTone(x) {
  var s = x.status, p = x.pay;
  if ((s === 'Agreement Sent' || s === 'Agreement Signed') && p === 'Deposit due') return 'red';
  if (s === 'Car Delivered' && p === 'Extension due') return 'red';
  if (s === 'Agreement Signed' && (p === 'Deposit Received' || p === 'Full Payment Received')) return 'yellow';
  if (s === 'Car Delivered' && (p === 'Full Payment Received' || p === 'Extension paid')) return 'green';
  if (s === 'Car Returned' && p === 'Refund Pending') return 'blue';
  return 'grey';
}
function clDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function clAdd(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function clDays(x) { var h = Math.round((x.end - x.start) / 36e5), dd = Math.floor(h / 24), r = h % 24; return [dd ? plural(dd, 'day') : '', r ? plural(r, 'hour') : ''].filter(Boolean).join(' ') || '0 hours'; }
/* the range a view shows around an anchor day */
function clRange(view, a) {
  if (view === 'timeline') { var s = clAdd(a, -4); return { from: s, to: clAdd(s, 42), n: 42, unit: 'day', step: 42, label: UI.fmt.date(s).replace(/ \d{4}$/, '') + ' to ' + UI.fmt.date(clAdd(s, 41)) }; }
  if (view === 'month' || view === 'list') { var m = new Date(a.getFullYear(), a.getMonth(), 1), e = new Date(a.getFullYear(), a.getMonth() + 1, 1); return { from: m, to: e, n: Math.round((e - m) / DAY), unit: 'day', month: true, label: MONTHS[m.getMonth()] + ' ' + m.getFullYear() }; }
  if (view === 'week') { var w = clAdd(a, -((a.getDay() + 6) % 7)); return { from: w, to: clAdd(w, 7), n: 7, unit: 'day', step: 7, label: w.getDate() + ' ' + MON[w.getMonth()] + ' to ' + UI.fmt.date(clAdd(w, 6)) }; }
  return { from: a, to: clAdd(a, 1), n: 24, unit: 'hour', step: 1, label: a.getDate() + ' ' + MONTHS[a.getMonth()] + ' ' + a.getFullYear() };
}
function clHour(h) { return (h % 12 || 12) + ' ' + (h < 12 ? 'AM' : 'PM'); }

PAGES['calendar'] = {
  title: 'Calendar',
  render: function (root, ctx) {
    var st = ctx.state, p = ctx.params, d = ctx.data, money = ctx.can('calendar.see_amounts');
    st.view = p.view && CL_VIEWS.some(function (v) { return v[0] === p.view; }) ? p.view : st.view || 'timeline';
    st.date = p.date && UI.parseDate(p.date) && !isNaN(UI.parseDate(p.date)) ? clDay(UI.parseDate(p.date)) : st.date || clDay(NOW());
    var today = clDay(NOW());
    if (p.q != null) st.q = p.q;
    st.q = st.q || '';

    root.innerHTML = '<div class="pg-h"><div><h1>Calendar</h1><p>Every car, every booking, day by day.</p></div><div class="acts">' +
      UI.btn('Check availability', { kind: 'o', icon: 'calendar-search', attrs: { 'data-cl': 'avail' } }) +
      (ctx.can('bookings.create') ? UI.btn('New Booking', { icon: 'plus', attrs: { 'data-cl': 'new' } }) : '') + '</div></div>' +
      '<div class="card cl-card"><div class="cl-bar"><div class="cl-nav">' + UI.iconBtn('chevron-left', 'Previous', { attrs: { 'data-cl': 'prev' } }) + UI.iconBtn('chevron-right', 'Next', { attrs: { 'data-cl': 'next' } }) +
      UI.btn('Today', { kind: 'tonal', size: 'sm', attrs: { 'data-cl': 'today' } }) + '<h2 class="cl-label" id="cl-label"></h2></div>' +
      '<div class="cl-right"><div class="cl-q">' + UI.input({ key: 'clq', icon: 'search', placeholder: 'Find a plate', value: st.q, type: 'search', attrs: { 'aria-label': 'Find a car by its plate', autocomplete: 'off' } }) + '</div><span class="cl-count" id="cl-count"></span><div class="cl-views" role="tablist" aria-label="View">' + CL_VIEWS.map(function (v) { return '<button type="button" role="tab" data-view="' + v[0] + '" aria-selected="' + (st.view === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="cl-legend">' + Object.keys(CL_TONES).map(function (k) { return '<span><i class="cl-sw ' + k + '"></i>' + CL_TONES[k][0] + '</span>'; }).join('') + '<span><i class="cl-sw shop"></i>Workshop</span>' + (ctx.can('bookings.create') ? '<span class="cl-hint">' + i('hand-click') + 'Click an empty day on a car to book it</span>' : '') + '</div>' +
      '<div id="cl-body"></div></div>';
    var body = root.querySelector('#cl-body');

    function inRange(r) {
      var bks = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start < r.to && x.end > r.from; });
      var shop = d.downtime.filter(function (w) { return w.from < r.to && (w.to || NOW()) > r.from; });
      return { bks: bks, shop: shop };
    }
    /* the plate box: spaces and dashes do not matter ('vkp4418' finds VKP 4418); model words work too */
    function carMatch(c) { var q = (st.q || '').trim(); if (!q) return true; var np = normPlate(q); return (np.length && normPlate(c.plate).indexOf(np) >= 0) || UI.wordsMatch(c.plate + ' ' + carName(c) + ' ' + c.color, q); }
    /* cars on the calendar: active ones, plus a Not in use or Sold car only when a booking in these dates is on it */
    function shownCars(ev) { return d.cars.filter(function (c) { return (!c.fleet || c.fleet === 'Active' || ev.bks.some(function (x) { return x.car === c; })) && carMatch(c); }); }
    function draw() {
      var r = clRange(st.view, st.date), ev = inRange(r), cars = shownCars(ev);
      if (st.q) { ev = { bks: ev.bks.filter(function (x) { return cars.indexOf(x.car) >= 0; }), shop: ev.shop.filter(function (w) { return cars.some(function (c) { return c.id === w.car; }); }) }; }
      root.querySelector('#cl-label').textContent = r.label;
      root.querySelector('#cl-count').textContent = plural(cars.length, 'car') + ' · ' + plural(ev.bks.length, 'booking');
      root.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-view') === st.view)); });
      if (st.view === 'list') {
        body.innerHTML = listHtml(r, ev);
        /* the list opens at today */
        var td = body.querySelector('.cl-lday.td'), ls = body.querySelector('.cl-list'); if (td && ls) ls.scrollTop = Math.max(0, td.offsetTop);
        return;
      }
      body.innerHTML = gridHtml(r, ev, cars);
      var wrap = body.querySelector('.cl-wrap');
      /* scroll so today (or 8 AM on the day view) is in sight */
      var tx = st.view === 'day' ? 8 / 24 : (today - r.from) / (r.to - r.from);
      var tr = wrap && wrap.querySelector('.cl-track'); if (tr && tx > 0 && tx < 1) { wrap.scrollLeft = Math.max(0, tr.offsetWidth * tx - (st.view === 'day' ? 0 : 120)); }
    }
    function gridHtml(r, ev, cars) {
      var colW = { timeline: 48, month: 46, week: 120, day: 64 }[st.view], span = r.to - r.from, pct = function (t) { return Math.max(0, Math.min(100, (t - r.from) / span * 100)); };
      var cells = [], head = '';
      for (var k = 0; k < r.n; k++) {
        if (r.unit === 'day') {
          var dt = clAdd(r.from, k), we = dt.getDay() === 0 || dt.getDay() === 6, td = +dt === +today;
          cells.push(td ? 'td' : we ? 'we' : '');
          head += '<div class="cl-hd' + (td ? ' td' : we ? ' we' : '') + '">' + (dt.getDate() === 1 || k === 0 ? '<em>' + MON[dt.getMonth()] + '</em>' : '<em></em>') + '<span>' + WD[dt.getDay()] + '</span><b>' + dt.getDate() + '</b></div>';
        } else {
          var nowH = +r.from === +today ? NOW().getHours() : -1;
          cells.push(k === nowH ? 'td' : '');
          head += '<div class="cl-hd hr' + (k === nowH ? ' td' : '') + '"><b>' + clHour(k) + '</b></div>';
        }
      }
      var bg = '<div class="cl-bg">' + cells.map(function (c) { return '<i class="' + c + '"></i>'; }).join('') + '</div>';
      var nowP = NOW() > r.from && NOW() < r.to ? '<span class="cl-now" style="left:' + pct(NOW()) + '%" aria-hidden="true"></span>' : '';
      var minW = r.n * colW;
      var rows = cars.map(function (c) {
        var items = ev.bks.filter(function (x) { return x.car === c; }).map(function (x) { return { s: x.start, e: x.end, b: x }; })
          .concat(ev.shop.filter(function (w) { return w.car === c.id; }).map(function (w) { return { s: w.from, e: w.to || new Date(Math.max(+NOW(), +r.to)), w: w }; }))
          .sort(function (a, b) { return a.s - b.s; });
        var lanes = [];
        items.forEach(function (it) { var l = 0; while (lanes[l] && lanes[l] > it.s) l++; lanes[l] = it.e; it.lane = l; });
        var nl = Math.max(1, lanes.length);
        var bars = items.map(function (it) {
          var L = pct(it.s), R = pct(it.e), cut = it.s < r.from, cutR = it.e > r.to;
          var style = 'left:' + L + '%;width:calc(' + Math.max(R - L, 0) + '% - 3px);top:' + (8 + it.lane * 30) + 'px';
          if (it.w) return '<button type="button" class="cl-ev shop' + (it.w.back ? ' past' : '') + (cut ? ' cl' : '') + (cutR ? ' cr' : '') + '" style="' + style + '" data-shop="' + it.w.id + '" title="Workshop: ' + esc(it.w.reason) + '"><b>Workshop · ' + esc(it.w.reason === 'Accident' ? 'Accident repair' : it.w.reason) + '</b>' + (it.w.note ? ' · ' + esc(it.w.note) : '') + '</button>';
          var x = it.b;
          return '<button type="button" class="cl-ev ' + clTone(x) + (cut ? ' cl' : '') + (cutR ? ' cr' : '') + '" style="' + style + '" data-bk="' + x.code + '" aria-label="' + esc(x.code + ', ' + x.cust.name + ', ' + x.status) + '"><b>' + esc(x.cust.name) + '</b> • ' + tm(x.start) + ' - ' + tm(x.end) + ' • ' + clDays(x) + '</button>';
        }).join('');
        return '<div class="cl-car" data-car="' + c.id + '" role="button" tabindex="0" title="Open ' + esc(c.plate) + '">' + carsThumb(c, 'cl-ph') + '<div class="cl-ci"><b>' + esc(c.plate) + '</b><span>' + esc(carName(c)) + '</span><small>' + esc(c.color) + (c.fleet && c.fleet !== 'Active' ? ' · ' + esc(c.fleet) : '') + '</small></div></div>' +
          '<div class="cl-track' + (ctx.can('bookings.create') && (!c.fleet || c.fleet === 'Active') ? ' book' : '') + '" style="height:' + (16 + nl * 30) + 'px" data-row="' + c.id + '">' + bg + nowP + bars + '</div>';
      }).join('');
      return '<div class="cl-wrap"><div class="cl-grid" style="grid-template-columns:var(--cl-left) minmax(' + minW + 'px,1fr);min-width:calc(var(--cl-left) + ' + minW + 'px)">' +
        '<div class="cl-corner">Cars (' + cars.length + ')</div><div class="cl-head" style="grid-template-columns:repeat(' + r.n + ',minmax(0,1fr))">' + head + '</div>' + rows + '</div></div>' +
        (cars.length ? '' : st.q ? UI.empty({ icon: 'car-off', title: 'No car matches "' + st.q + '"', text: 'Try the numbers of the plate, or clear the box.' }) : UI.empty({ icon: 'car-off', title: 'No cars yet', text: 'Add a car on the Cars page to see it here.' }));
    }
    function listHtml(r, ev) {
      var items = ev.bks.map(function (x) { return { at: x.start, b: x }; }).concat(ev.shop.map(function (w) { return { at: w.from, w: w }; })).sort(function (a, b) { return a.at - b.at; });
      if (!items.length) return UI.empty({ icon: 'calendar-off', title: 'No events to display', text: 'No bookings or workshop time in ' + r.label + '.' });
      var groups = {}, order = [];
      items.forEach(function (it) { var k = UI.isoDate(it.at < r.from ? r.from : it.at); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(it); });
      /* a Today heading even on a day with nothing, so the list always opens at today */
      var tk = UI.isoDate(today); if (today >= r.from && today < r.to && !groups[tk]) { groups[tk] = []; order.push(tk); order.sort(); }
      return '<div class="cl-list">' + order.map(function (k) {
        var dt = UI.parseDate(k);
        return '<div class="cl-lday' + (+dt === +today ? ' td' : '') + '"><span>' + (+dt === +today ? 'Today, ' : '') + WDL[dt.getDay()] + '</span><b>' + UI.fmt.date(dt) + '</b></div>' + groups[k].map(function (it) {
          if (it.w) { var c = carById(it.w.car); return '<button type="button" class="cl-li" data-shop="' + it.w.id + '"><span class="cl-lt">' + (it.at < r.from ? 'Continues' : tm(it.w.from)) + '</span><i class="cl-sw shop"></i><span class="cl-lx"><b>Workshop · ' + esc(it.w.reason) + '</b><span>' + (c ? esc(c.plate) + ' · ' + esc(carName(c)) : '') + ' · until ' + (it.w.to ? UI.fmt.dateTime(it.w.to) : 'no date set') + '</span></span></button>'; }
          var x = it.b;
          return '<button type="button" class="cl-li" data-bk="' + x.code + '"><span class="cl-lt">' + (it.at < r.from ? 'Continues' : tm(x.start)) + '</span><i class="cl-sw ' + clTone(x) + '"></i><span class="cl-lx"><b>' + esc(x.cust.name) + ' · ' + esc(x.car.plate) + '</b><span>' + x.code + ' · ' + clDays(x) + ', until ' + UI.fmt.dateTime(x.end) + '</span></span><span class="cl-lc">' + UI.status('booking', x.status) + UI.status('payment', x.pay) + '</span></button>';
        }).join('') + (groups[k].length ? '' : '<div class="cl-lnone">No bookings or workshop time start today.</div>');
      }).join('') + '</div>';
    }
    function pointAnchor(ev, el) {
      var rc = el.getBoundingClientRect(), x = ev.clientX || rc.left + 10, y = ev.clientY || rc.bottom;
      return { getBoundingClientRect: function () { return { left: x, right: x, top: y - 4, bottom: y + 4 }; }, contains: function (t) { return el.contains(t); } };
    }
    function bookingCard(x) {
      var paid = DB.received(x.code) || x.received || 0, mrow = function (l, v, strong) { return '<div class="cl-tr' + (strong ? ' st' : '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
      return '<div class="cl-tip"><div class="cl-tip-h"><b>' + esc(x.cust.name) + '</b>' + UI.phone(x.cust.phone, { wa: true }) + '</div>' +
        '<div class="cl-tip-s"><div><b>' + clDays(x) + '</b></div><div>' + UI.fmt.dateTime(x.start) + '</div><div>' + UI.fmt.dateTime(x.end) + '</div><div class="faint">' + esc(x.car.plate) + ' · ' + esc(carName(x.car)) + '</div></div>' +
        (money ? '<div class="cl-tip-s"><div class="faint">Daily: ' + UI.fmt.money(x.rate || x.car.rate) + ' · Hourly: ' + UI.fmt.money(x.hourly || x.car.hourly) + '</div>' + mrow('Total Rent', UI.money(x.rent), true) + mrow('Security Deposit', UI.money(x.dep)) + (x.disc ? mrow('Discount', '- ' + UI.money(x.disc)) : '') + mrow('Total Amount Paid', UI.money(paid), true) + '</div>' : '<div class="cl-tip-s faint">Amounts are hidden for your role.</div>') +
        '<div class="cl-tip-s"><div class="cl-tr"><span>Booking Status</span>' + UI.status('booking', x.status) + '</div><div class="cl-tr"><span>Payment Status</span>' + UI.status('payment', x.pay || 'None') + '</div><div class="cl-tr"><span>Booking ID</span><b class="mono">' + x.code + '</b></div></div>' +
        '<div class="cl-tip-a">' + UI.btn('Open booking', { size: 'sm', icon: 'external-link', attrs: { 'data-tip': 'open', 'data-v': x.code } }) + '</div></div>';
    }
    function shopCard(w) {
      var c = carById(w.car);
      return '<div class="cl-tip"><div class="cl-tip-h"><b>Workshop · ' + esc(w.reason === 'Accident' ? 'Accident repair' : w.reason) + '</b><span class="faint">' + (c ? esc(c.plate) + ' · ' + esc(carName(c)) : '') + '</span></div>' +
        '<div class="cl-tip-s"><div>' + UI.fmt.dateTime(w.from) + '</div><div>' + (w.to ? UI.fmt.dateTime(w.to) : 'No return date yet') + '</div>' + (w.note ? '<div class="faint">' + esc(w.note) + '</div>' : '') + '</div>' +
        '<div class="cl-tip-s">' + (w.back ? '<div>The car is back from the workshop.</div>' : '<div><b>This car cannot be booked for these dates.</b></div>') + '</div>' +
        (ctx.can('maintenance.view') ? '<div class="cl-tip-a">' + UI.btn('Open in Maintenance', { size: 'sm', kind: 'o', icon: 'tool', attrs: { 'data-tip': 'health', 'data-v': w.car } }) + '</div>' : '') + '</div>';
    }
    var tipPop = null;
    function tip(ev, el, html) {
      tipPop = UI.popover(pointAnchor(ev, el), html, { width: 300, align: 'start', cls: 'cl-pop' });
      UI.on(tipPop.el, 'click', '[data-tip]', function (e2, b) { var v = b.getAttribute('data-v'); tipPop.close(); if (b.getAttribute('data-tip') === 'open') ctx.api.openBooking(v); else ctx.api.carHealth(v); });
    }
    UI.on(body, 'click', '[data-bk]', function (ev, el) { var x = findBooking(el.getAttribute('data-bk')); if (x) tip(ev, el, bookingCard(x)); });
    UI.on(body, 'click', '[data-shop]', function (ev, el) { var w = byId(d.downtime, el.getAttribute('data-shop')); if (w) tip(ev, el, shopCard(w)); });
    /* an empty day (or hour) on a car's row starts a New Booking for that car, at 10:00 AM that day */
    UI.on(body, 'click', '.cl-track', function (ev, el) {
      if (ev.target.closest('.cl-ev') || !ctx.can('bookings.create')) return;
      var c = carById(el.getAttribute('data-row')); if (!c) return;
      if (c.fleet && c.fleet !== 'Active') { UI.toast(c.plate + ' is marked ' + c.fleet + ', so it cannot be booked.', { tone: 'warn' }); return; }
      var r = clRange(st.view, st.date), rc = el.getBoundingClientRect(), fr = Math.max(0, Math.min(.9999, (ev.clientX - rc.left) / rc.width)), at = new Date(+r.from + fr * (r.to - r.from)), s;
      if (r.unit === 'hour') { s = new Date(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), 0); } else { s = clDay(at); s.setHours(10, 0, 0, 0); }
      ctx.api.newBooking({ car: c.id, start: s, end: new Date(s.getTime() + DAY) });
    });
    UI.on(root, 'input', '[data-key="clq"]', UI.debounce(function (ev, el) { st.q = el.value; ctx.setParams({ q: st.q || null }, true); draw(); }, 180));
    var openCar = function (el) { ctx.api.openCar(el.getAttribute('data-car')); };
    UI.on(body, 'click', '.cl-car', function (ev, el) { openCar(el); });
    UI.on(body, 'keydown', '.cl-car', function (ev, el) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCar(el); } });
    UI.on(root, 'click', '[data-view]', function (ev, el) { st.view = el.getAttribute('data-view'); ctx.setParams({ view: st.view }); draw(); });
    UI.on(root, 'click', '[data-cl]', function (ev, el) {
      var a = el.getAttribute('data-cl'), r = clRange(st.view, st.date);
      if (a === 'today') st.date = clDay(NOW());
      else if (a === 'prev' || a === 'next') {
        var dir = a === 'prev' ? -1 : 1;
        st.date = r.month ? new Date(st.date.getFullYear(), st.date.getMonth() + dir, 1) : clAdd(st.date, dir * r.step);
      } else if (a === 'new') { ctx.api.newBooking({}); return; }
      else if (a === 'avail') { ctx.go('availability', {}); return; }
      ctx.setParams({ date: UI.isoDate(st.date) }); draw();
    });
    if (!st.loaded) { st.loaded = true; body.innerHTML = '<div class="cl-load">' + i('loader-2') + ' Loading scheduler…</div>'; setTimeout(function () { if (root.isConnected) draw(); }, 120); } else draw();
  },
  search: [{ label: 'Calendar: this week', icon: 'calendar-week', run: function () { go('calendar', { view: 'week' }); } }, { label: 'Calendar: today by the hour', icon: 'clock', run: function () { go('calendar', { view: 'day' }); } }]
};

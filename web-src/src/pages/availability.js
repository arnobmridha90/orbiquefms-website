/* ===================================================================
   Page: Availability Checker (#page=availability)   Owner: builder 3
   Pick a period and see at once which cars are free, which are close (risky turnaround) and which are booked.
   Address: #page=availability&from=2026-10-19T17:00&to=2026-10-22T17:00  (&demo=offline|error shows the warning and error states, for builders only: no menu offers them)
   =================================================================== */
var AV_LENS = [[1, '1 day'], [2, '2 days'], [3, '3 days'], [4, '4 days'], [5, '5 days'], [7, '1 week']];
var AV_FREE = ['Cancelled', 'Completed'];

function avLenText(ms) {
  var h = Math.round(ms / 36e5), dd = Math.floor(h / 24), r = h % 24;
  return [dd ? plural(dd, 'day') : '', r ? plural(r, 'hour') : ''].filter(Boolean).join(' ') || mtDur(ms);
}
function avWhen(d) { return WD[d.getDay()] + ', ' + UI.fmt.dt(d); }
/* sort every car into available / check / booked for one period */
function avCheck(from, to, d) {
  d = d || D();
  var out = { free: [], check: [], booked: [] }, gapMs = turnaroundH(d) * 36e5;
  d.cars.forEach(function (c) {
    var bs = d.bookings.filter(function (x) { return x.car === c && AV_FREE.indexOf(x.status) < 0; });
    var over = bs.filter(function (x) { return x.start < to && x.end > from; });
    var w = d.downtime.filter(function (z) { return z.car === c.id && !z.back && z.from < to && (!z.to || z.to > from); })[0];
    /* a car marked Not in use or Sold is never free */
    if (c.fleet && c.fleet !== 'Active') { out.booked.push({ c: c, notes: [{ icon: c.fleet === 'Sold' ? 'tag' : 'ban', text: 'Marked ' + c.fleet + ', so it cannot be booked' }] }); return; }
    if (over.length || w) {
      var notes = over.map(function (x) { return { icon: 'calendar-off', text: 'Booked in this period: ' + x.code + ', ' + UI.fmt.dt(x.start) + ' to ' + UI.fmt.dt(x.end), code: x.code }; });
      if (w) notes.unshift({ icon: 'tool', text: 'In the workshop (' + w.reason.toLowerCase() + ') ' + UI.fmt.dt(w.from) + (w.to ? ' to ' + UI.fmt.dt(w.to) : ', no return date yet') });
      out.booked.push({ c: c, notes: notes }); return;
    }
    var notes2 = [];
    bs.forEach(function (x) {
      if (x.end <= from && from - x.end < gapMs) {
        var gap = from - x.end, back = x.status === 'Car Returned' || x.end <= NOW();
        notes2.push({ icon: 'arrow-back-up', code: x.code, text: (back && x.status === 'Car Returned' ? 'Returned at ' : 'Back at ') + tm(x.end) + ', ' + (gap ? mtDur(gap) + ' before your start' : 'exactly at your start') + ' (' + x.code + ')' });
      }
      if (x.start >= to && x.start - to < gapMs) {
        var gap2 = x.start - to;
        notes2.push({ icon: 'arrow-forward-up', code: x.code, text: (x.startOpt && x.startOpt.indexOf('Delivery') === 0 ? 'Goes out at ' : 'Next booking at ') + tm(x.start) + ', ' + (gap2 ? mtDur(gap2) + ' after your end' : 'exactly at your end') + ' (' + x.code + ')' });
      }
    });
    if (notes2.length) out.check.push({ c: c, notes: notes2 }); else out.free.push({ c: c, notes: [] });
  });
  return out;
}

PAGES['availability'] = {
  title: 'Availability Checker',
  render: function (root, ctx) {
    var st = ctx.state, p = ctx.params;
    if (!st.from) {
      var n = NOW(), f = new Date(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours() + 1, 0);
      st.from = f; st.len = 1; st.half = false; st.to = new Date(f.getTime() + DAY); st.show = false;
    }
    if (p.from && UI.parseDate(p.from) && !isNaN(UI.parseDate(p.from))) { st.from = UI.parseDate(p.from); }
    var matchLen = function () { var ms = st.to - st.from, k = AV_LENS.filter(function (l) { return ms === l[0] * DAY || ms === l[0] * DAY + DAY / 2; })[0]; st.len = k ? k[0] : null; st.half = !!k && ms % DAY !== 0; };
    if (p.to && UI.parseDate(p.to) && !isNaN(UI.parseDate(p.to))) { st.to = UI.parseDate(p.to); matchLen(); }
    var setLen = function () { if (st.len) st.to = new Date(st.from.getTime() + st.len * DAY + (st.half ? DAY / 2 : 0)); };
    var save = function () { ctx.setParams({ from: UI.isoDateTime(st.from), to: UI.isoDateTime(st.to) }, true); };

    root.innerHTML = '<div class="pg-h"><div><h1>Availability checker</h1><p>Pick a period to see at once which cars are free, which are close and which are booked.</p></div><div class="acts">' +
      UI.btn('Open the calendar', { kind: 'o', icon: 'calendar', attrs: { 'data-av': 'cal' } }) + '</div></div>' +
      '<div class="card av-pick"><div id="av-form"></div></div><div id="av-res" aria-live="polite"></div>';
    var form = root.querySelector('#av-form'), res = root.querySelector('#av-res');

    function drawForm() {
      var bad = !(st.to > st.from);
      /* on a phone the period is one tappable line (the free cars show straight below it); tapping opens the fields */
      var short = function (d0) { return WD[d0.getDay()] + ' ' + d0.getDate() + ' ' + MON[d0.getMonth()] + ' ' + (d0.getHours() % 12 || 12) + (d0.getMinutes() ? ':' + String(d0.getMinutes()).padStart(2, '0') : '') + ' ' + (d0.getHours() < 12 ? 'AM' : 'PM'); };
      form.parentNode.classList.toggle('open', !!st.open);
      form.innerHTML = '<button type="button" class="av-sumbtn" data-av="edit" aria-expanded="' + !!st.open + '">' + i('calendar') + '<span class="grow"><b>' + (bad ? 'Pick a period' : short(st.from) + ' to ' + short(st.to)) + '</b><small>' + (bad ? 'The end must be after the start' : avLenText(st.to - st.from)) + ' · ' + (st.open ? 'Done' : 'Change') + '</small></span>' + i(st.open ? 'chevron-up' : 'chevron-down') + '</button><div class="av-fbody"><div class="av-dates">' +
        UI.dateTimeField({ key: 'from', label: 'From', value: st.from, required: true }) +
        UI.dateTimeField({ key: 'to', label: 'To', value: st.to, required: true, chips: false, error: bad ? 'End must be after start' : '' }) + '</div>' +
        '<div class="av-lab">Rental length</div><div class="av-chips" role="group" aria-label="Rental length">' +
        AV_LENS.map(function (l) { return '<button type="button" class="av-chip" data-len="' + l[0] + '" aria-pressed="' + (st.len === l[0]) + '">' + l[1] + '</button>'; }).join('') +
        '<button type="button" class="av-chip" data-av="half" aria-pressed="' + !!st.half + '">' + i('plus') + '12 hours</button></div>' +
        (bad ? '' : '<div class="av-sum">' + i('calendar') + '<span>' + avWhen(st.from) + ' to ' + avWhen(st.to) + ' (' + avLenText(st.to - st.from) + ')</span></div>') + '</div>';
    }
    /* the daily rate and the rent for the picked period, worked out like the booking form (bkCalc), to quote at once */
    var seeAmt = ctx.can('bookings.see_amounts') || ctx.can('bookings.edit_amounts');
    function price(c) {
      if (!seeAmt || !c.rate) return '';
      var k = bkCalc({ start: st.from, end: st.to, rate: c.rate, hourly: c.hourly });
      return '<div class="av-price"><b class="num">' + UI.fmt.money(c.rate) + '/day</b><span class="num">' + UI.fmt.money(k.rent) + ' for ' + avLenText(st.to - st.from) + '</span></div>';
    }
    function tile(x, kind) {
      var c = x.c, book = kind !== 'booked' && ctx.can('bookings.create');
      return '<div class="av-tile ' + kind + '" data-car="' + c.id + '"><div class="av-tile-t">' + esc(carName(c)) + (c.fleet && c.fleet !== 'Active' ? ' ' + UI.chip(c.fleet, 'grey') : '') + '</div>' +
        '<div class="av-tile-b"><div class="av-tile-id"><b>' + esc(c.plate) + '</b><span>' + esc(c.color) + '</span></div>' + carsThumb(c, 'av-ph') + '</div>' +
        (kind !== 'booked' ? price(c) : '') +
        (x.notes.length ? '<ul class="av-notes">' + x.notes.map(function (nn) { return '<li>' + i(nn.icon) + '<span>' + esc(nn.text) + '</span>' + (nn.code ? '<button type="button" class="av-link" data-bk="' + nn.code + '">Open</button>' : '') + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="av-tile-a">' + UI.btn('Car details', { kind: 't', size: 'sm', icon: 'car', attrs: { 'data-open': c.id } }) + (book ? UI.btn('Book this car', { kind: kind === 'check' ? 'o' : 'c', size: 'sm', icon: 'calendar-plus', attrs: { 'data-book': c.id } }) : '') + '</div></div>';
    }
    function drawRes() {
      if (!(st.to > st.from)) { res.innerHTML = UI.empty({ icon: 'calendar-x', title: 'Pick a period', text: 'The end must be after the start.' }); return; }
      if (p.demo === 'error') {
        res.innerHTML = '<div class="card av-err">' + UI.empty({ icon: 'cloud-off', title: 'Could not load cars for this period.', text: 'Check your connection and try again.', action: UI.btn('Retry', { icon: 'refresh', attrs: { 'data-av': 'retry' } }) }) + '</div>'; return;
      }
      var r = avCheck(st.from, st.to), h = '';
      if (p.demo === 'offline') { r.free = r.free.concat(r.check); r.check = []; h += UI.alert('Booking times could not be loaded, so cars returned or going out within ' + plural(turnaroundH(), 'hour') + ' may not be flagged. Double-check before confirming.', 'warn'); }
      h += '<div class="av-h ok">' + i('circle-check') + '<span>' + r.free.length + ' available</span></div>';
      h += r.free.length ? '<div class="av-grid">' + r.free.map(function (x) { return tile(x, 'free'); }).join('') + '</div>' :
        '<div class="card">' + UI.empty({ icon: 'car-off', title: D().cars.length ? 'No cars are free for the whole period' : 'No cars found', text: r.check.length ? 'Some cars below are close. Moving the times a little may free them.' : 'Try a shorter period or different times.' }) + '</div>';
      if (r.check.length) h += '<div class="av-h warn">' + i('alert-triangle') + '<span>Check ' + plural(r.check.length, 'car') + '</span></div><p class="muted av-p">They have bookings ending within ' + plural(turnaroundH(), 'hour') + ' of your start time or starting within ' + plural(turnaroundH(), 'hour') + ' of your end time (the gap between rentals in Settings).</p><div class="av-grid">' + r.check.map(function (x) { return tile(x, 'check'); }).join('') + '</div>';
      h += '<div class="av-h bad">' + i('circle-x') + '<span class="grow">' + r.booked.length + ' booked</span>' + UI.switch({ key: 'avshow', label: 'Show', checked: st.show, attrs: { 'data-av': 'show' } }) + '</div>';
      if (st.show) h += r.booked.length ? '<div class="av-grid">' + r.booked.map(function (x) { return tile(x, 'booked'); }).join('') + '</div>' : '<p class="muted av-p">No car is booked or in the workshop in this period.</p>';
      res.innerHTML = h;
    }
    function all() { drawForm(); drawRes(); }
    all();

    UI.on(form, 'change', 'input[data-key]', function (ev, el) {
      var v = UI.parseDate(el.value); if (!v || isNaN(v)) return;
      if (el.getAttribute('data-key') === 'from') { st.from = v; setLen(); } else { st.to = v; matchLen(); }
      save(); all();
    });
    UI.on(form, 'click', '[data-len]', function (ev, el) { st.len = +el.getAttribute('data-len'); st.open = false; setLen(); save(); all(); });
    UI.on(form, 'click', '[data-av="edit"]', function () { st.open = !st.open; drawForm(); });
    UI.on(form, 'click', '[data-av="half"]', function () {
      st.half = !st.half;
      if (st.len) setLen(); else st.to = new Date(st.to.getTime() + (st.half ? 1 : -1) * DAY / 2);
      save(); all();
    });
    UI.on(res, 'change', '[data-av="show"]', function (ev, el) { st.show = el.checked; drawRes(); });
    UI.on(res, 'click', '[data-av="retry"]', function () { ctx.setParams({ demo: null }); p.demo = null; drawRes(); UI.toast('Cars loaded'); });
    UI.on(res, 'click', '[data-book]', function (ev, el) { ctx.api.newBooking({ car: el.getAttribute('data-book'), start: UI.isoDateTime(st.from), end: UI.isoDateTime(st.to) }); });
    UI.on(res, 'click', '[data-open]', function (ev, el) { ctx.api.openCar(el.getAttribute('data-open')); });
    UI.on(res, 'click', '[data-bk]', function (ev, el) { ctx.api.openBooking(el.getAttribute('data-bk')); });
    UI.on(root, 'click', '[data-av="cal"]', function () { ctx.go('calendar', { date: UI.isoDate(st.from) }); });
  },
  search: [{ label: 'Check which cars are free tomorrow', icon: 'calendar-search', run: function (ctx) { var n = NOW(), f = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 10, 0); go('availability', { from: UI.isoDateTime(f), to: UI.isoDateTime(new Date(f.getTime() + DAY)) }); } }]
};

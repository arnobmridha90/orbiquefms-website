/* ===================================================================
   Page: Dashboard (#page=dashboard)   Owner: builder 4
   Inventory section 1. Eight sections (order and on/off from Settings > Dashboard layout):
   Overview (hero, Right now, KPI cards), Today, How the period went, Month by month, Car by car,
   Habits and customers, Fleet and papers, Cash. Money parts follow dashboard.see_revenue / see_profit /
   see_vehicle_performance. Every figure is worked out from the company's data (bookings, payments,
   expenses, jobs, papers, instalments, summons); months before the sample's bookings come from a made-up
   history built below (d.dashHist, d.dashHistExp), so the year charts and last-year comparisons have numbers.
   =================================================================== */

/* ---------------- made-up history: rentals and expenses from 1 Jan 2025 up to the sample's bookings ---------------- */
DATA_INIT.push(function (d, brand) {
  if (d.dashHist) return;
  var R = rng(5150 + brand.code.charCodeAt(0) * 7 + brand.code.charCodeAt(2)), ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var regulars = d.people.slice(0, Math.min(12, Math.floor(d.people.length / 2))), others = d.people.slice(regulars.length, regulars.length + 6), n = 0;
  d.dashHist = [];
  d.cars.forEach(function (c) {
    var mine = d.bookings.filter(function (x) { return x.car === c; }), first = mine.length ? Math.min.apply(0, mine.map(function (x) { return +x.start; })) : +TODAY;
    var t = new Date(2025, 0, 1 + ri(0, 4), 10);
    for (;;) {
      var y25 = t.getFullYear() === 2025, mo = t.getMonth(), busy = (y25 ? .5 : .62) + (mo === 0 || mo === 3 || mo === 5 || mo === 11 ? .12 : 0);
      var gap = R() < busy ? 0 : ri(1, 4), start = new Date(t.getTime() + gap * DAY); start.setHours(pick([9, 9, 10, 10, 11, 14, 16, 18]), 0, 0, 0);
      var dur = pick([1, 1, 2, 2, 2, 3, 3, 4, 5, 7]), end = new Date(start.getTime() + dur * DAY);
      if (end.getTime() >= first) break;
      var rate = Math.round(c.rate * (y25 ? .92 : 1)), deliv = R() < .4 ? pick([30, 40, 50]) : 0, cu = R() < .8 || !others.length ? pick(regulars) : pick(others);
      d.dashHist.push({ code: 'H-' + (++n), hist: true, car: c, cust: cu, start: start, end: end, days: dur, rent: rate * dur, deliv: deliv, ret: deliv && R() < .5 ? 30 : 0, dmg: R() < .3 ? 15 * dur : 0, others: 0, disc: R() < .1 ? 20 : 0,
        dep: c.deposit || brand.deposit, status: 'Completed', pay: 'Deposit Refunded', created: new Date(start.getTime() - ri(1, 10) * DAY) });
      t = new Date(end.getTime() + (R() < .35 ? 0 : DAY));
    }
  });
  /* expenses before the recorded ones start: fixed monthly costs and everyday spending */
  d.dashHistExp = [];
  var recFirst = d.expenses.length ? Math.min.apply(0, d.expenses.map(function (e) { return +e.day; })) : +TODAY;
  var fixedFrom = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1).getTime();
  var fixed = [['Office rent', 2800, 1], ['Salary and allowances', 9200, 28], ['Internet', 159, 5], ['Electricity and water', 400, 9], ['Marketing and ads', 550, 14], ['Software and subscriptions', 199, 2], ['Accounting and legal fees', 350, 20]];
  for (var m = 0; ; m++) {
    var ms = new Date(2025, m, 1); if (ms.getTime() >= fixedFrom) break;
    fixed.forEach(function (f) { d.dashHistExp.push({ t: new Date(2025, m, f[2]).getTime(), amount: Math.round(f[1] * (ms.getFullYear() === 2025 ? .9 : 1)), kind: f[0], car: null, src: 'recorded' }); });
  }
  for (var t2 = new Date(2025, 0, 1).getTime(); t2 < recFirst; t2 += DAY) {
    if (R() < .75) { var k = pick(['Fuel', 'Fuel', 'Toll', 'Car wash', 'Parking', 'Grab fare', 'Delivery and pick-up costs']); d.dashHistExp.push({ t: t2, amount: { Fuel: ri(40, 120), Toll: ri(4, 25), 'Car wash': ri(15, 35), Parking: ri(2, 12), 'Grab fare': ri(12, 45) }[k] || ri(20, 60), kind: k, car: R() < .7 ? pick(d.cars).id : null, src: 'recorded' }); }
    if (R() < .03) d.dashHistExp.push({ t: t2, amount: ri(15, 60) * 10, kind: 'Service and repair jobs', car: pick(d.cars).id, src: 'job' });
  }
});

/* ---------------- dates and numbers ---------------- */
function dshPhone() { try { return window.matchMedia('(max-width: 760px)').matches; } catch (e) { return false; } }
function dshD0(t) { var x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); }
function dshMonth(y, m) { return new Date(y, m, 1).getTime(); }
function dshK(v) { var a = Math.abs(v); return (v < 0 ? '-' : '') + (a >= 1e6 ? (Math.round(a / 1e5) / 10) + 'm' : a >= 1000 ? (Math.round(a / 100) / 10) + 'k' : String(Math.round(a))); }
function dshRmK(v) { return 'RM ' + dshK(v); }
function dshPct(now, before) { return before ? Math.round((now - before) / Math.abs(before) * 1000) / 10 : null; }
function dshLbl(t) { var d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()]; }
function dshHour(h) { return h === 0 ? '12 AM' : h < 12 ? h + ' AM' : h === 12 ? '12 PM' : (h - 12) + ' PM'; }
function dshLS(k, v) { try { if (v === undefined) return localStorage.getItem('fms.dash.' + k); localStorage.setItem('fms.dash.' + k, v); } catch (e) { return null; } return null; }

/* the period the hero and most figures are about, with the period it is compared with */
function dshPeriod(st) {
  var now = NOW(), t0 = dshD0(now), end = t0 + DAY, y = now.getFullYear(), m = now.getMonth(), p = st.period;
  var o = { key: p, gran: 'day' };
  if (p === 'today') { o.from = t0; o.to = end; o.cf = t0 - 7 * DAY; o.label = 'Today'; o.range = UI.fmt.short(now); o.cmp = 'the same day last week'; o.gran = 'hour'; }
  else if (p === '7d') { o.from = t0 - 6 * DAY; o.to = end; o.cf = o.from - 7 * DAY; o.label = '7 days'; o.range = dshLbl(o.from) + ' to ' + dshLbl(t0); o.cmp = 'the 7 days before'; }
  else if (p === 'last') { o.from = dshMonth(y, m - 1); o.to = dshMonth(y, m); o.cf = dshMonth(y, m - 2); o.ct = o.from; o.label = 'Last month'; o.range = dshLbl(o.from) + ' to ' + dshLbl(o.to - DAY); o.cmp = 'the month before'; }
  else if (p === 'year') { o.from = dshMonth(y, 0); o.to = end; o.cf = dshMonth(y - 1, 0); o.ct = new Date(y - 1, m, now.getDate() + 1).getTime(); o.label = 'This year'; o.range = '1 Jan to ' + dshLbl(t0); o.cmp = 'the same days last year'; o.gran = 'month'; }
  else if (p === 'dates' && st.from && st.to) {
    o.from = UI.parseDate(st.from).getTime(); o.to = UI.parseDate(st.to).getTime() + DAY; if (o.to <= o.from) o.to = o.from + DAY;
    var len = Math.round((o.to - o.from) / DAY); o.cf = o.from - len * DAY; o.label = 'Dates'; o.range = UI.fmt.date(new Date(o.from)) + ' to ' + UI.fmt.date(new Date(o.to - DAY)); o.cmp = 'the ' + plural(len, 'day') + ' before'; o.gran = len > 62 ? 'month' : 'day'; o.long = len > 366;
  } else { o.key = 'month'; o.from = dshMonth(y, m); o.to = end; o.cf = dshMonth(y, m - 1); o.ct = Math.min(o.cf + (o.to - o.from), o.from); o.label = 'This month'; o.range = dshLbl(o.from) + ' to ' + dshLbl(t0); o.cmp = 'the same days last month'; }
  if (o.ct == null) o.ct = o.cf + (o.to - o.from);
  o.edges = dshEdges(o.from, o.to, o.gran); o.cedges = dshEdges(o.cf, o.ct, o.gran, o.edges.length - 1);
  o.labels = o.edges.slice(0, -1).map(function (t) { var dd = new Date(t); return o.gran === 'hour' ? dshHour(dd.getHours()) : o.gran === 'month' ? MON[dd.getMonth()] : dshLbl(t); });
  o.days = Math.max(1, Math.round((Math.min(o.to, end) - o.from) / DAY)) || 1;
  return o;
}
/* bucket edges: [from, ..., to] by hour, day or month; count forces the number of buckets (for the compare period) */
function dshEdges(from, to, gran, count) {
  var e = [from], t = from, k = 0;
  while (count != null ? k < count : t < to) {
    var d = new Date(t);
    t = gran === 'hour' ? t + 36e5 : gran === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() : t + DAY;
    if (count == null && t > to) t = to;
    e.push(t); k++;
  }
  return e;
}
function dshIdx(edges, t) { if (t < edges[0] || t >= edges[edges.length - 1]) return -1; for (var k = 1; k < edges.length; k++) if (t < edges[k]) return k - 1; return -1; }

/* ---------------- the model: every rental cut into 24-hour blocks, every expense with its kind ---------------- */
/* only: leave out => the counted cars (Reports > Cars counted), or a list of car ids => just those cars */
function dshModel(d, only) {
  var keep = only ? function (id) { return only.indexOf(id) >= 0; } : function (id) { return typeof isCounted !== 'function' || isCounted(id, d); };
  var real = d.bookings.filter(function (x) { return x.status !== 'Pending' && x.status !== 'Cancelled' && keep(x.car.id); });
  var rentals = (d.dashHist || []).filter(function (b) { return keep(b.car.id); }).concat(real), blocks = [];
  rentals.forEach(function (b) {
    var n = Math.max(1, b.days || 1), rent = (b.rent - (b.disc || 0)) / n, dl = (b.deliv || 0) / n, rt = (b.ret || 0) / n, dm = (b.dmg || 0) / n, ot = (b.others || 0) / n;
    for (var k = 0; k < n; k++) blocks.push({ t: b.start.getTime() + k * DAY, car: b.car.id, b: b, rent: rent, deliv: dl, ret: rt, dmg: dm, other: ot, total: rent + dl + rt + dm + ot });
  });
  var cats = {}; d.expenseCats.forEach(function (c) { cats[c.id] = c.name; });
  var ex = allExpenses(d).map(function (e) { return { t: +e.day, amount: e.amount, kind: e.source === 'job' ? 'Service and repair jobs' : e.source === 'paper' ? 'Road tax, insurance and other papers' : cats[e.cat] || 'Other', car: e.car, src: e.source }; }).concat(d.dashHistExp || []).filter(function (e) { return e.car ? keep(e.car) : !only; });
  var firstSeen = {};
  rentals.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (b) { if (firstSeen[b.cust.id] == null) firstSeen[b.cust.id] = b.start.getTime(); });
  return { rentals: rentals, real: real, blocks: blocks, ex: ex, firstSeen: firstSeen, cars: d.cars.filter(function (c) { return keep(c.id) && (only || c.fleet !== 'Sold'); }) };
}
/* totals for [from, to) */
function dshAgg(M, from, to, carId) {
  var a = { income: 0, rent: 0, deliv: 0, ret: 0, dmg: 0, other: 0, days: 0, bookings: [], value: 0, length: 0, deposits: 0, exp: 0, jobs: 0, papers: 0, rec: 0, kinds: {}, byCar: {}, expCar: {}, daysCar: {}, bkCar: {} };
  M.blocks.forEach(function (x) {
    if (x.t < from || x.t >= to || (carId && x.car !== carId)) return;
    a.income += x.total; a.rent += x.rent; a.deliv += x.deliv; a.ret += x.ret; a.dmg += x.dmg; a.other += x.other; a.days++;
    a.byCar[x.car] = (a.byCar[x.car] || 0) + x.total; a.daysCar[x.car] = (a.daysCar[x.car] || 0) + 1;
  });
  M.rentals.forEach(function (b) {
    var t = b.start.getTime(); if (t < from || t >= to || (carId && b.car.id !== carId)) return;
    a.bookings.push(b); a.value += b.rent - (b.disc || 0) + (b.deliv || 0) + (b.ret || 0) + (b.dmg || 0) + (b.others || 0); a.length += b.days; a.bkCar[b.car.id] = (a.bkCar[b.car.id] || 0) + 1;
    if (!b.hist && b.received >= b.dep) a.deposits += b.dep; else if (b.hist) a.deposits += b.dep;
  });
  M.ex.forEach(function (e) {
    if (e.t < from || e.t >= to || (carId && e.car !== carId)) return;
    a.exp += e.amount; a.kinds[e.kind] = (a.kinds[e.kind] || 0) + e.amount; a.expCar[e.car || '-'] = (a.expCar[e.car || '-'] || 0) + e.amount;
    if (e.src === 'job') a.jobs++; else if (e.src === 'paper') a.papers++; else a.rec++;
  });
  var n = a.bookings.length; a.count = n; a.avgValue = n ? a.value / n : 0; a.avgLen = n ? a.length / n : 0;
  a.net = a.income - a.exp;
  return a;
}
/* a value for each bucket of edges: what = 'income' | 'count' | 'days' | 'exp' | function(block) */
function dshSeries(M, edges, what, carId) {
  var out = edges.slice(0, -1).map(function () { return 0; }), add = function (t, v) { var k = dshIdx(edges, t); if (k >= 0) out[k] += v; };
  if (what === 'count') M.rentals.forEach(function (b) { if (!carId || b.car.id === carId) add(b.start.getTime(), 1); });
  else if (what === 'exp') M.ex.forEach(function (e) { if (!carId || e.car === carId) add(e.t, e.amount); });
  else M.blocks.forEach(function (x) { if (!carId || x.car === carId) add(x.t, what === 'days' ? 1 : typeof what === 'function' ? what(x) : x.total); });
  return out;
}

/* ---------------- small SVG charts ---------------- */
function dshAxisFmt(money) { return money ? dshRmK : function (v) { return Math.abs(v) < 10 && v % 1 ? v.toFixed(1) : dshK(v); }; }
/* line chart: series [{name, values (null = not drawn), color, dash}], labels; hover shows every value */
function dshLine(o) {
  var nar = window.innerWidth < 620, W = nar ? 380 : (o.w || 640), H = o.h || 220, L = 50, Rr = 12, T = 12, Bt = 26, n = o.labels.length, fmt = o.fmt || dshAxisFmt(o.money);
  var all = []; o.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
  var hi = Math.max.apply(0, all.concat([0])), lo = Math.min.apply(0, all.concat([0])), max = niceMax(Math.max(hi, 1) * 1.08), min = lo < 0 ? -niceMax(-lo * 1.08) : 0;
  var x = function (k) { return L + (n === 1 ? (W - L - Rr) / 2 : k * (W - L - Rr) / (n - 1)); }, y = function (v) { return T + (H - T - Bt) * (1 - (v - min) / (max - min)); };
  var g = '';
  for (var k = 0; k <= 4; k++) { var v = min + (max - min) * k / 4; g += '<line class="vd-grid" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="vd-axis" x="' + (L - 7) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>'; }
  var step = Math.ceil(n / (nar ? 6 : 12));
  o.labels.forEach(function (lb, j) { if (j === n - 1 || (j % step === 0 && n - 1 - j >= step * .6)) g += '<text class="vd-axis' + (o.mark === j ? ' dsh-mark' : '') + '" x="' + x(j) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
  o.series.forEach(function (s, si) {
    var d2 = '', on = false;
    s.values.forEach(function (v, j) { if (v == null) { on = false; return; } d2 += (on ? ' L' : 'M') + x(j).toFixed(1) + ' ' + y(v).toFixed(1); on = true; });
    if (si === 0 && !s.dash && o.area !== false) { var vals = s.values.filter(function (v) { return v != null; }); if (vals.length > 1) { var lastK = s.values.length - 1; while (s.values[lastK] == null) lastK--; g += '<path d="' + d2 + ' L' + x(lastK) + ' ' + y(Math.max(0, min)) + ' L' + x(0) + ' ' + y(Math.max(0, min)) + 'Z" fill="' + s.color + '" opacity=".12"/>'; } }
    g += '<path ' + (s.dash ? '' : 'class="vd-draw" pathLength="1" ') + 'd="' + d2 + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.dash ? 1.6 : 2.6) + '"' + (s.dash ? ' stroke-dasharray="5 5" opacity=".85"' : '') + ' stroke-linejoin="round" stroke-linecap="round"/>';
    if (n <= 31 && !s.dash) s.values.forEach(function (v, j) { if (v != null && (n <= 12 || j === n - 1)) g += '<circle cx="' + x(j) + '" cy="' + y(v) + '" r="3.2" fill="' + s.color + '"/>'; });
  });
  /* hover zones */
  var bw = n > 1 ? (W - L - Rr) / (n - 1) : W - L - Rr;
  o.labels.forEach(function (lb, j) { g += '<rect class="dsh-hit" x="' + (x(j) - bw / 2).toFixed(1) + '" y="' + T + '" width="' + bw.toFixed(1) + '" height="' + (H - T - Bt) + '"><title>' + esc((o.tips ? o.tips[j] : lb) + '\n' + o.series.map(function (s) { return s.name + ': ' + (s.values[j] == null ? 'not yet' : (o.full || fmt)(s.values[j])); }).join('\n')) + '</title></rect>'; });
  return '<div class="vd-chart dsh-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Line chart') + '">' + g + '</svg></div>';
}
/* bar chart: series [{key, name, values, color}], stacked, hidden {key:true}, line {name, values, color}, future (index of the first future bucket), legend id for click-to-hide */
function dshBars(o) {
  var nar = window.innerWidth < 620, W = nar ? 380 : (o.w || 560), H = o.h || 230, L = 50, T = 10, Bt = 24, n = o.labels.length, hid = o.hidden || {}, fmt = o.fmt || dshAxisFmt(o.money);
  var ser = o.series.filter(function (s) { return !hid[s.key]; });
  var tops = o.labels.map(function (_, k) { return o.stacked ? ser.reduce(function (a, s) { return a + Math.max(0, s.values[k] || 0); }, 0) : Math.max.apply(0, ser.map(function (s) { return s.values[k] || 0; }).concat([0])); });
  var lows = o.line ? o.line.values.filter(function (v) { return v != null; }) : [];
  var max = niceMax(Math.max.apply(0, tops.concat(lows).concat([1])) * 1.06), min = Math.min.apply(0, lows.concat([0])) < 0 ? -niceMax(-Math.min.apply(0, lows) * 1.1) : 0;
  var y = function (v) { return T + (H - T - Bt) * (1 - (v - min) / (max - min)); }, bw = (W - L - 6) / n, g = '';
  for (var k = 0; k <= 4; k++) { var v = min + (max - min) * k / 4; g += '<line class="vd-grid" x1="' + L + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="vd-axis" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>'; }
  o.labels.forEach(function (lb, j) {
    var x0 = L + j * bw + bw * .15, inner = bw * .7, acc = 0, fut = o.future != null && j >= o.future;
    ser.forEach(function (s, si) {
      var val = Math.max(0, s.values[j] || 0), tip = esc(lb + ', ' + s.name + ': ' + (o.full || fmt)(s.values[j] || 0) + (fut ? ' (booked ahead)' : ''));
      if (o.stacked) { g += '<rect x="' + x0.toFixed(1) + '" y="' + y(acc + val).toFixed(1) + '" width="' + inner.toFixed(1) + '" height="' + Math.max(0, y(acc) - y(acc + val)).toFixed(1) + '" fill="' + s.color + '"' + (fut ? ' opacity=".4"' : '') + '><title>' + tip + '</title></rect>'; acc += val; }
      else { var w = inner / ser.length; g += '<rect x="' + (x0 + si * w).toFixed(1) + '" y="' + y(val).toFixed(1) + '" width="' + Math.max(1, w - 1.5).toFixed(1) + '" height="' + Math.max(0, y(Math.max(0, min)) - y(val)).toFixed(1) + '" rx="2" fill="' + s.color + '"' + (fut ? ' opacity=".4"' : '') + '><title>' + tip + '</title></rect>'; }
    });
    if (n <= 16 || j % Math.ceil(n / 12) === 0) g += '<text class="vd-axis' + (o.mark === j ? ' dsh-mark' : '') + '" x="' + (x0 + inner / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lb) + '</text>';
  });
  if (o.line && !hid[o.line.key]) {
    var pts = o.line.values.map(function (v, j) { return v == null ? null : (L + j * bw + bw / 2).toFixed(1) + ' ' + y(v).toFixed(1); }).filter(Boolean);
    g += '<path d="M' + pts.join(' L') + '" fill="none" stroke="' + o.line.color + '" stroke-width="2.4"/>' + pts.map(function (p) { var q = p.split(' '); return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3" fill="' + o.line.color + '"/>'; }).join('');
  }
  var legItems = o.series.concat(o.line ? [o.line] : []);
  var legend = legItems.length > 1 || o.legendId ? '<div class="dsh-leg" role="group" aria-label="Show or hide a part">' + legItems.map(function (s) { var off = hid[s.key]; return o.legendId ? '<button type="button" class="dsh-legi" data-leg="' + esc(o.legendId) + '" data-k="' + esc(s.key) + '" aria-pressed="' + !off + '"><i style="background:' + s.color + '"></i>' + esc(s.name) + '</button>' : '<span class="dsh-legi"><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>' : '';
  return legend + '<div class="vd-chart dsh-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Bar chart') + '">' + g + '</svg></div>';
}
function dshSeg(name, items, cur, cls) { return '<div data-srow class="vd-seg dsh-seg' + (cls ? ' ' + cls : '') + '" role="group" aria-label="' + esc(name) + '">' + items.map(function (it) { return '<button type="button" data-seg="' + esc(name) + '" data-v="' + esc(it[0]) + '" aria-pressed="' + (String(cur) === String(it[0])) + '">' + esc(it[1]) + '</button>'; }).join('') + '</div>'; }
function dshChange(now, before, goodUp, label) {
  var pc = dshPct(now, before);
  if (pc == null) return '<span class="row gap6 wrap"><span class="vd-chip">New</span>' + (label ? '<span class="vd-chip-note">' + esc(label) + '</span>' : '') + '</span>';
  var up = pc >= 0, good = goodUp ? up : !up;
  return '<span class="row gap6 wrap"><span class="vd-chip" data-good="' + (pc === 0 ? '' : good) + '">' + i(up ? 'arrow-up-right' : 'arrow-down-right') + (up ? '+' : '') + (Math.abs(pc) >= 100 ? Math.round(pc) : pc) + '%</span>' + (label ? '<span class="vd-chip-note">' + esc(label) + '</span>' : '') + '</span>';
}
var DSH_KIND_COLORS = ['#3b82f6', '#f97316', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#06b6d4', '#9ca3af'];

/* ---------------- the page ---------------- */
PAGES['dashboard'] = {
  title: 'Dashboard',
  search: [{ label: 'Dashboard: try a refresh that fails (sample)', icon: 'wifi-off', hint: 'Shows the warning and Try again', run: function (ctx) { if (ctx && ctx.state) { ctx.state.failNext = true; ctx.refresh(); setTimeout(function () { var b = document.querySelector('.pg-dashboard [data-act="refresh"]'); if (b) b.click(); }, 60); } } }],
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data, b = ctx.brand;
    st.tables = st.tables || {}; st.hidden = st.hidden || {}; st.more = st.more || {};
    if (!st.period) { st.period = dshLS('period') || 'month'; st.from = dshLS('from') || ''; st.to = dshLS('to') || ''; if (st.period === 'dates' && !(st.from && st.to)) st.period = 'month'; }
    st.year = st.year || NOW().getFullYear(); st.carMetric = st.carMetric || 'revenue'; st.idle = st.idle || 7; st.fleetTab = st.fleetTab || 'out';
    st.weekMode = st.weekMode || 'pickups'; st.topBy = st.topBy || 'income'; st.monthsMetric = st.monthsMetric || 'bookings'; st.updated = st.updated || NOW();
    var can0 = ctx.can, V = { rev: can0('dashboard.see_revenue'), prof: can0('dashboard.see_profit'), veh: can0('dashboard.see_vehicle_performance') };
    V.any = V.rev && V.prof && V.veh;

    function draw(opts) {
      var M = dshModel(d), P = dshPeriod(st), A = dshAgg(M, P.from, P.to), C = dshAgg(M, P.cf, P.ct);
      st.phone = dshPhone();
      var offIds = ((CO(d) || {}).carsNotCounted || []).filter(function (id) { return carById(id); });
      M.off = offIds.length ? dshModel(d, offIds) : null;
      var layout = (d.settings.dashLayout || LISTS.dashSections.map(function (s) { return { id: s[0], on: true }; })).filter(function (s) { return s.on; }).map(function (s) { return s.id; });
      var parts = { overview: secOverview, today: secToday, period: secPeriod, months: secMonths, cars: secCars, habits: secHabits, fleet: secFleet, cash: secCash };
      var chips = { today: 'Today', period: 'This period', months: 'Month by month', cars: 'Car by car', habits: 'Habits and customers', fleet: 'Fleet and papers', cash: 'Cash' };
      var shown = layout.filter(function (id) { return parts[id] && (id !== 'cash' || V.rev) && (id !== 'cars' || V.veh || true); });
      var hr = NOW().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening', u = ctx.me;
      var html = '<div class="vd dsh">' +
        '<div class="col gap16"><div class="vd-head"><div><h1 class="h4">' + greet + ', ' + esc((u ? u.name : b.owner).split(' ')[0]) + '</h1><div class="muted">' + UI.fmt.long(NOW()) + '</div></div>' +
        '<div class="row wrap gap8 dsh-quick"><span class="cap">Updated ' + tm(st.updated) + ' · refreshes every minute</span>' +
        (can0('billing.record_payment') ? UI.btn('Upload payment slip', { kind: 'tonal', size: 'sm', icon: 'receipt', attrs: { 'data-act': 'slip' } }) : '') +
        (can0('expenses.view') && typeof ctx.api.bankIn === 'function' ? UI.btn('Bank in cash', { kind: 'tonal', size: 'sm', icon: 'building-bank', attrs: { 'data-act': 'bankin' } }) : '') +
        (can0('expenses.add') || can0('expenses.add_business') ? UI.btn('Add expense', { kind: 'tonal', size: 'sm', icon: 'receipt-2', attrs: { 'data-act': 'expense' } }) : '') +
        UI.btn('Refresh', { kind: 'o', size: 'sm', icon: 'refresh', attrs: { 'data-act': 'refresh' } }) + '</div></div>' +
        (st.busy ? '<div class="dsh-busy" role="progressbar" aria-label="Refreshing"><i></i></div>' : '') +
        (st.failed ? UI.alert('Could not refresh just now. Showing the last numbers we had.', 'warn', { action: UI.btn('Try again', { kind: 't', size: 'sm', attrs: { 'data-act': 'refresh' } }) }) : '') +
        '<nav class="vd-navs" data-srow aria-label="Parts of the page">' + shown.filter(function (id) { return chips[id]; }).map(function (id) { return '<button type="button" class="vd-navchip" data-jump="dsh-' + id + '">' + chips[id] + '</button>'; }).join('') + '</nav></div>' +
        (st.phone ? phoneOrder(shown).map(function (id) { return id === 'now' ? secOverview(M, P, A, C, 'now') : id === 'overview' ? secOverview(M, P, A, C, 'figures') : FOLDS.indexOf(id) >= 0 && !st.open[id] ? folded(id, chips[id]) : parts[id](M, P, A, C); }).join('')
          : shown.map(function (id) { return parts[id](M, P, A, C); }).join('')) +
        (V.any ? '' : '<p class="b2 dsh-hiddencap">' + i('lock') + ' Some parts are not shown because your login does not include them.</p>') +
        (st.follow && carById(st.follow) ? '<div class="dsh-follow" role="status">' + i('target-arrow') + '<span>Following <b>' + esc(carById(st.follow).plate) + '</b> in the car charts</span>' + UI.btn('Open car', { kind: 't', size: 'sm', attrs: { 'data-act': 'opencar', 'data-v': st.follow } }) + UI.iconBtn('x', 'Stop following', { size: 'sm', attrs: { 'data-act': 'unfollow' } }) + '</div>' : '') +
        '</div>';
      root.innerHTML = html;
      if (opts && opts.count) countUp();
    }

    /* ---------- phones: Right now (with Needs you) and Today first, the analysis parts folded behind the jump buttons ---------- */
    var FOLDS = ['period', 'months', 'cars', 'habits', 'fleet', 'cash'];
    st.open = st.open || {};
    function phoneOrder(shown) {
      var first = (shown.indexOf('overview') >= 0 ? ['now'] : []).concat(shown.indexOf('today') >= 0 ? ['today'] : []);
      return first.concat(shown.indexOf('overview') >= 0 ? ['overview'] : []).concat(shown.filter(function (id) { return id !== 'today' && id !== 'overview'; }));
    }
    function folded(id, title) {
      return '<section class="dsh-sec dsh-fold" id="dsh-' + id + '"><button type="button" class="dsh-foldb" data-act="unfold" data-v="' + id + '" aria-expanded="false"><span class="grow"><b>' + esc(title) + '</b><small>Tap to show</small></span>' + i('chevron-down') + '</button></section>';
    }
    /* ---------- cars left out of the figures (Reports > Cars counted): their own numbers ---------- */
    function notCounted(M, kind, from, to, label) {
      var O = M.off; if (!O) return '';
      var Ao = dshAgg(O, from, to), plates = O.cars.map(function (c) { return '<span class="chip dsh-ncp" title="' + esc(carName(c)) + '">' + esc(c.plate) + (c.fleet === 'Sold' ? ' <small>sold</small>' : '') + '</span>'; }).join('');
      var fig = function (lab, val) { return '<div class="dsh-ncf"><span class="b2">' + esc(lab) + '</span><b class="num">' + val + '</b></div>'; };
      var figs = (V.rev ? fig('Income', UI.fmt.money(Ao.income)) : '') + fig('Bookings', n0(Ao.count)) + fig('Rental days', n0(Ao.days)) + (V.prof ? fig('Expenses', UI.fmt.money(Ao.exp)) + fig('Net result', UI.fmt.money(Ao.net)) : '');
      return card({ id: 'nc-' + kind, icon: 'eye-off', cls: 'dsh-nc', title: 'Cars not counted', sub: 'Left out of every figure on this page. Their own numbers for ' + label + '.',
        actions: '<button type="button" class="btn t sm" data-act="notcounted">' + (can0('reports.choose_cars') ? 'Change' : 'See the list') + '</button>',
        body: '<div class="dsh-ncplates">' + plates + '</div><div class="dsh-ncfigs">' + figs + '</div>' });
    }

    /* ---------- card helper: title, optional chart/table toggle ---------- */
    function card(o) {
      var tb = o.table && st.tables[o.id];
      var tblHtml = tb ? '<div class="dsh-tbl"><table class="tbl"><thead><tr>' + o.table.cols.map(function (c, k) { return '<th' + (k ? ' class="r"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + o.table.rows.map(function (r) { return '<tr>' + r.map(function (c, k) { return '<td' + (k ? ' class="r num"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '';
      return '<div class="card dsh-card' + (o.cls ? ' ' + o.cls : '') + '" id="dc-' + o.id + '"><div class="dsh-ch">' + (o.icon ? i(o.icon, 'dsh-ci') : '') + '<div class="grow"><h3>' + esc(o.title) + '</h3>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>' + (o.actions || '') +
        (o.table ? UI.iconBtn(tb ? 'chart-bar' : 'table', tb ? 'Show as a chart' : 'Show as a table', { size: 'sm', attrs: { 'data-act': 'table', 'data-v': o.id } }) : '') + '</div>' +
        '<div class="dsh-cb">' + (tb ? tblHtml : o.body) + '</div>' + (o.foot ? '<div class="dsh-cf b2">' + o.foot + '</div>' : '') + '</div>';
    }
    function chapter(id, title, sub, actions) { return '<section class="col gap24 dsh-sec" id="dsh-' + id + '"><div class="vd-chapter"><div><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div>' + (actions || '') + '</div>'; }
    var money = function (v) { return UI.fmt.money(v); };
    var carLbl = function (c) { return c.serial + '. ' + c.model.split(' ')[0] + ' ' + c.color; };

    /* ---------- needs-you groups (used by Right now and Today) ---------- */
    function needs() {
      var now = NOW(), t0 = dshD0(now), live = d.bookings.filter(function (x) { return x.status !== 'Cancelled'; });
      var hasInv = {}; d.invoices.forEach(function (v) { if (v.status !== 'Void') hasInv[v.booking] = 1; });
      var pickup = function (x) { return 'Pick-up ' + UI.fmt.day(x.start) + ', ' + tm(x.start); };
      var g = [
        { key: 'late', icon: 'clock-exclamation', tone: 'error', title: 'Car not back yet', sub: 'The return time has passed and the car is still with the customer.', rows: live.filter(function (x) { return x.status === 'Car Delivered' && x.end < now; }).map(function (x) { var h = Math.round((now - x.end) / 36e5); return { b: x, note: h >= 24 ? plural(Math.floor(h / 24), 'day') + ' late' : plural(Math.max(1, h), 'hour') + ' late', bad: true }; }) },
        { key: 'unsigned', icon: 'signature', tone: 'warn', title: 'Agreement sent, not signed yet', sub: 'Remind the customer to sign before pick-up.', rows: live.filter(function (x) { return x.status === 'Agreement Sent' && x.start > now - DAY; }).sort(function (a, c) { return a.start - c.start; }).map(function (x) { return { b: x, note: pickup(x) }; }) },
        { key: 'deposit', icon: 'cash-off', tone: 'warn', title: 'Deposit not received, pick-up is close', sub: 'Pick-up is within 2 days (or already started) and the deposit is not marked as received.', rows: live.filter(function (x) { return ['Pending', 'Confirmed', 'Agreement Sent', 'Agreement Signed'].indexOf(x.status) >= 0 && (x.pay === 'Deposit due' || !x.pay) && x.start < now + 2 * DAY; }).map(function (x) { return { b: x, note: pickup(x) }; }) },
        { key: 'invoice', icon: 'file-invoice', tone: 'warn', title: 'No invoice yet', sub: 'Confirmed bookings starting within a week that have no invoice.', rows: live.filter(function (x) { return x.status !== 'Pending' && x.status !== 'Completed' && x.status !== 'Car Returned' && !hasInv[x.code] && x.start < now + 7 * DAY && x.start > now - 7 * DAY; }).map(function (x) { return { b: x, note: pickup(x) }; }) },
        { key: 'refund', icon: 'arrow-back-up', tone: 'warn', title: 'Deposits waiting to be given back', sub: 'The car is back. Give back the deposit less any deductions.', rows: d.deposits.filter(function (z) { return !z.refund && !z.markedByHand; }).map(function (z) { var x = findBooking(z.booking); return x ? { b: x, note: 'Back ' + UI.fmt.day(x.end) + ' · ' + UI.fmt.money(x.dep - sum(z.deductions.map(function (q) { return q.amount; }))) + ' to give back', go: ['deposits', { booking: x.code }] } : null; }).filter(Boolean) },
        { key: 'inst', icon: 'calendar-dollar', tone: 'error', title: 'Car instalments overdue', sub: 'The due date has passed and the instalment is not marked as paid.', rows: d.instalments.filter(function (it) { return !it.paid && it.due < t0; }).map(function (it) { var c = carById(it.car); return { label: c.plate + ' · ' + carLbl(c), sub: 'Due ' + UI.fmt.date(it.due) + ' · ' + UI.fmt.money(it.amount), note: plural(Math.round((t0 - dshD0(it.due)) / DAY), 'day') + ' late', bad: true, go: ['instalments', {}] }; }) },
        { key: 'service', icon: 'alert-triangle', tone: 'error', title: 'Services or papers overdue', sub: 'A service is past its due date or distance, or a paper has run out.', rows: dshDue(d).filter(function (r) { return r.left < 0; }).map(function (r) { return { label: r.car.plate + ' · ' + r.what, sub: r.kind === 'paper' ? 'Ran out ' + UI.fmt.date(r.when) : 'Was due ' + UI.fmt.date(r.when), note: plural(-r.left, 'day') + ' overdue', bad: true, go: ['maintenance', { car: r.car.id }] }; }) },
        { key: 'summons', icon: 'gavel', tone: 'error', title: 'Summons with no booking', sub: 'Nobody can be charged until you find out who had the car.', rows: d.summons.filter(function (s) { return !s.booking && ['Waived', 'Paid', 'Disputed'].indexOf(s.status) < 0 && !(s.candidates && s.candidates.length > 1); }).map(function (s) { return { label: (s.authority + ' ' + (s.notice || 'notice')) + ' · ' + (s.plate || 'Plate not read'), sub: s.offence, note: UI.fmt.money(s.fine), bad: true, sid: s.id }; }) }
      ];
      if (!can0('summons.view')) g.pop();
      return g;
    }

    /* ---------- 1. Overview ---------- */
    function secOverview(M, P, A, C, part) {
      var rev = V.rev, vals = dshSeries(M, P.edges, rev ? 'income' : 'count'), prev = dshSeries(M, P.cedges, rev ? 'income' : 'count');
      var t0 = dshD0(NOW()), tEnd = t0 + DAY;
      /* buckets after now are not drawn */
      vals = vals.map(function (v, k) { return P.edges[k] >= tEnd || (P.gran === 'hour' && P.edges[k] > NOW()) ? null : v; });
      var drawn = vals.filter(function (v) { return v != null; }), total = rev ? A.income : A.count, ptotal = rev ? C.income : C.count;
      var best = -1; drawn.forEach(function (v, k) { if (best < 0 || v > drawn[best]) best = k; });
      var noun = P.gran === 'hour' ? 'hour' : P.gran, fmtV = rev ? money : function (v) { return n0(v); };
      var segs = [['today', 'Today'], ['7d', '7 days'], ['month', 'This month'], ['last', 'Last month'], ['year', 'This year'], ['dates', 'Dates']];
      var tips = P.edges.slice(0, -1).map(function (t, k) { var x = new Date(t), c = new Date(P.cedges[k] || t); return P.gran === 'hour' ? dshHour(x.getHours()) : P.gran === 'month' ? MONTHS[x.getMonth()] + ' ' + x.getFullYear() + ' (before: ' + MON[c.getMonth()] + ' ' + c.getFullYear() + ')' : WD[x.getDay()] + ' ' + dshLbl(t) + ' (before: ' + WD[c.getDay()] + ' ' + dshLbl(+c) + ')'; });
      var chart = total || ptotal ? dshLine({ labels: P.labels, tips: tips, series: [{ name: 'This period', values: vals, color: 'var(--vd-revenue)' }, { name: 'Before', values: prev, color: 'var(--vd-ink2)', dash: true }], money: rev, full: fmtV, h: 240, label: (rev ? 'Income' : 'Bookings') + ' for each ' + noun }) : '<div class="dsh-hollow">' + (rev ? 'No income in this period yet.' : 'No bookings in this period yet.') + '</div>';
      var heroTbl = '<div class="dsh-herotbl"><table><thead><tr><th>' + (P.gran === 'month' ? 'Month' : P.gran === 'hour' ? 'Hour' : 'Date') + '</th><th>' + (rev ? 'Income' : 'Bookings') + '</th><th>Before</th></tr></thead><tbody>' + P.labels.map(function (lb, k) { return '<tr><td>' + esc(tips[k].split(' (')[0]) + '</td><td>' + (vals[k] == null ? '-' : fmtV(vals[k])) + '</td><td>' + fmtV(prev[k] || 0) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      var bestLbl = best < 0 ? '' : tips[best].split(' (')[0];
      var hero = '<div class="vd-card vd-hero vd-rise dsh-hero" id="dsh-period-hero"><div class="vd-hero-body">' +
        '<div class="vd-hero-top"><div><span class="vd-kicker">' + (rev ? 'Income' : 'Bookings') + '</span><span class="vd-hero-range">' + esc(P.label + ' · ' + P.range) + '</span></div>' +
        '<div class="vd-seg" data-srow role="group" aria-label="Period">' + segs.map(function (s) { return '<button type="button" data-act="period" data-v="' + s[0] + '" aria-pressed="' + (P.key === s[0]) + '">' + s[1] + (s[0] === 'dates' ? ' ' + i('calendar', 'dsh-cal') : '') + '</button>'; }).join('') + '</div></div>' +
        (P.long ? '<div class="dsh-herowarn">' + i('alert-triangle') + 'That is more than a year. The figures are right, the chart shows months.</div>' : '') +
        '<div class="vd-hero-figure"><span class="vd-hero-value num" data-count="' + total + '" data-money="' + (rev ? 1 : 0) + '">' + fmtV(total) + '</span>' + dshChange(total, ptotal, true, 'vs ' + P.cmp) + '</div>' +
        (st.heroTable ? heroTbl : chart) +
        '<div class="vd-hero-foot"><div class="vd-legend"><span><i class="ln"></i>This period</span><span><i class="ds"></i>Before: ' + esc(P.cmp) + '</span></div><button type="button" class="ib sm dsh-heroib" data-act="herotable" aria-label="' + (st.heroTable ? 'Show as a chart' : 'Show as a table') + '" title="' + (st.heroTable ? 'Show as a chart' : 'Show as a table') + '">' + i(st.heroTable ? 'chart-line' : 'table') + '</button></div>' +
        '<div class="vd-facts"><div class="vd-fact"><span class="vd-fact-label">Best ' + noun + '</span><span class="vd-fact-value">' + (best < 0 ? '-' : fmtV(drawn[best])) + '</span><span class="vd-fact-note">' + esc(bestLbl) + '</span></div>' +
        '<div class="vd-fact"><span class="vd-fact-label">Average a ' + (P.gran === 'month' ? 'month' : 'day') + '</span><span class="vd-fact-value">' + fmtV(P.gran === 'month' ? total / Math.max(1, drawn.length) : total / P.days) + '</span><span class="vd-fact-note">over ' + (P.gran === 'month' ? plural(drawn.length, 'month') : plural(P.days, 'day')) + '</span></div>' +
        '<div class="vd-fact"><span class="vd-fact-label">Before</span><span class="vd-fact-value">' + fmtV(ptotal) + '</span><span class="vd-fact-note">' + esc(P.cmp) + '</span></div></div></div></div>';

      /* right now */
      var now = NOW(), cars = d.cars.filter(function (c) { return c.fleet !== 'Sold'; }), out = d.bookings.filter(function (x) { return x.status === 'Car Delivered'; });
      var work = cars.filter(function (c) { return c.inWorkshop; }).length, free = Math.max(0, cars.length - out.length - work);
      var startsToday = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start >= t0 && x.start < tEnd; });
      var endsToday = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.end >= t0 && x.end < tEnd; });
      var toGo = startsToday.filter(function (x) { return ['Car Delivered', 'Car Returned', 'Completed'].indexOf(x.status) < 0; }).length, toBack = endsToday.filter(function (x) { return x.status === 'Car Delivered'; }).length;
      var N = needs(), anyN = N.some(function (g) { return g.rows.length; });
      var nowCard = '<div class="vd-card vd-now vd-rise" style="--i:1"><h2>' + (out.length ? '<span class="vd-live"></span>' : i('bolt')) + 'Right now</h2><div class="vd-now-tiles">' +
        [['Cars out now', out.length, free + ' free, ' + work + ' in the workshop', 'road', 'dsh-fleet'], ['Going out today', toGo, plural(startsToday.length, 'pick-up') + ' in all', 'key', 'dsh-today'], ['Coming back today', toBack, plural(endsToday.length, 'return') + ' in all', 'arrow-back-up', 'dsh-today']].map(function (t, k) {
          return '<button type="button" class="vd-now-tile" data-jump="' + t[4] + '">' + i(t[3], 'vd-now-icon') + '<span class="vd-now-text"><span class="vd-now-label">' + t[0] + '</span><span class="vd-now-hint">' + t[2] + '</span></span><span class="vd-now-value">' + t[1] + '</span></button>';
        }).join('') + '</div><div class="col gap4"><div class="ovl">Needs you</div>' +
        (anyN ? '<ul class="vd-now-alerts">' + N.filter(function (g) { return g.rows.length; }).map(function (g) { return '<li><button type="button" class="vd-now-alert" data-tone="' + (g.tone === 'error' ? 'error' : 'warn') + '" data-jump="dsh-att-' + g.key + '">' + i(g.icon) + '<span>' + esc(g.title) + '</span><b>' + g.rows.length + '</b></button></li>'; }).join('') + '</ul>'
          : '<div class="dsh-clear">' + i('circle-check') + 'All clear. Nothing needs you right now.</div>') + '</div></div>';

      /* KPI cards */
      var cl = 'vs ' + P.cmp, sp = function (what) { return spark(dshSeries(M, P.edges, what).map(function (v) { return v || 0; }), 'var(--hue)'); };
      var utilA = A.days / Math.max(1, M.cars.length * P.days) * 100, utilC = C.days / Math.max(1, M.cars.length * P.days) * 100;
      var defs = {
        'Expenses': 'Finished service and repair jobs, papers issued (road tax, insurance and others) and everything recorded on the Expenses page, in the period.',
        'Net result': 'Income less expenses.', 'Bookings': 'Bookings that start in the period, not counting pending and cancelled ones.',
        'Fleet utilisation': 'The share of the car days in the period that were rented.', 'Average booking value': 'What a booking that starts in the period brings in, without the deposit.',
        'Rental days': 'Days rented in the period. Each rental is cut into 24-hour blocks from its pick-up time.', 'Average rental length': 'How many days a rental that starts in the period lasts.',
        'Rental income': 'Daily rent less discounts.', 'Delivery fee': 'Delivery charges.', 'Return fee': 'Return charges.', 'Damage coverage': 'Damage cover sold with the rentals.', 'Other charges': 'Other charges added to bookings.',
        'Deposits held': 'Security deposits taken for bookings that start in the period. They are held, not income.'
      };
      var k1 = [], k2 = [];
      if (V.prof) {
        k1.push(['Expenses', money(A.exp), dshChange(A.exp, C.exp, false, cl), '<span class="vd-chip-note">' + plural(A.jobs, 'job') + ', ' + plural(A.papers, 'paper') + ', ' + A.rec + ' recorded</span>', 'expense']);
        k1.push(['Net result', money(A.net), dshChange(A.net, C.net, true, cl), '<span class="vd-chip-note">Income less expenses.</span>', 'net']);
      }
      k1.push(['Bookings', n0(A.count), dshChange(A.count, C.count, true, cl), sp('count'), 'count']);
      k1.push(['Fleet utilisation', utilA.toFixed(1) + '%', dshChange(utilA, utilC, true, cl), sp('days'), 'count']);
      if (V.rev) k1.push(['Average booking value', money(A.avgValue), dshChange(A.avgValue, C.avgValue, true, cl), sp('income'), 'revenue']);
      k2.push(['Rental days', n0(A.days), dshChange(A.days, C.days, true, cl)]);
      k2.push(['Average rental length', A.avgLen.toFixed(1) + ' days', dshChange(A.avgLen, C.avgLen, true, cl)]);
      if (V.rev) [['Rental income', 'rent'], ['Delivery fee', 'deliv'], ['Return fee', 'ret'], ['Damage coverage', 'dmg'], ['Other charges', 'other'], ['Deposits held', 'deposits']].forEach(function (q) { k2.push([q[0], money(A[q[1]]), A[q[1]] || C[q[1]] ? dshChange(A[q[1]], C[q[1]], true, cl) : '']); });
      var kpi = function (k, j, small) { return '<div class="vd-kpi vd-rise vd-h-' + (k[4] || 'revenue') + (small ? ' dsh-kpi-sm' : '') + '" style="--i:' + j + '"><span class="lab">' + esc(k[0]) + ' <button type="button" class="dsh-info" data-act="info" data-v="' + esc(defs[k[0]] || '') + '" aria-label="What is ' + esc(k[0]) + '?" title="' + esc(defs[k[0]] || '') + '">' + i('info-circle') + '</button></span><span class="vd-kpi-value num">' + k[1] + '</span>' + (k[2] || '') + (k[3] || '') + '</div>'; };
      var warn = M.cars.filter(function (c) { return !c.rate; }).length ? UI.alert(plural(M.cars.filter(function (c) { return !c.rate; }).length, 'car') + ' have no daily rate, so their days count but their income does not.', 'warn') : '';
      if (part === 'now') return '<section class="col gap24 dsh-sec" id="dsh-now">' + nowCard + '</section>';
      return '<section class="col gap24 dsh-sec" id="dsh-overview"><div class="vd-top' + (part === 'figures' ? ' dsh-top1' : '') + '">' + hero + (part === 'figures' ? '' : nowCard) + '</div>' + warn +
        '<div class="vd-kpi-grid dsh-k1" style="--n:' + k1.length + '">' + k1.map(function (k, j) { return kpi(k, j); }).join('') + '</div>' +
        '<div class="dsh-k2">' + k2.map(function (k, j) { return kpi(k, j, true); }).join('') + '</div>' +
        (V.prof ? '<p class="b2 dsh-note">Expenses are the finished service and repair jobs from Maintenance, the price entered on road tax, insurance and other papers (counted on the day the paper was issued), and everything recorded on the Expenses page (counted on the day the money was spent). A cost that is on a service job or a paper should not also be recorded there, so nothing is counted twice. This period: ' + plural(A.jobs, 'finished job') + ', ' + plural(A.papers, 'paper') + ' and ' + plural(A.rec, 'entry').replace('entrys', 'entries') + ' on the Expenses page.</p>' : '') +
        '</section>';
    }

    /* ---------- 2. Today ---------- */
    function secToday(M, P) {
      var t0 = dshD0(NOW()), tEnd = t0 + DAY;
      var row = function (x, kind) {
        var t = kind === 'out' ? x.start : x.end, done = kind === 'out' ? ['Car Delivered', 'Car Returned', 'Completed'].indexOf(x.status) >= 0 : ['Car Returned', 'Completed'].indexOf(x.status) >= 0;
        return '<button type="button" class="dsh-trow' + (done ? ' done' : '') + '" data-open="' + x.code + '"><span class="dsh-tt">' + tm(t) + '</span><span class="grow"><b>' + esc(x.cust.name) + '</b><span class="b2">' + x.code + ' · ' + esc(x.car.plate) + ' · ' + esc(carLbl(x.car)) + '</span>' + (x.pay ? '<span class="dsh-pay" style="color:' + (UI.STATUS.payment[x.pay] || 'inherit') + '">' + esc(x.pay) + '</span>' : '') + '</span>' + (done ? UI.chip(kind === 'out' ? 'Handed over' : 'Back', 'ok', { icon: 'check' }) : UI.status('booking', x.status)) + '</button>';
      };
      var outs = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start >= t0 && x.start < tEnd; }).sort(function (a, c) { return a.start - c.start; });
      var backs = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.end >= t0 && x.end < tEnd; }).sort(function (a, c) { return a.end - c.end; });
      var left1 = outs.filter(function (x) { return ['Car Delivered', 'Car Returned', 'Completed'].indexOf(x.status) < 0; }).length, left2 = backs.filter(function (x) { return x.status === 'Car Delivered'; }).length;
      var N = needs(), tot = sum(N.map(function (g) { return g.rows.length; }));
      var groups = N.map(function (g) {
        if (!g.rows.length) return '';
        var lim = st.more[g.key] ? g.rows.length : 3;
        return '<div class="dsh-att" id="dsh-att-' + g.key + '"><div class="dsh-att-h">' + i(g.icon, g.tone === 'error' ? 'bad' : '') + '<b class="grow">' + esc(g.title) + '</b><span class="dsh-cnt' + (g.tone === 'error' ? ' bad' : '') + '">' + g.rows.length + '</span></div><p class="b2">' + esc(g.sub) + '</p>' +
          g.rows.slice(0, lim).map(function (r, k) {
            var attrs = r.b && !r.go ? 'data-open="' + r.b.code + '"' : r.sid ? 'data-summons="' + r.sid + '"' : 'data-go="' + r.go[0] + '" data-p="' + esc(JSON.stringify(r.go[1])) + '"';
            return '<button type="button" class="dsh-arow" ' + attrs + '><span class="grow"><b>' + esc(r.b ? r.b.cust.name : r.label) + '</b><span class="b2">' + esc(r.b ? r.b.code + ' · ' + r.b.car.plate + ' · ' + carLbl(r.b.car) : r.sub) + '</span><span class="b2' + (r.bad ? ' dsh-bad' : '') + '">' + esc(r.note) + '</span></span>' + i('chevron-right', 'faint') + '</button>';
          }).join('') + (g.rows.length > 3 ? '<button type="button" class="btn t sm dsh-more" data-act="more" data-v="' + g.key + '">' + (st.more[g.key] ? 'Show fewer' : 'Show ' + (g.rows.length - 3) + ' more') + '</button>' : '') + '</div>';
      }).join('');
      return chapter('today', 'Today', 'What is going out, coming back and waiting for you.', UI.btn('Open the calendar', { kind: 't', size: 'sm', icon: 'calendar', attrs: { 'data-go': 'calendar' } })) +
        '<div class="grid g2">' +
        card({ id: 'pick', icon: 'key', title: 'Pick-ups today', sub: left1 ? left1 + ' still to go out' : outs.length ? 'All handed over' : '', body: outs.length ? '<div class="dsh-tlist">' + outs.map(function (x) { return row(x, 'out'); }).join('') + '</div>' : '<div class="dsh-hollow">No cars are going out today. Tomorrow\'s pick-ups show here from midnight.</div>' }) +
        card({ id: 'ret', icon: 'arrow-back-up', title: 'Returns today', sub: left2 ? left2 + ' still to come back' : backs.length ? 'All back' : '', body: backs.length ? '<div class="dsh-tlist">' + backs.map(function (x) { return row(x, 'back'); }).join('') + '</div>' : '<div class="dsh-hollow">No cars are due back today.</div>' }) + '</div>' +
        card({ id: 'att', icon: 'bell-ringing', title: 'Needs attention', sub: tot ? plural(tot, 'thing') + ' to look at' : 'Nothing to look at', body: tot ? '<div class="dsh-attgrid">' + groups + '</div>' : '<div class="dsh-hollow">' + i('mood-smile') + ' All clear. Nothing needs you right now.</div>' }) + '</section>';
    }

    /* ---------- 3. How the period went ---------- */
    function secPeriod(M, P, A) {
      var out = '', cars = M.cars;
      var mk = [['Rental', A.rent, 'var(--primary)'], ['Delivery', A.deliv, '#f97316'], ['Return fee', A.ret, '#10b981'], ['Damage cover', A.dmg, '#f59e0b'], ['Other', A.other, '#8b5cf6']].filter(function (x) { return x[1] > 0; });
      var kinds = Object.keys(A.kinds).map(function (k) { return [k, A.kinds[k]]; }).sort(function (a, c) { return c[1] - a[1]; });
      var top4 = kinds.slice(0, 4), rest = kinds.slice(4);
      var spend = top4.map(function (k, j) { return { label: k[0], value: k[1], color: DSH_KIND_COLORS[j] }; }); if (rest.length) spend.push({ label: 'Other (' + rest.length + ' kinds)', value: sum(rest.map(function (k) { return k[1]; })), color: '#9ca3af' });
      var payCount = {}; A.bookings.forEach(function (x) { var p = x.pay || 'None'; payCount[p] = (payCount[p] || 0) + 1; });
      var pays = Object.keys(payCount).map(function (k) { return { label: k, value: payCount[k], color: UI.STATUS.payment[k] || '#94a3b8' }; }).sort(function (a, c) { return c.value - a.value; });
      var rows = [];
      if (V.rev) rows.push(card({ id: 'mix', icon: 'chart-donut', title: 'What the income is made of', sub: 'Rental days and the extras around them. Deposits are not income.', body: mk.length ? UI.chart.donut({ items: mk.map(function (x) { return { label: x[0], value: Math.round(x[1] * 100) / 100, color: x[2] }; }), center: { value: dshRmK(A.income), label: 'Total income' }, fmt: money }) : '<div class="dsh-hollow">No income in this period yet.</div>', table: { cols: ['Part', 'Amount'], rows: mk.map(function (x) { return [x[0], money(x[1])]; }).concat([['Total', money(A.income)]]) } }));
      if (V.prof) rows.push(card({ id: 'spend', icon: 'receipt-2', title: 'What the money was spent on', sub: 'Service jobs, papers and everything recorded on the Expenses page, by kind.', body: spend.length ? UI.chart.donut({ items: spend, center: { value: dshRmK(A.exp), label: 'Total expenses' }, fmt: money }) + (rest.length ? '<p class="b2">Other is ' + esc(rest.map(function (k) { return k[0]; }).join(', ')) + '.</p>' : '') : '<div class="dsh-hollow">Nothing spent in this period.</div>', table: { cols: ['Kind', 'Amount'], rows: kinds.map(function (k) { return [k[0], money(k[1])]; }) } }));
      rows.push(card({ id: 'paystat', icon: 'credit-card', title: 'Bookings by payment status', sub: 'Where each booking of the period stands with its payments.', body: pays.length ? UI.chart.donut({ items: pays, center: { value: String(A.count), label: 'bookings' } }) : '<div class="dsh-hollow">No bookings in this period.</div>', table: { cols: ['Payment status', 'Bookings'], rows: pays.map(function (p) { return [p.label, String(p.value)]; }) } }));
      out += '<div class="grid dsh-g' + rows.length + '">' + rows.join('') + '</div>';
      if (V.veh && V.rev) {
        var ranked = cars.map(function (c) { return { c: c, inc: A.byCar[c.id] || 0, exp: A.expCar[c.id] || 0 }; }).sort(function (a, c) { return c.inc - a.inc; }), mx = Math.max.apply(0, ranked.map(function (r) { return r.inc; }).concat([1]));
        var bars = '<div class="dsh-hbars">' + ranked.map(function (r) { return '<button type="button" class="dsh-hbar' + (st.follow === r.c.id ? ' on' : '') + '" data-follow="' + r.c.id + '" title="Follow ' + esc(r.c.plate) + ' in the car charts"><span class="dsh-hl"><b>' + esc(r.c.plate) + '</b><small>' + esc(carLbl(r.c)) + '</small></span><span class="dsh-ht"><i style="width:' + (r.inc / mx * 100).toFixed(1) + '%"></i></span><span class="num dsh-hv">' + dshRmK(r.inc) + '</span></button>'; }).join('') + '</div>';
        var two = [card({ id: 'percar', icon: 'chart-bar', title: 'Income per car', sub: 'Click a car to follow it in the other charts.', body: bars, table: { cols: ['Car', 'Income'], rows: ranked.map(function (r) { return [r.c.plate, money(r.inc)]; }) } })];
        if (V.prof) {
          var noCar = A.expCar['-'] || 0, all = ranked.concat([{ none: true, inc: 0, exp: noCar }]), mx2 = Math.max.apply(0, all.map(function (r) { return Math.max(r.inc, r.exp); }).concat([1]));
          two.push(card({ id: 'iep', icon: 'scale', title: 'Income, expenses and profit per car', sub: 'Expenses are the finished jobs, the papers issued and what was recorded in the period. The last row is money spent on no car in particular.', body: '<div class="dsh-leg"><span class="dsh-legi"><i style="background:var(--primary)"></i>Income</span><span class="dsh-legi"><i style="background:var(--vd-expense)"></i>Expenses</span><span class="dsh-legi"><i style="background:var(--vd-net)"></i>Profit</span></div><div class="dsh-iep">' + all.map(function (r) { var pr = r.inc - r.exp; return '<button type="button" class="dsh-ieprow' + (!r.none && st.follow === r.c.id ? ' on' : '') + '"' + (r.none ? ' disabled' : ' data-follow="' + r.c.id + '"') + '><span class="dsh-hl"><b>' + esc(r.none ? 'Not tied to a car' : r.c.plate) + '</b><small>' + esc(r.none ? 'Costs that belong to no car' : carLbl(r.c)) + '</small></span><span class="dsh-trip"><i style="width:' + (r.inc / mx2 * 100).toFixed(1) + '%;background:var(--primary)"></i><i style="width:' + (r.exp / mx2 * 100).toFixed(1) + '%;background:var(--vd-expense)"></i><i style="width:' + (Math.abs(pr) / mx2 * 100).toFixed(1) + '%;background:' + (pr < 0 ? 'var(--error)' : 'var(--vd-net)') + '"></i></span><span class="dsh-trv num"><span>' + dshK(r.inc) + '</span><span>' + dshK(r.exp) + '</span><span' + (pr < 0 ? ' class="dsh-bad"' : '') + '>' + dshK(pr) + '</span></span></button>'; }).join('') + '</div>', table: { cols: ['Car', 'Income', 'Expenses', 'Profit'], rows: all.map(function (r) { return [r.none ? 'Not tied to a car' : r.c.plate, money(r.inc), money(r.exp), money(r.inc - r.exp)]; }) } }));
        }
        out += '<div class="grid g2">' + two.join('') + '</div>';
      }
      var util = cars.map(function (c) { var dd = A.daysCar[c.id] || 0; return { c: c, days: dd, pct: Math.min(100, dd / P.days * 100), bk: A.bkCar[c.id] || 0 }; }).sort(function (a, c) { return c.pct - a.pct; });
      out += card({ id: 'busy', icon: 'gauge', title: 'How busy each car was', sub: 'The share of the days in the period that the car was rented.', body: '<div class="dsh-rings">' + util.map(function (u) { return '<button type="button" class="dsh-ring' + (st.follow === u.c.id ? ' on' : '') + '" data-follow="' + u.c.id + '">' + UI.chart.ring(u.pct, { size: 84, color: u.pct < 40 ? 'var(--warning)' : 'var(--primary)' }) + '<b>' + esc(u.c.plate) + '</b><small>' + plural(u.days, 'day') + '<br>' + plural(u.bk, 'booking') + '</small></button>'; }).join('') + '</div>', table: { cols: ['Car', 'Busy', 'Days', 'Bookings'], rows: util.map(function (u) { return [u.c.plate, Math.round(u.pct) + '%', String(u.days), String(u.bk)]; }) } });
      var topIncome = V.rev && V.veh, tops = cars.map(function (c) { return { c: c, inc: A.byCar[c.id] || 0, days: A.daysCar[c.id] || 0 }; }).sort(function (a, c) { return topIncome ? c.inc - a.inc : c.days - a.days; }).slice(0, 5);
      out += card({ id: 'top', icon: 'trophy', title: 'Top cars', sub: topIncome ? 'The five that earned the most in the period.' : 'The five that were rented the most in the period.', body: '<ol class="dsh-top">' + tops.map(function (t, k) { return '<li><span class="dsh-rank">' + (k + 1) + '</span><span class="grow"><b>' + esc(t.c.plate) + '</b><small>' + esc(carName(t.c)) + ' · ' + plural(t.days, 'day') + ' rented</small></span><b class="num">' + (topIncome ? money(t.inc) : plural(t.days, 'day')) + '</b></li>'; }).join('') + '</ol>' });
      out += notCounted(M, 'period', P.from, P.to, P.label.toLowerCase() + ', ' + P.range);
      return chapter('period', 'How the period went', P.label + ', ' + P.range + '. Every figure is set against ' + P.cmp + '.', UI.btn('Change period', { kind: 't', size: 'sm', icon: 'calendar', attrs: { 'data-jump': 'dsh-period-hero' } })) + out + '</section>';
    }

    /* ---------- year helpers ---------- */
    function yearData(M, Y, carId) {
      var e = []; for (var m = 0; m <= 12; m++) e.push(dshMonth(Y, m));
      var pe = e.map(function (t) { var x = new Date(t); return dshMonth(Y - 1, x.getMonth() + (x.getFullYear() > Y ? 12 : 0)); });
      var now = NOW(), cm = now.getFullYear() === Y ? now.getMonth() : Y < now.getFullYear() ? 12 : -1;
      return { edges: e, pedges: pe, cm: cm, finished: Math.max(0, Math.min(12, cm)),
        rev: dshSeries(M, e, 'income', carId), prevRev: dshSeries(M, pe, 'income', carId), exp: dshSeries(M, e, 'exp', carId), prevExp: dshSeries(M, pe, 'exp', carId),
        count: dshSeries(M, e, 'count', carId), prevCount: dshSeries(M, pe, 'count', carId), days: dshSeries(M, e, 'days', carId), prevDays: dshSeries(M, pe, 'days', carId) };
    }

    /* ---------- 4. Month by month ---------- */
    function secMonths(M) {
      var Y = st.year, yd = yearData(M, Y), fin = yd.finished, out = '', span = fin ? 'Jan to ' + MON[fin - 1] : 'no finished month';
      var ytd = function (a) { return sum(a.slice(0, fin)); };
      var future = yd.cm >= 0 && yd.cm < 12 ? yd.cm + 1 : null, mark = yd.cm >= 0 && yd.cm < 12 ? yd.cm : null;
      var years = []; for (var yy = NOW().getFullYear(); yy >= 2025; yy--) years.push([yy, String(yy)]);
      var picker = '<div class="inp dsh-year"><select data-act="year" aria-label="Year">' + UI.options(years, Y) + '</select></div>';
      var vs = function (now, before, word) { return '<div class="dsh-big"><b class="num">' + money(now) + '</b>' + dshChange(now, before, word !== 'exp', '') + '</div><p class="b2">' + esc(span + ', against ' + money(before) + ' in the same months of ' + (Y - 1)) + '</p>'; };
      var cards = [];
      if (V.rev) cards.push(card({ id: 'mrev', icon: 'cash', title: 'Revenue, month by month', sub: Y + ' against ' + (Y - 1) + '. Counted like the Excel report, and the refundable deposit is never income.', body: vs(ytd(yd.rev), ytd(yd.prevRev)) + dshBars({ labels: MON, series: [{ key: 'p', name: String(Y - 1), values: yd.prevRev, color: 'rgb(var(--primary-rgb) / .35)' }, { key: 'c', name: String(Y), values: yd.rev, color: 'var(--primary)' }], money: true, full: money, future: future, mark: mark, label: 'Revenue by month' }), foot: 'Each rental is cut into 24-hour blocks from its pick-up time and each block counts on the day it starts, so a month here is the Total income of the Excel report for that month.', table: { cols: ['Month', String(Y), String(Y - 1)], rows: MON.map(function (m, k) { return [m, money(yd.rev[k]), money(yd.prevRev[k])]; }) } }));
      if (V.prof) cards.push(card({ id: 'mexp', icon: 'receipt-2', title: 'Expenses, month by month', sub: Y + ' against ' + (Y - 1) + '. Finished jobs, papers and everything recorded on the Expenses page.', body: vs(ytd(yd.exp), ytd(yd.prevExp), 'exp') + dshBars({ labels: MON, series: [{ key: 'p', name: String(Y - 1), values: yd.prevExp, color: 'rgb(var(--grey-rgb) / .45)' }, { key: 'c', name: String(Y), values: yd.exp, color: 'var(--vd-expense)' }], money: true, full: money, mark: mark, label: 'Expenses by month' }), table: { cols: ['Month', String(Y), String(Y - 1)], rows: MON.map(function (m, k) { return [m, money(yd.exp[k]), money(yd.prevExp[k])]; }) } }));
      if (cards.length) out += '<div class="grid g' + cards.length + '">' + cards.join('') + '</div>';
      if (V.rev) {
        var e = yd.edges, parts = [['rent', 'Rent', 'var(--primary)'], ['deliv', 'Delivery', '#f97316'], ['ret', 'Return', '#10b981'], ['dmg', 'Damage coverage', '#f59e0b'], ['other', 'Other charges', '#8b5cf6']];
        var ser = parts.map(function (p) { return { key: p[0], name: p[1], color: p[2], values: dshSeries(M, e, function (x) { return x[p[0]]; }) }; }).filter(function (s) { return sum(s.values) > 0; });
        out += card({ id: 'mmix', icon: 'chart-bar', title: 'What the income is made of, month by month', sub: 'Each month of ' + Y + ', split into rent, delivery, return, damage coverage and other charges. Deposits are not income. Click a name to hide it.', body: dshBars({ labels: MON, series: ser, stacked: true, hidden: st.hidden.mmix, legendId: 'mmix', money: true, full: money, future: future, mark: mark, h: 260, w: 1100 }), table: { cols: ['Month'].concat(ser.map(function (s) { return s.name; })), rows: MON.map(function (m, k) { return [m].concat(ser.map(function (s) { return money(s.values[k]); })); }) } });
      }
      if (V.prof) {
        var tot = {}; M.ex.forEach(function (x) { if (x.t >= yd.edges[0] && x.t < yd.edges[12]) tot[x.kind] = (tot[x.kind] || 0) + x.amount; });
        var ks = Object.keys(tot).sort(function (a, c) { return tot[c] - tot[a]; }), main = ks.slice(0, 6), others = ks.slice(6);
        var ser2 = main.map(function (k, j) { return { key: 'k' + j, name: k, color: DSH_KIND_COLORS[j], values: yd.edges.slice(0, -1).map(function () { return 0; }) }; });
        var oth = { key: 'other', name: 'Other (' + others.length + ' kinds)', color: '#9ca3af', values: yd.edges.slice(0, -1).map(function () { return 0; }) };
        M.ex.forEach(function (x) { var k = dshIdx(yd.edges, x.t); if (k < 0) return; var j = main.indexOf(x.kind); (j >= 0 ? ser2[j] : oth).values[k] += x.amount; });
        if (others.length) ser2.push(oth);
        out += card({ id: 'mspend', icon: 'chart-bar', title: 'What the money was spent on, month by month', sub: 'Each month of ' + Y + ', split by kind. A kind keeps its colour on every chart on this page. Click a name to hide it.', body: '<div class="dsh-big"><b class="num">' + money(sum(ks.map(function (k) { return tot[k]; }))) + '</b><span class="b2">spent so far in ' + Y + ', on ' + plural(ks.length, 'kind') + ' of expense</span></div>' + dshBars({ labels: MON, series: ser2, stacked: true, hidden: st.hidden.mspend, legendId: 'mspend', money: true, full: money, mark: mark, h: 260, w: 1100 }), foot: others.length ? 'Other (' + others.length + ' kinds) is ' + esc(others.join(', ')) + '.' : '', table: { cols: ['Month'].concat(ser2.map(function (s) { return s.name; })), rows: MON.map(function (m, k) { return [m].concat(ser2.map(function (s) { return money(s.values[k]); })); }) } });
      }
      var ahead = MON.map(function (_, k) { var t = yd.edges[k], t2 = yd.edges[k + 1], cnt = 0; M.real.forEach(function (x) { if (x.created <= NOW() && x.start.getTime() >= Math.max(t, dshD0(NOW())) && x.start.getTime() < t2) cnt++; }); return cnt; });
      var mm = st.monthsMetric, mv = mm === 'days' ? [yd.days, yd.prevDays] : mm === 'ahead' ? [ahead, null] : [yd.count, yd.prevCount];
      var cnts = card({ id: 'mcount', icon: 'calendar-stats', title: mm === 'ahead' ? 'Booked ahead, month by month' : (mm === 'days' ? 'Days rented' : 'Bookings') + ', month by month', sub: mm === 'ahead' ? 'Bookings already made for the days still to come.' : Y + ' against ' + (Y - 1) + '.', actions: dshSeg('monthsMetric', [['bookings', 'Bookings'], ['days', 'Days rented'], ['ahead', 'Booked ahead']], mm), body: dshBars({ labels: MON, series: (mv[1] ? [{ key: 'p', name: String(Y - 1), values: mv[1], color: 'rgb(var(--grey-rgb) / .45)' }] : []).concat([{ key: 'c', name: mm === 'ahead' ? 'Booked ahead' : String(Y), values: mv[0], color: '#4a6b8f' }]), mark: mark, future: mm === 'ahead' ? null : future, label: 'Count by month', h: 240, w: 1100 }), table: { cols: ['Month', mm === 'ahead' ? 'Booked ahead' : String(Y)].concat(mv[1] ? [String(Y - 1)] : []), rows: MON.map(function (m, k) { return [m, String(mv[0][k])].concat(mv[1] ? [String(mv[1][k])] : []); }) } });
      var net = yd.rev.map(function (v, k) { return k >= fin && yd.cm >= 0 && k > yd.cm ? null : v - yd.exp[k]; });
      var rel = V.rev && V.prof ? card({ id: 'mnet', icon: 'scale', title: 'Revenue, expenses and what is left', sub: 'Each month of ' + Y + '. The line is revenue less expenses; below zero means the month cost more than it earned.', body: dshBars({ labels: MON, series: [{ key: 'r', name: 'Revenue', values: yd.rev, color: 'var(--primary)' }, { key: 'e', name: 'Expenses', values: yd.exp, color: 'var(--vd-expense)' }], line: { key: 'n', name: 'Net result', values: net, color: '#4a6b8f' }, hidden: st.hidden.mnet, legendId: 'mnet', money: true, full: money, mark: mark, w: 760 }) + '<div class="dsh-trio"><div><span class="b2">Revenue, ' + esc(span) + '</span><b class="num">' + money(ytd(yd.rev)) + '</b></div><div><span class="b2">Expenses</span><b class="num">' + money(ytd(yd.exp)) + '</b></div><div><span class="b2">Net result</span><b class="num">' + money(ytd(yd.rev) - ytd(yd.exp)) + '</b></div></div>', table: { cols: ['Month', 'Revenue', 'Expenses', 'Net result'], rows: MON.map(function (m, k) { return [m, money(yd.rev[k]), money(yd.exp[k]), net[k] == null ? '' : money(net[k])]; }) } }) : '';
      /* what stands out */
      var ins = [], yr = ytd(yd.rev), py = ytd(yd.prevRev);
      if (V.rev && fin && py) { var gr = dshPct(yr, py); ins.push([gr >= 0 ? 'trending-up' : 'trending-down', gr >= 0 ? 'good' : 'bad', 'Revenue for ' + span + ' is ' + Math.abs(gr) + '% ' + (gr >= 0 ? 'above' : 'below') + ' the same months last year (' + money(yr) + ' against ' + money(py) + ').']); }
      if (V.rev) { var bm = -1; yd.rev.forEach(function (v, k) { if (k <= Math.min(11, yd.cm < 0 ? 11 : yd.cm) && (bm < 0 || v > yd.rev[bm])) bm = k; }); if (bm >= 0 && yd.rev[bm]) ins.push(['trophy', '', MONTHS[bm] + ' is the best month of ' + Y + (yd.cm >= 0 && yd.cm < 12 ? ' so far' : '') + ' with ' + money(yd.rev[bm]) + '.']); }
      if (V.rev && V.prof && yr) { var sh = Math.round(ytd(yd.exp) / yr * 1000) / 10; ins.push(['receipt-2', sh > 40 ? 'bad' : '', 'Expenses took ' + sh + '% of revenue for ' + span + '.']); }
      var grid = habitGrid(M, Y), bs = { n: 0 }; grid.forEach(function (r, wd) { r.forEach(function (n, h) { if (n > bs.n) bs = { n: n, wd: wd, h: h }; }); }); if (bs.n) ins.push(['clock-hour-9', '', 'Most pick-ups happen on ' + WDL[bs.wd] + 's around ' + dshHour(bs.h) + '.']);
      var PP = dshPeriod(st), AA = dshAgg(M, PP.from, PP.to);
      if (V.rev && V.veh) { var tc = M.cars.slice().sort(function (a, c) { return (AA.byCar[c.id] || 0) - (AA.byCar[a.id] || 0); })[0]; if (tc && AA.byCar[tc.id]) ins.push(['car', '', tc.plate + ' earns the most (' + PP.label.toLowerCase() + '), ' + money(AA.byCar[tc.id]) + '.']); }
      var low = M.cars.map(function (c) { return { c: c, p: Math.round((AA.daysCar[c.id] || 0) / PP.days * 100) }; }).sort(function (a, c) { return a.p - c.p; })[0];
      if (low && low.p < 40) ins.push(['zzz', 'bad', low.c.plate + ' was on the road only ' + low.p + '% of the days (' + PP.label.toLowerCase() + ').']);
      var stands = card({ id: 'stand', icon: 'bulb', title: 'What stands out', sub: 'Plain words about the numbers on this page.', body: '<ul class="dsh-ins">' + ins.slice(0, 5).map(function (x) { return '<li class="' + x[1] + '">' + i(x[0]) + '<span>' + esc(x[2]) + '</span></li>'; }).join('') + '</ul>' });
      out += cnts + '<div class="grid dsh-g84">' + (rel || '') + stands + '</div>';
      out += notCounted(M, 'year', dshMonth(Y, 0), dshMonth(Y + 1, 0), Y === NOW().getFullYear() ? Y + ' so far' : String(Y));
      return chapter('months', 'Month by month', Y + ' against ' + (Y - 1) + '.', picker) + out + '</section>';
    }

    /* ---------- 5. Car by car ---------- */
    function secCars(M) {
      var Y = st.year, metrics = [];
      if (V.veh && V.rev) metrics.push(['revenue', 'Revenue']);
      if (V.veh && V.prof) metrics.push(['expenses', 'Expenses']);
      if (V.veh && V.rev && V.prof) metrics.push(['profit', 'Profit']);
      metrics.push(['days', 'Days rented'], ['util', 'Utilisation']);
      var mt = metrics.some(function (m) { return m[0] === st.carMetric; }) ? st.carMetric : metrics[0][0], label = metrics.filter(function (m) { return m[0] === mt; })[0][1];
      var isMoney = mt === 'revenue' || mt === 'expenses' || mt === 'profit', fmtF = isMoney ? money : mt === 'util' ? function (v) { return Math.round(v) + '%'; } : function (v) { return String(Math.round(v)); }, fmtC = isMoney ? dshK : fmtF;
      var val = function (yd, k, c) { var dim = new Date(Y, k + 1, 0).getDate(); return mt === 'revenue' ? yd.rev[k] : mt === 'expenses' ? yd.exp[k] : mt === 'profit' ? yd.rev[k] - yd.exp[k] : mt === 'days' ? yd.days[k] : yd.days[k] / dim * 100; };
      var pval = function (yd, k) { var dim = new Date(Y - 1, k + 1, 0).getDate(); return mt === 'revenue' ? yd.prevRev[k] : mt === 'expenses' ? yd.prevExp[k] : mt === 'profit' ? yd.prevRev[k] - yd.prevExp[k] : mt === 'days' ? yd.prevDays[k] : yd.prevDays[k] / dim * 100; };
      var rows = M.cars.map(function (c) { var yd = yearData(M, Y, c.id); return { c: c, yd: yd, vals: MON.map(function (_, k) { return val(yd, k); }), prev: MON.map(function (_, k) { return pval(yd, k); }) }; });
      var cm = rows.length ? rows[0].yd.cm : 11, done = function (k) { return cm < 0 ? false : k < Math.min(cm + 1, 12); };
      rows.forEach(function (r) { r.total = mt === 'util' ? sum(r.vals.filter(function (_, k) { return done(k); })) / Math.max(1, MON.filter(function (_, k) { return done(k); }).length) : sum(r.vals.filter(function (_, k) { return done(k); })); r.ptotal = mt === 'util' ? sum(r.prev.filter(function (_, k) { return done(k); })) / Math.max(1, MON.filter(function (_, k) { return done(k); }).length) : sum(r.prev.filter(function (_, k) { return done(k); })); });
      var noCar = null;
      if (mt === 'expenses' || mt === 'profit') { var ex = MON.map(function () { return 0; }), pex = MON.map(function () { return 0; }), e = rows[0].yd.edges, pe = rows[0].yd.pedges; M.ex.forEach(function (x) { if (x.car) return; var k = dshIdx(e, x.t); if (k >= 0) ex[k] += x.amount; k = dshIdx(pe, x.t); if (k >= 0) pex[k] += x.amount; }); noCar = { none: true, vals: mt === 'profit' ? ex.map(function (v) { return -v; }) : ex, prev: mt === 'profit' ? pex.map(function (v) { return -v; }) : pex }; noCar.total = sum(noCar.vals.filter(function (_, k) { return done(k); })); noCar.ptotal = sum(noCar.prev.filter(function (_, k) { return done(k); })); }
      var all = rows.concat(noCar ? [noCar] : []).sort(function (a, c) { return c.total - a.total; });
      var mx = Math.max.apply(0, all.map(function (r) { return Math.max.apply(0, r.vals.map(Math.abs)); }).concat([1]));
      var colTot = MON.map(function (_, k) { var s = sum(all.map(function (r) { return r.vals[k]; })); return mt === 'util' ? s / Math.max(1, rows.length) : s; });
      var heat = '<div class="dsh-heatwrap"><table class="dsh-heat"><thead><tr><th></th>' + MON.map(function (m, k) { return '<th class="' + (k === cm ? 'cur' : k > cm ? 'fut' : '') + '">' + m + '</th>'; }).join('') + '<th class="r">' + (mt === 'util' ? 'Average' : 'Total') + '</th></tr></thead><tbody>' +
        all.map(function (r) { return '<tr class="' + (!r.none && st.follow === r.c.id ? 'on' : '') + '">' + (r.none ? '<th class="dsh-hcar"><b>Not tied to a car</b><small>Costs on no car</small></th>' : '<th class="dsh-hcar"><button type="button" data-follow="' + r.c.id + '"><b>' + esc(r.c.plate) + '</b><small>' + esc(carLbl(r.c)) + '</small></button></th>') + r.vals.map(function (v, k) { var a = Math.min(1, Math.abs(v) / mx); return '<td class="' + (k > cm ? 'fut' : '') + '" style="--a:' + (v ? (.12 + a * .88).toFixed(2) : 0) + ';--hc:' + (v < 0 ? 'var(--error-rgb)' : mt === 'expenses' ? 'var(--grey-rgb)' : 'var(--primary-rgb)') + '" title="' + esc((r.none ? 'Not tied to a car' : r.c.plate) + ', ' + MONTHS[k] + ': ' + fmtF(v)) + '"><span>' + (v ? esc(fmtC(v)) : '') + '</span></td>'; }).join('') + '<td class="r num"><b>' + esc(fmtF(r.total)) + '</b></td></tr>'; }).join('') +
        '<tr class="dsh-htot"><th>' + (noCar ? 'Everything' : 'All cars') + '</th>' + colTot.map(function (v, k) { return '<td class="' + (k > cm ? 'fut' : '') + '">' + (v ? esc(fmtC(v)) : '') + '</td>'; }).join('') + '<td class="r num"><b>' + esc(fmtF(mt === 'util' ? sum(colTot.filter(function (_, k) { return done(k); })) / Math.max(1, MON.filter(function (_, k) { return done(k); }).length) : sum(colTot.filter(function (_, k) { return done(k); })))) + '</b></td></tr></tbody></table></div>';
      var heatCard = card({ id: 'heat', icon: 'grid-dots', title: label + ' by car and month, ' + Y, sub: 'The darker the square, the more it is. Click a car to follow it in the charts below.', body: '<div class="row gap8 b2 dsh-ramp">Less <span class="dsh-rampbar' + (mt === 'expenses' ? ' grey' : '') + '"></span> More (' + esc(fmtC(mx)) + ')</div>' + heat, foot: cm < 11 ? 'Months that have not started show what is already booked. They are left out of the totals.' : '', table: { cols: ['Car'].concat(MON).concat(['Total']), rows: all.map(function (r) { return [r.none ? 'Not tied to a car' : r.c.plate].concat(r.vals.map(fmtF)).concat([fmtF(r.total)]); }) } });
      var picked = st.follow && carById(st.follow), src = picked ? rows.filter(function (r) { return r.c.id === st.follow; })[0] : null;
      var cur = src ? src.vals : colTot, prev = src ? src.prev : MON.map(function (_, k) { var s = sum(all.map(function (r) { return r.prev[k]; })); return mt === 'util' ? s / Math.max(1, rows.length) : s; });
      var curD = cur.map(function (v, k) { return k > cm && cm >= 0 ? null : v; });
      var dn = sum(cur.filter(function (_, k) { return done(k) && k < cm; })), db = sum(prev.filter(function (_, k) { return done(k) && k < cm; }));
      var subj = picked ? picked.plate : noCar ? 'Everything' : 'All cars';
      var lineCard = card({ id: 'onecar', icon: 'chart-line', title: subj + ': ' + label.toLowerCase() + ' against last year', sub: Y + ' against ' + (Y - 1) + ', month by month. ' + (picked ? '' : 'Click a car in the grid to look at one car.'), actions: picked ? UI.btn('All cars', { kind: 't', size: 'sm', attrs: { 'data-act': 'unfollow' } }) : '', body: (mt !== 'util' ? '<div class="dsh-big"><b class="num">' + esc(fmtF(dn)) + '</b>' + dshChange(dn, db, mt !== 'expenses', '') + '<span class="b2">' + Math.max(0, cm) + ' finished months of ' + Y + ', against ' + esc(fmtF(db)) + ' a year earlier</span></div>' : '') + dshLine({ labels: MON, series: [{ name: String(Y), values: curD, color: mt === 'expenses' ? 'var(--vd-expense)' : 'var(--primary)' }, { name: String(Y - 1), values: prev, color: 'var(--vd-ink2)', dash: true }], money: isMoney, fmt: isMoney ? dshRmK : function (v) { return fmtC(v); }, full: fmtF, label: label + ' against last year' }), table: { cols: ['Month', String(Y), String(Y - 1)], rows: MON.map(function (m, k) { return [m, curD[k] == null ? '' : fmtF(curD[k]), fmtF(prev[k])]; }) } });
      var rankCard = card({ id: 'rank', icon: 'list-numbers', title: 'Ranking, ' + label.toLowerCase() + ' in ' + Y, sub: 'Months that have started, biggest first. The small figure is the change on ' + (Y - 1) + '.', body: '<ol class="dsh-top">' + all.map(function (r, k) { var pc = dshPct(r.total, r.ptotal); return '<li' + (r.none ? '' : ' data-follow="' + r.c.id + '" role="button" tabindex="0"') + ' class="' + (!r.none && st.follow === r.c.id ? 'on' : '') + '"><span class="dsh-rank">' + (k + 1) + '</span><span class="grow"><b>' + esc(r.none ? 'Not tied to a car' : r.c.plate) + '</b><small>' + esc(r.none ? 'Costs on no car' : carName(r.c)) + '</small></span><span class="dsh-rv"><b class="num">' + esc(fmtC(r.total)) + '</b>' + (pc == null ? '<small>new</small>' : '<small class="' + ((pc >= 0) === (mt !== 'expenses') ? 'dsh-good' : 'dsh-bad') + '">' + (pc >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(pc)) + '%</small>') + '</span></li>'; }).join('') + '</ol>' });
      return chapter('cars', 'Car by car', 'Which cars earn, cost and work the most, month by month in ' + Y + '.', '') + dshSeg('carMetric', metrics, mt) + heatCard + '<div class="grid dsh-g75">' + lineCard + rankCard + '</div></section>';
    }

    /* ---------- 6. Habits and customers ---------- */
    function habitGrid(M, Y) { var g = [0, 1, 2, 3, 4, 5, 6].map(function () { var r = []; for (var h = 0; h < 24; h++) r.push(0); return r; }); M.rentals.forEach(function (x) { if (x.start.getFullYear() === Y) g[x.start.getDay()][x.start.getHours()]++; }); return g; }
    function secHabits(M, P, A) {
      var order = [1, 2, 3, 4, 5, 6, 0], wk = order.map(function () { return 0; });
      if (st.weekMode === 'days') M.blocks.forEach(function (x) { if (x.t >= P.from && x.t < P.to) wk[order.indexOf(new Date(x.t).getDay())]++; });
      else A.bookings.forEach(function (x) { wk[order.indexOf(x.start.getDay())]++; });
      var bi = wk.indexOf(Math.max.apply(0, wk)), mxw = Math.max.apply(0, wk.concat([1]));
      var weekCard = card({ id: 'week', icon: 'calendar-week', title: 'Busiest weekdays', sub: P.label + ': ' + (st.weekMode === 'days' ? 'the days the cars were out.' : 'the day customers collect the car.'), actions: dshSeg('weekMode', [['pickups', 'Pick-ups'], ['days', 'Days rented']], st.weekMode), body: '<div class="dsh-wk">' + wk.map(function (v, k) { return '<div class="dsh-wkc' + (k === bi && v ? ' best' : '') + '"><b>' + v + '</b><span><i style="height:' + (v / mxw * 100).toFixed(1) + '%"></i></span><small>' + WD[order[k]] + '</small></div>'; }).join('') + '</div>', foot: wk[bi] ? WD[order[bi]] + ' is the busiest with ' + wk[bi] + (st.weekMode === 'days' ? ' days rented.' : ' pick-ups.') : 'No pick-ups in this period.', table: { cols: ['Weekday', st.weekMode === 'days' ? 'Days rented' : 'Pick-ups'], rows: wk.map(function (v, k) { return [WDL[order[k]], String(v)]; }) } });
      var Y = NOW().getFullYear(), g = habitGrid(M, Y), mx = 1, tot = 0, bs = { n: 0 }; g.forEach(function (r, wd) { r.forEach(function (n, h) { tot += n; if (n > mx) mx = n; if (n > bs.n) bs = { n: n, wd: wd, h: h }; }); });
      var heat = '<div class="dsh-heatwrap"><table class="dsh-heat dsh-hours"><thead><tr><th></th>' + g[0].map(function (_, h) { return '<th>' + (h % 3 === 0 ? dshHour(h).replace(' AM', 'a').replace(' PM', 'p') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' + order.map(function (wd) { return '<tr><th>' + WD[wd] + '</th>' + g[wd].map(function (n, h) { return '<td style="--a:' + (n ? (.12 + n / mx * .88).toFixed(2) : 0) + ';--hc:var(--primary-rgb)" title="' + WDL[wd] + ', ' + dshHour(h) + ': ' + plural(n, 'pick-up') + '"></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      var whenCard = card({ id: 'when', icon: 'clock', title: 'When customers pick up', sub: 'Every pick-up of ' + Y + ' by weekday and hour. The darker the square, the more pick-ups.', body: heat, foot: bs.n ? 'Busiest: ' + WDL[bs.wd] + 's at ' + dshHour(bs.h) + ' (' + plural(bs.n, 'pick-up') + '). ' + plural(tot, 'pick-up') + ' in all.' : '' });
      var seen = {}, nw = 0, rt = 0, byCust = {};
      A.bookings.forEach(function (x) { var id = x.cust.id; if (!seen[id]) { seen[id] = 1; if (M.firstSeen[id] < P.from) rt++; else nw++; } var c = byCust[id] || (byCust[id] = { p: x.cust, n: 0, v: 0, last: null }); c.n++; c.v += x.rent - (x.disc || 0) + (x.deliv || 0) + (x.ret || 0) + (x.dmg || 0) + (x.others || 0); if (!x.hist && (!c.last || x.start > c.last.start)) c.last = x; });
      var nr = card({ id: 'newret', icon: 'users', title: 'New and returning customers', sub: 'People who booked in the period, and whether they had booked with you before.', body: nw + rt ? UI.chart.donut({ items: [{ label: 'Returning customers', value: rt, color: '#4a6b8f' }, { label: 'New customers', value: nw, color: 'var(--primary)' }], center: { value: Math.round(rt / (nw + rt) * 100) + '%', label: 'returning' } }) : '<div class="dsh-hollow">Nobody booked in this period.</div>' });
      var by = V.rev ? st.topBy : 'count', top = Object.keys(byCust).map(function (k) { return byCust[k]; }).sort(function (a, c) { return by === 'count' ? c.n - a.n || c.v - a.v : c.v - a.v; }).slice(0, 5);
      var topCard = card({ id: 'topcust', icon: 'award', title: 'Top customers', sub: by === 'count' ? 'Who booked the most this period.' : 'Who brought in the most this period.', actions: V.rev ? dshSeg('topBy', [['income', 'Brought in'], ['count', 'Booked']], st.topBy) : '', body: top.length ? '<ol class="dsh-top">' + top.map(function (c, k) { return '<li' + (c.last ? ' data-open="' + c.last.code + '" role="button" tabindex="0"' : '') + '><span class="dsh-rank">' + (k + 1) + '</span><span class="grow"><b>' + esc(c.p.name) + '</b><small>' + plural(c.n, 'booking') + ' · ' + (M.firstSeen[c.p.id] < P.from ? 'returning' : 'new') + ' customer</small></span>' + (V.rev ? '<b class="num">' + money(c.v) + '</b>' : '') + '</li>'; }).join('') + '</ol>' : '<div class="dsh-hollow">Nobody booked in this period.</div>' });
      var avgCards = [];
      var ydA = yearData(M, Y), mAvg = function (yr) { var e = []; for (var m = 0; m <= 12; m++) e.push(dshMonth(yr, m)); var v = MON.map(function () { return 0; }), n = MON.map(function () { return 0; }), l = MON.map(function () { return 0; }); M.rentals.forEach(function (x) { var k = dshIdx(e, x.start.getTime()); if (k < 0) return; n[k]++; v[k] += x.rent - (x.disc || 0) + (x.deliv || 0) + (x.ret || 0) + (x.dmg || 0) + (x.others || 0); l[k] += x.days; }); return { v: v.map(function (s, k) { return n[k] ? s / n[k] : null; }), l: l.map(function (s, k) { return n[k] ? s / n[k] : null; }), n: n }; };
      var a1 = mAvg(Y), a0 = mAvg(Y - 1), fin = ydA.finished, cut = function (arr) { return arr.map(function (v, k) { return k > ydA.cm ? null : v; }); };
      var wavg = function (a, key) { var s = 0, n = 0; for (var k = 0; k < fin; k++) if (a[key][k] != null) { s += a[key][k] * a.n[k]; n += a.n[k]; } return n ? s / n : 0; };
      if (V.rev) { var v1 = wavg(a1, 'v'), v0 = wavg(a0, 'v'); avgCards.push(card({ id: 'avgv', icon: 'receipt', title: 'Average booking value', sub: 'What a booking brings in, by the month the car went out. ' + Y + ' against ' + (Y - 1) + '.', body: '<div class="dsh-big"><b class="num">' + money(v1) + '</b>' + dshChange(v1, v0, true, '') + '<span class="b2">finished months of ' + Y + ', against ' + money(v0) + ' a year earlier</span></div>' + dshLine({ labels: MON, series: [{ name: String(Y), values: cut(a1.v), color: 'var(--primary)' }, { name: String(Y - 1), values: a0.v, color: 'var(--vd-ink2)', dash: true }], money: true, full: money, area: false }) })); }
      var l1 = wavg(a1, 'l'), l0 = wavg(a0, 'l');
      avgCards.push(card({ id: 'avgl', icon: 'calendar-time', title: 'Average rental length', sub: 'How many days a rental lasts, by the month the car went out. ' + Y + ' against ' + (Y - 1) + '.', body: '<div class="dsh-big"><b class="num">' + l1.toFixed(1) + ' days</b>' + dshChange(l1, l0, true, '') + '<span class="b2">finished months of ' + Y + ', against ' + l0.toFixed(1) + ' days a year earlier</span></div>' + dshLine({ labels: MON, series: [{ name: String(Y), values: cut(a1.l), color: '#4a6b8f' }, { name: String(Y - 1), values: a0.l, color: 'var(--vd-ink2)', dash: true }], fmt: function (v) { return v.toFixed(1); }, full: function (v) { return v.toFixed(1) + ' days'; }, area: false }) }));
      return chapter('habits', 'Habits and customers', 'When people come, who they are, and what a typical booking looks like.') + '<div class="grid dsh-g57">' + weekCard + whenCard + '</div><div class="grid g2">' + nr + topCard + '</div><div class="grid g' + avgCards.length + '">' + avgCards.join('') + '</div></section>';
    }

    /* ---------- 7. Fleet and papers ---------- */
    function secFleet(M) {
      var now = NOW(), t0 = dshD0(now), cars = M.cars;
      var st8 = cars.map(function (c) {
        var cur = d.bookings.filter(function (x) { return x.car === c && x.status === 'Car Delivered'; })[0];
        var wait = d.bookings.filter(function (x) { return x.car === c && ['Agreement Signed', 'Agreement Sent', 'Confirmed'].indexOf(x.status) >= 0 && x.start < t0 + DAY && x.start > now - DAY; })[0];
        var last = M.blocks.filter(function (x) { return x.car === c.id && x.t <= now.getTime(); }).reduce(function (m, x) { return Math.max(m, x.t + DAY); }, 0);
        return { c: c, kind: c.inWorkshop ? 'work' : cur ? 'out' : 'free', b: cur || wait, wait: !cur && wait, late: cur && cur.end < now, idleDays: last ? Math.floor((now - last) / DAY) : 999 };
      });
      var tabs = { out: st8.filter(function (s) { return s.kind === 'out' || s.wait; }), free: st8.filter(function (s) { return s.kind === 'free'; }), work: st8.filter(function (s) { return s.kind === 'work'; }), idle: st8.filter(function (s) { return s.kind === 'free' && s.idleDays >= st.idle; }) };
      var tb = st.fleetTab, list = tabs[tb].slice().sort(function (a, c) { return (c.late ? 1 : 0) - (a.late ? 1 : 0); });
      var crow = function (s) {
        var note = s.kind === 'work' ? (function () { var dt = d.downtime.filter(function (z) { return z.car === s.c.id && !z.back; })[0]; return dt && dt.to ? 'Back ' + UI.fmt.dateTime(dt.to) : 'No return date yet'; })() : s.late ? 'Late, was due back ' + UI.fmt.day(s.b.end) + ', ' + tm(s.b.end) : s.wait ? 'Waiting for pick-up, ' + UI.fmt.day(s.b.start) + ' ' + tm(s.b.start) : s.b ? 'Back ' + UI.fmt.day(s.b.end) + ', ' + tm(s.b.end) : s.idleDays >= 999 ? 'Never rented' : 'Last rented ' + plural(s.idleDays, 'day') + ' ago';
        return '<button type="button" class="dsh-frow" ' + (s.b ? 'data-open="' + s.b.code + '"' : 'data-car="' + s.c.id + '"') + '><span class="dsh-plate' + (s.late ? ' bad' : '') + '">' + esc(s.c.plate) + '</span><span class="grow"><span>' + esc(carLbl(s.c)) + '</span><span class="b2' + (s.late ? ' dsh-bad' : '') + '">' + esc(note) + '</span></span>' + (s.b ? '<span class="dsh-code">' + s.b.code + '</span>' : '') + '</button>';
      };
      var tile = function (id, label, icon, n, tone) { return '<button type="button" class="dsh-ftile' + (tb === id ? ' on' : '') + (tone ? ' ' + tone : '') + '" data-ftab="' + id + '" aria-pressed="' + (tb === id) + '">' + i(icon) + '<span>' + label + '</span><b>' + n + '</b></button>'; };
      var fleetCard = card({ id: 'fleetnow', icon: 'car', title: 'Your cars right now', sub: plural(cars.length, 'car') + ' in the fleet', body: '<div class="dsh-ftiles">' + tile('out', 'Out with customers', 'road', tabs.out.length, tabs.out.some(function (s) { return s.late; }) ? 'bad' : '') + tile('free', 'Free now', 'circle-check', tabs.free.length) + tile('work', 'In the workshop', 'tool', tabs.work.length) + tile('idle', 'Not rented lately', 'zzz', tabs.idle.length) + '</div>' +
        (tb === 'idle' ? '<div class="row gap8 b2 dsh-idle"><label for="dsh-idle">Days without a rental</label><span class="inp"><select id="dsh-idle" data-act="idle">' + UI.options([[3, '3 days'], [7, '7 days'], [14, '14 days'], [30, '30 days']], st.idle) + '</select></span></div>' : '') +
        (list.length ? '<div class="dsh-flist">' + list.map(crow).join('') + '</div>' : '<div class="dsh-hollow">' + ({ out: 'No car is out right now.', free: 'Every car is out or in the workshop.', work: 'No car is in the workshop.', idle: 'Every free car was rented in the last ' + plural(st.idle, 'day') + '.' })[tb] + '</div>') });
      var due = dshDue(d), work = d.jobs.filter(function (j) { return j.status === 'In the workshop'; }).map(function (j) { var c = carById(j.car); return { car: c, what: j.type, note: j.backAt ? 'Back ' + UI.fmt.date(j.backAt) : 'No return date yet', job: j.id }; });
      d.downtime.filter(function (z) { return !z.back && z.from <= now && !z.job; }).forEach(function (z) { work.push({ car: carById(z.car), what: z.reason, note: z.to ? 'Back ' + UI.fmt.date(z.to) : 'No return date yet' }); });
      var svc = due.filter(function (r) { return r.kind === 'service' && r.left <= 30; }), pap = due.filter(function (r) { return r.kind === 'paper' && r.left <= 30; });
      var drow = function (r) { return '<button type="button" class="dsh-drow" data-go="maintenance" data-p="' + esc(JSON.stringify({ car: r.car.id })) + '"><span class="dsh-plate' + (r.left < 0 ? ' bad' : '') + '">' + esc(r.car.plate) + '</span><span class="grow"><span>' + esc(r.what) + '</span><span class="b2' + (r.left < 0 ? ' dsh-bad' : '') + '">' + (r.note || (r.left < 0 ? plural(-r.left, 'day') + ' overdue' : r.left === 0 ? 'Due today' : plural(r.left, 'day') + ' left')) + '</span></span></button>'; };
      var grp = function (t, arr, html) { return '<div class="dsh-dgrp"><div class="row b2"><span class="grow">' + t + '</span><span class="dsh-cnt">' + arr.length + '</span></div>' + (arr.length ? html : '<p class="b2 faint">None.</p>') + '</div>'; };
      var overdue = due.filter(function (r) { return r.left < 0; }).length;
      var papersCard = card({ id: 'papers', icon: 'tool', title: 'Services and papers', sub: overdue ? overdue + ' overdue' : 'Nothing overdue', actions: can0('maintenance.view') ? UI.btn('Open', { kind: 't', size: 'sm', attrs: { 'data-go': 'maintenance' } }) : '', body: grp('In the workshop', work, work.map(function (w) { return '<button type="button" class="dsh-drow" data-go="maintenance" data-p="' + esc(JSON.stringify({ tab: 'workshop' })) + '"><span class="dsh-plate">' + esc(w.car.plate) + '</span><span class="grow"><span>' + esc(w.what) + '</span><span class="b2">' + esc(w.note) + '</span></span></button>'; }).join('')) + grp('Services due', svc, svc.map(drow).join('')) + grp('Papers expiring', pap, pap.map(drow).join('')) });
      var monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      var unpaid = d.instalments.filter(function (it) { return !it.paid && it.due >= new Date(now.getFullYear(), now.getMonth(), 1) && it.due < monthEnd; }), od = d.instalments.filter(function (it) { return !it.paid && it.due < t0; });
      var irows = od.concat(unpaid.filter(function (it) { return od.indexOf(it) < 0; })).sort(function (a, c) { return a.due - c.due; });
      var instCard = V.prof || can0('cars.see_instalment') ? card({ id: 'inst', icon: 'calendar-dollar', title: 'Car instalments', sub: od.length ? od.length + ' overdue' : 'None overdue', actions: UI.btn('Open', { kind: 't', size: 'sm', attrs: { 'data-go': 'instalments' } }), body: '<div class="grid g2 dsh-inst"><div class="dsh-ibox"><span class="b2">Unpaid this month</span><b class="num">' + money(sum(unpaid.map(function (x) { return x.amount; }))) + '</b><span class="b2">' + plural(unpaid.length, 'instalment') + '</span></div><div class="dsh-ibox' + (od.length ? ' bad' : '') + '"><span class="b2">Overdue</span><b class="num">' + money(sum(od.map(function (x) { return x.amount; }))) + '</b><span class="b2">' + plural(od.length, 'instalment') + '</span></div></div>' +
        irows.map(function (it) { var c = carById(it.car), late = it.due < t0; return '<button type="button" class="dsh-drow" data-go="instalments"><span class="dsh-plate' + (late ? ' bad' : '') + '">' + esc(c.plate) + '</span><span class="grow"><span>Due ' + dshLbl(+it.due) + '</span><span class="b2' + (late ? ' dsh-bad' : '') + '">' + (late ? plural(Math.round((t0 - dshD0(it.due)) / DAY), 'day') + ' late' : UI.fmt.inDays(it.due)) + '</span></span>' + UI.chip(UI.fmt.money(it.amount), late ? 'bad' : 'grey') + '</button>'; }).join('') }) : '';
      var days7 = []; for (var k = 0; k < 7; k++) { var a = t0 + k * DAY, z = a + DAY; days7.push({ t: a, road: d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start.getTime() < z && x.end.getTime() > a; }).length, out: d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start.getTime() >= a && x.start.getTime() < z; }).length, back: d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.end.getTime() >= a && x.end.getTime() < z; }).length }); }
      var mr = Math.max.apply(0, days7.map(function (x) { return x.road; }).concat([1])), goingOut = sum(days7.map(function (x) { return x.out; }));
      var weekCard = card({ id: 'ahead', icon: 'calendar', title: 'The week ahead', sub: plural(goingOut, 'car') + ' going out in the next 7 days.', body: '<div class="legend"><span><i style="background:#4a6b8f"></i>Cars on the road that day</span></div><div class="dsh-week">' + days7.map(function (x, k) { var dd = new Date(x.t); return '<button type="button" class="dsh-wday' + (k === 0 ? ' today' : '') + '" data-go="schedules" title="Open the schedules"><b>' + x.road + '</b><span class="dsh-wbar"><i style="height:' + (x.road / mr * 100).toFixed(1) + '%"></i></span><span class="dsh-wd">' + (k === 0 ? 'Today' : WD[dd.getDay()]) + '</span><small>' + dshLbl(x.t) + '</small><span class="dsh-wio">' + i('arrow-up-right') + '<b>' + x.out + '</b> out<br>' + i('arrow-down-left') + '<b>' + x.back + '</b> back</span></button>'; }).join('') + '</div>', table: { cols: ['Day', 'On the road', 'Out', 'Back'], rows: days7.map(function (x) { return [UI.fmt.short(new Date(x.t)), String(x.road), String(x.out), String(x.back)]; }) } });
      return chapter('fleet', 'Fleet and papers', 'Where every car is, what is due, and the week ahead.') + '<div class="grid dsh-g75">' + fleetCard + papersCard + '</div>' + instCard + weekCard + '</section>';
    }

    /* ---------- 8. Cash ---------- */
    function secCash() {
      var now = NOW(), t0 = dshD0(now), wd = (new Date(t0).getDay() + 6) % 7, wk = t0 - wd * DAY, mo = dshMonth(now.getFullYear(), now.getMonth());
      var pays = d.payments.filter(function (p) { return !p.void; });
      var box = function (title, since, from) {
        var main = 0, side = 0, dep = 0;
        pays.forEach(function (p) { if (p.at < from || p.at > now || p.method === 'Deposit adjustment') return; var x = findBooking(p.booking); if (p.kind === 'Security deposit') dep += p.amount; else if (x && (x.status === 'Pending' || x.status === 'Cancelled')) side += p.amount; else main += p.amount; });
        return '<div class="card dsh-cash"><div><b>' + title + '</b><span class="b2">' + since + '</span></div><b class="dsh-cashv num">' + UI.fmt.money(main) + '</b><p class="b2">Rental and other payments received. Cash, not revenue.</p><div class="dsh-cashside"><span>On pending or cancelled bookings (not revenue)</span><b class="num">' + UI.fmt.money(side) + '</b><span>Deposits taken (not income)</span><b class="num">' + UI.fmt.money(dep) + '</b></div></div>';
      };
      var wait = d.deposits.filter(function (z) { return !z.refund && !z.markedByHand; }).map(function (z) { var x = findBooking(z.booking); return x ? { x: x, amt: Math.max(0, x.dep - sum(z.deductions.map(function (q) { return q.amount; }))) } : null; }).filter(Boolean);
      var dep = '<div class="card dsh-cash"><div><b>Deposits to give back</b><span class="b2">Car back, what is left after deductions</span></div><div class="row gap8 wrap"><b class="dsh-cashv num">' + UI.fmt.money(sum(wait.map(function (w) { return w.amt; }))) + '</b>' + UI.chip(plural(wait.length, 'booking'), 'grey') + '</div><div class="dsh-deplist">' + wait.map(function (w) { return '<button type="button" data-go="deposits" data-p="' + esc(JSON.stringify({ booking: w.x.code })) + '"><span class="ellip">' + esc(w.x.cust.name) + ' ' + w.x.code + '</span><b class="num">' + UI.fmt.money(w.amt) + '</b></button>'; }).join('') + '</div></div>';
      return chapter('cash', 'Cash', 'Money recorded as received, not revenue. Revenue is the Total income at the top of the page, which leaves out pending and cancelled bookings. A payment on a pending or cancelled booking did arrive, so it is counted here and shown on its own line. Security deposits are shown separately and are not income. Refunds are not taken off.') +
        '<div class="grid g4 dsh-cashg">' + box('Cash received today', dshLbl(t0), t0) + box('Cash received this week', 'Since ' + dshLbl(wk), wk) + box('Cash received this month', 'Since ' + dshLbl(mo), mo) + dep + '</div></section>';
    }

    /* ---------- count-up on the hero figure ---------- */
    function countUp() {
      var el = root.querySelector('[data-count]'); if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var to = +el.getAttribute('data-count'), isM = el.getAttribute('data-money') === '1', t0 = performance.now();
      var step = function (t) { var k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); if (!document.contains(el)) return; el.textContent = isM ? UI.fmt.money(to * e) : n0(to * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }

    /* ---------- events ---------- */
    var jump = function (id) { var sec = /^dsh-([a-z]+)$/.exec(id); if (sec && st.phone && FOLDS.indexOf(sec[1]) >= 0 && !st.open[sec[1]]) { st.open[sec[1]] = true; draw(); }
      var el = document.getElementById(id); if (el) { window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' }); el.classList.add('dsh-flash'); setTimeout(function () { el.classList.remove('dsh-flash'); }, 1400); } };
    function setPeriod(v) { st.period = v; dshLS('period', v); draw({ count: true }); }
    function datesPop(anchor) {
      var t0 = new Date(dshD0(NOW()));
      UI.popover(anchor, function (el, pop) {
        el.innerHTML = '<div class="col gap12 dsh-dates"><b>Choose the dates</b>' + UI.input({ key: 'from', label: 'From', type: 'date', value: st.from || UI.isoDate(new Date(t0.getTime() - 13 * DAY)) }) + UI.input({ key: 'to', label: 'To', type: 'date', value: st.to || UI.isoDate(t0) }) + '<span class="ui-err" hidden>The last day must be on or after the first.</span><div class="row gap8" style="justify-content:flex-end">' + UI.btn('Cancel', { kind: 'g', size: 'sm', attrs: { 'data-x': 1 } }) + UI.btn('Show', { size: 'sm', attrs: { 'data-ok': 1 } }) + '</div></div>';
        el.querySelector('[data-x]').onclick = function () { pop.close(); };
        el.querySelector('[data-ok]').onclick = function () { var f = UI.form(el); if (!f.from || !f.to || f.to < f.from) { el.querySelector('.ui-err').hidden = false; return; } st.from = f.from; st.to = f.to; dshLS('from', f.from); dshLS('to', f.to); pop.close(); setPeriod('dates'); };
      }, { width: 300 });
    }
    function doRefresh() {
      st.busy = true; draw();
      setTimeout(function () {
        st.busy = false;
        if (st.failNext || navigator.onLine === false) { st.failNext = false; st.failed = true; draw(); return; }
        st.failed = false; st.updated = NOW(); draw(); UI.toast('Up to date', { tone: 'ok', ms: 1600 });
      }, 650);
    }
    UI.on(root, 'click', '[data-act],[data-jump],[data-open],[data-follow],[data-go],[data-seg],[data-leg],[data-ftab],[data-summons],[data-car]', function (ev, el) {
      var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
      if (el.hasAttribute('data-jump')) { jump(el.getAttribute('data-jump')); return; }
      if (el.hasAttribute('data-open')) { var code = el.getAttribute('data-open'); if (findBooking(code)) ctx.api.openBooking(code); return; }
      if (el.hasAttribute('data-summons')) { ctx.api.openSummons(el.getAttribute('data-summons')); return; }
      if (el.hasAttribute('data-car')) { ctx.api.openCar(el.getAttribute('data-car')); return; }
      if (el.hasAttribute('data-follow')) { var id = el.getAttribute('data-follow'); st.follow = st.follow === id ? null : id; draw(); if (st.follow) UI.toast('Following ' + carById(id).plate + ' in the car charts', { tone: 'info', ms: 2000 }); return; }
      if (el.hasAttribute('data-go')) { var p = el.getAttribute('data-p'); ctx.go(el.getAttribute('data-go'), p ? JSON.parse(p) : {}); return; }
      if (el.hasAttribute('data-seg')) { st[el.getAttribute('data-seg')] = el.getAttribute('data-v'); draw(); return; }
      if (el.hasAttribute('data-leg')) { var lg = el.getAttribute('data-leg'), k = el.getAttribute('data-k'); st.hidden[lg] = st.hidden[lg] || {}; st.hidden[lg][k] = !st.hidden[lg][k]; draw(); return; }
      if (el.hasAttribute('data-ftab')) { st.fleetTab = el.getAttribute('data-ftab'); draw(); return; }
      if (a === 'period') { if (v === 'dates') datesPop(el); else setPeriod(v); }
      else if (a === 'herotable') { st.heroTable = !st.heroTable; draw(); }
      else if (a === 'table') { st.tables[v] = !st.tables[v]; draw(); }
      else if (a === 'more') { st.more[v] = !st.more[v]; draw(); }
      else if (a === 'refresh') doRefresh();
      else if (a === 'slip') ctx.api.uploadSlips();
      else if (a === 'expense') ctx.api.addExpense();
      else if (a === 'bankin') ctx.api.bankIn();
      else if (a === 'unfold') { st.open[v] = true; draw(); jump('dsh-' + v); }
      else if (a === 'notcounted') { ctx.go('reports', { action: 'carscounted' }); }
      else if (a === 'unfollow') { st.follow = null; draw(); }
      else if (a === 'opencar') ctx.api.openCar(v);
      else if (a === 'info') UI.popover(el, '<p class="b2" style="margin:0;padding:12px 14px">' + esc(v) + '</p>', { width: 280, align: 'start' });
    });
    UI.on(root, 'keydown', 'li[data-follow],li[data-open]', function (ev, el) { if (ev.key === 'Enter') el.click(); });
    UI.on(root, 'change', '[data-act="year"],[data-act="idle"]', function (ev, el) { if (el.getAttribute('data-act') === 'year') st.year = +el.value; else st.idle = +el.value; draw(); });
    /* expenses added from the quick button refresh the page through the data bus; every minute the figures are worked out again */
    var timer = setInterval(function () { if (!document.contains(root)) { clearInterval(timer); return; } if (document.hidden || UI.top()) return; st.updated = NOW(); draw(); }, 60000);
    /* the phone layout follows the screen width */
    try { var mq = window.matchMedia('(max-width: 760px)'), onMq = function () { if (!document.contains(root)) { mq.removeEventListener('change', onMq); return; } draw(); }; mq.addEventListener('change', onMq); } catch (e) { /* older browsers keep the layout they opened with */ }
    draw({ count: true });
  }
};

/* services due (reminders) and papers expiring, for the Dashboard: [{kind, car, what, when, left (days), note}] */
function dshDue(d) {
  var now = NOW(), t0 = dshD0(now), out = [];
  d.reminders.forEach(function (r) {
    if (!r.on || (r.snoozedUntil && r.snoozedUntil > now)) return;
    var c = carById(r.car, d); if (!c || c.fleet === 'Sold') return;
    var byDay = r.days && r.lastAt ? dshD0(r.lastAt.getTime() + r.days * DAY) : null, byKm = r.km && r.lastKm ? r.lastKm + r.km - c.odo : null;
    var leftD = byDay != null ? Math.round((byDay - t0) / DAY) : null, leftK = byKm != null ? Math.round(byKm / 120) : null;
    if (leftD == null && leftK == null) return;
    var left = Math.min(leftD == null ? 9999 : leftD, leftK == null ? 9999 : leftK);
    out.push({ kind: 'service', car: c, what: r.service, when: new Date(t0 + left * DAY), left: left, note: leftK != null && leftK === left ? (byKm < 0 ? n0(-byKm) + ' km past the service distance' : n0(byKm) + ' km left') : '' });
  });
  var latest = {};
  d.papers.forEach(function (p) { if (!p.until) return; var k = p.car + '|' + p.kind; if (!latest[k] || p.until > latest[k].until) latest[k] = p; });
  Object.keys(latest).forEach(function (k) { var p = latest[k], c = carById(p.car, d); if (!c || c.fleet === 'Sold') return; out.push({ kind: 'paper', car: c, what: p.kind, when: p.until, left: Math.round((dshD0(p.until) - t0) / DAY) }); });
  return out.sort(function (a, b) { return a.left - b.left; });
}

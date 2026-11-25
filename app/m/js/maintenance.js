/* ---------------- MAINTENANCE (M7 builder owns this file) ----------------
   #maintenance[?tab=due|workshop|papers|log|vendors&q=plate]
   Tiles (also the tabs): Overdue with the soon count, In the workshop, Papers expiring, Spent this month (maintenance.see_costs).
   API: Maint.log({car, type, status ('done'|'planned'|'workshop'), jobId}), Maint.job(id), Maint.renew({car, type}), Maint.carBack(downtimeId),
        Maint.block({car}), Maint.serviceInfo(car) -> {next, words, level} | null, Maint.jobRow(job, compact) -> html, Maint.dueItems().
   Rules (from the company's maintenance rules): workshop time is S.downtime and blocks rentals through busy(); putting a car in the workshop over
   bookings shows the clashes and needs maintenance.manage_downtime to go ahead; a finished job is never dated in the future; odometers only go up. */

var MT = { tab: 'due', f: 'all', q: '', logF: 'all', papF: 'due' };
VIEW_STATE.push(function () { MT.tab = 'due'; MT.f = 'all'; MT.q = ''; MT.logF = 'all'; MT.papF = 'due'; });

var Maint = (function () {
  var JOB_STATUS = { done: { label: 'Done', tone: 'green' }, planned: { label: 'Planned', tone: 'blue' }, workshop: { label: 'In the workshop', tone: 'orange' }, cancelled: { label: 'Cancelled', tone: 'grey' } };
  var REASONS = ['Service', 'Repair', 'Accident', 'Inspection', 'Other'];
  var VENDOR_KINDS = ['Workshop', 'Tyres', 'Body shop', 'Aircond', 'Car wash', 'Towing', 'Other'];
  var BASE_TYPES = ['Oil change', 'General service'];
  function types() { return (B().serviceTypes || []).map(function (t) { return t.name; }); }
  function typeDef(name) { return (B().serviceTypes || []).filter(function (t) { return t.name === name; })[0] || null; }
  function vendor(id) { return byId(S.vendors, id); }
  /* a new job starts on the workshop this car used last time, or on 'Not said': never on a workshop nobody chose */
  function mtLastVendor(carId) { if (!carId) return ''; var j = (S.jobs || []).filter(function (x) { return x.car === carId && x.vendor && vendor(x.vendor); }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); })[0]; return j ? j.vendor : ''; }
  function seeCost() { return can('maintenance.see_costs'); }
  function endOfDay(ymdS) { return new Date(ymdS + 'T18:00:00'); }
  function dueWords(days, kmLeft, expires) {
    var p = [], verb = expires ? 'Expires' : 'Due';
    if (days != null) { if (days < 0) p.push(expires ? 'Expired ' + (-days) + ' day' + (days === -1 ? '' : 's') + ' ago' : 'Overdue by ' + (-days) + ' day' + (days === -1 ? '' : 's')); else if (days === 0) p.push(verb + ' today'); else p.push(verb + ' in ' + days + ' day' + (days === 1 ? '' : 's')); }
    if (kmLeft != null) p.push(kmLeft < 0 ? Math.abs(kmLeft).toLocaleString('en-US') + ' km over' : kmLeft.toLocaleString('en-US') + ' km to go');
    return p.join(' · ');
  }

  /* ---------- what is due ---------- */
  /* service reminders of one car: the regular service from the car (last service km/date and its interval) plus any job with 'remind me after' */
  function reminders(c) {
    var out = [], odo = M7.odo(c.id) || 0, oil = typeDef('Oil change') || { km: 10000, days: 180 };
    if (c.lastServiceKm || c.lastServiceAt) {
      var everyKm = +c.serviceEveryKm || oil.km || 0, everyDays = c.serviceEveryDays != null ? +c.serviceEveryDays : (oil.days || 0);
      out.push(mk('Oil change', c.lastServiceKm && everyKm ? +c.lastServiceKm + everyKm : null, c.lastServiceAt && everyDays ? new Date(new Date(c.lastServiceAt).getTime() + everyDays * DAY) : null));
    }
    var latest = {};
    (S.jobs || []).forEach(function (j) { if (j.car !== c.id || j.status !== 'done' || BASE_TYPES.indexOf(j.type) >= 0) return; if (!latest[j.type] || new Date(j.at) > new Date(latest[j.type].at)) latest[j.type] = j; });
    Object.keys(latest).forEach(function (t) { var j = latest[t], base = j.km || j.kmEst; if (!j.remindKm && !j.remindDays) return; out.push(mk(t, j.remindKm && base ? +base + +j.remindKm : null, j.remindDays ? new Date(new Date(j.at).getTime() + j.remindDays * DAY) : null)); });
    function mk(type, nextKm, nextAt) {
      var kmLeft = nextKm != null ? nextKm - odo : null, days = nextAt ? daysUntil(nextAt) : null;
      var level = (kmLeft != null && kmLeft < 0) || (days != null && days < 0) ? 'overdue' : (kmLeft != null && kmLeft <= 1000) || (days != null && days <= 30) ? 'soon' : 'ok';
      return { type: type, nextKm: nextKm, nextAt: nextAt, kmLeft: kmLeft, days: days, level: level };
    }
    return out.filter(function (r) { return r.nextKm != null || r.nextAt; });
  }
  var LV = { overdue: 0, soon: 1, ok: 2 };
  function serviceInfo(c) {
    var rs = reminders(c).sort(function (a, b) { return LV[a.level] - LV[b.level] || (a.days == null ? 999 : a.days) - (b.days == null ? 999 : b.days); });
    var r = rs[0]; if (!r) return null;
    var next = [r.nextKm != null ? 'At ' + M7.km(r.nextKm) : '', r.nextAt ? (r.nextKm != null ? 'or ' : 'On ') + dFull(r.nextAt) : ''].filter(Boolean).join(' ');
    return { type: r.type, next: r.type + ': ' + next, words: dueWords(r.days, r.kmLeft), level: r.level };
  }
  function hidden() { var h = (S.prefs && S.prefs.mtHide) || {}, n = Date.now(), out = {}; Object.keys(h).forEach(function (k) { if (new Date(h[k]).getTime() > n) out[k] = h[k]; }); return out; }
  function dueItems(opts) {
    opts = opts || {}; var items = [], hid = opts.all ? {} : hidden();
    S.cars.forEach(function (c) {
      if (c.status !== 'active') return;
      reminders(c).forEach(function (r) { if (r.level === 'ok') return; items.push({ key: 's:' + c.id + ':' + r.type, kind: 'service', car: c, title: r.type, words: dueWords(r.days, r.kmLeft), level: r.level, days: r.days == null ? (r.kmLeft < 0 ? -1 : 30) : r.days, type: r.type, kmOver: r.kmLeft != null && r.kmLeft < 0, dateOver: r.days != null && r.days < 0 }); });
      ['Road tax', 'Insurance', 'PUSPAKOM', 'Permit'].forEach(function (t) {
        var p = carPaper(c.id, t), s = M7.paperState(p); if (!p || (s.level !== 'overdue' && s.level !== 'soon')) return;
        items.push({ key: 'p:' + c.id + ':' + t, kind: 'paper', car: c, title: M7.PAPER_LABEL[t], words: s.text + ' (' + M7.ymd(p.until) + ')', level: s.level, days: s.days, type: t, paper: p });
      });
    });
    (S.jobs || []).forEach(function (j) {
      if (j.status !== 'planned') return; var c = car(j.car); if (!c || c.status === 'sold') return; var d = daysUntil(j.at); if (d > 14) return;
      items.push({ key: 'j:' + j.id, kind: 'job', car: c, title: j.type + ' (planned)', words: (d < 0 ? 'Planned for ' + dFull(j.at) + ', not done yet' : 'Planned ' + dayWord(j.at).toLowerCase().replace(/^(mon|tue|wed|thu|fri|sat|sun)/, function (m) { return m[0].toUpperCase() + m.slice(1); }) + ', ' + hm(j.at)) + (j.vendor && vendor(j.vendor) ? ' · ' + vendor(j.vendor).name : ''), level: d < 0 ? 'overdue' : 'soon', days: d, job: j });
    });
    return items.filter(function (i) { return !hid[i.key]; }).sort(function (a, b) { return LV[a.level] - LV[b.level] || a.days - b.days || a.car.plate.localeCompare(b.car.plate); });
  }
  function workshopNow() { var n = Date.now(); return (S.downtime || []).filter(function (d) { return !d.to || new Date(d.to).getTime() > n; }).sort(function (a, b) { return new Date(a.from) - new Date(b.from); }); }
  /* the expense kinds that are upkeep of a car (from the company's expense kinds) */
  function carCostKinds() { return (B().expenseKinds || []).filter(function (k) { return ['service', 'repair', 'tyres'].indexOf(k.id) >= 0; }).map(function (k) { return k.name; }); }
  function spentThisMonth() {
    var d0 = new Date(), m0 = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime(), s = 0;
    (S.jobs || []).forEach(function (j) { if (j.status === 'done' && new Date(j.doneAt || j.at).getTime() >= m0) s += +j.cost || 0; });
    (S.papers || []).forEach(function (p) { if (new Date(p.at).getTime() >= m0 && new Date(p.at).getTime() <= Date.now()) s += +p.cost || 0; });
    /* service, repair and tyre costs the team recorded in Expenses against a car count too (one figure for what the cars cost to keep) */
    var kinds = carCostKinds();
    (S.expenses || []).forEach(function (e) { if (!e.voided && e.car && kinds.indexOf(e.kind) >= 0 && new Date(e.at).getTime() >= m0 && new Date(e.at).getTime() <= Date.now()) s += +e.amt || 0; });
    return Math.round(s * 100) / 100;
  }
  /* the booking the car is out on right now (handed over, not back yet), or null */
  function carOut(carId) { var b = carNow(carId); return b && b.bookingStatus === 'Car Delivered' ? b : null; }
  /* bookings that would clash with workshop time from..to (to null = open ended) */
  function clashes(carId, from, to) {
    var f = new Date(from).getTime(), t = to ? new Date(to).getTime() : Infinity;
    return S.bookings.filter(function (b) { return b.car === carId && blocksCar(b) && new Date(b.start).getTime() < t && new Date(b.end).getTime() > f; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
  }
  function clashHtml(list) {
    if (!list.length) return '';
    return '<div class="banner red mt-clash">' + I('warn') + '<div><b>' + list.length + ' rental' + (list.length === 1 ? ' clashes' : 's clash') + ' with this.</b> Move ' + (list.length === 1 ? 'it' : 'them') + ' to another car:' +
      '<ul>' + list.slice(0, 5).map(function (b) { return '<li><a href="#booking/' + b.id + '">' + esc(b.code) + '</a> ' + esc(cust(b.cust).name) + ', ' + esc(dShort(b.start)) + ' to ' + esc(dShort(b.end)) + '</li>'; }).join('') + (list.length > 5 ? '<li>and ' + (list.length - 5) + ' more</li>' : '') + '</ul>' +
      (can('maintenance.manage_downtime') ? '' : '<div class="mt-clash-no">Ask the owner for <b>Workshop blocks</b> access to go ahead anyway.</div>') + '</div></div>';
  }

  /* ---------- the screen ---------- */
  function view(r) {
    if (!can('maintenance.view')) return { html: topbar('Maintenance', { back: '#more' }) + '<main>' + noAccess('maintenance.view') + '</main>' };
    if (freshVisit('maintenance') && MT.deep && !(r.q && r.q.tab)) { MT.tab = 'due'; MT.q = ''; MT.deep = false; }
    if (r.q && r.q.tab) { MT.tab = r.q.tab; MT.q = r.q.q || ''; MT.deep = !!r.q.q; if (MT.tab === 'log') MT.logF = 'all'; try { history.replaceState(history.state, '', location.pathname + location.search + '#maintenance'); } catch (e) {} }
    var due = dueItems(), ws = workshopNow(), now = Date.now(), wsNow = ws.filter(function (d) { return new Date(d.from).getTime() <= now; }).length;
    var papersDue = due.filter(function (i) { return i.kind === 'paper'; }).length;
    /* the tiles are the tabs for To do, Workshop and Papers; the To do tile counts what is overdue (the same number as the More badge) */
    var tile = function (tab, icon, k, v, tone, small) { return '<button type="button" class="tile mt-tile' + (MT.tab === tab ? ' on' : '') + '" data-tab="' + tab + '" aria-pressed="' + (MT.tab === tab) + '"><div class="k">' + I(icon) + esc(k) + '</div><div class="v' + (tone ? ' ' + tone : '') + '">' + v + '</div>' + (small ? '<small class="mt-tsub">' + esc(small) + '</small>' : '') + '</button>'; };
    var nOver = due.filter(function (i) { return i.level === 'overdue'; }).length, nSoon = due.length - nOver;
    var tiles = '<div class="tiles mt-tiles">' + tile('due', 'warn', 'Overdue', nOver, nOver ? 'tone-red-text' : '', nSoon ? nSoon + ' soon' : 'Nothing soon') + tile('workshop', 'wrench', 'In the workshop', wsNow) +
      tile('papers', 'file', 'Papers expiring', papersDue, papersDue ? 'tone-amber-text' : '') + (seeCost() ? '<div class="tile mt-tile"><div class="k">' + I('cash') + 'Spent on cars this month</div><div class="v money mt-spent">' + rm(spentThisMonth()) + '</div><small class="mt-tsub">Jobs, papers, service expenses</small></div>' : '') + '</div>';
    var tabs = [['log', 'Service log'], ['vendors', 'Workshops list']];
    var html = topbar('Maintenance', { back: '#more', sub: S.cars.filter(function (c) { return c.status === 'active'; }).length + ' active cars' }) + '<main class="mt-main">' + tiles +
      '<div class="mt-tabs chiprow">' + tabs.map(function (t) { return '<button type="button" class="mt-tab' + (MT.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="mtbody"></div></main>' +
      (can('maintenance.create') ? '<button class="fab fab-x" onclick="Maint.log({})" aria-label="Log a service">' + I('wrench', 2.2) + '<span>Service</span></button>' : '');
    return { html: html, after: function () {
      $$('[data-tab]').forEach(function (b) { b.onclick = function () { MT.tab = b.dataset.tab; render(false, true); }; });
      var on = $('.mt-tab.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      ({ due: drawDue, workshop: drawWorkshop, papers: drawPapers, log: drawLog, vendors: drawVendors }[MT.tab] || drawDue)();
    } };
  }
  function body(html) { $('#mtbody').innerHTML = html; }

  /* Due now */
  function drawDue() {
    var q = (MT.q || '').trim(), F = [['all', 'Everything'], ['service', 'Services'], ['paper', 'Renewals'], ['job', 'Planned']];
    var all = dueItems().filter(function (i) { if (!q) return true; var c = i.car || {}; return normPlate(c.plate).indexOf(normPlate(q)) >= 0 || wordsMatch(q, [c.plate, c.make, c.model, i.title].join(' ')); });
    var list = all.filter(function (i) { return MT.f === 'all' || i.kind === MT.f; });
    var nh = Object.keys(hidden()).length;
    var html = searchBox('Plate or model') + '<div class="chiprow mt-chips">' + F.map(function (f) { var n = all.filter(function (i) { return f[0] === 'all' || i.kind === f[0]; }).length; return '<button type="button" class="fchip' + (MT.f === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + ' <span class="n">' + n + '</span></button>'; }).join('') + '</div>';
    if (!list.length && q) html += '<div class="empty card mt-empty">Nothing due matches “' + esc(q) + '”.</div>';
    else if (!list.length) html += '<div class="empty card mt-empty">' + I('check') + '<div><b>Nothing due. Nice.</b><br>No service is late, no paper is about to expire and no job is waiting.</div></div>';
    else {
      var od = list.filter(function (i) { return i.level === 'overdue'; }), sn = list.filter(function (i) { return i.level === 'soon'; });
      if (od.length) html += '<div class="sec"><h2>Overdue (' + od.length + ')</h2></div>' + od.map(dueCard).join('');
      if (sn.length) html += '<div class="sec"><h2>Coming up soon (' + sn.length + ')</h2></div>' + sn.map(dueCard).join('');
    }
    if (nh) html += '<button type="button" class="btn link mt-unhide" id="mtunhide">' + nh + ' hidden for now · Show them again</button>';
    body(html);
    wireSearch(drawDue);
    $$('.mt-chips [data-f]').forEach(function (b) { b.onclick = function () { MT.f = b.dataset.f; drawDue(); }; });
    var u = $('#mtunhide'); if (u) u.onclick = function () { S.prefs.mtHide = {}; save(); drawDue(); render(false, true); };
    $$('[data-due]').forEach(function (b) {
      b.onclick = function () {
        var it = all.filter(function (i) { return i.key === b.dataset.key; })[0]; if (!it) return;
        var a = b.dataset.due;
        if (a === 'log') log({ car: it.car.id, type: it.type, status: 'done' });
        else if (a === 'renew') renew({ car: it.car.id, type: it.type });
        else if (a === 'job') job(it.job.id);
        else if (a === 'hide') hideSheet(it);
      };
    });
  }
  function dueCard(i) {
    var btn = i.kind === 'service' ? (can('maintenance.create') ? '<button type="button" class="btn sm" data-due="log" data-key="' + esc(i.key) + '">' + I('wrench') + 'Log service</button>' : '')
      : i.kind === 'paper' ? (can('maintenance.manage_documents') ? '<button type="button" class="btn sm" data-due="renew" data-key="' + esc(i.key) + '">' + I('file') + 'Renew</button>' : '')
      : '<button type="button" class="btn sm" data-due="job" data-key="' + esc(i.key) + '">Open job</button>';
    return '<div class="mt-due ' + i.level + '"><div class="mt-due-top"><a class="mt-due-plate" href="#car/' + i.car.id + '">' + esc(i.car.plate) + '</a><span class="mt-due-model">' + esc(i.car.make + ' ' + i.car.model) + '</span>' + chip(i.level === 'overdue' ? 'Overdue' : 'Due soon', i.level === 'overdue' ? 'red' : 'amber') + '</div>' +
      '<div class="mt-due-t">' + esc(i.title) + '</div><div class="mt-due-w">' + esc(i.words) + '</div>' +
      '<div class="mt-due-btns">' + btn + '<button type="button" class="btn ghost sm" data-due="hide" data-key="' + esc(i.key) + '">Hide</button></div></div>';
  }
  function hideSheet(it) {
    sheet(sheetHead('Hide for a while', it.car.plate + ' · ' + it.title) + '<p class="lead">It comes back on its own. Nothing is changed.</p>' +
      '<div class="mt-hide">' + [1, 3, 7].map(function (d) { return '<button type="button" class="btn ghost" data-d="' + d + '">' + d + ' day' + (d > 1 ? 's' : '') + '</button>'; }).join('') + '</div>', function (sh) {
        $$('[data-d]', sh).forEach(function (b) { b.onclick = function () { var d = +b.dataset.d, keep = hidden(); S.prefs.mtHide = keep; S.prefs.mtHide[it.key] = new Date(Date.now() + d * DAY).toISOString(); save(); closeSheet(); render(false, true); undoSnack('Hidden for ' + d + ' day' + (d > 1 ? 's' : ''), function () { delete S.prefs.mtHide[it.key]; save(); render(false, true); }); }; });
      });
  }

  /* Workshop */
  function drawWorkshop() {
    var ws = workshopNow(), n = Date.now();
    var html = can('maintenance.manage_downtime') ? '<button type="button" class="btn ghost mt-topbtn" id="mtblock">' + I('lock') + 'Block a car for the workshop</button>' : '';
    if (!ws.length) html += '<div class="empty card mt-empty">' + I('wrench') + '<div>No car is in the workshop. Every car can be booked.</div></div>';
    else html += ws.map(function (d) {
      var c = car(d.car) || { plate: '?', make: '', model: '' }, j = d.jobId ? byId(S.jobs, d.jobId) : null, isNow = new Date(d.from).getTime() <= n, cl = clashes(d.car, d.from, d.to).filter(function (b) { return b.bookingStatus !== 'Car Delivered' || new Date(b.start) > new Date(d.from); });
      return '<div class="mt-ws"><div class="mt-due-top"><a class="mt-due-plate" href="#car/' + d.car + '">' + esc(c.plate) + '</a><span class="mt-due-model">' + esc(c.make + ' ' + c.model) + '</span>' + chip(isNow ? 'In now' : 'Booked in', isNow ? 'orange' : 'blue') + '</div>' +
        '<div class="mt-due-t">' + esc(d.reason || 'Workshop') + '</div><div class="mt-due-w">' + (d.to ? (isNow ? 'Since ' + esc(when(d.from)) + ' · back by ' : esc(when(d.from)) + ' to ') + esc(when(d.to)) : 'Since ' + esc(when(d.from)) + ' · return date not set yet') + '</div>' +
        (cl.length ? '<div class="mt-wscl">' + I('warn') + cl.length + ' rental' + (cl.length === 1 ? ' clashes' : 's clash') + ': ' + cl.slice(0, 3).map(function (b) { return '<a href="#booking/' + b.id + '">' + esc(b.code) + '</a>'; }).join(', ') + '</div>' : '') +
        '<div class="mt-due-btns">' + (isNow && can('maintenance.edit') ? '<button type="button" class="btn sm mt-green" data-back="' + d.id + '">' + I('check') + 'Car is back</button>' : '') +
        (j ? '<button type="button" class="btn ghost sm" data-job="' + j.id + '">Open job</button>' : '') + (can('maintenance.manage_downtime') ? '<button type="button" class="btn link sm mt-rm" data-rm="' + d.id + '">Remove</button>' : '') + '</div></div>';
    }).join('');
    body(html);
    var bl = $('#mtblock'); if (bl) bl.onclick = function () { block({}); };
    $$('[data-back]').forEach(function (b) { b.onclick = function () { carBack(b.dataset.back); }; });
    $$('#mtbody [data-job]').forEach(function (b) { b.onclick = function () { job(b.dataset.job); }; });
    $$('[data-rm]').forEach(function (b) { b.onclick = function () { removeDowntime(b.dataset.rm); }; });
  }
  function removeDowntime(id) {
    var d = byId(S.downtime, id); if (!d) return;
    confirm({ icon: 'warn', title: 'Remove this workshop time?', text: 'The car will show as free for these dates again.', ok: 'Yes, remove', danger: true }).then(function (ok) {
      if (!ok) return; S.downtime = S.downtime.filter(function (x) { return x.id !== id; });
      var c = car(d.car); audit('Workshop time removed for ' + (c ? c.plate : 'a car'), { car: d.car, link: '#car/' + d.car }); save(); render(false, true); say('Workshop time removed');
    });
  }
  /* the car is back from the workshop: a job finishes through its done sheet; a plain block just ends now */
  function carBack(dtId) {
    var d = byId(S.downtime, dtId); if (!d) return;
    var j = d.jobId ? byId(S.jobs, d.jobId) : null;
    if (j && j.status === 'workshop') { finish(j.id, true); return; }
    var c = car(d.car);
    confirm({ icon: 'info', title: 'Is ' + (c ? c.plate : 'the car') + ' back?', text: 'The car can be booked again from now.', ok: 'Yes, the car is back', cancel: 'Not yet' }).then(function (ok) {
      if (!ok) return; d.to = new Date().toISOString(); audit((c ? c.plate : 'Car') + ' is back from the workshop', { car: d.car, link: '#car/' + d.car }); save(); render(false, true); say('Marked as back. The car can be booked again.');
    });
  }

  /* Papers */
  function drawPapers() {
    var rows = [];
    S.cars.forEach(function (c) { if (c.status === 'sold') return; ['Road tax', 'Insurance', 'PUSPAKOM', 'Permit'].forEach(function (t) { var p = carPaper(c.id, t); if (p) rows.push({ c: c, p: p, s: M7.paperState(p) }); }); });
    var q = MT.q.trim(), np = normPlate(q);
    if (q) rows = rows.filter(function (r) { return normPlate(r.c.plate).indexOf(np) >= 0 || wordsMatch(q, r.c.make + ' ' + r.c.model + ' ' + r.p.type); });
    var F = [['due', 'Expired or soon'], ['Road tax', 'Road tax'], ['Insurance', 'Insurance'], ['all', 'All']];
    var list = rows.filter(function (r) { return MT.papF === 'all' ? true : MT.papF === 'due' ? r.s.level === 'overdue' || r.s.level === 'soon' : r.p.type === MT.papF; }).sort(function (a, b) { return (a.s.days == null ? 9999 : a.s.days) - (b.s.days == null ? 9999 : b.s.days); });
    var html = searchBox('Plate or model') + '<div class="chiprow mt-chips">' + F.map(function (f) { return '<button type="button" class="fchip' + (MT.papF === f[0] ? ' on' : '') + '" data-pf="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (can('maintenance.manage_documents') ? '<button type="button" class="btn ghost mt-topbtn" id="mtrenew">' + I('file') + 'Renew or add a paper</button>' : '');
    html += list.length ? '<div class="list">' + list.map(function (r) {
      return '<button type="button" class="card2 mt-pap" data-car="' + r.c.id + '" data-type="' + esc(r.p.type) + '"><div class="c2-main"><div class="c2-t1">' + esc(r.c.plate) + ' · ' + esc(M7.PAPER_LABEL[r.p.type]) + '</div><div class="c2-t2">Valid until ' + esc(M7.ymd(r.p.until)) + (r.p.insurer ? ' · ' + esc(r.p.insurer) : '') + '</div></div>' + chip(r.s.text, r.s.tone) + '</button>';
    }).join('') + '</div>' : '<div class="empty card">' + I('file') + '<div>' + (q ? 'No paper matches “' + esc(q) + '”.' : 'No paper is expired or about to expire.') + '</div></div>';
    body(html); wireSearch(drawPapers);
    $$('[data-pf]').forEach(function (b) { b.onclick = function () { MT.papF = b.dataset.pf; drawPapers(); }; });
    var rn = $('#mtrenew'); if (rn) rn.onclick = function () { renew({}); };
    $$('.mt-pap').forEach(function (b) { b.onclick = function () { if (can('maintenance.manage_documents')) renew({ car: b.dataset.car, type: b.dataset.type }); else CarPage.open(b.dataset.car); }; });
  }
  function searchBox(ph) { return '<label class="search mt-search">' + I('search') + '<input id="mtq" type="search" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" placeholder="' + esc(ph) + '" value="' + esc(MT.q) + '">' + searchClearBtn('mtq', MT.q) + '</label>'; }
  function wireSearch(redraw) {
    var q = $('#mtq'), t = null; if (!q) return;
    wireSearchClear(q, function () { MT.q = ''; MT.deep = false; redraw(); });
    q.oninput = function () { clearTimeout(t); t = setTimeout(function () { MT.q = q.value; MT.deep = false; var pos = q.selectionStart; redraw(); var n = $('#mtq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150); };
  }

  /* Log */
  function jobRow(j, compact) {
    var c = car(j.car) || { plate: '?' }, st = JOB_STATUS[j.status] || JOB_STATUS.done, v = vendor(j.vendor);
    return '<button type="button" class="card2 mt-job" onclick="Maint.job(\'' + j.id + '\')"><div class="c2-main"><div class="c2-t1">' + (compact ? '' : esc(c.plate) + ' · ') + esc(j.type) + '</div><div class="c2-t2">' + esc(dFull(j.at)) + (j.km ? ' · ' + esc(M7.km(j.km)) : '') + (v ? ' · ' + esc(v.name) : '') + '</div></div>' +
      '<div class="c2-end">' + (seeCost() && j.cost ? '<span class="money">' + rm(j.cost) + '</span>' : '') + '<small>' + chip(st.label, st.tone) + '</small></div></button>';
  }
  function drawLog() {
    var q = MT.q.trim(), np = normPlate(q), F = [['all', 'All'], ['done', 'Done'], ['planned', 'Planned'], ['workshop', 'In the workshop'], ['cancelled', 'Cancelled']];
    var jobs = (S.jobs || []).filter(function (j) { var c = car(j.car); if (!c) return false; return !q || normPlate(c.plate).indexOf(np) >= 0 || wordsMatch(q, [c.make, c.model, j.type, j.note, (vendor(j.vendor) || {}).name].join(' ')); });
    var list = jobs.filter(function (j) { return MT.logF === 'all' || j.status === MT.logF; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    var shown = list.slice(0, MT.n || 40);
    var html = searchBox('Plate, model, work or workshop') + '<div class="chiprow mt-chips">' + F.map(function (f) { var n = jobs.filter(function (j) { return f[0] === 'all' || j.status === f[0]; }).length; return '<button type="button" class="fchip' + (MT.logF === f[0] ? ' on' : '') + '" data-lf="' + f[0] + '">' + f[1] + ' <span class="n">' + n + '</span></button>'; }).join('') + '</div>' +
      (seeCost() && list.length ? '<div class="mt-sum">' + list.length + ' job' + (list.length === 1 ? '' : 's') + ' · total <b class="money">' + rm(list.filter(function (j) { return j.status === 'done'; }).reduce(function (s, j) { return s + (+j.cost || 0); }, 0)) + '</b></div>' : '');
    html += shown.length ? '<div class="list">' + shown.map(function (j) { return jobRow(j); }).join('') + '</div>' + (list.length > shown.length ? '<button type="button" class="btn ghost mt-more" id="mtmore">Show more (' + (list.length - shown.length) + ')</button>' : '') : '<div class="empty card">' + I('wrench') + '<div>No job matches' + (q ? ' “' + esc(q) + '”' : '') + '.</div></div>';
    body(html); wireSearch(drawLog);
    $$('[data-lf]').forEach(function (b) { b.onclick = function () { MT.logF = b.dataset.lf; MT.n = 40; drawLog(); }; });
    var m = $('#mtmore'); if (m) m.onclick = function () { MT.n = (MT.n || 40) + 40; drawLog(); };
  }

  /* Workshops (vendors) */
  function drawVendors() {
    var vs = (S.vendors || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var html = can('maintenance.edit') ? '<button type="button" class="btn ghost mt-topbtn" id="mtaddv">' + I('plus') + 'Add a workshop</button>' : '';
    html += vs.length ? vs.map(function (v) {
      var tel = M7.telOf(v.phone), n = (S.jobs || []).filter(function (j) { return j.vendor === v.id && j.status === 'done'; }).length;
      return '<div class="mt-vendor"><div class="mt-vtop"><div class="mt-vic">' + I(v.kind === 'Towing' ? 'car' : v.kind === 'Car wash' ? 'paint' : 'wrench') + '</div><div class="grow"><div class="mt-vname">' + esc(v.name) + '</div><div class="mt-vsub">' + esc([v.kind, v.area].filter(Boolean).join(' · ')) + (n ? ' · ' + n + ' job' + (n === 1 ? '' : 's') : '') + '</div><div class="mt-vsub">' + esc(v.phone || 'No phone yet') + '</div></div></div>' +
        (tel ? '<div class="mt-vbtns"><a class="btn ghost" href="tel:' + esc(tel) + '">' + I('phone') + 'Call</a><button type="button" class="btn mt-wa" data-wa="' + esc(v.phone) + '">' + I('wa') + 'WhatsApp</button></div>' : '') + '</div>';
    }).join('') : '<div class="empty card">' + I('wrench') + '<div>No workshops yet.</div></div>';
    body(html);
    var a = $('#mtaddv'); if (a) a.onclick = function () { addVendor(function () { render(false, true); }); };
    $$('[data-wa]').forEach(function (b) { b.onclick = function () { Share.wa(b.dataset.wa, 'Hi, this is ' + myName() + ' from ' + B().name + '. '); }; });
  }
  function addVendor(done) {
    var kind = 'Workshop';
    sheet(sheetHead('Add a workshop') +
      '<label class="field"><span>Name</span><input class="inp" id="mvn" autocomplete="off" placeholder="For example Bengkel Setia"></label>' +
      '<div class="field"><span>What they do</span><div class="seg" id="mvk">' + VENDOR_KINDS.map(function (k) { return '<button type="button" class="' + (k === kind ? 'on' : '') + '">' + k + '</button>'; }).join('') + '</div></div>' +
      '<label class="field"><span>Phone</span><input class="inp" id="mvp" inputmode="tel" autocomplete="off" placeholder="012-345 6789"></label>' +
      '<label class="field"><span>Area (optional)</span><input class="inp" id="mva" autocomplete="off" value="' + esc(B().city || '') + '"></label><small class="err" id="mverr" hidden></small>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="mvok">Add workshop</button></div>', function (sh) {
        segPick('#mvk', function (t) { kind = t; });
        setTimeout(function () { try { $('#mvn', sh).focus({ preventScroll: true }); } catch (e) {} }, 300);
        $('#mvok', sh).onclick = function () {
          var name = $('#mvn', sh).value.trim(), ph = $('#mvp', sh).value.trim(), err = $('#mverr', sh);
          if (!name) { err.textContent = 'Type the workshop name.'; err.hidden = false; return; }
          if (ph && digits(ph).length < 9) { err.textContent = 'That phone number looks too short.'; err.hidden = false; return; }
          var v = { id: 'v' + uid(), name: name, kind: kind, phone: ph ? fmtPhone(ph) : '', area: $('#mva', sh).value.trim() };
          S.vendors = (S.vendors || []).concat(v); audit('Added workshop ' + name); save(); closeSheet(); say('Workshop added'); if (done) done(v);
        };
      }, { stack: true });
  }

  /* ---------- log a service ---------- */
  function log(o) {
    o = o || {};
    if (!can('maintenance.create')) { say('Ask the owner for Log services access'); return; }
    var c0 = o.car ? car(o.car) : null, td = o.type ? typeDef(o.type) : null;
    var f = { car: c0 ? c0.id : null, type: o.type || '', status: o.status || 'done', date: toLocalInput(new Date()), cost: '', km: '', vendor: mtLastVendor(c0 ? c0.id : null), block: true, back: '', photo: null, remind: !!(td && (td.km || td.days)), remindKm: td && td.km ? String(td.km) : '', remindDays: td && td.days ? String(td.days) : '', note: '' };
    if (o.status === 'planned') f.date = toLocalInput(new Date(Date.now() + DAY));
    var allTypes = types(); if (f.type && allTypes.indexOf(f.type) < 0) allTypes.push(f.type);
    var mg = formGuard(function () { return [f.car, f.type, f.status, f.photo ? 1 : 0]; });
    var sh = sheet(sheetHead({ done: 'Log a service', planned: 'Plan a job', workshop: 'Car goes into the workshop' }[f.status] || 'Log a service') +
      '<div class="field"><span>Car</span><button type="button" class="carfield" id="mlcar"></button></div>' +
      '<div class="field"><span>What was done</span><div class="seg mt-types" id="mltype">' + allTypes.map(function (t) { return '<button type="button" class="' + (t === f.type ? 'on' : '') + '">' + esc(t) + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><span>Status</span><div class="seg mt-st" id="mlst">' + [['done', 'It is done'], ['planned', 'Plan it for later'], ['workshop', 'Car is in the workshop now']].map(function (s) { return '<button type="button" data-v="' + s[0] + '" class="' + (f.status === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="mt-2"><label class="field"><span id="mldl">Date</span><input class="inp" type="date" id="mldate" value="' + f.date + '"></label>' +
      (seeCost() ? '<label class="field"><span id="mlcl">Total cost</span><div class="rmfield"><input class="inp" id="mlcost" inputmode="decimal" autocomplete="off" placeholder="0.00"></div></label>' : '') + '</div>' +
      '<label class="field" id="mlkmf"><span>Odometer at the service (km)</span><input class="inp num" id="mlkm" inputmode="numeric" autocomplete="off"><small class="hint" id="mlkmh"></small></label>' +
      '<div class="field"><span>Workshop</span><div class="mt-vrow"><select class="inp" id="mlv"></select><button type="button" class="iconbtn mt-addv" id="mladdv" aria-label="Add a new workshop">' + I('plus') + '</button></div></div>' +
      '<div id="mlblockbox"><label class="cr-switch"><span><b>Block this car for rentals</b><small>While it is in the workshop</small></span><span class="sw"><input type="checkbox" id="mlblock" checked><i></i></span></label>' +
      '<label class="field" id="mlbackf"><span>Expected back (optional)</span><input class="inp" type="date" id="mlback" min="' + toLocalInput(new Date()) + '"><small class="hint">Leave empty if you do not know yet</small></label><div id="mlclash"></div></div>' +
      M7.photoField('mlph', 'Invoice photo (optional)', null) +
      '<div id="mlremindbox"><label class="cr-switch"><span><b>Remind me when the next one is due</b><small>Shows on Maintenance when it is due</small></span><span class="sw"><input type="checkbox" id="mlrem"' + (f.remind ? ' checked' : '') + '><i></i></span></label>' +
      '<div class="mt-2" id="mlremf"><label class="field"><span>After how many km</span><input class="inp num" id="mlrkm" inputmode="numeric" value="' + esc(f.remindKm) + '" placeholder="10000"></label><label class="field"><span>Or after how many days</span><input class="inp num" id="mlrd" inputmode="numeric" value="' + esc(f.remindDays) + '" placeholder="180"></label></div></div>' +
      '<label class="field"><span>Note (optional)</span><textarea class="inp cr-ta" id="mlnote" rows="2" placeholder="What was done, what the mechanic said"></textarea></label>' +
      '<small class="err" id="mlerr" hidden></small>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="mlok">Save service</button></div>', null, { full: true, guard: function () { return mg(); } });
    mg.arm(sh);
    var fillVendors = function (sel) { $('#mlv', sh).innerHTML = '<option value="">Not said</option>' + (S.vendors || []).map(function (v) { return '<option value="' + v.id + '"' + (v.id === sel ? ' selected' : '') + '>' + esc(v.name) + (v.kind && v.kind !== 'Workshop' ? ' (' + esc(v.kind) + ')' : '') + '</option>'; }).join(''); };
    fillVendors(f.vendor);
    var drawCar = function () {
      var c = f.car && car(f.car), b = $('#mlcar', sh);
      b.className = 'carfield ' + (c ? 'picked-car' : 'empty-car');
      b.innerHTML = c ? '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model) + ' · ' + esc(M7.km(M7.odo(c.id))) + '</span></span>' + I('chev') : I('car') + '<span class="grow">Choose the car</span>' + I('chev');
      $('#mlkmh', sh).textContent = c && M7.odo(c.id) ? 'Last known: ' + M7.km(M7.odo(c.id)) : '';
    };
    var sync = function () {
      var s = f.status;
      $('#mldl', sh).textContent = s === 'planned' ? 'Planned date' : s === 'workshop' ? 'Went in on' : 'Date';
      var dIn = $('#mldate', sh); dIn.max = s === 'planned' ? '' : toLocalInput(new Date()); dIn.min = s === 'planned' ? toLocalInput(new Date()) : '';
      if (s === 'planned' && dIn.value < toLocalInput(new Date())) dIn.value = toLocalInput(new Date(Date.now() + DAY));
      if (s !== 'planned' && dIn.value > toLocalInput(new Date())) dIn.value = toLocalInput(new Date());
      var cl = $('#mlcl', sh); if (cl) cl.textContent = s === 'done' ? 'Total cost' : 'Estimated cost';
      $('#mlkmf', sh).hidden = s === 'planned';
      $('#mlblockbox', sh).hidden = s !== 'workshop';
      $('#mlbackf', sh).hidden = !$('#mlblock', sh).checked;
      $('#mlremindbox', sh).hidden = s !== 'done';
      $('#mlremf', sh).hidden = !$('#mlrem', sh).checked;
      $('#mlok', sh).textContent = s === 'planned' ? 'Plan the job' : s === 'workshop' ? 'Put in workshop' : 'Save service';
      var h3 = $('.sheet-head h3', sh); if (h3) h3.textContent = { done: 'Log a service', planned: 'Plan a job', workshop: 'Car goes into the workshop' }[s];
      drawClash();
    };
    var curClash = [];
    var drawClash = function () {
      var box = $('#mlclash', sh); curClash = [];
      if (f.status === 'workshop' && f.car && $('#mlblock', sh).checked) {
        var ds = $('#mldate', sh).value, from = sameDay(ds + 'T12:00:00', new Date()) ? new Date() : new Date(ds + 'T09:00:00'), bk2 = $('#mlback', sh).value;
        curClash = clashes(f.car, from, bk2 ? endOfDay(bk2) : null);
      }
      /* a car out on rent cannot be in the workshop now: offer to plan it for the day it comes back */
      var out = f.status === 'workshop' && f.car ? carOut(f.car) : null;
      box.innerHTML = out ? '<div class="banner red mt-clash mt-out">' + I('warn') + '<div><b>' + esc(car(f.car).plate) + ' is out on rent</b> with ' + esc(cust(out.cust).name) + ' (' + esc(out.code) + ') until ' + esc(when(out.end)) + '. It cannot be in the workshop now.' +
        '<button type="button" class="btn sm" id="mlplanback">' + I('cal') + 'Plan it for when it is back</button></div></div>' : clashHtml(curClash);
      var pb = $('#mlplanback', sh); if (pb) pb.onclick = function () {
        f.status = 'planned'; var back = new Date(out.end), d = toLocalInput(back) < toLocalInput(new Date()) ? toLocalInput(new Date()) : toLocalInput(back);
        sh.querySelectorAll('#mlst button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === 'planned'); });
        sync(); $('#mldate', sh).value = d; say('Planned for ' + dShort(d + 'T10:00:00'));
      };
      var ok = $('#mlok', sh);
      if (out) { ok.disabled = true; ok.classList.remove('mt-dbtn'); return; }
      if (f.status === 'workshop' && curClash.length) { ok.textContent = 'Put the car in the workshop anyway'; ok.disabled = !can('maintenance.manage_downtime'); ok.classList.toggle('mt-dbtn', true); }
      else { ok.disabled = false; ok.classList.remove('mt-dbtn'); }
    };
    drawCar(); sync();
    $('#mlcar', sh).onclick = function () { Pickers.car({ selected: f.car, title: 'Which car?', onPick: function (c) { f.car = c.id; drawCar(); drawClash(); } }); };
    segPick('#mltype', function (t) {
      f.type = t; var d = typeDef(t);
      if (d) { $('#mlrkm', sh).value = d.km || ''; $('#mlrd', sh).value = d.days || ''; $('#mlrem', sh).checked = !!(d.km || d.days); sync(); }
    });
    segPick('#mlst', function (t, b) { f.status = b.dataset.v; sync(); });
    $('#mlblock', sh).onchange = sync; $('#mlrem', sh).onchange = sync;
    $('#mlback', sh).onchange = drawClash; $('#mldate', sh).onchange = drawClash;
    $('#mladdv', sh).onclick = function () { addVendor(function (v) { fillVendors(v.id); }); };
    var kmIn = $('#mlkm', sh); kmIn.addEventListener('input', function () { var d = kmIn.value.replace(/[^\d]/g, ''); kmIn.value = d ? (+d).toLocaleString('en-US') : ''; });
    M7.wirePhoto(sh, 'mlph', function (u) { f.photo = u; }, { kind: 'receipt', sample: 'Workshop bill', maxPx: 900 });
    $('#mlok', sh).onclick = function () { mlSave(false); };
    var mlSave = function (okClash) {
      var err = $('#mlerr', sh), fail = function (t) { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); };
      err.hidden = true;
      var c = f.car && car(f.car);
      if (!c) return fail('Choose the car.');
      if (!f.type) return fail('Choose what was done.');
      var ds = $('#mldate', sh).value; if (!ds) return fail('Pick the date.');
      var today = toLocalInput(new Date());
      if (f.status !== 'planned' && ds > today) return fail('A finished job cannot be dated in the future.');
      if (f.status === 'planned' && ds < today) return fail('A planned job needs today or a later date.');
      var at = ds === today && f.status !== 'planned' ? new Date() : new Date(ds + (f.status === 'planned' ? 'T10:00:00' : 'T12:00:00'));
      if (at > new Date() && f.status !== 'planned') at = new Date();
      var costEl = $('#mlcost', sh), cost = costEl && costEl.value.trim() ? parseMoney(costEl.value) : 0;
      if (isNaN(cost)) return fail('Type the cost as an amount, for example 180 or 180.50.');
      var kmv = kmIn.value.trim() && f.status !== 'planned' ? M7.kmNum(kmIn.value) : null;
      if (kmv != null) { var pr = CarPage.kmProblem(c.id, kmv, at); if (pr) return fail(pr); }
      var remKm = null, remDays = null;
      if (f.status === 'done' && $('#mlrem', sh).checked) {
        remKm = $('#mlrkm', sh).value.trim() ? M7.kmNum($('#mlrkm', sh).value) : null; remDays = $('#mlrd', sh).value.trim() ? +digits($('#mlrd', sh).value) : null;
        if ((remKm != null && isNaN(remKm)) || (!remKm && !remDays)) return fail('Type after how many km or days to remind you.');
      }
      var back = $('#mlback', sh).value, block = f.status === 'workshop' && $('#mlblock', sh).checked;
      if (f.status === 'workshop' && carOut(c.id)) return fail(c.plate + ' is out on rent. Plan the job for when it is back.');
      if (block && curClash.length && !can('maintenance.manage_downtime')) return fail('Rentals clash with this. Move them first, or ask the owner for Workshop blocks access.');
      if (block && curClash.length && !okClash) {
        confirm({ icon: 'warn', title: 'Block the car over ' + curClash.length + ' booking' + (curClash.length > 1 ? 's' : '') + '?', text: curClash.map(function (b) { return b.code + ' ' + cust(b.cust).name; }).slice(0, 3).join(', ') + (curClash.length > 3 ? ' and more' : '') + ' will need another car.', ok: 'Put in workshop', cancel: 'Go back', primary: 'cancel', danger: true })
          .then(function (y) { if (y) mlSave(true); });
        return;
      }
      var j = { id: uid(), car: c.id, type: f.type, status: f.status, at: at.toISOString(), cost: cost || 0, km: kmv, vendor: $('#mlv', sh).value || null, note: $('#mlnote', sh).value.trim(), photo: f.photo, remindKm: remKm, remindDays: remDays, by: S.me, created: new Date().toISOString(), backAt: null };
      if (f.status === 'done') { j.doneAt = j.at; if (kmv == null) j.kmEst = M7.odo(c.id); }
      S.jobs = S.jobs || []; S.jobs.push(j);
      if (block) { var dt = { id: uid(), car: c.id, from: at.toISOString(), to: back ? endOfDay(back).toISOString() : null, reason: f.type + (j.note ? ': ' + j.note : ''), jobId: j.id, by: S.me }; S.downtime = (S.downtime || []).concat(dt); j.backAt = dt.to; j.startedAt = dt.from; }
      if (f.status === 'workshop') j.startedAt = at.toISOString();
      if (f.status === 'done') doneEffects(j, c);
      audit({ done: 'Service logged', planned: 'Job planned', workshop: 'Car went into the workshop' }[f.status] + ': ' + c.plate + ', ' + f.type + (block && curClash.length ? ' (over ' + curClash.length + ' booking' + (curClash.length > 1 ? 's' : '') + ')' : ''), { car: c.id, link: '#car/' + c.id });
      save(); closeSheet(false, true); render(false, true);
      say({ done: 'Service saved', planned: 'Job planned', workshop: 'Car is now in the workshop' }[f.status]);
    };
    return sh;
  }
  /* a finished job: odometer reading, car km, the regular service clock */
  function doneEffects(j, c) {
    if (j.km != null) { S.odometer = (S.odometer || []).concat({ id: uid(), car: c.id, km: j.km, at: j.doneAt || j.at, source: 'service', by: S.me, trusted: true, booking: null, job: j.id }); if (j.km > (+c.km || 0)) c.km = j.km; }
    if (BASE_TYPES.indexOf(j.type) >= 0) {
      c.lastServiceKm = j.km != null ? j.km : (j.kmEst || M7.odo(c.id)); c.lastServiceAt = j.doneAt || j.at;
      if (j.remindKm) c.serviceEveryKm = j.remindKm;
      if (j.remindDays != null) c.serviceEveryDays = j.remindDays;
    }
  }

  /* ---------- one job ---------- */
  function job(id) {
    var j = byId(S.jobs, id); if (!j) { say('This job is not there any more'); return; }
    var c = car(j.car) || { plate: '?', make: '', model: '', id: j.car }, st = JOB_STATUS[j.status] || JOB_STATUS.done, v = vendor(j.vendor), dt = (S.downtime || []).filter(function (d) { return d.jobId === j.id; })[0];
    var tl = [];
    tl.push([j.status === 'planned' ? 'Planned for' : 'Service date', when(j.at), 'cal']);
    if (j.startedAt && j.status !== 'planned') tl.push(['Car went into the workshop', when(j.startedAt), 'wrench']);
    if (dt) tl.push(['Blocked for rentals', dt.to ? 'Until ' + when(dt.to) : 'Until the job is marked as done', 'lock']);
    if (j.status === 'done' && j.doneAt && j.doneAt !== j.at) tl.push(['Marked as done', when(j.doneAt), 'check']);
    if (j.status === 'cancelled') tl.push(['Cancelled', j.cancelledAt ? when(j.cancelledAt) : '', 'x']);
    var btns = [];
    if (j.status === 'planned' && can('maintenance.edit')) { btns.push('<button type="button" class="btn" data-a="in">' + I('wrench') + 'Car goes into the workshop</button>'); btns.push('<button type="button" class="btn ghost" data-a="done">' + I('check') + 'Mark as done</button>'); }
    if (j.status === 'workshop' && can('maintenance.edit')) btns.push('<button type="button" class="btn mt-green" data-a="back">' + I('check') + 'Car is back, mark as done</button>');
    if ((j.status === 'planned' || j.status === 'workshop') && can('maintenance.edit')) btns.push('<button type="button" class="btn link red" data-a="cancel">Cancel job</button>');
    if ((j.status === 'done' || j.status === 'cancelled') && can('maintenance.delete')) btns.push('<button type="button" class="btn link red" data-a="del">' + I('trash') + 'Delete job</button>');
    sheet(sheetHead(j.type, c.plate + ' · ' + c.make + ' ' + c.model) + '<div class="mt-jchips">' + chip(st.label, st.tone) + (seeCost() && j.cost ? '<span class="money mt-jcost">' + rm(j.cost) + (j.status !== 'done' ? ' <small>estimate</small>' : '') + '</span>' : '') + '</div>' +
      '<div class="mt-tl">' + tl.map(function (t) { return '<div class="mt-tlrow"><span class="mt-tlic">' + I(t[2]) + '</span><div><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div></div>'; }).join('') + '</div>' +
      '<div class="kv"><div><div class="k">Car</div><div class="v"><a href="#car/' + c.id + '" class="mt-link">' + esc(c.plate) + '</a></div></div><div><div class="k">Workshop</div><div class="v">' + esc(v ? v.name : 'Not said') + '</div></div>' +
      '<div><div class="k">Odometer</div><div class="v">' + esc(j.km ? M7.km(j.km) : j.kmEst ? 'About ' + M7.km(j.kmEst) : 'Not recorded') + '</div></div><div><div class="k">Next reminder</div><div class="v">' + esc(j.remindKm || j.remindDays ? [j.remindKm ? 'after ' + M7.km(j.remindKm) : '', j.remindDays ? 'after ' + j.remindDays + ' days' : ''].filter(Boolean).join(' or ') : 'None') + '</div></div></div>' +
      (j.note ? '<div class="card mt-jnote">' + esc(j.note) + '</div>' : '') +
      (j.photo ? '<div class="sec"><h2>Invoice</h2></div><div class="thumbs">' + M7.thumb(j.photo, ' id="mjph"') + '</div>' : '') +
      '<p class="hint">Logged by ' + esc(who(j.by) || 'someone') + ' on ' + esc(dFull(j.created || j.at)) + '</p>' +
      (btns.length ? '<div class="sheet-foot stack">' + btns.join('') + '</div>' : ''), function (sh) {
        var ph = $('#mjph', sh); if (ph) ph.onclick = function () { M7.zoom(j.photo, { title: 'Invoice', sub: c.plate + ' · ' + j.type }); };
        $$('[data-a]', sh).forEach(function (b) {
          b.onclick = function () {
            var a = b.dataset.a;
            if (a === 'in') startWorkshop(j.id);
            else if (a === 'done' || a === 'back') finish(j.id, a === 'back');
            else if (a === 'cancel') confirm({ icon: 'warn', title: 'Cancel this job?', text: 'The job stays in the log as cancelled and the car is released from the workshop.', ok: 'Cancel job', cancel: 'Keep it', danger: true }).then(function (ok) {
              if (!ok) return; j.status = 'cancelled'; j.cancelledAt = new Date().toISOString(); releaseDowntime(j);
              audit('Job cancelled: ' + c.plate + ', ' + j.type, { car: c.id, link: '#car/' + c.id }); save(); closeAllSheetsKeep(); render(false, true); say('Job cancelled');
            });
            else if (a === 'del') confirm({ icon: 'danger', title: 'Delete this job?', text: 'Use this only for a job logged by mistake. Its odometer reading goes too.', ok: 'Delete job', danger: true }).then(function (ok) {
              if (!ok) return; S.jobs = S.jobs.filter(function (x) { return x.id !== j.id; }); S.odometer = (S.odometer || []).filter(function (o) { return o.job !== j.id; }); S.downtime = (S.downtime || []).filter(function (d) { return d.jobId !== j.id; });
              audit('Job deleted: ' + c.plate + ', ' + j.type, { car: c.id, link: '#car/' + c.id }); save(); closeAllSheetsKeep(); render(false, true); say('Job deleted');
            });
          };
        });
      });
  }
  function closeAllSheetsKeep() { var n = SHEETS.length; if (!n) return; var st = history.state && history.state.fmsSheet; closeAllSheets(); if (st) { _ignorePop++; history.go(-n); } }
  function releaseDowntime(j) {
    var n = new Date();
    (S.downtime || []).forEach(function (d) { if (d.jobId !== j.id) return; if (new Date(d.from) > n) d.cancelled = true; else if (!d.to || new Date(d.to) > n) d.to = n.toISOString(); });
    S.downtime = (S.downtime || []).filter(function (d) { return !d.cancelled; });
    j.backAt = n.toISOString();
  }
  /* planned job -> the car goes into the workshop now */
  function startWorkshop(id) {
    var j = byId(S.jobs, id); if (!j) return; var c = car(j.car);
    sheet(sheetHead('Car goes into the workshop', c.plate + ' · ' + j.type) +
      '<label class="cr-switch"><span><b>Block this car for rentals while it is there</b></span><span class="sw"><input type="checkbox" id="swblk" checked><i></i></span></label>' +
      '<label class="field" id="swbf"><span>Expected back (optional)</span><input class="inp" type="date" id="swback" min="' + toLocalInput(new Date()) + '"><small class="hint">Leave empty if you do not know yet</small></label><div id="swcl"></div>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="swok">Put in workshop</button></div>', function (sh) {
        var cl = [];
        var draw = function () {
          var on = $('#swblk', sh).checked, bk2 = $('#swback', sh).value; $('#swbf', sh).hidden = !on;
          cl = on ? clashes(c.id, new Date(), bk2 ? endOfDay(bk2) : null) : [];
          $('#swcl', sh).innerHTML = clashHtml(cl);
          var ok = $('#swok', sh); ok.textContent = cl.length ? 'Put the car in the workshop anyway' : 'Put in workshop'; ok.disabled = cl.length && !can('maintenance.manage_downtime'); ok.classList.toggle('mt-dbtn', !!cl.length);
        };
        $('#swblk', sh).onchange = draw; $('#swback', sh).onchange = draw; draw();
        $('#swok', sh).onclick = function () {
          var now = new Date().toISOString(), bk2 = $('#swback', sh).value;
          j.status = 'workshop'; j.startedAt = now;
          if ($('#swblk', sh).checked) { var d = { id: uid(), car: c.id, from: now, to: bk2 ? endOfDay(bk2).toISOString() : null, reason: j.type + (j.note && j.note !== 'Planned' ? ': ' + j.note : ''), jobId: j.id, by: S.me }; S.downtime = (S.downtime || []).concat(d); j.backAt = d.to; }
          audit('Car went into the workshop: ' + c.plate + ', ' + j.type + (cl.length ? ' (over ' + cl.length + ' booking' + (cl.length > 1 ? 's' : '') + ')' : ''), { car: c.id, link: '#car/' + c.id });
          save(); closeAllSheetsKeep(); render(false, true); say('The car is now in the workshop');
        };
      }, { stack: true });
  }
  /* mark a job as done (and the car back when it was in the workshop) */
  function finish(id, back) {
    var j = byId(S.jobs, id); if (!j) return; var c = car(j.car), photo = j.photo || null;
    var td = typeDef(j.type);
    sheet(sheetHead(back ? 'Car is back' : 'Mark as done', c.plate + ' · ' + j.type) + (back ? '<p class="lead">The car can be booked again from now.</p>' : '') +
      '<div class="mt-2"><label class="field"><span>Done on</span><input class="inp" type="date" id="mfd" max="' + toLocalInput(new Date()) + '" value="' + toLocalInput(new Date()) + '"></label>' +
      (seeCost() ? '<label class="field"><span>Total cost</span><div class="rmfield"><input class="inp" id="mfc" inputmode="decimal" value="' + (j.cost ? money2(j.cost) : '') + '" placeholder="0.00"></div></label>' : '') + '</div>' +
      '<label class="field"><span>Odometer (km)</span><input class="inp num" id="mfk" inputmode="numeric" autocomplete="off" placeholder="Last known: ' + esc(M7.km(M7.odo(c.id))) + '"></label>' +
      M7.photoField('mfph', 'Invoice photo (optional)', photo) +
      '<label class="cr-switch"><span><b>Remind me when the next one is due</b></span><span class="sw"><input type="checkbox" id="mfrem"' + (td && (td.km || td.days) ? ' checked' : '') + '><i></i></span></label>' +
      '<small class="err" id="mferr" hidden></small>' +
      '<div class="sheet-foot"><button type="button" class="btn mt-green" id="mfok">' + I('check') + (back ? 'Car is back, mark as done' : 'Mark as done') + '</button></div>', function (sh) {
        var kmIn = $('#mfk', sh); kmIn.addEventListener('input', function () { var d = kmIn.value.replace(/[^\d]/g, ''); kmIn.value = d ? (+d).toLocaleString('en-US') : ''; });
        M7.wirePhoto(sh, 'mfph', function (u) { photo = u; }, { kind: 'receipt', sample: 'Workshop bill', maxPx: 900 });
        $('#mfok', sh).onclick = function () {
          var err = $('#mferr', sh), fail = function (t) { err.textContent = t; err.hidden = false; };
          var ds = $('#mfd', sh).value || toLocalInput(new Date()); if (ds > toLocalInput(new Date())) return fail('A finished job cannot be dated in the future.');
          var at = ds === toLocalInput(new Date()) ? new Date() : new Date(ds + 'T12:00:00');
          var ce = $('#mfc', sh), cost = ce && ce.value.trim() ? parseMoney(ce.value) : (j.cost || 0); if (isNaN(cost)) return fail('Type the cost as an amount, for example 180 or 180.50.');
          var kmv = kmIn.value.trim() ? M7.kmNum(kmIn.value) : null; if (kmv != null) { var pr = CarPage.kmProblem(c.id, kmv, at); if (pr) return fail(pr); }
          j.status = 'done'; j.doneAt = at.toISOString(); if (new Date(j.at) > at) j.at = j.doneAt; j.cost = cost; j.km = kmv; if (kmv == null) j.kmEst = M7.odo(c.id); j.photo = photo;
          if ($('#mfrem', sh).checked && td) { j.remindKm = td.km || null; j.remindDays = td.days || null; }
          releaseDowntime(j); doneEffects(j, c);
          audit((back ? c.plate + ' is back from the workshop, ' : 'Job done: ' + c.plate + ', ') + j.type, { car: c.id, link: '#car/' + c.id });
          save(); closeAllSheetsKeep(); render(false, true); say(back ? 'Marked as back. The car can be booked again.' : 'Job marked as done');
        };
      }, { stack: true });
  }

  /* ---------- block a car (workshop time without a job) ---------- */
  function block(o) {
    o = o || {}; if (!can('maintenance.manage_downtime')) { say('Ask the owner for Workshop blocks access'); return; }
    var f = { car: o.car || null, reason: 'Repair' };
    var sh = sheet(sheetHead('Block a car for the workshop') +
      '<div class="field"><span>Car</span><button type="button" class="carfield" id="mbcar"></button></div>' +
      '<div class="mt-2"><label class="field"><span>Goes in</span><input class="inp" type="date" id="mbfrom" min="' + toLocalInput(new Date()) + '" value="' + toLocalInput(new Date()) + '"></label>' +
      '<label class="field"><span>Expected back (optional)</span><input class="inp" type="date" id="mbto" min="' + toLocalInput(new Date()) + '"></label></div>' +
      '<div class="field"><span>Why</span><div class="seg" id="mbr">' + REASONS.map(function (r) { return '<button type="button" class="' + (r === f.reason ? 'on' : '') + '">' + r + '</button>'; }).join('') + '</div></div>' +
      '<label class="field"><span>Note (optional)</span><input class="inp" id="mbnote" autocomplete="off" placeholder="For example waiting for parts"></label><div id="mbcl"></div><small class="err" id="mberr" hidden></small>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="mbok">Block the car</button></div>', null, { full: true });
    var cl = [];
    var range = function () { var fd = $('#mbfrom', sh).value, from = fd === toLocalInput(new Date()) ? new Date() : new Date(fd + 'T09:00:00'), td = $('#mbto', sh).value; return { from: from, to: td ? endOfDay(td) : null }; };
    var draw = function () {
      var c = f.car && car(f.car), b = $('#mbcar', sh);
      b.className = 'carfield ' + (c ? 'picked-car' : 'empty-car');
      b.innerHTML = c ? '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model) + '</span></span>' + I('chev') : I('car') + '<span class="grow">Choose the car</span>' + I('chev');
      var r = range(); cl = c ? clashes(c.id, r.from, r.to) : [];
      $('#mbcl', sh).innerHTML = clashHtml(cl);
      $('#mbok', sh).textContent = cl.length ? 'Put the car in the workshop anyway' : 'Block the car'; $('#mbok', sh).classList.toggle('mt-dbtn', !!cl.length);
    };
    draw();
    $('#mbcar', sh).onclick = function () { Pickers.car({ selected: f.car, onPick: function (c) { f.car = c.id; draw(); } }); };
    segPick('#mbr', function (t) { f.reason = t; });
    $('#mbfrom', sh).onchange = draw; $('#mbto', sh).onchange = draw;
    $('#mbok', sh).onclick = function () {
      var err = $('#mberr', sh), c = f.car && car(f.car), r = range();
      if (!c) { err.textContent = 'Choose the car.'; err.hidden = false; return; }
      if (r.to && r.to <= r.from) { err.textContent = 'Expected back must be after the day it goes in.'; err.hidden = false; return; }
      var note = $('#mbnote', sh).value.trim();
      S.downtime = (S.downtime || []).concat({ id: uid(), car: c.id, from: r.from.toISOString(), to: r.to ? r.to.toISOString() : null, reason: f.reason + (note ? ': ' + note : ''), jobId: null, by: S.me });
      audit('Blocked ' + c.plate + ' for the workshop' + (cl.length ? ' (over ' + cl.length + ' booking' + (cl.length > 1 ? 's' : '') + ')' : ''), { car: c.id, link: '#car/' + c.id });
      save(); closeSheet(); render(false, true); say('The car is blocked for rentals during this time');
    };
  }

  /* ---------- renew a paper ---------- */
  function renew(o) {
    o = o || {}; if (!can('maintenance.manage_documents')) { say('Ask the owner for Car papers access'); return; }
    var f = { car: o.car || null, type: o.type || 'Road tax', photo: null, read: null };
    var cur = function () { return f.car ? carPaper(f.car, f.type) : null; };
    var sh = sheet(sheetHead('Renew a paper', 'Road tax, insurance and other car papers') +
      '<div class="field"><span>Car</span><button type="button" class="carfield" id="mrcar"></button></div>' +
      '<div class="field"><span>Type</span><div class="seg" id="mrtype">' + M7.PAPER_TYPES.map(function (t) { return '<button type="button" data-v="' + t + '" class="' + (t === f.type ? 'on' : '') + '">' + esc(M7.PAPER_LABEL[t]) + '</button>'; }).join('') + '</div></div>' +
      '<div id="mrcur"></div>' +
      '<div class="mt-snap"><button type="button" class="btn ghost" id="mrsnap">' + I('camera') + 'Snap the paper</button><button type="button" class="btn link sm" id="mrsample">Use a sample picture</button></div><div id="mrread"></div>' +
      '<div class="mt-2"><label class="field"><span>Valid until</span><input class="inp" type="date" id="mruntil"></label><label class="field"><span>Warn me (days before)</span><input class="inp num" id="mrwarn" inputmode="numeric" value="30"></label></div>' +
      '<label class="field" id="mrinsf"><span>Insurer</span><input class="inp" id="mrins" autocomplete="off" list="mrinsl" placeholder="For example Etiqa"><datalist id="mrinsl">' + ['Etiqa', 'Allianz', 'Zurich', 'Takaful Malaysia', 'AmGeneral', 'Tokio Marine'].map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></label>' +
      '<div class="mt-2">' + (seeCost() ? '<label class="field"><span>Cost</span><div class="rmfield"><input class="inp" id="mrcost" inputmode="decimal" placeholder="0.00"></div></label>' : '') + '<label class="field"><span>Reference no (optional)</span><input class="inp" id="mrref" autocomplete="off"></label></div>' +
      '<small class="err" id="mrerr" hidden></small>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="mrok">Save paper</button></div>', null, { full: true });
    var drawCar = function () {
      var c = f.car && car(f.car), b = $('#mrcar', sh);
      b.className = 'carfield ' + (c ? 'picked-car' : 'empty-car');
      b.innerHTML = c ? '<span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model) + '</span></span>' + I('chev') : I('car') + '<span class="grow">Choose the car</span>' + I('chev');
    };
    var drawType = function () {
      var p = cur(), s = M7.paperState(p);
      $('#mrcur', sh).innerHTML = f.car ? '<div class="mt-curpaper">' + (p ? 'Now: ' + (p.until ? 'valid until <b>' + esc(M7.ymd(p.until)) + '</b>' : 'on file') + ' ' + chip(s.text, s.tone) : 'No ' + esc(M7.PAPER_LABEL[f.type].toLowerCase()) + ' recorded for this car yet.') + '</div>' : '';
      $('#mruntil', sh).value = f.type === 'Grant' ? '' : M7.addYear(p && p.until);
      $('#mrinsf', sh).hidden = f.type !== 'Insurance';
      if (f.type === 'Insurance' && p && p.insurer && !$('#mrins', sh).value) $('#mrins', sh).value = p.insurer;
      $('#mrwarn', sh).value = p && p.warnDays ? p.warnDays : f.type === 'PUSPAKOM' ? 21 : 30;
      var ce = $('#mrcost', sh); if (ce && p && p.cost && !ce.value) ce.value = money2(p.cost);
      $('#mruntil', sh).parentNode.querySelector('span').textContent = f.type === 'Grant' ? 'Valid until (optional)' : 'Valid until';
    };
    drawCar(); drawType();
    $('#mrcar', sh).onclick = function () { Pickers.car({ selected: f.car, onPick: function (c) { f.car = c.id; drawCar(); drawType(); } }); };
    segPick('#mrtype', function (t, b) { f.type = b.dataset.v; f.read = null; $('#mrread', sh).innerHTML = ''; drawType(); });
    var got = function (r) {
      var c = f.car && car(f.car);
      if (!c) { say('Choose the car first'); return; }
      f.photo = r.dataUrl;
      $('#mrread', sh).innerHTML = '<div class="mt-reading"><img alt="" src="' + esc(imgSrc(r.dataUrl)) + '"><div><b>Reading the paper</b><span class="mt-dots">Looking for the plate, the dates and the numbers</span></div></div>';
      later(function () { if (!document.body.contains(sh)) return; readPaper(c, r.dataUrl); }, 1200);
    };
    $('#mrsnap', sh).onclick = function () { if (!f.car) { say('Choose the car first'); return; } Media.photo({ capture: 'environment', maxPx: 1000, quality: .7 }).then(got, function () {}); };
    $('#mrsample', sh).onclick = function () { if (!f.car) { say('Choose the car first'); return; } Media.sample('paper', M7.PAPER_LABEL[f.type]).then(got); };
    /* simulated reading: plate, valid until, insurer, reference, each with a "% sure"; a person ticks what is right */
    function readPaper(c, dataUrl) {
      var R = rng(parseInt(strHash(dataUrl).slice(0, 6), 36) || 9), p = cur();
      var plate = c.plate, plateOk = R() > .25;
      if (!plateOk) plate = c.plate.replace(/\d(?=\d*$)/, function (d) { return String((+d + 3) % 10); });
      var until = f.type === 'Grant' ? '' : M7.addYear(p && p.until);
      var vals = [{ k: 'plate', label: 'Plate', v: plate, sure: plateOk ? 90 + Math.floor(R() * 9) : 58 + Math.floor(R() * 12), note: plateOk ? '' : 'Check this: it does not match ' + c.plate + ' exactly.' }];
      if (until) vals.push({ k: 'until', label: 'Valid until', v: until, show: M7.ymd(until), sure: 86 + Math.floor(R() * 12) });
      if (f.type === 'Insurance') vals.push({ k: 'insurer', label: 'Insurer', v: (p && p.insurer) || 'Etiqa', sure: 80 + Math.floor(R() * 18) });
      vals.push({ k: 'ref', label: 'Reference no', v: (f.type === 'Insurance' ? 'POL-' : f.type === 'Road tax' ? 'RT' : 'REF') + Math.floor(1000000 + R() * 8999999), sure: 70 + Math.floor(R() * 25) });
      f.read = vals;
      $('#mrread', sh).innerHTML = '<div class="mt-review"><div class="mt-rvhead"><img alt="" src="' + esc(imgSrc(dataUrl)) + '"><div><b>Check what was read</b><span>Tick each line that matches the paper.</span></div></div>' +
        vals.map(function (x) { return '<label class="mt-tick' + (x.note ? ' warn' : '') + '"><input type="checkbox" data-k="' + x.k + '"' + (x.note || x.sure < 70 ? '' : ' checked') + '><i>' + I('check', 2.6) + '</i><span class="grow"><small>' + esc(x.label) + ' · ' + x.sure + '% sure</small><b>' + esc(x.show || x.v) + '</b>' + (x.note ? '<em>' + esc(x.note) + '</em>' : '') + '</span></label>'; }).join('') +
        '<label class="mt-tick mt-belong"><input type="checkbox" id="mrbelong"><i>' + I('check', 2.6) + '</i><span class="grow"><b>I checked: this paper belongs to ' + esc(c.plate) + '</b></span></label>' +
        '<button type="button" class="btn mt-use" id="mruse" disabled>Use the ticked lines</button></div>';
      var bel = $('#mrbelong', sh), use = $('#mruse', sh);
      bel.onchange = function () { use.disabled = !bel.checked; };
      use.onclick = function () {
        $$('.mt-tick input[data-k]', sh).forEach(function (i) {
          if (!i.checked) return; var x = vals.filter(function (v) { return v.k === i.dataset.k; })[0];
          if (x.k === 'until') $('#mruntil', sh).value = x.v; if (x.k === 'insurer') $('#mrins', sh).value = x.v; if (x.k === 'ref') $('#mrref', sh).value = x.v;
        });
        f.checked = true;
        $('#mrread', sh).innerHTML = '<div class="banner green mt-readok">' + I('check') + '<div>Filled in from the paper. The photo is kept with it.</div></div>';
      };
    }
    $('#mrok', sh).onclick = function () {
      var err = $('#mrerr', sh), fail = function (t) { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); };
      var c = f.car && car(f.car); if (!c) return fail('Choose the car.');
      var until = $('#mruntil', sh).value; if (!until && f.type !== 'Grant') return fail('Pick the date it is valid until.');
      var p = cur(); if (until && p && p.until && until <= p.until) return fail('The new paper must end after the current one (' + M7.ymd(p.until) + ').');
      var ce = $('#mrcost', sh), cost = ce && ce.value.trim() ? parseMoney(ce.value) : null; if (cost != null && isNaN(cost)) return fail('Type the cost as an amount, for example 90 or 90.50.');
      var warn = +digits($('#mrwarn', sh).value) || 30;
      S.papers = (S.papers || []).concat({ id: uid(), car: c.id, type: f.type, until: until || null, insurer: f.type === 'Insurance' ? $('#mrins', sh).value.trim() : '', cost: cost, ref: $('#mrref', sh).value.trim(), warnDays: warn, photo: f.photo, at: new Date().toISOString(), by: S.me });
      if (S.prefs && S.prefs.mtHide) { delete S.prefs.mtHide['p:' + c.id + ':' + f.type]; }
      audit(M7.PAPER_LABEL[f.type] + ' of ' + c.plate + ' renewed' + (until ? ' until ' + M7.ymd(until) : ''), { car: c.id, link: '#car/' + c.id });
      save(); closeSheet(); render(false, true); say(M7.PAPER_LABEL[f.type] + ' saved');
    };
  }

  VIEWS.maintenance = view;
  return { log: log, job: job, renew: renew, carBack: carBack, block: block, serviceInfo: serviceInfo, reminders: reminders, jobRow: jobRow, dueItems: dueItems, clashes: clashes, workshopNow: workshopNow };
})();

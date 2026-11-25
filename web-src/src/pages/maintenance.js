/* ===================================================================
   Page: Maintenance (#page=maintenance)   Owner: builder 3
   Services, repairs, papers, workshop time, reminders, workshops and costs for every car.
   Address: #page=maintenance&tab=due|log|docs|workshop|vendors|costs  &car=<id> (car health)  &action=log|plan  &job=<id>
   Also holds the fleet helpers the Cars, Calendar and Availability pages use (mt* names), and sets
   API.carHealth, API.logService, API.openJob.
   =================================================================== */
var MT_PAPER_ICON = { 'Road tax': 'receipt-tax', 'Insurance': 'shield-check', 'PUSPAKOM': 'clipboard-check', 'Rental permit': 'file-certificate', 'Car grant': 'license', 'Other': 'file-text' };
var MT_PAPER_LONG = { 'PUSPAKOM': 'PUSPAKOM inspection', 'Rental permit': 'Rental permit (APAD)' };
var MT_FILE_KINDS = ['Invoice', 'Receipt', 'Quotation', 'Photo before', 'Photo after', 'Warranty', 'Other'];
var MT_ODO_SRC = { manual: 'Typed in', service: 'Service', handover: 'Hand-over', 'return': 'Return' };
var MT_TABS = [{ id: 'due', label: 'Due now', icon: 'alert-triangle' }, { id: 'log', label: 'Service log', icon: 'clipboard-list' }, { id: 'docs', label: 'Documents and renewals', icon: 'file-certificate' }, { id: 'workshop', label: 'Workshop', icon: 'tool' }, { id: 'vendors', label: 'Vendors', icon: 'building-store' }, { id: 'costs', label: 'Costs', icon: 'report-money' }];

/* ---------------- extra sample data: file kinds, odometer sources and readings that are not trusted ---------------- */
DATA_INIT.push(function (d) {
  if (d.mtReady) return; d.mtReady = true;
  var srcs = ['service', 'handover', 'return', 'manual', 'handover'];
  (d.odometer || []).forEach(function (o, k) { if (!o.source) o.source = srcs[k % srcs.length]; });
  (d.jobs || []).forEach(function (j, k) {
    (j.files || []).forEach(function (f) { if (!f.kind) f.kind = /photo|\.jpe?g|\.png/i.test(f.name) ? 'Photo after' : 'Invoice'; });
    if (j.status === 'Done' && k % 7 === 2 && (j.files || []).length) j.files.push({ name: 'before-' + (j.id || k) + '.jpg', size: 180 * 1024 + k * 517, kind: 'Photo before', caption: 'Before the work started' });
  });
  /* readings from the agent link that did not move the odometer */
  var cars = d.cars.filter(function (c) { return c.fleet === 'Active'; });
  [[1, 61200, 'More than 50,000 km above the last reading, so it did not change the car\'s odometer.'], [4, -2350, 'Lower than an earlier reading. An odometer only goes up, so it did not change the car\'s odometer.']].forEach(function (x, n) {
    var c = cars[x[0]]; if (!c) return;
    var last = d.odometer.filter(function (o) { return o.car === c.id; }).sort(function (a, b) { return b.at - a.at; })[0];
    var at = last ? new Date(last.at.getTime() - (n ? 2 : 1) * DAY) : new Date(TODAY.getTime() - 3 * DAY);
    d.odometer.push({ car: c.id, km: (last ? last.km : c.odo) + x[1], at: at, by: 'Agent link', source: n ? 'return' : 'handover', doubt: x[2] });
  });
});

/* ---------------- small shared helpers ---------------- */
/* open a drawer named in the address (#...&car=car-2) once, keep the address while it is open, clear it on close */
var B3_OPEN = {};
function b3Open(ctx, param, fn) {
  var v = ctx.params[param]; if (!v) return;
  var k = ctx.id + ':' + param + ':' + v, cur = B3_OPEN[k];
  if (cur && !cur.closed) return;
  B3_OPEN[k] = { closed: false };
  setTimeout(function () { B3_OPEN[k] = fn(v, function () { if (S.params[param] === v) { var o = {}; o[param] = null; ctx.setParams(o); } }) || { closed: true }; }, 0);
}
function mtToday() { var n = NOW(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function mtIso(d) { return d ? UI.isoDate(d) : ''; }
function mtDate(s) { return s ? (s instanceof Date ? s : UI.parseDate(s)) : null; }
/* the searchable car picker used on every fleet form; cars that are sold are left out unless already chosen */
function mtCarPick(el, o) {
  o = o || {};
  var keep = o.value;
  return UI.carPicker(el, Object.assign({ key: 'car', label: 'Car', required: true, full: true, placeholder: 'Search plate or model', cars: D().cars.filter(function (c) { return c.fleet !== 'Sold' || c.id === keep; }) }, o));
}
function mtCarOpts(all) { return D().cars.filter(function (c) { return all || c.fleet !== 'Sold'; }).map(function (c) { return [c.id, c.plate + ' · ' + carName(c)]; }); }
function mtCarLine(c) { return c ? esc(c.plate) + ' · ' + esc(carName(c)) : '<span class="faint">No car</span>'; }
function mtCarCell(c) { return c ? '<div class="mt-car"><b>' + esc(c.plate) + '</b><span>' + esc(carName(c)) + '</span></div>' : '<span class="faint">No car</span>'; }
function mtVendorName(id) { var v = id && byId(D().vendors, id); return v ? v.name : ''; }
function mtCostsOk() { return can('maintenance.see_costs'); }
function mtMoney(v) { return mtCostsOk() ? UI.money(v) : '<span class="faint">Hidden</span>'; }
function mtKm(v) { return v == null || v === '' ? '' : UI.fmt.num(v) + ' km'; }
function mtFileLine(f) { return f ? esc(f.name) + ' · ' + UI.fmt.size(f.size) + (f.added ? ' · added ' + UI.fmt.date(f.added) : '') : 'Not uploaded yet'; }
function mtDur(ms) { var m = Math.round(Math.abs(ms) / 6e4), h = Math.floor(m / 60), r = m % 60; return (h ? h + ' hr' + (h === 1 ? '' : 's') : '') + (h && r ? ' ' : '') + (r || !h ? r + ' min' : ''); }
/* the latest paper of one kind for a car */
function mtLatestPaper(carId, kind, d) {
  d = d || D();
  var l = d.papers.filter(function (p) { return p.car === carId && p.kind === kind; });
  l.sort(function (a, b) { return (b.until ? +b.until : 9e15) - (a.until ? +a.until : 9e15) || (b.issued ? +b.issued : 0) - (a.issued ? +a.issued : 0); });
  return l[0] || null;
}
/* Valid / Expires in N days / Expires today / Expired N days ago / Recorded / Missing */
function mtPaperInfo(p) {
  if (!p) return { tone: 'grey', text: 'Missing', short: 'Missing', days: null };
  if (!p.until) return { tone: 'ok', text: 'Recorded', short: 'Recorded', days: null };
  var k = UI.fmt.daysFrom(p.until), warn = p.warnDays || 30;
  if (k < 0) return { tone: 'bad', text: 'Expired ' + plural(-k, 'day') + ' ago', short: 'Expired', days: k };
  if (k === 0) return { tone: 'bad', text: 'Expires today', short: 'Today', days: 0 };
  if (k <= warn) return { tone: 'warn', text: 'Expires in ' + plural(k, 'day'), short: 'Soon', days: k };
  return { tone: 'ok', text: 'Valid', long: 'Expires in ' + plural(k, 'day'), short: 'Valid', days: k };
}
function mtPaperChip(p, long) { var x = mtPaperInfo(p); return UI.chip(long && x.long ? x.long : x.text, x.tone); }
/* when a service reminder is due: by date and by km, whichever comes first */
function mtRemInfo(r, c) {
  c = c || carById(r.car);
  if (!r.lastAt && r.lastKm == null) return { state: 'none', text: 'Not counting yet: log this service once to start', sort: 9e9 };
  var dueAt = r.days && r.lastAt ? new Date(r.lastAt.getTime() + r.days * DAY) : null, dueKm = r.km && r.lastKm != null ? r.lastKm + r.km : null;
  var days = dueAt ? UI.fmt.daysFrom(dueAt) : null, km = dueKm != null ? dueKm - (c ? c.odo : 0) : null;
  var over = (days != null && days < 0) || (km != null && km < 0), soon = !over && ((days != null && days <= 30) || (km != null && km <= 1500));
  var parts = [];
  if (days != null) parts.push(days < 0 ? 'Overdue by ' + plural(-days, 'day') : days === 0 ? 'Due today' : 'Due in ' + plural(days, 'day'));
  if (km != null) parts.push(km < 0 ? UI.fmt.num(-km) + ' km over' : UI.fmt.num(km) + ' km to go');
  var sub = [dueAt ? UI.fmt.date(dueAt) : '', dueKm != null ? 'at ' + mtKm(dueKm) : ''].filter(Boolean).join(' · ');
  return { state: over ? 'over' : soon ? 'soon' : 'ok', text: parts.join(' · '), sub: sub, dueAt: dueAt, dueKm: dueKm, days: days, km: km, sort: Math.min(days == null ? 9e6 : days, km == null ? 9e6 : km / 90) };
}
/* active workshop time for a car (blocks rentals) */
function mtDowntimeOn(carId, from, to, d) {
  d = d || D(); from = from || NOW(); to = to || from;
  return d.downtime.filter(function (w) { return w.car === carId && !w.back && w.from <= to && (!w.to || w.to >= from); })[0] || null;
}
function mtInWorkshopNow(d) {
  d = d || D(); var set = {};
  d.downtime.forEach(function (w) { if (!w.back && w.from <= NOW()) set[w.car] = 1; });
  d.jobs.forEach(function (j) { if (j.status === 'In the workshop') set[j.car] = 1; });
  return Object.keys(set);
}
/* bookings that overlap a period: shown as a clash list before a car goes to the workshop */
function mtClashes(carId, from, to) {
  if (!carId || !from) return [];
  var end = to || new Date(from.getTime() + DAY);
  return D().bookings.filter(function (x) { return x.car.id === carId && ['Cancelled', 'Completed', 'Car Returned'].indexOf(x.status) < 0 && x.start < end && x.end > from; });
}
/* o: {forced, canForce}. Without the force the car cannot go in while rentals clash */
function mtClashHtml(list, o) {
  o = o || {};
  if (!list.length) return UI.alert('No bookings clash with these dates.', 'ok');
  var canF = o.canForce == null ? can('maintenance.manage_downtime') : o.canForce;
  return '<div class="alert warn mt-clashp" role="alert">' + i('calendar-exclamation') + '<div class="grow"><b>Some rentals clash with this workshop time</b><ul class="mt-clash">' + list.map(function (x) { return '<li><b>' + esc(x.code) + '</b>: ' + UI.fmt.dateTime(x.start) + ' to ' + UI.fmt.dateTime(x.end) + ' (' + esc(x.status) + ') · ' + esc(x.cust.name) + '</li>'; }).join('') + '</ul>' +
    '<div class="b2">Move these rentals to another car first, then try again.</div>' +
    (canF ? '<button type="button" class="btn sm ' + (o.forced ? 'c mt-forced' : 'o') + ' mt-force" data-force aria-pressed="' + !!o.forced + '">' + i(o.forced ? 'check' : 'alert-triangle') + '<span>' + (o.forced ? 'Will go ahead anyway' : 'Put the car in the workshop anyway') + '</span></button>' : '<div class="b2 mt8">' + i('lock') + ' Only people who manage workshop time can put the car in anyway.</div>') + '</div></div>';
}
/* read every [data-key] field into an object while the person types; onChange(key, event) */
function mtBind(el, f, onChange) {
  var h = function (ev) {
    var t = ev.target, k = t.getAttribute && t.getAttribute('data-key'); if (!k || t.closest('[data-nobind]')) return;
    f[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value;
    if (onChange) onChange(k, ev);
  };
  el.addEventListener('input', h); el.addEventListener('change', h);
}
/* a sample paper drawn as HTML when there is no real picture (the sample's own papers) */
function mtPaperMock(title, lines) {
  return '<div class="mt-mock"><div class="mt-mock-h">' + i('file-text') + '<b>' + esc(title) + '</b><span>SAMPLE</span></div>' + lines.map(function (l) { return '<div class="mt-mock-r"><span>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b></div>'; }).join('') + '<div class="mt-mock-f">A made-up paper for the sample. Upload a real picture or PDF to see it here.</div></div>';
}
/* view a stored file: a picture, a PDF the person added, or the sample paper */
function mtViewFile(title, file, lines, o) {
  o = o || {};
  if (!file) { UI.toast('Nothing uploaded yet', { tone: 'info' }); return; }
  var body = file.dataUrl && /^data:image/.test(file.dataUrl) ? '<img class="mt-view-img" src="' + file.dataUrl + '" alt="' + esc(title) + '">'
    : file.dataUrl ? '<div class="mt-view-pdf">' + i('file-type-pdf') + '<div><b>' + esc(file.name) + '</b><div class="b2">' + UI.fmt.size(file.size) + '. PDFs open in your own viewer: press Save.</div></div></div>'
      : mtPaperMock(title, lines || [['File', file.name], ['Size', UI.fmt.size(file.size)]]);
  if (o.log) DB.log('Viewed a document', o.where || 'Car owner document', o.ref || '', DB.actor() + ' opened ' + title + (o.of ? ' of ' + o.of : ''));
  UI.dialog({ title: title, text: file.name + ' · ' + UI.fmt.size(file.size), width: 'md', body: body, buttons: [{ label: 'Save', kind: 'o', icon: 'download', close: false, onClick: function () { mtSaveFile(title, file, lines); return false; } }, { label: 'Close' }] });
}
function mtSaveFile(title, file, lines) {
  if (!file) return;
  if (file.dataUrl) {
    var bin = atob(file.dataUrl.split(',')[1] || ''), arr = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    UI.download({ filename: file.name, data: arr, mime: file.type || 'application/octet-stream' });
    return;
  }
  UI.pdf(file.name.replace(/\.\w+$/, '') + '.pdf', function (doc, kit) {
    kit.header({ title: title.toUpperCase(), lines: [file.name, 'Sample paper'] });
    kit.table({ columns: [{ label: 'Field', w: 60 }, { label: 'Value', w: 120 }], rows: (lines || [['File', file.name]]).map(function (l) { return [l[0], l[1]]; }) });
    kit.font(9, 'normal', [110, 110, 120]); kit.wrap('A made-up paper, part of the Orbique FMS sample.', kit.M, kit.y + 4, kit.W - 2 * kit.M);
  });
}
function mtReadFile(file, max) {
  if (file.size > 8 * 1048576) return Promise.reject(new Error(file.name + ' is larger than 8 MB.'));
  return UI.readImage(file, { max: max || 1600 }).then(function (r) { return { name: r.name, size: r.size, type: r.type, dataUrl: r.dataUrl, added: NOW() }; });
}

/* ---------------- what is due: services, papers, planned jobs ---------------- */
function mtDueItems(d) {
  d = d || D(); var out = [], now = NOW();
  d.cars.forEach(function (c) {
    if (c.fleet !== 'Active') return;
    d.reminders.forEach(function (r) {
      if (r.car !== c.id || !r.on) return;
      var x = mtRemInfo(r, c); if (x.state === 'none') return;
      var snoozed = r.snoozedUntil && r.snoozedUntil > now;
      if (snoozed) return;
      out.push({ kind: 'service', state: x.state, title: r.service, car: c, text: x.text, sub: x.sub, sort: x.sort, rem: r, icon: 'tool' });
    });
    LISTS.paperTypes.forEach(function (k) {
      var p = mtLatestPaper(c.id, k, d); if (!p || !p.until) return;
      var x = mtPaperInfo(p), st = x.tone === 'bad' ? 'over' : x.tone === 'warn' ? 'soon' : 'ok';
      out.push({ kind: 'paper', state: st, title: MT_PAPER_LONG[k] || (k === 'Other' ? p.name : k), car: c, text: x.days < 0 ? x.text : x.long || x.text, sub: UI.fmt.date(p.until), sort: x.days, paper: p, icon: MT_PAPER_ICON[k] });
    });
  });
  d.jobs.forEach(function (j) {
    if (j.status !== 'Planned') return;
    var c = carById(j.car); if (!c) return;
    var k = UI.fmt.daysFrom(j.plannedFor || j.date);
    out.push({ kind: 'job', state: k < 0 ? 'over' : k <= 30 ? 'soon' : 'ok', title: j.title, car: c, text: k < 0 ? 'Overdue by ' + plural(-k, 'day') : k === 0 ? 'Due today' : 'Due in ' + plural(k, 'day'), sub: UI.fmt.date(j.plannedFor || j.date) + ' · planned job', sort: k, job: j, icon: 'calendar-event' });
  });
  return out.sort(function (a, b) { return a.sort - b.sort; });
}
function mtKpis(d) {
  d = d || D();
  var due = mtDueItems(d), over = due.filter(function (x) { return x.state === 'over'; }).length, soon = due.filter(function (x) { return x.state === 'soon'; }).length;
  var docs = 0;
  d.cars.forEach(function (c) { if (c.fleet === 'Sold') return; LISTS.paperTypes.forEach(function (k) { var x = mtPaperInfo(mtLatestPaper(c.id, k, d)); if (x.tone === 'bad' || x.tone === 'warn') docs++; }); });
  var t = mtToday(), m0 = new Date(t.getFullYear(), t.getMonth(), 1);
  var done = d.jobs.filter(function (j) { return j.status === 'Done' && (j.doneAt || j.date) >= m0 && (j.doneAt || j.date) <= NOW(); });
  return { due: over + soon, over: over, shop: mtInWorkshopNow(d).length, docs: docs, spent: sum(done.map(function (j) { return j.total || 0; })), spentN: done.length };
}

/* ---------------- the page ---------------- */
PAGES['maintenance'] = {
  title: 'Maintenance',
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data;
    st.tab = ctx.params.tab || st.tab || 'due';
    if (st.tab === 'costs' && !mtCostsOk()) st.tab = 'due';
    var k = mtKpis(d);
    root.innerHTML = '<div class="pg-h"><div><h1>Maintenance</h1><p>Services, road tax, papers and workshop time for every car.</p></div><div class="acts">' +
      (ctx.can('maintenance.create') ? UI.btn('Log a service', { icon: 'plus', attrs: { 'data-act': 'log' } }) : '') + '</div></div>' +
      '<div class="mt-kpis">' +
      UI.stat({ label: 'Due now', value: k.due, note: k.over + ' overdue', icon: 'alert-triangle', tone: k.over ? 'bad' : 'warn', attrs: { 'data-tab': 'due' } }) +
      UI.stat({ label: 'In the workshop', value: k.shop, note: 'cars cannot be booked', icon: 'tool', tone: 'warn', attrs: { 'data-tab': 'workshop' } }) +
      UI.stat({ label: 'Documents expiring', value: k.docs, note: 'within 30 days, or already expired', icon: 'file-alert', tone: 'info', attrs: { 'data-tab': 'docs' } }) +
      (mtCostsOk() ? UI.stat({ label: 'Spent this month', value: UI.fmt.money(k.spent), note: plural(k.spentN, 'finished job'), icon: 'report-money', tone: 'grey', attrs: { 'data-tab': 'costs' } }) : '') +
      '</div><div id="mt-tabs" class="mt-tabs"></div><div id="mt-body" class="mt-body"></div>';
    UI.tabs(root.querySelector('#mt-tabs'), { items: MT_TABS.map(function (t) { return Object.assign({}, t, { hidden: t.id === 'costs' && !mtCostsOk() }); }), value: st.tab, onChange: function (id) { st.tab = id; ctx.setParams({ tab: id }); drawTab(); } });
    UI.on(root, 'click', '[data-tab]', function (ev, el) { st.tab = el.getAttribute('data-tab'); ctx.setParams({ tab: st.tab }); ctx.refresh(); });
    UI.on(root, 'click', '[data-act="log"]', function () { mtJobForm({ when: 'done' }); });
    function drawTab() {
      var b = root.querySelector('#mt-body');
      ({ due: mtTabDue, log: mtTabLog, docs: mtTabDocs, workshop: mtTabWorkshop, vendors: mtTabVendors, costs: mtTabCosts }[st.tab] || mtTabDue)(b, ctx);
    }
    drawTab();
    /* address actions, once */
    var p = ctx.params;
    if (p.action === 'log' || p.action === 'plan') { ctx.setParams({ action: null }); setTimeout(function () { mtJobForm({ car: p.car || '', when: p.action === 'plan' ? 'plan' : 'done' }); }, 0); }
    b3Open(ctx, 'job', mtJobDrawer);
    b3Open(ctx, 'car', mtCarHealth);
  },
  search: [
    { label: 'Log a service', icon: 'tool', run: function () { mtJobForm({ when: 'done' }); } },
    { label: 'Plan a job', icon: 'calendar-plus', run: function () { mtJobForm({ when: 'plan' }); } },
    { label: 'Add a paper', icon: 'file-plus', run: function () { mtPaperForm({}); } },
    { label: 'Block a car for the workshop', icon: 'lock', run: function () { mtBlockDialog({}); } }
  ]
};

/* ---------------- tab: Due now ---------------- */
function mtTabDue(el, ctx) {
  var st = ctx.state; st.dueF = st.dueF || 'all';
  var all = mtDueItems(), f = st.dueF;
  var list = all.filter(function (x) { return f === 'all' || (f === 'svc' && x.kind === 'service') || (f === 'paper' && x.kind === 'paper') || (f === 'job' && x.kind === 'job'); }).slice(0, 100);
  var grp = { over: [], soon: [], ok: [] }; list.forEach(function (x) { grp[x.state].push(x); });
  var item = function (x) {
    var acts = '';
    if (x.kind === 'service') acts = (ctx.can('maintenance.create') ? UI.btn('Log service', { size: 'sm', attrs: { 'data-due': 'log', 'data-car': x.car.id, 'data-type': x.title } }) : '') + (ctx.can('maintenance.manage_schedules') ? UI.btn('Snooze 7 days', { size: 'sm', kind: 'g', attrs: { 'data-due': 'snooze', 'data-rem': x.rem.id } }) : '');
    else if (x.kind === 'paper') acts = ctx.can('maintenance.manage_documents') ? UI.btn('Renew', { size: 'sm', attrs: { 'data-due': 'renew', 'data-paper': x.paper.id } }) : '';
    else acts = UI.btn('Open job', { size: 'sm', attrs: { 'data-due': 'job', 'data-job': x.job.id } });
    return '<div class="mt-due-it ' + x.state + '"><span class="mt-due-ic">' + i(x.icon || 'tool') + '</span><div class="grow"><div class="t1c fw5">' + esc(x.title) + '</div><button type="button" class="mt-link" data-due="car" data-car="' + x.car.id + '">' + mtCarLine(x.car) + '</button><div class="mt-due-t">' + esc(x.text) + '</div><div class="b2">' + esc(x.sub || '') + '</div></div><div class="mt-due-a">' + acts + '</div></div>';
  };
  var cnt = function (k) { return all.filter(function (x) { return x.state !== 'ok' && (k === 'all' || (k === 'svc' && x.kind === 'service') || (k === 'paper' && x.kind === 'paper') || (k === 'job' && x.kind === 'job')); }).length; };
  el.innerHTML = '<div id="mt-duef"></div>' +
    (grp.over.length + grp.soon.length === 0 ? '<div class="card mt16">' + UI.empty({ icon: 'mood-happy', title: 'Nothing due. Nice.', text: 'Every service, paper and planned job is in date.' }) + '</div>' : '') +
    (grp.over.length ? '<h3 class="mt-gh bad">Overdue (' + grp.over.length + ')</h3><div class="mt-due">' + grp.over.map(item).join('') + '</div>' : '') +
    (grp.soon.length ? '<h3 class="mt-gh warn">Coming up soon (' + grp.soon.length + ')</h3><div class="mt-due">' + grp.soon.map(item).join('') + '</div>' : '') +
    (grp.ok.length ? '<section class="mt-allgood shut"><button type="button" class="mt-gh mt-toggle" data-ui-toggle>' + i('chevron-right') + 'All good (' + grp.ok.length + ')</button><div class="mt-due">' + grp.ok.map(item).join('') + '</div></section>' : '') +
    '<p class="b2 mt16">Showing the 100 most urgent items.</p>' +
    UI.alert('Every morning the team gets a WhatsApp reminder for services and papers that reach 30, 14, 7 or 1 days before their date (or their warning km), and every week while one is overdue.', 'pri', { icon: 'brand-whatsapp', action: UI.btn("See today's message", { kind: 'o', size: 'sm', attrs: { 'data-due': 'wa' } }) });
  UI.filters(el.querySelector('#mt-duef'), { values: st, fields: [{ type: 'chips', key: 'dueF', options: [['all', 'Everything', cnt('all')], ['svc', 'Services', cnt('svc')], ['paper', 'Road tax and papers', cnt('paper')], ['job', 'Planned jobs', cnt('job')]] }], onChange: function () { mtTabDue(el, ctx); } });
  el.onclick = function (ev) {
    var b = ev.target.closest('[data-due]'); if (!b) return;
    var a = b.getAttribute('data-due');
    if (a === 'log') mtJobForm({ car: b.getAttribute('data-car'), type: b.getAttribute('data-type'), when: 'done' });
    else if (a === 'snooze') { var r = byId(D().reminders, b.getAttribute('data-rem')); DB.update('reminders', r, { snoozedUntil: new Date(NOW().getTime() + 7 * DAY) }, { text: DB.actor() + ' snoozed ' + r.service + ' of ' + carById(r.car).plate + ' for 7 days', where: 'Maintenance record' }); UI.toast('Hidden for 7 days', { action: { label: 'Undo', run: function () { DB.update('reminders', r, { snoozedUntil: null }, { silent: true }); } } }); }
    else if (a === 'renew') { var p = byId(D().papers, b.getAttribute('data-paper')); mtPaperForm({ renew: p.id }); }
    else if (a === 'job') mtJobDrawer(b.getAttribute('data-job'));
    else if (a === 'car') mtCarHealth(b.getAttribute('data-car'));
    else if (a === 'wa') mtWaPreview();
  };
}
/* the daily WhatsApp reminder, as the team would get it today */
function mtWaPreview() {
  var items = mtDueItems().filter(function (x) { return x.state !== 'ok'; }), b = B();
  var lines = items.map(function (x) { return '• ' + x.car.plate + ': ' + x.title + ', ' + x.text.toLowerCase(); });
  var msgs = []; for (var k = 0; k < lines.length && msgs.length < 5; k += 8) msgs.push(lines.slice(k, k + 8));
  var team = D().employees.filter(function (e) { return e.active; }).slice(0, 3);
  var body = '<p class="ui-ctext">What the morning reminder says today. Long lists are split into several messages, at most 5 a day.</p>' +
    (msgs.length ? msgs.map(function (m, n) { return '<div class="mt-wa"><div class="mt-wa-h">' + i('brand-whatsapp') + 'Message ' + (n + 1) + ' of ' + msgs.length + '</div><div class="mt-wa-b">' + (n === 0 ? '<b>' + esc(b.name) + ': maintenance for today</b><br>' : '') + m.map(esc).join('<br>') + (n === msgs.length - 1 ? '<br><br>Open Maintenance to log, renew or snooze.' : '') + '</div></div>'; }).join('') : UI.empty({ icon: 'mood-happy', title: 'Nothing to send today' })) +
    '<div class="b2 mt8">Goes to: ' + team.map(function (e) { return esc(e.name) + ' ' + UI.phone(e.wa); }).join(', ') + '</div>';
  UI.dialog({ title: "Today's WhatsApp reminder", width: 'md', body: body, buttons: [{ label: 'Close', kind: 'g' }, { label: 'Send now', icon: 'send', disabled: !msgs.length, onClick: function () { DB.log('Sent', 'Maintenance record', '', DB.actor() + ' sent the maintenance reminder by WhatsApp to ' + plural(team.length, 'person') + ' (' + plural(msgs.length, 'message') + ')'); UI.toast('Sent to ' + plural(team.length, 'person') + ' (sample: WhatsApp is not connected)'); } }] });
}

/* ---------------- tab: Service log ---------------- */
function mtTabLog(el, ctx) {
  var st = ctx.state, f = st.logF || (st.logF = {}), d = D();
  var canX = ctx.can('maintenance.export') && mtCostsOk();
  el.innerHTML = '<div class="card"><div class="card-b tight"><div class="mt-lcar"></div><div id="mt-lf"></div><div id="mt-lmore"' + (st.logMore ? '' : ' hidden') + ' class="mt-more"></div></div><div id="mt-lt"></div></div>';
  var rows = function () {
    var q = (f.q || '').toLowerCase();
    return d.jobs.filter(function (j) {
      var c = carById(j.car);
      if (f.car && j.car !== f.car) return false;
      if (f.status && j.status !== f.status) return false;
      if (f.type && j.type !== f.type) return false;
      if (f.vendor && j.vendor !== f.vendor) return false;
      if (f.files === 'with' && !(j.files || []).length) return false;
      if (f.files === 'without' && (j.files || []).length) return false;
      if (f.from && j.date < mtDate(f.from)) return false;
      if (f.to && j.date > new Date(mtDate(f.to).getTime() + DAY - 1)) return false;
      if (q && (c.plate + ' ' + carName(c) + ' ' + mtVendorName(j.vendor) + ' ' + j.note + ' ' + j.title).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  };
  var t;
  var refresh = function () { t.setRows(rows()); };
  var lcar = UI.carPicker(el.querySelector('.mt-lcar'), { key: 'logcar', label: '', aria: 'Car', placeholder: 'All cars: tap to pick one', title: 'Show the jobs of one car', value: f.car || '', clearable: true, badges: false, onChange: function (v) { f.car = v || ''; refresh(); } });
  UI.filters(el.querySelector('#mt-lf'), { values: f, fields: [{ type: 'search', key: 'q', placeholder: 'Search plate, workshop, note…' }],
    onChange: function (v, k) { if (k === '*') { f.car = ''; lcar.set('', true); } refresh(); drawMore(); },
    extra: UI.btn('More filters', { kind: st.logMore ? 'tonal' : 'o', size: 'sm', icon: 'adjustments-horizontal', attrs: { 'data-lact': 'more' } }) + '<span class="grow"></span>' +
      (canX ? UI.btn('Excel', { kind: 'o', size: 'sm', icon: 'file-spreadsheet', attrs: { 'data-lact': 'xlsx' } }) : '') +
      (ctx.can('maintenance.create') ? UI.btn('Plan a job', { kind: 'o', size: 'sm', icon: 'calendar-plus', attrs: { 'data-lact': 'plan' } }) + UI.btn('Log a service', { size: 'sm', icon: 'plus', attrs: { 'data-lact': 'log' } }) : '') });
  function drawMore() {
    var m = el.querySelector('#mt-lmore'); m.hidden = !st.logMore; if (!st.logMore) return;
    UI.filters(m, { values: f, fields: [{ type: 'chips', key: 'status', label: 'Status', options: [['', 'Any']].concat(LISTS.jobStatus.map(function (s) { return [s, s]; })), default: '' }, { type: 'select', key: 'type', label: 'What', options: LISTS.serviceTypes, all: 'Any service' }, { type: 'select', key: 'vendor', label: 'Workshop', options: d.vendors.map(function (v) { return [v.id, v.name]; }), all: 'Any workshop' }, { type: 'select', key: 'files', label: 'Files', options: [['with', 'With files'], ['without', 'Without files']], all: 'Files: any' }, { type: 'daterange', from: 'from', to: 'to', label: 'From' }],
      onChange: refresh, extra: UI.btn('Clear all', { kind: 't', size: 'sm', attrs: { 'data-lact': 'clear' } }) });
  }
  drawMore();
  t = UI.table(el.querySelector('#mt-lt'), {
    columns: [
      { key: 'date', label: 'Date', sort: true, nowrap: true, render: function (j) { return UI.fmt.date(j.date); } },
      { key: 'car', label: 'Car', render: function (j) { return mtCarCell(carById(j.car)); } },
      { key: 'title', label: 'What', render: function (j) { return esc(j.title) + (j.booking ? '<div class="b2">' + esc(j.booking) + (j.charge ? ' · charge ' + UI.fmt.money(j.charge) : '') + '</div>' : ''); } },
      { key: 'vendor', label: 'Workshop', render: function (j) { return esc(mtVendorName(j.vendor)) || '<span class="faint">Not specified</span>'; } },
      { key: 'odo', label: 'Odometer', align: 'right', render: function (j) { return j.odo ? mtKm(j.odo) : '<span class="faint">-</span>'; } },
      { key: 'total', label: 'Cost', align: 'right', sort: true, hidden: !mtCostsOk(), render: function (j) { return UI.money(j.total || 0); } },
      { key: 'status', label: 'Status', render: function (j) { return UI.status('job', j.status); } },
      { key: 'files', label: 'Files', align: 'center', render: function (j) { var n = (j.files || []).length; return n ? '<span class="row gap4" style="justify-content:center">' + i('paperclip') + n + '</span>' : '<span class="faint">0</span>'; } }
    ],
    rows: rows(), rowKey: 'id', density: 'compact', sort: { key: 'date', dir: 'desc' }, pageSize: 25, pageSizes: [25, 50, 100], minWidth: 860,
    onRowClick: function (j) { mtJobDrawer(j.id); },
    card: function (j) { var c = carById(j.car); return '<div class="row" style="justify-content:space-between"><b>' + esc(j.title) + '</b>' + UI.status('job', j.status) + '</div><div class="b2">' + mtCarLine(c) + '</div><div class="row" style="justify-content:space-between"><span class="b2">' + UI.fmt.date(j.date) + (mtVendorName(j.vendor) ? ' · ' + esc(mtVendorName(j.vendor)) : '') + '</span>' + (mtCostsOk() ? UI.money(j.total || 0) : '') + '</div>'; },
    empty: { icon: 'tool', title: 'No jobs logged yet', text: 'Log the first service and it will appear here.' }
  });
  el.onclick = function (ev) {
    var b = ev.target.closest('[data-lact]'); if (!b) return;
    var a = b.getAttribute('data-lact');
    if (a === 'more') { st.logMore = !st.logMore; mtTabLog(el, ctx); }
    else if (a === 'clear') { Object.keys(f).forEach(function (k) { delete f[k]; }); mtTabLog(el, ctx); }
    else if (a === 'xlsx') mtExport(rows(), 'maintenance-export.xlsx');
    else if (a === 'plan') mtJobForm({ when: 'plan', car: f.car });
    else if (a === 'log') mtJobForm({ when: 'done', car: f.car });
  };
}
/* Excel: Services, By car, By type, Documents */
function mtExport(jobs, filename) {
  var d = D(), H = function (s) { return s; };
  var svc = [['Date', 'Plate', 'Car', 'Service', 'Workshop', 'Status', 'Odometer (km)', 'Parts (RM)', 'Labour (RM)', 'Tax (RM)', 'Total (RM)', 'Paid', 'Paid on', 'Invoice no.', 'Warranty until', 'Booking ID', 'Charge to customer (RM)', 'Notes', 'Files']];
  jobs.forEach(function (j) {
    var c = carById(j.car), parts = sum(j.lines.filter(function (l) { return l.type !== 'Labour'; }).map(function (l) { return l.qty * l.price; })), lab = sum(j.lines.filter(function (l) { return l.type === 'Labour'; }).map(function (l) { return l.qty * l.price; }));
    svc.push([j.date, c.plate, carName(c), j.title, mtVendorName(j.vendor), j.status, j.odo || '', parts, lab, j.tax || 0, j.total || 0, j.paid ? 'Yes' : 'No', j.paidOn || '', j.invoiceNo || '', j.warranty || '', j.booking || '', j.charge || 0, j.note || '', (j.files || []).map(function (x) { return x.name; }).join(', ')]);
  });
  var byCar = [['Plate', 'Car', 'Jobs', 'Total', 'Last service', 'Km driven', 'Cost per km']];
  d.cars.forEach(function (c) { var js = jobs.filter(function (j) { return j.car === c.id && j.status === 'Done'; }); if (!js.length) return; var tot = sum(js.map(function (j) { return j.total || 0; })), km = mtKmDriven(c.id, null, null); byCar.push([c.plate, carName(c), js.length, tot, js.map(function (j) { return j.date; }).sort(function (a, b) { return b - a; })[0], km || '', km ? Math.round(tot / km * 100) / 100 : '']); });
  var byType = [['Service', 'Jobs', 'Total']], tt = {};
  jobs.forEach(function (j) { if (j.status !== 'Done') return; tt[j.type] = tt[j.type] || [0, 0]; tt[j.type][0]++; tt[j.type][1] += j.total || 0; });
  Object.keys(tt).forEach(function (k) { byType.push([k, tt[k][0], tt[k][1]]); });
  var docs = [['Plate', 'Car', 'Paper', 'Reference', 'Provider', 'Issued', 'Expires', 'Days left', 'Cost']];
  d.papers.forEach(function (p) { var c = carById(p.car); if (c) docs.push([c.plate, carName(c), p.kind === 'Other' ? p.name : p.kind, p.ref || '', p.provider || '', p.issued || '', p.until || '', p.until ? UI.fmt.daysFrom(p.until) : '', p.cost || 0]); });
  DB.log('Exported', 'Maintenance record', '', DB.actor() + ' downloaded the maintenance report (' + plural(jobs.length, 'job') + ')');
  UI.xlsx(filename, [{ name: 'Services', rows: svc, cols: [12, 10, 22, 22, 22, 14, 12, 11, 11, 9, 11, 6, 12, 12, 13, 12, 14, 30, 24], money: [7, 8, 9, 10, 16], filter: true, dateFormat: 'dd mmm yyyy' }, { name: 'By car', rows: byCar, cols: [10, 22, 6, 12, 14, 11, 11], money: [3, 6], dateFormat: 'dd mmm yyyy' }, { name: 'By type', rows: byType, cols: [26, 6, 12], money: [2] }, { name: 'Documents', rows: docs, cols: [10, 22, 18, 14, 22, 12, 12, 9, 10], money: [8], dateFormat: 'dd mmm yyyy', filter: true }].map(H));
}
/* km a car drove between two dates, from its odometer readings */
function mtKmDriven(carId, from, to) {
  var c = carById(carId), r = D().odometer.filter(function (o) { return o.car === carId && !o.doubt && (!from || o.at >= from) && (!to || o.at <= to); }).map(function (o) { return o.km; });
  if (c && c.odoAt && (!from || c.odoAt >= from) && (!to || c.odoAt <= to)) r.push(c.odo);
  return r.length > 1 ? Math.max.apply(0, r) - Math.min.apply(0, r) : 0;
}

/* ---------------- tab: Documents and renewals ---------------- */
function mtTabDocs(el, ctx) {
  var st = ctx.state, d = D(); st.docQ = st.docQ || '';
  var cars = d.cars.filter(function (c) { return c.fleet !== 'Sold'; });
  var cells = function (c) { return LISTS.paperTypes.map(function (k) { return { k: k, p: mtLatestPaper(c.id, k, d) }; }); };
  var tot = { bad: 0, warn: 0, miss: 0 };
  cars.forEach(function (c) { cells(c).forEach(function (x) { var t = mtPaperInfo(x.p).tone; if (t === 'bad') tot.bad++; else if (t === 'warn') tot.warn++; else if (t === 'grey' && x.k !== 'Other') tot.miss++; }); });
  var need = function (c) { return cells(c).some(function (x) { var t = mtPaperInfo(x.p).tone; return t === 'bad' || t === 'warn' || (t === 'grey' && x.k !== 'Other'); }); };
  var q = st.docQ.toLowerCase(), list = cars.filter(function (c) { return (!q || (c.plate + ' ' + carName(c)).toLowerCase().indexOf(q) >= 0) && (!st.docNeed || need(c)); });
  el.innerHTML = '<div class="card"><div class="card-b tight"><div id="mt-df"></div><div class="row wrap gap8 mt8">' + UI.chip(tot.bad + ' expired', 'bad') + UI.chip(tot.warn + ' expiring soon', 'warn') + UI.chip(tot.miss + ' not recorded', 'grey') + '</div></div><div id="mt-dt"></div></div>';
  UI.filters(el.querySelector('#mt-df'), { values: st, fields: [{ type: 'search', key: 'docQ', placeholder: 'Search plate or car' }, { type: 'toggle', key: 'docNeed', label: 'Only cars that need attention' }], onChange: function () { mtTabDocs(el, ctx); var s = el.querySelector('input[type=search]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } },
    extra: ctx.can('maintenance.manage_documents') ? '<span class="grow"></span>' + UI.btn('Add a paper', { size: 'sm', icon: 'plus', attrs: { 'data-dact': 'add' } }) : '' });
  var cell = function (c, x) {
    var info = mtPaperInfo(x.p), lbl = x.p ? (x.p.until ? UI.fmt.date(x.p.until) : 'Recorded') : 'Missing';
    var tip = x.p ? (MT_PAPER_LONG[x.k] || x.k) + (x.p.provider ? ' · ' + x.p.provider : '') + (x.p.until ? ' · ' + (info.days < 0 ? 'expired ' + plural(-info.days, 'day') + ' ago' : 'expires in ' + plural(info.days, 'day')) : '') + ' · tap to renew' : 'No ' + x.k.toLowerCase() + ' recorded · tap to add';
    return '<button type="button" class="mt-dcell ' + info.tone + '" title="' + esc(tip) + '" data-dact="cell" data-car="' + c.id + '" data-kind="' + esc(x.k) + '"' + (x.p ? ' data-paper="' + x.p.id + '"' : '') + (ctx.can('maintenance.manage_documents') ? '' : ' disabled') + '>' + esc(lbl) + '</button>';
  };
  UI.table(el.querySelector('#mt-dt'), {
    columns: [{ key: 'plate', label: 'Car', sort: true, render: function (c) { return mtCarCell(c); } }].concat(LISTS.paperTypes.map(function (k) { return { key: k, label: k, render: function (c) { return cell(c, { k: k, p: mtLatestPaper(c.id, k, d) }); } }; })),
    rows: list, rowKey: 'id', density: 'compact', pageSize: false, minWidth: 900,
    card: function (c) { return mtCarCell(c) + '<div class="mt-dgrid">' + LISTS.paperTypes.map(function (k) { return '<div><span class="b2">' + k + '</span>' + cell(c, { k: k, p: mtLatestPaper(c.id, k, d) }) + '</div>'; }).join('') + '</div>'; },
    empty: { icon: 'file-check', title: 'Every car is in order', text: 'No car needs attention. Switch the filter off to see them all.' }
  });
  el.onclick = function (ev) {
    var b = ev.target.closest('[data-dact]'); if (!b) return;
    if (b.getAttribute('data-dact') === 'add') mtPaperForm({});
    else { var pid = b.getAttribute('data-paper'); if (pid) mtPaperForm({ renew: pid }); else mtPaperForm({ car: b.getAttribute('data-car'), kind: b.getAttribute('data-kind') }); }
  };
}

/* ---------------- tab: Workshop ---------------- */
function mtTabWorkshop(el, ctx) {
  var d = D(), now = NOW(), canD = ctx.can('maintenance.manage_downtime');
  var inNow = d.downtime.filter(function (w) { return !w.back && w.from <= now; }), soon = d.downtime.filter(function (w) { return !w.back && w.from > now; }), past = d.downtime.filter(function (w) { return w.back; }).sort(function (a, b) { return b.from - a.from; });
  var row = function (w) {
    var c = carById(w.car), j = w.job && byId(d.jobs, w.job), tone = { Service: 'pri', Repair: 'warn', Accident: 'bad', Inspection: 'info', Other: 'grey' }[w.reason];
    return '<div class="mt-ws"><div class="mt-ws-car">' + carsThumb(c, 'mt-ws-img') + mtCarCell(c) + '</div><div class="grow"><div class="row wrap gap8">' + UI.chip(w.reason, tone) + '<span class="b2">' + UI.fmt.date(w.from) + ' to ' + (w.to ? UI.fmt.date(w.to) : 'not known yet') + '</span>' + (!w.back && w.to && w.to < now ? UI.chip('Past the expected date', 'warn') : '') + '</div>' +
      (w.note ? '<div class="b2 mt8">' + esc(w.note) + '</div>' : '') + (j ? '<button type="button" class="mt-link" data-wact="job" data-id="' + j.id + '">' + i('link') + 'Job: ' + esc(j.title) + '</button>' : '') + '</div>' +
      '<div class="mt-ws-a">' + (!w.back && canD ? UI.btn('The car is back', { size: 'sm', icon: 'circle-check', attrs: { 'data-wact': 'back', 'data-id': w.id } }) : '') + (canD ? UI.btn('Remove', { size: 'sm', kind: 't', icon: 'trash', attrs: { 'data-wact': 'remove', 'data-id': w.id } }) : '') + '</div></div>';
  };
  var sec = function (title, list, empty) { return '<div class="card mt16"><div class="card-h"><h3>' + title + '</h3></div><div class="card-b">' + (list.length ? list.map(row).join('') : '<p class="b2">' + empty + '</p>') + '</div></div>'; };
  el.innerHTML = '<div class="row wrap" style="justify-content:space-between"><div><div class="h5">Workshop time</div><div class="b2">While a car is in the workshop it cannot be booked and is not shown as free.</div></div><div class="row wrap gap8">' + UI.btn('Open the calendar', { kind: 'o', icon: 'calendar', attrs: { 'data-wact': 'cal' } }) + (canD ? UI.btn('Block a car', { icon: 'lock', attrs: { 'data-wact': 'block' } }) : '') + '</div></div>' +
    sec('In the workshop now', inNow, 'Every car is on the road.') + sec('Going in soon', soon, 'Nothing planned.') + sec('Recent workshop visits (' + past.length + ')', past.slice(0, 12), 'No visits yet.');
  el.onclick = function (ev) {
    var b = ev.target.closest('[data-wact]'); if (!b) return;
    var a = b.getAttribute('data-wact'), w = byId(d.downtime, b.getAttribute('data-id'));
    if (a === 'cal') ctx.go('calendar');
    else if (a === 'block') mtBlockDialog({});
    else if (a === 'job') mtJobDrawer(b.getAttribute('data-id'));
    else if (a === 'back') mtCarBack(w);
    else if (a === 'remove') UI.confirm({ title: 'Remove this workshop time?', text: 'The car will show as free for these dates again.', ok: 'Remove', danger: true }).then(function (y) { if (y) { DB.remove('downtime', w, { text: DB.actor() + ' removed the workshop time of ' + carById(w.car).plate, where: 'Maintenance record' }); mtSyncWorkshop(w.car); UI.toast('Workshop time removed'); } });
  };
}
function mtCarBack(w) {
  var now = NOW();
  DB.update('downtime', w, { back: true, to: w.to && w.to < now ? w.to : now }, { text: DB.actor() + ' marked ' + carById(w.car).plate + ' back from the workshop', where: 'Maintenance record' });
  mtSyncWorkshop(w.car);
  UI.toast('Marked as back. The car can be booked again.');
}
/* keep the car's "in the workshop" flag in step with its workshop time */
function mtSyncWorkshop(carId) {
  var c = carById(carId); if (!c) return;
  var on = !!mtDowntimeOn(carId, NOW(), NOW()) || D().jobs.some(function (j) { return j.car === carId && j.status === 'In the workshop' && j.block; });
  if (c.inWorkshop !== on) DB.update('cars', c, { inWorkshop: on, status: on ? 'workshop' : 'active' }, { silent: true });
}

/* ---------------- tab: Vendors ---------------- */
function mtTabVendors(el, ctx) {
  var st = ctx.state, d = D(), f = st.venF || (st.venF = {});
  var stats = function (v) { var js = d.jobs.filter(function (j) { return j.vendor === v.id; }), done = js.filter(function (j) { return j.status === 'Done'; }); return { jobs: js.length, spent: sum(done.map(function (j) { return j.total || 0; })), last: js.map(function (j) { return j.date; }).sort(function (a, b) { return b - a; })[0] }; };
  var rows = function () { var q = (f.q || '').toLowerCase(); return d.vendors.filter(function (v) { return (f.old || v.active) && (!q || (v.name + ' ' + v.kind + ' ' + v.phone + ' ' + v.address).toLowerCase().indexOf(q) >= 0); }).map(function (v) { var s = stats(v); return Object.assign({ v: v, id: v.id, name: v.name, jobs: s.jobs, spent: s.spent, last: s.last }); }); };
  el.innerHTML = '<div class="card"><div class="card-b tight"><div id="mt-vf"></div></div><div id="mt-vt"></div></div>';
  var t;
  UI.filters(el.querySelector('#mt-vf'), { values: f, fields: [{ type: 'search', key: 'q', placeholder: 'Search workshops' }, { type: 'toggle', key: 'old', label: 'Show workshops no longer in use' }], onChange: function () { t.setRows(rows()); },
    extra: ctx.can('maintenance.manage_vendors') ? '<span class="grow"></span>' + UI.btn('Add a workshop', { size: 'sm', icon: 'plus', attrs: { 'data-vact': 'add' } }) : '' });
  var contact = function (v) { return '<span class="row gap4">' + (v.phone ? '<a class="ib sm" href="tel:' + esc(v.phone.replace(/\s/g, '')) + '" title="Call ' + esc(v.phone) + '" aria-label="Call" data-stop>' + i('phone') + '</a>' : '') + (v.wa || v.phone ? '<a class="ib sm" href="' + UI.waLink(v.wa || v.phone) + '" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp" data-stop>' + i('brand-whatsapp') + '</a>' : '') + (v.email ? '<a class="ib sm" href="mailto:' + esc(v.email) + '" title="' + esc(v.email) + '" aria-label="Email" data-stop>' + i('mail') + '</a>' : '') + '</span>'; };
  t = UI.table(el.querySelector('#mt-vt'), {
    columns: [{ key: 'name', label: 'Workshop', sort: true, render: function (r) { return '<b class="fw5">' + esc(r.name) + '</b>' + (r.v.active ? '' : ' ' + UI.chip('Not in use', 'grey')) + '<div class="b2">' + UI.phone(r.v.phone) + '</div>'; } },
      { key: 'kind', label: 'Kind', render: function (r) { return esc(r.v.kind); } },
      { key: 'contact', label: 'Contact', render: function (r) { return contact(r.v); } },
      { key: 'jobs', label: 'Jobs', align: 'right', sort: true },
      { key: 'spent', label: 'Spent', align: 'right', sort: true, hidden: !mtCostsOk(), render: function (r) { return UI.money(r.spent); } },
      { key: 'last', label: 'Last job', sort: true, render: function (r) { return r.last ? UI.fmt.date(r.last) : '<span class="faint">None yet</span>'; } }],
    rows: rows(), rowKey: 'id', density: 'compact', pageSize: false, minWidth: 760,
    onRowClick: function (r) { mtVendorDrawer(r.id); },
    card: function (r) { return '<div class="row" style="justify-content:space-between"><b>' + esc(r.name) + '</b>' + contact(r.v) + '</div><div class="b2">' + esc(r.v.kind) + ' · ' + plural(r.jobs, 'job') + (mtCostsOk() ? ' · ' + UI.fmt.money(r.spent) : '') + '</div>'; },
    empty: { icon: 'building-store', title: 'No workshops yet', text: 'Add the places that service your cars.' }
  });
  el.onclick = function (ev) { if (ev.target.closest('[data-vact="add"]')) mtVendorDrawer(null); };
}
function mtVendorDrawer(id, onAdded) {
  var d = D(), v = id ? byId(d.vendors, id) : null, ok = can('maintenance.manage_vendors');
  var f = v ? { name: v.name, kind: v.kind, phone: v.phone, wa: v.wa, email: v.email, address: v.address, notes: v.notes, active: v.active } : { name: '', kind: 'Workshop', phone: '', wa: '', email: '', address: '', notes: '', active: true };
  var start = JSON.stringify(f);
  var js = v ? d.jobs.filter(function (j) { return j.vendor === v.id; }) : [];
  var body = (v ? '<div class="mt-mini">' + '<div><span>Jobs</span><b>' + js.length + '</b></div>' + (mtCostsOk() ? '<div><span>Spent</span><b>' + UI.fmt.money(sum(js.filter(function (j) { return j.status === 'Done'; }).map(function (j) { return j.total || 0; }))) + '</b></div>' : '') + '<div><span>Last job</span><b>' + (js.length ? UI.fmt.date(js.map(function (j) { return j.date; }).sort(function (a, b) { return b - a; })[0]) : 'None yet') + '</b></div></div>' : '') +
    '<div class="mt-form">' + UI.input({ key: 'name', label: 'Name', required: true, value: f.name, full: true }) + UI.select({ key: 'kind', label: 'Kind', options: LISTS.vendorKinds, value: f.kind }) + UI.input({ key: 'phone', label: 'Phone', value: f.phone, type: 'tel' }) +
    UI.input({ key: 'wa', label: 'WhatsApp', value: f.wa, type: 'tel', help: 'If different from the phone' }) + UI.input({ key: 'email', label: 'Email', value: f.email, type: 'email' }) + UI.input({ key: 'address', label: 'Address', value: f.address, full: true }) +
    UI.textarea({ key: 'notes', label: 'Notes', value: f.notes, placeholder: 'Opening hours, who to ask for...' }) + UI.switch({ key: 'active', label: 'Still in use', help: 'Turn off to hide it from the pick-list', checked: f.active, full: true }) + '</div>';
  var dr = UI.drawer({ title: v ? v.name : 'Add a workshop', subtitle: v ? v.kind : 'A place that services or repairs your cars', width: 560, body: body,
    dirty: function () { return JSON.stringify(f) !== start; },
    foot: (v && ok ? [{ label: 'Delete', kind: 'err', icon: 'trash', close: false, onClick: function (dw) { UI.confirm({ title: 'Delete ' + v.name + '?', text: js.length ? 'Its ' + plural(js.length, 'job') + ' stay in the log with no workshop.' : 'This cannot be undone.', ok: 'Delete', danger: true }).then(function (y) { if (y) { js.forEach(function (j) { j.vendor = ''; }); DB.remove('vendors', v); dw.close(true); UI.toast('Workshop deleted'); } }); return false; } }, { spacer: true }] : []).concat([{ label: 'Cancel', kind: 'g' }, ok ? { label: v ? 'Save changes' : 'Add workshop', icon: 'check', onClick: function () {
      if (!f.name.trim()) { UI.toast('Type the workshop name', { tone: 'warn' }); return false; }
      if (v) { DB.update('vendors', v, f); UI.toast('Workshop saved'); }
      else { var nv = DB.add('vendors', Object.assign({}, f)); UI.toast('Workshop added'); if (onAdded) onAdded(nv); }
    } } : null]).filter(Boolean) });
  mtBind(dr.body, f);
  return dr;
}

/* ---------------- tab: Costs ---------------- */
function mtPeriod(st) {
  var t = mtToday(), p = st.costP || 'month';
  if (p === 'month') return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: NOW() };
  if (p === '3m') return { from: new Date(t.getFullYear(), t.getMonth() - 2, 1), to: NOW() };
  if (p === '12m') return { from: new Date(t.getFullYear(), t.getMonth() - 11, 1), to: NOW() };
  if (p === 'year') return { from: new Date(t.getFullYear(), 0, 1), to: NOW() };
  var a = mtDate(st.costFrom) || new Date(t.getFullYear(), t.getMonth(), 1), b = mtDate(st.costTo) || t;
  return { from: a, to: new Date(b.getTime() + DAY - 1) };
}
function mtTabCosts(el, ctx) {
  var st = ctx.state, d = D(); st.costP = st.costP || 'month';
  var per = mtPeriod(st), jobs = d.jobs.filter(function (j) { var at = j.doneAt || j.date; return j.status === 'Done' && at >= per.from && at <= per.to; });
  var total = sum(jobs.map(function (j) { return j.total || 0; }));
  var parts = 0, lab = 0; jobs.forEach(function (j) { j.lines.forEach(function (l) { if (l.type === 'Labour') lab += l.qty * l.price; else parts += l.qty * l.price; }); });
  var kmAll = 0, spentKm = 0;
  var byCar = d.cars.map(function (c) { var js = jobs.filter(function (j) { return j.car === c.id; }), s = sum(js.map(function (j) { return j.total || 0; })), km = mtKmDriven(c.id, per.from, per.to), last = d.jobs.filter(function (j) { return j.car === c.id && j.status === 'Done'; })[0]; if (km) { kmAll += km; spentKm += s; } return { id: c.id, c: c, plate: c.plate, jobs: js.length, spent: s, km: km, cpk: km ? s / km : null, last: last ? last.date : null }; }).filter(function (r) { return r.jobs || r.km; });
  var byVen = {}, byKind = {};
  jobs.forEach(function (j) { var vn = mtVendorName(j.vendor) || 'Not specified'; byVen[vn] = byVen[vn] || { name: vn, jobs: 0, spent: 0 }; byVen[vn].jobs++; byVen[vn].spent += j.total || 0; byKind[j.type] = byKind[j.type] || { name: j.type, jobs: 0, spent: 0 }; byKind[j.type].jobs++; byKind[j.type].spent += j.total || 0; });
  /* months: those in the period, at least 6 */
  var mEnd = new Date(per.to.getFullYear(), per.to.getMonth(), 1), mStart = new Date(per.from.getFullYear(), per.from.getMonth(), 1), months = [];
  if ((mEnd.getFullYear() - mStart.getFullYear()) * 12 + mEnd.getMonth() - mStart.getMonth() < 5) mStart = new Date(mEnd.getFullYear(), mEnd.getMonth() - 5, 1);
  for (var m = new Date(mStart); m <= mEnd; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) months.push(m);
  var mVals = months.map(function (m) { var n = new Date(m.getFullYear(), m.getMonth() + 1, 1); return sum(d.jobs.filter(function (j) { var at = j.doneAt || j.date; return j.status === 'Done' && at >= m && at < n; }).map(function (j) { return j.total || 0; })); });
  var kinds = Object.keys(byKind).map(function (k) { return byKind[k]; }).sort(function (a, b) { return b.spent - a.spent; });
  el.innerHTML = '<div class="card"><div class="card-b tight"><div id="mt-cf"></div><div class="b2 mt8">Finished jobs from ' + UI.fmt.date(per.from) + ' to ' + UI.fmt.date(per.to) + '</div></div></div>' +
    '<div class="mt-kpis mt16">' + UI.stat({ label: 'Total spent', value: UI.fmt.money(total), note: plural(jobs.length, 'job'), icon: 'report-money' }) + UI.stat({ label: 'Average per job', value: UI.fmt.money(jobs.length ? total / jobs.length : 0), icon: 'calculator', tone: 'info' }) +
    UI.stat({ label: 'Parts / labour', value: (total ? Math.round(parts / (parts + lab || 1) * 100) : 0) + '% / ' + (total ? Math.round(lab / (parts + lab || 1) * 100) : 0) + '%', note: UI.fmt.money(parts, { dp: 0 }) + ' parts · ' + UI.fmt.money(lab, { dp: 0 }) + ' labour', icon: 'chart-pie', tone: 'warn' }) +
    UI.stat({ label: 'Cost per km', value: kmAll ? UI.fmt.money(spentKm / kmAll) : '-', note: 'Across cars with odometer readings', icon: 'road', tone: 'ok' }) + '</div>' +
    '<div class="mt-two mt16"><div class="card"><div class="card-h"><h3>Spending by month</h3></div><div class="card-b">' + UI.chart.bars({ labels: months.map(function (m) { return MON[m.getMonth()] + ' ' + String(m.getFullYear()).slice(2); }), series: [{ name: 'Spent', values: mVals }], fmt: function (v) { return rmk(v); }, label: 'Spending by month' }) + '</div></div>' +
    '<div class="card"><div class="card-h"><h3>By kind of work</h3></div><div class="card-b">' + (kinds.length ? UI.chart.donut({ items: kinds.slice(0, 7).map(function (k) { return { label: k.name, value: k.spent }; }), center: { value: UI.fmt.money(total, { dp: 0 }), label: 'spent' }, fmt: function (v) { return UI.fmt.money(v, { dp: 0 }); } }) : UI.empty({ icon: 'chart-donut', title: 'No finished jobs in this period' })) + '</div></div></div>' +
    '<div class="card mt16"><div class="card-h"><div><h3>By car</h3><p>Tap a car to open its health card</p></div></div><div id="mt-cc"></div></div>' +
    '<div class="mt-two mt16"><div class="card"><div class="card-h"><h3>By workshop</h3></div><div id="mt-cv"></div></div><div class="card"><div class="card-h"><h3>By kind of work</h3></div><div id="mt-ck"></div></div></div>';
  UI.filters(el.querySelector('#mt-cf'), { values: st, fields: [{ type: 'chips', key: 'costP', options: [['month', 'This month'], ['3m', 'Last 3 months'], ['12m', 'Last 12 months'], ['year', 'This year'], ['pick', 'Pick dates']] }].concat(st.costP === 'pick' ? [{ type: 'daterange', from: 'costFrom', to: 'costTo', label: 'From' }] : []),
    onChange: function () { mtTabCosts(el, ctx); }, extra: ctx.can('maintenance.export') ? '<span class="grow"></span>' + UI.btn('Export Excel', { kind: 'o', size: 'sm', icon: 'file-spreadsheet', attrs: { 'data-cact': 'xlsx' } }) : '' });
  UI.table(el.querySelector('#mt-cc'), { columns: [{ key: 'plate', label: 'Car', sort: true, render: function (r) { return mtCarCell(r.c); } }, { key: 'jobs', label: 'Jobs', align: 'right', sort: true }, { key: 'spent', label: 'Spent', align: 'right', sort: true, render: function (r) { return UI.money(r.spent); } }, { key: 'km', label: 'Km driven', align: 'right', sort: true, render: function (r) { return r.km ? mtKm(r.km) : '<span class="faint">-</span>'; } }, { key: 'cpk', label: 'Cost per km', align: 'right', sort: true, render: function (r) { return r.cpk != null ? UI.money(r.cpk) : '<span class="faint">-</span>'; } }, { key: 'last', label: 'Last service', sort: true, render: function (r) { return r.last ? UI.fmt.date(r.last) : '<span class="faint">-</span>'; } }],
    rows: byCar, rowKey: 'id', density: 'compact', pageSize: false, sort: { key: 'spent', dir: 'desc' }, minWidth: 700, onRowClick: function (r) { mtCarHealth(r.id); },
    card: function (r) { return '<div class="row" style="justify-content:space-between">' + mtCarCell(r.c) + UI.money(r.spent) + '</div><div class="b2">' + plural(r.jobs, 'job') + (r.km ? ' · ' + mtKm(r.km) + ' · ' + UI.fmt.money(r.cpk) + ' a km' : '') + '</div>'; } });
  var small = function (sel, rows, label) { UI.table(el.querySelector(sel), { columns: [{ key: 'name', label: label, sort: true }, { key: 'jobs', label: 'Jobs', align: 'right', sort: true }, { key: 'spent', label: 'Spent', align: 'right', sort: true, render: function (r) { return UI.money(r.spent); } }], rows: rows, rowKey: 'name', density: 'compact', pageSize: false, sort: { key: 'spent', dir: 'desc' }, minWidth: 320, empty: { icon: 'database-off', title: 'No finished jobs in this period' } }); };
  small('#mt-cv', Object.keys(byVen).map(function (k) { return byVen[k]; }), 'Workshop');
  small('#mt-ck', kinds, 'Work');
  el.onclick = function (ev) { if (ev.target.closest('[data-cact="xlsx"]')) mtExport(jobs, 'maintenance-' + mtIso(per.from) + '-to-' + mtIso(per.to) + '.xlsx'); };
}

/* ---------------- Log a service / Plan a job / In the workshop / Edit / Finish ---------------- */
function mtJobForm(o) {
  o = o || {};
  var d = D(), job = o.job ? byId(d.jobs, o.job) : null, mode = o.mode || (job ? 'edit' : 'new');
  if (!job && !can('maintenance.create')) { UI.toast('You cannot log services. Ask the owner for access.', { tone: 'warn' }); return; }
  var today = mtIso(mtToday());
  var f = job ? { car: job.car, type: job.type, when: { Done: 'done', Planned: 'plan', 'In the workshop': 'in' }[job.status] || 'done', date: mtIso(job.status === 'Planned' ? job.plannedFor || job.date : job.date), cost: job.lines.length ? null : job.total, note: job.note || '', block: job.block, back: mtIso(job.backAt), vendor: job.vendor || '', odo: job.odo || null,
    lines: job.lines.map(function (l) { return Object.assign({}, l); }), tax: job.tax || null, invoiceNo: job.invoiceNo || '', paid: job.paid ? 'yes' : 'no', paidOn: mtIso(job.paidOn), warranty: mtIso(job.warranty), booking: job.booking || '', charge: !!job.charge, chargeAmt: job.charge || null, files: (job.files || []).slice(), remKm: null, remDays: null, more: true }
    : { car: o.car || '', type: o.type || '', when: o.when || 'done', date: today, cost: null, note: '', block: true, back: '', vendor: '', odo: null, lines: [], tax: null, invoiceNo: '', paid: 'yes', paidOn: '', warranty: '', booking: '', charge: false, chargeAmt: null, files: [], remKm: null, remDays: null, more: false };
  if (mode === 'finish') { f.when = 'done'; f.date = today; f.more = true; }
  var start = JSON.stringify(f);
  var title = function () { return mode === 'finish' ? 'Finish this job' : job ? 'Edit job' : f.when === 'plan' ? 'Plan a job' : f.when === 'in' ? 'Car goes into the workshop' : 'Log a service'; };
  var okLabel = function () { return mode === 'finish' ? 'Mark as done' : job ? 'Save changes' : f.when === 'plan' ? 'Plan job' : f.when === 'in' ? 'Put in workshop' : 'Save service'; };
  var linesTotal = function () { return sum(f.lines.map(function (l) { return (Number(l.qty) || 0) * (Number(l.price) || 0); })); };
  var costs = mtCostsOk(), files = can('maintenance.manage_files');
  f.force = false;
  var clashes = function () { return f.car && f.date ? mtClashes(f.car, mtDate(f.date), f.back ? new Date(mtDate(f.back).getTime() + DAY) : null).filter(function (x) { return !job || x.code !== job.booking; }) : []; };
  function html() {
    var c = carById(f.car), rem = c && f.type ? d.reminders.filter(function (r) { return r.car === c.id && r.service === f.type; })[0] : null;
    var dateLbl = f.when === 'plan' ? 'Planned date' : f.when === 'in' ? 'Went in on' : 'Date';
    var h = '<div class="mt-form"><div class="mt-carpk full"></div>' +
      '<div class="inp full"><label>What was done? <span class="ui-req">*</span></label><div class="mt-chips" role="radiogroup">' + LISTS.serviceTypes.map(function (s) { return '<button type="button" role="radio" class="mt-chip" data-svc="' + esc(s) + '" aria-checked="' + (f.type === s) + '">' + esc(s) + '</button>'; }).join('') + '</div></div>' +
      (mode === 'finish' ? '' : UI.choice({ key: 'when', label: 'When?', value: f.when, full: true, options: [['done', 'It is done'], ['plan', 'Plan it for later'], ['in', 'Car is in the workshop now']] })) +
      UI.dateField({ key: 'date', label: dateLbl, required: true, value: f.date }) +
      (costs ? (f.lines.length ? UI.input({ key: 'costShow', label: f.when === 'done' ? 'Total cost' : 'Estimated cost', prefix: 'RM', readonly: true, value: (linesTotal() + (Number(f.tax) || 0)).toFixed(2), help: 'Worked out from the lines below', attrs: { 'data-nobind': '' } }) : UI.input({ key: 'cost', label: f.when === 'done' ? 'Total cost' : 'Estimated cost', type: 'number', prefix: 'RM', min: 0, step: '0.01', value: f.cost, placeholder: '0.00' })) : '') +
      UI.textarea({ key: 'note', label: 'Note (optional)', value: f.note, rows: 2, placeholder: 'What was done, what the mechanic said...' }) + '</div>';
    if (f.when === 'in') {
      h += '<div class="mt-box mt16"><div class="mt-cap">Workshop time</div>' + UI.switch({ key: 'block', label: 'Block this car for rentals while it is in the workshop', checked: f.block }) + UI.dateField({ key: 'back', label: 'Expected back (optional)', value: f.back, min: f.date }) +
        (f.block && f.car ? mtClashHtml(clashes(), { forced: f.force }) : '') + '</div>';
    }
    var vend = d.vendors.filter(function (v) { return v.active || v.id === f.vendor; }).map(function (v) { return [v.id, v.name + ' (' + v.kind + ')']; });
    var bks = c ? d.bookings.filter(function (x) { return x.car === c && x.status !== 'Cancelled' && x.start <= NOW(); }).slice(-15).reverse().map(function (x) { return [x.code, x.code + ' · ' + x.cust.name + ' · ' + UI.fmt.date(x.start) + ' to ' + UI.fmt.date(x.end)]; }) : [];
    h += '<section class="mt-moreb' + (f.more ? '' : ' shut') + '"><button type="button" class="mt-moreh" data-jf="more">More details' + i('chevron-down') + '</button><div class="mt-moreb-b">' +
      '<div class="mt-cap">Workshop</div><div class="row gap8" style="align-items:flex-end">' + UI.select({ key: 'vendor', label: 'Where was it done?', options: vend, value: f.vendor, placeholder: 'Not specified', style: 'flex:1' }) + (can('maintenance.manage_vendors') ? UI.iconBtn('plus', 'Add a workshop', { attrs: { 'data-jf': 'vendor' } }) : '') + '</div>' +
      '<div class="mt-cap">Odometer</div>' + UI.input({ key: 'odo', label: 'Odometer at the service', type: 'number', min: 0, value: f.odo, placeholder: 'For example 48200', help: c ? 'Last known: ' + mtKm(c.odo) + ' (' + UI.fmt.date(c.odoAt) + ')' : '' }) +
      (costs ? '<div class="mt-cap">Parts and labour</div>' + (f.lines.length ? '<div class="mt-lines">' + f.lines.map(function (l, k) {
        return '<div class="mt-line" data-nobind>' + '<input type="text" aria-label="What" placeholder="What" data-line="' + k + '" data-lk="what" value="' + esc(l.what) + '">' +
          '<select aria-label="Type" data-line="' + k + '" data-lk="type">' + UI.options(['Part', 'Labour', 'Other'], l.type) + '</select>' +
          '<input type="number" aria-label="Qty" min="0" step="1" data-line="' + k + '" data-lk="qty" value="' + esc(l.qty) + '">' +
          '<input type="number" aria-label="Price each (RM)" placeholder="Price each" min="0" step="0.01" data-line="' + k + '" data-lk="price" value="' + esc(l.price == null ? '' : l.price) + '">' +
          '<input type="text" aria-label="Part no." placeholder="Part no." data-line="' + k + '" data-lk="partNo" value="' + esc(l.partNo || '') + '">' +
          UI.iconBtn('x', 'Remove this line', { size: 'sm', attrs: { 'data-jf': 'rmline', 'data-k': k } }) + '</div>';
      }).join('') + '<div class="mt-lines-t">Lines total <b class="num" data-lt>' + UI.fmt.money(linesTotal()) + '</b></div></div>' : '') +
        '<div class="row gap8">' + UI.btn('Add a line', { kind: 'tonal', size: 'sm', icon: 'plus', attrs: { 'data-jf': 'line' } }) + UI.btn('Add labour', { kind: 'g', size: 'sm', attrs: { 'data-jf': 'labour' } }) + '</div>' +
        '<div class="mt-cap">Tax and payment</div><div class="mt-form">' + UI.input({ key: 'tax', label: 'Tax (SST)', type: 'number', prefix: 'RM', min: 0, step: '0.01', value: f.tax, placeholder: '0.00' }) + UI.input({ key: 'invoiceNo', label: 'Workshop invoice number', value: f.invoiceNo }) +
        UI.select({ key: 'paid', label: 'Payment', options: [['yes', 'Paid'], ['no', 'Not paid yet']], value: f.paid }) + (f.paid === 'yes' ? UI.dateField({ key: 'paidOn', label: 'Paid on', chips: false, value: f.paidOn }) : '<div></div>') +
        UI.dateField({ key: 'warranty', label: 'Warranty until (optional)', chips: false, value: f.warranty }) + '</div>' : '') +
      '<div class="mt-cap">Caused by a renter?</div>' + UI.select({ key: 'booking', label: 'Linked booking', options: bks, value: f.booking, placeholder: c ? 'No booking' : 'Choose the car first' }) +
      UI.switch({ key: 'charge', label: 'Charge the customer for this', checked: f.charge }) + (f.charge ? UI.input({ key: 'chargeAmt', label: 'Amount to charge', type: 'number', prefix: 'RM', min: 0, step: '0.01', value: f.chargeAmt, placeholder: '0.00' }) : '') +
      (files ? '<div class="mt-cap">Invoices and photos</div>' + (f.files.length ? '<div class="mt-files">' + f.files.map(function (x, k) { return '<div class="mt-file mt-filek" data-nobind>' + (x.dataUrl && /^data:image/.test(x.dataUrl) ? '<img src="' + x.dataUrl + '" alt="">' : i(/pdf/i.test(x.name) ? 'file-type-pdf' : 'photo')) + '<div class="grow mt-filek-b"><span class="ellip fw5">' + esc(x.name) + ' <small>' + UI.fmt.size(x.size) + '</small></span><div class="mt-filek-f"><select aria-label="What is this file" data-fk="' + k + '" data-fkey="kind">' + UI.options(MT_FILE_KINDS, x.kind || 'Invoice') + '</select><input type="text" maxlength="200" placeholder="Caption (optional)" aria-label="Caption" data-fk="' + k + '" data-fkey="caption" value="' + esc(x.caption || '') + '"></div></div>' + UI.iconBtn('trash', 'Remove ' + x.name, { size: 'sm', attrs: { 'data-jf': 'rmfile', 'data-k': k } }) + '</div>'; }).join('') + '</div>' : '') + '<div class="mt-dz"></div><div class="b2">Photos (JPG, PNG, WEBP) and PDF files, up to 8 MB each. Mark each one as an invoice, receipt, quotation, photo before or photo after.</div>' : '') +
      '<div class="mt-cap">Next service</div>' + (rem ? UI.alert('This car already has a reminder for ' + f.type + ' every ' + [rem.km ? UI.fmt.num(rem.km) + ' km' : '', rem.days ? rem.days + ' days' : ''].filter(Boolean).join(' or every ') + '. It will move forward by itself when this is saved.', 'pri') :
        '<div class="b2">Remind me when the next one is due</div><div class="mt-form">' + UI.input({ key: 'remKm', label: 'After how many km', type: 'number', min: 0, value: f.remKm, placeholder: 'For example 10000' }) + UI.input({ key: 'remDays', label: 'Or after how many days', type: 'number', min: 0, value: f.remDays, placeholder: 'For example 180' }) + '</div>') +
      '</div></section>';
    return h;
  }
  var dr = UI.drawer({ title: title(), subtitle: f.car ? mtCarLine(carById(f.car)) : 'Pick the car and what was done', subHtml: true, width: 640, body: '<div class="mt-jf"></div>', dirty: function () { return JSON.stringify(f) !== start; }, foot: [] });
  var box = dr.body.querySelector('.mt-jf');
  function paint() {
    var sc = dr.body.scrollTop; box.innerHTML = html(); dr.body.scrollTop = sc;
    dr.setTitle(title(), f.car ? carById(f.car).plate + ' · ' + carName(carById(f.car)) : 'Pick the car and what was done');
    dr.setFoot([{ label: 'Cancel', kind: 'g' }, { label: okLabel(), icon: 'device-floppy', onClick: save }]);
    var pk = box.querySelector('.mt-carpk');
    if (pk) { var s0 = f.when !== 'done' && f.date ? mtDate(f.date) : null; mtCarPick(pk, { value: f.car, start: s0, end: s0 ? (f.back ? new Date(mtDate(f.back).getTime() + DAY) : new Date(s0.getTime() + DAY)) : null, help: f.when === 'done' ? '' : 'The badge shows whether the car is free on that date' }); }
    var dz = box.querySelector('.mt-dz');
    if (dz) UI.dropzone(dz, { accept: 'image/jpeg,image/png,image/webp,.pdf', multiple: true, camera: true, label: 'Add photos or PDFs', hint: 'Drop them here, or take a photo', onFiles: function (fs) { Promise.all(fs.map(function (x) { return mtReadFile(x).catch(function (e) { UI.toast(e.message, { tone: 'warn' }); return null; }); })).then(function (rs) { rs.forEach(function (r) { if (r) f.files.push(r); }); paint(); }); } });
  }
  mtBind(box, f, function (k, ev) { if (['car', 'back', 'date', 'block'].indexOf(k) >= 0) f.force = false; if (ev.type === 'change' && ['car', 'when', 'block', 'back', 'date', 'charge', 'paid', 'tax'].indexOf(k) >= 0) paint(); });
  var fileField = function (t) { var k = t.getAttribute('data-fk'); if (k == null) return; var x = f.files[+k]; if (x) { f.files[+k] = Object.assign({}, x); f.files[+k][t.getAttribute('data-fkey')] = t.value; } };
  box.addEventListener('input', function (ev) { fileField(ev.target); });
  box.addEventListener('change', function (ev) { fileField(ev.target); });
  box.addEventListener('input', function (ev) {
    var t = ev.target, k = t.getAttribute('data-line'); if (k == null) return;
    var key = t.getAttribute('data-lk'); f.lines[+k][key] = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value;
    var lt = box.querySelector('[data-lt]'); if (lt) lt.textContent = UI.fmt.money(linesTotal());
    var cs = box.querySelector('[data-key="costShow"]'); if (cs) cs.value = (linesTotal() + (Number(f.tax) || 0)).toFixed(2);
  });
  box.addEventListener('change', function (ev) { var t = ev.target; if (t.getAttribute('data-line') != null) f.lines[+t.getAttribute('data-line')][t.getAttribute('data-lk')] = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value; });
  box.addEventListener('click', function (ev) {
    var s = ev.target.closest('[data-svc]'); if (s) { f.type = s.getAttribute('data-svc'); paint(); return; }
    if (ev.target.closest('[data-force]')) { f.force = !f.force; paint(); return; }
    var b = ev.target.closest('[data-jf]'); if (!b) return;
    var a = b.getAttribute('data-jf');
    if (a === 'more') { f.more = !f.more; paint(); }
    else if (a === 'line') { f.lines.push({ what: '', type: 'Part', qty: 1, price: null, partNo: '' }); paint(); }
    else if (a === 'labour') { f.lines.push({ what: 'Labour', type: 'Labour', qty: 1, price: null, partNo: '' }); paint(); }
    else if (a === 'rmline') { f.lines.splice(+b.getAttribute('data-k'), 1); paint(); }
    else if (a === 'rmfile') { f.files.splice(+b.getAttribute('data-k'), 1); paint(); }
    else if (a === 'vendor') mtVendorDrawer(null, function (nv) { f.vendor = nv.id; paint(); });
  });
  function save() {
    if (!f.car) { UI.toast('Pick the car', { tone: 'warn' }); return false; }
    if (!f.type) { UI.toast('Pick what was done', { tone: 'warn' }); return false; }
    if (!f.date) { UI.toast('Pick the date', { tone: 'warn' }); return false; }
    if (f.when === 'in' && f.block && clashes().length && !f.force) { UI.toast(can('maintenance.manage_downtime') ? 'Some rentals clash with this workshop time. Move them first, or press "Put the car in the workshop anyway".' : 'Some rentals clash with this workshop time. Move them to another car first.', { tone: 'warn', ms: 6000 }); return false; }
    var c = carById(f.car), date = mtDate(f.date), status = f.when === 'done' ? 'Done' : f.when === 'plan' ? 'Planned' : 'In the workshop';
    var lines = f.lines.filter(function (l) { return l.what || l.price; }).map(function (l) { return { what: l.what || l.type, type: l.type, qty: Number(l.qty) || 1, price: Number(l.price) || 0, partNo: l.partNo || '' }; });
    var total = lines.length ? sum(lines.map(function (l) { return l.qty * l.price; })) + (Number(f.tax) || 0) : (Number(f.cost) || 0);
    var rec = { car: c.id, type: f.type, title: f.type, status: status, date: date, plannedFor: status === 'Planned' ? date : (job ? job.plannedFor : null), vendor: f.vendor, odo: f.odo || null, lines: lines, tax: Number(f.tax) || 0, invoiceNo: f.invoiceNo, paid: f.paid === 'yes' && status === 'Done', paidOn: f.paid === 'yes' ? mtDate(f.paidOn) || (status === 'Done' ? date : null) : null,
      warranty: mtDate(f.warranty), booking: f.booking || null, charge: f.charge ? Number(f.chargeAmt) || 0 : 0, note: f.note, files: f.files, inAt: status === 'In the workshop' ? date : (job ? job.inAt : null), backAt: mtDate(f.back), block: status === 'In the workshop' ? !!f.block : (job ? job.block : false), doneAt: status === 'Done' ? date : null, total: total };
    var j;
    if (job) j = DB.update('jobs', job, rec, { text: DB.actor() + (mode === 'finish' ? ' marked ' + f.type + ' of ' + c.plate + ' as done' : ' changed the job ' + f.type + ' of ' + c.plate), where: 'Maintenance record' });
    else { rec.by = DB.actor(); rec.at = NOW(); j = DB.add('jobs', rec, { first: true, text: DB.actor() + (status === 'Done' ? ' logged ' : status === 'Planned' ? ' planned ' : ' put ' + c.plate + ' in the workshop for ') + f.type + (status === 'In the workshop' ? '' : ' for ' + c.plate), where: 'Maintenance record' }); }
    D().jobs.sort(function (a, b) { return b.date - a.date; });
    if (status === 'Done') {
      if (f.odo && f.odo > c.odo) { DB.update('cars', c, { odo: f.odo, odoAt: date }, { silent: true }); D().odometer.push({ car: c.id, km: f.odo, at: date, by: DB.actor(), source: 'service', job: j.id }); }
      var rem = D().reminders.filter(function (r) { return r.car === c.id && r.service === f.type; })[0];
      if (rem) DB.update('reminders', rem, { lastAt: date, lastKm: f.odo || c.odo, snoozedUntil: null }, { silent: true });
      else if (f.remKm || f.remDays) DB.add('reminders', { car: c.id, service: f.type, km: Number(f.remKm) || 0, days: Number(f.remDays) || 0, lastAt: date, lastKm: f.odo || c.odo, on: true, snoozedUntil: null }, { text: DB.actor() + ' added a reminder for ' + f.type + ' of ' + c.plate, where: 'Maintenance record' });
      D().downtime.forEach(function (w) { if (w.job === j.id && !w.back) DB.update('downtime', w, { back: true, to: NOW() }, { silent: true }); });
    }
    if (status === 'In the workshop' && f.block && !D().downtime.some(function (w) { return w.job === j.id && !w.back; })) DB.add('downtime', { car: c.id, reason: f.type === 'Accident repair' ? 'Accident' : 'Service', from: date, to: mtDate(f.back), job: j.id, note: f.type, back: false }, { text: DB.actor() + ' blocked ' + c.plate + ' for the workshop' + (f.force && clashes().length ? ' anyway, with ' + plural(clashes().length, 'rental') + ' clashing' : ''), where: 'Maintenance record' });
    mtSyncWorkshop(c.id);
    UI.toast(status === 'Done' ? (mode === 'finish' ? 'Marked as done' : 'Service saved') : status === 'Planned' ? 'Job planned for ' + UI.fmt.date(date) : c.plate + ' is in the workshop', { action: job ? null : { label: 'Open', run: function () { mtJobDrawer(j.id); } } });
  }
  paint();
  return dr;
}

/* ---------------- job drawer ---------------- */
function mtJobDrawer(id, onClose) {
  var d = D(), j = byId(d.jobs, id);
  if (!j) { UI.toast('That job is no longer in the log', { tone: 'warn' }); return; }
  var dr = UI.drawer({ title: j.title, width: 620, live: true, onClose: onClose, body: function (el, dw) {
    j = byId(D().jobs, id);
    if (!j) { setTimeout(function () { dw.close(true); }, 0); return ''; }
    var c = carById(j.car), w = D().downtime.filter(function (x) { return x.job === j.id; })[0], bk = j.booking && findBooking(j.booking);
    dw.setTitle(j.title, c.plate + ' · ' + carName(c));
    var ed = can('maintenance.edit'), canDel = can('maintenance.delete');
    var acts = [];
    if (ed && j.status === 'Planned') acts.push(UI.btn('Car goes in the workshop', { kind: 'o', size: 'sm', icon: 'tool', attrs: { 'data-jd': 'in' } }));
    if (ed && (j.status === 'Planned' || j.status === 'In the workshop')) acts.push(UI.btn('Mark as done', { size: 'sm', icon: 'circle-check', attrs: { 'data-jd': 'done' } }));
    if (ed) acts.push(UI.btn('Edit', { kind: 'o', size: 'sm', icon: 'edit', attrs: { 'data-jd': 'edit' } }));
    if (ed && j.status !== 'Done' && j.status !== 'Cancelled') acts.push(UI.btn('Cancel job', { kind: 'g', size: 'sm', icon: 'ban', attrs: { 'data-jd': 'cancel' } }));
    if (canDel) acts.push(UI.btn('Delete', { kind: 't', size: 'sm', icon: 'trash', attrs: { 'data-jd': 'delete' } }));
    var tl = [];
    if (j.plannedFor) tl.push(['calendar-event', 'Planned for ' + UI.fmt.date(j.plannedFor)]);
    if (j.inAt) tl.push(['tool', 'Car went into the workshop on ' + UI.fmt.date(j.inAt)]);
    if (w) tl.push(['lock', w.back ? 'Blocked for rentals until ' + UI.fmt.date(w.to) + ', back now' : 'Blocked for rentals until ' + (w.to ? UI.fmt.date(w.to) : 'it is back')]);
    if (j.status === 'Done') tl.push(['circle-check', (j.plannedFor || j.inAt ? 'Marked as done on ' : 'Service date ') + UI.fmt.date(j.doneAt || j.date)]);
    if (j.status === 'Cancelled') tl.push(['ban', 'Cancelled' + (j.cancelledAt ? ' on ' + UI.fmt.date(j.cancelledAt) : '')]);
    tl.push(['user', 'Entered by ' + (j.by || 'the team') + ' at ' + UI.fmt.dateTime(j.at || j.date)]);
    var parts = j.lines;
    return '<div class="row wrap gap8">' + UI.status('job', j.status) + '<span class="b2">' + UI.fmt.date(j.date) + '</span></div>' + (acts.length ? '<div class="row wrap gap8 mt12">' + acts.join('') + '</div>' : '') +
      '<div class="mt-cap mt16">What happened</div><ul class="mt-tl">' + tl.map(function (x) { return '<li>' + i(x[0]) + '<span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="sect mt16"><div class="sect-b">' + UI.kv('Car', '<button type="button" class="mt-link" data-jd="car">' + esc(c.plate) + ' · ' + esc(carName(c)) + '</button>') + UI.kv('Workshop', esc(mtVendorName(j.vendor)) || 'Not specified') + UI.kv('Odometer', j.odo ? mtKm(j.odo) : '') + UI.kv('Workshop invoice number', esc(j.invoiceNo || '')) + UI.kv('Warranty until', j.warranty ? UI.fmt.date(j.warranty) : '') +
      UI.kv('Payment', j.paid ? 'Paid on ' + UI.fmt.date(j.paidOn || j.date) : 'Not paid yet') + UI.kv('Linked booking', bk ? '<button type="button" class="mt-link" data-jd="booking">' + esc(bk.code) + ' · ' + esc(bk.cust.name) + '</button>' + (j.charge ? ' ' + UI.chip('Charge customer ' + UI.fmt.money(j.charge), 'warn') : '') : '', { full: true }) + '</div></div>' +
      (j.note ? '<div class="mt-cap mt16">Note</div><p class="t1c" style="margin:0">' + esc(j.note) + '</p>' : '') +
      (mtCostsOk() ? '<div class="mt-cap mt16">Cost</div>' + (parts.length ? '<div class="tbl-wrap"><table class="tbl mt-cost"><thead><tr><th>Line</th><th>Type</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>' + parts.map(function (l) { return '<tr><td>' + esc(l.what) + (l.partNo ? '<div class="b2">' + esc(l.partNo) + '</div>' : '') + '</td><td>' + esc(l.type) + '</td><td class="r">' + l.qty + '</td><td class="r">' + UI.money(l.price) + '</td><td class="r">' + UI.money(l.qty * l.price) + '</td></tr>'; }).join('') + '</tbody><tfoot><tr><td colspan="4" class="r">Tax</td><td class="r">' + UI.money(j.tax || 0) + '</td></tr><tr><td colspan="4" class="r"><b>Total</b></td><td class="r"><b>' + UI.money(j.total || 0) + '</b></td></tr></tfoot></table></div>' : '<p class="t1c" style="margin:0">' + UI.money(j.total || 0) + ' <span class="b2">(no lines)</span></p>') : '') +
      '<div class="mt-cap mt16">Invoices and photos</div>' + ((j.files || []).length ? '<div class="mt-files">' + j.files.map(function (x, k) { return '<div class="mt-file">' + (x.dataUrl && /^data:image/.test(x.dataUrl) ? '<img src="' + x.dataUrl + '" alt="">' : i(/pdf/i.test(x.name) ? 'file-type-pdf' : 'photo')) + '<button type="button" class="grow ellip mt-link" data-jd="view" data-k="' + k + '">' + esc(x.name) + '<small>' + esc((x.kind || 'Invoice') + (x.caption ? ' · ' + x.caption : '')) + ' · ' + UI.fmt.size(x.size) + '</small></button>' + UI.chip(x.kind || 'Invoice', /Photo/.test(x.kind || '') ? 'info' : 'grey', { sm: true }) + (can('maintenance.manage_files') ? UI.iconBtn('trash', 'Delete ' + x.name, { size: 'sm', attrs: { 'data-jd': 'rmfile', 'data-k': k } }) : '') + '</div>'; }).join('') + '</div>' : '<p class="b2">No files yet.</p>') +
      (can('maintenance.manage_files') ? '<div class="mt-dz2 mt8"></div>' : '');
  }, foot: [{ label: 'Close', kind: 'g' }] });
  var pend = [];
  var mountDz = function () { var z = dr.body.querySelector('.mt-dz2'); if (!z || z.firstChild) return; UI.dropzone(z, { accept: 'image/*,.pdf', multiple: true, camera: true, label: 'Upload invoices or photos', onFiles: function (fs) { Promise.all(fs.map(function (x) { return mtReadFile(x).catch(function (e) { UI.toast(e.message, { tone: 'warn' }); return null; }); })).then(function (rs) { pend = rs.filter(Boolean).map(function (x) { x.kind = /^image/.test(x.type || '') ? 'Photo after' : 'Invoice'; return x; }); if (!pend.length) return; var jj = byId(D().jobs, id); DB.update('jobs', jj, { files: jj.files.concat(pend) }, { text: DB.actor() + ' uploaded ' + plural(pend.length, 'file') + ' to ' + jj.title + ' of ' + carById(jj.car).plate, where: 'Maintenance record' }); UI.toast('Uploaded ' + plural(pend.length, 'file')); }); } }); };
  mountDz();
  new MutationObserver(mountDz).observe(dr.body, { childList: true });
  dr.body.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-jd]'); if (!b) return;
    var a = b.getAttribute('data-jd'), jj = byId(D().jobs, id); if (!jj) return;
    if (a === 'edit') mtJobForm({ job: id });
    else if (a === 'done') mtJobForm({ job: id, mode: 'finish' });
    else if (a === 'in') mtJobInDialog(jj);
    else if (a === 'car') mtCarHealth(jj.car);
    else if (a === 'booking') API.openBooking(jj.booking);
    else if (a === 'view') mtViewFile(jj.title, jj.files[+b.getAttribute('data-k')]);
    else if (a === 'rmfile') { var fl = jj.files[+b.getAttribute('data-k')]; UI.confirm({ title: 'Delete ' + fl.name + '?', text: 'The file is removed for good.', ok: 'Delete', danger: true }).then(function (y) { if (y) DB.update('jobs', jj, { files: jj.files.filter(function (x) { return x !== fl; }) }, { text: DB.actor() + ' deleted ' + fl.name + ' from ' + jj.title, where: 'Maintenance record' }); }); }
    else if (a === 'cancel') UI.confirm({ title: 'Cancel this job?', text: 'The job stays in the log as cancelled and the car is released from the workshop.', ok: 'Cancel job', cancel: 'Keep it', danger: true }).then(function (y) { if (!y) return; DB.update('jobs', jj, { status: 'Cancelled', cancelledAt: NOW() }, { text: DB.actor() + ' cancelled ' + jj.title + ' of ' + carById(jj.car).plate, where: 'Maintenance record' }); D().downtime.forEach(function (w) { if (w.job === jj.id && !w.back) DB.update('downtime', w, { back: true, to: NOW() }, { silent: true }); }); mtSyncWorkshop(jj.car); UI.toast('Job cancelled'); });
    else if (a === 'delete') UI.confirm({ title: 'Delete this job?', text: 'The job, its lines and its files are removed for good.', ok: 'Delete', danger: true }).then(function (y) { if (!y) return; D().downtime.filter(function (w) { return w.job === jj.id; }).forEach(function (w) { DB.remove('downtime', w, { silent: true }); }); DB.remove('jobs', jj, { text: DB.actor() + ' deleted ' + jj.title + ' of ' + carById(jj.car).plate, where: 'Maintenance record' }); mtSyncWorkshop(jj.car); dr.close(true); UI.toast('Job deleted'); });
  });
  return dr;
}
function mtJobInDialog(j) {
  var f = { block: true, back: '', force: false };
  var clashes = function () { return f.block ? mtClashes(j.car, NOW(), f.back ? new Date(mtDate(f.back).getTime() + DAY) : null).filter(function (x) { return x.code !== j.booking; }) : []; };
  var dl = UI.dialog({ title: 'Car goes in the workshop', text: carById(j.car).plate + ' · ' + j.title, width: 'sm', body: UI.switch({ key: 'block', label: 'Block this car for rentals while it is there', checked: true }) + UI.dateField({ key: 'back', label: 'Expected back', value: '' }) + '<div class="mt-clashbox"></div>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Put in workshop', icon: 'tool', onClick: function () {
      var c = carById(j.car);
      if (clashes().length && !f.force) { UI.toast('Some rentals clash. Move them first' + (can('maintenance.manage_downtime') ? ', or press "Put the car in the workshop anyway".' : '.'), { tone: 'warn', ms: 6000 }); return false; }
      DB.update('jobs', j, { status: 'In the workshop', inAt: NOW(), backAt: mtDate(f.back), block: f.block }, { text: DB.actor() + ' put ' + c.plate + ' in the workshop for ' + j.title, where: 'Maintenance record' });
      if (f.block) DB.add('downtime', { car: c.id, reason: j.type === 'Accident repair' ? 'Accident' : 'Service', from: NOW(), to: mtDate(f.back), job: j.id, note: j.title, back: false }, { silent: true });
      mtSyncWorkshop(c.id); UI.toast(c.plate + ' is in the workshop');
    } }] });
  var paintC = function () { dl.body.querySelector('.mt-clashbox').innerHTML = f.block ? mtClashHtml(clashes(), { forced: f.force }) : ''; };
  mtBind(dl.body, f, function () { f.force = false; paintC(); }); paintC();
  dl.body.addEventListener('click', function (ev) { if (ev.target.closest('[data-force]')) { f.force = !f.force; paintC(); } });
}

/* ---------------- car health card ---------------- */
function mtCarHealth(carId, onClose) {
  var c0 = carById(carId); if (!c0) { UI.toast('Car not found', { tone: 'warn' }); return; }
  var dr = UI.drawer({ title: c0.plate, width: 720, live: true, onClose: onClose, body: function (el, dw) {
    var d = D(), c = carById(carId); if (!c) return '';
    dw.setTitle(c.plate, carName(c) + ' · ' + c.year);
    var w = mtDowntimeOn(c.id, NOW(), NOW()), wSoon = d.downtime.filter(function (x) { return x.car === c.id && !x.back && x.from > NOW(); })[0];
    var rems = d.reminders.filter(function (r) { return r.car === c.id; }).map(function (r) { return { r: r, x: mtRemInfo(r, c) }; });
    var next = rems.filter(function (z) { return z.r.on && z.x.state !== 'none'; }).sort(function (a, b) { return a.x.sort - b.x.sort; })[0];
    var y1 = new Date(NOW().getTime() - 365 * DAY);
    var done = d.jobs.filter(function (j) { return j.car === c.id && j.status === 'Done'; }), done12 = done.filter(function (j) { return (j.doneAt || j.date) >= y1; });
    var spentAll = sum(done.map(function (j) { return j.total || 0; })), spent12 = sum(done12.map(function (j) { return j.total || 0; })), km12 = mtKmDriven(c.id, y1, null);
    var shopDays = Math.round(sum(d.downtime.filter(function (x) { return x.car === c.id && x.from >= y1 && x.from <= NOW(); }).map(function (x) { return Math.max(0, Math.min(NOW(), (x.back ? x.to : NOW()) || x.from) - x.from); })) / DAY);
    var bk = d.bookings.filter(function (x) { return x.car === c && x.status !== 'Cancelled' && x.start >= y1 && x.start <= NOW(); });
    var inc = { rent: sum(bk.map(function (x) { return x.rent; })), del: sum(bk.map(function (x) { return x.deliv; })), ret: sum(bk.map(function (x) { return x.ret; })), dmg: sum(bk.map(function (x) { return x.dmg; })) };
    var incT = inc.rent + inc.del + inc.ret + inc.dmg, net = incT - spent12, costs = mtCostsOk();
    var st = function (l, v, s, tone) { return '<div class="mt-hs' + (tone ? ' ' + tone : '') + '"><span>' + l + '</span><b>' + v + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</div>'; };
    var acts = (can('maintenance.create') ? UI.btn('Log a service', { size: 'sm', icon: 'plus', attrs: { 'data-ch': 'log' } }) : '') + (can('maintenance.edit') ? UI.btn('Update odometer', { kind: 'tonal', size: 'sm', icon: 'gauge', attrs: { 'data-ch': 'odo' } }) : '') + (can('maintenance.manage_documents') ? UI.btn('Add or renew a paper', { kind: 'g', size: 'sm', icon: 'file-plus', attrs: { 'data-ch': 'paper' } }) : '') + (can('maintenance.manage_downtime') ? UI.btn('Workshop time', { kind: 'g', size: 'sm', icon: 'building-warehouse', attrs: { 'data-ch': 'block' } }) : '') + (can('maintenance.manage_schedules') ? UI.btn('Service reminders', { kind: 'g', size: 'sm', icon: 'repeat', attrs: { 'data-ch': 'rems' } }) : '');
    return (c.fleet !== 'Active' ? UI.alert('This car is marked ' + c.fleet + '. It is left out of reminders and the idle list.', 'warn') : '') +
      (w ? UI.alert('<b>In the workshop: ' + esc(w.reason) + '</b> from ' + UI.fmt.date(w.from) + (w.to ? ' to ' + UI.fmt.date(w.to) : '') + '. Rentals cannot be booked for these dates.', 'bad', { html: true }) : wSoon ? UI.alert('Goes into the workshop on ' + UI.fmt.date(wSoon.from) + ' (' + esc(wSoon.reason) + ').', 'warn') : '') +
      '<div class="row wrap gap8">' + acts + '</div>' +
      '<div class="mt-hstats mt16">' + st('Odometer', mtKm(c.odo), 'As of ' + UI.fmt.date(c.odoAt)) + st('Next service', next ? esc(next.r.service) : 'Nothing set', next ? esc(next.x.text) : 'Add a service reminder', next ? (next.x.state === 'over' ? 'bad' : next.x.state === 'soon' ? 'warn' : '') : '') +
      st('Jobs done', done.length, shopDays + ' days in workshop (12 months)') + (costs ? st('Spent on this car', UI.fmt.money(spentAll), 'All finished jobs') + st('Cost per km', km12 ? UI.fmt.money(spent12 / km12) : '-', UI.fmt.num(km12) + ' km in 12 months') + st('Earned minus spent', UI.fmt.money(net), UI.fmt.money(incT) + ' income, ' + UI.fmt.money(spent12) + ' costs (12 months)', net >= 0 ? 'ok' : 'bad') +
        st('Income, 12 months', UI.fmt.money(incT), 'Rent ' + UI.fmt.money(inc.rent) + ' · Delivery ' + UI.fmt.money(inc.del) + ' · Return ' + UI.fmt.money(inc.ret) + ' · Damage coverage ' + UI.fmt.money(inc.dmg)) : '') + '</div>' +
      '<div class="mt-cap mt24">Service reminders</div>' + (rems.length ? rems.map(function (z) {
        var tone = z.x.state === 'over' ? 'bad' : z.x.state === 'soon' ? 'warn' : z.x.state === 'ok' ? 'ok' : 'grey';
        return '<div class="mt-hrow"><div class="grow"><div class="t1c">' + esc(z.r.service) + (z.r.on ? '' : ' ' + UI.chip('Off', 'grey')) + '</div><div class="b2">' + esc(z.x.text) + (z.x.sub ? ' · ' + esc(z.x.sub) : '') + '</div></div>' + UI.chip({ over: 'Overdue', soon: 'Due soon', ok: 'OK', none: 'Not counting' }[z.x.state], tone) +
          (can('maintenance.create') ? UI.btn('Done now', { kind: 't', size: 'sm', attrs: { 'data-ch': 'donenow', 'data-id': z.r.id } }) : '') + (can('maintenance.manage_schedules') && z.x.state !== 'ok' && z.x.state !== 'none' ? UI.btn('Snooze 7 days', { kind: 'g', size: 'sm', attrs: { 'data-ch': 'snooze', 'data-id': z.r.id } }) : '') + '</div>';
      }).join('') : '<p class="b2">No reminders. Press Service reminders to add one.</p>') +
      '<div class="mt-cap mt24">Road tax and papers</div>' + LISTS.paperTypes.filter(function (k) { return k !== 'Other' || mtLatestPaper(c.id, k, d); }).map(function (k) {
        var p = mtLatestPaper(c.id, k, d), x = mtPaperInfo(p);
        return '<div class="mt-hrow">' + i(MT_PAPER_ICON[k], 'mt-hic') + '<div class="grow"><div class="t1c">' + esc(MT_PAPER_LONG[k] || (p && k === 'Other' ? p.name : k)) + '</div><div class="b2">' + (p ? (p.until ? 'Valid until ' + UI.fmt.date(p.until) : 'Recorded') : 'Not recorded') + '</div></div>' +
          UI.chip(p ? (x.days != null && x.days >= 0 ? 'Expires in ' + plural(x.days, 'day') : x.text) : 'Missing', p ? x.tone : 'grey') + (p && p.file ? UI.btn('View', { kind: 't', size: 'sm', attrs: { 'data-ch': 'view', 'data-id': p.id } }) : '') +
          (can('maintenance.manage_documents') ? UI.btn(p ? 'Renew' : 'Add', { kind: 'tonal', size: 'sm', attrs: { 'data-ch': p ? 'renew' : 'add', 'data-id': p ? p.id : k } }) : '') + '</div>';
      }).join('') +
      '<div class="mt-cap mt24">Latest jobs</div>' + (d.jobs.filter(function (j) { return j.car === c.id; }).slice(0, 6).map(function (j) { return '<button type="button" class="mt-hrow mt-hbtn" data-ch="job" data-id="' + j.id + '"><div class="grow"><div class="t1c">' + esc(j.title) + '</div><div class="b2">' + [UI.fmt.date(j.date), mtVendorName(j.vendor), j.odo ? mtKm(j.odo) : ''].filter(Boolean).map(esc).join(' · ') + '</div></div>' + (costs ? UI.money(j.total || 0) : '') + UI.status('job', j.status) + '</button>'; }).join('') || '<p class="b2">No jobs yet.</p>') +
      mtOdoHistory(c, d) +
      '<div class="mt-cap mt24">Car details</div><div class="mt-hstats">' + st('VIN / chassis', esc(c.vin || c.chassis || '-')) + st('Engine number', esc(c.engine || '-')) + st('Bought on', c.boughtOn ? UI.fmt.date(c.boughtOn) : '-') + (costs ? st('Bought for', c.boughtFor ? UI.fmt.money(c.boughtFor) : '-') : '') + '</div>';
  }, foot: [{ label: 'Open the car', kind: 'o', icon: 'car', close: false, onClick: function () { API.openCar(carId); return false; } }, { label: 'Close', kind: 'g' }] });
  dr.body.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ch]'); if (!b) return;
    var a = b.getAttribute('data-ch'), idv = b.getAttribute('data-id'), d = D();
    if (a === 'log') mtJobForm({ car: carId, when: 'done' });
    else if (a === 'odo') mtOdometerDialog(carId);
    else if (a === 'paper') mtPaperForm({ car: carId });
    else if (a === 'block') mtBlockDialog({ car: carId });
    else if (a === 'rems') mtRemindersDialog(carId);
    else if (a === 'job') mtJobDrawer(idv);
    else if (a === 'renew') mtPaperForm({ renew: idv });
    else if (a === 'add') mtPaperForm({ car: carId, kind: idv });
    else if (a === 'view') { var p = byId(d.papers, idv), c = carById(carId); mtViewFile(p.kind + ' · ' + c.plate, p.file, [['Car', c.plate + ' ' + carName(c)], ['Paper', p.kind], ['Issued by', p.provider || '-'], ['Reference', p.ref || '-'], ['Valid until', p.until ? UI.fmt.date(p.until) : '-']]); }
    else if (a === 'snooze') { var r = byId(d.reminders, idv); DB.update('reminders', r, { snoozedUntil: new Date(NOW().getTime() + 7 * DAY) }, { text: DB.actor() + ' snoozed ' + r.service + ' of ' + carById(carId).plate, where: 'Maintenance record' }); UI.toast('Hidden for 7 days'); }
    else if (a === 'donenow') { var rr = byId(d.reminders, idv), cc = carById(carId), prev = { lastAt: rr.lastAt, lastKm: rr.lastKm }; DB.update('reminders', rr, { lastAt: mtToday(), lastKm: cc.odo, snoozedUntil: null }, { text: DB.actor() + ' marked ' + rr.service + ' of ' + cc.plate + ' as done today', where: 'Maintenance record' }); UI.toast(rr.service + ' counted from today', { action: { label: 'Undo', run: function () { DB.update('reminders', rr, prev, { silent: true }); } } }); }
  });
  return dr;
}
/* the latest odometer readings with where each came from; a doubtful one is marked Not trusted */
function mtOdoHistory(c, d) {
  var list = (d || D()).odometer.filter(function (o) { return o.car === c.id; }).sort(function (a, b) { return b.at - a.at; });
  if (!list.length) return '<div class="mt-cap mt24">Odometer readings</div><p class="b2">No readings yet.</p>';
  var bad = list.filter(function (o) { return o.doubt; }).length;
  return '<div class="mt-cap mt24">Odometer readings</div>' + (bad ? '<p class="b2">' + i('alert-triangle') + ' ' + plural(bad, 'reading') + ' not trusted: shown, but left out of the car\'s odometer and the cost per km.</p>' : '') +
    '<div class="mt-odol">' + list.slice(0, 8).map(function (o) {
      return '<div class="mt-odo' + (o.doubt ? ' bad' : '') + '"><div class="mt-odo-t"><b class="num">' + mtKm(o.km) + '</b><span class="grow"></span>' + UI.chip(MT_ODO_SRC[o.source] || 'Typed in', o.source === 'service' ? 'pri' : o.source === 'manual' ? 'grey' : 'info', { sm: true }) + (o.doubt ? UI.chip('Not trusted', 'bad', { sm: true, icon: 'alert-triangle' }) : '') + '</div><div class="b2">' + UI.fmt.date(o.at) + (o.by ? ' · ' + esc(o.by) : '') + '</div>' + (o.doubt ? '<div class="b2 mt-odo-why">' + esc(o.doubt) + '</div>' : '') + '</div>';
    }).join('') + '</div>' + (list.length > 8 ? '<p class="b2">Showing the latest 8 of ' + list.length + ' readings.</p>' : '');
}
function mtOdometerDialog(carId) {
  var c = carById(carId), f = { km: null, at: mtIso(mtToday()) };
  UI.dialog({ title: 'Update odometer', text: c.plate + ' · ' + carName(c), width: 'sm', body: UI.input({ key: 'km', label: 'Km on the odometer now', type: 'number', min: 0, required: true, placeholder: String(c.odo + 120) }) + UI.dateField({ key: 'at', label: 'Read on', value: f.at, max: f.at }) + '<p class="b2">Last reading: ' + mtKm(c.odo) + ' on ' + UI.fmt.date(c.odoAt) + '</p>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Save', icon: 'check', onClick: function (dl) {
      var v = UI.form(dl.body); if (!v.km || v.km <= 0) { UI.toast('Type the km on the odometer', { tone: 'warn' }); return false; }
      if (v.km < c.odo) { UI.toast('That is less than the last reading (' + mtKm(c.odo) + '). Check the number.', { tone: 'warn' }); return false; }
      var at = mtDate(v.at) || mtToday();
      DB.update('cars', c, { odo: v.km, odoAt: at }, { text: DB.actor() + ' updated the odometer of ' + c.plate + ' to ' + mtKm(v.km), where: 'Car' });
      D().odometer.push({ car: c.id, km: v.km, at: at, by: DB.actor(), source: 'manual' }); UI.toast('Odometer saved: ' + mtKm(v.km));
    } }] });
}
function mtRemindersDialog(carId) {
  var c = carById(carId), editing = null;
  var dl = UI.dialog({ title: 'Service reminders · ' + c.plate, width: 'md', live: true, body: function () {
    var rs = D().reminders.filter(function (r) { return r.car === carId; });
    return '<p class="ui-ctext">Tell the system how often each service is needed. You get a warning on the Due now tab, and by WhatsApp if the morning reminder is on.</p>' +
      (rs.length ? rs.map(function (r) {
        var x = mtRemInfo(r, c);
        if (editing === r.id) return '<div class="mt-rem on">' + '<b>' + esc(r.service) + '</b><div class="mt-form">' + UI.input({ key: 'ekm', label: 'Every how many km', type: 'number', min: 0, value: r.km || '' }) + UI.input({ key: 'edays', label: 'Or every how many days', type: 'number', min: 0, value: r.days || '' }) + '</div><div class="row gap8">' + UI.btn('Save', { size: 'sm', attrs: { 'data-rm': 'save', 'data-id': r.id } }) + UI.btn('Cancel', { kind: 'g', size: 'sm', attrs: { 'data-rm': 'cancel' } }) + '</div></div>';
        return '<div class="mt-rem"><div class="grow"><div class="t1c fw5">' + esc(r.service) + '</div><div class="b2">Every ' + [r.km ? UI.fmt.num(r.km) + ' km' : '', r.days ? r.days + ' days' : ''].filter(Boolean).join(' or ') + '</div><div class="b2">' + (x.state === 'none' ? esc(x.text) : 'Next: ' + esc(x.text)) + '</div></div>' +
          '<label class="sw" title="On or off"><input type="checkbox" data-rm="toggle" data-id="' + r.id + '"' + (r.on ? ' checked' : '') + ' aria-label="Reminder on"><span></span></label>' + UI.iconBtn('edit', 'Edit', { size: 'sm', attrs: { 'data-rm': 'edit', 'data-id': r.id } }) + UI.iconBtn('trash', 'Delete', { size: 'sm', attrs: { 'data-rm': 'delete', 'data-id': r.id } }) + '</div>';
      }).join('') : '<p class="b2">No reminders for this car yet.</p>') +
      '<div class="mt-cap mt16">Add a reminder</div><div class="mt-form mt-addrem">' + UI.select({ key: 'nsvc', label: 'Service', options: LISTS.serviceTypes, placeholder: 'Choose' }) + UI.input({ key: 'nkm', label: 'Every km', type: 'number', min: 0 }) + UI.input({ key: 'ndays', label: 'Or every days', type: 'number', min: 0 }) + '<div class="inp" style="justify-content:flex-end">' + UI.btn('Add', { icon: 'plus', attrs: { 'data-rm': 'add' } }) + '</div></div>';
  }, buttons: [{ label: 'Close' }] });
  dl.body.addEventListener('change', function (ev) { var t = ev.target; if (t.getAttribute('data-rm') === 'toggle') { var r = byId(D().reminders, t.getAttribute('data-id')); DB.update('reminders', r, { on: t.checked }, { text: DB.actor() + ' switched ' + (t.checked ? 'on' : 'off') + ' the ' + r.service + ' reminder of ' + c.plate, where: 'Maintenance record' }); } });
  dl.body.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-rm]'); if (!b || b.type === 'checkbox') return;
    var a = b.getAttribute('data-rm'), r = byId(D().reminders, b.getAttribute('data-id'));
    if (a === 'edit') { editing = r.id; dl.refresh(); }
    else if (a === 'cancel') { editing = null; dl.refresh(); }
    else if (a === 'save') { var v = UI.form(dl.body.querySelector('.mt-rem.on')); if (!v.ekm && !v.edays) { UI.toast('Type the km or the days', { tone: 'warn' }); return; } editing = null; DB.update('reminders', r, { km: v.ekm || 0, days: v.edays || 0 }, { text: DB.actor() + ' changed the ' + r.service + ' reminder of ' + c.plate, where: 'Maintenance record' }); UI.toast('Reminder saved'); }
    else if (a === 'delete') UI.confirm({ title: 'Delete the ' + r.service + ' reminder?', ok: 'Delete', danger: true }).then(function (y) { if (y) DB.remove('reminders', r, { text: DB.actor() + ' deleted the ' + r.service + ' reminder of ' + c.plate, where: 'Maintenance record' }); });
    else if (a === 'add') {
      var v2 = UI.form(dl.body.querySelector('.mt-addrem'));
      if (!v2.nsvc) { UI.toast('Choose the service', { tone: 'warn' }); return; }
      if (!v2.nkm && !v2.ndays) { UI.toast('Type every how many km or days', { tone: 'warn' }); return; }
      var last = D().jobs.filter(function (j) { return j.car === carId && j.type === v2.nsvc && j.status === 'Done'; })[0];
      DB.add('reminders', { car: carId, service: v2.nsvc, km: v2.nkm || 0, days: v2.ndays || 0, lastAt: last ? last.date : null, lastKm: last ? last.odo : null, on: true, snoozedUntil: null }, { text: DB.actor() + ' added a reminder for ' + v2.nsvc + ' of ' + c.plate, where: 'Maintenance record' });
      UI.toast('Reminder added');
    }
  });
}

/* ---------------- Add a paper / Renew / Edit paper ---------------- */
function mtPaperForm(o) {
  o = o || {};
  var d = D(), old = o.renew ? byId(d.papers, o.renew) : o.edit ? byId(d.papers, o.edit) : null, edit = !!o.edit;
  if (!can('maintenance.manage_documents')) { UI.toast('You cannot change papers. Ask the owner for access.', { tone: 'warn' }); return; }
  var kind = old ? old.kind : o.kind || 'Road tax';
  var nextUntil = old && old.until && !edit ? new Date(Math.max(old.until.getTime(), mtToday().getTime()) + 365 * DAY) : null;
  var f = { car: old ? old.car : o.car || '', kind: kind, name: old && old.kind === 'Other' ? old.name : '', until: edit ? mtIso(old.until) : mtIso(nextUntil), issued: edit ? mtIso(old.issued) : mtIso(mtToday()), provider: old ? old.provider : '', cost: old ? old.cost || null : null, ref: edit ? old.ref : '', warnDays: old ? old.warnDays || 30 : 30, note: edit ? old.note : '', file: edit ? old.file : null };
  var start = JSON.stringify(f);
  var title = edit ? 'Edit paper' : old ? 'Renew ' + kind.toLowerCase().replace('puspakom', 'PUSPAKOM') : 'Add a paper';
  function html() {
    return '<div class="mt-form"><div class="full mt-pcar"></div>' +
      UI.choice({ key: 'kind', label: 'Type', value: f.kind, options: LISTS.paperTypes, full: true }) + (f.kind === 'Other' ? UI.input({ key: 'name', label: 'What is it?', required: true, value: f.name, full: true, placeholder: 'For example Permit to enter a port' }) : '') +
      UI.dateField({ key: 'until', label: 'Valid until', chips: false, required: f.kind !== 'Car grant', value: f.until, help: f.kind === 'Car grant' ? 'A grant does not expire. Leave empty.' : '' }) + UI.dateField({ key: 'issued', label: 'Issued on (optional)', chips: false, value: f.issued }) +
      UI.input({ key: 'provider', label: f.kind === 'Insurance' ? 'Insurer (optional)' : 'Issued by (optional)', value: f.provider }) + (mtCostsOk() ? UI.input({ key: 'cost', label: 'What it cost', type: 'number', prefix: 'RM', min: 0, step: '0.01', value: f.cost }) : '') +
      UI.input({ key: 'ref', label: f.kind === 'Insurance' ? 'Policy number' : 'Reference number', value: f.ref }) + UI.input({ key: 'warnDays', label: 'Warn me this many days before', type: 'number', min: 0, value: f.warnDays }) +
      UI.textarea({ key: 'note', label: 'Note', rows: 2, value: f.note }) + '<div class="inp full"><label>File (photo or PDF)</label>' + (f.file ? '<div class="mt-file">' + i('file') + '<span class="grow ellip">' + esc(f.file.name) + '<small>' + UI.fmt.size(f.file.size) + '</small></span>' + UI.iconBtn('x', 'Remove file', { size: 'sm', attrs: { 'data-pf': 'rmfile' } }) + '</div>' : '<div class="mt-pdz"></div>') + '</div></div>';
  }
  var dr = UI.drawer({ title: title, subtitle: f.car ? mtCarLine(carById(f.car)) : 'Road tax, insurance, PUSPAKOM, permits, grant', subHtml: true, width: 560, body: '<div class="mt-pf"></div>', dirty: function () { return JSON.stringify(f) !== start; },
    foot: (edit ? [{ label: 'Delete', kind: 'err', icon: 'trash', close: false, onClick: function (dw) { UI.confirm({ title: 'Delete this paper?', text: 'The record and its file are removed.', ok: 'Delete', danger: true }).then(function (y) { if (y) { DB.remove('papers', old, { text: DB.actor() + ' deleted ' + old.kind + ' of ' + carById(old.car).plate, where: 'Maintenance record' }); dw.close(true); UI.toast('Paper deleted'); } }); return false; } }, { spacer: true }] : []).concat([{ label: 'Cancel', kind: 'g' }, { label: edit ? 'Save changes' : old ? 'Renew' : 'Add paper', icon: 'check', onClick: save }]) });
  var box = dr.body.querySelector('.mt-pf');
  function paint() {
    box.innerHTML = html();
    /* the same searchable car picker as the other fleet forms: type '3326' or 'VMA3326'; sold cars only when already chosen */
    mtCarPick(box.querySelector('.mt-pcar'), { value: f.car, badges: false, onChange: function (id) { f.car = id || ''; } });
    var z = box.querySelector('.mt-pdz'); if (z) UI.dropzone(z, { accept: 'image/*,.pdf', camera: true, label: 'Add the photo or PDF', onFiles: function (fs) { mtReadFile(fs[0]).then(function (r) { f.file = r; paint(); }, function (e) { UI.toast(e.message, { tone: 'warn' }); }); } });
  }
  mtBind(box, f, function (k, ev) { if (ev.type === 'change' && k === 'kind') paint(); });
  box.addEventListener('click', function (ev) { if (ev.target.closest('[data-pf="rmfile"]')) { f.file = null; paint(); } });
  function save() {
    if (!f.car) { UI.toast('Choose the car', { tone: 'warn' }); return false; }
    if (f.kind === 'Other' && !f.name.trim()) { UI.toast('Type what the paper is', { tone: 'warn' }); return false; }
    if (f.kind !== 'Car grant' && !f.until) { UI.toast('Pick the date it is valid until', { tone: 'warn' }); return false; }
    var c = carById(f.car), rec = { car: f.car, kind: f.kind, name: f.kind === 'Other' ? f.name : f.kind, until: mtDate(f.until), issued: mtDate(f.issued), provider: f.provider, cost: Number(f.cost) || 0, ref: f.ref, warnDays: Number(f.warnDays) || 30, note: f.note, file: f.file };
    if (edit) DB.update('papers', old, rec, { text: DB.actor() + ' changed ' + f.kind + ' of ' + c.plate, where: 'Maintenance record' });
    else DB.add('papers', rec, { text: DB.actor() + (old ? ' renewed ' : ' added ') + f.kind + ' of ' + c.plate + (rec.until ? ' until ' + UI.fmt.date(rec.until) : ''), where: 'Maintenance record' });
    if (f.kind === 'Road tax' && rec.until) DB.update('cars', c, { tax: rec.until }, { silent: true });
    if (f.kind === 'Insurance' && rec.until) DB.update('cars', c, { insExp: rec.until, insurer: f.provider || c.insurer }, { silent: true });
    UI.toast(edit ? 'Paper saved' : old ? f.kind + ' renewed' : 'Paper added');
  }
  paint();
  return dr;
}

/* ---------------- Block a car for the workshop ---------------- */
function mtBlockDialog(o) {
  o = o || {};
  if (!can('maintenance.manage_downtime')) { UI.toast('You cannot block cars. Ask the owner for access.', { tone: 'warn' }); return; }
  var f = { car: o.car || '', reason: 'Service', from: mtIso(mtToday()), to: '', note: '', force: false };
  var clashes = function () { return f.car && f.from ? mtClashes(f.car, mtDate(f.from), f.to ? new Date(mtDate(f.to).getTime() + DAY) : null) : []; };
  var dl = UI.dialog({ title: 'Block a car for the workshop', width: 'md', body: '<p class="ui-ctext">While a car is blocked it cannot be booked and does not show as free in the Availability Checker or the calendar.</p><div class="mt-form"><div class="mt-carpk full"></div>' +
    UI.choice({ key: 'reason', label: 'Why?', value: 'Service', options: LISTS.downtimeReasons, full: true }) + UI.dateField({ key: 'from', label: 'Goes in', required: true, value: f.from }) + UI.dateField({ key: 'to', label: 'Expected back (optional)', value: '', min: f.from }) + UI.textarea({ key: 'note', label: 'Note', rows: 2 }) + '</div><div class="mt-clashbox mt8"></div>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Block the car', icon: 'lock', onClick: function () {
      if (!f.car) { UI.toast('Choose the car', { tone: 'warn' }); return false; }
      if (!f.from) { UI.toast('Pick when it goes in', { tone: 'warn' }); return false; }
      if (f.to && f.to < f.from) { UI.toast('Expected back must be after it goes in', { tone: 'warn' }); return false; }
      var cl = clashes();
      if (cl.length && !f.force) { UI.toast('Some rentals clash with these dates. Move them first, or press "Put the car in the workshop anyway".', { tone: 'warn', ms: 6000 }); return false; }
      var c = carById(f.car);
      DB.add('downtime', { car: f.car, reason: f.reason, from: mtDate(f.from), to: f.to ? new Date(mtDate(f.to).getTime() + 17 * 36e5) : null, job: null, note: f.note, back: false }, { text: DB.actor() + ' blocked ' + c.plate + ' for the workshop (' + f.reason + ')' + (cl.length ? ' anyway, with ' + plural(cl.length, 'rental') + ' clashing: ' + cl.map(function (x) { return x.code; }).join(', ') : ''), where: 'Maintenance record' });
      mtSyncWorkshop(f.car); UI.toast(c.plate + ' is blocked from ' + UI.fmt.date(mtDate(f.from)));
    } }] });
  var pk = mtCarPick(dl.body.querySelector('.mt-carpk'), { value: f.car });
  var dates = function () { var a = f.from ? mtDate(f.from) : null; pk.setDates(a, a ? (f.to ? new Date(mtDate(f.to).getTime() + DAY) : new Date(a.getTime() + DAY)) : null); };
  var paintC = function () { dl.body.querySelector('.mt-clashbox').innerHTML = f.car && f.from ? mtClashHtml(clashes(), { forced: f.force }) : ''; };
  mtBind(dl.body, f, function (k, ev) { if (ev.type === 'change') { if (k !== 'note' && k !== 'reason') f.force = false; if (k === 'from' || k === 'to') dates(); paintC(); } }); dates(); paintC();
  dl.body.addEventListener('click', function (ev) { if (ev.target.closest('[data-force]')) { f.force = !f.force; paintC(); } });
}

/* other pages open these */
API.carHealth = function (carId) { mtCarHealth(carId); };
API.logService = function (carId) { mtJobForm({ car: carId || '', when: 'done' }); };
API.openJob = function (id) { mtJobDrawer(id); };

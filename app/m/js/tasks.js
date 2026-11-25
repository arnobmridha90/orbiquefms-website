/* ---------------- TASKS (M5) ----------------
   #tasks         My jobs (assigned to me, today first, big Start and Done) and, for managers, All with filters and search
   #task/<id>     task editor; #task/new?booking=<id>&end=out|in makes a new one
   Tasks.newFor(bookingId, end?)   open the editor for a booking
   Tasks.autoAssign(b)             the auto-assign rule (runs from ON_SIGNED when a booking becomes Agreement Signed)
   Rules follow the reference: statuses Pending / In Progress / Completed / Cancelled, one WhatsApp status per person
   (Template sent, Reply received, Details sent, Failed), auto-assign makes a start and an end task once, before the booking ends. */

var TASK_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
var TASK_TONE = { 'Pending': 'amber', 'In Progress': 'blue', 'Completed': 'green', 'Cancelled': 'grey' };
var WA_TONE = { 'Not sent': 'grey', 'Template sent': 'blue', 'Reply received': 'green', 'Details sent': 'emerald', 'Failed': 'red' };
var tk = { mode: '', q: '', status: 'open', type: '', staff: '', car: '', limit: 60 };
var tkEd = null; /* the task being edited: {key, isNew, t, orig} */
var tkRec = null; /* voice recording in progress */
VIEW_STATE.push(function () { tk = { mode: '', q: '', status: 'open', type: '', staff: '', car: '', limit: 60 }; tkEd = null; tkStopRec(true); });

/* ---------- task types from company settings ---------- */
function taskTypes() {
  var s = B(), t = ['General'];
  (s.locations || []).forEach(function (l) { if (l.pickup) t.push('Delivery from our location, ' + (l.short || l.name)); });
  t.push('Delivery to client');
  (s.places || []).forEach(function (p) { t.push('Delivery to ' + p.name); });
  (s.locations || []).forEach(function (l) { if (l.dropoff) t.push('Return to our location, ' + (l.short || l.name)); });
  t.push('Return from client');
  (s.places || []).forEach(function (p) { t.push('Return from ' + p.name); });
  return t;
}
function taskTypeFor(b, end) {
  var k = end === 'ret' ? b.retKind : b.pickKind, id = end === 'ret' ? b.retLoc : b.pickLoc;
  if (k === 'our') { var l = loc(id); return (end === 'ret' ? 'Return to our location, ' : 'Delivery from our location, ') + (l ? l.short || l.name : ''); }
  if (k === 'client') return end === 'ret' ? 'Return from client' : 'Delivery to client';
  if (k === 'place') { var p = place(id); return (end === 'ret' ? 'Return from ' : 'Delivery to ') + (p ? p.name : ''); }
  return 'General';
}
function taskName(b, end) {
  var c = car(b.car), cu = cust(b.cust);
  return [b.code + ' ' + (end === 'ret' ? 'return' : 'pick-up'), c ? c.make + ' ' + c.model : '', cu.name || ''].filter(Boolean).join(' · ');
}
function taskIsMine(t) { return (t.staff || []).indexOf(S.me) >= 0; }
function taskCanEdit(t) { return can('tasks.edit') || (t && t.by === S.me && can('tasks.create')); }
function taskCanWork(t) { return taskCanEdit(t) || taskIsMine(t); } /* status, note, photos, voice */

/* ---------- WhatsApp to staff (simulated) ---------- */
function taskSendWa(t, ids) {
  t.wa = t.wa || {};
  ids.forEach(function (sid) {
    var p = staff(sid); if (!p) return;
    if (!p.wa && !p.phone) { t.wa[sid] = 'Failed'; return; }
    t.wa[sid] = 'Template sent';
    var tid = t.id, delay = 1800 + Math.round(Math.random() * 1500);
    later(function () { var x = byId(S.tasks, tid); if (!x || !x.wa || x.wa[sid] !== 'Template sent') return; x.wa[sid] = Math.random() < .12 ? 'Failed' : 'Reply received'; save(); tkLiveWa(x); }, delay);
    later(function () { var x = byId(S.tasks, tid); if (!x || !x.wa || x.wa[sid] !== 'Reply received') return; x.wa[sid] = 'Details sent'; save(); tkLiveWa(x); }, delay + 1600);
  });
}
function tkLiveWa(t) { var box = $('#tkWa'); if (box && tkEd && tkEd.t.id === t.id) { tkEd.t.wa = Object.assign({}, t.wa); box.outerHTML = tkWaHtml(tkEd.t); tkWireWa(); } }

/* ---------- auto-assign ---------- */
function taskRuleFor(b, locId) {
  var ok = function (r) { return (r.staff || []).filter(function (s) { var p = staff(s); return p && p.active !== false; }).length; };
  var rules = (S.autoRules || []).filter(ok);
  return rules.filter(function (r) { return r.kind === 'car' && r.car === b.car; })[0] ||
    (locId ? rules.filter(function (r) { return r.kind === 'location' && r.location === locId; })[0] : null) ||
    rules.filter(function (r) { return r.kind === 'everything'; })[0] || null;
}
function taskAutoAssign(b) {
  if (!b || (S.tasks || []).some(function (t) { return t.booking === b.id; }) || new Date(b.end) < new Date()) return [];
  var made = [], names = [];
  [['pick', b.start], ['ret', b.end]].forEach(function (x) {
    var end = x[0], kind = end === 'ret' ? b.retKind : b.pickKind, locId = kind === 'our' ? (end === 'ret' ? b.retLoc : b.pickLoc) : null, l = locId ? loc(locId) : null, ids = [], why = '';
    if (l && (l.agents || []).length) { ids = l.agents.filter(function (s) { var p = staff(s); return p && p.active !== false; }); why = 'agents of ' + l.name; }
    if (!ids.length) {
      var r = taskRuleFor(b, locId); if (!r) return;
      ids = r.staff.filter(function (s) { var p = staff(s); return p && p.active !== false; });
      why = r.kind === 'car' ? 'rule for this car' : r.kind === 'location' ? 'rule for ' + ((loc(r.location) || {}).name || 'the location') : 'rule for every booking';
    }
    if (!ids.length) return;
    var t = { id: uid(), name: taskName(b, end), type: taskTypeFor(b, end), booking: b.id, staff: ids, at: x[1], status: 'Pending', note: (end === 'ret' ? b.retNote : b.pickNote) || '', photos: [], voice: [], wa: {}, auto: true, autoWhy: why, by: 'Auto-assign', created: new Date().toISOString() };
    S.tasks = S.tasks || []; S.tasks.unshift(t); taskSendWa(t, ids); made.push(t);
    ids.forEach(function (s) { if (names.indexOf(firstName(who(s))) < 0) names.push(firstName(who(s))); });
    b.assigned = b.assigned || []; ids.forEach(function (s) { if (b.assigned.indexOf(s) < 0) b.assigned.push(s); });
    bLog(b, 'Auto-assigned ' + (end === 'ret' ? 'return' : 'pick-up') + ' task to ' + ids.map(who).join(', ') + ' (' + why + ')');
  });
  if (made.length) { save(); later(function () { say('Auto-assigned to ' + names.join(' and ')); }, 900); }
  return made;
}
ON_SIGNED.push(function (b) { taskAutoAssign(b); });

var Tasks = {
  newFor: function (bookingId, end) { location.hash = hashWith('task/new', { booking: bookingId, end: end || '' }); },
  open: function (id) { location.hash = '#task/' + id; },
  autoAssign: taskAutoAssign,
  types: taskTypes,
  typeFor: taskTypeFor
};

/* ---------- list ---------- */
function tkWhenText(t) { if (!t.at) return 'No date'; return dayWord(t.at) + ', ' + hm(t.at); }
function tkBookingLine(t) { var b = t.booking ? bk(t.booking) : null; if (!b) return ''; var c = car(b.car) || {}; return esc(b.code) + ' · ' + esc(c.plate || '') + ' · ' + esc(cust(b.cust).name); }
function tkHandoverBtn(t) {
  var b = t.booking ? bk(t.booking) : null; if (!b || t.status === 'Completed' || t.status === 'Cancelled') return '';
  if (/^Delivery/.test(t.type || '') && UPCOMING.indexOf(b.bookingStatus) >= 0) return '<button type="button" class="btn tk-big" data-ho="out" data-b="' + b.id + '">' + I('key') + 'Hand over</button>';
  if (/^Return/.test(t.type || '') && b.bookingStatus === 'Car Delivered') return '<button type="button" class="btn tk-big" data-ho="in" data-b="' + b.id + '">' + I('in') + 'Take back</button>';
  return '';
}
function tkCard(t, big) {
  var late = t.at && new Date(t.at) < new Date() && (t.status === 'Pending' || t.status === 'In Progress');
  var team = (t.staff || []).map(staff).filter(Boolean);
  var acts = '';
  if (big && taskCanWork(t) && (t.status === 'Pending' || t.status === 'In Progress')) {
    var ho = tkHandoverBtn(t);
    acts = '<div class="tk-acts">' + (t.status === 'Pending' ? '<button type="button" class="btn ghost tk-big" data-st="In Progress" data-id="' + t.id + '">' + I('clock') + 'Start</button>' : '') +
      (ho || '<button type="button" class="btn tk-big" data-st="Completed" data-id="' + t.id + '">' + I('check', 2.4) + 'Done</button>') + '</div>';
  }
  return '<div class="tk-card' + (late ? ' late' : '') + (t.status === 'Completed' || t.status === 'Cancelled' ? ' closed' : '') + '"><a class="tk-main" href="#task/' + t.id + '">' +
    '<div class="tk-l1"><b>' + esc(t.name || 'Task') + '</b>' + chip(t.status, TASK_TONE[t.status]) + '</div>' +
    '<div class="tk-l2">' + I('clock') + '<span class="' + (late ? 'tone-red-text' : '') + '">' + esc(tkWhenText(t)) + (late ? ' · late' : '') + '</span>' + (t.type && t.type !== 'General' ? '<span class="tk-type">' + esc(t.type) + '</span>' : '') + '</div>' +
    (t.booking && bk(t.booking) ? '<div class="tk-l3">' + I('car') + '<span>' + tkBookingLine(t) + '</span></div>' : '') +
    '<div class="tk-l4">' + (team.length ? '<span class="sc-team" style="margin-left:0">' + team.slice(0, 4).map(function (p) { return '<span class="av xs" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</span>'; }).join('') + '</span><span class="tk-who">' + esc(team.map(function (p) { return p.id === S.me ? 'Me' : firstName(p.name); }).join(', ')) + '</span>' : '<span class="tk-who muted">Nobody yet</span>') +
    ((t.photos || []).length ? '<span class="tk-meta">' + I('camera') + t.photos.length + '</span>' : '') + ((t.voice || []).length ? '<span class="tk-meta">' + I('mic') + t.voice.length + '</span>' : '') + (t.auto ? '<span class="tk-meta">Auto</span>' : '') + '</div></a>' + acts + '</div>';
}
function tkSetStatus(id, st) {
  var t = byId(S.tasks, id); if (!t) return;
  var prev = t.status; t.status = st; if (st === 'Completed') { t.doneAt = new Date().toISOString(); t.doneBy = S.me; }
  var b = t.booking ? bk(t.booking) : null; if (b) bLog(b, 'Task "' + t.name + '" ' + (st === 'Completed' ? 'done' : 'set to ' + st) + ' by ' + myName());
  else audit('Task "' + t.name + '" set to ' + st, { link: '#task/' + t.id });
  save(); render();
  undoSnack(st === 'Completed' ? 'Marked as done' : st === 'In Progress' ? 'Started' : 'Status changed', function () { t.status = prev; save(); render(); });
}
VIEWS.tasks = function () {
  if (!can('tasks.view')) return { html: topbar('Tasks', { back: '#more' }) + '<main>' + noAccess('tasks.view') + '</main>' };
  var manager = can('tasks.assign') || can('tasks.edit'), mode = manager ? (tk.mode || ((S.tasks || []).some(function (t) { return taskIsMine(t) && (t.status === 'Pending' || t.status === 'In Progress'); }) ? 'mine' : 'all')) : 'mine', now = new Date(), t0 = sod(now).getTime(), body = '';
  var all = (S.tasks || []).slice();
  if (mode === 'mine') {
    var mine = all.filter(taskIsMine), open = mine.filter(function (t) { return t.status === 'Pending' || t.status === 'In Progress'; });
    open.sort(function (a, b) { return new Date(a.at || 0) - new Date(b.at || 0); });
    var grp = { late: [], today: [], tomorrow: [], later: [] };
    open.forEach(function (t) { var x = t.at ? new Date(t.at).getTime() : t0; if (x < t0) grp.late.push(t); else if (x < t0 + DAY) grp.today.push(t); else if (x < t0 + 2 * DAY) grp.tomorrow.push(t); else grp.later.push(t); });
    var done = mine.filter(function (t) { return t.status === 'Completed' && t.doneAt && new Date(t.doneAt).getTime() >= t0; });
    var sec = function (title, list, red) { return list.length ? '<div class="sc-sec' + (red ? ' red' : '') + '">' + title + '<span>' + list.length + '</span></div>' + list.map(function (t) { return tkCard(t, true); }).join('') : ''; };
    body = sec('Late', grp.late, true) + sec('Today', grp.today) + sec('Tomorrow', grp.tomorrow) + sec('Later', grp.later.slice(0, 20)) + sec('Done today', done);
    if (!open.length) body = '<div class="empty tk-empty">' + I('task') + '<div><b>No jobs for you right now.</b><br>New jobs given to you show here.</div></div>' + sec('Done today', done);
  } else {
    var q = tk.q.trim();
    var list = all.filter(function (t) {
      if (tk.status === 'open' && !(t.status === 'Pending' || t.status === 'In Progress')) return false;
      if (tk.status !== 'open' && tk.status !== 'all' && t.status !== tk.status) return false;
      if (tk.type && t.type !== tk.type) return false;
      if (tk.staff && (t.staff || []).indexOf(tk.staff) < 0) return false;
      var b = t.booking ? bk(t.booking) : null;
      if (tk.car && !(b && b.car === tk.car) && String(t.name || '').indexOf((car(tk.car) || {}).plate || '@@') < 0) return false;
      if (q) { var c = b ? car(b.car) || {} : {}; if (!(wordsMatch(q, [t.name, t.type, t.note, b ? b.code : '', b ? cust(b.cust).name : '', c.plate, c.model, (t.staff || []).map(who).join(' ')].join(' ')) || (b && matchBookingCode(q, b)) || (b && phoneMatch(q, cust(b.cust).phone)) || (c.plate && normPlate(c.plate).indexOf(normPlate(q)) >= 0 && normPlate(q).length > 1))) return false; }
      return true;
    });
    var closed = tk.status === 'Completed' || tk.status === 'Cancelled' || tk.status === 'all';
    list.sort(function (a, b) { return closed ? new Date(b.at || 0) - new Date(a.at || 0) : new Date(a.at || 0) - new Date(b.at || 0); });
    var total = list.length;
    var stc = function (v, t) { return '<button type="button" class="fchip' + (tk.status === v ? ' on' : '') + '" data-tst="' + v + '">' + t + '</button>'; };
    var fc = function (id, label, val) { return '<button type="button" class="fchip' + (val ? ' on' : '') + '" id="' + id + '">' + esc(val || label) + (val ? ' ' + I('x', 2.4) : ' ' + I('down', 2.2)) + '</button>'; };
    body = '<label class="search">' + I('search') + '<input id="tkQ" type="search" autocomplete="off" placeholder="Task, booking, plate or person" value="' + esc(tk.q) + '"></label>' +
      '<div class="chiprow">' + stc('open', 'Open') + stc('Pending', 'Pending') + stc('In Progress', 'In Progress') + stc('Completed', 'Completed') + stc('Cancelled', 'Cancelled') + stc('all', 'All') + '</div>' +
      '<div class="chiprow tk-filt">' + fc('tkType', 'Type', tk.type) + fc('tkStaff', 'Staff', tk.staff ? who(tk.staff) : '') + fc('tkCar', 'Car', tk.car ? (car(tk.car) || {}).plate : '') + '</div>' +
      '<div class="tk-count">' + total + ' task' + (total === 1 ? '' : 's') + '</div>' +
      (list.length ? list.slice(0, tk.limit).map(function (t) { return tkCard(t, false); }).join('') + (total > tk.limit ? '<button type="button" class="btn ghost" id="tkMore">Show more (' + (total - tk.limit) + ' left)</button>' : '') : '<div class="empty">No tasks match.</div>');
  }
  var html = topbar('Tasks', { back: '#more', sub: mode === 'mine' ? 'My jobs' : 'All tasks' }) + '<main class="tk">' +
    (manager ? '<div class="seg2"><a href="javascript:void 0" role="button" data-mode="mine" class="' + (mode === 'mine' ? 'on' : '') + '">My jobs</a><a href="javascript:void 0" role="button" data-mode="all" class="' + (mode === 'all' ? 'on' : '') + '">All</a></div>' : '') +
    body + '</main>' + (can('tasks.create') ? '<a class="fab" href="#task/new" aria-label="New task">' + I('plus', 2.4) + '</a>' : '');
  return { html: html, after: tkListWire };
};
function tkListWire() {
  $$('[data-mode]').forEach(function (el) { el.onclick = function () { tk.mode = el.dataset.mode; render(); }; });
  $$('[data-st]').forEach(function (el) { el.onclick = function () { tkSetStatus(el.dataset.id, el.dataset.st); }; });
  $$('[data-ho]').forEach(function (el) { el.onclick = function () { Handover.start(el.dataset.b, el.dataset.ho); }; });
  $$('[data-tst]').forEach(function (el) { el.onclick = function () { tk.status = el.dataset.tst; tk.limit = 60; render(); }; });
  var q = $('#tkQ'), tm; if (q) q.oninput = function () { clearTimeout(tm); tm = setTimeout(function () { tk.q = q.value; tk.limit = 60; render(); var j = $('#tkQ'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }, 160); };
  var m = $('#tkMore'); if (m) m.onclick = function () { tk.limit += 60; render(); };
  var ty = $('#tkType'); if (ty) ty.onclick = function () {
    if (tk.type) { tk.type = ''; render(); return; }
    var sh = sheet(sheetHead('Task type') + '<div class="sc-menu">' + taskTypes().map(function (x) { return '<button type="button" class="sc-mi" data-ty="' + esc(x) + '"><span class="grow"><b>' + esc(x) + '</b></span></button>'; }).join('') + '</div>');
    $$('[data-ty]', sh).forEach(function (el) { el.onclick = function () { tk.type = el.dataset.ty; closeSheet(); render(); }; });
  };
  var sf = $('#tkStaff'); if (sf) sf.onclick = function () { if (tk.staff) { tk.staff = ''; render(); return; } Pickers.staff({ title: 'Tasks of', includeOff: true, onPick: function (p) { if (p) { tk.staff = p.id; render(); } } }); };
  var cf = $('#tkCar'); if (cf) cf.onclick = function () { if (tk.car) { tk.car = ''; render(); return; } Pickers.car({ title: 'Tasks for a car', onPick: function (c) { if (c) { tk.car = c.id; render(); } } }); };
}

/* ---------- editor ---------- */
function tkInit(r) {
  var key = r.path + JSON.stringify(r.q || {});
  if (tkEd && tkEd.key === key) return tkEd;
  tkStopRec(true);
  if (r.a === 'new') {
    var b = r.q.booking ? bk(r.q.booking) : null, end = r.q.end === 'in' ? 'ret' : r.q.end === 'out' ? 'pick' : (b && (b.bookingStatus === 'Car Delivered' || b.bookingStatus === 'Car Returned') ? 'ret' : 'pick');
    var at = b ? (end === 'ret' ? b.end : b.start) : new Date(Math.ceil(Date.now() / (30 * MIN)) * 30 * MIN + HOUR).toISOString();
    var t = { id: uid(), name: b ? taskName(b, end) : '', type: b ? taskTypeFor(b, end) : 'General', booking: b ? b.id : null, staff: [], at: at, status: 'Pending', note: b ? (end === 'ret' ? b.retNote : b.pickNote) || '' : '', photos: [], voice: [], wa: {}, auto: false, by: S.me, created: new Date().toISOString() };
    tkEd = { key: key, isNew: true, t: t, orig: null, dirty: false };
  } else {
    var o = byId(S.tasks || [], r.a);
    tkEd = o ? { key: key, isNew: false, t: JSON.parse(JSON.stringify(o)), orig: o, dirty: false } : { key: key, missing: true };
  }
  return tkEd;
}
function tkPreferIds(t) {
  var b = t.booking ? bk(t.booking) : null, ids = [];
  if (b) [['pick', b.pickKind, b.pickLoc], ['ret', b.retKind, b.retLoc]].forEach(function (x) { if (x[1] === 'our') { var l = loc(x[2]); (l && l.agents || []).forEach(function (s) { if (ids.indexOf(s) < 0) ids.push(s); }); } });
  S.staff.forEach(function (p) { if (p.isAgent && ids.indexOf(p.id) < 0) ids.push(p.id); });
  return ids;
}
function tkWaHtml(t) {
  var ids = t.staff || [];
  if (!ids.length || tkEd.isNew) return '<div id="tkWa"></div>';
  var canSend = can('tasks.send_whatsapp') || can('tasks.edit');
  return '<div id="tkWa" class="formcard"><h3>' + I('wa') + 'WhatsApp to staff</h3>' + ids.map(function (sid) {
    var p = staff(sid) || { name: sid }, st = (t.wa || {})[sid] || 'Not sent';
    return '<div class="tk-war"><span class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</span><span class="grow"><b>' + esc(p.name) + '</b>' + chip(st, WA_TONE[st] || 'grey') + '</span>' +
      (canSend ? '<button type="button" class="btn sm ghost" data-resend="' + sid + '">' + (st === 'Not sent' ? 'Send' : 'Resend') + '</button>' : '') + '</div>';
  }).join('') + '<p class="hint">Simulated in the demo: the message goes out, the person replies, then the job details are sent.</p></div>';
}
function tkWireWa() {
  $$('[data-resend]').forEach(function (el) { el.onclick = function () { var o = tkEd.orig; if (!o) return; taskSendWa(o, [el.dataset.resend]); tkEd.t.wa = Object.assign({}, o.wa); save(); tkLiveWa(o); say(o.wa[el.dataset.resend] === 'Failed' ? 'Could not send: no WhatsApp number for ' + who(el.dataset.resend) : 'Sent to ' + firstName(who(el.dataset.resend))); }; });
}
function tkVoiceHtml(t, canW) {
  var rec = tkRec ? '<div class="tk-rec"><span class="tk-recdot"></span><b>Recording...</b><span class="num" id="tkRecT">0:00</span><button type="button" class="btn sm danger solid" id="tkStop">' + I('check', 2.4) + 'Stop</button></div>' : '';
  var list = (t.voice || []).map(function (v, i) {
    return '<div class="tk-vn"><audio controls preload="none" src="' + esc(v.src) + '"></audio><div class="tk-vn-m"><span>' + esc(who(v.by) || '') + ' · ' + esc(dShort(v.at) + ', ' + hm(v.at)) + (v.dur ? ' · ' + Math.round(v.dur) + 's' : '') + (v.sample ? ' · sample' : '') + '</span>' +
      (canW ? '<button type="button" class="iconbtn" data-vdel="' + i + '" aria-label="Delete voice note">' + I('trash') + '</button>' : '') + '</div></div>';
  }).join('');
  return list + rec + (canW && !tkRec ? '<button type="button" class="btn ghost" id="tkRecB">' + I('mic') + 'Record a voice note</button>' : '') + (!list && !canW ? '<p class="hint">No voice notes</p>' : '');
}
VIEWS.task = function (r) {
  if (!can('tasks.view')) return { html: topbar('Task', { back: '#tasks' }) + '<main>' + noAccess('tasks.view') + '</main>' };
  var ed = tkInit(r);
  if (ed.missing) return { html: topbar('Task', { back: '#tasks' }) + '<main><div class="empty">This task was deleted or does not exist.</div></main>' };
  if (ed.isNew && !can('tasks.create')) return { html: topbar('New task', { back: '#tasks' }) + '<main>' + noAccess('tasks.create') + '</main>' };
  var t = ed.t, full = ed.isNew || taskCanEdit(ed.orig), work = full || taskCanWork(ed.orig), assign = ed.isNew ? (can('tasks.assign') || can('tasks.create')) : can('tasks.assign'), b = t.booking ? bk(t.booking) : null, dis = full ? '' : ' disabled';
  var dt = t.at ? new Date(t.at) : null;
  var types = taskTypes(); if (t.type && types.indexOf(t.type) < 0) types.push(t.type);
  var people = (t.staff || []).map(staff).filter(Boolean);
  var html = topbar(ed.isNew ? 'New task' : 'Task', { back: '#tasks', sub: ed.isNew ? (b ? b.code : '') : t.status + (t.at ? ' · ' + tkWhenText(t) : '') }) + '<main class="tk-ed no-nav">' +
    (t.auto ? '<div class="banner blue">' + I('bot') + '<div><b>Auto-assigned to ' + esc((t.staff || []).map(who).join(', ')) + '</b>' + (t.autoWhy ? ' (' + esc(t.autoWhy) + ')' : ' by the auto-assign rules') + ' when the agreement was signed.</div></div>' : '') +
    (!full && work ? '<div class="banner">' + I('info') + '<div>You can change the status, the note, photos and voice notes of your job.</div></div>' : '') +
    '<div class="formcard"><label class="field"><span>Task name</span><input class="inp" id="tkName" maxlength="255" placeholder="For example: Deliver the car to the hotel" value="' + esc(t.name) + '"' + dis + '><small class="err" id="tkNameErr"></small></label>' +
    '<div class="field"><span>Booking (optional)</span><div class="tk-bk">' + (b ? '<button type="button" class="carfield tk-bkf" id="tkBk"' + dis + '><span class="grow"><b>' + esc(b.code) + '</b> ' + esc(cust(b.cust).name) + '<small>' + esc(((car(b.car) || {}).plate || '') + ' · ' + dShort(b.start) + ' to ' + dShort(b.end)) + '</small></span></button>' + (full ? '<button type="button" class="iconbtn" id="tkBkX" aria-label="Remove booking">' + I('x', 2.2) + '</button>' : '<a class="iconbtn" href="#booking/' + b.id + '" aria-label="Open booking">' + I('chev') + '</a>') :
      '<button type="button" class="carfield tk-bkf empty" id="tkBk"' + dis + '><span class="grow">' + I('search') + 'Find a booking</span></button>') + '</div></div>' +
    '<label class="field"><span>Type</span><select class="inp" id="tkType"' + dis + '>' + types.map(function (x) { return '<option' + (x === t.type ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>' +
    '<div class="field"><span>Scheduled at</span><div class="ho-two"><input class="inp" type="date" id="tkDate" value="' + (dt ? toLocalInput(dt) : '') + '"' + dis + '><input class="inp" type="time" id="tkTime" step="900" value="' + (dt ? toTimeInput(dt) : '') + '"' + dis + '></div><small class="err" id="tkAtErr"></small>' +
    (b && full ? '<div class="tk-quick"><button type="button" class="fchip" data-at="start">Start ' + esc(dShort(b.start) + ', ' + hm(b.start)) + '</button><button type="button" class="fchip" data-at="end">End ' + esc(dShort(b.end) + ', ' + hm(b.end)) + '</button></div>' : '') + '</div></div>' +
    '<div class="formcard"><h3>' + I('users') + 'Staff</h3><div class="tk-people">' + (people.length ? people.map(function (p) { return '<span class="tk-person"><span class="av xs" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</span>' + esc(p.id === S.me ? p.name + ' (me)' : p.name) + '</span>'; }).join('') : '<span class="muted small">Nobody chosen yet</span>') + '</div>' +
    (assign ? '<button type="button" class="btn ghost" id="tkStaff">' + I('users') + (people.length ? 'Change staff' : 'Choose staff') + '</button>' : '') + '<small class="err" id="tkStaffErr"></small></div>' +
    tkWaHtml(t) +
    '<div class="formcard"><h3>' + I('task') + 'Status</h3><div class="seg" id="tkSt">' + TASK_STATUSES.map(function (s) { return '<button type="button" class="' + (t.status === s ? 'on' : '') + '"' + (work ? '' : ' disabled') + '>' + s + '</button>'; }).join('') + '</div>' +
    '<label class="field"><span>Note</span><textarea class="inp ho-ta" id="tkNote" maxlength="1000" placeholder="Address, who to meet, what to bring"' + (work ? '' : ' disabled') + '>' + esc(t.note || '') + '</textarea></label></div>' +
    '<div class="formcard"><h3>' + I('camera') + 'Photos</h3><div class="tk-photos">' + (t.photos || []).map(function (p, i) {
      return '<div class="tk-ph"><span class="thumb"><img alt="" src="' + imgSrc(p.src) + '"></span><input class="inp" data-cap="' + i + '" maxlength="120" placeholder="Caption" value="' + esc(p.caption || '') + '"' + (work ? '' : ' disabled') + '>' + (work ? '<button type="button" class="iconbtn" data-pdel="' + i + '" aria-label="Remove photo">' + I('trash') + '</button>' : '') + '</div>';
    }).join('') + '</div>' + (work ? '<div class="btnrow tk-btnrow"><button type="button" class="btn ghost sm" id="tkPh">' + I('camera') + 'Add photo</button><button type="button" class="btn ghost sm" id="tkPhS">' + I('image') + 'Sample</button></div>' : (t.photos || []).length ? '' : '<p class="hint">No photos</p>') + '</div>' +
    '<div class="formcard"><h3>' + I('mic') + 'Voice notes</h3><div id="tkVoice">' + tkVoiceHtml(t, work) + '</div></div>' +
    (!ed.isNew ? '<p class="tk-by">Made ' + esc(t.by === 'Auto-assign' ? 'by auto-assign' : 'by ' + (who(t.by) || 'someone')) + (t.created ? ' on ' + esc(dShort(t.created)) : '') + '</p>' : '') +
    (!ed.isNew && can('tasks.delete') ? '<button type="button" class="btn link red" id="tkDel">' + I('trash') + 'Delete task</button>' : '') +
    '</main>' + (work ? '<div class="stickybar"><div class="stickybar-in"><button type="button" class="btn ghost tk-cancel" id="tkCancel">Cancel</button><button type="button" class="btn" id="tkSave" style="flex:1">' + I('check', 2.4) + (ed.isNew ? 'Save task' : 'Save changes') + '</button></div></div>' : '');
  return { html: html, noNav: true, after: tkEdWire };
};
function tkCollect() {
  var t = tkEd.t, n = $('#tkName'); if (!n) return t;
  t.name = n.value; t.type = $('#tkType').value; t.note = $('#tkNote').value;
  var d = $('#tkDate').value, tm = $('#tkTime').value; t.at = d ? fromInputs(d, tm || '09:00').toISOString() : null;
  $$('[data-cap]').forEach(function (el) { var p = t.photos[+el.dataset.cap]; if (p) p.caption = el.value; });
  return t;
}
function tkRedraw() { tkCollect(); tkEd.dirty = true; render(false, true); }
function tkEdWire() {
  var t = tkEd.t;
  ['#tkName', '#tkNote', '#tkDate', '#tkTime', '#tkType'].forEach(function (s) { var el = $(s); if (el) el.addEventListener('input', function () { tkEd.dirty = true; tkCollect(); if (s === '#tkDate' || s === '#tkTime') tkEd.touchedAt = true; if (s === '#tkType') tkEd.touchedType = true; if (s === '#tkName') tkEd.touchedName = true; }); });
  ['#tkDate', '#tkTime'].forEach(function (s) { var el = $(s); if (el) el.addEventListener('change', function () { tkEd.touchedAt = true; }); });
  var ty = $('#tkType'); if (ty) ty.onchange = function () {
    var b = t.booking ? bk(t.booking) : null; tkCollect(); tkEd.touchedType = true;
    if (tkEd.touchedAt) return;
    if (b && /^Return/.test(t.type)) { t.at = b.end; render(false, true); } else if (b && /^Delivery/.test(t.type)) { t.at = b.start; render(false, true); }
  };
  $$('[data-cap]').forEach(function (el) { el.addEventListener('input', function () { tkEd.dirty = true; tkCollect(); }); });
  $$('[data-at]').forEach(function (el) { el.onclick = function () { var b = bk(t.booking); tkCollect(); t.at = el.dataset.at === 'end' ? b.end : b.start; tkEd.dirty = true; tkEd.touchedAt = true; render(false, true); }; });
  var bkb = $('#tkBk'); if (bkb) bkb.onclick = function () {
    tkCollect();
    Pickers.booking({ title: 'Link a booking', selected: t.booking, onPick: function (b) {
      /* fill in only what the person has not set: their name, type and date stay as typed, and the time never moves into the past quietly */
      if (!b) return; t.booking = b.id; var end = /^Return/.test(t.type) ? 'ret' : 'pick', auto = !t.name.trim() || !tkEd.touchedName;
      if (auto && t.type === 'General' && !tkEd.touchedType) t.type = taskTypeFor(b, end = (b.bookingStatus === 'Car Delivered' ? 'ret' : 'pick'));
      if (!t.name.trim()) t.name = taskName(b, end);
      var to = end === 'ret' ? b.end : b.start;
      if (!tkEd.touchedAt && auto) { if (new Date(to) >= new Date()) t.at = to; else say('The booking ' + (end === 'ret' ? 'end' : 'start') + ' time has passed, so the date was kept. Tap the time button to use it.'); }
      tkEd.dirty = true; render(false, true);
    } });
  };
  var bx = $('#tkBkX'); if (bx) bx.onclick = function () { tkCollect(); t.booking = null; tkEd.dirty = true; render(false, true); };
  var sf = $('#tkStaff'); if (sf) sf.onclick = function () {
    tkCollect();
    Pickers.staff({ multi: true, title: 'Who does it?', selected: t.staff || [], preferIds: tkPreferIds(t), onPick: function (list) { t.staff = list.map(function (p) { return p.id; }); tkEd.dirty = true; render(false, true); } });
  };
  segPick('#tkSt', function (s) { t.status = s; tkEd.dirty = true; });
  var ph = $('#tkPh'); if (ph) ph.onclick = function () { tkCollect(); Media.photo({ maxPx: 900, quality: .6 }).then(function (r) { if (!tkEd || tkEd.t !== t) return; t.photos.push({ src: r.dataUrl, caption: '' }); if (r.note) say(r.note); tkEd.dirty = true; render(false, true); var c = $$('[data-cap]'); if (c.length) c[c.length - 1].focus(); }, function () {}); };
  var ps = $('#tkPhS'); if (ps) ps.onclick = function () { tkCollect(); t.photos.push({ src: 'demo:photo:Task photo ' + (t.photos.length + 1), caption: '' }); tkEd.dirty = true; render(false, true); };
  $$('[data-pdel]').forEach(function (el) { el.onclick = function () { tkCollect(); var i = +el.dataset.pdel, p = t.photos.splice(i, 1)[0]; tkEd.dirty = true; render(false, true); undoSnack('Photo removed', function () { if (tkEd && tkEd.t === t) { t.photos.splice(i, 0, p); render(false, true); } }); }; });
  var rb = $('#tkRecB'); if (rb) rb.onclick = function () { tkCollect(); tkStartRec(); };
  var stp = $('#tkStop'); if (stp) stp.onclick = function () { tkStopRec(false); };
  $$('[data-vdel]').forEach(function (el) { el.onclick = function () { tkCollect(); var i = +el.dataset.vdel, v = t.voice.splice(i, 1)[0]; tkEd.dirty = true; render(false, true); undoSnack('Voice note deleted', function () { if (tkEd && tkEd.t === t) { t.voice.splice(i, 0, v); render(false, true); } }); }; });
  tkWireWa();
  var cn = $('#tkCancel'); if (cn) cn.onclick = function () {
    var leave = function () { tkStopRec(true); tkEd = null; goBack('#tasks'); };
    if (!tkEd.dirty) { leave(); return; }
    tkCollect(); tkAskDiscard().then(function (y) { if (y) leave(); });
  };
  var sv = $('#tkSave'); if (sv) sv.onclick = tkSave;
  var dl = $('#tkDel'); if (dl) dl.onclick = function () {
    confirm({ icon: 'danger', title: 'Delete this task?', text: '“' + t.name + '” and its photos and voice notes will be removed.', ok: 'Delete task', cancel: 'Keep it', danger: true }).then(function (ok) {
      if (!ok) return; var o = tkEd.orig, i = S.tasks.indexOf(o); if (i < 0) return;
      S.tasks.splice(i, 1); audit('Task "' + o.name + '" deleted', { booking: o.booking }); save(); tkEd = null;
      setTimeout(function () { replaceHash('#tasks'); undoSnack('Task deleted', function () { S.tasks.splice(i, 0, o); save(); render(); }); }, 180);
    });
  };
}
function tkSave() {
  var t = tkCollect(), ok = true, isNew = tkEd.isNew;
  t.name = t.name.trim().replace(/\s+/g, ' ');
  if (!t.name) { $('#tkNameErr').textContent = 'Give the task a name.'; $('#tkName').classList.add('bad'); ok = false; }
  if (!t.at) { $('#tkAtErr').textContent = 'Choose the date and time.'; ok = false; }
  if (!(t.staff || []).length) { $('#tkStaffErr').textContent = 'Choose who does it.'; ok = false; }
  if (!ok) { var e = $('.err:not(:empty)'); if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  tkStopRec(true);
  var o = tkEd.orig, before = o ? (o.staff || []).slice() : [], added = (t.staff || []).filter(function (s) { return before.indexOf(s) < 0; });
  if (t.status === 'Completed' && (!o || o.status !== 'Completed')) { t.doneAt = new Date().toISOString(); t.doneBy = S.me; }
  t.changedBy = S.me; t.changedAt = new Date().toISOString();
  if (isNew) { S.tasks = S.tasks || []; S.tasks.unshift(t); o = t; }
  else { var ch = {}; ['name', 'type', 'status', 'at', 'booking'].forEach(function (k) { if (String(o[k] || '') !== String(t[k] || '')) ch[k] = [o[k], t[k]]; }); Object.keys(o).forEach(function (k) { delete o[k]; }); Object.assign(o, t); t = o; tkEd.ch = ch; }
  if (added.length) taskSendWa(o, added);
  (o.wa && Object.keys(o.wa) || []).forEach(function (sid) { if ((o.staff || []).indexOf(sid) < 0) delete o.wa[sid]; });
  var b = o.booking ? bk(o.booking) : null;
  if (b) { b.assigned = b.assigned || []; (o.staff || []).forEach(function (s) { if (b.assigned.indexOf(s) < 0) b.assigned.push(s); }); bLog(b, (isNew ? 'Task made: ' : 'Task changed: ') + o.name + ' (' + o.staff.map(who).join(', ') + ')', tkEd.ch && Object.keys(tkEd.ch).length ? tkEd.ch : null); }
  else audit((isNew ? 'Task made: ' : 'Task changed: ') + o.name, { link: '#task/' + o.id });
  save();
  var msg = isNew ? 'Task saved' + (added.length ? '. WhatsApp sent to ' + added.map(function (s) { return firstName(who(s)); }).join(', ') : '') : 'Changes saved' + (added.length ? '. WhatsApp sent to ' + added.map(function (s) { return firstName(who(s)); }).join(', ') : '');
  tkEd = null;
  goBack(isNew && b ? '#booking/' + b.id : '#tasks');
  setTimeout(function () { say(msg); }, 120);
}

/* ---------- voice notes: MediaRecorder, or a made-up sample where there is no microphone ---------- */
function tkSampleWav(sec) {
  var rate = 8000, n = Math.round(rate * sec), buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer), w = function (o, s) { for (var i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
  for (var i = 0; i < n; i++) { var tt = i / rate, env = Math.max(0, Math.sin(Math.PI * ((tt * 2.5) % 1))) * .5, f = 180 + 60 * Math.sin(tt * 3); buf[44 + i] = 128 + Math.round(70 * env * Math.sin(2 * Math.PI * f * tt) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * tt))); }
  var s = ''; for (var j = 0; j < buf.length; j++) s += String.fromCharCode(buf[j]);
  return 'data:audio/wav;base64,' + btoa(s);
}
function tkAddVoice(src, dur, sample) { if (!tkEd) return; tkEd.t.voice = tkEd.t.voice || []; tkEd.t.voice.push({ src: src, dur: dur, at: new Date().toISOString(), by: S.me, sample: !!sample }); tkEd.dirty = true; render(false, true); say(sample ? 'Sample voice note added' : 'Voice note added'); }
function tkStartRec() {
  var noMic = function () {
    confirm({ icon: 'info', title: 'No microphone here', text: 'This device did not allow the microphone. For the demo you can add a short sample voice note instead.', ok: 'Add a sample voice note', cancel: 'Not now' }).then(function (ok) { if (ok) tkAddVoice(tkSampleWav(3), 3, true); });
  };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { noMic(); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    var chunks = [], mr; try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(function (x) { x.stop(); }); noMic(); return; }
    tkRec = { mr: mr, stream: stream, t0: Date.now(), iv: null, drop: false };
    mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = function () {
      var rec = tkRec; stream.getTracks().forEach(function (x) { x.stop(); }); if (rec && rec.iv) clearInterval(rec.iv); tkRec = null;
      if (!rec || rec.drop || !chunks.length) { render(false, true); return; }
      var dur = (Date.now() - rec.t0) / 1000, fr = new FileReader();
      fr.onload = function () { tkAddVoice(fr.result, dur, false); };
      fr.readAsDataURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    };
    mr.start();
    render(false, true);
    tkRec.iv = setInterval(function () { if (!tkRec) return; var s = Math.floor((Date.now() - tkRec.t0) / 1000), el = $('#tkRecT'); if (el) el.textContent = Math.floor(s / 60) + ':' + pad(s % 60); if (s >= 120) tkStopRec(false); }, 250);
  }, noMic);
}
function tkStopRec(drop) {
  if (!tkRec) return; var r = tkRec; r.drop = !!drop; if (r.iv) clearInterval(r.iv);
  try { if (r.mr.state !== 'inactive') r.mr.stop(); else { r.stream.getTracks().forEach(function (x) { x.stop(); }); tkRec = null; } } catch (e) { tkRec = null; }
}
function tkAskDiscard() { return confirm({ icon: 'warn', title: tkEd && tkEd.isNew ? 'Discard this task?' : 'Discard your changes?', text: 'What you typed, the photos and voice notes will be lost.', ok: 'Discard', cancel: 'Keep editing', primary: 'cancel' }); }
/* leaving the editor with Back while it has changes: ask, and come back to it when the person keeps editing */
window.addEventListener('hashchange', function (e) {
  if (route().name === 'task' || !tkEd) return;
  var held = tkEd, back = (e && e.oldURL && e.oldURL.indexOf('#') >= 0) ? e.oldURL.slice(e.oldURL.indexOf('#')) : '';
  if (!held.dirty || !back || held.asking) { tkStopRec(true); tkEd = null; return; }
  held.asking = true;
  tkAskDiscard().then(function (y) {
    held.asking = false;
    if (y) { if (tkEd === held) tkEd = null; tkStopRec(true); return; }
    tkEd = held; location.hash = back;
  });
});

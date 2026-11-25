/* ===================================================================
   Page: Tasks (#page=tasks, #page=tasks&action=add, #page=tasks&task=<id>)   Owner: builder 4
   Inventory section 11. Jobs for field agents: list with filters, the task drawer (assignment, WhatsApp status,
   task info, voice notes, photos), delete. Agents get a WhatsApp template when they are assigned; when they reply,
   the full task details are sent (here the reply is played out in the sample after a few seconds, or by hand).
   Sets API.newTask(prefill) and API.openTask(id) so any page (Bookings > Assign Task, Schedules) opens the drawer.
   =================================================================== */

/* ---------------- small helpers ---------------- */
function tskBooking(t) { return t && t.booking ? findBooking(t.booking) : null; }
function tskWhen(dt) { if (!dt) return '-'; return UI.fmt.date(dt) + ' / ' + tm(dt); }   /* the same '10:00 AM' as Schedules and Settings */
/* the order the list opens in: open jobs that are late, then today's, then the coming ones (soonest first), then done or
   cancelled ones (latest first) */
function tskRank(t, t0) { var open = t.status !== 'Completed' && t.status !== 'Cancelled'; if (!open) return 3; return t.at < t0 ? 0 : t.at < t0 + DAY ? 1 : 2; }
function tskOrder(a, b) { var t0 = new Date(NOW()).setHours(0, 0, 0, 0), ra = tskRank(a, t0), rb = tskRank(b, t0); return ra - rb || (ra === 3 ? b.at - a.at : a.at - b.at); }
function tskEmp(id) { return employeeById(id) || byId(D().employees, id); }
function tskFirst(name) { return String(name || '').split(' ')[0]; }

/* a short sound for voice notes that were not recorded in this browser (8 kHz WAV, made once and kept) */
var TSK_WAV = {};
function tskWav(id, len) {
  if (TSK_WAV[id]) return TSK_WAV[id];
  var sr = 8000, n = Math.max(1, Math.min(60, len || 5)) * sr, buf = new ArrayBuffer(44 + n), v = new DataView(buf), s = function (o, str) { for (var k = 0; k < str.length; k++) v.setUint8(o + k, str.charCodeAt(k)); };
  s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); s(36, 'data'); v.setUint32(40, n, true);
  var seed = 0; String(id).split('').forEach(function (c) { seed += c.charCodeAt(0); });
  for (var k = 0; k < n; k++) {
    var t = k / sr, syl = Math.sin(Math.PI * ((t * (2.6 + (seed % 5) * .2)) % 1)), gap = Math.floor(t * 1.3 + seed) % 5 === 0 ? 0 : 1;
    var f = 150 + 40 * Math.sin(t * 3 + seed), a = .22 * syl * syl * gap;
    v.setUint8(44 + k, 128 + Math.round(127 * a * (Math.sin(2 * Math.PI * f * t) * .7 + Math.sin(4 * Math.PI * f * t) * .3)));
  }
  TSK_WAV[id] = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return TSK_WAV[id];
}
/* a picture for photos that were added before this session (the sample keeps only their names) */
function tskPhoto(p, k) {
  if (p.dataUrl) return p.dataUrl;
  var hue = (k * 67 + String(p.name).length * 13) % 360;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',35%,62%)"/><stop offset="1" stop-color="hsl(' + ((hue + 40) % 360) + ',40%,34%)"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><rect y="168" width="320" height="72" fill="rgba(0,0,0,.18)"/><path d="M70 150 q10-38 40-44 l40-22 q20-8 46-6 l44 6 q22 4 34 28 l8 20 q6 12-4 18 h-196 q-16-2-12-18z" fill="rgba(255,255,255,.88)"/><circle cx="112" cy="168" r="20" fill="#2b2d33"/><circle cx="226" cy="168" r="20" fill="#2b2d33"/><circle cx="112" cy="168" r="8" fill="#c9ccd3"/><circle cx="226" cy="168" r="8" fill="#c9ccd3"/><text x="12" y="228" font-family="sans-serif" font-size="13" fill="#fff">' + esc(p.name) + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* the two WhatsApp messages an agent gets */
function tskTemplateText(t, e) {
  var b = B();
  return 'Hello ' + tskFirst(e.name) + ', you have a new task from ' + b.name + ': "' + t.name + '" on ' + UI.fmt.dateTime(t.at) + '. Reply to this message to get the full details.';
}
function tskDetailsText(t) {
  var x = tskBooking(t), L = [];
  L.push('📋 Task: ' + t.name, 'Scheduled: ' + UI.fmt.dateTime(t.at), 'Type: ' + t.type, 'Status: ' + t.status);
  if (t.note) L.push('Note: ' + t.note);
  if (x) {
    L.push('', '── Booking Info ──', 'Car: ' + carName(x.car) + ' (' + x.car.plate + ')', 'Rental: ' + UI.fmt.dateTime(x.start) + ' to ' + UI.fmt.dateTime(x.end),
      'Start location: ' + (x.pickup || '-') + (x.startOpt && x.startOpt !== 'Not chosen' ? ' (' + x.startOpt + ')' : ''), 'End location: ' + (x.drop || '-') + (x.endOpt && x.endOpt !== 'Not chosen' ? ' (' + x.endOpt + ')' : ''),
      'Renter: ' + x.cust.name, 'Renter phone: ' + x.cust.phone, 'Inspection link: ' + siteLink(x, 'agent'),
      'Total rent: ' + UI.fmt.money(x.rent - (x.disc || 0)), 'Deposit: ' + UI.fmt.money(x.dep), 'Delivery charge: ' + UI.fmt.money(x.deliv || 0), 'Return charge: ' + UI.fmt.money(x.ret || 0), 'Others: ' + UI.fmt.money((x.others || 0) + (x.dmg || 0)),
      'Total payable amount: ' + UI.fmt.money(x.payable), 'Delivery note: ' + (x.delNote || '-'), 'Return note: ' + (x.retNote || '-'));
  }
  var extra = [];
  if (t.photos && t.photos.length) extra.push(plural(t.photos.length, 'photo') + ' with their captions');
  if (t.voice && t.voice.length) extra.push(plural(t.voice.length, 'voice note'));
  if (extra.length) L.push('', '(then ' + extra.join(' and ') + ')');
  return L.join('\n');
}

/* send the template to some agents of a saved task; returns {sent, failed} */
function tskSend(t, ids, quiet) {
  var wa = Object.assign({}, t.wa || {}), err = Object.assign({}, t.waErr || {}), sent = 0, failed = 0;
  ids.forEach(function (id) {
    var e = tskEmp(id); if (!e) return;
    if (!e.wa) { wa[id] = 'Failed'; err[id] = 'No WhatsApp number'; failed++; }
    else if (e.active === false) { wa[id] = 'Failed'; err[id] = 'The agent is switched off'; failed++; }
    else { wa[id] = 'Template Sent'; delete err[id]; sent++; }
  });
  DB.update('tasks', t, { wa: wa, waErr: err }, { action: 'Sent', text: DB.actor() + ' sent the WhatsApp template of task "' + t.name + '" to ' + plural(ids.length, 'agent'), changes: ids.map(function (id) { var e = tskEmp(id); return { f: 'WhatsApp ' + (e ? e.name : id), from: (t.wa || {})[id] || 'Not Sent', to: wa[id] }; }) });
  if (!quiet) UI.toast(failed ? sent + ' sent, ' + failed + ' failed' : 'WhatsApp template sent to ' + plural(sent, 'agent'), { tone: failed ? 'warn' : 'ok' });
  return { sent: sent, failed: failed };
}
/* the agent replies: Reply Received, then the details go out and it becomes Details Sent */
function tskReply(taskId, empId, d0) {
  if (d0 && D() !== d0) return;
  var t = DB.get('tasks', taskId), e = tskEmp(empId); if (!t || !e || (t.wa || {})[empId] !== 'Template Sent') return;
  var wa = Object.assign({}, t.wa); wa[empId] = 'Reply Received';
  DB.update('tasks', t, { wa: wa }, { action: 'Changed', text: e.name + ' replied on WhatsApp to task "' + t.name + '"', changes: [{ f: 'WhatsApp ' + e.name, from: 'Template Sent', to: 'Reply Received' }] });
  setTimeout(function () {
    if (d0 && D() !== d0) return;
    var t2 = DB.get('tasks', taskId); if (!t2 || (t2.wa || {})[empId] !== 'Reply Received') return;
    var w2 = Object.assign({}, t2.wa); w2[empId] = 'Details Sent';
    DB.update('tasks', t2, { wa: w2 }, { action: 'Sent', text: 'The details of task "' + t2.name + '" were sent to ' + e.name + ' on WhatsApp', changes: [{ f: 'WhatsApp ' + e.name, from: 'Reply Received', to: 'Details Sent' }] });
    DB.notify({ icon: 'brand-whatsapp', tone: 'info', title: 'Agent replied', text: e.name + ' replied and got the details of "' + t2.name + '".', page: 'tasks', params: { task: taskId } });
    UI.toast(tskFirst(e.name) + ' replied on WhatsApp. The task details were sent.', { tone: 'ok', action: { label: 'See the message', run: function () { tskMessage(t2, e, 'details'); } } });
  }, 1400);
}
/* what the agent sees on WhatsApp */
function tskMessage(t, e, which) {
  var txt = which === 'details' ? tskDetailsText(t) : tskTemplateText(t, e);
  UI.dialog({ title: which === 'details' ? 'Task details sent to ' + e.name : 'Template sent to ' + e.name, width: 'md',
    body: '<div class="tsk-wa"><div class="tsk-wa-to">' + i('brand-whatsapp') + '<span>To ' + esc(e.name) + ' ' + (e.wa ? UI.phone(e.wa) : '<span class="faint">No WhatsApp number</span>') + '</span></div><div class="tsk-bubble">' + esc(txt).replace(/\n/g, '<br>') + '</div>' +
      (which === 'details' && ((t.photos || []).length || (t.voice || []).length) ? '<div class="tsk-wa-att">' + (t.photos || []).map(function (p, k) { return '<figure class="tsk-waph"><img src="' + tskPhoto(p, k) + '" alt="' + esc(p.caption || p.name) + '">' + (p.caption ? '<figcaption>' + esc(p.caption) + '</figcaption>' : '') + '</figure>'; }).join('') + (t.voice || []).map(function (v) { return '<span class="chip grey">' + i('microphone') + tskClock(v.len) + '</span>'; }).join('') + '</div>' : '') + '</div>',
    buttons: [{ label: 'Copy message', kind: 'o', onClick: function () { UI.copy(txt, { label: 'Message copied' }); return false; } }, { label: 'Close' }] });
}

/* ---------------- the drawer: new, edit, or read-only ---------------- */
function tskDrawer(id, prefill, onDone) {
  var d = D(), d0 = d, t = id ? byId(d.tasks, id) : null;
  if (id && !t) { UI.toast('That task is no longer here.', { tone: 'warn' }); return null; }
  var canEdit = t ? can('tasks.edit') : can('tasks.create'), canAssign = can('tasks.assign') && canEdit, canWa = can('tasks.send_whatsapp');
  if (!t && !canEdit) { UI.toast('Your login cannot create tasks.', { tone: 'warn' }); return null; }
  prefill = prefill || {};
  var pb = prefill.booking ? findBooking(prefill.booking) : null;
  var f = t ? { name: t.name, at: t.at, type: t.type, status: t.status, note: t.note || '', agents: t.agents.slice(), booking: t.booking || '', voice: (t.voice || []).slice(), photos: (t.photos || []).slice() }
    : { name: prefill.name || '', at: prefill.at || (pb ? pb.start : null), type: prefill.type || (pb ? taskTypeFor(pb, 'start') : 'General'), status: 'Pending', note: prefill.note || (pb && pb.delNote ? pb.delNote : ''), agents: prefill.agents ? prefill.agents.slice() : [], booking: pb ? pb.code : '', voice: [], photos: [] };
  if (!t && pb && !f.name) f.name = 'Deliver ' + carModel(pb.car) + ' ' + pb.car.plate + ' to ' + tskFirst(pb.cust.name);
  var start = JSON.stringify(f), rec = null, err = {};
  var title = t ? (canEdit ? 'Edit Task' : 'Task') : 'New Task';

  function bookingLabel(x) { return x.code + ' · ' + x.cust.name + ' · ' + carModel(x.car) + ' ' + x.car.plate; }
  function body() {
    var x = f.booking ? findBooking(f.booking) : null, ro = !canEdit;
    var agents = f.agents.map(function (aid) { var e = tskEmp(aid); return e ? '<span class="tsk-agent">' + UI.avatar(e.name) + '<span>' + esc(e.name) + '</span>' + '</span>' : ''; }).join('');
    var html = '<div class="tsk-form">' +
      '<div class="ovl">Assignment</div>' +
      /* who and which booking: the shared pickers (search by name; booking by code in any form, name, phone digits or plate) */
      (canAssign ? '<div class="tsk-pick" data-tsk-agents></div>' : '<div class="inp full"><label>Employees (Agents)</label><div class="tsk-agents">' + (agents || '<span class="faint b2">No agents yet</span>') + '</div>' + (canEdit ? '<span class="help">Your login cannot change who the task is given to.</span>' : '') + '</div>') +
      (ro ? '<div class="inp full"><label>Booking (optional)</label><div class="tsk-bkrow"><span class="tsk-bkv">' + (x ? esc(bookingLabel(x)) : '-') + '</span>' + (x ? UI.iconBtn('external-link', 'Open the booking', { size: 'sm', attrs: { 'data-act': 'openbooking' } }) : '') + '</div></div>'
        : '<div class="tsk-bkrow"><div class="tsk-pick grow" data-tsk-bk></div>' + (x ? UI.iconBtn('external-link', 'Open the booking', { size: 'sm', attrs: { 'data-act': 'openbooking' } }) : '') + '</div>');
    if (t && t.agents.length) {
      html += '<div class="tsk-wabox"><div class="row"><b class="grow">' + i('brand-whatsapp') + ' WhatsApp Assignment Status</b>' + (canWa ? UI.btn('Resend All', { kind: 't', size: 'sm', icon: 'send', attrs: { 'data-act': 'resendall' } }) : '') + '</div>' +
        t.agents.map(function (aid) {
          var e = tskEmp(aid); if (!e) return '';
          var s = (t.wa || {})[aid] || 'Not Sent', er = (t.waErr || {})[aid];
          return '<div class="tsk-warow"><div class="grow"><b>' + esc(e.name) + '</b><span class="b2">' + (e.wa ? UI.phone(e.wa) : 'No WhatsApp number') + '</span>' + (s === 'Failed' ? '<span class="b2 tsk-bad">' + esc(er || 'The number could not be reached on WhatsApp') + '</span>' : '') + '</div>' + UI.status('wa', s) +
            '<div class="row gap4 tsk-waacts">' + (s !== 'Not Sent' && s !== 'Failed' ? UI.iconBtn('message', 'See the message', { size: 'sm', attrs: { 'data-act': 'msg', 'data-v': aid } }) : '') + (s === 'Template Sent' ? UI.btn('Agent replies', { kind: 't', size: 'sm', title: 'Sample: play out the agent replying', attrs: { 'data-act': 'reply', 'data-v': aid } }) : '') + (canWa ? UI.btn('Resend', { kind: 'o', size: 'sm', attrs: { 'data-act': 'resend', 'data-v': aid } }) : '') + '</div></div>';
        }).join('') + (f.agents.some(function (a) { return t.agents.indexOf(a) < 0; }) ? '<p class="b2">New agents get the template when you save.</p>' : '') + '</div>';
    }
    html += '<div class="ovl">Task info</div><div class="grid g2 tsk-g">' +
      UI.input({ key: 'name', label: 'Task Name', required: true, value: f.name, full: true, readonly: ro, error: err.name, attrs: ro ? { 'data-f': 'name' } : { 'data-f': 'name', autofocus: '' } }) +
      UI.dateTimeField({ key: 'at', label: 'Scheduled At', required: true, value: f.at || '', step: 15, disabled: ro, error: err.at, help: !t && f.at && f.at < NOW() ? 'This is in the past. Check the day and time.' : '', attrs: { 'data-f': 'at' } }) +
      UI.select({ key: 'type', label: 'Task Type', required: true, options: LISTS.taskTypes.indexOf(f.type) < 0 && f.type ? LISTS.taskTypes.concat([f.type]) : LISTS.taskTypes, value: f.type, disabled: ro, attrs: { 'data-f': 'type' } }) +
      UI.select({ key: 'status', label: 'Status', required: true, options: LISTS.taskStatus, value: f.status, disabled: ro, full: true, attrs: { 'data-f': 'status' } }) +
      UI.textarea({ key: 'note', label: 'Note', rows: 3, value: f.note, readonly: ro, attrs: { 'data-f': 'note' } }) + '</div>';
    html += '<div class="ovl">Voice notes</div><div class="tsk-voice">' +
      (canEdit ? (rec ? '<div class="tsk-rec" role="status"><span class="tsk-dot"></span><span class="grow">Recording...' + (rec.fake ? ' <span class="faint b2">(no microphone here, a sample sound is recorded)</span>' : '') + '</span>' + UI.btn('Stop (' + tskClock(rec.sec) + ')', { kind: 'err', size: 'sm', icon: 'player-stop', attrs: { 'data-act': 'stop', 'data-rec': '1' } }) + '</div>' : UI.btn('Record Voice Note', { kind: 'o', size: 'sm', icon: 'microphone', attrs: { 'data-act': 'record' } })) : '') +
      (f.voice.length ? '<div class="tsk-vlist">' + f.voice.map(function (v, k) { return '<div class="tsk-vrow">' + i('microphone', 'tsk-vic') + '<div class="grow"><b>Voice note ' + (k + 1) + '</b><span class="b2">' + tskClock(v.len) + (v.at ? ' · ' + UI.fmt.dateTime(v.at) : '') + '</span><audio controls preload="none" src="' + (v.url || tskWav(v.id, v.len)) + '"></audio></div>' + (canEdit ? UI.iconBtn('trash', 'Delete this voice note', { size: 'sm', attrs: { 'data-act': 'delvoice', 'data-v': v.id } }) : '') + '</div>'; }).join('') + '</div>' : '<p class="b2 faint">No voice notes.</p>') + '</div>';
    html += '<div class="ovl">Photos</div>' + (canEdit ? '<div class="tsk-dz"></div>' : '') +
      (f.photos.length ? '<div class="tsk-photos">' + f.photos.map(function (p, k) { return '<figure><button type="button" class="tsk-ph" data-act="viewphoto" data-v="' + k + '"><img src="' + tskPhoto(p, k) + '" alt="' + esc(p.caption || p.name) + '"></button>' + (canEdit ? '<input class="tsk-cap" data-cap="' + k + '" value="' + esc(p.caption || '') + '" placeholder="Caption (optional)" maxlength="120" aria-label="Caption for photo ' + (k + 1) + '">' : '<figcaption>' + esc(p.caption || p.name) + '</figcaption>') + (canEdit ? '<button type="button" class="tsk-x tsk-phx" data-act="delphoto" data-v="' + k + '" aria-label="Remove ' + esc(p.name) + '">' + i('x') + '</button>' : '') + '</figure>'; }).join('') + '</div>' : '<p class="b2 faint">No photos.</p>');
    if (t) html += '<p class="b2 faint">Created ' + UI.fmt.dateTime(t.created) + (t.by ? ' by ' + esc(t.by) : '') + '.</p>';
    return html + '</div>';
  }
  function draw() {
    dr.setBody(body);
    var ab = dr.body.querySelector('[data-tsk-agents]');
    if (ab) UI.staffPicker(ab, { key: 'agents', label: 'Employees (Agents)', source: 'employees', multi: true, values: f.agents.slice(), required: true, error: err.agents, title: 'Choose agents', placeholder: 'Choose agents', full: true,
      onChange: function (v) { readFields(); f.agents = (v || []).slice(); if (f.agents.length) delete err.agents; } });
    var bb = dr.body.querySelector('[data-tsk-bk]');
    if (bb) UI.bookingPicker(bb, { key: 'booking', label: 'Booking (optional)', value: f.booking || '', placeholder: 'Choose a booking', filter: function (x) { return x.status !== 'Cancelled'; },
      onChange: function (code, x) {
        readFields(); f.booking = code || '';
        if (x && !t) { if (!f.at) f.at = x.start; if (!f.name) f.name = 'Deliver ' + carModel(x.car) + ' ' + x.car.plate + ' to ' + tskFirst(x.cust.name); if (f.type === 'General') f.type = taskTypeFor(x, 'start'); if (!f.note && x.delNote) f.note = x.delNote; }
        draw();
      } });
    var dz = dr.body.querySelector('.tsk-dz');
    if (dz) UI.dropzone(dz, { accept: 'image/*', multiple: true, camera: true, icon: 'photo-plus', label: 'Add Photos', hint: 'Drop pictures here, choose them or paste with Ctrl+V.', onFiles: function (files) {
      Promise.all(files.map(function (fl) { return UI.readImage(fl, { max: 1400 }).catch(function () { return null; }); })).then(function (list) {
        var ok = list.filter(function (p) { return p && /^image\//.test(p.type); });
        ok.forEach(function (p) { f.photos.push({ name: p.name, dataUrl: p.dataUrl, size: p.size }); });
        if (ok.length < files.length) UI.toast(plural(files.length - ok.length, 'file') + ' could not be read as a picture.', { tone: 'warn' });
        if (ok.length) UI.toast(plural(ok.length, 'photo') + ' added. Save to keep them.', { tone: 'info', ms: 2200 });
        draw();
      });
    } });
  }
  function readFields() {
    dr.body.querySelectorAll('[data-f]').forEach(function (el) { var k = el.getAttribute('data-f'); f[k] = k === 'at' ? (el.value ? UI.parseDate(el.value) || new Date(el.value) : null) : el.value; });
    dr.body.querySelectorAll('[data-cap]').forEach(function (el) { var p = f.photos[+el.getAttribute('data-cap')]; if (p && (p.caption || '') !== el.value) f.photos[+el.getAttribute('data-cap')] = Object.assign({}, p, { caption: el.value }); });
    if (String(f.name || '').trim()) delete err.name; if (f.at && !isNaN(f.at)) delete err.at; if (f.agents.length) delete err.agents;
  }
  function stopRec(keep) {
    if (!rec) return;
    clearInterval(rec.timer);
    var r = rec; rec = null;
    var finish = function (url) { if (keep !== false) { var vid = 'vn-' + Date.now().toString(36); f.voice.push({ id: vid, len: Math.max(1, r.sec), at: NOW(), url: url || tskWav(vid, Math.max(1, r.sec)) }); UI.toast('Voice note added. Save to keep it.', { tone: 'info', ms: 2000 }); } if (!dr.closed) draw(); };
    if (r.mr) { r.mr.onstop = function () { try { r.stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) { /* ignore */ } finish(r.chunks.length ? URL.createObjectURL(new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' })) : null); }; try { r.mr.stop(); } catch (e) { finish(null); } }
    else finish(null);
  }
  function startRec() {
    readFields();
    var go = function (o) {
      rec = Object.assign({ sec: 0, chunks: [] }, o);
      rec.timer = setInterval(function () { if (!rec) return; rec.sec++; var b = dr.body.querySelector('[data-rec] span'); if (b) b.textContent = 'Stop (' + tskClock(rec.sec) + ')'; if (rec.sec >= 300) stopRec(); }, 1000);
      draw();
    };
    var fake = function () { go({ fake: true }); };
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { fake(); return; }
      var settled = false, tmo = setTimeout(function () { if (!settled) { settled = true; fake(); } }, 2500);
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        if (settled) { stream.getTracks().forEach(function (tr) { tr.stop(); }); return; }
        settled = true; clearTimeout(tmo);
        var mr = new MediaRecorder(stream), o = { mr: mr, stream: stream };
        mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) rec && rec.chunks.push(ev.data); };
        mr.start(); go(o);
      }).catch(function () { if (!settled) { settled = true; clearTimeout(tmo); fake(); } });
    } catch (e) { fake(); }
  }
  function save() {
    readFields(); err = {};
    if (!f.agents.length) err.agents = 'Choose at least one agent.';
    if (!String(f.name).trim()) err.name = 'Type the task name.';
    if (!f.at || isNaN(f.at)) err.at = 'Choose the date and time.';
    if (Object.keys(err).length) { draw(); UI.toast('Fill in the fields marked in red.', { tone: 'warn' }); return false; }
    if (rec) stopRec();
    var data = { name: String(f.name).trim(), at: f.at, type: f.type, status: f.status, note: f.note, agents: f.agents.slice(), booking: f.booking || null, voice: f.voice.slice(), photos: f.photos.slice() };
    var added;
    if (t) {
      added = f.agents.filter(function (a) { return t.agents.indexOf(a) < 0; });
      var wa = {}; f.agents.forEach(function (a) { wa[a] = (t.wa || {})[a] || 'Not Sent'; }); data.wa = wa;
      DB.update('tasks', t, data, { text: DB.actor() + ' changed task "' + data.name + '"' });
      UI.toast('Task saved');
    } else {
      added = f.agents.slice();
      var w0 = {}; f.agents.forEach(function (a) { w0[a] = 'Not Sent'; });
      t = DB.add('tasks', Object.assign(data, { id: 'task-' + Date.now().toString(36), wa: w0, created: NOW(), by: DB.actor() }), { first: true, text: DB.actor() + ' created task "' + data.name + '"' });
      UI.toast('Task created');
    }
    if (added.length && can('tasks.send_whatsapp')) {
      var r = tskSend(t, added, true), id0 = t.id;
      if (r.sent) UI.toast('WhatsApp template sent to ' + plural(r.sent, 'agent') + (r.failed ? ', ' + r.failed + ' failed' : '') + '. When they reply, the details go out.', { tone: r.failed ? 'warn' : 'ok' });
      var first = added.filter(function (a) { return (DB.get('tasks', id0).wa || {})[a] === 'Template Sent'; })[0];
      if (first) setTimeout(function () { tskReply(id0, first, d0); }, 9000);
    }
    if (onDone) onDone(t);
  }
  var dr = UI.drawer({
    title: title, subtitle: t ? t.name : (pb ? 'For booking ' + pb.code : 'A job for your field agents'), width: 640,
    body: '',
    foot: canEdit ? [{ label: 'Cancel', kind: 'o' }, { label: t ? 'Save Changes' : 'Create Task', icon: 'check', onClick: save }] : [{ label: 'Close', kind: 'o' }],
    dirty: function () { if (!canEdit) return false; readFields(); return JSON.stringify(f) !== start || !!rec; },
    onClose: function () { if (rec) stopRec(false); if (onDone) onDone(null, true); }
  });
  draw();
  var off = on('data', function (p) { if (dr.closed) { off(); return; } if (t && p && p.coll === 'tasks' && p.rec === t) { readFields(); draw(); } });
  dr.body.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
    if (a === 'openbooking') { if (f.booking) API.openBooking(f.booking); }
    else if (a === 'resend') { readFields(); tskSend(t, [v]); var id1 = t.id; if ((t.wa || {})[v] === 'Template Sent') setTimeout(function () { tskReply(id1, v, d0); }, 9000); }
    else if (a === 'resendall') { readFields(); tskSend(t, t.agents.slice()); }
    else if (a === 'reply') { readFields(); tskReply(t.id, v); }
    else if (a === 'msg') { var e = tskEmp(v), s = (t.wa || {})[v]; tskMessage(t, e, s === 'Details Sent' ? 'details' : 'template'); }
    else if (a === 'record') startRec();
    else if (a === 'stop') { readFields(); stopRec(); }
    else if (a === 'delvoice') {
      readFields(); var k = f.voice.map(function (x) { return x.id; }).indexOf(v); if (k < 0) return;
      var gone = f.voice.splice(k, 1)[0]; draw();
      UI.toast('Voice note deleted', { action: { label: 'Undo', run: function () { if (dr.closed) return; f.voice.splice(Math.min(k, f.voice.length), 0, gone); draw(); } } });
    }
    else if (a === 'delphoto') { readFields(); var gp = f.photos.splice(+v, 1)[0]; draw(); UI.toast('Photo removed', { action: { label: 'Undo', run: function () { if (dr.closed) return; f.photos.splice(+v, 0, gp); draw(); } } }); }
    else if (a === 'viewphoto') { readFields(); var p = f.photos[+v]; UI.dialog({ title: p.caption || p.name, width: 'lg', body: '<img class="tsk-big" src="' + tskPhoto(p, +v) + '" alt="' + esc(p.name) + '">', buttons: [{ label: 'Close' }] }); }
  });
  dr.body.addEventListener('input', function (ev) { if (ev.target.matches('[data-f="name"]') && t) dr.setTitle(title, ev.target.value || t.name); });
  /* a new task set in the past: say so gently (it still saves) */
  dr.body.addEventListener('change', function (ev) {
    if (t || !ev.target.matches('[data-f="at"]')) return;
    var r = ev.target.closest('[data-ui-dtf]'), at = ev.target.value ? UI.parseDate(ev.target.value) : null, h = r && r.querySelector('.help');
    if (!r) return;
    if (at && at < NOW()) { if (!h) { h = document.createElement('span'); h.className = 'help'; r.appendChild(h); } h.textContent = 'This is in the past. Check the day and time.'; }
    else if (h) h.remove();
  });
  return dr;
}
function tskClock(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

API.newTask = function (prefill) { return tskDrawer(null, prefill || {}); };
API.openTask = function (id) { return tskDrawer(id); };

/* ---------------- auto-assign ----------------
   d.autoRules [{id, kind: 'car'|'location'|'every', car, loc, on, staff: [employee ids]}]. When a booking becomes
   Agreement Signed, its pick-up and return tasks are made: the car's rule first, then the location's rule (the pick-up
   location for the pick-up, the drop-off location for the return) or that location's agents (Settings > Our
   locations), then the rule for every booking. Bookings that already have tasks or have ended are left alone. */
DATA_INIT.push(function (d, b) {
  if (d.autoRules) return;
  var emp = d.employees.filter(function (e) { return e.active !== false; }), car = d.cars.filter(function (c) { return c.fleet === 'Active'; })[1];
  var l0 = (b.locations || [])[0];
  d.autoRules = [];
  if (car && emp[2]) d.autoRules.push({ id: 'aar-1', kind: 'car', car: car.id, loc: null, on: true, staff: [emp[2].id] });
  if (l0 && emp[1]) d.autoRules.push({ id: 'aar-2', kind: 'location', car: null, loc: l0.id, on: b.id !== 'bara', staff: [emp[1].id] });
  if (b.id !== 'padi' && emp[0]) d.autoRules.push({ id: 'aar-3', kind: 'every', car: null, loc: null, on: true, staff: emp.slice(0, 2).map(function (e) { return e.id; }) });
});
function tskLocOf(x, which) {
  var start = which !== 'end', opt = start ? x.startOpt : x.endOpt;
  if (placeOfOpt(opt) || /client location$/.test(opt || '')) return null;
  var name = start ? x.pickup : x.drop;
  return (B().locations || []).filter(function (l) { return l.n === name; })[0] || null;
}
function tskActive(ids) { return (ids || []).filter(function (id) { var e = tskEmp(id); return e && e.active !== false; }); }
/* who gets one handover of a booking: {staff, why} or null */
function tskRuleFor(x, which) {
  var d = D(), rules = (d.autoRules || []).filter(function (r) { return r.on && tskActive(r.staff).length; }), loc = tskLocOf(x, which), r;
  if ((r = rules.filter(function (z) { return z.kind === 'car' && z.car === x.car.id; })[0])) return { staff: tskActive(r.staff), why: 'rule for this car' };
  if (loc && (r = rules.filter(function (z) { return z.kind === 'location' && z.loc === loc.id; })[0])) return { staff: tskActive(r.staff), why: 'rule for ' + loc.n };
  if (loc && tskActive(loc.agents).length) return { staff: tskActive(loc.agents), why: 'agents of ' + loc.n };
  if ((r = rules.filter(function (z) { return z.kind === 'every'; })[0])) return { staff: tskActive(r.staff), why: 'rule for every booking' };
  return null;
}
function tskHandoverName(x, what) { return x.code + ' ' + what + ' · ' + carModel(x.car) + ' · ' + x.cust.name; }
/* the plan for a booking: [{which, what, at, type, staff, why}] plus a reason when nothing would be made automatically */
function tskPlan(x) {
  var has = D().tasks.filter(function (t) { return t.booking === x.code; }).length, ended = x.end < NOW();
  var plan = [['start', 'pick-up', x.start], ['end', 'return', x.end]].map(function (w) { var r = tskRuleFor(x, w[0]); return { which: w[0], what: w[1], at: w[2], type: taskTypeFor(x, w[0]), staff: r ? r.staff : [], why: r ? r.why : '' }; });
  return { plan: plan, has: has, ended: ended };
}
function tskMake(x, items, auto) {
  var made = [];
  items.forEach(function (p) {
    if (!p.staff.length) return;
    var w0 = {}; p.staff.forEach(function (a) { w0[a] = 'Not Sent'; });
    var t = DB.add('tasks', { id: 'task-' + Date.now().toString(36) + p.which, name: tskHandoverName(x, p.what), type: p.type, at: p.at, status: 'Pending', agents: p.staff.slice(), wa: w0, booking: x.code,
      note: auto ? 'Assigned automatically (' + p.why + ').' : (p.why ? 'Made from the booking (' + p.why + ').' : 'Made from the booking.'), voice: [], photos: [], created: NOW(), by: auto ? 'Auto-assign' : DB.actor() }, { first: true, text: (auto ? 'Auto-assign' : DB.actor()) + ' made the ' + p.what + ' task of booking ' + x.code });
    tskSend(t, p.staff.slice(), true); made.push(t);
  });
  return made;
}
function tskAutoAssign(x) {
  if (!x || !x.car) return [];
  var pl = tskPlan(x); if (pl.has || pl.ended) return [];
  var made = tskMake(x, pl.plan, true);
  if (made.length) {
    var who = []; made.forEach(function (t) { t.agents.forEach(function (a) { var e = tskEmp(a); if (e && who.indexOf(e.name) < 0) who.push(e.name); }); });
    UI.toast('Agreement signed: ' + (made.length === 2 ? 'pick-up and return tasks' : made[0].name.indexOf('pick-up') > 0 ? 'the pick-up task' : 'the return task') + ' made for ' + x.code + ' and given to ' + who.join(', ') + '.', { tone: 'ok', action: { label: 'See tasks', run: function () { go('tasks', { q: x.code }); } } });
    DB.notify({ icon: 'checklist', tone: 'info', title: 'Tasks made by auto-assign', text: x.code + ': ' + made.map(function (t) { return t.type; }).join(', ') + '.', page: 'tasks', params: { q: x.code } });
  }
  return made;
}
on('data', function (p) {
  if (!p || p.coll !== 'bookings' || !p.rec) return;
  var signed = p.op === 'add' ? p.rec.status === 'Agreement Signed' : (p.changes || []).some(function (c) { return c.f === 'status' && c.to === 'Agreement Signed'; });
  if (signed) setTimeout(function () { tskAutoAssign(p.rec); }, 0);
});

/* the Auto-assign dialog */
function tskAutoDialog() {
  var d = D(), canEdit = can('tasks.assign') && can('tasks.edit'), add = { kind: 'car', target: '', staff: [] };
  var title = function (r) { var c = r.car ? carById(r.car) : null, l = r.loc ? (B().locations || []).filter(function (z) { return z.id === r.loc; })[0] : null; return r.kind === 'car' ? (c ? c.plate + ' · ' + carModel(c) : 'A car no longer here') : r.kind === 'location' ? (l ? l.n : 'A location no longer here') : 'Every booking'; };
  var dl = UI.dialog({ title: 'Auto-assign', width: 'lg', body: function (el) {
    var rules = (d.autoRules || []).slice().sort(function (a, b) { return ['car', 'location', 'every'].indexOf(a.kind) - ['car', 'location', 'every'].indexOf(b.kind); });
    var hasEvery = rules.some(function (r) { return r.kind === 'every'; }), used = function (kind, id) { return rules.some(function (r) { return r.kind === kind && (kind === 'car' ? r.car : r.loc) === id; }); };
    if (add.kind === 'every' && hasEvery) add.kind = 'car';
    el.innerHTML = '<p class="b2">When a customer signs the agreement, the booking\'s pick-up and return tasks are made and given to the staff below, who each get the usual WhatsApp task message. A car\'s rule comes first, then the location\'s (the pick-up location for the pick-up, the drop-off location for the return), then the rule for every booking. Locations\' agents can also be set in Settings, Our locations. Bookings with tasks already are left alone.</p>' +
      (!hasEvery ? UI.alert('There is no rule for every booking, so a booking no car or location rule fits is not assigned to anyone.', 'pri') : '') +
      (!canEdit ? UI.alert('You can see the rules. Changing them needs "Assign tasks" and "Edit tasks".', 'warn', { icon: 'lock' }) : '') +
      '<div class="tsk-rules">' + (rules.length ? rules.map(function (r) {
        return '<div class="tsk-rule' + (r.on ? '' : ' off') + '"><label class="sw" title="' + (r.on ? 'Switch off' : 'Switch on') + '"><input type="checkbox" data-ar-on="' + r.id + '"' + (r.on ? ' checked' : '') + (canEdit ? '' : ' disabled') + ' aria-label="Rule ' + esc(title(r)) + ' on"><span></span></label>' +
          '<div class="tsk-rule-t"><b>' + esc(title(r)) + '</b>' + UI.chip(r.kind === 'car' ? 'Car' : r.kind === 'location' ? 'Location' : 'Every booking', r.kind === 'car' ? 'pri' : r.kind === 'location' ? 'info' : 'grey') + '</div>' +
          '<div class="tsk-rule-s" data-ar-staff="' + r.id + '"></div>' + (canEdit ? UI.iconBtn('trash', 'Delete rule', { size: 'sm', attrs: { 'data-ar-del': r.id } }) : '') + '</div>';
      }).join('') : '<p class="b2 faint">No rules yet.</p>') + '</div>' +
      (canEdit ? '<div class="tsk-addrule"><div class="h6">Add a rule</div><div class="tsk-addrow">' +
        UI.select({ key: 'ar-kind', label: 'For', value: add.kind, options: [{ value: 'car', label: 'One car' }, { value: 'location', label: 'A location' }].concat(hasEvery ? [] : [{ value: 'every', label: 'Every booking' }]) }) +
        (add.kind === 'car' ? '<div class="tsk-ar-car"></div>' : add.kind === 'location' ? UI.select({ id: 'tsk-arloc', key: 'ar-loc', label: 'Location', placeholder: 'Choose', value: add.target || '', options: (B().locations || []).map(function (l) { var u = used('location', l.id); return { value: l.id, label: l.n + (u ? ' (has a rule)' : ''), disabled: !!u }; }) }) : '') +
        '<div class="tsk-ar-new"></div>' + UI.btn('Add', { icon: 'plus', attrs: { 'data-ar-add': '1' } }) + '</div></div>' : '');
    rules.forEach(function (r) {
      UI.staffPicker(el.querySelector('[data-ar-staff="' + r.id + '"]'), { key: 'st-' + r.id, label: '', source: 'employees', multi: true, values: r.staff.slice(), disabled: !canEdit, me: false,
        onChange: function (ids) { if (!ids.length) { UI.toast('A rule needs at least one staff member. Delete the rule instead.', { tone: 'warn' }); dl.refresh(); return; } DB.update('autoRules', r, { staff: ids.slice() }, { where: 'Task', text: me().name + ' changed who the auto-assign rule for ' + title(r) + ' gives tasks to' }); UI.toast('Rule changed'); } });
    });
    if (canEdit) {
      var cp = el.querySelector('.tsk-ar-car');
      if (cp) UI.carPicker(cp, { key: 'ar-car', label: 'Car', value: add.target || '', hideInactive: true, cars: d.cars.filter(function (c) { return c.fleet !== 'Sold' && !used('car', c.id); }), onChange: function (id) { add.target = id || ''; } });
      UI.staffPicker(el.querySelector('.tsk-ar-new'), { key: 'ar-staff', label: 'Staff', source: 'employees', multi: true, values: add.staff.slice(), me: false, onChange: function (ids) { add.staff = ids.slice(); } });
    }
  }, buttons: [{ label: 'Close', kind: 'o' }] });
  dl.el.addEventListener('change', function (ev) {
    var t = ev.target, id;
    if ((id = t.getAttribute('data-ar-on'))) { var r = byId(d.autoRules, id); DB.update('autoRules', r, { on: t.checked }, { where: 'Task', text: me().name + (t.checked ? ' switched on' : ' switched off') + ' the auto-assign rule for ' + title(r) }); UI.toast(t.checked ? 'Rule switched on' : 'Rule switched off'); dl.refresh(); }
    else if (t.matches('[data-key="ar-kind"]')) { add.kind = t.value; add.target = ''; dl.refresh(); }
    else if (t.matches('[data-key="ar-loc"]')) add.target = t.value;
  });
  dl.el.addEventListener('click', function (ev) {
    var x;
    if ((x = ev.target.closest('[data-ar-del]'))) { var r = byId(d.autoRules, x.getAttribute('data-ar-del')); UI.confirm({ title: 'Delete the rule for ' + title(r) + '?', text: 'New bookings stop being given to these staff by this rule. Tasks already made stay.', ok: 'Delete', danger: true }).then(function (y) { if (!y) return; DB.remove('autoRules', r, { where: 'Task', text: me().name + ' deleted the auto-assign rule for ' + title(r) }); UI.toast('Rule deleted'); dl.refresh(); }); }
    else if (ev.target.closest('[data-ar-add]')) {
      if (add.kind !== 'every' && !add.target) { UI.toast(add.kind === 'car' ? 'Choose the car.' : 'Choose the location.', { tone: 'warn' }); return; }
      if (!add.staff.length) { UI.toast('Choose at least one staff member.', { tone: 'warn' }); return; }
      var rec = { id: 'aar-' + Date.now().toString(36), kind: add.kind, car: add.kind === 'car' ? add.target : null, loc: add.kind === 'location' ? add.target : null, on: true, staff: add.staff.slice() };
      DB.add('autoRules', rec, { where: 'Task', text: me().name + ' added an auto-assign rule for ' + title(rec) });
      add = { kind: 'car', target: '', staff: [] }; UI.toast('Rule added'); dl.refresh();
    }
  });
  return dl;
}

/* Make pick-up and return tasks for one booking (#page=tasks&action=handover&booking=KLT-00412) */
function tskHandoverDialog(code) {
  var x = code ? findBooking(code) : null, items = null;
  if (code && !x) UI.toast('There is no booking ' + code + '. Choose one below.', { tone: 'warn' });
  var build = function () { if (!x) { items = null; return; } items = tskPlan(x).plan.map(function (p) { return Object.assign({ on: true }, p); }); };
  build();
  var dl = UI.dialog({ title: 'Make pick-up and return tasks', width: 'md', body: function (el) {
    var info = x ? tskPlan(x) : null;
    el.innerHTML = '<div class="col gap12"><div class="tsk-hbk"></div>' + (x ? (info.has ? UI.alert('This booking already has ' + plural(info.has, 'task') + '. Auto-assign leaves it alone; you can still make these.', 'warn') : '') + (info.ended ? UI.alert('This booking has ended.', 'warn') : '') +
      items.map(function (p, k) {
        return '<div class="tsk-hrow"><label class="cb"><input type="checkbox" data-hi-on="' + k + '"' + (p.on ? ' checked' : '') + '><span class="box">' + i('check') + '</span><span><b>' + (p.which === 'start' ? 'Pick-up' : 'Return') + '</b></span></label>' +
          '<div class="b2">' + esc(p.type) + ' · ' + UI.fmt.dateTime(p.at) + '</div><div class="tsk-hst" data-hi-st="' + k + '"></div><div class="b2 faint">' + (p.why ? 'From the ' + esc(p.why) + '.' : 'No rule fits: choose the staff yourself.') + '</div></div>';
      }).join('') : '<p class="b2">Choose the booking first.</p>') + '</div>';
    UI.bookingPicker(el.querySelector('.tsk-hbk'), { key: 'hb', label: 'Booking', value: x ? x.code : '', required: true, filter: function (b) { return b.status !== 'Cancelled'; }, onChange: function (c) { x = c ? findBooking(c) : null; build(); dl.refresh(); } });
    (items || []).forEach(function (p, k) { UI.staffPicker(el.querySelector('[data-hi-st="' + k + '"]'), { key: 'hs' + k, label: 'Staff', source: 'employees', multi: true, values: p.staff.slice(), me: false, onChange: function (ids) { p.staff = ids.slice(); } }); });
  }, buttons: [{ label: 'Cancel', kind: 'o' }, { label: 'Make tasks', icon: 'check', onClick: function () {
    if (!x) { UI.toast('Choose the booking.', { tone: 'warn' }); return false; }
    var pick = items.filter(function (p) { return p.on; });
    if (!pick.length) { UI.toast('Tick the pick-up, the return or both.', { tone: 'warn' }); return false; }
    if (pick.some(function (p) { return !p.staff.length; })) { UI.toast('Choose at least one staff member for each task.', { tone: 'warn' }); return false; }
    var made = tskMake(x, pick, false);
    UI.toast(plural(made.length, 'task') + ' made for ' + x.code + '. The staff got the WhatsApp task message.', { tone: 'ok' });
  } }] });
  dl.el.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-hi-on'); if (k != null) items[+k].on = ev.target.checked; });
  return dl;
}
API.makeHandoverTasks = function (code) { return tskHandoverDialog(code); };

/* WhatsApp status dots for an agent */
var TSK_DOT = { 'Not Sent': 'grey', 'Template Sent': 'info', 'Reply Received': 'warn', 'Details Sent': 'ok', 'Failed': 'bad' };
function tskAgentDots(t) {
  return t.agents.length ? '<div class="tsk-dots">' + t.agents.map(function (a) { var e = tskEmp(a), s = (t.wa || {})[a] || 'Not Sent'; return '<span class="tsk-ad" title="' + esc((e ? e.name : a) + ': WhatsApp ' + s) + '"><i class="tsk-sd ' + (TSK_DOT[s] || 'grey') + '"></i>' + esc(e ? e.name : a) + '</span>'; }).join('') + '</div>' : '<span class="faint b2">No agents</span>';
}

/* ---------------- the list page ---------------- */
PAGES['tasks'] = {
  title: 'Tasks',
  search: [{ label: 'New Task', icon: 'clipboard-plus', hint: 'Tasks', run: function () { API.newTask(); } }, { label: 'Auto-assign rules', icon: 'robot', hint: 'Tasks', run: function () { tskAutoDialog(); } }, { label: 'Make pick-up and return tasks', icon: 'calendar-plus', hint: 'Tasks', run: function () { tskHandoverDialog(); } }],
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data, p = ctx.params || {};
    st.f = st.f || {}; st.size = st.size || 10;
    if (p.q && st.qAddr !== p.q) { st.f.q = p.q; st.qAddr = p.q; }
    var canNew = ctx.can('tasks.create');
    root.innerHTML = '<div class="pg-h"><div><h1>Tasks</h1><p>Jobs for your field agents: deliveries, returns and general jobs. Agents get the details on WhatsApp.</p></div><div class="acts">' +
      UI.btn('Auto-assign', { kind: 'o', icon: 'robot', cls: 'tsk-wide', attrs: { 'data-act': 'auto' } }) + (canNew ? UI.btn('Pick-up and return tasks', { kind: 'o', icon: 'calendar-plus', cls: 'tsk-wide', attrs: { 'data-act': 'handover' } }) : '') + UI.iconBtn('dots-vertical', 'More task actions', { cls: 'tsk-narrow', attrs: { 'data-act': 'hmenu' } }) + (canNew ? UI.btn('New Task', { icon: 'plus', attrs: { 'data-act': 'new' } }) : '') + '</div></div>' +
      '<div class="card tsk-card"><div class="tsk-flt"></div><div class="tsk-tbl"></div></div>';
    var cars = d.cars.filter(function (c) { return c.fleet !== 'Sold'; });
    var rowsSel = '<label class="row gap6 b2 tsk-rows">Rows<span class="inp"><select data-act="rows" aria-label="Rows per page">' + UI.options([10, 25, 50], st.size) + '</select></span></label>';
    /* search and Status always show; the rest sit behind the bar's own Filters button (tasks.css) */
    UI.filters(root.querySelector('.tsk-flt'), { values: st.f,
      fields: [{ type: 'search', key: 'q', placeholder: 'Search tasks, booking, plate...' }, { type: 'select', key: 'status', label: 'Status', options: LISTS.taskStatus, all: 'Status: All' },
        { type: 'select', key: 'type', label: 'Type', options: LISTS.taskTypes, all: 'Type: All' }, { type: 'select', key: 'emp', label: 'Employee', options: d.employees.map(function (e) { return [e.id, e.name]; }), all: 'All Employees' },
        UI.carFilter({ key: 'car', all: 'All Cars', cars: cars }), { type: 'daterange', from: 'cFrom', to: 'cTo', label: 'Created At' }, { type: 'daterange', from: 'sFrom', to: 'sTo', label: 'Scheduled At' }],
      onChange: function () { tbl.setRows(rows()); }, extra: rowsSel });
    function rows() {
      var v = st.f, q = tidySearch(v.q || '').toLowerCase();
      var day = function (s, end) { var x = UI.parseDate(s); if (!x) return null; x.setHours(0, 0, 0, 0); return end ? x.getTime() + DAY : x.getTime(); };
      var cf = day(v.cFrom), ct = day(v.cTo, 1), sf = day(v.sFrom), stt = day(v.sTo, 1);
      return d.tasks.filter(function (t) {
        var x = tskBooking(t);
        if (v.status && t.status !== v.status) return false;
        if (v.type && t.type !== v.type) return false;
        if (v.emp && t.agents.indexOf(v.emp) < 0) return false;
        if (v.car && !(x && x.car.id === v.car)) return false;
        if (cf && t.created < cf) return false; if (ct && t.created >= ct) return false;
        if (sf && t.at < sf) return false; if (stt && t.at >= stt) return false;
        if (q) { var hay = [t.name, t.note, t.type, t.status, t.booking, x ? x.cust.name + ' ' + x.car.plate + ' ' + normPlate(x.car.plate) + ' ' + carName(x.car) : ''].concat(t.agents.map(function (a) { var e = tskEmp(a); return e ? e.name : ''; })).concat((t.photos || []).map(function (ph) { return ph.caption || ''; })).join(' ').toLowerCase(); if (!UI.wordsMatch(hay, q) && !(t.booking && matchBookingCode(q, t.booking))) return false; }
        return true;
      }).sort(tskOrder);
    }
    var canEdit = ctx.can('tasks.edit'), canDel = ctx.can('tasks.delete');
    var waChips = function (t) { return t.agents.length ? '<div class="tsk-wachips">' + t.agents.map(function (a) { var e = tskEmp(a), s = (t.wa || {})[a] || 'Not Sent'; return UI.status('wa', s, null, { sm: true, attrs: { title: (e ? e.name : a) + ': ' + s } }); }).join('') + '</div>' : '<span class="faint">-</span>'; };
    var agentsOf = function (t) { return t.agents.length ? t.agents.map(function (a) { var e = tskEmp(a); return '<div class="nw">' + esc(e ? e.name : a) + '</div>'; }).join('') : '<span class="faint">No agents</span>'; };
    var acts = function (t) { return '<div class="row gap4 tsk-acts" data-stop>' + (canEdit ? UI.iconBtn('pencil', 'Edit', { size: 'sm', attrs: { 'data-act': 'open', 'data-v': t.id } }) : UI.iconBtn('eye', 'View details', { size: 'sm', attrs: { 'data-act': 'open', 'data-v': t.id } })) + (canDel ? UI.iconBtn('trash', 'Delete', { size: 'sm', attrs: { 'data-act': 'del', 'data-v': t.id } }) : '') + '</div>'; };
    var tbl = UI.table(root.querySelector('.tsk-tbl'), {
      columns: [
        { key: 'name', label: 'Task', sort: true, width: 240, render: function (t) { return '<div class="tsk-name"><b>' + esc(t.name) + '</b>' + (t.note ? '<span class="tsk-note">' + esc(t.note) + '</span>' : '') + ((t.voice || []).length || (t.photos || []).length ? '<span class="tsk-att">' + ((t.voice || []).length ? i('microphone') + t.voice.length : '') + ((t.photos || []).length ? i('photo') + t.photos.length : '') + '</span>' : '') + '</div>'; } },
        { key: 'type', label: 'Type', sort: true, width: 150, render: function (t) { return '<span class="tsk-type">' + esc(t.type) + '</span>'; } },
        { key: 'at', label: 'Scheduled', sort: true, nowrap: true, render: function (t) { var s = tskWhen(t.at).split(' / '); return '<span class="nw">' + s[0] + '</span><br><span class="b2">' + s[1] + '</span>'; } },
        { key: 'status', label: 'Status', sort: true, render: function (t) { return UI.status('task', t.status); } },
        { key: 'agents', label: 'Agents', render: agentsOf },
        { key: 'wa', label: 'WhatsApp', render: waChips },
        { key: 'booking', label: 'Booking', sort: true, render: function (t) { var x = t.booking && tskBooking(t); return x ? '<div class="tsk-bk"><button type="button" class="tsk-link" data-act="booking" data-v="' + t.booking + '">' + t.booking + '</button><span>' + esc(x.cust.name) + '</span><small class="nw">' + esc(x.car.plate) + ' · ' + esc(carModel(x.car)) + '</small></div>' : '<span class="faint">-</span>'; } },
        { key: 'acts', label: 'Actions', align: 'center', render: acts }
      ],
      rows: rows(), rowKey: 'id', density: 'compact', pageSize: st.size, pageSizes: [10, 25, 50], minWidth: 1060,
      onRowClick: function (t) { open(t.id); },
      card: function (t) { var s = tskWhen(t.at).split(' / '); return '<div class="tsk-c"><div class="row gap8"><b class="grow">' + esc(t.name) + '</b>' + UI.status('task', t.status) + '</div><div class="b2">' + i('clock') + ' ' + s[0] + ', ' + s[1] + ' · ' + esc(t.type) + '</div>' + tskAgentDots(t) + '</div>'; },
      empty: { icon: 'clipboard-off', title: 'No tasks found', text: d.tasks.length ? 'Try clearing the search or the filters.' : 'Create a task to send a job to your field agents.', action: d.tasks.length ? '' : (canNew ? UI.btn('New Task', { icon: 'plus', attrs: { 'data-act': 'new' } }) : '') }
    });
    function open(id) { ctx.setParams({ task: id }, true); tskDrawer(id, null, function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]task=/.test(location.hash)) ctx.setParams({}, true); }); }
    UI.on(root, 'click', '[data-act]', function (ev, el) {
      var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
      if (a === 'new') { tskDrawer(null, {}, function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]action=add(&|$)/.test(location.hash)) ctx.setParams({}, true); }); ctx.setParams({ action: 'add' }, true); }
      else if (a === 'auto') tskAutoDialog();
      else if (a === 'handover') tskHandoverDialog();
      else if (a === 'hmenu') UI.menu(el, [{ label: 'Auto-assign', icon: 'robot', onClick: function () { tskAutoDialog(); } }, { label: 'Pick-up and return tasks', icon: 'calendar-plus', disabled: !canNew, onClick: function () { tskHandoverDialog(); } }]);
      else if (a === 'open') open(v);
      else if (a === 'booking') ctx.api.openBooking(v);
      else if (a === 'del') {
        var t = byId(d.tasks, v); if (!t) return;
        UI.confirm({ title: 'Delete Task?', text: 'This action cannot be undone.', ok: 'Yes, Delete', danger: true }).then(function (y) { if (!y) return; DB.remove('tasks', t, { text: DB.actor() + ' deleted task "' + t.name + '"' }); UI.toast('Task deleted'); });
      }
    });
    UI.on(root, 'change', '[data-act="rows"]', function (ev, el) { st.size = +el.value; tbl.state.size = st.size; tbl.state.page = 1; tbl.refresh(); });
    ctx.on('data', function () { if (document.contains(root)) tbl.setRows(rows(), true); });
    /* address: action=add (pre-fill booking=), action=handover&booking=<code>, action=auto, task=<id> */
    var doneAdd = function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]action=/.test(location.hash)) ctx.setParams({}, true); };
    if (p.action === 'add' && !UI.top()) { var pre = {}; if (p.booking) pre.booking = p.booking; setTimeout(function () { if (!canNew) { UI.toast('Your login cannot create tasks.', { tone: 'warn' }); return; } tskDrawer(null, pre, doneAdd); }, 0); }
    else if (p.action === 'handover' && !UI.top()) setTimeout(function () { if (!canNew) { UI.toast('Your login cannot create tasks.', { tone: 'warn' }); return; } tskHandoverDialog(p.booking); ctx.setParams({}, true); }, 0);
    else if (p.action === 'auto' && !UI.top()) setTimeout(function () { tskAutoDialog(); ctx.setParams({}, true); }, 0);
    else if (p.task && !UI.top()) setTimeout(function () { tskDrawer(p.task, null, function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]task=/.test(location.hash)) ctx.setParams({}, true); }); }, 0);
  },
  onData: function () { /* the table follows the data through ctx.on('data') */ }
};

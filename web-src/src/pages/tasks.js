/* ===================================================================
   Page: Tasks (#page=tasks, #page=tasks&action=add, #page=tasks&task=<id>)   Owner: builder 4
   Inventory section 11. Jobs for field agents: list with filters, the task drawer (assignment, WhatsApp status,
   task info, voice notes, photos), delete. Agents get a WhatsApp template when they are assigned; when they reply,
   the full task details are sent (here the reply is played out in the sample after a few seconds, or by hand).
   Sets API.newTask(prefill) and API.openTask(id) so any page (Bookings > Assign Task, Schedules) opens the drawer.
   =================================================================== */

/* ---------------- small helpers ---------------- */
function tskBooking(t) { return t && t.booking ? findBooking(t.booking) : null; }
function tskWhen(dt) { if (!dt) return '-'; var h = dt.getHours(), m = dt.getMinutes(); return UI.fmt.date(dt) + ' / ' + String(h % 12 || 12).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'am' : 'pm'); }
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
      (which === 'details' && ((t.photos || []).length || (t.voice || []).length) ? '<div class="tsk-wa-att">' + (t.photos || []).map(function (p, k) { return '<img src="' + tskPhoto(p, k) + '" alt="' + esc(p.name) + '">'; }).join('') + (t.voice || []).map(function (v) { return '<span class="chip grey">' + i('microphone') + tskClock(v.len) + '</span>'; }).join('') + '</div>' : '') + '</div>',
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
    : { name: prefill.name || '', at: prefill.at || (pb ? pb.start : null), type: prefill.type || (pb ? (pb.deliv ? "Car delivery to client's location" : 'Car delivery from our location') : 'General'), status: 'Pending', note: prefill.note || (pb && pb.delNote ? pb.delNote : ''), agents: prefill.agents ? prefill.agents.slice() : [], booking: pb ? pb.code : '', voice: [], photos: [] };
  if (!t && pb && !f.name) f.name = 'Deliver ' + carModel(pb.car) + ' ' + pb.car.plate + ' to ' + tskFirst(pb.cust.name);
  var start = JSON.stringify(f), rec = null, err = {};
  var title = t ? (canEdit ? 'Edit Task' : 'Task') : 'New Task';

  function bookingLabel(x) { return x.code + ' · ' + x.cust.name + ' · ' + carModel(x.car) + ' ' + x.car.plate; }
  function body() {
    var x = f.booking ? findBooking(f.booking) : null, ro = !canEdit;
    var agents = f.agents.map(function (aid) { var e = tskEmp(aid); return e ? '<span class="tsk-agent">' + UI.avatar(e.name) + '<span>' + esc(e.name) + '</span>' + (canAssign ? '<button type="button" class="tsk-x" data-act="unagent" data-v="' + aid + '" aria-label="Remove ' + esc(e.name) + '">' + i('x') + '</button>' : '') + '</span>' : ''; }).join('');
    var html = '<div class="tsk-form">' +
      '<div class="ovl">Assignment</div>' +
      '<div class="inp full' + (err.agents ? ' bad' : '') + '"><label>Employees (Agents) <span class="ui-req">*</span></label><div class="tsk-agents">' + (agents || '<span class="faint b2">No agents yet</span>') + (canAssign ? '<button type="button" class="btn t sm" data-act="pickagent">' + i('user-plus') + 'Add agent</button>' : '') + '</div>' + (err.agents ? '<span class="ui-err">' + esc(err.agents) + '</span>' : '') + (!canAssign && canEdit ? '<span class="help">Your login cannot change who the task is given to.</span>' : '') + '</div>' +
      '<div class="inp full"><label>Booking (optional)</label><div class="tsk-bk">' + (ro ? '<span class="tsk-bkv">' + (x ? esc(bookingLabel(x)) : '-') + '</span>' : '<button type="button" class="tsk-bkbtn" data-act="pickbooking">' + (x ? '<span class="grow ellip">' + esc(bookingLabel(x)) + '</span>' : '<span class="grow faint">Select booking...</span>') + i('chevron-down') + '</button>' + (x ? UI.iconBtn('x', 'No booking', { size: 'sm', attrs: { 'data-act': 'nobooking' } }) : '')) + (x ? UI.iconBtn('external-link', 'Open the booking', { size: 'sm', attrs: { 'data-act': 'openbooking' } }) : '') + '</div></div>';
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
      UI.input({ key: 'at', label: 'Scheduled At', type: 'datetime-local', required: true, value: f.at ? UI.isoDateTime(f.at) : '', readonly: ro, error: err.at, attrs: { 'data-f': 'at' } }) +
      UI.select({ key: 'type', label: 'Task Type', required: true, options: LISTS.taskTypes, value: f.type, disabled: ro, attrs: { 'data-f': 'type' } }) +
      UI.select({ key: 'status', label: 'Status', required: true, options: LISTS.taskStatus, value: f.status, disabled: ro, full: true, attrs: { 'data-f': 'status' } }) +
      UI.textarea({ key: 'note', label: 'Note', rows: 3, value: f.note, readonly: ro, attrs: { 'data-f': 'note' } }) + '</div>';
    html += '<div class="ovl">Voice notes</div><div class="tsk-voice">' +
      (canEdit ? (rec ? '<div class="tsk-rec" role="status"><span class="tsk-dot"></span><span class="grow">Recording...' + (rec.fake ? ' <span class="faint b2">(no microphone here, a sample sound is recorded)</span>' : '') + '</span>' + UI.btn('Stop (' + tskClock(rec.sec) + ')', { kind: 'err', size: 'sm', icon: 'player-stop', attrs: { 'data-act': 'stop', 'data-rec': '1' } }) + '</div>' : UI.btn('Record Voice Note', { kind: 'o', size: 'sm', icon: 'microphone', attrs: { 'data-act': 'record' } })) : '') +
      (f.voice.length ? '<div class="tsk-vlist">' + f.voice.map(function (v, k) { return '<div class="tsk-vrow">' + i('microphone', 'tsk-vic') + '<div class="grow"><b>Voice note ' + (k + 1) + '</b><span class="b2">' + tskClock(v.len) + (v.at ? ' · ' + UI.fmt.dateTime(v.at) : '') + '</span><audio controls preload="none" src="' + (v.url || tskWav(v.id, v.len)) + '"></audio></div>' + (canEdit ? UI.iconBtn('trash', 'Delete this voice note', { size: 'sm', attrs: { 'data-act': 'delvoice', 'data-v': v.id } }) : '') + '</div>'; }).join('') + '</div>' : '<p class="b2 faint">No voice notes.</p>') + '</div>';
    html += '<div class="ovl">Photos</div>' + (canEdit ? '<div class="tsk-dz"></div>' : '') +
      (f.photos.length ? '<div class="tsk-photos">' + f.photos.map(function (p, k) { return '<figure><button type="button" class="tsk-ph" data-act="viewphoto" data-v="' + k + '"><img src="' + tskPhoto(p, k) + '" alt="' + esc(p.name) + '"></button><figcaption class="ellip">' + esc(p.name) + '</figcaption>' + (canEdit ? '<button type="button" class="tsk-x tsk-phx" data-act="delphoto" data-v="' + k + '" aria-label="Remove ' + esc(p.name) + '">' + i('x') + '</button>' : '') + '</figure>'; }).join('') + '</div>' : '<p class="b2 faint">No photos.</p>');
    if (t) html += '<p class="b2 faint">Created ' + UI.fmt.dateTime(t.created) + (t.by ? ' by ' + esc(t.by) : '') + '.</p>';
    return html + '</div>';
  }
  function draw() {
    dr.setBody(body);
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
  function pickAgent(anchor) {
    UI.popover(anchor, function (el, pop) {
      var q = '';
      var list = function () {
        var emps = D().employees.filter(function (e) { return (e.active !== false || f.agents.indexOf(e.id) >= 0) && (!q || e.name.toLowerCase().indexOf(q) >= 0); });
        return emps.length ? emps.map(function (e) { var on = f.agents.indexOf(e.id) >= 0; return '<button type="button" class="tsk-opt" data-emp="' + e.id + '" aria-pressed="' + on + '">' + UI.avatar(e.name) + '<span class="grow"><b>' + esc(e.name) + '</b><small>' + (e.wa ? esc(e.wa) : 'No WhatsApp number') + '</small></span>' + (on ? i('check') : '') + '</button>'; }).join('') : '<p class="b2 faint" style="padding:8px 12px">No agent matches.</p>';
      };
      el.innerHTML = '<div class="tsk-pop"><div class="inp srch">' + i('search') + '<input type="search" placeholder="Search agents..." aria-label="Search agents"></div><div class="tsk-opts">' + list() + '</div></div>';
      var inp = el.querySelector('input'), box = el.querySelector('.tsk-opts');
      inp.addEventListener('input', function () { q = inp.value.trim().toLowerCase(); box.innerHTML = list(); });
      box.addEventListener('click', function (ev) { var b = ev.target.closest('[data-emp]'); if (!b) return; var aid = b.getAttribute('data-emp'), k = f.agents.indexOf(aid); if (k >= 0) f.agents.splice(k, 1); else f.agents.push(aid); delete err.agents; box.innerHTML = list(); readFields(); draw(); });
      setTimeout(function () { inp.focus(); }, 30);
    }, { width: 320, align: 'start' });
  }
  function pickBooking(anchor) {
    UI.popover(anchor, function (el, pop) {
      var q = '', now = +NOW();
      var all = D().bookings.filter(function (x) { return x.status !== 'Cancelled'; }).slice().sort(function (a, b) { return Math.abs(a.start - now) - Math.abs(b.start - now); });
      var list = function () {
        var rows = all.filter(function (x) { return !q || (x.code + ' ' + x.cust.name + ' ' + x.car.plate + ' ' + carName(x.car)).toLowerCase().indexOf(q) >= 0; }).slice(0, 40);
        return '<button type="button" class="tsk-opt" data-bk=""><span class="grow">-- None --</span>' + (!f.booking ? i('check') : '') + '</button>' + rows.map(function (x) { return '<button type="button" class="tsk-opt" data-bk="' + x.code + '" aria-pressed="' + (f.booking === x.code) + '"><span class="grow"><b>' + x.code + ' · ' + esc(x.cust.name) + '</b><small>' + esc(carModel(x.car) + ' ' + x.car.plate) + ' · ' + UI.fmt.date(x.start) + ' to ' + UI.fmt.date(x.end) + '</small></span>' + (f.booking === x.code ? i('check') : '') + '</button>'; }).join('') + (rows.length ? '' : '<p class="b2 faint" style="padding:8px 12px">No booking matches.</p>');
      };
      el.innerHTML = '<div class="tsk-pop"><div class="inp srch">' + i('search') + '<input type="search" placeholder="Booking ID, customer or plate" aria-label="Search bookings"></div><div class="tsk-opts">' + list() + '</div></div>';
      var inp = el.querySelector('input'), box = el.querySelector('.tsk-opts');
      inp.addEventListener('input', function () { q = inp.value.trim().toLowerCase(); box.innerHTML = list(); });
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-bk]'); if (!b) return; readFields();
        f.booking = b.getAttribute('data-bk'); var x = findBooking(f.booking);
        if (x && !t) { if (!f.at) f.at = x.start; if (!f.name) f.name = 'Deliver ' + carModel(x.car) + ' ' + x.car.plate + ' to ' + tskFirst(x.cust.name); if (f.type === 'General') f.type = x.startOpt === 'Delivery to KLIA' ? 'Car delivery to KLIA' : x.deliv ? "Car delivery to client's location" : 'Car delivery from our location'; if (!f.note && x.delNote) f.note = x.delNote; }
        pop.close(); draw();
      });
      setTimeout(function () { inp.focus(); }, 30);
    }, { width: 380, align: 'start' });
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
    if (a === 'pickagent') pickAgent(el);
    else if (a === 'unagent') { readFields(); f.agents.splice(f.agents.indexOf(v), 1); draw(); }
    else if (a === 'pickbooking') pickBooking(el);
    else if (a === 'nobooking') { readFields(); f.booking = ''; draw(); }
    else if (a === 'openbooking') { if (f.booking) API.openBooking(f.booking); }
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
    else if (a === 'viewphoto') { var p = f.photos[+v]; UI.dialog({ title: p.name, width: 'lg', body: '<img class="tsk-big" src="' + tskPhoto(p, +v) + '" alt="' + esc(p.name) + '">', buttons: [{ label: 'Close' }] }); }
  });
  dr.body.addEventListener('input', function (ev) { if (ev.target.matches('[data-f="name"]') && t) dr.setTitle(title, ev.target.value || t.name); });
  return dr;
}
function tskClock(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

API.newTask = function (prefill) { return tskDrawer(null, prefill || {}); };
API.openTask = function (id) { return tskDrawer(id); };

/* ---------------- the list page ---------------- */
PAGES['tasks'] = {
  title: 'Tasks',
  search: [{ label: 'New Task', icon: 'clipboard-plus', hint: 'Tasks', run: function () { API.newTask(); } }],
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data;
    st.f = st.f || {}; st.size = st.size || 10;
    var canNew = ctx.can('tasks.create');
    root.innerHTML = '<div class="pg-h"><div><h1>Tasks</h1><p>Jobs for your field agents: deliveries, returns, airport runs and general jobs. Agents get the details on WhatsApp.</p></div></div>' +
      '<div class="card tsk-card"><div class="tsk-flt"></div><div class="tsk-tbl"></div></div>';
    var cars = d.cars.filter(function (c) { return c.fleet !== 'Sold'; });
    var rowsSel = '<label class="row gap6 b2 tsk-rows">Rows<span class="inp"><select data-act="rows" aria-label="Rows per page">' + UI.options([10, 25, 50], st.size) + '</select></span></label>';
    var flt = UI.filters(root.querySelector('.tsk-flt'), {
      values: st.f,
      fields: [
        { type: 'search', key: 'q', placeholder: 'Search tasks...' },
        { type: 'select', key: 'status', label: 'Status', options: LISTS.taskStatus, all: 'Status: All' },
        { type: 'select', key: 'type', label: 'Type', options: LISTS.taskTypes, all: 'Type: All' },
        { type: 'select', key: 'emp', label: 'Employee', options: d.employees.map(function (e) { return [e.id, e.name]; }), all: 'All Employees' },
        { type: 'select', key: 'car', label: 'Car', options: cars.map(function (c) { return [c.id, c.plate + ' · ' + carModel(c)]; }), all: 'All Cars' },
        { type: 'daterange', from: 'cFrom', to: 'cTo', label: 'Created At' },
        { type: 'daterange', from: 'sFrom', to: 'sTo', label: 'Scheduled At' }
      ],
      onChange: function () { tbl.setRows(rows()); },
      extra: rowsSel + (canNew ? UI.btn('New Task', { icon: 'plus', size: 'sm', attrs: { 'data-act': 'new' } }) : '')
    });
    function rows() {
      var v = st.f, q = (v.q || '').trim().toLowerCase();
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
        if (q) { var hay = [t.name, t.note, t.type, t.status, t.booking, x ? x.cust.name + ' ' + x.car.plate + ' ' + carName(x.car) : ''].concat(t.agents.map(function (a) { var e = tskEmp(a); return e ? e.name : ''; })).join(' ').toLowerCase(); if (hay.indexOf(q) < 0) return false; }
        return true;
      }).sort(function (a, b) { return b.at - a.at; });
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
      card: function (t) { var x = tskBooking(t); return '<div class="tsk-c"><div class="row"><b class="grow">' + esc(t.name) + '</b>' + UI.status('task', t.status) + '</div><div class="b2">' + esc(t.type) + ' · ' + tskWhen(t.at) + '</div>' + (t.note ? '<div class="tsk-note">' + esc(t.note) + '</div>' : '') + '<div class="row wrap gap6 b2">' + i('users') + (t.agents.length ? esc(t.agents.map(function (a) { var e = tskEmp(a); return e ? e.name : a; }).join(', ')) : 'No agents') + '</div>' + waChips(t) + (x ? '<div class="b2">' + x.code + ' · ' + esc(x.cust.name) + ' · ' + esc(carModel(x.car) + ' ' + x.car.plate) + '</div>' : '') + '<div class="row" style="justify-content:flex-end">' + acts(t) + '</div></div>'; },
      empty: { icon: 'clipboard-off', title: 'No tasks found', text: d.tasks.length ? 'Try clearing the search or the filters.' : 'Create a task to send a job to your field agents.', action: d.tasks.length ? '' : (canNew ? UI.btn('New Task', { icon: 'plus', attrs: { 'data-act': 'new' } }) : '') }
    });
    function open(id) { ctx.setParams({ task: id }, true); tskDrawer(id, null, function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]task=/.test(location.hash)) ctx.setParams({}, true); }); }
    UI.on(root, 'click', '[data-act]', function (ev, el) {
      var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
      if (a === 'new') { tskDrawer(null, {}, function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]action=add(&|$)/.test(location.hash)) ctx.setParams({}, true); }); ctx.setParams({ action: 'add' }, true); }
      else if (a === 'open') open(v);
      else if (a === 'booking') ctx.api.openBooking(v);
      else if (a === 'del') {
        var t = byId(d.tasks, v); if (!t) return;
        UI.confirm({ title: 'Delete Task?', text: 'This action cannot be undone.', ok: 'Yes, Delete', danger: true }).then(function (y) { if (!y) return; DB.remove('tasks', t, { text: DB.actor() + ' deleted task "' + t.name + '"' }); UI.toast('Task deleted'); });
      }
    });
    UI.on(root, 'change', '[data-act="rows"]', function (ev, el) { st.size = +el.value; tbl.state.size = st.size; tbl.state.page = 1; tbl.refresh(); });
    ctx.on('data', function () { if (document.contains(root)) tbl.setRows(rows(), true); });
    /* address: action=add (from the menu "Add Task" or another page), task=<id>, booking=<code> to pre-fill */
    var p = ctx.params || {};
    if (p.action === 'add' && !UI.top()) { var pre = {}; if (p.booking) pre.booking = p.booking; setTimeout(function () { if (!canNew) { UI.toast('Your login cannot create tasks.', { tone: 'warn' }); return; } tskDrawer(null, pre, function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]action=add(&|$)/.test(location.hash)) ctx.setParams({}, true); }); }, 0); }
    else if (p.task && !UI.top()) setTimeout(function () { tskDrawer(p.task, null, function (_, closed) { if (closed && /[#&]page=tasks(&|$)/.test(location.hash) && /[#&]task=/.test(location.hash)) ctx.setParams({}, true); }); }, 0);
  },
  onData: function () { /* the table follows the data through ctx.on('data') */ }
};

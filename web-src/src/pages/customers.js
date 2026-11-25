/* ===================================================================
   Page: Customers (#page=customers)   Owner: builder 1
   A customer is the person behind one or more bookings (matched by IC / passport and phone).
   This file also holds the customer parts the booking drawer uses: flags, the banner, the notes panel,
   the Check IC panel and the documents block (cu* functions).
   =================================================================== */

/* ---------------- flags and look-ups ---------------- */
function cuBookings(p, d) { return (d || D()).bookings.filter(function (x) { return x.cust === p; }); }
function cuFlags(p) {
  var notes = p.notes || [], bks = cuBookings(p).filter(function (x) { return x.status !== 'Cancelled'; });
  var past = bks.filter(function (x) { return x.start <= NOW(); }).sort(function (a, b) { return b.start - a.start; });
  return {
    black: !!p.blacklist,
    careful: notes.some(function (z) { return z.flag === 'Be careful'; }) || p.flag === 'Be careful',
    vip: notes.some(function (z) { return z.flag === 'VIP'; }) || p.flag === 'VIP',
    notes: notes.length > 0, repeat: bks.length >= 2, count: bks.length, last: past[0] ? past[0].start : null
  };
}
/* keep the old single flag field in step for pages that read it */
function cuSyncFlag(p) { var f = cuFlags(p); p.flag = f.black ? 'Blacklisted' : f.vip ? 'VIP' : f.careful ? 'Be careful' : ''; }
/* country from a phone number: a number without "+" is a local one (the company's country) */
var CU_CC = [['+673', 'Brunei'], ['+966', 'Saudi Arabia'], ['+971', 'United Arab Emirates'], ['+60', 'Malaysia'], ['+65', 'Singapore'], ['+62', 'Indonesia'], ['+66', 'Thailand'], ['+63', 'Philippines'], ['+84', 'Vietnam'], ['+91', 'India'], ['+86', 'China'], ['+81', 'Japan'], ['+82', 'South Korea'], ['+61', 'Australia'], ['+44', 'United Kingdom'], ['+49', 'Germany'], ['+33', 'France'], ['+1', 'United States or Canada']];
var CU_NAT_CC = { Singaporean: '+65', Indonesian: '+62', Thai: '+66', Bruneian: '+673', Filipino: '+63', Vietnamese: '+84', Indian: '+91', Chinese: '+86', Japanese: '+81', Korean: '+82', Australian: '+61', British: '+44', American: '+1', German: '+49', French: '+33', Saudi: '+966', Emirati: '+971' };
function cuCountry(phone) {
  var s = String(phone || '').trim(), home = (typeof CO === 'function' && CO() && CO().countryCode) || '+60';
  if (!s.replace(/\D/g, '')) return { code: '', country: '' };
  var code = s.charAt(0) === '+' ? '' : home;
  if (!code) { var dg = '+' + s.replace(/\D/g, ''); CU_CC.forEach(function (c) { if (dg.indexOf(c[0]) === 0 && c[0].length > code.length) code = c[0]; }); }
  var hit = CU_CC.filter(function (c) { return c[0] === code; })[0];
  return { code: code || 'Other', country: hit ? hit[1] : 'Other' };
}
/* made-up data: visitors get a phone from home, a few locals typed theirs without +60, some notes say which booking they came from */
DATA_INIT.push(function (d) {
  if (d.cuReady) return; d.cuReady = true;
  d.people.forEach(function (p, k) {
    var dg = String(p.phone || '').replace(/\D/g, '').slice(-7), cc = CU_NAT_CC[p.nat];
    if (cc && dg.length === 7) p.phone = cc + ' 00 ' + dg.slice(0, 3) + ' ' + dg.slice(3);
    else if (!cc && (k === 5 || k === 17) && dg.length === 7) p.phone = '000-' + dg.slice(0, 3) + ' ' + dg.slice(3);
    var bks = d.bookings.filter(function (x) { return x.cust === p && x.start <= TODAY; }).sort(function (a, b) { return b.start - a.start; });
    (p.notes || []).forEach(function (z, j) { if (!z.booking && bks.length && (j === 0 || z.flag === 'Be careful')) z.booking = bks[Math.min(j, bks.length - 1)].code; });
  });
});
/* the booking a new note is written from: given by the caller, else the open booking drawer, else the address */
function cuNoteBooking(el, o) {
  if (o && o.booking) return o.booking;
  var h = el.closest && el.closest('.ui-drw'), t = h && h.querySelector('.ui-drw-h'), m = t && /Booking\s+([A-Z]+-\d+)/.exec(t.textContent);
  if (m) return m[1];
  m = /[#&]booking=([^&]+)/.exec(location.hash); return m ? decodeURIComponent(m[1]) : null;
}
function cuSince(p) { var s = cuBookings(p).map(function (x) { return x.created || x.start; }).sort(function (a, b) { return a - b; })[0] || p.since; return s ? UI.fmt.date(s).replace(/^\d+\s/, '') : ''; }
function cuMoneyLine(p) {
  var all = cuBookings(p), done = all.filter(function (x) { return x.status !== 'Cancelled'; }), cx = all.length - done.length;
  var t = plural(done.length, 'rental') + (cx ? ', ' + cx + ' cancelled' : '');
  if (can('bookings.see_amounts')) t += ', ' + UI.fmt.money(sum(all.map(function (x) { return bookingPaid(x).all; }))) + ' paid';
  return t;
}
/* New booking for a customer. A blacklisted one is blocked, unless the person may change the blacklist: then they see the reason and can go ahead (logged). */
function cuNewBooking(p) {
  if (!p.blacklist) { API.newBooking({ customer: p.id }); return; }
  if (!can('customers.blacklist_edit')) { UI.toast('This customer is on the blacklist. Ask someone who can change the blacklist.', { tone: 'warn' }); return; }
  UI.confirm({ title: 'Book anyway?', text: p.name + ' is on the blacklist since ' + UI.fmt.date(p.blacklist.since) + '. Reason: ' + (p.blacklist.reason || 'none given') + ' This will be noted in the activity log.', ok: 'Book anyway', danger: true }).then(function (y) {
    if (!y) return;
    DB.log('Booked a blacklisted customer', 'Customer', p.id, DB.actor() + ' started a new booking for ' + p.name + ', who is on the blacklist');
    setTimeout(function () { API.newBooking({ customer: p.id }); }, 150);
  });
}
function cuSeeIc() { return can('customers.view_documents') || can('customers.check_ic'); }
function cuIcText(ic) { return cuSeeIc() ? esc(ic) : esc(UI.fmt.ic(ic)); }
function cuFlagChips(p, o) {
  o = o || {};
  var f = cuFlags(p), out = [];
  if (f.black && (can('customers.blacklist_view') || can('customer_notes.view'))) out.push(UI.status('flag', 'Blacklisted', null, { sm: true, icon: 'ban' }));
  if (can('customer_notes.view')) {
    if (f.careful) out.push(UI.status('flag', 'Be careful', null, { sm: true, icon: 'alert-triangle' }));
    if (f.vip) out.push(UI.status('flag', 'VIP', null, { sm: true, icon: 'crown' }));
    if (f.notes && !o.noNotes) out.push(UI.status('flag', 'Has notes', null, { sm: true, icon: 'notes' }));
  }
  if (f.repeat) out.push(UI.status('flag', 'Repeat', o.long ? 'Repeat, ' + f.count + ' rentals' : null, { sm: true, icon: 'repeat' }));
  return out.join('');
}
/* the coloured banner at the top of a booking or customer drawer */
function cuBanner(p) {
  if (!p || !(can('customer_notes.view') || can('customers.blacklist_view'))) return '';
  var f = cuFlags(p), notes = (p.notes || []).slice().sort(function (a, b) { return (b.pinned - a.pinned) || (b.at - a.at); });
  var showNotes = can('customer_notes.view');
  var line = function (flag) { return showNotes ? notes.filter(function (z) { return z.flag === flag; }).map(function (z) { return '<li>' + esc(z.text) + '</li>'; }).join('') : ''; };
  var repeat = f.repeat ? '<div class="cu-ban-rep">' + i('repeat') + 'Repeat customer: ' + esc(cuMoneyLine(p)) + (f.last ? '. Last on ' + UI.fmt.date(f.last) : '') + '</div>' : '';
  var box = function (tone, icon, title, body) { return '<div class="cu-ban ' + tone + '" role="status"><span class="cu-ban-ic">' + i(icon) + '</span><div class="grow"><b>' + title + '</b>' + (body ? '<ul>' + body + '</ul>' : '') + repeat + '</div></div>'; };
  if (f.black) return box('bad', 'ban', 'Blacklisted customer: ' + esc(p.name) + ' is on the blacklist since ' + UI.fmt.date(p.blacklist.since) + '.', (p.blacklist.reason ? '<li>' + esc(p.blacklist.reason) + '</li>' : '') + line('Be careful'));
  var repOnly = f.repeat ? '<div class="cu-ban ok" role="status"><span class="cu-ban-ic">' + i('repeat') + '</span><div class="grow"><b>Repeat customer: ' + esc(cuMoneyLine(p)) + '</b>' + (f.last ? '<div class="cu-ban-rep">Last pick-up on ' + UI.fmt.date(f.last) + '</div>' : '') + '</div></div>' : '';
  if (!showNotes) return repOnly;
  if (f.careful) return box('warn', 'alert-triangle', 'Be careful with this customer', line('Be careful'));
  if (f.vip) return box('info', 'crown', 'VIP customer', line('VIP') + line('Info'));
  if (f.notes) return box('grey', 'notes', 'Notes about this customer', line('Info'));
  return repOnly;
}

/* ---------------- document pictures (made-up thumbnails) ---------------- */
function cuDocSvg(kind, name) {
  var head = { icFront: ['#2B5FD9', 'MyKad'], icBack: ['#4B5563', 'MyKad (back)'], dl: ['#C2410C', 'Driving licence'], passport: ['#7C2D12', 'Passport'] }[kind];
  if (!head) return '<svg viewBox="0 0 120 76" aria-hidden="true"><rect width="120" height="76" rx="6" fill="#F3F4F6" stroke="#D1D5DB"/><rect x="30" y="8" width="60" height="60" rx="3" fill="#fff" stroke="#D1D5DB"/><path d="M38 20h44M38 28h36M38 36h40M38 44h30M38 52h38" stroke="#9CA3AF" stroke-width="2.4" stroke-linecap="round"/></svg>';
  return '<svg viewBox="0 0 120 76" aria-hidden="true"><rect width="120" height="76" rx="6" fill="#fff" stroke="#D1D5DB"/><path d="M0 6a6 6 0 0 1 6-6h108a6 6 0 0 1 6 6v8H0z" fill="' + head[0] + '"/><text x="5" y="10" font-size="7" font-family="sans-serif" font-weight="700" fill="#fff">' + head[1] + '</text>' +
    (kind === 'icBack' ? '<rect x="8" y="22" width="18" height="14" rx="2" fill="#D4B05A"/><path d="M34 26h70M34 33h60M8 46h96M8 54h80" stroke="#9CA3AF" stroke-width="2.4" stroke-linecap="round"/>' :
      '<rect x="8" y="22" width="26" height="34" rx="2" fill="#E5E7EB"/><circle cx="21" cy="34" r="6" fill="#9CA3AF"/><path d="M12 52q9-10 18 0" fill="#9CA3AF"/><path d="M42 26h56M42 33h46M42 40h52M42 47h34" stroke="#9CA3AF" stroke-width="2.4" stroke-linecap="round"/><text x="42" y="64" font-size="6" font-family="sans-serif" fill="#6B7280">' + esc((name || 'SAMPLE').toUpperCase().slice(0, 24)) + '</text>') + '</svg>';
}
/* open a file (uploaded picture, PDF or one of the sample files) in a dialog */
function cuShowFile(f, title, kind, who) {
  var body = f.dataUrl ? (/^data:image\//.test(f.dataUrl) ? '<img class="cu-fview" src="' + f.dataUrl + '" alt="' + esc(f.name) + '">' : '<div class="cu-fview cu-fpdf">' + i('file-type-pdf') + '<b>' + esc(f.name) + '</b><span class="b2">' + UI.fmt.size(f.size) + '</span></div>')
    : '<div class="cu-fview cu-fsample">' + cuDocSvg(kind, who) + '</div><p class="b2">Sample file kept with the record. In the real system the picture the customer sent shows here.</p>';
  UI.dialog({ title: title, text: f.name + (f.size ? ' · ' + UI.fmt.size(f.size) : ''), width: 'md', body: body,
    buttons: [{ label: 'Close', kind: 'g' }].concat(f.dataUrl ? [{ label: 'Download', icon: 'download', onClick: function () { cuDownloadData(f); return false; } }] : []) });
}
function cuDownloadData(f) {
  var m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(f.dataUrl); if (!m) return;
  var raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]), bytes = new Uint8Array(raw.length);
  for (var k = 0; k < raw.length; k++) bytes[k] = raw.charCodeAt(k);
  UI.download({ filename: f.name, data: bytes, mime: m[1] });
}

/* ---------------- documents block: Proof of Address, Driving License Scan, ID Card Front, ID Card Back, Other Files ----------------
   cuDocsMount(el, files, {readonly, person, onChange, fromCustomer, extra}) ; files is changed in place */
var CU_DOCS = [['poa', 'Proof of Address'], ['dl', 'Driving License Scan'], ['icFront', 'ID Card Front'], ['icBack', 'ID Card Back'], ['other', 'Other Files']];
function cuDocsMount(el, files, o) {
  o = o || {};
  function draw() {
    el.innerHTML = '<div class="cu-docs">' + CU_DOCS.map(function (dc) {
      var f = files[dc[0]], from = !f && o.fromCustomer && o.fromCustomer[dc[0]];
      return '<div class="cu-doc" data-doc="' + dc[0] + '"><div class="cu-doc-h">' + dc[1] + '</div>' +
        (f ? '<button type="button" class="cu-thumb" data-cu-open title="Open ' + esc(f.name) + '">' + (f.dataUrl && /^data:image\//.test(f.dataUrl) ? '<img src="' + f.dataUrl + '" alt="">' : f.dataUrl ? i('file-type-pdf') : cuDocSvg(dc[0], o.person && o.person.name)) + '</button>' +
          '<div class="cu-doc-f"><button type="button" class="cu-link ellip" data-cu-open>' + esc(f.name) + '</button>' + (o.readonly ? '' : UI.iconBtn('trash', 'Remove ' + dc[1], { size: 'sm', cls: 'cu-del', attrs: { 'data-cu-del': 1 } })) + '</div>'
          : '<div class="cu-none">' + (from ? 'No file (will be copied from customer)' : o.readonly ? 'Not provided' : 'No file yet') + '</div>') +
        (o.readonly ? '' : '<label class="btn o sm cu-up">' + i('upload') + (f ? 'Replace' : 'Upload') + '<input type="file" accept="image/*,.pdf" hidden data-cu-file></label>') + '</div>';
    }).join('') + (o.extra || '') + '</div>';
  }
  el.addEventListener('click', function (ev) {
    var box = ev.target.closest('[data-doc]'); if (!box) return;
    var k = box.getAttribute('data-doc'), f = files[k], label = CU_DOCS.filter(function (z) { return z[0] === k; })[0][1];
    if (ev.target.closest('[data-cu-open]') && f) cuShowFile(f, label, k, o.person && o.person.name);
    if (ev.target.closest('[data-cu-del]') && f) {
      files[k] = null; draw(); if (o.onChange) o.onChange(files);
      UI.toast(label + ' removed', { tone: 'info', action: { label: 'Undo', run: function () { files[k] = f; draw(); if (o.onChange) o.onChange(files); } } });
    }
  });
  el.addEventListener('change', function (ev) {
    var t = ev.target; if (!t.matches('[data-cu-file]') || !t.files[0]) return;
    var k = t.closest('[data-doc]').getAttribute('data-doc'), file = t.files[0];
    if (file.type === 'application/pdf' && file.size > 8e6) { UI.toast('That PDF is too large. Take a photo of the document instead.', { tone: 'warn' }); return; }
    UI.readImage(file, { max: 1400 }).then(function (r) { files[k] = { name: r.name, size: r.size, dataUrl: r.dataUrl, added: NOW() }; draw(); if (o.onChange) o.onChange(files); UI.toast(r.name + ' added' + (r.shrunk ? ' (made smaller)' : '')); }, function (err) { UI.toast(err.message, { tone: 'bad' }); });
  });
  draw();
  return { redraw: draw };
}

/* ---------------- notes about the customer ----------------
   cuNotesMount(el, person) : the NOTES ABOUT THIS CUSTOMER panel (Info / VIP / Be careful, pin, edit, delete, add) */
var CU_FLAGS = [['Info', 'Something useful to know', 'info-circle'], ['VIP', 'A customer to look after well', 'crown'], ['Be careful', 'A warning for the next booking', 'alert-triangle']];
function cuNotesMount(el, p, o) {
  o = o || {};
  if (!can('customer_notes.view')) { el.innerHTML = ''; return { redraw: function () {} }; }
  var st = { adding: false, edit: null };
  function save(notes, text) { DB.update('people', p, { notes: notes }, { text: text, where: 'Customer' }); cuSyncFlag(p); draw(); if (o.onChange) o.onChange(); }
  function form(n) {
    var flag = n ? n.flag : 'Info';
    return '<div class="cu-nform"><div class="cu-nflags" role="radiogroup" aria-label="Kind of note">' + CU_FLAGS.map(function (f) { return '<button type="button" role="radio" class="cu-nflag f-' + f[0].replace(' ', '') + '" data-cu-flag="' + f[0] + '" aria-checked="' + (flag === f[0]) + '">' + i(f[2]) + '<span><b>' + f[0] + '</b><small>' + f[1] + '</small></span></button>'; }).join('') + '</div>' +
      UI.textarea({ key: 'cu-ntext', label: 'What should staff know?', placeholder: 'For example: always returns the car late, prefers WhatsApp, needs a child seat', value: n ? n.text : '', rows: 3 }) +
      '<div class="row wrap" style="justify-content:space-between">' + UI.check({ key: 'cu-npin', label: 'Pin to the top', checked: n ? n.pinned : false }) +
      '<span class="row gap8">' + UI.btn('Cancel', { kind: 't', size: 'sm', attrs: { 'data-cu-ncancel': 1 } }) + UI.btn(n ? 'Save changes' : 'Save note', { size: 'sm', icon: 'check', attrs: { 'data-cu-nsave': n ? n.id : '' } }) + '</span></div></div>';
  }
  function draw() {
    var notes = (p.notes || []).slice().sort(function (a, b) { return (b.pinned - a.pinned) || (b.at - a.at); });
    var tone = { 'Info': 'grey', 'VIP': 'info', 'Be careful': 'warn' };
    el.innerHTML = '<div class="cu-notes"><div class="cu-notes-h"><div class="grow"><b>Notes about this customer (' + notes.length + ')</b><div class="b2">Matched by phone ' + UI.phone(p.phone) + ' and IC / passport ' + esc(UI.fmt.ic(p.ic)) + '. Notes show on every booking of this customer.</div></div>' +
      (can('customer_notes.add') && !st.adding ? UI.btn('Add note', { kind: 'tonal', size: 'sm', icon: 'plus', attrs: { 'data-cu-nadd': 1 } }) : '') + '</div>' +
      (st.adding ? form(null) : '') +
      (notes.length ? '<div class="cu-nlist">' + notes.map(function (n) {
        if (st.edit === n.id) return form(n);
        return '<div class="cu-note ' + tone[n.flag] + '"><div class="cu-note-top">' + UI.status('flag', n.flag, null, { sm: true }) + (n.pinned ? '<span class="cu-pin" title="Pinned">' + i('pinned') + 'Pinned</span>' : '') + '<span class="b2">' + esc(n.by) + ' · ' + UI.fmt.date(n.at) + (n.booking ? ' · from <a href="#" class="cu-nbk" data-cu-nbk="' + esc(n.booking) + '">' + esc(n.booking) + '</a>' : '') + '</span><span class="grow"></span>' +
          (can('customer_notes.edit') ? UI.iconBtn(n.pinned ? 'pinned-off' : 'pin', n.pinned ? 'Unpin' : 'Pin to the top', { size: 'sm', attrs: { 'data-cu-npin': n.id } }) + UI.iconBtn('pencil', 'Edit note', { size: 'sm', attrs: { 'data-cu-nedit': n.id } }) : '') +
          (can('customer_notes.delete') ? UI.iconBtn('trash', 'Delete note', { size: 'sm', cls: 'cu-del', attrs: { 'data-cu-ndel': n.id } }) : '') + '</div><p>' + esc(n.text) + '</p></div>';
      }).join('') + '</div>' : (st.adding ? '' : '<div class="cu-nempty">' + i('notes') + 'No notes yet. Tap "Add note" to tell the team something about this customer.</div>')) + '</div>';
  }
  el.addEventListener('click', function (ev) {
    var t = ev.target, x;
    if ((x = t.closest('[data-cu-nbk]'))) { ev.preventDefault(); var bc = x.getAttribute('data-cu-nbk'); if (typeof API.openBooking === 'function') API.openBooking(bc); return; }
    if (t.closest('[data-cu-nadd]')) { st.adding = true; st.edit = null; draw(); var ta = el.querySelector('textarea'); if (ta) ta.focus(); return; }
    if (t.closest('[data-cu-ncancel]')) { st.adding = false; st.edit = null; draw(); return; }
    if ((x = t.closest('[data-cu-flag]'))) { x.parentNode.querySelectorAll('[data-cu-flag]').forEach(function (b) { b.setAttribute('aria-checked', b === x); }); return; }
    if ((x = t.closest('[data-cu-nsave]'))) {
      var box = x.closest('.cu-nform'), text = box.querySelector('textarea').value.trim(), flag = box.querySelector('[data-cu-flag][aria-checked="true"]').getAttribute('data-cu-flag'), pin = box.querySelector('[data-key="cu-npin"]').checked, id = x.getAttribute('data-cu-nsave');
      if (!text) { UI.toast('Write the note first', { tone: 'warn' }); box.querySelector('textarea').focus(); return; }
      var notes = (p.notes || []).slice();
      if (id) { notes = notes.map(function (n) { return n.id === id ? Object.assign({}, n, { text: text, flag: flag, pinned: pin }) : n; }); st.edit = null; save(notes, DB.actor() + ' changed a note about ' + p.name); UI.toast('Note saved'); }
      else { notes.push({ id: 'note-' + Date.now().toString(36), flag: flag, text: text, pinned: pin, by: DB.actor(), at: NOW(), booking: cuNoteBooking(el, o) }); st.adding = false; save(notes, DB.actor() + ' added a ' + flag + ' note about ' + p.name); UI.toast('Note added. It shows on every booking of ' + p.name + '.'); }
      return;
    }
    if ((x = t.closest('[data-cu-npin]'))) { var pid = x.getAttribute('data-cu-npin'), pn; save((p.notes || []).map(function (n) { if (n.id === pid) { pn = !n.pinned; return Object.assign({}, n, { pinned: pn }); } return n; }), DB.actor() + (pn ? ' pinned' : ' unpinned') + ' a note about ' + p.name); return; }
    if ((x = t.closest('[data-cu-nedit]'))) { st.edit = x.getAttribute('data-cu-nedit'); st.adding = false; draw(); return; }
    if ((x = t.closest('[data-cu-ndel]'))) {
      var did = x.getAttribute('data-cu-ndel');
      UI.confirm({ title: 'Delete this note?', text: 'The note disappears from every booking of ' + p.name + '.', ok: 'Delete', danger: true }).then(function (y) { if (y) { save((p.notes || []).filter(function (n) { return n.id !== did; }), DB.actor() + ' deleted a note about ' + p.name); UI.toast('Note deleted'); } });
    }
  });
  draw();
  return { redraw: draw };
}

/* ---------------- IC number reading ---------------- */
var CU_STATES = { '01': 'Johor', '02': 'Kedah', '03': 'Kelantan', '04': 'Melaka', '05': 'Negeri Sembilan', '06': 'Pahang', '07': 'Pulau Pinang', '08': 'Perak', '09': 'Perlis', '10': 'Selangor', '11': 'Terengganu', '12': 'Sabah', '13': 'Sarawak', '14': 'Kuala Lumpur', '15': 'Labuan', '16': 'Putrajaya', '21': 'Johor', '22': 'Johor', '24': 'Johor', '25': 'Kedah', '30': 'Melaka', '31': 'Negeri Sembilan', '38': 'Pulau Pinang', '41': 'Selangor', '43': 'Selangor', '47': 'Sabah', '49': 'Sabah', '50': 'Sarawak', '54': 'Kuala Lumpur', '59': 'Putrajaya', '71': 'Born outside Malaysia', '82': 'State not known' };
function cuIcParse(ic) {
  var s = String(ic || '').replace(/[\s-]/g, '');
  if (!s) return { empty: true };
  if (!/^\d+$/.test(s)) return { passport: true, ok: /^[A-Z0-9]{6,12}$/i.test(s) };
  if (s.length !== 12) return { ok: false, why: 'An IC number has 12 digits.' };
  var yy = +s.slice(0, 2), mm = +s.slice(2, 4), dd = +s.slice(4, 6), pb = s.slice(6, 8), now = NOW(), yr = 2000 + yy;
  if (now.getFullYear() - yr < 15) yr -= 100;
  var born = new Date(yr, mm - 1, dd);
  if (mm < 1 || mm > 12 || born.getMonth() !== mm - 1 || born.getDate() !== dd) return { ok: false, why: 'The first six digits are not a real date of birth.' };
  if (!CU_STATES[pb]) return { ok: false, why: 'Digits 7 and 8 are not a place-of-birth code.' };
  var age = now.getFullYear() - yr - (now < new Date(now.getFullYear(), mm - 1, dd) ? 1 : 0);
  return { ok: true, born: born, age: age, state: CU_STATES[pb], sex: +s.slice(-1) % 2 ? 'Male' : 'Female', note: 'Two-digit year ' + String(yy).padStart(2, '0') + ' read as ' + yr + ', the only century that gives an age of 15 to 100.' };
}
function cuNameMatch(a, b) {
  var n = function (s) { return String(s || '').toLowerCase().replace(/\b(bin|binti|bt|a\/l|a\/p)\b/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean); };
  var x = n(a), y = n(b); if (!x.length || !y.length) return null;
  if (x.join(' ') === y.join(' ')) return 'match';
  var hit = x.filter(function (w) { return y.indexOf(w) >= 0; }).length;
  return hit / Math.max(x.length, y.length) >= .5 ? 'close' : 'differs';
}
function cuIcChips(ic, cardName, bookingName) {
  var r = cuIcParse(ic); if (r.empty) return '';
  var out = '<div class="cu-icres">';
  if (r.passport) out += UI.chip(r.ok ? 'Passport number looks right' : 'This is not a valid passport number.', r.ok ? 'ok' : 'bad', { icon: r.ok ? 'circle-check' : 'alert-circle' });
  else if (!r.ok) out += UI.chip('This is not a valid IC number.', 'bad', { icon: 'alert-circle' }) + '<span class="b2">' + esc(r.why) + '</span>';
  else out += '<div class="row wrap gap6">' + UI.chip('Number looks valid', 'ok', { icon: 'circle-check' }) + '</div><dl class="cu-icdl"><dt>Born</dt><dd>' + UI.fmt.date(r.born) + ' (age ' + r.age + ')</dd><dt>Place of birth</dt><dd>' + r.state + '</dd><dt>Sex</dt><dd>' + r.sex + '</dd></dl><span class="b2">' + r.note + '</span>';
  var m = cardName ? cuNameMatch(cardName, bookingName) : null;
  if (m) out += '<div class="row wrap gap6">' + UI.chip(m === 'match' ? 'Name matches' : m === 'close' ? 'Name close' : 'Name differs', m === 'match' ? 'ok' : m === 'close' ? 'warn' : 'bad') + '<span class="b2">Booking name: ' + esc(bookingName) + '</span></div>';
  return out + '</div>';
}
/* the online check against our blacklist and the IC check sites (Settings > IC check accounts) */
function cuOnlineCheck(ic, name) {
  var d = D(), norm = String(ic || '').replace(/[\s-]/g, '').toUpperCase();
  var black = d.people.filter(function (q) { return q.blacklist && (String(q.ic).replace(/[\s-]/g, '').toUpperCase() === norm || (name && q.name.toLowerCase() === String(name).toLowerCase())); })[0];
  var rows = [['Our blacklist', black ? 'Flagged' : 'Clear', black ? 'On our blacklist since ' + UI.fmt.date(black.blacklist.since) : 'Not on our blacklist']];
  ((d.settings && d.settings.icSites) || []).forEach(function (s) {
    if (!s.on) return;
    rows.push([s.name, !s.saved ? 'Could not check' : black ? 'Flagged' : 'Clear', !s.saved ? 'No login saved for this site' : black ? 'Matched a warning word' : 'Nothing found']);
  });
  return rows;
}
function cuOnlineTable(c) {
  if (!c || !c.results) return '';
  return '<div class="cu-ictbl"><table class="tbl"><thead><tr><th>Site</th><th>Result</th><th>Checked</th></tr></thead><tbody>' + c.results.map(function (r) {
    return '<tr><td>' + esc(r[0]) + '</td><td>' + UI.chip(r[1], r[1] === 'Clear' ? 'ok' : r[1] === 'Flagged' ? 'bad' : 'warn') + (r[2] ? '<div class="b2">' + esc(r[2]) + '</div>' : '') + '</td><td class="nw">' + UI.fmt.dateTime(c.at) + '</td></tr>';
  }).join('') + '</tbody></table></div><p class="b2">Checked ' + UI.fmt.dateTime(c.at) + ' by ' + esc(c.by) + '. Every check is written to the activity log.</p>';
}
/* made-up reading of a card picture (the sample cannot read real cards) */
function cuFakeRead(seed, passport) {
  var R = rng(seed || 7), ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var names = ['Nurul Huda Ismail', 'Lim Jia Hui', 'Arvind Selvam', 'Hafiz Zainal', 'Chan Siew Mei', 'Aishah Kamarudin'];
  var pbs = ['01', '05', '08', '10', '14'];
  return { name: names[ri(0, names.length - 1)], ic: passport ? 'A' + ri(10000000, 99999999) : String(ri(80, 99)) + String(ri(1, 12)).padStart(2, '0') + String(ri(1, 28)).padStart(2, '0') + '-' + pbs[ri(0, 4)] + '-' + ri(1000, 9999) };
}

/* ---------------- CHECK IC panel ----------------
   cuIcMount(el, person, {bookingName: fn}) : upload / saved picture, correction and re-check, result chips, Check online */
function cuIcMount(el, p, o) {
  o = o || {};
  if (!can('customers.check_ic')) { el.innerHTML = ''; return; }
  var st = { pic: null, ic: p.ic, card: (p.icCheck && p.icCheck.cardName) || '', read: (p.icCheck && p.icCheck.cardName) || '' };
  var bname = function () { return o.bookingName ? o.bookingName() : p.name; };
  function draw() {
    el.innerHTML = '<div class="cu-ic"><div class="row wrap gap8"><label class="btn c sm">' + i('upload') + 'Upload IC photo<input type="file" accept="image/*" hidden data-cu-icfile></label>' +
      (p.docs && p.docs.icFront ? UI.btn('Use the saved IC picture', { kind: 'tonal', size: 'sm', icon: 'id', attrs: { 'data-cu-icsaved': 1 } }) : '') + '<span class="b2">The picture is read on our own server and kept private.</span></div>' +
      (st.pic ? '<div class="cu-icpic">' + (st.pic === 'saved' ? cuDocSvg('icFront', p.name) : '<img src="' + st.pic + '" alt="IC picture">') + '</div>' : '') +
      '<div class="cu-g2">' + UI.input({ key: 'cu-icno', label: 'IC number', value: st.ic }) + UI.input({ key: 'cu-iccard', label: 'Name on the card', value: st.card, help: st.read ? 'Read from the card: ' + st.read.toUpperCase() : '' }) + '</div>' +
      '<div class="row wrap gap8">' + UI.btn('Save correction and re-check', { kind: 'tonal', size: 'sm', icon: 'refresh', attrs: { 'data-cu-icsave': 1 } }) + '<span class="b2">The reader can make mistakes. Compare with the picture, fix anything wrong, then save.</span></div>' +
      cuIcChips(st.ic, st.card, bname()) +
      '<div>' + UI.btn('Check online', { kind: 'o', size: 'sm', icon: 'world-search', attrs: { 'data-cu-iconline': 1 } }) + '</div>' + cuOnlineTable(p.icCheck) + '</div>';
  }
  var readIt = function (pic) { st.pic = pic; st.ic = p.ic; st.card = p.name.toUpperCase(); st.read = p.name; draw(); UI.toast('IC read: ' + UI.fmt.ic(p.ic) + ', ' + p.name.toUpperCase()); };
  el.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.closest('[data-cu-icsaved]')) readIt('saved');
    else if (t.closest('[data-cu-icsave]')) { st.ic = el.querySelector('[data-key="cu-icno"]').value.trim(); st.card = el.querySelector('[data-key="cu-iccard"]').value.trim(); if (st.ic && st.ic !== p.ic && can('customers.edit')) DB.update('people', p, { ic: st.ic }, { where: 'Customer', text: DB.actor() + ' corrected the IC number of ' + p.name }); draw(); UI.toast('Saved and checked again'); }
    else if (t.closest('[data-cu-iconline]')) {
      var b = t.closest('button'); b.disabled = true; b.innerHTML = i('loader-2') + 'Checking...';
      setTimeout(function () {
        var c = { at: NOW(), by: DB.actor(), valid: !!cuIcParse(st.ic).ok, cardName: st.card, results: cuOnlineCheck(st.ic, p.name) };
        DB.update('people', p, { icCheck: c }, { action: 'Other', where: 'Customer', text: DB.actor() + ' checked the IC of ' + p.name + ' online' });
        draw(); UI.toast(c.results.some(function (r) { return r[1] === 'Flagged'; }) ? 'A site has flagged this person. This is a warning for you to weigh up.' : 'Checked online: nothing found', { tone: c.results.some(function (r) { return r[1] === 'Flagged'; }) ? 'warn' : 'ok' });
      }, 700);
    }
  });
  el.addEventListener('change', function (ev) {
    if (!ev.target.matches('[data-cu-icfile]') || !ev.target.files[0]) return;
    var f = ev.target.files[0];
    if (!/^image\//.test(f.type)) { UI.toast('The picture could not be read. Type the details.', { tone: 'warn' }); return; }
    UI.readImage(f, { max: 1200 }).then(function (r) { readIt(r.dataUrl); });
  });
  draw();
}

/* ---------------- the Customers page ---------------- */
var CU_SHOW = [
  ['all', 'Everyone', 'users', 'grey', 'Everyone who has rented'],
  ['black', 'Blacklisted', 'ban', 'bad', 'Never rent to them again'],
  ['careful', 'Be careful', 'alert-triangle', 'warn', 'Check them twice'],
  ['vip', 'VIP', 'crown', 'info', 'Look after them well'],
  ['repeat', 'Repeat', 'repeat', 'ok', 'Came back two times or more'],
  ['notes', 'Has notes', 'notes', 'grey', 'Staff left a note']
];
PAGES['customers'] = {
  title: 'Customers',
  render: function (root, ctx) {
    var d = ctx.data, st = ctx.state;
    st.f = st.f || {}; st.show = ctx.params.show || st.show || 'all';
    var seeFlags = ctx.can('customer_notes.view');
    if (!seeFlags || !CU_SHOW.some(function (s) { return s[0] === st.show; })) st.show = 'all';
    var people = d.people.filter(function (p) { return cuBookings(p, d).length; });
    var flagsOf = {}; people.forEach(function (p) { flagsOf[p.id] = cuFlags(p); });
    var test = { all: function () { return true; }, black: function (f) { return f.black; }, careful: function (f) { return f.careful; }, vip: function (f) { return f.vip; }, repeat: function (f) { return f.repeat; }, notes: function (f) { return f.notes; } };
    var counts = {}; CU_SHOW.forEach(function (s) { counts[s[0]] = people.filter(function (p) { return test[s[0]](flagsOf[p.id]); }).length; });
    var shows = CU_SHOW.filter(function (s) { return s[0] !== 'black' || ctx.can('customers.blacklist_view'); });

    root.innerHTML = '<div class="pg-h"><div><h1>Customers</h1><p>Everyone who has booked, with their notes, IC check and rentals.</p></div><div class="acts">' +
      (ctx.can('bookings.export') && ctx.can('customers.view') ? UI.btn('Excel', { kind: 'o', icon: 'file-spreadsheet', attrs: { 'data-act': 'xlsx', title: 'Download the customers in this list as Excel' } }) : '') +
      (ctx.can('bookings.create') ? UI.btn('New Booking', { icon: 'plus', attrs: { 'data-act': 'new' } }) : '') + '</div></div>' +
      (seeFlags ? '<div class="cu-seg" role="group" aria-label="Show">' + shows.map(function (s) {
        return '<button type="button" class="cu-seg-b t-' + s[3] + '" data-show="' + s[0] + '" aria-pressed="' + (st.show === s[0]) + '"><span class="cu-seg-ic">' + i(s[2]) + '</span><span class="cu-seg-t"><b class="num">' + counts[s[0]] + '</b><span>' + s[1] + '</span><small>' + s[4] + '</small></span></button>';
      }).join('') + '</div>' : '') +
      '<div class="card"><div id="cu-f"></div><div id="cu-t"></div></div>';

    var showCol = st.show;
    var cols = [
      { key: 'name', label: 'Name', sort: true, render: function (p) { var f = flagsOf[p.id]; return '<div class="cu-who">' + UI.avatar(p.name) + '<div class="cu-who-t"><b class="ellip">' + esc(p.name) + '</b><small>' + plural(f.count, 'rental') + (f.last ? ' · last ' + UI.fmt.date(f.last) : '') + '</small></div></div>'; } },
      { key: 'flags', label: 'Flags', render: function (p) { return '<div class="cu-flags">' + (cuFlagChips(p) || '<span class="faint">-</span>') + '</div>'; } },
      { key: 'ic', label: 'IC / Passport', nowrap: true, render: function (p) { return '<span class="num">' + esc(UI.fmt.ic(p.ic)) + '</span>'; } },
      { key: 'phone', label: 'Phone', nowrap: true, cls: 'cu-ph', render: function (p) { return UI.phone(p.phone, { wa: true }); } },
      { key: 'email', label: 'Email', render: function (p) { return '<span class="cu-mail ellip" title="' + esc(p.email) + '">' + esc(p.email) + '</span>'; } },
      { key: 'nat', label: 'Nationality', sort: true, nowrap: true },
      { key: 'view', label: 'Actions', align: 'center', render: function (p) { return '<div class="cu-acts">' + UI.iconBtn('eye', 'View ' + p.name, { size: 'sm', attrs: { 'data-cu-view': p.id } }) + (!ctx.can('bookings.create') ? '' : flagsOf[p.id].black && !ctx.can('customers.blacklist_edit') ? '<span class="b2 cu-nbx" title="Blacklisted customers cannot get a new booking from here">' + i('ban') + '</span>' : UI.iconBtn('calendar-plus', 'New booking for ' + p.name, { size: 'sm', cls: 'cu-nbb' + (flagsOf[p.id].black ? ' cu-nbw' : ''), attrs: { 'data-cu-new': p.id } })) + '</div>'; } }
    ];
    if (showCol === 'black') cols.splice(2, 0, { key: 'why', label: 'On the blacklist', render: function (p) { return '<div class="cu-why"><b>Since ' + UI.fmt.date(p.blacklist.since) + '</b><small>' + esc(p.blacklist.reason || '') + '</small></div>'; } });
    if (showCol === 'careful' || showCol === 'vip') cols.splice(2, 0, { key: 'why', label: 'Pinned note', render: function (p) { var n = (p.notes || []).filter(function (z) { return z.flag === (showCol === 'vip' ? 'VIP' : 'Be careful'); }).sort(function (a, b) { return b.pinned - a.pinned || b.at - a.at; })[0]; return n ? '<div class="cu-why"><small>' + esc(n.text) + '</small><span class="faint">' + esc(n.by) + ' · ' + UI.fmt.date(n.at) + '</span></div>' : '<span class="faint">-</span>'; } });
    if (showCol === 'repeat') cols.splice(2, 0, { key: 'cnt', label: 'Rentals', align: 'right', sort: function (p) { return flagsOf[p.id].count; }, render: function (p) { var f = flagsOf[p.id], spent = sum(cuBookings(p, d).filter(function (x) { return x.status !== 'Cancelled'; }).map(function (x) { return x.payable - x.dep; })); return '<div class="cu-why r"><b>' + f.count + ' rentals</b><small>' + (ctx.can('bookings.see_amounts') ? UI.money(spent) + ' spent' : '') + '</small></div>'; } });
    if (showCol) cols = cols.filter(function (c) { return c.key !== 'email' && c.key !== 'nat'; }); /* the segment column takes their room; both stay in the customer drawer */

    var rowsFor = function () {
      var raw = (st.f.q || '').trim(), q = raw.toLowerCase(), digitsOnly = /^[+\d\s\-().]+$/.test(raw), qd = raw.replace(/\D/g, '');
      return people.filter(function (p) {
        if (!test[st.show](flagsOf[p.id])) return false;
        if (!q) return true;
        if ((p.name + ' ' + p.ic + ' ' + p.email + ' ' + p.phone).toLowerCase().indexOf(q) >= 0) return true;
        if (!digitsOnly || qd.length < 3) return false;
        /* each number on its own: the phone (0, 60 and +60 at the start count as the same) and the IC */
        return phoneHas(p.phone, qd) || String(p.ic || '').replace(/\D/g, '').indexOf(qd) >= 0;
      }).sort(function (a, b) { return (flagsOf[b.id].last || 0) - (flagsOf[a.id].last || 0); });
    };
    var t = UI.table(root.querySelector('#cu-t'), {
      columns: cols, rows: rowsFor(), rowKey: 'id', density: 'compact', minWidth: 1080, pageSize: st.size || 25, pageSizes: [10, 25, 50, 100], sort: st.sort, onSort: function (s) { st.sort = s; },
      onRowClick: function (p) { cuOpen(p.id); },
      empty: st.show === 'all' ? { icon: 'users', title: 'No customers found', text: 'Try another name, IC, phone or email.' } : { icon: 'flag', title: 'No customers here', text: 'Nobody with this flag matches the search, or nobody has this flag yet. Flags appear once someone adds a note or a customer rents again.' },
      card: function (p) {
        var f = flagsOf[p.id];
        return '<div class="cu-card"><div class="cu-who">' + UI.avatar(p.name) + '<div class="cu-who-t"><b class="ellip">' + esc(p.name) + '</b><small>' + plural(f.count, 'rental') + ' · ' + esc(p.nat) + '</small></div></div>' +
          '<div class="cu-flags">' + cuFlagChips(p) + '</div><div class="cu-card-l">' + UI.phone(p.phone, { wa: true }) + '<span class="num faint">' + esc(UI.fmt.ic(p.ic)) + '</span></div>' +
          '<div class="cu-card-a">' + UI.btn('View', { kind: 'o', size: 'sm', icon: 'eye', attrs: { 'data-cu-view': p.id } }) + (ctx.can('bookings.create') && (!f.black || ctx.can('customers.blacklist_edit')) ? UI.btn('New Booking', { kind: 'tonal', size: 'sm', icon: 'calendar-plus', attrs: { 'data-cu-new': p.id } }) : '') + '</div></div>';
      }
    });
    UI.filters(root.querySelector('#cu-f'), { values: st.f, fields: [{ type: 'search', key: 'q', placeholder: 'Search customers: name, IC / passport, phone, email' }], onChange: function () { t.setRows(rowsFor()); },
      extra: '<span class="grow"></span><span class="b2">' + plural(rowsFor().length, 'customer') + '</span>' });

    UI.on(root, 'click', '[data-show]', function (ev, el) { st.show = el.getAttribute('data-show'); ctx.setParams({ show: st.show === 'all' ? '' : st.show }); ctx.refresh(); });
    UI.on(root, 'click', '[data-cu-view]', function (ev, el) { cuOpen(el.getAttribute('data-cu-view')); });
    UI.on(root, 'click', '[data-cu-new]', function (ev, el) { var q = byId(d.people, el.getAttribute('data-cu-new')); if (q) cuNewBooking(q); });
    UI.on(root, 'click', '[data-act="xlsx"]', function () { cuExport(rowsFor(), st.show); });
    UI.on(root, 'click', '[data-act="new"]', function () { API.newBooking(); });
    if (ctx.params.customer) setTimeout(function () { cuOpen(ctx.params.customer); }, 0);
  },
  search: [{ label: 'Blacklisted customers', icon: 'ban', run: function (ctx) { ctx.state.show = 'black'; ctx.refresh(); } }, { label: 'Repeat customers', icon: 'repeat', run: function (ctx) { ctx.state.show = 'repeat'; ctx.refresh(); } }]
};

/* ---------------- Excel export of the list on screen (never the ID scans) ---------------- */
function cuExport(list, show) {
  if (!can('bookings.export') || !can('customers.view')) { UI.toast('Downloading customers needs the "Export" access.', { tone: 'warn' }); return; }
  if (!list.length) { UI.toast('No customers in this list to download.', { tone: 'warn' }); return; }
  var flags = can('customer_notes.view'), day = function (v) { return v ? new Date(v.getFullYear(), v.getMonth(), v.getDate()) : ''; };
  var head = ['Name', 'Phone', 'Country code', 'Country', 'Email', 'IC / Passport', 'Nationality', 'Driving licence', 'Licence expiry', 'Address', 'Emergency contact', 'Emergency phone', 'Relationship', 'Bookings', 'Last booking', 'Last pick-up'].concat(flags ? ['Flags'] : []);
  var by = {};
  var rows = list.map(function (p) {
    var bks = cuBookings(p).sort(function (a, b) { return b.start - a.start; }), f = cuFlags(p), cc = cuCountry(p.phone), em = p.emergency || {};
    var lastPick = bks.filter(function (x) { return x.status !== 'Cancelled' && x.start <= NOW(); })[0];
    var k = cc.code || 'None'; by[k] = by[k] || { code: k, country: cc.country || 'No phone', people: 0, bookings: 0 }; by[k].people++; by[k].bookings += bks.length;
    var fl = [f.black ? 'Blacklisted' : '', f.careful ? 'Be careful' : '', f.vip ? 'VIP' : '', f.repeat ? 'Repeat' : '', f.notes ? 'Has notes' : ''].filter(Boolean).join(', ');
    return [p.name, p.phone || '', cc.code, cc.country, p.email || '', cuSeeIc() ? p.ic || '' : UI.fmt.ic(p.ic || ''), p.nat || '', p.licenceNo || '', day(p.licenceExp), p.address || '', em.name || '', em.phone || '', em.rel || '', bks.length, bks[0] ? bks[0].code : '', lastPick ? day(lastPick.start) : ''].concat(flags ? [fl] : []);
  });
  var cc = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.people - a.people || (a.code < b.code ? -1 : 1); });
  var name = 'customers' + (show && show !== 'all' ? '-' + show : '') + '-' + UI.isoDate(NOW()) + '.xlsx';
  UI.xlsx(name, [
    { name: 'Customers', rows: [head].concat(rows), cols: [24, 18, 12, 18, 28, 18, 14, 16, 14, 40, 20, 18, 14, 10, 14, 14, 30], filter: true, dateFormat: 'dd mmm yyyy' },
    { name: 'By country code', rows: [['Country code', 'Country', 'Customers', 'Bookings']].concat(cc.map(function (r) { return [r.code, r.country, r.people, r.bookings]; })).concat([['Total', '', list.length, sum(cc.map(function (r) { return r.bookings; }))]]), cols: [14, 26, 12, 12] }
  ]);
  DB.log('Exported', 'Customer', '', DB.actor() + ' downloaded ' + plural(list.length, 'customer') + ' as Excel');
}

/* ---------------- Customer Details drawer ---------------- */
var CU_DR = null;
function cuOpen(id) {
  if (!can('customers.view')) { UI.toast('Seeing customers needs the "See customers" access.', { tone: 'warn' }); return; }
  var d = D(), p = byId(d.people, id); if (!p) { UI.toast('That customer was not found', { tone: 'warn' }); return; }
  if (CU_DR && !CU_DR.closed && CU_DR.data.id === id) return CU_DR;
  var onPage = S.page === 'customers' && CUR && CUR.ctx;
  var editing = false;
  function head() {
    var f = cuFlags(p), btn = '';
    if (can('customers.blacklist_edit')) btn = f.black ? UI.btn('Blacklisted', { kind: 'c', size: 'sm', icon: 'ban', cls: 'cu-blk on', attrs: { 'data-cu-black': 'off', title: 'On the blacklist. Click to take this customer off it.', 'aria-label': 'Blacklisted. Take this customer off the blacklist' } }) : UI.btn('Blacklist Customer', { kind: 'o', size: 'sm', icon: 'ban', cls: 'cu-blk', attrs: { 'data-cu-black': 'on', title: 'Put this customer on the blacklist', 'aria-label': 'Blacklist this customer' } });
    else if (f.black && can('customers.blacklist_view')) btn = UI.chip('Blacklisted', 'bad', { icon: 'lock', title: 'Only people with "Change the blacklist" can change this' });
    return btn;
  }
  function body(el) {
    var f = cuFlags(p), bks = cuBookings(p).sort(function (a, b) { return b.start - a.start; });
    var info = editing ? '<div class="cu-g2">' + UI.input({ key: 'name', label: 'Full Name', value: p.name, required: true }) + UI.input({ key: 'phone', label: 'Phone Number', value: p.phone, required: true }) + UI.input({ key: 'email', label: 'Email', type: 'email', value: p.email }) +
      UI.select({ key: 'nat', label: 'Nationality', options: LISTS.nationalities, value: p.nat }) + UI.textarea({ key: 'address', label: 'Residential Address', value: p.address, rows: 2 }) + UI.input({ key: 'ic', label: 'IC / Passport No', value: p.ic }) + UI.input({ key: 'licenceNo', label: 'Driver License No', value: p.licenceNo }) + UI.dateField({ key: 'licenceExp', label: 'License Expiry', value: p.licenceExp, chips: false, placeholder: 'Not set' }) + '</div>' +
      '<div class="row gap8" style="justify-content:flex-end">' + UI.btn('Cancel', { kind: 't', size: 'sm', attrs: { 'data-cu-edit': 'cancel' } }) + UI.btn('Save details', { size: 'sm', icon: 'check', attrs: { 'data-cu-edit': 'save' } }) + '</div>'
      : '<div class="cu-kv">' + UI.kv('Full Name', esc(p.name)) + UI.kv('Phone Number', UI.phone(p.phone, { wa: true })) + UI.kv('Email', esc(p.email)) + UI.kv('Nationality', esc(p.nat)) + UI.kv('Residential Address', esc(p.address), { full: true }) +
        UI.kv('IC / Passport No', '<span class="num">' + cuIcText(p.ic) + '</span>') + UI.kv('Total Booking', String(bks.length)) + UI.kv('Driver License No', esc(p.licenceNo)) + UI.kv('License Expiry', UI.fmt.date(p.licenceExp) + (p.licenceExp < NOW() ? ' ' + UI.chip('Expired', 'bad') : '')) + '</div>';
    var em = p.emergency || {};
    return cuBanner(p) +
      '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('user') + 'Personal info</h3>' + (can('customers.edit') && !editing ? UI.btn('Edit details', { kind: 't', size: 'sm', icon: 'pencil', attrs: { 'data-cu-edit': 'on' } }) : '') + '</div>' + info + '</section>' +
      '<section class="cu-sec" id="cu-notes"></section>' +
      '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('phone-call') + 'Emergency contact</h3></div><div class="cu-kv three">' + UI.kv('Name', esc(em.name)) + UI.kv('Phone', UI.phone(em.phone)) + UI.kv('Relationship', esc(em.rel)) + '</div></section>' +
      (can('customers.check_ic') ? '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('id-badge-2') + 'Check IC</h3></div><div id="cu-ic"></div></section>' : '') +
      '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('calendar-event') + 'Bookings (' + bks.length + ')</h3>' + (can('bookings.create') && (!f.black || can('customers.blacklist_edit')) ? UI.btn('New Booking', { kind: 'tonal', size: 'sm', icon: 'plus', attrs: { 'data-cu-nb': 1 } }) : '') + '</div><div class="cu-bks">' +
      (bks.length ? bks.map(function (x) {
        return '<div class="cu-bk"><div class="grow"><b>' + x.code + ' - ' + esc(x.cust.name) + '</b><div class="b2">' + esc(x.car.plate) + ' (' + esc(carName(x.car)) + ')</div><div class="b2">' + UI.fmt.dmy(x.start) + ' to ' + UI.fmt.dmy(x.end) + '</div><div class="row gap6 wrap" style="margin-top:4px"><span class="b2">Status:</span>' + UI.status('booking', x.status, null, { sm: true }) + UI.status('payment', x.pay || 'None', null, { sm: true }) + '</div></div>' + UI.btn('View Details', { kind: 'tonal', size: 'sm', icon: 'eye', attrs: { 'data-cu-bk': x.code } }) + '</div>';
      }).join('') : '<div class="b2">No bookings yet.</div>') + '</div></section>' +
      (can('customers.view_documents') ? '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('files') + 'Documents</h3></div><div id="cu-docs"></div></section>' : '');
  }
  var dr = UI.drawer({
    title: p.name, subtitle: [plural(cuBookings(p).filter(function (x) { return x.status !== 'Cancelled'; }).length, 'rental'), p.nat, cuSince(p) ? 'since ' + cuSince(p) : ''].filter(Boolean).join(' · '), width: 860, data: { id: id },
    actions: head(),
    body: function (el) {
      el.innerHTML = body(el);
      var n = el.querySelector('#cu-notes'); if (n) cuNotesMount(n, p, { onChange: function () { refreshTop(); } });
      var ic = el.querySelector('#cu-ic'); if (ic) cuIcMount(ic, p, {});
      var dc = el.querySelector('#cu-docs'); if (dc) cuDocsMount(dc, p.docs || (p.docs = {}), { readonly: true, person: p });
    },
    foot: [{ label: 'Close', kind: 'o' }].concat(can('bookings.create') ? [{ label: 'New Booking', icon: 'calendar-plus', onClick: function () { if (cuFlags(p).black) { cuNewBooking(p); return false; } setTimeout(function () { API.newBooking({ customer: p.id }); }, 200); } }] : []),
    onClose: function () { if (onPage && S.page === 'customers') CUR.ctx.setParams({ customer: '' }); }
  });
  CU_DR = dr;
  if (onPage) CUR.ctx.setParams({ customer: id });
  function refreshTop() { dr.setActions(head()); var b = dr.body.querySelector('.cu-ban'); var nb = cuBanner(p); if (b) { if (nb) b.outerHTML = nb; else b.remove(); } else if (nb) dr.body.insertAdjacentHTML('afterbegin', nb); }
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, x;
    if ((x = t.closest('[data-cu-black]'))) {
      if (x.getAttribute('data-cu-black') === 'on') UI.confirm({ title: 'Blacklist ' + p.name + '?', text: 'Every booking of this customer will show a red warning, and new bookings with the same IC or phone are flagged.', ok: 'Blacklist', danger: true, input: { label: 'Why? (staff see this on every booking)', placeholder: 'For example: returned the car late and stopped answering', required: true } }).then(function (why) {
        if (!why) return; DB.update('people', p, { blacklist: { since: NOW(), reason: why } }, { where: 'Customer', text: DB.actor() + ' added ' + p.name + ' to the blacklist' }); cuSyncFlag(p); dr.refresh(); refreshTop(); UI.toast('Customer added to blacklist successfully.');
      });
      else UI.confirm({ title: 'Take ' + p.name + ' off the blacklist?', text: 'Their bookings stop showing the red warning. The notes stay.', ok: 'Remove from blacklist' }).then(function (y) {
        if (!y) return; DB.update('people', p, { blacklist: null }, { where: 'Customer', text: DB.actor() + ' removed ' + p.name + ' from the blacklist' }); cuSyncFlag(p); dr.refresh(); refreshTop(); UI.toast('Customer removed from blacklist successfully.');
      });
      return;
    }
    if ((x = t.closest('[data-cu-edit]'))) {
      var v = x.getAttribute('data-cu-edit');
      if (v === 'save') { var f = UI.form(dr.body.querySelector('.cu-sec')); if (!f.name || !f.phone) { UI.toast('Type the name and the phone number', { tone: 'warn' }); return; } DB.update('people', p, { name: f.name, phone: f.phone, email: f.email, nat: f.nat, address: f.address, ic: f.ic, licenceNo: f.licenceNo, licenceExp: f.licenceExp ? UI.parseDate(f.licenceExp) : p.licenceExp }, { where: 'Customer', text: DB.actor() + ' changed the details of ' + f.name }); UI.toast('Details saved'); }
      editing = v === 'on'; dr.refresh(); return;
    }
    if ((x = t.closest('[data-cu-bk]'))) { API.openBooking(x.getAttribute('data-cu-bk')); return; }
    if (t.closest('[data-cu-nb]')) { cuNewBooking(p); }
  });
  return dr;
}
API.openCustomer = function (id) { return cuOpen(id); };
/* older links (data-a="cust" with the list index) open the new drawer */
A.cust = function (v) { var p = D().people[+v]; if (p) cuOpen(p.id); };
DRAWERS['cust'] = function (dr) { var p = D().people[dr.i]; S.drawer = null; if (p) setTimeout(function () { cuOpen(p.id); }, 0); return ''; };

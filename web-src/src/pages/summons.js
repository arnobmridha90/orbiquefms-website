/* ===================================================================
   Page: Summons (#page=summons, &view=, &booking=, &summons=<id>, &action=add|import|upload)   Owner: builder 4
   Inventory section 9. Record each PDRM / JPJ / council summons, find the booking that had the car at the time,
   charge that customer over WhatsApp and record the payment (a booking payment "Other payment" plus a receipt).
   Pictures are "read" in the browser as a demo: the details come from the file name and the fleet, not from the
   picture itself (the dialog says so). Sets API.openSummons(id).
   =================================================================== */

var SMS_AUTH = [['PDRM', 'PDRM (police)'], ['JPJ', 'JPJ (road transport)'], ['Other', 'Other (council, toll, etc.)']];
var SMS_OFFENCES = ['Exceeding the speed limit', 'Beating a red light', 'Parking in a no-parking zone', 'Using the emergency lane', 'Not wearing a seat belt', 'Double parking', 'Using a phone while driving', 'No road tax shown'];
var SMS_PLACES = ['Jalan Contoh 3, KM 12', 'Lebuhraya Sampel, KM 41.2', 'Persiaran Demo, near the mall', 'Jalan Ujian 7', 'Lebuh Contoh, toll plaza exit'];
var SMS_OPEN = function (s) { return s.status !== 'Paid' && s.status !== 'Waived'; };

/* ---------------- extra sample data: a picture still to check, a picture with nothing read, one with two bookings ---------------- */
DATA_INIT.push(function (d, brand) {
  if (d.smsReady) return; d.smsReady = true;
  var R = rng(9090 + brand.code.charCodeAt(0)), ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  d.summons.forEach(function (s) { s.check = s.check || []; s.note = s.note || ''; s.payment = s.payment || null; s.addedAt = s.addedAt || s.at; });
  /* the picture that still needs a check: the number could not be read */
  var rv = d.summons.filter(function (s) { return s.fromPicture && !s.reviewed; })[0];
  if (rv) { rv.reading = { notice: rv.notice }; rv.notice = ''; rv.check = ['notice', 'offence']; }
  d.summons.forEach(function (s) { if (s.fromPicture && !s.reading) s.reading = { notice: s.notice }; });
  /* a picture where nothing could be read */
  var t = new Date(TODAY.getTime() - 2 * DAY - 5 * 36e5);
  d.summons.push({ id: 'sum-' + (d.summons.length + 1), authority: 'PDRM', council: '', notice: '', plate: '', car: null, at: null, offence: '', speed: 0, limit: 0, place: '', fine: 0, fee: 20, asked: 0, booking: null, candidates: [], chosenByHand: false,
    fromPicture: true, reviewed: false, picture: { name: 'IMG_20261017_0931.jpg', blurry: true }, reading: {}, check: ['notice', 'plate', 'at', 'fine', 'offence'], status: 'Needs a booking', paidOn: null, receipt: null, reason: '', addedAt: t, addedBy: d.users[0].name, chargedAt: null, note: '', payment: null });
  /* two bookings of one car that touch: a summons at that moment matches both */
  var live = d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start < TODAY; }), pair = null;
  live.forEach(function (a) { if (pair) return; live.forEach(function (b) { if (pair || a === b || a.car !== b.car) return; if (b.start >= a.start && b.start <= a.end && b.start < TODAY) pair = [a, b]; }); });
  if (pair) {
    d.summons.push({ id: 'sum-' + (d.summons.length + 1), authority: 'JPJ', council: '', notice: 'JPJ-' + ri(1000, 9999) + '-' + ri(10000, 99999), plate: pair[0].car.plate, car: pair[0].car.id, at: new Date(pair[1].start.getTime()), offence: 'Beating a red light', speed: 0, limit: 0, place: SMS_PLACES[3], fine: 300, fee: 20, asked: 0,
      booking: null, candidates: [pair[0].code, pair[1].code], chosenByHand: false, fromPicture: false, reviewed: true, picture: null, check: [], status: 'Needs a booking', paidOn: null, receipt: null, reason: '', addedAt: new Date(TODAY.getTime() - 26 * 36e5), addedBy: d.users[0].name, chargedAt: null, note: '', payment: null });
  }
  /* paid summons: the payment and its receipt on the booking */
  var rcpMax = 0; d.receipts.forEach(function (r) { var n = +String(r.no).split('-').pop(); if (n > rcpMax) rcpMax = n; });
  d.summons.forEach(function (s) {
    if (s.status !== 'Paid' || !s.booking || s.payment) return;
    var amt = s.asked || s.fine + s.fee, when = s.paidOn > TODAY ? new Date(TODAY.getTime() - DAY) : s.paidOn;
    var p = { id: 'pay-sms-' + s.id, booking: s.booking, kind: 'Other payment', amount: amt, method: 'Online Transfer', at: when, by: d.users[0].name, depositedTo: 'Bank', heldBy: null, afterCharge: null, ref: 'FT' + ri(10000000, 99999999), note: 'Summons ' + s.authority + ' ' + s.notice, receipt: null, void: null, banked: null, slips: [], summons: s.id };
    var r = { no: 'RCP-' + TODAY.getFullYear() + '-' + String(++rcpMax).padStart(5, '0'), id: null, payment: p.id, booking: s.booking, issued: new Date(when.getTime() + 6e5), amount: amt, kind: 'Other payment', method: p.method, status: 'Issued', voidReason: '', sent: [] };
    r.id = r.no; p.receipt = r.no; d.payments.push(p); d.receipts.push(r); s.payment = p.id; s.receipt = r.no; s.paidOn = when;
  });
});

/* ---------------- helpers ---------------- */
function smsPlateKey(p) { return String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function smsCarOf(plate, d) { var k = smsPlateKey(plate); if (!k) return null; return (d || D()).cars.filter(function (c) { return smsPlateKey(c.plate) === k; })[0] || null; }
function smsTitle(s) { var a = s.authority === 'Other' ? (s.council || 'Other') : s.authority; return s.notice ? a + ' ' + s.notice : a + ' notice (number not read)'; }
function smsSpeed(s) { return s.speed ? (s.limit ? s.speed + ' km/h in a ' + s.limit + ' km/h zone' : s.speed + ' km/h') : ''; }
function smsAuthLabel(s) { return s.authority === 'Other' ? (s.council || 'Other') : s.authority; }
/* who had the car: {state: one|ambiguous|none|notfleet|unknown, car, list} */
function smsLookup(s, d) {
  d = d || D();
  if (!s.plate || !s.at) return { state: 'unknown', car: smsCarOf(s.plate, d), list: [] };
  var car = smsCarOf(s.plate, d); if (!car) return { state: 'notfleet', car: null, list: [] };
  var t = +s.at, list = d.bookings.filter(function (x) { return x.car === car && x.status !== 'Cancelled' && +x.start <= t && +x.end >= t; });
  return { state: list.length === 1 ? 'one' : list.length > 1 ? 'ambiguous' : 'none', car: car, list: list };
}
/* bookings of that car close to the time but not covering it (two days either side) */
function smsNear(s, d) {
  d = d || D(); var car = smsCarOf(s.plate, d); if (!car || !s.at) return [];
  var t = +s.at, w = 2 * DAY;
  return d.bookings.filter(function (x) { return x.car === car && x.status !== 'Cancelled' && !(+x.start <= t && +x.end >= t) && +x.start - w <= t && +x.end + w >= t; }).sort(function (a, b) { return Math.min(Math.abs(a.start - t), Math.abs(a.end - t)) - Math.min(Math.abs(b.start - t), Math.abs(b.end - t)); });
}
function smsRestatus(s) {
  if (['Charged', 'Paid', 'Waived', 'Disputed'].indexOf(s.status) >= 0) return s.status;
  return !s.booking ? 'Needs a booking' : s.fromPicture && !s.reviewed ? 'Check, then charge' : 'Ready to charge';
}
/* look the booking up again (unless chosen by hand); returns the patch */
function smsMatchPatch(s, force) {
  var p = {};
  var L = smsLookup(s);
  p.car = L.car ? L.car.id : null;
  if (s.chosenByHand && !force) return p;
  p.chosenByHand = false;
  p.booking = L.state === 'one' ? L.list[0].code : null;
  p.candidates = L.state === 'ambiguous' ? L.list.map(function (x) { return x.code; }) : [];
  return p;
}
function smsReason(s) {
  if (s.booking) return '';
  if (s.candidates && s.candidates.length > 1) return 'More than one booking had the car.';
  var L = smsLookup(s);
  if (L.state === 'notfleet') return s.plate + ' is not one of our cars. Check the plate on the notice: one wrong letter or number is enough.';
  if (L.state === 'unknown') return 'No booking can be looked up yet.';
  return 'No booking had the car at that moment.';
}
function smsCanCharge(s) { return SMS_OPEN(s) && !!s.booking && !(s.fromPicture && !s.reviewed); }
function smsView(s) {
  var open = SMS_OPEN(s) && s.status !== 'Disputed';
  return { review: s.fromPicture && !s.reviewed && SMS_OPEN(s), nobook: !s.booking && SMS_OPEN(s) && !(s.candidates && s.candidates.length > 1), pick: !s.booking && SMS_OPEN(s) && s.candidates && s.candidates.length > 1, ready: open && s.status === 'Ready to charge', charged: s.status === 'Charged', paid: s.status === 'Paid' };
}
function smsHash(str) { var h = 7; String(str).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return h; }
/* a picture of the notice for summons whose picture was added before this session */
function smsPicture(s) {
  if (!s.picture) return null;
  if (s.picture.dataUrl && /^data:image/.test(s.picture.dataUrl)) return s.picture.dataUrl;
  var b = s.picture.blurry, rd = s.reading || {}, notice = rd.notice || s.notice || '', when = s.at ? UI.fmt.dateTime(s.at) : '', pl = s.plate || '';
  var line = function (y, label, val) { return '<text x="40" y="' + y + '" font-size="15" fill="#333">' + esc(label) + '</text><text x="210" y="' + y + '" font-size="17" font-weight="700" fill="#111"' + (b ? ' opacity=".25"' : '') + '>' + esc(val) + '</text>'; };
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><defs><filter id="f"><feGaussianBlur stdDeviation="' + (b ? 2.6 : 0.3) + '"/></filter></defs><rect width="600" height="800" fill="#f3efe4"/><g filter="url(#f)" font-family="sans-serif">' +
    '<rect x="24" y="24" width="552" height="752" fill="none" stroke="#8b8167" stroke-width="2"/><text x="300" y="80" text-anchor="middle" font-size="24" font-weight="700" fill="#1d2b4f">NOTIS SAMAN (SAMPLE)</text><text x="300" y="108" text-anchor="middle" font-size="14" fill="#555">' + esc(smsAuthLabel(s)) + ' · made-up notice for the demo</text><line x1="40" x2="560" y1="130" y2="130" stroke="#8b8167"/>' +
    line(180, 'No. notis', notice || (b ? '########' : '')) + line(225, 'No. pendaftaran', pl || (b ? '### ####' : '')) + line(270, 'Tarikh / masa', when || (b ? '##/##/#### ##:##' : '')) + line(315, 'Kesalahan', s.offence || (b ? '###########' : '')) + line(360, 'Tempat', s.place || '') +
    (s.speed ? line(405, 'Kelajuan', s.speed + ' km/j (had ' + s.limit + ' km/j)') : '') + line(460, 'Kompaun (RM)', s.fine ? s.fine.toFixed(2) : (b ? '###.##' : '')) +
    '<rect x="40" y="520" width="520" height="200" fill="none" stroke="#bbb" stroke-dasharray="6 6"/><text x="300" y="625" text-anchor="middle" font-size="14" fill="#999">camera picture</text></g></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function smsNextReceipt(d) { var mx = 0; d.receipts.forEach(function (r) { var n = +String(r.no).split('-').pop(); if (n > mx) mx = n; }); var pre = String((d.company && d.company.numbering && d.company.numbering.rcpPrefix) || 'RCP').replace(/-+$/, ''); return pre + '-' + NOW().getFullYear() + '-' + String(mx + 1).padStart(5, '0'); }
function smsMessage(s) {
  var x = findBooking(s.booking), b = B();
  return 'Hello ' + (x ? x.cust.name.split(' ')[0] : '') + ', this is ' + b.name + '. A ' + smsAuthLabel(s) + ' summons was issued for ' + (x ? carName(x.car) + ' ' : '') + s.plate + ' while it was rented to you (booking ' + s.booking + ').\n\n' +
    'Notice: ' + (s.notice || 'not shown') + '\nWhen: ' + (s.at ? UI.fmt.dateTime(s.at) : '-') + '\nOffence: ' + (s.offence || '-') + (smsSpeed(s) ? ' (' + smsSpeed(s) + ')' : '') + (s.place ? '\nWhere: ' + s.place : '') +
    '\nFine: ' + UI.fmt.money(s.fine) + (s.fee ? '\nOur admin fee: ' + UI.fmt.money(s.fee) : '') + '\n\nPlease pay ' + UI.fmt.money(s.asked) + '. Reply here if you have any question.';
}
function smsWaLink(phone, text) { var digits = String(phone || '').replace(/\D/g, ''); return digits.length >= 9 ? 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text) : ''; }

/* ---------------- the form (Add a summons and the Details block) ---------------- */
function smsFormHtml(v, o) {
  o = o || {}; var ro = o.readonly, onlyNote = o.onlyNote, chk = o.check || [], rd = o.reading;
  var note = function (k) { if (!rd) return ''; return chk.indexOf(k) >= 0 ? 'Not found on the picture. Type it in.' : 'Read from the picture'; };
  var dis = ro || onlyNote;
  var at = v.at ? UI.isoDateTime(v.at) : '';
  return '<div class="grid g2 sms-form">' +
    UI.select({ key: 'authority', label: 'Issued by', options: SMS_AUTH, value: v.authority || 'PDRM', disabled: dis, attrs: { 'data-sms': 'auth' } }) +
    '<div class="sms-council"' + (v.authority === 'Other' ? '' : ' hidden') + '>' + UI.input({ key: 'council', label: 'Council or office', value: v.council, placeholder: 'For example DBKL or MBPJ', readonly: dis }) + '</div>' +
    UI.input({ key: 'notice', label: 'Notice / summons number', value: v.notice, readonly: dis, help: note('notice'), error: o.err && o.err.notice }) +
    UI.input({ key: 'plate', label: 'Car plate', value: v.plate, readonly: dis, help: note('plate'), error: o.err && o.err.plate, attrs: { autocapitalize: 'characters' } }) +
    UI.input({ key: 'at', label: 'Date and time of the offence', type: 'datetime-local', value: at, readonly: dis, help: note('at'), error: o.err && o.err.at }) +
    UI.input({ key: 'offence', label: 'What the offence was', value: v.offence, readonly: dis, help: note('offence'), attrs: { list: 'sms-offences' } }) +
    '<datalist id="sms-offences">' + SMS_OFFENCES.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
    UI.input({ key: 'speed', label: 'Speed (km/h)', type: 'number', min: 0, value: v.speed || '', readonly: dis, help: 'The higher number on the notice.', error: o.err && o.err.speed }) +
    UI.input({ key: 'limit', label: 'Speed limit (km/h)', type: 'number', min: 0, value: v.limit || '', readonly: dis, help: 'The lower number' }) +
    UI.input({ key: 'place', label: 'Where it happened', value: v.place, readonly: dis, full: true }) +
    UI.input({ key: 'fine', label: 'Fine (RM)', type: 'number', min: 0, step: '0.01', prefix: 'RM', value: v.fine || '', readonly: dis, help: note('fine'), error: o.err && o.err.fine }) +
    UI.input({ key: 'fee', label: 'Our admin fee (RM)', type: 'number', min: 0, step: '0.01', prefix: 'RM', value: v.fee == null ? '' : v.fee, readonly: dis, help: 'Optional. Added when you charge the customer.' }) +
    UI.textarea({ key: 'note', label: 'Notes', rows: 2, value: v.note, readonly: ro }) + '</div>';
}
function smsReadForm(el) {
  var f = UI.form(el);
  return { authority: f.authority || 'PDRM', council: f.authority === 'Other' ? String(f.council || '').trim() : '', notice: String(f.notice || '').trim().toUpperCase(), plate: String(f.plate || '').trim().toUpperCase().replace(/\s+/g, ' '),
    at: f.at ? UI.parseDate(f.at) : null, offence: String(f.offence || '').trim(), speed: +f.speed || 0, limit: +f.limit || 0, place: String(f.place || '').trim(), fine: Math.round((+f.fine || 0) * 100) / 100, fee: Math.round((+f.fee || 0) * 100) / 100, note: String(f.note || '').trim() };
}
function smsCheckForm(v, strict) {
  var err = {};
  if (strict && !v.plate) err.plate = 'Type the car plate.';
  if (strict && !v.at) err.at = 'Choose the date and time.';
  if (strict && !(v.fine > 0)) err.fine = 'Type the fine.';
  if (v.at && v.at > NOW()) err.at = 'The offence cannot be in the future.';
  if (v.speed && v.limit && v.speed <= v.limit) err.speed = 'The speed should be higher than the limit.';
  if (v.notice && D().summons.some(function (s) { return s.notice === v.notice && s.id !== strict; })) err.notice = 'A summons with this number is already in the list.';
  return err;
}
function smsWireForm(el) { el.addEventListener('change', function (ev) { if (ev.target.matches('[data-sms="auth"]')) { var c = el.querySelector('.sms-council'); if (c) c.hidden = ev.target.value !== 'Other'; } }); }

/* ---------------- dialogs ---------------- */
function smsAdd(prefill, onClosed) {
  if (!can('summons.add')) { UI.toast('Your login cannot add summons.', { tone: 'warn' }); return; }
  var v = Object.assign({ authority: 'PDRM', fee: 20 }, prefill || {}), err = {};
  var dl = UI.dialog({ title: 'Add a summons', width: 'lg', onClose: function () { if (onClosed) onClosed(); }, body: function (el) { el.innerHTML = '<p class="b2 sms-lead">We look for the booking that had the car at that time and tie it for you.</p>' + smsFormHtml(v, { err: err }); }, buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Add summons', icon: 'plus', onClick: function (dlg) {
    v = smsReadForm(dlg.body); err = smsCheckForm(v, true);
    if (Object.keys(err).length) { dlg.refresh(); UI.toast('Check the fields marked in red.', { tone: 'warn' }); return false; }
    var s = Object.assign(v, { id: 'sum-' + Date.now().toString(36), car: null, asked: 0, booking: null, candidates: [], chosenByHand: false, fromPicture: false, reviewed: true, picture: null, check: [], status: '', paidOn: null, receipt: null, reason: '', addedAt: NOW(), addedBy: DB.actor(), chargedAt: null, payment: null });
    Object.assign(s, smsMatchPatch(s, true)); s.status = smsRestatus(s);
    DB.add('summons', s, { first: true, text: DB.actor() + ' added summons ' + smsTitle(s) + ' (' + s.plate + ')' });
    var x = findBooking(s.booking);
    UI.toast(x ? 'Summons added and tied to ' + x.code + ' (' + x.cust.name + ').' : s.candidates.length > 1 ? 'Summons added. ' + s.candidates.length + ' bookings had the car: choose one.' : 'Summons added. ' + smsReason(s), { tone: x ? 'ok' : 'warn', action: { label: 'Open', run: function () { API.openSummons(s.id); } }, ms: 6000 });
  } }] });
  smsWireForm(dl.body);
  return dl;
}
function smsCharge(s, after) {
  var x = findBooking(s.booking); if (!x) return;
  var start = s.status === 'Charged' && s.asked ? s.asked : s.fine + (s.fee || 0);
  UI.dialog({ title: s.status === 'Charged' ? 'Change the amount' : 'Charge the customer', width: 'md',
    body: '<div class="col gap12"><p class="b2" style="margin:0">Choose how much to ask ' + esc(x.cust.name) + ' for. It starts as the fine plus your admin fee, and you can change it. Then WhatsApp opens with the message ready.</p>' + UI.input({ key: 'amt', label: 'Amount to ask for (RM)', type: 'number', min: 0, step: '0.01', prefix: 'RM', value: start.toFixed(2), help: 'Fine ' + UI.fmt.money(s.fine) + ' + admin fee ' + UI.fmt.money(s.fee || 0) }) + '</div>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Charge and open WhatsApp', icon: 'brand-whatsapp', onClick: function (dlg) {
      var a = Math.round((+UI.form(dlg.body).amt || 0) * 100) / 100; if (!(a > 0)) { UI.toast('Type the amount to ask for.', { tone: 'warn' }); return false; }
      var was = s.status;
      DB.update('summons', s, { asked: a, status: 'Charged', chargedAt: s.chargedAt && was === 'Charged' ? s.chargedAt : NOW() }, { action: was === 'Charged' ? 'Changed' : 'Charged', text: DB.actor() + (was === 'Charged' ? ' changed the amount asked for summons ' : ' charged ') + (was === 'Charged' ? smsTitle(s) + ' to ' + UI.fmt.money(a) : x.cust.name + ' ' + UI.fmt.money(a) + ' for summons ' + smsTitle(s)) });
      smsSend(s, true);
      if (after) after();
    } }] });
}
function smsSend(s, first) {
  var x = findBooking(s.booking); if (!x) return;
  var txt = smsMessage(s), link = smsWaLink(x.cust.phone, txt);
  if (!first) DB.log('Sent', 'Summons', s.id, DB.actor() + ' sent the summons message for ' + smsTitle(s) + ' to ' + x.cust.name + ' again on WhatsApp');
  UI.dialog({ title: first ? 'Charged. Send the message' : 'Send WhatsApp again', width: 'md',
    body: '<div class="tsk-wa sms-wa"><div class="tsk-wa-to">' + i('brand-whatsapp') + '<span>To ' + esc(x.cust.name) + ' ' + UI.phone(x.cust.phone) + '</span></div><div class="tsk-bubble">' + esc(txt).replace(/\n/g, '<br>') + '</div></div>' + (link ? '' : UI.alert('This phone number cannot be used on WhatsApp. Copy the message and send it another way.', 'warn')),
    buttons: [{ label: 'Copy message', kind: 'o', icon: 'copy', onClick: function () { UI.copy(txt, { label: 'Message copied' }); return false; } }, { label: 'Open WhatsApp', kind: 'tonal', icon: 'brand-whatsapp', disabled: !link, onClick: function () { var w = null; try { w = window.open(link, '_blank', 'noopener'); } catch (e) { w = null; } if (!w) UI.toast('WhatsApp could not open here. Copy the message instead.', { tone: 'warn' }); return false; } }, { label: 'Done' }] });
}
function smsPaid(s, after) {
  var x = findBooking(s.booking); if (!x) return;
  var slip = null;
  var dl = UI.dialog({ title: 'Mark as paid', width: 'md',
    body: function (el) { el.innerHTML = '<div class="col gap12"><p class="b2" style="margin:0">The payment is recorded on booking ' + x.code + ' as "Other payment" and a receipt is made.</p>' + UI.input({ key: 'amt', label: 'Amount received (RM)', type: 'number', min: 0, step: '0.01', prefix: 'RM', value: (s.asked || s.fine + (s.fee || 0)).toFixed(2) }) + UI.choice({ key: 'method', label: 'How they paid', value: 'Online Transfer', options: LISTS.methods }) + UI.input({ key: 'when', label: 'When', type: 'datetime-local', value: UI.isoDateTime(NOW()) }) + UI.input({ key: 'ref', label: 'Slip or reference', placeholder: 'For example the transfer reference' }) + '<div class="sms-slip"></div></div>';
      UI.dropzone(el.querySelector('.sms-slip'), { accept: 'image/*,.pdf', label: slip ? slip.name : 'Add the slip (optional)', hint: slip ? 'Added. Drop another to change it.' : 'A picture or PDF of the transfer slip.', icon: slip ? 'circle-check' : 'receipt', onFiles: function (fs) { UI.readImage(fs[0], { max: 1400 }).then(function (r) { slip = { name: r.name, size: r.size, dataUrl: r.dataUrl, at: NOW() }; var f = UI.form(el); dl.refresh(); el.querySelector('[data-key="amt"]').value = f.amt; el.querySelector('[data-key="ref"]').value = f.ref || ''; el.querySelector('[data-key="when"]').value = f.when; }); } }); },
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Record payment', icon: 'check', onClick: function (dlg) {
      var f = UI.form(dlg.body), a = Math.round((+f.amt || 0) * 100) / 100, when = f.when ? UI.parseDate(f.when) : NOW();
      if (!(a > 0)) { UI.toast('Type the amount received.', { tone: 'warn' }); return false; }
      var d = D(), no = smsNextReceipt(d), pid = 'pay-' + Date.now().toString(36);
      var p = DB.add('payments', { id: pid, booking: x.code, kind: 'Other payment', amount: a, method: f.method || 'Cash', at: when, by: DB.actor(), depositedTo: f.method === 'Card' ? 'Stripe' : f.method === 'Online Transfer' ? 'Bank' : 'Cash to ' + DB.actor(), heldBy: f.method === 'Cash' ? DB.actor() : null, afterCharge: null, ref: f.ref || '', note: 'Summons ' + smsTitle(s), receipt: no, void: null, banked: null, slips: slip ? [slip] : [], summons: s.id }, { text: DB.actor() + ' recorded ' + UI.fmt.money(a) + ' for summons ' + smsTitle(s) + ' on ' + x.code });
      DB.add('receipts', { no: no, id: no, payment: p.id, booking: x.code, issued: NOW(), amount: a, kind: 'Other payment', method: p.method, status: 'Issued', voidReason: '', sent: [] }, { text: DB.actor() + ' issued receipt ' + no });
      DB.update('summons', s, { status: 'Paid', paidOn: when, receipt: no, payment: p.id, asked: s.asked || a }, { action: 'Paid', text: DB.actor() + ' marked summons ' + smsTitle(s) + ' as paid (' + UI.fmt.money(a) + ')' });
      UI.toast('Payment recorded. Receipt ' + no + ' made.', { tone: 'ok', action: API.previewDoc ? { label: 'See the receipt', run: function () { API.previewDoc(no); } } : null });
      if (after) after();
    } }] });
}
function smsReasonDialog(s, kind, after) {
  var dispute = kind === 'Disputed';
  UI.confirm({ title: dispute ? 'Mark as disputed' : 'Waive this summons', text: dispute ? 'Use this while the fine is being challenged with PDRM or JPJ, or the customer says it is not theirs.' : 'The customer will not be charged. You can open it again later if you change your mind.', ok: dispute ? 'Mark as disputed' : 'Waive', danger: !dispute, input: { label: dispute ? 'What is being disputed?' : 'Why is it being waived?', required: true, multiline: true } }).then(function (r) {
    if (!r) return;
    DB.update('summons', s, { status: kind, reason: String(r), before: s.status }, { action: dispute ? 'Disputed' : 'Waived', text: DB.actor() + (dispute ? ' marked summons ' + smsTitle(s) + ' as disputed' : ' waived summons ' + smsTitle(s)) });
    UI.toast(dispute ? 'Marked as disputed' : 'Summons waived'); if (after) after();
  });
}
function smsReopen(s) {
  var back = s.before && ['Charged'].indexOf(s.before) >= 0 ? s.before : s.chargedAt && s.asked ? 'Charged' : '';
  var st = back || (!s.booking ? 'Needs a booking' : s.fromPicture && !s.reviewed ? 'Check, then charge' : 'Ready to charge');
  DB.update('summons', s, { status: st, reason: '' }, { action: 'Changed', text: DB.actor() + ' opened summons ' + smsTitle(s) + ' again' });
  UI.toast('Opened again: ' + st);
}
function smsDelete(s, after) {
  UI.confirm({ title: 'Delete this summons?', text: smsTitle(s) + (s.plate ? ' for ' + s.plate : '') + ' is removed from the list. Payments already recorded stay on the booking.', ok: 'Delete', cancel: 'Keep it', danger: true }).then(function (y) { if (!y) return; DB.remove('summons', s, { text: DB.actor() + ' deleted summons ' + smsTitle(s) }); UI.toast('Summons deleted'); if (after) after(); });
}

/* ---------------- the summons drawer ---------------- */
function smsDrawer(id, onClosed) {
  var s = DB.get('summons', id); if (!s) { UI.toast('That summons is no longer here.', { tone: 'warn' }); return null; }
  var view = { zoom: 1, rot: 0 }, typed = '', ferr = {};
  var canEdit = can('summons.edit');
  function head() { var c = s.car ? carById(s.car) : smsCarOf(s.plate); return { t: s.notice ? 'Summons ' + s.notice : s.fromPicture ? 'Summons from a picture' : 'Summons', sub: [smsAuthLabel(s), c ? carName(c) : '', s.plate || 'Plate not read'].filter(Boolean).join(' · ') }; }
  function bookingCard(x, o) { o = o || {}; return '<div class="sms-bk' + (o.pick ? ' pick' : '') + '"><div class="row wrap gap8"><button type="button" class="chip pri sms-code" data-act="openbk" data-v="' + x.code + '">' + x.code + '</button><b class="grow">' + esc(x.cust.name) + '</b>' + (o.chosen ? UI.chip('Chosen by you', 'info', { icon: 'hand-click' }) : '') + (o.use ? UI.btn('Use this', { kind: 'tonal', size: 'sm', attrs: { 'data-act': 'use', 'data-v': x.code } }) : '') + '</div><div class="b2">' + UI.fmt.dateTime(x.start) + ' to ' + UI.fmt.dateTime(x.end) + ' · ' + esc(carModel(x.car) + ' ' + x.car.plate) + '</div><div class="b2">' + UI.phone(x.cust.phone) + ' · ' + esc(x.status) + '</div></div>'; }
  function body() {
    var h = '', x = findBooking(s.booking), open = SMS_OPEN(s), review = s.fromPicture && !s.reviewed, locked = s.status === 'Paid';
    if (s.status === 'Waived' || s.status === 'Disputed') h += '<div class="alert ' + (s.status === 'Disputed' ? 'bad' : '') + ' sms-banner">' + i(s.status === 'Disputed' ? 'alert-octagon' : 'circle-off') + '<div class="grow"><b>' + (s.status === 'Disputed' ? 'Disputed' : 'Waived, the customer is not charged') + '</b><div class="b2">' + esc(s.reason || 'No reason given.') + '</div></div>' + (can('summons.waive') || canEdit ? UI.btn('Open again', { kind: 't', size: 'sm', attrs: { 'data-act': 'reopen' } }) : '') + '</div>';
    if (s.picture) {
      var src = smsPicture(s);
      h += '<section class="sms-sec"><div class="sms-sh"><b>Picture of the notice</b><span class="b2 ellip">' + esc(s.picture.name) + '</span></div><div class="sms-pic"><div class="sms-picbox"><img src="' + src + '" alt="The summons notice" style="transform:rotate(' + view.rot + 'deg) scale(' + view.zoom + ')"></div></div><div class="row wrap gap4 sms-pictools">' +
        UI.iconBtn('zoom-out', 'Smaller', { size: 'sm', attrs: { 'data-act': 'zoom', 'data-v': '-1' } }) + UI.iconBtn('zoom-in', 'Bigger', { size: 'sm', attrs: { 'data-act': 'zoom', 'data-v': '1' } }) + UI.btn('Fit', { kind: 't', size: 'sm', attrs: { 'data-act': 'fit' } }) + UI.iconBtn('rotate-2', 'Turn left', { size: 'sm', attrs: { 'data-act': 'turn', 'data-v': '-90' } }) + UI.iconBtn('rotate-clockwise-2', 'Turn right', { size: 'sm', attrs: { 'data-act': 'turn', 'data-v': '90' } }) + UI.btn('Open the original', { kind: 't', size: 'sm', icon: 'external-link', attrs: { 'data-act': 'original' } }) +
        (view.rot && canEdit && open ? UI.btn('Read again turned this way', { kind: 'tonal', size: 'sm', icon: 'scan', attrs: { 'data-act': 'reread' } }) : '') + '</div></section>';
    }
    if (review && open) {
      var names = { notice: 'the notice number', plate: 'the plate', at: 'the date and time', fine: 'the amount', offence: 'what the offence was' }, ck = (s.check || []).map(function (k) { return names[k]; }).filter(Boolean);
      h += '<div class="sms-review"><div class="row">' + i('eye-check') + '<b class="grow">Check what was read from the picture</b></div><p class="b2">Compare each box with the picture, change what is wrong, then press Confirm. ' + (ck.length ? 'Look closely at ' + (ck.length > 1 ? ck.slice(0, -1).join(', ') + ' and ' + ck[ck.length - 1] : ck[0]) + '.' : 'Everything was read clearly, but please compare it with the picture once.') + '</p>' +
        (canEdit ? '<div class="row wrap gap8">' + UI.btn('Confirm details', { icon: 'check', size: 'sm', attrs: { 'data-act': 'confirm' } }) + UI.btn('Read the picture again', { kind: 'o', size: 'sm', icon: 'scan', attrs: { 'data-act': 'reread' } }) + '</div>' : '') + '</div>';
    }
    /* booking */
    h += '<section class="sms-sec"><div class="sms-sh"><b>Booking that had the car</b>' + (canEdit && open && s.status !== 'Charged' && (s.plate && s.at) ? UI.btn('Match again', { kind: 't', size: 'sm', icon: 'refresh', attrs: { 'data-act': 'rematch' } }) : '') + '</div>';
    if (x) h += bookingCard(x, { chosen: s.chosenByHand }) + (canEdit && open && s.status !== 'Charged' ? '<button type="button" class="btn t sm" data-act="unbook">Not this booking</button>' : '');
    else {
      var L = smsLookup(s), near = smsNear(s), others = (s.candidates || []).map(function (c) { return findBooking(c); }).filter(Boolean);
      h += '<div class="alert warn">' + i('link-off') + '<div class="grow">' + esc(others.length > 1 ? 'More than one booking had the car.' : L.state === 'notfleet' ? 'The plate is not one of your cars.' : L.state === 'unknown' ? 'No booking can be looked up yet.' : 'No booking had the car at that moment.') +
        '<div class="b2">' + esc(others.length > 1 ? others.length + ' bookings overlap at that time. Choose the one that really had the car.' : L.state === 'notfleet' ? s.plate + ' is not one of our cars. Check the plate on the notice: one wrong letter or number is enough.' : L.state === 'unknown' ? 'The plate or the date and time are not filled in yet, so no booking can be looked up.' : 'No booking had this car at that date and time. Check the date, or pick a booking by its Booking ID.') + '</div></div></div>';
      if (others.length > 1) h += '<p class="b2 sms-p">Other bookings at that time</p>' + others.map(function (b) { return bookingCard(b, { use: canEdit && open, pick: true }); }).join('');
      if (near.length) h += '<p class="b2 sms-p">Close to that time, but not covering it. You decide whether one of these had the car:</p>' + near.slice(0, 4).map(function (b) { return bookingCard(b, { use: canEdit && open, pick: true }); }).join('');
      if (canEdit && open) h += '<div class="sms-type"><label class="b2" for="sms-typed">Or type a Booking ID</label><div class="row gap8"><span class="inp grow"><input id="sms-typed" data-typed placeholder="' + esc(B().code) + '-00003" value="' + esc(typed) + '"></span>' + UI.btn('Use', { kind: 'o', size: 'sm', attrs: { 'data-act': 'usetyped' } }) + '</div></div>';
    }
    h += '</section>';
    /* money */
    var rcp = s.receipt ? '<button type="button" class="tsk-link" data-act="receipt">' + esc(s.receipt) + '</button>' : '-';
    h += '<section class="sms-sec"><div class="sms-sh"><b>Money</b></div><dl class="sms-money"><dt>Fine</dt><dd>' + UI.money(s.fine) + '</dd><dt>Our admin fee</dt><dd>' + UI.money(s.fee || 0) + '</dd><dt>Fine + fee</dt><dd><b>' + UI.money(s.fine + (s.fee || 0)) + '</b></dd><dt>Asked from the customer</dt><dd>' + (s.asked && (s.chargedAt || s.status === 'Paid') ? UI.money(s.asked) + (s.chargedAt ? '<small>' + UI.fmt.dateTime(s.chargedAt) + '</small>' : '') : '-') + '</dd><dt>Paid on</dt><dd>' + (s.paidOn ? UI.fmt.dateTime(s.paidOn) : '-') + '</dd><dt>Receipt</dt><dd>' + rcp + '</dd></dl>';
    var btns = '';
    if (open) {
      if (review) h += '<p class="b2 sms-lock">' + i('lock') + 'Charging and payments open once you have checked the details read from the picture and pressed Confirm.</p>';
      else if (!s.booking) h += '<p class="b2 sms-lock">' + i('lock') + 'Choose the booking above first. Charging and payments are recorded on that booking.</p>';
      else {
        if (can('summons.charge')) btns += UI.btn(s.status === 'Charged' ? 'Change amount' : 'Charge customer', { icon: s.status === 'Charged' ? 'edit' : 'brand-whatsapp', size: 'sm', kind: s.status === 'Charged' ? 'o' : 'c', attrs: { 'data-act': 'charge' } });
        if (can('summons.charge') && s.status === 'Charged') btns += UI.btn('Send WhatsApp again', { kind: 'o', size: 'sm', icon: 'brand-whatsapp', attrs: { 'data-act': 'resend' } });
        if (can('summons.record_payment')) btns += UI.btn('Mark paid', { kind: s.status === 'Charged' ? 'c' : 'o', size: 'sm', icon: 'cash', attrs: { 'data-act': 'paid' } });
      }
      if (s.status !== 'Disputed' && canEdit) btns += UI.btn('Mark as disputed', { kind: 't', size: 'sm', icon: 'alert-octagon', attrs: { 'data-act': 'dispute' } });
      if (s.status !== 'Waived' && can('summons.waive')) btns += UI.btn('Waive (do not charge)', { kind: 't', size: 'sm', icon: 'circle-off', attrs: { 'data-act': 'waive' } });
    } else if (s.status === 'Paid') h += '<p class="b2 sms-lock">' + i('circle-check') + 'Paid. Only the note can change now.</p>';
    if (btns) h += '<div class="row wrap gap8 sms-btns">' + btns + '</div>';
    h += '</section>';
    /* details */
    h += '<section class="sms-sec"><div class="sms-sh"><b>Details</b></div><div class="sms-details">' + smsFormHtml(s, { readonly: !canEdit, onlyNote: locked, check: review ? s.check : [], reading: review ? s.reading || {} : null, err: ferr }) + '</div>' +
      (canEdit ? '<div class="row">' + UI.btn('Save changes', { kind: 'o', size: 'sm', icon: 'device-floppy', attrs: { 'data-act': 'save' } }) + '</div>' : '') +
      '<p class="b2 faint">Added ' + (s.addedAt ? UI.fmt.dateTime(s.addedAt) : '') + (s.addedBy ? ' by ' + esc(s.addedBy) : '') + '. If you change the plate or the date, the booking is looked up again unless you chose it yourself.</p></section>';
    if (can('summons.delete')) h += '<div class="sms-del">' + UI.btn('Delete this summons', { kind: 'err', size: 'sm', icon: 'trash', attrs: { 'data-act': 'delete' } }) + '</div>';
    return h;
  }
  function useBooking(code) {
    var x = findBooking(code); if (!x) { UI.toast('No booking ' + code + ' was found.', { tone: 'warn' }); return; }
    var go = function () { DB.update('summons', s, { booking: x.code, chosenByHand: true, candidates: [], car: s.car || x.car.id, status: smsRestatus(Object.assign({}, s, { booking: x.code, status: s.status === 'Disputed' ? 'Disputed' : '' })) }, { text: DB.actor() + ' tied summons ' + smsTitle(s) + ' to ' + x.code }); typed = ''; UI.toast('Tied to ' + x.code + ' (' + x.cust.name + ')'); };
    if (s.plate && smsPlateKey(x.car.plate) !== smsPlateKey(s.plate)) UI.confirm({ title: 'A different car?', text: x.code + ' had ' + x.car.plate + ', not ' + s.plate + '. Use it anyway?', ok: 'Use it' }).then(function (y) { if (y) go(); });
    else go();
  }
  function saveDetails(extra) {
    var v = smsReadForm(dr.body.querySelector('.sms-details'));
    if (s.status === 'Paid') { DB.update('summons', s, { note: v.note }); UI.toast('Note saved'); return true; }
    ferr = smsCheckForm(v, s.id); if (Object.keys(ferr).length) { dr.refresh(); UI.toast('Check the fields marked in red.', { tone: 'warn' }); return false; }
    var moved = smsPlateKey(v.plate) !== smsPlateKey(s.plate) || +(v.at || 0) !== +(s.at || 0);
    var patch = Object.assign({}, v, extra || {});
    var probe = Object.assign({}, s, patch);
    if (moved || (extra && extra.reviewed)) Object.assign(patch, smsMatchPatch(probe));
    else patch.car = smsCarOf(v.plate) ? smsCarOf(v.plate).id : null;
    if (patch.check == null && extra && extra.reviewed) patch.check = [];
    patch.status = smsRestatus(Object.assign({}, s, patch));
    DB.update('summons', s, patch, { text: DB.actor() + ' changed summons ' + smsTitle(Object.assign({}, s, patch)) });
    var x = findBooking(s.booking);
    UI.toast(moved && !s.chosenByHand ? (x ? 'Saved. Tied to ' + x.code + '.' : 'Saved. ' + smsReason(s)) : 'Saved', { tone: moved && !x ? 'warn' : 'ok' });
    return true;
  }
  function reread() {
    /* the demo reader: fills in what was missing, as if the picture was clearer this time */
    var v = smsReadForm(dr.body.querySelector('.sms-details')), rd = s.reading || {}, h = smsHash(s.id + view.rot), got = [];
    if (!v.notice) { v.notice = rd.notice || (s.authority === 'JPJ' ? 'JPJ-' : 'PD-') + (1000 + h % 9000) + '-' + (10000 + h % 89999); got.push('the notice number'); }
    if (!v.offence) { v.offence = SMS_OFFENCES[h % SMS_OFFENCES.length]; got.push('the offence'); }
    if (!v.plate && view.rot) { var cars = D().cars; v.plate = cars[h % cars.length].plate; got.push('the plate'); }
    if (!v.at && view.rot) { v.at = new Date(NOW().getTime() - (3 + h % 20) * DAY - (h % 9) * 36e5); got.push('the date'); }
    if (!v.fine && view.rot) { v.fine = [150, 200, 300][h % 3]; got.push('the amount'); }
    if (!got.length) { UI.toast(view.rot ? 'Read again: nothing new was found.' : 'Nothing new was found. Turn the picture if it is sideways, then read it again.', { tone: 'info' }); return; }
    var chk = (s.check || []).filter(function (k) { return !(k === 'notice' && v.notice) && !(k === 'offence' && v.offence) && !(k === 'plate' && v.plate) && !(k === 'at' && v.at) && !(k === 'fine' && v.fine); });
    var patch = Object.assign(v, { check: chk, reading: Object.assign({}, rd, { notice: v.notice }) });
    Object.assign(patch, smsMatchPatch(Object.assign({}, s, patch))); patch.status = smsRestatus(Object.assign({}, s, patch));
    DB.update('summons', s, patch, { text: 'The picture of summons ' + smsTitle(Object.assign({}, s, patch)) + ' was read again' });
    UI.toast('Read again: found ' + got.join(', ') + '. Check them, then press Confirm.', { tone: 'ok' });
  }
  var H = head();
  var dr = UI.drawer({ title: H.t, subtitle: H.sub, width: 640, body: body, live: true, actions: UI.status('summons', s.status),
    foot: [{ label: 'Close', kind: 'o' }], onClose: function () { if (onClosed) onClosed(); } });
  var offData = on('data', function () { if (dr.closed) { offData(); return; } if (D().summons.indexOf(s) < 0) { dr.close(true); return; } var h2 = head(); dr.setTitle(h2.t, h2.sub); dr.setActions(UI.status('summons', s.status)); });
  smsWireForm(dr.body);
  dr.body.addEventListener('input', function (ev) { if (ev.target.matches('[data-typed]')) typed = ev.target.value; });
  dr.body.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.matches('[data-typed]')) { ev.preventDefault(); var b = dr.body.querySelector('[data-act="usetyped"]'); if (b) b.click(); } });
  dr.body.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
    var img = dr.body.querySelector('.sms-picbox img'), apply = function () { if (img) img.style.transform = 'rotate(' + view.rot + 'deg) scale(' + view.zoom + ')'; };
    if (a === 'zoom') { view.zoom = Math.min(4, Math.max(.5, Math.round((view.zoom + (+v) * .25) * 100) / 100)); apply(); }
    else if (a === 'fit') { view.zoom = 1; view.rot = 0; dr.refresh(); }
    else if (a === 'turn') { view.rot = (((view.rot + (+v)) % 360) + 360) % 360; dr.refresh(); }
    else if (a === 'original') UI.dialog({ title: s.picture.name, width: 'xl', body: '<img class="sms-orig" src="' + smsPicture(s) + '" alt="The summons notice">', buttons: [{ label: 'Close' }] });
    else if (a === 'reread') reread();
    else if (a === 'confirm') { if (saveDetails({ reviewed: true, check: [] })) UI.toast('Details confirmed' + (s.booking ? '. Ready to charge.' : '. Now choose the booking.'), { tone: 'ok' }); }
    else if (a === 'rematch') { var p = smsMatchPatch(s, true); p.status = smsRestatus(Object.assign({}, s, p, { status: s.status === 'Disputed' ? 'Disputed' : '' })); DB.update('summons', s, p, { text: DB.actor() + ' looked up the booking of summons ' + smsTitle(s) + ' again' }); var xb = findBooking(s.booking); UI.toast(xb ? 'Matched to ' + xb.code + '.' : smsReason(s), { tone: xb ? 'ok' : 'warn' }); }
    else if (a === 'unbook') { DB.update('summons', s, { booking: null, chosenByHand: false, candidates: [], status: s.status === 'Disputed' ? 'Disputed' : 'Needs a booking' }, { text: DB.actor() + ' untied summons ' + smsTitle(s) + ' from its booking' }); }
    else if (a === 'use') useBooking(v);
    else if (a === 'usetyped') {
      var t = String(typed || '').trim().toUpperCase(); if (!t) { UI.toast('Type a Booking ID.', { tone: 'warn' }); return; }
      var m = /(\d{1,12})$/.exec(t), code = findBooking(t) ? t : m ? B().code + '-' + String(+m[1]).padStart(5, '0') : t;
      useBooking(code);
    }
    else if (a === 'openbk') API.openBooking(v);
    else if (a === 'receipt') { if (API.previewDoc) API.previewDoc(s.receipt); }
    else if (a === 'charge') smsCharge(s);
    else if (a === 'resend') smsSend(s, false);
    else if (a === 'paid') smsPaid(s);
    else if (a === 'dispute') smsReasonDialog(s, 'Disputed');
    else if (a === 'waive') smsReasonDialog(s, 'Waived');
    else if (a === 'reopen') smsReopen(s);
    else if (a === 'save') saveDetails();
    else if (a === 'delete') smsDelete(s, function () { dr.close(true); });
  });
  return dr;
}
API.openSummons = function (id) { return smsDrawer(id); };

/* ---------------- import a list ---------------- */
function smsParseDate(str) {
  str = String(str || '').trim(); if (!str) return null;
  var m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T,]+(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)?)?$/.exec(str);
  if (m) { var h = +(m[4] || 0); if (m[6]) { h = h % 12 + (/p/i.test(m[6]) ? 12 : 0); } var dt = new Date(+m[3], +m[2] - 1, +m[1], h, +(m[5] || 0)); return isNaN(dt) || dt.getMonth() !== +m[2] - 1 ? null : dt; }
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(str);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  return null;
}
function smsSplit(line) { var out = [], cur = '', q = false; for (var k = 0; k < line.length; k++) { var c = line[k]; if (c === '"') { if (q && line[k + 1] === '"') { cur += '"'; k++; } else q = !q; } else if ((c === ',' || c === '\t' || c === ';') && !q) { out.push(cur.trim()); cur = ''; } else cur += c; } out.push(cur.trim()); return out; }
function smsImport(onClosed) {
  if (!can('summons.import')) { UI.toast('Your login cannot import summons.', { tone: 'warn' }); return; }
  var st = { step: 1, text: '', file: '', rows: [], skip: {}, err: '' }, d = D();
  var cars = d.cars.filter(function (c) { return c.fleet !== 'Sold'; });
  var example = 'PDRM,PD123456,' + cars[0].plate + ',Exceeding speed limit,Jalan Contoh 3,13/09/2026 2:30 PM,150\nJPJ,J778899,' + cars[1 % cars.length].plate + ',No road tax shown,Lebuhraya Sampel,20-09-2026 09:05,300';
  function check() {
    var lines = st.text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length && /authority|notice/i.test(lines[0])) lines.shift();
    if (!lines.length) { st.err = 'Paste some rows or choose a file first.'; return false; }
    if (lines.length > 500) { st.err = 'That is ' + lines.length + ' rows. The most is 500 rows at a time: split the file.'; return false; }
    var seen = {};
    st.rows = lines.map(function (l, k) {
      var c = smsSplit(l), r = { line: k + 1, raw: l, auth: (c[0] || '').toUpperCase(), notice: (c[1] || '').toUpperCase(), plate: (c[2] || '').toUpperCase().replace(/\s+/g, ' '), offence: c[3] || '', place: c[4] || '', at: smsParseDate(c[5]), fine: +(String(c[6] || '').replace(/[^\d.]/g, '')) || 0 };
      r.auth = r.auth === 'PDRM' || r.auth === 'JPJ' ? r.auth : r.auth ? 'Other' : 'PDRM'; r.council = r.auth === 'Other' ? c[0] : '';
      r.problem = c.length < 7 ? 'Needs 7 columns, found ' + c.length + '.' : !r.plate ? 'No plate.' : !r.at ? 'The date "' + (c[5] || '') + '" could not be read.' : r.at > NOW() ? 'The date is in the future.' : !(r.fine > 0) ? 'No amount.' : '';
      r.dup = r.notice && d.summons.some(function (s) { return s.notice === r.notice; }) ? 'Already in the list' : r.notice && seen[r.notice] ? 'Repeated in the file' : '';
      if (r.notice) seen[r.notice] = 1;
      if (!r.problem) { var L = smsLookup({ plate: r.plate, at: r.at }); r.L = L; }
      return r;
    });
    st.err = ''; st.skip = {}; return true;
  }
  function body(el) {
    if (st.step === 1) {
      el.innerHTML = '<div class="col gap12"><div class="b2"><b>Step 1 of 2:</b> paste rows or choose a file</div><p class="b2" style="margin:0">One summons per row, in this order: who issued it, notice number, plate, offence, where, date and time, amount.</p>' +
        '<div class="row wrap gap8"><label class="btn o sm" for="sms-csv">' + i('file-type-csv') + 'Choose a CSV file</label><input id="sms-csv" type="file" accept=".csv,text/csv,.txt" hidden>' + UI.btn('Show an example', { kind: 't', size: 'sm', attrs: { 'data-x': 'example' } }) + (st.file ? '<span class="chip grey">' + i('file') + esc(st.file) + '</span>' : '') + '</div>' +
        UI.textarea({ key: 'rows', label: 'Or paste rows here', rows: 8, value: st.text, placeholder: example.split('\n')[0] }) + (st.err ? '<span class="ui-err">' + esc(st.err) + '</span>' : '') +
        '<p class="b2 faint" style="margin:0">Nothing is saved in this step. You see each row and what was found before anything is added. At most 500 rows at a time.</p></div>';
      el.querySelector('#sms-csv').addEventListener('change', function (ev) { var f = ev.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { st.text = String(rd.result || ''); st.file = f.name; dl.refresh(); }; rd.readAsText(f); });
      el.querySelector('[data-x="example"]').addEventListener('click', function () { st.text = example; dl.refresh(); });
      el.querySelector('[data-key="rows"]').addEventListener('input', function (ev) { st.text = ev.target.value; });
      return;
    }
    var ready = st.rows.filter(function (r) { return !r.problem && !r.dup; }), matched = ready.filter(function (r) { return r.L && r.L.state === 'one'; }).length, dups = st.rows.filter(function (r) { return r.dup; }).length, probs = st.rows.filter(function (r) { return r.problem; }).length;
    el.innerHTML = '<div class="col gap12"><div class="b2"><b>Step 2 of 2:</b> check the rows</div><p class="b2" style="margin:0">' + [ready.length + ' ready to add'].concat(matched ? [matched + ' matched to a booking'] : []).concat(dups ? [dups + ' already in the list or repeated'] : []).concat(probs ? [probs + ' with a problem'] : []).join(', ') + '.</p>' +
      '<div class="sms-imp"><table class="tbl"><thead><tr><th>Add?</th><th>Line</th><th>Notice</th><th>Plate</th><th>Offence date</th><th class="r">Fine</th><th>Booking found</th><th>Note</th></tr></thead><tbody>' + st.rows.map(function (r) {
        var ok = !r.problem && !r.dup, L = r.L, found = !L ? '<span class="faint">-</span>' : L.state === 'one' ? UI.chip(L.list[0].code, 'ok') : L.state === 'ambiguous' ? UI.chip(L.list.length + ' bookings: choose later', 'warn') : L.state === 'notfleet' ? UI.chip('Not one of our cars', 'bad') : UI.chip('No booking at that time', 'bad');
        return '<tr class="' + (ok ? '' : 'off') + '"><td><label class="cb"><input type="checkbox" data-line="' + r.line + '"' + (ok && !st.skip[r.line] ? ' checked' : '') + (ok ? '' : ' disabled') + ' aria-label="Add line ' + r.line + '"><span class="box">' + i('check') + '</span></label></td><td>' + r.line + '</td><td class="nw">' + esc(r.notice || '-') + '</td><td class="nw">' + esc(r.plate || '-') + '</td><td class="nw">' + (r.at ? UI.fmt.dateTime(r.at) : '-') + '</td><td class="r nw">' + (r.fine ? UI.money(r.fine) : '-') + '</td><td>' + found + '</td><td>' + (r.dup ? UI.chip(r.dup, 'grey') : r.problem ? '<span class="b2 tsk-bad">' + esc(r.problem) + '</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    el.querySelectorAll('[data-line]').forEach(function (cb) { cb.addEventListener('change', function () { st.skip[cb.getAttribute('data-line')] = !cb.checked; dl.setFoot(foot()); }); });
  }
  function toAdd() { return st.rows.filter(function (r) { return !r.problem && !r.dup && !st.skip[r.line]; }); }
  function foot() {
    if (st.step === 1) return [{ label: 'Cancel', kind: 'g' }, { label: 'Check the rows', icon: 'arrow-right', onClick: function () { var ta = dl.body.querySelector('[data-key="rows"]'); if (ta) st.text = ta.value; if (!check()) { dl.refresh(); return false; } st.step = 2; dl.setTitle('Import summons', 'Step 2 of 2'); dl.refresh(); dl.setFoot(foot()); return false; } }];
    var n = toAdd().length;
    return [{ label: 'Back', kind: 'g', onClick: function () { st.step = 1; dl.setTitle('Import summons', 'Step 1 of 2'); dl.refresh(); dl.setFoot(foot()); return false; } }, { label: 'Add ' + plural(n, 'summons').replace('summonss', 'summons'), icon: 'check', disabled: !n, onClick: function () {
      var list = toAdd(), tied = 0;
      list.forEach(function (r) {
        var s = { id: 'sum-' + Date.now().toString(36) + r.line, authority: r.auth, council: r.council, notice: r.notice, plate: r.plate, car: null, at: r.at, offence: r.offence, speed: 0, limit: 0, place: r.place, fine: r.fine, fee: 20, asked: 0, booking: null, candidates: [], chosenByHand: false, fromPicture: false, reviewed: true, picture: null, check: [], status: '', paidOn: null, receipt: null, reason: '', addedAt: NOW(), addedBy: DB.actor(), chargedAt: null, note: 'Imported from ' + (st.file || 'pasted rows'), payment: null };
        Object.assign(s, smsMatchPatch(s, true)); s.status = smsRestatus(s); if (s.booking) tied++;
        DB.add('summons', s, { first: true, silent: true, text: DB.actor() + ' imported summons ' + smsTitle(s) });
      });
      DB.log('Imported', 'Summons', '', DB.actor() + ' imported ' + plural(list.length, 'summons').replace('summonss', 'summons') + (st.file ? ' from ' + st.file : ''));
      UI.toast(plural(list.length, 'summons').replace('summonss', 'summons') + ' added, ' + tied + ' tied to a booking.', { tone: 'ok' });
    } }];
  }
  var dl = UI.dialog({ title: 'Import summons', subtitle: 'Step 1 of 2', width: 'xl', body: body, buttons: foot(), onClose: function () { if (onClosed) onClosed(); } });
  return dl;
}

/* ---------------- upload pictures (the reading is a demo) ---------------- */
function smsUpload(files, onClosed) {
  if (!can('summons.upload')) { UI.toast('Your login cannot upload summons pictures.', { tone: 'warn' }); return; }
  var d0 = D(), items = [], running = false, stopAfter = false, seq = 0;
  function add(fs) {
    fs.forEach(function (f) {
      var key = f.name + '|' + f.size; if (items.some(function (x) { return x.key === key; })) return;
      var ext = (f.name.split('.').pop() || '').toLowerCase(), it = { id: 'up' + (++seq), key: key, file: f, name: f.name, size: f.size, state: 'queued', tries: 0 };
      if (/heic|heif/.test(ext) || /heic|heif/.test(f.type)) { it.state = 'failed'; it.error = 'iPhone HEIC pictures cannot be read here. Choose the picture from the Photos app, take a new photo, or send a screenshot.'; it.retry = false; }
      else if (!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(f.type) && f.type !== 'application/pdf' && ['jpg', 'jpeg', 'png', 'webp', 'pdf'].indexOf(ext) < 0) { it.state = 'failed'; it.error = 'Only JPEG, PNG, WebP pictures and PDF files can be used.'; it.retry = false; }
      else if (!f.size) { it.state = 'failed'; it.error = 'This file is empty.'; it.retry = false; }
      items.push(it);
    });
    draw(); pump();
  }
  function outcome(it) {
    if (it.state === 'queued') return UI.chip('Waiting', 'grey', { icon: 'clock' });
    if (it.state === 'sending') return UI.chip('Reading...', 'info', { icon: 'loader-2' });
    if (it.state === 'failed') return UI.chip('Not added', 'bad', { icon: 'alert-circle' });
    var o = it.res.outcome, rv = it.res.review;
    return o === 'tied' ? UI.chip(rv ? 'Tied to booking, check details' : 'Tied to booking', rv ? 'warn' : 'ok', { icon: 'link' }) : o === 'no_booking' ? UI.chip('No booking', 'bad', { icon: 'link-off' }) : o === 'several' ? UI.chip('Choose a booking', 'warn', { icon: 'arrows-split' }) : o === 'unread' ? UI.chip('Could not read: saved as draft', 'warn', { icon: 'eye-off' }) : UI.chip('Already in the list', 'grey', { icon: 'copy' });
  }
  function readOne(it) {
    return new Promise(function (res) {
      var h = smsHash(it.name + it.size);
      setTimeout(function () {
        if (D() !== d0) { res(); return; }
        it.tries++;
        if (h % 9 === 4 && it.tries === 1) { it.state = 'failed'; it.error = 'The connection dropped while sending. Try again.'; it.retry = true; res(); return; }
        var dup = d0.summons.filter(function (s) { return s.picture && s.picture.name === it.name; })[0];
        if (dup) { it.state = 'done'; it.res = { outcome: 'duplicate', id: dup.id }; res(); return; }
        var pic = { name: it.name, size: it.size };
        var finish = function () {
          var s = { id: 'sum-' + Date.now().toString(36) + it.id, authority: h % 4 === 1 ? 'JPJ' : 'PDRM', council: '', notice: '', plate: '', car: null, at: null, offence: '', speed: 0, limit: 0, place: '', fine: 0, fee: 20, asked: 0, booking: null, candidates: [], chosenByHand: false, fromPicture: true, reviewed: false, picture: pic, check: [], status: '', paidOn: null, receipt: null, reason: '', addedAt: NOW(), addedBy: DB.actor(), chargedAt: null, note: '', payment: null, reading: {} };
          if (h % 7 === 5) { s.check = ['notice', 'plate', 'at', 'fine', 'offence']; pic.blurry = !pic.dataUrl; it.res = { outcome: 'unread', review: true }; }
          else {
            var past = d0.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.end < NOW() && x.start > NOW() - 120 * DAY; });
            var x = past[h % past.length], car = x ? x.car : d0.cars[h % d0.cars.length];
            s.notice = (s.authority === 'JPJ' ? 'JPJ-' : 'PD-') + (1000 + h % 9000) + '-' + (10000 + (h >>> 3) % 89999); s.plate = car.plate; s.offence = SMS_OFFENCES[h % SMS_OFFENCES.length]; s.place = SMS_PLACES[h % SMS_PLACES.length]; s.fine = [150, 200, 300][h % 3];
            if (/speed/i.test(s.offence)) { s.limit = [80, 90, 110][h % 3]; s.speed = s.limit + 12 + h % 30; }
            s.at = h % 5 === 2 || !x ? new Date((x ? +x.start : +NOW()) - (4 + h % 6) * DAY - 3 * 36e5) : new Date(+x.start + (+x.end - +x.start) * ((h % 7 + 1) / 9));
            s.reviewed = h % 3 !== 0; if (!s.reviewed) s.check = h % 2 ? ['fine'] : ['offence'];
            s.reading = { notice: s.notice };
          }
          Object.assign(s, smsMatchPatch(s, true)); s.status = smsRestatus(s);
          if (it.res && it.res.outcome === 'unread') s.status = 'Needs a booking';
          else it.res = { outcome: s.booking ? 'tied' : s.candidates.length > 1 ? 'several' : 'no_booking', review: !s.reviewed };
          it.res.id = s.id; it.res.read = [smsTitle(s), s.plate || 'plate not read', s.at ? UI.fmt.dateTime(s.at) : 'date not read', s.fine ? UI.fmt.money(s.fine) : 'amount not read'];
          DB.add('summons', s, { first: true, text: DB.actor() + ' added summons ' + smsTitle(s) + ' from a picture' });
          it.state = 'done'; res();
        };
        if (/^image\//.test(it.file.type) && it.file.size < 8e6) UI.readImage(it.file, { max: 1600 }).then(function (r) { pic.dataUrl = r.dataUrl; finish(); }).catch(function () { finish(); });
        else finish();
      }, 900 + h % 600);
    });
  }
  function pump() {
    if (running) return; running = true; stopAfter = false; draw();
    (function next() {
      var it = items.filter(function (x) { return x.state === 'queued'; })[0];
      if (!it || stopAfter || dl.closed) { running = false; draw(); return; }
      it.state = 'sending'; draw();
      readOne(it).then(function () { draw(); next(); });
    })();
  }
  function body(el) {
    var done = items.filter(function (x) { return x.state === 'done' || x.state === 'failed'; }).length, look = items.filter(function (x) { return x.state === 'done' && x.res && x.res.outcome !== 'duplicate' && (x.res.review || x.res.outcome !== 'tied'); });
    var sumLine = (function () { var c = { tied: 0, no_booking: 0, several: 0, unread: 0, duplicate: 0 }, f = 0; items.forEach(function (x) { if (x.state === 'failed') f++; else if (x.state === 'done') c[x.res.outcome]++; }); var p = []; if (c.tied) p.push(c.tied + ' tied to a booking'); if (c.no_booking) p.push(c.no_booking + ' with NO booking'); if (c.several) p.push(c.several + ' need a booking chosen'); if (c.unread) p.push(c.unread + ' could not be read'); if (c.duplicate) p.push(plural(c.duplicate, 'duplicate') + ' skipped'); if (f) p.push(f + ' not added'); return p.join(', '); })();
    el.innerHTML = '<div class="col gap12"><p class="b2" style="margin:0">Each picture is read, matched to the booking that had the car, and checked against the summons you already have.</p>' + UI.alert('Reading pictures is a demo in this sample: the details are made up from the file and your fleet, not read from the picture.', 'pri', { icon: 'info-circle' }) +
      '<div class="sms-updz"></div>' + (items.length ? '<div class="col gap4"><div class="row b2"><span class="grow">' + done + ' of ' + items.length + ' done' + (sumLine ? ': ' + esc(sumLine) + '.' : '') + '</span>' + (running ? '<span class="chip info">' + i('loader-2') + 'Reading</span>' : '') + '</div>' + UI.progress(items.length ? done / items.length * 100 : 0, 'ok') + '</div>' : '') +
      '<div class="sms-uplist">' + items.map(function (it) {
        var acts = '';
        if (it.state === 'done' && it.res.outcome === 'duplicate') acts = UI.btn('Open that one', { kind: 't', size: 'sm', attrs: { 'data-u': 'open', 'data-v': it.res.id } });
        else if (it.state === 'done') acts = (it.res.review || it.res.outcome !== 'tied' ? UI.btn('Check it', { kind: 'tonal', size: 'sm', attrs: { 'data-u': 'open', 'data-v': it.res.id } }) : UI.btn('Open', { kind: 't', size: 'sm', attrs: { 'data-u': 'open', 'data-v': it.res.id } }));
        else if (it.state === 'failed') acts = (it.retry !== false ? UI.btn('Try again', { kind: 'o', size: 'sm', attrs: { 'data-u': 'retry', 'data-v': it.id } }) : '') + UI.btn('Remove', { kind: 't', size: 'sm', attrs: { 'data-u': 'remove', 'data-v': it.id } });
        else if (it.state === 'queued') acts = UI.btn('Remove', { kind: 't', size: 'sm', attrs: { 'data-u': 'remove', 'data-v': it.id } });
        var thumb = it.file && /^image\/(png|jpe?g|gif|webp|bmp|svg)/.test(it.file.type) ? '<img class="sms-th" src="' + (it.url || (it.url = URL.createObjectURL(it.file))) + '" alt="">' : '<span class="sms-th">' + i(/pdf/.test(it.file && it.file.type) ? 'file-type-pdf' : 'file') + '</span>';
        return '<div class="sms-uprow">' + thumb + '<div class="grow"><div class="row wrap gap6"><b class="ellip">' + esc(it.name) + '</b><span class="b2">' + UI.fmt.size(it.size) + '</span></div><div class="row wrap gap6">' + outcome(it) + (it.state === 'done' && it.res.review ? UI.chip('Needs a check', 'warn') : '') + '</div>' +
          (it.state === 'done' && it.res.outcome !== 'duplicate' ? '<div class="b2">' + (it.res.outcome === 'unread' ? 'Nothing could be read from the picture.' : esc(it.res.read.join(' · '))) + '</div>' : '') + (it.state === 'failed' ? '<div class="b2 tsk-bad">' + esc(it.error) + '</div>' : '') + '</div><div class="row wrap gap4 sms-upacts">' + acts + '</div></div>';
      }).join('') + '</div></div>';
    UI.dropzone(el.querySelector('.sms-updz'), { accept: 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf', multiple: true, camera: true, label: items.length ? 'Add more pictures' : 'Drop the pictures of the notices here', hint: 'Photos, screenshots or PDFs. You can also paste with Ctrl+V.', onFiles: add });
  }
  function foot() {
    var failed = items.filter(function (x) { return x.state === 'failed' && x.retry !== false; }).length, queued = items.filter(function (x) { return x.state === 'queued'; }).length;
    var look = items.filter(function (x) { return x.state === 'done' && x.res && x.res.outcome !== 'duplicate' && (x.res.review || x.res.outcome !== 'tied'); }).length;
    var f = [];
    if (running) f.push({ label: 'Stop after this one', kind: 'o', icon: 'player-pause', onClick: function () { stopAfter = true; UI.toast('Stopping after this picture.', { tone: 'info', ms: 1600 }); return false; } });
    else if (queued) f.push({ label: 'Continue', kind: 'o', icon: 'player-play', onClick: function () { pump(); return false; } });
    if (failed && !running) f.push({ label: 'Try ' + failed + ' again', kind: 'o', icon: 'refresh', onClick: function () { items.forEach(function (x) { if (x.state === 'failed' && x.retry !== false) x.state = 'queued'; }); pump(); return false; } });
    f.push({ spacer: true });
    if (look && !running) f.push({ label: 'Check the ' + look + ' that need a look', kind: 'tonal', onClick: function () { if (window.__smsGoReview) window.__smsGoReview(); } });
    f.push({ label: running ? 'Close (keeps reading)' : 'Done', kind: 'c' });
    return f;
  }
  function draw() { if (!dl || dl.closed) return; var sc = dl.body.scrollTop; dl.refresh(); dl.body.scrollTop = sc; dl.setFoot(foot()); }
  var dl = UI.dialog({ title: 'Upload summons images', width: 'lg', body: body, buttons: foot(), onClose: function () { if (onClosed) onClosed(); items.forEach(function (x) { if (x.url) { try { URL.revokeObjectURL(x.url); } catch (e) { /* ignore */ } } }); } });
  dl.body.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-u]'); if (!b) return;
    var a = b.getAttribute('data-u'), v = b.getAttribute('data-v');
    if (a === 'open') { dl.close(true); API.openSummons(v); }
    else if (a === 'retry') { var it = items.filter(function (x) { return x.id === v; })[0]; if (it) { it.state = 'queued'; pump(); } }
    else if (a === 'remove') { items = items.filter(function (x) { return x.id !== v; }); draw(); }
  });
  if (files && files.length) add(files);
  return dl;
}

/* ---------------- the page ---------------- */
PAGES['summons'] = {
  title: 'Summons',
  search: [{ label: 'Add a summons', icon: 'gavel', hint: 'Summons', run: function () { smsAdd(); } }, { label: 'Import summons', icon: 'file-import', hint: 'Summons', run: function () { smsImport(); } }, { label: 'Upload summons pictures', icon: 'photo-up', hint: 'Summons', run: function () { smsUpload(); } }],
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data, p = ctx.params || {};
    st.f = st.f || {};
    if (p.view) st.f.view = p.view;
    if (!st.f.view) st.f.view = 'all';
    st.bk = p.booking || '';
    window.__smsGoReview = function () { UI.closeAll && UI.closeAll(); st.f.view = 'review'; ctx.setParams({ view: 'review' }); ctx.refresh(); };
    var C = { add: ctx.can('summons.add'), up: ctx.can('summons.upload'), imp: ctx.can('summons.import') };
    function counts() {
      var n = { review: 0, nobook: 0, pick: 0, ready: 0, charged: 0, paid: 0, all: d.summons.length }, mo = new Date(NOW().getFullYear(), NOW().getMonth(), 1);
      var m = { nobook: 0, review: 0, ready: 0, chargedM: 0, paidM: 0, nC: 0, nP: 0 };
      d.summons.forEach(function (s) { var v = smsView(s); Object.keys(v).forEach(function (k) { if (v[k]) n[k]++; }); if (v.nobook) m.nobook += s.fine; if (v.review) m.review += s.fine; if (v.ready) m.ready += s.fine; if (s.chargedAt && s.chargedAt >= mo && (s.status === 'Charged' || s.status === 'Paid')) { m.nC++; m.chargedM += s.asked; } if (s.status === 'Paid' && s.paidOn && s.paidOn >= mo) { m.nP++; m.paidM += s.asked || s.fine + s.fee; } });
      return { n: n, m: m };
    }
    function rows() {
      var v = st.f.view, q = (st.f.q || '').trim().toLowerCase();
      return d.summons.filter(function (s) {
        if (st.bk && s.booking !== st.bk) return false;
        var w = smsView(s);
        if (v === 'review' && !w.review) return false; if (v === 'nobook' && !w.nobook) return false; if (v === 'pick' && !w.pick) return false; if (v === 'ready' && !w.ready) return false; if (v === 'charged' && !w.charged) return false; if (v === 'paid' && !w.paid) return false;
        if (q) { var x = findBooking(s.booking); var hay = [s.notice, s.plate, smsPlateKey(s.plate), s.booking, s.authority, s.council, s.offence, x ? x.cust.name : ''].join(' ').toLowerCase(); if (hay.indexOf(q) < 0) return false; }
        return true;
      }).sort(function (a, b) { return (+(b.at || b.addedAt || 0)) - (+(a.at || a.addedAt || 0)); });
    }
    function draw() {
      var K = counts(), n = K.n, m = K.m;
      var nb = d.summons.filter(function (s) { return smsView(s).nobook; }), nbFleet = nb.filter(function (s) { return smsLookup(s).state === 'none'; }).length, nbPlate = nb.filter(function (s) { return smsLookup(s).state === 'notfleet'; }).length, nbOther = nb.length - nbFleet - nbPlate;
      var alert = nb.length ? '<div class="alert bad sms-alert" role="alert">' + i('alert-circle') + '<div class="grow"><b>' + plural(nb.length, 'summons').replace('summonss', 'summons') + ' ' + (nb.length === 1 ? 'has' : 'have') + ' no booking (' + UI.fmt.money(sum(nb.map(function (s) { return s.fine; }))) + ').</b> ' + [nbFleet ? nbFleet + ' for a car of yours that nobody had at that time' : '', nbPlate ? nbPlate + ' with a plate that is not one of your cars' : '', nbOther ? nbOther + ' with the plate or the date not read yet' : ''].filter(Boolean).join(' / ') + '. Nobody can be charged for these until you find out who had the car.</div>' + UI.btn('Show them', { kind: 't', size: 'sm', attrs: { 'data-act': 'view', 'data-v': 'nobook' } }) + '</div>' : '';
      var card = function (id, label, note, cnt, money, tone, icon) { return '<button type="button" class="card sms-cnt' + (st.f.view === id ? ' on' : '') + ' ' + tone + '" data-act="view" data-v="' + id + '" aria-pressed="' + (st.f.view === id) + '"><span class="sms-ci">' + i(icon) + '</span><span class="grow"><span class="sms-cl">' + label + '</span><b class="num">' + cnt + '</b><span class="b2">' + note + ' · ' + UI.money(money) + '</span></span></button>'; };
      root.innerHTML = '<div class="pg-h"><div><h1>Summons</h1><p>Record each PDRM or JPJ summons. We find the booking that had the car at that time, and you charge that customer.</p></div><div class="acts">' +
        (C.up ? UI.btn('Upload pictures', { icon: 'photo-up', attrs: { 'data-act': 'upload' } }) : '') + (C.imp ? UI.btn('Import', { kind: 'o', icon: 'file-import', attrs: { 'data-act': 'import' } }) : '') + (C.add ? UI.btn('Add summons', { kind: 'o', icon: 'plus', attrs: { 'data-act': 'add' } }) : '') + '</div></div>' +
        '<div class="col gap16">' + alert + (C.up ? '<div class="sms-drop"></div>' : '') +
        '<div class="sms-cnts">' + card('nobook', 'No booking', 'nobody had the car', n.nobook, m.nobook, 'bad', 'link-off') + card('review', 'Needs review', 'read from pictures', n.review, m.review, 'warn', 'eye-check') + card('ready', 'Ready to charge', 'tap to see them', n.ready, m.ready, 'info', 'brand-whatsapp') + card('charged', 'Charged this month', 'asked from customers', m.nC, m.chargedM, 'pri', 'send') + card('paid', 'Paid this month', 'received', m.nP, m.paidM, 'ok', 'circle-check') + '</div>' +
        (st.bk ? UI.alert('Showing the summons of one booking only (' + st.bk + ').', 'pri', { action: UI.btn('Show all', { kind: 't', size: 'sm', attrs: { 'data-act': 'allbk' } }) }) : '') +
        '<div class="card sms-card"><div class="sms-flt"></div><div class="sms-tbl"></div></div></div>';
      if (C.up) UI.dropzone(root.querySelector('.sms-drop'), { accept: 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf', multiple: true, camera: true, icon: 'photo-scan', label: 'Upload summons images', hint: 'Drop photos, screenshots or PDFs of the notices here. We read the date, time and plate, find who had the car, and skip any we already have.', onFiles: function (fs) { smsUpload(fs); } });
      var chips = [['review', 'Needs review', n.review, 'warn'], ['nobook', 'No booking', n.nobook, n.nobook ? 'bad' : ''], ['pick', 'Pick a booking', n.pick, 'info'], ['ready', 'Ready to charge', n.ready], ['charged', 'Charged', n.charged], ['paid', 'Paid', n.paid], ['all', 'All', n.all]].filter(function (c) { return c[0] !== 'pick' || c[2] || st.f.view === 'pick'; });
      UI.filters(root.querySelector('.sms-flt'), { values: st.f, fields: [{ type: 'chips', key: 'view', options: chips, default: 'all' }, { type: 'search', key: 'q', placeholder: 'Notice, plate, customer or Booking ID' }], onChange: function (v, k) { if (k === 'view' || k === '*') { ctx.setParams({ view: st.f.view === 'all' || !st.f.view ? '' : st.f.view }); } if (k === '*') st.f.view = 'all'; tbl.setRows(rows()); } });
      var empty = d.summons.length ? { icon: 'filter-off', title: 'Nothing matches this view', text: 'Try another tab, or clear the search.', action: UI.btn('Show everything', { kind: 'o', size: 'sm', attrs: { 'data-act': 'everything' } }) } : { icon: 'gavel', title: 'No summons recorded yet', text: 'Add the pictures of the notices, type one in, or import a list.', action: '<div class="row wrap gap8" style="justify-content:center">' + (C.up ? UI.btn('Upload the first pictures', { size: 'sm', icon: 'photo-up', attrs: { 'data-act': 'upload' } }) : '') + (C.add ? UI.btn('Type one in', { kind: 'o', size: 'sm', attrs: { 'data-act': 'add' } }) : '') + (C.imp ? UI.btn('Import a list', { kind: 'o', size: 'sm', attrs: { 'data-act': 'import' } }) : '') + '</div>' };
      var carCell = function (s) { var c = s.car ? carById(s.car) : null; return c ? '<span class="nw">' + esc(carModel(c)) + '</span><br><b class="nw">' + esc(c.plate) + '</b>' : s.plate ? '<span class="nw">' + esc(s.plate) + ' <span class="faint">(not in fleet)</span></span>' : UI.chip('Plate not read', 'bad'); };
      var bkCell = function (s) {
        var x = findBooking(s.booking), w = smsView(s), marks = (w.nobook ? UI.chip('No booking', 'bad', { sm: true }) : '') + (w.review ? UI.chip('Needs review', 'warn', { sm: true }) : '') + (s.picture ? '<span class="sms-picmark" title="Read from a picture">' + i('photo') + '</span>' : '');
        return (x ? '<div class="row wrap gap6"><button type="button" class="chip pri sms-code" data-act="openbk" data-v="' + x.code + '">' + x.code + '</button><span>' + esc(x.cust.name) + '</span></div>' : '<div>' + UI.chip(s.candidates && s.candidates.length > 1 ? plural(s.candidates.length, 'booking') + ': choose one' : 'Not tied yet', 'warn') + '</div>') + (marks ? '<div class="row wrap gap4 sms-marks">' + marks + '</div>' : '') + (!x && smsReason(s) ? '<div class="b2 sms-why">' + esc(smsReason(s)) + '</div>' : '');
      };
      var tbl = UI.table(root.querySelector('.sms-tbl'), {
        columns: [
          { key: 'notice', label: 'Summons', sort: function (s) { return smsTitle(s); }, render: function (s) { return '<div class="sms-t"><b>' + esc(smsTitle(s)) + '</b><span class="b2">' + esc(s.offence || s.place || (s.authority === 'Other' && s.council ? s.council : '')) + '</span>' + (smsSpeed(s) ? UI.chip(smsSpeed(s), 'warn', { sm: true, icon: 'gauge' }) : '') + '</div>'; } },
          { key: 'car', label: 'Car', render: carCell },
          { key: 'booking', label: 'Booking and customer', render: bkCell },
          { key: 'at', label: 'Offence date', sort: function (s) { return +(s.at || 0); }, nowrap: true, render: function (s) { return s.at ? UI.fmt.date(s.at) + '<br><span class="b2">' + tm(s.at) + '</span>' : '<span class="faint">Date not read</span>'; } },
          { key: 'fine', label: 'Amount', align: 'right', sort: true, render: function (s) { return s.fine ? UI.money(s.fine) : '<span class="faint">-</span>'; } },
          { key: 'status', label: 'Status', sort: true, render: function (s) { return UI.status('summons', s.status); } }
        ],
        rows: rows(), rowKey: 'id', density: 'compact', pageSize: 25, pageSizes: [25, 50, 100], minWidth: 1000,
        onRowClick: function (s) { open(s.id); },
        card: function (s) { return '<div class="sms-c"><div class="row"><b class="grow">' + esc(smsTitle(s)) + '</b>' + UI.status('summons', s.status) + '</div><div class="b2">' + esc(s.offence || '') + (s.at ? ' · ' + UI.fmt.dateTime(s.at) : ' · Date not read') + '</div>' + (smsSpeed(s) ? '<div>' + UI.chip(smsSpeed(s), 'warn', { sm: true, icon: 'gauge' }) + '</div>' : '') + '<div class="row wrap gap8"><span>' + carCell(s).replace(/<br>/g, ' ') + '</span><b class="grow num" style="text-align:right">' + (s.fine ? UI.money(s.fine) : '') + '</b></div>' + bkCell(s) + '</div>'; },
        empty: empty
      });
      st.tbl = tbl;
    }
    function open(id) { ctx.setParams({ summons: id }); smsDrawer(id, function () { ctx.setParams({ summons: '' }); }); }
    UI.on(root, 'click', '[data-act]', function (ev, el) {
      var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
      if (a === 'view') { st.f.view = st.f.view === v ? 'all' : v; ctx.setParams({ view: st.f.view === 'all' ? '' : st.f.view }); draw(); }
      else if (a === 'everything') { st.f.view = 'all'; st.f.q = ''; st.bk = ''; ctx.setParams({ view: '', booking: '' }); draw(); }
      else if (a === 'allbk') { st.bk = ''; ctx.setParams({ booking: '' }); draw(); }
      else if (a === 'add') smsAdd();
      else if (a === 'import') smsImport();
      else if (a === 'upload') smsUpload();
      else if (a === 'openbk') { ev.stopPropagation(); ctx.api.openBooking(v); }
    });
    draw();
    if (p.summons && !UI.top()) setTimeout(function () { smsDrawer(p.summons, function () { ctx.setParams({ summons: '' }); }); }, 0);
    else if (/^(add|import|upload)$/.test(p.action || '') && !UI.top()) setTimeout(function () { var a = p.action, clr = function () { var h = location.hash; if (/[#&]page=summons(&|$)/.test(h) && new RegExp('[#&]action=' + a + '(&|$)').test(h)) ctx.setParams({ action: '' }); }; if (p.action === 'add') smsAdd(null, clr); else if (p.action === 'import') smsImport(clr); else smsUpload(null, clr); }, 0);
  }
};

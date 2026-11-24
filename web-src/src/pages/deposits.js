/* ===================================================================
   Page: Deposit refunds (#page=deposits)   Owner: builder 2
   After a car comes back: note what is kept from the deposit, record how the rest went back, send the statement.
   The statement PDF and paper use the document engine in invoices.js (invDocHtml / invDocPdf).
   =================================================================== */
var DEP_HINTS = { 'Damage': 'For example: scratch on the rear bumper', 'Fuel': 'For example: fuel gauge two bars lower', 'Cleaning': 'For example: sand and food stains on the seats', 'Summons': 'For example: speeding summons on 12 Oct', 'Late return fee': 'For example: returned three hours late', 'Other': 'Say what it is for' };
/* the deposit record of a booking (made when a booking reaches Refund Pending by hand) */
function depFor(code) {
  var d = D(), z = byId(d.deposits, 'dep-' + code);
  if (!z) { var x = findBooking(code); if (!x) return null; z = { id: 'dep-' + code, booking: code, deductions: [], message: '', saved: true, refund: null, markedByHand: x.pay === 'Deposit Refunded', statementSent: null }; d.deposits.push(z); }
  return z;
}
function depPays(code) { return D().payments.filter(function (p) { return p.booking === code && p.kind === 'Security deposit' && !p.void; }); }
function depReceived(code) { return sum(depPays(code).map(function (p) { return p.amount; })); }
function depKept(z, list) { return sum((list || z.deductions).map(function (k) { return Number(k.amount) || 0; })); }
function depDue(z, list) { return Math.max(0, Math.round((depReceived(z.booking) - depKept(z, list)) * 100) / 100); }
function depState(z) { var x = findBooking(z.booking); return z.refund ? 'returned' : z.markedByHand || (x && x.pay === 'Deposit Refunded') ? 'hand' : 'waiting'; }
function depChip(z) {
  var s = depState(z), x = findBooking(z.booking);
  if (s === 'returned') return UI.chip('Returned ' + UI.fmt.date(z.refund.at), 'ok');
  if (s === 'hand') return UI.chip('Marked by hand', 'grey', { title: 'The payment status was set to Deposit Refunded without recording a refund' });
  var n = Math.max(0, -UI.fmt.daysFrom(x.end));
  return UI.chip(n ? 'Waiting ' + plural(n, 'day') : 'Waiting since today', 'warn');
}
function depHow(r) { if (!r) return ''; return r.method === 'Cash' ? 'Cash, refunded by ' + r.by : r.method === 'Stripe' ? 'Refunded to the card through Stripe' : 'Online transfer from the bank'; }
function depLists() {
  var d = D(), wait = [], done = [];
  d.bookings.forEach(function (x) {
    if (x.status === 'Cancelled') return;
    if (x.pay === 'Refund Pending') { var z = depFor(x.code); if (z.refund) { z.refund = null; } z.markedByHand = false; wait.push(z); }
    else if (x.pay === 'Deposit Refunded' && x.dep > 0 && TODAY - x.end < 90 * DAY && x.end <= NOW()) { var z2 = depFor(x.code); if (!z2.refund) z2.markedByHand = true; done.push(z2); }
  });
  wait.sort(function (a, b) { return findBooking(a.booking).end - findBooking(b.booking).end; });
  done.sort(function (a, b) { return ((b.refund && b.refund.at) || findBooking(b.booking).end) - ((a.refund && a.refund.at) || findBooking(a.booking).end); });
  return { wait: wait, done: done };
}

/* ---------------- the statement ---------------- */
function depModel(z, draft) {
  var x = findBooking(z.booking), ded = draft ? draft.deductions : z.deductions, msg = draft ? draft.message : z.message, got = depReceived(z.booking), kept = depKept(z, ded), due = Math.max(0, got - kept), r = z.refund;
  var rows = depPays(z.booking).map(function (p) { return ['Security deposit received', UI.fmt.date(p.at) + ' ' + p.method + (p.ref ? ' ref. ' + p.ref : ''), invMoney(p.amount)]; });
  if (!rows.length) rows.push(['Security deposit received', 'No deposit payment is recorded', '0.00']);
  ded.forEach(function (k) { rows.push(['Kept: ' + k.kind, k.note || '', '-' + invMoney(k.amount)]); });
  var blocks = [{ t: 'parties', from: invFrom(), to: { title: 'CUSTOMER', lines: [x.cust.name, 'Tel: ' + x.cust.phone, x.cust.email] } }, invCarBlock(x),
    { t: 'table', columns: [{ label: 'Description', w: 60 }, { label: 'Details', w: 86 }, { label: 'Amount (RM)', w: 30, align: 'right' }], rows: rows },
    { t: 'sumrows', rows: [['Deposit received', invMoney(got)], ['Total deductions', '-' + invMoney(kept)]] },
    { t: 'status', text: r ? 'Returned on ' + invDT(r.at) + '. ' + depHow(r) + (r.ref ? ', ref. ' + r.ref : '') + '.' : z.markedByHand ? 'Marked as returned by hand on the booking. The refund details were not recorded.' : 'This is what will be returned. The refund has not been paid out yet.' },
    { t: 'amount', label: r || z.markedByHand ? 'AMOUNT RETURNED' : 'AMOUNT TO BE RETURNED', amount: 'RM ' + invMoney(r ? r.amount : due), words: UI.fmt.words(r ? r.amount : due) }];
  if (msg) blocks.push({ t: 'status', text: msg });
  blocks.push({ t: 'end', lines: ['If anything on this statement looks wrong, please contact us.'].concat(invLegalLines('statement')) });
  return { kind: 'statement', title: 'DEPOSIT STATEMENT', no: 'DEP-' + z.booking, meta: [['Date', UI.fmt.date(r ? r.at : NOW())], ['Booking ID', z.booking]], blocks: blocks, footer: invFooter('DEP-' + z.booking), watermark: '' };
}
function depView(z, draft) {
  var m = depModel(z, draft);
  UI.dialog({ title: 'Deposit statement DEP-' + z.booking, subtitle: findBooking(z.booking).cust.name + (draft && draft.dirty ? ' · shows your unsaved changes' : ''), width: 'lg', body: function (el) { el.classList.add('inv-prevb'); setTimeout(function () { invFit(el); }, 0); return invDocHtml(m); },
    buttons: [{ label: 'Open in new tab', kind: 't', icon: 'external-link', close: false, onClick: function () { invOpenTab(m); } }, { spacer: true }, { label: 'Close', kind: 'g' }, { label: 'Download', icon: 'download', close: false, onClick: function () { invDocPdf(m, 'DEP-' + z.booking + '.pdf'); } }] });
}
function depSend(z) {
  if (!can('deposits.send')) { UI.toast('You cannot send statements. Ask the owner for "Send statements".', { tone: 'warn' }); return; }
  var x = findBooking(z.booking), st = { phone: x.cust.phone, msg: 'Hi ' + x.cust.name.split(' ')[0] + ', here is the statement for your deposit on booking ' + x.code + ' from ' + B().name + ': {url}' };
  var dl = UI.dialog({ title: 'Send the deposit statement', subtitle: 'DEP-' + x.code + ' · ' + x.cust.name, width: 'md',
    body: function () { var ok = invPhoneOk(st.phone); return '<p class="ui-ctext">This opens WhatsApp with your message and a link to the statement PDF. You press send there.</p>' + UI.input({ key: 'phone', label: 'Customer phone', value: st.phone, help: ok ? 'WhatsApp number: ' + invWaNumber(st.phone) : '', error: ok ? '' : 'This does not look like a phone number.' }) + UI.textarea({ key: 'msg', label: 'Message', rows: 3, value: st.msg, help: '{url} is replaced with the link to the statement (it works for 14 days).' }) + (z.statementSent ? '<p class="b2">Last sent ' + esc(invDT(z.statementSent.at)) + ' by ' + esc(z.statementSent.by) + '.</p>' : ''); },
    buttons: [{ label: 'Close', kind: 'g' }, { label: 'Open WhatsApp', icon: 'brand-whatsapp', onClick: function (d) {
      var f = UI.form(d.body); st.phone = f.phone; st.msg = f.msg;
      if (!invPhoneOk(st.phone)) { UI.toast('Check the phone number first', { tone: 'warn' }); d.refresh(); return false; }
      var text = st.msg.replace('{url}', invLink('DEP-' + x.code));
      try { window.open('https://wa.me/' + invWaNumber(st.phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); } catch (e) { /* blocked by the viewer */ }
      DB.update('deposits', z, { statementSent: { at: NOW(), by: me().name, to: invWaNumber(st.phone) } }, { action: 'Sent', where: 'Deposit refund', text: me().name + ' sent the deposit statement DEP-' + x.code + ' on WhatsApp to ' + invWaNumber(st.phone) });
      UI.toast('WhatsApp opened with the statement link. Press send there.');
    } }] });
  return dl;
}
function depReopen(z) {
  if (!can('deposits.reopen')) { UI.toast('You cannot reopen refunds. Ask the owner for "Reopen a refund".', { tone: 'warn' }); return Promise.resolve(false); }
  return UI.confirm({ title: 'Reopen the refund for ' + z.booking + '?', text: 'Use this when the refund was recorded by mistake (wrong amount, wrong bank). The deposit goes back to waiting and the booking back to Refund Pending, so you can record it again.', html: UI.alert('Nothing is lost: the earlier refund stays in the activity log.', 'info'), ok: 'Reopen refund', danger: true, width: 'md', input: { label: 'Reason', placeholder: 'For example: sent to the wrong bank account', required: true } }).then(function (reason) {
    if (!reason) return false;
    var r = z.refund, x = findBooking(z.booking);
    DB.update('deposits', z, { refund: null, markedByHand: false }, { action: 'Changed', where: 'Deposit refund', text: me().name + ' reopened the deposit refund of ' + z.booking + (r ? ' (' + UI.fmt.money(r.amount) + ', ' + r.method + ')' : '') + ': ' + reason, changes: [{ f: 'status', from: 'refunded', to: 'open' }] });
    DB.update('bookings', x, { pay: 'Refund Pending' }, { text: me().name + ' changed the payment status of ' + x.code + ' to Refund Pending' });
    UI.toast('The refund is open again');
    return true;
  });
}

/* ---------------- Record deposit refund ---------------- */
function depRecordRefund(z, after) {
  if (!can('deposits.refund')) { UI.toast('You cannot record refunds. Ask the owner for "Record refunds".', { tone: 'warn' }); return; }
  var x = findBooking(z.booking), due = depDue(z), staff = invStaff();
  var st = { method: 'Bank transfer', amount: due, keptKind: 'Other', keptNote: '', by: me().name, date: UI.isoDate(NOW()), time: String(NOW().getHours()).padStart(2, '0') + ':' + String(NOW().getMinutes()).padStart(2, '0'), ref: '', slip: null, reading: false, read: null, toBank: '', toAcct: '', toName: '', slipStatus: '', custRef: '', okMismatch: false, okDup: false };
  var keep = function (el) { var f = UI.form(el); Object.keys(f).forEach(function (k) { if (k in st) st[k] = f[k]; }); };
  var body = function () {
    var bank = st.method === 'Bank transfer', amt = Number(st.amount) || 0, less = amt < due - .005;
    var mm = st.custRef && /[A-Z]{3}-\d{5}/.test(st.custRef.toUpperCase()) && st.custRef.toUpperCase().indexOf(x.code) < 0 ? st.custRef.toUpperCase().match(/[A-Z]{3}-\d{5}/)[0] : '';
    var dup = st.ref && D().deposits.some(function (o) { return o !== z && o.refund && o.refund.ref && o.refund.ref === st.ref; });
    st.mm = mm; st.dup = dup;
    var nameOk = st.toName ? x.cust.name.toUpperCase().split(' ').some(function (w) { return w.length > 2 && st.toName.toUpperCase().indexOf(w) >= 0; }) : null;
    var h = '<p class="ui-ctext">' + esc(x.code + ' - ' + x.cust.name) + '. <b>' + UI.fmt.money(due) + ' due back.</b></p>' +
      '<div class="inp"><label>How did the money go back?</label><div class="inv-radios dep-how">' + [['Bank transfer', 'Bank transfer', 'Online transfer from the company bank. Add the transfer slip: it is read for you.', 'building-bank'], ['Stripe', 'Stripe', 'Refunded to the card through Stripe.', 'credit-card'], ['Cash', 'Cash', 'Handed back in cash. Choose who gave it.', 'cash']].map(function (c) { return '<button type="button" role="radio" class="inv-radio" data-how="' + c[0] + '" aria-checked="' + (st.method === c[0]) + '">' + i(c[3]) + '<span><b>' + c[1] + '</b><small>' + c[2] + '</small></span></button>'; }).join('') + '</div></div>';
    h += '<div class="inp"><label>' + (bank ? 'Transfer slip <span class="ui-req">*</span>' : 'Slip or photo (optional)') + '</label>' + (st.slip ? '<div class="inv-slip1">' + (/pdf/.test(st.slip.type) ? i('file-type-pdf') : '<img src="' + st.slip.dataUrl + '" alt="">') + '<span class="grow"><b>' + esc(st.slip.name) + '</b><small>' + UI.fmt.size(st.slip.size) + (st.slip.shrunk ? ' · made smaller' : '') + '</small>' + (st.reading ? '<small>' + i('loader-2', 'inv-spin') + ' Reading the slip...</small>' : '') + '</span>' + UI.btn('Remove', { kind: 't', size: 'sm', attrs: { 'data-slip-rm': '1' } }) + '</div>' : '<div data-dz></div>') + '</div>';
    h += '<div class="inv-fgrid">' + '<div class="inp"><label for="dr-amt">Amount returned (RM)</label><div class="ui-affix"><span>RM</span><input id="dr-amt" type="number" step="0.01" min="0" data-key="amount" value="' + esc(st.amount) + '"></div>' + (Math.abs(amt - due) > .005 ? '<button type="button" class="inv-link" data-due>Use ' + UI.fmt.money(due) + '</button>' : '') + '</div>' +
      UI.input({ id: 'dr-from', key: 'paidFrom', label: 'Paid from', value: st.method === 'Stripe' ? 'Stripe (Card)' : st.method === 'Cash' ? 'Cash' : 'Company bank', disabled: true });
    if (less) h += '<div class="full dep-kept">' + UI.alert('Kept ' + UI.fmt.money(due - amt) + ' more than the deductions. Say what it is for: it is added to the deductions.', 'warn') + '<div class="inv-fgrid">' + UI.select({ id: 'dr-kk', key: 'keptKind', label: 'Kept RM ' + invMoney(due - amt) + ' for', options: LISTS.deductionKinds, value: st.keptKind }) + UI.input({ id: 'dr-kn', key: 'keptNote', label: 'Note', value: st.keptNote, placeholder: DEP_HINTS[st.keptKind] }) + '</div></div>';
    if (st.method === 'Cash') h += UI.select({ id: 'dr-by', key: 'by', label: 'Refunded by', options: staff, value: st.by, help: 'Who handed the cash back' });
    h += UI.input({ id: 'dr-date', key: 'date', label: 'Date', type: 'date', value: st.date, max: UI.isoDate(NOW()) }) + UI.input({ id: 'dr-time', key: 'time', label: 'Time', type: 'time', value: st.time }) +
      '<div class="full">' + UI.input({ id: 'dr-ref', key: 'ref', label: bank ? 'Reference' : 'Reference (optional)', required: bank, value: st.ref, placeholder: 'For example FT26100184865761' }) + '</div></div>';
    if (bank && (st.slip || st.toBank)) {
      h += UI.section({ title: 'Where the money went, as the slip shows it', icon: 'scan', body: UI.input({ key: 'toBank', label: 'To bank', value: st.toBank }) + UI.input({ key: 'toAcct', label: 'Account (last 4 digits)', value: st.toAcct, maxlength: 4 }) +
        UI.input({ key: 'toName', label: 'To (name on the slip)', value: st.toName, help: nameOk == null ? '' : nameOk ? 'Looks like ' + x.cust.name : '', error: nameOk === false ? 'Does not look like ' + x.cust.name + '. Check the slip.' : '' }) +
        UI.input({ key: 'slipStatus', label: 'Status on the slip', value: st.slipStatus }) + '<div class="full">' + UI.input({ key: 'custRef', label: 'Customer reference on the slip', value: st.custRef, help: st.custRef && !mm && st.custRef.toUpperCase().indexOf(x.code) >= 0 ? 'Names ' + x.code + ': the right booking' : '' }) + '</div>' });
    }
    if (mm) h += UI.alert('The slip names ' + mm + ', but this is ' + x.code + '.', 'bad') + UI.check({ id: 'dr-mm', key: 'okMismatch', label: 'It is the refund for ' + x.code, checked: st.okMismatch });
    if (dup) h += UI.alert('This reference is already used for another refund.', 'warn') + UI.check({ id: 'dr-dup', key: 'okDup', label: 'Record it anyway', checked: st.okDup });
    return h + '<p class="b2">The booking is marked Deposit Refunded. A mistake can be undone with Reopen on the Deposit refunds page.</p>';
  };
  var foot = function () { return [{ label: 'Cancel', kind: 'g' }, { label: 'Record refund of ' + UI.fmt.money(Number(st.amount) || 0), icon: 'cash-banknote', kind: 'c', onClick: save }]; };
  var save = function (d) {
    keep(d.body);
    var amt = Math.round((Number(st.amount) || 0) * 100) / 100, bank = st.method === 'Bank transfer';
    if (amt < 0 || amt > due + .005) { UI.toast('The amount must be between RM 0.00 and ' + UI.fmt.money(due), { tone: 'warn' }); return false; }
    if (bank && !st.slip) { UI.toast('Add the transfer slip', { tone: 'warn' }); return false; }
    if (bank && !st.ref.trim()) { UI.toast('Type the reference from the slip', { tone: 'warn' }); return false; }
    if (st.mm && !st.okMismatch) { UI.toast('Tick that it is the refund for ' + x.code, { tone: 'warn' }); return false; }
    if (st.dup && !st.okDup) { UI.toast('Tick "Record it anyway" to use the same reference twice', { tone: 'warn' }); return false; }
    var at = UI.parseDate(st.date + 'T' + (st.time || '00:00'));
    if (at > NOW()) { UI.toast('The date cannot be in the future', { tone: 'warn' }); return false; }
    var ded = z.deductions.slice();
    if (amt < due - .005) ded.push({ kind: st.keptKind, amount: Math.round((due - amt) * 100) / 100, note: st.keptNote });
    var refund = { method: st.method, amount: amt, by: st.method === 'Cash' ? st.by : me().name, recordedBy: me().name, at: at, ref: st.ref, slip: st.slip ? { name: st.slip.name, size: st.slip.size, type: st.slip.type, dataUrl: st.slip.dataUrl } : null, toBank: st.toBank, toAcct: st.toAcct, toName: st.toName, slipStatus: st.slipStatus };
    DB.update('deposits', z, { deductions: ded, refund: refund, markedByHand: false, saved: true }, { action: 'Changed', where: 'Deposit refund', text: me().name + ' recorded the deposit refund of ' + UI.fmt.money(amt) + ' on ' + x.code + ' (' + st.method + ')', changes: [{ f: 'status', from: 'open', to: 'refunded' }] });
    DB.update('bookings', x, { pay: 'Deposit Refunded' }, { text: me().name + ' changed the payment status of ' + x.code + ' to Deposit Refunded' });
    UI.toast('Refund of ' + UI.fmt.money(amt) + ' recorded. ' + x.code + ' is now Deposit Refunded.');
    if (after) after();
  };
  var dl = UI.dialog({ title: 'Record deposit refund', subtitle: x.code + ' · ' + x.cust.name, width: 'md', body: function () { setTimeout(mount, 0); return body(); }, buttons: foot() });
  function redraw() { keep(dl.body); dl.refresh(); dl.setFoot(foot()); }
  function mount() { var el = dl.body.querySelector('[data-dz]'); if (el) UI.dropzone(el, { accept: 'image/jpeg,image/png,image/webp,.pdf', label: 'Drop the slip here', hint: 'JPG, PNG, WEBP or PDF. Paste with Ctrl+V works too. Big photos are made smaller.', camera: true, onFiles: function (fs) { UI.readImage(fs[0]).then(function (r) { keep(dl.body); st.slip = r; st.reading = st.method === 'Bank transfer'; dl.refresh(); if (st.reading) setTimeout(read, 1100); }); } }); }
  function read() {
    st.reading = false;
    if (/pdf/.test(st.slip.type)) { UI.toast('Nothing could be read from this slip. Type the details in.', { tone: 'warn' }); dl.refresh(); return; }
    st.toBank = st.toBank || 'Bank Sampel Berhad'; st.toAcct = st.toAcct || String(1000 + (x.n * 37) % 9000); st.toName = st.toName || x.cust.name.toUpperCase(); st.slipStatus = 'Successful'; st.custRef = st.custRef || x.code; st.ref = st.ref || 'FT' + String(26100000000000 + x.n * 104729).slice(0, 14);
    UI.toast('Filled in from the slip. Check each one against the picture.', { tone: 'info' }); dl.refresh(); dl.setFoot(foot());
  }
  dl.body.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-how]');
    if (b) { keep(dl.body); st.method = b.getAttribute('data-how'); redraw(); return; }
    if (ev.target.closest('[data-slip-rm]')) { keep(dl.body); st.slip = null; redraw(); return; }
    if (ev.target.closest('[data-due]')) { keep(dl.body); st.amount = due; redraw(); }
  });
  dl.body.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'amount' || k === 'keptKind' || k === 'custRef' || k === 'ref' || k === 'toName') redraw(); });
  return dl;
}

/* ---------------- the deposit drawer ---------------- */
function depOpen(code) {
  var z = depFor(code); if (!z) { UI.toast('Booking ' + code + ' was not found', { tone: 'warn' }); return; }
  var x = findBooking(code), canEdit = can('deposits.edit_deductions');
  var draft = { deductions: JSON.parse(JSON.stringify(z.deductions)), message: z.message || '' };
  var isDirty = function () { return JSON.stringify(draft.deductions.map(function (k) { return [k.kind, Number(k.amount) || 0, k.note || '']; })) !== JSON.stringify(z.deductions.map(function (k) { return [k.kind, Number(k.amount) || 0, k.note || '']; })) || (draft.message || '') !== (z.message || ''); };
  var keep = function (el) { el.querySelectorAll('[data-ded]').forEach(function (row) { var j = +row.getAttribute('data-ded'), f = UI.form(row); if (draft.deductions[j]) { draft.deductions[j].kind = f.kind; draft.deductions[j].amount = f.amount; draft.deductions[j].note = f.note; } }); var m = el.querySelector('[data-key="depmsg"]'); if (m) draft.message = m.value; };
  var body = function () {
    var s = depState(z), got = depReceived(code), kept = depKept(z, draft.deductions), due = Math.max(0, got - kept), r = z.refund, pays = depPays(code), dirty = isDirty();
    var h = '<div class="dep-bk"><div class="grow"><b>' + esc(invCarLabel(x.car)) + '</b><small>' + esc(UI.fmt.dateTime(x.start)) + ' to ' + esc(UI.fmt.dateTime(x.end)) + '</small><small>' + UI.phone(x.cust.phone, { wa: true }) + '</small><button type="button" class="inv-link" data-open-bk>' + i('external-link') + 'Open booking ' + esc(code) + '</button></div>' + depChip(z) + '</div>';
    h += '<section class="dep-s"><h4>DEPOSIT RECEIVED</h4>' + (pays.length ? pays.map(function (p) { return '<div class="dep-line"><span>' + esc(UI.fmt.date(p.at)) + ' by ' + esc(p.method) + (p.ref ? ' (' + esc(p.ref) + ')' : '') + '</span><b>' + UI.money(p.amount) + '</b></div>'; }).join('') + '<div class="dep-line tot"><span>Deposit received</span><b>' + UI.money(got) + '</b></div>' : UI.alert('No deposit payment is recorded on this booking, so nothing can be returned. Record the deposit on Invoices first if it was paid.', 'info', { action: can('billing.record_payment') ? UI.btn('Record payment', { kind: 't', size: 'sm', attrs: { 'data-rec-pay': '1' } }) : '' })) + '</section>';
    if (!r && s !== 'hand') {
      h += '<section class="dep-s"><div class="row"><h4 class="grow">KEPT FROM THE DEPOSIT</h4>' + (canEdit ? UI.btn('Add deduction', { kind: 't', size: 'sm', icon: 'plus', attrs: { 'data-add-ded': '1' } }) : '') + '</div>' +
        (draft.deductions.length ? draft.deductions.map(function (k, j) { return '<div class="dep-ded" data-ded="' + j + '"><div class="dep-ded-r">' + UI.select({ id: 'dd-k' + j, key: 'kind', label: 'What for', options: LISTS.deductionKinds, value: k.kind, disabled: !canEdit }) + '<div class="inp"><label for="dd-a' + j + '">Amount (RM)</label><div class="ui-affix"><span>RM</span><input id="dd-a' + j + '" type="number" step="0.01" min="0" data-key="amount" value="' + esc(k.amount == null ? '' : k.amount) + '"' + (canEdit ? '' : ' disabled') + '></div></div>' + (canEdit ? UI.iconBtn('trash', 'Remove this deduction', { size: 'sm', attrs: { 'data-rm-ded': j } }) : '') + '</div>' + UI.input({ id: 'dd-n' + j, key: 'note', label: 'Note', value: k.note, placeholder: DEP_HINTS[k.kind], disabled: !canEdit }) + '</div>'; }).join('') : '<p class="b2">Nothing is kept yet, so the whole deposit goes back. Add a deduction for damage, fuel, cleaning, a summons, a late return or anything else.</p>') +
        UI.textarea({ id: 'dd-msg', key: 'depmsg', label: 'Message on the statement (optional)', rows: 2, value: draft.message, placeholder: 'For example: Thank you for renting with us.' }) + '</section>';
    } else if (z.deductions.length) {
      h += '<section class="dep-s"><h4>KEPT FROM THE DEPOSIT</h4>' + z.deductions.map(function (k) { return '<div class="dep-line"><span>' + esc(k.kind) + (k.note ? '<small>' + esc(k.note) + '</small>' : '') + '</span><b>- ' + UI.money(k.amount) + '</b></div>'; }).join('') + '</section>';
    }
    h += '<section class="dep-s"><h4>' + (r ? 'RETURNED' : 'TO RETURN') + '</h4><div class="dep-sum"><div><span>Deposit received</span><b>' + UI.money(got) + '</b></div><div><span>Kept (deductions)</span><b>- ' + UI.money(kept) + '</b></div><div class="tot"><span>' + (r ? 'Returned' : 'Amount to return') + '</span><b>' + UI.money(r ? r.amount : due) + '</b></div></div>' +
      (kept > got ? UI.alert('The deductions are more than the deposit. Nothing goes back; ask the customer for the remaining ' + UI.fmt.money(kept - got) + ' as a payment on the booking.', 'info') : '') +
      (dirty ? UI.alert('You have unsaved changes. Save the deductions to update the statement.', 'warn') : '') + '</section>';
    if (r) {
      h += '<section class="dep-s"><h4>THE REFUND</h4><div class="dep-done">' + UI.kv('How', esc(depHow(r))) + UI.kv('Amount', UI.money(r.amount)) + UI.kv('When', esc(invDT(r.at))) + UI.kv('Reference', esc(r.ref || '-')) + (r.toBank ? UI.kv('To', esc(r.toBank + (r.toAcct ? ' · xxxx ' + r.toAcct : '') + (r.toName ? ' · ' + r.toName : ''))) : '') + (r.slipStatus ? UI.kv('Slip says', esc(r.slipStatus)) : '') + UI.kv('Status', 'Deposit Refunded') + UI.kv('Recorded by', esc(r.recordedBy || r.by)) + '</div>' +
        (r.slip ? '<button type="button" class="dep-slip" data-rslip>' + (r.slip.dataUrl && !/pdf/.test(r.slip.type || '') ? '<img src="' + r.slip.dataUrl + '" alt="">' : i('photo')) + '<span><b>Deposit refund slip</b><small>' + esc(r.slip.name) + '</small></span></button>' : '') +
        '<p class="b2">The booking is marked Deposit Refunded.</p>' + (can('deposits.reopen') ? UI.btn('Reopen this refund', { kind: 'o', size: 'sm', icon: 'arrow-back-up', attrs: { 'data-reopen': '1' } }) : '') + '</section>';
    } else if (s === 'hand') {
      h += '<section class="dep-s"><h4>THE REFUND</h4>' + UI.alert('Marked as returned by hand: the payment status was set to Deposit Refunded without recording how the money went back.', 'info') + '<div class="row wrap gap8">' + (can('deposits.refund') && due > 0 ? UI.btn('Record the refund now', { size: 'sm', icon: 'cash-banknote', attrs: { 'data-refund': '1' } }) : '') + (can('deposits.reopen') ? UI.btn('Reopen this refund', { kind: 'o', size: 'sm', icon: 'arrow-back-up', attrs: { 'data-reopen': '1' } }) : '') + '</div></section>';
    } else {
      h += '<section class="dep-s"><h4>RECORD THE REFUND</h4><p class="b2">Do this after you have paid the money back: by bank transfer (add the slip, it is read for you), Stripe or cash. It marks the booking as Deposit Refunded.</p>' +
        (can('deposits.refund') ? (due > 0 ? UI.btn('Record refund of ' + UI.fmt.money(due), { cls: 'dep-go', icon: 'cash-banknote', disabled: dirty || !got, title: dirty ? 'Save the deductions first' : '', attrs: { 'data-refund': '1' } }) : UI.btn('Close without a refund', { kind: 'o', icon: 'circle-check', disabled: dirty || !got, attrs: { 'data-close0': '1' } })) : '<p class="b2">You cannot record refunds.</p>') + '</section>';
    }
    h += '<section class="dep-s"><h4>STATEMENT FOR THE CUSTOMER</h4><p class="b2">DEP-' + esc(code) + ': the deposit received, each deduction and the amount returned. It shows what will be returned until the refund is recorded.</p><div class="row wrap gap8">' + UI.btn('View statement', { kind: 'tonal', size: 'sm', icon: 'eye', attrs: { 'data-stv': '1' } }) + UI.btn('Download statement', { kind: 'tonal', size: 'sm', icon: 'download', attrs: { 'data-std': '1' } }) + (can('deposits.send') ? UI.btn('Send statement', { kind: 'tonal', size: 'sm', icon: 'brand-whatsapp', cls: 'dep-wa', attrs: { 'data-sts': '1' } }) : '') + '</div><p class="b2">' + (z.statementSent ? 'Last sent ' + esc(invDT(z.statementSent.at)) + ' by ' + esc(z.statementSent.by) : 'Not sent yet') + '</p></section>';
    return h;
  };
  var foot = function () {
    var got = depReceived(code), due = Math.max(0, got - depKept(z, draft.deductions)), dirty = isDirty(), r = z.refund;
    return '<div class="dep-foot"><div class="grow"><small>' + (r ? 'Returned' : 'Amount to return') + '</small><b>' + UI.money(r ? r.amount : due) + '</b></div>' + (!r && depState(z) === 'waiting' && canEdit ? UI.btn(dirty ? 'Save deductions' : 'Deductions saved', { icon: 'device-floppy', disabled: !dirty, attrs: { 'data-save': '1' } }) : '') + '</div>';
  };
  var dr = UI.drawer({ title: 'Deposit for ' + code, subtitle: x.cust.name, width: 600, body: body, foot: foot(), dirty: isDirty, dirtyTitle: 'Leave without saving the deductions?' });
  var redraw = function () { keep(dr.body); var sc = dr.body.scrollTop; dr.setBody(body); dr.body.scrollTop = sc; dr.setFoot(foot()); };
  var off = on('data', function (ev) { if (dr.closed) { off(); return; } if (ev && (ev.coll === 'deposits' || ev.coll === 'bookings' || ev.coll === 'payments')) setTimeout(redraw, 0); });
  dr.body.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-key') === 'amount' || ev.target.getAttribute('data-key') === 'depmsg') { keep(dr.body); dr.setFoot(foot()); var t = dr.body.querySelector('.dep-sum'); if (t) { var got = depReceived(code), kept = depKept(z, draft.deductions); t.innerHTML = '<div><span>Deposit received</span><b>' + UI.money(got) + '</b></div><div><span>Kept (deductions)</span><b>- ' + UI.money(kept) + '</b></div><div class="tot"><span>Amount to return</span><b>' + UI.money(Math.max(0, got - kept)) + '</b></div>'; } } });
  dr.body.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'kind' || k === 'amount' || k === 'note' || k === 'depmsg') redraw(); });
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if (t.closest('[data-open-bk]')) { API.openBooking(code); return; }
    if (t.closest('[data-rec-pay]')) { API.recordPayment(code); return; }
    if (t.closest('[data-add-ded]')) { keep(dr.body); draft.deductions.push({ kind: 'Damage', amount: null, note: '' }); redraw(); var last = dr.body.querySelector('[data-ded="' + (draft.deductions.length - 1) + '"] input[type=number]'); if (last) last.focus(); return; }
    if ((b = t.closest('[data-rm-ded]'))) { keep(dr.body); draft.deductions.splice(+b.getAttribute('data-rm-ded'), 1); redraw(); return; }
    if (t.closest('[data-save]')) {
      keep(dr.body);
      if (draft.deductions.some(function (k) { return !(Number(k.amount) > 0); })) { UI.toast('Type the amount of each deduction', { tone: 'warn' }); return; }
      var clean = draft.deductions.map(function (k) { return { kind: k.kind, amount: Math.round(Number(k.amount) * 100) / 100, note: (k.note || '').trim() }; });
      DB.update('deposits', z, { deductions: clean, message: draft.message, saved: true }, { action: 'Changed', where: 'Deposit refund', text: me().name + ' saved the deductions on the deposit of ' + code + ': ' + (clean.length ? clean.map(function (k) { return k.kind + ' ' + UI.fmt.money(k.amount); }).join(', ') : 'nothing kept') });
      draft.deductions = JSON.parse(JSON.stringify(clean)); UI.toast('Deductions saved'); redraw(); return;
    }
    if (t.closest('[data-refund]')) { depRecordRefund(z); return; }
    if (t.closest('[data-close0]')) { UI.confirm({ title: 'Close without a refund?', text: 'Nothing goes back to the customer: the deductions take the whole deposit. The booking is marked Deposit Refunded.', ok: 'Close without a refund' }).then(function (y) { if (!y) return; DB.update('deposits', z, { refund: { method: 'None', amount: 0, by: me().name, recordedBy: me().name, at: NOW(), ref: '' } }, { where: 'Deposit refund', text: me().name + ' closed the deposit of ' + code + ' without a refund' }); DB.update('bookings', x, { pay: 'Deposit Refunded' }); UI.toast('Closed. ' + code + ' is now Deposit Refunded.'); }); return; }
    if (t.closest('[data-reopen]')) { depReopen(z); return; }
    if (t.closest('[data-rslip]')) { var r = z.refund; invSlipViewer({ amount: r.amount, booking: code, slips: [r.slip] }); return; }
    if (t.closest('[data-stv]')) { keep(dr.body); depView(z, isDirty() ? { deductions: draft.deductions.filter(function (k) { return Number(k.amount) > 0; }).map(function (k) { return { kind: k.kind, amount: Number(k.amount) || 0, note: k.note }; }), message: draft.message, dirty: true } : null); return; }
    if (t.closest('[data-std]')) { invDocPdf(depModel(z), 'DEP-' + code + '.pdf'); DB.log('Viewed a document', 'Deposit refund', z.id, me().name + ' downloaded the deposit statement DEP-' + code); return; }
    if (t.closest('[data-sts]')) { depSend(z); return; }
  });
  return dr;
}

PAGES['deposits'] = {
  title: 'Deposit refunds',
  search: [{ label: 'Deposits waiting to be returned', icon: 'cash-banknote', run: function () { go('deposits', { tab: 'refund' }); } }],
  render: function (root, ctx) {
    var P = ctx.params, tab = P.tab === 'refunded' ? 'refunded' : 'refund', L = depLists(), q = P.q || '';
    var m0 = new Date(NOW().getFullYear(), NOW().getMonth(), 1), thisMonth = L.done.filter(function (z) { return z.refund && z.refund.at >= m0; });
    var heldWait = sum(L.wait.map(function (z) { return depReceived(z.booking); })), dueWait = sum(L.wait.map(function (z) { return depDue(z); }));
    root.innerHTML = '<div class="dep-kpis">' + UI.stat({ label: 'Waiting to be returned', value: String(L.wait.length), note: 'Not given back yet', icon: 'hourglass', tone: 'warn' }) + UI.stat({ label: 'To return in total', value: UI.fmt.money(dueWait), note: 'Of ' + UI.fmt.money(heldWait) + ' held', icon: 'cash-banknote' }) +
      UI.stat({ label: 'Returned this month', value: UI.fmt.money(sum(thisMonth.map(function (z) { return z.refund.amount; }))), note: plural(thisMonth.length, 'deposit'), icon: 'circle-check', tone: 'ok' }) + UI.stat({ label: 'Kept this month', value: UI.fmt.money(sum(thisMonth.map(function (z) { return depKept(z); }))), note: 'Taken off deposits', icon: 'scissors', tone: 'info' }) + '</div>' +
      '<div class="card"><div class="dep-head"><h1>Deposit refunds</h1><p>After a car comes back, write down anything kept from the deposit, record the refund and send the customer a statement. ' + esc(B().short) + ' gives deposits back within ' + B().refundHours + ' hours.</p></div><div class="dep-tabs" id="dep-tabs"></div><div class="dep-q"><div class="inp srch">' + i('search') + '<input type="search" id="dep-q" data-key="depq" placeholder="Booking ID, customer, plate..." aria-label="Search deposits" value="' + esc(q) + '"></div>' + (q ? UI.btn('Clear search', { kind: 't', size: 'sm', icon: 'x', attrs: { 'data-clearq': '1' } }) : '') + '</div><div id="dep-t"></div></div>';
    UI.tabs(root.querySelector('#dep-tabs'), { value: tab, items: [{ id: 'refund', label: 'To refund', icon: 'hourglass', count: L.wait.length, tone: 'warn' }, { id: 'refunded', label: 'Refunded', icon: 'circle-check' }], onChange: function (id) { ctx.setParams({ tab: id === 'refund' ? null : id, page: null }); ctx.refresh(); } });
    var list = tab === 'refund' ? L.wait : L.done;
    var filt = function () { var s = (q || '').toLowerCase().trim(); return !s ? list : list.filter(function (z) { var x = findBooking(z.booking); return (x.code + ' ' + x.cust.name + ' ' + x.cust.phone + ' ' + x.car.plate + ' ' + x.car.plate.replace(/ /g, '')).toLowerCase().indexOf(s) >= 0; }); };
    var cols = [{ key: 'booking', label: 'Booking ID', sort: true, render: function (z) { return '<button type="button" class="inv-link dep-code" data-open="' + esc(z.booking) + '" data-stop>' + esc(z.booking) + '</button>'; } },
      { key: 'cust', label: 'Customer', render: function (z) { var x = findBooking(z.booking); return esc(x.cust.name) + '<div class="b2">' + UI.phone(x.cust.phone) + '</div>'; } },
      { key: 'car', label: 'Car', render: function (z) { return '<span class="b2 t1c">' + esc(invCarLabel(findBooking(z.booking).car)) + '</span>'; } },
      { key: 'back', label: 'Car back', sort: function (z) { return findBooking(z.booking).end; }, render: function (z) { return esc(UI.fmt.date(findBooking(z.booking).end)); } },
      { key: 'got', label: 'Deposit received', align: 'right', render: function (z) { return UI.money(depReceived(z.booking)); } },
      { key: 'kept', label: 'Kept', align: 'right', render: function (z) { var k = depKept(z); return k ? '<span class="dep-kept-v">- ' + UI.money(k) + '</span><div class="b2">' + esc(z.deductions.map(function (d2) { return d2.kind; }).join(', ')) + '</div>' : '<span class="faint">-</span>'; } },
      { key: 'ret', label: tab === 'refund' ? 'To return' : 'Returned', align: 'right', render: function (z) { var r = z.refund; return '<b class="fw5">' + UI.money(r ? r.amount : depDue(z)) + '</b>' + (r ? '<div class="b2">' + esc(depHow(r)) + '</div>' : ''); } },
      { key: 'st', label: 'Status', render: depChip }];
    var t = UI.table(root.querySelector('#dep-t'), { columns: cols, rows: filt(), rowKey: 'id', density: 'compact', minWidth: 980, page: +P.page || 1, onPage: function (pg) { ctx.setParams({ page: pg > 1 ? pg : null }); },
      onRowClick: function (z) { ctx.setParams({ booking: z.booking }); depOpen(z.booking); },
      card: function (z) { var x = findBooking(z.booking), r = z.refund; return '<div class="row"><b class="grow dep-code">' + esc(z.booking) + '</b>' + depChip(z) + '</div><div>' + esc(x.cust.name) + '</div><div class="b2">' + esc(invCarLabel(x.car)) + ' · back ' + esc(UI.fmt.date(x.end)) + '</div><div class="row"><span class="b2 grow">Deposit ' + UI.money(depReceived(z.booking)) + (depKept(z) ? ' · kept ' + UI.money(depKept(z)) : '') + '</span><b>' + UI.money(r ? r.amount : depDue(z)) + '</b></div>'; },
      empty: q ? { icon: 'search-off', title: 'Nothing matches "' + q + '"', text: 'Try the Booking ID, the customer name or the plate.', action: UI.btn('Clear search', { kind: 'o', size: 'sm', attrs: { 'data-clearq': '1' } }) } : tab === 'refund' ? { icon: 'circle-check', title: 'No deposits are waiting to be returned', text: 'When a car comes back, its booking is marked Refund Pending and the deposit shows up here. You can also set a booking\'s payment status to Refund Pending by hand.' } : { icon: 'history', title: 'No deposits returned recently', text: 'After you record a refund on the To refund tab, it is listed here for 90 days.' } });
    var qi = root.querySelector('#dep-q');
    qi.addEventListener('input', UI.debounce(function () { q = qi.value; ctx.setParams({ q: q || null, page: null }); t.setRows(filt()); }, 220));
    UI.on(root, 'click', '[data-clearq]', function () { ctx.setParams({ q: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-open]', function (ev, el) { depOpen(el.getAttribute('data-open')); });
    if (P.booking && !ctx.state.opened) { ctx.state.opened = true; var code = P.booking; setTimeout(function () { depOpen(code); }, 30); }
  },
  onData: function (root, ctx) { ctx.state.opened = true; ctx.refresh(); }
};
API.openDeposit = function (code) { depOpen(code); };
API.depositStatement = function (code) { var z = depFor(code); if (z) depView(z); };

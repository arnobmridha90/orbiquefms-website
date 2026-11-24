/* ===================================================================
   Page: Deposit refunds (#page=deposits)   Owner: builder 2
   After a car comes back: note what is kept from the deposit, record how the rest went back, send the statement.
   A payment can also be paid from a deposit ("Adjustment from deposit" on Record payment): it leaves a
   "Used for a payment" line here, which money reports leave out and which comes back when the payment is voided.
   The statement PDF and paper use the document engine in invoices.js (invDocHtml / invDocPdf).
   =================================================================== */
var DEP_HINTS = { 'Damage': 'For example: scratch on the rear bumper', 'Fuel': 'For example: fuel gauge two bars lower', 'Cleaning': 'For example: sand and food stains on the seats', 'Summons': 'For example: speeding summons on 12 Oct', 'Late return fee': 'For example: returned three hours late', 'Other': 'Say what it is for' };
var DEP_USED = 'Used for a payment';
var DEP_KINDS = LISTS.deductionKinds.filter(function (k) { return k !== DEP_USED; });
/* the deposit record of a booking (made the first time it is needed) */
function depFor(code) {
  var d = D(), z = byId(d.deposits, 'dep-' + code);
  if (!z) { var x = findBooking(code); if (!x) return null; z = { id: 'dep-' + code, booking: code, deductions: [], message: '', saved: true, refund: null, markedByHand: x.pay === 'Deposit Refunded', statementSent: null }; d.deposits.push(z); }
  return z;
}
function depR2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function depIsUsed(k) { return k.kind === DEP_USED || !!k.fromPayment; }
/* deposit payments of a booking: payments with a Security deposit item that are not voided */
function depPays(code) { return D().payments.filter(function (p) { return p.booking === code && !p.void && (p.items || [{ kind: p.kind }]).some(function (it) { return it.kind === 'Security deposit'; }); }); }
function depPayAmt(p) { return sum((p.items || [{ kind: p.kind, amount: p.amount }]).filter(function (it) { return it.kind === 'Security deposit'; }).map(function (it) { return it.amount; })); }
function depReceived(code) { return depR2(sum(depPays(code).map(depPayAmt))); }
/* what a refund is worked out from: the deposit payments recorded, or, when none is recorded, the deposit the
   customer gave (typed on the refund) or the deposit agreed on the booking */
function depBasis(z) { var got = depReceived(z.booking); if (got > 0) return got; if (z.refund && z.refund.depositGiven != null) return z.refund.depositGiven; var x = findBooking(z.booking); return x ? x.dep || 0 : 0; }
/* kept for money reports: the deductions typed by staff (not the lines a payment from the deposit made) */
function depKept(z, list) { return sum((list || z.deductions).filter(function (k) { return !depIsUsed(k); }).map(function (k) { return Number(k.amount) || 0; })); }
function depUsedAmt(z) { return sum(z.deductions.filter(depIsUsed).map(function (k) { return Number(k.amount) || 0; })); }
function depAllKept(z, list) { return sum((list || z.deductions).map(function (k) { return Number(k.amount) || 0; })); }
function depDue(z, list) { return Math.max(0, depR2(depBasis(z) - depAllKept(z, list))); }
/* what is still left of a booking's deposit to pay for things (0 once the refund is recorded) */
function depLeft(code) { var z = byId(D().deposits, 'dep-' + code); if (z && z.refund) return 0; if (!z) { var x = findBooking(code); if (!x) return 0; var got = depReceived(code); return depR2(got > 0 ? got : x.dep || 0); } return depDue(z); }
function depState(z) {
  var x = findBooking(z.booking);
  if (z.refund) return 'returned';
  if (x && x.pay === 'Deposit Refunded') return depUsedAmt(z) > 0 && depDue(z) <= 0 ? 'used' : 'hand';
  if (z.markedByHand) return 'hand';
  return 'waiting';
}
function depWaitDays(z) { var x = findBooking(z.booking); return Math.max(0, -UI.fmt.daysFrom(x.end)); }
function depChip(z) {
  var s = depState(z);
  if (s === 'returned') return UI.chip(z.refund.method === 'None' ? 'Closed, nothing back' : 'Returned ' + UI.fmt.date(z.refund.at), 'ok');
  if (s === 'used') return UI.chip('Used for payments', 'info', { title: 'Payments from the deposit took all of it, so nothing goes back' });
  if (s === 'hand') return UI.chip('Marked by hand', 'grey', { title: 'The payment status was set to Deposit Refunded without recording a refund' });
  var n = depWaitDays(z);
  return UI.chip(n ? 'Waiting ' + plural(n, 'day') : 'Waiting since today', n >= 7 ? 'bad' : 'warn');
}
function depHow(r) { if (!r) return ''; return r.method === 'None' ? 'Nothing returned: the deductions took all of it' : r.method === 'Cash' ? 'Cash, refunded by ' + r.by : r.method === 'Stripe' ? 'Refunded to the card through Stripe' : 'Online transfer from the bank'; }
function depLists() {
  var d = D(), wait = [], done = [], seen = {};
  d.bookings.forEach(function (x) {
    if (x.status === 'Cancelled') return;
    if (x.pay === 'Refund Pending') { var z = depFor(x.code); if (!z.refund) { z.markedByHand = false; wait.push(z); seen[z.id] = 1; } }
    else if (x.pay === 'Deposit Refunded' && (x.dep > 0 || byId(d.deposits, 'dep-' + x.code)) && TODAY - x.end < 90 * DAY && (x.end <= NOW() || byId(d.deposits, 'dep-' + x.code))) { var z2 = depFor(x.code); if (!z2.refund && depState(z2) !== 'used') z2.markedByHand = true; done.push(z2); seen[z2.id] = 1; }
  });
  /* a refund recorded for a booking that was not waiting (any booking can have one) */
  d.deposits.forEach(function (z) { if (!seen[z.id] && z.refund && NOW() - z.refund.at < 90 * DAY && findBooking(z.booking)) done.push(z); });
  return { wait: wait, done: done };
}

/* ---------------- using a deposit to pay (called by Record payment in invoices.js) ---------------- */
function depUse(code, p) {
  var z = depFor(code), x = findBooking(code), what = (p.kind || 'payment').toLowerCase();
  var line = { kind: DEP_USED, amount: depR2(p.amount), note: 'Paid ' + what + (p.booking !== code ? ' of ' + p.booking : '') + ' (payment ' + p.id + ')', fromPayment: p.id };
  DB.update('deposits', z, { deductions: z.deductions.concat([line]) }, { where: 'Deposit refund', text: me().name + ' paid ' + UI.fmt.money(p.amount) + ' from the deposit of ' + code + ' (' + what + (p.booking !== code ? ' of ' + p.booking : '') + ')' });
  var left = depLeft(code), usedUp = left <= 0 && x.pay !== 'Deposit Refunded';
  /* nothing left to give back: the booking becomes Deposit Refunded by itself */
  if (usedUp) DB.update('bookings', x, { pay: 'Deposit Refunded' }, { text: 'The whole deposit of ' + code + ' was used for payments, so its payment status is now Deposit Refunded' });
  return { code: code, left: left, usedUp: usedUp };
}
/* the reverse, when that payment is voided: the line goes and a used-up deposit is waiting again */
function depGiveBack(code, p) {
  var z = byId(D().deposits, 'dep-' + code), x = findBooking(code); if (!z) return;
  DB.update('deposits', z, { deductions: z.deductions.filter(function (k) { return k.fromPayment !== p.id; }) }, { where: 'Deposit refund', text: UI.fmt.money(p.amount) + ' went back to the deposit of ' + code + ' (the payment was voided)' });
  if (x && x.pay === 'Deposit Refunded' && !z.refund && depLeft(code) > 0) DB.update('bookings', x, { pay: 'Refund Pending' }, { text: 'A payment from the deposit of ' + code + ' was voided, so the refund is waiting again (Refund Pending)' });
}

/* ---------------- the statement ---------------- */
function depModel(z, draft) {
  var x = findBooking(z.booking), ded = draft ? draft.deductions : z.deductions, msg = draft ? draft.message : z.message, got = depBasis(z), kept = depAllKept(z, ded), due = Math.max(0, got - kept), r = z.refund;
  var pays = depPays(z.booking);
  var rows = pays.map(function (p) { return ['Security deposit received', UI.fmt.date(p.at) + ' ' + methodLabel(p.method) + (p.ref ? ' ref. ' + p.ref : ''), invMoney(depPayAmt(p))]; });
  if (!rows.length) rows.push(['Security deposit', got > 0 ? 'Payment not recorded' : 'None recorded', invMoney(got)]);
  ded.forEach(function (k) { rows.push([(depIsUsed(k) ? 'Used for a payment' : 'Less: ' + k.kind), (k.note || '').replace(/ \(payment [^)]+\)$/, ''), '-' + invMoney(k.amount)]); });
  var blocks = [{ t: 'parties', from: invFrom(), to: { title: 'CUSTOMER', lines: [x.cust.name, 'Tel: ' + x.cust.phone, x.cust.email] } }, invCarBlock(x),
    { t: 'table', columns: [{ label: 'Description', w: 60 }, { label: 'Details', w: 86 }, { label: 'Amount (RM)', w: 30, align: 'right' }], rows: rows },
    { t: 'sumrows', rows: [['Deposit', invMoney(got)], ['Total deductions', '-' + invMoney(kept)]] },
    { t: 'status', text: r ? (r.method === 'None' ? 'Closed on ' + invDT(r.at) + ' with nothing to return.' : 'Returned on ' + invDT(r.at) + '. ' + depHow(r) + (r.ref ? ', ref. ' + r.ref : '') + '.') : depState(z) === 'used' ? 'Payments from the deposit used all of it, so nothing is returned.' : z.markedByHand ? 'Marked as returned by hand on the booking. The refund details were not recorded.' : 'This is what will be returned. The refund has not been paid out yet.' },
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
  if (z.refund) { UI.toast('The refund of ' + z.booking + ' is already recorded. Reopen it first if something needs changing.', { tone: 'warn' }); return; }
  var x = findBooking(z.booking), staff = invStaff(), typed = depReceived(z.booking) <= 0;
  var st = { method: 'Bank transfer', depGiven: typed ? depR2(x.dep || 0).toFixed(2) : '', amount: null, keptKind: 'Other', keptNote: '', by: me().name, at: NOW(), ref: '', slip: null, reading: false, toBank: '', toAcct: '', toName: '', slipStatus: '', custRef: '', okMismatch: false, refUsed: null, slipUsed: null };
  var basis = function () { return typed ? depR2(String(st.depGiven).replace(/,/g, '')) : depReceived(z.booking); };
  var dueNow = function () { return Math.max(0, depR2(basis() - depAllKept(z))); };
  st.amount = dueNow().toFixed(2);
  var keep = function (el) { var f = UI.form(el); Object.keys(f).forEach(function (k) { if (k === 'at') { if (f.at) st.at = UI.parseDate(f.at); } else if (k in st) st[k] = f[k]; }); };
  var body = function () {
    var bank = st.method === 'Bank transfer', due = dueNow(), amt = Number(String(st.amount).replace(/,/g, '')) || 0, less = amt < due - .005;
    var mm = st.custRef && /[A-Z]{3}-\d{5}/.test(st.custRef.toUpperCase()) && st.custRef.toUpperCase().indexOf(x.code) < 0 ? st.custRef.toUpperCase().match(/[A-Z]{3}-\d{5}/)[0] : '';
    st.mm = mm;
    var nameOk = st.toName ? x.cust.name.toUpperCase().split(' ').some(function (w) { return w.length > 2 && st.toName.toUpperCase().indexOf(w) >= 0; }) : null;
    var h = '<p class="ui-ctext">' + esc(x.code + ' - ' + x.cust.name) + '. <b>' + (due > 0 ? UI.fmt.money(due) + ' due back.' : 'Nothing is due back.') + '</b></p>';
    if (typed) h += '<div class="dep-given">' + UI.input({ key: 'depGiven', label: 'Deposit the customer gave (RM)', prefix: 'RM', value: st.depGiven, attrs: { inputmode: 'decimal' }, help: 'No deposit payment is recorded for this booking. It starts as the deposit on the booking (' + UI.fmt.money(x.dep || 0) + ').' }) + '</div>';
    h += '<div class="inp"><label>How did the money go back?</label><div class="inv-radios dep-how">' + [['Bank transfer', 'Bank transfer', 'Online transfer from the company bank. Add the transfer slip: it is read for you.', 'building-bank'], ['Stripe', 'Stripe', 'Refunded to the card through Stripe.', 'credit-card'], ['Cash', 'Cash', 'Handed back in cash. Choose who gave it.', 'cash']].map(function (c) { return '<button type="button" role="radio" class="inv-radio" data-how="' + c[0] + '" aria-checked="' + (st.method === c[0]) + '">' + i(c[3]) + '<span><b>' + c[1] + '</b><small>' + c[2] + '</small></span></button>'; }).join('') + '</div></div>';
    h += '<div class="inp"><label>' + (bank ? 'Transfer slip <span class="ui-req">*</span>' : 'Slip or photo (optional)') + '</label>' + (st.slip ? '<div class="inv-slip1">' + (/pdf/.test(st.slip.type) ? i('file-type-pdf') : '<img src="' + st.slip.dataUrl + '" alt="">') + '<span class="grow"><b>' + esc(st.slip.name) + '</b><small>' + UI.fmt.size(st.slip.size) + (st.slip.shrunk ? ' · made smaller' : '') + '</small>' + (st.reading ? '<small>' + i('loader-2', 'inv-spin') + ' Reading the slip...</small>' : '') + '</span>' + UI.btn('Remove', { kind: 't', size: 'sm', attrs: { 'data-slip-rm': '1' } }) + '</div>' : '<div data-dz></div>') + '</div>';
    if (st.slipUsed) h += invUsedHtml(st.slipUsed);
    h += '<div class="inv-fgrid">' + '<div class="inp"><label>Amount returned (RM)</label><div class="ui-affix"><span>RM</span><input type="text" inputmode="decimal" data-key="amount" value="' + esc(st.amount) + '"></div>' + (Math.abs(amt - due) > .005 ? '<button type="button" class="inv-link" data-due>Use ' + UI.fmt.money(due) + '</button>' : '') + '</div>' +
      UI.input({ key: 'paidFrom', label: 'Paid from', value: st.method === 'Stripe' ? 'Stripe (Card)' : st.method === 'Cash' ? 'Cash' : 'Company bank', disabled: true });
    if (less) h += '<div class="full dep-kept">' + UI.alert('Kept ' + UI.fmt.money(due - amt) + ' more than the deductions. Say what it is for: it is added to the deductions.', 'warn') + '<div class="inv-fgrid">' + UI.select({ key: 'keptKind', label: 'Kept RM ' + invMoney(due - amt) + ' for', options: DEP_KINDS, value: st.keptKind }) + UI.input({ key: 'keptNote', label: 'Note', value: st.keptNote, placeholder: DEP_HINTS[st.keptKind] }) + '</div></div>';
    if (st.method === 'Cash') { var heldBy = function (n) { var u = userByName(n); return u ? cashHeldBy(u.id) : 0; }; h += UI.select({ key: 'by', label: 'Refunded by', options: staff.map(function (n) { return [n, n + ' (holds ' + UI.fmt.money(heldBy(n)) + ')']; }), value: st.by, help: 'Who handed the cash back. It comes off the cash they hold.' }); }
    h += UI.dateTimeField({ key: 'at', label: 'When', value: st.at, max: NOW(), chips: [{ label: 'Today', days: 0 }, { label: 'Yesterday', days: -1 }] }) +
      '<div class="full">' + UI.input({ key: 'ref', label: bank ? 'Reference' : 'Reference (optional)', required: bank, value: st.ref, placeholder: 'For example FT26100184865761' }) + '</div></div>';
    if (st.refUsed) h += invUsedHtml(st.refUsed);
    if (bank && (st.slip || st.toBank)) {
      h += UI.section({ title: 'Where the money went, as the slip shows it', icon: 'scan', body: UI.input({ key: 'toBank', label: 'To bank', value: st.toBank }) + UI.input({ key: 'toAcct', label: 'Account (last 4 digits)', value: st.toAcct, maxlength: 4 }) +
        UI.input({ key: 'toName', label: 'To (name on the slip)', value: st.toName, help: nameOk == null ? '' : nameOk ? 'Looks like ' + x.cust.name : '', error: nameOk === false ? 'Does not look like ' + x.cust.name + '. Check the slip.' : '' }) +
        UI.input({ key: 'slipStatus', label: 'Status on the slip', value: st.slipStatus }) + '<div class="full">' + UI.input({ key: 'custRef', label: 'Customer reference on the slip', value: st.custRef, help: st.custRef && !mm && st.custRef.toUpperCase().indexOf(x.code) >= 0 ? 'Names ' + x.code + ': the right booking' : '' }) + '</div>' });
    }
    if (mm) h += UI.alert('The slip names ' + mm + ', but this is ' + x.code + '.', 'bad') + UI.check({ key: 'okMismatch', label: 'It is the refund for ' + x.code, checked: st.okMismatch });
    return h + '<p class="b2">The booking is marked Deposit Refunded. A mistake can be undone with Reopen on the Deposit refunds page.</p>';
  };
  var foot = function () { return [{ label: 'Cancel', kind: 'g' }, { label: 'Record refund of ' + UI.fmt.money(Number(String(st.amount).replace(/,/g, '')) || 0), icon: 'cash-banknote', kind: 'c', disabled: !!(st.refUsed || st.slipUsed), onClick: save }]; };
  var save = function (d) {
    keep(d.body);
    var due = dueNow(), amt = depR2(String(st.amount).replace(/,/g, '')), bank = st.method === 'Bank transfer';
    if (typed && !(basis() > 0)) { UI.toast('Type the deposit the customer gave', { tone: 'warn' }); return false; }
    if (amt < 0 || amt > due + .005) { UI.toast('The amount must be between RM 0.00 and ' + UI.fmt.money(due), { tone: 'warn' }); return false; }
    if (bank && !st.slip) { UI.toast('Add the transfer slip', { tone: 'warn' }); return false; }
    if (bank && !st.ref.trim()) { UI.toast('Type the reference from the slip', { tone: 'warn' }); return false; }
    st.refUsed = invRefUsed(st.ref, { refundOf: z.booking }); st.slipUsed = st.slip ? invSlipUsed(st.slip.hash, { refundOf: z.booking }) : null;
    if (st.refUsed || st.slipUsed) { d.refresh(); d.setFoot(foot()); return false; }
    if (st.mm && !st.okMismatch) { UI.toast('Tick that it is the refund for ' + x.code, { tone: 'warn' }); return false; }
    if (st.method === 'Cash') { var u = userByName(st.by); if (u && amt > cashHeldBy(u.id) + .005) { UI.toast(st.by + ' holds only ' + UI.fmt.money(cashHeldBy(u.id)) + ' in cash. Choose who really handed it back.', { tone: 'warn' }); return false; } }
    if (!st.at || st.at > new Date(NOW().getTime() + 6e4)) { UI.toast('The date cannot be in the future', { tone: 'warn' }); return false; }
    var ded = z.deductions.slice();
    if (amt < due - .005) ded.push({ kind: st.keptKind, amount: depR2(due - amt), note: st.keptNote });
    var refund = { method: st.method, amount: amt, by: st.method === 'Cash' ? st.by : me().name, recordedBy: me().name, at: st.at, ref: st.ref.trim(), slip: st.slip ? { name: st.slip.name, size: st.slip.size, type: st.slip.type, dataUrl: st.slip.dataUrl, hash: st.slip.hash } : null, toBank: st.toBank, toAcct: st.toAcct, toName: st.toName, slipStatus: st.slipStatus };
    if (typed) refund.depositGiven = basis();
    DB.update('deposits', z, { deductions: ded, refund: refund, markedByHand: false, saved: true }, { action: 'Changed', where: 'Deposit refund', text: me().name + ' recorded the deposit refund of ' + UI.fmt.money(amt) + ' on ' + x.code + ' (' + st.method + ')' + (typed ? ', deposit payment not recorded' : ''), changes: [{ f: 'status', from: 'open', to: 'refunded' }] });
    DB.update('bookings', x, { pay: 'Deposit Refunded' }, { text: me().name + ' changed the payment status of ' + x.code + ' to Deposit Refunded' });
    UI.toast('Refund of ' + UI.fmt.money(amt) + ' recorded. ' + x.code + ' is now Deposit Refunded.');
    if (after) after();
  };
  var dl = UI.dialog({ title: 'Record deposit refund', subtitle: x.code + ' · ' + x.cust.name, width: 'md', body: function () { setTimeout(mount, 0); return body(); }, buttons: foot() });
  function redraw() { keep(dl.body); dl.refresh(); dl.setFoot(foot()); }
  function mount() { var el = dl.body.querySelector('[data-dz]'); if (el) UI.dropzone(el, { accept: 'image/jpeg,image/png,image/webp,.pdf', label: 'Drop the slip here', hint: 'JPG, PNG, WEBP or PDF. Paste with Ctrl+V works too. Big photos are made smaller.', camera: true, onFiles: function (fs) { UI.readImage(fs[0]).then(function (r) { keep(dl.body); st.slip = invFileSlip(r); st.slipUsed = invSlipUsed(st.slip.hash, { refundOf: z.booking }); st.reading = !st.slipUsed && st.method === 'Bank transfer'; dl.refresh(); dl.setFoot(foot()); if (st.reading) setTimeout(read, 1100); }); } }); }
  function read() {
    if (dl.closed) return; keep(dl.body); st.reading = false;
    if (/pdf/.test(st.slip.type)) { UI.toast('Nothing could be read from this slip. Type the details in.', { tone: 'warn' }); dl.refresh(); return; }
    st.toBank = st.toBank || 'Bank Sampel Berhad'; st.toAcct = st.toAcct || String(1000 + (x.n * 37) % 9000); st.toName = st.toName || x.cust.name.toUpperCase(); st.slipStatus = 'Successful'; st.custRef = st.custRef || x.code; st.ref = st.ref || 'FT' + String(26100000000000 + x.n * 104729).slice(0, 14);
    st.refUsed = invRefUsed(st.ref, { refundOf: z.booking });   /* checked as soon as it is read */
    UI.toast('Filled in from the slip. Check each one against the picture.', { tone: 'info' }); dl.refresh(); dl.setFoot(foot());
  }
  dl.body.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-how]');
    if (b) { keep(dl.body); st.method = b.getAttribute('data-how'); redraw(); return; }
    if (ev.target.closest('[data-slip-rm]')) { keep(dl.body); st.slip = null; st.slipUsed = null; redraw(); return; }
    if (ev.target.closest('[data-due]')) { keep(dl.body); st.amount = dueNow().toFixed(2); redraw(); }
  });
  dl.body.addEventListener('change', function (ev) {
    var k = ev.target.getAttribute('data-key');
    if (k === 'ref') { keep(dl.body); st.refUsed = invRefUsed(st.ref, { refundOf: z.booking }); redraw(); return; }
    if (k === 'depGiven') { keep(dl.body); st.amount = dueNow().toFixed(2); redraw(); return; }
    if (k === 'amount' || k === 'custRef' || k === 'toName') invRedrawSoon(dl.body, redraw); else if (k === 'keptKind' || k === 'by') redraw();
  });
  invUsedWire(dl.body);
  return dl;
}

/* ---------------- the deposit drawer ---------------- */
function depOpen(code) {
  var z = depFor(code); if (!z) { UI.toast('Booking ' + code + ' was not found', { tone: 'warn' }); return; }
  var x = findBooking(code), canEdit = can('deposits.edit_deductions');
  var typedOf = function () { return z.deductions.filter(function (k) { return !depIsUsed(k); }); };
  var draft = { deductions: JSON.parse(JSON.stringify(typedOf())), message: z.message || '' };
  var sig = function (l) { return JSON.stringify(l.map(function (k) { return [k.kind, Number(k.amount) || 0, k.note || '']; })); };
  var isDirty = function () { return sig(draft.deductions) !== sig(typedOf()) || (draft.message || '') !== (z.message || ''); };
  var allDraft = function () { return draft.deductions.concat(z.deductions.filter(depIsUsed)); };
  var keep = function (el) { el.querySelectorAll('[data-ded]').forEach(function (row) { var j = +row.getAttribute('data-ded'), f = UI.form(row); if (draft.deductions[j]) { draft.deductions[j].kind = f.kind; draft.deductions[j].amount = f.amount; draft.deductions[j].note = f.note; } }); var m = el.querySelector('[data-key="depmsg"]'); if (m) draft.message = m.value; };
  var sumHtml = function () { var got = depBasis(z), kept = depAllKept(z, allDraft()), used = depUsedAmt(z), r = z.refund; return '<div><span>' + (depReceived(code) > 0 ? 'Deposit received' : 'Deposit (payment not recorded)') + '</span><b>' + UI.money(got) + '</b></div>' + (used ? '<div><span>Used for payments</span><b>- ' + UI.money(used) + '</b></div>' : '') + '<div><span>Kept (deductions)</span><b>- ' + UI.money(kept - used) + '</b></div><div class="tot"><span>' + (r ? 'Returned' : 'Amount to return') + '</span><b>' + UI.money(r ? r.amount : Math.max(0, got - kept)) + '</b></div>'; };
  var body = function () {
    var s = depState(z), got = depReceived(code), basis = depBasis(z), kept = depAllKept(z, allDraft()), due = Math.max(0, basis - kept), r = z.refund, pays = depPays(code), dirty = isDirty(), used = z.deductions.filter(depIsUsed);
    var h = '<div class="dep-bk"><div class="grow"><b>' + esc(invCarLabel(x.car)) + '</b><small>' + esc(UI.fmt.dateTime(x.start)) + ' to ' + esc(UI.fmt.dateTime(x.end)) + '</small><small>' + UI.phone(x.cust.phone, { wa: true }) + ' · ' + UI.status('payment', x.pay || 'None') + '</small><button type="button" class="inv-link" data-open-bk>' + i('external-link') + 'Open booking ' + esc(code) + '</button></div>' + depChip(z) + '</div>';
    h += '<section class="dep-s"><h4>DEPOSIT RECEIVED</h4>' + (pays.length ? pays.map(function (p) { return '<div class="dep-line"><span>' + esc(UI.fmt.date(p.at)) + ' by ' + esc(methodLabel(p.method)) + (p.ref ? ' (' + esc(p.ref) + ')' : '') + '</span><b>' + UI.money(depPayAmt(p)) + '</b></div>'; }).join('') + '<div class="dep-line tot"><span>Deposit received</span><b>' + UI.money(got) + '</b></div>'
      : UI.alert('No deposit payment is recorded on this booking. ' + (r && r.depositGiven != null ? 'The refund was worked out from the deposit the customer gave: ' + UI.fmt.money(r.depositGiven) + '.' : 'You can still record the refund: it starts from the deposit on the booking (' + UI.fmt.money(x.dep || 0) + ') and you can change it. Or record the deposit on Invoices first.'), 'info', { action: can('billing.record_payment') && !r ? UI.btn('Record payment', { kind: 't', size: 'sm', attrs: { 'data-rec-pay': '1' } }) : '' })) + '</section>';
    if (used.length) h += '<section class="dep-s"><h4>USED FOR PAYMENTS</h4>' + used.map(function (k) { var p = byId(D().payments, k.fromPayment); return '<div class="dep-line"><span>' + esc((k.note || '').replace(/ \(payment [^)]+\)$/, '')) + '<small>' + (p ? esc(UI.fmt.date(p.at)) + ' · ' + esc(p.receipt || 'no receipt') : '') + ' · comes back if the payment is voided</small></span><b>- ' + UI.money(k.amount) + '</b></div>'; }).join('') + '</section>';
    if (!r && s === 'waiting') {
      h += '<section class="dep-s"><div class="row"><h4 class="grow">KEPT FROM THE DEPOSIT</h4>' + (canEdit ? UI.btn('Add deduction', { kind: 't', size: 'sm', icon: 'plus', attrs: { 'data-add-ded': '1' } }) : '') + '</div>' +
        (draft.deductions.length ? draft.deductions.map(function (k, j) { return '<div class="dep-ded" data-ded="' + j + '"><div class="dep-ded-r">' + UI.select({ key: 'kind', label: 'What for', options: DEP_KINDS, value: k.kind, disabled: !canEdit }) + '<div class="inp"><label>Amount (RM)</label><div class="ui-affix"><span>RM</span><input type="text" inputmode="decimal" data-key="amount" value="' + esc(k.amount == null ? '' : k.amount) + '"' + (canEdit ? '' : ' disabled') + '></div></div>' + (canEdit ? UI.iconBtn('trash', 'Remove this deduction', { size: 'sm', attrs: { 'data-rm-ded': j } }) : '') + '</div>' + UI.input({ key: 'note', label: 'Note', value: k.note, placeholder: DEP_HINTS[k.kind], disabled: !canEdit }) + '</div>'; }).join('') : '<p class="b2">Nothing is kept yet, so the whole deposit goes back. Add a deduction for damage, fuel, cleaning, a summons, a late return or anything else.</p>') +
        UI.textarea({ key: 'depmsg', label: 'Message on the statement (optional)', rows: 2, value: draft.message, placeholder: 'For example: Thank you for renting with us.' }) + '</section>';
    } else if (typedOf().length) {
      h += '<section class="dep-s"><h4>KEPT FROM THE DEPOSIT</h4>' + typedOf().map(function (k) { return '<div class="dep-line"><span>' + esc(k.kind) + (k.note ? '<small>' + esc(k.note) + '</small>' : '') + '</span><b>- ' + UI.money(k.amount) + '</b></div>'; }).join('') + '</section>';
    }
    h += '<section class="dep-s"><h4>' + (r ? 'RETURNED' : 'TO RETURN') + '</h4><div class="dep-sum">' + sumHtml() + '</div>' +
      (kept > basis ? UI.alert('The deductions are more than the deposit. Nothing goes back; ask the customer for the remaining ' + UI.fmt.money(kept - basis) + ' as a payment on the booking.', 'info') : '') +
      (dirty ? UI.alert('You have unsaved changes. Save the deductions to update the statement.', 'warn') : '') + '</section>';
    if (r) {
      h += '<section class="dep-s"><h4>THE REFUND</h4><div class="dep-done">' + UI.kv('How', esc(depHow(r))) + UI.kv('Amount', UI.money(r.amount)) + UI.kv('When', esc(invDT(r.at))) + UI.kv('Reference', esc(r.ref || '-')) + (r.toBank ? UI.kv('To', esc(r.toBank + (r.toAcct ? ' · xxxx ' + r.toAcct : '') + (r.toName ? ' · ' + r.toName : ''))) : '') + (r.slipStatus ? UI.kv('Slip says', esc(r.slipStatus)) : '') + (r.depositGiven != null ? UI.kv('Deposit given', UI.money(r.depositGiven) + ' <span class="b2">(payment not recorded)</span>') : '') + UI.kv('Status', 'Deposit Refunded') + UI.kv('Recorded by', esc(r.recordedBy || r.by)) + '</div>' +
        (r.slip ? '<button type="button" class="dep-slip" data-rslip>' + (r.slip.dataUrl && !/pdf/.test(r.slip.type || '') ? '<img src="' + r.slip.dataUrl + '" alt="">' : i('photo')) + '<span><b>Deposit refund slip</b><small>' + esc(r.slip.name) + '</small></span></button>' : '') +
        '<p class="b2">The booking is marked Deposit Refunded.</p>' + (can('deposits.reopen') ? UI.btn('Reopen this refund', { kind: 'o', size: 'sm', icon: 'arrow-back-up', attrs: { 'data-reopen': '1' } }) : '') + '</section>';
    } else if (s === 'used') {
      h += '<section class="dep-s"><h4>THE REFUND</h4>' + UI.alert('Payments from the deposit used all of it, so there is nothing to give back. The booking became Deposit Refunded by itself. Voiding one of those payments puts the money back here.', 'info', { icon: 'arrows-exchange' }) + '</section>';
    } else if (s === 'hand') {
      h += '<section class="dep-s"><h4>THE REFUND</h4>' + UI.alert('Marked as returned by hand: the payment status was set to Deposit Refunded without recording how the money went back.', 'info') + '<div class="row wrap gap8">' + (can('deposits.refund') && due > 0 ? UI.btn('Record the refund now', { size: 'sm', icon: 'cash-banknote', attrs: { 'data-refund': '1' } }) : '') + (can('deposits.reopen') ? UI.btn('Reopen this refund', { kind: 'o', size: 'sm', icon: 'arrow-back-up', attrs: { 'data-reopen': '1' } }) : '') + '</div></section>';
    } else {
      var noDep = !(basis > 0);
      h += '<section class="dep-s"><h4>RECORD THE REFUND</h4><p class="b2">Do this after you have paid the money back: by bank transfer (add the slip, it is read for you), Stripe or cash. It marks the booking as Deposit Refunded.' + (x.pay !== 'Refund Pending' ? ' This booking is ' + esc(x.pay || 'without a payment status') + ' now: a refund can still be recorded.' : '') + '</p>' +
        (can('deposits.refund') ? (due > 0 || (!got && x.dep > 0) ? UI.btn('Record refund of ' + UI.fmt.money(due), { cls: 'dep-go', icon: 'cash-banknote', disabled: dirty, title: dirty ? 'Save the deductions first' : '', attrs: { 'data-refund': '1' } }) : UI.btn('Close without a refund', { kind: 'o', icon: 'circle-check', disabled: dirty || noDep, attrs: { 'data-close0': '1' } })) : '<p class="b2">You cannot record refunds.</p>') + '</section>';
    }
    h += '<section class="dep-s"><h4>STATEMENT FOR THE CUSTOMER</h4><p class="b2">DEP-' + esc(code) + ': the deposit, each deduction and the amount returned. It shows what will be returned until the refund is recorded.</p><div class="row wrap gap8">' + UI.btn('View statement', { kind: 'tonal', size: 'sm', icon: 'eye', attrs: { 'data-stv': '1' } }) + UI.btn('Download statement', { kind: 'tonal', size: 'sm', icon: 'download', attrs: { 'data-std': '1' } }) + (can('deposits.send') ? UI.btn('Send statement', { kind: 'tonal', size: 'sm', icon: 'brand-whatsapp', cls: 'dep-wa', attrs: { 'data-sts': '1' } }) : '') + '</div><p class="b2">' + (z.statementSent ? 'Last sent ' + esc(invDT(z.statementSent.at)) + ' by ' + esc(z.statementSent.by) : 'Not sent yet') + '</p></section>';
    return h;
  };
  var foot = function () {
    var due = Math.max(0, depBasis(z) - depAllKept(z, allDraft())), dirty = isDirty(), r = z.refund;
    return '<div class="dep-foot"><div class="grow"><small>' + (r ? 'Returned' : 'Amount to return') + '</small><b>' + UI.money(r ? r.amount : due) + '</b></div>' + (!r && depState(z) === 'waiting' && canEdit ? UI.btn(dirty ? 'Save deductions' : 'Deductions saved', { icon: 'device-floppy', disabled: !dirty, attrs: { 'data-save': '1' } }) : '') + '</div>';
  };
  var dr = UI.drawer({ title: 'Deposit for ' + code, subtitle: x.cust.name, width: 600, body: body, foot: foot(), dirty: isDirty, dirtyTitle: 'Leave without saving the deductions?' });
  var redraw = function () { keep(dr.body); var sc = dr.body.scrollTop; dr.setBody(body); dr.body.scrollTop = sc; dr.setFoot(foot()); };
  var off = on('data', function (ev) { if (dr.closed) { off(); return; } if (ev && (ev.coll === 'deposits' || ev.coll === 'bookings' || ev.coll === 'payments')) setTimeout(function () { if (!dr.closed) redraw(); }, 0); });
  dr.body.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-key') === 'amount' || ev.target.getAttribute('data-key') === 'depmsg') { keep(dr.body); dr.setFoot(foot()); var t = dr.body.querySelector('.dep-sum'); if (t) t.innerHTML = sumHtml(); } });
  dr.body.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'kind') redraw(); else if (k === 'amount' || k === 'note' || k === 'depmsg') invRedrawSoon(dr.body, redraw); });
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if (t.closest('[data-open-bk]')) { API.openBooking(code); return; }
    if (t.closest('[data-rec-pay]')) { API.recordPayment(code); return; }
    if (t.closest('[data-add-ded]')) { keep(dr.body); draft.deductions.push({ kind: 'Damage', amount: null, note: '' }); redraw(); var last = dr.body.querySelector('[data-ded="' + (draft.deductions.length - 1) + '"] input[data-key="amount"]'); if (last) last.focus(); return; }
    if ((b = t.closest('[data-rm-ded]'))) { keep(dr.body); draft.deductions.splice(+b.getAttribute('data-rm-ded'), 1); redraw(); return; }
    if (t.closest('[data-save]')) {
      keep(dr.body);
      if (draft.deductions.some(function (k) { return !(Number(String(k.amount).replace(/,/g, '')) > 0); })) { UI.toast('Type the amount of each deduction', { tone: 'warn' }); return; }
      var clean = draft.deductions.map(function (k) { return { kind: k.kind, amount: depR2(String(k.amount).replace(/,/g, '')), note: (k.note || '').trim() }; });
      /* the "Used for a payment" lines are the system's: they stay exactly as they are */
      DB.update('deposits', z, { deductions: clean.concat(z.deductions.filter(depIsUsed)), message: draft.message, saved: true }, { action: 'Changed', where: 'Deposit refund', text: me().name + ' saved the deductions on the deposit of ' + code + ': ' + (clean.length ? clean.map(function (k) { return k.kind + ' ' + UI.fmt.money(k.amount); }).join(', ') : 'nothing kept') });
      draft.deductions = JSON.parse(JSON.stringify(clean)); UI.toast('Deductions saved'); redraw(); return;
    }
    if (t.closest('[data-refund]')) { depRecordRefund(z); return; }
    if (t.closest('[data-close0]')) { UI.confirm({ title: 'Close without a refund?', text: 'Nothing goes back to the customer: the deductions take the whole deposit. The booking is marked Deposit Refunded.', ok: 'Close without a refund' }).then(function (y) { if (!y) return; DB.update('deposits', z, { refund: { method: 'None', amount: 0, by: me().name, recordedBy: me().name, at: NOW(), ref: '' } }, { where: 'Deposit refund', text: me().name + ' closed the deposit of ' + code + ' without a refund' }); DB.update('bookings', x, { pay: 'Deposit Refunded' }); UI.toast('Closed. ' + code + ' is now Deposit Refunded.'); }); return; }
    if (t.closest('[data-reopen]')) { depReopen(z); return; }
    if (t.closest('[data-rslip]')) { var r = z.refund; invSlipViewer({ title: 'Deposit refund slip: ' + UI.fmt.money(r.amount) + ' on ' + code, amount: r.amount, booking: code, ref: r.ref, at: r.at, slips: [r.slip] }); return; }
    if (t.closest('[data-stv]')) { keep(dr.body); depView(z, isDirty() ? { deductions: draft.deductions.filter(function (k) { return Number(k.amount) > 0; }).map(function (k) { return { kind: k.kind, amount: Number(k.amount) || 0, note: k.note }; }).concat(z.deductions.filter(depIsUsed)), message: draft.message, dirty: true } : null); return; }
    if (t.closest('[data-std]')) { invDocPdf(depModel(z), 'DEP-' + code + '.pdf'); DB.log('Viewed a document', 'Deposit refund', z.id, me().name + ' downloaded the deposit statement DEP-' + code); return; }
    if (t.closest('[data-sts]')) { depSend(z); return; }
  });
  invUsedWire(dr.body);
  return dr;
}

/* ---------------- a refund for any booking (not only the ones waiting) ---------------- */
function depPickBooking() {
  var code = '';
  var dl = UI.dialog({ title: 'Refund for another booking', subtitle: 'Any booking without a recorded refund', width: 'md',
    body: function (el) {
      el.innerHTML = '<p class="ui-ctext">Use this when a deposit has to go back for a booking that is not on the To refund list, for example a cancelled trip or a deposit taken without recording the payment.</p><div data-bkp="dep"></div>';
      invBookingPicker(el.querySelector('[data-bkp="dep"]'), { label: 'Booking', dueToggle: false, emptyText: 'Every booking already has its refund recorded.', filter: function (b) { var z = byId(D().deposits, 'dep-' + b.code); return !(z && z.refund) && b.pay !== 'Refund Pending'; },
        badge: function (b) { var g = depReceived(b.code); return g > 0 ? { text: UI.fmt.money(g) + ' deposit', tone: 'info' } : { text: 'Deposit not recorded', tone: 'grey' }; }, onChange: function (c) { code = c; dl.setFoot(foot()); } });
    }, buttons: [] });
  var foot = function () { return [{ label: 'Cancel', kind: 'g' }, { label: 'Open the deposit', icon: 'arrow-right', disabled: !code, onClick: function () { var c = code; setTimeout(function () { depOpen(c); }, 30); } }]; };
  dl.setFoot(foot());
  return dl;
}

PAGES['deposits'] = {
  title: 'Deposit refunds',
  search: [{ label: 'Deposits waiting to be returned', icon: 'cash-banknote', run: function () { go('deposits', { tab: 'refund' }); } }, { label: 'Refund a deposit for any booking', icon: 'cash-banknote', run: function () { depPickBooking(); } }],
  render: function (root, ctx) {
    var P = ctx.params, tab = P.tab === 'refunded' ? 'refunded' : 'refund', L = depLists(), q = P.q || '', state = (tab === 'refund' ? ['long'] : ['returned', 'used', 'hand']).indexOf(P.state) >= 0 ? P.state : '', sort = P.sort || '';
    var m0 = new Date(NOW().getFullYear(), NOW().getMonth(), 1), thisMonth = L.done.filter(function (z) { return z.refund && z.refund.at >= m0 && z.refund.method !== 'None'; });
    var heldWait = sum(L.wait.map(function (z) { return depBasis(z); })), dueWait = sum(L.wait.map(function (z) { return depDue(z); }));
    /* adjustments this month: taken off deposits refunded this month, and payments paid from deposits this month */
    var takenOff = sum(L.done.filter(function (z) { return z.refund && z.refund.at >= m0; }).map(function (z) { return depKept(z); }));
    var usedM = sum(D().deposits.map(function (z) { return sum(z.deductions.filter(function (k) { if (!depIsUsed(k)) return false; var p = byId(D().payments, k.fromPayment); return p && p.at >= m0; }).map(function (k) { return k.amount; })); }));
    root.innerHTML = '<div class="pg-h"><div><h1>Deposit refunds</h1><p>After a car comes back, write down anything kept from the deposit, record the refund and send the customer a statement. ' + esc(B().short) + ' gives deposits back within ' + B().refundHours + ' hours.</p></div><div class="acts">' +
      (can('deposits.refund') ? UI.btn('Refund for another booking', { kind: 'o', icon: 'cash-banknote', attrs: { 'data-anyref': '1' } }) : '') + '</div></div>' +
      '<div class="dep-kpis">' + UI.stat({ label: 'Waiting to be returned', value: String(L.wait.length), note: 'Not given back yet', icon: 'hourglass', tone: 'warn', attrs: { 'data-kgo': 'refund' } }) + UI.stat({ label: 'To return in total', value: UI.fmt.money(dueWait), note: 'Of ' + UI.fmt.money(heldWait) + ' held', icon: 'cash-banknote', attrs: { 'data-kgo': 'refund' } }) +
      UI.stat({ label: 'Returned this month', value: UI.fmt.money(sum(thisMonth.map(function (z) { return z.refund.amount; }))), note: plural(thisMonth.length, 'deposit'), icon: 'circle-check', tone: 'ok', attrs: { 'data-kgo': 'refunded' } }) +
      '<div class="card stat ui-stat dep-adj" style="--c:var(--info-rgb)"><div class="grow"><div class="l">Adjustments this month</div><div class="dep-adj-r"><span>Taken off deposits</span><b class="num">' + UI.money(takenOff) + '</b></div><div class="dep-adj-r"><span>Used for payments</span><b class="num">' + UI.money(usedM) + '</b></div></div><span class="ic">' + i('receipt-2') + '</span></div></div>' +
      '<div class="card"><div class="dep-tabs" id="dep-tabs"></div><div class="dep-q"><div class="inp srch">' + i('search') + '<input type="search" id="dep-q" data-key="depq" placeholder="Booking ID, customer, plate..." aria-label="Search deposits" value="' + esc(q) + '"></div>' +
      UI.select({ key: 'state', aria: 'Status', value: state, options: [['', tab === 'refund' ? 'All waiting' : 'All refunded']].concat(tab === 'refund' ? [['long', 'Waiting 7 days or more']] : [['returned', 'Returned'], ['used', 'Used for payments'], ['hand', 'Marked by hand']]), id: 'dep-state' }) +
      UI.select({ key: 'sort', aria: 'Order', value: sort, options: [['', 'Newest booking first'], ['status', tab === 'refunded' ? 'Status, earliest first' : 'Longest waiting first'], ['-status', tab === 'refunded' ? 'Status, latest first' : 'Shortest waiting first']], id: 'dep-sort' }) +
      (q || state ? UI.btn('Clear', { kind: 't', size: 'sm', icon: 'x', attrs: { 'data-clearq': '1' } }) : '') + '</div><div id="dep-t"></div></div>';
    UI.tabs(root.querySelector('#dep-tabs'), { value: tab, items: [{ id: 'refund', label: 'To refund', icon: 'hourglass', count: L.wait.length, tone: 'warn' }, { id: 'refunded', label: 'Refunded', icon: 'circle-check', count: L.done.length, tone: 'grey' }], onChange: function (id) { ctx.setParams({ tab: id === 'refund' ? null : id, page: null, state: null, sort: null }); ctx.refresh(); } });
    var list = tab === 'refund' ? L.wait : L.done;
    var when = function (z) { return z.refund ? z.refund.at : findBooking(z.booking).end; };
    var filt = function () {
      var s = tidySearch(q || '').toLowerCase();
      var out = list.filter(function (z) {
        var x = findBooking(z.booking), st = depState(z);
        if (state === 'long' && depWaitDays(z) < 7) return false;
        if (state && state !== 'long' && st !== state) return false;
        return !s || matchBookingCode(s, x.code) || phoneHas(x.cust.phone, s) || (x.code + ' ' + x.cust.name + ' ' + x.car.plate + ' ' + normPlate(x.car.plate)).toLowerCase().indexOf(s) >= 0 || normPlate(x.car.plate).indexOf(normPlate(s)) >= 0 && normPlate(s).length >= 3;
      });
      return out.sort(function (a, b) {
        if (sort === 'status') return tab === 'refund' ? findBooking(a.booking).end - findBooking(b.booking).end : when(a) - when(b);
        if (sort === '-status') return tab === 'refund' ? findBooking(b.booking).end - findBooking(a.booking).end : when(b) - when(a);
        return findBooking(b.booking).n - findBooking(a.booking).n;
      });
    };
    var cols = [{ key: 'booking', label: 'Booking ID', render: function (z) { return '<button type="button" class="inv-link dep-code" data-open="' + esc(z.booking) + '" data-stop>' + esc(z.booking) + '</button>'; } },
      { key: 'cust', label: 'Customer', render: function (z) { var x = findBooking(z.booking); return esc(x.cust.name) + '<div class="b2">' + UI.phone(x.cust.phone) + '</div>'; } },
      { key: 'car', label: 'Car', render: function (z) { return '<span class="b2 t1c">' + esc(invCarLabel(findBooking(z.booking).car)) + '</span>'; } },
      { key: 'back', label: 'Car back', render: function (z) { return esc(UI.fmt.date(findBooking(z.booking).end)); } },
      { key: 'got', label: 'Deposit', money: true, render: function (z) { var g = depReceived(z.booking); return UI.money(depBasis(z)) + (g > 0 ? '' : '<div class="b2 nw">not recorded</div>'); } },
      { key: 'kept', label: 'Kept', money: true, render: function (z) { var k = depKept(z), u = depUsedAmt(z); return (k ? '<span class="dep-kept-v">- ' + UI.money(k) + '</span><div class="b2">' + esc(z.deductions.filter(function (d2) { return !depIsUsed(d2); }).map(function (d2) { return d2.kind; }).join(', ')) + '</div>' : (u ? '' : '<span class="faint">-</span>')) + (u ? '<div class="b2 nw">' + UI.fmt.money(u) + ' used for payments</div>' : ''); } },
      { key: 'ret', label: tab === 'refund' ? 'To return' : 'Returned', money: true, render: function (z) { var r = z.refund; return '<b class="fw5">' + UI.money(r ? r.amount : depDue(z)) + '</b>' + (r ? '<div class="b2">' + esc(depHow(r)) + '</div>' : ''); } },
      { key: 'st', label: 'Status', render: depChip }];
    var t = UI.table(root.querySelector('#dep-t'), { columns: cols, rows: filt(), rowKey: 'id', density: 'compact', minWidth: 1000, page: +P.page || 1, onPage: function (pg) { ctx.setParams({ page: pg > 1 ? pg : null }); },
      onRowClick: function (z) { ctx.setParams({ booking: z.booking }); depOpen(z.booking); },
      card: function (z) { var x = findBooking(z.booking), r = z.refund; return '<div class="row"><b class="grow dep-code">' + esc(z.booking) + '</b>' + depChip(z) + '</div><div>' + esc(x.cust.name) + '</div><div class="b2">' + esc(invCarLabel(x.car)) + ' · back ' + esc(UI.fmt.date(x.end)) + '</div><div class="row"><span class="b2 grow">Deposit ' + UI.money(depBasis(z)) + (depKept(z) ? ' · kept ' + UI.money(depKept(z)) : '') + (depUsedAmt(z) ? ' · used ' + UI.money(depUsedAmt(z)) : '') + '</span><b>' + UI.money(r ? r.amount : depDue(z)) + '</b></div>'; },
      empty: q || state ? { icon: 'search-off', title: 'Nothing matches', text: 'Try the Booking ID, the customer name or the plate, or clear the status filter.', action: UI.btn('Clear', { kind: 'o', size: 'sm', attrs: { 'data-clearq': '1' } }) } : tab === 'refund' ? { icon: 'circle-check', title: 'No deposits are waiting to be returned', text: 'When a car comes back, its booking is marked Refund Pending and the deposit shows up here. You can also record a refund for any booking with "Refund for another booking".' } : { icon: 'history', title: 'No deposits returned recently', text: 'After you record a refund on the To refund tab, it is listed here for 90 days.' } });
    var qi = root.querySelector('#dep-q');
    qi.addEventListener('input', UI.debounce(function () { q = qi.value; ctx.setParams({ q: q || null, page: null }); t.setRows(filt()); }, 220));
    root.querySelector('#dep-state').addEventListener('change', function (ev) { ctx.setParams({ state: ev.target.value || null, page: null }); ctx.refresh(); });
    root.querySelector('#dep-sort').addEventListener('change', function (ev) { ctx.setParams({ sort: ev.target.value || null, page: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-clearq]', function () { ctx.setParams({ q: null, state: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-open]', function (ev, el) { depOpen(el.getAttribute('data-open')); });
    UI.on(root, 'click', '[data-anyref]', function () { depPickBooking(); });
    UI.on(root, 'click', '[data-kgo]', function (ev, el) { var g = el.getAttribute('data-kgo'); ctx.setParams({ tab: g === 'refund' ? null : g, q: null, state: null, page: null }); ctx.refresh(); });
    if (P.booking && !ctx.state.opened) { ctx.state.opened = true; var code = P.booking; setTimeout(function () { depOpen(code); }, 30); }
  },
  onData: function (root, ctx) { ctx.state.opened = true; ctx.refresh(); }
};
API.openDeposit = function (code) { depOpen(code); };
API.depositStatement = function (code) { var z = depFor(code); if (z) depView(z); };
API.refundAnyBooking = function () { depPickBooking(); };

/* sample data: one deposit that was used up by paying another booking, so the "Used for payments" state shows */
DATA_INIT.push(function (d) {
  if (!d.payments || !d.deposits) return;
  var paidDep = function (code) { return sum(d.payments.filter(function (p) { return p.booking === code && !p.void && (p.items || [{ kind: p.kind }]).some(function (it) { return it.kind === 'Security deposit'; }); }).map(function (p) { return (p.items || [{ kind: p.kind, amount: p.amount }]).filter(function (it) { return it.kind === 'Security deposit'; }).reduce(function (a, it) { return a + it.amount; }, 0); })); };
  var done = d.bookings.filter(function (x) { var z = byId(d.deposits, 'dep-' + x.code); return x.status !== 'Cancelled' && x.end < TODAY && x.pay === 'Deposit Refunded' && !(z && (z.refund || z.deductions.some(function (k) { return k.fromPayment; }))) && TODAY - x.end < 60 * DAY && paidDep(x.code) > 0; });
  var a = done[done.length - 1]; if (!a) return;
  var b = d.bookings.filter(function (x) { return x.code !== a.code && x.status !== 'Cancelled' && x.start > a.end; })[0]; if (!b) return;
  var z0 = byId(d.deposits, 'dep-' + a.code), amt = Math.round((paidDep(a.code) - (z0 ? sum(z0.deductions.map(function (k) { return Number(k.amount) || 0; })) : 0)) * 100) / 100; if (!(amt > 0)) return;
  var staff = (d.users || []).filter(function (u) { return u.active !== false; })[0], at = new Date(a.end.getTime() + DAY);
  var p = { id: 'pay-dep-' + a.code, booking: b.code, kind: 'Extension payment', amount: amt, method: 'Deposit adjustment', at: at, by: staff ? staff.name : '', depositedTo: '', heldBy: null, afterCharge: null, ref: '', note: 'The customer asked to use the deposit of ' + a.code, receipt: null, void: null, banked: null, slips: [], items: [{ kind: 'Extension payment', amount: amt }], depositOf: a.code, createdAt: at };
  d.payments.push(p);
  var z = byId(d.deposits, 'dep-' + a.code);
  if (!z) { z = { id: 'dep-' + a.code, booking: a.code, deductions: [], message: '', saved: true, refund: null, markedByHand: false, statementSent: null }; d.deposits.push(z); }
  z.markedByHand = false;
  z.deductions = z.deductions.concat([{ kind: DEP_USED, amount: amt, note: 'Paid extension payment of ' + b.code + ' (payment ' + p.id + ')', fromPayment: p.id }]);
});

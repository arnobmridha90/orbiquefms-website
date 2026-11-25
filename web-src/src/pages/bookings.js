/* ===================================================================
   Page: Bookings (#page=bookings)   Owner: builder 1
   The list (compact rows), the booking drawer (new / edit / read only), status and delete dialogs, the inspection
   drawer, the Excel export, the agreement PDF and the booking's documents (links, invoice, receipts).
   Openers set here: API.openBooking, API.newBooking, API.openInspection, API.bookingAgreement.
   =================================================================== */

/* the shell's stubs for documents owned by Invoices: while Invoices has not replaced them, the booking page
   shows its own preview, PDF and send dialogs so everything works from the booking */
var BK_STUB = { previewDoc: API.previewDoc, sendDoc: API.sendDoc, createInvoice: API.createInvoice };
function bkReal(name) { return typeof API[name] === 'function' && API[name] !== BK_STUB[name]; }

/* extra fields: each booking keeps its own copy of the customer's documents; signed bookings keep the renter's signature */
DATA_INIT.push(function (d) {
  d.bookings.forEach(function (x) {
    if (x.docs) return;
    var pd = (x.cust && x.cust.docs) || {}, cp = function (f) { return f ? { name: f.name, size: f.size } : null; };
    x.docs = { poa: cp(pd.poa), dl: cp(pd.dl), icFront: cp(pd.icFront), icBack: cp(pd.icBack), other: cp(pd.other) };
    if (x.submitted && !x.custSig) x.custSig = { typed: x.cust.name };
  });
});

/* ---------------- small helpers ---------------- */
var BK_HELD = ['Deposit Received', 'Full Payment Received', 'Refund Pending'];
var BK_REF_OFF = 'Deposit Refunded (set by recording the refund on the deposits page)';
function bkRecv(x) { var r = DB.received(x.code); return r || (D().payments.some(function (p) { return p.booking === x.code; }) ? r : x.received || 0); }
function bkMoney(x) {
  var rec = bkRecv(x), due = Math.round((x.payable - rec) * 100) / 100;
  var tone = x.status === 'Cancelled' ? 'grey' : !x.payable ? 'info' : due < 0 ? 'info' : due === 0 ? 'ok' : rec > 0 ? 'warn' : 'bad';
  var over = x.status === 'Cancelled' ? 0 : bookingOverpaid(x);
  if (over > 0) tone = 'warn';
  return { total: x.payable, rec: rec, due: due, over: over, tone: tone, pct: x.payable ? Math.min(100, rec / x.payable * 100) : 100 };
}
/* "RM 120.00 due" / "Paid" / "RM 550.00 to give back" (paid more than the total) / "Paid + RM 20.00 extra" (extension
   or other charges paid on top) */
function bkDueText(m) { return m.due > 0 ? UI.fmt.money(m.due) + ' due' : m.over > 0 ? UI.fmt.money(m.over) + ' to give back' : m.due < 0 ? 'Paid + ' + UI.fmt.money(-m.due) + ' extra' : 'Paid'; }
function bkAgents(x) {
  var ids = {}; (x.agentIds || []).forEach(function (a) { ids[a] = 1; });
  D().tasks.forEach(function (t) { if (t.booking === x.code && t.status !== 'Cancelled') (t.agents || []).forEach(function (a) { ids[a] = 1; }); });
  var names = Object.keys(ids).map(function (a) { var e = employeeById(a); return e ? e.name : null; }).filter(Boolean);
  if (!names.length && x.agent) names.push(x.agent);
  return names;
}
function bkT(d) { var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + (h < 12 ? 'AM' : 'PM'); }
function bkWhen(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ', ' + bkT(d); }
function bkPkgLabel(p) { return p.name + ' (' + UI.fmt.money(p.daily) + '/day)'; }
/* prices: the shared bkCalc in data.js (exact remaining hours, whole RM like the backend) */
/* is the car free? the shared busy() rules: other bookings, workshop time, Not in use and Sold */
function bkClash(carId, s, e, except) { if (!carId || !s || !e) return { free: true }; return busy(carId, s, e, except); }
function bkBusyText(b) {
  if (!b || b.free) return '';
  if (b.kind === 'fleet') return 'This car is not available. It is marked ' + b.reason + '.';
  if (b.kind === 'workshop') { var w = b.downtime; return 'This car is in the workshop' + (w && w.reason ? ' (' + String(w.reason).toLowerCase() + ')' : '') + (w && w.to ? ' until ' + UI.fmt.dt(w.to) : ', with no return date yet') + '. Pick another car or other dates.'; }
  var z = b.booking; return 'This car is not available for the selected dates. It is booked on ' + z.code + ' (' + esc(z.cust.name) + ', ' + bkWhen(z.start) + ' to ' + bkWhen(z.end) + ').';
}
/* under Total payable when the booking came from a quote: does it match what the customer was told? */
function bkEstimateLine(payable, est, dep) {
  var diff = Math.round((payable - est) * 100) / 100, what = 'the estimate of ' + UI.fmt.money(est - (dep || 0)) + (dep ? ' + ' + UI.fmt.money(dep) + ' deposit' : '');
  if (Math.abs(diff) < 0.005) return '<p class="bkx-est ok">' + i('circle-check') + 'Matches ' + esc(what) + '</p>';
  return '<p class="bkx-est warn">' + i('alert-triangle') + esc(UI.fmt.money(Math.abs(diff)) + (diff > 0 ? ' more' : ' less') + ' than ' + what + ' given to the customer') + '</p>';
}
/* a phone typed or pasted in any form: digits with an optional leading + */
function bkTidyPhone(s) { var t = String(s || '').trim(), plus = /^\+/.test(t), dg = t.replace(/\D/g, ''); return dg ? (plus ? '+' : '') + dg : ''; }
/* the payment status select: Deposit Refunded is switched off when the refund must be recorded on Deposit refunds */
function bkPayOptions(locked) {
  return [['', 'None']].concat(LISTS.paymentStatus.map(function (s) { return [s, s === 'Deposit Refunded' && locked ? BK_REF_OFF : s]; }));
}
function bkLockRefunded(html, locked) { return locked ? html.replace(/<option value="Deposit Refunded"( selected)?>/, '<option value="Deposit Refunded" disabled>') : html; }
/* pick-up ('start') and return ('end') choices from our locations and the company's places; a saved choice that is
   no longer in Settings still shows */
function bkHandoverOpts(which, saved) {
  var list = handoverOptions(which), out = [['Not chosen', 'Not chosen']].concat(list.map(function (o) { return [o.value, o.label]; }));
  if (saved && saved !== 'Not chosen' && !list.some(function (o) { return o.value === saved; })) out.push([saved, saved.replace('|', ' - ') + ' (no longer in Settings)']);
  return out;
}
function bkCarLabel(c) { return c.plate + ' | ' + carName(c) + ' | ' + c.color; }
function bkLinkCopy(x, kind) {
  var label = { '': 'Booking form link copied', pdf: 'Agreement link copied', agent: 'Agent inspection link copied', customer: 'Customer inspection link copied' }[kind || ''];
  UI.copy(siteLink(x, kind || ''), { label: label });
}
function bkIsPhone() { return !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches); }

/* ---------------- invoices and receipts of a booking ---------------- */
function bkInvoice(code) { var l = D().invoices.filter(function (v) { return v.booking === code && v.status !== 'Void'; }); return l[l.length - 1] || null; }
function bkReceipts(code) { return D().receipts.filter(function (r) { return r.booking === code && r.status !== 'Void'; }); }
function bkDocGet(no) { return /^RCP/.test(no) ? DB.get('receipts', no) : DB.get('invoices', no); }
function bkDocHtml(doc) {
  var co = D().company, b = B(), x = findBooking(doc.booking) || {}, p = x.cust || {}, isR = /^RCP/.test(doc.no);
  var head = '<div class="bkx-doc-h"><div><b>' + esc(co.trading || b.name) + '</b><small>' + esc(co.legal) + ' · Reg. ' + esc(co.reg) + '</small><small>' + esc(co.address) + '</small><small>' + esc(co.phone) + ' · ' + esc(co.email) + '</small></div>' +
    '<div class="r"><h3>' + (isR ? 'RECEIPT' : 'INVOICE') + '</h3><div class="num">' + doc.no + '</div><small>Date ' + UI.fmt.date(doc.issued) + '</small><small>Booking ' + esc(doc.booking) + '</small></div></div>';
  var party = '<div class="bkx-doc-p"><div><small>' + (isR ? 'RECEIVED FROM' : 'BILL TO') + '</small><b>' + esc(p.name) + '</b><span>' + esc(p.phone) + '</span><span>' + esc(p.email) + '</span><span>' + esc(p.address) + '</span></div>' +
    (x.car ? '<div><small>RENTAL</small><b>' + esc(carName(x.car)) + ' · ' + esc(x.car.plate) + '</b><span>' + UI.fmt.dateTime(x.start) + '</span><span>to ' + UI.fmt.dateTime(x.end) + '</span></div>' : '') + '</div>';
  var body;
  if (isR) body = '<table class="bkx-doc-t"><thead><tr><th>Payment</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody><tr><td>' + esc(doc.kind) + '</td><td>' + esc(doc.method) + '</td><td class="r num">' + UI.fmt.money(doc.amount) + '</td></tr></tbody></table><div class="bkx-doc-tot"><span>Amount received</span><b>' + UI.fmt.money(doc.amount) + '</b></div><p class="bkx-doc-w">' + UI.fmt.words(doc.amount) + '</p>';
  else {
    var tax = doc.tax || 0, total = doc.charges + tax;
    body = '<table class="bkx-doc-t"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Amount</th></tr></thead><tbody>' + doc.lines.map(function (l) { return '<tr><td>' + esc(l.desc) + '</td><td class="r">' + l.qty + '</td><td class="r num">' + UI.fmt.money(l.unit) + '</td><td class="r num">' + UI.fmt.money(l.amount) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="bkx-doc-tot"><span>Charges</span><b>' + UI.fmt.money(doc.charges) + '</b>' + (tax ? '<span>' + esc(co.tax.name) + ' ' + co.tax.rate + '%</span><b>' + UI.fmt.money(tax) + '</b>' : '') + '<span>Total</span><b class="big">' + UI.fmt.money(total) + '</b><span>Security deposit (refundable)</span><b>' + UI.fmt.money(doc.deposit) + '</b><span>Total with deposit</span><b>' + UI.fmt.money(total + doc.deposit) + '</b></div><p class="bkx-doc-w">' + UI.fmt.words(total + doc.deposit) + '</p>' +
      (co.bank && co.bank.accNo ? '<p class="b2">Pay to ' + esc(co.bank.bank) + ', ' + esc(co.bank.accNo) + ', ' + esc(co.bank.accName) + '. ' + esc(co.bank.note) + '</p>' : '');
  }
  return '<div class="bkx-doc' + (doc.status === 'Void' ? ' void' : '') + '">' + head + party + body + '<p class="bkx-doc-f">' + esc((co.footers || {})[isR ? 'receipt' : 'invoice'] || '') + '</p>' + (doc.status === 'Void' ? '<span class="bkx-void">VOID</span>' : '') + '</div>';
}
function bkDocPreview(no) {
  if (bkReal('previewDoc')) return API.previewDoc(no);
  var doc = bkDocGet(no); if (!doc) { UI.toast(no + ' was not found', { tone: 'warn' }); return; }
  DB.log('Viewed a document', /^RCP/.test(no) ? 'Receipt' : 'Invoice', no, DB.actor() + ' opened ' + no);
  UI.dialog({ title: (/^RCP/.test(no) ? 'Receipt ' : 'Invoice ') + no, text: 'Booking ' + doc.booking + (doc.sent && doc.sent.length ? ' · sent ' + doc.sent.length + ' time' + (doc.sent.length > 1 ? 's' : '') : ''), width: 'lg', body: bkDocHtml(doc),
    buttons: [{ label: 'Close', kind: 'g' }, { spacer: true }].concat(can('billing.send') && doc.status !== 'Void' ? [{ label: 'Send', kind: 'o', icon: 'send', onClick: function () { setTimeout(function () { bkDocSend(no); }, 50); } }] : []).concat([{ label: 'Download PDF', icon: 'file-type-pdf', onClick: function () { bkDocPdf(no); return false; } }]) });
}
function bkDocPdf(no) {
  if (typeof API.docPdf === 'function') return API.docPdf(no);
  var doc = bkDocGet(no); if (!doc) return;
  var x = findBooking(doc.booking) || {}, p = x.cust || {}, co = D().company, isR = /^RCP/.test(no);
  DB.log('Exported', isR ? 'Receipt' : 'Invoice', no, DB.actor() + ' downloaded ' + no + '.pdf');
  return UI.pdf(no + '.pdf', function (pdf, k) {
    k.header({ title: isR ? 'RECEIPT' : 'INVOICE', lines: [no, 'Date ' + UI.fmt.date(doc.issued), 'Booking ' + doc.booking] });
    k.parties([{ title: 'FROM', lines: [co.legal, co.address, co.phone + ' · ' + co.email] }, { title: isR ? 'RECEIVED FROM' : 'BILL TO', lines: [p.name || '', p.phone || '', p.email || '', p.address || ''] }].concat(x.car ? [{ title: 'RENTAL', lines: [carName(x.car) + ' · ' + x.car.plate, UI.fmt.dateTime(x.start), 'to ' + UI.fmt.dateTime(x.end)] }] : []));
    if (isR) k.table({ columns: [{ label: 'Payment', w: 80 }, { label: 'Method', w: 50 }, { label: 'Amount (RM)', w: 40, align: 'right' }], rows: [[doc.kind, doc.method, UI.fmt.money(doc.amount).replace('RM ', '')]], totals: [['Amount received', UI.fmt.money(doc.amount), true]] });
    else {
      var tax = doc.tax || 0, total = doc.charges + tax;
      k.table({ columns: [{ label: 'Description', w: 110 }, { label: 'Qty', w: 16, align: 'right' }, { label: 'Unit (RM)', w: 28, align: 'right' }, { label: 'Amount (RM)', w: 30, align: 'right' }], rows: doc.lines.map(function (l) { return [l.desc, l.qty, UI.fmt.money(l.unit).replace('RM ', ''), UI.fmt.money(l.amount).replace('RM ', '')]; }),
        totals: [['Charges', UI.fmt.money(doc.charges)]].concat(tax ? [[co.tax.name + ' ' + co.tax.rate + '%', UI.fmt.money(tax)]] : []).concat([['Total', UI.fmt.money(total), true], ['Security deposit (refundable)', UI.fmt.money(doc.deposit)], ['Total with deposit', UI.fmt.money(total + doc.deposit), true]]) });
    }
    k.font(9, 'italic', [90, 90, 100]); k.y = k.wrap(UI.fmt.words(isR ? doc.amount : doc.charges + (doc.tax || 0) + doc.deposit), k.M, k.y + 2, k.W - 2 * k.M);
    if (!isR && co.bank && co.bank.accNo) { k.font(9, 'normal'); k.y = k.wrap('Pay to ' + co.bank.bank + ', ' + co.bank.accNo + ', ' + co.bank.accName + '. ' + co.bank.note, k.M, k.y + 4, k.W - 2 * k.M); }
    k.font(9, 'normal', [90, 90, 100]); k.wrap((co.footers || {})[isR ? 'receipt' : 'invoice'] || '', k.M, k.y + 6, k.W - 2 * k.M);
    if (doc.status === 'Void') k.watermark('VOID');
  });
}
function bkDocSend(no) {
  if (bkReal('sendDoc')) return API.sendDoc(no);
  var doc = bkDocGet(no); if (!doc) return;
  var x = findBooking(doc.booking) || {}, p = x.cust || {}, isR = /^RCP/.test(no), what = isR ? 'receipt' : 'invoice';
  var msg = 'Hi ' + (p.name || '').split(' ')[0] + ', here is your ' + what + ' ' + no + ' for booking ' + doc.booking + ' with ' + B().name + '. Thank you!';
  var dl = UI.dialog({ title: 'Send ' + what + ' ' + no, text: 'The PDF goes with the message.', width: 'md',
    body: UI.choice({ key: 'ch', label: 'Send by', value: 'WhatsApp', options: [['WhatsApp', 'WhatsApp'], ['Email', 'Email']] }) + UI.input({ key: 'to', label: 'To', value: p.phone, required: true }) + UI.textarea({ key: 'msg', label: 'Message', value: msg, rows: 3 }) +
      (doc.sent && doc.sent.length ? '<div class="b2">Sent before: ' + doc.sent.map(function (s) { return esc(s.channel) + ' ' + UI.fmt.dateTime(s.at) + (s.ok === false ? ' (failed: ' + esc(s.error || '') + ')' : ''); }).join('; ') + '</div>' : ''),
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Send', icon: 'send', onClick: function (d) {
      var f = UI.form(d.body); if (!f.to) { UI.toast('Type where to send it', { tone: 'warn' }); return false; }
      var sent = (doc.sent || []).concat([{ channel: f.ch, to: f.to, at: NOW(), by: DB.actor(), ok: true, error: '' }]);
      DB.update(isR ? 'receipts' : 'invoices', doc, { sent: sent }, { action: 'Sent', where: isR ? 'Receipt' : 'Invoice', text: DB.actor() + ' sent ' + what + ' ' + no + ' on ' + f.ch });
      UI.toast((isR ? 'Receipt ' : 'Invoice ') + no + ' sent on ' + f.ch + ' to ' + f.to + ' (sample: nothing leaves your browser)');
    } }] });
  dl.body.addEventListener('change', function (ev) { if (ev.target.getAttribute('data-key') === 'ch') dl.body.querySelector('[data-key="to"]').value = ev.target.value === 'Email' ? p.email || '' : p.phone || ''; });
}
function bkInvoiceLines(x) {
  var pk = x.pkg ? byId(D().damagePackages, x.pkg) : null;
  var lines = [{ desc: 'Car rental: ' + plural(x.days, 'day') + ' x RM ' + Number(x.rate).toFixed(2), qty: x.days, unit: x.rate, amount: x.rent }];
  if (x.dmg) lines.push({ desc: 'Damage cover: ' + (pk ? pk.name : x.cov ? x.cov.name : 'Cover') + ' (' + x.days + ' days)', qty: x.days, unit: x.dmg / x.days, amount: x.dmg });
  if (x.deliv) lines.push({ desc: 'Delivery charge', qty: 1, unit: x.deliv, amount: x.deliv });
  if (x.ret) lines.push({ desc: 'Return charge', qty: 1, unit: x.ret, amount: x.ret });
  if (x.others) lines.push({ desc: 'Other charges', qty: 1, unit: x.others, amount: x.others });
  if (x.disc) lines.push({ desc: 'Discount', qty: 1, unit: -x.disc, amount: -x.disc });
  return lines;
}
function bkCreateInvoice(code) {
  if (bkReal('createInvoice')) return API.createInvoice(code);
  var x = findBooking(code); if (!x) return;
  var lines = bkInvoiceLines(x), charges = sum(lines.map(function (l) { return l.amount; })), co = D().company, tax = co.tax && co.tax.on ? Math.round(charges * co.tax.rate) / 100 : 0;
  UI.dialog({ title: 'Create invoice for ' + code, text: x.cust.name + ' · ' + x.car.plate, width: 'md',
    body: '<table class="tbl bkx-mini"><tbody>' + lines.map(function (l) { return '<tr><td>' + esc(l.desc) + '</td><td class="r num">' + UI.fmt.money(l.amount) + '</td></tr>'; }).join('') + '<tr><td><b>Charges</b></td><td class="r num"><b>' + UI.fmt.money(charges) + '</b></td></tr>' + (tax ? '<tr><td>' + esc(co.tax.name) + '</td><td class="r num">' + UI.fmt.money(tax) + '</td></tr>' : '') + '<tr><td>Security deposit (refundable)</td><td class="r num">' + UI.fmt.money(x.dep) + '</td></tr></tbody></table>' + UI.textarea({ key: 'note', label: 'Note on the invoice (optional)', rows: 2 }),
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Create invoice', icon: 'file-plus', onClick: function (d) {
      var nos = D().invoices.map(function (v) { return +v.no.slice(-5); }), no = 'INV-' + NOW().getFullYear() + '-' + String(Math.max.apply(0, nos.concat([0])) + 1).padStart(5, '0');
      DB.add('invoices', { id: no, no: no, booking: code, issued: NOW(), lines: lines, charges: charges, deposit: x.dep, tax: tax, note: UI.form(d.body).note || '', status: 'Issued', voidReason: '', sent: [] }, { where: 'Invoice', text: DB.actor() + ' issued invoice ' + no + ' for booking ' + code });
      UI.toast('Invoice ' + no + ' created', { action: { label: 'Preview', run: function () { bkDocPreview(no); } } });
    } }] });
}
/* the Invoice and receipts menu */
function bkBillingMenu(anchor, x) {
  var inv = bkInvoice(x.code), rcps = bkReceipts(x.code), items = [{ header: 'Invoice' }];
  if (inv) { items.push({ label: 'Preview ' + inv.no, icon: 'eye', onClick: function () { bkDocPreview(inv.no); } }, { label: 'Download PDF', icon: 'file-type-pdf', onClick: function () { bkDocPdf(inv.no); } }); if (can('billing.send')) items.push({ label: 'Send invoice...', icon: 'send', onClick: function () { bkDocSend(inv.no); } }); }
  else if (can('billing.issue_invoice')) items.push({ label: 'Create invoice...', icon: 'file-plus', onClick: function () { bkCreateInvoice(x.code); } });
  else items.push({ label: 'No invoice yet', icon: 'file-off', disabled: true });
  items.push({ divider: true }, { header: 'Receipts' });
  if (rcps.length) rcps.forEach(function (r) { items.push({ label: r.no + ' (' + UI.fmt.money(r.amount) + ')', icon: 'receipt', hint: r.kind, onClick: function () { bkDocPreview(r.no); } }); });
  else items.push({ label: 'No receipts yet', icon: 'receipt-off', disabled: true });
  items.push({ divider: true });
  if (can('billing.record_payment')) items.push({ label: 'Record payment...', icon: 'cash', onClick: function () { API.recordPayment(x.code); } }, { label: 'Upload payment slip...', icon: 'upload', onClick: function () { API.uploadSlips(x.code); } });
  items.push({ label: 'All billing for this booking', icon: 'list-details', onClick: function () { go('invoices', { tab: 'payments', q: x.code }); } });
  return UI.menu(anchor, items, { width: 300 });
}

/* ---------------- the signed agreement (3-page PDF, as the booking site makes it) ---------------- */
function bkToPng(src, w, h) {
  return new Promise(function (res) {
    if (!src) { res(null); return; }
    var im = new Image();
    im.onload = function () { try { var cv = document.createElement('canvas'); cv.width = w || 480; cv.height = h || 140; var c = cv.getContext('2d'); c.drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/png')); } catch (e) { res(null); } };
    im.onerror = function () { res(null); }; im.src = src;
  });
}
function bkAgreement(x) {
  if (!x.submitted) {
    UI.dialog({ title: 'Form Not Submitted', width: 'sm', body: '<div class="bkx-ns">' + i('file-alert') + '<p>This booking form has not been submitted yet. PDF download is only available after the form is completed.</p></div>',
      buttons: [{ label: 'Close', kind: 'g' }, { label: 'Copy booking form link', kind: 'o', icon: 'copy', onClick: function () { bkLinkCopy(x, ''); return false; } }, { label: 'Complete Booking Form', icon: 'device-mobile', onClick: function () { S.bf.code = x.code; S.bf.screen = 0; A.sec('bf'); } }] });
    return;
  }
  return bkAgreementPdf(x);
}
function bkAgreementPdf(x) {
  var d = D(), b = B(), co = d.company, p = x.cust, sig = byId(d.signatures, x.signature) || d.signatures[0], ins = d.inspections.filter(function (z) { return z.booking === x.code; })[0];
  var signedAt = x.submittedAt || x.created, v1 = signedAt < new Date(2026, 9, 19, 3, 20), terms = termList(b).slice(0, v1 ? 16 : 99);
  var pk = x.pkg ? byId(d.damagePackages, x.pkg) : null, ic = UI.fmt.ic(p.ic);
  DB.log('Viewed a document', 'Booking', x.code, DB.actor() + ' downloaded the agreement of ' + x.code);
  return Promise.all([bkToPng(sig && sig.img), bkToPng(x.custSig && x.custSig.img)]).then(function (img) {
    return UI.pdf('rental-agreement-' + x.code + '.pdf', function (pdf, k) {
      var M = k.M, W = k.W, H = k.H;
      var band = function (t) { k.ensure(14); pdf.setFillColor(k.secondary[0], k.secondary[1], k.secondary[2]); pdf.rect(M, k.y, W - 2 * M, 6.5, 'F'); k.font(9, 'bold', [255, 255, 255]); k.text(t, M + 2, k.y + 4.6); k.y += 9; };
      var pairs = function (rows) { rows.forEach(function (r) { k.ensure(6); k.font(8.5, 'normal', [110, 110, 120]); k.text(r[0], M + 2, k.y + 3.5); k.font(9, 'bold'); var y2 = k.wrap(String(r[1] == null ? '' : r[1]), M + 52, k.y + 3.5, W - 2 * M - 54, 4.2); k.y = Math.max(k.y + 5.4, y2 - 2); }); k.y += 3; };
      k.header({ title: 'RENTAL AGREEMENT', lines: ['Booking ID: ' + x.code, 'Signed ' + UI.fmt.dateTime(signedAt)] });
      k.font(9.5, 'normal'); k.y = k.wrap('This car rental agreement is made between ' + co.legal + ' (registration no. ' + co.reg + '), trading as ' + co.trading + ' ("the Company"), and ' + p.name + ', IC / passport no. ' + ic + ', of ' + p.address + ' ("the Renter").', M, k.y, W - 2 * M, 4.6) + 4;
      band('RENTER INFORMATION');
      pairs([['Full name', p.name], ['Address', p.address], ['Phone', p.phone], ['Email', p.email], ['Nationality', p.nat], ['IC / passport no.', ic], ['Licence no.', p.licenceNo], ['Licence expiry', UI.fmt.date(p.licenceExp)], ['Emergency contact', (p.emergency || {}).name + ' (' + (p.emergency || {}).rel + ')'], ['Emergency phone', (p.emergency || {}).phone]]);
      band('VEHICLE');
      pairs([['Make and model', carName(x.car)], ['Year', x.car.year], ['Plate', x.car.plate], ['Colour', x.car.color], ['Seats', x.car.seats], ['Road tax valid until', x.car.tax ? UI.fmt.date(x.car.tax) : 'Not recorded']]);
      band('RENTAL PERIOD AND FEES');
      pairs([['Pick-up', UI.fmt.dateTime(x.start) + ' · ' + (x.startOpt || '')], ['Return', UI.fmt.dateTime(x.end) + ' · ' + (x.endOpt || '')], ['Duration', plural(x.days, 'day')], ['Rent per day', UI.fmt.money(x.rate)], ['Rent per hour', UI.fmt.money(x.hourly)]]);
      var rows = [['Rent (' + plural(x.days, 'day') + ' at ' + UI.fmt.money(x.rate) + ' a day)', UI.fmt.money(x.rent)]];
      if (x.dmg) rows.push(['Damage coverage (' + (pk ? pk.name : x.cov ? x.cov.name : 'cover') + ')', UI.fmt.money(x.dmg)]);
      if (x.deliv) rows.push(['Delivery', UI.fmt.money(x.deliv)]); if (x.ret) rows.push(['Return', UI.fmt.money(x.ret)]); if (x.others) rows.push(['Other', UI.fmt.money(x.others)]);
      if (x.disc) rows.push(['Discount', '- ' + UI.fmt.money(x.disc)]); rows.push(['Security deposit (refundable)', UI.fmt.money(x.dep)]);
      k.table({ columns: [{ label: 'Item', w: 130 }, { label: 'Amount', w: 50, align: 'right' }], rows: rows, totals: [['Total payable', UI.fmt.money(x.payable), true]] });
      /* page 2: inspection */
      pdf.addPage(); k.y = 18;
      band('VEHICLE INSPECTION AND HANDOVER REPORT');
      k.font(9, 'bold'); k.text('Customer inspection photos', M, k.y + 2); k.y += 6;
      var ph = ins && ins.photos.length ? ins.photos : [];
      if (!ph.length) { k.font(9, 'normal', [120, 120, 130]); k.text('No photo', M, k.y + 2); k.y += 8; }
      ph.forEach(function (f, n) { var col = n % 3, x0 = M + col * ((W - 2 * M) / 3); if (col === 0 && n) k.y += 40; k.ensure(40); pdf.setFillColor(236, 237, 241); pdf.rect(x0, k.y, 54, 26, 'F'); if (f.dataUrl) { try { pdf.addImage(f.dataUrl, 'JPEG', x0, k.y, 54, 26); } catch (e) { /* keep the grey box */ } } k.font(8, 'bold'); k.text('Photo #' + (n + 1), x0, k.y + 30); k.font(7.5, 'normal', [100, 100, 110]); k.wrap((f.note || 'No note') + ' · ' + UI.fmt.dateTime(f.at), x0, k.y + 34, 54, 3.4); });
      if (ph.length) k.y += 44;
      k.font(9, 'bold'); k.text('Agent handover verification', M, k.y + 2); k.y += 6;
      [['handover', 'Car handover'], ['idCard', 'Customer ID'], ['licence', 'Driving licence'], ['odometer', 'Odometer']].forEach(function (a, n) { var x0 = M + n * ((W - 2 * M) / 4); pdf.setFillColor(236, 237, 241); pdf.rect(x0, k.y, 40, 24, 'F'); k.font(8, 'bold'); k.text(a[1], x0, k.y + 28); k.font(7.5, 'normal', [100, 100, 110]); var v = ins && ins.agent[a[0]]; k.text(v ? (v.name || v) : 'No photo', x0, k.y + 32); });
      k.y += 40; k.font(9, 'bold'); k.text('Agent notes', M, k.y); k.font(9, 'normal'); k.y = k.wrap((ins && ins.note) || 'No notes.', M, k.y + 5, W - 2 * M) + 2;
      /* page 3: terms and signatures */
      pdf.addPage(); k.y = 18;
      band('TERMS AND CONDITIONS (' + (v1 ? 'V1, ' : '') + terms.length + ' terms in force when signed)');
      var cw = (W - 2 * M - 8) / 2, cy = [k.y, k.y], colI = 0, maxY = H - 92;
      terms.forEach(function (t, n) { var lines = pdf.splitTextToSize((n + 1) + '. ' + t[0] + '. ' + t[1], cw); if (cy[colI] + lines.length * 3.3 > maxY && colI === 0) colI = 1; k.font(7.4, 'normal', [50, 50, 60]); pdf.text(lines, M + colI * (cw + 8), cy[colI]); cy[colI] += lines.length * 3.3 + 1.4; });
      k.y = Math.max(cy[0], cy[1], H - 88) + 4;
      var by = k.y; k.font(9, 'bold'); k.text('For ' + co.trading, M, by); k.text('Renter: ' + p.name, W / 2 + 4, by);
      if (img[0]) pdf.addImage(img[0], 'PNG', M, by + 3, 60, 17.5); else { k.font(9, 'normal'); k.text(sig ? sig.name : '', M, by + 14); }
      if (img[1]) pdf.addImage(img[1], 'PNG', W / 2 + 4, by + 3, 60, 17.5); else { pdf.setFont('times', 'italic'); pdf.setFontSize(20); pdf.setTextColor(25, 35, 90); pdf.text((x.custSig && x.custSig.typed) || p.name, W / 2 + 4, by + 15); }
      k.font(8.5, 'normal', [80, 80, 90]); k.text((sig ? sig.name : co.legal), M, by + 25); k.text('Date: ' + UI.fmt.date(signedAt), M, by + 29.5);
      k.text('Signed electronically on ' + UI.fmt.dateTime(signedAt) + ' MYT', W / 2 + 4, by + 25); k.text('IP address: ' + (x.ip || 'not recorded'), W / 2 + 4, by + 29.5);
      k.font(8.5, 'italic', [80, 80, 90]); k.wrap('By signing, the Renter agrees to the terms of this agreement, and the Company agrees to rent the car described above to the Renter on these terms.', M, by + 38, W - 2 * M);
      var n = pdf.getNumberOfPages();
      for (var pg = 1; pg <= n; pg++) { pdf.setPage(pg); if (pg > 1) { k.font(8, 'bold', [90, 90, 100]); k.text('Booking ID: ' + x.code, W - M, 10, { align: 'right' }); } k.font(7.5, 'normal', [120, 120, 130]); k.text('Signed electronically by ' + p.name + ' on ' + UI.fmt.dateTime(signedAt) + ' MYT · ' + x.code + ' · Governing law: Malaysia', M, H - 12.5); }
    });
  });
}

/* ---------------- status dialogs ----------------
   Both go through the shared applyStatusRules: signed -> Agreement Signed + Deposit due, Car Returned -> Refund Pending
   (or Deposit Refunded with no deposit). Deposit Refunded cannot be picked by hand for bookings ending on or after the
   company lock date: it is set by recording the refund on Deposit refunds. */
/* moving a Cancelled or Completed booking back to an active status takes the car again: it must still be free.
   Returns the message to show, or '' when the move is fine. */
function bkReviveProblem(x, patch) {
  var to = patch.status;
  if (!to || to === x.status || (x.status !== 'Cancelled' && x.status !== 'Completed') || to === 'Cancelled' || to === 'Completed' || !x.car) return '';
  var b = bkClash(x.car.id, x.start, x.end, x.code);
  if (b.free) return '';
  if (b.kind === 'booking') return x.car.plate + ' is booked by ' + b.booking.code + ' for these dates. Pick another car in Edit booking.';
  return bkBusyText(b).replace(/ Pick another car or other dates\.$/, '') + ' Pick another car in Edit booking.';
}
function bkSaveStatus(x, patch, label) {
  var bad = bkReviveProblem(x, patch);
  if (bad) { UI.toast(bad, { tone: 'warn', ms: 6000 }); return false; }
  var r = applyStatusRules(x, patch), notes = r.notes || []; delete r.notes;
  if (r.pay === 'Deposit Refunded' && x.pay !== 'Deposit Refunded' && patch.pay === 'Deposit Refunded' && !canPickRefunded(x)) { UI.toast('Record the refund on Deposit refunds to set Deposit Refunded.', { tone: 'warn' }); return false; }
  DB.update('bookings', x, r, { text: DB.actor() + ' changed ' + label + ' of ' + x.code + ' to ' + (patch.status || patch.pay || 'None') + (notes.length ? ' (' + notes.join(' ') + ')' : '') });
  UI.toast(x.code + ': ' + (patch.status || patch.pay || 'None') + (notes.length ? '. ' + notes.join(' ') : ''), { ms: notes.length ? 6000 : 3500 });
  return true;
}
/* checks before a status that ends the rental: {block: 'message'} stops it, {ask: 'message'} asks first.
   Completed: not before the pick-up time, and ask when money is still due. Car Returned: ask when the car never
   went out (no Car Delivered yet, or the pick-up is still to come). */
function bkStatusWarn(x, v) {
  if (!x || v === x.status) return {};
  var future = x.start > NOW(), out = x.status === 'Car Delivered' || x.status === 'Car Returned';
  if (v === 'Completed') {
    if (future && !out) return { block: 'The pick-up is on ' + UI.fmt.dt(x.start) + ', so this booking cannot be completed yet. If it is not going ahead, cancel it instead.' };
    var m = bkMoney(x);
    if (m.due > 0.004 && x.status !== 'Cancelled') return { ask: UI.fmt.money(m.due) + ' is still due on ' + x.code + '. Complete it anyway? The amount stays on the list as money due.' };
  }
  if (v === 'Car Returned' && !out) return { ask: 'This car has not gone out yet: ' + x.code + ' is ' + x.status + (future ? ' and the pick-up is on ' + UI.fmt.dt(x.start) : '') + '. Mark it as returned anyway?' };
  return {};
}
function bkStatusDialog(x, kind) {
  if (!can('bookings.change_status')) { UI.toast('Changing a status needs the "Change status" access', { tone: 'warn' }); return; }
  var pay = kind === 'pay', locked = pay && !canPickRefunded(x);
  var sel = pay ? bkLockRefunded(UI.select({ key: 'st', label: 'New Status', options: bkPayOptions(locked), value: x.pay || '' }), locked) : UI.select({ key: 'st', label: 'New Status', options: LISTS.bookingStatus, value: x.status });
  var hint = function (v) {
    if (pay) return locked ? 'Deposit Refunded is set by recording the refund on the Deposit refunds page.' : '';
    var r = applyStatusRules(x, { status: v }), w = bkStatusWarn(x, v); return [w.block || w.ask || ''].concat(r.notes || []).filter(Boolean).join(' ');
  };
  UI.dialog({ title: pay ? 'Update Payment Status' : 'Update Booking Status', text: 'Select a new status for booking ' + x.code, width: 'sm',
    body: function (el) {
      el.innerHTML = sel + '<div class="row gap8 b2" style="margin-top:8px">Now: ' + (pay ? UI.status('payment', x.pay || 'None', null, { sm: true }) : UI.status('booking', x.status, null, { sm: true })) + '</div><p class="b2 bkx-rule" data-bkx-rule></p><div data-bkx-busy></div>';
      var s = el.querySelector('select'), rl = el.querySelector('[data-bkx-rule]'), upd = function () { rl.textContent = s.value === (pay ? x.pay || '' : x.status) ? (pay && locked ? hint() : '') : hint(s.value); el.querySelector('[data-bkx-busy]').innerHTML = ''; };
      s.addEventListener('change', upd); upd();
    },
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Update', onClick: function (d) {
      var v = UI.form(d.body).st, patch = {}; if ((pay ? x.pay || '' : x.status) === v) return;
      patch[pay ? 'pay' : 'status'] = v; if (!pay && v === 'Agreement Signed' && !x.submitted) { patch.submitted = true; patch.submittedAt = NOW(); }
      var label = pay ? 'the payment status' : 'the booking status';
      /* the car may have been given to someone else while this booking was cancelled or completed */
      var bad = !pay ? bkReviveProblem(x, patch) : '';
      if (bad) { d.body.querySelector('[data-bkx-busy]').innerHTML = UI.alert(bad, 'bad'); return false; }
      /* Completed or Car Returned on a booking that has not gone out yet, or that still has money due */
      var w = !pay ? bkStatusWarn(x, v) : {};
      if (w.block) { d.body.querySelector('[data-bkx-busy]').innerHTML = UI.alert(w.block, 'bad'); return false; }
      if (w.ask) {
        var m0 = bkMoney(x), canPay = v === 'Completed' && m0.due > 0.004 && can('billing.record_payment');
        return new Promise(function (res) {
          var decided = false, fin = function (val) { if (!decided) { decided = true; res(val); } };
          UI.dialog({ title: (v === 'Completed' ? 'Complete ' : 'Mark ') + x.code + (v === 'Completed' ? '?' : ' as returned?'), width: 'sm', alert: true, body: '<p class="ui-ctext">' + esc(w.ask) + '</p>', onClose: function () { fin(false); },
            buttons: [{ label: 'Keep it as it is', kind: 'g', onClick: function () { fin(false); } }].concat(canPay ? [{ label: 'Record payment', kind: 'g', onClick: function () { fin(false); setTimeout(function () { UI.closeAll(); API.recordPayment(x.code); }, 0); } }] : [])
              .concat([{ label: v === 'Completed' ? 'Complete anyway' : 'Mark returned', kind: 'err', onClick: function () { fin(bkSaveStatus(x, patch, label)); } }]) });
        });
      }
      /* cancelling a booking that holds money: say how much and what happens to the deposit first */
      var got = !pay && v === 'Cancelled' && x.status !== 'Cancelled' ? bookingPaid(x) : null;
      if (got && got.all > 0.004) {
        var toRefund = applyStatusRules(x, patch).pay === 'Refund Pending' && x.pay !== 'Refund Pending';
        return UI.confirm({ title: 'Cancel ' + x.code + '?', danger: true, ok: toRefund ? 'Cancel and refund deposit' : 'Cancel booking', cancel: 'Keep it',
          text: x.code + ' has ' + UI.fmt.money(got.all) + ' received' + (got.deposit > 0 ? ', including a ' + UI.fmt.money(got.deposit) + ' deposit' : '') + '. ' + (toRefund ? 'Cancel it and move the deposit to Refund Pending? It then shows on Deposit refunds, ready to give back.' : 'Cancel it anyway? The payments stay recorded on the booking.') })
          .then(function (y) { return y ? bkSaveStatus(x, patch, label) : false; });
      }
      return bkSaveStatus(x, patch, label);
    } }] });
}

/* the phone card's buttons: the next step for this booking. The form while it is not signed, then Record payment while
   money is due, else open the booking. */
function bkCardActs(x, m, can2) {
  var h = '', pay = can2('billing.record_payment') && x.status !== 'Cancelled' && m.due > 0.004;
  if (!x.submitted && EARLY_STATUSES.indexOf(x.status) >= 0) h += UI.btn('Send form', { kind: pay ? 'o' : 'tonal', size: 'sm', icon: 'brand-whatsapp', attrs: { 'data-bk': 'send' } });
  if (pay) h += UI.btn('Record payment', { kind: 'tonal', size: 'sm', icon: 'cash', attrs: { 'data-bk': 'recpay' } });
  if (!h) h += UI.btn(can2('bookings.edit') ? 'Open booking' : 'View booking', { kind: 'o', size: 'sm', icon: can2('bookings.edit') ? 'pencil' : 'eye', attrs: { 'data-bk': 'open' } });
  return h;
}

/* ---------------- delete (one or many) ---------------- */
function bkDelete(codes, done) {
  var list = codes.map(function (c) { return findBooking(c); }).filter(Boolean); if (!list.length) return;
  var held = list.filter(function (x) { return BK_HELD.indexOf(x.pay) >= 0; }), many = list.length > 1;
  UI.dialog({ title: many ? 'Delete ' + list.length + ' bookings?' : 'Delete booking?', width: 'md', alert: true,
    body: '<p class="ui-ctext">Do you want to delete ' + list.map(function (x) { return x.code; }).join(', ') + '? This cannot be undone.</p><ul class="bkx-dlist">' + list.map(function (x) { return '<li><b>' + x.code + '</b> · ' + esc(x.cust.name) + ' · ' + esc(x.car.plate) + '</li>'; }).join('') + '</ul>' +
      (held.length ? UI.alert('<b>' + (held.length === 1 ? 'This booking still holds' : 'These bookings still hold') + ' a deposit:</b>' + held.map(function (x) { return '<div>' + x.code + ': ' + esc(x.pay) + ', deposit ' + UI.fmt.money(x.dep) + '</div>'; }).join('') + '<div>Give the deposit back first, or make sure it is recorded on Deposit refunds.</div>', 'bad', { html: true }) : '') +
      '<p class="b2">Payments, invoices and receipts of ' + (many ? 'these bookings' : 'this booking') + ' stay on the Invoices page.</p>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: held.length ? 'Delete anyway' : 'Yes, Delete', kind: 'err', onClick: function (dl) {
      var btn = dl.el.querySelector('.ui-dlg-f button:last-child'), failed = [], k = 0;
      dl.el.querySelectorAll('.ui-dlg-f button').forEach(function (b2) { b2.disabled = true; });
      return new Promise(function (res) {
        (function next() {
          if (k >= list.length) { res(true); if (done) done(list.filter(function (x) { return failed.map(function (f) { return f[0]; }).indexOf(x) < 0; }).map(function (x) { return x.code; })); bkDeleteResult(list.length, failed); return; }
          var x = list[k++]; btn.textContent = 'Deleting ' + k + ' of ' + list.length + '...';
          setTimeout(function () {
            if (D().inspections.some(function (z) { return z.booking === x.code; })) failed.push([x, 'has an inspection record, so it cannot be deleted. Set its status to Cancelled instead.']);
            else DB.remove('bookings', x, { text: DB.actor() + ' deleted booking ' + x.code + ' (' + x.cust.name + ', ' + x.car.plate + ')' });
            next();
          }, 220);
        })();
      });
    } }] });
}
function bkDeleteResult(total, failed) {
  if (!failed.length) { UI.toast(total === 1 ? 'Booking deleted' : total + ' bookings deleted'); return; }
  UI.dialog({ title: failed.length === total ? 'Nothing was deleted' : (total - failed.length) + ' of ' + total + ' deleted', width: 'md',
    body: '<p class="ui-ctext">' + (failed.length === 1 ? 'This booking could not be deleted:' : 'These bookings could not be deleted:') + '</p><ul class="bkx-dlist">' + failed.map(function (f) { return '<li><b>' + f[0].code + '</b> ' + esc(f[1]) + '</li>'; }).join('') + '</ul>',
    buttons: [{ label: 'Close', kind: 'g' }].concat(failed.length === 1 && can('bookings.change_status') ? [{ label: 'Set it to Cancelled', onClick: function () { DB.update('bookings', failed[0][0], { status: 'Cancelled' }); UI.toast(failed[0][0].code + ' set to Cancelled'); } }] : []) });
}

/* ---------------- inspection ---------------- */
var BK_AGENT = [['handover', 'Agent Handover', 'car'], ['idCard', 'Agent ID (customer ID card)', 'id'], ['licence', 'Driving Licence', 'license'], ['odometer', 'Odometer Photo', 'gauge']];
function bkPhoto(x, n, f) { return f && f.dataUrl ? '<img src="' + f.dataUrl + '" alt="">' : '<span class="bkx-ph">' + carSVG(x.car.color, x.car.shape) + (n ? '<em>#' + n + '</em>' : '') + '</span>'; }
function bkInspMenu(anchor, x) {
  return UI.menu(anchor, [
    can('inspections.view') ? { label: 'View Inspection Data', icon: 'clipboard-check', onClick: function () { bkInspection(x.code); } } : null,
    { label: 'Copy Agent Inspection Link', icon: 'user-scan', onClick: function () { bkLinkCopy(x, 'agent'); } },
    { label: 'Copy Customer Inspection Link', icon: 'link', onClick: function () { bkLinkCopy(x, 'customer'); } }
  ], { width: 280 });
}
function bkInspection(code) {
  var x = findBooking(code); if (!x) return;
  if (!can('inspections.view')) { UI.toast('Seeing inspections needs the "See inspections" access.', { tone: 'warn' }); return; }
  var ins = D().inspections.filter(function (z) { return z.booking === code; })[0], ed = can('inspections.edit'), seePh = can('inspections.view_photos');
  var tmp = ins ? { agent: Object.assign({}, ins.agent), note: ins.note } : null, dirty = false;
  var body = function (el) {
    if (!ins) { el.innerHTML = UI.empty({ icon: 'clipboard-off', title: 'No inspection data found for this booking.', text: 'The agent fills it in at handover, then the customer adds their photos. Send them the links.', action: '<div class="row wrap gap8" style="justify-content:center">' + UI.btn('Copy Agent Inspection Link', { kind: 'o', size: 'sm', icon: 'user-scan', attrs: { 'data-bi': 'agentlink' } }) + UI.btn('Copy Customer Inspection Link', { kind: 'o', size: 'sm', icon: 'link', attrs: { 'data-bi': 'custlink' } }) + '</div>' }); return; }
    el.innerHTML = '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('info-circle') + 'Submission info</h3></div><div class="cu-kv">' + UI.kv('Inspection ID', '<span class="num">' + ins.id + '</span>') + UI.kv('GPS Coordinates', esc(ins.gps)) + UI.kv('Customer Submitted At', ins.custAt ? UI.fmt.dateTime(ins.custAt) : 'Not yet') + UI.kv('Agent Submitted At', ins.agentAt ? UI.fmt.dateTime(ins.agentAt) : 'Not yet') + '</div></section>' +
      '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('photo') + 'Customer submitted photos (' + ins.photos.length + ')</h3></div>' + (!seePh ? '<p class="b2">Seeing inspection photos needs the "See inspection photos" access.</p>' : ins.photos.length ? '<div class="bkx-phgrid">' + ins.photos.map(function (f, n) { return '<button type="button" class="bkx-phc" data-bi-ph="' + n + '">' + bkPhoto(x, n + 1, f) + '<b>' + esc(f.name) + '</b><small>' + UI.fmt.dateTime(f.at) + '</small>' + (f.note ? '<span>' + esc(f.note) + '</span>' : '<span class="faint">No note</span>') + '</button>'; }).join('') + '</div>' : '<p class="b2">The customer has not sent photos yet.</p>') + '</section>' +
      '<section class="cu-sec"><div class="cu-sec-h"><h3>' + i('user-check') + 'Agent verification</h3></div><div class="bkx-agrid">' + BK_AGENT.map(function (a) {
        var v = tmp.agent[a[0]], nm = v ? (v.name || v) : null;
        return '<div class="bkx-ag" data-bi-k="' + a[0] + '"><div class="cu-doc-h">' + a[1] + '</div>' + (nm ? '<button type="button" class="cu-thumb" data-bi="open">' + (seePh ? bkPhoto(x, 0, v) : i('lock')) + '</button><div class="cu-doc-f"><button type="button" class="cu-link ellip" data-bi="open">' + esc(nm) + '</button>' + (ed ? UI.iconBtn('trash', 'Remove', { size: 'sm', cls: 'cu-del', attrs: { 'data-bi': 'rm' } }) : '') + '</div>' : '<div class="cu-none">No photo</div>') +
          (ed ? '<label class="btn o sm cu-up">' + i('upload') + (nm ? 'Replace' : 'Upload') + '<input type="file" accept="image/*" hidden data-bi-file></label>' : '') + '</div>';
      }).join('') + '</div>' + UI.textarea({ key: 'note', label: 'Agent Note', value: tmp.note, rows: 3, readonly: !ed }) + '</section>';
  };
  var dr = UI.drawer({ title: 'Inspection Details - ' + code, subtitle: x.cust.name + ' · ' + x.car.plate + ' · ' + carName(x.car), width: 780, body: body,
    dirty: function () { return dirty; },
    foot: ins ? [can('inspections.delete') ? { label: 'Delete', kind: 'err', icon: 'trash', close: false, onClick: function () {
      UI.confirm({ title: 'Delete Inspection?', text: 'The photos and the agent check of ' + code + ' are removed. This cannot be undone.', ok: 'Delete', danger: true }).then(function (y) { if (!y) return; DB.remove('inspections', ins, { where: 'Booking', text: DB.actor() + ' deleted the inspection of ' + code }); DB.update('bookings', x, { inspected: false }, { silent: true }); dr.close(true); UI.toast('Inspection deleted'); });
    } } : null, { spacer: true }, { label: ed ? 'Cancel' : 'Close', kind: 'o' }].filter(Boolean).concat(ed ? [{ label: 'Update', icon: 'check', onClick: function (d2) {
      tmp.note = UI.form(d2.body).note; DB.update('inspections', ins, { agent: tmp.agent, note: tmp.note }, { where: 'Booking', text: DB.actor() + ' changed the inspection of ' + code }); UI.toast('Inspection updated');
    } }] : []) : [{ label: 'Close', kind: 'o' }] });
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b2 = t.closest('[data-bi]'), ph = t.closest('[data-bi-ph]');
    if (ph) { var f = ins.photos[+ph.getAttribute('data-bi-ph')]; UI.dialog({ title: 'Photo #' + (+ph.getAttribute('data-bi-ph') + 1), text: f.name + ' · ' + UI.fmt.dateTime(f.at), width: 'md', body: '<div class="bkx-phbig">' + bkPhoto(x, 0, f) + '</div>' + (f.note ? '<p>' + esc(f.note) + '</p>' : ''), buttons: [{ label: 'Close' }] }); return; }
    if (!b2) return;
    var a = b2.getAttribute('data-bi');
    if (a === 'agentlink') bkLinkCopy(x, 'agent'); if (a === 'custlink') bkLinkCopy(x, 'customer');
    var key = b2.closest('[data-bi-k]') && b2.closest('[data-bi-k]').getAttribute('data-bi-k');
    if (a === 'open' && key) { var v = tmp.agent[key]; if (v && v.dataUrl) cuShowFile(v, BK_AGENT.filter(function (z) { return z[0] === key; })[0][1]); else UI.dialog({ title: BK_AGENT.filter(function (z) { return z[0] === key; })[0][1], text: String(v), width: 'md', body: '<div class="bkx-phbig">' + bkPhoto(x, 0, null) + '</div><p class="b2">Sample photo. The agent\'s real picture shows here.</p>', buttons: [{ label: 'Close' }] }); }
    if (a === 'rm' && key) { var old = tmp.agent[key]; tmp.agent[key] = null; dirty = true; dr.refresh(); UI.toast('Photo removed. Press Update to save.', { tone: 'info', action: { label: 'Undo', run: function () { tmp.agent[key] = old; dr.refresh(); } } }); }
  });
  dr.el.addEventListener('change', function (ev) {
    if (!ev.target.matches('[data-bi-file]') || !ev.target.files[0]) return;
    var key = ev.target.closest('[data-bi-k]').getAttribute('data-bi-k');
    tmp.note = (dr.body.querySelector('[data-key="note"]') || {}).value || tmp.note;
    UI.readImage(ev.target.files[0], { max: 1200 }).then(function (r) { tmp.agent[key] = { name: r.name, size: r.size, dataUrl: r.dataUrl }; dirty = true; dr.refresh(); UI.toast(r.name + ' added. Press Update to save.'); });
  });
  dr.el.addEventListener('input', function () { dirty = true; });
  return dr;
}

/* ---------------- Excel export (the same file as Reports > Bookings and income) ---------------- */
function bkIncome(x) { return x.rent - x.disc + x.deliv + x.ret + x.dmg + (x.others || 0); }
function bkExport(from, to, f) {
  if (typeof API.bookingsExcel === 'function' && !f.pay) return API.bookingsExcel({ from: from, to: to, cars: f.car ? [f.car] : [], status: f.status ? [f.status] : [] });
  var d = D(), b = B(), end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1), nDays = Math.round((end - from) / DAY);
  var car = f.car ? carById(f.car) : null;
  var list = d.bookings.filter(function (x) {
    if (x.status === 'Pending' || x.status === 'Cancelled') return false;
    if (f.status && x.status !== f.status) return false; if (f.pay && (x.pay || '') !== f.pay) return false; if (car && x.car !== car) return false;
    return x.start < end && x.end > from;
  }).sort(function (a, b2) { return a.start - b2.start; });
  var inPeriod = function (x) { var n = 0; for (var k = 0; k < x.days; k++) { var s = new Date(x.start.getTime() + k * DAY); if (s >= from && s < end) n++; } return n; };
  var cars = car ? [car] : d.cars.slice(), carLbl = function (c) { return c.serial + '. ' + c.model.split(' ')[0] + ' ' + c.color; };
  var rows = list.map(function (x) { var n = inPeriod(x), inc = bkIncome(x); return { x: x, n: n, inc: inc, incIn: Math.round(inc * n / x.days * 100) / 100 }; });
  var tot = function (fn) { return Math.round(sum(rows.map(fn)) * 100) / 100; };
  var byCar = cars.map(function (c) { var r = rows.filter(function (z) { return z.x.car === c; }), days = sum(r.map(function (z) { return z.n; })); return [carLbl(c), c.plate, r.length, days, nDays ? Math.round(days / nDays * 1000) / 10 + '%' : '0%', sum(r.map(function (z) { return (z.x.rent - z.x.disc) * z.n / z.x.days; })), sum(r.map(function (z) { return z.x.deliv * z.n / z.x.days; })), sum(r.map(function (z) { return z.x.ret * z.n / z.x.days; })), sum(r.map(function (z) { return z.x.dmg * z.n / z.x.days; })), sum(r.map(function (z) { return z.incIn; }))].map(function (v) { return typeof v === 'number' ? Math.round(v * 100) / 100 : v; }); });
  var gen = UI.fmt.dateTime(NOW()) + ' by ' + DB.actor(), title = b.name + ' booking and income report';
  var summary = [[title], ['Bookings, income per car and per day. All amounts in Malaysian Ringgit (RM).'], [], ['Period', UI.fmt.date(from) + ' to ' + UI.fmt.date(to) + ' (' + nDays + ' days)'], ['Generated', gen], ['Cars', car ? bkCarLabel(car) : 'All cars'], ['Booking statuses', f.status || 'Confirmed, Agreement Sent, Agreement Signed, Car Delivered, Car Returned, Completed'], [],
    ['Key figures'], ['Total income', tot(function (z) { return z.incIn; })], ['Rental income', tot(function (z) { return (z.x.rent - z.x.disc) * z.n / z.x.days; })], ['Delivery fee', tot(function (z) { return z.x.deliv * z.n / z.x.days; })], ['Return fee', tot(function (z) { return z.x.ret * z.n / z.x.days; })], ['Damage coverage', tot(function (z) { return z.x.dmg * z.n / z.x.days; })], ['Deposits held (not income)', tot(function (z) { return z.x.dep; })], ['Bookings', rows.length], ['Rental days', tot(function (z) { return z.n; })], ['Average income per booking', rows.length ? Math.round(tot(function (z) { return z.incIn; }) / rows.length * 100) / 100 : 0], ['Average rental length (days)', rows.length ? Math.round(sum(rows.map(function (z) { return z.x.days; })) / rows.length * 10) / 10 : 0], [],
    ['By car'], ['Car', 'Plate', 'Bookings', 'Days booked', 'Utilisation', 'Rental income', 'Delivery fee', 'Return fee', 'Damage coverage', 'Total income']].concat(byCar).concat([['Total', '', rows.length, tot(function (z) { return z.n; }), '', sum(byCar.map(function (r) { return r[5]; })), sum(byCar.map(function (r) { return r[6]; })), sum(byCar.map(function (r) { return r[7]; })), sum(byCar.map(function (r) { return r[8]; })), sum(byCar.map(function (r) { return r[9]; }))], []]);
  var group = function (key, label) { var m = {}; rows.forEach(function (z) { var k = z.x[key] || 'None'; m[k] = m[k] || [0, 0]; m[k][0]++; m[k][1] += z.incIn; }); summary.push([label, 'Bookings', 'Total income']); Object.keys(m).forEach(function (k) { summary.push([k, m[k][0], Math.round(m[k][1] * 100) / 100]); }); summary.push([]); };
  group('method', 'By payment method'); group('pay', 'By payment status');
  summary.push(['How the numbers are worked out'], ['Rental income = rent minus discount. Total income = rental income + delivery + return + damage coverage + other charges.'], ['The deposit is never income: it goes back to the customer.'], ['Each rental is cut into 24-hour blocks from the pick-up time; a block counts in the period when it starts inside it.'], ['Utilisation = days booked / days in the period, per car.'], ['Pending and cancelled bookings are not income, so they are not in this report.']);
  var daily = [['Daily rental amount by car (RM)'], ['Rental income per 24-hour block, ' + UI.fmt.date(from) + ' to ' + UI.fmt.date(to)], ['Block starts (day)', 'Block ends (next day)'].concat(cars.map(function (c) { return carLbl(c) + '\n' + c.plate; })).concat(['Total'])];
  for (var k = 0; k < nDays; k++) {
    var ds = new Date(from.getTime() + k * DAY), de = new Date(ds.getTime() + DAY), vals = cars.map(function (c) { var s2 = sum(rows.filter(function (z) { return z.x.car === c; }).map(function (z) { var hit = 0; for (var j = 0; j < z.x.days; j++) { var bs = new Date(z.x.start.getTime() + j * DAY); if (bs >= ds && bs < de) hit++; } return hit * z.inc / z.x.days; })); return s2 ? Math.round(s2 * 100) / 100 : null; });
    daily.push([ds, de].concat(vals).concat([Math.round(sum(vals.map(function (v) { return v || 0; })) * 100) / 100]));
  }
  daily.push(['Total', ''].concat(cars.map(function (c, j) { return Math.round(sum(daily.slice(3).map(function (r) { return r[2 + j] || 0; })) * 100) / 100; })).concat([Math.round(sum(daily.slice(3).map(function (r) { return r[r.length - 1]; })) * 100) / 100]));
  var bk = [['Booking ID', 'Status', 'Customer', 'IC / Passport (middle hidden)', 'Phone', 'Car', 'Plate', 'Pickup', 'Return', 'Days\n(whole booking)', 'Daily rate', 'Rent\n(whole booking)', 'Discount\n(whole booking)', 'Rental income\n(whole booking)', 'Delivery fee\n(whole booking)', 'Return fee\n(whole booking)', 'Damage coverage\n(whole booking)', 'Total income\n(whole booking)', 'Deposit held\n(whole booking)', 'Total payable\n(whole booking)', 'Payment method', 'Payment status', 'Created', 'Days in period', 'Income in period']].concat(rows.map(function (z) {
    var x = z.x; return [x.code, x.status, x.cust.name, UI.fmt.ic(x.cust.ic), x.cust.phone, carLbl(x.car), x.car.plate, x.start, x.end, x.days, x.rate, x.rent, x.disc, x.rent - x.disc, x.deliv, x.ret, x.dmg, z.inc, x.dep, x.payable, x.method, x.pay || 'None', x.created, z.n, z.incIn];
  }));
  DB.log('Exported', 'Booking', '', DB.actor() + ' downloaded the bookings report for ' + UI.fmt.date(from) + ' to ' + UI.fmt.date(to));
  return UI.xlsx('bookings-and-income-' + from.getFullYear() + '-' + String(from.getMonth() + 1).padStart(2, '0') + '.xlsx', [
    { name: 'Summary', rows: summary, cols: [30, 16, 12, 12, 12, 14, 12, 12, 14, 14], money: [1, 5, 6, 7, 8, 9], merges: ['A1:F1', 'A2:F2'] },
    { name: 'Daily by car', rows: daily, cols: [16, 16].concat(cars.map(function () { return 16; })).concat([14]), money: cars.map(function (c, j) { return 2 + j; }).concat([2 + cars.length]), dateFormat: 'dd mmm yyyy' },
    { name: 'Bookings', rows: bk, cols: [12, 16, 22, 18, 16, 22, 11, 18, 18, 10, 10, 12, 10, 12, 10, 10, 12, 12, 12, 12, 16, 20, 18, 10, 12], money: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 24], filter: true }
  ]);
}
function bkExportPop(anchor, f) {
  var n = NOW(), y = n.getFullYear(), m = n.getMonth();
  var ranges = { month: [new Date(y, m, 1), new Date(y, m + 1, 0), 'This month'], last: [new Date(y, m - 1, 1), new Date(y, m, 0), 'Last month'], d30: [new Date(y, m, n.getDate() - 29), new Date(y, m, n.getDate()), 'Last 30 days'], year: [new Date(y, 0, 1), new Date(y, 11, 31), 'This year'] };
  var st = { k: 'month', from: UI.isoDate(ranges.month[0]), to: UI.isoDate(ranges.month[1]) };
  var pop = UI.popover(anchor, function (el) {
    var s = UI.parseDate(st.from), e = UI.parseDate(st.to), days = s && e ? Math.round((e - s) / DAY) + 1 : 0, err = !s || !e ? 'Choose a start and an end date.' : e < s ? 'The end is before the start.' : days > 366 ? 'Choose a period of at most 366 days.' : '';
    el.innerHTML = '<div class="bkx-exp"><b>Export bookings to Excel</b><span class="b2">One row per booking, income per car and per day.</span><div class="bkx-exp-chips">' + Object.keys(ranges).map(function (k) { return '<button type="button" class="ui-fchip" data-ex="' + k + '" aria-pressed="' + (st.k === k) + '">' + ranges[k][2] + '</button>'; }).join('') + '<button type="button" class="ui-fchip" data-ex="custom" aria-pressed="' + (st.k === 'custom') + '">Custom period</button></div>' +
      (st.k === 'custom' ? '<div class="bkx-exp-r">' + UI.dateField({ key: 'ex-from', label: 'From', value: st.from, chips: false }) + UI.dateField({ key: 'ex-to', label: 'To', value: st.to, chips: false }) + '</div>' : '') +
      '<div class="b2">' + (err ? '<span class="ui-err">' + err + '</span>' : UI.fmt.date(s) + ' to ' + UI.fmt.date(e) + ' · ' + plural(days, 'day')) + '</div>' +
      UI.btn('Download', { icon: 'download', disabled: !!err, attrs: { 'data-ex-go': 1 } }) + '</div>';
  }, { width: 340, align: 'end' });
  pop.el.addEventListener('click', function (ev) {
    var x = ev.target.closest('[data-ex]');
    if (x) { st.k = x.getAttribute('data-ex'); if (ranges[st.k]) { st.from = UI.isoDate(ranges[st.k][0]); st.to = UI.isoDate(ranges[st.k][1]); } pop.refresh(); return; }
    if (ev.target.closest('[data-ex-go]')) { pop.close(); bkExport(UI.parseDate(st.from), UI.parseDate(st.to), f); }
  });
  pop.el.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k !== 'ex-from' && k !== 'ex-to') return; if (k === 'ex-from') st.from = ev.target.value; else st.to = ev.target.value; pop.refresh(); });
}

/* ---------------- the booking drawer ----------------
   New booking: Customer (Find a customer first), Read IC or licence, Car and dates, Prices and cover, Pick-up and return,
   Payment method and status, Admin, Customer files. An existing booking starts with Car and dates, Prices and Pick-up
   (the usual edits), then Customer; it also gets a side column, and on phones a row of jump chips. */
var BK_DR = null;
var BK_LENS = [['1', '1 day'], ['2', '2 days'], ['3', '3 days'], ['7', '1 week'], ['h12', '+12 hours']];
function bkOpenBooking(code, prefill) {
  if (!can(code ? 'bookings.view' : 'bookings.create')) { UI.toast(code ? 'Seeing bookings needs the "See bookings" access.' : 'Adding bookings needs the "Add bookings" access.', { tone: 'warn' }); return null; }
  var d = D(), x = code ? findBooking(code) : null;
  if (code && !x) { UI.toast('Booking ' + code + ' was not found. It may have been deleted.', { tone: 'warn' }); return null; }
  var key = code || 'new';
  if (BK_DR && !BK_DR.closed && BK_DR.data.key === key) return BK_DR;
  prefill = prefill || {};
  var isNew = !x, ro = !isNew && !can('bookings.edit'), amt = can('bookings.edit_amounts'), seeAmt = amt || can('bookings.see_amounts'), chSt = can('bookings.change_status');
  var preId = prefill.customer || prefill.cust, pre = !x && preId ? byId(d.people, preId) : null;
  var p = x ? x.cust : pre, carPre = prefill.car ? carById(prefill.car) || d.cars.filter(function (c) { return normPlate(c.plate) === normPlate(prefill.car); })[0] : null;
  var asDate = function (v) { return v instanceof Date ? v : v ? UI.parseDate(v) : null; };
  var s0 = asDate(prefill.start); if (!s0 || isNaN(s0)) { s0 = new Date(NOW().getTime() + DAY); s0.setHours(10, 0, 0, 0); }
  var e0 = asDate(prefill.end); if (!e0 || isNaN(e0)) e0 = new Date(s0.getTime() + 2 * DAY);
  var docs = x ? Object.assign({}, x.docs || {}) : { poa: null, dl: null, icFront: null, icBack: null, other: null };
  var optOf = function (opt, loc) { return opt === 'Pick-up from our location' || opt === 'Drop-off at our location' ? opt + '|' + loc : opt || 'Not chosen'; };
  var v = x ? { car: x.car.id, start: x.start, end: x.end, rate: x.rate, hourly: x.hourly, dep: x.dep, disc: x.disc, pkg: x.pkg || (x.cov ? 'manual' : ''), covName: x.cov ? x.cov.name : '', covDaily: x.cov ? x.cov.daily : '', covMax: x.cov ? x.cov.max : '', deliv: x.deliv, ret: x.ret, others: x.others || 0,
    startOpt: optOf(x.startOpt, x.pickup), endOpt: optOf(x.endOpt, x.drop), delNote: x.delNote, retNote: x.retNote, method: x.method, pay: x.pay || '', status: x.status, signature: x.signature || '', filledByAdmin: x.filledByAdmin, submitted: x.submitted }
    : { car: carPre ? carPre.id : '', start: s0, end: e0, rate: carPre ? carPre.rate : 0, hourly: carPre ? carPre.hourly : 0, dep: carPre ? carPre.deposit : 0, disc: 0, pkg: CO().packageDefault || '', covName: '', covDaily: '', covMax: '', deliv: 0, ret: 0, others: 0, startOpt: 'Not chosen', endOpt: 'Not chosen', delNote: '', retNote: '', method: 'Online Transfer', pay: '', status: 'Pending', signature: (d.signatures[0] || {}).id || '', filledByAdmin: true, submitted: false };
  if (v.pkg && v.pkg !== 'manual' && !byId(d.damagePackages, v.pkg)) v.pkg = '';
  /* a lead (or any caller) can name the pick-up and return: an option value, its label, or just 'Pick-up from our location' */
  var optPre = function (which, want) {
    if (!want) return null; var list = handoverOptions(which), w = String(want);
    var hit = list.filter(function (o) { return o.value === w || o.label === w; })[0] || list.filter(function (o) { return o.value.split('|')[0] === w; })[0] || list.filter(function (o) { return o.label.indexOf(w) === 0; })[0];
    return hit ? hit.value : null;
  };
  if (!x) {
    var so0 = optPre('start', prefill.startOpt), eo0 = optPre('end', prefill.endOpt), fee0 = function (which, val) { var o = handoverOptions(which).filter(function (z) { return z.value === val; })[0]; return o && o.fee != null ? o.fee : 0; };
    if (so0) { v.startOpt = so0; v.deliv = fee0('start', so0); }
    if (eo0) { v.endOpt = eo0; v.ret = fee0('end', eo0); }
    /* fees and cover a caller already agreed with the customer (a lead's quote) win over the option's fixed fee */
    var preNum = function (k) { var n = prefill[k]; return n != null && n !== '' && !isNaN(n) ? Math.max(0, Number(n)) : null; };
    if (preNum('deliv') != null) v.deliv = preNum('deliv');
    if (preNum('ret') != null) v.ret = preNum('ret');
    if (prefill.pkg != null && (prefill.pkg === '' || byId(d.damagePackages, prefill.pkg))) v.pkg = prefill.pkg;
  }
  var estimate = !x ? preNum && preNum('estimate') : null, estDep = !x && preNum ? preNum('estDep') : null;
  var leadId = !x && prefill.lead ? prefill.lead : null;
  var custOf = function (c0) { c0 = c0 || {}; var em = c0.emergency || {}; return { name: c0.name || '', phone: c0.phone || '', email: c0.email || '', address: c0.address || '', nat: c0.nat || 'Malaysian', ic: c0.ic || '', licenceNo: c0.licenceNo || '', licenceExp: c0.licenceExp || null, emName: em.name || '', emPhone: em.phone || '', emRel: em.rel || '' }; };
  var cust = custOf(p);
  if (!x && !p) { if (prefill.name) cust.name = String(prefill.name); if (prefill.phone) cust.phone = bkTidyPhone(String(prefill.phone)); }
  var check = { files: [], read: null, results: null, valid: null, filled: '', why: '', fill: false, error: '' }, dirty = false, saved = false, offData = null, carCtl = null, custCtl = null, avail = { key: '', res: { free: true } }, prevEnd = v.end;
  var onPage = S.page === 'bookings' && CUR && CUR.ctx;
  var refLocked = function () { var f = dr && dr.body ? form() : {}; var e = f.end ? UI.parseDate(f.end) : v.end; return !canPickRefunded({ end: e, pay: x ? x.pay : '' }); };

  /* ---- field builders ---- */
  var money = function (k, label, req, o) { o = o || {}; return UI.input({ key: k, label: label, type: 'number', value: v[k], required: req, readonly: !amt, step: '0.01', min: 0, placeholder: o.ph, prefix: 'RM' }); };
  var sect = function (title, icon, inner, o) { o = o || {}; return '<section class="bkx-sec' + (o.coll ? ' coll' : '') + (o.shut ? ' shut' : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><div class="bkx-sec-h"' + (o.coll ? ' role="button" tabindex="0" data-bkx-tog' : '') + '>' + i(icon) + '<span class="grow">' + title + '</span>' + (o.act || '') + (o.coll ? i('chevron-down', 'bkx-chev') : '') + '</div><div class="bkx-sec-b">' + inner + '</div></section>'; };
  var pkgOpts = [['', 'No damage cover']].concat(d.damagePackages.map(function (pk) { return [pk.id, bkPkgLabel(pk)]; })).concat([['manual', 'Set by hand']]);

  function checkerHtml() {
    return '<div class="bkx-chk"><div class="bkx-chk-b">' + [['ic', 'IC front', 'id', 'c'], ['icBack', 'IC back', 'id', 'tonal'], ['passport', 'Passport', 'book-2', 'tonal'], ['dl', 'Driving licence', 'license', 'tonal'], ['poa', 'Proof of address', 'home', 'tonal'], ['other', 'Other files', 'paperclip', 'tonal']].map(function (b2) {
      return '<label class="btn ' + b2[3] + ' sm">' + i(b2[2]) + b2[1] + '<input type="file" accept="' + (/^(ic|passport|dl)$/.test(b2[0]) ? 'image/*' : 'image/*,.pdf') + '" hidden data-bkx-chk="' + b2[0] + '"></label>';
    }).join('') + '</div><p class="b2">Reading a card fills in the customer and checks our blacklist. Everything uploaded is saved with the booking.</p><div id="bkx-chk-out"></div></div>';
  }
  function formHtml() {
    var h = '<div class="bkx-form">';
    var hChk = isNew && can('customers.check_ic') ? sect('Read IC or licence', 'shield-search', checkerHtml(), { id: 'bkx-s-chk', coll: true, shut: bkIsPhone() }) : '';
    /* 1. customer */
    var hCust = sect('Customer', 'user', (isNew && !ro ? '<div class="bkx-cpick" id="bkx-cpick"></div>' : '') + '<div class="bkx-g">' +
      UI.input({ key: 'name', label: 'Full Name', value: cust.name, required: true, style: 'grid-column:span 2', attrs: { autocomplete: 'off' } }) + UI.input({ key: 'phone', label: 'Phone', type: 'tel', value: cust.phone, required: true, placeholder: '+60 12 345 6789' }) + UI.input({ key: 'email', label: 'Email', type: 'email', value: cust.email }) +
      UI.input({ key: 'ic', label: 'IC / Passport no.', value: cuSeeIc() || isNew ? cust.ic : UI.fmt.ic(cust.ic), readonly: !cuSeeIc() && !isNew, help: !cuSeeIc() && !isNew ? 'Middle hidden for you' : '' }) + UI.input({ key: 'nat', label: 'Nationality', value: cust.nat, placeholder: 'Type to search', attrs: { list: 'bkx-nats' } }) +
      UI.input({ key: 'licenceNo', label: 'Licence no.', value: cust.licenceNo }) + UI.dateField({ key: 'licenceExp', label: 'Licence expiry', value: cust.licenceExp, chips: false }) +
      UI.input({ key: 'address', label: 'Residential Address', value: cust.address, style: 'grid-column:1 / -1' }) +
      '<datalist id="bkx-nats">' + LISTS.nationalities.map(function (n) { return '<option value="' + n + '">'; }).join('') + '</datalist></div>' +
      '<div class="bkx-subh">' + i('phone-call') + 'Emergency contact</div><div class="bkx-g3">' + UI.input({ key: 'emName', label: 'Name', value: cust.emName }) + UI.input({ key: 'emPhone', label: 'Phone', type: 'tel', value: cust.emPhone }) + UI.input({ key: 'emRel', label: 'Relationship', value: cust.emRel, attrs: { list: 'bkx-rels' }, placeholder: 'Relative, Sibling, Colleague' }) + '<datalist id="bkx-rels">' + LISTS.relationships.map(function (n) { return '<option value="' + n + '">'; }).join('') + '</datalist></div>', { id: 'bkx-s-cust' });
    if (p && can('customer_notes.view')) hCust += '<section class="bkx-sec" id="bkx-notes"></section>';
    if (x && can('customers.check_ic')) hCust += sect('Check IC', 'id-badge-2', '<div id="bkx-ic"></div>', { coll: true, shut: true });
    /* 2. car and dates */
    var hCar = sect('Car and dates', 'car', '<div class="bkx-g"><div class="full" id="bkx-carpick"></div>' +
      UI.dateTimeField({ key: 'start', label: 'Rental start', value: v.start, required: true, style: 'grid-column:span 2', disabled: ro }) +
      UI.dateTimeField({ key: 'end', label: 'Rental end', value: v.end, required: true, style: 'grid-column:span 2', chips: false, disabled: ro }) +
      (ro ? '' : '<div class="full bkx-lens" role="group" aria-label="Rental length"><span class="b2">Length</span>' + BK_LENS.map(function (l) { return '<button type="button" class="ui-fchip" data-bkx-len="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '<span class="bkx-durtx" id="bkx-durtx"></span></div>') +
      '<div class="full" id="bkx-alerts"></div></div>', { id: 'bkx-s-car' });
    /* 3. prices and cover */
    var hPrice = seeAmt ? sect('Prices and cover', 'calculator', '<div class="bkx-g">' + (!amt && !ro ? '<div class="full">' + UI.alert('You can add bookings, but setting the prices needs the "Edit amounts" access. The prices come from the car.', 'pri') + '</div>' : '') +
      money('rate', 'Daily rate', true) + money('hourly', 'Hourly rate', true) + money('dep', 'Deposit', true) + money('disc', 'Discount') +
      UI.select({ key: 'pkg', label: 'Damage cover', options: pkgOpts, value: v.pkg, disabled: !amt, style: 'grid-column:span 2' }) + money('others', 'Others') +
      '<div class="bkx-man full" ' + (v.pkg === 'manual' ? '' : 'hidden') + '><div class="bkx-g3">' + UI.input({ key: 'covName', label: 'Coverage name', value: v.covName, readonly: !amt }) + UI.input({ key: 'covDaily', label: 'Coverage per day', type: 'number', value: v.covDaily, readonly: !amt, prefix: 'RM' }) + UI.input({ key: 'covMax', label: 'Max coverage', type: 'number', value: v.covMax, readonly: !amt, prefix: 'RM' }) + '</div></div>' +
      '<div class="full bkx-calc" id="bkx-calc"></div></div>', { id: 'bkx-s-price' })
      : '<p class="b2 bkx-hidamt">Amounts are hidden for you.</p>';
    /* 4. pick-up and return */
    var hHand = sect('Pick-up and return', 'map-pin', '<div class="bkx-g">' + UI.select({ key: 'startOpt', label: 'Start of rental', options: bkHandoverOpts('start', v.startOpt), value: v.startOpt, style: 'grid-column:span 2' }) + UI.select({ key: 'endOpt', label: 'End of rental', options: bkHandoverOpts('end', v.endOpt), value: v.endOpt, style: 'grid-column:span 2' }) +
      (seeAmt ? money('deliv', 'Delivery charge') + money('ret', 'Return charge') + '<p class="b2 bkx-feehint" style="grid-column:span 2">Picking a place fills its delivery or return charge from Settings.</p>' : '') +
      UI.input({ key: 'delNote', label: 'Delivery / pick-up note', value: v.delNote, style: 'grid-column:span 2', placeholder: 'For example: hotel lobby, call on arrival' }) + UI.input({ key: 'retNote', label: 'Return / drop-off note', value: v.retNote, style: 'grid-column:span 2' }) + '</div>' +
      (x ? '<div id="bkx-fees"></div>' : ''), { id: 'bkx-s-hand' });
    if (x) { var sm = d.summons.filter(function (z) { return z.booking === x.code; }); if (sm.length && can('summons.view')) hHand += sect('Summons on this booking (' + sm.length + ')', 'gavel', '<div class="bkx-sum">' + sm.map(function (z) { return '<button type="button" class="bkx-sumr" data-bkx-sum="' + z.id + '"><span class="grow"><b>' + esc(z.authority) + ' ' + esc(z.notice) + '</b><small>' + esc(z.offence) + ' · ' + UI.fmt.dateTime(z.at) + '</small></span>' + UI.money(z.fine) + UI.status('summons', z.status, null, { sm: true }) + '</button>'; }).join('') + '</div>'); }
    /* 5. payment and status */
    var locked = !canPickRefunded({ end: v.end, pay: x ? x.pay : '' });
    var hPay = sect('Payment method and status', 'credit-card', '<div class="bkx-g3">' + UI.select({ key: 'method', label: 'Payment Method', required: true, options: LISTS.bookingMethods || LISTS.methods, value: v.method }) +
      bkLockRefunded(UI.select({ key: 'pay', label: 'Payment Status', options: bkPayOptions(locked), value: v.pay, disabled: !chSt }), locked) + UI.select({ key: 'status', label: 'Booking Status', options: LISTS.bookingStatus, value: v.status, disabled: !chSt }) + '</div><p class="b2 bkx-rule" id="bkx-rule"></p>' + (chSt ? '' : '<p class="b2">Changing a status needs the "Change status" access.</p>'), { id: 'bkx-s-pay' });
    /* 6. admin */
    hPay += sect('Admin', 'signature', '<div class="bkx-g3"><div class="bkx-sigsel">' + UI.select({ key: 'signature', label: 'Authority Signature', options: [['', 'No signature']].concat(d.signatures.map(function (s) { return [s.id, s.name]; })), value: v.signature, disabled: !can('signatures.use_on_booking') }) + '<span class="bkx-sigimg"></span></div>' +
      UI.switch({ key: 'filledByAdmin', label: 'Filled by Admin', help: 'Staff typed the customer details', checked: v.filledByAdmin }) + UI.switch({ key: 'submitted', label: 'Is Submitted', help: 'The customer signed the booking form', checked: v.submitted }) + '</div>', { id: 'bkx-s-admin' });
    if (x) {
      var pk = x.pkg ? byId(d.damagePackages, x.pkg) : null, ro2 = function (k, l, val) { return UI.input({ key: 'ri-' + k, label: l, value: val, readonly: true }); };
      hPay += sect('Record info', 'history', '<div class="bkx-g">' + ro2('c', 'Created At', UI.fmt.dateTime(x.created)) + ro2('u', 'Updated At', UI.fmt.dateTime(x.updated || x.created)) + ro2('s', 'Submitted At', x.submittedAt ? UI.fmt.dateTime(x.submittedAt) : '-') + ro2('ip', 'IP Address', x.ip || '-') +
        ro2('pk', 'Damage Package', pk ? pk.name : x.cov ? x.cov.name : '-') + ro2('pd', 'Damage Daily Rate', pk ? UI.fmt.money(pk.daily) : x.cov ? UI.fmt.money(x.cov.daily) : '-') + ro2('pm', 'Max Coverage', pk ? UI.fmt.money(pk.max) : x.cov ? UI.fmt.money(x.cov.max) : '-') + ro2('pt', 'Total Coverage', UI.fmt.money(x.dmg || 0)) + '</div>', { coll: true, shut: true });
    }
    /* 7. documents */
    var hFiles = !can('bookings.view_documents') ? '' : sect('Customer files', 'files', '<div id="bkx-docs"></div>', { coll: true, shut: isNew, id: 'bkx-s-docs' });
    /* a new booking starts with the customer; an existing one with the car, the dates and the money (the usual edits) */
    h += isNew ? hCust + hChk + hCar + hPrice + hHand + hPay + hFiles : hCar + hPrice + hHand + hCust + hPay + hFiles;
    return h + '</div>';
  }
  /* handover fees recorded on this booking (from expenses): who recorded which fee */
  function feesHtml() {
    var cats = {}; d.expenseCats.forEach(function (c) { cats[c.id] = c; });
    var list = d.expenses.filter(function (e) { return e.booking === x.code && cats[e.cat] && cats[e.cat].agentFee; }).sort(function (a, b) { return a.day - b.day; });
    var canAdd = API.addExpense && (can('expenses.add') || can('expenses.add_business'));
    return '<div class="bkx-fees"><div class="bkx-subh">' + i('coins') + 'Handover fees on this booking<span class="grow"></span>' + (canAdd ? UI.btn('Record a fee', { kind: 't', size: 'sm', icon: 'plus', attrs: { 'data-bs': 'fee' } }) : '') + '</div>' +
      (list.length ? '<div class="bkx-feel">' + list.map(function (e) { var c = cats[e.cat]; return '<div class="bkx-feer">' + UI.avatar(staffName(e.by)) + '<span class="grow"><b>' + esc(staffName(e.by)) + '</b><small>' + esc(c.name) + ' · ' + UI.fmt.date(e.day) + '</small></span>' + (seeAmt ? UI.money(e.amount) : '') + '</div>'; }).join('') + '</div>'
        : '<p class="b2">No handover fees recorded yet. The agent who hands the car over records theirs under Expenses.</p>') + '</div>';
  }
  /* the side column (existing bookings): status, money, documents and links, inspection, deposit, team */
  function sideHtml() {
    var m = bkMoney(x), inv = bkInvoice(x.code), rcps = bkReceipts(x.code), ins = d.inspections.filter(function (z) { return z.booking === x.code; })[0];
    var ln = function (icon, label, sub, acts) { return '<div class="bkx-ln"><span class="bkx-ln-ic">' + i(icon) + '</span><div class="grow"><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><div class="bkx-ln-a">' + acts + '</div></div>'; };
    var ib = function (icon, label, act, val, dis) { return UI.iconBtn(icon, label, { size: 'sm', disabled: dis, attrs: { 'data-bs': act, 'data-v': val || '' } }); };
    var out = '<div class="bkx-card"><div class="bkx-card-h">Status</div><div class="bkx-sts">' + (chSt ? '<button type="button" class="bkx-stb" data-bs="st" title="Change the booking status">' + UI.status('booking', x.status) + i('chevron-down') + '</button><button type="button" class="bkx-stb" data-bs="pay" title="Change the payment status">' + UI.status('payment', x.pay || 'None') + i('chevron-down') + '</button>' : UI.status('booking', x.status) + UI.status('payment', x.pay || 'None')) + '</div>' +
      (seeAmt && x.status !== 'Cancelled' ? bkMoneyBox(m) : '') + '</div>';
    out += '<div class="bkx-card"><div class="bkx-card-h">Documents</div>' +
      ln('link', 'Booking form link', '<span class="ellip" title="' + esc(siteLink(x, '')) + '">' + esc(siteLink(x, '').replace('https://', '')) + '</span>', ib('brand-whatsapp', 'Send the booking form', 'send') + ib('copy', 'Copy Link', 'copy') + ib('external-link', 'Open the booking form', 'bf')) +
      (can('bookings.view_documents') ? ln('file-certificate', 'Rental agreement', x.submitted ? 'Signed ' + UI.fmt.dateTime(x.submittedAt || x.created) : 'Not signed yet', ib('file-type-pdf', 'View PDF', 'pdf') + ib('copy', 'Copy agreement link', 'pdflink')) : '');
    if (can('billing.view') || can('billing.issue_invoice')) {
      out += inv ? ln('file-invoice', 'Invoice ' + inv.no, UI.fmt.date(inv.issued) + (inv.sent.length ? ' · sent ' + UI.fmt.ago(inv.sent[inv.sent.length - 1].at) : ' · not sent yet'), ib('eye', 'Preview ' + inv.no, 'doc', inv.no) + ib('file-type-pdf', 'Download PDF', 'docpdf', inv.no) + (can('billing.send') ? ib('send', 'Send invoice', 'docsend', inv.no) : ''))
        : ln('file-invoice', 'Invoice', 'No invoice yet', can('billing.issue_invoice') ? UI.btn('Create', { kind: 'tonal', size: 'sm', icon: 'plus', attrs: { 'data-bs': 'inv' } }) : '');
      out += rcps.length ? rcps.map(function (r) { return ln('receipt', 'Receipt ' + r.no, UI.fmt.money(r.amount) + ' · ' + esc(r.kind), ib('eye', 'Preview ' + r.no, 'doc', r.no) + ib('file-type-pdf', 'Download PDF', 'docpdf', r.no) + (can('billing.send') ? ib('send', 'Send receipt', 'docsend', r.no) : '')); }).join('') : ln('receipt', 'Receipts', 'No receipts yet', '');
      out += '<div class="bkx-card-a">' + (can('billing.record_payment') ? UI.btn('Record payment', { kind: 'o', size: 'sm', icon: 'cash', attrs: { 'data-bs': 'recpay' } }) + UI.btn('Upload slip', { kind: 'o', size: 'sm', icon: 'upload', attrs: { 'data-bs': 'slip' } }) : '') + UI.btn('All billing', { kind: 't', size: 'sm', icon: 'list-details', attrs: { 'data-bs': 'allbill' } }) + '</div>';
    }
    out += '</div>';
    if (can('inspections.view')) out += '<div class="bkx-card"><div class="bkx-card-h">Inspection</div>' + ln(ins ? 'clipboard-check' : 'clipboard-x', ins ? 'Done' : 'Not done yet', ins ? (ins.custAt ? 'Customer ' + UI.fmt.dateTime(ins.custAt) : 'Customer photos missing') + ' · ' + plural(ins.photos.length, 'photo') : 'Send the links at handover', ib('eye', 'View Inspection Data', 'ins')) +
      '<div class="bkx-card-a">' + UI.btn('Agent link', { kind: 'o', size: 'sm', icon: 'user-scan', attrs: { 'data-bs': 'agentlink' } }) + UI.btn('Customer link', { kind: 'o', size: 'sm', icon: 'link', attrs: { 'data-bs': 'custlink' } }) + '</div></div>';
    var dep = '';
    if (can('deposits.view')) dep = x.pay === 'Refund Pending' ? '<div class="bkx-dep warn">' + i('cash-banknote') + '<span class="grow">Deposit: waiting to be returned</span>' + UI.btn('Return the deposit', { kind: 'tonal', size: 'sm', attrs: { 'data-bs': 'dep' } }) + '</div>' : x.pay === 'Deposit Refunded' ? '<div class="bkx-dep ok">' + i('circle-check') + '<span class="grow">Deposit: ' + (x.dep > 0 ? 'returned to the customer' : 'none was taken') + '</span>' + UI.btn('See details', { kind: 't', size: 'sm', attrs: { 'data-bs': 'dep' } }) + '</div>' : '';
    var ag = bkAgents(x);
    out += '<div class="bkx-card">' + dep + '<div class="bkx-card-h">Team</div>' + ln('users', ag.length ? ag.join(', ') : 'No agent yet', 'Agents on this booking\'s tasks', can('tasks.create') ? UI.btn('Assign task', { kind: 'tonal', size: 'sm', icon: 'calendar-plus', attrs: { 'data-bs': 'task' } }) : '') + '</div>';
    return out;
  }

  var dr = UI.drawer({
    /* on a phone the code alone, so it never breaks across two lines beside the header buttons (the subtitle names the customer and car) */
    title: isNew ? (pre ? 'New Booking for ' + pre.name : 'New Booking') : (window.matchMedia('(max-width:760px)').matches ? '' : ro ? 'Booking ' : 'Edit Booking ') + x.code,
    subtitle: isNew ? 'Find the customer, then pick the car and the dates.' : x.cust.name + ' · ' + x.car.plate + ' · ' + carName(x.car), width: isNew ? 900 : 1180, data: { key: key },
    actions: x ? UI.iconBtn('copy', 'Copy the booking form link', { attrs: { 'data-bs': 'copy' } }) + (can('bookings.view_documents') ? UI.iconBtn('file-type-pdf', 'Agreement PDF', { attrs: { 'data-bs': 'pdf' } }) : '') + (can('bookings.delete') ? UI.iconBtn('trash', 'Delete this booking', { attrs: { 'data-bs': 'del' } }) : '') : '',
    body: function (el, ctl) {
      dr = ctl;
      /* phones and tablets: one row of jump chips that stays on top, so the car, the money and the files are one tap away */
      var jump = x ? '<nav class="bkx-jump" data-srow aria-label="Go to a part of the booking">' + [['bkx-s-car', 'Car and dates', 'car'], [seeAmt ? 'bkx-s-price' : '', 'Money', 'calculator'], ['bkx-s-cust', 'Customer', 'user'], ['bkx-side', 'Status and papers', 'list-details'], [can('bookings.view_documents') ? 'bkx-s-docs' : '', 'Files', 'files']].filter(function (j) { return j[0]; }).map(function (j) { return '<button type="button" class="ui-fchip" data-bkx-jump="' + j[0] + '">' + i(j[2]) + j[1] + '</button>'; }).join('') + '</nav>' : '';
      el.innerHTML = jump + '<div class="bkx-dl' + (x ? ' two hb' : '') + '"><div class="bkx-banner">' + (p && typeof cuBanner === 'function' ? cuBanner(p) : '') + '</div>' + (x ? '<aside class="bkx-side" id="bkx-side">' + sideHtml() + '</aside>' : '') + '<div class="bkx-main">' + formHtml() + '</div></div>';
      var n = el.querySelector('#bkx-notes'); if (n && typeof cuNotesMount === 'function') cuNotesMount(n, p, { booking: x ? x.code : null, onChange: function () { drawBanner(); } });
      var ic = el.querySelector('#bkx-ic'); if (ic && typeof cuIcMount === 'function') cuIcMount(ic, p, { bookingName: function () { var f = el.querySelector('[data-key="name"]'); return f ? f.value : p.name; } });
      mountDocs(isNew && pre ? pre.docs : null);
      var fe = el.querySelector('#bkx-fees'); if (fe) fe.innerHTML = feesHtml();
      carCtl = UI.carPicker(el.querySelector('#bkx-carpick'), { key: 'car', label: 'Car', required: true, value: v.car, start: v.start, end: v.end, exceptId: x ? x.code : undefined, disabled: ro,
        cars: d.cars.filter(function (c) { return c.fleet !== 'Sold' || (x && x.car === c); }), placeholder: 'Find the car by its plate',
        onChange: function (id, car) { dirty = true; clearErr('car'); if (car) fillCarPrices(car); recalc(); } });
      var cp = el.querySelector('#bkx-cpick');
      if (cp) custCtl = UI.combo(cp, { key: 'custPick', label: 'Find a customer', placeholder: pre ? pre.name : 'Search by name, phone or IC', title: 'Find a customer', searchPlaceholder: 'Name, phone or IC', value: pre ? pre.id : '', recentKey: 'bk-cust-' + B().id,
        help: 'Leave it empty for a new customer and type the details below.', emptyText: 'No customers yet.', noMatchHelp: 'No match. Type the details below to add a new customer.',
        items: function () { return d.people.map(function (q) { return { value: q.id, label: q.name, sub: q.phone + (q.ic ? ' · ' + (cuSeeIc() ? q.ic : UI.fmt.ic(q.ic)) : ''), q: q, badge: q.blacklist ? { text: 'Blacklisted', tone: 'bad' } : cuFlags(q).vip ? { text: 'VIP', tone: 'info' } : null }; }); },
        search: function (it, q) { var t = tidySearch(q), q2 = it.q; if (/^[+\d\s\-().]+$/.test(t)) t = t.replace(/\D/g, ''); if (/^\d{3,}$/.test(t) && phoneHas(q2.phone, t)) return 20; var icq = String(q).replace(/[\s-]/g, '').toUpperCase(); if (icq.length >= 4 && String(q2.ic || '').replace(/[\s-]/g, '').toUpperCase().indexOf(icq) >= 0) return 15; return UI.wordsMatch(q2.name + ' ' + q2.email, q) ? 5 : 0; },
        onChange: function (id) { pickCustomer(id ? byId(d.people, id) : null); } });
      if (ro) el.querySelectorAll('.bkx-form input, .bkx-form select, .bkx-form textarea').forEach(function (f) { if (!f.closest('#bkx-notes') && !f.closest('#bkx-ic') && !f.closest('#bkx-docs')) f.disabled = true; });
      recalc(); liveRules();
    },
    dirty: function () { return dirty && !saved; },
    foot: ro ? [{ label: 'Close', kind: 'o' }] : [{ label: 'Cancel', kind: 'o' }, { label: isNew ? 'Create' : 'Update', icon: 'check', onClick: function () { return save(); } }],
    onClose: function () { if (offData) offData(); if (onPage && S.page === 'bookings') CUR.ctx.setParams({ booking: '', action: '', customer: '', cust: '', car: '', start: '', end: '' }); }
  });
  BK_DR = dr;
  if (onPage) CUR.ctx.setParams(isNew ? { action: 'add' } : { booking: x.code, action: '' });
  if (x) offData = on('data', function (ev) {
    if (dr.closed) return; if (ev && ev.coll === 'bookings' && ev.op === 'remove' && ev.rec === x) { dr.close(true); return; }
    var s = dr.body.querySelector('#bkx-side'); if (s) s.innerHTML = sideHtml();
    var fe = dr.body.querySelector('#bkx-fees'); if (fe && ev && ev.coll === 'expenses') fe.innerHTML = feesHtml();
  });

  function form() { return UI.form(dr.body.querySelector('.bkx-form')); }
  function field(k) { return dr.body.querySelector('.bkx-form [data-key="' + k + '"]'); }
  function setVal(k, val) { var el = field(k); if (el && val != null) el.value = val; }
  function drawBanner() { var b2 = dr.body.querySelector('.bkx-banner'); if (b2) b2.innerHTML = p && typeof cuBanner === 'function' ? cuBanner(p) : ''; }
  function mountDocs(fromCustomer) {
    var dc = dr.body.querySelector('#bkx-docs'); if (!dc || typeof cuDocsMount !== 'function') return;
    cuDocsMount(dc, docs, { readonly: ro, person: p, fromCustomer: fromCustomer || null, onChange: function () { dirty = true; },
      extra: x && can('deposits.view') ? '<div class="cu-doc" id="bkx-slip"><div class="cu-doc-h">Deposit refund slip</div>' + (x.refundSlip ? '<div class="cu-doc-f"><button type="button" class="cu-link ellip" data-bs="slipopen">' + esc(x.refundSlip.name) + '</button></div>' : x.pay === 'Refund Pending' ? '<label class="btn o sm cu-up">' + i('upload') + 'Upload refund slip<input type="file" accept="image/*,.pdf" hidden data-bs-slip></label>' : '<div class="cu-none">The deposit is not waiting to be returned yet. It can be recorded once the booking is Refund Pending.</div>') + '</div>' : '' });
  }
  function fillCarPrices(c) {
    if (amt) { setVal('rate', c.rate); setVal('hourly', c.hourly); setVal('dep', c.deposit); }
    else { v.rate = c.rate; v.hourly = c.hourly; v.dep = c.deposit; ['rate', 'hourly', 'dep'].forEach(function (f2) { setVal(f2, v[f2]); }); }
  }
  /* a customer picked from the list fills every field and their documents; cleared = a new customer, empty fields */
  function pickCustomer(q) {
    p = q; dirty = true;
    var c = custOf(q);
    ['name', 'phone', 'email', 'address', 'nat', 'ic', 'licenceNo', 'emName', 'emPhone', 'emRel'].forEach(function (k) { setVal(k, c[k]); clearErr(k); });
    var le = field('licenceExp'); if (le) UI.setDateField(le, c.licenceExp ? new Date(c.licenceExp) : null, true);
    CU_DOCS.forEach(function (dc) { var k = dc[0]; if (q && q.docs && q.docs[k] && !docs[k]) docs[k] = Object.assign({}, q.docs[k]); if (!q && docs[k] && docs[k].fromCust) docs[k] = null; });
    if (q) CU_DOCS.forEach(function (dc) { if (docs[dc[0]] && q.docs && q.docs[dc[0]] && docs[dc[0]].name === q.docs[dc[0]].name) docs[dc[0]].fromCust = true; });
    mountDocs(q ? q.docs : null); drawBanner(); recalc();
    if (q) UI.toast('Filled in ' + q.name + '\'s details' + (CU_DOCS.some(function (dc) { return q.docs && q.docs[dc[0]]; }) ? ' and documents' : '') + '.', { ms: 2500 });
  }

  /* ---- prices, availability and warnings ---- */
  function calcNow() {
    var f = form(), pk = f.pkg && f.pkg !== 'manual' ? byId(d.damagePackages, f.pkg) : null, s = f.start ? UI.parseDate(f.start) : null, e = f.end ? UI.parseDate(f.end) : null;
    var num = function (k) { return f[k] == null ? +v[k] || 0 : +f[k] || 0; };
    return { f: f, s: s, e: e, pk: pk, c: s && e ? bkCalc({ start: s, end: e, rate: num('rate'), hourly: num('hourly'), dep: num('dep'), disc: num('disc'), deliv: num('deliv'), ret: num('ret'), others: num('others'), covDaily: pk ? pk.daily : f.pkg === 'manual' ? +f.covDaily || 0 : 0 }) : null, num: num };
  }
  function durText(c) { if (!c || !(c.hrs > 0)) return ''; var h = Math.round(c.remHours * 100) / 100; return (c.fullDays ? plural(c.fullDays, 'day') : '') + (c.fullDays && h ? ', ' : '') + (h ? (h % 1 ? h.toFixed(2).replace(/0$/, '') : h) + ' hour' + (h === 1 ? '' : 's') : ''); }
  function recalc() {
    var r = calcNow(), f = r.f, body = dr.body, c = r.c;
    var cb = body.querySelector('#bkx-calc');
    if (cb) {
      var row = function (l, val, cls) { return '<div class="bkx-cr' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b class="num">' + val + '</b></div>'; };
      cb.innerHTML = !c || !(c.hrs > 0) ? '<p class="b2">Pick the dates to see the charges.</p>' :
        '<div class="bkx-crs">' + row('Rental duration', durText(c) || '0 hours') +
        row('Rent', UI.fmt.money(c.rent) + '<small>' + (c.hrs < 24 ? Math.round(c.hrs * 100) / 100 + ' h x ' + UI.fmt.money(r.num('hourly')) : c.fullDays + ' x ' + UI.fmt.money(r.num('rate')) + (c.remHours > 0 ? ' + ' + Math.round(c.remHours * 100) / 100 + ' h x ' + UI.fmt.money(r.num('hourly')) : '')) + '</small>') +
        row('Deposit', UI.fmt.money(r.num('dep'))) + (c.cover ? row('Damage cover', UI.fmt.money(c.cover) + '<small>' + c.days + ' day' + (c.days === 1 ? '' : 's') + '</small>') : '') +
        (r.num('deliv') || r.num('ret') ? row('Delivery and return', UI.fmt.money(r.num('deliv') + r.num('ret'))) : '') + (r.num('others') ? row('Others', UI.fmt.money(r.num('others'))) : '') + (r.num('disc') ? row('Discount', '-' + UI.fmt.money(r.num('disc'))) : '') +
        row('Total payable', UI.fmt.money(c.payable), 'tot') + '</div>' + (estimate != null ? bkEstimateLine(c.payable, estimate, estDep) : '') + '<p class="b2">Under 24 hours: hours x hourly rate. Otherwise full days x daily rate + the hours left x hourly rate, rounded to whole ringgit.</p>';
    }
    var dt = body.querySelector('#bkx-durtx'); if (dt) dt.textContent = c && c.hrs > 0 ? durText(c) : '';
    var man = body.querySelector('.bkx-man'); if (man) man.hidden = f.pkg !== 'manual';
    var al = [], bad = false;
    if (r.s && r.e && r.e <= r.s) { al.push(UI.alert('Rental end cannot be before rental start.', 'bad')); bad = true; setErr('end', 'Rental end cannot be before rental start', true); }
    else { clearErr('end'); if (f.car && r.s && r.e) {
      /* the availability check runs again only when the car or the dates really changed */
      var k2 = f.car + '|' + +r.s + '|' + +r.e;
      if (avail.key !== k2) { avail.key = k2; avail.res = bkClash(f.car, r.s, r.e, x && x.code); if (carCtl) carCtl.setDates(r.s, r.e, x ? x.code : undefined); }
      var b = avail.res;
      /* like the reference backend: a new booking is always checked; an existing one only when its car or dates change,
         or it goes from Completed or Cancelled back to an active status. Completed and Cancelled never block. */
      var stNow = f.status || (x ? x.status : 'Pending'), nonBlock = stNow === 'Completed' || stNow === 'Cancelled', mn = function (t) { return Math.floor(+t / 6e4); };
      var need = !x || (!nonBlock && (x.status === 'Completed' || x.status === 'Cancelled' || f.car !== x.car.id || mn(r.s) !== mn(x.start) || mn(r.e) !== mn(x.end)));
      if (!b.free && need) { bad = true; al.push(UI.alert(bkBusyText(b), 'bad', { html: true })); }
      else if (!b.free) { if (!nonBlock && !ro) al.push(UI.alert(bkBusyText(b) + ' You can still save, because the car and the dates did not change.', 'warn', { html: true })); }
      else if (!ro && b.soon) al.push(UI.alert('Inside the ' + plural(b.gapH, 'hour') + ' gap between rentals. ' + b.soon + '. Check the car can be cleaned in time.', 'warn'));
      else if (!ro) al.push('<div class="bkx-ok">' + i('circle-check') + 'The car is free for these dates.</div>');
    } else if (r.s && r.e && carCtl) { var k3 = '|' + +r.s + '|' + +r.e; if (avail.key !== k3) { avail.key = k3; carCtl.setDates(r.s, r.e, x ? x.code : undefined); } } }
    if (isNew && !ro && r.s && r.s < NOW() - 6e4) al.unshift(UI.alert('The pick-up is in the past (' + UI.fmt.dt(r.s) + '). Is this a late entry? You will be asked to confirm on Create.', 'warn'));
    var nm = (f.name || '').trim().toLowerCase(), icn = (f.ic || '').replace(/[\s-]/g, ''), ph = normPhone(f.phone || '');
    var bl = d.people.filter(function (q) { return q.blacklist && q !== (x && x.cust) && ((nm && q.name.toLowerCase() === nm) || (icn.length > 5 && String(q.ic).replace(/[\s-]/g, '') === icn) || (ph.length > 6 && normPhone(q.phone) === ph)); })[0];
    if (bl || (p && p.blacklist && isNew)) al.push(UI.alert('Warning: This customer matches a blacklisted customer record. Please verify before proceeding.', 'bad', { icon: 'ban' }));
    var ab = body.querySelector('#bkx-alerts'); if (ab) ab.innerHTML = al.join('');
    var sg = body.querySelector('.bkx-sigimg'), sig = byId(d.signatures, f.signature); if (sg) sg.innerHTML = sig ? '<img src="' + sig.img + '" alt="' + esc(sig.name) + '">' : '';
    /* Deposit Refunded follows the end date (lock date rule) */
    var ps = field('pay'); if (ps) { var o2 = ps.querySelector('option[value="Deposit Refunded"]'), lk = refLocked(); if (o2 && ps.value !== 'Deposit Refunded') { o2.disabled = lk; o2.textContent = lk ? BK_REF_OFF : 'Deposit Refunded'; } }
    var btn = dr.el.querySelector('.ui-drw-f button:last-child'); if (btn && !ro) { btn.disabled = bad; btn.title = bad ? 'Fix the dates or pick a free car first' : ''; }
    return !bad;
  }
  /* what the status rules will do on save, said under the selects (and moved there at once for the signed switch and Car Returned) */
  function liveRules(trigger) {
    if (!chSt) return; var f = form(), rl = dr.body.querySelector('#bkx-rule'); if (!rl) return;
    var r = applyStatusRules(x || { status: 'Pending', pay: '' }, { status: f.status, pay: f.pay, submitted: f.submitted, dep: calcNow().num('dep') });
    if (trigger && (trigger === 'status' || trigger === 'submitted')) { if (r.status && r.status !== f.status) setVal('status', r.status); if (r.pay != null && r.pay !== f.pay) setVal('pay', r.pay); }
    rl.textContent = (r.notes || []).join(' ');
  }

  /* ---- required fields: red outline, a message under the field, open its section and scroll to the first ---- */
  function wrapOf(k) { if (k === 'car') return dr.body.querySelector('#bkx-carpick'); var f = field(k); return f ? f.closest('.inp') : null; }
  function setErr(k, msg, keepFocus) {
    if (k === 'car' && carCtl) { carCtl.setError(msg); return; }
    var w = wrapOf(k); if (!w) return; w.classList.add('bad');
    var e2 = w.querySelector('.ui-err'); if (!e2) { e2 = document.createElement('span'); e2.className = 'ui-err'; var hp = w.querySelector('.help'); w.insertBefore(e2, hp || null); } e2.textContent = msg;
  }
  function clearErr(k) {
    if (k === 'car') { if (carCtl && carCtl.options.error) carCtl.setError(''); return; }
    var w = wrapOf(k); if (!w || !w.classList.contains('bad')) return; w.classList.remove('bad'); var e2 = w.querySelector('.ui-err'); if (e2) e2.remove();
  }
  function validate(r) {
    var f = r.f, miss = [];
    if (!(f.name || '').trim()) miss.push(['name', 'Type the customer\'s full name']);
    if (!(f.phone || '').trim()) miss.push(['phone', 'Type a phone number']);
    else if (bkTidyPhone(f.phone).replace('+', '').length < 8) miss.push(['phone', 'This phone number looks too short']);
    if (!f.car) miss.push(['car', 'Choose a car']);
    if (!r.s) miss.push(['start', 'Pick the rental start']); if (!r.e) miss.push(['end', 'Pick the rental end']);
    if (!f.method) miss.push(['method', 'Pick how the customer pays']);
    if (seeAmt && amt && !r.num('rate')) miss.push(['rate', 'Type the daily rate']);
    return miss;
  }
  function showErrors(miss) {
    miss.forEach(function (m) { setErr(m[0], m[1]); });
    var first = miss[0], w = wrapOf(first[0]); if (!w) return;
    var sec = w.closest('.bkx-sec'); if (sec) sec.classList.remove('shut');
    try { w.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { w.scrollIntoView(); }
    var fo = first[0] === 'car' ? w.querySelector('.ui-cbx-btn') : w.querySelector('input:not([type="hidden"]),select');
    if (fo) setTimeout(function () { try { fo.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }, 300);
  }
  function save(sure) {
    var r = calcNow(), f = r.f;
    var miss = validate(r);
    if (miss.length) {
      var nameOrPhone = miss.filter(function (m) { return m[0] === 'name' || m[0] === 'phone'; });
      UI.toast(nameOrPhone.length ? 'Add the customer\'s full name and phone number.' : miss.length === 1 ? miss[0][1] + '.' : 'Fill in the fields marked in red.', { tone: 'warn' });
      showErrors(miss); return false;
    }
    if (!recalc()) { UI.toast(r.e <= r.s ? 'Rental end cannot be before rental start.' : 'The car is not free for these dates. Pick another car or other dates.', { tone: 'warn' }); showErrors([[r.e <= r.s ? 'end' : 'car', r.e <= r.s ? 'Rental end cannot be before rental start' : 'Not free for these dates']]); return false; }
    /* things to ask before saving: a pick-up in the past on a new booking, a status that ends a rental too early, and a
       shorter or cheaper booking that leaves the customer paid more than the new total */
    var stTo = chSt ? f.status : null, stW = x && stTo && stTo !== x.status ? bkStatusWarn(x, stTo) : {};
    if (stW.block) { UI.toast(stW.block, { tone: 'warn', ms: 6000 }); showErrors([['status', 'Not yet: the pick-up is still to come']]); return false; }
    var payNew = !x ? 0 : amt ? r.c.payable : bkCalc({ start: r.s, end: r.e, rate: x.rate, hourly: x.hourly, dep: x.dep, disc: x.disc, deliv: x.deliv, ret: x.ret, others: x.others, covDaily: r.pk ? r.pk.daily : 0 }).payable;
    var overNew = x ? bookingOverpaid(x, payNew) : 0, overGrew = overNew > bookingOverpaid(x || '') + 0.004;
    if (!sure) {
      var asks = [];
      if (isNew && r.s < NOW() - 6e4) asks.push('The pick-up (' + UI.fmt.dt(r.s) + ') is in the past. Is this a late entry for a rental that already started?');
      if (stW.ask) asks.push(stW.ask);
      if (overGrew) asks.push('The customer has paid ' + UI.fmt.money(overNew) + ' more than the new total of ' + UI.fmt.money(payNew) + '. After saving, the booking shows ' + UI.fmt.money(overNew) + ' to give back.');
      if (asks.length) return UI.confirm({ title: isNew ? 'Create this booking?' : 'Save the changes to ' + x.code + '?', text: asks.join(' '), ok: isNew ? 'Create anyway' : 'Save anyway', cancel: 'Go back' }).then(function (y) { return y ? save(true) : false; });
    }
    var car = carById(f.car), c = r.c, pk = r.pk, so = (f.startOpt || 'Not chosen').split('|'), eo = (f.endOpt || 'Not chosen').split('|');
    var sOpt = handoverOptions('start').filter(function (o) { return o.value === f.startOpt; })[0], eOpt = handoverOptions('end').filter(function (o) { return o.value === f.endOpt; })[0];
    var phone = f.phone.trim();
    /* the customer: the one picked, else the same person when the IC or phone matches */
    var icIn = !cuSeeIc() && !isNew ? (p ? p.ic : '') : (f.ic || '').trim();
    var person = p || d.people.filter(function (q) { return (icIn && String(q.ic).replace(/[\s-]/g, '') === icIn.replace(/[\s-]/g, '')) || normPhone(q.phone) === normPhone(phone); })[0];
    var pPatch = { name: f.name.trim(), phone: phone, email: f.email, address: f.address, nat: f.nat || 'Malaysian', ic: icIn || (person ? person.ic : ''), licenceNo: f.licenceNo, licenceExp: f.licenceExp ? UI.parseDate(f.licenceExp) : null, emergency: { name: f.emName, phone: f.emPhone, rel: f.emRel } };
    if (!person) person = DB.add('people', Object.assign({ id: 'cus-' + (d.people.length + 1) + '-' + Date.now().toString(36), i: d.people.length, since: NOW(), flag: '', docs: {}, blacklist: null, notes: [], icCheck: check.results ? { at: NOW(), by: DB.actor(), valid: !!check.valid, results: check.results, cardName: check.read ? check.read.name : '' } : null }, pPatch), { where: 'Customer', text: DB.actor() + ' added customer ' + pPatch.name });
    else DB.update('people', person, pPatch, { silent: true });
    if (isNew) { CU_DOCS.forEach(function (dc) { if (!docs[dc[0]] && person.docs && person.docs[dc[0]]) docs[dc[0]] = Object.assign({}, person.docs[dc[0]]); else if (docs[dc[0]] && person.docs && !person.docs[dc[0]]) person.docs[dc[0]] = docs[dc[0]]; }); }
    Object.keys(docs).forEach(function (k) { if (docs[k]) delete docs[k].fromCust; });
    var rec = { car: car, start: r.s, end: r.e, days: c.days, rate: r.num('rate'), hourly: r.num('hourly'), dep: r.num('dep'), disc: r.num('disc'), deliv: r.num('deliv'), ret: r.num('ret'), others: r.num('others'), rent: c.rent, dmg: c.cover, payable: c.payable,
      pkg: pk ? pk.id : null, cov: f.pkg === 'manual' ? { name: f.covName || 'Cover', daily: +f.covDaily || 0, max: +f.covMax || 0 } : null,
      startOpt: so[0], pickup: so[1] || (x ? x.pickup : (B().locations[0] || {}).n), startPlace: sOpt && sOpt.place ? sOpt.place : null, endOpt: eo[0], drop: eo[1] || (x ? x.drop : (B().locations[0] || {}).n), endPlace: eOpt && eOpt.place ? eOpt.place : null, delNote: f.delNote, retNote: f.retNote,
      method: f.method, signature: f.signature || null, filledByAdmin: !!f.filledByAdmin, submitted: !!f.submitted, cust: person, docs: docs, updated: NOW() };
    if (!amt) { if (x) ['rate', 'hourly', 'dep', 'disc', 'deliv', 'ret', 'others'].forEach(function (k) { rec[k] = x[k]; }); var c2 = bkCalc({ start: r.s, end: r.e, rate: rec.rate, hourly: rec.hourly, dep: rec.dep, disc: rec.disc, deliv: rec.deliv, ret: rec.ret, others: rec.others, covDaily: pk ? pk.daily : 0 }); rec.rent = c2.rent; rec.payable = c2.payable; rec.dmg = c2.cover; rec.days = c2.days; }
    rec.status = chSt ? f.status : (x ? x.status : 'Pending'); rec.pay = chSt ? f.pay : (x ? x.pay : '');
    if (chSt && rec.pay === 'Deposit Refunded' && !(x && x.pay === 'Deposit Refunded') && !canPickRefunded({ end: r.e, pay: x ? x.pay : '' })) rec.pay = x ? x.pay : '';
    var rules = applyStatusRules(x, rec), notes = rules.notes || []; rec.status = rules.status; rec.pay = rules.pay;
    /* paid more than the new total: the whole booking is paid, and the extra waits to go back (To give back) */
    if (overGrew) { if (['', 'Deposit due', 'Deposit Received'].indexOf(rec.pay || '') >= 0) { rec.pay = 'Full Payment Received'; notes.push('Payment status set to Full Payment Received.'); } notes.push(UI.fmt.money(overNew) + ' to give back to the customer.'); }
    if (rec.submitted && !(x && x.submittedAt)) rec.submittedAt = NOW();
    saved = true;
    var tail2 = notes.length ? ' ' + notes.join(' ') : '';
    if (x) { DB.update('bookings', x, rec, { text: DB.actor() + ' changed booking ' + x.code }); UI.toast('Booking ' + x.code + ' updated.' + tail2, { ms: notes.length ? 6000 : 3500 }); return true; }
    var n = Math.max.apply(0, d.bookings.map(function (z) { return z.n; }).concat([B().startNo || 0])) + 1, code2 = B().code + '-' + String(n).padStart(5, '0'), hx = function () { return Math.random().toString(16).slice(2, 10); };
    var nb = Object.assign({ n: n, code: code2, id: code2, received: 0, agent: '', created: NOW(), inspected: false, formId: B().id.slice(0, 3) + '-' + hx(), agentToken: 'agt-' + hx(), submittedAt: rec.submitted ? NOW() : null, ip: '', agentIds: [] }, rec);
    if (nb.submitted) nb.custSig = { typed: person.name };
    if (leadId) nb.lead = leadId;
    DB.add('bookings', nb, { text: DB.actor() + ' created booking ' + code2 + ' (' + car.plate + ')' });
    /* a booking made from a lead marks that lead as booked */
    var ld = leadId && D().leads ? byId(D().leads, leadId) : null;
    if (ld) DB.update('leads', ld, { status: 'closed', booking: code2, heldUntil: null, reason: 'Booked', closedAt: NOW() }, { where: 'Lead', text: DB.actor() + ' booked the lead of ' + (ld.name || ld.phone) + ' as ' + code2 });
    UI.toast('Booking ' + code2 + ' created.' + tail2 + ' Send the booking form to ' + person.name + '.', { ms: 6000, action: { label: 'Send form', run: function () { bkSendForm(nb); } } });
    return true;
  }

  /* ---- events ---- */
  dr.el.addEventListener('input', function (ev) { var t = ev.target; if (t.closest('.bkx-form') && !t.closest('#bkx-notes,#bkx-ic')) { dirty = true; var k = t.getAttribute('data-key'); if (k) clearErr(k); if (k !== 'start' && k !== 'end') recalc(); } });
  dr.el.addEventListener('click', function (ev) {
    var j = ev.target.closest('[data-bkx-jump]'); if (!j) return;
    var sec = dr.body.querySelector('#' + j.getAttribute('data-bkx-jump')); if (!sec) return;
    sec.classList.remove('shut');
    var nav = dr.body.querySelector('.bkx-jump'), top = sec.getBoundingClientRect().top - dr.body.getBoundingClientRect().top + dr.body.scrollTop - (nav ? nav.offsetHeight + 8 : 0);
    dr.body.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
  dr.el.addEventListener('paste', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-key="phone"],[data-key="emPhone"]')) return;
    var txt = (ev.clipboardData || window.clipboardData).getData('text'); if (!txt) return;
    ev.preventDefault(); t.value = bkTidyPhone(txt); t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  dr.el.addEventListener('change', function (ev) {
    var t = ev.target, k = t.getAttribute('data-key');
    if (!t.closest('.bkx-form') || t.closest('#bkx-notes,#bkx-ic')) { if (t.matches('[data-bs-slip]')) slipUp(t); return; }
    if (!t.closest('#bkx-docs')) dirty = true;
    if (k) clearErr(k);
    /* the end follows the start: same end day with the start's time (kept after the start when it would fall before it) */
    if (k === 'start' || k === 'end') {
      var s = UI.dateFieldValue(field('start')), e = UI.dateFieldValue(field('end'));
      if (k === 'start' && s && e) { var ne = new Date(e); ne.setHours(s.getHours(), s.getMinutes(), 0, 0); if (ne <= s) { var len = prevEnd - (v.lastStart || v.start); if (!(len > 0)) len = DAY; ne = new Date(s.getTime() + len); } if (+ne !== +e) UI.setDateField(field('end'), ne, true); e = ne; }
      if (k === 'end' && s && e && prevEnd && prevEnd.toDateString() !== e.toDateString()) { var ne2 = new Date(e); ne2.setHours(s.getHours(), s.getMinutes(), 0, 0); if (+ne2 !== +e) { UI.setDateField(field('end'), ne2, true); e = ne2; } }
      prevEnd = e; v.lastStart = s;
    }
    if (k === 'startOpt' || k === 'endOpt') {
      var o = handoverOptions(k === 'startOpt' ? 'start' : 'end').filter(function (z) { return z.value === t.value; })[0], fk = k === 'startOpt' ? 'deliv' : 'ret';
      if (o && amt && (o.kind === 'place' || o.kind === 'office')) { setVal(fk, o.fee || 0); if (o.kind === 'place') UI.toast((k === 'startOpt' ? 'Delivery' : 'Return') + ' charge set to ' + UI.fmt.money(o.fee) + ' for ' + o.label.replace(/ \(RM.*$/, '') + '.', { ms: 2500 }); }
    }
    if (t.matches('[data-bkx-chk]') && t.files[0]) { bkCheckFile(t.getAttribute('data-bkx-chk'), t.files[0]); t.value = ''; }
    if (t.matches('[data-bs-slip]')) slipUp(t);
    recalc();
    if (k === 'status' || k === 'submitted' || k === 'pay' || k === 'dep') liveRules(k);
  });
  function slipUp(t) {
    if (!t.files[0]) return;
    UI.readImage(t.files[0]).then(function (r2) { DB.update('bookings', x, { refundSlip: { name: r2.name, size: r2.size, dataUrl: r2.dataUrl } }, { text: DB.actor() + ' added the deposit refund slip of ' + x.code }); var sl = dr.body.querySelector('#bkx-slip'); if (sl) sl.innerHTML = '<div class="cu-doc-h">Deposit refund slip</div><div class="cu-doc-f"><button type="button" class="cu-link ellip" data-bs="slipopen">' + esc(r2.name) + '</button></div>'; UI.toast('Refund slip saved. Record the refund on Deposit refunds.', { action: { label: 'Open', run: function () { API.openDeposit(x.code); } } }); });
  }
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b2;
    if ((b2 = t.closest('[data-bkx-tog]'))) { b2.parentNode.classList.toggle('shut'); return; }
    if ((b2 = t.closest('[data-bkx-sum]'))) { API.openSummons(b2.getAttribute('data-bkx-sum')); return; }
    if ((b2 = t.closest('[data-bkx-len]'))) {
      var s = UI.dateFieldValue(field('start')), e = UI.dateFieldValue(field('end')), L = b2.getAttribute('data-bkx-len'); if (!s) { UI.toast('Pick the rental start first.', { tone: 'warn' }); return; }
      var ne = L === 'h12' ? new Date((e && e > s ? e : s).getTime() + DAY / 2) : new Date(s.getTime() + (+L) * DAY);
      UI.setDateField(field('end'), ne, true); prevEnd = ne; dirty = true; clearErr('end'); recalc(); return;
    }
    if ((b2 = t.closest('[data-bkx-fill]'))) { applyPatch(icPatch()); return; }
    if ((b2 = t.closest('[data-bkx-unfile]'))) { var sl = b2.getAttribute('data-bkx-unfile'); docs[sl] = null; check.files = check.files.filter(function (z) { return z[2] !== sl; }); mountDocs(); drawCheck(); return; }
    if (!(b2 = t.closest('[data-bs]'))) return;
    var a = b2.getAttribute('data-bs'), val = b2.getAttribute('data-v');
    ({
      st: function () { bkStatusDialog(x, 'st'); }, pay: function () { bkStatusDialog(x, 'pay'); },
      send: function () { bkSendForm(x); }, copy: function () { bkLinkCopy(x, ''); }, bf: function () { dr.close(true).then(function () { A.sec('bf'); }); },
      pdf: function () { bkAgreement(x); }, pdflink: function () { bkLinkCopy(x, 'pdf'); },
      doc: function () { bkDocPreview(val); }, docpdf: function () { bkDocPdf(val); }, docsend: function () { bkDocSend(val); }, inv: function () { bkCreateInvoice(x.code); },
      recpay: function () { API.recordPayment(x.code); }, slip: function () { API.uploadSlips(x.code); }, allbill: function () { go('invoices', { tab: 'payments', q: x.code }); },
      ins: function () { bkInspection(x.code); }, agentlink: function () { bkLinkCopy(x, 'agent'); }, custlink: function () { bkLinkCopy(x, 'customer'); },
      dep: function () { API.openDeposit(x.code); }, task: function () { API.newTask({ booking: x.code }); },
      fee: function () { var fk = feeKindFor(x, x.end < NOW() ? 'end' : 'start'); API.addExpense({ booking: x.code, cat: fk ? fk.id : '', car: x.car.id }); },
      del: function () { bkDelete([x.code]); }, slipopen: function () { cuShowFile(x.refundSlip, 'Deposit refund slip'); }
    }[a] || function () {})();
  });

  /* ---- CHECK THE CUSTOMER FIRST: read the IC (made-up reading), check it at the sites, fill the form when nothing is
     flagged; a passport or licence fills its own fields; pictures are kept only when no site flagged the person ---- */
  function icPatch() { return check.read ? { name: check.read.name, ic: check.read.ic, nat: check.read.passport ? null : 'Malaysian' } : {}; }
  function applyPatch(pt) {
    var words = [];
    if (pt.name) { setVal('name', pt.name); words.push('name'); clearErr('name'); }
    if (pt.ic) { setVal('ic', pt.ic); words.push('IC / passport number'); }
    if (pt.nat) { setVal('nat', pt.nat); words.push('nationality'); }
    if (pt.licenceNo) { setVal('licenceNo', pt.licenceNo); words.push('licence number'); }
    if (pt.licenceExp) { UI.setDateField(field('licenceExp'), pt.licenceExp, true); words.push('licence expiry'); }
    check.filled = words.join(', '); dirty = true; recalc(); drawCheck();
  }
  function bkCheckFile(kind, file) {
    var slot = { ic: 'icFront', icBack: 'icBack', passport: docs.icFront && !check.files.some(function (z) { return z[0] === 'ic'; }) ? 'icFront' : 'icFront', dl: 'dl', poa: 'poa', other: 'other' }[kind];
    if (kind === 'passport' && check.files.some(function (z) { return z[0] === 'ic'; })) slot = 'other';
    var out = dr.body.querySelector('#bkx-chk-out');
    if (/^(ic|passport|dl)$/.test(kind)) out.innerHTML = '<div class="bkx-chk-res bkx-busy">' + i('loader-2', 'spin') + (kind === 'ic' ? 'Reading the IC and asking the check sites...' : 'Reading the picture...') + '</div>';
    UI.readImage(file, { max: 1400 }).then(function (r) {
      check.error = ''; check.notes = [];
      var keep = function () { docs[slot] = { name: r.name, size: r.size, dataUrl: r.dataUrl, added: NOW() }; check.files = check.files.filter(function (z) { return z[2] !== slot; }); check.files.push([kind, r.name, slot]); dirty = true; mountDocs(); };
      if (!/^(ic|passport|dl)$/.test(kind)) { keep(); drawCheck(); return; }
      if (!/^image\//.test(file.type)) { check.error = 'The picture could not be read. Type the details.'; drawCheck(); return; }
      setTimeout(function () {
        if (dr.closed) return;
        var seed = file.size + file.name.length;
        if (kind === 'ic') {
          var rd = cuFakeRead(seed, false); check.read = rd; check.filled = ''; check.nameBefore = ((field('name') || {}).value || '').trim();
          var pr = cuIcParse(rd.ic); check.valid = !!pr.ok; check.facts = pr;
          check.results = pr.ok ? cuOnlineCheck(rd.ic, rd.name) : null;
          var flagged = check.results && check.results.some(function (z) { return z[1] === 'Flagged'; }), err = check.results && check.results.some(function (z) { return z[1] === 'Could not check'; });
          var asked = check.results ? check.results.filter(function (z) { return z[0] !== 'Our blacklist' && z[1] !== 'Could not check'; }) : [];
          check.fill = pr.ok && !flagged && !err;
          check.why = !pr.ok ? 'This is not a valid IC number. Fix it first.' : flagged ? 'A site flagged this person. Nothing was filled in.' : err ? 'A site could not be checked just now. Try again, or fill in anyway.' : !asked.length ? 'No online site is set up yet, so only the number itself was checked.' : '';
          if (!flagged) keep(); else check.notes.push('The pictures were not kept with the booking because a site flagged this person.');
          if (flagged) { ['icFront', 'dl'].forEach(function (sl) { if (check.files.some(function (z) { return z[2] === sl; })) { docs[sl] = null; check.files = check.files.filter(function (z) { return z[2] !== sl; }); } }); mountDocs(); }
          DB.log('Checked', 'Customer', '', DB.actor() + ' checked IC ' + UI.fmt.ic(rd.ic) + ' before a new booking');
          if (check.fill) { applyPatch(icPatch()); return; }
          recalc(); drawCheck(); return;
        }
        var R = rng(seed), ri = function (a2, b3) { return a2 + Math.floor(R() * (b3 - a2 + 1)); }, cur = (field('name') || {}).value || '';
        var flaggedNow = check.results && check.results.some(function (z) { return z[1] === 'Flagged'; });
        if (!flaggedNow) keep(); else check.notes.push('The picture was not kept because a site flagged this person.');
        if (kind === 'passport') { var rp = cuFakeRead(seed, true); check.read = check.read || { name: rp.name, ic: rp.ic, passport: true }; var pt = { ic: rp.ic, nat: 'Other' }; if (!cur.trim()) pt.name = rp.name; applyPatch(pt); return; }
        var exp = new Date(NOW().getFullYear() + ri(1, 4), ri(0, 11), ri(1, 28)), lno = String(ri(10000000, 99999999)) + ' ' + String.fromCharCode(65 + ri(0, 25)) + String.fromCharCode(65 + ri(0, 25));
        var pt2 = { licenceNo: lno, licenceExp: exp }; if (!cur.trim()) pt2.name = cuFakeRead(seed, false).name;
        if (exp < new Date(NOW().getFullYear(), NOW().getMonth() + 2, 1)) check.notes.push('This licence expires on ' + UI.fmt.date(exp) + ', soon after the rental. Ask for the renewed one.');
        applyPatch(pt2);
      }, 650);
    }, function (err) { check.error = err.message; drawCheck(); });
  }
  function drawCheck() {
    var out = dr.body.querySelector('#bkx-chk-out'); if (!out) return;
    var c = check, h = '', chip = function (z) { return UI.chip(z[0] + ': ' + z[1], z[1] === 'Clear' ? 'ok' : z[1] === 'Flagged' ? 'bad' : 'warn', { title: z[2] }); };
    var slotName = { icFront: 'ID Card Front', icBack: 'ID Card Back', dl: 'Driving Licence', poa: 'Proof of Address', other: 'Other Files' };
    if (c.files.length) h += '<div class="row wrap gap6">' + c.files.map(function (z) { return '<span class="chip ok bkx-fchip">' + i('paperclip') + esc(slotName[z[2]] + ': ' + z[1]) + '<button type="button" class="bkx-fx" data-bkx-unfile="' + z[2] + '" aria-label="Take off ' + esc(z[1]) + '">' + i('x') + '</button></span>'; }).join('') + '</div>';
    if (c.error) h += UI.alert(c.error, 'bad');
    if (c.read && !c.read.passport && c.facts) {
      var pr = c.facts;
      if (pr.ok) h += '<div class="bkx-facts">' + UI.chip('IC ' + UI.fmt.ic(c.read.ic) + ' looks valid', 'ok', { icon: 'circle-check' }) + '<dl><dt>Born</dt><dd>' + UI.fmt.date(pr.born) + ' (age ' + pr.age + ')</dd><dt>Place of birth</dt><dd>' + esc(pr.state) + '</dd><dt>Sex</dt><dd>' + pr.sex + '</dd></dl><span class="b2">Read from the card: ' + esc(c.read.name.toUpperCase()) + ' (sample reading, check it against the card)</span></div>';
      else h += UI.alert((pr.why || 'This is not a valid IC number.') + ' Type the number in the form below, or upload a clearer picture.', 'warn');
      if (c.results) {
        var nm = c.nameBefore, mt = nm ? cuNameMatch(c.read.name, nm) : null;
        h += '<div class="row wrap gap6">' + c.results.map(chip).join('') + (mt ? UI.chip(mt === 'match' ? 'Name matches' : mt === 'close' ? 'Name is close' : 'Name differs', mt === 'match' ? 'ok' : mt === 'close' ? 'warn' : 'bad') : '') + '</div>';
        h += c.results.filter(function (z) { return z[1] === 'Could not check'; }).map(function (z) { return '<span class="ui-err">' + esc(z[0] + ': ' + z[2]) + '</span>'; }).join('');
        if (c.results.some(function (z) { return z[1] === 'Flagged'; })) h += UI.alert('A site has flagged this person. This is a warning for you to weigh up. It does not stop the booking.', 'warn');
      }
      if (c.why) h += UI.alert(c.why, c.fill ? 'pri' : 'warn');
      if (!c.fill && c.read.ic && c.valid !== null && !c.filled) h += '<div>' + UI.btn('Fill in the name and IC anyway', { kind: 'c', size: 'sm', cls: 'bkx-warnbtn', attrs: { 'data-bkx-fill': 1 } }) + '</div>';
    }
    if (c.filled) h += UI.alert('Filled in: ' + c.filled + '. Check them in the form below.', 'ok');
    (c.notes || []).forEach(function (nt) { h += UI.alert(nt, 'warn'); });
    out.innerHTML = h ? '<div class="bkx-chk-res">' + h + '</div>' : '';
  }
  return dr;
}

/* ---------------- send the booking form (WhatsApp message, made-up send) ---------------- */
function bkSendForm(x) {
  var first = x.cust.name.split(' ')[0], link = siteLink(x, '');
  var msg = 'Hi ' + first + ', thank you for booking with ' + B().name + '. Please fill in and sign your booking form for ' + x.code + ' (' + x.car.plate + ', ' + bkWhen(x.start) + ' to ' + bkWhen(x.end) + '): ' + link;
  UI.dialog({ title: 'Send the booking form', text: 'To ' + x.cust.name + ', ' + x.cust.phone, width: 'sm',
    body: UI.textarea({ key: 'msg', label: 'Message', value: msg, rows: 5 }) + '<p class="b2">The link opens the booking form where ' + esc(first) + ' checks the details and signs.</p>',
    buttons: [{ label: 'Copy message', kind: 'o', onClick: function (dl) { UI.copy(UI.form(dl.body).msg, { label: 'Message copied' }); return false; } },
      { label: 'Send on WhatsApp', icon: 'brand-whatsapp', onClick: function (dl) {
        var text = UI.form(dl.body).msg;
        DB.log('Sent', 'Booking', x.code, DB.actor() + ' sent the booking form of ' + x.code + ' to ' + x.cust.name + ' on WhatsApp');
        if (x.status === 'Pending' || x.status === 'Confirmed') DB.update('bookings', x, { status: 'Agreement Sent' }, { text: DB.actor() + ' sent the booking form of ' + x.code + ', so it is now Agreement Sent' });
        UI.toast('Booking form sent to ' + first + ' on WhatsApp (' + x.cust.phone + ').', { action: { label: 'Copy link', run: function () { bkLinkCopy(x, ''); } } });
        void text;
      } }] });
}
/* the money box: total, received, still due, with a bar */
function bkMoneyBox(m) {
  return '<div class="bkx-mon t-' + m.tone + '"><div><span>Total</span><b>' + UI.money(m.total) + '</b></div><div><span>Received</span><b>' + UI.money(m.rec) + '</b></div><div><span>' + (m.due > 0 ? 'Still due' : m.over > 0 ? 'To give back' : m.due < 0 ? 'Extra charges paid' : 'Paid') + '</span><b>' + (m.due === 0 ? 'Paid in full' : UI.money(m.due > 0 ? m.due : m.over > 0 ? m.over : -m.due)) + '</b></div><i style="--w:' + m.pct + '%"></i></div>';
}
/* ---------------- the read-only summary a phone card opens ---------------- */
function bkSummary(x) {
  var seeAmt = can('bookings.see_amounts') || can('bookings.edit_amounts'), chSt = can('bookings.change_status'), m = bkMoney(x), c = bkCalc({ start: x.start, end: x.end });
  var row = function (icon, main, sub) { return '<div class="bkx-smr">' + i(icon) + '<div class="grow"><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></div>'; };
  var dur = (c.fullDays ? plural(c.fullDays, 'day') : '') + (c.remHours ? (c.fullDays ? ', ' : '') + plural(Math.round(c.remHours * 10) / 10, 'hour') : '');
  var dl = UI.dialog({ title: x.code, text: plural(x.days, 'day') + ' · created ' + UI.fmt.date(x.created), width: 'sm',
    body: '<div class="bkx-sm">' + '<div class="bkx-sts">' + (chSt ? '<button type="button" class="bkx-stb" data-sm="st">' + UI.status('booking', x.status) + i('chevron-down') + '</button><button type="button" class="bkx-stb" data-sm="pay">' + UI.status('payment', x.pay || 'None') + i('chevron-down') + '</button>' : UI.status('booking', x.status) + UI.status('payment', x.pay || 'None')) + '</div>' +
      row('user', esc(x.cust.name), UI.phone(x.cust.phone, { wa: true })) +
      row('car', esc(x.car.plate) + ' · ' + esc(carName(x.car)), esc(x.car.color)) +
      row('calendar', UI.fmt.dt(x.start) + ' to ' + UI.fmt.dt(x.end), esc(dur)) +
      row('map-pin', esc((x.startOpt || 'Not chosen').replace('Pick-up from our location', 'Pick-up at ' + (x.pickup || 'our location'))), esc((x.endOpt || 'Not chosen').replace('Drop-off at our location', 'Drop-off at ' + (x.drop || 'our location')))) +
      (seeAmt && x.status !== 'Cancelled' ? bkMoneyBox(m) : '') + '</div>',
    buttons: [{ label: 'Close', kind: 'g' }, { label: can('bookings.edit') ? 'Edit' : 'Open', icon: can('bookings.edit') ? 'pencil' : 'eye', onClick: function () { setTimeout(function () { bkOpenBooking(x.code); }, 0); } }] });
  UI.on(dl.el, 'click', '[data-sm]', function (ev, el) { var k = el.getAttribute('data-sm'); dl.close(true); bkStatusDialog(x, k); });
  return dl;
}

/* ---------------- the Bookings page ---------------- */
PAGES['bookings'] = {
  title: 'Bookings',
  render: function (root, ctx) {
    var d = ctx.data, st = ctx.state, can2 = ctx.can;
    st.f = st.f || {}; st.sel = st.sel || {};
    var seeAmt = can2('bookings.see_amounts') || can2('bookings.edit_amounts');
    var now = NOW(), soon = new Date(now.getTime() + 3 * DAY);
    var quick = {
      out: function (x) { return x.status === 'Car Delivered'; },
      soon: function (x) { return x.status !== 'Cancelled' && x.start >= now && x.start <= soon; },
      back: function (x) { return x.status === 'Car Delivered' && x.end >= now && x.end <= soon; },
      late: function (x) { return x.status === 'Car Delivered' && x.end < now; },
      due: function (x) { return x.status !== 'Cancelled' && x.status !== 'Pending' && bkMoney(x).due > 0; },
      over: function (x) { return bookingOverpaid(x) > 0; }
    };
    /* search: a booking code in any form gives that booking exactly; a pasted phone matches any format; plates ignore spaces */
    function matcher(raw) {
      var q = tidySearch(raw); if (!q) return function () { return true; };
      var codeLike = /^[a-z]{0,5}[\s\-#]*\d{1,5}$/i.test(q) && d.bookings.some(function (z) { return matchBookingCode(q, z.code); });
      if (codeLike) return function (x) { return matchBookingCode(q, x.code); };
      var np = normPlate(q);
      return function (x) {
        if (/^\d{3,}$/.test(q) && phoneHas(x.cust.phone, q)) return true;
        if (np.length >= 3 && normPlate(x.car.plate).indexOf(np) >= 0) return true;
        return UI.wordsMatch(x.code + ' ' + x.cust.name + ' ' + (x.cust.email || '') + ' ' + x.car.plate + ' ' + (x.car.make || '') + ' ' + (x.car.model || '') + ' ' + (x.car.color || ''), q);
      };
    }
    function rowsFor() {
      var f = st.f, from = f.from ? UI.parseDate(f.from) : null, to = f.to ? UI.parseDate(f.to) : null, matches = matcher(f.q);
      return d.bookings.filter(function (x) {
        if (f.status && x.status !== f.status) return false;
        if (f.pay && (x.pay || 'None') !== f.pay) return false;
        if (f.car && x.car.id !== f.car) return false;
        if (f.quick && f.quick !== 'all' && quick[f.quick] && !quick[f.quick](x)) return false;
        if ((from || to) && !overlaps(x, from, to)) return false;
        return matches(x);
      }).sort(function (a, b) { return b.n - a.n; });
    }
    var rows = rowsFor();
    var countTxt = function (r) { return plural(r.length, 'booking') + (r.length !== d.bookings.length ? ' of ' + d.bookings.length : ''); };
    root.innerHTML = '<div class="pg-h bkx-pgh"><div><h1>Bookings</h1><p id="bkx-count">' + countTxt(rows) + '</p></div><div class="acts" id="bkx-acts"></div></div>' +
      '<div class="card bkx-list"><div id="bkx-f"></div><div id="bkx-t"></div></div>';

    var acts = root.querySelector('#bkx-acts');
    function exportOff() { return st.f.status === 'Pending' || st.f.status === 'Cancelled'; }
    function drawActs() {
      var nf = exportOff();
      acts.innerHTML = (can2('bookings.create') ? UI.btn('New Booking', { icon: 'plus', attrs: { 'data-act': 'new' } }) : '') +
        (can2('reports.export_excel') ? '<span class="bkx-wide">' + UI.btn('Export to Excel', { kind: 'o', icon: 'file-spreadsheet', disabled: nf, title: nf ? 'Pending and cancelled bookings are not income, so they are not in the Excel file. Pick another status.' : 'Download the bookings as an Excel file', attrs: { 'data-act': 'export' } }) + '</span>' +
          '<span class="bkx-narrow">' + UI.iconBtn('dots-vertical', 'More', { attrs: { 'data-act': 'more' } }) + '</span>' : '');
    }

    var stChip = function (x, kind) {
      var html = kind === 'pay' ? UI.status('payment', x.pay || 'None', null, { sm: true }) : UI.status('booking', x.status, null, { sm: true });
      return can2('bookings.change_status') ? '<button type="button" class="bkx-stb" data-bk="' + kind + '" title="Change the ' + (kind === 'pay' ? 'payment' : 'booking') + ' status">' + html + '</button>' : html;
    };
    var amount = function (x) {
      if (x.status === 'Cancelled') return '<span class="faint">Cancelled</span>';
      var m = bkMoney(x), tip = 'Total ' + UI.fmt.money(m.total) + ' · Received ' + UI.fmt.money(m.rec) + ' · ' + (m.due > 0 ? 'Still due ' + UI.fmt.money(m.due) : m.over > 0 ? 'Paid ' + UI.fmt.money(m.over) + ' more than the total: give it back' : m.due < 0 ? 'Paid in full, plus ' + UI.fmt.money(-m.due) + ' of extra charges' : 'Paid in full');
      return '<div class="bkx-amt t-' + m.tone + '" title="' + tip + '"><b class="num">' + UI.fmt.money(m.total) + '</b><span class="bkx-bar"><i style="width:' + m.pct + '%"></i></span><small class="num">' + bkDueText(m) + '</small></div>';
    };
    var docsCell = function (x) {
      var inv = bkInvoice(x.code), nr = bkReceipts(x.code).length;
      return UI.iconBtn('copy', 'Copy Link (booking form)', { size: 'sm', attrs: { 'data-bk': 'copy' } }) +
        (can2('bookings.view_documents') ? UI.iconBtn('file-type-pdf', x.submitted ? 'View PDF (signed agreement)' : 'Agreement not signed yet', { size: 'sm', cls: x.submitted ? '' : 'bkx-dim', attrs: { 'data-bk': 'pdf' } }) : '') +
        UI.iconBtn('file-invoice', 'Invoice and receipts' + (inv ? ': ' + inv.no : ': no invoice yet') + (nr ? ', ' + plural(nr, 'receipt') : ''), { size: 'sm', cls: inv ? 'bkx-has' : '', attrs: { 'data-bk': 'bill' } });
    };
    var insCell = function (x) { var ok = d.inspections.some(function (z) { return z.booking === x.code; }); return '<button type="button" class="bkx-ins' + (ok ? ' done' : '') + '" data-bk="ins" title="Inspection: view the data, copy the agent or customer link">' + i(ok ? 'circle-check' : 'circle-dashed') + (ok ? 'Done' : 'Links') + i('chevron-down', 'bkx-caret') + '</button>'; };
    var cols = [
      { key: 'n', label: 'Booking ID', sort: true, nowrap: true, render: function (x) { return '<b class="bkx-id">' + x.code + '</b><small class="bkx-sub">' + plural(x.days, 'day') + '</small>'; } },
      { key: 'cust', label: 'Customer', sort: function (x) { return x.cust.name; }, render: function (x) { var fl = (x.cust.blacklist ? 'bad' : cuFlags(x.cust).careful ? 'warn' : cuFlags(x.cust).vip ? 'info' : ''); return '<div class="bkx-cu"><b class="ellip" title="' + esc(x.cust.name) + '">' + (fl && can2('customer_notes.view') ? '<span class="bkx-fl ' + fl + '" title="' + (fl === 'bad' ? 'Blacklisted' : fl === 'warn' ? 'Be careful' : 'VIP') + '"></span>' : '') + esc(x.cust.name) + '</b>' + UI.phone(x.cust.phone) + '</div>'; } },
      { key: 'car', label: 'Car & period', sort: function (x) { return x.start; }, render: function (x) { return '<div class="bkx-car"><div><b>' + esc(x.car.plate) + '</b> <span>' + esc(x.car.model.split(' ')[0]) + ' · ' + esc(x.car.color) + '</span></div><div class="bkx-per" title="Pick-up ' + UI.fmt.dateTime(x.start) + ', return ' + UI.fmt.dateTime(x.end) + '">' + bkWhen(x.start) + i('arrow-right') + bkWhen(x.end) + '</div></div>'; } },
      { key: 'status', label: 'Status', sort: function (x) { return LISTS.bookingStatus.indexOf(x.status); }, render: function (x) { return '<div class="bkx-sts2">' + stChip(x, 'st') + stChip(x, 'pay') + '</div>'; } },
      { key: 'payable', label: 'Amount', money: true, sort: true, hidden: !seeAmt, render: amount },
      { key: 'agent', label: 'Handover', sort: function (x) { return bkAgents(x).join(', '); }, render: function (x) { var a = bkAgents(x); return '<div class="bkx-ho">' + (can2('inspections.view') ? insCell(x) : '') + (a.length ? '<span class="bkx-ag ellip" title="Agent: ' + esc(a.join(', ')) + '">' + i('user') + esc(a.map(function (n) { return n.split(' ')[0]; }).join(', ')) + '</span>' : '<span class="bkx-ag faint">' + i('user') + 'No agent yet</span>') + '</div>'; } },
      { key: 'docs', label: 'Documents', render: function (x) { return '<div class="bkx-ics">' + docsCell(x) + (can2('tasks.create') ? UI.iconBtn('calendar-plus', 'Assign Task', { size: 'sm', attrs: { 'data-bk': 'task' } }) : '') + '</div>'; } }
    ];
    var t = UI.table(root.querySelector('#bkx-t'), {
      columns: cols, rows: rows, rowKey: 'code', minWidth: 1080, selectable: can2('bookings.edit') || can2('bookings.delete') || can2('bookings.view'), selected: st.sel, noun: 'booking', selLabel: 'selected',
      sort: st.sort, onSort: function (s) { st.sort = s; }, page: st.page, onPage: function (pg) { st.page = pg; }, pageSize: st.size || 10, pageSizes: [10, 25, 50, 100], maxHeight: 'min(74vh,900px)',
      rowClass: function (x) { return 'bkx-r' + (x.status === 'Cancelled' ? ' bkx-cx' : ''); },
      /* Edit and Delete only show here, once rows are ticked */
      bulk: function (keys) {
        var one = keys.length === 1, ed = can2('bookings.edit');
        return '<span class="bkx-tip" title="' + (one ? '' : 'Tick only one booking to ' + (ed ? 'edit' : 'view') + ' it.') + '">' + UI.btn(ed ? 'Edit' : 'View', { kind: 'o', size: 'sm', icon: ed ? 'pencil' : 'eye', disabled: !one, attrs: { 'data-act': 'edit' } }) + '</span>' +
          (can2('bookings.delete') ? UI.btn(keys.length > 1 ? 'Delete ' + keys.length : 'Delete', { kind: 'err', size: 'sm', icon: 'trash', attrs: { 'data-act': 'delete' } }) : '');
      },
      onRowClick: function (x) { if (bkIsPhone()) bkSummary(x); else bkOpenBooking(x.code); },
      empty: { icon: 'calendar-off', title: 'No bookings match', text: 'Clear the search or the filters.' },
      card: function (x) {
        var m = bkMoney(x);
        return '<div class="bkx-cd"><div class="bkx-cd-h"><b class="bkx-id">' + x.code + '</b><span class="bkx-sts2 row">' + stChip(x, 'st') + stChip(x, 'pay') + '</span></div>' +
          '<div class="bkx-cd-r"><span class="ellip t1c fw5">' + esc(x.cust.name) + '</span>' + UI.phone(x.cust.phone) + '</div>' +
          '<div class="bkx-cd-r"><span><b class="t1c">' + esc(x.car.plate) + '</b> ' + esc(x.car.model.split(' ')[0]) + '</span><span class="bkx-per">' + bkWhen(x.start) + i('arrow-right') + bkWhen(x.end) + '</span></div>' +
          (seeAmt && x.status !== 'Cancelled' ? '<div class="bkx-cd-m t-' + m.tone + '"><span class="num"><b>' + UI.fmt.money(m.total) + '</b></span><span class="bkx-bar"><i style="width:' + m.pct + '%"></i></span><small class="num">' + bkDueText(m) + '</small></div>' : '') +
          '<div class="bkx-cd-f">' + bkCardActs(x, m, can2) +
          '<span class="grow"></span>' + UI.iconBtn('dots-vertical', 'More for ' + x.code, { attrs: { 'data-bk': 'more' } }) + '</div></div>';
      }
    });
    var count = function (fn) { return d.bookings.filter(fn).length; };
    UI.filters(root.querySelector('#bkx-f'), {
      values: st.f,
      fields: [
        { type: 'search', key: 'q', placeholder: 'Booking no., name, phone, plate or car' },
        { type: 'select', key: 'status', label: 'Status', options: LISTS.bookingStatus, all: 'All Statuses' },
        { type: 'select', key: 'pay', label: 'Payment Status', options: [['None', 'None']].concat(LISTS.paymentStatus.map(function (s) { return [s, s]; })), all: 'All Payment Statuses' },
        Object.assign(UI.carFilter({ key: 'car', all: 'All Cars' }), { width: 220 }),
        { type: 'daterange', from: 'from', to: 'to', label: 'Rental dates' },
        { type: 'chips', key: 'quick', label: 'Quick', options: [['all', 'All', d.bookings.length], ['out', 'Out now', count(quick.out)], ['soon', 'Going out in 3 days', count(quick.soon)], ['back', 'Back in 3 days', count(quick.back)], ['late', 'Late', count(quick.late), 'bad'], ['due', 'Money due', count(quick.due)]].concat(count(quick.over) || st.f.quick === 'over' ? [['over', 'To give back', count(quick.over), 'warn']] : []) }
      ],
      /* every filter change goes back to page 1 */
      onChange: function (v2, k) { var r = rowsFor(); st.page = 1; t.setRows(r); root.querySelector('#bkx-count').textContent = countTxt(r); if (k === 'status' || k === '*') drawActs(); }
    });
    drawActs();

    function moreMenu(el, x) {
      UI.menu(el, [
        { label: can2('bookings.edit') ? 'Edit booking' : 'Open booking', icon: can2('bookings.edit') ? 'pencil' : 'eye', onClick: function () { bkOpenBooking(x.code); } },
        { label: 'Copy booking form link', icon: 'copy', onClick: function () { bkLinkCopy(x, ''); } },
        can2('bookings.view_documents') ? { label: x.submitted ? 'Agreement PDF' : 'Agreement PDF (not signed yet)', icon: 'file-type-pdf', onClick: function () { bkAgreement(x); } } : null,
        { label: 'Invoice and receipts', icon: 'file-invoice', onClick: function () { bkBillingMenu(el, x); } },
        can2('inspections.view') ? { label: 'Inspection', icon: 'clipboard-check', onClick: function () { bkInspMenu(el, x); } } : null,
        can2('tasks.create') ? { label: 'Assign task', icon: 'calendar-plus', onClick: function () { API.newTask({ booking: x.code }); } } : null,
        can2('bookings.delete') ? { divider: true } : null,
        can2('bookings.delete') ? { label: 'Delete', icon: 'trash', danger: true, onClick: function () { bkDelete([x.code]); } } : null
      ].filter(Boolean), { width: 260 });
    }
    UI.on(root, 'click', '[data-bk]', function (ev, el) {
      var host = el.closest('[data-k]'); if (!host) return;
      var x = findBooking(host.getAttribute('data-k')); if (!x) return;
      var a = el.getAttribute('data-bk');
      if (a === 'st' || a === 'pay') bkStatusDialog(x, a);
      else if (a === 'copy') bkLinkCopy(x, '');
      else if (a === 'pdf') bkAgreement(x);
      else if (a === 'bill') bkBillingMenu(el, x);
      else if (a === 'ins') bkInspMenu(el, x);
      else if (a === 'task') API.newTask({ booking: x.code });
      else if (a === 'send') bkSendForm(x);
      else if (a === 'recpay') API.recordPayment(x.code);
      else if (a === 'open') bkOpenBooking(x.code);
      else if (a === 'more') moreMenu(el, x);
    });
    function doExport(el) { if (exportOff()) { UI.toast('Pending and cancelled bookings are not income, so they are not in the Excel file. Pick another status.', { tone: 'warn' }); return; } if (st.f.from) { var fr = UI.parseDate(st.f.from), to = st.f.to ? UI.parseDate(st.f.to) : fr; if ((to - fr) / DAY > 366) UI.toast('Choose a period of at most 366 days.', { tone: 'warn' }); else bkExport(fr, to, st.f); } else bkExportPop(el, st.f); }
    UI.on(root, 'click', '[data-act]', function (ev, el) {
      var a = el.getAttribute('data-act'), sel = t.selected();
      if (a === 'new') bkOpenBooking(null, {});
      else if (a === 'edit' && sel.length === 1) bkOpenBooking(sel[0]);
      else if (a === 'delete' && sel.length) bkDelete(sel, function (gone) { gone.forEach(function (c) { delete st.sel[c]; }); t.refresh(); });
      else if (a === 'export') doExport(el);
      else if (a === 'more') UI.menu(el, [{ label: 'Export to Excel', icon: 'file-spreadsheet', disabled: exportOff(), hint: exportOff() ? 'Not for Pending or Cancelled' : '', onClick: function () { doExport(el); } }], { width: 240 });
    });
    var pr = ctx.params;
    if (pr.action === 'add') setTimeout(function () { bkOpenBooking(null, pr); }, 0);
    else if (pr.booking) setTimeout(function () { var dr = bkOpenBooking(pr.booking); if (dr && pr.inspection === '1') bkInspection(pr.booking); }, 0);
  },
  search: [{ label: 'Bookings out now', icon: 'road', run: function (ctx) { ctx.state.f = { quick: 'out' }; ctx.refresh(); } }, { label: 'Bookings with money due', icon: 'cash', run: function (ctx) { ctx.state.f = { quick: 'due' }; ctx.refresh(); } }, { label: 'Export bookings to Excel', icon: 'file-spreadsheet', run: function (ctx) { var b = ctx.root.querySelector('[data-act="export"]'); if (b && !b.disabled) b.click(); } }]
};

/* ---------------- openers for every page ---------------- */
API.openBooking = function (code) { return bkOpenBooking(code); };
API.newBooking = function (prefill) { return bkOpenBooking(null, prefill || {}); };
API.openInspection = function (code) { return bkInspection(code); };
API.bookingAgreement = function (code) { var x = findBooking(code); if (x) bkAgreement(x); };
API.bookingBilling = function (anchor, code) { var x = findBooking(code); if (x) bkBillingMenu(anchor, x); };
/* older links (data-a="booking", #drawer=CODE) open the new drawer */
A.booking = function (v) { bkOpenBooking(v); };
DRAWERS['booking'] = function (dr) { var code = dr.code; S.drawer = null; setTimeout(function () { var l = D().bookings; bkOpenBooking(code === 'first' ? l[l.length - 1].code : code); }, 0); return ''; };

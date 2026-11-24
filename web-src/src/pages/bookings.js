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
function bkRecv(x) { var r = DB.received(x.code); return r || (D().payments.some(function (p) { return p.booking === x.code; }) ? r : x.received || 0); }
function bkMoney(x) {
  var rec = bkRecv(x), due = Math.round((x.payable - rec) * 100) / 100;
  var tone = x.status === 'Cancelled' ? 'grey' : !x.payable ? 'info' : due < 0 ? 'info' : due === 0 ? 'ok' : rec > 0 ? 'warn' : 'bad';
  return { total: x.payable, rec: rec, due: due, tone: tone, pct: x.payable ? Math.min(100, rec / x.payable * 100) : 100 };
}
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
/* the stated rule: under 24 h = hourly x hours; else full days x daily + remaining hours x hourly;
   payable = rent + deposit + damage cover (per started day) + delivery + return + others - discount */
function bkCalc(o) {
  var ms = o.end - o.start, hrs = Math.max(0, ms / 36e5), full = Math.floor(hrs / 24), rem = Math.ceil(hrs - full * 24 - 1e-9);
  var rent = hrs <= 0 ? 0 : hrs < 24 ? Math.ceil(hrs) * o.hourly : full * o.rate + rem * o.hourly;
  var days = Math.max(1, Math.ceil(hrs / 24 - 1e-9)), cover = (o.covDaily || 0) * days;
  var mins = Math.round((ms % DAY) / 6e4), dur = full + ' day' + (full === 1 ? '' : 's') + ', ' + Math.floor(mins / 60) % 24 + ':' + String(mins % 60).padStart(2, '0') + ':00';
  return { hrs: hrs, days: days, rent: rent, cover: cover, dur: hrs < 24 ? '0 days, ' + Math.floor(hrs) + ':' + String(Math.round((hrs % 1) * 60)).padStart(2, '0') + ':00' : dur,
    payable: rent + (o.dep || 0) + cover + (o.deliv || 0) + (o.ret || 0) + (o.others || 0) - (o.disc || 0) };
}
/* bookings of the same car that overlap; cars sold or not in use are never free */
function bkClash(carId, s, e, except) {
  var c = carById(carId); if (!c || !s || !e) return [];
  if (c.fleet && c.fleet !== 'Active') return [{ fleet: c.fleet }];
  return D().bookings.filter(function (x) { return x.car === c && x.code !== except && x.status !== 'Cancelled' && x.status !== 'Completed' && x.start < e && x.end > s; });
}
function bkLocOpts(start) {
  var locs = B().locations || [], out = [['Not chosen', 'Not chosen']];
  locs.filter(function (l) { return start ? l.p !== false : l.d !== false; }).forEach(function (l) { out.push([(start ? 'Pick-up from our location' : 'Drop-off at our location') + '|' + l.n, (start ? 'Pick-up from our location - ' : 'Drop-off at our location - ') + l.n]); });
  return out.concat(start ? [['Delivery to client location', 'Delivery to client location'], ['Delivery to KLIA', 'Delivery to KLIA']] : [['Return from client location', 'Return from client location'], ['Return from KLIA', 'Return from KLIA']]);
}
function bkCarLabel(c) { return c.serial + ' | ' + carName(c) + ' | ' + c.plate + ' | ' + c.color; }
function bkLinkCopy(x, kind) {
  var label = { '': 'Booking form link copied', pdf: 'Agreement link copied', agent: 'Agent inspection link copied', customer: 'Customer inspection link copied' }[kind || ''];
  UI.copy(siteLink(x, kind || ''), { label: label });
}

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

/* ---------------- status dialogs ---------------- */
function bkStatusDialog(x, kind) {
  if (!can('bookings.change_status')) { UI.toast('Changing a status needs the "Change status" access', { tone: 'warn' }); return; }
  var pay = kind === 'pay', opts = pay ? [['', 'None']].concat(LISTS.paymentStatus.map(function (s) { return [s, s]; })) : LISTS.bookingStatus;
  UI.dialog({ title: pay ? 'Update Payment Status' : 'Update Booking Status', text: 'Select a new status for booking ' + x.code, width: 'sm',
    body: UI.select({ key: 'st', label: 'New Status', options: opts, value: pay ? x.pay : x.status }) + '<div class="row gap8 b2">Now: ' + (pay ? UI.status('payment', x.pay || 'None', null, { sm: true }) : UI.status('booking', x.status, null, { sm: true })) + '</div>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Update', onClick: function (d) {
      var v = UI.form(d.body).st, patch = {}; if ((pay ? x.pay || '' : x.status) === v) return;
      patch[pay ? 'pay' : 'status'] = v; if (!pay && v === 'Agreement Signed' && !x.submitted) { patch.submitted = true; patch.submittedAt = NOW(); }
      DB.update('bookings', x, patch, { text: DB.actor() + ' changed the ' + (pay ? 'payment' : 'booking') + ' status of ' + x.code + ' to ' + (v || 'None') });
      UI.toast(x.code + ': ' + (v || 'None'));
    } }] });
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
      (st.k === 'custom' ? '<div class="bkx-exp-r">' + UI.input({ key: 'ex-from', type: 'date', label: 'From', value: st.from }) + UI.input({ key: 'ex-to', type: 'date', label: 'To', value: st.to }) + '</div>' : '') +
      '<div class="b2">' + (err ? '<span class="ui-err">' + err + '</span>' : UI.fmt.date(s) + ' to ' + UI.fmt.date(e) + ' · ' + plural(days, 'day')) + '</div>' +
      UI.btn('Download', { icon: 'download', disabled: !!err, attrs: { 'data-ex-go': 1 } }) + '</div>';
  }, { width: 340, align: 'end' });
  pop.el.addEventListener('click', function (ev) {
    var x = ev.target.closest('[data-ex]');
    if (x) { st.k = x.getAttribute('data-ex'); if (ranges[st.k]) { st.from = UI.isoDate(ranges[st.k][0]); st.to = UI.isoDate(ranges[st.k][1]); } pop.refresh(); return; }
    if (ev.target.closest('[data-ex-go]')) { pop.close(); bkExport(UI.parseDate(st.from), UI.parseDate(st.to), f); }
  });
  pop.el.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'ex-from') st.from = ev.target.value; if (k === 'ex-to') st.to = ev.target.value; pop.refresh(); });
}

/* ---------------- the booking drawer ---------------- */
var BK_DR = null;
function bkOpenBooking(code, prefill) {
  if (!can(code ? 'bookings.view' : 'bookings.create')) { UI.toast(code ? 'Seeing bookings needs the "See bookings" access.' : 'Adding bookings needs the "Add bookings" access.', { tone: 'warn' }); return null; }
  var d = D(), x = code ? findBooking(code) : null;
  if (code && !x) { UI.toast('Booking ' + code + ' was not found. It may have been deleted.', { tone: 'warn' }); return null; }
  var key = code || 'new';
  if (BK_DR && !BK_DR.closed && BK_DR.data.key === key) return BK_DR;
  prefill = prefill || {};
  var isNew = !x, ro = !isNew && !can('bookings.edit'), amt = can('bookings.edit_amounts'), seeAmt = amt || can('bookings.see_amounts'), chSt = can('bookings.change_status');
  var pre = !x && prefill.customer ? byId(d.people, prefill.customer) : null;
  var p = x ? x.cust : pre, carPre = prefill.car ? carById(prefill.car) || d.cars.filter(function (c) { return c.plate === prefill.car; })[0] : null;
  var s0 = prefill.start ? (prefill.start instanceof Date ? prefill.start : UI.parseDate(prefill.start)) : null; if (!s0) { s0 = new Date(NOW().getTime() + DAY); s0.setHours(10, 0, 0, 0); }
  var e0 = prefill.end ? (prefill.end instanceof Date ? prefill.end : UI.parseDate(prefill.end)) : new Date(s0.getTime() + 2 * DAY);
  var docs = x ? Object.assign({}, x.docs || {}) : { poa: null, dl: null, icFront: null, icBack: null, other: null };
  var v = x ? { car: x.car.id, start: x.start, end: x.end, rate: x.rate, hourly: x.hourly, dep: x.dep, disc: x.disc, pkg: x.pkg || (x.cov ? 'manual' : ''), covName: x.cov ? x.cov.name : '', covDaily: x.cov ? x.cov.daily : '', covMax: x.cov ? x.cov.max : '', deliv: x.deliv, ret: x.ret, others: x.others || 0,
    startOpt: x.startOpt === 'Pick-up from our location' ? x.startOpt + '|' + x.pickup : x.startOpt, endOpt: x.endOpt === 'Drop-off at our location' ? x.endOpt + '|' + x.drop : x.endOpt, delNote: x.delNote, retNote: x.retNote, method: x.method, pay: x.pay || '', status: x.status, signature: x.signature || '', filledByAdmin: x.filledByAdmin, submitted: x.submitted }
    : { car: carPre ? carPre.id : '', start: s0, end: e0, rate: carPre ? carPre.rate : 0, hourly: carPre ? carPre.hourly : 0, dep: carPre ? carPre.deposit : 0, disc: 0, pkg: '', covName: '', covDaily: '', covMax: '', deliv: 0, ret: 0, others: 0, startOpt: 'Not chosen', endOpt: 'Not chosen', delNote: '', retNote: '', method: 'Online Transfer', pay: '', status: 'Pending', signature: (d.signatures[0] || {}).id || '', filledByAdmin: true, submitted: false };
  var c0 = p || {}, em = c0.emergency || {};
  var cust = { name: c0.name || '', phone: c0.phone || '', email: c0.email || '', address: c0.address || '', nat: c0.nat || 'Malaysian', ic: c0.ic || '', licenceNo: c0.licenceNo || '', licenceExp: c0.licenceExp || null, emName: em.name || '', emPhone: em.phone || '', emRel: em.rel || '' };
  var check = { files: [], read: null, results: null }, dirty = false, saved = false, offData = null;
  var onPage = S.page === 'bookings' && CUR && CUR.ctx;

  /* ---- field builders ---- */
  var money = function (k, label, req, o) { o = o || {}; return UI.input({ key: k, label: label, type: 'number', value: v[k], required: req, readonly: !amt, step: '0.01', min: 0, placeholder: o.ph, style: o.style }); };
  var sect = function (title, icon, inner, o) { o = o || {}; return '<section class="bkx-sec' + (o.coll ? ' coll' : '') + (o.shut ? ' shut' : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><div class="bkx-sec-h"' + (o.coll ? ' role="button" tabindex="0" data-bkx-tog' : '') + '>' + i(icon) + '<span class="grow">' + title + '</span>' + (o.act || '') + (o.coll ? i('chevron-down', 'bkx-chev') : '') + '</div><div class="bkx-sec-b">' + inner + '</div></section>'; };
  var pkgOpts = [['', 'No damage cover']].concat(d.damagePackages.map(function (pk) { return [pk.id, bkPkgLabel(pk)]; })).concat([['manual', 'Set by hand']]);
  var carOpts = [['', '- No Car -']].concat(d.cars.filter(function (c) { return c.fleet !== 'Sold' || (x && x.car === c); }).map(function (c) { return [c.id, bkCarLabel(c)]; }));

  function formHtml() {
    var h = '<div class="bkx-form">';
    if (isNew && can('customers.check_ic')) h += sect('Check the customer first', 'shield-search', '<div class="bkx-chk"><div class="bkx-chk-b">' + [['ic', 'IC', 'id'], ['icBack', 'IC back', 'id'], ['passport', 'Passport', 'book-2'], ['dl', 'DL', 'license'], ['poa', 'POA', 'home'], ['other', 'Other files', 'files']].map(function (b2) { return '<label class="btn o sm">' + i(b2[2]) + b2[1] + '<input type="file" accept="image/*,.pdf" hidden data-bkx-chk="' + b2[0] + '"></label>'; }).join('') + '</div><p class="b2">The IC, passport and licence are read on our own server. Everything uploaded here is saved with the booking.</p><div id="bkx-chk-out"></div></div>');
    h += sect('Rental info', 'car', '<div class="bkx-g">' + UI.select({ key: 'car', label: 'Car', required: true, options: carOpts, value: v.car, style: 'grid-column:1 / -1' }) + UI.input({ key: 'start', label: 'Booking start date & time', type: 'datetime-local', value: v.start, required: true, style: 'grid-column:span 2' }) + UI.input({ key: 'end', label: 'Booking end date & time', type: 'datetime-local', value: v.end, required: true, style: 'grid-column:span 2' }) +
      '<div class="full" id="bkx-alerts"></div>' +
      (seeAmt ? (!amt && !ro ? '<div class="full">' + UI.alert('You can add bookings, but setting the prices needs the "Edit amounts" access. The prices come from the car.', 'pri') + '</div>' : '') +
        money('rate', 'Daily rate', true) + money('hourly', 'Hourly rate', true) + money('dep', 'Deposit', true) + money('disc', 'Discount', true) +
        UI.select({ key: 'pkg', label: 'Damage cover', options: pkgOpts, value: v.pkg, disabled: !amt, style: 'grid-column:span 2' }) +
        '<div class="bkx-man full" ' + (v.pkg === 'manual' ? '' : 'hidden') + '><div class="bkx-g3">' + UI.input({ key: 'covName', label: 'Coverage name', value: v.covName, readonly: !amt }) + UI.input({ key: 'covDaily', label: 'Coverage per day', type: 'number', value: v.covDaily, readonly: !amt, prefix: 'RM' }) + UI.input({ key: 'covMax', label: 'Max coverage', type: 'number', value: v.covMax, readonly: !amt, prefix: 'RM' }) + '</div></div>' +
        money('deliv', 'Delivery') + money('ret', 'Return') + money('others', 'Others') : '<div class="full b2">Amounts are hidden for you.</div>') + '</div>');
    h += sect('Pick-up and return', 'map-pin', '<div class="bkx-g">' + UI.select({ key: 'startOpt', label: 'Start of rental', options: bkLocOpts(true), value: v.startOpt, style: 'grid-column:span 2' }) + UI.select({ key: 'endOpt', label: 'End of rental', options: bkLocOpts(false), value: v.endOpt, style: 'grid-column:span 2' }) +
      UI.input({ key: 'delNote', label: 'Delivery / pick-up note', value: v.delNote, style: 'grid-column:span 2', placeholder: 'For example: hotel lobby, call on arrival' }) + UI.input({ key: 'retNote', label: 'Return / drop-off note', value: v.retNote, style: 'grid-column:span 2' }) + '</div>');
    if (seeAmt) h += sect('Calculated charges', 'calculator', '<div class="bkx-g">' + UI.input({ key: 'calcDur', label: 'Rental Duration', readonly: true, attrs: { 'data-nosave': 1 } }) + UI.input({ key: 'calcRent', label: 'Total Rent (RM)', readonly: true }) + UI.input({ key: 'calcCover', label: 'Damage cover (RM)', readonly: true }) + UI.input({ key: 'calcPay', label: 'Total Payable Amount (RM)', readonly: true }) + '<p class="b2 full">Under 24 hours: hourly rate x hours. Otherwise full days x daily rate + the hours left x hourly rate. Payable = rent + deposit + damage cover per started day + delivery + return + others - discount.</p></div>', { coll: true });
    if (x) { var sm = d.summons.filter(function (z) { return z.booking === x.code; }); if (sm.length && can('summons.view')) h += sect('Summons on this booking (' + sm.length + ')', 'gavel', '<div class="bkx-sum">' + sm.map(function (z) { return '<button type="button" class="bkx-sumr" data-bkx-sum="' + z.id + '"><span class="grow"><b>' + esc(z.authority) + ' ' + esc(z.notice) + '</b><small>' + esc(z.offence) + ' · ' + UI.fmt.dateTime(z.at) + '</small></span>' + UI.money(z.fine) + UI.status('summons', z.status, null, { sm: true }) + '</button>'; }).join('') + '</div>'); }
    if (p && can('customer_notes.view')) h += '<section class="bkx-sec" id="bkx-notes"></section>';
    h += sect('Payment & status', 'credit-card', '<div class="bkx-g3">' + UI.select({ key: 'method', label: 'Payment Method', required: true, options: LISTS.methods, value: v.method }) +
      UI.select({ key: 'pay', label: 'Payment Status', options: [['', 'None']].concat(LISTS.paymentStatus.map(function (s) { return [s, s]; })), value: v.pay, disabled: !chSt }) + UI.select({ key: 'status', label: 'Booking Status', options: LISTS.bookingStatus, value: v.status, disabled: !chSt }) + '</div>' + (chSt ? '' : '<p class="b2">Changing a status needs the "Change status" access.</p>'));
    h += sect('Authority & admin', 'signature', '<div class="bkx-g3"><div class="bkx-sigsel">' + UI.select({ key: 'signature', label: 'Authority Signature', options: [['', 'No signature']].concat(d.signatures.map(function (s) { return [s.id, s.name]; })), value: v.signature, disabled: !can('signatures.use_on_booking') }) + '<span class="bkx-sigimg"></span></div>' +
      UI.switch({ key: 'filledByAdmin', label: 'Filled by Admin', help: 'Staff typed the customer details', checked: v.filledByAdmin }) + UI.switch({ key: 'submitted', label: 'Is Submitted', help: 'The customer signed the booking form', checked: v.submitted }) + '</div>');
    if (x) {
      var pk = x.pkg ? byId(d.damagePackages, x.pkg) : null, ro2 = function (k, l, val) { return UI.input({ key: 'ri-' + k, label: l, value: val, readonly: true }); };
      h += sect('Record info', 'history', '<div class="bkx-g">' + ro2('c', 'Created At', UI.fmt.dateTime(x.created)) + ro2('u', 'Updated At', UI.fmt.dateTime(x.updated || x.created)) + ro2('s', 'Submitted At', x.submittedAt ? UI.fmt.dateTime(x.submittedAt) : '-') + ro2('ip', 'IP Address', x.ip || '-') +
        ro2('pk', 'Damage Package', pk ? pk.name : x.cov ? x.cov.name : '-') + ro2('pd', 'Damage Daily Rate', pk ? pk.daily.toFixed(2) : x.cov ? Number(x.cov.daily).toFixed(2) : '-') + ro2('pm', 'Max Coverage', pk ? pk.max.toFixed(2) : x.cov ? Number(x.cov.max).toFixed(2) : '-') + ro2('pt', 'Total Coverage', x.dmg ? x.dmg.toFixed(2) : '0.00') + '</div>', { coll: true, shut: true });
    }
    h += sect('Customer info', 'user', '<div class="bkx-g">' + UI.input({ key: 'name', label: 'Full Name', value: cust.name, required: true, style: 'grid-column:span 2' }) + UI.input({ key: 'phone', label: 'Phone', value: cust.phone, required: true, placeholder: '+60 12 345 6789' }) + UI.input({ key: 'email', label: 'Email', type: 'email', value: cust.email }) +
      UI.input({ key: 'address', label: 'Residential Address', value: cust.address, style: 'grid-column:span 2' }) + UI.input({ key: 'nat', label: 'Nationality', value: cust.nat, placeholder: 'Type to search', attrs: { list: 'bkx-nats' } }) +
      UI.input({ key: 'ic', label: 'IC / Passport no.', value: cuSeeIc() || isNew ? cust.ic : UI.fmt.ic(cust.ic), readonly: !cuSeeIc() && !isNew, help: !cuSeeIc() && !isNew ? 'Middle hidden for you' : '' }) + UI.input({ key: 'licenceNo', label: 'Licence no.', value: cust.licenceNo }) + UI.input({ key: 'licenceExp', label: 'Licence expiry', type: 'date', value: cust.licenceExp }) +
      '<datalist id="bkx-nats">' + LISTS.nationalities.map(function (n) { return '<option value="' + n + '">'; }).join('') + '</datalist></div>', { coll: true });
    h += sect('Emergency contact', 'phone-call', '<div class="bkx-g3">' + UI.input({ key: 'emName', label: 'Name', value: cust.emName }) + UI.input({ key: 'emPhone', label: 'Phone', value: cust.emPhone }) + UI.input({ key: 'emRel', label: 'Relationship', value: cust.emRel, attrs: { list: 'bkx-rels' }, placeholder: 'Relative, Sibling, Colleague' }) + '<datalist id="bkx-rels">' + LISTS.relationships.map(function (n) { return '<option value="' + n + '">'; }).join('') + '</datalist></div>', { coll: true });
    if (x && can('customers.check_ic')) h += sect('Check IC', 'id-badge-2', '<div id="bkx-ic"></div>');
    if (can('bookings.view_documents')) h += sect('Customer documents', 'files', '<div id="bkx-docs"></div>', { coll: true });
    return h + '</div>';
  }
  /* the side column (existing bookings): status, money, documents and links, inspection, deposit, team */
  function sideHtml() {
    var m = bkMoney(x), inv = bkInvoice(x.code), rcps = bkReceipts(x.code), ins = d.inspections.filter(function (z) { return z.booking === x.code; })[0];
    var ln = function (icon, label, sub, acts) { return '<div class="bkx-ln"><span class="bkx-ln-ic">' + i(icon) + '</span><div class="grow"><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><div class="bkx-ln-a">' + acts + '</div></div>'; };
    var ib = function (icon, label, act, val, dis) { return UI.iconBtn(icon, label, { size: 'sm', disabled: dis, attrs: { 'data-bs': act, 'data-v': val || '' } }); };
    var out = '<div class="bkx-card"><div class="bkx-card-h">Status</div><div class="bkx-sts">' + (chSt ? '<button type="button" class="bkx-stb" data-bs="st" title="Change the booking status">' + UI.status('booking', x.status) + i('chevron-down') + '</button><button type="button" class="bkx-stb" data-bs="pay" title="Change the payment status">' + UI.status('payment', x.pay || 'None') + i('chevron-down') + '</button>' : UI.status('booking', x.status) + UI.status('payment', x.pay || 'None')) + '</div>' +
      (seeAmt && x.status !== 'Cancelled' ? '<div class="bkx-mon t-' + m.tone + '"><div><span>Total</span><b>' + UI.money(m.total) + '</b></div><div><span>Received</span><b>' + UI.money(m.rec) + '</b></div><div><span>' + (m.due > 0 ? 'Still due' : m.due < 0 ? 'Extra' : 'Paid') + '</span><b>' + (m.due === 0 ? 'Paid in full' : UI.money(Math.abs(m.due))) + '</b></div><i style="--w:' + m.pct + '%"></i></div>' : '') + '</div>';
    out += '<div class="bkx-card"><div class="bkx-card-h">Documents</div>' +
      ln('link', 'Booking form link', '<span class="ellip" title="' + esc(siteLink(x, '')) + '">' + esc(siteLink(x, '').replace('https://', '')) + '</span>', ib('copy', 'Copy Link', 'copy') + ib('external-link', 'Open the booking form', 'bf')) +
      (can('bookings.view_documents') ? ln('file-certificate', 'Rental agreement', x.submitted ? 'Signed ' + UI.fmt.dateTime(x.submittedAt || x.created) : 'Not signed yet', ib('file-type-pdf', 'View PDF', 'pdf') + ib('copy', 'Copy agreement link', 'pdflink')) : '');
    if (can('billing.view') || can('billing.issue_invoice')) {
      out += inv ? ln('file-invoice', 'Invoice ' + inv.no, UI.fmt.date(inv.issued) + (inv.sent.length ? ' · sent ' + UI.fmt.ago(inv.sent[inv.sent.length - 1].at) : ' · not sent yet'), ib('eye', 'Preview ' + inv.no, 'doc', inv.no) + ib('file-type-pdf', 'Download PDF', 'docpdf', inv.no) + (can('billing.send') ? ib('send', 'Send invoice', 'docsend', inv.no) : ''))
        : ln('file-invoice', 'Invoice', 'No invoice yet', can('billing.issue_invoice') ? UI.btn('Create', { kind: 'tonal', size: 'sm', icon: 'plus', attrs: { 'data-bs': 'inv' } }) : '');
      out += rcps.length ? rcps.map(function (r) { return ln('receipt', 'Receipt ' + r.no, UI.money(r.amount) + ' · ' + esc(r.kind), ib('eye', 'Preview ' + r.no, 'doc', r.no) + ib('file-type-pdf', 'Download PDF', 'docpdf', r.no) + (can('billing.send') ? ib('send', 'Send receipt', 'docsend', r.no) : '')); }).join('') : ln('receipt', 'Receipts', 'No receipts yet', '');
      out += '<div class="bkx-card-a">' + (can('billing.record_payment') ? UI.btn('Record payment', { kind: 'o', size: 'sm', icon: 'cash', attrs: { 'data-bs': 'recpay' } }) + UI.btn('Upload slip', { kind: 'o', size: 'sm', icon: 'upload', attrs: { 'data-bs': 'slip' } }) : '') + UI.btn('All billing', { kind: 't', size: 'sm', icon: 'list-details', attrs: { 'data-bs': 'allbill' } }) + '</div>';
    }
    out += '</div>';
    if (can('inspections.view')) out += '<div class="bkx-card"><div class="bkx-card-h">Inspection</div>' + ln(ins ? 'clipboard-check' : 'clipboard-x', ins ? 'Done' : 'Not done yet', ins ? (ins.custAt ? 'Customer ' + UI.fmt.dateTime(ins.custAt) : 'Customer photos missing') + ' · ' + plural(ins.photos.length, 'photo') : 'Send the links at handover', ib('eye', 'View Inspection Data', 'ins')) +
      '<div class="bkx-card-a">' + UI.btn('Agent link', { kind: 'o', size: 'sm', icon: 'user-scan', attrs: { 'data-bs': 'agentlink' } }) + UI.btn('Customer link', { kind: 'o', size: 'sm', icon: 'link', attrs: { 'data-bs': 'custlink' } }) + '</div></div>';
    var dep = '';
    if (can('deposits.view')) dep = x.pay === 'Refund Pending' ? '<div class="bkx-dep warn">' + i('cash-banknote') + '<span class="grow">Deposit: waiting to be returned</span>' + UI.btn('Return the deposit', { kind: 'tonal', size: 'sm', attrs: { 'data-bs': 'dep' } }) + '</div>' : x.pay === 'Deposit Refunded' ? '<div class="bkx-dep ok">' + i('circle-check') + '<span class="grow">Deposit: returned to the customer</span>' + UI.btn('See details', { kind: 't', size: 'sm', attrs: { 'data-bs': 'dep' } }) + '</div>' : '';
    var ag = bkAgents(x);
    out += '<div class="bkx-card">' + dep + '<div class="bkx-card-h">Team</div>' + ln('users', ag.length ? ag.join(', ') : 'No agent yet', 'Agents on this booking\'s tasks', can('tasks.create') ? UI.btn('Assign task', { kind: 'tonal', size: 'sm', icon: 'calendar-plus', attrs: { 'data-bs': 'task' } }) : '') + '</div>';
    return out;
  }

  var dr = UI.drawer({
    title: isNew ? (pre ? 'New Booking for ' + pre.name : 'New Booking') : (ro ? 'Booking - ' : 'Edit Booking - ') + x.code,
    subtitle: isNew ? 'Fill in the car, the dates and the customer.' : x.cust.name + ' · ' + x.car.plate + ' · ' + carName(x.car), width: isNew ? 900 : 1180, data: { key: key },
    actions: x ? UI.iconBtn('copy', 'Copy the booking form link', { attrs: { 'data-bs': 'copy' } }) + (can('bookings.view_documents') ? UI.iconBtn('file-type-pdf', 'Agreement PDF', { attrs: { 'data-bs': 'pdf' } }) : '') + (can('bookings.delete') ? UI.iconBtn('trash', 'Delete this booking', { attrs: { 'data-bs': 'del' } }) : '') : '',
    body: function (el, ctl) {
      dr = ctl;
      var banner = p ? cuBanner(p) : '';
      el.innerHTML = '<div class="bkx-dl' + (x ? ' two' : '') + (banner ? ' hb' : '') + '">' + (banner ? '<div class="bkx-banner">' + banner + '</div>' : '') + (x ? '<aside class="bkx-side" id="bkx-side">' + sideHtml() + '</aside>' : '') + '<div class="bkx-main">' + formHtml() + '</div></div>';
      var n = el.querySelector('#bkx-notes'); if (n) cuNotesMount(n, p, { onChange: function () { var b2 = el.querySelector('.bkx-banner'), nb = cuBanner(p); if (b2) b2.innerHTML = nb; } });
      var ic = el.querySelector('#bkx-ic'); if (ic) cuIcMount(ic, p, { bookingName: function () { var f = el.querySelector('[data-key="name"]'); return f ? f.value : p.name; } });
      var dc = el.querySelector('#bkx-docs');
      if (dc) cuDocsMount(dc, docs, { readonly: ro, person: p, fromCustomer: isNew && pre ? pre.docs : null, onChange: function () { dirty = true; },
        extra: x && can('deposits.view') ? '<div class="cu-doc" id="bkx-slip"><div class="cu-doc-h">Deposit refund slip</div>' + (x.refundSlip ? '<div class="cu-doc-f"><button type="button" class="cu-link ellip" data-bs="slipopen">' + esc(x.refundSlip.name) + '</button></div>' : x.pay === 'Refund Pending' ? '<label class="btn o sm cu-up">' + i('upload') + 'Upload refund slip<input type="file" accept="image/*,.pdf" hidden data-bs-slip></label>' : '<div class="cu-none">The deposit is not waiting to be returned yet. It can be recorded once the booking is Refund Pending.</div>') + '</div>' : '' });
      if (ro) el.querySelectorAll('.bkx-form input, .bkx-form select, .bkx-form textarea').forEach(function (f) { if (!f.closest('#bkx-notes') && !f.closest('#bkx-ic') && !f.closest('#bkx-docs')) f.disabled = true; });
      recalc();
    },
    dirty: function () { return dirty && !saved; },
    foot: ro ? [{ label: 'Close', kind: 'o' }] : [{ label: 'Cancel', kind: 'o' }, { label: isNew ? 'Create' : 'Update', icon: 'check', onClick: function () { return save(); } }],
    onClose: function () { if (offData) offData(); if (onPage && S.page === 'bookings') CUR.ctx.setParams({ booking: '', action: '', customer: '', car: '', start: '', end: '' }); }
  });
  BK_DR = dr;
  if (onPage) CUR.ctx.setParams(isNew ? { action: 'add' } : { booking: x.code, action: '' });
  if (x) offData = on('data', function (ev) { if (dr.closed) return; if (ev && ev.coll === 'bookings' && ev.op === 'remove' && ev.rec === x) { dr.close(true); return; } var s = dr.body.querySelector('#bkx-side'); if (s) s.innerHTML = sideHtml(); });

  function form() { return UI.form(dr.body.querySelector('.bkx-form')); }
  function calcNow() {
    var f = form(), pk = f.pkg && f.pkg !== 'manual' ? byId(d.damagePackages, f.pkg) : null, s = UI.parseDate(f.start), e = UI.parseDate(f.end);
    var num = function (k) { return f[k] == null ? +v[k] || 0 : +f[k] || 0; };
    return { f: f, s: s, e: e, pk: pk, c: s && e ? bkCalc({ start: s, end: e, rate: num('rate'), hourly: num('hourly'), dep: num('dep'), disc: num('disc'), deliv: num('deliv'), ret: num('ret'), others: num('others'), covDaily: pk ? pk.daily : f.pkg === 'manual' ? +f.covDaily || 0 : 0 }) : null, num: num };
  }
  function recalc() {
    var r = calcNow(), f = r.f, body = dr.body, set = function (k, val) { var el = body.querySelector('[data-key="' + k + '"]'); if (el) el.value = val; };
    if (r.c) { set('calcDur', r.c.dur); set('calcRent', r.c.rent.toFixed(2)); set('calcCover', r.c.cover.toFixed(2)); set('calcPay', r.c.payable.toFixed(2)); }
    var man = body.querySelector('.bkx-man'); if (man) man.hidden = f.pkg !== 'manual';
    var al = [], bad = false;
    if (r.s && r.e && r.e <= r.s) { al.push(UI.alert('Rental end cannot be before rental start.', 'bad')); bad = true; }
    else if (f.car && r.s && r.e) { var cl = bkClash(f.car, r.s, r.e, x && x.code); if (cl.length) { bad = true; al.push(UI.alert('This car is not available for the selected dates. ' + (cl[0].fleet ? 'The car is marked ' + cl[0].fleet + '.' : 'It is booked on ' + cl.map(function (z) { return z.code + ' (' + bkWhen(z.start) + ' to ' + bkWhen(z.end) + ')'; }).join(', ') + '.'), 'bad')); } else if (!ro) al.push('<div class="bkx-ok">' + i('circle-check') + 'The car is free for these dates.</div>'); }
    var nm = (f.name || '').trim().toLowerCase(), icn = (f.ic || '').replace(/[\s-]/g, ''), ph = (f.phone || '').replace(/\D/g, '');
    var bl = d.people.filter(function (q) { return q.blacklist && q !== (x && x.cust) && ((nm && q.name.toLowerCase() === nm) || (icn.length > 5 && q.ic.replace(/[\s-]/g, '') === icn) || (ph.length > 6 && q.phone.replace(/\D/g, '') === ph)); })[0];
    if (bl || (p && p.blacklist && isNew)) al.push(UI.alert('Warning: This customer matches a blacklisted customer record. Please verify before proceeding.', 'bad', { icon: 'ban' }));
    var ab = body.querySelector('#bkx-alerts'); if (ab) ab.innerHTML = al.join('');
    var sg = body.querySelector('.bkx-sigimg'), sig = byId(d.signatures, f.signature); if (sg) sg.innerHTML = sig ? '<img src="' + sig.img + '" alt="' + esc(sig.name) + '">' : '';
    var btn = dr.el.querySelector('.ui-drw-f button:last-child'); if (btn && !ro) { btn.disabled = bad; btn.title = bad ? 'Fix the dates or pick a free car first' : ''; }
    return !bad;
  }
  function save() {
    var r = calcNow(), f = r.f;
    if (!recalc()) { UI.toast('The car is not free for these dates, or the dates are wrong.', { tone: 'warn' }); return false; }
    var miss = [];
    if (!f.car) miss.push('the car'); if (!r.s || !r.e) miss.push('the dates'); if (!f.name.trim()) miss.push('the full name'); if (!f.phone.trim()) miss.push('the phone'); if (!f.method) miss.push('the payment method');
    if (seeAmt && amt && (!r.num('rate') || r.num('hourly') < 0)) miss.push('the daily rate');
    if (miss.length) { UI.toast('Fill in ' + miss.join(', ') + '.', { tone: 'warn' }); var first = dr.body.querySelector('[data-key="' + (!f.car ? 'car' : !f.name.trim() ? 'name' : 'phone') + '"]'); if (first) { var sec = first.closest('.bkx-sec'); if (sec) sec.classList.remove('shut'); first.focus(); } return false; }
    var car = carById(f.car), c = r.c, pk = r.pk, so = (f.startOpt || 'Not chosen').split('|'), eo = (f.endOpt || 'Not chosen').split('|');
    /* the customer: same person when the IC or phone matches */
    var icIn = !cuSeeIc() && !isNew ? (p ? p.ic : '') : f.ic.trim();
    var person = p || d.people.filter(function (q) { return (icIn && q.ic.replace(/[\s-]/g, '') === icIn.replace(/[\s-]/g, '')) || q.phone.replace(/\D/g, '') === f.phone.replace(/\D/g, ''); })[0];
    var pPatch = { name: f.name.trim(), phone: f.phone.trim(), email: f.email, address: f.address, nat: f.nat || 'Malaysian', ic: icIn || (person ? person.ic : ''), licenceNo: f.licenceNo, licenceExp: f.licenceExp ? UI.parseDate(f.licenceExp) : null, emergency: { name: f.emName, phone: f.emPhone, rel: f.emRel } };
    if (!person) person = DB.add('people', Object.assign({ id: 'cus-' + (d.people.length + 1) + '-' + Date.now().toString(36), i: d.people.length, since: NOW(), flag: '', docs: {}, blacklist: null, notes: [], icCheck: check.results ? { at: NOW(), by: DB.actor(), valid: true, results: check.results } : null }, pPatch), { where: 'Customer', text: DB.actor() + ' added customer ' + pPatch.name });
    else DB.update('people', person, pPatch, { silent: true });
    if (isNew) { CU_DOCS.forEach(function (dc) { if (!docs[dc[0]] && person.docs && person.docs[dc[0]]) docs[dc[0]] = Object.assign({}, person.docs[dc[0]]); else if (docs[dc[0]] && person.docs && !person.docs[dc[0]]) person.docs[dc[0]] = docs[dc[0]]; }); }
    var rec = { car: car, start: r.s, end: r.e, days: c.days, rate: r.num('rate'), hourly: r.num('hourly'), dep: r.num('dep'), disc: r.num('disc'), deliv: r.num('deliv'), ret: r.num('ret'), others: r.num('others'), rent: c.rent, dmg: c.cover, payable: c.payable,
      pkg: pk ? pk.id : null, cov: f.pkg === 'manual' ? { name: f.covName || 'Cover', daily: +f.covDaily || 0, max: +f.covMax || 0 } : null,
      startOpt: so[0], pickup: so[1] || (x ? x.pickup : (B().locations[0] || {}).n), endOpt: eo[0], drop: eo[1] || (x ? x.drop : (B().locations[0] || {}).n), delNote: f.delNote, retNote: f.retNote,
      method: f.method, signature: f.signature || null, filledByAdmin: !!f.filledByAdmin, submitted: !!f.submitted, cust: person, docs: docs, updated: NOW() };
    if (!seeAmt || !amt) { if (x) ['rate', 'hourly', 'dep', 'disc', 'deliv', 'ret', 'others'].forEach(function (k) { if (!amt) rec[k] = x[k]; }); if (!amt) { var c2 = bkCalc({ start: r.s, end: r.e, rate: rec.rate, hourly: rec.hourly, dep: rec.dep, disc: rec.disc, deliv: rec.deliv, ret: rec.ret, others: rec.others, covDaily: pk ? pk.daily : 0 }); rec.rent = c2.rent; rec.payable = c2.payable; rec.dmg = c2.cover; } }
    if (chSt) { rec.pay = f.pay; rec.status = f.status; }
    if (rec.submitted && !(x && x.submittedAt)) rec.submittedAt = NOW();
    saved = true;
    if (x) { DB.update('bookings', x, rec, { text: DB.actor() + ' changed booking ' + x.code }); UI.toast('Booking ' + x.code + ' updated'); return true; }
    var n = Math.max.apply(0, d.bookings.map(function (z) { return z.n; }).concat([B().startNo || 0])) + 1, code2 = B().code + '-' + String(n).padStart(5, '0'), hx = function () { return Math.random().toString(16).slice(2, 10); };
    var nb = Object.assign({ n: n, code: code2, id: code2, received: 0, status: 'Pending', pay: '', agent: '', created: NOW(), inspected: false, formId: B().id.slice(0, 3) + '-' + hx(), agentToken: 'agt-' + hx(), submittedAt: rec.submitted ? NOW() : null, ip: '', agentIds: [] }, rec);
    if (nb.submitted) nb.custSig = { typed: person.name };
    DB.add('bookings', nb, { text: DB.actor() + ' created booking ' + code2 + ' (' + car.plate + ')' });
    UI.toast('Booking ' + code2 + ' created. Send the booking form link to ' + person.name.split(' ')[0] + '.', { action: { label: 'Copy link', run: function () { bkLinkCopy(nb, ''); } } });
    return true;
  }

  /* ---- events ---- */
  dr.el.addEventListener('input', function (ev) { if (ev.target.closest('.bkx-form') && !ev.target.closest('#bkx-notes,#bkx-ic')) { dirty = true; recalc(); } });
  dr.el.addEventListener('change', function (ev) {
    var t = ev.target, k = t.getAttribute('data-key');
    if (t.closest('.bkx-form') && !t.closest('#bkx-notes,#bkx-ic,#bkx-docs')) dirty = true;
    if (k === 'car' && amt) { var c = carById(t.value); if (c) ['rate', 'hourly', 'dep'].forEach(function (f2, j) { var el = dr.body.querySelector('[data-key="' + f2 + '"]'); if (el) el.value = [c.rate, c.hourly, c.deposit][j]; }); }
    if (k === 'car' && !amt) { var c3 = carById(t.value); if (c3) { v.rate = c3.rate; v.hourly = c3.hourly; v.dep = c3.deposit; ['rate', 'hourly', 'dep'].forEach(function (f2) { var el = dr.body.querySelector('[data-key="' + f2 + '"]'); if (el) el.value = v[f2]; }); } }
    if (t.matches('[data-bkx-chk]') && t.files[0]) bkCheckFile(t.getAttribute('data-bkx-chk'), t.files[0]);
    if (t.matches('[data-bs-slip]') && t.files[0]) UI.readImage(t.files[0]).then(function (r2) { DB.update('bookings', x, { refundSlip: { name: r2.name, size: r2.size, dataUrl: r2.dataUrl } }, { text: DB.actor() + ' added the deposit refund slip of ' + x.code }); var sl = dr.body.querySelector('#bkx-slip'); if (sl) sl.innerHTML = '<div class="cu-doc-h">Deposit refund slip</div><div class="cu-doc-f"><button type="button" class="cu-link ellip" data-bs="slipopen">' + esc(r2.name) + '</button></div>'; UI.toast('Refund slip saved. Record the refund on Deposit refunds.', { action: { label: 'Open', run: function () { API.openDeposit(x.code); } } }); });
    recalc();
  });
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b2;
    if ((b2 = t.closest('[data-bkx-tog]'))) { b2.parentNode.classList.toggle('shut'); return; }
    if ((b2 = t.closest('[data-bkx-sum]'))) { API.openSummons(b2.getAttribute('data-bkx-sum')); return; }
    if (!(b2 = t.closest('[data-bs]'))) return;
    var a = b2.getAttribute('data-bs'), val = b2.getAttribute('data-v');
    ({
      st: function () { bkStatusDialog(x, 'st'); }, pay: function () { bkStatusDialog(x, 'pay'); },
      copy: function () { bkLinkCopy(x, ''); }, bf: function () { dr.close(true).then(function () { A.sec('bf'); }); },
      pdf: function () { bkAgreement(x); }, pdflink: function () { bkLinkCopy(x, 'pdf'); },
      doc: function () { bkDocPreview(val); }, docpdf: function () { bkDocPdf(val); }, docsend: function () { bkDocSend(val); }, inv: function () { bkCreateInvoice(x.code); },
      recpay: function () { API.recordPayment(x.code); }, slip: function () { API.uploadSlips(x.code); }, allbill: function () { go('invoices', { tab: 'payments', q: x.code }); },
      ins: function () { bkInspection(x.code); }, agentlink: function () { bkLinkCopy(x, 'agent'); }, custlink: function () { bkLinkCopy(x, 'customer'); },
      dep: function () { API.openDeposit(x.code); }, task: function () { API.newTask({ booking: x.code }); },
      del: function () { bkDelete([x.code]); }, slipopen: function () { cuShowFile(x.refundSlip, 'Deposit refund slip'); }
    }[a] || function () {})();
  });
  /* CHECK THE CUSTOMER FIRST: read a card picture (made-up reading), check it, keep the file with the booking */
  function bkCheckFile(kind, file) {
    var out = dr.body.querySelector('#bkx-chk-out'), slot = { ic: 'icFront', icBack: 'icBack', passport: 'icFront', dl: 'dl', poa: 'poa', other: 'other' }[kind];
    UI.readImage(file, { max: 1400 }).then(function (r) {
      docs[slot] = { name: r.name, size: r.size, dataUrl: r.dataUrl, added: NOW() }; check.files.push([kind, r.name]); dirty = true;
      var dm = dr.body.querySelector('#bkx-docs'); if (dm) cuDocsMount(dm, docs, { person: p, onChange: function () { dirty = true; } });
      if ((kind === 'ic' || kind === 'passport') && !/^image\//.test(file.type)) { UI.toast('The picture could not be read. Type the details.', { tone: 'warn' }); draw(); return; }
      if (kind === 'ic' || kind === 'passport') {
        var rd = cuFakeRead(file.size + file.name.length, kind === 'passport'), set = function (k2, val) { var el = dr.body.querySelector('[data-key="' + k2 + '"]'); if (el && val) el.value = val; };
        check.read = rd; set('name', rd.name); set('ic', rd.ic); if (kind === 'passport') set('nat', 'Other');
        check.results = cuOnlineCheck(rd.ic, rd.name); recalc();
      }
      draw();
    }, function (err) { UI.toast(err.message, { tone: 'bad' }); });
    function draw() {
      var flagged = check.results && check.results.some(function (z) { return z[1] === 'Flagged'; }), pr = check.read ? cuIcParse(check.read.ic) : null;
      out.innerHTML = '<div class="bkx-chk-res">' + (check.read ? '<div class="row wrap gap6">' + UI.chip(pr && pr.ok ? (pr.passport ? 'Passport ' : 'IC ') + UI.fmt.ic(check.read.ic) + ' looks valid' : 'This is not a valid IC number.', pr && pr.ok ? 'ok' : 'bad', { icon: pr && pr.ok ? 'circle-check' : 'alert-circle' }) + '<span class="b2">Read: ' + esc(check.read.name.toUpperCase()) + ' (sample reading, check it against the card)</span></div>' : '') +
        (check.results ? '<div class="row wrap gap6">' + check.results.map(function (z) { return UI.chip(z[0] + ': ' + z[1], z[1] === 'Clear' ? 'ok' : z[1] === 'Flagged' ? 'bad' : 'warn'); }).join('') + '</div>' : '') +
        (flagged ? UI.alert('A site has flagged this person. This is a warning for you to weigh up. It does not stop the booking.', 'warn') : '') +
        '<div class="row wrap gap6">' + check.files.map(function (z) { return UI.chip(z[1], 'grey', { icon: 'paperclip' }); }).join('') + '</div></div>';
    }
  }
  return dr;
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
      due: function (x) { return x.status !== 'Cancelled' && x.status !== 'Pending' && bkMoney(x).due > 0; }
    };
    function rowsFor() {
      var f = st.f, q = (f.q || '').toLowerCase().trim(), qd = q.replace(/\D/g, ''), from = f.from ? UI.parseDate(f.from) : null, to = f.to ? UI.parseDate(f.to) : from;
      return d.bookings.filter(function (x) {
        if (f.status && x.status !== f.status) return false;
        if (f.pay && (x.pay || 'None') !== f.pay) return false;
        if (f.car && x.car.id !== f.car) return false;
        if (f.quick && f.quick !== 'all' && quick[f.quick] && !quick[f.quick](x)) return false;
        if (from) { var s = new Date(x.start.getFullYear(), x.start.getMonth(), x.start.getDate()); if (s < from || s > to) return false; }
        if (!q) return true;
        return (x.code + ' ' + x.cust.name + ' ' + x.cust.email + ' ' + x.cust.phone + ' ' + x.car.plate).toLowerCase().indexOf(q) >= 0 || (qd.length >= 3 && x.cust.phone.replace(/\D/g, '').indexOf(qd) >= 0);
      }).sort(function (a, b) { return b.n - a.n; });
    }
    var rows = rowsFor();
    root.innerHTML = '<div class="pg-h bkx-pgh"><div><h1>Bookings</h1><p id="bkx-count">' + plural(rows.length, 'booking') + (rows.length !== d.bookings.length ? ' of ' + d.bookings.length : '') + '</p></div><div class="acts" id="bkx-acts"></div></div>' +
      '<div class="card bkx-list"><div id="bkx-f"></div><div id="bkx-t"></div></div>';

    var acts = root.querySelector('#bkx-acts');
    function drawActs() {
      var sel = Object.keys(st.sel).filter(function (k) { return st.sel[k]; }), one = sel.length === 1, nf = st.f.status === 'Pending' || st.f.status === 'Cancelled';
      var edit = can2('bookings.edit') ? 'Edit Booking' : 'View Booking';
      acts.innerHTML = (can2('reports.export_excel') ? UI.btn('Export to Excel', { kind: 'o', icon: 'file-spreadsheet', disabled: nf, title: nf ? 'Pending and cancelled bookings are not income, so they are not in the Excel file. Pick another status.' : 'Download the bookings as an Excel file', attrs: { 'data-act': 'export' } }) : '') +
        '<span class="bkx-tip" title="' + (one ? '' : sel.length ? 'Tick only one booking to ' + edit.split(' ')[0].toLowerCase() + ' it.' : 'Tick one booking in the list to ' + edit.split(' ')[0].toLowerCase() + ' it.') + '">' + UI.btn(edit, { kind: 'o', icon: can2('bookings.edit') ? 'edit' : 'eye', disabled: !one, attrs: { 'data-act': 'edit' } }) + '</span>' +
        (can2('bookings.delete') ? '<span class="bkx-tip" title="' + (sel.length ? '' : 'Tick the bookings to delete') + '">' + UI.btn(sel.length > 1 ? 'Delete ' + sel.length : 'Delete', { kind: 'o', icon: 'trash', cls: 'bkx-del', disabled: !sel.length, attrs: { 'data-act': 'delete' } }) + '</span>' : '') +
        (can2('bookings.create') ? UI.btn('New Booking', { icon: 'plus', attrs: { 'data-act': 'new' } }) : '');
    }

    var stChip = function (x, kind) {
      var html = kind === 'pay' ? UI.status('payment', x.pay || 'None', null, { sm: true }) : UI.status('booking', x.status, null, { sm: true });
      return can2('bookings.change_status') ? '<button type="button" class="bkx-stb" data-bk="' + kind + '" title="Change the ' + (kind === 'pay' ? 'payment' : 'booking') + ' status">' + html + '</button>' : html;
    };
    var amount = function (x) {
      if (x.status === 'Cancelled') return '<span class="faint">Cancelled</span>';
      var m = bkMoney(x), tip = 'Total ' + UI.fmt.money(m.total) + ' · Received ' + UI.fmt.money(m.rec) + ' · ' + (m.due > 0 ? 'Still due ' + UI.fmt.money(m.due) : m.due < 0 ? 'Paid in full, ' + UI.fmt.money(-m.due) + ' extra' : 'Paid in full');
      return '<div class="bkx-amt t-' + m.tone + '" title="' + tip + '"><b class="num">' + UI.fmt.money(m.total) + '</b><span class="bkx-bar"><i style="width:' + m.pct + '%"></i></span><small class="num">' + (m.due > 0 ? UI.fmt.money(m.due, { dp: m.due % 1 ? 2 : 0 }) + ' due' : m.due < 0 ? UI.fmt.money(-m.due, { dp: 0 }) + ' extra' : 'Paid') + '</small></div>';
    };
    var docsCell = function (x) {
      var inv = bkInvoice(x.code), nr = bkReceipts(x.code).length;
      return '<div class="bkx-ics">' + UI.iconBtn('copy', 'Copy Link (booking form)', { size: 'sm', attrs: { 'data-bk': 'copy' } }) +
        (can2('bookings.view_documents') ? UI.iconBtn('file-type-pdf', x.submitted ? 'View PDF (signed agreement)' : 'Agreement not signed yet', { size: 'sm', cls: x.submitted ? '' : 'bkx-dim', attrs: { 'data-bk': 'pdf' } }) : '') +
        UI.iconBtn('file-invoice', 'Invoice and receipts' + (inv ? ': ' + inv.no : ': no invoice yet') + (nr ? ', ' + plural(nr, 'receipt') : ''), { size: 'sm', cls: inv ? 'bkx-has' : '', attrs: { 'data-bk': 'bill' } }) + '</div>';
    };
    var insCell = function (x) { var ok = d.inspections.some(function (z) { return z.booking === x.code; }); return '<button type="button" class="bkx-ins' + (ok ? ' done' : '') + '" data-bk="ins" title="Inspection: view the data, copy the agent or customer link">' + i(ok ? 'circle-check' : 'circle-dashed') + (ok ? 'Done' : 'Links') + i('chevron-down', 'bkx-caret') + '</button>'; };
    var cols = [
      { key: 'n', label: 'Booking ID', sort: true, nowrap: true, render: function (x) { return '<b class="bkx-id">' + x.code + '</b><small class="bkx-sub">' + plural(x.days, 'day') + '</small>'; } },
      { key: 'cust', label: 'Customer', sort: function (x) { return x.cust.name; }, render: function (x) { var fl = (x.cust.blacklist ? 'bad' : cuFlags(x.cust).careful ? 'warn' : cuFlags(x.cust).vip ? 'info' : ''); return '<div class="bkx-cu"><b class="ellip" title="' + esc(x.cust.name) + '">' + (fl && can2('customer_notes.view') ? '<span class="bkx-fl ' + fl + '" title="' + (fl === 'bad' ? 'Blacklisted' : fl === 'warn' ? 'Be careful' : 'VIP') + '"></span>' : '') + esc(x.cust.name) + '</b>' + UI.phone(x.cust.phone) + '</div>'; } },
      { key: 'car', label: 'Car & period', sort: function (x) { return x.start; }, render: function (x) { return '<div class="bkx-car"><div><b>' + esc(x.car.plate) + '</b> <span>' + esc(x.car.model.split(' ')[0]) + ' · ' + esc(x.car.color) + '</span></div><div class="bkx-per" title="Pick-up ' + UI.fmt.dateTime(x.start) + ', return ' + UI.fmt.dateTime(x.end) + '">' + bkWhen(x.start) + i('arrow-right') + bkWhen(x.end) + '</div></div>'; } },
      { key: 'status', label: 'Status', sort: function (x) { return LISTS.bookingStatus.indexOf(x.status); }, render: function (x) { return '<div class="bkx-sts2">' + stChip(x, 'st') + stChip(x, 'pay') + '</div>'; } },
      { key: 'payable', label: 'Amount', align: 'right', sort: true, hidden: !seeAmt, render: amount },
      { key: 'agent', label: 'Handover', sort: function (x) { return bkAgents(x).join(', '); }, render: function (x) { var a = bkAgents(x); return '<div class="bkx-ho">' + (can2('inspections.view') ? insCell(x) : '') + (a.length ? '<span class="bkx-ag ellip" title="Agent: ' + esc(a.join(', ')) + '">' + i('user') + esc(a.map(function (n) { return n.split(' ')[0]; }).join(', ')) + '</span>' : '<span class="bkx-ag faint">' + i('user') + 'No agent yet</span>') + '</div>'; } },
      { key: 'docs', label: 'Documents', render: function (x) { return docsCell(x).replace(/<\/div>$/, '') + (can2('tasks.create') ? UI.iconBtn('calendar-plus', 'Assign Task', { size: 'sm', attrs: { 'data-bk': 'task' } }) : '') + '</div>'; } }
    ];
    var t = UI.table(root.querySelector('#bkx-t'), {
      columns: cols, rows: rows, rowKey: 'code', minWidth: 1080, selectable: true, selected: st.sel, noun: 'booking',
      sort: st.sort, onSort: function (s) { st.sort = s; }, page: st.page, onPage: function (pg) { st.page = pg; }, pageSize: st.size || 10, pageSizes: [10, 25, 50, 100], maxHeight: 'min(74vh,900px)',
      onSelect: function () { drawActs(); }, rowClass: function (x) { return 'bkx-r' + (x.status === 'Cancelled' ? ' bkx-cx' : ''); },
      bulk: function (keys) { return (can2('bookings.delete') ? UI.btn('Delete', { kind: 'err', size: 'sm', icon: 'trash', attrs: { 'data-act': 'delete' } }) : ''); },
      onRowClick: function (x) { bkOpenBooking(x.code); },
      empty: { icon: 'calendar-off', title: 'No bookings match', text: 'Clear the search or the filters.' },
      card: function (x) {
        return '<div class="bkx-cd"><div class="bkx-cd-h"><b class="bkx-id">' + x.code + '</b><span class="bkx-sts2 row">' + stChip(x, 'st') + stChip(x, 'pay') + '</span></div>' +
          '<div class="bkx-cd-r"><span class="ellip t1c fw5">' + esc(x.cust.name) + '</span>' + UI.phone(x.cust.phone) + '</div>' +
          '<div class="bkx-cd-r"><span><b class="t1c">' + esc(x.car.plate) + '</b> ' + esc(x.car.model.split(' ')[0]) + '</span><span class="bkx-per">' + bkWhen(x.start) + i('arrow-right') + bkWhen(x.end) + '</span></div>' +
          '<div class="bkx-cd-f">' + (seeAmt ? amount(x) : '<span></span>') + '<div class="bkx-ics">' + docsCell(x).replace('<div class="bkx-ics">', '').replace(/<\/div>$/, '') + (can2('inspections.view') ? UI.iconBtn('clipboard-check', 'Inspection', { size: 'sm', attrs: { 'data-bk': 'ins' } }) : '') + (can2('tasks.create') ? UI.iconBtn('calendar-plus', 'Assign Task', { size: 'sm', attrs: { 'data-bk': 'task' } }) : '') + '</div></div></div>';
      }
    });
    var count = function (fn) { return d.bookings.filter(fn).length; };
    UI.filters(root.querySelector('#bkx-f'), {
      values: st.f,
      fields: [
        { type: 'search', key: 'q', placeholder: 'Search bookings: code, name, email, phone, plate' },
        { type: 'select', key: 'status', label: 'Status', options: LISTS.bookingStatus, all: 'All Statuses' },
        { type: 'select', key: 'pay', label: 'Payment Status', options: [['None', 'None']].concat(LISTS.paymentStatus.map(function (s) { return [s, s]; })), all: 'All Payment Statuses' },
        { type: 'select', key: 'car', label: 'Car', options: d.cars.map(function (c) { return [c.id, bkCarLabel(c)]; }), all: 'All Cars', width: 220 },
        { type: 'daterange', from: 'from', to: 'to', label: 'Pick-up' },
        { type: 'chips', key: 'quick', label: 'Quick', options: [['all', 'All', d.bookings.length], ['out', 'Out now', count(quick.out)], ['soon', 'Going out in 3 days', count(quick.soon)], ['back', 'Back in 3 days', count(quick.back)], ['late', 'Late', count(quick.late), 'bad'], ['due', 'Money due', count(quick.due)]] }
      ],
      onChange: function (v2, k) { var r = rowsFor(); t.setRows(r); st.page = 1; root.querySelector('#bkx-count').textContent = plural(r.length, 'booking') + (r.length !== d.bookings.length ? ' of ' + d.bookings.length : ''); if (k === 'status' || k === '*') drawActs(); }
    });
    drawActs();

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
    });
    UI.on(root, 'click', '[data-act]', function (ev, el) {
      var a = el.getAttribute('data-act'), sel = t.selected();
      if (a === 'new') bkOpenBooking(null, {});
      else if (a === 'edit' && sel.length === 1) bkOpenBooking(sel[0]);
      else if (a === 'delete' && sel.length) bkDelete(sel, function (gone) { gone.forEach(function (c) { delete st.sel[c]; }); });
      else if (a === 'export') { if (st.f.from) { var fr = UI.parseDate(st.f.from), to = st.f.to ? UI.parseDate(st.f.to) : fr; if ((to - fr) / DAY > 366) UI.toast('Choose a period of at most 366 days.', { tone: 'warn' }); else bkExport(fr, to, st.f); } else bkExportPop(el, st.f); }
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

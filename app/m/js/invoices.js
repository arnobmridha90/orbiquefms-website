/* ---------------- INVOICES AND RECEIPTS (M3 builder owns this file) ----------------
   Data:
   S.invoices[]: {id, no ('INV-2026-00012'), booking, at, by, lines [{text, sub, amt}], charges, deposit, total, note, sent {ch, at, by}, updatedAt,
                  voided, voidReason, voidedAt, voidedBy}. One live (not voided) invoice per booking. Updating it keeps the number.
   S.receipts[]: {id, no ('RCP-2026-00012'), booking, at, by, lines [paymentId], sent {ch, at, by}, voided, voidReason, voidedAt, voidedBy}.
                  One booking, one receipt: the first payment makes it and later payments add lines. A voided payment drops off;
                  with no active line left the receipt is voided. The payment keeps receiptNo.
   API: Docs.open(bookingId), Docs.addToReceipt(b, p), Docs.dropPayment(b, p), Docs.receiptOf(b), Docs.invoiceOf(b), Docs.previewReceipt(r), Docs.previewInvoice(inv),
        Docs.sendWa(kind, id). Route #invoices (Invoices / Receipts / Payments). */

/* ---------- small shared helpers (payments.js uses them too) ---------- */
function billNo(list, prefix, at) {
  var y = new Date(at || Date.now()).getFullYear(), head = prefix + '-' + y + '-', top = 0;
  (list || []).forEach(function (r) { if (r.no && r.no.indexOf(head) === 0) { var n = parseInt(r.no.slice(head.length), 10); if (n > top) top = n; } });
  return head + pad(top + 1, 5);
}
function billLink(doc) { return (B().site || '') + '/doc/' + (doc.token || doc.id); }
function kindShort(k) { return { 'Security deposit': 'Deposit', 'Rental payment': 'Rent', 'Delivery charge': 'Delivery', 'Return charge': 'Return', 'Damage coverage': 'Damage cover', 'Extension payment': 'Extension', 'Other payment': 'Other' }[k] || k; }
function payMethodText(p) {
  if (!p) return '';
  if (p.method === 'Deposit adjustment') { var o = p.depositOf && bk(p.depositOf); return 'From the deposit' + (o ? ' of ' + o.code : ''); }
  if (p.method === 'Cash') return 'Cash' + (p.cashTo ? ' to ' + who(p.cashTo) : '');
  if (p.method === 'Card') return 'Card' + (p.afterCharge != null ? ', ' + rm(p.afterCharge) + ' after charge' : '');
  return 'Transfer';
}
function slipsOf(p) { if (!p) return []; if (p.slips && p.slips.length) return p.slips; return p.slip ? [{ src: p.slip, hash: p.slipHash, at: p.at, by: p.by }] : []; }
function sentText(s) { return s ? 'Last sent: ' + s.ch + ', ' + dShort(s.at) + ' ' + hm(s.at) + (s.by ? ' by ' + firstName(who(s.by)) : '') : 'Not sent yet'; }

var Docs = (function () {
  function invoiceOf(b) { return (S.invoices || []).filter(function (x) { return x.booking === b.id && !x.voided; })[0] || null; }
  function receiptOf(b) { return (S.receipts || []).filter(function (x) { return x.booking === b.id && !x.voided; })[0] || null; }
  function paysOfReceipt(r) { var b = bk(r.booking); if (!b) return []; return (b.payments || []).filter(function (p) { return (r.lines || []).indexOf(p.id) >= 0; }); }
  function receiptTotal(r) { return paysOfReceipt(r).filter(function (p) { return !p.voided; }).reduce(function (s, p) { return s + payTotal(p); }, 0); }
  function noReceipt(b) { var live = (S.receipts || []).filter(function (r) { return r.booking === b.id && !r.voided; }); return activePays(b).filter(function (p) { return !live.some(function (r) { return (r.lines || []).indexOf(p.id) >= 0; }); }); }

  /* receipt bookkeeping, called by payments.js */
  function addToReceipt(b, p) {
    S.receipts = S.receipts || [];
    var r = receiptOf(b), made = false;
    if (!r) { r = { id: uid(), no: billNo(S.receipts, B().receiptPrefix || 'RCP', p.at), booking: b.id, at: new Date().toISOString(), by: S.me, lines: [] }; S.receipts.unshift(r); made = true; }
    if (r.lines.indexOf(p.id) < 0) r.lines.push(p.id);
    p.receiptNo = r.no;
    return { receipt: r, made: made };
  }
  function dropPayment(b, p) {
    var r = (S.receipts || []).filter(function (x) { return !x.voided && (x.lines || []).indexOf(p.id) >= 0; })[0];
    if (!r) return null;
    var left = paysOfReceipt(r).filter(function (q) { return !q.voided; });
    if (!left.length) { r.voided = true; r.voidReason = 'All its payments were voided'; r.voidedAt = new Date().toISOString(); r.voidedBy = S.me; return { receipt: r, voided: true }; }
    return { receipt: r, voided: false };
  }

  /* ---------- invoice maths (the booking as it is now) ---------- */
  function invoiceDraft(b) {
    var m = calcBooking(b), r = b.rates || {}, lines = [];
    var parts = [];
    if (m.days) parts.push(m.days + ' day' + (m.days === 1 ? '' : 's') + ' x ' + rm(r.daily));
    if (m.remHours > 0.001) { var h = Math.round(m.remHours * 100) / 100; parts.push(h + ' hour' + (h === 1 ? '' : 's') + ' x ' + rm(r.hourly)); }
    var exact = (m.days ? (+r.daily || 0) * m.days : 0) + (+r.hourly || 0) * (m.days ? m.remHours : m.hours);
    lines.push({ text: 'Car rental', sub: (parts.join(' + ') || '') + (Math.abs(exact - m.rent) >= 0.005 ? ' (rounded to the nearest RM)' : ''), amt: m.rent, k: 'rent' });
    if (m.coverTotal) lines.push({ text: 'Damage cover: ' + ((b.cover && b.cover.name) || 'Damage cover'), sub: m.coverDays + ' day' + (m.coverDays === 1 ? '' : 's') + ' x ' + rm(b.cover.daily), amt: m.coverTotal, k: 'cover' });
    if (m.delivery) lines.push({ text: 'Delivery charge', sub: placeText(b, 'pick'), amt: m.delivery, k: 'delivery' });
    if (m['return']) lines.push({ text: 'Return charge', sub: placeText(b, 'ret'), amt: m['return'], k: 'return' });
    if (m.others) lines.push({ text: 'Other charges', sub: '', amt: m.others, k: 'others' });
    if (m.discount) lines.push({ text: 'Discount', sub: '', amt: -m.discount, k: 'discount' });
    return { lines: lines, charges: m.charges, deposit: m.deposit, total: m.charges + m.deposit };
  }
  function changedSince(inv, b) { var d = invoiceDraft(b); return Math.abs((inv.charges || 0) - d.charges) >= 0.005 || Math.abs((inv.deposit || 0) - d.deposit) >= 0.005 ? d : null; }

  /* ---------- documents (A4 preview through pdfDoc) ---------- */
  function carExtra(b) { var c = car(b.car) || {}; return (c.make ? c.make + ' ' + c.model + ' (' + c.plate + ') · ' : '') + dFull(b.start) + ' to ' + dFull(b.end); }
  function invoiceData(inv) {
    var b = bk(inv.booking) || {}, cu = cust(b.cust);
    return { no: inv.no + (inv.voided ? ' (VOID)' : ''), title: inv.voided ? 'Invoice: VOID' : 'Invoice', date: inv.updatedAt || inv.at, booking: b.code, to: { name: cu.name, phone: cu.phone, extra: carExtra(b) },
      lines: (inv.lines || []).map(function (l) { return { text: l.text, sub: l.sub, amt: l.amt }; }),
      totals: [{ label: 'Total charges', amt: inv.charges }].concat(inv.deposit ? [{ label: 'Security deposit (refundable)', amt: inv.deposit }] : []).concat([{ label: inv.deposit ? 'Total (charges + deposit)' : 'Total', amt: inv.total, big: true }]),
      notes: (inv.deposit ? 'The security deposit is refundable and is not a rental charge.' : '') + (inv.note ? (inv.deposit ? '\n' : '') + inv.note : '') + (inv.voided ? '\nVOID: ' + (inv.voidReason || '') : ''),
      shareText: shareText('invoice', inv), link: billLink(inv), stack: true };
  }
  function receiptData(r) {
    var b = bk(r.booking) || {}, cu = cust(b.cust), pays = paysOfReceipt(r).filter(function (p) { return !p.voided; }).sort(function (x, y) { return new Date(x.at) - new Date(y.at); }), lines = [];
    pays.forEach(function (p) { (p.items || []).forEach(function (it) { lines.push({ text: it.kind, sub: ({ 'Online Transfer': 'Bank transfer', 'Cash': 'Cash', 'Card': 'Card', 'Deposit adjustment': 'Taken from your deposit' }[p.method] || p.method) + ' · ' + dFull(p.at) + ', ' + hm(p.at) + (p.ref ? ' · Ref ' + p.ref : ''), amt: +it.amt || 0 }); }); });
    return { no: r.no + (r.voided ? ' (VOID)' : ''), title: r.voided ? 'Receipt: VOID' : 'Receipt', date: r.at, booking: b.code, to: { name: cu.name, phone: cu.phone, extra: carExtra(b) },
      lines: lines, totals: [{ label: 'Total received', amt: receiptTotal(r), big: true }],
      notes: 'Thank you. This receipt lists every payment received for booking ' + (b.code || '') + '.' + (r.voided ? '\nVOID: ' + (r.voidReason || '') : ''),
      shareText: shareText('receipt', r), link: billLink(r), stack: true };
  }
  function shareText(kind, doc) {
    var b = bk(doc.booking) || {}, cu = cust(b.cust), word = kind === 'invoice' ? 'your invoice' : 'your payment receipt';
    return 'Hi ' + firstName(cu.name) + ', here is ' + word + ' ' + doc.no + ' from ' + B().name + ': ' + billLink(doc);
  }
  function previewInvoice(inv) { pdfDoc('invoice', invoiceData(inv)); }
  function previewReceipt(r) { pdfDoc('receipt', receiptData(r)); }
  function docBy(kind, id) { return byId(kind === 'invoice' ? S.invoices : S.receipts, id); }
  function markSent(doc, ch) { doc.sent = { ch: ch, at: new Date().toISOString(), by: S.me }; var b = bk(doc.booking); if (b) bLog(b, (doc.no.indexOf(B().invoicePrefix || 'INV') === 0 ? 'Invoice ' : 'Receipt ') + doc.no + ' sent (' + ch + ')'); save(); }
  function sendWa(kind, id) {
    var doc = docBy(kind, id); if (!doc) return;
    if (doc.voided) { say('This document is void and cannot be sent'); return; }
    if (!can('billing.send')) { say('Ask the owner for Send invoices access'); return; }
    var b = bk(doc.booking), cu = cust(b.cust);
    if (!cu.phone) { say('This customer has no phone number'); return; }
    Share.wa(cu.phone, shareText(kind, doc)); markSent(doc, 'WhatsApp'); say('WhatsApp is ready with the message and the link. Press send there.');
  }
  function shareDoc(kind, id) {
    var doc = docBy(kind, id); if (!doc) return;
    if (doc.voided) { say('This document is void and cannot be sent'); return; }
    var data = kind === 'invoice' ? invoiceData(doc) : receiptData(doc), html = pdfDoc.html(kind, data), file = null;
    try { file = new File([html], doc.no + '.html', { type: 'text/html' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: doc.no, text: data.shareText }).then(function () { markSent(doc, 'Shared'); }).catch(function () {});
    else Share.native({ title: doc.no, text: data.shareText }).then(function () { markSent(doc, 'Shared'); });
  }
  function downloadDoc(kind, id) { var doc = docBy(kind, id); if (!doc) return; var data = kind === 'invoice' ? invoiceData(doc) : receiptData(doc); pdfDoc.print(pdfDoc.html(kind, data)); doc.sent = doc.sent || null; var b = bk(doc.booking); if (b) audit('Downloaded ' + doc.no, { booking: b.id }); save(); }

  /* ---------- the sheet of one booking ---------- */
  function sendRow(kind, doc) {
    if (doc.voided) return '';
    return '<div class="dc-send">' + (can('billing.send') ? '<button type="button" class="btn sm" data-act="wa" data-k="' + kind + '" data-id="' + doc.id + '">' + I('wa') + 'Send on WhatsApp</button>' : '') +
      '<button type="button" class="btn sm ghost" data-act="share" data-k="' + kind + '" data-id="' + doc.id + '" aria-label="Share">' + I('share') + 'Share</button>' +
      '<button type="button" class="btn sm ghost" data-act="dl" data-k="' + kind + '" data-id="' + doc.id + '" aria-label="Download">' + I('install') + '</button></div>' +
      '<div class="tiny muted dc-sent">' + esc(sentText(doc.sent)) + '</div>';
  }
  function body(b) {
    var inv = invoiceOf(b), oldInv = (S.invoices || []).filter(function (x) { return x.booking === b.id && x.voided; }), h = '';
    /* invoice */
    h += '<div class="sec"><h2>Invoice</h2></div><div class="card dc-card">';
    if (inv) {
      var ch = changedSince(inv, b);
      h += '<button type="button" class="dc-doc" data-act="view" data-k="invoice" data-id="' + inv.id + '">' + I('file') + '<span class="grow"><b>Preview ' + esc(inv.no) + '</b><small>Made ' + esc(dFull(inv.at)) + (inv.updatedAt ? ', updated ' + esc(dShort(inv.updatedAt)) : '') + ' by ' + esc(firstName(who(inv.by))) + '</small></span><span class="money">' + rm(inv.charges) + '</span></button>';
      if (ch) h += '<div class="banner amber dc-changed">' + I('warn') + '<div class="grow">The booking changed since ' + esc(inv.no) + ': <b class="nowrap">' + rm(inv.charges) + '</b> to <b class="nowrap">' + rm(ch.charges) + '</b>' +
        (can('billing.issue_invoice') ? '<button type="button" class="btn sm" data-act="regen" data-id="' + inv.id + '">Update the invoice</button>' : '') + '</div></div>';
      h += sendRow('invoice', inv);
      if (can('billing.void')) h += '<button type="button" class="btn link red dc-void" data-act="void" data-k="invoice" data-id="' + inv.id + '">Void invoice</button>';
    } else {
      h += '<div class="dc-none">' + I('file') + '<div class="grow"><b>No invoice yet</b><small>It lists the rent and charges of this booking</small></div></div>' +
        (b.bookingStatus === 'Cancelled' ? '' : can('billing.issue_invoice') ? '<button type="button" class="btn" data-act="gen">' + I('plus', 2.2) + 'Generate invoice</button>' : '<div class="small muted dc-pad">Ask the owner for Make invoices access</div>');
    }
    if (oldInv.length) h += '<div class="dc-old">' + oldInv.map(function (x) { return '<button type="button" data-act="view" data-k="invoice" data-id="' + x.id + '"><s>' + esc(x.no) + '</s> voided: ' + esc(x.voidReason || '') + '</button>'; }).join('') + '</div>';
    h += '</div>';
    /* receipts */
    var recs = (S.receipts || []).filter(function (x) { return x.booking === b.id; }).sort(function (x, y) { return (x.voided ? 1 : 0) - (y.voided ? 1 : 0) || new Date(y.at) - new Date(x.at); }), missing = noReceipt(b);
    h += '<div class="sec"><h2>Receipts</h2></div><div class="card dc-card">';
    if (!recs.length) h += '<div class="dc-none">' + I('receipt') + '<div class="grow"><b>No receipts yet</b><small>The first payment recorded makes the receipt</small></div></div>';
    recs.forEach(function (r) {
      var n = paysOfReceipt(r).filter(function (p) { return !p.voided; }).length;
      h += '<button type="button" class="dc-doc' + (r.voided ? ' void' : '') + '" data-act="view" data-k="receipt" data-id="' + r.id + '">' + I('receipt') + '<span class="grow"><b>' + esc(r.no) + (r.voided ? ' · voided' : '') + '</b><small>' + (r.voided ? esc(r.voidReason || '') : n + ' payment' + (n === 1 ? '' : 's') + ' · made ' + esc(dShort(r.at))) + '</small></span><span class="money">' + rm(receiptTotal(r)) + '</span></button>';
      if (!r.voided) h += sendRow('receipt', r) + (can('billing.void') ? '<button type="button" class="btn link red dc-void" data-act="void" data-k="receipt" data-id="' + r.id + '">Void receipt</button>' : '');
    });
    if (missing.length) {
      h += '<div class="banner blue dc-miss">' + I('info') + '<div class="grow">' + missing.length + ' payment' + (missing.length === 1 ? ' has' : 's have') + ' no receipt yet (' + rm(missing.reduce(function (s, p) { return s + payTotal(p); }, 0)) + ')' +
        (can('billing.issue_receipt') ? '<button type="button" class="btn sm" data-act="mkrcp">Create receipt</button>' : '') + '</div></div>';
    }
    h += '</div>';
    /* deposit statement */
    if (b.paymentStatus === 'Deposit Refunded') h += '<div class="sec"><h2>Deposit</h2></div><div class="card dc-card"><button type="button" class="dc-doc" data-act="dep">' + I('shield') + '<span class="grow"><b>Deposit statement</b><small>What was received, kept and returned</small></span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></button></div>';
    return h;
  }
  function open(bookingId) {
    var b = bk(bookingId); if (!b) { say('This booking is not here any more'); return; }
    if (!can('billing.view')) { sheet(sheetHead('Invoice and receipts', b.code) + noAccess('billing.view')); return; }
    var sh = sheet(sheetHead('Invoice and receipts', b.code + ' · ' + cust(b.cust).name) + '<div class="dc-body"></div>', null, { cls: 'dc-sheet' });
    var draw = function () { $('.dc-body', sh).innerHTML = body(b); wire(); };
    var wire = function () {
      $$('[data-act]', sh).forEach(function (el) {
        el.onclick = function () {
          var a = el.dataset.act, k = el.dataset.k, id = el.dataset.id;
          if (a === 'view') { var d = docBy(k, id); if (d) (k === 'invoice' ? previewInvoice : previewReceipt)(d); }
          else if (a === 'wa') { sendWa(k, id); draw(); }
          else if (a === 'share') { shareDoc(k, id); setTimeout(draw, 400); }
          else if (a === 'dl') downloadDoc(k, id);
          else if (a === 'gen') generate(b, null, draw);
          else if (a === 'regen') generate(b, byId(S.invoices, id), draw);
          else if (a === 'void') voidDoc(k, id, draw);
          else if (a === 'mkrcp') { var miss = noReceipt(b), res = null; miss.forEach(function (p) { res = addToReceipt(b, p); }); if (res) { bLog(b, 'Receipt ' + res.receipt.no + (res.made ? ' created' : ' updated') + ' for ' + miss.length + ' payment' + (miss.length === 1 ? '' : 's')); save(); say('Receipt ' + res.receipt.no + ' is ready'); } draw(); rerender(); }
          else if (a === 'dep') depositStatement(b);
        };
      });
    };
    draw();
    return sh;
  }
  function rerender() { if (route().name === 'booking' || route().name === 'invoices') render(false, true); }

  /* generate or update the invoice: a preview of the lines first */
  function generate(b, existing, done) {
    if (!can('billing.issue_invoice')) { say('Ask the owner for Make invoices access'); return; }
    var cu = cust(b.cust), d = invoiceDraft(b), c = car(b.car) || {};
    if (!cu.name || cu.name === 'Unknown customer') { say('Add the customer’s name to the booking before making an invoice'); return; }
    if (d.charges < 0) { say('The discount is larger than the charges. Check the booking’s amounts.'); return; }
    var no = existing ? existing.no : billNo(S.invoices, B().invoicePrefix || 'INV');
    var rows = d.lines.map(function (l) { return '<div class="iv-line"><div class="grow">' + esc(l.text) + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</div><div class="money">' + rm(l.amt) + '</div></div>'; }).join('');
    sheet(sheetHead(existing ? 'Update the invoice' : 'Generate invoice', no + ' · ' + cu.name) +
      (existing ? '<div class="banner amber">' + I('info') + '<div>' + esc(existing.no) + ' says <b>' + rm(existing.charges) + '</b>, but the booking now comes to <b>' + rm(d.charges) + '</b>. The number stays ' + esc(existing.no) + '.</div></div>' : '') +
      '<div class="small muted iv-for">' + esc((c.make || '') + ' ' + (c.model || '') + ' (' + (c.plate || '') + ') · ' + dShort(b.start) + ' to ' + dShort(b.end)) + '</div>' +
      '<div class="card iv-lines">' + rows +
      '<div class="iv-line tot"><div class="grow">Total charges</div><div class="money">' + rm(d.charges) + '</div></div>' +
      (d.deposit ? '<div class="iv-line"><div class="grow">Security deposit (refundable)<small>Not a rental charge</small></div><div class="money">' + rm(d.deposit) + '</div></div>' : '') +
      '<div class="iv-line big"><div class="grow">Total' + (d.deposit ? ' (charges + deposit)' : '') + '</div><div class="money">' + rm(d.total) + '</div></div></div>' +
      '<label class="field"><span>Note on the invoice (optional)</span><textarea class="inp" id="ivnote" rows="2" maxlength="500" placeholder="For example: thank you for renting with us">' + esc(existing ? existing.note || '' : '') + '</textarea></label>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="ivgo">' + I('check', 2.4) + (existing ? 'Update ' + esc(existing.no) : 'Create invoice') + '</button></div>', function (sh) {
        $('#ivgo', sh).onclick = function () {
          var note = $('#ivnote', sh).value.trim(), inv;
          S.invoices = S.invoices || [];
          if (existing) { inv = existing; inv.updatedAt = new Date().toISOString(); bLog(b, 'Invoice ' + inv.no + ' updated: ' + rm(inv.charges) + ' to ' + rm(d.charges)); }
          else { if (invoiceOf(b)) { say('This booking already has an invoice'); closeSheet(); return; } inv = { id: uid(), no: no, booking: b.id, at: new Date().toISOString(), by: S.me }; S.invoices.unshift(inv); bLog(b, 'Invoice ' + inv.no + ' created (' + rm(d.charges) + ')'); }
          inv.lines = d.lines.map(function (l) { return { text: l.text, sub: l.sub, amt: l.amt }; }); inv.charges = d.charges; inv.deposit = d.deposit; inv.total = d.total; inv.note = note;
          save(); closeSheet(); say('Invoice ' + inv.no + (existing ? ' now shows the booking as it is today' : ' is ready')); if (done) done(); rerender();
          later(function () { previewInvoice(inv); }, 320);
        };
      }, { stack: true, full: true });
  }

  function voidDoc(kind, id, done) {
    var doc = docBy(kind, id); if (!doc) return;
    if (!can('billing.void')) { say('Ask the owner for Void payments access'); return; }
    var word = kind === 'invoice' ? 'invoice' : 'receipt';
    sheet('<div class="confirm"><div class="confirm-ic danger">' + I('warn', 2) + '</div><h3>Void ' + esc(doc.no) + '?</h3><p class="lead">It stays on record, marked VOID, and cannot be sent again. ' +
      (kind === 'invoice' ? 'You can make a new invoice for the booking afterwards.' : 'The payments stay recorded. You can make a fresh receipt for them afterwards.') + '</p>' +
      '<label class="field"><span>Reason</span><textarea class="inp" id="dvr" rows="2" maxlength="300" placeholder="For example: wrong customer name"></textarea><span class="err" id="dvre" hidden>Type why it is being voided</span></label>' +
      '<div class="sheet-foot stack"><button type="button" class="btn danger solid" id="dvgo">Void ' + word + '</button><button type="button" class="btn link" onclick="closeSheet()">Keep it</button></div></div>', function (sh) {
        $('#dvgo', sh).onclick = function () {
          var why = $('#dvr', sh).value.trim();
          if (!why) { $('#dvre', sh).hidden = false; $('#dvr', sh).classList.add('bad'); return; }
          doc.voided = true; doc.voidReason = why; doc.voidedAt = new Date().toISOString(); doc.voidedBy = S.me;
          var b = bk(doc.booking); if (b) bLog(b, (kind === 'invoice' ? 'Invoice ' : 'Receipt ') + doc.no + ' voided: ' + why);
          save(); closeSheet(); say(doc.no + ' voided'); if (done) done(); rerender();
        };
      }, { stack: true });
  }

  /* the deposit statement: deposits.js may have its own; otherwise a plain one from the records */
  function depositStatement(b) {
    if (window.Deposit && typeof Deposit.statement === 'function') { Deposit.statement(b.id); return; }
    var cu = cust(b.cust), got = paidOf(b, 'Security deposit'), lines = [{ text: 'Security deposit received', sub: activePays(b).filter(function (p) { return (p.items || []).some(function (i) { return i.kind === 'Security deposit'; }); }).map(function (p) { return dShort(p.at) + ' · ' + payMethodText(p); }).join('; '), amt: got }];
    (S.deductions || []).filter(function (d) { return d.booking === b.id; }).forEach(function (d) { lines.push({ text: 'Kept: ' + d.kind, sub: d.note || '', amt: -(+d.amt || 0) }); });
    var ret = (S.refunds || []).filter(function (r) { return r.booking === b.id && !r.voided; }), back = ret.reduce(function (s, r) { return s + (+r.amt || 0); }, 0);
    ret.forEach(function (r) { lines.push({ text: 'Returned to the customer', sub: (r.method || '') + ' · ' + dFull(r.at) + (r.ref ? ' · Ref ' + r.ref : ''), amt: null }); });
    pdfDoc('deposit', { no: 'DEP-' + b.code, date: ret[0] ? ret[0].at : new Date(), booking: b.code, to: { name: cu.name, phone: cu.phone, extra: carExtra(b) }, lines: lines,
      totals: [{ label: 'Deposit received', amt: got }, { label: 'Returned', amt: back, big: true }], notes: 'Deposit statement for booking ' + b.code + '.', stack: true,
      shareText: 'Hi ' + firstName(cu.name) + ', here is the deposit statement for ' + b.code + ' from ' + B().name + '.' });
  }

  return { open: open, addToReceipt: addToReceipt, dropPayment: dropPayment, receiptOf: receiptOf, invoiceOf: invoiceOf, receiptTotal: receiptTotal, paysOfReceipt: paysOfReceipt, noReceipt: noReceipt,
    invoiceDraft: invoiceDraft, changedSince: changedSince, previewInvoice: previewInvoice, previewReceipt: previewReceipt, sendWa: sendWa, share: shareDoc, download: downloadDoc, generate: generate, voidDoc: voidDoc };
})();

/* ---------- made-up invoices and receipts for the seeded payments ---------- */
SEEDERS.push({ key: 'billingSeeded', fn: function (d, x) {
  var st = Object.assign({}, COMPANIES[d.co], d.settings || {}), rp = st.receiptPrefix || 'RCP', ip = st.invoicePrefix || 'INV', now = Date.now();
  d.receipts = d.receipts || []; d.invoices = d.invoices || [];
  /* a few payments voided by staff, so the lists show what that looks like */
  var withPays = d.bookings.filter(function (b) { return (b.payments || []).length && b.bookingStatus !== 'Cancelled'; });
  [3, 17, 41].forEach(function (i, n) {
    var b = withPays[i]; if (!b) return; var p = b.payments[0];
    b.payments.push(Object.assign({}, p, { items: p.items.map(function (i) { return { kind: i.kind, amt: i.amt }; }), id: uid(), at: new Date(new Date(p.at).getTime() + 4 * MIN).toISOString(), voided: true, voidReason: ['Recorded twice by mistake', 'Wrong amount, recorded again', 'Wrong booking'][n], voidedAt: new Date(new Date(p.at).getTime() + 30 * MIN).toISOString(), voidedBy: p.by, receiptNo: null, slip: null, slipHash: null }));
  });
  /* receipts: one per booking, numbered in the order the first payment came in */
  var list = d.bookings.filter(function (b) { return (b.payments || []).some(function (p) { return !p.voided; }); }).map(function (b) {
    var act = b.payments.filter(function (p) { return !p.voided; }).sort(function (p, q) { return new Date(p.at) - new Date(q.at); });
    return { b: b, act: act, t: new Date(act[0].at).getTime() };
  }).sort(function (a, c) { return a.t - c.t; });
  var seq = {};
  list.forEach(function (o, i) {
    var last = new Date(o.act[o.act.length - 1].at).getTime();
    if (i >= list.length - 4 && now - last < 3 * DAY) return; /* the newest few wait for a receipt, to show 'Create receipt' */
    var y = new Date(o.t).getFullYear(); seq[y] = (seq[y] || 0) + 1;
    var r = { id: uid(), no: rp + '-' + y + '-' + pad(seq[y], 5), booking: o.b.id, at: o.act[0].at, by: staff0(o.act[0].by), lines: o.act.map(function (p) { return p.id; }) };
    if (x.R() < .35) r.sent = { ch: 'WhatsApp', at: new Date(Math.min(now, new Date(o.act[o.act.length - 1].at).getTime() + 20 * MIN)).toISOString(), by: r.by };
    o.act.forEach(function (p) { p.receiptNo = r.no; });
    d.receipts.push(r);
  });
  function staff0(by) { return /^s\d+$/.test(by || '') ? by : 's3'; }
  d.receipts.reverse();
  /* invoices for about half of the bookings made in the last 40 days */
  var iseq = {}, recent = d.bookings.filter(function (b) { return b.bookingStatus !== 'Cancelled' && now - new Date(b.created).getTime() < 30 * DAY; }).sort(function (a, c) { return new Date(a.created) - new Date(c.created); });
  var made = 0;
  recent.forEach(function (b) {
    if (x.R() > .22) return;
    var t = Math.min(now - 10 * MIN, new Date(b.created).getTime() + 90 * MIN), y = new Date(t).getFullYear(); iseq[y] = (iseq[y] || 0) + 1;
    var save0 = S; S = d; var dr = Docs.invoiceDraft(b); S = save0;
    var inv = { id: uid(), no: ip + '-' + y + '-' + pad(iseq[y], 5), booking: b.id, at: new Date(t).toISOString(), by: /^s\d+$/.test(b.createdBy || '') ? b.createdBy : 's3', lines: dr.lines.map(function (l) { return { text: l.text, sub: l.sub, amt: l.amt }; }), charges: dr.charges, deposit: dr.deposit, total: dr.total };
    made++;
    if (made % 9 === 4) { inv.lines[0].amt -= 50; inv.charges -= 50; inv.total -= 50; } /* the booking changed after the invoice */
    if (made % 13 === 7) { var old = Object.assign({}, inv, { id: uid(), voided: true, voidReason: 'Wrong return date', voidedAt: new Date(t + 40 * MIN).toISOString(), voidedBy: inv.by }); d.invoices.push(old); iseq[y]++; inv.no = ip + '-' + y + '-' + pad(iseq[y], 5); inv.at = new Date(t + 41 * MIN).toISOString(); }
    if (made % 4 === 1) inv.sent = { ch: 'WhatsApp', at: new Date(Math.min(now, new Date(inv.at).getTime() + 15 * MIN)).toISOString(), by: inv.by };
    d.invoices.push(inv);
  });
  d.invoices.reverse();
  d.billingSeeded = 1;
} });

/* ---------------- #invoices: Invoices / Receipts / Payments ---------------- */
var IVL = { tab: 'invoices', q: '', st: 'active', slip: '', n: 40 };
VIEW_STATE.push(function () { IVL = { tab: 'invoices', q: '', st: 'active', slip: '', n: 40 }; });
function ivMatch(b, q, extra) {
  if (!q) return true;
  if (b && Pickers.bookingMatches(b, q)) return true;
  return wordsMatch(q, extra || '') || (normPlate(q).length >= 3 && normPlate(extra).indexOf(normPlate(q)) >= 0);
}
function ivRows() {
  var q = IVL.q.trim(), out = [];
  if (IVL.tab === 'invoices' || IVL.tab === 'receipts') {
    var inv = IVL.tab === 'invoices';
    ((inv ? S.invoices : S.receipts) || []).forEach(function (d) {
      if (IVL.st === 'active' && d.voided || IVL.st === 'void' && !d.voided) return;
      var b = bk(d.booking); if (!b) return;
      if (!ivMatch(b, q, d.no)) return;
      out.push({ t: new Date(d.updatedAt || d.at).getTime(), html: '<button type="button" class="card2' + (d.voided ? ' muted' : '') + '" data-doc="' + d.id + '"><div class="c2-main"><div class="c2-t1">' + esc(d.no) + ' <span class="muted iv-d">· ' + dShort(d.at) + '</span></div><div class="c2-t2">' + esc(cust(b.cust).name) + ' · ' + esc(b.code) + '</div></div>' +
        '<div class="c2-end"><span class="money">' + rm(inv ? d.charges : Docs.receiptTotal(d)) + '</span><small>' + (d.voided ? chip('Void', 'grey') : inv && Docs.changedSince(d, b) ? chip('Booking changed', 'amber') : d.sent ? chip('Sent', 'green') : chip(inv ? 'Not sent' : 'Ready', inv ? 'grey' : 'blue')) + '</small></div></button>' });
    });
  } else {
    var liveRc = {}; (S.receipts || []).forEach(function (r) { if (!r.voided) liveRc[r.no] = 1; });
    S.bookings.forEach(function (b) {
      (b.payments || []).forEach(function (p) {
        if (IVL.st === 'active' && p.voided || IVL.st === 'void' && !p.voided) return;
        var sl = slipsOf(p).length;
        if (IVL.slip === 'with' && !sl || IVL.slip === 'without' && sl) return;
        if (q && !(Pickers.bookingMatches(b, q) || (p.ref && normRef(p.ref).indexOf(normRef(q)) >= 0) || (p.receiptNo && wordsMatch(q, p.receiptNo)))) return;
        out.push({ t: new Date(p.at).getTime(), html: '<button type="button" class="card2' + (p.voided ? ' muted' : '') + '" data-pay="' + p.id + '" data-b="' + b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(cust(b.cust).name) + ' <span class="muted iv-d">· ' + esc(b.code) + '</span></div><div class="c2-t2">' +
          (sl ? '<span class="iv-slip" title="Has a slip">' + I('image') + '</span>' : '') + dShort(p.at) + ', ' + hm(p.at) + ' · ' + esc((p.items || []).map(function (i) { return kindShort(i.kind); }).join(', ')) + ' · ' + esc(payMethodText(p).replace(/, RM [\d,.]+ after charge/, '')) + '</div></div>' +
          '<div class="c2-end"><span class="money"' + (p.voided ? ' style="text-decoration:line-through"' : '') + '>' + rm(payTotal(p)) + '</span><small>' + (p.voided ? chip('Void', 'grey') : p.receiptNo && liveRc[p.receiptNo] ? esc(p.receiptNo.replace(/^.*-(\d{4})-0*/, '#')) : chip('No receipt', 'amber')) + '</small></div></button>' });
      });
    });
  }
  out.sort(function (a, c) { return c.t - a.t; });
  return out;
}
function ivDrawList() {
  var el = $('#ivlist'); if (!el) return;
  var rows = ivRows(), shown = rows.slice(0, IVL.n);
  var word = { invoices: 'invoice', receipts: 'receipt', payments: 'payment' }[IVL.tab];
  el.innerHTML = '<div class="small muted iv-count">' + rows.length + ' ' + word + (rows.length === 1 ? '' : 's') + (IVL.q ? ' match' + (rows.length === 1 ? 'es' : '') : '') + '</div>' +
    (shown.length ? '<div class="list">' + shown.map(function (r) { return r.html; }).join('') + '</div>' : '<div class="empty">' + (IVL.q ? 'Nothing matches “' + esc(IVL.q) + '”.' : 'Nothing here yet.') + '</div>') +
    (rows.length > shown.length ? '<button type="button" class="btn ghost iv-more" id="ivmore">Show more (' + (rows.length - shown.length) + ' left)</button>' : '');
  $$('[data-doc]', el).forEach(function (b) { b.onclick = function () { var d = byId(IVL.tab === 'invoices' ? S.invoices : S.receipts, b.dataset.doc); if (d) (IVL.tab === 'invoices' ? Docs.previewInvoice : Docs.previewReceipt)(d); }; });
  $$('[data-pay]', el).forEach(function (b) { b.onclick = function () { Pay.open(b.dataset.b, { voidId: b.dataset.pay }); }; });
  var m = $('#ivmore'); if (m) m.onclick = function () { IVL.n += 60; ivDrawList(); };
}
VIEWS.invoices = function () {
  if (!can('billing.view')) return { html: topbar('Invoices and receipts', { back: '#more' }) + '<main>' + noAccess('billing.view') + '</main>' };
  var tab = function (k, l) { return '<button type="button" class="' + (IVL.tab === k ? 'on' : '') + '" data-tab="' + k + '">' + l + '</button>'; };
  var fc = function (grp, v, l) { return '<button type="button" class="fchip' + (IVL[grp] === v ? ' on' : '') + '" data-f="' + grp + '" data-v="' + v + '">' + l + '</button>'; };
  var ph = { invoices: 'Number, customer, booking or plate', receipts: 'Number, customer, booking or plate', payments: 'Customer, booking, plate or reference' }[IVL.tab];
  var html = topbar('Invoices and receipts', { back: '#more', right: can('billing.record_payment') ? '<button class="iconbtn" onclick="Pay.slip(null)" aria-label="Upload payment slip">' + I('camera') + '</button>' : '' }) + '<main class="ivl">' +
    '<div class="iv-tabs">' + tab('invoices', 'Invoices') + tab('receipts', 'Receipts') + tab('payments', 'Payments') + '</div>' +
    '<label class="search">' + I('search') + '<input id="ivq" type="search" autocomplete="off" placeholder="' + ph + '" value="' + esc(IVL.q) + '" enterkeyhint="search"></label>' +
    '<div class="chiprow">' + fc('st', 'active', 'Active') + fc('st', 'void', 'Void') + fc('st', '', 'All') + (IVL.tab === 'payments' ? '<span class="iv-sep"></span>' + fc('slip', 'with', 'With slip') + fc('slip', 'without', 'Without slip') : '') + '</div>' +
    '<div id="ivlist"></div></main>';
  return { html: html, after: function () {
    ivDrawList();
    $$('[data-tab]').forEach(function (b) { b.onclick = function () { IVL.tab = b.dataset.tab; IVL.n = 40; if (IVL.tab !== 'payments') IVL.slip = ''; render(false, true); }; });
    $$('[data-f]').forEach(function (b) { b.onclick = function () { var g = b.dataset.f, v = b.dataset.v; IVL[g] = g === 'slip' && IVL[g] === v ? '' : v; IVL.n = 40; render(false, true); }; });
    var q = $('#ivq'), t = null; q.oninput = function () { clearTimeout(t); t = setTimeout(function () { IVL.q = q.value; IVL.n = 40; ivDrawList(); }, 120); };
  } };
};

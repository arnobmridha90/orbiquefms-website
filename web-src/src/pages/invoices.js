/* ===================================================================
   Page: Invoices & Receipts (#page=invoices)   Owner: builder 2
   Also the shared billing pieces other pages open through API (record payment, upload slips, create invoice,
   preview and send a document) and the branded document engine (invoice, payment receipt, deposit statement)
   used by Deposit refunds. One model draws both the on-screen paper and the PDF file, so they always match.
   =================================================================== */

/* ---------------- small helpers ---------------- */
function invMoney(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function invDT(d) { if (!d) return ''; var h = d.getHours(), m = d.getMinutes(); return UI.fmt.date(d) + ', ' + String(h % 12 || 12).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }
function invCo() { return D().company || {}; }
function invBooking(code) { return code ? findBooking(code) : null; }
function invCarLabel(c) { return c ? carModel(c) + ' (' + c.plate + ')' : ''; }
function invPays(code) { return D().payments.filter(function (p) { return p.booking === code; }); }
function invLivePays(code) { return invPays(code).filter(function (p) { return !p.void; }); }
function invReceived(code) { return sum(invLivePays(code).map(function (p) { return p.amount; })); }
function invInvoiceOf(code) { return D().invoices.filter(function (v) { return v.booking === code && v.status !== 'Void'; }).slice(-1)[0] || null; }
function invTotal(iv) { return iv.charges + (iv.tax || 0); }
function invPayOf(r) { return byId(D().payments, r.payment); }
function invStaff() { return D().users.filter(function (u) { return u.active; }).map(function (u) { return u.name; }); }
function invToken(no) { var h = 0; String(no + B().id).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return h.toString(36) + no.slice(-3).toLowerCase(); }
function invLink(no) { return 'https://' + B().slug + '.orbiquefms.com/d/' + invToken(no) + '.pdf'; }
function invWaNumber(p) { var s = String(p || '').replace(/[^\d+]/g, ''); if (!s) return ''; if (s[0] === '+') return s; if (s[0] === '0') return (invCo().countryCode || '+60') + s.slice(1); return '+' + s; }
function invPhoneOk(p) { var s = invWaNumber(p).replace(/\D/g, ''); return s.length >= 9 && s.length <= 15; }
function invNextNo(kind) {
  var co = invCo(), nb = co.numbering || {}, pre = (kind === 'inv' ? nb.invPrefix || 'INV-' : nb.rcpPrefix || 'RCP-') + (nb.resetYearly !== false ? NOW().getFullYear() + '-' : ''), list = kind === 'inv' ? D().invoices : D().receipts, max = 0;
  list.forEach(function (x) { if (x.no.indexOf(pre) === 0) { var n = parseInt(x.no.slice(pre.length), 10); if (n > max) max = n; } });
  return pre + String(max + 1).padStart(nb.digits || 5, '0');
}
/* what the company details still miss before documents go out */
function invMissing() {
  var co = invCo(), m = [];
  if (!co.legal) m.push('Legal name'); if (!co.reg) m.push('Company registration no.'); if (!co.phone) m.push('Phone'); if (!co.address) m.push('Address'); if (!co.email) m.push('Email');
  if (!co.bank || !co.bank.accNo) m.push('Bank account number'); if (co.tax && co.tax.on && !co.tax.regNo) m.push('Tax registration number');
  return m;
}

/* ---------------- logo as a PNG for the PDF ---------------- */
var INV_LOGO = {};
function invLogoSrc() { var co = invCo(), b = B(); if (co.logo) return co.logo; if (b.logoImg) return b.logoImg; return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(b.mark).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ')); }
function invLogoPng() {
  var src = invLogoSrc(), key = B().id + ':' + src.length + ':' + src.slice(-40);
  if (INV_LOGO[key]) return INV_LOGO[key];
  INV_LOGO[key] = new Promise(function (res) {
    var img = new Image();
    img.onload = function () { try { var cv = document.createElement('canvas'), s = 256, r = Math.min(s / img.width, s / img.height) || 1; cv.width = s; cv.height = s; var w = img.width * r, h = img.height * r; cv.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h); res(cv.toDataURL('image/png')); } catch (e) { res(null); } };
    img.onerror = function () { res(null); };
    img.src = src;
  });
  return INV_LOGO[key];
}

/* ===================================================================
   Document models. A model is {title, no, meta, blocks, footer, watermark}; blocks are drawn in order.
   =================================================================== */
function invFrom() {
  var co = invCo(), b = B();
  return { title: 'FROM', lines: [co.trading || b.name, co.legal || b.legal, 'Company Reg. No.: ' + (co.reg || b.reg)].concat(String(co.address || b.address).split(/\n|, (?=\d{5})/)).concat(['Tel: ' + (co.phone || b.phone), co.email || b.email]).concat(co.website ? [co.website] : []) };
}
function invCarBlock(x) {
  var c = x.car;
  return { t: 'car', items: [['Make', c.make], ['Model', c.model.split(' ')[0]], ['Year', String(c.year)], ['Engine capacity', c.cc.toLocaleString('en-US') + ' cc'], ['Colour', c.color], ['Plate number', c.plate]], items2: [['Pick-up', invDT(x.start)], ['Return', invDT(x.end)]] };
}
function invLegalLines(kind) {
  var co = invCo(), b = B();
  return [(co.trading || b.name) + ' is operated by ' + (co.legal || b.legal) + ' (Company Registration No. ' + (co.reg || b.reg) + '), a company duly incorporated and lawfully operating in Malaysia, trading under the brand name ' + (co.trading || b.name) + '.', 'This is a computer-generated ' + kind + '. No signature is required.'];
}
function invFooter(no) { var co = invCo(), b = B(); return { left: (co.trading || b.name) + '  |  ' + no, sub: String(co.address || b.address).replace(/\n/g, ', ') + '  |  ' + (co.email || b.email) }; }

function invInvoiceModel(iv) {
  var x = findBooking(iv.booking), co = invCo(), tax = iv.tax || 0, total = iv.charges + tax, pays = invLivePays(iv.booking), paid = sum(pays.map(function (p) { return p.amount; })), grand = total + (iv.deposit || 0), due = Math.round((grand - paid) * 100) / 100;
  var bank = co.bank || {};
  var blocks = [
    { t: 'parties', from: invFrom(), to: { title: 'BILL TO', lines: [x.cust.name].concat(x.cust.address ? [x.cust.address] : []).concat(['Tel: ' + x.cust.phone, x.cust.email]) } },
    invCarBlock(x),
    { t: 'table', columns: [{ label: 'Description', w: 96 }, { label: 'Qty', w: 14, align: 'right' }, { label: 'Unit price (RM)', w: 34, align: 'right' }, { label: 'Amount (RM)', w: 34, align: 'right' }],
      rows: iv.lines.map(function (l) { return [l.desc, String(l.desc.indexOf('Car rental') === 0 || l.desc.indexOf('Damage') === 0 ? 1 : l.qty), invMoney(l.desc.indexOf('Car rental') === 0 || l.desc.indexOf('Damage') === 0 ? l.amount : l.unit), invMoney(l.amount)]; }) },
    { t: 'totals', left: { title: 'PAYMENT DETAILS', rows: [['Bank', bank.bank || 'Not set'], ['Account name', bank.accName || co.legal || ''], ['Account no.', bank.accNo || 'Not set', 'big']], note: bank.note || 'Please transfer to the account above and send the slip on WhatsApp.' },
      rows: [{ l: 'Subtotal', v: 'RM ' + invMoney(iv.charges) }].concat(tax ? [{ l: (co.tax.name || 'Tax') + ' (' + co.tax.rate + '%)', v: 'RM ' + invMoney(tax) }] : []).concat([{ l: 'Total charges', v: 'RM ' + invMoney(total), style: 'tint' }, { l: 'Security deposit (refundable)', v: 'RM ' + invMoney(iv.deposit || 0) }, { l: 'Total (charges + deposit)', v: 'RM ' + invMoney(grand), style: 'strong' }]),
      note: [tax ? (co.tax.name || 'Tax') + ' is added on the charges only, never on the refundable deposit.' + (co.tax.regNo ? ' Tax reg. no. ' + co.tax.regNo + '.' : '') : 'All amounts are exclusive of SST and other applicable taxes.', 'Deposit is refundable and is not a rental charge.'] }
  ];
  /* "Payments received / Balance due" prints only when the company turns it on (Company details) */
  if (co.invoiceShowPaid) {
    if (pays.length) {
      blocks.push({ t: 'heading', text: 'PAYMENTS RECEIVED' });
      var prow = [];
      pays.forEach(function (p) { invItems(p).forEach(function (it) { prow.push([UI.fmt.date(p.at), it.kind === 'Security deposit' ? 'Security deposit (refundable)' : it.kind, methodLabel(p.method), p.ref || '-', invMoney(it.amount)]); }); });
      blocks.push({ t: 'table', columns: [{ label: 'Paid on', w: 26 }, { label: 'Description', w: 42 }, { label: 'Method', w: 34 }, { label: 'Reference', w: 44 }, { label: 'Amount (RM)', w: 32, align: 'right' }], rows: prow });
    }
    blocks.push({ t: 'totals', rows: [{ l: 'Total paid', v: 'RM ' + invMoney(paid) }, { l: 'Balance due', v: due <= 0 ? 'Paid in full' : 'RM ' + invMoney(due), style: 'strong' }] });
  }
  if (iv.note) blocks.push({ t: 'status', text: iv.note });
  blocks.push({ t: 'end', lines: [(co.footers && co.footers.invoice) || 'Thank you for renting with ' + B().name + '.'].concat(invLegalLines('invoice')) });
  return { kind: 'invoice', title: 'INVOICE', no: iv.no, meta: [['Date', UI.fmt.date(iv.issued)], ['Booking ID', iv.booking]], blocks: blocks, footer: invFooter(iv.no), watermark: iv.status === 'Void' ? 'VOID' : '' };
}
function invReceiptModel(r) {
  /* one receipt per booking: a line for every payment item on it (a voided receipt still shows what it held) */
  var x = findBooking(r.booking), co = invCo(), pays = r.status === 'Void' ? invRcpPays(r) : invRcpLive(r), rows = [], n = 0, total = 0;
  pays.forEach(function (p) { invItems(p).forEach(function (it) { n++; total += it.amount; rows.push([n + '.', it.kind === 'Security deposit' ? 'Security deposit (refundable)' : it.kind, methodLabel(p.method) + (p.method === 'Deposit adjustment' && p.depositOf ? ' (' + p.depositOf + ')' : ''), invDT(p.at), p.ref || '-', invMoney(it.amount)]); }); });
  if (!rows.length) rows.push(['1.', r.kind || 'Payment', r.method || '', invDT(r.issued), '-', invMoney(r.amount)]), total = r.amount;
  total = Math.round(total * 100) / 100;
  var blocks = [
    { t: 'parties', from: invFrom(), to: { title: 'RECEIVED FROM', lines: [x.cust.name, 'Tel: ' + x.cust.phone, x.cust.email] } },
    invCarBlock(x),
    { t: 'table', columns: [{ label: 'Sl.', w: 10 }, { label: 'Description', w: 50 }, { label: 'Method', w: 34 }, { label: 'Paid on', w: 40 }, { label: 'Reference', w: 34 }, { label: 'Amount (RM)', w: 30, align: 'right' }], rows: rows },
    { t: 'amount', label: 'AMOUNT RECEIVED', amount: 'RM ' + invMoney(total), words: UI.fmt.words(total) }
  ];
  var cards = pays.filter(function (p) { return p.method === 'Card' && p.afterCharge; });
  if (cards.length) blocks.splice(3, 0, { t: 'status', text: 'Card payments go through Stripe. After the card charge: RM ' + invMoney(sum(cards.map(function (p) { return p.afterCharge; }))) + '.' });
  if (r.status === 'Void' && r.voidReason) blocks.splice(3, 0, { t: 'status', text: 'Void: ' + r.voidReason });
  blocks.push({ t: 'end', lines: [(co.footers && co.footers.receipt) || 'This receipt was made by computer and needs no signature.'].concat(invLegalLines('receipt')) });
  return { kind: 'receipt', title: 'PAYMENT RECEIPT', no: r.no, meta: [['Date', UI.fmt.long(r.issued)], ['Booking ID', r.booking]].concat(invInvoiceOf(r.booking) ? [['Invoice', invInvoiceOf(r.booking).no]] : []), blocks: blocks, footer: invFooter(r.no), watermark: r.status === 'Void' ? 'VOID' : '' };
}

/* ---------------- the on-screen paper ---------------- */
function invDocHtml(m) {
  var e = esc, out = '<div class="invp-head"><div class="invp-logo">' + (invCo().logo ? '<img src="' + invCo().logo + '" alt="">' : mark(B())) + '<div><b>' + e(invCo().trading || B().name) + '</b><small>' + e(B().tag || '') + '</small></div></div><div class="invp-title"><h1>' + e(m.title) + '</h1><i></i><b>' + e(m.no) + '</b>' + m.meta.map(function (kv) { return '<span><em>' + e(kv[0]) + '</em> ' + e(kv[1]) + '</span>'; }).join('') + '</div></div>';
  m.blocks.forEach(function (bl) {
    if (bl.t === 'parties') out += '<div class="invp-parties">' + [bl.from, bl.to].map(function (p) { return '<div><h4>' + e(p.title) + '</h4>' + p.lines.map(function (l, k) { return k ? '<div>' + e(l) + '</div>' : '<b>' + e(l) + '</b>'; }).join('') + '</div>'; }).join('') + '</div>';
    else if (bl.t === 'car') out += '<div class="invp-car"><h4>CAR</h4><div class="invp-grid">' + bl.items.map(function (kv) { return '<div><em>' + e(kv[0]) + '</em><b>' + e(kv[1]) + '</b></div>'; }).join('') + '</div><div class="invp-grid two">' + bl.items2.map(function (kv) { return '<div><em>' + e(kv[0]) + '</em><b>' + e(kv[1]) + '</b></div>'; }).join('') + '</div></div>';
    else if (bl.t === 'table') out += '<table class="invp-t"><thead><tr>' + bl.columns.map(function (c) { return '<th' + (c.align === 'right' ? ' class="r"' : '') + '>' + e(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' + bl.rows.map(function (r) { return '<tr>' + r.map(function (v, k) { return '<td' + (bl.columns[k].align === 'right' ? ' class="r"' : '') + '>' + e(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    else if (bl.t === 'heading') out += '<h4 class="invp-h">' + e(bl.text) + '</h4>';
    else if (bl.t === 'totals') out += '<div class="invp-tot' + (bl.left ? '' : ' solo') + '">' + (bl.left ? '<div class="invp-pay"><h4>' + e(bl.left.title) + '</h4>' + bl.left.rows.map(function (r) { return '<div><em>' + e(r[0]) + '</em><b' + (r[2] ? ' class="big"' : '') + '>' + e(r[1]) + '</b></div>'; }).join('') + (bl.left.note ? '<p>' + e(bl.left.note) + '</p>' : '') + '</div>' : '') + '<div class="invp-sum">' + bl.rows.map(function (r) { return '<div class="' + (r.style || '') + '"><span>' + e(r.l) + '</span><b>' + e(r.v) + '</b></div>'; }).join('') + (bl.note ? '<p>' + bl.note.map(e).join('<br>') + '</p>' : '') + '</div></div>';
    else if (bl.t === 'sumrows') out += '<div class="invp-sumrows">' + bl.rows.map(function (r) { return '<div><span>' + e(r[0]) + '</span><b>' + e(r[1]) + '</b></div>'; }).join('') + '</div>';
    else if (bl.t === 'status') out += '<div class="invp-status">' + e(bl.text) + '</div>';
    else if (bl.t === 'amount') out += '<div class="invp-amt"><small>' + e(bl.label) + '</small><b>' + e(bl.amount) + '</b><em>' + e(bl.words) + '</em></div>';
    else if (bl.t === 'end') out += '<div class="invp-end">' + bl.lines.map(function (l, k) { return k ? '<p>' + e(l) + '</p>' : '<p class="it">' + e(l) + '</p>'; }).join('') + '</div>';
  });
  out += '<div class="invp-foot"><div><b>' + e(m.footer.left) + '</b><small>' + e(m.footer.sub) + '</small></div><span>Page 1</span></div>';
  return '<div class="invp-wrap"><div class="invp' + (m.watermark ? ' void' : '') + '" data-wm="' + e(m.watermark || '') + '">' + out + '</div></div>';
}
/* scale the A4 paper down to the width of its box */
function invFit(root) {
  (root || document).querySelectorAll('.invp-wrap').forEach(function (w) { var p = w.firstChild, s = Math.min(1, w.clientWidth / 760); p.style.transform = 'scale(' + s + ')'; w.style.height = Math.ceil(p.offsetHeight * s) + 'px'; });
}

/* ---------------- the PDF (jsPDF), drawn from the same model ---------------- */
function invDocPdfBytes(m) {
  return Promise.all([UI.loadScript(UI.LIB.jspdf), invLogoPng()]).then(function (r) {
    var logo = r[1], doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, H = 297, M = 16, y;
    var b = B(), P = C.rgb(C.readable(b.primary, 4.5)), S2 = C.rgb(C.mix(b.secondary, '#000000', C.lum(b.secondary) > .08 ? .55 : 0)), T = C.rgb(C.mix(b.primary, '#FFFFFF', .88)), G = [244, 244, 246];
    var font = function (sz, st, col) { doc.setFont('helvetica', st || 'normal'); doc.setFontSize(sz); var c = col || [30, 30, 36]; doc.setTextColor(c[0], c[1], c[2]); };
    var fill = function (c) { doc.setFillColor(c[0], c[1], c[2]); };
    var draw = function (c, w) { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w || .3); };
    var page = function () { fill(S2); doc.rect(0, 0, W, 5, 'F'); fill(P); doc.rect(0, 5, W, .9, 'F'); fill(S2); doc.rect(0, H - 4, W, 4, 'F'); };
    var need = function (h) { if (y + h > H - 24) { doc.addPage(); page(); y = 16; return true; } return false; };
    page();
    /* head: logo left, title block right */
    if (logo) doc.addImage(logo, 'PNG', M, 13, 24, 24);
    font(12, 'bold'); doc.text(invCo().trading || b.name, M + (logo ? 28 : 0), 22); font(8, 'normal', [110, 110, 120]); if (b.tag) doc.text(doc.splitTextToSize(b.tag, 70), M + (logo ? 28 : 0), 27);
    font(m.title.length > 12 ? 18 : 22, 'bold', [20, 20, 24]); var tw = doc.getTextWidth(m.title) + m.title.length * 1.12; doc.text(m.title, W - M - tw, 24, { charSpace: 1 });
    fill(P); doc.rect(W - M - 24, 27.5, 24, .8, 'F');
    font(11.5, 'bold'); doc.text(m.no, W - M, 35, { align: 'right' });
    y = 40; m.meta.forEach(function (kv) { font(8.5, 'normal', [120, 120, 130]); var vw = doc.getTextWidth(kv[1]) ; font(8.5, 'normal', [30, 30, 36]); vw = doc.getTextWidth(kv[1]); doc.text(kv[1], W - M, y, { align: 'right' }); font(8.5, 'normal', [130, 130, 140]); doc.text(kv[0], W - M - vw - 2, y, { align: 'right' }); y += 4.6; });
    y = Math.max(y, 44) + 6;
    var heading = function (txt, x, yy) { font(7.5, 'bold', P); doc.text(txt, x, yy, { charSpace: .8 }); fill(P); doc.rect(x, yy + 2, 10, .5, 'F'); };
    m.blocks.forEach(function (bl) {
      if (bl.t === 'parties') {
        var cw = (W - 2 * M - 12) / 2, y0 = y, yMax = y;
        [bl.from, bl.to].forEach(function (p, j) { var x = M + j * (cw + 12), yy = y0; heading(p.title, x, yy); yy += 8; p.lines.forEach(function (l, k) { font(k ? 8.6 : 9.2, k ? 'normal' : 'bold', k ? [55, 55, 62] : [25, 25, 30]); var ls = doc.splitTextToSize(l, cw); doc.text(ls, x, yy); yy += ls.length * 4.1; }); yMax = Math.max(yMax, yy); });
        draw([215, 215, 222]); doc.line(M + cw + 6, y0 - 3, M + cw + 6, yMax); y = yMax + 5;
      } else if (bl.t === 'car') {
        need(30); fill(G); doc.rect(M, y, W - 2 * M, 28, 'F'); fill(P); doc.rect(M, y, W - 2 * M, .6, 'F');
        heading('CAR', M + 4, y + 6);
        var cx = [0, 26, 50, 76, 106, 138], cw2 = (W - 2 * M - 8) / 178;
        bl.items.forEach(function (kv, k) { var x = M + 4 + cx[k] * cw2; font(7, 'normal', [125, 125, 135]); doc.text(kv[0], x, y + 13); font(8.6, 'bold'); doc.text(String(kv[1]), x, y + 17.5); });
        draw([220, 220, 226]); doc.line(M + 4, y + 20, W - M - 4, y + 20);
        bl.items2.forEach(function (kv, k) { var x = M + 4 + k * 76 * cw2; font(7, 'normal', [125, 125, 135]); doc.text(kv[0], x, y + 23.5); font(8.6, 'bold'); doc.text(kv[1], x, y + 27); });
        y += 33;
      } else if (bl.t === 'table') {
        var tw = W - 2 * M, tot = bl.columns.reduce(function (a, c) { return a + c.w; }, 0), ws = bl.columns.map(function (c) { return c.w * tw / tot; });
        var head = function () { fill(S2); doc.rect(M, y, tw, 7, 'F'); font(8, 'bold', [255, 255, 255]); var x = M; bl.columns.forEach(function (c, k) { doc.text(c.label, c.align === 'right' ? x + ws[k] - 2 : x + 2, y + 4.7, { align: c.align === 'right' ? 'right' : 'left' }); x += ws[k]; }); y += 7; };
        need(16); head();
        bl.rows.forEach(function (rw, n) {
          font(8.4); var cells = rw.map(function (v, k) { return doc.splitTextToSize(String(v), ws[k] - 4); }), h = Math.max.apply(0, cells.map(function (c) { return c.length; })) * 3.9 + 3.2;
          if (need(h)) head();
          if (n % 2) { fill([247, 247, 249]); doc.rect(M, y, tw, h, 'F'); }
          var x = M; font(8.4, 'normal', [35, 35, 42]); cells.forEach(function (c, k) { var al = bl.columns[k].align === 'right'; doc.text(c, al ? x + ws[k] - 2 : x + 2, y + 4.5, { align: al ? 'right' : 'left' }); x += ws[k]; });
          y += h;
        });
        draw([40, 40, 46], .35); doc.line(M, y, W - M, y); y += 5;
      } else if (bl.t === 'heading') { need(14); heading(bl.text, M, y + 2); y += 8; }
      else if (bl.t === 'totals') {
        var sx = bl.left ? M + (W - 2 * M) * .5 + 4 : M + (W - 2 * M) * .5 + 4, sw = W - M - sx, y0 = y, ly = y;
        need(bl.left ? 46 : 18);
        y0 = y;
        if (bl.left) {
          var lw = (W - 2 * M) * .5 - 4, lh = 14 + bl.left.rows.length * 6.5 + (bl.left.note ? 10 : 0);
          fill(G); doc.rect(M, y0, lw, lh, 'F'); fill(P); doc.rect(M, y0, 1, lh, 'F');
          heading(bl.left.title, M + 6, y0 + 6); ly = y0 + 13;
          bl.left.rows.forEach(function (r) { font(7.8, 'normal', [125, 125, 135]); doc.text(r[0], M + 6, ly); font(r[2] ? 12 : 8.4, 'bold', [25, 25, 30]); doc.text(doc.splitTextToSize(r[1], lw - 36)[0], M + 32, ly + (r[2] ? .8 : 0)); ly += 6.5; });
          if (bl.left.note) { font(7.6, 'italic', [110, 110, 120]); doc.text(doc.splitTextToSize(bl.left.note, lw - 12), M + 6, ly + 1); }
          ly = y0 + lh;
        }
        var ry = y0;
        bl.rows.forEach(function (r) {
          if (r.style === 'tint') { fill(T); doc.rect(sx, ry, sw, 7.5, 'F'); }
          if (r.style === 'strong') { fill(P); doc.rect(sx, ry, sw, 7.5, 'F'); }
          font(r.style ? 9.4 : 8.6, r.style ? 'bold' : 'normal', r.style === 'strong' ? [255, 255, 255] : [30, 30, 36]);
          doc.text(r.l, sx + 2.5, ry + 5); doc.text(r.v, W - M - 2.5, ry + 5, { align: 'right' }); ry += 8;
        });
        if (bl.note) { font(7.2, 'italic', [120, 120, 130]); bl.note.forEach(function (n) { doc.text(n, W - M, ry + 3, { align: 'right' }); ry += 3.6; }); }
        y = Math.max(ly, ry) + 7;
      } else if (bl.t === 'sumrows') {
        bl.rows.forEach(function (r) { need(6); font(8.8); doc.text(r[0], M + 2, y); doc.text(r[1], W - M - 2, y, { align: 'right' }); y += 5.2; }); y += 3;
      } else if (bl.t === 'status') {
        font(8.8); var ls = doc.splitTextToSize(bl.text, W - 2 * M - 12), h2 = ls.length * 4.2 + 6; need(h2 + 4);
        fill(G); doc.rect(M, y, W - 2 * M, h2, 'F'); fill(S2); doc.rect(M, y, 1.2, h2, 'F'); font(8.8, 'normal', [35, 35, 42]); doc.text(ls, M + 6, y + 5.2); y += h2 + 5;
      } else if (bl.t === 'amount') {
        need(32); fill(S2); doc.rect(M, y, W - 2 * M, 28, 'F'); fill(P); doc.rect(M, y, 1.6, 28, 'F');
        font(7.8, 'bold', [255, 255, 255]); doc.text(bl.label, M + 8, y + 7.5, { charSpace: .4 });
        font(20, 'bold', [255, 255, 255]); doc.text(bl.amount, M + 8, y + 17);
        font(8.6, 'italic', [225, 225, 230]); doc.text(doc.splitTextToSize(bl.words, W - 2 * M - 16), M + 8, y + 23.5); y += 34;
      } else if (bl.t === 'end') {
        need(24); draw([40, 40, 46], .3); doc.line(M, y, W - M, y); y += 5;
        bl.lines.forEach(function (l, k) { font(k ? 7.2 : 8.4, k ? 'normal' : 'italic', k ? [120, 120, 130] : [95, 95, 105]); var ls = doc.splitTextToSize(l, W - 2 * M - 10); doc.text(ls, W / 2, y, { align: 'center' }); y += ls.length * 3.5 + 1.6; });
      }
    });
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p); draw(P, .4); doc.line(M, H - 19, W - M, H - 19);
      font(7.8, 'bold', [25, 25, 30]); doc.text(m.footer.left, M, H - 14.5); font(6.8, 'normal', [125, 125, 135]); doc.text(doc.splitTextToSize(m.footer.sub, 150)[0], M, H - 10.8);
      font(7.6, 'normal', [40, 40, 46]); doc.text('Page ' + p + ' of ' + n, W - M, H - 14.5, { align: 'right' });
      if (m.watermark) { if (doc.GState) { doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: .14 })); } font(96, 'bold', [200, 30, 40]); doc.text(m.watermark, W / 2 + 10, H / 2 + 20, { align: 'center', angle: 35 }); if (doc.GState) doc.restoreGraphicsState(); }
    }
    doc.setProperties({ title: m.title + ' ' + m.no, author: invCo().trading || b.name, creator: 'Orbique FMS' });
    return doc.output('arraybuffer');
  });
}
function invDocPdf(m, filename) {
  UI.toast('Preparing ' + (filename || m.no + '.pdf') + '...', { tone: 'info', ms: 1400 });
  return invDocPdfBytes(m).then(function (bytes) { return UI.download({ filename: filename || m.no + '.pdf', data: bytes, mime: 'application/pdf' }); }, function () { UI.toast('The PDF tool could not load. Check the connection and try again.', { tone: 'bad' }); return 'error'; });
}
function invOpenTab(m) {
  invDocPdfBytes(m).then(function (bytes) {
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), w = null;
    try { w = window.open(url, '_blank', 'noopener'); } catch (e) { w = null; }
    if (!w) UI.toast('This viewer blocks new tabs. Use Download instead.', { tone: 'warn' });
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }, function () { UI.toast('The PDF tool could not load.', { tone: 'bad' }); });
}

/* ---------------- document lookups ---------------- */
function invDoc(no) { return /^RCP|receipt/i.test(no) || D().receipts.some(function (r) { return r.no === no; }) ? byId(D().receipts, no) : byId(D().invoices, no); }
function invModel(no) { var x = invDoc(no); if (!x) return null; return D().receipts.indexOf(x) >= 0 ? invReceiptModel(x) : invInvoiceModel(x); }
function invIsReceipt(x) { return D().receipts.indexOf(x) >= 0; }

/* ===================================================================
   Dialogs shared with Bookings (through API)
   =================================================================== */
/* preview: the paper, with Open in new tab, Download, Send */
function invPreview(no) {
  var x = invDoc(no); if (!x) { UI.toast('Document ' + no + ' was not found', { tone: 'warn' }); return; }
  var rec = invIsReceipt(x);
  var dl = UI.dialog({ title: (rec ? 'Payment receipt ' : 'Invoice ') + x.no, width: 'lg', subHtml: true, subtitle: UI.status('doc', x.status) + ' <span class="b2">' + esc(findBooking(x.booking).cust.name) + ' · ' + esc(x.booking) + '</span>',
    body: function (el) { el.classList.add('inv-prevb'); setTimeout(function () { invFit(el); }, 0); return invDocHtml(invModel(x.no)); },
    buttons: [{ label: 'Open in new tab', kind: 't', icon: 'external-link', close: false, onClick: function () { invOpenTab(invModel(x.no)); } }, { spacer: true }, { label: 'Close', kind: 'g' },
      { label: 'Download', kind: 'o', icon: 'download', close: false, onClick: function () { invDocPdf(invModel(x.no)); invLogSent(x, 'Download', ''); } },
      { label: 'Send', icon: 'send', disabled: x.status === 'Void' || !can('billing.send'), title: x.status === 'Void' ? 'A void document cannot be sent' : '', onClick: function () { invSend(x.no); } }] });
  return dl;
}
function invLogSent(x, channel, to, ok, err) {
  var list = (x.sent || []).slice(); list.push({ channel: channel, to: to || '', at: NOW(), by: me().name, ok: ok !== false, error: err || '' });
  DB.update(invIsReceipt(x) ? 'receipts' : 'invoices', x, { sent: list }, { action: channel === 'Download' ? 'Viewed a document' : 'Sent', text: me().name + (channel === 'Download' ? ' downloaded ' : ' sent ') + (invIsReceipt(x) ? 'receipt ' : 'invoice ') + x.no + (channel === 'Download' ? '' : ' by ' + channel + (to ? ' to ' + to : '')) });
}
function invChannelIcon(ch) { return { WhatsApp: 'brand-whatsapp', 'Open in WhatsApp': 'brand-whatsapp', Email: 'mail', Download: 'download' }[ch] || 'send'; }
/* send: WhatsApp from the business number, open WhatsApp, email, download */
function invSend(no, opts) {
  var x = invDoc(no); if (!x) return;
  if (x.status === 'Void') { UI.toast('A void document cannot be sent', { tone: 'warn' }); return; }
  var rec = invIsReceipt(x), bk = findBooking(x.booking), first = bk.cust.name.split(' ')[0], st = { ch: 'wa', phone: bk.cust.phone, email: bk.cust.email };
  var msg = 'Hi ' + first + ', here is your ' + (rec ? 'payment receipt ' : 'invoice ') + x.no + ' from ' + B().name + ': {url}';
  st.msg = msg;
  var chans = [['wa', 'WhatsApp from the business number', 'The PDF is sent straight from the company WhatsApp number.', 'brand-whatsapp'], ['open', 'Open in WhatsApp', 'Opens WhatsApp with the message and a link to the PDF. You press send there.', 'external-link'], ['email', 'Email', 'Sends an email with the PDF attached.', 'mail'], ['download', 'Download the PDF', 'Saves the PDF to this computer so you can send it yourself.', 'download']];
  var btnLabel = function () { return { wa: 'Send on WhatsApp', open: 'Open WhatsApp', email: 'Send email', download: 'Download PDF' }[st.ch]; };
  var body = function () {
    var ph = invWaNumber(st.phone), okp = invPhoneOk(st.phone);
    return '<div class="inv-radios" role="radiogroup">' + chans.map(function (c) { return '<button type="button" role="radio" class="inv-radio" data-ch="' + c[0] + '" aria-checked="' + (st.ch === c[0]) + '">' + i(c[3]) + '<span><b>' + c[1] + '</b><small>' + c[2] + '</small></span></button>'; }).join('') + '</div>' +
      (st.ch === 'wa' || st.ch === 'open' ? UI.input({ key: 'phone', label: 'Customer phone', value: st.phone, help: okp ? 'WhatsApp number: ' + ph + '. Changing it here does not change the booking.' : '', error: okp ? '' : 'This does not look like a phone number. Check it before sending.' }) : '') +
      (st.ch === 'email' ? UI.input({ key: 'email', label: 'Customer email', type: 'email', value: st.email }) : '') +
      (st.ch !== 'download' ? UI.textarea({ key: 'msg', label: 'Message', rows: 3, value: st.msg, help: st.ch === 'email' ? 'Leave blank to use the standard message. {url} is replaced with the link to the PDF.' : '{url} is replaced with the link to the PDF (valid for 14 days).' }) : '') +
      '<div class="inv-sent"><h4>SENT BEFORE</h4>' + ((x.sent || []).length ? (x.sent || []).slice().reverse().map(function (s) { return '<div class="inv-sent-r">' + i(invChannelIcon(s.channel)) + '<span class="grow"><b>' + esc(s.channel) + (s.to ? ' · ' + esc(s.to) : '') + '</b><small>' + esc(invDT(s.at)) + ' by ' + esc(s.by || '') + (s.error ? ' · ' + esc(s.error) : '') + '</small></span>' + UI.chip(s.ok === false ? 'Failed' : 'Sent', s.ok === false ? 'bad' : 'ok') + '</div>'; }).join('') : '<p class="b2">Not sent yet.</p>') + '</div>';
  };
  var keep = function (dl) { var f = UI.form(dl.body); if (f.phone != null) st.phone = f.phone; if (f.email != null) st.email = f.email; if (f.msg != null) st.msg = f.msg; };
  var send = function (d) {
    keep(d);
    var url = invLink(x.no), text = (st.msg || msg).replace('{url}', url);
    if (st.ch === 'download') { invDocPdf(invModel(x.no)); invLogSent(x, 'Download', ''); return; }
    if (st.ch === 'email') { if (!/^\S+@\S+\.\S+$/.test(st.email || '')) { UI.toast('Type the customer email', { tone: 'warn' }); return false; } invLogSent(x, 'Email', st.email); UI.toast('Email with ' + x.no + '.pdf sent to ' + st.email + ' (sample: no real email leaves this page)'); return; }
    if (!invPhoneOk(st.phone)) { UI.toast('Check the phone number first', { tone: 'warn' }); return false; }
    if (st.ch === 'open') { try { window.open('https://wa.me/' + invWaNumber(st.phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); } catch (e) { /* blocked by the viewer */ } invLogSent(x, 'Open in WhatsApp', invWaNumber(st.phone)); UI.toast('WhatsApp opened with the message. Press send there.'); return; }
    invLogSent(x, 'WhatsApp', invWaNumber(st.phone)); UI.toast(x.no + ' sent on WhatsApp to ' + invWaNumber(st.phone) + ' from the business number (sample)');
  };
  var foot = function () { return [{ label: 'Close', kind: 'g' }, { label: btnLabel(), icon: st.ch === 'download' ? 'download' : 'send', onClick: send }]; };
  if (opts && opts.channel) st.ch = opts.channel;
  var dl = UI.dialog({ title: 'Send ' + (rec ? 'payment receipt ' : 'invoice ') + x.no, subtitle: bk.cust.name + ' · ' + bk.code, width: 'md', body: body, buttons: foot() });
  dl.body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-ch]'); if (!b) return; keep(dl); st.ch = b.getAttribute('data-ch'); dl.refresh(); dl.setFoot(foot()); });
  dl.body.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-key') === 'phone') { keep(dl); var h = ev.target.closest('.inp').querySelector('.help,.ui-err'); if (h) { h.className = invPhoneOk(st.phone) ? 'help' : 'ui-err'; h.textContent = invPhoneOk(st.phone) ? 'WhatsApp number: ' + invWaNumber(st.phone) + '. Changing it here does not change the booking.' : 'This does not look like a phone number. Check it before sending.'; } } });
  return dl;
}

/* ===================================================================
   Money rules shared by the dialogs: payment items, what a booking expects, slips already used
   =================================================================== */
var INV_KINDS = ['Security deposit', 'Rental payment', 'Delivery charge', 'Return charge', 'Damage coverage', 'Extension payment', 'Other payment'];
var INV_SEP = { 'Delivery charge': 'deliv', 'Return charge': 'ret', 'Damage coverage': 'dmg' };   /* charges a booking can be paid for on their own */
var INV_DUP_MS = 90 * 1000;   /* the same payment again within 90 seconds (a double click, a retry) is the same payment */
function invR2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function invItems(p) { return p && p.items && p.items.length ? p.items : [{ kind: p.kind, amount: p.amount }]; }
function invPaidByKind(code) { var o = {}; invLivePays(code).forEach(function (p) { invItems(p).forEach(function (it) { o[it.kind] = (o[it.kind] || 0) + it.amount; }); }); return o; }
function invDueOf(x) { return Math.max(0, invR2((x.payable || 0) - invReceived(x.code))); }
function invKindsText(p) { var k = invItems(p).map(function (it) { return it.kind; }); return k.length > 2 ? k[0] + ' and ' + (k.length - 1) + ' more' : k.join(' + '); }
/* the booking's charges without the deposit: the live invoice's total when there is one */
function invCharges(x) { var iv = invInvoiceOf(x.code); return iv ? invTotal(iv) : Math.max(0, (x.payable || 0) - (x.dep || 0)); }
/* what is still due for each kind: the deposit and each separate charge less what was already paid for it; rent is the
   charges less every separate charge (paid or ticked beside it, so rent + delivery never counts the delivery twice) less
   the rent already paid. Extension and other are never checked. Nothing goes below zero. */
function invFigures(x, kinds) {
  var by = invPaidByKind(x.code), f = {}, sepLeft = 0;
  f['Security deposit'] = Math.max(0, invR2((x.dep || 0) - (by['Security deposit'] || 0)));
  Object.keys(INV_SEP).forEach(function (k) {
    var full = x[INV_SEP[k]] || 0, left = Math.max(0, invR2(full - (by[k] || 0)));
    f[k] = left;
    /* a separate charge counts against the rent when it is paid on its own, or ticked to be paid on its own now */
    sepLeft += (by[k] || 0) + ((kinds || []).indexOf(k) >= 0 ? left : 0);
  });
  f['Rental payment'] = Math.max(0, invR2(invCharges(x) - sepLeft - (by['Rental payment'] || 0)));
  return f;
}
/* the amount an item starts with: what is still due for it, and never more than the booking's whole balance */
function invItemSuggest(x, kind, ticked) {
  if (!x || kind === 'Extension payment' || kind === 'Other payment') return '';
  var t = ticked || [], f = invFigures(x, t), v = f[kind] || 0;
  if (kind === 'Rental payment') { var others = t.reduce(function (s, k) { return s + (k !== kind && f[k] != null ? f[k] : 0); }, 0); v = Math.min(v, Math.max(0, invDueOf(x) - others)); }
  return v > 0 ? invR2(v).toFixed(2) : '';
}
function invOverLines(lines, fig, slack) {
  return lines.filter(function (l) { return fig[l.kind] != null && l.amount > fig[l.kind] + ((slack || {})[l.kind] || 0) + .004; }).map(function (l) { return { kind: l.kind, booking: fig[l.kind], paying: l.amount }; });
}
/* every line over what is still due for it, and the whole payment over the booking's balance (extension and other
   payments are extra charges, so they never count against the balance) */
function invOverAll(x, lines, slack) {
  var over = invOverLines(lines, invFigures(x, lines.map(function (l) { return l.kind; })), slack);
  if (!over.length) {
    var counted = invR2(sum(lines.filter(function (l) { return l.kind !== 'Extension payment' && l.kind !== 'Other payment'; }).map(function (l) { return l.amount; }))), due = invDueOf(x);
    if (counted > due + ((slack || {})['Rental payment'] || 0) + .004) over = [{ kind: 'Total', booking: due, paying: counted }];
  }
  return over;
}
/* the big stop before recording more than the booking says. "Go back and check" is the default. Resolves true to record. */
function invOverAsk(over, context) {
  return new Promise(function (res) {
    var one = over.length === 1 ? over[0] : null, done = false, fin = function (v) { if (!done) { done = true; res(v); } };
    var body = '<div class="inv-over-h">' + i('alert-triangle') + '<p>' + (one ? (one.kind === 'Total' ? 'The booking has <b>' + UI.fmt.money(one.booking) + '</b> still due in all.' : 'The ' + esc(one.kind.toLowerCase()) + ' still due on this booking is <b>' + UI.fmt.money(one.booking) + '</b>.') + ' Are you sure you want to record <b>' + UI.fmt.money(one.paying) + '</b>' + (one.kind === 'Total' ? '' : ' as ' + esc(one.kind.toLowerCase())) + '?' : 'These amounts are more than the booking still has due. Are you sure you want to record them?') + '</p></div>' +
      '<ul class="inv-over-l">' + over.map(function (l) { return '<li><b>' + esc(l.kind) + '</b>: still due ' + UI.fmt.money(l.booking) + ', you are recording <b>' + UI.fmt.money(l.paying) + '</b> (' + UI.fmt.money(l.paying - l.booking) + ' more)</li>'; }).join('') + '</ul>';
    var d = UI.dialog({ title: 'More than the booking says', subtitle: context || '', width: 'md', alert: true, body: body, onClose: function () { fin(false); },
      buttons: [{ label: 'Yes, record anyway', kind: 'o', cls: 'inv-over-yes', onClick: function () { fin(true); } }, { label: 'Go back and check', icon: 'arrow-back-up', onClick: function () { fin(false); } }] });
    d.el.classList.add('inv-over');
    setTimeout(function () { var b = d.el.querySelector('.ui-dlg-f button:last-child'); if (b) b.focus(); }, 60);
  });
}

/* ---------------- the same slip twice: a file or a reference already on an active payment or refund is refused ---------------- */
function invHash(str) { var h = 0x811c9dc5; str = String(str || ''); for (var k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16) + '-' + str.length; }
function invSlipHash(s) { if (!s) return ''; if (s.hash) return s.hash; return s.dataUrl ? (s.hash = invHash(s.dataUrl)) : 'n:' + s.name + ':' + (s.size || 0); }
/* the reference as compared: letters and digits only, upper case; too short or without a digit ("cash", "ok") never counts */
function invRefKey(t) { var k = String(t || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); return k.length >= 6 && /\d/.test(k) ? k : ''; }
function invRefUsed(ref, o) {
  o = o || {}; var key = invRefKey(ref), hit = null; if (!key) return null;
  D().payments.some(function (p) { if (p.void || p.method === 'Deposit adjustment' || p.id === o.exceptPayment || invRefKey(p.ref) !== key) return false; hit = { what: 'payment', booking: p.booking, at: p.at, payment: p.id, ref: p.ref }; return true; });
  if (!hit) (D().deposits || []).some(function (z) { var r = z.refund; if (!r || r.method === 'None' || z.booking === o.refundOf || invRefKey(r.ref) !== key) return false; hit = { what: 'refund', booking: z.booking, at: r.at, ref: r.ref }; return true; });
  return hit;
}
function invSlipUsed(hash, o) {
  o = o || {}; var hit = null; if (!hash) return null;
  D().payments.some(function (p) { if (p.void || p.id === o.exceptPayment) return false; return (p.slips || []).some(function (s) { if (invSlipHash(s) !== hash) return false; hit = { what: 'payment', booking: p.booking, at: p.at, payment: p.id }; return true; }); });
  if (!hit) (D().deposits || []).some(function (z) { var r = z.refund; if (!r || !r.slip || z.booking === o.refundOf || invSlipHash(r.slip) !== hash) return false; hit = { what: 'refund', booking: z.booking, at: r.at }; return true; });
  return hit;
}
function invUsedText(f) { return 'This slip was already recorded on ' + f.booking + ' on ' + UI.fmt.date(f.at) + (f.what === 'refund' ? ' (a deposit refund)' : '') + (f.ref ? ', reference ' + f.ref : '') + '. The same slip cannot be recorded twice.'; }
function invUsedHtml(f) { return f ? UI.alert(invUsedText(f), 'bad', { icon: 'copy-off', action: UI.btn(f.what === 'refund' ? 'Open the refund' : 'Open it', { kind: 't', size: 'sm', attrs: { 'data-used-open': f.what + '|' + f.booking + '|' + (f.payment || '') } }) }) : ''; }
function invUsedOpen(v) {
  var pr = String(v).split('|');
  if (pr[0] === 'refund') { if (API.openDeposit) API.openDeposit(pr[1]); return; }
  if (pr[0] === 'bank-in') { var bi = byId(D().bankIns || [], pr[2]); if (bi) invBankInSlip(bi); return; }
  var p = byId(D().payments, pr[2]);
  if (p && p.receipt) invPreview(p.receipt); else if (p && (p.slips || []).length) invSlipViewer(p); else API.openBooking(pr[1]);
}
/* any element holding an "Open it" link gets this */
function invUsedWire(el) { el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-used-open]'); if (b) { ev.stopPropagation(); invUsedOpen(b.getAttribute('data-used-open')); } }); }

/* ---------------- receipts: one per booking, a line per payment ---------------- */
function invIsSummonsRcp(r) { return invRcpPays(r).some(function (p) { return !!p.summons; }); }
function invRcpPays(r) { return (r.payments || (r.payment ? [r.payment] : [])).map(function (id) { return byId(D().payments, id); }).filter(Boolean); }
function invRcpLive(r) { return invRcpPays(r).filter(function (p) { return !p.void; }); }
function invPayOf(r) { return invRcpPays(r)[0] || null; }
function invBookingReceipt(code) { return D().receipts.filter(function (r) { return r.booking === code && r.status !== 'Void' && !invIsSummonsRcp(r); }).slice(-1)[0] || null; }
function invRcpSum(pays) {
  var kinds = [], methods = [];
  pays.forEach(function (p) { invItems(p).forEach(function (it) { if (kinds.indexOf(it.kind) < 0) kinds.push(it.kind); }); var m = methodLabel(p.method); if (methods.indexOf(m) < 0) methods.push(m); });
  return { amount: invR2(sum(pays.map(function (p) { return p.amount; }))), kind: kinds.length > 2 ? kinds[0] + ' and ' + (kinds.length - 1) + ' more' : kinds.join(' + '), method: methods.join(' + ') };
}
/* put a payment on its booking's receipt, or start the receipt (a summons fine keeps a receipt of its own) */
function invMakeReceipt(p, quiet) {
  var r = p.summons ? null : invBookingReceipt(p.booking);
  if (r) {
    var ids = (r.payments || [r.payment]).filter(function (id) { return id !== p.id; }).concat([p.id]), s = invRcpSum(ids.map(function (id) { return byId(D().payments, id); }).filter(function (q) { return q && !q.void; }));
    DB.update('receipts', r, { payments: ids, amount: s.amount, kind: s.kind, method: s.method }, { where: 'Receipt', text: me().name + ' added ' + UI.fmt.money(p.amount) + ' to receipt ' + r.no + ' on ' + p.booking });
    DB.update('payments', p, { receipt: r.no }, { silent: true });
    if (!quiet) UI.toast('Added to receipt ' + r.no);
    return r;
  }
  var no = invNextNo('rcp'), s2 = invRcpSum([p]);
  r = DB.add('receipts', { id: no, no: no, payment: p.id, payments: [p.id], booking: p.booking, issued: NOW(), amount: s2.amount, kind: s2.kind, method: s2.method, status: 'Issued', voidReason: '', sent: [] }, { where: 'Receipt', text: me().name + ' created receipt ' + no + ' for ' + UI.fmt.money(p.amount) + ' on ' + p.booking });
  DB.update('payments', p, { receipt: no }, { silent: true });
  if (!quiet) UI.toast('Receipt ' + no + ' created');
  return r;
}
/* after a payment is voided: it drops off its receipt; a receipt with nothing left is voided */
function invRcpAfterVoid(p, reason) {
  var r = p.receipt ? byId(D().receipts, p.receipt) : null; if (!r || r.status === 'Void') return null;
  var live = invRcpLive(r);
  if (!live.length) { DB.update('receipts', r, { status: 'Void', voidReason: 'Every payment on it was voided: ' + reason, voidAt: NOW(), voidBy: me().name }, { silent: true }); return { voided: true, no: r.no }; }
  var s = invRcpSum(live); DB.update('receipts', r, { amount: s.amount, kind: s.kind, method: s.method }, { silent: true });
  return { voided: false, no: r.no };
}
/* re-issue: the old receipt is voided with a reason, a new number carries the same payments */
function invReissue(r) {
  if (!can('billing.issue_receipt')) { UI.toast('You cannot issue receipts.', { tone: 'warn' }); return; }
  var live = invRcpLive(r);
  if (!live.length) { UI.toast('Every payment on this receipt is voided, so there is nothing to re-issue.', { tone: 'warn' }); return; }
  UI.confirm({ title: 'Re-issue receipt ' + r.no + '?', text: 'Use this after correcting the customer\'s name or the company details. ' + r.no + ' is voided with your reason and a new receipt with a new number takes its place.', ok: 'Re-issue', width: 'md', input: { label: 'Why is it re-issued?', placeholder: 'For example: the customer\'s name was spelt wrong', required: true } }).then(function (reason) {
    if (!reason) return;
    var no = invNextNo('rcp'), s = invRcpSum(live);
    DB.update('receipts', r, { status: 'Void', voidReason: 'Re-issued as ' + no + ': ' + reason, voidAt: NOW(), voidBy: me().name }, { action: 'Changed', where: 'Receipt', text: me().name + ' re-issued receipt ' + r.no + ' as ' + no + ': ' + reason });
    var n = DB.add('receipts', { id: no, no: no, payment: live[0].id, payments: live.map(function (p) { return p.id; }), booking: r.booking, issued: NOW(), amount: s.amount, kind: s.kind, method: s.method, status: 'Issued', voidReason: '', sent: [], replaces: r.no }, { where: 'Receipt', text: me().name + ' created receipt ' + no + ' in place of ' + r.no });
    live.forEach(function (p) { DB.update('payments', p, { receipt: no }, { silent: true }); });
    UI.toast('Receipt ' + no + ' issued in place of ' + r.no, { action: { label: 'Preview', run: function () { invPreview(no); } } });
    return n;
  });
}

/* ---------------- void (invoice, receipt, payment) ---------------- */
function invVoid(kind, rec) {
  if (kind === 'payment') return invVoidPayment(rec);
  var info = kind === 'invoice' ? 'You can create a new invoice for the booking afterwards.' : 'The payments stay recorded. The next payment on this booking starts a new receipt, or use Re-issue instead to replace it with a new number.';
  return UI.confirm({ title: 'Void ' + kind, text: 'Void ' + kind + ' ' + rec.no + '? It stays on record, marked VOID, and cannot be sent again.', html: UI.alert(info, 'info'), ok: 'Void', danger: true, width: 'md', input: { label: 'Reason', placeholder: 'For example: wrong customer name', required: true } }).then(function (reason) {
    if (!reason) return false;
    DB.update(kind === 'invoice' ? 'invoices' : 'receipts', rec, { status: 'Void', voidReason: reason, voidAt: NOW(), voidBy: me().name }, { action: 'Changed', text: me().name + ' voided ' + kind + ' ' + rec.no + ': ' + reason });
    UI.toast((kind === 'invoice' ? 'Invoice ' : 'Receipt ') + rec.no + ' voided');
    return true;
  });
}
function invVoidPayment(p) {
  var x = findBooking(p.booking), src = p.method === 'Deposit adjustment' ? (p.depositOf || p.booking) : null, z = src ? byId(D().deposits, 'dep-' + src) : null;
  if (src && z && z.refund) {
    UI.dialog({ title: 'This payment cannot be voided yet', width: 'sm', body: UI.alert('This payment came from the deposit of ' + src + ', which is already returned. Reopen that deposit refund first, then void the payment.', 'warn'), buttons: [{ label: 'Close', kind: 'g' }, { label: 'Open the deposit', icon: 'external-link', onClick: function () { if (API.openDeposit) API.openDeposit(src); } }] });
    return Promise.resolve(false);
  }
  /* what the void changes, worked out before asking */
  var keep = p.void; p.void = { at: NOW() }; var back = depositDueAfterVoid(x); p.void = keep;
  var r = p.receipt ? byId(D().receipts, p.receipt) : null, others = r && r.status !== 'Void' ? invRcpLive(r).filter(function (q) { return q !== p; }).length : 0;
  var lines = [];
  if (r && r.status !== 'Void') lines.push(others ? 'It drops off receipt ' + r.no + ', which keeps ' + (others === 1 ? 'its other payment' : 'its other ' + others + ' payments') + '.' : 'Receipt ' + r.no + ' is voided too: this is its only payment.');
  lines.push(back ? 'The booking goes back to Deposit due, because its deposit is no longer fully recorded.' : 'The booking\'s payment status stays ' + (x.pay || 'as it is') + '.');
  if (src) lines.push(UI.fmt.money(p.amount) + ' goes back to the deposit of ' + src + '.');
  return UI.confirm({ title: 'Void payment', text: 'Void the payment of ' + UI.fmt.money(p.amount) + ' (' + invKindsText(p) + ') on ' + p.booking + '? It stays on record, marked VOID.', html: UI.alert(lines.join(' '), back ? 'warn' : 'info', { html: false }), ok: 'Void payment', danger: true, width: 'md', input: { label: 'Reason', placeholder: 'For example: recorded twice by mistake', required: true } }).then(function (reason) {
    if (!reason) return false;
    DB.update('payments', p, { void: { at: NOW(), by: me().name, reason: reason } }, { action: 'Changed', where: 'Payment', text: me().name + ' voided the payment of ' + UI.fmt.money(p.amount) + ' on ' + p.booking + ': ' + reason });
    invRcpAfterVoid(p, reason);
    var patch = { received: invReceived(x.code) }, ns = depositDueAfterVoid(x);
    if (ns) patch.pay = ns;
    DB.update('bookings', x, patch, { silent: !ns, text: me().name + ' changed the payment status of ' + x.code + ' to ' + ns + ' (a deposit payment was voided)' });
    if (src) depGiveBack(src, p);
    UI.toast('Payment voided.' + (ns ? ' ' + x.code + ' is Deposit due again.' : ''));
    return true;
  });
}

/* redraw a form after a field changed without losing the field the person tabbed or tapped into next */
function invRedrawSoon(root, redraw) {
  setTimeout(function () {
    var a = document.activeElement, sel = null, idx = 0;
    if (a && root.contains(a) && (a.tagName !== 'BUTTON' || a.getAttribute('data-how'))) {
      sel = a.getAttribute('data-how') ? '[data-how="' + a.getAttribute('data-how') + '"]' : a.getAttribute('data-key') ? '[data-key="' + a.getAttribute('data-key') + '"]' : a.getAttribute('data-xk') ? '[data-xk="' + a.getAttribute('data-xk') + '"]' : a.id ? '#' + a.id : null;
      if (sel) idx = [].indexOf.call(root.querySelectorAll(sel), a);
    }
    redraw();
    if (!sel) return;
    var n = root.querySelectorAll(sel)[Math.max(0, idx)];
    if (n && n.focus) n.focus();
  }, 0);
}
/* ---------------- recording a payment (one place for the dialog, the slips and other pages) ---------------- */
function invDoRecord(o) {
  var x = findBooking(o.booking), items = o.items.map(function (it) { return { kind: it.kind, amount: invR2(it.amount) }; }), total = invR2(sum(items.map(function (it) { return it.amount; }))), fromDep = o.method === 'Deposit adjustment';
  var staff = !fromDep && (o.depositedTo || '').indexOf('Cash to ') === 0 ? o.depositedTo.slice(8) : null;
  var p = DB.add('payments', { booking: x.code, kind: items[0].kind, amount: total, method: o.method, at: o.at || NOW(), by: me().name, depositedTo: fromDep ? '' : o.depositedTo, heldBy: o.method === 'Cash' ? staff || me().name : null, afterCharge: o.method === 'Card' ? o.afterCharge : null, ref: fromDep ? '' : o.ref || '', note: o.note || '', receipt: null, void: null, banked: null, slips: o.slips || [], items: items, depositOf: fromDep ? o.depositOf || x.code : null, createdAt: NOW() },
    { where: 'Payment', text: me().name + ' recorded a payment of ' + UI.fmt.money(total) + ' (' + items.map(function (it) { return it.kind; }).join(', ') + ', ' + methodLabel(o.method) + ') on ' + x.code });
  var dep = null;
  if (fromDep) dep = depUse(o.depositOf || x.code, p);
  var r = o.receipt !== false ? invMakeReceipt(p, true) : null;
  var before = x.pay, patch = { received: invReceived(x.code) }, ns = o.updateStatus ? payStatusAfter(x, p) : null;
  if (ns && ns !== before) patch.pay = ns;
  DB.update('bookings', x, patch, { silent: !patch.pay, text: me().name + ' changed the payment status of ' + x.code + ' to ' + (patch.pay || x.pay) });
  return { payment: p, receipt: r, statusChanged: patch.pay || null, deposit: dep };
}
/* the same payment again within 90 seconds by the same person: the first one stands */
function invRecentDup(o) {
  var key = function (items) { return items.map(function (it) { return it.kind + ':' + invR2(it.amount).toFixed(2); }).sort().join('|'); }, k = key(o.items), now = NOW();
  return D().payments.filter(function (p) { return !p.void && p.booking === o.booking && p.method === o.method && (p.ref || '') === (o.method === 'Deposit adjustment' ? '' : o.ref || '') && (p.note || '') === (o.note || '') && p.by === me().name && p.createdAt && now - p.createdAt < INV_DUP_MS && key(invItems(p)) === k; }).slice(-1)[0] || null;
}

/* ---------------- booking picker: code in any form, name, phone, plate; every match; two-line rows ---------------- */
function invBookingPicker(el, o) {
  o = o || {};
  var toggles = (o.dueToggle === false ? [] : [{ key: 'due', label: 'Only bookings with money due', value: !!o.due, narrows: true }]).concat([{ key: 'cancelled', label: 'Show cancelled bookings', value: false }]);
  var near = TODAY.getTime();
  return UI.combo(el, {
    key: o.key || 'booking', label: o.label || 'Booking', required: o.required !== false, value: o.value || '', help: o.help, error: o.error,
    placeholder: o.placeholder || 'Choose the booking', title: o.title || 'Choose the booking', searchPlaceholder: 'Booking ID, name, phone or plate', recentKey: 'invbk-' + B().id, popWidth: 440,
    emptyText: o.emptyText || 'No bookings with money due.', noMatchHelp: 'Try the Booking ID (' + (D().bookings[0] || {}).code + ' or just ' + ((D().bookings[0] || {}).n || 1) + '), part of the name, the phone or the plate. Paid bookings show when "Only bookings with money due" is off.',
    toggles: toggles,
    items: function (s) {
      var list = D().bookings.filter(function (b) { return (s.toggles.cancelled || b.status !== 'Cancelled' || b.code === o.value) && (!s.toggles.due || invDueOf(b) > 0 || b.code === o.value) && (!o.filter || o.filter(b) || b.code === o.value); });
      return list.slice().sort(function (a, b) { return Math.abs(a.start - near) - Math.abs(b.start - near); }).map(function (b) {
        var due = invDueOf(b), badge = o.badge ? o.badge(b) : due > 0 ? { text: UI.fmt.money(due) + ' due', tone: 'bad' } : { text: 'Paid', tone: 'ok' };
        return { value: b.code, label: b.code, sub: b.cust.name + ' · ' + b.car.plate, b: b, badge: badge,
          html: '<span class="ui-cbx-t inv-cbx"><b>' + esc(b.code) + ' <span class="ui-cbx-nm">' + esc(b.cust.name) + '</span></b><small>' + esc(b.car.plate) + ' · ' + esc(UI.fmt.date(b.start)) + ' to ' + esc(UI.fmt.date(b.end)) + (b.status === 'Cancelled' ? ' · Cancelled' : '') + '</small></span>' };
      });
    },
    search: function (it, q) {
      var b = it.b, t = tidySearch(q);
      if (matchBookingCode(t, b.code)) return 100;
      if (/^\d{3,}$/.test(t) && phoneHas(b.cust.phone, t)) return 20;
      var np = normPlate(t); if (np.length >= 3 && normPlate(b.car.plate).indexOf(np) >= 0) return 15;
      if (b.code.toLowerCase().indexOf(t.toLowerCase()) >= 0 && t.length >= 2) return 10;
      return UI.wordsMatch(b.cust.name + ' ' + b.code + ' ' + b.car.plate + ' ' + b.car.make + ' ' + b.car.model, t) ? 5 : 0;
    },
    onChange: function (v) { o.value = v; if (o.onChange) o.onChange(v, v ? findBooking(v) : null); }
  });
}
function invBookingCard(x) {
  var got = invReceived(x.code), due = invDueOf(x), by = invPaidByKind(x.code);
  return '<div class="inv-bk"><div class="grow"><b>' + esc(x.cust.name) + '</b> ' + UI.status('payment', x.pay || 'None') + '<small>' + esc(invCarLabel(x.car)) + ' · ' + esc(UI.fmt.date(x.start)) + ' to ' + esc(UI.fmt.date(x.end)) + '</small>' +
    '<small>Total ' + UI.money(x.payable) + ' · received <b>' + UI.money(got) + '</b>' + (Object.keys(by).length ? ' (' + Object.keys(by).map(function (k) { return k.replace(' payment', '').replace('Security ', '').toLowerCase() + ' ' + UI.fmt.money(by[k]); }).join(', ') + ')' : '') + ' · ' + (due > 0 ? '<span class="inv-due">' + UI.money(due) + ' still due</span>' : 'nothing due') + '</small></div></div>';
}

/* ---------------- payment fields: the items, method, deposited to, after charge, when, reference ---------------- */
function invCardFee() { var f = invCo().cardFee || {}; return { local: f.localPct == null ? 4 : f.localPct, foreign: f.foreignPct == null ? 5 : f.foreignPct, fixed: f.fixed == null ? 1 : f.fixed }; }
function invFeeText(pct) { return pct + '% + ' + UI.fmt.money(invCardFee().fixed); }
function invAfterCharge(a, pct) { var f = invCardFee(); return Math.max(0, invR2(a - a * (pct == null ? f.local : pct) / 100 - f.fixed)); }
function invItemsState(x) {
  var first = !x || !x.pay || x.pay === 'Deposit due' ? 'Security deposit' : 'Rental payment', it = {};
  INV_KINDS.forEach(function (k) { it[k] = { on: k === first, amount: '', touched: false }; });
  invItemsRefresh(it, x);
  return it;
}
function invTicked(it) { return INV_KINDS.filter(function (k) { return it[k].on; }); }
function invItemsRefresh(it, x) { var t = invTicked(it); INV_KINDS.forEach(function (k) { if (!it[k].touched) it[k].amount = invItemSuggest(x, k, t); }); }
function invItemsTotal(it) { return invR2(sum(invTicked(it).map(function (k) { var v = String(it[k].amount || '').replace(/,/g, ''); return /^\d{1,9}(\.\d{1,2})?$/.test(v.trim()) ? Number(v) : 0; }))); }
function invItemProblem(row) { if (!row.on) return ''; var a = String(row.amount == null ? '' : row.amount).replace(/,/g, '').trim(); if (!a) return 'Enter the amount'; if (!/^\d{1,9}(\.\d{1,2})?$/.test(a)) return 'Enter an amount like 150 or 150.50'; if (Number(a) <= 0) return 'The amount must be more than zero'; return ''; }
function invItemLines(it) { return invTicked(it).map(function (k) { return { kind: k, amount: invR2(String(it[k].amount).replace(/,/g, '')) }; }); }
/* the "also update the payment status" switch starts on when the status has not moved yet, or when this payment
   brings a Deposit Received booking up to its whole total (it then becomes Full Payment Received) */
function invSuggestsUpdate(x, it) {
  if (!x) return false;
  var t = invTicked(it);
  if (!x.pay || x.pay === 'Deposit due') return t.some(function (k) { return k !== 'Extension payment' && k !== 'Other payment'; });
  if (x.pay === 'Deposit Received') return t.some(function (k) { return RENT_LIKE_KINDS.indexOf(k) >= 0; }) && x.payable > 0 && invReceived(x.code) + invItemsTotal(it) >= x.payable - .99;
  return false;
}
function invItemsFootText(it) { var n = invTicked(it).length; return [n ? plural(n, 'item') : 'Nothing ticked yet', 'Total ' + UI.fmt.money(invItemsTotal(it))]; }
function invItemsHtml(st, x) {
  var by = x ? invPaidByKind(x.code) : {}, fromDep = st.method === 'Deposit adjustment', t = invTicked(st.items), fig = x ? invFigures(x, t) : {}, ft = invItemsFootText(st.items);
  return '<div class="inp full"><label>What is this payment for?</label><span class="help inv-it-help">Tick everything it paid for and check each amount.</span><div class="inv-items" role="group" aria-label="What is this payment for?">' + INV_KINDS.map(function (k) {
    var r = st.items[k], dis = fromDep && k === 'Security deposit', prob = st.itemsChecked ? invItemProblem(r) : '';
    var hint = dis ? 'A deposit cannot be paid from a deposit' : [fig[k] > 0 ? 'Still due ' + UI.fmt.money(fig[k]) : by[k] && fig[k] != null ? 'Paid in full' : '', by[k] ? UI.fmt.money(by[k]) + ' paid so far' : ''].filter(Boolean).join(' · ');
    return '<div class="inv-it' + (r.on ? ' on' : '') + (dis ? ' dis' : '') + '"><label class="cb inv-it-l"><input type="checkbox" data-it="' + esc(k) + '"' + (r.on ? ' checked' : '') + (dis ? ' disabled' : '') + '><span class="box">' + i('check') + '</span><span class="inv-it-t"><b>' + esc(k) + '</b>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span></label>' +
      (r.on ? '<div class="inv-it-a"><div class="ui-affix"><span>RM</span><input type="text" inputmode="decimal" autocomplete="off" data-ita="' + esc(k) + '" value="' + esc(r.amount) + '" placeholder="0.00" aria-label="' + esc(k) + ' amount (RM)"></div>' + (prob ? '<span class="ui-err">' + esc(prob) + '</span>' : '') + '</div>' : '') + '</div>';
  }).join('') + '<div class="inv-it-f"><span class="b2" data-it-n>' + esc(ft[0]) + '</span><b data-it-tot>' + esc(ft[1]) + '</b></div></div>' +
    (st.itemsChecked && !t.length ? '<span class="ui-err">Tick at least one thing this payment is for.</span>' : '') +
    (t.length > 1 ? '<span class="help">Each item is a line of this one payment, on the booking\'s one receipt.</span>' : '') + '</div>';
}
function invCashOptions() { return invStaff().map(function (n) { return ['Cash to ' + n, 'Cash to ' + n]; }); }
function invPayFieldsHtml(st, x, o) {
  o = o || {};
  var read = st.read || {}, rd = function (k) { return read[k] ? ' <span class="inv-read">' + i('scan') + 'Read from the slip</span>' : ''; }, fromDep = st.method === 'Deposit adjustment';
  var h = invItemsHtml(st, x) + '<div class="inv-fgrid">';
  h += UI.select({ key: 'method', label: o.methodLabel || 'Method', options: (o.methods || LISTS.methods).map(function (m) { return [m, methodLabel(m)]; }), value: st.method });
  if (fromDep) h += UI.select({ key: 'depOf', label: 'Deposit of', value: st.depOf, options: [['this', 'This booking' + (st.booking ? ' (' + st.booking + ')' : '')], ['other', 'Another booking']] });
  else h += UI.select({ key: 'depositedTo', label: 'Deposited to', options: st.method === 'Card' ? [['Stripe', 'Stripe']] : st.method === 'Online Transfer' ? [['Bank', 'Bank']] : invCashOptions(), value: st.depositedTo, disabled: st.method !== 'Cash' });
  if (fromDep && st.depOf === 'other') h += '<div class="full" data-bkp="dep"></div>';
  if (fromDep) {
    var src = st.depOf === 'other' ? st.depOther : st.booking, left = src && typeof depLeft === 'function' ? depLeft(src) : null;
    h += '<div class="full">' + UI.alert('No money comes in: the amount is taken off the deposit' + (st.depOf === 'other' ? (src ? ' of ' + src : ' of the booking you choose') : ' of this booking') + ' and the refund of that deposit is smaller by the same amount.' + (left != null ? ' Left of that deposit now: ' + UI.fmt.money(left) + '.' : ''), 'info', { icon: 'arrows-exchange' }) + (st.depErr ? '<span class="ui-err">' + esc(st.depErr) + '</span>' : '') + '</div>';
  }
  if (st.method === 'Card') {
    var fee = invCardFee(), pct = st.feePct == null ? fee.local : st.feePct, auto = invAfterCharge(invItemsTotal(st.items), pct), hand = st.afterCharge != null && Math.abs(Number(st.afterCharge) - auto) > .004;
    h += '<div class="inp full"><label>Amount after charge (RM)</label><div class="ui-affix"><span>RM</span><input type="text" inputmode="decimal" data-key="afterCharge" data-after value="' + esc(st.afterCharge != null ? st.afterCharge : auto.toFixed(2)) + '"></div>' +
      (st.afterErr ? '<span class="ui-err">' + esc(st.afterErr) + '</span>' : '<span class="help" data-after-help>' + (hand ? 'Changed by hand. <button type="button" class="inv-link" data-fee="auto">Use ' + esc(invFeeText(pct)) + '</button>' : 'The card charge is ' + esc(invFeeText(pct)) + (pct === fee.local ? ' (local card). <button type="button" class="inv-link" data-fee="foreign">Use the foreign card rate (' + esc(invFeeText(fee.foreign)) + ')</button>' : ' (foreign card). <button type="button" class="inv-link" data-fee="local">Use the local card rate (' + esc(invFeeText(fee.local)) + ')</button>')) + '</span>') + '</div>';
  }
  h += UI.dateTimeField({ key: 'at', label: (o.atLabel || 'Received on') + (read.at ? ' (read from the slip)' : ''), value: st.at || NOW(), max: NOW(), chips: [{ label: 'Today', days: 0 }, { label: 'Yesterday', days: -1 }] });
  if (!fromDep) h += '<div class="inp"><label>' + esc(o.refLabel || 'Reference (optional)') + rd('ref') + '</label><input data-key="ref" value="' + esc(st.ref || '') + '" placeholder="Bank transfer reference, card slip number..." autocomplete="off"></div>';
  if (!fromDep && st.refUsed) h += '<div class="full">' + invUsedHtml(st.refUsed) + '</div>';
  return h + '</div>';
}
/* read the plain fields back (the items are read as they are typed) */
function invPayKeep(el, st) {
  var f = UI.form(el);
  if (f.method && f.method !== st.method) {
    st.method = f.method; st.depositedTo = st.method === 'Card' ? 'Stripe' : st.method === 'Online Transfer' ? 'Bank' : st.method === 'Cash' ? 'Cash to ' + me().name : '';
    st.afterCharge = null; st.afterErr = '';
    if (st.method === 'Deposit adjustment' && st.items['Security deposit'].on) { st.items['Security deposit'].on = false; if (!invTicked(st.items).length) st.items['Rental payment'].on = true; invItemsRefresh(st.items, st.booking ? findBooking(st.booking) : null); }
  } else if (f.depositedTo) st.depositedTo = f.depositedTo;
  if (f.depOf) st.depOf = f.depOf;
  var acEl = el.querySelector('[data-after]');   /* only an amount the person typed counts as changed by hand */
  if (f.afterCharge !== undefined && st.method === 'Card' && acEl && acEl.getAttribute('data-hand')) { var auto = invAfterCharge(invItemsTotal(st.items), st.feePct); st.afterCharge = f.afterCharge === '' || f.afterCharge == null || Math.abs(Number(f.afterCharge) - auto) < .005 ? null : f.afterCharge; }
  if (f.at) st.at = UI.parseDate(f.at);
  if (f.ref !== undefined) st.ref = f.ref;
  if (f.note !== undefined) st.note = f.note;
  if (f.mkReceipt !== undefined) st.receipt = f.mkReceipt;
  if (f.upd !== undefined) st.update = f.upd;
  return st;
}
function invPayState(code) {
  var x = code ? findBooking(code) : null, method = x && LISTS.bookingMethods.indexOf(x.method) >= 0 ? x.method : 'Cash', items = invItemsState(x);
  return { booking: code || '', items: items, method: method, depositedTo: method === 'Card' ? 'Stripe' : method === 'Online Transfer' ? 'Bank' : 'Cash to ' + me().name, depOf: 'this', depOther: '', at: NOW(), ref: '', note: '', receipt: true, update: invSuggestsUpdate(x, items), updTouched: false, afterCharge: null, feePct: null, itemsChecked: false, refUsed: null };
}
/* events every payment form shares: ticking an item, typing an amount, the card fee links. redraw() redraws the form. */
function invPayWire(el, getSt, redraw) {
  var cardOf = function (t) { var c = t.closest('[data-card]'); return c || el; };
  el.addEventListener('change', function (ev) {
    var t = ev.target, st = getSt(t); if (!st) return;
    var k = t.getAttribute('data-it');
    if (k) { invPayKeep(cardOf(t), st); st.items[k].on = t.checked; if (!t.checked) st.items[k].touched = false; invItemsRefresh(st.items, st.booking ? findBooking(st.booking) : null); if (!st.updTouched) st.update = invSuggestsUpdate(st.booking ? findBooking(st.booking) : null, st.items); redraw(t); return; }
    var key = t.getAttribute('data-key');
    if (key === 'upd') st.updTouched = true;
    if (key === 'method' || key === 'depOf' || key === 'mkReceipt' || key === 'upd') { invPayKeep(cardOf(t), st); redraw(t); return; }
    if (key === 'ref') { invPayKeep(cardOf(t), st); var was = !!st.refUsed; st.refUsed = invRefUsed(st.ref); if (was || st.refUsed) redraw(t); return; }
    if (key === 'afterCharge') { invPayKeep(cardOf(t), st); st.afterErr = ''; redraw(t); }
  });
  el.addEventListener('input', function (ev) {
    var t = ev.target, k = t.getAttribute('data-ita');
    if (t.hasAttribute('data-after')) t.setAttribute('data-hand', '1');
    if (!k) return;
    var st = getSt(t); if (!st) return;
    st.items[k].amount = t.value; st.items[k].touched = true;
    if (!st.updTouched) { var xb = st.booking ? findBooking(st.booking) : null, nu = invSuggestsUpdate(xb, st.items); if (nu !== st.update) { st.update = nu; var sw = cardOf(t).querySelector('input[data-key="upd"]'); if (sw) sw.checked = nu; } }
    var box = t.closest('.inv-items'), ft = invItemsFootText(st.items);
    if (box) { box.querySelector('[data-it-n]').textContent = ft[0]; box.querySelector('[data-it-tot]').textContent = ft[1]; }
    var card = cardOf(t), ac = card.querySelector('[data-after]');
    if (ac && st.afterCharge == null) ac.value = invAfterCharge(invItemsTotal(st.items), st.feePct).toFixed(2);
    if (card.querySelector('[data-slipsum]') && typeof st.onItems === 'function') st.onItems(card);
  });
  el.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-fee]'); if (!b) return;
    var st = getSt(b); if (!st) return; invPayKeep(cardOf(b), st);
    var fee = invCardFee(), w = b.getAttribute('data-fee');
    st.feePct = w === 'foreign' ? fee.foreign : w === 'local' ? fee.local : st.feePct; st.afterCharge = null; st.afterErr = '';
    redraw(b);
  });
}
/* checks before saving; returns a message or '' */
function invPayProblem(st, x) {
  st.itemsChecked = true; st.depErr = ''; st.afterErr = '';
  var t = invTicked(st.items);
  if (!t.length) return 'Tick at least one thing this payment is for.';
  if (t.some(function (k) { return invItemProblem(st.items[k]); })) return 'Check the amounts.';
  if (!st.at) return 'Choose when the money was received.';
  if (st.at > new Date(NOW().getTime() + 6e4)) return 'The date cannot be in the future.';
  var total = invItemsTotal(st.items);
  if (st.method === 'Deposit adjustment') {
    if (st.items['Security deposit'].on) return 'A security deposit cannot be paid from a deposit. Untick Security deposit.';
    var src = st.depOf === 'other' ? st.depOther : x.code;
    if (!src) { st.depErr = 'Choose the booking whose deposit pays this.'; return st.depErr; }
    var z = byId(D().deposits, 'dep-' + src);
    if (z && z.refund) { st.depErr = 'The deposit of ' + src + ' is already returned to the customer, so it cannot pay for this.'; return st.depErr; }
    var left = depLeft(src);
    if (total > left + .004) { st.depErr = 'Only ' + UI.fmt.money(left) + ' is left of the deposit of ' + src + ', less than ' + UI.fmt.money(total) + '.'; return st.depErr; }
  } else {
    if (st.method === 'Cash' && !st.depositedTo) return 'Choose who has the cash.';
    st.refUsed = invRefUsed(st.ref); if (st.refUsed) return invUsedText(st.refUsed);
  }
  if (st.method === 'Card') {
    var ac = st.afterCharge == null ? invAfterCharge(total, st.feePct) : Number(String(st.afterCharge).replace(/,/g, ''));
    if (!(ac >= 0) || isNaN(ac)) { st.afterErr = 'Enter an amount like 150 or 150.50'; return st.afterErr; }
    if (ac > total + .004) { st.afterErr = 'The amount after charge cannot be more than the payment (' + UI.fmt.money(total) + ').'; return st.afterErr; }
    st.afterValue = invR2(ac);
  }
  return '';
}

/* ---------------- Record payment dialog ---------------- */
function invRecordPayment(code) {
  if (!can('billing.record_payment')) { UI.toast('You cannot record payments. Ask the owner for "Record payments".', { tone: 'warn' }); return; }
  var st = invPayState(code), done = null, err = '';
  var html = function () {
    if (done) {
      var p = done.payment, items = invItems(p);
      return (done.dup ? UI.alert('This payment was recorded a moment ago, so it was not saved twice.', 'info') : UI.alert('Payment of ' + UI.fmt.money(p.amount) + ' recorded.' + (done.receipt ? ' Receipt ' + done.receipt.no + ' is ready.' : ''), 'ok')) +
        (items.length > 1 ? '<ul class="inv-done-l">' + items.map(function (it) { return '<li>' + esc(it.kind) + ': <b>' + UI.fmt.money(it.amount) + '</b></li>'; }).join('') + '</ul>' : '') +
        (st.receipt && !done.receipt && !done.dup ? UI.alert('Payment saved. The receipt was not created yet: create it later on the Payments tab.', 'warn') : '') +
        (done.deposit ? UI.alert(UI.fmt.money(p.amount) + ' was taken off the deposit of ' + done.deposit.code + '. ' + (done.deposit.usedUp ? 'Nothing is left of it, so ' + done.deposit.code + ' is now Deposit Refunded.' : UI.fmt.money(done.deposit.left) + ' is left of it.'), 'info', { icon: 'arrows-exchange' }) : '') +
        (done.statusChanged ? UI.alert('The booking\'s payment status is now ' + done.statusChanged + '.', 'info') : '') +
        '<div class="inv-done">' + UI.kv('Booking', esc(p.booking)) + UI.kv('What for', esc(invKindsText(p))) + UI.kv('Method', esc(methodLabel(p.method) + (p.ref ? ' · ' + p.ref : ''))) + UI.kv(p.method === 'Deposit adjustment' ? 'Deposit of' : 'Deposited to', esc(p.method === 'Deposit adjustment' ? p.depositOf : p.depositedTo)) + '</div>';
    }
    var x = st.booking ? findBooking(st.booking) : null;
    return '<div class="col gap16"><div data-bkp="main"></div>' + (x ? invBookingCard(x) + invPayFieldsHtml(st, x) + UI.textarea({ key: 'note', label: 'Note (optional)', rows: 2, value: st.note }) +
      UI.switch({ key: 'mkReceipt', label: 'Create a receipt', checked: st.receipt, help: 'The payment goes on the booking\'s one receipt. Without it the payment is still recorded.', disabled: !can('billing.issue_receipt') }) +
      UI.switch({ key: 'upd', label: 'Also update the booking\'s payment status', checked: st.update, help: 'Moves it to Deposit Received, Full Payment Received or Extension paid when the money covers it.' }) +
      (err ? UI.alert(err, 'bad') : '') : '<p class="b2 inv-pickhelp">Find the booking by its ID (just the number works), the customer, the phone or the plate.</p>') + '</div>';
  };
  var mount = function (el) {
    var a = el.querySelector('[data-bkp="main"]');
    if (a) invBookingPicker(a, { value: st.booking, due: !st.booking, onChange: function (c) { var keepAt = st.at; st = invPayState(c); st.at = keepAt; err = ''; dl.setTitle('Record payment', c ? c + ' · ' + findBooking(c).cust.name : 'Choose the booking first'); redraw(); if (!c) return; } });
    var b = el.querySelector('[data-bkp="dep"]');
    if (b) invBookingPicker(b, { value: st.depOther, label: 'Booking whose deposit pays this', dueToggle: false, emptyText: 'No other booking has a deposit left to use.', filter: function (bk) { return bk.code !== st.booking && depLeft(bk.code) > 0; }, badge: function (bk) { return { text: UI.fmt.money(depLeft(bk.code)) + ' left', tone: 'info' }; }, onChange: function (c) { invPayKeep(dl.body, st); st.depOther = c; st.depErr = ''; redraw(); } });
  };
  var foot = function () {
    if (done) return [{ label: 'Done', kind: 'o' }].concat(done.receipt && can('billing.send') ? [{ label: 'Send receipt now', icon: 'send', onClick: function () { var no = done.receipt.no; setTimeout(function () { invSend(no); }, 50); } }] : []);
    var tot = st.booking ? invItemsTotal(st.items) : 0;
    return [{ label: 'Cancel', kind: 'g' }, { label: st.booking ? 'Record ' + UI.fmt.money(tot) : 'Record payment', icon: 'cash', disabled: !st.booking, onClick: save }];
  };
  var save = function (d) {
    invPayKeep(d.body, st);
    var x = findBooking(st.booking); if (!x) return false;
    err = invPayProblem(st, x);
    if (err) { redraw(); var bad = d.body.querySelector('.ui-err,.alert.bad'); if (bad && bad.scrollIntoView) bad.scrollIntoView({ block: 'center' }); return false; }
    var lines = invItemLines(st.items), o = { booking: x.code, items: lines, method: st.method, depositedTo: st.depositedTo, at: st.at, ref: st.ref, note: (st.note || '').trim(), afterCharge: st.method === 'Card' ? st.afterValue : null, receipt: st.receipt && can('billing.issue_receipt'), updateStatus: st.update, depositOf: st.method === 'Deposit adjustment' ? (st.depOf === 'other' ? st.depOther : x.code) : null };
    var go = function () {
      var dup = invRecentDup(o);
      done = dup ? { payment: dup, receipt: dup.receipt ? byId(D().receipts, dup.receipt) : null, dup: true } : invDoRecord(o);
      if (!dup) UI.toast('Payment of ' + UI.fmt.money(done.payment.amount) + ' recorded');
      dl.setTitle(dup ? 'Already recorded' : 'Payment recorded', x.code + ' · ' + x.cust.name); redraw();
    };
    var over = invOverAll(x, lines);
    if (over.length) { invOverAsk(over, x.code + ' · ' + x.cust.name).then(function (y) { if (y) go(); }); return false; }
    go(); return false;
  };
  var x0 = code ? findBooking(code) : null;
  var dl = UI.dialog({ title: 'Record payment', subtitle: x0 ? x0.code + ' · ' + x0.cust.name : 'Choose the booking first', width: 'md', body: function (el) { el.innerHTML = html(); mount(el); }, buttons: foot(),
    dirty: function () { return !done && st.booking && invTicked(st.items).some(function (k) { return st.items[k].touched; }); } });
  dl.el.classList.add('inv-rp');
  var redraw = function () { dl.refresh(); dl.setFoot(foot()); };
  invPayWire(dl.body, function () { return st; }, function () { err = ''; redraw(); });
  dl.body.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-ita')) { var b = dl.el.querySelector('.ui-dlg-f button:last-child'); if (b && !done) b.lastChild.textContent = 'Record ' + UI.fmt.money(invItemsTotal(st.items)); } });
  invUsedWire(dl.body);
  return dl;
}

/* ---------------- Create invoice dialog: update to the latest, or void and issue a new one ---------------- */
function invLinesFor(x) {
  var lines = [{ desc: 'Car rental: ' + plural(x.days, 'day') + ' x RM ' + invMoney(x.rate || x.car.rate), qty: x.days, unit: x.rate || x.car.rate, amount: x.rent }];
  if (x.dmg) { var pk = x.pkg && D().damagePackages ? byId(D().damagePackages, x.pkg) : null; lines.push({ desc: 'Damage cover: ' + (pk ? pk.name : 'Basic cover') + ' (' + x.days + ' days x RM ' + invMoney(x.dmg / x.days) + ')', qty: x.days, unit: x.dmg / x.days, amount: x.dmg }); }
  if (x.deliv) lines.push({ desc: 'Delivery charge', qty: 1, unit: x.deliv, amount: x.deliv });
  if (x.ret) lines.push({ desc: 'Return charge', qty: 1, unit: x.ret, amount: x.ret });
  if (x.others) lines.push({ desc: 'Other charges', qty: 1, unit: x.others, amount: x.others });
  if (x.disc) lines.push({ desc: 'Discount', qty: 1, unit: -x.disc, amount: -x.disc });
  return lines;
}
var INV_EXTRA_MAX = 20;
function invCreateInvoice(code) {
  if (!can('billing.issue_invoice')) { UI.toast('You cannot issue invoices. Ask the owner for "Issue invoices".', { tone: 'warn' }); return; }
  /* the extra lines already on the live invoice come back, so Update keeps them and an unchanged booking does not look changed */
  var extraOf = function (c) { var ex = c ? invInvoiceOf(c) : null; return ex ? (ex.lines || []).filter(function (l) { return l.extra; }).slice(0, INV_EXTRA_MAX).map(function (l) { return { desc: l.desc, qty: l.qty, unit: l.unit }; }) : []; };
  var st = { booking: code || '', note: '', extra: extraOf(code), err: '' }, done = null;
  var keep = function (el) {
    var f = UI.form(el); if (f.note !== undefined) st.note = f.note;
    el.querySelectorAll('[data-xl]').forEach(function (row) { var k = +row.getAttribute('data-xl'), g = function (n) { var q = row.querySelector('[data-xk="' + n + '"]'); return q ? q.value : ''; }; if (st.extra[k]) { st.extra[k].desc = g('desc'); st.extra[k].qty = g('qty'); st.extra[k].unit = g('unit'); } });
  };
  var extraLines = function () { return st.extra.map(function (l) { var q = Number(l.qty) || 0, u = Number(String(l.unit).replace(/,/g, '')) || 0; return { desc: (l.desc || '').trim(), qty: q, unit: u, amount: invR2(q * u), extra: true }; }); };
  var calc = function (x) { var lines = invLinesFor(x).concat(extraLines()), charges = invR2(sum(lines.map(function (l) { return l.amount; }))), co = invCo(), tax = co.tax && co.tax.on ? Math.round(Math.max(0, charges) * co.tax.rate) / 100 : 0; return { lines: lines, charges: charges, tax: tax, total: invR2(charges + tax) }; };
  /* the alert and the lines table: redrawn on their own while the extra lines are typed, so focus stays put */
  var prev = function (x) {
    var h = '';
    var ex = invInvoiceOf(x.code), c = calc(x), co = invCo();
    if (ex) {
      var changed = Math.abs(invTotal(ex) - c.total) > .004 || (ex.deposit || 0) !== (x.dep || 0);
      h += changed ? UI.alert('The booking changed since ' + ex.no + ': ' + UI.fmt.money(invTotal(ex)) + ' -> ' + UI.fmt.money(c.total) + '. Update the invoice to keep the same number, or void it and issue a new one.', 'warn', { action: UI.btn('View ' + ex.no, { kind: 't', size: 'sm', attrs: { 'data-view': ex.no } }) })
        : UI.alert('This booking already has invoice ' + ex.no + ' (' + UI.fmt.money(invTotal(ex)) + '), and it matches the booking. Updating it writes it again with today\'s date.', 'info', { action: UI.btn('View ' + ex.no, { kind: 't', size: 'sm', attrs: { 'data-view': ex.no } }) });
    }
    h += '<div class="inv-lines"><table class="tbl"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>' + invLinesFor(x).map(function (l) { return '<tr><td>' + esc(l.desc) + '</td><td class="r">' + l.qty + '</td><td class="r">' + UI.money(l.unit) + '</td><td class="r">' + UI.money(l.amount) + '</td></tr>'; }).join('') +
      extraLines().map(function (l) { return l.desc || l.amount ? '<tr class="inv-xrow"><td>' + esc(l.desc || 'Extra line') + '</td><td class="r">' + l.qty + '</td><td class="r">' + UI.money(l.unit) + '</td><td class="r">' + UI.money(l.amount) + '</td></tr>' : ''; }).join('') + '</tbody><tfoot>' +
      (c.tax ? '<tr><td colspan="3">' + esc(co.tax.name) + ' ' + co.tax.rate + '%</td><td class="r">' + UI.money(c.tax) + '</td></tr>' : '') + '<tr class="inv-strong"><td colspan="3">Total charges</td><td class="r">' + UI.money(c.total) + '</td></tr><tr><td colspan="3" class="b2">Refundable security deposit ' + UI.fmt.money(x.dep) + ' (not a charge)</td><td></td></tr></tfoot></table></div>';
    return h;
  };
  var html = function () {
    var miss = invMissing(), x = st.booking ? findBooking(st.booking) : null;
    if (done) return UI.alert('Invoice ' + done.iv.no + ' ' + (done.how === 'update' ? 'now shows the booking as it is today' : 'is ready') + '. Total charges ' + UI.fmt.money(invTotal(done.iv)) + '.', 'ok') + (done.old ? UI.alert(done.old + ' was voided: ' + done.reason, 'info') : '') + '<div class="inv-done">' + UI.kv('Booking', esc(done.iv.booking)) + UI.kv('Customer', esc(x.cust.name)) + UI.kv('Refundable deposit', UI.fmt.money(done.iv.deposit)) + UI.kv('Lines', String(done.iv.lines.length)) + '</div>';
    var h = miss.length ? UI.alert('Company details are incomplete (' + miss.join(', ') + '). The invoice prints them.', 'warn', { action: can('billing.settings') ? UI.btn('Company details', { kind: 't', size: 'sm', attrs: { 'data-co': '1' } }) : '' }) : '';
    h += '<div data-bkp="inv"></div>';
    if (!x) return '<div class="col gap16">' + h + '</div>';
    h += '<div data-xprev>' + prev(x) + '</div>';
    h += '<div class="inv-xl"><div class="row"><b class="grow">Extra lines</b><span class="b2">' + st.extra.length + ' of ' + INV_EXTRA_MAX + '</span></div>' + st.extra.map(function (l, k) { return '<div class="inv-xl-r" data-xl="' + k + '"><div class="inp"><label>Description</label><input data-xk="desc" value="' + esc(l.desc) + '" placeholder="For example: Child seat" maxlength="120"></div><div class="inp"><label>Qty</label><input data-xk="qty" type="number" min="1" step="1" value="' + esc(l.qty) + '"></div><div class="inp"><label>Unit price (RM)</label><input data-xk="unit" type="text" inputmode="decimal" value="' + esc(l.unit) + '" placeholder="0.00"></div>' + UI.iconBtn('trash', 'Remove this line', { size: 'sm', attrs: { 'data-xrm': k } }) + '</div>'; }).join('') +
      (st.extra.length < INV_EXTRA_MAX ? UI.btn('Add a line', { kind: 't', size: 'sm', icon: 'plus', attrs: { 'data-xadd': '1' } }) : '<p class="b2">Up to ' + INV_EXTRA_MAX + ' extra lines.</p>') + '<p class="b2">A minus price (for example -50) gives a discount line. The total cannot go below RM 0.00.</p></div>';
    h += UI.textarea({ key: 'note', label: 'Note on the invoice (optional)', rows: 2, value: st.note, placeholder: 'For example: Thank you for choosing us again.' });
    if (st.err) h += UI.alert(st.err, 'bad');
    return '<div class="col gap16">' + h + '</div>';
  };
  var check = function (x) {
    var c = calc(x);
    if (st.extra.some(function (l) { return !(l.desc || '').trim(); })) return 'Each extra line needs a description.';
    if (st.extra.some(function (l) { return !(Number(l.qty) > 0) || isNaN(Number(String(l.unit).replace(/,/g, ''))) || String(l.unit).trim() === ''; })) return 'Each extra line needs a quantity above 0 and a price.';
    if (c.total < 0) return 'The total cannot be below RM 0.00. Check the extra lines.';
    return '';
  };
  var issue = function (x, how, reason) {
    var c = calc(x), ex = invInvoiceOf(x.code), note = (st.note || '').trim();
    if (how === 'update') {
      DB.update('invoices', ex, { lines: c.lines, charges: c.charges, tax: c.tax, deposit: x.dep, issued: NOW(), note: note || ex.note }, { where: 'Invoice', text: me().name + ' updated invoice ' + ex.no + ' to the booking\'s latest amounts (' + UI.fmt.money(c.total) + ')' });
      done = { iv: ex, how: 'update' }; UI.toast('Invoice ' + ex.no + ' updated to the booking\'s latest amounts');
    } else {
      var no = invNextNo('inv');
      if (ex) DB.update('invoices', ex, { status: 'Void', voidReason: 'Replaced by ' + no + ': ' + reason, voidAt: NOW(), voidBy: me().name }, { action: 'Changed', where: 'Invoice', text: me().name + ' voided invoice ' + ex.no + ' and issued ' + no + ': ' + reason });
      var iv = DB.add('invoices', { id: no, no: no, booking: x.code, issued: NOW(), lines: c.lines, charges: c.charges, deposit: x.dep, tax: c.tax, note: note, status: 'Issued', voidReason: '', sent: [], replaces: ex ? ex.no : null }, { where: 'Invoice', text: me().name + ' created invoice ' + no + ' for ' + x.code });
      done = { iv: iv, how: 'new', old: ex ? ex.no : null, reason: reason };
    }
    dl.setTitle(how === 'update' ? 'Invoice updated' : 'Invoice created', x.code + ' · ' + x.cust.name); redraw();
  };
  var foot = function () {
    if (done) return [{ label: 'Done', kind: 'g' }, { label: 'Preview', kind: 'o', icon: 'eye', onClick: function () { var no = done.iv.no; setTimeout(function () { invPreview(no); }, 50); } }].concat(can('billing.send') ? [{ label: 'Send invoice', icon: 'send', onClick: function () { var no = done.iv.no; setTimeout(function () { invSend(no); }, 50); } }] : []);
    var x = st.booking ? findBooking(st.booking) : null, ex = x ? invInvoiceOf(x.code) : null;
    var pre = function (d) { keep(d.body); st.err = check(x); if (st.err) { redraw(); var bad = d.body.querySelector('.alert.bad'); if (bad && bad.scrollIntoView) bad.scrollIntoView({ block: 'center' }); return false; } return true; };
    if (ex) return [{ label: 'Cancel', kind: 'g' }, { label: 'Void it and issue a new one', kind: 'o', icon: 'file-plus', onClick: function (d) {
      if (!pre(d)) return false;
      UI.confirm({ title: 'Void ' + ex.no + ' and issue a new invoice?', text: ex.no + ' stays on record marked VOID, and the new invoice gets the next number.', ok: 'Void and issue', danger: true, width: 'md', input: { label: 'Why is it replaced?', placeholder: 'For example: the customer changed the car', required: true } }).then(function (reason) { if (reason) issue(x, 'new', reason); });
      return false;
    } }, { label: 'Update the invoice', icon: 'refresh', onClick: function (d) { if (!pre(d)) return false; issue(x, 'update'); return false; } }];
    return [{ label: 'Cancel', kind: 'g' }, { label: 'Create invoice', icon: 'file-plus', disabled: !st.booking, onClick: function (d) { if (!pre(d)) return false; issue(x, 'new'); return false; } }];
  };
  var x0 = code ? findBooking(code) : null;
  var dl = UI.dialog({ title: x0 && invInvoiceOf(x0.code) ? 'Update invoice' : 'Create invoice', subtitle: x0 ? x0.code + ' · ' + x0.cust.name : 'Choose the booking', width: 'md', body: function (el) { el.innerHTML = html(); var a = el.querySelector('[data-bkp="inv"]'); if (a) invBookingPicker(a, { value: st.booking, dueToggle: false, onChange: function (c) { st.booking = c; st.extra = extraOf(c); st.err = ''; dl.setTitle(c && invInvoiceOf(c) ? 'Update invoice' : 'Create invoice', c ? c + ' · ' + findBooking(c).cust.name : 'Choose the booking'); redraw(); } }); }, buttons: foot(),
    dirty: function () { if (done) return false; keep(dl.body); var sig = function (a) { return a.map(function (l) { return [String(l.desc || '').trim(), String(l.qty), String(l.unit)].join('|'); }).join('/'); }; return sig(st.extra) !== sig(extraOf(st.booking)); } });
  var redraw = function () { if (!done) keep(dl.body); dl.refresh(); dl.setFoot(foot()); };
  dl.body.addEventListener('click', function (ev) {
    var v = ev.target.closest('[data-view]'), b; if (v) invPreview(v.getAttribute('data-view'));
    if (ev.target.closest('[data-co]')) invCompany();
    if (ev.target.closest('[data-xadd]')) { keep(dl.body); st.extra.push({ desc: '', qty: 1, unit: '' }); redraw(); var l = dl.body.querySelector('[data-xl="' + (st.extra.length - 1) + '"] [data-xk="desc"]'); if (l) l.focus(); }
    if ((b = ev.target.closest('[data-xrm]'))) { keep(dl.body); st.extra.splice(+b.getAttribute('data-xrm'), 1); redraw(); }
  });
  dl.body.addEventListener('change', function (ev) { if (!ev.target.getAttribute('data-xk')) return; keep(dl.body); var x = findBooking(st.booking), pv = dl.body.querySelector('[data-xprev]'); if (x && pv) pv.innerHTML = prev(x); if (st.err && x && !check(x)) { st.err = ''; var eb = dl.body.querySelector(':scope > .col > .alert.bad, .col.gap16 > .alert.bad:last-child'); if (eb) eb.remove(); } });
  return dl;
}

/* ---------------- slip pictures ---------------- */
/* the seeded slips have no picture: draw a made-up bank transfer slip from the payment */
function invSlipSvg(p, sl) {
  var x = findBooking(p.booking), co = invCo(), e = esc;
  var rows = [['Amount', 'RM ' + invMoney(p.amount)], ['Date', invDT(p.at)], ['Reference', p.ref || 'FT' + String(p.amount * 7919).replace('.', '').slice(0, 10)], ['From', x ? x.cust.name.toUpperCase() : ''], ['To', (co.legal || B().legal).toUpperCase()], ['To account', 'xxxx ' + String((co.bank && co.bank.accNo) || '0000').replace(/\D/g, '').slice(-4)], ['Recipient ref', p.booking]];
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560"><rect width="360" height="560" fill="#fff"/><rect width="360" height="64" fill="#F5C518"/><text x="20" y="30" font-family="Arial" font-size="15" font-weight="700" fill="#222">Bank Contoh</text><text x="20" y="50" font-family="Arial" font-size="13" fill="#333">Transfer successful</text><circle cx="180" cy="112" r="24" fill="#2E9E5B"/><path d="M168 112l8 8 16-16" stroke="#fff" stroke-width="5" fill="none"/>' +
    rows.map(function (r, k) { return '<text x="24" y="' + (178 + k * 46) + '" font-family="Arial" font-size="12" fill="#888">' + e(r[0]) + '</text><text x="24" y="' + (196 + k * 46) + '" font-family="Arial" font-size="' + (k ? 14 : 20) + '" font-weight="700" fill="#222">' + e(r[1]) + '</text>'; }).join('') +
    '<text x="180" y="540" text-anchor="middle" font-family="Arial" font-size="10" fill="#aaa">Sample slip, made-up data</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
/* a made-up cash deposit machine slip for a bank-in */
function invBankInSvg(bi) {
  var co = invCo(), e = esc, rows = [['Cash deposited', 'RM ' + invMoney(bi.amount)], ['Date and time', invDT(bi.at)], ['Reference', bi.ref || '-'], ['To account', (co.legal || B().legal).toUpperCase()], ['Account no.', 'xxxx ' + String((co.bank && co.bank.accNo) || '0000').replace(/\D/g, '').slice(-4)], ['Deposited by', staffName(bi.staff).toUpperCase()]];
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="520" viewBox="0 0 320 520"><rect width="320" height="520" fill="#fffef8"/><text x="160" y="40" text-anchor="middle" font-family="Courier New,monospace" font-size="17" font-weight="700" fill="#222">BANK CONTOH</text><text x="160" y="62" text-anchor="middle" font-family="Courier New,monospace" font-size="12" fill="#444">CASH DEPOSIT MACHINE</text><line x1="20" x2="300" y1="80" y2="80" stroke="#999" stroke-dasharray="4 3"/>' +
    rows.map(function (r, k) { return '<text x="24" y="' + (112 + k * 52) + '" font-family="Courier New,monospace" font-size="11" fill="#777">' + e(r[0].toUpperCase()) + '</text><text x="24" y="' + (130 + k * 52) + '" font-family="Courier New,monospace" font-size="' + (k ? 13 : 19) + '" font-weight="700" fill="#222">' + e(r[1]) + '</text>'; }).join('') +
    '<line x1="20" x2="300" y1="440" y2="440" stroke="#999" stroke-dasharray="4 3"/><text x="160" y="466" text-anchor="middle" font-family="Courier New,monospace" font-size="11" fill="#444">TRANSACTION SUCCESSFUL</text><text x="160" y="500" text-anchor="middle" font-family="Arial" font-size="10" fill="#aaa">Sample slip, made-up data</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function invSlipSrc(p, sl) { return sl.dataUrl || invSlipSvg(p, sl); }
/* the slip viewer: zoom, turn, open in a new tab, download, arrows between slips */
function invSlipViewer(p, start) {
  var list = (p.slips || []).map(function (s) { return { p: p, s: s }; }), k = start || 0, z = 1, rot = 0;
  if (!list.length) { UI.toast('This payment has no slip yet', { tone: 'info' }); return; }
  var body = function () {
    var it = list[k], src = invSlipSrc(it.p, it.s), pdf = /pdf/.test(it.s.type || '');
    return '<div class="inv-sv-bar"><span class="b2 grow">' + esc(it.s.name) + ' · ' + esc(UI.fmt.size(it.s.size || 0)) + (list.length > 1 ? ' · ' + (k + 1) + ' of ' + list.length : '') + '</span>' +
      UI.iconBtn('zoom-out', 'Zoom out (-)', { size: 'sm', attrs: { 'data-sv': 'out' } }) + UI.iconBtn('zoom-in', 'Zoom in (+)', { size: 'sm', attrs: { 'data-sv': 'in' } }) + UI.iconBtn('rotate-clockwise', 'Turn the picture (R)', { size: 'sm', attrs: { 'data-sv': 'rot' } }) + UI.iconBtn('external-link', 'Open in new tab', { size: 'sm', attrs: { 'data-sv': 'tab' } }) + UI.iconBtn('download', 'Download', { size: 'sm', attrs: { 'data-sv': 'dl' } }) + '</div>' +
      '<div class="inv-sv">' + (list.length > 1 ? UI.iconBtn('chevron-left', 'Previous slip', { attrs: { 'data-sv': 'prev' }, cls: 'inv-sv-l' }) : '') + (pdf ? '<div class="inv-sv-pdf">' + i('file-type-pdf') + '<b>' + esc(it.s.name) + '</b><span class="b2">A PDF slip. Open it in a new tab or download it to read it.</span></div>' : '<img src="' + src + '" alt="Payment slip" style="transform:scale(' + z + ') rotate(' + rot + 'deg)">') + (list.length > 1 ? UI.iconBtn('chevron-right', 'Next slip', { attrs: { 'data-sv': 'next' }, cls: 'inv-sv-r' }) : '') + '</div>';
  };
  var dl = UI.dialog({ title: p.title || 'Payment slip: ' + UI.fmt.money(p.amount) + ' on ' + p.booking, width: 'lg', body: body, buttons: [{ label: 'Close', kind: 'g' }] });
  var act = function (a) {
    var it = list[k];
    if (a === 'in') z = Math.min(3, z + .25); else if (a === 'out') z = Math.max(.5, z - .25); else if (a === 'rot') rot = (rot + 90) % 360;
    else if (a === 'prev') { k = (k + list.length - 1) % list.length; z = 1; rot = 0; } else if (a === 'next') { k = (k + 1) % list.length; z = 1; rot = 0; }
    else if (a === 'tab') { try { var w = window.open(invSlipSrc(it.p, it.s), '_blank', 'noopener'); if (!w) UI.toast('This viewer blocks new tabs. Use Download instead.', { tone: 'warn' }); } catch (e) { UI.toast('This viewer blocks new tabs.', { tone: 'warn' }); } return; }
    else if (a === 'dl') { var src = invSlipSrc(it.p, it.s); fetch(src).then(function (r) { return r.blob(); }).then(function (bl) { UI.download({ filename: it.s.dataUrl && !/^data:image\/svg/.test(it.s.dataUrl) ? it.s.name : it.s.name.replace(/\.\w+$/, '.svg'), data: bl, mime: bl.type }); }); return; }
    dl.refresh();
  };
  dl.body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-sv]'); if (b) act(b.getAttribute('data-sv')); });
  dl.el.addEventListener('keydown', function (ev) { var m = { '+': 'in', '=': 'in', '-': 'out', r: 'rot', R: 'rot', ArrowLeft: 'prev', ArrowRight: 'next' }[ev.key]; if (m && !/INPUT|TEXTAREA/.test(ev.target.tagName)) { ev.preventDefault(); act(m); } });
  return dl;
}
function invFileSlip(r) { return { name: r.name, size: r.size, type: r.type, dataUrl: r.dataUrl, hash: invHash(r.dataUrl), shrunk: r.shrunk }; }

/* ---------------- Add a payment slip to an existing payment ---------------- */
function invAddSlip(p) {
  var st = { file: null, used: null, note: '' };
  var body = function () {
    return '<p class="ui-ctext">The payment stays exactly as it is. The slip is kept with it, so you can show it later next to the bank statement.</p>' +
      (st.file ? '<div class="inv-slip1"><img src="' + (/pdf/.test(st.file.type) ? '' : st.file.dataUrl) + '" alt="" ' + (/pdf/.test(st.file.type) ? 'hidden' : '') + '>' + (/pdf/.test(st.file.type) ? i('file-type-pdf') : '') + '<span class="grow"><b>' + esc(st.file.name) + '</b><small>' + UI.fmt.size(st.file.size) + (st.file.shrunk ? ' · made smaller' : '') + '</small></span>' + UI.btn('Choose another', { kind: 't', size: 'sm', attrs: { 'data-again': '1' } }) + '</div>' : '<div data-dz></div>') +
      invUsedHtml(st.used) +
      UI.textarea({ key: 'note', label: 'Note (optional)', rows: 2, maxlength: 300, value: st.note, placeholder: 'For example: sent by the customer on WhatsApp' });
  };
  var foot = function () { return [{ label: 'Cancel', kind: 'g' }, { label: 'Add slip', icon: 'paperclip', disabled: !!st.used, onClick: function (d) {
    var f = UI.form(d.body); st.note = f.note || '';
    if (!st.file) { UI.toast('Choose the slip first', { tone: 'warn' }); return false; }
    st.used = invSlipUsed(st.file.hash, { exceptPayment: null }); if (st.used) { d.refresh(); d.setFoot(foot()); return false; }
    var s = Object.assign(invFileSlip(st.file), { at: NOW(), by: me().name, note: st.note });
    DB.update('payments', p, { slips: (p.slips || []).concat([s]) }, { where: 'Payment', text: me().name + ' added a payment slip to the payment of ' + UI.fmt.money(p.amount) + ' on ' + p.booking });
    UI.toast('Slip added to the payment');
  } }]; };
  var dl = UI.dialog({ title: 'Add a payment slip', subtitle: UI.fmt.money(p.amount) + ' · ' + invKindsText(p) + ' · ' + p.booking, width: 'md', body: function () { setTimeout(mount, 0); return body(); }, buttons: foot() });
  function mount() { var z = dl.body.querySelector('[data-dz]'); if (z) UI.dropzone(z, { accept: 'image/*,.pdf', label: 'Drop the slip here', hint: 'A photo or a PDF, up to 10 MB. You can also paste it with Ctrl+V.', camera: true, onFiles: function (fs) { var f = fs[0]; if (f.size > 10 * 1048576) { UI.toast('That file is bigger than 10 MB', { tone: 'warn' }); return; } UI.readImage(f).then(function (r) { st.note = UI.form(dl.body).note || st.note; st.file = invFileSlip(r); st.used = invSlipUsed(st.file.hash); dl.refresh(); dl.setFoot(foot()); }); } }); }
  dl.body.addEventListener('click', function (ev) { if (ev.target.closest('[data-again]')) { st.file = null; st.used = null; dl.refresh(); dl.setFoot(foot()); } });
  invUsedWire(dl.body);
  return dl;
}

/* ---------------- Upload payment slips (many at once) ---------------- */
function invUploadSlips() {
  if (!can('billing.record_payment')) { UI.toast('You cannot record payments. Ask the owner for "Record payments".', { tone: 'warn' }); return; }
  var cards = [], seq = 0;
  var stLabel = { 'new': ['Not recorded yet', 'grey'], reading: ['Reading the slip...', 'info'], done: ['Recorded', 'ok'], attention: ['Needs attention', 'warn'], blocked: ['Already recorded', 'bad'] };
  var cardOf = function (el) { var c = el && el.closest('[data-card]'); return c ? cards.filter(function (z) { return z.id === +c.getAttribute('data-card'); })[0] : null; };
  var sumHtml = function (c) {
    var tot = invItemsTotal(c.items), slip = Number(c.slipAmount) || 0;
    if (!slip) return '<span class="b2" data-slipsum>The items add up to ' + UI.fmt.money(tot) + '.</span>';
    var ok = Math.abs(tot - slip) < .005;
    return '<span class="b2 ' + (ok ? 'inv-okt' : 'inv-badt') + '" data-slipsum>' + (ok ? 'The items add up to ' + UI.fmt.money(tot) + ', the same as the slip.' : 'The items add up to ' + UI.fmt.money(tot) + ', the slip says ' + UI.fmt.money(slip) + '.') + '</span>';
  };
  var cardHtml = function (c, n) {
    var x = c.booking ? findBooking(c.booking) : null, status = c.status === 'new' && (c.hashUsed || c.refUsed || c.twin) ? 'blocked' : c.status;
    var head = '<div class="inv-sc-h"><span class="grow b2">' + (n + 1) + '. <b class="t1c">' + esc(c.file.name) + '</b> · ' + UI.fmt.size(c.file.size) + (c.file.shrunk ? ' · made smaller' : '') + '</span>' + UI.chip(stLabel[status][0], stLabel[status][1]) + (c.status !== 'done' ? UI.iconBtn('x', 'Remove this slip', { size: 'sm', attrs: { 'data-rm': c.id } }) : '') + '</div>';
    var thumb = '<button type="button" class="inv-sc-th" data-big="' + c.id + '" title="Look at the slip larger">' + (/pdf/.test(c.file.type) ? i('file-type-pdf') + '<small>PDF</small>' : '<img src="' + c.file.dataUrl + '" alt="Slip ' + (n + 1) + '">') + '</button>';
    if (c.status === 'done') { var r = c.result; return '<div class="inv-sc done" data-card="' + c.id + '">' + head + '<div class="inv-sc-b">' + thumb + '<div class="grow col gap8">' + UI.alert((r.dup ? 'This payment was recorded a moment ago, so it was not saved twice: ' : 'Payment of ') + UI.fmt.money(r.payment.amount) + ' (' + invKindsText(r.payment) + ') on ' + r.payment.booking + (r.dup ? '.' : ' recorded.') + (r.receipt ? ' Receipt ' + r.receipt.no + '.' : '') + (r.statusChanged ? ' The booking is now ' + r.statusChanged + '.' : ''), 'ok', { action: r.receipt ? '<span class="row gap6">' + UI.btn('View', { kind: 't', size: 'sm', attrs: { 'data-view': r.receipt.no } }) + (can('billing.send') ? UI.btn('Send to customer', { kind: 't', size: 'sm', attrs: { 'data-send': r.receipt.no } }) : '') + '</span>' : '' }) + '</div></div></div>'; }
    if (c.status === 'reading') return '<div class="inv-sc" data-card="' + c.id + '">' + head + '<div class="inv-sc-b">' + thumb + '<div class="grow inv-reading">' + i('loader-2', 'inv-spin') + 'Reading the slip...</div></div></div>';
    if (c.hashUsed || c.twin) return '<div class="inv-sc bad" data-card="' + c.id + '">' + head + '<div class="inv-sc-b">' + thumb + '<div class="grow col gap12">' + (c.twin ? UI.alert('This is the same file as slip ' + c.twin + ' in this list. Remove one of them.', 'bad', { icon: 'copy-off' }) : invUsedHtml(c.hashUsed)) + '</div></div></div>';
    var readNote = c.readOk ? UI.alert('Filled in from the slip (' + c.readBank + '). Check each one against the picture before you record.', 'info', { icon: 'scan' }) : c.readOk === false ? UI.alert('Nothing could be read from this slip. Type the details in.', 'warn') : '';
    return '<div class="inv-sc' + (c.status === 'attention' || c.refUsed ? ' bad' : '') + '" data-card="' + c.id + '">' + head + readNote + '<div class="inv-sc-b">' + thumb + '<div class="grow col gap12"><div data-bkp="slip"></div>' +
      (x ? invBookingCard(x) + '<div class="inp"><label>Amount on the slip (RM)' + (c.read && c.read.amount ? ' <span class="inv-read">' + i('scan') + 'Read from the slip</span>' : '') + '</label><div class="ui-affix"><span>RM</span><input type="text" inputmode="decimal" data-key="slipAmount" value="' + esc(c.slipAmount == null ? '' : c.slipAmount) + '" placeholder="0.00"></div></div>' +
        invPayFieldsHtml(c, x, { methods: LISTS.bookingMethods, methodLabel: 'Paid by', atLabel: 'Money received on', refLabel: 'Reference number (optional)' }) + sumHtml(c) +
        '<details class="inv-more"' + (c.more ? ' open' : '') + '><summary>More options</summary>' + UI.textarea({ key: 'note', label: 'Note (optional)', rows: 2, value: c.note }) + UI.switch({ key: 'mkReceipt', label: 'Create a receipt', checked: c.receipt, disabled: !can('billing.issue_receipt') }) + UI.switch({ key: 'upd', label: 'Also update the booking\'s payment status', checked: c.update }) + '</details>' +
        (c.error ? '<span class="ui-err">' + esc(c.error) + '</span>' : '') +
        '<div class="row" style="justify-content:flex-end">' + UI.btn('Record this slip', { icon: 'receipt', disabled: !!c.refUsed, attrs: { 'data-rec': c.id } }) + '</div>' : '') + '</div></div></div>';
  };
  var empty = '<ol class="inv-how"><li><b>Add the slips</b> your customers sent on WhatsApp or email: drop them here, choose them, or paste with Ctrl+V.</li><li><b>Choose the booking</b> for each slip and check what was read from it. A slip already recorded is stopped.</li><li><b>Record</b> each slip, or all of them at once. Each payment goes on the booking\'s receipt.</li></ol>';
  var body = function () { return '<div data-dz></div>' + (cards.length ? '<div class="col gap12">' + cards.map(cardHtml).join('') + '</div>' : empty); };
  var ready = function () { return cards.filter(function (c) { return c.status !== 'done' && c.status !== 'reading' && c.booking && !c.hashUsed && !c.refUsed && !c.twin; }); };
  var foot = function () { var rd = ready().length; return [{ label: plural(cards.length, 'slip'), kind: 't', disabled: true }, { spacer: true }, { label: 'Cancel', kind: 'g' }, { label: 'Record all (' + rd + ')', icon: 'checks', disabled: !rd, onClick: function () { recordAll(); return false; } }]; };
  var dl = UI.dialog({ title: 'Upload payment slips', subtitle: 'Add the slips your customers sent, choose the booking for each one, then record them.', width: 'lg', body: function (el) { el.innerHTML = body(); setTimeout(mount, 0); mountPickers(el); }, buttons: foot(),
    dirty: function () { return cards.some(function (c) { return c.status !== 'done' && !c.hashUsed && !c.twin; }); }, dirtyTitle: 'Close without recording?' });
  function mount() { var z = dl.body.querySelector('[data-dz]'); if (z && !z.firstChild) UI.dropzone(z, { accept: 'image/*,.pdf', multiple: true, camera: true, label: 'Drop the payment slips here', hint: 'Images or PDFs, up to 30 at once, 10 MB each. Paste with Ctrl+V works too.', onFiles: add }); }
  function mountPickers(el) {
    el.querySelectorAll('[data-card]').forEach(function (cel) {
      var c = cards.filter(function (z) { return z.id === +cel.getAttribute('data-card'); })[0], a = cel.querySelector('[data-bkp="slip"]'); if (!c || !a) return;
      invBookingPicker(a, { value: c.booking, due: !c.booking, onChange: function (code) { keepAll(); var bx = code ? findBooking(code) : null; var keepRead = { at: c.at, ref: c.ref, slipAmount: c.slipAmount, read: c.read, readOk: c.readOk, readBank: c.readBank };
        Object.assign(c, invPayState(code), { method: 'Online Transfer', depositedTo: 'Bank' }, keepRead); c.booking = code || '';
        if (bx && Number(c.slipAmount) > 0) { var k0 = invTicked(c.items)[0]; c.items[k0].amount = invR2(c.slipAmount).toFixed(2); c.items[k0].touched = true; }
        c.refUsed = invRefUsed(c.ref); c.error = ''; c.status = 'new'; redraw(); } });
    });
  }
  function keepAll() { cards.forEach(function (c) { var el = dl.body.querySelector('[data-card="' + c.id + '"]'); if (!el || c.status === 'done' || c.status === 'reading' || !c.booking) return; var f = UI.form(el); invPayKeep(el, c); if (f.slipAmount !== undefined) c.slipAmount = f.slipAmount; var det = el.querySelector('details'); if (det) c.more = det.open; }); }
  function redraw() { keepAll(); dl.refresh(); dl.setFoot(foot()); }
  function twinOf(c) { var t = 0; cards.some(function (z, k) { if (z !== c && z.id < c.id && z.file.hash === c.file.hash) { t = k + 1; return true; } return false; }); return t; }
  function add(files) {
    files = files.slice(0, 30 - cards.length);
    if (!files.length) { UI.toast('Up to 30 slips at once', { tone: 'warn' }); return; }
    if (files.some(function (f) { return f.size > 1500000; })) UI.toast('Making big photos smaller...', { tone: 'info', ms: 1500 });
    files.forEach(function (f) {
      if (f.size > 10 * 1048576) { UI.toast(f.name + ' is bigger than 10 MB', { tone: 'warn' }); return; }
      UI.readImage(f).then(function (r) {
        var c = Object.assign(invPayState(''), { id: ++seq, file: invFileSlip(r), status: 'reading', results: [], slipAmount: null, receipt: true });
        c.method = 'Online Transfer'; c.depositedTo = 'Bank';
        c.hashUsed = invSlipUsed(c.file.hash); cards.push(c); c.twin = twinOf(c);
        if (c.hashUsed || c.twin) c.status = 'new';
        redraw();
        if (!c.hashUsed && !c.twin) setTimeout(function () { readSlip(c); }, 900 + cards.length * 250);
      });
    });
  }
  /* slip reading: a made-up result here (the real system reads the slip on the server) */
  function readSlip(c) {
    if (cards.indexOf(c) < 0) return;
    keepAll(); c.status = 'new';
    if (/pdf/.test(c.file.type) || /blank|empty/i.test(c.file.name)) { c.readOk = false; redraw(); return; }
    var used = cards.map(function (z) { return z.booking; });
    var cand = D().bookings.filter(function (x) { return x.status !== 'Cancelled' && invDueOf(x) > 0 && used.indexOf(x.code) < 0; }).sort(function (a, b) { return a.start - b.start; })[0];
    if (!cand) { c.readOk = false; redraw(); return; }
    Object.assign(c, invPayState(cand.code), { method: 'Online Transfer', depositedTo: 'Bank' });
    var k0 = invTicked(c.items)[0], amt = Number(c.items[k0].amount) || invDueOf(cand);
    c.slipAmount = invR2(amt).toFixed(2); c.items[k0].amount = c.slipAmount; c.items[k0].touched = true;
    c.ref = 'FT' + String(26100000000 + (parseInt(String(c.file.hash).slice(0, 7), 16) || cand.n * 7919 + c.id) % 899999999).slice(0, 11);   /* made up from the file: the same picture reads the same, another picture never clashes */ c.at = new Date(NOW().getTime() - 3 * 36e5); c.at.setSeconds(0, 0);
    c.readOk = true; c.readBank = 'Bank Contoh'; c.read = { amount: 1, ref: 1, at: 1 };
    c.refUsed = invRefUsed(c.ref);
    redraw();
  }
  /* record one card; resolves true when it was recorded */
  function recordOne(c) {
    keepAll();
    if (!c.booking) { c.error = 'Choose the booking.'; c.status = 'attention'; return Promise.resolve(false); }
    if (c.hashUsed || c.twin || c.refUsed) return Promise.resolve(false);
    var x = findBooking(c.booking), prob = invPayProblem(c, x);
    if (!prob && Number(c.slipAmount) > 0 && Math.abs(invItemsTotal(c.items) - Number(c.slipAmount)) > .005) prob = 'The items must add up to the amount on the slip (' + UI.fmt.money(Number(c.slipAmount)) + ').';
    if (prob) { c.error = prob; c.status = 'attention'; return Promise.resolve(false); }
    c.error = '';
    var lines = invItemLines(c.items), o = { booking: x.code, items: lines, method: c.method, depositedTo: c.depositedTo, at: c.at, ref: c.ref, note: (c.note || '').trim(), afterCharge: c.method === 'Card' ? c.afterValue : null, slips: [Object.assign({}, c.file, { at: NOW(), by: me().name })], receipt: c.receipt && can('billing.issue_receipt'), updateStatus: c.update };
    var go = function () { var dup = invRecentDup(o); c.result = dup ? { payment: dup, receipt: dup.receipt ? byId(D().receipts, dup.receipt) : null, dup: true } : invDoRecord(o); c.status = 'done'; return true; };
    var over = invOverAll(x, lines, { 'Rental payment': .99 });
    if (over.length) return invOverAsk(over, 'Slip ' + (cards.indexOf(c) + 1) + ' · ' + x.code + ' · ' + x.cust.name).then(function (y) { if (y) return go(); c.status = 'attention'; c.error = 'Not recorded: check the amounts against the booking.'; return false; });
    return Promise.resolve(go());
  }
  function recordAll() {
    var todo = ready(), ok = 0, bad = 0;
    todo.reduce(function (pr, c) { return pr.then(function () { return recordOne(c).then(function (y) { if (y) ok++; else bad++; }); }); }, Promise.resolve()).then(function () {
      redraw();
      UI.toast(bad ? ok + ' recorded, ' + bad + ' still need attention' : plural(ok, 'payment') + ' recorded', { tone: bad ? 'warn' : 'ok' });
    });
  }
  invPayWire(dl.body, function (t) { return cardOf(t); }, function () { redraw(); });
  dl.body.addEventListener('input', function (ev) { var c = cardOf(ev.target); if (!c) return; if (ev.target.getAttribute('data-ita') || ev.target.getAttribute('data-key') === 'slipAmount') { if (ev.target.getAttribute('data-key') === 'slipAmount') c.slipAmount = ev.target.value; var s = ev.target.closest('[data-card]').querySelector('[data-slipsum]'); if (s) s.outerHTML = sumHtml(c); } });
  dl.body.addEventListener('click', function (ev) {
    var t = ev.target, c = cardOf(t), b;
    if ((b = t.closest('[data-rm]'))) { keepAll(); cards = cards.filter(function (z) { return z.id !== +b.getAttribute('data-rm'); }); cards.forEach(function (z) { var tw = twinOf(z); z.twin = tw; }); redraw(); return; }
    if ((b = t.closest('[data-big]'))) { var cc = cards.filter(function (z) { return z.id === +b.getAttribute('data-big'); })[0]; invSlipViewer({ title: 'Slip ' + (cards.indexOf(cc) + 1) + ': ' + cc.file.name, amount: Number(cc.slipAmount) || 0, booking: cc.booking || 'no booking yet', slips: [cc.file] }); return; }
    if ((b = t.closest('[data-view]'))) { invPreview(b.getAttribute('data-view')); return; }
    if ((b = t.closest('[data-send]'))) { invSend(b.getAttribute('data-send')); return; }
    if (!c) return;
    if (t.closest('[data-rec]')) { recordOne(c).then(function (ok) { redraw(); UI.toast(ok ? 'Slip recorded' : 'This slip needs attention', { tone: ok ? 'ok' : 'warn' }); }); }
  });
  invUsedWire(dl.body);
  return dl;
}
/* ---------------- Company details drawer ---------------- */
function invCompany() {
  if (!can('billing.settings')) { UI.toast('Only people with "Company details" can change these.', { tone: 'warn' }); return; }
  var co = JSON.parse(JSON.stringify(invCo())), changed = false;
  Object.keys(invCo()).forEach(function (k) { var v = invCo()[k]; if (v instanceof Date || (v && typeof v === 'object' && !Array.isArray(v) && k !== 'bank' && k !== 'numbering' && k !== 'tax' && k !== 'footers')) co[k] = v; });   /* dates and other settings objects stay as they are */
  co.bank = co.bank || {}; co.numbering = co.numbering || {}; co.tax = co.tax || {}; co.footers = co.footers || {};
  var keep = function (el) {
    var f = UI.form(el);
    ['legal', 'trading', 'reg', 'phone', 'address', 'email', 'website', 'countryCode'].forEach(function (k) { if (f[k] !== undefined) co[k] = f[k]; });
    ['bank', 'accNo', 'accName', 'note'].forEach(function (k) { if (f['b_' + k] !== undefined) co.bank[k] = f['b_' + k]; });
    if (f.invPrefix !== undefined) { co.numbering.invPrefix = f.invPrefix; co.numbering.rcpPrefix = f.rcpPrefix; co.numbering.digits = Math.max(3, Math.min(8, Number(f.digits) || 5)); co.numbering.resetYearly = f.resetYearly; }
    if (f.taxOn !== undefined) { co.tax.on = f.taxOn; if (f.taxName !== undefined) { co.tax.name = f.taxName; co.tax.rate = Number(f.taxRate) || 0; co.tax.regNo = f.taxReg; } }
    if (f.fInv !== undefined) { co.footers.invoice = f.fInv; co.footers.receipt = f.fRcp; }
    if (f.showPaid !== undefined) co.invoiceShowPaid = f.showPaid;
  };
  var missing = function () { var save = D().company; D().company = co; var m = invMissing(); D().company = save; return m; };
  var body = function () {
    var m = missing();
    return (m.length ? UI.alert('Finish setting up before sending documents. Still missing: ' + m.join(', ') + '.', 'warn') : UI.alert('Everything needed on invoices and receipts is filled in.', 'ok')) +
      UI.section({ title: 'Company', icon: 'building', body: UI.input({ key: 'legal', label: 'Legal name', required: true, value: co.legal, error: co.legal ? '' : 'Required' }) + UI.input({ key: 'trading', label: 'Trading name (optional)', value: co.trading, help: 'The brand customers know. Printed in the line "' + (co.trading || B().name) + ' is operated by ..."' }) +
        UI.input({ key: 'reg', label: 'Company registration no.', required: true, value: co.reg }) + UI.input({ key: 'phone', label: 'Phone', required: true, value: co.phone, help: 'Printed under the company name on invoices, receipts and deposit statements.' }) +
        '<div class="full">' + UI.textarea({ key: 'address', label: 'Address *', rows: 3, value: co.address }) + '</div>' + UI.input({ key: 'email', label: 'Email', type: 'email', required: true, value: co.email }) + UI.input({ key: 'website', label: 'Website (optional)', value: co.website }) }) +
      UI.section({ title: 'Logo', icon: 'photo', body: '<div class="full row gap16 wrap"><div class="inv-logo">' + (co.logo ? '<img src="' + co.logo + '" alt="Company logo">' : '<span class="b2">No logo</span>') + '</div><div class="col gap8"><div class="row gap8 wrap"><label class="btn o sm">' + i('upload') + (co.logo ? 'Replace logo' : 'Upload logo') + '<input type="file" accept="image/png,image/jpeg,image/webp" data-logo hidden></label>' + (co.logo ? UI.btn('Remove', { kind: 't', size: 'sm', icon: 'trash', attrs: { 'data-logo-rm': '1' } }) : '') + '</div><span class="b2">Your company logo, printed at the top of every document. Without one, the company mark is used. PNG, JPG or WEBP, up to 2 MB.</span></div></div>' }) +
      UI.section({ title: 'Bank details (printed on invoices)', icon: 'building-bank', body: UI.input({ key: 'b_bank', label: 'Bank', value: co.bank.bank }) + UI.input({ key: 'b_accNo', label: 'Account number', required: true, value: co.bank.accNo }) + UI.input({ key: 'b_accName', label: 'Account name', value: co.bank.accName }) + UI.input({ key: 'b_note', label: 'Note under the bank details (optional)', value: co.bank.note }) }) +
      UI.section({ title: 'Numbering', icon: 'list-numbers', body: UI.input({ key: 'invPrefix', label: 'Invoice prefix', value: co.numbering.invPrefix }) + UI.input({ key: 'rcpPrefix', label: 'Receipt prefix', value: co.numbering.rcpPrefix }) + UI.input({ key: 'digits', label: 'Digits', type: 'number', min: 3, max: 8, value: co.numbering.digits }) + '<div class="full">' + UI.switch({ key: 'resetYearly', label: 'Start numbering again from 1 every January', checked: co.numbering.resetYearly }) + '</div><p class="b2 full">Numbers already issued never change. Voided numbers are not reused. Next invoice: <b>' + esc((co.numbering.invPrefix || 'INV-') + (co.numbering.resetYearly ? NOW().getFullYear() + '-' : '') + '...') + '</b></p>' }) +
      UI.section({ title: 'Tax', icon: 'percentage', body: '<div class="full">' + UI.switch({ key: 'taxOn', label: 'Add tax to invoices', checked: co.tax.on }) + '</div>' + (co.tax.on ? UI.input({ key: 'taxName', label: 'Tax name', value: co.tax.name || 'SST' }) + UI.input({ key: 'taxRate', label: 'Rate (%)', type: 'number', step: '0.1', value: co.tax.rate || 8 }) + '<div class="full">' + UI.input({ key: 'taxReg', label: 'Tax registration number', required: true, value: co.tax.regNo }) + '</div>' : '') + '<p class="b2 full">Tax is added on the charges only, never on the refundable deposit.</p>' }) +
      UI.section({ title: 'What invoices print', icon: 'file-invoice', body: '<div class="full">' + UI.switch({ key: 'showPaid', label: 'Print "Payments received" and "Balance due" on invoices', checked: !!co.invoiceShowPaid, help: 'Off: the invoice lists the charges and the deposit only, and payments show on the receipt.' }) + '</div>' }) +
      UI.section({ title: 'Footers and phone numbers', icon: 'align-box-bottom-center', body: '<div class="full">' + UI.textarea({ key: 'fInv', label: 'Invoice footer (optional)', rows: 2, value: co.footers.invoice }) + '</div><div class="full">' + UI.textarea({ key: 'fRcp', label: 'Receipt footer (optional)', rows: 2, value: co.footers.receipt }) + '</div>' + UI.select({ key: 'countryCode', label: 'Default country code for phone numbers', options: [['+60', 'Malaysia (+60)'], ['+65', 'Singapore (+65)'], ['+62', 'Indonesia (+62)'], ['+66', 'Thailand (+66)'], ['+673', 'Brunei (+673)']], value: co.countryCode || '+60' }) });
  };
  var dr = UI.drawer({ title: 'Company details', subtitle: 'Printed on invoices, receipts and deposit statements', width: 680, body: body, dirty: function () { return changed; },
    foot: [{ label: 'Close', kind: 'o' }, { label: 'Save', icon: 'device-floppy', onClick: function (d) { keep(d.body); D().company = co; changed = false; DB.log('Changed', 'Settings', 'company', me().name + ' changed the company details printed on documents'); emit('data', { coll: 'company', op: 'update', rec: co }); UI.toast('Company details saved'); } }] });
  dr.body.addEventListener('input', function () { changed = true; });
  dr.body.addEventListener('change', function (ev) {
    changed = true;
    if (ev.target.matches('[data-logo]')) { var f = ev.target.files[0]; if (!f) return; if (f.size > 2 * 1048576) { UI.toast('The logo must be 2 MB or less', { tone: 'warn' }); return; } UI.readImage(f, { max: 600 }).then(function (r) { keep(dr.body); co.logo = r.dataUrl; dr.refresh(); }); return; }
    if (ev.target.getAttribute('data-key') === 'taxOn') { keep(dr.body); dr.refresh(); }
  });
  dr.body.addEventListener('click', function (ev) { if (ev.target.closest('[data-logo-rm]')) { keep(dr.body); co.logo = null; changed = true; dr.refresh(); } });
  return dr;
}


/* ===================================================================
   Cash held by staff and "Bank in cash"
   Held = the shared cashHeldBy (data.js): cash from customers and from the company, less what they paid for the company
   in cash, their own handover fees, cash deposit refunds and bank-ins. The same figure as Staff income and expenses.
   =================================================================== */
function invCashRows() {
  var d = D();
  return d.users.map(function (u) {
    var list = cashEntries(u.id, null, null), f = cashParts(list), bins = list.filter(function (e) { return e.part === 'handed_in'; });
    return { id: u.id, name: u.name, user: u, held: cashBalance(f), n: list.filter(function (e) { return e.part === 'cash_received'; }).length, cashIn: f.cash_received + f.from_owners, fromCo: f.from_owners, banked: f.handed_in, refunded: f.refunds_given, spent: f.expenses, fees: f.income, paidOut: f.expenses + f.income + f.refunds_given, last: bins.length ? bins.reduce(function (a, b) { return b.at > a ? b.at : a; }, bins[0].at) : null };
  }).filter(function (r) { return Math.abs(r.held) > .004; }).sort(function (a, b) { return b.held - a.held; });
}
/* "RM 740.00" for cash held, "Owed RM 20.50" when the company owes them */
function invHeldText(v) { return v < -0.004 ? 'owed ' + UI.fmt.money(-v) : 'holds ' + UI.fmt.money(v); }
function invCanVoidBankIn(b) { if (b.voided) return false; if (can('billing.manage_cash')) return true; return b.by === me().id && NOW() - (b.recordedAt || b.at) < DAY; }
function invBankInSheet(personId) {
  var office = can('billing.manage_cash'), mine = me();
  if (!office && !can('billing.record_payment') && !can('expenses.view')) { UI.toast('You cannot record bank-ins.', { tone: 'warn' }); return; }
  var now0 = NOW(); now0.setSeconds(0, 0);
  var st = { staff: office && personId ? personId : mine.id, slip: null, reading: false, readNote: '', amount: '', slipAmt: null, at: now0, ref: '', note: '', err: '', errs: {}, used: null };
  var heldOf = function (id) { return cashHeldBy(id); };
  var people = function () { var ids = invCashRows().map(function (r) { return r.id; }); D().users.forEach(function (u) { if (u.active && ids.indexOf(u.id) < 0) ids.push(u.id); }); if (ids.indexOf(st.staff) < 0) ids.unshift(st.staff); return ids.map(function (id) { return byId(D().users, id); }).filter(Boolean); };
  var keep = function (el) { var f = UI.form(el); if (f.staff) st.staff = f.staff; if (f.amount !== undefined) st.amount = f.amount; if (f.at) st.at = UI.parseDate(f.at); if (f.ref !== undefined) st.ref = f.ref; if (f.note !== undefined) st.note = f.note; };
  var body = function () {
    var held = heldOf(st.staff), who = byId(D().users, st.staff), amt = Number(String(st.amount).replace(/,/g, '')) || 0;
    var h = '<div class="col gap16">';
    h += office ? UI.select({ key: 'staff', label: 'Whose cash', value: st.staff, options: people().map(function (u) { return [u.id, (u.id === mine.id ? 'Mine (' + u.name + ')' : u.name) + ', ' + invHeldText(heldOf(u.id))]; }), help: 'The same balance as Staff income and expenses.' })
      : '<div class="inv-bin-who">' + UI.avatar(mine.name) + '<div><b>' + esc(mine.name) + '</b><small>' + (held < -0.004 ? 'The company owes you ' + UI.money(-held) : 'You hold ' + UI.money(held) + ' of company cash') + '</small></div></div>';
    h += '<div class="inp' + (st.errs.slip ? ' bad' : '') + '" data-bin-slip><label>Bank slip <span class="ui-req">*</span></label>' + (st.slip ? '<div class="inv-slip1">' + (/pdf/.test(st.slip.type) ? i('file-type-pdf') : '<img src="' + st.slip.dataUrl + '" alt="">') + '<span class="grow"><b>' + esc(st.slip.name) + '</b><small>' + UI.fmt.size(st.slip.size) + (st.slip.shrunk ? ' · made smaller' : '') + '</small>' + (st.reading ? '<small>' + i('loader-2', 'inv-spin') + ' Reading the slip...</small>' : '') + '</span>' + UI.btn('Remove', { kind: 't', size: 'sm', attrs: { 'data-slip-rm': '1' } }) + '</div>' : '<div data-dz></div>') + (st.errs.slip ? '<span class="ui-err">' + esc(st.errs.slip) + '</span>' : '') + '<span class="help">Take a photo of the slip from the bank or the cash deposit machine.</span></div>';
    if (st.readNote) h += UI.alert(st.readNote, 'info', { icon: 'scan' });
    if (st.used) h += invUsedHtml(st.used);
    h += '<div class="inv-fgrid">' + UI.input({ key: 'amount', label: 'Amount banked in (RM)', prefix: 'RM', value: st.amount, required: true, error: st.errs.amount || '', placeholder: held > 0 ? 'Up to ' + held.toFixed(2) : '0.00', attrs: { inputmode: 'decimal', autocomplete: 'off' }, help: held > 0 ? 'Up to ' + UI.fmt.money(held) + '. Part of the cash is fine.' : 'Nothing is held now, so check before banking anything in.' }) +
      UI.dateTimeField({ key: 'at', label: 'Day and time', value: st.at, max: NOW(), error: st.errs.at || '', chips: [{ label: 'Today', days: 0 }, { label: 'Yesterday', days: -1 }] }) + '</div>';
    if (amt > held + .004) h += UI.alert('This is more than ' + (st.staff === mine.id ? 'you hold' : (who ? who.name.split(' ')[0] + ' holds' : 'they hold')) + ' (' + (held < 0 ? 'nothing; the company owes ' + UI.fmt.money(-held) : UI.fmt.money(held)) + '). Check the amount. You will be asked for a reason.', 'warn');
    if (amt > 0 && st.slipAmt != null && Math.abs(amt - st.slipAmt) > .004) h += UI.alert('The slip says ' + UI.fmt.money(st.slipAmt) + '. Check the amount.', 'warn');
    h += UI.input({ key: 'ref', label: 'Bank reference (optional)', value: st.ref, placeholder: 'For example CDM482913' }) + UI.textarea({ key: 'note', label: 'Note (optional)', rows: 2, value: st.note });
    if (st.err) h += UI.alert(st.err, 'bad');
    return h + '</div>';
  };
  var sub = function () { var u = byId(D().users, st.staff), h0 = heldOf(st.staff); return h0 < -0.004 ? 'The company owes ' + (st.staff === mine.id ? 'you ' : (u ? u.name + ' ' : '')) + UI.fmt.money(-h0) : (st.staff === mine.id ? 'You hold ' : (u ? u.name : '') + ' holds ') + UI.fmt.money(h0) + ' in cash'; };
  var save = function (d, sure) {
    keep(d.body); st.err = ''; st.errs = {};
    var amt = invR2(String(st.amount).replace(/,/g, ''));
    /* every field at once: the slip, the amount and the time; the sheet scrolls to the first one and puts the cursor there */
    if (!st.slip) st.errs.slip = 'Add a photo or PDF of the bank slip.';
    if (!(amt > 0)) st.errs.amount = 'Enter the amount you paid into the bank.';
    if (!st.at) st.errs.at = 'Choose the day and time you paid the cash in.';
    else if (st.at > new Date(NOW().getTime() + 15 * 6e4)) st.errs.at = 'The day and time cannot be in the future.';
    if (st.used) st.err = invUsedText(st.used);
    var keys = ['slip', 'amount', 'at'].filter(function (k) { return st.errs[k]; });
    if (keys.length || st.err) {
      d.refresh();
      if (keys.length) UI.toast(keys.length > 1 ? 'Add the ' + keys.map(function (k) { return { slip: 'slip', amount: 'amount', at: 'day and time' }[k]; }).join(' and the ') + '.' : st.errs[keys[0]], { tone: 'warn' });
      var w = keys.length ? d.body.querySelector(keys[0] === 'slip' ? '[data-bin-slip]' : '[data-key="' + keys[0] + '"]') : d.body.querySelector('.alert.bad');
      if (w) { var box = w.closest('.inp') || w; try { box.scrollIntoView({ block: 'center' }); } catch (e1) { box.scrollIntoView(); } var fo = keys[0] === 'slip' ? box.querySelector('input[type="file"], button, [tabindex]') : box.querySelector('input:not([type="hidden"]), select'); if (fo) try { fo.focus({ preventScroll: true }); } catch (e2) { /* ignore */ } }
      return false;
    }
    /* more than the person holds, or not what the slip says: ask, with a reason that is kept on the bank-in */
    var held = heldOf(st.staff), who0 = byId(D().users, st.staff), whoN = st.staff === mine.id ? 'you hold' : (who0 ? who0.name.split(' ')[0] : 'They') + ' holds';
    var probs = [];
    if (amt > held + .004) probs.push(UI.fmt.money(amt) + ' is more than ' + whoN + ' (' + (held < 0 ? 'nothing; the company owes ' + UI.fmt.money(-held) : UI.fmt.money(held)) + ').');
    if (st.slipAmt != null && Math.abs(amt - st.slipAmt) > .004) probs.push('The slip says ' + UI.fmt.money(st.slipAmt) + ', not ' + UI.fmt.money(amt) + '.');
    if (probs.length && !sure) return UI.confirm({ title: 'Save this bank-in anyway?', text: probs.join(' ') + ' Save it anyway?', ok: 'Save anyway', cancel: 'Check the amount', input: { label: 'Reason', placeholder: 'For example: also banked in cash from last week', required: true, error: 'Say why the amount is different.' } })
      .then(function (why) { if (!why) return false; st.why = why; return save(d, true) !== false; });
    var who = byId(D().users, st.staff), n = (D().bankIns || []).length + 1; while (byId(D().bankIns, 'bin-' + n)) n++;
    var note = [(st.note || '').trim(), sure && st.why ? 'Reason for the amount: ' + st.why : ''].filter(Boolean).join(' · ');
    DB.add('bankIns', { id: 'bin-' + n, staff: st.staff, amount: amt, at: st.at, slip: { name: st.slip.name, size: st.slip.size, type: st.slip.type, dataUrl: st.slip.dataUrl, hash: st.slip.hash }, ref: (st.ref || '').trim(), note: note, slipAmount: st.slipAmt, voided: null, by: mine.id, recordedAt: NOW(), payments: [] },
      { first: true, where: 'Bank-in', text: mine.name + ' banked in ' + UI.fmt.money(amt) + ' cash' + (st.staff !== mine.id && who ? ' for ' + who.name : '') });
    UI.toast('Bank-in of ' + UI.fmt.money(amt) + ' saved.');
  };
  var dr = UI.drawer({ title: 'Bank in cash', subtitle: sub(), width: 460, body: function (el) { el.innerHTML = body(); setTimeout(mount, 0); }, foot: [{ label: 'Cancel', kind: 'o' }, { label: 'Save bank-in', icon: 'building-bank', onClick: function (d) { return save(d); } }], dirty: function () { return !!st.slip || !!st.amount; } });
  dr.el.classList.add('inv-bin');
  var redraw = function () { keep(dr.body); dr.refresh(); dr.setTitle('Bank in cash', sub()); };
  function mount() { var z = dr.body.querySelector('[data-dz]'); if (z && !z.firstChild) UI.dropzone(z, { accept: 'image/*,.pdf', label: 'Add the bank slip', hint: 'A photo or PDF. Big photos are made smaller.', camera: true, onFiles: function (fs) { UI.readImage(fs[0]).then(function (r) { keep(dr.body); st.errs.slip = ""; st.slip = invFileSlip(r); st.used = (D().bankIns || []).filter(function (b) { return !b.voided && b.slip && invSlipHash(b.slip) === st.slip.hash; }).map(function (b) { return { what: 'bank-in', booking: staffName(b.staff) + '\'s bank-in', at: b.at, payment: b.id }; })[0] || null; st.reading = !st.used && !/pdf/.test(r.type || ''); st.readNote = ''; dr.refresh(); if (st.reading) setTimeout(read, 1100); }); } }); }
  /* reading the slip is only a help (made up here): the amount, the day and the reference; the person checks them */
  function read() {
    if (dr.closed) return; keep(dr.body); st.reading = false;
    var held = heldOf(st.staff), parts = [];
    /* made up for the demo: the slip shows what the person holds. It fills an empty amount box, and is kept to compare */
    if (held > 0) { st.slipAmt = held; parts.push(UI.fmt.money(held)); if (!st.amount) st.amount = held.toFixed(2); }
    var t = new Date(NOW().getTime() - 40 * 6e4); t.setMinutes(Math.floor(t.getMinutes() / 15) * 15, 0, 0); st.at = t; parts.push(UI.fmt.dateTime(t));
    if (!st.ref) st.ref = 'CDM' + String(100000 + (Math.floor(NOW().getTime() / 1000) % 900000));
    st.readNote = parts.length ? 'Read from the slip: ' + parts.join(', ') + '. Check they are right.' : '';
    dr.refresh();
  }
  dr.body.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'staff') redraw(); else if (k === 'amount') invRedrawSoon(dr.body, redraw); });
  invUsedWire(dr.body);
  dr.body.addEventListener('click', function (ev) { if (ev.target.closest('[data-slip-rm]')) { keep(dr.body); st.slip = null; st.used = null; st.readNote = ''; st.slipAmt = null; dr.refresh(); } });
  return dr;
}
function invBankInSlip(b) { invSlipViewer({ title: 'Bank-in slip: ' + UI.fmt.money(b.amount) + ', ' + staffName(b.staff), amount: b.amount, booking: '', slips: [Object.assign({}, b.slip || { name: 'bank-in-slip.jpg', size: 0 }, { dataUrl: (b.slip && b.slip.dataUrl) || invBankInSvg(b) })] }); }
function invVoidBankIn(b) {
  if (!invCanVoidBankIn(b)) { UI.toast(b.by === me().id ? 'Only the office can void this bank-in now (your own can be voided within 24 hours).' : 'Only the office can void this bank-in.', { tone: 'warn' }); return; }
  var name = b.staff === me().id ? 'your' : staffName(b.staff) + '\'s';
  UI.confirm({ title: 'Void this bank-in?', text: UI.fmt.money(b.amount) + ' will not count any more, and the cash goes back to ' + name + ' cash held. The slip is kept.', ok: 'Void', cancel: 'Keep it', danger: true, input: { label: 'Why is it wrong?', placeholder: 'For example: recorded twice', required: true } }).then(function (reason) {
    if (!reason) return;
    DB.update('bankIns', b, { voided: { at: NOW(), by: me().id, reason: reason } }, { action: 'Changed', where: 'Bank-in', text: me().name + ' voided the bank-in of ' + UI.fmt.money(b.amount) + ' by ' + staffName(b.staff) + ': ' + reason });
    UI.toast('Bank-in voided.');
  });
}

/* ===================================================================
   The page
   =================================================================== */
function invLastSent(x) {
  var s = (x.sent || []).slice(-1)[0];
  if (!s) return '<span class="faint">Not sent yet</span>';
  return '<span class="inv-ls' + (s.ok === false ? ' bad' : '') + '">' + i(invChannelIcon(s.channel)) + '<span>' + esc(s.channel === 'Download' ? 'Downloaded' : s.channel) + (s.ok === false ? ' (failed)' : '') + '<small>' + esc(UI.fmt.ago(s.at)) + '</small></span></span>';
}
function invRowMenu(btn, kind, x, ctx) {
  var bk = x.booking, items = [{ label: 'Open booking', icon: 'calendar-event', onClick: function () { API.openBooking(bk); } }];
  if (kind === 'payment') {
    if ((x.slips || []).length) items.push({ label: 'View payment slip' + (x.slips.length > 1 ? 's' : ''), icon: 'paperclip', onClick: function () { invSlipViewer(x); } });
    items.push({ label: 'Add payment slip...', icon: 'photo-plus', disabled: !can('billing.record_payment') || !!x.void || x.method === 'Deposit adjustment', onClick: function () { invAddSlip(x); } });
    if (x.receipt) items.push({ label: 'Preview receipt ' + x.receipt, icon: 'eye', onClick: function () { invPreview(x.receipt); } });
    if (x.method === 'Deposit adjustment' && API.openDeposit) items.push({ label: 'Open the deposit of ' + (x.depositOf || bk), icon: 'cash-banknote', onClick: function () { API.openDeposit(x.depositOf || bk); } });
    items.push({ divider: true }, { label: 'Void payment...', icon: 'ban', danger: true, disabled: !can('billing.void') || !!x.void, hint: !can('billing.void') ? 'Needs "Void documents"' : x.void ? 'Already void' : '', onClick: function () { invVoid('payment', x); } });
  } else {
    var p = kind === 'receipt' ? invPayOf(x) : null, sl = kind === 'receipt' ? [].concat.apply([], invRcpPays(x).map(function (q) { return q.slips || []; })) : [];
    if (sl.length) items.push({ label: 'View payment slip' + (sl.length > 1 ? 's' : ''), icon: 'paperclip', onClick: function () { invSlipViewer({ amount: x.amount, booking: bk, slips: sl, ref: p && p.ref, at: p && p.at }); } });
    if (kind === 'invoice' && can('billing.record_payment')) items.push({ label: 'Record payment', icon: 'cash', onClick: function () { invRecordPayment(bk); } });
    if (kind === 'invoice' && x.status === 'Issued' && can('billing.issue_invoice')) items.push({ label: 'Update to the latest...', icon: 'refresh', onClick: function () { invCreateInvoice(bk); } });
    items.push({ label: 'Copy the PDF link', icon: 'link', disabled: x.status === 'Void', onClick: function () { UI.copy(invLink(x.no), { label: 'Link copied (valid for 14 days)' }); } });
    if (kind === 'receipt' && x.status === 'Issued' && can('billing.issue_receipt')) items.push({ label: 'Re-issue...', icon: 'file-plus', onClick: function () { invReissue(x); } });
    if (x.status === 'Issued' && can('billing.void')) items.push({ divider: true }, { label: 'Void...', icon: 'ban', danger: true, onClick: function () { invVoid(kind, x); } });
  }
  UI.menu(btn, items, { width: 260 });
}
function invMonthSum(list, when, val) { return sum(list.filter(function (x) { var d = when(x); return d && d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear(); }).map(val)); }

PAGES['invoices'] = {
  title: 'Invoices & Receipts',
  search: [
    { label: 'Upload payment slip', icon: 'upload', run: function () { invUploadSlips(); } },
    { label: 'Record payment', icon: 'cash', run: function () { invRecordPayment(''); } },
    { label: 'Create invoice', icon: 'file-plus', run: function () { invCreateInvoice(''); } },
    { label: 'Company details', icon: 'building', run: function () { invCompany(); } },
    { label: 'Cash held by staff', icon: 'wallet', run: function () { go('invoices', { tab: 'cash' }); } },
    { label: 'Bank-ins', icon: 'building-bank', run: function () { go('invoices', { tab: 'bankins' }); } }
  ],
  render: function (root, ctx) {
    var d = ctx.data, P = ctx.params, st = ctx.state;
    var tab = P.tab || 'invoices'; if ((tab === 'cash' || tab === 'bankins') && !can('billing.manage_cash')) tab = 'invoices';
    var f = { q: P.q || '', status: P.status || '', kind: P.kind || '', slip: P.slip || '', from: P.from || '', to: P.to || '' };
    var miss = invMissing();
    var held = invCashRows(), heldTotal = sum(held.filter(function (g) { return g.held > 0; }).map(function (g) { return g.held; }));
    var counts = { invoices: d.invoices.length, receipts: d.receipts.length, payments: d.payments.length, bankins: (d.bankIns || []).length };
    var monthInv = d.invoices.filter(function (v) { return v.status !== 'Void' && v.issued.getMonth() === TODAY.getMonth() && v.issued.getFullYear() === TODAY.getFullYear(); });
    root.innerHTML = '<div class="pg-h"><div><h1>Invoices &amp; Receipts</h1><p>An invoice lists what a booking charges. A receipt records money received: one per booking, a line for each payment.</p></div><div class="acts">' +
      (can('billing.record_payment') ? UI.btn('Record payment', { kind: 'o', icon: 'cash', attrs: { 'data-act': 'record' } }) + UI.btn('Upload payment slip', { icon: 'upload', attrs: { 'data-act': 'slips' } }) : '') +
      (can('billing.settings') ? UI.btn('Company details', { kind: 'tonal', icon: 'building', attrs: { 'data-act': 'company' } }) : '') + '</div></div>' +
      (miss.length ? '<div class="inv-banner">' + UI.alert('Company details are incomplete. Invoices and receipts print them, so fill in the missing details (' + miss.length + ' to go: ' + miss.join(', ') + ') before sending documents to customers.', 'warn', { action: can('billing.settings') ? UI.btn('Complete company details', { kind: 't', size: 'sm', attrs: { 'data-act': 'company' } }) : '' }) + '</div>' : '') +
      '<div class="inv-kpis">' +
      UI.stat({ label: 'Invoiced this month', value: UI.fmt.money(sum(monthInv.map(invTotal))), note: plural(monthInv.length, 'invoice'), icon: 'file-invoice' }) +
      UI.stat({ label: 'Received this month', value: UI.fmt.money(invMonthSum(d.payments.filter(function (p) { return !p.void && p.method !== 'Deposit adjustment'; }), function (p) { return p.at; }, function (p) { return p.amount; })), note: 'Deposits and charges', icon: 'cash', tone: 'ok' }) +
      UI.stat({ label: 'Payments without receipt', value: String(d.payments.filter(function (p) { return !p.void && !p.receipt; }).length), note: 'Create them on Payments', icon: 'receipt-off', tone: 'warn', attrs: { 'data-go-tab': 'payments', 'data-go-f': 'norcp' } }) +
      (can('billing.manage_cash') ? UI.stat({ label: 'Cash held by staff', value: UI.fmt.money(heldTotal), note: 'Not banked in yet', icon: 'wallet', tone: 'info', attrs: { 'data-go-tab': 'cash' } }) : '') + '</div>' +
      '<div class="card"><div class="inv-tabs" id="inv-tabs"></div><div id="inv-f"></div><div id="inv-t"></div></div>';

    UI.tabs(root.querySelector('#inv-tabs'), { value: tab, items: [{ id: 'invoices', label: 'Invoices', icon: 'file-invoice', count: counts.invoices, tone: 'grey' }, { id: 'receipts', label: 'Receipts', icon: 'receipt', count: counts.receipts, tone: 'grey' }, { id: 'payments', label: 'Payments', icon: 'credit-card', count: counts.payments, tone: 'grey' }, { id: 'cash', label: 'Cash held by staff', icon: 'wallet', hidden: !can('billing.manage_cash'), count: held.length || null, tone: 'warn' }, { id: 'bankins', label: 'Bank-ins', icon: 'building-bank', hidden: !can('billing.manage_cash'), count: counts.bankins || null, tone: 'grey' }],
      onChange: function (id) { st.page = 1; ctx.setParams({ tab: id, status: null, kind: null, slip: null, page: null }); ctx.refresh(); } });

    var tEl = root.querySelector('#inv-t');
    if (tab === 'cash') {
      var np = sum(held.map(function (g) { return g.n; }));
      root.querySelector('#inv-f').innerHTML = '<div class="inv-cash-h"><div class="grow"><h3>Cash held by staff</h3><p class="b2">Company cash a member of staff has and is not in the bank yet: cash from customers and from the company, less what they paid for the company in cash and their own handover fees. It is the same balance as Staff income and expenses. Staff record what they pay in with "Bank in cash" and the slip: any amount, at any time.' + (held.length ? ' In total ' + UI.fmt.money(heldTotal) + ', from ' + plural(np, 'cash payment') + '.' : '') + '</p></div>' + UI.btn('Bank in cash', { icon: 'building-bank', attrs: { 'data-bankin': '' } }) + '</div>';
      UI.table(tEl, { rows: held, rowKey: 'id', pageSize: false, minWidth: 760, density: 'compact',
        columns: [{ key: 'name', label: 'Staff', render: function (g) { return '<span class="row gap8">' + UI.avatar(g.name) + '<b class="fw5">' + esc(g.name) + '</b></span>'; } },
          { key: 'n', label: 'Cash payments', align: 'center', render: function (g) { return String(g.n); } },
          { key: 'cashIn', label: 'Cash received', money: true, render: function (g) { return UI.money(g.cashIn) + (g.fromCo ? '<div class="b2 nw">' + UI.fmt.money(g.fromCo) + ' from the company</div>' : ''); } },
          { key: 'paidOut', label: 'Spent or kept', money: true, render: function (g) { var bits = [g.spent ? UI.fmt.money(g.spent) + ' expenses' : '', g.fees ? UI.fmt.money(g.fees) + ' own fees' : '', g.refunded ? UI.fmt.money(g.refunded) + ' refunds' : ''].filter(Boolean); return UI.money(g.paidOut) + (bits.length ? '<div class="b2">' + bits.join(', ') + '</div>' : ''); } },
          { key: 'banked', label: 'Banked in', money: true },
          { key: 'held', label: 'Held', money: true, render: function (g) { return g.held < 0 ? '<b class="inv-badt">Owed ' + UI.money(-g.held) + '</b>' : '<b>' + UI.money(g.held) + '</b>'; } },
          { key: 'last', label: 'Last bank-in', render: function (g) { return g.last ? esc(UI.fmt.date(g.last)) + '<div class="b2">' + esc(UI.fmt.ago(g.last)) + '</div>' : '<span class="faint">None yet</span>'; } },
          { key: 'act', label: '', align: 'right', render: function (g) { return UI.btn('Bank in', { kind: 'o', size: 'sm', icon: 'building-bank', attrs: { 'data-bankin': g.id, 'data-stop': '1' } }); } }],
        card: function (g) { return '<div class="row gap8">' + UI.avatar(g.name) + '<div class="grow"><b>' + esc(g.name) + '</b><div class="b2">' + plural(g.n, 'cash payment') + (g.banked ? ' · banked in ' + UI.fmt.money(g.banked) : '') + '</div></div><b class="nw">' + (g.held < 0 ? 'Owed ' + UI.money(-g.held) : UI.money(g.held)) + '</b></div><div class="row" style="justify-content:flex-end;margin-top:8px">' + UI.btn('Bank in', { kind: 'o', size: 'sm', icon: 'building-bank', attrs: { 'data-bankin': g.id } }) + '</div>'; },
        empty: { icon: 'wallet-off', title: 'No cash is being held', text: 'When a payment is recorded as cash to a member of staff, it appears here until they bank it in.' } });
    } else if (tab === 'bankins') {
      var bq = { q: P.q || '', status: P.status || '' };
      var bfilter = function () { var q = (bq.q || '').toLowerCase().trim(); return (d.bankIns || []).filter(function (b) { if (bq.status === 'active' && b.voided) return false; if (bq.status === 'void' && !b.voided) return false; return !q || (staffName(b.staff) + ' ' + (b.ref || '') + ' ' + (b.note || '') + ' ' + b.amount.toFixed(2)).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return b.at - a.at; }); };
      var thumb = function (b) { return '<button type="button" class="inv-bin-th" data-binslip="' + esc(b.id) + '" data-stop aria-label="View the bank slip">' + '<img src="' + esc(b.slip && b.slip.dataUrl && !/pdf/.test(b.slip.type || '') ? b.slip.dataUrl : invBankInSvg(b)) + '" alt="">' + '</button>'; };
      var vbtn = function (b) { return b.voided ? UI.chip('Voided', 'bad', { title: b.voided.reason }) : invCanVoidBankIn(b) ? UI.btn('Void', { kind: 't', size: 'sm', cls: 'inv-void', attrs: { 'data-binvoid': b.id, 'data-stop': '1' } }) : ''; };
      var bt = UI.table(tEl, { rows: bfilter(), rowKey: 'id', density: 'compact', pageSize: 10, minWidth: 820,
        columns: [{ key: 'slip', label: 'Slip', render: thumb },
          { key: 'amount', label: 'Amount', money: true, sort: true, render: function (b) { return '<b class="fw5' + (b.voided ? ' inv-strike' : '') + '">' + UI.money(b.amount) + '</b>'; } },
          { key: 'at', label: 'Banked in on', sort: true, render: function (b) { return esc(invDT(b.at)); } },
          { key: 'staff', label: 'Whose cash', render: function (b) { return '<span class="row gap8">' + UI.avatar(staffName(b.staff)) + esc(staffName(b.staff)) + '</span>'; } },
          { key: 'ref', label: 'Reference / note', render: function (b) { return esc(b.ref || '-') + (b.note ? '<div class="b2">' + esc(b.note) + '</div>' : '') + (b.voided ? '<div class="b2 inv-badt">Voided: ' + esc(b.voided.reason) + '</div>' : ''); } },
          { key: 'by', label: 'Recorded by', render: function (b) { return esc(staffName(b.by)); } },
          { key: 'v', label: '', align: 'right', render: vbtn }],
        card: function (b) { return '<div class="row gap10">' + thumb(b) + '<div class="grow"><b class="' + (b.voided ? 'inv-strike' : '') + '">' + UI.money(b.amount) + '</b> <span class="b2">' + esc(staffName(b.staff)) + '</span><div class="b2">' + esc(invDT(b.at)) + (b.ref ? ' · Ref ' + esc(b.ref) : '') + (b.note ? ' · ' + esc(b.note) : '') + '</div></div>' + vbtn(b) + '</div>'; },
        onRowClick: function (b) { invBankInSlip(b); },
        empty: { icon: 'building-bank', title: 'No bank-ins yet', text: 'When someone pays cash into the bank with "Bank in cash", it is listed here with the slip.' } });
      UI.filters(root.querySelector('#inv-f'), { values: bq, fields: [{ type: 'search', key: 'q', placeholder: 'Name, reference, amount...' }, { type: 'select', key: 'status', label: 'Status', all: 'All bank-ins', options: [['active', 'Counted'], ['void', 'Voided']] }], onChange: function (v) { ctx.setParams({ q: v.q || null, status: v.status || null }); bt.setRows(bfilter()); },
        extra: '<span class="grow"></span>' + UI.btn('Bank in cash', { kind: 't', size: 'sm', icon: 'building-bank', attrs: { 'data-bankin': '' } }) });
    } else {
      var fields = [{ type: 'search', key: 'q', placeholder: tab === 'payments' ? 'Customer, booking, reference...' : 'Number, customer, booking, plate...' },
        { type: 'select', key: 'status', label: 'Status', all: 'All statuses', options: tab === 'payments' ? ['Active', 'Void'] : ['Issued', 'Void'] }];
      if (tab !== 'invoices') fields.push({ type: 'select', key: 'kind', label: 'Type', all: 'All types', options: INV_KINDS });
      if (tab === 'payments') fields.push({ type: 'select', key: 'slip', label: 'Payment slip', all: 'All payments', options: [['with', 'With a slip'], ['without', 'Without a slip'], ['norcp', 'Without a receipt'], ['adj', 'Adjustment from deposit']] });
      fields.push({ type: 'daterange', from: 'from', to: 'to', label: 'From' });
      var hasKind = function (x) { return (tab === 'receipts' ? invRcpPays(x) : [x]).some(function (p) { return invItems(p).some(function (it) { return it.kind === f.kind; }); }); };
      var filter = function () {
        var q = (f.q || '').toLowerCase().trim(), fr = f.from ? UI.parseDate(f.from) : null, to = f.to ? new Date(UI.parseDate(f.to).getTime() + DAY) : null;
        var list = tab === 'invoices' ? d.invoices : tab === 'receipts' ? d.receipts : d.payments;
        return list.filter(function (x) {
          var bk = findBooking(x.booking) || { cust: { name: '', phone: '' }, car: { plate: '', make: '', model: '' } }, when = x.issued || x.at;
          if (f.status) { var s = tab === 'payments' ? (x.void ? 'Void' : 'Active') : x.status; if (s !== f.status) return false; }
          if (f.kind && !hasKind(x)) return false;
          if (f.slip === 'with' && !(x.slips || []).length) return false; if (f.slip === 'without' && (x.slips || []).length) return false;
          if (f.slip === 'norcp' && (x.receipt || x.void)) return false; if (f.slip === 'adj' && x.method !== 'Deposit adjustment') return false;
          if (fr && when < fr) return false; if (to && when >= to) return false;
          if (q && (String(x.no || '') + ' ' + x.booking + ' ' + bk.cust.name + ' ' + bk.cust.phone + ' ' + bk.car.plate + ' ' + (x.ref || '') + ' ' + (x.receipt || '')).toLowerCase().indexOf(q) < 0 && !matchBookingCode(tidySearch(q), x.booking)) return false;
          return true;
        }).sort(function (a, b) { return (b.issued || b.at) - (a.issued || a.at); });
      };
      var acts = function (x, kind) {
        var sl = kind === 'receipt' ? sum(invRcpPays(x).map(function (p) { return (p.slips || []).length; })) : 0;
        return '<span class="icons" data-stop>' + UI.iconBtn('eye', 'Preview', { size: 'sm', attrs: { 'data-prev': x.no } }) + UI.iconBtn('download', 'Download PDF', { size: 'sm', attrs: { 'data-dl': x.no } }) +
          (sl ? UI.iconBtn('paperclip', sl > 1 ? 'View ' + sl + ' payment slips' : 'View payment slip', { size: 'sm', attrs: { 'data-rslips': x.no } }) : '') +
          UI.iconBtn('send', x.status === 'Void' ? 'A void document cannot be sent' : 'Send', { size: 'sm', disabled: x.status === 'Void' || !can('billing.send'), attrs: { 'data-send': x.no } }) + UI.iconBtn('dots-vertical', 'More', { size: 'sm', attrs: { 'data-more': kind + ':' + x.no } }) + '</span>';
      };
      var bkCell = function (x) { var bk = findBooking(x.booking); return '<span class="inv-code">' + esc(x.booking) + '</span><div class="b2">' + esc(bk ? invCarLabel(bk.car) : '') + '</div>'; };
      var custCell = function (x) { var bk = findBooking(x.booking); return bk ? esc(bk.cust.name) + '<div class="b2">' + UI.phone(bk.cust.phone) + '</div>' : ''; };
      var cols, card, empty;
      if (tab === 'invoices') {
        cols = [{ key: 'no', label: 'Invoice / date', sort: function (x) { return x.issued; }, render: function (x) { return '<b class="fw5 t1c">' + esc(x.no) + '</b><div class="b2">' + esc(UI.fmt.date(x.issued)) + '</div>'; } },
          { key: 'cust', label: 'Customer', render: custCell }, { key: 'booking', label: 'Booking / car', render: bkCell },
          { key: 'amt', label: 'Amount', money: true, sort: function (x) { return invTotal(x); }, render: function (x) { return '<b class="fw5">' + UI.money(invTotal(x)) + '</b>' + (x.deposit ? '<div class="b2 nw">+ ' + UI.fmt.money(x.deposit) + ' deposit</div>' : ''); } },
          { key: 'status', label: 'Status', render: function (x) { return UI.status('doc', x.status, null, { attrs: x.voidReason ? { title: 'Void: ' + x.voidReason } : null }); } },
          { key: 'sent', label: 'Last sent', render: invLastSent }, { key: 'a', label: 'Actions', render: function (x) { return acts(x, 'invoice'); } }];
        card = function (x) { var bk = findBooking(x.booking); return '<div class="row"><b class="grow">' + esc(x.no) + '</b>' + UI.status('doc', x.status) + '</div><div class="b2">' + esc(UI.fmt.date(x.issued)) + ' · ' + esc(x.booking) + ' · ' + esc(bk.cust.name) + '</div><div class="row"><b class="grow">' + UI.money(invTotal(x)) + '</b>' + acts(x, 'invoice') + '</div>'; };
        empty = f.q || f.status || f.from || f.to ? { icon: 'filter-off', title: 'No invoices match', text: 'Clear the filters to see every invoice.' } : { icon: 'file-invoice', title: 'No invoices yet', text: 'Create one from a booking: open the booking and choose Create invoice.' };
      } else if (tab === 'receipts') {
        cols = [{ key: 'no', label: 'Receipt / date', sort: function (x) { return x.issued; }, render: function (x) { var iv = invInvoiceOf(x.booking); return '<b class="fw5 t1c">' + esc(x.no) + '</b><div class="b2">' + esc(UI.fmt.date(x.issued)) + (iv ? ' · for ' + esc(iv.no) : '') + '</div>'; } },
          { key: 'cust', label: 'Customer', render: custCell }, { key: 'booking', label: 'Booking / car', render: bkCell },
          { key: 'amt', label: 'Amount', money: true, sort: function (x) { return x.amount; }, render: function (x) { var n = (x.status === 'Void' ? invRcpPays(x) : invRcpLive(x)).length; return '<b class="fw5">' + UI.money(x.amount) + '</b><div class="b2">' + (n > 1 ? plural(n, 'payment') : esc(x.kind)) + '</div>'; } },
          { key: 'status', label: 'Status', render: function (x) { return UI.status('doc', x.status, null, { attrs: x.voidReason ? { title: x.voidReason } : null }); } },
          { key: 'sent', label: 'Last sent', render: invLastSent }, { key: 'a', label: 'Actions', render: function (x) { return acts(x, 'receipt'); } }];
        card = function (x) { var bk = findBooking(x.booking); return '<div class="row"><b class="grow">' + esc(x.no) + '</b>' + UI.status('doc', x.status) + '</div><div class="b2">' + esc(UI.fmt.date(x.issued)) + ' · ' + esc(x.booking) + ' · ' + esc(bk.cust.name) + '</div><div class="b2">' + esc(x.kind) + ' · ' + esc(x.method) + '</div><div class="row"><b class="grow">' + UI.money(x.amount) + '</b>' + acts(x, 'receipt') + '</div>'; };
        empty = f.q || f.status || f.kind || f.from ? { icon: 'filter-off', title: 'No receipts match', text: 'Clear the filters to see every receipt.' } : { icon: 'receipt', title: 'No receipts yet', text: 'A receipt is created when you record a payment on a booking.' };
      } else {
        var amtCell = function (p) { return '<b class="fw5' + (p.void ? ' inv-strike' : '') + '">' + UI.money(p.amount) + '</b>'; };
        var whatCell = function (p) { return esc(invKindsText(p)) + '<div class="b2">' + esc(methodLabel(p.method) + (p.ref ? ' · ' + p.ref : '')) + '</div><div class="b2">' + esc(p.method === 'Deposit adjustment' ? 'From the deposit of ' + (p.depositOf || p.booking) : p.depositedTo || '') + (p.afterCharge ? ' · ' + UI.fmt.money(p.afterCharge) + ' after charge' : '') + '</div>'; };
        var slipCell = function (p) { var n = (p.slips || []).length; if (n) return '<button type="button" class="inv-slipchip" data-slips="' + p.id + '" data-stop>' + i('paperclip') + (n > 1 ? n + ' slips' : 'Slip') + '</button>'; return can('billing.record_payment') && !p.void && p.method !== 'Deposit adjustment' ? '<button type="button" class="inv-slipchip add" data-addslip="' + p.id + '" title="Keep the bank slip with this payment" data-stop>' + i('plus') + 'Add slip</button>' : '<span class="faint">-</span>'; };
        var rcpCell = function (p) { if (p.void) return '<span class="faint">Voided</span>'; return p.receipt ? '<button type="button" class="inv-link" data-prev="' + esc(p.receipt) + '" data-stop>' + esc(p.receipt) + '</button>' : '<span class="faint">No receipt</span>'; };
        var pacts = function (p) { return '<span class="icons" data-stop>' + (p.receipt ? UI.iconBtn('eye', 'Preview receipt', { size: 'sm', attrs: { 'data-prev': p.receipt } }) + UI.iconBtn('send', 'Send receipt', { size: 'sm', disabled: !!p.void || !can('billing.send'), attrs: { 'data-send': p.receipt } }) : UI.iconBtn('receipt', 'Put this payment on the booking\'s receipt', { size: 'sm', disabled: !!p.void || !can('billing.issue_receipt'), attrs: { 'data-mkrcp': p.id } })) + UI.iconBtn('dots-vertical', 'More', { size: 'sm', attrs: { 'data-more': 'payment:' + p.id } }) + '</span>'; };
        cols = [{ key: 'at', label: 'Received', sort: true, render: function (p) { return esc(invDT(p.at)) + '<div class="b2">by ' + esc(p.by) + '</div>'; } },
          { key: 'cust', label: 'Customer', render: function (p) { var bk = findBooking(p.booking); return esc(bk ? bk.cust.name : ''); } },
          { key: 'booking', label: 'Booking / car', render: function (p) { var bk = findBooking(p.booking); return '<span class="inv-code">' + esc(p.booking) + '</span><div class="b2">' + esc(bk ? bk.car.plate : '') + '</div>'; } },
          { key: 'amount', label: 'Amount', money: true, sort: true, render: amtCell }, { key: 'what', label: 'What for / method', render: whatCell }, { key: 'st', label: 'Status', render: function (p) { return UI.status('doc', p.void ? 'Void' : 'Active', null, { attrs: p.void ? { title: 'Void: ' + p.void.reason } : null }); } },
          { key: 'rcp', label: 'Receipt', render: rcpCell }, { key: 'slip', label: 'Slip', render: slipCell }, { key: 'a', label: 'Actions', render: pacts }];
        card = function (p) { var bk = findBooking(p.booking); return '<div class="row"><b class="grow">' + UI.money(p.amount) + '</b>' + UI.status('doc', p.void ? 'Void' : 'Active') + '</div><div class="b2">' + esc(invDT(p.at)) + ' · ' + esc(p.booking) + ' · ' + esc(bk ? bk.cust.name : '') + '</div><div class="b2">' + esc(invKindsText(p) + ' · ' + methodLabel(p.method)) + '</div><div class="row wrap">' + slipCell(p) + rcpCell(p) + '<span class="grow"></span>' + pacts(p) + '</div>'; };
        empty = f.q || f.status || f.kind || f.slip || f.from ? { icon: 'filter-off', title: 'No payments match', text: 'Clear the filters to see every payment.' } : { icon: 'cash-off', title: 'No payments recorded yet', text: 'Record the money you receive from a booking, or upload the bank slip and pick the booking, and it shows up here.' };
      }
      var t = UI.table(tEl, { columns: cols, rows: filter(), rowKey: tab === 'payments' ? 'id' : 'no', density: 'compact', pageSize: +P.size || 10, page: +P.page || 1, minWidth: tab === 'payments' ? 1120 : 980, card: card, empty: empty,
        onRowClick: function (x) { if (tab === 'payments') { if (x.receipt) invPreview(x.receipt); else if ((x.slips || []).length) invSlipViewer(x); } else invPreview(x.no); },
        onPage: function (pg) { ctx.setParams({ page: pg > 1 ? pg : null }); } });
      UI.filters(root.querySelector('#inv-f'), { values: f, fields: fields, onChange: function (v) { ctx.setParams({ q: v.q || null, status: v.status || null, kind: v.kind || null, slip: v.slip || null, from: v.from || null, to: v.to || null, page: null }); t.setRows(filter()); },
        extra: '<span class="grow"></span>' + (tab === 'invoices' && can('billing.issue_invoice') ? UI.btn('Create invoice', { kind: 't', size: 'sm', icon: 'file-plus', attrs: { 'data-act': 'create' } }) : '') });
      tEl.addEventListener('change', function (ev) { if (ev.target.matches('[data-ui-size]')) ctx.setParams({ size: ev.target.value }); });
    }

    UI.on(root, 'click', '[data-act]', function (ev, el) { var a = el.getAttribute('data-act'); if (a === 'record') invRecordPayment(''); else if (a === 'slips') invUploadSlips(); else if (a === 'company') invCompany(); else if (a === 'create') invCreateInvoice(''); });
    UI.on(root, 'click', '[data-go-tab]', function (ev, el) { ctx.setParams({ tab: el.getAttribute('data-go-tab'), status: null, kind: null, slip: el.getAttribute('data-go-f') || null, page: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-prev]', function (ev, el) { invPreview(el.getAttribute('data-prev')); });
    UI.on(root, 'click', '[data-dl]', function (ev, el) { var no = el.getAttribute('data-dl'), x = invDoc(no); invDocPdf(invModel(no)); if (x) invLogSent(x, 'Download', ''); });
    UI.on(root, 'click', '[data-send]', function (ev, el) { invSend(el.getAttribute('data-send')); });
    UI.on(root, 'click', '[data-slips]', function (ev, el) { invSlipViewer(byId(d.payments, el.getAttribute('data-slips'))); });
    UI.on(root, 'click', '[data-rslips]', function (ev, el) { var r = invDoc(el.getAttribute('data-rslips')), pays = invRcpPays(r), sl = []; pays.forEach(function (p) { (p.slips || []).forEach(function (s) { sl.push(s); }); }); var p0 = pays.filter(function (p) { return (p.slips || []).length; })[0]; invSlipViewer({ amount: p0.amount, booking: r.booking, ref: p0.ref, at: p0.at, slips: sl }); });
    UI.on(root, 'click', '[data-addslip]', function (ev, el) { invAddSlip(byId(d.payments, el.getAttribute('data-addslip'))); });
    UI.on(root, 'click', '[data-mkrcp]', function (ev, el) { var p = byId(d.payments, el.getAttribute('data-mkrcp')); var r = invMakeReceipt(p); setTimeout(function () { invPreview(r.no); }, 60); });
    UI.on(root, 'click', '[data-more]', function (ev, el) { var pr = el.getAttribute('data-more').split(':'), kind = pr[0], id = pr.slice(1).join(':'); invRowMenu(el, kind, kind === 'payment' ? byId(d.payments, id) : invDoc(id), ctx); });
    UI.on(root, 'click', '[data-bankin]', function (ev, el) { invBankInSheet(el.getAttribute('data-bankin') || null); });
    UI.on(root, 'click', '[data-binslip]', function (ev, el) { invBankInSlip(byId(d.bankIns, el.getAttribute('data-binslip'))); });
    UI.on(root, 'click', '[data-binvoid]', function (ev, el) { invVoidBankIn(byId(d.bankIns, el.getAttribute('data-binvoid'))); });

    /* links from other pages: #page=invoices&action=record&booking=KLT-00412, &doc=INV-..., &action=send, &action=bankin&staff= */
    var a = P.action, code = P.booking, doc = P.doc, staff = P.staff;
    if (a || doc) {
      ctx.setParams({ action: null, booking: null, doc: null, staff: null });
      setTimeout(function () {
        if (a === 'record') invRecordPayment(code || ''); else if (a === 'slips') invUploadSlips(); else if (a === 'create') invCreateInvoice(code || ''); else if (a === 'company') invCompany();
        else if (a === 'bankin') invBankInSheet(staff || null);
        else if (a === 'send' && doc) invSend(doc); else if (doc) invPreview(doc);
      }, 30);
    }
  }
};

/* openers other pages use (see BUILDERS.md section 3 and CONTRACT.md) */
API.recordPayment = function (code) { invRecordPayment(code || ''); };
API.uploadSlips = function () { invUploadSlips(); };
API.createInvoice = function (code) { invCreateInvoice(code || ''); };
API.previewDoc = function (no) { invPreview(no); };
API.sendDoc = function (no) { invSend(no); };
API.companyDetails = function () { invCompany(); };
API.addSlip = function (paymentId) { var p = byId(D().payments, paymentId); if (p) invAddSlip(p); };
API.viewSlips = function (paymentId) { var p = byId(D().payments, paymentId); if (p) invSlipViewer(p); };
API.bankIn = function (userId) { invBankInSheet(userId || null); };
/* for the staff report's own list of bank-ins: the recorder can void their own within 24 hours */
API.viewBankIn = function (id) { var b = byId(D().bankIns || [], id); if (b) invBankInSlip(b); };
API.voidBankIn = function (id) { var b = byId(D().bankIns || [], id); if (b) invVoidBankIn(b); };
API.canVoidBankIn = function (id) { var b = byId(D().bankIns || [], id); return !!b && invCanVoidBankIn(b); };
API.voidPayment = function (paymentId) { var p = byId(D().payments, paymentId); if (p) invVoid('payment', p); };
window.invBankInSheet = invBankInSheet;
window.addEventListener('resize', UI.debounce(function () { invFit(document.getElementById('ui-layer')); }, 120));

/* ---------------- data: one receipt per booking (older per-payment receipts combined), and one invoice the booking outgrew ---------------- */
DATA_INIT.push(function (d) {
  if (d._invCombined) return; d._invCombined = true;
  var pay = function (id) { for (var k = 0; k < d.payments.length; k++) if (d.payments[k].id === id) return d.payments[k]; return null; };
  var keep = [], byBk = {};
  d.receipts.slice().sort(function (a, b) { return a.issued - b.issued; }).forEach(function (r) {
    var p = pay(r.payment);
    if (!p || p.summons) { r.payments = r.payments || [r.payment]; keep.push(r); return; }
    var g = byBk[r.booking];
    if (!g) { g = byBk[r.booking] = r; r.payments = [r.payment]; keep.push(r); }
    else { g.payments.push(r.payment); g.sent = g.sent.concat(r.sent || []); }
  });
  /* renumber in issue order so there are no gaps, then point each payment at its receipt */
  var y = TODAY.getFullYear(), n = 0;
  keep.sort(function (a, b) { return a.issued - b.issued; }).forEach(function (r) {
    r.no = r.id = 'RCP-' + y + '-' + String(++n).padStart(5, '0');
    var all = r.payments.map(pay).filter(Boolean), live = all.filter(function (p) { return !p.void; });
    all.forEach(function (p) { p.receipt = r.no; });
    r.payment = r.payments[0];
    var useIt = live.length ? live : all, kinds = [], methods = [];
    useIt.forEach(function (p) { (p.items || [{ kind: p.kind }]).forEach(function (it) { if (kinds.indexOf(it.kind) < 0) kinds.push(it.kind); }); var m = methodLabel(p.method); if (methods.indexOf(m) < 0) methods.push(m); });
    r.amount = Math.round(sum(useIt.map(function (p) { return p.amount; })) * 100) / 100;
    r.kind = kinds.length > 2 ? kinds[0] + ' and ' + (kinds.length - 1) + ' more' : kinds.join(' + '); r.method = methods.join(' + ');
    if (!live.length) { r.status = 'Void'; r.voidReason = r.voidReason || 'Every payment on it was voided'; } else if (r.status === 'Void' && r.voidReason === 'The payment was voided') { r.status = 'Issued'; r.voidReason = ''; }
  });
  d.receipts = keep;
  (d.summons || []).forEach(function (s) { if (s.payment) { var p = pay(s.payment); if (p && p.receipt) s.receipt = p.receipt; } });
  /* a booking extended by a day after its invoice was issued: Create invoice offers "Update the invoice" */
  var iv = d.invoices.filter(function (v) { var x = findBooking(v.booking, d); return v.status === 'Issued' && x && x.status === 'Car Delivered' && x.days >= 3; })[0];
  if (iv && iv.lines[0]) { var x = findBooking(iv.booking, d), r0 = iv.lines[0], u = r0.unit || x.rate; r0.qty = x.days - 1; r0.amount = Math.round((r0.amount - u) * 100) / 100; r0.desc = 'Car rental: ' + plural(x.days - 1, 'day') + ' x RM ' + Number(u).toFixed(2); iv.charges = Math.round(sum(iv.lines.map(function (l) { return l.amount; })) * 100) / 100; }
});

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
  if (pays.length) {
    blocks.push({ t: 'heading', text: 'PAYMENTS RECEIVED' });
    blocks.push({ t: 'table', columns: [{ label: 'Paid on', w: 26 }, { label: 'Description', w: 42 }, { label: 'Method', w: 34 }, { label: 'Reference', w: 44 }, { label: 'Amount (RM)', w: 32, align: 'right' }],
      rows: pays.map(function (p) { return [UI.fmt.date(p.at), p.kind === 'Security deposit' ? 'Security deposit (refundable)' : p.kind, p.method, p.ref || '-', invMoney(p.amount)]; }) });
  }
  blocks.push({ t: 'totals', rows: [{ l: 'Total paid', v: 'RM ' + invMoney(paid) }, { l: 'Balance due', v: due <= 0 ? 'Paid in full' : 'RM ' + invMoney(due), style: 'strong' }] });
  if (iv.note) blocks.push({ t: 'status', text: iv.note });
  blocks.push({ t: 'end', lines: [(co.footers && co.footers.invoice) || 'Thank you for renting with ' + B().name + '.'].concat(invLegalLines('invoice')) });
  return { kind: 'invoice', title: 'INVOICE', no: iv.no, meta: [['Date', UI.fmt.date(iv.issued)], ['Booking ID', iv.booking]], blocks: blocks, footer: invFooter(iv.no), watermark: iv.status === 'Void' ? 'VOID' : '' };
}
function invReceiptModel(r) {
  var x = findBooking(r.booking), co = invCo(), p = invPayOf(r);
  var rows = [['1.', r.kind === 'Security deposit' ? 'Security deposit (refundable)' : r.kind, r.method, invDT(p ? p.at : r.issued), (p && p.ref) || '-', invMoney(r.amount)]];
  var blocks = [
    { t: 'parties', from: invFrom(), to: { title: 'RECEIVED FROM', lines: [x.cust.name, 'Tel: ' + x.cust.phone, x.cust.email] } },
    invCarBlock(x),
    { t: 'table', columns: [{ label: 'Sl.', w: 10 }, { label: 'Description', w: 50 }, { label: 'Method', w: 32 }, { label: 'Paid on', w: 40 }, { label: 'Reference', w: 36 }, { label: 'Amount (RM)', w: 30, align: 'right' }], rows: rows },
    { t: 'amount', label: 'AMOUNT RECEIVED', amount: 'RM ' + invMoney(r.amount), words: UI.fmt.words(r.amount) }
  ];
  if (p && p.depositedTo) blocks.splice(3, 0, { t: 'status', text: 'Received into: ' + p.depositedTo + (p.afterCharge ? '. After the card charge: RM ' + invMoney(p.afterCharge) + '.' : '.') });
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

/* ---------------- void (invoice, receipt, payment) ---------------- */
function invVoid(kind, rec) {
  var name = kind === 'payment' ? 'the payment of ' + UI.fmt.money(rec.amount) + ' on ' + rec.booking : kind + ' ' + rec.no;
  var info = kind === 'payment' ? 'The receipt for this payment is voided too. The booking\'s payment status is not changed: change it on the booking if needed.' : kind === 'invoice' ? 'You can create a new invoice for the booking afterwards.' : 'The payment stays recorded. You can issue a fresh receipt for it afterwards.';
  return UI.confirm({ title: 'Void ' + kind, text: 'Void ' + name + '? It stays on record, marked VOID, and cannot be sent again.', html: UI.alert(info, 'info'), ok: 'Void', danger: true, width: 'md', input: { label: 'Reason', placeholder: 'For example: wrong customer name', required: true } }).then(function (reason) {
    if (!reason) return false;
    if (kind === 'payment') {
      DB.update('payments', rec, { void: { at: NOW(), by: me().name, reason: reason } }, { action: 'Changed', where: 'Payment', text: me().name + ' voided the payment of ' + UI.fmt.money(rec.amount) + ' on ' + rec.booking + ': ' + reason });
      D().receipts.forEach(function (r) { if (r.payment === rec.id && r.status !== 'Void') DB.update('receipts', r, { status: 'Void', voidReason: 'The payment was voided: ' + reason }, { silent: true }); });
      var bk = findBooking(rec.booking); if (bk) DB.update('bookings', bk, { received: invReceived(bk.code) }, { silent: true });
      UI.toast('Payment voided');
    } else {
      DB.update(kind === 'invoice' ? 'invoices' : 'receipts', rec, { status: 'Void', voidReason: reason, voidAt: NOW(), voidBy: me().name }, { action: 'Changed', text: me().name + ' voided ' + kind + ' ' + rec.no + ': ' + reason });
      UI.toast((kind === 'invoice' ? 'Invoice ' : 'Receipt ') + rec.no + ' voided');
    }
    return true;
  });
}

/* ---------------- recording a payment (one place for the dialog, the slips and other pages) ---------------- */
var INV_KINDS = ['Security deposit', 'Rental payment', 'Delivery charge', 'Return charge', 'Damage coverage', 'Extension payment', 'Other payment'];
function invPaidByKind(code) { var o = {}; invLivePays(code).forEach(function (p) { o[p.kind] = (o[p.kind] || 0) + p.amount; }); return o; }
function invSuggest(x, kind) {
  if (!x) return 0;
  var by = invPaidByKind(x.code), r2 = function (v) { return Math.max(0, Math.round(v * 100) / 100); };
  if (kind === 'Security deposit') return r2(x.dep - (by['Security deposit'] || 0));
  if (kind === 'Delivery charge') return r2(x.deliv - (by['Delivery charge'] || 0));
  if (kind === 'Return charge') return r2(x.ret - (by['Return charge'] || 0));
  if (kind === 'Damage coverage') return r2(x.dmg - (by['Damage coverage'] || 0));
  if (kind === 'Extension payment') return r2(x.car.rate);
  if (kind === 'Other payment') return r2(x.others || 0);
  var charges = x.payable - x.dep, paidCharges = invReceived(x.code) - (by['Security deposit'] || 0);
  return r2(charges - paidCharges);
}
function invDefaultKind(x) { return !x || !x.pay || x.pay === 'Deposit due' ? 'Security deposit' : 'Rental payment'; }
function invAfterCharge(a, rate) { return Math.max(0, Math.round((a * (1 - (rate || .04)) - 1) * 100) / 100); }
function invNewStatus(x, kind) {
  var got = invReceived(x.code), depPaid = invPaidByKind(x.code)['Security deposit'] || 0;
  if (kind === 'Extension payment') return 'Extension paid';
  if (got >= x.payable - .005) return 'Full Payment Received';
  if (depPaid >= x.dep - .005) return 'Deposit Received';
  return x.pay;
}
function invDoRecord(o) {
  var x = findBooking(o.booking), staff = (o.depositedTo || '').indexOf('Cash to ') === 0 ? o.depositedTo.slice(8) : null;
  var p = DB.add('payments', { booking: x.code, kind: o.kind, amount: Math.round(o.amount * 100) / 100, method: o.method, at: o.at || NOW(), by: me().name, depositedTo: o.depositedTo, heldBy: o.method === 'Cash' ? staff || me().name : null, afterCharge: o.method === 'Card' ? o.afterCharge : null, ref: o.ref || '', note: o.note || '', receipt: null, void: null, banked: null, slips: o.slips || [] },
    { where: 'Payment', text: me().name + ' recorded a payment of ' + UI.fmt.money(o.amount) + ' (' + o.kind + ', ' + o.method + ') on ' + x.code });
  var r = null;
  if (o.receipt !== false) r = invMakeReceipt(p, true);
  var patch = { received: invReceived(x.code) };
  if (o.updateStatus) { var ns = invNewStatus(x, o.kind); if (ns !== x.pay) patch.pay = ns; }
  var before = x.pay;
  DB.update('bookings', x, patch, { silent: !patch.pay, text: me().name + ' changed the payment status of ' + x.code + ' to ' + (patch.pay || x.pay) });
  return { payment: p, receipt: r, statusChanged: patch.pay && patch.pay !== before ? patch.pay : null };
}
function invMakeReceipt(p, quiet) {
  var no = invNextNo('rcp');
  var r = DB.add('receipts', { id: no, no: no, payment: p.id, booking: p.booking, issued: NOW(), amount: p.amount, kind: p.kind, method: p.method, status: 'Issued', voidReason: '', sent: [] }, { where: 'Receipt', text: me().name + ' created receipt ' + no + ' for ' + UI.fmt.money(p.amount) + ' on ' + p.booking });
  DB.update('payments', p, { receipt: no }, { silent: true });
  if (!quiet) UI.toast('Receipt ' + no + ' created');
  return r;
}

/* ---------------- booking picker (search Booking ID, customer, phone or plate) ---------------- */
function invPickerHtml(st, label) {
  var x = st.booking ? findBooking(st.booking) : null;
  if (x) {
    var by = invPaidByKind(x.code), got = invReceived(x.code);
    return '<div class="inp"><label>' + esc(label || 'Booking') + ' <span class="ui-req">*</span></label><div class="inv-bk"><div class="grow"><b>' + esc(x.code) + ' · ' + esc(x.cust.name) + '</b> ' + UI.status('payment', x.pay || 'None') + '<small>' + esc(invCarLabel(x.car)) + ' · ' + esc(UI.fmt.date(x.start)) + ' to ' + esc(UI.fmt.date(x.end)) + '</small><small>Received so far <b>' + UI.fmt.money(got) + '</b>' + (got ? ' (' + Object.keys(by).map(function (k) { return k.replace(' payment', '').replace('Security ', '').toLowerCase() + ' ' + UI.fmt.money(by[k]); }).join(', ') + ')' : '') + ' of ' + UI.fmt.money(x.payable) + '</small></div>' + UI.btn('Change', { kind: 't', size: 'sm', attrs: { 'data-pick-clear': '1' } }) + '</div></div>';
  }
  return '<div class="inp inv-pick"><label>' + esc(label || 'Booking') + ' <span class="ui-req">*</span></label><div class="inp srch">' + i('search') + '<input type="search" data-pick-q placeholder="Booking ID, customer, phone or plate" value="' + esc(st.pickQ || '') + '" aria-label="Find the booking"></div><div class="inv-pick-list" data-pick-list>' + invPickList(st.pickQ) + '</div></div>';
}
function invPickList(q) {
  q = String(q || '').toLowerCase().trim();
  var list = D().bookings.filter(function (x) { return x.status !== 'Cancelled'; });
  var hits = q ? list.filter(function (x) { return (x.code + ' ' + x.cust.name + ' ' + x.cust.phone + ' ' + x.cust.phone.replace(/\D/g, '') + ' ' + x.car.plate + ' ' + x.car.plate.replace(/ /g, '')).toLowerCase().indexOf(q.replace(/^0/, '')) >= 0 || (x.code + x.cust.name).toLowerCase().indexOf(q) >= 0; }) : list.filter(function (x) { return x.received < x.payable; });
  hits = hits.slice().sort(function (a, b) { return Math.abs(a.start - TODAY) - Math.abs(b.start - TODAY); }).slice(0, 6);
  if (!hits.length) return '<p class="b2 inv-none">No booking found. Try the Booking ID (' + esc(D().bookings[0].code) + '), the customer name, the phone or the plate.</p>';
  return hits.map(function (x) { return '<button type="button" class="inv-pick-i" data-pick="' + esc(x.code) + '"><b>' + esc(x.code) + '</b><span class="grow">' + esc(x.cust.name) + '<small>' + esc(x.car.plate) + ' · ' + esc(UI.fmt.date(x.start)) + '</small></span>' + (x.payable - x.received > 0 ? '<small class="inv-due">' + UI.fmt.money(x.payable - x.received) + ' due</small>' : '<small>Paid</small>') + '</button>'; }).join('');
}
/* wire a picker living inside el; onPick(code) after a choice */
function invPickerWire(el, st, onPick) {
  el.addEventListener('input', function (ev) { if (ev.target.matches('[data-pick-q]')) { st.pickQ = ev.target.value; var l = ev.target.closest('.inv-pick').querySelector('[data-pick-list]'); if (l) l.innerHTML = invPickList(st.pickQ); } });
  el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-pick]'); if (b) { st.booking = b.getAttribute('data-pick'); onPick(st.booking); } else if (ev.target.closest('[data-pick-clear]')) { st.booking = ''; onPick(''); } });
}

/* ---------------- payment fields: what for, amount, after charge, method, deposited to, when, reference ---------------- */
function invPayFieldsHtml(st, px, o) {
  o = o || {};
  var x = st.booking ? findBooking(st.booking) : null, staff = invStaff(), read = st.read || {}, rd = function (k) { return read[k] ? ' <span class="inv-read">' + i('scan') + 'Read from the slip</span>' : ''; };
  var dep = st.method === 'Card' ? [['Stripe', 'Stripe']] : st.method === 'Online Transfer' ? [['Bank', 'Bank']] : staff.map(function (n) { return ['Cash to ' + n, 'Cash to ' + n]; });
  var sug = invSuggest(x, st.kind);
  var h = '<div class="inv-fgrid">';
  if (!st.split) {
    h += UI.select({ id: px + 'kind', key: 'kind', label: o.kindLabel || 'What is this payment for?', options: INV_KINDS, value: st.kind });
    h += '<div class="inp"><label for="' + px + 'amount">' + esc(o.amountLabel || 'Amount (RM)') + ' <span class="ui-req">*</span>' + rd('amount') + '</label><div class="ui-affix"><span>RM</span><input id="' + px + 'amount" type="number" step="0.01" min="0" data-key="amount" value="' + esc(st.amount == null ? '' : st.amount) + '"></div>' + (x && sug && Number(st.amount) !== sug ? '<button type="button" class="inv-link" data-use="' + sug + '">Use ' + UI.fmt.money(sug) + ' (still due for ' + esc(st.kind.toLowerCase()) + ')</button>' : '') + '</div>';
    if (st.method === 'Card') h += '<div class="inp full"><label for="' + px + 'after">Amount after charge (RM)</label><div class="ui-affix"><span>RM</span><input id="' + px + 'after" type="number" step="0.01" data-key="afterCharge" value="' + esc(st.afterCharge == null ? '' : st.afterCharge) + '"></div><span class="help">' + (st.afterHand ? 'Changed by hand. <button type="button" class="inv-link" data-after-auto>Use 4% + RM 1</button>' : 'Stripe takes 4% + RM 1. <button type="button" class="inv-link" data-after-my>Change it for a Malaysian card (3% + RM 1).</button>') + '</span></div>';
  }
  h += UI.select({ id: px + 'method', key: 'method', label: o.methodLabel || 'Method', options: LISTS.methods, value: st.method });
  h += UI.select({ id: px + 'dep', key: 'depositedTo', label: 'Deposited to', options: dep, value: st.depositedTo, disabled: st.method !== 'Cash' });
  h += '<div class="inp"><label for="' + px + 'at">' + esc(o.atLabel || 'Received on') + rd('at') + '</label><input id="' + px + 'at" type="datetime-local" data-key="at" value="' + UI.isoDateTime(st.at || NOW()) + '" max="' + UI.isoDateTime(NOW()) + '"></div>';
  h += '<div class="inp"><label for="' + px + 'ref">' + esc(o.refLabel || 'Reference (optional)') + rd('ref') + '</label><input id="' + px + 'ref" data-key="ref" value="' + esc(st.ref || '') + '" placeholder="Bank transfer reference, card slip number..."></div>';
  return h + '</div>';
}
/* read the fields back; re-suggest the amount when the kind changes until typed by hand */
function invPayKeep(el, st) {
  var f = UI.form(el);
  if (f.kind && f.kind !== st.kind) { st.kind = f.kind; if (!st.amountHand) st.amount = invSuggest(st.booking ? findBooking(st.booking) : null, st.kind); }
  else if (f.amount !== undefined) { if (f.amount !== st.amount && f.amount !== null) st.amountHand = true; st.amount = f.amount; }
  if (f.method && f.method !== st.method) { st.method = f.method; st.depositedTo = st.method === 'Card' ? 'Stripe' : st.method === 'Online Transfer' ? 'Bank' : 'Cash to ' + me().name; }
  else if (f.depositedTo) st.depositedTo = f.depositedTo;
  if (st.method === 'Card') { if (f.afterCharge !== undefined && f.afterCharge !== null && f.afterCharge !== st.afterCharge && st.afterCharge != null) st.afterHand = true; if (!st.afterHand) st.afterCharge = invAfterCharge(Number(st.amount) || 0, st.cardRate); else if (f.afterCharge !== undefined) st.afterCharge = f.afterCharge; }
  if (f.at) st.at = UI.parseDate(f.at);
  if (f.ref !== undefined) st.ref = f.ref;
  if (f.note !== undefined) st.note = f.note;
  if (f.mkReceipt !== undefined) st.receipt = f.mkReceipt;
  if (f.upd !== undefined) st.update = f.upd;
  return st;
}
function invPayWire(el, st, redraw) {
  el.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'kind' || k === 'method' || k === 'mkReceipt' || k === 'upd') { invPayKeep(el, st); redraw(); } else if (k === 'amount' && st.method === 'Card' && !st.afterHand) { invPayKeep(el, st); redraw(); } });
  el.addEventListener('click', function (ev) {
    var b;
    if ((b = ev.target.closest('[data-use]'))) { invPayKeep(el, st); st.amount = +b.getAttribute('data-use'); st.amountHand = false; if (st.method === 'Card' && !st.afterHand) st.afterCharge = invAfterCharge(st.amount, st.cardRate); redraw(); }
    else if (ev.target.closest('[data-after-auto]')) { invPayKeep(el, st); st.afterHand = false; st.cardRate = .04; st.afterCharge = invAfterCharge(Number(st.amount) || 0, .04); redraw(); }
    else if (ev.target.closest('[data-after-my]')) { invPayKeep(el, st); st.afterHand = true; st.cardRate = .03; st.afterCharge = invAfterCharge(Number(st.amount) || 0, .03); redraw(); }
  });
}
function invPayState(code) {
  var x = code ? findBooking(code) : null, kind = invDefaultKind(x), method = x ? (x.method || 'Online Transfer') : 'Online Transfer';
  var st = { booking: code || '', kind: kind, amount: invSuggest(x, kind), method: method, depositedTo: method === 'Card' ? 'Stripe' : method === 'Online Transfer' ? 'Bank' : 'Cash to ' + me().name, at: NOW(), ref: '', note: '', receipt: true, update: !x || !x.pay || x.pay === 'Deposit due' || true, cardRate: .04 };
  if (method === 'Card') st.afterCharge = invAfterCharge(st.amount, .04);
  st.update = !x || ['', 'Deposit due', 'Deposit Received', 'Extension due'].indexOf(x.pay || '') >= 0;
  return st;
}

/* ---------------- Record payment dialog ---------------- */
function invRecordPayment(code) {
  if (!can('billing.record_payment')) { UI.toast('You cannot record payments. Ask the owner for "Record payments".', { tone: 'warn' }); return; }
  var st = invPayState(code), done = null;
  var body = function () {
    if (done) {
      var p = done.payment;
      return UI.alert('Payment of ' + UI.fmt.money(p.amount) + ' recorded.' + (done.receipt ? ' Receipt ' + done.receipt.no + ' is ready.' : ''), 'ok') + (st.receipt && !done.receipt ? UI.alert('The receipt could not be made. Create it later on the Payments tab.', 'warn') : '') + (done.statusChanged ? UI.alert('The booking\'s payment status is now ' + done.statusChanged + '.', 'info') : '') +
        '<div class="inv-done">' + UI.kv('Booking', esc(p.booking)) + UI.kv('What for', esc(p.kind)) + UI.kv('Method', esc(p.method + (p.ref ? ' · ' + p.ref : ''))) + UI.kv('Deposited to', esc(p.depositedTo)) + '</div>';
    }
    return invPickerHtml(st) + (st.booking ? invPayFieldsHtml(st, 'rp-') + UI.textarea({ id: 'rp-note', key: 'note', label: 'Note (optional)', rows: 2, value: st.note }) +
      UI.switch({ id: 'rp-rc', key: 'mkReceipt', label: 'Create a receipt', checked: st.receipt, help: 'Without a receipt the payment is still recorded. You can create the receipt later.', disabled: !can('billing.issue_receipt') }) +
      UI.switch({ id: 'rp-up', key: 'upd', label: 'Also update the booking\'s payment status', checked: st.update, help: 'Moves it to Deposit Received, Full Payment Received or Extension paid when the money covers it.' }) : '');
  };
  var x0 = code ? findBooking(code) : null;
  var foot = function () {
    if (done) return [{ label: 'Done', kind: 'o' }].concat(done.receipt && can('billing.send') ? [{ label: 'Send receipt now', icon: 'send', onClick: function () { setTimeout(function () { invSend(done.receipt.no); }, 50); } }] : []);
    return [{ label: 'Cancel', kind: 'g' }, { label: 'Record payment', icon: 'cash', disabled: !st.booking, onClick: function (d) {
      invPayKeep(d.body, st);
      if (!(Number(st.amount) > 0)) { UI.toast('Type the amount', { tone: 'warn' }); return false; }
      if (st.at > NOW()) { UI.toast('The date cannot be in the future', { tone: 'warn' }); return false; }
      done = invDoRecord({ booking: st.booking, kind: st.kind, amount: Number(st.amount), method: st.method, depositedTo: st.depositedTo, at: st.at, ref: st.ref, note: st.note, afterCharge: st.afterCharge, receipt: st.receipt && can('billing.issue_receipt'), updateStatus: st.update });
      d.setTitle('Payment recorded', st.booking + ' · ' + findBooking(st.booking).cust.name); d.refresh(); d.setFoot(foot()); return false;
    } }];
  };
  var dl = UI.dialog({ title: 'Record payment', subtitle: x0 ? x0.code + ' · ' + x0.cust.name : 'Choose the booking first', width: 'md', body: body, buttons: foot(), dirty: function () { return !done && st.booking && Number(st.amount) > 0 && st.amountHand; } });
  var redraw = function () { dl.refresh(); dl.setFoot(foot()); };
  invPickerWire(dl.body, st, function (c) { var keepAt = st.at; st = Object.assign(st, invPayState(c)); st.at = keepAt; dl.setTitle('Record payment', c ? c + ' · ' + findBooking(c).cust.name : 'Choose the booking first'); redraw(); });
  invPayWire(dl.body, st, function () { redraw(); });
  return dl;
}

/* ---------------- Create invoice dialog ---------------- */
function invLinesFor(x) {
  var lines = [{ desc: 'Car rental: ' + plural(x.days, 'day') + ' x RM ' + invMoney(x.rate || x.car.rate), qty: x.days, unit: x.rate || x.car.rate, amount: x.rent }];
  if (x.dmg) { var pk = x.pkg && D().damagePackages ? byId(D().damagePackages, x.pkg) : null; lines.push({ desc: 'Damage cover: ' + (pk ? pk.name : 'Basic cover') + ' (' + x.days + ' days x RM ' + invMoney(x.dmg / x.days) + ')', qty: x.days, unit: x.dmg / x.days, amount: x.dmg }); }
  if (x.deliv) lines.push({ desc: 'Delivery charge', qty: 1, unit: x.deliv, amount: x.deliv });
  if (x.ret) lines.push({ desc: 'Return charge', qty: 1, unit: x.ret, amount: x.ret });
  if (x.others) lines.push({ desc: 'Other charges', qty: 1, unit: x.others, amount: x.others });
  if (x.disc) lines.push({ desc: 'Discount', qty: 1, unit: -x.disc, amount: -x.disc });
  return lines;
}
function invCreateInvoice(code) {
  if (!can('billing.issue_invoice')) { UI.toast('You cannot issue invoices. Ask the owner for "Issue invoices".', { tone: 'warn' }); return; }
  var st = { booking: code || '', note: '' }, done = null;
  var body = function () {
    var miss = invMissing(), x = st.booking ? findBooking(st.booking) : null;
    if (done) return UI.alert('Invoice ' + done.no + ' is ready. Total charges ' + UI.fmt.money(invTotal(done)) + '.', 'ok') + '<div class="inv-done">' + UI.kv('Booking', esc(done.booking)) + UI.kv('Customer', esc(x.cust.name)) + UI.kv('Refundable deposit', UI.fmt.money(done.deposit)) + '</div>';
    var h = miss.length ? UI.alert('Company details are incomplete (' + miss.join(', ') + '). The invoice prints them.', 'warn', { action: can('billing.settings') ? UI.btn('Company details', { kind: 't', size: 'sm', attrs: { 'data-co': '1' } }) : '' }) : '';
    if (!x) return h + invPickerHtml(st);
    var ex = invInvoiceOf(x.code), lines = invLinesFor(x), charges = sum(lines.map(function (l) { return l.amount; })), co = invCo(), tax = co.tax && co.tax.on ? Math.round(charges * co.tax.rate) / 100 : 0;
    if (ex) h += UI.alert('This booking already has invoice ' + ex.no + '. A second one is only needed when the first is wrong: void it first.', 'info', { action: UI.btn('View it', { kind: 't', size: 'sm', attrs: { 'data-view': ex.no } }) });
    h += '<div class="inv-lines"><table class="tbl"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>' + lines.map(function (l) { return '<tr><td>' + esc(l.desc) + '</td><td class="r">' + l.qty + '</td><td class="r">' + UI.money(l.unit) + '</td><td class="r">' + UI.money(l.amount) + '</td></tr>'; }).join('') + '</tbody><tfoot>' +
      (tax ? '<tr><td colspan="3">' + esc(co.tax.name) + ' ' + co.tax.rate + '%</td><td class="r">' + UI.money(tax) + '</td></tr>' : '') + '<tr class="inv-strong"><td colspan="3">Total charges</td><td class="r">' + UI.money(charges + tax) + '</td></tr><tr><td colspan="3" class="b2">Refundable security deposit ' + UI.fmt.money(x.dep) + ' (not a charge)</td><td></td></tr></tfoot></table></div>' +
      UI.textarea({ id: 'ci-note', key: 'note', label: 'Note on the invoice (optional)', rows: 2, value: st.note, placeholder: 'For example: Thank you for choosing us again.' });
    return h;
  };
  var foot = function () {
    if (done) return [{ label: 'Done', kind: 'g' }, { label: 'Preview', kind: 'o', icon: 'eye', onClick: function () { setTimeout(function () { invPreview(done.no); }, 50); } }].concat(can('billing.send') ? [{ label: 'Send invoice', icon: 'send', onClick: function () { setTimeout(function () { invSend(done.no); }, 50); } }] : []);
    return [{ label: 'Cancel', kind: 'g' }, { label: 'Create invoice', icon: 'file-plus', disabled: !st.booking, onClick: function (d) {
      var x = findBooking(st.booking), lines = invLinesFor(x), charges = sum(lines.map(function (l) { return l.amount; })), co = invCo(), tax = co.tax && co.tax.on ? Math.round(charges * co.tax.rate) / 100 : 0, no = invNextNo('inv');
      st.note = (UI.form(d.body).note || '').trim();
      done = DB.add('invoices', { id: no, no: no, booking: x.code, issued: NOW(), lines: lines, charges: charges, deposit: x.dep, tax: tax, note: st.note, status: 'Issued', voidReason: '', sent: [] }, { where: 'Invoice', text: me().name + ' created invoice ' + no + ' for ' + x.code });
      d.setTitle('Invoice created', x.code + ' · ' + x.cust.name); d.refresh(); d.setFoot(foot()); return false;
    } }];
  };
  var x0 = code ? findBooking(code) : null;
  var dl = UI.dialog({ title: 'Create invoice', subtitle: x0 ? x0.code + ' · ' + x0.cust.name : 'Choose the booking', width: 'md', body: body, buttons: foot() });
  invPickerWire(dl.body, st, function (c) { dl.setTitle('Create invoice', c ? c + ' · ' + findBooking(c).cust.name : 'Choose the booking'); dl.refresh(); dl.setFoot(foot()); });
  dl.body.addEventListener('click', function (ev) { var v = ev.target.closest('[data-view]'); if (v) invPreview(v.getAttribute('data-view')); if (ev.target.closest('[data-co]')) invCompany(); });
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
  var dl = UI.dialog({ title: 'Payment slip: ' + UI.fmt.money(p.amount) + ' on ' + p.booking, width: 'lg', body: body, buttons: [{ label: 'Close', kind: 'g' }] });
  var act = function (a) {
    var it = list[k];
    if (a === 'in') z = Math.min(3, z + .25); else if (a === 'out') z = Math.max(.5, z - .25); else if (a === 'rot') rot = (rot + 90) % 360;
    else if (a === 'prev') { k = (k + list.length - 1) % list.length; z = 1; rot = 0; } else if (a === 'next') { k = (k + 1) % list.length; z = 1; rot = 0; }
    else if (a === 'tab') { try { var w = window.open(invSlipSrc(it.p, it.s), '_blank', 'noopener'); if (!w) UI.toast('This viewer blocks new tabs. Use Download instead.', { tone: 'warn' }); } catch (e) { UI.toast('This viewer blocks new tabs.', { tone: 'warn' }); } return; }
    else if (a === 'dl') { var src = invSlipSrc(it.p, it.s); fetch(src).then(function (r) { return r.blob(); }).then(function (bl) { UI.download({ filename: it.s.dataUrl ? it.s.name : it.s.name.replace(/\.\w+$/, '.svg'), data: bl, mime: bl.type }); }); return; }
    dl.refresh();
  };
  dl.body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-sv]'); if (b) act(b.getAttribute('data-sv')); });
  dl.el.addEventListener('keydown', function (ev) { var m = { '+': 'in', '=': 'in', '-': 'out', r: 'rot', R: 'rot', ArrowLeft: 'prev', ArrowRight: 'next' }[ev.key]; if (m && !/INPUT|TEXTAREA/.test(ev.target.tagName)) { ev.preventDefault(); act(m); } });
  return dl;
}

/* ---------------- Add a payment slip to an existing payment ---------------- */
function invAddSlip(p) {
  var st = { file: null, dup: false, note: '' };
  var body = function () {
    var dup = st.file && D().payments.some(function (q) { return (q.slips || []).some(function (s) { return s.name === st.file.name && s.size === st.file.size; }); });
    st.isDup = dup;
    return '<p class="ui-ctext">The payment stays exactly as it is. The slip is kept with it, so you can show it later next to the bank statement.</p>' +
      (st.file ? '<div class="inv-slip1"><img src="' + (/pdf/.test(st.file.type) ? '' : st.file.dataUrl) + '" alt="" ' + (/pdf/.test(st.file.type) ? 'hidden' : '') + '>' + (/pdf/.test(st.file.type) ? i('file-type-pdf') : '') + '<span class="grow"><b>' + esc(st.file.name) + '</b><small>' + UI.fmt.size(st.file.size) + (st.file.shrunk ? ' · made smaller' : '') + '</small></span>' + UI.btn('Choose another', { kind: 't', size: 'sm', attrs: { 'data-again': '1' } }) + '</div>' : '<div data-dz></div>') +
      (dup ? UI.alert('This slip is already kept with a payment.', 'warn') + UI.check({ id: 'as-dup', key: 'dup', label: 'Add it anyway', checked: st.dup }) : '') +
      UI.textarea({ id: 'as-note', key: 'note', label: 'Note (optional)', rows: 2, maxlength: 300, value: st.note, placeholder: 'For example: sent by the customer on WhatsApp' });
  };
  var dl = UI.dialog({ title: 'Add a payment slip', subtitle: UI.fmt.money(p.amount) + ' · ' + p.kind + ' · ' + p.booking, width: 'md', body: function (el) { var h = body(); setTimeout(mount, 0); return h; },
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Add slip', icon: 'paperclip', onClick: function (d) {
      var f = UI.form(d.body); st.note = f.note || ''; st.dup = !!f.dup;
      if (!st.file) { UI.toast('Choose the slip first', { tone: 'warn' }); return false; }
      if (st.isDup && !st.dup) { UI.toast('Tick "Add it anyway" to keep it twice', { tone: 'warn' }); return false; }
      var s = { name: st.file.name, size: st.file.size, type: st.file.type, dataUrl: st.file.dataUrl, at: NOW(), by: me().name, note: st.note };
      DB.update('payments', p, { slips: (p.slips || []).concat([s]) }, { where: 'Payment', text: me().name + ' added a payment slip to the payment of ' + UI.fmt.money(p.amount) + ' on ' + p.booking });
      UI.toast('Slip added to the payment');
    } }] });
  function mount() { var z = dl.body.querySelector('[data-dz]'); if (z) UI.dropzone(z, { accept: 'image/*,.pdf', label: 'Drop the slip here', hint: 'A photo or a PDF, up to 10 MB. You can also paste it with Ctrl+V.', camera: true, onFiles: function (fs) { var f = fs[0]; if (f.size > 10 * 1048576) { UI.toast('That file is bigger than 10 MB', { tone: 'warn' }); return; } UI.readImage(f).then(function (r) { st.note = UI.form(dl.body).note || st.note; st.file = r; dl.refresh(); }); } }); }
  dl.body.addEventListener('click', function (ev) { if (ev.target.closest('[data-again]')) { st.file = null; dl.refresh(); } });
  return dl;
}

/* ---------------- Upload payment slips (many at once) ---------------- */
function invUploadSlips() {
  if (!can('billing.record_payment')) { UI.toast('You cannot record payments. Ask the owner for "Record payments".', { tone: 'warn' }); return; }
  var cards = [], seq = 0;
  var stLabel = { 'new': ['Not recorded yet', 'grey'], reading: ['Reading the slip...', 'info'], done: ['Recorded', 'ok'], attention: ['Needs attention', 'warn'], busy: ['Recording...', 'info'] };
  var cardHtml = function (c, n) {
    var px = 'sl' + c.id + '-', x = c.booking ? findBooking(c.booking) : null;
    var head = '<div class="inv-sc-h"><span class="grow b2">' + (n + 1) + '. <b class="t1c">' + esc(c.file.name) + '</b> · ' + UI.fmt.size(c.file.size) + (c.file.shrunk ? ' · made smaller' : '') + '</span>' + UI.chip(stLabel[c.status][0], stLabel[c.status][1]) + (c.status !== 'done' ? UI.iconBtn('x', 'Remove this slip', { size: 'sm', attrs: { 'data-rm': c.id } }) : '') + '</div>';
    var thumb = '<button type="button" class="inv-sc-th" data-big="' + c.id + '" title="Look at the slip larger">' + (/pdf/.test(c.file.type) ? i('file-type-pdf') + '<small>PDF</small>' : '<img src="' + c.file.dataUrl + '" alt="Slip ' + (n + 1) + '">') + '</button>';
    if (c.status === 'done') return '<div class="inv-sc done" data-card="' + c.id + '">' + head + '<div class="inv-sc-b">' + thumb + '<div class="grow col gap8">' + c.results.map(function (r) { return UI.alert('Payment of ' + UI.fmt.money(r.payment.amount) + ' (' + r.payment.kind + ') on ' + r.payment.booking + ' recorded.' + (r.receipt ? ' Receipt ' + r.receipt.no + '.' : ''), 'ok', { action: r.receipt ? '<span class="row gap6">' + UI.btn('View', { kind: 't', size: 'sm', attrs: { 'data-view': r.receipt.no } }) + (can('billing.send') ? UI.btn('Send to customer', { kind: 't', size: 'sm', attrs: { 'data-send': r.receipt.no } }) : '') + '</span>' : '' }); }).join('') + '</div></div></div>';
    if (c.status === 'reading') return '<div class="inv-sc" data-card="' + c.id + '">' + head + '<div class="inv-sc-b">' + thumb + '<div class="grow inv-reading">' + i('loader-2', 'inv-spin') + 'Reading the slip...</div></div></div>';
    var readNote = c.readOk ? UI.alert('Filled in from the slip (' + c.readBank + '). Check each one against the picture before you record.', 'info', { icon: 'scan' }) : c.readOk === false ? UI.alert('Nothing could be read from this slip. Type the details in.', 'warn') : '';
    var dup = x && invLivePays(x.code).some(function (p) { return Math.abs(p.amount - Number(c.amount)) < .01 && (c.ref ? p.ref === c.ref : true) && Math.abs(p.at - (c.at || NOW())) < 2 * DAY; });
    c.isDup = dup;
    var parts = '';
    if (c.split) {
      var tot = sum(c.parts.map(function (q) { return Number(q.amount) || 0; })), slip = Number(c.slipAmount) || 0;
      parts = '<div class="inv-parts"><div class="inp"><label for="' + px + 'slipamt">Amount on the slip (RM) <span class="ui-req">*</span></label><div class="ui-affix"><span>RM</span><input id="' + px + 'slipamt" type="number" step="0.01" data-key="slipAmount" value="' + esc(c.slipAmount == null ? '' : c.slipAmount) + '"></div></div>' +
        c.parts.map(function (q, j) { var rest = Math.round((slip - tot + (Number(q.amount) || 0)) * 100) / 100; return '<div class="inv-part" data-part="' + j + '">' + UI.select({ id: px + 'pk' + j, key: 'pk' + j, label: 'What is it for?', options: INV_KINDS, value: q.kind }) + '<div class="inp"><label for="' + px + 'pa' + j + '">Amount (RM)</label><div class="ui-affix"><span>RM</span><input id="' + px + 'pa' + j + '" type="number" step="0.01" data-key="pa' + j + '" value="' + esc(q.amount == null ? '' : q.amount) + '"></div>' + (rest > 0 && rest !== Number(q.amount) ? '<button type="button" class="inv-link" data-rest="' + j + ':' + rest + '">Use the rest (' + UI.fmt.money(rest) + ')</button>' : '') + '</div>' + (c.parts.length > 2 ? UI.iconBtn('trash', 'Remove this part', { size: 'sm', attrs: { 'data-rmpart': j } }) : '') + '</div>'; }).join('') +
        '<div class="row wrap gap8">' + UI.btn('Add another part', { kind: 't', size: 'sm', icon: 'plus', attrs: { 'data-addpart': '1' } }) + '<span class="grow"></span><span class="b2 ' + (Math.abs(tot - slip) < .005 && slip ? 'inv-okt' : 'inv-badt') + '">' + (Math.abs(tot - slip) < .005 && slip ? 'The parts add up to ' + UI.fmt.money(tot) + ', the same as the slip.' : 'The parts add up to ' + UI.fmt.money(tot) + ', the slip says ' + UI.fmt.money(slip) + '.') + '</span></div>' +
        '<button type="button" class="inv-link" data-unsplit>Back to one payment</button></div>';
    }
    return '<div class="inv-sc' + (c.status === 'attention' ? ' bad' : '') + '" data-card="' + c.id + '">' + head + readNote + '<div class="inv-sc-b">' + thumb + '<div class="grow col gap12">' + invPickerHtml(c) +
      (c.booking ? (c.split ? parts : '') + invPayFieldsHtml(c, px, { kindLabel: 'What is it for?', amountLabel: 'Amount on the slip (RM)', methodLabel: 'Paid by', atLabel: 'Money received on', refLabel: 'Reference number (optional)' }) +
        (!c.split ? '<button type="button" class="inv-link" data-split>' + i('arrows-split') + 'This slip paid for more than one thing (deposit, rent, delivery...)</button>' : '') +
        '<details class="inv-more"' + (c.more ? ' open' : '') + '><summary>More options</summary>' + UI.textarea({ id: px + 'note', key: 'note', label: 'Note (optional)', rows: 2, value: c.note }) + UI.switch({ id: px + 'rc', key: 'mkReceipt', label: 'Create a receipt', checked: c.receipt, disabled: !can('billing.issue_receipt') }) + UI.switch({ id: px + 'up', key: 'upd', label: 'Also update the booking\'s payment status', checked: c.update }) + '</details>' +
        (dup ? UI.alert('A payment with the same amount' + (c.ref ? ' and reference' : '') + ' is already recorded on ' + c.booking + '.', 'warn') + UI.check({ id: px + 'dup', key: 'dup', label: 'Record it again anyway', checked: c.dupOk }) : '') +
        (c.error ? '<span class="ui-err">' + esc(c.error) + '</span>' : '') +
        '<div class="row" style="justify-content:flex-end">' + UI.btn('Record this slip', { icon: 'receipt', attrs: { 'data-rec': c.id } }) + '</div>' : '') + '</div></div></div>';
  };
  var empty = '<ol class="inv-how"><li><b>Add the slips</b> your customers sent on WhatsApp or email: drop them here, choose them, or paste with Ctrl+V.</li><li><b>Choose the booking</b> for each slip and check what was read from it.</li><li><b>Record</b> each slip, or all of them at once. Each payment gets its receipt.</li></ol>';
  var body = function () { return '<div data-dz></div>' + (cards.length ? '<div class="col gap12">' + cards.map(cardHtml).join('') + '</div>' : empty); };
  var pending = function () { return cards.filter(function (c) { return c.status !== 'done'; }); };
  var foot = function () { var n = cards.length, rd = cards.filter(function (c) { return c.status !== 'done' && c.status !== 'reading' && c.booking; }).length; return [{ label: plural(n, 'slip'), kind: 't', disabled: true }, { spacer: true }, { label: 'Cancel', kind: 'g' }, { label: 'Record all (' + rd + ')', icon: 'checks', disabled: !rd, onClick: function () { recordAll(); return false; } }]; };
  var dl = UI.dialog({ title: 'Upload payment slips', subtitle: 'Add the slips your customers sent, choose the booking for each one, then record them.', width: 'lg', body: function () { setTimeout(mount, 0); return body(); }, buttons: foot(),
    dirty: function () { return pending().length > 0; }, dirtyTitle: 'Close without recording?' });
  function mount() { var z = dl.body.querySelector('[data-dz]'); if (z && !z.firstChild) UI.dropzone(z, { accept: 'image/*,.pdf', multiple: true, camera: true, label: 'Drop the payment slips here', hint: 'Images or PDFs, up to 30 at once, 10 MB each. Paste with Ctrl+V works too.', onFiles: add }); }
  function keepAll() { cards.forEach(function (c) { var el = dl.body.querySelector('[data-card="' + c.id + '"]'); if (!el || c.status === 'done' || c.status === 'reading') return; var f = UI.form(el); invPayKeep(el, c); if (c.split) { c.slipAmount = f.slipAmount; c.parts.forEach(function (q, j) { if (f['pk' + j]) q.kind = f['pk' + j]; if (f['pa' + j] !== undefined) q.amount = f['pa' + j]; }); } if (f.dup !== undefined) c.dupOk = f.dup; var det = el.querySelector('details'); if (det) c.more = det.open; }); }
  function redraw() { keepAll(); dl.refresh(); dl.setFoot(foot()); }
  function add(files) {
    files = files.slice(0, 30 - cards.length);
    if (!files.length) { UI.toast('Up to 30 slips at once', { tone: 'warn' }); return; }
    if (files.some(function (f) { return f.size > 1500000; })) UI.toast('Making big photos smaller...', { tone: 'info', ms: 1500 });
    files.forEach(function (f) {
      if (f.size > 10 * 1048576) { UI.toast(f.name + ' is bigger than 10 MB', { tone: 'warn' }); return; }
      UI.readImage(f).then(function (r) {
        var c = Object.assign(invPayState(''), { id: ++seq, file: r, status: 'reading', pickQ: '', parts: [], split: false, results: [] });
        c.method = 'Online Transfer'; c.depositedTo = 'Bank';
        cards.push(c); redraw();
        setTimeout(function () { readSlip(c); }, 900 + cards.length * 250);
      });
    });
  }
  /* slip reading: a made-up result here (the real system reads the slip on the server) */
  function readSlip(c) {
    c.status = 'new';
    if (/pdf/.test(c.file.type) || /blank|empty/i.test(c.file.name)) { c.readOk = false; redraw(); return; }
    var used = cards.map(function (z) { return z.booking; });
    var cand = D().bookings.filter(function (x) { return x.status !== 'Cancelled' && x.payable - x.received > 0 && used.indexOf(x.code) < 0; }).sort(function (a, b) { return a.start - b.start; })[0];
    if (!cand) { c.readOk = false; redraw(); return; }
    c.booking = cand.code; c.kind = invDefaultKind(cand); c.amount = invSuggest(cand, c.kind) || invSuggest(cand, 'Rental payment'); c.ref = 'FT' + String(26100000000 + cand.n * 7919).slice(0, 12); c.at = new Date(NOW().getTime() - 3 * 36e5); c.at.setSeconds(0, 0);
    c.readOk = true; c.readBank = 'Bank Contoh'; c.read = { amount: 1, ref: 1, at: 1 };
    redraw();
  }
  function recordOne(c) {
    keepAll();
    if (!c.booking) { c.error = 'Choose the booking.'; c.status = 'attention'; return false; }
    var x = findBooking(c.booking), parts = c.split ? c.parts.map(function (q) { return { kind: q.kind, amount: Number(q.amount) || 0 }; }).filter(function (q) { return q.amount > 0; }) : [{ kind: c.kind, amount: Number(c.amount) || 0 }];
    if (c.split && Math.abs(sum(parts.map(function (q) { return q.amount; })) - (Number(c.slipAmount) || 0)) > .005) { c.error = 'The parts must add up to the amount on the slip.'; c.status = 'attention'; return false; }
    if (!parts.length || parts.some(function (q) { return !(q.amount > 0); })) { c.error = 'Type the amount on the slip.'; c.status = 'attention'; return false; }
    if (c.isDup && !c.dupOk) { c.error = 'Tick "Record it again anyway" if this really is a second payment.'; c.status = 'attention'; return false; }
    c.error = '';
    var slip = { name: c.file.name, size: c.file.size, type: c.file.type, dataUrl: c.file.dataUrl, at: NOW(), by: me().name };
    c.results = parts.map(function (q) { return invDoRecord({ booking: x.code, kind: q.kind, amount: q.amount, method: c.method, depositedTo: c.depositedTo, at: c.at, ref: c.ref, note: c.note, afterCharge: c.method === 'Card' ? invAfterCharge(q.amount, c.cardRate) : null, slips: [slip], receipt: c.receipt && can('billing.issue_receipt'), updateStatus: c.update }); });
    c.status = 'done';
    return true;
  }
  function recordAll() {
    var todo = cards.filter(function (c) { return c.status !== 'done' && c.status !== 'reading' && c.booking; }), ok = 0, bad = 0;
    todo.forEach(function (c) { if (recordOne(c)) ok++; else bad++; });
    redraw();
    UI.toast(bad ? ok + ' recorded, ' + bad + ' still need attention' : plural(ok, 'payment') + ' recorded', { tone: bad ? 'warn' : 'ok' });
  }
  dl.body.addEventListener('input', function (ev) { if (ev.target.matches('[data-pick-q]')) { var el = ev.target.closest('[data-card]'), c = el && cards.filter(function (z) { return z.id === +el.getAttribute('data-card'); })[0]; if (c) { c.pickQ = ev.target.value; el.querySelector('[data-pick-list]').innerHTML = invPickList(c.pickQ); } } });
  dl.body.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key') || ''; if (/^(kind|method|mkReceipt|upd|pk\d+)$/.test(k) || (k === 'amount' && ev.target.closest('[data-card]'))) redraw(); });
  dl.body.addEventListener('click', function (ev) {
    var t = ev.target, el = t.closest('[data-card]'), c = el && cards.filter(function (z) { return z.id === +el.getAttribute('data-card'); })[0], b;
    if ((b = t.closest('[data-rm]'))) { cards = cards.filter(function (z) { return z.id !== +b.getAttribute('data-rm'); }); redraw(); return; }
    if ((b = t.closest('[data-big]'))) { var cc = cards.filter(function (z) { return z.id === +b.getAttribute('data-big'); })[0]; invSlipViewer({ amount: Number(cc.amount) || 0, booking: cc.booking || 'no booking yet', slips: [cc.file] }); return; }
    if ((b = t.closest('[data-view]'))) { invPreview(b.getAttribute('data-view')); return; }
    if ((b = t.closest('[data-send]'))) { invSend(b.getAttribute('data-send')); return; }
    if (!c) return;
    if ((b = t.closest('[data-pick]'))) { keepAll(); var code = b.getAttribute('data-pick'), bx = findBooking(code); c.booking = code; c.kind = invDefaultKind(bx); if (!c.readOk) c.amount = invSuggest(bx, c.kind); c.update = ['', 'Deposit due', 'Deposit Received', 'Extension due'].indexOf(bx.pay || '') >= 0; redraw(); return; }
    if (t.closest('[data-pick-clear]')) { keepAll(); c.booking = ''; redraw(); return; }
    if ((b = t.closest('[data-use]'))) { keepAll(); c.amount = +b.getAttribute('data-use'); c.amountHand = false; redraw(); return; }
    if (t.closest('[data-after-auto]')) { keepAll(); c.afterHand = false; c.cardRate = .04; redraw(); return; }
    if (t.closest('[data-after-my]')) { keepAll(); c.afterHand = true; c.cardRate = .03; c.afterCharge = invAfterCharge(Number(c.amount) || 0, .03); redraw(); return; }
    if (t.closest('[data-split]')) { keepAll(); c.split = true; c.slipAmount = c.amount; c.parts = [{ kind: 'Security deposit', amount: invSuggest(findBooking(c.booking), 'Security deposit') }, { kind: 'Rental payment', amount: null }]; redraw(); return; }
    if (t.closest('[data-unsplit]')) { keepAll(); c.split = false; c.amount = c.slipAmount; redraw(); return; }
    if (t.closest('[data-addpart]')) { keepAll(); c.parts.push({ kind: 'Delivery charge', amount: null }); redraw(); return; }
    if ((b = t.closest('[data-rmpart]'))) { keepAll(); c.parts.splice(+b.getAttribute('data-rmpart'), 1); redraw(); return; }
    if ((b = t.closest('[data-rest]'))) { keepAll(); var pr = b.getAttribute('data-rest').split(':'); c.parts[+pr[0]].amount = +pr[1]; redraw(); return; }
    if (t.closest('[data-rec]')) { var ok = recordOne(c); redraw(); UI.toast(ok ? 'Slip recorded' : 'This slip needs attention', { tone: ok ? 'ok' : 'warn' }); }
  });
  return dl;
}

/* ---------------- Company details drawer ---------------- */
function invCompany() {
  if (!can('billing.settings')) { UI.toast('Only people with "Company details" can change these.', { tone: 'warn' }); return; }
  var co = JSON.parse(JSON.stringify(invCo())), changed = false;
  co.bank = co.bank || {}; co.numbering = co.numbering || {}; co.tax = co.tax || {}; co.footers = co.footers || {};
  var keep = function (el) {
    var f = UI.form(el);
    ['legal', 'trading', 'reg', 'phone', 'address', 'email', 'website', 'countryCode'].forEach(function (k) { if (f[k] !== undefined) co[k] = f[k]; });
    ['bank', 'accNo', 'accName', 'note'].forEach(function (k) { if (f['b_' + k] !== undefined) co.bank[k] = f['b_' + k]; });
    if (f.invPrefix !== undefined) { co.numbering.invPrefix = f.invPrefix; co.numbering.rcpPrefix = f.rcpPrefix; co.numbering.digits = Math.max(3, Math.min(8, Number(f.digits) || 5)); co.numbering.resetYearly = f.resetYearly; }
    if (f.taxOn !== undefined) { co.tax.on = f.taxOn; if (f.taxName !== undefined) { co.tax.name = f.taxName; co.tax.rate = Number(f.taxRate) || 0; co.tax.regNo = f.taxReg; } }
    if (f.fInv !== undefined) { co.footers.invoice = f.fInv; co.footers.receipt = f.fRcp; }
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
   The page
   =================================================================== */
function invLastSent(x) {
  var s = (x.sent || []).slice(-1)[0];
  if (!s) return '<span class="faint">Not sent yet</span>';
  return '<span class="inv-ls' + (s.ok === false ? ' bad' : '') + '">' + i(invChannelIcon(s.channel)) + '<span>' + esc(s.channel === 'Download' ? 'Downloaded' : s.channel) + (s.ok === false ? ' (failed)' : '') + '<small>' + esc(UI.fmt.ago(s.at)) + '</small></span></span>';
}
function invCashHeld() {
  var d = D(), by = {};
  d.payments.forEach(function (p) { if (p.method !== 'Cash' || p.void || p.banked) return; var n = p.heldBy || p.by; (by[n] = by[n] || { name: n, pays: [], held: 0, oldest: p.at }).pays.push(p); by[n].held += p.amount; if (p.at < by[n].oldest) by[n].oldest = p.at; });
  (d.deposits || []).forEach(function (z) { if (z.refund && z.refund.method === 'Cash' && by[z.refund.by] && z.refund.at >= by[z.refund.by].oldest && !z.refund.banked) by[z.refund.by].held -= z.refund.amount; });
  return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.held - a.held; });
}
function invMarkBanked(g) {
  var amt = sum(g.pays.map(function (p) { return p.amount; }));
  UI.confirm({ title: 'Mark cash as banked', text: 'Mark ' + UI.fmt.money(g.held) + ' (' + plural(g.pays.length, 'payment') + ') held by ' + g.name + ' as banked? Do this only once the cash has been paid into the bank. Your name and the time are recorded.', ok: 'Mark banked' }).then(function (y) {
    if (!y) return;
    var at = NOW();
    g.pays.forEach(function (p) { DB.update('payments', p, { banked: { at: at, by: me().name } }, { silent: true }); });
    (D().deposits || []).forEach(function (z) { if (z.refund && z.refund.method === 'Cash' && z.refund.by === g.name && !z.refund.banked) z.refund.banked = { at: at, by: me().name }; });
    DB.log('Changed', 'Payment', '', me().name + ' marked ' + UI.fmt.money(amt) + ' cash held by ' + g.name + ' as banked (' + plural(g.pays.length, 'payment') + ')');
    UI.toast(plural(g.pays.length, 'payment') + ' marked as banked.');
  });
}
function invRowMenu(btn, kind, x, ctx) {
  var bk = x.booking, items = [{ label: 'Open booking', icon: 'calendar-event', onClick: function () { API.openBooking(bk); } }];
  if (kind === 'payment') {
    if ((x.slips || []).length) items.push({ label: 'View payment slip' + (x.slips.length > 1 ? 's' : ''), icon: 'paperclip', onClick: function () { invSlipViewer(x); } });
    items.push({ label: 'Add payment slip...', icon: 'photo-plus', disabled: !can('billing.record_payment') || !!x.void, onClick: function () { invAddSlip(x); } });
    if (x.receipt) items.push({ label: 'Preview receipt', icon: 'eye', onClick: function () { invPreview(x.receipt); } });
    items.push({ divider: true }, { label: 'Void payment...', icon: 'ban', danger: true, disabled: !can('billing.void') || !!x.void, hint: !can('billing.void') ? 'Needs "Void documents"' : x.void ? 'Already void' : '', onClick: function () { invVoid('payment', x); } });
  } else {
    var p = kind === 'receipt' ? invPayOf(x) : null;
    if (p && (p.slips || []).length) items.push({ label: 'View payment slip' + (p.slips.length > 1 ? 's' : ''), icon: 'paperclip', onClick: function () { invSlipViewer(p); } });
    if (kind === 'invoice' && can('billing.record_payment')) items.push({ label: 'Record payment', icon: 'cash', onClick: function () { invRecordPayment(bk); } });
    items.push({ label: 'Copy the PDF link', icon: 'link', disabled: x.status === 'Void', onClick: function () { UI.copy(invLink(x.no), { label: 'Link copied (valid for 14 days)' }); } });
    if (x.status === 'Issued' && can('billing.void')) items.push({ divider: true }, { label: 'Void...', icon: 'ban', danger: true, onClick: function () { invVoid(kind, x); } });
  }
  UI.menu(btn, items, { width: 250 });
}

PAGES['invoices'] = {
  title: 'Invoices & Receipts',
  search: [
    { label: 'Upload payment slip', icon: 'upload', run: function () { invUploadSlips(); } },
    { label: 'Record payment', icon: 'cash', run: function () { invRecordPayment(''); } },
    { label: 'Create invoice', icon: 'file-plus', run: function () { invCreateInvoice(''); } },
    { label: 'Company details', icon: 'building', run: function () { invCompany(); } },
    { label: 'Cash held by staff', icon: 'wallet', run: function () { go('invoices', { tab: 'cash' }); } }
  ],
  render: function (root, ctx) {
    var d = ctx.data, P = ctx.params, st = ctx.state;
    var tab = P.tab || 'invoices'; if (tab === 'cash' && !can('billing.manage_cash')) tab = 'invoices';
    var f = { q: P.q || '', status: P.status || '', kind: P.kind || '', slip: P.slip || '', from: P.from || '', to: P.to || '' };
    var miss = invMissing();
    var counts = { invoices: d.invoices.length, receipts: d.receipts.length, payments: d.payments.length };
    var held = invCashHeld();
    root.innerHTML = '<div class="pg-h"><div><h1>Invoices &amp; Receipts</h1><p>An invoice lists what a booking charges. A receipt records money received.</p></div><div class="acts">' +
      (can('billing.record_payment') ? UI.btn('Record payment', { kind: 'o', icon: 'cash', attrs: { 'data-act': 'record' } }) + UI.btn('Upload payment slip', { icon: 'upload', attrs: { 'data-act': 'slips' } }) : '') +
      (can('billing.settings') ? UI.btn('Company details', { kind: 'tonal', icon: 'building', attrs: { 'data-act': 'company' } }) : '') + '</div></div>' +
      (miss.length ? '<div class="inv-banner">' + UI.alert('Company details are incomplete. Invoices and receipts print them, so fill in the missing details (' + miss.length + ' to go: ' + miss.join(', ') + ') before sending documents to customers.', 'warn', { action: can('billing.settings') ? UI.btn('Complete company details', { kind: 't', size: 'sm', attrs: { 'data-act': 'company' } }) : '' }) + '</div>' : '') +
      '<div class="inv-kpis">' +
      UI.stat({ label: 'Invoiced this month', value: UI.fmt.money(sum(d.invoices.filter(function (v) { return v.status !== 'Void' && v.issued.getMonth() === TODAY.getMonth() && v.issued.getFullYear() === TODAY.getFullYear(); }).map(invTotal)), { dp: 0 }), note: plural(d.invoices.filter(function (v) { return v.status !== 'Void' && v.issued.getMonth() === TODAY.getMonth(); }).length, 'invoice'), icon: 'file-invoice' }) +
      UI.stat({ label: 'Received this month', value: UI.fmt.money(sum(d.payments.filter(function (p) { return !p.void && p.at.getMonth() === TODAY.getMonth() && p.at.getFullYear() === TODAY.getFullYear(); }).map(function (p) { return p.amount; })), { dp: 0 }), note: 'Deposits and charges', icon: 'cash', tone: 'ok' }) +
      UI.stat({ label: 'Payments without receipt', value: String(d.payments.filter(function (p) { return !p.void && !p.receipt; }).length), note: 'Create them on Payments', icon: 'receipt-off', tone: 'warn', attrs: { 'data-go-tab': 'payments' } }) +
      (can('billing.manage_cash') ? UI.stat({ label: 'Cash held by staff', value: UI.fmt.money(sum(held.map(function (g) { return g.held; })), { dp: 0 }), note: 'Not banked yet', icon: 'wallet', tone: 'info', attrs: { 'data-go-tab': 'cash' } }) : '') + '</div>' +
      '<div class="card"><div class="inv-tabs" id="inv-tabs"></div><div id="inv-f"></div><div id="inv-t"></div></div>';

    UI.tabs(root.querySelector('#inv-tabs'), { value: tab, items: [{ id: 'invoices', label: 'Invoices', icon: 'file-invoice', count: counts.invoices, tone: 'grey' }, { id: 'receipts', label: 'Receipts', icon: 'receipt', count: counts.receipts, tone: 'grey' }, { id: 'payments', label: 'Payments', icon: 'credit-card', count: counts.payments, tone: 'grey' }, { id: 'cash', label: 'Cash held by staff', icon: 'wallet', hidden: !can('billing.manage_cash'), count: held.length || null, tone: 'warn' }],
      onChange: function (id) { st.page = 1; ctx.setParams({ tab: id, status: null, kind: null, slip: null, page: null }); ctx.refresh(); } });

    var tEl = root.querySelector('#inv-t');
    if (tab === 'cash') {
      var total = sum(held.map(function (g) { return g.held; })), np = sum(held.map(function (g) { return g.pays.length; }));
      root.querySelector('#inv-f').innerHTML = '<div class="inv-cash-h"><h3>Cash held by staff</h3><p class="b2">Cash payments received by a member of staff that has not been paid into the bank yet. Tick it off once it is banked. In total ' + UI.fmt.money(total) + ' in ' + plural(np, 'payment') + '.</p></div>';
      UI.table(tEl, { rows: held, rowKey: 'name', pageSize: false, minWidth: 620, density: 'compact',
        columns: [{ key: 'name', label: 'Staff', render: function (g) { return '<span class="row gap8">' + UI.avatar(g.name) + '<b class="fw5">' + esc(g.name) + '</b></span>'; } },
          { key: 'n', label: 'Cash payments', align: 'right', render: function (g) { return String(g.pays.length); } },
          { key: 'held', label: 'Held', align: 'right', render: function (g) { return '<b>' + UI.money(g.held) + '</b>'; } },
          { key: 'oldest', label: 'Oldest', render: function (g) { return esc(UI.fmt.date(g.oldest)) + '<div class="b2">' + esc(UI.fmt.ago(g.oldest)) + '</div>'; } },
          { key: 'act', label: '', align: 'right', render: function (g) { return UI.btn('Mark banked', { kind: 'o', size: 'sm', icon: 'building-bank', attrs: { 'data-bank': g.name, 'data-stop': '1' } }); } }],
        card: function (g) { return '<div class="row gap8">' + UI.avatar(g.name) + '<div class="grow"><b>' + esc(g.name) + '</b><div class="b2">' + plural(g.pays.length, 'cash payment') + ' · oldest ' + esc(UI.fmt.date(g.oldest)) + '</div></div><b>' + UI.money(g.held) + '</b></div><div class="row" style="justify-content:flex-end;margin-top:8px">' + UI.btn('Mark banked', { kind: 'o', size: 'sm', attrs: { 'data-bank': g.name } }) + '</div>'; },
        empty: { icon: 'wallet-off', title: 'No cash is being held', text: 'When a payment is recorded as cash to a member of staff, it appears here until you mark it as banked.' } });
      UI.on(root, 'click', '[data-bank]', function (ev, el) { var g = held.filter(function (z) { return z.name === el.getAttribute('data-bank'); })[0]; if (g) invMarkBanked(g); });
    } else {
      var fields = [{ type: 'search', key: 'q', placeholder: tab === 'payments' ? 'Customer, booking, reference...' : 'Number, customer, booking, plate...' },
        { type: 'select', key: 'status', label: 'Status', all: 'All statuses', options: tab === 'payments' ? ['Active', 'Void'] : ['Issued', 'Void'] }];
      if (tab !== 'invoices') fields.push({ type: 'select', key: 'kind', label: 'Type', all: 'All types', options: INV_KINDS });
      if (tab === 'payments') fields.push({ type: 'select', key: 'slip', label: 'Payment slip', all: 'All payments', options: [['with', 'With a slip'], ['without', 'Without a slip']] });
      fields.push({ type: 'daterange', from: 'from', to: 'to', label: 'From' });
      var filter = function () {
        var q = (f.q || '').toLowerCase().trim(), fr = f.from ? UI.parseDate(f.from) : null, to = f.to ? new Date(UI.parseDate(f.to).getTime() + DAY) : null;
        var list = tab === 'invoices' ? d.invoices : tab === 'receipts' ? d.receipts : d.payments;
        return list.filter(function (x) {
          var bk = findBooking(x.booking) || { cust: { name: '', phone: '' }, car: { plate: '', make: '', model: '' } }, when = x.issued || x.at;
          if (f.status) { var s = tab === 'payments' ? (x.void ? 'Void' : 'Active') : x.status; if (s !== f.status) return false; }
          if (f.kind && x.kind !== f.kind) return false;
          if (f.slip === 'with' && !(x.slips || []).length) return false; if (f.slip === 'without' && (x.slips || []).length) return false;
          if (fr && when < fr) return false; if (to && when >= to) return false;
          if (q && (String(x.no || '') + ' ' + x.booking + ' ' + bk.cust.name + ' ' + bk.cust.phone + ' ' + bk.car.plate + ' ' + (x.ref || '') + ' ' + (x.receipt || '')).toLowerCase().indexOf(q) < 0) return false;
          return true;
        }).sort(function (a, b) { return (b.issued || b.at) - (a.issued || a.at); });
      };
      var acts = function (x, kind) {
        var p = kind === 'receipt' ? invPayOf(x) : null, sl = p ? (p.slips || []).length : 0;
        return '<span class="icons" data-stop>' + UI.iconBtn('eye', 'Preview', { size: 'sm', attrs: { 'data-prev': x.no } }) + UI.iconBtn('download', 'Download PDF', { size: 'sm', attrs: { 'data-dl': x.no } }) +
          (sl ? UI.iconBtn('paperclip', sl > 1 ? 'View ' + sl + ' payment slips' : 'View payment slip', { size: 'sm', attrs: { 'data-slips': p.id } }) : '') +
          UI.iconBtn('send', x.status === 'Void' ? 'A void document cannot be sent' : 'Send', { size: 'sm', disabled: x.status === 'Void' || !can('billing.send'), attrs: { 'data-send': x.no } }) + UI.iconBtn('dots-vertical', 'More', { size: 'sm', attrs: { 'data-more': kind + ':' + x.no } }) + '</span>';
      };
      var bkCell = function (x) { var bk = findBooking(x.booking); return '<span class="inv-code">' + esc(x.booking) + '</span><div class="b2">' + esc(bk ? invCarLabel(bk.car) : '') + '</div>'; };
      var custCell = function (x) { var bk = findBooking(x.booking); return bk ? esc(bk.cust.name) + '<div class="b2">' + UI.phone(bk.cust.phone) + '</div>' : ''; };
      var cols, card, empty;
      if (tab === 'invoices') {
        cols = [{ key: 'no', label: 'Invoice / date', sort: function (x) { return x.issued; }, render: function (x) { return '<b class="fw5 t1c">' + esc(x.no) + '</b><div class="b2">' + esc(UI.fmt.date(x.issued)) + '</div>'; } },
          { key: 'cust', label: 'Customer', render: custCell }, { key: 'booking', label: 'Booking / car', render: bkCell },
          { key: 'amt', label: 'Amount', sort: function (x) { return invTotal(x); }, render: function (x) { return '<b class="fw5">' + UI.money(invTotal(x)) + '</b>' + (x.deposit ? '<div class="b2 nw">+ ' + UI.fmt.money(x.deposit) + ' deposit</div>' : ''); } },
          { key: 'status', label: 'Status', render: function (x) { return UI.status('doc', x.status, null, { attrs: x.voidReason ? { title: 'Void: ' + x.voidReason } : null }); } },
          { key: 'sent', label: 'Last sent', render: invLastSent }, { key: 'a', label: 'Actions', render: function (x) { return acts(x, 'invoice'); } }];
        card = function (x) { var bk = findBooking(x.booking); return '<div class="row"><b class="grow">' + esc(x.no) + '</b>' + UI.status('doc', x.status) + '</div><div class="b2">' + esc(UI.fmt.date(x.issued)) + ' · ' + esc(x.booking) + ' · ' + esc(bk.cust.name) + '</div><div class="row"><b class="grow">' + UI.money(invTotal(x)) + '</b>' + acts(x, 'invoice') + '</div>'; };
        empty = f.q || f.status || f.from || f.to ? { icon: 'filter-off', title: 'No invoices match', text: 'Clear the filters to see every invoice.' } : { icon: 'file-invoice', title: 'No invoices yet', text: 'Create one from a booking: open the booking and choose Create invoice.' };
      } else if (tab === 'receipts') {
        cols = [{ key: 'no', label: 'Receipt / date', sort: function (x) { return x.issued; }, render: function (x) { var iv = invInvoiceOf(x.booking); return '<b class="fw5 t1c">' + esc(x.no) + '</b><div class="b2">' + esc(UI.fmt.date(x.issued)) + (iv ? ' · for ' + esc(iv.no) : '') + '</div>'; } },
          { key: 'cust', label: 'Customer', render: custCell }, { key: 'booking', label: 'Booking / car', render: bkCell },
          { key: 'amt', label: 'Amount', sort: function (x) { return x.amount; }, render: function (x) { return '<b class="fw5">' + UI.money(x.amount) + '</b><div class="b2">' + esc(x.kind) + ' · ' + esc(x.method) + '</div>'; } },
          { key: 'status', label: 'Status', render: function (x) { return UI.status('doc', x.status, null, { attrs: x.voidReason ? { title: x.voidReason } : null }); } },
          { key: 'sent', label: 'Last sent', render: invLastSent }, { key: 'a', label: 'Actions', render: function (x) { return acts(x, 'receipt'); } }];
        card = function (x) { var bk = findBooking(x.booking); return '<div class="row"><b class="grow">' + esc(x.no) + '</b>' + UI.status('doc', x.status) + '</div><div class="b2">' + esc(UI.fmt.date(x.issued)) + ' · ' + esc(x.booking) + ' · ' + esc(bk.cust.name) + '</div><div class="b2">' + esc(x.kind) + ' · ' + esc(x.method) + '</div><div class="row"><b class="grow">' + UI.money(x.amount) + '</b>' + acts(x, 'receipt') + '</div>'; };
        empty = f.q || f.status || f.kind || f.from ? { icon: 'filter-off', title: 'No receipts match', text: 'Clear the filters to see every receipt.' } : { icon: 'receipt', title: 'No receipts yet', text: 'A receipt is created when you record a payment on a booking.' };
      } else {
        var amtCell = function (p) { return '<b class="fw5">' + UI.money(p.amount) + '</b><div class="b2">' + esc(p.kind) + '</div><div class="b2">' + esc(p.method + (p.ref ? ' - ' + p.ref : '')) + '</div><div class="b2">' + esc(p.depositedTo || '') + (p.afterCharge ? ' · ' + UI.fmt.money(p.afterCharge) + ' after charge' : '') + '</div>' + (p.method === 'Cash' && !p.void ? (p.banked ? UI.chip('Banked', 'ok', { title: 'Paid into the bank ' + invDT(p.banked.at) + ' (ticked off by ' + p.banked.by + ')', icon: 'building-bank' }) : UI.chip('Cash not banked yet', 'warn')) : ''); };
        var slipCell = function (p) { var n = (p.slips || []).length; if (n) return '<button type="button" class="inv-slipchip" data-slips="' + p.id + '" data-stop>' + i('paperclip') + (n > 1 ? n + ' slips' : 'Slip') + '</button>'; return can('billing.record_payment') && !p.void ? '<button type="button" class="inv-slipchip add" data-addslip="' + p.id + '" title="Keep the bank slip with this payment" data-stop>' + i('plus') + 'Add slip</button>' : '<span class="faint">-</span>'; };
        var rcpCell = function (p) { if (p.void) return '<span class="faint">Voided</span>'; return p.receipt ? '<button type="button" class="inv-link" data-prev="' + esc(p.receipt) + '" data-stop>' + esc(p.receipt) + '</button>' : '<span class="faint">No receipt</span>'; };
        var pacts = function (p) { return '<span class="icons" data-stop>' + (p.receipt ? UI.iconBtn('eye', 'Preview receipt', { size: 'sm', attrs: { 'data-prev': p.receipt } }) + UI.iconBtn('send', 'Send receipt', { size: 'sm', disabled: !!p.void || !can('billing.send'), attrs: { 'data-send': p.receipt } }) : UI.iconBtn('receipt', 'Create the receipt for this payment', { size: 'sm', disabled: !!p.void || !can('billing.issue_receipt'), attrs: { 'data-mkrcp': p.id } })) + UI.iconBtn('dots-vertical', 'More', { size: 'sm', attrs: { 'data-more': 'payment:' + p.id } }) + '</span>'; };
        cols = [{ key: 'at', label: 'Received', sort: true, render: function (p) { return esc(invDT(p.at)) + '<div class="b2">by ' + esc(p.by) + '</div>'; } },
          { key: 'cust', label: 'Customer', render: function (p) { var bk = findBooking(p.booking); return esc(bk ? bk.cust.name : ''); } },
          { key: 'booking', label: 'Booking / car', render: function (p) { var bk = findBooking(p.booking); return '<span class="inv-code">' + esc(p.booking) + '</span><div class="b2">' + esc(bk ? bk.car.plate : '') + '</div>'; } },
          { key: 'amount', label: 'Amount', sort: true, render: amtCell }, { key: 'st', label: 'Status', render: function (p) { return UI.status('doc', p.void ? 'Void' : 'Active', null, { attrs: p.void ? { title: 'Void: ' + p.void.reason } : null }); } },
          { key: 'rcp', label: 'Receipt', render: rcpCell }, { key: 'slip', label: 'Slip', render: slipCell }, { key: 'a', label: 'Actions', render: pacts }];
        card = function (p) { var bk = findBooking(p.booking); return '<div class="row"><b class="grow">' + UI.money(p.amount) + '</b>' + UI.status('doc', p.void ? 'Void' : 'Active') + '</div><div class="b2">' + esc(invDT(p.at)) + ' · ' + esc(p.booking) + ' · ' + esc(bk ? bk.cust.name : '') + '</div><div class="b2">' + esc(p.kind + ' · ' + p.method) + '</div><div class="row wrap">' + slipCell(p) + rcpCell(p) + '<span class="grow"></span>' + pacts(p) + '</div>'; };
        empty = f.q || f.status || f.kind || f.slip || f.from ? { icon: 'filter-off', title: 'No payments match', text: 'Clear the filters to see every payment.' } : { icon: 'cash-off', title: 'No payments recorded yet', text: 'Record the money you receive from a booking, or upload the bank slip and pick the booking, and it shows up here.' };
      }
      var t = UI.table(tEl, { columns: cols, rows: filter(), rowKey: tab === 'payments' ? 'id' : 'no', density: 'compact', pageSize: +P.size || 10, page: +P.page || 1, minWidth: tab === 'payments' ? 1080 : 980, card: card, empty: empty,
        onRowClick: function (x) { if (tab === 'payments') { if (x.receipt) invPreview(x.receipt); else if ((x.slips || []).length) invSlipViewer(x); } else invPreview(x.no); },
        onPage: function (pg) { ctx.setParams({ page: pg > 1 ? pg : null }); } });
      UI.filters(root.querySelector('#inv-f'), { values: f, fields: fields, onChange: function (v) { ctx.setParams({ q: v.q || null, status: v.status || null, kind: v.kind || null, slip: v.slip || null, from: v.from || null, to: v.to || null, page: null }); t.setRows(filter()); },
        extra: '<span class="grow"></span>' + (tab === 'invoices' && can('billing.issue_invoice') ? UI.btn('Create invoice', { kind: 't', size: 'sm', icon: 'file-plus', attrs: { 'data-act': 'create' } }) : '') });
      tEl.addEventListener('change', function (ev) { if (ev.target.matches('[data-ui-size]')) ctx.setParams({ size: ev.target.value }); });
    }

    UI.on(root, 'click', '[data-act]', function (ev, el) { var a = el.getAttribute('data-act'); if (a === 'record') invRecordPayment(''); else if (a === 'slips') invUploadSlips(); else if (a === 'company') invCompany(); else if (a === 'create') invCreateInvoice(''); });
    UI.on(root, 'click', '[data-go-tab]', function (ev, el) { ctx.setParams({ tab: el.getAttribute('data-go-tab'), status: null, kind: null, slip: null, page: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-prev]', function (ev, el) { invPreview(el.getAttribute('data-prev')); });
    UI.on(root, 'click', '[data-dl]', function (ev, el) { var no = el.getAttribute('data-dl'), x = invDoc(no); invDocPdf(invModel(no)); if (x) invLogSent(x, 'Download', ''); });
    UI.on(root, 'click', '[data-send]', function (ev, el) { invSend(el.getAttribute('data-send')); });
    UI.on(root, 'click', '[data-slips]', function (ev, el) { invSlipViewer(byId(d.payments, el.getAttribute('data-slips'))); });
    UI.on(root, 'click', '[data-addslip]', function (ev, el) { invAddSlip(byId(d.payments, el.getAttribute('data-addslip'))); });
    UI.on(root, 'click', '[data-mkrcp]', function (ev, el) { var p = byId(d.payments, el.getAttribute('data-mkrcp')); var r = invMakeReceipt(p); setTimeout(function () { invPreview(r.no); }, 60); });
    UI.on(root, 'click', '[data-more]', function (ev, el) { var pr = el.getAttribute('data-more').split(':'), kind = pr[0], id = pr.slice(1).join(':'); invRowMenu(el, kind, kind === 'payment' ? byId(d.payments, id) : invDoc(id), ctx); });

    /* links from other pages: #page=invoices&action=record&booking=KLT-00412, &doc=INV-..., &action=send */
    var a = P.action, code = P.booking, doc = P.doc;
    if (a || doc) {
      ctx.setParams({ action: null, booking: null, doc: null });
      setTimeout(function () {
        if (a === 'record') invRecordPayment(code || ''); else if (a === 'slips') invUploadSlips(); else if (a === 'create') invCreateInvoice(code || ''); else if (a === 'company') invCompany();
        else if (a === 'send' && doc) invSend(doc); else if (doc) invPreview(doc);
      }, 30);
    }
  }
};

/* openers other pages use (see BUILDERS.md section 3) */
API.recordPayment = function (code) { invRecordPayment(code || ''); };
API.uploadSlips = function () { invUploadSlips(); };
API.createInvoice = function (code) { invCreateInvoice(code || ''); };
API.previewDoc = function (no) { invPreview(no); };
API.sendDoc = function (no) { invSend(no); };
API.companyDetails = function () { invCompany(); };
API.addSlip = function (paymentId) { var p = byId(D().payments, paymentId); if (p) invAddSlip(p); };
API.viewSlips = function (paymentId) { var p = byId(D().payments, paymentId); if (p) invSlipViewer(p); };
window.addEventListener('resize', UI.debounce(function () { invFit(document.getElementById('ui-layer')); }, 120));

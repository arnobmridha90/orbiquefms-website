/* ---------------- QUOTATION DOCUMENT (shared by the phone app and the web app) ----------------
   One layout engine draws the quotation as a list of shapes in PDF points (A4, 595.28 x 841.89). The same shapes become
   the on-screen preview (SVG) and the PDF file (jsPDF), so what staff see is exactly what the customer gets.
   No app globals are used here: the app builds a plain "input" object and calls

     QuoteDoc.calc(q)                      -> {hours, autoDays, days, rent, cover, delivery, ret, extras, discount, deposit, charges, total}
     QuoteDoc.layout(input)                -> {pages: [[op, ...]], w, h}
     QuoteDoc.svg(input)                   -> html string (one <svg> per page)
     QuoteDoc.pdf(input, jsPDF)            -> ArrayBuffer of the PDF file
     QuoteDoc.nextNo(list, prefix, date)   -> 'KQ-2026-1125-001'
     QuoteDoc.lockup(markSvg, name, colour) -> Promise of a PNG data URL (logo mark + company name, for companies with no logo file)

   input = { co: {trading, legal, regNo, address, phone, email, site, bank: {name, accName, accNo}, logo: dataURL, logoW, logoH},
             colours: {navy, accent}, no, date, q (the stored quote, see quotes.js), notes: [company standing notes] }

   The look follows the quotation format the company gave (red rule under the header, navy table head, totals with a tinted
   TOTAL PAYABLE row, terms, acceptance box, payment bar). Colours come from the company brand. */
var QuoteDoc = (function () {
  var W = 595.28, H = 841.89;
  /* Helvetica widths per 1 pt of font size x 100, characters 32 to 126 */
  var WN = [28, 28, 35, 55, 55, 89, 66, 19, 33, 33, 39, 58, 28, 33, 28, 28, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 28, 28, 58, 58, 58, 55, 101, 66, 66, 72, 72, 66, 61, 78, 72, 28, 50, 66, 55, 83, 72, 78, 66, 78, 72, 66, 61, 72, 66, 94, 66, 66, 61, 28, 28, 28, 47, 55, 33, 55, 55, 50, 55, 55, 28, 55, 55, 22, 22, 50, 22, 83, 55, 55, 55, 55, 33, 50, 28, 55, 50, 72, 50, 50, 50, 33, 26, 33, 58];
  var WB = [28, 33, 47, 55, 55, 89, 72, 24, 33, 33, 39, 58, 28, 33, 28, 28, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 33, 33, 58, 58, 58, 61, 97, 72, 72, 72, 72, 66, 61, 78, 72, 28, 55, 72, 61, 83, 72, 78, 66, 78, 72, 66, 61, 72, 66, 94, 66, 66, 61, 33, 28, 33, 58, 55, 33, 55, 61, 55, 61, 55, 33, 61, 61, 28, 28, 55, 28, 89, 61, 61, 61, 61, 39, 55, 33, 61, 55, 78, 55, 55, 50, 39, 28, 39, 58];
  function tw(s, size, bold) { var t = WB, n = 0, i, c; t = bold ? WB : WN; s = String(s); for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); n += c >= 32 && c <= 126 ? t[c - 32] : 55; } return n * size / 100; }
  /* PDF text has only the Latin-1 letters of the standard fonts: swap the usual typographic marks for plain ones */
  function plain(s) { return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x09\x0A\x0D\x20-\xFF]/g, ''); }

  /* ---------- colours ---------- */
  function rgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) || 0; }); }
  function hex(a) { return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function palette(c) {
    var navy = (c && c.navy) || '#102A43', accent = (c && c.accent) || '#C9252C';
    /* a navy that is too light to carry white text is darkened */
    var i = 0; while (lum(navy) > .12 && i < 20) { navy = mix(navy, '#000000', .1); i++; }
    return { navy: navy, accent: accent, text: (c && c.text) || mix(navy, '#ffffff', .1), label: (c && c.label) || mix(navy, '#ffffff', .45),
      tint: (c && c.tint) || mix(navy, '#ffffff', .955), pale: (c && c.pale) || mix(navy, '#ffffff', .972), line: (c && c.line) || mix(navy, '#ffffff', .86),
      totalBg: (c && c.totalBg) || mix(accent, '#ffffff', .95) };
  }

  /* ---------- money, dates ---------- */
  function n2(v) { v = Math.round((+v || 0) * 100) / 100; var s = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '-' : '') + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1]; }
  function rm(v) { v = Math.round((+v || 0) * 100) / 100; return (v < 0 ? '-RM ' : 'RM ') + n2(Math.abs(v)); }
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function d(x) { return x instanceof Date ? x : new Date(x); }
  function time(x) { x = d(x); var h = x.getHours(), m = x.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM'); }
  function dayLong(x) { x = d(x); return x.getDate() + ' ' + MON[x.getMonth()] + ' ' + x.getFullYear(); }
  function dayShort(x) { x = d(x); return x.getDate() + ' ' + MON[x.getMonth()].slice(0, 3) + ' ' + x.getFullYear(); }
  function dtLong(x) { return dayLong(x) + ', ' + time(x); }
  function dtShort(x) { return dayShort(x) + ', ' + time(x); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  /* ---------- the money of a quote ---------- */
  function calc(q) {
    var s = d(q.start), e = d(q.end), hours = Math.max(0, (e - s) / 36e5);
    var autoDays = Math.max(1, Math.ceil(hours / 24 - 1e-6));
    var days = +q.days > 0 ? Math.round(+q.days) : autoDays;
    var daily = +q.daily || 0, rent = days * daily;
    var cover = q.cover && +q.cover.daily ? Math.round(+q.cover.daily * days * 100) / 100 : 0;
    var extras = (q.extras || []).filter(function (x) { return x && String(x.text || '').trim() && (+x.qty || 0) * (+x.rate || 0); }).map(function (x) { return { text: String(x.text).trim(), qty: +x.qty || 0, rate: +x.rate || 0, amt: Math.round((+x.qty || 0) * (+x.rate || 0) * 100) / 100 }; });
    var other = extras.reduce(function (a, x) { return a + x.amt; }, 0), delivery = +q.delivery || 0, ret = +q.ret || 0, discount = +q.discount || 0, deposit = +q.deposit || 0;
    var charges = Math.round((rent + cover + delivery + ret + other - discount) * 100) / 100;
    /* calendar days between the two dates, ignoring the time */
    var cal = Math.round((new Date(e.getFullYear(), e.getMonth(), e.getDate()) - new Date(s.getFullYear(), s.getMonth(), s.getDate())) / 864e5);
    return { hours: hours, autoDays: autoDays, days: days, calDays: cal, daily: daily, rent: rent, cover: cover, delivery: delivery, ret: ret, extras: extras, other: other, discount: discount, deposit: deposit, charges: charges, total: Math.round((charges + deposit) * 100) / 100 };
  }
  /* 'KQ-2026-1125-001': prefix, year, month and day of the quote, then a running number for that day */
  function nextNo(list, prefix, date) {
    var x = d(date || new Date()), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var head = (prefix || 'Q') + '-' + x.getFullYear() + '-' + p2(x.getMonth() + 1) + p2(x.getDate()) + '-', top = 0;
    (list || []).forEach(function (r) { if (r && r.no && r.no.indexOf(head) === 0) { var n = parseInt(r.no.slice(head.length), 10); if (n > top) top = n; } });
    var n = top + 1; return head + (n < 10 ? '00' : n < 100 ? '0' : '') + n;
  }

  /* the terms, as lines of runs: [{t: text, b: bold}] */
  function terms(q, m, notes) {
    var out = [];
    out.push([{ t: 'Rental rate: ' + rm(m.daily) + ' per day; total rental charge is ' + rm(m.rent) + '.' }]);
    out.push([{ t: 'Rental period: ' }, { t: dtLong(q.start) + ' to ' + dtLong(q.end), b: 1 }, { t: '.' }]);
    if (m.days === m.autoDays && m.days > m.calDays && m.days > 1) out.push([{ t: 'Although the calendar-date difference is ' + plural(m.calDays, 'day') + ', the rental extends beyond ' + (m.days - 1) * 24 + ' hours; therefore, it is charged as ' + plural(m.days, 'rental day') + '.', b: 1 }]);
    if (m.cover) out.push([{ t: 'Damage cover' + (q.cover.name ? ' (' + q.cover.name + ')' : '') + ': ' + rm(q.cover.daily) + ' per day; total ' + rm(m.cover) + '.' }]);
    var dr = []; if (m.delivery) dr.push('Delivery charge: ' + rm(m.delivery) + '.'); if (m.ret) dr.push('Return charge: ' + rm(m.ret) + '.');
    if (dr.length) out.push([{ t: dr.join(' ') }]);
    if (m.discount) out.push([{ t: 'Discount: ' + rm(m.discount) + ' off the charges.' }]);
    if (m.deposit) out.push([{ t: 'Refundable security deposit: ' + rm(m.deposit) + ', subject to vehicle return condition and applicable deductions.' }]);
    [].concat(notes || [], String(q.notes || '').split(/\n+/)).forEach(function (l) { l = String(l || '').trim(); if (l) out.push([{ t: l.replace(/^\d+[.)]\s*/, '') }]); });
    return out;
  }

  /* ---------- layout ---------- */
  function layout(inp) {
    var co = inp.co || {}, q = inp.q, m = calc(q), P = palette(inp.colours), pages = [], ops, y;
    var L = 68, R = 527.2, TX = 74, FOOT = 790;
    var page = function () { ops = []; pages.push(ops); };
    var rect = function (x, yy, w, h, fill) { ops.push({ k: 'rect', x: x, y: yy, w: w, h: h, fill: fill }); };
    var line = function (x1, y1, x2, y2, col, lw) { ops.push({ k: 'line', x1: x1, y1: y1, x2: x2, y2: y2, col: col, lw: lw }); };
    var box = function (x, yy, w, h, col, lw) { line(x, yy, x + w, yy, col, lw); line(x, yy + h, x + w, yy + h, col, lw); line(x, yy, x, yy + h, col, lw); line(x + w, yy, x + w, yy + h, col, lw); };
    /* text: top = the top of the capitals, like the format's measurements; align 'l' | 'r' | 'c' */
    var text = function (s, x, top, size, bold, col, align) { s = plain(s); if (!s) return; ops.push({ k: 'text', s: s, x: x, y: top + size * .76, size: size, bold: !!bold, col: col || P.text, align: align || 'l', w: tw(s, size, bold) }); };
    var runs = function (rs, x, top, size, col) { var cx = x; rs.forEach(function (r) { var s = plain(r.t); text(s, cx, top, size, r.b, col); cx += tw(s, size, r.b); }); };
    var wrap = function (s, size, bold, width) {
      var words = plain(s).split(' '), lines = [], cur = '';
      words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (cur && tw(t, size, bold) > width) { lines.push(cur); cur = w; } else cur = t; });
      if (cur || !lines.length) lines.push(cur); return lines;
    };
    /* runs that wrap: split every run into words that keep their weight */
    var wrapRuns = function (rs, size, width) {
      var words = []; rs.forEach(function (r) { plain(r.t).split(/(\s+)/).forEach(function (w) { if (w) words.push({ t: w, b: r.b }); }); });
      var lines = [[]], wd = 0;
      words.forEach(function (w) {
        var ww = tw(w.t, size, w.b);
        if (/^\s+$/.test(w.t)) { if (lines[lines.length - 1].length) { lines[lines.length - 1].push(w); wd += ww; } return; }
        if (wd + ww > width && lines[lines.length - 1].length) { var last = lines[lines.length - 1]; while (last.length && /^\s+$/.test(last[last.length - 1].t)) last.pop(); lines.push([]); wd = 0; }
        lines[lines.length - 1].push(w); wd += ww;
      });
      return lines;
    };
    var footer = function () { /* drawn at the end on every page */ };
    var need = function (h) { if (y + h > FOOT) { page(); y = 50; return true; } return false; };

    page();
    /* header: logo (top left), QUOTATION (top right) */
    if (co.logo) {
      var bw = 133.2, bh = 73, lw = co.logoW || bw, lh = co.logoH || bh, k = Math.min(bw / lw, bh / lh), iw = lw * k, ih = lh * k;
      ops.push({ k: 'img', src: co.logo, x: TX, y: 37.3 + (bh - ih) / 2, w: iw, h: ih });
    }
    text('QUOTATION', 521.2, 41.5, 20, 1, P.navy, 'r');
    /* company block under the logo */
    y = 115.9;
    var head = String(co.legal || co.trading || '').toUpperCase(), addr = String(co.address || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var addrLines = []; addr.forEach(function (a) { addrLines = addrLines.concat(wrap(a, 7.4, 0, 230)); });
    text(head, TX, y, 7.4, 1); y += 9.1;
    if (co.regNo) { text('Company No: ' + co.regNo, TX, y, 7.4); y += 9.1; }
    addrLines.forEach(function (a) { text(a, TX, y, 7.4); y += 9.1; });
    var contact = [co.phone, co.email, co.site].filter(Boolean).join(' | ');
    if (contact) { wrap(contact, 7.4, 0, 300).forEach(function (a) { text(a, TX, y, 7.4); y += 9.1; }); }
    /* number and date (right) */
    var noV = ' ' + plain(inp.no || ''), dV = ' ' + dayLong(inp.date || new Date());
    text(noV, 521.2, 116.1, 8.4, 0, null, 'r'); text('Quotation No.', 521.2 - tw(noV, 8.4), 116.1, 8.4, 1, null, 'r');
    text(dV, 521.2, 126.8, 8.4, 0, null, 'r'); text('Date:', 521.2 - tw(dV, 8.4), 126.8, 8.4, 1, null, 'r');
    var ruleTop = Math.max(167.9, y + 6.5);
    rect(L, ruleTop, R - L, 3.7, P.accent);
    y = ruleTop + 13.6;

    /* QUOTATION FOR | RENTAL DETAILS */
    var leftL = [[{ t: q.name || '', b: 1 }]];
    if (q.company) leftL.push([{ t: q.company }]);
    if (q.phone) leftL.push([{ t: 'Mobile: ' + q.phone }]);
    if (q.email) leftL.push([{ t: 'Email: ' + q.email }]);
    var rightL = [[{ t: 'Vehicle:', b: 1 }, { t: ' ' + (q.vehicle || '') }], [{ t: 'Pickup:', b: 1 }, { t: ' ' + dtLong(q.start) }], [{ t: 'Return:', b: 1 }, { t: ' ' + dtLong(q.end) }], [{ t: 'Chargeable Duration:', b: 1 }, { t: ' ' + plural(m.days, 'day') }]];
    var fit = function (ls, width) { var out = []; ls.forEach(function (rs) { out = out.concat(wrapRuns(rs, 8.4, width)); }); return out; };
    leftL = fit(leftL, 210); rightL = fit(rightL, 222);
    var nb = Math.max(leftL.length, rightL.length), bh1 = 15.5 + nb * 10.7 + 1.2;
    rect(L, y, R - L, bh1, P.tint); box(L, y, R - L, bh1, P.line, .5); line(292, y, 292, y + bh1, P.line, .4);
    text('QUOTATION FOR', TX, y + 4.8, 8.4, 1, P.label); text('RENTAL DETAILS', 298, y + 4.8, 8.4, 1, P.label);
    leftL.forEach(function (rs, i) { runs(rs, TX, y + 15.5 + i * 10.7, 8.4); });
    rightL.forEach(function (rs, i) { runs(rs, 298, y + 15.5 + i * 10.7, 8.4); });
    y += bh1 + 10.8;

    /* the table */
    var C1 = 309, C2 = 360, C3 = 442.2;
    var thead = function () {
      rect(L, y, R - L, 20.9, P.navy);
      text('DESCRIPTION', TX, y + 4.2, 7.3, 1, '#ffffff'); text('QTY', 335, y + 4.2, 7.3, 1, '#ffffff', 'c');
      text('RATE (RM)', 402.5, y + 4.2, 7.3, 1, '#ffffff', 'c'); text('AMOUNT (RM)', 522, y + 4.2, 7.3, 1, '#ffffff', 'r');
      line(L, y, R, y, P.line, .4); y += 20.9;
    };
    var rows = [];
    rows.push({ d: (q.vehicle || 'Vehicle') + ' - Vehicle Rental', sub: dtShort(q.start) + ' to ' + dtShort(q.end), qty: plural(m.days, 'day'), rate: n2(m.daily) + ' / day', amt: n2(m.rent) });
    if (m.cover) rows.push({ d: 'Damage Cover' + (q.cover.name ? ' - ' + q.cover.name : ''), qty: plural(m.days, 'day'), rate: n2(q.cover.daily) + ' / day', amt: n2(m.cover) });
    if (m.delivery) rows.push({ d: 'Delivery Charge', sub: q.deliveryNote || '', qty: '1', rate: n2(m.delivery), amt: n2(m.delivery) });
    if (m.ret) rows.push({ d: 'Return Charge', sub: q.retNote || '', qty: '1', rate: n2(m.ret), amt: n2(m.ret) });
    m.extras.forEach(function (x) { rows.push({ d: x.text, qty: String(x.qty), rate: n2(x.rate), amt: n2(x.amt) }); });
    if (m.discount) rows.push({ d: 'Discount', qty: '1', rate: n2(-m.discount), amt: n2(-m.discount) });
    if (m.deposit) rows.push({ d: 'Refundable Security Deposit', qty: '1', rate: n2(m.deposit), amt: n2(m.deposit) });
    thead();
    var top0 = y, segTop = y;
    var closeSeg = function () { box(L, segTop, R - L, y - segTop, P.line, .4); [C1, C2, C3].forEach(function (x) { line(x, segTop, x, y, P.line, .4); }); };
    rows.forEach(function (r, i) {
      var dl = wrap(r.d, 8.4, 1, C1 - TX - 6), sl = r.sub ? wrap(r.sub, 8.4, 0, C1 - TX - 6) : [], n = dl.length + sl.length, h = n <= 1 ? 20.9 : 10.2 + n * 10.7;
      if (need(h)) { closeSeg(); thead(); segTop = y; }
      rect(L, y, R - L, h, i % 2 ? P.tint : '#ffffff'); line(L, y, R, y, P.line, .4);
      var ty = y + 6.8; dl.forEach(function (l) { text(l, TX, ty, 8.4, 1); ty += 10.7; }); sl.forEach(function (l) { text(l, TX, ty, 8.4); ty += 10.7; });
      var mid = y + h / 2;
      text(r.qty, (C1 + C2) / 2, mid - 3.05, 7.4, 0, null, 'c');
      text(r.rate, C3 - 6, mid - 3.6, 8.4, 0, null, 'r');
      text(r.amt, 521.2, mid - 3.6, 8.4, 1, null, 'r');
      y += h;
    });
    closeSeg();
    void top0;

    /* totals */
    var sums = [['Rental Charges', m.rent]];
    if (m.cover) sums.push(['Damage Cover', m.cover]);
    if (m.delivery) sums.push(['Delivery Charge', m.delivery]);
    if (m.ret) sums.push(['Return Charge', m.ret]);
    if (m.other) sums.push(['Other Charges', m.other]);
    if (m.discount) sums.push(['Discount', -m.discount]);
    if (m.deposit) sums.push(['Refundable Deposit', m.deposit]);
    need(10 + sums.length * 15.9 + 16);
    y += 10;
    sums.forEach(function (s) { text(s[0], 424.9, y, 8.4, 0, null, 'r'); text(rm(s[1]), 521.2, y, 8.4, 1, null, 'r'); y += 15.9; });
    y = y - 15.9 + 11.6;
    rect(L, y, R - L, 15.9, P.totalBg); line(L, y, R, y, P.accent, .8);
    text('TOTAL PAYABLE', 424.9, y + 4.3, 8.4, 1, null, 'r'); text(rm(m.total), 521.2, y + 4.3, 8.4, 1, null, 'r');
    y += 15.9 + 10.6;

    /* terms and notes */
    var tl = terms(q, m, inp.notes), tLines = [];
    /* terms sit on the same left edge as every other text (inside the boxes); a long term wraps under its own words, not under the number */
    var numW = tw((tl.length > 9 ? '10' : '9') + '. ', 7.4);
    tl.forEach(function (rs, i) { var ls = wrapRuns(rs, 7.4, 521.2 - TX - numW); ls.forEach(function (l, k) { tLines.push({ n: k ? '' : (i + 1) + '.', l: l }); }); });
    need(13.4 + Math.min(tLines.length, 3) * 9.1);
    text('TERMS & NOTES', TX, y, 10.2, 1, P.navy); y += 13.4;
    tLines.forEach(function (l) { need(9.1); if (l.n) text(l.n, TX, y, 7.4); runs(l.l, TX + numW, y, 7.4); y += 9.1; });
    y = y - 9.1 + 16.1;

    /* prepared by | customer acceptance */
    need(48.8 + 8.5 + 31 + 20);
    var bx = 48.8;
    box(L, y, R - L, bx, P.line, .45); line(292, y, 292, y + bx, P.line, .4);
    text('Prepared by', TX, y + 4.7, 8.4, 1); text(co.trading || co.legal || '', TX, y + 15.4, 8.4);
    if (co.legal && co.trading && co.legal.toLowerCase() !== co.trading.toLowerCase()) text('Operated by ' + String(co.legal).replace(/\.+$/, '') + '.', TX, y + 27.2, 7, 0);
    text('Customer Acceptance', 298, y + 4.7, 8.4, 1);
    /* both blanks start at the same point and end at the box's right edge */
    var bl = 298 + tw('Name / Signature: ', 8.4), blank = function (w) { var u = ''; while (tw(u + '_', 8.4) <= w) u += '_'; return u; };
    text('Name / Signature:', 298, y + 21.4, 8.4); text(blank(521.2 - bl), bl, y + 21.4, 8.4);
    text('Date:', 298, y + 34.6, 8.4); text(blank(521.2 - bl), bl, y + 34.6, 8.4);
    y += bx + 8.5;

    /* payment bar */
    var bank = co.bank || {};
    if (bank.accNo || bank.name) {
      rect(L, y, 150.2 - L, 31, P.navy); rect(150.2, y, R - 150.2, 31, P.pale); box(L, y, R - L, 31, P.navy, .7);
      text('PAYMENT', TX, y + 5.9, 7, 1, '#ffffff'); text('DETAILS', TX, y + 16.3, 7, 1, '#ffffff');
      var cell = function (lab, val, x, width) {
        var ls = wrapRuns([{ t: lab, b: 1 }, { t: ' ' + (val || '') }], 7.7, width);
        if (lab === 'A/C No.:') ls = [[{ t: lab, b: 1 }], [{ t: val }]];
        var t0 = ls.length > 1 ? y + 7.6 : y + 12.3; ls.slice(0, 2).forEach(function (l, i) { runs(l, x, t0 + i * 9.5, 7.7); });
      };
      /* the account number never wraps: a long one moves its column left */
      var acW = Math.max(tw('A/C No.:', 7.7, 1), tw(plain(bank.accNo || ''), 7.7)), acX = Math.max(400, Math.min(448.2, 521.2 - acW));
      cell('Account:', bank.accName || co.legal || co.trading, 155.2, 134);
      cell('Bank:', bank.name || '', 298, acX - 298 - 6);
      cell('A/C No.:', bank.accNo || '', acX, 521.2 - acX + 2);
      y += 31 + 8.2;
    }
    text('Thank you for choosing ' + (co.trading || co.legal || 'us') + '.', W / 2, y, 8.4, 1, P.navy, 'c');

    /* footer on every page */
    var foot = [co.legal, co.trading].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' | ');
    pages.forEach(function (pg, i) {
      pg.push({ k: 'line', x1: L, y1: 816.4, x2: R, y2: 816.4, col: P.line, lw: .5 });
      pg.push({ k: 'text', s: plain(foot), x: TX, y: 819.9 + 7 * .76, size: 7, bold: false, col: P.label, align: 'l', w: tw(foot, 7) });
      pg.push({ k: 'text', s: 'Page ' + (i + 1), x: 521.2, y: 819.9 + 7 * .76, size: 7, bold: false, col: P.label, align: 'r', w: tw('Page ' + (i + 1), 7) });
    });
    void footer;
    return { pages: pages, w: W, h: H, calc: m };
  }

  /* ---------- renderers ---------- */
  function escX(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function svg(inp) {
    var lay = layout(inp);
    return lay.pages.map(function (ops) {
      var out = '<svg class="qd-page" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" font-family="Helvetica, Arial, \'Liberation Sans\', sans-serif" role="img" aria-label="Quotation">' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
      ops.forEach(function (o) {
        if (o.k === 'rect') out += '<rect x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h + '" fill="' + o.fill + '"/>';
        else if (o.k === 'line') out += '<line x1="' + o.x1 + '" y1="' + o.y1 + '" x2="' + o.x2 + '" y2="' + o.y2 + '" stroke="' + o.col + '" stroke-width="' + Math.max(o.lw || .5, .5) + '"/>';
        else if (o.k === 'img') out += '<image href="' + escX(o.src) + '" x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h + '" preserveAspectRatio="xMidYMid meet"/>';
        else if (o.k === 'text') out += '<text x="' + o.x + '" y="' + o.y + '" font-size="' + o.size + '"' + (o.bold ? ' font-weight="700"' : '') + ' fill="' + o.col + '"' + (o.align === 'r' ? ' text-anchor="end"' : o.align === 'c' ? ' text-anchor="middle"' : '') + ' xml:space="preserve">' + escX(o.s) + '</text>';
      });
      return out + '</svg>';
    }).join('');
  }
  function pdf(inp, JsPDF) {
    var lay = layout(inp), doc = new JsPDF({ unit: 'pt', format: 'a4', compress: true });
    lay.pages.forEach(function (ops, i) {
      if (i) doc.addPage();
      ops.forEach(function (o) {
        if (o.k === 'rect') { var f = rgb(o.fill); doc.setFillColor(f[0], f[1], f[2]); doc.rect(o.x, o.y, o.w, o.h, 'F'); }
        else if (o.k === 'line') { var c = rgb(o.col); doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(o.lw || .4); doc.line(o.x1, o.y1, o.x2, o.y2); }
        else if (o.k === 'img') { try { var fm = /^data:image\/jpe?g/i.test(o.src) ? 'JPEG' : 'PNG'; doc.addImage(o.src, fm, o.x, o.y, o.w, o.h, undefined, 'FAST'); } catch (e) {} }
        else if (o.k === 'text') {
          var t = rgb(o.col); doc.setTextColor(t[0], t[1], t[2]); doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size);
          doc.text(o.s, o.x, o.y, o.align === 'r' ? { align: 'right' } : o.align === 'c' ? { align: 'center' } : undefined);
        }
      });
    });
    var co = inp.co || {};
    doc.setProperties({ title: 'Quotation ' + (inp.no || ''), author: co.trading || co.legal || '', creator: 'Orbique FMS' });
    return doc.output('arraybuffer');
  }

  /* a logo for companies with no logo file: their mark with the name beside it, as a PNG */
  function lockup(markSvg, name, colour) {
    return new Promise(function (res) {
      try {
        var s = String(markSvg || ''); if (s.indexOf('xmlns') < 0) s = s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        s = s.replace('<svg ', '<svg width="256" height="256" ');
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement('canvas'), x = cv.getContext('2d'), fs = 120, words = String(name || '').trim();
          x.font = '700 ' + fs + 'px Helvetica, Arial, sans-serif'; var wd = Math.ceil(x.measureText(words).width);
          cv.width = 256 + (words ? 48 + wd : 0) + 8; cv.height = 256; x = cv.getContext('2d');
          x.drawImage(img, 0, 0, 256, 256);
          if (words) { x.font = '700 ' + fs + 'px Helvetica, Arial, sans-serif'; x.fillStyle = colour || '#111111'; x.textBaseline = 'middle'; x.fillText(words, 256 + 48, 134); }
          res({ src: cv.toDataURL('image/png'), w: cv.width, h: cv.height });
        };
        img.onerror = function () { res(null); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      } catch (e) { res(null); }
    });
  }
  /* the size of any logo picture, so it keeps its shape */
  function imgSize(src) { return new Promise(function (res) { if (!src) return res(null); var i = new Image(); i.onload = function () { res({ src: src, w: i.naturalWidth || i.width, h: i.naturalHeight || i.height }); }; i.onerror = function () { res(null); }; i.src = src; }); }

  return { calc: calc, terms: terms, layout: layout, svg: svg, pdf: pdf, nextNo: nextNo, lockup: lockup, imgSize: imgSize, palette: palette, fmt: { n2: n2, rm: rm, dtLong: dtLong, dtShort: dtShort, dayLong: dayLong, plural: plural } };
})();
if (typeof module !== 'undefined') module.exports = QuoteDoc;

/* ===================================================================
   Page: Reports (#page=reports)   Owner: builder 2
   Every report has a live preview, a styled Excel file (xlsx-js-style, the SheetJS build with cell styles; plain
   SheetJS when it cannot load) and a PDF (jsPDF), in the company colours. The helpers rptXlsx / rptPdf / rptExpBook
   are also used by Expenses and Instalments.
   =================================================================== */
var RPT_XS = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.min.js', RPT_X = null;
function rptLib() {
  if (RPT_X) return Promise.resolve(RPT_X);
  var prev = window.XLSX;
  return UI.loadScript(RPT_XS).then(function () { RPT_X = { X: window.XLSX, styled: true }; if (prev) window.XLSX = prev; return RPT_X; }, function () {
    return UI.loadScript(UI.LIB.xlsx).then(function () { RPT_X = { X: window.XLSX, styled: false }; return RPT_X; });
  });
}
function rptCol(k) { var s = ''; k++; while (k > 0) { var m = (k - 1) % 26; s = String.fromCharCode(65 + m) + s; k = Math.floor((k - 1) / 26); } return s; }
function rptPal() {
  var b = B(), h = function (c) { return c.replace('#', '').toUpperCase(); };
  return { p: h(C.readable(b.primary, 4.5)), dark: h(C.mix(b.secondary, '#000000', C.lum(b.secondary) > .08 ? .55 : 0)), tint: h(C.mix(b.primary, '#FFFFFF', .88)), grey: 'F3F4F6', line: 'D9DCE1', mute: '6B7280', text: '1F2328', dim: 'A0A4AB' };
}
function rptStyles(pal) {
  var M = '#,##0.00;-#,##0.00', ln = function (c, s) { return { style: s || 'thin', color: { rgb: c } }; };
  var f = function (o) { return { font: Object.assign({ name: 'Calibri', sz: 10, color: { rgb: pal.text } }, o.font || {}), fill: o.fill ? { patternType: 'solid', fgColor: { rgb: o.fill } } : undefined, alignment: Object.assign({ vertical: 'center' }, o.al || {}), border: o.border, numFmt: o.z }; };
  var bot = { bottom: ln(pal.line) }, head = { bottom: ln(pal.p, 'medium') }, tot = { top: ln(pal.dark), bottom: ln(pal.dark, 'double') };
  var S = {
    band: f({ font: { sz: 15, bold: true, color: { rgb: 'FFFFFF' } }, fill: pal.dark, al: { indent: 1 } }),
    bandr: f({ font: { sz: 9, color: { rgb: 'FFFFFF' } }, fill: pal.dark, al: { horizontal: 'right' } }),
    strip: f({ fill: pal.p }),
    sub: f({ font: { sz: 10, color: { rgb: pal.mute } } }),
    il: f({ font: { bold: true, color: { rgb: pal.mute } } }), iv: f({}),
    sec: f({ font: { sz: 11, bold: true, color: { rgb: pal.p } }, border: { bottom: ln(pal.p) } }),
    h: f({ font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: pal.dark, al: { wrapText: true }, border: head }),
    t: f({ border: bot }), tb: f({ font: { bold: true }, border: bot }), tw: f({ al: { wrapText: true, vertical: 'top' }, border: bot }), tc: f({ al: { horizontal: 'center' }, border: bot }),
    n: f({ z: '#,##0', border: bot }), m: f({ z: M, border: bot }), pct: f({ z: '0.0%', border: bot }), d: f({ z: 'd mmm yyyy', al: { horizontal: 'left' }, border: bot }), dt: f({ z: 'd mmm yyyy, h:mm AM/PM', al: { horizontal: 'left' }, border: bot }), tm: f({ z: 'h:mm AM/PM', al: { horizontal: 'left' }, border: bot }), dec: f({ z: '0.0', border: bot }),
    tot: f({ font: { bold: true }, fill: pal.tint, border: tot }), totm: f({ font: { bold: true }, fill: pal.tint, border: tot, z: M }), totn: f({ font: { bold: true }, fill: pal.tint, border: tot, z: '#,##0' }), totp: f({ font: { bold: true }, fill: pal.tint, border: tot, z: '0.0%' }), totg: f({ font: { bold: true, color: { rgb: pal.p } }, fill: pal.tint, border: tot, z: M }),
    day: f({ font: { bold: true }, fill: pal.grey, border: bot }), daym: f({ font: { bold: true }, fill: pal.grey, border: bot, z: M }),
    kl: f({ font: { color: { rgb: '4B5563' } }, border: bot }), kv: f({ font: { bold: true, sz: 11 }, border: bot, z: M }), kvn: f({ font: { bold: true, sz: 11 }, border: bot, z: '#,##0' }), kvd: f({ font: { bold: true, sz: 11 }, border: bot, z: '0.0' }), kvp: f({ font: { bold: true, sz: 11 }, border: bot, z: '0.0%' }), kvt: f({ font: { bold: true, sz: 11 }, border: bot }), kvg: f({ font: { bold: true, sz: 12, color: { rgb: pal.p } }, border: bot, z: M }),
    note: f({ font: { sz: 9, italic: true, color: { rgb: pal.mute } }, al: { wrapText: true, vertical: 'top' } }),
    bar: f({ font: { sz: 9, color: { rgb: pal.p } }, border: bot }),
    dim: f({ font: { color: { rgb: pal.dim } }, border: bot }), dimm: f({ font: { color: { rgb: pal.dim } }, border: bot, z: M }), dimn: f({ font: { color: { rgb: pal.dim } }, border: bot, z: '#,##0' }), dimp: f({ font: { color: { rgb: pal.dim } }, border: bot, z: '0.0%' })
  };
  ['h'].forEach(function (k) { S[k + 'r'] = JSON.parse(JSON.stringify(S[k])); S[k + 'r'].alignment.horizontal = 'right'; S[k + 'c'] = JSON.parse(JSON.stringify(S[k])); S[k + 'c'].alignment.horizontal = 'center'; });
  return S;
}
/* a row helper: rptRow(cells, {zebra, h}) */
function rptRow(cells, o) { o = o || {}; if (o.zebra) cells._z = true; if (o.h) cells._h = o.h; return cells; }
/* rptXlsx('file.xlsx', [{name, cols:[widths], rows:[[cell]], merges:['A1:F1'], freeze:'A5', filter:'A4:K90', grid:false, landscape:true}])
   A cell is a value (string, number, Date) or {v, s: style name, f: formula}. */
function rptXlsx(filename, sheets) {
  UI.toast('Preparing ' + filename + '...', { tone: 'info', ms: 1600 });
  return rptLib().then(function (L) {
    var X = L.X, pal = rptPal(), S = rptStyles(pal), wb = X.utils.book_new();
    sheets.forEach(function (sp) {
      var ws = {}, maxC = (sp.cols || []).length - 1, heights = [];
      sp.rows.forEach(function (row, r) {
        if (!row) return;
        if (row._h) heights[r] = { hpt: row._h };
        row.forEach(function (c, k) {
          if (c === undefined) return;
          var o = c !== null && typeof c === 'object' && !(c instanceof Date) ? c : { v: c }, v = o.v, cell = {};
          if (v instanceof Date) { cell.t = 'n'; cell.v = (v.getTime() - v.getTimezoneOffset() * 6e4) / 864e5 + 25569; }
          else if (typeof v === 'number') { cell.t = 'n'; cell.v = Math.round(v * 1e6) / 1e6; }
          else if (v == null && o.f) { cell.t = 'n'; cell.v = 0; }
          else { cell.t = 's'; cell.v = v == null ? '' : String(v); }
          if (o.f) cell.f = o.f;
          var sn = o.s || (v instanceof Date ? 'd' : typeof v === 'number' ? 'n' : 't');
          var st = S[sn] || S.t;
          if (row._z && st && !/^(tot|day|h|band|strip|sec)/.test(sn)) { st = JSON.parse(JSON.stringify(st)); st.fill = { patternType: 'solid', fgColor: { rgb: 'F7F7F9' } }; }
          if (L.styled) cell.s = st;
          if (st.numFmt) cell.z = st.numFmt;
          ws[rptCol(k) + (r + 1)] = cell; if (k > maxC) maxC = k;
        });
      });
      ws['!ref'] = 'A1:' + rptCol(Math.max(0, maxC)) + Math.max(1, sp.rows.length);
      ws['!cols'] = (sp.cols || []).map(function (w) { return { wch: w }; });
      ws['!rows'] = heights;
      if (sp.merges) ws['!merges'] = sp.merges.map(function (m) { return X.utils.decode_range(m); });
      if (sp.filter) ws['!autofilter'] = { ref: sp.filter };
      ws['!margins'] = { left: .4, right: .4, top: .5, bottom: .5, header: .3, footer: .3 };
      X.utils.book_append_sheet(wb, ws, sp.name.slice(0, 31));
    });
    wb.Props = { Title: filename.replace(/\.xlsx$/, ''), Author: B().name, Company: B().name };
    var out = X.write(wb, { type: 'array', bookType: 'xlsx' });
    try { out = rptPatch(X, out, sheets); } catch (err) { /* keep the file without frozen panes */ }
    return UI.download({ filename: filename, data: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }, function () { UI.toast('The Excel maker could not load. Check the internet connection and try again.', { tone: 'bad' }); return 'error'; });
}
/* frozen panes, no grid lines and landscape print setup, written straight into the sheet XML */
function rptPatch(X, out, sheets) {
  var cfb = X.CFB.read(new Uint8Array(out), { type: 'array' }), enc = new TextEncoder(), dec = new TextDecoder();
  sheets.forEach(function (sp, k) {
    var f = X.CFB.find(cfb, '/xl/worksheets/sheet' + (k + 1) + '.xml'); if (!f) return;
    var xml = dec.decode(f.content), view = '<sheetView workbookViewId="0"' + (sp.grid === false ? ' showGridLines="0"' : '') + '>';
    if (sp.freeze) {
      var mt = /^([A-Z]+)(\d+)$/.exec(sp.freeze), xs = 0, ys = +mt[2] - 1;
      for (var q = 0; q < mt[1].length; q++) xs = xs * 26 + mt[1].charCodeAt(q) - 64; xs -= 1;
      var pane = xs && ys ? 'bottomRight' : ys ? 'bottomLeft' : 'topRight';
      view += '<pane' + (xs ? ' xSplit="' + xs + '"' : '') + (ys ? ' ySplit="' + ys + '"' : '') + ' topLeftCell="' + sp.freeze + '" activePane="' + pane + '" state="frozen"/><selection pane="' + pane + '" activeCell="' + sp.freeze + '" sqref="' + sp.freeze + '"/>';
    }
    view += '</sheetView>';
    xml = xml.replace(/<sheetView workbookViewId="0"\s*\/>/, view);
    if (!/<sheetPr/.test(xml)) xml = xml.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    xml = xml.replace(/(<pageMargins[^>]*\/>)/, '$1<pageSetup paperSize="9" orientation="' + (sp.portrait ? 'portrait' : 'landscape') + '" fitToWidth="1" fitToHeight="0"/>');
    f.content = enc.encode(xml); f.size = f.content.length;
  });
  return X.CFB.write(cfb, { fileType: 'zip', type: 'array' });
}
/* the top of every sheet: a dark band with the title, a thin brand strip and the period line */
function rptTop(title, cols, lines) {
  var n = Math.max(cols, 2), rows = [rptRow([{ v: title, s: 'band' }].concat(Array.apply(null, Array(n - 1)).map(function () { return { v: '', s: 'band' }; })), { h: 30 }), rptRow(Array.apply(null, Array(n)).map(function () { return { v: '', s: 'strip' }; }), { h: 4 })];
  (lines || []).forEach(function (l) { rows.push(Array.isArray(l) ? [{ v: l[0], s: 'il' }, { v: l[1], s: 'iv' }] : [{ v: l, s: 'sub' }]); });
  return { rows: rows, merges: ['A1:' + rptCol(n - 1) + '1'] };
}
function rptWidths(rows, min, max) {
  var w = [];
  rows.forEach(function (r) { if (!r) return; r.forEach(function (c, k) { if (c == null) return; var o = typeof c === 'object' && !(c instanceof Date) ? c : { v: c }; if (/^(band|bandr|note|sub|sec|strip)$/.test(o.s || '')) return; var v = o.v, len = v instanceof Date ? 13 : typeof v === 'number' ? 12 : String(v == null ? '' : v).length + 2; w[k] = Math.max(w[k] || min || 8, Math.min(max || 46, len)); }); });
  return w.map(function (x) { return x || min || 8; });
}
function rptGen() { return invDT(NOW()) + ' by ' + (me() ? me().name : B().owner); }

/* ---------- PDF: landscape A4 report with the brand header, key figure boxes and tables ---------- */
function rptFmt(v, t) {
  if (v == null || v === '') return '';
  if (typeof v === 'object' && !(v instanceof Date)) return rptFmt(v.t, t) + (v.s ? ' · ' + v.s : '');
  if (t === 'money') return UI.fmt.money(v); if (t === 'int') return Number(v).toLocaleString('en-MY');
  if (t === 'pct') return (v * 100).toFixed(1) + '%'; if (t === 'dec') return Number(v).toFixed(1);
  if ((t === 'date' || t === 'dt') && !(v instanceof Date)) return String(v);
  if (typeof v !== 'number' && (t === 'money' || t === 'int' || t === 'pct' || t === 'dec')) return String(v);
  if (t === 'date') return UI.fmt.date(v); if (t === 'dt') return invDT(v);
  return String(v);
}
function rptPdf(m, filename) {
  UI.toast('Preparing ' + filename + '...', { tone: 'info', ms: 1600 });
  return Promise.all([UI.loadScript(UI.LIB.jspdf), invLogoPng()]).then(function (r) {
    var logo = r[1], doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }), W = 297, H = 210, M = 12, CW = W - 2 * M, y;
    var b = B(), P = C.rgb(C.readable(b.primary, 4.5)), S2 = C.rgb(C.mix(b.secondary, '#000000', C.lum(b.secondary) > .08 ? .55 : 0)), T = C.rgb(C.mix(b.primary, '#FFFFFF', .88)), G = [245, 245, 247];
    var font = function (sz, st, col) { doc.setFont('helvetica', st || 'normal'); doc.setFontSize(sz); var c = col || [30, 30, 36]; doc.setTextColor(c[0], c[1], c[2]); };
    var fill = function (c) { doc.setFillColor(c[0], c[1], c[2]); };
    var fit = function (s, w) { s = String(s == null ? '' : s); if (doc.getTextWidth(s) <= w) return s; while (s.length > 1 && doc.getTextWidth(s + '...') > w) s = s.slice(0, -1); return s + '...'; };
    var band = function () { fill(S2); doc.rect(0, 0, W, 4, 'F'); fill(P); doc.rect(0, 4, W, .8, 'F'); };
    var small = function () { band(); font(8, 'bold', [90, 90, 100]); doc.text(m.title + '  |  ' + m.period, M, 11); y = 16; };
    var need = function (h, again) { if (y + h > H - 13) { doc.addPage(); small(); if (again) again(); return true; } return false; };
    band();
    if (logo) doc.addImage(logo, 'PNG', M, 9, 15, 15);
    font(11, 'bold'); doc.text(invCo().trading || b.name, M + (logo ? 18 : 0), 15); font(7.5, 'normal', [110, 110, 120]); doc.text('Report', M + (logo ? 18 : 0), 19.5);
    font(17, 'bold', [20, 20, 24]); doc.text(m.title, W - M, 15, { align: 'right' });
    fill(P); doc.rect(W - M - 16, 18, 16, .8, 'F');
    font(8, 'normal', [90, 90, 100]); doc.text(m.period + '   |   Generated ' + rptGen(), W - M, 23.5, { align: 'right' });
    y = 30;
    if (m.info && m.info.length) { font(7.5, 'normal', [90, 90, 100]); m.info.forEach(function (l) { doc.text(fit(l[0] + ': ' + l[1], CW), M, y); y += 4; }); y += 1; }
    /* key figure boxes */
    var k = (m.kpis || []).filter(function (x) { return !x.hide; });
    for (var s = 0; s < k.length; s += 5) {
      var row = k.slice(s, s + 5), gap = 4, bw = (CW - gap * 4) / 5;
      need(20);
      row.forEach(function (x, j) {
        var bx = M + j * (bw + gap); fill(x.hero ? S2 : G); doc.rect(bx, y, bw, 17, 'F'); fill(P); doc.rect(bx, y, .9, 17, 'F');
        font(6.6, 'bold', x.hero ? [220, 220, 228] : [110, 110, 120]); doc.text(fit(x.l.toUpperCase(), bw - 6), bx + 4, y + 5, { charSpace: .2 });
        font(12, 'bold', x.hero ? [255, 255, 255] : [20, 20, 24]); doc.text(fit(x.v != null ? String(x.v) : rptFmt(x.raw, x.t) || '0', bw - 6), bx + 4, y + 11);
        if (x.note) { font(6.8, 'normal', x.hero ? [210, 210, 218] : [120, 120, 130]); doc.text(fit(x.note, bw - 6), bx + 4, y + 15); }
      });
      y += 21;
    }
    /* tables */
    (m.sections || []).forEach(function (sec) {
      if (sec.pdf === false) return;
      var cols = sec.cols, tw = cols.reduce(function (a, c) { return a + (c.w || 10); }, 0), ws = cols.map(function (c) { return (c.w || 10) / tw * CW; });
      var hasSub = sec.rows.some(function (rw) { return rw.some(function (v) { return v && typeof v === 'object' && !(v instanceof Date) && v.s; }); });
      var rh = hasSub ? 8.6 : 6.2;
      var head = function () { fill(S2); doc.rect(M, y, CW, 7, 'F'); fill(P); doc.rect(M, y + 7, CW, .5, 'F'); var x = M; cols.forEach(function (c, j) { font(7, 'bold', [255, 255, 255]); var tx = fit(c.l, ws[j] - 3); if (c.a === 'r') doc.text(tx, x + ws[j] - 2, y + 4.7, { align: 'right' }); else if (c.a === 'c') doc.text(tx, x + ws[j] / 2, y + 4.7, { align: 'center' }); else doc.text(tx, x + 2, y + 4.7); x += ws[j]; }); y += 7.5; };
      need(22); y += 2;
      font(8.5, 'bold', P); doc.text(sec.title.toUpperCase(), M, y, { charSpace: .4 }); fill(P); doc.rect(M, y + 1.6, 12, .5, 'F'); y += 4;
      head();
      var drawRow = function (rw, kind, zi) {
        need(rh, head);
        if (kind === 'tot') { fill(T); doc.rect(M, y, CW, rh, 'F'); doc.setDrawColor(S2[0], S2[1], S2[2]); doc.setLineWidth(.3); doc.line(M, y, M + CW, y); }
        else if (zi % 2 === 1) { fill(G); doc.rect(M, y, CW, rh, 'F'); }
        var x = M, dim = kind !== 'tot' && sec.dim && sec.dim(rw);
        cols.forEach(function (c, j) {
          var v = rw[j], main = v && typeof v === 'object' && !(v instanceof Date) ? v.t : v, sub = v && typeof v === 'object' && !(v instanceof Date) ? v.s : '';
          var txt = c.hide ? 'Hidden' : rptFmt(main, c.t), col = dim ? [160, 164, 171] : [30, 30, 36];
          font(7.6, kind === 'tot' ? 'bold' : 'normal', col);
          var ty = y + (sub ? 3.8 : rh / 2 + 1.2), tx = fit(txt, ws[j] - 3);
          if (c.a === 'r') doc.text(tx, x + ws[j] - 2, ty, { align: 'right' }); else if (c.a === 'c') doc.text(tx, x + ws[j] / 2, ty, { align: 'center' }); else doc.text(tx, x + 2, ty);
          if (sub) { font(6.4, 'normal', [130, 130, 140]); var sx = fit(sub, ws[j] - 3); if (c.a === 'r') doc.text(sx, x + ws[j] - 2, ty + 3.3, { align: 'right' }); else doc.text(sx, x + 2, ty + 3.3); }
          x += ws[j];
        });
        y += rh;
      };
      if (!sec.rows.length) { need(8); font(7.6, 'italic', [120, 120, 130]); doc.text(sec.empty || 'Nothing in this period.', M + 2, y + 4.5); y += 7; }
      sec.rows.forEach(function (rw, zi) { drawRow(rw, '', zi); });
      if (sec.total && sec.rows.length) drawRow(sec.total, 'tot', 0);
      if (sec.note) { font(6.8, 'italic', [120, 120, 130]); var nl = doc.splitTextToSize(sec.note, CW); need(nl.length * 3.4 + 2); doc.text(nl, M, y + 3.6); y += nl.length * 3.4 + 1.5; }
      y += 5;
    });
    if (m.notes && m.notes.length) {
      need(14); font(8.5, 'bold', P); doc.text('HOW THE NUMBERS ARE WORKED OUT', M, y, { charSpace: .4 }); y += 4.5;
      m.notes.forEach(function (n) { font(7.4, 'normal', [80, 80, 90]); var nl = doc.splitTextToSize('- ' + n, CW); need(nl.length * 3.6); doc.text(nl, M, y); y += nl.length * 3.6 + .6; });
    }
    var pages = doc.getNumberOfPages();
    for (var pg = 1; pg <= pages; pg++) {
      doc.setPage(pg); fill(P); doc.rect(M, H - 10, CW, .3, 'F');
      font(7, 'bold', [40, 40, 48]); doc.text((invCo().trading || b.name) + '  |  ' + m.title, M, H - 6);
      font(7, 'normal', [120, 120, 130]); doc.text(m.period + '   Page ' + pg + ' of ' + pages, W - M, H - 6, { align: 'right' });
    }
    doc.setProperties({ title: m.title + ' ' + m.period, author: invCo().trading || b.name, creator: 'Orbique FMS' });
    return UI.download({ filename: filename, data: doc.output('arraybuffer'), mime: 'application/pdf' });
  }, function () { UI.toast('The PDF maker could not load. Check the internet connection and try again.', { tone: 'bad' }); return 'error'; });
}
/* an Excel workbook from a report model: Summary (key figures and small tables) plus one sheet per big list */
function rptAutoBook(m) {
  var sheets = [], top = rptTop(m.xlTitle || (B().name + ' ' + m.title.toLowerCase()), Math.max.apply(null, (m.sections || []).filter(function (x) { return !x.sheet; }).map(function (x) { return x.cols.length; }).concat([4])), [m.desc, ['Period', m.period], ['Generated', rptGen()]].concat(m.info || []));
  var rows = top.rows.slice(), sty = { money: 'm', int: 'n', pct: 'pct', date: 'd', dt: 'dt', dec: 'dec' }, ksty = { money: 'kv', int: 'kvn', pct: 'kvp', dec: 'kvd' };
  var cellOf = function (v, c, dim) { var main = v && typeof v === 'object' && !(v instanceof Date) ? (v.s ? v.t + ' · ' + v.s : v.t) : v; var s = sty[c.t] || 't'; if (dim) s = { m: 'dimm', n: 'dimn', pct: 'dimp' }[s] || 'dim'; return { v: main == null ? '' : main, s: s }; };
  var table = function (sec, rr, headAt) {
    rr.push(sec.cols.map(function (c) { return { v: c.l, s: c.a === 'r' ? 'hr' : c.a === 'c' ? 'hc' : 'h' }; }));
    var first = rr.length + 1;
    sec.rows.forEach(function (rw, k) { rr.push(rptRow(sec.cols.map(function (c, j) { return cellOf(rw[j], c, sec.dim && sec.dim(rw)); }), { zebra: k % 2 === 1 })); });
    var last = rr.length;
    if (sec.total && sec.rows.length) rr.push(sec.cols.map(function (c, j) { var v = sec.total[j]; if (j === 0) return { v: v || 'Total', s: 'tot' }; if ((c.t === 'money' || c.t === 'int') && c.sum !== false && typeof v === 'number') return { v: v, f: 'SUM(' + rptCol(j) + first + ':' + rptCol(j) + last + ')', s: c.t === 'money' ? 'totm' : 'totn' }; return { v: v == null ? '' : v, s: c.t === 'pct' ? 'totp' : c.t === 'money' ? 'totm' : 'tot' }; }));
    return { first: first, last: last };
  };
  if (m.kpis && m.kpis.length) { rows.push([]); rows.push([{ v: 'KEY FIGURES', s: 'sec' }, { v: '', s: 'sec' }]); m.kpis.forEach(function (k) { rows.push([{ v: k.l + (k.note ? ' (' + k.note + ')' : ''), s: 'kl' }, { v: k.raw != null ? k.raw : k.v, s: ksty[k.t] || 'kvt' }]); }); }
  var own = [];
  (m.sections || []).forEach(function (sec) {
    if (sec.xl === false) return;
    if (sec.sheet) { own.push(sec); return; }
    rows.push([]); rows.push([{ v: sec.title.toUpperCase(), s: 'sec' }].concat(sec.cols.slice(1).map(function () { return { v: '', s: 'sec' }; })));
    table(sec, rows);
    if (sec.note) { rows.push([{ v: sec.note, s: 'note' }]); }
  });
  if (m.notes && m.notes.length) { rows.push([]); rows.push([{ v: 'HOW THE NUMBERS ARE WORKED OUT', s: 'sec' }, { v: '', s: 'sec' }]); m.notes.forEach(function (n) { rows.push([{ v: n, s: 'note' }]); }); }
  var w = rptWidths(rows, 10, 40); w[0] = Math.max(w[0] || 0, 34);
  var merges = top.merges.slice(); rows.forEach(function (r, k) { if (r && r[0] && (r[0].s === 'note' || r[0].s === 'sub')) merges.push('A' + (k + 1) + ':' + rptCol(Math.max(5, w.length - 1)) + (k + 1)); if (r && r[0] && r[0].s === 'note' && String(r[0].v).length > 110) r._h = 26; });
  sheets.push({ name: 'Summary', rows: rows, cols: w, merges: merges, grid: false, portrait: false });
  own.forEach(function (sec) {
    var t2 = rptTop(sec.title, Math.max(sec.cols.length, 3), [['Period', m.period], ['Generated', rptGen()]]), rr = t2.rows.slice();
    var hr = rr.length + 1, pos = table(sec, rr);
    if (sec.note) rr.push([{ v: sec.note, s: 'note' }]);
    var ww = rptWidths(rr.slice(hr - 1), 9, 44);
    sheets.push({ name: sec.sheet, rows: rr, cols: ww, merges: t2.merges, freeze: (sec.freezeCol || 'A') + (hr + 1), filter: 'A' + hr + ':' + rptCol(sec.cols.length - 1) + Math.max(pos.last, hr) });
  });
  return sheets;
}

/* ---------- period chips ---------- */
var RPT_PERIODS = [['this', 'This month'], ['last', 'Last month'], ['30', 'Last 30 days'], ['year', 'This year'], ['custom', 'Custom']];
function rptIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function rptParse(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function rptRange(p) {
  var n = NOW(), from, to;
  if (p.key === 'this') { from = new Date(n.getFullYear(), n.getMonth(), 1); to = new Date(n.getFullYear(), n.getMonth() + 1, 0); }
  else if (p.key === 'last') { from = new Date(n.getFullYear(), n.getMonth() - 1, 1); to = new Date(n.getFullYear(), n.getMonth(), 0); }
  else if (p.key === '30') { to = new Date(n.getFullYear(), n.getMonth(), n.getDate()); from = new Date(to.getTime() - 29 * DAY); }
  else if (p.key === 'year') { from = new Date(n.getFullYear(), 0, 1); to = new Date(n.getFullYear(), 11, 31); }
  else { from = rptParse(p.from); to = rptParse(p.to); }
  if (!from || !to) return { err: 'Choose a start and an end date.' };
  if (to < from) return { err: 'The end date is before the start date.' };
  var days = Math.round((to - from) / DAY) + 1;
  if (days > 366) return { err: 'Choose a period of at most 366 days.' };
  var end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  var month = from.getDate() === 1 && end.getDate() === 1 && (end.getMonth() - from.getMonth() + 12) % 12 === 1 && days < 32;
  return { from: from, to: to, end: end, days: days, label: UI.fmt.date(from) + ' to ' + UI.fmt.date(to), tag: month ? rptIso(from).slice(0, 7) : p.key === 'year' && days > 360 ? String(from.getFullYear()) : rptIso(from) + '_to_' + rptIso(to) };
}
function rptPeriodHtml(p, r) {
  return '<div class="rpt-chips" role="group" aria-label="Period">' + RPT_PERIODS.map(function (o) { return '<button type="button" class="rpt-chip" data-per="' + o[0] + '" aria-pressed="' + (p.key === o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>' +
    (p.key === 'custom' ? '<div class="rpt-dates">' + UI.input({ key: 'from', label: 'From', type: 'date', value: p.from || '' }) + UI.input({ key: 'to', label: 'To', type: 'date', value: p.to || '' }) + '</div>' : '') +
    (r.err ? '<p class="rpt-err">' + i('alert-circle') + esc(r.err) + '</p>' : '<p class="rpt-per">' + esc(r.label) + ' · ' + plural(r.days, 'day') + '</p>');
}

/* ===================================================================
   The numbers behind each report
   =================================================================== */
var RPT_ST = ['Confirmed', 'Agreement Sent', 'Agreement Signed', 'Car Delivered', 'Car Returned', 'Completed'];
var RPT_TYPE = { 'Security deposit': 'Security deposit', 'Rental payment': 'Rental', 'Extension payment': 'Extension', 'Delivery charge': 'Delivery charge', 'Return charge': 'Return charge', 'Damage coverage': 'Damage coverage', 'Other payment': 'Other' };
function rptCarLabel(c) { return (c.serial ? c.serial + '. ' : '') + c.model + (c.color ? ' ' + c.color : ''); }
function rptCarOf(id) { return id ? carById(id) : null; }
/* bookings and income: every booking that has a 24-hour block starting inside the period */
function rptBI(r, o) {
  var d = D(), cars = d.cars.filter(function (c) { return !o.cars || !o.cars.length || o.cars.indexOf(c.id) >= 0; }), list = [];
  d.bookings.forEach(function (x) {
    if (o.st.indexOf(x.status) < 0 || cars.indexOf(x.car) < 0 || !(x.start < r.end && x.end > r.from)) return;
    var ks = []; for (var k = 0; k < x.days; k++) { var s = new Date(x.start.getTime() + k * DAY); if (s >= r.from && s < r.end) ks.push(k); }
    if (!ks.length) return;
    var per = (x.rent - x.disc) / x.days, n = ks.length, first = ks[0] === 0, last = ks.indexOf(x.days - 1) >= 0;
    var it = { x: x, n: n, ks: ks, per: per, rental: per * n, deliv: first ? x.deliv : 0, ret: last ? x.ret : 0, dmg: x.dmg / x.days * n, other: first ? (x.others || 0) : 0 };
    it.total = it.rental + it.deliv + it.ret + it.dmg + it.other; list.push(it);
  });
  list.sort(function (a, b) { return a.x.start - b.x.start; });
  var keys = ['rental', 'deliv', 'ret', 'dmg', 'other', 'total'], tot = { n: list.length, days: 0 };
  keys.forEach(function (k) { tot[k] = sum(list.map(function (it) { return it[k]; })); });
  tot.days = sum(list.map(function (it) { return it.n; }));
  tot.dep = sum(list.map(function (it) { return it.x.dep; }));
  var byCar = cars.map(function (c) { var l = list.filter(function (it) { return it.x.car === c; }), o2 = { car: c, n: l.length, days: Math.min(r.days, sum(l.map(function (it) { return it.n; }))) }; keys.forEach(function (k) { o2[k] = sum(l.map(function (it) { return it[k]; })); }); o2.util = o2.days / r.days; return o2; });
  tot.util = cars.length ? sum(byCar.map(function (c) { return c.days; })) / (cars.length * r.days) : 0;
  var group = function (f) { var g = {}; list.forEach(function (it) { var k = f(it) || 'Not set'; g[k] = g[k] || { k: k, n: 0, total: 0 }; g[k].n++; g[k].total += it.total; }); return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.total - a.total; }); };
  var daily = [];
  for (var j = 0; j < r.days; j++) {
    var d0 = new Date(r.from.getTime() + j * DAY), d1 = new Date(d0.getTime() + DAY);
    daily.push({ from: d0, to: d1, cars: cars.map(function (c) { return sum(list.filter(function (it) { return it.x.car === c; }).map(function (it) { var s = 0; it.ks.forEach(function (k) { var bs = new Date(it.x.start.getTime() + k * DAY); if (bs >= d0 && bs < d1) s += it.per + it.dmg / it.n + (k === 0 ? it.deliv + it.other : 0) + (k === it.x.days - 1 ? it.ret : 0); }); return s; })); }) });
  }
  return { list: list, tot: tot, cars: cars, byCar: byCar, byPay: group(function (it) { return it.x.pay; }), byMethod: group(function (it) { return it.x.method; }), daily: daily };
}
function rptMoneyIn(r) {
  var d = D(), all = d.payments.filter(function (p) { return p.at >= r.from && p.at < r.end; });
  var list = all.filter(function (p) { return !p.void; }).sort(function (a, b) { return a.at - b.at; });
  return { list: list, voided: all.filter(function (p) { return p.void; }), total: sum(list.map(function (p) { return p.amount; })) };
}
function rptExpRows(r, src) {
  var d = D();
  return allExpenses(d).filter(function (e) { return e.day >= r.from && e.day < r.end && (!src || src === 'all' || e.source === src); });
}
function rptExpName(e) { if (e.source === 'job') return e.kind || 'Service job'; if (e.source === 'paper') return e.kind || 'Paper'; var c = byId(D().expenseCats, e.cat); return c ? c.name : 'Other'; }
function rptExpGroup(e) { if (e.source === 'job') return 'Service and repair jobs'; if (e.source === 'paper') return 'Road tax, insurance and other papers'; return rptExpName(e); }
function rptSrcLabel(s) { return s === 'job' ? 'Service job' : s === 'paper' ? 'Paper' : 'Recorded'; }
function rptWho(e) { if (!e.by) return '-'; var u = userById(e.by); return u ? u.name : String(e.by); }

/* the shared Excel for expenses (this page and the Expenses page): Summary + Expenses */
function rptExpBook(rows, periodLabel, filterLine) {
  var total = sum(rows.map(function (e) { return e.amount; })), title = B().name + ' expenses';
  var top = rptTop(title, 8, ['What was spent, by category, month and car. All amounts in RM.', ['Period', periodLabel], ['Generated', rptGen()]].concat(filterLine ? [['Filters', filterLine]] : []));
  var R = top.rows.slice(), merges = top.merges.slice();
  var grp = function (f) { var g = {}; rows.forEach(function (e) { var k = f(e); g[k] = g[k] || { k: k, n: 0, v: 0 }; g[k].n++; g[k].v += e.amount; }); return Object.keys(g).map(function (k) { return g[k]; }); };
  var bySrc = function (s) { return sum(rows.filter(function (e) { return e.source === s; }).map(function (e) { return e.amount; })); };
  R.push([]); R.push([{ v: 'KEY FIGURES', s: 'sec' }, { v: '', s: 'sec' }]);
  [['Total spent', total, 'kvg'], ['Entries', rows.length, 'kvn'], ['Recorded by the team', bySrc('recorded'), 'kv'], ['Service jobs (from Maintenance)', bySrc('job'), 'kv'], ['Papers (road tax, insurance)', bySrc('paper'), 'kv'], ['With a receipt', rows.filter(function (e) { return e.receipt; }).length, 'kvn'], ['Not tied to a car', sum(rows.filter(function (e) { return !e.car; }).map(function (e) { return e.amount; })), 'kv']].forEach(function (k) { R.push([{ v: k[0], s: 'kl' }, { v: k[1], s: k[2] }]); });
  var tbl = function (name, head, list) {
    R.push([]); R.push([{ v: name, s: 'sec' }, { v: '', s: 'sec' }, { v: '', s: 'sec' }, { v: '', s: 'sec' }, { v: '', s: 'sec' }]);
    R.push(head.map(function (h, k) { return { v: h, s: k ? 'hr' : 'h' }; }));
    var f = R.length + 1;
    list.forEach(function (g, k) { R.push(rptRow([{ v: g.k, s: 't' }, { v: g.n, s: 'n' }, { v: g.v, s: 'm' }, { v: total ? g.v / total : 0, s: 'pct' }, { v: new Array(Math.max(1, Math.round((total ? g.v / total : 0) * 40)) + 1).join('|'), s: 'bar' }], { zebra: k % 2 === 1 })); });
    var l = R.length;
    R.push([{ v: 'Total', s: 'tot' }, { v: rows.length, f: 'SUM(B' + f + ':B' + l + ')', s: 'totn' }, { v: total, f: 'SUM(C' + f + ':C' + l + ')', s: 'totm' }, { v: 1, s: 'totp' }, { v: '', s: 'tot' }]);
  };
  tbl('BY CATEGORY', ['Category', 'Entries', 'Amount (RM)', 'Share', 'Share bar'], grp(rptExpName).sort(function (a, b) { return b.v - a.v; }));
  tbl('BY MONTH', ['Month', 'Entries', 'Amount (RM)', 'Share', 'Share bar'], grp(function (e) { return e.day.getFullYear() + '-' + String(e.day.getMonth() + 1).padStart(2, '0'); }).sort(function (a, b) { return a.k < b.k ? -1 : 1; }).map(function (g) { var p = g.k.split('-'); return { k: new Date(+p[0], +p[1] - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' }), n: g.n, v: g.v }; }));
  tbl('BY CAR', ['Car', 'Entries', 'Amount (RM)', 'Share', 'Share bar'], grp(function (e) { var c = rptCarOf(e.car); return c ? c.plate + ' ' + carModel(c) : 'Not tied to a car'; }).sort(function (a, b) { return b.v - a.v; }));
  R.push([]); R.push([{ v: 'HOW THE NUMBERS ARE WORKED OUT', s: 'sec' }, { v: '', s: 'sec' }]);
  ['Recorded: what the team typed on the Expenses page, on the day it was spent.', 'Service jobs: finished jobs from Maintenance with their total cost, on the day the job was done.', 'Papers: road tax, insurance and other papers from Maintenance with a cost, on the day they were issued.', 'A cost is counted once: categories that are also kept on a service record or a paper show a reminder when they are added.', 'Share = the amount divided by the total spent in the period.'].forEach(function (n) { R.push([{ v: n, s: 'note' }]); });
  R.forEach(function (r, k) { if (r && r[0] && (r[0].s === 'note' || r[0].s === 'sub')) merges.push('A' + (k + 1) + ':H' + (k + 1)); });
  var sheets = [{ name: 'Summary', rows: R, cols: [40, 10, 16, 10, 44, 10, 10, 18], merges: merges, grid: false }];
  var t2 = rptTop('Expenses', 13, [['Period', periodLabel], ['Generated', rptGen()]]), E = t2.rows.slice();
  var head = ['Date', 'Where it comes from', 'Category', 'What', 'Plate', 'Car', 'Booking ID', 'Amount (RM)', 'Paid with', 'Paid to', 'Note', 'Recorded by', 'Receipt'];
  E.push(head.map(function (h) { return { v: h, s: h === 'Amount (RM)' ? 'hr' : 'h' }; }));
  var hr = E.length, f0 = hr + 1;
  rows.slice().sort(function (a, b) { return a.day - b.day; }).forEach(function (e, k) {
    var c = rptCarOf(e.car);
    E.push(rptRow([{ v: e.day, s: 'd' }, rptSrcLabel(e.source), rptExpGroup(e), e.source === 'recorded' ? (e.note || e.paidTo || rptExpName(e)) : rptExpName(e), c ? c.plate : '', c ? carModel(c) : 'Not tied to a car', e.booking || '', { v: e.amount, s: 'm' }, e.method || '', e.paidTo || '', e.note || '', rptWho(e), e.receipt ? 'Yes' : 'No'], { zebra: k % 2 === 1 }));
  });
  var l0 = E.length;
  E.push([{ v: 'Total', s: 'tot' }].concat([1, 2, 3, 4, 5, 6].map(function () { return { v: '', s: 'tot' }; })).concat([{ v: total, f: 'SUM(H' + f0 + ':H' + Math.max(l0, f0) + ')', s: 'totm' }]).concat([1, 2, 3, 4, 5].map(function () { return { v: '', s: 'tot' }; })));
  sheets.push({ name: 'Expenses', rows: E, cols: [13, 18, 22, 30, 11, 18, 12, 13, 14, 24, 36, 18, 9], merges: t2.merges, freeze: 'D' + (hr + 1), filter: 'A' + hr + ':M' + Math.max(l0, hr) });
  return sheets;
}

/* ===================================================================
   Report models: {title, desc, period, file, info, kpis[{l, raw, t, note, hero, split, ring, small}],
   sections[{title, cols[{l, t, a, w, bar, chip, strong}], rows, total, note, dim, preview, sheet}], notes, sheets()}
   =================================================================== */
var RPT_LIST = [
  { id: 'bookings', name: 'Bookings and income', icon: 'file-spreadsheet', per: 'this', desc: 'One row per booking, income per car and per day. Ready to print or to send to your accountant.' },
  { id: 'money', name: 'Money in', icon: 'cash', per: 'last', desc: 'Every payment received in the period, one row each, with the booking ID and the car plate. Use it next to the bank statement and the payment slips.' },
  { id: 'expenses', name: 'Expenses', icon: 'receipt-2', per: 'this', desc: 'What was spent, by category, month and car: what the team recorded, service jobs and car papers.' },
  { id: 'profit', name: 'Profit by car', icon: 'chart-bar', per: 'this', desc: 'Income from bookings against what each car cost: expenses, service jobs, papers and instalments.' },
  { id: 'maintenance', name: 'Maintenance', icon: 'tool', per: 'year', desc: 'Service jobs with their costs, totals by car and by type, and every car paper with its expiry date.' },
  { id: 'deposits', name: 'Deposit refunds', icon: 'cash-banknote', per: 'this', desc: 'Deposits of cars that came back: received, kept for damage, fuel or summons, returned and still waiting.' },
  { id: 'invoices', name: 'Invoices and receipts', icon: 'file-invoice', per: 'this', desc: 'Every invoice and receipt issued in the period, void ones marked. The register for the accountant.' },
  { id: 'instalments', name: 'Car instalments', icon: 'calendar-dollar', per: 'year', desc: 'The monthly loan or hire-purchase payment of each car: due, paid, unpaid and overdue.' },
  { id: 'activity', name: 'Activity log', icon: 'history', per: '30', perm: 'users.view_audit', desc: 'Who changed what and when, with the old and the new value, the area and the IP address.' }
];
function rptShare(rows, k) { var t = sum(rows.map(function (r) { return r[k]; })); return function (v) { return t ? v / t : 0; }; }
function rptModel(id, st, r) {
  var d = D(), m = { id: id, period: r.label, file: (byId(RPT_LIST, id) || {}).name.toLowerCase().replace(/ and /g, '-and-').replace(/[^a-z0-9]+/g, '-') + '-' + r.tag, kpis: [], sections: [], notes: [], info: [] };
  m.title = byId(RPT_LIST, id).name; m.desc = byId(RPT_LIST, id).desc;
  var car2 = function (c) { return c ? { t: rptCarLabel(c), s: c.plate } : 'Not tied to a car'; };
  if (id === 'bookings') {
    var R = rptBI(r, { cars: st.cars, st: st.status }), t = R.tot, other = t.other > 0;
    m.xlTitle = B().name + ' booking and income report'; m.res = R;
    m.info = [['Cars', st.cars && st.cars.length ? st.cars.map(function (c) { return carById(c).plate; }).join(', ') : 'All cars (' + d.cars.length + ')'], ['Booking statuses', st.status.join(', ')]];
    m.kpis = [{ l: 'Total income', raw: t.total, t: 'money', note: r.label, hero: true, split: [['Rental income', t.rental], ['Delivery fee', t.deliv], ['Return fee', t.ret], ['Damage coverage', t.dmg]].concat(other ? [['Other charges', t.other]] : []) },
      { l: 'Bookings', raw: t.n, t: 'int', note: t.n ? (t.days / t.n).toFixed(1) + ' days each on average' : 'None in this period' }, { l: 'Days booked', raw: t.days, t: 'int', note: 'Added up over all cars' },
      { l: 'Utilisation', raw: t.util, t: 'pct', note: plural(R.cars.length, 'car') + ' over ' + r.days + ' days', ring: true }, { l: 'Average income per booking', raw: t.n ? t.total / t.n : 0, t: 'money' },
      { l: 'Rental income', raw: t.rental, t: 'money', small: true }, { l: 'Delivery fee', raw: t.deliv, t: 'money', small: true }, { l: 'Return fee', raw: t.ret, t: 'money', small: true }, { l: 'Damage coverage', raw: t.dmg, t: 'money', small: true }, { l: 'Deposits held', raw: t.dep, t: 'money', note: 'Not income', small: true }];
    var mc = function (l) { return { l: l, t: 'money', a: 'r', w: 12 }; };
    m.sections.push({ title: 'By car', cols: [{ l: 'Car', w: 24 }, { l: 'Bookings', t: 'int', a: 'r', w: 8 }, { l: 'Days booked', t: 'int', a: 'r', w: 9 }, { l: 'Utilisation', t: 'pct', a: 'r', w: 12, bar: true }, mc('Rental income'), mc('Delivery fee'), mc('Return fee'), mc('Damage coverage')].concat(other ? [mc('Other charges')] : []).concat([{ l: 'Total income', t: 'money', a: 'r', w: 13, strong: true }]),
      rows: R.byCar.map(function (c) { return [car2(c.car), c.n, c.days, c.util, c.rental, c.deliv, c.ret, c.dmg].concat(other ? [c.other] : []).concat([c.total]); }),
      total: ['Total', t.n, t.days, t.util, t.rental, t.deliv, t.ret, t.dmg].concat(other ? [t.other] : []).concat([t.total]), dim: function (row) { return !row[1]; }, preview: 99,
      note: 'Days booked = days on which the car had a rental in the period. Utilisation = days booked divided by the ' + r.days + ' days of the period. Cars with no booking in the period are shown dimmed.' });
    m.sections.push({ title: 'By payment status', cols: [{ l: 'Payment status', w: 30 }, { l: 'Bookings', t: 'int', a: 'r', w: 10 }, { l: 'Total income', t: 'money', a: 'r', w: 14 }], rows: R.byPay.map(function (g) { return [g.k, g.n, g.total]; }), total: ['Total', t.n, t.total], preview: 99 });
    m.sections.push({ title: 'By payment method', cols: [{ l: 'Payment method', w: 30 }, { l: 'Bookings', t: 'int', a: 'r', w: 10 }, { l: 'Total income', t: 'money', a: 'r', w: 14 }], rows: R.byMethod.map(function (g) { return [g.k, g.n, g.total]; }), total: ['Total', t.n, t.total], preview: 99 });
    m.sections.push({ title: 'Bookings in the file', previewTitle: 'First bookings in the file', cols: [{ l: 'Customer', w: 20 }, { l: 'Car', w: 22 }, { l: 'Pickup', t: 'dt', a: 'c', w: 16 }, { l: 'Return', t: 'dt', a: 'c', w: 16 }, { l: 'Days', a: 'c', w: 7 }, { l: 'Income', t: 'money', a: 'r', w: 12 }, { l: 'Status', w: 13, chip: 'booking' }],
      rows: R.list.map(function (it) { return [{ t: it.x.cust.name, s: it.x.code }, car2(it.x.car), it.x.start, it.x.end, it.n + ' of ' + it.x.days, it.total, it.x.status]; }), preview: 10, empty: 'No bookings match these filters. Try a longer period or tick more statuses.',
      note: 'A rental that starts before or ends after the period is counted for the days inside it.' });
    m.notes = ['Rental income = the rent minus any discount, spread evenly over the 24-hour blocks of the booking (the first block starts at pick-up).', 'Total income = rental income + delivery fee + return fee + damage coverage' + (other ? ' + other charges' : '') + '. The delivery fee counts in the period of the first block, the return fee in the period of the last block.', 'The security deposit is never income: it is held and given back, so it is shown apart as Deposits held.', 'Days booked = 24-hour blocks that start inside the period. Utilisation = days booked divided by (cars x days in the period).', 'Pending and cancelled bookings are never counted as income, so they are not in this report.'];
    m.sheets = function () { return rptBIBook(m, R, r); };
  } else if (id === 'money') {
    var MI = rptMoneyIn(r), byT = {}, byM = {}, byI = {};
    MI.list.forEach(function (p) { var ty = RPT_TYPE[p.kind] || 'Other'; [[byT, ty], [byM, p.method], [byI, /^Cash/.test(p.depositedTo || '') ? 'Cash held by staff' : (p.depositedTo || 'Bank')]].forEach(function (g) { var o = g[0][g[1]] = g[0][g[1]] || { k: g[1], n: 0, v: 0 }; o.n++; o.v += p.amount; }); });
    var arr = function (o) { return Object.keys(o).map(function (k) { return o[k]; }).sort(function (a, b) { return b.v - a.v; }); }, deps = byT['Security deposit'] ? byT['Security deposit'].v : 0;
    m.xlTitle = B().name + ' money in'; m.res = MI;
    m.kpis = [{ l: 'Money in', raw: MI.total, t: 'money', note: plural(MI.list.length, 'payment') }, { l: 'Income', raw: MI.total - deps, t: 'money', note: 'Rental and charges' }, { l: 'Deposits received', raw: deps, t: 'money', note: 'Held, not income' }, { l: 'Cash held by staff', raw: byI['Cash held by staff'] ? byI['Cash held by staff'].v : 0, t: 'money', note: 'Not banked yet or banked later' }, { l: 'Void payments', raw: MI.voided.length, t: 'int', note: 'Left out of the file' }];
    var g3 = function (title, o) { return { title: title, cols: [{ l: title.replace('By ', '').replace(/^./, function (c) { return c.toUpperCase(); }), w: 26 }, { l: 'Payments', t: 'int', a: 'r', w: 10 }, { l: 'Amount', t: 'money', a: 'r', w: 14 }, { l: 'Share', t: 'pct', a: 'r', w: 14, bar: true }], rows: arr(o).map(function (g) { return [g.k, g.n, g.v, MI.total ? g.v / MI.total : 0]; }), total: ['Total', MI.list.length, MI.total, 1], preview: 99 }; };
    m.sections.push(g3('By type', byT)); m.sections.push(g3('By method', byM)); m.sections.push(g3('Received into', byI));
    m.sections.push({ title: 'Payments', cols: [{ l: 'Date paid', t: 'dt', w: 15 }, { l: 'Booking', w: 13 }, { l: 'Customer', w: 18 }, { l: 'Type', w: 13 }, { l: 'Method', w: 11 }, { l: 'Amount', t: 'money', a: 'r', w: 12 }, { l: 'Received into', w: 15 }, { l: 'Receipt no.', w: 14 }],
      rows: MI.list.map(function (p) { var x = findBooking(p.booking); return [p.at, { t: p.booking, s: x ? x.car.plate : '' }, x ? x.cust.name : '', RPT_TYPE[p.kind] || 'Other', p.method, p.amount, p.depositedTo || '', p.receipt || '-']; }), total: ['Total', '', '', '', '', MI.total, '', ''], preview: 12, empty: 'No payments were received in this period.' });
    m.notes = ['Void payments are left out. Deposits are money held for the customer and given back later; deposit refunds are not listed here.', 'Payments on Pending or Cancelled bookings are listed too, because the money came in.'];
    m.sheets = function () { return rptMoneyBook(m, MI, r); };
  } else if (id === 'expenses') {
    var E = rptExpRows(r, st.src), et = sum(E.map(function (e) { return e.amount; })), bs = function (s) { return sum(E.filter(function (e) { return e.source === s; }).map(function (e) { return e.amount; })); };
    var gg = function (f) { var g = {}; E.forEach(function (e) { var k = f(e); g[k] = g[k] || { k: k, n: 0, v: 0 }; g[k].n++; g[k].v += e.amount; }); return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.v - a.v; }); };
    m.info = [['Where it comes from', { all: 'Everything', recorded: 'Recorded by the team', job: 'Service jobs', paper: 'Papers' }[st.src || 'all']]];
    m.kpis = [{ l: 'Total spent', raw: et, t: 'money', note: E.length + (E.length === 1 ? ' entry' : ' entries') }, { l: 'Recorded', raw: bs('recorded'), t: 'money', note: 'By the team' }, { l: 'Service jobs', raw: bs('job'), t: 'money', note: 'From Maintenance' }, { l: 'Papers', raw: bs('paper'), t: 'money', note: 'Road tax, insurance' }, { l: 'With a receipt', raw: E.filter(function (e) { return e.receipt; }).length, t: 'int', note: 'Of ' + E.length }];
    m.sections.push({ title: 'Where the money went', cols: [{ l: 'Kind', w: 30 }, { l: 'Entries', t: 'int', a: 'r', w: 9 }, { l: 'Amount', t: 'money', a: 'r', w: 14 }, { l: 'Share', t: 'pct', a: 'r', w: 16, bar: true }], rows: gg(rptExpGroup).map(function (g) { return [g.k, g.n, g.v, et ? g.v / et : 0]; }), total: ['Total', E.length, et, 1], preview: 8 });
    m.sections.push({ title: 'By car', cols: [{ l: 'Car', w: 30 }, { l: 'Entries', t: 'int', a: 'r', w: 9 }, { l: 'Amount', t: 'money', a: 'r', w: 14 }, { l: 'Share', t: 'pct', a: 'r', w: 16, bar: true }], rows: gg(function (e) { return e.car || ''; }).map(function (g) { return [car2(rptCarOf(g.k)), g.n, g.v, et ? g.v / et : 0]; }), total: ['Total', E.length, et, 1], preview: 8 });
    m.sections.push({ title: 'Expenses', cols: [{ l: 'Day', t: 'date', w: 11 }, { l: 'What', w: 24 }, { l: 'From', w: 10 }, { l: 'Car', w: 18 }, { l: 'Booking', w: 11 }, { l: 'Recorded by', w: 14 }, { l: 'Amount', t: 'money', a: 'r', w: 11 }],
      rows: E.map(function (e) { return [e.day, { t: rptExpName(e), s: e.paidTo || '' }, rptSrcLabel(e.source), car2(rptCarOf(e.car)), e.booking || '-', rptWho(e), e.amount]; }), total: ['Total', '', '', '', '', '', et], preview: 12, empty: 'Nothing was spent in this period.' });
    m.sheets = function () { return rptExpBook(E, r.label, m.info[0][0] + ': ' + m.info[0][1]); };
  } else if (id === 'profit') {
    var BI = rptBI(r, { st: RPT_ST }), EX = rptExpRows(r), loanCat = (d.expenseCats.filter(function (c) { return /instalment/.test(c.name); })[0] || {}).id;
    var rowsP = d.cars.map(function (c) {
      var inc = (BI.byCar.filter(function (b) { return b.car === c; })[0] || {}).total || 0, ex = EX.filter(function (e) { return e.car === c.id; });
      var part = function (f) { return sum(ex.filter(f).map(function (e) { return e.amount; })); };
      var run = part(function (e) { return e.source === 'recorded' && e.cat !== loanCat; }), job = part(function (e) { return e.source === 'job'; }), pap = part(function (e) { return e.source === 'paper'; }), inst = part(function (e) { return e.cat === loanCat; }), cost = run + job + pap + inst;
      return [car2(c), inc, run, job, pap, inst, cost, inc - cost, inc ? (inc - cost) / inc : 0];
    });
    var col = function (k) { return sum(rowsP.map(function (x) { return x[k]; })); }, company = sum(EX.filter(function (e) { return !e.car; }).map(function (e) { return e.amount; }));
    m.kpis = [{ l: 'Income from bookings', raw: col(1), t: 'money', note: 'Rental and charges' }, { l: 'What the cars cost', raw: col(6), t: 'money', note: 'Expenses, jobs, papers, instalments' }, { l: 'Profit from the cars', raw: col(7), t: 'money', note: col(1) ? Math.round(col(7) / col(1) * 100) + '% of income' : '' }, { l: 'Company costs', raw: company, t: 'money', note: 'Not tied to a car' }, { l: 'Profit after all costs', raw: col(7) - company, t: 'money' }];
    m.sections.push({ title: 'By car', cols: [{ l: 'Car', w: 22 }, { l: 'Income', t: 'money', a: 'r', w: 12 }, { l: 'Running costs', t: 'money', a: 'r', w: 12 }, { l: 'Service jobs', t: 'money', a: 'r', w: 12 }, { l: 'Papers', t: 'money', a: 'r', w: 11 }, { l: 'Instalments', t: 'money', a: 'r', w: 11 }, { l: 'Total costs', t: 'money', a: 'r', w: 12 }, { l: 'Profit', t: 'money', a: 'r', w: 12, strong: true }, { l: 'Margin', t: 'pct', a: 'r', w: 12, bar: true }],
      rows: rowsP.sort(function (a, b) { return b[7] - a[7]; }), total: ['Total', col(1), col(2), col(3), col(4), col(5), col(6), col(7), col(1) ? col(7) / col(1) : 0], preview: 99, dim: function (x) { return !x[1] && !x[6]; } });
    m.sections.push({ title: 'Company costs not tied to a car', cols: [{ l: 'Kind', w: 30 }, { l: 'Entries', t: 'int', a: 'r', w: 9 }, { l: 'Amount', t: 'money', a: 'r', w: 14 }], rows: (function () { var g = {}; EX.filter(function (e) { return !e.car; }).forEach(function (e) { var k = rptExpName(e); g[k] = g[k] || [k, 0, 0]; g[k][1]++; g[k][2] += e.amount; }); return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b[2] - a[2]; }); })(), total: ['Total', EX.filter(function (e) { return !e.car; }).length, company], preview: 10 });
    m.notes = ['Income is worked out like the Bookings and income report: confirmed to completed bookings, spread over their 24-hour blocks.', 'Running costs = expenses recorded on the car (fuel, toll, car wash...). Instalments = car loan or hire-purchase payments recorded as expenses.', 'Service jobs and papers come from Maintenance. Costs not tied to a car (rent, salaries...) are shown apart as company costs.'];
  } else if (id === 'maintenance') {
    var J = d.jobs.filter(function (j) { var dt = j.doneAt || j.date; return j.status !== 'Cancelled' && dt >= r.from && dt < r.end; }), done = J.filter(function (j) { return j.status === 'Done'; }), jt = sum(done.map(function (j) { return j.total; }));
    var paps = d.papers.filter(function (p) { return p.until; }), left = function (p) { return Math.round((p.until - NOW()) / DAY); }, pst = function (p) { var l = left(p); return l < 0 ? 'Expired' : l <= (p.warnDays || 30) ? 'Expiring soon' : 'Valid'; };
    var vend = function (id2) { return (byId(d.vendors, id2) || {}).name || ''; };
    m.kpis = [{ l: 'Service jobs done', raw: done.length, t: 'int', note: 'In the period' }, { l: 'Cost of the jobs', raw: jt, t: 'money', note: done.length ? 'About ' + UI.fmt.money(jt / done.length) + ' each' : '' }, { l: 'In the workshop now', raw: d.jobs.filter(function (j) { return j.status === 'In the workshop'; }).length, t: 'int' }, { l: 'Planned', raw: d.jobs.filter(function (j) { return j.status === 'Planned'; }).length, t: 'int', note: 'Coming up' }, { l: 'Papers to renew', raw: paps.filter(function (p) { return pst(p) !== 'Valid'; }).length, t: 'int', note: 'Expired or within 30 days' }];
    m.sections.push({ title: 'Services', sheet: 'Services', freezeCol: 'C', cols: [{ l: 'Date', t: 'date', w: 11 }, { l: 'Car', w: 18 }, { l: 'Type', w: 16 }, { l: 'Workshop', w: 16 }, { l: 'Status', w: 12, chip: 'job' }, { l: 'Odometer (km)', t: 'int', a: 'r', w: 11 }, { l: 'Invoice no.', w: 11 }, { l: 'Paid', w: 7 }, { l: 'Cost', t: 'money', a: 'r', w: 11 }],
      rows: J.map(function (j) { return [j.doneAt || j.date, car2(carById(j.car)), j.title || j.type, vend(j.vendor), j.status, j.odo, j.invoiceNo || '-', j.paid ? 'Yes' : 'No', j.total]; }), total: ['Total', '', '', '', '', '', '', '', sum(J.map(function (j) { return j.total; }))], preview: 10, empty: 'No service jobs in this period.' });
    var byC = d.cars.map(function (c) { var l = done.filter(function (j) { return j.car === c.id; }); var last = l.map(function (j) { return j.doneAt; }).sort(function (a, b) { return b - a; })[0]; return [car2(c), l.length, sum(l.map(function (j) { return j.total; })), last || '-']; }).sort(function (a, b) { return b[2] - a[2]; });
    m.sections.push({ title: 'By car', cols: [{ l: 'Car', w: 26 }, { l: 'Jobs', t: 'int', a: 'r', w: 8 }, { l: 'Cost', t: 'money', a: 'r', w: 13 }, { l: 'Last service', t: 'date', a: 'r', w: 13 }], rows: byC, total: ['Total', done.length, jt, ''], dim: function (x) { return !x[1]; }, preview: 99 });
    var byTy = {}; done.forEach(function (j) { byTy[j.type] = byTy[j.type] || [j.type, 0, 0]; byTy[j.type][1]++; byTy[j.type][2] += j.total; });
    m.sections.push({ title: 'By type', cols: [{ l: 'Type', w: 26 }, { l: 'Jobs', t: 'int', a: 'r', w: 8 }, { l: 'Cost', t: 'money', a: 'r', w: 13 }, { l: 'Share', t: 'pct', a: 'r', w: 14, bar: true }], rows: Object.keys(byTy).map(function (k) { var x = byTy[k]; return [x[0], x[1], x[2], jt ? x[2] / jt : 0]; }).sort(function (a, b) { return b[2] - a[2]; }), total: ['Total', done.length, jt, 1], preview: 99 });
    m.sections.push({ title: 'Documents', sheet: 'Documents', cols: [{ l: 'Car', w: 18 }, { l: 'Paper', w: 14 }, { l: 'Provider', w: 16 }, { l: 'Issued', t: 'date', w: 11 }, { l: 'Valid until', t: 'date', w: 11 }, { l: 'Days left', t: 'int', a: 'r', w: 8 }, { l: 'Cost', t: 'money', a: 'r', w: 10 }, { l: 'Status', w: 12, chip: 'paper' }],
      rows: paps.slice().sort(function (a, b) { return a.until - b.until; }).map(function (p) { return [car2(carById(p.car)), p.kind, p.provider || '-', p.issued || '', p.until, left(p), p.cost || 0, pst(p)]; }), preview: 8, sum: false,
      note: 'Every car paper with an expiry date, soonest first. Days left are counted from today.' });
  } else if (id === 'activity') {
    var A = d.activity.filter(function (a) { return a.at >= r.from && a.at < r.end && (!st.who || a.who === st.who); });
    var cnt = function (f) { var g = {}; A.forEach(function (a) { var k = f(a) || '-'; g[k] = (g[k] || 0) + 1; }); return Object.keys(g).map(function (k) { return [k, g[k], A.length ? g[k] / A.length : 0]; }).sort(function (a, b) { return b[1] - a[1]; }); };
    m.info = [['Person', st.who || 'Everyone']];
    m.kpis = [{ l: 'Changes', raw: A.length, t: 'int', note: 'In the period' }, { l: 'People', raw: cnt(function (a) { return a.who; }).length, t: 'int', note: 'Who did something' }, { l: 'Records', raw: cnt(function (a) { return a.ref; }).length, t: 'int', note: 'Touched' }, { l: 'Downloads', raw: A.filter(function (a) { return /Export|Download|Viewed/.test(a.action); }).length, t: 'int', note: 'Exports and documents' }];
    m.sections.push({ title: 'By person', cols: [{ l: 'Person', w: 26 }, { l: 'Changes', t: 'int', a: 'r', w: 9 }, { l: 'Share', t: 'pct', a: 'r', w: 14, bar: true }], rows: cnt(function (a) { return a.who; }), total: ['Total', A.length, 1], preview: 99 });
    m.sections.push({ title: 'By area', cols: [{ l: 'Area', w: 26 }, { l: 'Changes', t: 'int', a: 'r', w: 9 }, { l: 'Share', t: 'pct', a: 'r', w: 14, bar: true }], rows: cnt(function (a) { return a.where; }), total: ['Total', A.length, 1], preview: 8 });
    m.sections.push({ title: 'Changes', sheet: 'Changes', cols: [{ l: 'When', t: 'dt', w: 14 }, { l: 'Person', w: 13 }, { l: 'Action', w: 10 }, { l: 'Area', w: 12 }, { l: 'Record', w: 12 }, { l: 'Details', w: 46 }, { l: 'IP', w: 11 }],
      rows: A.map(function (a) { return [a.at, a.who, a.action, a.where, a.ref || '-', a.text + ((a.changes || []).length ? '. ' + a.changes.map(function (c) { return c.f + ': ' + (c.from == null || c.from === '' ? '(empty)' : c.from) + ' -> ' + (c.to == null || c.to === '' ? '(empty)' : c.to); }).join('; ') : ''), a.ip || '-']; }), preview: 12, empty: 'Nothing was changed in this period.' });
  } else if (id === 'deposits') {
    var Z = d.bookings.filter(function (x) { return x.dep > 0 && x.status !== 'Cancelled' && x.status !== 'Pending' && x.end >= r.from && x.end < r.end && x.end <= NOW(); }).map(function (x) { return depFor(x.code); });
    var kinds = {}, recv = 0, kept = 0, ret = 0, wait = 0, waitN = 0;
    var rowsD = Z.map(function (z) { var x = findBooking(z.booking), g = depReceived(z.booking), k = depKept(z), s = depState(z); recv += g; kept += k; if (z.refund) ret += z.refund.amount; if (s === 'waiting') { wait += depDue(z); waitN++; } z.deductions.forEach(function (dd) { kinds[dd.kind] = kinds[dd.kind] || [dd.kind, 0, 0]; kinds[dd.kind][1]++; kinds[dd.kind][2] += Number(dd.amount) || 0; }); return [{ t: z.booking, s: x.cust.name }, car2(x.car), x.end, g, k, z.deductions.map(function (dd) { return dd.kind; }).join(', ') || '-', z.refund ? z.refund.amount : s === 'waiting' ? depDue(z) : '', z.refund ? depHow(z.refund) : s === 'hand' ? 'Marked by hand' : '-', z.refund ? z.refund.at : '', s === 'returned' ? 'Returned' : s === 'hand' ? 'Marked by hand' : 'Waiting']; });
    m.kpis = [{ l: 'Deposits received', raw: recv, t: 'money', note: plural(Z.length, 'booking') }, { l: 'Kept', raw: kept, t: 'money', note: 'Damage, fuel, summons...' }, { l: 'Returned', raw: ret, t: 'money', note: 'Refunds recorded' }, { l: 'Waiting to be returned', raw: wait, t: 'money', note: plural(waitN, 'deposit') }];
    m.sections.push({ title: 'Kept from deposits', cols: [{ l: 'Reason', w: 26 }, { l: 'Times', t: 'int', a: 'r', w: 9 }, { l: 'Amount', t: 'money', a: 'r', w: 13 }], rows: Object.keys(kinds).map(function (k) { return kinds[k]; }).sort(function (a, b) { return b[2] - a[2]; }), total: ['Total', '', kept], preview: 99, empty: 'Nothing was kept from deposits in this period.' });
    m.sections.push({ title: 'Deposits', sheet: 'Deposits', cols: [{ l: 'Booking', w: 15 }, { l: 'Car', w: 17 }, { l: 'Car back', t: 'date', w: 10 }, { l: 'Received', t: 'money', a: 'r', w: 10 }, { l: 'Kept', t: 'money', a: 'r', w: 9 }, { l: 'Kept for', w: 12 }, { l: 'Returned / to return', t: 'money', a: 'r', w: 12 }, { l: 'How', w: 18 }, { l: 'Refunded on', t: 'date', w: 11 }, { l: 'Status', w: 11 }],
      rows: rowsD, total: ['Total', '', '', recv, kept, '', ret + wait, '', '', ''], preview: 12, empty: 'No cars with a deposit came back in this period.' });
  } else if (id === 'invoices') {
    var IV = d.invoices.filter(function (v) { return v.issued >= r.from && v.issued < r.end; }), RC = d.receipts.filter(function (v) { return v.issued >= r.from && v.issued < r.end; });
    var live = IV.filter(function (v) { return v.status !== 'Void'; }), rlive = RC.filter(function (v) { return v.status !== 'Void'; });
    m.kpis = [{ l: 'Invoices issued', raw: IV.length, t: 'int', note: (IV.length - live.length) + ' void' }, { l: 'Invoiced', raw: sum(live.map(invTotal)), t: 'money', note: 'Not counting void ones' }, { l: 'Receipts issued', raw: RC.length, t: 'int', note: (RC.length - rlive.length) + ' void' }, { l: 'Received with a receipt', raw: sum(rlive.map(function (v) { return v.amount; })), t: 'money' }, { l: 'Sent to customers', raw: IV.concat(RC).filter(function (v) { return (v.sent || []).length; }).length, t: 'int', note: 'Invoices and receipts' }];
    m.sections.push({ title: 'Invoices', sheet: 'Invoices', freezeCol: 'B', cols: [{ l: 'Invoice no.', w: 14 }, { l: 'Date', t: 'date', w: 11 }, { l: 'Booking', w: 15 }, { l: 'Car', w: 10 }, { l: 'Charges', t: 'money', a: 'r', w: 11 }, { l: 'Tax', t: 'money', a: 'r', w: 9 }, { l: 'Total', t: 'money', a: 'r', w: 11 }, { l: 'Deposit', t: 'money', a: 'r', w: 10 }, { l: 'Status', w: 9, chip: 'doc' }, { l: 'Sent', w: 9 }],
      rows: IV.map(function (v) { var x = findBooking(v.booking); return [v.id, v.issued, { t: v.booking, s: x ? x.cust.name : '' }, x ? x.car.plate : '', v.status === 'Void' ? 0 : v.charges, v.status === 'Void' ? 0 : (v.tax || 0), v.status === 'Void' ? 0 : invTotal(v), v.deposit || 0, v.status, (v.sent || []).length ? 'Yes' : 'No']; }), total: ['Total', '', '', '', sum(live.map(function (v) { return v.charges; })), sum(live.map(function (v) { return v.tax || 0; })), sum(live.map(invTotal)), sum(IV.map(function (v) { return v.deposit || 0; })), '', ''], preview: 10, empty: 'No invoices were issued in this period.', note: 'Void invoices are listed with zero amounts so the numbering has no gaps.' });
    m.sections.push({ title: 'Receipts', sheet: 'Receipts', freezeCol: 'B', cols: [{ l: 'Receipt no.', w: 14 }, { l: 'Date', t: 'date', w: 11 }, { l: 'Booking', w: 15 }, { l: 'Type', w: 14 }, { l: 'Method', w: 12 }, { l: 'Amount', t: 'money', a: 'r', w: 11 }, { l: 'Status', w: 9, chip: 'doc' }, { l: 'Sent', w: 9 }],
      rows: RC.map(function (v) { var x = findBooking(v.booking); return [v.id, v.issued, { t: v.booking, s: x ? x.cust.name : '' }, RPT_TYPE[v.kind] || v.kind || '', v.method || '', v.status === 'Void' ? 0 : v.amount, v.status, (v.sent || []).length ? 'Yes' : 'No']; }), total: ['Total', '', '', '', '', sum(rlive.map(function (v) { return v.amount; })), '', ''], preview: 10, empty: 'No receipts were issued in this period.' });
  } else if (id === 'instalments') {
    var I = d.instalments.filter(function (it) { return it.due >= r.from && it.due < r.end; }), now = NOW();
    var ist = function (it) { return it.paid ? 'Paid' : it.due < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? 'Overdue' : 'Unpaid'; };
    var paidV = sum(I.filter(function (it) { return it.paid; }).map(function (it) { return it.paid.amount; })), un = I.filter(function (it) { return !it.paid; }), od = I.filter(function (it) { return ist(it) === 'Overdue'; });
    m.kpis = [{ l: 'Due in the period', raw: sum(I.map(function (it) { return it.amount; })), t: 'money', note: plural(I.length, 'instalment') }, { l: 'Paid', raw: paidV, t: 'money', note: plural(I.length - un.length, 'instalment') }, { l: 'Unpaid', raw: sum(un.map(function (it) { return it.amount; })), t: 'money', note: plural(un.length, 'instalment') }, { l: 'Overdue', raw: sum(od.map(function (it) { return it.amount; })), t: 'money', note: plural(od.length, 'past the due date') }];
    var cs = d.cars.filter(function (c) { return c.instalment; });
    m.sections.push({ title: 'By car', cols: [{ l: 'Car', w: 24 }, { l: 'Monthly', t: 'money', a: 'r', w: 11 }, { l: 'Instalments', t: 'int', a: 'r', w: 9 }, { l: 'Paid', t: 'money', a: 'r', w: 12 }, { l: 'Unpaid', t: 'money', a: 'r', w: 12 }, { l: 'Overdue', t: 'int', a: 'r', w: 9 }],
      rows: cs.map(function (c) { var l = I.filter(function (it) { return it.car === c.id; }); return [car2(c), c.instalment.amount, l.length, sum(l.filter(function (it) { return it.paid; }).map(function (it) { return it.paid.amount; })), sum(l.filter(function (it) { return !it.paid; }).map(function (it) { return it.amount; })), l.filter(function (it) { return ist(it) === 'Overdue'; }).length]; }), total: ['Total', sum(cs.map(function (c) { return c.instalment.amount; })), I.length, paidV, sum(un.map(function (it) { return it.amount; })), od.length], preview: 99, empty: 'No car has an instalment day and amount.' });
    m.sections.push({ title: 'Instalments', sheet: 'Instalments', freezeCol: 'C', cols: [{ l: 'Car', w: 18 }, { l: 'Month', w: 10 }, { l: 'Due', t: 'date', w: 11 }, { l: 'Amount due', t: 'money', a: 'r', w: 11 }, { l: 'Paid on', t: 'date', w: 11 }, { l: 'Amount paid', t: 'money', a: 'r', w: 11 }, { l: 'Paid with', w: 12 }, { l: 'Status', w: 10 }],
      rows: I.slice().sort(function (a, b) { return a.due - b.due; }).map(function (it) { return [car2(carById(it.car)), it.month, it.due, it.amount, it.paid ? it.paid.on : '', it.paid ? it.paid.amount : '', it.paid ? it.paid.method : '', ist(it)]; }), total: ['Total', '', '', sum(I.map(function (it) { return it.amount; })), '', paidV, '', ''], preview: 12, empty: 'No instalments fall in this period.' });
  }
  if (!m.sheets) m.sheets = function () { return rptAutoBook(m); };
  return m;
}

/* Bookings and income workbook: Summary, Daily by car, Bookings (25 columns), formulas for every total */
function rptBIBook(m, R, r) {
  var t = R.tot, other = t.other > 0, top = rptTop(m.xlTitle, 12, ['One row per booking, income per car and per day. All amounts in RM.', ['Period', r.label + ' (' + r.days + ' days)'], ['Generated', rptGen()], ['Cars', m.info[0][1]], ['Booking statuses', m.info[1][1]]]);
  var S = top.rows.slice(), merges = top.merges.slice();
  S.push([]); S.push([{ v: 'KEY FIGURES', s: 'sec' }, { v: '', s: 'sec' }]);
  [['Total income', t.total, 'kvg'], ['Rental income', t.rental, 'kv'], ['Delivery fee', t.deliv, 'kv'], ['Return fee', t.ret, 'kv'], ['Damage coverage', t.dmg, 'kv']].concat(other ? [['Other charges', t.other, 'kv']] : []).concat([['Deposits held (not income)', t.dep, 'kv'], ['Bookings', t.n, 'kvn'], ['Rental days', t.days, 'kvn'], ['Average income per booking', t.n ? t.total / t.n : 0, 'kv'], ['Average rental length (days)', t.n ? t.days / t.n : 0, 'kvd'], ['Utilisation', t.util, 'kvp']]).forEach(function (k) { S.push([{ v: k[0], s: 'kl' }, { v: k[1], s: k[2] }]); });
  /* by car */
  S.push([]); S.push([{ v: 'BY CAR', s: 'sec' }].concat(Array.apply(null, Array(11)).map(function () { return { v: '', s: 'sec' }; })));
  var head = ['Car', 'Plate', 'Bookings', 'Days booked', 'Utilisation', 'Rental income', 'Delivery fee', 'Return fee', 'Damage coverage', 'Other charges', 'Total income', 'Income bar'];
  S.push(head.map(function (h, k) { return { v: h, s: k > 1 && k < 11 ? 'hr' : 'h' }; }));
  var f = S.length + 1, maxT = Math.max.apply(null, R.byCar.map(function (c) { return c.total; }).concat([1]));
  R.byCar.forEach(function (c, k) {
    var row = S.length + 1, dim = !c.n, mm = dim ? 'dimm' : 'm';
    S.push(rptRow([{ v: rptCarLabel(c.car), s: dim ? 'dim' : 't' }, { v: c.car.plate, s: dim ? 'dim' : 't' }, { v: c.n, s: dim ? 'dimn' : 'n' }, { v: c.days, s: dim ? 'dimn' : 'n' }, { v: c.util, f: 'D' + row + '/' + r.days, s: dim ? 'dimp' : 'pct' }, { v: c.rental, s: mm }, { v: c.deliv, s: mm }, { v: c.ret, s: mm }, { v: c.dmg, s: mm }, { v: c.other, s: mm }, { v: c.total, f: 'SUM(F' + row + ':J' + row + ')', s: dim ? 'dimm' : 'm' }, { v: new Array(Math.max(1, Math.round(c.total / maxT * 36)) + 1).join('|'), s: 'bar' }], { zebra: k % 2 === 1 }));
  });
  var l = S.length;
  S.push([{ v: 'Total', s: 'tot' }, { v: '', s: 'tot' }, { v: t.n, f: 'SUM(C' + f + ':C' + l + ')', s: 'totn' }, { v: t.days, f: 'SUM(D' + f + ':D' + l + ')', s: 'totn' }, { v: t.util, f: 'IFERROR(SUM(D' + f + ':D' + l + ')/(' + R.cars.length + '*' + r.days + '),0)', s: 'totp' }].concat(['F', 'G', 'H', 'I', 'J', 'K'].map(function (c2, j) { return { v: [t.rental, t.deliv, t.ret, t.dmg, t.other, t.total][j], f: 'SUM(' + c2 + f + ':' + c2 + l + ')', s: c2 === 'K' ? 'totg' : 'totm' }; })).concat([{ v: '', s: 'tot' }]));
  S.push([{ v: 'Days booked = 24-hour blocks that start in the period. Utilisation = days booked / ' + r.days + ' days. Cars without a booking are shown in grey.', s: 'note' }]);
  var grp = function (title, list) {
    S.push([]); S.push([{ v: title, s: 'sec' }, { v: '', s: 'sec' }, { v: '', s: 'sec' }, { v: '', s: 'sec' }]);
    S.push([{ v: title === 'BY PAYMENT METHOD' ? 'Payment method' : 'Payment status', s: 'h' }, { v: '', s: 'h' }, { v: 'Bookings', s: 'hr' }, { v: 'Total income', s: 'hr' }]);
    var a = S.length + 1; list.forEach(function (g, k) { S.push(rptRow([g.k, '', { v: g.n, s: 'n' }, { v: g.total, s: 'm' }], { zebra: k % 2 === 1 })); }); var b = S.length;
    S.push([{ v: 'Total', s: 'tot' }, { v: '', s: 'tot' }, { v: t.n, f: 'SUM(C' + a + ':C' + b + ')', s: 'totn' }, { v: t.total, f: 'SUM(D' + a + ':D' + b + ')', s: 'totm' }]);
  };
  grp('BY PAYMENT METHOD', R.byMethod); grp('BY PAYMENT STATUS', R.byPay);
  S.push([]); S.push([{ v: 'HOW THE NUMBERS ARE WORKED OUT', s: 'sec' }, { v: '', s: 'sec' }]);
  m.notes.forEach(function (n) { S.push([{ v: n, s: 'note' }]); });
  S.forEach(function (row, k) { if (row && row[0] && (row[0].s === 'note' || row[0].s === 'sub')) { merges.push('A' + (k + 1) + ':L' + (k + 1)); if (String(row[0].v).length > 120) row._h = 26; } });
  var sheets = [{ name: 'Summary', rows: S, cols: [30, 11, 10, 11, 11, 14, 12, 12, 14, 13, 14, 38], merges: merges, grid: false }];
  /* daily by car */
  var t2 = rptTop('Daily income by car', R.cars.length + 3, [['Period', r.label], ['What it shows', 'Income of each 24-hour block (rent, damage coverage and the fees of the first and last block), by the day the block starts.']]), D2 = t2.rows.slice();
  D2.push([{ v: 'Day starts', s: 'h' }, { v: 'Day ends', s: 'h' }].concat(R.cars.map(function (c) { return { v: rptCarLabel(c) + ' ' + c.plate, s: 'hr' }; })).concat([{ v: 'Total', s: 'hr' }]));
  D2[D2.length - 1]._h = 42;
  var hr = D2.length, f2 = hr + 1, lc = rptCol(R.cars.length + 1), tc = rptCol(R.cars.length + 2);
  R.daily.forEach(function (dy, k) { var row = D2.length + 1; D2.push(rptRow([{ v: dy.from, s: 'd' }, { v: dy.to, s: 'd' }].concat(dy.cars.map(function (v) { return { v: v, s: v ? 'm' : 'dimm' }; })).concat([{ v: sum(dy.cars), f: 'SUM(C' + row + ':' + lc + row + ')', s: 'm' }]), { zebra: k % 2 === 1 })); });
  var l2 = D2.length;
  D2.push([{ v: 'Total', s: 'tot' }, { v: '', s: 'tot' }].concat(R.cars.map(function (c, j) { var cl = rptCol(j + 2); return { v: sum(R.daily.map(function (dy) { return dy.cars[j]; })), f: 'SUM(' + cl + f2 + ':' + cl + l2 + ')', s: 'totm' }; })).concat([{ v: sum(R.daily.map(function (dy) { return sum(dy.cars); })), f: 'SUM(' + tc + f2 + ':' + tc + l2 + ')', s: 'totg' }]));
  sheets.push({ name: 'Daily by car', rows: D2, cols: [13, 13].concat(R.cars.map(function () { return 15; })).concat([15]), merges: t2.merges, freeze: 'C' + (hr + 1) });
  /* bookings */
  var t3 = rptTop('Bookings', 25, [['Period', r.label], ['Generated', rptGen()]]), K = t3.rows.slice();
  var bh = ['Booking ID', 'Status', 'Customer', 'IC / Passport', 'Phone', 'Car', 'Plate', 'Pickup', 'Return', 'Days', 'Daily rate', 'Rent', 'Discount', 'Rental income', 'Delivery fee', 'Return fee', 'Damage coverage', 'Total income', 'Deposit held', 'Total payable', 'Payment method', 'Payment status', 'Created', 'Days in period', 'Income in period'];
  K.push(bh.map(function (h, k) { return { v: h, s: k >= 9 && k <= 19 || k >= 23 ? 'hr' : 'h' }; }));
  var hb = K.length, fb = hb + 1;
  R.list.forEach(function (it, k) {
    var x = it.x, row = K.length + 1;
    K.push(rptRow([x.code, x.status, x.cust.name, UI.fmt.ic(x.cust.ic || ''), x.cust.phone, rptCarLabel(x.car), x.car.plate, { v: x.start, s: 'dt' }, { v: x.end, s: 'dt' }, { v: x.days, s: 'n' }, { v: x.rate || x.car.rate, s: 'm' }, { v: x.rent, s: 'm' }, { v: x.disc, s: 'm' }, { v: x.rent - x.disc, f: 'L' + row + '-M' + row, s: 'm' }, { v: x.deliv, s: 'm' }, { v: x.ret, s: 'm' }, { v: x.dmg, s: 'm' }, { v: x.rent - x.disc + x.deliv + x.ret + x.dmg + (x.others || 0), f: 'N' + row + '+O' + row + '+P' + row + '+Q' + row + (x.others ? '+' + x.others : ''), s: 'm' }, { v: x.dep, s: 'm' }, { v: x.payable, s: 'm' }, x.method || '', x.pay || '', { v: x.created, s: 'd' }, { v: it.n, s: 'n' }, { v: it.total, s: 'm' }], { zebra: k % 2 === 1 }));
  });
  var lb = K.length, sm = function (c2, v, s) { return { v: v, f: 'SUM(' + c2 + fb + ':' + c2 + Math.max(lb, fb) + ')', s: s || 'totm' }; };
  K.push([{ v: 'Total', s: 'tot' }].concat(Array.apply(null, Array(8)).map(function () { return { v: '', s: 'tot' }; })).concat([sm('J', sum(R.list.map(function (it) { return it.x.days; })), 'totn'), { v: '', s: 'tot' }, sm('L', sum(R.list.map(function (it) { return it.x.rent; }))), sm('M', sum(R.list.map(function (it) { return it.x.disc; }))), sm('N', sum(R.list.map(function (it) { return it.x.rent - it.x.disc; }))), sm('O', sum(R.list.map(function (it) { return it.x.deliv; }))), sm('P', sum(R.list.map(function (it) { return it.x.ret; }))), sm('Q', sum(R.list.map(function (it) { return it.x.dmg; }))), sm('R', sum(R.list.map(function (it) { return it.x.rent - it.x.disc + it.x.deliv + it.x.ret + it.x.dmg + (it.x.others || 0); }))), sm('S', t.dep), sm('T', sum(R.list.map(function (it) { return it.x.payable; }))), { v: '', s: 'tot' }, { v: '', s: 'tot' }, { v: '', s: 'tot' }, sm('X', t.days, 'totn'), sm('Y', t.total, 'totg')]));
  sheets.push({ name: 'Bookings', rows: K, cols: [12, 15, 20, 15, 15, 22, 10, 19, 19, 7, 11, 11, 10, 13, 11, 11, 13, 13, 12, 13, 15, 20, 12, 10, 14], merges: t3.merges, freeze: 'D' + (hb + 1), filter: 'A' + hb + ':Y' + Math.max(lb, hb) });
  return sheets;
}
/* Money in workbook: one row per payment with a daily total after each day, and a Notes sheet with the total by type */
function rptMoneyBook(m, MI, r) {
  var top = rptTop(m.xlTitle, 11, [['Period', r.label], ['Generated', rptGen()]]), S = top.rows.slice();
  S.push(['Date paid', 'Time', 'Booking ID', 'Car plate', 'Car', 'Customer', 'Type', 'Method', 'Amount (RM)', 'Received into', 'Receipt no.'].map(function (h) { return { v: h, s: h === 'Amount (RM)' ? 'hr' : 'h' }; }));
  var hr = S.length, f = hr + 1, day = null, a = f, zi = 0;
  var close = function () { if (day == null) return; var b = S.length; S.push([{ v: 'Daily total', s: 'day' }, { v: '', s: 'day' }, { v: UI.fmt.date(day), s: 'day' }].concat([0, 1, 2, 3, 4].map(function () { return { v: '', s: 'day' }; })).concat([{ v: sum(MI.list.filter(function (p) { return p.at.toDateString() === day.toDateString(); }).map(function (p) { return p.amount; })), f: 'SUM(I' + a + ':I' + b + ')', s: 'daym' }, { v: '', s: 'day' }, { v: '', s: 'day' }])); };
  MI.list.forEach(function (p) {
    if (!day || p.at.toDateString() !== day.toDateString()) { close(); day = p.at; a = S.length + 1; zi = 0; }
    var x = findBooking(p.booking);
    S.push(rptRow([{ v: new Date(p.at.getFullYear(), p.at.getMonth(), p.at.getDate()), s: 'd' }, { v: p.at, s: 'tm' }, p.booking, x ? x.car.plate : '', x ? carModel(x.car) : '', x ? x.cust.name : '', RPT_TYPE[p.kind] || 'Other', p.method, { v: p.amount, s: 'm' }, p.depositedTo || '', p.receipt || ''], { zebra: zi++ % 2 === 1 }));
  });
  close();
  var l = S.length;
  S.push([{ v: 'Total', s: 'tot' }].concat([0, 1, 2, 3, 4, 5, 6].map(function () { return { v: '', s: 'tot' }; })).concat([{ v: MI.total, f: 'SUMIF(A' + f + ':A' + Math.max(l, f) + ',"<>Daily total",I' + f + ':I' + Math.max(l, f) + ')', s: 'totg' }, { v: '', s: 'tot' }, { v: '', s: 'tot' }]));
  var sheets = [{ name: 'Money in', rows: S, cols: [12, 10, 13, 11, 18, 22, 17, 15, 13, 20, 16], merges: top.merges, freeze: 'A' + (hr + 1), filter: 'A' + hr + ':K' + Math.max(l, hr) }];
  var n = rptTop('How to read this file', 4, []), N = n.rows.slice();
  ['One row per payment received in the period, oldest first, with a daily total after each day and the grand total at the end.', 'Void payments are left out (' + MI.voided.length + ' in this period).', 'Security deposits are money held for the customer and given back after the rental; refunds are not listed here.', 'Payments on Pending or Cancelled bookings are listed, because the money came in.', 'Received into: Bank (online transfer), Stripe (card) or Cash to the staff member who took it.'].forEach(function (t) { N.push([{ v: t, s: 'note' }]); });
  N.push([]); N.push([{ v: 'TOTAL BY TYPE', s: 'sec' }, { v: '', s: 'sec' }, { v: '', s: 'sec' }]);
  N.push([{ v: 'Type', s: 'h' }, { v: 'Payments', s: 'hr' }, { v: 'Amount (RM)', s: 'hr' }]);
  var nf = N.length + 1, rng = "'Money in'!G" + f + ":G" + Math.max(l, f), amt = "'Money in'!I" + f + ":I" + Math.max(l, f);
  ['Security deposit', 'Rental', 'Extension', 'Delivery charge', 'Return charge', 'Damage coverage', 'Other'].forEach(function (ty, k) { var ps = MI.list.filter(function (p) { return (RPT_TYPE[p.kind] || 'Other') === ty; }); N.push(rptRow([ty, { v: ps.length, f: 'COUNTIF(' + rng + ',"' + ty + '")', s: 'n' }, { v: sum(ps.map(function (p) { return p.amount; })), f: 'SUMIF(' + rng + ',"' + ty + '",' + amt + ')', s: 'm' }], { zebra: k % 2 === 1 })); });
  var nl = N.length;
  N.push([{ v: 'Total', s: 'tot' }, { v: MI.list.length, f: 'SUM(B' + nf + ':B' + nl + ')', s: 'totn' }, { v: MI.total, f: 'SUM(C' + nf + ':C' + nl + ')', s: 'totg' }]);
  var mg = n.merges.slice(); N.forEach(function (row, k) { if (row && row[0] && row[0].s === 'note') mg.push('A' + (k + 1) + ':D' + (k + 1)); });
  sheets.push({ name: 'Notes', rows: N, cols: [30, 12, 16, 30], merges: mg, grid: false, portrait: true });
  return sheets;
}

/* ===================================================================
   The page
   =================================================================== */
function rptCell(v, c, canAmt) {
  if (c.t === 'money' && !canAmt) return '<span class="rpt-hid">Hidden</span>';
  var main = v && typeof v === 'object' && !(v instanceof Date) ? v.t : v, sub = v && typeof v === 'object' && !(v instanceof Date) ? v.s : '';
  if (c.chip && main) return c.chip === 'paper' ? UI.chip(main, { Expired: 'bad', 'Expiring soon': 'warn', Valid: 'ok' }[main] || 'grey') : UI.status(c.chip, main);
  var txt = esc(rptFmt(main, c.t));
  if (c.t === 'money') txt = UI.money(main);
  if (c.bar && typeof main === 'number') txt = '<span class="rpt-barc"><span>' + txt + '</span><i><b style="width:' + Math.max(0, Math.min(100, main * 100)) + '%"></b></i></span>';
  return (c.strong ? '<b>' + txt + '</b>' : txt) + (sub ? '<small>' + esc(sub) + '</small>' : '');
}
function rptKpi(k, canAmt) {
  var v = k.t === 'money' && !canAmt ? '<span class="rpt-hid">Hidden</span>' : k.t === 'money' ? UI.money(k.raw) : esc(rptFmt(k.raw, k.t) || '0');
  if (k.hero) {
    var tot = sum(k.split.map(function (s) { return s[1]; })) || 1, op = [1, .62, .4, .24, .14];
    return '<div class="rpt-hero"><span>' + esc(k.l.toUpperCase()) + '</span><b>' + v + '</b><small>' + esc(k.note || '') + '</small>' + (canAmt ? '<div class="rpt-split">' + k.split.map(function (s, j) { return '<i style="flex:' + Math.max(s[1], tot * .012) + ';opacity:' + op[j] + '"></i>'; }).join('') + '</div><div class="rpt-leg">' + k.split.map(function (s, j) { return '<span><i style="opacity:' + op[j] + '"></i>' + esc(s[0]) + ' ' + (s[1] > 0 && s[1] / tot < .005 ? '<1' : Math.round(s[1] / tot * 100)) + '%</span>'; }).join('') + '</div>' : '') + '</div>';
  }
  return '<div class="rpt-k' + (k.ring ? ' ring' : '') + '">' + (k.ring ? UI.chart.ring(k.raw * 100, { size: 58 }) : '') + '<div><span>' + esc(k.l.toUpperCase()) + '</span><b>' + v + '</b>' + (k.note ? '<small>' + esc(k.note) + '</small>' : '') + '</div></div>';
}
function rptPreview(m, canAmt) {
  var h = '', hero = m.kpis.filter(function (k) { return k.hero; })[0];
  if (hero) {
    var quad = m.kpis.filter(function (k) { return !k.hero && !k.small; }), small = m.kpis.filter(function (k) { return k.small; });
    h += '<div class="rpt-top">' + rptKpi(hero, canAmt) + '<div class="rpt-quad">' + quad.map(function (k) { return rptKpi(k, canAmt); }).join('') + '</div></div><div class="rpt-smalls">' + small.map(function (k) { return rptKpi(k, canAmt); }).join('') + '</div>';
  } else h += '<div class="rpt-kpis">' + m.kpis.map(function (k) { return rptKpi(k, canAmt); }).join('') + '</div>';
  m.sections.forEach(function (sec) {
    var cols = sec.cols.filter(function (c) { return canAmt || c.t !== 'money'; }), idx = cols.map(function (c) { return sec.cols.indexOf(c); }), max = sec.preview || 12, rows = sec.rows.slice(0, max);
    h += '<section class="rpt-sec"><h4 class="rpt-sh">' + esc((sec.previewTitle || sec.title).toUpperCase()) + (sec.sheet ? '<span>Sheet "' + esc(sec.sheet) + '" in the Excel file</span>' : '') + '</h4>';
    if (!sec.rows.length) { h += '<div class="rpt-none">' + i('mood-empty') + esc(sec.empty || 'Nothing in this period.') + '</div></section>'; return; }
    h += '<div class="rpt-tw"><table class="rpt-t" style="min-width:' + Math.max(420, Math.round(sum(cols.map(function (c) { return c.w || 10; })) * 8.2)) + 'px"><thead><tr>' + cols.map(function (c) { return '<th class="' + (c.a || '') + '">' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (rw) { return '<tr' + (sec.dim && sec.dim(rw) ? ' class="dim"' : '') + '>' + idx.map(function (j, q) { return '<td class="' + (cols[q].a || '') + '">' + rptCell(rw[j], cols[q], canAmt) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>' +
      (sec.total && (sec.rows.length <= max) ? '<tfoot><tr>' + idx.map(function (j, q) { var v = sec.total[j]; return '<td class="' + (cols[q].a || '') + '">' + (v === '' || v == null ? '' : q === 0 ? esc(v) : cols[q].t === 'money' ? UI.money(v) : esc(rptFmt(v, cols[q].t))) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table></div>';
    var more = sec.rows.length > max ? 'Showing the first ' + max + ' of ' + sec.rows.length + '. The Excel and PDF files list all of them. ' : '';
    if (more || sec.note) h += '<p class="rpt-note">' + esc(more + (sec.note || '')) + '</p>';
    h += '</section>';
  });
  return h;
}
function rptDefaults(id) { var L = byId(RPT_LIST, id); return { key: L.per, from: '', to: '', cars: [], status: RPT_ST.slice(), src: 'all', who: '' }; }

PAGES['reports'] = {
  title: 'Reports',
  search: RPT_LIST.map(function (L) { return { label: 'Report: ' + L.name, icon: L.icon, run: function () { go('reports', { report: L.id }); } }; }),
  render: function (root, ctx) {
    if (!ctx.can('reports.view')) { root.innerHTML = UI.empty({ icon: 'lock', title: 'You do not have access to Reports', text: 'Ask the owner to give your account the Reports permission.' }); return; }
    var st = ctx.state, canAmt = ctx.can('reports.see_amounts'), canDl = ctx.can('reports.export_excel'), canLog = ctx.can('users.view_audit');
    st.rs = st.rs || {};
    var id = ctx.params.report && byId(RPT_LIST, ctx.params.report) ? ctx.params.report : 'bookings';
    if (id === 'activity' && !canLog) id = 'bookings';
    var L = byId(RPT_LIST, id), o = st.rs[id] = st.rs[id] || rptDefaults(id);
    root.innerHTML = '<div class="rpt-head"><h1>Reports</h1><p>Download your figures as Excel or PDF files, in the ' + esc(B().short) + ' colours. Every report shows a preview first.</p></div>' +
      '<div class="rpt-cat" role="list">' + RPT_LIST.map(function (x) { var lock = x.perm && !ctx.can(x.perm); return '<button type="button" role="listitem" class="rpt-tile' + (x.id === id ? ' on' : '') + '" data-rep="' + x.id + '"' + (lock ? ' disabled title="Needs access to the activity log"' : '') + ' aria-pressed="' + (x.id === id) + '"><span class="rpt-ti">' + i(lock ? 'lock' : x.icon) + '</span><span class="grow"><b>' + esc(x.name) + '</b><small>' + esc(lock ? 'Needs access to the activity log.' : x.desc) + '</small><em>' + i('file-spreadsheet') + 'Excel' + i('file-type-pdf') + 'PDF</em></span></button>'; }).join('') + '</div>' +
      '<div class="card rpt-card"><div class="rpt-ch"><span class="rpt-ti big">' + i(L.icon) + '</span><div class="grow"><h2>' + esc(L.name) + '</h2><p>' + esc(L.desc) + '</p></div></div><div class="rpt-opts" id="rpt-opts"></div>' +
      '<div class="rpt-pvh"><h3>Preview</h3><div class="row wrap gap8" id="rpt-dl"></div></div>' + (!canDl ? '<div class="rpt-alert">' + UI.alert('You can look at this report but not download it. Ask the owner for "Download Excel reports".', 'info') + '</div>' : !canAmt ? '<div class="rpt-alert">' + UI.alert('Amounts are hidden in the preview for your account. The downloaded file contains every amount.', 'info') + '</div>' : '') + '<div class="rpt-pv" id="rpt-pv" aria-live="polite"></div></div>';
    var optsEl = root.querySelector('#rpt-opts'), pv = root.querySelector('#rpt-pv'), dlEl = root.querySelector('#rpt-dl'), model = null, timer = null;
    var range = function () { return rptRange(o); };
    var err = function () { var r = range(); if (r.err) return r.err; if (id === 'bookings' && !o.status.length) return 'Tick at least one status.'; return ''; };
    var carsInner = function () { var cs = o.cars.map(function (c) { return carById(c); }).filter(Boolean); return (cs.length ? cs.slice(0, 2).map(function (c) { return '<span class="rpt-tag">' + esc(c.plate) + '</span>'; }).join('') + (cs.length > 2 ? '<span class="rpt-tag more">+' + (cs.length - 2) + '</span>' : '') : '<span class="faint">All cars</span>') + i('chevron-down'); };
    var drawOpts = function () {
      var r = range(), h = '<div class="rpt-og"><h4>PERIOD</h4>' + rptPeriodHtml(o, r) + '</div>';
      if (id === 'bookings') {
        h += '<div class="rpt-og"><h4>CARS</h4><button type="button" class="rpt-cars" data-cars aria-haspopup="dialog">' + carsInner() + '</button></div>';
        h += '<div class="rpt-og"><h4>BOOKING STATUS</h4><div class="rpt-ticks">' + RPT_ST.map(function (s2, j) { return UI.check({ id: 'rst-' + j, key: 'st-' + j, label: s2, checked: o.status.indexOf(s2) >= 0, attrs: { 'data-st': s2 } }); }).join('') + '</div><p class="b2">Pending and cancelled bookings are never counted as income, so they are not in this report.</p></div>';
      }
      if (id === 'expenses') h += '<div class="rpt-og"><h4>WHERE IT COMES FROM</h4><div class="rpt-chips">' + [['all', 'All'], ['recorded', 'Recorded'], ['job', 'Service jobs'], ['paper', 'Papers']].map(function (c2) { return '<button type="button" class="rpt-chip" data-src="' + c2[0] + '" aria-pressed="' + (o.src === c2[0]) + '">' + c2[1] + '</button>'; }).join('') + '</div></div>';
      if (id === 'activity') { var who = []; D().activity.forEach(function (a) { if (who.indexOf(a.who) < 0) who.push(a.who); }); h += '<div class="rpt-og"><h4>PERSON</h4>' + UI.select({ id: 'rpt-who', key: 'who', options: who.sort(), value: o.who, placeholder: 'Everyone', aria: 'Person' }) + '</div>'; }
      optsEl.innerHTML = h;
      var e = err();
      dlEl.innerHTML = UI.btn('Download Excel', { icon: 'file-spreadsheet', disabled: !!e || !canDl, attrs: { 'data-xl': '1', title: !canDl ? 'You cannot download reports.' : '' } }) + UI.btn('Download PDF', { kind: 'o', icon: 'file-type-pdf', disabled: !!e || !canDl, attrs: { 'data-pdf': '1', title: !canDl ? 'You cannot download reports.' : '' } });
    };
    var drawPreview = function () {
      var e = err();
      if (e) { model = null; pv.classList.remove('dim'); pv.innerHTML = UI.empty({ icon: 'calendar-exclamation', title: e, text: id === 'bookings' && !o.status.length ? 'The report needs at least one booking status.' : 'Fix the period above to see the preview.' }); return; }
      model = rptModel(id, o, range());
      var empty = model.sections.every(function (s2) { return !s2.rows.length; }) && id !== 'bookings' && id !== 'profit' && id !== 'instalments';
      pv.innerHTML = (id === 'bookings' && !model.res.list.length ? UI.empty({ icon: 'calendar-off', title: 'No bookings match these filters', text: 'Try a longer period or tick more statuses.' }) : empty ? UI.empty({ icon: 'calendar-off', title: 'Nothing in this period', text: 'Choose a longer period. The file can still be downloaded with the headings.' }) + rptPreview(model, canAmt) : rptPreview(model, canAmt));
      pv.classList.remove('dim');
    };
    var schedule = function () { pv.classList.add('dim'); clearTimeout(timer); timer = setTimeout(drawPreview, 350); };
    var changed = function () { drawOpts(); schedule(); };
    drawOpts(); drawPreview();
    UI.on(root, 'click', '[data-rep]', function (ev, el) { ctx.setParams({ report: el.getAttribute('data-rep') === 'bookings' ? null : el.getAttribute('data-rep') }); ctx.refresh(); });
    UI.on(optsEl, 'click', '[data-per]', function (ev, el) { var k = el.getAttribute('data-per'); if (k === 'custom' && o.key !== 'custom') { var r0 = range(); if (!r0.err) { o.from = rptIso(r0.from); o.to = rptIso(r0.to); } } o.key = k; changed(); });
    UI.on(optsEl, 'click', '[data-src]', function (ev, el) { o.src = el.getAttribute('data-src'); changed(); });
    optsEl.addEventListener('change', function (ev) {
      var t = ev.target, k = t.getAttribute('data-key');
      if (k === 'from' || k === 'to') { o[k] = t.value; changed(); }
      else if (t.hasAttribute('data-st')) { var s2 = t.getAttribute('data-st'); o.status = RPT_ST.filter(function (x) { return x === s2 ? t.checked : o.status.indexOf(x) >= 0; }); changed(); }
      else if (k === 'who') { o.who = t.value; changed(); }
    });
    UI.on(optsEl, 'click', '[data-cars]', function (ev, el) {
      var q = '';
      UI.popover(el, function (pe, pop) {
        var list = D().cars.filter(function (c) { return !q || (rptCarLabel(c) + ' ' + c.plate).toLowerCase().indexOf(q.toLowerCase()) >= 0; });
        pe.innerHTML = '<div class="rpt-pop"><div class="inp srch">' + i('search') + '<input type="search" data-cq placeholder="Plate or model" aria-label="Find a car" value="' + esc(q) + '"></div><button type="button" class="rpt-all" data-call>' + i(o.cars.length ? 'square' : 'square-check') + 'All cars</button><div class="rpt-clist">' + list.map(function (c) { return UI.check({ id: 'rc-' + c.id, key: 'c', label: rptCarLabel(c) + ' · ' + c.plate, checked: o.cars.indexOf(c.id) >= 0, attrs: { 'data-car': c.id } }); }).join('') + (list.length ? '' : '<p class="b2">No car matches.</p>') + '</div></div>';
        pe.onchange = function (e2) { var c = e2.target.getAttribute('data-car'); if (!c) return; if (e2.target.checked) { if (o.cars.indexOf(c) < 0) o.cars.push(c); } else o.cars = o.cars.filter(function (x) { return x !== c; }); if (o.cars.length === D().cars.length) o.cars = []; el.innerHTML = carsInner(); schedule(); pop.refresh(); };
        pe.oninput = function (e2) { if (e2.target.hasAttribute('data-cq')) { q = e2.target.value; var at = e2.target.selectionStart; pop.refresh(); var f = pe.querySelector('[data-cq]'); f.focus(); try { f.setSelectionRange(at, at); } catch (x2) { /* ignore */ } } };
        pe.onclick = function (e2) { if (e2.target.closest('[data-call]')) { o.cars = []; el.innerHTML = carsInner(); schedule(); pop.refresh(); } };
      }, { width: 340, align: 'start' });
    });
    var log = function (kind) { DB.log('Exported', 'Report', '', me().name + ' downloaded the ' + L.name.toLowerCase() + ' report (' + kind + ', ' + model.period + ')'); };
    UI.on(dlEl, 'click', '[data-xl]', function () { if (!canDl) { UI.toast('You cannot download reports.', { tone: 'warn' }); return; } if (!model) drawPreview(); if (!model) return; rptXlsx(model.file + '.xlsx', model.sheets()); log('Excel'); });
    UI.on(dlEl, 'click', '[data-pdf]', function () { if (!canDl) { UI.toast('You cannot download reports.', { tone: 'warn' }); return; } if (!model) drawPreview(); if (!model) return; rptPdf(model, model.file + '.pdf'); log('PDF'); });
  },
  onData: function () { /* reports are read when drawn; a change elsewhere is picked up the next time the preview is drawn */ }
};
/* the same Bookings and income workbook for other pages (Bookings > Export to Excel):
   API.bookingsExcel({from: Date, to: Date, cars: ['car-1'], status: ['Completed']}) */
API.bookingsExcel = function (o) {
  o = o || {};
  var p = o.from && o.to ? { key: 'custom', from: rptIso(o.from), to: rptIso(o.to) } : { key: 'this' }, r = rptRange(p);
  if (r.err) { UI.toast(r.err, { tone: 'warn' }); return; }
  var m = rptModel('bookings', { cars: o.cars || [], status: o.status && o.status.length ? o.status.filter(function (s) { return RPT_ST.indexOf(s) >= 0; }) : RPT_ST.slice() }, r);
  return rptXlsx(m.file + '.xlsx', m.sheets());
};
API.openReport = function (id) { go('reports', { report: id }); };

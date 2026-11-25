/* ---------------- QUOTATIONS ----------------
   Staff pick a customer, a car, the dates and the charges, and the app makes a quotation in the company's format
   (quote-doc.js draws it; the same drawing is the preview and the PDF). A quotation can be shared as a PDF, sent on
   WhatsApp as text, copied, and turned into a booking (New booking opens filled from it).

   Data: S.quotes[] = {id, no ('KQ-2026-1125-001'), at, by, status ('Draft' | 'Sent' | 'Booked' | 'Cancelled'),
     cust (customer id or null), name, company, phone, car (car id or null), vehicle (text on the quotation), start, end,
     days (null = worked out from the hours), daily, deposit, cover {name, daily} | null, pick, pickNote, ret, retNote
     (place choices like a booking), delivery, retFee, extras [{text, qty, rate}], discount, notes, bookingId,
     sent {ch, at, by}, updatedAt, updatedBy, cancelledAt, cancelledBy}
   Settings: quotePrefix ('KQ'), legalName (the company behind the brand), quoteNotes (standing notes, one a line).
   Reads and writes through S and save() only. Routes: #quotes, #quote/<id>. */
var Quotes = (function () {
  var V = { f: 'open', q: '' };
  VIEW_STATE.push(function () { V.f = 'open'; V.q = ''; });
  var LOGO = {};

  function all() { if (!S.quotes) S.quotes = []; return S.quotes; }
  function get(id) { return byId(all(), id); }
  function canSee() { return can('bookings.view') && (can('bookings.create') || can('bookings.see_amounts')); }
  function canMake() { return can('bookings.create'); }
  function canSetUp() { return can('users.manage') || can('billing.settings'); }
  function prefix() { var b = B(); return b.quotePrefix || String(b.codePrefix || b.code || 'Q').charAt(0).toUpperCase() + 'Q'; }
  function dtv(x) { x = new Date(x); return toLocalInput(x) + 'T' + pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  function m(q) { return QuoteDoc.calc(docQ(q)); }
  function docQ(q) { return Object.assign({}, q, { ret: q.retFee }); }
  var TONE = { Draft: 'grey', Sent: 'blue', Booked: 'green', Cancelled: 'red' };

  /* ---------- the document ---------- */
  function logo() {
    var b = B(), key = CO + ':' + (b.logo ? String(b.logo).length : 'mark') + ':' + b.name;
    if (!LOGO[key]) LOGO[key] = b.logo ? QuoteDoc.imgSize(b.logo) : QuoteDoc.lockup(MARKS[CO], b.name, b.dark);
    return LOGO[key];
  }
  function input(q) {
    return logo().then(function (lg) {
      var b = B(), bank = b.bank || {};
      return { co: { trading: b.name, legal: b.legalName || '', regNo: b.regNo, address: b.address, phone: b.phone, email: b.email, site: String(b.site || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
          bank: { name: bank.name, accName: bank.accName, accNo: bank.accNo }, logo: lg && lg.src, logoW: lg && lg.w, logoH: lg && lg.h },
        colours: { navy: b.dark, accent: b.accent || b.primary }, no: q.no, date: q.at, q: docQ(q), notes: String(b.quoteNotes || '').split(/\n+/) };
    });
  }
  var JSPDF = null;
  function jsPdf() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    if (!JSPDF) JSPDF = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'js/vendor/jspdf-2.5.1.umd.min.js';
      s.onload = function () { window.jspdf ? res(window.jspdf.jsPDF) : rej(); }; s.onerror = function () { JSPDF = null; rej(); };
      document.head.appendChild(s);
    });
    return JSPDF;
  }
  function fileName(q) { return (q.no + ' ' + (q.name || '')).trim().replace(/[^\w\-]+/g, '_') + '.pdf'; }
  function pdfFile(q) {
    return Promise.all([jsPdf(), input(q)]).then(function (r) {
      var bytes = QuoteDoc.pdf(r[1], r[0]), blob = new Blob([bytes], { type: 'application/pdf' }), file = null;
      try { file = new File([blob], fileName(q), { type: 'application/pdf' }); } catch (e) {}
      return { blob: blob, file: file };
    });
  }
  function download(q) {
    say('Making ' + fileName(q) + '...');
    return pdfFile(q).then(function (p) {
      var url = URL.createObjectURL(p.blob), a = document.createElement('a'); a.href = url; a.download = fileName(q); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      audit('Downloaded quotation ' + q.no, { cust: q.cust, car: q.car }); save();
    }, function () { say('The PDF could not be made. Check the connection and try again.'); });
  }
  function markSent(q, ch) { q.sent = { ch: ch, at: new Date().toISOString(), by: S.me }; if (q.status === 'Draft') q.status = 'Sent'; audit('Sent quotation ' + q.no + ' (' + ch + ')', { cust: q.cust, car: q.car }); save(); }
  function share(q) {
    return pdfFile(q).then(function (p) {
      if (p.file && navigator.canShare && navigator.canShare({ files: [p.file] })) {
        return navigator.share({ files: [p.file], title: 'Quotation ' + q.no, text: waText(q) }).then(function () { markSent(q, 'Shared PDF'); render(true); }, function () {});
      }
      /* no file sharing here (most laptops): save the PDF, then open WhatsApp with the summary so it can be attached */
      download(q).then(function () { if (q.phone) { Share.wa(q.phone, waText(q) + '\n\n(The PDF is attached.)'); markSent(q, 'WhatsApp'); render(true); } });
    }, function () { say('The PDF could not be made. Check the connection and try again.'); });
  }
  function waText(q) {
    var x = m(q), b = B(), F = QuoteDoc.fmt, out = ['Hi ' + callName(q.name || '') + ',', '', 'Here is your quotation ' + q.no + ' from ' + b.name + '.', '',
      (q.vehicle || 'Car') + ' for ' + F.plural(x.days, 'day'), F.dtLong(q.start) + ' to ' + F.dtLong(q.end), '',
      'Rental: ' + rm(x.rent)];
    if (x.cover) out.push('Damage cover: ' + rm(x.cover));
    if (x.delivery) out.push('Delivery: ' + rm(x.delivery));
    if (x.ret) out.push('Return: ' + rm(x.ret));
    if (x.other) out.push('Other charges: ' + rm(x.other));
    if (x.discount) out.push('Discount: -' + rm(x.discount));
    if (x.deposit) out.push('Refundable deposit: ' + rm(x.deposit));
    out.push('*Total payable: ' + rm(x.total) + '*', '', 'Reply here to confirm and we will reserve the car for you.');
    return out.join('\n');
  }
  function preview(id) {
    var q = get(id); if (!q) return;
    input(q).then(function (inp) {
      var html = QuoteDoc.svg(inp);
      sheet(sheetHead(q.no, q.name) + '<div class="qt-paper noswipe" id="qtPaper">' + html + '</div><p class="hint qt-hint">Tap the page to zoom in. Tap again to fit.</p>' +
        '<div class="sheet-foot"><div class="btnrow"><button type="button" class="btn ghost" id="qtDl">' + I('install') + 'Download PDF</button><button type="button" class="btn" id="qtSh">' + I('share') + 'Share PDF</button></div>' +
        (q.phone ? '<button type="button" class="btn link qt-walink" id="qtWa">' + I('wa') + 'Send the summary on WhatsApp</button>' : '') + '</div>', function (sh) {
          var pp = $('#qtPaper', sh); pp.onclick = function (e) { var r = pp.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top + pp.scrollTop) / pp.scrollHeight; pp.classList.toggle('zoom'); if (pp.classList.contains('zoom')) { pp.scrollLeft = Math.max(0, fx * pp.scrollWidth - pp.clientWidth / 2); pp.scrollTop = Math.max(0, fy * pp.scrollHeight - pp.clientHeight / 2); } };
          $('#qtDl', sh).onclick = function () { download(q); };
          $('#qtSh', sh).onclick = function () { share(q); };
          var wa = $('#qtWa', sh); if (wa) wa.onclick = function () { Share.wa(q.phone, waText(q)); markSent(q, 'WhatsApp text'); };
        }, { full: true, stack: true });
    });
  }

  /* ---------- the form ---------- */
  function fresh() {
    var s = new Date(); s.setDate(s.getDate() + 1); s.setHours(10, 0, 0, 0); var e = new Date(s.getTime() + 3 * DAY);
    var fp = placeChoices('pick')[0], fr = placeChoices('ret')[0];
    return { cust: null, name: '', company: '', phone: '', car: null, vehicle: '', start: s.toISOString(), end: e.toISOString(), days: null, daily: 0, deposit: 0, cover: null,
      pick: fp ? fp.v : 'client', pickNote: '', ret: fr ? fr.v : 'client', retNote: '', delivery: fp ? fp.fee : 0, retFee: fr ? fr.fee : 0, extras: [], discount: 0, notes: '' };
  }
  function vehicleOf(c) { return [c.make, c.model, c.year].filter(Boolean).join(' '); }
  function form(id, opts) {
    opts = opts || {};
    if (!canMake()) { say('Ask the owner for access to make bookings'); return; }
    var old = id ? get(id) : null, st = old ? JSON.parse(JSON.stringify(old)) : fresh(), tried = false;
    if (opts.copy) { delete st.id; delete st.no; delete st.bookingId; delete st.sent; st.status = 'Draft'; old = null; }
    if (opts.car && car(opts.car)) { var c0 = car(opts.car); st.car = c0.id; st.vehicle = vehicleOf(c0); st.daily = c0.rate; st.deposit = c0.deposit; }
    if (opts.cust && byId(S.customers, opts.cust)) { var u0 = cust(opts.cust); st.cust = u0.id; st.name = u0.name; st.phone = u0.phone || ''; }
    if (!old && !opts.copy) { var dp = (B().packages || []).filter(function (p) { return p.default; })[0]; if (dp) st.cover = { name: dp.name, daily: dp.daily }; }
    var g = formGuard(function () { return st; }), sh;
    var mf = function (k, label, v, hint) { return '<label class="field"><span>' + label + '</span><div class="rmfield"><input class="inp num" inputmode="decimal" data-m="' + k + '" value="' + money2(v) + '"></div>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>'; };
    var placeSel = function (end) {
      var v = end === 'pick' ? st.pick : st.ret;
      return '<select class="inp" data-place="' + end + '">' + placeChoices(end).map(function (p) { return '<option value="' + esc(p.v) + '"' + (p.v === v ? ' selected' : '') + '>' + esc(p.label) + (p.fee ? ' (' + rm(p.fee) + ')' : '') + '</option>'; }).join('') + '</select>';
    };
    function custHtml() {
      return (st.cust ? '<div class="qt-linked">' + chip('Saved customer', 'green') + '<button type="button" class="btn sm link" id="qtUnlink">Not this customer</button></div>' :
        '<button type="button" class="carfield empty-car" id="qtCust">' + I('search') + '<span class="grow">Find a saved customer by name or phone</span>' + I('chev') + '</button>') +
        '<label class="field"><span>Name</span><input class="inp' + (tried && !st.name.trim() ? ' bad' : '') + '" data-t="name" value="' + esc(st.name) + '" autocomplete="off" placeholder="Customer name">' + (tried && !st.name.trim() ? '<span class="err">Type the customer’s name</span>' : '') + '</label>' +
        '<label class="field"><span>Company (optional)</span><input class="inp" data-t="company" value="' + esc(st.company) + '" autocomplete="off" placeholder="For a company booking"></label>' +
        '<label class="field"><span>Mobile</span><input class="inp" data-t="phone" value="' + esc(st.phone) + '" inputmode="tel" autocomplete="off" placeholder="012 345 6789"></label>';
    }
    function carHtml() {
      var c = st.car && car(st.car);
      return (c ? '<button type="button" class="carfield picked-car" id="qtCar"><span class="pk-car">' + carSVG(c.color, c.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(c.plate) + '</span><span class="pk-sub">' + esc(c.make + ' ' + c.model + ' · ' + c.color) + '</span><span class="pk-sub"><span class="money">' + rm(c.rate) + '</span> a day</span></span><span class="btn sm ghost">Change</span></button>' :
        '<button type="button" class="carfield empty-car" id="qtCar">' + I('search') + '<span class="grow">Search a car by plate, model or colour</span>' + I('chev') + '</button>') +
        '<label class="field"><span>Vehicle on the quotation</span><input class="inp' + (tried && !st.vehicle.trim() ? ' bad' : '') + '" data-t="vehicle" value="' + esc(st.vehicle) + '" autocomplete="off" placeholder="Perodua Alza 2024">' +
        (tried && !st.vehicle.trim() ? '<span class="err">Choose a car or type the vehicle</span>' : '<span class="hint">The plate is not shown to the customer.</span>') + '</label>';
    }
    function daysHtml() {
      var x = m(st), bad = !(new Date(st.end) > new Date(st.start)), h = Math.round(x.hours * 10) / 10;
      if (bad) return '<div class="banner red">' + I('warn') + '<div>The return must be after the pick-up.</div></div>';
      return '<div class="qt-days"><div class="grow"><b>Charged as ' + QuoteDoc.fmt.plural(x.days, 'day') + '</b><div class="small muted">' + h + ' hours' + (st.days ? ', set by hand (the hours make ' + QuoteDoc.fmt.plural(x.autoDays, 'day') + ')' : ', every part day counts as a full day') + '</div></div>' +
        (st.days ? '<button type="button" class="btn sm ghost" id="qtAuto">Use ' + x.autoDays + '</button>' : '') +
        '<div class="qt-step"><button type="button" class="iconbtn" data-step="-1" aria-label="One day less">−</button><button type="button" class="iconbtn" data-step="1" aria-label="One day more">+</button></div></div>';
    }
    function coverHtml() {
      var pk = B().packages || [], on = st.cover ? st.cover.name : '';
      return '<div class="seg qt-cover">' + ['<button type="button" data-cover=""' + (on ? '' : ' class="on"') + '>None</button>'].concat(pk.map(function (p) { return '<button type="button" data-cover="' + esc(p.id) + '"' + (on === p.name ? ' class="on"' : '') + '>' + esc(p.name) + ' <small class="money">' + rm(p.daily) + '/day</small></button>'; })).join('') + '</div>';
    }
    function extrasHtml() {
      return st.extras.map(function (x, i) {
        return '<div class="qt-extra"><input class="inp" data-x="' + i + '" data-xk="text" value="' + esc(x.text) + '" placeholder="What is it? (child seat)">' +
          '<div class="qt-extra2"><label class="field"><span>Qty</span><input class="inp num" inputmode="numeric" data-x="' + i + '" data-xk="qty" value="' + esc(x.qty) + '"></label>' +
          '<label class="field"><span>Each</span><div class="rmfield"><input class="inp num" inputmode="decimal" data-x="' + i + '" data-xk="rate" value="' + esc(x.rate === '' ? '' : money2(x.rate)) + '"></div></label>' +
          '<button type="button" class="iconbtn" data-xdel="' + i + '" aria-label="Remove this charge">' + I('trash') + '</button></div></div>';
      }).join('') + '<button type="button" class="btn sm ghost" id="qtAddX">' + I('plus') + 'Add a charge</button>';
    }
    function sumHtml() {
      var x = m(st), row = function (l, v, cls) { return '<div class="sumline' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b class="money">' + v + '</b></div>'; };
      return row('Rental, ' + QuoteDoc.fmt.plural(x.days, 'day') + ' x ' + rm(x.daily), rm(x.rent)) + (x.cover ? row('Damage cover', rm(x.cover)) : '') + (x.delivery ? row('Delivery charge', rm(x.delivery)) : '') +
        (x.ret ? row('Return charge', rm(x.ret)) : '') + (x.other ? row('Other charges', rm(x.other)) : '') + (x.discount ? row('Discount', rm(-x.discount)) : '') +
        (x.deposit ? row('Refundable deposit', rm(x.deposit)) : '') + row('Total payable', rm(x.total), 'qt-total');
    }
    function problems() {
      var p = [];
      if (!String(st.name || '').trim()) p.push('the customer’s name');
      if (!String(st.vehicle || '').trim()) p.push('the vehicle');
      if (!(new Date(st.end) > new Date(st.start))) p.push('a return after the pick-up');
      if (!(+st.daily > 0)) p.push('the daily rate');
      return p;
    }
    var body = sheetHead(old ? 'Change ' + old.no : opts.copy ? 'Copy quotation' : 'New quotation', old ? old.name : 'Pick the details. The quotation is made in your company format.') +
      '<div class="qt-form">' +
      '<div class="sec"><h2>Customer</h2></div><div id="qtCustBox">' + custHtml() + '</div>' +
      '<div class="sec"><h2>Car and dates</h2></div><div id="qtCarBox">' + carHtml() + '</div>' +
      '<div class="two"><label class="field"><span>Pick-up</span><input class="inp" type="datetime-local" data-d="start" value="' + dtv(st.start) + '"></label>' +
      '<label class="field"><span>Return</span><input class="inp" type="datetime-local" data-d="end" value="' + dtv(st.end) + '"></label></div>' +
      '<div id="qtDays">' + daysHtml() + '</div>' +
      '<div class="sec"><h2>Rates</h2></div><div class="two">' + mf('daily', 'Daily rate', st.daily) + mf('deposit', 'Refundable deposit', st.deposit) + '</div>' +
      '<div class="field"><span>Damage cover</span><div id="qtCover">' + coverHtml() + '</div></div>' +
      '<div class="sec"><h2>Delivery and return</h2></div>' +
      '<label class="field"><span>Pick-up</span>' + placeSel('pick') + '</label>' + mf('delivery', 'Delivery charge', st.delivery, 'Shows on the quotation only when more than RM 0.00.') +
      '<label class="field"><span>Return</span>' + placeSel('ret') + '</label>' + mf('retFee', 'Return charge', st.retFee) +
      '<div class="sec"><h2>Other charges and discount</h2></div><div id="qtExtras">' + extrasHtml() + '</div>' + mf('discount', 'Discount', st.discount) +
      '<label class="field"><span>Extra notes on the quotation (optional)</span><textarea class="inp" rows="3" data-t="notes" placeholder="One note a line. They are added under Terms and notes.">' + esc(st.notes) + '</textarea></label>' +
      '<div class="card qt-sum" id="qtSum">' + sumHtml() + '</div></div>' +
      '<div class="sheet-foot"><p class="small muted qt-foothint" id="qtHint"></p><button type="button" class="btn big" id="qtSave">' + I('file') + (old ? 'Save and preview' : 'Make the quotation') + '</button></div>';
    function redraw(part) { var map = { cust: ['#qtCustBox', custHtml], car: ['#qtCarBox', carHtml], days: ['#qtDays', daysHtml], cover: ['#qtCover', coverHtml], extras: ['#qtExtras', extrasHtml], sum: ['#qtSum', sumHtml] }; [].concat(part).forEach(function (k) { var e = $(map[k][0], sh); if (e) e.innerHTML = map[k][1](); }); wire(); hint(); }
    function hint() { var p = problems(), h = $('#qtHint', sh); if (h) h.textContent = p.length ? 'Still needed: ' + p.join(', ') + '.' : 'Total payable ' + rm(m(st).total) + '.'; }
    function wire() {
      $$('[data-t]', sh).forEach(function (el) { el.oninput = function () { st[el.dataset.t] = el.value; if (tried) hint(); else hint(); }; });
      var cb = $('#qtCust', sh); if (cb) cb.onclick = function () { Pickers.customer({ title: 'Quotation for', allowNew: true, onPick: function (c, typed) { if (c) { st.cust = c.id; st.name = c.name; st.phone = c.phone || ''; } else if (typed) { if (/\d{5,}/.test(typed)) st.phone = typed; else st.name = typed; } redraw('cust'); } }); };
      var ul = $('#qtUnlink', sh); if (ul) ul.onclick = function () { st.cust = null; redraw('cust'); };
      $('#qtCar', sh).onclick = function () {
        Pickers.car({ title: 'Which car?', start: new Date(st.start), end: new Date(st.end), selected: st.car, showBusy: true, onPick: function (c) {
          st.car = c.id; st.vehicle = vehicleOf(c); st.daily = c.rate; st.deposit = c.deposit;
          $$('[data-m="daily"]', sh)[0].value = money2(st.daily); $$('[data-m="deposit"]', sh)[0].value = money2(st.deposit);
          redraw(['car', 'sum']);
          var bz = busy(c.id, new Date(st.start), new Date(st.end)); if (!bz.free) say(c.plate + ' is not free then (' + bz.reason + '). You can still quote it.');
        } });
      };
      $$('[data-d]', sh).forEach(function (el) { el.onchange = function () { if (!el.value) return; st[el.dataset.d] = new Date(el.value).toISOString(); if (el.dataset.d === 'start' && !(new Date(st.end) > new Date(st.start))) { st.end = new Date(new Date(st.start).getTime() + DAY).toISOString(); var e2 = $('[data-d="end"]', sh); e2.value = dtv(st.end); e2.dispatchEvent(new Event('input')); } redraw(['days', 'sum']); }; });
      $$('[data-step]', sh).forEach(function (el) { el.onclick = function () { var x = m(st); st.days = Math.max(1, x.days + +el.dataset.step); if (st.days === x.autoDays) st.days = null; redraw(['days', 'sum']); }; });
      var au = $('#qtAuto', sh); if (au) au.onclick = function () { st.days = null; redraw(['days', 'sum']); };
      $$('[data-m]', sh).forEach(function (el) {
        el.oninput = function () { var v = parseMoney(el.value); st[el.dataset.m] = isNaN(v) ? 0 : v; el.classList.toggle('bad', el.value.trim() !== '' && isNaN(v)); redraw('sum'); };
        el.onblur = function () { var v = parseMoney(el.value); if (!isNaN(v)) el.value = money2(v); };
      });
      $$('[data-place]', sh).forEach(function (el) { el.onchange = function () { var end = el.dataset.place, p = placeChoices(end).filter(function (x) { return x.v === el.value; })[0]; if (end === 'pick') { st.pick = el.value; st.delivery = p ? p.fee : 0; $('[data-m="delivery"]', sh).value = money2(st.delivery); } else { st.ret = el.value; st.retFee = p ? p.fee : 0; $('[data-m="retFee"]', sh).value = money2(st.retFee); } redraw('sum'); }; });
      $$('[data-cover]', sh).forEach(function (el) { el.onclick = function () { var p = byId(B().packages || [], el.dataset.cover); st.cover = p ? { name: p.name, daily: p.daily } : null; redraw(['cover', 'sum']); }; });
      $$('[data-x]', sh).forEach(function (el) { el.oninput = function () { var x = st.extras[+el.dataset.x], k = el.dataset.xk; if (!x) return; if (k === 'text') x.text = el.value; else { var v = k === 'qty' ? parseInt(el.value, 10) : parseMoney(el.value); x[k] = isNaN(v) ? '' : v; } redraw('sum'); }; });
      $$('[data-xdel]', sh).forEach(function (el) { el.onclick = function () { st.extras.splice(+el.dataset.xdel, 1); redraw(['extras', 'sum']); }; });
      var ax = $('#qtAddX', sh); if (ax) ax.onclick = function () { st.extras.push({ text: '', qty: 1, rate: '' }); redraw(['extras', 'sum']); var ins = $$('[data-xk="text"]', sh); if (ins.length) ins[ins.length - 1].focus(); };
    }
    sh = sheet(body, function (s) {
      sh = s; wire(); hint();
      $('#qtSave', sh).onclick = function () {
        tried = true; var p = problems();
        if (p.length) { redraw(['cust', 'car']); say('Still needed: ' + p.join(', ')); return; }
        var now = new Date().toISOString(), q;
        st.extras = st.extras.filter(function (x) { return String(x.text || '').trim() && +x.qty > 0 && x.rate !== ''; });
        ['name', 'company', 'phone', 'vehicle', 'notes'].forEach(function (k) { st[k] = String(st[k] || '').trim(); });
        if (old) { q = get(old.id); Object.assign(q, st, { updatedAt: now, updatedBy: S.me }); audit('Changed quotation ' + q.no, { cust: q.cust, car: q.car }); }
        else { q = Object.assign({}, st, { id: uid(), no: QuoteDoc.nextNo(all(), prefix(), now), at: now, by: S.me, status: 'Draft' }); all().unshift(q); audit('Made quotation ' + q.no + ' for ' + q.name, { cust: q.cust, car: q.car }); }
        save(); closeSheet(false, true);
        if (route().name === 'quote' && route().a === q.id) render(true); else location.hash = '#quote/' + q.id;
        setTimeout(function () { preview(q.id); }, 260);
      };
    }, { full: true, guard: g, stack: !!opts.stack });
    g.arm(sh);
  }

  /* ---------- turning it into a booking (New booking reads this) ---------- */
  function fillBooking(n, id) {
    var q = get(id); if (!q) return;
    n.quoteId = q.id; n.s = new Date(q.start).toISOString(); n.e = new Date(q.end).toISOString();
    if (q.cust && byId(S.customers, q.cust)) { n.cust = q.cust; n.f = nbFillFromCust(cust(q.cust)); }
    else {
      var ex = q.phone ? S.customers.filter(function (c) { return phoneCore(c.phone) && phoneCore(c.phone) === phoneCore(q.phone); })[0] : null;
      if (ex) { n.cust = ex.id; n.f = nbFillFromCust(ex); } else { n.newMode = true; n.f.name = q.name || ''; n.f.phone = q.phone || ''; }
    }
    if (q.car && car(q.car)) nbSetCar(car(q.car));
    if (can('bookings.edit_amounts')) {
      var x = m(q); n.r.daily = money2(q.daily); n.r.deposit = money2(q.deposit); n.r.delivery = money2(x.delivery); n.r['return'] = money2(x.ret); n.r.others = money2(x.other); n.r.discount = money2(x.discount);
      if (q.cover) { var pk = (B().packages || []).filter(function (p) { return p.name === q.cover.name; })[0]; n.cover = pk ? { mode: 'pkg', pkg: pk.id, name: '', daily: '', max: '' } : { mode: 'custom', pkg: '', name: q.cover.name, daily: money2(q.cover.daily), max: '' }; }
      else n.cover = { mode: 'none', pkg: '', name: '', daily: '', max: '' };
    }
    if (q.pick) { n.pick = q.pick; n.pickNote = q.pickNote || ''; }
    if (q.ret) { n.ret = q.ret; n.retNote = q.retNote || ''; }
    n.note = ('From quotation ' + q.no + '. ' + (q.notes || '')).trim();
  }
  function markBooked(id, b) {
    var q = get(id); if (!q) return;
    q.status = 'Booked'; q.bookingId = b.id; q.updatedAt = new Date().toISOString(); q.updatedBy = S.me;
    b.log.push({ at: q.updatedAt, by: S.me, text: 'Made from quotation ' + q.no });
  }
  function book(id) {
    var q = get(id); if (!q) return;
    if (q.car && car(q.car)) { var bz = busy(q.car, new Date(q.start), new Date(q.end)); if (!bz.free) say((car(q.car).plate) + ' is not free then: ' + bz.reason + '. Pick another car in the form.'); }
    location.hash = hashWith('new', { quote: q.id });
  }
  function cancel(id) {
    var q = get(id); if (!q) return;
    confirm({ icon: 'warn', title: 'Cancel ' + q.no + '?', text: 'The quotation stays in the list as Cancelled. You can copy it later.', ok: 'Cancel quotation', cancel: 'Keep it', danger: true }).then(function (ok) {
      if (!ok) return; q.status = 'Cancelled'; q.cancelledAt = new Date().toISOString(); q.cancelledBy = S.me; audit('Cancelled quotation ' + q.no, { cust: q.cust }); save(); render(true);
    });
  }
  function setUp() {
    var b = B(), g = formGuard();
    var sh = sheet(sheetHead('Quotation set-up', 'Used on every quotation of ' + b.short) +
      '<label class="field"><span>Company behind the brand</span><input class="inp" id="qsLegal" value="' + esc(b.legalName || '') + '" placeholder="Kilat Wheels Sdn Bhd"><span class="hint">Shown at the top and as “Operated by”. Leave empty when it is the same as ' + esc(b.name) + '.</span></label>' +
      '<label class="field"><span>Number starts with</span><input class="inp" id="qsPre" value="' + esc(prefix()) + '" autocapitalize="characters" maxlength="6"><span class="hint">Next: ' + esc(QuoteDoc.nextNo(all(), prefix(), new Date())) + '</span></label>' +
      '<label class="field"><span>Standing notes (one a line)</span><textarea class="inp" rows="4" id="qsNotes" placeholder="Prices include fuel at the same level as pick-up.">' + esc(b.quoteNotes || '') + '</textarea><span class="hint">Added under Terms and notes on every quotation.</span></label>' +
      '<p class="small muted">Logo, address, phone and bank account come from Settings.</p>' +
      '<div class="sheet-foot"><button type="button" class="btn big" id="qsSave">Save</button></div>', function (s) {
        $('#qsSave', s).onclick = function () {
          var pre = $('#qsPre', s).value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!pre) { say('Type what the numbers start with'); return; }
          S.settings.legalName = $('#qsLegal', s).value.trim(); S.settings.quotePrefix = pre; S.settings.quoteNotes = $('#qsNotes', s).value.trim();
          audit('Changed the quotation set-up'); save(); closeSheet(false, true); say('Saved'); render(true);
        };
      }, { guard: g });
    g.arm(sh);
  }

  /* ---------- screens ---------- */
  function matches(q, t) {
    if (!t) return true;
    var core = tidySearch(t); if (core && phoneMatch(t, q.phone)) return true;
    return wordsMatch(t, [q.no, q.name, q.company, q.vehicle, (car(q.car) || {}).plate].join(' ')) || normPlate(q.no).indexOf(normPlate(t)) >= 0;
  }
  function listView() {
    if (!canSee()) return { html: topbar('Quotations', { back: '#more' }) + '<main>' + noAccess('bookings.create') + '</main>' };
    var rows = all().filter(function (q) { return matches(q, V.q.trim()); });
    var inF = function (q, f) { return f === 'all' || (f === 'open' ? q.status === 'Draft' || q.status === 'Sent' : q.status === f); };
    var cnt = function (f) { return rows.filter(function (q) { return inF(q, f); }).length; };
    var list = rows.filter(function (q) { return inF(q, V.f); }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var right = canSetUp() ? '<button type="button" class="iconbtn" id="qtSet" aria-label="Quotation set-up">' + I('gear') + '</button>' : '';
    var html = topbar('Quotations', { back: '#more', sub: all().filter(function (q) { return q.status === 'Draft' || q.status === 'Sent'; }).length + ' open', right: right }) + '<main class="qt-main">' +
      '<label class="search">' + I('search') + '<input id="qtq" type="search" placeholder="Name, phone, number or car" value="' + esc(V.q) + '" autocomplete="off" enterkeyhint="search"></label>' +
      '<div class="chiprow">' + [['open', 'Open'], ['Booked', 'Booked'], ['Cancelled', 'Cancelled'], ['all', 'All']].map(function (f) { return '<button type="button" class="fchip' + (V.f === f[0] ? ' on' : '') + '" data-qf="' + f[0] + '">' + f[1] + ' <small>' + cnt(f[0]) + '</small></button>'; }).join('') + '</div>' +
      '<div class="list">' + (list.length ? list.map(function (q) {
        var x = m(q);
        return '<a class="card2" href="#quote/' + esc(q.id) + '"><div class="c2-main"><div class="c2-t1">' + esc(q.name) + '</div><div class="c2-t2">' + esc(q.vehicle) + ' · ' + esc(dShort(q.start)) + ' to ' + esc(dShort(q.end)) + '</div><div class="c2-t2">' + esc(q.no) + ' ' + chip(q.status, TONE[q.status]) + '</div></div><div class="c2-end">' + rm(x.total) + '<small>' + QuoteDoc.fmt.plural(x.days, 'day') + '</small></div></a>';
      }).join('') : '<div class="empty">' + (V.q ? 'No quotation matches “' + esc(V.q) + '”.' : V.f === 'open' ? 'No open quotations. Tap Quote to make one.' : 'Nothing here yet.') + '</div>') + '</div></main>' +
      (canMake() ? '<button type="button" class="fab fab-x" id="qtFab" aria-label="New quotation">' + I('file', 2.2) + '<span>Quote</span></button>' : '');
    return { html: html, keepScroll: true, after: function () {
      $$('[data-qf]').forEach(function (el) { el.onclick = function () { V.f = el.dataset.qf; render(false, true); }; });
      var f = $('#qtFab'); if (f) f.onclick = function () { form(null); };
      var s = $('#qtSet'); if (s) s.onclick = setUp;
      var qi = $('#qtq'), tm = null;
      if (V.qFocus) { V.qFocus = false; qi.focus(); var n = qi.value.length; try { qi.setSelectionRange(n, n); } catch (e) {} }
      qi.addEventListener('input', function () { V.q = qi.value; clearTimeout(tm); tm = setTimeout(function () { V.qFocus = document.activeElement === qi; render(false, true); }, 180); });
    } };
  }
  function oneView(r) {
    var q = get(r.a);
    if (!q) return { html: topbar('Quotation', { back: '#quotes' }) + '<main><div class="empty">This quotation was not found.</div></main>' };
    if (!canSee()) return { html: topbar(q.no, { back: '#quotes' }) + '<main>' + noAccess('bookings.create') + '</main>' };
    var x = m(q), b = q.bookingId && bk(q.bookingId), F = QuoteDoc.fmt, live = q.status === 'Draft' || q.status === 'Sent';
    var kv = function (k, v) { return '<div class="kvr"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var html = topbar(q.no, { back: '#quotes', sub: q.status }) + '<main class="qt-main">' +
      '<div class="card qt-head"><div class="grow"><div class="b">' + esc(q.name) + '</div>' + (q.company ? '<div class="small muted">' + esc(q.company) + '</div>' : '') + (q.phone ? '<div class="small muted">' + esc(q.phone) + '</div>' : '') + '</div>' + chip(q.status, TONE[q.status]) + '</div>' +
      (b ? '<a class="banner green" href="#booking/' + esc(b.id) + '">' + I('check') + '<div>Booked as <b>' + esc(b.code) + '</b>. Open the booking.</div></a>' : '') +
      '<div class="card qt-kv">' + kv('Vehicle', esc(q.vehicle) + (q.car && car(q.car) ? ' <small class="muted">(' + esc(car(q.car).plate) + ')</small>' : '')) + kv('Pick-up', esc(F.dtLong(q.start))) + kv('Return', esc(F.dtLong(q.end))) + kv('Charged as', F.plural(x.days, 'day')) + '</div>' +
      '<div class="card qt-sum">' + ['Rental|' + rm(x.rent), x.cover ? 'Damage cover|' + rm(x.cover) : '', x.delivery ? 'Delivery charge|' + rm(x.delivery) : '', x.ret ? 'Return charge|' + rm(x.ret) : '', x.other ? 'Other charges|' + rm(x.other) : '', x.discount ? 'Discount|' + rm(-x.discount) : '', x.deposit ? 'Refundable deposit|' + rm(x.deposit) : ''].filter(Boolean).map(function (s) { s = s.split('|'); return '<div class="sumline"><span>' + s[0] + '</span><b class="money">' + s[1] + '</b></div>'; }).join('') +
      '<div class="sumline qt-total"><span>Total payable</span><b class="money">' + rm(x.total) + '</b></div></div>' +
      '<p class="small muted qt-meta">Made ' + esc(dShort(q.at)) + ' ' + esc(hm(q.at)) + ' by ' + esc(who(q.by)) + (q.updatedAt ? '. Changed ' + esc(dShort(q.updatedAt)) + ' by ' + esc(firstName(who(q.updatedBy))) : '') + '. ' + (q.sent ? 'Last sent: ' + esc(q.sent.ch) + ', ' + esc(dShort(q.sent.at)) + ' ' + esc(hm(q.sent.at)) + '.' : 'Not sent yet.') + '</p>' +
      '<button type="button" class="btn big" id="qtPrev">' + I('file') + 'See and share the quotation</button>' +
      '<div class="actions qt-acts">' +
      (live && canMake() ? '<button type="button" class="act" id="qtBook">' + I('plus') + 'Make booking</button>' : '') +
      (live && canMake() ? '<button type="button" class="act" id="qtEdit">' + I('edit') + 'Change</button>' : '') +
      (canMake() ? '<button type="button" class="act" id="qtCopy">' + I('copy') + 'Copy</button>' : '') +
      (q.phone ? '<button type="button" class="act" id="qtWa2">' + I('wa') + 'WhatsApp</button>' : '') +
      (live && canMake() ? '<button type="button" class="act" id="qtCancel">' + I('x') + 'Cancel</button>' : '') + '</div></main>';
    return { html: html, after: function () {
      $('#qtPrev').onclick = function () { preview(q.id); };
      var bb = $('#qtBook'); if (bb) bb.onclick = function () { book(q.id); };
      var ed = $('#qtEdit'); if (ed) ed.onclick = function () { form(q.id); };
      var cp = $('#qtCopy'); if (cp) cp.onclick = function () { form(q.id, { copy: true }); };
      var wa = $('#qtWa2'); if (wa) wa.onclick = function () { Share.wa(q.phone, waText(q)); markSent(q, 'WhatsApp text'); };
      var cx = $('#qtCancel'); if (cx) cx.onclick = function () { cancel(q.id); };
    } };
  }
  VIEWS.quotes = listView;
  VIEWS.quote = oneView;
  if (typeof TAB_OF !== 'undefined') { TAB_OF.quotes = 'more'; TAB_OF.quote = 'more'; }

  /* ---------- made-up quotations for the demo ---------- */
  SEEDERS.push({ key: 'quotes', fn: function (d, x) {
    d.quotes = [];
    var cars = (d.cars || []).filter(function (c) { return c.status === 'active'; }), cus = (d.customers || []).filter(function (c) { return !c.blacklist; });
    if (!cars.length || !cus.length) return;
    var st = d.settings || {}, pre = st.quotePrefix || String(st.codePrefix || 'Q').charAt(0) + 'Q', pk = (st.packages || [])[0];
    var plan = [[-6, 'Sent'], [-4, 'Sent'], [-2, 'Cancelled'], [-1, 'Sent'], [0, 'Draft'], [0, 'Sent']];
    plan.forEach(function (p, i) {
      var c = x.pick(cars), u = x.pick(cus), at = new Date(x.now.getTime() + p[0] * DAY - x.ri(1, 6) * 3600e3);
      var s = new Date(x.now.getTime() + x.ri(3, 25) * DAY); s.setHours(x.pick([7, 9, 10, 14]), 0, 0, 0);
      var e = new Date(s.getTime() + x.ri(2, 6) * DAY + x.pick([0, 3, 9, 12]) * 3600e3);
      var deliv = i % 2 === 0, q = { id: 'q' + (i + 1), at: at.toISOString(), by: x.pick(x.staffIds()), status: p[1] === 'Booked' ? 'Sent' : p[1], cust: u.id, name: u.name, company: i === 1 ? 'Seri Teknik Sdn Bhd' : '', phone: u.phone,
        car: c.id, vehicle: [c.make, c.model, c.year].filter(Boolean).join(' '), start: s.toISOString(), end: e.toISOString(), days: null, daily: c.rate, deposit: c.deposit,
        cover: i === 3 && pk ? { name: pk.name, daily: pk.daily } : null, pick: deliv ? 'client' : 'our:L1', pickNote: '', ret: deliv ? 'client' : 'our:L1', retNote: '',
        delivery: deliv ? +st.clientDeliveryFee || 0 : 0, retFee: deliv ? +st.clientReturnFee || 0 : 0, extras: i === 5 ? [{ text: 'Child seat', qty: 1, rate: 30 }] : [], discount: i === 1 ? 50 : 0, notes: '' };
      if (p[1] === 'Sent' || p[1] === 'Booked') q.sent = { ch: 'WhatsApp text', at: new Date(at.getTime() + 600e3).toISOString(), by: q.by };
      if (p[1] === 'Cancelled') { q.cancelledAt = new Date(at.getTime() + DAY).toISOString(); q.cancelledBy = q.by; }
      q.no = QuoteDoc.nextNo(d.quotes, pre, at);
      d.quotes.unshift(q);
    });
  } });
  SEEDERS.push({ key: 'quoteSetup', fn: function (d) {
    d.quoteSetup = 1; d.settings = d.settings || {};
    var legal = { kilat: 'Kilat Wheels Sdn Bhd', padi: 'Padi Emas Enterprise', bara: 'Bara Mobility Sdn Bhd' }[d.co];
    if (d.settings.legalName == null && legal) d.settings.legalName = legal;
  } });

  return { open: function (id) { location.hash = '#quote/' + id; }, form: form, preview: preview, fillBooking: fillBooking, markBooked: markBooked, waText: waText, input: input, pdfFile: pdfFile };
})();

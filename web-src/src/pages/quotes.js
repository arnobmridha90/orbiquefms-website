/* ===================================================================
   Page: Quotations (#page=quotes)
   Staff pick a customer, car, dates and charges; FMS makes the quotation in the company's own format. The drawing
   comes from QuoteDoc (app/m/js/quote-doc.js, shared with the phone app), so the preview, the PDF and the phone
   all show the same page. A quotation can be downloaded, sent on WhatsApp, copied, cancelled, or made into a booking.
   Data: D().quotes [{id, no, at, by, status, cust, name, company, phone, car, vehicle, start, end, days, daily, deposit,
   cover {name, daily}, startOpt, endOpt, delivery, retFee, extras [{text, qty, rate}], discount, notes, booking, sent}]
   Company settings: D().company.quotePrefix, quoteNotes (legal name, address, bank and logo come from Company details).
   =================================================================== */
var QT_TONE = { Draft: '', Sent: 'info', Booked: 'ok', Cancelled: 'bad' };
function qtList() { var d = D(); if (!d.quotes) { d.quotes = []; qtSeed(d); } return d.quotes; }
function qtGet(id) { return byId(qtList(), id); }
function qtCanMake() { return can('bookings.create'); }
function qtPrefix() { var co = D().company || {}; return co.quotePrefix || String(B().code || 'Q').charAt(0) + 'Q'; }
function qtCalc(q) { return QuoteDoc.calc(Object.assign({}, q, { ret: q.retFee })); }
function qtVehicle(c) { return [c.make, c.model, c.year].filter(Boolean).join(' '); }

/* made-up quotations, made the first time the page opens for a company */
function qtSeed(d) {
  var cars = d.cars.filter(function (c) { return c.status === 'active'; }), ppl = d.people.filter(function (p) { return !p.blacklist; });
  if (!cars.length || !ppl.length) return;
  var now = NOW(), pk = d.damagePackages[0];
  [[-5, 'Sent'], [-3, 'Sent'], [-2, 'Cancelled'], [-1, 'Sent'], [0, 'Draft']].forEach(function (p, k) {
    var c = cars[(k * 3 + 1) % cars.length], u = ppl[(k * 7 + 2) % ppl.length], at = new Date(now.getTime() + p[0] * DAY - (k + 1) * 3600e3);
    var s = new Date(now.getTime() + (6 + k * 4) * DAY); s.setHours([9, 10, 7, 14, 10][k], 0, 0, 0);
    var e = new Date(s.getTime() + (2 + k % 3) * DAY + [12, 0, 9, 3, 0][k] * 3600e3), deliv = k % 2 === 0;
    var q = { id: 'qt-' + (k + 1), at: at, by: (d.users[0] || {}).name, status: p[1], cust: u.id, name: u.name, company: k === 1 ? 'Seri Teknik Sdn Bhd' : '', phone: u.phone, car: c.id, vehicle: qtVehicle(c),
      start: s, end: e, days: null, daily: c.rate, deposit: c.deposit, cover: k === 3 && pk ? { name: pk.name, daily: pk.daily } : null, startOpt: deliv ? 'Delivery to client location' : '', endOpt: deliv ? 'Return from client location' : '',
      delivery: deliv ? 50 : 0, retFee: deliv ? 50 : 0, extras: k === 4 ? [{ text: 'Child seat', qty: 1, rate: 30 }] : [], discount: k === 1 ? 50 : 0, notes: '' };
    if (p[1] === 'Sent') q.sent = { ch: 'WhatsApp', at: new Date(at.getTime() + 6e5), by: q.by };
    q.no = QuoteDoc.nextNo(d.quotes, qtPrefix(), at);
    d.quotes.unshift(q);
  });
}

/* ---------- the document ---------- */
var QT_LOGO = {};
function qtLogo() {
  var co = D().company || {}, b = B(), src = co.logo || b.logoImg, key = b.id + ':' + (src ? src.length : 'mark') + ':' + (co.trading || b.name);
  if (!QT_LOGO[key]) QT_LOGO[key] = src ? QuoteDoc.imgSize(src) : QuoteDoc.lockup(b.mark, co.trading || b.name, b.secondary);
  return QT_LOGO[key];
}
function qtInput(q) {
  return qtLogo().then(function (lg) {
    var co = D().company || {}, b = B(), bank = co.bank || {};
    return { co: { trading: co.trading || b.name, legal: co.legal || b.legal || '', regNo: co.reg || b.reg, address: co.address || b.address, phone: co.phone || b.phone, email: co.email || b.email, site: co.website || '',
        bank: { name: bank.bank, accName: bank.accName, accNo: bank.accNo }, logo: lg && lg.src, logoW: lg && lg.w, logoH: lg && lg.h },
      colours: { navy: b.secondary, accent: b.accent || b.primary }, no: q.no, date: q.at, q: Object.assign({}, q, { ret: q.retFee }), notes: String(co.quoteNotes || '').split(/\n+/) };
  });
}
function qtFile(q) { return (q.no + ' ' + (q.name || '')).trim().replace(/[^\w\-]+/g, '_') + '.pdf'; }
function qtPdf(q) {
  UI.toast('Preparing ' + qtFile(q) + '...', { tone: 'info', ms: 1400 });
  return Promise.all([UI.loadScript(UI.LIB.jspdf), qtInput(q)]).then(function (r) {
    var bytes = QuoteDoc.pdf(r[1], window.jspdf.jsPDF);
    DB.log('Downloaded', 'Quotation', q.id, DB.actor() + ' downloaded quotation ' + q.no);
    return UI.download({ filename: qtFile(q), data: bytes, mime: 'application/pdf' });
  }, function () { UI.toast('The PDF tool could not load. Check the connection and try again.', { tone: 'bad' }); });
}
function qtWaText(q) {
  var x = qtCalc(q), F = QuoteDoc.fmt, co = D().company || {}, out = ['Hi ' + (q.name || '') + ',', '', 'Here is your quotation ' + q.no + ' from ' + (co.trading || B().name) + '.', '', (q.vehicle || 'Car') + ' for ' + F.plural(x.days, 'day'), F.dtLong(q.start) + ' to ' + F.dtLong(q.end), '', 'Rental: ' + F.rm(x.rent)];
  if (x.cover) out.push('Damage cover: ' + F.rm(x.cover)); if (x.delivery) out.push('Delivery: ' + F.rm(x.delivery)); if (x.ret) out.push('Return: ' + F.rm(x.ret));
  if (x.other) out.push('Other charges: ' + F.rm(x.other)); if (x.discount) out.push('Discount: -' + F.rm(x.discount)); if (x.deposit) out.push('Refundable deposit: ' + F.rm(x.deposit));
  out.push('*Total payable: ' + F.rm(x.total) + '*', '', 'Reply here to confirm and we will reserve the car for you.');
  return out.join('\n');
}
function qtMarkSent(q, ch) { DB.update('quotes', q, { status: q.status === 'Draft' ? 'Sent' : q.status, sent: { ch: ch, at: NOW(), by: DB.actor() } }, { where: 'Quotation', text: DB.actor() + ' sent quotation ' + q.no + ' (' + ch + ')' }); }
function qtSendWa(q) {
  var url = UI.waLink(q.phone, qtWaText(q)); if (!url) { UI.toast('This quotation has no mobile number.', { tone: 'warn' }); return; }
  window.open(url, '_blank', 'noopener'); qtMarkSent(q, 'WhatsApp');
}
function qtPaper(el, q) { el.innerHTML = '<div class="qt-paper"><div class="qt-load">' + i('loader-2') + ' Drawing the quotation...</div></div>'; return qtInput(q).then(function (inp) { el.innerHTML = '<div class="qt-paper">' + QuoteDoc.svg(inp) + '</div>'; }); }

/* ---------- view a quotation ---------- */
function qtOpen(id) {
  var q = qtGet(id); if (!q) { UI.toast('That quotation was not found', { tone: 'warn' }); return; }
  var live = q.status === 'Draft' || q.status === 'Sent', bk = q.booking ? findBooking(q.booking) : null;
  var foot = [{ label: 'Close', kind: 'g' }];
  var dr = UI.drawer({ title: q.no, subtitle: q.name + ' · ' + q.status, width: 760, data: { id: id },
    body: function (el) {
      el.innerHTML = '<div class="qt-view"><div class="qt-bar">' + UI.chip(q.status, QT_TONE[q.status]) + '<span class="b2">Made ' + esc(UI.fmt.dt(q.at)) + (q.by ? ' by ' + esc(q.by) : '') + (q.sent ? ' · Last sent ' + esc(q.sent.ch) + ', ' + esc(UI.fmt.dt(q.sent.at)) : ' · Not sent yet') + '</span></div>' +
        (bk ? UI.alert('Booked as <a href="#" data-qt-bk="' + esc(bk.code) + '"><b>' + esc(bk.code) + '</b></a>.', 'ok') : '') +
        '<div class="qt-acts">' + UI.btn('Download PDF', { icon: 'download', attrs: { 'data-qa': 'pdf' } }) + (q.phone ? UI.btn('WhatsApp', { icon: 'brand-whatsapp', kind: 'g', attrs: { 'data-qa': 'wa' } }) : '') +
        (live && qtCanMake() ? UI.btn('Make booking', { icon: 'calendar-plus', kind: 'g', attrs: { 'data-qa': 'book' } }) + UI.btn('Edit', { icon: 'pencil', kind: 'g', attrs: { 'data-qa': 'edit' } }) : '') +
        (qtCanMake() ? UI.btn('Copy', { icon: 'copy', kind: 'g', attrs: { 'data-qa': 'copy' } }) : '') + (live && qtCanMake() ? UI.btn('Cancel', { icon: 'x', kind: 'g', attrs: { 'data-qa': 'cancel' } }) : '') + '</div>' +
        '<div id="qt-paper"></div></div>';
      qtPaper(el.querySelector('#qt-paper'), q);
    },
    foot: foot });
  dr.el.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-qa]'), l = ev.target.closest('[data-qt-bk]');
    if (l) { ev.preventDefault(); API.openBooking(l.getAttribute('data-qt-bk')); return; }
    if (!b) return; var a = b.getAttribute('data-qa');
    if (a === 'pdf') qtPdf(q);
    else if (a === 'wa') { qtSendWa(q); dr.refresh && dr.refresh(); }
    else if (a === 'book') { dr.close(); qtBook(q); }
    else if (a === 'edit') { dr.close(); setTimeout(function () { qtForm(q.id); }, 0); }
    else if (a === 'copy') { dr.close(); setTimeout(function () { qtForm(q.id, { copy: true }); }, 0); }
    else if (a === 'cancel') UI.confirm({ title: 'Cancel ' + q.no + '?', text: 'It stays in the list as Cancelled. You can copy it later.', ok: 'Cancel quotation', cancel: 'Keep it', danger: true }).then(function (y) { if (!y) return; DB.update('quotes', q, { status: 'Cancelled' }, { where: 'Quotation', text: DB.actor() + ' cancelled quotation ' + q.no }); dr.close(); UI.toast('Quotation cancelled.'); });
  });
  return dr;
}
function qtBook(q) {
  var x = qtCalc(q);
  /* the booking keeps the quotation: when it is saved, the quotation shows Booked (see the data listener below) */
  QT_PENDING = { id: q.id, at: Date.now() };
  API.newBooking({ car: q.car || '', start: new Date(q.start), end: new Date(q.end), customer: q.cust || '', name: q.cust ? '' : q.name, phone: q.cust ? '' : q.phone,
    startOpt: q.startOpt || '', endOpt: q.endOpt || '', deliv: x.delivery, ret: x.ret, pkg: q.cover ? ((D().damagePackages.filter(function (p) { return p.name === q.cover.name; })[0] || {}).id || '') : '' });
  UI.toast('New booking filled from ' + q.no + '. Check the rates before you save.', { tone: 'info' });
}
var QT_PENDING = null;
if (typeof on === 'function') on('data', function (ev) {
  if (!QT_PENDING || ev.coll !== 'bookings' || ev.op !== 'add' || Date.now() - QT_PENDING.at > 30 * 60e3) return;
  var q = qtGet(QT_PENDING.id); QT_PENDING = null; if (!q) return;
  DB.update('quotes', q, { status: 'Booked', booking: ev.rec.code }, { where: 'Quotation', text: DB.actor() + ' made booking ' + ev.rec.code + ' from quotation ' + q.no });
});

/* ---------- make or change a quotation: form on the left, the live page on the right ---------- */
function qtForm(id, o) {
  o = o || {};
  if (!qtCanMake()) { UI.toast('Ask the owner for access to make bookings.', { tone: 'warn' }); return; }
  var d = D(), old = id ? qtGet(id) : null, st;
  if (old) { st = JSON.parse(JSON.stringify(old)); st.start = new Date(old.start); st.end = new Date(old.end); }
  else { var s = new Date(NOW().getTime() + DAY); s.setHours(10, 0, 0, 0); var dp = d.damagePackages.filter(function (p) { return p.id === (CO().packageDefault || ''); })[0];
    st = { cust: '', name: '', company: '', phone: '', car: '', vehicle: '', start: s, end: new Date(s.getTime() + 3 * DAY), days: null, daily: 0, deposit: 0, cover: dp ? { name: dp.name, daily: dp.daily } : null, startOpt: '', endOpt: '', delivery: 0, retFee: 0, extras: [], discount: 0, notes: '' }; }
  if (o.copy) { old = null; delete st.id; delete st.no; delete st.booking; delete st.sent; st.status = 'Draft'; }
  if (o.car) { var c0 = carById(o.car); if (c0) { st.car = c0.id; st.vehicle = qtVehicle(c0); st.daily = c0.rate; st.deposit = c0.deposit; } }
  var base = JSON.stringify(st), tried = false, carCtl, tm = null;
  var money = function (k, label, help) { return UI.input({ key: k, label: label, type: 'number', min: 0, step: '0.01', prefix: 'RM', value: (+st[k] || 0).toFixed(2), help: help }); };
  var opts = function (which) { return [{ value: '', label: 'Not shown' }].concat(handoverOptions(which).map(function (x) { return { value: x.value, label: x.label }; })); };
  function extrasHtml() {
    return st.extras.map(function (x, k) { return '<div class="qt-xrow">' + UI.input({ key: 'x-text-' + k, label: k ? '' : 'Charge', value: x.text, placeholder: 'Child seat' }) + UI.input({ key: 'x-qty-' + k, label: k ? '' : 'Qty', type: 'number', min: 1, value: x.qty }) + UI.input({ key: 'x-rate-' + k, label: k ? '' : 'Each', type: 'number', min: 0, step: '0.01', prefix: 'RM', value: x.rate === '' ? '' : (+x.rate).toFixed(2) }) + UI.iconBtn('trash', 'Remove', { size: 'sm', attrs: { 'data-xdel': k } }) + '</div>'; }).join('') +
      UI.btn('Add a charge', { icon: 'plus', kind: 'g', size: 'sm', attrs: { 'data-xadd': 1 } });
  }
  function daysHtml() {
    var x = qtCalc(st); if (!(st.end > st.start)) return UI.alert('The return must be after the pick-up.', 'bad');
    return '<div class="qt-days"><div><b>Charged as ' + plural(x.days, 'day') + '</b><span class="b2">' + Math.round(x.hours * 10) / 10 + ' hours' + (st.days ? ', set by hand (the hours make ' + plural(x.autoDays, 'day') + ')' : ', every part day counts as a full day') + '</span></div><span class="grow"></span>' +
      (st.days ? UI.btn('Use ' + x.autoDays, { kind: 'g', size: 'sm', attrs: { 'data-dauto': 1 } }) : '') + UI.iconBtn('minus', 'One day less', { size: 'sm', attrs: { 'data-dstep': -1 } }) + UI.iconBtn('plus', 'One day more', { size: 'sm', attrs: { 'data-dstep': 1 } }) + '</div>';
  }
  function probs() { var p = []; if (!String(st.name).trim()) p.push('customer name'); if (!String(st.vehicle).trim()) p.push('vehicle'); if (!(st.end > st.start)) p.push('dates'); if (!(+st.daily > 0)) p.push('daily rate'); return p; }
  function preview(el) {
    clearTimeout(tm); tm = setTimeout(function () {
      var box = el.querySelector('#qt-live'); if (!box) return;
      var q = Object.assign({}, st, { no: old ? old.no : QuoteDoc.nextNo(qtList(), qtPrefix(), NOW()), at: old ? old.at : NOW(), name: st.name || 'Customer name', vehicle: st.vehicle || 'Vehicle' });
      if (!(q.end > q.start)) return;
      qtInput(q).then(function (inp) { box.innerHTML = QuoteDoc.svg(inp); });
      var t = el.querySelector('#qt-tot'); if (t) t.innerHTML = 'Total payable <b class="num">' + UI.fmt.money(qtCalc(st).total) + '</b>';
    }, 120);
  }
  var dr = UI.drawer({ title: old ? 'Edit ' + old.no : o.copy ? 'Copy quotation' : 'New quotation', subtitle: 'Pick the details. The page on the right is what the customer gets.', width: 1180, data: { id: id || 'new' },
    body: function (el) {
      el.innerHTML = '<div class="qt-split"><div class="qt-form">' +
        '<h4 class="qt-h">Customer</h4><div data-qt-cust></div>' +
        '<div class="qt-g2">' + UI.input({ key: 'name', label: 'Name', required: true, value: st.name, error: tried && !st.name.trim() ? 'Type the customer’s name' : '' }) + UI.input({ key: 'phone', label: 'Mobile', value: st.phone, placeholder: '012 345 6789' }) + '</div>' +
        UI.input({ key: 'company', label: 'Company (optional)', value: st.company, placeholder: 'For a company booking' }) +
        '<h4 class="qt-h">Car and dates</h4><div class="qt-g2">' + UI.dateTimeField({ key: 'start', label: 'Pick-up', value: st.start, chips: false }) + UI.dateTimeField({ key: 'end', label: 'Return', value: st.end, chips: false }) + '</div>' +
        '<div id="qt-days">' + daysHtml() + '</div><div data-qt-car></div>' +
        UI.input({ key: 'vehicle', label: 'Vehicle on the quotation', required: true, value: st.vehicle, placeholder: 'Perodua Alza 2024', help: 'The plate is not shown to the customer.', error: tried && !st.vehicle.trim() ? 'Pick a car or type the vehicle' : '' }) +
        '<h4 class="qt-h">Rates</h4><div class="qt-g2">' + money('daily', 'Daily rate') + money('deposit', 'Refundable deposit') + '</div>' +
        UI.select({ key: 'cover', label: 'Damage cover', value: st.cover ? st.cover.name : '', options: [{ value: '', label: 'None' }].concat(d.damagePackages.map(function (p) { return { value: p.name, label: p.name + ' (' + UI.fmt.money(p.daily) + ' a day)' }; })) }) +
        '<h4 class="qt-h">Delivery and return</h4><div class="qt-g2">' + UI.select({ key: 'startOpt', label: 'Pick-up', value: st.startOpt, options: opts('start') }) + money('delivery', 'Delivery charge') + UI.select({ key: 'endOpt', label: 'Return', value: st.endOpt, options: opts('end') }) + money('retFee', 'Return charge') + '</div>' +
        '<h4 class="qt-h">Other charges and discount</h4><div id="qt-x">' + extrasHtml() + '</div>' + money('discount', 'Discount') +
        UI.textarea({ key: 'notes', label: 'Extra notes on the quotation (optional)', value: st.notes, placeholder: 'One note a line. They are added under Terms and notes.' }) +
        '</div><div class="qt-side"><div class="qt-sticky"><div class="qt-tot" id="qt-tot"></div><div class="qt-paper" id="qt-live"></div></div></div></div>';
      carCtl = UI.carPicker(el.querySelector('[data-qt-car]'), { key: 'car', label: 'Car (optional)', value: st.car || null, start: st.start, end: st.end, onChange: function (cid, c) {
        st.car = cid || ''; if (c) { st.vehicle = qtVehicle(c); st.daily = c.rate; st.deposit = c.deposit; ['vehicle', 'daily', 'deposit'].forEach(function (k) { var f = el.querySelector('[data-key="' + k + '"]'); if (f) f.value = k === 'vehicle' ? st.vehicle : (+st[k]).toFixed(2); }); }
        preview(el); } });
      UI.combo(el.querySelector('[data-qt-cust]'), { key: 'cust', label: 'Saved customer (optional)', placeholder: 'Search by name or phone', title: 'Find a customer', value: st.cust || '', recentKey: 'qt-cust-' + B().id,
        items: function () { return d.people.map(function (p) { return { value: p.id, label: p.name, sub: p.phone, kw: p.phone.replace(/\D/g, ''), badge: p.blacklist ? { text: 'Blacklisted', tone: 'bad' } : null }; }); },
        onChange: function (cid) { var p = cid ? byId(d.people, cid) : null; st.cust = cid || ''; if (p) { st.name = p.name; st.phone = p.phone; el.querySelector('[data-key="name"]').value = p.name; el.querySelector('[data-key="phone"]').value = p.phone; if (p.blacklist) UI.toast(p.name + ' is blacklisted. Check before you quote.', { tone: 'warn' }); } preview(el); } });
      preview(el);
    },
    foot: [{ label: 'Cancel', kind: 'g' }, { label: old ? 'Save' : 'Make the quotation', icon: 'file-text', onClick: function (x) {
      tried = true; var p = probs();
      if (p.length) { UI.toast('Still needed: ' + p.join(', ') + '.', { tone: 'warn' }); return false; }
      st.extras = st.extras.filter(function (e) { return String(e.text || '').trim() && +e.qty > 0 && e.rate !== ''; });
      ['name', 'company', 'phone', 'vehicle', 'notes'].forEach(function (k) { st[k] = String(st[k] || '').trim(); });
      var q;
      if (old) { q = DB.update('quotes', old, Object.assign({}, st, { updatedAt: NOW() }), { where: 'Quotation', text: DB.actor() + ' changed quotation ' + old.no }); UI.toast('Quotation updated.'); }
      else { q = DB.add('quotes', Object.assign({}, st, { no: QuoteDoc.nextNo(qtList(), qtPrefix(), NOW()), at: NOW(), by: DB.actor(), status: 'Draft' }), { first: true, where: 'Quotation', text: DB.actor() + ' made quotation for ' + st.name }); UI.toast('Quotation ' + q.no + ' made.'); }
      setTimeout(function () { qtOpen(q.id); }, 0);
    } }],
    dirty: function () { return JSON.stringify(st) !== base; } });
  var el = dr.body;
  dr.el.addEventListener('input', function (ev) {
    var k = ev.target.getAttribute('data-key'); if (!k) return;
    var mx = /^x-(text|qty|rate)-(\d+)$/.exec(k);
    if (mx) { var row = st.extras[+mx[2]]; if (row) row[mx[1]] = mx[1] === 'text' ? ev.target.value : ev.target.value === '' ? '' : +ev.target.value; }
    else if (k === 'start' || k === 'end') { var dt = UI.parseDate(ev.target.value); if (dt && !isNaN(dt)) { st[k] = dt; if (k === 'start' && !(st.end > st.start)) { st.end = new Date(st.start.getTime() + DAY); UI.setDateField(el.querySelector('[data-key="end"]'), st.end, true); } if (carCtl) carCtl.setDates(st.start, st.end); el.querySelector('#qt-days').innerHTML = daysHtml(); } }
    else if (k === 'cover') { var pk = d.damagePackages.filter(function (p) { return p.name === ev.target.value; })[0]; st.cover = pk ? { name: pk.name, daily: pk.daily } : null; }
    else if (k === 'startOpt' || k === 'endOpt') { st[k] = ev.target.value; var hit = handoverOptions(k === 'startOpt' ? 'start' : 'end').filter(function (x) { return x.value === ev.target.value; })[0], fk = k === 'startOpt' ? 'delivery' : 'retFee'; if (hit && hit.fee != null) { st[fk] = hit.fee; el.querySelector('[data-key="' + fk + '"]').value = (+hit.fee).toFixed(2); } }
    else if (['daily', 'deposit', 'delivery', 'retFee', 'discount'].indexOf(k) >= 0) st[k] = Math.max(0, +ev.target.value || 0);
    else if (k in st) st[k] = ev.target.value;
    if (k === 'daily' || k === 'start' || k === 'end') el.querySelector('#qt-days').innerHTML = daysHtml();
    preview(el);
  });
  dr.el.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'cover' || k === 'startOpt' || k === 'endOpt') ev.target.dispatchEvent(new Event('input', { bubbles: true })); });
  dr.el.addEventListener('click', function (ev) {
    var a = ev.target.closest('[data-xadd],[data-xdel],[data-dstep],[data-dauto]'); if (!a) return;
    if (a.hasAttribute('data-xadd')) { st.extras.push({ text: '', qty: 1, rate: '' }); el.querySelector('#qt-x').innerHTML = extrasHtml(); var t = el.querySelectorAll('[data-key^="x-text-"]'); if (t.length) t[t.length - 1].focus(); }
    else if (a.hasAttribute('data-xdel')) { st.extras.splice(+a.getAttribute('data-xdel'), 1); el.querySelector('#qt-x').innerHTML = extrasHtml(); }
    else if (a.hasAttribute('data-dstep')) { var x = qtCalc(st); st.days = Math.max(1, x.days + +a.getAttribute('data-dstep')); if (st.days === x.autoDays) st.days = null; el.querySelector('#qt-days').innerHTML = daysHtml(); }
    else { st.days = null; el.querySelector('#qt-days').innerHTML = daysHtml(); }
    preview(el);
  });
  return dr;
}

function qtSetUp() {
  var co = D().company || {};
  UI.drawer({ title: 'Quotation set-up', subtitle: 'Used on every quotation', width: 520,
    body: '<div class="col gap16">' + UI.input({ key: 'pre', label: 'Number starts with', value: qtPrefix(), help: 'Next: ' + QuoteDoc.nextNo(qtList(), qtPrefix(), NOW()) }) +
      UI.textarea({ key: 'notes', label: 'Standing notes (one a line)', value: co.quoteNotes || '', rows: 5, placeholder: 'Prices include fuel at the same level as pick-up.', help: 'Added under Terms and notes on every quotation.' }) +
      UI.alert('Logo, company name, address and bank account come from Settings > Company details.', 'info') + '</div>',
    foot: [{ label: 'Cancel', kind: 'g' }, { label: 'Save', icon: 'check', onClick: function (x) {
      var f = UI.form(x.body), pre = String(f.pre || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!pre) { UI.toast('Type what the numbers start with.', { tone: 'warn' }); return false; }
      co.quotePrefix = pre; co.quoteNotes = String(f.notes || '').trim(); DB.log('Changed', 'Settings', 'quotes', DB.actor() + ' changed the quotation set-up'); UI.toast('Saved.'); if (CUR && CUR.ctx) render();
    } }] });
}

PAGES['quotes'] = {
  title: 'Quotations',
  render: function (root, ctx) {
    var st = ctx.state; st.f = st.f || { status: 'open' };
    var list = qtList();
    root.innerHTML = '<div class="pg-h"><div><h1>Quotations</h1><p>Pick the customer, car, dates and charges. FMS makes the quotation in your company format, ready to download or send.</p></div><div class="acts">' +
      (can('users.manage') || can('billing.settings') ? UI.btn('Set-up', { icon: 'settings', kind: 'g', attrs: { 'data-qt-set': 1 } }) : '') + (qtCanMake() ? UI.btn('New quotation', { icon: 'plus', attrs: { 'data-qt-new': 1 } }) : '') + '</div></div>' +
      '<div class="card"><div id="qt-f"></div><div id="qt-t"></div></div>';
    var rows = function () {
      var q = (st.f.q || '').trim(), s = st.f.status || 'open';
      return list.filter(function (r) { return (s === 'all' || (s === 'open' ? r.status === 'Draft' || r.status === 'Sent' : r.status === s)) && (!q || UI.wordsMatch([r.no, r.name, r.company, r.phone, r.phone.replace(/\D/g, ''), r.vehicle, (carById(r.car) || {}).plate].join(' '), q)); });
    };
    var t = UI.table(root.querySelector('#qt-t'), {
      rows: rows(), rowKey: 'id', pageSize: st.size || 10, pageSizes: [10, 25, 50], sort: st.sort || { key: 'at', dir: 'desc' }, onSort: function (s) { st.sort = s; }, noun: 'quotation',
      onRowClick: function (r) { qtOpen(r.id); },
      columns: [
        { key: 'no', label: 'Quotation No.', sort: true, render: function (r) { return '<b class="num">' + esc(r.no) + '</b><div class="b2">' + esc(UI.fmt.date(r.at)) + '</div>'; } },
        { key: 'name', label: 'Customer', sort: true, render: function (r) { return '<b>' + esc(r.name) + '</b><div class="b2">' + esc(r.company || r.phone || '') + '</div>'; } },
        { key: 'vehicle', label: 'Vehicle', sort: true, render: function (r) { return esc(r.vehicle) + (r.car && carById(r.car) ? '<div class="b2">' + esc(carById(r.car).plate) + '</div>' : ''); } },
        { key: 'start', label: 'Pick-up', sort: true, align: 'center', nowrap: true, render: function (r) { return esc(UI.fmt.dt(r.start)); } },
        { key: 'days', label: 'Days', align: 'center', sort: function (r) { return qtCalc(r).days; }, render: function (r) { return '<span class="num">' + qtCalc(r).days + '</span>'; } },
        { key: 'total', label: 'Total payable', money: true, sort: function (r) { return qtCalc(r).total; }, render: function (r) { return UI.money(qtCalc(r).total); } },
        { key: 'status', label: 'Status', align: 'center', sort: true, render: function (r) { return UI.chip(r.status, QT_TONE[r.status]) + (r.booking ? '<div class="b2">' + esc(r.booking) + '</div>' : ''); } }
      ],
      empty: { icon: 'file-text', title: 'No quotations here.', text: st.f.q ? 'Try another name, phone or number.' : 'Make one for a customer who asks for a price.', action: qtCanMake() && !st.f.q ? UI.btn('New quotation', { icon: 'plus', attrs: { 'data-qt-new': 1 } }) : '' },
      card: function (r) { return '<div class="qt-card"><div><b>' + esc(r.name) + '</b> ' + UI.chip(r.status, QT_TONE[r.status]) + '</div><div class="b2">' + esc(r.no) + ' · ' + esc(r.vehicle) + '</div><div class="b2">' + esc(UI.fmt.dt(r.start)) + ' · ' + plural(qtCalc(r).days, 'day') + '</div><b class="num">' + UI.fmt.money(qtCalc(r).total) + '</b></div>'; }
    });
    UI.filters(root.querySelector('#qt-f'), { values: st.f, fields: [{ type: 'search', key: 'q', placeholder: 'Name, phone, number or car' }, { type: 'select', key: 'status', all: false, label: 'Status', options: [{ value: 'open', label: 'Open (draft and sent)' }, { value: 'Booked', label: 'Booked' }, { value: 'Cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }] }],
      onChange: function () { t.setRows(rows()); }, extra: '<span class="grow"></span><span class="b2">' + plural(list.length, 'quotation') + '</span>' });
    UI.on(root, 'click', '[data-qt-new]', function () { qtForm(null); });
    UI.on(root, 'click', '[data-qt-set]', function () { qtSetUp(); });
    if (ctx.params.quote) setTimeout(function () { ctx.params.quote === 'new' ? qtForm(null) : qtOpen(ctx.params.quote); }, 0);
  },
  search: [{ label: 'New quotation', icon: 'file-plus', run: function () { go('quotes', { quote: 'new' }); } }]
};

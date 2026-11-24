/* ===================================================================
   Page: Expenses (#page=expenses)   Owner: builder 2
   Everything the business spent in a month, from three sources: what the team recorded, finished service jobs and
   car papers (both from Maintenance). Add / change sheet, detail drawer, categories manager, Excel.
   =================================================================== */
var EXP_QUICK = ['Fuel', 'Toll', 'Parking', 'Grab fare', 'Bolt fare', 'Car wash'];
var EXP_ICONS = ['gas-station', 'road', 'parking', 'car', 'droplet', 'spray', 'truck-delivery', 'building', 'users', 'percentage', 'license', 'shield', 'clipboard-check', 'hammer', 'tool', 'battery', 'file-alert', 'gavel', 'device-mobile', 'wifi', 'bulb', 'speakerphone', 'apps', 'calculator', 'building-bank', 'paperclip', 'tools-kitchen-2', 'calendar-dollar', 'truck', 'armchair', 'certificate', 'receipt', 'coffee', 'key', 'first-aid-kit', 'dots'];
function expCats() { return D().expenseCats.slice().sort(function (a, b) { return a.order - b.order; }); }
function expCat(id) { return byId(D().expenseCats, id); }
function expIcon(e) { if (e.source === 'job') return 'tool'; if (e.source === 'paper') return 'file-certificate'; var c = expCat(e.cat); return c ? c.icon : 'receipt'; }
function expMonthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function expMonthOf(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, 1); }
function expMonthName(d) { return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }); }
function expCanAll() { return can('expenses.view_all'); }
/* who may change or delete this entry, and for how long */
function expEditInfo(e) {
  if (e.source !== 'recorded') return { ok: false, why: 'Change it in Maintenance, where it is kept.' };
  if (can('expenses.edit_all')) return { ok: true, note: 'You can change or delete any expense.' };
  var mine = me() && e.by === me().id;
  if (!mine) return { ok: false, why: 'Only the person who recorded it, or someone allowed to change everyone\'s expenses, can change it.' };
  if (!can('expenses.edit_own')) return { ok: false, why: 'Your account cannot change expenses after they are saved.' };
  var left = 24 * 36e5 - (NOW() - e.at);
  if (left <= 0) return { ok: false, why: 'Locked: an expense can be changed or deleted for 24 hours after it is recorded. Ask the owner if it is wrong.' };
  var h = Math.max(1, Math.ceil(left / 36e5));
  return { ok: true, note: 'You can change or delete this for ' + (h === 1 ? 'less than an hour' : h + ' hours') + ' more.' };
}
function expAllowedCat(c) { return c.group === 'Office and admin' ? can('expenses.add_business') : can('expenses.add') || can('expenses.add_business'); }
/* a made-up receipt picture for entries that have a receipt but no photo in the sample */
function expReceiptSvg(e) {
  var shop = e.paidTo || rptExpName(e), c = rptCarOf(e.car), lines = [[rptExpName(e), e.amount]];
  var esc2 = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520"><rect width="360" height="520" fill="#fbfaf6"/><g font-family="monospace" fill="#222" font-size="14"><text x="180" y="50" text-anchor="middle" font-size="18" font-weight="bold">' + esc2(shop.toUpperCase().slice(0, 24)) + '</text><text x="180" y="72" text-anchor="middle" font-size="11">SAMPLE RECEIPT - NOT A REAL SHOP</text><text x="30" y="110">' + esc2(UI.fmt.date(e.day)) + '</text><text x="330" y="110" text-anchor="end">' + esc2(invDT(e.at).split(', ')[1] || '') + '</text><line x1="30" y1="125" x2="330" y2="125" stroke="#999" stroke-dasharray="4 3"/>' + lines.map(function (l, k) { return '<text x="30" y="' + (155 + k * 24) + '">' + esc2(l[0].slice(0, 26)) + '</text><text x="330" y="' + (155 + k * 24) + '" text-anchor="end">' + l[1].toFixed(2) + '</text>'; }).join('') + (c ? '<text x="30" y="190" font-size="12">Vehicle ' + esc2(c.plate) + '</text>' : '') + '<line x1="30" y1="215" x2="330" y2="215" stroke="#999" stroke-dasharray="4 3"/><text x="30" y="245" font-weight="bold" font-size="16">TOTAL RM</text><text x="330" y="245" text-anchor="end" font-weight="bold" font-size="16">' + e.amount.toFixed(2) + '</text><text x="30" y="275" font-size="12">Paid by ' + esc2(e.method || 'Cash') + '</text><text x="180" y="470" text-anchor="middle" font-size="12">Thank you</text></g></svg>');
}
function expReceiptSrc(e) { var r = e.receipt; if (!r) return ''; if (r.dataUrl) return r.dataUrl; return expReceiptSvg(e); }
function expViewReceipt(e) {
  var r = e.receipt, src = expReceiptSrc(e), pdf = /pdf/.test(r.type || '') || /\.pdf$/i.test(r.name || '');
  UI.dialog({ title: 'Receipt', subtitle: r.name + ' · ' + rptExpName(e) + ' ' + UI.fmt.money(e.amount), width: 'md',
    body: '<div class="exp-rv">' + (pdf && !r.dataUrl ? '<div class="exp-rv-pdf">' + i('file-type-pdf') + '<b>' + esc(r.name) + '</b><span class="b2">PDF · ' + UI.fmt.size(r.size || 0) + '</span></div>' : pdf ? '<iframe src="' + r.dataUrl + '" title="Receipt"></iframe>' : '<img src="' + src + '" alt="Receipt">') + '</div>',
    buttons: [{ label: 'Close', kind: 'g' }, { label: 'Save', icon: 'download', close: false, onClick: function () {
      if (r.dataUrl) { fetch(r.dataUrl).then(function (x) { return x.blob(); }).then(function (bl) { UI.download({ filename: r.name, data: bl, mime: bl.type }); }); }
      else if (pdf) { UI.toast('The sample keeps only the name of this PDF.', { tone: 'info' }); }
      else UI.download({ filename: (r.name || 'receipt').replace(/\.[a-z]+$/i, '') + '.svg', data: decodeURIComponent(src.split(',')[1]), mime: 'image/svg+xml' });
    } }] });
}

/* ---------- detail drawer ---------- */
function expOpen(id) {
  var e = allExpenses(D()).filter(function (x) { return x.id === id; })[0];
  if (!e) { UI.toast('That expense is not here any more', { tone: 'warn' }); return; }
  var c = expCat(e.cat), car = rptCarOf(e.car);
  var body = function () {
    e = allExpenses(D()).filter(function (x) { return x.id === id; })[0] || e;
    var ed = expEditInfo(e), x = e.booking ? findBooking(e.booking) : null, rc = e.receipt, cat = expCat(e.cat);
    car = rptCarOf(e.car);
    var h = '<div class="exp-facts">' + UI.kv('Day', esc(e.day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))) +
      UI.kv('Kind', esc(rptExpName(e)) + ' ' + (e.source === 'recorded' ? UI.chip(cat ? cat.group : 'Everyday', cat && cat.group === 'Office and admin' ? 'info' : 'pri') : UI.chip(e.source === 'job' ? 'Service job' : 'Paper', 'grey'))) +
      UI.kv('Car', car ? esc(car.plate) + '<small>' + esc(carName(car)) + '</small>' : 'Not tied to a car') +
      UI.kv('Booking', x ? '<button type="button" class="exp-bk" data-bk="' + esc(x.code) + '">' + esc(x.code) + i('external-link') + '</button><small>' + esc(x.cust.name) + '</small>' : 'None') +
      UI.kv('Paid with', esc(e.method || '-')) + UI.kv(e.source === 'recorded' ? 'Paid to' : 'Details', esc(e.source === 'recorded' ? e.paidTo || '-' : [e.paidTo, e.note].filter(Boolean).join(' · ') || '-')) +
      (e.source === 'recorded' && e.note ? UI.kv('Note', esc(e.note)) : '') + '</div>';
    h += '<section class="exp-sec"><h4>Receipt</h4>';
    if (e.source !== 'recorded') h += '<p class="b2">The receipt is kept with the ' + (e.source === 'job' ? 'service record' : 'paper') + '.</p>' + (rc ? '<div class="exp-rc"><span class="exp-rc-th">' + i('file-type-pdf') + '</span><div class="grow"><b>' + esc(rc.name) + '</b><small>PDF · ' + UI.fmt.size(rc.size || 0) + '</small></div></div>' : '');
    else if (rc) h += '<div class="exp-rc"><button type="button" class="exp-rc-th" data-view>' + (/pdf/.test(rc.type || '') || /\.pdf$/i.test(rc.name) ? i('file-type-pdf') : '<img src="' + expReceiptSrc(e) + '" alt="">') + '</button><div class="grow"><b>' + esc(rc.name) + '</b><small>' + (/pdf/i.test(rc.type || rc.name) ? 'PDF' : 'Photo') + ' · ' + UI.fmt.size(rc.size || 0) + '</small></div>' + UI.btn('View', { kind: 'tonal', size: 'sm', attrs: { 'data-view': '1' } }) + '</div>' + (ed.ok ? '<div class="row gap8 wrap">' + UI.btn('Replace receipt', { kind: 't', size: 'sm', icon: 'replace', attrs: { 'data-rep': '1' } }) + UI.btn('Remove receipt', { kind: 't', size: 'sm', icon: 'trash', cls: 'exp-danger', attrs: { 'data-rmr': '1' } }) + '</div>' : '');
    else h += '<p class="b2">No receipt was added.</p>' + (ed.ok ? UI.btn('Add a receipt', { kind: 'tonal', size: 'sm', icon: 'paperclip', attrs: { 'data-rep': '1' } }) : '');
    h += '</section>';
    if (e.source === 'recorded') h += '<section class="exp-sec"><p class="b2">Recorded by ' + esc(rptWho(e)) + ' on ' + esc(invDT(e.at)) + '. Deleted entries stay in the activity log.</p><p class="exp-edit ' + (ed.ok ? 'ok' : '') + '">' + i(ed.ok ? 'clock' : 'lock') + esc(ed.ok ? ed.note : ed.why) + '</p></section>';
    else h += '<section class="exp-sec">' + UI.alert('Shown here from ' + (e.source === 'job' ? 'service jobs' : 'car papers') + '. It is counted once.', 'info') + '</section>';
    return h;
  };
  var foot = function () {
    if (e.source !== 'recorded') return [{ label: 'Close', kind: 'o' }, { label: 'Open in Maintenance', icon: 'tool', onClick: function () { if (e.source === 'job') API.openJob(e.ref); else API.carHealth(e.car); } }];
    var ed = expEditInfo(e);
    return '<div class="exp-foot">' + UI.btn('Change', { icon: 'pencil', disabled: !ed.ok, attrs: { 'data-chg': '1', title: ed.ok ? '' : ed.why } }) + UI.btn('Delete', { kind: 'err', icon: 'trash', disabled: !ed.ok, attrs: { 'data-del': '1', title: ed.ok ? '' : ed.why } }) + '</div>';
  };
  var head = function () { return '<div class="exp-dh"><span class="exp-tile big">' + i(expIcon(e)) + '</span><div><h2>' + esc(rptExpName(e)) + '</h2><b class="exp-dh-v">' + UI.money(e.amount) + '</b></div></div>'; };
  var dr = UI.drawer({ title: rptExpName(e), headerHtml: head(), width: 520, body: body, foot: foot() });
  var off = on('data', function (ev) { if (dr.closed) { off(); return; } if (!ev || ev.coll === 'expenses' || ev.coll === 'expenseCats') { if (!allExpenses(D()).filter(function (x) { return x.id === id; })[0]) { dr.close(true); return; } dr.refresh(); dr.setHeader(head()); dr.setFoot(foot()); } });
  var pickReceipt = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.pdf';
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; if (f.size > 10 * 1048576) { UI.toast('That file is bigger than 10 MB', { tone: 'warn' }); return; } UI.readImage(f, { max: 1600 }).then(function (img) { DB.update('expenses', byId(D().expenses, id), { receipt: img }, { where: 'Expense', text: me().name + ' ' + (e.receipt ? 'replaced' : 'added') + ' the receipt of an expense (' + rptExpName(e) + ' ' + UI.fmt.money(e.amount) + ')' }); UI.toast(e.receipt ? 'Receipt replaced' : 'Receipt added'); }); };
    inp.click();
  };
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if ((b = t.closest('[data-bk]'))) { API.openBooking(b.getAttribute('data-bk')); return; }
    if (t.closest('[data-view]')) { expViewReceipt(e); return; }
    if (t.closest('[data-rep]')) { pickReceipt(); return; }
    if (t.closest('[data-rmr]')) { UI.confirm({ title: 'Remove the receipt?', text: 'The expense stays; only the picture of the receipt is removed.', ok: 'Remove', danger: true }).then(function (y) { if (y) { DB.update('expenses', byId(D().expenses, id), { receipt: null }, { where: 'Expense', text: me().name + ' removed the receipt of an expense (' + rptExpName(e) + ')' }); UI.toast('Receipt removed'); } }); return; }
    if (t.closest('[data-chg]')) { dr.close(true); expSheet(byId(D().expenses, id)); return; }
    if (t.closest('[data-del]')) {
      UI.confirm({ title: 'Delete this expense?', text: rptExpName(e) + ', ' + UI.fmt.money(e.amount) + ' on ' + UI.fmt.date(e.day) + '. It is taken off the totals. The activity log keeps a note of it.', ok: 'Delete', cancel: 'Keep it', danger: true }).then(function (y) {
        if (!y) return; var rec = byId(D().expenses, id);
        D().instalments.forEach(function (it) { if (it.paid && it.paid.expense === id) it.paid.expense = null; });
        DB.remove('expenses', rec, { where: 'Expense', text: me().name + ' deleted an expense: ' + rptExpName(e) + ' ' + UI.fmt.money(e.amount) + ' on ' + UI.fmt.date(e.day) });
        dr.close(true); UI.toast('Expense deleted');
      });
    }
  });
  return dr;
}

/* ---------- add / change sheet ---------- */
var EXP_LAST = null;
function expSheet(rec, prefill) {
  var edit = !!rec, today = new Date(NOW().getFullYear(), NOW().getMonth(), NOW().getDate()), yest = new Date(today.getTime() - DAY);
  var blank = function () { return { day: null, amount: '', cat: '', car: '', booking: '', method: 'Cash', paidTo: '', note: '', receipt: null }; };
  var st = rec ? { day: rec.day, amount: String(rec.amount), cat: rec.cat, car: rec.car || '', booking: rec.booking || '', method: rec.method || 'Cash', paidTo: rec.paidTo || '', note: rec.note || '', receipt: rec.receipt } : Object.assign(blank(), prefill || {});
  var start = JSON.stringify(st), saved = 0;
  var cats = function () { return expCats().filter(function (c) { return (!c.hidden || c.id === st.cat) && (expAllowedCat(c) || c.id === st.cat); }); };
  var dayErr = function () { if (!st.day) return ''; if (st.day > new Date(today.getTime() + DAY)) return 'Not more than 1 day ahead.'; if (st.day < new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())) return 'Not more than 10 years back.'; return ''; };
  var amt = function () { var v = Number(String(st.amount).replace(/,/g, '')); return isFinite(v) ? v : 0; };
  var ready = function () { return st.day && !dayErr() && amt() > 0 && /^\d+(\.\d{0,2})?$/.test(String(st.amount).replace(/,/g, '').trim()) && st.cat; };
  var keep = function (el) { var f = UI.form(el); ['amount', 'car', 'booking', 'paidTo', 'note', 'cat'].forEach(function (k) { if (f[k] !== undefined) st[k] = f[k]; }); if (f.dayPick) { var p = f.dayPick.split('-'); st.day = new Date(+p[0], +p[1] - 1, +p[2]); } };
  var body = function () {
    var cs = cats(), quick = EXP_QUICK.map(function (n) { return cs.filter(function (c) { return c.name === n; })[0]; }).filter(Boolean), cat = expCat(st.cat), de = dayErr();
    var isT = st.day && +st.day === +today, isY = st.day && +st.day === +yest;
    var bks = D().bookings.filter(function (x) { return x.status !== 'Cancelled' && Math.abs(x.start - NOW()) < 75 * DAY; }).sort(function (a, b) { return b.start - a.start; });
    var h = '<div class="exp-f"><label class="exp-l">Which day was it spent? <em>*</em></label><div class="exp-days"><button type="button" class="exp-day" data-day="t" aria-pressed="' + !!isT + '"><b>Today</b><small>' + esc(today.getDate() + ' ' + today.toLocaleString('en-GB', { month: 'short' })) + '</small></button><button type="button" class="exp-day" data-day="y" aria-pressed="' + !!isY + '"><b>Yesterday</b><small>' + esc(yest.getDate() + ' ' + yest.toLocaleString('en-GB', { month: 'short' })) + '</small></button></div>' +
      UI.input({ id: 'exp-dp', key: 'dayPick', type: 'date', value: st.day && !isT && !isY ? rptIso(st.day) : '', help: de ? '' : 'Or pick any other day on the calendar.', error: de, attrs: { 'aria-label': 'Or pick another day' } }) + '</div>';
    h += UI.input({ id: 'exp-amt', key: 'amount', label: 'Amount', required: true, prefix: 'RM', value: st.amount, placeholder: '0.00', attrs: { inputmode: 'decimal' }, error: st.amount !== '' && !(amt() > 0 && /^\d+(\.\d{0,2})?$/.test(String(st.amount).replace(/,/g, '').trim())) ? 'Type an amount above 0, with at most 2 decimals.' : '' });
    h += '<div class="exp-f"><label class="exp-l">What was it for? <em>*</em></label><div class="exp-qc">' + quick.map(function (c) { return '<button type="button" class="exp-chip" data-qc="' + c.id + '" aria-pressed="' + (st.cat === c.id) + '">' + i(c.icon) + esc(c.name) + '</button>'; }).join('') + '</div>' +
      UI.select({ id: 'exp-cat', key: 'cat', placeholder: 'Choose a kind of expense', value: st.cat, aria: 'Kind of expense', options: cs.map(function (c) { return { value: c.id, label: c.name + (c.hidden ? ' (hidden)' : ''), group: c.group }; }) }) +
      (cat && cat.alsoKept ? UI.alert(cat.name + ' is also kept on a service record or a car paper in Maintenance. Enter the price in one place only, so it is not counted twice.', 'warn') : '') + '</div>';
    h += UI.select({ id: 'exp-car', key: 'car', label: 'Car', placeholder: 'No car (leave empty if no car)', value: st.car, options: D().cars.map(function (c) { return [c.id, c.plate + ' · ' + carName(c)]; }) });
    h += UI.select({ id: 'exp-bk', key: 'booking', label: 'Booking', placeholder: 'No booking (optional)', value: st.booking, options: bks.map(function (x) { return [x.code, x.code + ' · ' + x.cust.name + ' · ' + x.car.plate]; }) });
    h += '<div class="exp-f"><label class="exp-l">Paid with</label><div class="exp-qc">' + [['Cash', 'cash'], ['Card', 'credit-card'], ['Bank transfer', 'building-bank'], ['E-wallet', 'device-mobile'], ['Other', 'dots']].map(function (m) { return '<button type="button" class="exp-chip" data-pm="' + m[0] + '" aria-pressed="' + (st.method === m[0]) + '">' + i(m[1]) + m[0] + '</button>'; }).join('') + '</div></div>';
    h += UI.input({ id: 'exp-pt', key: 'paidTo', label: 'Paid to (optional)', value: st.paidTo, placeholder: 'Shop, station, driver or company', maxlength: 80 });
    h += UI.textarea({ id: 'exp-note', key: 'note', label: 'Note (optional)', value: st.note, rows: 2, maxlength: 300, placeholder: 'Anything that helps later, for example why it was needed' }) + '<p class="exp-cnt b2" ' + (st.note.length > 240 ? '' : 'hidden') + '>' + st.note.length + ' of 300</p>';
    h += '<div class="exp-f"><label class="exp-l">Receipt (optional)</label>' + (st.receipt ? '<div class="exp-rc">' + (st.receipt.dataUrl && !/pdf/.test(st.receipt.type || '') ? '<span class="exp-rc-th"><img src="' + st.receipt.dataUrl + '" alt=""></span>' : '<span class="exp-rc-th">' + i(/pdf/i.test(st.receipt.type || st.receipt.name) ? 'file-type-pdf' : 'photo') + '</span>') + '<div class="grow"><b>' + esc(st.receipt.name) + '</b><small>' + UI.fmt.size(st.receipt.size || 0) + '</small></div>' + UI.btn('Remove', { kind: 't', size: 'sm', attrs: { 'data-rmrc': '1' } }) + '</div>' : '<div class="row gap8 wrap">' + UI.btn('Choose photo or PDF', { kind: 'tonal', size: 'sm', icon: 'photo-plus', attrs: { 'data-pick': '1' } }) + UI.btn('Take a photo', { kind: 'tonal', size: 'sm', icon: 'camera', cls: 'exp-cam', attrs: { 'data-cam': '1' } }) + '</div>') + '</div>';
    return h;
  };
  var foot = function () {
    var ok = ready();
    return '<div class="exp-sf"><p class="b2">' + (ok ? (saved ? saved + ' saved so far.' : 'Ready to save.') : 'To save, choose the day, the amount and what it was for.') + '</p><div class="row gap8">' + UI.btn(edit ? 'Save changes' : 'Save', { icon: 'check', disabled: !ok, attrs: { 'data-save': '1' } }) + (edit ? '' : UI.btn('Save and add another', { kind: 'tonal', icon: 'plus', disabled: !ok, attrs: { 'data-save2': '1' } })) + '</div></div>';
  };
  var dr = UI.drawer({ title: edit ? 'Change expense' : 'Add expense', subtitle: edit ? rptExpName(rec) + ' · ' + UI.fmt.date(rec.day) : '', width: 520, body: body, foot: foot(),
    dirty: function () { keep(dr.body); return JSON.stringify(st) !== start; }, dirtyTitle: 'Leave without saving?' });
  dr.el.classList.add('exp-sheet');
  var redraw = function () { var sc = dr.body.scrollTop; dr.setBody(body); dr.body.scrollTop = sc; dr.setFoot(foot()); };
  dr.body.addEventListener('input', function (ev) { keep(dr.body); dr.setFoot(foot()); var c = dr.body.querySelector('.exp-cnt'); if (c && ev.target.getAttribute('data-key') === 'note') { c.hidden = st.note.length <= 240; c.textContent = st.note.length + ' of 300'; } });
  dr.body.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'dayPick' || k === 'cat') { keep(dr.body); redraw(); } });
  var pick = function (camera) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = camera ? 'image/*' : 'image/*,.pdf'; if (camera) inp.setAttribute('capture', 'environment');
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; if (f.size > 10 * 1048576) { UI.toast('That file is bigger than 10 MB', { tone: 'warn' }); return; } keep(dr.body); UI.readImage(f, { max: 1600 }).then(function (img) { st.receipt = img; redraw(); }); };
    inp.click();
  };
  var save = function (again) {
    keep(dr.body);
    if (!ready()) { UI.toast('Choose the day, the amount and what it was for', { tone: 'warn' }); redraw(); return; }
    var data = { day: st.day, amount: Math.round(amt() * 100) / 100, cat: st.cat, car: st.car || null, booking: st.booking || null, method: st.method, paidTo: st.paidTo.trim(), note: st.note.trim(), receipt: st.receipt };
    var c = expCat(st.cat);
    if (edit) { DB.update('expenses', rec, data, { where: 'Expense', text: me().name + ' changed an expense: ' + c.name + ' ' + UI.fmt.money(data.amount) + ' on ' + UI.fmt.date(data.day) }); start = JSON.stringify(st); dr.close(true); UI.toast('Changes saved'); return; }
    var sig = [+data.day, data.amount, data.cat, data.car].join('|');
    if (EXP_LAST && EXP_LAST.sig === sig && Date.now() - EXP_LAST.at < 6000) { UI.toast('That one was already saved a moment ago. Change something to save another.', { tone: 'warn' }); return; }
    EXP_LAST = { sig: sig, at: Date.now() };
    var n = D().expenses.length + 1; while (byId(D().expenses, 'exp-' + n)) n++;
    DB.add('expenses', Object.assign({ id: 'exp-' + n, by: me().id, at: NOW(), source: 'recorded', ref: null }, data), { first: true, where: 'Expense', text: me().name + ' recorded expense ' + c.name + ': ' + UI.fmt.money(data.amount) + (data.car ? ' (' + carById(data.car).plate + ')' : '') });
    saved++;
    if (again) { var keepDay = st.day, keepM = st.method; st = blank(); st.day = keepDay; st.method = keepM; start = JSON.stringify(st); dr.setBody(body); dr.body.scrollTop = 0; dr.setFoot(foot()); UI.toast('Saved. Add the next one.'); var a = dr.body.querySelector('[data-key="amount"]'); if (a) a.focus(); }
    else { start = JSON.stringify(st); dr.close(true); UI.toast('Expense saved'); }
  };
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if ((b = t.closest('[data-day]'))) { keep(dr.body); st.day = b.getAttribute('data-day') === 't' ? today : yest; redraw(); return; }
    if ((b = t.closest('[data-qc]'))) { keep(dr.body); st.cat = b.getAttribute('data-qc'); redraw(); return; }
    if ((b = t.closest('[data-pm]'))) { keep(dr.body); st.method = b.getAttribute('data-pm'); redraw(); return; }
    if (t.closest('[data-pick]')) { pick(false); return; }
    if (t.closest('[data-cam]')) { pick(true); return; }
    if (t.closest('[data-rmrc]')) { keep(dr.body); st.receipt = null; redraw(); return; }
    if (t.closest('[data-save]')) { save(false); return; }
    if (t.closest('[data-save2]')) { save(true); return; }
  });
  return dr;
}

/* ---------- categories manager ---------- */
function expCategories() {
  if (!can('expenses.manage_categories')) { UI.toast('You cannot change the categories. Ask the owner for "Manage expense categories".', { tone: 'warn' }); return; }
  var st = { edit: null, add: null };
  var form = function (f, isNew) {
    return '<div class="exp-cf" data-cf="' + (isNew ? 'new' : f.id) + '">' + UI.input({ id: 'cf-n', key: 'name', label: 'Name', value: f.name, placeholder: 'For example: Roadside help', maxlength: 60 }) +
      '<div class="inp"><label>Who can use it</label><div class="inv-radios exp-who">' + [['Everyday', 'Anyone who may add expenses can use it (fuel, toll, car wash...)'], ['Office and admin', 'Only people allowed to record office and admin costs (rent, insurance, salary...)']].map(function (g) { return '<button type="button" class="inv-radio" role="radio" data-grp="' + g[0] + '" aria-checked="' + (f.group === g[0]) + '"><span><b>' + g[0] + '</b><small>' + g[1] + '</small></span></button>'; }).join('') + '</div></div>' +
      '<div class="inp"><label>Icon</label><div class="exp-icons">' + EXP_ICONS.map(function (ic) { return '<button type="button" class="exp-ic" data-ic="' + ic + '" aria-pressed="' + (f.icon === ic) + '" aria-label="' + ic + '">' + i(ic) + '</button>'; }).join('') + '</div></div>' +
      UI.check({ id: 'cf-k', key: 'alsoKept', label: 'Also kept on a service record or a paper', checked: !!f.alsoKept }) + '<p class="b2 exp-cfh">Shows a reminder to enter the price in one place only, so it is not counted twice.</p>' +
      '<div class="row gap8 exp-cfb">' + UI.btn('Cancel', { kind: 'g', size: 'sm', attrs: { 'data-cfx': '1' } }) + UI.btn(isNew ? 'Add category' : 'Save', { size: 'sm', icon: 'check', attrs: { 'data-cfs': '1' } }) + '</div></div>';
  };
  var body = function () {
    var all = expCats();
    return '<p class="ui-ctext">What people choose from when they record an expense.</p>' + ['Everyday', 'Office and admin'].map(function (g) {
      var list = all.filter(function (c) { return c.group === g; });
      return '<section class="exp-cg"><h4>' + g + ' <span class="b2">' + list.length + '</span></h4>' + list.map(function (c, k) {
        if (st.edit && st.edit.id === c.id) return form(st.edit, false);
        return '<div class="exp-cr' + (c.hidden ? ' hid' : '') + '"><span class="exp-tile">' + i(c.icon) + '</span><span class="grow">' + esc(c.name) + (c.hidden ? ' ' + UI.chip('Hidden', 'grey') : '') + (c.alsoKept ? '<small>Also kept in Maintenance</small>' : '') + '</span>' +
          UI.iconBtn(c.hidden ? 'eye-off' : 'eye', c.hidden ? 'Hidden from the list. Press to show it.' : 'Shown in the list. Press to hide it.', { size: 'sm', attrs: { 'data-hide': c.id } }) + UI.iconBtn('pencil', 'Change', { size: 'sm', attrs: { 'data-ce': c.id } }) + UI.iconBtn('trash', 'Delete', { size: 'sm', attrs: { 'data-cd': c.id } }) +
          UI.iconBtn('arrow-up', 'Move up', { size: 'sm', attrs: { 'data-up': c.id, disabled: k === 0 ? 'disabled' : null } }) + UI.iconBtn('arrow-down', 'Move down', { size: 'sm', attrs: { 'data-dn': c.id, disabled: k === list.length - 1 ? 'disabled' : null } }) + '</div>';
      }).join('') + '</section>';
    }).join('') + (st.add ? form(st.add, true) : UI.btn('Add a category', { kind: 'tonal', icon: 'plus', attrs: { 'data-cadd': '1' } }));
  };
  var dl = UI.dialog({ title: 'Expense categories', width: 'md', body: body, buttons: [{ label: 'Done' }] });
  var cur = function () { return st.edit || st.add; };
  var redraw = function () { var sc = dl.body.scrollTop; dl.setBody(body); dl.body.scrollTop = sc; };
  var keepForm = function () { var el = dl.body.querySelector('[data-cf]'); if (!el || !cur()) return; var f = UI.form(el); cur().name = f.name; cur().alsoKept = f.alsoKept; };
  var move = function (id, dir) { var all = expCats(), c = byId(D().expenseCats, id), list = all.filter(function (x) { return x.group === c.group; }), k = list.indexOf(c), o = list[k + dir]; if (!o) return; var t = c.order; c.order = o.order; o.order = t; DB.log('Changed', 'Expense category', id, me().name + ' moved the expense category ' + c.name + ' ' + (dir < 0 ? 'up' : 'down')); emit('data', { coll: 'expenseCats' }); redraw(); };
  dl.el.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if ((b = t.closest('[data-hide]'))) { var c = byId(D().expenseCats, b.getAttribute('data-hide')); DB.update('expenseCats', c, { hidden: !c.hidden }, { where: 'Expense category', text: me().name + (c.hidden ? ' showed ' : ' hid ') + 'the expense category ' + c.name }); UI.toast(c.name + (c.hidden ? ' is hidden from the list' : ' is shown in the list')); redraw(); return; }
    if ((b = t.closest('[data-ce]'))) { var c2 = byId(D().expenseCats, b.getAttribute('data-ce')); st.add = null; st.edit = { id: c2.id, name: c2.name, group: c2.group, icon: c2.icon, alsoKept: c2.alsoKept }; redraw(); return; }
    if ((b = t.closest('[data-cd]'))) {
      var c3 = byId(D().expenseCats, b.getAttribute('data-cd')), used = D().expenses.filter(function (e) { return e.cat === c3.id; }).length;
      UI.confirm({ title: 'Delete ' + c3.name + '?', text: used ? used + ' saved expenses use it, so it cannot be deleted. Hide it instead: they keep their kind and it is no longer offered.' : 'It is no longer offered when people add an expense.', ok: used ? 'Hide it' : 'Delete', danger: !used }).then(function (y) {
        if (!y) return;
        if (used) { DB.update('expenseCats', c3, { hidden: true }, { where: 'Expense category', text: me().name + ' hid the expense category ' + c3.name }); UI.toast(c3.name + ' is hidden'); }
        else { DB.remove('expenseCats', c3, { where: 'Expense category', text: me().name + ' deleted the expense category ' + c3.name }); UI.toast('Category deleted'); }
        redraw();
      }); return;
    }
    if ((b = t.closest('[data-up]'))) { move(b.getAttribute('data-up'), -1); return; }
    if ((b = t.closest('[data-dn]'))) { move(b.getAttribute('data-dn'), 1); return; }
    if (t.closest('[data-cadd]')) { st.edit = null; st.add = { name: '', group: 'Everyday', icon: 'receipt', alsoKept: false }; redraw(); var n = dl.body.querySelector('[data-key="name"]'); if (n) n.focus(); return; }
    if ((b = t.closest('[data-grp]'))) { keepForm(); cur().group = b.getAttribute('data-grp'); redraw(); return; }
    if ((b = t.closest('[data-ic]'))) { keepForm(); cur().icon = b.getAttribute('data-ic'); redraw(); return; }
    if (t.closest('[data-cfx]')) { st.edit = st.add = null; redraw(); return; }
    if (t.closest('[data-cfs]')) {
      keepForm(); var f = cur(), nm = (f.name || '').trim();
      if (!nm) { UI.toast('Type a name for the category', { tone: 'warn' }); return; }
      if (D().expenseCats.some(function (x) { return x.name.toLowerCase() === nm.toLowerCase() && x.id !== f.id; })) { UI.toast('There is already a category called ' + nm, { tone: 'warn' }); return; }
      if (st.add) { var n2 = D().expenseCats.length + 1; while (byId(D().expenseCats, 'cat-' + n2)) n2++; DB.add('expenseCats', { id: 'cat-' + n2, name: nm, group: f.group, icon: f.icon, alsoKept: !!f.alsoKept, hidden: false, order: Math.max.apply(null, D().expenseCats.map(function (x) { return x.order; })) + 1 }, { where: 'Expense category', text: me().name + ' added the expense category ' + nm }); UI.toast('Category ' + nm + ' added'); }
      else { DB.update('expenseCats', byId(D().expenseCats, f.id), { name: nm, group: f.group, icon: f.icon, alsoKept: !!f.alsoKept }, { where: 'Expense category', text: me().name + ' changed the expense category ' + nm }); UI.toast('Category saved'); }
      st.edit = st.add = null; redraw();
    }
  });
}

/* ---------- the page ---------- */
PAGES['expenses'] = {
  title: 'Expenses',
  search: [{ label: 'Add Expense', icon: 'receipt-2', run: function () { expSheet(); } }, { label: 'Expense categories', icon: 'category', run: function () { go('expenses'); setTimeout(expCategories, 60); } }],
  render: function (root, ctx) {
    if (!ctx.can('expenses.view')) { root.innerHTML = UI.empty({ icon: 'lock', title: 'You do not have access to Expenses', text: 'Ask the owner to give your account the Expenses permission.' }); return; }
    var P = ctx.params, all = expCanAll(), uid = me() ? me().id : null, canAdd = ctx.can('expenses.add') || ctx.can('expenses.add_business');
    var nowM = expMonthKey(NOW()), mk = /^\d{4}-\d{2}$/.test(P.m || '') && P.m <= nowM ? P.m : nowM, m0 = expMonthOf(mk), m1 = new Date(m0.getFullYear(), m0.getMonth() + 1, 1), pm0 = new Date(m0.getFullYear(), m0.getMonth() - 1, 1);
    var src = allExpenses(D()).filter(function (e) { return all || (e.source === 'recorded' && e.by === uid); });
    var month = src.filter(function (e) { return e.day >= m0 && e.day < m1; }), prev = src.filter(function (e) { return e.day >= pm0 && e.day < m0; });
    var tot = sum(month.map(function (e) { return e.amount; })), ptot = sum(prev.map(function (e) { return e.amount; })), part = function (s) { return sum(month.filter(function (e) { return e.source === s; }).map(function (e) { return e.amount; })); };
    var vs = ptot ? Math.round(Math.abs(tot - ptot) / ptot * 100) + '% ' + (tot <= ptot ? 'less' : 'more') + ' than ' + expMonthName(pm0) + ' (' + UI.fmt.money(ptot) + ').' : 'Nothing in ' + expMonthName(pm0) + ' to compare with.';
    var grp = {}; month.forEach(function (e) { var k = rptExpGroup(e); grp[k] = grp[k] || { k: k, v: 0, icon: e.source === 'job' ? 'tool' : e.source === 'paper' ? 'file-certificate' : expIcon(e) }; grp[k].v += e.amount; });
    var kinds = Object.keys(grp).map(function (k) { return grp[k]; }).sort(function (a, b) { return b.v - a.v; }), showAll = ctx.state.allKinds;
    root.innerHTML = '<div class="exp-head"><div class="grow"><h1>Expenses</h1><p>' + (all ? 'Everything the business spent: what the team recorded, service jobs and car papers.' : 'The expenses you recorded. Add fuel, toll, car wash and other costs the moment you pay.') + '</p></div><div class="row gap8 wrap">' +
      (ctx.can('expenses.manage_categories') ? UI.btn('Categories', { kind: 'o', icon: 'category', attrs: { 'data-cats': '1' } }) : '') + (ctx.can('expenses.export') ? UI.btn('Excel', { kind: 'o', icon: 'file-spreadsheet', attrs: { 'data-xl': '1' } }) : '') + (canAdd ? UI.btn('Add expense', { icon: 'plus', cls: 'exp-addb', attrs: { 'data-add': '1' } }) : '') + '</div></div>' +
      '<div class="exp-month"><button type="button" class="ib" data-mon="-1" aria-label="Previous month">' + i('chevron-left') + '</button><b>' + esc(expMonthName(m0)) + '</b><button type="button" class="ib" data-mon="1" aria-label="Next month"' + (mk >= nowM ? ' disabled' : '') + '>' + i('chevron-right') + '</button>' + (mk !== nowM ? '<button type="button" class="inv-link" data-mon="0">This month</button>' : '') + '</div>' +
      '<div class="exp-sum"><div class="card exp-spent"><span class="b2">Spent in ' + esc(expMonthName(m0)) + '</span><b class="exp-big">' + UI.money(tot) + '</b><p class="b2">' + month.length + (month.length === 1 ? ' entry. ' : ' entries. ') + esc(vs) + '</p>' + (all ? '<div class="exp-parts">' + [['Recorded', part('recorded'), 'By the team', 'recorded'], ['Service jobs', part('job'), 'From Maintenance', 'job'], ['Papers', part('paper'), 'Road tax, insurance', 'paper']].map(function (p) { return '<button type="button" data-srcpart="' + p[3] + '"><span>' + p[0] + '</span><b>' + UI.money(p[1]) + '</b><small>' + p[2] + '</small></button>'; }).join('') + '</div>' : '<p class="exp-own">' + i('user') + 'This page shows the expenses you recorded yourself.</p>') + '</div>' +
      '<div class="card exp-where"><h3>Where the money went</h3>' + (kinds.length ? '<div class="exp-kinds">' + (showAll ? kinds : kinds.slice(0, 4)).map(function (k) { var p = tot ? k.v / tot : 0; return '<div class="exp-kind"><span class="exp-ki">' + i(k.icon) + '</span><div class="grow"><div class="row"><span class="grow">' + esc(k.k) + '</span><b>' + UI.money(k.v) + '</b><small>' + Math.round(p * 100) + '%</small></div><i class="exp-bar"><b style="width:' + Math.max(1, p * 100) + '%"></b></i></div></div>'; }).join('') + '</div>' + (kinds.length > 4 ? '<button type="button" class="inv-link exp-more" data-allk>' + (showAll ? 'Show fewer' : 'Show all ' + kinds.length + ' kinds') + '</button>' : '') : '<p class="b2">Nothing spent in this month yet.</p>') + '</div></div>' +
      '<div class="card exp-card"><div id="exp-f"></div><div class="exp-totl" id="exp-totl"></div><div id="exp-t"></div></div>' + (canAdd ? '<button type="button" class="exp-fab" data-add aria-label="Add expense">' + i('plus') + '</button>' : '');
    var f = ctx.state.f = ctx.state.f || {};
    var cats = expCats(), users = D().users.filter(function (u) { return src.some(function (e) { return e.by === u.id; }); });
    var fields = [{ type: 'search', key: 'q', placeholder: 'Kind, car, Booking ID, note or who was paid' },
      { type: 'select', key: 'cat', label: 'Kind', all: 'All kinds', options: cats.map(function (c) { return { value: c.id, label: c.name + (c.hidden ? ' (hidden)' : ''), group: c.group }; }) },
      { type: 'select', key: 'car', label: 'Car', all: 'Any car', options: [['none', 'Not tied to a car']].concat(D().cars.map(function (c) { return [c.id, c.plate + ' · ' + carModel(c)]; })) }]
      .concat(all ? [{ type: 'select', key: 'by', label: 'Recorded by', all: 'Everyone', options: users.map(function (u) { return [u.id, u.name]; }) }] : [])
      .concat([{ type: 'select', key: 'order', label: 'Order', all: false, default: 'new', options: [['new', 'Newest first'], ['old', 'Oldest first'], ['big', 'Biggest first'], ['small', 'Smallest first']] }])
      .concat(all ? [{ type: 'chips', key: 'src', options: [['all', 'All', month.length], ['recorded', 'Recorded', month.filter(function (e) { return e.source === 'recorded'; }).length], ['job', 'Service jobs', month.filter(function (e) { return e.source === 'job'; }).length], ['paper', 'Papers', month.filter(function (e) { return e.source === 'paper'; }).length]] }] : []);
    if (!f.order) f.order = 'new';
    var filt = function () {
      var q = (f.q || '').toLowerCase().trim();
      var rows = month.filter(function (e) {
        if (f.src && f.src !== 'all' && e.source !== f.src) return false;
        if (f.cat && e.cat !== f.cat) return false;
        if (f.car && (f.car === 'none' ? e.car : e.car !== f.car)) return false;
        if (f.by && e.by !== f.by) return false;
        if (q) { var c = rptCarOf(e.car), x = e.booking ? findBooking(e.booking) : null; if ((rptExpName(e) + ' ' + (c ? c.plate + ' ' + c.plate.replace(/ /g, '') + ' ' + carName(c) : '') + ' ' + (e.booking || '') + ' ' + (x ? x.cust.name : '') + ' ' + (e.note || '') + ' ' + (e.paidTo || '') + ' ' + rptWho(e)).toLowerCase().indexOf(q) < 0) return false; }
        return true;
      });
      var o = f.order || 'new';
      rows.sort(function (a, b) { return o === 'old' ? a.day - b.day || a.at - b.at : o === 'big' ? b.amount - a.amount : o === 'small' ? a.amount - b.amount : b.day - a.day || b.at - a.at; });
      return rows;
    };
    var filtered = function () { return ['q', 'cat', 'car', 'by'].some(function (k) { return f[k]; }) || (f.src && f.src !== 'all'); };
    var totl = function (rows) { root.querySelector('#exp-totl').innerHTML = '<span>' + (filtered() ? 'Matching' : 'Showing') + ': <b>' + rows.length + (rows.length === 1 ? ' entry' : ' entries') + '</b>, <b>' + UI.money(sum(rows.map(function (e) { return e.amount; }))) + '</b></span>'; };
    var whatCell = function (e) { return '<div class="exp-what"><span class="exp-tile">' + i(expIcon(e)) + '</span><div><span>' + esc(rptExpName(e)) + (e.source !== 'recorded' ? ' ' + UI.chip(e.source === 'job' ? 'Service job' : 'Paper', 'grey') : '') + '</span><small>' + esc([e.paidTo, e.source !== 'recorded' ? e.note : ''].filter(Boolean).join(' · ') || '') + '</small></div></div>'; };
    var carCell = function (e) { var c = rptCarOf(e.car); return c ? esc(c.plate) + '<small class="exp-sm">' + esc(carName(c)) + '</small>' : '<span class="b2">Not tied to a car</span>'; };
    var cols = [{ key: 'day', label: 'Day', render: function (e) { return '<span class="nowrap">' + esc(UI.fmt.day(e.day)) + '</span>'; } }, { key: 'what', label: 'What', render: whatCell }, { key: 'car', label: 'Car', render: carCell },
      { key: 'booking', label: 'Booking', render: function (e) { return e.booking ? '<button type="button" class="inv-link" data-bk="' + esc(e.booking) + '" data-stop>' + esc(e.booking) + '</button>' : '<span class="faint">-</span>'; } }]
      .concat(all ? [{ key: 'by', label: 'Recorded by', render: function (e) { return e.by ? esc(rptWho(e)) : '<span class="faint">-</span>'; } }] : [])
      .concat([{ key: 'amount', label: 'Amount', align: 'right', render: function (e) { return '<b class="fw5">' + UI.money(e.amount) + '</b>'; } }, { key: 'clip', label: '', render: function (e) { return e.receipt ? '<span class="exp-clip" title="Receipt attached">' + i('paperclip') + '</span>' : ''; } }]);
    var first = !src.length;
    var t = UI.table(root.querySelector('#exp-t'), { columns: cols, rows: filt(), rowKey: 'id', density: 'compact', minWidth: 900, pageSize: +P.size || 25, pageSizes: [10, 25, 50, 100], page: +P.page || 1, onPage: function (pg) { ctx.setParams({ page: pg > 1 ? pg : null }); },
      onRowClick: function (e) { expOpen(e.id); },
      card: function (e) { var c = rptCarOf(e.car); return '<div class="row gap10"><span class="exp-tile">' + i(expIcon(e)) + '</span><div class="grow"><div class="row"><b class="grow">' + esc(rptExpName(e)) + '</b><b>' + UI.money(e.amount) + '</b></div><div class="b2">' + esc(UI.fmt.day(e.day)) + (c ? ' · ' + esc(c.plate) : '') + (e.paidTo ? ' · ' + esc(e.paidTo) : '') + (e.receipt ? ' ' + i('paperclip') : '') + '</div>' + (e.source !== 'recorded' ? UI.chip(e.source === 'job' ? 'Service job' : 'Paper', 'grey') : '') + '</div></div>'; },
      empty: first ? { icon: 'receipt-2', title: 'No expenses yet', text: 'When you pay for fuel, a toll or a car wash, add it here with the day and the amount. A photo of the receipt helps later.', action: canAdd ? UI.btn('Add the first expense', { icon: 'plus', attrs: { 'data-add': '1' } }) : '' } : filtered() ? { icon: 'filter-off', title: 'Nothing matches these filters', text: 'Clear the filters to see every entry of the month.' } : { icon: 'calendar-off', title: 'Nothing has been recorded for this month.', text: canAdd ? 'Add an expense, or go back a month.' : 'Go back a month to see older entries.' } });
    totl(filt());
    UI.filters(root.querySelector('#exp-f'), { values: f, fields: fields, onChange: function () { var r = filt(); t.setRows(r); totl(r); ctx.setParams({ page: null }); } });
    UI.on(root, 'click', '[data-add]', function () { expSheet(); });
    UI.on(root, 'click', '[data-cats]', function () { expCategories(); });
    UI.on(root, 'click', '[data-bk]', function (ev, el) { API.openBooking(el.getAttribute('data-bk')); });
    UI.on(root, 'click', '[data-allk]', function () { ctx.state.allKinds = !ctx.state.allKinds; ctx.refresh(); });
    UI.on(root, 'click', '[data-srcpart]', function (ev, el) { f.src = el.getAttribute('data-srcpart'); ctx.refresh(); });
    UI.on(root, 'click', '[data-mon]', function (ev, el) { var d2 = +el.getAttribute('data-mon'), nk = d2 === 0 ? null : expMonthKey(new Date(m0.getFullYear(), m0.getMonth() + d2, 1)); ctx.setParams({ m: nk === nowM ? null : nk, page: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-xl]', function () {
      var rows = filt(), fl = [f.q ? 'search "' + f.q + '"' : '', f.cat ? 'kind ' + (expCat(f.cat) || {}).name : '', f.car ? 'car ' + (f.car === 'none' ? 'none' : carById(f.car).plate) : '', f.by ? 'recorded by ' + (userById(f.by) || {}).name : '', f.src && f.src !== 'all' ? rptSrcLabel(f.src) + ' only' : ''].filter(Boolean).join(', ');
      rptXlsx('expenses-' + mk + '.xlsx', rptExpBook(rows, expMonthName(m0) + ' (' + UI.fmt.date(m0) + ' to ' + UI.fmt.date(new Date(m1.getTime() - DAY)) + ')', fl || (all ? 'None: every entry of the month' : 'Only the expenses you recorded')));
      DB.log('Exported', 'Expense', '', me().name + ' downloaded the expenses of ' + expMonthName(m0) + ' (Excel)');
    });
    if (P.action === 'add' && !ctx.state.opened) { ctx.state.opened = true; var pre = {}; if (P.car) pre.car = P.car; if (P.booking) pre.booking = P.booking; if (P.amount) pre.amount = P.amount; setTimeout(function () { ctx.setParams({ action: null, car: null, booking: null, amount: null }); expSheet(null, pre); }, 30); }
    if (P.expense && !ctx.state.opened) { ctx.state.opened = true; setTimeout(function () { expOpen(P.expense); }, 30); }
  }
};
API.addExpense = function (prefill) { if (!can('expenses.add') && !can('expenses.add_business')) { UI.toast('You cannot add expenses.', { tone: 'warn' }); return; } expSheet(null, prefill || {}); };
API.openExpense = function (id) { expOpen(id); };

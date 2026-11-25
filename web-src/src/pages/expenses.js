/* ===================================================================
   Page: Expenses (#page=expenses)   Owner: W3
   Everything the business spent in a month, from three sources: what the team recorded, finished service jobs and
   car papers (both from Maintenance). Add sheet (several kinds in one go, receipt read, searchable pickers, handover fee
   rules), change sheet, detail drawer, categories manager (rules, edit window), Excel.
   =================================================================== */
var EXP_ICONS = ['gas-station', 'road', 'parking', 'car', 'droplet', 'spray', 'truck-delivery', 'building', 'users', 'percentage', 'license', 'shield', 'clipboard-check', 'hammer', 'tool', 'battery', 'file-alert', 'gavel', 'device-mobile', 'wifi', 'bulb', 'speakerphone', 'apps', 'calculator', 'building-bank', 'paperclip', 'tools-kitchen-2', 'calendar-dollar', 'truck', 'armchair', 'certificate', 'receipt', 'coffee', 'key', 'first-aid-kit', 'dots'];
var EXP_MAX_LINES = 20, EXP_MAX_NOTE = 500, EXP_MAX_PAYEE = 120;
function expCats() { return D().expenseCats.slice().sort(function (a, b) { return a.order - b.order; }); }
function expCat(id) { return byId(D().expenseCats, id); }
function expIcon(e) { if (e.source === 'job') return 'tool'; if (e.source === 'paper') return 'file-certificate'; var c = expCat(e.cat); return c ? c.icon : 'receipt'; }
function expMonthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function expMonthOf(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, 1); }
function expMonthName(d) { return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }); }
function expCanAll() { return can('expenses.view_all'); }
/* the three groups a kind belongs to, in the order the lists show them */
function expGroupOf(c) { return c.agentFee ? 'Handover fees' : c.group === 'Office and admin' ? 'Office and admin' : 'Everyday'; }
var EXP_GROUPS = ['Everyday', 'Handover fees', 'Office and admin'];
/* days people may change or delete their own entries (Categories dialog); null = no limit */
function expEditDays() { var v = CO().expenseEditDays; return v == null || v === '' ? null : Math.max(1, Math.round(+v)); }
/* who may change or delete this entry, and for how long */
function expEditInfo(e) {
  if (e.source !== 'recorded') return { ok: false, why: 'Change it in Maintenance, where it is kept.' };
  if (can('expenses.edit_all')) return { ok: true, note: 'You can change or delete any expense.' };
  var mine = me() && e.by === me().id;
  if (!mine) return { ok: false, why: 'Only the person who recorded it, or someone allowed to change everyone\'s expenses, can change it.' };
  if (!can('expenses.edit_own')) return { ok: false, why: 'Your account cannot change expenses after they are saved.' };
  var days = expEditDays();
  if (days == null) return { ok: true, note: 'You can change or delete your own entries at any time.' };
  var left = days * DAY - (NOW() - e.at);
  if (left <= 0) return { ok: false, why: 'Locked: your own entries can be changed or deleted for ' + plural(days, 'day') + ' after they are recorded. Ask the owner if it is wrong.' };
  var h = Math.max(1, Math.ceil(left / 36e5));
  return { ok: true, note: 'You can change or delete this for ' + (h === 1 ? 'less than an hour' : h > 48 ? Math.floor(h / 24) + ' more days' : h + ' hours') + ' more.' };
}
/* may this person use this kind at all (their permission)? */
function expMayUse(c) { return c.group === 'Office and admin' ? can('expenses.add_business') : can('expenses.add') || can('expenses.add_business'); }
/* a handover fee kind without an amount for this person cannot be chosen */
function expFeeFor(c, uid) { return c.agentFee ? feeRate(c, uid || (me() || {}).id) : null; }
function expUsable(c, keepId) { if (c.id === keepId) return true; if (c.hidden || !expMayUse(c)) return false; if (c.agentFee && expFeeFor(c) == null) return false; return true; }
function expAmt(s) { var t = String(s == null ? '' : s).replace(/,/g, '').trim(); if (!/^\d+(\.\d{0,2})?$/.test(t)) return null; var v = Number(t); return v > 0 && v <= 1e7 ? v : null; }
function expAmtProblem(s) { var t = String(s == null ? '' : s).trim(); if (!t) return ''; return expAmt(t) == null ? 'Type an amount above 0, with at most 2 decimals.' : ''; }
function expShortDay(d) { return d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' }); }
/* handover fee rules for one ticked kind on a booking: an existing entry that stops it, as a sentence (or '') */
function expFeeClash(c, code, uid, exceptId) {
  if (!c || !c.agentFee || c.noBooking || !code) return '';
  var who = function (e) { return e.by === uid ? 'you' : rptWho(e); };
  var same = D().expenses.filter(function (e) { return e.id !== exceptId && e.cat === c.id && e.booking === code && (!c.oncePerPerson || e.by === uid); })[0];
  if (same) return '"' + c.name + '" for ' + code + ' is already recorded by ' + who(same) + ' on ' + expShortDay(same.day) + '. ' + (c.oncePerPerson ? 'Each person can have it once per booking.' : 'Each booking can have it only once.');
  if (c.feeGroup === 'delivery' || c.feeGroup === 'return') {
    var other = D().expenses.filter(function (e) { var k = expCat(e.cat); return e.id !== exceptId && e.booking === code && k && k.id !== c.id && k.agentFee && k.feeGroup === c.feeGroup; })[0];
    if (other) return '"' + c.name + '" cannot be added to ' + code + ': "' + expCat(other.cat).name + '" is already recorded by ' + who(other) + ' on ' + expShortDay(other.day) + '. A booking can have only one ' + c.feeGroup + ' fee.';
  }
  return '';
}
function expList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
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
      UI.kv('Kind', esc(rptExpName(e)) + ' ' + (e.source === 'recorded' ? UI.chip(cat ? expGroupOf(cat) : 'Everyday', cat && cat.agentFee ? 'info' : cat && cat.group === 'Office and admin' ? 'grey' : 'pri') : UI.chip(e.source === 'job' ? 'Service job' : 'Paper', 'grey'))) +
      (cat && cat.paysStaff ? UI.kv('To staff', esc(e.staff ? staffName(e.staff) : '-') + '<small>Money they hold, not a car cost</small>') : '') +
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

/* ---------- add / change sheet ----------
   New entry: the receipt first (read for the total, the day and how it was paid), the day, a tick list of kinds each with
   its own amount (2 or more lines save as separate expenses sharing everything else), then car, booking, paid with,
   paid to and a note. Change: one amount and one kind. */
var EXP_LAST = null;
function expSheet(rec, prefill) {
  var edit = !!rec, today = new Date(NOW().getFullYear(), NOW().getMonth(), NOW().getDate()), yest = new Date(today.getTime() - DAY), uid = (me() || {}).id;
  var blank = function () { return { day: today, dayTouched: false, amount: '', cat: '', lines: [], car: '', booking: '', staff: '', method: 'Cash', paidTo: '', note: '', receipt: null, shrink: '', dup: '', rcErr: '', reading: false, readText: '', readTone: '', total: null, q: '', all: false }; };
  var st = Object.assign(blank(), rec ? { day: rec.day, dayTouched: true, amount: (Number(rec.amount) || 0).toFixed(2), cat: rec.cat, car: rec.car || '', booking: rec.booking || '', staff: rec.staff || '', method: rec.method || 'Cash', paidTo: rec.paidTo || '', note: rec.note || '', receipt: rec.receipt } : {});
  if (!rec && prefill) {
    ['car', 'booking', 'paidTo', 'note', 'staff', 'method'].forEach(function (k) { if (prefill[k]) st[k] = prefill[k]; });
    if (prefill.day) { st.day = prefill.day; st.dayTouched = true; }
    if (prefill.cat && expCat(prefill.cat)) st.lines = [expLineFor(expCat(prefill.cat), prefill.amount)];
    else if (prefill.amount) st.pendingAmount = String(prefill.amount);
    if (st.booking && !st.car) { var pb = findBooking(st.booking); if (pb) st.car = pb.car.id; }
  }
  function expLineFor(c, amount) {
    if (c.agentFee) { var f = expFeeFor(c); return { cat: c.id, amount: f != null ? f.toFixed(2) : '', fixed: true }; }
    if (c.fixedAmount) return c.locked ? { cat: c.id, amount: Number(c.fixedAmount).toFixed(2), fixed: true } : { cat: c.id, amount: Number(c.fixedAmount).toFixed(2) };
    return { cat: c.id, amount: amount ? String(amount) : '' };
  }
  var sig = function () { return JSON.stringify([+st.day, st.amount, st.cat, st.lines, st.car, st.booking, st.staff, st.method, st.paidTo, st.note, st.receipt && st.receipt.name]); };
  var start = sig(), saved = 0, readTicket = 0;
  var lineCats = function () { return st.lines.map(function (l) { return expCat(l.cat); }).filter(Boolean); };
  var editCat = function () { return expCat(st.cat); };
  var cats = function () { return edit ? [editCat()].filter(Boolean) : lineCats(); };
  var noBooking = function () { return cats().some(function (c) { return c.agentFee && c.noBooking; }); };
  var paysStaff = function () { return cats().some(function (c) { return c.paysStaff; }); };
  var bookingObj = function () { return st.booking ? findBooking(st.booking) : null; };
  var dayErr = function () { if (!st.day) return 'Choose the day.'; if (st.day > new Date(today.getTime() + DAY)) return 'Not more than 1 day ahead.'; if (st.day < new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())) return 'Not more than 10 years back.'; return ''; };
  var linesTotal = function () { return Math.round(sum(st.lines.map(function (l) { return expAmt(l.amount) || 0; })) * 100) / 100; };
  /* the one ticked kind without a typed amount gets what is left of the receipt total */
  var fillRemainder = function () {
    if (st.total == null || st.total <= 0) return null;
    var open = st.lines.filter(function (l) { return l.auto || !String(l.amount).trim(); });
    if (open.length !== 1) return null;
    var typed = sum(st.lines.filter(function (l) { return l !== open[0]; }).map(function (l) { return expAmt(l.amount) || 0; })), left = Math.round((st.total - typed) * 100) / 100;
    var a = left > 0 ? left.toFixed(2) : '';
    if (open[0].amount === a && open[0].auto) return null;
    open[0].amount = a; open[0].auto = a !== ''; return open[0];
  };
  /* everything that stops the save: missing things (listed in the footer) and problems (shown in red) */
  var check = function () {
    var miss = [], bad = [], lineErr = {};
    if (!st.day || dayErr()) miss.push('the day');
    var cs = cats(), b = bookingObj();
    if (edit) {
      if (!st.cat) miss.push('what it was for');
      if (!String(st.amount).trim()) miss.push('the amount'); else if (expAmtProblem(st.amount)) bad.push('amount');
    } else {
      if (!st.lines.length) miss.push('what it was for');
      if (st.lines.length > EXP_MAX_LINES) bad.push('Tick at most ' + EXP_MAX_LINES + ' kinds in one go.');
      st.lines.forEach(function (l) { var c = expCat(l.cat); if (!String(l.amount).trim()) miss.push('the amount of ' + (c ? c.name : 'a kind')); else if (expAmtProblem(l.amount)) { lineErr[l.cat] = expAmtProblem(l.amount); bad.push('amount'); } });
    }
    var nb = noBooking();
    if (!nb && cs.some(function (c) { return c.needsBooking && !c.noBooking; }) && !st.booking) miss.push('the booking');
    var needCar = cs.filter(function (c) { return c.needsCar; }).map(function (c) { return c.name; });
    if (needCar.length && !st.car && !(b && b.car)) miss.push('the car (' + expList(needCar) + (needCar.length > 1 ? ' need it)' : ' needs it)'));
    if (paysStaff() && !st.staff) miss.push('who the Payment to staff went to');
    var clashes = [];
    if (nb && cs.some(function (c) { return c.agentFee && !c.noBooking; })) clashes.push('Pick-up/delivery - other has no booking, so it cannot go in the same entry as a booking\'s handover fee. Untick one of them and save it as a separate entry.');
    if (st.booking && !nb) {
      var seen = {};
      cs.forEach(function (c) {
        var m = expFeeClash(c, st.booking, edit ? rec.by : uid, edit ? rec.id : null); if (m) clashes.push(m);
        if (c.agentFee && (c.feeGroup === 'delivery' || c.feeGroup === 'return')) { if (seen[c.feeGroup]) clashes.push('"' + seen[c.feeGroup] + '" and "' + c.name + '" are both ' + c.feeGroup + ' fees. A booking can have only one ' + c.feeGroup + ' fee.'); else seen[c.feeGroup] = c.name; }
      });
    }
    if (String(st.note).length > EXP_MAX_NOTE) bad.push('note');
    if (String(st.paidTo).length > EXP_MAX_PAYEE) bad.push('payee');
    return { miss: miss, bad: bad, clashes: clashes, lineErr: lineErr, ok: !miss.length && !bad.length && !clashes.length };
  };
  var hint = function (c) { if (c.ok) return saved ? saved + ' saved so far.' : 'Ready to save.'; if (c.miss.length && (c.bad.length || c.clashes.length)) return 'To save, choose ' + expList(c.miss) + ', and fix what is marked in red.'; if (c.miss.length) return 'To save, choose ' + expList(c.miss) + '.'; return 'To save, fix what is marked in red.'; };

  /* ----- parts of the form ----- */
  var receiptHtml = function () {
    var r = st.receipt, h = '<div class="exp-f exp-rcf"><label class="exp-l">Receipt <span class="exp-opt">(optional)</span></label>';
    if (!r && !edit) h += '<p class="b2 exp-rch">Add it first: the total, the day and how it was paid are read from it. You can paste a screenshot with Ctrl+V too.</p>';
    if (r) h += '<div class="exp-rc">' + (r.dataUrl && !/pdf/i.test(r.type || '') ? '<span class="exp-rc-th"><img src="' + r.dataUrl + '" alt="The receipt you chose"></span>' : '<span class="exp-rc-th">' + i(/pdf/i.test(r.type || r.name || '') ? 'file-type-pdf' : 'photo') + '</span>') + '<div class="grow"><b>' + esc(r.name) + '</b><small>' + UI.fmt.size(r.size || 0) + (edit && rec.receipt === r ? ' · Kept with this expense' : '') + '</small>' + (st.shrink ? '<small class="exp-ok">' + i('photo-down') + esc(st.shrink) + '</small>' : '') + '</div>' + UI.btn('Remove', { kind: 't', size: 'sm', cls: 'exp-danger', attrs: { 'data-rmrc': '1' } }) + '</div>';
    if (st.dup) h += '<p class="exp-warn" role="status">' + i('alert-triangle') + esc(st.dup) + '</p>';
    h += '<div class="exp-rcb">' + UI.btn('Take a photo', { kind: 'tonal', size: 'sm', icon: 'camera', cls: 'exp-cam', attrs: { 'data-cam': '1' } }) + UI.btn(r ? 'Choose a different file' : 'Choose photo or PDF', { kind: 'tonal', size: 'sm', icon: r ? 'replace' : 'photo-up', attrs: { 'data-pick': '1' } }) + UI.btn('Paste', { kind: 'tonal', size: 'sm', icon: 'clipboard', attrs: { 'data-paste': '1' } }) + '</div>';
    if (st.rcErr) h += '<p class="exp-err" role="alert">' + i('alert-circle') + esc(st.rcErr) + '</p>';
    if (st.reading) h += '<p class="b2 exp-reading" role="status"><span class="exp-spin"></span>Reading the receipt...</p>';
    else if (st.readText) h += '<p class="' + (st.readTone === 'ok' ? 'exp-ok' : 'b2') + '" role="status">' + i(st.readTone === 'ok' ? 'circle-check' : 'info-circle') + esc(st.readText) + '</p>';
    return h + '</div>';
  };
  var dayHtml = function () {
    var isT = st.day && +st.day === +today, isY = st.day && +st.day === +yest, de = st.day ? dayErr() : '';
    return '<div class="exp-f"><label class="exp-l">Which day was it spent? <em>*</em></label><div class="exp-days"><button type="button" class="exp-day" data-day="t" aria-pressed="' + !!isT + '"><b>Today</b><small>' + esc(expShortDay(today)) + '</small></button><button type="button" class="exp-day" data-day="y" aria-pressed="' + !!isY + '"><b>Yesterday</b><small>' + esc(expShortDay(yest)) + '</small></button></div>' +
      UI.dateField({ id: 'exp-dp', key: 'dayPick', value: st.day && !isT && !isY ? st.day : null, chips: false, placeholder: 'Or pick another day', max: new Date(today.getTime() + DAY), help: de ? '' : 'Or pick any other day on the calendar.', error: de, aria: 'Or pick another day' }) + '</div>';
  };
  var shownCats = function () {
    var all = expCats().filter(function (c) { return !c.hidden || st.lines.some(function (l) { return l.cat === c.id; }); }).filter(function (c) { return expMayUse(c) || st.lines.some(function (l) { return l.cat === c.id; }); });
    var order = function (list) { return EXP_GROUPS.reduce(function (a, g) { return a.concat(list.filter(function (c) { return expGroupOf(c) === g; })); }, []); };
    var ticked = function (c) { return st.lines.some(function (l) { return l.cat === c.id; }); };
    var q = st.q.trim();
    if (q) { var found = order(all.filter(function (c) { return UI.wordsMatch(c.name, q); })); return { list: found.concat(all.filter(function (c) { return found.indexOf(c) < 0 && ticked(c); })), heads: true, found: found.length }; }
    if (st.all) return { list: order(all), heads: true };
    var quick = all.filter(function (c) { return expGroupOf(c) === 'Everyday' && expUsable(c); }).slice(0, 6);
    return { list: quick.concat(all.filter(function (c) { return quick.indexOf(c) < 0 && ticked(c); })), heads: false, hidden: all.length - quick.length - all.filter(function (c) { return quick.indexOf(c) < 0 && ticked(c); }).length };
  };
  var linesBoxHtml = function () {
    var s = shownCats(), chk = check(), h = '';
    if (st.q.trim() && !s.found) h += '<p class="b2 exp-lnone">No kind is called "' + esc(st.q.trim()) + '". Try another word, or add it under Categories.</p>';
    var prevG = null;
    s.list.forEach(function (c) {
      var g = expGroupOf(c), l = st.lines.filter(function (x) { return x.cat === c.id; })[0], fee = c.agentFee ? expFeeFor(c) : null, off = c.agentFee && fee == null && !l;
      if (s.heads && g !== prevG) h += '<div class="exp-lh">' + (g === 'Handover fees' ? 'Handover fees (amount set in Settings)' : g) + '</div>';
      prevG = g;
      h += '<div class="exp-ln' + (l ? ' on' : '') + (off ? ' off' : '') + '"><label class="cb exp-lcb"><input type="checkbox" data-tick="' + c.id + '"' + (l ? ' checked' : '') + (off ? ' disabled' : '') + '><span class="box">' + i('check') + '</span><span class="exp-lname">' + i(c.icon) + '<span>' + esc(c.name) + (off ? '<small>No amount for you yet. Ask the owner to set it in Settings.</small>' : c.paysStaff ? '<small>Money handed to a staff member</small>' : c.noBooking ? '<small>For trips with no booking</small>' : '') + '</span></span></label>';
      if (l && l.fixed) h += '<span class="exp-lfix" title="The amount is set in Settings">' + UI.money(expAmt(l.amount) || 0) + i('lock') + '</span>';
      else if (l) h += '<div class="exp-lamt' + (chk.lineErr[c.id] ? ' bad' : '') + '"><span>RM</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-lamt="' + c.id + '" value="' + esc(l.amount) + '" aria-label="' + esc(c.name) + ' amount (RM)">' + (chk.lineErr[c.id] ? '<small>' + esc(chk.lineErr[c.id]) + '</small>' : '') + '</div>';
      h += '</div>';
    });
    if (!st.q.trim() && (s.hidden > 0 || st.all)) h += '<button type="button" class="exp-lmore" data-lall>' + i(st.all ? 'chevron-up' : 'chevron-down') + (st.all ? 'Show fewer kinds' : 'Show all kinds (' + s.hidden + ' more)') + '</button>';
    h += '<div class="exp-ltot"><span class="b2">' + (st.lines.length === 0 ? 'Nothing ticked yet' : plural(st.lines.length, 'expense')) + '</span><b data-ltot>Total ' + UI.fmt.money(linesTotal()) + '</b></div>';
    h += '<div data-lcheck>' + totalCheckHtml() + '</div>';
    return h;
  };
  var totalCheckHtml = function () {
    if (st.total == null) return '';
    var ok = st.lines.length && st.lines.every(function (l) { return expAmt(l.amount) != null; }), diff = Math.round((linesTotal() - st.total) * 100) / 100;
    return '<div class="exp-lchk' + (ok && diff ? ' warn' : '') + '"><span class="b2">Receipt says ' + UI.fmt.money(st.total) + '</span>' + (ok ? (diff === 0 ? '<span class="exp-ok">' + i('circle-check') + 'Matches</span>' : '<span class="exp-wtxt">' + i('alert-triangle') + UI.fmt.money(Math.abs(diff)) + ' ' + (diff > 0 ? 'more' : 'less') + ' than the receipt</span>') : '') + '</div>';
  };
  var linesHtml = function () {
    var chk = check();
    return '<div class="exp-f" role="group" aria-labelledby="exp-ll"><div><label class="exp-l" id="exp-ll">What was it for? <em>*</em></label><p class="b2 exp-sub">Tick everything this payment covered and enter each amount.</p></div>' +
      '<div class="inp srch exp-lsrch">' + i('search') + '<input type="search" data-lq placeholder="Search kinds, for example road tax" aria-label="Search kinds of expense" value="' + esc(st.q) + '"></div>' +
      '<div class="exp-lines" data-lines>' + linesBoxHtml() + '</div>' +
      (chk.clashes.length ? '<div class="exp-clash" role="alert">' + chk.clashes.map(function (m) { return '<p>' + i('alert-circle') + esc(m) + '</p>'; }).join('') + '</div>' : '') +
      (st.lines.length > 1 ? '<p class="b2">Each ticked kind is saved as its own expense. The day, car, booking, payment details and the receipt go on all of them.</p>' : '') + '</div>';
  };
  var overlapHtml = function () {
    var names = cats().filter(function (c) { return c.alsoKept; }).map(function (c) { return c.name; });
    if (!names.length) return '';
    return UI.alert(expList(names) + (names.length > 1 ? ' are' : ' is') + ' usually also saved on the car\'s service record or paper in Maintenance. Enter the price in one place only, so it is not counted twice.', 'pri');
  };
  var editKindHtml = function () {
    var cs = expCats().filter(function (c) { return expUsable(c, st.cat); }), cat = editCat(), quick = cs.filter(function (c) { return expGroupOf(c) === 'Everyday'; }).slice(0, 6), fee = cat && cat.agentFee;
    var h = UI.input({ id: 'exp-amt', key: 'amount', label: 'Amount', required: true, prefix: 'RM', value: st.amount, placeholder: '0.00', readonly: !!fee, attrs: { inputmode: 'decimal' }, help: fee ? 'A handover fee keeps the amount set in Settings.' : '', error: expAmtProblem(st.amount) });
    h += '<div class="exp-f"><label class="exp-l">What was it for? <em>*</em></label><div class="exp-qc">' + quick.map(function (c) { return '<button type="button" class="exp-chip" data-qc="' + c.id + '" aria-pressed="' + (st.cat === c.id) + '">' + i(c.icon) + esc(c.name) + '</button>'; }).join('') + '</div>' +
      UI.select({ id: 'exp-cat', key: 'cat', placeholder: 'Choose a kind of expense', value: st.cat, aria: 'Kind of expense', options: EXP_GROUPS.reduce(function (a, g) { return a.concat(cs.filter(function (c) { return expGroupOf(c) === g; }).map(function (c) { return { value: c.id, label: c.name + (c.hidden ? ' (hidden)' : ''), group: g }; })); }, []) }) + '</div>';
    return h;
  };
  var methodHtml = function () { return '<div class="exp-f"><label class="exp-l">Paid with</label><div class="exp-qc">' + [['Cash', 'cash'], ['Card', 'credit-card'], ['Bank transfer', 'building-bank'], ['E-wallet', 'device-mobile'], ['Other', 'dots']].map(function (m) { return '<button type="button" class="exp-chip" data-pm="' + m[0] + '" aria-pressed="' + (st.method === m[0]) + '">' + i(m[1]) + m[0] + '</button>'; }).join('') + '</div></div>'; };
  var body = function (el) {
    var h = '';
    if (edit) { var ed = expEditInfo(rec); if (ed.ok && ed.note) h += '<p class="exp-edit ok">' + i('clock') + esc(ed.note) + '</p>'; }
    if (!edit) h += '<div data-rcp>' + receiptHtml() + '</div>';
    h += dayHtml();
    h += edit ? editKindHtml() : linesHtml();
    if (paysStaff()) h += '<div data-stp></div>';
    h += overlapHtml();
    h += '<div data-carp></div>';
    h += noBooking() ? UI.alert('Pick-up/delivery - other has no Booking ID. Choose the car, and write in the note where it went (for example, to the workshop).', 'pri', { icon: 'tool' }) : '<div data-bkp></div>';
    h += methodHtml();
    h += UI.input({ id: 'exp-pt', key: 'paidTo', label: 'Paid to (optional)', value: st.paidTo, placeholder: 'Shop, station, driver or company', maxlength: EXP_MAX_PAYEE });
    h += UI.textarea({ id: 'exp-note', key: 'note', label: 'Note (optional)', value: st.note, rows: 2, maxlength: EXP_MAX_NOTE, placeholder: 'Anything that helps later, for example why it was needed' }) + '<p class="exp-cnt b2" ' + (st.note.length > EXP_MAX_NOTE - 80 ? '' : 'hidden') + '>' + st.note.length + ' of ' + EXP_MAX_NOTE + '</p>';
    if (edit) h += '<div data-rcp>' + receiptHtml() + '</div>';
    el.innerHTML = h;
    mount(el);
  };
  var mount = function (el) {
    var needCar = cats().some(function (c) { return c.needsCar; });
    UI.carPicker(el.querySelector('[data-carp]'), { key: 'car', label: 'Car' + (needCar ? '' : ' (optional)'), required: needCar, value: st.car || null, placeholder: needCar ? 'Plate number or model' : 'No car (leave empty if no car)', onChange: function (v) { st.car = v || ''; drawFoot(); } });
    var bk = el.querySelector('[data-bkp]');
    if (bk) {
      var needBk = !noBooking() && cats().some(function (c) { return c.needsBooking && !c.noBooking; });
      UI.bookingPicker(bk, { key: 'booking', label: 'Booking' + (needBk ? '' : ' (optional)'), required: needBk, value: st.booking || null, placeholder: needBk ? 'Booking ID, name, phone or plate' : 'No booking (optional)', onChange: function (v, b) {
        st.booking = v || '';
        if (b && b.car && !st.car) st.car = b.car.id;
        setTimeout(redraw, 0);
      } });
    }
    var sp = el.querySelector('[data-stp]');
    if (sp) UI.staffPicker(sp, { key: 'staff', label: 'To staff', required: true, value: st.staff || null, placeholder: 'Choose who it went to', help: 'Shows on their Staff report as money they hold. Not counted as a cost of a car or booking.', onChange: function (v) { st.staff = v || ''; drawFoot(); } });
  };
  var foot = function () {
    var c = check();
    return '<div class="exp-sf"><p class="b2' + (c.ok ? '' : c.miss.length ? '' : ' exp-errt') + '" id="exp-hint" role="status">' + esc(hint(c)) + '</p><div class="row gap8">' + UI.btn(edit ? 'Save changes' : 'Save', { icon: 'check', disabled: !c.ok || (edit && sig() === start), attrs: { 'data-save': '1' } }) + (edit ? '' : UI.btn('Save and add another', { kind: 'tonal', icon: 'plus', disabled: !c.ok, attrs: { 'data-save2': '1' } })) + '</div></div>';
  };
  var dr = UI.drawer({ title: edit ? 'Change expense' : 'Add expense', subtitle: edit ? rptExpName(rec) + ' · ' + UI.fmt.date(rec.day) : '', width: 520, body: body, foot: foot(),
    dirty: function () { keep(dr.body); return sig() !== start; }, dirtyTitle: 'Leave without saving?', onClose: function () { document.removeEventListener('paste', onPaste); } });
  dr.el.classList.add('exp-sheet');
  var keep = function (el) { var f = UI.form(el); ['amount', 'paidTo', 'note', 'cat'].forEach(function (k) { if (f[k] !== undefined) st[k] = f[k]; }); };
  var redraw = function () { if (dr.closed) return; keep(dr.body); var sc = dr.body.scrollTop; dr.setBody(body); dr.body.scrollTop = sc; dr.setFoot(foot()); };
  var drawFoot = function () { if (!dr.closed) dr.setFoot(foot()); };
  var drawLines = function () { var box = dr.body.querySelector('[data-lines]'); if (box) box.innerHTML = linesBoxHtml(); drawFoot(); };
  var drawReceipt = function () { var b = dr.body.querySelector('[data-rcp]'); if (b) b.innerHTML = receiptHtml(); };

  /* ----- the receipt: choose, take, paste; shrink, duplicate warning, simulated read ----- */
  var takeFile = function (f) {
    if (!f) return;
    keep(dr.body); st.rcErr = '';
    if (!/^image\//.test(f.type) && !/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name || '')) { st.rcErr = 'Choose a photo (JPG, PNG or WebP) or a PDF.'; drawReceipt(); return; }
    if (f.size > 10 * 1048576) { st.rcErr = 'That file is bigger than 10 MB. Take a new photo or choose a smaller file.'; drawReceipt(); return; }
    UI.readImage(f, { max: 1600 }).then(function (img) {
      if (dr.closed) return;
      st.receipt = img;
      st.shrink = img.size < f.size * .95 ? 'Photo made smaller: ' + UI.fmt.size(f.size) + ' to ' + UI.fmt.size(img.size) + '.' : '';
      var twin = D().expenses.filter(function (e) { return e.receipt && (!rec || e.id !== rec.id) && e.receipt.name === img.name && (e.receipt.size === img.size || e.receipt.size === f.size); })[0];
      st.dup = twin ? 'A receipt with the same name and size is already saved on ' + UI.fmt.date(twin.day) + ' (' + rptExpName(twin) + ', ' + UI.fmt.money(twin.amount) + '). Check it is not the same receipt.' : '';
      if (edit) { drawReceipt(); drawFoot(); return; }
      st.lines.forEach(function (l) { if (l.auto) { l.amount = ''; l.auto = false; } });
      st.total = null; st.reading = true; st.readText = ''; var ticket = ++readTicket;
      drawReceipt(); drawLines();
      setTimeout(function () {
        if (dr.closed || ticket !== readTicket) return;
        keep(dr.body);
        var seed = (img.size || f.size || 1000) + (img.name || '').length * 97, total;
        var open = st.lines.filter(function (l) { return !String(l.amount).trim(); });
        if (st.lines.length && !open.length) total = linesTotal();
        else total = Math.round((12 + (seed % 17000) / 100 + linesTotal()) * 10) / 10;
        if (st.pendingAmount && expAmt(st.pendingAmount)) total = expAmt(st.pendingAmount);
        var read = ['RM ' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
        st.total = total; fillRemainder();
        if (!st.dayTouched) { var dd = new Date(today.getTime() - (seed % 3) * DAY); st.day = dd; read.push(UI.fmt.date(dd)); }
        if (st.method === 'Cash') { var k = seed % 5; if (k === 0) st.method = 'Card'; else if (k === 1) st.method = 'Bank transfer'; }
        st.reading = false; st.readText = 'Read from the receipt: ' + read.join(', ') + '. Check it.'; st.readTone = 'ok';
        redraw();
      }, 950);
    }, function () { st.rcErr = 'The file could not be read. Try another one.'; drawReceipt(); });
  };
  var pick = function (camera) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = camera ? 'image/*' : 'image/*,application/pdf'; if (camera) inp.setAttribute('capture', 'environment');
    inp.onchange = function () { takeFile(inp.files[0]); };
    inp.click();
  };
  var pastedName = function (type) { var n = NOW(), p = function (x) { return String(x).padStart(2, '0'); }; return 'pasted-receipt-' + n.getFullYear() + p(n.getMonth() + 1) + p(n.getDate()) + '-' + p(n.getHours()) + p(n.getMinutes()) + '.' + (type === 'application/pdf' ? 'pdf' : (type.split('/')[1] || 'png').replace('jpeg', 'jpg')); };
  var onPaste = function (ev) {
    if (dr.closed) { document.removeEventListener('paste', onPaste); return; }
    var fs = [].slice.call((ev.clipboardData && ev.clipboardData.files) || []).filter(function (f) { return /^image\//.test(f.type) || f.type === 'application/pdf'; });
    if (!fs.length) return;
    ev.preventDefault();
    var f = fs[0]; takeFile(f.name && f.name !== 'image.png' ? f : new File([f], pastedName(f.type), { type: f.type }));
  };
  document.addEventListener('paste', onPaste);
  var pasteBtn = function () {
    st.rcErr = '';
    if (!navigator.clipboard || !navigator.clipboard.read) { st.rcErr = 'This browser did not let the page read the clipboard. Click in the form and press Ctrl+V instead.'; drawReceipt(); return; }
    navigator.clipboard.read().then(function (items) {
      for (var k = 0; k < items.length; k++) { var t = items[k].types.filter(function (x) { return /^image\//.test(x) || x === 'application/pdf'; })[0]; if (t) return items[k].getType(t).then(function (bl) { takeFile(new File([bl], pastedName(bl.type), { type: bl.type })); }); }
      st.rcErr = 'There is no picture on the clipboard. Copy the receipt or take a screenshot first, then paste.'; drawReceipt();
    }).catch(function () { st.rcErr = 'This browser did not let the page read the clipboard. Click in the form and press Ctrl+V instead.'; drawReceipt(); });
  };

  /* ----- typing ----- */
  dr.body.addEventListener('input', function (ev) {
    var t = ev.target, k;
    if (t.hasAttribute('data-lq')) { st.q = t.value; drawLines(); return; }
    if ((k = t.getAttribute('data-lamt'))) {
      var l = st.lines.filter(function (x) { return x.cat === k; })[0]; if (!l) return;
      l.amount = t.value; l.auto = false;
      var filled = fillRemainder(); if (filled) { var o = dr.body.querySelector('[data-lamt="' + filled.cat + '"]'); if (o) o.value = filled.amount; }
      var tot = dr.body.querySelector('[data-ltot]'); if (tot) tot.textContent = 'Total ' + UI.fmt.money(linesTotal());
      var lc = dr.body.querySelector('[data-lcheck]'); if (lc) lc.innerHTML = totalCheckHtml();
      drawFoot(); return;
    }
    keep(dr.body); drawFoot();
    var c = dr.body.querySelector('.exp-cnt'); if (c && t.getAttribute('data-key') === 'note') { c.hidden = st.note.length <= EXP_MAX_NOTE - 80; c.textContent = st.note.length + ' of ' + EXP_MAX_NOTE; }
  });
  dr.body.addEventListener('focusout', function (ev) {
    var k = ev.target.getAttribute && ev.target.getAttribute('data-lamt'); if (!k) return;
    var l = st.lines.filter(function (x) { return x.cat === k; })[0]; if (!l) return;
    var v = expAmt(l.amount); if (v != null && l.amount !== v.toFixed(2)) { l.amount = v.toFixed(2); ev.target.value = l.amount; }
    var box = ev.target.closest('.exp-lamt'), pr = expAmtProblem(l.amount); if (box) { box.classList.toggle('bad', !!pr); var sm = box.querySelector('small'); if (pr && !sm) box.insertAdjacentHTML('beforeend', '<small>' + esc(pr) + '</small>'); else if (!pr && sm) sm.remove(); }
  });
  dr.body.addEventListener('change', function (ev) {
    var t = ev.target, k = t.getAttribute('data-key');
    if (t.hasAttribute('data-tick')) {
      keep(dr.body);
      var id = t.getAttribute('data-tick'), c = expCat(id);
      if (t.checked) { if (st.lines.length >= EXP_MAX_LINES) { t.checked = false; UI.toast('Tick at most ' + EXP_MAX_LINES + ' kinds in one go.', { tone: 'warn' }); return; } st.lines.push(expLineFor(c, st.lines.length === 0 && st.pendingAmount ? st.pendingAmount : '')); if (st.pendingAmount) st.pendingAmount = ''; }
      else st.lines = st.lines.filter(function (l) { return l.cat !== id; });
      if (noBooking()) st.booking = '';
      if (!paysStaff()) st.staff = '';
      fillRemainder();
      redraw();
      var a = t.checked && dr.body.querySelector('[data-lamt="' + id + '"]'); if (a && !a.value) a.focus();
      return;
    }
    if (k === 'dayPick') { if (t.value) { var p = t.value.split('-'); st.day = new Date(+p[0], +p[1] - 1, +p[2]); st.dayTouched = true; } redraw(); return; }
    if (k === 'cat') { keep(dr.body); var c2 = expCat(st.cat); if (c2 && c2.agentFee) { var f2 = expFeeFor(c2, rec.by); if (f2 != null) st.amount = f2.toFixed(2); } redraw(); }
  });

  /* ----- saving ----- */
  var save = function (again) {
    keep(dr.body);
    var c = check();
    if (!c.ok) { UI.toast(c.clashes[0] || hint(c), { tone: 'warn' }); redraw(); return; }
    var b = bookingObj(), car = st.car || (b ? b.car.id : null);
    var base = { day: st.day, car: car || null, booking: noBooking() ? null : (st.booking || null), method: st.method, paidTo: st.paidTo.trim(), note: st.note.trim(), receipt: st.receipt };
    if (edit) {
      var c1 = expCat(st.cat), data = Object.assign({}, base, { amount: Math.round(expAmt(st.amount) * 100) / 100, cat: st.cat, staff: c1 && c1.paysStaff ? st.staff : null });
      DB.update('expenses', rec, data, { where: 'Expense', text: me().name + ' changed an expense: ' + c1.name + ' ' + UI.fmt.money(data.amount) + ' on ' + UI.fmt.date(data.day) });
      start = sig(); dr.close(true); UI.toast('Changes saved'); return;
    }
    var key = JSON.stringify([+base.day, base.car, st.lines.map(function (l) { return l.cat + ':' + l.amount; })]);
    if (EXP_LAST && EXP_LAST.sig === key && Date.now() - EXP_LAST.at < 6000) { UI.toast('That one was already saved a moment ago, so it was not added twice.', { tone: 'info' }); return; }
    EXP_LAST = { sig: key, at: Date.now() };
    var total = 0, n = st.lines.length;
    st.lines.forEach(function (l) {
      var cat = expCat(l.cat), amt = Math.round(expAmt(l.amount) * 100) / 100, no = D().expenses.length + 1; while (byId(D().expenses, 'exp-' + no)) no++;
      total += amt;
      DB.add('expenses', Object.assign({ id: 'exp-' + no, by: uid, at: NOW(), source: 'recorded', ref: null, amount: amt, cat: l.cat, staff: cat.paysStaff ? st.staff : null }, base), { first: true, where: 'Expense', text: me().name + ' recorded expense ' + cat.name + ': ' + UI.fmt.money(amt) + (base.car ? ' (' + carById(base.car).plate + ')' : '') + (base.booking ? ' for ' + base.booking : '') });
    });
    saved += n;
    var msg = n > 1 ? n + ' expenses saved (' + UI.fmt.money(total) + ' in total)' : 'Expense saved';
    if (again) {
      var keepDay = st.day, keepT = st.dayTouched, keepM = st.method; st = blank(); st.day = keepDay; st.dayTouched = keepT; st.method = keepM; start = sig(); readTicket++;
      dr.setBody(body); dr.body.scrollTop = 0; dr.setFoot(foot()); UI.toast(msg + '. Add the next one.');
    } else { start = sig(); dr.close(true); UI.toast(msg); }
  };
  dr.el.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if ((b = t.closest('[data-day]'))) { keep(dr.body); st.day = b.getAttribute('data-day') === 't' ? today : yest; st.dayTouched = true; redraw(); return; }
    if ((b = t.closest('[data-qc]'))) { keep(dr.body); st.cat = b.getAttribute('data-qc'); redraw(); return; }
    if ((b = t.closest('[data-pm]'))) { keep(dr.body); st.method = b.getAttribute('data-pm'); redraw(); return; }
    if (t.closest('[data-lall]')) { st.all = !st.all; drawLines(); return; }
    if (t.closest('[data-pick]')) { pick(false); return; }
    if (t.closest('[data-cam]')) { pick(true); return; }
    if (t.closest('[data-paste]')) { pasteBtn(); return; }
    if (t.closest('[data-rmrc]')) { keep(dr.body); st.receipt = null; st.shrink = ''; st.dup = ''; st.total = null; st.readText = ''; st.reading = false; readTicket++; st.lines.forEach(function (l) { if (l.auto) { l.amount = ''; l.auto = false; } }); redraw(); return; }
    if (t.closest('[data-save]')) { save(false); return; }
    if (t.closest('[data-save2]')) { save(true); return; }
  });
  return dr;
}

/* ---------- categories manager ---------- */
function expCategories() {
  if (!can('expenses.manage_categories')) { UI.toast('You cannot change the categories. Ask the owner for "Manage expense categories".', { tone: 'warn' }); return; }
  var st = { edit: null, add: null, days: expEditDays() == null ? '' : String(expEditDays()) };
  var rules = function (c) {
    var r = [];
    if (c.fixedAmount) r.push(UI.fmt.money(c.fixedAmount) + (c.agentFee || c.locked ? ' (locked)' : ' (can be changed)'));
    if (c.needsBooking && !c.noBooking) r.push('Must select booking ID'); if (c.noBooking) r.push('No booking');
    if (c.needsCar) r.push('Must select car'); if (c.paysStaff) r.push('Needs To staff'); if (c.alsoKept) r.push('Also kept in Maintenance');
    if (c.agentFee && !c.fixedAmount) r.push('No amount yet');
    return r.join(' · ');
  };
  var form = function (f, isNew) {
    var amt = String(f.fixedAmount == null ? '' : f.fixedAmount).trim(), handover = !!f.agentFee;
    return '<div class="exp-cf" data-cf="' + (isNew ? 'new' : f.id) + '">' + UI.input({ id: 'cf-n', key: 'name', label: 'Name', value: f.name, placeholder: 'For example: Roadside help', maxlength: 60, readonly: handover, help: handover ? 'Handover fee names follow the locations and places in Settings.' : '' }) +
      (handover ? '' : '<div class="inp"><label>Who can use it</label><div class="inv-radios exp-who">' + [['Everyday', 'Anyone who may add expenses can use it (fuel, toll, car wash...)'], ['Office and admin', 'Only people allowed to record office and admin costs (rent, insurance, salary...)']].map(function (g) { return '<button type="button" class="inv-radio" role="radio" data-grp="' + g[0] + '" aria-checked="' + (f.group === g[0]) + '"><span><b>' + g[0] + '</b><small>' + g[1] + '</small></span></button>'; }).join('') + '</div></div>') +
      '<div class="inp"><label>Icon</label><div class="exp-icons">' + EXP_ICONS.map(function (ic) { return '<button type="button" class="exp-ic" data-ic="' + ic + '" aria-pressed="' + (f.icon === ic) + '" aria-label="' + ic.replace(/-/g, ' ') + '">' + i(ic) + '</button>'; }).join('') + '</div></div>' +
      '<div class="exp-cfa"><label class="exp-l">Amount</label><div class="row gap12 wrap">' + UI.input({ id: 'cf-a', key: 'fixedAmount', prefix: 'RM', value: amt, placeholder: 'Typed each time', attrs: { inputmode: 'decimal', 'aria-label': 'Amount (RM)' }, style: 'width:170px' }) +
      UI.switch({ id: 'cf-l', key: 'locked', label: 'Lock amount', checked: handover || (!!f.locked && !!amt), disabled: handover || !amt }) + '</div><p class="b2">' + esc(!amt ? 'Empty: people type the amount each time.' : handover ? 'A handover fee always uses this amount (or the person\'s own rate in Settings > Handover fees).' : f.locked ? 'Every entry uses this amount and it cannot be changed.' : 'The form fills in this amount and people can change it.') + '</p></div>' +
      UI.switch({ id: 'cf-b', key: 'needsBooking', label: 'Must select booking ID', checked: !!f.needsBooking && !f.noBooking, disabled: !!f.noBooking, help: f.noBooking ? 'Off: this one is for trips with no booking.' : 'The entry cannot be saved without a booking.' }) +
      UI.switch({ id: 'cf-c', key: 'needsCar', label: 'Must select car', checked: !!f.needsCar, help: 'The entry cannot be saved without a car. A booking\'s car counts.' }) +
      (handover || f.paysStaff ? '' : UI.switch({ id: 'cf-k', key: 'alsoKept', label: 'Also kept on a service record or a paper', checked: !!f.alsoKept, help: 'Shows a reminder to enter the price in one place only, so it is not counted twice.' })) +
      (f.paysStaff ? '<p class="b2">' + i('user-dollar') + ' Payment to staff asks who it went to. It shows on their Staff report as money they hold and is not a cost of a car or booking.</p>' : '') +
      '<p class="b2 exp-cfh" data-cfh role="status">' + esc(cfHint(f)) + '</p><div class="row gap8 exp-cfb">' + UI.btn('Cancel', { kind: 'g', size: 'sm', attrs: { 'data-cfx': '1' } }) + UI.btn(isNew ? 'Add category' : 'Save', { size: 'sm', icon: 'check', attrs: { 'data-cfs': '1' } }) + '</div></div>';
  };
  /* what is still missing before the category can be saved, as one sentence */
  var cfHint = function (f) {
    var nm = String(f.name || '').trim(), at = String(f.fixedAmount == null ? '' : f.fixedAmount).trim(), miss = [];
    if (!nm) miss.push('type a name');
    if (at && expAmt(at) == null) miss.push('fix the amount (a number above 0 with at most 2 decimals, or empty)');
    if (nm && D().expenseCats.some(function (x) { return x.name.toLowerCase() === nm.toLowerCase() && x.id !== f.id; })) miss.push('choose another name (there is already a category called ' + nm + ')');
    return miss.length ? 'To save, ' + expList(miss) + '.' : 'Ready to save.';
  };
  var daysHtml = function () {
    var wrong = st.days.trim() !== '' && !/^\d+$/.test(st.days.trim()) || st.days.trim() === '0', cur = expEditDays();
    return '<section class="exp-days-box" aria-label="Days to change own entries"><label class="exp-l" for="cf-days">Days people can change or delete their own entries</label><div class="row gap8">' +
      UI.input({ id: 'cf-days', key: 'days', value: st.days, placeholder: 'No limit', attrs: { inputmode: 'numeric', 'aria-label': 'Number of days' }, style: 'width:120px', error: wrong ? 'Enter a whole number of days (1 or more), or leave it empty for no limit.' : '', help: wrong ? '' : 'Leave empty for no limit. Now: ' + (cur == null ? 'no limit' : plural(cur, 'day')) + '.' }) +
      UI.btn('Save', { size: 'sm', attrs: { 'data-dsave': '1' }, disabled: wrong || (st.days.trim() === (cur == null ? '' : String(cur))) }) + '</div></section>';
  };
  var body = function () {
    var all = expCats();
    return '<p class="ui-ctext">What people choose from when they record an expense, and the rules each one has.</p>' + daysHtml() + EXP_GROUPS.map(function (g) {
      var list = all.filter(function (c) { return expGroupOf(c) === g; });
      return '<section class="exp-cg"><h4>' + g + ' <span class="b2">' + list.length + '</span></h4>' + (g === 'Handover fees' ? '<p class="b2 exp-cgh">Made from your locations and places. Each person\'s own amount is set in Settings > Handover fees; a person with no amount cannot pick the kind.</p>' : '') + list.map(function (c, k) {
        if (st.edit && st.edit.id === c.id) return form(st.edit, false);
        var rl = rules(c);
        return '<div class="exp-cr' + (c.hidden ? ' hid' : '') + '"><span class="exp-tile">' + i(c.icon) + '</span><span class="grow">' + esc(c.name) + (c.hidden ? ' ' + UI.chip('Hidden', 'grey') : '') + (rl ? '<small>' + esc(rl) + '</small>' : '') + '</span>' +
          UI.iconBtn(c.hidden ? 'eye-off' : 'eye', c.hidden ? 'Hidden from the list. Press to show it.' : 'Shown in the list. Press to hide it.', { size: 'sm', attrs: { 'data-hide': c.id } }) + UI.iconBtn('pencil', 'Change ' + c.name, { size: 'sm', attrs: { 'data-ce': c.id } }) + (c.agentFee || c.paysStaff ? '' : UI.iconBtn('trash', 'Delete ' + c.name, { size: 'sm', attrs: { 'data-cd': c.id } })) +
          (g === 'Handover fees' ? '' : UI.iconBtn('arrow-up', 'Move ' + c.name + ' up', { size: 'sm', attrs: { 'data-up': c.id, disabled: k === 0 ? 'disabled' : null } }) + UI.iconBtn('arrow-down', 'Move ' + c.name + ' down', { size: 'sm', attrs: { 'data-dn': c.id, disabled: k === list.length - 1 ? 'disabled' : null } })) + '</div>';
      }).join('') + '</section>';
    }).join('') + (st.add ? form(st.add, true) : UI.btn('Add a category', { kind: 'tonal', icon: 'plus', attrs: { 'data-cadd': '1' } }));
  };
  var dl = UI.dialog({ title: 'Expense categories', width: 'md', body: body, buttons: [{ label: 'Done' }] });
  dl.el.classList.add('exp-cats');
  var cur = function () { return st.edit || st.add; };
  var redraw = function () { var sc = dl.body.scrollTop; dl.setBody(body); dl.body.scrollTop = sc; };
  var keepForm = function () { var el = dl.body.querySelector('[data-cf]'); if (!el || !cur()) return; var f = UI.form(el), c = cur(); ['name', 'fixedAmount'].forEach(function (k) { if (f[k] !== undefined) c[k] = f[k]; }); ['locked', 'needsBooking', 'needsCar', 'alsoKept'].forEach(function (k) { if (f[k] !== undefined) c[k] = !!f[k]; }); };
  var move = function (id, dir) { var all = expCats(), c = byId(D().expenseCats, id), list = all.filter(function (x) { return expGroupOf(x) === expGroupOf(c); }), k = list.indexOf(c), o = list[k + dir]; if (!o) return; var t = c.order; c.order = o.order; o.order = t; DB.log('Changed', 'Expense category', id, me().name + ' moved the expense category ' + c.name + ' ' + (dir < 0 ? 'up' : 'down')); emit('data', { coll: 'expenseCats' }); redraw(); };
  dl.body.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-key') === 'days') { st.days = ev.target.value; var b = dl.body.querySelector('[data-dsave]'), cur2 = expEditDays(), v = st.days.trim(); if (b) b.disabled = (v !== '' && !/^[1-9]\d*$/.test(v)) || v === (cur2 == null ? '' : String(cur2)); } });
  dl.body.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-key'); if (k === 'days') { var dv = st.days.trim(); if (dv !== '' && !/^[1-9]\d*$/.test(dv)) redraw(); } else if (k === 'locked') { keepForm(); redraw(); } else if (k === 'fixedAmount') keepForm(); });
  dl.body.addEventListener('input', function (ev) {
    var hk = ev.target.getAttribute('data-key'), hp = dl.body.querySelector('[data-cfh]');
    if (hp && cur() && (hk === 'name' || hk === 'fixedAmount')) { var tmp = Object.assign({}, cur()); tmp[hk] = ev.target.value; if (hk === 'name') cur().name = ev.target.value; hp.textContent = cfHint(tmp); }
    if (hk !== 'fixedAmount') return;
    var has = ev.target.value.trim() !== '', lk = dl.body.querySelector('#cf-l'), c = cur(), ho = c && c.agentFee, p = dl.body.querySelector('.exp-cfa p.b2');
    if (lk && !ho) { lk.disabled = !has; if (!has) lk.checked = false; }
    if (p && !ho) p.textContent = !has ? 'Empty: people type the amount each time.' : lk && lk.checked ? 'Every entry uses this amount and it cannot be changed.' : 'The form fills in this amount and people can change it.'; });
  dl.el.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if (t.closest('[data-dsave]')) {
      var v = st.days.trim(); if (v !== '' && !/^[1-9]\d*$/.test(v)) { redraw(); return; }
      CO().expenseEditDays = v === '' ? null : +v;
      DB.log('Changed', 'Settings', '', me().name + ' set the days people can change their own expenses to ' + (v === '' ? 'no limit' : plural(+v, 'day')));
      emit('data', { coll: 'company' });
      UI.toast(v === '' ? 'People can now change their own entries at any time' : 'People can now change their own entries for ' + plural(+v, 'day'));
      redraw(); return;
    }
    if ((b = t.closest('[data-hide]'))) { var c = byId(D().expenseCats, b.getAttribute('data-hide')); DB.update('expenseCats', c, { hidden: !c.hidden }, { where: 'Expense category', text: me().name + (c.hidden ? ' showed ' : ' hid ') + 'the expense category ' + c.name }); UI.toast(c.name + (c.hidden ? ' is hidden from the list' : ' is shown in the list')); redraw(); return; }
    if ((b = t.closest('[data-ce]'))) { var c2 = byId(D().expenseCats, b.getAttribute('data-ce')); st.add = null; st.edit = Object.assign({}, c2, { fixedAmount: c2.fixedAmount == null ? '' : Number(c2.fixedAmount).toFixed(2) }); redraw(); return; }
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
    if (t.closest('[data-cadd]')) { st.edit = null; st.add = expCatDefaults({ name: '', group: 'Everyday', icon: 'receipt', alsoKept: false, fixedAmount: '' }); redraw(); var n = dl.body.querySelector('[data-key="name"]'); if (n) n.focus(); return; }
    if ((b = t.closest('[data-grp]'))) { keepForm(); cur().group = b.getAttribute('data-grp'); redraw(); return; }
    if ((b = t.closest('[data-ic]'))) { keepForm(); cur().icon = b.getAttribute('data-ic'); redraw(); return; }
    if (t.closest('[data-cfx]')) { st.edit = st.add = null; redraw(); return; }
    if (t.closest('[data-cfs]')) {
      keepForm(); var f = cur(), nm = (f.name || '').trim(), at = String(f.fixedAmount == null ? '' : f.fixedAmount).trim(), av = at ? expAmt(at) : null;
      if (!nm) { UI.toast('Type a name for the category', { tone: 'warn' }); return; }
      if (at && av == null) { UI.toast('The amount must be a number above 0, or left empty.', { tone: 'warn' }); return; }
      if (D().expenseCats.some(function (x) { return x.name.toLowerCase() === nm.toLowerCase() && x.id !== f.id; })) { UI.toast('There is already a category called ' + nm, { tone: 'warn' }); return; }
      var patch = { name: nm, icon: f.icon, alsoKept: !!f.alsoKept, fixedAmount: av, locked: f.agentFee ? true : !!(av && f.locked), needsBooking: f.noBooking ? false : !!f.needsBooking, needsCar: !!f.needsCar };
      if (!f.agentFee) patch.group = f.group;
      if (st.add) { var n2 = D().expenseCats.length + 1; while (byId(D().expenseCats, 'cat-' + n2)) n2++; DB.add('expenseCats', expCatDefaults(Object.assign({ id: 'cat-' + n2, hidden: false, order: Math.max.apply(null, D().expenseCats.map(function (x) { return x.order; })) + 1 }, patch)), { where: 'Expense category', text: me().name + ' added the expense category ' + nm }); UI.toast('Category ' + nm + ' added'); }
      else { DB.update('expenseCats', byId(D().expenseCats, f.id), patch, { where: 'Expense category', text: me().name + ' changed the expense category ' + nm }); UI.toast('Category saved'); }
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
    /* Payment to staff stays in the list but is not spending: totals, parts and kinds leave it out */
    var mS = month.filter(function (e) { return isSpending(e); }), pS = prev.filter(function (e) { return isSpending(e); }), toStaff = sum(month.filter(function (e) { return !isSpending(e); }).map(function (e) { return e.amount; }));
    var tot = sum(mS.map(function (e) { return e.amount; })), ptot = sum(pS.map(function (e) { return e.amount; })), part = function (s) { return sum(mS.filter(function (e) { return e.source === s; }).map(function (e) { return e.amount; })); };
    var vs = ptot ? Math.round(Math.abs(tot - ptot) / ptot * 100) + '% ' + (tot <= ptot ? 'less' : 'more') + ' than ' + expMonthName(pm0) + ' (' + UI.fmt.money(ptot) + ').' : 'Nothing in ' + expMonthName(pm0) + ' to compare with.';
    var f = ctx.state.f = ctx.state.f || {};
    if (!f.order) f.order = 'new';
    var grp = {}; mS.forEach(function (e) { var k = rptExpGroup(e); grp[k] = grp[k] || { k: k, v: 0, n: 0, src: e.source, cat: e.source === 'recorded' ? e.cat : null, icon: e.source === 'job' ? 'tool' : e.source === 'paper' ? 'file-certificate' : expIcon(e) }; grp[k].v += e.amount; grp[k].n++; });
    var kinds = Object.keys(grp).map(function (k) { return grp[k]; }).sort(function (a, b) { return b.v - a.v; }), showAll = ctx.state.allKinds;
    var kindOn = function (k) { return k.cat ? f.cat === k.cat : (f.src === k.src && !f.cat); };
    if (kinds.slice(4).some(kindOn)) showAll = true;
    var bankBtn = typeof API.bankIn === 'function' && ctx.can('expenses.view');
    root.innerHTML = '<div class="exp-head"><div class="grow"><h1>Expenses</h1><p>' + (all ? 'Everything the business spent: what the team recorded, service jobs and car papers.' : 'The expenses you recorded. Add fuel, toll, car wash and other costs the moment you pay.') + '</p></div><div class="row gap8 wrap exp-hacts">' +
      (bankBtn ? UI.btn('Bank in cash', { kind: 'o', icon: 'building-bank', attrs: { 'data-bankin': '1' } }) : '') + (ctx.can('expenses.manage_categories') ? UI.btn('Categories', { kind: 'o', icon: 'category', attrs: { 'data-cats': '1' } }) : '') + (ctx.can('expenses.export') ? UI.btn('Excel', { kind: 'o', icon: 'file-spreadsheet', attrs: { 'data-xl': '1' } }) : '') + (canAdd ? UI.btn('Add expense', { icon: 'plus', cls: 'exp-addb', attrs: { 'data-add': '1' } }) : '') + '</div></div>' +
      '<div class="exp-month"><button type="button" class="ib" data-mon="-1" aria-label="Previous month">' + i('chevron-left') + '</button><b>' + esc(expMonthName(m0)) + '</b><button type="button" class="ib" data-mon="1" aria-label="Next month"' + (mk >= nowM ? ' disabled' : '') + '>' + i('chevron-right') + '</button>' + (mk !== nowM ? '<button type="button" class="inv-link" data-mon="0">This month</button>' : '') + '</div>' +
      '<div class="exp-sum"><div class="card exp-spent"><span class="b2">Spent in ' + esc(expMonthName(m0)) + '</span><b class="exp-big">' + UI.money(tot) + '</b><p class="b2">' + mS.length + (mS.length === 1 ? ' entry. ' : ' entries. ') + esc(vs) + '</p>' + (toStaff ? '<p class="b2 exp-float">' + i('user-dollar') + '<span>Given to staff: <b>' + UI.money(toStaff) + '</b>, not counted as spending</span></p>' : '') + (all ? '<div class="exp-parts">' + [['Recorded', part('recorded'), 'By the team', 'recorded'], ['Service jobs', part('job'), 'From Maintenance', 'job'], ['Papers', part('paper'), 'Road tax, insurance', 'paper']].map(function (p) { return '<button type="button" data-srcpart="' + p[3] + '" aria-pressed="' + (f.src === p[3]) + '"><span>' + p[0] + '</span><b>' + UI.money(p[1]) + '</b><small>' + p[2] + '</small></button>'; }).join('') + '</div>' : '<p class="exp-own">' + i('user') + 'This page shows the expenses you recorded yourself.</p>') + '</div>' +
      '<div class="card exp-where"><h3>Where the money went <span class="b2">Tap a kind to see only its entries</span></h3>' + (kinds.length ? '<div class="exp-kinds">' + (showAll ? kinds : kinds.slice(0, 4)).map(function (k) { var p = tot ? k.v / tot : 0, on2 = kindOn(k); return '<button type="button" class="exp-kind' + (on2 ? ' on' : '') + '" data-kf="' + esc(k.cat || k.src) + '" data-kft="' + (k.cat ? 'cat' : 'src') + '" aria-pressed="' + on2 + '"><span class="exp-ki">' + i(k.icon) + '</span><span class="grow"><span class="row"><span class="grow">' + esc(k.k) + '</span><b>' + UI.money(k.v) + '</b><small>' + Math.round(p * 100) + '%</small></span><i class="exp-bar"><b style="width:' + Math.max(1, p * 100) + '%"></b></i></span></button>'; }).join('') + '</div>' + (kinds.length > 4 ? '<button type="button" class="inv-link exp-more" data-allk>' + (showAll ? 'Show fewer' : 'Show all ' + kinds.length + ' kinds') + '</button>' : '') : '<p class="b2">Nothing spent in this month yet.</p>') + '</div></div>' +
      '<div class="card exp-card"><div id="exp-f"></div><div class="exp-totl" id="exp-totl"></div><div id="exp-t"></div></div>' + (canAdd ? '<button type="button" class="exp-fab" data-add aria-label="Add expense">' + i('plus') + '</button>' : '');
    var cats = expCats(), users = D().users.filter(function (u) { return u.id !== uid && src.some(function (e) { return e.by === u.id; }); });
    var fields = [{ type: 'search', key: 'q', placeholder: 'Kind, car, Booking ID, note or who was paid' },
      { type: 'select', key: 'cat', label: 'Kind', all: 'All kinds', options: EXP_GROUPS.reduce(function (a, g) { return a.concat(cats.filter(function (c) { return expGroupOf(c) === g; }).map(function (c) { return { value: c.id, label: c.name + (c.hidden ? ' (hidden)' : ''), group: g }; })); }, []) },
      { type: 'select', key: 'car', label: 'Car', all: 'Any car', options: [['none', 'Not tied to a car']].concat(D().cars.map(function (c) { return [c.id, c.plate + ' · ' + carModel(c)]; })) }]
      .concat(all ? [{ type: 'select', key: 'by', label: 'Recorded by', all: 'Everyone', options: (uid ? [[uid, 'Me (' + me().name + ')']] : []).concat(users.map(function (u) { return [u.id, u.name]; })) }] : [])
      .concat([{ type: 'select', key: 'order', label: 'Order', all: false, default: 'new', options: [['new', 'Newest first'], ['old', 'Oldest first'], ['big', 'Biggest first'], ['small', 'Smallest first']] }])
      .concat(all ? [{ type: 'chips', key: 'src', options: [['all', 'All', month.length], ['recorded', 'Recorded', month.filter(function (e) { return e.source === 'recorded'; }).length], ['job', 'Service jobs', month.filter(function (e) { return e.source === 'job'; }).length], ['paper', 'Papers', month.filter(function (e) { return e.source === 'paper'; }).length]] }] : []);
    var filt = function () {
      var q = (f.q || '').toLowerCase().trim();
      var rows = month.filter(function (e) {
        if (f.src && f.src !== 'all' && e.source !== f.src) return false;
        if (f.cat && e.cat !== f.cat) return false;
        if (f.car && (f.car === 'none' ? e.car : e.car !== f.car)) return false;
        if (f.by && e.by !== f.by) return false;
        if (q) { var c = rptCarOf(e.car), x = e.booking ? findBooking(e.booking) : null; if ((rptExpName(e) + ' ' + (c ? c.plate + ' ' + c.plate.replace(/ /g, '') + ' ' + carName(c) : '') + ' ' + (e.booking || '') + ' ' + (x ? x.cust.name : '') + ' ' + (e.note || '') + ' ' + (e.paidTo || '') + ' ' + rptWho(e) + ' ' + (e.staff ? staffName(e.staff) : '')).toLowerCase().indexOf(q) < 0) return false; }
        return true;
      });
      var o = f.order || 'new';
      rows.sort(function (a, b) { return o === 'old' ? a.day - b.day || a.at - b.at : o === 'big' ? b.amount - a.amount : o === 'small' ? a.amount - b.amount : b.day - a.day || b.at - a.at; });
      return rows;
    };
    var filtered = function () { return ['q', 'cat', 'car', 'by'].some(function (k) { return f[k]; }) || (f.src && f.src !== 'all'); };
    var totl = function (rows) { var fl = sum(rows.filter(function (e) { return !isSpending(e); }).map(function (e) { return e.amount; })); root.querySelector('#exp-totl').innerHTML = '<span>' + (filtered() ? 'Matching' : 'Showing') + ': <b>' + rows.length + (rows.length === 1 ? ' entry' : ' entries') + '</b>, <b>' + UI.money(sum(rows.filter(function (e) { return isSpending(e); }).map(function (e) { return e.amount; }))) + '</b> spent' + (fl ? ' (and ' + UI.money(fl) + ' given to staff)' : '') + '</span>'; };
    var subOf = function (e) { var c = expCat(e.cat); return [c && c.paysStaff && e.staff ? 'To ' + staffName(e.staff) : '', e.paidTo, e.source !== 'recorded' ? e.note : ''].filter(Boolean).join(' · '); };
    var whatCell = function (e) { var c = expCat(e.cat); return '<div class="exp-what"><span class="exp-tile">' + i(expIcon(e)) + '</span><div><span>' + esc(rptExpName(e)) + (e.source !== 'recorded' ? ' ' + UI.chip(e.source === 'job' ? 'Service job' : 'Paper', 'grey') : c && c.agentFee ? ' ' + UI.chip('Handover fee', 'info') : c && c.paysStaff ? ' ' + UI.chip('Not counted', 'grey', { title: 'Money given to staff, not spending' }) : '') + '</span><small>' + esc(subOf(e)) + '</small></div></div>'; };
    var carCell = function (e) { var c = rptCarOf(e.car); return c ? esc(c.plate) + '<small class="exp-sm">' + esc(carName(c)) + '</small>' : '<span class="b2">Not tied to a car</span>'; };
    var cols = [{ key: 'day', label: 'Day', render: function (e) { return '<span class="nowrap">' + esc(UI.fmt.day(e.day)) + '</span>'; } }, { key: 'what', label: 'What', render: whatCell }, { key: 'car', label: 'Car', render: carCell },
      { key: 'booking', label: 'Booking', render: function (e) { return e.booking ? '<button type="button" class="inv-link" data-bk="' + esc(e.booking) + '" data-stop>' + esc(e.booking) + '</button>' : '<span class="faint">-</span>'; } }]
      .concat(all ? [{ key: 'by', label: 'Recorded by', render: function (e) { return e.by ? esc(e.by === uid ? 'Me' : rptWho(e)) : '<span class="faint">-</span>'; } }] : [])
      .concat([{ key: 'amount', label: 'Amount', money: true, render: function (e) { return '<b class="fw5">' + UI.money(e.amount) + '</b>'; } }, { key: 'clip', label: '', render: function (e) { return e.receipt ? '<span class="exp-clip" title="Receipt attached">' + i('paperclip') + '</span>' : ''; } }]);
    var first = !src.length;
    var t = UI.table(root.querySelector('#exp-t'), { columns: cols, rows: filt(), rowKey: 'id', density: 'compact', minWidth: 900, pageSize: +P.size || 25, pageSizes: [10, 25, 50, 100], page: +P.page || 1, onPage: function (pg) { ctx.setParams({ page: pg > 1 ? pg : null }); },
      onRowClick: function (e) { expOpen(e.id); },
      card: function (e) { var c = rptCarOf(e.car), sub = subOf(e); return '<div class="row gap10"><span class="exp-tile">' + i(expIcon(e)) + '</span><div class="grow"><div class="row"><b class="grow">' + esc(rptExpName(e)) + '</b><b>' + UI.money(e.amount) + '</b></div><div class="b2">' + esc(UI.fmt.day(e.day)) + (c ? ' · ' + esc(c.plate) : '') + (e.booking ? ' · ' + esc(e.booking) : '') + (sub ? ' · ' + esc(sub) : '') + (e.receipt ? ' ' + i('paperclip') : '') + '</div>' + (e.source !== 'recorded' ? UI.chip(e.source === 'job' ? 'Service job' : 'Paper', 'grey') : '') + '</div></div>'; },
      empty: first ? { icon: 'receipt-2', title: 'No expenses yet', text: 'When you pay for fuel, a toll or a car wash, add it here with the day and the amount. A photo of the receipt helps later.', action: canAdd ? UI.btn('Add the first expense', { icon: 'plus', attrs: { 'data-add': '1' } }) : '' } : filtered() ? { icon: 'filter-off', title: 'Nothing matches these filters', text: 'Clear the filters to see every entry of the month.' } : { icon: 'calendar-off', title: 'Nothing has been recorded for this month.', text: canAdd ? 'Add an expense, or go back a month.' : 'Go back a month to see older entries.' } });
    totl(filt());
    UI.filters(root.querySelector('#exp-f'), { values: f, fields: fields, onChange: function () { var r = filt(); t.setRows(r); totl(r); ctx.setParams({ page: null }); root.querySelectorAll('[data-kf]').forEach(function (b) { var on2 = b.getAttribute('data-kft') === 'cat' ? f.cat === b.getAttribute('data-kf') : f.src === b.getAttribute('data-kf') && !f.cat; b.classList.toggle('on', on2); b.setAttribute('aria-pressed', on2); }); } });
    UI.on(root, 'click', '[data-add]', function () { expSheet(); });
    UI.on(root, 'click', '[data-cats]', function () { expCategories(); });
    UI.on(root, 'click', '[data-bankin]', function () { API.bankIn(); });
    UI.on(root, 'click', '[data-bk]', function (ev, el) { API.openBooking(el.getAttribute('data-bk')); });
    UI.on(root, 'click', '[data-allk]', function () { ctx.state.allKinds = !ctx.state.allKinds; ctx.refresh(); });
    UI.on(root, 'click', '[data-kf]', function (ev, el) {
      var v = el.getAttribute('data-kf'), ty = el.getAttribute('data-kft');
      if (ty === 'cat') { if (f.cat === v) f.cat = ''; else { f.cat = v; f.src = 'all'; } }
      else { if (f.src === v && !f.cat) f.src = 'all'; else { f.src = v; f.cat = ''; } }
      ctx.setParams({ page: null }); ctx.refresh();
      var card = root.querySelector('.exp-card'); if (card && card.scrollIntoView && window.innerWidth < 900) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    UI.on(root, 'click', '[data-srcpart]', function (ev, el) { var v = el.getAttribute('data-srcpart'); f.src = f.src === v ? 'all' : v; f.cat = ''; ctx.refresh(); });
    UI.on(root, 'click', '[data-mon]', function (ev, el) { var d2 = +el.getAttribute('data-mon'), nk = d2 === 0 ? null : expMonthKey(new Date(m0.getFullYear(), m0.getMonth() + d2, 1)); ctx.setParams({ m: nk === nowM ? null : nk, page: null }); ctx.refresh(); });
    UI.on(root, 'click', '[data-xl]', function () {
      var rows = filt(), fl = [f.q ? 'search "' + f.q + '"' : '', f.cat ? 'kind ' + (expCat(f.cat) || {}).name : '', f.car ? 'car ' + (f.car === 'none' ? 'none' : carById(f.car).plate) : '', f.by ? 'recorded by ' + (userById(f.by) || {}).name : '', f.src && f.src !== 'all' ? rptSrcLabel(f.src) + ' only' : ''].filter(Boolean).join(', ');
      rptXlsx('expenses-' + mk + '.xlsx', rptExpBook(rows, expMonthName(m0) + ' (' + UI.fmt.date(m0) + ' to ' + UI.fmt.date(new Date(m1.getTime() - DAY)) + ')', fl || (all ? 'None: every entry of the month' : 'Only the expenses you recorded')));
      DB.log('Exported', 'Expense', '', me().name + ' downloaded the expenses of ' + expMonthName(m0) + ' (Excel)');
    });
    /* address actions open once: the parameters are taken off the address straight away (no redraw), so the next visit
       with the same link opens again and a redraw does not open twice */
    if (P.action === 'add') { var pre = {}; ['car', 'booking', 'amount', 'cat', 'staff'].forEach(function (k) { if (P[k]) pre[k] = P[k]; }); ctx.setParams({ action: null, car: null, booking: null, amount: null, cat: null, staff: null }); setTimeout(function () { expSheet(null, pre); }, 30); }
    else if (P.expense) { var xid = P.expense; ctx.setParams({ expense: null }); setTimeout(function () { expOpen(xid); }, 30); }
  }
};
API.addExpense = function (prefill) { if (!can('expenses.add') && !can('expenses.add_business')) { UI.toast('You cannot add expenses.', { tone: 'warn' }); return; } expSheet(null, prefill || {}); };
API.openExpense = function (id) { expOpen(id); };

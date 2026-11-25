/* ---------------- PAYMENTS (M3 builder owns this file) ----------------
   Pay.open(bookingId, {kinds, amount, voidId})  Record payment sheet (or, with voidId, that payment's own sheet: slips, receipt, void)
   Pay.slip(bookingId|null, file)                 Upload payment slips (camera, file, a picture shared from WhatsApp, or a demo sample)
   Pay.record(b, o), Pay.void(b, p, reason)       the shared save rules (slips use the same path as typed payments)
   Pay.viewSlips(bookingId, paymentId)            slip viewer
   Payment fields on top of newPayment(): slips [{src, hash, at, by, note, name}] (the first is also kept in slip/slipHash), made (when it was typed in),
   items[].after (card: the part after the card charge). A 'From deposit' payment adds S.deductions {kind 'Used for a payment', paymentId}. Receipts: invoices.js. */

function normRef(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function payDepositLeft(b) {
  /* a cancelled booking holds all the money paid on it (kept as credit or waiting to be refunded): the same figure as Deposits */
  if (b.bookingStatus === 'Cancelled' && typeof Deposit !== 'undefined') { var x = Deposit.info(b); return x.refund ? 0 : x.net; }
  var got = activePays(b).reduce(function (s, p) { return s + (p.items || []).reduce(function (t, i) { return t + (i.kind === 'Security deposit' ? (i.after != null ? +i.after || 0 : +i.amt || 0) : 0); }, 0); }, 0);
  var kept = (S.deductions || []).filter(function (d) { return d.booking === b.id; }).reduce(function (s, d) { return s + (+d.amt || 0); }, 0);
  var back = (S.refunds || []).filter(function (r) { return r.booking === b.id && !r.voided; }).reduce(function (s, r) { return s + (+r.amt || 0); }, 0);
  return Math.max(0, Math.round((got - kept - back) * 100) / 100);
}
var PAY_SEP = { 'Delivery charge': 'delivery', 'Return charge': 'return', 'Damage coverage': 'coverTotal' };
/* what the booking still expects for each kind (never below zero). Rent = charges less every rent-like payment, less the separate charges ticked beside it. */
function payLeft(b, kind, ticked) {
  var m = calcBooking(b);
  if (kind === 'Security deposit') return Math.max(0, m.deposit - m.depositReceived);
  if (PAY_SEP[kind]) return Math.max(0, m[PAY_SEP[kind]] - paidOf(b, kind));
  if (kind === 'Rental payment') {
    var sep = (ticked || []).reduce(function (s, k) { return s + (PAY_SEP[k] ? Math.max(0, m[PAY_SEP[k]] - paidOf(b, k)) : 0); }, 0);
    return Math.max(0, m.charges - paidOf(b, RENT_LIKE) - sep);
  }
  return null; /* extension and other are never checked */
}
/* the lines that are for more than the booking says. lines [{kind, amt}] */
function payOver(b, lines) {
  var kinds = lines.map(function (l) { return l.kind; }), m = calcBooking(b);
  return lines.map(function (l) {
    var left = payLeft(b, l.kind, kinds), slack = l.kind === 'Rental payment' ? 0.99 : 0.004;
    if (left == null || !(+l.amt > left + slack)) return null;
    var inBooking = l.kind === 'Security deposit' ? m.deposit : PAY_SEP[l.kind] ? m[PAY_SEP[l.kind]] : null, already = l.kind === 'Security deposit' ? m.depositReceived : PAY_SEP[l.kind] ? paidOf(b, l.kind) : paidOf(b, RENT_LIKE);
    return { kind: l.kind, left: left, amt: +l.amt, inBooking: inBooking, already: already };
  }).filter(Boolean);
}
/* asks before saving more than the booking says. Resolves true to record anyway. */
function payOverAsk(over, context) {
  if (!over.length) return Promise.resolve(true);
  var one = over.length === 1 ? over[0] : null, html;
  if (one) {
    var name = one.kind.toLowerCase();
    html = '<p class="pay-over-q">' + (one.inBooking != null ? 'The ' + esc(name) + ' in the booking details is <b>' + rm(one.inBooking) + '</b>' + (one.already > 0 ? ' and <b>' + rm(one.already) + '</b> is already received' : '') :
      'The rent and charges still to pay on this booking come to <b>' + rm(one.left) + '</b>' + (one.already > 0 ? ' (<b>' + rm(one.already) + '</b> is already paid)' : '')) + '. Are you sure you want to record <b>' + rm(one.amt) + '</b> as ' + esc(name) + '?</p>';
  } else {
    html = '<p class="pay-over-q">These amounts are more than the booking details say. Are you sure you want to record them?</p><div class="pay-over-list">' +
      over.map(function (o) { return '<div><b>' + esc(o.kind) + '</b>: booking says ' + rm(o.left) + ', you are recording <b>' + rm(o.amt) + '</b> (' + rm(o.amt - o.left) + ' more)</div>'; }).join('') + '</div>';
  }
  return confirm({ icon: 'warn', title: 'More than the booking says', text: context || '', html: html, ok: 'Yes, record anyway', cancel: 'Go back and check', primary: 'cancel' });
}
function paySig(items, method, ref, note) { return JSON.stringify([items.map(function (i) { return [i.kind, Math.round(+i.amt * 100)]; }), method, String(ref || '').trim(), String(note || '').trim()]); }
/* a slip already kept on an active payment, by its file hash or its reference */
function payFindDup(hash, ref, exceptPayId) {
  var nr = normRef(ref), hit = null;
  S.bookings.some(function (b) {
    return (b.payments || []).some(function (p) {
      if (p.voided || p.id === exceptPayId) return false;
      var byHash = hash && slipsOf(p).some(function (s) { return s.hash && s.hash === hash; }), byRef = nr.length >= 6 && normRef(p.ref) === nr;
      if (byHash || byRef) { hit = { b: b, p: p, how: byHash ? 'hash' : 'ref' }; return true; }
      return false;
    });
  });
  return hit;
}
function payDupText(d) { return 'This slip was already recorded on ' + d.b.code + ' on ' + dFull(d.p.made || d.p.at) + ' (' + cust(d.b.cust).name + ', ' + rm(payTotal(d.p)) + (d.p.ref ? ', reference ' + d.p.ref : '') + ')'; }
function payRerender() { var n = route().name; if (n === 'booking' || n === 'invoices' || n === 'deposit' || n === 'deposits' || n === 'home' || n === 'money') render(false, true); }

var Pay = (function () {
  var KIND_ORDER = PAY_KINDS.slice();
  var METHODS = [['Online Transfer', 'Transfer'], ['Cash', 'Cash'], ['Card', 'Card'], ['Deposit adjustment', 'From deposit']];
  function cardAfter(total) { var f = B().cardFee || { pct: 4, fixed: 1 }, c = Math.round(total * 100), left = c - Math.round(c * (+f.pct || 0) / 100) - Math.round((+f.fixed || 0) * 100); return left > 0 ? left / 100 : null; }
  function feeText() { var f = B().cardFee || { pct: 4, fixed: 1 }; return f.pct + '% + ' + rm(f.fixed); }

  /* ---------- the one save path ---------- */
  function record(b, o) {
    var items = o.items.map(function (i) { var x = { kind: i.kind, amt: Math.round(+i.amt * 100) / 100 }; if (i.after != null) x.after = i.after; return x; });
    var now = Date.now(), sig = paySig(items, o.method, o.ref, o.note);
    var dup = (b.payments || []).filter(function (p) { return !p.voided && p.by === S.me && p.made && now - new Date(p.made).getTime() < 90000 && paySig(p.items || [], p.method, p.ref, p.note) === sig; })[0];
    if (dup) return { pay: dup, duplicate: true, receipt: Docs.receiptOf(b), status: null };
    var p = newPayment({ at: o.at || new Date().toISOString(), items: items, method: o.method, by: S.me, ref: String(o.ref || '').trim(), note: String(o.note || '').trim(),
      cashTo: o.method === 'Cash' && !o.cdm ? (o.cashTo === undefined ? S.me : o.cashTo) : null, afterCharge: o.method === 'Card' && o.afterCharge != null ? o.afterCharge : null, depositOf: o.method === 'Deposit adjustment' ? (o.depositOf || b.id) : null });
    p.made = new Date().toISOString();
    /* cash paid into a bank machine (CDM) is money already in the bank: nobody holds it */
    if (o.cdm && o.method === 'Cash') { p.cdm = true; if (!p.note) p.note = 'Cash deposit machine'; }
    if (o.slips && o.slips.length) { p.slips = o.slips.slice(0, 10); p.slip = p.slips[0].src; p.slipHash = p.slips[0].hash; }
    b.payments = b.payments || []; b.payments.push(p);
    var total = payTotal(p), what = items.map(function (i) { return i.kind + ' ' + rm(i.amt); }).join(', ');
    if (p.method === 'Deposit adjustment') {
      var src = bk(p.depositOf) || b; S.deductions = S.deductions || [];
      S.deductions.push({ id: uid(), booking: src.id, kind: 'Used for a payment', amt: total, note: 'Paid ' + items.map(function (i) { return kindShort(i.kind).toLowerCase(); }).join(', ') + ' on ' + b.code, photo: null, by: S.me, at: p.at, paymentId: p.id });
      if (src.id !== b.id) bLog(src, rm(total) + ' of the deposit used to pay ' + b.code);
    }
    var rc = o.issueReceipt ? Docs.addToReceipt(b, p) : null;
    var ns = o.updateStatus ? nextPaymentStatus(b, items) : null;
    bLog(b, rm(total) + ' received by ' + payMethodText(p).replace(/^Transfer$/, 'transfer').replace(/^Cash/, 'cash').replace(/^Card/, 'card').replace(/^From the/, 'taking it from the') + ': ' + what + (rc ? ' (receipt ' + rc.receipt.no + ')' : '') + (o.fromSlip ? ' from a slip' : ''));
    if (ns) setPaymentStatus(b, ns, 'payment recorded');
    if (p.method === 'Deposit adjustment' && typeof Deposit !== 'undefined' && Deposit.sync) { try { Deposit.sync((bk(p.depositOf) || b).id); } catch (e) { console.error(e); } }
    save();
    return { pay: p, receipt: rc ? rc.receipt : null, made: rc ? rc.made : false, status: ns };
  }
  /* void one payment: returns sentences saying what else changed */
  function voidPay(b, p, reason) {
    if (p.voided) return [];
    var said = [];
    p.voided = true; p.voidReason = reason; p.voidedAt = new Date().toISOString(); p.voidedBy = S.me;
    var r = Docs.dropPayment(b, p); if (r) said.push(r.voided ? 'Receipt ' + r.receipt.no + ' is voided too (no payments left on it)' : 'It is taken off receipt ' + r.receipt.no);
    if (p.method === 'Deposit adjustment') {
      var ded = (S.deductions || []).filter(function (d) { return d.paymentId === p.id; });
      S.deductions = (S.deductions || []).filter(function (d) { return d.paymentId !== p.id; });
      if (ded.length) { var src = bk(ded[0].booking) || b; said.push(rm(ded[0].amt) + ' is given back to the deposit of ' + src.code); if (src.id !== b.id) bLog(src, rm(ded[0].amt) + ' given back to the deposit (payment on ' + b.code + ' voided)'); }
      if (typeof Deposit !== 'undefined' && Deposit.sync) { try { if (Deposit.sync(ded.length ? ded[0].booking : (p.depositOf || b.id))) said.push('The deposit is waiting to be returned again'); } catch (e) { console.error(e); } }
    }
    bLog(b, 'Payment of ' + rm(payTotal(p)) + ' voided: ' + reason);
    var st = statusAfterVoid(b); if (st != null) said.push(st ? 'The booking is back to ' + st : 'The payment status is cleared');
    save();
    return said;
  }

  /* ---------- Record payment sheet ---------- */
  function open(bookingId, opts) {
    opts = opts || {};
    var b = bk(bookingId); if (!b) { say('This booking is not here any more'); return; }
    if (opts.voidId) return detail(b, opts.voidId);
    if (!can('billing.record_payment')) { sheet(sheetHead('Record payment', b.code) + noAccess('billing.record_payment')); return; }
    var depFirst = !b.paymentStatus || b.paymentStatus === 'Deposit Due';
    var preset = (opts.kinds && opts.kinds.length ? opts.kinds : [depFirst && payLeft(b, 'Security deposit') > 0 ? 'Security deposit' : 'Rental payment']);
    var bm = b.method === 'Online Transfer' || b.method === 'Card' || b.method === 'Cash' ? b.method : 'Online Transfer';
    var st = { items: KIND_ORDER.map(function (k) { return { kind: k, on: preset.indexOf(k) >= 0, amt: '', touched: false }; }), method: bm, cashTo: S.me, after: null, depOf: 'this', other: null,
      atMode: 'now', date: toLocalInput(new Date()), time: toTimeInput(new Date()), ref: '', note: '', receipt: can('billing.issue_receipt'), status: null, checked: false, err: '' };
    if (opts.amount != null && st.items.filter(function (i) { return i.on; })[0]) { var f = st.items.filter(function (i) { return i.on; })[0]; f.amt = money2(opts.amount); f.touched = true; }
    var sh = sheet(sheetHead('Record payment', b.code + ' · ' + cust(b.cust).name) + '<div class="pay-body"></div>', null, { full: true, cls: 'pay-sheet',
      guard: function () { return st.dirty && !st.done ? { title: 'Close without recording?', text: 'What you typed will be lost.', ok: 'Close anyway', cancel: 'Keep editing' } : null; } });
    var body = $('.pay-body', sh);
    /* anything typed or picked makes the sheet ask before it closes */
    body.addEventListener('input', function () { st.dirty = true; });
    body.addEventListener('change', function () { st.dirty = true; });
    body.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-tick],[data-quick],[data-meth],[data-when],[data-depof],#paycash,#payother,#payusecr')) st.dirty = true; }, true);

    function ticked() { return st.items.filter(function (i) { return i.on; }); }
    function suggest() {
      var tk = ticked().map(function (i) { return i.kind; });
      var cap = st.method === 'Deposit adjustment' && srcBooking() ? payDepositLeft(srcBooking()) : null;
      if (cap != null) st.items.forEach(function (i) { if (i.on && i.touched) cap -= parseMoney(i.amt) || 0; });
      st.items.forEach(function (i) { if (i.touched) return; var v = payLeft(b, i.kind, tk); if (v != null && cap != null && i.on) { v = Math.max(0, Math.min(v, cap)); cap -= v; } i.amt = v != null && v > 0 ? money2(v) : ''; });
    }
    function total() { return ticked().reduce(function (s, i) { var v = parseMoney(i.amt); return s + (isNaN(v) ? 0 : v); }, 0); }
    function problems() {
      var p = {};
      if (!ticked().length) p.none = 'Tick at least one thing this payment is for.';
      ticked().forEach(function (i) { var a = String(i.amt).trim(); if (!a) p[i.kind] = 'Enter the amount'; else if (isNaN(parseMoney(a))) p[i.kind] = 'Enter an amount like 150 or 150.50'; else if (parseMoney(a) <= 0) p[i.kind] = 'The amount must be more than zero'; });
      return p;
    }
    function atISO() { if (st.atMode === 'now') return new Date().toISOString(); var d = fromInputs(st.date, st.time); return isNaN(d) ? null : d.toISOString(); }
    function srcBooking() { return st.method === 'Deposit adjustment' ? (st.depOf === 'other' ? (st.other ? bk(st.other) : null) : b) : null; }
    function previewStatus() {
      var it = ticked().filter(function (i) { return parseMoney(i.amt) > 0; }).map(function (i) { return { kind: i.kind, amt: parseMoney(i.amt) }; });
      if (!it.length) return null;
      var tmp = newPayment({ items: it }); b.payments.push(tmp); var ns = nextPaymentStatus(b, it); b.payments.pop(); return ns;
    }
    function afterValue() { return st.after != null ? st.after : (cardAfter(total()) != null ? money2(cardAfter(total())) : ''); }

    function html() {
      var m = calcBooking(b), pr = st.checked ? problems() : {}, tk = ticked().map(function (i) { return i.kind; }), fromDep = st.method === 'Deposit adjustment';
      var depL = payLeft(b, 'Security deposit'), rentL = payLeft(b, 'Rental payment', []);
      var h = '';
      if (can('bookings.see_amounts')) h += '<div class="pay-sum"><div><small>Booking total</small><b class="money">' + rm(m.payable) + '</b></div><div><small>Received</small><b class="money">' + rm(m.received) + '</b></div><div><small>' + (m.overpaid ? 'Extra' : 'To collect') + '</small><b class="money ' + (m.due ? 'tone-red-text' : '') + '">' + rm(m.due || m.overpaid) + '</b></div></div>';
      var chips = [];
      if (depL > 0 && rentL > 0 && !fromDep) chips.push('<button type="button" class="fchip" data-quick="bal">Balance <b class="money">' + rm(depL + rentL) + '</b></button>');
      if (depL > 0 && !fromDep) chips.push('<button type="button" class="fchip" data-quick="dep">Deposit <b class="money">' + rm(depL) + '</b></button>');
      if (rentL > 0) chips.push('<button type="button" class="fchip" data-quick="rent">Rent and charges <b class="money">' + rm(rentL) + '</b></button>');
      if (chips.length) h += '<div class="chiprow pay-quick">' + chips.join('') + '</div>';
      var cr = typeof custCredit === 'function' && !fromDep ? custCredit(b.cust) : null;
      if (cr && cr.total > 0) h += '<div class="banner green pay-credit">' + I('cash') + '<div class="grow">' + esc(firstName(cust(b.cust).name)) + ' has <b class="money">' + rm(cr.total) + '</b> credit from ' + esc(cr.rows.map(function (r) { return r.b.code; }).join(', ')) + '.<div><button type="button" class="btn sm ghost" id="payusecr" data-cr="' + cr.rows[0].b.id + '">Pay from credit</button></div></div></div>';
      h += '<div class="pay-h">What is this payment for?</div><div class="small muted pay-hint">Tick everything it paid for and check each amount.</div>';
      h += '<div class="card pay-items' + (pr.none ? ' bad' : '') + '">' + st.items.map(function (i, n) {
        var lock = fromDep && i.kind === 'Security deposit', hint = '';
        if (i.kind === 'Security deposit') hint = lock ? 'A security deposit cannot be paid from a deposit' : 'Booking ' + rm(m.deposit) + (m.depositReceived ? ' · ' + rm(m.depositReceived) + ' received' : '');
        else if (i.kind === 'Rental payment') hint = 'Rent and charges ' + rm(m.charges) + (paidOf(b, RENT_LIKE) ? ' · ' + rm(paidOf(b, RENT_LIKE)) + ' paid' : '');
        else if (PAY_SEP[i.kind]) hint = m[PAY_SEP[i.kind]] ? 'Booking ' + rm(m[PAY_SEP[i.kind]]) + (paidOf(b, i.kind) ? ' · ' + rm(paidOf(b, i.kind)) + ' paid' : '') : 'Not in this booking';
        else hint = 'On top of the booking total';
        return '<div class="pay-it' + (i.on ? ' on' : '') + (lock ? ' lock' : '') + '"><button type="button" class="pay-tick" data-tick="' + n + '"' + (lock ? ' disabled' : '') + ' aria-pressed="' + (i.on ? 'true' : 'false') + '"><span class="box">' + (i.on ? I('check', 3) : '') + '</span><span class="grow"><b>' + esc(i.kind) + '</b><small>' + esc(hint) + '</small></span></button>' +
          (i.on ? '<div class="rmfield pay-amt"><input class="inp num' + (pr[i.kind] ? ' bad' : '') + '" data-amt="' + n + '" inputmode="decimal" placeholder="0.00" value="' + esc(i.amt) + '" aria-label="' + esc(i.kind) + ' amount (RM)"></div>' : '') +
          (pr[i.kind] ? '<span class="err pay-err">' + esc(pr[i.kind]) + '</span>' : '') + '</div>';
      }).join('') + '<div class="pay-tot"><span class="muted" id="paycnt">' + cntText() + '</span><b class="money" id="paytot">Total ' + rm(total()) + '</b></div></div>' +
        (pr.none ? '<span class="err-text">' + pr.none + '</span>' : '') + (tk.length > 1 ? '<div class="hint">Each item is a line of its own, all on the booking’s one receipt.</div>' : '');
      /* method */
      h += '<div class="pay-h">How was it paid?</div><div class="seg pay-meth">' + METHODS.map(function (x) { return '<button type="button" class="' + (st.method === x[0] ? 'on' : '') + '" data-meth="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      if (st.method === 'Online Transfer') { var bank = B().bank; h += '<div class="hint pay-mhint">' + I('bank') + (bank ? 'Goes to the bank: ' + esc(bank.name) + ' · ' + esc(bank.accNo) : 'Goes to the company bank account') + '</div>'; }
      if (st.method === 'Cash') { var p = staff(st.cashTo) || me(); h += '<div class="field"><span>Cash to staff</span><button type="button" class="carfield picked-car pay-cashto" id="paycash"><span class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</span><span class="grow"><span class="pk-plate pay-pn">' + esc(p.name) + (p.id === S.me ? ' (me)' : '') + '</span><span class="pk-sub">Who has the cash now · tap to change</span></span>' + I('chev') + '</button></div>'; }
      if (st.method === 'Card') h += '<label class="field"><span>Amount after charge</span><div class="rmfield"><input class="inp num' + (st.afterErr ? ' bad' : '') + '" id="payafter" inputmode="decimal" value="' + esc(afterValue()) + '"></div>' +
        (st.afterErr ? '<span class="err">' + esc(st.afterErr) + '</span>' : '') + (st.afterErr && st.after != null ? '<span class="hint"><button type="button" class="pay-lnk" id="payafterr">Use ' + feeText() + '</button></span>' : st.afterErr ? '' : '<span class="hint" id="payafterh">' + (st.after != null ? 'Changed by hand. <button type="button" class="pay-lnk" id="payafterr">Use ' + feeText() + '</button>' : cardHint()) + '</span>') + '</label>';
      if (fromDep) {
        var sb = srcBooking(), left = sb ? payDepositLeft(sb) : 0;
        var thisLeft = payDepositLeft(b), thisOff = thisLeft <= 0.004;
        h += '<div class="field"><span>Deposit of</span><div class="seg pay-depof"><button type="button" class="' + (st.depOf === 'this' ? 'on' : '') + '" data-depof="this"' + (thisOff ? ' disabled' : '') + '>This booking (' + esc(b.code) + ')' + (thisOff ? '<small>No deposit left</small>' : '') + '</button><button type="button" class="' + (st.depOf === 'other' ? 'on' : '') + '" data-depof="other">Another booking</button></div>' +
          (st.depOf === 'other' ? '<button type="button" class="carfield ' + (sb ? 'picked-car' : 'empty-car') + '" id="payother">' + I('list') + '<span class="grow">' + (sb ? '<span class="pk-plate pay-pn">' + esc(sb.code) + ' · ' + esc(cust(sb.cust).name) + '</span><span class="pk-sub">Deposit left <span class="money">' + rm(left) + '</span></span>' : 'Choose the booking whose deposit pays this') + '</span>' + I('chev') + '</button>' + (st.otherErr ? '<span class="err">' + esc(st.otherErr) + '</span>' : '') : '') +
          (sb ? '<span class="hint">No money comes in: the amount is taken off the deposit of ' + esc(sb.code) + ' (' + rm(left) + ' left) and the refund of that deposit is smaller by the same amount.</span>' : '') + '</div>';
      }
      /* when */
      h += '<div class="pay-h">Received on</div><div class="chiprow pay-when">' + [['now', 'Now'], ['earlier', 'Earlier today'], ['yesterday', 'Yesterday']].map(function (x) { return '<button type="button" class="fchip' + (st.atMode === x[0] ? ' on' : '') + '" data-when="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<div class="two pay-dt"><input class="inp" type="date" id="paydate" max="' + toLocalInput(new Date()) + '" value="' + esc(st.date) + '" aria-label="Day"><input class="inp" type="time" id="paytime" value="' + esc(st.time) + '" aria-label="Time"></div>' + (st.atErr ? '<span class="err-text">' + esc(st.atErr) + '</span>' : '');
      h += '<label class="field pay-gap"><span>Reference (optional)</span><input class="inp" id="payref" maxlength="100" autocomplete="off" placeholder="Bank transfer reference, card slip number" value="' + esc(st.ref) + '"></label>' +
        '<label class="field"><span>Note (optional)</span><textarea class="inp" id="paynote" rows="2" maxlength="1000">' + esc(st.note) + '</textarea></label>';
      var ps = previewStatus(), stOn = st.status != null ? st.status : !!ps;
      h += '<div class="card pay-sws">' + (can('billing.issue_receipt') ? '<label class="pay-sw"><span class="grow"><b>Create a receipt</b><small>' + (Docs.receiptOf(b) ? 'Adds a line to ' + esc(Docs.receiptOf(b).no) : 'Makes the booking’s receipt') + '</small></span><span class="sw"><input type="checkbox" id="payrcp"' + (st.receipt ? ' checked' : '') + '><i></i></span></label>' : '') +
        '<label class="pay-sw"><span class="grow"><b>Also update the booking’s payment status</b><small id="paysth">' + statusHint(ps) + '</small></span><span class="sw"><input type="checkbox" id="paysts"' + (stOn ? ' checked' : '') + '><i></i></span></label></div>' +
        (!st.receipt && can('billing.issue_receipt') ? '<div class="hint">Without a receipt the payment is still recorded. You can make the receipt later.</div>' : '');
      if (st.err) h += '<div class="banner red pay-errb">' + I('warn') + '<div>' + esc(st.err) + '</div></div>';
      h += '<div class="sheet-foot"><button type="button" class="btn" id="paygo">' + I('cash') + '<span id="paygol">' + goText() + '</span></button></div>';
      return h;
    }
    /* the line the card charge comes off: rent first, else any line but the deposit, else (only the deposit ticked) the deposit itself */
    function chargeLine(lines) { return lines.filter(function (l) { return l.kind === 'Rental payment'; })[0] || lines.filter(function (l) { return l.kind !== 'Security deposit'; })[0] || lines[lines.length - 1]; }
    function cardHint() {
      var tk = ticked(), ln = chargeLine(tk), tot = total(), af = cardAfter(tot), fee = af != null ? Math.round((tot - af) * 100) / 100 : 0;
      if (ln && ln.kind === 'Security deposit') { var d = parseMoney(ln.amt) || 0; return '<span class="tone-amber-text">Only the deposit is ticked, so the ' + (fee ? rm(fee) + ' ' : '') + 'card charge (' + feeText() + ') comes off the deposit' + (fee && d ? ' (' + rm(Math.max(0, d - fee)) + ' to return)' : '') + '. To keep the deposit whole, tick Rent and charges too.</span>'; }
      return 'The card charge is ' + feeText() + '. It comes off ' + (ln ? ln.kind.toLowerCase() : 'the rent') + ', so the deposit stays whole.';
    }
    function cntText() { var n = ticked().length; return n === 0 ? 'Nothing ticked yet' : n === 1 ? '1 item' : n + ' items'; }
    function goText() { var t = total(); return 'Record payment' + (t > 0 ? ' ' + rm(t) : ''); }
    function statusHint(ps) { var cur = b.paymentStatus || 'no status yet'; return ps ? 'Now ' + esc(cur) + ', becomes <b>' + esc(ps) + '</b>' : 'Stays ' + esc(cur) + ' (only ever moves forward)'; }
    function light() {
      var t = $('#paytot', sh); if (t) t.textContent = 'Total ' + rm(total());
      var c = $('#paycnt', sh); if (c) c.textContent = cntText();
      var g = $('#paygol', sh); if (g) g.textContent = goText();
      var a = $('#payafter', sh); if (a && st.after == null && document.activeElement !== a) a.value = afterValue();
      var ah = $('#payafterh', sh); if (ah && st.after == null && !st.afterErr) ah.innerHTML = cardHint();
      var s = $('#paysth', sh); if (s) { var ps = previewStatus(); s.innerHTML = statusHint(ps); if (st.status == null) $('#paysts', sh).checked = !!ps; }
    }
    function draw() { var y = sh.scrollTop; body.innerHTML = html(); wire(); sh.scrollTop = y; }
    function wire() {
      $$('[data-tick]', body).forEach(function (el) { el.onclick = function () { var i = st.items[+el.dataset.tick]; i.on = !i.on; if (!i.on) i.touched = false; suggest(); draw(); if (i.on) { var inp = $('[data-amt="' + el.dataset.tick + '"]', body); if (inp && !inp.value) inp.focus(); } }; });
      $$('[data-amt]', body).forEach(function (el) { el.oninput = function () { var i = st.items[+el.dataset.amt]; i.amt = el.value; i.touched = true; el.classList.remove('bad'); light(); }; });
      $$('[data-quick]', body).forEach(function (el) { el.onclick = function () {
        var q = el.dataset.quick, want = q === 'dep' ? ['Security deposit'] : q === 'rent' ? ['Rental payment'] : ['Security deposit', 'Rental payment'];
        st.items.forEach(function (i) { i.on = want.indexOf(i.kind) >= 0; i.touched = false; }); suggest(); draw();
      }; });
      $$('[data-meth]', body).forEach(function (el) { el.onclick = function () {
        st.method = el.dataset.meth; st.err = ''; st.afterErr = '';
        if (st.method === 'Deposit adjustment') {
          var d = st.items[0]; if (d.on) { d.on = false; d.touched = false; say('A security deposit cannot be paid from a deposit'); if (!ticked().length) st.items[1].on = true; }
          /* nothing left on this booking's deposit: go straight to another booking's */
          if (st.depOf === 'this' && payDepositLeft(b) <= 0.004) { st.depOf = 'other'; suggest(); draw(); if (!st.other) pickOther(); return; }
        }
        suggest(); draw();
      }; });
      var uc = $('#payusecr', body); if (uc) uc.onclick = function () {
        st.method = 'Deposit adjustment'; st.depOf = 'other'; st.other = uc.dataset.cr; st.err = '';
        st.items.forEach(function (i) { if (i.kind === 'Security deposit') { i.on = false; i.touched = false; } }); if (!ticked().length) st.items[1].on = true;
        suggest(); draw();
      };
      var pc = $('#paycash', body); if (pc) pc.onclick = function () { Pickers.staff({ title: 'Who has the cash?', selected: [st.cashTo], onPick: function (p) { if (p) { st.cashTo = p.id; draw(); } } }); };
      var pa = $('#payafter', body); if (pa) pa.oninput = function () { st.after = pa.value; st.afterErr = ''; pa.classList.remove('bad'); var hh = $('#payafterh', body); if (hh) hh.innerHTML = 'Changed by hand. <button type="button" class="pay-lnk" id="payafterr">Use ' + feeText() + '</button>'; var rr = $('#payafterr', body); if (rr) rr.onclick = function () { st.after = null; draw(); }; };
      var par = $('#payafterr', body); if (par) par.onclick = function () { st.after = null; draw(); };
      $$('[data-depof]', body).forEach(function (el) { el.onclick = function () { st.depOf = el.dataset.depof; st.otherErr = ''; suggest(); draw(); if (st.depOf === 'other' && !st.other) pickOther(); }; });
      var po = $('#payother', body); if (po) po.onclick = pickOther;
      $$('[data-when]', body).forEach(function (el) { el.onclick = function () {
        st.atMode = el.dataset.when; st.atErr = ''; var n = new Date();
        if (st.atMode === 'earlier') { var e = new Date(Math.max(sod(n).getTime() + 8 * HOUR, n.getTime() - 2 * HOUR)); if (e > n) e = new Date(sod(n).getTime() + 5 * MIN); st.date = toLocalInput(e); st.time = toTimeInput(e); }
        else if (st.atMode === 'yesterday') { var y = new Date(n.getTime() - DAY); st.date = toLocalInput(y); st.time = toTimeInput(y); }
        else { st.date = toLocalInput(n); st.time = toTimeInput(n); }
        draw();
      }; });
      var pd = $('#paydate', body), pt = $('#paytime', body);
      var dt = function () { st.date = pd.value; st.time = pt.value; st.atMode = 'custom'; st.atErr = ''; $$('[data-when]', body).forEach(function (x) { x.classList.remove('on'); }); };
      pd.onchange = dt; pt.onchange = dt;
      $('#payref', body).oninput = function () { st.ref = this.value; };
      $('#paynote', body).oninput = function () { st.note = this.value; };
      var rc = $('#payrcp', body); if (rc) rc.onchange = function () { st.receipt = rc.checked; draw(); };
      $('#paysts', body).onchange = function () { st.status = this.checked; };
      $('#paygo', body).onclick = submit;
    }
    function pickOther() {
      Pickers.booking({ title: 'Whose deposit pays this?', filter: function (x) { return x.id !== b.id && payDepositLeft(x) > 0; }, selected: st.other,
        first: function (x) { return x.cust === b.cust; }, firstLabel: 'Same customer first', sub: function (x) { return '<span class="pk-dep"><small>Deposit left</small><b class="money">' + rm(payDepositLeft(x)) + '</b></span>'; }, onPick: function (x) { st.other = x.id; st.otherErr = ''; suggest(); draw(); } });
    }
    function submit() {
      st.checked = true; st.err = ''; st.afterErr = ''; st.otherErr = ''; st.atErr = '';
      var pr = problems();
      var fromDep = st.method === 'Deposit adjustment', tk = ticked(), tot = Math.round(total() * 100) / 100;
      if (fromDep && tk.some(function (i) { return i.kind === 'Security deposit'; })) st.err = 'A security deposit cannot be paid from a deposit. Untick Security deposit.';
      var src = srcBooking();
      if (fromDep && st.depOf === 'other' && !src) st.otherErr = 'Choose the booking whose deposit pays this';
      if (fromDep && src && !Object.keys(pr).length && tot > payDepositLeft(src) + 0.004) st.err = 'The deposit of ' + src.code + ' has only ' + rm(payDepositLeft(src)) + ' left. Record the rest with another method.';
      var after = null;
      if (st.method === 'Card') { var av = String(afterValue()).trim(); if (av) { after = parseMoney(av); if (isNaN(after)) st.afterErr = 'Enter an amount like 440 or 440.41'; else if (after > tot) st.afterErr = 'It cannot be more than the amount paid'; } }
      var at = atISO();
      if (!at) st.atErr = 'Choose when the money was received'; else if (new Date(at).getTime() > Date.now() + 60000) st.atErr = 'The time cannot be in the future';
      if (Object.keys(pr).length || st.err || st.afterErr || st.otherErr || st.atErr) {
        draw(); var bad = $('.err, .err-text, .pay-errb', body); if (bad) bad.scrollIntoView({ block: 'center', behavior: 'smooth' }); return;
      }
      var lines = tk.map(function (i) { return { kind: i.kind, amt: parseMoney(i.amt) }; });
      if (st.method === 'Card' && after != null) {
        var charge = Math.round((tot - after) * 100) / 100, take = chargeLine(lines);
        if (charge >= 0 && take && take.amt >= charge) lines.forEach(function (l) { l.after = Math.round((l.amt - (l === take ? charge : 0)) * 100) / 100; });
      }
      payOverAsk(payOver(b, lines)).then(function (go) {
        if (!go) return;
        var ps = previewStatus(), stOn = st.status != null ? st.status : !!ps;
        var res = record(b, { items: lines, method: st.method, cashTo: st.cashTo, afterCharge: after, depositOf: fromDep ? (src || b).id : null, ref: st.ref, note: st.note, at: at, issueReceipt: st.receipt && can('billing.issue_receipt'), updateStatus: stOn });
        success(res);
        payRerender();
      });
    }
    function success(res) {
      st.done = true;
      var p = res.pay, tot = payTotal(p), cu = cust(b.cust);
      var h = '<div class="pay-done"><div class="pay-done-ic">' + I('check', 3) + '</div><h3>Payment of ' + rm(tot) + ' recorded</h3>' +
        (res.duplicate ? '<div class="banner amber">' + I('info') + '<div>The same payment was recorded a moment ago, so it was not added twice.</div></div>' : '') +
        '<div class="card pay-done-items">' + (p.items || []).map(function (i) { return '<div class="iv-line"><div class="grow">' + esc(i.kind) + '</div><div class="money">' + rm(i.amt) + '</div></div>'; }).join('') +
        '<div class="iv-line tot"><div class="grow">Total · ' + esc(payMethodText(p)) + '</div><div class="money">' + rm(tot) + '</div></div></div>' +
        (res.receipt ? '<div class="banner green">' + I('receipt') + '<div>Receipt <b>' + esc(res.receipt.no) + '</b> is ready' + (res.made ? '' : ' (this payment is added to it)') + '.</div></div>' : '<div class="banner blue">' + I('info') + '<div>No receipt was made. You can make it later in Invoice and receipts.</div></div>') +
        (res.status ? '<div class="banner blue">' + I('info') + '<div>The booking’s payment status is now <b>' + esc(res.status) + '</b>.</div></div>' : '') +
        '</div><div class="sheet-foot stack">' + (res.receipt && can('billing.send') ? '<button type="button" class="btn big" id="pdwa">' + I('wa') + 'Send receipt on WhatsApp</button>' : '') +
        '<div class="btnrow"><button type="button" class="btn ghost" id="pdslip">' + I('camera') + 'Add slip photo</button>' + (res.receipt ? '<button type="button" class="btn ghost" id="pdview">' + I('receipt') + 'See receipt</button>' : '') + '</div>' +
        '<div class="btnrow pay-done-end">' + (res.duplicate ? '' : '<button type="button" class="btn link red" id="pdundo">Undo (10)</button>') + '<button type="button" class="btn link" id="pdok">Done</button></div></div>';
      body.innerHTML = h; sh.scrollTop = 0;
      var w = $('#pdwa', body); if (w) w.onclick = function () { Docs.sendWa('receipt', res.receipt.id); };
      var v = $('#pdview', body); if (v) v.onclick = function () { Docs.previewReceipt(res.receipt); };
      $('#pdslip', body).onclick = function () { addSlip(b, p, function () { var s = $('#pdslip', body); if (s) s.innerHTML = I('check', 2.4) + 'Slip added (' + slipsOf(p).length + ')'; }); };
      $('#pdok', body).onclick = function () { closeSheet(); };
      var u = $('#pdundo', body);
      if (u) {
        var left = 10, tm = setInterval(function () { left--; if (!document.body.contains(u)) { clearInterval(tm); return; } if (left <= 0) { clearInterval(tm); u.remove(); return; } u.textContent = 'Undo (' + left + ')'; }, 1000);
        u.onclick = function () { clearInterval(tm); var said = voidPay(b, p, 'Undone right after recording'); closeSheet(); payRerender(); say('Payment undone' + (said.length ? '. ' + said.join('. ') : '')); };
      }
    }
    suggest(); draw();
    return sh;
  }

  /* ---------- one payment: details, slips, receipt, void ---------- */
  function detail(b, payId) {
    var p = byId(b.payments || [], payId); if (!p) { say('This payment is not here any more'); return; }
    var sh = sheet('<div class="pd-body"></div>', null, { cls: 'pay-detail' }), body = $('.pd-body', sh);
    function draw() {
      var sl = slipsOf(p), rcp = (S.receipts || []).filter(function (r) { return (r.lines || []).indexOf(p.id) >= 0; }).sort(function (x, y) { return (x.voided ? 1 : 0) - (y.voided ? 1 : 0); })[0], src = p.depositOf && bk(p.depositOf);
      var kv = function (k, v) { return v ? '<div class="pd-kv"><span>' + k + '</span><b>' + v + '</b></div>' : ''; };
      var h = sheetHead('Payment of ' + rm(payTotal(p)), b.code + ' · ' + cust(b.cust).name) +
        (p.voided ? '<div class="banner red">' + I('warn') + '<div><b>Voided</b> ' + (p.voidedAt ? 'on ' + esc(dFull(p.voidedAt)) : '') + (p.voidedBy ? ' by ' + esc(who(p.voidedBy)) : '') + ': ' + esc(p.voidReason || '') + '</div></div>' : '') +
        '<div class="card pay-done-items">' + (p.items || []).map(function (i) { return '<div class="iv-line"><div class="grow">' + esc(i.kind) + (i.after != null ? '<small>' + rm(i.after) + ' after the card charge</small>' : '') + '</div><div class="money"' + (p.voided ? ' style="text-decoration:line-through"' : '') + '>' + rm(i.amt) + '</div></div>'; }).join('') + '</div>' +
        '<div class="card pd-kvs">' + kv('How', esc(payMethodText(p))) + kv('Received on', esc(dFull(p.at) + ', ' + hm(p.at))) + kv('Recorded by', esc(who(p.by) || 'Unknown') + (p.made ? ' · ' + esc(dShort(p.made)) + ' ' + hm(p.made) : '')) +
        kv('Reference', esc(p.ref || '')) + kv('Note', esc(p.note || '')) + kv('Receipt', rcp ? '<button type="button" class="pay-lnk" id="pdrcp">' + esc(rcp.no) + (rcp.voided ? ' (void)' : '') + '</button>' : p.voided ? '' : 'None yet') + '</div>' +
        (src && src.id !== b.id ? '<div class="hint">Taken off the deposit of <a href="#booking/' + src.id + '">' + esc(src.code) + '</a>.</div>' : '') +
        '<div class="sec"><h2>Slips</h2><span class="small muted">' + sl.length + ' of 10</span></div>' +
        (sl.length ? '<div class="thumbs pd-thumbs">' + sl.map(function (s, n) { return '<button type="button" class="thumb" data-slip="' + n + '" aria-label="Look at slip ' + (n + 1) + '"><img alt="" src="' + slipSrc(s.src, p, b) + '"></button>'; }).join('') + '</div>' : '<div class="small muted pd-noslip">No slip kept with this payment</div>') +
        '<div class="sheet-foot stack">' +
        (!p.voided && can('billing.record_payment') && sl.length < 10 ? '<button type="button" class="btn ghost" id="pdadd">' + I('camera') + 'Add slip</button>' : '') +
        (!p.voided && rcp && !rcp.voided && can('billing.send') ? '<button type="button" class="btn" id="pdsend">' + I('wa') + 'Send receipt on WhatsApp</button>' : '') +
        (!p.voided && (!rcp || rcp.voided) && can('billing.issue_receipt') ? '<button type="button" class="btn" id="pdmk">' + I('receipt') + 'Create receipt</button>' : '') +
        (!p.voided && can('billing.void') ? '<button type="button" class="btn link red" id="pdvoid">Void this payment</button>' : '') + '</div>';
      body.innerHTML = h;
      $$('[data-slip]', body).forEach(function (el) { el.onclick = function () { viewSlips(b.id, p.id, +el.dataset.slip); }; });
      var r = $('#pdrcp', body); if (r) r.onclick = function () { Docs.previewReceipt(rcp); };
      var a = $('#pdadd', body); if (a) a.onclick = function () { addSlip(b, p, draw); };
      var s = $('#pdsend', body); if (s) s.onclick = function () { Docs.sendWa('receipt', rcp.id); };
      var mk = $('#pdmk', body); if (mk) mk.onclick = function () { var res = Docs.addToReceipt(b, p); bLog(b, 'Receipt ' + res.receipt.no + (res.made ? ' created' : ' updated') + ' for a payment of ' + rm(payTotal(p))); save(); say('Receipt ' + res.receipt.no + ' is ready'); draw(); payRerender(); };
      var v = $('#pdvoid', body); if (v) v.onclick = function () { askVoid(b, p, function () { closeSheet(); payRerender(); }); };
    }
    draw();
    return sh;
  }
  function askVoid(b, p, done) {
    if (!can('billing.void')) { say('Ask the owner for Void payments access'); return; }
    var dep = (p.items || []).some(function (i) { return i.kind === 'Security deposit'; });
    sheet('<div class="confirm"><div class="confirm-ic danger">' + I('warn', 2) + '</div><h3>Void this payment of ' + rm(payTotal(p)) + '?</h3><p class="lead">It stays on record, marked VOID, and comes off the booking’s receipt.' +
      (p.method === 'Deposit adjustment' ? ' The amount goes back to the deposit it was taken from.' : '') + (dep && b.paymentStatus === 'Deposit Received' ? ' The booking may go back to Deposit Due.' : '') + '</p>' +
      '<label class="field"><span>Reason</span><textarea class="inp" id="pvr" rows="2" maxlength="300" placeholder="For example: wrong amount"></textarea><span class="err" id="pvre" hidden>Type why it is being voided</span></label>' +
      '<div class="sheet-foot stack"><button type="button" class="btn danger solid" id="pvgo">Void payment</button><button type="button" class="btn link" onclick="closeSheet()">Keep it</button></div></div>', function (sh) {
        setTimeout(function () { var t = $('#pvr', sh); if (t) t.focus(); }, 300);
        $('#pvgo', sh).onclick = function () {
          var why = $('#pvr', sh).value.trim();
          if (!why) { $('#pvre', sh).hidden = false; $('#pvr', sh).classList.add('bad'); return; }
          var said = voidPay(b, p, why); closeSheet();
          setTimeout(function () { if (done) done(); say('Payment voided' + (said.length ? '. ' + said.join('. ') : '')); }, 30);
        };
      }, { stack: true });
  }

  /* ---------- slips: pictures ---------- */
  function slipSvg(o) {
    var bank = o.bank || 'Bank', col = { 'Maybank': '#F2B705', 'CIMB': '#B5121B', 'Public Bank': '#C8102E', 'RHB': '#0067B1', 'Hong Leong': '#1A3C8F', 'Bank Islam': '#B0005A', 'DuitNow QR': '#E6007E' }[bank] || '#3B4250';
    var at = new Date(o.at || Date.now()), t = function (x, y, s, w, c, a) { return '<text x="' + x + '" y="' + y + '" font-size="' + s + '" font-weight="' + (w || 400) + '" fill="' + (c || '#16181D') + '"' + (a ? ' text-anchor="' + a + '"' : '') + '>' + esc(s0(arguments[6])) + '</text>'; };
    function s0(v) { return v == null ? '' : v; }
    var desc = esc(JSON.stringify({ bank: bank, amount: o.amount, ref: o.ref, at: at.toISOString(), from: o.from || '' }));
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 400" font-family="Arial,sans-serif"><desc>' + desc + '</desc><rect width="240" height="400" fill="#F3F4F6"/><rect x="10" y="10" width="220" height="380" rx="10" fill="#fff"/>' +
      '<rect x="10" y="10" width="220" height="54" rx="10" fill="' + col + '"/><rect x="10" y="50" width="220" height="14" fill="' + col + '"/>' + t(120, 43, 17, 700, '#fff', 'middle', bank) +
      '<circle cx="120" cy="96" r="17" fill="#E6F5EC"/><path d="M111 96l6 6 12-12" stroke="#138A4B" stroke-width="4" fill="none" stroke-linecap="round"/>' + t(120, 134, 12, 700, '#138A4B', 'middle', 'Transfer successful') +
      t(120, 168, 24, 800, '#16181D', 'middle', rm(o.amount)) +
      '<path d="M26 186h188" stroke="#E6E8EC"/>' + t(26, 208, 10, 400, '#697080', '', 'Date and time') + t(214, 208, 10, 700, '#16181D', 'end', dFull(at) + ' ' + hm(at)) +
      t(26, 232, 10, 400, '#697080', '', 'Reference') + t(214, 232, 10, 700, '#16181D', 'end', o.ref || '') +
      t(26, 256, 10, 400, '#697080', '', 'From') + t(214, 256, 10, 700, '#16181D', 'end', String(o.from || '').slice(0, 22)) +
      t(26, 280, 10, 400, '#697080', '', 'To') + t(214, 280, 10, 700, '#16181D', 'end', String(B().name || '').toUpperCase().slice(0, 22)) +
      t(26, 304, 10, 400, '#697080', '', 'Account') + t(214, 304, 10, 700, '#16181D', 'end', B().bank ? B().bank.accNo : '') +
      '<path d="M26 322h188" stroke="#E6E8EC" stroke-dasharray="4 3"/>' + t(120, 346, 9, 400, '#9AA0AC', 'middle', 'Keep this as proof of payment') + t(120, 372, 8, 400, '#B4610B', 'middle', 'Demo slip with made-up data') + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function svgFacts(src) { if (!/^data:image\/svg/.test(src || '')) return null; try { var s = decodeURIComponent(src.split(',')[1]), m = s.match(/<desc>([\s\S]*?)<\/desc>/); if (!m) return null; return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); } catch (e) { return null; } }
  /* how a kept slip is drawn: the old 'demo:slip:' placeholders get a full made-up slip from the payment itself */
  function slipSrc(src, p, b) {
    if (/^demo:slip/.test(src || '') && p) { var banks = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong']; return slipSvg({ bank: banks[parseInt(strHash(p.id).slice(0, 4), 36) % banks.length], amount: payTotal(p), ref: p.ref || '', at: p.at, from: b ? cust(b.cust).name.toUpperCase() : '' }); }
    return imgSrc(src);
  }
  function viewSlips(bookingId, payId, start) {
    var b = bk(bookingId), p = b && byId(b.payments || [], payId); if (!p) return;
    var sl = slipsOf(p);
    sheet(sheetHead('Slips', b.code + ' · ' + rm(payTotal(p))) + '<div class="sv-list">' + sl.map(function (s, n) {
      return '<figure class="sv" id="sv' + n + '"><button type="button" class="sv-img" aria-label="Zoom">' + (/^data:application\/pdf/.test(s.src || '') ? '<div class="sl-pdf">PDF</div>' : '<img alt="Slip ' + (n + 1) + '" src="' + slipSrc(s.src, p, b) + '">') + '</button>' +
        '<figcaption>Slip ' + (n + 1) + (s.at ? ' · added ' + esc(dShort(s.at)) + ' ' + hm(s.at) : '') + (s.by ? ' by ' + esc(firstName(who(s.by))) : '') + (s.note ? '<br>' + esc(s.note) : '') + '</figcaption></figure>';
    }).join('') + '</div><div class="hint sv-tip">Tap a slip to zoom in.</div>', function (sh) {
      $$('.sv-img', sh).forEach(function (el) { el.onclick = function () { el.classList.toggle('zoom'); }; });
      if (start) setTimeout(function () { var f = $('#sv' + start, sh); if (f) f.scrollIntoView(); }, 50);
    }, { full: true, stack: true, cls: 'sv-sheet' });
  }
  /* ask for a picture: camera, a file, or a demo sample. cb(list of {src, hash, note, name}) */
  function pickPicture(cb, opts) {
    opts = opts || {};
    sheet('<h3>Add a slip</h3><p class="lead">A photo of the transfer slip or the screenshot the customer sent.</p><div class="sl-pick">' +
      '<button type="button" class="btn" data-pp="cam">' + I('camera') + 'Take a photo</button>' +
      '<button type="button" class="btn ghost" data-pp="file">' + I('image') + 'Choose from phone</button>' +
      '<button type="button" class="btn ghost" data-pp="sample">' + I('receipt') + 'Use a sample slip (demo)</button>' +
      (opts.dupDemo ? '<button type="button" class="btn link" data-pp="dup">Try a slip that was already recorded (demo)</button>' : '') + '</div>', function (sh) {
        $$('[data-pp]', sh).forEach(function (el) { el.onclick = function () { var k = el.dataset.pp; closeSheet(); setTimeout(function () { getPictures(k, cb, opts); }, 60); }; });
      }, { stack: true });
  }
  function getPictures(k, cb, opts) {
    var max = opts.max || 10;
    if (k === 'cam') Media.photo({ capture: 'environment', maxPx: 1100, quality: .62 }).then(function (r) { cb([{ src: r.dataUrl, hash: r.hash, note: r.note, name: r.name }]); }, function () {});
    else if (k === 'file') {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf'; inp.multiple = max > 1; inp.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0'; document.body.appendChild(inp);
      inp.onchange = function () {
        var fs = Array.prototype.slice.call(inp.files || []); inp.remove(); if (!fs.length) return;
        if (fs.length > max) { say('Only ' + max + ' more slip' + (max === 1 ? '' : 's') + ' can be added. The first ' + max + ' were used.'); fs = fs.slice(0, max); }
        Promise.all(fs.map(function (f) {
          if (/pdf/.test(f.type) && f.size > 400 * 1024) return Promise.resolve({ bad: f.name + ': this PDF is too big for the demo (keep it under 400 KB)' });
          if (!/^image\/(jpe?g|png|webp)$/.test(f.type) && !/pdf/.test(f.type)) return Promise.resolve({ bad: (f.name || 'This file') + ': only JPG, PNG, WEBP or PDF files can be used as a slip' });
          return Media.fromFile(f, { maxPx: 1100, quality: .62 }).then(function (r) { return { src: r.dataUrl, hash: r.hash, note: r.note, name: r.name }; }, function () { return { bad: (f.name || 'A file') + ' could not be read' }; });
        })).then(function (rs) { var bad = rs.filter(function (r) { return r.bad; }); if (bad.length) say(bad[0].bad); var ok = rs.filter(function (r) { return !r.bad; }); if (ok.length) cb(ok); });
      };
      inp.click();
    } else if (k === 'sample') cb([sample(opts.booking, opts.amount)]);
    else if (k === 'dup') { var d = dupSample(); if (d) cb([d]); else say('No recorded slip to copy yet'); }
  }
  var BANKS = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong', 'Bank Islam', 'DuitNow QR'];
  function sample(bookingId, amount) {
    var b = bookingId && bk(bookingId);
    if (!b) { var due = S.bookings.filter(function (x) { return x.bookingStatus !== 'Cancelled' && UPCOMING.concat(['Car Delivered']).indexOf(x.bookingStatus) >= 0 && calcBooking(x).due > 0; }); b = due[Math.floor(Math.random() * due.length)]; }
    var amt = amount != null ? amount : b ? expectAmount(b) : 150 + Math.round(Math.random() * 400);
    var o = { bank: BANKS[Math.floor(Math.random() * BANKS.length)], amount: amt || 100, ref: (Math.random() < .5 ? 'M' : 'C') + Math.floor(1e9 + Math.random() * 8e9), at: new Date(Date.now() - Math.round(Math.random() * 50 + 3) * MIN).toISOString(), from: b ? cust(b.cust).name.toUpperCase() : 'CUSTOMER' };
    var src = slipSvg(o);
    return { src: src, hash: strHash(src), note: 'Sample slip (demo)', name: 'sample-slip.jpg' };
  }
  function dupSample() {
    var best = null;
    S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (!p.voided && slipsOf(p).length && slipsOf(p)[0].hash && (!best || new Date(p.at) > new Date(best.p.at))) best = { b: b, p: p }; }); });
    if (!best) return null;
    var s = slipsOf(best.p)[0], src = slipSrc(s.src, best.p, best.b);
    return { src: src, hash: s.hash, note: 'Sample: the same picture as a slip already kept (demo)', name: 'slip.jpg' };
  }
  function expectAmount(b) { var dl = payLeft(b, 'Security deposit'); if ((!b.paymentStatus || b.paymentStatus === 'Deposit Due') && dl > 0) return dl; var m = calcBooking(b); return m.due || dl || payLeft(b, 'Rental payment', []); }
  function readSlip(src, expect) {
    var f = svgFacts(src);
    if (f) return new Promise(function (res) { later(function () { var d = new Date(f.at); res({ amount: f.amount, date: toLocalInput(d), time: toTimeInput(d), ref: f.ref, bank: f.bank, from: f.from, confidence: 96 }); }, 850); });
    if (/^data:application\/pdf/.test(src || '')) return Media.readSlip(src, { expect: expect, delay: 1100 }).then(function (r) { r.confidence = Math.min(r.confidence, 80); return r; });
    return Media.readSlip(src, { expect: expect });
  }
  /* add a slip to a payment that is already recorded */
  function addSlip(b, p, done) {
    if (p.voided) { say('A voided payment takes no new slips'); return; }
    if (slipsOf(p).length >= 10) { say('A payment can keep at most 10 slips'); return; }
    pickPicture(function (list) {
      var s = list[0]; if (!s) return;
      if (slipsOf(p).some(function (x) { return x.hash && x.hash === s.hash; })) { say('This slip is already kept with this payment'); return; }
      var d = payFindDup(s.hash, '', p.id);
      if (d) { confirm({ icon: 'danger', title: 'Slip already recorded', text: payDupText(d) + '. It cannot be added again.', ok: 'Open ' + d.b.code, cancel: 'Close', primary: 'cancel' }).then(function (go) { if (go) location.hash = '#booking/' + d.b.id; }); return; }
      if (!p.slips) p.slips = slipsOf(p).slice();
      p.slips.push({ src: s.src, hash: s.hash, at: new Date().toISOString(), by: S.me, name: s.name || '', note: '' });
      p.slip = p.slips[0].src; p.slipHash = p.slips[0].hash;
      bLog(b, 'Slip added to the payment of ' + rm(payTotal(p))); save();
      say('Slip added to the payment' + (s.note && !/demo/.test(s.note) ? '. ' + s.note : '')); if (done) done(); payRerender();
    }, { booking: b.id, max: 1, amount: payTotal(p) });
  }

  /* ---------- Upload payment slip sheet ---------- */
  var SHORT = { 'Security deposit': 'Deposit', 'Rental payment': 'Rent', 'Delivery charge': 'Delivery', 'Return charge': 'Return', 'Damage coverage': 'Damage cover', 'Extension payment': 'Extension', 'Other payment': 'Other' };
  function slip(bookingId, file) {
    if (!can('billing.record_payment')) { sheet(sheetHead('Upload payment slip', '') + noAccess('billing.record_payment')); return; }
    var fixed = bookingId && bk(bookingId), cards = [], seq = 0;
    var sh = sheet('<div class="sheet-head"><div class="grow"><h3>Upload payment slip</h3><p class="lead">' + (fixed ? esc(fixed.code + ' · ' + cust(fixed.cust).name) : 'Pick the booking for each slip') + '</p></div><button class="iconbtn" type="button" id="slx" aria-label="Close">' + I('x', 2.2) + '</button></div>' +
      '<div class="sl-body"><div class="sl-cards"></div><div class="sl-add"></div></div><div class="sheet-foot" id="slfoot"></div>', null, { full: true, cls: 'sl-sheet' });
    $('#slx', sh).onclick = function () {
      var open = cards.filter(function (c) { return c.status !== 'done'; }).length;
      if (!open) { closeSheet(); return; }
      confirm({ icon: 'warn', title: 'Close without recording?', text: open + ' slip' + (open === 1 ? ' is' : 's are') + ' not recorded yet. They will be lost.', ok: 'Close anyway', cancel: 'Keep them', primary: 'cancel' }).then(function (go) { if (go) setTimeout(function () { closeSheet(); }, 40); });
    };
    function add(list) {
      list.forEach(function (s) {
        if (cards.length >= 10) { say('Up to 10 slips at a time. Record these first.'); return; }
        var n = new Date(), c = { id: 'c' + (++seq), src: s.src, hash: s.hash, note: s.note || '', name: s.name || '', status: 'reading', booking: fixed ? fixed.id : null, kind: fixed ? kindFor(fixed) : 'Security deposit', kindTouched: false,
          split: false, parts: [], amount: '', method: 'Online Transfer', after: null, date: toLocalInput(n), time: toTimeInput(n), ref: '', errors: {}, reading: null };
        if (cards.some(function (x) { return x.hash === c.hash; })) c.inList = true;
        c.dup = payFindDup(c.hash, '');
        cards.push(c);
        readSlip(c.src, c.booking ? expectAmount(bk(c.booking)) : null).then(function (r) {
          if (!document.body.contains(sh)) return;
          c.reading = r; c.amount = money2(r.amount); c.date = r.date; c.time = r.time; c.ref = r.ref || ''; c.status = 'ready';
          if (!c.dup) c.dup = payFindDup(c.hash, c.ref);
          if (!c.booking && r.from) {
            var hits = S.bookings.filter(function (b) { return b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Completed' && String(cust(b.cust).name).toUpperCase() === r.from && (calcBooking(b).due > 0 || payLeft(b, 'Security deposit') > 0); });
            var exact = hits.filter(function (b) { return Math.abs(expectAmount(b) - r.amount) < 0.005; });
            if (exact.length) hits = exact;
            hits.sort(function (a, z) { return Math.abs(new Date(a.start) - Date.now()) - Math.abs(new Date(z.start) - Date.now()); });
            if (hits.length) { c.booking = hits[0].id; c.matched = exact.length ? 'name and amount' : 'name'; c.kind = kindFor(hits[0]); }
          }
          autoSplit(c); drawCard(c); foot();
        }, function () { c.status = 'ready'; c.readFail = true; drawCard(c); foot(); });
      });
      drawAll();
    }
    function kindFor(b) { return (!b.paymentStatus || b.paymentStatus === 'Deposit Due') && payLeft(b, 'Security deposit') > 0 ? 'Security deposit' : 'Rental payment'; }
    function owed(b) { var m = calcBooking(b); return [['Security deposit', payLeft(b, 'Security deposit')], ['Rental payment', Math.max(0, m.charges - m.delivery - m['return'] - paidOf(b, ['Rental payment', 'Damage coverage']))], ['Delivery charge', payLeft(b, 'Delivery charge')], ['Return charge', payLeft(b, 'Return charge')]]; }
    /* parts always share out the amount paid (the slip amount); on a card the charge then comes off the rent part, as on the Record payment sheet */
    function basis(c) { return parseMoney(c.amount); }
    function autoSplit(c) {
      if (c.kindTouched || c.status === 'done' || !c.booking) return;
      var left = Math.round((basis(c) || 0) * 100), parts = [];
      if (!(left > 0)) return;
      owed(bk(c.booking)).forEach(function (o) { var ow = Math.round(o[1] * 100); if (left <= 0 || ow <= 0) return; var take = Math.min(left, ow); parts.push({ kind: o[0], amt: take }); left -= take; });
      if (!parts.length) return;
      if (left > 0) parts[parts.length - 1].amt += left;
      if (parts.length === 1) { c.kind = parts[0].kind; c.split = false; c.parts = []; }
      else { c.kind = parts[0].kind; c.split = true; c.parts = parts.map(function (x) { return { kind: x.kind, amt: money2(x.amt / 100) }; }); c.autoSplit = true; }
    }
    function partsSum(c) { return c.parts.reduce(function (s, x) { var v = parseMoney(x.amt); return s + (isNaN(v) ? 0 : v); }, 0); }
    function cardStatus(c) { if (c.status === 'done') return chip('Recorded', 'green'); if (c.status === 'reading') return chip('Reading the slip', 'blue'); if (c.dup || c.inList || c.status === 'error' || Object.keys(c.errors).length) return chip('Needs attention', 'red'); return chip('Not recorded yet', 'grey'); }
    function cardHtml(c, n) {
      var b = c.booking && bk(c.booking), e = c.errors, isPdf = /^data:application\/pdf/.test(c.src || '');
      var h = '<div class="sl-top"><button type="button" class="sl-thumb" data-view="' + c.id + '" aria-label="Look at the slip larger">' + (isPdf ? '<div class="sl-pdf">PDF</div>' : '<img alt="" src="' + imgSrc(c.src) + '">') + '</button>' +
        '<div class="grow"><b>Slip ' + (n + 1) + '</b>' + cardStatus(c) + (c.note ? '<small>' + esc(c.note) + '</small>' : '') + '</div>' +
        (c.status !== 'done' ? '<button type="button" class="iconbtn" data-rm="' + c.id + '" aria-label="Remove this slip from the list">' + I('trash') + '</button>' : '') + '</div>';
      if (c.status === 'done') {
        var r = c.result;
        return h + '<div class="banner green">' + I('check') + '<div>Recorded on <b>' + esc(b.code) + '</b>: ' + rm(payTotal(r.pay)) + ' ' + esc(r.pay.items.map(function (i) { return SHORT[i.kind].toLowerCase(); }).join(' and ')) + (r.receipt ? '. Receipt ' + esc(r.receipt.no) + ' is ready' : '') + (r.status ? '. Payment status is now ' + esc(r.status) : '') + (r.duplicate ? '. It was already recorded a moment ago, so it was not added twice' : '') + '.</div></div>' +
          '<div class="btnrow">' + (r.receipt && can('billing.send') ? '<button type="button" class="btn sm" data-sendr="' + c.id + '">' + I('wa') + 'Send receipt</button>' : '') + '<a class="btn sm ghost" href="#booking/' + b.id + '">Open ' + esc(b.code) + '</a></div>';
      }
      var dupBanner = c.dup ? '<div class="banner red">' + I('warn') + '<div>' + esc(payDupText(c.dup)) + '. It cannot be recorded again.' + (c.dup.how === 'ref' ? ' If the reference was read or typed wrong, correct it below.' : '') + '<br><a href="#booking/' + c.dup.b.id + '">Open ' + esc(c.dup.b.code) + '</a></div></div>' : '';
      if (c.dup && c.dup.how !== 'ref') return h + dupBanner;
      h += dupBanner;
      if (c.inList) return h + '<div class="banner red">' + I('warn') + '<div>This picture is already in the list above. Remove one of them.</div></div>';
      if (c.status === 'reading') return h + '<div class="sl-reading"><span class="spin"></span>Reading the slip...</div>';
      if (c.readFail) h += '<div class="banner amber">' + I('info') + '<div>Nothing could be read from this slip. Type the details in.</div></div>';
      else if (c.reading) h += '<div class="banner blue sl-read">' + I('info') + '<div><b>Read from the slip: check it.</b> ' + esc(c.reading.bank || '') + (c.reading.confidence ? ' · ' + c.reading.confidence + '% sure' : '') + '</div></div>';
      /* booking */
      var bh = '';
      if (b) { var m = calcBooking(b), got = m.received + m.extra; bh = '<span class="pk-plate pay-pn">' + esc(b.code) + ' · ' + esc(cust(b.cust).name) + '</span><span class="pk-sub">' + (got > 0 ? 'Received so far <span class="money">' + rm(got) + '</span>' + recvParts(b) : 'Nothing received yet') + '</span><span class="pk-sub">Deposit <span class="money">' + rm(m.deposit) + '</span> · Rental charges <span class="money">' + rm(m.charges) + '</span></span>'; }
      h += '<div class="field"><span>Booking</span>' + (fixed ? '<div class="carfield picked-car sl-fixed"><span class="grow">' + bh + '</span></div>' :
        '<button type="button" class="carfield ' + (b ? 'picked-car' : 'empty-car') + (e.booking ? ' bad' : '') + '" data-pickb="' + c.id + '">' + I('list') + '<span class="grow">' + (b ? bh : 'Choose the booking this slip is for') + '</span>' + I('chev') + '</button>') +
        (c.matched && b && !fixed ? '<span class="hint">Matched by the ' + c.matched + ' on the slip: check it</span>' : '') + (e.booking ? '<span class="err">' + e.booking + '</span>' : '') + '</div>';
      /* amount + method */
      h += '<div class="two"><label class="field"><span>Amount on the slip</span><div class="rmfield"><input class="inp num' + (e.amount ? ' bad' : '') + '" data-f="amount" data-c="' + c.id + '" inputmode="decimal" value="' + esc(c.amount) + '"></div>' + (e.amount ? '<span class="err">' + e.amount + '</span>' : '') + '</label>' +
        '<label class="field"><span>Paid by</span><select class="inp" data-f="method" data-c="' + c.id + '">' + [['Online Transfer', 'Transfer'], ['Cash', 'Cash deposit'], ['Card', 'Card']].map(function (x) { return '<option value="' + x[0] + '"' + (c.method === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div>';
      if (c.method === 'Card') { var av = c.after != null ? c.after : (cardAfter(parseMoney(c.amount) || 0) != null ? money2(cardAfter(parseMoney(c.amount) || 0)) : ''); h += '<label class="field"><span>Amount after charge</span><div class="rmfield"><input class="inp num' + (e.after ? ' bad' : '') + '" data-f="after" data-c="' + c.id + '" inputmode="decimal" value="' + esc(av) + '"></div>' + (e.after ? '<span class="err">' + e.after + '</span>' : '<span class="hint">The card charge is ' + feeText() + '.</span>') + '</label>'; }
      /* what for */
      if (!c.split) {
        var hint = b ? (c.kind === 'Security deposit' ? 'Booking deposit ' + rm(calcBooking(b).deposit) : c.kind === 'Rental payment' ? 'Rental charges ' + rm(calcBooking(b).charges) : '') : '';
        h += '<div class="field"><span>What is it for?</span><div class="seg sl-kinds">' + PAY_KINDS.map(function (k) { return '<button type="button" class="' + (c.kind === k ? 'on' : '') + '" data-kind="' + k + '" data-c="' + c.id + '">' + SHORT[k] + '</button>'; }).join('') + '</div>' + (hint ? '<span class="hint sl-khint">' + esc(hint) + '</span>' : '') +
          '<button type="button" class="pay-lnk" data-split="' + c.id + '">This slip paid for more than one thing</button></div>';
      } else {
        var sum = partsSum(c), tgt = basis(c) || 0, gap = Math.round((tgt - sum) * 100) / 100;
        h += '<div class="field"><span>What is it for?</span><div class="hint sl-split-h">Split the slip into the things it paid for. The parts must add up to the amount on the slip' + (c.method === 'Card' ? ' (the card charge comes off the rent part)' : '') + '.' + (c.autoSplit ? ' Split for you from what the booking still expects: check it.' : '') + '</div><div class="sl-parts">' +
          c.parts.map(function (x, i) { return '<div class="sl-part"><select class="inp" data-pk="' + i + '" data-c="' + c.id + '">' + PAY_KINDS.map(function (k) { return '<option value="' + k + '"' + (x.kind === k ? ' selected' : '') + '>' + SHORT[k] + '</option>'; }).join('') + '</select><div class="rmfield"><input class="inp num" data-pa="' + i + '" data-c="' + c.id + '" inputmode="decimal" value="' + esc(x.amt) + '"></div><button type="button" class="iconbtn" data-prm="' + i + '" data-c="' + c.id + '" aria-label="Remove this part">' + I('x', 2.2) + '</button></div>'; }).join('') + '</div>' +
          '<div class="sl-gap ' + (Math.abs(gap) < 0.005 ? 'ok' : 'off') + '" id="gap' + c.id + '">' + gapText(gap) + '</div>' +
          (e.parts ? '<span class="err">' + e.parts + '</span>' : '') +
          '<div class="sl-plinks">' + (c.parts.length < PAY_KINDS.length ? '<button type="button" class="pay-lnk" data-padd="' + c.id + '">Add a part</button>' : '') + '<button type="button" class="pay-lnk" data-single="' + c.id + '">Back to one payment</button></div></div>';
      }
      h += '<div class="two"><label class="field"><span>Money received on</span><input class="inp" type="date" data-f="date" data-c="' + c.id + '" max="' + toLocalInput(new Date()) + '" value="' + esc(c.date) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" data-f="time" data-c="' + c.id + '" value="' + esc(c.time) + '"></label></div>' + (e.at ? '<span class="err-text">' + e.at + '</span>' : '') +
        '<label class="field"><span>Reference (optional)</span><input class="inp' + (e.ref || c.dup ? ' bad' : '') + '" data-f="ref" data-c="' + c.id + '" maxlength="100" value="' + esc(c.ref) + '" placeholder="From the slip"></label>' + (e.ref ? '<span class="err">' + e.ref + '</span>' : '') +
        (c.status === 'error' && c.msg ? '<div class="banner red">' + I('warn') + '<div>' + esc(c.msg) + '</div></div>' : '') +
        (cards.length > 1 && !c.dup ? '<button type="button" class="btn sm sl-rec" data-rec="' + c.id + '">' + I('check', 2.4) + 'Record this slip</button>' : '');
      return h;
    }
    function recvParts(b) { var parts = [['Security deposit', 'deposit'], ['Rental payment', 'rental'], ['Delivery charge', 'delivery'], ['Return charge', 'return'], ['Damage coverage', 'damage cover'], ['Extension payment', 'extension'], ['Other payment', 'other']].filter(function (x) { return paidOf(b, x[0]) > 0; }).map(function (x) { return x[1] + ' ' + rm(paidOf(b, x[0])); }); return parts.length ? ' (' + esc(parts.join(', ')) + ')' : ''; }
    function gapText(gap) { return Math.abs(gap) < 0.005 ? 'The parts add up to the amount' : gap > 0 ? rm(gap) + ' still to place' : 'The parts are ' + rm(-gap) + ' more than the amount'; }
    function drawAll() {
      $('.sl-cards', sh).innerHTML = cards.map(function (c, n) { return '<div class="card sl-card' + (c.status === 'done' ? ' done' : '') + '" id="sl' + c.id + '">' + cardHtml(c, n) + '</div>'; }).join('');
      cards.forEach(function (c) { wireCard(c); });
      var left = 10 - cards.length;
      $('.sl-add', sh).innerHTML = !cards.length ? '<div class="sl-empty">' + I('receipt') + '<b>Add the slip pictures</b><span>Each one gets its own card. Check the booking, the amount and what it was for, then record it. The payment and its receipt are made and the slip is kept with them.</span></div>' +
        '<div class="sl-pick"><button type="button" class="btn" data-pp="cam">' + I('camera') + 'Take a photo</button><button type="button" class="btn ghost" data-pp="file">' + I('image') + 'Choose from phone</button><button type="button" class="btn ghost" data-pp="sample">' + I('receipt') + 'Use a sample slip (demo)</button><button type="button" class="btn link" data-pp="dup">Try a slip that was already recorded (demo)</button></div>' :
        left > 0 ? '<button type="button" class="btn ghost sl-more" data-more="1">' + I('plus', 2.2) + 'Add another slip</button>' : '<div class="hint">Up to 10 slips at a time.</div>';
      $$('[data-pp]', sh).forEach(function (el) { el.onclick = function () { getPictures(el.dataset.pp, add, { booking: fixed && fixed.id, max: 10 - cards.length }); }; });
      var mo = $('[data-more]', sh); if (mo) mo.onclick = function () { pickPicture(add, { booking: fixed && fixed.id, max: 10 - cards.length, dupDemo: true }); };
      foot();
    }
    function drawCard(c) { var el = $('#sl' + c.id, sh); if (!el) return drawAll(); el.className = 'card sl-card' + (c.status === 'done' ? ' done' : ''); el.innerHTML = cardHtml(c, cards.indexOf(c)); wireCard(c); }
    function foot() {
      var ready = cards.filter(function (c) { return c.status === 'ready' || c.status === 'error'; }).filter(function (c) { return !c.dup && !c.inList; }), done = cards.filter(function (c) { return c.status === 'done'; }).length, bad = cards.filter(function (c) { return c.dup || c.inList || c.status === 'error'; }).length;
      var txt = !cards.length ? 'No slips added yet' : (done ? done + ' of ' + cards.length + ' recorded' : cards.length + ' slip' + (cards.length === 1 ? '' : 's')) + (bad ? ', ' + bad + ' need' + (bad === 1 ? 's' : '') + ' attention' : '');
      var btn = ready.length > 1 ? '<button type="button" class="btn" id="slall">' + I('check', 2.4) + 'Record all (' + ready.length + ')</button>' : ready.length === 1 ? '<button type="button" class="btn" id="slall">' + I('check', 2.4) + 'Record this slip</button>' : cards.length && done === cards.length ? '<button type="button" class="btn" onclick="closeSheet()">Done</button>' : '<button type="button" class="btn" disabled>' + (cards.some(function (c) { return c.status === 'reading'; }) ? 'Reading...' : 'Record') + '</button>';
      $('#slfoot', sh).innerHTML = '<div class="small muted sl-sum">' + esc(txt) + '</div>' + btn;
      var all = $('#slall', sh); if (all) all.onclick = function () { recordMany(ready); };
    }
    function wireCard(c) {
      var el = $('#sl' + c.id, sh); if (!el) return;
      $$('[data-view]', el).forEach(function (x) { x.onclick = function () { sheet(sheetHead('Slip', c.note || '') + '<div class="sv-list"><figure class="sv"><button type="button" class="sv-img">' + (/^data:application\/pdf/.test(c.src) ? '<div class="sl-pdf">PDF</div>' : '<img alt="Slip" src="' + imgSrc(c.src) + '">') + '</button></figure></div>', function (s2) { $('.sv-img', s2).onclick = function () { this.classList.toggle('zoom'); }; }, { full: true, stack: true, cls: 'sv-sheet' }); }; });
      $$('[data-rm]', el).forEach(function (x) { x.onclick = function () { cards = cards.filter(function (y) { return y !== c; }); cards.forEach(function (y) { y.inList = cards.some(function (z) { return z !== y && z.hash === y.hash && cards.indexOf(z) < cards.indexOf(y); }); }); drawAll(); }; });
      $$('[data-pickb]', el).forEach(function (x) { x.onclick = function () { Pickers.booking({ title: 'Which booking is this slip for?', selected: c.booking, onPick: function (b) { c.booking = b.id; c.matched = false; delete c.errors.booking; if (!c.kindTouched) c.kind = kindFor(b); autoSplit(c); drawCard(c); foot(); } }); }; });
      $$('[data-f]', el).forEach(function (x) {
        var f = x.dataset.f, ev = x.tagName === 'SELECT' || x.type === 'date' || x.type === 'time' ? 'onchange' : 'oninput';
        x[ev] = function () {
          if (f === 'after') c.after = x.value; else c[f] = x.value;
          if (f === 'amount' || f === 'ref') delete c.errors[f];
          if (f === 'method') { c.after = null; autoSplit(c); drawCard(c); return; }
          if (f === 'ref') {
            var d = payFindDup(c.hash, c.ref);
            if (!!d !== !!c.dup || (d && d.p !== c.dup.p)) {
              c.dup = d; drawCard(c); foot();
              var ri = $('#sl' + c.id + ' [data-f="ref"]', sh); if (ri) { ri.focus(); try { ri.setSelectionRange(ri.value.length, ri.value.length); } catch (er) {} }
            }
            return;
          }
          if ((f === 'amount' || f === 'after') && c.split) { var g = $('#gap' + c.id, sh), gap = Math.round(((basis(c) || 0) - partsSum(c)) * 100) / 100; if (g) { g.textContent = gapText(gap); g.className = 'sl-gap ' + (Math.abs(gap) < 0.005 ? 'ok' : 'off'); } }
        };
        if (f === 'amount') x.onblur = function () { if (!c.kindTouched && c.booking) { autoSplit(c); drawCard(c); } };
      });
      $$('[data-kind]', el).forEach(function (x) { x.onclick = function () { c.kind = x.dataset.kind; c.kindTouched = true; drawCard(c); }; });
      $$('[data-split]', el).forEach(function (x) { x.onclick = function () { var a = parseMoney(c.amount); c.split = true; c.kindTouched = true; c.autoSplit = false; var nx = PAY_KINDS.filter(function (k) { return k !== c.kind; })[0]; c.parts = [{ kind: c.kind, amt: isNaN(a) ? '' : money2(a) }, { kind: nx, amt: '' }]; drawCard(c); }; });
      $$('[data-single]', el).forEach(function (x) { x.onclick = function () { c.split = false; c.kind = (c.parts[0] || {}).kind || c.kind; c.parts = []; c.kindTouched = true; delete c.errors.parts; drawCard(c); }; });
      $$('[data-padd]', el).forEach(function (x) { x.onclick = function () { var used = c.parts.map(function (p) { return p.kind; }), nx = PAY_KINDS.filter(function (k) { return used.indexOf(k) < 0; })[0], gap = Math.round(((basis(c) || 0) - partsSum(c)) * 100) / 100; c.parts.push({ kind: nx, amt: gap > 0 ? money2(gap) : '' }); c.kindTouched = true; c.autoSplit = false; drawCard(c); }; });
      $$('[data-prm]', el).forEach(function (x) { x.onclick = function () { c.parts.splice(+x.dataset.prm, 1); c.kindTouched = true; if (c.parts.length < 2) { c.split = false; c.kind = (c.parts[0] || {}).kind || c.kind; c.parts = []; } drawCard(c); }; });
      $$('[data-pk]', el).forEach(function (x) { x.onchange = function () { c.parts[+x.dataset.pk].kind = x.value; c.kindTouched = true; c.autoSplit = false; }; });
      $$('[data-pa]', el).forEach(function (x) { x.oninput = function () { c.parts[+x.dataset.pa].amt = x.value; c.kindTouched = true; c.autoSplit = false; var g = $('#gap' + c.id, sh), gap = Math.round(((basis(c) || 0) - partsSum(c)) * 100) / 100; if (g) { g.textContent = gapText(gap); g.className = 'sl-gap ' + (Math.abs(gap) < 0.005 ? 'ok' : 'off'); } }; });
      $$('[data-rec]', el).forEach(function (x) { x.onclick = function () { recordMany([c]); }; });
      $$('[data-sendr]', el).forEach(function (x) { x.onclick = function () { Docs.sendWa('receipt', c.result.receipt.id); }; });
    }
    function validate(c) {
      var e = {}, a = String(c.amount).trim();
      if (!c.booking) e.booking = 'Choose the booking this slip is for';
      if (!a) e.amount = 'Type the amount shown on the slip'; else if (isNaN(parseMoney(a))) e.amount = 'Enter an amount like 150 or 150.50'; else if (parseMoney(a) <= 0) e.amount = 'The amount must be more than zero';
      if (c.method === 'Card' && c.after != null && String(c.after).trim()) { var af = parseMoney(c.after); if (isNaN(af)) e.after = 'Enter an amount like 440 or 440.41'; else if (!e.amount && af > parseMoney(a)) e.after = 'It cannot be more than the amount paid'; }
      if (c.split && !e.amount) {
        var tgt = basis(c), kinds = c.parts.map(function (p) { return p.kind; });
        if (c.parts.length < 2) e.parts = 'Add at least two parts, or go back to one payment.';
        else if (kinds.some(function (k, i) { return kinds.indexOf(k) !== i; })) e.parts = 'Each type can be used once. Add the amounts of the same type together.';
        else if (c.parts.some(function (p) { return !(parseMoney(p.amt) > 0); })) e.parts = 'Each part needs an amount like 150 or 150.50';
        else if (Math.abs(partsSum(c) - tgt) >= 0.005) e.parts = 'The parts add up to ' + rm(partsSum(c)) + ' but the slip shows ' + rm(tgt) + '.';
      }
      var d = fromInputs(c.date || '', c.time || '');
      if (!c.date || isNaN(d)) e.at = 'Choose when the money was received'; else if (d.getTime() > Date.now() + 5 * MIN) e.at = 'The date cannot be in the future';
      if (String(c.ref).length > 100) e.ref = 'At most 100 characters';
      return e;
    }
    function lineList(c) {
      var a = parseMoney(c.amount), after = c.method === 'Card' ? (c.after != null && String(c.after).trim() ? parseMoney(c.after) : cardAfter(a)) : null;
      if (c.split) return { lines: c.parts.map(function (p) { return { kind: p.kind, amt: parseMoney(p.amt) }; }), after: after, scale: c.method === 'Card' && after != null };
      return { lines: [{ kind: c.kind, amt: a }], after: after };
    }
    function recordMany(list) {
      var i = 0;
      var next = function () {
        if (i >= list.length) { foot(); payRerender(); var ok = list.filter(function (c) { return c.status === 'done'; }).length; if (list.length > 1) say(ok ? ok + ' of ' + list.length + ' slips recorded' : 'Nothing was recorded. Check the slips marked Needs attention.'); return; }
        var c = list[i++]; if (c.status === 'done' || c.dup || c.inList) return next();
        c.errors = validate(c); c.msg = '';
        if (Object.keys(c.errors).length) { c.status = 'error'; c.msg = 'Check the highlighted fields, then record this slip again.'; drawCard(c); if (list.length === 1) { var bad = $('#sl' + c.id + ' .err, #sl' + c.id + ' .err-text', sh); if (bad) bad.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return next(); }
        var d = payFindDup(c.hash, c.ref); if (d) { c.dup = d; drawCard(c); return next(); }
        var b = bk(c.booking), ll = lineList(c), lines = ll.lines;
        /* card on a split slip: the parts are of the amount after charge, so the amount paid goes on the rent part */
        if (ll.scale) { var charge = Math.round((parseMoney(c.amount) - ll.after) * 100) / 100, take = chargeLine(lines); if (charge >= 0 && take && take.amt >= charge) lines.forEach(function (l) { l.after = Math.round((l.amt - (l === take ? charge : 0)) * 100) / 100; }); }
        else if (c.method === 'Card' && ll.after != null) { lines[0].after = ll.after; }
        payOverAsk(payOver(b, lines), 'Slip ' + (cards.indexOf(c) + 1) + ' · ' + b.code).then(function (go) {
          if (!go) { c.status = 'error'; c.msg = 'Not recorded: the amount is more than the booking says. Check it, then record again.'; drawCard(c); return next(); }
          var res = record(b, { items: lines, method: c.method, cashTo: null, cdm: c.method === 'Cash', afterCharge: c.method === 'Card' ? ll.after : null, ref: c.ref, note: '', at: fromInputs(c.date, c.time).toISOString(),
            slips: [{ src: c.src, hash: c.hash, at: new Date().toISOString(), by: S.me, name: c.name, note: c.note }], issueReceipt: can('billing.issue_receipt'), updateStatus: lines.some(function (l) { return l.kind !== 'Other payment'; }), fromSlip: true });
          c.status = 'done'; c.result = res; drawCard(c); next();
        });
      };
      next();
    }
    drawAll();
    if (file) Media.fromFile(file, { maxPx: 1100, quality: .62 }).then(function (r) { add([{ src: r.dataUrl, hash: r.hash, note: r.note || 'Shared from another app', name: r.name }]); }, function () { say('The shared picture could not be read'); });
    return sh;
  }

  return { open: open, slip: slip, record: record, 'void': voidPay, askVoid: askVoid, detail: function (bookingId, payId) { var b = bk(bookingId); if (b) detail(b, payId); }, viewSlips: viewSlips, addSlip: function (bookingId, payId) { var b = bk(bookingId), p = b && byId(b.payments || [], payId); if (p) addSlip(b, p); },
    slipSrc: slipSrc, over: payOver, left: payLeft, depositLeft: payDepositLeft };
})();

/* #slip: the share target (a picture shared from WhatsApp) and a plain entry point */
var _slipOpened = false;
window.addEventListener('hashchange', function () { if (route().name !== 'slip') _slipOpened = false; });
VIEWS.slip = function () {
  return { html: topbar('Upload payment slip', { back: '#home' }) + '<main><div class="empty sl-route">' + I('receipt') + '<div><b>Payment slips</b><br>Record a transfer from the slip the customer sent.</div>' +
    '<button type="button" class="btn" style="margin-top:14px" onclick="Pay.slip(null)">' + I('camera') + 'Upload a slip</button></div></main>',
    after: function () {
      if (_slipOpened || SHEETS.length) return; _slipOpened = true;
      Share.takeShared().then(function (f) { if (route().name === 'slip' && !SHEETS.length) Pay.slip(null, f || null); });
    } };
};

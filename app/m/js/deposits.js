/* ---------------- DEPOSITS (M4) ----------------
   Deposit.open(bookingId)    the deposit sheet: received, adjustments, amount to return, return it, statement, reopen
   Deposit.adjust(bookingId)  the same sheet, straight at the adjustments (after a return)
   Deposit.statement(id)      the A4 statement DEP-<code>
   Deposit.info(b)            the figures (used by money.js and the list)
   Deposit.sync(bookingId)    used-up rule: call after a payment from a deposit is recorded or voided
   #deposits list, #deposit/<bookingId> opens the list with the sheet.
   Rules follow the reference: a refund is recorded once, more than due is refused, less than due asks what the rest is kept for. */
var DED_KINDS = ['Damage', 'Fuel', 'Cleaning', 'Summons', 'Late return fee', 'Other'];
var REFUND_METHODS = [
  { v: 'Bank transfer', icon: 'bank', hint: 'Online transfer from the company bank. Add the transfer slip: it is read for you.' },
  { v: 'Card', icon: 'cash', hint: 'Refunded to the customer’s card.' },
  { v: 'Cash', icon: 'cash', hint: 'Handed back in cash. Choose who gave it.' }
];
var depList = { tab: 'wait', q: '', chip: '' };
VIEW_STATE.push(function () { depList = { tab: 'wait', q: '', chip: '' }; });

var Deposit = (function () {
  function sen(n) { return Math.round((+n || 0) * 100) / 100; }
  function deds(bId) { return (S.deductions || []).filter(function (d) { return d.booking === bId; }); }
  function refundOf(bId) { var r = (S.refunds || []).filter(function (x) { return x.booking === bId && !x.voided; }); return r[r.length - 1] || null; }
  /* every payment by id, and payments made from each booking's deposit */
  function index() {
    var pays = {}, byDep = {};
    S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { pays[p.id] = { p: p, b: b }; if (!p.voided && p.method === 'Deposit adjustment' && p.depositOf) (byDep[p.depositOf] = byDep[p.depositOf] || []).push({ p: p, b: b }); }); });
    return { pays: pays, byDep: byDep };
  }
  /* the 'Used for a payment' lines: stored ones whose payment is still active, plus payments from this deposit with no line yet */
  function usedLines(b, ix) {
    ix = ix || index();
    var out = [], seen = {};
    deds(b.id).forEach(function (d) {
      if (d.kind !== 'Used for a payment') return;
      if (d.paymentId) { var hit = ix.pays[d.paymentId]; if (!hit || hit.p.voided) return; seen[d.paymentId] = 1; }
      out.push(d);
    });
    (ix.byDep[b.id] || []).forEach(function (x) {
      if (seen[x.p.id]) return;
      var what = ((x.p.items || [])[0] || {}).kind || 'payment';
      out.push({ id: 'pay-' + x.p.id, booking: b.id, kind: 'Used for a payment', amt: payTotal(x.p), note: 'Paid ' + what.toLowerCase() + (x.b.id !== b.id ? ' of ' + x.b.code : ''), at: x.p.at, by: x.p.by, paymentId: x.p.id, virtual: true });
    });
    return out;
  }
  function info(b, ix) {
    var m = calcBooking(b), cancelled = b.bookingStatus === 'Cancelled';
    var received = cancelled ? m.received + m.extra : m.depositReceived, agreed = cancelled ? 0 : m.deposit;
    var refund = refundOf(b.id), notRecorded = received <= 0;
    var basis = refund && refund.received != null ? +refund.received : (notRecorded ? agreed : received);
    var adj = deds(b.id).filter(function (d) { return d.kind !== 'Used for a payment'; }), used = usedLines(b, ix);
    var adjTotal = sen(adj.reduce(function (s, d) { return s + (+d.amt || 0); }, 0)), usedTotal = sen(used.reduce(function (s, d) { return s + (+d.amt || 0); }, 0));
    var takenOff = sen(adjTotal + usedTotal), net = Math.max(0, sen(basis - takenOff));
    var state = refund ? 'refunded' : b.paymentStatus === 'Deposit Refunded' ? (b.depositUsedUp || (usedTotal > 0 && net <= 0) ? 'used' : 'hand') : b.paymentStatus === 'Refund Pending' ? 'waiting' : 'none';
    var since = b.refundPendingAt || b.end, wait = Math.max(0, Math.floor((Date.now() - new Date(since)) / DAY));
    return { m: m, cancelled: cancelled, received: received, agreed: agreed, notRecorded: notRecorded, basis: basis, adj: adj, used: used, adjTotal: adjTotal, usedTotal: usedTotal, takenOff: takenOff,
      net: net, over: takenOff > basis + 0.001, refund: refund, state: state, wait: wait, since: since };
  }
  /* kept more than the deposit: the extra is a charge on the bill (in Others, tracked as b.overCharge) so the customer pays it */
  function syncOver(b) {
    if (b.bookingStatus === 'Cancelled') return 0;
    var r = refundOf(b.id); if (r && !b.overCharge) return 0;
    b.rates = b.rates || {};
    var before = +b.overCharge || 0; b.overCharge = 0;
    var x = info(b), over = Math.max(0, sen(x.takenOff - x.basis));
    b.overCharge = over;
    if (Math.abs(over - before) > 0.004) {
      b.rates.others = Math.max(0, sen((+b.rates.others || 0) - before + over));
      bLog(b, over > 0 ? 'Kept more than the deposit: ' + rm(over) + ' added to the bill' : 'Extra over the deposit taken off the bill');
      if (over <= 0 && b.paymentStatus === 'Extension Due' && calcBooking(b).due <= 0.99) setPaymentStatus(b, 'Full Payment Received', 'extra over the deposit removed');
    }
    return over;
  }
  /* all of the deposit was kept: close it with nothing to return */
  function closeKept(b, note) {
    if (refundOf(b.id)) return;
    var x = info(b); if (x.net > 0.004) return;
    S.refunds = S.refunds || [];
    S.refunds.push({ id: uid(), booking: b.id, amt: 0, method: '', slip: null, slipHash: null, ref: '', at: new Date().toISOString(), by: S.me, refundBy: null, note: note || '', voided: false, received: x.basis });
    bLog(b, 'Deposit closed: nothing returned');
    if (b.paymentStatus === 'Refund Pending') setPaymentStatus(b, 'Deposit Refunded', 'all of the deposit kept');
  }
  function waitLabel(d) { return d <= 0 ? 'Waiting since today' : 'Waiting ' + d + (d === 1 ? ' day' : ' days'); }
  function waitChip(d) { return chip(waitLabel(d), d >= 7 ? 'red' : d >= 3 ? 'amber' : 'grey'); }
  function stateChip(x) {
    if (x.state === 'refunded') return chip(x.refund.amt > 0 ? 'Returned' : 'Closed, nothing returned', 'green');
    if (x.state === 'used') return chip('Used for payments', 'blue');
    if (x.state === 'hand') return chip('Marked by hand', 'orange');
    if (x.state === 'waiting') return waitChip(x.wait);
    return chip(x.cancelled ? 'Cancelled booking' : 'Not returned yet', 'grey');
  }
  /* used-up rule: a deposit fully used by payments becomes Deposit Refunded by itself; a void that frees money reopens it */
  function sync(bId, ix) {
    var b = bk(bId); if (!b) return false;
    var x = info(b, ix);
    if (x.refund) return false;
    if (b.paymentStatus !== 'Deposit Refunded' && x.usedTotal > 0 && x.net <= 0 && x.basis > 0) {
      b.depositUsedUp = true; setPaymentStatus(b, 'Deposit Refunded', 'the whole deposit was used for payments'); return true;
    }
    if (b.paymentStatus === 'Deposit Refunded' && b.depositUsedUp && x.net > 0) {
      delete b.depositUsedUp; b.refundPendingAt = b.refundPendingAt || new Date().toISOString(); setPaymentStatus(b, 'Refund Pending', 'a payment from the deposit was voided'); return true;
    }
    return false;
  }
  function syncAll() { var ix = index(), n = 0; Object.keys(ix.byDep).forEach(function (id) { if (sync(id, ix)) n++; }); S.bookings.forEach(function (b) { if (b.depositUsedUp && b.paymentStatus === 'Deposit Refunded' && sync(b.id, ix)) n++; }); return n; }

  /* ---------- duplicate slip check (refunds, bank-ins and payments) ---------- */
  function refKey(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function slipUsed(hash, ref, exceptRefundId) {
    var k = refKey(ref), hit = null;
    (S.refunds || []).forEach(function (r) { if (hit || r.voided || r.id === exceptRefundId) return; if ((hash && r.slipHash === hash) || (k.length >= 5 && refKey(r.ref) === k)) { var b = bk(r.booking); hit = 'the deposit refund of ' + (b ? b.code : 'a booking') + ' on ' + dFull(r.at); } });
    (S.bankIns || []).forEach(function (r) { if (hit || r.voided) return; if ((hash && r.slipHash === hash) || (k.length >= 5 && refKey(r.ref) === k)) hit = 'the bank-in of ' + (who(r.staff) || 'staff') + ' on ' + dFull(r.at); });
    if (!hit) S.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (hit || p.voided) return; if ((hash && p.slipHash === hash) || (k.length >= 5 && refKey(p.ref) === k)) hit = 'a payment of ' + b.code + ' on ' + dFull(p.at); }); });
    return hit;
  }

  /* ---------- the deposit sheet ---------- */
  function open(bId, opts) {
    opts = opts || {};
    var b = bk(bId); if (!b) { say('Booking not found'); return; }
    if (!can('deposits.view')) { say('Ask the owner for Deposits access'); return; }
    sync(bId);
    /* after "Reopen the refund", a deposit typed by hand starts from the amount typed last time, not the agreed one */
    var lastVoid = (S.refunds || []).filter(function (x) { return x.booking === bId && x.voided && x.notRecorded && x.received != null; }).pop();
    var st = { typed: lastVoid && !refundOf(bId) ? +lastVoid.received : null };
    var sh = sheet('<div id="depBody"></div>', null, { full: true, stack: !!opts.stack, cls: 'dep-sheet' });
    var draw = function (focus) {
      if (!sh.isConnected) return;
      var x = info(b), cu = cust(b.cust), c = car(b.car) || {}, locked = x.state === 'refunded';
      if (x.notRecorded && !x.refund && st.typed != null) { x.basis = st.typed; x.net = Math.max(0, sen(st.typed - x.takenOff)); x.over = x.takenOff > st.typed + 0.001; }
      var canEdit = can('deposits.edit_deductions') && !locked;
      var depPays = activePays(b).filter(function (p) { return x.cancelled || (p.items || []).some(function (i) { return i.kind === 'Security deposit'; }); });
      var h = sheetHead(x.cancelled ? 'Refund money paid' : 'Deposit', b.code + ' · ' + cu.name) +
        '<div class="dep-top">' + stateChip(x) + '<span class="muted small">' + esc(c.plate || '') + (c.plate ? ' · ' : '') + esc(dShort(b.start)) + ' to ' + esc(dShort(b.end)) + '</span></div>';
      /* received */
      h += '<div class="sec"><h2>' + (x.cancelled ? 'Money paid' : 'Deposit received') + '</h2></div><div class="list">';
      if (depPays.length) h += depPays.map(function (p) {
        var amt = x.cancelled ? payTotal(p) : (p.items || []).reduce(function (s, i) { return s + (i.kind === 'Security deposit' ? +i.amt || 0 : 0); }, 0);
        return '<div class="card2"><div class="c2-main"><div class="c2-t1">' + esc(p.method === 'Online Transfer' ? 'Bank transfer' : p.method) + (p.ref ? ' · ' + esc(p.ref) : '') + '</div><div class="c2-t2">' + esc(dFull(p.at)) + ', ' + hm(p.at) + (p.by ? ' · ' + esc(who(p.by)) : '') + '</div></div><div class="c2-end">' + rm(amt) + '</div></div>';
      }).join('') + '<div class="sumline big"><span>Total</span><span class="money">' + rm(x.received) + '</span></div>';
      else if (x.refund) h += '<div class="card2"><div class="c2-main"><div class="c2-t1">No deposit payment was recorded</div><div class="c2-t2">The refund was worked out from the deposit typed when it was recorded.</div></div><div class="c2-end">' + rm(x.basis) + '</div></div>';
      else h += '<div class="dep-typed"><div class="banner amber">' + I('info') + '<div>No deposit payment is recorded. The deposit on the booking is used. You can change it if the customer gave a different amount.</div></div>' +
        '<label class="field"><span>Deposit the customer gave (RM)</span><div class="rmfield"><input class="inp num" id="depTyped" inputmode="decimal" value="' + money2(x.basis) + '"' + (can('deposits.refund') ? '' : ' disabled') + '></div><small class="err" id="depTypedErr"></small></label></div>';
      h += '</div>';
      /* adjustments */
      if (opts.afterReturn && !x.refund) h += '<div class="banner green dep-back">' + I('car') + '<div><b>The car is back.</b> Add anything you keep from the deposit, then return the rest.</div></div>';
      h += '<div class="sec" id="depAdj"><h2>Adjustments from deposit</h2>' + (canEdit ? '<button type="button" id="depAdd">' + I('plus', 2.4) + ' Add</button>' : '') + '</div><div class="list">';
      var lines = x.adj.concat(x.used).sort(function (a, c2) { return new Date(a.at) - new Date(c2.at); });
      if (lines.length) h += lines.map(function (d) {
        var used = d.kind === 'Used for a payment', tap = canEdit && !used;
        return '<' + (tap ? 'button type="button" data-ded="' + d.id + '"' : 'div') + ' class="card2 dep-line">' + (d.photo ? '<span class="thumb dep-th"><img alt="" src="' + imgSrc(d.photo) + '"></span>' : '<span class="dep-ic' + (used ? ' used' : '') + '">' + I(used ? 'receipt' : 'tag') + '</span>') +
          '<div class="c2-main"><div class="c2-t1">' + esc(d.kind) + '</div><div class="c2-t2">' + esc(d.note || (used ? 'Paid from the deposit' : 'No note')) + '</div></div><div class="c2-end">-' + rm(d.amt) + '</div></' + (tap ? 'button' : 'div') + '>';
      }).join('') + '<div class="sumline"><span>Taken off</span><span class="money">-' + rm(x.takenOff) + '</span></div>';
      else h += '<div class="empty dep-none">' + (locked ? 'No adjustments from this deposit.' : 'Nothing kept yet, so the whole deposit goes back. Add an adjustment for damage, fuel, cleaning, a summons, a late return or anything else.') + '</div>';
      h += '</div>';
      if (canEdit && !lines.length) h += '<button type="button" class="btn ghost dep-addbig" id="depAdd2">' + I('plus', 2.4) + 'Add adjustment</button>';
      /* amount to return / what happened */
      if (x.refund) {
        var r = x.refund, by = r.method === 'Cash' ? (r.refundBy || r.by) : null;
        h += '<div class="card dep-done"><div class="dep-done-h">' + I('check', 2.4) + '<div class="grow"><b>' + (r.amt > 0 ? 'Returned to the customer' : 'Closed, nothing returned') + '</b><small>' + esc(dFull(r.at)) + ', ' + hm(r.at) + ' · recorded by ' + esc(who(r.by)) + '</small></div><div class="dep-big money">' + rm(r.amt) + '</div></div>' +
          (r.amt > 0 ? '<div class="kv"><div><div class="k">How</div><div class="v">' + esc(r.method) + (by ? '<small>Refunded by ' + esc(who(by)) + '</small>' : '') + '</div></div><div><div class="k">Reference</div><div class="v">' + esc(r.ref || 'None') + '</div></div></div>' : '') +
          (r.note ? '<p class="small muted dep-note">' + esc(r.note) + '</p>' : '') +
          (r.slip ? '<div class="thumbs dep-slip"><button type="button" class="thumb" id="depSlip"><img alt="Refund slip" src="' + imgSrc(r.slip) + '"></button><span class="small muted">Refund slip</span></div>' : '') + '</div>';
      } else {
        h += '<div class="card dep-net' + (x.over ? ' over' : '') + '"><div class="dep-net-row"><span>Amount to return</span><b class="money" id="depNet">' + rm(x.net) + '</b></div>' +
          '<div class="dep-calc small muted">' + rm(x.basis) + ' received' + (x.takenOff ? ' minus ' + rm(x.takenOff) + ' taken off' : '') + '</div>' +
          (x.over ? '<div class="banner amber dep-over">' + I('warn') + '<div><b>The customer still owes ' + rm(sen(x.takenOff - x.basis)) + '.</b> The adjustments are more than the deposit, so nothing is returned and the extra is on the bill.' + (can('payments.add') && typeof Pay !== 'undefined' && calcBooking(b).due > 0.99 ? '<div><button type="button" class="btn sm" id="depOverPay">' + I('cash') + 'Record payment</button></div>' : '') + '</div></div>' : '') + '</div>';
        if (x.state === 'hand') h += '<div class="banner blue">' + I('info') + '<div>This booking is marked Deposit Refunded, but no refund was recorded here. You can still record how it went back.</div></div>';
        if (x.state === 'used') h += '<div class="banner blue">' + I('info') + '<div>The whole deposit was used for payments, so nothing goes back.</div></div>';
      }
      /* foot */
      var foot = '';
      if (x.refund) {
        foot = '<div class="btnrow"><button type="button" class="btn ghost" id="depDoc">' + I('file') + 'Statement</button>' + (can('deposits.send') ? '<button type="button" class="btn" id="depWa">' + I('wa') + 'Send</button>' : '') + '</div>' +
          (can('deposits.reopen') ? '<button type="button" class="btn link red" id="depReopen">Reopen the refund</button>' : '');
      } else if (x.state !== 'used' && can('deposits.refund')) {
        foot = '<button type="button" class="btn big" id="depReturn">' + I('cash') + (x.net > 0 ? 'Return ' + rm(x.net) : 'Close without a refund') + '</button>' +
          '<button type="button" class="btn link" id="depDoc">' + I('file') + 'See the statement</button>';
      } else {
        foot = '<button type="button" class="btn ghost" id="depDoc">' + I('file') + 'See the statement</button>';
      }
      $('#depBody', sh).innerHTML = h + '<div class="sheet-foot stack">' + foot + '</div>';
      /* wire */
      var add = function () { editLine(b, null, draw); };
      if ($('#depAdd', sh)) $('#depAdd', sh).onclick = add;
      if ($('#depAdd2', sh)) $('#depAdd2', sh).onclick = add;
      $$('[data-ded]', sh).forEach(function (el) { el.onclick = function () { editLine(b, byId(S.deductions, el.dataset.ded), draw); }; });
      var ty = $('#depTyped', sh);
      if (ty) ty.oninput = function () {
        var v = parseMoney(ty.value), bad = !(v > 0);
        ty.classList.toggle('bad', bad); $('#depTypedErr', sh).textContent = bad ? 'Enter the deposit the customer gave, more than zero.' : '';
        st.bad = bad;
        if (!bad) { st.typed = v; var n = Math.max(0, sen(v - x.takenOff)); $('#depNet', sh).textContent = rm(n); var rb = $('#depReturn', sh); if (rb) rb.innerHTML = I('cash') + (n > 0 ? 'Return ' + rm(n) : 'Close without a refund'); }
      };
      if ($('#depReturn', sh)) $('#depReturn', sh).onclick = function () {
        var cur = info(b);
        if (cur.notRecorded && !cur.refund && st.bad) { var te = $('#depTyped', sh); if (te) { te.focus(); te.scrollIntoView({ block: 'center', behavior: 'smooth' }); } say('Enter the deposit the customer gave'); return; }
        if (cur.notRecorded) { var v = st.typed != null ? st.typed : cur.basis; if (!(v > 0) && cur.agreed > 0) { say('Enter the deposit the customer gave'); return; } cur.basis = v; cur.net = Math.max(0, sen(v - cur.takenOff)); }
        refundSheet(b, cur, draw);
      };
      if ($('#depDoc', sh)) $('#depDoc', sh).onclick = function () { statement(b.id, { typed: st.typed }); };
      if ($('#depWa', sh)) $('#depWa', sh).onclick = function () { sendStatement(b); };
      if ($('#depReopen', sh)) $('#depReopen', sh).onclick = function () { reopenSheet(b, draw); };
      if ($('#depOverPay', sh)) $('#depOverPay', sh).onclick = function () { var due = calcBooking(b).due; closeSheet(true); setTimeout(function () { Pay.open(b.id, { kinds: ['Rental payment'], amount: due }); }, 30); };
      if ($('#depSlip', sh)) $('#depSlip', sh).onclick = function () { viewPic(x.refund.slip, 'Refund slip'); };
      if (focus) { var el = $(focus, sh); if (el) setTimeout(function () { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); }
    };
    draw(opts.focus);
    return sh;
  }
  function adjust(bId) {
    var b = bk(bId); if (!b) return;
    open(bId, { focus: '.dep-back', afterReturn: true });
  }
  function viewPic(src, title) {
    sheet(sheetHead(title || 'Photo') + '<div class="dep-pic"><img alt="" src="' + imgSrc(src) + '"></div>', { stack: true });
  }

  /* add or change one adjustment line */
  function editLine(b, d, done) {
    var st = { kind: d ? d.kind : '', photo: d ? d.photo : null };
    var sh = sheet(sheetHead(d ? 'Change adjustment' : 'Add adjustment', 'Kept from the deposit of ' + b.code) +
      '<label class="field"><span>What is it for?</span><div class="seg" id="dlKind">' + DED_KINDS.map(function (k) { return '<button type="button" class="' + (st.kind === k ? 'on' : '') + '">' + k + '</button>'; }).join('') + '</div><small class="err" id="dlKindErr"></small></label>' +
      '<label class="field"><span>Amount</span><div class="rmfield"><input class="inp num" id="dlAmt" inputmode="decimal" placeholder="0.00" value="' + (d ? money2(d.amt) : '') + '"></div><small class="err" id="dlAmtErr"></small></label>' +
      '<label class="field"><span>Note (optional)</span><input class="inp" id="dlNote" maxlength="200" placeholder="For example: scratch on the rear bumper" value="' + esc(d ? d.note || '' : '') + '"></label>' +
      '<div class="field"><span>Photo (optional)</span><div id="dlPhoto"></div></div>' +
      '<div class="sheet-foot stack"><button type="button" class="btn" id="dlSave">' + I('check', 2.4) + (d ? 'Save' : 'Add adjustment') + '</button>' + (d ? '<button type="button" class="btn link red" id="dlDel">Remove this adjustment</button>' : '') + '</div>', null, { stack: true });
    var drawPhoto = function () {
      $('#dlPhoto', sh).innerHTML = st.photo ? '<div class="dep-ph"><span class="thumb"><img alt="" src="' + imgSrc(st.photo) + '"></span><button type="button" class="btn sm ghost" id="dlPhX">' + I('trash') + 'Remove</button></div>' :
        '<div class="btnrow"><button type="button" class="btn ghost sm" id="dlPhT">' + I('camera') + 'Take a photo</button><button type="button" class="btn ghost sm" id="dlPhS">' + I('image') + 'Sample</button></div>';
      var t = $('#dlPhT', sh), s = $('#dlPhS', sh), x = $('#dlPhX', sh);
      if (t) t.onclick = function () { Media.photo({ maxPx: 900, quality: .55 }).then(function (r) { st.photo = r.dataUrl; if (r.note) say(r.note); drawPhoto(); }, function () {}); };
      if (s) s.onclick = function () { st.photo = 'demo:photo:' + (st.kind || 'Damage'); drawPhoto(); };
      if (x) x.onclick = function () { st.photo = null; drawPhoto(); };
    };
    drawPhoto();
    segPick('#dlKind', function (t) { st.kind = t; $('#dlKindErr', sh).textContent = ''; });
    $('#dlSave', sh).onclick = function () {
      var amt = parseMoney($('#dlAmt', sh).value), note = $('#dlNote', sh).value.trim().replace(/\s+/g, ' '), ok = true;
      if (!st.kind) { $('#dlKindErr', sh).textContent = 'Choose what it is for.'; ok = false; }
      if (!(amt > 0)) { $('#dlAmtErr', sh).textContent = 'Enter the amount in RM, for example 50 or 50.00.'; $('#dlAmt', sh).classList.add('bad'); ok = false; }
      if (!ok) return;
      if (refundOf(b.id)) { say('The refund is already recorded. Reopen it first.'); return; }
      S.deductions = S.deductions || [];
      if (d) {
        var ch = {}; if (d.kind !== st.kind) ch.kind = [d.kind, st.kind]; if (+d.amt !== amt) ch.amt = [d.amt, amt]; if ((d.note || '') !== note) ch.note = [d.note || '', note];
        d.kind = st.kind; d.amt = amt; d.note = note; d.photo = st.photo; d.changedBy = S.me; d.changedAt = new Date().toISOString();
        bLog(b, 'Deposit adjustment changed: ' + st.kind + ' ' + rm(amt), Object.keys(ch).length ? ch : null);
      } else {
        S.deductions.push({ id: uid(), booking: b.id, kind: st.kind, amt: amt, note: note, photo: st.photo, by: S.me, at: new Date().toISOString(), paymentId: null });
        bLog(b, 'Deposit adjustment added: ' + st.kind + ' ' + rm(amt) + (note ? ' (' + note + ')' : ''));
      }
      syncOver(b); save(); closeSheet(); say(d ? 'Adjustment saved' : 'Adjustment added'); done();
    };
    var del = $('#dlDel', sh);
    if (del) del.onclick = function () {
      var i = S.deductions.indexOf(d); if (i < 0) return;
      S.deductions.splice(i, 1); bLog(b, 'Deposit adjustment removed: ' + d.kind + ' ' + rm(d.amt)); syncOver(b); save(); closeSheet(); done();
      undoSnack('Adjustment removed', function () { S.deductions.splice(Math.min(i, S.deductions.length), 0, d); bLog(b, 'Deposit adjustment put back: ' + d.kind + ' ' + rm(d.amt)); syncOver(b); save(); done(); });
    };
  }

  /* record how the deposit went back */
  function refundSheet(b, x, done) {
    var due = x.net, cu = cust(b.cust), now = new Date();
    var st = { method: '', slip: null, slipHash: null, read: null, by: S.me, kept: '', busy: false };
    var sh = sheet('<div id="rfBody"></div>', null, { stack: true, full: true });
    var keep = { amt: money2(due), date: toLocalInput(now), time: toTimeInput(now), ref: '', note: '', keptNote: '' };
    var grab = function () { ['amt', 'date', 'time', 'ref', 'note', 'keptNote'].forEach(function (k) { var el = $('#rf_' + k, sh); if (el) keep[k] = el.value; }); };
    var draw = function () {
      if (!sh.isConnected) return;
      var amt = parseMoney(keep.amt), less = due > 0 && amt > 0 && amt < due - 0.001 ? sen(due - amt) : 0, more = amt > due + 0.001 ? sen(amt - due) : 0;
      var h = sheetHead(due > 0 ? 'Return the deposit' : 'Close the deposit', b.code + ' · ' + cu.name) +
        '<div class="card dep-due"><span>Due back</span><b class="money">' + rm(due) + '</b></div>';
      if (due <= 0) {
        h += '<p class="lead">Nothing is returned, so no payment details are needed. This closes the deposit.</p>';
      } else {
        h += '<div class="field"><span>How did it go back?</span><div class="seg dep-meth" id="rfMeth">' + REFUND_METHODS.map(function (m) { return '<button type="button" data-m="' + m.v + '" class="' + (st.method === m.v ? 'on' : '') + '">' + I(m.icon) + m.v + '</button>'; }).join('') + '</div>' +
          (st.method ? '<small class="hint">' + esc(byId(REFUND_METHODS.map(function (m) { return { id: m.v, hint: m.hint }; }), st.method).hint) + '</small>' : '') + '<small class="err" id="rfErr_method"></small></div>';
        if (st.method === 'Bank transfer') {
          h += '<div class="field"><span>Transfer slip</span>' + (st.slip ?
            '<div class="dep-ph"><span class="thumb"><img alt="Slip" src="' + imgSrc(st.slip) + '"></span><div class="grow small">' + (st.busy ? '<span class="dep-reading">Reading the slip…</span>' : st.read ? 'Read from the slip: ' + esc([rm(st.read.amount), dFull(st.read.date + 'T00:00'), st.read.time ? hm(fromInputs(st.read.date, st.read.time)) : '', st.read.ref ? 'ref ' + st.read.ref : ''].filter(Boolean).join(', ')) + '. Check they are right.' : '') + '</div><button type="button" class="btn sm ghost" id="rfSlipX">' + I('trash') + '</button></div>' :
            '<div class="btnrow"><button type="button" class="btn ghost" id="rfSlipT">' + I('camera') + 'Take a photo</button><button type="button" class="btn ghost" id="rfSlipS">' + I('image') + 'Sample slip</button></div>') +
            '<small class="err" id="rfErr_slip"></small></div>';
        }
        if (st.method === 'Cash') {
          h += '<div class="field"><span>Refunded by</span><button type="button" class="carfield" id="rfBy"><span class="av sm" style="background:' + avColor(who(st.by)) + '">' + initials(who(st.by)) + '</span><span class="grow"><b>' + esc(who(st.by)) + (st.by === S.me ? ' (me)' : '') + '</b><small class="muted">The cash comes off what this person holds</small></span>' + I('down') + '</button><small class="err" id="rfErr_by"></small></div>';
        }
        h += '<label class="field"><span>Amount returned</span><div class="rmfield"><input class="inp num' + (more ? ' bad' : '') + '" id="rf_amt" inputmode="decimal" value="' + esc(keep.amt) + '"></div>' +
          (more ? '<small class="err">This is ' + rm(more) + ' more than the ' + rm(due) + ' due back. Check the slip and the adjustments.</small>' : '<small class="err" id="rfErr_amt"></small>') + '</label>';
        if (less) {
          h += '<div class="card dep-kept"><div class="dep-kept-h">' + I('warn') + '<b>' + rm(less) + ' less than due goes back. What is the ' + rm(less) + ' kept for?</b></div>' +
            '<div class="seg" id="rfKept">' + DED_KINDS.map(function (k) { return '<button type="button" class="' + (st.kept === k ? 'on' : '') + '">' + k + '</button>'; }).join('') + '</div>' +
            '<input class="inp" id="rf_keptNote" maxlength="200" placeholder="Note (optional)" value="' + esc(keep.keptNote) + '"><small class="err" id="rfErr_kept"></small></div>';
        }
      }
      h += '<div class="dep-dt"><label class="field"><span>Date</span><input class="inp" type="date" id="rf_date" max="' + toLocalInput(new Date()) + '" value="' + esc(keep.date) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="rf_time" value="' + esc(keep.time) + '"></label></div><small class="err dep-dterr" id="rfErr_date"></small>' +
        (due > 0 ? '<label class="field"><span>Reference (optional)</span><input class="inp" id="rf_ref" maxlength="100" value="' + esc(keep.ref) + '" placeholder="From the slip"><small class="err" id="rfErr_ref"></small></label>' : '') +
        '<label class="field"><span>Note on the statement (optional)</span><input class="inp" id="rf_note" maxlength="300" value="' + esc(keep.note) + '" placeholder="For example: Thank you for renting with us."></label>' +
        '<div class="sheet-foot"><button type="button" class="btn big" id="rfSave"' + (st.busy ? ' disabled' : '') + '>' + I('check', 2.4) + (due > 0 ? 'Record the refund' : 'Close without a refund') + '</button></div>';
      $('#rfBody', sh).innerHTML = h;
      $$('#rfMeth button', sh).forEach(function (bt) { bt.onclick = function () { grab(); st.method = bt.dataset.m; draw(); }; });
      $$('#rfKept button', sh).forEach(function (bt) { bt.onclick = function () { grab(); st.kept = bt.textContent; draw(); }; });
      var amtEl = $('#rf_amt', sh); if (amtEl) amtEl.onchange = function () { grab(); draw(); };
      var take = function (sample) {
        grab();
        var p = sample ? Media.sample('slip', 'Refund slip').then(function (r) { return { dataUrl: 'demo:slip:Refund slip', hash: r.hash }; }) : Media.photo({ maxPx: 900, quality: .55 });
        p.then(function (r) {
          var dup = slipUsed(r.hash, '');
          if (dup) { say('This slip was already uploaded: it is on ' + dup + '. The same slip cannot be recorded twice.'); return; }
          st.slip = r.dataUrl; st.slipHash = r.hash; st.busy = true; st.read = null; draw();
          Media.readSlip(r.dataUrl + (sample ? st.slipHash : ''), { expect: due }).then(function (rd) {
            if (!sh.isConnected) return;
            st.busy = false; st.read = rd;
            keep.amt = money2(rd.amount); keep.date = rd.date; keep.time = rd.time; keep.ref = rd.ref;
            draw();
          });
        }, function () {});
      };
      if ($('#rfSlipT', sh)) $('#rfSlipT', sh).onclick = function () { take(false); };
      if ($('#rfSlipS', sh)) $('#rfSlipS', sh).onclick = function () { take(true); };
      if ($('#rfSlipX', sh)) $('#rfSlipX', sh).onclick = function () { grab(); st.slip = null; st.slipHash = null; st.read = null; st.busy = false; draw(); };
      if ($('#rfBy', sh)) $('#rfBy', sh).onclick = function () { grab(); Pickers.staff({ title: 'Who handed the cash back?', selected: [st.by], includeOff: true, onPick: function (p) { if (p) { st.by = p.id; draw(); } } }); };
      $('#rfSave', sh).onclick = function () { grab(); save1(); };
    };
    var err = function (k, t) { var el = $('#rfErr_' + k, sh); if (el) el.textContent = t; return false; };
    var save1 = function () {
      if (refundOf(b.id)) { var r0 = refundOf(b.id); say('The deposit refund for ' + b.code + ' is already recorded by ' + who(r0.by) + '. A deposit can be refunded only once.'); closeSheet(); done(); return; }
      var ok = true, amt = due > 0 ? parseMoney(keep.amt) : 0, kept = 0;
      $$('.err', sh).forEach(function (e) { if (e.id) e.textContent = ''; });
      var ri0 = $('#rf_ref', sh); if (ri0) ri0.classList.toggle('bad', false);
      if (due > 0) {
        if (!st.method) ok = err('method', 'Choose how the deposit went back.');
        if (!(amt > 0)) ok = err('amt', 'Enter the amount that went back, like 160 or 160.00.');
        else if (amt > due + 0.001) { say('That is more than the amount due back'); return; }
        else if (amt < due - 0.001) { kept = sen(due - amt); if (!st.kept) ok = err('kept', 'Choose what the ' + rm(kept) + ' not returned is kept for.'); }
        if (st.method === 'Bank transfer' && !st.slip) ok = err('slip', 'Add the bank transfer slip.');
        if (st.method === 'Bank transfer' && st.busy) ok = err('slip', 'Wait for the slip to be read.');
        if (st.method === 'Cash' && !st.by) ok = err('by', 'Choose who handed the cash back.');
      }
      var when = /^\d{4}-\d{2}-\d{2}$/.test(keep.date) && /^\d{2}:\d{2}$/.test(keep.time) ? fromInputs(keep.date, keep.time) : null;
      if (!when) ok = err('date', 'Enter the date and time it went back.');
      else if (when.getTime() > Date.now() + 5 * MIN) ok = err('date', 'The date cannot be in the future.');
      if (!ok) { var e1 = $$('.err', sh).filter(function (e) { return e.textContent; })[0]; if (e1) e1.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (due > 0) {
        var dupPic = st.method === 'Bank transfer' ? slipUsed(st.slipHash, '') : null, dupRef = dupPic ? null : slipUsed(null, keep.ref), dupEl;
        if (dupPic) { err('slip', 'This slip was already uploaded: it is on ' + dupPic + '. The same slip cannot be recorded twice.'); dupEl = $('#rfErr_slip', sh); }
        else if (dupRef) { err('ref', 'This reference is already on ' + dupRef + '. The same transfer cannot be recorded twice.'); dupEl = $('#rfErr_ref', sh); var ri = $('#rf_ref', sh); if (ri) ri.classList.add('bad'); }
        if (dupPic || dupRef) { if (dupEl) dupEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); say(dupPic ? 'This slip was already used' : 'This reference was already used'); return; }
      }
      if (kept > 0) {
        S.deductions = S.deductions || [];
        S.deductions.push({ id: uid(), booking: b.id, kind: st.kept, amt: kept, note: keep.keptNote.trim() || 'Kept when the refund was recorded', photo: null, by: S.me, at: when.toISOString(), paymentId: null });
      }
      var method = due > 0 ? st.method : '', rec = { id: uid(), booking: b.id, amt: due > 0 ? amt : 0, method: method, slip: method === 'Bank transfer' ? st.slip : null, slipHash: method === 'Bank transfer' ? st.slipHash : null,
        ref: due > 0 ? keep.ref.trim() : '', at: when.toISOString(), by: S.me, refundBy: method === 'Cash' ? st.by : null, note: keep.note.trim(), voided: false, received: x.basis, notRecorded: x.notRecorded || undefined };
      S.refunds = S.refunds || []; S.refunds.push(rec);
      bLog(b, rec.amt > 0 ? 'Deposit returned: ' + rm(rec.amt) + ' by ' + method.toLowerCase() + (method === 'Cash' && st.by !== S.me ? ' (handed back by ' + who(st.by) + ')' : '') + (kept ? ', ' + rm(kept) + ' kept for ' + st.kept.toLowerCase() : '') : 'Deposit closed: nothing returned');
      if (b.paymentStatus !== 'Deposit Refunded') setPaymentStatus(b, 'Deposit Refunded', 'deposit refund recorded'); else save();
      save(); closeSheet(); done();
      notify('pay', rec.amt > 0 ? 'Deposit returned: ' + rm(rec.amt) : 'Deposit closed', b.code + ' · ' + cu.name, '#booking/' + b.id, { self: true });
      if (location.hash.indexOf('#deposits') === 0 || location.hash.indexOf('#booking/') === 0) render(false, true);
    };
    draw();
  }

  function reopenSheet(b, done) {
    var r = refundOf(b.id); if (!r) return;
    var sh = sheet(sheetHead('Reopen the refund?', b.code + ' · ' + rm(r.amt) + ' returned on ' + dShort(r.at)) +
      '<p class="lead">Do this when the refund was recorded wrong. The booking goes back to Refund Pending, and you can record it again.</p>' +
      '<label class="field"><span>Why reopen it?</span><textarea class="inp dep-ta" id="roWhy" maxlength="300" placeholder="For example: sent to the wrong bank account"></textarea><small class="err" id="roErr"></small><small class="hint">Nothing is lost: the earlier refund stays in the activity log.</small></label>' +
      '<div class="sheet-foot"><button type="button" class="btn danger solid" id="roGo">Reopen the refund</button></div>', null, { stack: true });
    $('#roGo', sh).onclick = function () {
      var why = $('#roWhy', sh).value.trim().replace(/\s+/g, ' ');
      if (!why) { $('#roErr', sh).textContent = 'Say why, so the record makes sense later.'; return; }
      r.voided = true; r.voidReason = why; r.voidedAt = new Date().toISOString(); r.voidedBy = S.me;
      delete b.depositUsedUp;
      b.refundPendingAt = b.refundPendingAt || new Date().toISOString();
      bLog(b, 'Deposit refund reopened (' + rm(r.amt) + ' by ' + (r.method || 'none').toLowerCase() + '): ' + why);
      setPaymentStatus(b, 'Refund Pending', 'deposit refund reopened: ' + why);
      save(); closeSheet(); say('Refund reopened'); done();
    };
  }

  /* ---------- statement ---------- */
  function statement(bId, o) {
    o = o || {};
    var b = bk(bId); if (!b) return;
    var x = info(b), cu = cust(b.cust), c = car(b.car) || {}, r = x.refund;
    if (x.notRecorded && !r && o.typed != null) { x.basis = o.typed; x.net = Math.max(0, sen(o.typed - x.takenOff)); }
    var lines = [];
    var depPays = activePays(b).filter(function (p) { return x.cancelled || (p.items || []).some(function (i) { return i.kind === 'Security deposit'; }); });
    depPays.forEach(function (p) { var a = x.cancelled ? payTotal(p) : (p.items || []).reduce(function (s, i) { return s + (i.kind === 'Security deposit' ? +i.amt || 0 : 0); }, 0); lines.push({ text: x.cancelled ? 'Payment received' : 'Security deposit received', sub: dFull(p.at) + ' · ' + (p.method === 'Online Transfer' ? 'Bank transfer' : p.method) + (p.ref ? ' · Ref ' + p.ref : ''), amt: a }); });
    if (!depPays.length) lines.push({ text: 'Security deposit', sub: 'The deposit payment was not recorded. Amount as agreed or as the customer gave.', amt: x.basis });
    x.adj.concat(x.used).forEach(function (d) { lines.push({ text: 'Kept: ' + d.kind, sub: d.note || '', amt: -(+d.amt || 0) }); });
    var totals = [{ label: x.cancelled ? 'Money paid' : 'Deposit received', amt: x.basis }, { label: 'Adjustments', amt: -x.takenOff }, { label: r ? 'Returned to you' : 'To return', amt: r ? r.amt : x.net, big: true }];
    if (x.over) totals.push({ label: 'Still to pay', amt: sen(x.takenOff - x.basis), big: true });
    var notes = r ? (r.amt > 0 ? 'Returned on ' + dFull(r.at) + ' by ' + r.method.toLowerCase() + (r.ref ? ', reference ' + r.ref : '') + (r.method === 'Cash' && (r.refundBy || r.by) ? ', handed back by ' + who(r.refundBy || r.by) : '') + '.' : 'Nothing was returned: the adjustments used the whole deposit.') : 'This deposit is not returned yet.';
    if (r && r.note) notes += '\n' + r.note;
    pdfDoc('deposit', { no: 'DEP-' + b.code, title: 'Deposit statement', date: r ? r.at : new Date(), booking: b.code, to: { name: cu.name, phone: cu.phone, extra: (c.plate ? c.plate + ' · ' + c.make + ' ' + c.model + ' · ' : '') + dShort(b.start) + ' to ' + dShort(b.end) },
      lines: lines, totals: totals, notes: notes, stack: true, shareText: statementText(b, x), link: statementLink(b) });
  }
  function statementLink(b) { return B().site + '/deposit/' + (b.formId || b.id); }
  function statementText(b, x) {
    var cu = cust(b.cust), r = x.refund;
    var t = 'Hi ' + callName(cu.name) + ', here is the deposit statement for booking ' + b.code + ' from ' + B().name + '. Deposit received ' + rm(x.basis);
    if (x.takenOff) t += ', adjustments ' + rm(x.takenOff) + ' (' + x.adj.concat(x.used).map(function (d) { return d.kind.toLowerCase(); }).filter(function (k, i, a) { return a.indexOf(k) === i; }).join(', ') + ')';
    t += r ? (r.amt > 0 ? ', returned ' + rm(r.amt) + ' by ' + r.method.toLowerCase() + ' on ' + dFull(r.at) + '.' : ', nothing returned.') : ', to return ' + rm(x.net) + '.';
    return t + ' Statement: ' + statementLink(b) + ' Thank you for renting with us.';
  }
  function sendStatement(b) {
    var cu = cust(b.cust), x = info(b);
    var sh = sheet(sheetHead('Send the statement', 'On WhatsApp to ' + cu.name) +
      '<label class="field"><span>Customer phone</span><input class="inp" id="ssPh" inputmode="tel" value="' + esc(cu.phone || '') + '"></label>' +
      '<label class="field"><span>Message</span><textarea class="inp dep-ta big" id="ssTx">' + esc(statementText(b, x)) + '</textarea></label>' +
      '<div class="sheet-foot stack"><button type="button" class="btn" id="ssGo">' + I('wa') + 'Open WhatsApp</button><button type="button" class="btn link" id="ssCp">' + I('copy') + 'Copy the message</button></div>', null, { stack: true });
    $('#ssGo', sh).onclick = function () {
      var ph = $('#ssPh', sh).value; if (digits(ph).length < 8) { say('Type the customer’s phone number'); return; }
      Share.wa(ph, $('#ssTx', sh).value); bLog(b, 'Deposit statement DEP-' + b.code + ' sent on WhatsApp'); save(); closeSheet();
      say('WhatsApp is ready with the message. Press send there.');
    };
    $('#ssCp', sh).onclick = function () { Share.copy($('#ssTx', sh).value); };
  }

  return { syncOver: syncOver, closeKept: closeKept, open: open, adjust: adjust, statement: statement, info: info, sync: sync, syncAll: syncAll, index: index, refundOf: refundOf, slipUsed: slipUsed,
    left: function (bId) { var b = bk(bId); return b ? info(b).net : 0; }, waitChip: waitChip, waitLabel: waitLabel, stateChip: stateChip, viewPic: viewPic };
})();

/* ---------- seed: payments from deposits (to show 'Used for payments') ---------- */
SEEDERS.push({ key: 'm4DepUse', fn: function (d, x) {
  d.m4DepUse = 1;
  var pend = d.bookings.filter(function (b) { return b.paymentStatus === 'Refund Pending' && paidOf(b, 'Security deposit') > 0; });
  var mk = function (b, amt, kind, note) {
    var p = newPayment({ at: new Date(Math.min(Date.now() - 2 * HOUR, new Date(b.end).getTime() + 3 * HOUR)).toISOString(), items: [{ kind: kind, amt: amt }], method: 'Deposit adjustment', depositOf: b.id, by: 's3', note: note });
    b.payments.push(p);
    d.deductions = d.deductions || [];
    d.deductions.push({ id: uid(), booking: b.id, kind: 'Used for a payment', amt: amt, note: 'Paid ' + kind.toLowerCase() + ' (' + note + ')', photo: null, by: 's3', at: p.at, paymentId: p.id });
    return p;
  };
  /* two older ones still waiting, so the list shows long waits */
  var t0 = Date.now(), old = d.bookings.filter(function (b) { var e = new Date(b.end).getTime(); return b.paymentStatus === 'Deposit Refunded' && e < t0 - 7 * DAY && e > t0 - 13 * DAY && b.bookingStatus !== 'Cancelled'; }).slice(0, 2);
  old.forEach(function (b) {
    d.refunds = (d.refunds || []).filter(function (r) { return r.booking !== b.id; });
    b.log = (b.log || []).filter(function (l) { return !/^Deposit returned/.test(l.text); });
    b.paymentStatus = 'Refund Pending'; b.refundPendingAt = b.end;
  });
  var a = pend[0], c = pend[2];
  if (a) { mk(a, paidOf(a, 'Security deposit'), 'Extension payment', 'kept the car one more day'); a.paymentStatus = 'Deposit Refunded'; a.depositUsedUp = true; a.log.push({ at: new Date().toISOString(), by: 's3', text: 'Payment status changed from Refund Pending to Deposit Refunded (the whole deposit was used for payments)' }); }
  if (c) mk(c, 50, 'Other payment', 'fuel top up');
} });

/* ---------- #deposits list ---------- */
VIEWS.deposits = function () {
  if (!can('deposits.view')) return { html: topbar('Deposits', { back: '#more' }) + '<main>' + noAccess('deposits.view') + '</main>' };
  Deposit.syncAll();
  var ix = Deposit.index(), now = new Date(), mo0 = new Date(now.getFullYear(), now.getMonth(), 1), d90 = Date.now() - 90 * DAY;
  var wait = [], done = [];
  S.bookings.forEach(function (b) {
    var ps = b.paymentStatus;
    if (ps === 'Refund Pending') wait.push({ b: b, x: Deposit.info(b, ix) });
    else if (ps === 'Deposit Refunded') { var x = Deposit.info(b, ix), t = x.refund ? new Date(x.refund.at) : new Date(b.end); if (t >= d90 && t <= now && (x.basis > 0 || x.refund)) done.push({ b: b, x: x, t: t }); }
  });
  var toReturn = wait.reduce(function (s, r) { return s + r.x.net; }, 0);
  var retMonth = (S.refunds || []).filter(function (r) { return !r.voided && new Date(r.at) >= mo0; }).reduce(function (s, r) { return s + (+r.amt || 0); }, 0);
  var adjMonth = (S.deductions || []).filter(function (dd) { return dd.kind !== 'Used for a payment' && new Date(dd.at) >= mo0; }).reduce(function (s, dd) { return s + (+dd.amt || 0); }, 0);
  var q = depList.q.trim(), match = function (r) { if (!q) return true; var cu = cust(r.b.cust), c = car(r.b.car) || {}; return Pickers.bookingMatches(r.b, q) || wordsMatch(q, cu.name + ' ' + (c.plate || '') + ' ' + normPlate(c.plate)) || normPlate(c.plate).indexOf(normPlate(q)) >= 0; };
  var rows, chips;
  if (depList.tab === 'wait') {
    chips = [['', 'All', wait.length], ['7', 'Waiting 7 days or more', wait.filter(function (r) { return r.x.wait >= 7; }).length]];
    rows = wait.filter(function (r) { return depList.chip !== '7' || r.x.wait >= 7; }).filter(match).sort(function (a, b) { return b.x.wait - a.x.wait; });
  } else {
    var kindOf = function (r) { return r.x.state === 'refunded' ? 'ret' : r.x.state === 'used' ? 'used' : 'hand'; };
    chips = [['', 'All', done.length], ['ret', 'Returned', done.filter(function (r) { return kindOf(r) === 'ret'; }).length], ['used', 'Used for payments', done.filter(function (r) { return kindOf(r) === 'used'; }).length], ['hand', 'Marked by hand', done.filter(function (r) { return kindOf(r) === 'hand'; }).length]];
    rows = done.filter(function (r) { return !depList.chip || kindOf(r) === depList.chip; }).filter(match).sort(function (a, b) { return b.t - a.t; });
  }
  var row = function (r) {
    var b = r.b, x = r.x, cu = cust(b.cust), c = car(b.car) || {};
    var end = depList.tab === 'wait' ? rm(x.net) + (Math.abs(x.net - x.basis) > 0.009 ? '<small>of ' + rm(x.basis) + '</small>' : '<small>to return</small>') : rm(x.refund ? x.refund.amt : 0) + '<small>' + (x.refund ? esc(x.refund.method || 'Nothing back') : x.state === 'used' ? 'Used' : 'By hand') + '</small>';
    return '<button type="button" class="card2 dep-row" data-dep="' + b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(cu.name) + '</div><div class="c2-t2">' + esc(b.code) + ' · ' + esc(c.plate || '') + '</div>' +
      '<div class="dep-chips">' + (depList.tab === 'wait' ? Deposit.waitChip(x.wait) + (x.takenOff ? chip('-' + rm(x.takenOff) + ' kept', 'grey') : '') + (x.notRecorded ? chip('Deposit not recorded', 'amber') : '') + '<span class="small muted">back ' + esc(dShort(b.end)) + '</span>' : Deposit.stateChip(x) + '<span class="small muted">' + esc(dShort(r.t)) + '</span>') + '</div></div><div class="c2-end">' + end + '</div></button>';
  };
  var html = topbar('Deposits', { back: '#more' }) + '<main class="dep-main">' +
    '<div class="kpis dep-kpis">' +
    '<button type="button" class="tile" data-tab="wait"><div class="k">' + I('clock') + 'Waiting to be returned</div><div class="v num">' + wait.length + '</div></button>' +
    '<button type="button" class="tile" data-tab="wait"><div class="k">' + I('cash') + 'To return in total</div><div class="v money-v">' + rm(toReturn) + '</div></button>' +
    '<button type="button" class="tile" data-tab="done"><div class="k">' + I('check') + 'Returned this month</div><div class="v money-v">' + rm(retMonth) + '</div></button>' +
    '<div class="tile"><div class="k">' + I('tag') + 'Adjustments this month</div><div class="v money-v">' + rm(adjMonth) + '</div></div></div>' +
    '<div class="seg2 dep-tabs"><a href="javascript:void 0" data-tab="wait" class="' + (depList.tab === 'wait' ? 'on' : '') + '">To refund <span class="n">' + wait.length + '</span></a><a href="javascript:void 0" data-tab="done" class="' + (depList.tab === 'done' ? 'on' : '') + '">Refunded (90 days)</a></div>' +
    '<label class="search dep-search">' + I('search') + '<input id="depQ" type="search" placeholder="Booking ID, customer, phone, plate" value="' + esc(depList.q) + '" autocomplete="off" enterkeyhint="search"></label>' +
    '<div class="chiprow">' + chips.map(function (c) { return '<button type="button" class="fchip ' + (depList.chip === c[0] ? 'on' : '') + '" data-chip="' + c[0] + '">' + esc(c[1]) + ' <span class="n">' + c[2] + '</span></button>'; }).join('') + '</div>' +
    (depList.tab === 'wait' && rows.length ? '<div class="small muted dep-sort">Longest waiting first</div>' : '') +
    '<div class="list" id="depRows">' + (rows.length ? rows.map(row).join('') : '<div class="empty">' + (q ? 'Nothing matches this search. Try a different name, plate or booking ID.' : depList.tab === 'wait' ? 'No deposits are waiting to be returned. When a car comes back, its booking is marked Refund Pending and the deposit shows up here.' : 'No deposits returned recently. After you record a refund, it is listed here for 90 days.') + '</div>') + '</div>' +
    '</main>';
  return { html: html, keepScroll: true, after: function () {
    $$('[data-tab]').forEach(function (el) { el.onclick = function () { if (depList.tab !== el.dataset.tab) { depList.tab = el.dataset.tab; depList.chip = ''; render(false, true); } }; });
    $$('[data-chip]').forEach(function (el) { el.onclick = function () { depList.chip = el.dataset.chip; render(false, true); }; });
    $$('[data-dep]').forEach(function (el) { el.onclick = function () { Deposit.open(el.dataset.dep); }; });
    var qi = $('#depQ'), tm = null;
    if (qi) qi.oninput = function () { clearTimeout(tm); tm = setTimeout(function () { depList.q = qi.value; render(false, true); var n = $('#depQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 220); };
  } };
};
VIEWS.deposit = function (r) {
  var out = VIEWS.deposits(r), a = out.after, id = r.a;
  out.after = function () { if (a) a(); history.replaceState(history.state, '', location.pathname + location.search + '#deposits'); if (id && bk(id)) Deposit.open(id, { afterReturn: r.q && r.q.back === '1' }); else if (id) say('Booking not found'); };
  return out;
};

/* ---------------- SUMMONS (M7 builder owns this file) ----------------
   #summons[?f=review|nobooking|ready|charged|paid|all&q=...]  snap a notice, match it to the booking that had the car, charge on WhatsApp, record the payment.
   Matching: the booking of that car whose rental window contains the offence time (cancelled bookings ignored).
   Charging: fine + B().summonsAdminFee by default; the WhatsApp message carries the notice, the amount and B().bank, never the IC.
   Paid: an 'Other payment' on the booking with its own receipt 'Summons <notice>'; the booking payment status is not touched.
   API: Summons.forBooking(bookingId) -> html ('' when none), Summons.open(id), Summons.snap({booking}), Summons.matchFor(plate, at). */

var SMS = { q: '', f: 'all' };
VIEW_STATE.push(function () { SMS.q = ''; SMS.f = 'all'; });

var Summons = (function () {
  var TONE = { 'Needs review': 'amber', 'No booking': 'red', 'Ready to charge': 'blue', 'Charged': 'orange', 'Paid': 'green', 'Waived': 'grey', 'Disputed': 'red' };
  var AUTH = ['PDRM', 'JPJ', 'DBKL', 'MBPP', 'MBSA', 'Other'];
  var AUTH_NAME = { PDRM: 'police (PDRM)', JPJ: 'road transport (JPJ)', DBKL: 'city council (DBKL)', MBPP: 'city council (MBPP)', MBSA: 'city council (MBSA)' };
  var FILTERS = [['review', 'Needs review', ['Needs review']], ['nobooking', 'No booking', ['No booking']], ['ready', 'Ready to charge', ['Ready to charge']], ['charged', 'Charged', ['Charged']], ['paid', 'Paid', ['Paid']], ['all', 'All', null]];
  function fee() { return +B().summonsAdminFee || 0; }
  function isOpen(s) { return s.status !== 'Paid' && s.status !== 'Waived'; }
  function title(s) { return s.notice || (s.authority || 'Summons') + ' notice (number not read)'; }
  function dmy(d) { d = new Date(d); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours() % 12 || 12) + ':' + pad(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM'); }
  function carByPlate(plate) { var np = normPlate(plate); if (!np) return null; return S.cars.filter(function (c) { return normPlate(c.plate) === np; })[0] || null; }
  /* {state: 'one'|'ambiguous'|'none'|'no_car'|'unknown', car, bookings[]} */
  function matchFor(plate, at) {
    if (!normPlate(plate) || !at || isNaN(new Date(at))) return { state: 'unknown', bookings: [] };
    var c = carByPlate(plate); if (!c) return { state: 'no_car', bookings: [] };
    var t = new Date(at).getTime();
    var found = S.bookings.filter(function (b) { return b.car === c.id && b.bookingStatus !== 'Cancelled' && new Date(b.start).getTime() <= t && new Date(b.end).getTime() >= t; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    return { state: !found.length ? 'none' : found.length === 1 ? 'one' : 'ambiguous', car: c, bookings: found };
  }
  function nearby(c, at) {
    var t = new Date(at).getTime();
    return S.bookings.filter(function (b) { return b.car === c.id && b.bookingStatus !== 'Cancelled' && Math.min(Math.abs(new Date(b.end).getTime() - t), Math.abs(new Date(b.start).getTime() - t)) < 2 * DAY; })
      .map(function (b) { var e = new Date(b.end).getTime(), s = new Date(b.start).getTime(); return { b: b, rel: e < t ? 'ended' : 'starts', gap: e < t ? t - e : s - t }; }).sort(function (a, b) { return a.gap - b.gap; }).slice(0, 3);
  }
  function gapText(ms) { var m = Math.round(ms / MIN), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60; return d ? d + ' day' + (d > 1 ? 's' : '') + (h ? ' ' + h + ' h' : '') : h ? h + ' h' + (mi ? ' ' + mi + ' min' : '') : Math.max(1, mi) + ' min'; }
  function hint(m) {
    return { one: 'Only one booking had this car at that time.', ambiguous: m.bookings.length + ' bookings overlap at that time. Choose the one that really had the car.', none: 'No booking had this car at that date and time. Check the date, or pick a booking.',
      unknown: 'The plate or the date and time are not filled in yet, so no booking can be looked up.', no_car: 'This plate is not one of your cars. Check the plate on the notice: one wrong letter or number is enough.' }[m.state];
  }
  function linkBooking(s, bid) {
    if (s.booking === bid) return;
    var old = s.booking && bk(s.booking); if (old) old.summonsIds = (old.summonsIds || []).filter(function (x) { return x !== s.id; });
    s.booking = bid || null;
    var nb = bid && bk(bid); if (nb) { nb.summonsIds = (nb.summonsIds || []).filter(function (x) { return x !== s.id; }).concat(s.id); }
  }

  /* ---------- the list ---------- */
  function view(r) {
    if (!can('summons.view')) return { html: topbar('Summons', { back: '#more' }) + '<main>' + noAccess('summons.view') + '</main>' };
    if (freshVisit('summons') && SMS.deep && !(r.q && (r.q.q != null || r.q.f))) { SMS.q = ''; SMS.f = 'all'; SMS.deep = false; }
    if (r.q && (r.q.q != null || r.q.f)) { SMS.q = r.q.q || ''; SMS.f = r.q.f || 'all'; SMS.deep = true; try { history.replaceState(history.state, '', location.pathname + location.search + '#summons'); } catch (e) {} }
    var all = S.summons || [], open = all.filter(isOpen).length;
    var html = topbar('Summons', { back: '#more', sub: open + ' open' }) + '<main class="sm-main">' +
      '<div class="cr-sticky"><label class="search">' + I('search') + '<input id="smq" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="Notice, plate, customer or booking" value="' + esc(SMS.q) + '">' + searchClearBtn('smq', SMS.q) + '</label>' +
      '<div class="chiprow" id="smchips"></div></div>' +
      (can('summons.upload') ? '<button type="button" class="btn sm-snapbtn" onclick="Summons.snap()">' + I('camera') + 'Snap a summons</button>' : '') +
      '<div id="smlist"></div></main>';
    return { html: html, after: function () { var q = $('#smq'), t = null; q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { SMS.q = q.value; SMS.deep = false; draw(); }, 100); }); wireSearchClear(q, function () { SMS.q = ''; SMS.deep = false; draw(); }); draw(); } };
  }
  function matches(s, q) {
    if (!q) return true;
    var b = s.booking && bk(s.booking), cu = b ? cust(b.cust) : null;
    if (normPlate(q).length >= 3 && normPlate(s.plate).indexOf(normPlate(q)) >= 0) return true;
    if (b && matchBookingCode(q, b)) return true;
    if (cu && phoneMatch(q, cu.phone)) return true;
    return wordsMatch(q, [s.notice, s.plate, s.offence, s.authority, b ? b.code : '', cu ? cu.name : ''].join(' '));
  }
  function draw() {
    var q = SMS.q.trim(), found = (S.summons || []).filter(function (s) { return matches(s, q); });
    $('#smchips').innerHTML = FILTERS.map(function (f) { var n = found.filter(function (s) { return !f[2] || f[2].indexOf(s.status) >= 0; }).length; return '<button type="button" class="fchip' + (SMS.f === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + ' <span class="n">' + n + '</span></button>'; }).join('');
    $$('#smchips button').forEach(function (b) { b.onclick = function () { SMS.f = b.dataset.f; draw(); }; });
    var fl = FILTERS.filter(function (f) { return f[0] === SMS.f; })[0] || FILTERS[5];
    var list = found.filter(function (s) { return !fl[2] || fl[2].indexOf(s.status) >= 0; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    $('#smlist').innerHTML = list.length ? '<div class="list sm-list">' + list.map(rowHtml).join('') + '</div>' :
      '<div class="empty card">' + I('receipt') + '<div>' + (q ? 'No summons matches “' + esc(q) + '”' : 'Nothing in ' + esc(fl[1])) + '.</div>' + (SMS.f !== 'all' ? '<button type="button" class="btn link" id="small">Show all</button>' : '') + '</div>';
    var a = $('#small'); if (a) a.onclick = function () { SMS.f = 'all'; draw(); };
    $$('[data-sm]').forEach(function (b) { b.onclick = function () { open(b.dataset.sm); }; });
  }
  function rowHtml(s) {
    var b = s.booking && bk(s.booking), cu = b ? cust(b.cust) : null;
    return '<button type="button" class="card2 sm-row" data-sm="' + s.id + '"><div class="c2-main"><div class="c2-t1">' + esc(title(s)) + '</div><div class="c2-t2">' + esc(s.plate || 'Plate not read') + ' · ' + esc(s.offence || 'Offence not read') + '</div>' +
      '<div class="c2-t2">' + esc(s.at ? dShort(s.at) + ', ' + hm(s.at) : 'Date not read') + (b ? ' · ' + esc(b.code) + ' · ' + esc(cu.name) : '') + '</div></div>' +
      '<div class="c2-end"><span class="money">' + rm(s.chargedAmt != null ? s.chargedAmt : s.amount) + '</span><small>' + chip(s.status, TONE[s.status]) + '</small></div></button>';
  }

  /* ---------- snap a summons: photo, simulated reading, check, match ---------- */
  function snap(o) {
    o = o || {}; if (!can('summons.upload')) { say('Ask the owner for Add summons access'); return; }
    var took = false;
    var sh = sheet(sheetHead('Snap a summons', 'Take a photo of the notice. The details are read for you to check.') +
      '<div class="sm-snap"><div class="sm-snapic">' + I('receipt') + '</div><button type="button" class="btn big" id="smtake">' + I('camera') + 'Take or choose a photo</button>' +
      '<button type="button" class="btn ghost" id="smsample">' + I('image') + 'Use a sample notice</button><button type="button" class="btn link" id="smtype">Type it in instead</button></div>', null, { full: true,
      guard: function () { return took ? { title: 'Stop reading the notice?', text: 'The photo you took will be lost.', ok: 'Close anyway', cancel: 'Keep going' } : null; } });
    var go = function (r) {
      took = true;
      $('.sm-snap', sh).innerHTML = '<div class="mt-reading sm-reading"><img alt="" src="' + esc(imgSrc(r.dataUrl)) + '"><div><b>Reading the notice</b><span class="mt-dots">Looking for the notice number, plate, date and amount</span></div></div>';
      later(function () { if (!document.body.contains(sh)) return; var read = simulateRead(r.dataUrl, o.booking); form(null, { photo: r.dataUrl, read: read, booking: o.booking }); }, 1300);
    };
    $('#smtake', sh).onclick = function () { Media.photo({ capture: 'environment', maxPx: 1200, quality: .7 }).then(go, function () {}); };
    $('#smsample', sh).onclick = function () { Media.sample('summons', 'Summons notice').then(go); };
    $('#smtype', sh).onclick = function () { form(null, { booking: o.booking }); };
  }
  /* made-up reading: a car that was on a rental lately, a time inside it (sometimes outside), and "% sure" per field */
  function simulateRead(dataUrl, bookingId) {
    var R = rng(parseInt(strHash(dataUrl + Date.now()).slice(0, 6), 36) || 13), pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var pool = bookingId && bk(bookingId) ? [bk(bookingId)] : S.bookings.filter(function (b) { return ['Car Delivered', 'Car Returned', 'Completed'].indexOf(b.bookingStatus) >= 0 && new Date(b.start) < new Date() && new Date(b.end) > Date.now() - 45 * DAY; });
    var b = pool.length ? pick(pool) : S.bookings[0], c = car(b.car) || S.cars[0], idle = !bookingId && R() < .2;
    var s = new Date(b.start).getTime(), e = Math.min(new Date(b.end).getTime(), Date.now() - HOUR), t = idle ? e + 9 * HOUR : s + (e - s) * (.15 + R() * .7);
    t = Math.min(t, Date.now() - 30 * MIN); /* a reading is never in the future */
    var off = pick([['PDRM', 'Speeding 98 km/h in an 80 km/h zone', 150], ['JPJ', 'Beating the red light', 300], ['DBKL', 'Parking without a coupon', 30], ['PDRM', 'Using a phone while driving', 300], ['MBPP', 'Double parking', 50], ['PDRM', 'No seat belt', 300]]);
    var sure = function (lo) { return lo + Math.floor(R() * (100 - lo)); };
    var f = { authority: { v: off[0], sure: sure(88) }, notice: { v: off[0] + '/' + Math.floor(100000 + R() * 899999), sure: sure(70) }, plate: { v: c.plate, sure: sure(75) },
      at: { v: new Date(Math.round(t / (5 * MIN)) * 5 * MIN).toISOString(), sure: sure(60) }, offence: { v: off[1], sure: sure(72) }, amount: { v: off[2], sure: sure(80) } };
    return f;
  }
  function sureNote(read, k) {
    if (!read || !read[k]) return '';
    var x = read[k]; return x.sure < 80 ? '<small class="sm-check">Check this: it was hard to read (' + x.sure + '% sure)</small>' : '<small class="sm-sure">' + x.sure + '% sure</small>';
  }
  /* the check form: new (s null) or edit an existing summons */
  function form(s, o) {
    o = o || {};
    var rd = o.read || null, v = function (k, d) { return s ? s[k] : rd && rd[k] ? rd[k].v : d; };
    var fg = formGuard(function () { return chosen; });
    var at0 = v('at', ''), auth = v('authority', 'PDRM'), photo = s ? s.photo : o.photo || null, chosen = s ? s.booking : o.booking || null, byHand = s ? !!s.byHand : !!o.booking;
    var sh = sheet(sheetHead(s ? 'Check the details' : rd ? 'Check what was read' : 'Add a summons', rd ? 'Compare each line with the picture' : '') +
      (photo ? '<button type="button" class="sm-photo" id="smph"><img alt="Summons photo" src="' + esc(imgSrc(photo)) + '"><span>Tap to zoom</span></button>' : '') +
      (rd ? '<div class="banner amber">' + I('eye') + '<div>' + checkSummary(rd) + '</div></div>' : '') +
      '<div class="field"><span>Issued by</span><div class="seg" id="sfa">' + AUTH.map(function (a) { return '<button type="button" class="' + (a === auth ? 'on' : '') + '">' + a + '</button>'; }).join('') + '</div>' + sureNote(rd, 'authority') + '</div>' +
      fld('sfn', 'Notice no', v('notice', ''), 'notice', 'For example PDRM/123456') +
      fld('sfp', 'Plate', v('plate', ''), 'plate', 'For example ' + ((S.cars[0] || {}).plate || 'WXY 1234'), ' autocapitalize="characters"') +
      '<div class="mt-2' + (rd && rd.at && rd.at.sure < 80 ? ' sm-warnf' : '') + '"><label class="field"><span>Date</span><input class="inp" type="date" id="sfd" max="' + toLocalInput(new Date()) + '" value="' + (at0 ? toLocalInput(at0) : '') + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="sft" value="' + (at0 ? toTimeInput(at0) : '') + '"></label></div>' + (rd ? '<div class="sm-atnote">' + sureNote(rd, 'at') + '</div>' : '') +
      fld('sfo', 'Offence', v('offence', ''), 'offence', 'For example Speeding') +
      '<label class="field' + (rd && rd.amount && rd.amount.sure < 80 ? ' sm-warnf' : '') + '"><span>Fine amount</span><div class="rmfield"><input class="inp" id="sfm" inputmode="decimal" autocomplete="off" value="' + (v('amount', '') !== '' ? esc(money2(v('amount', 0))) : '') + '" placeholder="0.00"></div>' + sureNote(rd, 'amount') + '</label>' +
      '<div class="sec"><h2>Booking that had the car</h2></div><div id="sfmatch"></div>' +
      '<small class="err" id="sferr" hidden></small>' +
      '<div class="sheet-foot stack"><button type="button" class="btn" id="sfok">Confirm and save</button>' + (s && s.status !== 'Needs review' ? '' : '<button type="button" class="btn link" id="sflater">Save, check it later</button>') + '</div>', null, { full: true,
        guard: function () { return !s && photo ? { title: 'Close without saving?', text: 'The photo and what was read from it will be lost. Tap Save, check it later to keep it.', ok: 'Close anyway', cancel: 'Keep editing' } : fg(); } });
    fg.arm(sh);
    function fld(id, label, val, k, ph, extra) { return '<label class="field' + (rd && rd[k] && rd[k].sure < 80 ? ' sm-warnf' : '') + '"><span>' + label + '</span><input class="inp" id="' + id + '" autocomplete="off" spellcheck="false" value="' + esc(val || '') + '" placeholder="' + esc(ph) + '"' + (extra || '') + '>' + sureNote(rd, k) + '</label>'; }
    segPick('#sfa', function (t) { auth = t; });
    var ph = $('#smph', sh); if (ph) ph.onclick = function () { M7.zoom(photo, { title: 'Summons' }); };
    var atNow = function () { var d = $('#sfd', sh).value, t = $('#sft', sh).value; return d && t ? fromInputs(d, t) : null; };
    var m = null;
    var drawMatch = function () {
      var plate = $('#sfp', sh).value, at = atNow(); m = matchFor(plate, at);
      if (chosen && !bk(chosen)) chosen = null;
      if (!byHand) chosen = m.state === 'one' ? m.bookings[0].id : m.bookings.some(function (b) { return b.id === chosen; }) ? chosen : null;
      var html = '<div class="banner ' + (m.state === 'one' ? 'green' : m.state === 'ambiguous' ? 'amber' : m.state === 'unknown' ? 'blue' : 'red') + ' sm-hint">' + I(m.state === 'one' ? 'check' : 'info') + '<div>' + esc(hint(m)) + '</div></div>';
      var cands = m.bookings.slice();
      if (chosen && cands.every(function (b) { return b.id !== chosen; })) cands.unshift(bk(chosen));
      if (cands.length) html += '<div class="list">' + cands.map(function (b) { var cu = cust(b.cust); return '<button type="button" class="card2 sm-cand' + (b.id === chosen ? ' on' : '') + '" data-b="' + b.id + '"><span class="sm-radio"></span><div class="c2-main"><div class="c2-t1">' + esc(b.code) + ' · ' + esc(cu.name) + (b.id === chosen && byHand ? ' <span class="chip tone-grey">Chosen by you</span>' : '') + '</div><div class="c2-t2">' + esc(when(b.start)) + ' to ' + esc(when(b.end)) + '</div>' + (m.bookings.indexOf(b) < 0 && at ? '<div class="sm-off">' + I('warn') + 'This booking did not have the car at the time on the notice</div>' : '') + '</div></button>'; }).join('') + '</div>';
      if (m.state === 'none' && m.car && at) { var nb = nearby(m.car, at); if (nb.length) html += '<div class="sm-near">Close to that time: ' + nb.map(function (x) { return '<button type="button" class="sm-nearb" data-b="' + x.b.id + '">' + esc(x.b.code) + '</button> ' + (x.rel === 'ended' ? 'returned ' + gapText(x.gap) + ' before' : 'picked up ' + gapText(x.gap) + ' after'); }).join('; ') + '</div>'; }
      html += '<button type="button" class="btn ghost sm-pickb" id="sfpick">' + I('search') + (chosen ? 'Pick another booking' : 'Pick a booking') + '</button>' + (chosen && byHand ? '<button type="button" class="btn link" id="sfauto">Match again by date and time</button>' : '');
      $('#sfmatch', sh).innerHTML = html;
      $$('[data-b]', sh).forEach(function (b) { b.onclick = function () { chosen = b.dataset.b; byHand = m.state !== 'one' || chosen !== (m.bookings[0] || {}).id; drawMatch(); }; });
      $('#sfpick', sh).onclick = function () { var c = m.car || carByPlate($('#sfp', sh).value); Pickers.booking({ title: c ? 'Bookings of ' + c.plate : 'Pick a booking', filter: c ? function (b) { return b.car === c.id; } : null, selected: chosen, onPick: function (b) { chosen = b.id; byHand = true; if (!$('#sfp', sh).value.trim() && car(b.car)) $('#sfp', sh).value = car(b.car).plate; drawMatch(); } }); };
      var au = $('#sfauto', sh); if (au) au.onclick = function () { byHand = false; chosen = null; drawMatch(); };
    };
    ['#sfp', '#sfd', '#sft'].forEach(function (id) { $(id, sh).addEventListener('change', drawMatch); });
    $('#sfp', sh).addEventListener('input', function () { clearTimeout(drawMatch.t); drawMatch.t = setTimeout(drawMatch, 300); });
    drawMatch();
    var collect = function (strict) {
      var err = $('#sferr', sh), fail = function (t) { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); return null; };
      err.hidden = true;
      var notice = $('#sfn', sh).value.trim().toUpperCase(), plate = $('#sfp', sh).value.trim().toUpperCase(), at = atNow(), amt = $('#sfm', sh).value.trim() ? parseMoney($('#sfm', sh).value) : NaN, off = $('#sfo', sh).value.trim();
      if (strict) {
        if (!notice) return fail('Type the notice number.');
        if (!plate) return fail('Type the plate.');
        if (!at) return fail('Pick the date and time of the offence.');
        if (at > new Date()) return fail('The offence time cannot be in the future.');
        if (isNaN(amt) || amt <= 0) return fail('Type the fine as an amount, for example 150.');
      } else {
        if (isNaN(amt) && $('#sfm', sh).value.trim()) return fail('Type the fine as an amount, for example 150.');
        if (!photo && !notice && !plate) return fail('Type at least the notice number or the plate, so you can find it later.');
      }
      var dup = notice && (S.summons || []).filter(function (x) { return x.notice && x.notice.toUpperCase() === notice && (!s || x.id !== s.id); })[0];
      if (dup) return fail('This notice is already in the list (' + dup.status + ').');
      var c = carByPlate(plate);
      return { notice: notice, plate: c ? c.plate : plate, car: c ? c.id : null, at: at ? at.toISOString() : null, amount: isNaN(amt) ? 0 : amt, offence: off, authority: auth };
    };
    var store = function (vals, status) {
      var row = s || { id: uid(), photo: photo, chargedAmt: null, chargedAt: null, paidAt: null, reason: '', by: S.me, created: new Date().toISOString(), fromPhoto: !!rd };
      Object.assign(row, vals); row.byHand = byHand; row.status = status;
      if (!s) S.summons = (S.summons || []).concat(row);
      linkBooking(row, chosen);
      var b = row.booking && bk(row.booking);
      if (b) bLog(b, 'Summons ' + title(row) + ' ' + (s ? 'checked' : 'added') + ' (' + rm(row.amount) + ', ' + row.offence + ')');
      else audit('Summons ' + title(row) + ' ' + (s ? 'checked' : 'added') + (row.car ? ' for ' + row.plate : ''), { car: row.car, link: '#summons' });
      save(); return row;
    };
    $('#sfok', sh).onclick = function () {
      var vals = collect(true); if (!vals) return;
      var keep = s && (s.status === 'Waived' || s.status === 'Disputed');
      /* a charged summons moved to another booking: the old charge was asked from someone else, so it is ready to charge again */
      var moved = s && s.status === 'Charged' && chosen !== s.booking;
      var row = store(vals, keep ? s.status : chosen ? (s && s.status === 'Charged' && !moved ? 'Charged' : 'Ready to charge') : 'No booking');
      if (moved) { row.chargedAmt = null; row.chargedAt = null; logS(row, 'Summons ' + title(row) + ' moved to another booking: charge it again'); save(); }
      closeAllSheetsM7(); render(false, true); say(moved && chosen ? 'Moved to another booking. Charge the new customer.' : keep ? 'Details saved. It stays ' + s.status.toLowerCase() + '.' : chosen ? 'Details confirmed. You can charge it now.' : 'Saved under No booking');
      if (!keep && chosen && can('summons.charge')) later(function () { open(row.id); }, 350);
    };
    var lt = $('#sflater', sh); if (lt) lt.onclick = function () { var vals = collect(false); if (!vals) return; store(vals, 'Needs review'); closeAllSheetsM7(); render(false, true); say('Saved under Needs review'); };
  }
  function checkSummary(rd) {
    var names = { notice: 'the notice number', plate: 'the plate', at: 'the date and time', amount: 'the amount', authority: 'who issued it', offence: 'what the offence was' };
    var low = Object.keys(rd).filter(function (k) { return rd[k].sure < 80; }).map(function (k) { return names[k]; });
    if (!low.length) return 'Everything was read clearly, but please compare it with the picture once.';
    return 'Look closely at ' + (low.length > 1 ? low.slice(0, -1).join(', ') + ' and ' + low[low.length - 1] : low[0]) + '.';
  }
  function closeAllSheetsM7() { var n = SHEETS.length; if (!n) return; var st = history.state && history.state.fmsSheet; closeAllSheets(); if (st) { _ignorePop++; history.go(-n); } }

  /* ---------- one summons ---------- */
  function open(id) {
    var s = byId(S.summons, id); if (!s) { say('This summons is not there any more'); return; }
    var b = s.booking && bk(s.booking), cu = b ? cust(b.cust) : null, c = s.car && car(s.car), total = (+s.amount || 0) + fee();
    var m = !b && s.plate && s.at ? matchFor(s.plate, s.at) : null;
    var acts = [];
    if (s.status === 'Needs review' && can('summons.upload')) acts.push('<button type="button" class="btn" data-a="check">' + I('eye') + 'Check the details</button>');
    if (s.status === 'No booking' && can('summons.upload') && m && m.state === 'one') acts.push('<button type="button" class="btn" data-a="linkone">' + I('check') + 'Link ' + esc(m.bookings[0].code) + '</button>');
    if (s.status === 'No booking' && can('summons.upload')) acts.push('<button type="button" class="btn' + (m && m.state === 'one' ? ' ghost' : '') + '" data-a="pick">' + I('search') + 'Pick a booking</button>');
    if (s.status === 'Ready to charge' && can('summons.charge')) acts.push('<button type="button" class="btn" data-a="charge">' + I('wa') + 'Charge customer</button>');
    /* the deposit is still held: the summons can be taken from it */
    var depX = b && window.Deposit && (s.status === 'Ready to charge' || s.status === 'Charged') && can('deposits.edit_deductions') ? Deposit.info(b) : null;
    var fromDep = depX && !depX.refund && !depX.cancelled && depX.basis > 0 && b.paymentStatus !== 'Deposit Refunded';
    if (fromDep) acts.push('<button type="button" class="btn ghost" data-a="dep">' + I('shield') + 'Take from the deposit (' + rm(depX.net) + ' held)</button>');
    if (s.status === 'Charged') {
      if (can('summons.record_payment')) acts.push('<button type="button" class="btn sm-paid" data-a="paid">' + I('cash') + 'Mark as paid</button>');
      if (can('summons.charge')) acts.push('<button type="button" class="btn ghost" data-a="charge">' + I('wa') + 'Change amount or send again</button>');
    }
    if (s.status === 'Paid' && s.receiptNo) acts.push('<button type="button" class="btn ghost" data-a="receipt">' + I('receipt') + 'See receipt ' + esc(s.receiptNo) + '</button>');
    var small = [];
    if (isOpen(s) && s.status !== 'Disputed' && can('summons.waive')) small.push('<button type="button" class="btn link" data-a="waive">Waive</button>');
    if (isOpen(s) && s.status !== 'Disputed' && can('summons.charge')) small.push('<button type="button" class="btn link" data-a="dispute">Mark as disputed</button>');
    if ((s.status === 'Waived' || s.status === 'Disputed') && can('summons.waive')) small.push('<button type="button" class="btn link" data-a="reopen">Open it again</button>');
    if (s.status !== 'Paid' && s.status !== 'Needs review' && can('summons.upload')) small.push('<button type="button" class="btn link" data-a="edit">Edit details</button>');
    var bkHtml = b ? '<a class="card2 list sm-bk" href="#booking/' + b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(b.code) + ' · ' + esc(cu.name) + (s.byHand ? ' <span class="chip tone-grey">Chosen by you</span>' : '') + '</div><div class="c2-t2">' + esc(when(b.start)) + ' to ' + esc(when(b.end)) + '</div></div>' + I('chev') + '</a>'
      : m && m.state === 'one' ? '<div class="banner green">' + I('check') + '<div><b>' + esc(m.bookings[0].code) + ' · ' + esc(cust(m.bookings[0].cust).name) + '</b> had this car at that time. Link it to charge the customer.</div></div>'
      : '<div class="banner red">' + I('info') + '<div><b>No booking.</b> ' + esc(m ? (m.state === 'no_car' ? hint(m) : m.state === 'none' && m.car ? 'Our car ' + m.car.make + ' ' + m.car.model + ' (' + m.car.plate + ') had no booking on ' + dFull(s.at) + ', ' + hm(s.at) + '.' : hint(m)) : 'The plate or the date and time could not be read yet.') + '</div></div>';
    sheet(sheetHead(s.notice ? 'Summons ' + s.notice : s.photo ? 'Summons from a picture' : 'Summons, no notice number yet', (c ? c.plate + ' · ' + c.make + ' ' + c.model : s.plate || '')) +
      '<div class="sm-head">' + chip(s.status, TONE[s.status]) + (s.reason ? '<span class="sm-reason">' + esc(s.reason) + '</span>' : '') + '</div>' +
      (s.status === 'Needs review' ? '<div class="banner amber">' + I('eye') + '<div><b>' + (s.fromPhoto ? 'Check what was read from the picture' : 'Check the details') + '</b> before charging anyone.</div></div>' : '') +
      '<div class="sm-detail">' + (s.photo ? '<button type="button" class="sm-dph" id="sdph"><img alt="Summons photo" src="' + esc(imgSrc(s.photo)) + '"></button>' : '') +
      '<div class="kv sm-kv"><div><div class="k">Issued by</div><div class="v">' + esc(s.authority || 'Not read') + '</div></div><div><div class="k">Plate</div><div class="v">' + (c ? '<a class="mt-link" href="#car/' + c.id + '">' + esc(c.plate) + '</a>' : esc(s.plate || 'Not read')) + '</div></div>' +
      '<div><div class="k">Date and time</div><div class="v">' + esc(s.at ? dFull(s.at) + ', ' + hm(s.at) : 'Not read') + '</div></div><div><div class="k">Fine</div><div class="v money sm-l">' + rm(s.amount) + '</div></div>' +
      '<div class="sm-wide"><div class="k">Offence</div><div class="v">' + esc(s.offence || 'Not read') + '</div></div></div></div>' +
      '<div class="sec"><h2>Booking that had the car</h2></div>' + bkHtml +
      '<div class="sec"><h2>Money</h2></div><div class="list sm-money">' + mrow('Fine', s.amount) + mrow('Our admin fee', fee()) + mrow('Fine + fee', total, true) +
      (s.chargedAmt != null ? mrow('Asked from the customer', s.chargedAmt, true, s.chargedAt ? 'on ' + dShort(s.chargedAt) : '') : '') + (s.paidAt ? mrow(s.paidFrom === 'deposit' ? 'Taken from the deposit' : 'Paid', s.paidAmt != null ? s.paidAmt : s.chargedAmt, true, 'on ' + dShort(s.paidAt)) : '') + '</div>' +
      '<p class="hint">Added by ' + esc(who(s.by) || 'someone') + ' on ' + esc(dFull(s.created || s.at)) + (s.fromPhoto ? ', read from a picture' : '') + '</p>' +
      ((acts.length || small.length) ? '<div class="sheet-foot stack">' + acts.join('') + (small.length ? '<div class="sm-small">' + small.join('') + '</div>' : '') + '</div>' : ''), function (sh) {
        var ph = $('#sdph', sh); if (ph) ph.onclick = function () { M7.zoom(s.photo, { title: 'Summons', sub: s.notice }); };
        $$('[data-a]', sh).forEach(function (bt) {
          bt.onclick = function () {
            var a = bt.dataset.a;
            if (a === 'check' || a === 'edit') form(s);
            else if (a === 'pick') pickBooking(s);
            else if (a === 'linkone' && m && m.state === 'one') { var lb = m.bookings[0]; linkBooking(s, lb.id); s.byHand = false; s.status = 'Ready to charge'; bLog(lb, 'Summons ' + title(s) + ' tied to this booking'); save(); open(s.id); render(false, true); say('Linked to ' + lb.code); }
            else if (a === 'charge') charge(s);
            else if (a === 'paid') markPaid(s);
            else if (a === 'dep') {
              var amt = s.chargedAmt != null ? +s.chargedAmt : (+s.amount || 0) + fee();
              confirm({ icon: 'shield', title: 'Take ' + rm(amt) + ' from the deposit?', text: 'It is added as a Summons adjustment on ' + b.code + ' and the summons is marked paid. The customer gets the rest of the deposit back.', ok: 'Take from the deposit', cancel: 'Not now' })
                .then(function (y) { if (!y) return; if (Deposit.takeSummons(b, s)) { closeAllSheetsM7(); render(false, true); say('Taken from the deposit. The summons is paid.'); } });
            }
            else if (a === 'receipt') receipt(s);
            else if (a === 'waive' || a === 'dispute') reasonSheet(s, a);
            else if (a === 'reopen') { var prev = s.status; s.status = s.booking ? (s.chargedAmt != null ? 'Charged' : 'Ready to charge') : 'No booking'; s.reason = ''; logS(s, 'Summons ' + title(s) + ' opened again (was ' + prev + ')'); save(); open(s.id); render(false, true); say('Summons opened again'); }
          };
        });
      }, { full: true });
  }
  function mrow(label, amt, bold, sub) { return '<div class="card2 sm-mrow"><div class="c2-main"><div class="c2-t1' + (bold ? '' : ' sm-norm') + '">' + esc(label) + '</div>' + (sub ? '<div class="c2-t2">' + esc(sub) + '</div>' : '') + '</div><div class="c2-end"><span class="money">' + rm(amt) + '</span></div></div>'; }
  function logS(s, text) { var b = s.booking && bk(s.booking); if (b) bLog(b, text); else audit(text, { car: s.car, link: '#summons' }); }
  function pickBooking(s) {
    var c = s.car && car(s.car);
    Pickers.booking({ title: c ? 'Bookings of ' + c.plate : 'Pick a booking', filter: c ? function (b) { return b.car === c.id; } : null, onPick: function (b) {
      linkBooking(s, b.id); s.byHand = true; if (s.status === 'No booking') s.status = 'Ready to charge';
      bLog(b, 'Summons ' + title(s) + ' tied to this booking by hand'); save(); open(s.id); render(false, true); say('Booking chosen');
    } });
  }
  function message(s, amt) {
    var b = bk(s.booking), cu = cust(b.cust), c = car(s.car) || car(b.car), bb = B();
    var lines = ['Hi ' + (callName(cu.name) || 'there') + ', this is ' + bb.name + '.',
      'A ' + (AUTH_NAME[s.authority] || s.authority || '') + ' summons was issued to the car you rented (' + (c ? c.make + ' ' + c.model + ' ' + c.plate : s.plate) + ', booking ' + b.code + ').',
      'Notice no: ' + s.notice];
    if (s.offence) lines.push('Offence: ' + s.offence);
    lines.push('Date and time: ' + dmy(s.at));
    lines.push('Amount to pay us: ' + rm(amt) + (fee() && Math.abs(amt - (+s.amount + fee())) < .005 ? ' (fine ' + rm(s.amount) + ' + admin fee ' + rm(fee()) + ')' : ''));
    var bank = bb.bank ? [bb.bank.name, bb.bank.accName, bb.bank.accNo].filter(Boolean) : [];
    lines.push(bank.length ? 'Please transfer to: ' + bank.join(', ') + '.' : 'Please tell us how you would like to pay.');
    lines.push('Use ' + b.code + ' as the payment reference and send us the slip. Thank you.');
    return lines.join('\n');
  }
  function charge(s) {
    var b = s.booking && bk(s.booking); if (!b) { say('Pick a booking first'); return; }
    var cu = cust(b.cust), def = s.chargedAmt != null ? s.chargedAmt : (+s.amount || 0) + fee();
    sheet(sheetHead('Charge the customer', cu.name + ' · ' + b.code) +
      '<label class="field"><span>Amount to ask for</span><div class="rmfield"><input class="inp sm-amt" id="scamt" inputmode="decimal" value="' + money2(def) + '"></div><small class="hint">Fine ' + rm(s.amount) + ' + admin fee ' + rm(fee()) + ' = ' + rm((+s.amount || 0) + fee()) + '</small><small class="err" id="scerr" hidden></small></label>' +
      '<div class="field"><span>WhatsApp message</span><div class="sm-msg" id="scmsg"></div><button type="button" class="btn link sm sm-copy" id="sccopy">' + I('copy') + 'Copy message</button></div>' +
      (cu.phone ? '' : '<div class="banner red">' + I('warn') + '<div>This customer has no phone number. Copy the message and send it another way.</div></div>') +
      '<div class="sheet-foot"><button type="button" class="btn sm-wabtn" id="scgo">' + I('wa') + (s.status === 'Charged' ? 'Save and open WhatsApp' : 'Charge and open WhatsApp') + '</button></div>', function (sh) {
        var amtIn = $('#scamt', sh), err = $('#scerr', sh);
        var upd = function () { var a = parseMoney(amtIn.value); $('#scmsg', sh).textContent = message(s, isNaN(a) ? 0 : a); };
        amtIn.oninput = function () { err.hidden = true; upd(); }; upd();
        $('#sccopy', sh).onclick = function () { var a = parseMoney(amtIn.value); Share.copy(message(s, isNaN(a) ? 0 : a), 'Message copied'); };
        $('#scgo', sh).onclick = function () {
          var a = parseMoney(amtIn.value); if (isNaN(a) || a <= 0) { err.textContent = 'Type the amount, for example ' + money2(def) + '.'; err.hidden = false; return; }
          var was = s.status, prevAmt = s.chargedAmt;
          s.chargedAmt = a; s.chargedAt = new Date().toISOString(); s.chargedBy = S.me; s.status = 'Charged';
          bLog(b, was === 'Charged' ? 'Summons ' + title(s) + ' amount changed from ' + rm(prevAmt) + ' to ' + rm(a) + ', sent on WhatsApp' : 'Customer charged ' + rm(a) + ' for summons ' + title(s) + ' on WhatsApp');
          save();
          if (cu.phone) Share.wa(cu.phone, message(s, a));
          closeAllSheetsM7(); render(false, true); say(cu.phone ? 'Charged. WhatsApp is opening.' : 'Charged. Send the message another way.');
        };
      }, { stack: true });
  }
  function markPaid(s) {
    var b = s.booking && bk(s.booking); if (!b) return;
    var method = 'Online Transfer';
    sheet(sheetHead('Mark as paid', 'Summons ' + s.notice + ' · ' + b.code) +
      '<label class="field"><span>Amount received</span><div class="rmfield"><input class="inp sm-amt" id="spamt" inputmode="decimal" value="' + money2(s.chargedAmt != null ? s.chargedAmt : (+s.amount || 0) + fee()) + '"></div></label>' +
      '<div class="field"><span>How they paid</span><div class="seg" id="spm">' + [['Online Transfer', 'Transfer'], ['Cash', 'Cash'], ['Card', 'Card']].map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (x[0] === method ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="mt-2"><label class="field"><span>When</span><input class="inp" type="date" id="spd" max="' + toLocalInput(new Date()) + '" value="' + toLocalInput(new Date()) + '"></label><label class="field"><span>Slip or reference</span><input class="inp" id="spref" autocomplete="off" placeholder="Optional"></label></div>' +
      '<p class="hint">This is recorded as an Other payment with its own receipt. The booking’s payment status does not change.</p><small class="err" id="sperr" hidden></small>' +
      '<div class="sheet-foot"><button type="button" class="btn sm-paid" id="spok">' + I('check') + 'Record payment</button></div>', function (sh) {
        segPick('#spm', function (t, bt) { method = bt.dataset.v; });
        $('#spok', sh).onclick = function () {
          var a = parseMoney($('#spamt', sh).value), err = $('#sperr', sh);
          if (isNaN(a) || a <= 0) { err.textContent = 'Type the amount received, for example 170.'; err.hidden = false; return; }
          var ds = $('#spd', sh).value || toLocalInput(new Date()), at = ds === toLocalInput(new Date()) ? new Date() : new Date(ds + 'T12:00:00');
          var p = newPayment({ items: [{ kind: 'Other payment', amt: a }], method: method, cashTo: method === 'Cash' ? S.me : null, ref: $('#spref', sh).value.trim(), note: 'Summons ' + s.notice, at: at.toISOString(), by: S.me, summonsId: s.id });
          b.payments = (b.payments || []).concat(p);
          var no = null;
          if (typeof billNo === 'function') {
            S.receipts = S.receipts || [];
            var r = { id: uid(), no: billNo(S.receipts, B().receiptPrefix || 'RCP', p.at), booking: b.id, at: new Date().toISOString(), by: S.me, lines: [p.id], kind: 'summons', summons: s.id, title: 'Summons ' + s.notice };
            S.receipts.push(r); p.receiptNo = r.no; no = r.no;
          }
          s.status = 'Paid'; s.paidAt = at.toISOString(); s.paidAmt = a; s.payId = p.id; s.receiptNo = no;
          bLog(b, 'Summons ' + s.notice + ' paid: ' + rm(a) + ' (' + method + ')' + (no ? ', receipt ' + no : ''));
          save(); closeAllSheetsM7(); render(false, true); say(no ? 'Marked as paid. Receipt ' + no + ' is ready.' : 'Marked as paid. The payment is recorded.');
        };
      }, { stack: true });
  }
  function receipt(s) {
    var b = bk(s.booking), cu = b ? cust(b.cust) : { name: '' }, p = b ? (b.payments || []).filter(function (x) { return x.id === s.payId; })[0] : null;
    pdfDoc('receipt', { no: s.receiptNo, title: 'Receipt', date: s.paidAt, to: { name: cu.name, phone: cu.phone }, booking: b ? b.code : '',
      lines: [{ text: 'Summons ' + s.notice, sub: [s.authority, s.offence, s.at ? dFull(s.at) + ', ' + hm(s.at) : '', s.plate].filter(Boolean).join(' · '), amt: s.paidAmt != null ? s.paidAmt : s.chargedAmt }],
      totals: [{ label: 'Paid', amt: s.paidAmt != null ? s.paidAmt : s.chargedAmt, big: true }], notes: p ? 'Paid by ' + (p.method === 'Online Transfer' ? 'transfer' : p.method.toLowerCase()) + ' on ' + dFull(p.at) + (p.ref ? ', ref ' + p.ref : '') + '.' : '', stack: true,
      shareText: 'Receipt ' + s.receiptNo + ' for summons ' + s.notice });
  }
  function reasonSheet(s, kind) {
    var w = kind === 'waive' ? { t: 'Waive this summons', help: 'The customer will not be charged. You can open it again later if you change your mind.', label: 'Why is it being waived?', btn: 'Waive summons', done: 'Summons waived', st: 'Waived' }
      : { t: 'Mark as disputed', help: 'Use this while the fine is being challenged with the authority, or the customer says it is not theirs.', label: 'What is being disputed?', btn: 'Mark as disputed', done: 'Summons marked as disputed', st: 'Disputed' };
    sheet(sheetHead(w.t, 'Summons ' + (s.notice || '')) + '<p class="lead">' + esc(w.help) + '</p>' +
      '<label class="field"><span>' + esc(w.label) + '</span><textarea class="inp cr-ta" id="srr" rows="3"></textarea><small class="err" id="srerr" hidden></small></label>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="srok">' + esc(w.btn) + '</button></div>', function (sh) {
        setTimeout(function () { try { $('#srr', sh).focus({ preventScroll: true }); } catch (e) {} }, 300);
        $('#srok', sh).onclick = function () {
          var r = $('#srr', sh).value.trim(); if (r.length < 3) { $('#srerr', sh).textContent = 'Please write the reason.'; $('#srerr', sh).hidden = false; return; }
          s.status = w.st; s.reason = r; logS(s, 'Summons ' + title(s) + ' ' + (kind === 'waive' ? 'waived' : 'marked as disputed') + ': ' + r);
          save(); closeAllSheetsM7(); render(false, true); say(w.done);
        };
      }, { stack: true });
  }

  /* ---------- booking page card ---------- */
  function forBooking(bid) {
    if (!can('summons.view')) return '';
    var list = (S.summons || []).filter(function (s) { return s.booking === bid; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    if (!list.length) return '';
    var open = list.filter(isOpen).length;
    return '<div class="sec"><h2>Summons</h2><span class="small ' + (open ? 'tone-amber-text' : 'muted') + '">' + (open ? open + ' open' : 'All settled') + '</span></div><div class="list sm-bkcard">' + list.map(function (s) {
      return '<button type="button" class="card2" onclick="Summons.open(\'' + s.id + '\')"><div class="c2-main"><div class="c2-t1">' + esc(title(s)) + '</div><div class="c2-t2">' + esc(s.offence || '') + ' · ' + esc(s.at ? dShort(s.at) + ', ' + hm(s.at) : '') + '</div></div>' +
        '<div class="c2-end"><span class="money">' + rm(s.chargedAmt != null ? s.chargedAmt : s.amount) + '</span><small>' + chip(s.status, TONE[s.status]) + '</small></div></button>';
    }).join('') + '</div>';
  }

  VIEWS.summons = view;
  return { forBooking: forBooking, open: open, snap: snap, matchFor: matchFor, message: message };
})();

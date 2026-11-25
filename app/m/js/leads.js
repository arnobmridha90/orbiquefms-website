/* ---------------- LEADS (M6) ----------------
   WhatsApp leads: the people the booking assistant talked to, with their dates, car, places and estimate.
   Leads.summary(waId)  the lead card (in a thread it has the buttons; anywhere else it is read only)
   Leads.stateOf(w), Leads.tabOf(w), Leads.TABS, Leads.listLine(w)  used by the Chat list (chat.js)
   Leads.take / release / close / reopen / book, Leads.setAssistant(on), Leads.simulateNew()
   #leads opens Chat > Customers on "Waiting for staff". */
var Leads = (function () {
  var OPEN = {}; /* thread id -> card opened (true) / folded (false) by the person */
  VIEW_STATE.push(function () { OPEN = {}; });
  var TABS = [
    { k: 'all', label: 'All' },
    { k: 'waiting', label: 'Waiting for staff' },
    { k: 'mine', label: 'Mine' },
    { k: 'assistant', label: 'Assistant chatting' },
    { k: 'closed', label: 'Closed' }
  ];
  function wa(id) { return byId(S.wa, id); }
  function stateOf(w) {
    var l = w && w.lead; if (l && l.state) return l.state;
    return !w ? '' : w.status === 'Booked' ? 'booked' : w.status === 'Closed' ? 'closed' : w.handled === 'bot' ? 'assistant' : 'waiting';
  }
  /* which list tab a thread belongs to (besides All) */
  function inTab(w, k) {
    var s = stateOf(w), l = w.lead || {};
    if (k === 'waiting') return s === 'waiting';
    if (k === 'mine') return l.takenBy === S.me && (s === 'taken' || s === 'waiting');
    if (k === 'assistant') return s === 'assistant';
    if (k === 'closed') return s === 'closed' || s === 'booked';
    return true;
  }
  function holdMin(l) { if (!l || !l.holdUntil) return 0; var m = Math.ceil((new Date(l.holdUntil) - Date.now()) / MIN); return m > 0 ? m : 0; }
  function AM(d) { return hm(d).replace(/ ?(am|pm)$/i, function (x) { return ' ' + x.trim().toUpperCase(); }); }
  function dayT(d) { return dLong(d) + ', ' + AM(d); }
  function datesText(l) { if (!l || !l.start) return ''; return l.end ? dayT(l.start) + ' → ' + dayT(l.end) : dayT(l.start); }
  function shortDates(l) { if (!l || !l.start) return ''; return dShort(l.start) + (l.end ? ' → ' + dShort(l.end) : ''); }
  function placeName(l, end) {
    var k = end === 'ret' ? l.retKind : l.pickKind, id = end === 'ret' ? l.retLoc : l.pickLoc, note = end === 'ret' ? l.retNote : l.pickNote;
    if (k === 'our') { var o = loc(id); return (end === 'ret' ? 'Drop-off at ' : 'Pick-up at ') + (o ? o.name : 'our location'); }
    if (k === 'place') { var p = place(id); return (end === 'ret' ? 'Return from ' : 'Delivery to ') + (p ? p.name : 'another place'); }
    if (k === 'client') return (end === 'ret' ? 'Collect from ' : 'Deliver to ') + (note || 'the customer’s address');
    return '';
  }
  /* 'Free at our location' / 'RM 40.00' / 'To quote' */
  function feeOf(l, end) {
    var k = end === 'ret' ? l.retKind : l.pickKind, id = end === 'ret' ? l.retLoc : l.pickLoc, given = end === 'ret' ? l.retFee : l.pickFee;
    if (k === 'our') return { text: 'Free at our location', amt: 0, known: true };
    if (given != null) return { text: rm(given), amt: +given, known: true };
    if (k === 'place') { var f = placeFee('place', id, end); return f ? { text: rm(f), amt: f, known: true } : { text: 'To quote', amt: 0, known: false }; }
    if (k === 'client') return { text: 'To quote', amt: 0, known: false };
    return null;
  }
  function stateChip(w) {
    var s = stateOf(w), l = w.lead || {}, mine = l.takenBy === S.me;
    if (s === 'waiting') return chip(l.takenBy ? (mine ? 'You took it' : firstName(who(l.takenBy)) + ' took it') : 'Waiting for staff', l.takenBy ? 'green' : 'amber');
    if (s === 'taken') return chip(mine ? 'You took it' : firstName(who(l.takenBy)) + ' took it', 'green');
    if (s === 'assistant') return chip('Assistant chatting', 'blue');
    if (s === 'booked') return chip('Booked', 'emerald');
    if (s === 'closed') return chip('Closed', 'grey');
    return '';
  }
  function holdChip(l, long) { var m = holdMin(l); return m ? '<span class="chip tone-amber ld-hold" data-hold="' + esc(l.holdUntil) + '" data-long="' + (long ? 1 : '') + '">' + (long ? 'Car held for ' + m + ' more min' : 'Held ' + m + ' min') + '</span>' : ''; }
  /* one line for the list: dates and car */
  function listLine(w) {
    var l = w.lead || {}, c = l.car ? car(l.car) : null, bits = [];
    if (l.start) bits.push(shortDates(l));
    if (c) bits.push(c.make + ' ' + c.model);
    if (!bits.length && l.question) bits.push('Asked: ' + l.question);
    return bits.join(' · ');
  }
  function row(label, val, sub, wide) { return '<div class="ld-cell' + (wide ? ' wide' : '') + '"><span class="ld-k">' + esc(label) + '</span><span class="ld-v">' + val + (sub ? '<small>' + sub + '</small>' : '') + '</span></div>'; }

  /* ---------- the card ---------- */
  function summary(id, opts) {
    opts = opts || {};
    var w = wa(id); if (!w || !w.lead) return '';
    var l = w.lead, s = stateOf(w), inThread = opts.thread != null ? opts.thread : (route().name === 'chat' && route().a === 'wa');
    var c = l.car ? car(l.car) : null, pf = feeOf(l, 'pick'), rf = feeOf(l, 'ret'), b = l.bookingId ? bk(l.bookingId) : (w.bookingId ? bk(w.bookingId) : null);
    var body = '';
    if (s === 'booked' && b) body += '<div class="ld-booked">' + I('check', 2.4) + '<span class="grow">Booked as <a class="chip tone-emerald ld-bkchip" href="#booking/' + b.id + '">' + esc(b.code) + '</a></span>' + statusChip(b) + '</div>';
    /* the customer's question is the line staff need most: it comes first, above the details */
    if (l.question && s !== 'booked' && s !== 'closed') body += '<div class="ld-q">' + I('chat') + '<div><b>Customer asks:</b> ' + esc(l.question) + '</div></div>';
    body += '<div class="ld-grid">';
    body += row('Dates', l.start ? esc(datesText(l)) : '<span class="muted">Not given yet</span>', l.start && l.end ? esc(durationText(l.start, l.end)) : '', true);
    body += row('Car', c ? esc(c.make + ' ' + c.model) + ' <span class="muted">' + esc(c.plate) + '</span>' : '<span class="muted">Not chosen yet</span>', s !== 'booked' && s !== 'closed' ? holdChip(l, true) || (c && l.start && !l.holdUntil ? 'Not held' : '') : '', true);
    if (pf) body += row('Pick-up', esc(pf.text), esc(placeName(l, 'pick')) + (l.km && l.pickKind !== 'our' ? ' · about ' + l.km + ' km' : ''));
    if (rf) body += row('Return', esc(rf.text), esc(placeName(l, 'ret')) + (l.km && l.retKind !== 'our' ? ' · about ' + l.km + ' km' : ''));
    if (l.estimate != null && can('bookings.see_amounts')) {
      var known = (pf ? pf.amt : 0) + (rf ? rf.amt : 0), unknown = (pf && !pf.known) || (rf && !rf.known);
      body += row('Estimate given', '<b class="money ld-money">' + rm(+l.estimate + known) + '</b>' + (unknown ? ' <span class="muted">+ delivery to quote</span>' : ''), known ? esc('Rent ' + rm(l.estimate) + ' + fees') : 'Rent only');
    }
    if (l.deposit != null && can('bookings.see_amounts')) body += row('Deposit', '<span class="money">' + rm(l.deposit) + '</span>', 'Returned after the trip');
    body += '</div>';
    if (l.takenBy && (s === 'taken' || s === 'waiting' || s === 'booked')) body += '<div class="ld-by">' + I('user') + (l.takenBy === S.me ? 'You took it' : esc(who(l.takenBy)) + ' took it') + (l.takenAt ? ' ' + esc(ago(l.takenAt)) : '') + '</div>';
    if (s === 'closed' && l.closedAt) body += '<div class="ld-by">' + I('check') + 'Closed ' + esc(ago(l.closedAt)) + (l.takenBy ? ' by ' + esc(firstName(who(l.takenBy))) : '') + '</div>';
    if (inThread && can('leads.manage')) {
      var btns = '';
      if (s !== 'closed' && s !== 'booked') {
        if (!(l.takenBy === S.me && (s === 'taken' || s === 'waiting'))) btns += '<button type="button" class="btn sm ld-take" onclick="Leads.take(\'' + id + '\')">' + I('user') + 'I’ll take it</button>';
        if (can('bookings.create')) btns += '<button type="button" class="btn sm ' + (l.takenBy === S.me ? '' : 'ghost') + ' ld-book" onclick="Leads.book(\'' + id + '\')">' + I('plus') + 'Make booking</button>';
        if (holdMin(l)) btns += '<button type="button" class="btn sm ghost ld-rel" onclick="Leads.release(\'' + id + '\')">Let go of the car</button>';
        btns += '<button type="button" class="btn sm ghost ld-close" onclick="Leads.close(\'' + id + '\')">Close lead</button>';
      } else if (s === 'closed') btns += '<button type="button" class="btn sm ghost" onclick="Leads.reopen(\'' + id + '\')">' + I('reset') + 'Open again</button>';
      if (btns) body = '<div class="ld-btns">' + btns + '</div>' + body;
    }
    if (!inThread) return '<div class="ld-card ld-flat">' + body + '</div>';
    var open = OPEN[id] != null ? OPEN[id] : (s === 'waiting' || s === 'taken');
    var top = '<button type="button" class="ld-top" onclick="Leads.toggle(\'' + id + '\')" aria-expanded="' + open + '">' + stateChip(w) + (s !== 'booked' && s !== 'closed' ? holdChip(l) : '') +
      '<span class="ld-tl">' + esc([shortDates(l), c ? c.model : ''].filter(Boolean).join(' · ') || 'Lead details') + '</span><span class="ld-chev">' + I('down', 2.2) + '</span></button>';
    return '<div class="ld-card ld-pin' + (open ? ' open' : '') + '" id="ldcard">' + top + '<div class="ld-body">' + body + '</div></div>';
  }

  /* ---------- actions ---------- */
  function done(text) { save(); render(false, true); say(text); }
  function clearAlerts(id) { S.notifs.forEach(function (n) { if (n.link === '#chat/wa/' + id) setNotifRead(n, true); }); }
  function take(id) {
    var w = wa(id); if (!w || !can('leads.manage')) return; var l = w.lead;
    var go = function () {
      var prev = l.takenBy; l.takenBy = S.me; l.takenAt = new Date().toISOString(); if (l.state !== 'booked' && l.state !== 'closed') l.state = 'taken';
      w.handled = 'staff'; w.unread = 0; clearAlerts(id); OPEN[id] = true;
      audit('Took the WhatsApp lead from ' + (w.name || w.phone) + (prev ? ' over from ' + who(prev) : ''), { link: '#chat/wa/' + id });
      done('It is yours. The assistant stays quiet in this chat.');
    };
    if (l.takenBy && l.takenBy !== S.me && (l.state === 'taken' || l.state === 'waiting')) confirm({ icon: 'warn', title: firstName(who(l.takenBy)) + ' is handling this', text: 'Take this customer over from ' + who(l.takenBy) + '?', ok: 'Yes, take it over', cancel: 'Leave it' }).then(function (ok) { if (ok) go(); });
    else go();
  }
  function release(id) { var w = wa(id); if (!w || !can('leads.manage')) return; w.lead.holdUntil = null; audit('Let go of the held car for ' + (w.name || w.phone), { link: '#chat/wa/' + id }); done('The car is free for other customers again'); }
  function close(id) {
    var w = wa(id); if (!w || !can('leads.manage')) return; var l = w.lead, before = { state: l.state, holdUntil: l.holdUntil, closedAt: l.closedAt, status: w.status, takenBy: l.takenBy };
    l.state = 'closed'; l.closedAt = new Date().toISOString(); l.holdUntil = null; if (!l.takenBy) l.takenBy = S.me; w.status = 'Closed'; clearAlerts(id); OPEN[id] = false;
    audit('Closed the WhatsApp lead from ' + (w.name || w.phone), { link: '#chat/wa/' + id }); save(); render(false, true);
    undoSnack('Lead closed', function () { l.state = before.state; l.holdUntil = before.holdUntil; l.closedAt = before.closedAt; l.takenBy = before.takenBy; w.status = before.status; OPEN[id] = true; save(); render(false, true); say('Lead open again'); });
  }
  function reopen(id) { var w = wa(id); if (!w || !can('leads.manage')) return; var l = w.lead; l.state = l.takenBy ? 'taken' : 'waiting'; l.closedAt = null; w.status = 'Lead'; OPEN[id] = true; audit('Opened the WhatsApp lead from ' + (w.name || w.phone) + ' again', { link: '#chat/wa/' + id }); done('Lead open again'); }
  function book(id) {
    var w = wa(id); if (!w) return; var l = w.lead || {};
    if (can('leads.manage') && !l.takenBy && l.state !== 'booked') { l.takenBy = S.me; l.takenAt = new Date().toISOString(); if (l.state !== 'closed') l.state = 'taken'; w.handled = 'staff'; save(); }
    location.hash = hashWith('new', { lead: id });
  }
  function toggle(id) { var el = $('#ldcard'); if (!el) return; var open = !el.classList.contains('open'); OPEN[id] = open; el.classList.toggle('open', open); var t = $('.ld-top', el); if (t) t.setAttribute('aria-expanded', open); }
  function setAssistant(on) {
    if (!can('leads.settings')) { say('Ask the owner for Assistant settings access'); return; }
    S.assistant = { on: !!on, by: S.me, at: new Date().toISOString() };
    audit(on ? 'Switched the booking assistant on' : 'Switched the booking assistant off');
    done(on ? 'Booking assistant switched on' : 'Booking assistant switched off');
  }

  /* ---------- demo: a new customer writes on WhatsApp ---------- */
  var NEW_PEOPLE = [['Nadia Farid', '0173344120'], ['Jason Ng', '0126655432'], ['', '0198812345'], ['Suresh Pillai', '0162207788'], ['Aqilah Zainal', '0114478900']];
  function simulateNew() {
    var quiet = typeof inQuiet === 'function' && inQuiet();
    say(quiet ? 'A new customer will write in a few seconds, without a sound (quiet hours)' : 'A new customer will write in a few seconds');
    later(function () {
      var n = (S.waDemoN = (S.waDemoN || 0) + 1), p = NEW_PEOPLE[(n - 1) % NEW_PEOPLE.length], now = Date.now();
      var cars = S.cars.filter(function (c) { return c.status === 'active'; }), st = sod(new Date(now + 2 * DAY)).getTime() + 9 * HOUR, en = st + 3 * DAY;
      var pickC = cars.filter(function (c) { return isFree(c.id, new Date(st).toISOString(), new Date(en).toISOString()); })[n % 5] || cars[0];
      var pl = (B().places || [])[0], useClient = n % 2 === 0;
      var id = 'wa' + uid(), t = function (m) { return new Date(now - m * MIN).toISOString(); };
      var w = { id: id, name: p[0], phone: fmtPhone(p[1]), status: 'Lead', unread: 3, handled: 'bot', msgs: [
        { from: 'cust', text: 'Hi, I need a car from ' + dLong(st) + ' to ' + dLong(en) + '. ' + (useClient ? 'Can you send it to my house?' : 'Any ' + pickC.model + '?'), at: t(3) },
        { from: 'bot', text: 'Hello! A ' + pickC.make + ' ' + pickC.model + ' is free for those dates: 3 days at ' + rm(pickC.rate) + ' a day, so ' + rm(pickC.rate * 3) + ', plus a ' + rm(pickC.deposit) + ' deposit we return after the trip. I am holding it for you for 30 minutes.', at: t(2) },
        { from: 'cust', text: useClient ? 'Ok. How much to deliver to Taman Melawati?' : 'Can I pay by card at pick-up?', at: t(0) }],
        lead: { state: 'waiting', start: new Date(st).toISOString(), end: new Date(en).toISOString(), car: pickC.id, holdUntil: new Date(now + 30 * MIN).toISOString(),
          pickKind: useClient ? 'client' : pl ? 'place' : 'our', pickLoc: useClient ? null : pl ? pl.id : 'L1', pickNote: useClient ? 'Taman Melawati' : '', retKind: 'our', retLoc: (B().locations[0] || {}).id || 'L1', retNote: '',
          estimate: pickC.rate * 3, deposit: pickC.deposit, question: useClient ? 'How much to deliver to Taman Melawati?' : 'Can I pay by card at pick-up?', takenBy: null, takenAt: null, closedAt: null, bookingId: null, km: useClient ? 11 : 18, at: t(3) } };
      S.wa.unshift(w); save();
      var here = route().name === 'chat' && !route().a;
      notify(KINDS.lead ? 'lead' : 'wa', 'New lead: ' + (w.name || w.phone), (useClient ? 'Wants delivery. ' : '') + 'Waiting for staff', '#chat/wa/' + id);
      if (here) render(false, true);
    }, 2500);
  }

  /* live countdown on the hold chips */
  setInterval(function () {
    $$('[data-hold]').forEach(function (el) {
      var m = Math.ceil((new Date(el.dataset.hold) - Date.now()) / MIN);
      if (m > 0) el.textContent = el.dataset.long ? 'Car held for ' + m + ' more min' : 'Held ' + m + ' min';
      else { el.textContent = 'Hold ended'; el.className = 'chip tone-grey ld-hold'; el.removeAttribute('data-hold'); }
    });
  }, 15000);

  VIEWS.leads = function () { Leads.tab = 'waiting'; history.replaceState(history.state, '', location.pathname + location.search + '#chat'); return VIEWS.chat(route()); };
  return { summary: summary, stateOf: stateOf, inTab: inTab, TABS: TABS, tab: 'all', listLine: listLine, stateChip: stateChip, holdChip: holdChip, holdMin: holdMin, datesText: datesText,
    take: take, release: release, close: close, reopen: reopen, book: book, toggle: toggle, setAssistant: setAssistant, simulateNew: simulateNew };
})();

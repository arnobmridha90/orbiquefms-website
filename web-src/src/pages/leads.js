/* ===================================================================
   Page: Booking assistant (#page=leads&tab=waiting|taken|chatting|closed&lead=<id>&dlg=answers|learned|catalogue)
   Owner: W4. The WhatsApp booking assistant: customers it talked to, their dates, the car it holds for them, the
   estimate, and the chat. The on/off switch, the customer number link (simulated sign-up), the staff-written answers,
   what it learned from staff chats and the catalogue links. Rules (hours, turnaround, hold minutes, delivery fees)
   come from Settings > Booking assistant rules (company.assistant), never fixed values.
   Sets API.openLead(id).
   =================================================================== */
var LD_TABS = [['waiting', 'Waiting for staff', 'warn'], ['taken', 'Staff took over', 'ok'], ['chatting', 'Chatting with the assistant', 'info'], ['closed', 'Closed', 'grey']];
var LD_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function ldDay(d) { return d ? LD_WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ', ' + tm(d) : '-'; }
function ldDates(l) { return l.start ? (l.end ? ldDay(l.start) + ' to ' + ldDay(l.end) : ldDay(l.start)) : '-'; }
function ldAgo(d) { if (!d) return ''; var m = Math.floor((NOW() - d) / 6e4); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 1440) return Math.floor(m / 60) + ' h ago'; return d.getDate() + ' ' + MON[d.getMonth()]; }
function ldHoldLeft(l) { if (!l.heldUntil) return ''; var m = Math.ceil((l.heldUntil - NOW()) / 6e4); return m > 0 ? m + ' min' : ''; }
function ldTone(s) { return { waiting: 'warn', taken: 'ok', chatting: 'info', closed: 'grey' }[s] || 'grey'; }
function ldStatusLabel(s) { var t = LD_TABS.filter(function (x) { return x[0] === s; })[0]; return t ? t[1] : s; }
function ldCar(l) { return l.car ? carById(l.car) : null; }
function ldCarName(l) { var c = ldCar(l); return c ? carModel(c) + ' ' + c.plate : ''; }
function ldRules(d) { var a = (CO(d) || {}).assistant || {}; return { hours: a.hours || { from: '08:00', to: '22:00' }, turnaroundH: a.turnaroundH || 2, airportTurnaroundH: a.airportTurnaroundH || 4, holdMin: a.holdMin || 30, minNoticeH: a.minNoticeH || 3, tiers: a.deliveryTiers || [], stayOutDays: a.stayOutDays || 30 }; }
/* the delivery fee for a distance from the company's tiers, or null when it is too far (staff quote it) */
function ldTierFee(km, d) { var t = ldRules(d).tiers.slice().sort(function (a, b) { return a.upToKm - b.upToKm; }).filter(function (x) { return km <= x.upToKm; })[0]; return t ? t.fee : null; }
function ldFee(p) { return !p ? 0 : p.kind === 'office' ? 0 : p.fee; }
function ldFeeText(p) { return !p ? '-' : p.kind === 'office' ? 'Free' : p.fee != null ? UI.fmt.money(p.fee) : 'To quote'; }

/* ---------- made-up data for every company ---------- */
DATA_INIT.push(function (d, b) {
  if (d.leads) return;
  var R = rng(7300 + b.id.length * 31 + (b.name || '').length), ri = function (a, z) { return a + Math.floor(R() * (z - a + 1)); }, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var base = typeof TODAY !== 'undefined' ? TODAY : new Date(2026, 9, 19, 14, 32);
  var names = ['Nurul Aisyah', 'Daniel Lim', 'Kavitha Rajan', 'Hafiz Rahman', 'Chong Wei Jie', 'Siti Mariam', 'Arif Danial', 'Priya Menon', 'Ong Mei Ling', 'Faizal Hamid', 'Tan Jia Hui', 'Yusof Karim', 'Melissa Wong', 'Rizal Ahmad', 'Deepa Nair', 'Amir Hakim', '', ''];
  var cars = d.cars.filter(function (c) { return c.fleet === 'Active'; });
  var a = (d.company && d.company.assistant) || {}, hold = a.holdMin || 30;
  var locs = b.locations || [], places = b.places || [];
  var mk = function (k) {
    var nm = names[k % names.length], ph = '+60 00-' + ri(200, 899) + ' ' + ri(1000, 9999);
    var st = k < 4 ? 'waiting' : k < 7 ? 'taken' : k < 11 ? 'chatting' : 'closed';
    var start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + ri(1, 12), pick([9, 10, 11, 14, 15, 18]), pick([0, 0, 30]));
    var len = pick([1, 2, 2, 3, 4, 7]), end = new Date(start.getTime() + len * DAY + (R() < .2 ? 3 * 36e5 : 0));
    var noDates = st === 'chatting' && k === 10;
    var car = noDates || (st === 'chatting' && k === 9) ? null : pick(cars);
    var place = function (start) {
      if (len <= 1 || !places.length || R() < .45) { var l = locs[0] || { n: 'our office' }; return { kind: 'office', label: (start ? 'Pick-up at ' : 'Drop-off at ') + l.n, fee: 0 }; }
      if (R() < .5) { var p = pick(places); return { kind: 'place', label: (start ? 'Delivery to ' : 'Return from ') + p.name, fee: start ? p.deliveryFee : p.returnFee }; }
      var km = ri(4, 70), typed = R() < .3, fee = typed ? null : ldTierFee(km, d);
      return { kind: 'client', label: (start ? 'Delivery to ' : 'Collection from ') + (typed ? 'a typed address' : 'their pin, ' + km + ' km'), fee: fee, km: typed ? null : km };
    };
    var pk = car ? place(true) : null, dp = car ? place(false) : null;
    var rent = car ? bkCalc({ start: start, end: end, rate: car.rate, hourly: car.hourly || Math.round(car.rate / 8) }).rent : null;
    var unknown = !!(pk && pk.fee == null) || !!(dp && dp.fee == null);
    var lastAt = new Date(base.getTime() - (st === 'closed' ? ri(2, 9) * DAY : st === 'chatting' ? ri(1, 25) * 6e4 : ri(5, 300) * 6e4));
    var who = (d.users[2] || d.users[0]).name, who2 = (d.users[1] || d.users[0]).name;
    var held = car && (st === 'waiting' || st === 'chatting') && k % 2 === 0 ? new Date(base.getTime() + ri(4, hold - 2) * 6e4) : null;
    var reasons = ['Asked a question', 'Ready to book', 'Typed "staff"', 'Delivery fee to quote'];
    var qs = ['Can I pay the deposit by card when I collect?', 'Is a child seat available for this car?', 'Can I take the car to another state?', 'Do you deliver to my hotel? I sent the address.'];
    var l = { id: 'lead-' + (k + 1), name: nm, phone: ph, lastAt: lastAt, created: new Date(lastAt.getTime() - ri(10, 90) * 6e4), start: noDates ? null : start, end: noDates ? null : end, car: car ? car.id : null, heldUntil: held,
      pick: pk, drop: dp, rent: rent, deposit: car ? car.deposit || b.deposit || 200 : null, feesUnknown: unknown, total: car ? rent + ldFee(pk) + ldFee(dp) : null,
      status: st, takenBy: st === 'taken' ? (k === 5 ? who2 : who) : st === 'closed' && k % 2 ? who : '', reason: st === 'waiting' ? reasons[k % 4] : st === 'taken' ? 'Staff wrote from the app' : st === 'closed' ? pick(['No reply for 3 days', 'Booked', 'Closed by staff']) : '',
      question: st === 'waiting' && (k % 4 === 0 || k % 4 === 3) ? qs[k % 4] : '', msgs: [], booking: null };
    var t = l.created.getTime(), m = function (dir, text, gap) { t += (gap || ri(1, 4)) * 6e4; l.msgs.push({ dir: dir, text: text, at: new Date(Math.min(t, lastAt.getTime())) }); };
    m('customer', pick(['Hi, is there a car available?', 'Hello, I want to rent a car', 'Hi, how much for a car this weekend?', 'Salam, nak sewa kereta']), 0);
    m('bot', 'Hi' + (nm ? ' ' + nm.split(' ')[0] : '') + '! I am the ' + b.short + ' booking assistant. Please choose your pick-up and return date and time in the form below.');
    if (!noDates) {
      m('customer', '[Dates form] ' + ldDay(start) + ' to ' + ldDay(end));
      m('bot', 'Here are the cars free for those dates, cheapest first. Tap a car to choose it, or send it from our catalogue.');
      if (car) {
        m('customer', carModel(car));
        m('bot', 'Good choice. The ' + carModel(car) + ' is held for you for ' + hold + ' minutes. Rent for your dates: ' + UI.fmt.money(rent) + ', deposit ' + UI.fmt.money(l.deposit) + ' (refunded after the car comes back).');
        if (pk) { m('customer', pk.label); m('bot', pk.kind === 'client' && pk.fee == null ? 'Thanks. Staff will quote the delivery fee for that address.' : pk.label + ': ' + ldFeeText(pk) + '.'); }
        if (dp) { m('customer', dp.label); }
        m('bot', 'Summary: ' + carModel(car) + ', ' + ldDates(l) + '. Estimate ' + UI.fmt.money(l.total) + (unknown ? ' plus the delivery fee staff will quote' : '') + '. Anything else?');
      }
    }
    if (l.question) { m('customer', l.question); m('bot', 'Let me pass that to our staff. Someone will reply here soon.'); }
    if (st === 'waiting' && l.reason === 'Typed "staff"') m('customer', 'staff');
    if (st === 'taken') m('staff', 'Hi, this is ' + l.takenBy.split(' ')[0] + ' from ' + b.short + '. I can help you with the booking.');
    if (st === 'closed' && l.reason === 'Booked') m('staff', 'Your booking is confirmed. See you on ' + ldDay(start) + '.');
    return l;
  };
  d.leads = []; for (var k = 0; k < 16; k++) d.leads.push(mk(k));
  d.leadSettings = { on: b.id !== 'padi', number: b.id === 'padi' ? null : { phone: b.phone || '+60 00-555 0101', by: d.users[0].name, at: new Date(base.getTime() - 40 * DAY) }, learn: true, testNumbers: b.id === 'bara' ? ['+60 00-711 2020'] : [], updatedBy: d.users[0].name, updatedAt: new Date(base.getTime() - 3 * DAY) };
  var A = function (q, kw, ans, on, used, media) { return { id: 'ans-' + (d.leadAnswers.length + 1), q: q, kw: kw, a: ans, on: on, used: used || 0, media: media || [] }; };
  d.leadAnswers = [];
  [['Pay when collecting the car', 'pay later, pay when collect, pay at pickup, cash', 'You can pay the rent when you collect the car, by cash, card or transfer. The deposit is paid at the same time.'],
    ['Deposit refund', 'deposit, refund, deposit back', 'The deposit is refunded within ' + (b.refundHours || 24) + ' hours after the car comes back, once we check it.'],
    ['Documents needed', 'documents, ic, licence, license, passport', 'Please bring your IC or passport and a valid driving licence. Foreign visitors also need an international driving permit.'],
    ['Licence from abroad', 'international, idp, foreign licence', 'A licence from abroad is fine together with an international driving permit.'],
    ['Touch n Go card', 'tng, touch n go, toll card', 'Every car comes with a toll card. Please top it up yourself and return it with the car.'],
    ['Fuel', 'fuel, petrol, minyak', 'Return the car with the same fuel level as when you got it.'],
    ['Late return', 'late, extend, extension', 'Please tell us at least ' + (b.extendHours || 6) + ' hours before the return time if you want to extend. Late returns are charged by the hour.'],
    ['Child seat', 'child seat, baby seat, booster', 'Child seats are available on request at a small charge. Ask when you book.'],
    ['Taking the car to another state', 'outstation, another state, singapore, interstate', 'You may drive anywhere in Peninsular Malaysia. Taking the car across the border is not allowed.'],
    ['Delivery fee', 'delivery, send the car, hantar', 'We deliver to your place for a fee that depends on the distance. Send your location pin to get the fee.']
  ].forEach(function (x) { d.leadAnswers.push(A(x[0], x[1].split(', '), x[2], false, 0)); });
  d.leadAnswers.unshift(A('Opening hours', ['open', 'hours', 'what time', 'buka'], 'We hand over cars from ' + (a.hours ? a.hours.from : '08:00') + ' to ' + (a.hours ? a.hours.to : '22:00') + ' every day.', true, 37));
  d.leadAnswers.unshift(A('Where is your office', ['where', 'address', 'location', 'office'], 'Our pick-up point is ' + ((locs[0] || {}).n || 'our office') + '. We will send you the pin.', true, 52, [{ kind: 'image', name: 'office-front.jpg', caption: 'Our office from the road' }]));
  d.leadAnswers.forEach(function (x, k) { x.id = 'ans-' + (k + 1); });
  d.leadSuggestions = [
    { id: 'sug-1', question: 'Can I get the car earlier at 7am?', reply: 'Yes, early pick-up before 8am is possible with an extra RM 20. Let us know the time.', count: 3, at: new Date(base.getTime() - 2 * DAY) },
    { id: 'sug-2', question: 'Is there a discount for one week?', reply: 'For 7 days or more we give 10% off the rent.', count: 5, at: new Date(base.getTime() - 5 * DAY) },
    { id: 'sug-3', question: 'Can my friend drive the car too?', reply: 'Yes, add them as a second driver when you collect. Bring their licence too.', count: 2, at: new Date(base.getTime() - DAY) }
  ];
  var seen = {}; d.catalogueItems = [];
  d.cars.forEach(function (c) { var nm = carModel(c); if (!seen[nm]) { seen[nm] = 'cat-' + (d.catalogueItems.length + 1); d.catalogueItems.push({ id: seen[nm], name: carName(c) + ' (catalogue)', retailer: 'SKU-' + (1000 + d.catalogueItems.length) }); } });
  d.cars.forEach(function (c, k) { c.waItem = c.waItem !== undefined ? c.waItem : (k % 3 === 2 ? null : seen[carModel(c)]); });
});

/* a fresh made-up chat line now and then, so the 30-second refresh has something to show */
function ldTick(d) {
  var list = (d.leads || []).filter(function (l) { return l.status === 'chatting'; });
  if (!list.length || !d.leadSettings.on) return false;
  var l = list[Math.floor((NOW().getMinutes() + list.length) % list.length)];
  var lines = ['Ok thanks', 'Can I see more photos?', 'What about a bigger car?', 'Noted, let me check with my family'];
  var msgs = l.msgs.concat([{ dir: 'customer', text: lines[l.msgs.length % lines.length], at: NOW() }, { dir: 'bot', text: 'Sure! Tell me if you want to change the dates or the car. Type "staff" any time to talk to a person.', at: NOW() }]);
  DB.update('leads', l, { msgs: msgs, lastAt: NOW() }, { silent: true });
  return true;
}

/* ---------- actions on a lead ---------- */
function ldUpdate(l, patch, text) { return DB.update('leads', l, patch, { where: 'Lead', text: text }); }
function ldTake(l) { ldUpdate(l, { status: 'taken', takenBy: me().name, reason: 'Taken by staff' }, me().name + ' took the lead of ' + (l.name || l.phone)); UI.toast('It is yours. Reply to ' + (l.name || 'the customer') + ' on WhatsApp.', { tone: 'ok' }); }
function ldRelease(l) { ldUpdate(l, { heldUntil: null }, me().name + ' let go of the car held for ' + (l.name || l.phone)); UI.toast('The car is free for other customers again.'); }
function ldClose(l) {
  var prev = { status: l.status, heldUntil: l.heldUntil, reason: l.reason };
  ldUpdate(l, { status: 'closed', heldUntil: null, reason: 'Closed by staff', closedAt: NOW() }, me().name + ' closed the lead of ' + (l.name || l.phone));
  UI.toast('Lead closed.', { action: { label: 'Undo', run: function () { ldUpdate(l, prev, me().name + ' opened the lead of ' + (l.name || l.phone) + ' again'); } } });
}
function ldMakeBooking(l) {
  var opt = function (p, start) { if (!p) return null; if (p.kind === 'office') return start ? 'Pick-up from our location' : 'Drop-off at our location'; if (p.kind === 'place') return p.label; return start ? 'Delivery to client location' : 'Return from client location'; };
  var cust = (D().people || []).filter(function (p) { return normPhone(p.phone) === normPhone(l.phone); })[0];
  UI.closeAll();
  API.newBooking({ car: l.car || undefined, start: l.start ? UI.isoDateTime(l.start) : undefined, end: l.end ? UI.isoDateTime(l.end) : undefined, customer: cust ? cust.id : undefined, name: l.name, phone: l.phone, startOpt: opt(l.pick, true), endOpt: opt(l.drop, false), lead: l.id });
  DB.log('Opened', 'Lead', l.id, me().name + ' started a booking from the lead of ' + (l.name || l.phone));
}

/* ---------- the lead drawer ---------- */
function ldDrawer(id) {
  var l = byId(D().leads || [], id); if (!l) { UI.toast('That lead is no longer here.', { tone: 'warn' }); return null; }
  var mg = can('leads.manage');
  var dr = UI.drawer({ title: l.name || 'No name', width: 560, live: true,
    onClose: function () { if (CUR && CUR.ctx && S.page === 'leads') CUR.ctx.setParams({ lead: null }, true); },
    body: function (el) {
      var c = ldCar(l), hold = ldHoldLeft(l), row = function (k, v) { return '<div class="ld-row"><span>' + k + '</span><b>' + v + '</b></div>'; };
      el.innerHTML = '<div class="ld-dr">' +
        '<div class="row wrap gap6">' + UI.chip(ldStatusLabel(l.status), ldTone(l.status)) + (l.takenBy ? UI.chip('Taken by ' + l.takenBy, 'grey') : l.reason ? UI.chip(l.reason, 'grey') : '') + (hold ? UI.chip('Held ' + hold, 'warn') : '') + (l.booking ? UI.chip('Booking ' + l.booking, 'pri') : '') + '</div>' +
        '<div class="ld-who">' + UI.phone(l.phone, { wa: true }) + '<span class="b2">Last message ' + ldAgo(l.lastAt) + '</span></div>' +
        '<div class="ld-box">' + row('Dates', esc(ldDates(l))) + row('Car', c ? esc(carName(c)) + ' <span class="b2">' + esc(c.plate) + '</span>' : '<span class="faint">Not chosen yet</span>') +
        row('Pick-up', l.pick ? esc(l.pick.label) + ' <span class="b2 nw">(' + ldFeeText(l.pick) + ')</span>' : '-') + row('Return', l.drop ? esc(l.drop.label) + ' <span class="b2 nw">(' + ldFeeText(l.drop) + ')</span>' : '-') +
        (l.rent != null ? row('Rent', UI.money(l.rent)) : '') + (l.total != null ? row('Estimate given', UI.money(l.total) + (l.feesUnknown ? ' <span class="ld-q">+ delivery to quote</span>' : '')) : '') + (l.deposit != null ? row('Deposit', UI.money(l.deposit)) : '') + '</div>' +
        (l.question ? UI.alert('<b>Question:</b> ' + esc(l.question), 'warn', { html: true }) : '') +
        '<div class="ld-acts">' +
        (mg && (l.status === 'waiting' || l.status === 'chatting') ? UI.btn("I'll take it", { icon: 'hand-stop', attrs: { 'data-ld': 'take' } }) : '') +
        (mg && hold ? UI.btn('Let go of the car', { kind: 'o', icon: 'lock-open', attrs: { 'data-ld': 'release' } }) : '') +
        (can('bookings.create') && l.status !== 'closed' ? UI.btn('Make booking', { kind: 'tonal', icon: 'calendar-plus', attrs: { 'data-ld': 'book' } }) : '') +
        (mg && l.status !== 'closed' ? UI.btn('Close lead', { kind: 't', icon: 'circle-x', attrs: { 'data-ld': 'close' } }) : '') + '</div>' +
        (!mg ? '<p class="b2">' + i('lock') + ' Taking, closing or letting go of a car needs "Handle leads".</p>' : '') +
        '<div class="ld-h">Chat</div><div class="ld-chat">' + (l.msgs.length ? l.msgs.map(function (m) { return '<div class="ld-msg ' + m.dir + '"><div class="ld-bub">' + esc(m.text) + '</div><small>' + (m.dir === 'bot' ? 'Assistant' : m.dir === 'staff' ? 'Staff' : 'Customer') + ' · ' + tm(m.at) + ', ' + m.at.getDate() + ' ' + MON[m.at.getMonth()] + '</small></div>'; }).join('') : '<p class="b2 faint">No messages.</p>') + '</div>' +
        '<a class="btn o sm ld-wa" href="https://wa.me/' + String(l.phone).replace(/\D/g, '') + '" target="_blank" rel="noopener">' + i('brand-whatsapp') + 'Reply on WhatsApp</a></div>';
      var ch = el.querySelector('.ld-chat'); if (ch) ch.scrollTop = ch.scrollHeight;
    } });
  dr.el.addEventListener('click', function (ev) {
    var x = ev.target.closest('[data-ld]'); if (!x) return;
    var a = x.getAttribute('data-ld');
    if (a === 'take') ldTake(l); else if (a === 'release') ldRelease(l); else if (a === 'close') ldClose(l); else if (a === 'book') ldMakeBooking(l);
  });
  return dr;
}
API.openLead = function (id) { if (S.page !== 'leads') go('leads', { lead: id }); else ldDrawer(id); };

/* ---------- the customer number (simulated embedded sign-up) ---------- */
function ldLinkNumber(onDone) {
  var d = D(), step = 0, num = '', steps = ['Sign in to the WhatsApp business account', 'Choose the business', 'Choose the number', 'Linked'];
  var dl = UI.dialog({ title: 'Connect the customer number', width: 'sm', body: function (el) {
    el.innerHTML = '<div class="ld-su"><ol class="ld-steps">' + steps.map(function (s, k) { return '<li class="' + (k < step ? 'done' : k === step ? 'on' : '') + '">' + i(k < step ? 'circle-check' : 'circle') + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ol>' +
      (step === 0 ? '<p class="b2">A window from WhatsApp asks you to sign in with the account that owns the business number. In this sample it is played out for you.</p>' + UI.btn('Sign in', { icon: 'brand-facebook', attrs: { 'data-su': 'next' } }) :
        step === 1 ? '<p class="b2">Choose the business that owns the number.</p><div class="col gap8">' + UI.btn(B().legal || B().name, { kind: 'o', attrs: { 'data-su': 'next' } }) + '</div>' :
          step === 2 ? '<p class="b2">Choose the customer number. Staff keep using the WhatsApp Business app on the same number.</p>' + UI.input({ key: 'num', label: 'Customer number', value: B().phone || '+60 00-555 0101' }) + '<div class="mt8">' + UI.btn('Link this number', { icon: 'link', attrs: { 'data-su': 'link' } }) + '</div>' :
            UI.alert('The customer number is linked. The assistant is still off until you switch it on.', 'ok')) + '</div>';
  }, buttons: [{ label: 'Close', kind: 'o' }] });
  dl.el.addEventListener('click', function (ev) {
    var x = ev.target.closest('[data-su]'); if (!x) return;
    if (x.getAttribute('data-su') === 'link') { num = (dl.body.querySelector('[data-key="num"]').value || '').trim(); if (normPhone(num).length < 8) { UI.toast('Type the full number.', { tone: 'warn' }); return; } }
    x.disabled = true; x.textContent = 'Please wait...';
    setTimeout(function () {
      if (dl.closed) return; step++;
      if (step === 3) { var s = d.leadSettings; s.number = { phone: num, by: me().name, at: NOW() }; s.on = false; s.updatedBy = me().name; s.updatedAt = NOW(); DB.log('Changed', 'Lead', '', me().name + ' linked the customer number ' + num + ' to the booking assistant'); emit('data', { coll: 'leadSettings', op: 'update', rec: s }); onDone && onDone(); }
      dl.refresh();
    }, 700);
  });
}

/* ---------- Answers ---------- */
function ldAnswers() {
  var d = D(), edit = null, q = '';
  var dl = UI.dialog({ title: 'Assistant answers', width: 'lg', body: function (el) {
    var list = d.leadAnswers.filter(function (x) { return !q || UI.wordsMatch(x.q + ' ' + x.kw.join(' ') + ' ' + x.a, q); });
    if (edit) {
      var x = edit;
      el.innerHTML = '<div class="col gap12">' + UI.input({ key: 'q', label: 'Question', value: x.q, placeholder: 'Pay when collecting the car', required: true }) +
        UI.input({ key: 'kw', label: 'Keywords', value: x.kw.join(', '), required: true, help: 'Words or short phrases customers use, separated by commas. Any one of them is enough. Whole words only: "tng" does not match "tngo".' }) +
        UI.textarea({ key: 'a', label: 'Answer', value: x.a, rows: 4, help: 'Sent to the customer exactly as written. *bold* works like in WhatsApp.' }) +
        UI.switch({ key: 'on', label: 'Switched on', checked: x.on }) +
        '<div class="ld-h">Pictures and videos</div><div class="ld-media">' + (x.media.length ? x.media.map(function (m, k) { return '<div class="ld-mi">' + (m.dataUrl ? '<img src="' + m.dataUrl + '" alt="">' : '<span class="ld-mph">' + i(m.kind === 'video' ? 'movie' : 'photo') + '</span>') + '<div class="grow"><b class="ellip">' + esc(m.name) + '</b><input class="ld-cap" data-cap="' + k + '" placeholder="Caption (optional)" value="' + esc(m.caption || '') + '" aria-label="Caption"></div>' + UI.iconBtn('trash', 'Remove', { size: 'sm', attrs: { 'data-am': 'rmm', 'data-v': k } }) + '</div>'; }).join('') : '<p class="b2 faint">None yet.</p>') + '</div>' +
        '<label class="btn o sm">' + i('upload') + 'Add a picture or video<input type="file" accept="image/jpeg,image/png,video/mp4" data-am-file hidden></label><p class="b2">WhatsApp takes JPG or PNG pictures and MP4 videos only.</p><p class="ui-err ld-err" hidden></p></div>';
      return;
    }
    el.innerHTML = '<p class="b2">A typed question that matches the keywords of an answer gets that answer, then its pictures and videos. Other questions go to staff. The ten starter answers come switched off until you check them.</p>' +
      '<div class="row wrap gap8 mb16"><div class="inp srch grow">' + i('search') + '<input type="search" data-am-q placeholder="Search answers" value="' + esc(q) + '" aria-label="Search answers"></div>' + UI.btn('New answer', { icon: 'plus', size: 'sm', attrs: { 'data-am': 'new' } }) + '</div>' +
      (list.length ? '<div class="ld-alist">' + list.map(function (x) { return '<div class="ld-ans"><label class="sw" title="' + (x.on ? 'Switch off' : 'Switch on') + '"><input type="checkbox" data-am-on="' + x.id + '"' + (x.on ? ' checked' : '') + ' aria-label="' + esc(x.q) + ' switched on"><span></span></label><button type="button" class="grow ld-ansb" data-am="edit" data-v="' + x.id + '"><b>' + esc(x.q) + '</b><span class="b2 ellip">' + esc(x.kw.join(', ')) + '</span><small class="b2">Used ' + plural(x.used, 'time') + (x.media.length ? ' · ' + plural(x.media.length, 'picture') : '') + '</small></button>' + UI.iconBtn('trash', 'Delete', { size: 'sm', attrs: { 'data-am': 'del', 'data-v': x.id } }) + '</div>'; }).join('') + '</div>' : UI.empty({ icon: 'message-question', title: 'No answers match', text: 'Try another word.' }));
  }, buttons: [{ label: 'Close', kind: 'o' }] });
  var foot = function () { dl.setFoot(edit ? [{ label: 'Back', kind: 'o', close: false, onClick: function () { edit = null; foot(); dl.refresh(); } }, { label: 'Save answer', icon: 'check', close: false, onClick: save }] : [{ label: 'Close', kind: 'o' }]); };
  var read = function () { var f = UI.form(dl.body); edit.q = f.q; edit.kw = String(f.kw || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); edit.a = f.a; edit.on = !!f.on; dl.body.querySelectorAll('[data-cap]').forEach(function (c) { edit.media[+c.getAttribute('data-cap')].caption = c.value; }); };
  function save() {
    read(); var er = dl.body.querySelector('.ld-err'), msg = !edit.q.trim() ? 'Give the question a name.' : !edit.kw.length ? 'Write at least one word customers use when they ask this.' : !edit.a.trim() ? 'Write the answer.' : '';
    if (msg) { er.textContent = msg; er.hidden = false; return; }
    var rec = { q: edit.q.trim(), kw: edit.kw, a: edit.a.trim(), on: edit.on, media: edit.media };
    if (edit.id) { DB.update('leadAnswers', edit.id, rec, { where: 'Lead', text: me().name + ' changed the assistant answer "' + rec.q + '"' }); }
    else DB.add('leadAnswers', Object.assign(rec, { id: 'ans-' + Date.now().toString(36), used: 0 }), { first: true, where: 'Lead', text: me().name + ' added the assistant answer "' + rec.q + '"' });
    UI.toast('Answer saved'); edit = null; foot(); dl.refresh();
  }
  dl.el.addEventListener('input', function (ev) { if (ev.target.matches('[data-am-q]')) { q = ev.target.value; var pos = ev.target.selectionStart; dl.refresh(); var f = dl.body.querySelector('[data-am-q]'); f.focus(); try { f.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } });
  dl.el.addEventListener('change', function (ev) {
    var t = ev.target, id;
    if ((id = t.getAttribute('data-am-on'))) { var x = byId(d.leadAnswers, id); DB.update('leadAnswers', x, { on: t.checked }, { where: 'Lead', text: me().name + (t.checked ? ' switched on' : ' switched off') + ' the assistant answer "' + x.q + '"' }); UI.toast(t.checked ? 'Switched on. The assistant uses it now.' : 'Switched off.'); }
    if (t.hasAttribute('data-am-file')) {
      var fl = t.files[0]; if (!fl) return;
      if (!/^(image\/(jpeg|png)|video\/mp4)$/.test(fl.type)) { UI.toast('WhatsApp takes JPG or PNG pictures and MP4 videos only.', { tone: 'warn' }); return; }
      read();
      if (/^video/.test(fl.type)) { edit.media.push({ kind: 'video', name: fl.name, caption: '' }); dl.refresh(); UI.toast('Video added. Save to keep it.'); return; }
      UI.readImage(fl, { max: 900 }).then(function (r) { edit.media.push({ kind: 'image', name: r.name, caption: '', dataUrl: r.dataUrl }); dl.refresh(); UI.toast('Picture added. Save to keep it.'); });
    }
  });
  dl.el.addEventListener('click', function (ev) {
    var x = ev.target.closest('[data-am]'); if (!x) return;
    var a = x.getAttribute('data-am'), v = x.getAttribute('data-v');
    if (a === 'new') { edit = { q: '', kw: [], a: '', on: true, media: [] }; foot(); dl.refresh(); }
    else if (a === 'edit') { var src = byId(d.leadAnswers, v); edit = { id: src.id, q: src.q, kw: src.kw.slice(), a: src.a, on: src.on, media: src.media.map(function (m) { return Object.assign({}, m); }) }; foot(); dl.refresh(); }
    else if (a === 'rmm') { read(); edit.media.splice(+v, 1); dl.refresh(); }
    else if (a === 'del') { var it = byId(d.leadAnswers, v); UI.confirm({ title: 'Delete the answer "' + it.q + '"?', text: 'The assistant stops using it. This cannot be undone.', ok: 'Delete', danger: true }).then(function (y) { if (!y) return; DB.remove('leadAnswers', it, { where: 'Lead', text: me().name + ' deleted the assistant answer "' + it.q + '"' }); UI.toast('Answer deleted'); dl.refresh(); }); }
  });
  return dl;
}

/* ---------- Learned from staff ---------- */
function ldSuggestions(onChange) {
  var d = D();
  var guess = function (q) { return q.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(function (w) { return w.length > 3 && ['what', 'there', 'with', 'your', 'have', 'does', 'this', 'that', 'from'].indexOf(w) < 0; }).slice(0, 3).join(', '); };
  var dl = UI.dialog({ title: 'Learned from staff', width: 'lg', body: function (el) {
    var list = d.leadSuggestions;
    el.innerHTML = list.length ? '<p class="b2">Questions customers asked and how staff answered them in WhatsApp. Use one to make it an answer (change it as you like), or dismiss it. The assistant never sends a suggestion by itself.</p>' + list.map(function (s) {
      return '<div class="ld-sug" data-sid="' + s.id + '"><div class="ld-sq"><b>Customer:</b> ' + esc(s.question) + '</div><div class="ld-sq"><b>Staff:</b> ' + esc(s.reply) + '</div><div class="b2">Asked ' + plural(s.count, 'time') + ' · last ' + ldAgo(s.at) + '</div>' +
        '<div class="grid g2 mt8">' + UI.input({ key: 'q-' + s.id, label: 'Question', value: s.question.replace(/\?$/, '') }) + UI.input({ key: 'kw-' + s.id, label: 'Keywords', value: guess(s.question), help: 'Words customers use, separated by commas. Add the ones the assistant did not guess.' }) + UI.textarea({ key: 'a-' + s.id, label: 'Answer', value: s.reply, rows: 2, full: true }) + '</div>' +
        UI.switch({ key: 'on-' + s.id, label: 'Switch it on now', checked: true }) + '<div class="row gap8 mt8">' + UI.btn('Use', { icon: 'check', size: 'sm', attrs: { 'data-sg': 'use', 'data-v': s.id } }) + UI.btn('Dismiss', { kind: 'o', size: 'sm', attrs: { 'data-sg': 'dis', 'data-v': s.id } }) + '</div></div>';
    }).join('') : UI.empty({ icon: 'school', title: 'Nothing new', text: 'Suggestions appear as staff answer customers in WhatsApp.' });
  }, buttons: [{ label: 'Close', kind: 'o' }] });
  dl.el.addEventListener('click', function (ev) {
    var x = ev.target.closest('[data-sg]'); if (!x) return;
    var s = byId(d.leadSuggestions, x.getAttribute('data-v')), f = UI.form(dl.body);
    if (x.getAttribute('data-sg') === 'use') {
      var kw = String(f['kw-' + s.id] || '').split(',').map(function (w) { return w.trim(); }).filter(Boolean), on = !!f['on-' + s.id];
      if (!String(f['q-' + s.id]).trim() || !kw.length || !String(f['a-' + s.id]).trim()) { UI.toast('Fill in the question, at least one keyword and the answer.', { tone: 'warn' }); return; }
      DB.add('leadAnswers', { id: 'ans-' + Date.now().toString(36), q: f['q-' + s.id].trim(), kw: kw, a: f['a-' + s.id].trim(), on: on, used: 0, media: [] }, { first: true, where: 'Lead', text: me().name + ' added an assistant answer from a staff chat' });
      UI.toast(on ? 'Answer added and switched on' : 'Answer added, switched off');
    } else UI.toast('Dismissed.');
    d.leadSuggestions.splice(d.leadSuggestions.indexOf(s), 1); emit('data', { coll: 'leadSuggestions', op: 'remove', rec: s });
    dl.refresh(); onChange && onChange();
  });
  return dl;
}

/* ---------- Catalogue links ---------- */
function ldCatalogue() {
  var d = D();
  var suggest = function (c) { var m = carName(c).toLowerCase(); return d.catalogueItems.filter(function (it) { return it.name.toLowerCase().indexOf(m) === 0; })[0] || null; };
  var dl = UI.dialog({ title: 'Catalogue links', width: 'lg', body: function (el) {
    var cars = d.cars.filter(function (c) { return c.fleet !== 'Sold'; }), unl = cars.filter(function (c) { return !c.waItem && suggest(c); });
    el.innerHTML = '<p class="b2">Link each car to its item in the WhatsApp catalogue, so customers see its photos and can send it from the catalogue to choose it.</p>' +
      (unl.length ? '<div class="row wrap gap8 mb16">' + UI.alert(plural(unl.length, 'car') + ' not linked yet have a suggested item.', 'pri') + UI.btn('Link all suggested', { icon: 'link', size: 'sm', attrs: { 'data-cat': 'all' } }) + '</div>' : '') +
      '<div class="ld-cat">' + cars.map(function (c) {
        var sug = !c.waItem ? suggest(c) : null;
        return '<div class="ld-catr"><div class="grow"><b>' + esc(c.plate) + '</b> <span class="b2">' + esc(carName(c)) + '</span></div><div class="inp ld-cats"><select data-cat-car="' + c.id + '" aria-label="Catalogue item for ' + esc(c.plate) + '"><option value="">Not linked</option>' + d.catalogueItems.map(function (it) { return '<option value="' + it.id + '"' + (c.waItem === it.id ? ' selected' : '') + '>' + esc(it.name) + (sug && sug.id === it.id ? ' (suggested)' : '') + '</option>'; }).join('') + '</select></div>' + (c.waItem ? UI.chip('Linked', 'ok') : sug ? UI.chip('Suggested', 'info') : UI.chip('Not linked', 'grey')) + '</div>';
      }).join('') + '</div>';
  }, buttons: [{ label: 'Close', kind: 'o' }] });
  dl.el.addEventListener('change', function (ev) { var id = ev.target.getAttribute('data-cat-car'); if (!id) return; var c = carById(id); c.waItem = ev.target.value || null; DB.log('Changed', 'Lead', id, me().name + (c.waItem ? ' linked ' : ' unlinked ') + c.plate + ' in the WhatsApp catalogue'); UI.toast(c.waItem ? c.plate + ' linked.' : c.plate + ' unlinked.'); dl.refresh(); });
  dl.el.addEventListener('click', function (ev) { if (!ev.target.closest('[data-cat="all"]')) return; var n = 0; d.cars.forEach(function (c) { if (c.fleet !== 'Sold' && !c.waItem) { var s = suggest(c); if (s) { c.waItem = s.id; n++; } } }); DB.log('Changed', 'Lead', '', me().name + ' linked ' + plural(n, 'car') + ' to the WhatsApp catalogue'); UI.toast(plural(n, 'car') + ' linked.'); dl.refresh(); });
  return dl;
}

/* ---------- the page ---------- */
PAGES['leads'] = {
  title: 'Booking assistant',
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data, p = ctx.params, set = d.leadSettings, canSet = ctx.can('leads.settings');
    if (p.tab && LD_TABS.some(function (t) { return t[0] === p.tab; })) st.tab = p.tab; st.tab = st.tab || 'waiting'; st.q = st.q || '';
    var nSug = (d.leadSuggestions || []).length;
    root.innerHTML = '<div class="pg-h"><div><h1>Booking assistant</h1><p>Customers the WhatsApp assistant talked to: their dates, the car it holds for them, the estimate and the chat.</p></div><div class="acts">' +
      (canSet ? UI.btn('Answers', { kind: 'o', size: 'sm', icon: 'message-question', attrs: { 'data-lp': 'answers' } }) + '<button type="button" class="btn o sm" data-lp="learned">' + i('school') + 'Learned from staff' + (nSug ? ' <span class="chip warn">' + nSug + '</span>' : '') + '</button>' + UI.btn('Catalogue links', { kind: 'o', size: 'sm', icon: 'link', attrs: { 'data-lp': 'catalogue' } }) : '') + '</div></div>' +
      '<div class="card ld-set" id="ld-set"></div><div class="card ld-list"><div id="ld-tabs"></div><div class="ld-tools"><div class="inp srch">' + i('search') + '<input type="search" data-ld-q placeholder="Search name, phone or car" aria-label="Search leads" value="' + esc(st.q) + '"></div><span class="b2 ld-upd"></span></div><div id="ld-t"></div></div>';
    function drawSet() {
      var num = set.number, dt = root.querySelector('.ld-more'); if (dt) st.moreOpen = dt.open;
      root.querySelector('#ld-set').innerHTML = '<div class="card-b col gap12"><div class="row wrap gap12"><label class="ui-swrow ld-sw"><span class="sw"><input type="checkbox" data-ls="on"' + (set.on ? ' checked' : '') + (canSet && num ? '' : ' disabled') + ' aria-label="Booking assistant on"><span></span></span><span class="h5">' + (set.on ? 'The assistant is on' : 'The assistant is off') + '</span></label>' + UI.chip(num ? 'WhatsApp number connected' : 'WhatsApp number not connected yet', num ? 'ok' : 'warn') + '</div>' +
        '<p class="b2">' + (set.on ? 'New customers get dates, free cars and prices from the assistant. Known customers and anything it cannot answer go to staff.' : 'The assistant sends nothing. Every chat is for staff, as before, and still shows here.') + (set.on && set.testNumbers.length ? ' It only answers the test numbers for now: ' + esc(set.testNumbers.join(', ')) + '.' : '') + (!num ? ' The switch works once the number is connected.' : '') + '</p>' +
        '<div class="ld-num">' + (num ? '<span class="b2">' + i('brand-whatsapp') + ' Customer number <b class="t1c">' + esc(num.phone) + '</b> is linked by ' + esc(num.by) + ' (' + UI.fmt.date(num.at) + ').</span>' + (canSet ? UI.btn('Unlink', { kind: 't', size: 'sm', attrs: { 'data-ls': 'unlink' } }) : '') : (canSet ? UI.btn('Connect the customer number', { icon: 'link', size: 'sm', attrs: { 'data-ls': 'link' } }) : '<span class="b2">Ask someone who can set up the assistant to connect the number.</span>')) + '</div>' +
        (set.updatedBy ? '<p class="b2">Last changed by ' + esc(set.updatedBy) + ' ' + ldAgo(set.updatedAt).replace(/^(\d+ \w+)$/, 'on $1') + '</p>' : '') +
        '<details class="ld-more"' + (st.moreOpen ? ' open' : '') + '><summary>' + i('chevron-right') + '<span>Test numbers and learning</span><span class="b2">' + (set.testNumbers.length ? plural(set.testNumbers.length, 'test number') : 'No test numbers') + ' · learning ' + (set.learn ? 'on' : 'off') + '</span></summary><div class="ld-morein">' +
        '<div class="ld-test"><span class="b2">Test numbers (only these get answers while any are set):</span><div class="row wrap gap6">' + (set.testNumbers.length ? set.testNumbers.map(function (n, k) { return '<span class="chip grey">' + esc(n) + (canSet ? '<button type="button" class="ld-x" data-ls="rmtest" data-v="' + k + '" aria-label="Remove ' + esc(n) + '">' + i('x') + '</button>' : '') + '</span>'; }).join('') : '<span class="b2 faint">None: everyone gets answers.</span>') + '</div>' +
        (canSet ? '<div class="row gap8 ld-addt"><div class="inp"><input data-ls-test placeholder="+60 00-000 0000" aria-label="Add a test number"></div>' + UI.btn('Add', { kind: 'o', size: 'sm', attrs: { 'data-ls': 'addtest' } }) + '</div>' : '') + '</div>' +
        UI.switch({ key: 'learn', label: 'Learn from staff chats: offer the questions staff answer as new answers (staff approve each one)', checked: set.learn, disabled: !canSet, attrs: { 'data-ls': 'learn' } }) + '</div></details></div>';
    }
    var saveSet = function (patch, text) { Object.assign(set, patch, { updatedBy: me().name, updatedAt: NOW() }); DB.log('Changed', 'Lead', '', text); drawSet(); };
    UI.on(root, 'change', '[data-ls="on"]', function (ev, el) { saveSet({ on: el.checked }, me().name + (el.checked ? ' switched on' : ' switched off') + ' the booking assistant'); UI.toast(el.checked ? 'Booking assistant switched on' : 'Booking assistant switched off'); });
    UI.on(root, 'change', '[data-ls="learn"]', function (ev, el) { saveSet({ learn: el.checked }, me().name + (el.checked ? ' switched on' : ' switched off') + ' learning from staff chats'); UI.toast(el.checked ? 'Learning from staff chats is on.' : 'Learning from staff chats is off.'); });
    UI.on(root, 'click', '[data-ls]', function (ev, el) {
      var a = el.getAttribute('data-ls');
      if (a === 'link') ldLinkNumber(drawSet);
      else if (a === 'unlink') UI.confirm({ title: 'Unlink the customer number?', text: 'The assistant stops answering and switches off. Nothing changes in WhatsApp; the Business app keeps working.', ok: 'Unlink', danger: true }).then(function (y) { if (!y) return; saveSet({ number: null, on: false }, me().name + ' unlinked the customer number from the booking assistant'); UI.toast('Unlinked. Nothing changed in WhatsApp; the Business app keeps working.'); });
      else if (a === 'addtest') { var f = root.querySelector('[data-ls-test]'), v = f.value.trim(); if (normPhone(v).length < 8) { UI.toast('Type a full phone number.', { tone: 'warn' }); f.focus(); return; } if (set.testNumbers.some(function (n) { return normPhone(n) === normPhone(v); })) { UI.toast('That number is already on the list.', { tone: 'warn' }); return; } saveSet({ testNumbers: set.testNumbers.concat([v]) }, me().name + ' added the test number ' + v); UI.toast('Test number added.'); }
      else if (a === 'rmtest') { var k = +el.getAttribute('data-v'), n = set.testNumbers[k]; saveSet({ testNumbers: set.testNumbers.filter(function (_, j) { return j !== k; }) }, me().name + ' removed the test number ' + n); UI.toast('Removed.'); }
    });
    UI.on(root, 'keydown', '[data-ls-test]', function (ev) { if (ev.key === 'Enter') root.querySelector('[data-ls="addtest"]').click(); });
    var counts = function () { var c = {}; LD_TABS.forEach(function (t) { c[t[0]] = 0; }); d.leads.forEach(function (l) { c[l.status]++; }); return c; };
    function drawTabs() { var c = counts(); UI.tabs(root.querySelector('#ld-tabs'), { items: LD_TABS.map(function (t) { return { id: t[0], label: t[1], count: c[t[0]], tone: t[0] === 'waiting' && c.waiting ? 'warn' : 'grey' }; }), value: st.tab, onChange: function (id) { st.tab = id; ctx.setParams({ tab: id }, true); tbl.setRows(rows()); } }); }
    function rows() {
      var q = tidySearch(st.q || '').toLowerCase();
      return d.leads.filter(function (l) { if (l.status !== st.tab) return false; if (!q) return true; var c = ldCar(l); return UI.wordsMatch((l.name || '') + ' ' + (c ? c.plate + ' ' + normPlate(c.plate) + ' ' + carName(c) : ''), q) || phoneHas(l.phone, q); }).sort(function (a, b) { return b.lastAt - a.lastAt; });
    }
    var cust = function (l) { return '<b class="t1c">' + esc(l.name || 'No name') + '</b><div class="b2 nw">' + esc(l.phone) + ' · ' + ldAgo(l.lastAt) + '</div>'; };
    var carCell = function (l) { var h = ldHoldLeft(l); return (l.car ? '<span>' + esc(ldCarName(l)) + '</span>' : '<span class="faint">-</span>') + (h ? '<div>' + UI.chip('Held ' + h, 'warn') + '</div>' : ''); };
    var placeCell = function (l) { return l.pick ? '<div class="b2 t1c">' + esc(l.pick.label) + '</div><div class="b2">' + esc(l.drop ? l.drop.label : '') + '</div>' : '<span class="faint">-</span>'; };
    var est = function (l) { return (l.total != null ? UI.money(l.total) : '<span class="faint">-</span>') + (l.feesUnknown ? '<div class="ld-q">+ delivery to quote</div>' : ''); };
    var stat = function (l) { return UI.chip(ldStatusLabel(l.status), ldTone(l.status)) + '<div class="b2">' + esc(l.takenBy || l.reason || '') + '</div>'; };
    var tbl = UI.table(root.querySelector('#ld-t'), {
      columns: [{ key: 'name', label: 'Customer', render: cust }, { key: 'start', label: 'Dates', render: function (l) { return '<span class="b2 ld-dates">' + esc(ldDates(l)) + '</span>'; } }, { key: 'car', label: 'Car', render: carCell },
        { key: 'pick', label: 'Pick-up and return', render: placeCell }, { key: 'total', label: 'Estimate', money: true, render: est }, { key: 'status', label: 'Status', render: stat }],
      rows: rows(), rowKey: 'id', density: 'compact', pageSize: 25, pageSizes: [10, 25, 50], minWidth: 980,
      onRowClick: function (l) { ctx.setParams({ lead: l.id }, true); ldDrawer(l.id); },
      card: function (l) { return '<div class="ld-card"><div class="row gap8"><div class="grow">' + cust(l) + '</div>' + UI.chip(ldStatusLabel(l.status), ldTone(l.status)) + '</div><div class="b2">' + esc(ldDates(l)) + '</div><div class="row wrap gap8">' + carCell(l) + '<span class="grow"></span><span class="ld-est">' + est(l) + '</span></div>' + (l.pick ? '<div class="b2">' + esc(l.pick.label) + (l.drop ? ', ' + esc(l.drop.label) : '') + '</div>' : '') + (l.takenBy || l.reason ? '<div class="b2 faint">' + esc(l.takenBy ? 'Taken by ' + l.takenBy : l.reason) + '</div>' : '') + '</div>'; },
      empty: { icon: 'brand-whatsapp', title: 'No leads here yet', text: st.q ? 'Try another name, phone or car.' : 'New chats show up here by themselves.' }
    });
    var updEl = root.querySelector('.ld-upd'), stamp = function () { updEl.textContent = 'Updated ' + tm(NOW()) + ', refreshes every 30 seconds'; };
    drawSet(); drawTabs(); stamp();
    var tq; UI.on(root, 'input', '[data-ld-q]', function (ev, el) { clearTimeout(tq); tq = setTimeout(function () { st.q = el.value; tbl.setRows(rows()); }, 120); });
    UI.on(root, 'click', '[data-lp]', function (ev, el) { var a = el.getAttribute('data-lp'); if (a === 'answers') ldAnswers(); else if (a === 'learned') ldSuggestions(function () { ctx.refresh(); }); else ldCatalogue(); });
    ctx.on('data', function (pl) { if (!document.contains(root) || !pl) return; if (pl.coll === 'leads' || pl.coll === 'leadSettings') { drawTabs(); tbl.setRows(rows(), true); if (pl.coll === 'leadSettings') drawSet(); } });
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(function () { if (!document.contains(root)) { clearInterval(st.timer); st.timer = null; return; } if (D() !== d) return; var n = st.ticks = (st.ticks || 0) + 1; if (n % 2 === 0 && !UI.top()) ldTick(d); drawTabs(); tbl.setRows(rows(), true); stamp(); }, 30000);
    if (p.lead && !UI.top()) setTimeout(function () { ldDrawer(p.lead); }, 0);
    if (p.dlg && !UI.top()) setTimeout(function () { if (!canSet) return; if (p.dlg === 'answers') ldAnswers(); else if (p.dlg === 'learned') ldSuggestions(); else if (p.dlg === 'catalogue') ldCatalogue(); }, 0);
  },
  onData: function () { /* handled with ctx.on('data') */ },
  search: [{ label: 'Leads waiting for staff', icon: 'brand-whatsapp', run: function () { go('leads', { tab: 'waiting' }); } }, { label: 'Assistant answers', icon: 'message-question', run: function () { go('leads', { dlg: 'answers' }); } }]
};

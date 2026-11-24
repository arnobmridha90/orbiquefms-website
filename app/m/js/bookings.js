/* ---------------- BOOKINGS ---------------- */
var bkSearch = '';
VIEWS.bookings = function (r) {
  var f = r.a || 'upcoming', now = new Date(), q = bkSearch.toLowerCase();
  var tests = {
    upcoming: function (b) { return b.status === 'Confirmed'; },
    road: function (b) { return b.status === 'Picked up'; },
    unpaid: function (b) { return b.status !== 'Cancelled' && priceOf(b).balance > 0; },
    done: function (b) { return b.status === 'Returned'; },
    cancelled: function (b) { return b.status === 'Cancelled'; },
    all: function () { return true; }
  };
  var labels = [['upcoming', 'Upcoming'], ['road', 'On road'], ['unpaid', 'Balance due'], ['done', 'Returned'], ['all', 'All'], ['cancelled', 'Cancelled']];
  var list = S.bookings.filter(tests[f] || tests.all).filter(function (b) {
    if (!q) return true; var c = cust(b.cust), k = car(b.car);
    return (b.code + ' ' + c.name + ' ' + c.phone.replace(/\D/g, '') + ' ' + k.plate + ' ' + k.model).toLowerCase().indexOf(q.replace(/^\+/, '')) >= 0;
  });
  list.sort(function (a, b) { return f === 'done' || f === 'all' || f === 'cancelled' ? new Date(b.start) - new Date(a.start) : new Date(a.start) - new Date(b.start); });
  var html = topbar('Bookings', { sub: S.bookings.filter(tests.upcoming).length + ' upcoming · ' + S.bookings.filter(tests.road).length + ' on the road' }) + '<main>' +
    '<label class="search">' + I('search') + '<input id="bkq" type="search" placeholder="Name, phone, plate or booking no." value="' + esc(bkSearch) + '" autocomplete="off"></label>' +
    '<div class="filters">' + labels.map(function (l) { return '<a class="fchip ' + (f === l[0] ? 'on' : '') + '" href="#bookings/' + l[0] + '">' + l[1] + ' <span class="n">' + S.bookings.filter(tests[l[0]]).length + '</span></a>'; }).join('') + '</div>' +
    '<div id="bklist" style="margin-top:10px">' + bkList(list, f) + '</div></main>';
  return { html: html, after: function () {
    var i = $('#bkq'); i.oninput = function () { bkSearch = i.value; var y = window.scrollY; render(); var j = $('#bkq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); window.scrollTo(0, y); };
  } };
};
function bkList(list, f) {
  if (!list.length) return '<div class="empty">No bookings here' + (bkSearch ? ' for “' + esc(bkSearch) + '”' : '') + '.</div>';
  var out = '', last = '';
  list.forEach(function (b) {
    var d = dayWord(b.start); if (f === 'upcoming' && d !== last) { out += '<div class="sec" style="margin-top:' + (last ? 14 : 4) + 'px"><h2>' + d + '</h2></div>'; last = d; }
    out += bkCard(b);
  });
  return out;
}
function bkCard(b) {
  var c = car(b.car), cu = cust(b.cust), p = priceOf(b);
  var bal = b.status === 'Cancelled' ? '' : p.balance > 0 ? '<span class="bal due num">' + rm(p.balance) + ' due</span>' : '<span class="bal paid">Paid</span>';
  return '<a class="bk" href="#booking/' + b.id + '"><div class="l1"><span class="who">' + esc(cu.name) + '</span>' + (cu.flag ? flagChip(cu.flag) : '') + statusChip(b) + '</div>' +
    '<div class="l2"><span class="car">' + carSVG(c.color, c.shape) + '</span><span class="when"><b>' + esc(c.plate) + '</b> · ' + dShort(b.start) + ' ' + hm(b.start) + ' → ' + dShort(b.end) + '</span>' + bal + '</div></a>';
}
function flagChip(f) { return '<span class="chip ' + (f === 'VIP' ? 'dark' : f === 'Blacklisted' ? 'bad' : 'warn') + '">' + f + '</span>'; }

/* ---------------- BOOKING DETAIL ---------------- */
VIEWS.booking = function (r) {
  var b = bk(r.a); if (!b) return { html: topbar('Booking', { back: '#bookings' }) + '<main><div class="empty">This booking is not here any more.</div></main>' };
  var c = car(b.car), cu = cust(b.cust), p = priceOf(b), wa = 'https://wa.me/' + cu.phone.replace(/\D/g, '');
  var step = b.status === 'Confirmed' ? '<button class="btn" onclick="handover(\'' + b.id + '\')">' + I('key') + 'Hand over the car</button>' :
    b.status === 'Picked up' ? '<button class="btn" onclick="takeBack(\'' + b.id + '\')">' + I('in') + 'Take the car back</button>' : '';
  var html = topbar(b.code, { back: '#bookings', sub: 'Made ' + ago(b.created) + (b.source !== 'Staff' ? ' on ' + b.source : ' by ' + b.createdBy) }) + '<main>' +
    '<div class="hero"><div style="display:flex;align-items:center;gap:8px">' + statusChip(b) + (cu.flag ? flagChip(cu.flag) : '') + '<span class="chip">' + p.days + ' day' + (p.days > 1 ? 's' : '') + '</span></div>' +
    '<div class="carpic">' + carSVG(c.color, c.shape) + '</div>' +
    '<h3>' + esc(cu.name) + '</h3><div class="muted small"><span class="nowrap">' + esc(cu.phone) + '</span> · ' + esc(c.make + ' ' + c.model) + ' · <b style="color:var(--text)">' + esc(c.plate) + '</b></div>' +
    '<div class="kv"><div><div class="k">Pick-up</div><div class="v">' + when(b.start) + '<small>' + esc(b.pickPlace) + '</small></div></div><div><div class="k">Return</div><div class="v">' + when(b.end) + '<small>' + esc(b.retPlace) + '</small></div></div></div></div>' +
    '<div class="actions"><a class="act" href="tel:' + cu.phone.replace(/[^\d+]/g, '') + '">' + I('phone') + 'Call</a><a class="act" href="' + wa + '" target="_blank" rel="noopener">' + I('wa') + 'WhatsApp</a>' +
    '<button class="act" onclick="payment(\'' + b.id + '\')">' + I('cash') + 'Payment</button><button class="act" onclick="editBk(\'' + b.id + '\')">' + I('edit') + 'Change</button></div>' +
    (step ? '<div style="margin-top:12px">' + step + '</div>' : '') +
    '<div class="sec"><h2>Money</h2><span class="small b ' + (p.balance > 0 && b.status !== 'Cancelled' ? 'bal due' : 'bal paid') + '">' + (b.status === 'Cancelled' ? '' : p.balance > 0 ? rm(p.balance) + ' to collect' : 'Fully paid') + '</span></div>' +
    '<div class="list"><div class="sumline"><span>Rent · ' + p.days + ' × ' + rm(b.rate) + '</span><span>' + rm(p.rent) + '</span></div>' +
    (p.cover ? '<div class="sumline"><span>' + p.coverName + '</span><span>' + rm(p.cover) + '</span></div>' : '') +
    (p.places ? '<div class="sumline"><span>Delivery / airport fees</span><span>' + rm(p.places) + '</span></div>' : '') +
    (b.extras || []).map(function (e) { return '<div class="sumline"><span>' + esc(e.name) + '</span><span>' + rm(e.amt) + '</span></div>'; }).join('') +
    '<div class="sumline big"><span>Total</span><span>' + rm(p.total) + '</span></div><div class="sumline"><span class="muted">Paid</span><span class="muted">' + rm(p.paid) + '</span></div>' +
    '<div class="sumline"><span class="muted">Deposit (refundable)</span><span class="muted">' + rm(p.depPaid) + ' of ' + rm(b.deposit) + '</span></div></div>' +
    (b.payments.length ? '<div class="sec"><h2>Payments</h2></div><div class="list"><table class="money"><thead><tr><th>Date</th><th>Kind</th><th>Method</th><th>Amount</th></tr></thead><tbody>' +
      b.payments.map(function (x) { return '<tr><td class="small">' + dShort(x.at) + '</td><td class="small">' + x.kind + '</td><td class="small">' + x.method.replace('Online Transfer', 'Transfer') + '</td><td class="small b">' + rm(x.amt) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
    '<div class="sec"><h2>Documents</h2></div><div class="list"><button class="row" onclick="say(\'Customer link copied\');copyText(location.origin+\'/c/' + b.code + '\')">' + I('link') + '<div class="grow"><div class="t1">Customer link</div><div class="t2">Agreement, must-know rules and signature</div></div></button>' +
    '<button class="row" onclick="say(\'Invoice link copied\');copyText(location.origin+\'/i/' + b.code + '\')">' + I('receipt') + '<div class="grow"><div class="t1">Invoice</div><div class="t2">INV-' + b.code.slice(4) + '</div></div></button></div>' +
    (b.note ? '<div class="sec"><h2>Note</h2></div><div class="card" style="padding:12px 14px">' + esc(b.note) + '</div>' : '') +
    '<div class="sec"><h2>History</h2></div><div class="list"><div class="log">' + b.log.slice().reverse().map(function (l) { return '<div>' + esc(l.text) + '<time>' + when(l.at) + ' · ' + esc(l.by) + '</time></div>'; }).join('') + '</div></div>' +
    (b.status === 'Confirmed' ? '<div style="margin-top:16px"><button class="btn danger" onclick="cancelBk(\'' + b.id + '\')">Cancel booking</button></div>' : '') +
    '</main>';
  return { html: html };
};
function copyText(t) { try { navigator.clipboard.writeText(t); } catch (e) {} }
function logIt(b, text) { b.log.push({ at: new Date().toISOString(), by: S.me, text: text }); }
function handover(id) {
  var b = bk(id), p = priceOf(b);
  sheet('<h3>Hand over ' + esc(car(b.car).plate) + '</h3><p class="lead">' + esc(cust(b.cust).name) + ' at ' + esc(b.pickPlace) + '</p>' +
    (p.balance > 0 ? '<div class="banner warn">' + I('info') + '<div><b>' + rm(p.balance) + '</b> rent is still unpaid.</div></div>' : '') +
    (p.depPaid < b.deposit ? '<div class="banner warn">' + I('info') + '<div>Deposit not fully received (<b>' + rm(p.depPaid) + '</b> of ' + rm(b.deposit) + ').</div></div>' : '') +
    '<label class="field"><span>Fuel level</span><div class="seg" id="fuel">' + ['Full', '3/4', '1/2', '1/4'].map(function (x, i) { return '<button type="button" class="' + (i === 0 ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div></label>' +
    '<label class="field"><span>Mileage (km)</span><input class="inp num" inputmode="numeric" id="km" value="' + (35000 + Math.floor(Math.random() * 40000)) + '"></label>' +
    '<button class="btn" onclick="doHandover(\'' + id + '\')">' + I('check', 2.4) + 'Car handed over</button>', function () { segPick('#fuel'); });
}
function doHandover(id) {
  var b = bk(id), fuel = ($('#fuel .on') || {}).textContent, km = $('#km').value;
  b.status = 'Picked up'; logIt(b, 'Car handed over at ' + b.pickPlace + ' (fuel ' + fuel + ', ' + km + ' km)'); save(); closeSheet();
  notify('change', b.code + ' is on the road', cust(b.cust).name + ' took ' + car(b.car).plate + ' at ' + b.pickPlace, '#booking/' + b.id); render();
}
function takeBack(id) {
  var b = bk(id);
  sheet('<h3>Take back ' + esc(car(b.car).plate) + '</h3><p class="lead">' + esc(cust(b.cust).name) + ' at ' + esc(b.retPlace) + '</p>' +
    '<label class="field"><span>Fuel level</span><div class="seg" id="fuel">' + ['Full', '3/4', '1/2', '1/4'].map(function (x, i) { return '<button type="button" class="' + (i === 0 ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div></label>' +
    '<label class="field"><span>Any new damage?</span><div class="seg" id="dmg"><button type="button" class="on">No</button><button type="button">Yes</button></div></label>' +
    '<button class="btn" onclick="doTakeBack(\'' + id + '\')">' + I('check', 2.4) + 'Car returned</button>', function () { segPick('#fuel'); segPick('#dmg'); });
}
function doTakeBack(id) {
  var b = bk(id), dmg = ($('#dmg .on') || {}).textContent === 'Yes';
  b.status = 'Returned'; logIt(b, 'Car returned at ' + b.retPlace + (dmg ? ', new damage noted' : ', no new damage')); save(); closeSheet();
  notify('change', b.code + ' returned', car(b.car).plate + ' is back at ' + b.retPlace + (dmg ? ' with new damage' : ''), '#booking/' + b.id); render();
}
function cancelBk(id) {
  sheet('<h3>Cancel this booking?</h3><p class="lead">The car becomes free for these dates again. You can see it later under Cancelled.</p><div class="btnrow"><button class="btn ghost" onclick="closeSheet()">Keep it</button><button class="btn danger" onclick="doCancel(\'' + id + '\')">Cancel booking</button></div>');
}
function doCancel(id) { var b = bk(id); b.status = 'Cancelled'; logIt(b, 'Booking cancelled'); save(); closeSheet(); notify('change', b.code + ' cancelled', cust(b.cust).name + ' · ' + car(b.car).plate + ' · ' + when(b.start), '#booking/' + b.id); render(); }
function payment(id) {
  var b = bk(id), p = priceOf(b), sugg = p.balance > 0 ? p.balance : Math.max(0, b.deposit - p.depPaid);
  sheet('<h3>Record payment</h3><p class="lead">' + esc(b.code) + ' · ' + esc(cust(b.cust).name) + '</p>' +
    '<label class="field"><span>What is it for?</span><div class="seg" id="pkind"><button type="button" class="' + (p.balance > 0 ? 'on' : '') + '">Rental<small>' + rm(Math.max(0, p.balance)) + ' due</small></button><button type="button" class="' + (p.balance > 0 ? '' : 'on') + '">Deposit<small>' + rm(Math.max(0, b.deposit - p.depPaid)) + ' due</small></button></div></label>' +
    '<label class="field"><span>Amount (RM)</span><input class="inp num" id="pamt" inputmode="decimal" value="' + (sugg ? sugg.toFixed(2) : '') + '"></label>' +
    '<label class="field"><span>How did they pay?</span><div class="seg" id="pmeth"><button type="button" class="on">Online Transfer</button><button type="button">Cash</button><button type="button">Card</button></div></label>' +
    '<button class="btn" onclick="doPayment(\'' + id + '\')">' + I('check', 2.4) + 'Save payment</button>', function () {
      segPick('#pmeth'); segPick('#pkind', function (t) { var x = priceOf(bk(id)); $('#pamt').value = (t.indexOf('Rental') === 0 ? Math.max(0, x.balance) : Math.max(0, bk(id).deposit - x.depPaid)).toFixed(2); });
    });
}
function doPayment(id) {
  var b = bk(id), amt = parseFloat(($('#pamt').value || '').replace(/[^\d.]/g, '')), kind = $('#pkind .on').textContent.indexOf('Rental') === 0 ? 'Rental' : 'Deposit', meth = $('#pmeth .on').textContent;
  if (!(amt > 0)) { say('Type the amount first'); return; }
  b.payments.push({ id: uid(), amt: amt, kind: kind, method: meth, at: new Date().toISOString(), by: S.me });
  logIt(b, rm(amt) + ' ' + kind.toLowerCase() + ' received by ' + meth.toLowerCase()); save(); closeSheet();
  notify('pay', rm(amt) + ' received', b.code + ' · ' + cust(b.cust).name + ' · ' + meth, '#booking/' + b.id); render();
}
function editBk(id) {
  var b = bk(id);
  sheet('<h3>Change booking</h3><p class="lead">' + esc(b.code) + '. Changes are saved in the history and sent to staff who follow booking changes.</p>' +
    '<div class="two"><label class="field"><span>Pick-up date</span><input class="inp" type="date" id="es_d" value="' + toLocalInput(b.start) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="es_t" value="' + toTimeInput(b.start) + '"></label></div>' +
    '<div class="two"><label class="field"><span>Return date</span><input class="inp" type="date" id="ee_d" value="' + toLocalInput(b.end) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="ee_t" value="' + toTimeInput(b.end) + '"></label></div>' +
    '<label class="field"><span>Car</span><select class="inp" id="e_car">' + S.cars.map(function (c) { return '<option value="' + c.id + '"' + (c.id === b.car ? ' selected' : '') + '>' + esc(c.plate + ' · ' + c.make + ' ' + c.model) + '</option>'; }).join('') + '</select></label>' +
    '<label class="field"><span>Return place</span><select class="inp" id="e_rp">' + B().places.map(function (p) { return '<option' + (p === b.retPlace ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></label>' +
    '<label class="field"><span>Note for staff</span><textarea class="inp" id="e_note">' + esc(b.note) + '</textarea></label>' +
    '<button class="btn" onclick="doEdit(\'' + id + '\')">Save changes</button>');
}
function doEdit(id) {
  var b = bk(id), s = fromInputs($('#es_d').value, $('#es_t').value), e = fromInputs($('#ee_d').value, $('#ee_t').value), ch = [];
  if (!(e > s)) { say('Return must be after pick-up'); return; }
  var ncar = $('#e_car').value;
  if (busy(ncar, s, e, b.id)) { say(car(ncar).plate + ' is booked then'); return; }
  if (s.getTime() !== new Date(b.start).getTime() || e.getTime() !== new Date(b.end).getTime()) ch.push('dates to ' + dShort(s) + ' ' + hm(s) + ' → ' + dShort(e) + ' ' + hm(e));
  if (ncar !== b.car) { ch.push('car to ' + car(ncar).plate); b.rate = car(ncar).rate; }
  if ($('#e_rp').value !== b.retPlace) ch.push('return place to ' + $('#e_rp').value);
  var note = $('#e_note').value.trim(); if (note !== b.note) ch.push('note');
  b.start = s.toISOString(); b.end = e.toISOString(); b.car = ncar; b.retPlace = $('#e_rp').value; b.note = note;
  closeSheet();
  if (!ch.length) { say('Nothing changed'); return; }
  logIt(b, 'Changed ' + ch.join(', ')); save();
  notify('change', b.code + ' changed', S.me.split(' ')[0] + ' changed ' + ch.join(', '), '#booking/' + b.id); render();
}
function busy(carId, s, e, except) { return S.bookings.some(function (b) { return b.id !== except && b.car === carId && b.status !== 'Cancelled' && b.status !== 'Returned' && new Date(b.start) < e && new Date(b.end) > s; }); }


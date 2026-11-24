/* ---------------- NEW BOOKING ---------------- */
var NB = null;
function nbFresh() {
  var s = new Date(); s.setDate(s.getDate() + 1); s.setHours(10, 0, 0, 0); var e = new Date(s.getTime() + 2 * DAY);
  return { cust: null, newName: '', newPhone: '', q: '', s: s.toISOString(), e: e.toISOString(), car: null, pick: B().places[0], ret: B().places[0], cover: 'basic', deposit: null, note: '', source: 'Staff' };
}
VIEWS.new = function () {
  if (!NB) NB = nbFresh();
  var s = new Date(NB.s), e = new Date(NB.e), days = nDays(s, e);
  var custBlock;
  if (NB.cust) { var c = cust(NB.cust); custBlock = '<div class="picked"><div class="av sm" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</div><div class="grow"><div class="b">' + esc(c.name) + ' ' + (c.flag ? flagChip(c.flag) : '') + '</div><div class="small muted nowrap">' + esc(c.phone) + '</div></div><button class="btn sm ghost" onclick="NB.cust=null;render()">Change</button></div>' + (c.flag === 'Blacklisted' ? '<div class="banner warn">' + I('info') + '<div><b>Blacklisted customer.</b> Check with the manager before you confirm.</div></div>' : ''); }
  else custBlock = '<label class="field"><span>Find a customer, or type a new one</span><input class="inp" id="nb_q" placeholder="Name or phone" value="' + esc(NB.q) + '" autocomplete="off"></label><div id="nb_sug"></div>' +
    '<div class="two"><label class="field"><span>New customer name</span><input class="inp" id="nb_name" value="' + esc(NB.newName) + '" autocomplete="off"></label><label class="field"><span>Phone</span><input class="inp num" id="nb_phone" inputmode="tel" placeholder="012-345 6789" value="' + esc(NB.newPhone) + '"></label></div>';
  var cars = S.cars.map(function (c) { var bz = busy(c.id, s, e); return '<button type="button" class="cp ' + (NB.car === c.id ? 'on ' : '') + (bz ? 'busy' : '') + '" ' + (bz ? 'disabled' : 'onclick="NB.car=\'' + c.id + '\';NB.deposit=null;render(false,true)"') + '>' + carSVG(c.color, c.shape) + '<div class="p">' + esc(c.plate) + '</div><div class="m">' + esc(c.make + ' ' + c.model) + '</div><div class="r num">' + rm0(c.rate) + '<span class="muted" style="font-weight:500">/day</span></div></button>'; }).join('');
  var free = S.cars.filter(function (c) { return !busy(c.id, s, e); }).length;
  var tmp = NB.car ? { start: NB.s, end: NB.e, rate: car(NB.car).rate, cover: NB.cover, pickPlace: NB.pick, retPlace: NB.ret, extras: [], payments: [] } : null, pr = tmp ? priceOf(tmp) : null;
  var dep = NB.deposit != null ? NB.deposit : NB.car ? car(NB.car).deposit : 0;
  var placeOpts = function (sel) { return B().places.map(function (p) { var f = placeFee(p); return '<option value="' + esc(p) + '"' + (p === sel ? ' selected' : '') + '>' + esc(p) + (f ? ' (+' + rm0(f) + ')' : '') + '</option>'; }).join(''); };
  var html = topbar('New booking', { back: '#bookings', sub: B().code + '-' + String(S.nextNo).padStart(5, '0') }) + '<main>' +
    '<div class="formcard"><h3><span class="stepn">1</span>Customer</h3>' + custBlock + '</div>' +
    '<div class="formcard"><h3><span class="stepn">2</span>Dates</h3>' +
    '<div class="two"><label class="field"><span>Pick-up</span><input class="inp" type="date" id="nb_sd" value="' + toLocalInput(s) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="nb_st" value="' + toTimeInput(s) + '"></label></div>' +
    '<div class="two"><label class="field"><span>Return</span><input class="inp" type="date" id="nb_ed" value="' + toLocalInput(e) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="nb_et" value="' + toTimeInput(e) + '"></label></div>' +
    '<p class="small muted" style="margin:-4px 0 12px">' + days + ' day' + (days > 1 ? 's' : '') + ' · ' + free + ' of ' + S.cars.length + ' cars free</p></div>' +
    '<div class="formcard"><h3><span class="stepn">3</span>Car</h3><div class="carpick" id="carpick">' + cars + '</div></div>' +
    '<div class="formcard"><h3><span class="stepn">4</span>Places</h3>' +
    '<label class="field"><span>Pick-up place</span><select class="inp" id="nb_pick">' + placeOpts(NB.pick) + '</select></label>' +
    '<label class="field"><span>Return place</span><select class="inp" id="nb_ret">' + placeOpts(NB.ret) + '</select></label></div>' +
    '<div class="formcard"><h3><span class="stepn">5</span>Cover and deposit</h3><div class="seg" id="nb_cover">' + COVERS.map(function (c) { return '<button type="button" data-v="' + c.id + '" class="' + (NB.cover === c.id ? 'on' : '') + '">' + c.name + (c.daily ? '<small>' + rm0(c.daily) + '/day</small>' : '') + '</button>'; }).join('') + '</div>' +
    '<div class="two"><label class="field"><span>Deposit (RM)</span><input class="inp num" id="nb_dep" inputmode="decimal" value="' + dep + '"></label><label class="field"><span>Booked through</span><select class="inp" id="nb_src">' + ['Staff', 'WhatsApp', 'Website', 'Walk-in'].map(function (x) { return '<option' + (x === NB.source ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>' +
    '<label class="field"><span>Note for staff (optional)</span><textarea class="inp" id="nb_note">' + esc(NB.note) + '</textarea></label></div>' +
    (pr ? '<div class="list" style="margin-bottom:8px"><div class="sumline"><span>Rent · ' + pr.days + ' × ' + rm(tmp.rate) + '</span><span>' + rm(pr.rent) + '</span></div>' + (pr.cover ? '<div class="sumline"><span>' + pr.coverName + '</span><span>' + rm(pr.cover) + '</span></div>' : '') + (pr.places ? '<div class="sumline"><span>Delivery / airport fees</span><span>' + rm(pr.places) + '</span></div>' : '') + '<div class="sumline big"><span>Total</span><span>' + rm(pr.total) + '</span></div><div class="sumline"><span class="muted">Deposit, refundable</span><span class="muted">' + rm(+dep || 0) + '</span></div></div>' : '') +
    '<button class="btn ghost" style="margin-top:6px" onclick="NB=null;location.hash=\'#bookings\'">Discard</button></main>' +
    '<div class="stickybar"><div class="stickybar-in"><div class="tot">' + (pr ? '<b class="num">' + rm(pr.total) + '</b><span>' + pr.days + ' day' + (pr.days > 1 ? 's' : '') + ' + ' + rm0(+dep || 0) + ' deposit</span>' : '<b style="font-size:15px">Choose a car</b><span>to see the price</span>') + '</div><button class="btn" id="nb_save" onclick="saveNew()">' + I('check', 2.4) + 'Save booking</button></div></div>';
  return { html: html, noNav: true, keepScroll: true, after: function () {
    var keep = function () {
      if ($('#nb_name')) { NB.newName = $('#nb_name').value; NB.newPhone = $('#nb_phone').value; }
      NB.note = $('#nb_note').value; NB.deposit = parseFloat($('#nb_dep').value) || 0; NB.source = $('#nb_src').value;
    };
    ['nb_note', 'nb_dep', 'nb_src', 'nb_name'].forEach(function (i) { var el = $('#' + i); if (el) el.addEventListener('input', keep); if (el) el.addEventListener('change', keep); });
    var ph = $('#nb_phone'); if (ph) ph.addEventListener('input', function () { var v = fmtPhone(ph.value); if (ph.value.replace(/\D/g, '').length > 2) ph.value = v; keep(); });
    var redate = function () {
      keep(); var s2 = fromInputs($('#nb_sd').value, $('#nb_st').value), e2 = fromInputs($('#nb_ed').value, $('#nb_et').value);
      if (isNaN(s2) || isNaN(e2)) return;
      if (e2 <= s2) { e2 = new Date(s2.getTime() + DAY); }
      NB.s = s2.toISOString(); NB.e = e2.toISOString(); if (NB.car && busy(NB.car, s2, e2)) { NB.car = null; say('That car is booked for the new dates'); }
      render(false, true);
    };
    ['nb_sd', 'nb_st', 'nb_ed', 'nb_et'].forEach(function (i) { $('#' + i).addEventListener('change', redate); });
    $('#nb_pick').onchange = function () { keep(); var same = NB.ret === NB.pick; NB.pick = this.value; if (same) NB.ret = this.value; render(false, true); };
    $('#nb_ret').onchange = function () { keep(); NB.ret = this.value; render(false, true); };
    $$('#nb_cover button').forEach(function (b) { b.onclick = function () { keep(); NB.cover = b.dataset.v; render(false, true); }; });
    var q = $('#nb_q');
    if (q) {
      var sug = function () {
        NB.q = q.value; var t = q.value.trim().toLowerCase(), d = t.replace(/\D/g, ''), box = $('#nb_sug');
        if (t.length < 2) { box.innerHTML = ''; return; }
        var m = S.customers.filter(function (c) { return c.name.toLowerCase().indexOf(t) >= 0 || (d.length >= 3 && c.phone.replace(/\D/g, '').indexOf(d.replace(/^0/, '')) >= 0); }).slice(0, 5);
        box.innerHTML = m.length ? '<div class="suggest">' + m.map(function (c) { return '<button type="button" data-id="' + c.id + '"><span>' + esc(c.name) + ' ' + (c.flag ? flagChip(c.flag) : '') + '</span><span class="muted nowrap small">' + esc(c.phone) + '</span></button>'; }).join('') + '</div>' : '<p class="small muted" style="margin:-6px 0 12px">No match. Fill in the new customer below.</p>';
        $$('#nb_sug button').forEach(function (b) { b.onclick = function () { keep(); NB.cust = b.dataset.id; NB.q = ''; render(false, true); }; });
      };
      q.addEventListener('input', sug); if (NB.q) sug();
    }
    if (NB.car) { var on = $('.cp.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  } };
};
function saveNew() {
  var n = NB;
  if ($('#nb_name')) { n.newName = $('#nb_name').value.trim(); n.newPhone = $('#nb_phone').value.trim(); }
  n.note = $('#nb_note').value.trim(); n.source = $('#nb_src').value; n.deposit = parseFloat($('#nb_dep').value) || 0;
  if (!n.cust && (!n.newName || n.newPhone.replace(/\D/g, '').length < 9)) { say('Choose a customer, or type a name and phone'); return; }
  if (!n.car) { say('Choose a car'); var cp = $('#carpick'); if (cp) cp.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  var cid = n.cust;
  if (!cid) { cid = 'cu' + uid(); S.customers.push({ id: cid, name: n.newName, phone: fmtPhone(n.newPhone), flag: '' }); }
  var c = car(n.car), b = { id: uid(), code: B().code + '-' + String(S.nextNo++).padStart(5, '0'), cust: cid, car: c.id, start: n.s, end: n.e, pickPlace: n.pick, retPlace: n.ret, cover: n.cover, deposit: n.deposit, rate: c.rate,
    extras: [], payments: [], log: [], source: n.source === 'Walk-in' ? 'Staff' : n.source, note: n.note, status: 'Confirmed', createdBy: S.me, created: new Date().toISOString() };
  b.log.push({ at: b.created, by: S.me, text: 'Booking made' + (n.source !== 'Staff' ? ' (' + n.source + ')' : '') });
  S.bookings.push(b); NB = null; save();
  location.hash = '#booking/' + b.id;
  setTimeout(function () { notify('new', 'New booking ' + b.code, cust(cid).name + ' · ' + c.make + ' ' + c.model + ' · ' + when(b.start), '#booking/' + b.id); }, 350);
}


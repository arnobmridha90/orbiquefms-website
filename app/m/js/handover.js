/* ---------------- HANDOVER (M5) ----------------
   Handover.start(bookingId, 'out'|'in')  stepped checklist sheet: papers, car photos, odometer, fuel, note, time (out)
                                          or odometer, fuel, damage, time and late return, deposit (in).
                                          A draft is kept per booking after every step, so it can be resumed.
   Fees.claim(bookingId, group)           record my handover or companion fee (group 'delivery' | 'return' | 'companion')
   Fees.state(b, group)                   {kind, amt, taken} for the "Record my fee" card
   HANDOVER_DRAFTS()                      [{bookingId, dir, step, steps, at, code, plate}] handovers in progress (for Home)
   Rules follow the reference: handover time not in the future and not before the booking was made,
   odometer readings below the last one or more than 50,000 km above it are saved as 'Not trusted'. */

var HO_FUELS = ['Empty', '1/8', '1/4', '1/2', '3/4', 'Full'];
var HO_KEEP = [{ k: 'Damage', kind: 'Damage' }, { k: 'Fuel', kind: 'Fuel' }, { k: 'Cleaning', kind: 'Cleaning' }, { k: 'Late', kind: 'Late return fee' }, { k: 'Summons', kind: 'Summons' }, { k: 'Other', kind: 'Other' }];
var HO_JUMP_KM = 50000, HO_EARLY_MS = 5 * MIN;

/* ---------- drafts (one localStorage key per company) ---------- */
function hoDraftKey() { return 'fms.hodraft.' + CO; }
function hoDrafts() { try { return JSON.parse(localStorage.getItem(hoDraftKey()) || '{}') || {}; } catch (e) { return {}; } }
function hoDraftsWrite(all) {
  try { localStorage.setItem(hoDraftKey(), JSON.stringify(all)); return true; }
  catch (e) {
    /* storage full: keep the typed answers, drop the photos of the draft */
    try {
      Object.keys(all).forEach(function (k) { var d = all[k]; ['idPhoto', 'licPhoto', 'odoPhoto'].forEach(function (f) { if (d[f] && /^data:/.test(d[f])) d[f] = null; }); if (d.car) Object.keys(d.car).forEach(function (f) { if (/^data:/.test(d.car[f] || '')) d.car[f] = null; }); d.dmgPhotos = (d.dmgPhotos || []).filter(function (p) { return !/^data:/.test(p); }); });
      localStorage.setItem(hoDraftKey(), JSON.stringify(all));
    } catch (e2) {}
    return false;
  }
}
function hoDraftGet(id, dir) { return hoDrafts()[id + ':' + dir] || null; }
function hoDraftPut(st) { var all = hoDrafts(); st.at = new Date().toISOString(); all[st.bookingId + ':' + st.dir] = st; return hoDraftsWrite(all); }
function hoDraftDrop(id, dir) { var all = hoDrafts(); delete all[id + ':' + dir]; hoDraftsWrite(all); }
function hoValid(b, dir) { return !!b && (dir === 'in' ? b.bookingStatus === 'Car Delivered' : UPCOMING.indexOf(b.bookingStatus) >= 0); }
function HANDOVER_DRAFTS() {
  if (!S) return [];
  var all = hoDrafts(), out = [];
  Object.keys(all).forEach(function (k) {
    var d = all[k], b = bk(d.bookingId);
    if (!hoValid(b, d.dir)) return;
    if (!d.step && !d.idPhoto && !d.licPhoto && !d.km && !(d.car && Object.keys(d.car).length)) return; /* opened and closed without doing anything */
    out.push({ bookingId: d.bookingId, dir: d.dir, step: d.step || 0, steps: hoSteps(d.dir).length, at: d.at, code: b.code, plate: (car(b.car) || {}).plate || '' });
  });
  return out.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
}

/* ---------- helpers ---------- */
function hoKm(n) { return (+n || 0).toLocaleString('en-US') + ' km'; }
function hoLastKm(carId) {
  var best = 0;
  (S.odometer || []).forEach(function (o) { if (o.car === carId && o.trusted !== false && +o.km > best) best = +o.km; });
  return Math.max(best, +(car(carId) || {}).km || 0);
}
function hoSteps(dir) {
  return dir === 'in' ? [{ id: 'odo', t: 'Odometer' }, { id: 'fuel', t: 'Fuel' }, { id: 'damage', t: 'Damage' }, { id: 'time', t: 'Return time' }, { id: 'deposit', t: 'Deposit' }]
    : [{ id: 'papers', t: 'Check papers' }, { id: 'photos', t: 'Car photos' }, { id: 'odo', t: 'Odometer' }, { id: 'fuel', t: 'Fuel' }, { id: 'note', t: 'Note' }, { id: 'time', t: 'Handover time' }];
}
function hoWhen(st) { if (!st.date || !st.time) return null; var d = fromInputs(st.date, st.time); return isNaN(d) ? null : d; }
function hoGps() { var b = B(), R = Math.random; return { lat: +((b.lat || 3.1) + (R() - .5) * .04).toFixed(5), lng: +((b.lng || 101.6) + (R() - .5) * .04).toFixed(5) }; }
function hoLateH(b, at) { var ms = new Date(at) - new Date(b.end); return ms > 15 * MIN ? Math.ceil(ms / HOUR) : 0; }
function hoHoursText(h) { return h + ' hour' + (h === 1 ? '' : 's'); }
function hoCloseTasks(b, dir) {
  var re = dir === 'in' ? /^(Return|Collect|Drop)/i : /^(Delivery|Pick|Hand)/i, n = 0;
  (S.tasks || []).forEach(function (t) { if (t.booking === b.id && (t.status === 'Pending' || t.status === 'In Progress') && (re.test(t.type || '') || re.test(t.name || ''))) { t.status = 'Completed'; t.doneAt = new Date().toISOString(); t.doneBy = S.me; n++; } });
  return n;
}

var Handover = (function () {
  var cur = null; /* {st, b, sh} of the open checklist */

  function start(bookingId, dir) {
    dir = dir === 'in' ? 'in' : 'out';
    var b = bk(bookingId);
    if (!b) { say('Booking not found'); return; }
    if (!hoValid(b, dir)) { say(dir === 'in' ? 'This car is not out on rent (' + b.bookingStatus + ')' : 'This booking is ' + b.bookingStatus + ': nothing to hand over'); return; }
    var st = hoDraftGet(b.id, dir), resumed = !!st;
    if (!st) st = { bookingId: b.id, dir: dir, step: 0, car: {}, fuel: '', km: '', note: '', date: '', time: '', dmg: '', dmgPhotos: [], dmgNote: '', keep: {} };
    st.car = st.car || {}; st.keep = st.keep || {}; st.dmgPhotos = st.dmgPhotos || [];
    if (st.step >= hoSteps(dir).length) st.step = hoSteps(dir).length - 1;
    var sh = sheet('<div class="hoc" id="hoBody"></div>', null, { full: true, stack: SHEETS.length > 0, cls: 'ho-sheet', noSwipe: true, onClose: function () { if (cur && cur.sh === sh) { var nt = $('#hoNote', sh), dn = $('#hoDmgNote', sh); if (nt) cur.st.note = nt.value; if (dn) cur.st.dmgNote = dn.value; persist(); cur = null; } } });
    cur = { st: st, b: b, sh: sh, resumed: resumed, err: '' };
    draw();
  }

  /* ---------- drawing ---------- */
  function slot(key, label, src) {
    return '<button type="button" class="ho-slot' + (src ? ' has' : '') + '" data-slot="' + key + '">' + (src ? '<img alt="" src="' + imgSrc(src) + '"><span class="ho-slot-l">' + I('check', 2.6) + esc(label) + '</span>' :
      '<span class="ho-slot-ic">' + I('camera') + '</span><span class="ho-slot-t">' + esc(label) + '</span>') + '</button>';
  }
  function sampleBtn(what) { return '<button type="button" class="btn link ho-sample" data-sample="' + what + '">' + I('image') + 'No camera? Use sample photos</button>'; }
  function draw(focus) {
    if (!cur) return;
    var st = cur.st, b = cur.b, c = car(b.car) || {}, cu = cust(b.cust), steps = hoSteps(st.dir), s = steps[st.step], last = st.step === steps.length - 1, out = st.dir === 'out';
    if ((s.id === 'time' || s.id === 'deposit') && !st.date) { st.date = toLocalInput(new Date()); st.time = toTimeInput(new Date()); }
    var head = '<div class="sheet-head"><div class="grow"><h3>' + (out ? 'Hand over ' : 'Take back ') + esc(c.plate || '') + '</h3><p class="lead">' + esc(cu.name) + ' · ' + esc(placeText(b, out ? 'pick' : 'ret')) + '</p></div>' +
      '<button class="iconbtn" type="button" id="hoX" aria-label="Close">' + I('x', 2.2) + '</button></div>' +
      '<div class="ho-prog" aria-hidden="true">' + steps.map(function (x, i) { return '<i class="' + (i < st.step ? 'done' : i === st.step ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="ho-stepname">Step ' + (st.step + 1) + ' of ' + steps.length + ' · <b>' + esc(s.t) + '</b>' + (cur.resumed && st.step > 0 ? '<button type="button" class="ho-over" id="hoOver">Start over</button>' : '') + '</div>';
    var body = (cur.resumed && st.step > 0 ? '<div class="banner blue">' + I('info') + '<div>Picked up where you left off. Your answers so far are kept.</div></div>' : '') +
      (cur.err ? '<div class="banner red" id="hoErr">' + I('warn') + '<div>' + esc(cur.err) + '</div></div>' : '') + stepHtml(s.id);
    var foot = '<div class="sheet-foot ho-foot"><div class="ho-saving" id="hoSaving" hidden><div class="ho-bar"><i id="hoBarI"></i></div><span id="hoSavT">Saving...</span></div>' +
      '<div class="ho-btns" id="hoBtns">' + (st.step > 0 ? '<button type="button" class="btn ghost ho-backb" id="hoPrev">' + I('back', 2.2) + 'Back</button>' : '') +
      '<button type="button" class="btn" id="hoNext">' + (last ? I('check', 2.4) + (out ? 'Confirm handover' : 'Confirm return') : 'Next') + '</button></div></div>';
    $('#hoBody', cur.sh).innerHTML = head + '<div class="ho-step">' + body + '</div>' + foot;
    wire(s.id);
    if (focus) { var f = $(focus, cur.sh); if (f) f.focus(); }
    if (cur.err) { var e = $('#hoErr', cur.sh); if (e) e.scrollIntoView({ block: 'nearest' }); }
  }

  function stepHtml(id) {
    var st = cur.st, b = cur.b, out = st.dir === 'out', m = calcBooking(b);
    if (id === 'papers') {
      var warn = '';
      if (!b.submitted) warn += '<div class="banner amber">' + I('warn') + '<div><b>The agreement is not signed yet.</b> Ask the customer to sign the booking form before you hand over the keys.<div class="ho-bact"><button type="button" class="btn sm ghost" id="hoForm">' + I('copy') + 'Copy form link</button><button type="button" class="btn sm ghost" id="hoFormWa">' + I('wa') + 'Send on WhatsApp</button></div></div></div>';
      if (m.due > 0 && b.bookingStatus !== 'Cancelled') warn += '<div class="banner red">' + I('cash') + '<div><b class="money">' + rm(m.due) + ' still due</b>' + (m.depositReceived < m.deposit ? ' (deposit ' + rm(Math.max(0, m.deposit - m.depositReceived)) + ' not received)' : '') + '. Collect it before the car goes out.' +
        (can('billing.record_payment') ? '<div class="ho-bact"><button type="button" class="btn sm" id="hoPay">' + I('cash') + 'Record payment</button></div>' : '') + '</div></div>';
      if (!warn) warn = '<div class="banner green">' + I('check') + '<div>Agreement signed and nothing due. Good to go.</div></div>';
      return warn + '<p class="ho-ask">Take a photo of the customer’s ID and driving licence.</p><div class="ho-slots two">' + slot('idPhoto', 'IC or passport', st.idPhoto) + slot('licPhoto', 'Driving licence', st.licPhoto) + '</div>' + sampleBtn('papers');
    }
    if (id === 'photos') {
      return '<p class="ho-ask">Walk around the car and take one photo of each side.</p><div class="ho-slots two">' + ['Front', 'Back', 'Left', 'Right'].map(function (x) { return slot('car.' + x.toLowerCase(), x, st.car[x.toLowerCase()]); }).join('') + '</div>' + sampleBtn('car');
    }
    if (id === 'odo') {
      var lastK = hoLastKm(b.car), hk = b.inspection && b.inspection.agent ? +b.inspection.agent.km || 0 : 0;
      var hint = out ? 'Last reading ' + hoKm(lastK) : 'At handover ' + hoKm(hk || lastK);
      return '<p class="ho-ask">Take a photo of the dashboard, then type the km you see.</p><div class="ho-slots one">' + slot('odoPhoto', 'Odometer', st.odoPhoto) + '</div>' + sampleBtn('odo') +
        '<label class="field"><span>' + (out ? 'Odometer (km)' : 'Return odometer (km)') + '</span><input class="inp num ho-km" id="hoKm" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="' + esc(hint) + '" value="' + esc(st.km ? (+st.km).toLocaleString('en-US') : '') + '">' +
        '<small class="hint" id="hoKmHint">' + esc(hint) + '. Digits only.</small></label>';
    }
    if (id === 'fuel') {
      return '<p class="ho-ask">How much fuel is in the tank?</p><div class="ho-fuel" id="hoFuel">' + HO_FUELS.map(function (f, i) { return '<button type="button" class="' + (st.fuel === f ? 'on' : '') + '" data-f="' + f + '"><span class="ho-gauge"><i style="height:' + Math.round([0, 12.5, 25, 50, 75, 100][i]) + '%"></i></span>' + f + '</button>'; }).join('') + '</div>' +
        (!out && b.inspection && b.inspection.agent && b.inspection.agent.fuel ? '<p class="hint">At handover: <b>' + esc(b.inspection.agent.fuel) + '</b></p>' : '');
    }
    if (id === 'note') {
      return '<p class="ho-ask">Anything to note? Scratches already there, items in the car, what the customer said.</p><label class="field"><span>Note (optional)</span><textarea class="inp ho-ta" id="hoNote" maxlength="500" placeholder="For example: small scratch on the rear bumper, already there">' + esc(st.note) + '</textarea></label>';
    }
    if (id === 'damage') {
      return '<p class="ho-ask">Any new damage?</p><div class="seg ho-yn" id="hoDmg"><button type="button" class="' + (st.dmg === 'No' ? 'on' : '') + '">No</button><button type="button" class="' + (st.dmg === 'Yes' ? 'on' : '') + '">Yes</button></div>' +
        (st.dmg === 'Yes' ? '<div class="ho-slots three">' + st.dmgPhotos.map(function (p, i) { return '<div class="ho-slot has"><img alt="" src="' + imgSrc(p) + '"><button type="button" class="ho-del" data-del="' + i + '" aria-label="Remove photo">' + I('x', 2.4) + '</button></div>'; }).join('') +
          '<button type="button" class="ho-slot" id="hoDmgAdd"><span class="ho-slot-ic">' + I('camera') + '</span><span class="ho-slot-t">' + (st.dmgPhotos.length ? 'Add more' : 'Take photos') + '</span></button></div>' + sampleBtn('damage') +
          '<label class="field"><span>What is damaged?</span><textarea class="inp ho-ta" id="hoDmgNote" maxlength="400" placeholder="For example: dent on the left rear door">' + esc(st.dmgNote) + '</textarea></label>' : '');
    }
    if (id === 'time') {
      var when = hoWhen(st), plan = new Date(out ? b.start : b.end), info = '';
      if (when) {
        var diff = when - plan, h = Math.round(Math.abs(diff) / HOUR * 10) / 10;
        if (out && Math.abs(diff) > 2 * HOUR) info = '<div class="banner amber">' + I('clock') + '<div>This is <b>' + hoHoursText(Math.round(h)) + ' ' + (diff > 0 ? 'after' : 'before') + '</b> the planned start (' + esc(when === null ? '' : dShort(plan) + ', ' + hm(plan)) + '). Check the time.</div></div>';
        if (!out) { var lh = hoLateH(b, when); info = lh ? '<div class="banner red">' + I('clock') + '<div><b>Returned ' + hoHoursText(lh) + ' late.</b> It was due back ' + esc(dShort(plan) + ', ' + hm(plan)) + '. You can keep a late fee from the deposit in the next step.</div></div>' : '<div class="banner green">' + I('check') + '<div>On time. It was due back ' + esc(dShort(plan) + ', ' + hm(plan)) + '.</div></div>'; }
      }
      return '<p class="ho-ask">' + (out ? 'When did the customer get the car?' : 'When did the car come back?') + ' It is set to now.</p>' +
        '<div class="ho-two"><label class="field"><span>Date</span><input class="inp" type="date" id="hoDate" value="' + esc(st.date) + '" max="' + toLocalInput(new Date()) + '"></label><label class="field"><span>Time</span><input class="inp" type="time" id="hoTime" value="' + esc(st.time) + '"></label></div>' +
        '<button type="button" class="btn link ho-now" id="hoNow">' + I('clock') + 'Set to now</button>' + info + (out ? summary() + gpsHtml() : '');
    }
    if (id === 'deposit') {
      var dep = m.depositReceived, rate = +(b.rates || {}).hourly || 0, lh2 = hoLateH(b, hoWhen(st) || new Date());
      var rows = HO_KEEP.map(function (x) {
        var on = !!st.keep[x.k], v = st.keep[x.k] || {};
        return '<div class="ho-keep' + (on ? ' on' : '') + '">' + (on ? '<div class="ho-keep-h"><b>' + esc(x.k === 'Late' ? 'Late return fee' : x.k) + '</b><button type="button" class="iconbtn" data-unkeep="' + x.k + '" aria-label="Remove">' + I('x', 2.2) + '</button></div>' +
          '<div class="ho-two"><div class="rmfield"><input class="inp num" inputmode="decimal" data-amt="' + x.k + '" placeholder="0.00" value="' + esc(v.amt || '') + '"></div><input class="inp" data-note="' + x.k + '" maxlength="160" placeholder="Note (optional)" value="' + esc(v.note || '') + '"></div>' +
          (x.k === 'Late' && lh2 && rate ? '<small class="hint">' + hoHoursText(lh2) + ' late x ' + rm(rate) + ' an hour' + (+(b.rates || {}).daily && lh2 * rate > +b.rates.daily ? ', capped at one day (' + rm(b.rates.daily) + ')' : '') + '</small>' : '') : '') + '</div>';
      }).join('');
      var chips = HO_KEEP.map(function (x) { return '<button type="button" class="fchip' + (st.keep[x.k] ? ' on' : '') + '" data-keep="' + x.k + '">' + esc(x.k) + '</button>'; }).join('');
      var total = Object.keys(st.keep).reduce(function (s, k) { var a = parseMoney(st.keep[k].amt); return s + (a > 0 ? a : 0); }, 0);
      return '<p class="ho-ask">Anything kept from the deposit?</p><div class="ho-depline"><span>Deposit received</span><b class="money">' + rm(dep) + '</b></div>' +
        '<div class="ho-chips">' + chips + '</div>' + rows +
        (Object.keys(st.keep).length ? '<div class="ho-depline"><span>Kept from the deposit</span><b class="money" id="hoKeepT">' + rm(total) + '</b></div><div class="ho-depline big"><span>To return</span><b class="money" id="hoBackT">' + rm(Math.max(0, dep - total)) + '</b></div>' :
          '<p class="hint">Nothing kept: the full deposit goes back to the customer. You can still add adjustments later on the deposit screen.</p>') +
        summary() + gpsHtml();
    }
    return '';
  }
  function summary() {
    var st = cur.st, out = st.dir === 'out', w = hoWhen(st), rows = [];
    rows.push(['Odometer', st.km ? hoKm(st.km) : 'Not typed']); rows.push(['Fuel', st.fuel || 'Not chosen']);
    if (out) rows.push(['Photos', [st.idPhoto, st.licPhoto, st.odoPhoto].concat(['front', 'back', 'left', 'right'].map(function (k) { return st.car[k]; })).filter(Boolean).length + ' of 7']);
    else rows.push(['New damage', st.dmg === 'Yes' ? 'Yes, ' + st.dmgPhotos.length + ' photo' + (st.dmgPhotos.length === 1 ? '' : 's') : 'No']);
    rows.push([out ? 'Handed over' : 'Returned', w ? dShort(w) + ', ' + hm(w) : 'Not set']);
    return '<div class="ho-sum"><div class="ho-sum-h">Check before you confirm</div>' + rows.map(function (r) { return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>';
  }
  function gpsHtml() { var g = cur.st.gps; return '<div class="ho-gps" id="hoGps">' + I('pin') + (g ? '<span>Location saved with the check: <b class="num">' + g.lat.toFixed(4) + ', ' + g.lng.toFixed(4) + '</b></span>' : '<span>Finding your location...</span>') + '</div>'; }

  /* ---------- wiring ---------- */
  function persist() { if (!cur) return; if (!hoDraftPut(cur.st)) say('Phone storage is full: the draft keeps your answers but not the photos'); }
  function takePhoto(key) {
    var st = cur.st;
    Media.photo({ maxPx: 900, quality: .6 }).then(function (r) {
      if (!cur) return;
      if (key.indexOf('car.') === 0) st.car[key.slice(4)] = r.dataUrl; else st[key] = r.dataUrl;
      if (r.note) say(r.note);
      cur.err = ''; persist(); draw();
    }, function () {});
  }
  function hoClearErr() { if (!cur || !cur.err) return; cur.err = ''; var e = $('#hoErr', cur.sh); if (e) e.remove(); }
  function wire(id) {
    var sh = cur.sh, st = cur.st, b = cur.b;
    $('#hoX', sh).onclick = function () { persist(); closeSheet(); if (stepFilled()) say('Saved. Open the booking again to carry on.'); };
    var ov = $('#hoOver', sh); if (ov) ov.onclick = function () { confirm({ icon: 'warn', title: 'Start over?', text: 'Your photos and answers for this handover will be cleared.', ok: 'Start over', cancel: 'Keep them', danger: true }).then(function (ok) { if (!ok || !cur) return; hoDraftDrop(st.bookingId, st.dir); var id2 = st.bookingId, d2 = st.dir; cur = null; closeSheet(true); setTimeout(function () { start(id2, d2); }, 30); }); };
    $$('[data-slot]', sh).forEach(function (el) { el.onclick = function () { takePhoto(el.dataset.slot); }; });
    $$('[data-sample]', sh).forEach(function (el) {
      el.onclick = function () {
        var w = el.dataset.sample;
        if (w === 'papers') { st.idPhoto = st.idPhoto || 'demo:ic:IC'; st.licPhoto = st.licPhoto || 'demo:licence:Licence'; }
        if (w === 'car') ['Front', 'Back', 'Left', 'Right'].forEach(function (x) { st.car[x.toLowerCase()] = st.car[x.toLowerCase()] || 'demo:car:' + x; });
        if (w === 'odo') st.odoPhoto = st.odoPhoto || 'demo:odo:' + pad(hoLastKm(b.car) + 120, 6);
        if (w === 'damage') st.dmgPhotos.push('demo:car:Damage ' + (st.dmgPhotos.length + 1));
        cur.err = ''; persist(); draw();
      };
    });
    var f1 = $('#hoForm', sh); if (f1) f1.onclick = function () { Share.copy(Links.form(b), 'Form link copied'); };
    var f2 = $('#hoFormWa', sh); if (f2) f2.onclick = function () { Share.wa(cust(b.cust).phone, 'Hi ' + firstName(cust(b.cust).name) + ', please sign the booking form for ' + b.code + ' before we hand over the car: ' + Links.form(b)); bLog(b, 'Customer form sent on WhatsApp'); save(); };
    var pay = $('#hoPay', sh); if (pay) pay.onclick = function () {
      persist(); var bid = b.id, dir = st.dir;
      closeSheet(true);
      setTimeout(function () {
        Pay.open(bid);
        /* when the payment sheet closes, come back to the checklist */
        var co = CO, n = 0, iv = setInterval(function () { n++; if (CO !== co || n > 1500) { clearInterval(iv); return; } if (!SHEETS.length) { clearInterval(iv); if (hoValid(bk(bid), dir) && route().name !== 'signin') start(bid, dir); } }, 400);
      }, 30);
    };
    var km = $('#hoKm', sh);
    if (km) km.oninput = function () { var d = digits(km.value).slice(0, 7); st.km = d; var p = km.selectionStart, before = km.value.length; km.value = d ? (+d).toLocaleString('en-US') : ''; try { var np = Math.max(0, p + km.value.length - before); km.setSelectionRange(np, np); } catch (e) {} km.classList.remove('bad'); hoClearErr(); };
    $$('#hoFuel button', sh).forEach(function (el) { el.onclick = function () { st.fuel = el.dataset.f; cur.err = ''; persist(); draw(); }; });
    var nt = $('#hoNote', sh); if (nt) nt.oninput = function () { st.note = nt.value; };
    segPick('#hoDmg', function (t) { st.dmg = t; cur.err = ''; persist(); draw(); });
    var da = $('#hoDmgAdd', sh); if (da) da.onclick = function () { Media.photo({ maxPx: 800, quality: .55 }).then(function (r) { if (!cur) return; st.dmgPhotos.push(r.dataUrl); if (r.note) say(r.note); persist(); draw(); }, function () {}); };
    $$('[data-del]', sh).forEach(function (el) { el.onclick = function () { var i = +el.dataset.del, p = st.dmgPhotos.splice(i, 1)[0]; persist(); draw(); undoSnack('Photo removed', function () { if (!cur) return; st.dmgPhotos.splice(i, 0, p); persist(); draw(); }); }; });
    var dn = $('#hoDmgNote', sh); if (dn) dn.oninput = function () { st.dmgNote = dn.value; hoClearErr(); };
    if (id === 'time') {
      if (!st.date) { st.date = toLocalInput(new Date()); st.time = toTimeInput(new Date()); }
      var dI = $('#hoDate', sh), tI = $('#hoTime', sh);
      dI.value = st.date; tI.value = st.time;
      dI.onchange = tI.onchange = function () { st.date = dI.value; st.time = tI.value; cur.err = ''; persist(); draw(); };
      $('#hoNow', sh).onclick = function () { st.date = toLocalInput(new Date()); st.time = toTimeInput(new Date()); cur.err = ''; persist(); draw(); };
    }
    $$('[data-keep]', sh).forEach(function (el) {
      el.onclick = function () {
        var k = el.dataset.keep;
        if (st.keep[k]) delete st.keep[k];
        else {
          st.keep[k] = { amt: '', note: '' };
          if (k === 'Late') { var lh = hoLateH(b, hoWhen(st) || new Date()), r = +(b.rates || {}).hourly || 0; if (lh && r) st.keep[k].amt = money2(Math.min(lh * r, +(b.rates || {}).daily || lh * r)); }
          if (k === 'Damage' && st.dmgNote) st.keep[k].note = st.dmgNote.slice(0, 160);
        }
        persist(); draw(st.keep[k] ? '[data-amt="' + k + '"]' : null);
      };
    });
    $$('[data-unkeep]', sh).forEach(function (el) { el.onclick = function () { delete st.keep[el.dataset.unkeep]; persist(); draw(); }; });
    $$('[data-amt]', sh).forEach(function (el) { el.oninput = function () { st.keep[el.dataset.amt].amt = el.value; el.classList.remove('bad'); hoClearErr(); var tot = Object.keys(st.keep).reduce(function (s, k) { var a = parseMoney(st.keep[k].amt); return s + (a > 0 ? a : 0); }, 0); var t1 = $('#hoKeepT', sh), t2 = $('#hoBackT', sh); if (t1) t1.textContent = rm(tot); if (t2) t2.textContent = rm(Math.max(0, calcBooking(b).depositReceived - tot)); }; el.onblur = persist; });
    $$('[data-note]', sh).forEach(function (el) { el.oninput = function () { st.keep[el.dataset.note].note = el.value; }; el.onblur = persist; });
    if ($('#hoGps', sh) && !st.gps) later(function () { if (!cur || cur.st !== st) return; st.gps = hoGps(); persist(); var g = $('#hoGps', cur.sh); if (g) g.outerHTML = gpsHtml(); }, 900);
    var prev = $('#hoPrev', sh); if (prev) prev.onclick = function () { st.step--; cur.err = ''; persist(); draw(); $('.ho-step', cur.sh) && (cur.sh.scrollTop = 0); };
    $('#hoNext', sh).onclick = next;
  }
  function stepFilled() { var st = cur && cur.st; return !!(st && (st.step > 0 || st.idPhoto || st.km)); }

  /* ---------- checks per step ---------- */
  function check(id) {
    var st = cur.st, b = cur.b, out = st.dir === 'out';
    if (id === 'papers') { if (!st.idPhoto) return 'Take a photo of the customer’s IC or passport.'; if (!st.licPhoto) return 'Take a photo of the driving licence.'; }
    if (id === 'photos') { var miss = ['front', 'back', 'left', 'right'].filter(function (k) { return !st.car[k]; }); if (miss.length) return 'Still need the ' + miss.join(', ') + ' photo' + (miss.length > 1 ? 's' : '') + '.'; }
    if (id === 'odo') {
      if (!st.odoPhoto) return 'Take a photo of the odometer.';
      if (!(+st.km > 0)) { var k = $('#hoKm', cur.sh); if (k) k.classList.add('bad'); return 'Type the km shown on the dashboard.'; }
      if (!out) { var hk = b.inspection && b.inspection.agent ? +b.inspection.agent.km || 0 : 0; if (hk && +st.km < hk) return 'The return reading cannot be lower than at handover (' + hoKm(hk) + '). Check the dashboard again.'; }
    }
    if (id === 'fuel' && !st.fuel) return 'Choose the fuel level.';
    if (id === 'damage') { if (!st.dmg) return 'Choose No or Yes.'; if (st.dmg === 'Yes' && !st.dmgPhotos.length) return 'Take at least one photo of the damage.'; if (st.dmg === 'Yes' && !String(st.dmgNote || '').trim()) return 'Say what is damaged.'; }
    if (id === 'time') {
      var w = hoWhen(st); if (!w) return 'Set the date and time.';
      if (w.getTime() > Date.now() + HO_EARLY_MS) return 'The ' + (out ? 'handover' : 'return') + ' time cannot be in the future.';
      if (b.created && w.getTime() < new Date(b.created).getTime() - HO_EARLY_MS) return 'The ' + (out ? 'handover' : 'return') + ' time cannot be before the booking was made (' + dShort(b.created) + ', ' + hm(b.created) + ').';
      if (!out && b.inspection && b.inspection.agent && b.inspection.agent.at && w < new Date(b.inspection.agent.at)) return 'The return time cannot be before the handover (' + dShort(b.inspection.agent.at) + ', ' + hm(b.inspection.agent.at) + ').';
    }
    if (id === 'deposit') { var bad = Object.keys(st.keep).filter(function (k) { return !(parseMoney(st.keep[k].amt) > 0); }); if (bad.length) { bad.forEach(function (k) { var el = $('[data-amt="' + k + '"]', cur.sh); if (el) el.classList.add('bad'); }); return 'Type the amount kept for ' + bad.map(function (k) { return k.toLowerCase(); }).join(', ') + ', or remove it.'; } }
    return '';
  }
  /* soft warnings that ask before going on: resolve true to go on */
  function warnings(id) {
    var st = cur.st, b = cur.b, out = st.dir === 'out';
    if (id === 'odo') {
      var km = +st.km, base = out ? hoLastKm(b.car) : (b.inspection && b.inspection.agent && +b.inspection.agent.km) || hoLastKm(b.car), why = '';
      var hasHk = !out && b.inspection && b.inspection.agent && +b.inspection.agent.km > 0;
      if ((out || !hasHk) && km < base) why = 'This is lower than the last reading (' + hoKm(base) + ').';
      else if (km > base + HO_JUMP_KM) why = 'This is ' + hoKm(km - base) + ' more than ' + (out ? 'the last reading' : 'at handover') + ' (' + hoKm(base) + ').';
      st.trusted = !why; st.whyNot = why;
      if (why) return confirm({ icon: 'warn', title: 'Check the km', text: why + ' Is ' + hoKm(km) + ' right? If you go on, it is saved as Not trusted.', ok: 'Yes, save as Not trusted', cancel: 'Let me fix it', primary: 'cancel' });
    }
    if (id === 'time' && out) {
      var w = hoWhen(st), d = w - new Date(b.start);
      if (Math.abs(d) > 2 * HOUR) return confirm({ icon: 'warn', title: 'Handover time is far off', text: 'The booking starts ' + dShort(b.start) + ', ' + hm(b.start) + '. You set ' + dShort(w) + ', ' + hm(w) + ', which is ' + hoHoursText(Math.round(Math.abs(d) / HOUR)) + ' ' + (d > 0 ? 'later' : 'earlier') + '.', ok: 'The time is right', cancel: 'Change it', primary: 'ok' });
    }
    if (id === 'deposit') {
      var tot = Object.keys(st.keep).reduce(function (s, k) { return s + (parseMoney(st.keep[k].amt) || 0); }, 0), dep = calcBooking(b).depositReceived;
      if (tot > dep + 0.001) return confirm({ icon: 'warn', title: 'More than the deposit', text: 'You are keeping ' + rm(tot) + ' but the deposit received is ' + rm(dep) + '. The rest has to be collected from the customer.', ok: 'Go on', cancel: 'Change amounts', primary: 'cancel' });
    }
    return Promise.resolve(true);
  }
  function next() {
    var st = cur.st, steps = hoSteps(st.dir), s = steps[st.step];
    var nt = $('#hoNote', cur.sh); if (nt) st.note = nt.value;
    var e = check(s.id);
    if (e) { cur.err = e; draw(); return; }
    cur.err = '';
    warnings(s.id).then(function (ok) {
      if (!ok || !cur) return;
      if (st.step < steps.length - 1) { st.step++; cur.resumed = false; persist(); draw(); cur.sh.scrollTop = 0; return; }
      commit();
    });
  }

  /* ---------- saving ---------- */
  function commit() {
    var c0 = cur, st = c0.st, b = c0.b, sh = c0.sh;
    $('#hoBtns', sh).hidden = true; $('#hoSaving', sh).hidden = false;
    var pct = 0, labels = ['Uploading photos...', 'Saving the readings...', 'Updating the booking...'];
    var tick = function () {
      if (!cur || cur !== c0) return;
      pct = Math.min(100, pct + 9 + Math.round(Math.random() * 9));
      var bi = $('#hoBarI', sh), t = $('#hoSavT', sh); if (bi) bi.style.width = pct + '%'; if (t) t.textContent = labels[pct < 55 ? 0 : pct < 85 ? 1 : 2] + ' ' + pct + '%';
      if (pct < 100) later(tick, 110); else later(function () { if (cur === c0) finish(c0); }, 150);
    };
    tick();
  }
  function finish(c0) {
    var st = c0.st, b = c0.b, out = st.dir === 'out', at = hoWhen(st).toISOString(), km = +st.km, c = car(b.car), gps = st.gps || hoGps();
    var trusted = st.trusted !== false;
    S.odometer = S.odometer || [];
    S.odometer.push({ id: uid(), car: b.car, km: km, at: at, source: out ? 'handover' : 'return', by: S.me, trusted: trusted, booking: b.id, note: trusted ? '' : st.whyNot || 'Not trusted' });
    if (c && trusted && km > (+c.km || 0)) c.km = km;
    b.inspection = b.inspection || { agent: null, customer: null };
    if (out) {
      b.inspection.agent = { photos: { handover: ['front', 'back', 'left', 'right'].map(function (k) { return st.car[k]; }), id: st.idPhoto, licence: st.licPhoto, odometer: st.odoPhoto }, km: km, fuel: st.fuel, note: String(st.note || '').trim(), at: at, gps: gps, by: S.me, trusted: trusted };
      b.assigned = b.assigned || []; if (b.assigned.indexOf(S.me) < 0) b.assigned.push(S.me);
      var nt = hoCloseTasks(b, 'out');
      setBookingStatus(b, 'Car Delivered', { text: 'Car handed over at ' + placeText(b, 'pick') + ' (' + st.fuel + ', ' + hoKm(km) + (trusted ? '' : ', km not trusted') + ')' + (nt ? ', task done' : '') });
    } else {
      var lh = hoLateH(b, at);
      b.returnKm = km; b.returnFuel = st.fuel;
      b.inspection.ret = { km: km, fuel: st.fuel, odometer: st.odoPhoto, damage: st.dmg === 'Yes', damagePhotos: st.dmg === 'Yes' ? st.dmgPhotos.slice() : [], damageNote: st.dmg === 'Yes' ? String(st.dmgNote || '').trim() : '', at: at, gps: gps, by: S.me, lateHours: lh, trusted: trusted };
      S.deductions = S.deductions || [];
      Object.keys(st.keep).forEach(function (k) {
        var x = HO_KEEP.filter(function (y) { return y.k === k; })[0], amt = parseMoney(st.keep[k].amt), note = String(st.keep[k].note || '').trim();
        if (!(amt > 0)) return;
        S.deductions.push({ id: uid(), booking: b.id, kind: x.kind, amt: amt, note: note, photo: k === 'Damage' && st.dmgPhotos[0] ? st.dmgPhotos[0] : null, by: S.me, at: new Date().toISOString() });
        bLog(b, 'Deposit adjustment added: ' + x.kind + ' ' + rm(amt) + (note ? ' (' + note + ')' : ''));
      });
      var nt2 = hoCloseTasks(b, 'in');
      setBookingStatus(b, 'Car Returned', { text: 'Car returned at ' + placeText(b, 'ret') + ' (' + st.fuel + ', ' + hoKm(km) + (st.dmg === 'Yes' ? ', new damage noted' : ', no new damage') + (lh ? ', ' + hoHoursText(lh) + ' late' : '') + ')' + (nt2 ? ', task done' : '') });
    }
    save();
    hoDraftDrop(b.id, st.dir);
    cur = null;
    done(b, st.dir, c0.sh);
    render(false, true);
  }

  /* the result screen with the fee card */
  function done(b, dir, sh) {
    var out = dir === 'out', group = out ? 'delivery' : 'return', box = $('#hoBody', sh);
    if (!box || !sh.isConnected) return;
    var drawDone = function () {
      var f = Fees.state(b, group), x = out ? b.inspection.agent : b.inspection.ret;
      var fee = f.kind && f.amt > 0 ? (f.taken ? '<div class="ho-fee taken">' + I('check', 2.4) + '<div class="grow"><b>' + esc(f.kind) + '</b><span>Fee recorded ' + esc(Fees.byText(f.taken)) + '</span></div><b class="money">' + rm(f.taken.amt) + '</b></div>' :
        '<button type="button" class="ho-fee" id="hoFee">' + I('cash') + '<div class="grow"><b>Record my fee</b><span>' + esc(f.kind) + '</span></div><b class="money">' + rm(f.amt) + '</b>' + I('chev') + '</button>') : '';
      var comp = Fees.companionOpen(b) ? '<button type="button" class="btn link" id="hoComp">' + I('users') + 'I came along: record a companion fee</button>' : '';
      box.innerHTML = '<div class="ho-done"><div class="confirm-ic ok">' + I('check', 2.6) + '</div><h3>' + (out ? 'Car handed over' : 'Car returned') + '</h3>' +
        '<p class="lead">' + esc(b.code + ' · ' + ((car(b.car) || {}).plate || '') + ' · ' + cust(b.cust).name) + '</p>' +
        '<div class="ho-sum"><div><span>Odometer</span><b>' + esc(hoKm(x.km)) + (x.trusted === false ? ' ' + chip('Not trusted', 'amber') : '') + '</b></div><div><span>Fuel</span><b>' + esc(x.fuel) + '</b></div><div><span>Time</span><b>' + esc(dShort(x.at) + ', ' + hm(x.at)) + '</b></div>' +
        (out ? '' : '<div><span>Payment status</span><b>' + payChip(b) + '</b></div>' + (x.lateHours ? '<div><span>Late</span><b>' + hoHoursText(x.lateHours) + '</b></div>' : '')) + '</div>' +
        fee + comp + '</div>' +
        '<div class="sheet-foot stack">' + (!out && can('deposits.view') && typeof Deposit !== 'undefined' ? '<button type="button" class="btn ghost" id="hoDep">' + I('shield') + 'Open the deposit</button>' : '') + '<button type="button" class="btn" id="hoDone">Done</button></div>';
      var fb = $('#hoFee', box); if (fb) fb.onclick = function () { Fees.claim(b.id, group, drawDone); };
      var cb = $('#hoComp', box); if (cb) cb.onclick = function () { Fees.claim(b.id, 'companion', drawDone); };
      var dp = $('#hoDep', box); if (dp) dp.onclick = function () { closeSheet(true); setTimeout(function () { Deposit.adjust(b.id); }, 30); };
      $('#hoDone', box).onclick = function () { closeSheet(); };
    };
    drawDone();
    sh.scrollTop = 0;
    say(out ? b.code + ' is on the road' : b.code + ' is back');
  }

  return { start: start, isOpen: function () { return !!cur; } };
})();

/* ---------------- handover and companion fees ---------------- */
var Fees = (function () {
  function feeRow(kind) { return (B().handoverFees || []).filter(function (x) { return x.kind === kind; })[0] || null; }
  function amountFor(kind, staffId) { var f = feeRow(kind); if (!f) return 0; return f.rates && f.rates[staffId] != null ? +f.rates[staffId] : +f.amount || 0; }
  function kindOf(b, group) { return group === 'return' ? handoverKind(b, 'ret') : group === 'delivery' ? handoverKind(b, 'pick') : ''; }
  function fees(b) { return (S.expenses || []).filter(function (e) { return e.agentFee && !e.voided && e.booking === b.id; }); }
  function takenFor(b, kind, group) {
    var f = feeRow(kind), g = (f && f.group) || group, list = fees(b);
    if (g === 'companion') return list.filter(function (e) { return e.kind === kind && e.by === S.me; })[0] || null;
    return list.filter(function (e) { return e.group === g || (feeRow(e.kind) || {}).group === g; })[0] || null;
  }
  function byText(e) { return 'by ' + (e.by === S.me ? 'you' : firstName(who(e.by))) + ' on ' + dShort(e.at); }
  function state(b, group) { var k = kindOf(b, group); return { kind: k, amt: k ? amountFor(k, S.me) : 0, taken: k ? takenFor(b, k, group) : null }; }
  function companionKinds() { return (B().handoverFees || []).filter(function (f) { return f.group === 'companion'; }); }
  function companionOpen(b) { return companionKinds().some(function (f) { return amountFor(f.kind, S.me) > 0 && !takenFor(b, f.kind, 'companion'); }); }

  function claim(bookingId, group, onDone) {
    var b = bk(bookingId); if (!b) return;
    var opts = [];
    if (group !== 'companion') { var k = kindOf(b, group); if (k) opts.push({ kind: k, group: group }); }
    companionKinds().forEach(function (f) { opts.push({ kind: f.kind, group: 'companion' }); });
    opts = opts.map(function (o) { o.amt = amountFor(o.kind, S.me); o.taken = takenFor(b, o.kind, o.group); return o; }).filter(function (o) { return o.amt > 0; });
    var pick = (opts.filter(function (o) { return !o.taken && (group === 'companion' ? o.group === 'companion' : o.group === group); })[0] || opts.filter(function (o) { return !o.taken; })[0] || {}).kind || '';
    var rows = function () {
      return opts.length ? opts.map(function (o) {
        return '<button type="button" class="fee-opt' + (o.taken ? ' taken' : '') + (o.kind === pick ? ' on' : '') + '" data-k="' + esc(o.kind) + '"' + (o.taken ? ' disabled' : '') + '><span class="fee-rad"></span><span class="grow"><b>' + esc(o.kind) + '</b><small>' +
          (o.taken ? 'Already recorded ' + esc(byText(o.taken)) : o.group === 'companion' ? 'For coming along on the trip. Once per person.' : 'One ' + o.group + ' fee per booking') + '</small></span><b class="money">' + rm(o.taken ? o.taken.amt : o.amt) + '</b></button>';
      }).join('') : '<div class="empty">No fee is set for you on this booking. Ask the owner to set your handover fee rates.</div>';
    };
    var sh = sheet(sheetHead('Record my fee', b.code + ' · ' + placeKindText(b, group === 'return' ? 'ret' : 'pick')) +
      '<div class="fee-list" id="feeList">' + rows() + '</div><p class="hint">The amount comes from your rate in the company settings and cannot be changed here. It shows in My money.</p>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="feeSave"' + (pick ? '' : ' disabled') + '>' + I('check', 2.4) + 'Record fee</button></div>', null, { stack: SHEETS.length > 0, cls: 'fee-sheet' });
    var wireRows = function () {
      $$('.fee-opt', sh).forEach(function (el) { el.onclick = function () { if (el.disabled) return; pick = el.dataset.k; $('#feeList', sh).innerHTML = rows(); wireRows(); $('#feeSave', sh).disabled = !pick; }; });
    };
    wireRows();
    $('#feeSave', sh).onclick = function () {
      var o = opts.filter(function (x) { return x.kind === pick; })[0]; if (!o) return;
      var taken = takenFor(b, o.kind, o.group);
      if (taken) { say('Already recorded ' + byText(taken)); return; }
      var now = new Date().toISOString();
      S.expenses = S.expenses || [];
      S.expenses.unshift({ id: uid(), kind: o.kind, amt: o.amt, at: now, car: b.car, booking: b.id, paidWith: 'Cash', paidTo: '', note: '', receipt: null, by: S.me, created: now, agentFee: true, group: o.group, changedBy: null, changedAt: null, voided: false });
      bLog(b, 'Handover fee recorded: ' + o.kind + ' ' + rm(o.amt) + ' (' + myName() + ')');
      save(); closeSheet();
      notify('pay', 'Fee recorded: ' + rm(o.amt), '', '#mymoney', { self: true });
      if (onDone) setTimeout(onDone, 0);
    };
  }
  return { claim: claim, state: state, byText: byText, companionOpen: companionOpen, amountFor: amountFor };
})();

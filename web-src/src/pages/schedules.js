/* ===================================================================
   Page: Schedules (#page=schedules)   Owner: builder 3
   Handovers & Schedules: every delivery / pick-up (rental start) and return / drop-off (rental end) as big cards
   for the front desk and drivers, with the agent handover and the customer photo check the staff send out.
   Address: #page=schedules&tab=all|del|ret&from=2026-10-19&to=2026-10-19  (from=all shows every date)
            &details=ho-KLT-00412-s   &inspect=agent|customer&booking=KLT-00412 (opens the phone preview)
   =================================================================== */
var SC_AGENT_SLOTS = [['handover', 'Car Handover', 'car'], ['idCard', 'Customer ID', 'id'], ['licence', 'Customer Driving Licence', 'license'], ['odometer', 'Odometer Photo', 'gauge']];
var SC_TABS = [{ id: 'all', label: 'All Schedules' }, { id: 'del', label: 'Deliveries only' }, { id: 'ret', label: 'Returns only' }];

function scLabel(h) { return !h.label || h.label === 'Not chosen' ? h.kind : h.label; }
function scStaff(x, d) {
  d = d || D();
  var ids = (x.agentIds || []).slice();
  d.tasks.forEach(function (t) { if (t.booking === x.code) (t.agents || []).forEach(function (a) { if (ids.indexOf(a) < 0) ids.push(a); }); });
  return ids.map(function (id) { return employeeById(id, d); }).filter(Boolean);
}
/* overdue: the handover time passed and the car has not moved yet; urgent: within the next 2 hours */
function scUrgency(h, x) {
  var n = NOW(), done = h.kind === 'Delivery' ? ['Car Delivered', 'Car Returned', 'Completed'].indexOf(x.status) >= 0 : ['Car Returned', 'Completed'].indexOf(x.status) >= 0;
  if (done) return null;
  if (h.at < n) return { tone: 'bad', text: 'Overdue ' + UI.fmt.ago(h.at).replace(/ ago$/, '') };
  if (h.at - n <= 2 * 36e5) return { tone: 'warn', text: 'In ' + mtDur(h.at - n) };
  return null;
}
function scTaskType(h, x) {
  if (h.kind === 'Delivery') return x.startOpt === 'Delivery to KLIA' ? 'Car delivery to KLIA' : x.startOpt === 'Delivery to client location' ? "Car delivery to client's location" : 'Car delivery from our location';
  return x.endOpt === 'Return from KLIA' ? 'Car return from KLIA' : x.endOpt === 'Return from client location' ? "Car return from client's location" : 'Car return to our location';
}
function scInspection(code) { return D().inspections.filter(function (r) { return r.booking === code; })[0] || null; }
/* a made-up photo (canvas) so the flows can be tried without a camera */
function scSamplePhoto(label, k) {
  var c = document.createElement('canvas'); c.width = 640; c.height = 400;
  var g = c.getContext('2d'), hues = [210, 25, 145, 280, 0, 190, 45, 330, 100, 260], h = hues[(k || 0) % hues.length];
  var gr = g.createLinearGradient(0, 0, 640, 400); gr.addColorStop(0, 'hsl(' + h + ',35%,38%)'); gr.addColorStop(1, 'hsl(' + h + ',30%,22%)');
  g.fillStyle = gr; g.fillRect(0, 0, 640, 400);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(120, 190, 400, 90); g.fillRect(190, 140, 250, 60);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(210, 285, 34, 0, 7); g.arc(430, 285, 34, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 22px sans-serif'; g.fillText('SAMPLE PHOTO', 24, 40);
  g.font = '18px sans-serif'; g.fillText(String(label || '').toUpperCase() + ' · MADE-UP DEMO', 24, 68);
  return { name: String(label || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.jpg', dataUrl: c.toDataURL('image/jpeg', .7), size: 42000 };
}

/* ---------------- the details dialog ---------------- */
function scDetails(h, ctx) {
  var x = findBooking(h.booking); if (!x) return null;
  var money = can('bookings.see_amounts') || can('calendar.see_amounts'), staff = scStaff(x), c = x.car;
  var sec = function (t, b) { return '<section class="sc-dsec"><h3>' + t + '</h3>' + b + '</section>'; };
  var row = function (l, v, cls) { return '<div class="sc-mrow' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
  var body = sec('Customer information', '<div class="sc-who">' + UI.avatar(x.cust.name) + '<div><b>' + esc(x.cust.name) + '</b><span>' + esc(x.cust.email || '') + '</span>' + UI.phone(x.cust.phone, { wa: true }) + '</div></div>' +
      '<a class="btn o sm sc-wa" href="https://wa.me/' + String(x.cust.phone || '').replace(/\D/g, '') + '" target="_blank" rel="noopener">' + i('brand-whatsapp') + 'Open WhatsApp Chat</a>') +
    sec('Assigned vehicle', '<div class="sc-car">' + carsThumb(c, 'sc-ph') + '<div><b>' + esc(carName(c)) + '</b><span class="sc-plate">' + esc(c.plate) + '</span><span>' + esc(c.color) + '</span></div></div>') +
    sec('Schedule and note details', '<div class="sc-kv">' + UI.kv(h.kind === 'Delivery' ? 'Starting date and time' : 'Ending date and time', UI.fmt.dateTime(h.at)) + UI.kv('Handover', esc(scLabel(h))) +
      UI.kv('Assigned staff', staff.length ? staff.map(function (e2) { return esc(e2.name); }).join(', ') : 'No staff assigned') + UI.kv(h.kind === 'Delivery' ? 'Delivery / pickup note' : 'Return / drop-off note', esc(h.note || '-')) + '</div>') +
    (money ? sec('Financial details', '<div class="sc-money">' + row('Rental Duration', plural(x.days, 'day')) + row('Total Rent', UI.money(x.rent)) + row('Security Deposit', UI.money(x.dep)) + row('Delivery Charge', UI.money(x.deliv)) + row('Return Charge', UI.money(x.ret)) +
      row('Others Charge', UI.money(x.others || 0)) + (x.dmg ? row('Damage cover', UI.money(x.dmg)) : '') + row('Discount', x.disc ? '- ' + UI.money(x.disc) : UI.money(0), x.disc ? 'neg' : '') + row('Total Amount', UI.money(x.payable), 'tot') + row('Received so far', UI.money(DB.received(x.code) || x.received || 0)) + '</div>') : '');
  return UI.dialog({ title: h.kind === 'Delivery' ? 'Delivery - Booking ID ' + x.code : 'Return - Booking ID ' + x.code, subtitle: scLabel(h), width: 'md', body: '<div class="sc-det">' + body + '</div>',
    onClose: ctx && ctx.onClose,
    buttons: [{ label: 'Close', kind: 'g' }].concat(can('bookings.view') ? [{ label: 'Go to Booking', icon: 'external-link', onClick: function () { API.openBooking(x.code); } }] : []) });
}

/* ---------------- the phone flows: agent handover and customer photo check ---------------- */
function scFlow(kind, code, onClose) {
  var x = findBooking(code); if (!x) { UI.toast('Booking not found', { tone: 'bad' }); return null; }
  var f = { kind: kind, url: siteLink(x, kind), step: 'entry', photos: {}, notes: '', list: [], agree: false, c1: false, c2: false, err: '', busy: false, demo: '' };
  var agentSteps = [['entry', 'circle-check', 'Entry'], ['capture', 'camera', 'Capture'], ['success', 'circle-check', 'Success']];
  var custSteps = [['entry', 'circle-check', 'Entry'], ['instructions', 'list-check', 'Instructions'], ['capture', 'camera', 'Capture'], ['agreement', 'writing-sign', 'Agreement'], ['success', 'circle-check', 'Success']];
  var steps = kind === 'agent' ? agentSteps : custSteps, co = (D().company || {}).trading || B().name;
  var tokenOk = function () { var u = f.url.trim(); return kind === 'agent' ? u.split('/').pop() === x.agentToken : u.split('/').pop() === x.formId; };
  var ins = function () { return scInspection(x.code); };
  var stepper = function () {
    var at = steps.map(function (s) { return s[0]; }).indexOf(f.step);
    return '<div class="sc-step">' + steps.map(function (s, k) { return '<span class="' + (k < at ? 'done' : k === at ? 'on' : '') + '" title="' + s[2] + '">' + i(k < at ? 'circle-check' : s[1]) + '</span>'; }).join('<em></em>') + '</div><div class="sc-stepn">Step ' + (at + 1) + ': ' + esc(steps[at][2]) + '</div>';
  };
  var screen = function (icon, title, text, extra, tone) { return '<div class="sc-scr"><div class="sc-big ' + (tone || '') + '">' + i(icon) + '</div><h2>' + title + '</h2><p>' + text + '</p>' + (extra || '') + '</div>'; };
  var pbtn = function (label, act, o) { o = o || {}; return '<button type="button" class="sc-pb' + (o.ghost ? ' gh' : '') + '" data-f="' + act + '"' + (o.disabled ? ' disabled' : '') + '>' + label + '</button>'; };
  function body() {
    var h = '';
    if (f.demo === 'error') return screen('alert-circle', 'An Error Occurred', 'Something went wrong while loading this inspection. Please try again.', pbtn('Try Again', 'retry'), 'bad');
    if (!tokenOk()) return kind === 'agent' ? screen('link-off', 'Invalid Link', 'Invalid or unknown agent token. Please check your link.', '', 'bad') : screen('link-off', 'Invalid Link', 'This inspection link is not valid or has expired. Please contact your rental agent for a valid link.', '', 'bad');
    var r = ins();
    if (f.step === 'entry') {
      if (kind === 'agent' && r && r.agentAt) f.step = 'success';
      if (kind === 'customer' && r && r.custAt) f.step = 'success';
    }
    if (f.step === 'success') {
      r = ins();
      h = screen('circle-check', 'Inspection Submitted!', 'Your vehicle condition report has been recorded', '<div class="sc-sum"><div><span>Inspection ID</span><b class="sc-red">' + esc(r ? r.id : '') + '</b></div>' + (kind === 'customer' ? '<div><span>Booking ID</span><b>' + x.code + '</b></div>' : '') + '<div><span>Status</span><b class="sc-ok">Submitted</b></div>' +
        (kind === 'customer' && r && r.custAt ? '<div><span>Submitted at</span><b>' + UI.fmt.dateTime(r.custAt) + '</b></div>' : kind === 'agent' && r && r.agentAt ? '<div><span>Submitted at</span><b>' + UI.fmt.dateTime(r.agentAt) + '</b></div>' : '') + '</div>' +
        (kind === 'customer' ? pbtn(i('download') + 'Download PDF', 'pdf') : ''), 'ok');
      return stepper() + h;
    }
    if (f.step === 'entry') {
      if (kind === 'agent') return stepper() + '<div class="sc-scr"><div class="sc-logo">' + carSVG(x.car.color, x.car.shape, { label: carName(x.car) }) + '</div><h2>Agent Handover Verification</h2><p>Please verify the customer\'s identity and capture the handover photo.</p>' +
        '<label class="sc-fl">Verification Token</label><div class="sc-ro"><span>' + esc(x.agentToken) + '</span>' + i('circle-check') + '</div>' +
        '<div class="sc-warn">' + i('alert-triangle') + 'You must check the customer\'s ID and Driving Licence before handing over the keys.</div>' + pbtn('Start Verification', 'start') + '</div>';
      if (!r || !r.agentAt) return stepper() + screen('clock-hour-4', 'Waiting for Agent', 'The agent has not completed the handover verification yet. Please wait for the agent to finish before starting your vehicle check.', pbtn(i('refresh') + 'Refresh Status', 'refresh') + '<button type="button" class="sc-lk" data-f="openagent">Staff: open the agent handover for this booking</button>', 'warn');
      return stepper() + '<div class="sc-scr"><div class="sc-logo">' + carSVG(x.car.color, x.car.shape, { label: carName(x.car) }) + '</div><h2>Vehicle Condition Check</h2><p>Please complete the inspection when you receive the vehicle.</p>' +
        '<label class="sc-fl">Booking ID</label><div class="sc-ro"><span>' + x.code + '</span>' + i('circle-check') + '</div>' +
        '<div class="sc-warn">' + i('clock') + 'You must complete this inspection within 15 minutes of vehicle handover.</div>' + pbtn('Start Inspection', 'start') +
        '<p class="sc-help">Need help? <a href="https://wa.me/' + String(B().phone || '').replace(/\D/g, '') + '" target="_blank" rel="noopener">Contact WhatsApp</a></p></div>';
    }
    if (kind === 'agent' && f.step === 'capture') {
      var n = SC_AGENT_SLOTS.filter(function (s) { return f.photos[s[0]]; }).length;
      return stepper() + '<div class="sc-scr left"><h2>Capture Verification Photos</h2><p>Please capture the required photos to complete the handover verification.</p>' +
        SC_AGENT_SLOTS.map(function (s, k) {
          var p = f.photos[s[0]];
          return '<label class="sc-fl">' + s[1] + '</label>' + (p ? '<div class="sc-slot ok"><img src="' + p.dataUrl + '" alt="' + s[1] + '"><span class="sc-capd">' + i('check') + 'Photo Captured</span><button type="button" class="sc-del" data-f="del" data-k="' + s[0] + '" aria-label="Remove ' + s[1] + '">' + i('trash') + '</button></div>' :
            '<div class="sc-slot"><label class="sc-tap">' + i('camera') + '<span>Tap to Capture</span><input type="file" accept="image/*" capture="environment" hidden data-file="' + s[0] + '"></label><button type="button" class="sc-lk" data-f="sample" data-k="' + s[0] + '" data-n="' + k + '">Use a sample photo</button></div>');
        }).join('') +
        '<label class="sc-fl" for="sc-an">Notes (Optional)</label><textarea id="sc-an" class="sc-ta" rows="3" placeholder="Any additional notes about the handover?" data-f="notes">' + esc(f.notes) + '</textarea>' +
        (f.err ? '<div class="sc-err">' + i('alert-circle') + esc(f.err) + '</div>' : '') + pbtn(f.busy ? 'Submitting...' : 'Submit Verification (' + n + ' of 4)', 'submit', { disabled: f.busy }) + '</div>';
    }
    if (f.step === 'instructions') return stepper() + '<div class="sc-scr left"><h2>Before You Start</h2><ul class="sc-ins"><li>' + i('sun') + 'Take clear and well-lit photos</li><li>' + i('clock') + 'Complete within 15 minutes of handover</li><li>' + i('rotate-360') + 'Ensure all angles are clearly visible</li></ul>' +
      '<label class="sc-chk"><input type="checkbox" data-f="agree"' + (f.agree ? ' checked' : '') + '><span>I understand and agree to the inspection terms and conditions of the rental service.</span></label>' + pbtn('Proceed', 'proceed', { disabled: !f.agree }) + '</div>';
    if (f.step === 'capture') {
      return stepper() + '<div class="sc-scr left"><div class="sc-hrow"><button type="button" class="sc-back" data-f="back" aria-label="Back">' + i('arrow-left') + '</button><h2>Capture Photos</h2></div>' +
        '<div class="sc-err soft">' + i('alert-circle') + 'Take photos if you see any issues with the car and note it. You can capture up to 10 photos.</div>' +
        f.list.map(function (p, k) { return '<div class="sc-ph-card"><img src="' + p.dataUrl + '" alt="Photo ' + (k + 1) + '"><div class="sc-ph-h"><span>Photo #' + (k + 1) + '</span><button type="button" class="sc-del in" data-f="rm" data-k="' + k + '" aria-label="Remove photo ' + (k + 1) + '">' + i('trash') + '</button></div><textarea class="sc-ta" rows="2" data-note="' + k + '" placeholder="Describe any issues, scratches, or notes for this photo (optional)...">' + esc(p.note || '') + '</textarea></div>'; }).join('') +
        (f.list.length < 10 ? '<div class="sc-addp"><label class="sc-tap row">' + i('camera') + '<span>Capture Photo</span><input type="file" accept="image/*" capture="environment" multiple hidden data-file="list"></label><button type="button" class="sc-lk" data-f="samplelist">Use a sample photo</button></div>' : '') +
        (f.err ? '<div class="sc-err">' + i('alert-circle') + esc(f.err) + '</div>' : '') +
        '<div class="sc-two">' + pbtn('Back', 'back', { ghost: true }) + pbtn('Confirm & Continue (' + plural(f.list.length, 'Photo') + ')', 'confirm', { disabled: !f.list.length }) + '</div></div>';
    }
    if (f.step === 'agreement') return stepper() + '<div class="sc-scr left"><h2>Final Confirmation</h2><p>I confirm that the photos provided accurately represent the condition of the vehicle at the time of this inspection.</p>' +
      '<label class="sc-chk"><input type="checkbox" data-f="c1"' + (f.c1 ? ' checked' : '') + '><span>I have completed the inspection on time.</span></label><label class="sc-chk"><input type="checkbox" data-f="c2"' + (f.c2 ? ' checked' : '') + '><span>Photos are authentic and unedited.</span></label>' +
      (f.err ? '<div class="sc-err">' + i('alert-circle') + esc(f.err) + '</div>' : '') +
      '<div class="sc-two">' + pbtn('Back', 'back2', { ghost: true }) + pbtn(f.busy ? 'Submitting...' : 'Submit Final Inspection', 'final', { disabled: !(f.c1 && f.c2) || f.busy }) + '</div></div>';
    return '';
  }
  function frame() {
    return '<div class="sc-prev"><p class="sc-pnote">' + i('device-mobile') + (kind === 'agent' ? 'What the staff member sees on their phone at the handover.' : 'What the customer sees on their phone after the handover.') + ' Saved for real in this sample.</p>' +
      '<div class="sc-phone"><div class="sc-url">' + i('lock') + '<input type="text" value="' + esc(f.url) + '" aria-label="Link" data-f="url" spellcheck="false"><button type="button" data-f="go" aria-label="Open link">' + i('arrow-right') + '</button></div>' +
      '<div class="sc-pbody">' + body() + '<div class="sc-foot">© ' + NOW().getFullYear() + ' ' + esc(co) + '. All rights reserved.</div></div></div></div>';
  }
  var dl = UI.dialog({ title: kind === 'agent' ? 'Agent handover · ' + x.code : 'Customer photo check · ' + x.code, subtitle: x.cust.name + ' · ' + x.car.plate, width: 460, body: frame, onClose: onClose,
    actions: '', buttons: [{ label: 'Copy link', kind: 'o', icon: 'copy', onClick: function () { UI.copy(siteLink(x, kind), { label: 'Link copied' }); return false; } }, { label: 'Close', kind: 'g' }] });
  var draw = function () { var sc = dl.body.scrollTop; dl.setBody(frame); dl.body.scrollTop = sc; };
  var top = function () { dl.setBody(frame); dl.body.scrollTop = 0; var pb = dl.body.querySelector('.sc-pbody'); if (pb) pb.scrollTop = 0; };
  var addFiles = function (files, slot) {
    var list = Array.prototype.slice.call(files || []);
    if (slot === 'list' && f.list.length + list.length > 10) { f.err = 'A maximum of 10 photos is allowed.'; list = list.slice(0, 10 - f.list.length); }
    Promise.all(list.map(function (file) { return mtReadFile(file, 1200); })).then(function (rs) {
      rs.forEach(function (r) { if (slot === 'list') f.list.push({ name: r.name, dataUrl: r.dataUrl, note: '', at: NOW() }); else f.photos[slot] = r; });
      if (slot !== 'list') f.err = ''; draw();
    }, function (e) { UI.toast(e.message || 'Could not read that picture', { tone: 'bad' }); });
  };
  UI.on(dl.body, 'change', 'input[data-file]', function (ev, el) { addFiles(el.files, el.getAttribute('data-file')); });
  UI.on(dl.body, 'input', '[data-note]', function (ev, el) { var p = f.list[+el.getAttribute('data-note')]; if (p) p.note = el.value; });
  UI.on(dl.body, 'input', '[data-f="notes"]', function (ev, el) { f.notes = el.value; });
  UI.on(dl.body, 'change', 'input[type=checkbox][data-f]', function (ev, el) { f[el.getAttribute('data-f')] = el.checked; f.err = ''; draw(); });
  UI.on(dl.body, 'keydown', '[data-f="url"]', function (ev, el) { if (ev.key === 'Enter') { f.url = el.value; f.step = 'entry'; f.demo = ''; top(); } });
  UI.on(dl.body, 'click', 'button[data-f]', function (ev, el) {
    var a = el.getAttribute('data-f'), r;
    if (a === 'go') { f.url = dl.body.querySelector('[data-f="url"]').value; f.step = 'entry'; f.demo = ''; top(); return; }
    if (a === 'retry') { f.demo = ''; top(); return; }
    if (a === 'start') { f.step = kind === 'agent' ? 'capture' : 'instructions'; top(); return; }
    if (a === 'refresh') { r = ins(); UI.toast(r && r.agentAt ? 'The agent has finished. You can start now.' : 'Still waiting for the agent', { tone: r && r.agentAt ? 'ok' : 'info' }); draw(); return; }
    if (a === 'openagent') { dl.close(); scFlow('agent', x.code); return; }
    if (a === 'sample') { var k = el.getAttribute('data-k'); f.photos[k] = scSamplePhoto(SC_AGENT_SLOTS[+el.getAttribute('data-n')][1], +el.getAttribute('data-n')); f.err = ''; draw(); return; }
    if (a === 'samplelist') { if (f.list.length >= 10) { f.err = 'A maximum of 10 photos is allowed.'; draw(); return; } var sp = scSamplePhoto(['Front bumper', 'Left side', 'Right side', 'Rear', 'Dashboard', 'Rim', 'Windscreen', 'Boot', 'Roof', 'Interior'][f.list.length], f.list.length + 3); f.list.push({ name: sp.name, dataUrl: sp.dataUrl, note: '', at: NOW() }); f.err = ''; draw(); return; }
    if (a === 'del') { delete f.photos[el.getAttribute('data-k')]; draw(); return; }
    if (a === 'rm') { f.list.splice(+el.getAttribute('data-k'), 1); f.err = ''; draw(); return; }
    if (a === 'proceed') { f.step = 'capture'; top(); return; }
    if (a === 'back') { f.step = 'instructions'; f.err = ''; top(); return; }
    if (a === 'back2') { f.step = 'capture'; f.err = ''; top(); return; }
    if (a === 'confirm') { if (!f.list.length) { f.err = 'At least one photo is required before submitting.'; draw(); return; } f.step = 'agreement'; f.err = ''; top(); return; }
    if (a === 'submit') {
      var miss = SC_AGENT_SLOTS.filter(function (s) { return !f.photos[s[0]]; });
      if (miss.length) { f.err = 'Please capture ' + miss.map(function (s) { return s[1]; }).join(', ') + '.'; draw(); return; }
      f.busy = true; draw();
      setTimeout(function () {
        var agent = {}, imgs = {}; SC_AGENT_SLOTS.forEach(function (s) { agent[s[0]] = f.photos[s[0]].name; imgs[s[0]] = f.photos[s[0]].dataUrl; });
        r = ins(); var pos = CITY_POS[B().id] || CITY_POS.mine;
        if (r) DB.update('inspections', r, { agent: agent, agentImgs: imgs, agentAt: NOW(), note: f.notes || r.note }, { where: 'Booking', text: DB.actor() + ' sent the agent handover for ' + x.code });
        else DB.add('inspections', { id: 'ins-' + Math.random().toString(16).slice(2, 10), booking: x.code, gps: (pos[0] + .0123).toFixed(5) + ', ' + (pos[1] - .0087).toFixed(5), agentAt: NOW(), custAt: null, photos: [], agent: agent, agentImgs: imgs, note: f.notes }, { where: 'Booking', text: DB.actor() + ' sent the agent handover for ' + x.code });
        f.busy = false; f.step = 'success'; top();
      }, 500);
      return;
    }
    if (a === 'final') {
      f.busy = true; draw();
      setTimeout(function () {
        r = ins();
        var photos = f.list.map(function (p, k) { return { name: 'photo-' + (k + 1) + '.jpg', at: p.at, note: p.note || '', dataUrl: p.dataUrl }; });
        if (r) DB.update('inspections', r, { photos: photos, custAt: NOW() }, { where: 'Booking', text: x.cust.name + ' sent the photo check for ' + x.code });
        if (['Pending', 'Confirmed', 'Agreement Sent', 'Agreement Signed'].indexOf(x.status) >= 0) DB.update('bookings', x, { status: 'Car Delivered', inspected: true }, { text: 'The photo check moved booking ' + x.code + ' to Car Delivered' });
        else DB.update('bookings', x, { inspected: true }, { silent: true });
        f.busy = false; f.step = 'success'; top();
      }, 600);
      return;
    }
    if (a === 'pdf') { scInspectionPdf(x); return; }
  });
  dl.setActions(UI.iconBtn('dots-vertical', 'Preview other states', { size: 'sm', attrs: { 'data-sc': 'states' } }));
  UI.on(dl.el, 'click', '[data-sc="states"]', function (ev, el) {
    UI.menu(el, [{ header: 'Preview other states' },
      { label: 'Invalid link', icon: 'link-off', onClick: function () { f.url = f.url.replace(/[^/]+$/, 'not-a-real-link'); f.demo = ''; top(); } },
      { label: 'An error occurred', icon: 'alert-circle', onClick: function () { f.demo = 'error'; top(); } },
      { label: 'Back to the real link', icon: 'link', onClick: function () { f.url = siteLink(x, kind); f.demo = ''; f.step = 'entry'; top(); } }]);
  });
  return dl;
}
/* the inspection report PDF the customer downloads (page 2 of the agreement: photos, notes, agent verification) */
function scInspectionPdf(x) {
  var r = scInspection(x.code) || { photos: [], agent: {}, agentImgs: {} };
  return UI.pdf('Inspection_' + x.code + '.pdf', function (doc, kit) {
    kit.header({ title: 'INSPECTION REPORT', lines: [x.code, 'Inspection ' + (r.id || '-'), UI.fmt.dateTime(r.custAt || NOW())] });
    kit.parties([{ title: 'RENTER', lines: [x.cust.name, x.cust.phone, x.cust.email || ''] }, { title: 'VEHICLE', lines: [x.car.plate, carName(x.car), x.car.color] }, { title: 'PERIOD', lines: [UI.fmt.dateTime(x.start), 'to ' + UI.fmt.dateTime(x.end), 'GPS ' + (r.gps || '-')] }]);
    kit.font(11, 'bold', kit.primary); kit.text('VEHICLE INSPECTION AND HANDOVER REPORT', kit.M, kit.y); kit.y += 6;
    kit.table({ columns: [{ label: '#', w: 10 }, { label: 'Photo', w: 40 }, { label: 'Taken', w: 40 }, { label: 'Note', w: 90 }], rows: (r.photos || []).length ? r.photos.map(function (p, k) { return ['#' + (k + 1), p.name, UI.fmt.dateTime(p.at), p.note || '-']; }) : [['', 'No photo', '', '']] });
    var cw = (kit.W - 2 * kit.M - 8) / 3, ch = cw * .62, n = 0;
    (r.photos || []).forEach(function (p, k) {
      if (!p.dataUrl) return;
      if (n % 3 === 0) { kit.ensure(ch + 10); }
      var xx = kit.M + (n % 3) * (cw + 4);
      try { doc.addImage(p.dataUrl, 'JPEG', xx, kit.y, cw, ch); } catch (e) { }
      kit.font(8, 'normal'); kit.text('Photo #' + (k + 1), xx, kit.y + ch + 4);
      n++; if (n % 3 === 0) kit.y += ch + 8;
    });
    if (n % 3) kit.y += ch + 8;
    kit.ensure(40);
    kit.font(11, 'bold', kit.primary); kit.text('AGENT HANDOVER VERIFICATION', kit.M, kit.y + 2); kit.y += 8;
    kit.table({ columns: [{ label: 'Item', w: 60 }, { label: 'File', w: 80 }, { label: 'Status', w: 40 }], rows: SC_AGENT_SLOTS.map(function (s) { var v = r.agent && r.agent[s[0]]; return [s[1], v || '-', v ? 'Captured' : 'Missing']; }) });
    kit.font(9.5, 'normal'); kit.y = kit.wrap('Agent notes: ' + (r.note || '-'), kit.M, kit.y + 4, kit.W - 2 * kit.M) + 2;
  });
}

PAGES['schedules'] = {
  title: 'Handovers & Schedules',
  render: function (root, ctx) {
    var st = ctx.state, p = ctx.params, d = ctx.data, money = ctx.can('bookings.see_amounts') || ctx.can('calendar.see_amounts');
    var today = UI.isoDate(NOW());
    if (p.tab && ['all', 'del', 'ret'].indexOf(p.tab) >= 0) st.tab = p.tab; st.tab = st.tab || 'all';
    if (p.from === 'all') { st.from = ''; st.to = ''; } else if (p.from) { st.from = p.from; st.to = p.to || p.from; }
    if (st.from == null) { st.from = today; st.to = today; }
    st.q = st.q || ''; st.limit = st.limit || 20;

    root.innerHTML = '<div class="pg-h"><div><h1>Handovers &amp; Schedules</h1><p>Real-time tracking of upcoming vehicle handovers, deliveries, and returns.</p></div></div>' +
      '<div class="sc-stats" id="sc-stats"></div>' +
      '<div class="card sc-tools"><div id="sc-tabs"></div><div class="sc-fil">' + UI.input({ key: 'q', label: 'Search', type: 'search', placeholder: 'Customer, booking, plate...', value: st.q }) +
      '<div class="sc-range"><span class="sc-rl">Date Range</span><div class="sc-rin">' + UI.input({ key: 'from', type: 'date', value: st.from, attrs: {} }) + '<span>-</span>' + UI.input({ key: 'to', type: 'date', value: st.to }) + '</div></div>' +
      UI.btn('Clear Date', { kind: 'tonal', size: 'sm', attrs: { 'data-sc': 'clear' } }) + '</div></div><div id="sc-list" class="sc-list"></div>';
    var listEl = root.querySelector('#sc-list');
    root.querySelector('[data-key="from"]').setAttribute('aria-label', 'From date');
    root.querySelector('[data-key="to"]').setAttribute('aria-label', 'To date');

    function base() {
      var q = st.q.trim().toLowerCase(), from = st.from ? UI.parseDate(st.from) : null, to = st.to ? new Date(UI.parseDate(st.to).getTime() + DAY - 1) : null;
      return handovers(d).filter(function (h) {
        if (from && h.at < from) return false; if (to && h.at > to) return false;
        if (!q) return true;
        var x = findBooking(h.booking); if (!x) return false;
        return [x.code, x.cust.name, x.cust.phone, x.cust.email, x.car.plate, carName(x.car), scLabel(h), h.note, x.status, x.pay].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    function card(h) {
      var x = findBooking(h.booking); if (!x) return '';
      var u = scUrgency(h, x), staff = scStaff(x), c = x.car, del = h.kind === 'Delivery';
      var row = function (l, v, cls) { return '<div class="sc-mrow' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
      var fb = function (icon, label, attrs, dis) { return '<button type="button" class="sc-fb"' + attrs + (dis ? ' disabled title="' + dis + '"' : '') + '>' + i(icon) + '<span>' + label + '</span></button>'; };
      return '<article class="card sc-card' + (u && u.tone === 'bad' ? ' bad' : u ? ' warn' : '') + '" data-ho="' + h.id + '">' +
        '<header class="sc-ch"><span class="sc-kind ' + (del ? 'del' : 'ret') + '">' + esc(scLabel(h)) + '</span><span class="sc-id">Booking ID: ' + x.code + '</span>' + (u ? UI.chip(u.text, u.tone) : '') + '<span class="grow"></span>' + UI.status('booking', x.status) + UI.chip('Payment: ' + (x.pay || 'None'), PAY_COLORS[x.pay] || 'grey') + '</header>' +
        '<div class="sc-cb"><div class="sc-cust"><div class="sc-who">' + UI.avatar(x.cust.name) + '<div><b>' + esc(x.cust.name) + '</b><span>' + esc(x.cust.email || '') + '</span>' + UI.phone(x.cust.phone, { wa: true }) + '</div></div>' +
        '<div class="sc-cap">Assigned staff</div><div class="sc-staff">' + i('user') + (staff.length ? staff.map(function (e2) { return esc(e2.name); }).join(', ') : '<span class="faint">No staff assigned</span>') + '</div></div>' +
        '<div class="sc-car">' + carsThumb(c, 'sc-ph') + '<div><b>' + esc(carName(c)) + '</b><span class="sc-plate">' + esc(c.plate) + '</span><span>' + esc(c.color) + '</span></div></div>' +
        '<div class="sc-when"><div class="sc-wi">' + i('clock') + '<div><div class="sc-cap">' + (del ? 'Starting date & time' : 'Ending date & time') + '</div><b>' + UI.fmt.date(h.at) + ' at ' + tm(h.at) + '</b><small>' + esc(UI.fmt.inDays(h.at)) + '</small></div></div>' +
        '<div class="sc-wi">' + i('notes') + '<div><div class="sc-cap">' + (del ? 'Delivery / pickup note' : 'Return / drop-off note') + '</div><span>' + esc(h.note || '-') + '</span></div></div></div>' +
        (money ? '<div class="sc-money">' + row('Total Rent', UI.money(x.rent)) + row('Security Deposit', UI.money(x.dep)) + (x.deliv ? row('Delivery Charge', UI.money(x.deliv)) : '') + (x.ret || !del ? row('Return Charge', UI.money(x.ret)) : '') + (x.disc ? row('Discount', '- ' + UI.money(x.disc), 'neg') : '') + (x.others ? row('Others', UI.money(x.others)) : '') + row('Total Amount', UI.money(x.payable), 'tot') + '</div>' : '') + '</div>' +
        '<footer class="sc-cf"><button type="button" class="sc-more" data-act="details">View Complete Details</button><span class="grow"></span>' +
        fb('calendar-plus', 'Assign Task', ' data-act="task"', ctx.can('tasks.create') ? '' : 'You cannot add tasks') +
        (ctx.can('inspections.view') ? '<span class="sc-pair">' + fb('scan', 'Agent Inspection Link', ' data-act="agentlink"') + UI.iconBtn('device-mobile', 'Open the agent handover', { size: 'sm', attrs: { 'data-act': 'agent' } }) + '</span>' +
          '<span class="sc-pair">' + fb('link', 'Customer Inspection Link', ' data-act="custlink"') + UI.iconBtn('device-mobile', 'Open the customer photo check', { size: 'sm', attrs: { 'data-act': 'customer' } }) + '</span>' : '') +
        (ctx.can('bookings.view') ? '<button type="button" class="sc-go" data-act="booking">' + i('external-link') + 'Go to Booking</button>' : '') + '</footer></article>';
    }
    function draw() {
      var all = base(), dels = all.filter(function (h) { return h.kind === 'Delivery'; }), rets = all.filter(function (h) { return h.kind === 'Return'; }), up = all.filter(function (h) { return h.at >= NOW(); });
      root.querySelector('#sc-stats').innerHTML = [['del', dels.length, 'Deliveries', 'truck-delivery', 'bad'], ['ret', rets.length, 'Returns', 'arrow-back-up', 'grey'], ['all', up.length, 'Upcoming', 'list-details', 'info']].map(function (s) {
        return UI.stat({ value: s[1], label: s[2], icon: s[3], tone: s[4], attrs: { 'data-stat': s[0], 'aria-pressed': String(st.tab === s[0]), title: 'Show ' + s[2].toLowerCase() } });
      }).join('');
      UI.tabs(root.querySelector('#sc-tabs'), { items: SC_TABS.map(function (t) { return { id: t.id, label: t.label, count: t.id === 'all' ? all.length : t.id === 'del' ? dels.length : rets.length }; }), value: st.tab, onChange: function (id) { st.tab = id; st.limit = 20; ctx.setParams({ tab: id }, true); draw(); } });
      var rows = st.tab === 'del' ? dels : st.tab === 'ret' ? rets : all;
      if (!rows.length) { listEl.innerHTML = '<div class="card">' + UI.empty({ icon: 'calendar-off', title: 'No schedules found', text: 'Try updating your filters or search terms.', action: st.from ? UI.btn('Show every date', { kind: 'o', size: 'sm', attrs: { 'data-sc': 'clear' } }) : '' }) + '</div>'; return; }
      listEl.innerHTML = rows.slice(0, st.limit).map(card).join('') + (rows.length > st.limit ? '<div class="sc-moreb">' + UI.btn('Show ' + Math.min(20, rows.length - st.limit) + ' more (' + (rows.length - st.limit) + ' left)', { kind: 'o', attrs: { 'data-sc': 'more' } }) + '</div>' : '') +
        '<p class="sc-count">Showing ' + Math.min(st.limit, rows.length) + ' of ' + plural(rows.length, 'handover') + (st.from ? ', ' + (st.from === st.to ? UI.fmt.date(UI.parseDate(st.from)) : UI.fmt.date(UI.parseDate(st.from)) + ' to ' + UI.fmt.date(UI.parseDate(st.to))) : ', every date') + '.</p>';
    }
    draw();

    var tq;
    UI.on(root, 'input', '[data-key="q"]', function (ev, el) { clearTimeout(tq); tq = setTimeout(function () { st.q = el.value; st.limit = 20; draw(); }, 150); });
    UI.on(root, 'change', '[data-key="from"],[data-key="to"]', function (ev, el) {
      var k = el.getAttribute('data-key'); st[k] = el.value;
      if (st.from && !st.to) st.to = st.from; if (st.to && !st.from) st.from = st.to;
      if (st.from && st.to && st.to < st.from) { if (k === 'from') st.to = st.from; else st.from = st.to; }
      root.querySelector('[data-key="from"]').value = st.from; root.querySelector('[data-key="to"]').value = st.to;
      st.limit = 20; ctx.setParams({ from: st.from || 'all', to: st.to || null }, true); draw();
    });
    UI.on(root, 'click', '[data-sc]', function (ev, el) {
      var a = el.getAttribute('data-sc');
      if (a === 'clear') { st.from = ''; st.to = ''; root.querySelector('[data-key="from"]').value = ''; root.querySelector('[data-key="to"]').value = ''; st.limit = 20; ctx.setParams({ from: 'all', to: null }, true); draw(); }
      if (a === 'more') { st.limit += 20; draw(); }
    });
    UI.on(root, 'click', '[data-stat]', function (ev, el) { st.tab = el.getAttribute('data-stat'); st.limit = 20; ctx.setParams({ tab: st.tab }, true); draw(); });
    UI.on(listEl, 'click', '[data-act]', function (ev, el) {
      var h = byId(handovers(d), el.closest('[data-ho]').getAttribute('data-ho')); if (!h) return;
      var x = findBooking(h.booking), a = el.getAttribute('data-act');
      if (a === 'details') { ctx.setParams({ details: h.id }); scDetails(h, { onClose: function () { if (S.params.details === h.id) ctx.setParams({ details: null }); } }); }
      if (a === 'task') ctx.api.newTask({ booking: x.code, name: (h.kind === 'Delivery' ? 'Deliver ' : 'Collect ') + x.car.plate + ' (' + x.code + ')', type: scTaskType(h, x), at: h.at });
      if (a === 'agentlink') UI.copy(siteLink(x, 'agent'), { label: 'Agent inspection link copied' });
      if (a === 'custlink') UI.copy(siteLink(x, 'customer'), { label: 'Customer inspection link copied' });
      if (a === 'agent' || a === 'customer') { ctx.setParams({ inspect: a, booking: x.code }); scFlow(a, x.code, function () { if (S.params.inspect) ctx.setParams({ inspect: null, booking: null }); }); }
      if (a === 'booking') ctx.api.openBooking(x.code);
    });
    b3Open(ctx, 'details', function (v, onClose) { var h = byId(handovers(d), v); return h ? scDetails(h, { onClose: onClose }) : null; });
    if (p.inspect && p.booking) b3Open(ctx, 'booking', function (v, onClose) { return scFlow(p.inspect === 'customer' ? 'customer' : 'agent', v, function () { ctx.setParams({ inspect: null }); onClose(); }); });
  },
  search: [{ label: 'Handovers today', icon: 'truck-delivery', run: function () { go('schedules', { tab: 'all', from: UI.isoDate(NOW()), to: UI.isoDate(NOW()) }); } }]
};

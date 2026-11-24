/* ===================================================================
   The booking form and agreement as the customer sees them, on a phone, in the company's colours.
   The must know rules are the template system's animated pictures; names and amounts come from the company settings.
   =================================================================== */
function ruleList(b) {
  var f = b.fines, co = b.name, sv = RULE_SVGS.map(function (s) { return s; });
  sv[2] = sv[2].replace('>RM 200<', '>RM ' + f.smoking + '<');
  sv[3] = sv[3].replace('>RM 200<', '>RM ' + f.dashcam + '<');
  sv[4] = sv[4].replace('>RM 600<', '>RM ' + f.key + '<').replace('RM 600 label', 'RM ' + f.key + ' label');
  sv[6] = sv[6].replace('>RM 20 / HOUR<', '>RM ' + f.late + ' / HOUR<').replace('RM 20 per hour', 'RM ' + f.late + ' per hour');
  sv[10] = sv[10].replace('>LOST CARD RM 10<', '>LOST CARD RM ' + f.toll + '<').replace('RM 10', 'RM ' + f.toll);
  return [
    ['Only you drive', 'Only you may drive the car, unless ' + co + ' agrees in writing.'],
    ['Unapproved drivers', 'If someone ' + co + ' didn’t approve drives, you pay for all loss, damage and fines, even if insurance refuses.'],
    ['Smoking is strictly prohibited', 'Smoking inside the car results in an **RM ' + f.smoking + ' fine**.'],
    ['Don’t touch the dashcam', 'Touching the dashcam results in an **RM ' + f.dashcam + ' fine**.'],
    ['Car key', 'Losing the car key costs **RM ' + f.key + '**.'],
    ['Not allowed', 'No racing, drifting, towing, off-road driving, e-hailing, delivery or sub-renting.'],
    ['Return on time', 'Late return costs **RM ' + f.late + ' for every started hour**. Need to extend your booking? Ask at least ' + b.extendHours + ' hours before your return time.'],
    ['Stay in Malaysia', 'Private use within Malaysia only, unless ' + co + ' agrees in writing.'],
    ['Tell us immediately', 'Accident, breakdown, warning light or police stop? Tell ' + co + ' immediately.'],
    ['Return with the same fuel level', 'Missing fuel is charged at the **current fuel price**. Extra fuel cannot be paid back in cash.'],
    ['Toll card', 'If a Touch ’n Go card is provided, any balance left when you return it cannot be cashed out. A lost card costs **RM ' + f.toll + '**.'],
    ['Fines and tolls', 'Traffic fines, summonses, tolls and parking during your rental are yours to pay.']
  ].map(function (r, k) { return { title: r[0], text: r[1], svg: sv[k] }; });
}
function termList(b) {
  var co = b.name, f = b.fines;
  return [
    ['Your details', 'Everything you give us, including personal details, documents, licence and contacts, is true, valid and complete.'],
    ['Licence', 'You hold a driving licence recognised in Malaysia and may legally drive this car.'],
    ['Who drives', 'Only you may drive the car, unless ' + co + ' agrees in writing.'],
    ['Unapproved drivers', 'You are fully liable for any loss, damage, fine or claim caused by a driver ' + co + ' did not approve, including when insurance refuses to pay.'],
    ['Return time', 'Return the car by the agreed date and time. A late return costs RM ' + f.late + ' for every started hour. To extend, ask at least ' + b.extendHours + ' hours before your return time; an extension counts only once ' + co + ' approves it.'],
    ['Deposit is not payment', 'The deposit cannot be used to pay rent, extensions, fines or damage, unless ' + co + ' agrees in writing.'],
    ['Deductions and refund', co + ' may deduct from the deposit any unpaid rent, extension, damage, excess, fine, toll, cleaning fee, missing item, recovery cost or other amount you owe. The rest of the deposit is refunded within ' + b.refundHours + ' hours of the car\'s return.'],
    ['Use', 'Drive carefully and lawfully, for private use within Malaysia only, unless ' + co + ' agrees in writing.'],
    ['Not allowed', 'No illegal activity, racing, drifting, towing, off-road driving, e-hailing, delivery, courier work, sub-renting or other commercial use without approval.'],
    ['Smoking', 'Smoking inside the car is strictly prohibited and costs an RM ' + f.smoking + ' fine. Pets, illegal substances and strong odours are also not allowed.'],
    ['Fuel and cleanliness', 'Return the car clean and with the same fuel level. Missing fuel is charged at the current fuel price. Extra fuel is not paid back.'],
    ['Fines and tolls', 'You pay all traffic fines, summonses, tolls, parking charges and penalties from your rental period.'],
    ['Photo check', 'Complete ' + co + '\'s digital inspection within 15 minutes of handover, with clear, unedited photos of every required area.'],
    ['Unrecorded damage', 'Damage not shown in your handover photos is treated as damage that happened during your rental.'],
    ['Accidents and problems', 'Tell ' + co + ' immediately about any accident, damage, theft, breakdown, warning light, tyre problem, police stop or third-party claim, and cooperate fully.'],
    ['Evidence and law', 'Malaysian law governs this agreement. Signatures, inspection photos, timestamps, booking and payment records, WhatsApp messages and system logs may be used as evidence.'],
    ['Dashcam', 'Do not touch, move, cover or unplug the dashcam. Doing so costs an RM ' + f.dashcam + ' fine.'],
    ['Toll card', 'If a Touch \'n Go card is provided, any balance left when you return it cannot be cashed out. A lost card costs RM ' + f.toll + '.'],
    ['Damage and insurance', 'The rent does not automatically cover any damage and does not include insurance.'],
    ['Car key', 'Losing the car key costs RM ' + f.key + '.'],
    ['Early return', 'Returning the car early does not give a refund for the unused time, unless ' + co + ' agrees in writing.'],
    ['Cancellation', 'Cancel 72 hours or more before pick-up for a full refund of the rent. Inside 72 hours, one day\'s rent is kept. No-shows are not refunded.']
  ];
}
function ruleText(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
function bfBooking() {
  var d = D(), pick = S.bf.code && d.bookings.filter(function (y) { return y.code === S.bf.code; })[0];
  if (pick) return pick;
  var x = d.bookings.filter(function (y) { return y.status === 'Agreement Sent' && y.car.status !== 'workshop'; })[0] || d.bookings[d.bookings.length - 1];
  return x;
}
var WA = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1FA855" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';
var BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#201F1E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
var TICK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';
function bfBrand(size) { var b = B(); return '<div class="bf-brand" style="font-size:' + (size || 20) + 'px">' + mark(b) + '<span>' + esc(b.short) + '</span></div>'; }
function bfHeaderBack(x) { return '<header class="bf-hdb"><button type="button" class="bf-back" data-a="bfgo" data-v="' + (S.bf.screen - 1) + '" aria-label="Back">' + BACK + '</button><div style="flex:1">' + bfBrand(18) + '</div><div class="bf-id">' + x.code + '</div></header>'; }
function bfIntro(step, label, next, title, lead) {
  return '<div class="bf-intro"><div style="display:flex;align-items:baseline;justify-content:space-between"><div class="bf-step">Step ' + step + ' of 4' + (label ? ' · ' + label : '') + '</div>' + (next ? '<div class="bf-id">Then: ' + next + '</div>' : '') + '</div>' +
    '<div class="bf-bars" aria-hidden="true">' + [1, 2, 3, 4].map(function (n) { return '<i class="' + (n < step ? 'done' : n === step ? 'cur' : '') + '"></i>'; }).join('') + '</div><h1 class="bf-h1" style="margin-top:4px">' + title + '</h1>' + (lead ? '<p class="bf-lead">' + lead + '</p>' : '') + '</div>';
}
var BF_STEPS = ['Check your booking', 'Must know rules (1 of 2)', 'Must know rules (2 of 2)', 'Your details', 'Documents', 'Agree and sign', 'Done', 'Signed agreement (PDF)'];

function bfScreen() {
  var b = B(), x = bfBooking(), c = x.car, sc = S.bf.screen;
  var money = function (v) { return rm2(v); };
  if (sc === 0) {
    var rows = [['Rent (' + plural(x.days, 'day') + ')', x.rent]];
    if (x.dmg) rows.push(['Damage coverage (Basic)', x.dmg]); if (x.deliv) rows.push(['Delivery', x.deliv]); if (x.ret) rows.push(['Return', x.ret]);
    return '<div class="bf-scroll"><header class="bf-hd"><div>' + bfBrand() + '<small>Booking ' + x.code + '</small></div></header>' +
      '<div class="bf-pic">' + carSVG(c.color, c.shape, { label: carName(c) }) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;padding:20px 20px 0"><div class="bf-step">Step 1 of 4 · Check your booking</div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h1 class="bf-h1">' + esc(carName(c)) + '</h1><span class="bf-plate">' + esc(c.plate) + '</span></div>' +
      '<div class="bf-chips"><span>' + esc(c.color) + '</span><span>' + c.seats + ' seats</span><span>Automatic</span>' + ((c.tax - TODAY) / DAY > 0 ? '<span>Road tax valid</span>' : '') + '</div></div>' +
      '<div class="bf-dates"><div class="bf-date"><span>Pick-up</span><b>' + dShort(x.start) + '</b><small>' + tml(x.start) + ' · ' + esc(x.pickup.split(',')[0]) + '</small></div><div class="bf-date"><span>Return</span><b>' + dShort(x.end) + '</b><small>' + tml(x.end) + ' · ' + plural(x.days, 'day') + '</small></div></div>' +
      '<section class="bf-sum num">' + rows.map(function (r) { return '<div class="r"><span>' + r[0] + '</span><b>' + money(r[1]) + '</b></div>'; }).join('') + (x.disc ? '<div class="r"><span>Discount</span><b>- ' + money(x.disc) + '</b></div>' : '') +
      '<div class="r"><span>Deposit<em>refundable</em></span><b>' + money(x.dep) + '</b></div><hr><div class="tot"><span>Total payable</span><b>' + money(x.payable) + '</b></div></section><div style="height:16px"></div></div>' +
      '<div class="bf-act"><button type="button" class="bf-p" data-a="bfgo" data-v="1">Yes, this is correct</button><button type="button" class="bf-s" data-a="toast" data-v="Opens WhatsApp to ' + esc(b.name) + ' (' + esc(b.phone) + ')">' + WA + 'Something’s wrong? WhatsApp us</button></div>';
  }
  if (sc === 1 || sc === 2) {
    var all = ruleList(b), page = sc - 1, rules = all.slice(page * 6, page * 6 + 6);
    return '<div class="bf-scroll"><header class="bf-hd" style="padding-bottom:6px">' + bfBrand(18) + '<div class="bf-id" style="font-weight:700;color:#4B5154">Step 2 of 4</div></header>' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;padding:4px 20px 0"><h1 class="bf-h1" style="font-weight:900;line-height:1.2">Some must know rules</h1><div style="font-size:13px;font-weight:700;color:#4B5154;white-space:nowrap;padding-left:8px">' + (page + 1) + ' of 2</div></div>' +
      '<div class="bf-rules">' + rules.map(function (r) { return '<article class="bf-rule"><div class="pic">' + r.svg + '</div><h2>' + esc(r.title) + '</h2><p>' + ruleText(r.text) + '</p></article>'; }).join('') + '</div></div>' +
      '<div class="bf-act nb"><div class="bf-dots" aria-hidden="true"><i class="' + (page === 0 ? 'on' : '') + '"></i><i class="' + (page === 1 ? 'on' : '') + '"></i></div><div style="display:flex;gap:10px"><button type="button" class="bf-s" style="width:auto;height:54px;padding:0 20px;font-weight:800;font-size:15px" data-a="bfgo" data-v="' + (sc - 1) + '">Back</button><button type="button" class="bf-p" style="flex:1" data-a="bfgo" data-v="' + (sc + 1) + '">' + (page === 1 ? 'I understand, continue' : 'Got it, next') + '</button></div></div>';
  }
  if (sc === 3) {
    var cu = x.cust, ec = PEOPLE[(cu.i + 5) % PEOPLE.length][0];
    var fl = function (label, val, extra) { return '<div class="bf-f"><label>' + label + '</label>' + (extra === 'area' ? '<textarea>' + esc(val) + '</textarea>' : '<input value="' + esc(val) + '"' + (extra || '') + '>') + '</div>'; };
    return '<div class="bf-scroll">' + bfHeaderBack(x) + bfIntro(3, 'Your details', 'documents', 'Your details', 'Type them exactly as on your IC or passport.') +
      '<div class="bf-form">' + fl('Full name', cu.name) + fl('Phone number', cu.phone, ' inputmode="tel"') + fl('Email <em>(optional, for your copy)</em>', cu.email, ' type="email"') + fl('Home address', 'No. 3, Jalan Contoh 7, Taman Sampel, 47100 Puchong, Selangor', 'area') +
      '<div class="bf-two"><div class="bf-f"><label>Nationality</label><select><option>' + esc(cu.nat) + '</option><option>Malaysian</option><option>Singaporean</option><option>Other</option></select></div>' + fl('IC / Passport no.', cu.ic) + '</div>' +
      '<div class="bf-sub">Emergency contact</div><p class="bf-lead" style="margin:0">Someone we can call if we can’t reach you.</p><div class="bf-two">' + fl('Name', ec.split(' ')[0]) + fl('Phone', '+60 00-' + (200 + cu.i * 13) + ' ' + (4100 + cu.i * 7)) + '</div>' +
      '<div class="bf-f"><label>Relationship</label><select><option>Family</option><option>Spouse</option><option>Friend</option><option>Colleague</option></select></div></div></div>' +
      '<div class="bf-act"><button type="button" class="bf-p" data-a="bfgo" data-v="4">Continue to documents</button></div>';
  }
  if (sc === 4) {
    var licence = S.bf.licence;
    var doc = function (t, s) { return '<div class="bf-doc"><div class="th"><svg width="44" height="30" viewBox="0 0 44 30"><rect width="44" height="30" rx="4" fill="#C9D3E0"/><rect x="4" y="5" width="12" height="15" rx="2" fill="#8D9BB0"/><path d="M20 8h18M20 13h14M20 18h16M4 24h34" stroke="#8D9BB0" stroke-width="2.4" stroke-linecap="round"/></svg></div><div><b>' + t + '</b><small>' + TICK + s + '</small></div><u>Replace</u></div>'; };
    return '<div class="bf-scroll">' + bfHeaderBack(x) + bfIntro(3, 'Documents', 'agree and sign', 'Photos of your documents', 'Take a photo with your phone or pick one from your gallery. Any size is fine, we shrink it for you.') +
      '<div class="bf-form"><div class="bf-segs"><button type="button" class="' + (S.bf.idType === 'ic' ? 'on' : '') + '" data-a="bfid" data-v="ic">MyKad (IC)</button><button type="button" class="' + (S.bf.idType === 'pp' ? 'on' : '') + '" data-a="bfid" data-v="pp">Passport</button></div>' +
      (S.bf.idType === 'ic' ? doc('IC front', 'Uploaded') + doc('IC back', 'Added') : doc('Passport photo page', 'Uploaded')) +
      (licence ? doc('Driving licence', 'Added') : '<div class="bf-need"><div class="tp"><span>Driving licence</span><em>Needed</em></div><div class="bf-frame"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></div><div style="text-align:center;font-size:12px;color:#4B5154">Fit the card inside the frame, no glare</div><div class="bf-two"><button type="button" class="bf-p" style="height:46px;font-size:14px" data-a="bflic">Take photo</button><button type="button" class="bf-s" style="height:46px" data-a="bflic">Gallery</button></div></div>') +
      '<div class="bf-lock"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5154" stroke-width="2" style="flex:none;margin-top:1px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>Your documents are only seen by ' + esc(b.name) + ' staff and are used for this rental agreement.</span></div></div></div>' +
      '<div class="bf-act"><button type="button" class="bf-p" data-a="bfgo" data-v="5"' + (licence ? '' : ' disabled') + '>Continue to agree and sign</button>' + (licence ? '' : '<div style="text-align:center;font-size:12px;font-weight:600;color:#4B5154">Add driving licence to continue</div>') + '</div>';
  }
  if (sc === 5) {
    var terms = termList(b), shown = S.bf.termsOpen ? terms : terms.slice(0, 5);
    POST.push(bindPad);
    return '<div class="bf-scroll">' + bfHeaderBack(x) + bfIntro(4, '', '', 'Agree and sign', esc(carName(c)) + ' · ' + dShort(x.start) + ' to ' + dShort(x.end) + '. You already checked the price on the first page.') +
      '<div class="bf-terms"><div class="hd"><span>Rental terms</span><small>' + terms.length + ' terms</small></div><ol>' + shown.map(function (t) { return '<li><b>' + esc(t[0]) + '.</b> ' + esc(t[1]) + '</li>'; }).join('') + '</ol>' +
      '<button type="button" class="bf-more" data-a="bfterms">' + (S.bf.termsOpen ? 'Show fewer' : 'Show all ' + terms.length + ' terms') + '</button>' +
      '<div class="bf-agree' + (S.bf.agreed ? ' on' : '') + '" data-a="bfagree" role="checkbox" aria-checked="' + S.bf.agreed + '" tabindex="0"><span class="bx">' + (S.bf.agreed ? TICK : '') + '</span><span>I have read and agree to all ' + terms.length + ' rental terms, including the must know rules.</span></div></div>' +
      '<div class="bf-sig"><div class="tp"><b>Your signature</b><div class="bf-segs" style="width:120px;padding:3px"><button type="button" class="on" style="height:30px;font-size:12px">Draw</button><button type="button" style="height:30px;font-size:12px">Type</button></div></div><div class="bf-pad"><canvas id="sigpad" aria-label="Sign here with your finger"></canvas><div class="ln"></div><div class="ft"><span>Sign with your finger</span><u data-a="bfclear">Clear</u></div></div></div><div style="height:16px"></div></div>' +
      '<div class="bf-act"><button type="button" class="bf-p" data-a="bfsign">Sign and submit</button><div style="text-align:center;font-size:12px;font-weight:600;color:#4B5154">You’ll get the signed agreement as a PDF.</div></div>';
  }
  if (sc === 6) {
    return '<div class="bf-scroll"><header class="bf-hd" style="justify-content:center">' + bfBrand() + '</header><div class="bf-done"><div class="bf-tick"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div><h1 class="bf-h1">You’re all set, ' + esc(x.cust.name.split(' ')[0]) + '</h1><p class="bf-lead">Your rental agreement for booking ' + x.code + ' is signed. A copy is ready below.</p></div>' +
      '<div class="bf-next"><h3>What happens next</h3><div class="it"><span class="n">1</span><div><b>Pick-up, ' + dShort(x.start) + ' at ' + tml(x.start) + '</b>Bring your IC or passport and driving licence.</div></div><div class="it"><span class="n">2</span><div><b>Photo check within 15 minutes</b>We’ll send you the inspection link at handover.</div></div><div class="it"><span class="n">3</span><div><b>Return ' + dShort(x.end) + ' at ' + tml(x.end) + '</b>Same fuel level. Your deposit is refunded within ' + b.refundHours + ' hours after the car is checked.</div></div></div><div style="height:16px"></div></div>' +
      '<div class="bf-act nb"><button type="button" class="bf-p" data-a="bfgo" data-v="7"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Download agreement (PDF)</button><button type="button" class="bf-s" data-a="toast" data-v="Opens WhatsApp to ' + esc(b.name) + '">' + WA + 'WhatsApp ' + esc(b.short) + '</button></div>';
  }
  /* 7: the signed agreement, as the PDF looks */
  var t2 = termList(b), sig = S.bf.sig ? '<img src="' + S.bf.sig + '" alt="Signature" style="height:34px">' : '<svg viewBox="0 0 120 34"><path d="M4 26c10-18 16-20 18-10s-2 14 6 4 14-18 16-6-6 10 8 2 10-8 16-2 14 4 24-6" fill="none" stroke="#1a2a6c" stroke-width="2" stroke-linecap="round"/></svg>';
  return '<div class="bf-scroll" style="background:#EEF0F2"><header class="bf-hdb" style="background:#fff"><button type="button" class="bf-back" data-a="bfgo" data-v="6" aria-label="Back">' + BACK + '</button><div style="flex:1;font-weight:800">Agreement ' + x.code + '.pdf</div></header>' +
    '<div class="agr"><div class="agr-h"><div style="display:flex;gap:8px;align-items:flex-start">' + mark(b) + '<div><b>' + esc(b.legal) + '</b><br>Reg. ' + esc(b.reg) + '<br>' + esc(b.address) + '<br>' + esc(b.phone) + ' · ' + esc(b.email) + '</div></div><div style="text-align:right"><b style="font-size:13px;color:var(--primary-dark)">RENTAL AGREEMENT</b><br>' + x.code + '<br>Signed ' + dFull(TODAY) + '</div></div>' +
    '<div class="band">Renter</div><table><tr><td>Full name</td><td>' + esc(x.cust.name) + '</td></tr><tr><td>IC / Passport no.</td><td>' + esc(maskId(x.cust.ic)) + '</td></tr><tr><td>Phone</td><td>' + esc(x.cust.phone) + '</td></tr><tr><td>Nationality</td><td>' + esc(x.cust.nat) + '</td></tr></table>' +
    '<div class="band">Car and rental</div><table><tr><td>Car</td><td>' + esc(carName(c)) + ', ' + esc(c.color) + '</td></tr><tr><td>Plate</td><td>' + esc(c.plate) + '</td></tr><tr><td>Pick-up</td><td>' + dShort(x.start) + ', ' + tml(x.start) + ', ' + esc(x.pickup) + '</td></tr><tr><td>Return</td><td>' + dShort(x.end) + ', ' + tml(x.end) + ', ' + esc(x.drop) + '</td></tr></table>' +
    '<div class="band">Charges</div><table><tr><td>Rent (' + plural(x.days, 'day') + ')</td><td>' + rm2(x.rent) + '</td></tr>' + (x.dmg ? '<tr><td>Damage coverage</td><td>' + rm2(x.dmg) + '</td></tr>' : '') + (x.deliv ? '<tr><td>Delivery</td><td>' + rm2(x.deliv) + '</td></tr>' : '') + '<tr><td>Deposit (refundable)</td><td>' + rm2(x.dep) + '</td></tr><tr><td><b style="color:#111">Total payable</b></td><td><b style="color:var(--primary-dark)">' + rm2(x.payable) + '</b></td></tr></table>' +
    '<div class="band">Rental terms</div><ol style="margin:6px 0 0;padding-left:16px">' + t2.slice(0, 8).map(function (t) { return '<li><b>' + esc(t[0]) + '.</b> ' + esc(t[1]) + '</li>'; }).join('') + '</ol><div style="color:#888;margin-top:4px">Terms 9 to ' + t2.length + ' continue on page 2.</div>' +
    '<div class="sig"><div>' + sig + '<br>Renter: ' + esc(x.cust.name) + '</div><div><svg viewBox="0 0 120 34"><path d="M6 24c8-12 14-14 20-6s10 2 16-6 12 10 22 2 16-6 24 0" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round"/></svg><br>For ' + esc(b.legal) + '</div></div></div><div style="height:20px"></div></div>';
}
function bookingFormView() {
  var b = B(), x = bfBooking();
  return '<div class="bfx"><div class="bfx-side"><h1>Booking form and agreement</h1><p>What ' + esc(x.cust.name.split(' ')[0]) + ' sees on the phone after ' + esc(b.short) + ' sends the booking link. Same steps, rules and terms for every company; the name, logo, colours and amounts come from ' + esc(b.short) + '\'s Settings.</p>' +
    '<div class="bfx-url">' + b.slug + '.orbiquefms.com/book/' + x.code.toLowerCase() + '</div>' +
    '<div class="bfx-steps" role="tablist">' + BF_STEPS.map(function (s, k) { return '<button type="button" data-a="bfgo" data-v="' + k + '" aria-current="' + (S.bf.screen === k) + '"><b>' + (k + 1) + '</b>' + s + '</button>'; }).join('') + '</div>' +
    '<p style="font-size:12.5px">Rule amounts now: smoking RM ' + b.fines.smoking + ', dashcam RM ' + b.fines.dashcam + ', key RM ' + b.fines.key + ', late RM ' + b.fines.late + ' an hour. <a href="#" data-a="setfines" style="color:var(--primary-text);font-weight:600">Change them</a></p></div>' +
    '<div class="phone"><div class="phone-scr"><div class="phone-notch"></div><div class="phone-status"><span>9:41</span><span>●●● 5G</span></div><div class="bf" id="bf">' + bfScreen() + '</div></div></div></div>';
}
A.bfgo = function (v) { S.bf.screen = Math.max(0, Math.min(7, +v)); render(); var s = document.querySelector('.bf-scroll'); if (s) s.scrollTop = 0; if (window.innerWidth < 860) { var p = document.querySelector('.phone'); if (p) p.scrollIntoView({ block: 'start' }); } };
A.bfid = function (v) { S.bf.idType = v; render(); };
A.bflic = function () { S.bf.licence = true; render(); };
A.bfterms = function () { S.bf.termsOpen = !S.bf.termsOpen; render(); };
A.bfagree = function () { S.bf.agreed = !S.bf.agreed; render(); };
A.bfclear = function () { S.bf.sig = null; render(); };
A.bfsign = function () { if (!S.bf.agreed) { toast('Tick "I have read and agree" first.'); return; } if (!S.bf.sig) { toast('Sign in the box first, with your finger or mouse.'); return; } S.bf.screen = 6; render(); };
A.setfines = function () { S.sec = 'dash'; S.page = 'settings'; S.set = 'rules'; render(); window.scrollTo(0, 0); };
function bindPad() {
  var cv = document.getElementById('sigpad'); if (!cv) return;
  var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
  var cx = cv.getContext('2d'); cx.scale(dpr, dpr); cx.lineWidth = 2.4; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#1a2a6c';
  if (S.bf.sig) { var im = new Image(); im.onload = function () { cx.drawImage(im, 0, 0, r.width, r.height); }; im.src = S.bf.sig; }
  var down = false, last = null;
  var pt = function (e) { var q = cv.getBoundingClientRect(); return [e.clientX - q.left, e.clientY - q.top]; };
  cv.addEventListener('pointerdown', function (e) { down = true; last = pt(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) { if (!down) return; var p = pt(e); cx.beginPath(); cx.moveTo(last[0], last[1]); cx.lineTo(p[0], p[1]); cx.stroke(); last = p; });
  var up = function () { if (!down) return; down = false; S.bf.sig = cv.toDataURL('image/png'); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}

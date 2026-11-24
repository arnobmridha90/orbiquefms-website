/* ---------------- NEW BOOKING (M2 builder) ----------------
   Customer first (search, full fields, blacklist and duplicate checks, papers via IdCheck), dates with length chips,
   the searchable car picker, places / cover / price fields from company settings, payment and status, a sticky price
   footer, a per-company draft and the after-save sheet.
   Globals kept for other modules: NB, nbFresh, nbFromQuery, saveNew, NB_DRAFT, nbDiscardDraft. */
var NB = null, NB_SAVING = false;
VIEW_STATE.push(function () { NB = null; NB_SAVING = false; });

var NB_NATIONS = ['Malaysian', 'Singaporean', 'Indonesian', 'Bruneian', 'Thai', 'Filipino', 'Vietnamese', 'Chinese', 'Indian', 'Bangladeshi', 'Pakistani', 'Japanese', 'South Korean', 'Australian', 'British', 'American',
  'Afghan', 'Albanian', 'Algerian', 'Andorran', 'Angolan', 'Antiguan', 'Argentine', 'Armenian', 'Austrian', 'Azerbaijani', 'Bahamian', 'Bahraini', 'Barbadian', 'Belarusian', 'Belgian', 'Belizean', 'Beninese', 'Bhutanese', 'Bolivian', 'Bosnian',
  'Botswanan', 'Brazilian', 'Bulgarian', 'Burkinabe', 'Burmese', 'Burundian', 'Cambodian', 'Cameroonian', 'Canadian', 'Cape Verdean', 'Central African', 'Chadian', 'Chilean', 'Colombian', 'Comoran', 'Congolese', 'Costa Rican', 'Croatian',
  'Cuban', 'Cypriot', 'Czech', 'Danish', 'Djiboutian', 'Dominican', 'Dutch', 'East Timorese', 'Ecuadorian', 'Egyptian', 'Emirati', 'Equatorial Guinean', 'Eritrean', 'Estonian', 'Ethiopian', 'Fijian', 'Finnish', 'French', 'Gabonese', 'Gambian',
  'Georgian', 'German', 'Ghanaian', 'Greek', 'Grenadian', 'Guatemalan', 'Guinea-Bissauan', 'Guinean', 'Guyanese', 'Haitian', 'Honduran', 'Hungarian', 'I-Kiribati', 'Icelandic', 'Iranian', 'Iraqi', 'Irish', 'Israeli', 'Italian', 'Ivorian',
  'Jamaican', 'Jordanian', 'Kazakhstani', 'Kenyan', 'Kittian and Nevisian', 'Kuwaiti', 'Kyrgyz', 'Laotian', 'Latvian', 'Lebanese', 'Liberian', 'Libyan', 'Liechtensteiner', 'Lithuanian', 'Luxembourger', 'Macedonian', 'Malagasy', 'Malawian',
  'Maldivian', 'Malian', 'Maltese', 'Marshallese', 'Mauritanian', 'Mauritian', 'Mexican', 'Micronesian', 'Moldovan', 'Monacan', 'Mongolian', 'Moroccan', 'Mosotho', 'Motswana', 'Mozambican', 'Namibian', 'Nauruan', 'Nepalese', 'New Zealander',
  'Nicaraguan', 'Nigerian', 'Nigerien', 'North Korean', 'Northern Irish', 'Norwegian', 'Omani', 'Palauan', 'Palestinian', 'Panamanian', 'Papua New Guinean', 'Paraguayan', 'Peruvian', 'Polish', 'Portuguese', 'Qatari', 'Romanian', 'Russian',
  'Rwandan', 'Saint Lucian', 'Salvadoran', 'Samoan', 'San Marinese', 'Sao Tomean', 'Saudi', 'Scottish', 'Senegalese', 'Serbian', 'Seychellois', 'Sierra Leonean', 'Slovak', 'Slovenian', 'Solomon Islander', 'Somali', 'South African',
  'South Sudanese', 'Spanish', 'Sri Lankan', 'Sudanese', 'Surinamer', 'Swazi', 'Swedish', 'Swiss', 'Syrian', 'Taiwanese', 'Tajik', 'Tanzanian', 'Togolese', 'Tongan', 'Trinidadian or Tobagonian', 'Tunisian', 'Turkish', 'Tuvaluan', 'Ugandan',
  'Ukrainian', 'Uruguayan', 'Uzbekistani', 'Venezuelan', 'Welsh', 'Yemenite', 'Zambian', 'Zimbabwean', 'Other'];
var NB_FIELDS = ['name', 'phone', 'email', 'ic', 'nationality', 'licenceNo', 'licenceExp', 'address', 'emName', 'emPhone', 'emRel'];
var NB_LENGTHS = [{ l: '1 day', ms: DAY }, { l: '2 days', ms: 2 * DAY }, { l: '3 days', ms: 3 * DAY }, { l: '1 week', ms: 7 * DAY }];

/* ---------- state ---------- */
function nbBlankF() { var f = {}; NB_FIELDS.forEach(function (k) { f[k] = ''; }); f.nationality = 'Malaysian'; return f; }
function nbFresh() {
  var s = new Date(); s.setDate(s.getDate() + 1); s.setHours(10, 0, 0, 0); var e = new Date(s.getTime() + 2 * DAY);
  var firstP = placeChoices('pick')[0], firstR = placeChoices('ret')[0], def = (B().packages || []).filter(function (p) { return p.default; })[0];
  var n = { v: 1, cust: null, newMode: false, editCust: false, q: '', f: nbBlankF(), blOverride: false,
    s: s.toISOString(), e: e.toISOString(), car: null,
    pick: firstP && firstP.kind === 'our' ? firstP.v : '', pickNote: '', ret: firstR && firstR.kind === 'our' ? firstR.v : '', retNote: '',
    cover: { mode: def ? 'pkg' : 'none', pkg: def ? def.id : '', name: '', daily: '', max: '' },
    r: { daily: '0.00', hourly: '0.00', deposit: '0.00', discount: '0.00', delivery: '0.00', 'return': '0.00', others: '0.00' },
    method: 'Cash', status: 'Pending', payStatus: '', source: 'Staff', note: '', leadId: null, docs: null, icCheck: null,
    open: { pay: false, em: false, bd: false }, tried: false, restored: null, at: null };
  n.r.delivery = money2(nbPlaceFee(n.pick, 'pick')); n.r['return'] = money2(nbPlaceFee(n.ret, 'ret'));
  return n;
}
function nbParsePlace(v) { if (!v) return { kind: null, id: null }; if (v === 'client') return { kind: 'client', id: null }; var p = String(v).split(':'); return { kind: p[0], id: p[1] }; }
function nbPlaceFee(v, end) { var p = nbParsePlace(v); return p.kind ? placeFee(p.kind, p.id, end) : 0; }
function nbFillFromCust(c) {
  var f = nbBlankF();
  f.name = c.name || ''; f.phone = c.phone || ''; f.email = c.email || ''; f.ic = c.ic || c.passport || ''; f.nationality = c.nationality || 'Malaysian';
  f.licenceNo = c.licenceNo || ''; f.licenceExp = c.licenceExp || ''; f.address = c.address || '';
  var em = c.emergency || {}; f.emName = em.name || ''; f.emPhone = em.phone || ''; f.emRel = em.relation || '';
  return f;
}
function nbSetCar(c) {
  NB.car = c.id;
  if (can('bookings.edit_amounts')) { NB.r.daily = money2(c.rate); NB.r.hourly = money2(c.hourly); NB.r.deposit = money2(c.deposit); }
}
/* #new?car=&start=&end=&cust=&lead=&draft=1 fills the form once, then the hash goes back to #new */
function nbFromQuery(q) {
  if (q.draft) { var d = nbReadDraft(); if (d) { d.restored = d.at; return d; } }
  var n = nbFresh(), prev = NB; NB = n;
  if (q.start && !isNaN(new Date(q.start))) { n.s = new Date(q.start).toISOString(); n.e = new Date(new Date(q.start).getTime() + 2 * DAY).toISOString(); }
  if (q.end && !isNaN(new Date(q.end)) && new Date(q.end) > new Date(n.s)) n.e = new Date(q.end).toISOString();
  if (q.car && car(q.car)) nbSetCar(car(q.car));
  if (q.cust && byId(S.customers, q.cust)) { n.cust = q.cust; n.f = nbFillFromCust(cust(q.cust)); }
  if (q.lead) {
    var w = byId(S.wa, q.lead), L = w && w.lead;
    if (w) {
      n.leadId = w.id; n.source = 'WhatsApp';
      var ex = S.customers.filter(function (c) { return phoneCore(c.phone) && phoneCore(c.phone) === phoneCore(w.phone); })[0];
      if (ex) { n.cust = ex.id; n.f = nbFillFromCust(ex); } else { n.newMode = true; n.f.name = w.name || ''; n.f.phone = w.phone || ''; }
    }
    if (L) {
      if (L.start && !isNaN(new Date(L.start))) n.s = new Date(L.start).toISOString();
      if (L.end && !isNaN(new Date(L.end))) n.e = new Date(L.end).toISOString();
      if (L.car && car(L.car)) nbSetCar(car(L.car));
      if (L.pickKind) { n.pick = L.pickKind === 'client' ? 'client' : L.pickKind + ':' + L.pickLoc; n.pickNote = L.pickNote || ''; }
      if (L.retKind) { n.ret = L.retKind === 'client' ? 'client' : L.retKind + ':' + L.retLoc; n.retNote = L.retNote || ''; }
      n.r.delivery = money2(nbPlaceFee(n.pick, 'pick')); n.r['return'] = money2(nbPlaceFee(n.ret, 'ret'));
      if (L.deposit != null && can('bookings.edit_amounts')) n.r.deposit = money2(L.deposit);
      if (L.question) n.note = 'Customer asked: ' + L.question;
    }
  }
  NB = prev;
  return n;
}

/* ---------- draft (per company, this phone only) ---------- */
function nbDraftKey() { return 'fms.nbdraft.' + CO + '.' + (S && S.me || 'x'); }
function nbMeaningful(n) { return !!(n && (n.cust || n.car || (n.f && (n.f.name || digits(n.f.phone).length > 3)))); }
function nbSaveDraft() {
  if (!NB) return;
  NB.at = new Date().toISOString();
  try {
    if (!nbMeaningful(NB)) { localStorage.removeItem(nbDraftKey()); return; }
    var copy = Object.assign({}, NB, { tried: false, restored: null });
    var txt = JSON.stringify(copy);
    if (txt.length > 400000) { copy.docs = null; copy.icCheck = null; txt = JSON.stringify(copy); }
    localStorage.setItem(nbDraftKey(), txt);
  } catch (e) { /* storage full or blocked: the draft is only a convenience */ }
}
function nbReadDraft() {
  try {
    var t = localStorage.getItem(nbDraftKey()); if (!t) return null; var d = JSON.parse(t); if (!(d && d.v === 1 && d.r && d.f)) return null;
    /* the demo data may have been reset since: drop a car or customer that no longer exists */
    if (d.car && !car(d.car)) d.car = null;
    if (d.cust && !byId(S.customers, d.cust)) { d.cust = null; d.editCust = false; d.blOverride = false; if (d.f && (d.f.name || d.f.phone)) d.newMode = true; }
    if (d.leadId && !byId(S.wa || [], d.leadId)) d.leadId = null;
    d.open = d.open || {}; d.cover = d.cover || { mode: 'none' };
    return d;
  } catch (e) { return null; }
}
function nbClearDraft() { try { localStorage.removeItem(nbDraftKey()); } catch (e) {} }
/* Home / Bookings: html of a 'Continue your draft booking' card, or '' when there is no draft. NB_DRAFT.info() gives the raw facts. */
function NB_DRAFT() {
  var d = NB_DRAFT.info(); if (!d) return '';
  return '<div class="nb-draftcard"><div class="nb-draft-ic">' + I('edit') + '</div><div class="grow"><div class="b">Continue your draft booking</div><div class="small muted">' + esc(d.line) + '</div></div>' +
    '<div class="nb-draft-act"><a class="btn sm" href="#new?draft=1">Continue</a><button type="button" class="btn sm ghost" onclick="nbDiscardDraft()">Discard</button></div></div>';
}
NB_DRAFT.info = function () {
  var d = nbReadDraft(); if (!d || !nbMeaningful(d)) return null;
  var who = d.cust ? cust(d.cust).name : d.f.name || d.f.phone || 'New customer', k = d.car ? car(d.car) : null;
  return { name: who, plate: k ? k.plate : '', start: d.s, end: d.e, at: d.at, line: [who, k ? k.plate : 'no car yet', dShort(d.s) + ' to ' + dShort(d.e), 'saved ' + ago(d.at)].join(' · ') };
};
function nbDiscardDraft() {
  var t = null; try { t = localStorage.getItem(nbDraftKey()); } catch (e) {}
  nbClearDraft(); if (NB && route().name !== 'new') NB = null; render(false, true);
  undoSnack('Draft discarded', function () { try { if (t) localStorage.setItem(nbDraftKey(), t); } catch (e) {} render(false, true); });
}

/* ---------- money and checks ---------- */
function nbNum(k) { var v = parseMoney(NB.r[k]); return isNaN(v) ? 0 : v; }
function nbCover() {
  var c = NB.cover || {};
  if (c.mode === 'pkg') { var p = pkg(c.pkg); return p ? { packageId: p.id, name: p.name, daily: +p.daily || 0, max: +p.max || 0 } : null; }
  if (c.mode === 'custom') { var d = parseMoney(c.daily), m = parseMoney(c.max); return { packageId: null, name: String(c.name || '').trim() || 'Custom cover', daily: isNaN(d) ? 0 : d, max: isNaN(m) ? 0 : m }; }
  return null;
}
function nbTemp() {
  var pk = nbParsePlace(NB.pick), rk = nbParsePlace(NB.ret);
  return blankBooking({ start: NB.s, end: NB.e, car: NB.car, pickKind: pk.kind, pickLoc: pk.id, pickNote: NB.pickNote, retKind: rk.kind, retLoc: rk.id, retNote: NB.retNote,
    rates: { daily: nbNum('daily'), hourly: nbNum('hourly'), deposit: nbNum('deposit'), discount: nbNum('discount'), delivery: nbNum('delivery'), 'return': nbNum('return'), others: nbNum('others') },
    cover: nbCover(), bookingStatus: NB.status, paymentStatus: NB.payStatus || null });
}
function nbMoneyMode() { return can('bookings.edit_amounts') ? 'edit' : can('bookings.see_amounts') ? 'see' : 'hidden'; }
/* customers that already use this phone / IC (never make a duplicate) */
function nbDupes(f) {
  var pc = phoneCore(f.phone), id = String(f.ic || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var out = [];
  S.customers.forEach(function (c) {
    if (pc && digits(f.phone).length >= 9 && phoneCore(c.phone) === pc) out.push({ c: c, by: 'phone' });
    else if (id.length >= 6 && (String(c.ic || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === id || String(c.passport || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === id)) out.push({ c: c, by: 'IC' });
  });
  return out;
}
/* every reason Save cannot go ahead: [{key, sec, text (under the field), short (on the Save button)}] */
function nbProblems() {
  var out = [], f = NB.f, mode = nbMoneyMode();
  var add = function (key, sec, text, short) { out.push({ key: key, sec: sec, text: text, short: short || text }); };
  if (!can('bookings.create')) add('access', 'top', 'You cannot make bookings', 'Needs Make bookings access');
  if (mode !== 'edit') add('price', 'price', 'Setting prices needs Edit amounts access', 'Needs Edit amounts access');
  if (!NB.cust || NB.editCust) {
    if (!String(f.name).trim()) add('name', 'cust', 'Add the customer\'s full name', 'Add the customer\'s name');
    if (digits(f.phone).length < 9) add('phone', 'cust', digits(f.phone).length ? 'This phone number looks too short' : 'Add the customer\'s phone', 'Add the customer\'s phone');
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) add('email', 'cust', 'This email does not look right', 'Check the email');
  }
  var s = new Date(NB.s), e = new Date(NB.e);
  if (isNaN(s) || isNaN(e)) add('end', 'dates', 'Pick the dates', 'Pick the dates');
  else if (e <= s) add('end', 'dates', 'Rental end cannot be before rental start', 'End is before start');
  if (!NB.car) add('car', 'car', 'Pick a car', 'Pick a car');
  else if (!(e <= s)) { var bz = busy(NB.car, s, e); if (!bz.free) add('car', 'car', 'This car is not available for the selected dates: ' + bz.reason, 'Pick a free car first'); }
  if (mode === 'edit') {
    Object.keys(NB.r).forEach(function (k) { var v = String(NB.r[k]).trim(); if (v !== '' && isNaN(parseMoney(v))) add('r_' + k, 'price', 'Type an amount like 120.00', 'Check the amounts'); });
    if (['daily', 'hourly'].some(function (k) { return String(NB.r[k]).trim() === ''; })) add('r_daily', 'price', 'Add the daily and hourly rate', 'Check the amounts');
    if (NB.cover.mode === 'custom') {
      if (!String(NB.cover.name || '').trim()) add('cover', 'cover', 'Give the custom cover a name', 'Fill in the custom cover');
      else if (isNaN(parseMoney(NB.cover.daily))) add('cover', 'cover', 'Type the custom cover price per day', 'Fill in the custom cover');
    }
    if (NB.car && !(e <= s)) { var m = calcBooking(nbTemp()); if (m.discount > m.rent + m.coverTotal + m.delivery + m['return'] + m.others) add('r_discount', 'price', 'The discount is more than the charges', 'Check the discount'); }
  }
  return out;
}
function nbErr(probs, key) { if (!NB.tried && ['end', 'car', 'price', 'access'].indexOf(key) < 0) return ''; var p = probs.filter(function (x) { return x.key === key; })[0]; return p ? '<span class="err">' + esc(p.text) + '</span>' : ''; }
function nbBad(probs, key) { return NB.tried && probs.some(function (x) { return x.key === key; }) ? ' bad' : ''; }

/* ---------- small builders ---------- */
function nbTimeSel(id, d) {
  d = new Date(d); var cur = pad(d.getHours()) + ':' + pad(d.getMinutes()), out = '', has = false;
  for (var m = 0; m < 1440; m += 15) {
    var v = pad(Math.floor(m / 60)) + ':' + pad(m % 60); if (v === cur) has = true;
    out += '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + hm(new Date(2026, 0, 1, Math.floor(m / 60), m % 60)) + '</option>';
  }
  if (!has) out = '<option value="' + cur + '" selected>' + hm(d) + '</option>' + out;
  return '<select class="inp nb-time" id="' + id + '" aria-label="Time">' + out + '</select>';
}
function nbFold(key, title, sub, body) {
  var on = !!NB.open[key];
  return '<div class="nb-fold' + (on ? ' on' : '') + '" id="nbfold_' + key + '"><button type="button" class="nb-fold-h" data-fold="' + key + '" aria-expanded="' + on + '"><span class="grow"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + I('down') + '</button>' + (on ? '<div class="nb-fold-b">' + body + '</div>' : '') + '</div>';
}
function nbRepeatLine(c) {
  var list = S.bookings.filter(function (b) { return b.cust === c.id && b.bookingStatus !== 'Cancelled' && new Date(b.start) < new Date(); }).sort(function (a, b) { return new Date(b.start) - new Date(a.start); });
  if (!list.length) return '';
  return 'Repeat customer: ' + list.length + ' rental' + (list.length === 1 ? '' : 's') + ', last on ' + dFull(list[0].start);
}
/* red / amber / blue banner for a known customer, like the customer notes banner */
function nbCustBanner(c) {
  if (!c) return '';
  var notes = (S.notes || []).filter(function (n) { return n.cust === c.id; }), rep = nbRepeatLine(c);
  var lines = function (flag) { return notes.filter(function (n) { return n.flag === flag; }).slice(0, 2).map(function (n) { return n.text; }); };
  var box = function (tone, icon, title, ls) { ls = ls.filter(Boolean); return '<div class="banner ' + tone + ' nb-cbanner">' + I(icon) + '<div><b>' + esc(title) + '</b>' + ls.map(function (l) { return '<div class="nb-bl">' + esc(l) + '</div>'; }).join('') + '</div></div>'; };
  if (c.blacklist) {
    var since = c.blacklist.at ? 'on the blacklist since ' + dFull(c.blacklist.at) : 'on the blacklist';
    return box('red', 'warn', 'Blacklisted customer: ' + c.name + ' is ' + since + '.', [c.blacklist.reason ? 'Reason: ' + c.blacklist.reason : ''].concat(lines('careful'), [rep]));
  }
  if (notes.some(function (n) { return n.flag === 'careful'; })) return box('amber', 'warn', 'Be careful with this customer', lines('careful').concat([rep]));
  if (notes.some(function (n) { return n.flag === 'vip'; })) return box('blue', 'star', 'VIP customer', lines('vip').concat([rep]));
  if (notes.length) return box('blue', 'note', 'Notes about this customer', lines('info').concat([rep]));
  if (rep) return box('blue', 'star', rep, []);
  return '';
}
function nbDocsLine() {
  var d = NB.docs || {}, names = [];
  [['icFront', 'IC front'], ['icBack', 'IC back'], ['passport', 'Passport'], ['licence', 'Licence'], ['poa', 'Proof of address']].forEach(function (x) { if (d[x[0]]) names.push(x[1]); });
  if ((d.other || []).length) names.push(d.other.length + ' other');
  var chk = NB.icCheck ? chip(NB.icCheck.label, NB.icCheck.tone) : '';
  return '<div class="nb-papers"><button type="button" class="btn sm ghost" id="nb_papers">' + I('camera') + (names.length ? 'Papers' : 'Check papers') + '</button><div class="grow small">' +
    (names.length ? '<span class="nb-papers-l">' + esc(names.join(', ')) + '</span>' : '<span class="muted">IC, passport, licence and proof of address photos</span>') + (chk ? ' ' + chk : '') + '</div></div>';
}

/* ---------- sections ---------- */
function nbCustFields(probs, isNew) {
  var f = NB.f, fx = function (k, label, attrs, full) {
    return '<label class="field" id="nbf_' + k + '"><span>' + label + '</span><input class="inp' + nbBad(probs, k) + '" data-f="' + k + '" value="' + esc(f[k]) + '" ' + (attrs || '') + '>' + nbErr(probs, k) + '</label>';
  };
  var icHint = '', icd = digits(f.ic);
  if (icd.length === 12 && /^[\d\s-]+$/.test(f.ic)) { var fa = icFacts(f.ic); icHint = fa.issues.length ? '<span class="hint nb-warn">' + esc(fa.issues.join('. ')) + '</span>' : '<span class="hint">Born ' + esc(fa.facts.born) + ', ' + esc(fa.facts.state) + ', ' + esc(fa.facts.sex) + '</span>'; }
  var licHint = '';
  if (f.licenceExp) { var le = new Date(f.licenceExp + 'T23:59:00'); if (le < new Date()) licHint = '<span class="err">This licence has expired</span>'; else if (le < new Date(NB.e)) licHint = '<span class="hint nb-warn">The licence expires before the rental ends</span>'; }
  var em = (f.emName || f.emPhone) ? [f.emName, f.emRel, f.emPhone].filter(Boolean).join(' · ') : 'Optional';
  return fx('name', 'Full name', 'autocomplete="off" autocapitalize="words" placeholder="As on the IC or passport"') +
    fx('phone', 'Phone', 'type="tel" inputmode="tel" autocomplete="off" placeholder="012-345 6789"') +
    (isNew ? '<div id="nb_dupe"></div>' : '') +
    fx('email', 'Email', 'type="email" inputmode="email" autocomplete="off" autocapitalize="off" placeholder="Optional"') +
    '<div class="field" id="nbf_ic"><span>IC / Passport</span><div class="nb-icrow"><input class="inp" data-f="ic" value="' + esc(f.ic) + '" autocomplete="off" autocapitalize="characters" placeholder="900101-14-5521"><button type="button" class="btn sm ghost nb-scan" id="nb_scan">' + I('camera') + 'Scan IC</button></div>' + icHint + '</div>' +
    '<div class="field"><span>Nationality</span><button type="button" class="inp nb-pickinp" id="nb_nat"><span class="grow">' + esc(f.nationality || 'Choose') + '</span>' + I('down') + '</button></div>' +
    '<div class="two"><label class="field"><span>Licence no</span><input class="inp" data-f="licenceNo" value="' + esc(f.licenceNo) + '" autocomplete="off" autocapitalize="characters"></label>' +
    '<label class="field"><span>Licence expiry</span><input class="inp" type="date" data-f="licenceExp" value="' + esc(f.licenceExp) + '"></label></div>' + licHint +
    '<label class="field"><span>Address</span><textarea class="inp" data-f="address" rows="2" placeholder="Optional">' + esc(f.address) + '</textarea></label>' +
    nbFold('em', 'Emergency contact', em,
      '<label class="field"><span>Name</span><input class="inp" data-f="emName" value="' + esc(f.emName) + '" autocomplete="off"></label>' +
      '<div class="two"><label class="field"><span>Phone</span><input class="inp" type="tel" inputmode="tel" data-f="emPhone" value="' + esc(f.emPhone) + '" autocomplete="off"></label>' +
      '<label class="field"><span>Relation</span><input class="inp" data-f="emRel" value="' + esc(f.emRel) + '" list="nb_rels" autocomplete="off" placeholder="Spouse"></label></div>' +
      '<datalist id="nb_rels"><option>Father</option><option>Mother</option><option>Spouse</option><option>Brother</option><option>Sister</option><option>Friend</option></datalist>');
}
function nbCustSection(probs) {
  var body;
  if (NB.cust) {
    var c = cust(NB.cust), fl = custFlags(c);
    body = '<div class="picked nb-picked"><div class="av sm" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</div><div class="grow"><div class="b">' + esc(c.name) + ' ' + fl.slice(0, 2).map(flagChip).join(' ') + '</div><div class="small muted nowrap">' + esc(c.phone) + (c.ic ? ' · ' + esc(maskIC(c.ic)) : '') + '</div></div><button type="button" class="btn sm ghost" id="nb_custchange">Change</button></div>' +
      nbCustBanner(c) + (NB.blOverride ? '<div class="small nb-override">' + I('shield') + 'Booking anyway: allowed by ' + esc(myName()) + '</div>' : '');
    if (NB.editCust) body += '<div class="nb-subh"><b>Details</b><button type="button" class="btn link sm" id="nb_editcust">Done</button></div>' + nbCustFields(probs, false);
    else {
      var f = NB.f, row = function (k, v, cls) { return v ? '<div class="nb-kv' + (cls || '') + '"><span>' + k + '</span><b>' + esc(v) + '</b></div>' : ''; };
      var lexp = f.licenceExp ? new Date(f.licenceExp + 'T23:59:00') : null;
      body += '<div class="nb-subh"><b>Details</b><button type="button" class="btn link sm" id="nb_editcust">' + I('edit') + 'Edit</button></div><div class="nb-kvs">' +
        row('Email', f.email) + row('IC / Passport', f.ic ? maskIC(f.ic) : '') + row('Nationality', f.nationality) +
        row('Licence', [f.licenceNo, f.licenceExp ? 'until ' + dFull(lexp) : ''].filter(Boolean).join(', '), lexp && lexp < new Date(NB.e) ? ' red' : '') +
        row('Address', f.address) + row('Emergency', [f.emName, f.emRel, f.emPhone].filter(Boolean).join(' · ')) +
        (!f.email && !f.ic && !f.licenceNo ? '<div class="small muted">No IC or licence on file yet. Tap Edit or Check papers.</div>' : '') + '</div>';
    }
  } else if (NB.newMode) {
    body = '<div class="nb-subh"><b>New customer</b><button type="button" class="btn link sm" id="nb_searchagain">' + I('search') + 'Find a customer</button></div>' + nbCustFields(probs, true);
  } else {
    body = '<label class="search nb-search">' + I('search') + '<input id="nb_q" type="search" placeholder="Phone, IC or name" value="' + esc(NB.q) + '" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"></label>' +
      '<div id="nb_sug"></div>' + (NB.tried && probs.some(function (x) { return x.key === 'name' || x.key === 'phone'; }) ? '<span class="err-text nb-findErr">Find the customer, or add a new one</span>' : '') +
      '<button type="button" class="btn ghost nb-newcust" id="nb_newcust">' + I('plus', 2.2) + 'New customer</button>';
  }
  return '<div class="formcard" id="nbs_cust"><h3><span class="stepn">1</span>Customer</h3>' + body + (NB.cust || NB.newMode ? nbDocsLine() : '') + '</div>';
}
function nbDatesSection(probs) {
  var s = new Date(NB.s), e = new Date(NB.e), len = e - s, past = s < new Date(Date.now() - 5 * MIN);
  var chips = NB_LENGTHS.map(function (x) { return '<button type="button" class="fchip' + (len === x.ms ? ' on' : '') + '" data-len="' + x.ms + '">' + x.l + '</button>'; }).join('') + '<button type="button" class="fchip" data-add="' + 12 * HOUR + '">+12 hours</button>';
  return '<div class="formcard" id="nbs_dates"><h3><span class="stepn">2</span>Dates<span class="nb-dur" id="nb_dur">' + (len > 0 ? esc(durationText(s, e)) : '') + '</span></h3>' +
    '<div class="field"><span>Start of rental</span><div class="nb-dt"><input class="inp" type="date" id="nb_sd" value="' + toLocalInput(s) + '">' + nbTimeSel('nb_st', s) + '</div>' + (past ? '<span class="hint nb-warn">This pick-up is in the past</span>' : '') + '</div>' +
    '<div class="chiprow nb-lens">' + chips + '</div>' +
    '<div class="field" id="nbf_end"><span>End of rental</span><div class="nb-dt"><input class="inp' + (len <= 0 ? ' bad' : '') + '" type="date" id="nb_ed" value="' + toLocalInput(e) + '">' + nbTimeSel('nb_et', e) + '</div>' + nbErr(probs, 'end') + '</div></div>';
}
function nbCarSection(probs) {
  var s = new Date(NB.s), e = new Date(NB.e), ok = e > s, usable = S.cars.filter(function (c) { return c.status === 'active'; });
  var free = ok ? usable.filter(function (c) { return isFree(c.id, s, e); }).length : 0, block;
  if (NB.car) {
    var cc = car(NB.car), bz = ok ? busy(cc.id, s, e) : { free: true };
    block = '<button type="button" class="carfield picked-car' + (!bz.free ? ' nb-busy' : '') + '" id="nb_car"><span class="pk-car">' + carSVG(cc.color, cc.shape) + '</span><span class="grow"><span class="pk-plate">' + esc(cc.plate) + '</span><span class="pk-sub">' + esc(cc.make + ' ' + cc.model + ' · ' + cc.color) + (nbMoneyMode() !== 'hidden' ? ' · <span class="money">' + rm(cc.rate) + '</span> / day' : '') + '</span></span><span class="btn sm ghost">Change</span></button>' +
      (!bz.free ? '<div class="banner red nb-carbad">' + I('warn') + '<div><b>This car is not available for the selected dates:</b> ' + esc(bz.reason.replace(/^Booked: /, 'Booked ')) + '</div></div>' : bz.soon ? '<div class="banner amber">' + I('clock') + '<div>Check the turnaround: ' + esc(bz.soon) + '.</div></div>' : '');
  } else block = '<button type="button" class="carfield empty-car' + nbBad(probs, 'car') + '" id="nb_car">' + I('search') + '<span class="grow">Search a car by plate, model or colour</span>' + I('chev') + '</button>' + (NB.tried ? nbErr(probs, 'car') : '');
  return '<div class="formcard" id="nbs_car"><h3><span class="stepn">3</span>Car</h3><div class="field" id="nbf_car">' + block +
    '<div class="nb-freeline"><span class="small muted">' + (ok ? free + ' of ' + usable.length + ' cars free for these dates' : 'Fix the dates to see free cars') + '</span><a class="btn link sm" href="' + hashWith('availability', { start: NB.s, end: NB.e }) + '">' + I('cal') + 'Check availability</a></div></div></div>';
}
function nbPlaceSel(end) {
  var sel = end === 'pick' ? NB.pick : NB.ret, money = nbMoneyMode() !== 'hidden';
  var opts = '<option value=""' + (!sel ? ' selected' : '') + '>Not chosen</option>' + placeChoices(end).map(function (o) { return '<option value="' + o.v + '"' + (o.v === sel ? ' selected' : '') + '>' + esc(o.label) + (o.fee && money ? ' (' + rm(o.fee) + ')' : '') + '</option>'; }).join('');
  var p = nbParsePlace(sel), note = end === 'pick' ? NB.pickNote : NB.retNote;
  var noteLabel = p.kind === 'client' ? (end === 'pick' ? 'Delivery address' : 'Collection address') : 'Note';
  return '<label class="field"><span>' + (end === 'pick' ? 'Start of rental' : 'End of rental') + '</span><select class="inp" id="nb_' + end + '">' + opts + '</select></label>' +
    '<label class="field nb-note"><span>' + noteLabel + '</span><input class="inp" id="nb_' + end + 'note" value="' + esc(note) + '" autocomplete="off" placeholder="' + (p.kind === 'client' ? 'Street, area, landmark' : 'Optional, for example flight number') + '"></label>';
}
function nbPlacesSection() {
  return '<div class="formcard" id="nbs_places"><h3><span class="stepn">4</span>Places</h3>' + nbPlaceSel('pick') + '<div class="nb-sep"></div>' + nbPlaceSel('ret') + '</div>';
}
function nbCoverSection(probs) {
  var days = nDays(NB.s, NB.e), money = nbMoneyMode() !== 'hidden', locked = nbMoneyMode() !== 'edit', c = NB.cover;
  var card = function (v, title, sub, on) { return '<button type="button" class="nb-cov' + (on ? ' on' : '') + '" data-cov="' + v + '"' + (locked ? ' disabled' : '') + '><span class="nb-radio"></span><span class="grow"><b>' + esc(title) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></button>'; };
  var html = (B().packages || []).map(function (p) {
    return card('pkg:' + p.id, p.name, money ? '<span class="money">' + rm(p.daily) + '</span> / day · <span class="money">' + rm(p.daily * days) + '</span> for these dates · max cover <span class="money">' + rm(p.max) + '</span>' : 'Max cover ' + rm(p.max), c.mode === 'pkg' && c.pkg === p.id);
  }).join('') + card('none', 'None', 'The customer pays for any damage', c.mode === 'none') + card('custom', 'Custom', 'Your own name, price and max cover', c.mode === 'custom');
  if (c.mode === 'custom') html += '<div class="nb-custom" id="nbf_cover"><label class="field"><span>Cover name</span><input class="inp' + nbBad(probs, 'cover') + '" id="nb_cvname" value="' + esc(c.name) + '" placeholder="Zero excess"' + (locked ? ' disabled' : '') + '></label>' +
    '<div class="two"><label class="field"><span>Per day</span><div class="rmfield"><input class="inp num" id="nb_cvdaily" inputmode="decimal" value="' + esc(c.daily) + '" placeholder="0.00"' + (locked ? ' disabled' : '') + '></div></label>' +
    '<label class="field"><span>Max cover</span><div class="rmfield"><input class="inp num" id="nb_cvmax" inputmode="decimal" value="' + esc(c.max) + '" placeholder="0.00"' + (locked ? ' disabled' : '') + '></div></label></div>' + nbErr(probs, 'cover') + '</div>';
  return '<div class="formcard" id="nbs_cover"><h3><span class="stepn">5</span>Damage cover</h3><div class="nb-covs">' + html + '</div></div>';
}
function nbBase(k) {
  var c = NB.car ? car(NB.car) : null;
  if (k === 'daily') return c ? ['Car rate', c.rate] : null;
  if (k === 'hourly') return c ? ['Car hourly rate', c.hourly] : null;
  if (k === 'deposit') return c ? ['Car deposit', c.deposit] : null;
  if (k === 'delivery') return ['Place fee', nbPlaceFee(NB.pick, 'pick')];
  if (k === 'return') return ['Place fee', nbPlaceFee(NB.ret, 'ret')];
  return null;
}
function nbHint(k) { var b = nbBase(k), v = parseMoney(NB.r[k]); return b && !isNaN(v) && Math.abs(v - (+b[1] || 0)) > 0.004 ? esc(b[0]) + ' ' + rm(b[1]) : ''; }
function nbPriceSection(probs) {
  var mode = nbMoneyMode();
  if (mode === 'hidden') return '<div class="formcard" id="nbs_price"><h3><span class="stepn">6</span>Price</h3><div class="banner red" id="nbf_price">' + I('lock') + '<div><b>Setting prices needs Edit amounts access.</b> Ask the owner to make this booking, or to give you access.</div></div></div>';
  var fld = function (k, label) {
    return '<label class="field" id="nbf_r_' + k + '"><span>' + label + '</span><div class="rmfield"><input class="inp num nb-money' + nbBad(probs, 'r_' + k) + '" data-k="' + k + '" inputmode="decimal" autocomplete="off" value="' + esc(NB.r[k]) + '"' + (mode !== 'edit' ? ' disabled' : '') + '></div><span class="hint" data-hint="' + k + '">' + nbHint(k) + '</span>' + nbErr(probs, 'r_' + k) + '</label>';
  };
  return '<div class="formcard" id="nbs_price"><h3><span class="stepn">6</span>Price</h3>' + (mode !== 'edit' ? '<div class="banner red" id="nbf_price">' + I('lock') + '<div><b>Setting prices needs Edit amounts access.</b> You can see the prices, but Save stays off. Ask the owner for access.</div></div>' : '') +
    '<div class="nb-grid">' + fld('daily', 'Daily rate') + fld('hourly', 'Hourly rate') + fld('deposit', 'Deposit') + fld('discount', 'Discount') + fld('delivery', 'Delivery') + fld('return', 'Return') + fld('others', 'Others') + '</div></div>';
}
function nbPaySection() {
  var tmp = nbTemp(), canRef = canPickRefunded(tmp), mEdit = nbMoneyMode() === 'edit';
  var seg = function (id, list, cur, dis) { return '<div class="seg nb-seg" id="' + id + '">' + list.map(function (x) { return '<button type="button" data-v="' + x + '" class="' + (x === cur ? 'on' : '') + '"' + (dis ? ' disabled' : '') + '>' + x + '</button>'; }).join('') + '</div>'; };
  var body = '<div class="field"><span>Payment method</span>' + seg('nb_method', ['Cash', 'Card', 'Online Transfer'], NB.method, !mEdit) + (!mEdit ? '<span class="hint">Needs Edit amounts access</span>' : '') + '</div>' +
    '<div class="field"><span>Booking status</span>' + seg('nb_status', ['Pending', 'Confirmed'], NB.status) + '</div>' +
    '<label class="field"><span>Payment status</span><select class="inp" id="nb_paystatus"><option value="">None</option>' + PAY_STATUSES.map(function (p) { var dis = p === 'Deposit Refunded' && !canRef; return '<option value="' + p + '"' + (p === NB.payStatus ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + p + (dis ? ' (only by recording the refund)' : '') + '</option>'; }).join('') + '</select></label>' +
    '<label class="field"><span>Booked through</span><select class="inp" id="nb_src">' + ['Staff', 'WhatsApp', 'Website', 'Walk-in'].map(function (x) { return '<option' + (x === NB.source ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
    '<label class="field"><span>Note for staff</span><textarea class="inp" id="nb_note" rows="2" placeholder="Optional">' + esc(NB.note) + '</textarea></label>';
  return '<div class="formcard nb-paycard" id="nbs_pay">' + nbFold('pay', 'Payment and status', [NB.method, NB.status, NB.payStatus || 'No payment status', NB.source].join(' · '), body) + '</div>';
}
function nbFooter(probs) {
  var mode = nbMoneyMode(), s = new Date(NB.s), e = new Date(NB.e), first = probs[0];
  var tot, bd = '';
  if (mode === 'hidden') tot = '<b class="nb-tot-h">Prices hidden</b><span>Needs See amounts access</span>';
  else if (!NB.car || e <= s) tot = '<b class="nb-tot-h">' + (NB.car ? 'Fix the dates' : 'Choose a car') + '</b><span>to see the price</span>';
  else {
    var t = nbTemp(), m = calcBooking(t), line = function (l, v, cls) { return '<div class="nb-bdl' + (cls || '') + '"><span>' + l + '</span><span class="money">' + rm(v) + '</span></div>'; };
    tot = '<button type="button" class="nb-totbtn" id="nb_totbtn" aria-expanded="' + !!NB.open.bd + '"><b class="money" id="nb_tot">' + rm(m.payable) + '</b><span>Total payable ' + I('down') + '</span></button>';
    if (NB.open.bd) bd = '<div class="nb-bd">' + line('Rent · ' + esc(m.duration), m.rent) + (m.coverTotal ? line(esc(t.cover.name) + ' · ' + m.coverDays + ' day' + (m.coverDays > 1 ? 's' : ''), m.coverTotal) : line('Damage cover', 0)) +
      (m.delivery ? line('Delivery', m.delivery) : '') + (m['return'] ? line('Return', m['return']) : '') + (m.others ? line('Others', m.others) : '') + (m.discount ? line('Discount', -m.discount, ' neg') : '') +
      line('Deposit (refundable)', m.deposit) + line('Total payable', m.payable, ' big') + '</div>';
  }
  var off = !!first;
  return bd + '<div class="stickybar-in"><div class="tot">' + tot + '</div><button type="button" class="btn nb-save' + (off ? ' off' : '') + '" id="nb_save" aria-disabled="' + off + '"' + (NB_SAVING ? ' disabled' : '') + '>' + (off ? esc(first.short) : I('check', 2.4) + 'Save booking') + '</button></div>';
}
function nbPaint() {
  var foot = $('#nb_foot'); if (!foot || !NB) return;
  foot.innerHTML = nbFooter(nbProblems());
  var dur = $('#nb_dur'); if (dur) { var s = new Date(NB.s), e = new Date(NB.e); dur.textContent = e > s ? durationText(s, e) : ''; }
  nbWireFooter(); nbPadMain();
}
/* keep the last section reachable above the footer (it grows when the breakdown is open) */
function nbPadMain() { var f = $('#nb_foot'), m = $('main.nb-main'); if (f && m) m.style.paddingBottom = (f.offsetHeight + 20) + 'px'; }

/* ---------- the screen ---------- */
VIEWS.new = function (r) {
  if (r && r.q && Object.keys(r.q).length) { NB = nbFromQuery(r.q); history.replaceState(history.state, '', location.pathname + location.search + '#new'); }
  if (!NB) { var d = nbReadDraft(); if (d && nbMeaningful(d)) { NB = d; NB.restored = d.at; NB.tried = false; } else NB = nbFresh(); }
  if (!can('bookings.create')) return { html: topbar('New booking', { back: '#bookings' }) + '<main>' + noAccess('bookings.create') + '</main>' };
  NB.open = NB.open || {};
  var probs = nbProblems();
  var lead = NB.leadId ? byId(S.wa, NB.leadId) : null, leadHtml = '';
  if (lead) {
    var sum = ''; try { sum = typeof Leads !== 'undefined' && Leads.summary ? Leads.summary(lead.id) : ''; } catch (e) { sum = ''; }
    leadHtml = '<div class="banner green nb-lead">' + I('wa') + '<div class="grow"><b>From a WhatsApp chat with ' + esc(lead.name || lead.phone) + '</b><div class="small">Dates, car and places were filled in from the chat. Check them before you save.</div>' + (sum ? '<details class="nb-leadd"' + (NB.open.lead ? ' open' : '') + '><summary>' + I('down') + 'What was agreed in the chat</summary><div class="nb-leadsum">' + sum + '</div></details>' : '') + '</div></div>';
  }
  var html = topbar('New booking', { back: '#bookings', sub: bookingCode(S.nextNo), noBell: true, right: '<button type="button" class="btn link sm nb-discard" id="nb_discard">Discard</button>' }) + '<main class="nb-main">' +
    (NB.restored ? '<div class="banner blue nb-restored">' + I('reset') + '<div class="grow">Continuing your draft from ' + esc(ago(NB.restored)) + '.</div><button type="button" class="btn link sm" id="nb_fresh">Start over</button></div>' : '') +
    leadHtml + nbCustSection(probs) + nbDatesSection(probs) + nbCarSection(probs) + nbPlacesSection() + nbCoverSection(probs) + nbPriceSection(probs) + nbPaySection() +
    '</main><div class="stickybar nb-foot" id="nb_foot">' + nbFooter(probs) + '</div>';
  return { html: html, noNav: true, keepScroll: true, after: nbWire };
};
function nbRe() { nbSaveDraft(); render(false, true); }
function nbWireFooter() {
  var sv = $('#nb_save'); if (sv) sv.onclick = saveNew;
  var tb = $('#nb_totbtn'); if (tb) tb.onclick = function () { NB.open.bd = !NB.open.bd; nbPaint(); };
}
function nbWire() {
  if (!NB) return;
  nbWireFooter(); nbPadMain();
  var on = function (sel, ev, fn) { var el = $(sel); if (el) el.addEventListener(ev, function (e) { if (NB) return fn.call(this, e); }); };
  on('#nb_discard', 'click', function () {
    if (!nbMeaningful(NB)) { NB = null; nbClearDraft(); goBack('#bookings'); return; }
    confirm({ icon: 'warn', title: 'Discard this booking?', text: 'What you typed here will be lost.', ok: 'Discard', cancel: 'Keep editing', danger: true }).then(function (y) { if (!y) return; NB = null; nbClearDraft(); nbAfterSheet(function () { replaceHash('#bookings'); say('Booking discarded'); }); });
  });
  on('#nb_fresh', 'click', function () { var keep = JSON.stringify(NB); NB = nbFresh(); nbClearDraft(); render(false, true); undoSnack('Started a new booking', function () { NB = JSON.parse(keep); nbSaveDraft(); render(false, true); }); });
  var ld = $('.nb-leadd'); if (ld) ld.addEventListener('toggle', function () { if (NB) NB.open.lead = ld.open; });
  $$('[data-fold]').forEach(function (b) { b.onclick = function () { var k = b.dataset.fold; NB.open[k] = !NB.open[k]; nbRe(); }; });
  /* customer */
  on('#nb_custchange', 'click', function () { NB.cust = null; NB.newMode = false; NB.editCust = false; NB.blOverride = false; NB.f = nbBlankF(); NB.q = ''; nbRe(); setTimeout(function () { var q = $('#nb_q'); if (q) q.focus(); }, 50); });
  on('#nb_editcust', 'click', function () { NB.editCust = !NB.editCust; nbRe(); });
  on('#nb_searchagain', 'click', function () { NB.newMode = false; NB.q = NB.f.phone || NB.f.name || ''; nbRe(); });
  on('#nb_newcust', 'click', function () { nbStartNew(NB.q); });
  on('#nb_papers', 'click', nbOpenPapers);
  on('#nb_scan', 'click', nbOpenPapers);
  on('#nb_nat', 'click', nbNationality);
  $$('[data-f]').forEach(function (el) {
    var k = el.dataset.f;
    el.addEventListener('input', function () {
      if (!NB) return;
      NB.f[k] = el.value; el.classList.remove('bad'); var er = el.parentNode.querySelector('.err'); if (er && NB.tried) er.remove();
      if ((k === 'phone' || k === 'ic') && NB.newMode) nbDupeBox();
      nbSaveDraft(); nbPaint();
    });
    if (k === 'phone' || k === 'emPhone') el.addEventListener('blur', function () { if (NB && digits(el.value).length >= 9) { el.value = fmtPhone(normPhone(el.value)); NB.f[k] = el.value; if (NB.newMode) nbDupeBox(); nbSaveDraft(); } });
    if (k === 'phone') el.addEventListener('paste', function () { setTimeout(function () { if (NB && el.isConnected && digits(el.value).length >= 9) { el.value = fmtPhone(normPhone(el.value)); NB.f.phone = el.value; nbDupeBox(); nbSaveDraft(); nbPaint(); } }, 0); });
    if (k === 'ic' || k === 'licenceExp') el.addEventListener('change', function () { if (NB) nbRe(); });
  });
  if (NB.newMode) nbDupeBox();
  var q = $('#nb_q');
  if (q) {
    q.addEventListener('input', function () { NB.q = q.value; q.setAttribute('inputmode', /^[\d+]/.test(q.value) ? 'tel' : 'text'); nbSuggest(); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var b = $('#nb_sug [data-cust]'); if (b) b.click(); else nbStartNew(q.value); } });
    if (NB.q) nbSuggest();
  }
  /* dates */
  var sd = $('#nb_sd'), st = $('#nb_st'), ed = $('#nb_ed'), et = $('#nb_et');
  var startChanged = function () {
    if (!NB || !sd.value) return;
    var s0 = new Date(NB.s), e0 = new Date(NB.e), len = e0 - s0; if (!(len > 0)) len = DAY;
    var s2 = fromInputs(sd.value, st.value); if (isNaN(s2)) return;
    NB.s = s2.toISOString(); NB.e = new Date(s2.getTime() + len).toISOString(); nbRe();
  };
  sd.addEventListener('change', startChanged); st.addEventListener('change', startChanged);
  ed.addEventListener('change', function () {
    if (!NB || !ed.value) return; var s0 = new Date(NB.s), e0 = new Date(NB.e), p = fromInputs(ed.value, toTimeInput(e0)); if (isNaN(p)) return;
    if (!sameDay(p, e0)) p.setHours(s0.getHours(), s0.getMinutes(), 0, 0); /* a new end day takes the start's time */
    NB.e = p.toISOString(); nbRe();
  });
  et.addEventListener('change', function () { if (!NB) return; var p = fromInputs(ed.value || toLocalInput(NB.e), et.value); if (isNaN(p)) return; NB.e = p.toISOString(); nbRe(); });
  $$('.nb-lens [data-len]').forEach(function (b) { b.onclick = function () { NB.e = new Date(new Date(NB.s).getTime() + +b.dataset.len).toISOString(); nbRe(); }; });
  $$('.nb-lens [data-add]').forEach(function (b) { b.onclick = function () { var e0 = new Date(NB.e), s0 = new Date(NB.s); NB.e = new Date(Math.max(e0, s0) + +b.dataset.add).toISOString(); nbRe(); }; });
  /* car */
  on('#nb_car', 'click', function () {
    var s = new Date(NB.s), e = new Date(NB.e);
    Pickers.car({ start: e > s ? s : null, end: e > s ? e : null, selected: NB.car, onPick: function (c) { if (!NB) return; nbSetCar(c); nbRe(); } });
  });
  /* places */
  ['pick', 'ret'].forEach(function (end) {
    on('#nb_' + end, 'change', function () {
      var v = this.value, old = end === 'pick' ? NB.pick : NB.ret;
      if (end === 'pick') {
        NB.pick = v;
        /* the return follows the pick-up while they were the same */
        var same = old === NB.ret || (!NB.ret && !old);
        if (same && (v === '' || placeChoices('ret').some(function (o) { return o.v === v; }))) { NB.ret = v; NB.r['return'] = money2(nbPlaceFee(v, 'ret')); }
        NB.r.delivery = money2(nbPlaceFee(v, 'pick'));
      } else { NB.ret = v; NB.r['return'] = money2(nbPlaceFee(v, 'ret')); }
      nbRe();
    });
    on('#nb_' + end + 'note', 'input', function () { if (end === 'pick') NB.pickNote = this.value; else NB.retNote = this.value; nbSaveDraft(); });
  });
  /* cover */
  $$('[data-cov]').forEach(function (b) { b.onclick = function () { var v = b.dataset.cov; if (v.indexOf('pkg:') === 0) { NB.cover.mode = 'pkg'; NB.cover.pkg = v.slice(4); } else NB.cover.mode = v; nbRe(); }; });
  on('#nb_cvname', 'input', function () { NB.cover.name = this.value; nbSaveDraft(); nbPaint(); });
  ['daily', 'max'].forEach(function (k) {
    var el = $('#nb_cv' + k); if (!el) return;
    el.addEventListener('input', function () { if (!NB) return; NB.cover[k] = el.value; nbSaveDraft(); nbPaint(); });
    el.addEventListener('blur', function () { var v = parseMoney(el.value); if (NB && !isNaN(v)) { el.value = money2(v); NB.cover[k] = el.value; nbSaveDraft(); } });
  });
  /* money */
  $$('.nb-money').forEach(function (el) {
    var k = el.dataset.k;
    el.addEventListener('input', function () { if (!NB) return; NB.r[k] = el.value; el.classList.remove('bad'); var h = $('[data-hint="' + k + '"]'); if (h) h.innerHTML = nbHint(k); nbSaveDraft(); nbPaint(); });
    el.addEventListener('focus', function () { if (/^0(\.00)?$/.test(el.value)) el.select(); });
    el.addEventListener('blur', function () {
      if (!NB) return;
      var raw = el.value.trim(); if (raw === '' && ['discount', 'delivery', 'return', 'others'].indexOf(k) >= 0) raw = '0';
      var v = parseMoney(raw); if (!isNaN(v)) { el.value = money2(v); NB.r[k] = el.value; nbSaveDraft(); nbPaint(); }
      else if (raw !== '') { el.classList.add('bad'); }
    });
  });
  /* payment and status */
  ['method', 'status'].forEach(function (k) { $$('#nb_' + k + ' button').forEach(function (b) { b.onclick = function () { NB[k] = b.dataset.v; nbRe(); }; }); });
  on('#nb_paystatus', 'change', function () { NB.payStatus = this.value; nbRe(); });
  on('#nb_src', 'change', function () { NB.source = this.value; nbRe(); });
  on('#nb_note', 'input', function () { NB.note = this.value; nbSaveDraft(); });
}
/* inline customer search results */
function nbSuggest() {
  var box = $('#nb_sug'); if (!box) return;
  var t = String(NB.q || '').trim();
  if (t.length < 2) { box.innerHTML = ''; return; }
  var all = S.customers.filter(function (c) { return Pickers.customerMatches(c, t); });
  var count = function (c) { return S.bookings.filter(function (b) { return b.cust === c.id && b.bookingStatus !== 'Cancelled'; }).length; };
  var list = all.slice(0, 6);
  box.innerHTML = '<div class="nb-sug">' + (list.length ? list.map(function (c) {
    var n = count(c);
    return '<button type="button" class="pk-row" data-cust="' + c.id + '"><span class="av sm" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</span><span class="grow"><span class="pk-l1">' + esc(c.name) + '</span><span class="pk-sub nowrap">' + esc(c.phone) + (c.ic ? ' · ' + esc(maskIC(c.ic)) : '') + ' · ' + n + ' booking' + (n === 1 ? '' : 's') + '</span></span><span class="pk-end">' + custFlags(c).slice(0, 2).map(flagChip).join('') + '</span></button>';
  }).join('') + (all.length > 6 ? '<button type="button" class="nb-more" id="nb_allcust">' + (all.length - 6) + ' more · See all</button>' : '') : '<div class="nb-none">No customer matches “' + esc(t) + '”.</div>') + '</div>';
  $$('#nb_sug [data-cust]').forEach(function (b) { b.onclick = function () { nbPickCust(cust(b.dataset.cust)); }; });
  var all2 = $('#nb_allcust'); if (all2) all2.onclick = function () { Pickers.customer({ allowNew: true, onPick: function (c, typed) { if (c) nbPickCust(c); else nbStartNew(typed); } }); var pq = $('#pkq'); if (pq) { pq.value = t; pq.dispatchEvent(new Event('input')); } };
}
function nbStartNew(typed) {
  typed = String(typed || '').trim(); NB.newMode = true; NB.cust = null; NB.f = nbBlankF();
  if (typed) { if (tidySearch(typed)) NB.f.phone = fmtPhone(typed); else if (/^\d{6}-?\d{2}-?\d{4}$/.test(typed)) NB.f.ic = typed; else NB.f.name = typed.replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }
  nbRe();
  setTimeout(function () { var el = $('[data-f="' + (NB.f.name ? 'phone' : 'name') + '"]'); if (el) el.focus(); }, 60);
}
/* pick a known customer; a blacklisted one needs customers.blacklist_edit and a confirm */
function nbPickCust(c) {
  if (!c || !NB) return;
  var go = function (override) { NB.cust = c.id; NB.newMode = false; NB.editCust = false; NB.q = ''; NB.blOverride = !!override; NB.f = nbFillFromCust(c); nbRe(); };
  if (!c.blacklist) { go(false); return; }
  nbBlacklistGate(c).then(function (ok) { if (ok) go(true); });
}
function nbBlacklistGate(c) {
  var reason = c.blacklist && c.blacklist.reason || 'no reason given';
  if (!can('customers.blacklist_edit')) {
    return confirm({ icon: 'danger', title: 'Blacklisted customer', text: 'This customer is blacklisted: ' + reason + '. Ask the owner to make this booking.', ok: 'OK', cancel: 'Back' }).then(function () { return false; });
  }
  return confirm({ icon: 'danger', title: 'Blacklisted customer', text: 'This customer is blacklisted: ' + reason + '. Book anyway?', ok: 'Book anyway', cancel: 'Go back', primary: 'cancel', danger: true });
}
/* new customer: a typed phone or IC that matches someone we know */
function nbDupeBox() {
  var box = $('#nb_dupe'); if (!box) return;
  var d = nbDupes(NB.f)[0];
  if (!d) { box.innerHTML = ''; return; }
  var c = d.c, bl = !!c.blacklist;
  box.innerHTML = '<div class="banner ' + (bl ? 'red' : 'amber') + ' nb-dupe">' + I(bl ? 'warn' : 'users') + '<div class="grow"><b>' + esc(c.name) + ' already uses this ' + (d.by === 'IC' ? 'IC' : 'number') + '.</b> ' + (bl ? 'This customer is blacklisted: ' + esc(c.blacklist.reason || '') + '. ' : '') + 'Use ' + esc(c.name) + '?' +
    '<div class="nb-dupe-act"><button type="button" class="btn sm" id="nb_usedupe">Use ' + esc(firstName(c.name)) + '</button></div></div></div>';
  $('#nb_usedupe').onclick = function () { nbPickCust(c); };
}
function nbNationality() {
  var sh = sheet(sheetHead('Nationality') + '<label class="search pk-search">' + I('search') + '<input id="nb_natq" type="search" placeholder="Search" autocomplete="off"></label><div class="pk-list nb-natlist" id="nb_natlist"></div>', null, { full: true, stack: true, cls: 'picker' });
  var draw = function () {
    var t = $('#nb_natq', sh).value.trim().toLowerCase();
    var list = NB_NATIONS.filter(function (n) { return !t || n.toLowerCase().indexOf(t) >= 0; });
    $('#nb_natlist', sh).innerHTML = list.map(function (n, i) { return (i === 16 && !t ? '<div class="pk-sec">All</div>' : '') + '<button type="button" class="pk-row' + (n === NB.f.nationality ? ' on' : '') + '" data-n="' + esc(n) + '"><span class="grow"><span class="pk-l1">' + esc(n) + '</span></span>' + (n === NB.f.nationality ? I('check', 2.4) : '') + '</button>'; }).join('') || '<div class="empty">No match</div>';
    $$('[data-n]', sh).forEach(function (b) { b.onclick = function () { NB.f.nationality = b.dataset.n; closeSheet(); nbRe(); }; });
  };
  $('#nb_natq', sh).addEventListener('input', draw); draw();
}
function nbOpenPapers() {
  IdCheck.open({
    name: NB.f.name || (NB.cust ? cust(NB.cust).name : ''), ic: NB.f.ic, docs: NB.docs, check: NB.icCheck,
    onDocs: function (docs) { if (!NB) return; NB.docs = docs; nbSaveDraft(); },
    onCheck: function (chk) { if (!NB) return; NB.icCheck = chk; nbSaveDraft(); },
    onFill: function (p) {
      if (!NB) return;
      if (NB.cust && !NB.editCust) NB.editCust = true;
      if (p.name) NB.f.name = p.name;
      if (p.ic) NB.f.ic = p.ic; else if (p.passport) NB.f.ic = p.passport;
      if (p.nationality) NB.f.nationality = p.nationality;
      if (p.licenceNo) NB.f.licenceNo = p.licenceNo;
      if (p.licenceExp) NB.f.licenceExp = p.licenceExp;
      nbSaveDraft();
    },
    onClose: function () { if (NB && route().name === 'new') render(false, true); }
  });
}

/* ---------- save ---------- */
function nbFocusProblem(p) {
  var map = { cust: 'nbs_cust', dates: 'nbs_dates', car: 'nbs_car', price: 'nbs_price', cover: 'nbs_cover', top: 'nbs_cust' };
  var el = $('#nbf_' + p.key) || $('#' + map[p.sec]);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('nb-flash'); setTimeout(function () { el.classList.remove('nb-flash'); }, 1400); var i = el.querySelector && el.querySelector('input:not([disabled])'); if (i && p.sec === 'cust') setTimeout(function () { try { i.focus({ preventScroll: true }); } catch (e) {} }, 350); }
}
function saveNew() {
  var n = NB; if (!n || NB_SAVING) return;
  var probs = nbProblems();
  if (probs.length) {
    n.tried = true;
    if (probs[0].sec === 'cust' && !n.cust && !n.newMode) { if (String(n.q || '').trim()) { n.newMode = true; nbStartNewKeep(n.q); } }
    render(false, true); nbFocusProblem(probs[0]); say(probs[0].short); return;
  }
  var steps = Promise.resolve(true);
  if (new Date(n.s) < new Date(Date.now() - 5 * MIN)) steps = steps.then(function (ok) { return ok && confirm({ icon: 'warn', title: 'Pick-up is in the past', text: 'Pick-up is in the past (' + when(n.s) + '). Continue?', ok: 'Yes, continue', cancel: 'Change the date', primary: 'cancel' }); });
  /* never make a duplicate customer: a typed phone or IC we know uses that customer */
  var dupe = !n.cust ? nbDupes(n.f)[0] : null;
  if (dupe) steps = steps.then(function (ok) {
    if (!ok) return false;
    if (dupe.c.blacklist) return nbBlacklistGate(dupe.c).then(function (y) { if (y) { n.cust = dupe.c.id; n.blOverride = true; n.newMode = false; } return y; });
    n.cust = dupe.c.id; n.newMode = false; n.dupeUsed = dupe.c.name + ' (same ' + (dupe.by === 'IC' ? 'IC' : 'phone') + ')'; return true;
  });
  if (n.cust && cust(n.cust).blacklist && !n.blOverride) steps = steps.then(function (ok) { return ok && nbBlacklistGate(cust(n.cust)).then(function (y) { if (y) n.blOverride = true; return y; }); });
  NB_SAVING = true; var btn = $('#nb_save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  steps.then(function (ok) { return new Promise(function (res) { nbAfterSheet(function () { res(ok); }); }); }).then(function (ok) {
    if (!ok || NB !== n) { NB_SAVING = false; if (NB === n) nbPaint(); return; }
    var b = nbCommit(n);
    NB = null; NB_SAVING = false; nbClearDraft();
    replaceHash('#booking/' + b.id);
    nbAfterSave(b);
  }).catch(function (e) { NB_SAVING = false; console.error(e); say('Could not save: ' + (e && e.message || e)); if (NB) nbPaint(); });
}
/* run fn once a just-closed confirm sheet has taken its history step back (so a hash change is not undone by it) */
function nbAfterSheet(fn) { var n = 0, wait = function () { if ((!history.state || !history.state.fmsSheet) || n++ > 20) fn(); else setTimeout(wait, 30); }; setTimeout(wait, 30); }
function nbStartNewKeep(typed) { var t = String(typed || '').trim(); if (tidySearch(t)) NB.f.phone = fmtPhone(t); else if (t) NB.f.name = t; }
function nbIcSplit(f) {
  var raw = String(f.ic || '').trim(), d = digits(raw);
  if (!raw) return { ic: '', passport: '' };
  if ((!f.nationality || f.nationality === 'Malaysian') && d.length === 12 && /^[\d\s-]+$/.test(raw)) return { ic: d.slice(0, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8), passport: '' };
  return { ic: '', passport: raw.toUpperCase() };
}
function nbCommit(n) {
  var f = n.f, nowIso = new Date().toISOString(), ids = nbIcSplit(f), cid = n.cust, changed = {};
  var em = { name: String(f.emName || '').trim(), phone: f.emPhone ? fmtPhone(f.emPhone) : '', relation: String(f.emRel || '').trim() };
  var docs = Object.assign({ icFront: null, icBack: null, passport: null, licence: null, poa: null, other: [] }, n.docs || {});
  if (!cid) {
    cid = 'cu' + uid();
    S.customers.push({ id: cid, name: String(f.name).trim(), phone: fmtPhone(normPhone(f.phone)), email: String(f.email || '').trim(), ic: ids.ic, passport: ids.passport, nationality: f.nationality || 'Malaysian',
      licenceNo: String(f.licenceNo || '').trim().toUpperCase(), licenceExp: f.licenceExp || '', address: String(f.address || '').trim(), emergency: em.name || em.phone ? em : null, blacklist: null,
      docs: JSON.parse(JSON.stringify(docs)), created: nowIso });
    audit('Added customer ' + String(f.name).trim(), { cust: cid });
  } else {
    var c = cust(cid);
    if (n.editCust || n.docs) {
      var set = function (k, v) { v = v == null ? '' : v; if (String(c[k] || '') !== String(v)) { changed[k] = [c[k] || '', v]; c[k] = v; } };
      if (n.editCust) {
        set('name', String(f.name).trim()); set('phone', fmtPhone(normPhone(f.phone))); set('email', String(f.email || '').trim());
        if (ids.ic || ids.passport) { set('ic', ids.ic || c.ic || ''); if (ids.passport) set('passport', ids.passport); }
        set('nationality', f.nationality || c.nationality || ''); set('licenceNo', String(f.licenceNo || '').trim().toUpperCase()); set('licenceExp', f.licenceExp || ''); set('address', String(f.address || '').trim());
        var oe = c.emergency || {}; if ((oe.name || '') !== em.name || (oe.phone || '') !== em.phone || (oe.relation || '') !== em.relation) { changed.emergency = [oe.name || '', em.name]; c.emergency = em.name || em.phone ? em : null; }
      }
      c.docs = c.docs || { icFront: null, icBack: null, passport: null, licence: null, poa: null, other: [] };
      ['icFront', 'icBack', 'passport', 'licence', 'poa'].forEach(function (k) { if (docs[k]) c.docs[k] = docs[k]; });
      if (docs.other && docs.other.length) c.docs.other = (c.docs.other || []).concat(docs.other);
      if (Object.keys(changed).length) audit('Updated details of ' + c.name + ' from a new booking', { cust: cid, changes: changed });
    }
  }
  var t = nbTemp(), no = S.nextNo++;
  var b = blankBooking({ no: no, code: bookingCode(no), cust: cid, car: t.car, start: n.s, end: n.e, created: nowIso, createdBy: S.me, source: n.source,
    bookingStatus: n.status === 'Confirmed' ? 'Confirmed' : 'Pending', paymentStatus: n.payStatus || null, method: nbMoneyMode() === 'edit' ? n.method : 'Cash',
    rates: t.rates, cover: t.cover, pickKind: t.pickKind, pickLoc: t.pickLoc, pickNote: String(n.pickNote || '').trim(), retKind: t.retKind, retLoc: t.retLoc, retNote: String(n.retNote || '').trim(),
    note: String(n.note || '').trim(), leadId: n.leadId || null, docs: docs, formId: uid() + uid().slice(0, 4), agentToken: uid() + uid() });
  if (B().signature) b.signature = B().signature;
  if (n.icCheck) b.icCheck = n.icCheck;
  b.log.push({ at: nowIso, by: S.me, text: 'Booking made' + (n.source !== 'Staff' ? ' (' + n.source + ')' : '') + (b.bookingStatus === 'Confirmed' ? ', Confirmed' : '') + (b.paymentStatus ? ', payment status ' + b.paymentStatus : '') });
  if (n.blOverride) b.log.push({ at: nowIso, by: S.me, text: 'Booked a blacklisted customer anyway (' + ((cust(cid).blacklist || {}).reason || 'no reason given') + ')' });
  if (n.dupeUsed) b.log.push({ at: nowIso, by: S.me, text: 'Used the existing customer ' + n.dupeUsed + ' instead of making a new one' });
  var nd = ['icFront', 'icBack', 'passport', 'licence', 'poa'].filter(function (k) { return docs[k]; }).length + (docs.other || []).length;
  if (nd) b.log.push({ at: nowIso, by: S.me, text: 'Added ' + nd + ' paper' + (nd > 1 ? 's' : '') + ' with the booking' + (n.icCheck ? ' (' + n.icCheck.label + ')' : '') });
  S.bookings.push(b);
  audit('Made booking ' + b.code, { booking: b.id, cust: cid, car: b.car });
  if (n.leadId) { var w = byId(S.wa, n.leadId); if (w) { w.status = 'Booked'; w.bookingId = b.id; if (w.lead) { w.lead.state = 'booked'; w.lead.bookingId = b.id; } } }
  S.recentBookings = [b.id].concat((S.recentBookings || []).filter(function (x) { return x !== b.id; })).slice(0, 5);
  save();
  return b;
}
function nbFormText(b) {
  var c = cust(b.cust), k = car(b.car) || {};
  return 'Hi ' + firstName(c.name) + ', thank you for booking with ' + B().name + '.\n\nBooking ' + b.code + ': ' + (k.make ? k.make + ' ' + k.model + ' (' + k.plate + ')' : '') + '\n' + dLong(b.start) + ', ' + hm(b.start) + ' to ' + dLong(b.end) + ', ' + hm(b.end) +
    '\n\nPlease fill in and sign your booking form here:\n' + Links.form(b);
}
function nbAfterSave(b) {
  var c = cust(b.cust), m = calcBooking(b), money = nbMoneyModeFor();
  var row = function (id, icon, t1, t2) { return '<button type="button" class="row nb-after-row" id="' + id + '">' + I(icon) + '<div class="grow"><div class="t1">' + t1 + '</div>' + (t2 ? '<div class="t2">' + t2 + '</div>' : '') + '</div>' + I('chev') + '</button>'; };
  var canPay = can('billing.record_payment') && m.deposit > 0;
  sheet('<div class="nb-after"><div class="confirm-ic info nb-ok">' + I('check', 2.6) + '</div><h3>Booking ' + esc(b.code) + ' saved</h3><p class="lead">' + esc(c.name) + ' · ' + esc((car(b.car) || {}).plate || '') + ' · ' + dShort(b.start) + ' to ' + dShort(b.end) + (money ? ' · <span class="money">' + rm(m.payable) + '</span>' : '') + '</p>' +
    '<div class="list nb-after-list">' + (canPay ? row('nba_dep', 'cash', 'Record deposit now', 'Security deposit <span class="money">' + rm(m.deposit) + '</span>') : '') +
    row('nba_wa', 'wa', 'Send booking form on WhatsApp', esc(c.phone)) + row('nba_sign', 'edit', 'Let the customer sign on this phone', 'Hand the phone to the customer') + '</div>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="nba_done">Done</button></div></div>', function (sh) {
      var d = $('#nba_dep', sh); if (d) d.onclick = function () { Pay.open(b.id, { kinds: ['Security deposit'], amount: m.deposit }); };
      $('#nba_wa', sh).onclick = function () { Share.wa(c.phone, nbFormText(b)); bLog(b, 'Booking form sent on WhatsApp'); save(); say('Opening WhatsApp'); };
      $('#nba_sign', sh).onclick = function () { nbSignHere(b); };
      $('#nba_done', sh).onclick = function () { closeSheet(); };
    });
}
function nbMoneyModeFor() { return can('bookings.see_amounts') || can('bookings.edit_amounts'); }
/* the customer signs the booking form on the staff phone (simulated form page) */
function nbSignHere(b) {
  var c = cust(b.cust), k = car(b.car) || {}, m = calcBooking(b);
  var sh = sheet('<div class="nb-sign">' + sheetHead('Booking form', B().name + ' · ' + b.code) +
    '<p class="small muted">Hand the phone to ' + esc(firstName(c.name)) + '. They check the details, agree to the terms and sign with a finger.</p>' +
    '<div class="nb-sign-card"><div class="nb-kv"><span>Name</span><b>' + esc(c.name) + '</b></div><div class="nb-kv"><span>Phone</span><b>' + esc(c.phone) + '</b></div>' +
    '<div class="nb-kv"><span>Car</span><b>' + esc((k.make || '') + ' ' + (k.model || '') + ' · ' + (k.plate || '')) + '</b></div><div class="nb-kv"><span>From</span><b>' + esc(dLong(b.start) + ', ' + hm(b.start)) + '</b></div>' +
    '<div class="nb-kv"><span>To</span><b>' + esc(dLong(b.end) + ', ' + hm(b.end)) + '</b></div><div class="nb-kv"><span>Pick-up</span><b>' + esc(placeText(b, 'pick')) + '</b></div>' +
    (nbMoneyModeFor() ? '<div class="nb-kv"><span>Total</span><b class="money">' + rm(m.payable) + '</b></div><div class="nb-kv"><span>Deposit</span><b class="money">' + rm(m.deposit) + '</b></div>' : '') + '</div>' +
    '<label class="nb-agree"><input type="checkbox" id="nbs_agree"><span>I have read and agree to the rental terms of ' + esc(B().name) + ', and the details above are correct.</span></label>' +
    '<div class="nb-padwrap"><canvas id="nbs_pad" class="nb-pad noswipe" width="600" height="220"></canvas><span class="nb-padhint" id="nbs_hint">Sign here</span><button type="button" class="btn link sm nb-padclear" id="nbs_clear">Clear</button></div>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="nbs_ok" disabled>Sign and send</button></div></div>', null, { full: true, stack: true, noSwipe: true });
  var cv = $('#nbs_pad', sh), ctx = cv.getContext('2d'), drawn = 0, down = false, last = null;
  ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1B2333';
  var pt = function (e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
  var upd = function () { $('#nbs_ok', sh).disabled = !(drawn > 8 && $('#nbs_agree', sh).checked); $('#nbs_hint', sh).style.display = drawn ? 'none' : ''; };
  cv.addEventListener('pointerdown', function (e) { down = true; last = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
  cv.addEventListener('pointermove', function (e) { if (!down) return; var p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; drawn++; upd(); e.preventDefault(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { down = false; }); });
  $('#nbs_clear', sh).onclick = function () { ctx.clearRect(0, 0, cv.width, cv.height); drawn = 0; upd(); };
  $('#nbs_agree', sh).onchange = upd;
  $('#nbs_ok', sh).onclick = function () {
    var bb = bk(b.id); if (!bb) return;
    var prev = bb.bookingStatus; bb.submitted = true;
    var ch = applyStatusRules(bb, prev);
    bLog(bb, 'Customer signed the booking form on a staff phone' + (ch.length ? ' (' + ch.join(', ') + ')' : ''), prev !== bb.bookingStatus ? { bookingStatus: [prev, bb.bookingStatus] } : null);
    save(); closeAllSheets(); render(false, true);
    notify('change', 'Form signed', c.name + ' signed the booking form for ' + bb.code, '#booking/' + bb.id, { self: true });
  };
}

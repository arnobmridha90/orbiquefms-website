/* ---------------- CARS (M7 builder owns this file) ----------------
   #cars      the fleet: sticky plate search, status chips with counts, one row per car
   #car/<id>  the car page (health card): photos, papers, service, odometer, rates, owner, instalment, where it is, quick actions
   API: CarPage.open(id), CarPage.edit(id), CarPage.km(id), CarPage.odoHistory(id), CarPage.photos(id)
   Shared helpers for the M7 files (maintenance.js, summons.js, tracking.js) live in M7 below. */

var M7 = (function () {
  var PAPER_TYPES = ['Road tax', 'Insurance', 'Grant', 'PUSPAKOM', 'Permit'];
  var PAPER_LABEL = { 'Road tax': 'Road tax', 'Insurance': 'Insurance', 'Grant': 'Car grant', 'PUSPAKOM': 'PUSPAKOM', 'Permit': 'Rental permit' };
  function km(n) { return n == null || n === '' || isNaN(+n) ? 'Not recorded' : Math.round(+n).toLocaleString('en-US') + ' km'; }
  function kmNum(v) { var s = String(v == null ? '' : v).replace(/[,\s]/g, '').replace(/km$/i, ''); return /^\d{1,7}$/.test(s) ? +s : NaN; }
  /* the car's odometer: the highest trusted reading, or what is stored on the car */
  function odo(carId) {
    var c = car(carId), best = c ? +c.km || 0 : 0;
    (S.odometer || []).forEach(function (o) { if (o.car === carId && o.trusted !== false && +o.km > best) best = +o.km; });
    return best || null;
  }
  function lastReading(carId) { return (S.odometer || []).filter(function (o) { return o.car === carId && o.trusted !== false; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); })[0] || null; }
  /* paper chip: red once expired, amber within its warning days, green otherwise; Grant has no expiry */
  function paperState(p) {
    if (!p) return { tone: 'grey', text: 'Not recorded', days: null, level: 'none' };
    if (!p.until) return { tone: 'green', text: 'On file', days: null, level: 'ok' };
    var d = daysUntil(p.until + 'T00:00:00'), warn = +p.warnDays || 30;
    if (d < 0) return { tone: 'red', text: 'Expired ' + (-d) + ' day' + (d === -1 ? '' : 's') + ' ago', days: d, level: 'overdue' };
    if (d === 0) return { tone: 'amber', text: 'Expires today', days: 0, level: 'soon' };
    if (d <= warn) return { tone: 'amber', text: 'Expires in ' + d + ' day' + (d === 1 ? '' : 's'), days: d, level: 'soon' };
    return { tone: 'green', text: 'Valid', days: d, level: 'ok' };
  }
  function ymd(s) { if (!s) return ''; var a = String(s).slice(0, 10).split('-'); return dFull(new Date(+a[0], +a[1] - 1, +a[2])); }
  function curDowntime(carId) { var n = Date.now(); return (S.downtime || []).filter(function (d) { return d.car === carId && new Date(d.from).getTime() <= n && (!d.to || new Date(d.to).getTime() > n); })[0] || null; }
  function nextBooking(carId) { var n = Date.now(); return S.bookings.filter(function (b) { return b.car === carId && UPCOMING.indexOf(b.bookingStatus) >= 0 && new Date(b.start).getTime() > n; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0] || null; }
  /* where the car is in its life right now: free / rent / late / workshop / inactive / sold */
  function carState(c) {
    if (c.status === 'sold') return { key: 'sold', text: 'Sold', tone: 'grey' };
    if (c.status === 'inactive') return { key: 'inactive', text: 'Not in use', tone: 'grey' };
    var now = carNow(c.id);
    if (now && now.bookingStatus === 'Car Delivered') {
      if (isLate(now)) return { key: 'late', text: 'Late since ' + (sameDay(now.end, new Date()) ? hm(now.end) : dShort(now.end) + ', ' + hm(now.end)), tone: 'red', booking: now };
      return { key: 'rent', text: 'On rent until ' + dShort(now.end), tone: 'blue', booking: now };
    }
    var dt = curDowntime(c.id);
    if (dt) return { key: 'workshop', text: dt.to ? 'Workshop until ' + dShort(dt.to) : 'In the workshop', tone: 'orange', downtime: dt };
    if (now) return { key: 'rent', text: 'Booked until ' + dShort(now.end), tone: 'blue', booking: now };
    return { key: 'free', text: 'Free', tone: 'green' };
  }
  function papersDue(c) { return ['Road tax', 'Insurance', 'PUSPAKOM', 'Permit'].some(function (t) { var s = paperState(carPaper(c.id, t)); return s.level === 'overdue' || s.level === 'soon'; }); }
  function telOf(p) { var n = normPhone(p); return n ? '+' + n : ''; }
  function thumb(src, attrs) { return '<button type="button" class="thumb m7-thumb"' + (attrs || '') + '><img alt="" src="' + esc(imgSrc(src)) + '"></button>'; }
  /* a photo field: thumb + 'Take or choose' + 'Sample (demo)'. wirePhoto(sh, id, onChange(dataUrl|null), opts) */
  function photoField(id, label, cur) {
    return '<div class="field m7-photo" id="' + id + '"><span>' + esc(label) + '</span><div class="m7-photo-in">' +
      '<div class="m7-photo-pic">' + (cur ? '<img alt="" src="' + esc(imgSrc(cur)) + '">' : I('camera')) + '</div>' +
      '<div class="m7-photo-btns"><button type="button" class="btn ghost sm" data-ph="take">' + I('camera') + (cur ? 'Change photo' : 'Take or choose') + '</button>' +
      '<button type="button" class="btn link sm" data-ph="sample">Use a sample picture</button>' + (cur ? '<button type="button" class="btn link red sm" data-ph="del">Remove</button>' : '') + '</div></div><small class="hint m7-ph-note"></small></div>';
  }
  function wirePhoto(sh, id, onChange, opts) {
    opts = opts || {};
    var box = $('#' + id, sh); if (!box) return;
    var set = function (r) {
      var pic = $('.m7-photo-pic', box); pic.innerHTML = r ? '<img alt="" src="' + esc(imgSrc(r.dataUrl)) + '">' : I('camera');
      $('[data-ph=take]', box).innerHTML = I('camera') + (r ? 'Change photo' : 'Take or choose');
      $('.m7-ph-note', box).textContent = r && r.note ? r.note : '';
      var del = $('[data-ph=del]', box); if (r && !del) { del = document.createElement('button'); del.type = 'button'; del.className = 'btn link red sm'; del.dataset.ph = 'del'; del.textContent = 'Remove'; $('.m7-photo-btns', box).appendChild(del); wireDel(); } else if (!r && del) del.remove();
      onChange(r ? r.dataUrl : null, r);
    };
    var wireDel = function () { var d = $('[data-ph=del]', box); if (d) d.onclick = function () { set(null); }; };
    $('[data-ph=take]', box).onclick = function () { Media.photo({ capture: opts.capture === false ? false : 'environment', maxPx: opts.maxPx || 1000, quality: .7 }).then(set, function () {}); };
    $('[data-ph=sample]', box).onclick = function () { Media.sample(opts.kind || 'doc', opts.sample || label).then(set); };
    wireDel();
  }
  function zoom(src, opts) {
    opts = opts || {};
    sheet(sheetHead(opts.title || 'Photo', opts.sub || '') + '<div class="m7-zoom"><img alt="" src="' + esc(imgSrc(src)) + '"></div>' +
      (opts.onRemove ? '<div class="sheet-foot"><button type="button" class="btn ghost m7-red" id="m7zdel">' + I('trash') + 'Remove this photo</button></div>' : ''), function (sh) {
        var d = $('#m7zdel', sh); if (d) d.onclick = function () { confirm({ icon: 'danger', title: 'Remove this photo?', text: 'It is taken off for good.', ok: 'Yes, remove', danger: true }).then(function (ok) { if (ok) { closeSheet(); opts.onRemove(); } }); };
      }, { stack: true });
  }
  function dateVal(s) { return s ? String(s).slice(0, 10) : ''; }
  function addYear(ymdS) { var b = ymdS ? new Date(ymdS + 'T00:00:00') : new Date(); if (b < sod(new Date())) b = sod(new Date()); b.setFullYear(b.getFullYear() + 1); return toLocalInput(b); }
  return { PAPER_TYPES: PAPER_TYPES, PAPER_LABEL: PAPER_LABEL, km: km, kmNum: kmNum, odo: odo, lastReading: lastReading, paperState: paperState, ymd: ymd, curDowntime: curDowntime,
    nextBooking: nextBooking, carState: carState, papersDue: papersDue, telOf: telOf, thumb: thumb, photoField: photoField, wirePhoto: wirePhoto, zoom: zoom, dateVal: dateVal, addYear: addYear };
})();

/* a few cars start with photos so the gallery is not empty in the demo */
SEEDERS.push({ key: 'm7Gallery', fn: function (d) { d.m7Gallery = 1; (d.cars || []).slice(0, 4).forEach(function (c, i) { if (!c.gallery || !c.gallery.length) c.gallery = ['demo:car:Front', 'demo:car:Side'].concat(i % 2 ? ['demo:car:Inside'] : []); }); } });

var CRS = { q: '', f: 'all' };
VIEW_STATE.push(function () { CRS.q = ''; CRS.f = 'all'; });

var CarPage = (function () {
  var FILTERS = [
    { k: 'all', label: 'All' }, { k: 'free', label: 'Available' }, { k: 'rent', label: 'On rent' }, { k: 'late', label: 'Late' }, { k: 'workshop', label: 'In workshop' },
    { k: 'papers', label: 'Papers due' }, { k: 'inactive', label: 'Not in use' }, { k: 'sold', label: 'Sold' }];
  function passes(c, st, k) {
    if (k === 'all') return c.status !== 'sold';
    if (k === 'papers') return c.status !== 'sold' && M7.papersDue(c);
    if (k === 'rent') return st.key === 'rent' || st.key === 'late';
    return st.key === k;
  }
  function matches(c, q) {
    if (!q) return true;
    var np = normPlate(q);
    return (np && normPlate(c.plate).indexOf(np) >= 0) || wordsMatch(q, [c.make, c.model, c.color, c.type, c.serial, c.year, c.engineNo].join(' '));
  }

  /* ---------- #cars ---------- */
  function listView() {
    if (!can('cars.view')) return { html: topbar('Cars', { back: '#more' }) + '<main>' + noAccess('cars.view') + '</main>' };
    var act = S.cars.filter(function (c) { return c.status !== 'sold'; }).length;
    var html = topbar('Cars', { back: '#more', sub: act + ' cars' }) + '<main class="cr-main">' +
      '<div class="cr-sticky"><label class="search cr-search">' + I('search') + '<input id="crq" type="search" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" placeholder="Plate, model, colour or VIN" value="' + esc(CRS.q) + '">' +
      '<button type="button" class="cr-clear" id="crclr" aria-label="Clear"' + (CRS.q ? '' : ' hidden') + '>' + I('x', 2.2) + '</button></label>' +
      '<div class="chiprow cr-chips" id="crchips"></div></div><div id="crlist"></div></main>';
    return { html: html, after: wireList };
  }
  function wireList() {
    var inp = $('#crq'), clr = $('#crclr'), tmr = null;
    inp.addEventListener('input', function () { clr.hidden = !inp.value; clearTimeout(tmr); tmr = setTimeout(function () { CRS.q = inp.value; draw(); }, 80); });
    clr.onclick = function () { inp.value = ''; clr.hidden = true; CRS.q = ''; draw(); inp.focus(); };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { inp.blur(); } });
    draw();
  }
  function draw() {
    var q = CRS.q.trim(), rows = S.cars.map(function (c) { return { c: c, st: M7.carState(c) }; }).filter(function (r) { return matches(r.c, q); });
    $('#crchips').innerHTML = FILTERS.map(function (f) {
      var n = rows.filter(function (r) { return passes(r.c, r.st, f.k); }).length;
      if (f.k !== 'all' && f.k !== CRS.f && !n && (f.k === 'late' || f.k === 'sold')) return '';
      return '<button type="button" class="fchip' + (f.k === CRS.f ? ' on' : '') + '" data-f="' + f.k + '">' + esc(f.label) + ' <span class="n">' + n + '</span></button>';
    }).join('');
    $$('#crchips button').forEach(function (b) { b.onclick = function () { CRS.f = b.dataset.f; draw(); }; });
    var list = rows.filter(function (r) { return passes(r.c, r.st, CRS.f); }).sort(function (a, b) { return a.c.plate.localeCompare(b.c.plate); });
    var label = FILTERS.filter(function (f) { return f.k === CRS.f; })[0].label;
    var html = '<div class="cr-count">' + list.length + ' car' + (list.length === 1 ? '' : 's') + (q ? ' for “' + esc(q) + '”' : '') + (CRS.f !== 'all' ? ' · ' + esc(label) : '') + '</div>';
    if (!list.length) html += '<div class="empty card">' + I('car') + '<div>No car matches' + (q ? ' “' + esc(q) + '”' : '') + (CRS.f !== 'all' ? ' in ' + esc(label) : '') + '.</div>' + (CRS.f !== 'all' ? '<button type="button" class="btn link" id="crall">Show all cars</button>' : '') + '</div>';
    else html += '<div class="list cr-list">' + list.map(rowHtml).join('') + '</div>';
    $('#crlist').innerHTML = html;
    var a = $('#crall'); if (a) a.onclick = function () { CRS.f = 'all'; draw(); };
  }
  function rowHtml(r) {
    var c = r.c, st = r.st, rt = M7.paperState(carPaper(c.id, 'Road tax'));
    return '<a class="cr-row" href="#car/' + c.id + '"><span class="cr-pic">' + carSVG(c.color, c.shape) + '</span><span class="cr-mid">' +
      '<span class="cr-plate">' + esc(c.plate) + '</span><span class="cr-sub">' + esc(c.make + ' ' + c.model + ' · ' + c.color) + '</span>' +
      '<span class="cr-chipline">' + chip(st.text, st.tone) + (c.status !== 'sold' ? chip(rt.level === 'ok' ? 'Road tax valid' : 'Road tax: ' + rt.text.replace(/^Expires/, 'expires').replace(/^Expired/, 'expired').replace(/^Not recorded/, 'not recorded'), rt.tone) : '') +
      '<span class="cr-km">' + esc(M7.km(M7.odo(c.id))) + '</span></span></span>' +
      '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></a>';
  }

  /* ---------- #car/<id> ---------- */
  function pageView(r) {
    var c = car(r.a);
    if (!can('cars.view')) return { html: topbar('Car', { back: '#cars' }) + '<main>' + noAccess('cars.view') + '</main>' };
    if (!c) return { html: topbar('Car', { back: '#cars' }) + '<main><div class="empty card">' + I('car') + '<div>This car is not in the list any more.</div><a class="btn link" href="#cars">See all cars</a></div></main>' };
    var st = M7.carState(c), cur = carNow(c.id), nxt = M7.nextBooking(c.id), dt = M7.curDowntime(c.id);
    var right = can('cars.edit') ? '<button class="iconbtn" onclick="CarPage.edit(\'' + c.id + '\')" aria-label="Edit car details">' + I('edit') + '</button>' : '';
    var gal = (c.gallery || []);
    var hero = '<div class="hero cr-hero">' +
      (gal.length ? '<div class="cr-gal noswipe">' + gal.map(function (g, i) { return '<button type="button" class="cr-gimg" onclick="CarPage.zoomPhoto(\'' + c.id + '\',' + i + ')"><img alt="Photo ' + (i + 1) + '" src="' + esc(imgSrc(g)) + '"></button>'; }).join('') +
        (can('cars.manage_gallery') ? '<button type="button" class="cr-gadd" onclick="CarPage.photos(\'' + c.id + '\')">' + I('camera') + '<span>Add</span></button>' : '') + '</div>'
        : '<div class="carpic">' + carSVG(c.color, c.shape) + '</div>' + (can('cars.manage_gallery') ? '<button type="button" class="btn ghost sm cr-addph" onclick="CarPage.photos(\'' + c.id + '\')">' + I('camera') + 'Add photos</button>' : '')) +
      '<div class="cr-title"><div class="cr-bigplate">' + esc(c.plate) + '</div><div class="cr-model">' + esc(c.make + ' ' + c.model) + '</div><div class="cr-meta">' + esc([c.year, c.type, c.color].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="cr-chips2">' + chip(st.text, st.tone) + (c.status === 'active' ? chip(c.showOnWebsite === false ? 'Hidden from website' : 'On the website', c.showOnWebsite === false ? 'grey' : 'emerald') : '') + '</div></div></div>';
    /* current or next booking */
    var bkCard = '';
    var bkRow = function (b, label) { var cu = cust(b.cust); return '<a class="card2 cr-bk" href="#booking/' + b.id + '"><div class="c2-main"><div class="c2-t1">' + esc(label) + ': ' + esc(b.code) + ' · ' + esc(cu.name) + '</div><div class="c2-t2">' + esc(when(b.start)) + ' to ' + esc(when(b.end)) + '</div></div>' + statusChip(b) + '</a>'; };
    if (cur) bkCard += bkRow(cur, isLate(cur) ? 'Late' : cur.bookingStatus === 'Car Delivered' ? 'On rent now' : 'Booked now');
    if (nxt) bkCard += bkRow(nxt, 'Next');
    if (!bkCard) bkCard = '<div class="card2"><div class="c2-main"><div class="c2-t1">No booking coming up</div><div class="c2-t2">' + (c.status === 'active' && !dt ? 'This car is free to book' : st.text) + '</div></div></div>';
    var bookBtn = can('bookings.create') && c.status === 'active' ? '<a class="btn ghost cr-book" href="' + hashWith('new', { car: c.id }) + '">' + I('plus') + 'Book this car</a>' : '';
    /* quick actions */
    var acts = [];
    if (can('maintenance.create')) acts.push('<button class="act" onclick="Maint.log({car:\'' + c.id + '\'})">' + I('wrench') + 'Log service</button>');
    if (can('cars.edit') || can('maintenance.create')) acts.push('<button class="act" onclick="CarPage.km(\'' + c.id + '\')">' + I('gauge') + 'Update km</button>');
    if (can('maintenance.manage_documents')) acts.push('<button class="act" onclick="Maint.renew({car:\'' + c.id + '\'})">' + I('file') + 'Renew paper</button>');
    if (dt && can('maintenance.edit')) acts.push('<button class="act" onclick="Maint.carBack(\'' + dt.id + '\')">' + I('check') + 'Car is back</button>');
    else if (!dt && c.status !== 'sold' && can('maintenance.create')) acts.push('<button class="act" onclick="Maint.log({car:\'' + c.id + '\',status:\'workshop\'})">' + I('key') + 'Put in workshop</button>');
    /* papers */
    var papers = M7.PAPER_TYPES.map(function (t) {
      var p = carPaper(c.id, t), s = M7.paperState(p), canR = can('maintenance.manage_documents');
      if (!p && (t === 'Grant' || t === 'Permit' || t === 'PUSPAKOM') && !canR) return '';
      return '<' + (canR ? 'button type="button" onclick="Maint.renew({car:\'' + c.id + '\',type:\'' + t + '\'})"' : 'div') + ' class="card2 cr-paper"><div class="c2-main"><div class="c2-t1">' + esc(M7.PAPER_LABEL[t]) + '</div><div class="c2-t2">' +
        (p ? (p.until ? 'Valid until ' + esc(M7.ymd(p.until)) : 'On file') + (p.insurer ? ' · ' + esc(p.insurer) : '') : (canR ? 'Tap to add' : 'Not recorded')) + '</div></div>' + chip(s.text, s.tone) + '</' + (canR ? 'button' : 'div') + '>';
    }).join('');
    /* service */
    var svc = window.Maint && Maint.serviceInfo ? Maint.serviceInfo(c) : null;
    var jobs = (S.jobs || []).filter(function (j) { return j.car === c.id; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    var lastDone = jobs.filter(function (j) { return j.status === 'done'; })[0];
    var svcHtml = '<div class="kv cr-kv"><div><div class="k">Last service</div><div class="v">' + (lastDone ? esc(lastDone.type) + '<small>' + esc(dFull(lastDone.at)) + (lastDone.km ? ' · ' + esc(M7.km(lastDone.km)) : '') + '</small>' : 'Not recorded') + '</div></div>' +
      '<div><div class="k">Next service</div><div class="v' + (svc && svc.level === 'overdue' ? ' tone-red-text' : svc && svc.level === 'soon' ? ' tone-amber-text' : '') + '">' + (svc ? esc(svc.next) + '<small>' + esc(svc.words) + '</small>' : 'No reminder set') + '</div></div></div>';
    var hist = jobs.slice(0, 4).map(function (j) { return window.Maint && Maint.jobRow ? Maint.jobRow(j, true) : ''; }).join('');
    /* odometer */
    var lr = M7.lastReading(c.id), bad = (S.odometer || []).filter(function (o) { return o.car === c.id && o.trusted === false; }).length;
    var odoHtml = '<button type="button" class="card2 cr-odo" onclick="CarPage.odoHistory(\'' + c.id + '\')"><span class="cr-odoic">' + I('gauge') + '</span><div class="c2-main"><div class="c2-t1 cr-odokm">' + esc(M7.km(M7.odo(c.id))) + '</div><div class="c2-t2">' +
      (lr ? 'Last read ' + esc(dShort(lr.at)) + ' · ' + esc(SRC[lr.source] || lr.source) : 'No readings yet') + '</div></div>' + (bad ? chip(bad + ' not trusted', 'amber') : '') + '<span class="cr-more">History</span></button>';
    /* money */
    var rates = '<div class="kv cr-kv cr-rates"><div><div class="k">Daily</div><div class="v money">' + rm(c.rate) + '</div></div><div><div class="k">Hourly</div><div class="v money">' + rm(c.hourly) + '</div></div><div><div class="k">Deposit</div><div class="v money">' + rm(c.deposit) + '</div></div></div>';
    var facts = '<div class="kv cr-kv"><div><div class="k">VIN</div><div class="v cr-mono">' + esc(c.serial || 'Not recorded') + '</div></div><div><div class="k">Engine no</div><div class="v cr-mono">' + esc(c.engineNo || 'Not recorded') + '</div></div></div>';
    var owner = '';
    if (c.owner && can('cars.see_owner_details')) {
      var tel = M7.telOf(c.owner.phone);
      owner = '<div class="sec"><h2>Owner</h2></div><div class="list"><div class="card2"><div class="c2-main"><div class="c2-t1">' + esc(c.owner.name) + '</div><div class="c2-t2">' + esc(c.owner.phone || '') + '</div></div>' +
        (tel ? '<a class="iconbtn cr-call" href="tel:' + esc(tel) + '" aria-label="Call the owner">' + I('phone') + '</a><button class="iconbtn cr-call wa" onclick="Share.wa(\'' + esc(c.owner.phone) + '\',\'\')" aria-label="WhatsApp the owner">' + I('wa') + '</button>' : '') + '</div></div>';
    }
    var inst = '';
    if (c.instalment && can('cars.see_instalment')) {
      var nextDue = (S.instalments || []).filter(function (x) { return x.car === c.id && !x.paidAt; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; })[0];
      var nd = nextDue ? daysUntil(nextDue.due + 'T00:00:00') : null;
      inst = '<div class="sec"><h2>Instalment</h2>' + (can('expenses.view') ? '<a href="#instalments">All instalments</a>' : '') + '</div><div class="kv cr-kv cr-rates"><div><div class="k">Monthly</div><div class="v money">' + rm(c.instalment.monthly) + '</div></div><div><div class="k">Due on</div><div class="v">Day ' + esc(c.instalment.day) + '</div></div><div><div class="k">Bank</div><div class="v">' + esc(c.instalment.bank) + '</div></div></div>' +
        (nextDue ? '<div class="banner ' + (nd < 0 ? 'red' : nd <= 5 ? 'amber' : 'blue') + ' cr-banner">' + I(nd < 0 ? 'warn' : 'info') + '<div>Next payment <b class="money">' + rm(nextDue.amt) + '</b> ' + (nd < 0 ? 'was due ' + (-nd) + ' day' + (nd === -1 ? '' : 's') + ' ago' : nd === 0 ? 'is due today' : 'is due on ' + esc(M7.ymd(nextDue.due))) + '. Ends ' + esc(M7.ymd(c.instalment.endsOn)) + '.</div></div>' : '');
    }
    var where = '';
    if (can('tracking.view')) {
      var tk = (S.tracker || []).filter(function (t) { return t.car === c.id; })[0];
      where = '<div class="sec"><h2>Where is it now</h2><a href="' + hashWith('tracking', { q: c.plate }) + '">All cars</a></div>' + (tk ? '<div class="list"><div class="card2"><div class="c2-main"><div class="c2-t1">' + chip(tk.state, { Moving: 'green', Parked: 'blue', Offline: 'grey' }[tk.state]) + ' ' + (tk.state === 'Moving' ? esc(Math.round(tk.speed) + ' km/h') : '') + '</div><div class="c2-t2">Updated <span data-ago="' + esc(tk.at) + '">' + esc(ago(tk.at)) + '</span></div></div>' +
        '<a class="btn ghost sm cr-maps" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + tk.lat.toFixed(5) + ',' + tk.lng.toFixed(5) + '">' + I('map') + 'Open in Maps</a></div></div>' : '<div class="card cr-none">This car has no tracker.</div>');
    }
    var sm = (S.summons || []).filter(function (s) { return s.car === c.id; }), smOpen = sm.filter(function (s) { return ['Paid', 'Waived'].indexOf(s.status) < 0; }).length;
    var smHtml = can('summons.view') && sm.length ? '<div class="sec"><h2>Summons</h2></div><a class="card2 list cr-sm" href="' + hashWith('summons', { q: c.plate, f: 'all' }) + '"><div class="c2-main"><div class="c2-t1">' + sm.length + ' summons for this car</div><div class="c2-t2">' + (smOpen ? smOpen + ' still open' : 'All settled') + '</div></div>' + (smOpen ? chip(smOpen + ' open', 'amber') : chip('Settled', 'green')) + '</a>' : '';
    var html = topbar(c.plate, { back: '#cars', sub: c.make + ' ' + c.model, right: right }) + '<main class="cr-page">' + hero +
      (dt ? '<div class="banner amber cr-banner">' + I('wrench') + '<div><b>In the workshop</b> since ' + esc(when(dt.from)) + (dt.to ? ', expected back ' + esc(dLong(dt.to)) : ', no return date yet') + '. ' + esc(dt.reason || '') + '</div></div>' : '') +
      (acts.length ? '<div class="actions cr-acts" style="grid-template-columns:repeat(' + Math.min(4, acts.length) + ',1fr)">' + acts.join('') + '</div>' : '') +
      '<div class="sec"><h2>Bookings</h2>' + (can('bookings.view') ? '<a href="' + hashWith('calendar', {}) + '">Calendar</a>' : '') + '</div><div class="list">' + bkCard + '</div>' + bookBtn +
      '<div class="sec"><h2>Papers</h2></div><div class="list">' + papers + '</div>' +
      (can('maintenance.view') ? '<div class="sec"><h2>Service</h2>' + (jobs.length ? '<a href="' + hashWith('maintenance', { tab: 'log', q: c.plate }) + '">All jobs</a>' : '') + '</div>' + svcHtml + (hist ? '<div class="list cr-hist">' + hist + '</div>' : '') : '') +
      '<div class="sec"><h2>Odometer</h2></div><div class="list">' + odoHtml + '</div>' +
      '<div class="sec"><h2>Rates</h2></div>' + rates +
      '<div class="sec"><h2>Car details</h2></div>' + facts + owner + inst + where + smHtml +
      (c.note ? '<div class="sec"><h2>Note</h2></div><div class="card cr-note">' + esc(c.note) + '</div>' : '') + '</main>';
    return { html: html, after: function () { if (window.Track && Track.startAgo && can('tracking.view')) Track.startAgo(); } };
  }
  var SRC = { typed: 'Typed in', service: 'Service', handover: 'Hand-over', 'return': 'Return' };

  /* ---------- photos ---------- */
  function photos(id) {
    var c = car(id); if (!c || !can('cars.manage_gallery')) return;
    sheet(sheetHead('Add photos', c.plate + ' · keep them small, they stay on this phone') +
      '<div class="cr-phbtns"><button type="button" class="btn" id="crtake">' + I('camera') + 'Take or choose a photo</button><button type="button" class="btn ghost" id="crsample">' + I('image') + 'Use a sample picture</button></div>' +
      '<p class="hint">Photos are made smaller before saving.</p>', function (sh) {
        var add = function (r) { c.gallery = (c.gallery || []).concat(r.dataUrl).slice(-8); audit('Added a photo of ' + c.plate, { car: c.id, link: '#car/' + c.id }); save(); closeSheet(); render(false, true); say(r.note || 'Photo added'); };
        $('#crtake', sh).onclick = function () { Media.photo({ capture: 'environment', maxPx: 900, quality: .7 }).then(add, function () {}); };
        $('#crsample', sh).onclick = function () { Media.sample('car', ['Front', 'Side', 'Back', 'Inside'][(c.gallery || []).length % 4]).then(add); };
      });
  }
  function zoomPhoto(id, i) {
    var c = car(id); if (!c) return;
    M7.zoom(c.gallery[i], { title: c.plate, sub: 'Photo ' + (i + 1) + ' of ' + c.gallery.length, onRemove: can('cars.manage_gallery') ? function () { c.gallery.splice(i, 1); audit('Removed a photo of ' + c.plate, { car: c.id }); save(); render(false, true); say('Photo removed'); } : null });
  }

  /* ---------- update km ---------- */
  /* odometers only go up: not lower than a reading before the date, not higher than one after it, max 1,500,000 */
  function kmProblem(carId, kmv, at) {
    if (isNaN(kmv) || kmv <= 0) return 'Type the km shown on the dashboard, numbers only.';
    if (kmv > 1500000) return 'That is more than 1,500,000 km. Check the number.';
    var t = new Date(at).getTime(), before = null, after = null;
    (S.odometer || []).forEach(function (o) {
      if (o.car !== carId || o.trusted === false) return; var ot = new Date(o.at).getTime();
      if (ot <= t && (!before || +o.km > +before.km)) before = o;
      if (ot > t && (!after || +o.km < +after.km)) after = o;
    });
    if (before && kmv < +before.km) return 'Lower than the reading of ' + M7.km(before.km) + ' on ' + dShort(before.at) + '. Odometers only go up.';
    if (after && kmv > +after.km) return 'Higher than the later reading of ' + M7.km(after.km) + ' on ' + dShort(after.at) + '. Check the date.';
    return '';
  }
  function kmSheet(id) {
    var c = car(id); if (!c) return;
    var cur = M7.odo(c.id);
    sheet(sheetHead('Update km', c.plate + ' · now ' + M7.km(cur)) +
      '<label class="field"><span>Odometer (km)</span><input class="inp num cr-kmin" id="crkm" inputmode="numeric" autocomplete="off" placeholder="For example ' + esc(cur ? (Math.round(cur / 100) * 100 + 300).toLocaleString('en-US') : '48200') + '"><small class="err" id="crkmerr" hidden></small></label>' +
      '<label class="field"><span>Read on</span><input class="inp" type="date" id="crkmd" max="' + toLocalInput(new Date()) + '" value="' + toLocalInput(new Date()) + '"></label>' +
      '<p class="hint">Odometers only go up. A lower number is refused.</p>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="crkmok">Save km</button></div>', function (sh) {
        var inp = $('#crkm', sh), err = $('#crkmerr', sh), dIn = $('#crkmd', sh);
        inp.addEventListener('input', function () { var d = inp.value.replace(/[^\d]/g, ''); inp.value = d ? (+d).toLocaleString('en-US') : ''; err.hidden = true; inp.classList.remove('bad'); });
        setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 300);
        $('#crkmok', sh).onclick = function () {
          var kmv = M7.kmNum(inp.value), ds = dIn.value || toLocalInput(new Date());
          var at = sameDay(ds + 'T12:00:00', new Date()) ? new Date() : new Date(ds + 'T12:00:00');
          if (at > new Date()) { err.textContent = 'The date cannot be in the future.'; err.hidden = false; return; }
          var pr = kmProblem(c.id, kmv, at);
          if (pr) { err.textContent = pr; err.hidden = false; inp.classList.add('bad'); return; }
          S.odometer = S.odometer || [];
          S.odometer.push({ id: uid(), car: c.id, km: kmv, at: at.toISOString(), source: 'typed', by: S.me, trusted: true, booking: null });
          var prev = c.km; if (kmv > (+c.km || 0)) c.km = kmv;
          audit('Odometer of ' + c.plate + ' updated to ' + M7.km(kmv), { car: c.id, link: '#car/' + c.id, changes: { km: [prev, c.km] } });
          save(); closeSheet(); render(false, true); say('Saved: ' + M7.km(kmv));
        };
      });
  }
  function odoHistory(id) {
    var c = car(id); if (!c) return;
    var rows = (S.odometer || []).filter(function (o) { return o.car === c.id; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    sheet(sheetHead('Odometer history', c.plate + ' · ' + M7.km(M7.odo(c.id))) +
      (rows.length ? '<div class="list cr-odolist">' + rows.map(function (o) {
        var b = o.booking && bk(o.booking);
        return '<div class="card2' + (o.trusted === false ? ' cr-untrusted' : '') + '"><div class="c2-main"><div class="c2-t1">' + esc(M7.km(o.km)) + ' ' + (o.trusted === false ? chip('Not trusted', 'amber') : '') + '</div><div class="c2-t2">' + esc(SRC[o.source] || o.source) + ' · ' + esc(dFull(o.at)) + (o.by ? ' · ' + esc(firstName(who(o.by))) : '') + (b ? ' · ' + esc(b.code) : '') + '</div>' +
          (o.trusted === false ? '<div class="cr-why">' + esc(o.note || 'Not trusted') + '. It does not count toward the car’s km.</div>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty">No readings yet.</div>') +
      ((can('cars.edit') || can('maintenance.create')) ? '<div class="sheet-foot"><button type="button" class="btn" onclick="CarPage.km(\'' + c.id + '\')">' + I('gauge') + 'Update km</button></div>' : ''), { full: rows.length > 6 });
  }

  /* ---------- edit car details ---------- */
  function edit(id) {
    var c = car(id); if (!c || !can('cars.edit')) return;
    var rt = carPaper(c.id, 'Road tax'), status = c.status || 'active';
    sheet(sheetHead('Edit car details', c.plate + ' · ' + c.make + ' ' + c.model) +
      '<div class="field"><span>Status</span><div class="seg" id="crst">' + [['active', 'Active'], ['inactive', 'Not in use'], ['sold', 'Sold']].map(function (s) { return '<button type="button" data-v="' + s[0] + '" class="' + (status === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="cr-3"><label class="field"><span>Daily rate</span><div class="rmfield"><input class="inp" id="crr" inputmode="decimal" value="' + esc(money2(c.rate)) + '"></div></label>' +
      '<label class="field"><span>Hourly rate</span><div class="rmfield"><input class="inp" id="crh" inputmode="decimal" value="' + esc(money2(c.hourly)) + '"></div></label>' +
      '<label class="field"><span>Deposit</span><div class="rmfield"><input class="inp" id="crd" inputmode="decimal" value="' + esc(money2(c.deposit)) + '"></div></label></div>' +
      '<label class="field"><span>Road tax valid until</span><input class="inp" type="date" id="crrt" value="' + esc(rt ? rt.until : '') + '"><small class="hint">Changing it records a new road tax paper.</small></label>' +
      '<label class="cr-switch"><span><b>Show on the website</b><small>Only active cars can be booked online</small></span><span class="sw"><input type="checkbox" id="crweb"' + (c.showOnWebsite !== false ? ' checked' : '') + '><i></i></span></label>' +
      '<label class="field"><span>Note (optional)</span><textarea class="inp cr-ta" id="crnote" rows="2" placeholder="Anything the team should know">' + esc(c.note || '') + '</textarea></label>' +
      '<small class="err" id="creerr" hidden></small>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="crsave">Save changes</button></div>', function (sh) {
        segPick('#crst', function (t, b) { status = b.dataset.v; });
        $('#crsave', sh).onclick = function () {
          var r = parseMoney($('#crr', sh).value), h = parseMoney($('#crh', sh).value), d = parseMoney($('#crd', sh).value), err = $('#creerr', sh);
          if (isNaN(r) || isNaN(h) || isNaN(d) || r <= 0) { err.textContent = 'Type the rates as amounts, for example 120 or 120.50.'; err.hidden = false; return; }
          var go = function () {
            var ch = {};
            var setF = function (k, v) { if (c[k] !== v) { ch[k] = [c[k], v]; c[k] = v; } };
            setF('status', status); setF('rate', r); setF('hourly', h); setF('deposit', d); setF('showOnWebsite', $('#crweb', sh).checked); setF('note', $('#crnote', sh).value.trim());
            var nrt = $('#crrt', sh).value;
            if (nrt && (!rt || rt.until !== nrt)) { S.papers = S.papers || []; S.papers.push({ id: uid(), car: c.id, type: 'Road tax', until: nrt, insurer: '', cost: null, ref: '', warnDays: 30, photo: null, at: new Date().toISOString(), by: S.me }); ch.roadTax = [rt ? rt.until : null, nrt]; }
            if (Object.keys(ch).length) audit('Car ' + c.plate + ' details changed', { car: c.id, link: '#car/' + c.id, changes: ch });
            save(); closeSheet(); render(false, true); say(Object.keys(ch).length ? 'Car details saved' : 'Nothing changed');
          };
          var fut = S.bookings.filter(function (b) { return b.car === c.id && blocksCar(b) && new Date(b.end) > new Date(); });
          if (status !== 'active' && c.status === 'active' && fut.length) confirm({ icon: 'warn', title: fut.length + ' booking' + (fut.length > 1 ? 's' : '') + ' still use this car', text: 'Move ' + (fut.length > 1 ? 'them' : 'it') + ' to another car: ' + fut.slice(0, 3).map(function (b) { return b.code; }).join(', ') + (fut.length > 3 ? ' and more' : '') + '.', ok: 'Save anyway', cancel: 'Go back', primary: 'cancel' }).then(function (ok) { if (ok) go(); });
          else go();
        };
      });
  }

  VIEWS.cars = listView;
  VIEWS.car = pageView;
  return { open: function (id) { location.hash = '#car/' + id; }, edit: edit, km: kmSheet, kmProblem: kmProblem, odoHistory: odoHistory, photos: photos, zoomPhoto: zoomPhoto, SRC: SRC };
})();

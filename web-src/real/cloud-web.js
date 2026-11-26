/* ===================================================================
   Real web app: signs in with Supabase, opens the company named by the address (<slug>.orbiquefms.com, or ?co=<slug>),
   reads its records and turns them into the shapes the web pages use (see CONTRACT.md and data.js), then starts the app.
   Records are stored in the shape the phone app uses (app/m), so this file is the bridge between the two.
   A company fed by another system (identity.mirror) is view-only: changes stay on this screen and are never saved.
   =================================================================== */
(function () {
  var cfg = window.FMS_CONFIG || {};
  var RECOVERY = /type=recovery/.test(location.hash);
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fms.auth' } });
  var host = document.getElementById('app');
  var esc0 = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  window.FMS_CLOUD = { sb: sb };

  /* ---------- which company: the first part of the address, or ?co= ---------- */
  function wantedSlug() {
    var q = (location.search.match(/[?&]co=([\w-]+)/) || [])[1];
    if (q) return q.toLowerCase();
    var h = location.hostname.split('.');
    if (h.length >= 3 && ['app', 'www', 'staff-preview'].indexOf(h[0]) < 0 && !/vercel\.app$/.test(location.hostname)) return h[0].toLowerCase();
    return null;
  }

  /* ---------- our own small screens (before the app starts) ---------- */
  var CSS = '<style>.cw{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F5F8;font-family:Inter,system-ui,sans-serif;padding:16px}' +
    '.cw-card{background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(20,30,50,.08);padding:28px;width:100%;max-width:380px}' +
    '.cw h1{font-size:20px;margin:12px 0 4px;color:#16171B}.cw p{color:#5b6070;font-size:14px;margin:0 0 16px;line-height:1.5}' +
    '.cw label{display:block;font-size:13px;font-weight:600;color:#33384a;margin:12px 0 6px}.cw input{width:100%;box-sizing:border-box;border:1px solid #d5d8e0;border-radius:10px;padding:11px 12px;font-size:15px}' +
    '.cw button{width:100%;margin-top:16px;border:0;border-radius:10px;padding:12px;font-size:15px;font-weight:600;background:#244060;color:#fff;cursor:pointer}.cw button[disabled]{opacity:.6}' +
    '.cw .lnk{background:none;color:#244060;margin-top:10px;font-weight:500}.cw .msg{border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:8px}.cw .err{background:#fdecec;color:#9b1c1c}.cw .ok{background:#e8f1fb;color:#1d4f86}' +
    '.cw-spin{width:28px;height:28px;border:3px solid #dfe3ea;border-top-color:#244060;border-radius:50%;animation:cwspin 1s linear infinite;margin:0 auto 12px}@keyframes cwspin{to{transform:rotate(360deg)}}</style>';
  var LOGO = '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#244060"/><circle cx="32" cy="32" r="15" fill="none" stroke="#C8A444" stroke-width="5"/><circle cx="32" cy="32" r="5" fill="#C8A444"/></svg>';
  function screen(inner) { host.innerHTML = CSS + '<div class="cw"><div class="cw-card">' + LOGO + inner + '</div></div>'; }
  function loading(text) { screen('<div style="text-align:center;padding:12px 0"><div class="cw-spin"></div><p>' + esc0(text) + '</p></div>'); }
  function signIn(msg, isErr) {
    screen('<h1>Sign in</h1><p>Orbique FMS</p>' + (msg ? '<div class="msg ' + (isErr ? 'err' : 'ok') + '">' + esc0(msg) + '</div>' : '') +
      '<form id="cwF"><label>Email</label><input id="cwE" type="email" autocomplete="username" autocapitalize="none"><label>Password</label><input id="cwP" type="password" autocomplete="current-password">' +
      '<button id="cwGo">Sign in</button><button type="button" class="lnk" id="cwForgot">Forgot password, or first time here?</button></form>');
    var em = document.getElementById('cwE'), pw = document.getElementById('cwP');
    try { em.value = localStorage.getItem('fms.lastEmail') || ''; } catch (x) { /* private window */ }
    (em.value ? pw : em).focus();
    document.getElementById('cwF').onsubmit = function (ev) {
      ev.preventDefault();
      var b = document.getElementById('cwGo'); b.disabled = true; b.textContent = 'Signing in…';
      sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value }).then(function (r) {
        if (r.error) return signIn(r.error.message === 'Invalid login credentials' ? 'That email and password do not match.' : r.error.message, true);
        try { localStorage.setItem('fms.lastEmail', em.value.trim()); } catch (x) { /* private window */ }
        afterSignIn();
      });
    };
    document.getElementById('cwForgot').onclick = function () {
      var a = em.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(a)) return signIn('Type your email first, then tap this again.', true);
      sb.auth.resetPasswordForEmail(a, { redirectTo: location.origin + location.pathname }).then(function (r) {
        signIn(r.error ? r.error.message : 'We sent a link to ' + a + '. Open it to set your password.', !!r.error);
      });
    };
  }
  function setPassword() {
    screen('<h1>Choose a password</h1><p>At least 8 characters.</p><form id="cwN"><label>New password</label><input id="cwNP" type="password" autocomplete="new-password"><button id="cwNB">Save password</button></form>');
    document.getElementById('cwN').onsubmit = function (ev) {
      ev.preventDefault();
      var v = document.getElementById('cwNP').value, b = document.getElementById('cwNB');
      if (v.length < 8) return;
      b.disabled = true; b.textContent = 'Saving…';
      sb.auth.updateUser({ password: v }).then(function (r) {
        if (r.error) { b.disabled = false; b.textContent = 'Save password'; alert(r.error.message); return; }
        history.replaceState(null, '', location.pathname + location.search); afterSignIn();
      });
    };
  }
  window.cloudSignOut = function () { sb.auth.signOut().then(function () { location.reload(); }); };

  function boot() {
    loading('Opening…');
    if (RECOVERY) { sb.auth.getSession().then(function (s) { if (s.data.session) setPassword(); else signIn('That link has expired or was already used. Tap "Forgot password" for a new one.', true); }); return; }
    sb.auth.getSession().then(function (s) { if (s.data.session) afterSignIn(); else signIn(); });
  }
  function afterSignIn() {
    loading('Loading your company…');
    sb.rpc('my_context').then(function (r) {
      if (r.error) return signIn('Could not open your account: ' + r.error.message, true);
      var list = (r.data.workspaces || []).filter(function (w) { return w.memberStatus === 'active'; });
      var slug = wantedSlug(), ws = list.filter(function (w) { return w.slug === slug; })[0] || (!slug && list.length === 1 ? list[0] : null);
      if (!ws) {
        if (!list.length) return screen('<h1>No company yet</h1><p>Your account (' + esc0(r.data.email) + ') is not part of a company. Ask your company’s owner to add you.</p><button onclick="cloudSignOut()">Sign out</button>');
        return screen('<h1>Choose a company</h1>' + list.map(function (w) { return '<button onclick="location.search=\'?co=' + esc0(w.slug) + '\'">' + esc0(w.name) + '</button>'; }).join('') + '<button class="lnk" onclick="cloudSignOut()">Sign out</button>');
      }
      load(ws, r.data);
    });
  }
  function pageAll(q) {
    var out = [], size = 1000;
    function next(from) { return q().range(from, from + size - 1).then(function (r) { if (r.error) throw r.error; out = out.concat(r.data); return r.data.length === size ? next(from + size) : out; }); }
    return next(0);
  }
  function load(ws, ctx) {
    Promise.all([
      sb.from('orgs').select('id,slug,name,identity,next_no,status').eq('id', ws.id).single(),
      pageAll(function () { return sb.from('records').select('coll,id,data,deleted').eq('org_id', ws.id).eq('deleted', false); }),
      pageAll(function () { return sb.from('blobs').select('key,data').eq('org_id', ws.id); })
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var org = res[0].data, colls = {}, blobs = {};
      res[1].forEach(function (r) { (colls[r.coll] = colls[r.coll] || []).push(r.data); });
      res[2].forEach(function (b) { blobs[b.key] = b.data; });
      start(org, colls, blobs, ws, ctx);
    }).catch(function (e) { console.error(e); signIn('Could not load the company: ' + (e.message || e), true); });
  }

  /* ---------- files: 'file:<path>' references become signed links when shown ---------- */
  var ORG = null, urlCache = {}, FILES = [];
  var MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf' };
  function fileObj(ref, name) {
    if (!ref) return null;
    if (typeof ref === 'object') return ref;
    var path = String(ref).replace(/^file:/, ''), nm = name || path.split('/').pop(), ext = (nm.split('.').pop() || '').toLowerCase();
    var f = { name: nm, size: 0, path: path, ref: ref, type: MIME[ext] || '' };
    FILES.push(f);
    return f;
  }
  /* every stored file gets a signed link (valid for a day) before the pages draw, so pictures show straight away */
  function signAll(done) {
    var paths = {}; FILES.forEach(function (f) { paths[f.path] = 1; });
    var list = Object.keys(paths), chunks = [], got = {};
    for (var k = 0; k < list.length; k += 400) chunks.push(list.slice(k, k + 400));
    var left = chunks.length; if (!left) return done();
    chunks.forEach(function (ch) {
      sb.storage.from('company-files').createSignedUrls(ch.map(function (p) { return ORG + '/' + p; }), 86400).then(function (r) {
        (r.data || []).forEach(function (x, n) { if (x && x.signedUrl) got[ch[n]] = x.signedUrl; });
      }).catch(function (e) { console.warn('signed links', e); }).then(function () {
        if (--left) return;
        FILES.forEach(function (f) { if (got[f.path]) { f.dataUrl = got[f.path]; urlCache[f.path] = got[f.path]; } });
        done();
      });
    });
  }
  window.fmsFileUrl = function (f) {
    var path = f && (f.path || (typeof f === 'string' ? f.replace(/^file:/, '') : null));
    if (!path || !ORG) return Promise.resolve(null);
    if (urlCache[path]) return Promise.resolve(urlCache[path]);
    return sb.storage.from('company-files').createSignedUrl(ORG + '/' + path, 3600).then(function (r) { if (r.error) return null; urlCache[path] = r.data.signedUrl; return urlCache[path]; });
  };

  /* ---------- the bridge: phone-app records -> web-app data ---------- */
  var DT = function (v) { if (!v) return null; var d = new Date(v.length === 10 ? v + 'T00:00:00+08:00' : v); return isNaN(d) ? null : d; };
  var NUM = function (v) { return +v || 0; };
  var PAY_FIX = { 'deposit due': 'Deposit due', 'deposit received': 'Deposit Received', 'full payment received': 'Full Payment Received', 'extension due': 'Extension due', 'extension paid': 'Extension paid', 'refund pending': 'Refund Pending', 'deposit refunded': 'Deposit Refunded' };
  var ROLE = { owner: 'role-owner', manager: 'role-manager', frontdesk: 'role-front', accountant: 'role-accountant', fleet: 'role-fleet', readonly: 'role-readonly', agent: 'role-none' };

  function makeBrand(org, colls, blobs, ws) {
    var idt = org.identity || {}, st = blobs.settings || {}, staff = colls.staff || [];
    var owner = staff.filter(function (s) { return s.role === 'owner' && s.active; })[0] || staff[0] || { name: '' };
    var short = idt.short || st.short || org.name, letter = (short || 'F').charAt(0).toUpperCase();
    var prim = idt.primary || '#244060', dark = idt.dark || '#16233A', acc = idt.accent || prim;
    return {
      id: org.slug, name: idt.name || org.name, short: short, sub: '', legal: st.legalName || idt.name || org.name, reg: st.regNo || '', code: idt.code || st.codePrefix || 'BKG',
      startNo: 1, primary: prim, secondary: dark, accent: acc, colorsLabel: idt.colours || '', mark: initialMark(letter, prim, '#FFFFFF'),
      owner: owner.name, staff: staff.filter(function (s) { return s.active; }).map(function (s) { return s.name.split(' ')[0]; }), city: idt.city || '',
      address: String(st.address || '').replace(/\r/g, ''), phone: st.phone || '', email: st.email || '', slug: org.slug, plan: 'pro',
      fines: { smoking: 200, dashcam: 200, key: 600, late: 20, toll: 10 }, deposit: 200, extendHours: 12, refundHours: 24,
      locations: (st.locations || []).filter(function (l) { return l.active !== false; }).map(function (l) { return { id: l.id, n: l.name, p: l.pickup !== false, d: l.dropoff !== false, agents: l.agents || [] }; }),
      places: (st.places || []).map(function (p) { return { id: p.id, name: p.name, deliveryFee: NUM(p.deliveryFee), returnFee: NUM(p.returnFee) }; }),
      fleet: [], tag: '', mirror: idt.mirror || null, real: true, orgId: org.id, memberStaff: ws.staffId, memberRole: ws.role,
      logoRef: idt.logo || st.logo || null, lat: idt.lat, lng: idt.lng
    };
  }

  function convert(B, colls, blobs) {
    var st = blobs.settings || {};
    /* start from a full company so every list a page expects exists, then replace each one with the real records */
    var skel = Object.assign({}, BRANDS[0], { locations: BRANDS[0].locations.map(function (l) { return Object.assign({}, l); }) }), d = buildAll(skel, 4242);
    var now = new Date();
    var staff = colls.staff || [], staffBy = {}; staff.forEach(function (s) { staffBy[s.id] = s; });
    var nameOf = function (id) { return id && staffBy[id] ? staffBy[id].name : (id || ''); };

    /* company settings */
    var co = d.company;
    co.legal = B.legal; co.trading = B.name; co.reg = B.reg; co.phone = B.phone; co.address = B.address; co.email = B.email; co.website = st.site || '';
    co.logo = B.logoRef ? fileObj(B.logoRef) : null;
    co.bank = { bank: (st.bank || {}).name || '', name: (st.bank || {}).name || '', accNo: (st.bank || {}).accNo || '', accName: (st.bank || {}).accName || '', duitnow: '', note: st.paymentNote || '' };
    co.numbering = { invPrefix: (st.invoicePrefix || 'INV') + '-', rcpPrefix: (st.receiptPrefix || 'RCP') + '-', digits: st.numberPadding || 5, resetYearly: st.resetYearly !== false };
    co.tax = { on: !!(st.tax && st.tax.on), name: (st.tax && st.tax.name) || 'SST', rate: (st.tax && st.tax.rate) || 0, regNo: st.taxId || '' };
    co.footers = { invoice: st.invoiceFooter || '', receipt: st.receiptFooter || '' };
    co.countryCode = '+' + (st.country || '60');
    co.cardFee = { localPct: (st.cardFee || {}).pct || 0, foreignPct: (st.cardFee || {}).pct || 0, fixed: (st.cardFee || {}).fixed || 0 };
    co.fleet.overspeed = st.speedLimit || co.fleet.overspeed;
    co.expenseEditDays = st.expenseEditHours ? Math.max(1, Math.round(st.expenseEditHours / 24)) : null;
    co.refundLockDate = DT(st.depositRefundLockFrom) || co.refundLockDate;
    co.carsNotCounted = [];
    co.trackerPlatforms = co.trackerPlatforms.filter(function (x) { return !/Sample/.test(x); });
    co.dashcamPlatforms = co.dashcamPlatforms.filter(function (x) { return !/Sample/.test(x); });

    /* damage packages and signatures */
    d.damagePackages = (st.packages || []).map(function (p) { return { id: p.id, name: p.name, daily: NUM(p.daily), max: NUM(p.max) }; });
    var defPkg = (st.packages || []).filter(function (p) { return p.default; })[0]; co.packageDefault = defPkg ? defPkg.id : '';
    d.signatures = (st.signatures || []).map(function (s) { return { id: s.id, name: s.name, img: s.image }; });

    /* team: logins and field agents keep the record ids (u4, e2), so tasks and payments find them */
    d.users = staff.filter(function (s) { return s.hasLogin; }).map(function (s) {
      return { id: s.id, name: s.name, username: s.username || '', email: s.email || '', role: ROLE[s.role] || 'role-none', extra: [], removed: [], active: !!(s.active && s.loginActive !== false),
        superAdmin: s.role === 'owner', agent: s.isAgent ? s.id : null, lastSignIn: DT(s.lastSeen), created: null, phone: s.phone || '' };
    });
    d.employees = staff.filter(function (s) { return s.isAgent; }).map(function (s) {
      var em = s.emergency || {};
      return { id: s.id, name: s.name, wa: s.phone || s.wa || '', email: s.email || '', blood: s.blood || '', emergency: { name: em.name || '', rel: em.relation || '', phone: em.phone || '' },
        docs: { idCard: s.docs && (s.docs.ic || s.docs.id) ? fileObj(s.docs.ic || s.docs.id) : null, poa: s.docs && s.docs.poa ? fileObj(s.docs.poa) : null }, active: !!s.active, login: s.hasLogin ? s.id : null };
    });
    (B.locations || []).forEach(function (l) { l.agents = (l.agents || []).filter(function (a) { return staffBy[a]; }); });
    co.fleet.reminderRecipients = d.users.filter(function (u) { return u.superAdmin && u.active; }).map(function (u) { return u.id; });

    /* cars */
    var papers = colls.papers || [];
    var paperOf = function (car, type) { return papers.filter(function (p) { return p.car === car && p.type === type && p.until; }).sort(function (a, b) { return a.until < b.until ? 1 : -1; })[0]; };
    var instByCar = {}; (colls.instalments || []).forEach(function (x) { (instByCar[x.car] = instByCar[x.car] || []).push(x); });
    d.cars = (colls.cars || []).sort(function (a, b) { return String(a.plate).localeCompare(String(b.plate)); }).map(function (c, k) {
      var rt = paperOf(c.id, 'Road tax'), ins = paperOf(c.id, 'Insurance'), inst = c.instalment, of = {};
      (c.ownerFiles || []).forEach(function (x) { if (!of[x.kind]) { var f = fileObj(x.file, x.name); f.added = DT(x.at); of[x.kind] = f; } });
      if (c.inReports === false) co.carsNotCounted.push(c.id);
      var fleet = c.status === 'sold' ? 'Sold' : c.status === 'inactive' || c.status === 'not_in_use' ? 'Not in use' : 'Active';
      return { i: k, key: String(c.model || '').toLowerCase().replace(/[^a-z0-9]/g, ''), make: c.make || '', model: c.model || '', type: c.type || 'Other', seats: c.seats || 5, cc: c.cc || 0, shape: c.shape || 'sedan',
        fuel: c.fuel || 'Petrol', trans: c.gear || 'Auto', plate: c.plate || '', color: c.color || '', year: c.year || null, rate: NUM(c.rate), odo: NUM(c.km), tax: rt ? DT(rt.until) : null,
        status: c.status === 'workshop' ? 'workshop' : 'active', web: c.showOnWebsite !== false, insurer: ins ? ins.insurer || '' : '', insExp: ins ? DT(ins.until) : null, chassis: c.serial || '', engine: c.engineNo || '',
        id: c.id, serial: k + 1, fleet: fleet, inWorkshop: c.status === 'workshop', hourly: NUM(c.hourly), deposit: NUM(c.deposit), vin: c.serial || '', spec: c.spec || '',
        boughtOn: DT((c.purchase || {}).date), boughtFor: NUM((c.purchase || {}).price), owner: c.owner ? { name: c.owner.name || '', mobile: c.owner.phone || c.owner.mobile || '', ic: c.owner.ic || '' } : { name: '', mobile: '', ic: '' },
        instalment: inst ? { day: inst.day, amount: NUM(inst.monthly) } : null, tracker: c.tracker || null, dashcam: c.dashcam || null, odoAt: null, sort: c.sort,
        papers: { roadtax: rt && rt.photo ? fileObj(rt.photo) : of.road_tax || null, insurance: ins && ins.photo ? fileObj(ins.photo) : of.insurance || null, grant: of.grant || null },
        ownerDocs: { ic: of.owner_ic || null, licence: of.owner_dl || null, agreement: of.agreement || null }, ownerFiles: (c.ownerFiles || []).map(function (x) { var f = fileObj(x.file, x.name); f.kind = x.kind; f.added = DT(x.at); return f; }),
        gallery: [c.image].concat(c.gallery || []).filter(Boolean).map(function (g, n) { return Object.assign(fileObj(g), { id: 'img-' + c.id + '-' + n, order: n + 1, angle: n === 0 ? 'side' : '' }); }),
        image: c.image ? fileObj(c.image) : null, waItem: '' };
    });
    var carBy = {}; d.cars.forEach(function (c) { carBy[c.id] = c; });

    /* customers */
    var bookingsRaw = colls.bookings || [];
    var firstSeen = {}; bookingsRaw.forEach(function (b) { var t = DT(b.created); if (b.cust && t && (!firstSeen[b.cust] || t < firstSeen[b.cust])) firstSeen[b.cust] = t; });
    var notesBy = {}; (colls.notes || []).forEach(function (n) { (notesBy[n.customer || n.cust] = notesBy[n.customer || n.cust] || []).push({ id: n.id, flag: n.flag || 'Info', text: n.text || '', pinned: !!n.pinned, by: nameOf(n.by), at: DT(n.at) }); });
    d.people = (colls.customers || []).map(function (p, k) {
      var em = p.emergency || {}, docs = p.docs || {}, notes = notesBy[p.id] || [];
      var flag = p.blacklist ? 'Blacklisted' : notes.some(function (n) { return n.flag === 'Be careful'; }) ? 'Be careful' : notes.some(function (n) { return n.flag === 'VIP'; }) ? 'VIP' : '';
      return { i: k, name: p.name || '', nat: p.nationality || '', phone: p.phone || '', email: p.email || '', ic: p.ic || p.passport || '', flag: flag, since: firstSeen[p.id] || DT(p.created), id: p.id,
        address: String(p.address || '').replace(/\r/g, ''), licenceNo: p.licenceNo || '', licenceExp: DT(p.licenceExp), emergency: { name: em.name || '', phone: em.phone || '', rel: em.relation || '' },
        docs: { icFront: fileObj(docs.icFront), icBack: fileObj(docs.icBack), dl: fileObj(docs.licence), poa: fileObj(docs.poa), other: null },
        blacklist: p.blacklist ? { since: DT(p.blacklist.at), reason: p.blacklist.reason || '' } : null, notes: notes, icCheck: null, passport: p.passport || '' };
    });
    d.customers = d.people;
    var custBy = {}; d.people.forEach(function (p) { custBy[p.id] = p; });
    var unknownCust = function (id) { id = id || 'cu-none'; if (custBy[id]) return custBy[id]; var p = { i: d.people.length, name: 'Unknown customer', nat: '', phone: '', email: '', ic: '', flag: '', since: null, id: id, address: '', licenceNo: '', licenceExp: null, emergency: { name: '', phone: '', rel: '' }, docs: {}, blacklist: null, notes: [], icCheck: null }; d.people.push(p); custBy[p.id] = p; return p; };
    var unknownCar = function (id) { id = id || 'car-none'; if (carBy[id]) return carBy[id]; var c = { i: d.cars.length, key: '', make: '', model: 'No car chosen', type: 'Other', seats: 5, cc: 0, shape: 'sedan', fuel: '', trans: '', plate: '-', color: '', year: null, rate: 0, odo: 0, tax: null, status: 'active', web: false, insurer: '', insExp: null, chassis: '', engine: '', id: id, serial: d.cars.length + 1, fleet: 'Not in use', inWorkshop: false, hourly: 0, deposit: 0, vin: '', spec: '', owner: { name: '', mobile: '', ic: '' }, instalment: null, tracker: null, dashcam: null, papers: {}, ownerDocs: {}, gallery: [] }; d.cars.push(c); carBy[c.id] = c; co.carsNotCounted.push(c.id); return c; };

    /* bookings and their payments */
    var locName = function (id) { var l = (st.locations || []).filter(function (x) { return x.id === id; })[0]; return l ? l.name : ((st.locations || [])[0] || {}).name || ''; };
    var placeName = function (id) { var p = (st.places || []).filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; };
    var codeOf = {}; bookingsRaw.forEach(function (b) { codeOf[b.id] = b.code; });
    d.payments = []; d.inspections = [];
    d.bookings = bookingsRaw.slice().sort(function (a, b) { return a.no - b.no; }).map(function (b) {
      var r = b.rates || {}, s = DT(b.start), e = DT(b.end), secs = Math.max(0, (e - s) / 1000), daily = NUM(r.daily), hourly = NUM(r.hourly);
      var part = function (h) { var x = hourly * h; return daily > 0 ? Math.min(x, daily) : x; }, days, rent;
      if (secs < 86400) { days = 1; rent = part(secs / 3600); } else { days = Math.floor(secs / 86400); rent = daily * days + part((secs % 86400) / 3600); if (secs % 86400) days += 0; }
      rent = Math.round(rent);
      var coverDays = secs < 86400 ? 1 : Math.floor(secs / 86400) + (secs % 86400 > 0 ? 1 : 0);
      var dmg = b.cover && NUM(b.cover.daily) ? Math.round(NUM(b.cover.daily) * coverDays) : 0;
      var dep = NUM(r.deposit), deliv = NUM(r.delivery), ret = NUM(r['return']), others = NUM(r.others), disc = NUM(r.discount);
      var startOpt = b.pickKind === 'client' ? 'Delivery to client location' : b.pickKind === 'place' ? 'Delivery to ' + placeName(b.pickLoc) : 'Pick-up from our location';
      var endOpt = b.retKind === 'client' ? 'Return from client location' : b.retKind === 'place' ? 'Return from ' + placeName(b.retLoc) : 'Drop-off at our location';
      var car = carBy[b.car] || unknownCar(b.car), cust = custBy[b.cust] || unknownCust(b.cust);
      var received = 0;
      (b.payments || []).forEach(function (p) {
        var items = (p.items || []).map(function (it) { return { kind: it.kind, amount: NUM(it.amt) }; }), amt = items.reduce(function (a, it) { return a + it.amount; }, 0);
        var who = nameOf(p.by), cashName = p.cashToName || nameOf(p.cashTo);
        var row = { id: p.id, booking: b.code, kind: items[0] ? items[0].kind : 'Other payment', amount: amt, method: p.method || '', at: DT(p.at), by: who,
          depositedTo: p.depositedTo === 'bank' ? 'Bank' : p.depositedTo === 'stripe' ? 'Stripe' : p.depositedTo === 'staff' ? 'Cash to ' + (cashName || who) : '', heldBy: p.method === 'Cash' ? (cashName || who) : null,
          afterCharge: p.afterCharge == null ? null : NUM(p.afterCharge), ref: p.ref || '', note: p.note || '', receipt: p.receiptNo || null,
          void: p.voided ? { at: DT(p.voidedAt), by: '', reason: p.voidReason || '' } : null, banked: p.bankedAt ? { at: DT(p.bankedAt), by: nameOf(p.bankedBy) } : null,
          slips: [p.slip].concat(p.slips || []).filter(Boolean).map(function (x) { var f = fileObj(x); return { name: f.name, size: 0, at: DT(p.at), path: f.path }; }),
          items: items, depositOf: p.depositOf ? codeOf[p.depositOf] || p.depositOf : null, createdAt: DT(p.at) };
        if (!p.voided) received += amt;
        d.payments.push(row);
      });
      var ins = b.inspection || {}, ag = ins.agent || {}, cu = ins.customer || {}, ap = ag.photos || {};
      if (ins.agent || ins.customer) {
        d.inspections.push({ id: 'ins-' + b.id, booking: b.code, gps: ag.gps || '', agentAt: DT(ag.at), custAt: DT(cu.at),
          photos: (cu.photos || []).map(function (x, n) { var f = fileObj(x); return { name: f.name, path: f.path, at: DT(cu.at), note: (cu.notes || [])[n] || '' }; }),
          agent: { handover: (ap.handover || []).map(fileObj)[0] || null, handoverAll: (ap.handover || []).map(fileObj), idCard: fileObj(ap.id), licence: fileObj(ap.licence), odometer: fileObj(ap.odometer) }, note: ag.note || '' });
      }
      var docs = b.docs || {};
      return { n: b.no, code: b.code, car: car, cust: cust, start: s, end: e, days: days, rent: rent, dep: dep, deliv: deliv, ret: ret, dmg: dmg, disc: disc, others: others,
        payable: rent + deliv + ret + dmg + others - disc + dep, received: received, status: b.bookingStatus || 'Pending', pay: PAY_FIX[String(b.paymentStatus || '').toLowerCase()] || '',
        agent: '', pickup: locName(b.pickLoc), drop: locName(b.retLoc), created: DT(b.created), inspected: !!(ins.agent || ins.customer), id: b.code, formId: b.formId || '', agentToken: b.agentToken || '',
        hourly: hourly, rate: daily, pkg: b.cover ? b.cover.packageId || null : null, pkgName: b.cover ? b.cover.name || '' : '', method: b.method || '', startPlace: b.pickKind === 'place' ? b.pickLoc : null, endPlace: b.retKind === 'place' ? b.retLoc : null,
        startOpt: startOpt, endOpt: endOpt, delNote: b.deliveryNote || b.pickNote || '', retNote: b.retNote || '', signature: b.authoritySignature || null, filledByAdmin: b.source === 'Staff',
        submitted: !!b.submitted, submittedAt: DT(b.submittedAt), ip: '', updated: DT(b.updated || b.created), agentIds: (b.assigned || []).filter(function (a) { return staffBy[a]; }),
        docs: { icFront: fileObj(docs.icFront), icBack: fileObj(docs.icBack), dl: fileObj(docs.licence), poa: fileObj(docs.poa), other: (docs.other || []).map(function (x) { return fileObj(x); })[0] || null, others: (docs.other || []).map(function (x) { return fileObj(x); }) },
        custSig: b.signature ? { img: b.signature } : b.signatureTyped ? { typed: b.signatureTyped } : null, source: b.source || '', note: b.note || '', refundNote: b.refundNote || '', returnKm: b.returnKm, returnFuel: b.returnFuel, createdBy: b.createdBy || '' };
    });
    d.payments.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    var bookBy = {}; d.bookings.forEach(function (x) { bookBy[x.code] = x; });

    /* invoices and receipts */
    d.invoices = (colls.invoices || []).map(function (iv) {
      return { no: iv.no, id: iv.no, booking: iv.bookingRef || codeOf[iv.booking] || '', issued: DT(iv.at), lines: (iv.lines || []).map(function (l) { return { desc: l.text, qty: l.qty, unit: NUM(l.unit), amount: NUM(l.amt) }; }),
        charges: NUM(iv.charges), deposit: NUM(iv.deposit), tax: iv.tax ? NUM(iv.tax.amt) : 0, note: iv.notes || '', status: iv.voided ? 'Void' : 'Issued', voidReason: iv.voidReason || '', sent: [] };
    }).sort(function (a, b) { return (a.issued || 0) - (b.issued || 0); });
    d.receipts = (colls.receipts || []).map(function (rc) {
      var pays = (rc.lines || []).map(function (l) { return l.payment_id ? 'p' + l.payment_id : null; }).filter(Boolean);
      return { no: rc.no, id: rc.no, payment: rc.payment || pays[0] || null, booking: rc.bookingRef || codeOf[rc.booking] || '', issued: DT(rc.at), amount: NUM(rc.amt), kind: rc.text || '', method: rc.method || '',
        status: rc.voided ? 'Void' : 'Issued', voidReason: rc.voidReason || '', sent: [], payments: pays.length ? pays : rc.payment ? [rc.payment] : [] };
    }).sort(function (a, b) { return (a.issued || 0) - (b.issued || 0); });

    /* deposits: every booking waiting for or past its refund */
    var refundBy = {}; (colls.refunds || []).forEach(function (r) { if (!r.voided) refundBy[codeOf[r.booking]] = r; });
    var dedBy = {}; (colls.deductions || []).forEach(function (x) { var c = codeOf[x.booking]; (dedBy[c] = dedBy[c] || []).push({ kind: x.paymentId ? 'Used for a payment' : x.kind || 'Other', amount: NUM(x.amt), note: x.note || '', fromPayment: x.paymentId || null }); });
    d.deposits = d.bookings.filter(function (x) { return x.pay === 'Refund Pending' || x.pay === 'Deposit Refunded'; }).map(function (x) {
      var r = refundBy[x.code];
      return { id: 'dep-' + x.code, booking: x.code, deductions: dedBy[x.code] || [], message: '', saved: true,
        refund: r ? { method: r.method || '', amount: NUM(r.amt), by: nameOf(r.by), at: DT(r.at), ref: r.ref || '', slip: r.slip ? fileObj(r.slip) : null, toBank: '', toAcct: '' } : null,
        markedByHand: !r && x.pay === 'Deposit Refunded', statementSent: null };
    });
    d.bankIns = [];

    /* expenses and their kinds */
    var known = {}; EXPENSE_CATS.forEach(function (c) { known[c[0].toLowerCase()] = c; });
    d.expenseCats = (st.expenseKinds || []).map(function (k, n) {
      var kc = known[String(k.name).toLowerCase()];
      return { id: 'cat-' + k.id, name: k.name, group: k.everyday ? 'Everyday' : 'Office and admin', icon: kc ? kc[2] : 'receipt', alsoKept: !!(kc && kc[3]), hidden: k.active === false, order: n, key: k.id,
        needsBooking: !!k.needsBooking, needsCar: !!k.needsCar, fixedAmount: k.fixed == null ? null : NUM(k.fixed), locked: false, agentFee: !!k.agentFee, feeGroup: k.group || null, oncePerPerson: false, noBooking: false, paysStaff: !!k.paysStaff, loc: null, place: null };
    });
    var catBy = {}; d.expenseCats.forEach(function (c) { catBy[c.key] = c; catBy[c.name.toLowerCase()] = c; });
    d.expenses = (colls.expenses || []).filter(function (x) { return !x.voided; }).map(function (x) {
      var cat = catBy[x.kindId] || catBy[String(x.kind || '').toLowerCase()];
      if (!cat) { cat = { id: 'cat-' + (x.kindId || String(x.kind || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '_')), name: x.kind || 'Other', group: 'Office and admin', icon: 'receipt', alsoKept: false, hidden: false, order: d.expenseCats.length, key: x.kindId || '', needsBooking: false, needsCar: false, fixedAmount: null, locked: false, agentFee: !!x.agentFee, feeGroup: x.group || null, oncePerPerson: false, noBooking: false, paysStaff: !!x.toStaff, loc: null, place: null }; d.expenseCats.push(cat); catBy[cat.key || cat.name.toLowerCase()] = cat; }
      return { id: x.id, day: DT(x.at), amount: NUM(x.amt), cat: cat.id, car: x.car || null, booking: codeOf[x.booking] || null, method: x.paidWith || '', paidTo: x.paidTo || '', note: x.note || '',
        receipt: fileObj(x.receipt), by: x.by || null, at: DT(x.created) || DT(x.at), source: 'recorded', ref: null, staff: x.staff || null };
    }).sort(function (a, b) { return (b.day || 0) - (a.day || 0); });
    d.agentFeeRates = [];

    /* fleet records */
    d.papers = papers.map(function (p) { return { id: p.id, car: p.car, kind: p.type || 'Other', name: p.title || p.type || 'Paper', until: DT(p.until), issued: DT(p.issued), provider: p.insurer || '', cost: NUM(p.cost), ref: p.ref || '', warnDays: p.warnDays || 30, note: p.note || '', file: fileObj(p.photo) }; });
    d.instalments = (colls.instalments || []).map(function (x) { return { id: x.id, car: x.car, month: String(x.due || '').slice(0, 7), due: DT(x.due), amount: NUM(x.amt), paid: x.paidAt ? { on: DT(x.paidAt), amount: NUM(x.paidAmt || x.amt), method: '', expense: x.expenseId || null, by: '' } : null }; });
    d.jobs = (colls.jobs || []).map(function (j) {
      var total = NUM(j.cost) || (NUM(j.parts) + NUM(j.labour) + NUM(j.tax));
      return { id: j.id, car: j.car, type: j.type || 'Other', title: j.note || j.type || 'Service', status: j.status === 'done' ? 'Done' : j.status === 'cancelled' ? 'Cancelled' : j.status === 'in' ? 'In the workshop' : 'Planned',
        date: DT(j.at), plannedFor: null, vendor: j.vendor || null, odo: j.km || null, lines: (j.items && j.items.length ? j.items : [{ what: j.note || j.type, type: j.type, qty: 1, price: total, partNo: '' }]).map(function (l) { return { what: l.what || l.name || '', type: l.type || j.type, qty: l.qty || 1, price: NUM(l.price || l.amount), partNo: l.partNo || '' }; }),
        tax: NUM(j.tax), invoiceNo: j.vendorInvoiceNo || '', paid: j.paidStatus === 'paid', paidOn: DT(j.paidOn), warranty: DT(j.warrantyUntil), booking: codeOf[j.booking] || null, charge: NUM(j.recoverable), note: j.note || '', files: (j.files || []).map(fileObj),
        by: nameOf(j.by), at: DT(j.created), inAt: DT(j.startedAt), backAt: DT(j.backAt), block: false, doneAt: j.status === 'done' ? DT(j.at) : null, total: total };
    });
    d.downtime = (colls.downtime || []).map(function (x) { return { id: x.id, car: x.car, reason: x.reason || 'Other', from: DT(x.from), to: DT(x.to), job: x.job || null, note: x.note || '', back: !!x.back }; });
    d.vendors = (colls.vendors || []).map(function (v) { return { id: v.id, name: v.name || '', kind: v.kind || 'Other', phone: v.phone || '', wa: v.wa || '', email: v.email || '', address: v.address || '', notes: v.notes || '', active: v.active !== false }; });
    d.odometer = (colls.odometer || []).map(function (o) { return { car: o.car, km: NUM(o.km), at: DT(o.at), by: nameOf(o.by), source: o.source || '', doubt: o.doubt || '' }; });
    d.reminders = []; d.trackerAccounts = []; d.trackers = []; d.alarms = [];

    /* summons */
    d.summons = (colls.summons || []).map(function (x) {
      var sp = x.speed || {};
      return { id: x.id, authority: x.authority || 'Other', council: '', notice: x.notice || '', plate: x.plate || '', car: x.car || null, at: DT(x.at), offence: x.offence || '', speed: sp.actual || null, limit: sp.limit || null,
        place: x.place || '', fine: NUM(x.amount), fee: NUM(x.adminFee), asked: NUM(x.chargedAmt), booking: codeOf[x.booking] || null, candidates: [], chosenByHand: false, fromPicture: false, reviewed: true,
        picture: x.photo ? fileObj(x.photo) : null, status: x.status || 'Needs a booking', paidOn: DT(x.paidAt), receipt: null, reason: x.reason || '', addedAt: DT(x.created), addedBy: nameOf(x.by), chargedAt: DT(x.chargedAt), check: [], note: x.note || '', payment: x.paymentId || null };
    });

    /* tasks */
    d.tasks = (colls.tasks || []).map(function (t) {
      var wa = {}; Object.keys(t.wa || {}).forEach(function (k) { var v = String(t.wa[k] || ''); wa[k] = v.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); });
      return { id: t.id, name: t.name || '', type: t.type || 'General', at: DT(t.at), status: t.status || 'Pending', agents: (t.staff || []).filter(function (a) { return staffBy[a]; }), wa: wa, booking: codeOf[t.booking] || null,
        note: t.note || '', voice: (t.voice || []).map(fileObj), photos: (t.photos || []).map(function (p) { return fileObj(p); }), created: DT(t.created), by: nameOf(t.by) };
    });
    d.autoRules = (colls.autoRules || []).map(function (r) { return { id: r.id, kind: r.kind, car: r.car || null, loc: r.loc || null, on: r.on !== false, staff: r.staff || [] }; });

    /* activity log (newest first) */
    var verb = function (t) { return /^Login\b/.test(t) ? 'Signed in' : /^Logout\b/.test(t) ? 'Signed out' : /^Create\b/.test(t) ? 'Created' : /^Update\b/.test(t) ? 'Changed' : /^Delete\b/.test(t) ? 'Deleted' : 'Other'; };
    d.activity = (colls.audit || []).map(function (a) {
      var ch = []; Object.keys(a.changes || {}).forEach(function (f) { var v = a.changes[f]; if (Array.isArray(v) && v.length === 2 && typeof v[1] !== 'object') ch.push({ f: f, from: v[0] == null ? '' : String(v[0]), to: v[1] == null ? '' : String(v[1]) }); });
      return { id: a.id, at: DT(a.at), who: nameOf(a.by) || a.source || '', action: verb(a.text || ''), where: '', ref: '', text: a.text || '', changes: ch, ip: '' };
    }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    d.notifications = []; d.staffMsgLog = [];

    /* booking assistant: answers only (no sample chats) */
    d.leads = []; d.leadSuggestions = []; d.catalogueItems = [];
    d.leadAnswers = (colls.answers || []).map(function (q) { return { id: q.id, q: q.question || '', kw: String(q.keywords || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean), a: q.answer || '', on: q.active !== false, used: q.used || 0, media: [] }; });
    if (d.leadSettings) { d.leadSettings.on = !!(blobs.assistant && blobs.assistant.on); d.leadSettings.testNumbers = []; }

    /* dashboard history and sample-only lists */
    d.dashHist = []; d.dashHistExp = [];
    d.reviews = []; d.faqs = d.faqs || [];

    /* old dashboard strip: this month by day, from the real bookings and expenses */
    var Y = now.getFullYear(), M = now.getMonth(), dim = now.getDate();
    var incomeOn = function (day) { var s = 0; d.bookings.forEach(function (x) { if (x.status !== 'Cancelled' && x.start && x.start.getFullYear() === day.getFullYear() && x.start.getMonth() === day.getMonth() && x.start.getDate() === day.getDate()) s += x.payable - x.dep; }); return s; };
    var expOn = function (day) { var s = 0; d.expenses.forEach(function (x) { if (x.day && x.day.toDateString() === day.toDateString()) s += x.amount; }); return s; };
    d.days = []; d.prev = []; d.exp = []; d.cnt = []; d.util = [];
    for (var k = 1; k <= dim; k++) {
      var dt = new Date(Y, M, k), pd = new Date(Y, M - 1, k);
      d.days.push(incomeOn(dt)); d.prev.push(incomeOn(pd)); d.exp.push(expOn(dt));
      d.cnt.push(d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start && x.start.toDateString() === dt.toDateString(); }).length);
      d.util.push(d.cars.length ? Math.round(100 * d.bookings.filter(function (x) { return x.status !== 'Cancelled' && x.start <= new Date(dt.getTime() + 864e5) && x.end >= dt; }).length / d.cars.length) : 0);
    }
    d.months = [];
    for (var m = 0; m <= M; m++) {
      var inc = 0, ex = 0;
      d.bookings.forEach(function (x) { if (x.status !== 'Cancelled' && x.start && x.start.getFullYear() === Y && x.start.getMonth() === m) inc += x.payable - x.dep; });
      d.expenses.forEach(function (x) { if (x.day && x.day.getFullYear() === Y && x.day.getMonth() === m) ex += x.amount; });
      d.months.push({ income: inc, expense: ex });
    }
    return d;
  }

  /* ---------- view-only: a company fed by another system ---------- */
  function guardWrites(B) {
    if (!B.mirror) return;
    var from = B.mirror.from || 'the other system';
    var say = function () { if (window.UI && UI.toast) UI.toast('View only: ' + B.name + ' is still run from ' + from + '. This change was not saved.', { tone: 'warn' }); };
    ['add', 'update', 'remove'].forEach(function (k) { var f = DB[k]; DB[k] = function () { say(); return f.apply(DB, arguments); }; });
  }

  function start(org, colls, blobs, ws, ctx) {
    ORG = org.id;
    TODAY = new Date(); T0 = Date.now();
    var B = makeBrand(org, colls, blobs, ws);
    var d = convert(B, colls, blobs);
    B.data = d; B.custom = true;
    var logo = d.company.logo; d.company.logo = null;
    loading('Loading photos and documents…');
    signAll(function () {
      if (logo && logo.dataUrl) { B.logoImg = logo.dataUrl; B.mark = '<img src="' + logo.dataUrl + '" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;background:#fff">'; }
      run(B, d, org, ws, ctx);
    });
  }
  function run(B, d, org, ws, ctx) {
    BRANDS.length = 0; BRANDS.push(B);
    OTHER_COMPANIES.length = 0; if (typeof REQUESTS !== 'undefined') REQUESTS.length = 0;
    DATA_INIT.forEach(function (f) { f.done = [B.id]; });
    S.b = 0;
    var meId = ws.staffId && d.users.some(function (u) { return u.id === ws.staffId; }) ? ws.staffId : (d.users[0] || {}).id;
    S.user = S.user || {}; S.user[B.id] = meId;
    guardWrites(B);
    window.FMS_REAL_INFO = { org: org, ctx: ctx, workspace: ws };
    host.innerHTML = '';
    document.documentElement.style.setProperty('--sx-h', '0px');
    document.title = B.name + ' · Orbique FMS';
    fmsMain();
    if (B.mirror) setTimeout(function () { if (UI && UI.toast) UI.toast('View only for now: ' + B.name + ' is still run from ' + (B.mirror.from || 'its own system') + '. Data here updates every few minutes.', { tone: 'info', ms: 8000 }); }, 800);
  }

  if (window.FMS_TEST_LOAD) window.FMS_TEST_LOAD(start); else boot();
})();

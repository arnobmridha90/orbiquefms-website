/* ---------------- CLOUD: the real app (Supabase) ----------------
   Loaded only by the real app's page (app/s/index.html), never by the demo. It signs the person in, loads their
   company's data into S from the database, and writes every change back: the screens and modules stay exactly as
   in the demo (CONTRACT.md), only where S comes from and goes to changes.
   - window.FMS_CONFIG = { url, key } (the public Supabase address and publishable key; row level security decides
     what each person may read and write).
   - Records: one row per record of a collection (public.records). Settings, the assistant switch and a person's
     preferences: public.blobs. Booking numbers come from the database so two phones never hand out the same one.
   - Files: 'file:<path>' in a record is a file in the private bucket company-files under <company id>/<path>; photos
     taken in the app (data: URLs) are uploaded on save and replaced by their 'file:' reference.
   - Other phones' changes arrive through Realtime and show on the next quiet moment (never under an open sheet). */
var FMS_CLOUD = (function () {
  var cfg = window.FMS_CONFIG || {};
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fms.auth' } });
  var COLLS = ['staff', 'cars', 'customers', 'bookings', 'notes', 'downtime', 'jobs', 'vendors', 'papers', 'odometer', 'summons', 'tasks', 'autoRules',
    'deductions', 'refunds', 'bankIns', 'expenses', 'instalments', 'tracker', 'alarms', 'wa', 'staffChat', 'invoices', 'receipts', 'audit', 'schedules', 'answers'];
  var APPEND_ONLY = { audit: 1, staffChat: 1 };          /* the app trims these lists in memory; trimming never deletes rows */
  var LOCAL_ONLY = ['notifs', 'recentCars', 'recentBookings', 'dueSeen'];
  var ws = null, user = null, snap = {}, blobSnap = {}, timer = null, flushing = false, again = false, dirtyRemote = false, failedOnce = {};
  var host = function () { return document.getElementById('app'); };

  /* ---------- small screens of our own (before the app starts) ---------- */
  function shell(inner) {
    host().innerHTML = '<main class="no-nav si-main"><div class="si-brand"><div class="si-logo cl-logo">' + orbiqueMark() + '</div><h1>Orbique FMS</h1></div>' + inner + '</main>';
  }
  function orbiqueMark() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#244060"/><circle cx="32" cy="32" r="15" fill="none" stroke="#C8A444" stroke-width="5"/><circle cx="32" cy="32" r="5" fill="#C8A444"/></svg>';
  }
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function signInScreen(start, msg, isErr) {
    shell('<form class="card si-form" id="clForm" novalidate>' +
      (msg ? '<div class="banner ' + (isErr ? 'red' : 'blue') + '" role="alert"><div>' + e(msg) + '</div></div>' : '') +
      '<label class="field"><span>Email</span><input class="inp" id="clEmail" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@company.com"></label>' +
      '<label class="field"><span>Password</span><input class="inp" id="clPass" type="password" autocomplete="current-password" placeholder="Your password"></label>' +
      '<button class="btn big" type="submit" id="clGo">Sign in</button>' +
      '<button class="btn link" type="button" id="clForgot">Forgot password, or first time here?</button></form>' +
      '<p class="demo-note">Your company’s data is private to your company’s staff.</p>');
    var em = document.getElementById('clEmail'), pw = document.getElementById('clPass');
    try { em.value = localStorage.getItem('fms.lastEmail') || ''; } catch (x) {}
    (em.value ? pw : em).focus();
    document.getElementById('clForm').onsubmit = function (ev) {
      ev.preventDefault();
      var btn = document.getElementById('clGo'); btn.disabled = true; btn.textContent = 'Signing in…';
      sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value }).then(function (r) {
        if (r.error) { signInScreen(start, r.error.message === 'Invalid login credentials' ? 'That email and password do not match.' : r.error.message, true); return; }
        try { localStorage.setItem('fms.lastEmail', em.value.trim()); } catch (x) {}
        afterSignIn(start);
      });
    };
    document.getElementById('clForgot').onclick = function () {
      var addr = em.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(addr)) { signInScreen(start, 'Type your email first, then tap this again.', true); return; }
      sb.auth.resetPasswordForEmail(addr, { redirectTo: location.origin + location.pathname + '#setpw' }).then(function (r) {
        signInScreen(start, r.error ? r.error.message : 'We sent a link to ' + addr + '. Open it on this phone to set your password.', !!r.error);
      });
    };
  }
  function setPasswordScreen(start) {
    shell('<form class="card si-form" id="clPw"><div class="banner blue"><div>Choose a password for your account.</div></div>' +
      '<label class="field"><span>New password</span><input class="inp" id="clNew" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters"></label>' +
      '<button class="btn big" type="submit">Save password</button></form>');
    document.getElementById('clPw').onsubmit = function (ev) {
      ev.preventDefault();
      var v = document.getElementById('clNew').value;
      if (v.length < 8) { alertIn('clPw', 'Use at least 8 characters.'); return; }
      sb.auth.updateUser({ password: v }).then(function (r) { if (r.error) alertIn('clPw', r.error.message); else { history.replaceState(null, '', location.pathname); afterSignIn(start); } });
    };
  }
  function alertIn(id, text) { var f = document.getElementById(id), b = f.querySelector('.banner'); if (b) b.outerHTML = ''; f.insertAdjacentHTML('afterbegin', '<div class="banner red" role="alert"><div>' + e(text) + '</div></div>'); }
  function loadingScreen(text) { shell('<div class="card cl-loading"><div class="cl-spin"></div><div>' + e(text) + '</div></div>'); }

  /* ---------- sign in, pick the company, load its data ---------- */
  function boot(start) {
    loadingScreen('Opening…');
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') setPasswordScreen(start); });
    if (/type=recovery|#setpw/.test(location.hash)) { setTimeout(function () { sb.auth.getSession().then(function (s) { if (s.data.session) setPasswordScreen(start); else signInScreen(start); }); }, 300); return; }
    sb.auth.getSession().then(function (s) { if (s.data.session) afterSignIn(start); else signInScreen(start); });
  }
  function afterSignIn(start) {
    loadingScreen('Loading your company…');
    sb.rpc('my_context').then(function (r) {
      if (r.error) { signInScreen(start, 'Could not open your account: ' + r.error.message, true); return; }
      user = r.data;
      var list = (user.workspaces || []).filter(function (w) { return w.memberStatus === 'active'; });
      if (!list.length) { shell('<div class="card"><p>Your account (' + e(user.email) + ') is not part of a company yet. Ask your company’s owner to add you.</p><button class="btn" id="clOut">Sign out</button></div>'); document.getElementById('clOut').onclick = cloudSignOut; return; }
      var want = (location.search.match(/[?&]co=([\w-]+)/) || [])[1]; try { want = want || localStorage.getItem('fms.ws'); } catch (x) {}
      var pick = list.filter(function (w) { return w.slug === want; })[0] || (list.length === 1 ? list[0] : null);
      if (pick) return open(pick, start);
      shell('<div class="list">' + list.map(function (w) { return '<button class="row" data-s="' + e(w.slug) + '"><div class="grow"><div class="t1">' + e(w.name) + '</div><div class="t2">' + e(roleName(w.role)) + '</div></div></button>'; }).join('') + '</div>');
      Array.prototype.forEach.call(host().querySelectorAll('[data-s]'), function (b) { b.onclick = function () { open(list.filter(function (w) { return w.slug === b.dataset.s; })[0], start); }; });
    });
  }
  function fetchAll(table, org) {
    var out = [], size = 1000;
    function page(from) {
      return sb.from(table).select(table === 'records' ? 'coll,id,data,deleted' : 'key,data').eq('org_id', org).range(from, from + size - 1).then(function (r) {
        if (r.error) throw r.error;
        out = out.concat(r.data);
        return r.data.length === size ? page(from + size) : out;
      });
    }
    return page(0);
  }
  function open(w, start) {
    ws = w; try { localStorage.setItem('fms.ws', w.slug); } catch (x) {}
    loadingScreen('Loading ' + w.name + '…');
    Promise.all([fetchAll('records', w.id), fetchAll('blobs', w.id), sb.from('orgs').select('next_no,identity,name').eq('id', w.id).single()]).then(function (res) {
      var d = { v: DATA_VERSION, co: w.slug, settings: {}, me: w.staffId, signedIn: w.staffId, prefsBy: {}, notifs: [], recentCars: [], recentBookings: [] };
      COLLS.forEach(function (c) { d[c] = []; snap[c] = {}; });
      res[0].forEach(function (row) { if (row.deleted || !d[row.coll]) return; d[row.coll].push(row.data); snap[row.coll][row.id] = JSON.stringify(row.data); });
      res[1].forEach(function (b) { blobSnap[b.key] = JSON.stringify(b.data.v); if (b.key === 'settings') d.settings = b.data.v || {}; else if (b.key === 'assistant') d.assistant = b.data.v; else if (b.key.indexOf('prefs:') === 0) d.prefsBy[b.key.slice(6)] = b.data.v; });
      sortLists(d);
      var org = res[2].data || {}, idt = Object.assign({}, org.identity || w.identity || {});
      d.nextNo = org.next_no || 1;
      try { var keep = JSON.parse(localStorage.getItem('fms.local.' + w.slug) || '{}'); LOCAL_ONLY.forEach(function (k) { if (keep[k]) d[k] = keep[k]; }); } catch (x) {}
      COMPANIES = {}; COMPANIES[w.slug] = Object.assign({ id: w.slug, no: d.nextNo }, idt, { name: idt.name || org.name || w.name, short: idt.short || w.name, code: idt.code || 'FMS' });
      MARKS = {}; MARKS[w.slug] = markFor(idt);
      CO = w.slug; window.__CO = w.slug;
      if (!byId(d.staff, w.staffId)) d.staff.push({ id: w.staffId, name: user.email, username: user.email, role: w.role, hasLogin: true, loginActive: true, active: false });
      var meRow = byId(d.staff, w.staffId); meRow.loginActive = true; meRow.hasLogin = true; meRow.role = w.role; if (w.role !== 'owner' && w.codes) meRow.codes = meRow.codes || null;
      d.dueSeen = d.dueSeen || {};
      READY = d;
      load = cloudLoad; save = cloudSave; signOut = cloudSignOut; imgSrc = cloudImg; switchCo = function () {};
      document.title = (d.settings.appName || (idt.short || w.name) + ' Staff');
      start();
      if (!logoMark()) signQueued();
      subscribe(w.id);
      setTimeout(prefetchFiles, 1500);
      setInterval(function () { if (dirtyRemote && !SHEETS.length) { dirtyRemote = false; render(false, true); } }, 1500);
    }).catch(function (err) { signInScreen(start, 'Could not load your company: ' + (err.message || err), true); });
  }
  var READY = null;
  function sortLists(d) {
    var by = function (k, desc) { return function (a, b) { var x = a[k] || '', y = b[k] || ''; return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); }; };
    d.bookings.sort(by('start', true)); d.audit.sort(by('at', true)); d.expenses.sort(by('at', true)); d.staffChat.sort(by('at'));
    d.cars.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0) || String(a.plate).localeCompare(b.plate); });
  }
  /* the company's mark: its initials in its colours, replaced by its logo once the logo's private link is ready */
  function logoMark() {
    var idt = COMPANIES[CO] || {}, p = idt.logo && /^file:/.test(idt.logo) ? idt.logo.slice(5) : null;
    if (p && urls[p]) { MARKS[CO] = '<img alt="" src="' + urls[p].u + '" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;background:#fff">'; return true; }
    if (p) queue[p] = 1;
    return false;
  }
  function markFor(idt) {
    var ini = String(idt.short || idt.name || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="' + (idt.dark || '#244060') + '"/><text x="32" y="41" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="24" fill="' + (idt.accent || '#C8A444') + '">' + e(ini) + '</text></svg>';
  }
  function cloudLoad() { var d = READY; S = d; usePrefs(d); return d; }

  /* ---------- writing changes back ---------- */
  function cloudSave() {
    try { var keep = {}; LOCAL_ONLY.forEach(function (k) { keep[k] = S[k]; }); localStorage.setItem('fms.local.' + CO, JSON.stringify(keep)); } catch (x) {}
    clearTimeout(timer); timer = setTimeout(flush, 350);
  }
  function flush() {
    if (!ws || !S) return;
    if (flushing) { again = true; return; }
    flushing = true;
    var ups = [], prefsKey = 'prefs:' + S.me;
    COLLS.forEach(function (c) {
      var list = S[c] || [], seen = {};
      list.forEach(function (r) {
        if (!r || !r.id) return; seen[r.id] = 1;
        var j = JSON.stringify(r);
        if (snap[c][r.id] !== j) ups.push({ coll: c, rec: r, json: j });
      });
      if (!APPEND_ONLY[c]) Object.keys(snap[c]).forEach(function (id) { if (!seen[id]) ups.push({ coll: c, rec: JSON.parse(snap[c][id]), json: null, del: true }); });
    });
    var blobs = [];
    if (JSON.stringify(S.settings) !== blobSnap.settings && (ws.role === 'owner' || ws.role === 'manager')) blobs.push({ key: 'settings', v: S.settings });
    if (S.assistant && JSON.stringify(S.assistant) !== blobSnap.assistant && (ws.role === 'owner' || ws.role === 'manager')) blobs.push({ key: 'assistant', v: S.assistant });
    if (S.prefs && JSON.stringify(S.prefs) !== blobSnap[prefsKey]) blobs.push({ key: prefsKey, v: S.prefs });
    if (!ups.length && !blobs.length) { flushing = false; return; }
    Promise.all(ups.map(function (u) { return u.del ? Promise.resolve() : uploadPhotos(u.rec, u.coll).then(function () { u.json = JSON.stringify(u.rec); }); }))
      .then(function () {
        var byColl = {};
        ups.forEach(function (u) { (byColl[u.coll] = byColl[u.coll] || []).push(u); });
        var jobs = Object.keys(byColl).map(function (c) { return writeRows(c, byColl[c]); });
        blobs.forEach(function (b) {
          jobs.push(sb.from('blobs').upsert({ org_id: ws.id, key: b.key, data: { v: b.v } }).then(function (r) { if (r.error) problem('settings', r.error); else blobSnap[b.key] = JSON.stringify(b.v); }));
        });
        return Promise.all(jobs);
      })
      .catch(function (err) { problem('save', err); })
      .then(function () { flushing = false; if (again) { again = false; flush(); } });
  }
  function writeRows(coll, list) {
    var rows = list.map(function (u) { return { org_id: ws.id, coll: coll, id: u.rec.id, data: u.rec, deleted: !!u.del }; });
    return sb.from('records').upsert(rows).then(function (r) {
      if (!r.error) { list.forEach(function (u) { if (u.del) delete snap[coll][u.rec.id]; else snap[coll][u.rec.id] = u.json; }); return; }
      if (coll === 'bookings' && r.error.code === '23505') return renumber(list);
      /* not allowed (row level security) or another problem: keep what is on this phone, say it once, do not try the same rows again */
      list.forEach(function (u) { if (u.del) delete snap[coll][u.rec.id]; else snap[coll][u.rec.id] = u.json; });
      problem(coll, r.error);
    });
  }
  /* another phone took this booking number first: take the next free one from the database and save again */
  function renumber(list) {
    return list.reduce(function (p, u) {
      return p.then(function () {
        return sb.from('records').upsert({ org_id: ws.id, coll: 'bookings', id: u.rec.id, data: u.rec, deleted: !!u.del }).then(function (r) {
          if (!r.error) { snap.bookings[u.rec.id] = JSON.stringify(u.rec); return; }
          if (r.error.code !== '23505') { problem('bookings', r.error); return; }
          return sb.rpc('take_booking_no', { p_org: ws.id }).then(function (n) {
            if (n.error) { problem('bookings', n.error); return; }
            var old = u.rec.code; u.rec.no = n.data; u.rec.code = bookingCode(n.data); S.nextNo = Math.max(S.nextNo || 0, n.data + 1);
            say('Booking number ' + old + ' was just taken on another phone. This booking is now ' + u.rec.code + '.');
            return renumber([u]);
          });
        });
      });
    }, Promise.resolve()).then(function () { dirtyRemote = true; });
  }
  function problem(what, err) {
    var k = what + ':' + (err && (err.code || err.message));
    console.error('FMS save', what, err);
    if (failedOnce[k]) return; failedOnce[k] = 1;
    var denied = err && (err.code === '42501' || /row-level security|permission/i.test(err.message || ''));
    say(denied ? 'Your role cannot change ' + what + '. It is kept on this phone only.' : 'Could not save to the server (' + (err.message || err) + '). It will try again on your next change.');
    if (!denied) failedOnce[k] = 0;
  }

  /* ---------- photos and documents ---------- */
  function uploadPhotos(obj, coll) {
    var jobs = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (typeof v === 'string' && v.length > 1500 && /^data:(image|application)\//.test(v)) {
          jobs.push(dataToBlob(v).then(function (b) {
            return sha256(b).then(function (h) {
              var ext = (b.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5), path = 'app/' + coll + '/' + h.slice(0, 40) + '.' + ext;
              return sb.storage.from('company-files').upload(ws.id + '/' + path, b, { contentType: b.type, upsert: true }).then(function (r) {
                if (r.error && !/exists/i.test(r.error.message)) throw r.error;
                urls[path] = { u: v, t: Date.now() + 864e5 }; o[k] = 'file:' + path;
              });
            });
          }));
        } else if (v && typeof v === 'object') walk(v);
      });
    })(obj);
    return Promise.all(jobs);
  }
  function sha256(blob) {
    return blob.arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); })
      .then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
  }
  function dataToBlob(d) { return fetch(d).then(function (r) { return r.blob(); }); }
  var urls = {}, queue = {}, qTimer = null, BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var baseImg = imgSrc;
  function cloudImg(x) {
    if (typeof x === 'string' && x.indexOf('file:') === 0) {
      var p = x.slice(5), hit = urls[p];
      if (hit && hit.t > Date.now()) return hit.u;
      queue[p] = 1; clearTimeout(qTimer); qTimer = setTimeout(signQueued, 60);
      return BLANK;
    }
    return baseImg(x);
  }
  function sign(paths) {
    var full = paths.map(function (p) { return ws.id + '/' + p; });
    return sb.storage.from('company-files').createSignedUrls(full, 43200).then(function (r) {
      (r.data || []).forEach(function (it, i) { if (it.signedUrl) urls[paths[i]] = { u: it.signedUrl, t: Date.now() + 42000e3 }; });
    });
  }
  function signQueued() {
    var ps = Object.keys(queue); queue = {}; if (!ps.length || !ws) return;
    var chunks = []; for (var i = 0; i < ps.length; i += 500) chunks.push(ps.slice(i, i + 500));
    Promise.all(chunks.map(sign)).then(function () { logoMark(); if (!SHEETS.length) render(false, true); else dirtyRemote = true; });
  }
  function prefetchFiles() {
    var found = {};
    (function walk(o) { if (!o) return; if (typeof o === 'string') { if (o.indexOf('file:') === 0) found[o.slice(5)] = 1; return; } if (typeof o === 'object') Object.keys(o).forEach(function (k) { walk(o[k]); }); })(S);
    var ps = Object.keys(found).filter(function (p) { return !urls[p]; });
    for (var i = 0; i < ps.length; i += 500) sign(ps.slice(i, i + 500));
  }

  /* ---------- other phones' changes ---------- */
  function subscribe(org) {
    sb.channel('org-' + org).on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'org_id=eq.' + org }, function (m) {
      var row = m.new; if (!row || !row.coll || !S[row.coll]) return;
      var j = JSON.stringify(row.data);
      if (snap[row.coll][row.id] === j) return;           /* my own change coming back */
      var list = S[row.coll], i = list.findIndex(function (r) { return r.id === row.id; });
      if (row.deleted) { if (i >= 0) list.splice(i, 1); delete snap[row.coll][row.id]; }
      else { if (i >= 0) list[i] = row.data; else list.unshift(row.data); snap[row.coll][row.id] = j; }
      if (row.coll === 'bookings' && row.data.no >= (S.nextNo || 0)) S.nextNo = row.data.no + 1;
      dirtyRemote = true;
    }).subscribe();
  }

  function cloudSignOut() {
    sb.auth.signOut().then(function () { try { localStorage.removeItem('fms.ws'); } catch (x) {} location.replace(location.pathname); });
  }

  return { boot: boot, client: sb, ws: function () { return ws; }, flush: flush, on: true };
})();

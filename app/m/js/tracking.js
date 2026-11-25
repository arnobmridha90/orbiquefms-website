/* ---------------- TRACKING (M7 builder owns this file) ----------------
   #tracking[?q=plate]  Where is it now: plate search, Moving / Parked / Offline chips with counts, speed, an over-speed chip at or above
   B().speedLimit, ignition, a live 'last update' and Open in Maps. Positions refresh every 30 seconds while the screen is open (simulated).
   Alarms (tow, power cut) for people with tracking.alarms.
   API: Track.tickAgo() refreshes every [data-ago] label on the screen. */

var TRS = { q: '', f: 'all', tab: 'fleet' };
VIEW_STATE.push(function () { TRS.q = ''; TRS.f = 'all'; TRS.tab = 'fleet'; });

var Track = (function () {
  var REFRESH_MS = 30000, timer = null, agoTimer = null, lastRefresh = 0;
  var TONE = { Moving: 'green', Parked: 'blue', Offline: 'grey' };
  function limit() { return +B().speedLimit || 110; }
  function agoText(at) { var m = Math.max(0, Math.floor((Date.now() - new Date(at)) / MIN)); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 1440) return Math.floor(m / 60) + ' h ago'; var d = Math.floor(m / 1440); return d + ' day' + (d === 1 ? '' : 's') + ' ago'; }
  function maps(t) { return 'https://www.google.com/maps?q=' + (+t.lat).toFixed(5) + ',' + (+t.lng).toFixed(5); }
  function tickAgo() { $$('[data-ago]').forEach(function (el) { el.textContent = agoText(el.dataset.ago); }); }
  /* the made-up trackers report: moving cars move on, parked ones check in, an offline one sometimes comes back */
  function refresh() {
    var now = Date.now(), R = Math.random;
    (S.tracker || []).forEach(function (t) {
      if (t.state === 'Offline') { if (R() < .04) { t.state = 'Parked'; t.at = new Date(now).toISOString(); } return; }
      if (t.state === 'Moving') {
        var mins = Math.max(.25, (now - new Date(t.at)) / MIN), km = (t.speed || 40) * Math.min(mins, 2) / 60, rad = (t.heading || 0) * Math.PI / 180;
        t.lat = +t.lat + km / 111 * Math.cos(rad); t.lng = +t.lng + km / 111 * Math.sin(rad);
        t.heading = (t.heading + Math.round((R() - .5) * 50) + 360) % 360;
        t.speed = Math.max(0, Math.min(135, Math.round(t.speed + (R() - .45) * 24)));
        if (t.speed < 5 && R() < .5) { t.state = 'Parked'; t.speed = 0; t.ignition = false; }
        t.at = new Date(now - Math.round(R() * 20) * 1000).toISOString();
      } else if (R() < .5) { t.at = new Date(now - Math.round(R() * 60) * 1000).toISOString(); if (R() < .05 && carNow(t.car)) { t.state = 'Moving'; t.ignition = true; t.speed = 25 + Math.round(R() * 40); } }
    });
    lastRefresh = now; save();
  }
  function stop() { if (timer) clearInterval(timer); if (agoTimer) clearInterval(agoTimer); timer = agoTimer = null; }
  function start() {
    stop();
    var co = CO;
    agoTimer = setInterval(function () { if (CO !== co || !S || route().name !== 'tracking' && route().name !== 'car') { stop(); return; } tickAgo(); }, 15000);
    if (route().name !== 'tracking') return;
    timer = setInterval(function () {
      if (CO !== co || !S || route().name !== 'tracking') { stop(); return; }
      if (document.visibilityState !== 'visible' || SHEETS.length) return;
      refresh(); draw(true);
    }, REFRESH_MS);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S && route().name === 'tracking' && Date.now() - lastRefresh > REFRESH_MS) { refresh(); if ($('#trlist')) draw(true); } });

  function view(r) {
    if (!can('tracking.view')) return { html: topbar('Where is it now', { back: '#more' }) + '<main>' + noAccess('tracking.view') + '</main>' };
    if (freshVisit('tracking') && TRS.deep && !(r.q && r.q.q != null)) { TRS.q = ''; TRS.f = 'all'; TRS.deep = false; }
    if (r.q && r.q.q != null) { TRS.q = r.q.q; TRS.f = 'all'; TRS.tab = 'fleet'; TRS.deep = true; try { history.replaceState(history.state, '', location.pathname + location.search + '#tracking'); } catch (e) {} }
    var alarmsOk = can('tracking.alarms'), recent = openAlarms().length;
    if (!alarmsOk) TRS.tab = 'fleet';
    var html = topbar('Where is it now', { back: '#more', sub: 'Updates every 30 seconds' }) + '<main class="tr-page">' +
      (alarmsOk ? '<div class="seg2 tr-tabs"><a href="javascript:void 0" data-tab="fleet" class="' + (TRS.tab === 'fleet' ? 'on' : '') + '">Cars</a><a href="javascript:void 0" data-tab="alarms" class="' + (TRS.tab === 'alarms' ? 'on' : '') + '">Alarms' + (recent ? '<span class="dot">' + recent + '</span>' : '') + '</a></div>' : '') +
      (TRS.tab === 'fleet' ? '<div class="cr-sticky"><label class="search">' + I('search') + '<input id="trq" type="search" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" placeholder="Plate or model" value="' + esc(TRS.q) + '">' + searchClearBtn('trq', TRS.q) + '</label><div class="chiprow" id="trchips"></div></div><div id="trlist"></div>' : '<div id="tralarms"></div>') +
      '</main>';
    return { html: html, after: function () {
      $$('[data-tab]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); TRS.tab = a.dataset.tab; render(false, true); }; });
      if (TRS.tab === 'fleet') { var q = $('#trq'), t = null; q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { TRS.q = q.value; TRS.deep = false; draw(); }, 90); }); wireSearchClear(q, function () { TRS.q = ''; TRS.deep = false; draw(); }); if (Date.now() - lastRefresh > REFRESH_MS) refresh(); draw(); }
      else drawAlarms();
      start();
    } };
  }
  /* alarms nobody has marked as handled yet, from the last day (the tab badge counts these) */
  function openAlarms() { return (S.alarms || []).filter(function (a) { return !a.handledAt && Date.now() - new Date(a.at) < DAY; }); }
  /* a car that needs a look: late back, or on rent with its tracker offline */
  function lookOf(r) { var b = carNow(r.c.id); if (!b) return ''; if (isLate(b)) return 'late'; if (r.t.state === 'Offline') return 'offline'; return ''; }
  function rows() {
    return (S.tracker || []).map(function (t) { return { t: t, c: car(t.car) }; }).filter(function (r) { return r.c; });
  }
  function draw(keep) {
    var box = $('#trlist'); if (!box) return;
    var q = TRS.q.trim(), np = normPlate(q), all = rows().filter(function (r) { return !q || normPlate(r.c.plate).indexOf(np) >= 0 || wordsMatch(q, r.c.make + ' ' + r.c.model + ' ' + r.c.color); });
    var lim0 = limit(), F = [['all', 'All'], ['look', 'Needs a look'], ['Moving', 'Moving'], ['Parked', 'Parked'], ['Offline', 'Offline']];
    var pass = function (r, f) { return f === 'all' || (f === 'look' ? !!lookOf(r) || (r.t.state === 'Moving' && r.t.speed >= lim0) : r.t.state === f); };
    $('#trchips').innerHTML = F.map(function (f) { var n = all.filter(function (r) { return pass(r, f[0]); }).length; if (f[0] === 'look' && !n && TRS.f !== 'look') return ''; return '<button type="button" class="fchip' + (TRS.f === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + (f[0] !== 'all' && f[0] !== 'look' ? '<i class="tr-dot ' + f[0] + '"></i>' : '') + f[1] + ' <span class="n">' + n + '</span></button>'; }).join('');
    $$('#trchips button').forEach(function (b) { b.onclick = function () { TRS.f = b.dataset.f; draw(); }; });
    var lim = limit(), order = { Moving: 0, Parked: 1, Offline: 2 };
    var lookRank = function (r) { var l = lookOf(r); return l === 'late' ? 0 : l === 'offline' ? 1 : 2; };
    var list = all.filter(function (r) { return pass(r, TRS.f); }).sort(function (a, b) { return ((b.t.state === 'Moving' && b.t.speed >= lim) - (a.t.state === 'Moving' && a.t.speed >= lim)) || lookRank(a) - lookRank(b) || order[a.t.state] - order[b.t.state] || a.c.plate.localeCompare(b.c.plate); });
    var over = all.filter(function (r) { return r.t.state === 'Moving' && r.t.speed >= lim; }).length;
    box.innerHTML = (over ? '<div class="banner red tr-over">' + I('warn') + '<div><b>' + over + ' car' + (over > 1 ? 's are' : ' is') + ' over ' + lim + ' km/h</b> right now.</div></div>' : '') +
      (list.length ? '<div class="list tr-list">' + list.map(rowHtml).join('') + '</div>' : '<div class="empty card">' + I('map') + '<div>No tracker matches' + (q ? ' “' + esc(q) + '”' : '') + '.</div></div>') +
      '<p class="demo-note">Positions are made up for the demo and move every 30 seconds.</p>';
  }
  function rowHtml(r) {
    var t = r.t, c = r.c, lim = limit(), bkNow = carNow(c.id), overSp = t.state === 'Moving' && t.speed >= lim, look = lookOf(r);
    return '<div class="tr-row' + (overSp ? ' over' : '') + '"><a class="tr-main" href="#car/' + c.id + '"><span class="tr-plate">' + esc(c.plate) + '</span><span class="tr-sub">' + esc(c.make + ' ' + c.model) + (bkNow ? ' · ' + esc(bkNow.code) + ' ' + esc(firstName(cust(bkNow.cust).name)) : '') + '</span>' +
      '<span class="tr-line">' + chip(t.state, TONE[t.state]) + (t.state === 'Moving' ? '<b class="tr-speed">' + Math.round(t.speed) + ' km/h</b>' : '') + (overSp ? chip('Over ' + lim + ' km/h', 'red') : '') + (look === 'late' ? chip('Late return', 'red') : '') + (look === 'offline' || (look === 'late' && t.state === 'Offline') ? chip('Offline while on rent', 'amber') : '') +
      '<span class="tr-ign">Ignition ' + (t.ignition ? 'on' : 'off') + '</span></span><span class="tr-ago">' + I('clock') + '<span data-ago="' + esc(t.at) + '">' + esc(agoText(t.at)) + '</span></span></a>' +
      '<a class="tr-maps" target="_blank" rel="noopener" href="' + maps(t) + '" aria-label="Open ' + esc(c.plate) + ' in Maps">' + I('map') + '<span>Maps</span></a></div>';
  }
  function drawAlarms() {
    var list = (S.alarms || []).slice().sort(function (a, b) { return (!!a.handledAt) - (!!b.handledAt) || new Date(b.at) - new Date(a.at); });
    $('#tralarms').innerHTML = list.length ? '<div class="list">' + list.map(function (a) {
      var c = car(a.car) || { plate: '?', make: '', model: '' }, t = (S.tracker || []).filter(function (x) { return x.car === a.car; })[0], done = !!a.handledAt;
      return '<div class="card2 tr-alarm' + (done ? ' handled' : '') + '"><span class="tr-aic">' + I(done ? 'check' : 'warn') + '</span><div class="c2-main"><div class="c2-t1">' + esc(a.kind) + ' · ' + esc(c.plate) + '</div><div class="c2-t2">' + esc(when(a.at)) + ' · <span data-ago="' + esc(a.at) + '">' + esc(agoText(a.at)) + '</span></div>' +
        (done ? '<div class="c2-t2">Handled by ' + esc(who(a.handledBy) || 'staff') + ', ' + esc(when(a.handledAt)) + (a.handledNote ? ': ' + esc(a.handledNote) : '') + '</div>' : '<button type="button" class="btn sm ghost tr-handle" data-handle="' + a.id + '">' + I('check', 2.4) + 'Checked, all OK</button>') + '</div>' +
        (t ? '<a class="iconbtn tr-amap" target="_blank" rel="noopener" href="' + maps(t) + '" aria-label="Open in Maps">' + I('map') + '</a>' : '') + '<a class="iconbtn tr-amap" href="#car/' + a.car + '" aria-label="Open the car">' + I('chev') + '</a></div>';
    }).join('') + '</div>' : '<div class="empty card">' + I('shield') + '<div>No alarms. A tow or power cut alarm shows here.</div></div>';
    $$('[data-handle]').forEach(function (b) { b.onclick = function () {
      var a = byId(S.alarms, b.dataset.handle); if (!a) return; var c = car(a.car) || {};
      a.handledBy = S.me; a.handledAt = new Date().toISOString();
      audit('Alarm handled: ' + a.kind + ' · ' + (c.plate || ''), { car: a.car, link: '#tracking' }); save(); render(false, true);
      undoSnack('Marked as handled', function () { delete a.handledBy; delete a.handledAt; save(); render(false, true); });
    }; });
  }

  VIEWS.tracking = view;
  return { tickAgo: tickAgo, refresh: refresh, agoText: agoText, startAgo: start };
})();

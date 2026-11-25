/* ===================================================================
   Page: Tracking (#page=tracking)   Owner: builder 3
   Live GPS position of each car from the tracker platform, trip history, alarms and tracker accounts.
   The map is a plain drawing (inline SVG, positions to scale, no map tiles).
   Address: #page=tracking&tab=now|history|alarms|accounts  (&car=<id> on history)
   =================================================================== */
var TR_TABS = [{ id: 'now', label: 'Fleet now', icon: 'map-pin', code: 'tracking.view' }, { id: 'history', label: 'Trip history', icon: 'route', code: 'tracking.history' }, { id: 'alarms', label: 'Alarms', icon: 'bell-ringing', code: 'tracking.alarms' }, { id: 'accounts', label: 'Accounts', icon: 'plug-connected', code: 'tracking.manage_accounts' }];
/* the over-speed limit, how long trips are kept and the platform list come from Settings (Fleet settings) */
function trFleet() { var c = CO() || {}; return c.fleet || {}; }
function trOver() { return Number(trFleet().overspeed) || 110; }
function trKeep() { return Number(trFleet().historyDays) || 30; }
function trPlatforms() { var l = ((CO() || {}).trackerPlatforms || []).filter(Boolean); return l.length ? l : ['Tracksolid Pro', 'Other']; }

function trMaps(lat, lng) { return 'https://www.google.com/maps?q=' + lat.toFixed(5) + ',' + lng.toFixed(5); }
function trPos(lat, lng) { return '<span class="tr-pos"><span class="num">' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</span><a href="' + trMaps(lat, lng) + '" target="_blank" rel="noopener" data-stop>Open in Maps</a></span>'; }
function trKm(a, b) { var R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r, h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.asin(Math.sqrt(h)); }
function trSeed(s) { var h = 2166136261; for (var k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
function trStateChip(t) { return UI.status('tracker', t.state) + (t.speed > trOver() ? ' ' + UI.chip('Over-speed', 'bad') : ''); }
function trAccChip(a) { return UI.chip(a.status, { Working: 'ok', Problem: 'bad', 'Switched off': 'grey', 'Not read yet': 'warn' }[a.status] || 'grey'); }

/* trip points for one car between two days (made up but the same on every load) */
function trTrip(carId, from, to) {
  var c = carById(carId), pos = CITY_POS[B().id] || CITY_POS.mine, pts = [];
  if (!c) return pts;
  var keepFrom = new Date(mtToday().getTime() - trKeep() * DAY);
  for (var day = new Date(from); day <= to; day = new Date(day.getTime() + DAY)) {
    if (day < keepFrom || day > NOW()) continue;
    var R = trSeed(carId + UI.isoDate(day)), trips = R() < .18 ? 0 : 1 + Math.floor(R() * 2);
    var lat = pos[0] + (R() - .5) / 12, lng = pos[1] + (R() - .5) / 12;
    for (var tp = 0; tp < trips; tp++) {
      var t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8 + tp * 7 + Math.floor(R() * 4), Math.floor(R() * 60));
      var n = 18 + Math.floor(R() * 26), head = R() * Math.PI * 2;
      for (var k = 0; k < n; k++) {
        if (t > NOW()) break;
        var stop = k > 4 && k % 11 === 0, sp = stop ? 0 : Math.round(15 + R() * 75 + (R() < .05 ? 40 : 0));
        head += (R() - .5) * .7;
        var step = sp / 60 * 3 / 111;
        lat += Math.cos(head) * step; lng += Math.sin(head) * step;
        pts.push({ at: new Date(t), speed: sp, ign: true, lat: lat, lng: lng });
        t = new Date(t.getTime() + (stop ? 7 : 3) * 6e4);
      }
      pts.push({ at: new Date(t), speed: 0, ign: false, lat: lat, lng: lng });
    }
  }
  return pts;
}
function trTripSummary(pts) {
  var km = 0, top = 0, stops = 0;
  for (var k = 0; k < pts.length; k++) {
    if (k) km += trKm(pts[k - 1], pts[k]);
    top = Math.max(top, pts[k].speed);
    if (k && pts[k - 1].speed === 0 && pts[k].at - pts[k - 1].at >= 5 * 6e4) stops++;
  }
  return { points: pts.length, km: km, top: top, stops: stops };
}

/* the drawing: points [{lat, lng, cls, label, id, sel}], path [{lat, lng}] */
function trMap(o) {
  var W = 800, H = 420, P = 40, all = (o.points || []).concat(o.path || []);
  if (!all.length) return '<div class="tr-map empty">' + UI.empty({ icon: 'map-off', title: 'Nothing to draw', text: 'No positions to show yet.' }) + '</div>';
  var la = all.map(function (p) { return p.lat; }), lo = all.map(function (p) { return p.lng; });
  var minLa = Math.min.apply(null, la), maxLa = Math.max.apply(null, la), minLo = Math.min.apply(null, lo), maxLo = Math.max.apply(null, lo);
  var cos = Math.cos((minLa + maxLa) / 2 * Math.PI / 180), spanX = Math.max((maxLo - minLo) * cos, .01), spanY = Math.max(maxLa - minLa, .01);
  var sc = Math.min((W - 2 * P) / spanX, (H - 2 * P) / spanY), cx = (minLo + maxLo) / 2, cy = (minLa + maxLa) / 2;
  var X = function (lng) { return W / 2 + (lng - cx) * cos * sc; }, Y = function (lat) { return H / 2 - (lat - cy) * sc; };
  var R = trSeed(B().id + 'map'), roads = '';
  for (var k = 0; k < 7; k++) { var y0 = R() * H, y1 = R() * H, x0 = R() * W, x1 = R() * W; roads += k % 2 ? '<path d="M-500 ' + y0.toFixed(0) + ' L0 ' + y0.toFixed(0) + ' C ' + (W * .35).toFixed(0) + ' ' + (y0 + 60).toFixed(0) + ', ' + (W * .6).toFixed(0) + ' ' + (y1 - 60).toFixed(0) + ', ' + W + ' ' + y1.toFixed(0) + ' L' + (W + 500) + ' ' + y1.toFixed(0) + '"/>' : '<path d="M' + x0.toFixed(0) + ' 0 C ' + (x0 + 50).toFixed(0) + ' ' + (H * .4).toFixed(0) + ', ' + (x1 - 50).toFixed(0) + ' ' + (H * .6).toFixed(0) + ', ' + x1.toFixed(0) + ' ' + H + '"/>'; }
  var kmPx = sc / 111, bar = [1, 2, 5, 10, 20, 50].filter(function (v) { return v * kmPx < 160; }).pop() || 1;
  var path = o.path && o.path.length > 1 ? '<polyline class="tr-route" points="' + o.path.map(function (p) { return X(p.lng).toFixed(1) + ',' + Y(p.lat).toFixed(1); }).join(' ') + '"/>' +
    '<circle class="tr-start" cx="' + X(o.path[0].lng).toFixed(1) + '" cy="' + Y(o.path[0].lat).toFixed(1) + '" r="7"/><circle class="tr-end" cx="' + X(o.path[o.path.length - 1].lng).toFixed(1) + '" cy="' + Y(o.path[o.path.length - 1].lat).toFixed(1) + '" r="7"/>' : '';
  var pins = (o.points || []).map(function (p) {
    var x = X(p.lng), y = Y(p.lat);
    return '<g class="tr-pin ' + p.cls + (p.sel ? ' sel' : '') + '" data-pin="' + p.id + '" tabindex="0" role="button" aria-label="' + esc(p.label + ', ' + p.state) + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')">' +
      (p.over ? '<circle class="tr-ring" r="15"/>' : '') + '<circle class="tr-dot" r="' + (p.sel ? 10 : 8) + '"/>' + (p.cls === 'moving' ? '<path class="tr-arrow" d="M0 -4 L3.5 3 L0 1.5 L-3.5 3 Z"/>' : '') +
      '<text x="16" y="5">' + esc(p.label) + '</text></g>';
  }).join('');
  return '<div class="tr-map"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Map of the cars') + '" preserveAspectRatio="xMidYMid meet">' +
    '<rect class="tr-land" x="-600" y="-100" width="' + (W + 1200) + '" height="' + (H + 200) + '"/><g class="tr-grid">' + [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(function (n) { return '<line x1="' + n * 100 + '" y1="0" x2="' + n * 100 + '" y2="' + H + '"/>'; }).join('') + [1, 2, 3].map(function (n) { return '<line x1="-600" y1="' + n * 105 + '" x2="' + (W + 600) + '" y2="' + n * 105 + '"/>'; }).join('') + '</g>' +
    '<path class="tr-water" d="M-600 ' + (H * .7).toFixed(0) + ' L0 ' + (H * .78).toFixed(0) + ' C ' + W * .3 + ' ' + H * .62 + ', ' + W * .55 + ' ' + H * .95 + ', ' + W + ' ' + H * .8 + ' L' + (W + 600) + ' ' + H * .72 + '"/><g class="tr-roads">' + roads + '</g>' + path + pins +
    '<g class="tr-scale" transform="translate(16 ' + (H - 18) + ')"><line x1="0" y1="0" x2="' + (bar * kmPx).toFixed(1) + '" y2="0"/><text x="0" y="-6">' + bar + ' km</text></g>' +
    '<g class="tr-north" transform="translate(' + (W - 26) + ' 30)"><path d="M0 -14 L7 6 L0 2 L-7 6 Z"/><text x="0" y="20" text-anchor="middle">N</text></g></svg></div>';
}

PAGES['tracking'] = {
  title: 'Tracking',
  render: function (root, ctx) {
    var st = ctx.state, p = ctx.params, d = ctx.data;
    var tabs = TR_TABS.filter(function (t) { return ctx.can(t.code); });
    if (!tabs.length) { root.innerHTML = '<div class="pg-h"><div><h1>Tracking</h1></div></div><div class="card">' + UI.empty({ icon: 'lock', title: 'No access', text: 'You do not have access to Tracking. Ask the owner to give you the Tracking codes.' }) + '</div>'; return; }
    if (p.tab && tabs.some(function (t) { return t.id === p.tab; })) st.tab = p.tab;
    if (!st.tab || !tabs.some(function (t) { return t.id === st.tab; })) st.tab = tabs[0].id;
    root.innerHTML = '<div class="pg-h"><div><h1>Tracking</h1><p>Where every car is now, where it went, and what its tracker reported.</p></div></div><div id="tr-tabs"></div><div id="tr-body"></div>';
    var body = root.querySelector('#tr-body');
    UI.tabs(root.querySelector('#tr-tabs'), { items: tabs.map(function (t) { return { id: t.id, label: t.label, icon: t.icon }; }), value: st.tab, onChange: function (id) { st.tab = id; ctx.setParams({ tab: id }); show(); } });
    function show() { body.innerHTML = ''; ({ now: tabNow, history: tabHistory, alarms: tabAlarms, accounts: tabAccounts })[st.tab](body); }

    /* ---------- Fleet now ---------- */
    function tabNow(el) {
      if (!d.trackerAccounts.length) { el.innerHTML = '<div class="card">' + UI.empty({ icon: 'plug-connected-x', title: 'No tracker account yet', text: 'Connect your Tracksolid account to see where your cars are. The cars are matched to trackers by the IMEI typed on each car.', action: ctx.can('tracking.manage_accounts') ? UI.btn('Go to Accounts', { attrs: { 'data-tr': 'goacc' } }) : '' }) + '</div>'; UI.on(el, 'click', '[data-tr="goacc"]', function () { st.tab = 'accounts'; ctx.setParams({ tab: 'accounts' }); ctx.refresh(); }); return; }
      st.f = st.f || { state: 'all', q: '' };
      el.innerHTML = '<div class="tr-now"><div class="card tr-mapc"><div class="tr-maph"><b>Map</b><span class="faint" id="tr-upd"></span>' + UI.btn('Refresh', { kind: 't', size: 'sm', icon: 'refresh', attrs: { 'data-tr': 'tick' } }) + '</div><div id="tr-map"></div>' +
        '<div class="tr-leg"><span><i class="moving"></i>Moving</span><span><i class="parked"></i>Parked</span><span><i class="offline"></i>Offline</span><span><i class="over"></i>Over-speed</span></div></div>' +
        '<div class="card tr-listc"><div id="tr-f"></div><div id="tr-t"></div></div></div><p class="tr-note">' + i('info-circle') + 'Updates every 30 seconds. A car is Offline when nothing was heard from its tracker for a while. Over-speed is flagged at ' + trOver() + ' km/h.</p>';
      /* the list is the cars (not the trackers): each car with its tracker, cars with no tracker as "No tracker", and
         trackers on no car (spares) left off the list and the map, only counted in a note */
      var items = function () {
        var out = d.trackers.filter(function (t) { return t.car && carById(t.car); }).map(function (t) { return { id: t.id, t: t, c: carById(t.car), state: t.state }; });
        d.cars.forEach(function (c) { if (c.fleet !== 'Sold' && !d.trackers.some(function (t) { return t.car === c.id; })) out.push({ id: 'car:' + c.id, t: null, c: c, state: 'None' }); });
        return out;
      };
      var spares = function () { return d.trackers.filter(function (t) { return !t.car || !carById(t.car); }); };
      var counts = function () { var c = { all: 0, Moving: 0, Parked: 0, Offline: 0, None: 0 }; items().forEach(function (r) { c.all++; c[r.state]++; }); return c; };
      var rows = function () {
        var q = (st.f.q || '').toLowerCase(), nq = normPlate(st.f.q || '').toLowerCase();
        return items().filter(function (r) { if (st.f.state !== 'all' && r.state !== st.f.state) return false; if (!q) return true; var txt = [r.t ? r.t.name + ' ' + r.t.imei : 'no tracker', r.c.plate + ' ' + normPlate(r.c.plate) + ' ' + carName(r.c)].join(' ').toLowerCase(); return txt.indexOf(q) >= 0 || (nq.length >= 3 && txt.indexOf(nq) >= 0); });
      };
      var noTr = function (r) { return '<span class="tr-none">' + UI.chip('No tracker', 'grey') + (ctx.can('tracking.manage_accounts') ? ' <button type="button" class="inv-link" data-tr-link="' + r.c.id + '" data-stop>Link one in Accounts</button>' : ctx.can('cars.edit') ? ' <button type="button" class="inv-link" data-tr-car="' + r.c.id + '" data-stop>Add the IMEI on the car</button>' : '') + '</span>'; };
      var tbl = UI.table(el.querySelector('#tr-t'), {
        columns: [
          { key: 'car', label: 'Car', sort: function (r) { return r.c.plate; }, render: function (r) { return mtCarCell(r.c); } },
          { key: 'name', label: 'Tracker', sort: function (r) { return r.t ? r.t.name : 'zz'; }, render: function (r) { return r.t ? esc(r.t.name) : '<span class="faint">None</span>'; } },
          { key: 'state', label: 'State', sort: function (r) { return r.state; }, render: function (r) { return r.t ? trStateChip(r.t) : noTr(r); } },
          { key: 'speed', label: 'Speed', align: 'right', sort: function (r) { return r.t ? r.t.speed : -1; }, render: function (r) { var t = r.t; return !t || t.state === 'Offline' ? '-' : '<span class="num' + (t.speed > trOver() ? ' tr-fast' : '') + '">' + t.speed + ' km/h</span>'; } },
          { key: 'ign', label: 'Ignition', render: function (r) { return r.t ? (r.t.ign ? 'On' : 'Off') : '-'; } },
          { key: 'at', label: 'Last update', sort: function (r) { return r.t && r.t.at ? +r.t.at : 0; }, render: function (r) { return r.t && r.t.at ? UI.fmt.ago(r.t.at) : '<span class="faint">' + (r.t ? 'No report yet' : '-') + '</span>'; } },
          { key: 'pos', label: 'Position', render: function (r) { return r.t ? trPos(r.t.lat, r.t.lng) : '<span class="faint">Not tracked</span>'; } }
        ],
        rows: rows(), density: 'compact', pageSize: false, minWidth: 880, rowClass: function (r) { return st.sel === r.id ? 'tr-selrow' : ''; },
        onRowClick: function (r) { if (!r.t) return; st.sel = st.sel === r.id ? null : r.id; drawMap(); tbl.setRows(rows()); },
        card: function (r) { var t = r.t, c = r.c; if (!t) return '<div class="tr-mc"><div class="row between"><b>' + esc(c.plate) + '</b></div><div class="b2">' + esc(carName(c)) + '</div><div class="b2">' + noTr(r) + '</div></div>'; return '<div class="tr-mc"><div class="row between">' + (c ? '<b>' + esc(c.plate) + '</b>' : '<span class="faint">Not linked to a car</span>') + '<span>' + trStateChip(t) + '</span></div><div class="b2">' + esc(t.name) + (c ? ' · ' + esc(carName(c)) : '') + '</div><div class="b2">' + (t.state === 'Offline' ? '' : t.speed + ' km/h · ') + 'Ignition ' + (t.ign ? 'On' : 'Off') + ' · ' + (t.at ? UI.fmt.ago(t.at) : 'No report yet') + '</div>' + trPos(t.lat, t.lng) + '</div>'; },
        empty: { icon: 'map-pin-off', title: items().length ? 'No car matches.' : 'No cars to show', text: items().length ? 'Clear the search or pick another state.' : 'Add cars on the Cars page.' }
      });
      var sp = spares();
      if (sp.length) el.querySelector('.tr-note').insertAdjacentHTML('beforeend', ' ' + plural(sp.length, 'spare tracker') + ' (' + sp.map(function (t) { return esc(t.name); }).join(', ') + ') ' + (sp.length === 1 ? 'is' : 'are') + ' on no car, so ' + (sp.length === 1 ? 'it is' : 'they are') + ' not on the map.');
      UI.on(el, 'click', '[data-tr-link]', function () { st.tab = 'accounts'; ctx.setParams({ tab: 'accounts' }); ctx.refresh(); });
      UI.on(el, 'click', '[data-tr-car]', function (ev, b) { ctx.api.editCar(b.getAttribute('data-tr-car')); });
      var filt = function () {
        var c = counts();
        UI.filters(el.querySelector('#tr-f'), { values: st.f, fields: [{ type: 'chips', key: 'state', options: [['all', 'All cars', c.all], ['Moving', 'Moving', c.Moving, 'ok'], ['Parked', 'Parked', c.Parked, 'info'], ['Offline', 'Offline', c.Offline, 'grey']].concat(c.None ? [['None', 'No tracker', c.None, 'grey']] : []) }, { type: 'search', key: 'q', placeholder: 'Search plate, car or tracker' }],
          onChange: function () { tbl.setRows(rows()); drawMap(); } });
      };
      function drawMap() {
        var vis = rows().filter(function (r) { return r.t; });
        el.querySelector('#tr-map').innerHTML = trMap({ points: vis.map(function (r) { var t = r.t; return { id: t.id, lat: t.lat, lng: t.lng, cls: t.state.toLowerCase(), state: t.state, over: t.speed > trOver(), sel: st.sel === t.id, label: r.c.plate }; }) });
        el.querySelector('#tr-upd').textContent = 'Updated ' + UI.fmt.ago(st.lastTick || NOW());
      }
      filt(); drawMap();
      var pinOpen = function (pin) {
        var t = byId(d.trackers, pin.getAttribute('data-pin')), c = t && carById(t.car); if (!t) return;
        st.sel = t.id; drawMap(); tbl.setRows(rows());
        var anchor = el.querySelector('[data-pin="' + t.id + '"]') || pin;
        var pop = UI.popover(anchor, '<div class="tr-pop"><b>' + (c ? esc(c.plate) + ' · ' + esc(carName(c)) : 'Not linked to a car') + '</b><div>' + trStateChip(t) + '</div><div class="b2">' + esc(t.name) + ' · IMEI ' + esc(t.imei) + '</div><div class="b2">' + (t.state === 'Offline' ? 'No speed' : t.speed + ' km/h') + ' · Ignition ' + (t.ign ? 'On' : 'Off') + ' · ' + (t.at ? UI.fmt.ago(t.at) : 'No report yet') + '</div>' + trPos(t.lat, t.lng) +
          (ctx.can('tracking.history') && c ? '<div class="tr-popa">' + UI.btn('Trip history', { size: 'sm', kind: 'o', icon: 'route', attrs: { 'data-hist': c.id } }) + '</div>' : '') + '</div>', { width: 300, align: 'start' });
        UI.on(pop.el, 'click', '[data-hist]', function (ev, b) { pop.close(); st.hcar = b.getAttribute('data-hist'); st.tab = 'history'; ctx.setParams({ tab: 'history' }); ctx.refresh(); });
      };
      UI.on(el, 'click', '[data-pin]', function (ev, pin) { pinOpen(pin); });
      UI.on(el, 'keydown', '[data-pin]', function (ev, pin) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pinOpen(pin); } });
      /* the live part: moving cars move on, every 30 seconds while the page is open */
      var tick = function () {
        var R = trSeed(String(Date.now()));
        d.trackers.forEach(function (t) {
          if (t.state !== 'Moving') return;
          t.speed = Math.max(20, Math.min(125, Math.round(t.speed + (R() - .5) * 30)));
          var h = R() * Math.PI * 2, step = t.speed / 3600 * 30 / 111;
          t.lat += Math.cos(h) * step; t.lng += Math.sin(h) * step; t.at = NOW();
        });
        st.lastTick = NOW(); filt(); tbl.setRows(rows()); drawMap();
      };
      UI.on(el, 'click', '[data-tr="tick"]', function () { tick(); UI.toast('Positions refreshed'); });
      var timer = setInterval(function () { if (!el.isConnected) { clearInterval(timer); return; } tick(); }, 30000);
    }

    /* ---------- Trip history ---------- */
    function tabHistory(el) {
      var cars = d.cars.filter(function (c) { return d.trackers.some(function (t) { return t.car === c.id; }); });
      if (p.car && carById(p.car)) st.hcar = p.car;
      st.hcar = st.hcar || (cars[0] && cars[0].id) || '';
      st.hfrom = st.hfrom || UI.isoDate(NOW()); st.hto = st.hto || UI.isoDate(NOW());
      el.innerHTML = '<div class="card tr-pick"><div class="tr-pickf"><div class="tr-carpk"></div>' +
        UI.dateField({ key: 'from', label: 'From', value: st.hfrom, max: UI.isoDate(NOW()), chips: [{ label: 'Today', days: 0 }, { label: 'Yesterday', days: -1 }] }) + UI.dateField({ key: 'to', label: 'To', value: st.hto, max: UI.isoDate(NOW()), chips: [{ label: 'Today', days: 0 }, { label: 'Yesterday', days: -1 }] }) + UI.btn('Show trip', { icon: 'route', attrs: { 'data-tr': 'show' } }) + '</div><div id="tr-herr"></div></div><div id="tr-hres"></div>';
      var res = el.querySelector('#tr-hres'), err = el.querySelector('#tr-herr');
      UI.carPicker(el.querySelector('.tr-carpk'), { key: 'car', label: 'Car', value: st.hcar, cars: cars, badges: false, placeholder: cars.length ? 'Search plate' : 'No car has a tracker', title: 'Trip history of which car?', emptyText: 'No car has a tracker yet.', onChange: function (v) { if (v) run(); } });
      function run() {
        var f = UI.form(el.querySelector('.tr-pickf')); st.hcar = f.car; st.hfrom = f.from; st.hto = f.to;
        err.innerHTML = '';
        var a = UI.parseDate(f.from), b = UI.parseDate(f.to);
        if (!f.car) { err.innerHTML = UI.alert('Pick a car.', 'warn'); return; }
        if (!a || !b) { err.innerHTML = UI.alert('Pick both dates.', 'warn'); return; }
        if (b < a) { err.innerHTML = UI.alert('The To date must be on or after the From date.', 'warn'); return; }
        if ((b - a) / DAY > 6) { err.innerHTML = UI.alert('Pick at most 7 days at a time.', 'warn'); return; }
        if (a < new Date(mtToday().getTime() - trKeep() * DAY)) err.innerHTML = UI.alert('Trips are kept for ' + trKeep() + ' days (Settings, Fleet settings). Older days show nothing.', 'info');
        ctx.setParams({ car: f.car }, true);
        var pts = trTrip(f.car, a, b), s = trTripSummary(pts);
        if (!pts.length) { res.innerHTML = '<div class="card">' + UI.empty({ icon: 'route-off', title: 'No points saved for these dates.', text: 'Trips are kept for ' + trKeep() + ' days.' }) + '</div>'; return; }
        var c = carById(f.car);
        res.innerHTML = '<div class="tr-stats">' + [['Points', UI.fmt.num(s.points)], ['Distance (straight lines)', s.km.toFixed(1) + ' km'], ['Top speed', s.top + ' km/h'], ['Stops of 5 min or more', s.stops]].map(function (x) { return '<div class="card tr-stat"><span>' + x[0] + '</span><b class="num">' + x[1] + '</b></div>'; }).join('') + '</div>' +
          '<div class="card tr-mapc">' + trMap({ path: pts, label: 'Trip of ' + c.plate }) + '<div class="tr-leg"><span><i class="start"></i>Start</span><span><i class="end"></i>End</span>' + (s.top > trOver() ? '<span>' + UI.chip('Over ' + trOver() + ' km/h at least once', 'bad') + '</span>' : '') + '</div></div>' +
          '<div class="card"><div class="tr-th"><b>' + plural(pts.length, 'point') + '</b>' + UI.btn('Excel', { kind: 'o', size: 'sm', icon: 'file-spreadsheet', attrs: { 'data-tr': 'xls' } }) + '</div><div id="tr-pts"></div></div>';
        UI.table(res.querySelector('#tr-pts'), { columns: [
          { key: 'at', label: 'Time', render: function (x) { return x.at.getDate() + ' ' + MON[x.at.getMonth()] + ' ' + String(x.at.getHours()).padStart(2, '0') + ':' + String(x.at.getMinutes()).padStart(2, '0'); } },
          { key: 'speed', label: 'Speed', align: 'right', render: function (x) { return '<span class="num' + (x.speed > trOver() ? ' tr-fast' : '') + '">' + x.speed + ' km/h</span>'; } },
          { key: 'ign', label: 'Ignition', render: function (x) { return x.ign ? 'On' : 'Off'; } },
          { key: 'pos', label: 'Position', render: function (x) { return trPos(x.lat, x.lng); } }], rows: pts, rowKey: function (x) { return +x.at; }, density: 'compact', pageSize: 50, pageSizes: [50, 100, 500], minWidth: 560 });
        UI.on(res, 'click', '[data-tr="xls"]', function () {
          UI.xlsx('Trip_' + c.plate.replace(/ /g, '') + '_' + f.from + '_' + f.to + '.xlsx', [{ name: 'Trip', rows: [['Time', 'Speed (km/h)', 'Ignition', 'Latitude', 'Longitude']].concat(pts.map(function (x) { return [UI.fmt.dateTime(x.at), x.speed, x.ign ? 'On' : 'Off', +x.lat.toFixed(5), +x.lng.toFixed(5)]; })), cols: [20, 12, 10, 12, 12], filter: true }]);
        });
      }
      UI.on(el, 'click', '[data-tr="show"]', run);
      if (cars.length) run();
    }

    /* ---------- Alarms ---------- */
    function tabAlarms(el) {
      st.af = st.af || { car: '', from: UI.isoDate(new Date(mtToday().getTime() - 6 * DAY)), to: UI.isoDate(NOW()), type: '' };
      el.innerHTML = '<div class="card"><div id="tr-af"></div><div id="tr-at"></div></div>';
      var rows = function () {
        var v = st.af, a = v.from ? UI.parseDate(v.from) : null, b = v.to ? new Date(UI.parseDate(v.to).getTime() + DAY - 1) : null;
        return d.alarms.filter(function (x) { return (!v.car || x.car === v.car) && (!v.type || x.type === v.type) && (!a || x.at >= a) && (!b || x.at <= b); });
      };
      var tbl = UI.table(el.querySelector('#tr-at'), { columns: [
        { key: 'at', label: 'When', sort: true, render: function (x) { return UI.fmt.dateTime(x.at) + '<div class="faint b2">' + UI.fmt.ago(x.at) + '</div>'; } },
        { key: 'car', label: 'Car', render: function (x) { return mtCarCell(carById(x.car)); } },
        { key: 'type', label: 'Alarm', sort: true, render: function (x) { return UI.chip(x.type, /SOS|Power|speed/.test(x.type) ? 'bad' : 'warn'); } },
        { key: 'pos', label: 'Position', render: function (x) { return trPos(x.lat, x.lng); } }], rows: rows(), sort: { key: 'at', dir: 'desc' }, density: 'compact', pageSize: 25, minWidth: 640,
        card: function (x) { var c = carById(x.car); return '<div class="tr-mc"><div class="row between"><b>' + (c ? esc(c.plate) : '') + '</b>' + UI.chip(x.type, /SOS|Power|speed/.test(x.type) ? 'bad' : 'warn') + '</div><div class="b2">' + UI.fmt.dateTime(x.at) + '</div>' + trPos(x.lat, x.lng) + '</div>'; },
        empty: { icon: 'bell-off', title: 'No alarms in this time.', text: 'Pick other dates or another car.' } });
      UI.filters(el.querySelector('#tr-af'), { values: st.af, fields: [
        { type: 'select', key: 'car', label: 'Car', options: mtCarOpts(true), all: 'All cars' },
        { type: 'select', key: 'type', label: 'Alarm', options: LISTS.alarmTypes, all: 'All alarms' },
        { type: 'daterange', from: 'from', to: 'to', label: 'Dates' }], onChange: function () { tbl.setRows(rows()); } });
    }

    /* ---------- Accounts ---------- */
    function tabAccounts(el) {
      el.innerHTML = '<div class="card tr-acc"><div class="tr-th"><div><b>Tracker accounts</b><p class="b2">The cars are read from these Tracksolid accounts every minute.</p></div>' + UI.btn('Add account', { icon: 'plus', attrs: { 'data-tr': 'add' } }) + '</div><div id="tr-acct"></div></div>' +
        '<div class="card tr-acc"><div class="tr-th"><div><b>Trackers and cars</b><p class="b2">A tracker is linked to the car with the same IMEI (Cars, Tracker). Link one by hand here when it is missing.</p></div></div><div id="tr-devt"></div></div>';
      UI.table(el.querySelector('#tr-acct'), { columns: [
        { key: 'name', label: 'Name', render: function (a) { return '<b>' + esc(a.name) + '</b><div class="faint b2">' + esc(a.platform) + ' · ' + esc(a.user) + '</div>'; } },
        { key: 'status', label: 'Status', render: function (a) { return trAccChip(a) + (a.status === 'Problem' && a.error ? '<div class="b2 tr-errt">' + esc(a.error) + '</div>' : ''); } },
        { key: 'count', label: 'Trackers', align: 'right', render: function (a) { return d.trackers.filter(function (t) { return t.account === a.id; }).length; } },
        { key: 'lastRead', label: 'Last read', render: function (a) { return a.lastRead ? UI.fmt.ago(a.lastRead) : '<span class="faint">Never</span>'; } },
        { key: 'act', label: 'Actions', align: 'right', render: function (a) { return '<div class="tr-acts" data-stop>' + UI.btn('Test connection', { kind: 't', size: 'sm', icon: 'plug', attrs: { 'data-acc': 'test', 'data-id': a.id } }) + UI.btn('Sync now', { kind: 't', size: 'sm', icon: 'refresh', attrs: { 'data-acc': 'sync', 'data-id': a.id } }) + UI.iconBtn('edit', 'Edit', { size: 'sm', attrs: { 'data-acc': 'edit', 'data-id': a.id } }) + UI.iconBtn('trash', 'Remove', { size: 'sm', attrs: { 'data-acc': 'del', 'data-id': a.id } }) + '</div>'; } }],
        rows: d.trackerAccounts, pageSize: false, minWidth: 820,
        card: function (a) { return '<div class="tr-mc"><div class="row between"><b>' + esc(a.name) + '</b>' + trAccChip(a) + '</div><div class="b2">' + d.trackers.filter(function (t) { return t.account === a.id; }).length + ' trackers · read ' + (a.lastRead ? UI.fmt.ago(a.lastRead) : 'never') + '</div><div class="tr-acts" data-stop>' + UI.btn('Test', { kind: 't', size: 'sm', icon: 'plug', attrs: { 'data-acc': 'test', 'data-id': a.id } }) + UI.btn('Sync now', { kind: 't', size: 'sm', icon: 'refresh', attrs: { 'data-acc': 'sync', 'data-id': a.id } }) + UI.iconBtn('edit', 'Edit', { size: 'sm', attrs: { 'data-acc': 'edit', 'data-id': a.id } }) + UI.iconBtn('trash', 'Remove', { size: 'sm', attrs: { 'data-acc': 'del', 'data-id': a.id } }) + '</div></div>'; },
        empty: { icon: 'plug-connected-x', title: 'No tracker account yet', text: 'Add your Tracksolid account to read your trackers.' } });
      var carSel = function (t) { var c = carById(t.car); return '<button type="button" class="btn o sm tr-link" data-link="' + t.id + '" aria-label="Car for ' + esc(t.name) + '" data-stop>' + (c ? '<b>' + esc(c.plate) + '</b>' : '<span class="faint">Not linked</span>') + i('chevron-down') + '</button>'; };
      UI.table(el.querySelector('#tr-devt'), { columns: [
        { key: 'name', label: 'Tracker', render: function (t) { return esc(t.name); } },
        { key: 'imei', label: 'IMEI', render: function (t) { var c = carById(t.car); return '<span class="num">' + esc(t.imei) + '</span>' + (c && (!c.tracker || c.tracker.imei !== t.imei) ? '<div class="b2 faint">Linked by hand</div>' : ''); } },
        { key: 'account', label: 'Account', render: function (t) { var a = byId(d.trackerAccounts, t.account); return a ? esc(a.name) : '-'; } },
        { key: 'car', label: 'Car', render: carSel }], rows: d.trackers, pageSize: false, minWidth: 640,
        card: function (t) { return '<div class="tr-mc"><b>' + esc(t.name) + '</b><div class="b2 num">' + esc(t.imei) + '</div>' + carSel(t) + '</div>'; },
        empty: { icon: 'device-mobile-off', title: 'No tracker yet', text: 'No tracker yet. Press Sync now on an account to read its tracker list.' } });
      UI.on(el, 'click', '[data-link]', function (ev, s) { ev.stopPropagation(); trLinkDialog(byId(d.trackers, s.getAttribute('data-link'))); });
      UI.on(el, 'click', '[data-tr="add"]', function () { trAccountDialog(null); });
      UI.on(el, 'click', '[data-acc]', function (ev, b) {
        var a = byId(d.trackerAccounts, b.getAttribute('data-id')), act = b.getAttribute('data-acc'); if (!a) return;
        if (act === 'edit') return trAccountDialog(a);
        if (act === 'del') return UI.confirm({ title: 'Remove ' + a.name + '?', text: 'Remove ' + a.name + '? Its trackers, saved trips and alarms are removed from this system too. Nothing changes on Tracksolid.', ok: 'Remove', danger: true }).then(function (y) {
          if (!y) return;
          var gone = d.trackers.filter(function (t) { return t.account === a.id; }), cars = gone.map(function (t) { return t.car; });
          d.trackers = d.trackers.filter(function (t) { return t.account !== a.id; });
          d.alarms = d.alarms.filter(function (x) { return cars.indexOf(x.car) < 0 || d.trackers.some(function (t) { return t.car === x.car; }); });
          DB.remove('trackerAccounts', a, { text: DB.actor() + ' removed tracker account ' + a.name + ' and ' + plural(gone.length, 'tracker') });
          UI.toast(a.name + ' removed');
        });
        b.disabled = true; var lbl = b.innerHTML; b.innerHTML = '<span class="cr-spin">' + i('loader-2') + '</span>' + (act === 'test' ? 'Testing...' : 'Reading...');
        setTimeout(function () {
          b.disabled = false; b.innerHTML = lbl;
          var bad = a.status === 'Problem' || !a.appKey;
          if (act === 'test') { if (bad) UI.toast('The connection failed: ' + (a.error || 'the app key was refused.'), { tone: 'bad', ms: 6000 }); else UI.toast('The connection works. Tracksolid answered in 0.4 s.', { tone: 'ok' }); return; }
          if (bad) { DB.update('trackerAccounts', a, { lastRead: a.lastRead }, { silent: true }); UI.toast('Could not read ' + a.name + ': ' + (a.error || 'the app key was refused.'), { tone: 'bad', ms: 6000 }); return; }
          var added = 0;
          if (!d.trackers.some(function (t) { return t.account === a.id; })) {
            var pos = CITY_POS[B().id] || CITY_POS.mine, R = trSeed(a.id);
            [1, 2].forEach(function (n) { added++; d.trackers.push({ id: 'dev-' + a.id + '-' + n, name: 'GT06-NEW' + n, imei: '86' + String(Math.floor(R() * 1e7)).padStart(7, '0') + String(Math.floor(R() * 1e6)).padStart(6, '0'), account: a.id, car: null, state: 'Parked', speed: 0, ign: false, at: NOW(), lat: pos[0] + (R() - .5) / 20, lng: pos[1] + (R() - .5) / 20 }); });
          }
          /* link by IMEI, the same as the live system */
          d.trackers.forEach(function (t) { if (!t.car) { var c = d.cars.filter(function (x) { return x.tracker && x.tracker.imei === t.imei; })[0]; if (c) t.car = c.id; } });
          var n = d.trackers.filter(function (t) { return t.account === a.id; }).length;
          DB.update('trackerAccounts', a, { status: 'Working', lastRead: NOW(), count: n, error: '' }, { text: DB.actor() + ' read tracker account ' + a.name + ' (' + plural(n, 'tracker') + ')' });
          UI.toast('Read ' + plural(n, 'tracker') + ' from ' + a.name + (added ? ', ' + added + ' new' : ''), { tone: 'ok' });
        }, 700);
      });
    }
    show();
  },
  search: [{ label: 'Where are the cars now', icon: 'map-pin', run: function () { go('tracking', { tab: 'now' }); } }, { label: 'Add a tracker account', icon: 'plug-connected', run: function () { go('tracking', { tab: 'accounts' }); setTimeout(function () { trAccountDialog(null); }, 50); } }]
};

/* link a tracker to a car by hand: a searchable car list; a car can follow one tracker only */
function trLinkDialog(t) {
  if (!t) return;
  var pick = t.car || '';
  var dl = UI.dialog({ title: 'Which car has ' + t.name + '?', text: 'IMEI ' + t.imei, width: 'sm', body: '<div class="tr-lpk"></div><p class="b2">The car is usually found by the IMEI typed on it (Cars, Tracker). Link one by hand only when that is missing.</p><div class="tr-lwarn"></div>',
    buttons: [{ label: 'Unlink', kind: 't', disabled: !t.car, onClick: function () { save(''); } }, { label: 'Cancel', kind: 'g' }, { label: 'Link', icon: 'link', onClick: function () { if (!pick) { UI.toast('Pick the car first', { tone: 'warn' }); return false; } save(pick); } }] });
  var warn = function () { var o = pick && D().trackers.filter(function (x) { return x.car === pick && x !== t; })[0]; dl.body.querySelector('.tr-lwarn').innerHTML = o ? UI.alert(carById(pick).plate + ' now follows ' + o.name + '. Linking moves it to ' + t.name + '.', 'warn') : ''; };
  UI.carPicker(dl.body.querySelector('.tr-lpk'), { key: 'car', label: 'Car', value: pick, badges: false, placeholder: 'Search plate', onChange: function (v) { pick = v || ''; warn(); } });
  warn();
  function save(v) {
    var c = carById(v), other = c && D().trackers.filter(function (x) { return x.car === c.id && x !== t; })[0];
    if (other) DB.update('trackers', other, { car: null }, { silent: true });
    DB.update('trackers', t, { car: v || null }, { text: DB.actor() + (c ? ' linked tracker ' + t.name + ' to ' + c.plate : ' unlinked tracker ' + t.name) });
    UI.toast(c ? t.name + ' now follows ' + c.plate : t.name + ' is not linked to a car');
  }
  return dl;
}

/* Add / Edit tracker account */
function trAccountDialog(a) {
  var isNew = !a, v = a ? Object.assign({}, a) : { name: trPlatforms()[0], platform: trPlatforms()[0], api: '', appKey: '', user: '', sub: '', every: true };
  var draw = function (err) {
    err = err || {};
    return '<div class="alert pri tr-help">' + i('info-circle') + '<div>In Tracksolid, open the API Request page of your account to get the app key and app secret. Ask Tracksolid support to switch the API on if you do not see it.</div></div>' +
      '<div class="tr-form">' + UI.input({ key: 'name', label: 'Name', required: true, value: v.name, placeholder: 'Tracksolid Pro', error: err.name }) +
      UI.select({ key: 'platform', label: 'Platform', value: v.platform, options: trPlatforms().concat(v.platform && trPlatforms().indexOf(v.platform) < 0 ? [v.platform] : []), help: 'The list comes from Settings' }) +
      UI.input({ key: 'api', label: 'Web address of the API (optional)', value: v.api, placeholder: 'https://', help: 'Only for Other. Leave empty for the usual address.', full: true, error: err.api }) +
      UI.input({ key: 'appKey', label: 'App key', required: true, value: isNew ? '' : 'saved-app-key', error: err.appKey }) +
      UI.input({ key: 'secret', label: 'App secret', type: 'password', required: isNew, value: '', help: isNew ? '' : 'Saved. Leave empty to keep it, or type a new one.', error: err.secret }) +
      UI.input({ key: 'user', label: 'Tracksolid account (user id)', required: true, value: v.user, error: err.user }) +
      UI.input({ key: 'pass', label: 'Account password', type: 'password', required: isNew, value: '', help: isNew ? '' : 'Saved. Leave empty to keep it, or type a new one.', error: err.pass }) +
      UI.input({ key: 'sub', label: 'List trackers of this account (optional)', value: v.sub || '', help: 'A sub-account, when your trackers sit under one.', full: true }) +
      UI.switch({ key: 'every', label: 'Read this account every minute', checked: v.every !== false, full: true }) + '</div>';
  };
  var dl = UI.dialog({ title: isNew ? 'Add tracker account' : 'Edit tracker account', width: 'md', body: draw(), buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Save', icon: 'check', onClick: function (dl2) {
    var f = UI.form(dl2.body), err = {};
    Object.assign(v, { name: f.name, platform: f.platform, api: f.api, user: f.user, sub: f.sub, every: f.every });
    if (!f.name.trim()) err.name = 'Type a name';
    if (!f.appKey.trim()) err.appKey = 'Type the app key';
    if (!f.user.trim()) err.user = 'Type the account user id';
    if (isNew && !f.secret) err.secret = 'Type the app secret';
    if (isNew && !f.pass) err.pass = 'Type the account password';
    if (f.api && !/^https?:\/\/\S+\.\S+/.test(f.api)) err.api = 'Type a web address that starts with https://';
    if (/^Other/i.test(f.platform || '') && !f.api) err.api = 'Other needs its own web address';
    if (Object.keys(err).length) { dl2.setBody(draw(err)); return false; }
    var rec = { name: f.name.trim(), platform: f.platform, api: f.api, appKey: 'saved', user: f.user.trim(), sub: f.sub, every: !!f.every };
    if (isNew) { rec.status = 'Not read yet'; rec.count = 0; rec.lastRead = null; DB.add('trackerAccounts', rec, { label: 'tracker account' }); UI.toast(rec.name + ' added. Press Sync now to read its trackers.'); }
    else { if (!rec.every && a.status === 'Working') rec.status = 'Switched off'; if (rec.every && a.status === 'Switched off') rec.status = 'Not read yet'; DB.update('trackerAccounts', a, rec, { label: 'tracker account' }); UI.toast('Saved'); }
  } }] });
  return dl;
}

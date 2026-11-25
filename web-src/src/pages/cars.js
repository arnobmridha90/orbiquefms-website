/* ===================================================================
   Page: Cars (#page=cars)   Owner: builder 3
   The fleet list (cards or table) and each car's full record: details, rates, owner, instalment, tracker,
   papers (road tax, insurance, grant) with "Read document" and the review step, private owner files, gallery.
   Address: #page=cars&car=<id> opens a car, &action=add opens New Car. Sets API.openCar.
   =================================================================== */
var CARS_SORTS = [['default', 'Sort: default'], ['plate', 'Plate number'], ['name', 'Make and model'], ['newest', 'Newest first'], ['status', 'Status'], ['serial', 'Serial'], ['roadtax', 'Road tax: soonest first']];
/* filter chips: [id, label, test, tone] */
var CARS_CHIPS = [
  ['all', 'All', function () { return true; }],
  ['active', 'Active', function (c) { return (c.fleet || 'Active') === 'Active'; }, 'ok'],
  ['notuse', 'Not in use', function (c) { return c.fleet === 'Not in use'; }, 'grey'],
  ['sold', 'Sold', function (c) { return c.fleet === 'Sold'; }, 'grey'],
  ['hidden', 'Hidden from website', function (c) { return c.web === false; }, 'info'],
  ['tax', 'Road tax due', function (c) { return c.fleet !== 'Sold' && (!c.tax || UI.fmt.daysFrom(c.tax) <= 30); }, 'warn'],
  ['shop', 'In workshop', function (c) { return !!c.inWorkshop; }, 'warn']
];
function carsPlatforms() { var l = (CO().trackerPlatforms || []).filter(Boolean); return l.length ? l : ['Tracksolid Pro']; }
/* the dashcam list in Settings > Fleet (falls back to the tracker list for older settings) */
function carsCamPlatforms() { var l = (CO().dashcamPlatforms || []).filter(Boolean); return l.length ? l : carsPlatforms(); }
var CARS_SLOTS = [['roadtax', 'Road tax', 'receipt-tax'], ['insurance', 'Insurance', 'shield-check'], ['grant', 'Car grant', 'license']];
var CARS_OWNER = [['ic', 'Owner IC', 'id'], ['licence', 'Owner driving licence', 'id-badge-2'], ['agreement', 'Agreement', 'file-text']];
var CARS_SHAPE = { Hatchback: 'hatch', Sedan: 'sedan', SUV: 'suv', MPV: 'mpv', Other: 'sedan' };

/* the car's picture: its thumbnail, its first gallery picture, or the drawing in its colour */
function carsThumb(c, cls) {
  if (!c) return '';
  var g = (c.gallery || []).filter(function (x) { return x.dataUrl; })[0], src = c.thumb || (g && g.dataUrl);
  return '<span class="cr-thumb ' + (cls || '') + '">' + (src ? '<img src="' + src + '" alt="' + esc(carName(c)) + '">' : carSVG(c.color, c.shape, { label: carName(c) })) + '</span>';
}
/* Valid / Expires in N days / Expires today / Expired N days ago / Not recorded */
function carsTaxChip(c) {
  if (!c.tax) return UI.chip('Not recorded', 'grey');
  var k = UI.fmt.daysFrom(c.tax);
  return k < 0 ? UI.chip('Expired ' + plural(-k, 'day') + ' ago', 'bad') : k === 0 ? UI.chip('Expires today', 'bad') : k <= 30 ? UI.chip('Expires in ' + plural(k, 'day'), 'warn') : UI.chip('Valid', 'ok');
}
function carsChips(c) { return UI.status('fleet', c.fleet || 'Active') + (c.web === false ? UI.chip('Hidden from website', 'info') : '') + (c.inWorkshop ? UI.chip('In the workshop', 'warn') : ''); }
function carsSpec(c) { return [c.year, c.type, c.cc ? UI.fmt.num(c.cc) + ' cc' : '', c.seats ? c.seats + ' seats' : '', c.trans, c.fuel].filter(Boolean).join(' · '); }
function carsSorted(list, s) {
  var l = list.slice(), st = { 'Active': 0, 'Not in use': 1, 'Sold': 2 };
  if (s === 'plate') l.sort(function (a, b) { return a.plate.localeCompare(b.plate); });
  else if (s === 'name') l.sort(function (a, b) { return carName(a).localeCompare(carName(b)); });
  else if (s === 'newest') l.sort(function (a, b) { return (b.created || 0) - (a.created || 0) || b.year - a.year || b.serial - a.serial; });
  else if (s === 'status') l.sort(function (a, b) { return (st[a.fleet] || 0) - (st[b.fleet] || 0) || (a.serial || 0) - (b.serial || 0); });
  else if (s === 'serial') l.sort(function (a, b) { return (a.serial || 999) - (b.serial || 999); });
  else if (s === 'roadtax') l.sort(function (a, b) { return (a.tax ? +a.tax : 9e15) - (b.tax ? +b.tax : 9e15); });
  return l;
}

PAGES['cars'] = {
  title: 'Cars',
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data;
    st.q = st.q || ''; st.sort = st.sort || 'default'; st.per = st.per || 12; st.page = st.page || 1;
    if (!st.view) { try { st.view = localStorage.getItem('fms.carView') || 'cards'; } catch (e) { st.view = 'cards'; } }
    var q = st.q.toLowerCase(), qp = normPlate(st.q);
    st.chip = st.chip || 'all';
    var chipDef = CARS_CHIPS.filter(function (x) { return x[0] === st.chip; })[0] || CARS_CHIPS[0];
    var matchQ = function (c) { return !q || (c.plate + ' ' + carName(c) + ' ' + c.color + ' ' + (c.serial || '') + ' ' + c.type).toLowerCase().indexOf(q) >= 0 || (qp.length >= 2 && normPlate(c.plate).indexOf(qp) >= 0); };
    var list = carsSorted(d.cars.filter(function (c) { return matchQ(c) && chipDef[2](c); }), st.sort);
    var pages = Math.max(1, Math.ceil(list.length / st.per)); if (st.page > pages) st.page = pages;
    var shown = list.slice((st.page - 1) * st.per, st.page * st.per), from = list.length ? (st.page - 1) * st.per + 1 : 0, to = Math.min(list.length, st.page * st.per);
    var canE = ctx.can('cars.edit'), canD = ctx.can('cars.delete');
    var card = function (c) {
      return '<div class="cr-card" role="button" tabindex="0" data-car="' + c.id + '"><div class="cr-photo">' + carsThumb(c) + '<span class="cr-acts">' + (canE ? UI.iconBtn('edit', 'Edit ' + c.plate, { size: 'sm', attrs: { 'data-cact': 'edit', 'data-id': c.id } }) : '') + (canD ? UI.iconBtn('trash', 'Delete ' + c.plate, { size: 'sm', attrs: { 'data-cact': 'del', 'data-id': c.id } }) : '') + '</span></div>' +
        '<div class="cr-body"><div class="t1c fw5 ellip">' + esc(carName(c)) + '</div><span class="plate cr-plate">' + esc(c.plate) + '</span><div class="row wrap gap4">' + carsChips(c) + '</div><div class="b2">' + esc(carsSpec(c)) + '</div>' +
        '<div class="cr-row"><span class="b2">Road tax</span>' + carsTaxChip(c) + '</div><div class="cr-row"><span class="b2">Odometer</span><span class="t1c num">' + UI.fmt.num(c.odo) + ' km</span></div></div></div>';
    };
    var pager = list.length ? '<div class="pager cr-pager"><span>Showing ' + from + ' to ' + to + ' of ' + list.length + ' entries</span><span class="pgs">' +
      [['1', 'chevrons-left', 'First page', st.page === 1], [String(st.page - 1), 'chevron-left', 'Previous page', st.page === 1]].map(function (b) { return '<button type="button" data-cpg="' + b[0] + '" aria-label="' + b[2] + '"' + (b[3] ? ' disabled' : '') + '>' + i(b[1]) + '</button>'; }).join('') +
      Array.apply(null, { length: pages }).map(function (_, k) { return '<button type="button" data-cpg="' + (k + 1) + '" aria-current="' + (k + 1 === st.page) + '">' + (k + 1) + '</button>'; }).join('') +
      [[String(st.page + 1), 'chevron-right', 'Next page', st.page === pages], [String(pages), 'chevrons-right', 'Last page', st.page === pages]].map(function (b) { return '<button type="button" data-cpg="' + b[0] + '" aria-label="' + b[2] + '"' + (b[3] ? ' disabled' : '') + '>' + i(b[1]) + '</button>'; }).join('') + '</span></div>' : '';
    root.innerHTML = '<div class="pg-h"><div><h1>Cars</h1><p>' + plural(d.cars.length, 'car') + ' in the fleet. Open a car for its papers, owner, tracker and pictures.</p></div><div class="acts">' + (ctx.can('cars.create') ? UI.btn('New Car', { icon: 'plus', attrs: { 'data-cact': 'new' } }) : '') + '</div></div>' +
      '<div class="card cr-tools"><div class="inp srch cr-search">' + i('search') + '<input type="search" data-key="cars-q" placeholder="Search cars..." aria-label="Search cars" value="' + esc(st.q) + '"></div>' +
      UI.btn(st.sort === 'default' ? 'Sort: default' : 'Sort: ' + CARS_SORTS.filter(function (s) { return s[0] === st.sort; })[0][1], { kind: 'o', size: 'sm', icon: 'arrows-sort', attrs: { 'data-cact': 'sort', 'aria-haspopup': 'menu' } }) +
      '<div class="ptabs cr-view" role="group" aria-label="View">' + [['cards', 'layout-grid', 'Cards'], ['table', 'list', 'Table']].map(function (v) { return '<button type="button" class="ptab" data-cview="' + v[0] + '" aria-selected="' + (st.view === v[0]) + '">' + i(v[1]) + v[2] + '</button>'; }).join('') + '</div>' +
      '<label class="row gap6 b2 cr-per">Show<span class="inp"><select data-key="cars-per" aria-label="Cars per page">' + UI.options([12, 24, 48], st.per) + '</select></span></label>' +
      '<div class="ui-fchips cr-chips" role="group" aria-label="Show">' + CARS_CHIPS.map(function (x) { var n = d.cars.filter(function (c) { return x[2](c); }).length; return x[0] !== 'all' && !n && st.chip !== x[0] ? '' : '<button type="button" class="ui-fchip' + (x[3] ? ' ' + x[3] : '') + '" data-cchip="' + x[0] + '" aria-pressed="' + (st.chip === x[0]) + '">' + esc(x[1]) + '<span class="n">' + n + '</span></button>'; }).join('') + '</div></div>' +
      (list.length ? (st.view === 'cards' ? '<div class="cr-grid">' + shown.map(card).join('') + '</div>' : '<div class="card"><div id="cr-t"></div></div>') : '<div class="card">' + UI.empty({ icon: 'car-off', title: 'No cars found', text: q ? 'Nothing matches "' + st.q + '". Clear the search.' : st.chip !== 'all' ? 'No car is in "' + chipDef[1] + '". Pick All.' : 'Add your first car.' }) + '</div>') + pager;
    if (st.view === 'table' && list.length) {
      UI.table(root.querySelector('#cr-t'), {
        columns: [
          { key: 'serial', label: 'Serial', width: 60, render: function (c) { return c.serial || '<span class="faint">-</span>'; } },
          { key: 'thumb', label: 'Thumbnail', render: function (c) { return carsThumb(c, 'cr-tsm'); } },
          { key: 'plate', label: 'Plate No', nowrap: true, render: function (c) { return '<b class="cr-pl">' + esc(c.plate) + '</b>'; } },
          { key: 'name', label: 'Make & Model', render: function (c) { return esc(c.make) + '<div class="b2">' + esc(c.model) + '</div>'; } },
          { key: 'year', label: 'Year' },
          { key: 'cc', label: 'Engine (cc)', align: 'right', render: function (c) { return c.cc ? UI.fmt.num(c.cc) + ' cc' : '-'; } },
          { key: 'type', label: 'Type' }, { key: 'color', label: 'Color' },
          { key: 'owner', label: 'Owner', hidden: !ctx.can('cars.see_owner_details'), render: function (c) { return c.owner && c.owner.name ? esc(c.owner.name) + '<div class="b2">' + UI.phone(c.owner.mobile) + '</div>' : '<span class="faint">-</span>'; } },
          { key: 'inst', label: 'Instalment', hidden: !ctx.can('cars.see_instalment'), render: function (c) { return c.instalment ? UI.money(c.instalment.amount) + ' · day ' + c.instalment.day : '<span class="faint">None</span>'; } },
          { key: 'status', label: 'Status', render: function (c) { return '<div class="row wrap gap4">' + carsChips(c) + '</div>'; } },
          { key: 'acts', label: 'Actions', render: function (c) { return '<span class="row gap4">' + UI.iconBtn('eye', 'View ' + c.plate, { size: 'sm', attrs: { 'data-cact': 'view', 'data-id': c.id } }) + (canE ? UI.iconBtn('edit', 'Edit ' + c.plate, { size: 'sm', attrs: { 'data-cact': 'edit', 'data-id': c.id } }) : '') + (canD ? UI.iconBtn('trash', 'Delete', { size: 'sm', attrs: { 'data-cact': 'del', 'data-id': c.id } }) : '') + '</span>'; } }
        ], rows: shown, rowKey: 'id', density: 'compact', pageSize: false, minWidth: 1100, sticky: false, onRowClick: function (c) { openCar(c.id); }
      });
    }
    var openCar = function (cid) { ctx.setParams({ car: cid }); b3Open(ctx, 'car', carsProfile); };
    var editCar = function (cid) { carsDrawer(cid); };
    var search = root.querySelector('[data-key="cars-q"]');
    search.addEventListener('input', UI.debounce(function () { st.q = search.value; st.page = 1; ctx.refresh(); }, 250));
    root.querySelector('[data-key="cars-per"]').addEventListener('change', function (ev) { st.per = +ev.target.value; st.page = 1; ctx.refresh(); });
    UI.on(root, 'click', '[data-cview]', function (ev, el) { st.view = el.getAttribute('data-cview'); try { localStorage.setItem('fms.carView', st.view); } catch (e) { /* private window */ } ctx.refresh(); });
    UI.on(root, 'click', '[data-cchip]', function (ev, el) { st.chip = el.getAttribute('data-cchip'); st.page = 1; ctx.refresh(); });
    UI.on(root, 'click', '[data-cpg]', function (ev, el) { st.page = +el.getAttribute('data-cpg'); ctx.refresh(); window.scrollTo(0, 0); });
    UI.on(root, 'click', '[data-cact]', function (ev, el) {
      ev.stopPropagation();
      var a = el.getAttribute('data-cact'), idv = el.getAttribute('data-id');
      if (a === 'new') carsDrawer(null);
      else if (a === 'edit') editCar(idv);
      else if (a === 'view') openCar(idv);
      else if (a === 'del') carsDelete(idv);
      else if (a === 'sort') UI.menu(el, CARS_SORTS.map(function (s) { return { label: s[1], checked: st.sort === s[0], onClick: function () { st.sort = s[0]; st.page = 1; ctx.refresh(); } }; }));
    });
    UI.on(root, 'click', '.cr-card', function (ev, el) { if (ev.target.closest('[data-cact]')) return; openCar(el.getAttribute('data-car')); });
    UI.on(root, 'keydown', '.cr-card', function (ev, el) { if (ev.key === 'Enter' && ev.target === el) openCar(el.getAttribute('data-car')); });
    var p = ctx.params;
    if (p.action === 'add') { ctx.setParams({ action: null }); setTimeout(function () { carsDrawer(null); }, 0); }
    b3Open(ctx, 'car', carsProfile);
  },
  search: [{ label: 'New Car', icon: 'car', run: function () { carsDrawer(null); } }]
};

/* ---------------- delete ---------------- */
function carsDelete(id) {
  var c = carById(id); if (!c) return;
  var bks = D().bookings.filter(function (x) { return x.car === c; }), n = bks.length;
  /* a car with bookings is never deleted (its history stays): say so first and offer the status change instead */
  if (n) {
    var ahead = bks.filter(function (x) { return x.end > NOW() && x.status !== 'Cancelled' && x.status !== 'Completed'; });
    var setTo = function (fleet) {
      if (!can('cars.edit')) { UI.toast('Changing a car needs the "Edit cars" access.', { tone: 'warn' }); return false; }
      DB.update('cars', c, { fleet: fleet }, { text: DB.actor() + ' set ' + c.plate + ' to ' + fleet + ' (instead of deleting it)', where: 'Car' });
      UI.toast(c.plate + ' is now ' + fleet + '. It cannot be booked, and its ' + plural(n, 'booking') + ' stay on record.');
    };
    UI.dialog({ title: 'This car cannot be deleted', text: c.plate + ' · ' + carName(c), width: 'sm', alert: true,
      body: '<p class="ui-ctext">' + c.plate + ' has ' + plural(n, 'booking') + ', so it stays on record. Mark it as Not in use (back later) or Sold (gone for good) instead: it then cannot be booked.</p>' +
        (ahead.length ? UI.alert(plural(ahead.length, 'booking') + ' still to come or out now (' + ahead.slice(0, 3).map(function (x) { return x.code; }).join(', ') + (ahead.length > 3 ? '...' : '') + '). Move ' + (ahead.length === 1 ? 'it' : 'them') + ' to another car first.', 'warn') : ''),
      buttons: [{ label: 'Cancel', kind: 'g' }].concat(c.fleet === 'Not in use' ? [] : [{ label: 'Mark as Not in use', kind: 'o', onClick: function () { return setTo('Not in use'); } }]).concat(c.fleet === 'Sold' ? [] : [{ label: 'Mark as Sold', kind: 'c', onClick: function () { return setTo('Sold'); } }]) });
    return;
  }
  UI.dialog({ title: 'Delete ' + c.plate + '?', text: c.plate + ' · ' + carName(c), width: 'sm', alert: true, body: '<p class="ui-ctext">It has no bookings. This cannot be undone.</p>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Delete', kind: 'err', onClick: function () {
      DB.remove('cars', c, { text: DB.actor() + ' deleted car ' + c.plate, where: 'Car' });
      D().trackers.forEach(function (t) { if (t.car === c.id) t.car = null; });
      UI.toast('Car deleted');
    } }] });
}

/* ---------------- "Read document": what the reader found on a paper ---------------- */
function carsReadValues(c, slot) {
  var T = mtToday(), f = (c.papers || {})[slot], fresh = !!(f && f.dataUrl);
  /* a paper uploaded just now is read as the renewed one; the sample papers read what is on the car, unless it runs out within 4 months */
  var plus = function (dd) { var x = dd ? new Date(dd) : T; return fresh || x < new Date(T.getTime() + 120 * DAY) ? new Date(Math.max(+x, +T) + 365 * DAY) : x; };
  var LOOK = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };
  var asDigits = function (s) { return String(s || '').toUpperCase().replace(/[OQDILZSBGTA]/g, function (m) { return LOOK[m]; }); };
  var misread = function (s) { s = String(s || ''); var k = s.search(/[OQDILZSBGTA]/); return k < 0 ? s : s.slice(0, k) + LOOK[s[k]] + s.slice(k + 1); };
  var idx = D().cars.indexOf(c), rows = [];
  var add = function (key, label, now, read, o) { rows.push(Object.assign({ key: key, label: label, now: now, read: read }, o || {})); };
  var fmtD = function (x) { return x ? mtIso(x) : ''; };
  var plateRead = slot === 'grant' && idx === 3 ? c.plate.replace(/\d$/, function (m) { return String((+m + 3) % 10); }) : c.plate;
  if (slot === 'roadtax') {
    add('tax', 'Road tax expiry', fmtD(c.tax), fmtD(plus(c.tax)), { date: true });
    add('cc', 'Engine capacity (cc)', c.cc || '', c.cc || '');
    add('model', 'Model', c.model, c.model.split(' ').slice(0, 2).join(' '));
  } else if (slot === 'insurance') {
    add('insExp', 'Insurance expiry', fmtD(c.insExp), fmtD(plus(c.insExp)), { date: true, must: true });
    add('chassis', 'Chassis number', c.chassis || '', c.chassis || '');
    add('engine', 'Engine number', c.engine || '', idx % 2 ? misread(c.engine) : c.engine || '');
    add('cc', 'Engine capacity (cc)', c.cc || '', c.cc ? c.cc + (idx % 3 === 0 ? 2 : 0) : '');
    add('year', 'Year made', c.year, c.year);
  } else {
    add('chassis', 'Chassis number', c.chassis || '', c.chassis || '');
    add('engine', 'Engine number', c.engine || '', idx % 2 ? '' : misread(c.engine));
    add('cc', 'Engine capacity (cc)', c.cc || '', c.cc || '');
    add('model', 'Model', c.model, c.make.toUpperCase() + ' ' + c.model.toUpperCase());
    add('year', 'Year made', c.year, c.year);
    add('spec', 'Spec (body / fuel)', c.spec || '', (c.type === 'Sedan' ? 'SALOON' : (c.type || '').toUpperCase()) + ' / ' + (c.fuel || '').toUpperCase());
    add('ownerIc', 'Owner IC', c.owner && c.owner.ic || '', c.owner && c.owner.ic ? c.owner.ic : '', { priv: true });
  }
  rows.forEach(function (r) {
    var a = String(r.now).trim().toUpperCase(), b = String(r.read).trim().toUpperCase(), same = a === b, digits = !same && !!b && asDigits(a) === asDigits(b);
    r.chip = !r.read ? ['Not read', 'grey'] : r.priv ? ['Private', 'info'] : digits ? ['Letters read as digits', 'warn'] : r.date && r.read && UI.fmt.daysFrom(mtDate(r.read)) < 0 ? ['Check this', 'warn'] : same ? ['Same as the car', 'ok'] : ['Differs from the car', 'pri'];
    r.tick = !!r.read && !same && !digits;
    r.same = same;
  });
  return { plate: plateRead, rows: rows };
}
/* the review screen: nothing changes on the car until Save is pressed */
function carsReview(c, slot, onSaved) {
  var label = CARS_SLOTS.filter(function (s) { return s[0] === slot; })[0][1], res = carsReadValues(c, slot), seeOwner = can('cars.see_owner_details');
  var mism = res.plate !== c.plate, okPlate = { v: false };
  var body = function () {
    return (mism ? UI.alert('The plate on this paper reads <b>' + esc(res.plate) + '</b>, but this car is <b>' + esc(c.plate) + '</b>. Check you uploaded the right paper.', 'warn', { html: true }) + UI.check({ key: 'okPlate', label: 'I checked: this paper belongs to this car', checked: okPlate.v }) : UI.alert('The plate on the paper matches this car: ' + esc(c.plate) + '.', 'ok')) +
      '<div class="cr-rv">' + '<div class="cr-rv-h"><span></span><span>Field</span><span>On the car now</span><span>Read from the paper</span></div>' + res.rows.map(function (r, k) {
        var hide = r.priv && !seeOwner;
        return '<div class="cr-rv-r' + (r.tick ? ' on' : '') + '"><label class="cb"><input type="checkbox" data-rv="' + k + '"' + (r.tick ? ' checked' : '') + (!r.read || hide ? ' disabled' : '') + ' aria-label="Save ' + esc(r.label) + '"><span class="box">' + i('check') + '</span></label>' +
          '<div><div class="t1c fw5">' + esc(r.label) + (r.must ? ' <span class="ui-req">*</span>' : '') + '</div>' + UI.chip(r.chip[0], r.chip[1], { sm: true }) + '</div>' +
          '<div class="cr-rv-now">' + (hide ? '<span class="faint">Private</span>' : r.date ? (r.now ? UI.fmt.date(mtDate(r.now)) : '<span class="faint">-</span>') : esc(r.now) || '<span class="faint">-</span>') + '</div>' +
          '<div>' + (hide ? '<span class="faint">Hidden: you cannot see owner details</span>' : r.read ? '<input class="cr-rv-in" type="' + (r.date ? 'date' : 'text') + '" data-rvv="' + k + '" value="' + esc(r.read) + '" aria-label="' + esc(r.label) + ' read from the paper">' : '<span class="faint">Not read</span>') + '</div></div>';
      }).join('') + '</div><p class="b2 cr-rv-n"></p>' + (slot === 'insurance' ? '<p class="b2">Tick the insurance expiry to record the new insurance in Maintenance.</p>' : '');
  };
  var count = function (dl) { var n = res.rows.filter(function (r) { return r.tick; }).length; dl.body.querySelector('.cr-rv-n').textContent = n ? plural(n, 'line') + ' will be saved.' : 'Nothing ticked: nothing will change.'; };
  var dl = UI.dialog({ title: 'Review: ' + label, text: c.plate + ' · ' + carName(c), width: 'lg', body: body(), buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Save', icon: 'check', onClick: function () {
    if (mism && !okPlate.v) { UI.toast('Tick that you checked this paper belongs to this car', { tone: 'warn' }); return false; }
    var on = res.rows.filter(function (r) { return r.tick; });
    if (!on.length) { UI.toast('Nothing ticked, nothing saved', { tone: 'info' }); return; }
    var patch = {}, papers = [];
    on.forEach(function (r) {
      var v = r.read;
      if (r.key === 'tax') { patch.tax = mtDate(v); papers.push(['Road tax', patch.tax]); }
      else if (r.key === 'insExp') { patch.insExp = mtDate(v); papers.push(['Insurance', patch.insExp]); }
      else if (r.key === 'cc' || r.key === 'year') patch[r.key] = Number(String(v).replace(/\D/g, '')) || c[r.key];
      else if (r.key === 'chassis') { patch.chassis = v; patch.vin = v; }
      else if (r.key === 'ownerIc') patch.owner = Object.assign({}, c.owner, { ic: String(v).replace(/\D/g, '') });
      else patch[r.key] = v;
    });
    DB.update('cars', c, patch, { text: DB.actor() + ' saved ' + plural(on.length, 'value') + ' read from the ' + label.toLowerCase() + ' of ' + c.plate, where: 'Car' });
    papers.forEach(function (p) {
      var old = mtLatestPaper(c.id, p[0]);
      DB.add('papers', { car: c.id, kind: p[0], name: p[0], until: p[1], issued: mtToday(), provider: old ? old.provider : p[0] === 'Road tax' ? 'JPJ' : c.insurer || '', cost: 0, ref: old ? old.ref : '', warnDays: 30, note: 'Read from the uploaded paper', file: (c.papers || {})[slot] || null }, { text: DB.actor() + ' recorded a new ' + p[0].toLowerCase() + ' for ' + c.plate + ' until ' + UI.fmt.date(p[1]), where: 'Maintenance record' });
    });
    UI.toast(plural(on.length, 'value') + ' saved on ' + c.plate);
    if (onSaved) onSaved(patch);
  } }] });
  count(dl);
  dl.body.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.getAttribute('data-key') === 'okPlate') okPlate.v = t.checked;
    if (t.getAttribute('data-rv') != null) { var r = res.rows[+t.getAttribute('data-rv')]; r.tick = t.checked; t.closest('.cr-rv-r').classList.toggle('on', t.checked); count(dl); }
  });
  dl.body.addEventListener('input', function (ev) { var t = ev.target; if (t.getAttribute('data-rvv') != null) res.rows[+t.getAttribute('data-rvv')].read = t.value; });
}

/* ---------------- the car drawer ---------------- */
function carsDrawer(id, onClose) {
  var d = D(), c = id ? carById(id) : null;
  if (id && !c) { UI.toast('That car is no longer in the fleet', { tone: 'warn' }); return; }
  var isNew = !c, canE = isNew ? can('cars.create') : can('cars.edit'), ro = !canE;
  var seeOwn = can('cars.see_owner_details'), seeInst = can('cars.see_instalment'), gal = can('cars.manage_gallery'), seeDocs = can('cars.view_owner_docs'), mngDocs = can('cars.manage_owner_docs'), seeMnt = can('maintenance.view');
  var src = c || { make: '', model: '', plate: '', serial: d.cars.length + 1, color: '', year: NOW().getFullYear(), seats: 5, cc: null, type: '', fuel: 'Petrol', trans: 'Auto', tax: null, fleet: 'Active', web: true, vin: '', engine: '', spec: '', boughtOn: null, boughtFor: null, rate: null, hourly: null, deposit: B().deposit, owner: {}, instalment: null, tracker: null, dashcam: null, papers: {}, ownerDocs: {}, gallery: [] };
  var w = { make: src.make, model: src.model, plate: src.plate, serial: src.serial || null, color: src.color, year: src.year, seats: src.seats, cc: src.cc, type: src.type, fuel: src.fuel || 'Petrol', trans: src.trans || 'Auto', tax: mtIso(src.tax), fleet: src.fleet || 'Active', web: src.web !== false,
    vin: src.vin || src.chassis || '', engine: src.engine || '', spec: src.spec || '', boughtOn: mtIso(src.boughtOn), boughtFor: src.boughtFor, rate: src.rate, hourly: src.hourly, deposit: src.deposit,
    ownerName: (src.owner || {}).name || '', ownerMobile: (src.owner || {}).mobile || '', ownerIc: (src.owner || {}).ic || '', instDay: src.instalment ? src.instalment.day : null, instAmt: src.instalment ? src.instalment.amount : null,
    trkPlatform: (src.tracker || {}).platform || '', trkImei: (src.tracker || {}).imei || '', trkSim: (src.tracker || {}).sim || '', camPlatform: (src.dashcam || {}).platform || '', camImei: (src.dashcam || {}).imei || '', camSim: (src.dashcam || {}).sim || '' };
  var x = { thumb: src.thumb || null, thumbDel: false, gallery: (src.gallery || []).map(function (g) { return Object.assign({}, g); }), papers: Object.assign({}, src.papers || {}), ownerDocs: Object.assign({}, src.ownerDocs || {}) };
  var start = JSON.stringify(w) + JSON.stringify(x);
  var dis = ro ? { disabled: true } : {};
  var I = function (o) { return UI.input(Object.assign(o, ro ? { readonly: true } : {})); };
  /* dates always read "19 Oct 2026", whatever the browser's language */
  var Dt = function (o) { return ro ? I(Object.assign({}, o, { value: o.value ? UI.fmt.date(UI.parseDate(o.value)) : '' })) : UI.dateField(Object.assign({ chips: false, placeholder: 'Not set' }, o)); };
  var Sel = function (o) { return UI.select(Object.assign(o, dis)); };
  var sec = function (title, body, o) { return '<section class="cr-sec' + (o && o.lock ? ' lock' : '') + '"><h3 class="cr-cap">' + (o && o.icon ? i(o.icon) : '') + esc(title) + '</h3>' + body + '</section>'; };
  var facts = function () {
    if (isNew || !seeMnt) return '';
    var lastJ = d.jobs.filter(function (j) { return j.car === c.id && j.status === 'Done'; })[0];
    var next = d.reminders.filter(function (r) { return r.car === c.id && r.on; }).map(function (r) { return { r: r, x: mtRemInfo(r, c) }; }).filter(function (z) { return z.x.state !== 'none'; }).sort(function (a, b) { return a.x.sort - b.x.sort; })[0];
    var rt = mtLatestPaper(c.id, 'Road tax'), ins = mtLatestPaper(c.id, 'Insurance'), gr = mtLatestPaper(c.id, 'Car grant');
    var box = function (l, v, s, chip) { return '<div class="cr-fact"><span>' + l + '</span><b>' + v + '</b>' + (s ? '<small>' + s + '</small>' : '') + (chip || '') + '</div>'; };
    return sec('Service and papers', '<p class="b2">These come from Maintenance. Change them there, they are not typed twice.</p><div class="cr-facts">' +
      box('Last service', lastJ ? UI.fmt.date(lastJ.date) : 'None yet', lastJ && lastJ.odo ? 'at ' + mtKm(lastJ.odo) : '') +
      box('Next service at', next ? (next.x.dueKm != null ? mtKm(next.x.dueKm) : UI.fmt.date(next.x.dueAt)) : d.reminders.some(function (r) { return r.car === c.id && r.on; }) ? 'Not counting yet' : 'Not set', next ? (next.x.dueKm != null && next.x.dueAt ? 'or by ' + UI.fmt.date(next.x.dueAt) : esc(next.r.service)) : '') +
      box('Odometer', mtKm(c.odo), 'As of ' + UI.fmt.date(c.odoAt)) +
      box('Road tax', rt && rt.until ? UI.fmt.date(rt.until) : '-', '', mtPaperChip(rt)) + box('Insurance', ins && ins.until ? UI.fmt.date(ins.until) : '-', '', mtPaperChip(ins)) + box('Car grant', gr ? 'Recorded' : '-', '', gr ? UI.chip('Recorded', 'ok') : UI.chip('Not recorded', 'grey')) +
      '</div>' + UI.btn('Maintenance', { kind: 'tonal', size: 'sm', icon: 'tool', attrs: { 'data-cd': 'health' } }), { icon: 'tool' });
  };
  var slot = function (key, label, icon, f, o) {
    o = o || {};
    var acts = (f ? UI.btn('View', { kind: 'g', size: 'sm', attrs: { 'data-cd': 'view', 'data-k': key, 'data-g': o.group } }) + UI.btn('Save', { kind: 't', size: 'sm', icon: 'download', attrs: { 'data-cd': 'save', 'data-k': key, 'data-g': o.group } }) : '') +
      (f && o.read && !isNew && canE ? UI.btn('Read document', { kind: 'tonal', size: 'sm', icon: 'scan', cls: 'cr-read', attrs: { 'data-cd': 'read', 'data-k': key } }) : '') +
      (o.manage ? '<label class="btn ' + (f ? 'o' : 'c') + ' sm">' + i('upload') + '<span>' + (f ? 'Replace' : 'Upload') + '</span><input type="file" accept="image/*,.pdf" hidden data-cfile="' + o.group + '" data-k="' + key + '"></label>' + (f ? UI.btn('Remove', { kind: 't', size: 'sm', cls: 'cr-rm', attrs: { 'data-cd': 'rm', 'data-k': key, 'data-g': o.group } }) : '') : '');
    return '<div class="cr-slot">' + i(icon, 'cr-slot-ic') + '<div class="grow"><div class="t1c fw5">' + esc(label) + '</div><div class="b2">' + mtFileLine(f) + '</div></div><div class="cr-slot-a">' + acts + '</div></div>';
  };
  function html() {
    var thumbSrc = x.thumbDel ? null : x.thumb;
    var h = sec('Thumbnail', '<div class="cr-tb"><span class="cr-tb-img">' + (thumbSrc ? '<img src="' + thumbSrc + '" alt="Thumbnail">' : carSVG(w.color || 'Silver', CARS_SHAPE[w.type] || (c && c.shape) || 'sedan', { label: 'Car' })) + '</span><div class="col gap8">' +
      (x.thumbDel ? '<div class="row gap8">' + UI.chip('Will be removed on save', 'warn') + UI.btn('Undo', { kind: 't', size: 'sm', attrs: { 'data-cd': 'thumbundo' } }) + '</div>' : '') +
      (!ro ? '<div class="row wrap gap8"><label class="btn o sm">' + i('upload') + '<span>' + (x.thumb ? 'Replace' : 'Upload') + '</span><input type="file" accept="image/*" hidden data-cfile="thumb"></label>' + (x.thumb && !x.thumbDel ? UI.btn('Remove', { kind: 't', size: 'sm', attrs: { 'data-cd': 'thumbrm' } }) : '') + '</div>' : '') +
      '<span class="b2">' + (x.thumb ? 'Shown on the cards and the website.' : 'No picture yet: the cards show a drawing in the car\'s colour.') + '</span></div></div>', { icon: 'photo' });
    h += sec('Car info', '<div class="cr-form">' + Sel({ key: 'make', label: 'Manufacturer', required: true, options: LISTS.manufacturers.concat(w.make && LISTS.manufacturers.indexOf(w.make) < 0 ? [w.make] : []), value: w.make, placeholder: 'Choose' }) + I({ key: 'model', label: 'Model', required: true, value: w.model }) +
      I({ key: 'plate', label: 'Plate Number', required: true, value: w.plate, attrs: { style: 'text-transform:uppercase' } }) + I({ key: 'serial', label: 'Serial No', type: 'number', min: 1, value: w.serial }) + I({ key: 'color', label: 'Color', required: true, value: w.color, attrs: { list: 'cr-colors' } }) +
      '<datalist id="cr-colors">' + Object.keys(CAR_COLORS).map(function (k) { return '<option value="' + k + '">'; }).join('') + '</datalist>' +
      I({ key: 'year', label: 'Year', type: 'number', required: true, min: 1980, max: 2030, value: w.year }) + I({ key: 'seats', label: 'Seats', type: 'number', required: true, min: 1, max: 60, value: w.seats }) + I({ key: 'cc', label: 'Engine capacity (cc)', type: 'number', min: 0, value: w.cc }) +
      Sel({ key: 'type', label: 'Type', required: true, options: LISTS.carTypes, value: w.type, placeholder: 'Choose' }) + Sel({ key: 'fuel', label: 'Fuel Type', options: LISTS.fuels, value: w.fuel }) + Sel({ key: 'trans', label: 'Transmission', options: LISTS.transmissions, value: w.trans }) +
      Dt({ key: 'tax', label: 'Road Tax Valid Until', value: w.tax }) + '</div>', { icon: 'car' });
    h += sec('Fleet status', '<div class="cr-form">' + Sel({ key: 'fleet', label: 'Status', options: LISTS.fleetStatus, value: w.fleet, help: 'Cars that are not active are left out of reminders and the idle list' }) +
      UI.switch({ key: 'web', label: 'Show on the website', checked: w.web, disabled: ro }) + I({ key: 'vin', label: 'VIN / chassis number', value: w.vin }) + I({ key: 'engine', label: 'Engine number', value: w.engine }) +
      I({ key: 'spec', label: 'Spec', value: w.spec, help: 'Body / fuel as on the grant, for example SALOON / PETROL' }) + Dt({ key: 'boughtOn', label: 'Bought on', value: w.boughtOn, max: NOW() }) +
      (mtCostsOk() ? I({ key: 'boughtFor', label: 'Bought for (RM)', type: 'number', prefix: 'RM', min: 0, value: w.boughtFor }) : '') + I({ key: 'rate', label: 'Daily rate (RM)', type: 'number', prefix: 'RM', min: 0, value: w.rate }) +
      I({ key: 'hourly', label: 'Hourly rate (RM)', type: 'number', prefix: 'RM', min: 0, value: w.hourly }) + I({ key: 'deposit', label: 'Deposit (RM)', type: 'number', prefix: 'RM', min: 0, value: w.deposit }) + '</div>' +
      (isNew ? '' : '<p class="b2 cr-note">' + i('gauge') + 'Odometer: ' + mtKm(c.odo) + '. Update it from the Maintenance button, it follows every service and hand-over.</p>'), { icon: 'flag' });
    if (seeOwn || seeInst) h += sec('Owner and instalment', '<div class="cr-form">' + (seeOwn ? I({ key: 'ownerName', label: 'Owner name', value: w.ownerName }) + I({ key: 'ownerMobile', label: 'Owner mobile', type: 'tel', value: w.ownerMobile, placeholder: '+60 00-000 0000' }) + I({ key: 'ownerIc', label: 'Owner IC number (12 digits)', value: w.ownerIc, maxlength: 14, placeholder: '900101145678' }) : '') +
      (seeInst ? I({ key: 'instDay', label: 'Instalment day', type: 'number', min: 1, max: 31, value: w.instDay, help: 'The same date every month. Leave empty for none.' }) + I({ key: 'instAmt', label: 'Monthly instalment (RM)', type: 'number', prefix: 'RM', min: 0, value: w.instAmt, help: 'Shows on the Instalments page when it is due' }) : '') + '</div>', { icon: 'user-dollar' });
    var plats = carsPlatforms();
    var cams = carsCamPlatforms();
    h += '<datalist id="cr-plats">' + plats.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist><datalist id="cr-cams">' + cams.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>';
    h += sec('Tracker', '<div class="cr-form">' + I({ key: 'trkPlatform', label: 'Platform / app', value: w.trkPlatform, placeholder: plats[0], attrs: { list: 'cr-plats' }, help: 'Pick one from your list in Settings, or type it' }) + I({ key: 'trkImei', label: 'IMEI', value: w.trkImei, maxlength: 15, attrs: { inputmode: 'numeric' }, help: 'The IMEI is how the Tracking page recognises this car, so each IMEI can be on one car only.' }) + I({ key: 'trkSim', label: 'SIM number', value: w.trkSim, type: 'tel' }) + '</div>', { icon: 'radar-2' });
    h += sec('Dashcam', '<div class="cr-form">' + I({ key: 'camPlatform', label: 'Platform / app', value: w.camPlatform, placeholder: cams[0], attrs: { list: 'cr-cams' }, help: 'Pick one from your list in Settings, or type it' }) + I({ key: 'camImei', label: 'IMEI', value: w.camImei, maxlength: 16, attrs: { inputmode: 'numeric' }, help: '14 to 16 digits, on a sticker on the dashcam' }) + I({ key: 'camSim', label: 'SIM number', value: w.camSim, type: 'tel' }) + '</div>', { icon: 'video' });
    h += facts();
    h += sec('Road tax, insurance and car grant', '<p class="b2">Upload each paper as a picture or PDF. "Read document" reads the expiry date, engine and chassis numbers, capacity, model, year, spec and owner IC from it and shows them to you to check. Nothing changes on the car until you press Save on that screen.</p>' +
      CARS_SLOTS.map(function (s) { return slot(s[0], s[1], s[2], x.papers[s[0]], { read: true, manage: canE, group: 'papers' }); }).join(''), { icon: 'files' });
    h += sec('Owner documents', '<p class="b2">' + i('lock') + ' Private. Only people allowed to see them can open these files, and every time one is opened it is written to the activity log.</p>' +
      (seeDocs ? CARS_OWNER.map(function (s) { return slot(s[0], s[1], s[2], x.ownerDocs[s[0]], { manage: mngDocs, group: 'owner' }); }).join('') : UI.alert('You cannot open the owner documents. Ask the owner for access.', 'info')), { icon: 'lock' });
    if (gal) h += sec('Gallery', '<p class="b2">Shown on the booking website, in the Serial No order.</p><div class="cr-gal">' + x.gallery.map(function (g, k) {
      return '<div class="cr-gi' + (g.del ? ' del' : '') + '"><span class="cr-gi-img">' + (g.dataUrl ? '<img src="' + g.dataUrl + '" alt="' + esc(g.name) + '">' : carSVG(w.color || 'Silver', CARS_SHAPE[w.type] || (c && c.shape) || 'sedan', { label: g.angle || 'Picture' })) + '</span>' +
        (g.del ? '<div class="cr-gi-del">' + UI.chip('Will be deleted', 'bad') + UI.btn('Undo', { kind: 't', size: 'sm', attrs: { 'data-cd': 'gundo', 'data-k': k } }) + '</div>' :
          '<div class="cr-gi-b"><label class="cr-gi-o">Serial No<input type="number" min="1" data-gorder="' + k + '" value="' + esc(g.order) + '" aria-label="Serial No"></label><label class="ib sm" title="Replace">' + i('replace') + '<input type="file" accept="image/*" hidden data-cfile="greplace" data-k="' + k + '"></label>' + UI.iconBtn('trash', 'Delete picture', { size: 'sm', attrs: { 'data-cd': 'gdel', 'data-k': k } }) + '</div>') + '<small class="ellip">' + esc(g.name) + '</small></div>';
    }).join('') + '<label class="cr-gi cr-gadd">' + i('photo-plus') + '<span>Add Images</span><input type="file" accept="image/*" multiple hidden data-cfile="gadd"></label></div>', { icon: 'photo' });
    return h;
  }
  var dr = UI.drawer({ title: isNew ? 'New Car' : canE ? 'Edit Car' : 'Car', subtitle: isNew ? 'Add a car to the fleet' : c.plate + ' · ' + carName(c), width: 760, body: '<div class="cr-dr"></div>',
    actions: !isNew && seeMnt ? UI.btn('Maintenance', { kind: 'tonal', size: 'sm', icon: 'tool', attrs: { 'data-cd': 'health' } }) : '',
    dirty: function () { return !ro && JSON.stringify(w) + JSON.stringify(x) !== start; }, onClose: onClose,
    foot: ro ? [{ label: 'Close' }] : [{ label: 'Cancel', kind: 'g' }, { label: isNew ? 'Create' : 'Update', icon: 'check', onClick: save }] });
  var box = dr.body.querySelector('.cr-dr');
  function paint() { var sc = dr.body.scrollTop; box.innerHTML = html(); dr.body.scrollTop = sc; }
  mtBind(box, w, function (k, ev) { if (ev.type === 'change' && (k === 'color' || k === 'type')) paint(); });
  var fileOf = function (g, k) { return g === 'owner' ? x.ownerDocs[k] : x.papers[k]; };
  var labelOf = function (g, k) { return (g === 'owner' ? CARS_OWNER : CARS_SLOTS).filter(function (s) { return s[0] === k; })[0][1]; };
  /* paper and owner files save straight away on an existing car (like an upload); on a new car they wait for Create */
  var commitFiles = function (g, text) { if (isNew) return; var patch = g === 'owner' ? { ownerDocs: Object.assign({}, x.ownerDocs) } : { papers: Object.assign({}, x.papers) }; DB.update('cars', c, patch, { text: text, where: g === 'owner' ? 'Car owner document' : 'Car' }); start = JSON.stringify(w) + JSON.stringify(x); };
  dr.el.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-cd]'); if (!b) return;
    var a = b.getAttribute('data-cd'), k = b.getAttribute('data-k'), g = b.getAttribute('data-g');
    if (a === 'health') mtCarHealth(c.id);
    else if (a === 'thumbrm') { x.thumbDel = true; paint(); }
    else if (a === 'thumbundo') { x.thumbDel = false; paint(); }
    else if (a === 'gdel') { x.gallery[+k].del = true; paint(); }
    else if (a === 'gundo') { x.gallery[+k].del = false; paint(); }
    else if (a === 'view' || a === 'save') {
      var f = fileOf(g, k), lbl = labelOf(g, k), cc = c || { plate: w.plate, make: w.make, model: w.model };
      var lines = [['Plate', cc.plate || '-'], ['Car', (cc.make || '') + ' ' + (cc.model || '')], ['Paper', lbl], ['File', f.name], ['Added', f.added ? UI.fmt.date(f.added) : '-']];
      if (a === 'view') mtViewFile(lbl + ' · ' + (cc.plate || 'new car'), f, lines, g === 'owner' ? { log: true, ref: c && c.id, of: cc.plate } : null);
      else { if (g === 'owner') DB.log('Viewed a document', 'Car owner document', c ? c.id : '', DB.actor() + ' saved ' + lbl + ' of ' + (cc.plate || 'a new car')); mtSaveFile(lbl, f, lines); }
    }
    else if (a === 'rm') {
      var lb = labelOf(g, k);
      UI.confirm({ title: 'Remove the ' + lb.toLowerCase() + '?', text: 'The file is deleted from the server. What was read from it and saved on the car stays.', ok: 'Remove', cancel: 'Keep it', danger: true }).then(function (y) {
        if (!y) return; if (g === 'owner') x.ownerDocs[k] = null; else x.papers[k] = null;
        commitFiles(g, DB.actor() + ' removed the ' + lb.toLowerCase() + ' of ' + (c ? c.plate : 'a new car')); paint(); UI.toast(lb + ' removed');
      });
    }
    else if (a === 'read') {
      var bt = b; bt.disabled = true; bt.innerHTML = i('loader-2', 'cr-spin') + '<span>Reading...</span>';
      setTimeout(function () { if (!document.contains(bt)) return; paint(); carsReview(c, k, function (patch) { ['cc', 'year', 'model', 'engine', 'spec'].forEach(function (f2) { if (patch[f2] != null) w[f2] = patch[f2]; }); if (patch.chassis) w.vin = patch.chassis; if (patch.tax) w.tax = mtIso(patch.tax); if (patch.owner) w.ownerIc = patch.owner.ic; start = JSON.stringify(w) + JSON.stringify(x); paint(); }); }, 900);
    }
  });
  dr.el.addEventListener('change', function (ev) {
    var t = ev.target, kind = t.getAttribute('data-cfile');
    if (t.getAttribute('data-gorder') != null) { x.gallery[+t.getAttribute('data-gorder')].order = Number(t.value) || 1; return; }
    if (!kind || !t.files || !t.files.length) return;
    var fs = [].slice.call(t.files), k = t.getAttribute('data-k'); t.value = '';
    Promise.all(fs.map(function (f) { return mtReadFile(f, kind === 'papers' || kind === 'owner' ? 1800 : 1400).catch(function (e) { UI.toast(e.message, { tone: 'warn' }); return null; }); })).then(function (rs) {
      rs = rs.filter(Boolean); if (!rs.length) return;
      if (kind === 'thumb') { x.thumb = rs[0].dataUrl; x.thumbDel = false; }
      else if (kind === 'gadd') rs.forEach(function (r) { x.gallery.push({ id: 'img-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), order: x.gallery.length + 1, name: r.name, dataUrl: r.dataUrl }); });
      else if (kind === 'greplace') Object.assign(x.gallery[+k], { name: rs[0].name, dataUrl: rs[0].dataUrl });
      else { if (kind === 'owner') x.ownerDocs[k] = rs[0]; else x.papers[k] = rs[0]; commitFiles(kind, DB.actor() + ' uploaded the ' + labelOf(kind, k).toLowerCase() + ' of ' + (c ? c.plate : 'a new car')); UI.toast(labelOf(kind, k) + ' uploaded' + (kind === 'papers' && !isNew ? '. Press Read document to check what it says.' : '')); }
      paint();
    });
  });
  function save() {
    var miss = [['make', 'Manufacturer'], ['model', 'Model'], ['plate', 'Plate Number'], ['color', 'Color'], ['year', 'Year'], ['seats', 'Seats'], ['type', 'Type']].filter(function (r) { return !w[r[0]] && w[r[0]] !== 0; });
    if (miss.length) { UI.toast('Fill in: ' + miss.map(function (r) { return r[1]; }).join(', '), { tone: 'warn' }); return false; }
    var plate = String(w.plate).toUpperCase().replace(/\s+/g, ' ').trim();
    if (d.cars.some(function (o) { return o !== c && o.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''); })) { UI.toast('Another car already has the plate ' + plate, { tone: 'warn' }); return false; }
    var imei = String(w.trkImei || '').replace(/\D/g, '');
    if (imei && imei.length !== 15) { UI.toast('The tracker IMEI has 15 digits', { tone: 'warn' }); return false; }
    if (imei && d.cars.some(function (o) { return o !== c && o.tracker && o.tracker.imei === imei; })) { UI.toast('That IMEI is on another car. Each IMEI can be on one car only.', { tone: 'warn' }); return false; }
    var camImei = String(w.camImei || '').replace(/\D/g, '');
    if (camImei && (camImei.length < 14 || camImei.length > 16)) { UI.toast('The dashcam IMEI has 14 to 16 digits', { tone: 'warn' }); return false; }
    var ic = String(w.ownerIc || '').replace(/\D/g, '');
    if (seeOwn && ic && ic.length !== 12) { UI.toast('The owner IC number has 12 digits', { tone: 'warn' }); return false; }
    if (seeInst && w.instDay && (w.instDay < 1 || w.instDay > 31)) { UI.toast('The instalment day is between 1 and 31', { tone: 'warn' }); return false; }
    var rec = { make: w.make, model: w.model, plate: plate, serial: w.serial || null, color: w.color, year: Number(w.year), seats: Number(w.seats), cc: w.cc || null, type: w.type, fuel: w.fuel, trans: w.trans, tax: mtDate(w.tax), fleet: w.fleet, web: !!w.web,
      vin: w.vin, chassis: w.vin, engine: w.engine, spec: w.spec, boughtOn: mtDate(w.boughtOn), rate: Number(w.rate) || 0, hourly: Number(w.hourly) || 0, deposit: Number(w.deposit) || 0, shape: CARS_SHAPE[w.type] || 'sedan',
      tracker: imei || w.trkPlatform ? { platform: w.trkPlatform, imei: imei, sim: w.trkSim } : null, dashcam: camImei || w.camPlatform ? { platform: w.camPlatform, imei: camImei, sim: w.camSim } : null,
      thumb: x.thumbDel ? null : x.thumb, gallery: x.gallery.filter(function (g) { return !g.del; }).sort(function (a, b) { return a.order - b.order; }), papers: x.papers, ownerDocs: x.ownerDocs };
    if (mtCostsOk()) rec.boughtFor = Number(w.boughtFor) || null;
    if (seeOwn) rec.owner = { name: w.ownerName, mobile: w.ownerMobile, ic: ic };
    if (seeInst) rec.instalment = w.instDay && w.instAmt ? { day: Number(w.instDay), amount: Number(w.instAmt) } : null;
    var car;
    if (isNew) {
      car = DB.add('cars', Object.assign({ id: 'car-' + Date.now().toString(36), i: d.cars.length, key: null, odo: 0, odoAt: NOW(), status: 'active', inWorkshop: false, insurer: '', insExp: null, created: NOW(), owner: {}, instalment: null }, rec), { text: DB.actor() + ' added car ' + plate, where: 'Car' });
    } else {
      var oldTax = c.tax ? +c.tax : null;
      car = DB.update('cars', c, rec, { text: DB.actor() + ' changed car ' + plate, where: 'Car' });
      if (rec.tax && +rec.tax !== oldTax) { var rt = mtLatestPaper(c.id, 'Road tax'); if (rt) DB.update('papers', rt, { until: rec.tax }, { silent: true }); }
    }
    if (isNew && rec.tax) D().papers.push({ id: 'pap-' + Date.now().toString(36), car: car.id, kind: 'Road tax', name: 'Road tax', until: rec.tax, issued: null, provider: 'JPJ', cost: 0, ref: '', warnDays: 30, note: '', file: rec.papers.roadtax || null });
    D().trackers.forEach(function (t) { if (t.car === car.id && t.imei !== imei) t.car = null; if (imei && t.imei === imei) t.car = car.id; });
    D().cars.forEach(function (o, k) { o.i = k; });
    UI.toast(isNew ? plate + ' added to the fleet' : plate + ' saved');
  }
  paint();
  return dr;
}


/* ---------------- the car profile: what staff need at a glance, read only, with Edit ---------------- */
var CARS_PROF = null;
function carsProfile(id, onClose) {
  var c0 = carById(id); if (!c0) { UI.toast('That car is no longer in the fleet', { tone: 'warn' }); return; }
  if (CARS_PROF && !CARS_PROF.closed && CARS_PROF.carId === id) return CARS_PROF;
  var tile = function (icon, label, value, sub, extra) { return '<div class="cr-pt">' + i(icon, 'cr-pt-ic') + '<div class="cr-pt-b"><span class="cr-pt-l">' + esc(label) + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + (extra || '') + '</div></div>'; };
  var dateChip = function (dt, warn) { if (!dt) return UI.chip('Not recorded', 'grey', { sm: true }); var k = UI.fmt.daysFrom(dt); return k < 0 ? UI.chip('Expired ' + plural(-k, 'day') + ' ago', 'bad', { sm: true }) : k === 0 ? UI.chip('Expires today', 'bad', { sm: true }) : k <= (warn || 30) ? UI.chip('In ' + plural(k, 'day'), 'warn', { sm: true }) : UI.chip('Valid', 'ok', { sm: true }); };
  var dr = UI.drawer({ title: c0.plate, subtitle: carName(c0), width: 600, live: true, onClose: onClose, body: function (el, dw) {
    var d = D(), c = carById(id); if (!c) { setTimeout(function () { dw.close(true); }, 0); return ''; }
    dw.setTitle(c.plate, carName(c) + (c.year ? ' · ' + c.year : ''));
    var now = NOW(), mine = d.bookings.filter(function (x) { return x.car === c && x.status !== 'Cancelled'; });
    var out = mine.filter(function (x) { return x.status === 'Car Delivered'; })[0];
    var next = mine.filter(function (x) { return x.start > now && ['Completed', 'Car Returned', 'Car Delivered'].indexOf(x.status) < 0; }).sort(function (a, b) { return a.start - b.start; })[0];
    var ins = typeof mtLatestPaper === 'function' ? mtLatestPaper(c.id, 'Insurance', d) : null, insAt = ins && ins.until ? ins.until : c.insExp;
    var lastJ = (d.jobs || []).filter(function (j) { return j.car === c.id && j.status === 'Done'; }).sort(function (a, b) { return (b.doneAt || b.date) - (a.doneAt || a.date); })[0];
    var nextS = typeof mtRemInfo === 'function' ? (d.reminders || []).filter(function (r) { return r.car === c.id && r.on; }).map(function (r) { return { r: r, x: mtRemInfo(r, c) }; }).filter(function (z) { return z.x.state !== 'none'; }).sort(function (a, b) { return a.x.sort - b.x.sort; })[0] : null;
    var trk = (d.trackers || []).filter(function (t) { return t.car === c.id; })[0], seeInst = can('cars.see_instalment');
    var inst = seeInst ? (d.instalments || []).filter(function (it) { return it.car === c.id && !it.paid; }).sort(function (a, b) { return a.due - b.due; })[0] : null;
    var w = typeof mtDowntimeOn === 'function' ? mtDowntimeOn(c.id, now, now, d) : null;
    var acts = [];
    if (!can('cars.edit')) acts.push(UI.btn('All details', { kind: 'o', icon: 'list-details', size: 'sm', attrs: { 'data-cp': 'edit' } }));
    if (can('bookings.create') && (c.fleet || 'Active') === 'Active') acts.push(UI.btn('New booking', { kind: 'tonal', icon: 'calendar-plus', size: 'sm', attrs: { 'data-cp': 'book' } }));
    if (can('maintenance.view')) acts.push(UI.btn('Maintenance', { kind: 'tonal', icon: 'tool', size: 'sm', attrs: { 'data-cp': 'health' } }));
    if (trk && can('tracking.history')) acts.push(UI.btn('Trip history', { kind: 'g', icon: 'route', size: 'sm', attrs: { 'data-cp': 'trip' } }));
    var nowLine = out ? UI.chip('Out with ' + out.cust.name.split(' ')[0] + ' until ' + UI.fmt.date(out.end), out.end < now ? 'bad' : 'info', { icon: 'road' }) : w ? UI.chip('In the workshop' + (w.to ? ' until ' + UI.fmt.date(w.to) : ''), 'warn', { icon: 'tool' }) : (c.fleet || 'Active') === 'Active' ? UI.chip('At the office, free now', 'ok', { icon: 'circle-check' }) : '';
    return '<div class="cr-prof">' +
      '<div class="cr-ph">' + carsThumb(c, 'cr-ph-img') + '<div class="cr-ph-t"><span class="plate cr-ph-plate">' + esc(c.plate) + '</span><div class="b2">' + esc(carsSpec(c)) + (c.color ? ' · ' + esc(c.color) : '') + '</div><div class="row wrap gap6">' + carsChips(c) + '</div>' + (nowLine ? '<div>' + nowLine + '</div>' : '') + '</div></div>' +
      '<div class="row wrap gap8 cr-pacts">' + acts.join('') + '</div>' +
      '<div class="cr-pgrid">' +
      tile('receipt-tax', 'Road tax', c.tax ? UI.fmt.date(c.tax) : 'Not recorded', '', dateChip(c.tax)) +
      tile('shield-check', 'Insurance', insAt ? UI.fmt.date(insAt) : 'Not recorded', ins && ins.provider ? esc(ins.provider) : c.insurer ? esc(c.insurer) : '', dateChip(insAt)) +
      tile('calendar-event', 'Next booking', next ? '<button type="button" class="cr-plink" data-cp="bk" data-v="' + next.code + '">' + esc(next.code) + '</button>' : 'None booked', next ? esc(next.cust.name) + '<br>' + UI.fmt.dateTime(next.start) + ' to ' + UI.fmt.date(next.end) : 'Free from now on') +
      tile('tool', 'Last service', lastJ ? UI.fmt.date(lastJ.doneAt || lastJ.date) : 'None yet', lastJ ? esc(lastJ.title) + (lastJ.odo ? ' · ' + UI.fmt.num(lastJ.odo) + ' km' : '') : '', nextS ? '<small class="' + (nextS.x.state === 'over' ? 'cr-bad' : nextS.x.state === 'soon' ? 'cr-warn' : '') + '">Next: ' + esc(nextS.r.service) + ', ' + esc(nextS.x.text.toLowerCase()) + '</small>' : '') +
      tile('gauge', 'Odometer', UI.fmt.num(c.odo || 0) + ' km', c.odoAt ? 'As of ' + UI.fmt.date(c.odoAt) : '') +
      (seeInst ? tile('calendar-dollar', 'Instalment', c.instalment ? UI.money(c.instalment.amount) + ' a month' : 'None', c.instalment ? 'Due on day ' + c.instalment.day + (inst ? ' · next ' + UI.fmt.date(inst.due) + (inst.due < now ? ' (overdue)' : '') : '') : '') : '') +
      tile('radar-2', 'Tracker', c.tracker && (c.tracker.imei || c.tracker.platform) ? esc(c.tracker.platform || 'Tracker') : 'No tracker', c.tracker && c.tracker.imei ? 'IMEI ' + esc(c.tracker.imei) : '', trk ? '<span class="row gap4 wrap">' + UI.status('tracker', trk.state) + '<small>' + (trk.at ? UI.fmt.ago(trk.at) : '') + '</small></span>' : '') +
      tile('video', 'Dashcam', c.dashcam && (c.dashcam.imei || c.dashcam.platform) ? esc(c.dashcam.platform || 'Dashcam') : 'No dashcam', c.dashcam && c.dashcam.imei ? 'IMEI ' + esc(c.dashcam.imei) : '') +
      tile('cash', 'Rates', c.rate ? UI.money(c.rate) + ' a day' : 'No daily rate', [c.hourly ? UI.fmt.money(c.hourly) + ' an hour' : '', c.deposit ? UI.fmt.money(c.deposit) + ' deposit' : ''].filter(Boolean).join(' · ')) +
      '</div></div>';
  }, foot: [{ label: 'Close', kind: 'g' }].concat(can('cars.edit') ? [{ label: 'Edit car', icon: 'edit', close: false, onClick: function () { carsDrawer(id); return false; } }] : []) });
  dr.carId = id; CARS_PROF = dr;
  dr.body.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-cp]'); if (!b) return;
    var a = b.getAttribute('data-cp');
    if (a === 'edit') carsDrawer(id);
    else if (a === 'health') mtCarHealth(id);
    else if (a === 'book') API.newBooking({ car: id });
    else if (a === 'bk') API.openBooking(b.getAttribute('data-v'));
    else if (a === 'trip') { UI.closeAll(); go('tracking', { tab: 'history', car: id }); }
  });
  return dr;
}

/* other pages open a car here; the old string drawer forwards to it */
API.openCar = function (id) { carsProfile(id); };
API.editCar = function (id) { carsDrawer(id); };
DRAWERS['car'] = function (dr) { var c = D().cars[dr.i]; setTimeout(function () { S.drawer = null; if (c) carsProfile(c.id); }, 0); return ''; };

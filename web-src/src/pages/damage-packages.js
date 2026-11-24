/* ===================================================================
   Page: Damage Packages (#page=damage-packages)   Owner: builder 1
   Cover packages offered with a booking: name, daily rate, maximum coverage.
   Table, New / Edit / View drawer with a worked example, delete confirm (bookings keep their cover).
   =================================================================== */
function dpUses(pk, d) { d = d || D(); return d.bookings.filter(function (x) { return x.pkg === pk.id; }); }
function dpMoney(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

var DP_DR = null;
function dpOpen(id) {
  if (!can('damage_packages.view')) return;
  var d = D(), pk = id ? byId(d.damagePackages, id) : null;
  if (id && !pk) { UI.toast('That damage package was not found', { tone: 'warn' }); return; }
  if (DP_DR && !DP_DR.closed && DP_DR.data.id === (id || 'new')) return DP_DR;
  var edit = pk ? can('damage_packages.edit') : can('damage_packages.create');
  var v = { name: pk ? pk.name : '', daily: pk ? pk.daily.toFixed(2) : '', max: pk ? pk.max.toFixed(2) : '' }, errs = {};
  var onPage = S.page === 'damage-packages' && CUR && CUR.ctx;

  function example() {
    var dl = +v.daily || 0, mx = +v.max || 0;
    if (!dl && !mx) return '<div class="dp-ex faint">' + i('calculator') + '<span>Type the rates to see what a customer pays.</span></div>';
    return '<div class="dp-ex">' + i('calculator') + '<div><b>For a 3 day rental</b><span>The customer pays <b class="num">' + UI.money(dl * 3) + '</b> for cover (' + UI.money(dl) + ' x 3 days). If the car is damaged, the most they pay is <b class="num">' + UI.money(mx) + '</b>.</span></div></div>';
  }
  function body(el) {
    var uses = pk ? dpUses(pk) : [], live = uses.filter(function (x) { return x.status !== 'Cancelled' && x.status !== 'Returned'; });
    el.innerHTML = '<div class="dp-form">' + (edit
      ? UI.input({ key: 'name', label: 'Name', required: true, value: v.name, placeholder: 'e.g. Standard cover', error: errs.name ? 'Name is required' : '' }) +
        '<div class="dp-g2">' + UI.input({ key: 'daily', label: 'Daily Rate', type: 'number', min: 0, step: '0.01', required: true, prefix: 'RM', value: v.daily, placeholder: 'e.g. 25.00', error: errs.daily || '' }) +
        UI.input({ key: 'max', label: 'Maximum Coverage', type: 'number', min: 0, step: '0.01', required: true, prefix: 'RM', value: v.max, placeholder: 'e.g. 5000.00', error: errs.max || '' }) + '</div>'
      : '<div class="dp-kv">' + UI.kv('Name', esc(pk.name)) + UI.kv('Daily Rate', UI.money(pk.daily)) + UI.kv('Maximum Coverage', UI.money(pk.max)) + '</div>') +
      '<div id="dp-ex">' + example() + '</div>' +
      (pk ? '<div class="dp-uses">' + i('calendar-event') + '<div><b>' + (uses.length ? 'Chosen on ' + plural(uses.length, 'booking') + (live.length ? ', ' + live.length + ' still open' : '') : 'Not chosen on any booking yet') + '</b><span class="b2">' + (uses.length ? 'Latest: ' + uses.slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 3).map(function (x) { return '<a href="#" data-dp-bk="' + x.code + '">' + x.code + '</a>'; }).join(', ') + '. Changing the rates only changes new bookings and bookings you save again.' : 'Staff pick a package under Rental info when they make a booking.') + '</span></div></div>' : '') +
      '</div>';
  }
  function save(x) {
    var f = UI.form(x.body); v.name = (f.name || '').trim(); v.daily = x.body.querySelector('[data-key="daily"]').value; v.max = x.body.querySelector('[data-key="max"]').value;
    var dl = parseFloat(v.daily), mx = parseFloat(v.max);
    errs = { name: !v.name, daily: v.daily === '' ? 'Daily Rate is required' : !(dl >= 0) ? 'Type a number' : '', max: v.max === '' ? 'Maximum Coverage is required' : !(mx > 0) ? 'Type a number above 0' : '' };
    var dup = d.damagePackages.filter(function (z) { return z !== pk && z.name.toLowerCase() === v.name.toLowerCase(); })[0];
    if (dup) errs.name = true;
    if (errs.name || errs.daily || errs.max) { x.refresh(); if (dup) UI.toast('A package called ' + dup.name + ' already exists.', { tone: 'warn' }); var b = x.body.querySelector('.inp.bad input'); if (b) b.focus(); return false; }
    var rec = { name: v.name, daily: Math.round(dl * 100) / 100, max: Math.round(mx * 100) / 100 };
    if (pk) { DB.update('damagePackages', pk, rec, { where: 'Damage package', text: DB.actor() + ' changed damage package ' + rec.name }); UI.toast('Damage package updated successfully.'); }
    else { DB.add('damagePackages', rec, { where: 'Damage package', text: DB.actor() + ' created damage package ' + rec.name }); UI.toast('Damage package created successfully.'); }
  }
  var dr = UI.drawer({
    title: !pk ? 'New Package' : edit ? 'Edit Package' : 'Damage Package', subtitle: pk ? pk.name : 'Cover customers can add to a booking', width: 560, data: { id: id || 'new' },
    body: body,
    foot: edit ? [{ label: 'Cancel', kind: 'g' }, { label: pk ? 'Update' : 'Create', icon: pk ? 'check' : 'plus', onClick: save }] : [{ label: 'Close', kind: 'g' }],
    dirty: function (x) { if (!edit) return false; var f = UI.form(x.body), n = function (z) { return z == null || z === '' ? '' : String(+z); }; return (f.name || '').trim() !== (pk ? pk.name : '') || n(f.daily) !== n(pk ? pk.daily : '') || n(f.max) !== n(pk ? pk.max : ''); },
    onClose: function () { if (onPage && S.page === 'damage-packages') CUR.ctx.setParams({ package: '' }); }
  });
  DP_DR = dr;
  if (onPage) CUR.ctx.setParams({ package: id || 'new' });
  dr.el.addEventListener('input', function (ev) {
    var k = ev.target.getAttribute('data-key'); if (!k) return;
    v[k] = ev.target.value;
    if (k !== 'name') { var ex = dr.body.querySelector('#dp-ex'); if (ex) ex.innerHTML = example(); }
  });
  dr.el.addEventListener('click', function (ev) { var x = ev.target.closest('[data-dp-bk]'); if (x) { ev.preventDefault(); API.openBooking(x.getAttribute('data-dp-bk')); } });
  return dr;
}

function dpDelete(pk) {
  var uses = dpUses(pk);
  return UI.confirm({ title: 'Delete Damage Package?', text: 'This action cannot be undone.', ok: 'Delete', danger: true,
    html: uses.length ? UI.alert(plural(uses.length, 'booking') + ' chose this package. They keep their cover and price, shown as cover set by hand.', 'warn') : '' }).then(function (y) {
    if (!y) return;
    uses.forEach(function (x) { x.cov = { name: pk.name, daily: pk.daily, max: pk.max }; x.pkg = null; });
    DB.remove('damagePackages', pk, { where: 'Damage package', text: DB.actor() + ' deleted damage package ' + pk.name });
    UI.toast('Damage package deleted successfully.');
  });
}

PAGES['damage-packages'] = {
  title: 'Damage Packages',
  render: function (root, ctx) {
    var d = ctx.data, st = ctx.state; st.f = st.f || {};
    var canEdit = ctx.can('damage_packages.edit'), canDel = ctx.can('damage_packages.delete');
    root.innerHTML = '<div class="pg-h"><div><h1>Damage Packages</h1><p>Cover customers can add to a booking: what it costs per day and the most they pay if the car is damaged.</p></div><div class="acts">' +
      (ctx.can('damage_packages.create') ? UI.btn('New Package', { icon: 'plus', attrs: { 'data-dp-new': 1 } }) : '') + '</div></div>' +
      '<div class="card"><div id="dp-f"></div><div id="dp-t"></div></div>';
    var rowsFor = function () { var q = (st.f.q || '').toLowerCase().trim(); return d.damagePackages.filter(function (p) { return !q || (p.name + ' ' + p.daily + ' ' + p.max).toLowerCase().indexOf(q) >= 0; }); };
    var acts = function (p) {
      return '<div class="dp-acts">' + UI.iconBtn(canEdit ? 'pencil' : 'eye', (canEdit ? 'Edit ' : 'View ') + p.name, { size: 'sm', attrs: { 'data-dp-open': p.id } }) +
        (canDel ? UI.iconBtn('trash', 'Delete ' + p.name, { size: 'sm', cls: 'dp-del', attrs: { 'data-dp-del': p.id } }) : '') + '</div>';
    };
    var maxMax = Math.max.apply(0, d.damagePackages.map(function (p) { return p.max; }).concat([1]));
    var t = UI.table(root.querySelector('#dp-t'), {
      rows: rowsFor(), rowKey: 'id', pageSize: st.size || 10, pageSizes: [10, 25, 50], sort: st.sort, onSort: function (s) { st.sort = s; }, noun: 'package',
      onRowClick: function (p) { dpOpen(p.id); },
      columns: [
        { key: 'name', label: 'Name', sort: true, render: function (p) { return '<div class="dp-name"><span class="dp-ic">' + i('shield-check') + '</span><b class="t1c">' + esc(p.name) + '</b></div>'; } },
        { key: 'daily', label: 'Daily Rate (RM)', align: 'right', sort: true, nowrap: true, render: function (p) { return '<span class="num">' + dpMoney(p.daily) + '</span>'; } },
        { key: 'max', label: 'Max Coverage (RM)', align: 'right', sort: true, nowrap: true, render: function (p) { return '<div class="dp-max"><span class="num">' + dpMoney(p.max) + '</span><span class="dp-bar"><i style="width:' + Math.round(p.max / maxMax * 100) + '%"></i></span></div>'; } },
        { key: 'uses', label: 'Bookings', align: 'right', sort: function (p) { return dpUses(p, d).length; }, render: function (p) { var n = dpUses(p, d).length; return n ? '<span class="num">' + n + '</span>' : '<span class="faint">0</span>'; } },
        { key: 'act', label: 'Actions', align: 'right', render: acts }
      ],
      empty: { icon: 'shield-off', title: 'No damage packages found.', text: st.f.q ? 'Try another name.' : 'Add the cover options staff can offer on a booking.', action: !st.f.q && ctx.can('damage_packages.create') ? UI.btn('New Package', { icon: 'plus', attrs: { 'data-dp-new': 1 } }) : '' },
      card: function (p) { return '<div class="dp-card"><div class="dp-name"><span class="dp-ic">' + i('shield-check') + '</span><b>' + esc(p.name) + '</b></div><div class="dp-card-n"><span><small>Daily Rate</small><b class="num">RM ' + dpMoney(p.daily) + '</b></span><span><small>Max Coverage</small><b class="num">RM ' + dpMoney(p.max) + '</b></span><span><small>Bookings</small><b class="num">' + dpUses(p, d).length + '</b></span></div>' + acts(p) + '</div>'; }
    });
    UI.filters(root.querySelector('#dp-f'), { values: st.f, fields: [{ type: 'search', key: 'q', placeholder: 'Search...' }], onChange: function () { t.setRows(rowsFor()); }, extra: '<span class="grow"></span><span class="b2">' + plural(d.damagePackages.length, 'package') + '</span>' });
    UI.on(root, 'click', '[data-dp-new]', function () { dpOpen(null); });
    UI.on(root, 'click', '[data-dp-open]', function (ev, el) { dpOpen(el.getAttribute('data-dp-open')); });
    UI.on(root, 'click', '[data-dp-del]', function (ev, el) { var p = byId(d.damagePackages, el.getAttribute('data-dp-del')); if (p) dpDelete(p); });
    var p = ctx.params.package;
    if (p) setTimeout(function () { if (p === 'new') { if (ctx.can('damage_packages.create')) dpOpen(null); } else dpOpen(p); }, 0);
  },
  search: [{ label: 'New damage package', icon: 'shield-plus', run: function () { if (can('damage_packages.create')) dpOpen(null); } }]
};

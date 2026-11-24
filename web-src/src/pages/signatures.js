/* ===================================================================
   Page: Signatures (#page=signatures)   Owner: builder 1
   The company's authority signatures printed on rental agreements.
   Table (signature, name, used on), New / Edit / View drawer with upload, draw and remove, delete confirm.
   =================================================================== */
function sgUses(sg, d) { d = d || D(); return d.bookings.filter(function (x) { return x.signature === sg.id; }); }
function sgFile(sg) { var png = /^data:image\/png/.test(sg.img), svg = /^data:image\/svg/.test(sg.img); return { name: (sg.name || 'signature').replace(/[^\w ()-]+/g, '').trim().replace(/\s+/g, '-') + (png ? '.png' : svg ? '.svg' : '.jpg'), dataUrl: sg.img }; }

/* draw a signature with a finger or the mouse; resolves with a PNG data address or null */
function sgDrawPad() {
  return new Promise(function (res) {
    var drawn = false, out = null;
    var dl = UI.dialog({
      title: 'Draw the signature', width: 'md',
      body: '<p class="ui-ctext">Sign inside the box with a finger, a pen or the mouse.</p><div class="sg-pad"><canvas width="900" height="300" aria-label="Signature pad"></canvas><span class="sg-pad-line"></span><span class="sg-pad-hint">Sign here</span></div><span class="ui-err" hidden>Draw the signature in the box first.</span>',
      buttons: [{ label: 'Clear', kind: 't', icon: 'eraser', onClick: function () { clear(); return false; } }, { spacer: true }, { label: 'Cancel', kind: 'g' }, { label: 'Use this signature', icon: 'check', onClick: function (x) {
        if (!drawn) { x.body.querySelector('.ui-err').hidden = false; return false; }
        out = cv.toDataURL('image/png');
      } }],
      onClose: function () { res(out); }
    });
    var cv = dl.body.querySelector('canvas'), g = cv.getContext('2d'), down = false, last = null;
    g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1b2a6b';
    function clear() { g.clearRect(0, 0, cv.width, cv.height); drawn = false; dl.body.querySelector('.sg-pad').classList.remove('on'); }
    function pt(ev) { var r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * cv.width / r.width, (ev.clientY - r.top) * cv.height / r.height]; }
    cv.addEventListener('pointerdown', function (ev) { ev.preventDefault(); down = true; last = pt(ev); try { cv.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ } g.beginPath(); g.arc(last[0], last[1], 2, 0, 7); g.fillStyle = g.strokeStyle; g.fill(); drawn = true; dl.body.querySelector('.sg-pad').classList.add('on'); dl.body.querySelector('.ui-err').hidden = true; });
    cv.addEventListener('pointermove', function (ev) { if (!down) return; var p = pt(ev); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { cv.addEventListener(t, function () { down = false; }); });
  });
}

var SG_DR = null;
function sgOpen(id) {
  if (!can('signatures.view')) return;
  var d = D(), sg = id ? byId(d.signatures, id) : null;
  if (id && !sg) { UI.toast('That signature was not found', { tone: 'warn' }); return; }
  if (SG_DR && !SG_DR.closed && SG_DR.data.id === (id || 'new')) return SG_DR;
  var edit = sg ? can('signatures.edit') : can('signatures.create');
  var img = sg ? sg.img : null, imgName = sg ? 'Saved signature' : '', removed = null, name0 = sg ? sg.name : '', errs = {};
  var onPage = S.page === 'signatures' && CUR && CUR.ctx;

  function imgBlock() {
    var acts = edit ? '<div class="row gap8 wrap">' +
      '<label class="btn tonal sm">' + i('upload') + '<span>' + (img ? 'Replace' : 'Upload') + '</span><input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden data-sg-file></label>' +
      UI.btn('Draw it here', { kind: 'o', size: 'sm', icon: 'writing-sign', attrs: { 'data-sg-act': 'draw' } }) +
      (img ? UI.btn('Remove', { kind: 't', size: 'sm', icon: 'trash', cls: 'sg-rm', attrs: { 'data-sg-act': 'remove' } }) : '') +
      (!img && removed ? UI.btn('Undo', { kind: 't', size: 'sm', icon: 'arrow-back-up', attrs: { 'data-sg-act': 'undo' } }) : '') + '</div>' : '';
    return '<div class="sg-lbl">Signature image' + (edit ? ' <span class="ui-req">*</span>' : '') + '</div>' +
      (img ? '<div class="sg-paper big"><img src="' + img + '" alt="Signature preview"></div><div class="b2 sg-meta">' + esc(imgName) + '</div>'
        : '<div class="sg-paper big empty' + (errs.img ? ' bad' : '') + '">' + i('signature') + '<span>No image yet. Upload a scan on a white background, or draw it here.</span></div>') +
      (errs.img ? '<span class="ui-err">Signature image is required</span>' : '') + acts +
      (edit ? '<p class="help sg-help">' + i('info-circle') + 'Use a clear signature on a white or see-through background. It prints at about 6 cm wide on page 3 of every rental agreement.</p>' : '');
  }
  function body(el) {
    var uses = sg ? sgUses(sg) : [];
    el.innerHTML = '<div class="sg-form">' +
      (edit ? UI.input({ key: 'name', label: 'Name', required: true, value: name0, placeholder: 'For example: Director', error: errs.name ? 'Name is required' : '' }) : UI.kv('Name', esc(sg.name))) +
      '<div id="sg-img">' + imgBlock() + '</div>' +
      (sg ? '<div class="sg-uses">' + i('file-certificate') + '<div><b>' + (uses.length ? 'Used on ' + plural(uses.length, 'booking') : 'Not used on any booking yet') + '</b><span class="b2">' + (uses.length ? 'Latest: ' + uses.slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 3).map(function (x) { return '<a href="#" data-sg-bk="' + x.code + '">' + x.code + '</a>'; }).join(', ') : 'Pick it under Authority & admin when you edit a booking.') + '</span></div></div>' : '') +
      '</div>';
  }
  function redrawImg() { var b = dr.body.querySelector('#sg-img'); if (b) b.innerHTML = imgBlock(); }
  function save(x) {
    var nm = (x.body.querySelector('[data-key="name"]').value || '').trim();
    name0 = nm; errs = { name: !nm, img: !img };
    if (errs.name || errs.img) { x.refresh(); var f = x.body.querySelector('.inp.bad input'); if (f) f.focus(); return false; }
    if (sg) { DB.update('signatures', sg, { name: nm, img: img }, { where: 'Signature', text: DB.actor() + ' changed signature ' + nm }); UI.toast('Signature updated successfully.'); }
    else { DB.add('signatures', { name: nm, img: img, at: NOW(), by: DB.actor() }, { where: 'Signature', text: DB.actor() + ' created signature ' + nm }); UI.toast('Signature created successfully.'); }
  }
  var dr = UI.drawer({
    title: !sg ? 'New Signature' : edit ? 'Edit Signature' : 'Signature', subtitle: sg ? 'Printed on rental agreements' : 'Add a signature to print on rental agreements', width: 640, data: { id: id || 'new' },
    actions: sg && img ? UI.iconBtn('download', 'Download image', { size: 'sm', attrs: { 'data-sg-act': 'dl' } }) : '',
    body: body,
    foot: edit ? [{ label: 'Cancel', kind: 'g' }, { label: sg ? 'Update' : 'Create', icon: sg ? 'check' : 'plus', onClick: save }] : [{ label: 'Close', kind: 'g' }],
    dirty: function (x) { if (!edit) return false; var f = x.body.querySelector('[data-key="name"]'); return (f && f.value.trim() !== (sg ? sg.name : '')) || img !== (sg ? sg.img : null); },
    onClose: function () { if (onPage && S.page === 'signatures') CUR.ctx.setParams({ signature: '' }); }
  });
  SG_DR = dr;
  if (onPage) CUR.ctx.setParams({ signature: id || 'new' });
  dr.el.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-key') === 'name') name0 = ev.target.value; });
  dr.el.addEventListener('change', function (ev) {
    if (!ev.target.hasAttribute('data-sg-file')) return;
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { UI.toast('Choose a picture file (PNG, JPG, SVG or WebP).', { tone: 'warn' }); return; }
    UI.readImage(f, { max: 1200 }).then(function (r) { img = r.dataUrl; imgName = r.name + (r.w ? ' · ' + r.w + ' x ' + r.h : ''); removed = null; errs.img = false; redrawImg(); UI.toast('Signature image added. Press ' + (sg ? 'Update' : 'Create') + ' to save it.', { tone: 'info' }); }, function (err) { UI.toast(err.message, { tone: 'bad' }); });
  });
  dr.el.addEventListener('click', function (ev) {
    var x = ev.target.closest('[data-sg-act],[data-sg-bk]'); if (!x) return;
    if (x.hasAttribute('data-sg-bk')) { ev.preventDefault(); API.openBooking(x.getAttribute('data-sg-bk')); return; }
    var a = x.getAttribute('data-sg-act');
    if (a === 'draw') sgDrawPad().then(function (u) { if (u) { img = u; imgName = 'Drawn here · ' + UI.fmt.dateTime(NOW()); removed = null; errs.img = false; redrawImg(); } });
    else if (a === 'remove') { removed = { img: img, name: imgName }; img = null; imgName = ''; redrawImg(); }
    else if (a === 'undo' && removed) { img = removed.img; imgName = removed.name; removed = null; redrawImg(); }
    else if (a === 'dl') cuDownloadData(sgFile({ name: sg.name, img: sg.img }));
  });
  return dr;
}

function sgDelete(sg) {
  var uses = sgUses(sg), other = D().signatures.filter(function (z) { return z !== sg; })[0];
  return UI.confirm({ title: 'Delete Signature?', text: 'This action cannot be undone.', ok: 'Delete', danger: true,
    html: uses.length ? UI.alert(plural(uses.length, 'booking') + ' use this signature. Their agreements will print ' + (other ? other.name : 'no company signature') + ' instead.', 'warn') : '' }).then(function (y) {
    if (!y) return;
    uses.forEach(function (x) { x.signature = other ? other.id : null; });
    DB.remove('signatures', sg, { where: 'Signature', text: DB.actor() + ' deleted signature ' + sg.name });
    UI.toast('Signature deleted successfully.');
  });
}

PAGES['signatures'] = {
  title: 'Signatures',
  render: function (root, ctx) {
    var d = ctx.data, st = ctx.state; st.f = st.f || {};
    var canEdit = ctx.can('signatures.edit'), canDel = ctx.can('signatures.delete');
    root.innerHTML = '<div class="pg-h"><div><h1>Signatures</h1><p>Company signatures printed on rental agreements. Pick one on each booking under Authority &amp; admin.</p></div><div class="acts">' +
      (ctx.can('signatures.create') ? UI.btn('New Signature', { icon: 'plus', attrs: { 'data-sg-new': 1 } }) : '') + '</div></div>' +
      '<div class="card"><div id="sg-f"></div><div id="sg-t"></div></div>';
    var rowsFor = function () { var q = (st.f.q || '').toLowerCase().trim(); return d.signatures.filter(function (s) { return !q || s.name.toLowerCase().indexOf(q) >= 0; }); };
    var acts = function (s) {
      return '<div class="sg-acts">' + UI.iconBtn(canEdit ? 'pencil' : 'eye', (canEdit ? 'Edit ' : 'View ') + s.name, { size: 'sm', attrs: { 'data-sg-open': s.id } }) +
        (canDel ? UI.iconBtn('trash', 'Delete ' + s.name, { size: 'sm', cls: 'sg-del', attrs: { 'data-sg-del': s.id } }) : '') + '</div>';
    };
    var t = UI.table(root.querySelector('#sg-t'), {
      rows: rowsFor(), rowKey: 'id', pageSize: st.size || 10, pageSizes: [10, 25, 50], sort: st.sort, onSort: function (s) { st.sort = s; }, noun: 'signature',
      onRowClick: function (s) { sgOpen(s.id); },
      columns: [
        { key: 'img', label: 'Signature', render: function (s) { return '<div class="sg-paper">' + (s.img ? '<img src="' + s.img + '" alt="Signature of ' + esc(s.name) + '">' : '<span class="faint">No image</span>') + '</div>'; } },
        { key: 'name', label: 'Name', sort: true, render: function (s) { return '<b class="t1c">' + esc(s.name) + '</b>'; } },
        { key: 'uses', label: 'Used on', align: 'right', sort: function (s) { return sgUses(s, d).length; }, render: function (s) { var n = sgUses(s, d).length; return n ? '<span class="num">' + plural(n, 'booking') + '</span>' : '<span class="faint">Not used yet</span>'; } },
        { key: 'act', label: 'Actions', align: 'right', render: acts }
      ],
      empty: { icon: 'signature', title: 'No signatures found.', text: st.f.q ? 'Try another name.' : 'Add the signature that should print on your rental agreements.', action: !st.f.q && ctx.can('signatures.create') ? UI.btn('New Signature', { icon: 'plus', attrs: { 'data-sg-new': 1 } }) : '' },
      card: function (s) { return '<div class="sg-card"><div class="sg-paper">' + (s.img ? '<img src="' + s.img + '" alt="">' : '') + '</div><div class="sg-card-t"><b>' + esc(s.name) + '</b><span class="b2">' + (sgUses(s, d).length ? 'Used on ' + plural(sgUses(s, d).length, 'booking') : 'Not used yet') + '</span></div>' + acts(s) + '</div>'; }
    });
    UI.filters(root.querySelector('#sg-f'), { values: st.f, fields: [{ type: 'search', key: 'q', placeholder: 'Search...' }], onChange: function () { t.setRows(rowsFor()); }, extra: '<span class="grow"></span><span class="b2">' + plural(d.signatures.length, 'signature') + '</span>' });
    UI.on(root, 'click', '[data-sg-new]', function () { sgOpen(null); });
    UI.on(root, 'click', '[data-sg-open]', function (ev, el) { ev.stopPropagation(); sgOpen(el.getAttribute('data-sg-open')); });
    UI.on(root, 'click', '[data-sg-del]', function (ev, el) { ev.stopPropagation(); var s = byId(d.signatures, el.getAttribute('data-sg-del')); if (s) sgDelete(s); });
    var p = ctx.params.signature;
    if (p) setTimeout(function () { if (p === 'new') { if (ctx.can('signatures.create')) sgOpen(null); } else sgOpen(p); }, 0);
  },
  search: [{ label: 'New Signature', icon: 'signature', run: function () { if (can('signatures.create')) sgOpen(null); } }]
};

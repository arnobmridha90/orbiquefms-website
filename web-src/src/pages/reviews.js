/* ===================================================================
   Page: Reviews (#page=reviews&review=rev-2&action=add)   Owner: builder 5
   Customer testimonials shown on the public website (every website design shows them, in order).
   =================================================================== */
function revStars(n, o) { o = o || {}; var s = ''; for (var k = 1; k <= 5; k++) s += '<span class="rv-star' + (k <= n ? ' on' : '') + '">' + i(k <= n ? 'star-filled' : 'star') + '</span>'; return '<span class="rv-stars" role="img" aria-label="' + n + ' out of 5 stars">' + s + '</span>'; }
function revPhoto(r) { return r.photo ? '<img class="rv-ph" src="' + r.photo + '" alt="">' : UI.avatar(r.name); }
function revForm(r) {
  r = r || {};
  var d = D(), next = Math.max.apply(0, [0].concat(d.reviews.map(function (x) { return x.order; }))) + 1;
  var st = { photo: r.photo || null, rating: r.rating || 0 };
  var dr = UI.drawer({ title: r.id ? 'Edit Review' : 'New Review', subtitle: 'Shown on your website', width: 560,
    dirty: function (x) { var v = UI.form(x.body); return v.name !== (r.name || '') || v.text !== (r.text || '') || st.rating !== (r.rating || 0) || st.photo !== (r.photo || null); },
    body: function (el) {
      el.innerHTML = '<div class="col gap16"><div class="row wrap gap12 rv-photo"><span class="rv-big">' + (st.photo ? '<img src="' + st.photo + '" alt="Photo">' : i('user')) + '</span><div class="col gap6"><div class="t1c">Photo</div><div class="row wrap gap8"><label class="btn o sm">' + i('upload') + (st.photo ? 'Replace' : 'Upload') + '<input type="file" accept="image/*" data-rv-up hidden></label>' + (st.photo ? UI.btn('Remove', { kind: 't', size: 'sm', icon: 'trash', attrs: { 'data-rv-rm': '1' } }) : '') + '</div><span class="b2">Optional. A square picture works best.</span></div></div>' +
        UI.input({ key: 'name', label: 'Name', required: true, value: r.name || '', maxlength: 80 }) + UI.textarea({ key: 'text', label: 'Review', required: true, value: r.text || '', rows: 5, maxlength: 1000 }) +
        '<div class="grid g2">' + UI.input({ key: 'date', label: 'Date', type: 'date', required: true, value: r.date || NOW() }) + UI.input({ key: 'order', label: 'Serial / Order', type: 'number', min: 1, value: r.order || next }) + '</div>' +
        '<div class="inp"><label>Rating <span class="ui-req">*</span></label><div class="rv-pick" role="radiogroup" aria-label="Rating">' + [1, 2, 3, 4, 5].map(function (k) { return '<button type="button" role="radio" aria-checked="' + (st.rating === k) + '" aria-label="' + k + ' star' + (k > 1 ? 's' : '') + '" data-rv-star="' + k + '" class="' + (k <= st.rating ? 'on' : '') + '">' + i(k <= st.rating ? 'star-filled' : 'star') + '</button>'; }).join('') + '<span class="b2">' + (st.rating ? st.rating + ' of 5' : 'Tap a star') + '</span></div></div><p class="ui-err rv-err" hidden></p></div>';
      var keep = function () { var v = UI.form(el); r = Object.assign({}, r, { name: v.name, text: v.text, order: v.order, date: UI.parseDate(v.date) }); };
      el.querySelector('[data-rv-up]').addEventListener('change', function (ev) { var f = ev.target.files[0]; if (!f) return; keep(); UI.readImage(f, { max: 400 }).then(function (x) { st.photo = x.dataUrl; dr.refresh(); }); });
      var rm = el.querySelector('[data-rv-rm]'); if (rm) rm.addEventListener('click', function () { keep(); st.photo = null; dr.refresh(); });
      el.querySelectorAll('[data-rv-star]').forEach(function (b) { b.addEventListener('click', function () { keep(); st.rating = +b.getAttribute('data-rv-star'); dr.refresh(); }); });
    },
    foot: r.id && !can('reviews.edit') ? [{ label: 'Close' }] : [{ label: 'Cancel', kind: 'o' }, { label: r.id ? 'Update' : 'Create', icon: 'check', onClick: function (x) {
      var v = UI.form(x.body), er = x.body.querySelector('.rv-err'), bad = !v.name.trim() ? 'Type the name.' : !v.text.trim() ? 'Type the review.' : !v.date ? 'Choose the date.' : !st.rating ? 'Choose the rating.' : '';
      if (bad) { er.textContent = bad; er.hidden = false; return false; }
      var rec = { name: v.name.trim(), text: v.text.trim(), date: UI.parseDate(v.date), order: Math.max(1, Math.round(v.order || next)), rating: st.rating, photo: st.photo };
      var orig = r.id ? byId(D().reviews, r.id) : null;
      if (orig) { DB.update('reviews', orig, rec, { label: 'review', text: me().name + ' changed the review by ' + rec.name }); UI.toast('Review updated.'); }
      else { DB.add('reviews', rec, { label: 'review', text: me().name + ' added a review by ' + rec.name }); UI.toast('Review added. It shows on the website.'); }
    } }],
    onClose: function () { if (CUR && CUR.ctx && S.page === 'reviews') CUR.ctx.setParams({ review: '', action: '' }); } });
  return dr;
}
function revDelete(r) { UI.confirm({ title: 'Delete review?', text: 'This action cannot be undone.', ok: 'Yes, Delete', danger: true }).then(function (y) { if (!y) return; DB.remove('reviews', r, { label: 'review', text: me().name + ' deleted the review by ' + r.name }); UI.toast('Review deleted.'); }); }
PAGES['reviews'] = {
  title: 'Reviews',
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data, canE = ctx.can('reviews.edit'), canD = ctx.can('reviews.delete');
    st.f = st.f || {};
    var avg = d.reviews.length ? d.reviews.reduce(function (s, r) { return s + r.rating; }, 0) / d.reviews.length : 0;
    root.innerHTML = '<div class="pg-h"><div><h1>Reviews</h1><p>Customer reviews shown on your website. ' + plural(d.reviews.length, 'review') + (d.reviews.length ? ', ' + avg.toFixed(1) + ' stars on average.' : '.') + '</p></div><div class="acts">' +
      (ctx.can('home_settings.view') ? UI.btn('See on the website', { kind: 'o', icon: 'world', attrs: { 'data-act': 'web' } }) : '') + (ctx.can('reviews.create') ? UI.btn('New Review', { icon: 'plus', attrs: { 'data-act': 'add' } }) : '') + '</div></div>' +
      '<div class="card"><div class="card-b tight" id="rv-f"></div><div id="rv-t"></div></div>';
    var rows = function () { var q = (st.f.q || '').toLowerCase(); return d.reviews.filter(function (r) { return !q || (r.name + ' ' + r.text).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return a.order - b.order; }); };
    var acts = function (r) { return '<div class="row gap4" data-stop>' + UI.iconBtn(canE ? 'edit' : 'eye', canE ? 'Edit' : 'See', { size: 'sm', attrs: { 'data-rv-ed': r.id } }) + (canD ? UI.iconBtn('trash', 'Delete', { size: 'sm', attrs: { 'data-rv-del': r.id } }) : '') + '</div>'; };
    var t = UI.table(root.querySelector('#rv-t'), { rows: rows(), density: 'compact', pageSize: 10, pageSizes: [10, 25, 50], minWidth: 900,
      columns: [{ key: 'photo', label: 'Photo', width: 70, render: revPhoto }, { key: 'name', label: 'Name', sort: true, nowrap: true }, { key: 'text', label: 'Review', render: function (r) { return '<span class="rv-txt">' + esc(r.text) + '</span>'; } }, { key: 'rating', label: 'Rating', sort: true, render: function (r) { return revStars(r.rating); } }, { key: 'date', label: 'Date', sort: true, nowrap: true, render: function (r) { return UI.fmt.date(r.date); } }, { key: 'order', label: '#', sort: true, width: 50 }, { key: 'x', label: 'Actions', width: 100, render: acts }],
      card: function (r) { return '<div class="row gap8" style="align-items:flex-start">' + revPhoto(r) + '<div class="grow"><b>' + esc(r.name) + '</b><div>' + revStars(r.rating) + '</div></div>' + acts(r) + '</div><div class="b2 mt8 rv-txt">' + esc(r.text) + '</div><div class="b2 mt8">' + UI.fmt.date(r.date) + ' · #' + r.order + '</div>'; },
      onRowClick: function (r) { revForm(r); ctx.setParams({ review: r.id }); },
      empty: { icon: 'star', title: d.reviews.length ? 'No review matches' : 'No reviews yet', text: d.reviews.length ? 'Clear the search.' : 'Add what happy customers said.' } });
    UI.filters(root.querySelector('#rv-f'), { values: st.f, fields: [{ type: 'search', key: 'q', placeholder: 'Search...' }], onChange: function () { t.setRows(rows()); } });
    UI.on(root, 'click', '[data-act="add"]', function () { revForm(); });
    UI.on(root, 'click', '[data-act="web"]', function () { ctx.go('website'); });
    UI.on(root, 'click', '[data-rv-ed]', function (ev, el) { revForm(byId(d.reviews, el.getAttribute('data-rv-ed'))); });
    UI.on(root, 'click', '[data-rv-del]', function (ev, el) { revDelete(byId(d.reviews, el.getAttribute('data-rv-del'))); });
    if (!UI.top()) { if (ctx.params.review && byId(d.reviews, ctx.params.review)) setTimeout(function () { revForm(byId(d.reviews, ctx.params.review)); }, 0); else if (ctx.params.action === 'add' && ctx.can('reviews.create') && !st.added) { st.added = 1; setTimeout(function () { revForm(); }, 0); } }
  },
  search: [{ label: 'New Review', icon: 'star', keywords: 'testimonial website', run: function () { if (can('reviews.create')) revForm(); } }]
};

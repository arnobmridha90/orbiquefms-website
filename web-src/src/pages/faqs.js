/* ===================================================================
   Page: FAQs (#page=faqs&faq=faq-3&action=add)   Owner: builder 5
   Questions and answers shown on the public website (every website design reads the active ones, in order).
   =================================================================== */
function faqsForm(f) {
  f = f || {};
  var d = D(), next = Math.max.apply(0, [0].concat(d.faqs.map(function (x) { return x.order; }))) + 1;
  var dr = UI.drawer({ title: f.id ? 'Edit FAQ' : 'New FAQ', subtitle: f.id ? 'Shown on the website in place ' + f.order : 'Shown on your website and booking form', width: 560,
    dirty: function (x) { var v = UI.form(x.body); return v.q !== (f.q || '') || v.a !== (f.a || ''); },
    body: '<div class="col gap16">' + UI.input({ key: 'q', label: 'Question', required: true, value: f.q || '', placeholder: 'e.g. How much is the deposit?', maxlength: 200 }) +
      UI.textarea({ key: 'a', label: 'Answer', required: true, value: f.a || '', rows: 6, maxlength: 2000 }) +
      UI.input({ key: 'order', label: 'Serial / Order', type: 'number', min: 1, value: f.order || next, help: 'Lower numbers show first on the website.' }) +
      UI.switch({ key: 'active', label: 'Active', checked: f.id ? f.active : true, help: 'Only active questions show on the website.' }) + '<p class="ui-err fq-err" hidden></p></div>',
    foot: f.id && !can('faqs.edit') ? [{ label: 'Close' }] : [{ label: 'Cancel', kind: 'o' }, { label: f.id ? 'Update' : 'Create', icon: 'check', onClick: function (x) {
      var v = UI.form(x.body), er = x.body.querySelector('.fq-err');
      if (!v.q.trim() || !v.a.trim()) { er.textContent = !v.q.trim() ? 'Type the question.' : 'Type the answer.'; er.hidden = false; return false; }
      var rec = { q: v.q.trim(), a: v.a.trim(), order: Math.max(1, Math.round(v.order || next)), active: v.active };
      if (f.id) { DB.update('faqs', f, rec, { label: 'FAQ', text: me().name + ' changed FAQ "' + rec.q + '"' }); UI.toast('FAQ updated.'); }
      else { DB.add('faqs', rec, { label: 'FAQ', text: me().name + ' added FAQ "' + rec.q + '"' }); UI.toast('FAQ added. It shows on the website' + (rec.active ? '.' : ' once it is active.')); }
    } }],
    onClose: function () { if (CUR && CUR.ctx && S.page === 'faqs') CUR.ctx.setParams({ faq: '', action: '' }); } });
  return dr;
}
function faqsDelete(f) {
  UI.confirm({ title: 'Delete FAQ?', text: 'This action cannot be undone.', ok: 'Yes, Delete', danger: true }).then(function (y) { if (!y) return; DB.remove('faqs', f, { label: 'FAQ', text: me().name + ' deleted FAQ "' + f.q + '"' }); UI.toast('FAQ deleted.'); });
}
PAGES['faqs'] = {
  title: 'FAQs',
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data, canE = ctx.can('faqs.edit'), canD = ctx.can('faqs.delete');
    st.f = st.f || {};
    var act = d.faqs.filter(function (f) { return f.active; }).length;
    root.innerHTML = '<div class="pg-h"><div><h1>FAQs</h1><p>Questions and answers shown on your website. ' + act + ' of ' + d.faqs.length + ' are active.</p></div><div class="acts">' +
      (ctx.can('home_settings.view') ? UI.btn('See on the website', { kind: 'o', icon: 'world', attrs: { 'data-act': 'web' } }) : '') + (ctx.can('faqs.create') ? UI.btn('New FAQ', { icon: 'plus', attrs: { 'data-act': 'add' } }) : '') + '</div></div>' +
      '<div class="card"><div class="card-b tight" id="fq-f"></div><div id="fq-t"></div></div>';
    var rows = function () { var q = (st.f.q || '').toLowerCase(); return d.faqs.filter(function (f) { return !q || (f.q + ' ' + f.a).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return a.order - b.order; }); };
    var acts = function (f) { return '<div class="row gap4" data-stop>' + UI.iconBtn(canE ? 'edit' : 'eye', canE ? 'Edit' : 'See', { size: 'sm', attrs: { 'data-fq-ed': f.id } }) + (canD ? UI.iconBtn('trash', 'Delete', { size: 'sm', attrs: { 'data-fq-del': f.id } }) : '') + '</div>'; };
    var stc = function (f) { return canE ? '<button type="button" class="fq-st" data-fq-tog="' + f.id + '" title="' + (f.active ? 'Switch off' : 'Switch on') + '">' + UI.status('active', f.active ? 'Active' : 'Inactive') + '</button>' : UI.status('active', f.active ? 'Active' : 'Inactive'); };
    var t = UI.table(root.querySelector('#fq-t'), { rows: rows(), density: 'compact', pageSize: 10, pageSizes: [10, 25, 50], minWidth: 820,
      columns: [{ key: 'order', label: '#', sort: true, width: 60 }, { key: 'q', label: 'Question', sort: true, render: function (f) { return '<b class="fq-q">' + esc(f.q) + '</b>'; } }, { key: 'a', label: 'Answer', render: function (f) { return '<span class="fq-a">' + esc(f.a) + '</span>'; } }, { key: 'active', label: 'Status', render: stc }, { key: 'x', label: 'Actions', width: 100, render: acts }],
      card: function (f) { return '<div class="row gap8" style="justify-content:space-between;align-items:flex-start"><b class="fq-q">' + f.order + '. ' + esc(f.q) + '</b>' + acts(f) + '</div><div class="b2 fq-a mt8">' + esc(f.a) + '</div><div class="mt8">' + stc(f) + '</div>'; },
      onRowClick: function (f) { faqsForm(f); ctx.setParams({ faq: f.id }); },
      empty: { icon: 'help-circle', title: d.faqs.length ? 'No question matches' : 'No FAQs yet', text: d.faqs.length ? 'Clear the search.' : 'Add the questions customers ask most.' } });
    UI.filters(root.querySelector('#fq-f'), { values: st.f, fields: [{ type: 'search', key: 'q', placeholder: 'Search...' }], onChange: function () { t.setRows(rows()); } });
    UI.on(root, 'click', '[data-act="add"]', function () { faqsForm(); });
    UI.on(root, 'click', '[data-act="web"]', function () { ctx.go('website'); });
    UI.on(root, 'click', '[data-fq-ed]', function (ev, el) { faqsForm(byId(d.faqs, el.getAttribute('data-fq-ed'))); });
    UI.on(root, 'click', '[data-fq-del]', function (ev, el) { faqsDelete(byId(d.faqs, el.getAttribute('data-fq-del'))); });
    UI.on(root, 'click', '[data-fq-tog]', function (ev, el) { var f = byId(d.faqs, el.getAttribute('data-fq-tog')); DB.update('faqs', f, { active: !f.active }, { label: 'FAQ', text: me().name + (f.active ? ' switched on' : ' switched off') + ' FAQ "' + f.q + '"' }); UI.toast(f.active ? 'Active: it shows on the website.' : 'Inactive: hidden from the website.'); });
    if (!UI.top()) { if (ctx.params.faq && byId(d.faqs, ctx.params.faq)) setTimeout(function () { faqsForm(byId(d.faqs, ctx.params.faq)); }, 0); else if (ctx.params.action === 'add' && ctx.can('faqs.create') && !st.added) { st.added = 1; setTimeout(function () { faqsForm(); }, 0); } }
  },
  search: [{ label: 'New FAQ', icon: 'plus', keywords: 'question answer website', run: function () { if (can('faqs.create')) faqsForm(); } }]
};

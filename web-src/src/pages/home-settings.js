/* ===================================================================
   Page: Home Settings (#page=home-settings), catalog name "Website settings"   Owner: builder 5
   The public website's home page: hero image, the WhatsApp number the website's forms go to, brand logos and
   social buttons. Every website design (Website page) reads these.
   =================================================================== */
/* plain names so the build packs these icons */
var HS_ICON_NAMES = ['brand-whatsapp', 'brand-instagram', 'brand-facebook', 'brand-tiktok', 'brand-youtube', 'brand-x', 'world', 'mail'];
var HS_ICONS = [['icon:brand-whatsapp', 'WhatsApp'], ['icon:brand-instagram', 'Instagram'], ['icon:brand-facebook', 'Facebook'], ['icon:brand-tiktok', 'TikTok'], ['icon:brand-youtube', 'YouTube'], ['icon:brand-x', 'X'], ['icon:world', 'Website'], ['icon:mail', 'Email']];
function hsWordmark(name, seed) {
  var cols = ['#1F2937', '#374151', '#0F172A', '#4B5563'], c = cols[seed % cols.length];
  return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><rect width="160" height="60" rx="10" fill="#ffffff"/><text x="80" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="' + c + '">' + String(name).toUpperCase().replace(/[<&>"]/g, '') + '</text></svg>');
}
DATA_INIT.push(function (d) {
  if (!d.home) return;
  d.home.logos.forEach(function (l, k) { if (!l.img) l.img = hsWordmark(l.name, k); });
  var map = { WhatsApp: 'icon:brand-whatsapp', Instagram: 'icon:brand-instagram', Facebook: 'icon:brand-facebook', TikTok: 'icon:brand-tiktok' };
  d.home.socials.forEach(function (s) { if (!s.logo) s.logo = map[s.name] || 'icon:world'; if (s.name === 'WhatsApp' && d.home.formNumber) s.link = 'https://wa.me/' + String(d.home.formNumber).replace(/\D/g, ''); });
});
function hsLogoHtml(v, cls) { if (!v) return '<span class="hs-ic ' + (cls || '') + '">' + i('photo') + '</span>'; if (v.indexOf('icon:') === 0) return '<span class="hs-ic ' + (cls || '') + '">' + i(v.slice(5)) + '</span>'; return '<img class="hs-img ' + (cls || '') + '" src="' + v + '" alt="">'; }
function hsChanged(text) { DB.log('Changed', 'Website settings', '', text); emit('data', { coll: 'home', op: 'update' }); }
function hsHeroArt(b) { var c = siteCars(b)[0] || b.data.cars[0]; return '<div class="hs-hero-art">' + (c ? carSVG(c.color, c.shape, { label: carName(c) }) : '') + '</div>'; }

/* Add / Edit Brand Logo, Add / Edit Social Button */
function hsItemDialog(kind, it) {
  var d = D(), list = kind === 'logo' ? d.home.logos : d.home.socials, isNew = !it, next = Math.max.apply(0, [0].concat(list.map(function (x) { return x.order; }))) + 1;
  var st = { img: it ? (kind === 'logo' ? it.img : it.logo) : null, err: '' };
  var title = (isNew ? 'Add ' : 'Edit ') + (kind === 'logo' ? 'Brand Logo' : 'Social Button');
  var dl = UI.dialog({ title: title, width: 'md',
    body: function (el) {
      var v = st.v || { name: it ? it.name : '', link: it && it.link || 'https://', order: it ? it.order : next, active: it ? it.active : true };
      el.innerHTML = '<div class="col gap16"><div class="row wrap gap12 hs-up">' + hsLogoHtml(st.img, 'hs-big') + '<div class="col gap6"><div class="t1c">' + (kind === 'logo' ? 'Image' : 'Logo') + ' <span class="ui-req">*</span></div><div class="row wrap gap8"><label class="btn o sm">' + i('upload') + (st.img && st.img.indexOf('icon:') ? 'Replace' : 'Upload') + '<input type="file" accept="image/*" data-hs-up hidden></label>' + (st.img ? UI.btn('Remove', { kind: 't', size: 'sm', icon: 'trash', attrs: { 'data-hs-rm': '1' } }) : '') + '</div>' +
        (kind === 'social' ? '<div class="inp hs-iconsel"><select data-hs-icon aria-label="Or use a built-in icon"><option value="">Or use a built-in icon</option>' + U_opts(HS_ICONS, st.img) + '</select></div>' : '') + (st.err ? '<span class="ui-err">' + esc(st.err) + '</span>' : '') + '</div></div>' +
        UI.input({ key: 'name', label: 'Name', required: true, value: v.name, maxlength: 60 }) +
        (kind === 'social' ? UI.input({ key: 'link', label: 'Link', required: true, value: v.link, placeholder: 'https://...' }) : '') +
        UI.input({ key: 'order', label: 'Order', type: 'number', min: 1, value: v.order }) +
        (kind === 'social' ? UI.switch({ key: 'active', label: 'Active', checked: v.active, help: 'Only active buttons show on the website.' }) : '') + '<p class="ui-err hs-err" hidden></p></div>';
      var keep = function () { st.v = UI.form(el); st.v.link = st.v.link || ''; };
      el.querySelector('[data-hs-up]').addEventListener('change', function (ev) { var f = ev.target.files[0]; if (!f) return; keep(); UI.readImage(f, { max: 400 }).then(function (r) { st.img = r.dataUrl; st.err = ''; dl.refresh(); }); });
      var rm = el.querySelector('[data-hs-rm]'); if (rm) rm.addEventListener('click', function () { keep(); st.img = null; dl.refresh(); });
      var sel = el.querySelector('[data-hs-icon]'); if (sel) sel.addEventListener('change', function () { keep(); if (sel.value) { st.img = sel.value; st.err = ''; if (!st.v.name) st.v.name = HS_ICONS.filter(function (x) { return x[0] === sel.value; })[0][1]; } dl.refresh(); });
    },
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Save', icon: 'check', onClick: function (x) {
      var v = UI.form(x.body), er = x.body.querySelector('.hs-err');
      if (!st.img) { st.v = v; st.err = 'Image is required'; x.refresh(); return false; }
      if (!v.name.trim()) { er.textContent = 'Name is required'; er.hidden = false; return false; }
      if (kind === 'social' && !/^https?:\/\/[^\s.]+\.[^\s]+/.test(v.link.trim())) { er.textContent = 'Type the full link, starting with https://'; er.hidden = false; return false; }
      var rec = { name: v.name.trim(), order: Math.max(1, Math.round(v.order || next)) };
      if (kind === 'logo') rec.img = st.img; else { rec.logo = st.img; rec.link = v.link.trim(); rec.active = v.active; }
      if (isNew) { rec.id = (kind === 'logo' ? 'logo-' : 'soc-') + Date.now().toString(36); list.push(rec); } else Object.assign(it, rec);
      list.sort(function (a, b) { return a.order - b.order; });
      hsChanged(me().name + (isNew ? ' added ' : ' changed ') + (kind === 'logo' ? 'brand logo ' : 'social button ') + rec.name);
      UI.toast((kind === 'logo' ? 'Brand logo' : 'Social button') + ' saved.');
    } }] });
  return dl;
}
function U_opts(opts, v) { return UI.options(opts, v); }
function hsDelete(kind, it) {
  UI.confirm({ title: kind === 'logo' ? 'Delete Brand Logo?' : 'Delete Social Button?', text: 'This action cannot be undone.', ok: 'Yes, Delete', danger: true }).then(function (y) {
    if (!y) return; var list = kind === 'logo' ? D().home.logos : D().home.socials; list.splice(list.indexOf(it), 1);
    hsChanged(me().name + ' deleted ' + (kind === 'logo' ? 'brand logo ' : 'social button ') + it.name); UI.toast('Deleted.');
  });
}

PAGES['home-settings'] = {
  title: 'Home Settings',
  render: function (root, ctx) {
    var d = ctx.data, b = ctx.brand, h = d.home, ed = ctx.can('home_settings.edit'), st = ctx.state;
    var hero = '<div class="hs-hero">' + (h.hero && h.hero.img ? '<img src="' + h.hero.img + '" alt="Hero image">' : hsHeroArt(b)) + (h.hero && h.hero.img && ed ? '<button type="button" class="ib sm hs-x" data-hs="hero-rm" aria-label="Remove the hero image">' + i('x') + '</button>' : '') + '</div>';
    root.innerHTML = '<div class="pg-h"><div><h1>Home Settings</h1><p>The banner, logos and social links of your website home page. Every website design uses them.</p></div><div class="acts">' + UI.btn('Open the website', { kind: 'o', icon: 'world', attrs: { 'data-hs': 'web' } }) + '</div></div>' +
      (ed ? '' : UI.alert('You can look at the website settings but not change them. That needs "Edit settings" in Website settings.', 'warn', { icon: 'lock' })) +
      '<div class="hs-grid"><div class="card"><div class="card-h"><div><h3>Hero Image</h3><p>The big picture at the top of the home page. ' + (h.hero && h.hero.img ? esc(h.hero.name || '') : 'None uploaded: the website shows your car instead.') + '</p></div></div><div class="card-b">' + hero + '<div class="row wrap gap8 mt16"><label class="btn ' + (ed ? 'c' : 'c disabled') + '"' + (ed ? '' : ' aria-disabled="true"') + '>' + i('upload') + (h.hero && h.hero.img ? 'Replace Image' : 'Upload Image') + '<input type="file" accept="image/*" data-hs-hero hidden' + (ed ? '' : ' disabled') + '></label><span class="b2">A wide picture, at least 1600 pixels across, works best.</span></div></div></div>' +
      '<div class="card"><div class="card-h"><div><h3>Contact Settings</h3><p>The WhatsApp number the website\'s contact and booking messages go to.</p></div></div><div class="card-b"><div class="col gap12">' + UI.input({ key: 'formNumber', label: 'Form Receiving Number', required: true, value: st.num != null ? st.num : h.formNumber, placeholder: '+1234567890', disabled: !ed, help: 'With the country code, e.g. +60 00-111 2040.' }) +
      (st.numMsg ? '<p class="' + (st.numOk ? 'hs-ok' : 'ui-err') + '">' + esc(st.numMsg) + '</p>' : '') + '<div>' + UI.btn('Save Changes', { icon: 'device-floppy', disabled: !ed, attrs: { 'data-hs': 'num' } }) + '</div></div></div></div></div>' +
      '<div class="card mt24"><div class="card-h"><div><h3>Brand Logos</h3><p>The car makes you rent out, shown in a row on the home page.</p></div>' + UI.btn('Add Logo', { icon: 'plus', disabled: !ed, attrs: { 'data-hs': 'logo-add' } }) + '</div><div class="card-b hs-list">' +
      (h.logos.length ? h.logos.slice().sort(function (a, z) { return a.order - z.order; }).map(function (l) { return '<div class="hs-row">' + hsLogoHtml(l.img, 'wide') + '<div class="grow"><div class="t1c fw5">' + esc(l.name) + '</div><div class="b2">Order: ' + l.order + '</div></div>' + UI.iconBtn('edit', 'Edit ' + l.name, { size: 'sm', disabled: !ed, attrs: { 'data-hs-le': l.id } }) + UI.iconBtn('trash', 'Delete ' + l.name, { size: 'sm', disabled: !ed, attrs: { 'data-hs-ld': l.id } }) + '</div>'; }).join('') : UI.empty({ icon: 'photo', title: 'No brand logos', text: 'Add the logos of the car makes you rent out.' })) + '</div></div>' +
      '<div class="card mt24"><div class="card-h"><div><h3>Social Buttons</h3><p>Links to your pages, shown in the website footer.</p></div>' + UI.btn('Add Button', { icon: 'plus', disabled: !ed, attrs: { 'data-hs': 'soc-add' } }) + '</div><div class="card-b hs-list">' +
      (h.socials.length ? h.socials.slice().sort(function (a, z) { return a.order - z.order; }).map(function (s) { return '<div class="hs-row">' + hsLogoHtml(s.logo) + '<div class="grow"><div class="t1c fw5">' + esc(s.name) + ' <span class="b2">· Order: ' + s.order + '</span></div><div class="b2 hs-link">' + esc(s.link) + '</div></div>' + UI.status('active', s.active ? 'Active' : 'Inactive') + UI.iconBtn('edit', 'Edit ' + s.name, { size: 'sm', disabled: !ed, attrs: { 'data-hs-se': s.id } }) + UI.iconBtn('trash', 'Delete ' + s.name, { size: 'sm', disabled: !ed, attrs: { 'data-hs-sd': s.id } }) + '</div>'; }).join('') : UI.empty({ icon: 'link', title: 'No social buttons', text: 'Add your WhatsApp, Instagram or Facebook.' })) + '</div></div>';
    UI.on(root, 'click', '[data-hs]', function (ev, el) {
      var a = el.getAttribute('data-hs');
      if (a === 'web') ctx.go('website');
      else if (a === 'logo-add') hsItemDialog('logo');
      else if (a === 'soc-add') hsItemDialog('social');
      else if (a === 'hero-rm') UI.confirm({ title: 'Remove the hero image?', text: 'The website shows your car picture instead.', ok: 'Remove', danger: true }).then(function (y) { if (y) { h.hero = { name: null, img: null }; hsChanged(me().name + ' removed the hero image'); UI.toast('Hero image removed.'); } });
      else if (a === 'num') {
        var v = root.querySelector('[data-key="formNumber"]').value.trim(); st.num = v;
        if (!/^\+?[0-9][0-9 \-]{6,18}$/.test(v)) { st.numOk = false; st.numMsg = 'Type a phone number with its country code, e.g. +60 00-111 2040.'; ctx.refresh(); return; }
        h.formNumber = v; st.num = null; st.numOk = true; st.numMsg = 'Saved. Website messages now go to ' + v + '.'; hsChanged(me().name + ' changed the form receiving number to ' + v);
      }
    });
    UI.on(root, 'click', '[data-hs-le]', function (ev, el) { hsItemDialog('logo', byId(h.logos, el.getAttribute('data-hs-le'))); });
    UI.on(root, 'click', '[data-hs-ld]', function (ev, el) { hsDelete('logo', byId(h.logos, el.getAttribute('data-hs-ld'))); });
    UI.on(root, 'click', '[data-hs-se]', function (ev, el) { hsItemDialog('social', byId(h.socials, el.getAttribute('data-hs-se'))); });
    UI.on(root, 'click', '[data-hs-sd]', function (ev, el) { hsDelete('social', byId(h.socials, el.getAttribute('data-hs-sd'))); });
    var hf = root.querySelector('[data-hs-hero]');
    hf.addEventListener('change', function () { var f = hf.files[0]; if (!f) return; if (!/^image\//.test(f.type)) { UI.toast('Choose a picture file.', { tone: 'warn' }); return; } UI.readImage(f, { max: 1800 }).then(function (r) { h.hero = { name: r.name, img: r.dataUrl }; hsChanged(me().name + ' uploaded a new hero image'); UI.toast('Hero image saved. The website shows it now.'); }); });
  },
  search: [{ label: 'Add a social button', icon: 'link', keywords: 'instagram facebook whatsapp website', run: function () { if (can('home_settings.edit')) hsItemDialog('social'); } }, { label: 'Add a brand logo', icon: 'photo', keywords: 'website make', run: function () { if (can('home_settings.edit')) hsItemDialog('logo'); } }]
};

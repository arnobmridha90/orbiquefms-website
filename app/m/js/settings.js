/* ---------------- SETTINGS (M9) ----------------
   #settings: company details and bank, our locations (pick-up / drop-off, agents), other places with delivery and return fees,
   damage packages, handover fees (amount for everyone plus 'Different rate for...' per person), card fee, summons admin fee,
   the company signature (drawn with a finger), and for everyone: my start tab and my PIN.
   Only owners (users.manage; billing.settings for money settings) can change company settings; others read only.
   Every change goes to S.settings, so B() and the rest of the app follow at once. */
function stCan(kind) { return can('users.manage') || (kind === 'billing' && can('billing.settings')); }
function stSave(text, changes) { save(); applyTheme(); audit(text, { link: '#settings', changes: changes || null }); }
function stEditBtn(id, kind) { return stCan(kind) ? '<button type="button" class="st-edit" data-st="' + id + '">' + I('edit') + 'Edit</button>' : ''; }
function stSec(title, id, kind, extra) { return '<div class="sec"><h2>' + title + '</h2>' + (extra || '') + (id ? stEditBtn(id, kind) : '') + '</div>'; }
function stRow(k, v) { return '<div class="st-kv"><span>' + k + '</span><b>' + v + '</b></div>'; }
var ST_TABS = [['home', 'Home'], ['bookings', 'Bookings'], ['schedule', 'Schedule'], ['chat', 'Chat']];

VIEWS.settings = function () {
  var b = B(), owner = stCan(), bank = b.bank || {};
  var locs = b.locations || [], places = b.places || [], pk = b.packages || [], hf = b.handoverFees || [];
  var who2 = function (ids) { return (ids || []).map(function (id) { var p = staff(id); return p ? firstName(p.name) : ''; }).filter(Boolean).join(', ') || 'No agent yet'; };
  var html = topbar('Settings', { back: '#more' }) + '<main class="st-main">' +
    (owner ? '' : '<div class="banner blue">' + I('lock') + '<div>Company settings are read only for you. The owner can change them. Your own start tab and PIN are at the bottom.</div></div>') +

    stSec('Company', 'company') + '<div class="card st-card">' + stRow('Name', esc(b.name)) + stRow('Phone', esc(b.phone || '')) + stRow('Registration no.', esc(b.regNo || '')) + stRow('Email', esc(b.email || '')) + stRow('Address', esc(b.address || '')) + '</div>' +
    stSec('Bank details', 'bank', 'billing') + '<div class="card st-card">' + stRow('Bank', esc(bank.name || '')) + stRow('Account name', esc(bank.accName || '')) + stRow('Account no.', '<span class="num">' + esc(bank.accNo || '') + '</span>') + '</div>' +

    stSec('Our locations', '', '', owner ? '<button type="button" class="st-edit" id="stAddLoc">' + I('plus') + 'Add</button>' : '') + '<div class="list">' + locs.map(function (l) {
      return '<button type="button" class="row st-tap" data-loc="' + esc(l.id) + '"' + (owner ? '' : ' disabled') + '>' + I('pin') + '<div class="grow"><div class="t1">' + esc(l.name) + '</div><div class="t2">Agents: ' + esc(who2(l.agents)) + '</div><div class="st-chips">' + chip('Pick-up', l.pickup ? 'green' : 'grey') + chip('Drop-off', l.dropoff ? 'green' : 'grey') + '</div></div>' + (owner ? CHEV : '') + '</button>';
    }).join('') + '</div>' +

    stSec('Other places', '', '', owner ? '<button type="button" class="st-edit" id="stAddPlace">' + I('plus') + 'Add</button>' : '') + '<div class="list st-fees">' +
    '<div class="row st-feehead"><div class="grow"></div><span>Delivery</span><span>Return</span></div>' +
    '<button type="button" class="row st-tap" data-place="client"' + (owner ? '' : ' disabled') + '><div class="grow"><div class="t1">Customer’s address</div><div class="t2">Any address the customer gives</div></div><span class="money">' + rm(b.clientDeliveryFee) + '</span><span class="money">' + rm(b.clientReturnFee) + '</span></button>' +
    places.map(function (p) { return '<button type="button" class="row st-tap" data-place="' + esc(p.id) + '"' + (owner ? '' : ' disabled') + '><div class="grow"><div class="t1">' + esc(p.name) + '</div></div><span class="money">' + rm(p.deliveryFee) + '</span><span class="money">' + rm(p.returnFee) + '</span></button>'; }).join('') + '</div>' +

    stSec('Damage packages', '', '', owner ? '<button type="button" class="st-edit" id="stAddPkg">' + I('plus') + 'Add</button>' : '') + '<div class="list st-fees">' +
    '<div class="row st-feehead"><div class="grow"></div><span>Per day</span><span>Max</span></div>' +
    pk.map(function (p) { return '<button type="button" class="row st-tap" data-pkg="' + esc(p.id) + '"' + (owner ? '' : ' disabled') + '><div class="grow"><div class="t1">' + esc(p.name) + '</div>' + (p.default ? '<div class="st-chips">' + chip('Picked first', 'blue') + '</div>' : '') + '</div><span class="money">' + rm(p.daily) + '</span><span class="money">' + rm(p.max) + '</span></button>'; }).join('') + '</div>' +

    stSec('Handover fees') + '<p class="small muted st-lead">What field staff earn for each trip.' + (owner ? ' Tap one to change it or give someone a different rate.' : '') + '</p>' +
    [['delivery', 'Pick-ups and deliveries'], ['return', 'Returns and drop-offs'], ['companion', 'Companion']].map(function (g) {
      var rows = hf.filter(function (f) { return (f.group || f.feeGroup) === g[0]; }); if (!rows.length) return '';
      return '<div class="st-sub">' + g[1] + '</div><div class="list">' + rows.map(function (f) {
        /* personal rates: the owner sees everyone's, others only their own */
        var rs = Object.keys(f.rates || {}).filter(function (id) { return staff(id) && (owner || id === S.me); });
        return '<button type="button" class="row st-tap" data-fee="' + esc(f.kind) + '"' + (owner ? '' : ' disabled') + '><div class="grow"><div class="t1 st-wrap">' + esc(f.kind) + '</div>' + (rs.length ? '<div class="st-chips">' + rs.map(function (id) { return chip((id === S.me && !owner ? 'Your rate' : firstName(staff(id).name)) + ' ' + rm(f.rates[id]), 'amber'); }).join('') + '</div>' : '') + '</div><span class="money st-amt">' + rm(f.amount) + '</span></button>';
      }).join('') + '</div>';
    }).join('') +

    stSec('Fees', 'fees', 'billing') + '<div class="card st-card">' + stRow('Card fee', esc((b.cardFee || {}).pct || 0) + '% + ' + rm((b.cardFee || {}).fixed || 0)) + stRow('Summons admin fee', rm(b.summonsAdminFee)) + '</div>' +

    stSec('Company signature', '', '', owner ? '<button type="button" class="st-edit" id="stSig">' + I('edit') + (b.signature ? 'Redraw' : 'Draw') + '</button>' : '') +
    '<div class="card st-sigcard">' + (b.signature ? '<img src="' + imgSrc(b.signature) + '" alt="Company signature">' : '<div class="small muted">No signature yet. ' + (owner ? 'Draw it with your finger; it goes on agreements, invoices and receipts.' : 'The owner can add one.') + '</div>') + '</div>' +

    '<div class="sec"><h2>Just for me</h2></div><div class="card st-card st-me"><div class="st-mek">Start tab</div><p class="small muted">The screen ' + esc(firstName(myName())) + ' sees first when the app opens.</p>' +
    '<div class="seg" id="stTab">' + ST_TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + ((S.prefs.startTab || 'home') === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
    '<div class="st-mek">PIN to reopen</div><p class="small muted">' + (S.prefs.pin ? 'On. The app asks for your 4-digit PIN when it opens.' : 'Off. Add a 4-digit PIN to open the app quickly and keep it private.') + '</p>' +
    '<div class="btnrow">' + (S.prefs.pin ? '<button type="button" class="btn ghost sm" id="stPin">Change PIN</button><button type="button" class="btn ghost sm" id="stPinOff">Remove PIN</button>' : '<button type="button" class="btn ghost sm" id="stPin">' + I('lock') + 'Set a PIN</button>') + '</div></div>' +
    '<p class="demo-note">Changes save on this phone and show across the app at once.</p></main>';
  return { html: html, keepScroll: true, after: function () {
    $$('[data-st]').forEach(function (el) { el.onclick = function () { ({ company: stCompany, bank: stBank, fees: stFees })[el.dataset.st](); }; });
    $$('[data-loc]').forEach(function (el) { el.onclick = function () { stLocation(el.dataset.loc); }; });
    $$('[data-place]').forEach(function (el) { el.onclick = function () { stPlace(el.dataset.place); }; });
    $$('[data-pkg]').forEach(function (el) { el.onclick = function () { stPackage(el.dataset.pkg); }; });
    $$('[data-fee]').forEach(function (el) { el.onclick = function () { stFee(el.dataset.fee); }; });
    var a; if ((a = $('#stAddLoc'))) a.onclick = function () { stLocation(null); };
    if ((a = $('#stAddPlace'))) a.onclick = function () { stPlace(null); };
    if ((a = $('#stAddPkg'))) a.onclick = function () { stPackage(null); };
    if ((a = $('#stSig'))) a.onclick = stSignature;
    $$('#stTab button').forEach(function (el) { el.onclick = function () { S.prefs.startTab = el.dataset.tab; save(); render(false, true); say('The app will open on ' + el.textContent); }; });
    $('#stPin').onclick = function () { pinSet(function () { render(false, true); }); };
    if ((a = $('#stPinOff'))) a.onclick = function () { confirm({ title: 'Remove your PIN?', text: 'The app will open without asking for it.', ok: 'Remove PIN' }).then(function (ok) { if (ok) { delete S.prefs.pin; save(); render(false, true); say('PIN removed'); } }); };
  } };
};

/* ---- a small form sheet: fields [{k, label, v, type ('text','tel','email','money','pct','sw'), hint, req}] ---- */
function stForm(title, sub, fields, onSave, opts) {
  opts = opts || {};
  var f = function (x) {
    if (x.type === 'sw') return '<label class="st-swrow"><span class="grow"><b>' + esc(x.label) + '</b>' + (x.hint ? '<small>' + esc(x.hint) + '</small>' : '') + '</span><span class="sw"><input type="checkbox" data-k="' + x.k + '"' + (x.v ? ' checked' : '') + '><i></i></span></label>';
    var inp = '<input class="inp" data-k="' + x.k + '" value="' + esc(x.type === 'money' ? money2(x.v) : x.v == null ? '' : x.v) + '"' + (x.type === 'money' || x.type === 'pct' ? ' inputmode="decimal"' : x.type === 'tel' ? ' type="tel" inputmode="tel"' : x.type === 'email' ? ' type="email" inputmode="email"' : '') + ' autocomplete="off">';
    if (x.type === 'money') inp = '<div class="rmfield">' + inp + '</div>';
    if (x.type === 'pct') inp = '<div class="st-pct">' + inp + '<i>%</i></div>';
    return '<label class="field"><span>' + esc(x.label) + '</span>' + inp + (x.hint ? '<span class="hint">' + esc(x.hint) + '</span>' : '') + '<span class="err" data-err="' + x.k + '"></span></label>';
  };
  sheet(sheetHead(title, sub) + (opts.top || '') + fields.map(f).join('') + (opts.extra || '') +
    '<div class="sheet-foot' + (opts.del ? ' stack' : '') + '"><button type="button" class="btn" id="stfSave">Save</button>' + (opts.del ? '<button type="button" class="btn link red" id="stfDel">' + esc(opts.del) + '</button>' : '') + '</div>', function (sh) {
      if (opts.after) opts.after(sh);
      $('#stfSave', sh).onclick = function () {
        var out = {}, bad = false;
        fields.forEach(function (x) {
          var el = $('[data-k="' + x.k + '"]', sh), e = $('[data-err="' + x.k + '"]', sh); if (e) e.textContent = '';
          if (x.type === 'sw') { out[x.k] = el.checked; return; }
          var v = el.value.trim();
          if (x.type === 'money' || x.type === 'pct') { var n = parseMoney(v === '' ? '0' : v); if (isNaN(n)) { e.textContent = 'Type an amount like 25 or 25.50'; bad = true; el.classList.add('bad'); return; } if (x.type === 'pct' && n > 20) { e.textContent = 'Card fees above 20% look wrong'; bad = true; return; } el.classList.remove('bad'); out[x.k] = n; return; }
          if (x.req && !v) { e.textContent = 'This cannot be empty'; bad = true; el.classList.add('bad'); return; }
          out[x.k] = v;
        });
        if (bad) return;
        if (onSave(out, sh) !== false) { closeSheet(); render(false, true); }
      };
      var d = $('#stfDel', sh); if (d) d.onclick = function () { opts.onDel(); };
    });
}
function stDiff(old, nw, labels) { var ch = {}; Object.keys(nw).forEach(function (k) { var a = old[k], b = nw[k]; if (String(a == null ? '' : a) !== String(b == null ? '' : b)) ch[labels[k] || k] = [typeof a === 'number' && /fee|rate|amount|daily|max/i.test(k) ? rm(a) : a, typeof b === 'number' && /fee|rate|amount|daily|max/i.test(k) ? rm(b) : b]; }); return ch; }

function stCompany() {
  var s = S.settings;
  stForm('Company details', 'Shown on agreements, invoices and messages', [{ k: 'name', label: 'Company name', v: B().name, req: true }, { k: 'phone', label: 'Phone', v: s.phone, type: 'tel' }, { k: 'regNo', label: 'Registration no.', v: s.regNo }, { k: 'email', label: 'Email', v: s.email, type: 'email' }, { k: 'address', label: 'Address', v: s.address }],
    function (v) { var ch = stDiff({ name: B().name, phone: s.phone, regNo: s.regNo, email: s.email, address: s.address }, v, { regNo: 'registration no.' }); if (!Object.keys(ch).length) return; Object.assign(s, v); stSave('Company details changed', ch); say('Company details saved'); });
}
function stBank() {
  var bk0 = S.settings.bank || {};
  stForm('Bank details', 'Customers pay into this account', [{ k: 'name', label: 'Bank', v: bk0.name, req: true }, { k: 'accName', label: 'Account name', v: bk0.accName, req: true }, { k: 'accNo', label: 'Account no.', v: bk0.accNo, req: true }],
    function (v) { var ch = stDiff(bk0, v, { accName: 'account name', accNo: 'account no.' }); if (!Object.keys(ch).length) return; S.settings.bank = Object.assign({}, bk0, v); stSave('Bank details changed', ch); say('Bank details saved'); });
}
function stFees() {
  var cf = S.settings.cardFee || { pct: 0, fixed: 0 };
  stForm('Fees', '', [{ k: 'pct', label: 'Card fee (percent)', v: cf.pct, type: 'pct', hint: 'Added when a customer pays by card' }, { k: 'fixed', label: 'Card fee (fixed amount)', v: cf.fixed, type: 'money' }, { k: 'summonsAdminFee', label: 'Summons admin fee', v: S.settings.summonsAdminFee, type: 'money', hint: 'Added on top when a summons is charged to the customer' }],
    function (v) {
      var ch = {}; if (v.pct !== +cf.pct || v.fixed !== +cf.fixed) ch['card fee'] = [cf.pct + '% + ' + rm(cf.fixed), v.pct + '% + ' + rm(v.fixed)]; if (v.summonsAdminFee !== +S.settings.summonsAdminFee) ch['summons admin fee'] = [rm(S.settings.summonsAdminFee), rm(v.summonsAdminFee)];
      if (!Object.keys(ch).length) return; S.settings.cardFee = { pct: v.pct, fixed: v.fixed }; S.settings.summonsAdminFee = v.summonsAdminFee; stSave('Fees changed', ch); say('Fees saved');
    });
}
function stLocation(id) {
  var list = S.settings.locations = S.settings.locations || [], l = id ? byId(list, id) : null, agents = l ? (l.agents || []).slice() : [];
  var chipsHtml = function () { return agents.length ? agents.map(function (a) { var p = staff(a); return p ? '<span class="chip tone-blue">' + esc(p.name) + '</span>' : ''; }).join('') : '<span class="small muted">Nobody yet</span>'; };
  stForm(l ? 'Edit location' : 'Add location', 'One of your own offices or counters', [{ k: 'name', label: 'Name', v: l ? l.name : '', req: true }, { k: 'short', label: 'Short name', v: l ? l.short : '', req: true, hint: 'Used in lists, like “Cheras”' }, { k: 'pickup', label: 'Customers can pick up here', v: l ? l.pickup : true, type: 'sw' }, { k: 'dropoff', label: 'Customers can drop off here', v: l ? l.dropoff : true, type: 'sw' }],
    function (v) {
      if (l) { var ch = stDiff(l, v, { pickup: 'pick-up', dropoff: 'drop-off' }); var oa = (l.agents || []).join(','); Object.assign(l, v); l.agents = agents; if (oa !== agents.join(',')) ch.agents = [oa.split(',').filter(Boolean).map(who).join(', '), agents.map(who).join(', ')]; if (!Object.keys(ch).length) return; stSave('Location changed: ' + l.name, ch); }
      else { var n = 1; while (byId(list, 'L' + n)) n++; var nl = Object.assign({ id: 'L' + n, agents: agents }, v); list.push(nl); stHandoverForLoc(nl); stSave('Location added: ' + nl.name); }
      say('Location saved');
    }, { extra: '<div class="field"><span>Agents here</span><div class="st-chips st-agents" id="stAg">' + chipsHtml() + '</div><button type="button" class="btn ghost sm" id="stAgPick">' + I('users') + 'Choose agents</button></div>',
      after: function (sh) { $('#stAgPick', sh).onclick = function () { Pickers.staff({ multi: true, selected: agents, title: 'Agents at this location', onPick: function (ps) { agents = ps.map(function (p) { return p.id; }); $('#stAg', sh).innerHTML = chipsHtml(); } }); }; } });
}
function stHandoverForLoc(l) {
  var hf = S.settings.handoverFees = S.settings.handoverFees || [];
  if (l.pickup) hf.push({ kind: 'Pick-up from our location, ' + l.short, group: 'delivery', amount: 10, rates: {} });
  if (l.dropoff) hf.push({ kind: 'Drop-off at our location, ' + l.short, group: 'return', amount: 10, rates: {} });
}
function stPlace(id) {
  var s = S.settings;
  if (id === 'client') return stForm('Customer’s address', 'Charged when you deliver to or collect from an address the customer gives', [{ k: 'clientDeliveryFee', label: 'Delivery charge', v: s.clientDeliveryFee, type: 'money' }, { k: 'clientReturnFee', label: 'Return charge', v: s.clientReturnFee, type: 'money' }],
    function (v) { var ch = stDiff({ clientDeliveryFee: s.clientDeliveryFee, clientReturnFee: s.clientReturnFee }, v, { clientDeliveryFee: 'delivery charge', clientReturnFee: 'return charge' }); if (!Object.keys(ch).length) return; Object.assign(s, v); stSave('Customer address charges changed', ch); say('Saved'); });
  var list = s.places = s.places || [], p = id ? byId(list, id) : null;
  var used = p ? S.bookings.filter(function (b) { return b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Completed' && ((b.pickKind === 'place' && b.pickLoc === p.id) || (b.retKind === 'place' && b.retLoc === p.id)); }).length : 0;
  stForm(p ? 'Edit place' : 'Add place', 'An airport, station or hotel you deliver to', [{ k: 'name', label: 'Name', v: p ? p.name : '', req: true }, { k: 'deliveryFee', label: 'Delivery charge', v: p ? p.deliveryFee : 0, type: 'money' }, { k: 'returnFee', label: 'Return charge', v: p ? p.returnFee : 0, type: 'money' }],
    function (v) {
      if (p) { var ch = stDiff(p, v, { deliveryFee: 'delivery charge', returnFee: 'return charge' }); if (!Object.keys(ch).length) return; var oldName = p.name; Object.assign(p, v); if (oldName !== p.name) (s.handoverFees || []).forEach(function (f) { f.kind = f.kind.replace('Delivery to ' + oldName, 'Delivery to ' + p.name).replace('Return from ' + oldName, 'Return from ' + p.name); }); stSave('Place changed: ' + p.name, ch); }
      else { var n = 1; while (byId(list, 'P' + n)) n++; var np = Object.assign({ id: 'P' + n }, v); list.push(np); var hf = s.handoverFees = s.handoverFees || []; hf.push({ kind: 'Delivery to ' + np.name, group: 'delivery', amount: Math.max(20, np.deliveryFee / 2), rates: {} }); hf.push({ kind: 'Return from ' + np.name, group: 'return', amount: Math.max(20, np.returnFee / 2), rates: {} }); stSave('Place added: ' + np.name); }
      say('Place saved');
    }, p ? { del: 'Remove this place', onDel: function () {
      if (used) { confirm({ icon: 'warn', title: 'This place is in use', text: used + (used === 1 ? ' open booking uses' : ' open bookings use') + ' ' + p.name + '. Change those bookings first, then remove it.', ok: 'OK', cancel: 'Close' }); return; }
      confirm({ icon: 'warn', title: 'Remove ' + p.name + '?', text: 'It will not be offered for new bookings. Past bookings keep their place.', ok: 'Remove', danger: true }).then(function (ok) {
        if (!ok) return; var i = list.indexOf(p), hfOld = (s.handoverFees || []).slice(); list.splice(i, 1); s.handoverFees = hfOld.filter(function (f) { return f.kind !== 'Delivery to ' + p.name && f.kind !== 'Return from ' + p.name; }); stSave('Place removed: ' + p.name); closeAllSheets(); render(false, true);
        undoSnack(p.name + ' removed', function () { list.splice(i, 0, p); s.handoverFees = hfOld; stSave('Place put back: ' + p.name); render(false, true); });
      });
    } } : null);
}
function stPackage(id) {
  var list = S.settings.packages = S.settings.packages || [], p = id ? byId(list, id) : null;
  stForm(p ? 'Edit damage package' : 'Add damage package', 'Cover the customer can pick, charged per day', [{ k: 'name', label: 'Name', v: p ? p.name : '', req: true }, { k: 'daily', label: 'Price per day', v: p ? p.daily : 0, type: 'money' }, { k: 'max', label: 'Most the customer pays for damage', v: p ? p.max : 0, type: 'money' }, { k: 'default', label: 'Pick this one first on new bookings', v: p ? !!p.default : !list.length, type: 'sw' }],
    function (v) {
      if (v.default) list.forEach(function (x) { if (x !== p) delete x.default; });
      if (p) { var ch = stDiff({ name: p.name, daily: p.daily, max: p.max }, { name: v.name, daily: v.daily, max: v.max }, { daily: 'per day', max: 'max' }); p.name = v.name; p.daily = v.daily; p.max = v.max; if (v.default) p.default = true; else delete p.default; stSave('Damage package changed: ' + p.name, ch); }
      else { var n = 1; while (byId(list, 'K' + n)) n++; var np = { id: 'K' + n, name: v.name, daily: v.daily, max: v.max }; if (v.default) np.default = true; list.push(np); stSave('Damage package added: ' + np.name); }
      say('Package saved');
    }, p && list.length > 1 ? { del: 'Remove this package', onDel: function () {
      confirm({ icon: 'warn', title: 'Remove ' + p.name + '?', text: 'It will not be offered on new bookings. Bookings that have it keep it.', ok: 'Remove', danger: true }).then(function (ok) {
        if (!ok) return; var i = list.indexOf(p); list.splice(i, 1); if (p.default && list[0]) list[0].default = true; stSave('Damage package removed: ' + p.name); closeAllSheets(); render(false, true);
        undoSnack(p.name + ' removed', function () { list.splice(i, 0, p); stSave('Damage package put back: ' + p.name); render(false, true); });
      });
    } } : null);
}
function stFee(kind) {
  var f = (S.settings.handoverFees || []).filter(function (x) { return x.kind === kind; })[0]; if (!f) return;
  var rates = Object.assign({}, f.rates || {});
  Object.keys(rates).forEach(function (id) { if (!staff(id)) delete rates[id]; });
  var rateRows = function () {
    var ids = Object.keys(rates);
    return ids.length ? ids.map(function (id) { var p = staff(id); return '<div class="st-rate"><div class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</div><span class="grow">' + esc(p.name) + '</span><div class="rmfield st-rateinp"><input class="inp" inputmode="decimal" data-rate="' + id + '" value="' + money2(rates[id]) + '"></div><button type="button" class="iconbtn" data-rmrate="' + id + '" aria-label="Remove">' + I('x', 2.2) + '</button></div>'; }).join('') : '<p class="small muted">Everyone gets the same amount.</p>';
  };
  stForm('Handover fee', kind, [{ k: 'amount', label: 'Amount for everyone', v: f.amount, type: 'money' }],
    function (v, sh) {
      var bad = false;
      $$('[data-rate]', sh).forEach(function (el) { var n = parseMoney(el.value); if (isNaN(n)) { el.classList.add('bad'); bad = true; } else rates[el.dataset.rate] = n; });
      if (bad) { say('Check the amounts in red'); return false; }
      var ch = {}; if (v.amount !== +f.amount) ch.amount = [rm(f.amount), rm(v.amount)];
      var allIds = {}; Object.keys(f.rates || {}).concat(Object.keys(rates)).forEach(function (id) { allIds[id] = 1; });
      Object.keys(allIds).forEach(function (id) { var a = (f.rates || {})[id], b2 = rates[id]; if (a !== b2) ch[who(id)] = [a == null ? 'Same as everyone' : rm(a), b2 == null ? 'Same as everyone' : rm(b2)]; });
      if (!Object.keys(ch).length) return;
      f.amount = v.amount; f.rates = rates; stSave('Handover fee changed: ' + kind, ch); say('Handover fee saved');
    }, { extra: '<div class="field"><span>Different rate for…</span><div id="stRates">' + rateRows() + '</div><button type="button" class="btn ghost sm" id="stRateAdd">' + I('plus') + 'Add a person</button></div>',
      after: function (sh) {
        function wire() {
          $$('[data-rmrate]', sh).forEach(function (b) { b.onclick = function () { keepTyped(); delete rates[b.dataset.rmrate]; $('#stRates', sh).innerHTML = rateRows(); wire(); }; });
        }
        function keepTyped() { $$('[data-rate]', sh).forEach(function (el) { var n = parseMoney(el.value); if (!isNaN(n)) rates[el.dataset.rate] = n; }); }
        wire();
        $('#stRateAdd', sh).onclick = function () {
          keepTyped();
          Pickers.staff({ title: 'Different rate for', onPick: function (p) {
            if (!p) return; if (rates[p.id] == null) rates[p.id] = +f.amount || 0; $('#stRates', sh).innerHTML = rateRows(); wire(); var el = $('[data-rate="' + p.id + '"]', sh); if (el) { el.focus(); el.select(); }
          } });
        };
      } });
}

/* ---- signature drawn with a finger ---- */
function stSignature() {
  var sh = sheet(sheetHead('Company signature', 'Sign inside the box with your finger') + '<div class="st-sigpad"><canvas id="sigCv"></canvas><div class="st-sigline"></div><span class="st-sighint" id="sigHint">Sign here</span></div>' +
    '<div class="btnrow" style="margin-top:10px"><button type="button" class="btn ghost sm" id="sigClear">' + I('reset') + 'Clear</button></div>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="sigSave" disabled>Save signature</button></div>', function (sh) {
      var cv = $('#sigCv', sh), box = cv.parentNode, ctx, drawn = false, last = null, ratio = 2;
      function size() { var w = box.clientWidth, h = box.clientHeight; cv.width = w * ratio; cv.height = h * ratio; cv.style.width = w + 'px'; cv.style.height = h + 'px'; ctx = cv.getContext('2d'); ctx.scale(ratio, ratio); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14213D'; ctx.lineWidth = 2.6; }
      setTimeout(size, 30);
      function pt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); last = pt(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#14213D'; ctx.fill(); mark(); });
      cv.addEventListener('pointermove', function (e) { if (!last) return; var p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; mark(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { last = null; }); });
      function mark() { if (!drawn) { drawn = true; $('#sigHint', sh).style.display = 'none'; $('#sigSave', sh).disabled = false; } }
      $('#sigClear', sh).onclick = function () { ctx.clearRect(0, 0, cv.width, cv.height); drawn = false; $('#sigHint', sh).style.display = ''; $('#sigSave', sh).disabled = true; };
      $('#sigSave', sh).onclick = function () {
        /* keep it small: copy to a 480 px wide canvas */
        var out = document.createElement('canvas'), w = 480, h = Math.round(w * cv.height / cv.width); out.width = w; out.height = h; out.getContext('2d').drawImage(cv, 0, 0, w, h);
        var had = !!S.settings.signature; S.settings.signature = out.toDataURL('image/png'); stSave(had ? 'Company signature redrawn' : 'Company signature added'); closeSheet(); render(false, true); say('Signature saved');
      };
    }, { noSwipe: true });
  return sh;
}

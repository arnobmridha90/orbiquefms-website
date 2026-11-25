/* ---------------- ACTIVITY (M9) ----------------
   #activity (users.view_audit): newest first, from booking logs (b.log) and S.audit (written by audit() and bLog()).
   Filters: person, from / to, search for a booking number or a name. A row with field changes opens to show old (struck through) and new;
   money values stay hidden without money access. #activity?p=<staffId> opens with a person picked.
   actList(staffId, n), actRowHtml(item), actWire() are used by the person page in team.js. */
var ACT = { p: '', from: '', to: '', q: '', n: 40, open: {} };
VIEW_STATE.push(function () { ACT = { p: '', from: '', to: '', q: '', n: 40, open: {} }; });

/* made-up history with field changes, so the expand view has something to show */
SEEDERS.push({ key: 'm9Audit', fn: function (d, x) {
  d.m9Audit = 1; d.audit = d.audit || [];
  var now = Date.now(), st = d.staff || [], id = function (k) { return (st[k] || st[0]).id; };
  var bks = (d.bookings || []).filter(function (b) { return new Date(b.created) < new Date(now - 2 * DAY) && b.bookingStatus !== 'Cancelled'; }).slice(-12);
  var plate = function (cid) { var c = byId(d.cars, cid); return c ? c.plate : ''; };
  var at = function (h) { return new Date(now - h * HOUR).toISOString(); };
  var add = function (h, by, text, o) { o = o || {}; d.audit.push({ id: uid(), at: at(h), by: by, text: text, booking: o.booking || null, cust: o.cust || null, car: o.car || null, changes: o.changes || null, link: o.link || (o.booking ? '#booking/' + o.booking : null) }); };
  var b0 = bks[0], b1 = bks[1], b2 = bks[2], b3 = bks[3], b4 = bks[4];
  if (b0) add(3, id(2), 'Return time changed', { booking: b0.id, changes: { 'return': [when(new Date(new Date(b0.end).getTime() - 2 * HOUR)), when(b0.end)] } });
  if (b1) add(7, id(1), 'Discount given', { booking: b1.id, changes: { discount: [rm(0), rm(20)] } });
  if (b2) add(26, id(0), 'Daily rate changed', { booking: b2.id, changes: { 'daily rate': [rm((b2.rates || {}).daily + 10 || 150), rm((b2.rates || {}).daily || 140)] } });
  var other = (d.cars || []).filter(function (c) { return b3 && c.id !== b3.car && c.status === 'active'; })[0];
  if (b3 && other) add(30, id(2), 'Car changed', { booking: b3.id, changes: { car: [plate(other.id), plate(b3.car)] } });
  if (b4) add(52, id(2), 'Pick-up place changed', { booking: b4.id, changes: { 'pick-up': ['Our office', 'Customer address'] , 'delivery charge': [rm(0), rm(x.B.clientDeliveryFee || 50)] } });
  var cu = (d.customers || [])[3];
  if (cu) add(75, id(2), 'Customer details changed: ' + cu.name, { cust: cu.id, link: '#customer/' + cu.id, changes: { email: ['', cu.email || 'new email'], 'licence expiry': ['2026-03-01', cu.licenceExp || '2028-03-01'] } });
  add(98, id(0), 'Handover fee changed: Delivery to client', { link: '#settings', changes: { amount: [rm(25), rm(30)] } });
  add(140, id(0), 'Card fee changed', { link: '#settings', changes: { 'card fee': ['3% + ' + rm(1), '4% + ' + rm(1)] } });
  var off = st.filter(function (p) { return p.hasLogin && !p.loginActive; })[0];
  if (off) add(170, id(0), off.name + '’s login switched off', { link: '#person/' + off.id, changes: { login: ['On', 'Off'] } });
  if (st[5]) add(210, id(0), st[5].name + '’s role changed', { link: '#person/' + st[5].id, changes: { role: ['Read-only', roleName(st[5].role)] } });
  var c7 = (d.cars || [])[6];
  if (c7) add(260, id(6) || id(1), 'Car details changed: ' + c7.plate, { car: c7.id, link: '#car/' + c7.id, changes: { 'daily rate': [rm(c7.rate - 10), rm(c7.rate)], colour: ['Silver', c7.color] } });
  d.audit.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
} });

var ACT_MONEY = /rate|discount|deposit|amount|fee|price|paid|total|cost|charge|refund|balance/i;
function actHideMoney(k, v) { return !(can('bookings.see_amounts') || can('billing.view')) && (ACT_MONEY.test(k) || /RM\s?\d/.test(String(v))); }
/* every entry, newest first; booking logs and the audit list are merged without doubles */
function actAll() {
  var now = Date.now(), seen = {}, out = [];
  var push = function (e) {
    var t = new Date(e.at).getTime(); if (!(t <= now + MIN)) return;
    var k = (e.booking || '') + '|' + Math.round(t / 1000) + '|' + e.text; if (seen[k]) return; seen[k] = 1; out.push(e);
  };
  (S.audit || []).forEach(function (a) { push({ id: a.id, at: a.at, by: a.by, text: a.text, booking: a.booking, cust: a.cust, car: a.car, changes: a.changes, link: a.link }); });
  S.bookings.forEach(function (b) { (b.log || []).forEach(function (l, i) { push({ id: b.id + '-' + i, at: l.at, by: l.by, text: l.text, booking: b.id, changes: l.changes, link: '#booking/' + b.id }); }); });
  return out.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
}
function actWhere(e) {
  var b = e.booking ? bk(e.booking) : null;
  if (b) return b.code + ' · ' + cust(b.cust).name;
  if (e.cust) return cust(e.cust).name;
  if (e.car) { var c = car(e.car); return c ? c.plate : 'Car'; }
  if (/^#person/.test(e.link || '')) return 'Team';
  if (/^#settings/.test(e.link || '')) return 'Settings';
  return '';
}
function actList(staffId, n) { return actAll().filter(function (e) { return e.by === staffId; }).slice(0, n || 10); }
function actRowHtml(e, noWho) {
  var p = staff(e.by), name = p ? p.name : (e.by || 'System'), where = actWhere(e), ch = e.changes && Object.keys(e.changes).length ? e.changes : null, open = !!ACT.open[e.id];
  var av = p ? '<div class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</div>' : '<div class="av sm act-sys">' + I(e.by === 'Customer' ? 'user' : e.by === 'Website' ? 'link' : 'bot', 2) + '</div>';
  var meta = [noWho ? '' : name, where, ago(e.at) === 'just now' ? 'just now' : dShort(e.at) + ', ' + hm(e.at)].filter(Boolean).join(' · ');
  var body = '<div class="grow"><div class="act-t">' + esc(e.text) + '</div><div class="t2">' + esc(meta) + '</div></div>';
  var html = '<div class="act-row' + (open ? ' open' : '') + '">' +
    (ch ? '<button type="button" class="row act-main" data-act-open="' + esc(e.id) + '" aria-expanded="' + open + '">' + av + body + '<span class="act-n">' + Object.keys(ch).length + '</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg></button>'
      : (e.link ? '<a class="row act-main" href="' + esc(e.link) + '">' + av + body + CHEV + '</a>' : '<div class="row act-main">' + av + body + '</div>'));
  if (ch && open) {
    html += '<div class="act-changes">' + Object.keys(ch).map(function (k) {
      var v = ch[k] || [], hide = actHideMoney(k, v[0]) || actHideMoney(k, v[1]);
      var o = v[0] == null || v[0] === '' ? '<i class="muted">empty</i>' : '<s>' + esc(v[0]) + '</s>', n = v[1] == null || v[1] === '' ? '<i class="muted">empty</i>' : '<b>' + esc(v[1]) + '</b>';
      return '<div class="act-ch"><span class="act-k">' + esc(k.charAt(0).toUpperCase() + k.slice(1)) + '</span><span class="act-v">' + (hide ? '<i class="muted">Hidden</i>' : o + ' <span class="act-arrow">' + I('chev', 2.4) + '</span> ' + n) + '</span></div>';
    }).join('') + (e.link ? '<a class="btn sm ghost act-go" href="' + esc(e.link) + '">Open ' + esc(/^#booking/.test(e.link) ? 'booking' : /^#person/.test(e.link) ? 'person' : /^#settings/.test(e.link) ? 'settings' : /^#car/.test(e.link) ? 'car' : /^#customer/.test(e.link) ? 'customer' : 'it') + '</a>' : '') + '</div>';
  }
  return html + '</div>';
}
function actWire() { $$('[data-act-open]').forEach(function (b) { b.onclick = function () { ACT.open[b.dataset.actOpen] = !ACT.open[b.dataset.actOpen]; render(false, true); }; }); }
function actMatch(e, q) {
  if (!q) return true;
  var b = e.booking ? bk(e.booking) : null;
  if (b && (matchBookingCode(q, b) || wordsMatch(q, cust(b.cust).name) || phoneMatch(q, cust(b.cust).phone))) return true;
  if (e.cust && wordsMatch(q, cust(e.cust).name)) return true;
  /* a plate (with or without the space) finds the car's own entries and everything on its bookings */
  var np = normPlate(q);
  if (np.length >= 3) { var ids = [e.car, b && b.car]; for (var i = 0; i < ids.length; i++) { var c = ids[i] && car(ids[i]); if (c && normPlate(c.plate).indexOf(np) >= 0) return true; } }
  return wordsMatch(q, e.text + ' ' + who(e.by));
}

VIEWS.activity = function (r) {
  if (!can('users.view_audit')) return { html: topbar('Activity', { back: '#more' }) + '<main>' + noAccess('users.view_audit') + '</main>' };
  if (r.q && r.q.p != null && r.q.p !== ACT._fromQ) { ACT.p = r.q.p; ACT._fromQ = r.q.p; ACT.n = 40; }
  var all = actAll(), q = ACT.q.trim();
  var f = ACT.from ? sod(fromInputs(ACT.from, '00:00')).getTime() : -Infinity, t = ACT.to ? sod(fromInputs(ACT.to, '00:00')).getTime() + DAY : Infinity;
  var list = all.filter(function (e) {
    if (ACT.p === 'system' ? !!staff(e.by) : ACT.p && e.by !== ACT.p) return false;
    var tt = new Date(e.at).getTime(); if (tt < f || tt >= t) return false;
    return actMatch(e, q);
  });
  var people = S.staff.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  var shown = list.slice(0, ACT.n), lastDay = '';
  var rows = shown.map(function (e) { var d = dayWord(e.at), sep = d !== lastDay ? '<div class="act-day">' + esc(d === 'Today' || d === 'Yesterday' ? d : dLong(e.at)) + '</div>' : ''; lastDay = d; return sep + actRowHtml(e); }).join('');
  var filtered = ACT.p || ACT.from || ACT.to || q;
  var html = topbar('Activity', { back: '#more', sub: list.length + (list.length === 1 ? ' entry' : ' entries') }) + '<main class="act-main-wrap">' +
    '<label class="search">' + I('search') + '<input id="acQ" type="search" placeholder="Booking, name or plate" value="' + esc(ACT.q) + '" autocomplete="off" enterkeyhint="search"></label>' +
    '<div class="act-filters"><label class="field"><span>Person</span><select class="inp" id="acP"><option value="">Everyone</option>' + people.map(function (p) { return '<option value="' + p.id + '"' + (ACT.p === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '<option value="system"' + (ACT.p === 'system' ? ' selected' : '') + '>Customers, website and system</option></select></label>' +
    '<div class="two"><label class="field"><span>From</span><input class="inp" type="date" id="acF" value="' + esc(ACT.from) + '" max="' + toLocalInput(new Date()) + '"></label><label class="field"><span>To</span><input class="inp" type="date" id="acT" value="' + esc(ACT.to) + '" max="' + toLocalInput(new Date()) + '"></label></div>' +
    (filtered ? '<button type="button" class="btn link act-clear" id="acClear">Clear filters</button>' : '') + '</div>' +
    '<div class="list act-list">' + (rows || '<div class="empty">Nothing matches. Try another name, booking number or dates.</div>') + '</div>' +
    (list.length > shown.length ? '<button type="button" class="btn ghost act-more" id="acMore">Show more (' + (list.length - shown.length) + ' left)</button>' : '') +
    '<p class="small muted act-note">Tap a row with a number to see what changed.' + (can('bookings.see_amounts') || can('billing.view') ? '' : ' Amounts are hidden for your role.') + '</p></main>';
  return { html: html, keepScroll: true, after: function () {
    var i = $('#acQ'), tm = null; i.oninput = function () { ACT.q = i.value; ACT.n = 40; clearTimeout(tm); tm = setTimeout(function () { render(false, true); var j = $('#acQ'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }, 180); };
    $('#acP').onchange = function () { ACT.p = this.value; ACT.n = 40; render(false, true); };
    $('#acF').onchange = function () { ACT.from = this.value; if (ACT.to && ACT.from > ACT.to) ACT.to = ACT.from; render(false, true); };
    $('#acT').onchange = function () { ACT.to = this.value; if (ACT.from && ACT.to < ACT.from) ACT.from = ACT.to; render(false, true); };
    var c = $('#acClear'); if (c) c.onclick = function () { ACT.p = ''; ACT.from = ''; ACT.to = ''; ACT.q = ''; ACT.n = 40; if (route().q.p) replaceHash('#activity'); else render(false, true); };
    var m = $('#acMore'); if (m) m.onclick = function () { ACT.n += 40; render(false, true); };
    actWire();
  } };
};

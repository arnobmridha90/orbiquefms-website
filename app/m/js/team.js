/* ---------------- TEAM (M9) ----------------
   #team: search (name, username, phone), chips Everyone / Logins / Field agents / Switched off, person cards with Call and WhatsApp.
   #person/<id>: contact, emergency contact, documents, role and 'What they can use', open tasks, their activity.
   Actions by permission, never on yourself: switch login off/on, sign out everywhere, reset password, switch agent off/on, change role.
   Add person: a login or a field agent. */
var TEAM = { q: '', f: 'all', open: {} };
VIEW_STATE.push(function () { TEAM = { q: '', f: 'all', open: {} }; });

SEEDERS.push({ key: 'm9Team', fn: function (d, x) {
  d.m9Team = 1;
  (d.staff || []).forEach(function (p, k) {
    if (p.devices == null) p.devices = p.hasLogin && p.loginActive ? 1 + (k % 3) : 0;
    if (!p.docs && k < 6) p.docs = { icFront: 'demo:ic:IC front', icBack: 'demo:ic:IC back', licence: p.isAgent || k === 0 ? 'demo:licence:Driving licence' : null };
    if (!p.joined) p.joined = new Date(Date.now() - (200 + k * 97) * DAY).toISOString();
  });
} });

var AREA_LABEL = { bookings: 'Bookings', billing: 'Invoices and payments', deposits: 'Deposits', customers: 'Customers', customer_notes: 'Customer notes', cars: 'Cars', maintenance: 'Maintenance',
  summons: 'Summons', tracking: 'Where cars are', expenses: 'Expenses', reports: 'Reports', tasks: 'Tasks', users: 'Team and settings', employees: 'Field agents', leads: 'Leads' };
function tmAreas() { var out = {}; Object.keys(CODES).forEach(function (c) { var a = c.split('.')[0]; (out[a] = out[a] || []).push(c); }); return out; }
function tmOff(p) { return (p.hasLogin && !p.loginActive) || (p.isAgent && p.active === false) || (!p.hasLogin && !p.isAgent); }
function tmSeen(p) {
  if (!p.hasLogin) return 'No login';
  if (!p.lastSeen) return 'Never signed in';
  var s = (Date.now() - new Date(p.lastSeen)) / 1000;
  if (s < 45) return 'Signed in just now';
  var m = Math.round(s / 60); if (m < 60) return 'Signed in ' + m + (m === 1 ? ' minute ago' : ' minutes ago');
  var h = Math.round(m / 60); if (h < 24) return 'Signed in ' + h + (h === 1 ? ' hour ago' : ' hours ago');
  var d = Math.round(h / 24); return d < 30 ? 'Signed in ' + d + (d === 1 ? ' day ago' : ' days ago') : 'Signed in ' + dFull(p.lastSeen);
}
function tmChips(p) {
  var out = chip(roleName(p.role), 'blue');
  if (p.isAgent) out += chip('Field agent', p.active === false ? 'grey' : 'emerald');
  if (p.hasLogin) out += chip(p.loginActive ? 'Login' : 'Login switched off', p.loginActive ? 'green' : 'grey');
  else out += chip('No login', 'grey');
  return out;
}
function tmCanSee() { return can('users.view') || can('employees.view'); }
function tmVisible() { return S.staff.filter(function (p) { return can('users.view') || p.isAgent; }); }
function tmTel(p) { return 'tel:+' + normPhone(p.phone); }

VIEWS.team = function () {
  if (!tmCanSee()) return { html: topbar('Team', { back: '#more' }) + '<main>' + noAccess('users.view') + '</main>' };
  var all = tmVisible(), q = TEAM.q.trim();
  var counts = { all: all.length, login: all.filter(function (p) { return p.hasLogin; }).length, agent: all.filter(function (p) { return p.isAgent; }).length, off: all.filter(tmOff).length };
  var list = all.filter(function (p) {
    if (TEAM.f === 'login' && !p.hasLogin) return false; if (TEAM.f === 'agent' && !p.isAgent) return false; if (TEAM.f === 'off' && !tmOff(p)) return false;
    if (!q) return true;
    return wordsMatch(q, p.name + ' ' + (p.username || '') + ' ' + roleName(p.role)) || phoneMatch(q, p.phone) || phoneMatch(q, p.wa);
  }).sort(function (a, b) { return (tmOff(a) - tmOff(b)) || a.name.localeCompare(b.name); });
  var chips = [['all', 'Everyone'], ['login', 'Logins'], ['agent', 'Field agents'], ['off', 'Switched off']].filter(function (c) { return c[0] !== 'login' || can('users.view'); });
  var card = function (p) {
    return '<div class="card tm-card' + (tmOff(p) ? ' off' : '') + '"><a class="tm-main" href="#person/' + p.id + '"><div class="av" style="background:' + (tmOff(p) ? '#9AA1AD' : avColor(p.name)) + '">' + initials(p.name) + '</div>' +
      '<div class="grow"><div class="tm-name">' + esc(p.name) + (p.id === S.me ? ' <span class="muted">(you)</span>' : '') + '</div><div class="tm-chips">' + tmChips(p) + '</div><div class="small muted">' + esc(tmSeen(p)) + (p.username && p.hasLogin ? ' · ' + esc(p.username) : '') + '</div></div></a>' +
      '<div class="tm-acts"><a class="iconbtn" href="' + tmTel(p) + '" aria-label="Call ' + esc(p.name) + '">' + I('phone') + '</a><button type="button" class="iconbtn tm-wa" data-wa="' + p.id + '" aria-label="WhatsApp ' + esc(p.name) + '">' + I('wa') + '</button></div></div>';
  };
  var html = topbar('Team', { back: '#more', sub: all.length + ' people', right: can('users.create') ? '<button class="iconbtn" type="button" id="tmAdd" aria-label="Add person">' + I('plus', 2.2) + '</button>' : '' }) + '<main>' +
    '<label class="search">' + I('search') + '<input id="tmQ" type="search" placeholder="Name, username or phone" value="' + esc(TEAM.q) + '" autocomplete="off" enterkeyhint="search"></label>' +
    '<div class="chiprow">' + chips.map(function (c) { return '<button type="button" class="fchip ' + (TEAM.f === c[0] ? 'on' : '') + '" data-f="' + c[0] + '">' + c[1] + ' <span class="n">' + counts[c[0]] + '</span></button>'; }).join('') + '</div>' +
    '<div class="tm-list" id="tmList">' + (list.length ? list.map(card).join('') : '<div class="list"><div class="empty">' + (q ? 'Nobody matches “' + esc(q) + '”.' : 'Nobody here.') + '</div></div>') + '</div>' +
    (can('users.create') ? '<button type="button" class="btn ghost tm-addbtn" id="tmAdd2">' + I('plus') + 'Add person</button>' : '') + '</main>';
  return { html: html, keepScroll: true, after: function () {
    var i = $('#tmQ'); i.oninput = function () { TEAM.q = i.value; render(false, true); var j = $('#tmQ'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); };
    $$('[data-f]').forEach(function (b) { b.onclick = function () { TEAM.f = b.dataset.f; render(false, true); }; });
    $$('[data-wa]').forEach(function (b) { b.onclick = function () { var p = staff(b.dataset.wa); Share.wa(p.wa || p.phone, 'Hi ' + firstName(p.name) + ', '); }; });
    [$('#tmAdd'), $('#tmAdd2')].forEach(function (b) { if (b) b.onclick = tmAddPerson; });
  } };
};

VIEWS.person = function (r) {
  var p = staff(r.a);
  if (!tmCanSee() && r.a !== S.me) return { html: topbar('Person', { back: '#more' }) + '<main>' + noAccess('users.view') + '</main>' };
  if (!p) return { html: topbar('Person', { back: '#team' }) + '<main><div class="empty">This person was not found.</div></main>' };
  var self = p.id === S.me, acts = self ? [] : tmActions(p);
  var tasks = (S.tasks || []).filter(function (t) { return (t.staff || []).indexOf(p.id) >= 0 && (t.status === 'Pending' || t.status === 'In Progress'); }).sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
  var kv = function (k, v, extra) { return '<div><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (extra || '') + '</div>'; };
  var head = '<div class="card tm-head"><div class="av tm-bigav" style="background:' + (tmOff(p) ? '#9AA1AD' : avColor(p.name)) + '">' + initials(p.name) + '</div><div class="grow"><div class="tm-hname">' + esc(p.name) + (self ? ' <span class="muted">(you)</span>' : '') + '</div><div class="tm-chips">' + tmChips(p) + '</div><div class="small muted">' + esc(tmSeen(p)) + (p.hasLogin && p.username ? ' · username <b>' + esc(p.username) + '</b>' : '') + '</div></div></div>' +
    (p.hasLogin && !p.loginActive ? '<div class="banner amber">' + I('lock') + '<div>This login is switched off. ' + esc(firstName(p.name)) + ' cannot sign in. Their history stays.</div></div>' : '') +
    (p.isAgent && p.active === false ? '<div class="banner amber">' + I('info') + '<div>Switched off as a field agent. ' + esc(firstName(p.name)) + ' cannot be given tasks.</div></div>' : '');
  var contact = '<div class="sec"><h2>Contact</h2></div><div class="list">' +
    '<a class="row" href="' + tmTel(p) + '">' + I('phone') + '<div class="grow"><div class="t1">' + esc(p.phone || 'No phone') + '</div><div class="t2">Phone</div></div><span class="btn sm ghost">Call</span></a>' +
    '<button type="button" class="row" id="pWa">' + I('wa') + '<div class="grow"><div class="t1">' + esc(p.wa || p.phone || '') + '</div><div class="t2">WhatsApp</div></div><span class="btn sm ghost">Message</span></button>' +
    (p.email ? '<a class="row" href="mailto:' + esc(p.email) + '">' + I('send') + '<div class="grow"><div class="t1">' + esc(p.email) + '</div><div class="t2">Email</div></div></a>' : '') + '</div>' +
    '<div class="kv tm-kv">' + kv('Blood group', esc(p.blood || 'Not given')) + kv('Joined', p.joined ? esc(dFull(p.joined)) : 'Not given') + '</div>' +
    (p.emergency && p.emergency.name ? '<div class="sec"><h2>Emergency contact</h2></div><div class="list"><a class="row" href="tel:+' + normPhone(p.emergency.phone) + '">' + I('shield') + '<div class="grow"><div class="t1">' + esc(p.emergency.name) + '</div><div class="t2">' + esc((p.emergency.relation || '') + ' · ' + p.emergency.phone) + '</div></div><span class="btn sm ghost">' + I('phone') + 'Call</span></a></div>' : '');
  var docs = '';
  if (can('employees.view_documents') || self) {
    var d = p.docs || {}, items = [['icFront', 'IC front'], ['icBack', 'IC back'], ['licence', 'Driving licence']].filter(function (x) { return d[x[0]]; });
    docs = '<div class="sec"><h2>Documents</h2></div>' + (items.length ? '<div class="thumbs tm-docs">' + items.map(function (x) { return '<button type="button" class="thumb" data-doc="' + x[0] + '"><img src="' + imgSrc(d[x[0]]) + '" alt="' + x[1] + '"><span>' + x[1] + '</span></button>'; }).join('') + '</div>' : '<div class="list"><div class="empty">No documents kept</div></div>');
  }
  var areas = tmAreas();
  var access = '<div class="sec"><h2>What they can use</h2><span class="small muted">' + esc(roleName(p.role)) + (p.codes && p.codes.length ? ', own access' : '') + '</span></div><div class="list tm-access">' + Object.keys(areas).map(function (a) {
    var cs = areas[a], on = cs.filter(function (c) { return canP(p, c); }), open = TEAM.open[p.id + a];
    var st = on.length === cs.length ? chip('On', 'green') : on.length ? chip(on.length + ' of ' + cs.length, 'amber') : chip('Off', 'grey');
    return '<button type="button" class="row tm-area" data-area="' + a + '"><div class="grow"><div class="t1">' + esc(AREA_LABEL[a] || a) + '</div></div>' + st + '<svg class="chev' + (open ? ' up' : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg></button>' +
      (open ? '<div class="tm-codes">' + cs.map(function (c) { var y = canP(p, c); return '<div class="tm-code ' + (y ? 'on' : '') + '">' + I(y ? 'check' : 'x', 2.4) + esc(CODES[c]) + '</div>'; }).join('') + '</div>' : '');
  }).join('') + '</div><p class="small muted tm-note">Read only. ' + (can('users.manage_roles') && !self ? 'Change the role from Actions.' : 'The owner sets what each role can use.') + '</p>';
  var tk = can('tasks.view') || self ? '<div class="sec"><h2>Open tasks</h2><span class="small muted">' + tasks.length + '</span></div><div class="list">' + (tasks.length ? tasks.slice(0, 8).map(function (t) {
    return '<a class="row" href="#task/' + t.id + '">' + I('task') + '<div class="grow"><div class="t1">' + esc(t.name) + '</div><div class="t2">' + esc(when(t.at)) + '</div></div>' + chip(t.status, t.status === 'In Progress' ? 'blue' : 'amber') + '</a>';
  }).join('') : '<div class="empty">No open tasks</div>') + '</div>' : '';
  var acts2 = actList(p.id, 6);
  var act = can('users.view_audit') || self ? '<div class="sec"><h2>Their activity</h2>' + (can('users.view_audit') ? '<a href="' + hashWith('activity', { p: p.id }) + '">All</a>' : '') + '</div><div class="list">' + (acts2.length ? acts2.map(function (x) { return actRowHtml(x, true); }).join('') : '<div class="empty">Nothing yet</div>') + '</div>' : '';
  var html = topbar(self ? 'My profile' : p.name, { back: '#team', right: acts.length ? '<button type="button" class="iconbtn" id="pActs" aria-label="Actions">' + I('more', 2.4) + '</button>' : '' }) + '<main class="tm-person">' + head +
    (acts.length ? '<button type="button" class="btn ghost tm-actbtn" id="pActs2">' + I('gear') + 'Actions</button>' : '') +
    contact + docs + access + tk + act + '</main>';
  return { html: html, keepScroll: true, after: function () {
    $('#pWa').onclick = function () { Share.wa(p.wa || p.phone, 'Hi ' + firstName(p.name) + ', '); };
    [$('#pActs'), $('#pActs2')].forEach(function (b) { if (b) b.onclick = function () { tmActionSheet(p.id); }; });
    $$('[data-area]').forEach(function (b) { b.onclick = function () { var k = p.id + b.dataset.area; TEAM.open[k] = !TEAM.open[k]; render(false, true); }; });
    $$('[data-doc]').forEach(function (b) { b.onclick = function () { sheet(sheetHead(b.textContent, p.name) + '<img class="tm-docbig" src="' + imgSrc((p.docs || {})[b.dataset.doc]) + '" alt="">'); }; });
    actWire();
  } };
};

/* what I may do to this person */
function tmActions(p) {
  var a = [];
  if (p.hasLogin && can('users.deactivate')) {
    a.push(p.loginActive ? ['loginOff', 'lock', 'Switch login off', 'They are signed out and cannot sign in'] : ['loginOn', 'check', 'Switch login on', 'They can sign in again']);
    if (p.loginActive) a.push(['signout', 'signout', 'Sign out everywhere', 'Every phone and computer they use is signed out']);
  }
  if (p.hasLogin && can('users.reset_password')) a.push(['password', 'key', 'Reset password', 'Make up a new password and send it']);
  if (p.isAgent && (can('users.edit') || can('users.deactivate'))) a.push(p.active === false ? ['agentOn', 'user', 'Switch agent on', 'They can be given tasks again'] : ['agentOff', 'user', 'Switch agent off', 'They will not be given tasks']);
  if (p.hasLogin && can('users.manage_roles')) a.push(['role', 'users', 'Change role', 'Now ' + roleName(p.role)]);
  return a;
}
function tmActionSheet(id) {
  var p = staff(id), acts = tmActions(p);
  sheet(sheetHead(p.name, roleName(p.role)) + '<div class="list">' + acts.map(function (x) {
    return '<button type="button" class="row" data-act="' + x[0] + '">' + I(x[1]) + '<div class="grow"><div class="t1' + (/Off|signout/.test(x[0]) ? ' tone-red-text' : '') + '">' + x[2] + '</div><div class="t2">' + esc(x[3]) + '</div></div></button>';
  }).join('') + '</div>', function (sh) {
    $$('[data-act]', sh).forEach(function (b) { b.onclick = function () { var k = b.dataset.act; closeSheet(true); setTimeout(function () { tmDo(id, k); }, 30); }; });
  });
}
function tmDo(id, k) {
  var p = staff(id), nm = p.name;
  if (k === 'loginOff') confirm({ icon: 'warn', title: 'Switch off ' + nm + '?', text: 'They are signed out and cannot sign in until you switch the login back on. Their history stays.', ok: 'Switch off', danger: true }).then(function (ok) {
    if (!ok) return; p.loginActive = false; p.devices = 0; audit(nm + '’s login switched off', { changes: { login: ['On', 'Off'] }, link: '#person/' + id }); save(); render(false, true); say(nm + '’s login is switched off');
  });
  else if (k === 'loginOn') { p.loginActive = true; audit(nm + '’s login switched on', { changes: { login: ['Off', 'On'] }, link: '#person/' + id }); save(); render(false, true); say(nm + '’s login is switched on'); }
  else if (k === 'signout') confirm({ icon: 'warn', title: 'Sign ' + nm + ' out everywhere?', text: 'Every device they are signed in on is signed out. A page they already have open can keep working for up to 30 minutes; switching the login off stops it immediately.', ok: 'Sign out everywhere' }).then(function (ok) {
    if (!ok) return; var n = Math.max(1, +p.devices || 1); p.devices = 0; audit(nm + ' signed out everywhere (' + n + (n === 1 ? ' device' : ' devices') + ')', { link: '#person/' + id }); save(); render(false, true);
    say(nm + ' was signed out of ' + n + (n === 1 ? ' device.' : ' devices.'));
  });
  else if (k === 'password') tmPassword(id);
  else if (k === 'agentOff') {
    var n = openTasksOf(id);
    confirm({ icon: 'warn', title: 'Switch off ' + nm + '?', html: (n ? '<p class="lead"><b>' + esc(nm) + ' has ' + n + ' unfinished task' + (n === 1 ? '' : 's') + '.</b> Give ' + (n === 1 ? 'it' : 'them') + ' to another person first, in Tasks. Switching off does not move tasks by itself.</p>' : '') +
      '<p class="lead">' + (p.hasLogin ? 'They are signed out at once and cannot sign in or do anything. ' : 'They will not be given new tasks. ') + 'Their name stays on past bookings and tasks, and you can switch them back on.</p>', ok: n ? 'Switch off anyway' : 'Switch off', danger: true }).then(function (ok) {
      if (!ok) return; var hadLogin = p.hasLogin && p.loginActive; p.active = false; if (p.hasLogin) { p.loginActive = false; p.devices = 0; }
      audit(nm + ' switched off as a field agent' + (hadLogin ? ', login switched off too' : ''), { changes: { 'field agent': ['On', 'Off'] }, link: '#person/' + id }); save(); render(false, true);
      say(hadLogin ? 'Switched off. The login is off too.' : 'Switched off.');
    });
  }
  else if (k === 'agentOn') { p.active = true; audit(nm + ' switched on as a field agent', { changes: { 'field agent': ['Off', 'On'] }, link: '#person/' + id }); save(); render(false, true); say(p.hasLogin && !p.loginActive ? 'Switched on. Switch the login on too when they should sign in again.' : 'Switched on.'); }
  else if (k === 'role') tmRole(id);
}
function tmRole(id) {
  var p = staff(id);
  sheet(sheetHead('Change role', p.name) + '<div class="list">' + Object.keys(ROLES).map(function (r) {
    return '<button type="button" class="row" data-role="' + r + '"><div class="grow"><div class="t1">' + esc(ROLES[r].name) + '</div><div class="t2">' + esc(tmRoleLine(r)) + '</div></div>' + (p.role === r ? chip('Now', 'green') : '') + '</button>';
  }).join('') + '</div>', function (sh) {
    $$('[data-role]', sh).forEach(function (b) { b.onclick = function () {
      var r = b.dataset.role; if (r === p.role) { closeSheet(); return; }
      var old = p.role; p.role = r; p.codes = null; if (r === 'agent') p.isAgent = true;
      audit(p.name + '’s role changed', { changes: { role: [roleName(old), roleName(r)] }, link: '#person/' + id }); save(); closeSheet(); render(false, true); say(p.name + ' is now ' + roleName(r));
    }; });
  });
}
function tmRoleLine(r) {
  var cs = ROLES[r].codes; if (cs.indexOf('*') >= 0) return 'Everything';
  var areas = {}; cs.forEach(function (c) { areas[c.split('.')[0]] = 1; });
  return Object.keys(areas).map(function (a) { return AREA_LABEL[a] || a; }).slice(0, 5).join(', ') + (Object.keys(areas).length > 5 ? ' and more' : '');
}

/* ---- passwords (same rules as the web app) ---- */
var PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function makePassword(n) {
  n = n || 14; var a = new Uint32Array(n);
  try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 1e9); }
  return Array.prototype.map.call(a, function (v) { return PW_ALPHABET[v % PW_ALPHABET.length]; }).join('');
}
function pwChecks(pw, user) {
  var u = String(user || '').trim().toLowerCase();
  return [{ ok: pw.length >= 10, text: 'At least 10 characters' }, { ok: pw.length > 0 && !/^\d+$/.test(pw), text: 'Not only numbers' }, { ok: pw.length > 0 && (!u || pw.toLowerCase().indexOf(u) < 0), text: 'Does not contain the username' }];
}
function tmPassword(id, isNew) {
  var p = staff(id), pw = makePassword(), show = true;
  var sh = sheet(sheetHead(isNew ? 'Login made' : 'Reset password', p.name + ' · username ' + p.username) +
    (isNew ? '<div class="banner green">' + I('check', 2.4) + '<div>' + esc(firstName(p.name)) + ' can sign in now with this password. Send it to them.</div></div>' : '') +
    '<label class="field"><span>New password</span><div class="si-pass"><input class="inp tm-pw" id="pwIn" autocomplete="new-password" autocapitalize="none" spellcheck="false" value="' + esc(pw) + '"><button type="button" class="iconbtn on" id="pwEye" aria-label="Hide password">' + I('eye') + '</button></div></label>' +
    '<div class="tm-pwchecks" id="pwChecks"></div>' +
    '<div class="btnrow tm-pwrow"><button type="button" class="btn ghost sm" id="pwGen">' + I('reset') + 'Make up another</button><button type="button" class="btn ghost sm" id="pwCopy">' + I('copy') + 'Copy</button></div>' +
    '<div class="sheet-foot stack"><button type="button" class="btn" id="pwWa">' + I('wa') + 'Save and send on WhatsApp</button><button type="button" class="btn link" id="pwSave">' + (isNew ? 'Done, I will tell them myself' : 'Save only') + '</button></div>', function (sh) {
      var inp = $('#pwIn', sh);
      function upd() { var cs = pwChecks(inp.value, p.username), good = cs.every(function (c) { return c.ok; }); $('#pwChecks', sh).innerHTML = cs.map(function (c) { return '<span class="' + (c.ok ? 'ok' : '') + '">' + I(c.ok ? 'check' : 'x', 2.6) + c.text + '</span>'; }).join(''); $('#pwWa', sh).disabled = !good; $('#pwSave', sh).disabled = !good; }
      upd(); inp.oninput = upd;
      $('#pwEye', sh).onclick = function () { show = !show; inp.type = show ? 'text' : 'password'; this.classList.toggle('on', show); };
      $('#pwGen', sh).onclick = function () { inp.value = makePassword(); upd(); };
      $('#pwCopy', sh).onclick = function () { Share.copy(inp.value, 'Password copied'); };
      function keep() { audit(isNew ? 'Login made for ' + p.name : 'Password reset for ' + p.name, { link: '#person/' + id }); p.pwSetAt = new Date().toISOString(); if (!isNew) p.devices = 0; save(); }
      $('#pwSave', sh).onclick = function () { keep(); closeSheet(); render(false, true); say(isNew ? 'Login saved' : 'New password saved for ' + p.name); };
      $('#pwWa', sh).onclick = function () {
        keep(); var b = B();
        Share.wa(p.wa || p.phone, 'Hi ' + firstName(p.name) + ', your ' + b.appName + ' login:\nUsername: ' + p.username + '\nPassword: ' + inp.value + '\nPlease keep it private.');
        closeSheet(); render(false, true); say('WhatsApp is ready with the message. Press send there.');
      };
    }, { stack: !!isNew });
  return sh;
}

/* ---- add a person ---- */
function tmAddPerson() {
  var st = { kind: 'login', name: '', wa: '', role: 'frontdesk', err: {} };
  var roles = Object.keys(ROLES).filter(function (r) { return r !== 'owner'; });
  sheet(sheetHead('Add person') +
    '<div class="seg" id="apKind"><button type="button" class="on" data-k="login">Login</button><button type="button" data-k="agent">Field agent</button></div>' +
    '<p class="small muted" id="apHint" style="margin:8px 2px 12px"></p>' +
    '<label class="field"><span>Full name</span><input class="inp" id="apName" autocomplete="off" placeholder="As on their IC"><span class="err" id="apNameErr"></span></label>' +
    '<label class="field"><span>WhatsApp number</span><input class="inp" id="apWa" type="tel" inputmode="tel" placeholder="012-345 6789"><span class="err" id="apWaErr"></span></label>' +
    '<div class="field" id="apRoleBox"><span>Role</span><div class="tm-roles">' + roles.map(function (r) { return '<button type="button" class="fchip' + (r === st.role ? ' on' : '') + '" data-r="' + r + '">' + esc(ROLES[r].name) + '</button>'; }).join('') + '</div><span class="hint" id="apRoleLine"></span></div>' +
    '<div class="field" id="apUserBox"><span>Username</span><input class="inp" id="apUser" autocapitalize="none" spellcheck="false" placeholder="Made from the name"><span class="err" id="apUserErr"></span></div>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="apSave">Add person</button></div>', function (sh) {
      function hint() {
        var login = st.kind === 'login';
        $('#apHint', sh).textContent = login ? 'They sign in to this app with a username and password. You get the password next.' : 'For drivers who get tasks on WhatsApp and do not sign in.';
        $('#apRoleBox', sh).style.display = login ? '' : 'none'; $('#apUserBox', sh).style.display = login ? '' : 'none';
        $('#apRoleLine', sh).textContent = tmRoleLine(st.role); $('#apSave', sh).textContent = login ? 'Add and make password' : 'Add field agent';
      }
      hint();
      $$('#apKind button', sh).forEach(function (b) { b.onclick = function () { $$('#apKind button', sh).forEach(function (x) { x.classList.toggle('on', x === b); }); st.kind = b.dataset.k; hint(); }; });
      $$('[data-r]', sh).forEach(function (b) { b.onclick = function () { $$('[data-r]', sh).forEach(function (x) { x.classList.toggle('on', x === b); }); st.role = b.dataset.r; hint(); }; });
      var nm = $('#apName', sh), un = $('#apUser', sh), touchedUser = false;
      nm.oninput = function () { if (!touchedUser) un.value = tmUsername(nm.value); };
      un.oninput = function () { touchedUser = true; };
      $$('.inp', sh).forEach(function (el) { el.addEventListener('input', function () { var e = el.parentNode.querySelector('.err'); if (e) e.textContent = ''; }); });
      $('#apWa', sh).onblur = function () { if (this.value.trim()) this.value = fmtPhone(this.value); };
      $('#apSave', sh).onclick = function () {
        var name = nm.value.trim().replace(/\s+/g, ' '), wa = $('#apWa', sh).value.trim(), user = un.value.trim().toLowerCase(), bad = false;
        ['apNameErr', 'apWaErr', 'apUserErr'].forEach(function (k) { $('#' + k, sh).textContent = ''; });
        if (name.length < 2) { $('#apNameErr', sh).textContent = 'Type their name'; bad = true; }
        if (digits(wa).length < 9) { $('#apWaErr', sh).textContent = 'Type a phone number with at least 9 digits'; bad = true; }
        else if (S.staff.some(function (x) { return normPhone(x.wa || x.phone) === normPhone(wa); })) { $('#apWaErr', sh).textContent = 'Someone in the team already has this number'; bad = true; }
        if (st.kind === 'login') {
          if (!/^[a-z0-9._]{3,}$/.test(user)) { $('#apUserErr', sh).textContent = 'At least 3 letters or numbers, no spaces'; bad = true; }
          else if (S.staff.some(function (x) { return String(x.username || '').toLowerCase() === user; })) { $('#apUserErr', sh).textContent = 'This username is taken'; bad = true; }
        }
        if (bad) return;
        var n = 1; while (staff('s' + n)) n++;
        var login = st.kind === 'login', role = login ? st.role : 'agent', ph = fmtPhone(wa);
        var p = { id: 's' + n, name: name, username: login ? user : '', role: role, phone: ph, wa: ph, email: '', active: true, isAgent: role === 'agent', hasLogin: login, loginActive: login, emergency: null, blood: '', lastSeen: null, codes: null, devices: 0, joined: new Date().toISOString() };
        S.staff.push(p); audit((login ? 'Login made for ' : 'Field agent added: ') + name, { changes: { role: [null, roleName(role)] }, link: '#person/' + p.id }); save();
        closeSheet(true);
        location.hash = '#person/' + p.id;
        if (login) setTimeout(function () { tmPassword(p.id, true); }, 220); else say(name + ' added as a field agent');
      };
    });
}
function tmUsername(name) {
  var base = String(name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, ''); if (!base) return '';
  var u = base, k = 2; while (S.staff.some(function (x) { return String(x.username || '').toLowerCase() === u; })) u = base + k++;
  return u;
}

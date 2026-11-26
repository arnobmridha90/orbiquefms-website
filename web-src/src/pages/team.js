/* ===================================================================
   Page: Team (#page=team)   Owner: builder 5
   Everyone who works for the company: people who sign in (users) and field agents (employees), what each login
   may use (23 sections, 128 codes from perms.js), and the role templates.
   Address: #page=team&view=people|access|templates&person=usr-2|emp-3&tab=login|access|profile|activity&action=add|agent
   =================================================================== */
var TEAM_SEC_ICONS = { dashboard: 'layout-dashboard', bookings: 'calendar-event', customers: 'users', inspections: 'clipboard-check', cars: 'car', damage_packages: 'shield-check', signatures: 'signature', calendar: 'calendar', reports: 'report-analytics', faqs: 'help-circle', reviews: 'star', home_settings: 'settings', employees: 'id-badge-2', tasks: 'checklist', maintenance: 'tool', users: 'lock', billing: 'file-invoice', summons: 'gavel', deposits: 'cash-banknote', customer_notes: 'notes', expenses: 'receipt-2', tracking: 'radar-2', ic_check: 'id', leads: 'brand-whatsapp' };
/* the owner-private car switches: shown as their own group, and only administrators (full access) may change them */
var TEAM_PRIVATE = ['cars.see_owner_details', 'cars.see_instalment', 'cars.view_owner_docs'];
var TEAM_GUARD = 'This would leave nobody with full access. Give full access to someone else first.';
var TEAM_CODE = {};   /* code -> [section, name, desc, money] */
PERM_SECTIONS.forEach(function (s) { s.codes.forEach(function (c) { TEAM_CODE[c[0]] = { sec: s, name: c[1], desc: c[2], money: !!c[3] }; }); });

function teamSet(arr) { var o = {}; (arr || []).forEach(function (c) { o[c] = 1; }); return o; }
function teamKeys(o) { return Object.keys(o).filter(function (k) { return o[k]; }); }
function teamRole(u) { return u && u.role ? byId(D().roles, u.role) : null; }
function teamRoleName(u) { if (!u) return ''; if (u.superAdmin) return 'Owner'; var r = teamRole(u); return r ? r.name : 'No template'; }
function teamSecOn(set, s) { return !!set[s.codes[0][0]]; }
function teamSecCount(set, s) { return s.codes.filter(function (c) { return set[c[0]]; }).length; }
function teamSectionsOn(set) { return PERM_SECTIONS.filter(function (s) { return teamSecOn(set, s); }).length; }
function teamUserSet(u) { return teamSet(myCodes(u)); }
function teamRoleSet(roleId) { var r = roleId ? byId(D().roles, roleId) : null; return teamSet(r ? r.codes : []); }
function teamCanChange(code) { var m = me(); return !!m && (m.superAdmin || (can(code) && (TEAM_PRIVATE.indexOf(code) < 0 || teamFull(m)))); }
function teamLockMsg(code) { var m = me(); if (!m || m.superAdmin) return null; if (TEAM_PRIVATE.indexOf(code) >= 0 && !teamFull(m)) return 'Only administrators can change this.'; return can(code) ? null : 'You do not have this access yourself, so you cannot give it to others.'; }
/* full access = super-admin, or every switch on */
function teamFull(u, set) { if (!u) return false; if (u.superAdmin) return true; set = set || teamUserSet(u); return PERM_CODES.every(function (c) { return set[c]; }); }
/* how many active people would still have full access if u had newSet (or newActive) */
function teamFullLeft(u, newSet, newActive) { return D().users.filter(function (x) { if (x === u) return (newActive === undefined ? x.active : newActive) && teamFull(x, newSet || null); return x.active && teamFull(x); }).length; }
/* true when the change takes the last full access away */
function teamBreaksFull(u, newSet, newActive) { return u.active && teamFull(u) && teamFullLeft(u, newSet, newActive) === 0; }
/* someone with switches the signed-in person does not have */
function teamMoreThanMe(u) { var m = me(); if (!u || !m || m.superAdmin || u.id === m.id) return false; if (u.superAdmin) return true; var mine = teamUserSet(m), theirs = teamUserSet(u); return PERM_CODES.some(function (c) { return theirs[c] && !mine[c]; }); }
function teamCodeLabel(c) { var x = TEAM_CODE[c]; if (!x) return c; return x.sec.codes[0][0] === c ? x.sec.name : x.sec.name + ': ' + x.name; }
function teamPages(set) {
  var ok = function (id) { var m = PAGE_META[id]; if (!m) return false; var need = m[2]; if (!need) return true; return [].concat(need).every(function (c) { return set[c]; }); };
  var out = [];
  if (ok('dashboard')) out.push({ label: 'Dashboard', items: ['dashboard'] });
  ((D().settings && D().settings.menu) || DEFAULT_MENU).forEach(function (g) { var it = g.items.filter(ok); if (it.length) out.push({ label: g.label, items: it }); });
  return out;
}
function teamPagesHtml(set) {
  var g = teamPages(set);
  if (!g.length) return '<p class="b2">No pages: this person sees an empty dashboard after signing in.</p>';
  return g.map(function (x) { return '<div class="tm-pv-g"><div class="tm-pv-h">' + esc(x.label) + '</div><div class="row wrap gap6">' + x.items.map(function (id) { return '<span class="chip pri">' + i(PAGE_META[id][1]) + esc(PAGE_META[id][0]) + '</span>'; }).join('') + '</div></div>'; }).join('');
}
function teamPwRules(pw, username) {
  var un = String(username || '').trim().toLowerCase();
  return [[pw.length >= 10, 'At least 10 characters'], [!!pw && !/^\d+$/.test(pw), 'Not only numbers'], [!un || pw.toLowerCase().indexOf(un) < 0, 'Does not contain the username']];
}
function teamPwScore(pw) { var s = 0; if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 18) s++; return s; }
function teamPwHtml(pw, username) {
  var sc = teamPwScore(pw), lab = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][sc], tone = sc <= 1 ? 'bad' : sc <= 2 ? 'warn' : 'ok';
  return '<div class="tm-pw-meter">' + (pw ? UI.progress(sc * 20, tone) + '<span class="b2">Strength: <b>' + lab + '</b></span>' : '') + '</div><ul class="tm-rules">' + teamPwRules(pw, username).map(function (r) { return '<li class="' + (pw ? (r[0] ? 'ok' : 'bad') : '') + '">' + i(pw && r[0] ? 'circle-check' : pw ? 'circle-x' : 'point') + esc(r[1]) + '</li>'; }).join('') + '</ul>';
}
/* 14 characters with no look-alikes (no 0 O o, 1 l I i, 5 S, 2 Z) */
var TEAM_PW_CHARS = 'ABCDEFGHJKLMNPQRTUVWXYabcdefghjkmnpqrstuvwxyz346789';
function teamMakePw() {
  var pick = function (n) { var r = new Uint32Array(n); try { crypto.getRandomValues(r); } catch (x) { for (var k = 0; k < n; k++) r[k] = Math.floor(Math.random() * 4294967296); } return Array.prototype.map.call(r, function (v) { return TEAM_PW_CHARS[v % TEAM_PW_CHARS.length]; }).join(''); };
  var pw = pick(14), tries = 0;
  while (!(/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) && tries++ < 50) pw = pick(14);
  return pw;
}
function teamPwOk(pw, username) { return teamPwRules(pw, username).every(function (r) { return r[0]; }); }
/* wire a password field + its rules box inside el; who() -> {name, phone} for "Send on WhatsApp" */
function teamWirePw(el, getUser, who) {
  var f = el.querySelector('[data-key="password"]'), box = el.querySelector('.tm-pwbox'), send = el.querySelector('.tm-pwsend');
  var up = function () { box.innerHTML = teamPwHtml(f.value, getUser()); if (send) send.hidden = !f.value; };
  f.addEventListener('input', up);
  var gen = el.querySelector('[data-tm-gen]'); if (gen) gen.addEventListener('click', function () { f.value = teamMakePw(); f.type = 'text'; var sh2 = el.querySelector('[data-tm-show]'); if (sh2) sh2.innerHTML = i('eye-off'); up(); });
  var sh = el.querySelector('[data-tm-show]'); if (sh) sh.addEventListener('click', function () { f.type = f.type === 'password' ? 'text' : 'password'; sh.innerHTML = i(f.type === 'password' ? 'eye' : 'eye-off'); });
  var cp = el.querySelector('[data-tm-copy]'); if (cp) cp.addEventListener('click', function () { teamCopy(f.value, 'Password copied. Pass it on to them yourself.'); });
  var wa = el.querySelector('[data-tm-wa]'); if (wa) wa.addEventListener('click', function () {
    var w = (who && who()) || {}, un = getUser() || '';
    var msg = 'Hi' + (w.name ? ' ' + w.name.split(' ')[0] : '') + ', here is your sign-in for the ' + B().name + ' dashboard.\nUsername: ' + un + '\nPassword: ' + f.value + '\nPlease keep it to yourself.';
    window.open(UI.waLink(w.phone, msg) || 'https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    if (!UI.waNumber(w.phone)) UI.toast('No WhatsApp number saved for them, so choose the chat in WhatsApp.', { tone: 'info' });
  });
  up();
}
function teamCopy(text, ok) {
  var done = function () { UI.toast(ok || 'Copied.'); };
  try { navigator.clipboard.writeText(text).then(done, function () { teamCopyOld(text); done(); }); } catch (x) { teamCopyOld(text); done(); }
}
function teamCopyOld(text) { var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (x) { /* nothing more to try */ } t.remove(); }
function teamPwFields(label) {
  return '<div class="inp full"><label for="tm-pw">' + esc(label || 'Password') + ' <span class="ui-req">*</span></label><div class="tm-pwrow"><input id="tm-pw" type="password" data-key="password" autocomplete="new-password" spellcheck="false"><button type="button" class="ib sm" data-tm-show aria-label="Show the password">' + i('eye') + '</button><button type="button" class="btn t sm" data-tm-gen>' + i('sparkles') + 'Make one for me</button></div><div class="tm-pwbox"></div>' +
    '<div class="row wrap gap8 tm-pwsend" hidden><button type="button" class="btn o sm" data-tm-copy>' + i('copy') + 'Copy</button><button type="button" class="btn o sm" data-tm-wa>' + i('brand-whatsapp') + 'Send on WhatsApp</button></div></div>';
}
/* amber note under an email field when someone else already uses that email */
function teamWireEmail(el, self) {
  var f = el.querySelector('[data-key="email"]'); if (!f) return;
  var box = document.createElement('div'); box.className = 'tm-emw'; (f.closest('.inp') || f).insertAdjacentElement('afterend', box);
  var up = function () {
    var v = f.value.trim().toLowerCase(), o = v ? D().users.filter(function (x) { return x !== self && x.email && x.email.toLowerCase() === v; })[0] : null;
    box.innerHTML = o ? UI.alert(o.name + ' already uses this email. You can still save, but it is better if every person has their own.', 'warn', { icon: 'alert-triangle' }) : '';
  };
  f.addEventListener('input', up); up();
}

/* ---------------- people list ---------------- */
function teamPeople(d) {
  var rows = [];
  d.users.forEach(function (u) { rows.push({ key: 'u:' + u.id, id: u.id, u: u, e: u.agent ? employeeById(u.agent, d) : null, name: u.name }); });
  d.employees.forEach(function (e) { if (!e.login || !userById(e.login, d)) rows.push({ key: 'e:' + e.id, id: e.id, u: null, e: e, name: e.name }); });
  return rows.sort(function (a, b) { return a.name.localeCompare(b.name); });
}
function teamPersonCell(r) {
  var m = me(), sub = r.u ? 'Username: ' + esc(r.u.username) : UI.phone(r.e.wa);
  return '<div class="row gap12 tm-person">' + UI.avatar(r.name) + '<div class="tm-pn"><div class="row wrap gap6"><b>' + esc(r.name) + '</b>' + (r.u && m && r.u.id === m.id ? UI.chip('You', 'info') : '') + (r.u && r.u.superAdmin ? UI.chip('Super-admin', 'warn') : '') + '</div><div class="b2">' + sub + '</div></div></div>';
}
function teamIsCell(r) { return '<div class="row wrap gap6">' + (r.e ? UI.chip('Field agent', 'grey') : '') + (r.u ? UI.chip('Login', 'pri') : '') + '</div>'; }
function teamAccessCell(r) {
  if (!r.u) return '<span class="b2">No login: cannot sign in</span>';
  var set = teamUserSet(r.u), n = teamSectionsOn(set);
  return '<div class="tm-acc"><div class="row wrap gap6"><span class="b2">' + n + ' of ' + PERM_SECTIONS.length + ' sections on</span>' + UI.chip(teamRoleName(r.u), 'pri') + (teamMoreThanMe(r.u) ? UI.chip('Has more access than you', 'grey', { icon: 'lock', title: 'You cannot change this person, because they can use things you cannot.' }) : '') + '</div>' + UI.progress(n / PERM_SECTIONS.length * 100) + '</div>';
}
function teamStatusCell(r) { var on = r.u ? r.u.active : r.e.active; return UI.status('active', on ? 'Active' : 'Switched off'); }
function teamLastCell(r) { return r.u ? (r.u.lastSignIn ? UI.fmt.ago(r.u.lastSignIn) : 'Never') : '<span class="faint">-</span>'; }

function teamRowMenu(anchor, r) {
  var m = me(), self = r.u && m && r.u.id === m.id, items = [];
  if (r.u) {
    var more = teamMoreThanMe(r.u);
    items.push({ label: can('users.edit') && !r.u.superAdmin && !self && !more ? 'Edit access' : 'See access', icon: 'lock', onClick: function () { teamOpenPerson(r.u.id, 'access'); } });
    items.push({ label: 'Open profile', icon: 'user', onClick: function () { teamOpenPerson(r.u.id, 'login'); } });
    if (r.e) items.push({ label: 'Field profile', icon: 'id-badge-2', onClick: function () { teamOpenPerson(r.u.id, 'profile'); } });
    else items.push({ label: 'Add a field-agent profile', icon: 'id-badge-2', disabled: !can('employees.create'), onClick: function () { teamEmployeeDrawer(null, { name: r.u.name, email: r.u.email, login: r.u.id }); } });
    items.push({ divider: true });
    items.push({ label: 'Reset password', icon: 'key', disabled: !can('users.reset_password') || more, title: more ? 'Has more access than you' : '', onClick: function () { teamPwDialog(r.u); } });
    items.push({ label: r.u.active ? 'Switch login off' : 'Switch login on', icon: r.u.active ? 'user-off' : 'user-check', disabled: !can('users.deactivate') || self || r.u.superAdmin || more, title: self ? 'You cannot switch off your own login' : more ? 'Has more access than you' : '', onClick: function () { teamToggleLogin(r.u); } });
    items.push({ label: 'Sign out everywhere', icon: 'logout', disabled: !can('users.deactivate') || self || more, onClick: function () { teamSignOut(r.u); } });
    items.push({ label: 'View activity', icon: 'history', onClick: function () { teamOpenPerson(r.u.id, 'activity'); } });
  } else {
    items.push({ label: 'Open profile', icon: 'user', onClick: function () { teamAgentDrawer(r.e); } });
    items.push({ label: 'Edit profile and documents', icon: 'edit', disabled: !can('employees.edit'), onClick: function () { teamEmployeeDrawer(r.e); } });
    items.push({ label: 'Give a login', icon: 'user-plus', disabled: !can('users.create'), onClick: function () { teamLoginDrawer({ employee: r.e }); } });
    items.push({ divider: true });
    items.push({ label: r.e.active ? 'Switch off' : 'Switch on', icon: r.e.active ? 'user-off' : 'user-check', disabled: !can('employees.edit'), onClick: function () { teamToggleAgent(r.e); } });
    items.push({ label: 'View activity', icon: 'history', disabled: !can('users.view_audit'), onClick: function () { go('activity', { q: r.e.name }); } });
    items.push({ label: 'Delete profile', icon: 'trash', danger: true, disabled: !can('employees.delete'), onClick: function () { teamDeleteAgent(r.e); } });
  }
  UI.menu(anchor, items, { width: 250 });
}

/* ---------------- actions on a login ---------------- */
function teamToggleLogin(u) {
  if (u.active && teamBreaksFull(u, null, false)) { UI.toast(TEAM_GUARD, { tone: 'warn' }); return; }
  if (u.active) {
    UI.confirm({ title: 'Switch off ' + u.name + '?', text: 'They are signed out and cannot sign in until you switch the login back on. Their history stays.', ok: 'Switch off', danger: true }).then(function (y) {
      if (!y) return; DB.update('users', u, { active: false, sessions: 0 }, { action: 'Changed', where: 'Team member', text: me().name + ' switched off the login of ' + u.name, changes: [{ f: 'Login', from: 'On', to: 'Off' }] }); UI.toast(u.name + ' is switched off.');
    });
  } else {
    DB.update('users', u, { active: true }, { action: 'Changed', where: 'Team member', text: me().name + ' switched on the login of ' + u.name, changes: [{ f: 'Login', from: 'Off', to: 'On' }] }); UI.toast(u.name + ' can sign in again.');
  }
}
function teamSignOut(u) {
  UI.confirm({ title: 'Sign ' + u.name + ' out everywhere?', text: 'Every phone and computer they are signed in on is signed out now. They can sign in again with their password.', ok: 'Sign out everywhere', danger: true }).then(function (y) {
    if (!y) return; u.sessions = 0; DB.log('Signed out', 'Team member', u.id, me().name + ' signed ' + u.name + ' out everywhere'); emit('data', { coll: 'users', op: 'update', rec: u }); UI.toast(u.name + ' is signed out everywhere.');
  });
}
function teamPwDialog(u) {
  UI.dialog({ title: 'New password for ' + u.name, width: 'sm',
    dirty: function (dl) { var f = dl.body && dl.body.querySelector('[data-key="password"]'); return !!(f && f.value); },
    body: function (el) { el.innerHTML = '<p class="ui-ctext">Choose a password and pass it on to them yourself. It is never shown again.</p>' + teamPwFields('New password') + '<span class="ui-err tm-pwerr" hidden></span>'; teamWirePw(el, function () { return u.username; }, function () { var e = u.agent ? employeeById(u.agent) : null; return { name: u.name, phone: e ? e.wa : '' }; }); },
    buttons: [{ label: 'Cancel', kind: 'g', close: false, onClick: function (d2) { d2.close(); } }, { label: 'Set password', icon: 'key', onClick: function (dl) {
      var pw = dl.body.querySelector('[data-key="password"]').value, er = dl.body.querySelector('.tm-pwerr');
      if (!teamPwOk(pw, u.username)) { er.textContent = 'The password does not follow the rules above yet.'; er.hidden = false; return false; }
      u.pwSetAt = NOW(); DB.log('Password reset', 'Team member', u.id, me().name + ' set a new password for ' + u.name); emit('data', { coll: 'users', op: 'update', rec: u });
      UI.toast('New password set for ' + u.name + '. Pass it on to them yourself.');
    } }] });
}

/* ---------------- the access editor (person Access tab and template drawer) ----------------
   st = {cur: set, base: set|null, baseName, q, open:{}, locked: reason|null, person: bool} */
function teamReqHtml(st, s) {
  var miss = permMissing(st.cur, s.id); if (!miss.length) return '';
  var canFix = !st.locked && miss.every(function (c) { return teamCanChange(c); });
  var names = miss.map(teamCodeLabel), list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  return '<div class="tm-req">' + i('alert-triangle') + '<div class="grow"><b>' + esc(s.name) + ' also needs ' + esc(list) + '.</b><div class="b2">Without ' + (miss.length > 1 ? 'them' : 'it') + ', parts of this section stay empty or cannot be opened.</div></div>' +
    (canFix ? '<button type="button" class="btn o sm" data-tacc-req="' + s.id + '">' + i('check') + 'Switch it on too</button>' : '') + '</div>';
}
function teamCodeRow(st, c) {
  var cOn = !!st.cur[c[0]], inBase = st.base ? !!st.base[c[0]] : null, lock = st.locked || teamLockMsg(c[0]);
  var src = st.base && st.person ? (cOn && !inBase ? UI.chip('Only for this person', 'ok') : !cOn && inBase ? UI.chip('Off for this person', 'warn') : '') : '';
  return '<div class="tm-code"><div class="grow"><div class="row wrap gap6"><span class="t1c">' + esc(c[1]) + '</span>' + (c[3] ? '<span class="tm-rm">' + i('lock') + 'RM</span>' : '') + src + '</div><div class="b2">' + esc(c[2]) + '</div>' +
    (src && !lock ? '<button type="button" class="btn t sm tm-back" data-tacc-reset="' + c[0] + '">' + i('arrow-back-up') + 'Back to what ' + esc(st.baseName) + ' gives</button>' : '') + '<code class="tm-cc">' + c[0] + '</code></div>' +
    '<label class="sw" title="' + esc(lock || '') + '"><input type="checkbox" data-tacc-code="' + c[0] + '"' + (cOn ? ' checked' : '') + (lock ? ' disabled' : '') + ' aria-label="' + esc(c[1]) + '"><span></span></label></div>';
}
function teamAccessList(st) {
  var q = (st.q || '').trim().toLowerCase();
  var secs = PERM_SECTIONS.filter(function (s) { return !q || (s.name + ' ' + s.desc).toLowerCase().indexOf(q) >= 0 || s.codes.some(function (c) { return (c[1] + ' ' + c[2] + ' ' + c[0]).toLowerCase().indexOf(q) >= 0; }); });
  if (!secs.length) return UI.empty({ icon: 'search', title: 'Nothing matches "' + st.q + '"', text: 'Try another word, such as "delete" or "amounts".' });
  return secs.map(function (s) {
    var on = teamSecOn(st.cur, s), n = teamSecCount(st.cur, s), open = st.open[s.id] || !!q;
    var secLock = st.locked || teamLockMsg(s.codes[0][0]);
    var codes = s.codes.filter(function (c) { return !q || (c[1] + ' ' + c[2] + ' ' + c[0] + ' ' + s.name).toLowerCase().indexOf(q) >= 0; });
    var plain = codes.filter(function (c) { return TEAM_PRIVATE.indexOf(c[0]) < 0; }), priv = codes.filter(function (c) { return TEAM_PRIVATE.indexOf(c[0]) >= 0; });
    return '<div class="tm-sec' + (on ? ' on' : '') + (open ? ' open' : '') + '" data-sec="' + s.id + '"><div class="tm-sec-h"><span class="tm-sec-ic">' + i(TEAM_SEC_ICONS[s.id] || 'point') + '</span><div class="grow tm-sec-t"><div class="row wrap gap6"><b>' + esc(s.name) + '</b>' + (s.money ? '<span class="tm-rm" title="Involves money">' + i('lock') + 'RM</span>' : '') + (on ? UI.chip(n + ' of ' + s.codes.length + ' allowed', 'pri') : UI.chip('Off', 'grey')) + '</div><div class="b2">' + esc(s.desc) + '</div></div>' +
      '<label class="sw" title="' + esc(secLock || (on ? 'Switch the whole section off' : 'Switch the section on')) + '"><input type="checkbox" data-tacc-sec="' + s.id + '"' + (on ? ' checked' : '') + (secLock ? ' disabled' : '') + ' aria-label="' + esc(s.name) + '"><span></span></label>' +
      '<button type="button" class="ib sm" data-tacc-exp="' + s.id + '" aria-expanded="' + open + '" aria-label="Show the actions of ' + esc(s.name) + '">' + i(open ? 'chevron-up' : 'chevron-down') + '</button></div>' +
      (on ? teamReqHtml(st, s) : '') +
      (open ? '<div class="tm-codes">' + plain.map(function (c) { return teamCodeRow(st, c); }).join('') +
        (priv.length ? '<div class="tm-priv"><div class="tm-priv-h">' + i('eye-off') + '<b>Private car details</b></div><p class="b2">Switch these off for anyone who should not see who owns a car, what the car costs each month, or the owner\'s papers. Only administrators can change them.</p>' + priv.map(function (c) { return teamCodeRow(st, c); }).join('') + '</div>' : '') + '</div>' : '') + '</div>';
  }).join('');
}
function teamAccessDiff(a, b) { var plus = 0, minus = 0; PERM_CODES.forEach(function (c) { if (a[c] && !b[c]) plus++; if (!a[c] && b[c]) minus++; }); return { plus: plus, minus: minus }; }
/* draws the editor into el and wires it; returns {draw}; onChange() after every switch */
function teamAccessEditor(el, st, onChange) {
  function top() {
    var n = teamSectionsOn(st.cur), out = '<div class="row wrap gap8 tm-acc-top"><b class="grow">' + n + ' of ' + PERM_SECTIONS.length + ' sections on</b><button type="button" class="btn tonal sm" data-tacc-preview>' + i('eye') + 'Preview menu</button></div>';
    if (st.person) {
      var roles = D().roles.filter(function (r) { return r.key !== 'owner'; });
      var r = st.roleId ? byId(D().roles, st.roleId) : null, diff = st.base ? teamAccessDiff(st.cur, st.base) : null;
      out += '<div class="tm-tpl">' + UI.select({ key: 'tacc-tpl', label: 'Start from template (optional)', value: st.roleId || '', options: [['', 'No template (choose every switch yourself)']].concat(roles.map(function (x) { return [x.id, x.name]; })), disabled: !!st.locked, attrs: { 'data-tacc-tpl': '1' } }) +
        (r ? '<p class="b2">' + esc(r.desc) + '</p>' : '') +
        (r ? (diff.plus || diff.minus ? '<div class="row wrap gap8 tm-diff">' + UI.chip('Differs from the template: + ' + diff.plus + ' / - ' + diff.minus, 'warn') + (st.locked ? '' : '<button type="button" class="btn t sm" data-tacc-back>' + i('arrow-back-up') + 'Back to the template</button>') + '</div>' : '<p class="b2">' + i('circle-check') + ' The switches match the template exactly. If the template changes later, so does this person.</p>') : '<p class="b2">No template: every switch is chosen for this person only.</p>') + '</div>';
    }
    if (st.locked) out += UI.alert(st.locked, 'warn', { icon: 'lock' });
    out += '<div class="row wrap gap8 tm-acc-tools"><div class="inp srch grow">' + i('search') + '<input type="search" data-tacc-q placeholder="Search sections and actions, e.g. &quot;delete&quot; or &quot;amounts&quot;" aria-label="Search sections and actions" value="' + esc(st.q || '') + '"></div><button type="button" class="btn t sm" data-tacc-expall>' + (PERM_SECTIONS.every(function (s) { return st.open[s.id]; }) ? 'Collapse all' : 'Expand all') + '</button></div>' +
      '<div class="row wrap gap8 tm-legend"><span class="tm-rm">' + i('lock') + 'RM</span><span class="b2">involves money</span>' + (st.person ? UI.chip('Only for this person', 'ok') + UI.chip('Off for this person', 'warn') : '') + '</div>';
    return out;
  }
  function draw() {
    var sc = el.closest('.ui-drw-b'), y = sc ? sc.scrollTop : 0;
    el.innerHTML = '<div class="tm-acc-head">' + top() + '</div><div class="tm-acc-list">' + teamAccessList(st) + '</div>';
    if (sc) sc.scrollTop = y;
  }
  el.addEventListener('input', function (ev) { if (ev.target.matches('[data-tacc-q]')) { st.q = ev.target.value; el.querySelector('.tm-acc-list').innerHTML = teamAccessList(st); } });
  el.addEventListener('change', function (ev) {
    var t = ev.target, k;
    if ((k = t.getAttribute('data-tacc-sec'))) {
      var s = PERM_SECTIONS.filter(function (x) { return x.id === k; })[0];
      if (t.checked) { var fromBase = st.base ? s.codes.filter(function (c) { return st.base[c[0]]; }) : []; (fromBase.length ? fromBase : [s.codes[0]]).forEach(function (c) { if (teamCanChange(c[0])) st.cur[c[0]] = 1; }); st.cur[s.codes[0][0]] = 1; }
      else s.codes.forEach(function (c) { if (teamCanChange(c[0])) delete st.cur[c[0]]; });
      draw(); onChange && onChange(); return;
    }
    if ((k = t.getAttribute('data-tacc-code'))) {
      if (t.checked) { st.cur[k] = 1; var sec = TEAM_CODE[k].sec; st.cur[sec.codes[0][0]] = 1; }
      else { delete st.cur[k]; var sec2 = TEAM_CODE[k].sec; if (k === sec2.codes[0][0]) sec2.codes.forEach(function (c) { delete st.cur[c[0]]; }); }
      draw(); onChange && onChange(); return;
    }
    if (t.matches('[data-tacc-tpl]')) {
      var val = t.value, prev = st.roleId || '', dd = st.base ? teamAccessDiff(st.cur, st.base) : { plus: 0, minus: 0 }, nch = dd.plus + dd.minus;
      var apply = function () { st.roleId = val; st.base = teamRoleSet(val); st.baseName = val ? byId(D().roles, val).name : 'the template'; st.cur = Object.assign({}, st.base); draw(); onChange && onChange(); };
      if (!nch) { apply(); return; }
      UI.confirm({ title: 'Start again from the template?', text: nch === 1 ? 'The 1 switch change you made will be replaced.' : 'The ' + nch + ' switch changes you made will be replaced.', ok: 'Start again', cancel: 'Keep my changes' }).then(function (y) { if (y) apply(); else t.value = prev; });
    }
  });
  el.addEventListener('click', function (ev) {
    var t = ev.target, x;
    if ((x = t.closest('[data-tacc-exp]'))) { var id = x.getAttribute('data-tacc-exp'); st.open[id] = !st.open[id]; draw(); return; }
    if (t.closest('[data-tacc-expall]')) { var all = PERM_SECTIONS.every(function (s) { return st.open[s.id]; }); PERM_SECTIONS.forEach(function (s) { st.open[s.id] = !all; }); draw(); return; }
    if ((x = t.closest('[data-tacc-reset]'))) { var c = x.getAttribute('data-tacc-reset'); if (st.base[c]) st.cur[c] = 1; else delete st.cur[c]; draw(); onChange && onChange(); return; }
    if ((x = t.closest('[data-tacc-req]'))) { permMissing(st.cur, x.getAttribute('data-tacc-req')).forEach(function (c) { if (!teamCanChange(c)) return; st.cur[c] = 1; var sx = TEAM_CODE[c] && TEAM_CODE[c].sec; if (sx) st.cur[sx.codes[0][0]] = 1; }); draw(); onChange && onChange(); return; }
    if (t.closest('[data-tacc-back]')) { st.cur = Object.assign({}, st.base); draw(); onChange && onChange(); return; }
    if ((x = t.closest('[data-tacc-preview]'))) { UI.popover(x, '<div class="tm-pv"><div class="h6">Pages in their menu</div>' + teamPagesHtml(st.cur) + '</div>', { width: 360 }); }
  });
  draw();
  return { draw: draw };
}
function teamChangeList(a, b) {
  var out = [];
  PERM_CODES.forEach(function (c) { if (!!a[c] !== !!b[c]) { var x = TEAM_CODE[c]; out.push({ f: x.sec.name + ': ' + x.name, from: a[c] ? 'On' : 'Off', to: b[c] ? 'On' : 'Off' }); } });
  return out;
}

/* ---------------- person drawer (a login) ---------------- */
function teamOpenPerson(id, tab) {
  var d = D();
  var u = userById(id, d);
  if (!u) { var e = employeeById(id, d); if (e) { if (e.login && userById(e.login, d)) u = userById(e.login, d); else { teamAgentDrawer(e); return; } } }
  if (!u) { UI.toast('That person is not on the team any more.', { tone: 'warn' }); return; }
  var m = me(), self = m && u.id === m.id;
  var more = teamMoreThanMe(u);
  var lockReason = u.superAdmin ? 'This is the super-admin. They can use everything, and that cannot be changed.' : self ? 'This is you. You cannot change your own access.' : more ? 'Has more access than you. Only someone who can use at least everything they can may change their access.' : !can('users.edit') ? 'You can see this person\'s access but not change it.' : null;
  var st = { tab: tab || 'login', login: null, acc: null };
  function resetAcc() { var base = teamRoleSet(u.role); st.acc = { cur: teamUserSet(u), base: base, baseName: teamRole(u) ? teamRole(u).name : 'the template', roleId: u.role || '', q: '', open: {}, locked: lockReason, person: true }; st.saved = Object.assign({}, st.acc.cur); st.savedRole = u.role || ''; }
  resetAcc();
  var accChanges = function () { return st.acc ? teamChangeList(st.saved, st.acc.cur).length + ((st.acc.roleId || '') !== st.savedRole ? 1 : 0) : 0; };
  var loginDirty = function () { if (!st.loginEl) return false; var f = UI.form(st.loginEl); return f.name !== u.name || f.username !== u.username || (f.email || '') !== (u.email || '') || (f.agent || '') !== (u.agent || ''); };
  var header = function () {
    return '<div class="row gap12 tm-dh">' + UI.avatar(u.name) + '<div class="grow"><h2>' + esc(u.name) + '</h2><div class="row wrap gap6"><span class="b2">Username: <b>' + esc(u.username) + '</b></span>' + UI.chip('Template: ' + teamRoleName(u), 'pri') + (!u.active ? UI.chip('Switched off', 'grey') : '') + (self ? UI.chip('You', 'info') : '') + (u.superAdmin ? UI.chip('Super-admin', 'warn') : '') + (more ? UI.chip('Has more access than you', 'grey', { icon: 'lock' }) : '') + '</div></div></div>';
  };
  var dr;
  dr = UI.drawer({ title: u.name, width: 720, headerHtml: header(),
    dirty: function () { return loginDirty() || accChanges() > 0; },
    onClose: function () { if (CUR && CUR.ctx && S.page === 'team') CUR.ctx.setParams({ person: '', tab: '' }); },
    body: function (el, ctl) {
      dr = ctl;
      el.innerHTML = '<div class="tm-dtabs">' + UI.tabsHtml([{ id: 'login', label: 'Login', icon: 'user' }, { id: 'access', label: 'Access', icon: 'lock' }, { id: 'profile', label: 'Field profile', icon: 'id-badge-2' }, { id: 'activity', label: 'Activity', icon: 'history' }], st.tab) + '</div><div class="tm-dbody"></div>';
      var b = el.querySelector('.tm-dbody');
      st.loginEl = null;
      if (st.tab === 'login') drawLogin(b);
      else if (st.tab === 'access') { teamAccessEditor(b, st.acc, function () { setFoot(); }); }
      else if (st.tab === 'profile') drawProfile(b);
      else drawActivity(b);
      setFoot();
    }
  });
  dr.el.addEventListener('click', function (ev) { var x = ev.target.closest('[data-ui-tab]'); if (x && dr.el.querySelector('.tm-dtabs').contains(x)) { st.tab = x.getAttribute('data-ui-tab'); if (CUR && CUR.ctx && S.page === 'team') CUR.ctx.setParams({ person: u.id, tab: st.tab }); dr.refresh(); } });
  function setFoot() {
    if (st.tab === 'login') dr.setFoot([{ label: 'Discard', kind: 'o', close: false, onClick: function () { dr.refresh(); } }, { label: 'Save details', icon: 'device-floppy', close: false, disabled: !can('users.edit') && !self, onClick: saveLogin }]);
    else if (st.tab === 'access') {
      var n = accChanges();
      dr.setFoot(lockReason ? null : '<span class="b2 grow tm-chg">' + (n ? '<b>' + plural(n, 'change') + '</b> not saved yet' : 'No changes') + '</span><button type="button" class="btn o" data-tm-disc' + (n ? '' : ' disabled') + '>Discard</button><button type="button" class="btn c" data-tm-saveacc' + (n ? '' : ' disabled') + '>' + i('device-floppy') + 'Save access</button>');
    } else dr.setFoot(null);
  }
  dr.el.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-tm-disc]')) { resetAcc(); dr.refresh(); return; }
    if (ev.target.closest('[data-tm-saveacc]')) saveAccess();
  });
  function saveAccess() {
    var base = teamRoleSet(st.acc.roleId), cur = st.acc.cur, changes = teamChangeList(st.saved, cur);
    if ((st.acc.roleId || '') !== st.savedRole) changes.unshift({ f: 'Template', from: st.savedRole ? byId(D().roles, st.savedRole).name : 'None', to: st.acc.roleId ? byId(D().roles, st.acc.roleId).name : 'None' });
    if (teamBreaksFull(u, cur)) { UI.toast(TEAM_GUARD, { tone: 'warn' }); return; }
    var extra = PERM_CODES.filter(function (c) { return cur[c] && !base[c]; }), removed = PERM_CODES.filter(function (c) { return !cur[c] && base[c]; });
    DB.update('users', u, { role: st.acc.roleId || null, extra: extra, removed: removed }, { action: 'Access change', where: 'Team member', text: me().name + ' changed what ' + u.name + ' can use', changes: changes });
    resetAcc(); dr.setHeader(header()); dr.refresh(); UI.toast('Access saved. ' + u.name + ' now has ' + teamSectionsOn(teamUserSet(u)) + ' of ' + PERM_SECTIONS.length + ' sections on.');
  }
  function drawLogin(b) {
    var free = D().employees.filter(function (e) { return !e.login || e.login === u.id; });
    var ro = (!can('users.edit') && !self) || more;
    b.innerHTML = '<div class="grid g2 tm-form">' + UI.input({ key: 'name', label: 'Name', required: true, value: u.name, help: 'Shown in the team list and the activity log.', readonly: ro }) + UI.input({ key: 'username', label: 'Username', required: true, value: u.username, help: 'What they type to sign in. Every person needs their own; never share one.', readonly: ro }) +
      UI.input({ key: 'email', label: 'Email (optional)', type: 'email', value: u.email || '', readonly: ro }) + UI.select({ key: 'agent', label: 'Linked field profile (optional)', value: u.agent || '', options: [['', 'None']].concat(free.map(function (e) { return [e.id, e.name]; })), help: 'Connects this login to a field-agent profile, so tasks given to that agent show up for this person.', disabled: ro }) + '</div>' +
      '<div class="tm-box"><div class="h6">' + i('key') + 'Password</div><p class="b2">' + (u.pwSetAt ? 'Last set ' + UI.fmt.ago(u.pwSetAt) + '. ' : '') + 'Passwords are never shown. Set a new one and pass it on to them yourself.</p>' + UI.btn('Set a new password', { kind: 'o', size: 'sm', icon: 'key', disabled: (!can('users.reset_password') && !self) || more, attrs: { 'data-tm-pw': '1' } }) + '</div>' +
      '<div class="tm-box"><div class="h6">' + i('user-check') + 'Login</div><div class="row wrap gap8">' + UI.status('active', u.active ? 'Active' : 'Switched off') + '<span class="b2">' + (u.active ? 'Can sign in. Last signed in ' + (u.lastSignIn ? UI.fmt.ago(u.lastSignIn) : 'never') + '.' : 'Cannot sign in until the login is switched back on. Their history stays.') + '</span></div>' +
      (self ? UI.alert('This is you. You cannot switch off your own login or sign yourself out from here.', 'pri') : '') +
      '<div class="row wrap gap8 mt8">' + UI.btn('Sign out everywhere', { kind: 'o', size: 'sm', icon: 'logout', disabled: self || more || !can('users.deactivate'), attrs: { 'data-tm-so': '1' } }) + UI.btn(u.active ? 'Switch login off' : 'Switch login on', { kind: u.active ? 'err' : 'c', size: 'sm', icon: u.active ? 'user-off' : 'user-check', disabled: self || more || u.superAdmin || !can('users.deactivate'), attrs: { 'data-tm-tog': '1' } }) + '</div></div>';
    st.loginEl = b;
    if (!ro) teamWireEmail(b, u);
    b.querySelector('[data-tm-pw]').addEventListener('click', function () { teamPwDialog(u); });
    b.querySelector('[data-tm-so]').addEventListener('click', function () { teamSignOut(u); });
    b.querySelector('[data-tm-tog]').addEventListener('click', function () { teamToggleLogin(u); setTimeout(function () { dr.setHeader(header()); dr.refresh(); }, 400); });
  }
  function saveLogin() {
    var f = UI.form(st.loginEl), un = String(f.username || '').trim().toLowerCase();
    if (!f.name.trim()) { UI.toast('Type the name.', { tone: 'warn' }); return false; }
    if (!/^[a-z0-9._]{3,30}$/.test(un)) { UI.toast('The username needs 3 to 30 small letters, numbers, dots or underscores.', { tone: 'warn' }); return false; }
    if (D().users.some(function (x) { return x !== u && x.username === un; })) { UI.toast('Someone already has the username "' + un + '". Every person needs their own.', { tone: 'warn' }); return false; }
    var oldAgent = u.agent;
    DB.update('users', u, { name: f.name.trim(), username: un, email: f.email.trim(), agent: f.agent || null }, { where: 'Team member', text: me().name + ' changed the login details of ' + f.name.trim() });
    if (oldAgent !== (f.agent || null)) { var oe = employeeById(oldAgent); if (oe) oe.login = null; var ne = employeeById(f.agent); if (ne) ne.login = u.id; }
    dr.setHeader(header()); dr.refresh(); UI.toast('Details saved.'); return false;
  }
  function drawProfile(b) {
    var e = u.agent ? employeeById(u.agent) : null;
    if (!e) { b.innerHTML = UI.empty({ icon: 'id-badge-2', title: 'No field-agent profile', text: 'Add one if this person delivers or collects cars, so tasks can be given to them.', action: can('employees.create') ? UI.btn('Add a field-agent profile', { icon: 'plus', attrs: { 'data-tm-addp': '1' } }) : '' }); var ab = b.querySelector('[data-tm-addp]'); if (ab) ab.addEventListener('click', function () { teamEmployeeDrawer(null, { name: u.name, email: u.email, login: u.id }, function () { dr.refresh(); }); }); return; }
    b.innerHTML = teamAgentFacts(e) + '<div class="row wrap gap8 mt8">' + UI.btn('Edit profile and documents', { kind: 'o', size: 'sm', icon: 'edit', disabled: !can('employees.edit'), attrs: { 'data-tm-ep': '1' } }) + UI.btn(e.active ? 'Switch off' : 'Switch on', { kind: 'o', size: 'sm', icon: e.active ? 'user-off' : 'user-check', disabled: !can('employees.edit'), attrs: { 'data-tm-et': '1' } }) + UI.btn('Delete profile', { kind: 'err', size: 'sm', icon: 'trash', disabled: !can('employees.delete'), attrs: { 'data-tm-ed': '1' } }) + '</div>';
    teamWireFacts(b, e);
    b.querySelector('[data-tm-ep]').addEventListener('click', function () { teamEmployeeDrawer(e, null, function () { dr.refresh(); }); });
    b.querySelector('[data-tm-et]').addEventListener('click', function () { teamToggleAgent(e, function () { dr.refresh(); }); });
    b.querySelector('[data-tm-ed]').addEventListener('click', function () { teamDeleteAgent(e, function () { dr.refresh(); }); });
  }
  var shown = 10;
  function drawActivity(b) {
    var rows = D().activity.filter(function (a) { return a.ref === u.id || a.who === u.name; });
    b.innerHTML = '<div class="row wrap gap8 mb16"><span class="b2 grow">' + plural(rows.length, 'entry').replace('entrys', 'entries') + ' by or about ' + esc(u.name) + '</span>' + (can('users.view_audit') ? UI.btn('Open in the activity log', { kind: 'o', size: 'sm', icon: 'history', attrs: { 'data-tm-log': '1' } }) : '') + '</div>' +
      (rows.length ? '<div class="tm-alist">' + rows.slice(0, shown).map(function (a) { return '<div class="tm-aline"><span class="chip grey">' + esc(a.action) + '</span><div class="grow"><div>' + esc(a.text) + '</div><div class="b2">' + UI.fmt.dateTime(a.at) + ' · ' + esc(a.where) + '</div></div></div>'; }).join('') + '</div>' + (rows.length > shown ? '<div class="mt8">' + UI.btn('Show older', { kind: 't', size: 'sm', icon: 'chevron-down', attrs: { 'data-tm-more': '1' } }) + '</div>' : '') : UI.empty({ icon: 'history', title: 'Nothing yet', text: 'What this person does shows up here.' }));
    var mo = b.querySelector('[data-tm-more]'); if (mo) mo.addEventListener('click', function () { shown += 10; drawActivity(b); });
    var lg = b.querySelector('[data-tm-log]'); if (lg) lg.addEventListener('click', function () { dr.close(true); go('activity', { person: u.name }); });
  }
  return dr;
}

/* ---------------- field agents ---------------- */
function teamDocLink(doc, label) {
  if (!doc) return '<span class="faint">Not uploaded</span>';
  return can('employees.view_documents') ? '<button type="button" class="btn t sm" data-tm-doc="' + esc(label) + '">' + i('file-text') + esc(doc.name) + '</button>' : '<span class="b2">' + i('lock') + ' Uploaded (needs "See employee documents")</span>';
}
function teamAgentFacts(e) {
  return '<div class="grid g2 tm-facts">' + UI.kv('Name', esc(e.name)) + UI.kv('WhatsApp number', UI.phone(e.wa, { wa: true })) + UI.kv('Email', esc(e.email || '')) + UI.kv('Blood group', esc(e.blood || '')) +
    UI.kv('Emergency contact', esc(e.emergency ? e.emergency.name : '')) + UI.kv('Relation and number', e.emergency ? esc(e.emergency.rel) + ' · ' + UI.phone(e.emergency.phone) : '') +
    UI.kv('ID card', teamDocLink(e.docs && e.docs.idCard, 'idCard')) + UI.kv('Proof of address', teamDocLink(e.docs && e.docs.poa, 'poa')) + '</div>';
}
function teamWireFacts(el, e) {
  el.querySelectorAll('[data-tm-doc]').forEach(function (b) { b.addEventListener('click', function () { teamViewDoc(e, b.getAttribute('data-tm-doc')); }); });
}
function teamViewDoc(e, k) {
  var doc = e.docs[k], lbl = k === 'idCard' ? 'ID card' : 'Proof of address';
  DB.log('Viewed a document', 'Team member', e.id, me().name + ' opened the ' + lbl.toLowerCase() + ' of ' + e.name);
  UI.dialog({ title: lbl + ' of ' + e.name, width: 'md', body: doc.dataUrl && isImgSrc(doc.dataUrl) ? '<img src="' + doc.dataUrl + '" alt="' + esc(lbl) + '" style="max-width:100%;border-radius:8px">' : '<div class="tm-docph">' + i('file-text') + '<b>' + esc(doc.name) + '</b><span class="b2">' + UI.fmt.size(doc.size) + ' · sample file, no real document is stored</span></div>', buttons: [{ label: 'Close' }] });
}
function teamToggleAgent(e, after) {
  var lu = e.login ? userById(e.login) : null;
  if (e.active) {
    var pend = D().tasks.filter(function (t) { return t.agents.indexOf(e.id) >= 0 && (t.status === 'Pending' || t.status === 'In Progress'); });
    var withLogin = lu && lu.active && !lu.superAdmin;
    if (withLogin && teamBreaksFull(lu, null, false)) { UI.toast(TEAM_GUARD, { tone: 'warn' }); return; }
    UI.confirm({ title: 'Switch off ' + e.name + '?', text: 'They will not be given new tasks. Their name stays on past bookings and tasks.' + (pend.length ? ' They still have ' + plural(pend.length, 'open task') + '.' : '') + (withLogin ? ' Their login (' + lu.username + ') is switched off too, so they cannot sign in.' : ''), ok: pend.length ? 'Switch off anyway' : 'Switch off', danger: true }).then(function (y) {
      if (!y) return; DB.update('employees', e, { active: false }, { where: 'Team member', text: me().name + ' switched off field agent ' + e.name });
      if (withLogin) DB.update('users', lu, { active: false, sessions: 0 }, { action: 'Changed', where: 'Team member', text: me().name + ' switched off the login of ' + lu.name + ' with their field profile', changes: [{ f: 'Login', from: 'On', to: 'Off' }] });
      UI.toast(e.name + ' is switched off' + (withLogin ? ', and so is their login.' : '.')); after && after();
    });
  } else {
    DB.update('employees', e, { active: true }, { where: 'Team member', text: me().name + ' switched on field agent ' + e.name });
    if (lu && !lu.active) UI.toast(e.name + ' is active again. Their login is still off, so they cannot sign in yet.', { tone: 'info', action: can('users.deactivate') ? { label: 'Switch login on', run: function () { teamToggleLogin(lu); } } : null });
    else UI.toast(e.name + ' is active again.');
    after && after();
  }
}
function teamDeleteAgent(e, after) {
  var n = D().tasks.filter(function (t) { return t.agents.indexOf(e.id) >= 0; }).length;
  UI.confirm({ title: 'Delete the profile of ' + e.name + '?', text: 'This cannot be undone.' + (n ? ' Their name stays on ' + plural(n, 'task') + ' they were given.' : '') + (e.login ? ' Their login stays.' : ''), ok: 'Yes, Delete', danger: true }).then(function (y) {
    if (!y) return; var u = e.login ? userById(e.login) : null; if (u) u.agent = null;
    DB.remove('employees', e, { where: 'Team member', text: me().name + ' deleted the field-agent profile of ' + e.name }); UI.toast('Profile deleted.'); UI.closeAll(); after && after();
  });
}
function teamAgentDrawer(e) {
  var dr = UI.drawer({ title: e.name, width: 620, live: true,
    onClose: function () { if (CUR && CUR.ctx && S.page === 'team') CUR.ctx.setParams({ person: '' }); },
    headerHtml: '<div class="row gap12 tm-dh">' + UI.avatar(e.name) + '<div class="grow"><h2>' + esc(e.name) + '</h2><div class="row wrap gap6">' + UI.chip('Field agent', 'grey') + UI.chip('No login: cannot sign in', 'grey') + (!e.active ? UI.chip('Switched off', 'grey') : '') + '</div></div></div>',
    body: function (el) {
      if (D().employees.indexOf(e) < 0) { el.innerHTML = UI.empty({ icon: 'user-off', title: 'This profile was deleted' }); return; }
      var tasks = D().tasks.filter(function (t) { return t.agents.indexOf(e.id) >= 0; }).sort(function (a, b) { return b.at - a.at; });
      el.innerHTML = teamAgentFacts(e) +
        '<div class="tm-box"><div class="h6">' + i('user-plus') + 'Sign-in</div><p class="b2">Give ' + esc(e.name.split(' ')[0]) + ' their own username and password if they should use the dashboard. They start with no access.</p>' + UI.btn('Give a login', { size: 'sm', icon: 'user-plus', disabled: !can('users.create'), attrs: { 'data-tm-gl': '1' } }) + '</div>' +
        '<div class="tm-box"><div class="h6">' + i('checklist') + 'Tasks (' + tasks.length + ')</div>' + (tasks.length ? tasks.slice(0, 5).map(function (t) { return '<div class="tm-aline">' + UI.status('task', t.status) + '<div class="grow"><div>' + esc(t.name) + '</div><div class="b2">' + UI.fmt.dateTime(t.at) + '</div></div></div>'; }).join('') : '<p class="b2">No tasks yet.</p>') + '</div>' +
        '<div class="row wrap gap8 mt8">' + UI.btn('Edit profile and documents', { kind: 'o', size: 'sm', icon: 'edit', disabled: !can('employees.edit'), attrs: { 'data-tm-ep': '1' } }) + UI.btn(e.active ? 'Switch off' : 'Switch on', { kind: 'o', size: 'sm', icon: e.active ? 'user-off' : 'user-check', disabled: !can('employees.edit'), attrs: { 'data-tm-et': '1' } }) + UI.btn('Delete profile', { kind: 'err', size: 'sm', icon: 'trash', disabled: !can('employees.delete'), attrs: { 'data-tm-ed': '1' } }) + '</div>';
      teamWireFacts(el, e);
      el.querySelector('[data-tm-gl]').addEventListener('click', function () { dr.close(true); teamLoginDrawer({ employee: e }); });
      el.querySelector('[data-tm-ep]').addEventListener('click', function () { teamEmployeeDrawer(e); });
      el.querySelector('[data-tm-et]').addEventListener('click', function () { teamToggleAgent(e); });
      el.querySelector('[data-tm-ed]').addEventListener('click', function () { teamDeleteAgent(e); });
    } });
  return dr;
}
/* a form problem: the fields turn red with their message, the first one scrolls into view and gets the cursor, and a
   toast says it too (the old line at the bottom of a long form was off screen on a phone).
   marks: [[key, message], ...]; returns false so a footer button keeps the drawer open */
function teamMark(body, marks, toast) {
  body.querySelectorAll('.tm-bad').forEach(function (x) { x.classList.remove('bad', 'tm-bad'); var s = x.querySelector('.tm-ferr'); if (s) s.remove(); });
  var first = null;
  marks.forEach(function (m) {
    var f = body.querySelector('[data-key="' + m[0] + '"]'), box = f && f.closest('.inp'); if (!box) return;
    box.classList.add('bad', 'tm-bad'); var s = document.createElement('span'); s.className = 'ui-err tm-ferr'; s.textContent = m[1]; box.appendChild(s);
    if (!first) first = f;
  });
  if (first) { var bx = first.closest('.inp'); if (bx.scrollIntoView) bx.scrollIntoView({ block: 'center', behavior: 'smooth' }); try { first.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  UI.toast(toast || (marks[0] && marks[0][1]) || 'Check the fields marked in red.', { tone: 'warn' });
  return false;
}
/* New / Edit Employee (field agent) */
function teamEmployeeDrawer(e, prefill, after) {
  var isNew = !e, p = prefill || {}, docs = { idCard: e && e.docs ? e.docs.idCard : null, poa: e && e.docs ? e.docs.poa : null };
  var v = e ? { name: e.name, wa: e.wa, email: e.email, blood: e.blood, en: e.emergency ? e.emergency.name : '', er: e.emergency ? e.emergency.rel : '', ep: e.emergency ? e.emergency.phone : '' } : { name: p.name || '', wa: '', email: p.email || '', blood: '', en: '', er: '', ep: '' };
  var docRow = function (k, label) {
    var x = docs[k];
    return '<div class="tm-docrow"><span class="tm-doci">' + i(x ? 'file-text' : 'upload') + '</span><div class="grow"><div class="t1c">' + label + '</div><div class="b2">' + (x ? esc(x.name) + ' · ' + UI.fmt.size(x.size) : 'Not uploaded') + '</div></div><label class="btn o sm">' + i('upload') + (x ? 'Replace' : 'Upload') + '<input type="file" accept="image/*,.pdf" data-tm-up="' + k + '" hidden></label>' + (x ? UI.iconBtn('trash', 'Remove', { size: 'sm', attrs: { 'data-tm-rm': k } }) : '') + '</div>';
  };
  var dr = UI.drawer({ title: isNew ? 'New Employee' : 'Edit Employee', subtitle: isNew ? 'A field agent who delivers and collects cars' : e.name, width: 620,
    dirty: function (d2) { var f = UI.form(d2.body); return f.name !== v.name || f.wa !== v.wa; },
    body: function (el) {
      el.innerHTML = '<div class="tm-fsec">PERSONAL INFO</div><div class="grid g2 tm-form">' + UI.input({ key: 'name', label: 'Full Name', required: true, value: v.name }) + UI.input({ key: 'wa', label: 'WhatsApp Number', required: true, value: v.wa, placeholder: '+60 00-000 0000', help: 'Tasks are sent here.' }) + UI.input({ key: 'email', label: 'Email', type: 'email', value: v.email }) + UI.select({ key: 'blood', label: 'Blood Group', value: v.blood, placeholder: 'Choose', options: LISTS.bloodGroups }) + '</div>' +
        '<div class="tm-fsec">EMERGENCY CONTACT</div><div class="grid g2 tm-form">' + UI.input({ key: 'en', label: 'Name', required: true, value: v.en }) + UI.select({ key: 'er', label: 'Relation', required: true, value: v.er, placeholder: 'Choose', options: LISTS.relationships }) + UI.input({ key: 'ep', label: 'Phone Number', required: true, value: v.ep, placeholder: '+60 00-000 0000' }) + '</div>' +
        '<div class="tm-fsec">DOCUMENTS</div><div class="tm-docs">' + docRow('idCard', 'ID card') + docRow('poa', 'Proof of address') + '</div><p class="ui-err tm-err" hidden></p>';
      el.querySelectorAll('[data-tm-up]').forEach(function (inp) { inp.addEventListener('change', function () { var f = inp.files[0], k = inp.getAttribute('data-tm-up'); if (!f) return; UI.readImage(f, { max: 1400 }).then(function (r) { v = Object.assign(v, UI.form(el)); docs[k] = { name: r.name, size: r.size, dataUrl: r.dataUrl }; dr.refresh(); }); }); });
      el.querySelectorAll('[data-tm-rm]').forEach(function (b) { b.addEventListener('click', function () { v = Object.assign(v, UI.form(el)); docs[b.getAttribute('data-tm-rm')] = null; dr.refresh(); }); });
    },
    foot: [{ label: 'Cancel', kind: 'o', close: false, onClick: function (d2) { d2.close(); } }, { label: isNew ? 'Create' : 'Update', icon: 'check', onClick: function (d2) {
      var f = UI.form(d2.body), miss = [];
      if (!f.name.trim()) miss.push(['name', 'Type the full name.', 'Full Name']); if (!f.wa.trim()) miss.push(['wa', 'Type the WhatsApp number.', 'WhatsApp Number']); if (!f.en.trim()) miss.push(['en', 'Type the emergency contact name.', 'emergency contact Name']); if (!f.er) miss.push(['er', 'Choose the relation.', 'Relation']); if (!f.ep.trim()) miss.push(['ep', 'Type the phone number.', 'Phone Number']);
      if (miss.length) return teamMark(d2.body, miss, 'Fill in: ' + miss.map(function (m) { return m[2]; }).join(', ') + '.');
      var rec = { name: f.name.trim(), wa: f.wa.trim(), email: f.email.trim(), blood: f.blood, emergency: { name: f.en.trim(), rel: f.er, phone: f.ep.trim() }, docs: { idCard: docs.idCard, poa: docs.poa } };
      if (isNew) { rec.active = true; rec.login = p.login || null; var ne = DB.add('employees', rec, { where: 'Team member', text: me().name + ' added field agent ' + rec.name }); if (p.login) { var u = userById(p.login); if (u) u.agent = ne.id; } UI.toast(rec.name + ' added. Tasks can now be given to them.'); }
      else { DB.update('employees', e, rec, { where: 'Team member', text: me().name + ' changed the profile of ' + rec.name }); UI.toast('Profile updated.'); }
      after && after();
    } }] });
  return dr;
}
/* New login (Add person > Person who signs in, or Give a login to a field agent) */
function teamLoginDrawer(o) {
  o = o || {};
  var e = o.employee || null, free = D().employees.filter(function (x) { return !x.login; });
  var guess = e ? e.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') : '';
  if (guess && D().users.some(function (x) { return x.username === guess; })) guess += '2';
  var dr = UI.drawer({ title: e ? 'Give ' + e.name + ' a login' : 'New login', subtitle: 'A person who signs in to the dashboard', width: 620,
    dirty: function (d2) { var f = UI.form(d2.body); return !!(f.name && !e) || !!f.password; },
    body: function (el) {
      el.innerHTML = '<div class="grid g2 tm-form">' + UI.input({ key: 'name', label: 'Name', required: true, value: e ? e.name : '', help: 'Shown in the team list and the activity log.' }) + UI.input({ key: 'username', label: 'Username', required: true, value: guess, help: 'What they type to sign in. Every person needs their own; never share one.' }) +
        UI.input({ key: 'email', label: 'Email (optional)', type: 'email', value: e ? e.email : '' }) + UI.select({ key: 'agent', label: 'Linked field profile (optional)', value: e ? e.id : '', options: [['', 'None']].concat((e ? [e] : []).concat(free.filter(function (x) { return x !== e; })).map(function (x) { return [x.id, x.name]; })) }) +
        UI.select({ key: 'role', label: 'Start from template', value: 'role-none', options: D().roles.filter(function (r) { return r.key !== 'owner'; }).map(function (r) { return [r.id, r.name]; }), help: 'New logins start with No access. You can switch features on in the Access tab later.', full: true }) + teamPwFields('Password') + '</div>' +
        UI.alert('Choose a password and pass it on to them yourself. It is never shown again.', 'pri');
      teamWirePw(el, function () { return el.querySelector('[data-key="username"]').value.trim().toLowerCase(); }, function () { var f = UI.form(el), ag = f.agent ? employeeById(f.agent) : null; return { name: f.name, phone: ag ? ag.wa : '' }; });
      teamWireEmail(el, null);
    },
    foot: [{ label: 'Cancel', kind: 'o', close: false, onClick: function (d2) { d2.close(); } }, { label: 'Add login', icon: 'user-plus', onClick: function (d2) {
      var f = UI.form(d2.body), un = String(f.username || '').trim().toLowerCase(), bad = function (t, key) { return teamMark(d2.body, [[key, t]]); };
      if (!f.name.trim()) return bad('Type the name.', 'name');
      if (!/^[a-z0-9._]{3,30}$/.test(un)) return bad('The username needs 3 to 30 small letters, numbers, dots or underscores.', 'username');
      if (D().users.some(function (x) { return x.username === un; })) return bad('Someone already has the username "' + un + '". Every person needs their own.', 'username');
      if (!teamPwOk(f.password, un)) return bad('The password does not follow the rules yet.', 'password');
      var u = DB.add('users', { name: f.name.trim(), username: un, email: f.email.trim(), role: f.role || 'role-none', extra: [], removed: [], active: true, superAdmin: false, agent: f.agent || null, lastSignIn: null, created: NOW(), pwSetAt: NOW() }, { where: 'Team member', text: me().name + ' added a login for ' + f.name.trim() });
      if (f.agent) { var ag = employeeById(f.agent); if (ag) ag.login = u.id; }
      UI.toast('Login added for ' + u.name + '. Pass the password on to them yourself.');
      setTimeout(function () { teamOpenPerson(u.id, 'access'); }, 200);
    } }] });
  return dr;
}

/* ---------------- who can see what (grid) ---------------- */
function teamGridCell(u, s) {
  var set = teamUserSet(u), on = teamSecOn(set, s), base = teamRoleSet(u.role), inBase = !!base[s.codes[0][0]], m = me();
  var tone = u.superAdmin ? 'role' : on ? (inBase ? 'role' : 'mine') : (inBase ? 'offmine' : 'off');
  var lock = u.superAdmin ? 'The super-admin can use everything.' : m && u.id === m.id ? 'You cannot change your own access.' : teamMoreThanMe(u) ? 'Has more access than you.' : !can('users.manage_roles') ? 'You need the "Manage roles" right to change this.' : teamLockMsg(s.codes[0][0]) || '';
  var miss = on && !u.superAdmin ? permMissing(set, s.id) : [];
  var title = { role: 'On, from their role', mine: 'On, only for this person', off: 'Off', offmine: 'Off, only for this person' }[tone] + (lock ? '. ' + lock : '') + (miss.length ? '. Also needs ' + miss.map(teamCodeLabel).join(', ') : '');
  return '<td class="c"><div class="tm-cell t-' + tone + '" title="' + esc(title) + '"><label class="sw"><input type="checkbox" data-tm-grid="' + u.id + '|' + s.id + '"' + (on ? ' checked' : '') + (lock ? ' disabled' : '') + ' aria-label="' + esc(s.name + ' for ' + u.name) + '"><span></span></label><small>' + (on ? teamSecCount(set, s) + '/' + s.codes.length : 'off') + (miss.length ? ' ' + i('alert-triangle', 'tm-gwarn') : '') + '</small></div></td>';
}
function teamGridToggle(u, s) {
  var before = { extra: (u.extra || []).slice(), removed: (u.removed || []).slice() };
  var set = teamUserSet(u), base = teamRoleSet(u.role), on = teamSecOn(set, s);
  if (on) s.codes.forEach(function (c) { delete set[c[0]]; });
  else { var fb = s.codes.filter(function (c) { return base[c[0]]; }); (fb.length ? fb : [s.codes[0]]).forEach(function (c) { set[c[0]] = 1; }); set[s.codes[0][0]] = 1; }
  if (teamBreaksFull(u, set)) { UI.toast(TEAM_GUARD, { tone: 'warn' }); return false; }
  var save = function (st2, text, ch) { DB.update('users', u, { extra: PERM_CODES.filter(function (c) { return st2[c] && !base[c]; }), removed: PERM_CODES.filter(function (c) { return !st2[c] && base[c]; }) }, { action: 'Access change', where: 'Team member', text: text, changes: ch }); };
  save(set, me().name + (on ? ' switched off ' : ' switched on ') + '"' + s.name + '" for ' + u.name, [{ f: s.name, from: on ? 'On' : 'Off', to: on ? 'Off' : 'On' }]);
  var miss = on ? [] : permMissing(set, s.id).filter(function (c) { return teamCanChange(c); });
  if (miss.length) {
    UI.toast(s.name + ' switched on for ' + u.name + '. It also needs ' + miss.map(teamCodeLabel).join(', ') + '.', { tone: 'warn', action: { label: 'Switch it on too', run: function () {
      var s2 = teamUserSet(u); miss.forEach(function (c) { s2[c] = 1; var sx = TEAM_CODE[c].sec; s2[sx.codes[0][0]] = 1; });
      save(s2, me().name + ' switched on what "' + s.name + '" needs for ' + u.name, miss.map(function (c) { return { f: teamCodeLabel(c), from: 'Off', to: 'On' }; }));
      UI.toast('Done. ' + u.name + ' can now use ' + s.name + ' fully.');
    } } });
    return true;
  }
  UI.toast(s.name + (on ? ' switched off' : ' switched on') + ' for ' + u.name + '.', { action: { label: 'Undo', run: function () { DB.update('users', u, before, { action: 'Access change', where: 'Team member', text: me().name + ' undid the change to "' + s.name + '" for ' + u.name, changes: [{ f: s.name, from: on ? 'Off' : 'On', to: on ? 'On' : 'Off' }] }); } } });
  return true;
}

/* ---------------- templates ---------------- */
function teamTemplateDrawer(r, copyFrom) {
  var isNew = !r, view = r && r.key === 'owner', canEdit = can('users.manage_roles') && !view;
  var st = { cur: teamSet(r ? r.codes : copyFrom ? copyFrom.codes : []), base: null, q: '', open: {}, locked: view ? 'The Owner template gives everything and cannot be changed.' : !can('users.manage_roles') ? 'You need the "Manage roles" right to change templates.' : null, person: false };
  var saved = Object.assign({}, st.cur);
  var dr = UI.drawer({ title: isNew ? 'New template' : (view ? r.name : 'Edit template: ' + r.name), subtitle: isNew ? 'A ready-made set of switches to start people from' : plural(D().users.filter(function (u) { return u.role === r.id; }).length, 'person') + ' follow this template', width: 720,
    dirty: function (d2) { if (!canEdit) return false; var f = d2.body ? UI.form(d2.body) : {}; return teamChangeList(saved, st.cur).length > 0 || (f.name !== undefined && f.name.trim() !== (r ? r.name : copyFrom ? copyFrom.name + ' copy' : '')) || (f.desc !== undefined && f.desc.trim() !== (r ? r.desc || '' : '')); },
    body: function (el) {
      el.innerHTML = '<div class="grid g2 tm-form">' + UI.input({ key: 'name', label: 'Role name', required: true, value: r ? r.name : copyFrom ? copyFrom.name + ' copy' : '', readonly: !canEdit }) +
        UI.select({ key: 'from', label: 'Start from', value: '', placeholder: isNew ? 'Nothing (empty role)' : 'Keep the switches below', options: D().roles.filter(function (x) { return x !== r; }).map(function (x) { return [x.id, 'Copy ' + x.name]; }), disabled: !canEdit }) +
        UI.input({ key: 'desc', label: 'What is this role for?', value: r ? r.desc : '', placeholder: 'One sentence, e.g. "Handles the cars at weekends."', full: true, readonly: !canEdit }) + '</div><div class="tm-acc-wrap"></div>';
      var ed = teamAccessEditor(el.querySelector('.tm-acc-wrap'), st);
      el.querySelector('[data-key="from"]').addEventListener('change', function (ev) { var src = byId(D().roles, ev.target.value); st.cur = teamSet(src ? src.codes : (isNew ? [] : r.codes)); ed.draw(); });
    },
    foot: canEdit ? [{ label: 'Cancel', kind: 'o', close: false, onClick: function (d2) { d2.close(); } }, { label: isNew ? 'Create role' : 'Save role', icon: 'check', onClick: function (d2) {
      var f = UI.form(d2.body), nm = f.name.trim();
      if (!nm) { UI.toast('Give the role a name.', { tone: 'warn' }); return false; }
      if (D().roles.some(function (x) { return x !== r && x.name.toLowerCase() === nm.toLowerCase(); })) { UI.toast('A role called "' + nm + '" already exists.', { tone: 'warn' }); return false; }
      var codes = teamKeys(st.cur);
      if (isNew) { DB.add('roles', { key: 'custom-' + Date.now().toString(36), name: nm, desc: f.desc.trim(), builtIn: false, codes: codes }, { where: 'Team member', action: 'Access change', text: me().name + ' created the template ' + nm }); UI.toast('Template ' + nm + ' created.'); }
      else {
        var newSet = teamSet(codes), hit = D().users.filter(function (u) { return u.role === r.id && !u.superAdmin; });
        var after = function (u) { var x = Object.assign({}, newSet); (u.extra || []).forEach(function (c) { x[c] = 1; }); (u.removed || []).forEach(function (c) { delete x[c]; }); return x; };
        var left = D().users.filter(function (u) { return u.active && teamFull(u, hit.indexOf(u) >= 0 ? after(u) : null); }).length;
        if (left === 0 && D().users.some(function (u) { return u.active && teamFull(u); })) { UI.toast(TEAM_GUARD, { tone: 'warn' }); return false; }
        var ch = teamChangeList(saved, st.cur); DB.update('roles', r, { name: nm, desc: f.desc.trim(), codes: codes }, { where: 'Team member', action: 'Access change', text: me().name + ' changed the template ' + nm, changes: ch }); UI.toast('Template saved. Everyone who follows ' + nm + ' now has these switches.');
      }
    } }] : [{ label: 'Close' }] });
  return dr;
}
function teamCopyRole(r) {
  var nm = r.name + ' copy', k = 2; while (D().roles.some(function (x) { return x.name === nm; })) nm = r.name + ' copy ' + k++;
  DB.add('roles', { key: 'custom-' + Date.now().toString(36), name: nm, desc: r.desc, builtIn: false, codes: r.codes.slice() }, { where: 'Team member', action: 'Access change', text: me().name + ' copied the template ' + r.name + ' as ' + nm });
  UI.toast('Copied as "' + nm + '". Rename it and adjust what it allows.');
}
function teamDeleteRole(r) {
  if (r.builtIn) { UI.toast('Built-in templates cannot be deleted. Make a copy and change that instead.', { tone: 'info' }); return; }
  var users = D().users.filter(function (u) { return u.role === r.id; });
  var drop = function () { DB.remove('roles', r, { where: 'Team member', text: me().name + ' deleted the template ' + r.name }); UI.toast('Template deleted.'); };
  if (!users.length) { UI.confirm({ title: 'Delete the template ' + r.name + '?', text: 'Nobody follows it. This cannot be undone.', ok: 'Yes, Delete', danger: true }).then(function (y) { if (y) drop(); }); return; }
  var others = D().roles.filter(function (x) { return x !== r && x.key !== 'owner'; });
  var who = users.map(function (u) { return u.name; }), whoTxt = who.length > 3 ? who.slice(0, 3).join(', ') + ' and ' + (who.length - 3) + ' more' : who.join(', ');
  UI.dialog({ title: 'Delete the template ' + r.name + '?', width: 'sm',
    body: '<p class="ui-ctext">' + esc(plural(users.length, 'person').replace('persons', 'people')) + ' follow' + (users.length === 1 ? 's' : '') + ' this template: ' + esc(whoTxt) + '. Choose where to move ' + (users.length === 1 ? 'them' : 'them all') + ' first.</p>' +
      UI.select({ key: 'to', label: 'Move them to', value: '', options: [['', 'No template (they keep their switches)']].concat(others.map(function (x) { return [x.id, x.name]; })) }) +
      '<p class="b2 mt8">This cannot be undone.</p>',
    buttons: [{ label: 'Cancel', kind: 'g' }, { label: 'Move and delete', kind: 'err', icon: 'trash', onClick: function (dl) {
      var to = UI.form(dl.body).to || '', toR = to ? byId(D().roles, to) : null;
      var next = function (u) { if (!toR) return teamUserSet(u); var x = teamSet(toR.codes); return x; };
      var left = D().users.filter(function (u) { return u.active && teamFull(u, users.indexOf(u) >= 0 ? next(u) : null); }).length;
      if (left === 0 && D().users.some(function (u) { return u.active && teamFull(u); })) { UI.toast(TEAM_GUARD, { tone: 'warn' }); return false; }
      users.forEach(function (u) {
        if (toR) DB.update('users', u, { role: toR.id, extra: [], removed: [] }, { action: 'Access change', where: 'Team member', text: me().name + ' moved ' + u.name + ' from ' + r.name + ' to ' + toR.name, changes: [{ f: 'Template', from: r.name, to: toR.name }] });
        else { var set = teamUserSet(u); DB.update('users', u, { role: null, extra: teamKeys(set), removed: [] }, { action: 'Access change', where: 'Team member', text: me().name + ' took ' + u.name + ' off the template ' + r.name + '; they keep their switches', changes: [{ f: 'Template', from: r.name, to: 'None' }] }); }
      });
      drop();
    } }] });
}

/* ---------------- the page ---------------- */
PAGES['team'] = {
  title: 'Team',
  render: function (root, ctx) {
    var st = ctx.state, d = ctx.data;
    st.view = ctx.params.view === 'access' || ctx.params.view === 'templates' ? ctx.params.view : (ctx.params.view === 'people' ? 'people' : st.view || 'people');
    st.f = st.f || { show: 'all' };
    if (ctx.params.q && st.qFromAddr !== ctx.params.q) { st.f.q = ctx.params.q; st.qFromAddr = ctx.params.q; }
    var canAdd = ctx.can('users.create') || ctx.can('employees.create');
    root.innerHTML = '<div class="pg-h"><div><h1>Team</h1><p>Everyone who works for you: field agents and people who sign in. Open a person to see their details and switch what they can use on or off.</p></div><div class="acts">' +
      (ctx.can('users.view_audit') ? UI.btn('Activity log', { kind: 'tonal', icon: 'history', attrs: { 'data-act': 'log' } }) : '') + (canAdd ? UI.btn('Add person', { icon: 'user-plus', attrs: { 'data-act': 'add' } }) : '') + '</div></div>' +
      '<div id="tm-tabs" class="mb16"></div><div id="tm-body"></div>';
    UI.tabs(root.querySelector('#tm-tabs'), { items: [{ id: 'people', label: 'People', icon: 'users' }, { id: 'access', label: 'Who can see what', icon: 'table' }, { id: 'templates', label: 'Templates', icon: 'template' }], value: st.view, onChange: function (v) { st.view = v; ctx.setParams({ view: v }); body(); } });
    UI.on(root, 'click', '[data-act="log"]', function () { ctx.go('activity'); });
    UI.on(root, 'click', '[data-act="add"]', function (ev, el) { teamAddMenu(el); });
    function body() {
      var b = root.querySelector('#tm-body');
      if (st.view === 'people') people(b); else if (st.view === 'access') grid(b); else templates(b);
    }
    function people(b) {
      b.innerHTML = '<div class="card"><div class="card-b tight" id="tm-f"></div><div id="tm-t"></div></div>';
      var all = teamPeople(d);
      var filt = function () {
        var q = (st.f.q || '').toLowerCase();
        return all.filter(function (r) {
          if (st.f.show === 'agents' && r.u) return false; if (st.f.show === 'logins' && !r.u) return false; if (st.f.show === 'off' && !(r.u && !r.u.active)) return false;
          return !q || (r.name + ' ' + (r.u ? r.u.username + ' ' + r.u.email : '') + ' ' + (r.e ? r.e.wa + ' ' + r.e.email : '')).toLowerCase().indexOf(q) >= 0;
        });
      };
      var t;
      UI.filters(b.querySelector('#tm-f'), { values: st.f, fields: [{ type: 'search', key: 'q', placeholder: 'Name, username, phone or email' }, { type: 'select', key: 'show', label: 'Show', all: false, default: 'all', options: [['all', 'Everyone'], ['agents', 'Field agents without a login'], ['logins', 'People with a login'], ['off', 'Logins switched off']] }],
        extra: '<span class="b2 tm-count"></span>', onChange: function () { var r = filt(); t.setRows(r); cnt(r); } });
      var cnt = function (r) { var c = b.querySelector('.tm-count'); if (c) c.textContent = plural(r.length, 'person').replace('persons', 'people'); };
      t = UI.table(b.querySelector('#tm-t'), { rows: filt(), rowKey: 'key', density: 'compact', pageSize: 25, pageSizes: [10, 25, 50, 100], minWidth: 960,
        columns: [{ key: 'name', label: 'Person', sort: true, render: teamPersonCell }, { key: 'is', label: 'Is', render: teamIsCell }, { key: 'acc', label: 'Access', render: teamAccessCell, width: 300 }, { key: 'st', label: 'Status', render: teamStatusCell }, { key: 'last', label: 'Last signed in', sort: function (r) { return r.u && r.u.lastSignIn ? +r.u.lastSignIn : 0; }, render: teamLastCell }, { key: 'm', label: '', width: 50, render: function (r) { return UI.iconBtn('dots-vertical', 'More for ' + r.name, { size: 'sm', attrs: { 'data-tm-row': r.key, 'data-stop': '1' } }); } }],
        card: function (r) { return '<div class="row gap8" style="justify-content:space-between;align-items:flex-start">' + teamPersonCell(r) + UI.iconBtn('dots-vertical', 'More for ' + r.name, { size: 'sm', attrs: { 'data-tm-row': r.key, 'data-stop': '1' } }) + '</div><div class="row wrap gap8 mt8">' + teamIsCell(r) + teamStatusCell(r) + '<span class="b2">Last signed in: ' + teamLastCell(r) + '</span></div><div class="mt8">' + teamAccessCell(r) + '</div>'; },
        onRowClick: function (r) { if (r.u) { ctx.setParams({ person: r.u.id, tab: 'login' }); teamOpenPerson(r.u.id, 'login'); } else { ctx.setParams({ person: r.e.id }); teamAgentDrawer(r.e); } },
        empty: { icon: 'users', title: 'Nobody matches', text: 'Clear the search or choose Everyone.' } });
      cnt(filt());
      b.addEventListener('click', function (ev) { var x = ev.target.closest('[data-tm-row]'); if (!x) return; ev.stopPropagation(); var r = all.filter(function (z) { return z.key === x.getAttribute('data-tm-row'); })[0]; if (r) teamRowMenu(x, r); });
    }
    function grid(b) {
      var users = d.users.slice().sort(function (a, z) { return (z.superAdmin ? 1 : 0) - (a.superAdmin ? 1 : 0) || a.name.localeCompare(z.name); });
      b.innerHTML = '<div class="card"><div class="card-b tight"><p class="b2" style="margin:0 0 8px">Each switch lets one person open one whole section (page). For single actions inside a section, such as deleting bookings, open the person and use the Access tab.</p><div class="row wrap gap16 tm-gleg"><span><i class="t-role"></i>On, from their role</span><span><i class="t-mine"></i>On, only for this person</span><span><i class="t-off"></i>Off</span><span><i class="t-offmine"></i>Off, only for this person</span></div>' +
        (!ctx.can('users.manage_roles') ? UI.alert('You can look, but changing these switches needs the "Manage roles" right.', 'warn', { icon: 'lock' }) : '') + '</div>' +
        '<div class="tm-grid-wrap"><table class="tbl tm-grid"><thead><tr><th class="tm-g1">Section</th>' + users.map(function (u) { return '<th class="c"><button type="button" class="tm-gh" data-tm-open="' + u.id + '" title="Open ' + esc(u.name) + '">' + UI.avatar(u.name) + '<span>' + esc(u.name.split(' ')[0]) + '</span>' + UI.chip(teamRoleName(u), 'pri') + (!u.active ? '<small class="faint">Switched off</small>' : '') + '</button></th>'; }).join('') + '</tr></thead><tbody>' +
        PERM_SECTIONS.map(function (s) { return '<tr><th class="tm-g1" scope="row"><span class="row gap8">' + i(TEAM_SEC_ICONS[s.id] || 'point') + '<span>' + esc(s.name) + '</span>' + (s.money ? '<span class="tm-rm">' + i('lock') + 'RM</span>' : '') + '</span></th>' + users.map(function (u) { return teamGridCell(u, s); }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
      b.addEventListener('change', function (ev) { var k = ev.target.getAttribute('data-tm-grid'); if (!k) return; var p = k.split('|'), u = userById(p[0]), s = PERM_SECTIONS.filter(function (x) { return x.id === p[1]; })[0]; if (teamGridToggle(u, s) === false) ev.target.checked = !ev.target.checked; });
      b.addEventListener('click', function (ev) { var x = ev.target.closest('[data-tm-open]'); if (x) teamOpenPerson(x.getAttribute('data-tm-open'), 'access'); });
    }
    function templates(b) {
      b.innerHTML = '<div class="card"><div class="card-h"><div><h3>Templates</h3><p>Ready-made sets of switches, such as front desk or accountant, to start a person from. Changing a template changes it for everyone who still follows it. Each person can be adjusted on their own.</p></div>' + (ctx.can('users.manage_roles') ? UI.btn('New template', { icon: 'plus', attrs: { 'data-act': 'newtpl' } }) : '') + '</div><div class="card-b" style="padding-top:12px" id="tm-tt"></div></div>';
      var roles = d.roles.slice().sort(function (a, z) { return a.name.localeCompare(z.name); });
      /* built-in templates offer Copy where custom ones offer Delete */
      var tplSecond = function (r) { return r.builtIn ? UI.iconBtn('copy', 'Make a copy', { size: 'sm', disabled: !ctx.can('users.manage_roles'), attrs: { 'data-tpl-cp': r.id } }) : UI.iconBtn('trash', 'Delete', { size: 'sm', disabled: !ctx.can('users.manage_roles'), attrs: { 'data-tpl-del': r.id } }); };
      UI.table(b.querySelector('#tm-tt'), { rows: roles, density: 'compact', pageSize: false, minWidth: 820,
        columns: [{ key: 'name', label: 'Role', sort: true, render: function (r) { return '<b>' + esc(r.name) + '</b><div class="b2 tm-wrap">' + esc(r.desc) + '</div>'; } }, { key: 'builtIn', label: 'Type', render: function (r) { return r.builtIn ? UI.chip('Built in', 'grey') : UI.chip('Custom', 'info'); } },
          { key: 'people', label: 'People', align: 'right', sort: function (r) { return d.users.filter(function (u) { return u.role === r.id; }).length; }, render: function (r) { return String(d.users.filter(function (u) { return u.role === r.id && !u.superAdmin; }).length + (r.key === 'owner' ? d.users.filter(function (u) { return u.superAdmin; }).length : 0)); } },
          { key: 'secs', label: 'Sections on', render: function (r) { var n = teamSectionsOn(teamSet(r.codes)); return n === PERM_SECTIONS.length ? 'All' : n + ' of ' + PERM_SECTIONS.length; } },
          { key: 'acts', label: '', width: 100, render: function (r) { return '<div class="row gap4" data-stop>' + UI.iconBtn(r.key === 'owner' || !ctx.can('users.manage_roles') ? 'eye' : 'edit', r.key === 'owner' ? 'See' : 'Edit', { size: 'sm', attrs: { 'data-tpl-ed': r.id } }) + tplSecond(r) + '</div>'; } }],
        card: function (r) { return '<b>' + esc(r.name) + '</b> ' + (r.builtIn ? UI.chip('Built in', 'grey') : UI.chip('Custom', 'info')) + '<div class="b2 mt8">' + esc(r.desc) + '</div><div class="row wrap gap8 mt8"><span class="b2">' + teamSectionsOn(teamSet(r.codes)) + ' of ' + PERM_SECTIONS.length + ' sections</span><span class="grow"></span>' + UI.iconBtn(r.key === 'owner' ? 'eye' : 'edit', 'Edit', { size: 'sm', attrs: { 'data-tpl-ed': r.id } }) + tplSecond(r) + '</div>'; },
        onRowClick: function (r) { teamTemplateDrawer(r); } });
      b.addEventListener('click', function (ev) {
        var x;
        if (ev.target.closest('[data-act="newtpl"]')) { teamTemplateDrawer(null); return; }
        if ((x = ev.target.closest('[data-tpl-ed]'))) teamTemplateDrawer(byId(d.roles, x.getAttribute('data-tpl-ed')));
        else if ((x = ev.target.closest('[data-tpl-cp]'))) teamCopyRole(byId(d.roles, x.getAttribute('data-tpl-cp')));
        else if ((x = ev.target.closest('[data-tpl-del]'))) teamDeleteRole(byId(d.roles, x.getAttribute('data-tpl-del')));
      });
    }
    body();
    if (!UI.top()) {
      if (ctx.params.person) setTimeout(function () { if (!UI.top()) teamOpenPerson(ctx.params.person, ctx.params.tab); }, 0);
      else if (ctx.params.action === 'add' && st.didAdd !== 1) { st.didAdd = 1; setTimeout(function () { if (ctx.can('users.create')) teamLoginDrawer(); }, 0); }
      else if (ctx.params.action === 'agent' && st.didAdd !== 2) { st.didAdd = 2; setTimeout(function () { if (ctx.can('employees.create')) teamEmployeeDrawer(null); }, 0); }
    }
  },
  search: [
    { label: 'Add a login', icon: 'user-plus', keywords: 'person staff user', run: function () { teamLoginDrawer(); } },
    { label: 'Add a field agent', icon: 'id-badge-2', keywords: 'employee driver', run: function () { teamEmployeeDrawer(null); } },
    { label: 'Who can see what', icon: 'table', keywords: 'access permissions', run: function () { go('team', { view: 'access' }); } },
    { label: 'Role templates', icon: 'template', keywords: 'roles access', run: function () { go('team', { view: 'templates' }); } }
  ]
};
function teamAddMenu(el) {
  UI.menu(el, [{ label: 'Person who signs in (login)', icon: 'user-plus', disabled: !can('users.create'), onClick: function () { teamLoginDrawer(); } }, { label: 'Field agent (no login)', icon: 'id-badge-2', disabled: !can('employees.create'), onClick: function () { teamEmployeeDrawer(null); } }], { width: 270 });
}
API.openPerson = function (id) { if (S.page !== 'team') go('team', { person: id }); else teamOpenPerson(id); };

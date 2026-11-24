/* ---------------- SIGN IN (M9) ----------------
   #signin: username + password (show/hide), Remember this phone, sample people to try roles. Sets S.me.
   A switched-off login is refused. Optional 4-digit PIN (S.prefs.pin) to reopen the app; set it after signing in or in Settings.
   signIn(staffId, opts) / signOut() keep their names: other modules call them. */
var SIGNIN = { user: '', pass: '', show: false, remember: true, err: '' };
VIEW_STATE.push(function () { SIGNIN = { user: '', pass: '', show: false, remember: true, err: '' }; });

/* the one session for this phone */
function signIn(id, opts) {
  opts = opts || {};
  var p = staff(id); if (!p) return;
  S.me = id; p.lastSeen = new Date().toISOString(); p.devices = Math.max(1, +p.devices || 0);
  S.tempSession = opts.remember === false ? id : null; /* not remembered: ends when the browser is closed */
  try { sessionStorage.setItem('fms.live.' + CO, id); sessionStorage.setItem('fms.unlocked.' + CO, id); } catch (e) {}
  usePrefs(); audit('Signed in', { link: '#person/' + id }); save(); applyTheme();
  SIGNIN = { user: '', pass: '', show: false, remember: true, err: '' };
  var start = '#' + (S.prefs.startTab || 'home');
  history.replaceState(null, '', location.pathname + location.search + start); render(true);
  say('Signed in as ' + p.name);
  if (opts.offerPin && opts.remember !== false && !S.prefs.pin && !S.prefs.pinAsked) { S.prefs.pinAsked = true; save(); later(function () { pinOffer(); }, 700); }
}
function signOut() {
  if (S.me) audit('Signed out', { link: '#person/' + S.me });
  S.me = null; S.tempSession = null; usePrefs(); save(); closeAllSheets();
  try { sessionStorage.removeItem('fms.unlocked.' + CO); } catch (e) {}
  history.replaceState(null, '', location.pathname + location.search + '#signin'); render(true);
}

/* ---- sign-in screen ---- */
var SAMPLE_ROLES = [['owner', 'Owner', 'Sees and changes everything'], ['frontdesk', 'Front desk', 'Bookings, payments, customers'], ['agent', 'Driver', 'Handovers, tasks, own expenses']];
VIEWS.signin = function () {
  if (S.me && staff(S.me) && me().loginActive) { setTimeout(function () { replaceHash('#' + (S.prefs.startTab || 'home')); }, 0); return { html: '', noNav: true }; }
  var b = B(), s = SIGNIN;
  var samples = SAMPLE_ROLES.map(function (r) {
    var p = S.staff.filter(function (x) { return x.role === r[0] && x.hasLogin && x.loginActive; })[0]; if (!p) return '';
    return '<button type="button" class="row si-sample" data-u="' + esc(p.username) + '"><div class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</div><div class="grow"><div class="t1">' + esc(r[1]) + ' · ' + esc(p.name) + '</div><div class="t2">' + esc(r[2]) + '</div></div><span class="si-user">' + esc(p.username) + '</span></button>';
  }).join('');
  var html = '<main class="no-nav si-main"><div class="si-brand"><div class="si-logo">' + MARKS[CO] + '</div><h1>' + esc(b.appName || b.short) + '</h1><p class="muted">Sign in to ' + esc(b.name) + '</p></div>' +
    '<form class="card si-form" id="siForm" autocomplete="on" novalidate>' +
    (s.err ? '<div class="banner red si-err" role="alert">' + I('lock') + '<div>' + esc(s.err) + '</div></div>' : '') +
    '<label class="field"><span>Username</span><input class="inp" id="siUser" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="Your username" value="' + esc(s.user) + '"></label>' +
    '<label class="field"><span>Password</span><div class="si-pass"><input class="inp" id="siPass" name="password" type="' + (s.show ? 'text' : 'password') + '" autocomplete="current-password" enterkeyhint="go" placeholder="Your password" value="' + esc(s.pass) + '">' +
    '<button type="button" class="iconbtn" id="siEye" aria-label="' + (s.show ? 'Hide password' : 'Show password') + '">' + I('eye') + (s.show ? '' : '') + '</button></div></label>' +
    '<label class="si-remember"><span class="sw"><input type="checkbox" id="siRem"' + (s.remember ? ' checked' : '') + '><i></i></span><span><b>Remember this phone</b><small>Stay signed in. Turn off on a shared phone.</small></span></label>' +
    '<button class="btn big" type="submit">Sign in</button></form>' +
    '<div class="banner blue si-demo">' + I('info') + '<div><b>Any password works in this demo.</b> Tap a person to try their role.</div></div>' +
    '<div class="list si-samples">' + samples + '</div>' +
    '<button type="button" class="btn link" id="siAll">Everyone with a login</button>' +
    '<p class="demo-note">' + esc(b.name) + ' · made-up demo data</p></main>';
  return { html: html, noNav: true, after: function () {
    var u = $('#siUser'), pw = $('#siPass');
    u.oninput = function () { SIGNIN.user = u.value; }; pw.oninput = function () { SIGNIN.pass = pw.value; };
    $('#siRem').onchange = function () { SIGNIN.remember = this.checked; };
    $('#siEye').onclick = function () { SIGNIN.show = !SIGNIN.show; pw.type = SIGNIN.show ? 'text' : 'password'; this.setAttribute('aria-label', SIGNIN.show ? 'Hide password' : 'Show password'); this.classList.toggle('on', SIGNIN.show); pw.focus(); };
    $('#siForm').onsubmit = function (e) { e.preventDefault(); siTry(); };
    $$('.si-sample').forEach(function (el) { el.onclick = function () { SIGNIN.user = el.dataset.u; SIGNIN.pass = 'demo-password'; siTry(); }; });
    $('#siAll').onclick = siEveryone;
  } };
};
function siFind(u) { u = String(u || '').trim().toLowerCase(); return S.staff.filter(function (p) { return p.hasLogin && String(p.username || '').toLowerCase() === u; })[0]; }
function siTry() {
  var s = SIGNIN; s.err = '';
  if (!s.user.trim()) s.err = 'Type your username.';
  else if (!s.pass) s.err = 'Type your password.';
  else {
    var p = siFind(s.user);
    if (!p) s.err = 'That username and password do not match. Check them and try again.';
    else if (!p.loginActive) s.err = 'This login is switched off. Ask the owner.';
    else { signIn(p.id, { remember: s.remember, offerPin: true }); return; }
  }
  render(false, true);
  var f = s.err.indexOf('username') >= 0 && !s.user.trim() ? $('#siUser') : $('#siPass'); if (f && !/switched off/.test(s.err)) f.focus();
}
function siEveryone() {
  var list = S.staff.filter(function (p) { return p.hasLogin; });
  sheet(sheetHead('Everyone with a login', 'Demo: tap a person to sign in as them') + '<div class="list">' + list.map(function (p) {
    return '<button type="button" class="row" data-u="' + esc(p.username) + '"><div class="av sm" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</div><div class="grow"><div class="t1">' + esc(p.name) + '</div><div class="t2">' + esc(roleName(p.role)) + ' · ' + esc(p.username) + '</div></div>' + (p.loginActive ? '' : chip('Switched off', 'grey')) + '</button>';
  }).join('') + '</div>', function (sh) {
    $$('[data-u]', sh).forEach(function (el) { el.onclick = function () { closeSheet(true); SIGNIN.user = el.dataset.u; SIGNIN.pass = 'demo-password'; siTry(); }; });
  });
}

/* ---- PIN to reopen ---- */
function pinOffer() {
  if (!S.me) return;
  confirm({ icon: 'info', title: 'Add a PIN to reopen?', text: 'Next time you open the app, type a 4-digit PIN instead of your password. You can change it in Settings.', ok: 'Set a PIN', cancel: 'Not now' }).then(function (ok) { if (ok) pinSet(); });
}
/* a number pad sheet; mode 'set' asks twice */
function pinSet(done) {
  var first = null, cur = '';
  var sh = sheet(sheetHead('Choose a 4-digit PIN', 'Used only on this phone') + '<div class="si-pinbox"><div class="si-dots" id="pinDots"></div><p class="small muted" id="pinMsg">Type 4 numbers</p>' + pinPad() + '</div>', function (sh) {
    function draw() { $('#pinDots', sh).innerHTML = [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < cur.length ? 'on' : '') + '"></i>'; }).join(''); }
    draw();
    pinWire(sh, function (k) {
      if (k === 'del') cur = cur.slice(0, -1); else if (cur.length < 4) cur += k;
      draw();
      if (cur.length === 4) {
        if (first == null) { first = cur; cur = ''; setTimeout(function () { draw(); $('#pinMsg', sh).textContent = 'Type it again to check'; }, 150); }
        else if (first === cur) { S.prefs.pin = cur; save(); audit('PIN set for reopening the app', { link: '#person/' + S.me }); closeSheet(); say('PIN saved. Use it next time you open the app'); if (done) done(); }
        else { first = null; cur = ''; setTimeout(function () { draw(); var m = $('#pinMsg', sh); m.textContent = 'The PINs did not match. Start again.'; m.classList.add('tone-red-text'); }, 150); }
      }
    });
  });
  return sh;
}
function pinPad() {
  var k = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return '<div class="si-pad">' + k.map(function (x) { return x === '' ? '<span></span>' : '<button type="button" data-k="' + x + '"' + (x === 'del' ? ' aria-label="Delete"' : '') + '>' + (x === 'del' ? I('back', 2.2) : x) + '</button>'; }).join('') + '</div>';
}
function pinWire(root, fn) { $$('.si-pad [data-k]', root).forEach(function (b) { b.onclick = function () { fn(b.dataset.k); }; }); }

/* lock screen, drawn instead of any screen while the app is locked */
var PIN_LOCK = { tries: 0, cur: '', hiddenAt: 0 };
function pinLocked() {
  if (!S || !S.me || !S.prefs || !S.prefs.pin) return false;
  var u = null; try { u = sessionStorage.getItem('fms.unlocked.' + CO); } catch (e) { return false; }
  return u !== S.me;
}
function pinUnlock() { try { sessionStorage.setItem('fms.unlocked.' + CO, S.me); } catch (e) {} PIN_LOCK.tries = 0; PIN_LOCK.cur = ''; }
function pinLockHtml() {
  var p = me();
  return '<main class="no-nav si-main si-lock"><div class="si-brand"><div class="si-logo">' + MARKS[CO] + '</div><div class="av si-lockav" style="background:' + avColor(p.name) + '">' + initials(p.name) + '</div><h1>Hi, ' + esc(firstName(p.name)) + '</h1><p class="muted" id="lkMsg">Type your PIN to open ' + esc(B().appName || B().short) + '</p></div>' +
    '<div class="si-pinbox"><div class="si-dots" id="lkDots">' + [0, 1, 2, 3].map(function () { return '<i></i>'; }).join('') + '</div>' + pinPad() + '</div>' +
    '<button type="button" class="btn link" id="lkPw">Forgot your PIN? Sign in with password</button></main>';
}
function pinLockWire() {
  var draw = function () { $$('#lkDots i').forEach(function (d, i) { d.classList.toggle('on', i < PIN_LOCK.cur.length); }); };
  pinWire(document, function (k) {
    if (k === 'del') PIN_LOCK.cur = PIN_LOCK.cur.slice(0, -1); else if (PIN_LOCK.cur.length < 4) PIN_LOCK.cur += k;
    draw();
    if (PIN_LOCK.cur.length === 4) {
      if (PIN_LOCK.cur === S.prefs.pin) { pinUnlock(); me().lastSeen = new Date().toISOString(); save(); render(true); }
      else {
        PIN_LOCK.tries++; PIN_LOCK.cur = '';
        var m = $('#lkMsg'), box = $('#lkDots');
        if (PIN_LOCK.tries >= 5) { delete S.prefs.pin; save(); signOut(); say('Too many wrong PINs. Sign in with your password.'); return; }
        if (m) { m.textContent = 'Wrong PIN. ' + (5 - PIN_LOCK.tries) + (5 - PIN_LOCK.tries === 1 ? ' try' : ' tries') + ' left.'; m.classList.add('tone-red-text'); }
        if (box) { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
        setTimeout(draw, 120);
      }
    }
  });
  $('#lkPw').onclick = function () { signOut(); };
}
/* wrap render: end a not-remembered session when the browser was closed, and show the lock screen while locked */
(function () {
  var inner = render, first = true;
  render = function (navd, keep) {
    if (S && first) {
      first = false;
      var live = null; try { live = sessionStorage.getItem('fms.live.' + CO); } catch (e) { live = S.me; }
      if (S.me && S.tempSession === S.me && live !== S.me) { S.me = null; S.tempSession = null; usePrefs(); save(); history.replaceState(null, '', location.pathname + location.search + '#signin'); }
      else if (S.me) { try { sessionStorage.setItem('fms.live.' + CO, S.me); } catch (e) {} }
    }
    if (S && route().name !== 'signin' && pinLocked()) {
      closeAllSheets();
      $('#app').innerHTML = pinLockHtml(); pinLockWire(); window.scrollTo(0, 0); return;
    }
    inner(navd, keep);
  };
})();
/* lock again after 10 minutes away from the app */
document.addEventListener('visibilitychange', function () {
  if (!S || !S.me || !S.prefs || !S.prefs.pin) return;
  if (document.visibilityState === 'hidden') PIN_LOCK.hiddenAt = Date.now();
  else if (PIN_LOCK.hiddenAt && Date.now() - PIN_LOCK.hiddenAt > 10 * MIN) { try { sessionStorage.removeItem('fms.unlocked.' + CO); } catch (e) {} PIN_LOCK.hiddenAt = 0; render(); }
});

/* ---------------- NOTIFICATION SETTINGS (M9) ----------------
   Lists only the kinds the person can use, adds My job in 30 minutes, Tomorrow's schedule, New lead waiting, Service or paper due,
   Tracker alarm. Quiet hours (default 11 pm to 7 am; late returns still ring). A Try it button for each kind. */
/* the five extra kinds (job, tomorrow, lead, service, alarm) live in core KINDS and PREF_DEFAULTS */
/* which kinds a person can get */
var KIND_ACCESS = { new: ['bookings.view'], change: ['bookings.view'], staff: [], wa: ['leads.view', 'bookings.create'], pay: ['billing.view', 'billing.record_payment'], due: ['bookings.view'],
  job: [], tomorrow: ['bookings.view'], lead: ['leads.view'], service: ['maintenance.view'], alarm: ['tracking.alarms'] };
function kindAllowed(k) { var a = KIND_ACCESS[k]; return !a || !a.length || a.some(function (c) { return can(c); }); }
var QUIET_DEFAULT = { on: true, from: '23:00', to: '07:00' };
function quietOf() { return Object.assign({}, QUIET_DEFAULT, (S.prefs && S.prefs.quiet) || {}); }
function inQuiet(d) {
  var q = quietOf(); if (!q.on) return false;
  d = d || new Date(); var m = d.getHours() * 60 + d.getMinutes(), f = q.from.split(':'), t = q.to.split(':'), a = +f[0] * 60 + +f[1], b = +t[0] * 60 + +t[1];
  return a === b ? false : a < b ? m >= a && m < b : m >= a || m < b;
}
function hmText(v) { var p = String(v).split(':'), h = +p[0], m = +p[1]; return (h % 12 || 12) + (m ? ':' + pad(m) : '') + (h < 12 ? ' AM' : ' PM'); }
/* during quiet hours a notification still goes to the inbox, without a toast or sound (late returns still show) */
(function () {
  var inner = notify;
  notify = function (kind, title, body, link, opts) {
    opts = opts || {};
    if (!opts.self && S && inQuiet() && !(kind === 'due' && /late/i.test(String(title)))) opts = Object.assign({}, opts, { silentToast: true });
    return inner(kind, title, body, link, opts);
  };
})();

VIEWS.notifs = function () {
  var perm = 'Notification' in window ? Notification.permission : 'unsupported', on = !!PUSH.sub && perm === 'granted';
  if (ANDROID) { try { on = FMSAndroid.canNotify(); } catch (e) { on = false; } }
  var status;
  if (ANDROID && !on) status = '<div class="card nt-card"><div class="b">Allow notifications for this app</div><div class="small muted">If nothing pops up, allow them in Settings › Apps › ' + esc(B().appName) + ' › Notifications.</div><button class="btn" onclick="FMSAndroid.askPermission();setTimeout(render,4000)">' + I('bell') + 'Allow notifications</button></div>';
  else if (on) status = '<div class="banner green">' + I('check', 2.4) + '<div><b>Phone notifications are on.</b> They arrive even when the app is closed or the phone is locked.</div></div>';
  else if (isIOS() && !standalone()) status = '<div class="banner amber">' + I('info') + '<div><b>On iPhone, install the app first.</b> Apple only allows notifications from apps on the Home Screen (iOS 16.4 or newer). <a href="#install" class="b">How to install</a></div></div>';
  else if (perm === 'denied') status = '<div class="banner amber">' + I('info') + '<div><b>Notifications are blocked</b> for this app in your phone settings. Allow them there, then come back.</div></div>';
  else if (!PUSH.supported) status = '<div class="banner amber">' + I('info') + '<div>This browser cannot show phone notifications. You still see them inside the app.</div></div>';
  else status = '<div class="card nt-card"><div class="b">Get notifications on this phone</div><div class="small muted">You will be asked to allow them once.</div><button class="btn" onclick="enablePush()">' + I('bell') + 'Turn on phone notifications</button></div>';
  var kinds = Object.keys(KINDS).filter(kindAllowed), q = quietOf();
  var html = topbar('Notifications', { back: '#more' }) + '<main>' + status +
    '<div class="sec"><h2>What ' + esc(firstName(myName())) + ' gets</h2></div><div class="list">' +
    kinds.map(function (k) { var x = KINDS[k]; return '<div class="row nt-row">' + kindIcon(k) + '<div class="grow"><div class="t1">' + esc(x.label) + '</div><div class="t2 nt-desc">' + esc(x.desc) + '</div><button type="button" class="nt-try" data-try="' + k + '">' + I('send', 2) + 'Try it</button></div><label class="sw"><input type="checkbox" data-k="' + k + '" aria-label="' + esc(x.label) + '"' + (S.prefs[k] !== false ? ' checked' : '') + '><i></i></label></div>'; }).join('') +
    '</div><p class="small muted nt-foot">Turned off kinds still show in the inbox, without a sound. Each person chooses for themselves.</p>' +
    '<div class="sec"><h2>Quiet hours</h2></div><div class="card nt-card"><label class="nt-qrow"><span class="grow"><b>No sound at night</b><small>' + (q.on ? 'From ' + hmText(q.from) + ' to ' + hmText(q.to) + '. Late returns still ring.' : 'Off. Notifications ring at any time.') + '</small></span><span class="sw"><input type="checkbox" id="ntQ"' + (q.on ? ' checked' : '') + '><i></i></span></label>' +
    (q.on ? '<div class="two nt-times"><label class="field"><span>From</span><input class="inp" type="time" id="ntQf" value="' + q.from + '" step="900"></label><label class="field"><span>To</span><input class="inp" type="time" id="ntQt" value="' + q.to + '" step="900"></label></div>' : '') +
    (inQuiet() ? '<div class="small nt-now">' + I('clock') + 'Quiet hours are on right now</div>' : '') + '</div>' +
    '<p class="demo-note">' + (on ? 'Try it: tap, then lock your phone or leave the app. A sample arrives in 10 seconds.' : 'Try it shows a sample of each one. It changes nothing.') + '<br>' + (PUSH.sub ? 'Push: connected' : 'Push: not connected') + ' · ' + (standalone() ? 'running as installed app' : 'running in the browser') + '</p></main>';
  return { html: html, keepScroll: true, after: function () {
    $$('.nt-row .sw input').forEach(function (i) { i.onchange = function () { S.prefs[i.dataset.k] = i.checked; save(); say(KINDS[i.dataset.k].label + (i.checked ? ' on' : ' off, still kept in the inbox')); }; });
    $$('[data-try]').forEach(function (b) { b.onclick = function () { simulate(b.dataset.try); }; });
    $('#ntQ').onchange = function () { S.prefs.quiet = Object.assign(quietOf(), { on: this.checked }); save(); render(false, true); };
    ['ntQf', 'ntQt'].forEach(function (id) { var el = $('#' + id); if (el) el.onchange = function () { if (!el.value) return; var qq = quietOf(); qq[id === 'ntQf' ? 'from' : 'to'] = el.value; S.prefs.quiet = qq; save(); render(false, true); }; });
  } };
};
/* Try it: shows a sample of one kind. It changes nothing (no booking, payment or chat is touched) and the sample says it is a sample. */
var NT_SAMPLES = {
  new: ['New booking (sample)', 'Siti booked a Perodua Myvi on the website for Fri, 10:00 AM'],
  change: ['Booking changed (sample)', 'The customer moved the return 2 hours later'],
  staff: ['Team chat (sample)', 'Can someone check the tyre pressure light on the Axia?'],
  wa: ['WhatsApp (sample)', 'Hello, can I extend my booking by 1 more day?'],
  pay: ['Transfer slip received (sample)', 'RM 250.00 for a booking, checked by the slip reader'],
  due: ['Pick-up in 1 hour (sample)', 'A customer picks up a car at our location'],
  job: ['Your job in 30 minutes (sample)', 'Hand over a car to a customer'],
  tomorrow: ['Tomorrow\u2019s schedule (sample)', '4 going out, 3 coming back'],
  lead: ['New lead waiting (sample)', 'A customer on WhatsApp wants a car for 2 days'],
  service: ['Service due (sample)', 'Oil change due in 800 km'],
  alarm: ['Tracker alarm (sample)', 'A car moved without a booking. Check where it is.']
};
function simulate(kind) {
  var x = NT_SAMPLES[kind]; if (!x || !kindAllowed(kind)) return;
  var ev = [kind, x[0], x[1], '#inbox'], show = function (o) { notify(ev[0], ev[1], ev[2], ev[3], Object.assign({ to: S.me }, o || {})); };
  if (S.prefs[kind] === false) { show({ silentToast: true }); say('Sent to your inbox without a sound, because this kind is off'); return; }
  if (ANDROID) { say('Coming in 10 seconds. Lock your phone or leave the app'); later(show, 10000); return; }
  if (PUSH.sub && Notification.permission === 'granted') {
    serverPush(ev[0], ev[1], ev[2], ev[3], 10).then(function () {
      say('Sending in 10 seconds. Lock your phone now');
      later(function () { show({ silentToast: document.visibilityState === 'hidden' }); }, 10000);
    }).catch(function () { say('Server push failed, showing it here'); later(show, 1500); });
  } else { say(inQuiet() && kind !== 'due' ? 'Coming in 3 seconds, without a sound (quiet hours)' : 'Coming in 3 seconds'); later(show, 3000); }
}
/* while the app is open: my job in 30 minutes (only jobs given to me), and the evening summary of tomorrow (kept in the inbox) */
function m9Reminders() {
  if (!S || !S.me || typeof myJob !== 'function') return;
  var now = Date.now(), seen = S.m9Seen = S.m9Seen || {}, changed = false;
  S.bookings.forEach(function (b) {
    var t = null, dir = '';
    if (UPCOMING.indexOf(b.bookingStatus) >= 0 && b.bookingStatus !== 'Pending') { t = new Date(b.start).getTime(); dir = 'o'; }
    else if (b.bookingStatus === 'Car Delivered') { t = new Date(b.end).getTime(); dir = 'i'; }
    if (t == null || t < now || t - now > 30 * MIN || seen[S.me + b.id + dir] || !myJob(b)) return;
    seen[S.me + b.id + dir] = 1; changed = true;
    var c = car(b.car) || {};
    notify('job', 'Your job in ' + Math.max(1, Math.round((t - now) / MIN)) + ' minutes', (dir === 'o' ? 'Pick-up: ' : 'Return: ') + cust(b.cust).name + ' · ' + (c.plate || '') + ' · ' + placeText(b, dir === 'o' ? 'pick' : 'ret'), '#booking/' + b.id, { to: S.me });
  });
  var d = new Date(), key = 'tm' + toLocalInput(d);
  if (d.getHours() >= 18 && !seen[key] && can('bookings.view')) {
    seen[key] = 1; changed = true;
    var t0 = sod(d).getTime() + DAY, o = 0, i = 0;
    S.bookings.forEach(function (q) { if (q.bookingStatus === 'Cancelled') return; var s1 = new Date(q.start).getTime(), e1 = new Date(q.end).getTime(); if (s1 >= t0 && s1 < t0 + DAY) o++; if (e1 >= t0 && e1 < t0 + DAY) i++; });
    if (o + i) notify('tomorrow', 'Tomorrow’s schedule', o + ' going out, ' + i + ' coming back', '#schedule?range=tomorrow', { silentToast: true });
  }
  Object.keys(seen).forEach(function (k) { if (Object.keys(seen).length > 300) delete seen[k]; });
  if (changed) save();
}
setTimeout(m9Reminders, 4000); setInterval(m9Reminders, 60000);

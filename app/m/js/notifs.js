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
    '<p class="demo-note">' + (on ? 'Try it: tap, then lock your phone or leave the app. It arrives in 10 seconds.' : 'Try it shows how each one looks inside the app.') + '<br>' + (PUSH.sub ? 'Push: connected' : 'Push: not connected') + ' · ' + (standalone() ? 'running as installed app' : 'running in the browser') + '</p></main>';
  return { html: html, keepScroll: true, after: function () {
    $$('.nt-row .sw input').forEach(function (i) { i.onchange = function () { S.prefs[i.dataset.k] = i.checked; save(); say(KINDS[i.dataset.k].label + (i.checked ? ' on' : ' off, still kept in the inbox')); }; });
    $$('[data-try]').forEach(function (b) { b.onclick = function () { simulate(b.dataset.try); }; });
    $('#ntQ').onchange = function () { S.prefs.quiet = Object.assign(quietOf(), { on: this.checked }); save(); render(false, true); };
    ['ntQf', 'ntQt'].forEach(function (id) { var el = $('#' + id); if (el) el.onchange = function () { if (!el.value) return; var qq = quietOf(); qq[id === 'ntQf' ? 'from' : 'to'] = el.value; S.prefs.quiet = qq; save(); render(false, true); }; });
  } };
};
/* make a real demo event: change the data now, deliver the notification (through the server when possible) */
function simulate(kind) {
  var b = B(), now = new Date(), ev;
  if (kind === 'new') {
    var s0 = new Date(sod(now).getTime() + 2 * DAY + 10 * HOUR), e0 = new Date(s0.getTime() + 2 * DAY);
    var free = S.cars.filter(function (c) { return c.status === 'active' && isFree(c.id, s0, e0); });
    var c = free[Math.floor(Math.random() * free.length)] || S.cars[0];
    var cu = S.customers[Math.floor(Math.random() * 8)], pl = (b.places || [])[0], no = S.nextNo++;
    var nb = blankBooking({ no: no, code: bookingCode(no), cust: cu.id, car: c.id, start: s0.toISOString(), end: e0.toISOString(), created: now.toISOString(), createdBy: 'Website', source: 'Website', bookingStatus: 'Pending',
      rates: { daily: c.rate, hourly: c.hourly, deposit: c.deposit, discount: 0, delivery: pl ? pl.deliveryFee : 0, 'return': pl ? pl.returnFee : 0, others: 0 }, pickKind: pl ? 'place' : 'our', pickLoc: pl ? pl.id : 'L1', retKind: pl ? 'place' : 'our', retLoc: pl ? pl.id : 'L1' });
    nb.log.push({ at: now.toISOString(), by: 'Website', text: 'Booking made (Website)' });
    S.bookings.push(nb);
    ev = ['new', 'New booking ' + nb.code, cu.name + ' booked a ' + c.make + ' ' + c.model + ' on the website · ' + when(nb.start), '#booking/' + nb.id];
  } else if (kind === 'change') {
    var x = S.bookings.filter(function (q) { return UPCOMING.indexOf(q.bookingStatus) >= 0 || q.bookingStatus === 'Car Delivered'; })[0];
    var oldEnd = x.end; x.end = new Date(new Date(x.end).getTime() + 2 * HOUR).toISOString(); x.log.push({ at: now.toISOString(), by: 'Customer', text: 'Customer moved return to ' + when(x.end) + ' (customer link)', changes: { 'return': [when(oldEnd), when(x.end)] } });
    ev = ['change', x.code + ' changed', cust(x.cust).name + ' moved the return to ' + when(x.end), '#booking/' + x.id];
  } else if (kind === 'wa') {
    var w = S.wa[0], t = 'Hello, can I extend my booking by 1 more day?';
    w.msgs.push({ from: 'cust', text: t, at: now.toISOString() }); w.unread = (w.unread || 0) + 1;
    ev = ['wa', (w.name || w.phone) + ' on WhatsApp', t, '#chat/wa/' + w.id];
  } else if (kind === 'staff') {
    var mate = S.staff.filter(function (p) { return p.id !== S.me && p.active !== false; })[1] || S.staff[1], st = 'Can someone check ' + S.cars[3].plate + '? Tyre pressure light is on.';
    S.staffChat.push({ id: uid(), from: mate.id, text: st, at: now.toISOString() }); S.staffUnread = (S.staffUnread || 0) + 1;
    ev = ['staff', firstName(mate.name) + ' in Team chat', st, '#chat/staff'];
  } else if (kind === 'pay') {
    var y = S.bookings.filter(function (q) { return q.bookingStatus !== 'Cancelled' && calcBooking(q).due > 0; })[0] || S.bookings[0], amt = Math.max(50, Math.round(calcBooking(y).due));
    var pay = newPayment({ items: [{ kind: 'Rental payment', amt: amt }], method: 'Online Transfer', at: now.toISOString(), by: 'Slip reader', slip: 'demo:slip:Bank slip', ref: 'M' + Math.floor(1e8 + Math.random() * 8e8) });
    y.payments.push(pay); var ns = nextPaymentStatus(y, pay.items); if (ns) y.paymentStatus = ns;
    y.log.push({ at: now.toISOString(), by: 'Slip reader', text: 'Transfer slip received: ' + rm(amt) });
    ev = ['pay', rm(amt) + ' transfer slip', cust(y.cust).name + ' · ' + y.code + ' · checked by the slip reader', '#booking/' + y.id];
  } else if (kind === 'due') {
    var dz = S.bookings.filter(function (q) { return UPCOMING.indexOf(q.bookingStatus) >= 0 && new Date(q.start) > now; }).sort(function (a2, b2) { return new Date(a2.start) - new Date(b2.start); })[0] || S.bookings[0];
    ev = ['due', 'Pick-up at ' + hm(dz.start), cust(dz.cust).name + ' · ' + ((car(dz.car) || {}).plate || '') + ' · ' + placeText(dz, 'pick'), '#booking/' + dz.id];
  } else if (kind === 'job') {
    var mine = S.bookings.filter(function (q) { return UPCOMING.indexOf(q.bookingStatus) >= 0 && new Date(q.start) > now && typeof myJob === 'function' && myJob(q); }).sort(function (a2, b2) { return new Date(a2.start) - new Date(b2.start); })[0]
      || S.bookings.filter(function (q) { return UPCOMING.indexOf(q.bookingStatus) >= 0 && new Date(q.start) > now; })[0];
    if (!mine) { say('No upcoming jobs to remind you of'); return; }
    ev = ['job', 'Your job in 30 minutes', (mine.pickKind === 'our' ? 'Hand over ' : 'Deliver ') + ((car(mine.car) || {}).plate || '') + ' to ' + cust(mine.cust).name + ' at ' + placeText(mine, 'pick'), '#booking/' + mine.id];
  } else if (kind === 'tomorrow') {
    var t0 = sod(now).getTime() + DAY, outN = 0, inN = 0;
    S.bookings.forEach(function (q) { if (q.bookingStatus === 'Cancelled') return; var s1 = new Date(q.start).getTime(), e1 = new Date(q.end).getTime(); if (s1 >= t0 && s1 < t0 + DAY) outN++; if (e1 >= t0 && e1 < t0 + DAY) inN++; });
    ev = ['tomorrow', 'Tomorrow’s schedule', outN + ' going out, ' + inN + ' coming back. Tap to see who is doing what.', '#schedule?range=tomorrow'];
  } else if (kind === 'lead' && typeof Leads !== 'undefined' && Leads.simulateNew) {
    Leads.simulateNew(); return; /* a full lead (dates, car hold, question) from the leads module */
  } else if (kind === 'lead') {
    var ph = fmtPhone('01' + (2 + Math.floor(Math.random() * 7)) + (1000000 + Math.floor(Math.random() * 8999999))), cx = S.cars.filter(function (c2) { return c2.status === 'active'; })[2] || S.cars[0];
    var ls = new Date(sod(now).getTime() + 3 * DAY + 10 * HOUR), le = new Date(ls.getTime() + 2 * DAY);
    var th = { id: 'wa' + uid(), name: 'Syafiq Rahim', phone: ph, status: 'Lead', unread: 1, handled: 'bot', msgs: [
      { from: 'cust', text: 'Hi, is the ' + cx.make + ' ' + cx.model + ' free from ' + dShort(ls) + ' for 2 days?', at: new Date(now - 4 * MIN).toISOString() },
      { from: 'bot', text: 'Yes, it is free. The total is ' + rm(cx.rate * 2) + ' plus a ' + rm(cx.deposit) + ' deposit. Shall I pass you to our team to book?', at: new Date(now - 3 * MIN).toISOString() },
      { from: 'cust', text: 'Yes please', at: now.toISOString() }],
      lead: { state: 'waiting', start: ls.toISOString(), end: le.toISOString(), car: cx.id, holdUntil: new Date(now.getTime() + 20 * MIN).toISOString(), pickKind: 'our', pickLoc: 'L1', retKind: 'our', retLoc: 'L1', estimate: cx.rate * 2, deposit: cx.deposit, at: now.toISOString() } };
    S.wa.unshift(th);
    ev = ['lead', 'New lead waiting', th.name + ' wants a ' + cx.make + ' ' + cx.model + ' from ' + dShort(ls) + '. The car is held for 20 minutes.', '#chat/wa/' + th.id];
  } else if (kind === 'service') {
    var it = null; try { it = typeof Maint !== 'undefined' ? Maint.dueItems({ all: true })[0] : null; } catch (e) {}
    var sc = it ? it.car : S.cars[1];
    ev = ['service', it ? sc.plate + ': ' + it.title : sc.plate + ': oil change soon', it ? it.words : 'Due in 800 km', can('maintenance.view') ? '#maintenance' : '#car/' + sc.id];
  } else if (kind === 'alarm') {
    var ac = S.cars.filter(function (c3) { return c3.status === 'active'; })[5] || S.cars[0];
    S.alarms = S.alarms || []; S.alarms.unshift({ id: uid(), car: ac.id, kind: 'Moved without a booking', at: now.toISOString() });
    ev = ['alarm', 'Tracker alarm: ' + ac.plate, 'Moved without a booking near ' + B().city + '. Check where it is.', '#tracking'];
  } else return;
  save();
  if (S.prefs[kind] === false) { S.notifs.unshift({ id: uid(), kind: ev[0], title: ev[1], body: ev[2], at: now.toISOString(), read: false, link: ev[3] }); save(); refreshBadges(); say('Sent to your inbox without a sound, because this kind is off'); return; }
  if (ANDROID) { say('Coming in 10 seconds. Lock your phone or leave the app'); later(function () { notify(ev[0], ev[1], ev[2], ev[3]); }, 10000); return; }
  if (PUSH.sub && Notification.permission === 'granted') {
    serverPush(ev[0], ev[1], ev[2], ev[3], 10).then(function () {
      say('Sending in 10 seconds. Lock your phone now');
      later(function () { notify(ev[0], ev[1], ev[2], ev[3], { silentToast: document.visibilityState === 'hidden' }); }, 10000);
    }).catch(function () { say('Server push failed, showing it here'); later(function () { notify(ev[0], ev[1], ev[2], ev[3]); }, 1500); });
  } else { say(inQuiet() && !(ev[0] === 'due' && /late/i.test(ev[1])) ? 'Coming in 3 seconds, without a sound (quiet hours)' : 'Coming in 3 seconds'); later(function () { notify(ev[0], ev[1], ev[2], ev[3]); }, 3000); }
}
/* while the app is open: my job in 30 minutes (only jobs given to me), and the evening summary of tomorrow (kept in the inbox) */
function m9Reminders() {
  if (!S || !S.me || typeof myJob !== 'function') return;
  var now = Date.now(), seen = S.m9Seen = S.m9Seen || {}, changed = false;
  S.bookings.forEach(function (b) {
    var t = null, dir = '';
    if (UPCOMING.indexOf(b.bookingStatus) >= 0 && b.bookingStatus !== 'Pending') { t = new Date(b.start).getTime(); dir = 'o'; }
    else if (b.bookingStatus === 'Car Delivered') { t = new Date(b.end).getTime(); dir = 'i'; }
    if (t == null || t < now || t - now > 30 * MIN || seen[b.id + dir] || !myJob(b)) return;
    seen[b.id + dir] = 1; changed = true;
    var c = car(b.car) || {};
    notify('job', 'Your job in ' + Math.max(1, Math.round((t - now) / MIN)) + ' minutes', (dir === 'o' ? 'Pick-up: ' : 'Return: ') + cust(b.cust).name + ' · ' + (c.plate || '') + ' · ' + placeText(b, dir === 'o' ? 'pick' : 'ret'), '#booking/' + b.id);
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

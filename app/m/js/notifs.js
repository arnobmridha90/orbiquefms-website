/* ---------------- NOTIFICATION SETTINGS ---------------- */
VIEWS.notifs = function () {
  var perm = 'Notification' in window ? Notification.permission : 'unsupported', on = !!PUSH.sub && perm === 'granted';
  if (ANDROID) { try { on = FMSAndroid.canNotify(); } catch (e) { on = false; } }
  var status;
  if (ANDROID && !on) status = '<div class="card" style="padding:14px;margin-bottom:12px"><div class="b" style="margin-bottom:4px">Allow notifications for this app</div><div class="small muted" style="margin-bottom:12px">If nothing pops up, allow them in Settings › Apps › Kilat Staff › Notifications.</div><button class="btn" onclick="FMSAndroid.askPermission();setTimeout(render,4000)">' + I('bell') + 'Allow notifications</button></div>';
  else if (on) status = '<div class="banner" style="background:var(--ok-bg);color:#0E4F2C">' + I('check', 2.4) + '<div><b>Phone notifications are on.</b> They arrive even when the app is closed or the phone is locked.</div></div>';
  else if (isIOS() && !standalone()) status = '<div class="banner warn">' + I('info') + '<div><b>On iPhone, install the app first.</b> Apple only allows notifications from apps on the Home Screen (iOS 16.4 or newer). <a href="#install" style="font-weight:700">How to install</a></div></div>';
  else if (perm === 'denied') status = '<div class="banner warn">' + I('info') + '<div><b>Notifications are blocked</b> for this app in your phone settings. Allow them there, then come back.</div></div>';
  else if (!PUSH.supported) status = '<div class="banner warn">' + I('info') + '<div>This browser cannot show phone notifications. You still see them inside the app.</div></div>';
  else status = '<div class="card" style="padding:14px;margin-bottom:12px"><div class="b" style="margin-bottom:4px">Get notifications on this phone</div><div class="small muted" style="margin-bottom:12px">You will be asked to allow them once.</div><button class="btn" onclick="enablePush()">' + I('bell') + 'Turn on phone notifications</button></div>';
  var html = topbar('Notifications', { back: '#more' }) + '<main>' + status +
    '<div class="sec"><h2>What ' + esc(S.me.split(' ')[0]) + ' gets</h2></div><div class="list">' +
    Object.keys(KINDS).map(function (k) { var x = KINDS[k]; return '<label class="row" style="cursor:pointer">' + kindIcon(k).replace('class="ic', 'style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none" class="ic') + '<div class="grow"><div class="t1">' + x.label + '</div><div class="t2" style="white-space:normal">' + x.desc + '</div></div><span class="sw"><input type="checkbox" data-k="' + k + '"' + (S.prefs[k] ? ' checked' : '') + '><i></i></span></label>'; }).join('') +
    '</div><p class="small muted" style="margin:8px 4px 0">Each person chooses for themselves. The owner can also set what each role gets.</p>' +
    '<div class="sec"><h2>Try it</h2></div><div class="card" style="padding:14px">' +
    '<div class="small muted" style="margin-bottom:10px">' + (on ? 'Tap one, then lock your phone or leave the app. It arrives in 10 seconds.' : 'Tap one to see how it looks. Turn on phone notifications above to get them with the app closed.') + '</div>' +
    '<div style="display:grid;gap:8px">' +
    '<button class="btn ghost" onclick="simulate(\'new\')">' + I('plus') + 'A customer books on the website</button>' +
    '<button class="btn ghost" onclick="simulate(\'change\')">' + I('edit') + 'A customer changes return time</button>' +
    '<button class="btn ghost" onclick="simulate(\'wa\')">' + I('wa') + 'A WhatsApp message comes in</button>' +
    '<button class="btn ghost" onclick="simulate(\'staff\')">' + I('users') + 'A colleague writes in Team chat</button>' +
    '<button class="btn ghost" onclick="simulate(\'pay\')">' + I('cash') + 'A transfer slip arrives</button></div></div>' +
    '<p class="demo-note">' + (PUSH.sub ? 'Push: connected' : 'Push: not connected') + ' · ' + (standalone() ? 'running as installed app' : 'running in the browser') + '</p></main>';
  return { html: html, after: function () {
    $$('.sw input').forEach(function (i) { i.onchange = function () { S.prefs[i.dataset.k] = i.checked; save(); say(KINDS[i.dataset.k].label + (i.checked ? ' on' : ' off')); }; });
  } };
};
/* make a real demo event: change the data now, deliver the notification (through the server when possible) */
function simulate(kind) {
  var b = B(), now = new Date(), ev;
  if (kind === 'new') {
    var free = S.cars.filter(function (c) { var s = new Date(sod(now).getTime() + 2 * DAY + 10 * HOUR); return !busy(c.id, s, new Date(s.getTime() + 2 * DAY)); });
    var c = free[Math.floor(Math.random() * free.length)] || S.cars[0], s0 = new Date(sod(now).getTime() + 2 * DAY + 10 * HOUR), e0 = new Date(s0.getTime() + 2 * DAY);
    var cu = S.customers[Math.floor(Math.random() * 8)];
    var nb = { id: uid(), code: b.code + '-' + String(S.nextNo++).padStart(5, '0'), cust: cu.id, car: c.id, start: s0.toISOString(), end: e0.toISOString(), pickPlace: b.places[1], retPlace: b.places[1], cover: 'basic', deposit: c.deposit, rate: c.rate, extras: [], payments: [], log: [{ at: now.toISOString(), by: 'Website', text: 'Booking made on Website' }], source: 'Website', note: '', status: 'Confirmed', createdBy: 'Website', created: now.toISOString() };
    S.bookings.push(nb);
    ev = ['new', 'New booking ' + nb.code, cu.name + ' booked a ' + c.make + ' ' + c.model + ' on the website · ' + when(nb.start), '#booking/' + nb.id];
  } else if (kind === 'change') {
    var x = S.bookings.filter(function (q) { return q.status === 'Confirmed' || q.status === 'Picked up'; })[0];
    x.end = new Date(new Date(x.end).getTime() + 2 * HOUR).toISOString(); x.log.push({ at: now.toISOString(), by: cust(x.cust).name, text: 'Customer moved return to ' + when(x.end) + ' (customer link)' });
    ev = ['change', x.code + ' changed', cust(x.cust).name + ' moved the return to ' + when(x.end), '#booking/' + x.id];
  } else if (kind === 'wa') {
    var w = S.wa[0], t = 'Hello, can I extend my booking by 1 more day?';
    w.msgs.push({ from: 'cust', text: t, at: now.toISOString() }); w.unread++;
    ev = ['wa', w.name + ' on WhatsApp', t, '#chat/wa/' + w.id];
  } else if (kind === 'staff') {
    var who = b.staff[2], st = 'Can someone check ' + S.cars[3].plate + '? Tyre pressure light is on.';
    S.staffChat.push({ id: uid(), from: who, text: st, at: now.toISOString() }); S.staffUnread = (S.staffUnread || 0) + 1;
    ev = ['staff', who.split(' ')[0] + ' in Team chat', st, '#chat/staff'];
  } else {
    var y = S.bookings.filter(function (q) { return q.status !== 'Cancelled' && priceOf(q).balance > 0; })[0] || S.bookings[0], amt = Math.max(50, Math.round(priceOf(y).balance));
    y.payments.push({ id: uid(), amt: amt, kind: 'Rental', method: 'Online Transfer', at: now.toISOString(), by: 'Slip reader' }); y.log.push({ at: now.toISOString(), by: 'Slip reader', text: 'Transfer slip received: ' + rm(amt) });
    ev = ['pay', rm(amt) + ' transfer slip', cust(y.cust).name + ' · ' + y.code + ' · checked by the slip reader', '#booking/' + y.id];
  }
  save();
  if (!S.prefs[kind]) { S.notifs.unshift({ id: uid(), kind: ev[0], title: ev[1], body: ev[2], at: now.toISOString(), read: false, link: ev[3] }); save(); refreshBadges(); say('Done. You switched this kind off, so no alert'); return; }
  if (ANDROID) { say('Coming in 10 seconds. Lock your phone or leave the app'); setTimeout(function () { notify(ev[0], ev[1], ev[2], ev[3]); }, 10000); return; }
  if (PUSH.sub && Notification.permission === 'granted') {
    serverPush(ev[0], ev[1], ev[2], ev[3], 10).then(function () {
      say('Sending in 10 seconds. Lock your phone now');
      setTimeout(function () { notify(ev[0], ev[1], ev[2], ev[3], { silentToast: document.visibilityState === 'hidden' }); }, 10000);
    }).catch(function () { say('Server push failed, showing it here'); setTimeout(function () { notify(ev[0], ev[1], ev[2], ev[3]); }, 1500); });
  } else { say('Coming in 3 seconds'); setTimeout(function () { notify(ev[0], ev[1], ev[2], ev[3]); }, 3000); }
}


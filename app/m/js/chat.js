/* ---------------- CHAT ---------------- */
VIEWS.chat = function (r) {
  if (r.a === 'staff') return staffThread();
  if (r.a === 'wa' && r.b) return waThread(r.b);
  var tab = r.a === 'team' ? 'team' : 'wa';
  var last = S.staffChat[S.staffChat.length - 1];
  var html = topbar('Chat') + '<main>' +
    '<div class="seg2"><a href="#chat" class="' + (tab === 'wa' ? 'on' : '') + '">Customers' + dotHtml(S.wa.reduce(function (s, c) { return s + c.unread; }, 0)) + '</a><a href="#chat/team" class="' + (tab === 'team' ? 'on' : '') + '">Staff' + dotHtml(S.staffUnread || 0) + '</a></div>';
  if (tab === 'team') {
    html += '<div class="list"><a class="row" href="#chat/staff"><div class="av" style="background:var(--dark)">' + I('users') + '</div><div class="grow"><div class="t1">Team chat</div><div class="t2">' + esc(last.from.split(' ')[0] + ': ' + last.text) + '</div></div><div class="end"><div class="tiny muted">' + ago(last.at) + '</div>' + (S.staffUnread ? '<span class="dot" style="position:static;display:inline-grid;margin-top:4px;border:0">' + S.staffUnread + '</span>' : '') + '</div></a></div>' +
      '<p class="small muted" style="margin:12px 4px">Everyone on the team sees this chat. Booking numbers like ' + esc(S.bookings[0].code) + ' turn into links.</p>';
  } else {
    var sorted = S.wa.slice().sort(function (a, b) { return new Date(b.msgs[b.msgs.length - 1].at) - new Date(a.msgs[a.msgs.length - 1].at); });
    html += '<div class="banner">' + I('bot') + '<div>The <b>booking assistant</b> answers customers on WhatsApp day and night. Step in any time; it stops while staff are talking.</div></div>' +
      '<div class="list">' + sorted.map(function (c) {
        var m = c.msgs[c.msgs.length - 1];
        return '<a class="row" href="#chat/wa/' + c.id + '"><div class="av" style="background:' + avColor(c.name) + '">' + initials(c.name) + '</div><div class="grow"><div class="t1">' + esc(c.name) + ' <span class="chip ' + (c.status === 'Booked' ? 'ok' : c.status === 'Lead' ? 'brand' : '') + '" style="vertical-align:1px">' + c.status + '</span></div><div class="t2">' + (m.from === 'bot' ? 'Assistant: ' : m.from === 'staff' ? 'You: ' : '') + esc(m.text) + '</div></div><div class="end"><div class="tiny muted">' + ago(m.at) + '</div>' + (c.unread ? '<span class="dot" style="position:static;display:inline-grid;margin-top:4px;border:0;background:#1FA855">' + c.unread + '</span>' : '') + '</div></a>';
      }).join('') + '</div>';
  }
  html += '</main>';
  return { html: html };
};
function dotHtml(n) { return n ? '<span class="dot">' + n + '</span>' : ''; }
function linkCodes(t) { return esc(t).replace(new RegExp('\\b(' + B().code + '-\\d{5})\\b', 'g'), function (m) { var b = S.bookings.filter(function (x) { return x.code === m; })[0]; return b ? '<a href="#booking/' + b.id + '" style="color:inherit;text-decoration:underline">' + m + '</a>' : m; }); }
function bubbles(list, mine) {
  var out = '', lastDay = '';
  list.forEach(function (m) {
    var d = dayWord(m.at); if (d !== lastDay) { out += '<div class="daysep">' + d + '</div>'; lastDay = d; }
    var cls = mine(m);
    out += '<div class="msg ' + cls + '">' + (m.who ? '<span class="who">' + esc(m.who) + '</span>' : '') + linkCodes(m.text) + '<time>' + hm(m.at) + '</time></div>';
  });
  return out;
}
function staffThread() {
  S.staffUnread = 0; save();
  var list = S.staffChat.map(function (m) { return { at: m.at, text: m.text, from: m.from, who: m.from === S.me ? '' : m.from.split(' ')[0] }; });
  var html = topbar('Team chat', { back: '#chat/team', sub: B().staff.length + ' people' }) + '<main><div class="thread" id="thread">' + bubbles(list, function (m) { return m.from === S.me ? 'out' : 'in'; }) + '</div></main>' +
    composer(['On my way 🚗', 'Car is ready', 'Handover done ✅', 'Can someone cover me?']);
  return { html: html, noNav: true, after: function () { wireComposer(sendStaff); toBottom(); } };
}
function waThread(id) {
  var c = S.wa.filter(function (x) { return x.id === id; })[0]; if (!c) { location.hash = '#chat'; return { html: '' }; }
  c.unread = 0; save();
  S.notifs.forEach(function (n) { if (n.link === '#chat/wa/' + id) n.read = true; });
  var list = c.msgs.map(function (m) { return { at: m.at, text: m.text, from: m.from, who: m.from === 'bot' ? 'Booking assistant' : m.from === 'staff' ? (m.by || S.me).split(' ')[0] : '' }; });
  var right = '<a class="iconbtn" href="https://wa.me/' + c.phone.replace(/\D/g, '') + '" target="_blank" rel="noopener" aria-label="Open in WhatsApp">' + I('wa') + '</a>';
  var html = topbar(c.name, { back: '#chat', sub: c.phone + ' · ' + (c.handled === 'bot' ? 'assistant replying' : 'staff replying'), right: right }) + '<main>' +
    (c.handled === 'bot' ? '<div class="banner">' + I('bot') + '<div style="flex:1">The assistant is handling this chat. Sending a message takes over from it.</div></div>' : '<div class="banner">' + I('users') + '<div style="flex:1">Staff are handling this chat. <button style="color:var(--brand-ink);font-weight:700" onclick="handBack(\'' + id + '\')">Hand back to assistant</button></div></div>') +
    '<div class="thread" id="thread">' + bubbles(list, function (m) { return m.from === 'cust' ? 'in' : m.from === 'bot' ? 'bot' : 'out'; }) + '</div>' +
    (c.status !== 'Booked' ? '<button class="btn ghost" style="margin-top:6px" onclick="waToBooking(\'' + id + '\')">' + I('plus') + 'Make a booking for ' + esc(c.name.split(' ')[0]) + '</button>' : '') + '</main>' +
    composer(['Yes, available 👍', 'Please send the transfer slip', 'We can deliver for RM 50.00', 'See you tomorrow!']);
  return { html: html, noNav: true, after: function () { wireComposer(function (t) { sendWa(id, t); }); toBottom(); } };
}
function handBack(id) { var c = S.wa.filter(function (x) { return x.id === id; })[0]; c.handled = 'bot'; save(); render(); say('The assistant will reply again'); }
function waToBooking(id) {
  var c = S.wa.filter(function (x) { return x.id === id; })[0];
  var ex = S.customers.filter(function (x) { return x.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, ''); })[0];
  NB = nbFresh(); NB.source = 'WhatsApp'; if (ex) NB.cust = ex.id; else { NB.newName = c.name; NB.newPhone = c.phone; }
  location.hash = '#new';
}
function composer(quick) {
  return '<div class="composer">' + (quick ? '<div class="quick">' + quick.map(function (q) { return '<button type="button">' + esc(q) + '</button>'; }).join('') + '</div>' : '') +
    '<div class="composer-in"><textarea id="msgin" rows="1" placeholder="Message"></textarea><button class="send" id="sendbtn" aria-label="Send">' + I('send', 2.1) + '</button></div></div>';
}
function wireComposer(fn) {
  var t = $('#msgin'), go = function () { var v = t.value.trim(); if (!v) return; t.value = ''; fn(v); };
  $('#sendbtn').onclick = go;
  t.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
  t.addEventListener('input', function () { t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; });
  $$('.quick button').forEach(function (b) { b.onclick = function () { fn(b.textContent); }; });
  var m = $('main'); if (m) m.style.paddingBottom = 'calc(var(--safe-b) + 130px)';
}
function toBottom() { setTimeout(function () { window.scrollTo(0, document.body.scrollHeight); }, 30); }
var REPLIES = ['Ok noted 👍', 'Thanks!', 'I can take it, I am nearby.', 'Done. Photos uploaded.', 'Copy that.', 'Will check and update.'];
function sendStaff(text) {
  S.staffChat.push({ id: uid(), from: S.me, text: text, at: new Date().toISOString() }); save(); render(false); toBottom();
  /* a colleague answers a little later, to show a staff chat notification */
  var who = B().staff[1 + Math.floor(Math.random() * 3)];
  setTimeout(function () {
    var msg = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    S.staffChat.push({ id: uid(), from: who, text: msg, at: new Date().toISOString() });
    var here = route().name === 'chat' && route().a === 'staff';
    if (!here) S.staffUnread = (S.staffUnread || 0) + 1;
    save();
    if (here) { render(false); toBottom(); } else notify('staff', who.split(' ')[0] + ' in Team chat', msg, '#chat/staff');
    if (here) refreshBadges();
  }, 5000 + Math.random() * 3000);
}
function sendWa(id, text) {
  var c = S.wa.filter(function (x) { return x.id === id; })[0];
  c.msgs.push({ from: 'staff', by: S.me, text: text, at: new Date().toISOString() }); c.handled = 'staff'; save(); render(false); toBottom();
  setTimeout(function () {
    var msg = ['Ok thank you!', 'Great, I will transfer now.', 'Can I pick up at 9 am instead?', 'Noted 🙏', 'Alright, please book for me.'][Math.floor(Math.random() * 5)];
    c.msgs.push({ from: 'cust', text: msg, at: new Date().toISOString() });
    var here = route().name === 'chat' && route().b === id;
    if (!here) c.unread++;
    save();
    if (here) { render(false); toBottom(); } else notify('wa', c.name + ' on WhatsApp', msg, '#chat/wa/' + id);
  }, 6000 + Math.random() * 3000);
}


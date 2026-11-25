/* ---------------- CHAT ---------------- */
VIEWS.chat = function (r) {
  if (r.a === 'staff') return staffThread();
  if (r.a === 'wa' && r.b) return waThread(r.b);
  var tab = r.a === 'team' ? 'team' : 'wa';
  var last = S.staffChat[S.staffChat.length - 1];
  var html = topbar('Chat') + '<main>' +
    '<div class="seg2"><a href="#chat" class="' + (tab === 'wa' ? 'on' : '') + '">Customers' + dotHtml(S.wa.reduce(function (s, c) { return s + c.unread; }, 0)) + '</a><a href="#chat/team" class="' + (tab === 'team' ? 'on' : '') + '">Staff' + dotHtml(S.staffUnread || 0) + '</a></div>';
  if (tab === 'team') {
    html += '<div class="list"><a class="row" href="#chat/staff"><div class="av" style="background:var(--dark)">' + I('users') + '</div><div class="grow"><div class="t1">Team chat</div><div class="t2">' + (last ? esc(firstName(who(last.from)) + ': ' + last.text) : 'No messages yet') + '</div></div><div class="end"><div class="tiny muted">' + (last ? ago(last.at) : '') + '</div>' + (S.staffUnread ? '<span class="dot" style="position:static;display:inline-grid;margin-top:4px;border:0">' + S.staffUnread + '</span>' : '') + '</div></a></div>' +
      '<p class="small muted" style="margin:12px 4px">Everyone on the team sees this chat. Booking numbers like ' + esc((S.bookings[0] || {}).code || bookingCode(1)) + ' turn into links.</p>';
  } else html += waListHtml();
  html += '</main>';
  return { html: html };
};
var leadsOn = function () { return typeof Leads !== 'undefined' && can('leads.view'); };
VIEW_STATE.push(function () { if (typeof Leads !== 'undefined') Leads.tab = 'all'; });
/* re-draw the thread but keep what is half typed in the message box (text, cursor and keyboard) */
function chatRender() {
  var t = $('#msgin'), v = t ? t.value : '', a = t ? t.selectionStart : 0, z = t ? t.selectionEnd : 0, f = !!t && document.activeElement === t;
  render(false);
  var n = $('#msgin'); if (!n || !t) return;
  n.value = v; if (v) { n.dispatchEvent(new Event('input')); }
  if (f) { n.focus(); try { n.setSelectionRange(a, z); } catch (e) {} }
}
function lastMsg(c) { return c.msgs[c.msgs.length - 1] || { text: '', at: (c.lead && c.lead.at) || new Date(0).toISOString(), from: 'cust' }; }
function assistantCard() {
  var a = S.assistant || { on: true }, edit = can('leads.settings');
  return '<div class="ch-asst' + (a.on ? ' on' : '') + '"><span class="ch-asic">' + I('bot') + '</span><div class="grow"><b>' + (a.on ? 'The assistant is on' : 'The assistant is off') + '</b>' +
    '<div class="small">' + (a.on ? 'It answers new customers on WhatsApp with dates, free cars and prices. Anything it cannot answer waits for staff.' : 'It sends nothing. Staff answer every chat.') + '</div>' +
    (a.by ? '<div class="tiny muted">Last changed by ' + esc(who(a.by)) + ', ' + esc(ago(a.at)) + '</div>' : '') + '</div>' +
    (edit ? '<label class="sw ch-sw" aria-label="Booking assistant on or off"><input type="checkbox" id="asstsw"' + (a.on ? ' checked' : '') + ' onchange="Leads.setAssistant(this.checked)"><i></i></label>' : '') + '</div>';
}
function waRow(c) {
  var m = lastMsg(c), L = c.lead || {}, lead = leadsOn() && c.lead, s = lead ? Leads.stateOf(c) : '';
  var line = lead ? Leads.listLine(c) : '';
  var chips = lead ? Leads.stateChip(c) + (s !== 'booked' && s !== 'closed' ? Leads.holdChip(L) : '') : chip(c.status, c.status === 'Booked' ? 'green' : c.status === 'Lead' ? 'blue' : 'grey');
  return '<a class="row ch-row" href="#chat/wa/' + c.id + '"><div class="av" style="background:' + avColor(c.name || c.phone) + '">' + (c.name ? initials(c.name) : '#') + '</div><div class="grow">' +
    '<div class="t1">' + (c.name ? esc(c.name) : '<span class="muted">No name</span> <span class="ch-ph">' + esc(c.phone) + '</span>') + '</div>' +
    (line ? '<div class="ch-l2">' + esc(line) + '</div>' : '') +
    '<div class="ch-chips">' + chips + '</div>' +
    '<div class="t2">' + (m.from === 'bot' ? 'Assistant: ' : m.from === 'staff' ? (m.by && m.by !== S.me ? firstName(who(m.by)) + ': ' : 'You: ') : '') + esc(m.text) + '</div></div>' +
    '<div class="end"><div class="tiny muted">' + ago(m.at) + '</div>' + (c.unread ? '<span class="dot ch-unread">' + c.unread + '</span>' : '') + '</div></a>';
}
function waListHtml() {
  var sorted = S.wa.slice().sort(function (a, b) { return new Date(lastMsg(b).at) - new Date(lastMsg(a).at); });
  var html = assistantCard();
  if (leadsOn()) {
    var tab = Leads.tab || 'all';
    html += '<div class="chiprow ch-tabs">' + Leads.TABS.map(function (t) {
      var n = S.wa.filter(function (c) { return c.lead && Leads.inTab(c, t.k); }).length;
      return '<button type="button" class="fchip' + (t.k === tab ? ' on' : '') + '" onclick="Leads.tab=\'' + t.k + '\';render(false,true)">' + esc(t.label) + (t.k === 'waiting' && n ? ' <span class="ch-badge">' + n + '</span>' : t.k !== 'all' ? ' <span class="n">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    if (tab !== 'all') sorted = sorted.filter(function (c) { return c.lead && Leads.inTab(c, tab); });
    if (tab === 'waiting') sorted.sort(function (a, b) { return new Date((a.lead || {}).at || 0) - new Date((b.lead || {}).at || 0); });
  }
  html += sorted.length ? '<div class="list">' + sorted.map(waRow).join('') + '</div>' :
    '<div class="empty card">' + I('chat') + '<div>' + ({ waiting: 'Nobody is waiting for staff. Nice!', mine: 'You are not handling any customer right now.', assistant: 'The assistant is not chatting with anyone.', closed: 'No closed chats yet.' }[Leads.tab] || 'No chats yet.') + '</div></div>';
  html += '<button type="button" class="btn link ch-demo" onclick="Leads.simulateNew()">' + I('bell') + 'Demo: a new customer writes</button>';
  return html;
}
function dotHtml(n) { return n ? '<span class="dot">' + n + '</span>' : ''; }
function linkCodes(t) { return esc(t).replace(new RegExp('\\b(' + (B().codePrefix || B().code) + '-\\d{5})\\b', 'g'), function (m) { var b = S.bookings.filter(function (x) { return x.code === m; })[0]; return b ? '<a href="#booking/' + b.id + '" style="color:inherit;text-decoration:underline">' + m + '</a>' : m; }); }
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
  var list = S.staffChat.map(function (m) { return { at: m.at, text: m.text, from: m.from, who: m.from === S.me ? '' : firstName(who(m.from)) }; });
  var html = topbar('Team chat', { back: '#chat/team', sub: S.staff.filter(function (p) { return p.active !== false; }).length + ' people' }) + '<main><div class="thread" id="thread">' + bubbles(list, function (m) { return m.from === S.me ? 'out' : 'in'; }) + '</div></main>' +
    composer(['On my way', 'Car is ready', 'Handover done', 'Can someone cover me?']);
  return { html: html, noNav: true, after: function () { wireComposer(sendStaff); toBottom(); } };
}
function waThread(id) {
  var c = S.wa.filter(function (x) { return x.id === id; })[0]; if (!c) { location.hash = '#chat'; return { html: '' }; }
  c.unread = 0; save();
  S.notifs.forEach(function (n) { if (n.link === '#chat/wa/' + id) setNotifRead(n, true); });
  var list = c.msgs.map(function (m) { return { at: m.at, text: m.text, from: m.from, who: m.from === 'bot' ? 'Booking assistant' : m.from === 'staff' ? firstName(who(m.by || S.me)) : '' }; });
  var tel = String(c.phone || '').replace(/[^\d+]/g, ''), cu = typeof Cust !== 'undefined' && Cust.byPhone ? Cust.byPhone(c.phone) : null;
  var right = (tel ? '<a class="iconbtn" href="tel:' + esc(tel) + '" aria-label="Call">' + I('phone') + '</a>' : '') +
    (cu && can('customers.view') ? '<button class="iconbtn" type="button" onclick="Cust.open(\'' + cu.id + '\')" aria-label="View customer">' + I('user') + '</button>' : '') +
    '<a class="iconbtn" href="https://wa.me/' + normPhone(c.phone) + '" target="_blank" rel="noopener" aria-label="Open in WhatsApp">' + I('wa') + '</a>';
  /* free cars for the dates the customer asked about (or the default period when the chat has no dates) */
  if (can('bookings.view')) {
    var ld = c.lead || {}, avh = ld.start && ld.end && new Date(ld.end) > new Date(ld.start) ? hashWith('availability', { from: avLocal(ld.start), to: avLocal(ld.end) }) : '#availability';
    right = '<a class="iconbtn" href="' + avh + '" aria-label="Check free cars" title="Check free cars">' + I('car') + '</a>' + right;
  }
  var a = S.assistant || { on: true }, sum = leadsOn() ? Leads.summary(id, { thread: true }) : '';
  var who_ = cu ? cu.name : c.name || c.phone;
  var banner = !a.on ? '<div class="banner ch-tb">' + I('users') + '<div style="flex:1">The assistant is off. Staff answer this chat.</div></div>' :
    c.handled === 'bot' ? '<div class="banner ch-tb">' + I('bot') + '<div style="flex:1">The assistant is handling this chat. Sending a message takes over from it.</div></div>' :
    '<div class="banner ch-tb">' + I('users') + '<div style="flex:1">Staff are handling this chat. <button style="color:var(--brand-ink);font-weight:700" onclick="handBack(\'' + id + '\')">Hand back to assistant</button></div></div>';
  var html = topbar(c.name || c.phone, { back: '#chat', sub: (!a.on ? 'Staff' : c.handled === 'bot' ? 'Assistant' : 'Staff') + (c.name ? ' · ' + c.phone : ''), right: right, noBell: true }) +
    sum + '<main class="ch-main">' + banner +
    (cu && !c.name ? '<div class="small muted ch-known">Known customer: <a href="#customer/' + cu.id + '">' + esc(cu.name) + '</a></div>' : '') +
    '<div class="thread" id="thread">' + bubbles(list, function (m) { return m.from === 'cust' ? 'in' : m.from === 'bot' ? 'bot' : 'out'; }) + '</div>' +
    (!leadsOn() && c.status !== 'Booked' && can('bookings.create') ? '<button class="btn ghost" style="margin-top:6px" onclick="waToBooking(\'' + id + '\')">' + I('plus') + 'Make a booking for ' + esc(firstName(who_) || 'this customer') + '</button>' : '') + '</main>' +
    composer((B().quickReplies || []).map(fillReply));
  return { html: html, noNav: true, after: function () { wireComposer(function (t) { sendWa(id, t); }); toBottom(); } };
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
  /* quick replies fill the box (staff can change the text before sending) */
  $$('.quick button').forEach(function (b) { b.onclick = function () { var cur = t.value.trim(); t.value = cur ? cur + ' ' + b.textContent : b.textContent; t.dispatchEvent(new Event('input')); try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } var L = t.value.length; try { t.setSelectionRange(L, L); } catch (e) {} }; });
  t.addEventListener('focus', chatKb); t.addEventListener('blur', function () { setTimeout(chatKb, 60); });
  var m = $('main'); if (m) m.style.paddingBottom = 'calc(var(--safe-b) + 130px)';
}
/* the quick-reply row hides while the keyboard is open (and in landscape, in leads.css) */
function chatKb() {
  var vv = window.visualViewport, open = !!vv && (window.innerHeight - vv.height) > 140 && document.activeElement && document.activeElement.id === 'msgin';
  document.body.classList.toggle('kb-open', open);
}
if (window.visualViewport) window.visualViewport.addEventListener('resize', chatKb);
window.addEventListener('hashchange', function () { document.body.classList.remove('kb-open'); });
function toBottom() { setTimeout(function () { window.scrollTo(0, document.body.scrollHeight); }, 30); }
var REPLIES = ['Ok noted', 'Thanks!', 'I can take it, I am nearby.', 'Done. Photos uploaded.', 'Copy that.', 'Will check and update.'];
function sendStaff(text) {
  S.staffChat.push({ id: uid(), from: S.me, text: text, at: new Date().toISOString() }); save(); chatRender(); toBottom();
  /* a colleague answers a little later, to show a staff chat notification */
  var others = S.staff.filter(function (p) { return p.id !== S.me && p.active !== false; }), mate = others[Math.floor(Math.random() * others.length)];
  if (!mate) return;
  later(function () {
    var msg = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    S.staffChat.push({ id: uid(), from: mate.id, text: msg, at: new Date().toISOString() });
    var here = route().name === 'chat' && route().a === 'staff';
    if (!here) S.staffUnread = (S.staffUnread || 0) + 1;
    save();
    if (here) { chatRender(); toBottom(); } else notify('staff', firstName(mate.name) + ' in Team chat', msg, '#chat/staff', { from: mate.id });
    if (here) refreshBadges();
  }, 5000 + Math.random() * 3000);
}
function sendWa(id, text) {
  var c = S.wa.filter(function (x) { return x.id === id; })[0];
  c.msgs.push({ from: 'staff', by: S.me, text: text, at: new Date().toISOString() }); c.handled = 'staff';
  if (c.lead && !c.lead.takenBy && (c.lead.state === 'waiting' || c.lead.state === 'assistant') && can('leads.manage')) { c.lead.takenBy = S.me; c.lead.takenAt = new Date().toISOString(); c.lead.state = 'taken'; }
  save(); chatRender(); toBottom();
  later(function () {
    var msg = ['Ok thank you!', 'Great, I will transfer now.', 'Can I pick up at 9 am instead?', 'Noted, thanks', 'Alright, please book for me.'][Math.floor(Math.random() * 5)];
    c.msgs.push({ from: 'cust', text: msg, at: new Date().toISOString() });
    var here = route().name === 'chat' && route().b === id;
    if (!here) c.unread++;
    save();
    if (here) { chatRender(); toBottom(); } else notify('wa', (c.name || c.phone) + ' on WhatsApp', msg, '#chat/wa/' + id);
  }, 6000 + Math.random() * 3000);
}


/* quick reply text from company settings: {deliveryFee}, {returnFee}, {company} */
function fillReply(t) { var b = B(); return String(t).replace(/\{deliveryFee\}/g, rm(b.clientDeliveryFee || 0)).replace(/\{returnFee\}/g, rm(b.clientReturnFee || 0)).replace(/\{company\}/g, b.name); }

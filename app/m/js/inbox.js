/* ---------------- INBOX (M9) ----------------
   Filter chips (All, Bookings, Payments, Chat, Handovers, Fleet), swipe a row sideways to mark it read, Clear read with Undo.
   A notification whose link goes nowhere (empty or '#inbox') is only marked read. */
var INBOX = { f: 'all' };
VIEW_STATE.push(function () { INBOX = { f: 'all' }; });
var INBOX_GROUPS = [['all', 'All', null], ['bookings', 'Bookings', ['new', 'change']], ['payments', 'Payments', ['pay']], ['chat', 'Chat', ['staff', 'wa', 'lead']], ['handovers', 'Handovers', ['due', 'job', 'tomorrow']], ['fleet', 'Fleet', ['service', 'alarm']]];
function notifLinkOk(l) { l = String(l || ''); return !!l && l !== '#' && l !== '#inbox'; }
function notifRow(n) {
  return '<button type="button" class="notif ' + (n.read ? '' : 'unread') + '" data-nid="' + esc(n.id) + '" onclick="openNotif(\'' + esc(n.id) + '\')">' + kindIcon(n.kind) + '<div style="flex:1;min-width:0"><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p><time>' + ago(n.at) + '</time></div></button>';
}
function openNotif(id) {
  var el = $('[data-nid="' + id + '"]'); if (el && el.dataset.swiped) { delete el.dataset.swiped; return; }
  var n = S.notifs.filter(function (x) { return x.id === id; })[0]; if (!n) return;
  n.read = true; save(); refreshBadges();
  if (notifLinkOk(n.link)) location.hash = n.link; else render(false, true);
}
VIEWS.inbox = function () {
  var g = INBOX_GROUPS.filter(function (x) { return x[0] === INBOX.f; })[0] || INBOX_GROUPS[0];
  var list = S.notifs.filter(function (n) { return !g[2] || g[2].indexOf(n.kind) >= 0; });
  var unread = list.filter(function (n) { return !n.read; }).length, readN = S.notifs.filter(function (n) { return n.read; }).length;
  var cnt = function (x) { return S.notifs.filter(function (n) { return !n.read && (!x[2] || x[2].indexOf(n.kind) >= 0); }).length; };
  var html = topbar('Notifications', { back: '#home', right: '<a class="iconbtn" href="#notifs" aria-label="Notification settings">' + I('gear') + '</a>', noBell: true }) + '<main>' +
    '<div class="chiprow">' + INBOX_GROUPS.map(function (x) { var c = cnt(x); return '<button type="button" class="fchip ' + (INBOX.f === x[0] ? 'on' : '') + '" data-if="' + x[0] + '">' + x[1] + (c ? ' <span class="n">' + c + '</span>' : '') + '</button>'; }).join('') + '</div>' +
    '<div class="ib-bar"><span class="small muted">' + (unread ? unread + ' unread' : 'All read') + '</span><span class="grow"></span>' +
    (unread ? '<button type="button" class="ib-btn" id="ibAll">Mark all read</button>' : '') + (readN ? '<button type="button" class="ib-btn" id="ibClear">Clear read</button>' : '') + '</div>' +
    '<div class="list ib-list">' + (list.map(notifRow).join('') || '<div class="empty">' + (INBOX.f === 'all' ? 'No notifications' : 'Nothing here') + '</div>') + '</div>' + (list.length ? '<p class="small muted ib-hint">Swipe a row sideways to mark it read or unread.</p>' : '') + '</main>';
  return { html: html, keepScroll: true, after: function () {
    $$('[data-if]').forEach(function (b) { b.onclick = function () { INBOX.f = b.dataset.if; render(false, true); }; });
    var a = $('#ibAll'); if (a) a.onclick = function () { list.forEach(function (n) { n.read = true; }); save(); render(false, true); };
    var c = $('#ibClear'); if (c) c.onclick = function () {
      var keep = S.notifs.slice(), n = readN;
      S.notifs = S.notifs.filter(function (x) { return !x.read; }); save(); render(false, true);
      undoSnack(n + (n === 1 ? ' read notification cleared' : ' read notifications cleared'), function () { S.notifs = keep; save(); render(false, true); });
    };
    ibSwipe();
  } };
};
/* swipe a row left or right to mark it read (unread ones) or unread again */
function ibSwipe() {
  $$('.ib-list .notif').forEach(function (el) {
    var x0 = null, y0 = null, dx = 0, horiz = null;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; horiz = null; el.style.transition = 'none'; }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (x0 == null) return; dx = e.touches[0].clientX - x0; var dy = e.touches[0].clientY - y0;
      if (horiz == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horiz = Math.abs(dx) > Math.abs(dy);
      if (horiz) { el.style.transform = 'translateX(' + dx + 'px)'; el.classList.toggle('ib-swiping', Math.abs(dx) > 70); }
    }, { passive: true });
    el.addEventListener('touchend', function () {
      if (x0 == null) return; x0 = null; el.style.transition = ''; el.style.transform = ''; el.classList.remove('ib-swiping');
      if (horiz && Math.abs(dx) > 70) {
        el.dataset.swiped = '1'; setTimeout(function () { delete el.dataset.swiped; }, 400);
        var n = S.notifs.filter(function (q) { return q.id === el.dataset.nid; })[0]; if (!n) return;
        n.read = !n.read; save(); refreshBadges(); el.classList.toggle('unread', !n.read);
        say(n.read ? 'Marked as read' : 'Marked as unread');
        setTimeout(function () { if (route().name === 'inbox') render(false, true); }, 250);
      }
    });
  });
}

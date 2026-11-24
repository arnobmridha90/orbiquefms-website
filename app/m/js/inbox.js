/* ---------------- INBOX ---------------- */
function notifRow(n) {
  return '<button class="notif ' + (n.read ? '' : 'unread') + '" onclick="openNotif(\'' + n.id + '\')">' + kindIcon(n.kind) + '<div style="flex:1;min-width:0"><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p><time>' + ago(n.at) + '</time></div></button>';
}
function openNotif(id) { var n = S.notifs.filter(function (x) { return x.id === id; })[0]; n.read = true; save(); location.hash = n.link; }
VIEWS.inbox = function () {
  var html = topbar('Notifications', { back: '#home', right: '<a class="iconbtn" href="#notifs" aria-label="Notification settings">' + I('gear') + '</a>' }) + '<main>' +
    '<div style="display:flex;justify-content:flex-end;margin:4px 0 8px"><button class="small b" style="color:var(--brand-ink)" onclick="S.notifs.forEach(function(n){n.read=true});save();render()">Mark all as read</button></div>' +
    '<div class="list">' + (S.notifs.map(notifRow).join('') || '<div class="empty">No notifications</div>') + '</div></main>';
  return { html: html };
};


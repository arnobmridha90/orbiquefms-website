/* ---------------- start (loads last: every module has registered its views and seeders) ---------------- */
S = load(); save();
/* ---------------- handover reminders while the app is open ---------------- */
function checkDue() {
  var now = Date.now(); S.dueSeen = S.dueSeen || {};
  S.bookings.forEach(function (b) {
    if (b.status === 'Confirmed') { var t = new Date(b.start).getTime(); if (t > now && t - now < HOUR && !S.dueSeen[b.id + 'o']) { S.dueSeen[b.id + 'o'] = 1; notify('due', 'Pick-up at ' + hm(b.start), cust(b.cust).name + ' · ' + car(b.car).plate + ' · ' + b.pickPlace, '#booking/' + b.id); } }
    if (b.status === 'Picked up') { var e = new Date(b.end).getTime(); if (e < now - 30 * 60000 && !S.dueSeen[b.id + 'l']) { S.dueSeen[b.id + 'l'] = 1; notify('due', 'Late return: ' + car(b.car).plate, cust(b.cust).name + ' was due back at ' + hm(b.end), '#booking/' + b.id); } }
  });
  save();
}

/* ---------------- start ---------------- */
applyTheme();
if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#home');
render();
setTimeout(checkDue, 2500); setInterval(checkDue, 60000);
setInterval(function () { if (route().name === 'home' && !$('#sheet')) render(false, true); }, 60000);

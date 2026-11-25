/* ---------------- start (loads last: every module has registered its views and seeders) ----------------
   The demo starts at once. The real app (app/s/, js/cloud.js) signs in and loads the company's data first, then calls startApp(). */
/* ---------------- handover reminders while the app is open: only my own jobs ---------------- */
function myJob(b) {
  if ((b.assigned || []).indexOf(S.me) >= 0) return true;
  return (S.tasks || []).some(function (t) { return t.booking === b.id && (t.staff || []).indexOf(S.me) >= 0 && t.status !== 'Cancelled'; });
}
function checkDue() {
  if (!S || !S.me) return;
  var now = Date.now(); S.dueSeen = S.dueSeen || {};
  S.bookings.forEach(function (b) {
    if (!myJob(b)) return;
    var c = car(b.car) || {};
    if (UPCOMING.indexOf(b.bookingStatus) >= 0) { var t = new Date(b.start).getTime(); if (t > now && t - now < HOUR && !S.dueSeen[b.id + 'o']) { S.dueSeen[b.id + 'o'] = 1; notify('due', 'Pick-up at ' + hm(b.start), cust(b.cust).name + ' · ' + c.plate + ' · ' + placeText(b, 'pick'), '#booking/' + b.id); } }
    if (b.bookingStatus === 'Car Delivered') { var e = new Date(b.end).getTime(); if (e < now - 30 * MIN && !S.dueSeen[b.id + 'l']) { S.dueSeen[b.id + 'l'] = 1; notify('due', 'Late return: ' + c.plate, cust(b.cust).name + ' was due back at ' + hm(b.end), '#booking/' + b.id); } }
  });
  save();
}

/* ---------------- start ---------------- */
function startApp() {
S = load(); save();
applyTheme();
(function firstScreen() {
  var base = location.pathname + location.search.replace(/([?&])share=slip(&|$)/, '$1').replace(/[?&]$/, '');
  var shared = /[?&]share=slip/.test(location.search);
  if (!S.me || !staff(S.me) || !me().loginActive) { history.replaceState(null, '', base + '#signin'); return; }
  if (shared) { history.replaceState(null, '', base + '#slip'); return; } /* a slip picture shared from WhatsApp (see sw.js) */
  if (!location.hash || location.hash === '#') history.replaceState(null, '', base + '#' + ((S.prefs && S.prefs.startTab) || 'home'));
})();
render();
setTimeout(checkDue, 2500); setInterval(checkDue, 60000);
setInterval(function () { if (S && route().name === 'home' && !SHEETS.length) render(false, true); }, 60000);
}
if (window.FMS_CLOUD) FMS_CLOUD.boot(startApp); else startApp();

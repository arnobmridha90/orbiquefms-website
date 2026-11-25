/* ===================================================================
   Start: read the address (#b=1&page=bookings&action=add), restore per-viewer choices, apply the company's colours, draw.
   =================================================================== */
function measureBar() {
  var sx = document.querySelector('.sx'); if (!sx) return;
  var h = getComputedStyle(sx).position === 'sticky' ? sx.offsetHeight : 0;
  document.documentElement.style.setProperty('--sx-h', h + 'px');
}
(function () {
  try { if (localStorage.getItem('fms.rail') === '1') S.rail = true; var m = localStorage.getItem('fms.mode'); if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m); } catch (e) { /* private window: defaults */ }
  runInits();
  try {
    readHash(location.hash);
    if (S.drawer && S.drawer.kind === 'booking' && S.drawer.code === 'first') { var f = D().bookings.filter(function (x) { return x.status === 'Car Delivered'; })[0]; S.drawer.code = f ? f.code : D().bookings[0].code; }
  } catch (e) { console.warn('Address not understood, opening the Dashboard', e); }
  applyTheme(B());
  var r0 = render;
  render = function () { r0(); measureBar(); };
  render();
  window.addEventListener('resize', measureBar);
  var lastHash = location.hash;
  window.addEventListener('hashchange', function () {
    var cur = '#' + location.hash.replace(/^#/, ''), before = lastHash;
    /* unsaved changes in an open drawer or dialog: ask first, and put the old address back if the person stays */
    if (UI.isDirty()) { try { history.replaceState(null, '', before); } catch (e) { /* ignore */ } }
    UI.leave(function () {
      if (location.hash !== cur) { try { history.replaceState(null, '', cur); } catch (e) { /* ignore */ } }
      var b0 = S.b; readHash(cur); if (S.b !== b0) applyTheme(B());
      UI.closeAll(); UI.clearToasts(); render(); lastHash = location.hash;
    });
  });
  window.addEventListener('resize', function () { if (UI.placeToasts) UI.placeToasts(); });
})();

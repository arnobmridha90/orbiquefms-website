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
  /* this tab's place in the browser history (kept across a reload) */
  var st0 = history.state;
  UI.hist.setPos(st0 && st0.fms ? st0.pos : 0);
  if (st0 && st0.fms && st0.layer) UI.hist.adopt(st0.pos);
  try { history.replaceState({ fms: 1, pos: UI.hist.pos() }, '', location.hash || location.href); } catch (e) { /* ignore */ }
  try {
    readHash(location.hash);
    if (S.drawer && S.drawer.kind === 'booking' && S.drawer.code === 'first') { var f = D().bookings.filter(function (x) { return x.status === 'Car Delivered'; })[0]; S.drawer.code = f ? f.code : D().bookings[0].code; }
  } catch (e) { console.warn('Address not understood, opening the Dashboard', e); }
  applyTheme(B());
  var r0 = render;
  render = function () { r0(); measureBar(); };
  render();
  window.addEventListener('resize', measureBar);
  /* Back and Forward (browser or phone): close the top drawer or dialog first (asking when it has unsaved changes),
     otherwise draw the page the address names. A typed or pasted address asks first when something is unsaved. */
  var lastHash = location.hash;
  function drawFromAddress(state) {
    var b0 = S.b; readHash(location.hash); if (S.b !== b0) applyTheme(B());
    writeHash.key = navKey();
    UI.closeAll({ keepHistory: true }); UI.clearToasts();
    if (state && state.layer) UI.hist.adopt(state.pos);
    render(); lastHash = location.hash;
  }
  window.addEventListener('popstate', function (ev) {
    var r = UI.hist.pop(ev.state);
    if (r === 'skip' || r === 'layer') { lastHash = location.hash; return; }
    if (r === 'page') { drawFromAddress(ev.state); return; }
    /* typed or pasted address: a new entry this app did not write */
    var cur = location.hash, before = lastHash;
    UI.hist.setPos(UI.hist.pos() + 1);
    if (UI.isDirty()) { UI.hist.replace(before); }
    UI.leave(function () {
      var f = function () { UI.hist.forget(); UI.hist.replace(cur); drawFromAddress(null); };
      if (UI.hist.busy()) UI.hist.later(f); else f();
    });
  });
  /* closing the tab or reloading with unsaved changes: the browser asks */
  window.addEventListener('beforeunload', function (ev) { if (UI.isDirty()) { ev.preventDefault(); ev.returnValue = ''; } });
  window.addEventListener('resize', function () { if (UI.placeToasts) UI.placeToasts(); });
})();

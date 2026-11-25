/* ---------------- INSTALL (M9) ----------------
   App name, APK file and the Android settings hint all come from B() (company settings). The steps for this phone come first. */
var deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; if (S && (route().name === 'install' || route().name === 'home')) render(false, true); });
window.addEventListener('appinstalled', function () { say('Installed. Open it from your Home Screen'); });
function isAndroidPhone() { return ANDROID || /android/i.test(navigator.userAgent); }
VIEWS.install = function () {
  var b = B(), ios = isIOS(), android = !ios && isAndroidPhone(), app = b.appName || (b.short + ' Staff');
  var step = function (n, html) { return '<div class="row"><span class="chip brand">' + n + '</span><div class="grow" style="white-space:normal">' + html + '</div></div>'; };
  var shareIc = I('share').replace('<svg', '<svg class="in-ic"');
  var iphone = '<div class="sec"><h2>' + (ios ? 'On this iPhone (Safari)' : 'On iPhone (Safari)') + '</h2></div><div class="list">' +
    step(1, 'Open this page in <b>Safari</b>.') + step(2, 'Tap the <b>Share</b> button ' + shareIc + ' at the bottom.') + step(3, 'Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.') +
    step(4, 'Open <b>' + esc(app) + '</b> from the Home Screen, then turn on notifications in More › Notifications.') + '</div>';
  var apk = b.apk ? '<div class="sec"><h2>Android app file (APK)</h2></div><div class="list"><a class="row" href="' + esc(b.apk) + '" download>' + I('install') + '<div class="grow"><div class="t1">Download ' + esc(app) + ' (' + esc(String(b.apk).split('/').pop()) + ')</div><div class="t2" style="white-space:normal">Open the file and allow installing from this source when asked</div></div></a></div>' : '';
  var droid = '<div class="sec"><h2>' + (android ? 'On this phone (Android, Chrome)' : 'On Android (Chrome)') + '</h2></div><div class="list">' +
    step(1, (deferredPrompt ? 'Tap <b>Install now</b> above, or the' : 'Tap the') + ' <b>⋮</b> menu › <b>Install app</b> or <b>Add to Home screen</b>.') +
    step(2, 'Open <b>' + esc(app) + '</b> from the Home Screen and allow notifications.') +
    step(3, 'No notifications? Go to <b>Settings › Apps › ' + esc(app) + ' › Notifications</b> and turn them on.') + '</div>' + apk;
  var html = topbar('Install the app', { back: '#more' }) + '<main>' +
    '<div class="card in-hero"><div class="in-logo">' + MARKS[CO] + '</div><div class="b" style="font-size:17px">' + esc(app) + '</div><div class="small muted">Opens full screen, stays signed in, sends notifications</div></div>' +
    (standalone() ? '<div class="banner green" style="margin-top:12px">' + I('check', 2.4) + '<div><b>Installed.</b> You are using ' + esc(app) + ' from the Home Screen.</div></div>' :
    (deferredPrompt ? '<div style="margin-top:12px"><button class="btn" onclick="deferredPrompt.prompt();deferredPrompt.userChoice.then(function(){deferredPrompt=null;render(false,true)})">' + I('install') + 'Install now</button></div>' : '') +
    (ios ? iphone + droid : droid + iphone)) +
    '<p class="demo-note">Each company gets its own app name, icon and colours from its logo.</p></main>';
  return { html: html };
};

/* ---------------- company switch (demo) ---------------- */
VIEWS.company = function () {
  var html = topbar('Company and colours', { back: '#more' }) + '<main><p class="small muted" style="margin:6px 4px 12px">In the real app each company has its own address, logo and colours, picked from its logo. In this demo you can switch to see the same app in another brand. Each company keeps its own dummy data.</p>' +
    Object.keys(COMPANIES).map(function (k) { var c = COMPANIES[k]; return '<button class="cobtn ' + (k === CO ? 'on' : '') + '" onclick="switchCo(\'' + k + '\')"><span class="m">' + MARKS[k] + '</span><span style="flex:1;min-width:0"><b style="display:block">' + esc(c.name) + '</b><span class="small muted">' + c.colours + ' · ' + c.city + '</span></span><span class="sw-dots"><i style="background:' + c.dark + '"></i><i style="background:' + c.primary + '"></i><i style="background:' + c.accent + '"></i></span></button>'; }).join('') +
    '<p class="small muted" style="margin:10px 4px">If you installed the app, the Home Screen icon stays the company you installed. To get another icon, open the page with that company and add it again.</p></main>';
  return { html: html };
};
/* load another company's data and look. Returns true when someone is signed in there. */
function useCo(k) {
  resetViewState(); closeAllSheets();
  CO = k; try { localStorage.setItem('fms.co', k); } catch (e) {}
  S = load();
  /* never carry a session into another company: only someone who signed in there on this phone stays signed in (the demo's ready-made owner does not) */
  if (S.me && S.signedIn !== S.me) { S.me = null; S.tempSession = null; usePrefs(); }
  save(); applyTheme();
  $('#manifestLink').href = 'manifest-' + k + '.webmanifest'; $('#appleIcon').href = 'icons/' + k + '-180.png'; $('#favIcon').href = 'icons/' + k + '-192.png';
  document.title = B().appName; $('#appleTitle').content = B().appName;
  return !!(S.me && staff(S.me) && me().loginActive);
}
function switchCo(k) {
  var signedIn = useCo(k);
  history.replaceState(null, '', location.pathname + '?co=' + k + (signedIn ? '#company' : '#signin')); render(); say('Now showing ' + COMPANIES[k].name + (signedIn ? '' : '. Sign in to continue'));
}
/* the phone's Back (or Forward) reached a page of another company (?co= in the address): show that company, so the screen, the data and the address always agree */
window.addEventListener('popstate', function () {
  var q = (location.search.match(/[?&]co=(\w+)/) || [])[1];
  if (!q || !COMPANIES[q] || q === CO || !S) return;
  useCo(q); render(true); say('Now showing ' + COMPANIES[q].name);
});


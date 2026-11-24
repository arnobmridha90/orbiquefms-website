/* ---------------- INSTALL ---------------- */
var deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; if (route().name === 'install' || route().name === 'home') render(); });
window.addEventListener('appinstalled', function () { say('Installed. Open it from your Home Screen'); });
VIEWS.install = function () {
  var b = B(), ios = isIOS();
  var html = topbar('Install the app', { back: '#more' }) + '<main>' +
    '<div class="card" style="padding:18px;text-align:center;margin-top:6px"><div style="width:72px;height:72px;border-radius:18px;overflow:hidden;margin:0 auto 10px;box-shadow:0 6px 18px -8px rgba(0,0,0,.4)">' + MARKS[CO] + '</div><div class="b" style="font-size:17px">' + esc(b.short) + ' Staff</div><div class="small muted">Opens full screen, stays signed in, sends notifications</div></div>' +
    (standalone() ? '<div class="banner" style="margin-top:12px;background:var(--ok-bg);color:#0E4F2C">' + I('check', 2.4) + '<div><b>Installed.</b> You are using it from the Home Screen.</div></div>' :
    (deferredPrompt ? '<div style="margin-top:12px"><button class="btn" onclick="deferredPrompt.prompt();deferredPrompt.userChoice.then(function(){deferredPrompt=null;render()})">' + I('install') + 'Install now</button></div>' : '') +
    '<div class="sec"><h2>' + (ios ? 'On iPhone (Safari)' : 'On iPhone (Safari)') + '</h2></div><div class="list">' +
    '<div class="row"><span class="chip brand">1</span><div class="grow" style="white-space:normal">Open this page in <b>Safari</b>.</div></div>' +
    '<div class="row"><span class="chip brand">2</span><div class="grow" style="white-space:normal">Tap the <b>Share</b> button ' + I('share').replace('<svg', '<svg style="display:inline;width:18px;height:18px;vertical-align:-3px"') + ' at the bottom.</div></div>' +
    '<div class="row"><span class="chip brand">3</span><div class="grow" style="white-space:normal">Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.</div></div>' +
    '<div class="row"><span class="chip brand">4</span><div class="grow" style="white-space:normal">Open <b>' + esc(b.short) + ' Staff</b> from the Home Screen, then turn on notifications in More › Notifications.</div></div></div>' +
    '<div class="sec"><h2>Android app file (APK)</h2></div><div class="list"><a class="row" href="kilat-staff.apk" download>' + I('install') + '<div class="grow"><div class="t1">Download Kilat Staff APK</div><div class="t2" style="white-space:normal">Open the file and allow installing from this source when asked</div></div></a></div>' +
    '<div class="sec"><h2>On Android (Chrome)</h2></div><div class="list">' +
    '<div class="row"><span class="chip brand">1</span><div class="grow" style="white-space:normal">Tap <b>Install now</b> above if you see it, or the <b>⋮</b> menu › <b>Install app</b> / <b>Add to Home screen</b>.</div></div>' +
    '<div class="row"><span class="chip brand">2</span><div class="grow" style="white-space:normal">Open it from the Home Screen and allow notifications.</div></div></div>') +
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
function switchCo(k) {
  CO = k; try { localStorage.setItem('fms.co', k); } catch (e) {}
  S = load(); save(); NB = null; applyTheme();
  $('#manifestLink').href = 'manifest-' + k + '.webmanifest'; $('#appleIcon').href = 'icons/' + k + '-180.png'; $('#favIcon').href = 'icons/' + k + '-192.png';
  document.title = COMPANIES[k].short + ' Staff'; $('#appleTitle').content = COMPANIES[k].short + ' Staff';
  history.replaceState(null, '', location.pathname + '?co=' + k + '#company'); render(); say('Now showing ' + COMPANIES[k].name);
}


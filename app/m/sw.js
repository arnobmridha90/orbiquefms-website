/* Orbique FMS staff app: service worker (fast opening, offline shell, phone notifications) */
var CACHE = 'fms-staff-v5';
var SHELL = ['./', './manifest-kilat.webmanifest', './manifest-padi.webmanifest', './manifest-bara.webmanifest',
  './icons/kilat-192.png', './icons/padi-192.png', './icons/bara-192.png', './icons/badge-96.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== 'fms-share'; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request;
  /* share target: a slip picture shared from WhatsApp arrives as a POST; keep the file and open the Upload slip screen */
  if (r.method === 'POST' && r.url.indexOf('share=slip') >= 0) {
    e.respondWith(r.formData().then(function (fd) {
      var f = fd.get('slip');
      return caches.open('fms-share').then(function (c) { return f ? c.put('shared-file', new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } })) : null; });
    }).catch(function () {}).then(function () { return Response.redirect('./?share=slip#slip', 303); }));
    return;
  } if (r.method !== 'GET' || new URL(r.url).origin !== location.origin || r.url.indexOf('/api/') >= 0 || r.url.indexOf('.apk') >= 0) return;
  /* network first, so every change shows the next time the app opens; the saved copy is used only when offline */
  var key = r.mode === 'navigate' ? './' : r;
  e.respondWith(fetch(r).then(function (res) { if (res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, cp); }); } return res; })
    .catch(function () { return caches.match(key).then(function (hit) { return hit || caches.match(r, { ignoreSearch: true }); }); }));
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Orbique FMS', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Orbique FMS', { body: d.body || '', icon: d.icon || 'icons/kilat-192.png', badge: 'icons/badge-96.png', tag: d.tag, data: { url: d.url || './' }, vibrate: [60, 40, 60] }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) { list[i].postMessage({ open: url }); return list[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});

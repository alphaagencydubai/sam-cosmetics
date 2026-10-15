/* Sam Cosmetics service worker — there so the shop can live on the phone's home
   screen like an app. It caches nothing of the shop itself (pages and prices always
   come fresh from the network); it only keeps a small "no connection" page. */
"use strict";
var CACHE = "sam-offline-v1";
var OFFLINE = "offline.html";
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(new Request(OFFLINE, { cache: "reload" })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(function () { return caches.match(OFFLINE); }));
});

// Bump CACHE_NAME when clients are stuck on an old build (iOS home screen).
var CACHE_NAME = "golf-gps-v21";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=21",
  "./app.js?v=21",
  "./sync.js?v=21",
  "./firebase-config.js?v=21",
  "./manifest.webmanifest",
  "./data/olde-salem-greens.json",
  "./icons/favicon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = event.request.url;
  if (
    url.indexOf("firebaseio.com") !== -1 ||
    url.indexOf("googleapis.com") !== -1 ||
    url.indexOf("gstatic.com") !== -1
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: "reload" })
      .then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
  );
});

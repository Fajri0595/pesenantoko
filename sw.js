// Service Worker: Network-first untuk skrip & config dinamis, Cache-first untuk aset statis (ikon/manifest).
const CACHE = 'umkm-mandiri-v4';
const SHELL = ['./', './index.html', './style.css', './app.js', './api.js', './foodimg.js', './favicon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Jangan cache API GAS, QR server, gambar eksternal, atau config.js
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('qrserver.com') ||
    url.hostname.includes('images.unsplash.com') ||
    url.pathname.endsWith('/config.js')
  ) {
    return;
  }
  if (e.request.method !== 'GET') return;

  // Network-first untuk file dinamis (.js, .css, .html) agar update langsung tampil saat online
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first untuk aset statis (gambar, favicon, manifest)
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }))
  );
});

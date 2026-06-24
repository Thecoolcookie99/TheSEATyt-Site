const cacheName = 'myapp-cache-v1';
const filesToCache = [
  '/',
  '/index.html',
  '/icon.png',
  '/error.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(filesToCache)));
});

self.addEventListener('fetch', e => {
  // Handle navigation requests (page loads) separately so we can show
  // the `error.html` page when a missing route is served as `index.html`.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          // If the server serves `index.html` for unknown paths (SPA fallback),
          // detect that and return the cached error page instead.
          try {
            const reqPath = new URL(e.request.url).pathname;
            const respUrl = new URL(resp.url).pathname;
            const isIndexResp = respUrl === '/' || respUrl.endsWith('/index.html');
            if (isIndexResp && reqPath !== '/' && reqPath !== '/index.html') {
              return caches.match('/error.html');
            }
          } catch (err) {
            // ignore parsing errors and return the original response
          }
          return resp;
        })
        .catch(() => caches.match('/error.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('/error.html')))
  );
});
// Kill Switch Service Worker for Soli Medical Suite
// Immediately deletes all caches, claims all clients, and force-reloads all active tabs to get the latest non-cached code.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('Purging stale cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          try {
            client.navigate(client.url);
          } catch (err) {
            console.warn('Failed to force client reload:', err);
          }
        });
      });
    })
  );
});


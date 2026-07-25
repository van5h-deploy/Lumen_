// Service Worker for LUMEN - Offline-first PWA
// IMPORTANT: bump CACHE_NAME (e.g. 'lumen-v3') every time you update index.html,
// manifest.json, or this file — otherwise browsers keep serving the old cached
// version indefinitely, even after you upload new files.
const CACHE_NAME = 'lumen-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('✅ Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests (CDNs, APIs) - fetch from network only
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(request).catch(() => {
        console.log('⚠️ External resource failed (no internet):', url.href);
        // Return offline page or error response
        return new Response('Offline - external resource unavailable', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
    );
    return;
  }

  // For same-origin requests: cache-first strategy
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // Return cached response if available
      if (cachedResponse) {
        console.log('📦 Serving from cache:', url.pathname);
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(request).then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response for caching
        const responseToCache = response.clone();

        // Cache successful responses
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
          console.log('💾 Cached:', url.pathname);
        });

        return response;
      });
    }).catch(() => {
      console.log('❌ Fetch failed, returning cached or offline response:', url.pathname);
      // Return cached index.html as fallback
      return caches.match('./index.html').catch(() => {
        return new Response('Offline - page unavailable', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✨ Service Worker script loaded');

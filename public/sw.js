// Service Worker for Exam Space PWA
const CACHE_NAME = 'exam-space-v3'; // bump when changing caching strategy - v3 for live streaming fixes
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.png',
  '/favicon.png',
  '/manifest.json'
];

// Development mode detection
const isDevelopment = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Files to exclude from caching in development
const excludeFromCache = [
  '/@vite/client',
  '/@react-refresh',
  '/node_modules/',
  '/src/',
  '/@vite/',
  '?t=',
  '?v=',
  '?import',
  '.tsx',
  '.ts',
  '.js',
  '.mjs'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Helper function to check if URL should be excluded from caching
function shouldExcludeFromCache(url) {
  if (!isDevelopment) return false;
  
  return excludeFromCache.some(pattern => {
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      return url.includes(pattern.slice(1, -1));
    }
    return url.includes(pattern);
  });
}

// Fetch event - smarter caching strategy for production
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never handle non-GET, Supabase, or websocket requests
  if (event.request.method !== 'GET') return;
  if (/supabase\.co/.test(url.host)) return;
  if (event.request.headers.get('upgrade') === 'websocket') return;

  // Always network-first for SPA navigations (ensures newest app code)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Skip external origins
  if (!url.origin.startsWith(self.location.origin)) return;

  // In development, skip caching for dev files
  if (shouldExcludeFromCache(event.request.url)) {
    console.log('Service Worker: Skipping cache for development file', event.request.url);
    return;
  }

  // Cache-first for static assets under /assets and icons; network-first otherwise
  const isStaticAsset = url.pathname.startsWith('/assets') || /\.(png|jpg|jpeg|svg|gif|webp|ico|css|js)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        });
      })
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((resp) => resp)
        .catch(() => caches.match(event.request))
    );
  }
});

// Background sync for exam data (currently a no-op)
self.addEventListener('sync', (event) => {
  if (event.tag === 'exam-sync') {
    console.log('Service Worker: Background sync for exam data');
    event.waitUntil(
      // Handle exam data synchronization
      syncExamData()
    );
  }
});

// Push notifications for exam updates
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received');
  
  const options = {
    body: event.data ? event.data.text() : 'New exam update available',
    icon: '/logo.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Exam',
        icon: '/logo.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Exam Space', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click received');
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Helper function for exam data sync
async function syncExamData() {
  try {
    // Implement exam data synchronization logic here
    console.log('Service Worker: Syncing exam data');
    return Promise.resolve();
  } catch (error) {
    console.log('Service Worker: Sync failed', error);
    return Promise.reject(error);
  }
}

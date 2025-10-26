// Service Worker for Exam Space PWA
const CACHE_NAME = 'exam-space-v1';
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // In development, skip caching for development files
  if (shouldExcludeFromCache(event.request.url)) {
    console.log('Service Worker: Skipping cache for development file', event.request.url);
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // In development, don't cache development files
            if (shouldExcludeFromCache(event.request.url)) {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.log('Service Worker: Fetch failed', error);
            // Return offline page or fallback
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background sync for exam data
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

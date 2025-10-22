// Script to clear Service Worker cache and unregister it
// Run this in the browser console if you're having caching issues

console.log('Clearing Service Worker cache...');

// Unregister all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      console.log('Unregistering service worker:', registration);
      registration.unregister();
    }
  });
}

// Clear all caches
if ('caches' in window) {
  caches.keys().then(function(cacheNames) {
    return Promise.all(
      cacheNames.map(function(cacheName) {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
  }).then(function() {
    console.log('All caches cleared!');
    // Reload the page
    window.location.reload();
  });
} else {
  console.log('Caches API not supported');
  window.location.reload();
}

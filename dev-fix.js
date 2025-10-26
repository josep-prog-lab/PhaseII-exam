// Development fix script for Service Worker caching issues
// Run this in your browser console to fix caching problems

console.log('🔧 Fixing Service Worker caching issues...');

// 1. Unregister all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    console.log(`Found ${registrations.length} service workers`);
    registrations.forEach(function(registration) {
      registration.unregister().then(function(success) {
        if (success) {
          console.log('✅ Unregistered service worker:', registration.scope);
        } else {
          console.log('❌ Failed to unregister service worker:', registration.scope);
        }
      });
    });
  });
}

// 2. Clear all caches
if ('caches' in window) {
  caches.keys().then(function(cacheNames) {
    console.log(`Found ${cacheNames.length} caches`);
    return Promise.all(
      cacheNames.map(function(cacheName) {
        console.log('🗑️ Deleting cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
  }).then(function() {
    console.log('✅ All caches cleared!');
    console.log('🔄 Reloading page in 2 seconds...');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });
} else {
  console.log('❌ Caches API not supported');
  window.location.reload();
}

// 3. Disable service worker in development
localStorage.setItem('enable-sw', 'false');
console.log('🚫 Service Worker disabled for development');

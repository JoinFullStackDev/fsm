/**
 * Service Worker for Push Notifications
 * Handles push events and displays browser notifications
 */

// Install event - cache resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Message event - handle messages from main thread (for debugging)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Echo back to confirm service worker is active
  event.ports[0]?.postMessage({ 
    success: true, 
    message: 'Service worker is active',
    registration: {
      scope: self.registration.scope,
      active: !!self.registration.active,
    }
  });
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  const promiseChain = Promise.resolve().then(() => {
    let data = {};
    
    if (event.data) {
      try {
        // Try to parse as JSON first (most common)
        data = event.data.json();
      } catch (e) {
        // Fallback to text
        try {
          const text = event.data.text();
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            data = {
              title: 'Notification',
              body: text,
            };
          }
        } catch (textError) {
          data = {
            title: 'FullStack Method™',
            body: 'You have a new notification',
          };
        }
      }
    } else {
      data = {
        title: 'FullStack Method™',
        body: 'You have a new notification',
      };
    }

    const title = data.title || 'FullStack Method™';
    
    // Check client status first to determine if we should force notification display
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const hasFocusedClient = clientList.some(client => client.focused);
        const hasVisibleClient = clientList.some(client => client.visibilityState === 'visible');

        // Use requireInteraction: true when tab is focused to force notification display
        // Some browsers suppress notifications silently when tab is active
        const options = {
          body: data.body || data.message || 'You have a new notification',
          icon: data.icon || '/fullstack_icon.png',
          badge: data.badge || '/fullstack_icon.png',
          data: data.data || {},
          tag: data.tag || 'notification',
          requireInteraction: hasFocusedClient || hasVisibleClient, // Force display if tab is active
          silent: false,
          vibrate: [200, 100, 200],
          timestamp: Date.now(),
        };

        return self.registration.showNotification(title, options);
      })
      .catch((error) => {
        throw error;
      });
  });

  event.waitUntil(promiseChain);
});

// Notification click event - handle when user clicks on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync event (optional - for future use)
self.addEventListener('sync', (event) => {
  // Handle background sync if needed
});


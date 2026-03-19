// Service Worker for desktop notifications
// This allows notifications to persist even when the tab is in background

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click - focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/calendar') && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window, try to focus any existing one
      if (clientList.length > 0 && 'focus' in clientList[0]) {
        return clientList[0].focus();
      }
      // Otherwise open a new window
      return self.clients.openWindow('/calendar/');
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      tag,
      requireInteraction: true,
      icon: '/favicon.ico',
    });
  }
});

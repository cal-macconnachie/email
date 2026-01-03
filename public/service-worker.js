/* eslint-env serviceworker */
/* global self, caches, fetch, console, URL, clients */

// Service Worker for Email System PWA
const CACHE_NAME = 'email-system-v2' // Incremented for push notification support
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip API requests - always go to network
  if (event.request.url.includes('/api/')) {
    return
  }

  // Skip non-http(s) requests (chrome-extension://, etc.)
  const url = new URL(event.request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  // not api should use network then fall back to cache if no network
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }

        // Clone the response
        const responseToCache = response.clone()

        // Open the cache and put the fetched response in it
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache)
          })

        return response
      })
      .catch(() => {
        // If network request fails, try to serve from cache
        return caches.match(event.request)
      })
  )
})

// Push notification event handler
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('Push event has no data')
    return
  }

  let notificationData
  try {
    notificationData = event.data.json()
  } catch (error) {
    console.error('Failed to parse push data:', error)
    return
  }

  const { title, body, icon, badge, tag, data, requireInteraction } = notificationData

  const options = {
    body: body || '',
    icon: icon || './direct-market.svg',
    badge: badge || './direct-market.svg',
    tag: tag || 'email-notification',
    data: data || {},
    requireInteraction: requireInteraction || false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Open Email'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(title || 'New Email', options)
      .then(() => {
        // Notify all clients (open tabs) to refresh email list
        return clients.matchAll({ type: 'window', includeUncontrolled: true })
      })
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'NEW_EMAIL_NOTIFICATION',
            data: notificationData
          })
        })
      })
  )
})

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Handle action buttons
  if (event.action === 'dismiss') {
    return
  }

  // Open or focus app window
  const urlToOpen = event.notification.data?.url
    ? new URL(event.notification.data.url, self.location.origin).href
    : self.location.origin

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }

        // Open new window if not already open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// Handle push subscription changes (browser revoked or changed endpoint)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    // Attempt to resubscribe with new subscription
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    }).catch((error) => {
      console.error('Failed to resubscribe:', error)
    })
  )
})

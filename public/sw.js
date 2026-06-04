const CACHE_NAME = 'turnify-static-v1'
const OFFLINE_URL = '/offline'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  if (['font', 'image', 'script', 'style'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
      })
    )
  }
})

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Turnify', {
      body: payload.body ?? 'Hai una nuova notifica.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: {
        url: payload.url ?? '/user',
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const requestedPath = event.notification.data?.url ?? '/user'
  let targetUrl = new URL('/user', self.location.origin).href
  if (typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.includes('\\')) {
    const requestedUrl = new URL(requestedPath, self.location.origin)
    if (requestedUrl.origin === self.location.origin) targetUrl = requestedUrl.href
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === targetUrl)
      if (existing) return existing.focus()
      return self.clients.openWindow(targetUrl)
    })
  )
})

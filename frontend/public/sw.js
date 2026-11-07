const CACHE_NAME = 'centiva-shell-v3'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.png', '/apple-touch-icon.png', '/pwa-192.png', '/pwa-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // API, Sanctum and OAuth must always be handled by the network. Intercepting
  // /backend/auth/google/redirect as an app navigation corrupts the PWA shell
  // and can leave the user on the Laravel backend page.
  if (
    url.pathname.startsWith('/backend/')
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/sanctum/')
  ) return
  if (request.headers.get('accept')?.includes('application/json')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (['font', 'image', 'script', 'style'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })),
    )
  }
})

const CACHE_VERSION = 'ebaesan-shell-v3';
const APP_SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(APP_SHELL, { cache: 'no-store' })
      .then((response) => caches.open(CACHE_VERSION).then((cache) => cache.put(APP_SHELL, response)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(APP_SHELL, copy));
        return response;
      })
      .catch(() => caches.match(APP_SHELL))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }
  const data = payload.data ?? payload;
  const notification = payload.notification ?? {};
  const title = data.title ?? notification.title ?? '이배산 알림';
  const body = data.body ?? notification.body ?? '';
  const link = data.link ?? payload.fcmOptions?.link ?? '/';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icon-192x192-v2.png',
    badge: '/favicon-32x32-v2.png',
    data: { link },
    tag: data.jobId ? `ebaesan-${data.jobId}` : undefined,
    renotify: false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.link ?? '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

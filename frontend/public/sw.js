// Service Worker para PWA - Azevedo Mineiro Finanças
const CACHE_NAME = 'azevedo-mineiro-v1';
const API_CACHE = 'azevedo-mineiro-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install - cacheia assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_NAME && key !== API_CACHE)
        .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch - Network First para API, Cache First para assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAPI = url.hostname === 'localhost' && url.port === '3001';

  if (isAPI) {
    // Network First para API
    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(API_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else if (event.request.method === 'GET') {
    // Cache First para assets
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Azevedo Mineiro', body: 'Nova atualização!' };
  try {
    data = event.data?.json() || data;
  } catch (e) {
    data.body = event.data?.text() || data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/' },
      actions: [
        { action: 'open', title: 'Abrir app' },
        { action: 'close', title: 'Fechar' },
      ],
    })
  );
});

// Notificação clicada
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// Background Sync (quando voltar online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // Notifica o cliente para sincronizar
  const clientList = await clients.matchAll({ type: 'window' });
  clientList.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }));
}

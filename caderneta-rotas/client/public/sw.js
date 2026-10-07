// Rede primeiro; se estiver sem sinal, usa o que ja foi visto. A API nunca e cacheada.
const V = 'caderneta-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.add('/')).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api')) return;
  e.respondWith(fetch(e.request)
    .then((r) => { const copia = r.clone(); caches.open(V).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});

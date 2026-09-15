/* Sublichat · limpieza pre-Android · 2026-09-15
   Este worker existe únicamente para retirar caches/registraciones antiguas.
   La versión web actual funciona siempre contra red y no depende de PWA. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('sublicuentas-') || key.startsWith('sublichat-'))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

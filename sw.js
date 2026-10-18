/* DEUKSIL — service worker (application installée sur l'écran d'accueil)
   Stratégie « réseau d'abord » : à chaque ouverture, en ligne, le téléphone
   prend la dernière version des fichiers publiés ; la copie locale ne sert
   que hors connexion. Les données (localStorage) ne sont jamais touchées.
   Changer VERSION n'est pas obligatoire pour publier une mise à jour ; cela
   force seulement le remplacement du service worker lui-même. */
const VERSION = 'deuksil-sw-1';
const CACHE = 'deuksil-fichiers';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const rep = await fetch(req, {cache: 'no-cache'});
      if (rep && rep.ok) { const c = await caches.open(CACHE); c.put(req, rep.clone()); }
      return rep;
    } catch (err) {
      const c = await caches.open(CACHE);
      return (await c.match(req)) || (req.mode === 'navigate' ? await c.match('./index.html') || await c.match('./') : undefined) || Response.error();
    }
  })());
});
self.addEventListener('message', e => { if (e.data === 'version') e.source && e.source.postMessage({version: VERSION}); });

/* DEUKSIL — service worker (application installée sur l'écran d'accueil)
   - Fichiers versionnés (js/…?v=…, css/…?v=…, voir outils/versionner-site.js) : servis
     depuis la copie locale dès qu'elle existe. Une nouvelle version a une autre adresse :
     elle est téléchargée une fois, puis l'ancienne copie est effacée.
   - Tout le reste (index.html, images, manifeste) : « réseau d'abord » ; la copie locale
     ne sert que hors connexion. Les données (Supabase) ne passent jamais par ici.
   VERSION est mise à jour par outils/versionner-site.js à chaque publication. */
const VERSION = 'deuksil-sw-c8a7ae4e1c';
const CACHE = 'deuksil-fichiers';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
const versionne = url => url.searchParams.has('v') && /^\/(js|css)\//.test(url.pathname);
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (versionne(url)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), copie = await c.match(req);
      if (copie) return copie;
      const rep = await fetch(req);
      if (rep && rep.ok) {
        await c.put(req, rep.clone());
        // anciennes versions du même fichier : effacées
        for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) await c.delete(k); }
      }
      return rep;
    })());
    return;
  }
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

/* =========================================================================
   99-maj.js — Application installée : mises à jour automatiques
   1. Enregistre le service worker (sw.js) quand l'application est servie en
      https (ou localhost) et pas dans une fenêtre intégrée.
   2. Chaque fois que l'application revient au premier plan (au plus toutes
      les 2 minutes), elle compare les fichiers publiés (ETag / date / taille)
      à ceux du démarrage. Si un fichier a changé, elle se recharge : tout de
      suite si personne n'est en train de saisir, sinon un bandeau propose
      « Mettre à jour ». Les données de l'utilisateur restent en place.
   ========================================================================= */
(() => {
  const servi = /^https:$/.test(location.protocol) || ['localhost', '127.0.0.1'].includes(location.hostname);
  let integre = false; try { integre = window.top !== window; } catch (e) { integre = true; }
  if (!servi || integre || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});

  const fichiers = () => [location.pathname.replace(/[^/]*$/, '') + 'index.html',
    ...[...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map(e => e.getAttribute('src') || e.getAttribute('href'))
      .filter(u => u && !/^https?:/.test(u))];
  async function signature() {
    const r = await Promise.all(fichiers().map(u => fetch(u, {method: 'HEAD', cache: 'no-store'})
      .then(x => x.ok ? (x.headers.get('etag') || x.headers.get('last-modified') || x.headers.get('content-length') || '') : '').catch(() => null)));
    if (r.some(x => x === null)) return null;          // hors ligne : on ne conclut rien
    return r.join('|');
  }
  let depart = null, dernier = 0, proposee = false;
  const saisieEnCours = () => { const a = document.activeElement; return !!(a && (a.matches('input, textarea, select') || a.isContentEditable)) || !!document.querySelector('.modal'); };
  function recharger() { try { sessionStorage.setItem('deuksil_maj', '1'); } catch (e) {} location.reload(); }
  function proposer() {
    if (proposee) return; proposee = true;
    const b = document.createElement('div'); b.className = 'maj-bandeau';
    b.innerHTML = '<span>Une nouvelle version de DEUKSIL est disponible.</span><button type="button">Mettre à jour</button>';
    b.querySelector('button').onclick = recharger; document.body.appendChild(b);
  }
  async function verifier() {
    if (Date.now() - dernier < 120000) return; dernier = Date.now();
    const s = await signature(); if (!s) return;
    if (depart === null) { depart = s; return; }
    if (s !== depart) saisieEnCours() ? proposer() : recharger();
  }
  window.verifierMiseAJour = () => { dernier = 0; return verifier(); };
  window.addEventListener('load', () => setTimeout(() => { dernier = 0; verifier(); }, 3000));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier(); });
  setInterval(() => { if (document.visibilityState === 'visible') verifier(); }, 10 * 60000);
  try { if (sessionStorage.getItem('deuksil_maj')) { sessionStorage.removeItem('deuksil_maj'); setTimeout(() => typeof toast === 'function' && toast('DEUKSIL est à jour.'), 800); } } catch (e) {}
})();

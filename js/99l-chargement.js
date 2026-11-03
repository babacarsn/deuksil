/* =============================================================================
   99l-chargement.js — attente du catalogue progressif (js/03-storage.js).
   Un écran qui a besoin de toutes les annonces (recherche, carte, espaces…) n'est
   dessiné qu'une fois le catalogue complet : en attendant, la page affiche le même
   squelette qu'au démarrage, au lieu de rester sur l'écran précédent sans réaction.
   ============================================================================= */
(() => {
  if (typeof DB === 'undefined') return;
  const attendre = () => {
    if (!DB._pret || DB.pret || DB.catalogueComplet !== false) return;
    if (typeof bootSkeletonHtml === 'function') $('#app').innerHTML = `<div aria-busy="true" aria-label="Chargement des annonces">${bootSkeletonHtml()}</div>`;
  };
  window.addEventListener('hashchange', attendre);
  /* L'accueil reste juste avec les premières annonces, sauf un nombre : « N locaux
     disponibles » n'est affiché qu'une fois le catalogue complet. */
  if (typeof hxUne === 'function') {
    const _une = hxUne;
    hxUne = function (pubs) { return DB.catalogueComplet === false ? _une.call(this, []) : _une.apply(this, arguments); };
  }
})();

/* =============================================================================
   MODULE : 99c-bureau.js — tableaux de bord sur grand écran (≥ 901 px)
   Sur ordinateur, les blocs étaient alignés par rangées : la colonne la plus
   courte laissait un grand vide (sous le graphique, sous « Mon portefeuille »).
   Ici, les blocs sont répartis en deux colonnes indépendantes qui s'empilent,
   et le dernier bloc de chaque colonne s'étire pour finir à la même hauteur.
   Rien ne change sur mobile : le DOM n'est touché qu'au-delà de 900 px.
   ============================================================================= */
(() => {
  const ECRAN = window.matchMedia('(min-width: 901px)');

  function colonnes(pd) {
    const top = pd.querySelector(':scope > .pd-top'), bas = pd.querySelector(':scope > .pd-bottom');
    const a = [], b = [];
    if (top || bas) {
      if (top) {
        const [gauche, droite] = top.children;
        if (gauche) a.push(...(gauche.classList.contains('pd-left') ? gauche.children : [gauche]));
        if (droite) b.push(droite);
      }
      if (bas) {
        const [gauche, droite] = bas.children;
        if (gauche && gauche.children.length) a.push(gauche);
        if (droite) b.push(...(droite.classList.contains('pd-left') ? droite.children : [droite]));
      }
    } else {
      // Tableau de l'agent : la commission et les compteurs à gauche, le reste à droite.
      const enfants = [...pd.children];
      const rev = enfants.find(e => e.matches('.pd-rev')), duo = enfants.find(e => e.matches('.pd-duo'));
      if (!rev || !duo) return null;
      a.push(rev, duo);
      b.push(...enfants.filter(e => e !== rev && e !== duo && e.matches('.pd-todo, .pd-actions, .pd-card')));
    }
    return a.length && b.length ? [[...a], [...b], top || bas || a[0]] : null;
  }

  function disposer(pd) {
    if (pd.dataset.bureau || !ECRAN.matches) return;
    pd.dataset.bureau = '1';
    const r = colonnes(pd); if (!r) return;
    const [a, b, repere] = r;
    const cols = document.createElement('div'); cols.className = 'pd-cols';
    const ca = document.createElement('div'); ca.className = 'pd-col pd-col-a';
    const cb = document.createElement('div'); cb.className = 'pd-col pd-col-b';
    cols.append(ca, cb);
    pd.insertBefore(cols, repere);
    ca.append(...a); cb.append(...b);
    pd.querySelectorAll(':scope > .pd-top, :scope > .pd-bottom').forEach(e => e.remove());
  }

  const tout = () => document.querySelectorAll('.pd:not([data-bureau])').forEach(disposer);
  new MutationObserver(tout).observe(document.body, {childList: true, subtree: true});
  tout();
  // Passage d'un côté à l'autre de 900 px (fenêtre redimensionnée) : on reconstruit la page.
  ECRAN.addEventListener('change', () => { if (typeof render === 'function') render(); });
})();

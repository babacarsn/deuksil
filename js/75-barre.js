/* ==========================================================================
   MODULE : barre.js — « Gestion » dans la barre du bas.
   La quatrième place de la barre menait aux Loyers : un écran parmi vingt,
   promu au rang de raccourci permanent. Les autres — locataires, ventes,
   travaux, finances, papiers — n'avaient aucune porte depuis le téléphone,
   sinon le menu replié.
   La place revient au sommaire de la Gestion, qui les contient tous.
   ========================================================================== */

const BARRE_PRO = {
  owner: [
    ['#/owner/dashboard',    'Accueil',   'grid'],
    ['#/owner/properties',   'Mes biens', 'home'],
    ['#/owner/property/new', 'Publier',   'plus', 'fab'],
    ['#/manage',             'Gestion',   'briefcase'],
    ['#/owner/messages',     'Messages',  'message']
  ],
  agency: [
    ['#/agency/dashboard',   'Accueil',   'grid'],
    ['#/agency/properties',  'Biens',     'home'],
    ['#/owner/property/new', 'Publier',   'plus', 'fab'],
    ['#/manage',             'Gestion',   'briefcase'],
    ['#/agency/messages',    'Messages',  'message']
  ]
};

const _tabBarPro = tabBarHtml;
tabBarHtml = function (u, path) {
  const cfg = u && BARRE_PRO[u.role];
  /* Un membre d'équipe n'a pas forcément accès à toute la Gestion, et un
     propriétaire sous mandat a une barre volontairement courte : pour eux,
     rien ne change. */
  if (!cfg || (u.member) || (typeof estMandant === 'function' && estMandant(u))) {
    return _tabBarPro(u, path);
  }
  const actif = h => path === h.slice(1) || (h !== '#/' && path.startsWith(h.slice(1) + '/'));
  return `<nav class="tabbar" aria-label="Navigation principale">${cfg.map(([h, l, ic, fab]) =>
    fab ? `<a class="tab-fab" href="${h}"><i>${icon(ic, 22)}</i><span>${esc(l)}</span></a>`
        : `<a href="${h}" class="tab-item ${actif(h) ? 'active' : ''}">${icon(ic, 21)}<span>${esc(l)}</span></a>`
  ).join('')}</nav>`;
};

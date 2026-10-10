/* ==========================================================================
   MODULE : roles.js — quatre types de compte, pas davantage.
   Client · Propriétaire · Agence · Administration.
   Les agents d'une agence et les gestionnaires d'un propriétaire ne sont
   pas des types de compte : ce sont des membres créés depuis l'espace de
   leur structure, qui se connectent avec des droits limités aux tâches
   qu'on leur confie.
   Un client qui signe un bail reste un client : son espace s'enrichit de
   son logement, de ses loyers, de ses quittances et du signalement de
   pannes. Le bail porté par son compte sert de marqueur interne ; pour
   l'utilisateur, il n'y a qu'un seul type « Client ».
   Les espaces investisseur et promoteur sont retirés.
   ========================================================================== */

/* --- 1. Retrait des espaces investisseur et promoteur ------------------- */
const ROLES_RETIRES = ['investor', 'promoter'];

(function retirerRoles() {
  /* les écrans */
  for (let i = routes.length - 1; i >= 0; i--) {
    if (/\\\/(invest|promo)\\\//.test(routes[i].re.source)) routes.splice(i, 1);
  }
  /* les menus */
  ROLES_RETIRES.forEach(r => { delete MENUS_RAW[r]; });
  /* les comptes de démonstration */
  try {
    DB.filterItems(DB.K.users, u => ROLES_RETIRES.includes(u.role))
      .forEach(u => DB.deleteItem(DB.K.users, u.id));
  } catch (e) {}
})();

/* Le jeu de démonstration les recrée à chaque amorçage : on nettoie après. */
etapeAmorcage('retrait des rôles supprimés', () => {
  DB.filterItems(DB.K.users, u => ROLES_RETIRES.includes(u.role))
    .forEach(u => DB.deleteItem(DB.K.users, u.id));
}, true);

/* --- 2. Un client qui loue reste un client ------------------------------ */
/* Le compte porteur d'un bail passe toutes les portes de l'espace client :
   il cherche, met en favori, demande des visites, écrit aux propriétaires. */
const _guardR = Auth.guard;
Auth.guard = function (role) {
  const u = this.current();
  if (role === 'client' && u && u.role === 'tenant') return u;
  return _guardR.call(this, role);
};

/* Son accueil est celui d'un client ; son logement vit dans son menu. */
const _homeR = Auth.home;
Auth.home = function (u) {
  if (u && u.role === 'tenant') return '#/client/dashboard';
  return _homeR.call(this, u);
};

/* Menu : celui du client, complété de ce qui touche à son bail. */
(function menuLocataire() {
  const base = MENUS_RAW.client || [];
  const bail = [
    ['#/tenant/home', 'Mon logement', 'home'],
    ['#/tenant/rents', 'Mon loyer', 'money'],
    ['#/tenant/quittances', 'Mes quittances', 'checkCircle'],
    ['#/tenant/tickets', 'Maintenance', 'settings']
  ];
  const deja = new Set(bail.map(e => e[0]));
  MENUS_RAW.tenant = [base[0], ...bail, ...base.slice(1).filter(e => !deja.has(e[0]))].filter(Boolean);
})();

/* --- 3. Comptes de démonstration : quatre portes d'entrée --------------- */
if (typeof DEMO_ACCOUNTS !== 'undefined') {
  DEMO_ACCOUNTS.length = 0;
  DEMO_ACCOUNTS.push(
    ['Client avec un bail en cours', '1900000000002', 'demo123'],
    ['Client qui cherche un bien', '1900000000006', 'demo123'],
    ['Propriétaire', '1900000000003', 'demo123'],
    ['Agence', '1900000000004', 'demo123'],
    ['Agent d\'agence', '1900000000012', 'demo123'],
    ['Administration', '1900000000001', 'admin123']);
}

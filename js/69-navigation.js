/* ==========================================================================
   MODULE : navigation.js — un écran, un nom, un chemin.
   L'espace propriétaire comptait 31 portes pour huit métiers : 11 entrées de
   menu et 20 onglets de Gestion. Cinq écrans y figuraient deux fois sous des
   noms différents — « Locataires » menait aux fiches, « Fiches locataires »
   au même endroit, « Locataires & baux » ailleurs. Et trois écrans d'agence
   (mandants, mandats, reversements), vides chez un propriétaire, occupaient
   la liste.
   Rien n'est retiré : tout reste atteignable. On réorganise seulement, et on
   cesse de nommer deux fois la même chose.
   ========================================================================== */

/* --- 1. Le menu suit les métiers du propriétaire ------------------------ */
const MENU_PRO = [
  ['#/owner/dashboard',  'Tableau de bord', 'grid'],
  ['#/owner/properties', 'Mes biens',       'home'],
  ['#/manage/leases',    'Locataires',      'users'],
  ['#/manage/rents',     'Loyers',          'money'],
  ['#/manage/deals',     'Ventes',          'trendUp'],
  ['#/manage/tickets',   'Travaux',         'settings'],
  ['#/manage/finance',   'Finances',        'chart'],
  ['#/coffre',           'Documents',       'file'],
  ['#/owner/messages',   'Messages',        'message'],
  ['#/owner/profile',    'Paramètres',      'user']
];

/* mandant.js a déjà posé un accesseur sur MENUS_RAW.owner : on le garde
   pour les propriétaires sous mandat, dont le menu est volontairement court. */
(function menuProprietaire() {
  const prec = Object.getOwnPropertyDescriptor(MENUS_RAW, 'owner');
  const avant = () => prec.get ? prec.get.call(MENUS_RAW) : prec.value;
  Object.defineProperty(MENUS_RAW, 'owner', {
    configurable: true,
    get() {
      const u = Auth.current();
      if (typeof estMandant === 'function' && estMandant(u)) return avant();
      if (u && u.member) return avant();   /* un membre d'équipe a ses droits */
      return MENU_PRO;
    }
  });
})();

/* --- 2. Les sections, rangées par métier -------------------------------- */
/* Les écrans d'agence — mandants, mandats, reversements — n'ont rien à faire
   chez un propriétaire : ils sont vides et ne se rempliront jamais. */
const GROUPES_PRO = [
  ['Locataires', 'Baux, fiches, unités et échanges',
   ['leases', 'tenants', 'units', 'tmsgs']],
  ['Loyers et ventes', 'Encaissements, quittances et dossiers de vente',
   ['rents', 'deals']],
  ['Travaux', 'Interventions et artisans',
   ['tickets', 'providers']],
  ['Finances', 'Facturation, dépenses et pilotage',
   ['finance', 'docs', 'fpay', 'expenses', 'reports']],
  ['Papiers', 'Contrats et pièces officielles',
   ['contracts']],
  ['Mon compte', 'Identité sur les documents, équipe et traçabilité',
   ['identity', 'team', 'audit']]
];

const AGENCE_SEULE = ['owners', 'mandates', 'transfers'];
const groupesDe = u => u && u.role === 'owner' ? GROUPES_PRO : GGROUPS;

/* L'accueil de la Gestion montre les mêmes groupes. */
const _manageHubNav = manageHub;
manageHub = function (u) {
  if (!u || u.role !== 'owner') return _manageHubNav(u);
  const garde = GGROUPS.slice();
  GGROUPS.splice(0, GGROUPS.length, ...GROUPES_PRO);
  try { return _manageHubNav(u); } finally { GGROUPS.splice(0, GGROUPS.length, ...garde); }
};

/* --- 3. Le sélecteur de section : vingt options à plat, c'est illisible -- */
function rangerSelecteur() {
  const s = document.querySelector('.main > .content [data-action="g-goto"]');
  if (!s || s.dataset.nav) return;
  const u = Auth.current();
  if (!u) return;
  s.dataset.nav = '1';
  const dispo = new Set([...s.options].map(o => o.value));
  const courant = s.value;
  const groupes = groupesDe(u);
  const vus = new Set();
  let html = '';
  groupes.forEach(([titre, , cles]) => {
    const ks = cles.filter(k => dispo.has(k) && !(u.role === 'owner' && AGENCE_SEULE.includes(k)));
    if (!ks.length) return;
    ks.forEach(k => vus.add(k));
    html += `<optgroup label="${esc(titre)}">${ks.map(k =>
      `<option value="${k}"${k === courant ? ' selected' : ''}>${esc(gLabel(k))}</option>`).join('')}</optgroup>`;
  });
  /* Ce qu'aucun groupe ne réclame reste accessible : on ne perd rien. */
  const restes = [...dispo].filter(k => !vus.has(k)
    && !(u.role === 'owner' && AGENCE_SEULE.includes(k)));
  if (restes.length) {
    html += `<optgroup label="Autres">${restes.map(k =>
      `<option value="${k}"${k === courant ? ' selected' : ''}>${esc(gLabel(k))}</option>`).join('')}</optgroup>`;
  }
  if (html) s.innerHTML = html;
  s.value = courant;
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { rangerSelecteur(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

/* --- 4. Un seul mot par chose ------------------------------------------- */
/* Le menu disait « Travaux », la section « Maintenance » et le fil d'Ariane
   aussi : trois écrans pour un même objet, deux mots. On garde le mot le
   plus clair pour un propriétaire. */
(function unMotParChose() {
  const t = GTABS.find(x => x[0] === 'tickets');
  if (t) t[1] = 'Travaux';
})();

/* ==========================================================================
   MODULE : baux.js — une personne peut louer plusieurs logements.
   Le compte locataire ne portait qu'un seul `leaseId`. Conséquences : dès
   qu'un client signait un bail, il disparaissait de la liste des personnes
   à qui louer ; lui donner un second appartement créait un doublon ; et son
   espace ne montrait qu'un seul logement.
   On introduit `leaseIds` : la liste de ses baux. `leaseId` reste renseigné
   — il désigne le bail couramment consulté — pour que tout le reste de
   l'application continue de fonctionner sans être réécrit.
   ========================================================================== */

const CLE_BAIL_ACTIF = 'deuksil_bail_actif';

/* Tous les baux d'une personne, le plus récent d'abord. */
function bauxDe(u) {
  if (!u) return [];
  const ids = Array.isArray(u.leaseIds) ? u.leaseIds.slice() : [];
  if (u.leaseId && !ids.includes(u.leaseId)) ids.unshift(u.leaseId);
  const vus = new Set();
  return ids.filter(i => !vus.has(i) && vus.add(i))
    .map(i => DB.findItem(DB.K.leases, i))
    .filter(Boolean)
    .sort((a, b) => (a.status === 'actif' ? 0 : 1) - (b.status === 'actif' ? 0 : 1)
      || (a.start < b.start ? 1 : -1));
}

/* Celui que la personne consulte : son choix, sinon son bail actif. */
function bailCourant(u) {
  const tous = bauxDe(u);
  if (!tous.length) return null;
  const actifs = tous.filter(b => b.status === 'actif');
  const pool = actifs.length ? actifs : tous;
  let choix = null;
  try { choix = localStorage.getItem(CLE_BAIL_ACTIF); } catch (e) {}
  return pool.find(b => b.id === choix) || pool[0];
}

/* Ajoute un bail au compte sans effacer les précédents. */
function rattacherBail(compte, bail) {
  if (!compte || !bail) return null;
  const ids = Array.isArray(compte.leaseIds) ? compte.leaseIds.slice() : [];
  if (compte.leaseId && !ids.includes(compte.leaseId)) ids.push(compte.leaseId);
  if (!ids.includes(bail.id)) ids.push(bail.id);
  DB.updateItem(DB.K.users, compte.id, {
    leaseIds: ids, leaseId: bail.id, ownerRef: bail.ownerId, role: 'tenant'
  });
  return {...compte, leaseIds: ids, leaseId: bail.id, role: 'tenant'};
}

/* Détache un bail : la personne redevient un simple client si c'était le
   dernier. On ne supprime jamais son compte, elle garde son historique. */
function detacherBail(compte, bailId) {
  if (!compte) return;
  const ids = (Array.isArray(compte.leaseIds) ? compte.leaseIds : [compte.leaseId])
    .filter(i => i && i !== bailId);
  DB.updateItem(DB.K.users, compte.id, {
    leaseIds: ids, leaseId: ids[0] || '', role: ids.length ? 'tenant' : 'client'
  });
}

/* Le compte qui porte ce bail, quel que soit le nombre de ses baux. */
function locataireDuBail(bail) {
  const id = bail && bail.id ? bail.id : bail;
  if (!id) return null;
  return DB.findItem(DB.K.users, u =>
    u.leaseId === id || (Array.isArray(u.leaseIds) && u.leaseIds.includes(id)));
}

/* Les baux actifs d'une personne chez un propriétaire donné. */
const bauxActifs = u => bauxDe(u).filter(b => b.status === 'actif');

/* Résumé lisible : « 2 logements · Almadies, Ouakam ». */
function resumeBaux(u) {
  const a = bauxActifs(u);
  if (!a.length) return '';
  const noms = a.map(b => (gProp(b.propertyId) || {}).title || 'un logement');
  return a.length === 1 ? 'loue déjà ' + noms[0]
    : `loue déjà ${a.length} logements · ${noms.join(', ')}`;
}

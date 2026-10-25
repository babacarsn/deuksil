/* ==========================================================================
   MODULE : donnees.js — fonctions communes d'écriture (notifications,
   journal d'activité, suppressions, contrôles de propriété).
   Les données elles-mêmes viennent de Supabase (js/03-storage.js) : ce
   module ne contient aucun jeu de démonstration.
   ========================================================================== */
function payRef(dayOffset = 0) {
  const d = new Date(Date.now() + dayOffset * 86400000);
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `DZL-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function notify(userId, text, link) { DB.addItem(DB.K.notifications, {userId, text, read: false, link: link || ''}); }
function roleLink(userId, path) { const u = DB.findItem(DB.K.users, userId); return `#/${u ? u.role : 'client'}/${path}`; }
function logActivity(text) { DB.addItem(DB.K.activity, {text}); }

/* Suppressions : la base applique les cascades (clés étrangères ON DELETE),
   le navigateur n'efface plus les données liées une par une (il ne les voit
   pas toutes, et chaque effacement serait une requête). */
function cascadeDeleteProperty(propertyId) {
  /* Un bien qui a porté un bail garde son historique (loyers, quittances) :
     la base refuse sa suppression ; on propose l'archivage. */
  if (DB.findItem(DB.K.leases, l => l.propertyId === propertyId)) {
    toast('Ce bien a un historique de baux et de loyers : archivez-le plutôt que de le supprimer.', 'bad');
    return false;
  }
  DB.deleteItem(DB.K.properties, propertyId);   // favoris, visites, unités : supprimés par la base
  return true;
}
/* Supprime un compte et tout ce qui lui appartient (fonction serveur
   « gerer-acces », seule à disposer des droits sur l'authentification). */
function cascadeDeleteUser(userId) {
  DB.deleteItem(DB.K.users, userId);
  return true;
}
/* Contrôles de propriété : messages clairs dans l'interface. La règle elle-même est imposée par la base (RLS). */
function ownsProperty(propertyId, u) {
  const p = DB.findItem(DB.K.properties, propertyId);
  if (!p) { toast('Ce bien est introuvable.', 'bad'); return null; }
  if (p.ownerId !== u.id) { toast('Ce bien ne vous appartient pas.', 'bad'); return null; }
  return p;
}

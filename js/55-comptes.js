/* ==========================================================================
   MODULE : comptes.js — un locataire inscrit sur un bail reçoit un compte.
   Jusqu'ici, créer un bail ne créait qu'un nom sur une ligne : la personne
   ne pouvait pas se connecter, ne voyait pas ses loyers, ne recevait pas
   ses quittances et ne pouvait rien signaler. Seul le locataire de
   démonstration pré-enregistré bouclait le cycle. On crée désormais le
   compte avec le bail, et on remet ses identifiants au propriétaire.
   ========================================================================== */
const sansAccent = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

function emailLibre(base) {
  let mail = base + '@gmail.com', n = 2;
  while (DB.findItem(DB.K.users, u => (u.email || '').toLowerCase() === mail)) {
    mail = base + n + '@gmail.com'; n++;
  }
  return mail;
}

/* Crée le compte locataire d'un bail, s'il n'existe pas déjà. */
function compteDuBail(bail) {
  if (!bail || !bail.tenant || !bail.id) return null;
  if (locataireDuBail(bail)) return null;
  const mots = String(bail.tenant).trim().split(/\s+/);
  const prenom = mots.shift() || 'Locataire';
  const nom = mots.join(' ');
  const base = sansAccent(prenom) + '.' + (sansAccent(nom) || 'locataire');
  const mail = emailLibre(base);
  const u = DB.addItem(DB.K.users, {
    password: 'demo123', status: 'actif', registrationPaid: true,
    firstName: prenom, lastName: nom, phone: bail.phone || '',
    role: 'tenant', leaseId: bail.id, leaseIds: [bail.id], ownerRef: bail.ownerId,
    email: mail, cni: '', agencyName: '', address: '', agencyDesc: ''
  });
  return DB.lastWriteOk === false ? null : u;
}

/* Réconciliation : tout bail actif a son compte. Plus robuste que de se
   greffer sur chaque endroit qui crée un bail. */
let _comptesEnCours = false;
function assurerComptes() {
  if (_comptesEnCours) return;
  const moi = Auth.current();
  if (!moi || !['owner', 'agency'].includes(moi.role)) return;
  _comptesEnCours = true;
  try {
    const baux = DB.filterItems(DB.K.leases, l => l.ownerId === moi.id && l.status === 'actif');
    baux.forEach(bail => {
      const u = compteDuBail(bail);
      if (!u) return;
      /* Un second logement ne vaut pas un second compte : on le signale
         autrement, sinon le propriétaire croit avoir créé un doublon. */
      if (u.__existant) {
        notify(moi.id, `${u.firstName} ${u.lastName} loue désormais un logement de plus.`, '#/manage/tenants');
        toast(`${u.firstName} retrouve ce logement dans son espace, avec les précédents.`);
        return;
      }
      notify(moi.id, `Accès locataire créé pour ${u.firstName} ${u.lastName} : ${u.email}`, '#/manage/tenants');
      toast(`${u.firstName} peut maintenant se connecter avec ${u.email} (mot de passe : demo123).`);
    });
  } catch (e) { /* une donnée incomplète ne doit pas bloquer l'écran */ }
  _comptesEnCours = false;
}

const _renderC = render;
render = function () {
  const r = _renderC.apply(this, arguments);
  setTimeout(assurerComptes, 60);
  return r;
};
setTimeout(assurerComptes, 1500);

/* --- Les identifiants sont rappelés sur la fiche du locataire ----------- */
function accesLocataire(bail) {
  const u = locataireDuBail(bail);
  if (!u) return '';
  const autres = bauxActifs(u).filter(b => b.id !== bail.id);
  return `<div class="acces-loc">
    <span class="acces-ic">${icon('user', 16)}</span>
    <div style="min-width:0">
      <b class="small">Accès de ${esc(u.firstName)} à son espace</b>
      <div class="small muted">${esc(u.email)} · mot de passe : demo123</div>
      ${autres.length ? `<div class="small muted">Loue aussi ${autres.map(b =>
        esc((gProp(b.propertyId) || {}).title || 'un autre logement')).join(', ')}.</div>` : ''}
    </div>
  </div>`;
}

retoucheGestion(['tenants'], function (h, u) {
  if (typeof h !== 'string' || !h) return h;
  try {
    const baux = DB.filterItems(DB.K.leases, l => l.ownerId === u.id && l.status === 'actif');
    if (!baux.length) return h;
    /* Une personne, un bloc : celle qui loue deux logements n'a pas deux
       accès, elle a un compte qui en porte deux. */
    const vus = new Set();
    const blocs = baux.map(b => {
      const loc = locataireDuBail(b);
      if (!loc || vus.has(loc.id)) return '';
      vus.add(loc.id);
      return accesLocataire(b);
    }).filter(Boolean).join('');
    if (!blocs) return h;
    return h + `<div class="card" style="margin-top:16px"><h4 style="margin-top:0">Accès des locataires</h4>
      <p class="small muted">Communiquez ces identifiants à vos locataires : ils y consultent leurs loyers, leurs quittances et y signalent les pannes.</p>
      <div class="stack" style="gap:10px;margin-top:12px">${blocs}</div></div>`;
  } catch (e) { return h; }
});

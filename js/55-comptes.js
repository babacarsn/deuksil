/* ==========================================================================
   MODULE : comptes.js — accès du locataire à son espace.
   Le bailleur (ou l'agence) ouvre l'accès explicitement, avec l'adresse
   e-mail RÉELLE du locataire :
   * si cette personne a déjà un compte DEUKSIL et vous a contacté, le bail
     est rattaché à son compte (fonction serveur rattacher_locataire) ;
   * sinon, le compte est créé par la fonction serveur « gerer-acces », qui
     génère un mot de passe provisoire affiché une seule fois.
   Aucun compte n'est créé automatiquement et aucune adresse n'est inventée.
   ========================================================================== */
const EMAIL_VALIDE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

/* Message d'accueil du locataire, une fois son accès ouvert. */
function accueillirLocataire(u, bail) {
  try {
    const bien = (gProp(bail.propertyId) || {}).title || 'votre logement';
    notify(u.id, `Bienvenue : votre espace locataire pour « ${bien} » est ouvert.`, '#/tenant/home');
    if (!DB.findItem(DB.K.tmsgs, m => m.leaseId === bail.id)) {
      DB.addItem(DB.K.tmsgs, {leaseId: bail.id, from: 'owner', read: false,
        text: `Bienvenue ${u.firstName || ''}. Vous trouverez ici vos loyers et vos quittances, et vous pouvez me signaler tout problème dans le logement.`.replace('  ', ' ')});
    }
  } catch (e) {}
}

/* Ouvre l'accès du locataire d'un bail. Renvoie true si c'est fait. */
async function ouvrirAccesLocataire(bail, email, compteId) {
  const moi = Auth.current();
  if (!moi || moi.member || !bail || bail.ownerId !== moi.id) { toast('Seul le titulaire du compte ouvre un accès locataire.', 'bad'); return false; }
  email = String(email || '').trim().toLowerCase();
  if (!compteId && !EMAIL_VALIDE.test(email)) { toast('Indiquez l\'adresse e-mail réelle du locataire.', 'bad'); return false; }
  await DB.attendre();   // le bail doit être enregistré avant d'y rattacher un compte
  const {data: etat, error} = await SB.rpc('rattacher_locataire', {bail: bail.id, compte: compteId || null, courriel: compteId ? null : email});
  if (error) { toast(error.message || 'Rattachement impossible.', 'bad'); return false; }
  if (etat === 'rattache') {
    await DB.relire(DB.K.users);
    const u = locataireDuBail(bail);
    audit('Accès locataire', `${bail.tenant} · compte existant`);
    if (u) accueillirLocataire(u, bail);
    toast(`${bail.tenant} retrouve ce logement dans son espace DEUKSIL.`); render(); return true;
  }
  // Aucun compte avec cette adresse : création par la fonction serveur.
  const mots = String(bail.tenant || '').trim().split(/\s+/), prenom = mots.shift() || '', nom = mots.join(' ');
  const u = DB.addItem(DB.K.users, {role: 'tenant', email, firstName: prenom, lastName: nom, phone: bail.phone || '',
    leaseId: bail.id, leaseIds: [bail.id], ownerRef: bail.ownerId, status: 'actif', mdpProvisoire: true});
  await DB.attendre();
  if (!DB.findItem(DB.K.users, u.id)) return false;   // refus du serveur : message déjà affiché
  audit('Accès locataire créé', `${bail.tenant} · ${email}`);
  accueillirLocataire(u, bail); render(); return true;
}

/* --- Bloc « Accès à son espace » sur la fiche du locataire --------------- */
function accesLocataire(bail) {
  const u = locataireDuBail(bail);
  if (!u) {
    return `<form class="acces-loc" data-action="acces-loc" data-id="${bail.id}">
      <span class="acces-ic">${icon('user', 16)}</span>
      <div style="min-width:0;flex:1">
        <b class="small">${esc(bail.tenant)} n'a pas encore accès à son espace</b>
        <div class="row" style="gap:8px;margin-top:6px;flex-wrap:wrap">
          <input class="input" type="email" name="email" required placeholder="Adresse e-mail du locataire" autocomplete="off" style="flex:1;min-width:200px">
          <button class="btn sm">Ouvrir son accès</button>
        </div>
        <div class="small muted" style="margin-top:4px">S'il a déjà un compte DEUKSIL, le bail y est ajouté ; sinon un mot de passe provisoire vous est affiché une seule fois.</div>
      </div>
    </form>`;
  }
  const autres = bauxActifs(u).filter(b => b.id !== bail.id);
  return `<div class="acces-loc">
    <span class="acces-ic">${icon('user', 16)}</span>
    <div style="min-width:0">
      <b class="small">Accès de ${esc(u.firstName)} à son espace</b>
      <div class="small muted">${esc(u.email || '')} · ${u.mdpProvisoire ? 'mot de passe provisoire, à changer à la 1re connexion' : 'mot de passe personnel'}</div>
      ${autres.length ? `<div class="small muted">Loue aussi ${autres.map(b =>
        esc((gProp(b.propertyId) || {}).title || 'un autre logement')).join(', ')}.</div>` : ''}
    </div>
  </div>`;
}
document.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="acces-loc"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const bail = DB.findItem(DB.K.leases, f.dataset.id), b = f.querySelector('button');
  b.disabled = true;
  try { await ouvrirAccesLocataire(bail, f.email.value); } finally { b.disabled = false; }
}, true);

retoucheGestion(['tenants'], function (h, u) {
  if (typeof h !== 'string' || !h || u.member) return h;
  try {
    const baux = DB.filterItems(DB.K.leases, l => l.ownerId === u.id && l.status === 'actif');
    if (!baux.length) return h;
    /* Une personne, un bloc : celle qui loue deux logements n'a pas deux
       accès, elle a un compte qui en porte deux. */
    const vus = new Set();
    const blocs = baux.map(b => {
      const loc = locataireDuBail(b);
      if (loc && vus.has(loc.id)) return '';
      if (loc) vus.add(loc.id);
      return accesLocataire(b);
    }).filter(Boolean).join('');
    if (!blocs) return h;
    return h + `<div class="card" style="margin-top:16px"><h4 style="margin-top:0">Accès des locataires</h4>
      <p class="small muted">Avec son accès, le locataire consulte ses loyers et ses quittances et signale les pannes.</p>
      <div class="stack" style="gap:10px;margin-top:12px">${blocs}</div></div>`;
  } catch (e) { return h; }
});

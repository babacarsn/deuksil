/* ==========================================================================
   MODULE : bail-client.js — le client qui loue devient le locataire.
   Le champ « Locataire » du bail était une saisie libre : le propriétaire
   retapait un nom sans aucun lien avec les clients qui l'avaient contacté.
   Résultat, la personne qui avait visité le bien se retrouvait en double,
   avec un second compte, et la relation propriétaire-client se rompait au
   moment décisif. Le bail se rattache désormais au compte existant.
   ========================================================================== */

/* Deux numéros désignent la même personne si leurs neuf derniers chiffres
   coïncident (+221 77 000 00 02 et 770000002). */
const telCle = t => String(t || '').replace(/\D/g, '').slice(-9);
const nomCle = u => (`${u.firstName || ''} ${u.lastName || ''}`).trim().toLowerCase();

/* Les clients que ce propriétaire connaît déjà : ceux qui ont demandé une
   visite de ses biens ou qui lui ont écrit, et qui ne louent pas encore. */
function clientsDuProprietaire(u) {
  const vus = new Set();
  try {
    DB.getData(DB.K.visits).filter(v => v.ownerId === u.id).forEach(v => vus.add(v.clientId));
    DB.getData(DB.K.messages).filter(m => Array.isArray(m.participants) && m.participants.includes(u.id))
      .forEach(m => m.participants.forEach(x => { if (x !== u.id) vus.add(x); }));
  } catch (e) {}
  return [...vus].map(i => DB.findItem(DB.K.users, i))
    .filter(c => c && ['client', 'tenant'].includes(c.role) && !c.leaseId);
}

/* Retrouve le compte d'une personne nommée sur un bail. */
function compteExistantPour(bail) {
  const tel = telCle(bail.phone), nom = String(bail.tenant || '').trim().toLowerCase();
  const candidats = DB.filterItems(DB.K.users, u => ['client', 'tenant'].includes(u.role) && !u.leaseId);
  return candidats.find(u => tel && telCle(u.phone) === tel)
      || candidats.find(u => nom && nomKey(u) === nom);
}
const nomKey = nomCle;

/* --- 1. Le formulaire propose les clients connus ------------------------ */
function enrichirFormulaireBail() {
  const f = document.querySelector('.main form[data-action="g-lease"]');
  if (!f || f.dataset.bc) return;
  const champ = f.querySelector('[name="tenant"]');
  if (!champ) return;
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  f.dataset.bc = '1';

  const liste = clientsDuProprietaire(u);
  const bloc = document.createElement('div');
  bloc.className = 'field';
  bloc.innerHTML = `<label>Qui est le locataire ?</label>
    <select class="input" data-action="bc-choisir">
      <option value="">— Une personne sans compte —</option>
      ${liste.map(c => `<option value="${c.id}">${esc(c.firstName + ' ' + c.lastName)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}
    </select>
    <div class="small muted" style="margin-top:5px">${liste.length
      ? 'Choisissez le client qui a visité ou vous a contacté : son compte deviendra celui du locataire, sans doublon.'
      : 'Aucun client ne vous a encore contacté. Saisissez son nom ci-dessous : un accès lui sera créé.'}</div>`;
  champ.closest('.field').before(bloc);
}

document.addEventListener('change', e => {
  const sel = e.target.closest('[data-action="bc-choisir"]');
  if (!sel) return;
  const f = sel.closest('form');
  const nom = f.querySelector('[name="tenant"]'), tel = f.querySelector('[name="phone"]');
  const c = sel.value ? DB.findItem(DB.K.users, sel.value) : null;
  if (c) {
    nom.value = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    if (tel && c.phone) tel.value = c.phone;
    nom.readOnly = true; if (tel) tel.readOnly = true;
  } else {
    nom.readOnly = false; if (tel) tel.readOnly = false;
    nom.value = ''; if (tel) tel.value = '';
  }
});

new MutationObserver(() => requestAnimationFrame(() => {
  try { enrichirFormulaireBail(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

/* --- 2. Le bail se rattache au compte existant -------------------------- */
/* On remplace la création systématique d'un compte : si la personne en a
   déjà un, c'est le sien qui porte le bail. */
compteDuBail = function (bail) {
  if (!bail || !bail.tenant || !bail.id) return null;
  if (DB.findItem(DB.K.users, u => u.leaseId === bail.id)) return null;

  const deja = compteExistantPour(bail);
  if (deja) {
    DB.updateItem(DB.K.users, deja.id, {leaseId: bail.id, ownerRef: bail.ownerId, role: 'tenant'});
    return {...deja, leaseId: bail.id, __existant: true};
  }

  const mots = String(bail.tenant).trim().split(/\s+/);
  const prenom = mots.shift() || 'Locataire';
  const nom = mots.join(' ');
  const base = sansAccent(prenom) + '.' + (sansAccent(nom) || 'locataire');
  const u = DB.addItem(DB.K.users, {
    password: 'demo123', status: 'actif', registrationPaid: true,
    firstName: prenom, lastName: nom, phone: bail.phone || '',
    role: 'tenant', leaseId: bail.id, ownerRef: bail.ownerId,
    email: emailLibre(base), cni: '', agencyName: '', address: '', agencyDesc: ''
  });
  return DB.lastWriteOk === false ? null : u;
};

/* --- 3. Le jeu de démonstration ne garde qu'une seule Fatou ------------- */
function fusionnerDoublons() {
  const porteurs = DB.filterItems(DB.K.users, u => u.leaseId);
  porteurs.forEach(loc => {
    const jumeau = DB.findItem(DB.K.users, u => u.id !== loc.id && !u.leaseId
      && ['client', 'tenant'].includes(u.role)
      && (nomCle(u) === nomCle(loc) || (telCle(u.phone) && telCle(u.phone) === telCle(loc.phone))));
    if (!jumeau) return;
    /* Le compte conservé est celui qui a une vie : visites, favoris, messages. */
    const vie = i => {
      try {
        return DB.getData(DB.K.visits).filter(v => v.clientId === i).length
          + DB.getData(DB.K.messages).filter(m => Array.isArray(m.participants) && m.participants.includes(i)).length
          + DB.getData(DB.K.favorites).filter(x => x.clientId === i).length;
      } catch (e) { return 0; }
    };
    const garde = vie(jumeau.id) >= vie(loc.id) ? jumeau : loc;
    const jette = garde === jumeau ? loc : jumeau;
    DB.updateItem(DB.K.users, garde.id, {leaseId: loc.leaseId, ownerRef: loc.ownerRef, role: 'tenant'});
    DB.deleteItem(DB.K.users, jette.id);
  });
}
const _seedBC = seedIfNeeded;
seedIfNeeded = function (f) { _seedBC(f); try { fusionnerDoublons(); } catch (e) {} };
setTimeout(() => { try { fusionnerDoublons(); } catch (e) {} }, 1700);

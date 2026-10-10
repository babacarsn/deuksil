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

/* Les personnes que ce propriétaire connaît déjà : celles qui ont demandé
   une visite de ses biens, qui lui ont écrit, ou qui louent déjà chez lui.
   Une personne qui loue n'est pas retirée de la liste : rien n'empêche un
   locataire de prendre un second logement, et c'est même le cas courant
   d'une famille ou d'un commerçant. */
function clientsDuProprietaire(u) {
  const vus = new Set();
  const miens = new Set(myProps(u).map(p => p.id));
  try {
    /* a) qui a demandé une visite d'un de mes biens */
    DB.getData(DB.K.visits)
      .filter(v => v.ownerId === u.id || miens.has(v.propertyId))
      .forEach(v => vus.add(v.clientId));
    /* b) qui m'a écrit */
    DB.getData(DB.K.messages).filter(m => Array.isArray(m.participants) && m.participants.includes(u.id))
      .forEach(m => m.participants.forEach(x => { if (x !== u.id) vus.add(x); }));
    /* c) qui a mis un de mes biens en favori — un signe d'intérêt réel */
    DB.getData(DB.K.favorites).filter(f => miens.has(f.propertyId))
      .forEach(f => vus.add(f.clientId));
    /* d) mes locataires actuels */
    DB.filterItems(DB.K.users, x => x.ownerRef === u.id && x.role === 'tenant')
      .forEach(x => vus.add(x.id));
  } catch (e) {}
  return [...vus].map(i => DB.findItem(DB.K.users, i))
    .filter(c => c && ['client', 'tenant'].includes(c.role))
    .sort((a, b) => nomCle(a) < nomCle(b) ? -1 : 1);
}

/* Retrouve le compte d'une personne nommée sur un bail — qu'elle loue déjà
   ou non. C'est ce qui évite le second compte au deuxième appartement. */
function compteExistantPour(bail) {
  const tel = telCle(bail.phone), nom = String(bail.tenant || '').trim().toLowerCase();
  const candidats = DB.filterItems(DB.K.users, u => ['client', 'tenant'].includes(u.role));
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
  const libres = liste.filter(c => !bauxActifs(c).length);
  const loc = liste.filter(c => bauxActifs(c).length);
  const opt = c => {
    const n = bauxActifs(c).length;
    return `<option value="${c.id}">${esc(c.firstName + ' ' + c.lastName)}`
      + `${c.phone ? ' · ' + esc(c.phone) : ''}`
      + `${n ? ` · ${n} logement${n > 1 ? 's' : ''} en cours` : ''}</option>`;
  };
  const bloc = document.createElement('div');
  bloc.className = 'field';
  bloc.innerHTML = `<label>Qui est le locataire ?</label>
    <select class="input" data-action="bc-choisir">
      <option value="">— Une personne sans compte —</option>
      ${libres.length ? `<optgroup label="Clients sans logement">${libres.map(opt).join('')}</optgroup>` : ''}
      ${loc.length ? `<optgroup label="Locataires actuels — peuvent louer un logement de plus">${loc.map(opt).join('')}</optgroup>` : ''}
    </select>
    <div class="small muted" style="margin-top:5px" data-bc-aide>${liste.length
      ? 'Une personne peut louer plusieurs logements : choisir un locataire actuel ajoute un bail à son compte, sans créer de doublon.'
      : 'Aucun client ne vous a encore contacté. Saisissez son nom ci-dessous : un accès lui sera créé.'}</div>`;
  champ.closest('.field').before(bloc);
}

document.addEventListener('change', e => {
  const sel = e.target.closest('[data-action="bc-choisir"]');
  if (!sel) return;
  const f = sel.closest('form');
  const nom = f.querySelector('[name="tenant"]'), tel = f.querySelector('[name="phone"]');
  const c = sel.value ? DB.findItem(DB.K.users, sel.value) : null;
  const aide = f.querySelector('[data-bc-aide]');
  if (c) {
    nom.value = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    if (tel && c.phone) tel.value = c.phone;
    nom.readOnly = true; if (tel) tel.readOnly = true;
    const r = resumeBaux(c);
    if (aide) aide.textContent = r
      ? `${c.firstName} ${r}. Ce bail s'ajoutera aux siens : un seul compte, plusieurs logements.`
      : `${c.firstName} n'a pas encore de logement chez vous. Un accès lui sera créé.`;
  } else {
    nom.readOnly = false; if (tel) tel.readOnly = false;
    nom.value = ''; if (tel) tel.value = '';
    if (aide) aide.textContent = "Saisissez son nom ci-dessous : un accès lui sera créé.";
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
  if (locataireDuBail(bail)) return null;

  const deja = compteExistantPour(bail);
  if (deja) {
    const maj = rattacherBail(deja, bail);
    return {...maj, __existant: true};
  }

  const mots = String(bail.tenant).trim().split(/\s+/);
  const prenom = mots.shift() || 'Locataire';
  const nom = mots.join(' ');
  const base = sansAccent(prenom) + '.' + (sansAccent(nom) || 'locataire');
  const u = DB.addItem(DB.K.users, {
    password: 'demo123', status: 'actif', registrationPaid: true,
    firstName: prenom, lastName: nom, phone: bail.phone || '',
    role: 'tenant', leaseId: bail.id, leaseIds: [bail.id], ownerRef: bail.ownerId,
    email: emailLibre(base), cni: '', agencyName: '', address: '', agencyDesc: ''
  });
  return DB.lastWriteOk === false ? null : u;
};

/* --- 3. Le jeu de démonstration ne garde qu'une seule Fatou ------------- */
function fusionnerDoublons() {
  const porteurs = DB.filterItems(DB.K.users, u => bauxDe(u).length);
  porteurs.forEach(loc => {
    const jumeau = DB.findItem(DB.K.users, u => u.id !== loc.id && !bauxDe(u).length
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
    /* Le compte conservé hérite de TOUS les baux, pas seulement du dernier. */
    const ids = [...new Set([...bauxDe(garde), ...bauxDe(loc)].map(b => b.id))];
    DB.updateItem(DB.K.users, garde.id,
      {leaseIds: ids, leaseId: ids[0] || '', ownerRef: loc.ownerRef, role: 'tenant'});
    DB.deleteItem(DB.K.users, jette.id);
  });
}
etapeAmorcage('fusion des comptes en double', fusionnerDoublons, true);
setTimeout(() => { try { fusionnerDoublons(); } catch (e) {} }, 1700);

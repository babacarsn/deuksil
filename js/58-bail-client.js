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
      : 'Aucun client ne vous a encore contacté. Saisissez son nom ci-dessous ; vous pourrez ensuite lui ouvrir un accès avec son adresse e-mail.'}</div>`;
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
      : `${c.firstName} n'a pas encore de logement chez vous. Le bail sera ajouté à son compte.`;
  } else {
    nom.readOnly = false; if (tel) tel.readOnly = false;
    nom.value = ''; if (tel) tel.value = '';
    if (aide) aide.textContent = "Saisissez son nom ci-dessous ; vous pourrez ensuite lui ouvrir un accès avec son adresse e-mail.";
  }
});

new MutationObserver(() => requestAnimationFrame(() => {
  try { enrichirFormulaireBail(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

/* --- 2. Le bail se rattache au compte existant -------------------------- */
/* Si le propriétaire a choisi dans la liste une personne qui a déjà un compte,
   le nouveau bail est rattaché à ce compte dès qu'il est enregistré (contrôle
   de la relation par la base : fonction rattacher_locataire). */
document.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('.main form[data-action="g-lease"]'); if (!f) return;
  const sel = f.querySelector('[data-action="bc-choisir"]'), compteId = sel && sel.value; if (!compteId) return;
  const u = Auth.current(), nom = (f.querySelector('[name="tenant"]') || {}).value, debut = Date.now();
  setTimeout(async () => {
    const bail = DB.filterItems(DB.K.leases, l => l.ownerId === (u && u.id) && l.tenant === nom && new Date(l.createdAt).getTime() >= debut - 1000)
      .sort((a, b) => a.createdAt < b.createdAt ? 1 : -1)[0];
    if (bail && !locataireDuBail(bail)) await ouvrirAccesLocataire(bail, null, compteId);
  }, 50);
});

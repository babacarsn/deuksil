/* ==========================================================================
   MODULE : contacts.js — les documents s'adressent à quelqu'un de connu.
   Facture, devis, proforma, contrat : le nom du destinataire était une
   saisie libre. Le même locataire finissait écrit de trois façons, aucun
   document ne se rattachait à son compte, et il fallait retrouver un
   numéro de téléphone ailleurs pour le recopier.
   Le propriétaire choisit désormais dans ses relations — locataires, clients
   qui l'ont contacté, mandants — et les coordonnées suivent. La saisie libre
   reste possible : tout le monde n'a pas de compte.
   ========================================================================== */

const GROUPES = ['Mes locataires', 'Clients en contact', 'Propriétaires mandants', 'Prestataires'];

/* Une personne, telle qu'un document la désigne. */
function contactsDuPro(u) {
  const out = [];
  /* Une personne, une entrée. Le bail et le compte portent parfois deux
     écritures du même numéro — ou deux numéros différents : les proposer
     côte à côte ne ferait qu'obliger à deviner. On complète la première
     fiche au lieu d'en ajouter une seconde. */
  const ajouter = (groupe, nom, tel, adresse, ref) => {
    if (!nom) return;
    const cn = nomCle({firstName: nom, lastName: ''});
    const ct = telCle(tel);
    const deja = out.find(x => x.cn === cn || (ct && x.ct && x.ct === ct));
    if (deja) {
      if (!deja.tel && tel) { deja.tel = tel; deja.ct = ct; }
      if (!deja.adresse && adresse) deja.adresse = adresse;
      /* « Mes locataires » l'emporte : c'est le lien le plus fort. */
      if (GROUPES.indexOf(groupe) < GROUPES.indexOf(deja.groupe)) deja.groupe = groupe;
      return;
    }
    out.push({id: 'ct' + out.length, groupe, nom, tel: tel || '', ct,
              adresse: adresse || '', cn, ref});
  };

  try {
    /* a) ceux qui occupent un de ses logements : les plus fréquents */
    DB.filterItems(DB.K.leases, l => l.ownerId === u.id && l.status === 'actif')
      .forEach(l => {
        const p = gProp(l.propertyId) || {};
        ajouter('Mes locataires', l.tenant, l.phone,
          [p.title, p.quartier, p.city].filter(Boolean).join(', '), l.propertyId);
      });

    /* b) ceux qui l'ont contacté : visite, message, favori */
    clientsDuProprietaire(u).forEach(c => {
      const nom = `${c.firstName || ''} ${c.lastName || ''}`.trim();
      ajouter(bauxActifs(c).length ? 'Mes locataires' : 'Clients en contact',
        nom, c.phone, c.address || '', c.id);
    });

    /* c) pour une agence : les propriétaires qui lui ont confié des biens */
    if (u.role === 'agency') {
      DB.filterItems(DB.K.owners, o => o.ownerId === u.id)
        .forEach(o => ajouter('Propriétaires mandants', o.name, o.phone, o.address || '', o.id));
    }

    /* d) les prestataires, pour une facture de travaux */
    DB.filterItems(DB.K.providers, x => x.ownerId === u.id)
      .forEach(x => ajouter('Prestataires', x.name, x.phone, x.job || '', x.id));
  } catch (e) {}

  return out;
}

function selectContacts(liste, etiquette) {
  const par = {};
  liste.forEach(c => (par[c.groupe] = par[c.groupe] || []).push(c));
  const opt = c => `<option value="${c.id}">${esc(c.nom)}${c.tel ? ' · ' + esc(c.tel) : ''}</option>`;
  return `<label>${esc(etiquette)}</label>
    <select class="input" data-action="ct-choisir">
      <option value="">— Saisir un nom —</option>
      ${GROUPES.filter(g => par[g]).map(g =>
        `<optgroup label="${esc(g)}">${par[g].map(opt).join('')}</optgroup>`).join('')}
    </select>
    <div class="small muted" style="margin-top:5px" data-ct-aide>${liste.length
      ? 'Choisissez une de vos relations : nom, téléphone et adresse se remplissent.'
      : "Vous n'avez pas encore de relation enregistrée. Saisissez le nom ci-dessous."}</div>`;
}

/* Greffe le choix au-dessus du champ d'identité du formulaire. */
function greffeContacts(form, champ, etiquette) {
  if (!form || form.dataset.ct) return;
  const cible = form.querySelector(`[name="${champ}"]`);
  if (!cible || !cible.closest('.field')) return;
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  form.dataset.ct = '1';
  const liste = contactsDuPro(u);
  form.__contacts = liste;
  const bloc = document.createElement('div');
  bloc.className = 'field';
  bloc.innerHTML = selectContacts(liste, etiquette);
  cible.closest('.field').before(bloc);
  proposerParBien(form);
}

/* Quand le document porte sur un bien loué, son locataire est le
   destinataire évident : on le propose, sans l'imposer. */
function proposerParBien(form) {
  const sel = form.querySelector('[name="propertyId"]');
  const choix = form.querySelector('[data-action="ct-choisir"]');
  if (!sel || !sel.value || !choix) return;
  const bail = DB.findItem(DB.K.leases, l => l.propertyId === sel.value && l.status === 'actif');
  if (!bail) return;
  const c = (form.__contacts || []).find(x => telCle(x.tel) && telCle(x.tel) === telCle(bail.phone));
  if (!c) return;
  const nom = form.querySelector('[name="client"]') || form.querySelector('[name="party"]')
    || form.querySelector('[name="tenant"]');
  if (nom && nom.value.trim() && nom.dataset.ct !== nom.value) return;   /* saisie en cours */
  choix.value = c.id;
  appliquerContact(form, c);
  const aide = form.querySelector('[data-ct-aide]');
  if (aide) aide.textContent = `${c.nom} occupe ce bien : proposé comme destinataire. Vous pouvez en changer.`;
}

function appliquerContact(form, c) {
  const poser = (n, v) => {
    const e = form.querySelector(`[name="${n}"]`);
    if (!e) return;
    e.value = v || '';
    e.dataset.ct = e.value;          /* trace : valeur posée par le choix */
  };
  poser('client', c ? c.nom : '');
  poser('party', c ? c.nom : '');
  poser('tenant', c ? c.nom : '');
  poser('clientPhone', c ? c.tel : '');
  poser('phone', c ? c.tel : '');
  poser('clientAddress', c ? c.adresse : '');
}

document.addEventListener('change', e => {
  const s = e.target.closest('[data-action="ct-choisir"]');
  if (s) {
    const form = s.closest('form');
    const c = (form.__contacts || []).find(x => x.id === s.value) || null;
    appliquerContact(form, c);
    const aide = form.querySelector('[data-ct-aide]');
    if (aide) {
      aide.textContent = c
        ? `Document au nom de ${c.nom}${c.tel ? ' · ' + c.tel : ''}. Les champs restent modifiables.`
        : 'Saisissez librement le nom du destinataire ci-dessous.';
    }
    return;
  }
  /* changer de bien peut changer le destinataire évident */
  const b = e.target.closest('[name="propertyId"]');
  if (b) {
    const form = b.closest('form');
    if (form && form.dataset.ct) proposerParBien(form);
  }
});

new MutationObserver(() => requestAnimationFrame(() => {
  try {
    greffeContacts(document.querySelector('form[data-action="g2-save-doc"]'),
      'client', 'À qui s\'adresse ce document ?');
    greffeContacts(document.querySelector('.main form[data-action="g3-contract"]'),
      'party', 'Avec qui est passé ce contrat ?');
    greffeContacts(document.querySelector('form[data-action="g8-lease"]'),
      'tenant', 'Qui est le locataire ?');
  } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

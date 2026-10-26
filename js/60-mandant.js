/* ==========================================================================
   MODULE : mandant.js — le propriétaire qui confie ses biens à une agence.
   Il existait comme fiche dans l'espace de l'agence, sans compte : il ne
   pouvait ni voir ses loyers encaissés, ni la commission retenue, ni ce qui
   lui avait été reversé. C'est pourtant la première chose qu'un mandant
   demande à son agence.
   Il reçoit un accès en lecture : ses biens, ses loyers, ses relevés. La
   gestion reste à l'agence, et la propriété des biens n'est pas déplacée —
   les biens sous mandat portent déjà la référence du mandant.
   ========================================================================== */

/* --- 1. L'accès du mandant : ouvert par l'agence, avec son e-mail réel ---
   Bouton « Ouvrir l'accès » sur la fiche du propriétaire (onglet Propriétaires).
   Le compte est créé par la fonction serveur « gerer-acces » (mot de passe
   provisoire affiché une fois). Si la personne a déjà un compte DEUKSIL, elle
   confie elle-même ses biens depuis son espace (demande de gestion). */
async function compteMandant(fiche, email) {
  const moi = Auth.current();
  if (!fiche || !moi || moi.member || fiche.ownerId !== moi.id) return null;
  if (DB.findItem(DB.K.users, u => u.ownerRec === fiche.id)) return null;
  email = String(email || fiche.email || '').trim().toLowerCase();
  if (!EMAIL_VALIDE.test(email)) { toast('Indiquez l\'adresse e-mail réelle du propriétaire.', 'bad'); return null; }
  await DB.attendre();
  const mots = String(fiche.name || '').trim().split(/\s+/), prenom = mots.shift() || '', nom = mots.join(' ');
  try {
    const r = await appelerFonction('gerer-acces', {action: 'creer', role: 'owner', ownerRec: fiche.id, email,
      firstName: prenom, lastName: nom, phone: fiche.phone || '', cni: fiche.cni || undefined});
    await DB.relire(DB.K.users);
    const u = DB.findItem(DB.K.users, r.id) || {id: r.id, firstName: prenom, lastName: nom, email};
    if (!fiche.email) DB.updateItem(DB.K.owners, fiche.id, {email});
    audit('Accès mandant créé', `${fiche.name} · ${email}`);
    notify(u.id, 'Votre espace propriétaire est ouvert : suivez vos biens et vos relevés.', '#/owner/dashboard');
    montrerMotDePasseProvisoire(u, r.motDePasse); render();
    return u;
  } catch (e) {
    toast(/existe déjà/.test(e.message || '')
      ? `${fiche.name} a déjà un compte DEUKSIL : il peut vous confier ses biens depuis son espace (Mes biens → Confier à une agence).`
      : (e.message || 'Création de l\'accès impossible.'), 'bad');
    return null;
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="acces-mandant"]'); if (!b) return;
  e.preventDefault();
  const fiche = DB.findItem(DB.K.owners, b.dataset.id); if (!fiche) return;
  promptDialog({title: 'Ouvrir l\'accès de ' + fiche.name, label: 'Adresse e-mail du propriétaire', value: fiche.email || '',
    onConfirm: v => { b.disabled = true; Promise.resolve(compteMandant(fiche, v)).finally(() => { b.disabled = false; }); }});
});
/* Bouton posé à côté de « Fiche » pour les propriétaires sans accès. */
new MutationObserver(() => requestAnimationFrame(() => {
  const u = Auth.current();
  if (!u || u.role !== 'agency' || u.member || !/^#\/manage\/owners/.test(location.hash)) return;
  document.querySelectorAll('#app [data-action="g9-ofiche"][data-id]:not([data-acces])').forEach(b => {
    b.dataset.acces = '1';
    const fiche = DB.findItem(DB.K.owners, b.dataset.id);
    if (!fiche || fiche.compteId || fiche.status === 'close' || DB.findItem(DB.K.users, x => x.ownerRec === fiche.id)) return;
    b.insertAdjacentHTML('afterend', `<button class="btn ghost sm" data-action="acces-mandant" data-id="${fiche.id}">Ouvrir l'accès</button>`);
  });
})).observe(document.body, {childList: true, subtree: true});

const estMandant = u => !!(u && u.ownerRec);

/* --- 2. Ses biens sont ceux qu'il a confiés ----------------------------- */
const _myProps = myProps;
myProps = function (u) {
  if (estMandant(u)) return DB.filterItems(DB.K.properties, p => p.clientOwnerId === u.ownerRec);
  return _myProps(u);
};

/* --- 3. Un menu de suivi, pas de gestion -------------------------------- */
const _menusGet = MENUS_RAW.owner;
(function menuMandant() {
  const _p = Object.getOwnPropertyDescriptor(MENUS_RAW, 'owner');
  Object.defineProperty(MENUS_RAW, 'owner', {
    configurable: true,
    get() {
      const u = Auth.current();
      if (!estMandant(u)) return _menusGet;
      return [['#/owner/dashboard', 'Tableau de bord', 'grid'],
              ['#/owner/properties', 'Mes biens confiés', 'home'],
              ['#/mandant/releves', 'Mes relevés', 'money'],
              ['#/coffre', 'Documents', 'file'],
              ['#/owner/profile', 'Mon profil', 'user']];
    }
  });
})();

/* --- 4. Lecture seule : la gestion reste à l'agence --------------------- */
routes.forEach(r => {
  const f = r.fn;
  r.fn = (...a) => {
    const u = Auth.current(), path = location.hash.slice(1);
    if (estMandant(u) && /^\/(manage|agency|admin)\//.test(path)) {
      toast('Vos biens sont gérés par votre agence.', 'bad');
      go('#/owner/dashboard');
      return false;
    }
    return f(...a);
  };
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const u = Auth.current();
  if (!estMandant(u)) return;
  if (/^(g\d?-|owner-|set-status|publish|archive|delete-prop)/.test(el.dataset.action)) {
    e.stopImmediatePropagation(); e.preventDefault();
    toast('Action réservée à votre agence.', 'bad');
  }
}, true);

/* --- 5. Ses relevés : encaissé, commission, net, versé ------------------ */
function relevesMandant(u) {
  const biens = myProps(u), idb = new Set(biens.map(p => p.id));
  const fiche = DB.findItem(DB.K.owners, u.ownerRec) || {};
  const taux = +fiche.rate || 0;
  const loyers = DB.filterItems(DB.K.rents, r => idb.has(r.propertyId) && r.paidAt);
  const encaisse = loyers.reduce((s, r) => s + (r.amount || 0), 0);
  const commission = Math.round(encaisse * taux / 100);
  const verses = DB.filterItems(DB.K.transfers, t => t.ownerId2 === u.ownerRec);
  const verse = verses.reduce((s, t) => s + (t.amount || 0), 0);
  const net = encaisse - commission;

  return page('Mes relevés', `Ce que votre agence a encaissé sur vos biens et ce qu'elle vous a reversé.`) +
    `<div class="kpis">
      ${kpiRich(money(encaisse), 'Loyers encaissés', 'money', 'ok')}
      ${kpiRich(money(commission), `Commission de l'agence${taux ? ' · ' + taux + ' %' : ''}`, 'repeat', 'gold')}
      ${kpiRich(money(net), 'Net vous revenant', 'chart', 'brand')}
      ${kpiRich(money(net - verse), 'Reste à percevoir', 'alert', (net - verse) > 0 ? 'bad' : 'ok',
        {label: money(verse) + ' déjà reversé', tone: ''})}
    </div>
    <h3 style="margin:24px 0 12px">Reversements reçus</h3>
    ${gTable(['Référence', 'Mois', 'Montant'],
      verses.slice().reverse().map(t => `<tr><td class="small"><b>${esc(t.ref)}</b></td>
        <td class="small">${esc(monthLabel(t.month))}</td><td>${money(t.amount)}</td></tr>`),
      ['Aucun reversement', 'Les versements de votre agence apparaîtront ici.'])}
    <h3 style="margin:24px 0 12px">Loyers encaissés sur vos biens</h3>
    ${gTable(['Mois', 'Bien', 'Montant', 'Encaissé le'],
      loyers.slice().reverse().map(r => `<tr><td class="small">${esc(monthLabel(r.month))}</td>
        <td class="small muted">${esc((gProp(r.propertyId) || {}).title || '')}</td>
        <td>${money(r.amount)}</td><td class="small muted">${dateFr(r.paidAt)}</td></tr>`),
      ['Aucun loyer encaissé', 'Les loyers perçus par votre agence apparaîtront ici.'])}`;
}

route(/^\/mandant\/releves$/, () => {
  const u = Auth.current();
  if (!u || !estMandant(u)) { toast('Espace réservé aux propriétaires sous mandat.', 'bad'); go('#/login'); return false; }
  return shellApp(u, relevesMandant(u));
});

/* --- 6. Son tableau de bord ne propose pas de gérer --------------------- */
/* Le tableau de bord du propriétaire offre « Ajouter un bien », « Ajouter
   un locataire »… : hors sujet pour un mandant, dont l'agence s'occupe. */
const GESTION_RE = /#\/(manage|owner\/property\/new|owner\/visits|agency)/;
function nettoyerTableauMandant() {
  const u = Auth.current();
  if (!estMandant(u)) return;
  const c = document.querySelector('.main > .content');
  if (!c) return;
  c.querySelectorAll('.hero-pills a, .qa-grid a, .trow').forEach(a => {
    const h = a.getAttribute('href') || '';
    if (GESTION_RE.test(h)) a.remove();
  });
  const pills = c.querySelector('.hero-pills');
  if (pills && !pills.children.length) {
    pills.innerHTML = `<a href="#/mandant/releves">${icon('money', 15)} Mes relevés</a>
      <a href="#/owner/properties">${icon('home', 15)} Mes biens confiés</a>`;
  }
  const qa = c.querySelector('.qa-grid');
  if (qa && !qa.children.length) qa.closest('div').remove();
  /* Le bouton « Publier » de la barre du bas appartient à qui gère. */
  const fab = document.querySelector('.tabbar .tab-fab');
  if (fab) fab.remove();
}

/* --- 7. Nettoyage du tableau de bord du mandant (après chaque affichage) --- */

new MutationObserver(() => requestAnimationFrame(() => {
  try { nettoyerTableauMandant(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

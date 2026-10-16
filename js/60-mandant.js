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

/* --- 1. Un compte pour chaque mandant ----------------------------------- */
function compteMandant(fiche) {
  if (!fiche || !fiche.name) return null;
  if (DB.findItem(DB.K.users, u => u.ownerRec === fiche.id)) return null;
  const mots = String(fiche.name).trim().split(/\s+/);
  const prenom = mots.shift() || 'Mandant';
  const nom = mots.join(' ');
  const mail = (fiche.email && !DB.findItem(DB.K.users, u => u.email === fiche.email))
    ? fiche.email
    : emailLibre(sansAccent(prenom) + '.' + (sansAccent(nom) || 'mandant'));
  const u = DB.addItem(DB.K.users, {
    password: 'demo123', status: 'actif', registrationPaid: true,
    firstName: prenom, lastName: nom, phone: fiche.phone || '',
    role: 'owner', ownerRec: fiche.id, mandantOf: fiche.ownerId,
    email: mail, cni: fiche.cni || '', agencyName: '', address: fiche.address || '', agencyDesc: ''
  });
  return DB.lastWriteOk === false ? null : u;
}

function assurerMandants() {
  const moi = Auth.current();
  if (!moi || moi.role !== 'agency') return;
  try {
    DB.filterItems(DB.K.owners, o => o.ownerId === moi.id).forEach(fiche => {
      const u = compteMandant(fiche);
      if (!u) return;
      notify(moi.id, `Accès créé pour ${u.firstName} ${u.lastName} : ${u.email}`, '#/manage/owners');
      notify(u.id, 'Votre espace propriétaire est ouvert : suivez vos biens et vos relevés.', '#/owner/dashboard');
      if (!moi.member) toast(`${u.firstName} peut suivre ses biens avec ${u.email} (mot de passe : demo123).`);
    });
  } catch (e) {}
}
/* L'amorçage ne passe pas par render() : on s'accroche aux changements de
   l'écran, comme les autres greffes, pour être sûr de passer après le
   chargement du jeu de données. */
let _mandantsVus = 0;
new MutationObserver(() => requestAnimationFrame(() => {
  const u = Auth.current();
  if (!u || u.role !== 'agency') return;
  const n = DB.filterItems(DB.K.owners, o => o.ownerId === u.id).length;
  if (n === _mandantsVus) return;
  _mandantsVus = n;
  try { assurerMandants(); } catch (e) {}
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

/* --- 7. De quoi voir fonctionner ses relevés ---------------------------- */
const MANDANT_FLAG = 'deuksil_mandant_v1';
function seedMandant() {
  if (localStorage.getItem(MANDANT_FLAG)) return;
  const fiche = DB.getData(DB.K.owners)[0];
  if (!fiche) return;
  const bien = DB.filterItems(DB.K.properties, p => p.clientOwnerId === fiche.id)[0];
  if (!bien) return;
  if (DB.findItem(DB.K.leases, l => l.propertyId === bien.id)) { localStorage.setItem(MANDANT_FLAG, '1'); return; }

  const loyer = bien.price || 400000;
  const bail = DB.addItem(DB.K.leases, {ownerId: fiche.ownerId, propertyId: bien.id,
    tenant: 'Cheikh Mbaye', phone: '770002244', rent: loyer, deposit: loyer * 2,
    start: addDays(now(), -150).slice(0, 10), months: 12, status: 'actif'});
  const d = new Date(bail.start);
  for (let i = 0; i < 5; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    DB.addItem(DB.K.rents, {ownerId: fiche.ownerId, leaseId: bail.id, propertyId: bien.id,
      month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
      amount: loyer, paidAt: i < 4 ? addDays(bail.start, i * 30 + 3) : null});
  }
  const encaisse = loyer * 4, taux = +fiche.rate || 8;
  DB.addItem(DB.K.transfers, {ownerId: fiche.ownerId, ownerId2: fiche.id,
    ref: nref('REV', 'transfers'), month: new Date().toISOString().slice(0, 7),
    amount: Math.round(encaisse * (100 - taux) / 100 / 2)});
  DB.updateItem(DB.K.properties, bien.id, {status: 'loue'});
  localStorage.setItem(MANDANT_FLAG, '1');
}

etapeAmorcage('accès mandant', seedMandant, true);

new MutationObserver(() => requestAnimationFrame(() => {
  try { seedMandant(); } catch (e) {}
  try { nettoyerTableauMandant(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

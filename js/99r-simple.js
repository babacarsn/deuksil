/* ==========================================================================
   99r-simple.js — une application qu'on comprend sans formation.

   Le design ne change pas (bannières photo, cartes, couleurs) : on range et on
   montre d'abord ce qu'il faut faire.

   1. Menu latéral regroupé (ordinateur) : les entrées existantes sont rangées
      dans quelques rubriques qui s'ouvrent d'un clic. Aucun écran n'est retiré :
      une entrée qui n'a pas de rubrique reste visible telle quelle. La rubrique
      qui contient l'écran ouvert est dépliée d'office.
   2. Accueil agence / propriétaire : « À faire aujourd'hui » (loyers en retard,
      visites à confirmer, travaux, factures impayées, mandats qui expirent),
      chaque ligne avec son bouton ; et « Bien démarrer » pour un compte neuf,
      qui disparaît quand les étapes sont faites.
   Ce module se charge en dernier : il complète, il ne remplace rien.
   ========================================================================== */

/* --- 1. Menu regroupé --------------------------------------------------------
   Rubrique : {g: identifiant, lib, ic, liens: [adresses]} ; entrée seule : 'adresse'.
   NOMS : libellés plus parlants pour certaines entrées. BAS : sous un trait. */
const MENU_SIMPLE = {
  agency: {
    plan: ['#/agency/dashboard',
      {g: 'biens', lib: 'Biens & ventes', ic: 'building', liens: ['#/agency/properties', '#/owner/property/new', '#/agency/visits', '#/agency/clients', '#/manage/units', '#/manage/deals']},
      {g: 'proprios', lib: 'Propriétaires', ic: 'user', liens: ['#/manage/owners', '#/manage/mandates', '#/manage/transfers']},
      {g: 'locations', lib: 'Locations', ic: 'key', liens: ['#/manage/tenants', '#/manage/leases', '#/manage/rents', '#/manage/tickets', '#/manage']},
      {g: 'argent', lib: 'Argent & documents', ic: 'card', liens: ['#/manage/docs', '#/agency/commissions', '#/manage/expenses', '#/manage/finance', '#/manage/reports', '#/coffre']},
      '#/agency/agents', '#/agency/messages'],
    bas: ['#/agency/settings', '#/owner/profile', '#/aide'],
    noms: {'#/agency/dashboard': 'Accueil', '#/manage': 'Vue d\'ensemble'}
  },
  owner: {
    plan: ['#/owner/dashboard',
      {g: 'biens', lib: 'Mes biens', ic: 'home', liens: ['#/owner/properties', '#/owner/property/new', '#/owner/visits', '#/manage/deals', '#/owner/statistics']},
      {g: 'locations', lib: 'Locataires & loyers', ic: 'key', liens: ['#/manage/leases', '#/manage/tenants', '#/manage/rents', '#/manage/tickets', '#/manage']},
      {g: 'argent', lib: 'Argent & documents', ic: 'money', liens: ['#/manage/finance', '#/manage/expenses', '#/manage/reports', '#/coffre']},
      '#/owner/messages'],
    bas: ['#/owner/profile', '#/aide'],
    noms: {'#/owner/dashboard': 'Accueil', '#/owner/properties': 'Tous mes biens', '#/manage': 'Vue d\'ensemble'}
  },
  tenant: {
    plan: ['#/tenant/home',
      {g: 'payer', lib: 'Loyer & paiements', ic: 'money', liens: ['#/tenant/rents', '#/tenant/payments', '#/tenant/quittances']},
      '#/tenant/tickets', '#/coffre', '#/tenant/messages', '#/client/messages',
      {g: 'chercher', lib: 'Recherche', ic: 'search', liens: ['#/client/dashboard', '#/search', '#/client/favorites', '#/client/visits', '#/client/alerts']}],
    bas: ['#/client/profile', '#/aide'],
    noms: {'#/tenant/tickets': 'Signaler un problème', '#/client/dashboard': 'Annonces pour moi'}
  },
  client: {
    plan: ['#/client/dashboard', '#/search',
      {g: 'favoris', lib: 'Favoris & alertes', ic: 'heart', liens: ['#/client/favorites', '#/client/alerts']},
      '#/client/visits', '#/client/messages', '#/coffre'],
    bas: ['#/client/profile', '#/aide'],
    noms: {'#/client/dashboard': 'Accueil'}
  }
};
const menuOuverts = new Set();
try { JSON.parse(localStorage.getItem('deuksil-menu-ouvert') || '[]').forEach(g => menuOuverts.add(g)); } catch (e) {}

function configMenuSimple(u) {
  if (!u || u.member) return null;                                      // équipes : menu déjà réduit à leurs droits
  if (typeof estMandant === 'function' && estMandant(u)) return null;   // mandant : 6 entrées, déjà simple
  return MENU_SIMPLE[u.role] || null;
}
function regrouperMenu(html, u) {
  const cfg = configMenuSimple(u); if (!cfg) return html;
  const a = html.indexOf('<aside class="side"'); if (a < 0) return html;
  const n0 = html.indexOf('<nav>', a), n1 = n0 < 0 ? -1 : html.indexOf('</nav>', n0);
  if (n0 < 0 || n1 < 0) return html;
  const liens = new Map();   // adresse → HTML du lien (classes, pastilles et icônes d'origine)
  for (const m of html.slice(n0 + 5, n1).matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)) if (!liens.has(m[1])) liens.set(m[1], m[0]);
  if (liens.size < 7) return html;                                       // menu court : rien à ranger
  const nom = (h, x) => cfg.noms[h] ? x.replace(/(<span class="ico">[\s\S]*?<\/span>)([^<]*)/, `$1${cfg.noms[h]}`) : x;
  const pris = new Set(), prendre = h => { if (!liens.has(h) || pris.has(h)) return ''; pris.add(h); return nom(h, liens.get(h)); };
  const bas = cfg.bas.filter(h => liens.has(h));
  bas.forEach(h => pris.add(h));
  const blocs = cfg.plan.map(x => {
    if (typeof x === 'string') return prendre(x);
    const sous = x.liens.map(prendre).filter(Boolean); if (!sous.length) return '';
    if (sous.length === 1) return sous[0];
    const corps = sous.join(''), actif = /class="[^"]*\bactive\b/.test(corps), ouvert = actif || menuOuverts.has(x.g);
    const alerte = /sidebar-badge/.test(corps);
    return `<div class="ng${ouvert ? ' ouvert' : ''}${actif ? ' contient-actif' : ''}"><button type="button" class="ng-t" data-ng="${x.g}" aria-expanded="${ouvert}">`
      + `<span class="ico">${icon(x.ic, 17)}</span><span class="ng-lib">${x.lib}</span>${alerte ? '<i class="ng-pt" aria-label="À traiter"></i>' : ''}`
      + `<span class="ng-chev">${icon('arrowRight', 14)}</span></button><div class="ng-l">${corps}</div></div>`;
  });
  /* Ce qui n'a pas de place prévue reste visible, à la fin de la partie haute. */
  const reste = [...liens.keys()].filter(h => !pris.has(h)).map(h => nom(h, liens.get(h)));
  const nav = blocs.join('') + reste.join('') + (bas.length ? `<div class="ng-bas">${bas.map(h => nom(h, liens.get(h))).join('')}</div>` : '');
  return html.slice(0, n0) + '<nav class="nav-simple">' + nav + html.slice(n1);
}
document.addEventListener('click', e => {
  const b = e.target.closest('.ng-t'); if (!b) return;
  const g = b.closest('.ng'), id = b.dataset.ng, ouvert = !g.classList.contains('ouvert');
  g.classList.toggle('ouvert', ouvert); b.setAttribute('aria-expanded', String(ouvert));
  if (ouvert) menuOuverts.add(id); else menuOuverts.delete(id);
  try { localStorage.setItem('deuksil-menu-ouvert', JSON.stringify([...menuOuverts])); } catch (err) {}
});


/* --- 2. Accueil : « À faire aujourd'hui » et « Bien démarrer » ---------------- */
const lireListe = (k, u) => { try { return DB.K[k] ? gMine(k, u) : []; } catch (e) { return []; } };
const moisCourant = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

function tachesDuJour(u) {
  const t = [], auj = new Date(), mc = moisCourant(), dansJours = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const leases = lireListe('leases', u), biens = lireListe('properties', u);
  const bail = id => leases.find(l => l.id === id), bien = id => biens.find(p => p.id === id) || (DB.findItem(DB.K.properties, id) || null);
  /* Loyers en retard : mois passé, ou mois en cours après le jour d'échéance. */
  const retard = lireListe('rents', u).filter(r => !r.paidAt && r.month && (r.month < mc || (r.month === mc && auj.getDate() > (+(bail(r.leaseId) || {}).dueDay || 5))));
  const parBail = new Map(); retard.forEach(r => { const k = r.leaseId || r.id; const x = parBail.get(k) || {n: 0, reste: 0, r}; x.n++; x.reste += rRest(r); parBail.set(k, x); });
  [...parBail.values()].sort((a, b) => b.reste - a.reste).slice(0, 3).forEach(({n, reste, r}) => {
    const l = bail(r.leaseId) || {}, p = bien(l.propertyId || r.propertyId);
    t.push({ton: 'bad', ic: 'alert', titre: `${n > 1 ? n + ' loyers en retard' : 'Loyer de ' + monthLabel(r.month) + ' non reçu'} · ${money(reste)}`,
      detail: [l.tenant, p && p.title].filter(Boolean).join(' · '), btn: 'Encaisser ou relancer', lien: '#/manage/rents?f=retard'});
  });
  if (parBail.size > 3) t.push({ton: 'bad', ic: 'alert', titre: `${parBail.size - 3} autre${parBail.size > 4 ? 's' : ''} locataire${parBail.size > 4 ? 's' : ''} en retard`, detail: 'Tous les loyers en retard, au même endroit', btn: 'Voir', lien: '#/manage/rents?f=retard'});
  /* Visites à confirmer */
  const vis = DB.filterItems(DB.K.visits, v => v.ownerId === u.id && v.status === 'attente').sort((a, b) => String(a.date) < String(b.date) ? -1 : 1);
  if (vis.length) {
    const v = vis[0], p = bien(v.propertyId);
    t.push({ton: 'warn', ic: 'calendar', titre: vis.length > 1 ? `${vis.length} demandes de visite à confirmer` : 'Une demande de visite à confirmer',
      detail: [p && p.title, v.date && dateFr(v.date) + (v.time ? ' à ' + v.time.replace(':', ' h ') : '')].filter(Boolean).join(' · '),
      btn: 'Répondre', lien: (u.role === 'agency' ? '#/agency/visits' : '#/owner/visits') + '?f=confirmer'});
  }
  /* Travaux signalés et pas encore pris en charge */
  const tk = lireListe('tickets', u).filter(x => x.status === 'ouvert');
  if (tk.length) t.push({ton: 'info', ic: 'settings', titre: tk.length > 1 ? `${tk.length} problèmes signalés à traiter` : 'Un problème signalé à traiter',
    detail: tk.slice(0, 2).map(x => x.title).filter(Boolean).join(' · '), btn: 'Voir les travaux', lien: '#/manage/tickets?f=encours'});
  /* Factures échues non payées */
  const fac = lireListe('docs', u).filter(d => d.type === 'FAC' && !/pay|annul/i.test(d.status || '') && d.due && d.due < auj.toISOString().slice(0, 10));
  if (fac.length) t.push({ton: 'gold', ic: 'card', titre: fac.length > 1 ? `${fac.length} factures impayées après échéance` : `Facture ${fac[0].ref || ''} impayée après échéance`,
    detail: fac.slice(0, 2).map(d => d.client).filter(Boolean).join(' · '), btn: 'Voir les factures', lien: '#/manage/docs?f=impayee'});
  /* Mandats qui expirent dans les 30 jours */
  const mdt = lireListe('mandates', u).filter(m => m.status === 'actif' && m.end && m.end <= dansJours(30));
  if (mdt.length) t.push({ton: 'gold', ic: 'file', titre: mdt.length > 1 ? `${mdt.length} mandats expirent bientôt` : `Le mandat ${mdt[0].ref || ''} expire le ${dateFr(mdt[0].end)}`,
    detail: 'À renouveler avec le propriétaire', btn: 'Voir les mandats', lien: '#/manage/mandates'});
  return t;
}

function etapesDemarrage(u) {
  const e = [
    {ok: /^\d{13}$/.test(u.cni || ''), lib: 'Renseigner ma CNI', lien: u.role === 'agency' ? '#/agency/settings' : '#/owner/profile'},
    {ok: lireListe('properties', u).length > 0, lib: 'Publier mon premier bien', lien: '#/owner/property/new'}
  ];
  if (u.role === 'agency') e.push({ok: lireListe('owners', u).length > 0 || lireListe('mandates', u).length > 0, lib: 'Ajouter un propriétaire', lien: '#/manage/owners?form=Nouveau propriétaire'});
  e.push({ok: lireListe('leases', u).length > 0, lib: 'Ajouter mon premier locataire', lien: '#/manage/leases?form=Nouveau bail'});
  return e;
}

const icTache = {bad: 'bad', warn: 'warn', info: 'info', gold: 'gold'};
function blocAccueil(u) {
  const etapes = etapesDemarrage(u), faites = etapes.filter(x => x.ok).length, taches = tachesDuJour(u);
  let h = '';
  if (faites < etapes.length) {
    const suivante = etapes.find(x => !x.ok);
    h += `<section class="pd-card sd-demarrer rv rv-on" data-tone="gold" aria-labelledby="sd-dem-t">
      <div class="sd-tete"><div><h3 id="sd-dem-t" class="pd-h">Bien démarrer</h3><p class="pd-sub">${faites} étape${faites > 1 ? 's' : ''} sur ${etapes.length} · cette carte disparaît quand tout est fait</p></div>
      <a class="btn" href="${suivante.lien}">${esc(suivante.lib)}</a></div>
      <div class="sd-barre" role="progressbar" aria-valuemin="0" aria-valuemax="${etapes.length}" aria-valuenow="${faites}"><i style="width:${Math.round(faites / etapes.length * 100)}%"></i></div>
      <ol class="sd-etapes">${etapes.map(x => `<li class="${x.ok ? 'fait' : ''}"><a href="${x.lien}"><span class="sd-coche">${x.ok ? icon('check', 14) : ''}</span>${esc(x.lib)}</a></li>`).join('')}</ol>
    </section>`;
  }
  h += `<section class="pd-card sd-afaire rv rv-on" data-tone="${taches.some(x => x.ton === 'bad') ? 'bad' : 'brand'}" aria-labelledby="sd-af-t">
    <div class="sd-tete"><div><h3 id="sd-af-t" class="pd-h">À faire aujourd'hui</h3><p class="pd-sub">${taches.length ? 'Ce qui demande votre attention, avec le bouton pour le faire' : 'Rien d\'urgent : tout est à jour.'}</p></div>
    ${taches.length ? `<span class="sd-nb">${taches.length}</span>` : `<span class="pd-ic ok">${icon('checkCircle', 22)}</span>`}</div>
    ${taches.length ? `<ul class="sd-liste">${taches.map(x => `<li><span class="pd-ic ${icTache[x.ton]}">${icon(x.ic, 20)}</span>
      <div class="sd-txt"><b>${esc(x.titre)}</b>${x.detail ? `<span>${esc(x.detail)}</span>` : ''}</div>
      <a class="btn sm" href="${x.lien}">${esc(x.btn)}</a></li>`).join('')}</ul>` : ''}
  </section>`;
  return h;
}

(() => {
  const _shellSimple = shellApp;
  shellApp = function (u, content) {
    let c = content;
    try {
      const path = (location.hash || '').replace('#', '').split('?')[0];
      if (u && !u.member && ['agency', 'owner'].includes(u.role) && !(typeof estMandant === 'function' && estMandant(u))
          && path === '/' + (u.role === 'agency' ? 'agency' : 'owner') + '/dashboard' && typeof c === 'string' && !c.includes('sd-afaire'))
        c = c.replace(/(<div class="pd"[^>]*>)/, m => m + blocAccueil(u));
    } catch (e) {}
    const html = _shellSimple(u, c);
    try { return u ? regrouperMenu(html, u) : html; } catch (e) { return html; }
  };
})();

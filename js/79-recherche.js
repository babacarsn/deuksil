/* ==========================================================================
   MODULE : recherche.js — toutes les barres de recherche filtrent pendant
   la frappe.
   - Accent et casse ignorés, plusieurs mots = tous doivent apparaître
     (« loyer fatou », « securite » trouve « Sécurité »).
   - Gestion : les tiroirs concernés par les lettres tapées restent seuls à
     l'écran, et les biens, locataires, factures… correspondants
     s'affichent dessous, sans appuyer sur Entrée. Entrée ouvre le premier.
   - Listes de Gestion (barre « Rechercher… ») : lignes et cartes filtrées
     en direct, avec le nombre de résultats.
   - Recherche de biens : le champ libre et les filtres s'appliquent
     pendant la saisie ; l'accueil propose les biens au fil des lettres.
   ========================================================================== */

const normRech = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const correspond = (texte, q) => {
  const t = normRech(texte);
  return normRech(q).split(/\s+/).filter(Boolean).every(m => t.includes(m));
};
const plusTard = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
/* Après un render(), on rend la main au champ où l'on tapait, curseur en fin. */
function garderFocus(selecteur) {
  requestAnimationFrame(() => {
    const i = document.querySelector(selecteur);
    if (!i) return;
    i.focus({preventScroll: true});
    try { const n = i.value.length; i.setSelectionRange(n, n); } catch (e) {}
  });
}

/* --- 1. Gestion : les tiroirs au fil des lettres ------------------------- */
const MOTS_TIROIR = {
  leases: 'bail baux locataire location contrat de bail fin de bail prolonger caution',
  units: 'unite unites appartement chambre lot immeuble etage porte',
  tenants: 'locataire locataires fiche occupant contact telephone',
  rents: 'loyer loyers quittance encaisser encaissement impaye impayes retard relance paiement acompte',
  contracts: 'contrat contrats mandat renouveler renouvellement resilier echeance',
  owners: 'proprietaire proprietaires mandant mandants reversement releve',
  tmsgs: 'message messages discussion locataire echange',
  deals: 'vente ventes vendre acheteur acquereur promesse acte cession',
  tickets: 'maintenance travaux panne reparation intervention fuite plomberie electricite climatisation',
  providers: 'prestataire prestataires artisan plombier electricien macon peintre',
  docs: 'devis facture factures proforma avoir client facturation',
  fpay: 'paiement paiements recu recus encaissement reglement',
  expenses: 'depense depenses charge charges achat justificatif',
  finance: 'finance finances rentabilite resultat revenu revenus benefice',
  reports: 'rapport rapports pdf export bilan annuel statistiques',
  team: 'equipe membre membres gestionnaire agent acces droits permission',
  identity: 'identite ninea rccm entete logo emetteur',
  audit: 'journal historique trace qui a fait quoi',
  transfers: 'reversement reversements virement mandant'
};
function texteTiroir(a) {
  const k = ((a.getAttribute('href') || '').match(/#\/manage\/(\w+)/) || [])[1];
  /* Le titre du groupe n'entre pas en compte : « loy » ne doit pas ramener
     « Ventes » sous prétexte qu'il est rangé dans « Loyers et ventes ». */
  const morceaux = [...a.querySelectorAll('b, .small, .dn')].map(x => x.textContent);   // séparés : « Ventes » + « Du prospect » ne se collent pas
  return [...morceaux, k ? MOTS_TIROIR[k] || '' : ''].join(' ');
}
function gsResultatsHtml(u, q) {
  if (!q) return '';
  const res = globalSearch(u, q);
  if (!res.length) return '';
  return `<h3 style="margin:6px 0 10px">Dans vos données</h3><div class="card" style="margin-bottom:20px">${res.map(([t, n, d, h]) =>
    `<a class="trow" href="${h}"><span class="badge info">${esc(t)}</span><div class="txt" style="min-width:0"><b>${esc(n)}</b><div class="sub">${esc(d)}</div></div>${icon('arrowRight', 16)}</a>`).join('')}</div>`;
}
function gsAppliquer() {
  const i = document.getElementById('gs-q'), u = Auth.current();
  if (!i || !u) return;
  const q = i.value.trim();
  GSEARCH = q;
  let n = 0;
  document.querySelectorAll('.main .gsection').forEach(sec => {
    let vus = 0;
    sec.querySelectorAll('.drawer').forEach(a => {
      const ok = !q || correspond(texteTiroir(a), q);
      a.hidden = !ok; if (ok) vus++;
    });
    sec.hidden = !vus; n += vus;
  });
  const res = document.getElementById('gs-res');
  if (res) {
    const data = gsResultatsHtml(u, q);
    res.innerHTML = (q ? `<p class="small muted" style="margin:0 0 12px">${n ? `${n} tiroir${n > 1 ? 's' : ''} correspond${n > 1 ? 'ent' : ''} à « ${esc(q)} »` : `Aucun tiroir ne correspond à « ${esc(q)} »`}</p>` : '') + data
      + (q && !n && !data ? `<div class="empty" style="margin-bottom:20px"><b>Aucun résultat</b><p class="small">Essayez un autre mot : « loyer », « facture », un nom de locataire…</p></div>` : '');
  }
}
const gsPlusTard = plusTard(gsAppliquer, 120);

/* Le hub est produit par 41-gestion2 : on remplace sa liste figée (calculée
   à la validation) par une zone que l'on met à jour pendant la frappe. */
const _manageHub79 = manageHub;
manageHub = function (u) {
  const q = GSEARCH; GSEARCH = '';
  let h = _manageHub79(u);
  GSEARCH = q;
  h = h.replace('id="gs-q" placeholder="Rechercher un bien, un locataire, une facture…" value=""',
    `id="gs-q" type="search" inputmode="search" enterkeyhint="go" placeholder="Rechercher un tiroir, un bien, un locataire…" value="${esc(q)}"`);
  return h.replace('<div class="gsection">', '<div id="gs-res"></div><div class="gsection">');
};
new MutationObserver(() => {
  const i = document.getElementById('gs-q');
  if (i && !i.dataset.live) { i.dataset.live = '1'; if (i.value) gsAppliquer(); }
}).observe(document.body, {childList: true, subtree: true});

document.addEventListener('input', e => { if (e.target.id === 'gs-q') gsPlusTard(); });
/* Entrée : ouvre le premier tiroir trouvé, sinon le premier résultat. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('[data-action="gs-form"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  gsAppliquer();
  const cible = document.querySelector('.main .gsection:not([hidden]) .drawer:not([hidden])') || document.querySelector('#gs-res a.trow');
  if (cible && GSEARCH) location.hash = cible.getAttribute('href');
}, true);

/* --- 2. Listes de Gestion : lignes et cartes ------------------------------ */
const ELEMENTS_LISTE = '.main > .content tbody tr, .main > .content .vgrid > .vcard';
function filtrerListes(champ) {
  const q = champ.value.trim();
  const lignes = [...document.querySelectorAll(ELEMENTS_LISTE)];
  const filtreLoyer = /^#\/manage\/rents/.test(location.hash) && typeof rFiltre !== 'undefined' && rFiltre !== 'tous'
    ? (RFILTRES.find(f => f[0] === rFiltre) || RFILTRES[0])[2] : null;
  let n = 0;
  lignes.forEach(el => {
    const ok = (!q || correspond(el.textContent, q)) && (!filtreLoyer || el.tagName !== 'TR' || filtreLoyer(tonLigne(el)));
    el.dataset.f = ok ? '' : '1';
    el.style.display = ok ? '' : 'none';
    if (ok) n++;
  });
  document.querySelectorAll('.main > .content table').forEach(t => { try { if (typeof t.__pg === 'function') t.__pg(); } catch (e) {} });
  const bar = champ.closest('.sbar, .tfilter');
  if (bar) {
    let c = bar.parentElement.querySelector(':scope > .sbar-n');
    if (!c) { c = document.createElement('p'); c.className = 'sbar-n small muted'; bar.after(c); }
    c.textContent = q ? (n ? `${n} résultat${n > 1 ? 's' : ''} pour « ${q} »` : `Aucun résultat pour « ${q} »`) : '';
    c.hidden = !q;
  }
}
document.addEventListener('input', e => {
  const champ = e.target.closest && e.target.closest('[data-gsearch]');
  if (!champ) return;
  if (/^#\/(owner|agency)\/properties/.test(location.hash)) return;   // la liste des biens a son propre filtre (68)
  filtrerListes(champ);
});
/* Le filtre d'état des loyers (chips) réécrit les lignes : on réapplique le texte par-dessus. */
const _appliquerFiltreLoyers79 = appliquerFiltreLoyers;
appliquerFiltreLoyers = function () {
  _appliquerFiltreLoyers79();
  const champ = document.querySelector('.main > .content [data-gsearch]');
  if (champ && champ.value.trim()) filtrerListes(champ);
};
/* Le bouton loupe ne recharge rien : il garde le focus dans le champ. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('[data-action="sb-noop"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const champ = f.querySelector('[data-gsearch]');
  if (champ) { filtrerListes(champ); champ.blur(); }
}, true);
/* Les dossiers de vente sont des cartes sans barre : on en ajoute une dès le premier dossier. */
new MutationObserver(() => requestAnimationFrame(() => {
  try {
    if (!/^#\/manage\/deals/.test(location.hash)) return;
    const g = document.querySelector('.main > .content .vgrid');
    if (!g || g.dataset.sb || g.children.length < 1) return;   // dès le premier dossier (écran de gestion)
    g.dataset.sb = '1';
    const t = document.createElement('div');
    t.innerHTML = sBar('Rechercher un acquéreur, un bien…');
    (g.previousElementSibling && g.previousElementSibling.tagName === 'H3' ? g.previousElementSibling : g).before(t.firstElementChild);
  } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});
/* La liste des biens (68) : la recherche ignore aussi les accents. */
if (typeof bfAppliquer === 'function') {
  const _bf = bfAppliquer;
  bfAppliquer = function () {
    _bf();
    const champ = document.querySelector('.main > .content .tfilter input, .main > .content [data-gsearch]');
    const q = champ ? champ.value.trim() : '';
    if (!q) return;
    const t = bfTable(); if (!t || !t.tBodies[0]) return;
    const test = (BF_CATS.find(c => c[0] === bfChoix) || BF_CATS[0])[2];
    let n = 0;
    [...t.tBodies[0].rows].forEach(tr => {
      const p = bfBien(tr), ok = (!p || test(p)) && correspond(tr.textContent, q);
      tr.dataset.f = ok ? '' : '1'; tr.style.display = ok ? '' : 'none'; if (ok) n++;
    });
    try { if (typeof t.__pg === 'function') t.__pg(); } catch (e) {}
    const c = document.querySelector('.bf-n'), txt = `${n} bien${n > 1 ? 's' : ''}`;
    if (c && c.textContent !== txt) c.textContent = txt;
  };
}
/* Les listes filtrées automatiquement (50-tfilter) : même règle d'accents. */
document.addEventListener('input', e => {
  const i = e.target.closest && e.target.closest('.tfilter input');
  if (!i || /^#\/(owner|agency)\/properties/.test(location.hash)) return;
  const box = i.closest('.tfilter'); if (!box || box.__tables || box.classList.contains('msg-recherche')) return;   // listes multiples et Messages : gérés par 50-tfilter
  const wrap = box.nextElementSibling;
  const t = wrap && (wrap.matches('table') ? wrap : wrap.querySelector('table'));
  if (!t || !t.tBodies[0]) return;
  const q = i.value.trim(); let n = 0;
  [...t.tBodies[0].rows].forEach(r => { const ok = !q || correspond(r.textContent, q); r.dataset.f = ok ? '' : '1'; if (ok) n++; });
  const nEl = box.querySelector('.tfilter-n'); if (nEl) nEl.textContent = q ? `${n} / ${t.tBodies[0].rows.length}` : '';
  box.classList.toggle('empty-hit', !!q && !n);
  try { t.__pg(); } catch (err) {}
});

/* --- 3. Recherche de biens ------------------------------------------------ */
/* Champ libre de la page Recherche. */
const rechercheLibre = plusTard(v => {
  if (!/^#\/search/.test(location.hash)) return;
  searchState = {...searchState, q: v, page: 1};
  render(); garderFocus('form[data-action="page-search"] [name="q"]');
}, 220);
document.addEventListener('input', e => {
  const i = e.target.closest && e.target.closest('form[data-action="page-search"] [name="q"]');
  if (i) rechercheLibre(i.value);
});
/* Filtres détaillés : prix, chambres, surface, quartier, type, cases. */
const filtresDirects = plusTard(nom => {
  const f = document.querySelector('form[data-action="search"]');
  if (!f || !/^#\/search/.test(location.hash)) return;
  const d = formData(f);
  searchState = {...searchState, region: d.region, city: d.city, quartier: d.quartier, type: d.type,
    min: d.min, max: d.max, rooms: d.rooms, baths: d.baths, surface: d.surface,
    furnished: !!d.furnished, parking: !!d.parking, page: 1};
  const ouvert = document.getElementById('sfold') && document.getElementById('sfold').classList.contains('open');
  render();
  if (ouvert) document.getElementById('sfold')?.classList.add('open');
  if (nom) garderFocus(`form[data-action="search"] [name="${nom}"]`);
}, 350);
document.addEventListener('input', e => {
  const i = e.target.closest && e.target.closest('form[data-action="search"] input.input');
  if (i) filtresDirects(i.name);
});
document.addEventListener('change', e => {
  const i = e.target.closest && e.target.closest('form[data-action="search"] [name="quartier"], form[data-action="search"] [name="type"], form[data-action="search"] [type="checkbox"]');
  if (i) filtresDirects('');
});

/* Accueil : les biens proposés pendant la frappe, sous la barre. */
function suggestionsBiens(q) {
  const garde = searchState;
  searchState = {transaction: '', region: '', city: '', quartier: '', type: '', min: '', max: '', rooms: '', baths: '', surface: '', furnished: false, parking: false, sort: 'recent', page: 1, q: ''};
  let liste = [];
  try { liste = applySearch(); } finally { searchState = garde; }
  return liste.filter(p => correspond([p.title, p.quartier, p.city, p.region, p.type, p.transaction, p.description].join(' '), q));
}
const suggerer = plusTard(i => {
  const f = i.closest('form'); if (!f) return;
  let box = f.parentElement.querySelector(':scope > .sugg');
  const q = i.value.trim();
  if (!q) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'sugg card'; f.after(box); }
  const l = suggestionsBiens(q);
  box.innerHTML = l.length ? l.slice(0, 5).map(p => `<a class="trow" href="#/property/${p.id}"><div class="txt" style="min-width:0"><b>${esc(p.title)}</b><div class="sub">${esc(p.quartier)}, ${esc(p.city)} · ${money(p.price)}</div></div>${icon('arrowRight', 16)}</a>`).join('')
      + `<button type="button" class="linkbtn small sugg-all" data-action="sugg-all">Voir les ${l.length} résultat${l.length > 1 ? 's' : ''}</button>`
    : `<p class="small muted" style="margin:4px 6px">Aucun bien ne correspond à « ${esc(q)} ».</p>`;
}, 150);
document.addEventListener('input', e => {
  const i = e.target.closest && e.target.closest('form[data-action="home-search"] [name="q"]');
  if (i) suggerer(i);
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="sugg-all"]');
  if (b) { const f = b.closest('.sugg').previousElementSibling; if (f && f.requestSubmit) f.requestSubmit(); return; }
  if (!e.target.closest('.sugg, form[data-action="home-search"]')) document.querySelectorAll('.sugg').forEach(x => x.remove());
});

document.head.insertAdjacentHTML('beforeend', `<style>
.sbar-n{margin:-6px 2px 12px}
.sugg{margin-top:8px;padding:6px;max-width:640px;position:relative;z-index:5}
.sugg .trow{border-radius:10px}
.sugg-all{display:block;margin:6px 10px 6px auto}
#gs-res:empty{display:none}
</style>`);

/* ==========================================================================
   99s-facile.js — téléphone et formulaires plus faciles.

   1. Menu du téléphone (☰) : rangé dans les mêmes rubriques que le menu de
      l'ordinateur (MENU_SIMPLE, js/99r-simple.js).
   2. Formulaires longs en étapes : bail, mandat de gestion, mandat de vente,
      devis / facture. Une étape à la fois, « Suivant » vérifie les champs
      obligatoires de l'étape ; le bouton d'enregistrement d'origine n'apparaît
      qu'à la dernière étape. Le formulaire et son envoi ne changent pas.
   Les listes en cartes sur téléphone sont dans css/07-simple.css.
   ========================================================================== */

/* --- 1. Menu du téléphone regroupé ------------------------------------------ */
(() => {
  const _openDrawer = openDrawer;
  openDrawer = function (links, foot) {
    _openDrawer(links, foot);
    try {
      const u = Auth.current(), cfg = typeof configMenuSimple === 'function' && configMenuSimple(u);
      const menu = cfg && MENUS[u.role];
      if (!cfg || !Array.isArray(links) || !menu || links.length !== menu.length || links.some((l, i) => l[0] !== menu[i][0])) return;
      const tiroir = document.querySelector('.sdrawer'); if (!tiroir) return;
      const liens = new Map();
      links.forEach(([h]) => { const a = tiroir.querySelector(`a[href="${CSS.escape(h)}"]`); if (a && !liens.has(h)) liens.set(h, a); });
      if (liens.size < 7) return;
      const nom = (h, a) => { if (cfg.noms[h]) { const s = a.querySelector('span'); if (s) s.textContent = cfg.noms[h]; } return a; };
      const pris = new Set(), frag = document.createDocumentFragment();
      const prendre = h => { if (!liens.has(h) || pris.has(h)) return null; pris.add(h); return nom(h, liens.get(h)); };
      const bas = cfg.bas.filter(h => liens.has(h)); bas.forEach(h => pris.add(h));
      cfg.plan.forEach(x => {
        if (typeof x === 'string') { const a = prendre(x); if (a) frag.appendChild(a); return; }
        const sous = x.liens.map(prendre).filter(Boolean); if (!sous.length) return;
        if (sous.length === 1) { frag.appendChild(sous[0]); return; }
        const actif = sous.some(a => a.classList.contains('active')), ouvert = actif || menuOuverts.has(x.g);
        const g = document.createElement('div'); g.className = 'ng' + (ouvert ? ' ouvert' : '') + (actif ? ' contient-actif' : '');
        g.innerHTML = `<button type="button" class="ng-t" data-ng="${x.g}" aria-expanded="${ouvert}">${icon(x.ic, 20)}<span class="ng-lib">${x.lib}</span><span class="ng-chev">${icon('arrowRight', 15)}</span></button><div class="ng-l"></div>`;
        sous.forEach(a => g.querySelector('.ng-l').appendChild(a));
        frag.appendChild(g);
      });
      [...liens.keys()].filter(h => !pris.has(h)).forEach(h => frag.appendChild(nom(h, liens.get(h))));
      if (bas.length) { const b = document.createElement('div'); b.className = 'ng-bas'; bas.forEach(h => b.appendChild(nom(h, liens.get(h)))); frag.appendChild(b); }
      const logo = tiroir.querySelector('.logo');
      (logo ? logo.after.bind(logo) : tiroir.prepend.bind(tiroir))(frag);
      tiroir.classList.add('tiroir-simple');
    } catch (e) {}
  };
})();


/* --- 2. Formulaires en étapes ------------------------------------------------
   Pour chaque formulaire (data-action) : les étapes, et les champs (name) de chacune
   (texte exact ou expression). Un bloc .field sans champ connu suit l'étape du
   bloc précédent ; ce qui n'est pas un .field (titres, totaux) reste visible. */
const ETAPES_FORM = {
  'g-lease': [
    {titre: 'Le logement et le locataire', champs: ['propertyId', 'unitId', 'tenant', 'phone', 'email']},
    {titre: 'Le loyer et les dates', champs: ['rent', 'deposit', 'charges', 'start', 'months', 'dueDay']}],
  'm-new': [
    {titre: 'Le propriétaire et les conditions', champs: ['ownerId2', 'rate', 'start', 'end']},
    {titre: 'Les biens confiés', champs: [/^p_/]},
    {titre: 'Les services', champs: [/^s_/]}],
  'ag-mv-new': [
    {titre: 'Le vendeur et le bien', champs: ['ownerId2', 'propertyId', 'price']},
    {titre: 'Honoraires et durée', champs: ['rate', 'payer', 'exclusif', 'start', 'end']}],
  'g2-save-doc': [
    {titre: 'Le client', champs: ['client', 'clientPhone', 'clientAddress', 'clientId', 'propertyId']},
    {titre: 'Ce que vous facturez', champs: [/^[lqp]\d+$/]},
    {titre: 'TVA, remise et échéance', champs: ['tax', 'discount', 'days']}]
};
const champVa = (nom, regles) => regles.some(r => typeof r === 'string' ? r === nom : r.test(nom));

function mettreEnEtapes(form) {
  const cfg = ETAPES_FORM[form.dataset.action]; if (!cfg || form.dataset.etapes) return;
  const blocs = [...form.querySelectorAll('.field')].filter(f => !f.parentElement.closest('.field'));
  if (blocs.length < 5) return;
  let courant = 0; const parEtape = cfg.map(() => []);
  blocs.forEach(b => {
    const noms = [...b.querySelectorAll('[name]')].map(x => x.name);
    const i = cfg.findIndex(e => noms.some(n => champVa(n, e.champs)));
    if (i >= 0) courant = i;
    parEtape[courant].push(b);
  });
  if (parEtape.filter(x => x.length).length < 2) return;
  /* Ce qui accompagne une étape sans être un .field (ex. « + Ajouter une ligne ») la suit. */
  form.querySelectorAll('[data-action*="line"], [data-action*="ligne"]').forEach(x => { if (!x.closest('.field')) parEtape[1] && parEtape[1].push(x); });
  form.dataset.etapes = '1';
  const envoi = [...form.querySelectorAll('button:not([type="button"]), [type="submit"]')].pop();
  const tete = document.createElement('div'); tete.className = 'et-tete';
  const pied = document.createElement('div'); pied.className = 'et-pied';
  pied.innerHTML = '<button type="button" class="btn ghost" data-et="prec">Retour</button><button type="button" class="btn" data-et="suiv">Suivant</button>';
  const premier = blocs[0], hautPremier = premier && [...form.children].find(c => c.contains(premier));
  if (hautPremier) hautPremier.before(tete); else form.prepend(tete);
  const hautEnvoi = envoi && [...form.children].find(c => c.contains(envoi));
  if (hautEnvoi && hautEnvoi !== envoi) hautEnvoi.before(pied); else if (envoi) envoi.before(pied); else form.appendChild(pied);
  const etapes = cfg.map((e, i) => ({...e, blocs: parEtape[i]})).filter(e => e.blocs.length);
  let n = 0;
  /* Blocs ajoutés après coup par un autre module : ils suivent le bloc connu qui les précède. */
  const rattacher = () => {
    const connus = new Map(); etapes.forEach((e, k) => e.blocs.forEach(b => connus.set(b, k)));
    let k = 0;
    [...form.querySelectorAll('.field')].filter(f => !f.parentElement.closest('.field')).forEach(f => {
      if (connus.has(f)) { k = connus.get(f); return; }
      const noms = [...f.querySelectorAll('[name]')].map(x => x.name), j = etapes.findIndex(e => noms.some(nm => champVa(nm, e.champs)));
      if (j >= 0) k = j; etapes[k].blocs.push(f); connus.set(f, k);
    });
  };
  const montrer = i => {
    n = i; rattacher();
    etapes.forEach((e, k) => e.blocs.forEach(b => { b.hidden = k !== i; }));
    tete.innerHTML = `<div class="et-num">Étape ${i + 1} sur ${etapes.length}</div><div class="et-titre">${esc(etapes[i].titre)}</div>
      <div class="et-points">${etapes.map((_, k) => `<i class="${k < i ? 'fait' : k === i ? 'ici' : ''}"></i>`).join('')}</div>`;
    pied.querySelector('[data-et="prec"]').hidden = i === 0;
    pied.querySelector('[data-et="suiv"]').hidden = i === etapes.length - 1;
    if (envoi) envoi.hidden = i !== etapes.length - 1;
    const champ = etapes[i].blocs.map(b => b.querySelector('input:not([type=hidden]):not([disabled]),select,textarea')).find(Boolean);
    if (champ && form.isConnected && i > 0) setTimeout(() => { try { champ.focus({preventScroll: true}); } catch (e) {} }, 30);
    const boite = form.closest('.modal-body, .modal') ; if (boite) boite.scrollTop = 0;
  };
  const etapeValide = () => {
    for (const b of etapes[n].blocs) for (const x of b.querySelectorAll('input,select,textarea')) if (!x.disabled && x.willValidate && !x.checkValidity()) { x.reportValidity(); return false; }
    return true;
  };
  pied.addEventListener('click', e => {
    const b = e.target.closest('[data-et]'); if (!b) return;
    if (b.dataset.et === 'suiv') { if (etapeValide()) montrer(Math.min(n + 1, etapes.length - 1)); }
    else montrer(Math.max(0, n - 1));
  });
  /* Entrée avant la dernière étape : on passe à l'étape suivante au lieu d'envoyer. */
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && n < etapes.length - 1 && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); if (etapeValide()) montrer(n + 1); }
  });
  /* Envoi refusé par le navigateur sur un champ d'une autre étape : on y retourne. */
  form.addEventListener('invalid', e => {
    const k = etapes.findIndex(et => et.blocs.some(b => b.contains(e.target)));
    if (k >= 0 && k !== n) montrer(k);
  }, true);
  montrer(0);
}
new MutationObserver(() => {
  document.querySelectorAll('form[data-action]:not([data-etapes])').forEach(f => { if (ETAPES_FORM[f.dataset.action]) try { mettreEnEtapes(f); } catch (e) {} });
}).observe(document.body, {childList: true, subtree: true});


/* --- 3. Loyers regroupés par personne -----------------------------------------
   Sur « Loyers » (agence et propriétaire) : une carte par locataire au lieu d'une
   ligne par mois. Le total dû, le retard en jours, le bien, et deux gros boutons
   (Relancer, Encaisser) qui agissent sur le plus ancien loyer impayé — ce sont les
   boutons d'origine (mêmes data-action / data-id). « Détail par mois » montre les
   mois impayés de la personne ; l'onglet « Par mois » rend le tableau habituel. */
let vueLoyers = 'personne';
try { if (localStorage.getItem('deuksil-vue-loyers') === 'mois') vueLoyers = 'mois'; } catch (e) {}
const ouvertsLoyers = new Set();

function groupesLoyers(u) {
  const rents = (() => { try { return gMine('rents', u); } catch (e) { return []; } })();
  const leases = (() => { try { return gMine('leases', u); } catch (e) { return []; } })();
  const auj = new Date(), mc = auj.getFullYear() + '-' + String(auj.getMonth() + 1).padStart(2, '0');
  const g = new Map();
  rents.forEach(r => { const k = r.leaseId || ('x' + r.id); if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
  return [...g.entries()].map(([k, rs]) => {
    const l = leases.find(x => x.id === k) || {}, p = DB.findItem(DB.K.properties, l.propertyId || (rs[0] || {}).propertyId) || {};
    const du = +l.dueDay || 5;
    const impayes = rs.filter(r => rRest(r) > 0 && r.month && r.month <= mc).sort((a, b) => a.month < b.month ? -1 : 1);
    const reste = impayes.reduce((s, r) => s + rRest(r), 0), vieux = impayes[0];
    let ton = 'ok', etat = 'À jour', jours = 0;
    if (vieux) {
      const [ya, mo] = vieux.month.split('-').map(Number), ech = new Date(ya, mo - 1, Math.min(du, new Date(ya, mo, 0).getDate()));
      jours = Math.floor((auj - ech) / 864e5);
      if (jours > 0) { ton = 'bad'; etat = `En retard de ${jours} jour${jours > 1 ? 's' : ''}`; }
      else { ton = 'warn'; etat = 'À payer avant le ' + ech.toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}); }
    }
    const dernier = rs.filter(r => r.paidAt).sort((a, b) => a.paidAt < b.paidAt ? 1 : -1)[0];
    return {k, nom: l.tenant || 'Locataire', bien: [p.title, p.quartier].filter(Boolean).join(' · '), reste, impayes, vieux, ton, etat, jours, dernier, actif: l.status !== 'termine'};
  }).filter(x => x.impayes.length || x.actif);
}

function carteLoyer(x) {
  const btns = x.vieux ? `<div class="lg-btns"><button type="button" class="btn ghost" data-action="relance-interne" data-id="${x.vieux.id}">Relancer</button><button type="button" class="btn" data-action="g-pay" data-id="${x.vieux.id}">Encaisser</button></div>` : '';
  const plus = x.impayes.length > 1 ? `<button type="button" class="lg-detail" data-lg="${esc(x.k)}" aria-expanded="${ouvertsLoyers.has(x.k)}">${x.impayes.length} mois impayés · détail par mois</button>
    <ul class="lg-mois"${ouvertsLoyers.has(x.k) ? '' : ' hidden'}>${x.impayes.map(r => `<li><span>${monthLabel(r.month)}</span><b>${money(rRest(r))}</b><button type="button" class="btn sm" data-action="g-pay" data-id="${r.id}">Encaisser</button></li>`).join('')}</ul>` : '';
  return `<article class="lg-carte" data-ton="${x.ton}">
    <div class="lg-haut"><b class="lg-nom">${esc(x.nom)}</b><b class="lg-montant">${x.reste ? money(x.reste) : ''}</b></div>
    <div class="lg-etat">${x.ton === 'ok' ? (x.dernier ? 'À jour · dernier paiement ' + monthLabel(x.dernier.month) : 'À jour') : esc(x.etat)}</div>
    ${x.bien ? `<div class="lg-bien">${esc(x.bien)}</div>` : ''}${btns}${plus}</article>`;
}

function vuePersonnes(u) {
  const G = groupesLoyers(u); if (!G.length) return '';
  const du = G.filter(x => x.impayes.length).sort((a, b) => b.jours - a.jours || b.reste - a.reste), ok = G.filter(x => !x.impayes.length);
  return `<div class="lg-vue">
    ${du.length ? `<h3 class="lg-titre">À encaisser <span>${du.length}</span></h3><div class="lg-liste">${du.map(carteLoyer).join('')}</div>` : '<p class="lg-vide">Tous les loyers sont encaissés.</p>'}
    ${ok.length ? `<h3 class="lg-titre ok">À jour <span>${ok.length}</span></h3><div class="lg-liste">${ok.map(carteLoyer).join('')}</div>` : ''}
  </div>`;
}

function poserVueLoyers() {
  if (!/^#\/manage\/rents(\?|$)/.test(location.hash)) return;
  const u = Auth.current(); if (!u || !['agency', 'owner'].includes(u.role)) return;
  const c = document.querySelector('.main > .content'); if (!c) return;
  const wrap = c.querySelector('.table-wrap'); if (!wrap || c.querySelector('.lg-bascule')) return;
  const html = vuePersonnes(u); if (!html) return;
  const bascule = document.createElement('div'); bascule.className = 'lg-bascule'; bascule.setAttribute('role', 'group'); bascule.setAttribute('aria-label', 'Affichage des loyers');
  bascule.innerHTML = `<button type="button" data-vue-loyers="personne" aria-pressed="${vueLoyers === 'personne'}">Par personne</button><button type="button" data-vue-loyers="mois" aria-pressed="${vueLoyers === 'mois'}">Par mois</button>`;
  const ancre = c.querySelector('.rfiltre') || c.querySelector('.kpis') || wrap;
  ancre.before(bascule);
  const vue = document.createElement('div'); vue.innerHTML = html; const el = vue.firstElementChild;
  wrap.before(el);
  appliquerVueLoyers();
}
function appliquerVueLoyers() {
  const c = document.querySelector('.main > .content'); if (!c) return;
  const pers = vueLoyers === 'personne';
  c.classList.toggle('lg-mode-personne', pers);
  c.querySelectorAll('[data-vue-loyers]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vueLoyers === vueLoyers)));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-vue-loyers]');
  if (b) { vueLoyers = b.dataset.vueLoyers; try { localStorage.setItem('deuksil-vue-loyers', vueLoyers); } catch (err) {} appliquerVueLoyers(); return; }
  const d = e.target.closest('.lg-detail');
  if (d) { const ul = d.nextElementSibling, o = ul.hidden; ul.hidden = !o; d.setAttribute('aria-expanded', String(o)); if (o) ouvertsLoyers.add(d.dataset.lg); else ouvertsLoyers.delete(d.dataset.lg); }
});
/* Un lien « loyers en retard » (?f=retard) ouvre la vue par personne ; « encaissés » la vue par mois. */
window.addEventListener('hashchange', () => { if (/^#\/manage\/rents\?.*f=(paye|avenir)/.test(location.hash)) vueLoyers = 'mois'; });
new MutationObserver(() => { try { poserVueLoyers(); } catch (e) {} }).observe(document.body, {childList: true, subtree: true});

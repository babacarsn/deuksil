/* =========================================================================
   98b-finitions.js — Audit et finalisation de la démo
   1. Fin de bail : le bien n'est pas remis en location sans confirmation.
   2. Cohérence des statuts au chargement (bien « loué » sans bail).
   3. Fiche publique : un bien non disponible ne propose ni visite ni contact.
   4. Titres : un seul H1 par page (fiche, inscription).
   5. Adresses publiques propres : #/annonce/<titre>-<référence opaque>.
   6. Référencement : titre, description, canonique, partage, robots, JSON-LD.
   7. Retour à la page demandée après connexion (accès direct à une route).
   8. Locataire : « Messages » dans la barre du bas, avec le compteur non lu.
   Rappel : masquer un identifiant dans l'adresse n'est pas une sécurité ;
   les contrôles d'accès réels seront faits par le serveur.
   ========================================================================= */

/* --- 1. Fin de bail ---------------------------------------------------------- */
STATUS_LABEL.liberation = 'Libération à confirmer'; STATUS_TONE.liberation = 'warn';
let LIBERATION_CONFIRMEE = false;
const _terminerBailFin = terminerBail;
terminerBail = function (l, fin) {
  const r = _terminerBailFin(l, fin);
  if (l && !l.unitId) {
    const p = gProp(l.propertyId);
    if (p && p.status === 'disponible' && !LIBERATION_CONFIRMEE) {
      DB.updateItem(DB.K.properties, p.id, {status: 'liberation'});
      try { notify(p.ownerId, `Fin du bail de ${l.tenant} : confirmez la libération de « ${p.title} » pour le remettre en location.`, roleLink(p.ownerId, 'properties')); } catch (e) {}
    }
  }
  LIBERATION_CONFIRMEE = false;
  return r;
};
new MutationObserver(() => {
  const f = document.querySelector('form[data-action="g-end-lease-ok"]:not([data-lib])'); if (!f) return;
  f.dataset.lib = '1';
  const pied = f.querySelector('.row:last-of-type');
  const c = document.createElement('label'); c.className = 'check small fin-libere';
  c.innerHTML = '<input type="checkbox" name="libere"> Le logement est libéré (état des lieux de sortie fait) : le remettre en location';
  f.insertBefore(c, pied);
}).observe(document.getElementById('modal-root') || document.body, {childList: true, subtree: true});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="g-end-lease-ok"]'); if (!f) return;
  LIBERATION_CONFIRMEE = !!(f.querySelector('[name="libere"]') || {}).checked;
}, true);
/* Un bien en attente de libération ne s'affiche pas dans la recherche. */
const _applySearchFin = applySearch;
applySearch = function () { return _applySearchFin().filter(p => p.status !== 'liberation'); };

/* --- 2. Cohérence au chargement --------------------------------------------- */
function reparerStatuts() {
  try {
    const actifs = new Set(DB.getData(DB.K.leases).filter(l => l.status === 'actif').map(l => l.propertyId));
    const avecUnites = new Set((DB.getData(DB.K.units) || []).map(x => x.propertyId));
    DB.getData(DB.K.properties).filter(p => p.status === 'loue' && !actifs.has(p.id) && !avecUnites.has(p.id))
      .forEach(p => DB.updateItem(DB.K.properties, p.id, {status: 'liberation'}));
  } catch (e) {}
}

/* --- 5. Adresses publiques --------------------------------------------------- */
function refPublique(id) {
  let h = 2166136261; const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36).padStart(7, '0').slice(-7);
}
const slugTitre = t => String(t || 'bien').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/m²/g, 'm2').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'bien';
function annonceHref(p) { return p ? `#/annonce/${slugTitre(p.title)}-${refPublique(p.id)}` : '#/search'; }
function bienDeRef(ref) { return DB.getData(DB.K.properties).find(p => refPublique(p.id) === ref) || null; }
const routeFiche = () => routes.find(r => r.re.source === '^\\/property\\/([\\w]+)$');
routes.unshift({re: /^\/annonce\/([a-z0-9-]+)$/, fn: s => {
  const p = bienDeRef(String(s).split('-').pop());
  return routeFiche().fn(p ? p.id : '__introuvable');
}});

/* --- 3 et 4. Fiche publique ------------------------------------------------- */
const DISPO = ['disponible', 'discussion'];
(() => {
  const r = routeFiche(); if (!r) return;
  const f = r.fn;
  r.fn = id => {
    let h = f(id); if (typeof h !== 'string') return h;
    const p = DB.findItem(DB.K.properties, id); if (!p) return h;
    h = h.replace(/<div class="row-between"><h2>([\s\S]*?)<\/h2>/, '<div class="row-between"><h1 class="pd-titre">$1</h1>');
    const libre = DISPO.includes(p.status) && p.listingStatus === 'publiee';
    if (!libre) {
      const motif = p.status === 'vendu' ? 'a été vendu' : p.status === 'loue' ? 'est loué' : p.listingStatus !== 'publiee' ? 'n\'est plus en ligne' : 'n\'est pas disponible pour le moment';
      h = h.replace(/<div class="stack" style="margin-top:16px">[\s\S]*?data-action="ask-visit"[^>]*>[^<]*<\/button>(\s*<button[^>]*data-action="g5-report"[\s\S]*?<\/button>)?\s*<\/div>/,
        `<div class="pd-indispo">${icon('alert', 18)}<div><b>Ce bien ${motif}.</b><span>Les visites et les contacts sont fermés pour cette annonce.</span></div></div>
         <a class="btn block" href="#/search" style="margin-top:12px">${icon('search', 16)} Voir les biens disponibles</a>`)
        .replace(/<p class="small muted" style="margin:14px 0 0">Disponible à partir du [^<]*<\/p>/, '');
    }
    return h;
  };
})();
(() => {
  const r = routes.find(x => x.re.source.includes('register')); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => { const h = f(...a); return typeof h === 'string' && !/<h1/.test(h) ? h.replace('<form data-action="register" id="wiz">', '<form data-action="register" id="wiz"><h1 class="vh">Créer un compte DEUKSIL</h1>') : h; };
})();

/* --- 6. Référencement -------------------------------------------------------- */
const PRIVE = /^#\/(client|owner|agency|admin|tenant|manage|coffre|bien\/|mandant|agent|guide-demo|mot-de-passe|notifications|profil)/;
function meta(sel, attr, nom, val) {
  let m = document.head.querySelector(sel);
  if (!m) { m = document.createElement(sel.startsWith('link') ? 'link' : 'meta'); m.setAttribute(attr, nom); if (sel.startsWith('link')) m.rel = nom; document.head.appendChild(m); }
  m.setAttribute(sel.startsWith('link') ? 'href' : 'content', val);
}
function poserSEO({titre, desc, robots = 'index,follow', image = '', type = 'website', jsonld = null}) {
  document.title = titre;
  const url = location.href.split('?')[0];
  meta('meta[name="description"]', 'name', 'description', desc);
  meta('meta[name="robots"]', 'name', 'robots', robots);
  meta('link[rel="canonical"]', 'rel', 'canonical', url);
  meta('meta[property="og:title"]', 'property', 'og:title', titre);
  meta('meta[property="og:description"]', 'property', 'og:description', desc);
  meta('meta[property="og:url"]', 'property', 'og:url', url);
  meta('meta[property="og:type"]', 'property', 'og:type', type);
  meta('meta[property="og:image"]', 'property', 'og:image', image || new URL('img/icone-512.png', location.href).href);
  meta('meta[name="twitter:card"]', 'name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  let s = document.getElementById('jsonld-page');
  if (jsonld) { if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'jsonld-page'; document.head.appendChild(s); } s.textContent = JSON.stringify(jsonld); }
  else if (s) s.remove();
}
const texteCourt = (t, n = 155) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
function seoDeLaPage() {
  const h = location.hash || '#/', u = Auth.current();
  const tPage = ((document.querySelector('#app h1, #app .page-head h1, #app .page-head h2') || {}).textContent || '').trim();
  const m = h.match(/^#\/(?:annonce\/[a-z0-9-]+-([a-z0-9]{7})|property\/(\w+))$/);
  if (m) {
    const p = m[1] ? bienDeRef(m[1]) : DB.findItem(DB.K.properties, m[2]);
    if (p) {
      const libre = DISPO.includes(p.status) && p.listingStatus === 'publiee';
      const prix = money(p.price) + (p.transaction === 'location' ? ' / mois' : '');
      const lieu = [p.quartier, p.city].filter(Boolean).join(', ');
      const img = ((p.photos && p.photos[0]) || (p.type ? demoPhotos(p)[0] : '') || '');
      const imgAbs = img && !/^data:/.test(img) ? new URL(img, location.href).href : '';
      return poserSEO({titre: `${p.title} — ${prix} · ${lieu} | DEUKSIL`, type: 'product', image: imgAbs,
        desc: texteCourt(`${p.transaction === 'location' ? 'À louer' : 'À vendre'} à ${lieu} : ${p.title}, ${p.surface} m², ${prix}. ${p.description || ''}`),
        robots: libre ? 'index,follow' : 'noindex,follow',
        jsonld: {'@context': 'https://schema.org', '@type': 'RealEstateListing', name: p.title, description: texteCourt(p.description, 300), url: location.href.split('?')[0],
          image: imgAbs || undefined, datePosted: String(p.createdAt || '').slice(0, 10) || undefined,
          offers: {'@type': 'Offer', price: p.price, priceCurrency: 'XOF', availability: libre ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
            businessFunction: p.transaction === 'location' ? 'https://purl.org/goodrelations/v1#LeaseOut' : 'https://purl.org/goodrelations/v1#Sell'},
          address: {'@type': 'PostalAddress', addressLocality: p.city, addressRegion: p.region, streetAddress: p.quartier, addressCountry: 'SN'},
          floorSize: p.surface ? {'@type': 'QuantitativeValue', value: p.surface, unitCode: 'MTK'} : undefined}});
    }
    return poserSEO({titre: 'Annonce introuvable | DEUKSIL', desc: 'Cette annonce n\'existe plus sur DEUKSIL.', robots: 'noindex,follow'});
  }
  if (h === '#/' || h === '#') return poserSEO({titre: 'DEUKSIL — Location, vente et terrains au Sénégal',
    desc: 'Trouvez un appartement, une maison, un terrain ou un local au Sénégal. Annonces vérifiées, propriétaires et agences identifiés, visites organisées en ligne.',
    jsonld: {'@context': 'https://schema.org', '@type': 'WebSite', name: 'DEUKSIL', url: location.href.split('#')[0], inLanguage: 'fr-SN',
      potentialAction: {'@type': 'SearchAction', target: location.href.split('#')[0] + '#/search?q={q}', 'query-input': 'required name=q'}}});
  if (/^#\/search/.test(h)) {
    const n = (typeof applySearch === 'function' ? applySearch().length : 0);
    return poserSEO({titre: 'Rechercher un bien à louer ou à vendre au Sénégal | DEUKSIL',
      desc: `${n} annonces vérifiées : appartements, maisons, villas, terrains et locaux à Dakar et dans toutes les régions du Sénégal. Filtrez par ville, budget et type de bien.`});
  }
  if (/^#\/login/.test(h)) return poserSEO({titre: 'Connexion | DEUKSIL', desc: 'Connectez-vous à votre espace DEUKSIL : client, propriétaire ou agence.', robots: 'noindex,follow'});
  if (/^#\/register/.test(h)) return poserSEO({titre: 'Créer un compte client, propriétaire ou agence | DEUKSIL', desc: 'Inscription gratuite sur DEUKSIL : cherchez un logement, publiez vos biens ou gérez votre agence.'});
  if (PRIVE.test(h) || (u && document.querySelector('.sidebar'))) {
    return poserSEO({titre: `${tPage || 'Mon espace'} · Espace ${typeof roleName === 'function' && u ? roleName(u) : 'privé'} | DEUKSIL`, desc: 'Espace privé DEUKSIL.', robots: 'noindex,nofollow'});
  }
  return poserSEO({titre: `${tPage || 'DEUKSIL'} | DEUKSIL`, desc: texteCourt((document.querySelector('#app p') || {}).textContent || 'DEUKSIL, plateforme immobilière du Sénégal.')});
}

/* --- Après chaque affichage : adresses propres, liens, référencement ---------- */
const _afterRenderFin = afterRender;
afterRender = function () {
  reparerStatuts();
  const r = _afterRenderFin.apply(this, arguments);
  try {
    const m = (location.hash || '').match(/^#\/property\/(\w+)$/);
    if (m) { const p = DB.findItem(DB.K.properties, m[1]); if (p) history.replaceState(history.state, '', location.href.split('#')[0] + annonceHref(p)); }
    document.querySelectorAll('#app a[href^="#/property/"], #modal-root a[href^="#/property/"]').forEach(a => {
      const p = DB.findItem(DB.K.properties, a.getAttribute('href').slice(11)); if (p) a.setAttribute('href', annonceHref(p));
    });
    seoDeLaPage();
  } catch (e) {}
  return r;
};

/* --- 7. Retour après connexion ------------------------------------------------ */
const CLE_RETOUR_ACCES = 'deuksil_retour';
const _guardFin = Auth.guard;
Auth.guard = function (role) {
  if (!this.current()) { try { sessionStorage.setItem(CLE_RETOUR_ACCES, location.hash); } catch (e) {} }
  return _guardFin.call(this, role);
};
const _goAcces = go;
go = function (h) {
  const u = Auth.current(); let r = null;
  try { r = sessionStorage.getItem(CLE_RETOUR_ACCES); } catch (e) {}
  if (r && u && h === Auth.home(u)) {
    try { sessionStorage.removeItem(CLE_RETOUR_ACCES); } catch (e) {}
    const espace = (r.match(/^#\/(client|owner|agency|admin|tenant)\//) || [])[1];
    const permis = !espace || espace === u.role || (espace === 'tenant' && u.role === 'client') || (espace === 'owner' && u.role === 'agency' && /property\//.test(r));
    if (permis && !/^#\/(login|register)/.test(r)) return _goAcces(r);
  }
  return _goAcces(h);
};

/* --- 8. Locataire : Messages dans la barre du bas ------------------------------ */
const _tabBarFin = tabBarHtml;
tabBarHtml = function (u, path) {
  const h = _tabBarFin(u, path);
  if (!u || typeof h !== 'string' || /href="#\/(client|tenant|owner|agency)\/messages"/.test(h)) return h;
  const msg = (MENUS[u.role] || []).find(m => /\/messages$/.test(m[0])); if (!msg) return h;
  const n = (typeof sidebarBadge === 'function' && (sidebarBadge(u, msg[0]) || {}).n) || 0;
  const actif = path === msg[0].slice(1);
  return h.replace(/<a href="#\/tenant\/quittances"[^>]*>[\s\S]*?<\/a>/,
    `<a href="${msg[0]}" class="tab-item ${actif ? 'active' : ''}">${icon('message', 21)}<span>Messages</span>${n ? `<b class="tab-n">${n}</b>` : ''}</a>`);
};

/* Formulaire d'un bien : un titre de page (lu par les lecteurs d'écran). */
(() => {
  const r = routes.find(x => x.re.source.includes('property') && x.re.source.includes('new')); if (!r) return;
  const f = r.fn;
  r.fn = pid => { const h = f(pid); return typeof h === 'string' && !/<h1/.test(h) ? h.replace(/<form /, `<h1 class="vh">${pid === 'new' ? 'Ajouter un bien' : 'Modifier le bien'}</h1><form `) : h; };
})();

/* Liens ajoutés après l'affichage (sections injectées) : même adresse propre. */
new MutationObserver(() => requestAnimationFrame(() => {
  document.querySelectorAll('#app a[href^="#/property/"], #modal-root a[href^="#/property/"]').forEach(a => {
    const p = DB.findItem(DB.K.properties, a.getAttribute('href').slice(11)); if (p) a.setAttribute('href', annonceHref(p));
  });
})).observe(document.body, {childList: true, subtree: true});

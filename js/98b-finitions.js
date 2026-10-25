/* =========================================================================
   98b-finitions.js — Finitions
   1. Fin de bail : le bien n'est pas remis en location sans confirmation.
   3. Fiche publique : un bien non disponible ne propose ni visite ni contact.
   4. Titres : un seul H1 par page (fiche, inscription).
   5. Adresses publiques propres : #/annonce/<titre>-<référence opaque>.
   6. Référencement : titre, description, canonique, partage, robots, JSON-LD.
   7. Retour à la page demandée après connexion (accès direct à une route).
   8. Locataire : « Messages » dans la barre du bas, avec le compteur non lu.
   Rappel : masquer un identifiant dans l'adresse n'est pas une sécurité ;
   les contrôles d'accès réels sont faits par la base (RLS).
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
const PRIVE = /^#\/(client|owner|agency|admin|tenant|manage|coffre|bien\/|mandant|agent|mot-de-passe|notifications|profil)/;
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
      const img = ((p.photos && p.photos[0]) || '' || '');
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

/* --- 9. Recette AG4 : confier une demande client à un collègue ----------------
   L'agent (ou le responsable) passe un client qu'il suit à un autre agent :
   la demande disparaît de ses demandes et apparaît chez le collègue, prévenu. */
const peutConfierDemande = (u, dm) => !!(u && u.role === 'agency' && dm && dm.ownerId === u.id && dm.status !== 'close'
  && (!u.member || (u.member.role === 'agent' ? dm.agentId === u.member.id : memberCan(u, 'visites'))));
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/clients$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => {
    const h = f(...a); if (typeof h !== 'string') return h;
    const u = Auth.current();
    return h.replace(/<button class="btn ghost sm" data-action="ag-demande-close" data-id="([\w]+)">/g, (m, id) => {
      const dm = DB.findItem(DB.K.demandes, x => x.id === id);
      return (peutConfierDemande(u, dm) ? `<button class="btn ghost sm" data-action="ag-demande-confier" data-id="${id}">${icon('users', 14)} Confier</button>` : '') + m;
    });
  };
})();
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="ag-demande-confier"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(), dm = DB.findItem(DB.K.demandes, x => x.id === b.dataset.id);
  if (!peutConfierDemande(u, dm)) return toast('Vous ne suivez pas ce client.', 'bad');
  const equipe = membresDe(u).filter(m => m.role === 'agent' && m.status === 'actif' && m.id !== dm.agentId);
  if (!equipe.length) return toast('Aucun autre agent actif dans l\'équipe.', 'bad');
  modal('Confier le client', `<form data-action="ag-demande-confier-ok" data-id="${dm.id}">
    <p class="small muted" style="margin-top:0"><b>${esc(dm.name)}</b> · ${dm.transaction === 'location' ? 'Louer' : 'Acheter'} ${esc(dm.type || 'un bien')}${dm.lieu ? ' · ' + esc(dm.lieu) : ''}</p>
    <div class="field"><label for="dm-agent">Agent qui reprend le client</label><select class="input" id="dm-agent" name="agentId" required>${equipe.map(m => `<option value="${m.id}">${esc(m.firstName)} ${esc(m.lastName || '')}</option>`).join('')}</select></div>
    <div class="field"><label for="dm-note">Message pour le collègue (facultatif)</label><textarea class="input" id="dm-note" name="note" placeholder="Ce qu'il faut savoir sur ce client…"></textarea></div>
    <div class="row" style="gap:10px"><button class="btn">Confier</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
}, true);
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-demande-confier-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(), dm = DB.findItem(DB.K.demandes, x => x.id === f.dataset.id);
  if (!peutConfierDemande(u, dm)) { closeModal(); return toast('Vous ne suivez pas ce client.', 'bad'); }
  const d = formData(f), m = DB.findItem(DB.K.users, x => x.id === d.agentId && x.parentId === u.id && x.role === 'agent' && x.status === 'actif');
  if (!m) return toast('Agent inconnu.', 'bad');
  const de = u.member ? u.member.firstName : (u.agencyName || 'L\'agence');
  DB.updateItem(DB.K.demandes, dm.id, {agentId: m.id, confiePar: u.member ? u.member.id : u.id, confieLe: now()});
  notify(m.id, `${de} vous confie le client ${dm.name} (${dm.phone}).${(d.note || '').trim() ? ' Note : ' + d.note.trim().slice(0, 160) : ''}`, '#/agency/clients');
  try { audit('Client confié', `${dm.name} → ${m.firstName}`); } catch (err) {}
  closeModal(); toast(`${dm.name} est confié à ${m.firstName}.`); render();
}, true);
/* --- 10. Recette P6 : une visite à venir ne peut pas être « terminée » -------- */
const visiteFuture = id => { const v = DB.findItem(DB.K.visits, id); return !!(v && v.date && v.date > ymd()); };
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="visit-status"][data-s="terminee"]'); if (!b) return;
  if (!visiteFuture(b.dataset.id)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const v = DB.findItem(DB.K.visits, b.dataset.id);
  toast(`Cette visite est prévue le ${dateFr(v.date)} : vous pourrez la marquer terminée à partir de ce jour-là.`, 'bad');
}, true);
new MutationObserver(() => requestAnimationFrame(() => {
  document.querySelectorAll('#app [data-action="visit-status"][data-s="terminee"]:not([data-vf])').forEach(b => {
    b.dataset.vf = '1'; if (visiteFuture(b.dataset.id)) b.remove();
  });
})).observe(document.body, {childList: true, subtree: true});

/* --- 11. Recette P10 : le propriétaire demande lui-même à une agence ---------
   Jusqu'ici seule l'agence pouvait proposer le rattachement. Le propriétaire
   choisit maintenant une agence dans son profil ; l'agence accepte (en fixant
   sa commission) ou refuse. Rien n'est partagé avant l'acceptation. */
DB.K.demandesLien = DB.K.demandesLien || 'deuksil_demandes_lien';
const agencesDispo = () => DB.getData(DB.K.users).filter(a => a.role === 'agency' && !a.parentId && a.status !== 'suspendu' && !a.doublonDe);
const demandesLienDe = u => DB.getData(DB.K.demandesLien).filter(d => d.proprioId === u.id);
function carteConfierAgence(u) {
  const acc = typeof fichesAcceptees === 'function' ? fichesAcceptees(u) : [];
  const enCours = demandesLienDe(u).filter(d => d.statut === 'attente');
  const exclues = new Set([...acc.map(o => o.ownerId), ...enCours.map(d => d.agenceId)]);
  const choix = agencesDispo().filter(a => !exclues.has(a.id));
  return `<section class="card fin-confier" id="confier-agence" style="max-width:640px;margin-top:18px">
    <h4 style="margin-top:0">${icon('building', 17)} Confier la gestion à une agence</h4>
    <p class="small muted" style="margin:0 0 12px">L'agence reçoit votre demande et l'accepte en fixant sa commission. Vos biens restent à vous ; rien n'est partagé avant son accord.</p>
    ${acc.map(o => `<div class="av-row"><div class="av-t"><span class="itile sm ok">${icon('checkCircle', 17)}</span><div><b>${esc(nomAgence(o.ownerId))}</b><div class="small muted">Rattachement accepté · commission ${+o.rate || 0} %</div></div></div>
      <div class="av-b"><a class="btn ghost sm" href="#/mandant/releves">Relevés</a></div></div>`).join('')}
    ${enCours.map(d => `<div class="av-row"><div class="av-t"><span class="itile sm gold">${icon('clock', 17)}</span><div><b>${esc(nomAgence(d.agenceId))}</b><div class="small muted">Demande envoyée le ${dateFr(d.createdAt)} · en attente de réponse</div></div></div>
      <div class="av-b"><button class="btn ghost sm" data-action="lienp-annuler" data-id="${d.id}">Annuler</button></div></div>`).join('')}
    ${choix.length ? `<form data-action="lienp-envoyer" style="margin-top:10px">
      <div class="field"><label for="lienp-agence">Agence</label><select class="input" id="lienp-agence" name="agenceId" required>${choix.map(a => `<option value="${a.id}">${esc(a.agencyName || displayName(a))}${a.address ? ' · ' + esc(a.address) : ''}</option>`).join('')}</select></div>
      <div class="field"><label for="lienp-msg">Message (facultatif)</label><textarea class="input" id="lienp-msg" name="message" placeholder="Ex. : je souhaite confier la gestion de mes deux appartements de Mermoz."></textarea></div>
      <button class="btn">${icon('message', 16)} Envoyer la demande</button></form>` : '<p class="small muted">Aucune autre agence disponible pour le moment.</p>'}
  </section>`;
}
new MutationObserver(() => requestAnimationFrame(() => {
  const u = Auth.current(); if (!u || u.role !== 'owner' || u.member || location.hash !== '#/owner/profile') return;
  const c = document.querySelector('#app .content'); if (!c || c.querySelector('#confier-agence')) return;
  c.insertAdjacentHTML('beforeend', carteConfierAgence(u));
})).observe(document.body, {childList: true, subtree: true});
/* Raccourci depuis « Mes biens ». */
(() => {
  const r = routes.find(x => x.re.source === '^\\/owner\\/properties$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => {
    const h = f(...a); const u = Auth.current();
    if (typeof h !== 'string' || !u || u.role !== 'owner' || u.member || (typeof estMandant === 'function' && estMandant(u))) return h;
    return h.replace(/(<div class="page-head">[\s\S]*?<div class="row">)/, `$1<a class="btn ghost" href="#/owner/profile?s=confier-agence">${icon('building', 16)} Confier à une agence</a>`);
  };
})();
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="lienp-envoyer"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'owner' || u.member) return;
  const d = formData(f), ag = agencesDispo().find(a => a.id === d.agenceId); if (!ag) return toast('Choisissez une agence.', 'bad');
  if (demandesLienDe(u).some(x => x.agenceId === ag.id && x.statut === 'attente')) return toast('Une demande est déjà en attente chez cette agence.', 'bad');
  const dm = DB.addItem(DB.K.demandesLien, {proprioId: u.id, agenceId: ag.id, message: (d.message || '').trim().slice(0, 500), statut: 'attente'});
  notify(ag.id, `${displayName(u)} souhaite vous confier la gestion de ses biens : acceptez ou refusez sa demande.`, '#/manage/owners?s=demandes-proprietaires');
  logActivity(`${displayName(u)} a demandé à ${ag.agencyName || displayName(ag)} de gérer ses biens`);
  toast(`Demande envoyée à ${ag.agencyName || displayName(ag)}.`); render();
  return dm;
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="lienp-annuler"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(), d = DB.findItem(DB.K.demandesLien, x => x.id === b.dataset.id && x.proprioId === (u || {}).id && x.statut === 'attente'); if (!d) return;
  DB.updateItem(DB.K.demandesLien, d.id, {statut: 'annulee'}); toast('Demande annulée.'); render();
});
/* Côté agence : la liste des demandes, en tête de « Propriétaires ». */
function blocDemandesProprietaires(u) {
  const L = DB.getData(DB.K.demandesLien).filter(d => d.agenceId === u.id && d.statut === 'attente'); if (!L.length) return '';
  return `<section class="card fin-lien" id="demandes-proprietaires" style="margin-bottom:16px"><h4 style="margin-top:0">${icon('users', 17)} Demandes de propriétaires <span class="badge warn">${L.length}</span></h4>
    ${L.map(d => { const p = DB.findItem(DB.K.users, d.proprioId) || {}, n = DB.filterItems(DB.K.properties, x => x.ownerId === p.id).length;
      return `<form class="av-row" data-action="lienp-repondre" data-id="${d.id}"><div class="av-t"><span class="itile sm gold">${icon('user', 17)}</span><div style="min-width:0"><b>${esc(displayName(p))}</b>
        <div class="small muted">${esc(p.phone || '')} · ${pluriel(n, 'bien')} sur DEUKSIL · le ${dateFr(d.createdAt)}</div>${d.message ? `<div class="small" style="margin-top:4px">« ${esc(d.message)} »</div>` : ''}</div></div>
        <div class="av-b"><label class="small" style="display:flex;align-items:center;gap:6px">Commission <input class="input" name="rate" type="number" min="0" max="50" step="0.5" value="8" style="width:72px" aria-label="Commission de gestion en %"> %</label>
        <button class="btn sm" name="rep" value="ok">Accepter</button><button class="btn ghost sm" name="rep" value="non">Refuser</button></div></form>`; }).join('')}</section>`;
}
new MutationObserver(() => requestAnimationFrame(() => {
  const u = Auth.current(); if (!u || u.role !== 'agency' || !/^#\/manage\/owners/.test(location.hash)) return;
  if (u.member && !(typeof memberCan === 'function' && memberCan(u, 'gestion'))) return;
  const c = document.querySelector('#app .content'); if (!c || c.querySelector('#demandes-proprietaires')) return;
  const bloc = blocDemandesProprietaires(u); if (!bloc) return;
  const ph = c.querySelector('.page-head'); (ph || c.firstElementChild).insertAdjacentHTML('afterend', bloc);
})).observe(document.body, {childList: true, subtree: true});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="lienp-repondre"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency') return;
  const d = DB.findItem(DB.K.demandesLien, x => x.id === f.dataset.id && x.agenceId === u.id && x.statut === 'attente'); if (!d) return;
  const p = DB.findItem(DB.K.users, d.proprioId); if (!p) return;
  const ok = ((e.submitter || {}).value || 'ok') === 'ok';
  if (!ok) {
    DB.updateItem(DB.K.demandesLien, d.id, {statut: 'refusee', reponduLe: now()});
    notify(p.id, `${u.agencyName || 'L\'agence'} a décliné votre demande de gestion.`, '#/owner/profile');
    toast('Demande refusée : le propriétaire est prévenu.'); render(); return;
  }
  const rate = Math.min(50, Math.max(0, +formData(f).rate || 0));
  const ex = DB.findItem(DB.K.owners, o => o.ownerId === u.id && o.status !== 'close' && ((p.cni && o.cni === p.cni) || (tel9(o.phone).length === 9 && tel9(o.phone) === tel9(p.phone))));
  const fiche = ex ? DB.updateItem(DB.K.owners, ex.id, {compteId: p.id, lien: 'accepte', lienLe: now(), rate: ex.rate || rate})
    : DB.addItem(DB.K.owners, {ownerId: u.id, name: displayName(p), phone: p.phone || '', email: p.email || '', cni: p.cni || '', address: p.address || '', kind: 'Particulier', rate, compteId: p.id, lien: 'accepte', lienLe: now(), source: 'proprietaire'});
  DB.updateItem(DB.K.demandesLien, d.id, {statut: 'acceptee', reponduLe: now(), ficheId: fiche.id});
  notify(p.id, `${u.agencyName || 'L\'agence'} a accepté de gérer vos biens (commission ${fiche.rate} %). Vous suivrez ici les biens qu'elle gère pour vous.`, '#/owner/properties');
  try { audit('Propriétaire rattaché à sa demande', `${fiche.name} · ${fiche.rate} %`); } catch (err) {}
  toast(`${fiche.name} est maintenant votre mandant.`); render();
}, true);

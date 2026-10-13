/* ==========================================================================
   MODULE : accueil.js — page d'accueil et accueil du client d'après la
   maquette : photo de couverture plein cadre sous l'entête, titre
   « Trouvez votre prochain bien immobilier au Sénégal », barre de recherche
   à cheval sur la photo, cinq catégories, « Biens immobiliers en vedette »
   en trois cartes, encart « À la une » pour les bureaux et commerces.

   La photo de couverture (img/photos/couverture.jpg) est très claire à
   gauche (soleil, ciel) : un voile marine part de la gauche pour que le
   texte blanc reste lisible, et la maison reste visible à droite.
   ========================================================================== */

PHOTOS.couverture = 'img/photos/couverture.jpg';

/* --- 1. Les blocs ---------------------------------------------------------- */
/* [type, libellé, icône, libellé court pour téléphone] */
const HX_CATS = [['maison', 'Maisons', 'home', 'Maisons'], ['appartement', 'Appartements', 'building', 'Apparts'], ['terrain', 'Terrains', 'pin', 'Terrains'],
  ['local commercial', 'Locaux commerciaux', 'store', 'Locaux commerciaux'], ['', 'Biens à découvrir', 'grid', 'Biens à découvrir']];
const TYPE_FR = {appartement: 'Appartement', villa: 'Villa', maison: 'Maison', studio: 'Studio', chambre: 'Chambre', terrain: 'Terrain', bureau: 'Bureau', 'local commercial': 'Local commercial'};

function hxHero(u, interne) {
  return `<section class="hx${interne ? ' hx-in-app' : ''}" data-hx>
    <img class="hx-bg" src="${PHOTOS.couverture}" alt="" loading="eager">
    <div class="hx-body${interne ? '' : ' wrap'}">
      ${u ? `<p class="hx-hello">Bonjour, <b>${esc(u.firstName)}</b></p>` : ''}
      <p class="hx-loc">${icon('pin', 17)} Dakar, Sénégal</p>
      <h1>Trouvez votre prochain bien immobilier au <span>Sénégal</span></h1>
      <p class="hx-lede">Maisons, appartements, terrains, locaux commerciaux… Le bien qu'il vous faut, au bon endroit.</p>
    </div>
    <div class="hx-search${interne ? '' : ' wrap'}">${searchPill()}</div>
  </section>`;
}
function hxCats() {
  const actif = searchState.q ? null : (searchState.type || '');
  return `<nav class="hx-cats" aria-label="Catégories de biens">${HX_CATS.map(([t, l, ic, court]) =>
    `<a class="hx-cat${actif === t && (t || !searchState.pro) ? ' on' : ''}" href="#/search" data-action="home-cat" data-t="${t}">
      <span class="hx-ci">${icon(ic, 26)}</span><span class="hx-cl"><span class="lg">${l}</span><span class="sm">${court}</span></span></a>`).join('')}</nav>`;
}
/* Trois biens en vedette, de trois natures différentes quand c'est possible. */
function biensEnVedette(pubs) {
  const tri = [...pubs].sort((a, b) => (b.views || 0) - (a.views || 0)), out = [];
  [p => ['villa', 'maison'].includes(p.type), p => ['appartement', 'studio'].includes(p.type), p => p.transaction === 'terrain' || p.type === 'terrain']
    .forEach(f => { const p = tri.find(x => f(x) && !out.includes(x)); if (p) out.push(p); });
  tri.forEach(p => { if (out.length < 3 && !out.includes(p)) out.push(p); });
  return out.slice(0, 3);
}
function hxCarte(p, favIds) {
  const fav = favIds.includes(p.id), terrain = p.transaction === 'terrain' || p.type === 'terrain';
  return `<article class="hx-card">
    <div class="hx-ph"><img src="${esc(photoDe(p, PHOTOS.villa1))}" alt="" loading="lazy">
      <button class="hx-fav${fav ? ' on' : ''}" data-action="toggle-fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${icon('heart', 20, fav)}</button>
      <span class="hx-chip">${esc(TYPE_FR[p.type] || 'Bien')}</span></div>
    <div class="hx-cb">
      <h3>${esc(p.title)}</h3>
      <p class="hx-where">${icon('pin', 14)} ${esc(p.quartier)}, ${esc(p.city)}</p>
      <p class="hx-specs">${terrain ? '' : `<span>${icon('bed', 16)} ${p.rooms || 0} ch.</span>`}<span>${icon('area', 16)} ${p.surface} m²</span></p>
      <p class="hx-price">${money(p.price)}${p.transaction === 'location' ? ' <small>/ mois</small>' : ''}</p>
      <a class="hx-more" href="#/property/${p.id}">Voir plus ${icon('arrowRight', 16)}</a>
    </div></article>`;
}
function hxVedette(pubs, favIds) {
  const l = biensEnVedette(pubs);
  return `<section class="hx-sec"><div class="hx-head"><h2>Biens immobiliers en vedette</h2><a href="#/search">Voir tous ${icon('arrowRight', 18)}</a></div>
    ${l.length ? `<div class="hx-grid">${l.map(p => hxCarte(p, favIds)).join('')}</div>` : '<p class="muted">Aucune annonce en ligne pour le moment.</p>'}</section>`;
}
function hxUne(pubs) {
  const n = pubs.filter(p => ['bureau', 'local commercial'].includes(p.type)).length;
  return `<section class="hx-une">
    <div class="hx-une-ph"><img src="${PHOTOS.bureau}" alt="" loading="lazy"></div>
    <div class="hx-une-txt"><span class="hx-tag">À la une</span>
      <h2>Bureaux &amp; commerces près de vous</h2>
      <p>Des espaces professionnels pour développer votre activité dans les meilleurs quartiers du Sénégal.${n ? ` ${pluriel(n, 'local disponible', 'locaux disponibles')}.` : ''}</p>
      <a class="btn hx-go" href="#/search" data-action="home-pro">Découvrir ${icon('arrowRight', 16)}</a></div>
  </section>`;
}

/* « Bureaux & commerces » : deux types à la fois dans la recherche. */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-action="home-pro"]'); if (!a) return;
  e.preventDefault(); searchState = {...searchState, type: '', transaction: '', q: '', pro: true, page: 1}; go('#/search');
});
document.addEventListener('click', e => {
  const a = e.target.closest('[data-action="home-cat"], [data-action="reset-search"], [data-action="clear-chip"][data-k="pro"]');
  if (a && searchState.pro && !(a.dataset.action === 'home-pro')) searchState.pro = false;
}, true);
const _applySearch84 = applySearch;
applySearch = function () { const l = _applySearch84(); return searchState.pro ? l.filter(p => ['bureau', 'local commercial'].includes(p.type)) : l; };
const _activeChips84 = activeChips;
activeChips = function () { const c = _activeChips84(); if (searchState.pro) c.push(['pro', 'Bureaux & commerces']); return c; };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="clear-chip"][data-k="pro"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation(); searchState.pro = false; render();
}, true);

/* --- 2. La page d'accueil publique ----------------------------------------- */
/* L'entête se pose sur la photo : la page garde le repère « hero2 » de 38-ds3,
   qui évite la feuille arrondie des pages de formulaire. */
(() => {
  const r = routes.find(x => x.re.test('/')); if (!r) return;
  const _prev = r.fn;
  r.fn = () => {
    const html = _prev(); if (typeof html !== 'string') return html;
    const u = Auth.current(), pubs = published(), favIds = u ? DB.filterItems(DB.K.favorites, f => f.userId === u.id).map(f => f.propertyId) : [];
    const i = html.indexOf('<section class="section" id="comment">');
    const suite = i > -1 ? html.slice(i) : '';
    const tete = html.slice(0, html.indexOf('<section class="hero2"'));
    return tete + hxHero(u, false) + `<section class="wrap hx-main">${hxCats()}${hxVedette(pubs, favIds)}${hxUne(pubs)}${u ? activityHtml(u) : ''}</section>` + suite;
  };
})();

/* --- 3. L'accueil du client : la même page, avec son espace --------------- */
/* Le client cherche un bien : son accueil est la page de recherche de la
   maquette, suivie de son espace (favoris, visites, messages, alertes). */
(() => {
  const r = routes.find(x => x.re.source.includes('client') && x.re.source.includes('dashboard')); if (!r) return;
  r.fn = () => {
    const u = Auth.guard('client'); if (!u) return false;
    const pubs = published(), favIds = DB.filterItems(DB.K.favorites, f => f.userId === u.id).map(f => f.propertyId);
    const visits = DB.filterItems(DB.K.visits, v => v.clientId === u.id), alerts = DB.filterItems(DB.K.searches, s => s.userId === u.id);
    const aVenir = visits.filter(v => v.status === 'acceptee' && String(v.date) >= ymd());
    const nonLus = typeof conversationsDe === 'function' ? conversationsDe(u).reduce((s, c) => s + c.nonLus, 0) : 0;
    const espace = `<section class="hx-sec"><div class="hx-head"><h2>Mon espace</h2></div>${tbMinis([
      ['#/client/favorites', 'bad', 'heart', 'Mes favoris', String(favIds.length), favIds.length ? 'Biens mis de côté' : 'Touchez le cœur d\'une annonce'],
      ['#/client/visits', 'ok', 'calendar', 'Visites à venir', String(aVenir.length), `${pluriel(visits.length, 'demande')} au total`],
      ['#/client/messages', 'info', 'message', 'Messages non lus', String(nonLus), nonLus ? 'Des réponses vous attendent' : 'Vous êtes à jour'],
      ['#/client/alerts', 'gold', 'bell', 'Mes alertes', String(alerts.length), alerts.length ? 'Recherches surveillées' : 'Soyez prévenu des nouveautés']])}</section>`;
    return shellApp(u, hxHero(u, true) + `<div class="hx-main hx-main-app">${hxCats()}${espace}${hxVedette(pubs, favIds)}${hxUne(pubs)}${activityHtml(u)}</div>`);
  };
})();
/* Styles : css/02-refonte.css, § « Accueil d'après la maquette ». */

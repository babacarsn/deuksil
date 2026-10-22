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
/* Immeuble à étages (le pictogramme « building » ressemble à un document). */
ICONS.immeuble = '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M3 21h18M9.5 7h1M13.5 7h1M9.5 10.5h1M13.5 10.5h1M9.5 14h1M13.5 14h1M10.5 21v-3h3v3"/>';

/* --- 1. Les blocs ---------------------------------------------------------- */
/* [type, libellé, icône, libellé court pour téléphone] */
const HX_CATS = [['maison', 'Maisons', 'home', 'Maisons'], ['appartement', 'Appartements', 'building', 'Apparts'], ['terrain', 'Terrains', 'pin', 'Terrains'],
  ['local commercial', 'Locaux commerciaux', 'store', 'Locaux commerciaux'], ['', 'Biens à découvrir', 'grid', 'Biens à découvrir']];
const TYPE_FR = {appartement: 'Appartement', villa: 'Villa', maison: 'Maison', studio: 'Studio', chambre: 'Chambre', terrain: 'Terrain', bureau: 'Bureau', 'local commercial': 'Local commercial'};

function hxHero(u, interne) {
  return `<section class="hx${interne ? ' hx-in-app' : ''}" data-hx>
    <span class="hx-bgw" aria-hidden="true"><img class="hx-bg" src="${PHOTOS.couverture}" alt="" loading="eager"></span>
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
/* Les biens en vedette : les trois premiers de natures différentes quand c'est
   possible (maison, appartement, terrain), puis les plus consultés. */
function biensEnVedette(pubs, n = 9) {
  /* Tour à tour une maison, un appartement, un terrain, un local… : la bande
     qui défile ne montre jamais trois terrains d'affilée. */
  const tri = [...pubs].sort((a, b) => (b.views || 0) - (a.views || 0));
  const familles = [p => ['villa', 'maison'].includes(p.type), p => ['appartement', 'studio', 'chambre'].includes(p.type),
    p => p.transaction === 'terrain' || p.type === 'terrain', p => ['bureau', 'local commercial'].includes(p.type)];
  const files = familles.map(f => tri.filter(f)), out = [];
  for (let i = 0; out.length < n && files.some(f => f.length); i = (i + 1) % files.length) if (files[i].length) out.push(files[i].shift());
  tri.forEach(p => { if (out.length < n && !out.includes(p)) out.push(p); });
  return out;
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
/* Les biens défilent : trois à l'écran, un nouveau toutes les 4 secondes,
   flèches pour avancer ou reculer, glissement au doigt. Le défilement
   s'arrête quand on survole, touche ou parcourt la bande au clavier. */
function hxVedette(pubs, favIds) {
  const l = biensEnVedette(pubs);
  const fleches = l.length > 3 ? `<span class="hx-nav"><button type="button" class="hx-arrow" data-car="prev" aria-label="Biens précédents">${icon('arrowLeft', 17)}</button><button type="button" class="hx-arrow" data-car="next" aria-label="Biens suivants">${icon('arrowRight', 17)}</button></span>` : '';
  return `<section class="hx-sec"><div class="hx-head"><h2>Biens immobiliers en vedette</h2><span class="hx-head-r">${fleches}<a href="#/search">Voir tous ${icon('arrowRight', 18)}</a></span></div>
    ${l.length ? `<div class="hx-grid hx-car" role="region" aria-label="Biens en vedette, défilement automatique" tabindex="0">${l.map(p => hxCarte(p, favIds)).join('')}</div>` : '<p class="muted">Aucune annonce en ligne pour le moment.</p>'}</section>`;
}
const CAR_DELAI = 4000;
function carPas(car) { const c = car.firstElementChild; if (!c) return 0; return c.getBoundingClientRect().width + parseFloat(getComputedStyle(car).columnGap || getComputedStyle(car).gap || 0); }
function carAller(car, sens) {
  const pas = carPas(car); if (!pas) return;
  const fin = car.scrollWidth - car.clientWidth - 2;
  if (sens > 0 && car.scrollLeft >= fin) car.scrollTo({left: 0, behavior: 'smooth'});
  else if (sens < 0 && car.scrollLeft <= 2) car.scrollTo({left: car.scrollWidth, behavior: 'smooth'});
  else car.scrollBy({left: sens * pas, behavior: 'smooth'});
}
function carDemarrer(car) {
  if (car.dataset.car) return; car.dataset.car = '1';
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pauseJusqua = 0;
  const pause = ms => { pauseJusqua = Date.now() + ms; };
  ['pointerenter', 'touchstart', 'focusin', 'wheel'].forEach(ev => car.addEventListener(ev, () => pause(8000), {passive: true}));
  car.addEventListener('pointerleave', () => pause(1500));
  const t = setInterval(() => {
    if (!document.body.contains(car)) { clearInterval(t); return; }
    if (calme || document.hidden || Date.now() < pauseJusqua || car.scrollWidth <= car.clientWidth + 2) return;
    carAller(car, 1);
  }, CAR_DELAI);
  car.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); pause(8000); carAller(car, 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); pause(8000); carAller(car, -1); } });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-car]'); if (!b || b.classList.contains('hx-car')) return;
  const car = b.closest('.hx-sec') && b.closest('.hx-sec').querySelector('.hx-car'); if (!car) return;
  e.preventDefault(); car.dispatchEvent(new Event('pointerenter')); carAller(car, b.dataset.car === 'next' ? 1 : -1);
});
new MutationObserver(() => document.querySelectorAll('.hx-car:not([data-car])').forEach(carDemarrer))
  .observe(document.body, {childList: true, subtree: true});
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

/* --- 1 bis. Les blocs du bas de la maquette -------------------------------- */
function hxEtapes() {
  const E = [['01', 'Créez votre compte', 'Inscription gratuite avec votre numéro de CNI. Aucun frais, aucun abonnement.'],
    ['02', 'Cherchez et filtrez', 'Par ville, quartier, budget, type de bien et bien plus encore. Trouvez le bien qui correspond à vos besoins.'],
    ['03', 'Organisez vos visites', 'Contactez directement les propriétaires ou agences et planifiez vos visites en toute simplicité.']];
  return `<section class="hx-sec" id="comment"><p class="hx-kicker">Comment ça marche</p><h2 class="hx-h2">Trois étapes pour trouver le bon bien</h2>
    <ol class="hx-steps">${E.map(([n, t, d]) => `<li class="hx-step"><span class="hx-num">${n}</span><span class="hx-step-txt"><b>${t}</b><span>${d}</span></span></li>`).join('')}</ol></section>`;
}
function hxProfils() {
  const coche = t => `<li>${icon('check', 13)}<span>${t}</span></li>`;
  return `<section class="hx-sec hx-profils">
    <article class="hx-prof hx-prof-owner" id="proprietaires">
      <span class="hx-prof-ic">${icon('home', 26)}</span>
      <div class="hx-prof-body"><h2>Vous êtes <em>propriétaire</em></h2>
        <p>Publiez vos biens et échangez avec des personnes inscrites et vérifiées, tout en gardant la main sur vos disponibilités.</p>
        <ul>${coche('Inscription gratuite, sans abonnement ni commission')}${coche('Annonces illimitées')}${coche('Suivi des vues, des contacts et des visites')}</ul>
        <a class="hx-pill hx-pill-gold" href="#/register?role=owner">Publier un bien ${icon('arrowRight', 16)}</a></div>
      <img class="hx-prof-mark" src="${LOGO_LIGHT}" alt="" aria-hidden="true">
    </article>
    <article class="hx-prof hx-prof-agency" id="agences">
      <span class="hx-prof-ic">${icon('immeuble', 26)}</span>
      <div class="hx-prof-body"><h2>Vous êtes une <em>agence</em></h2>
        <p>Gérez vos biens, vos mandats et vos clients au même endroit.</p>
        <ul>${coche('Biens et agents illimités')}${coche('Mandats, gestion et commissions')}${coche('Facturation, loyers et maintenance')}</ul>
        <a class="hx-pill hx-pill-navy" href="#/register?role=agency">Créer un compte agence ${icon('arrowRight', 16)}</a></div>
    </article></section>`;
}
function hxChiffres() {
  const C = [['home', DB.getData(DB.K.properties).length, 'biens référencés'], ['users', DB.getData(DB.K.users).length, 'comptes actifs'],
    ['pin', Object.values(LOCATIONS).reduce((s, c) => s + Object.keys(c).length, 0), 'villes couvertes'], ['calendar', DB.getData(DB.K.visits).length, 'visites organisées']];
  return `<section class="hx-sec hx-stats" aria-label="DEUKSIL en chiffres">${C.map(([ic, n, l]) =>
    `<div class="hx-stat"><span class="hx-stat-ic">${icon(ic, 26)}</span><span><b>${n.toLocaleString('fr-FR')}</b><span>${l}</span></span></div>`).join('')}</section>`;
}
/* Témoignages : ils défilent comme les biens (un à la fois sur téléphone).
   Ce sont des exemples de démonstration : la section le dit, et ils sont à
   remplacer par de vrais avis, avec l'accord de leurs auteurs, avant la mise
   en ligne. */
const AVIS = [
  ['Aïcha Diouf', 'Locataire à Sacré-Cœur', 'J\'ai trouvé mon appartement en trois jours. Je voyais tout de suite si le bien était encore disponible, ça m\'a évité des visites pour rien.'],
  ['Mamadou Fall', 'Propriétaire, Almadies', 'Depuis que je publie sur DEUKSIL, je reçois des demandes de personnes déjà identifiées. Je perds moins de temps qu\'avec les annonces sur les groupes WhatsApp.'],
  ['Cheikh Gueye', 'Teranga Immobilier, agence', 'La gestion de nos agents et de nos mandats est enfin centralisée. Nos clients voient l\'état réel de chaque bien, ça évite les malentendus.'],
  ['Fatou Sarr', 'Acheteuse à Ouakam', 'Les prix, les surfaces et les photos sont clairs. J\'ai pu comparer trois terrains avant de demander une seule visite.'],
  ['Ousmane Diallo', 'Propriétaire, biens confiés à une agence', 'Je vois chaque mois ce qui a été encaissé, la commission et ce qui m\'a été reversé. Je n\'ai plus besoin d\'appeler l\'agence pour savoir.']];
const ICONS_GUILLEMETS = '<svg class="hx-quote" viewBox="0 0 32 24" aria-hidden="true"><path d="M0 24V14.4C0 6.6 4.4 1.8 12 0l1.6 3.2C9.2 4.6 7 7.4 6.8 11.2H12V24H0Zm18 0V14.4C18 6.6 22.4 1.8 30 0l1.6 3.2c-4.4 1.4-6.6 4.2-6.8 8H30V24H18Z" fill="currentColor"/></svg>';
function hxAvis() {
  const init = n => n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  return `<section class="hx-sec hx-avis" aria-labelledby="hx-avis-t">
    <p class="hx-kicker hx-kicker-line">Ils utilisent DEUKSIL</p><h2 class="hx-h2" id="hx-avis-t">Ce qu'en disent propriétaires et locataires</h2>
    <div class="hx-head hx-head-nav"><p class="hx-demo">Exemples de démonstration</p><span class="hx-nav"><button type="button" class="hx-arrow" data-car="prev" aria-label="Avis précédent">${icon('arrowLeft', 17)}</button><button type="button" class="hx-arrow" data-car="next" aria-label="Avis suivant">${icon('arrowRight', 17)}</button></span></div>
    <div class="hx-car hx-car-avis" role="region" aria-label="Témoignages, défilement automatique" tabindex="0">${AVIS.map(([n, r, q]) => `<figure class="hx-avis-card">
      ${ICONS_GUILLEMETS}<blockquote>« ${esc(q)} »</blockquote>
      <figcaption><span class="hx-av" style="background:${avatarColor(n)}">${typeof portraitUrl === 'function' ? `<img src="${portraitUrl({id: 'avis-' + n, firstName: n.split(' ')[0]})}" alt="">` : init(n)}</span><span><b>${esc(n)}</b><span>${esc(r)}</span></span></figcaption></figure>`).join('')}</div>
  </section>`;
}
/* Questions fréquentes : une icône par sujet, réponse dépliable. */
ICONS.pourcent = '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M19 5 5 19"/>';
ICONS.publier = '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>';
ICONS.labo = '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>';
const FAQ = [
  ['publier', 'Comment publier un bien sur DEUKSIL ?', 'Créez un compte propriétaire ou agence, puis touchez « Publier » : type de bien, adresse, prix, surface et photos. L\'annonce est en ligne dès que vous la validez.'],
  ['money', 'DEUKSIL est-il payant ?', 'Non : l\'inscription et l\'utilisation sont gratuites, sans abonnement. Chaque profil reste rattaché à un numéro de CNI, ce qui limite les faux comptes.'],
  ['checkCircle', 'Les annonces sont-elles à jour ?', 'Le statut de chaque bien suit ses baux et ses ventes : disponible, en discussion, loué ou vendu. Un bien loué ou vendu disparaît des résultats de recherche.'],
  ['calendar', 'Comment se passe une visite ?', 'Vous proposez une date et une heure depuis la fiche du bien. Le propriétaire accepte, refuse ou propose un autre créneau, et vous recevez une notification.'],
  ['pourcent', 'DEUKSIL prend-il une commission sur les loyers ?', 'Non. Aucune commission n\'est prélevée sur vos loyers ni sur vos ventes, et aucun paiement ne transite par DEUKSIL.'],
  ['labo', 'Cette version est-elle la version finale ?', 'Non : il s\'agit d\'une démonstration. Les données sont enregistrées dans votre navigateur et ne sont pas partagées entre appareils.']];
function hxFaq() {
  return `<section class="hx-sec hx-faq" id="faq" aria-labelledby="hx-faq-t">
    <p class="hx-kicker hx-kicker-line">Questions fréquentes</p><h2 class="hx-h2" id="hx-faq-t">Ce qu'on nous demande le plus</h2>
    <div class="hx-faq-list">${FAQ.map(([ic, q, a], i) => `<details class="hx-q"${i === 0 ? ' open' : ''}>
      <summary><span class="hx-q-ic">${icon(ic, 21)}</span><b>${esc(q)}</b><span class="hx-q-chev">${icon('chevDown', 20)}</span></summary>
      <p>${esc(a)}</p></details>`).join('')}</div>
  </section>`;
}

/* « Mon activité récente » : bandeau voilé de marine, lignes blanches, pastille ronde. */
activityHtml = function (u) {
  const n = DB.filterItems(DB.K.notifications, x => x.userId === u.id).slice().reverse().slice(0, 3);
  if (!n.length) return '';
  const ic = t => /retard|impay/i.test(t) ? ['alert', 'bad'] : /visite/i.test(t) ? ['calendar', 'info'] : /message/i.test(t) ? ['message', 'info'] : /favori|aimé/i.test(t) ? ['heart', 'bad']
    : /contrat|facture|reçu|quittance|mandat|devis/i.test(t) ? ['file', 'info'] : ['eye', 'ok'];
  return `<section class="hx-act" aria-label="Mon activité récente"><div class="hx-act-head"><span>${icon('bolt', 22)} Mon activité récente</span>
      <a href="#" data-action="notifications">Voir tout ${icon('arrowRight', 16)}</a></div>
    ${n.map(x => { const [i, t] = ic(x.text); return `<a class="hx-act-row" href="${esc(x.link || '#')}"><span class="hx-act-ic ${t}">${icon(i, 19)}</span>
      <b>${esc(x.text.length > 70 ? x.text.slice(0, 68) + '…' : x.text)}</b><span class="hx-act-date">${dateFr(x.createdAt)}</span></a>`; }).join('')}</section>`;
};

/* --- 1 ter. Pied de page prêt pour la mise en ligne -------------------------- */
/* Coordonnées et réseaux : renseignez-les ici. Une ligne vide n'est pas
   affichée — aucune coordonnée n'est inventée. */
const DEUKSIL_CONTACT = {
  email: '',          // ex. 'contact@deuksil.sn'
  telephone: '',      // ex. '+221 77 000 00 00'
  whatsapp: '',       // numéro au format international, sans espaces : '221770000000'
  adresse: 'Dakar, Sénégal',
  facebook: '', instagram: '', linkedin: '', tiktok: ''
};
ICONS.facebook = '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8z"/>';
ICONS.instagram = '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>';
ICONS.linkedin = '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>';
ICONS.tiktok = '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.5 5 5"/>';
ICONS.mail = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>';
function piedDePage() {
  const C = DEUKSIL_CONTACT, an = new Date().getFullYear();
  const reseaux = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['tiktok', 'TikTok']].filter(([k]) => C[k]);
  const lien = (h, l, attrs = '') => `<a href="${h}"${attrs}>${l}</a>`;
  const cat = (t, l) => `<a href="#/search" data-action="home-cat" data-t="${t}">${l}</a>`;
  return `<footer class="site ft">
    <div class="wrap ft-grid">
      <div class="ft-brand">
        <a class="logo" href="#/"><img src="${LOGO_LIGHT}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
        <p>La plateforme immobilière du Sénégal : locations, ventes et terrains, et la gestion locative pour les propriétaires et les agences.</p>
        <ul class="ft-contact">
          ${C.adresse ? `<li>${icon('pin', 16)}<span>${esc(C.adresse)}</span></li>` : ''}
          ${C.telephone ? `<li>${icon('phone', 16)}<span>${esc(C.telephone)}</span></li>` : ''}
          ${C.email ? `<li>${icon('mail', 16)}<span>${esc(C.email)}</span></li>` : ''}
        </ul>
        ${reseaux.length ? `<div class="ft-social">${reseaux.map(([k, l]) => `<a href="${esc(C[k])}" target="_blank" rel="noopener" aria-label="${l}">${icon(k, 18)}</a>`).join('')}</div>` : ''}
      </div>
      <nav class="ft-col" aria-label="Explorer"><b>Explorer</b>${lien('#/search', 'Rechercher un bien')}${cat('maison', 'Maisons')}${cat('appartement', 'Appartements')}${cat('terrain', 'Terrains')}${cat('local commercial', 'Locaux commerciaux')}</nav>
      <nav class="ft-col" aria-label="Professionnels"><b>Professionnels</b>${lien('#/register?role=owner', 'Publier un bien')}${lien('#/register?role=agency', 'Créer un compte agence')}${lien('#/#proprietaires', 'Espace propriétaires')}${lien('#/#agences', 'Espace agences')}${lien('#/login', 'Se connecter')}</nav>
      <nav class="ft-col" aria-label="Aide"><b>Aide</b>${lien('#/#comment', 'Comment ça marche')}${lien('#/#faq', 'Questions fréquentes')}${lien('#/contact', 'Nous écrire')}${lien('#/mot-de-passe-oublie', 'Mot de passe oublié')}${C.whatsapp ? lien('https://wa.me/' + esc(C.whatsapp), 'WhatsApp', ' target="_blank" rel="noopener"') : ''}</nav>
      <nav class="ft-col" aria-label="Informations légales"><b>Légal</b>${lien('#/legal/mentions', 'Mentions légales')}${lien('#/legal/cgu', 'Conditions d\'utilisation')}${lien('#/legal/confidentialite', 'Politique de confidentialité')}</nav>
    </div>
    <div class="wrap ft-bottom">
      <span>© ${an} DEUKSIL. Tous droits réservés.</span>
      <span class="ft-made">Conçu au Sénégal ${icon('pin', 14)}</span>
      <a href="#/" class="ft-top" data-action="ft-top">${icon('arrowLeft', 15)}<span>Haut de page</span></a>
    </div>
  </footer>`;
}
document.addEventListener('click', e => {
  if (!e.target.closest('[data-action="ft-top"]')) return;
  e.preventDefault();
  if (typeof remonterEnHaut === 'function') remonterEnHaut();
  else window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
});

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
    let suite = i > -1 ? html.slice(i) : '';
    /* « Comment ça marche », propriétaire / agence et chiffres : refaits d'après la maquette ;
       les témoignages, la FAQ et le pied de page restent. */
    const t = suite.indexOf('<section class="section"><div class="wrap">\n    <p class="kicker">Ils utilisent DEUKSIL');
    const pied = suite.indexOf('<footer class="site">');
    if (t > -1 && pied > -1) suite = `<section class="wrap hx-main hx-bas">${hxEtapes()}${hxProfils()}${hxChiffres()}${hxAvis()}${hxFaq()}</section>` + suite.slice(pied);
    else if (t > -1) suite = `<section class="wrap hx-main hx-bas">${hxEtapes()}${hxProfils()}${hxChiffres()}</section>` + suite.slice(t);
    suite = suite.replace(/<footer class="site">[\s\S]*?<\/footer>/, piedDePage());
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

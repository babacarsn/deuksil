/* ==========================================================================
   MODULE : ds3.js — refonte de l'interface (famille des références)
   coquille cadre marine + feuille, nav flottante, accueil, assistants par étapes
   ========================================================================== */
Object.assign(ICONS, {
  chevDown:'<path d="m6 9 6 6 6-6"/>', chevRight:'<path d="m9 6 6 6-6 6"/>', chevLeft:'<path d="m15 6-6 6 6 6"/>',
  sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  area:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', bath:'<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  logout:'<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9"/>'
});
if (!window.__ds3) { window.__ds3 = 1; }
const SHORT = {'Tableau de bord':'Accueil', 'Mes favoris':'Favoris', 'Demandes de visite':'Visites', 'Mes visites':'Visites', 'Mon patrimoine':'Patrimoine', 'Mes programmes':'Programmes', 'Mon logement':'Logement', 'Mes loyers':'Loyers'};
const PILL = {
  owner:  [['#/owner/dashboard', '#/owner/properties'], ['#/owner/property/new', 'Publier', 'plus'], ['#/manage/leases', '#/owner/messages']],
  agency: [['#/agency/dashboard', '#/agency/properties'], ['#/owner/property/new', 'Publier', 'plus'], ['#/manage/leases', '#/agency/messages']],
  client: [['#/client/dashboard', '#/client/favorites'], ['#/search', 'Rechercher', 'search'], ['#/client/visits', '#/client/messages']],
  tenant: [['#/tenant/home', '#/tenant/rents'], ['#/tenant/tickets', 'Signaler', 'plus'], ['#/tenant/messages', '#/coffre']]
};
const roleName = u => u.member ? {manager:'Gestionnaire', agent:'Agent'}[u.member.role] : {client:'Client', owner:'Propriétaire', agency:'Agence', admin:'Administration', tenant:'Client', investor:'Investisseur', promoter:'Promoteur'}[u.role];
const profileHref = u => (MENUS[u.role].find(m => /profil/i.test(m[1])) || [Auth.home(u)])[0];

tabBarHtml = function (u, path) {
  const menu = MENUS[u.role], has = h => menu.find(m => m[0] === h), cfg = PILL[u.role];
  const item = h => { const m = has(h); return m ? `<a href="${h}" class="tab-item ${path === h.slice(1) || (h !== '#/' && path.startsWith(h.slice(1) + '/')) ? 'active' : ''}">${icon(m[2], 21)}<span>${esc(SHORT[m[1]] || m[1])}</span></a>` : ''; };
  if (!cfg) return `<nav class="tabbar" aria-label="Navigation principale">${menu.slice(0, 5).map(m => `<a href="${m[0]}" class="tab-item ${path === m[0].slice(1) ? 'active' : ''}">${icon(m[2], 21)}<span>${esc(SHORT[m[1]] || m[1])}</span></a>`).join('')}</nav>`;
  const [L, F, R] = cfg, fab = !!F;
  return `<nav class="tabbar" aria-label="Navigation principale">${L.map(item).join('')}${fab ? `<a class="tab-fab" href="${F[0]}"><i>${icon(F[2], 22)}</i><span>${F[1]}</span></a>` : ''}${R.map(item).join('')}</nav>`;
};
const mhead = u => { const unread = DB.filterItems(DB.K.notifications, n => n.userId === u.id && !n.read).length;
  return `<header class="mhead"><div class="ml"><button class="mb" data-action="open-drawer" aria-label="Menu">${icon('menu', 30)}</button><a class="logo" href="#/"><img src="${LOGO_LIGHT}" alt="" class="mark"><span>EUKSIL</span></a></div>
    <div class="mr"><button class="mb mbell" data-action="notifications" aria-label="Notifications">${icon('bell', 24)}${unread ? `<b>${unread}</b>` : ''}</button>
    <button class="muser" data-action="toggle-upanel" aria-label="Mon compte">${avatarHtml(u, 38)}${icon('chevDown', 18)}</button></div></header>`; };
const upanel = u => `<div class="upanel" id="upanel"><div class="who">${avatarHtml(u, 76)}<b>${esc(ownerLabel(u))}</b><span>${roleName(u)}</span></div>
  <a href="${profileHref(u)}">${icon('user', 22)} Mon compte</a><button data-action="open-ai-chat" class="dim">${icon('bell', 22)} Aide & support</button>
  <button data-action="logout">${icon('logout', 22)} Se déconnecter</button></div>`;
const _shellApp = shellApp;
shellApp = (u, content) => _shellApp(u, content).replace('<div class="main">', '<div class="main">' + mhead(u) + upanel(u));

/* Public : entête marine, feuille arrondie pour les pages de formulaire */
shellPublic = function (content) {
  const u = Auth.current(), hero = content.includes('class="hero2"');
  return `<header class="nav"><div class="wrap nav-in"><a class="logo" href="#/"><img src="${LOGO_LIGHT}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
    <nav class="nav-links"><a href="#/search">Rechercher</a><a href="#/#comment">Comment ça marche</a><a href="#/#proprietaires">Propriétaires</a><a href="#/#agences">Agences</a><a href="#/#faq">Questions</a></nav>
    <div class="row">${u ? `<a class="nav-espace" href="${Auth.home(u)}" aria-label="Mon espace">${avatarHtml(u, 28)}<span>Mon espace</span></a>` : `<a class="btn ghost sm nav-login" href="#/login">Se connecter</a><a class="btn sm" href="#/register">Créer un compte</a>`}<button class="nav-burger" data-action="open-pub-menu" aria-label="Menu">${icon('menu', 28)}</button></div></div></header>
    ${hero ? content : `<div class="pub-sheet">${content}</div>`}`;
};
document.head.insertAdjacentHTML('beforeend', '<style>.pub-sheet{background:var(--surface);position:relative}.pub-sheet{border-radius:0;min-height:70vh}@media(max-width:760px){.nav-in{padding:6px 0}.nav .nav-login,.nav .row .btn{display:none}}</style>');

function openDrawer(links, foot) {
  const path = location.hash.replace('#', '');
  document.body.insertAdjacentHTML('beforeend', `<div class="sdrawer-back" data-action="close-drawer"></div><aside class="sdrawer"><a class="logo" href="#/" data-action="close-drawer" style="color:#fff;font-weight:700;font-size:1.75rem;margin-bottom:14px"><img src="${LOGO_LIGHT}" alt="" class="mark"><span>EUKSIL</span></a>
    ${links.map(([h, l, i]) => `<a href="${h}" data-action="close-drawer" class="${path === h.slice(1) ? 'active' : ''}">${icon(i, 20)}<span>${esc(l)}</span></a>`).join('')}${foot || ''}</aside>`);
}
const closeDrawer = () => document.querySelectorAll('.sdrawer-back,.sdrawer').forEach(e => e.remove());
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return; const a = el.dataset.action, u = Auth.current();
  if (a === 'open-drawer' && u) openDrawer(MENUS[u.role], `<a href="#/" data-action="close-drawer">${icon('home', 20)}<span>Site public</span></a><a href="#" data-action="logout" style="color:#FFB3B8">${icon('logout', 20)}<span>Se déconnecter</span></a>`);
  if (a === 'open-pub-menu') {
    /* Connecté : « Mon espace » en tête du menu et « Se déconnecter » en bas,
       au lieu de « Se connecter » / « Créer un compte ». */
    const pub = [['#/', 'Accueil', 'home'], ['#/search', 'Rechercher', 'search'], ['#/#comment', 'Comment ça marche', 'compass'], ['#/#proprietaires', 'Propriétaires', 'building'], ['#/#agences', 'Agences', 'briefcase']];
    if (u) openDrawer([[Auth.home(u), 'Mon espace', 'grid'], ...pub], `<a href="#" data-action="logout" style="color:#FFB3B8">${icon('logout', 20)}<span>Se déconnecter</span></a>`);
    else openDrawer([...pub, ['#/login', 'Se connecter', 'user'], ['#/register', 'Créer un compte', 'plus']]);
  }
  if (a === 'close-drawer') closeDrawer();
  if (a === 'toggle-upanel' || a === 'close-upanel') {
    const p = document.getElementById('upanel'); if (!p) return;
    const chev = document.querySelector('.mhead .muser');
    let back = document.querySelector('.upanel-back');
    if (!back) { back = document.createElement('div'); back.className = 'upanel-back'; back.dataset.action = 'close-upanel'; document.body.appendChild(back); }
    const open = a === 'toggle-upanel' && !p.classList.contains('open');
    if (open) {
      /* le panneau descend sous l'en-tête, où que l'on soit dans la page */
      const head = document.querySelector('.mhead');
      p.style.top = (head ? Math.round(head.getBoundingClientRect().bottom) : 0) + 'px';
      p.classList.add('open'); if (chev) chev.classList.add('on');
      requestAnimationFrame(() => back.classList.add('open'));
    } else { p.classList.remove('open'); back.classList.remove('open'); if (chev) chev.classList.remove('on'); }
  }
  if (a === 'home-cat') { e.preventDefault(); searchState = {...searchState, type: el.dataset.t || '', transaction: '', page: 1}; go('#/search'); }
  if (a === 'home-filters') go('#/search');
});
window.addEventListener('hashchange', closeDrawer);
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action="home-search"]'); if (!f) return; e.preventDefault();
  searchState = {...searchState, q: formData(f).q || '', page: 1}; go('#/search');
});

/* Recherche libre (champ texte) */
const _applySearch = applySearch;
applySearch = function () { const q = (searchState.q || '').trim().toLowerCase(), list = _applySearch(); return q ? list.filter(p => [p.title, p.quartier, p.city, p.region, p.type, p.description].join(' ').toLowerCase().includes(q)) : list; };
const _activeChips = activeChips;
activeChips = function () { const c = _activeChips(); if ((searchState.q || '').trim()) c.push(['q', '« ' + searchState.q.trim() + ' »']); return c; };

/* Étiquettes de transaction colorées sur les photos */
const _photoHtml = photoHtml;
photoHtml = function (p, o = {}) { const h = _photoHtml(p, o), t = {location:'À louer', vente:'À vendre', terrain:'Terrain'}[p.transaction];
  return t ? h.replace(/<em class="tag"([^>]*)>[^<]*<\/em>/, `<em class="tag tag-${p.transaction}"$1>${t}</em>`) : h; };
document.head.insertAdjacentHTML('beforeend', '<style>.photo .tag.tag-location{background:#1F4673;color:#fff}.photo .tag.tag-vente,.photo .tag.tag-terrain{background:#1C8A57;color:#fff}</style>');

/* ---------- Accueil : composants communs ---------- */
const CATS = [['', 'Tous les biens', 'home', 'Tous'], ['maison', 'Maisons', 'home', 'Maisons'], ['appartement', 'Appartements', 'building', 'Apparts'], ['terrain', 'Terrains', 'land', 'Terrains'], ['local commercial', 'Locaux commerciaux', 'store', 'Locaux']];
const catsHtml = () => `<div class="cats">${CATS.map(([t, l, i, short]) => `<a class="cat ${(searchState.type || '') === t && !searchState.q ? 'on' : ''}" href="#/search" data-action="home-cat" data-t="${t}"><span class="ci">${icon(i, 28)}</span><span class="lg">${l}</span><span class="sm">${short || l}</span></a>`).join('')}</div>`;
function marketHtml() {
  const pubs = published(), fav = DB.getData(DB.K.favorites), vis = DB.getData(DB.K.visits), wk = addDays(now(), -7), week = vis.filter(v => v.createdAt >= wk).length;
  const m = [[pubs.length, 'Biens disponibles', 'home', periodTrend(pubs)], [fav.length, 'Favoris', 'heart', periodTrend(fav)], [vis.length, 'Demandes', 'message', periodTrend(vis)], [week, 'Visites cette semaine', 'eye', null]];
  return `<div class="market">
    <h3>${icon('chart', 22)} Le marché en un coup d'œil</h3><div class="mgrid">${m.map(([n, l, i, t]) => `<div class="m">${icon(i, 24)}<div class="n">${n}</div><div class="l">${l}</div>${t && t.tone === 'ok' ? `<div class="t">${icon('trendUp', 12)} ${esc(t.label.replace(' cette semaine', ''))}</div>` : ''}</div>`).join('')}</div></div>`;
}
const pcard = (p, favIds = []) => `<article class="pc"><div class="ph">${photoHtml(p, {fav: favIds.includes(p.id)})}</div><div class="bd"><div class="loc">${icon('pin', 13)} ${esc(p.quartier)}, ${esc(p.city)}</div><h4>${esc(p.title)}</h4>
  <div class="pr">${money(p.price)}${p.transaction === 'location' ? ' <small>/ mois</small>' : ''}</div>
  <div class="sp">${p.transaction === 'terrain' ? `<span>${icon('area', 14)} ${p.surface} m²</span>` : `<span>${icon('bed', 14)} ${p.rooms}</span><span>${icon('bath', 14)} ${p.baths}</span><span>${icon('area', 14)} ${p.surface} m²</span>`}</div>
  <a class="go" href="#/property/${p.id}">Voir le détail ${icon('arrowRight', 15)}</a></div></article>`;
let mixed = (pubs, n = 8) => { const by = {location: [], vente: [], terrain: []}; [...pubs].sort((a, b) => (b.views || 0) - (a.views || 0)).forEach(p => (by[p.transaction] || by.vente).push(p)); const out = []; for (let i = 0; out.length < n && i < 6; i++) ['location', 'vente', 'terrain'].forEach(k => by[k][i] && out.length < n && out.push(by[k][i])); return out; };
const recoHtml = (list, favIds) => {
  const cards = list.map(p => pcard(p, favIds)).join('');
  /* La bande ne défile plus toute seule : on la fait glisser au doigt. */
  const body = !cards ? '<p class="muted small">Aucune annonce disponible pour le moment.</p>'
    : `<div class="hscroll">${cards}</div>`;
  return `<div class="sect-h"><h3>${icon('star', 22)} Recommandés pour vous</h3><a href="#/search">Voir tout →</a></div>${body}`;
};
function activityHtml(u) {
  const n = DB.filterItems(DB.K.notifications, x => x.userId === u.id).slice().reverse().slice(0, 3), ic = t => /visite/i.test(t) ? ['calendar', 'var(--info)'] : /message/i.test(t) ? ['message', 'var(--brand)'] : /favori|aimé/i.test(t) ? ['heart', 'var(--bad)'] : ['eye', 'var(--ok)'];
  if (!n.length) return '';
  return `<div class="activity"><div class="ah"><span>${icon('bolt', 20)} Mon activité récente</span><a href="#" data-action="notifications">Voir tout</a></div><div class="ag">${n.map(x => { const [i, c] = ic(x.text); return `<div class="ai"><span class="ci" style="color:${c}">${icon(i, 19)}</span><div><b>${esc(x.text.length > 46 ? x.text.slice(0, 44) + '…' : x.text)}</b><span>${dateFr(x.createdAt)}</span></div></div>`; }).join('')}</div></div>`;
}
const searchPill = () => `<form class="searchpill" data-action="home-search">${icon('search', 22)}<input name="q" placeholder="Rechercher une ville, un quartier, un bien…" autocomplete="off" aria-label="Rechercher"><button type="button" data-action="home-filters" aria-label="Filtres">${icon('sliders', 22)}</button></form>`;

/* ---------- Accueil public ---------- */
const landingRoute = routes.find(r => r.re.test('/')), _landing = landingRoute.fn;
landingRoute.fn = () => {
  const u = Auth.current(), pubs = published(), pop = [...pubs].sort((a, b) => b.views - a.views), favIds = u ? DB.filterItems(DB.K.favorites, f => f.userId === u.id).map(f => f.propertyId) : [];
  let rest = _landing(); rest = rest.slice(rest.indexOf('<section class="section" id="comment">'));
  rest = rest.replace(/<section class="section"><div class="wrap">\s*<div class="row-between"><div><p class="kicker">Les plus consultés[\s\S]*?(?=<section class="section" id="proprietaires">)/, '');
  return shellPublic(`<section class="hero2"><div class="wrap"><div><p class="hello">Bonjour${u ? ', <b>' + esc(u.firstName) + '</b>' : ''}</p>
      <h1>Trouvez le bien qui vous correspond au <span class="acc">Sénégal</span></h1><p class="lede">Maisons, appartements, terrains, locaux commerciaux… Tout l'immobilier au même endroit.</p>${searchPill()}</div>
      <div class="hero-img"><div class="photo"><img src="${PHOTOS.cover}" alt="Villa contemporaine au Sénégal" loading="eager"></div></div></div></section>
    <section class="wrap" style="margin-top:6px">${catsHtml()}<div style="margin-top:18px">${marketHtml()}</div>${recoHtml(mixed(pubs), favIds)}${u ? activityHtml(u) : ''}</section>` + rest);
};

/* ---------- Dashboard client (même langage) ---------- */
const clientRoute = routes.find(r => r.re.source.includes('client') && r.re.source.includes('dashboard'));
clientRoute.fn = () => {
  const u = Auth.guard('client'); if (!u) return false;
  const favs = DB.filterItems(DB.K.favorites, f => f.userId === u.id), visits = DB.filterItems(DB.K.visits, v => v.clientId === u.id), alerts = DB.filterItems(DB.K.searches, s => s.userId === u.id), pubs = published();
  const reco = mixed(pubs), fi = favs.map(f => f.propertyId);
  const row = (h, i, c, t, s) => `<a class="row-card" href="${h}"><span class="tile" style="border-color:${c};color:${c}">${icon(i, 24)}</span><span class="body"><span>${t}</span><b>${s}</b></span><span class="chev">${icon('chevRight', 20)}</span></a>`;
  return shellApp(u, `<div class="hero-card hero-photo" style="border-radius:26px;padding:26px 24px 24px;color:#fff;position:relative;overflow:hidden">
      <img class="hp-bg" src="${PHOTOS.bnClient}" alt="" loading="eager">
      <p style="margin:0 0 8px;opacity:.9;position:relative">Bonjour, <b>${esc(u.firstName)}</b></p><h1 style="font-size:clamp(1.7rem,4.6vw,2.6rem);max-width:14ch;color:#fff">Trouvez le bien qui vous correspond au <span style="color:#D0A361">Sénégal</span></h1>
      <p style="color:#CCD8E6;max-width:44ch;margin:10px 0 0">Locations, ventes et terrains, tout est ici.</p>${searchPill()}</div>
    <div style="margin-top:22px">${catsHtml()}</div><div style="margin-top:14px">${marketHtml()}</div>${recoHtml(reco, fi)}${activityHtml(u)}
    <div class="sect-h"><h3>Mon espace</h3></div><div class="rows">
      ${row('#/client/favorites', 'heart', 'var(--bad)', 'Mes favoris', favs.length + ' bien' + (favs.length > 1 ? 's' : ''))}
      ${row('#/client/visits', 'calendar', 'var(--info)', 'Mes visites', visits.length + ' demande' + (visits.length > 1 ? 's' : ''))}
      ${row('#/client/alerts', 'bell', 'var(--ok)', 'Mes alertes', alerts.length + ' recherche' + (alerts.length > 1 ? 's' : '') + ' enregistrée' + (alerts.length > 1 ? 's' : ''))}</div>`);
};

/* ---------- Assistants par étapes ---------- */
const stepsHtml = (n, cur) => `<div class="steps">${[...Array(n)].map((_, i) => `${i ? '<hr>' : ''}<i class="${i + 1 === cur ? 'on' : i + 1 < cur ? 'done' : ''}" data-step-dot="${i + 1}">${i + 1}</i>`).join('')}</div>`;
const crumbHtml = (back, t1, t2) => `<div class="crumbs"><a class="back" href="${back}" aria-label="Retour">${icon('chevLeft', 18)}</a><span>${t1}</span>${icon('chevRight', 14)}<b>${t2}</b></div>`;
const TYPE_ICON = {appartement:'building', villa:'home', maison:'home', studio:'door', chambre:'bed', terrain:'land', bureau:'briefcase', 'local commercial':'store'};
const TRANS_ICON = {location:['key', 'Location', 'Louer le bien à un locataire'], vente:['money', 'Vente', 'Vendre le bien'], terrain:['land', 'Terrain', 'Vendre une parcelle nue']};
ICONS.key = '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>';
const propRoute = routes.find(r => r.re.source.includes('property') && r.re.source.includes('new'));
propRoute.fn = pid => {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) { toast('Espace réservé aux propriétaires et agences.', 'bad'); go('#/login'); return false; }
  const p = pid === 'new' ? null : DB.findItem(DB.K.properties, pid);
  if (p && p.ownerId !== u.id) { toast('Ce bien ne vous appartient pas.', 'bad'); go('#/owner/properties'); return false; }
  const v = p || {transaction: 'location', type: 'appartement', region: 'Dakar', city: 'Dakar', commune: 'Dakar', quartier: 'Almadies', amenities: []}, cities = Object.keys(LOCATIONS[v.region] || {});
  resetFormPhotosIfNeeded(pid, v.photos);
  const f = (n, l, val, extra = '') => `<div class="field"><label>${l}</label><input class="input" name="${n}" value="${esc(val ?? '')}" ${extra}></div>`;
  return shellApp(u, crumbHtml('#/owner/properties', 'Mes biens', p ? 'Modifier le bien' : 'Ajouter un bien') + `<form data-action="save-property" data-id="${p ? p.id : ''}" id="wiz" style="max-width:820px">${stepsHtml(3, 1)}
    <div class="wstep on" data-step="1"><div class="wiz-card"><h3>1. Votre annonce</h3><p class="wiz-q">Quel type d'annonce souhaitez-vous publier ?</p>
      <div class="opts">${Object.entries(TRANS_ICON).map(([k, [ic, l, d]]) => `<label class="opt"><input type="radio" name="transaction" value="${k}" ${v.transaction === k ? 'checked' : ''}><span class="oic">${icon(ic, 22)}</span><span>${l}<small>${d}</small></span></label>`).join('')}</div>
      <p class="wiz-q">Quel type de bien ?</p><div class="tiles">${PROPERTY_TYPES.map(t => `<label class="tile-opt"><input type="radio" name="type" value="${t}" ${v.type === t ? 'checked' : ''}><span class="tic">${icon(TYPE_ICON[t] || 'home', 30)}</span>${t[0].toUpperCase() + t.slice(1)}</label>`).join('')}</div></div></div>
    <div class="wstep" data-step="2"><div class="wiz-card"><h3>2. Description et localisation</h3>
      ${f('title', "Titre de l'annonce", v.title, 'placeholder="Appartement F3 lumineux à Sacré-Cœur" required')}
      <div class="field"><label>Description</label><textarea name="description" placeholder="Décrivez le bien, l'environnement, les conditions…">${esc(v.description || '')}</textarea></div>
      <div class="form-grid">${f('price', 'Prix (FCFA)', v.price, 'type="number" required')}${f('surface', 'Surface (m²)', v.surface, 'type="number" required')}</div>
      <div class="form-grid"><div class="field"><label>Région</label><select name="region" data-action="region-change">${Object.keys(LOCATIONS).map(r => `<option ${v.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div class="field"><label>Ville</label><select name="city">${cities.map(c => `<option ${v.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
      <div class="form-grid">${f('commune', 'Commune', v.commune)}${f('quartier', 'Quartier', v.quartier)}</div>
      <div class="form-grid">${f('rooms', 'Chambres', v.rooms || 0, 'type="number"')}${f('baths', 'Salles de bain', v.baths || 0, 'type="number"')}</div>
      <div class="field"><label>Équipements</label><div class="row" style="flex-wrap:wrap;gap:10px">${AMENITIES.map(a => `<label class="check"><input type="checkbox" name="amenities" value="${a}" ${(v.amenities || []).includes(a) ? 'checked' : ''}>${a}</label>`).join('')}</div></div>
      <div class="field" style="max-width:260px"><label>Disponible à partir du</label><input class="input" name="availableFrom" type="date" value="${(v.availableFrom || now()).slice(0, 10)}"></div></div></div>
    <div class="wstep" data-step="3"><div class="wiz-card"><h3>3. Photos et publication</h3>${photoUploadHtml()}
      <p class="small muted" style="margin:14px 0 0">Vous verrez un récapitulatif avant la mise en ligne. La publication est immédiate.</p></div></div>
    <div class="wiz-foot"><button type="button" class="btn ghost" data-action="wiz-prev" id="wiz-prev" disabled>${icon('chevLeft', 16)} Précédent</button><span class="grow"></span>
      <button type="button" class="btn" data-action="wiz-next" id="wiz-next">Suivant ${icon('arrowRight', 16)}</button>
      <span id="wiz-end" class="hidden" style="display:none;gap:10px"><button class="btn ghost" name="intent" value="draft">Enregistrer le brouillon</button><button class="btn" name="intent" value="publish">Enregistrer et publier</button></span></div></form>`);
};
/* Inscription par étapes */
const regRoute = {re: /^\/register/, fn: () => ''}; routes.push(regRoute);   // l'écran est défini juste en dessous
/* Inscription publique : Client, Propriétaire ou Agence. Un client qui reçoit un bail devient locataire. */
const ROLE_OPT = [['client', 'user', 'Client', () => 'Recherche, favoris, contact et visites'], ['owner', 'home', 'Propriétaire', () => 'Publication de biens et gestion locative'],
  ['agency', 'building', 'Agence', () => 'Portefeuille, agents et mandats']];
/* Profil coché à l'arrivée : celui du lien (« Publier un bien » → Propriétaire,
   « Créer un compte agence » → Agence). Le routeur retire « ?role=… » de
   l'adresse et le garde dans LIEN ; si la page est redessinée sur place, on
   garde le choix déjà fait. */
function roleInscriptionDemande() {
  const ok = v => ROLE_OPT.some(o => o[0] === v) ? v : null;
  if (typeof LIEN !== 'undefined' && LIEN && LIEN.path === '#/register' && !LIEN.roleLu && Date.now() - LIEN.at < 2000) { LIEN.roleLu = true; const v = ok(LIEN.p.get('role')); if (v) return v; }
  const brut = (location.hash.split('role=')[1] || '').replace(/[^a-z]/g, ''); if (ok(brut)) return brut;
  const coche = document.querySelector('#wiz input[name="role"]:checked'); if (coche && ok(coche.value)) return coche.value;
  return 'client';
}
regRoute.fn = () => {
  const r = roleInscriptionDemande(), ag = r === 'agency';
  const req = '<span class="req" title="Champ obligatoire">*</span>';
  const pw = (n, id, auto) => `<div class="pw-wrap"><input class="input" type="password" id="${id}" name="${n}" minlength="8" autocomplete="${auto}" placeholder="${n === 'password2' ? 'Retapez le mot de passe' : '8 caractères minimum'}" required><button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Afficher le mot de passe">${icon('eye', 17)}</button></div>`;
  const champ = (id, lab, input, aide = '') => `<div class="field"><label for="${id}">${lab}</label>${input}${aide ? `<p class="small fhint" style="margin:6px 0 0">${aide}</p>` : ''}</div>`;
  return shellPublic(`<section class="wrap" style="max-width:680px;padding:34px 0 60px">${crumbHtml('#/', 'Accueil', 'Créer mon compte')}
    <form data-action="register" id="wiz" novalidate>${stepsHtml(3, 1)}
    <div class="wstep on" data-step="1"><div class="wiz-card"><h3>1. Votre profil</h3><p class="wiz-q">Quel type de compte souhaitez-vous créer ?</p>
      <div class="opts">${ROLE_OPT.map(([k, ic, l, d]) => `<label class="opt"><input type="radio" name="role" value="${k}" ${k === r ? 'checked' : ''}><span class="oic">${icon(ic, 22)}</span><span>${l}<small>${d()}</small></span></label>`).join('')}</div></div></div>
    <div class="wstep" data-step="2"><div class="wiz-card"><h3>2. Vos informations</h3>
      <div id="agency-fields" class="${ag ? '' : 'hidden'}">
        ${champ('reg-agence', `Nom de l'agence ${req}`, `<input class="input" id="reg-agence" name="agencyName" placeholder="Teranga Immobilier" autocomplete="organization" ${ag ? 'required' : 'disabled'}>`)}
        ${champ('reg-adresse', `Adresse de l'agence ${req}`, `<input class="input" id="reg-adresse" name="address" placeholder="Route des Almadies, Dakar" autocomplete="street-address" ${ag ? 'required' : 'disabled'}>`)}
        <div class="form-grid">${champ('reg-ninea', 'NINEA', `<input class="input" id="reg-ninea" name="ninea" placeholder="0012345678 2V2" ${ag ? '' : 'disabled'}>`)}
          ${champ('reg-rccm', 'RCCM', `<input class="input" id="reg-rccm" name="rccm" placeholder="SN-DKR-2024-B-12345" ${ag ? '' : 'disabled'}>`)}</div></div>
      <div class="form-grid">${champ('reg-prenom', `Prénom ${req}`, '<input class="input" id="reg-prenom" name="firstName" autocomplete="given-name" required>')}
        ${champ('reg-nom', `Nom ${req}`, '<input class="input" id="reg-nom" name="lastName" autocomplete="family-name" required>')}</div>
      ${champ('reg-email', `Adresse e-mail ${req}`, '<input class="input" id="reg-email" name="email" type="email" placeholder="vous@exemple.com" autocomplete="email" required>', 'Elle vous servira à vous connecter et à recevoir vos codes de sécurité.')}
      ${champ('reg-tel', `Téléphone ${req}`, '<input class="input" id="reg-tel" name="phone" type="tel" inputmode="tel" placeholder="77 123 45 67" autocomplete="tel" required>')}
      ${champ('reg-cni', `Numéro de CNI ${req}`, '<input class="input" id="reg-cni" name="cni" inputmode="numeric" maxlength="13" placeholder="13 chiffres" autocomplete="off" required>', 'Il sert à vérifier votre identité. Il n\'est jamais affiché publiquement.')}</div></div>
    <div class="wstep" data-step="3"><div class="wiz-card"><h3>3. Sécurité</h3>
      <div class="form-grid">${champ('reg-mdp', `Mot de passe ${req}`, pw('password', 'reg-mdp', 'new-password'))}${champ('reg-mdp2', `Confirmation ${req}`, pw('password2', 'reg-mdp2', 'new-password'))}</div>
      <p class="small fhint" style="margin:-4px 0 14px">8 caractères minimum, avec au moins une lettre et un chiffre.</p>
      <div class="field"><label class="check" style="align-items:flex-start;font-weight:500"><input type="checkbox" name="cgu" value="oui" required style="margin-top:2px">
        <span>J'accepte les <a href="#/legal/cgu" target="_blank">conditions d'utilisation</a> et la <a href="#/legal/confidentialite" target="_blank">politique de confidentialité</a> de DEUKSIL. ${req}</span></label></div>
      <div id="reg-err"></div></div></div>
    <div class="wiz-foot"><button type="button" class="btn ghost" data-action="wiz-prev" id="wiz-prev" disabled>${icon('chevLeft', 16)} Précédent</button><span class="grow"></span>
      <button type="button" class="btn" data-action="wiz-next" id="wiz-next">Suivant ${icon('arrowRight', 16)}</button><button class="btn hidden" id="wiz-end" style="display:none">Créer mon compte</button></div>
    <p class="small muted" style="margin:18px 0 0;text-align:center">Déjà inscrit ? <a href="#/login">Se connecter</a></p></form></section>`);
};
function wizGo(form, n) {
  const steps = [...form.querySelectorAll('.wstep')]; n = Math.max(1, Math.min(steps.length, n)); form.dataset.cur = n;
  steps.forEach((s, i) => s.classList.toggle('on', i + 1 === n));
  form.querySelectorAll('[data-step-dot]').forEach(d => { const k = +d.dataset.stepDot; d.className = k === n ? 'on' : k < n ? 'done' : ''; });
  const last = n === steps.length; form.querySelector('#wiz-prev').disabled = n === 1; form.querySelector('#wiz-next').style.display = last ? 'none' : '';
  const end = form.querySelector('#wiz-end'); end.classList.remove('hidden'); end.style.display = last ? 'inline-flex' : 'none';
  const top = form.getBoundingClientRect().top + scrollY - 90; if (top < scrollY) scrollTo({top, behavior: 'smooth'});
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="wiz-next"],[data-action="wiz-prev"],[data-step-dot]'), form = el && el.closest('#wiz'); if (!form) return;
  const cur = +(form.dataset.cur || 1), go2 = el.dataset.stepDot ? +el.dataset.stepDot : el.dataset.action === 'wiz-next' ? cur + 1 : cur - 1;
  if (go2 > cur) { const bad = [...form.querySelector(`.wstep[data-step="${cur}"]`).querySelectorAll('input,select,textarea')].find(i => !i.checkValidity()); if (bad) { bad.reportValidity(); return; } }
  wizGo(form, go2);
});
new MutationObserver(() => { const f = document.getElementById('wiz'); if (f && !f.dataset.cur) wizGo(f, 1); }).observe(document.body, {childList: true, subtree: true});

/* Tableaux : libellés pour l'affichage en cartes sur mobile */
function labelTables() {
  document.querySelectorAll('.table-wrap table:not([data-lbl])').forEach(t => {
    t.dataset.lbl = '1'; const h = t.tHead && t.tHead.rows[0] ? [...t.tHead.rows[0].cells].map(c => c.textContent.trim()) : []; if (!h.length) return;
    [...t.tBodies].forEach(b => [...b.rows].forEach(r => [...r.cells].forEach((c, i) => c.setAttribute('data-label', h[i] || ''))));
  });
}
new MutationObserver(() => requestAnimationFrame(labelTables)).observe(document.body, {childList: true, subtree: true});

/* onglet actif visible dans la rangée défilante */
new MutationObserver(() => requestAnimationFrame(() => { const t = document.querySelector('.gtabs a.btn:not(.ghost)'); if (t && !t.dataset.seen) { t.dataset.seen = 1; t.scrollIntoView({inline: 'center', block: 'nearest'}); } })).observe(document.body, {childList: true, subtree: true});

/* ---------- Recherche : barre + filtres repliables (réf. liste) ---------- */
const searchRoute = routes.find(r => r.re.source.includes('search')), _search = searchRoute.fn;
searchRoute.fn = () => {
  let h = _search(); if (typeof h !== 'string') return h;
  const s = searchState, bar = `<form class="searchrow" data-action="page-search"><span class="sr-ic" aria-hidden="true">${icon('search', 21)}</span><input class="input" type="search" name="q" value="${esc(s.q || '')}" placeholder="Rechercher une ville, un quartier, un bien…" autocomplete="off" aria-label="Rechercher"><button type="button" class="sq" data-action="toggle-filters" aria-label="Filtres">${icon('sliders', 20)}</button></form>
    <div class="tabs tabs-op">${[['', 'Tout', 'home'], ['location', 'À louer', 'building'], ['vente', 'À vendre', 'tag']].map(([v, l, ic]) => `<button type="button" data-action="set-transaction" data-v="${v}" aria-pressed="${s.transaction === v}">${icon(ICONS[ic] ? ic : 'home', 19)}<span>${l}</span></button>`).join('')}</div>`;
  const a = h.indexOf('<form class="card ai-search'); if (a > -1) h = h.slice(0, a) + bar + h.slice(a);
  const i = h.indexOf('<form class="card" data-action="search"'), k = h.indexOf('</form>', i) + 7;
  if (i > -1) h = h.slice(0, i) + '<div class="sfold" id="sfold">' + h.slice(i, k) + '</div>' + h.slice(k);
  return h;
};
document.addEventListener('click', e => { const b = e.target.closest('[data-action="toggle-filters"]'); if (b) document.getElementById('sfold')?.classList.toggle('open'); });
document.addEventListener('submit', e => { const f = e.target.closest('[data-action="page-search"]'); if (!f) return; e.preventDefault(); searchState = {...searchState, q: formData(f).q || '', page: 1}; render(); });

/* =========================================================================
   98-cartes.js — Carte d'un bien dans les résultats de recherche
   Disposition demandée : photo avec l'opération (À louer / À vendre) en
   haut à gauche, le cœur en haut à droite, le nombre de photos en bas à
   droite ; puis le lieu, le titre, le prix, les caractéristiques avec
   icônes et la disponibilité. Toute la carte ouvre la fiche du bien.
   ========================================================================= */
if (typeof ICONS !== 'undefined') {
  ICONS.tag = ICONS.tag || '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>';
  ICONS.etincelle = '<path d="M12 3c.4 3.9 2.1 5.6 6 6-3.9.4-5.6 2.1-6 6-.4-3.9-2.1-5.6-6-6 3.9-.4 5.6-2.1 6-6z" fill="currentColor"/><path d="M18.5 14.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" fill="currentColor"/>';
  ICONS.trier = ICONS.trier || '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5"/><path d="M17 20V4M13.5 7.5 17 4l3.5 3.5"/>';
}
if (typeof ICONS !== 'undefined' && !ICONS.surface) ICONS.surface = '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M7.5 16.5l9-9"/>';
const OPERATION_CARTE = {location: ['À louer', 'loc'], vente: ['À vendre', 'vente'], terrain: ['À vendre', 'vente']};
const nbPhotos = p => (p.photos && p.photos.length) || 1;
function foncierCourt(p) {
  const s = (p.foncier && p.foncier.statut) || p.statutFoncier || '';
  if (!s) return 'Terrain nu';
  return s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}
/* La puce à côté du prix : la surface d'un terrain, le nombre de pièces d'un logement (F3 = 2 chambres + salon). */
function puceBien(p) {
  const terrain = p.transaction === 'terrain' || p.type === 'terrain';
  if (terrain) return [`${p.surface || 0} m²`, ICONS.surface ? 'surface' : 'area'];
  if (p.type === 'studio') return ['Studio', 'home'];
  const f = String(p.title || '').match(/\bF\s?(\d)\b/i);
  if (f) return [`F${f[1]}`, 'home'];
  if (p.type === 'villa' || p.type === 'maison' || p.type === 'appartement' || p.type === 'duplex') return [TYPE_FR && TYPE_FR[p.type] || p.type, 'home'];
  if (p.type === 'chambre') return ['Chambre', 'bed'];
  return [`${p.surface || 0} m²`, ICONS.surface ? 'surface' : 'area'];
}
function caracteristiques(p) {
  const terrain = p.transaction === 'terrain' || p.type === 'terrain';
  const f = terrain ? [] : [[`${p.surface || 0} m²`, ICONS.surface ? 'surface' : 'area']];
  if (terrain) f.push([foncierCourt(p), 'file']);
  else { if (+p.rooms > 0) f.push([`${p.rooms} ch`, 'bed']); if (+p.baths > 0) f.push([`${p.baths} sdb`, 'bath']); }
  return f.map(([t, i]) => `<span>${icon(i, 19)}${esc(t)}</span>`).join('');
}
propertyCard = function (p, favIds = []) {
  const [op, ton] = OPERATION_CARTE[p.transaction] || ['', ''];
  const own = p.photos && p.photos.length ? p.photos : null;
  const src = own && own[0];
  const fav = (favIds || []).includes(p.id);
  return `<article class="prop carte-bien">
    <div class="cb-photo">${src ? `<img src="${src}" alt="${esc(p.title || 'Photo du bien')}" loading="lazy">` : sceneSvg(p)}
      ${op ? `<span class="cb-op cb-${ton}"><i></i>${op}</span>` : ''}
      <button class="fav cb-fav ${fav ? 'on' : ''}" data-action="toggle-fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${icon('heart', 20, fav)}</button>
      <span class="cb-nb">${icon('image', 15)} 1/${nbPhotos(p)}</span></div>
    <div class="cb-corps">
      <p class="cb-lieu">${icon('pin', 15)} ${esc([p.quartier, p.city].filter(Boolean).join(', '))}</p>
      <div class="cb-ligne"><p class="cb-prix">${money(p.price)}${p.transaction === 'location' ? '<small> / mois</small>' : ''}</p>${(([t, i]) => `<span class="cb-puce">${icon(i, 15)}${esc(t)}</span>`)(puceBien(p))}</div>
      <h3 class="cb-titre"><a href="#/property/${p.id}">${esc(p.title)}</a></h3>
      <div class="cb-carac">${caracteristiques(p)}</div>
      <div class="cb-etat">${badge(STATUS_LABEL[p.status] || 'Disponible', STATUS_TONE[p.status] || 'ok')}</div>
    </div></article>`;
};

/* En-tête des résultats : « 12 appartements disponibles · Trier par : Plus récents » */
const PLURIEL_TYPE = {appartement: 'appartements', villa: 'villas', maison: 'maisons', studio: 'studios', chambre: 'chambres', terrain: 'terrains', bureau: 'bureaux', 'local commercial': 'locaux commerciaux', duplex: 'duplex', immeuble: 'immeubles'};
const _resultsHtmlCartes = resultsHtml;
resultsHtml = function (u) {
  const h = _resultsHtmlCartes(u);
  return h
    .replace(/<span class="muted small">(\d+) biens? disponibles?<\/span>/, (m, n) => {
      const nom = +n > 1 ? (PLURIEL_TYPE[searchState.type] || 'biens') : (searchState.type || 'bien');
      return `<span class="cb-total"><b>${n}</b> ${esc(nom)} disponible${+n > 1 ? 's' : ''}</span>`;
    })
    .replace(/<select name="sort" data-action="sort-change" style="width:auto;padding:8px 12px">/,
      '<span class="cb-tri-box">' + icon('trier', 17) + '<label class="cb-tri" for="cb-tri">Trier par :</label><select id="cb-tri" class="cb-tri-sel" name="sort" data-action="sort-change">')
    .replace(/(<select id="cb-tri"[\s\S]*?<\/select>)/, '$1</span>');
};

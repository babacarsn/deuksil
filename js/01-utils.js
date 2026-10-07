/* ==========================================================================
   MODULE : utils.js — helpers génériques
   ========================================================================== */
/* Logo DEUKSIL fourni par l'utilisateur : deux variantes (fond clair / fond sombre) intégrées en base64. */
const PHOTO_SETS = {villa:['villa1','villa2','villa3','villa4'], maison:['maison1','maison2','maison3','villa3'],
  appartement:['villa2','villa1','maison1'], studio:['maison2','villa4'], chambre:['maison3','maison2'],
  duplex:['villa1','villa3'], immeuble:['bureau','local2'], terrain:['terrain'],
  bureau:['bureau','local1'], 'local commercial':['local1','local2','bureau']};
const demoPhotos = p => (PHOTO_SETS[p.type] || PHOTO_SETS.maison).map(k => PHOTOS[k]);

function photoHtml(p, opts = {}) {
  const fav = opts.fav === undefined ? '' :
    `<button class="fav ${opts.fav ? 'on' : ''}" data-action="toggle-fav" data-id="${p.id}" aria-label="Favori">${icon('heart', 16, opts.fav)}</button>`;
  const idx = opts.index || 0;
  const own = p.photos && p.photos.length ? p.photos : (p.type ? demoPhotos(p) : null);
  const real = own && (own[idx] || own[0]);
  const media = real ? `<img src="${real}" alt="${esc(p.title || 'Photo du bien')}" loading="lazy">` : sceneSvg(p);
  return `<div class="photo" style="${opts.style || ''}">${media}
    ${opts.noTag ? '' : `<em class="tag" style="font-style:normal">${esc(TRANSACTION_LABEL[p.transaction] || '')}</em>`}${fav}</div>`;
}

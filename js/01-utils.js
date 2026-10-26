/* ==========================================================================
   MODULE : utils.js — helpers génériques
   ========================================================================== */
/* Une annonce sans photo affiche une illustration dessinée (sceneSvg), jamais
   la photo d'un autre bien : une photo laisse croire qu'elle montre le bien.
   (Les photos de img/photos servent seulement de bandeaux décoratifs.) */

function photoHtml(p, opts = {}) {
  const fav = opts.fav === undefined ? '' :
    `<button class="fav ${opts.fav ? 'on' : ''}" data-action="toggle-fav" data-id="${p.id}" aria-label="Favori">${icon('heart', 16, opts.fav)}</button>`;
  const idx = opts.index || 0;
  const own = p.photos && p.photos.length ? p.photos : null;
  const real = own && (own[idx] || own[0]);
  const media = real ? `<img src="${real}" alt="${esc(p.title || 'Photo du bien')}" loading="lazy">` : sceneSvg(p);
  return `<div class="photo" style="${opts.style || ''}">${media}
    ${opts.noTag ? '' : `<em class="tag" style="font-style:normal">${esc(TRANSACTION_LABEL[p.transaction] || '')}</em>`}${fav}</div>`;
}

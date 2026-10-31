/* ==========================================================================
   MODULE : map.js — carte schématique du Sénégal (SVG dessiné à la main)
   Positions approximatives, à but illustratif : pas une carte topographique.
   ========================================================================== */





function searchFormHtml() {
  const s = searchState;
  const cities = s.region ? Object.keys(LOCATIONS[s.region] || {}) : [];
  const quartiers = s.region && s.city ? (LOCATIONS[s.region]?.[s.city] || []) : [];
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(label)}</option>`;
  return `<form class="card" data-action="search" style="margin-bottom:22px">
    <div class="seg" style="margin-bottom:14px">
      ${[['','Tout'],['location','Location'],['vente','Vente']].map(([v, l]) =>
        `<button type="button" data-action="set-transaction" data-v="${v}" aria-pressed="${s.transaction === v}">${l}</button>`).join('')}
    </div>
    <div class="filters">
      <div class="field"><label>Région</label><select name="region" data-action="search-region-change">${opt('', 'Toutes', s.region)}${Object.keys(LOCATIONS).map(r => opt(r, r, s.region)).join('')}</select></div>
      <div class="field"><label>Ville</label><select name="city" data-action="search-city-change">${opt('', 'Toutes', s.city)}${cities.map(c => opt(c, c, s.city)).join('')}</select></div>
      <div class="field"><label>Quartier</label><select name="quartier">${opt('', 'Tous', s.quartier)}${quartiers.map(q => opt(q, q, s.quartier)).join('')}</select></div>
      <div class="field"><label>Type de bien</label><select name="type">${opt('', 'Tous', s.type)}${PROPERTY_TYPES.map(t => opt(t, t[0].toUpperCase() + t.slice(1), s.type)).join('')}</select></div>
      <div class="field"><label>Prix minimum</label><input class="input" name="min" type="number" value="${s.min}" placeholder="0"></div>
      <div class="field"><label>Prix maximum</label><input class="input" name="max" type="number" value="${s.max}" placeholder="—"></div>
      <div class="field"><label>Chambres (min.)</label><input class="input" name="rooms" type="number" value="${s.rooms}" placeholder="0"></div>
      <div class="field"><label>Salles de bain (min.)</label><input class="input" name="baths" type="number" value="${s.baths}" placeholder="0"></div>
      <div class="field"><label>Surface min. (m²)</label><input class="input" name="surface" type="number" value="${s.surface}" placeholder="0"></div>
    </div>
    <div class="row" style="margin-top:14px;gap:18px;flex-wrap:wrap">
      <label class="check"><input type="checkbox" name="furnished" ${s.furnished ? 'checked' : ''}>Meublé</label>
      <label class="check"><input type="checkbox" name="parking" ${s.parking ? 'checked' : ''}>Parking</label>
      <div class="row" style="margin-left:auto;gap:8px">
        <button type="button" class="btn ghost sm" data-action="reset-search">Réinitialiser</button>
        <button class="btn sm">${icon('search', 15)} Rechercher</button>
      </div>
    </div></form>`;
}
function resultsHtml(u) {
  const res = applySearch();
  const favIds = u ? DB.filterItems(DB.K.favorites, f => f.userId === u.id).map(f => f.propertyId) : [];
  const chips = activeChips();
  const chipsHtml = chips.length ? `<div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:14px">
    ${chips.map(([k, l]) => `<span class="chip">${esc(l)}<button data-action="clear-chip" data-k="${k}" aria-label="Retirer ce filtre">${icon('close', 12)}</button></span>`).join('')}
    <button class="linkbtn small" data-action="reset-search">Tout effacer</button></div>` : '';

  if (!res.length) return chipsHtml + `<div class="empty"><b>Aucun bien ne correspond</b><p class="small">Élargissez le budget ou retirez un filtre pour voir plus d'annonces.</p></div>`;

  const pages = Math.max(1, Math.ceil(res.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, searchState.page || 1), pages);
  const pageItems = res.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return chipsHtml + `
    <div class="row-between" style="margin-bottom:14px">
      <span class="muted small">${res.length} bien${res.length > 1 ? 's' : ''} disponible${res.length > 1 ? 's' : ''}</span>
      <div class="row" style="gap:10px">
        <select name="sort" data-action="sort-change" style="width:auto;padding:8px 12px">
          ${Object.entries(SORT_LABEL).map(([k, l]) => `<option value="${k}" ${searchState.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        ${u && u.role === 'client' ? `<button class="btn ghost sm" data-action="save-search">Enregistrer cette recherche</button>` : ''}
      </div>
    </div>
    <div class="props">${pageItems.map(p => propertyCard(p, favIds, true)).join('')}</div>
    ${pages > 1 ? `<div class="row" style="justify-content:center;gap:6px;margin-top:26px">
      <button class="btn ghost sm" data-action="go-page" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${icon('arrowLeft', 14)} Précédent</button>
      <span class="small muted" style="padding:0 8px">Page ${page} / ${pages}</span>
      <button class="btn ghost sm" data-action="go-page" data-p="${page + 1}" ${page >= pages ? 'disabled' : ''}>Suivant ${icon('arrowRight', 14)}</button>
    </div>` : ''}${compareBarHtml()}`;
}
route(/^\/search/, () => {
  const u = Auth.current();
  const aiBox = `<form class="card ai-search ai-v2" data-action="ai-search" style="margin-bottom:16px">
      <div class="ai-head"><span class="ai-ic">${icon(ICONS.etincelle ? 'etincelle' : 'sparkle', 26)}</span>
        <div style="min-width:0"><b class="ai-t">Assistant de recherche</b>
          <p class="ai-d">Décrivez ce que vous cherchez en une phrase, l'assistant règle les filtres pour vous.</p></div></div>
      <div class="ai-row">
        <input class="input" name="q" placeholder="Ex. F3 meublé pas cher à Almadies" autocomplete="off" aria-label="Décrivez votre recherche">
        <button class="btn ai-go" type="submit">${icon(ICONS.etincelle ? 'etincelle' : 'sparkle', 18)} Chercher ${icon('arrowRight', 18)}</button>
      </div>
      <div id="ai-search-state" style="margin-top:10px"></div>
    </form>`;
  const toggle = `<div class="row-between" style="margin-bottom:14px"></div>`;
  const body = page('Rechercher un bien', 'Les annonces publiées sur DEUKSIL. Un doute sur une annonce ? Signalez-la depuis sa fiche.') + aiBox + searchFormHtml() + toggle +
    resultsHtml(u);
  return u && ['client', 'tenant'].includes(u.role) ? shellApp(u, body) : shellPublic(`<div class="wrap section" style="border:0">${body}</div>`);
});

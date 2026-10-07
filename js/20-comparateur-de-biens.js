/* ==========================================================================
   VUE : comparateur de biens
   ========================================================================== */
route(/^\/compare$/, () => {
  const u = Auth.current();
  const items = compareIds.map(id => DB.findItem(DB.K.properties, id)).filter(Boolean);
  const body = page('Comparer les biens', `${items.length} bien${items.length > 1 ? 's' : ''} sélectionné${items.length > 1 ? 's' : ''}`,
      `<a class="btn ghost sm" href="#/search">${icon('arrowLeft', 14)} Retour à la recherche</a>`) +
    (items.length < 2 ? `<div class="empty"><b>Sélectionnez au moins deux biens</b><p class="small">Cochez « Comparer » sur les annonces depuis la page de recherche.</p><a class="btn sm" href="#/search">Aller à la recherche</a></div>`
    : `<div class="table-wrap"><table><thead><tr><th>Critère</th>${items.map(p => `<th>${esc(p.title)}</th>`).join('')}</tr></thead><tbody>
        <tr><td>Photo</td>${items.map(p => `<td>${photoHtml(p, {style: 'width:120px;border-radius:10px'})}</td>`).join('')}</tr>
        <tr><td>Prix</td>${items.map(p => `<td><b>${money(p.price)}${p.transaction === 'location' ? ' / mois' : ''}</b></td>`).join('')}</tr>
        <tr><td>Prix au m²</td>${items.map(p => `<td>${money(pricePerSqm(p))}</td>`).join('')}</tr>
        <tr><td>Transaction</td>${items.map(p => `<td>${TRANSACTION_LABEL[p.transaction]}</td>`).join('')}</tr>
        <tr><td>Type</td>${items.map(p => `<td style="text-transform:capitalize">${esc(p.type)}</td>`).join('')}</tr>
        <tr><td>Localisation</td>${items.map(p => `<td>${esc(p.quartier)}, ${esc(p.city)}</td>`).join('')}</tr>
        <tr><td>Surface</td>${items.map(p => `<td>${p.surface} m²</td>`).join('')}</tr>
        <tr><td>Chambres</td>${items.map(p => `<td>${p.transaction === 'terrain' ? '—' : p.rooms}</td>`).join('')}</tr>
        <tr><td>Salles de bain</td>${items.map(p => `<td>${p.transaction === 'terrain' ? '—' : p.baths}</td>`).join('')}</tr>
        <tr><td>Meublé</td>${items.map(p => `<td>${p.furnished ? 'Oui' : 'Non'}</td>`).join('')}</tr>
        <tr><td>Parking</td>${items.map(p => `<td>${p.parking ? 'Oui' : 'Non'}</td>`).join('')}</tr>
        <tr><td>Statut</td>${items.map(p => `<td>${badge(STATUS_LABEL[p.status], STATUS_TONE[p.status])}</td>`).join('')}</tr>
        <tr><td>Vues</td>${items.map(p => `<td>${p.views || 0}</td>`).join('')}</tr>
        <tr><td></td>${items.map(p => `<td><a class="btn sm" href="#/property/${p.id}">Voir le bien</a></td>`).join('')}</tr>
      </tbody></table></div>`);
  return u && u.role !== 'admin' ? shellApp(u, body) : shellPublic(`<div class="wrap section" style="border:0">${body}</div>`);
});

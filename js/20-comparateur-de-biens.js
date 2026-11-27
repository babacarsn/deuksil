/* ==========================================================================
   VUE : comparateur de biens
   Un seul tableau (pas de pages), un bouton « Retirer » par bien, le meilleur
   prix et la plus grande surface mis en valeur.
   ========================================================================== */
route(/^\/compare$/, () => {
  const u = Auth.current();
  const items = compareIds.map(id => DB.findItem(DB.K.properties, id)).filter(Boolean);
  const lieu = p => [...new Set([p.quartier, p.city].filter(Boolean))].join(', ') || p.region || '—';
  const loyer = p => p.transaction === 'location';
  const prix = items.map(p => +p.price || 0), surf = items.map(p => +p.surface || 0);
  const minPrix = Math.min(...prix.filter(Boolean)), maxSurf = Math.max(...surf);
  const ligne = (lib, f) => `<tr><td>${lib}</td>${items.map(p => `<td>${f(p)}</td>`).join('')}</tr>`;
  const body = page('Comparer les biens', `${items.length} bien${items.length > 1 ? 's' : ''} sélectionné${items.length > 1 ? 's' : ''} · 3 au maximum`,
      `<a class="btn ghost sm" href="#/search">${icon('arrowLeft', 14)} Retour à la recherche</a>${items.length ? ` <button class="btn ghost sm" data-action="clear-compare">Tout retirer</button>` : ''}`) +
    (items.length < 2 ? `<div class="empty"><b>${items.length ? 'Ajoutez au moins un autre bien' : 'Sélectionnez au moins deux biens'}</b><p class="small">Cochez « Comparer » sur les annonces depuis la page de recherche.</p><a class="btn sm" href="#/search">Aller à la recherche</a></div>`
    : `<div class="cmp-wrap"><table class="cmp-table" data-enh="sans-pages"><thead><tr><th>Critère</th>${items.map(p => `<th><div class="cmp-tete">
          ${p.photos && p.photos.length ? `<img src="${esc(p.photos[0])}" alt="" loading="lazy">` : `<div class="cmp-ph">${typeof sceneSvg === 'function' ? sceneSvg(p) : ''}</div>`}
          <b>${esc(p.title)}</b>
          <div class="cmp-actions"><a class="btn sm" href="#/property/${p.id}">Voir le bien</a>
          <button class="btn ghost sm" data-action="toggle-compare" data-id="${p.id}" aria-label="Retirer ${esc(p.title)} de la comparaison">${icon('close', 13)} Retirer</button></div>
        </div></th>`).join('')}</tr></thead><tbody>
        ${ligne('Prix', p => `<b class="${+p.price === minPrix && items.length > 1 ? 'cmp-mieux' : ''}">${money(p.price)}${loyer(p) ? ' / mois' : ''}</b>`)}
        ${ligne('Prix au m²', p => +p.surface ? money(pricePerSqm(p)) : '—')}
        ${ligne('Transaction', p => esc(TRANSACTION_LABEL[p.transaction] || p.transaction))}
        ${ligne('Type', p => `<span style="text-transform:capitalize">${esc(p.type)}</span>`)}
        ${ligne('Localisation', p => esc(lieu(p)))}
        ${ligne('Surface', p => +p.surface ? `<span class="${+p.surface === maxSurf && items.length > 1 ? 'cmp-mieux' : ''}">${p.surface} m²</span>` : '—')}
        ${ligne('Chambres', p => p.transaction === 'terrain' ? '—' : (p.rooms || 0))}
        ${ligne('Salles de bain', p => p.transaction === 'terrain' ? '—' : (p.baths || 0))}
        ${ligne('Meublé', p => p.furnished ? 'Oui' : 'Non')}
        ${ligne('Parking', p => p.parking ? 'Oui' : 'Non')}
        ${ligne('Disponibilité', p => badge(STATUS_LABEL[p.status] || p.status, STATUS_TONE[p.status]))}
      </tbody></table></div>`);
  return u && u.role !== 'admin' ? shellApp(u, body) : shellPublic(`<div class="wrap section" style="border:0">${body}</div>`);
});

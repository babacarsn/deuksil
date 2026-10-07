/* ==========================================================================
   VUE : fiche détaillée d'un bien
   ========================================================================== */
route(/^\/property\/([\w]+)$/, id => {
  const p = DB.findItem(DB.K.properties, id);
  const u = Auth.current();
  if (!p) return shellPublic(`<div class="wrap section"><h2>Bien introuvable</h2><a class="btn" href="#/search">Retour à la recherche</a></div>`);
  if (u) DB.updateItem(DB.K.properties, p.id, {views: (p.views || 0) + 1});
  const owner = DB.findItem(DB.K.users, p.ownerId) || {};
  const isFav = u && DB.findItem(DB.K.favorites, f => f.userId === u.id && f.propertyId === p.id);
  const ownerName = owner.role === 'agency' ? owner.agencyName : `${owner.firstName} ${owner.lastName}`;
  const body = `
    ${backBar('#/search', 'Résultats de recherche')}
    <div class="grid" style="grid-template-columns:2fr 1fr;align-items:start;margin-top:14px" id="detail-grid">
      <div class="stack" style="gap:18px">
        <div class="gallery">
          ${photoHtml(p, {index: 0})}
          ${photoHtml({...p, id: p.id + 'b'}, {noTag: true, index: 1})}${photoHtml({...p, id: p.id + 'c'}, {noTag: true, index: 2})}
        </div>
        <div class="card">
          <div class="row-between"><h2>${esc(p.title)}</h2>${badge(STATUS_LABEL[p.status], STATUS_TONE[p.status])}</div>
          <p class="muted small" style="margin:6px 0 12px">${icon('pin', 14)} ${esc(p.quartier)}, ${esc(p.commune)}, ${esc(p.city)} — ${esc(p.region)}</p>
          <div style="font-family:var(--display);font-size:2rem;font-weight:600;color:var(--brand)">${money(p.price)}<span class="small muted" style="font-weight:400">${p.transaction === 'location' ? ' / mois' : ''}</span></div>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin-top:18px">
            ${[['Type', p.type], ['Surface', p.surface + ' m²'], ['Prix au m²', money(pricePerSqm(p))], ...(p.transaction !== 'terrain' ? [['Chambres', p.rooms], ['Salles de bain', p.baths]] : []),
               ['Transaction', TRANSACTION_LABEL[p.transaction]], ['Publié le', dateFr(p.createdAt)]]
              .map(([l, v]) => `<div><div class="small muted">${l}</div><b>${esc(String(v))}</b></div>`).join('')}
          </div>
          <h3 style="margin-top:22px">Description</h3><p class="muted">${esc(p.description)}</p>
          <h3>Équipements</h3>
          <div class="row" style="flex-wrap:wrap;gap:8px">${(p.amenities || []).length ? p.amenities.map(a => badge(a)).join('') : '<span class="muted small">Non renseignés</span>'}</div>
        </div>
      </div>
      <div class="stack" style="gap:14px">
        <div class="card">
          <div class="row">${avatarHtml(owner, 36)}
            <div><b>${esc(ownerName || 'Propriétaire DEUKSIL')}</b><div class="small muted">${owner.role === 'agency' ? 'Agence partenaire' : 'Propriétaire vérifié'}</div></div></div>
          <div class="stack" style="margin-top:16px">
            <button class="btn ${isFav ? 'ghost' : 'soft'}" data-action="toggle-fav" data-id="${p.id}">${icon('heart', 16, isFav)} ${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button>
            ${u && u.role !== 'admin'
              ? `<a class="btn" href="${telHref(owner.phone)}">${icon('phone', 16)} Appeler ${esc(owner.phone || '')}</a>`
              : `<button class="btn" data-action="call-owner" data-id="${p.id}">${icon('phone', 16)} Voir le numéro</button>`}
            <button class="btn ghost" data-action="contact" data-id="${p.id}">Contacter par message</button>
            <button class="btn ghost" data-action="ask-visit" data-id="${p.id}">Demander une visite</button>
          </div>
          <p class="small muted" style="margin:14px 0 0">Disponible à partir du ${dateFr(p.availableFrom)}.</p>
        </div>
        <div class="card pad-s small muted">
          <div class="row-between"><span>Vues</span><b>${p.views || 0}</b></div>
          <div class="row-between"><span>Référence</span><b>${p.id}</b></div>
          <div class="row-between"><span>Mise à jour</span><b>${dateFr(p.updatedAt)}</b></div>
        </div>
      </div>
    </div>`;
  return u && u.role !== 'admin' ? shellApp(u, body) : shellPublic(`<div class="wrap section" style="border:0">${body}</div>`);
});

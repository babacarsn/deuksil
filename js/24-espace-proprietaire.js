/* ==========================================================================
   VUES : espace propriétaire
   ========================================================================== */
let myProps = u => DB.filterItems(DB.K.properties, p => p.ownerId === u.id);

route(/^\/owner\/dashboard$/, () => {
  const u = Auth.guard('owner'); if (!u) return false;
  const props = myProps(u);
  const visits = DB.filterItems(DB.K.visits, v => v.ownerId === u.id);
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleDateString('fr-FR', {month:'short'});
    return [label, props.reduce((s, p) => s + ((hash(p.id + label) % 90)), 0)];
  });
  const pending = visits.filter(v => v.status === 'attente');
  return shellApp(u, `
    <div class="hero-banner" style="min-height:170px">
      <div class="scene-bg"><img src="${PHOTOS.bnOwner}" alt="" loading="lazy"></div>
      <div class="content">
        <span class="wave">Bonjour ${esc(u.firstName)}</span>
        <h1 style="font-size:1.5rem">Votre portefeuille en un coup d'œil</h1>
        <div class="hero-pills">
          <a href="#/owner/property/new">${icon('plus', 15)} Ajouter un bien</a>
          <a href="#/owner/visits">${icon('calendar', 15)} Demandes de visite</a>
        </div>
      </div>
    </div>
    <div class="kpis" style="margin-top:20px">
      ${kpiRich(props.length, 'Biens', 'home', 'brand', null)}
      ${kpiRich(props.filter(p => p.listingStatus === 'publiee').length, 'Annonces publiées', 'checkCircle', 'ok', null)}
      ${kpiRich(pending.length, 'Demandes en attente', 'file', 'warn', periodTrend(pending))}
      ${kpiRich(visits.filter(v => v.status === 'acceptee').length, 'Visites confirmées', 'calendar', 'info', null)}
      ${kpiRich(props.reduce((s, p) => s + (p.views || 0), 0), 'Vues cumulées', 'trendUp', 'gold', null)}
    </div>
    <div class="two-col" style="margin-top:18px">
      <div class="stack" style="gap:18px">
        <div class="card"><h3>Vues des annonces sur 6 mois</h3>${lineChart(months)}</div>
        <div>
          <h3 style="margin-bottom:12px">Accès rapides</h3>
          <div class="quick-actions">
            <a class="quick-card" href="#/owner/property/new"><div class="ic-bubble" style="background:var(--ok-soft);color:var(--ok)">${icon('plus', 17)}</div><b>Publier une annonce</b><span class="desc">Ajoutez un nouveau bien</span></a>
            <a class="quick-card" href="#/owner/properties"><div class="ic-bubble" style="background:var(--info-soft);color:var(--info)">${icon('home', 17)}</div><b>Mettre à jour un statut</b><span class="desc">Gérez vos biens existants</span></a>
            <a class="quick-card" href="#/manage"><div class="ic-bubble" style="background:var(--gold-soft);color:var(--gold)">${icon('briefcase', 17)}</div><b>Gestion</b><span class="desc">Baux, loyers et factures</span></a>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="row-between"><h3>Demandes récentes</h3>${visits.length ? `<a class="linkbtn small" href="#/owner/visits">Tout voir</a>` : ''}</div>
        ${visits.slice(0, 5).map(v => { const p = DB.findItem(DB.K.properties, v.propertyId) || {}; const c = typeof clientVisite === 'function' ? clientVisite(v) : (DB.findItem(DB.K.users, v.clientId) || {});
          return `<a class="list-item" href="#/owner/visits">
            ${avatarHtml(c, 34)}
            <div class="body"><b class="small">${esc(displayName(c))}</b><div class="small muted">${esc(p.title || '')} · ${dateFr(v.date)}</div></div>
            ${badge(VISIT_LABEL[v.status], VISIT_TONE[v.status])}</a>`;
        }).join('') || '<p class="small muted">Aucune demande pour l\'instant.</p>'}
      </div>
    </div>`);
});

let ownerBulkSelected = [];
function listingsTable(u, props) {
  if (!props.length) return `<div class="empty"><b>Aucun bien enregistré</b><p class="small">Ajoutez votre premier bien pour commencer à recevoir des demandes.</p><a class="btn sm" href="#/owner/property/new">Ajouter un bien</a></div>`;
  const sel = ownerBulkSelected.filter(id => props.some(p => p.id === id));
  return `${sel.length ? `<div class="row-between card pad-s" style="margin-bottom:14px;background:var(--surface-2)">
      <span class="small">${sel.length} bien${sel.length > 1 ? 's' : ''} sélectionné${sel.length > 1 ? 's' : ''}</span>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn ghost sm" data-action="owner-bulk-pause">Mettre en pause</button>
        <button class="btn ghost sm" data-action="owner-bulk-archive">Archiver</button>
        <button class="btn danger sm" data-action="owner-bulk-delete">${icon('trash', 14)} Supprimer</button>
      </div></div>` : ''}
    <div class="table-wrap"><table><thead><tr>
      <th style="width:34px"><input type="checkbox" data-action="owner-bulk-toggle-all" ${sel.length === props.length ? 'checked' : ''} aria-label="Tout sélectionner"></th>
      <th></th><th>Bien</th><th>Prix</th><th>Annonce</th><th>Statut du bien</th><th>Vues</th><th>Actions</th></tr></thead><tbody>
    ${props.map(p => `<tr>
      <td><input type="checkbox" data-action="owner-bulk-toggle" data-id="${p.id}" ${ownerBulkSelected.includes(p.id) ? 'checked' : ''} aria-label="Sélectionner ${esc(p.title)}"></td>
      <td>${photoHtml(p, {style:'width:56px;height:44px;border-radius:9px', noTag: true})}</td>
      <td><b>${esc(p.title)}</b><div class="small muted">${esc(p.quartier)}, ${esc(p.city)} · ${esc(p.type)}${p.photos && p.photos.length ? ` · ${p.photos.length} photo${p.photos.length > 1 ? 's' : ''}` : ''}</div></td>
      <td>${money(p.price)}</td>
      <td>${badge(LISTING_LABEL[p.listingStatus], LISTING_TONE[p.listingStatus])}</td>
      <td><select data-action="set-status" data-id="${p.id}" style="min-width:150px">
        ${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td>${p.views || 0}</td>
      <td><div class="row" style="gap:6px">
        <a class="btn sm" href="#/bien/${p.id}">Ouvrir</a>
        <a class="btn ghost sm" href="#/owner/property/${p.id}">Modifier</a>
        ${p.listingStatus === 'brouillon' || p.listingStatus === 'refusee' ? `<button class="btn sm" data-action="publish" data-id="${p.id}">Publier</button>` : ''}
        ${p.listingStatus === 'publiee' ? `<button class="btn ghost sm" data-action="pause" data-id="${p.id}">Mettre en pause</button>` : ''}
        ${p.listingStatus === 'pause' ? `<button class="btn sm" data-action="publish" data-id="${p.id}">Republier</button>` : ''}
        <button class="btn ghost sm" data-action="archive" data-id="${p.id}">Archiver</button>
        <button class="btn ghost sm" data-action="delete-prop" data-id="${p.id}" aria-label="Supprimer">${icon('trash', 15)}</button>
      </div></td></tr>`).join('')}</tbody></table></div>`;
}
route(/^\/owner\/properties$/, () => {
  const u = Auth.guard('owner'); if (!u) return false;
  return shellApp(u, page('Mes biens et annonces', 'Publiez, mettez en pause ou archivez vos annonces.', `<a class="btn" href="#/owner/property/new">${icon('plus', 16)} Ajouter un bien</a>`) + listingsTable(u, myProps(u)));
});
route(/^\/agency\/properties$/, () => {
  const u = Auth.guard('agency'); if (!u) return false;
  const props = myProps(u);
  return shellApp(u, page('Portefeuille de biens', `${props.length} bien${props.length > 1 ? 's' : ''} dans votre portefeuille`,
    `<a class="btn" href="#/owner/property/new">${icon('plus', 16)} Ajouter un bien</a>`) + listingsTable(u, props));
});

/* --- Photos du bien : compression côté navigateur, stockage en base64 dans le bien --- */
const MAX_PHOTOS = 8, MAX_PHOTO_DIM = 1280, PHOTO_QUALITY = .72;
let formPhotos = [], formPhotosFor = null;
function resetFormPhotosIfNeeded(pid, existing) {
  if (formPhotosFor !== pid) { formPhotos = (existing || []).slice(); formPhotosFor = pid; }
}
function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lecture impossible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image invalide'));
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_DIM / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
/* --- Documents (pièces jointes libres : identité, titres fonciers, etc.) --- */
const MAX_DOC_SIZE = 4 * 1024 * 1024;
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_DOC_SIZE) return reject(new Error('fichier trop volumineux'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lecture impossible'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}
function docIcon(mime) { return mime && mime.startsWith('image/') ? 'image' : 'file'; }

function photoUploadHtml() {
  return `<div class="field">
    <label>Photos du bien</label>
    <div class="upload-zone">
      <label class="upload-btn">
        <input type="file" accept="image/*" multiple data-action="photos-input" ${formPhotos.length >= MAX_PHOTOS ? 'disabled' : ''}>
        ${icon('upload', 20)}<span>Ajouter des photos</span>
        <span class="small muted">JPG ou PNG, ${MAX_PHOTOS} photos maximum — ${formPhotos.length}/${MAX_PHOTOS}</span>
      </label>
      ${formPhotos.length ? `<div class="photo-grid">${formPhotos.map((src, i) => `
        <div class="photo-thumb">
          <img src="${src}" alt="Photo ${i + 1}">
          ${i === 0 ? '<em class="cover-tag">Couverture</em>' : ''}
          <button type="button" class="rm" data-action="remove-photo" data-i="${i}" aria-label="Retirer cette photo">${icon('close', 13)}</button>
        </div>`).join('')}</div>` : `<p class="small muted" style="margin-top:10px">Aucune photo ajoutée : une illustration générique sera utilisée pour l'annonce.</p>`}
    </div></div>`;
}

/* --- Formulaire bien (création / édition) --- */
route(/^\/owner\/property\/(new|[\w]+)$/, pid => {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) { toast('Espace réservé aux propriétaires et agences.', 'bad'); go('#/login'); return false; }
  const p = pid === 'new' ? null : DB.findItem(DB.K.properties, pid);
  if (p && p.ownerId !== u.id) { toast("Ce bien ne vous appartient pas.", 'bad'); go('#/owner/properties'); return false; }
  const v = p || {transaction:'location', type:'appartement', region:'Dakar', city:'Dakar', commune:'Dakar', quartier:'Almadies', amenities:[]};
  const cities = Object.keys(LOCATIONS[v.region] || {});
  resetFormPhotosIfNeeded(pid, v.photos);
  return shellApp(u, page(p ? 'Modifier le bien' : 'Ajouter un bien', 'Les annonces sont vérifiées par DEUKSIL avant publication.') + `
    <form class="card" data-action="save-property" data-id="${p ? p.id : ''}" style="max-width:860px">
      <div class="form-grid">
        <div class="field"><label>Type de transaction</label><select name="transaction">${Object.entries(TRANSACTION_LABEL).map(([k, l]) => `<option value="${k}" ${v.transaction === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Type de bien</label><select name="type">${PROPERTY_TYPES.map(t => `<option value="${t}" ${v.type === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Titre de l'annonce</label><input class="input" name="title" value="${esc(v.title || '')}" placeholder="Appartement F3 lumineux à Sacré-Cœur" required></div>
      <div class="field"><label>Description</label><textarea name="description" placeholder="Décrivez le bien, l'environnement, les conditions…">${esc(v.description || '')}</textarea></div>
      <div class="form-grid">
        <div class="field"><label>Prix (FCFA)</label><input class="input" name="price" type="number" value="${v.price || ''}" required></div>
        <div class="field"><label>Surface (m²)</label><input class="input" name="surface" type="number" value="${v.surface || ''}" required></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Région</label><select name="region" data-action="region-change">${Object.keys(LOCATIONS).map(r => `<option ${v.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div class="field"><label>Ville</label><select name="city">${cities.map(c => `<option ${v.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Commune</label><input class="input" name="commune" value="${esc(v.commune || '')}"></div>
        <div class="field"><label>Quartier</label><input class="input" name="quartier" value="${esc(v.quartier || '')}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Chambres</label><input class="input" name="rooms" type="number" value="${v.rooms || 0}"></div>
        <div class="field"><label>Salles de bain</label><input class="input" name="baths" type="number" value="${v.baths || 0}"></div>
      </div>
      <div class="field"><label>Équipements</label><div class="row" style="flex-wrap:wrap;gap:10px">
        ${AMENITIES.map(a => `<label class="check"><input type="checkbox" name="amenities" value="${a}" ${(v.amenities || []).includes(a) ? 'checked' : ''}>${a}</label>`).join('')}</div></div>
      <div class="field"><label>Disponible à partir du</label><input class="input" name="availableFrom" type="date" value="${(v.availableFrom || now()).slice(0, 10)}" style="max-width:240px"></div>
      ${photoUploadHtml()}
      <div class="row" style="gap:10px;margin-top:8px">
        <button class="btn ghost" name="intent" value="draft">Enregistrer le brouillon</button>
        <button class="btn" name="intent" value="publish">Enregistrer et publier</button>
      </div>
    </form>`);
});

/* --- Demandes de visite côté propriétaire / agence --- */
route(/^\/(owner|agency)\/visits$/, role => {
  const u = Auth.guard(role); if (!u) return false;
  const visits = DB.filterItems(DB.K.visits, v => v.ownerId === u.id);
  return shellApp(u, page('Demandes de visite', 'Acceptez, reportez ou clôturez les demandes reçues.') +
    (visits.length ? `<div class="table-wrap"><table><thead><tr><th>Client</th><th>Bien</th><th>Créneau</th><th>Message</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
      ${visits.map(v => { const c = typeof clientVisite === 'function' ? clientVisite(v) : (DB.findItem(DB.K.users, v.clientId) || {}); const p = DB.findItem(DB.K.properties, v.propertyId) || {};
        return `<tr><td><div class="row">${avatarHtml(c, 36)}
            <div><b class="small">${esc(displayName(c))}</b><div class="small muted"><a href="${telHref(c.phone)}" style="color:inherit;text-decoration:none">${icon('phone', 11)} ${esc(c.phone || '')}</a></div></div></div></td>
          <td class="small">${esc(p.title || '—')}</td><td>${dateFr(v.date)}<div class="small muted">${esc(v.time)}</div></td>
          <td class="small muted">${esc(v.message || '—')}</td><td>${badge(VISIT_LABEL[v.status], VISIT_TONE[v.status])}</td>
          <td><div class="row" style="gap:6px">
            ${v.status === 'attente' ? `<button class="btn sm" data-action="visit-status" data-id="${v.id}" data-s="acceptee">Accepter</button>
              <button class="btn ghost sm" data-action="visit-status" data-id="${v.id}" data-s="refusee">Refuser</button>
              <button class="btn ghost sm" data-action="visit-status" data-id="${v.id}" data-s="reportee">Reporter</button>` : ''}
            ${v.status === 'acceptee' ? `<button class="btn ghost sm" data-action="visit-status" data-id="${v.id}" data-s="terminee">Marquer terminée</button>` : ''}
          </div></td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><b>Aucune demande reçue</b><p class="small">Publiez une annonce pour recevoir des demandes de visite.</p></div>`));
});

route(/^\/owner\/statistics$/, () => {
  const u = Auth.guard('owner'); if (!u) return false;
  const props = myProps(u);
  const visits = DB.filterItems(DB.K.visits, v => v.ownerId === u.id);
  const favCount = DB.getData(DB.K.favorites).filter(f => props.some(p => p.id === f.propertyId)).length;
  return shellApp(u, page('Statistiques', 'Performance de vos annonces.') + `
    <div class="kpis">${kpi(props.reduce((s, p) => s + (p.views || 0), 0), 'Vues')}${kpi(props.reduce((s, p) => s + (p.contacts || 0), 0), 'Contacts')}
      ${kpi(favCount, 'Mises en favori')}${kpi(visits.length, 'Demandes')}${kpi(visits.filter(v => v.status === 'terminee').length, 'Visites réalisées')}</div>
    <div class="two-col" style="margin-top:20px">
      <div class="card"><h3>Vues par annonce</h3>${barChart(props.slice(0, 8).map(p => [p.title.split(' ')[0], p.views || 0]))}</div>
      <div class="card"><h3>Répartition par type</h3>${donutList(Object.entries(props.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {})))}</div>
    </div>`);
});

route(/^\/owner\/documents$/, () => {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) { toast('Espace réservé aux propriétaires et agences.', 'bad'); go('#/login'); return false; }
  const docs = DB.filterItems(DB.K.documents, d => d.ownerId === u.id).slice().reverse();
  return shellApp(u, page('Documents', 'Conservez vos pièces justificatives : identité, titres fonciers, mandats.',
    `<label class="btn sm" style="cursor:pointer">${icon('upload', 15)} Ajouter un document<input type="file" accept="image/*,.pdf" multiple data-action="doc-upload" style="display:none"></label>`) +
    (docs.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Nom</th><th>Type</th><th>Ajouté le</th><th>Actions</th></tr></thead><tbody>
      ${docs.map(d => `<tr><td>${icon(docIcon(d.mime), 18)}</td><td class="small"><b>${esc(d.name)}</b></td>
        <td class="small muted">${d.mime && d.mime.startsWith('image/') ? 'Image' : 'PDF / document'}</td>
        <td class="small muted">${dateFr(d.createdAt)}</td>
        <td><div class="row" style="gap:6px"><a class="btn ghost sm" href="${d.dataUrl}" target="_blank" rel="noopener">Voir</a>
        <a class="btn ghost sm" href="${d.dataUrl}" download="${esc(d.name)}">Télécharger</a>
        <button class="btn ghost sm" data-action="doc-delete" data-id="${d.id}" aria-label="Supprimer ${esc(d.name)}">${icon('trash', 14)}</button></div></td></tr>`).join('')}
      </tbody></table></div>`
    : `<div class="empty"><b>Aucun document</b><p class="small">Ajoutez une pièce d'identité, un titre foncier ou un mandat pour l'avoir sous la main.</p></div>`));
});

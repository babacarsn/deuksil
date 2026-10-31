/* ==========================================================================
   VUES : espace client
   ========================================================================== */
route(/^\/client\/dashboard$/, () => {
  const u = Auth.guard('client'); if (!u) return false;
  const favs = DB.filterItems(DB.K.favorites, f => f.userId === u.id);
  const visits = DB.filterItems(DB.K.visits, v => v.clientId === u.id);
  const alerts = DB.filterItems(DB.K.searches, s => s.userId === u.id);
  const pubs = published();
  const recent = [...pubs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  const {labels, counts: searchCounts} = dailyBuckets(alerts, 7);
  const favBuckets = dailyBuckets(favs, 7).counts;
  const activity = DB.filterItems(DB.K.notifications, n => n.userId === u.id).slice().reverse().slice(0, 4);
  const activityIcon = t => /visite/i.test(t) ? 'calendar' : /message/i.test(t) ? 'message' : /alerte|correspond/i.test(t) ? 'search' : /annonce|bien/i.test(t) ? 'home' : 'bell';
  const registration = DB.filterItems(DB.K.payments, p => p.userId === u.id && p.type === 'Inscription')[0];

  return shellApp(u, `
    <div class="hero-banner">
      <div class="scene-bg"><img src="${PHOTOS.bnClient}" alt="" loading="lazy"></div>
      <div class="content">
        <span class="wave">Bonjour ${esc(u.firstName)}</span>
        <h1>Trouvez le bien de vos rêves au Sénégal</h1>
        <p style="opacity:.85;font-size:.9rem;margin:0">Locations, ventes et terrains, tout est ici.</p>
        <div class="hero-pills">
          <a href="#/search">${icon('home', 15)} Location</a>
          <a href="#/search">${icon('building', 15)} Vente</a>
          <a href="#/search">${icon('land', 15)} Terrain</a>
        </div>
      </div>
    </div>

    <div class="two-col" style="margin-top:20px;align-items:start">
      <div class="stack" style="gap:20px">
        <div class="kpis">
          ${kpiRich(pubs.length, 'Biens disponibles', 'home', 'brand', null)}
          ${kpiRich(favs.length, 'Favoris', 'heart', 'bad', periodTrend(favs))}
          ${kpiRich(visits.length, 'Demandes', 'file', 'info', periodTrend(visits))}
          ${kpiRich(visits.filter(v => v.status === 'acceptee').length, 'Visites confirmées', 'checkCircle', 'ok', null)}
        </div>

        <div class="card">
          <div class="row-between"><div><h3>Aperçu de votre activité</h3><p class="small muted" style="margin:2px 0 0">Recherches enregistrées et favoris sur 7 jours</p></div></div>
          <div class="row" style="gap:16px;margin:10px 0 -6px;font-size:.78rem"><span class="row" style="gap:5px"><i style="width:8px;height:8px;border-radius:50%;background:var(--brand);display:inline-block"></i>Alertes</span><span class="row" style="gap:5px"><i style="width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block"></i>Favoris</span></div>
          ${dualLineChart(labels, searchCounts, favBuckets)}
        </div>

        <div>
          <h3 style="margin-bottom:12px">Accès rapides</h3>
          <div class="quick-actions">
            <a class="quick-card" href="#/search"><div class="ic-bubble" style="background:var(--info-soft);color:var(--info)">${icon('search', 17)}</div><b>Rechercher un bien</b><span class="desc">Trouvez votre logement idéal</span></a>
            <a class="quick-card" href="#/search"><div class="ic-bubble" style="background:var(--ok-soft);color:var(--ok)">${icon('plus', 17)}</div><b>Créer une alerte</b><span class="desc">Soyez prévenu des nouvelles annonces</span></a>
            <a class="quick-card" href="#/client/favorites"><div class="ic-bubble" style="background:var(--bad-soft);color:var(--bad)">${icon('heart', 17)}</div><b>Gérer mes favoris</b><span class="desc">Retrouvez vos biens préférés</span></a>
          </div>
        </div>

        <div class="card">
          <div class="row-between"><h3>Dernières annonces</h3><a class="linkbtn small" href="#/search">Voir tout</a></div>
          <div class="props" style="margin-top:14px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${recent.map(p => propertyCard(p, favs.map(f => f.propertyId))).join('') || '<p class="small muted">Aucune annonce disponible pour le moment.</p>'}</div>
        </div>
      </div>

      <div class="stack" style="gap:16px">
        <div class="profile-card">
          <div class="row-between"><div class="row" style="gap:10px">${avatarHtml(u, 46)}
            <div><b>${esc(u.firstName)} ${esc(u.lastName)}</b><div class="small muted">Client</div>
            <span class="status-badge">${icon('checkCircle', 11)} Compte actif</span></div></div>
            <a class="linkbtn small" href="#/client/profile" aria-label="Paramètres du profil">${icon('settings', 16)}</a></div>
          ${registration ? `<div class="paid-card"><div class="ic">${icon('checkSquare', 16)}</div>
            <div><b class="small">Frais d'inscription payés</b><div class="small muted">${money(registration.amount)} · ${dateFr(registration.createdAt)}</div></div></div>`
            : ''}
        </div>

        ${alerts.length ? `<div class="card">
          <div class="row-between"><h3>Recherches récentes</h3><a class="linkbtn small" href="#/client/alerts">Voir toutes</a></div>
          ${alerts.slice(0, 3).map(a => `<button class="list-item" data-action="run-alert" data-id="${a.id}">
            <div class="ic-bubble" style="background:var(--surface-2);color:var(--muted)">${icon('clock', 15)}</div>
            <div class="body"><b class="small">${esc(a.name)}</b><div class="small muted">${[a.criteria.type, a.criteria.region].filter(Boolean).join(' · ') || 'Tous critères'}</div></div>
            <span class="chev">${icon('arrowRight', 15)}</span></button>`).join('')}
        </div>` : ''}

        <div class="card">
          <div class="row-between"><h3>Activité récente</h3>${activity.length ? `<button class="linkbtn small" data-action="notifications">Voir tout</button>` : ''}</div>
          ${activity.length ? activity.map(n => `<button class="list-item" data-action="open-notification" data-id="${n.id}" data-link="${esc(n.link || '')}">
            <div class="ic-bubble" style="background:var(--brand-soft);color:var(--brand)">${icon(activityIcon(n.text), 15)}</div>
            <div class="body"><b class="small" style="font-weight:${n.read ? 500 : 700}">${esc(n.text)}</b><div class="small muted">${dateTimeFr(n.createdAt)}</div></div>
            <span class="chev">${icon('arrowRight', 15)}</span></button>`).join('')
            : '<p class="small muted">Aucune activité pour le moment.</p>'}
        </div>

        <div class="promo-banner">
          <div class="scene-bg"><img src="${PHOTOS.bnPromo}" alt="" loading="lazy"></div>
          <div class="content">
            <h4>Un bien à louer ou à vendre ?</h4>
            <p>Publiez en quelques clics et touchez des locataires ou acheteurs vérifiés.</p>
            <a class="btn gold sm" href="#/register?role=owner">Devenir propriétaire</a>
          </div>
        </div>
      </div>
    </div>`);
});

route(/^\/client\/favorites$/, () => {
  const u = Auth.guard('client'); if (!u) return false;
  const favs = DB.filterItems(DB.K.favorites, f => f.userId === u.id);
  const props = favs.map(f => DB.findItem(DB.K.properties, f.propertyId)).filter(Boolean);
  return shellApp(u, page('Mes favoris', `${props.length} bien${props.length > 1 ? 's' : ''} enregistré${props.length > 1 ? 's' : ''}`) +
    (props.length ? `<div class="props">${props.map(p => propertyCard(p, favs.map(f => f.propertyId))).join('')}</div>`
      : `<div class="empty"><b>Aucun favori</b><p class="small">Ajoutez un bien depuis la recherche pour le retrouver ici.</p><a class="btn sm" href="#/search">Rechercher un bien</a></div>`));
});

route(/^\/client\/visits$/, () => {
  const u = Auth.guard('client'); if (!u) return false;
  const visits = DB.filterItems(DB.K.visits, v => v.clientId === u.id);
  return shellApp(u, page('Mes demandes et visites', 'Suivi de vos demandes envoyées aux propriétaires.') +
    (visits.length ? `<div class="table-wrap"><table><thead><tr><th>Bien</th><th>Date souhaitée</th><th>Message</th><th>Statut</th><th></th></tr></thead><tbody>
      ${visits.map(v => { const p = DB.findItem(DB.K.properties, v.propertyId) || {};
        return `<tr><td><b>${esc(p.title || '—')}</b><div class="small muted">${esc(p.quartier || '')}</div></td>
          <td>${dateFr(v.date)}<div class="small muted">${esc(v.time)}</div></td>
          <td class="small muted">${esc(v.message || '—')}</td><td>${badge(VISIT_LABEL[v.status], VISIT_TONE[v.status])}</td>
          <td><a class="btn ghost sm" href="#/property/${v.propertyId}">Voir</a></td></tr>`; }).join('')}
      </tbody></table></div>`
      : `<div class="empty"><b>Aucune demande envoyée</b><p class="small">Demandez une visite depuis la fiche d'un bien.</p></div>`));
});

route(/^\/client\/alerts$/, () => {
  const u = Auth.guard('client'); if (!u) return false;
  const alerts = DB.filterItems(DB.K.searches, s => s.userId === u.id);
  return shellApp(u, page('Mes alertes', 'Vous êtes prévenu dès qu\'une annonce correspond à vos critères.', `<a class="btn sm" href="#/search">Créer une alerte depuis la recherche</a>`) +
    (alerts.length ? `<div class="stack">${alerts.map(a => {
      const c = a.criteria, n = published().filter(p => (!c.type || p.type === c.type) && (!c.region || p.region === c.region) && (!c.min || p.price >= c.min) && (!c.max || p.price <= c.max)).length;
      return `<div class="card row-between"><div><b>${esc(a.name)}</b>
        <div class="small muted">${[c.transaction && TRANSACTION_LABEL[c.transaction], c.type, c.region, c.min && `à partir de ${money(c.min)}`, c.max && `jusqu'à ${money(c.max)}`].filter(Boolean).join(' · ')}</div>
        <div class="small" style="color:var(--brand)">${n} annonce${n > 1 ? 's' : ''} correspondante${n > 1 ? 's' : ''}</div></div>
        <div class="row"><button class="btn soft sm" data-action="run-alert" data-id="${a.id}">Voir les résultats</button>
        <button class="btn ghost sm" data-action="del-alert" data-id="${a.id}">Supprimer</button></div></div>`;
    }).join('')}</div>` : `<div class="empty"><b>Aucune alerte</b><p class="small">Lancez une recherche puis enregistrez-la pour être alerté.</p></div>`));
});

route(/^\/client\/profile$|^\/owner\/profile$/, () => {
  const u = Auth.current(); if (!u) { go('#/login'); return false; }
  const pays = DB.filterItems(DB.K.payments, p => p.userId === u.id);
  return shellApp(u, page('Mon profil', 'Informations de votre compte DEUKSIL.') + `
    <div class="two-col">
      <form class="card" data-action="save-profile">
        <div class="row" style="margin-bottom:18px;gap:14px">
          <label style="position:relative;cursor:pointer">
            ${avatarHtml(u, 56)}
            <input type="file" accept="image/*" data-action="avatar-upload" style="display:none">
            <span style="position:absolute;right:-4px;bottom:-4px;background:var(--brand);color:#fff;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;box-shadow:var(--sh-1)">${icon('upload', 11)}</span>
          </label>
          <div><b>${esc(u.role === 'agency' ? u.agencyName : u.firstName + ' ' + u.lastName)}</b><div class="small muted">Membre depuis ${dateFr(u.createdAt)}</div>
            ${u.avatarPhoto ? `<button type="button" class="linkbtn small" data-action="avatar-remove">Retirer la photo</button>` : ''}</div></div>
        ${u.role === 'agency' ? `<div class="field"><label>Nom de l'agence</label><input class="input" name="agencyName" value="${esc(u.agencyName || '')}"></div>
          <div class="field"><label>Description</label><textarea name="agencyDesc">${esc(u.agencyDesc || '')}</textarea></div>
          <div class="field"><label>Adresse</label><input class="input" name="address" value="${esc(u.address || '')}"></div>` : ''}
        <div class="form-grid">
          <div class="field"><label>Prénom</label><input class="input" name="firstName" value="${esc(u.firstName)}"></div>
          <div class="field"><label>Nom</label><input class="input" name="lastName" value="${esc(u.lastName)}"></div></div>
        <div class="form-grid">
          <div class="field"><label>Téléphone</label><input class="input" name="phone" value="${esc(u.phone)}"></div>
          ${u.cni ? `<div class="field"><label>Numéro de CNI</label><input class="input" value="${esc(u.cni)}" disabled></div>`
            : `<div class="field"><label>Numéro de CNI</label><input class="input" name="cni" inputmode="numeric" maxlength="13" placeholder="13 chiffres"><p class="small muted" style="margin:4px 0 0">Demandé avant de publier une annonce. Une fois enregistré, il n'est plus modifiable.</p></div>`}</div>
        <button class="btn">Enregistrer les modifications</button>
      </form>
      <div class="stack" style="gap:14px">
        <div class="card"><h3>Compte</h3>
          <div class="row-between small"><span>Type</span><b>${{client:'Client', owner:'Propriétaire', agency:'Agence'}[u.role]}</b></div>
          <div class="row-between small"><span>Statut</span>${badge(u.status, u.status === 'actif' ? 'ok' : 'warn')}</div>
          <div class="row-between small"><span>Inscription</span><b>${dateFr(u.createdAt)}</b></div></div>
        <div class="card"><h3>Mes paiements</h3>
          ${pays.length ? pays.map(p => `<div class="row-between small" style="padding:7px 0;border-bottom:1px solid var(--line)">
            <span>${esc(p.type)}<br><span class="muted">${esc(p.ref)}</span></span><b>${money(p.amount)}</b></div>`).join('') : '<p class="small muted">Aucun paiement.</p>'}</div>
      </div></div>`);
});

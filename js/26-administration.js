/* ==========================================================================
   VUES : administration
   ========================================================================== */
route(/^\/admin\/dashboard$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  const users = DB.getData(DB.K.users), props = DB.getData(DB.K.properties), pays = DB.getData(DB.K.payments);
  const revenue = pays.filter(p => p.status === 'paye').reduce((s, p) => s + p.amount, 0);
  const pending = props.filter(p => p.listingStatus === 'attente');
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleDateString('fr-FR', {month:'short'});
    return [label, users.filter(x => new Date(x.createdAt) <= d).length];
  });
  return shellApp(u, `
    ${page('Administration DEUKSIL', 'Vue consolidée de la plateforme.', pending.length ? `<a class="btn" href="#/admin/listings">${pending.length} annonce(s) à valider</a>` : '')}
    <div class="kpis">
      ${kpiRich(users.length, 'Utilisateurs', 'users', 'brand', null)}
      ${kpiRich(users.filter(x => x.role === 'owner').length, 'Propriétaires', 'home', 'info', null)}
      ${kpiRich(users.filter(x => x.role === 'agency').length, 'Agences', 'building', 'gold', null)}
      ${kpiRich(props.length, 'Biens', 'grid', 'brand', null)}
      ${kpiRich(props.filter(p => p.listingStatus === 'publiee').length, 'Annonces publiées', 'checkCircle', 'ok', null)}
      ${kpiRich(DB.getData(DB.K.reports).filter(r => r.status === 'nouveau').length, 'Signalements à traiter', 'alert', 'bad', null)}
      ${kpiRich(DB.getData(DB.K.messages).length, 'Messages échangés', 'message', 'gold', null)}
      ${kpiRich(DB.getData(DB.K.visits).length, 'Visites', 'calendar', 'bad', null)}
    </div>
    <div class="two-col" style="margin-top:20px">
      <div class="card"><h3>Croissance des comptes</h3>${lineChart(months)}</div>
      <div class="card"><h3>Annonces par catégorie</h3>
        ${donutList(Object.entries(props.reduce((a, p) => (a[TRANSACTION_LABEL[p.transaction]] = (a[TRANSACTION_LABEL[p.transaction]] || 0) + 1, a), {})))}</div>
    </div>
    <div class="two-col" style="margin-top:18px">
      <div class="card"><h3>À valider</h3>${pending.length ? pending.map(p => { const o = DB.findItem(DB.K.users, p.ownerId) || {};
        return `<div class="list-item">
          <div class="ic-bubble" style="background:var(--warn-soft);color:var(--warn)">${icon('home', 15)}</div>
          <div class="body"><b class="small">${esc(p.title)}</b><div class="small muted">${esc(p.quartier)} · ${money(p.price)}</div></div>
          <div class="row" style="gap:6px"><button class="btn sm" data-action="validate" data-id="${p.id}">${icon('check', 15)}</button>
          <button class="btn ghost sm" data-action="reject" data-id="${p.id}">${icon('close', 15)}</button></div></div>`; }).join('')
        : '<p class="small muted">Aucune annonce en attente.</p>'}</div>
      <div class="card"><h3>Activité récente</h3>${DB.getData(DB.K.activity).slice(-7).reverse().map(a =>
        `<div class="list-item" style="cursor:default"><div class="ic-bubble" style="background:var(--brand-soft);color:var(--brand)">${icon('sparkle', 14)}</div>
          <div class="body"><b class="small" style="font-weight:500">${esc(a.text)}</b><div class="small muted">${dateTimeFr(a.createdAt)}</div></div></div>`).join('')}</div>
    </div>`);
});

route(/^\/admin\/users$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  const users = DB.getData(DB.K.users).filter(x => x.role !== 'admin');
  return shellApp(u, page('Utilisateurs', `${users.length} comptes hors administration.`) + `
    <div class="table-wrap"><table><thead><tr><th>Utilisateur</th><th>CNI</th><th>Téléphone</th><th>Rôle</th><th>Statut</th><th>Inscrit le</th><th>Actions</th></tr></thead><tbody>
      ${users.map(x => `<tr><td><div class="row">${avatarHtml(x, 36)}
          <div><b class="small">${esc(displayName(x))}</b>${x.role === 'agency' ? `<div class="small muted">${esc(x.address || '')}</div>` : ''}</div></div></td>
        <td class="small">${esc(x.cni)}</td><td class="small">${esc(x.phone)}</td>
        <td>${badge({client:'Client', owner:'Propriétaire', agency:'Agence'}[x.role], x.role === 'agency' ? 'gold' : 'info')}</td>
        <td>${badge(x.status, x.status === 'actif' ? 'ok' : x.status === 'suspendu' ? 'bad' : 'warn')}</td>
        <td class="small">${dateFr(x.createdAt)}</td>
        <td><div class="row" style="gap:6px">
          <button class="btn ghost sm" data-action="user-toggle" data-id="${x.id}">${x.status === 'suspendu' ? 'Réactiver' : 'Suspendre'}</button>
          <button class="btn ghost sm" data-action="user-del" data-id="${x.id}">Supprimer</button></div></td></tr>`).join('')}
    </tbody></table></div>`);
});

let bulkSelected = [];
route(/^\/admin\/listings$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  const props = DB.getData(DB.K.properties);
  const groups = [['attente', 'En attente de validation'], ['publiee', 'Publiées'], ['refusee', 'Refusées'], ['pause', 'En pause'], ['brouillon', 'Brouillons'], ['archivee', 'Archivées']];
  return shellApp(u, page('Validation des annonces', 'Une annonce validée devient visible dans la recherche.') +
    groups.map(([k, label]) => {
      const list = props.filter(p => p.listingStatus === k);
      if (!list.length) return '';
      const bulk = k === 'attente';
      const selHere = bulk ? bulkSelected.filter(id => list.some(p => p.id === id)) : [];
      return `<div class="row-between" style="margin:22px 0 10px"><h3 style="margin:0">${label} <span class="muted small">(${list.length})</span></h3>
          ${bulk && selHere.length ? `<div class="row" style="gap:8px">
            <span class="small muted">${selHere.length} sélectionnée${selHere.length > 1 ? 's' : ''}</span>
            <button class="btn sm" data-action="bulk-validate">${icon('checkSquare', 15)} Valider la sélection</button>
            <button class="btn ghost sm" data-action="bulk-reject">${icon('close', 15)} Refuser la sélection</button>
          </div>` : ''}</div>
        <div class="table-wrap"><table><thead><tr>
          ${bulk ? `<th style="width:34px"><input type="checkbox" data-action="bulk-toggle-all" ${selHere.length === list.length ? 'checked' : ''} aria-label="Tout sélectionner"></th>` : ''}
          <th>Annonce</th><th>Auteur</th><th>Prix</th><th>Localisation</th><th>Actions</th></tr></thead><tbody>
        ${list.map(p => { const o = DB.findItem(DB.K.users, p.ownerId) || {};
          return `<tr>${bulk ? `<td><input type="checkbox" data-action="bulk-toggle" data-id="${p.id}" ${bulkSelected.includes(p.id) ? 'checked' : ''} aria-label="Sélectionner ${esc(p.title)}"></td>` : ''}
            <td><b class="small">${esc(p.title)}</b><div class="small muted">${esc(p.type)} · ${TRANSACTION_LABEL[p.transaction]}</div></td>
            <td class="small">${esc(displayName(o))}</td><td>${money(p.price)}</td><td class="small">${esc(p.quartier)}, ${esc(p.city)}</td>
            <td><div class="row" style="gap:6px"><a class="btn ghost sm" href="#/property/${p.id}">Voir</a>
              ${k !== 'publiee' ? `<button class="btn sm" data-action="validate" data-id="${p.id}">${icon('check', 15)} Valider</button>` : ''}
              ${k !== 'refusee' ? `<button class="btn ghost sm" data-action="reject" data-id="${p.id}">${icon('close', 15)} Refuser</button>` : ''}</div></td></tr>`; }).join('')}
        </tbody></table></div>`;
    }).join(''));
});

route(/^\/admin\/properties$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  const props = DB.getData(DB.K.properties);
  return shellApp(u, page('Tous les biens', `${props.length} biens référencés sur la plateforme.`) + `
    <div class="table-wrap"><table><thead><tr><th>Bien</th><th>Propriétaire</th><th>Transaction</th><th>Prix</th><th>Statut</th><th>Annonce</th><th>Vues</th></tr></thead><tbody>
    ${props.map(p => { const o = DB.findItem(DB.K.users, p.ownerId) || {};
      return `<tr><td><b class="small">${esc(p.title)}</b><div class="small muted">${esc(p.quartier)}, ${esc(p.city)}</div></td>
        <td class="small">${esc(displayName(o))}</td><td>${TRANSACTION_LABEL[p.transaction]}</td><td>${money(p.price)}</td>
        <td>${badge(STATUS_LABEL[p.status], STATUS_TONE[p.status])}</td><td>${badge(LISTING_LABEL[p.listingStatus], LISTING_TONE[p.listingStatus])}</td>
        <td>${p.views || 0}</td></tr>`; }).join('')}</tbody></table></div>`);
});



route(/^\/admin\/reports$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  const props = DB.getData(DB.K.properties), users = DB.getData(DB.K.users), pays = DB.getData(DB.K.payments);
  const byRegion = Object.entries(props.reduce((a, p) => (a[p.region] = (a[p.region] || 0) + 1, a), {}));
  const revenueByType = Object.entries(pays.filter(p => p.status === 'paye').reduce((a, p) => (a[p.type] = (a[p.type] || 0) + p.amount, a), {}));
  return shellApp(u, page('Statistiques', 'Lecture consolidée de l\'activité.') + `
    <div class="two-col">
      <div class="card"><h3>Biens par région</h3>${barChart(byRegion.map(([r, n]) => [r.slice(0, 7), n]))}</div>
      <div class="card"><h3>Revenus par type</h3>${donutList(revenueByType.map(([t, v]) => [t + ' — ' + money(v), Math.round(v / 1000)]))}</div>
    </div>
    <div class="two-col" style="margin-top:18px">
      <div class="card"><h3>Comptes par rôle</h3>${donutList(Object.entries(users.reduce((a, x) => (a[x.role] = (a[x.role] || 0) + 1, a), {})))}</div>
      <div class="card"><h3>Transactions par type de bien</h3>${barChart(Object.entries(props.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {})).map(([t, n]) => [t.slice(0, 6), n]))}</div>
    </div>`);
});

route(/^\/admin\/settings$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  return shellApp(u, page('Paramètres', 'Modèle économique et outils de démonstration.') + `
    <div class="two-col">
      <div class="card"><h3>Modèle économique</h3>
        <p class="small">DEUKSIL est <b>gratuit</b> : aucun frais d'inscription, aucun abonnement et aucune commission sur les loyers ou les ventes.</p>
        <p class="small muted">Les comptes sont actifs dès leur création. Les paiements visibles dans la plateforme sont ceux que les propriétaires et agences encaissent auprès de leurs propres locataires et clients.</p></div>
      <div class="card"><h3>Données de démonstration</h3>
        <p class="small muted">Toutes les données vivent dans le <code>localStorage</code> de ce navigateur. Vous pouvez repartir du jeu initial à tout moment.</p>
        <div class="stack"><button class="btn ghost" data-action="export-data">Exporter les données (JSON)</button>
          <button class="btn danger" data-action="reset-demo">Réinitialiser la démonstration</button></div></div>
    </div>`);
});

/* ==========================================================================
   VUES : espace agence
   ========================================================================== */
route(/^\/agency\/dashboard$/, () => {
  const u = Auth.guard('agency'); if (!u) return false;
  const props = myProps(u);
  const agents = DB.filterItems(DB.K.agents, a => a.agencyId === u.id);
  const visits = DB.filterItems(DB.K.visits, v => v.ownerId === u.id);
  const leads = DB.getData(DB.K.messages).filter(t => t.participants.includes(u.id)).length;
  const pending = visits.filter(v => v.status === 'attente');
  return shellApp(u, `
    <div class="hero-banner" style="min-height:170px">
      <div class="scene-bg"><img src="${PHOTOS.bnAgency}" alt="" loading="lazy"></div>
      <div class="content">
        <span class="wave">${esc(u.agencyName)}</span>
        <h1 style="font-size:1.5rem">${props.length} bien${props.length > 1 ? 's' : ''} · ${agents.length} agent${agents.length > 1 ? 's' : ''}</h1>
        <div class="hero-pills">
          <a href="#/owner/property/new">${icon('plus', 15)} Ajouter un bien</a>
          <a href="#/agency/agents">${icon('agent', 15)} Gérer les agents</a>
        </div>
      </div>
    </div>
    <div class="kpis" style="margin-top:20px">
      ${kpiRich(props.length, 'Biens gérés', 'building', 'brand', null)}
      ${kpiRich(props.filter(p => p.transaction === 'location').length, 'Locations', 'home', 'info', null)}
      ${kpiRich(props.filter(p => p.transaction === 'vente').length, 'Ventes', 'money', 'gold', null)}
      ${kpiRich(props.filter(p => p.transaction === 'terrain').length, 'Terrains', 'land', 'ok', null)}
      ${kpiRich(agents.filter(a => a.status === 'actif').length, 'Agents actifs', 'agent', 'brand', null)}
      ${kpiRich(leads, 'Leads', 'message', 'bad', null)}
    </div>
    <div class="two-col" style="margin-top:18px">
      <div class="stack" style="gap:18px">
        <div class="card"><h3>Vues par bien</h3>${barChart(props.slice(0, 8).map(p => [p.quartier.slice(0, 7), p.views || 0]))}</div>
        <div class="card"><h3>Répartition du portefeuille</h3>${donutList(Object.entries(props.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {})))}</div>
      </div>
      <div class="card">
        <div class="row-between"><h3>Visites à traiter</h3>${pending.length ? `<a class="linkbtn small" href="#/agency/visits">Tout voir</a>` : ''}</div>
        ${pending.length ? pending.slice(0, 6).map(v => { const c = typeof clientVisite === 'function' ? clientVisite(v) : (DB.findItem(DB.K.users, v.clientId) || {});
          return `<div class="list-item">${avatarHtml(c, 34)}
            <div class="body"><b class="small">${esc(displayName(c))}</b><div class="small muted">${dateFr(v.date)} à ${esc(v.time)}</div></div>
            <button class="btn sm" data-action="visit-status" data-id="${v.id}" data-s="acceptee">Accepter</button></div>`; }).join('')
          : '<p class="small muted">Aucune demande en attente.</p>'}
      </div>
    </div>`);
});

route(/^\/agency\/agents$/, () => {
  const u = Auth.guard('agency'); if (!u) return false;
  const agents = DB.filterItems(DB.K.agents, a => a.agencyId === u.id);
  return shellApp(u, page('Agents', `${agents.length} agent${agents.length > 1 ? 's' : ''} dans votre équipe`,
    `<button class="btn" data-action="add-agent">${icon('plus', 16)} Ajouter un agent</button>`) +
    (agents.length ? `<div class="table-wrap"><table><thead><tr><th>Agent</th><th>Téléphone</th><th>CNI</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
      ${agents.map(a => `<tr><td><div class="row">${avatarHtml(a, 36)}<b class="small">${esc(a.firstName)} ${esc(a.lastName)}</b></div></td>
        <td class="small">${esc(a.phone)}</td><td class="small">${esc(a.cni)}</td><td class="small">${esc(a.role)}</td>
        <td>${badge(a.status, a.status === 'actif' ? 'ok' : a.status === 'suspendu' ? 'bad' : '')}</td>
        <td><div class="row" style="gap:6px"><button class="btn ghost sm" data-action="agent-toggle" data-id="${a.id}">${a.status === 'actif' ? 'Désactiver' : 'Activer'}</button>
        <button class="btn ghost sm" data-action="agent-del" data-id="${a.id}">Supprimer</button></div></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><b>Aucun agent</b><p class="small">Ajoutez vos collaborateurs pour leur confier des mandats.</p></div>`));
});

route(/^\/agency\/clients$/, () => {
  const u = Auth.guard('agency'); if (!u) return false;
  const propIds = myProps(u).map(p => p.id);
  const clientIds = [...new Set([
    ...DB.getData(DB.K.visits).filter(v => propIds.includes(v.propertyId)).map(v => v.clientId),
    ...DB.getData(DB.K.messages).filter(t => t.participants.includes(u.id)).map(t => t.participants.find(p => p !== u.id))
  ])].filter(Boolean);
  const clients = clientIds.map(id => DB.findItem(DB.K.users, id)).filter(Boolean);
  return shellApp(u, page('Clients', 'Les personnes ayant contacté votre agence ou demandé une visite.') +
    (clients.length ? `<div class="table-wrap"><table><thead><tr><th>Client</th><th>Téléphone</th><th>Demandes</th><th>Inscription</th><th></th></tr></thead><tbody>
      ${clients.map(c => `<tr><td><div class="row">${avatarHtml(c, 36)}<b class="small">${esc(displayName(c))}</b></div></td>
        <td class="small"><a href="${telHref(c.phone)}" style="color:inherit;text-decoration:none">${icon('phone', 11)} ${esc(c.phone)}</a></td><td>${DB.getData(DB.K.visits).filter(v => v.clientId === c.id && propIds.includes(v.propertyId)).length}</td>
        <td class="small">${dateFr(c.createdAt)}</td><td><button class="btn ghost sm" data-action="message-user" data-id="${c.id}">Écrire</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty"><b>Aucun client pour l'instant</b><p class="small">Les contacts apparaissent dès la première demande sur un de vos biens.</p></div>`));
});

route(/^\/agency\/settings$/, () => {
  const u = Auth.guard('agency'); if (!u) return false;
  const prefs = u.notifPrefs || {email: true, sms: false, newRequest: true, newMessage: true};
  return shellApp(u, page('Paramètres de l\'agence', 'Informations générales, préférences et zone de danger.') + `
    <div class="two-col">
      <div class="stack" style="gap:18px">
        <form class="card" data-action="save-agency-settings">
          <h3 style="margin-bottom:14px">Informations générales</h3>
          <div class="field"><label>Nom de l'agence</label><input class="input" name="agencyName" value="${esc(u.agencyName || '')}"></div>
          <div class="field"><label>Description</label><textarea name="agencyDesc">${esc(u.agencyDesc || '')}</textarea></div>
          <div class="form-grid">
            <div class="field"><label>Adresse</label><input class="input" name="address" value="${esc(u.address || '')}"></div>
            <div class="field"><label>Heures d'ouverture</label><input class="input" name="hours" value="${esc(u.hours || 'Lun–Sam, 9h–18h')}"></div>
          </div>
          <button class="btn">Enregistrer</button>
        </form>
        <form class="card" data-action="save-notif-prefs">
          <h3 style="margin-bottom:14px">Notifications</h3>
          <label class="check" style="margin-bottom:10px"><input type="checkbox" name="email" ${prefs.email ? 'checked' : ''}>Recevoir les notifications par e-mail (simulation)</label><br>
          <label class="check" style="margin-bottom:10px"><input type="checkbox" name="sms" ${prefs.sms ? 'checked' : ''}>Recevoir les notifications par SMS (simulation)</label><br>
          <label class="check" style="margin-bottom:10px"><input type="checkbox" name="newRequest" ${prefs.newRequest ? 'checked' : ''}>Alerte à chaque nouvelle demande de visite</label><br>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" name="newMessage" ${prefs.newMessage ? 'checked' : ''}>Alerte à chaque nouveau message</label>
          <button class="btn ghost">Enregistrer les préférences</button>
        </form>
      </div>
      <div class="card" style="border-color:var(--bad)">
        <h3 style="color:var(--bad)">Zone de danger</h3>
        <p class="small muted">Ces actions sont définitives et ne peuvent pas être annulées.</p>
        <button class="btn danger sm" data-action="delete-account">Supprimer mon compte agence</button>
      </div>
    </div>`);
});

route(/^\/agency\/commissions$/, () => {
  const u = Auth.guard('agency'); if (!u) return false;
  const closed = myProps(u).filter(p => ['loue', 'vendu'].includes(p.status));
  const rows = closed.map(p => ({p, rate: p.status === 'vendu' ? 0.03 : 1, amount: p.status === 'vendu' ? p.price * 0.03 : p.price}));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return shellApp(u, page('Commissions', 'Simulation : 3 % sur les ventes, un mois de loyer sur les locations.') + `
    <div class="kpis">${kpi(closed.length, 'Transactions conclues')}${kpi(money(total), 'Commissions estimées', 'brand')}</div>
    <div style="margin-top:18px">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Bien</th><th>Type</th><th>Montant du bien</th><th>Commission</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b class="small">${esc(r.p.title)}</b></td><td>${badge(STATUS_LABEL[r.p.status], STATUS_TONE[r.p.status])}</td>
        <td>${money(r.p.price)}</td><td><b>${money(Math.round(r.amount))}</b></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><b>Aucune transaction conclue</b><p class="small">Passez un bien en « Loué » ou « Vendu » pour voir la commission estimée.</p></div>`}</div>`);
});

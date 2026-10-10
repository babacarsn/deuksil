/* ==========================================================================
   MODULE : fiche.js — fiche d'un bien en six onglets (§6 du cahier des
   charges). Aucun défilement horizontal sur mobile : onglets en grille fixe
   et listes en cartes au lieu de tableaux.
   ========================================================================== */
const BTABS = [['apercu', 'Vue générale', 'Vue', 'home'], ['unites', 'Unités', 'Unités', 'building'], ['finances', 'Finances', 'Finances', 'money'],
  ['travaux', 'Maintenance', 'Travaux', 'settings'], ['docs', 'Documents', 'Docs', 'file'], ['suivi', 'Historique', 'Suivi', 'clock']];
const USTAT = {vacante:['Vacante', 'warn'], 'occupée':['Louée', 'info'], maintenance:['En maintenance', 'warn'], archivee:['Archivée', '']};
document.head.insertAdjacentHTML('beforeend', '<style>'
  + '.btabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:20px;overflow:visible}'
  + '.btabs a{display:flex;align-items:center;gap:7px;padding:11px 13px;text-decoration:none;color:var(--muted);font-size:.9rem;font-weight:500;border-bottom:2.5px solid transparent;white-space:nowrap}'
  + '.btabs a.on{color:var(--ink);font-weight:600;border-bottom-color:var(--brand)}'
  + '.btabs a .lb{display:inline} .btabs a .sb{display:none}'
  + '.bcard{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:var(--r-card);padding:13px 14px;margin-bottom:9px}'
  + '.bcard:hover{border-color:var(--brand)}'
  + '.bcard .top{display:flex;align-items:center;gap:9px;margin-bottom:5px;min-width:0}'
  + '.bcard .top > b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.bcard .top > .badge{flex:none;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.bcard .amt{margin-left:auto;font-weight:700;flex:none}'
  + '.bcard .sub{font-size:.8rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.bgrid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px;align-items:start}'
  + '.binfo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px 18px}'
  + '.binfo .k{font-size:.75rem;color:var(--muted);margin-bottom:2px} .binfo .v{font-weight:600}'
  + '@media (max-width:760px){'
  + '.btabs{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;background:var(--surface-2);border:1px solid var(--line);border-radius:14px;padding:6px 5px;margin-bottom:14px}'
  + '.btabs a{flex-direction:column;gap:3px;padding:5px 1px;border-radius:10px;border-bottom:0;font-size:.56rem;font-weight:600;min-width:0;text-align:center}'
  + '.btabs a.on{background:var(--brand);color:var(--brand-ink)}'
  + '.btabs a .lb{display:none} .btabs a .sb{display:inline}'
  + '.bgrid{grid-template-columns:1fr;gap:14px}'
  + '.binfo{grid-template-columns:1fr 1fr}'
  + '}</style>');

const bUnits = (u, p) => gMine('units', u).filter(x => x.propertyId === p.id);
const bLeases = (u, p) => gMine('leases', u).filter(l => l.propertyId === p.id);
const bRents = (u, p) => { const ids = bLeases(u, p).map(l => l.id); return gMine('rents', u).filter(r => ids.includes(r.leaseId)); };
const bExp = (u, p) => gMine('expenses', u).filter(x => x.propertyId === p.id);
const bTick = (u, p) => gMine('tickets', u).filter(t => t.propertyId === p.id);
function bFin(u, p, year) {
  const Y = String(year), rents = bRents(u, p).filter(r => r.paidAt && r.paidAt.startsWith(Y)).reduce((s, r) => s + r.amount, 0);
  const fact = horsVentes(gMine('fpay', u)).filter(x => x.propertyId === p.id && x.createdAt.startsWith(Y)).reduce((s, x) => s + x.amount, 0);
  const dep = bExp(u, p).filter(x => x.date.startsWith(Y)).reduce((s, x) => s + x.amount, 0)
    + bTick(u, p).filter(t => !t.expenseId && (t.createdAt || '').startsWith(Y)).reduce((s, t) => s + t.cost, 0);
  const impayes = bRents(u, p).filter(r => !r.paidAt && rentState(r)[1] === 'bad').reduce((s, r) => s + r.amount, 0);
  return {rev: rents + fact, dep, impayes, net: rents + fact - dep};
}
/* une unité implicite pour un bien sans unité déclarée */
function bUnitRows(u, p) {
  const us = bUnits(u, p), act = bLeases(u, p).filter(l => l.status === 'actif');
  if (us.length) return us.map(x => { const l = x.leaseId && DB.findItem(DB.K.leases, x.leaseId);
    return {ref: x.ref, meta: [x.floor, x.rooms ? x.rooms + ' pièces' : '', x.surface ? x.surface + ' m²' : ''].filter(Boolean).join(' · '),
      rent: x.rent, status: x.status, lease: l, id: x.id}; });
  const l = act.find(x => !x.unitId);
  return [{ref: p.title, meta: [p.type, p.rooms ? p.rooms + ' pièces' : '', p.surface ? p.surface + ' m²' : ''].filter(Boolean).join(' · '),
    rent: l ? l.rent : p.price, status: l ? 'occupée' : 'vacante', lease: l, id: '', implicite: true}];
}
function unitCard(u, row) {
  const late = row.lease && gMine('rents', u).some(r => r.leaseId === row.lease.id && !r.paidAt && rentState(r)[1] === 'bad');
  const [lab, tone] = late ? ['Loyer en retard', 'bad'] : (USTAT[row.status] || USTAT.vacante);
  const sub = row.lease ? `${esc(row.lease.tenant)}${row.meta ? ' · ' + esc(row.meta) : ''} · bail jusqu'au ${dateFr(leaseEnd(row.lease))}` : `Libre${row.meta ? ' · ' + esc(row.meta) : ''}`;
  const href = row.lease ? '#/manage/tenants' : '#/manage/units';
  return `<a class="bcard" href="${href}"${late ? ' style="border-color:#F3D3D6;background:var(--bad-soft)"' : ''}>
    <div class="top"><b>${esc(row.ref)}</b>${badge(lab, tone)}<span class="amt">${money(row.rent)}</span></div>
    <div class="sub">${sub}</div></a>`;
}
function ficheTab(u, p, tab) {
  const y = yr();
  if (tab === 'unites') {
    const rows = bUnitRows(u, p), occ = rows.filter(r => r.status === 'occupée').length;
    return `<div class="kpis" style="margin-bottom:16px">${kpi(rows.length, 'Unités')}${kpi(occ, 'Louées', 'ok')}${kpi(rows.length - occ, 'Vacantes', rows.length - occ ? 'warn' : '')}${kpi((rows.length ? Math.round(occ / rows.length * 100) : 0) + ' %', 'Occupation', 'brand')}</div>
      ${rows.map(r => unitCard(u, r)).join('')}
      ${bUnits(u, p).length ? '' : '<p class="small muted">Ce bien n\'a pas d\'unités déclarées : il compte pour une seule unité. Ajoutez-en depuis Gestion &rsaquo; Unités si c\'est un immeuble.</p>'}
      <div style="margin-top:14px"><a class="btn sm" href="#/manage/units">${icon('plus', 15)} Ajouter une unité</a></div>`;
  }
  if (tab === 'finances') {
    const f = bFin(u, p, y), cats = {};
    bExp(u, p).filter(x => x.date.startsWith(String(y))).forEach(x => cats[x.cat] = (cats[x.cat] || 0) + x.amount);
    const rend = p.transaction !== 'location' && p.price ? (f.net / p.price * 100).toFixed(1) + ' %' : '—';
    return `<div class="kpis" style="margin-bottom:16px">${kpi(money(f.rev), 'Revenus ' + y, 'ok')}${kpi(money(f.impayes), 'Impayés', f.impayes ? 'bad' : '')}${kpi(money(f.dep), 'Dépenses')}${kpi(money(f.net), 'Revenu net', 'brand')}</div>
      <div class="bgrid">
        <div class="card"><h3 style="margin-top:0">Loyers du bien</h3>
          ${bRents(u, p).slice().sort((a, b) => a.month < b.month ? 1 : -1).slice(0, 8).map(r => { const [lab, tone] = rentState(r), l = DB.findItem(DB.K.leases, r.leaseId) || {};
            return `<div class="bcard" style="cursor:default"><div class="top"><b>${monthLabel(r.month)}</b>${badge(lab, tone)}<span class="amt">${money(r.amount)}</span></div><div class="sub">${esc(l.tenant || '')}</div></div>`; }).join('')
            || '<p class="small muted">Aucun loyer enregistré pour ce bien.</p>'}</div>
        <div class="stack" style="gap:14px">
          <div class="card"><h3 style="margin-top:0;font-size:.95rem">Dépenses par poste</h3>
            ${Object.entries(cats).map(([c, v]) => `<div class="row-between small" style="padding:6px 0"><span>${esc(c)}</span><b>${money(v)}</b></div>`).join('') || '<p class="small muted">Aucune dépense cette année.</p>'}</div>
          <div class="card"><h3 style="margin-top:0;font-size:.95rem">Rentabilité</h3><div style="font-size:1.6rem;font-weight:700">${rend}</div>
            <p class="small muted" style="margin:5px 0 0">${p.transaction === 'location' ? 'Calculée uniquement pour un bien mis en vente, dont le prix sert de base.' : 'Revenu net rapporté au prix du bien.'}</p></div>
        </div></div>`;
  }
  if (tab === 'travaux') {
    const tk = bTick(u, p).slice().reverse();
    return tk.map(t => `<a class="bcard" href="#/manage/tickets"><div class="top"><b>${esc(t.title)}</b>${badge(TICKET_LABEL[tkSt(t)] || tkSt(t), TICKET_TONE[tkSt(t)] || '')}<span class="amt">${money(t.cost)}</span></div>
      <div class="sub">${t.ref || ''}${t.providerId ? ' · ' + esc(provName(t.providerId)) : ''} · ${dateFr(t.createdAt)}</div></a>`).join('')
      || '<div class="empty"><b>Aucune intervention</b><p class="small">Les pannes et travaux de ce bien apparaîtront ici.</p></div>';
  }
  if (tab === 'docs') {
    const docs = DB.filterItems(DB.K.documents, d => d.ownerId === u.id && d.propertyId === p.id);
    const ctr = gMine('contracts', u).filter(c => c.propertyId === p.id);
    return (docs.length || ctr.length ? '' : '<div class="empty"><b>Aucun document</b><p class="small">Les contrats et pièces rattachés à ce bien apparaîtront ici.</p></div>')
      + ctr.map(c => `<a class="bcard" href="#/manage/contracts"><div class="top"><b>${c.ref}</b>${badge(CTYPE[c.type], 'info')}${badge(c.status, CTONE[c.status])}</div><div class="sub">${esc(c.party)} · ${dateFr(c.start)} → ${dateFr(c.end)}</div></a>`).join('')
      + docs.map(d => `<a class="bcard" href="#/coffre/${d.cat}"><div class="top"><b>${esc(d.name)}</b>${badge(VCAT[d.cat] ? VCAT[d.cat][0] : 'Document', '')}</div><div class="sub">Déposé le ${dateFr(d.createdAt)}</div></a>`).join('')
      + `<div style="margin-top:14px"><a class="btn sm ghost" href="#/coffre">${icon('plus', 15)} Ajouter un document</a></div>`;
  }
  if (tab === 'suivi') {
    const ev = [];
    bLeases(u, p).forEach(l => ev.push([l.createdAt, `Bail créé · ${l.tenant}`, money(l.rent) + ' / mois']));
    bRents(u, p).filter(r => r.paidAt).forEach(r => ev.push([r.paidAt, `Loyer payé · ${monthLabel(r.month)}`, money(r.amount)]));
    bTick(u, p).forEach(t => ev.push([t.createdAt, `Maintenance · ${t.title}`, TICKET_LABEL[tkSt(t)] || '']));
    bExp(u, p).forEach(x => ev.push([x.date, `Dépense · ${x.cat}`, money(x.amount)]));
    gMine('contracts', u).filter(c => c.propertyId === p.id).forEach(c => ev.push([c.createdAt, `Contrat ${c.ref}`, CTYPE[c.type]]));
    ev.sort((a, b) => (a[0] || '') < (b[0] || '') ? 1 : -1);
    return ev.length ? ev.slice(0, 40).map(([d, t, s]) => `<div class="bcard" style="cursor:default"><div class="top"><b>${esc(t)}</b><span class="amt small muted">${dateFr(d)}</span></div><div class="sub">${esc(s)}</div></div>`).join('')
      : '<div class="empty"><b>Aucun événement</b><p class="small">Les opérations sur ce bien seront tracées ici.</p></div>';
  }
  /* vue générale */
  const rows = bUnitRows(u, p), occ = rows.filter(r => r.status === 'occupée').length, pc = rows.length ? Math.round(occ / rows.length * 100) : 0;
  const loyer = rows.filter(r => r.status === 'occupée').reduce((s, r) => s + r.rent, 0);
  const m = curMonth(), rs = bRents(u, p);
  const att = rs.filter(r => r.month === m).reduce((s, r) => s + r.amount, 0);
  const enc = rs.filter(r => r.paidAt && r.paidAt.slice(0, 7) === m).reduce((s, r) => s + r.amount, 0);
  const imp = rs.filter(r => !r.paidAt && rentState(r)[1] === 'bad').reduce((s, r) => s + r.amount, 0);
  const dep = bExp(u, p).filter(x => x.date.slice(0, 7) === m).reduce((s, x) => s + x.amount, 0);
  const o = p.clientOwnerId && DB.findItem(DB.K.owners, p.clientOwnerId);
  const todo = [];
  if (imp) todo.push([`Loyer en retard`, money(imp), '#/manage/rents', 'money', 'orange']);
  const mnt = bTick(u, p).filter(t => tkSt(t) !== 'terminée');
  if (mnt.length) todo.push([`${mnt.length} intervention${mnt.length > 1 ? 's' : ''} en cours`, mnt[0].title, '#/manage/tickets', 'settings', '']);
  return `<div class="bgrid">
    <div class="stack" style="gap:18px;min-width:0">
      ${photoHtml(p, {style:'aspect-ratio:16/10;border-radius:var(--r-card)'})}
      <div class="card"><h3 style="margin-top:0">Informations principales</h3>
        <div class="binfo">
          <div><div class="k">Type</div><div class="v">${esc(p.type || '—')}</div></div>
          <div><div class="k">Surface</div><div class="v">${p.surface ? p.surface + ' m²' : '—'}</div></div>
          <div><div class="k">Pièces</div><div class="v">${p.rooms || '—'}</div></div>
          <div><div class="k">Région</div><div class="v">${esc(p.region || '—')}</div></div>
          <div><div class="k">Ville</div><div class="v">${esc(p.city || '—')}</div></div>
          <div><div class="k">Quartier</div><div class="v">${esc(p.quartier || '—')}</div></div>
        </div>
        ${p.description ? `<div style="height:1px;background:var(--line);margin:16px 0"></div><div class="k small muted" style="margin-bottom:4px">Description</div><p class="small" style="margin:0;line-height:1.6">${esc(p.description)}</p>` : ''}
      </div>
      ${o ? `<div class="card"><div class="row-between" style="margin-bottom:10px"><h3 style="margin:0">Propriétaire</h3><a class="small" href="#/manage/owners">Voir la fiche</a></div>
        <div class="row" style="gap:12px"><span class="itile sm">${icon('user', 17)}</span><div><b>${esc(o.name)}</b><div class="small muted">Commission ${commissionRate(u, o)} %</div></div></div></div>` : ''}
    </div>
    <div class="stack" style="gap:14px;min-width:0">
      <div class="card"><div class="small muted">Revenu mensuel</div><div style="font-size:1.55rem;font-weight:700;letter-spacing:-.02em">${money(loyer)}</div>
        <div style="height:8px;border-radius:6px;background:var(--surface-3);margin-top:12px"><div style="height:8px;width:${pc}%;border-radius:6px;background:var(--brand)"></div></div>
        <div class="small muted" style="margin-top:6px">${occ} unité${occ > 1 ? 's' : ''} louée${occ > 1 ? 's' : ''} sur ${rows.length} · ${pc} % d'occupation</div></div>
      <div class="card"><h3 style="margin-top:0;font-size:.95rem">${monthLabel(m)}</h3>
        <div class="row-between small" style="padding:6px 0"><span class="muted">Loyers attendus</span><b>${money(att)}</b></div>
        <div class="row-between small" style="padding:6px 0"><span class="muted">Encaissés</span><b style="color:var(--ok)">${money(enc)}</b></div>
        <div class="row-between small" style="padding:6px 0"><span class="muted">Impayés</span><b style="color:var(--bad)">${money(imp)}</b></div>
        <div class="row-between small" style="padding:6px 0"><span class="muted">Dépenses</span><b>${money(dep)}</b></div>
        <div style="height:1px;background:var(--line);margin:8px 0"></div>
        <div class="row-between"><b>Revenu net</b><b>${money(enc - dep)}</b></div></div>
      ${todo.length ? `<div class="card"><h3 style="margin-top:0;font-size:.95rem">À traiter sur ce bien</h3>
        ${todo.map(([t, d, h, ic, tint]) => `<a class="trow" href="${h}"><span class="itile sm ${tint}">${icon(ic, 16)}</span><div class="txt" style="min-width:0"><b>${esc(t)}</b><div class="sub">${esc(d)}</div></div>${icon('arrowRight', 16)}</a>`).join('')}</div>` : ''}
    </div></div>`;
}
route(/^\/bien\/([\w]+)(?:\/(apercu|unites|finances|travaux|docs|suivi))?$/, (pid, tab) => {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) { toast('Espace réservé aux propriétaires et agences.', 'bad'); go('#/login'); return false; }
  const p = DB.findItem(DB.K.properties, pid);
  if (!p || p.ownerId !== u.id) { toast('Ce bien ne vous appartient pas.', 'bad'); go(`#/${u.role}/properties`); return false; }
  tab = tab || 'apercu';
  const rows = bUnitRows(u, p);
  const head = `<div class="row-between" style="gap:16px;flex-wrap:wrap;margin-bottom:18px">
      <div style="min-width:0"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
        <h2 style="margin:0">${esc(p.title)}</h2>${badge(STATUS_LABEL[p.status] || p.status, STATUS_TONE[p.status] || '')}</div>
        <p class="small muted" style="margin:5px 0 0">${esc(p.type)} · ${esc(p.quartier)}, ${esc(p.city)} · ${rows.length} unité${rows.length > 1 ? 's' : ''}</p></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <a class="btn ghost sm" href="#/owner/property/${p.id}">Modifier</a>
        <a class="btn sm" href="#/manage/units">Ajouter une unité</a></div></div>`;
  const nav = `<div class="btabs">${BTABS.map(([k, lg, sb, ic]) => `<a class="${k === tab ? 'on' : ''}" href="#/bien/${p.id}/${k}">${icon(ic, 17)}<span class="lb">${lg}</span><span class="sb">${sb}</span></a>`).join('')}</div>`;
  return shellApp(u, backBar(`#/${u.role}/properties`, 'Mes biens', p.title) + head + nav + ficheTab(u, p, tab));
});

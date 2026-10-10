/* ==========================================================================
   MODULE : v9.js — unités d'immeuble, fiches locataires, rapports PDF/CSV,
   rappels automatiques, maintenance complète (MNT-…), tableaux (tri, pages)
   ========================================================================== */
Object.assign(DB.K, {units:'deuksil_units', autonotif:'deuksil_autonotif'});
GTABS.splice(1, 0, ['units', 'Unités'], ['tenants', 'Fiches locataires']);
GTABS.splice(GTABS.findIndex(t => t[0] === 'audit'), 0, ['reports', 'Rapports']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit|contracts|providers|team|identity|units|tenants|reports)$/;
const TKS = ['ouvert', 'assigné', 'en cours', 'résolu', 'fermé'], PRIO = {basse:['Basse', ''], normale:['Normale', 'info'], haute:['Haute', 'warn'], urgente:['Urgente', 'bad']};
Object.assign(TICKET_LABEL, {'assigné':'Assigné', 'résolu':'Résolu', 'fermé':'Fermé'}); Object.assign(TICKET_TONE, {'assigné':'info', 'résolu':'ok', 'fermé':''});
let tkSt = t => t.status === 'resolu' ? 'résolu' : t.status;
const csvBtn = k => `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn ghost sm" data-action="g3-csv" data-id="${k}">Exporter en CSV</button></div>`;
let tenantOf = l => DB.findItem(DB.K.users, x => x.leaseId === l.id);
const provName = id => (DB.findItem(DB.K.providers, id) || {}).name || '';
EXP.units = u => [['Bien', 'Unité', 'Étage', 'Surface', 'Loyer', 'Statut'], gMine('units', u).map(x => [(gProp(x.propertyId) || {}).title, x.ref, x.floor, x.surface, x.rent, x.status])];

/* ---------- Rapports ---------- */
const REP = {type:'revenus', year:new Date().getFullYear()};
const REPT = {revenus:'Revenus par mois', revenus_bien:'Revenus par bien', depenses:'Dépenses par catégorie', impayes:'Impayés', occupation:'Occupation', rentabilite:'Rentabilité par bien'};
function repData(u, type, y) {
  const Y = String(y), props = myProps(u), paid = gMine('rents', u).filter(r => r.paidAt && r.paidAt.startsWith(Y)), pays = horsVentes(gMine('fpay', u)).filter(p => p.createdAt.startsWith(Y));
  const exps = gMine('expenses', u).filter(x => x.date.startsWith(Y)), tk = gMine('tickets', u).filter(t => !t.expenseId && (t.createdAt || '').startsWith(Y));
  const lp = id => (DB.findItem(DB.K.leases, id) || {}).propertyId, sum = a => a.reduce((s, x) => s + (x.amount ?? x.cost ?? 0), 0);
  if (type === 'revenus') { const rows = [...Array(12)].map((_, i) => { const k = `${Y}-${String(i + 1).padStart(2, '0')}`, a = sum(paid.filter(r => r.paidAt.startsWith(k))), b = sum(pays.filter(p => p.createdAt.startsWith(k))); return [monthLabel(k), a, b, a + b]; });
    return {head: ['Mois', 'Loyers', 'Factures', 'Total'], rows, total: ['TOTAL', sum(paid), sum(pays), sum(paid) + sum(pays)]}; }
  if (type === 'revenus_bien') { const rows = props.map(p => { const a = sum(paid.filter(r => lp(r.leaseId) === p.id)), b = sum(pays.filter(x => x.propertyId === p.id)); return [p.title, a, b, a + b]; }); return {head: ['Bien', 'Loyers', 'Factures', 'Total'], rows, total: ['TOTAL', ...[1, 2, 3].map(i => rows.reduce((s, r) => s + r[i], 0))]}; }
  if (type === 'depenses') { const g = {}; exps.forEach(x => { g[x.cat] = g[x.cat] || [x.cat, 0, 0]; g[x.cat][1]++; g[x.cat][2] += x.amount; }); if (tk.length) g.tk = ['maintenance (tickets)', tk.length, sum(tk)];
    const rows = Object.values(g); return {head: ['Catégorie', 'Nombre', 'Montant'], rows, total: ['TOTAL', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)]}; }
  if (type === 'impayes') { const rows = [];
    gMine('rents', u).filter(r => !r.paidAt && rentState(r)[1] === 'bad').forEach(r => { const l = DB.findItem(DB.K.leases, r.leaseId) || {}; rows.push(['Loyer', monthLabel(r.month), l.tenant, (gProp(l.propertyId) || {}).title || '', d8(r.month + '-05'), r.amount]); });
    gMine('docs', u).filter(d => d.type === 'FAC' && dRest(d) > 0 && d.due < now().slice(0, 10)).forEach(d => rows.push(['Facture', d.ref, d.client, (gProp(d.propertyId) || {}).title || '', d8(d.due), dRest(d)]));
    return {head: ['Type', 'Référence', 'Débiteur', 'Bien', 'Échéance', 'Montant'], rows, total: ['TOTAL', '', '', '', '', rows.reduce((s, r) => s + r[5], 0)], money: [5]}; }
  if (type === 'occupation') { const us = gMine('units', u), ls = gMine('leases', u).filter(l => l.status === 'actif');
    const rows = props.map(p => { const pu = us.filter(x => x.propertyId === p.id), n = pu.length || 1, o = pu.length ? pu.filter(x => x.status === 'occupée').length : ls.filter(l => l.propertyId === p.id).length; return [p.title, n, o, Math.round(o / n * 100) + ' %']; });
    return {head: ['Bien', 'Unités', 'Occupées', 'Taux'], rows, money: []}; }
  const rows = props.map(p => { const r = sum(paid.filter(x => lp(x.leaseId) === p.id)) + sum(pays.filter(x => x.propertyId === p.id)), c = sum(exps.filter(x => x.propertyId === p.id)) + sum(tk.filter(x => x.propertyId === p.id)); return [p.title, r, c, r - c, p.price && p.transaction !== 'location' ? ((r - c) / p.price * 100).toFixed(1) + ' %' : '—']; });
  return {head: ['Bien', 'Revenus', 'Dépenses', 'Net', 'Rendement'], rows, total: ['TOTAL', ...[1, 2, 3].map(i => rows.reduce((s, r) => s + r[i], 0)), ''], money: [1, 2, 3]};
}
const repFmt = (d, v, j) => typeof v === 'number' && (d.money ? d.money.includes(j) : j > 0 && !/^(Nombre|Unités|Occupées)$/.test(d.head[j])) ? fc(v) : String(v);
const repRows = d => [...d.rows, ...(d.total ? [d.total] : [])].map(r => r.map((v, j) => repFmt(d, v, j)));

/* ---------- Onglets ---------- */
vueGestion(['units', 'tenants', 'reports', 'tickets'], function (u, tab) {
  const props = myProps(u);
  if (tab === 'units') {
    const us = gMine('units', u).filter(x => x.status !== 'archivee' || GSHOW_ARCH).sort((a, b) => ((gProp(a.propertyId) || {}).title || '') + a.ref < ((gProp(b.propertyId) || {}).title || '') + b.ref ? -1 : 1), occ = us.filter(x => x.status === 'occupée').length;
    return csvBtn('units') + `<div class="kpis">${kpi(us.length, 'Unités')}${kpi(occ, 'Occupées', 'ok')}${kpi(us.filter(x => x.status === 'libre').length, 'Libres')}${kpi((us.length ? Math.round(occ / us.length * 100) : 0) + ' %', 'Taux d\'occupation', 'brand')}</div>
    <form class="card" data-action="g8-unit" style="margin:18px 0"><h4 style="margin-top:0">Nouvelle unité</h4><div class="form-grid"><div class="field"><label>Immeuble / bien</label><select class="input" name="propertyId" required>${gOpts(props)}</select></div>
      <div class="field"><label>Référence</label><input class="input" name="ref" required placeholder="A01"></div><div class="field"><label>Étage</label><input class="input" name="floor" placeholder="RDC, 1er…"></div>
      <div class="field"><label>Surface (m²)</label><input class="input" type="number" min="0" name="surface"></div><div class="field"><label>Pièces</label><input class="input" type="number" min="0" name="rooms"></div>
      <div class="field"><label>Loyer (FCFA)</label><input class="input" type="number" min="0" name="rent" required></div><div class="field"><label>Charges (FCFA)</label><input class="input" type="number" min="0" name="charges" value="0"></div></div><button class="btn">Ajouter l'unité</button></form>` +
      gTable(['Bien', 'Unité', 'Étage', 'Surface', 'Loyer', 'Statut', 'Locataire', ''], us.map(x => { const l = x.leaseId && DB.findItem(DB.K.leases, x.leaseId), tone = {libre:'ok', 'occupée':'info', maintenance:'warn', archivee:''}[x.status], slab = x.status === 'archivee' ? 'archivée' : x.status;
        return `<tr><td class="small">${esc((gProp(x.propertyId) || {}).title || '')}</td><td><b>${esc(x.ref)}</b></td><td class="small">${esc(x.floor || '—')}</td><td class="small">${x.surface ? x.surface + ' m²' : '—'}</td><td>${money(x.rent)}</td><td>${badge(slab, tone)}</td><td class="small">${l ? esc(l.tenant) : '—'}</td>
        <td><div class="row" style="gap:6px">${x.status === 'libre' ? `<button class="btn sm" data-action="g8-rent" data-id="${x.id}">Louer</button>` : ''}${x.status !== 'occupée' ? `${x.status !== 'archivee' ? `<button class="btn ghost sm" data-action="g8-umaint" data-id="${x.id}">${x.status === 'libre' ? 'Mettre en maintenance' : 'Remettre libre'}</button>` : ''}<button class="btn ghost sm" data-action="g8-uarch" data-id="${x.id}">${x.status === 'archivee' ? 'Réactiver' : 'Archiver'}</button><button class="btn ghost sm" data-action="g8-udel" data-id="${x.id}" aria-label="Supprimer">${icon('trash', 14)}</button>` : ''}</div></td></tr>`; }),
        ['Aucune unité', 'Un immeuble peut contenir plusieurs unités (A01, A02…) louées séparément.']);
  }
  if (tab === 'tenants') { const ls = gMine('leases', u).slice().reverse();
    return gTable(['Locataire', 'Bien', 'Loyer', 'Bail', 'Situation', ''], ls.map(l => { const rs = gMine('rents', u).filter(r => r.leaseId === l.id), late = rs.filter(r => !r.paidAt && rentState(r)[1] === 'bad').length;
      return `<tr><td class="small"><b>${esc(l.tenant)}</b><br><a class="muted" href="${telHref(l.phone)}">${esc(l.phone)}</a></td><td class="small">${esc((gProp(l.propertyId) || {}).title || '')}${l.unitRef ? ' · ' + esc(l.unitRef) : ''}</td><td>${money(l.rent)}</td><td class="small muted">${dateFr(l.start)}</td>
      <td>${l.status !== 'actif' ? badge('Bail terminé', '') : late ? badge(late + ' retard(s)', 'bad') : badge('À jour', 'ok')}</td><td><button class="btn ghost sm" data-action="g8-tfiche" data-id="${l.id}">Fiche</button></td></tr>`; }), ['Aucun locataire', 'Les locataires apparaissent dès qu\'un bail est créé.']); }
  if (tab === 'reports') { const d = repData(u, REP.type, REP.year), rows = repRows(d);
    return `<div class="card" style="margin-bottom:16px"><div class="form-grid"><div class="field"><label>Rapport</label><select class="input" data-action="g8-rep" name="type">${Object.entries(REPT).map(([k, v]) => `<option value="${k}" ${k === REP.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Année</label><select class="input" data-action="g8-rep" name="year">${[0, 1, 2].map(i => new Date().getFullYear() - i).map(y => `<option ${y === REP.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>
      <div class="row" style="gap:8px"><button class="btn" data-action="g8-rpdf">Télécharger en PDF</button><button class="btn ghost" data-action="g8-rcsv">Exporter en CSV</button></div></div>` +
      gTable(d.head, rows.map((r, i) => `<tr${d.total && i === rows.length - 1 ? ' style="font-weight:700"' : ''}>${r.map(c => `<td class="small">${esc(c)}</td>`).join('')}</tr>`), ['Aucune donnée', 'Aucun élément pour cette période.']); }
  const tks = gMine('tickets', u).filter(t => { if (!t.ref) { t.ref = nref('MNT', 'tickets'); DB.updateItem(DB.K.tickets, t.id, {ref: t.ref}); } return true; }).reverse(), provs = gMine('providers', u);
  return csvBtn('tickets') + `<form class="card" data-action="g8-ticket" style="margin-bottom:18px"><h4 style="margin-top:0">Nouvelle intervention</h4><div class="form-grid"><div class="field"><label>Bien</label><select class="input" name="propertyId" required>${gOpts(props)}</select></div>
    <div class="field"><label>Problème</label><input class="input" name="title" required></div>
    <div class="field"><label>Catégorie</label><select class="input" name="category">${MCAT.map(c => `<option>${c}</option>`).join('')}</select></div><div class="field"><label>Priorité</label><select class="input" name="priority">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${k === 'normale' ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
    <div class="field"><label>Prestataire</label><select class="input" name="providerId"><option value="">À assigner</option>${provs.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.job)})</option>`).join('')}</select></div>
    <div class="field"><label>Coût estimé (FCFA)</label><input class="input" type="number" min="0" name="cost" value="0"></div><div class="field"><label>Photo (facultatif)</label><input class="input" type="file" name="photo" accept="image/*"></div></div><button class="btn">Enregistrer</button></form>
    ${sBar()}` +
    gTable(['Réf.', 'Bien', 'Problème', 'Prestataire', 'Coût', 'Statut', ''], tks.map(t => { const s = tkSt(t), next = TKS[TKS.indexOf(s) + 1];
      return `<tr><td class="small"><b>${t.ref}</b></td><td class="small">${esc((gProp(t.propertyId) || {}).title || '')}</td><td class="small"><b>${esc(t.title)}</b><br><span class="muted">${esc(t.category || 'Autre')}</span> ${badge(...(PRIO[t.priority] || PRIO.normale))}</td><td class="small">${esc(provName(t.providerId) || '—')}</td><td>${money(t.cost)}</td>
      <td>${next ? `<button class="btn ghost sm" data-action="g8-tnext" data-id="${t.id}" title="Passer à : ${TICKET_LABEL[next]}">${badge(TICKET_LABEL[s], TICKET_TONE[s])} →</button>` : badge('Fermé', '')}</td>
      <td><div class="row" style="gap:6px">${t.photo ? `<button class="btn ghost sm" data-action="g8-tphoto" data-id="${t.id}">Photo</button>` : ''}${t.expenseId ? badge('Dépense liée', 'ok') : ''}<button class="btn ghost sm" data-action="g8-tdel" data-id="${t.id}" aria-label="Supprimer">${icon('trash', 14)}</button></div></td></tr>`; }), ['Aucune intervention', 'Suivez chaque panne : assignation, travaux, résolution, dépense.']);
});

/* barre de recherche en tête des listes (le journal et les ventes ont la leur) */
retoucheGestion(['expenses', 'leases', 'rents', 'contracts', 'providers', 'tenants', 'units'], h => sBar() + h);

/* ---------- Actions ---------- */
function tkAdvance(u, t, cost) {
  const s = tkSt(t), next = TKS[TKS.indexOf(s) + 1]; if (!next) return; const patch = {status: next};
  if (next === 'terminée') { if (cost !== null && cost >= 0) patch.cost = cost; const c = patch.cost ?? t.cost;
    if (c > 0 && !t.expenseId) { const x = DB.addItem(DB.K.expenses, {ownerId: u.id, ref: nref('DEP', 'expenses'), propertyId: t.propertyId, supplier: provName(t.providerId) || 'Prestataire', cat: 'maintenance', amount: c, method: 'Espèces', date: now().slice(0, 10), ticketId: t.id}); patch.expenseId = x.id; } }
  DB.updateItem(DB.K.tickets, t.id, patch); audit('Maintenance ' + t.ref, TICKET_LABEL[next]); if (t.tenantId) notify(t.tenantId, `Votre demande ${t.ref} est maintenant : ${TICKET_LABEL[next]}.`, '#/tenant/tickets'); render();
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action^="g8-"]'), u = Auth.current(); if (!el || !u || ['SELECT', 'FORM'].includes(el.tagName)) return;
  const a = el.dataset.action, id = el.dataset.id, mine = k => DB.findItem(DB.K[k], x => x.id === id && x.ownerId === u.id);
  if (a === 'g8-rent' && mine('units')) { const x = mine('units'); modal('Louer ' + x.ref, `<form data-action="g8-lease" data-id="${id}"><div class="form-grid"><div class="field"><label>Locataire</label><input class="input" name="tenant" required></div><div class="field"><label>Téléphone</label><input class="input" name="phone"></div>
    <div class="field"><label>Loyer (FCFA)</label><input class="input" type="number" min="1" name="rent" value="${x.rent}" required></div><div class="field"><label>Caution (FCFA)</label><input class="input" type="number" min="0" name="deposit" value="${x.rent * 2}"></div>
    <div class="field"><label>Début</label><input class="input" type="date" name="start" value="${now().slice(0, 10)}"></div><div class="field"><label>Durée (mois)</label><input class="input" type="number" min="1" max="36" name="months" value="12"></div>
    <div class="field"><label>Jour d'échéance</label><input class="input" type="number" min="1" max="28" name="dueDay" value="5"></div></div><button class="btn block">Créer le bail</button></form>`); }
  if (a === 'g8-umaint' && mine('units')) { const x = mine('units'); DB.updateItem(DB.K.units, id, {status: x.status === 'libre' ? 'maintenance' : 'libre'}); audit('Unité ' + x.ref, x.status === 'libre' ? 'mise en maintenance' : 'remise libre'); render(); }
  if (a === 'g8-udel' && mine('units')) confirmDialog({title: 'Supprimer l\'unité', message: mine('units').ref + ' sera supprimée.', confirmLabel: 'Supprimer', danger: true, onConfirm: () => { DB.deleteItem(DB.K.units, id); render(); }});
  if (a === 'g8-tfiche' && mine('leases')) { const l = mine('leases'), rs = gMine('rents', u).filter(r => r.leaseId === id), late = rs.filter(r => !r.paidAt && rentState(r)[1] === 'bad'), tk = DB.filterItems(DB.K.tickets, t => tenantOf(l) && t.tenantId === tenantOf(l).id), wa = String(l.phone).replace(/\D/g, '');
    modal('Fiche locataire', `<div class="card pad-s"><b style="font-size:1.1em">${esc(l.tenant)}</b><p class="small muted">${esc(l.phone)}${tenantOf(l) ? ' · CNI ' + esc(tenantOf(l).cni) : ' · pas d\'accès en ligne'}</p>
      <p class="small"><b>Bien :</b> ${esc((gProp(l.propertyId) || {}).title || '')}${l.unitRef ? ' · ' + esc(l.unitRef) : ''}<br><b>Bail :</b> ${dateFr(l.start)} → ${dateFr(leaseEnd(l))} (${l.status})<br><b>Loyer :</b> ${money(l.rent)} · <b>Caution :</b> ${money(l.deposit)}</p>
      <p class="small"><b>Loyers :</b> ${rs.filter(r => r.paidAt).length} payés / ${rs.length} · ${late.length ? badge(late.length + ' en retard (' + money(late.reduce((s, r) => s + r.amount, 0)) + ')', 'bad') : badge('À jour', 'ok')}</p>
      <p class="small"><b>Maintenance :</b> ${tk.length} demande(s)</p></div><div class="row" style="gap:8px;margin-top:12px"><a class="btn" href="${telHref(l.phone)}">Appeler</a><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${wa.length === 9 ? '221' + wa : wa}">WhatsApp</a></div>`); }
  if (a === 'g8-tnext' && mine('tickets')) { const t = mine('tickets'), s = tkSt(t);
    if (s === 'nouvelle' && !t.providerId) { const provs = gMine('providers', u); if (!provs.length) { toast('Ajoutez d\'abord un prestataire (onglet Prestataires).', 'bad'); return; }
      modal('Assigner un prestataire', `<form data-action="g8-assign" data-id="${id}"><div class="field"><label>Prestataire</label><select class="input" name="providerId">${provs.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.job)})</option>`).join('')}</select></div><button class="btn block">Assigner</button></form>`); return; }
    if (TKS[TKS.indexOf(s) + 1] === 'terminée') promptDialog({title: 'Clôturer ' + t.ref, label: 'Coût final (FCFA)', value: String(t.cost || 0), onConfirm: v => tkAdvance(u, t, Math.max(0, +v || 0))}); else tkAdvance(u, t, null); }
  if (a === 'g8-tphoto' && mine('tickets')) modal(mine('tickets').ref, `<img src="${mine('tickets').photo}" alt="" style="max-width:100%;border-radius:8px">`);
  if (a === 'g8-tdel' && mine('tickets')) confirmDialog({title: 'Supprimer l\'intervention', message: mine('tickets').ref + ' sera supprimée (la dépense liée est conservée).', confirmLabel: 'Supprimer', danger: true, onConfirm: () => { DB.deleteItem(DB.K.tickets, id); render(); }});
  if (a === 'g8-rcsv' || a === 'g8-rpdf') {
    if (u.member && !u.perms.includes('finances')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
    const d = repData(u, REP.type, REP.year), rows = repRows(d), title = REPT[REP.type];
    if (a === 'g8-rcsv') { saveFile(`rapport-${REP.type}-${REP.year}.csv`, '\ufeff' + [d.head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')); return; }
    try { await loadPdf(); const I = issuer(u), [doc, y0] = pdfBegin('RAPPORT', `RPT-${REP.year}`, now(), 'Rapport ' + title); let y = pdfParties(doc, y0, {t: 'Émetteur', lines: issuerLines(I)}, {t: 'Rapport', lines: [title, 'Année ' + REP.year]});
      const n = d.head.length, w0 = n > 4 ? 55 : 70, cols = d.head.map((h, i) => ({h, w: i ? (180 - w0) / (n - 1) : w0, a: i ? 'r' : 'l'}));
      pdfTable(doc, y, cols, rows.length ? rows : [['Aucune donnée', ...d.head.slice(1).map(() => '')]]); const f = pdfEnd(doc, u, `rapport-${REP.type}-${REP.year}`); await saveFile(f.name, f.blob); audit('Rapport PDF', title); }
    catch { toast('PDF indisponible : connexion Internet nécessaire.', 'bad'); }
  }
});
document.addEventListener('change', e => {
  const gg = e.target.closest('[data-action="g-goto"]'); if (gg) { go('#/manage/' + gg.value); return; }
  const el = e.target.closest('[data-action="g8-rep"]'); if (!el) return; REP[el.name] = el.name === 'year' ? +el.value : el.value; render();
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-action^="g8-"]'), u = Auth.current(); if (!f || !u) return;
  e.preventDefault(); const a = f.dataset.action, d = formData(f);
  if (d.propertyId && !myProps(u).some(p => p.id === d.propertyId)) { toast('Choisissez un de vos biens.', 'bad'); return; }
  if (a === 'g8-unit') { if (gMine('units', u).some(x => x.propertyId === d.propertyId && x.ref.toLowerCase() === d.ref.trim().toLowerCase())) { toast('Cette référence existe déjà dans ce bien.', 'bad'); return; }
    const x = DB.addItem(DB.K.units, {ownerId: u.id, propertyId: d.propertyId, ref: d.ref.trim(), floor: d.floor, surface: +d.surface || 0, rooms: +d.rooms || 0, rent: +d.rent || 0, charges: +d.charges || 0, status: 'libre', leaseId: ''}); audit('Unité créée', x.ref); toast('Unité ajoutée.'); render(); }
  if (a === 'g8-lease') { const x = DB.findItem(DB.K.units, y => y.id === f.dataset.id && y.ownerId === u.id && y.status === 'libre'), rent = +d.rent, n = Math.min(36, Math.max(1, +d.months)); if (!x || !d.tenant.trim() || !(rent > 0)) return;
    const l = DB.addItem(DB.K.leases, {ownerId: u.id, propertyId: x.propertyId, unitId: x.id, unitRef: x.ref, tenant: d.tenant.trim(), phone: d.phone, rent, deposit: +d.deposit || 0, start: d.start, months: n, dueDay: Math.min(28, Math.max(1, +d.dueDay || 5)), status: 'actif'}), s = new Date(d.start);
    for (let i = 0; i < n; i++) { const m = new Date(s.getFullYear(), s.getMonth() + i, 1); DB.addItem(DB.K.rents, {ownerId: u.id, leaseId: l.id, month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, amount: rent, paidAt: null}); }
    DB.updateItem(DB.K.units, x.id, {status: 'occupée', leaseId: l.id}); audit('Bail unité ' + x.ref, d.tenant); closeModal();
    toast(`${x.ref} louée : ${n} loyers planifiés.${listable(gProp(x.propertyId)) ? '' : ' Toutes les unités sont prises : le bien quitte la recherche.'}`); render(); }
  if (a === 'g8-assign') { const t = DB.findItem(DB.K.tickets, y => y.id === f.dataset.id && y.ownerId === u.id); if (!t || !DB.findItem(DB.K.providers, y => y.id === d.providerId && y.ownerId === u.id)) return; DB.updateItem(DB.K.tickets, t.id, {providerId: d.providerId}); closeModal(); tkAdvance(u, {...t, providerId: d.providerId}, null); }
  if (a === 'g8-ticket') { let photo = ''; const file = f.querySelector('[type=file]').files[0]; if (file) { try { photo = await readImageAsDataUrl(file); } catch { toast('Photo illisible.', 'bad'); return; } }
    const pid = DB.findItem(DB.K.providers, y => y.id === d.providerId && y.ownerId === u.id) ? d.providerId : '', t = DB.addItem(DB.K.tickets, {ownerId: u.id, propertyId: d.propertyId, title: d.title.trim(), category: MCAT.includes(d.category) ? d.category : 'Autre', priority: d.priority, providerId: pid, cost: +d.cost || 0, photo, status: pid ? 'en cours' : 'nouvelle', ref: nref('MNT', 'tickets')});
    audit('Maintenance créée', t.ref); toast(t.ref + ' créé.'); render(); }
});

/* ---------- Rappels automatiques (une fois par événement) ---------- */
function autoNotifyTick() {
  const u = Auth.current(); if (!u || !['owner', 'agency', 'tenant'].includes(u.role)) return;
  const today = now().slice(0, 10), push = (k, uid, t, l) => { if (uid && !DB.findItem(DB.K.notifications, n => n.userId === uid && n.key === k)) DB.addItem(DB.K.notifications, {userId: uid, text: t, read: false, link: l || '', key: k}); };
  const L = u.role === 'tenant' ? DB.findItem(DB.K.leases, u.leaseId) : null;
  if (!L) syncContracts(u);
  (L ? DB.filterItems(DB.K.rents, r => r.leaseId === L.id) : gMine('rents', u)).filter(r => !r.paidAt).forEach(r => {
    const l = L || DB.findItem(DB.K.leases, r.leaseId); if (!l) return; const dd = daysBetween(today, r.month + '-05'), ten = L ? u.id : (tenantOf(l) || {}).id, ml = monthLabel(r.month);
    const kinds = dd >= 0 && dd <= 3 ? ['rd', `Loyer de ${l.tenant} (${ml}) bientôt dû.`, `Votre loyer de ${ml} est dû le 5.`] : dd < 0 ? ['rl', `Loyer en retard : ${l.tenant}, ${ml}.`, `Votre loyer de ${ml} est en retard.`] : null;
    if (!kinds) return; if (!L) push(`${kinds[0]}|${r.id}|O`, u.id, kinds[1], '#/manage/rents'); push(`${kinds[0]}|${r.id}|T`, ten, kinds[2], '#/tenant/rents');
  });
  if (!L) {
    gMine('docs', u).filter(d => d.type === 'FAC' && dRest(d) > 0 && d.due < today).forEach(d => push('fl|' + d.id, u.id, `Facture ${d.ref} en retard de paiement.`, '#/manage/docs'));
    gMine('contracts', u).filter(c => c.status === 'actif' && daysBetween(today, c.end) >= 0 && daysBetween(today, c.end) <= 30).forEach(c => push('ce|' + c.id, u.id, `Le contrat ${c.ref} expire dans ${daysBetween(today, c.end)} jours.`, '#/manage/contracts'));
  }
  DB.getData(DB.K.documents).filter(x => x.ownerId === u.id && x.expiry && daysTo(x.expiry) <= 30).forEach(x => push('de|' + x.id + '|' + (daysTo(x.expiry) < 0 ? 'x' : 'o'), u.id, `Document « ${x.name} » ${daysTo(x.expiry) < 0 ? 'expiré' : 'bientôt expiré'}.`, '#/coffre'));
}
window.addEventListener('hashchange', () => { const p = document.getElementById('upanel'), bk = document.querySelector('.upanel-back'), ch = document.querySelector('.mhead .muser');
  if (p) p.classList.remove('open'); if (bk) bk.classList.remove('open'); if (ch) ch.classList.remove('on'); setTimeout(autoNotifyTick, 400); }); setTimeout(autoNotifyTick, 1500);

/* ---------- Tableaux : tri par colonne et pagination ---------- */
function enhanceTable(t) {
  const tb = t.tBodies[0]; if (!tb || !t.tHead || !t.tHead.rows[0] || t.dataset.enh) return; t.dataset.enh = '1'; let page = 0, dir = 1, col = -1; const per = 10, wrap = t.closest('.table-wrap') || t.parentElement, bar = document.createElement('div'); bar.className = 'small muted'; bar.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:8px 2px'; wrap.after(bar);
  const rows = () => [...tb.rows], refresh = () => {
    const vis = rows().filter(r => r.dataset.f !== '1'), pages = Math.max(1, Math.ceil(vis.length / per)); page = Math.min(page, pages - 1); rows().forEach(r => r.style.display = 'none'); vis.slice(page * per, page * per + per).forEach(r => r.style.display = '');
    bar.innerHTML = vis.length > per ? `<span>${vis.length} lignes · page ${page + 1}/${pages}</span><button class="btn ghost sm" ${page ? '' : 'disabled'} data-pg="-1">Précédent</button><button class="btn ghost sm" ${page < pages - 1 ? '' : 'disabled'} data-pg="1">Suivant</button>` : '';
  };
  bar.addEventListener('click', e => { const b = e.target.closest('[data-pg]'); if (b) { page += +b.dataset.pg; refresh(); } });
  [...t.tHead.rows[0].cells].forEach((th, i) => { if (!th.textContent.trim()) return; th.style.cursor = 'pointer'; th.title = 'Trier'; th.addEventListener('click', () => { dir = col === i ? -dir : 1; col = i;
    const v = r => { const x = r.cells[i].textContent.trim(), dm = x.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (dm) return +(dm[3] + dm[2] + dm[1]); const fm = x.match(/^(?:(\d{1,2})\s+)?([a-zéû]+)\.?\s+(\d{4})/i), mi = fm ? ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'].findIndex(m => fm[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith(m)) : -1; if (mi >= 0) return +fm[3] * 10000 + (mi + 1) * 100 + (+fm[1] || 0); const n = parseFloat(x.replace(/\s/g, '').replace(',', '.')); return /^[\d\s.,]+(FCFA|%)?/.test(x) && !isNaN(n) ? n : x.toLowerCase(); };
    rows().sort((p, q) => (v(p) > v(q) ? 1 : v(p) < v(q) ? -1 : 0) * dir).forEach(r => tb.appendChild(r)); page = 0; refresh(); }); });
  t.__pg = refresh; refresh();
}
new MutationObserver(() => requestAnimationFrame(() => document.querySelectorAll('.table-wrap table:not([data-enh])').forEach(t => { try { enhanceTable(t); } catch (e) { t.dataset.enh = 'x'; } }))).observe(document.body, {childList: true, subtree: true});

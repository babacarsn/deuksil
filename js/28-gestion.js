/* ==========================================================================
   MODULE : gestion.js — gestion locative, maintenance, ventes, finances
   (propriétaires et agences). Données : leases, rents, tickets, deals.
   ========================================================================== */
Object.assign(DB.K, {leases:'deuksil_leases', rents:'deuksil_rents', tickets:'deuksil_tickets', deals:'deuksil_deals'});
['owner', 'agency'].forEach(r => MENUS[r].splice(2, 0, ['#/manage/leases', 'Gestion', 'briefcase']));

/* Fil de retour unique : flèche encadrée + chemin, partout dans l'application. */
const backBar = (href, label, current) => `<div class="gback">
  <a class="bk" href="${href}" aria-label="Retour : ${esc(label)}">${icon('arrowLeft', 18)}</a>
  <a href="${href}" class="small muted">${esc(label)}</a>${current ? `<span class="sep">›</span><span class="cur">${esc(current)}</span>` : ''}</div>`;

/* Barre de recherche unique : même dessin partout (voir l'accueil Gestion). */
const sBar = (ph = 'Rechercher…') => `<form class="card sbar" data-action="sb-noop"><div class="row" style="gap:10px">
  <input class="input" data-gsearch placeholder="${esc(ph)}" autocomplete="off">
  <button class="btn" type="submit" aria-label="Rechercher">${icon('search', 16)}</button></div></form>`;
const GTABS = [['leases','Locataires & baux'], ['rents','Loyers'], ['tickets','Maintenance'], ['deals','Ventes'], ['finance','Finances']];
const STAGES = [['prospect','Prospect'], ['visite','Visite'], ['offre','Offre'], ['promesse','Promesse'], ['signe','Vendu']];
const TICKET_NEXT = {ouvert:'en cours', 'en cours':'resolu', resolu:'ouvert'};
const TICKET_LABEL = {ouvert:'Ouvert', 'en cours':'En cours', resolu:'Résolu'};
const TICKET_TONE = {ouvert:'warn', 'en cours':'info', resolu:'ok'};
const leaseEnd = l => { const s = new Date(l.start); return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + l.months, s.getUTCDate())).toISOString().slice(0, 10); };
const monthLabel = k => new Date(k + '-01').toLocaleDateString('fr-FR', {month:'long', year:'numeric'});
const gMine = (k, u) => DB.filterItems(DB.K[k], x => x.ownerId === u.id);
const gProp = id => DB.findItem(DB.K.properties, id);
const gOpts = list => list.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('');
function rentState(r) {
  if (r.paidAt) return ['Payé', 'ok'];
  return r.month + '-05' < now().slice(0, 10) ? ['En retard', 'bad'] : ['À venir', 'info'];
}
let gTable = (head, rows, empty) => rows.length
  ? `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
  : `<div class="empty"><b>${empty[0]}</b><p class="small">${empty[1]}</p></div>`;

function gTab(u, tab) {
  const props = myProps(u), locs = props.filter(p => p.transaction === 'location'), sales = props.filter(p => p.transaction !== 'location');
  const leases = gMine('leases', u), rents = gMine('rents', u), tickets = gMine('tickets', u), deals = gMine('deals', u);
  const lease = id => leases.find(l => l.id === id);
  if (tab === 'leases') return `
    <form class="card" data-action="g-lease" style="margin-bottom:18px"><h4 style="margin-top:0">Nouveau bail</h4>
      <div class="form-grid">
        <div class="field"><label>Bien en location</label><select class="input" name="propertyId" required>${gOpts(locs) || '<option value="">Aucun bien en location</option>'}</select></div>
        <div class="field"><label>Locataire</label><input class="input" name="tenant" required placeholder="Nom complet"></div>
        <div class="field"><label>Téléphone</label><input class="input" name="phone" placeholder="77 000 00 00"></div>
        <div class="field"><label>Loyer mensuel (FCFA)</label><input class="input" type="number" min="1" name="rent" required></div>
        <div class="field"><label>Caution (FCFA)</label><input class="input" type="number" min="0" name="deposit" value="0"></div>
        <div class="field"><label>Début</label><input class="input" type="date" name="start" value="${now().slice(0, 10)}" required></div>
        <div class="field"><label>Durée (mois)</label><input class="input" type="number" min="1" max="36" name="months" value="12" required></div>
        <div class="field"><label>Jour d'échéance</label><input class="input" type="number" min="1" max="28" name="dueDay" value="5" required></div></div>
      <button class="btn">Créer le bail et l'échéancier</button><p class="err" id="g-err"></p></form>` +
    gTable(['Bien', 'Locataire', 'Loyer', 'Période', 'Statut', ''], leases.slice().reverse().map(l => {
      const p = gProp(l.propertyId), end = leaseEnd(l), left = daysBetween(now(), end);
      return `<tr><td class="small"><b>${esc(p ? p.title : '—')}</b>${l.unitRef ? ' · ' + esc(l.unitRef) : ''}</td><td class="small">${esc(l.tenant)}<br><a href="${telHref(l.phone)}" class="muted">${esc(l.phone)}</a></td>
        <td>${money(l.rent)}</td><td class="small muted">${dateFr(l.start)} → ${dateFr(end)}${l.status === 'actif' && left < 45 ? '<br>' + badge(left < 0 ? 'Bail échu' : 'Fin dans ' + left + ' j', 'warn') : ''}</td>
        <td>${badge(l.status === 'actif' ? 'Actif' : 'Terminé', l.status === 'actif' ? 'ok' : '')}</td>
        <td>${l.status === 'actif' ? `<button class="btn ghost sm" data-action="g-end-lease" data-id="${l.id}">Mettre fin</button>` : ''}</td></tr>`;
    }), ['Aucun bail', 'Créez un bail : l\'échéancier des loyers est généré automatiquement.']);

  if (tab === 'rents') {
    const late = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
    return `<div class="kpis">${kpi(rents.filter(r => r.paidAt).length, 'Loyers encaissés', 'ok')}${kpi(late.length, 'En retard', 'bad')}${kpi(money(late.reduce((s, r) => s + r.amount, 0)), 'Montant impayé')}</div>
    <div style="margin-top:18px">` + gTable(['Mois', 'Locataire', 'Bien', 'Montant', 'État', ''], rents.slice().sort((a, b) => a.month < b.month ? -1 : 1).map(r => {
      const l = lease(r.leaseId); if (!l) return ''; const p = gProp(l.propertyId), [lab, tone] = rentState(r);
      const wa = String(l.phone).replace(/\D/g, ''), msg = encodeURIComponent(`Bonjour ${l.tenant}, rappel : le loyer de ${monthLabel(r.month)} (${money(r.amount)}) est en attente. Merci.`);
      return `<tr><td class="small">${monthLabel(r.month)}</td><td class="small">${esc(l.tenant)}</td><td class="small muted">${esc(p ? p.title : '')}</td><td>${money(r.amount)}</td><td>${badge(lab, tone)}</td>
        <td><div class="row" style="gap:6px">${r.paidAt ? `<button class="btn ghost sm" data-action="g-receipt" data-id="${r.id}">Quittance</button>`
          : `<button class="btn sm" data-action="g-pay" data-id="${r.id}">Encaisser</button>${tone === 'bad' ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${wa.length === 9 ? '221' + wa : wa}?text=${msg}">Relancer</a>` : ''}`}</div></td></tr>`;
    }).filter(Boolean), ['Aucun loyer', 'Les loyers apparaissent dès qu\'un bail est créé.']) + '</div>';
  }

  if (tab === 'tickets') return `
    <form class="card" data-action="g-ticket" style="margin-bottom:18px"><h4 style="margin-top:0">Nouvelle demande d'intervention</h4>
      <div class="form-grid"><div class="field"><label>Bien</label><select class="input" name="propertyId" required>${gOpts(props)}</select></div>
        <div class="field"><label>Problème</label><input class="input" name="title" required placeholder="Fuite, panne électrique…"></div>
        <div class="field"><label>Coût estimé (FCFA)</label><input class="input" type="number" min="0" name="cost" value="0"></div></div>
      <button class="btn">Enregistrer</button></form>` +
    gTable(['Bien', 'Problème', 'Coût', 'Statut', ''], tickets.slice().reverse().map(t => `<tr><td class="small">${esc((gProp(t.propertyId) || {}).title || '—')}</td><td class="small"><b>${esc(t.title)}</b></td><td>${money(t.cost)}</td>
      <td><button class="btn ghost sm" data-action="g-ticket-next" data-id="${t.id}">${badge(TICKET_LABEL[t.status], TICKET_TONE[t.status])}</button></td>
      <td><button class="btn ghost sm" data-action="g-del" data-coll="tickets" data-id="${t.id}" aria-label="Supprimer">${icon('trash', 14)}</button></td></tr>`), ['Aucune intervention', 'Suivez ici les travaux et leur coût. Cliquez sur le statut pour le faire avancer.']);

  if (tab === 'deals') return `
    <form class="card" data-action="g-deal" style="margin-bottom:18px"><h4 style="margin-top:0">Nouveau dossier de vente</h4>
      <div class="form-grid"><div class="field"><label>Bien à vendre</label><select class="input" name="propertyId" required>${gOpts(sales) || '<option value="">Aucun bien en vente</option>'}</select></div>
        <div class="field"><label>Acheteur</label><input class="input" name="buyer" required></div>
        <div class="field"><label>Offre (FCFA)</label><input class="input" type="number" min="0" name="offer" value="0"></div></div>
      <button class="btn">Ajouter au pipeline</button></form>` +
    gTable(['Bien', 'Acheteur', 'Offre', 'Étape', ''], deals.slice().reverse().map(d => `<tr><td class="small"><b>${esc((gProp(d.propertyId) || {}).title || '—')}</b></td><td class="small">${esc(d.buyer)}</td><td>${money(d.offer)}</td>
      <td><select class="input" data-action="g-stage" data-id="${d.id}">${STAGES.map(([k, l]) => `<option value="${k}" ${d.stage === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><button class="btn ghost sm" data-action="g-del" data-coll="deals" data-id="${d.id}" aria-label="Supprimer">${icon('trash', 14)}</button></td></tr>`), ['Aucun dossier', 'Suivez chaque acheteur, de la première visite à la signature.']);

  /* finance */
  const paid = rents.filter(r => r.paidAt), late = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad'), upcoming = rents.filter(r => !r.paidAt && rentState(r)[1] === 'info');
  const sum = a => a.reduce((s, x) => s + (x.amount ?? x.cost ?? 0), 0), costs = sum(tickets), inc = sum(paid);
  const active = leases.filter(l => l.status === 'actif').length, occ = locs.length ? Math.min(100, Math.round(active / locs.length * 100)) : 0;
  return `<div class="kpis">${kpi(money(inc), 'Encaissé', 'ok')}${kpi(money(sum(late)), 'Impayés', 'bad')}${kpi(money(sum(upcoming)), 'À venir')}${kpi(money(costs), 'Charges (travaux)')}${kpi(money(inc - costs), 'Résultat net', 'brand')}${kpi(occ + ' %', 'Taux d\'occupation')}</div>
    <div style="margin-top:18px">` + gTable(['Bien', 'Encaissé', 'Charges', 'Net'], props.map(p => {
      const rv = sum(paid.filter(r => (lease(r.leaseId) || {}).propertyId === p.id)), ch = sum(tickets.filter(t => t.propertyId === p.id));
      return `<tr><td class="small"><b>${esc(p.title)}</b></td><td>${money(rv)}</td><td>${money(ch)}</td><td><b style="color:var(--${rv - ch < 0 ? 'bad' : 'ok'})">${money(rv - ch)}</b></td></tr>`;
    }), ['Aucun bien', 'Ajoutez des biens pour suivre leur rentabilité.']) + '</div>';
}

route(/^\/manage\/(leases|rents|tickets|deals|finance)$/, tab => {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) { toast('Espace réservé aux propriétaires et agences.', 'bad'); go('#/login'); return false; }
  const vis = GTABS.filter(([k]) => !u.member || memberCan(u, permFor('/manage/' + k)));
  const nav = `<div class="gback"><a class="bk" href="#/manage" aria-label="Retour à la gestion">${icon('arrowLeft', 18)}</a>
    <a href="#/manage" class="small muted">Gestion</a><span class="sep">›</span><span class="cur">${esc(gLabel(tab))}</span>
    <select class="input" data-action="g-goto" aria-label="Changer de section">${vis.map(([k, l]) => `<option value="${k}" ${k === tab ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
  const meta = GMETA[tab] || [null, ''];
  return shellApp(u, page(gLabel(tab), meta[1]) + nav + gTab(u, tab));
});

function gReceipt(r) {
  const l = DB.findItem(DB.K.leases, r.leaseId), p = l && gProp(l.propertyId), u = Auth.current();
  const bailleur = ownerLabel(u);
  const body = `<h2>Quittance de loyer</h2><p><b>Période :</b> ${monthLabel(r.month)}</p><p>Je soussigné(e) <b>${esc(bailleur)}</b> reconnais avoir reçu de <b>${esc(l.tenant)}</b> la somme de <b>${money(r.amount)}</b> au titre du loyer de « ${esc(p ? p.title : '')} », payé le ${dateFr(r.paidAt)}.</p><p>Fait à ${esc(p ? p.city : 'Dakar')}, le ${dateFr(r.paidAt)}.</p><p>Signature : ${esc(bailleur)}</p>`;
  const file = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<meta charset="utf-8"><body style="font-family:sans-serif;max-width:560px;margin:40px auto">${body}</body>`);
  modal('Quittance', `<div class="card pad-s">${body}</div><div class="row" style="margin-top:12px;gap:8px">${dlLink('', 'QUIT-' + r.id)}<button class="btn ghost" data-action="close-modal">Fermer</button></div>`);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action^="g-"]'); if (!el || el.tagName === 'FORM' || el.tagName === 'SELECT') return;
  const a = el.dataset.action, id = el.dataset.id, u = Auth.current(); if (!u) return;
  const own = (k) => DB.findItem(DB.K[k], x => x.id === id && x.ownerId === u.id);
  if (a === 'g-pay' && own('rents')) { const r = own('rents'), l = DB.findItem(DB.K.leases, r.leaseId) || {};
    modal('Enregistrer le paiement', `<p class="small muted">${esc(l.tenant || '')} · loyer de <b>${monthLabel(r.month)}</b></p>
      <form data-action="g-pay-save" data-id="${id}"><div class="form-grid">
        <div class="field"><label>Montant reçu (FCFA)</label><input class="input" type="number" min="1" name="amount" value="${r.amount}" required></div>
        <div class="field"><label>Date du paiement</label><input class="input" type="date" name="date" value="${ymd()}" required></div>
        <div class="field"><label>Mode de paiement</label><select class="input" name="method">${PAYM.map(x => `<option>${x}</option>`).join('')}</select></div>
        <div class="field"><label>Référence (facultatif)</label><input class="input" name="ref" placeholder="N° de transaction, reçu…"></div></div>
      <button class="btn block">Enregistrer et générer la quittance</button></form>`); }
  if (a === 'g-receipt' && own('rents')) gReceipt(own('rents'));
  if (a === 'g-end-lease' && own('leases')) confirmDialog({title: 'Mettre fin au bail', message: 'Les loyers non encaissés seront supprimés et le bien redeviendra disponible.', confirmLabel: 'Mettre fin', danger: true, onConfirm: () => {
    const l = own('leases'); DB.updateItem(DB.K.leases, id, {status: 'termine'});
    DB.filterItems(DB.K.rents, r => r.leaseId === id && !r.paidAt).forEach(r => DB.deleteItem(DB.K.rents, r.id));
    if (l.unitId) DB.updateItem(DB.K.units, l.unitId, {status: 'libre', leaseId: ''}); else DB.updateItem(DB.K.properties, l.propertyId, {status: 'disponible'}); toast('Bail terminé.'); render(); }});
  if (a === 'g-ticket-next' && own('tickets')) { DB.updateItem(DB.K.tickets, id, {status: TICKET_NEXT[own('tickets').status]}); render(); }
  if (a === 'g-del' && ['tickets', 'deals'].includes(el.dataset.coll) && own(el.dataset.coll)) { DB.deleteItem(DB.K[el.dataset.coll], id); render(); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action="g-stage"]'), u = Auth.current(); if (!el || !u) return;
  const d = DB.findItem(DB.K.deals, x => x.id === el.dataset.id && x.ownerId === u.id); if (!d) return;
  DB.updateItem(DB.K.deals, d.id, {stage: el.value});
  if (el.value === 'signe') { DB.updateItem(DB.K.properties, d.propertyId, {status: 'vendu'}); toast('Vente conclue : le bien passe en « Vendu ».'); }
});
document.addEventListener('submit', e => {
  const pf = e.target.closest('[data-action="g-pay-save"]'), uu = Auth.current();
  if (pf && uu) {
    e.preventDefault(); const r = DB.findItem(DB.K.rents, x => x.id === pf.dataset.id && x.ownerId === uu.id);
    if (!r || r.paidAt) { closeModal(); return; }
    const d = formData(pf);
    DB.updateItem(DB.K.rents, r.id, {paidAt: (d.date || ymd()) + 'T12:00:00.000Z', amount: +d.amount || r.amount,
      method: PAYM.includes(d.method) ? d.method : 'Espèces', payRef: (d.ref || '').trim()});
    audit('Loyer encaissé', `${monthLabel(r.month)} · ${money(+d.amount || r.amount)} · ${d.method}`);
    const t = DB.findItem(DB.K.users, x => x.leaseId === r.leaseId);
    if (t) notify(t.id, `Votre loyer de ${monthLabel(r.month)} a été enregistré comme payé.`, '#/tenant/quittances');
    closeModal(); render(); showCreated('quit', r.id); autoFileThen('quittance', DB.findItem(DB.K.rents, r.id), 'Paiement enregistré');
    return;
  }
  const form = e.target.closest('[data-action^="g-"]'), u = Auth.current(); if (!form || !u) return;
  e.preventDefault(); const a = form.dataset.action, d = formData(form);
  if (!myProps(u).some(p => p.id === d.propertyId)) { toast('Choisissez un de vos biens.', 'bad'); return; }
  if (a === 'g-lease') {
    const rent = +d.rent, n = Math.min(36, Math.max(1, +d.months));
    if (!d.tenant.trim() || rent <= 0) { $('#g-err').textContent = 'Locataire et loyer sont obligatoires.'; return; }
    if (DB.findItem(DB.K.leases, l => l.propertyId === d.propertyId && l.status === 'actif')) { $('#g-err').textContent = 'Ce bien a déjà un bail actif.'; return; }
    if (gMine('units', u).some(x => x.propertyId === d.propertyId)) { $('#g-err').textContent = 'Ce bien a des unités : louez-les depuis l\'onglet Unités.'; return; }
    const l = DB.addItem(DB.K.leases, {ownerId: u.id, propertyId: d.propertyId, tenant: d.tenant.trim(), phone: d.phone, rent, deposit: +d.deposit || 0, start: d.start, months: n, dueDay: Math.min(28, Math.max(1, +d.dueDay || 5)), status: 'actif'});
    const s = new Date(d.start);
    for (let i = 0; i < n; i++) { const m = new Date(s.getFullYear(), s.getMonth() + i, 1); DB.addItem(DB.K.rents, {ownerId: u.id, leaseId: l.id, month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, amount: rent, paidAt: null}); }
    DB.updateItem(DB.K.properties, d.propertyId, {status: 'loue'}); toast(`Bail créé : ${n} loyers planifiés. Le bien ne s'affiche plus dans la recherche.`);
  }
  if (a === 'g-ticket') DB.addItem(DB.K.tickets, {ownerId: u.id, propertyId: d.propertyId, title: d.title.trim(), cost: +d.cost || 0, status: 'ouvert'});
  if (a === 'g-deal') DB.addItem(DB.K.deals, {ownerId: u.id, propertyId: d.propertyId, buyer: d.buyer.trim(), offer: +d.offer || 0, stage: 'prospect'});
  render();
});

/* ==========================================================================
   MODULE : v10.js — fiches propriétaires (mandats), espace locataire complet
   (paiement du loyer, messagerie), investisseur, promoteur, audit détaillé,
   statut « en maintenance » des biens.
   ========================================================================== */
Object.assign(DB.K, {owners:'deuksil_owners', tmsgs:'deuksil_tmsgs', iassets:'deuksil_iassets', programs:'deuksil_programs', lots:'deuksil_lots', v10seed:'deuksil_v10seed'});
STATUS_LABEL.maintenance = 'En maintenance'; STATUS_TONE.maintenance = 'warn';
GTABS.splice(GTABS.findIndex(t => t[0] === 'tenants') + 1, 0, ['owners', 'Propriétaires'], ['tmsgs', 'Messages locataires']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit|contracts|providers|team|identity|units|tenants|reports|owners|tmsgs)$/;
const _h10 = Auth.home; Auth.home = function (u) { return u.role === 'investor' ? '#/invest/home' : u.role === 'promoter' ? '#/promo/home' : _h10.call(this, u); };
MENUS_RAW.tenant.splice(2, 0, ['#/tenant/messages', 'Messages', 'message']);
MENUS_RAW.investor = [['#/invest/home', 'Mon patrimoine', 'chart'], ['#/coffre', 'Documents', 'file']];
MENUS_RAW.promoter = [['#/promo/home', 'Mes programmes', 'building'], ['#/coffre', 'Documents', 'file']];
DRAWERS.investor = DRAWERS.promoter = ['identite', 'propriete', 'assurance', 'technique', 'autres']; UPCATS.investor = UPCATS.promoter = ['identite', 'propriete', 'assurance', 'technique', 'autres'];
const fv = v => v === undefined || v === null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40);
const ymd = () => now().slice(0, 10), yr = () => new Date().getFullYear();
const sumA = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);

EXP.owners = u => [['Nom', 'Type', 'Téléphone', 'Commission %', 'Biens'], gMine('owners', u).map(o => [o.name, o.kind, o.phone, o.rate, myProps(u).filter(p => p.clientOwnerId === o.id).length])];
EXP.audit = u => [['Date', 'Utilisateur', 'Action', 'Détail', 'Changements'], gMine('audit', u).map(a => [a.createdAt, a.who, a.action, a.detail, (a.changes || []).map(c => `${c.f}: ${c.o} -> ${c.n}`).join(' ; ')])];

/* ---------- Audit détaillé : ancienne et nouvelle valeur ---------- */
const AUD_COLL = {docs:'Document', contracts:'Contrat', leases:'Bail', rents:'Loyer', expenses:'Dépense', properties:'Bien', owners:'Propriétaire'}, _upd = DB.updateItem.bind(DB);
DB.updateItem = function (k, id, patch) {
  const coll = Object.keys(DB.K).find(n => DB.K[n] === k), before = AUD_COLL[coll] ? DB.findItem(k, id) : null, after = _upd(k, id, patch), u = Auth.current();
  if (before && after && u) { const ch = Object.keys(patch).filter(f => !['updatedAt', 'views', 'contacts'].includes(f) && JSON.stringify(before[f]) !== JSON.stringify(after[f])).map(f => ({f, o: fv(before[f]), n: fv(after[f])}));
    if (ch.length) DB.addItem(DB.K.audit, {ownerId: after.ownerId || u.id, who: u.firstName, action: 'Modification', detail: `${AUD_COLL[coll]} ${after.ref || after.title || after.name || ''}`.trim(), changes: ch}); }
  return after;
};
vueGestion(['audit', 'owners', 'tmsgs'], function (u, tab) {
  const search = sBar();
  if (tab === 'audit') return csvBtn('audit') + search + gTable(['Date', 'Utilisateur', 'Action', 'Détail', 'Changements'], gMine('audit', u).slice().reverse().slice(0, 300).map(a => `<tr><td class="small muted">${dateTimeFr(a.createdAt)}</td><td class="small">${esc(a.who)}</td><td class="small"><b>${esc(a.action)}</b></td><td class="small">${esc(a.detail)}</td>
    <td class="small">${(a.changes || []).map(c => `<div><span class="muted">${esc(c.f)} :</span> <s>${esc(c.o)}</s> → <b>${esc(c.n)}</b></div>`).join('') || '—'}</td></tr>`), ['Journal vide', 'Les actions et modifications (ancienne et nouvelle valeur) sont tracées ici.']);
  if (tab === 'owners') return ownersTab(u, search);
  if (tab === 'tmsgs') return gTable(['Locataire', 'Bien', 'Dernier message', 'Non lus', ''], gMine('leases', u).map(l => { const m = DB.filterItems(DB.K.tmsgs, x => x.leaseId === l.id), last = m[m.length - 1], un = m.filter(x => x.from === 'tenant' && !x.read).length;
    return `<tr><td class="small"><b>${esc(l.tenant)}</b></td><td class="small">${esc((gProp(l.propertyId) || {}).title || '')}${l.unitRef ? ' · ' + esc(l.unitRef) : ''}</td><td class="small muted">${last ? esc(last.text.slice(0, 60)) : '—'}</td><td>${un ? badge(un, 'bad') : '—'}</td><td><button class="btn ghost sm" data-action="g9-thread" data-id="${l.id}">Ouvrir</button></td></tr>`; }), ['Aucun locataire', 'La messagerie s\'ouvre dès qu\'un bail existe.']);
});

/* ---------- Fiches propriétaires (mandats de gestion) ---------- */
function ownerStats(u, o, y) {
  const P = myProps(u).filter(p => p.clientOwnerId === o.id), ids = P.map(p => p.id), lp = id => (DB.findItem(DB.K.leases, id) || {}).propertyId, Y = String(y);
  const rev = sumA(gMine('rents', u).filter(r => r.paidAt && r.paidAt.startsWith(Y) && ids.includes(lp(r.leaseId))), r => r.amount) + sumA(horsVentes(gMine('fpay', u)).filter(p => p.createdAt.startsWith(Y) && ids.includes(p.propertyId)), p => p.amount);
  const dep = sumA(gMine('expenses', u).filter(x => x.date.startsWith(Y) && ids.includes(x.propertyId)), x => x.amount) + sumA(gMine('tickets', u).filter(t => !t.expenseId && ids.includes(t.propertyId)), t => t.cost), com = Math.round(rev * (o.rate || 0) / 100);
  return {P, rev, dep, com, net: rev - dep - com};
}
function ownersTab(u, search) {
  const os = gMine('owners', u).slice().reverse(), y = yr();
  return csvBtn('owners') + `<form class="card" data-action="g9-owner" style="margin-bottom:18px"><h4 style="margin-top:0">Nouveau propriétaire (mandant)</h4><div class="form-grid"><div class="field"><label>Nom complet / société</label><input class="input" name="name" required></div><div class="field"><label>Téléphone</label><input class="input" name="phone" required></div>
    <div class="field"><label>E-mail</label><input class="input" type="email" name="email"></div><div class="field"><label>CNI</label><input class="input" name="cni" maxlength="13"></div><div class="field"><label>Adresse</label><input class="input" name="address"></div>
    <div class="field"><label>Type</label><select class="input" name="kind"><option>Particulier</option><option>Société</option><option>Diaspora</option></select></div><div class="field"><label>Commission de gestion (%)</label><input class="input" type="number" min="0" max="50" step="0.5" name="rate" value="8"></div></div><button class="btn">Ajouter</button></form>` + search +
    gTable(['Propriétaire', 'Type', 'Biens', `Revenus ${y}`, 'Commission', ''], os.map(o => { const s = ownerStats(u, o, y);
      return `<tr><td class="small"><b>${esc(o.name)}</b><br><a class="muted" href="${telHref(o.phone)}">${esc(o.phone)}</a></td><td class="small">${esc(o.kind)}</td><td>${s.P.length}</td><td>${money(s.rev)}</td><td>${money(s.com)} <span class="muted small">(${o.rate} %)</span></td><td><div class="row" style="gap:6px"><button class="btn ghost sm" data-action="g9-ofiche" data-id="${o.id}">Fiche</button><button class="btn ghost sm" data-action="g9-odel" data-id="${o.id}" aria-label="Supprimer">${icon('trash', 14)}</button></div></td></tr>`; }),
      ['Aucun propriétaire', 'Enregistrez les propriétaires dont vous gérez les biens : revenus, commission et relevé à reverser.']);
}
function ownerFiche(u, o) {
  const y = yr(), s = ownerStats(u, o, y), free = myProps(u).filter(p => !p.clientOwnerId);
  modal('Fiche propriétaire', `<div class="card pad-s"><b style="font-size:1.1em">${esc(o.name)}</b> ${badge(o.kind, 'info')}<p class="small muted">${esc(o.phone)}${o.email ? ' · ' + esc(o.email) : ''}${o.cni ? ' · CNI ' + esc(o.cni) : ''}<br>${esc(o.address || '')}</p>
    <div class="kpis">${kpi(money(s.rev), 'Revenus ' + y)}${kpi(money(s.dep), 'Dépenses')}${kpi(money(s.com), 'Commission (' + o.rate + ' %)')}${kpi(money(s.net), 'À reverser', 'brand')}</div>
    <p class="small" style="margin-top:12px"><b>Biens gérés (${s.P.length}) :</b></p>${s.P.map(p => `<div class="row-between small" style="padding:4px 0"><span>${esc(p.title)}</span><button class="btn ghost sm" data-action="g9-odetach" data-id="${p.id}" data-o="${o.id}">Retirer</button></div>`).join('') || '<p class="small muted">Aucun bien rattaché.</p>'}
    ${free.length ? `<form data-action="g9-oattach" data-id="${o.id}" class="row" style="gap:8px;margin-top:10px"><select class="input" name="propertyId">${gOpts(free)}</select><button class="btn sm">Rattacher</button></form>` : ''}</div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn" data-action="g9-opdf" data-id="${o.id}">Relevé de gestion (PDF)</button><a class="btn ghost" href="${telHref(o.phone)}">Appeler</a></div>`);
}

/* ---------- Locataire : messagerie avec le bailleur ---------- */
const tl = id => DB.findItem(DB.K.leases, id);
route(/^\/tenant\/messages$/, () => {
  const u = Auth.current(); if (!u || u.role !== 'tenant') { toast('Espace réservé aux locataires.', 'bad'); go('#/login'); return false; }
  const l = tl(u.leaseId), msgs = DB.filterItems(DB.K.tmsgs, x => x.leaseId === u.leaseId); msgs.filter(m => m.from === 'owner' && !m.read).forEach(m => DB.updateItem(DB.K.tmsgs, m.id, {read: true}));
  return shellApp(u, page('Messages', 'Échangez avec votre propriétaire.') + `<div class="card" style="max-height:52vh;overflow:auto">${msgs.map(m => `<div style="display:flex;justify-content:${m.from === 'tenant' ? 'flex-end' : 'flex-start'};margin:6px 0"><div style="max-width:75%;padding:8px 12px;border-radius:12px;background:${m.from === 'tenant' ? 'var(--brand)' : 'var(--surface-2)'};color:${m.from === 'tenant' ? 'var(--brand-ink)' : 'var(--ink)'}"><div class="small">${esc(m.text)}</div><div class="small" style="opacity:.7;font-size:11px">${dateTimeFr(m.createdAt)}</div></div></div>`).join('') || '<p class="small muted">Aucun message. Écrivez à votre propriétaire.</p>'}</div>
    <form data-action="g9-tsend" class="row" style="gap:8px;margin-top:12px"><input class="input" name="text" required maxlength="500" placeholder="Votre message…" autocomplete="off" ${l ? '' : 'disabled'}><button class="btn">Envoyer</button></form>`);
});
function sendMsg(leaseId, from, text, toUser, link) {
  DB.addItem(DB.K.tmsgs, {leaseId, from, text: text.slice(0, 500), read: false}); if (toUser) notify(toUser, `Nouveau message : ${text.slice(0, 50)}`, link);
}

/* ---------- Investisseur ---------- */
const ITYPES = ['Appartement', 'Villa', 'Immeuble', 'Terrain', 'Local commercial', 'Autre'];
route(/^\/invest\/home$/, () => {
  const u = Auth.current(); if (!u || u.role !== 'investor') { toast('Espace réservé aux investisseurs.', 'bad'); go('#/login'); return false; }
  const A = DB.filterItems(DB.K.iassets, a => a.ownerId === u.id), inv = sumA(A, a => a.buy), val = sumA(A, a => a.value), rent = sumA(A, a => a.rent) * 12, ch = sumA(A, a => a.charges) * 12;
  return shellApp(u, page('Mon patrimoine', 'Suivez la valeur, les loyers et la rentabilité de vos investissements.') +
    `<div class="kpis">${kpi(money(inv), 'Investi')}${kpi(money(val), 'Valeur actuelle')}${kpi(money(val - inv), 'Plus-value' + (inv ? ' (' + ((val - inv) / inv * 100).toFixed(1) + ' %)' : ''), val - inv < 0 ? 'bad' : 'ok')}${kpi(inv ? ((rent - ch) / inv * 100).toFixed(1) + ' %' : '—', 'Rendement net annuel', 'brand')}${kpi(money(Math.round((rent - ch) / 12)), 'Cash-flow mensuel')}</div>
    <form class="card" data-action="g9-iasset" style="margin:18px 0"><h4 style="margin-top:0">Ajouter un investissement</h4><div class="form-grid"><div class="field"><label>Désignation</label><input class="input" name="title" required></div><div class="field"><label>Type</label><select class="input" name="type">${ITYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Ville</label><input class="input" name="city"></div><div class="field"><label>Prix d'achat (FCFA)</label><input class="input" type="number" min="1" name="buy" required></div><div class="field"><label>Valeur actuelle (FCFA)</label><input class="input" type="number" min="0" name="value"></div>
      <div class="field"><label>Date d'achat</label><input class="input" type="date" name="date" value="${ymd()}"></div><div class="field"><label>Loyer mensuel</label><input class="input" type="number" min="0" name="rent" value="0"></div><div class="field"><label>Charges mensuelles</label><input class="input" type="number" min="0" name="charges" value="0"></div></div><button class="btn">Ajouter</button></form>
    <div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn ghost sm" data-action="g9-ipdf">Relevé de patrimoine (PDF)</button></div>` +
    gTable(['Actif', 'Achat', 'Valeur', 'Plus-value', 'Rendement net', ''], A.map(a => `<tr><td class="small"><b>${esc(a.title)}</b><br><span class="muted">${esc(a.type)}${a.city ? ' · ' + esc(a.city) : ''} · ${dateFr(a.date)}</span></td><td>${money(a.buy)}</td><td>${money(a.value)}</td><td><b style="color:var(--${a.value - a.buy < 0 ? 'bad' : 'ok'})">${money(a.value - a.buy)}</b></td><td>${a.buy ? (((a.rent - a.charges) * 12) / a.buy * 100).toFixed(1) + ' %' : '—'}</td>
      <td><div class="row" style="gap:6px"><button class="btn ghost sm" data-action="g9-ival" data-id="${a.id}">Mettre à jour la valeur</button><button class="btn ghost sm" data-action="g9-idel" data-id="${a.id}" aria-label="Supprimer">${icon('trash', 14)}</button></div></td></tr>`), ['Aucun investissement', 'Ajoutez vos biens pour suivre leur valeur et leur rendement.']));
});

/* ---------- Promoteur ---------- */
const PSTAT = ['en commercialisation', 'en construction', 'livré'], LOTST = {disponible:'ok', 'réservé':'warn', vendu:'info'};
route(/^\/promo\/home$/, () => {
  const u = Auth.current(); if (!u || u.role !== 'promoter') { toast('Espace réservé aux promoteurs.', 'bad'); go('#/login'); return false; }
  const PR = DB.filterItems(DB.K.programs, p => p.ownerId === u.id), L = DB.filterItems(DB.K.lots, l => l.ownerId === u.id), sold = L.filter(l => l.status === 'vendu'), res = L.filter(l => l.status === 'réservé');
  return shellApp(u, page('Mes programmes', 'Programmes immobiliers, lots et avancement des ventes.') +
    `<div class="kpis">${kpi(PR.length, 'Programmes')}${kpi(L.length, 'Lots')}${kpi(sold.length, 'Vendus', 'ok')}${kpi(res.length, 'Réservés')}${kpi(money(sumA(sold, l => l.price)), 'Chiffre d\'affaires vendu', 'brand')}</div>
    <div class="form-grid" style="margin:18px 0"><form class="card" data-action="g9-prog"><h4 style="margin-top:0">Nouveau programme</h4><div class="field"><label>Nom</label><input class="input" name="name" required></div><div class="field"><label>Ville / quartier</label><input class="input" name="city"></div>
      <div class="field"><label>Statut</label><select class="input" name="status">${PSTAT.map(s => `<option>${s}</option>`).join('')}</select></div><div class="field"><label>Livraison prévue</label><input class="input" type="date" name="delivery"></div><button class="btn">Créer</button></form>
      <form class="card" data-action="g9-lot"><h4 style="margin-top:0">Nouveau lot</h4><div class="field"><label>Programme</label><select class="input" name="programId" required>${PR.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">Créez d\'abord un programme</option>'}</select></div>
      <div class="field"><label>Référence</label><input class="input" name="ref" required placeholder="Villa V3, Lot 12…"></div><div class="field"><label>Surface (m²)</label><input class="input" type="number" min="0" name="surface"></div><div class="field"><label>Prix (FCFA)</label><input class="input" type="number" min="1" name="price" required></div><button class="btn">Ajouter le lot</button></form></div>` +
    gTable(['Programme', 'Statut', 'Lots', 'Avancement des ventes', 'CA vendu'], PR.map(p => { const pl = L.filter(l => l.programId === p.id), s = pl.filter(l => l.status === 'vendu').length, pc = pl.length ? Math.round(s / pl.length * 100) : 0;
      return `<tr><td class="small"><b>${esc(p.name)}</b><br><span class="muted">${esc(p.city || '')}${p.delivery ? ' · livraison ' + dateFr(p.delivery) : ''}</span></td><td>${badge(p.status, 'info')}</td><td>${pl.length}</td><td style="min-width:150px"><div style="height:8px;border-radius:6px;background:var(--surface-3)"><div style="height:8px;border-radius:6px;background:var(--gold);width:${pc}%"></div></div><span class="small muted">${s}/${pl.length} vendus (${pc} %)</span></td><td>${money(sumA(pl.filter(l => l.status === 'vendu'), l => l.price))}</td></tr>`; }), ['Aucun programme', 'Créez votre premier programme pour y ajouter des lots.']) +
    `<h3 style="margin-top:24px">Lots</h3>` + gTable(['Lot', 'Programme', 'Surface', 'Prix', 'Statut', 'Acquéreur', ''], L.map(l => `<tr><td class="small"><b>${esc(l.ref)}</b></td><td class="small">${esc((DB.findItem(DB.K.programs, l.programId) || {}).name || '')}</td><td class="small">${l.surface ? l.surface + ' m²' : '—'}</td><td>${money(l.price)}</td>
      <td><select class="input" data-action="g9-lotst" data-id="${l.id}">${Object.keys(LOTST).map(s => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td class="small">${esc(l.buyer || '—')}</td><td><button class="btn ghost sm" data-action="g9-ldel" data-id="${l.id}" aria-label="Supprimer">${icon('trash', 14)}</button></td></tr>`), ['Aucun lot', 'Ajoutez les villas, appartements ou parcelles de vos programmes.']));
});

/* ---------- Actions ---------- */
async function relevePdf(kind, title, ref, partyLines, head, rows, note, u, name) {
  await loadPdf(); const I = issuer(u), [doc, y0] = pdfBegin(kind, ref, now(), title); let y = pdfParties(doc, y0, {t: 'Émetteur', lines: issuerLines(I)}, {t: 'Pour', lines: partyLines}); const n = head.length;
  y = pdfTable(doc, y, head.map((h, i) => ({h, w: i ? (180 - 55) / (n - 1) : 55, a: i ? 'r' : 'l'})), rows); if (note) pdfPara(doc, y, null, note); const f = pdfEnd(doc, u, name); await saveFile(f.name, f.blob);
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action^="g9-"]'), u = Auth.current(); if (!el || !u || ['SELECT', 'FORM'].includes(el.tagName)) return;
  const a = el.dataset.action, id = el.dataset.id, mine = k => DB.findItem(DB.K[k], x => x.id === id && x.ownerId === u.id), o = mine('owners');
  if (a === 'g9-ofiche' && o) ownerFiche(u, o);
  if (a === 'g9-odel' && o) confirmDialog({title: 'Supprimer le propriétaire', message: `${o.name} sera supprimé ; ses biens seront détachés.`, confirmLabel: 'Supprimer', danger: true, onConfirm: () => { myProps(u).filter(p => p.clientOwnerId === o.id).forEach(p => DB.updateItem(DB.K.properties, p.id, {clientOwnerId: ''})); DB.deleteItem(DB.K.owners, id); audit('Propriétaire supprimé', o.name); render(); }});
  if (a === 'g9-odetach') { const p = myProps(u).find(x => x.id === id), ow = mine2(el.dataset.o); if (p && ow) { DB.updateItem(DB.K.properties, id, {clientOwnerId: ''}); ownerFiche(u, ow); } }
  if (a === 'g9-opdf' && o) { if (u.member && !u.perms.includes('finances')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
    try { const y = yr(), s = ownerStats(u, o, y), lp = pid => (DB.findItem(DB.K.leases, pid) || {}).propertyId;
      const rows = s.P.map(p => { const r = sumA(gMine('rents', u).filter(x => x.paidAt && x.paidAt.startsWith(String(y)) && lp(x.leaseId) === p.id), x => x.amount) + sumA(horsVentes(gMine('fpay', u)).filter(x => x.createdAt.startsWith(String(y)) && x.propertyId === p.id), x => x.amount), d = sumA(gMine('expenses', u).filter(x => x.date.startsWith(String(y)) && x.propertyId === p.id), x => x.amount) + sumA(gMine('tickets', u).filter(t => !t.expenseId && t.propertyId === p.id), t => t.cost), c = Math.round(r * o.rate / 100); return [p.title, fc(r), fc(d), fc(c), fc(r - d - c)]; });
      rows.push(['TOTAL', fc(s.rev), fc(s.dep), fc(s.com), fc(s.net)]);
      await relevePdf('RELEVÉ DE GESTION', 'Relevé ' + o.name, `REL-${y}-${o.id.slice(-4).toUpperCase()}`, [o.name, o.phone && 'Tél : ' + o.phone, o.address].filter(Boolean), ['Bien', 'Revenus', 'Dépenses', `Commission (${o.rate} %)`, 'Net'], rows, `Montant à reverser au propriétaire pour ${y} : ${fc(s.net)} (${enLettres(Math.max(0, s.net))} francs CFA).`, u, `releve-${o.name.replace(/\W+/g, '-')}-${y}`); audit('Relevé généré', o.name);
    } catch { toast('PDF indisponible : connexion Internet nécessaire.', 'bad'); } }
  if (a === 'g9-thread') { const l = mine('leases'), t = l && DB.findItem(DB.K.users, x => x.leaseId === l.id); if (!l) return;
    DB.filterItems(DB.K.tmsgs, x => x.leaseId === id && x.from === 'tenant' && !x.read).forEach(m => DB.updateItem(DB.K.tmsgs, m.id, {read: true}));
    const m = DB.filterItems(DB.K.tmsgs, x => x.leaseId === id);
    modal('Messages · ' + l.tenant, `<div style="max-height:45vh;overflow:auto">${m.map(x => `<div style="display:flex;justify-content:${x.from === 'owner' ? 'flex-end' : 'flex-start'};margin:6px 0"><div style="max-width:78%;padding:8px 12px;border-radius:12px;background:${x.from === 'owner' ? 'var(--brand)' : 'var(--surface-2)'};color:${x.from === 'owner' ? 'var(--brand-ink)' : 'var(--ink)'}"><div class="small">${esc(x.text)}</div><div style="opacity:.7;font-size:11px">${dateTimeFr(x.createdAt)}</div></div></div>`).join('') || '<p class="small muted">Aucun message.</p>'}</div>
      ${t ? `<form data-action="g9-osend" data-id="${id}" class="row" style="gap:8px;margin-top:12px"><input class="input" name="text" required maxlength="500" placeholder="Votre réponse…" autocomplete="off"><button class="btn">Envoyer</button></form>` : '<p class="small muted" style="margin-top:10px">Ce locataire n\'a pas d\'accès en ligne (Gestion > Équipe & accès).</p>'}`); }
  if (a === 'g9-ival' && u.role === 'investor') { const x = mine('iassets'); if (x) promptDialog({title: 'Valeur de ' + x.title, label: 'Nouvelle valeur estimée (FCFA)', value: String(x.value), onConfirm: v => { DB.updateItem(DB.K.iassets, id, {value: Math.max(0, +v || 0)}); toast('Valeur mise à jour.'); render(); }}); }
  if (a === 'g9-idel' && u.role === 'investor' && mine('iassets')) confirmDialog({title: 'Supprimer l\'actif', message: 'Cet investissement sera retiré de votre patrimoine.', confirmLabel: 'Supprimer', danger: true, onConfirm: () => { DB.deleteItem(DB.K.iassets, id); render(); }});
  if (a === 'g9-ipdf' && u.role === 'investor') { try { const A = DB.filterItems(DB.K.iassets, x => x.ownerId === u.id), inv = sumA(A, x => x.buy), val = sumA(A, x => x.value), rows = A.map(x => [x.title, fc(x.buy), fc(x.value), fc(x.value - x.buy), x.buy ? (((x.rent - x.charges) * 12) / x.buy * 100).toFixed(1) + ' %' : '-']);
      rows.push(['TOTAL', fc(inv), fc(val), fc(val - inv), '']); await relevePdf('PATRIMOINE', 'Relevé de patrimoine', `PAT-${yr()}-${u.id.slice(-4).toUpperCase()}`, [`${u.firstName} ${u.lastName}`, u.phone && 'Tél : ' + u.phone], ['Actif', 'Achat', 'Valeur', 'Plus-value', 'Rend. net'], rows, 'Valeurs estimées par l\'investisseur ; elles ne constituent pas une expertise.', {...u, docInfo: {name: `${u.firstName} ${u.lastName}`, phone: u.phone}}, 'patrimoine-' + yr()); } catch { toast('PDF indisponible : connexion Internet nécessaire.', 'bad'); } }
  if (a === 'g9-ldel' && u.role === 'promoter' && mine('lots')) { DB.deleteItem(DB.K.lots, id); render(); }
});
const mine2 = id => DB.findItem(DB.K.owners, x => x.id === id && x.ownerId === (Auth.current() || {}).id);
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action="g9-lotst"]'), u = Auth.current(); if (!el || !u || u.role !== 'promoter') return;
  const l = DB.findItem(DB.K.lots, x => x.id === el.dataset.id && x.ownerId === u.id); if (!l) return;
  if (el.value === 'disponible') { DB.updateItem(DB.K.lots, l.id, {status: 'disponible', buyer: ''}); render(); return; }
  promptDialog({title: `${l.ref} : ${el.value}`, label: 'Nom de l\'acquéreur', onConfirm: v => { DB.updateItem(DB.K.lots, l.id, {status: el.value, buyer: v}); toast('Lot mis à jour.'); render(); }}); render();
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action^="g9-"]'), u = Auth.current(); if (!f || !u) return; e.preventDefault(); const a = f.dataset.action, d = formData(f);
  if (a === 'g9-owner' && ['owner', 'agency'].includes(u.role)) { if (d.cni && !/^\d{13}$/.test(d.cni)) { toast('La CNI doit comporter 13 chiffres.', 'bad'); return; }
    const o = DB.addItem(DB.K.owners, {ownerId: u.id, name: d.name.trim(), phone: d.phone.trim(), email: d.email, cni: d.cni, address: d.address, kind: d.kind, rate: Math.min(50, Math.max(0, +d.rate || 0))}); audit('Propriétaire créé', o.name); toast('Propriétaire ajouté.'); render(); }
  if (a === 'g9-oattach') { const o = mine2(f.dataset.id), p = myProps(u).find(x => x.id === d.propertyId && !x.clientOwnerId); if (o && p) { DB.updateItem(DB.K.properties, p.id, {clientOwnerId: o.id}); ownerFiche(u, o); } }
  if (a === 'g9-tsend' && u.role === 'tenant') { const l = tl(u.leaseId); if (l && d.text.trim()) { sendMsg(l.id, 'tenant', d.text.trim(), l.ownerId, '#/manage/tmsgs'); render(); } }
  if (a === 'g9-osend') { const l = DB.findItem(DB.K.leases, x => x.id === f.dataset.id && x.ownerId === u.id), t = l && DB.findItem(DB.K.users, x => x.leaseId === l.id); if (l && t && d.text.trim()) { sendMsg(l.id, 'owner', d.text.trim(), t.id, '#/tenant/messages'); closeModal(); toast('Message envoyé.'); } }
  if (a === 'g9-iasset' && u.role === 'investor') { DB.addItem(DB.K.iassets, {ownerId: u.id, title: d.title.trim(), type: d.type, city: d.city, buy: +d.buy || 0, value: +d.value || +d.buy || 0, date: d.date, rent: +d.rent || 0, charges: +d.charges || 0}); toast('Investissement ajouté.'); render(); }
  if (a === 'g9-prog' && u.role === 'promoter') { DB.addItem(DB.K.programs, {ownerId: u.id, name: d.name.trim(), city: d.city, status: PSTAT.includes(d.status) ? d.status : PSTAT[0], delivery: d.delivery}); toast('Programme créé.'); render(); }
  if (a === 'g9-lot' && u.role === 'promoter') { if (!DB.findItem(DB.K.programs, x => x.id === d.programId && x.ownerId === u.id)) { toast('Créez d\'abord un programme.', 'bad'); return; } DB.addItem(DB.K.lots, {ownerId: u.id, programId: d.programId, ref: d.ref.trim(), surface: +d.surface || 0, price: +d.price || 0, status: 'disponible', buyer: ''}); toast('Lot ajouté.'); render(); }
});

/* ---------- Démo : comptes investisseur et promoteur, mandats, messages ---------- */
function seedV10() {
  if (localStorage.getItem(DB.K.v10seed)) return; const ag = DB.findItem(DB.K.users, x => x.cni === '1900000000004'), ow = DB.findItem(DB.K.users, x => x.cni === '1900000000003'), ten = DB.findItem(DB.K.users, x => x.cni === '1900000000013'); if (!ag || !ow) return;
  localStorage.setItem(DB.K.v10seed, '1'); const base = {password: 'demo123', status: 'actif', registrationPaid: true, agencyName: '', address: '', agencyDesc: ''};
  const inv = DB.addItem(DB.K.users, {...base, cni: '1900000000021', firstName: 'Cheikh', lastName: 'Investisseur', phone: '770000021', role: 'investor'}), pro = DB.addItem(DB.K.users, {...base, cni: '1900000000022', firstName: 'Mariama', lastName: 'Promotrice', phone: '770000022', role: 'promoter'});
  [['Appartement Mermoz', 'Appartement', 'Dakar', 85000000, 98000000, 650000, 80000], ['Terrain Diamniadio', 'Terrain', 'Diamniadio', 30000000, 42000000, 0, 0]].forEach(([t, ty, c, b, v, r, ch]) => DB.addItem(DB.K.iassets, {ownerId: inv.id, title: t, type: ty, city: c, buy: b, value: v, date: addDays(now(), -400).slice(0, 10), rent: r, charges: ch}));
  const pg = DB.addItem(DB.K.programs, {ownerId: pro.id, name: 'Résidence Les Almadies', city: 'Dakar, Almadies', status: 'en construction', delivery: addDays(now(), 300).slice(0, 10)});
  [['Villa V1', 220, 180000000, 'vendu', 'Famille Gueye'], ['Villa V2', 220, 180000000, 'réservé', 'M. Ba'], ['Villa V3', 240, 195000000, 'disponible', ''], ['Appart A1', 110, 85000000, 'vendu', 'Mme Sarr'], ['Appart A2', 110, 85000000, 'disponible', '']].forEach(([r, s, p, st, by]) => DB.addItem(DB.K.lots, {ownerId: pro.id, programId: pg.id, ref: r, surface: s, price: p, status: st, buyer: by}));
  const P = DB.filterItems(DB.K.properties, p => p.ownerId === ag.id), o1 = DB.addItem(DB.K.owners, {ownerId: ag.id, name: 'Ousmane Diallo', phone: '770000031', email: 'o.diallo@mail.sn', cni: '1900000000031', address: 'Sicap, Dakar', kind: 'Particulier', rate: 8}), o2 = DB.addItem(DB.K.owners, {ownerId: ag.id, name: 'SCI Teranga', phone: '770000032', email: 'contact@teranga.sn', cni: '', address: 'Plateau, Dakar', kind: 'Société', rate: 10});
  P.slice(0, 2).forEach(p => DB.updateItem(DB.K.properties, p.id, {clientOwnerId: o1.id})); P.slice(2, 4).forEach(p => DB.updateItem(DB.K.properties, p.id, {clientOwnerId: o2.id}));
  if (ten && ten.leaseId) DB.addItem(DB.K.tmsgs, {leaseId: ten.leaseId, from: 'owner', text: 'Bonjour, n\'hésitez pas à me signaler tout problème dans le logement.', read: false});
}
etapeAmorcage('mandants, investisseur, promoteur', seedV10);

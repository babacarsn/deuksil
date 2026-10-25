/* ==========================================================================
   MODULE : v10.js — fiches propriétaires (mandats), espace locataire complet
   (paiement du loyer, messagerie), audit détaillé, statut « en maintenance »
   des biens.
   ========================================================================== */
Object.assign(DB.K, {owners:'deuksil_owners', tmsgs:'deuksil_tmsgs'});
STATUS_LABEL.maintenance = 'En maintenance'; STATUS_TONE.maintenance = 'warn';
GTABS.splice(GTABS.findIndex(t => t[0] === 'tenants') + 1, 0, ['owners', 'Propriétaires'], ['tmsgs', 'Messages locataires']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit|contracts|providers|team|identity|units|tenants|reports|owners|tmsgs)$/;
MENUS_RAW.tenant.splice(2, 0, ['#/tenant/messages', 'Messages', 'message']);
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
  const rev = encLoyers(gMine('rents', u), Y, r => ids.includes(lp(r.leaseId))) + sumA(horsVentes(gMine('fpay', u)).filter(p => p.createdAt.startsWith(Y) && ids.includes(p.propertyId)), p => p.amount);
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
      const rows = s.P.map(p => { const r = encLoyers(gMine('rents', u), String(y), x => lp(x.leaseId) === p.id) + sumA(horsVentes(gMine('fpay', u)).filter(x => x.createdAt.startsWith(String(y)) && x.propertyId === p.id), x => x.amount), d = sumA(gMine('expenses', u).filter(x => x.date.startsWith(String(y)) && x.propertyId === p.id), x => x.amount) + sumA(gMine('tickets', u).filter(t => !t.expenseId && t.propertyId === p.id), t => t.cost), c = Math.round(r * o.rate / 100); return [p.title, fc(r), fc(d), fc(c), fc(r - d - c)]; });
      rows.push(['TOTAL', fc(s.rev), fc(s.dep), fc(s.com), fc(s.net)]);
      await relevePdf('RELEVÉ DE GESTION', 'Relevé ' + o.name, `REL-${y}-${o.id.slice(-4).toUpperCase()}`, [o.name, o.phone && 'Tél : ' + o.phone, o.address].filter(Boolean), ['Bien', 'Revenus', 'Dépenses', `Commission (${o.rate} %)`, 'Net'], rows, `Montant à reverser au propriétaire pour ${y} : ${fc(s.net)} (${enLettres(Math.max(0, s.net))} francs CFA).`, u, `releve-${o.name.replace(/\W+/g, '-')}-${y}`); audit('Relevé généré', o.name);
    } catch { toast('PDF indisponible : connexion Internet nécessaire.', 'bad'); } }
  if (a === 'g9-thread') { const l = mine('leases'), t = l && DB.findItem(DB.K.users, x => x.leaseId === l.id); if (!l) return;
    DB.filterItems(DB.K.tmsgs, x => x.leaseId === id && x.from === 'tenant' && !x.read).forEach(m => DB.updateItem(DB.K.tmsgs, m.id, {read: true}));
    const m = DB.filterItems(DB.K.tmsgs, x => x.leaseId === id);
    modal('Messages · ' + l.tenant, `<div style="max-height:45vh;overflow:auto">${m.map(x => `<div style="display:flex;justify-content:${x.from === 'owner' ? 'flex-end' : 'flex-start'};margin:6px 0"><div style="max-width:78%;padding:8px 12px;border-radius:12px;background:${x.from === 'owner' ? 'var(--brand)' : 'var(--surface-2)'};color:${x.from === 'owner' ? 'var(--brand-ink)' : 'var(--ink)'}"><div class="small">${esc(x.text)}</div><div style="opacity:.7;font-size:11px">${dateTimeFr(x.createdAt)}</div></div></div>`).join('') || '<p class="small muted">Aucun message.</p>'}</div>
      ${t ? `<form data-action="g9-osend" data-id="${id}" class="row" style="gap:8px;margin-top:12px"><input class="input" name="text" required maxlength="500" placeholder="Votre réponse…" autocomplete="off"><button class="btn">Envoyer</button></form>` : '<p class="small muted" style="margin-top:10px">Ce locataire n\'a pas d\'accès en ligne (Gestion > Équipe & accès).</p>'}`); }
});
const mine2 = id => DB.findItem(DB.K.owners, x => x.id === id && x.ownerId === (Auth.current() || {}).id);
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action^="g9-"]'), u = Auth.current(); if (!f || !u) return; e.preventDefault(); const a = f.dataset.action, d = formData(f);
  if (a === 'g9-owner' && ['owner', 'agency'].includes(u.role)) { if (d.cni && !/^\d{13}$/.test(d.cni)) { toast('La CNI doit comporter 13 chiffres.', 'bad'); return; }
    const o = DB.addItem(DB.K.owners, {ownerId: u.id, name: d.name.trim(), phone: d.phone.trim(), email: d.email, cni: d.cni, address: d.address, kind: d.kind, rate: Math.min(50, Math.max(0, +d.rate || 0))}); audit('Propriétaire créé', o.name); toast('Propriétaire ajouté.'); render(); }
  if (a === 'g9-oattach') { const o = mine2(f.dataset.id), p = myProps(u).find(x => x.id === d.propertyId && !x.clientOwnerId); if (o && p) { DB.updateItem(DB.K.properties, p.id, {clientOwnerId: o.id}); ownerFiche(u, o); } }
  if (a === 'g9-tsend' && u.role === 'tenant') { const l = tl(u.leaseId); if (l && d.text.trim()) { sendMsg(l.id, 'tenant', d.text.trim(), l.ownerId, '#/manage/tmsgs'); render(); } }
  if (a === 'g9-osend') { const l = DB.findItem(DB.K.leases, x => x.id === f.dataset.id && x.ownerId === u.id), t = l && DB.findItem(DB.K.users, x => x.leaseId === l.id); if (l && t && d.text.trim()) { sendMsg(l.id, 'owner', d.text.trim(), t.id, '#/tenant/messages'); closeModal(); toast('Message envoyé.'); } }
});


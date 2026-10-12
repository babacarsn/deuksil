/* ==========================================================================
   MODULE : finance.js — V2 : devis, proformas, factures, avoirs, paiements,
   reçus, dépenses, rentabilité et journal d'audit (s'appuie sur gestion.js)
   ========================================================================== */
Object.assign(DB.K, {docs:'deuksil_docs', fpay:'deuksil_fpay', expenses:'deuksil_expenses', audit:'deuksil_audit'});
GTABS.splice(4, 0, ['docs', 'Devis & Factures'], ['fpay', 'Paiements'], ['expenses', 'Dépenses']); GTABS.push(['audit', 'Journal']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit)$/;

const DT = {DEV:'Devis', PF:'Proforma', FAC:'Facture', AV:'Avoir'};
const PAYM = ['Espèces', 'Virement', 'Wave', 'Orange Money', 'Carte bancaire', 'Autre'];
const EXPC = ['maintenance', 'réparation', 'électricité', 'eau', 'nettoyage', 'gardiennage', 'travaux', 'assurance', 'taxes', 'commissions', 'fournitures', 'autres'];
const nref = (p, k) => { const y = new Date().getFullYear(), re = new RegExp('^' + p + '-' + y + '-(\\d+)$'); const mx = DB.getData(DB.K[k]).reduce((m, x) => { const r = re.exec(x.ref || ''); return r ? Math.max(m, +r[1]) : m; }, 0); return `${p}-${y}-${String(mx + 1).padStart(5, '0')}`; };
const audit = (action, detail) => { const u = Auth.current(); if (u) DB.addItem(DB.K.audit, {ownerId: u.id, who: u.member ? `${u.firstName} ${u.lastName}` : u.role === 'agency' ? u.agencyName : u.firstName, action, detail}); };
const dTot = d => Math.round(d.items.reduce((t, i) => t + i.qty * i.price, 0) * (1 - (d.discount || 0) / 100) * (1 + (d.tax || 0) / 100));
const dCred = d => DB.getData(DB.K.docs).filter(x => x.type === 'AV' && x.parentId === d.id).reduce((s, x) => s + dTot(x), 0);
const dPaid = d => DB.getData(DB.K.fpay).filter(p => p.docId === d.id).reduce((s, p) => s + p.amount, 0);
/* Un encaissement rattaché à une facture de vente (dossier de vente) est un
   produit de cession, pas un revenu locatif : il a son propre rapport
   (« Ventes de biens ») et ne doit gonfler ni le revenu du mois, ni la
   rentabilité d'un bien, ni la commission de gestion d'un mandant. */
const idsFacturesVente = () => new Set(DB.getData(DB.K.docs).filter(d => d.dealId).map(d => d.id));
const horsVentes = list => { const v = idsFacturesVente(); return list.filter(p => !v.has(p.docId)); };
const queVentes = list => { const v = idsFacturesVente(); return list.filter(p => v.has(p.docId)); };
const dRest = d => Math.max(0, dTot(d) - dCred(d) - dPaid(d));
const hasChild = d => DB.getData(DB.K.docs).some(x => x.parentId === d.id && x.type !== 'AV');
function dState(d) {
  if (d.type === 'FAC') {
    const t = dTot(d) - dCred(d), p = dPaid(d);
    if (t <= 0) return ['Soldée (avoir)', 'ok']; if (p >= t) return ['Payée', 'ok']; if (p > 0) return ['Partiellement payée', 'warn'];
    return d.due < now().slice(0, 10) ? ['En retard', 'bad'] : ['Émise', 'info'];
  }
  return [d.status, {accepté:'ok', refusé:'bad', envoyé:'info'}[d.status] || ''];
}
function mkDoc(u, type, o) {
  const d = DB.addItem(DB.K.docs, {ownerId: u.id, type, ref: nref(type, 'docs'), client: '', propertyId: '', items: [], discount: 0, status: type === 'AV' ? 'émis' : 'envoyé', due: addDays(now(), 30).slice(0, 10), ...o});
  audit('Création ' + DT[type], d.ref); return d;
}
function docHtml(d, u) {
  const co = ownerLabel(u), p = gProp(d.propertyId), cr = dCred(d), pd = dPaid(d);
  return `<div style="font-family:sans-serif;color:#0F3057"><div style="display:flex;justify-content:space-between"><div><b style="font-size:1.3em">${esc(co)}</b><br><small>${esc(u.phone || '')} · Sénégal</small></div>
    <div style="text-align:right"><b style="font-size:1.2em">${DT[d.type].toUpperCase()}</b><br>${d.ref}<br><small>${dateFr(d.createdAt)}${d.type === 'FAC' ? ' · échéance ' + dateFr(d.due) : ''}</small></div></div>
    <p><b>Client :</b> ${esc(d.client)}${p ? '<br><b>Bien :</b> ' + esc(p.title) : ''}</p>
    <table style="width:100%;border-collapse:collapse"><tr style="background:#eee"><th align=left>Désignation</th><th>Qté</th><th align=right>P.U.</th><th align=right>Total</th></tr>
    ${d.items.map(i => `<tr><td>${esc(i.label)}</td><td align=center>${i.qty}</td><td align=right>${money(i.price)}</td><td align=right>${money(i.qty * i.price)}</td></tr>`).join('')}</table>
    <p style="text-align:right">${d.discount ? `Remise : ${d.discount} %<br>` : ''}${d.tax ? `TVA : ${d.tax} %<br>` : ''}<b>Total : ${money(dTot(d))}</b>${d.type === 'FAC' ? `${cr ? '<br>Avoirs : −' + money(cr) : ''}<br>Payé : ${money(pd)}<br><b>Reste à payer : ${money(dRest(d))}</b>` : ''}</p>
    <small>Paiement : espèces, virement, Wave, Orange Money. ${d.type === 'DEV' || d.type === 'PF' ? 'Document non contractuel avant acceptation.' : ''}</small></div>`;
}
function docForm(type, d) {
  const lines = [0, 1, 2].map(i => `<div class="form-grid"><div class="field"><input class="input" name="l${i}" placeholder="Désignation ${i + 1}" ${i === 0 ? 'required' : ''}></div>
    <div class="field"><input class="input" type="number" min="1" name="q${i}" value="1"></div><div class="field"><input class="input" type="number" min="0" name="p${i}" placeholder="Prix unitaire"></div></div>`).join('');
  modal('Nouveau ' + DT[type].toLowerCase(), `<form data-action="g2-save-doc" data-id="${type}"><div class="form-grid"><div class="field"><label>Client</label><input class="input" name="client" required></div><div class="field"><label>Téléphone du client</label><input class="input" name="clientPhone"></div><div class="field"><label>Adresse du client</label><input class="input" name="clientAddress"></div><div class="field"><label>TVA</label><select class="input" name="tax"><option value="0">Sans TVA</option><option value="18">TVA 18 %</option></select></div>
    <div class="field"><label>Bien (facultatif)</label><select class="input" name="propertyId"><option value="">—</option>${gOpts(myProps(Auth.current()))}</select></div>
    <div class="field"><label>Remise (%)</label><input class="input" type="number" min="0" max="100" name="discount" value="0"></div>
    <div class="field"><label>Échéance (jours)</label><input class="input" type="number" min="1" name="days" value="30"></div></div>${lines}<button class="btn block">Créer</button></form>`);
}
vueGestion(['docs', 'fpay', 'expenses', 'finance', 'audit'], function (u, tab) {
  const props = myProps(u), docs = gMine('docs', u), pays = gMine('fpay', u), exps = gMine('expenses', u), fac = docs.filter(x => x.type === 'FAC');
  const search = sBar();
  if (tab === 'docs') return `<div class="row-between" style="margin-bottom:14px">${search}<div class="row" style="gap:8px">${['DEV', 'PF', 'FAC'].map(t => `<button class="btn sm" data-action="g2-new" data-id="${t}">+ ${DT[t]}</button>`).join('')}</div></div>` +
    gTable(['Référence', 'Client', 'Total', 'Reste', 'État', ''], docs.slice().reverse().map(d => {
      const [l, t] = dState(d), fc = d.type === 'FAC';
      return `<tr><td class="small"><b>${d.ref}</b><br><span class="muted">${DT[d.type]}</span></td><td class="small">${esc(d.client)}</td><td>${money(dTot(d))}</td><td>${fc ? money(dRest(d)) : '—'}</td><td>${badge(l, t)}</td>
      <td><div class="row" style="gap:6px"><button class="btn ghost sm" data-action="g2-view" data-id="${d.id}">Voir</button>
      ${d.status === 'envoyé' && !fc ? `<button class="btn sm" data-action="g2-ok" data-id="${d.id}">Accepter</button><button class="btn ghost sm" data-action="g2-no" data-id="${d.id}">Refuser</button>` : ''}
      ${d.status === 'accepté' && !hasChild(d) && d.type === 'DEV' ? `<button class="btn sm" data-action="g2-next" data-id="${d.id}">→ Proforma</button>` : ''}
      ${d.status === 'accepté' && !hasChild(d) && d.type === 'PF' ? `<button class="btn sm" data-action="g2-next" data-id="${d.id}">→ Facture</button>` : ''}
      ${fc && dRest(d) > 0 ? `<button class="btn sm" data-action="g2-pay" data-id="${d.id}">Encaisser</button>` : ''}${fc && dTot(d) - dCred(d) > 0 ? `<button class="btn ghost sm" data-action="g2-credit" data-id="${d.id}">Avoir</button>` : ''}</div></td></tr>`;
    }), ['Aucun document', 'Créez un devis, puis suivez le cycle : proforma → facture → paiement → reçu.']);
  if (tab === 'fpay') return `<div style="margin-bottom:14px">${search}</div>` + gTable(['Paiement', 'Reçu', 'Facture', 'Client', 'Mode', 'Montant', 'Date', ''], pays.slice().reverse().map(p => `<tr><td class="small"><b>${p.ref}</b></td><td class="small">${p.rec}</td><td class="small">${esc(p.docRef)}</td><td class="small">${esc(p.client)}</td><td class="small">${p.method}</td><td>${money(p.amount)}</td><td class="small muted">${dateFr(p.createdAt)}</td><td><button class="btn ghost sm" data-action="g2-rec" data-id="${p.id}">Reçu</button></td></tr>`), ['Aucun paiement', 'Encaissez une facture pour générer paiement et reçu.']);
  if (tab === 'expenses') return `<form class="card" data-action="g2-expense" style="margin-bottom:18px"><div class="form-grid">
      <div class="field"><label>Bien</label><select class="input" name="propertyId" required>${gOpts(props)}</select></div><div class="field"><label>Fournisseur</label><input class="input" name="supplier" required></div>
      <div class="field"><label>Catégorie</label><select class="input" name="cat">${EXPC.map(c => `<option>${c}</option>`).join('')}</select></div><div class="field"><label>Montant (FCFA)</label><input class="input" type="number" min="1" name="amount" required></div>
      <div class="field"><label>Mode</label><select class="input" name="method">${PAYM.map(c => `<option>${c}</option>`).join('')}</select></div><div class="field"><label>Date</label><input class="input" type="date" name="date" value="${now().slice(0, 10)}"></div></div><button class="btn">Enregistrer la dépense</button></form>` +
    gTable(['Réf.', 'Bien', 'Fournisseur', 'Catégorie', 'Montant', 'Date', ''], exps.slice().reverse().map(x => `<tr><td class="small"><b>${x.ref}</b></td><td class="small">${esc((gProp(x.propertyId) || {}).title || '')}</td><td class="small">${esc(x.supplier)}</td><td class="small">${x.cat}</td><td>${money(x.amount)}</td><td class="small muted">${dateFr(x.date)}</td><td><div class="row" style="gap:6px">${x.proofId ? `<button class="btn ghost sm" data-action="g7-view" data-id="${x.proofId}">Justificatif</button>` : ''}<button class="btn ghost sm" data-action="g2-delx" data-id="${x.id}" aria-label="Supprimer">${icon('trash', 14)}</button></div></td></tr>`), ['Aucune dépense', 'Enregistrez les charges de chaque bien pour calculer la rentabilité.']);
  if (tab === 'audit') return gTable(['Date', 'Utilisateur', 'Action', 'Détail'], gMine('audit', u).slice().reverse().slice(0, 100).map(a => `<tr><td class="small muted">${dateTimeFr(a.createdAt)}</td><td class="small">${esc(a.who)}</td><td class="small"><b>${esc(a.action)}</b></td><td class="small">${esc(a.detail)}</td></tr>`), ['Journal vide', 'Les actions sensibles (création, paiement, suppression) sont tracées ici.']);
  /* finance : rentabilité */
  const rents = gMine('rents', u).filter(r => rPaid(r) > 0), tk = gMine('tickets', u), leaseProp = id => (DB.findItem(DB.K.leases, id) || {}).propertyId;
  const inc = {}, out = {}, add = (o, k, v) => o[k] = (o[k] || 0) + v;
  rents.forEach(r => rPays(r).forEach(x => add(inc, String(x.date).slice(0, 7), +x.amount || 0))); horsVentes(pays).forEach(p => add(inc, p.createdAt.slice(0, 7), p.amount));
  exps.forEach(x => add(out, x.date.slice(0, 7), x.amount)); tk.filter(t => !t.expenseId).forEach(t => add(out, (t.createdAt || now()).slice(0, 7), t.cost));
  const I = Object.values(inc).reduce((a, b) => a + b, 0), O = Object.values(out).reduce((a, b) => a + b, 0);
  const unpaid = fac.reduce((s, d) => s + dRest(d), 0) + gMine('rents', u).filter(r => !r.paidAt && rentState(r)[1] === 'bad').reduce((s, r) => s + rRest(r), 0);
  const ms = [...Array(6)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); }), mx = Math.max(1, ...ms.map(m => Math.max(inc[m] || 0, out[m] || 0)));
  return `<div class="kpis">${kpi(money(fac.reduce((s, d) => s + dTot(d) - dCred(d), 0)), 'Facturé')}${kpi(money(I), 'Encaissé (loyers + factures)', 'ok')}${kpi(money(unpaid), 'Impayés', 'bad')}${kpi(money(O), 'Dépenses')}${kpi(money(I - O), 'Résultat net', 'brand')}</div>
  <div class="card" style="margin:18px 0"><b class="small">Revenus (bleu) et dépenses (doré), 6 derniers mois</b><div style="display:flex;gap:14px;align-items:flex-end;height:120px;margin-top:10px">${ms.map(m => `<div style="flex:1;text-align:center"><div style="display:flex;gap:3px;align-items:flex-end;height:96px"><i style="flex:1;background:var(--brand);height:${(inc[m] || 0) / mx * 100}%"></i><i style="flex:1;background:var(--gold);height:${(out[m] || 0) / mx * 100}%"></i></div><span class="small muted">${m.slice(5)}/${m.slice(2, 4)}</span></div>`).join('')}</div></div>` +
    gTable(['Bien', 'Revenus', 'Dépenses', 'Net', 'Rentabilité'], props.map(p => {
      const r = rents.filter(x => leaseProp(x.leaseId) === p.id).reduce((s, x) => s + rPaid(x), 0) + horsVentes(pays).filter(x => x.propertyId === p.id).reduce((s, x) => s + x.amount, 0);
      const c = exps.filter(x => x.propertyId === p.id).reduce((s, x) => s + x.amount, 0) + tk.filter(x => x.propertyId === p.id && !x.expenseId).reduce((s, x) => s + x.cost, 0);
      return `<tr><td class="small"><b>${esc(p.title)}</b></td><td>${money(r)}</td><td>${money(c)}</td><td><b style="color:var(--${r - c < 0 ? 'bad' : 'ok'})">${money(r - c)}</b></td><td>${p.price && p.transaction !== 'location' ? ((r - c) / p.price * 100).toFixed(1) + ' %' : '—'}</td></tr>`;
    }), ['Aucun bien', 'Ajoutez des biens pour suivre leur rentabilité.']);
});
/* Le filtrage des listes pendant la frappe est dans 79-recherche.js. */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action^="g2-"]'), u = Auth.current(); if (!el || !u || el.tagName === 'FORM') return;
  const a = el.dataset.action, id = el.dataset.id, own = k => DB.findItem(DB.K[k], x => x.id === id && x.ownerId === u.id), d = own('docs');
  if (a === 'g2-new') docForm(id);
  if (a === 'g2-view' && d) modal(d.ref, `<div class="card pad-s">${docHtml(d, u)}</div><div style="margin-top:12px">${dlLink(docHtml(d, u), d.ref)}</div>`);
  if (a === 'g2-ok' && d) { DB.updateItem(DB.K.docs, id, {status: 'accepté'}); audit('Acceptation', d.ref); toast(d.ref + ' accepté.'); render(); }
  if (a === 'g2-no' && d) { DB.updateItem(DB.K.docs, id, {status: 'refusé'}); audit('Refus', d.ref); render(); }
  if (a === 'g2-next' && d) {
    const n = mkDoc(u, d.type === 'DEV' ? 'PF' : 'FAC', {client: d.client, propertyId: d.propertyId, items: d.items, discount: d.discount, parentId: d.id, status: d.type === 'DEV' ? 'envoyé' : 'émise'});
    render(); autoFileThen('doc', n, `${n.ref} créé à partir de ${d.ref}`);
  }
  if (a === 'g2-pay' && d) modal('Encaisser ' + d.ref, `<p class="small muted">Reste à payer : <b>${money(dRest(d))}</b></p><form data-action="g2-save-pay" data-id="${id}">
    <div class="field"><label>Montant (FCFA)</label><input class="input" type="number" min="1" max="${dRest(d)}" name="amount" value="${dRest(d)}" required></div>
    <div class="field"><label>Mode de paiement</label><select class="input" name="method">${PAYM.map(c => `<option>${c}</option>`).join('')}</select></div><button class="btn block">Valider le paiement</button></form>`);
  if (a === 'g2-credit' && d) promptDialog({title: 'Avoir sur ' + d.ref, label: 'Montant de l\'avoir (FCFA)', onConfirm: v => {
    const m = +v; if (!(m > 0) || m > dRest(d)) { toast('Montant invalide : un avoir ne peut pas dépasser le reste à payer (les remboursements ne sont pas gérés).', 'bad'); return; }
    const av = mkDoc(u, 'AV', {client: d.client, propertyId: d.propertyId, items: [{label: 'Avoir sur ' + d.ref, qty: 1, price: m}], parentId: d.id}); render(); autoFileThen('doc', av, 'Avoir créé'); }});
  const p = own('fpay');
  if (a === 'g2-rec' && p) { const html = `<div style="font-family:sans-serif;color:#0F3057"><h2>REÇU ${p.rec}</h2><p>Reçu de <b>${esc(p.client)}</b> la somme de <b>${money(p.amount)}</b> (${p.method}) pour la facture ${esc(p.docRef)}, le ${dateFr(p.createdAt)}.</p><p>Référence paiement : ${p.ref}</p></div>`;
    modal('Reçu ' + p.rec, `<div class="card pad-s">${html}</div><div style="margin-top:12px">${dlLink(html, p.rec)}</div>`); }
  const x = own('expenses');
  if (a === 'g2-delx' && x) confirmDialog({title: 'Supprimer la dépense', message: x.ref + ' sera définitivement supprimée.', confirmLabel: 'Supprimer', danger: true, onConfirm: () => { DB.deleteItem(DB.K.expenses, id); DB.filterItems(DB.K.tickets, t => t.expenseId === id).forEach(t => DB.updateItem(DB.K.tickets, t.id, {expenseId: ''})); audit('Suppression dépense', x.ref); render(); }});
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action^="g2-"]'), u = Auth.current(); if (!f || !u) return;
  e.preventDefault(); const a = f.dataset.action, id = f.dataset.id, d = formData(f);
  if (d.propertyId && !myProps(u).some(p => p.id === d.propertyId)) { toast('Choisissez un de vos biens.', 'bad'); return; }
  if (a === 'g2-save-doc') {
    const items = [0, 1, 2].map(i => ({label: (d['l' + i] || '').trim(), qty: +d['q' + i] || 1, price: +d['p' + i] || 0})).filter(i => i.label);
    if (!items.length || !d.client.trim()) { toast('Client et au moins une ligne sont requis.', 'bad'); return; }
    const n = mkDoc(u, id, {client: d.client.trim(), clientPhone: (d.clientPhone || '').trim(), clientAddress: (d.clientAddress || '').trim(), tax: +d.tax === 18 ? 18 : 0, propertyId: d.propertyId, items, discount: Math.min(100, +d.discount || 0), due: addDays(now(), +d.days || 30).slice(0, 10), status: id === 'FAC' ? 'émise' : 'envoyé'});
    closeModal(); render(); showCreated('doc', n.ref); autoFileThen('doc', n, n.ref + ' créé');
  }
  if (a === 'g2-save-pay') {
    const doc = DB.findItem(DB.K.docs, x => x.id === id && x.ownerId === u.id), m = +d.amount;
    if (!doc || !(m > 0) || m > dRest(doc)) { toast('Montant supérieur au reste à payer.', 'bad'); return; }
    const ref = nref('PAY', 'fpay'), pay = DB.addItem(DB.K.fpay, {ownerId: u.id, docId: id, docRef: doc.ref, client: doc.client, propertyId: doc.propertyId, amount: m, method: d.method, ref, rec: ref.replace('PAY', 'REC')});
    audit('Paiement ' + pay.ref, `${money(m)} sur ${doc.ref}`); closeModal(); render(); showCreated('rec', pay.rec); autoFileThen('receipt', pay, `Paiement enregistré, reçu ${pay.rec}`);
  }
  if (a === 'g2-expense') {
    const x = DB.addItem(DB.K.expenses, {ownerId: u.id, ref: nref('DEP', 'expenses'), propertyId: d.propertyId, supplier: d.supplier.trim(), cat: d.cat, amount: +d.amount, method: d.method, date: d.date || now().slice(0, 10)});
    audit('Dépense', `${x.ref} · ${money(x.amount)}`); toast('Dépense enregistrée.'); render();
  }
});

/* ==========================================================================
   MODULE : v3.js — contrats (expiration automatique), prestataires,
   exports CSV, téléchargement compatible page publiée (capacité downloads)
   ========================================================================== */
Object.assign(DB.K, {contracts:'deuksil_contracts', providers:'deuksil_providers'});
GTABS.splice(1, 0, ['contracts', 'Contrats']);
GTABS.splice(GTABS.findIndex(t => t[0] === 'tickets') + 1, 0, ['providers', 'Prestataires']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit|contracts|providers)$/;

const CTYPE = {location:'Contrat de location', mandat:'Mandat de gestion', vente:'Contrat de vente', prestation:'Contrat de prestation'};
const CTONE = {brouillon:'', actif:'ok', 'expiré':'bad', 'résilié':'bad', 'renouvelé':'info'};
const DLSTORE = {};
async function saveFile(name, content) {
  let dl = null; try { dl = window.claude && await window.claude.use('downloads'); } catch {}
  if (dl) { try { await dl.save({filename: name, data: content}); } catch (e) { if (!e || e.code !== 'declined') toast('Téléchargement indisponible ici.', 'bad'); } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content])); a.download = name; a.click();
}
function dlBtn(name, content, label = 'Télécharger') { const k = 'dl' + Object.keys(DLSTORE).length; DLSTORE[k] = {name, content}; return `<button class="btn" data-action="g3-save" data-id="${k}">${label}</button>`; }
const dlLink = (html, name) => pdfBtn(name);

function syncContracts(u) {
  const today = now().slice(0, 10);
  gMine('contracts', u).filter(c => c.status === 'actif' && c.end && c.end < today).forEach(c => { DB.updateItem(DB.K.contracts, c.id, {status: 'expiré'}); audit('Contrat expiré', c.ref); });
}
function contractHtml(c, u) {
  const p = gProp(c.propertyId), me = ownerLabel(u);
  return `<div style="font-family:sans-serif;color:#0F3057"><h2>${CTYPE[c.type].toUpperCase()}</h2><p><b>N° ${c.ref}</b> — ${c.status}</p>
    <p><b>Entre :</b> ${esc(me)} <b>et :</b> ${esc(c.party)}.</p>${p ? `<p><b>Bien concerné :</b> ${esc(p.title)}, ${esc(p.quartier)}, ${esc(p.city)}.</p>` : ''}
    <p><b>Durée :</b> du ${dateFr(c.start)} au ${dateFr(c.end)}.<br><b>Montant :</b> ${money(c.amount)}${c.deposit ? ` · <b>Caution :</b> ${money(c.deposit)}` : ''}${c.charges ? ` · <b>Charges :</b> ${money(c.charges)}` : ''}</p>
    <p><b>Conditions :</b> ${esc(c.conditions || 'Selon les dispositions légales en vigueur au Sénégal.')}</p>
    <p style="margin-top:40px">Signature des parties :</p><small>Modèle indicatif, à faire valider par un professionnel du droit.</small></div>`;
}
const EXP = {
  leases: u => [['Bien', 'Locataire', 'Tél', 'Loyer', 'Caution', 'Début', 'Mois', 'Statut'], gMine('leases', u).map(l => [(gProp(l.propertyId) || {}).title, l.tenant, l.phone, l.rent, l.deposit, l.start, l.months, l.status])],
  rents: u => [['Mois', 'Locataire', 'Montant', 'Payé le', 'État'], gMine('rents', u).map(r => [r.month, (DB.findItem(DB.K.leases, r.leaseId) || {}).tenant, r.amount, r.paidAt || '', rentState(r)[0]])],
  contracts: u => [['Réf.', 'Type', 'Partie', 'Début', 'Fin', 'Montant', 'Statut'], gMine('contracts', u).map(c => [c.ref, CTYPE[c.type], c.party, c.start, c.end, c.amount, c.status])],
  docs: u => [['Réf.', 'Type', 'Client', 'Total', 'Reste', 'État'], gMine('docs', u).map(d => [d.ref, DT[d.type], d.client, dTot(d), d.type === 'FAC' ? dRest(d) : '', dState(d)[0]])],
  fpay: u => [['Paiement', 'Reçu', 'Facture', 'Client', 'Mode', 'Montant', 'Date'], gMine('fpay', u).map(p => [p.ref, p.rec, p.docRef, p.client, p.method, p.amount, p.createdAt.slice(0, 10)])],
  expenses: u => [['Réf.', 'Bien', 'Fournisseur', 'Catégorie', 'Montant', 'Date'], gMine('expenses', u).map(x => [x.ref, (gProp(x.propertyId) || {}).title, x.supplier, x.cat, x.amount, x.date])],
  tickets: u => [['Bien', 'Problème', 'Coût', 'Statut'], gMine('tickets', u).map(t => [(gProp(t.propertyId) || {}).title, t.title, t.cost, t.status])]
};
/* bouton d'export CSV en tête des onglets de base et de finance qui en ont un
   (contrats, maintenance, unités… le posent eux-mêmes) */
const csvBtnHaut = tab => EXP[tab] ? `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn ghost sm" data-action="g3-csv" data-id="${tab}">Exporter en CSV</button></div>` : '';
retoucheGestion(['leases', 'rents', 'docs', 'fpay', 'expenses'], (h, u, tab) => csvBtnHaut(tab) + h);
vueGestion(['providers', 'contracts'], function (u, tab) {
  const csv = csvBtnHaut(tab);
  if (tab === 'providers') {
    const list = gMine('providers', u);
    return `<form class="card" data-action="g3-provider" style="margin-bottom:18px"><h4 style="margin-top:0">Nouveau prestataire</h4><div class="form-grid">
      <div class="field"><label>Nom / entreprise</label><input class="input" name="name" required></div><div class="field"><label>Métier</label><input class="input" name="job" placeholder="Plombier, électricien…" required></div>
      <div class="field"><label>Téléphone</label><input class="input" name="phone" required></div></div><button class="btn">Ajouter</button></form>` +
      gTable(['Nom', 'Métier', 'Téléphone', ''], list.slice().reverse().map(p => `<tr><td class="small"><b>${esc(p.name)}</b></td><td class="small">${esc(p.job)}</td><td><a href="${telHref(p.phone)}">${esc(p.phone)}</a></td><td><button class="btn ghost sm" data-action="g3-delprov" data-id="${p.id}" aria-label="Supprimer">${icon('trash', 14)}</button></td></tr>`), ['Aucun prestataire', 'Gardez ici vos plombiers, électriciens et artisans de confiance.']);
  }
  syncContracts(u);
  const list = gMine('contracts', u), props = myProps(u), soon = c => c.status === 'actif' && daysBetween(now(), c.end) <= 30;
  return csv + `<form class="card" data-action="g3-contract" style="margin-bottom:18px"><h4 style="margin-top:0">Nouveau contrat</h4><div class="form-grid">
    <div class="field"><label>Type</label><select class="input" name="type">${Object.entries(CTYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="field"><label>Locataire / acheteur / prestataire</label><input class="input" name="party" required></div>
    <div class="field"><label>Bien</label><select class="input" name="propertyId"><option value="">—</option>${gOpts(props)}</select></div>
    <div class="field"><label>Début</label><input class="input" type="date" name="start" value="${now().slice(0, 10)}" required></div>
    <div class="field"><label>Fin</label><input class="input" type="date" name="end" value="${addDays(now(), 365).slice(0, 10)}" required></div>
    <div class="field"><label>Montant (FCFA)</label><input class="input" type="number" min="0" name="amount" value="0"></div>
    <div class="field"><label>Caution</label><input class="input" type="number" min="0" name="deposit" value="0"></div>
    <div class="field"><label>Charges</label><input class="input" type="number" min="0" name="charges" value="0"></div></div>
    <div class="field"><label>Conditions particulières</label><textarea name="conditions"></textarea></div><button class="btn">Créer (brouillon)</button></form>` +
    gTable(['N°', 'Type', 'Partie', 'Période', 'Montant', 'Statut', ''], list.slice().reverse().map(c => `<tr><td class="small"><b>${c.ref}</b></td><td class="small">${CTYPE[c.type]}</td><td class="small">${esc(c.party)}</td>
      <td class="small muted">${dateFr(c.start)} → ${dateFr(c.end)}${soon(c) ? '<br>' + badge('Expire dans ' + daysBetween(now(), c.end) + ' j', 'warn') : ''}</td><td>${money(c.amount)}</td><td>${badge(c.status, CTONE[c.status])}</td>
      <td><div class="row" style="gap:6px"><button class="btn ghost sm" data-action="g3-cview" data-id="${c.id}">Voir</button>
      ${c.status === 'brouillon' ? `<button class="btn sm" data-action="g3-activate" data-id="${c.id}">Activer</button>` : ''}
      ${['actif', 'expiré'].includes(c.status) ? `<button class="btn sm" data-action="g3-renew" data-id="${c.id}">Renouveler</button>` : ''}
      ${c.status === 'actif' ? `<button class="btn ghost sm" data-action="g3-cancel" data-id="${c.id}">Résilier</button>` : ''}</div></td></tr>`), ['Aucun contrat', 'Créez un contrat de location, un mandat de gestion, de vente ou de prestation.']);
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action^="g3-"]'), u = Auth.current(); if (!el || el.tagName === 'FORM') return;
  const a = el.dataset.action, id = el.dataset.id;
  if (a === 'g3-save' && DLSTORE[id]) { saveFile(DLSTORE[id].name, DLSTORE[id].content); return; }
  if (!u) return;
  const mine = k => DB.findItem(DB.K[k], x => x.id === id && x.ownerId === u.id), c = mine('contracts');
  if (a === 'g3-csv' && EXP[id]) {
    if (u.member && ['docs', 'fpay', 'expenses', 'audit'].includes(id) && !u.perms.includes('finances')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
    const [h, rows] = EXP[id](u), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    saveFile(`deuksil-${id}.csv`, '\ufeff' + [h, ...rows].map(r => r.map(q).join(';')).join('\n')); audit('Export CSV', id);
  }
  if (a === 'g3-cview' && c) modal(c.ref, `<div class="card pad-s">${contractHtml(c, u)}</div><div style="margin-top:12px">${dlLink(contractHtml(c, u), c.ref)}</div>`);
  if (a === 'g3-activate' && c) { DB.updateItem(DB.K.contracts, id, {status: 'actif'}); audit('Contrat activé', c.ref); toast('Contrat activé.'); render(); }
  if (a === 'g3-cancel' && c) confirmDialog({title: 'Résilier le contrat', message: c.ref + ' sera marqué comme résilié.', confirmLabel: 'Résilier', danger: true, onConfirm: () => { DB.updateItem(DB.K.contracts, id, {status: 'résilié'}); audit('Contrat résilié', c.ref); render(); }});
  if (a === 'g3-renew' && c) {
    const n = DB.addItem(DB.K.contracts, {...c, id: undefined, createdAt: undefined, ref: nref('CTR', 'contracts'), start: c.end, end: addDays(c.end, 365).slice(0, 10), status: 'actif'});
    DB.updateItem(DB.K.contracts, id, {status: 'renouvelé'}); audit('Contrat renouvelé', `${c.ref} → ${n.ref}`); render(); autoFileThen('contract', n, 'Renouvelé : ' + n.ref);
  }
  if (a === 'g3-delprov' && mine('providers')) { DB.deleteItem(DB.K.providers, id); render(); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action^="g3-"]'), u = Auth.current(); if (!f || !u) return;
  e.preventDefault(); const a = f.dataset.action, d = formData(f);
  if (a === 'g3-provider') { DB.addItem(DB.K.providers, {ownerId: u.id, name: d.name.trim(), job: d.job.trim(), phone: d.phone.trim()}); toast('Prestataire ajouté.'); render(); }
  if (a === 'g3-contract') {
    if (d.propertyId && !myProps(u).some(p => p.id === d.propertyId)) { toast('Choisissez un de vos biens.', 'bad'); return; }
    if (d.end <= d.start) { toast('La date de fin doit suivre la date de début.', 'bad'); return; }
    const c = DB.addItem(DB.K.contracts, {ownerId: u.id, ref: nref('CTR', 'contracts'), type: d.type, party: d.party.trim(), propertyId: d.propertyId, start: d.start, end: d.end, amount: +d.amount || 0, deposit: +d.deposit || 0, charges: +d.charges || 0, conditions: d.conditions, status: 'brouillon'});
    audit('Contrat créé', c.ref); render(); showCreated('ctr', c.ref); autoFileThen('contract', c, c.ref + ' créé en brouillon');
  }
});

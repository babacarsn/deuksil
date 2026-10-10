/* ==========================================================================
   MODULE : coffre.js — coffre de documents rangé en tiroirs par catégorie,
   pour tous les espaces (propriétaire, agence, locataire, client, admin).
   Réunit les documents générés (factures, devis, reçus, quittances, contrats)
   et les documents déposés (identité, propriété, assurance…).
   ========================================================================== */
Object.assign(DB.K, {v7seed:'deuksil_v7seed'});
const VCAT = {
  factures:['Factures', 'file', 'Factures émises et factures fournisseurs'], devis:['Devis & proformas', 'layers', 'Offres envoyées aux clients'], avoirs:['Avoirs', 'repeat', 'Notes de crédit'],
  recus:['Reçus de paiement', 'money', 'Preuves d\'encaissement'], quittances:['Quittances de loyer', 'checkCircle', 'Loyers payés'], contrats:['Contrats', 'briefcase', 'Baux, mandats, ventes'],
  identite:['Pièces d\'identité', 'user', 'CNI, passeport'], propriete:['Titres & propriété', 'building', 'Titre foncier, bail, plan'], assurance:['Assurances', 'checkSquare', 'Attestations et polices'],
  technique:['Documents techniques', 'settings', 'Diagnostics, plans, devis travaux'], revenus:['Justificatifs de revenus', 'card', 'Bulletins, attestations'], autres:['Autres documents', 'file', 'Tout le reste']
};
const ALLC = ['factures', 'devis', 'avoirs', 'recus', 'quittances', 'contrats', 'identite', 'propriete', 'assurance', 'technique', 'autres'];
const DRAWERS = {owner:ALLC, agency:ALLC, admin:ALLC, tenant:['quittances', 'contrats', 'identite', 'assurance', 'autres'], client:['identite', 'revenus', 'autres']};
const UPCATS = {owner:['identite', 'propriete', 'assurance', 'technique', 'contrats', 'factures', 'autres'], tenant:['identite', 'assurance', 'autres'], client:['identite', 'revenus', 'autres']};
UPCATS.agency = UPCATS.owner;
const CAT_PERM = {factures:'finances', devis:'finances', avoirs:'finances', recus:'finances', quittances:'gestion', contrats:'gestion'};
const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const memberOk = (u, cat) => !u.member || u.perms.includes(CAT_PERM[cat] || 'documents');
const guessCat = n => /cni|identit|passeport/i.test(n) ? 'identite' : /titre|propri|foncier|bail|cadastre/i.test(n) ? 'propriete' : /assur/i.test(n) ? 'assurance' : 'autres';
const whoIs = id => { const x = DB.findItem(DB.K.users, id) || {}; return x.role === 'agency' ? x.agencyName : `${x.firstName || ''} ${x.lastName || ''}`.trim(); };
const dataUrlBlob = du => { const [h, b] = du.split(','), bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], {type: (h.match(/:(.*?);/) || [])[1] || 'application/octet-stream'}); };
const daysTo = s => Math.round((new Date(s) - new Date(now().slice(0, 10))) / 864e5);
document.head.insertAdjacentHTML('beforeend', '<style>.coffre{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:4px 0 26px}.drawer{display:flex;flex-direction:column;gap:7px;padding:18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);color:var(--ink);text-decoration:none;transition:border-color .16s,background .16s}.drawer:hover{border-color:var(--brand);background:var(--surface-2)}.drawer .dico{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:var(--tint-blue);color:var(--brand);margin-bottom:4px}.drawer:nth-child(4n+2) .dico{background:var(--tint-green);color:var(--ok)}.drawer:nth-child(4n+3) .dico{background:var(--tint-orange);color:#B4602A}.drawer:nth-child(4n+4) .dico{background:var(--gold-soft);color:#9A6B0C}.drawer b{font-size:1rem;font-weight:700;letter-spacing:-.015em}.drawer .small{line-height:1.45}.drawer .dn{position:absolute;top:16px;right:16px;min-width:26px;padding:2px 9px;border-radius:99px;background:var(--surface-3);color:var(--ink-2);font-size:.76rem;font-weight:700;text-align:center}.drawer{position:relative}.drawer.vide .dn{opacity:.6}.drawer > svg{display:none}.drawer .mob{display:none}@media (max-width:760px){.coffre{grid-template-columns:1fr;gap:10px}.drawer{flex-direction:row;align-items:center;gap:14px;padding:14px 16px;background:var(--surface-2);border-color:transparent}.drawer .dico{margin:0;flex:none}.drawer .txt{min-width:0;flex:1}.drawer .dn{display:none}.drawer .desk{display:none}.drawer .mob{display:block}.drawer > svg{display:block;color:var(--muted);flex:none}}</style>');

/* Rassemble les documents visibles par l'utilisateur */
function vaultItems(u) {
  const adm = u.role === 'admin', L = u.role === 'tenant' ? DB.findItem(DB.K.leases, u.leaseId) : null, oid = L ? L.ownerId : u.id, own = x => adm || x.ownerId === oid, out = [];
  const pt = id => (gProp(id) || {}).title || '', allowed = DRAWERS[u.role] || [];
  if (u.role !== 'client') {
    if (!L) {
      DB.getData(DB.K.docs).filter(own).forEach(d => out.push({cat: {FAC:'factures', DEV:'devis', PF:'devis', AV:'avoirs'}[d.type], name: d.ref, title: d.ref, sub: [DT[d.type], d.client, adm && whoIs(d.ownerId)].filter(Boolean).join(' · '), date: d.createdAt, info: `${money(dTot(d))} ${badge(...dState(d))}`}));
      DB.getData(DB.K.fpay).filter(own).forEach(p => out.push({cat: 'recus', name: p.rec, title: p.rec, sub: [p.client, p.docRef, adm && whoIs(p.ownerId)].filter(Boolean).join(' · '), date: p.createdAt, info: `${money(p.amount)} · ${esc(p.method)}`}));
    }
    DB.getData(DB.K.contracts).filter(c => own(c) && (!L || (c.type === 'location' && c.propertyId === L.propertyId && sameName(c.party, L.tenant)))).forEach(c => out.push({cat: 'contrats', name: c.ref, title: `${c.ref} · ${CTYPE[c.type]}`, sub: [c.party, pt(c.propertyId), adm && whoIs(c.ownerId)].filter(Boolean).join(' · '), date: c.createdAt, info: badge(c.status, CTONE[c.status])}));
    DB.getData(DB.K.rents).filter(r => r.paidAt && (L ? r.leaseId === L.id : own(r))).forEach(r => { const l = DB.findItem(DB.K.leases, r.leaseId) || {};
      out.push({cat: 'quittances', name: 'QUIT-' + r.id, title: 'Quittance de ' + monthLabel(r.month), sub: [l.tenant, pt(l.propertyId), adm && whoIs(r.ownerId)].filter(Boolean).join(' · '), date: r.paidAt, info: money(r.amount)}); });
  }
  DB.getData(DB.K.documents).filter(x => adm || x.ownerId === u.id).forEach(x => {
    const e = x.expiry ? daysTo(x.expiry) : null;
    out.push({kind: 'up', id: x.id, cat: VCAT[x.cat] ? x.cat : guessCat(x.name), title: x.name, sub: [pt(x.propertyId), adm && whoIs(x.ownerId)].filter(Boolean).join(' · '), date: x.createdAt, exp: e,
      info: e === null ? '<span class="muted small">Document déposé</span>' : e < 0 ? badge('Expiré', 'bad') : e <= 30 ? badge(`Expire dans ${e} j`, 'warn') : `<span class="small muted">Expire le ${dateFr(x.expiry)}</span>`});
  });
  return out.filter(i => allowed.includes(i.cat) && memberOk(u, i.cat)).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
}
function vTable(u, items, showCat) {
  const adm = u.role === 'admin', head = ['Document', ...(showCat ? ['Tiroir'] : []), 'Date', 'Détails', ''];
  return sBar('Rechercher un document, un client, un bien…') + gTable(head, items.slice(0, 300).map(i => {
    const acts = i.kind === 'up'
      ? `<button class="btn ghost sm" data-action="g7-view" data-id="${i.id}">Voir</button><button class="btn ghost sm" data-action="g7-dl" data-id="${i.id}">Télécharger</button>${adm ? '' : `<button class="btn ghost sm" data-action="g7-del" data-id="${i.id}" aria-label="Supprimer">${icon('trash', 14)}</button>`}`
      : `${!adm && u.role !== 'tenant' ? `<button class="btn ghost sm" data-action="g7-prev" data-id="${esc(i.name)}">Aperçu</button>` : ''}<button class="btn sm" data-action="g6-pdf" data-id="${esc(i.name)}">PDF</button>`;
    return `<tr><td class="small"><b>${esc(i.title)}</b><br><span class="muted">${esc(i.sub)}</span></td>${showCat ? `<td>${badge(VCAT[i.cat][0], 'info')}</td>` : ''}<td class="small muted">${dateFr(i.date)}</td><td class="small">${i.info}</td><td><div class="row" style="gap:6px;flex-wrap:wrap">${acts}</div></td></tr>`;
  }), ['Aucun document', 'Les documents que vous générez ou déposez seront rangés ici automatiquement.']);
}
const vaultGuard = () => { const u = Auth.current(); if (!u) { toast('Connectez-vous pour accéder à vos documents.', 'bad'); go('#/login'); return null; } return u; };
const canUpload = u => u.role !== 'admin' && (!u.member || u.perms.includes('documents'));
const addBtn = (u, cat) => canUpload(u) ? `<button class="btn" data-action="g7-add" data-id="${cat || ''}">${icon('plus', 16)} Ajouter un document</button>` : '';

route(/^\/coffre$/, () => {
  const u = vaultGuard(); if (!u) return false;
  const items = vaultItems(u), cats = (DRAWERS[u.role] || []).filter(c => memberOk(u, c)), soon = items.filter(i => i.exp !== undefined && i.exp !== null && i.exp <= 30).length;
  return shellApp(u, page('Mes documents', 'Tous vos documents, rangés par tiroir pour les retrouver en un instant.') +
    `<div class="row-between" style="margin-bottom:6px"><div class="kpis" style="flex:1">${kpi(items.length, 'Documents')}${kpi(cats.filter(c => items.some(i => i.cat === c)).length + ' / ' + cats.length, 'Tiroirs utilisés')}${kpi(soon, 'Expirent bientôt', soon ? 'bad' : 'ok')}</div></div>
    <div style="margin:14px 0">${addBtn(u)}</div>
    <div class="coffre">${cats.map(c => { const l = items.filter(i => i.cat === c), [t, ic, ds] = VCAT[c]; return `<a class="drawer ${l.length ? '' : 'vide'}" href="#/coffre/${c}"><div class="dico">${icon(ic, 20)}</div><div class="txt"><b>${t}</b><div class="small muted desk">${ds}</div><div class="small muted mob">${l.length} document${l.length > 1 ? 's' : ''}</div></div><span class="dn">${l.length}</span>${icon('arrowRight', 18)}</a>`; }).join('')}</div>
    <h3>Tous les documents</h3>` + vTable(u, items, true));
});
route(/^\/coffre\/(\w+)$/, cat => {
  const u = vaultGuard(); if (!u) return false;
  if (!(DRAWERS[u.role] || []).includes(cat) || !memberOk(u, cat)) { toast('Ce tiroir n\'est pas disponible pour votre profil.', 'bad'); go('#/coffre'); return false; }
  const items = vaultItems(u).filter(i => i.cat === cat), [t, ic, ds] = VCAT[cat];
  return shellApp(u, backBar('#/coffre', 'Tous les tiroirs', t) + page(t, ds + ' · ' + items.length + ' document' + (items.length > 1 ? 's' : '')) + `<div style="margin-bottom:14px">${(UPCATS[u.role] || []).includes(cat) ? addBtn(u, cat) : ''}</div>` + vTable(u, items, false));
});

/* Menus : une entrée « Documents » pour chaque espace */
['owner', 'agency', 'client', 'tenant', 'admin'].forEach(r => {
  const m = MENUS_RAW[r]; if (!m) return; const e = ['#/coffre', 'Documents', 'file'], i = m.findIndex(x => x[0] === '#/owner/documents');
  if (i >= 0) m[i] = e; else m.splice(Math.max(1, m.length - 1), 0, e);
});

/* Actions */
const vDoc = (u, id) => DB.findItem(DB.K.documents, x => x.id === id && (u.role === 'admin' || x.ownerId === u.id));
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action^="g7-"]'), u = Auth.current(); if (!el || !u) return;
  const a = el.dataset.action, id = el.dataset.id, doc = vDoc(u, id);
  const need = a === 'g7-prev' ? (/^(CTR|QUIT)-/.test(id) ? 'gestion' : 'finances') : ['g7-view', 'g7-dl'].includes(a) ? 'documents' : null;
  if (need && u.member && !u.perms.includes(need)) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
  if (a === 'g7-add' && canUpload(u)) {
    const cats = UPCATS[u.role] || [], props = ['owner', 'agency'].includes(u.role) ? myProps(u) : [];
    modal('Ajouter un document', `<form data-action="g7-upload"><div class="field"><label>Fichier (PDF ou image, 4 Mo max)</label><input class="input" type="file" name="file" accept=".pdf,image/*,.doc,.docx" required></div>
      <div class="field"><label>Nom du document (facultatif)</label><input class="input" name="name"></div>
      <div class="field"><label>Tiroir</label><select class="input" name="cat">${cats.map(c => `<option value="${c}" ${c === id ? 'selected' : ''}>${VCAT[c][0]}</option>`).join('')}</select></div>
      ${props.length ? `<div class="field"><label>Bien concerné (facultatif)</label><select class="input" name="propertyId"><option value="">—</option>${gOpts(props)}</select></div>` : ''}
      <div class="field"><label>Date d'expiration (facultatif)</label><input class="input" type="date" name="expiry"></div><button class="btn block">Ranger dans le tiroir</button></form>`);
  }
  if (a === 'g7-view' && doc) modal(doc.name, (doc.mime || '').startsWith('image/') ? `<img src="${doc.dataUrl}" alt="" style="max-width:100%;border-radius:8px">` : `<p class="small muted">Aperçu indisponible pour ce format : téléchargez le fichier pour l'ouvrir.</p>`);
  if (a === 'g7-dl' && doc) saveFile(doc.name, dataUrlBlob(doc.dataUrl));
  if (a === 'g7-del' && doc && u.role !== 'admin') {
    if (u.member && !u.perms.includes('documents')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
    confirmDialog({title: 'Supprimer le document', message: `« ${doc.name} » sera définitivement supprimé.`, confirmLabel: 'Supprimer', danger: true, onConfirm: () => { DB.deleteItem(DB.K.documents, id); toast('Document supprimé.'); render(); }});
  }
  if (a === 'g7-prev' && u.role !== 'admin') { const m = id.match(/^QUIT-(.+)$/); showCreated(m ? 'quit' : /^REC-/.test(id) ? 'rec' : /^CTR-/.test(id) ? 'ctr' : 'doc', m ? m[1] : id); }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-action="g7-upload"]'), u = Auth.current(); if (!f || !u || !canUpload(u)) return;
  e.preventDefault(); const file = f.querySelector('[type=file]').files[0], d = formData(f); if (!file) return;
  if (!(UPCATS[u.role] || []).includes(d.cat)) { toast('Tiroir invalide.', 'bad'); return; }
  if (d.propertyId && !myProps(u).some(p => p.id === d.propertyId)) { toast('Choisissez un de vos biens.', 'bad'); return; }
  try { let dataUrl = await readFileAsDataUrl(file), mime = file.type, name = (d.name || '').trim() || file.name;
    if ((mime || '').startsWith('image/')) { try { const pdf = await imageToPdf(dataUrl, name.replace(/\.[^.]+$/, '')); dataUrl = await b64(pdf); mime = 'application/pdf'; name = name.replace(/\.[^.]+$/, '') + '.pdf'; } catch {} }
    DB.addItem(DB.K.documents, {ownerId: u.id, name, mime, dataUrl, cat: d.cat, propertyId: d.propertyId || '', expiry: d.expiry || ''});
    if (!DB.lastWriteOk) return; closeModal(); toast('Document rangé dans « ' + VCAT[d.cat][0] + ' ».'); render(); }
  catch { toast('Fichier trop volumineux (4 Mo max) ou illisible.', 'bad'); }
});

/* Démo : un contrat, un devis et une facture pour que les tiroirs ne soient pas vides */
function seedV7() {
  if (localStorage.getItem(DB.K.v7seed)) return;
  const owner = DB.findItem(DB.K.users, x => x.cni === '1900000000003'), ten = DB.findItem(DB.K.users, x => x.cni === '1900000000013'), l = ten && DB.findItem(DB.K.leases, ten.leaseId); if (!owner || !l) return;
  localStorage.setItem(DB.K.v7seed, '1');
  DB.addItem(DB.K.contracts, {ownerId: owner.id, ref: nref('CTR', 'contracts'), type: 'location', party: l.tenant, propertyId: l.propertyId, start: l.start, end: addDays(l.start, 365).slice(0, 10), amount: l.rent, deposit: l.deposit, charges: 0, conditions: '', status: 'actif'});
  const items = [{label: 'Frais de dossier', qty: 1, price: 50000}];
  DB.addItem(DB.K.docs, {ownerId: owner.id, type: 'DEV', ref: nref('DEV', 'docs'), client: l.tenant, propertyId: l.propertyId, items, discount: 0, tax: 0, status: 'accepté', due: addDays(now(), 30).slice(0, 10)});
  DB.addItem(DB.K.docs, {ownerId: owner.id, type: 'FAC', ref: nref('FAC', 'docs'), client: l.tenant, propertyId: l.propertyId, items, discount: 0, tax: 0, status: 'émise', due: addDays(now(), 30).slice(0, 10)});
}
etapeAmorcage('coffre de documents', seedV7);

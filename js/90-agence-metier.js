/* ==========================================================================
   MODULE : agence-metier.js — ce dont une agence a vraiment besoin.
   Tout s'appuie sur les écrans existants (aucun écran en double) :
     A. Règles de l'agence (Paramètres) : frais de location, honoraires de
        vente, TVA, qui garde la caution, part des agents, pénalités, révision.
     B. Mandat de vente : même formulaire que le mandat de gestion, avec un
        choix « Gestion / Vente ».
     C. Honoraires réels (location et vente) créés automatiquement à la
        signature, encaissables, avec TVA et part de l'agent. La page
        « Commissions » devient « Honoraires & cautions ».
     D. Caution : chez qui elle est, restitution au départ avec retenues.
     E. Suivi du bail (un seul bouton par bail) : état des lieux, préavis,
        révision du loyer, caution, frais d'agence.
     F. Pénalité de retard sur un loyer (si la règle est active).
     G. Équipe unique : les anciens « agents » deviennent des membres de
        l'équipe (avec connexion) ; attribution des biens, chiffres et
        commission de chaque agent.
     H. Clients : demandes (budget, lieu, type) et biens qui correspondent.
     I. Menu de l'agence complété.
   ========================================================================== */
Object.assign(DB.K, {fees: 'deuksil_fees', edl: 'deuksil_edl', demandes: 'deuksil_demandes', mventes: 'deuksil_mventes', agentsV2: 'deuksil_agents_v2'});

/* --- A. Règles de l'agence --------------------------------------------- */
const REGLES_DEFAUT = {honoLocMois: 1, honoVentePct: 3, payeurVente: 'vendeur', tva: true, tvaPct: 18,
  caution: 'agence', agentPct: 20, penalitePct: 0, penaliteJours: 5, revisionPct: 0,
  partRentree: 50, validationAgents: true};
const regles = u => Object.assign({}, REGLES_DEFAUT, (u && u.regles) || {});
const agenceDe = u => u && (u.role === 'agency' ? u : null);
const arrondi = n => Math.round(+n || 0);
const montantTTC = (u, ht) => { const r = regles(u); const tva = r.tva ? arrondi(ht * r.tvaPct / 100) : 0; return {ht: arrondi(ht), tva, ttc: arrondi(ht) + tva}; };
const refuse = (msg) => { toast(msg, 'bad'); return false; };
const droit = (u, d) => !u.member || (u.perms || []).includes(d);

function cartesRegles(u) {
  const r = regles(u);
  return `<form class="card" data-action="ag-regles" id="regles-agence" data-sub="Honoraires, caution, pénalités">
    <h4>Règles de l'agence</h4>
    <p class="small muted" style="margin:0 0 12px">Elles s'appliquent automatiquement aux nouveaux baux, ventes et loyers.</p>
    <div class="form-grid">
      <div class="field"><label>Frais de location (en mois de loyer)</label><input class="input" type="number" name="honoLocMois" min="0" max="3" step="0.5" value="${r.honoLocMois}"></div>
      <div class="field"><label>Honoraires de vente (% du prix)</label><input class="input" type="number" name="honoVentePct" min="0" max="15" step="0.5" value="${r.honoVentePct}"></div>
      <div class="field"><label>Honoraires de vente payés par</label><select class="input" name="payeurVente"><option value="vendeur" ${r.payeurVente === 'vendeur' ? 'selected' : ''}>Le vendeur</option><option value="acquereur" ${r.payeurVente === 'acquereur' ? 'selected' : ''}>L'acquéreur</option></select></div>
      <div class="field"><label>TVA sur les honoraires (%)</label><input class="input" type="number" name="tvaPct" min="0" max="30" step="1" value="${r.tvaPct}"></div>
      <div class="field"><label>La caution est gardée par</label><select class="input" name="caution"><option value="agence" ${r.caution === 'agence' ? 'selected' : ''}>L'agence</option><option value="proprietaire" ${r.caution === 'proprietaire' ? 'selected' : ''}>Le propriétaire</option></select></div>
      <div class="field"><label>Part de l'agent sur les honoraires (%)</label><input class="input" type="number" name="agentPct" min="0" max="100" step="1" value="${r.agentPct}"></div>
      <div class="field"><label>Dont part de l'agent qui a rentré le bien (%)</label><input class="input" type="number" name="partRentree" min="0" max="100" step="5" value="${r.partRentree}"></div>
      <div class="field"><label>Pénalité de retard (% du loyer, 0 = aucune)</label><input class="input" type="number" name="penalitePct" min="0" max="20" step="0.5" value="${r.penalitePct}"></div>
      <div class="field"><label>Pénalité après (jours de retard)</label><input class="input" type="number" name="penaliteJours" min="0" max="60" step="1" value="${r.penaliteJours}"></div>
      <div class="field"><label>Révision annuelle proposée (%)</label><input class="input" type="number" name="revisionPct" min="0" max="20" step="0.5" value="${r.revisionPct}"></div>
    </div>
    <label class="check" style="margin:4px 0 14px"><input type="checkbox" name="tva" ${r.tva ? 'checked' : ''}> Appliquer la TVA sur les honoraires et la commission de gestion</label><br>
    <label class="check" style="margin:0 0 14px"><input type="checkbox" name="validationAgents" ${r.validationAgents ? 'checked' : ''}> Les biens publiés par un agent sont validés par le responsable avant la mise en ligne</label><br>
    <p class="small muted" style="margin:0 0 14px">Quand un agent rentre le bien et qu'un autre le loue ou le vend, la commission est partagée entre eux selon la part ci-dessus ; s'il s'agit du même agent, il touche tout.</p>
    <button class="btn">Enregistrer les règles</button></form>`;
}
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/settings$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => { const h = f(...a); if (h === false) return h; const u = Auth.current();
    return h.replace('<div class="stack" style="gap:18px">', '<div class="stack" style="gap:18px">' + cartesRegles(u)); };
})();
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-regles"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency' || u.member) return refuse('Réservé au responsable de l\'agence.');
  const d = formData(f), n = (k, min, max) => Math.min(max, Math.max(min, +d[k] || 0));
  const regle = {honoLocMois: n('honoLocMois', 0, 3), honoVentePct: n('honoVentePct', 0, 15), payeurVente: d.payeurVente === 'acquereur' ? 'acquereur' : 'vendeur',
    tva: !!d.tva, tvaPct: n('tvaPct', 0, 30), caution: d.caution === 'proprietaire' ? 'proprietaire' : 'agence', agentPct: n('agentPct', 0, 100),
    penalitePct: n('penalitePct', 0, 20), penaliteJours: n('penaliteJours', 0, 60), revisionPct: n('revisionPct', 0, 20),
    partRentree: n('partRentree', 0, 100), validationAgents: !!d.validationAgents};
  DB.updateItem(DB.K.users, u.id, {regles: regle}); audit('Règles de l\'agence', 'mises à jour'); toast('Règles enregistrées.'); render();
}, true);

/* --- C. Honoraires --------------------------------------------------------- */
const feesDe = u => gMine('fees', u);
function creerHonoraire(u, o) {
  /* o : {kind, leaseId|dealId, propertyId, base, payer, payerName} — un seul par bail ou par vente */
  if (feesDe(u).some(f => (o.leaseId && f.leaseId === o.leaseId) || (o.dealId && f.dealId === o.dealId))) return null;
  const p = gProp(o.propertyId) || {}, r = regles(u), m = montantTTC(u, o.base);
  if (!m.ht) return null;
  /* Commission : l'agent qui conclut (visite, offre) et celui qui a rentré le
     bien se partagent la part agent ; un seul agent → il touche tout. */
  const membre = id => id && DB.findItem(DB.K.users, x => x.id === id && x.parentId === u.id) ? id : '';
  const apporteur = membre(p.apporteurId) || membre(p.agentId), closer = membre(o.closerId) || membre(p.agentId) || apporteur;
  const total = closer ? arrondi(m.ht * r.agentPct / 100) : 0;
  let agentId = closer, agentPart = total, apporteurId = '', apporteurPart = 0;
  if (apporteur && apporteur !== closer && total) { apporteurId = apporteur; apporteurPart = arrondi(total * r.partRentree / 100); agentPart = total - apporteurPart; }
  const fee = DB.addItem(DB.K.fees, {ownerId: u.id, ref: nref('HON', 'fees'), kind: o.kind, leaseId: o.leaseId || '', dealId: o.dealId || '',
    propertyId: o.propertyId, payer: o.payer, payerName: o.payerName || '', ...m, agentId, agentPart, apporteurId, apporteurPart, status: 'du', createdAt: now()});
  audit('Honoraires', `${fee.ref} · ${money(fee.ttc)} · ${o.kind}`);
  return fee;
}
function honoraireBail(u, l) {
  if (!agenceDe(u) || !l) return null;
  return creerHonoraire(u, {kind: 'location', leaseId: l.id, propertyId: l.propertyId, base: (+l.rent || 0) * regles(u).honoLocMois, payer: 'locataire', payerName: l.tenant, closerId: agentQuiAFaitVisiter(l)});
}
/* L'agent qui a fait visiter le bien au futur locataire (sinon le dernier
   agent à avoir fait un compte rendu de visite sur ce bien). */
function agentQuiAFaitVisiter(l) {
  const chiffres = x => String(x || '').replace(/\D/g, '').slice(-9), nom = x => String(x || '').trim().toLowerCase();
  const vis = DB.filterItems(DB.K.visits, v => v.propertyId === l.propertyId && v.cr && (v.agentId || v.cr.by)).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
  const duLocataire = vis.find(v => { const c = DB.findItem(DB.K.users, v.clientId) || {};
    return (l.tenantId && v.clientId === l.tenantId) || (chiffres(l.phone) && [c.phone, v.clientPhone].some(t => chiffres(t) === chiffres(l.phone))) || (nom(l.tenant) && [displayName(c), v.clientName].some(n => nom(n) === nom(l.tenant))); });
  const v = duLocataire || vis[0];
  return v ? (v.agentId || v.cr.by) : '';
}
/* Part d'un agent sur un honoraire (sortie + rentrée). */
const partDe = (f, id) => (f.agentId === id ? +f.agentPart || 0 : 0) + (f.apporteurId === id ? +f.apporteurPart || 0 : 0);
const partsAgents = f => (+f.agentPart || 0) + (+f.apporteurPart || 0);
const concerne = (f, id) => f.agentId === id || f.apporteurId === id;
function honoraireVente(u, d) {
  if (!agenceDe(u) || !d) return null;
  const mv = DB.findItem(DB.K.mventes, m => m.ownerId === u.id && m.propertyId === d.propertyId && m.status === 'actif');
  const pct = mv ? +mv.rate : regles(u).honoVentePct, payeur = mv ? mv.payer : regles(u).payeurVente;
  return creerHonoraire(u, {kind: 'vente', dealId: d.id, propertyId: d.propertyId, base: prixVente(d) * pct / 100,
    payer: payeur, payerName: payeur === 'acquereur' ? d.buyer : ((DB.findItem(DB.K.owners, mv && mv.ownerId2) || {}).name || 'Vendeur'), closerId: d.agentId || ''});
}
/* Nouveau bail signé dans l'application par une agence → frais de location,
   et la caution est notée chez qui la règle l'indique. Les baux déjà
   enregistrés ne reçoivent rien d'office : on peut leur facturer les frais
   depuis « Suivi du bail ». */
let agBailSaisi = false;
window.addEventListener('submit', e => {
  if (e.target.closest && e.target.closest('form[data-action="g-lease"]')) { agBailSaisi = true; setTimeout(() => { agBailSaisi = false; }, 0); }
}, true);
const _addItemAg = DB.addItem.bind(DB);
DB.addItem = function (k, item) {
  const x = _addItemAg(k, item);
  try {
    if (agBailSaisi && k === DB.K.leases && x && x.ownerId) {
      const owner = DB.findItem(DB.K.users, x.ownerId);
      if (owner && owner.role === 'agency') {
        DB.updateItem(DB.K.leases, x.id, {cautionChez: regles(owner).caution, cautionStatut: (+x.deposit > 0) ? 'detenue' : ''});
        honoraireBail(owner, DB.findItem(DB.K.leases, x.id));
      }
    }
  } catch (e) { console.warn('honoraires', e); }
  return x;
};
/* Où est la caution d'un bail (valeurs par défaut pour les baux anciens). */
function cautionDe(u, l) {
  const chez = l.cautionChez || (u.role === 'agency' ? regles(u).caution : 'bailleur');
  const statut = l.cautionStatut || (+l.deposit > 0 ? 'detenue' : '');
  return {chez, statut};
}
/* Vente signée → honoraires de vente. */
const _franchirAg = franchirEtape;
franchirEtape = function (d, etape) {
  const r = _franchirAg(d, etape);
  try { if (etape === 'signe') { const u = Auth.current(); const f = d && DB.findItem(DB.K.deals, d.id); if (u && f && f.stage === 'signe') { honoraireVente(u.member ? DB.findItem(DB.K.users, u.id) || u : u, f);
      DB.filterItems(DB.K.mventes, m => m.propertyId === f.propertyId && m.status === 'actif').forEach(m => DB.updateItem(DB.K.mventes, m.id, {status: 'vendu', soldAt: ymd()})); } } } catch (e) { console.warn('honoraires vente', e); }
  return r;
};

/* --- B. Mandat de vente dans le même formulaire ------------------------- */
retoucheGestion(['mandates'], (h, u) => {
  if (u.role !== 'agency') return h;
  const owners = gMine('owners', u), props = myProps(u).filter(p => !['vendu', 'loue', 'archive'].includes(p.status)
    && !DB.findItem(DB.K.mventes, m => m.ownerId === u.id && m.propertyId === p.id && m.status === 'actif' && m.end >= ymd()));
  const choix = `<div class="field mtype"><label>Type de mandat</label><div class="seg" role="radiogroup">
      <button type="button" class="seg-b on" data-action="ag-mtype" data-v="gestion">${icon('key', 16)} Gestion</button>
      <button type="button" class="seg-b" data-action="ag-mtype" data-v="vente">${icon('tag', 16)} Vente</button></div></div>`;
  const formVente = `<form class="card" data-action="ag-mv-new" style="margin-bottom:18px;display:none" id="form-mv" data-sub="Le bien, son prix et vos honoraires"><h4 style="margin-top:0">Nouveau mandat de vente</h4>
    ${choix.replace('seg-b on" data-action="ag-mtype" data-v="gestion"', 'seg-b" data-action="ag-mtype" data-v="gestion"').replace('seg-b" data-action="ag-mtype" data-v="vente"', 'seg-b on" data-action="ag-mtype" data-v="vente"')}
    <div class="form-grid">
      <div class="field"><label>Propriétaire (vendeur)</label><select class="input" name="ownerId2" required>${owners.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('') || '<option value="">Ajoutez d\'abord un propriétaire</option>'}</select></div>
      <div class="field"><label>Bien à vendre</label><select class="input" name="propertyId" required>${props.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('') || '<option value="">Aucun bien libre à vendre</option>'}</select></div>
      <div class="field"><label>Prix de vente demandé (FCFA)</label><input class="input" type="number" name="price" min="1" required></div>
      <div class="field"><label>Honoraires (% du prix)</label><input class="input" type="number" name="rate" min="0" max="15" step="0.5" value="${regles(u).honoVentePct}" required></div>
      <div class="field"><label>Honoraires payés par</label><select class="input" name="payer"><option value="vendeur" ${regles(u).payeurVente === 'vendeur' ? 'selected' : ''}>Le vendeur</option><option value="acquereur" ${regles(u).payeurVente === 'acquereur' ? 'selected' : ''}>L'acquéreur</option></select></div>
      <div class="field"><label>Exclusivité</label><select class="input" name="exclusif"><option value="1">Mandat exclusif</option><option value="">Mandat simple</option></select></div>
      <div class="field"><label>Début</label><input class="input" type="date" name="start" value="${ymd()}" required></div>
      <div class="field"><label>Fin</label><input class="input" type="date" name="end" value="${addDays(now(), 180).slice(0, 10)}" required></div>
    </div><button class="btn">Créer le mandat de vente</button></form>`;
  const mv = DB.filterItems(DB.K.mventes, m => m.ownerId === u.id).slice().reverse();
  const listeV = mv.length ? `<h3 style="margin:22px 0 10px">Mandats de vente</h3>` + gTable(['N°', 'Vendeur', 'Bien', 'Prix', 'Honoraires', 'Période', 'Statut', ''], mv.map(m => {
    const o = DB.findItem(DB.K.owners, m.ownerId2) || {}, p = gProp(m.propertyId) || {};
    const st = m.status === 'actif' && m.end < ymd() ? 'expiré' : m.status;
    return `<tr><td class="small"><b>${m.ref}</b>${m.exclusif ? '<br>' + badge('Exclusif', 'info') : ''}</td><td class="small">${esc(o.name || '—')}</td><td class="small">${esc(p.title || '—')}</td>
      <td>${money(m.price)}</td><td>${m.rate} % · ${m.payer === 'acquereur' ? 'acquéreur' : 'vendeur'}</td><td class="small muted">${dateFr(m.start)} → ${dateFr(m.end)}</td>
      <td>${badge(st, st === 'actif' ? 'ok' : st === 'vendu' ? 'info' : '')}</td>
      <td>${m.status === 'actif' ? `<button class="btn ghost sm" data-action="ag-mv-end" data-id="${m.id}">Résilier</button>` : ''}</td></tr>`; }), ['', '']) : '';
  /* Le formulaire de gestion reçoit le même sélecteur de type. */
  h = h.replace(/(<form class="card" data-action="m-new")([^>]*>\s*<h4[^>]*>Nouveau mandat de gestion<\/h4>)/, `$1 data-sub="Les biens que vous gérez et votre commission"$2${choix}`);
  /* Colonne « Type » implicite : la liste existante reste celle des mandats de gestion. */
  h = h.replace(/(<form class="card" data-action="m-new")/, formVente + '$1');
  return h + listeV;
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-mtype"]'); if (!b) return;
  e.preventDefault();
  const vente = b.dataset.v === 'vente', fg = document.querySelector('form[data-action="m-new"]'), fv = document.getElementById('form-mv');
  if (fg) fg.style.display = vente ? 'none' : ''; if (fv) fv.style.display = vente ? '' : 'none';
  (vente ? fv : fg).querySelector('select, input').focus();
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-mv-new"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency') return;
  if (!droit(u, 'gestion')) return refuse('Action non autorisée pour votre profil.');
  const d = formData(f), o = DB.findItem(DB.K.owners, x => x.id === d.ownerId2 && x.ownerId === u.id), p = gProp(d.propertyId);
  if (!o) return refuse('Choisissez un de vos propriétaires.');
  if (!p || p.ownerId !== u.id) return refuse('Choisissez un de vos biens.');
  if (!(+d.price > 0)) return refuse('Indiquez le prix de vente.');
  if (!d.start || !d.end || d.end <= d.start) return refuse('La date de fin doit suivre la date de début.');
  if (p.status === 'loue') return refuse(`${p.title} est loué : il ne peut pas être mis en vente tant que le bail court.`);
  const dejaV = DB.findItem(DB.K.mventes, m => m.ownerId === u.id && m.propertyId === p.id && m.status === 'actif' && m.end >= ymd());
  if (dejaV) return refuse(`${p.title} a déjà un mandat de vente actif (${dejaV.ref}).`);
  const m = DB.addItem(DB.K.mventes, {ownerId: u.id, ownerId2: o.id, ref: nref('MDV', 'mventes'), propertyId: p.id, price: +d.price, rate: Math.min(15, Math.max(0, +d.rate || 0)),
    payer: d.payer === 'acquereur' ? 'acquereur' : 'vendeur', exclusif: !!d.exclusif, start: d.start, end: d.end, status: 'actif'});
  DB.updateItem(DB.K.properties, p.id, {clientOwnerId: o.id, transaction: 'vente', price: +d.price});
  audit('Mandat de vente', `${m.ref} · ${p.title}`); toast(`Mandat de vente ${m.ref} créé : le bien est à vendre à ${money(m.price)}.`); render();
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-mv-end"]'); if (!b) return;
  const u = Auth.current(); if (!u) return;
  const m = DB.findItem(DB.K.mventes, x => x.id === b.dataset.id && x.ownerId === u.id); if (!m) return;
  confirmDialog({title: 'Résilier le mandat de vente', message: `${m.ref} prendra fin aujourd'hui.`, confirmLabel: 'Résilier', danger: true,
    onConfirm: () => { DB.updateItem(DB.K.mventes, m.id, {status: 'résilié', endedAt: ymd()}); audit('Mandat de vente résilié', m.ref); render(); }});
});

/* --- C (suite). Page « Honoraires & cautions » (ancienne « Commissions ») -- */
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/commissions$'); if (!r) return;
  const ancienne = r.fn;
  r.fn = () => {
    const u = Auth.guard('agency'); if (!u) return false;
    /* Page du responsable : honoraires, cautions et commissions de l'agence. */
    if (u.member) { toast('Accès non autorisé pour votre profil.', 'bad'); go(Auth.home(u)); return false; }
    const fees = feesDe(u).slice().reverse(), R = regles(u);
    const du = fees.filter(f => f.status === 'du'), paye = fees.filter(f => f.status === 'paye');
    const baux = gMine('leases', u), cautions = baux.filter(l => { const c = cautionDe(u, l); return c.chez === 'agence' && c.statut === 'detenue' && +l.deposit > 0; });
    const owners = gMine('owners', u), com12 = monthsBack(12).reduce((s, m) => s + owners.reduce((a, o) => a + ownerBalance(u, o, m).com, 0), 0);
    const tvaCom = R.tva ? arrondi(com12 - com12 / (1 + R.tvaPct / 100)) : 0;
    const nomP = id => (gProp(id) || {}).title || '—';
    const agentNom = id => { const a = DB.findItem(DB.K.users, id); return a ? `${a.firstName} ${a.lastName}` : ''; };
    const lignes = fees.map(f => `<tr><td class="small"><b>${f.ref}</b><br><span class="muted">${f.kind === 'vente' ? 'Vente' : 'Location'}</span></td>
      <td class="small">${esc(nomP(f.propertyId))}<br><span class="muted">${esc(f.payerName || f.payer)}</span></td>
      <td><b>${money(f.ttc)}</b>${f.tva ? `<br><span class="small muted">dont TVA ${money(f.tva)}</span>` : ''}</td>
      <td class="small">${f.agentId ? `${esc(agentNom(f.agentId))} <span class="muted">${money(f.agentPart)}</span>${f.apporteurId ? `<br>${esc(agentNom(f.apporteurId))} <span class="muted">${money(f.apporteurPart)} (rentrée)</span>` : ''}${f.agentPaidAt ? '<br><span class="muted">versée</span>' : ''}` : '—'}</td>
      <td>${f.status === 'paye' ? badge('Encaissé', 'ok') : badge('À encaisser', 'warn')}</td>
      <td>${f.status === 'du' ? `<button class="btn sm" data-action="ag-fee-pay" data-id="${f.id}">Encaisser</button>` : (f.agentId && !f.agentPaidAt ? `<button class="btn ghost sm" data-action="ag-agent-pay" data-id="${f.id}">Payer l'agent</button>` : '')}</td></tr>`);
    const lignesC = cautions.map(l => `<tr><td class="small"><b>${esc(l.tenant)}</b></td><td class="small">${esc(nomP(l.propertyId))}</td><td><b>${money(l.deposit)}</b></td>
      <td>${l.status === 'actif' ? badge('Bail en cours', 'info') : badge('À restituer', 'warn')}</td><td><button class="btn ghost sm" data-action="ag-suivi" data-id="${l.id}">Suivi du bail</button></td></tr>`);
    return shellApp(u, page('Honoraires & cautions', 'Ce que l\'agence facture, encaisse et garde pour le compte de ses clients.') + `
      <div class="kpis">${kpi(money(du.reduce((s, f) => s + f.ttc, 0)), 'Honoraires à encaisser', 'warn')}${kpi(money(paye.reduce((s, f) => s + f.ttc, 0)), 'Honoraires encaissés', 'ok')}
        ${kpi(money(com12), 'Commission de gestion (12 mois)', 'brand')}${kpi(money(cautions.reduce((s, l) => s + (+l.deposit || 0), 0)), 'Cautions détenues', 'brand')}</div>
      <p class="small muted" style="margin:12px 0 18px">Frais de location : ${R.honoLocMois} mois de loyer, facturés au locataire à la signature du bail. Honoraires de vente : ${R.honoVentePct} % du prix (ou le taux du mandat de vente), payés par ${R.payeurVente === 'acquereur' ? 'l\'acquéreur' : 'le vendeur'}.
        ${R.tva ? `TVA ${R.tvaPct} % incluse ; sur la commission de gestion, elle représente ${money(tvaCom)} sur 12 mois.` : 'TVA non appliquée.'} <a href="#/agency/settings">Modifier les règles</a></p>
      <h3 style="margin:0 0 10px">Honoraires</h3>` +
      gTable(['N°', 'Bien · payé par', 'Montant TTC', 'Agent', 'État', ''], lignes, ['Aucun honoraire', 'Les frais de location et honoraires de vente se créent seuls à la signature d\'un bail ou d\'une vente.']) +
      `<h3 style="margin:22px 0 10px">Cautions détenues par l'agence</h3>` +
      gTable(['Locataire', 'Bien', 'Caution', 'Situation', ''], lignesC, ['Aucune caution détenue', 'Les cautions encaissées par l\'agence apparaissent ici jusqu\'à leur restitution.']));
  };
})();
function modalEncaisser(titre, action, id, montant) {
  modal(titre, `<form data-action="${action}" data-id="${id}"><p class="small">Montant : <b>${money(montant)}</b></p><div class="form-grid">
    <div class="field"><label>Mode de paiement</label><select class="input" name="method"><option>Espèces</option><option>Wave</option><option>Orange Money</option><option>Virement</option><option>Chèque</option></select></div>
    <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${ymd()}" max="${ymd()}" required></div>
    <div class="field"><label>Référence (facultatif)</label><input class="input" name="ref" placeholder="N° de transaction"></div></div>
    <div class="row" style="gap:10px;margin-top:6px"><button class="btn">Valider</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-fee-pay"],[data-action="ag-agent-pay"]'); if (!b) return;
  const u = Auth.current(); if (!u) return;
  if (!droit(u, 'finances')) return refuse('Action non autorisée pour votre profil.');
  const f = DB.findItem(DB.K.fees, x => x.id === b.dataset.id && x.ownerId === u.id); if (!f) return;
  if (b.dataset.action === 'ag-fee-pay') modalEncaisser(`Encaisser ${f.ref}`, 'ag-fee-pay-ok', f.id, f.ttc);
  else modalEncaisser(f.apporteurId ? 'Verser la commission aux deux agents' : 'Verser sa commission à l\'agent', 'ag-agent-pay-ok', f.id, partsAgents(f));
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-fee-pay-ok"],form[data-action="ag-agent-pay-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || !droit(u, 'finances')) return;
  const fee = DB.findItem(DB.K.fees, x => x.id === f.dataset.id && x.ownerId === u.id); if (!fee) return;
  const d = formData(f); if (!d.date || d.date > ymd()) return refuse('La date ne peut pas être dans le futur.');
  if (f.dataset.action === 'ag-fee-pay-ok') {
    if (fee.status === 'paye') return refuse('Déjà encaissé.');
    DB.updateItem(DB.K.fees, fee.id, {status: 'paye', paidAt: d.date, method: d.method, payRef: d.ref || ''});
    audit('Honoraires encaissés', `${fee.ref} · ${money(fee.ttc)}`); toast(`${fee.ref} encaissé.`);
  } else {
    if (fee.status !== 'paye') return refuse('Encaissez d\'abord les honoraires avant de payer l\'agent.');
    DB.updateItem(DB.K.fees, fee.id, {agentPaidAt: d.date, agentMethod: d.method});
    audit('Commission agent versée', `${fee.ref} · ${money(partsAgents(fee))}`); toast(fee.apporteurId ? 'Commission des deux agents enregistrée.' : 'Commission de l\'agent enregistrée.');
    [[fee.agentId, fee.agentPart], [fee.apporteurId, fee.apporteurPart]].forEach(([id, m]) => { if (id && m) notify(id, `Commission de ${money(m)} versée (${fee.ref}).`, '#/agent/commissions'); });
  }
  closeModal(); render();
}, true);

/* --- D/E. Suivi du bail : un bouton, toutes les actions ------------------- */
retoucheGestion(['leases'], h => h.replace(/<button class="btn ghost sm" data-action="g-end-lease" data-id="([\w]+)">/g,
  (m, id) => `<button class="btn ghost sm" data-action="ag-suivi" data-id="${id}">Suivi du bail</button>` + m));
const PIECES = ['Entrée / séjour', 'Chambre(s)', 'Cuisine', 'Salle d\'eau / WC', 'Extérieur / balcon'];
const ETATS = [['bon', 'Bon état'], ['moyen', 'Usure normale'], ['mauvais', 'Dégradé']];
const edlDe = l => DB.filterItems(DB.K.edl, x => x.leaseId === l.id);
function suiviBail(u, l) {
  const R = regles(u.role === 'agency' ? u : {}), edl = edlDe(l), entree = edl.find(x => x.kind === 'entree'), sortie = edl.find(x => x.kind === 'sortie');
  const fee = feesDe(u).find(f => f.leaseId === l.id);
  const ligne = (ic, titre, txt, bouton) => `<div class="suivi-l"><span class="suivi-ic">${icon(ic, 19)}</span><div class="suivi-t"><b>${titre}</b><span>${txt}</span></div>${bouton || ''}</div>`;
  const C = cautionDe(u, l), chez = C.chez === 'proprietaire' ? 'le propriétaire' : C.chez === 'agence' ? 'l\'agence' : 'vous';
  const caution = +l.deposit > 0 ? (C.statut === 'restituee'
    ? `${money(l.cautionRendue || 0)} rendus le ${dateFr(l.cautionRendueLe)}${l.retenues && l.retenues.length ? ` · retenues ${money(l.retenues.reduce((s, r) => s + r.montant, 0))}` : ''}`
    : `${money(l.deposit)} gardés par ${chez}`) : 'Aucune caution';
  const revs = (l.revisions || []).map(r => `${money(r.avant)} → ${money(r.apres)} (${monthLabel(r.mois)})`).join(' · ');
  return `<div class="suivi">
    <p class="small muted" style="margin:0 0 12px"><b style="color:var(--ink)">${esc(l.tenant)}</b> · ${esc((gProp(l.propertyId) || {}).title || '')} · loyer ${money(l.rent)} · ${l.status === 'actif' ? `jusqu'au ${dateFr(leaseEnd(l))}` : 'bail terminé'}</p>
    ${ligne('clipboard' in ICONS ? 'clipboard' : 'checkSquare', 'État des lieux', `Entrée : ${entree ? dateFr(entree.date) : 'à faire'} · Sortie : ${sortie ? dateFr(sortie.date) : 'à faire'}`,
      `<button class="btn ghost sm" data-action="ag-edl" data-id="${l.id}" data-k="${entree ? 'sortie' : 'entree'}">${entree ? (sortie ? 'Revoir' : 'Sortie') : 'Entrée'}</button>`)}
    ${ligne('calendar', 'Préavis de départ', l.preavis ? `Départ prévu le ${dateFr(l.preavis.depart)} (reçu le ${dateFr(l.preavis.recu)})` : 'Aucun préavis reçu',
      l.status === 'actif' ? `<button class="btn ghost sm" data-action="ag-preavis" data-id="${l.id}">${l.preavis ? 'Modifier' : 'Enregistrer'}</button>` : '')}
    ${ligne('trendUp', 'Révision du loyer', revs || `Loyer actuel ${money(l.rent)}${R.revisionPct ? ` · révision proposée ${R.revisionPct} %` : ''}`,
      l.status === 'actif' ? `<button class="btn ghost sm" data-action="ag-revision" data-id="${l.id}">Réviser</button>` : '')}
    ${ligne('key', 'Caution', caution, +l.deposit > 0 && C.statut !== 'restituee' && C.chez !== 'proprietaire' ? `<button class="btn ghost sm" data-action="ag-caution" data-id="${l.id}">Restituer</button>` : '')}
    ${u.role === 'agency' ? ligne('wallet', 'Frais d\'agence', fee ? `${fee.ref} · ${money(fee.ttc)} · ${fee.status === 'paye' ? 'encaissé' : 'à encaisser'}` : 'Pas encore facturés',
      fee ? (fee.status === 'du' ? `<button class="btn ghost sm" data-action="ag-fee-pay" data-id="${fee.id}">Encaisser</button>` : '') : `<button class="btn ghost sm" data-action="ag-fee-bail" data-id="${l.id}">Facturer</button>`) : ''}
  </div>`;
}
const bailDe = (u, id) => DB.findItem(DB.K.leases, x => x.id === id && x.ownerId === u.id);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action^="ag-"]'); if (!b) return;
  const a = b.dataset.action; if (!['ag-suivi', 'ag-edl', 'ag-preavis', 'ag-revision', 'ag-caution', 'ag-fee-bail'].includes(a)) return;
  e.preventDefault();
  const u = Auth.current(); if (!estGestionnaire(u)) return;
  if (!droit(u, 'gestion')) return refuse('Action non autorisée pour votre profil.');
  const l = bailDe(u, b.dataset.id); if (!l) return;
  if (a === 'ag-suivi') return modal('Suivi du bail', suiviBail(u, l));
  if (a === 'ag-fee-bail') { const f = honoraireBail(u, l); toast(f ? `Frais d'agence ${f.ref} : ${money(f.ttc)} à encaisser auprès du locataire.` : 'Rien à facturer (règle à 0 mois).', f ? 'ok' : 'warn'); return modal('Suivi du bail', suiviBail(u, bailDe(u, l.id))); }
  if (a === 'ag-edl') {
    const k = b.dataset.k, ex = edlDe(l).find(x => x.kind === k) || {}, entree = edlDe(l).find(x => x.kind === 'entree');
    return modal(`État des lieux de ${k === 'entree' ? 'l\'entrée' : 'la sortie'}`, `<form data-action="ag-edl-ok" data-id="${l.id}" data-k="${k}">
      <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${ex.date || ymd()}" required></div>
      ${PIECES.map((p, i) => { const v = (ex.pieces || [])[i] || {}, avant = k === 'sortie' && entree ? (entree.pieces[i] || {}) : null;
        return `<div class="edl-p"><b>${p}</b>${avant ? `<span class="small muted"> · à l'entrée : ${(ETATS.find(x => x[0] === avant.etat) || [, '—'])[1]}</span>` : ''}
        <div class="form-grid"><div class="field"><select class="input" name="etat_${i}">${ETATS.map(([c, t]) => `<option value="${c}" ${v.etat === c ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><input class="input" name="rq_${i}" value="${esc(v.rq || '')}" placeholder="Remarque (facultatif)"></div></div></div>`; }).join('')}
      <div class="form-grid"><div class="field"><label>Compteur électricité</label><input class="input" name="elec" value="${esc(ex.elec || '')}"></div>
        <div class="field"><label>Compteur eau</label><input class="input" name="eau" value="${esc(ex.eau || '')}"></div>
        <div class="field"><label>Clés remises</label><input class="input" type="number" min="0" name="cles" value="${ex.cles || 2}"></div></div>
      <div class="row" style="gap:10px"><button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
  }
  if (a === 'ag-preavis') return modal('Préavis de départ', `<form data-action="ag-preavis-ok" data-id="${l.id}"><p class="small">Le locataire annonce son départ : la date sert à préparer l'état des lieux de sortie et la restitution de la caution.</p>
    <div class="form-grid"><div class="field"><label>Reçu le</label><input class="input" type="date" name="recu" value="${(l.preavis || {}).recu || ymd()}" max="${ymd()}" required></div>
    <div class="field"><label>Départ prévu le</label><input class="input" type="date" name="depart" value="${(l.preavis || {}).depart || addDays(now(), 30).slice(0, 10)}" required></div></div>
    <div class="row" style="gap:10px"><button class="btn">Enregistrer</button>${l.preavis ? `<button type="button" class="btn ghost" data-action="ag-preavis-del" data-id="${l.id}">Annuler le préavis</button>` : ''}</div></form>`);
  if (a === 'ag-revision') { const R = regles(u.role === 'agency' ? u : {}), prop = arrondi((+l.rent) * (1 + R.revisionPct / 100));
    const m1 = new Date(); m1.setMonth(m1.getMonth() + 1); const mois = m1.toISOString().slice(0, 7);
    return modal('Réviser le loyer', `<form data-action="ag-revision-ok" data-id="${l.id}"><p class="small">Loyer actuel : <b>${money(l.rent)}</b>. Le nouveau loyer s'applique aux échéances à partir du mois choisi (déjà payées : inchangées).</p>
      <div class="form-grid"><div class="field"><label>Nouveau loyer (FCFA)</label><input class="input" type="number" name="rent" min="1" value="${prop}" required></div>
      <div class="field"><label>À partir de</label><input class="input" type="month" name="mois" value="${mois}" required></div></div>
      <div class="row" style="gap:10px"><button class="btn">Appliquer</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`); }
  if (a === 'ag-caution') { const entree = edlDe(l).find(x => x.kind === 'entree'), sortie = edlDe(l).find(x => x.kind === 'sortie');
    const impayes = DB.filterItems(DB.K.rents, r => r.leaseId === l.id).filter(r => !r.paidAt && rentState(r)[1] === 'bad').reduce((s, r) => s + rRest(r), 0);
    const degats = sortie ? sortie.pieces.map((p, i) => [PIECES[i], p, (entree && entree.pieces[i]) || {}]).filter(([, p, av]) => p.etat === 'mauvais' && av.etat !== 'mauvais') : [];
    return modal('Restituer la caution', `<form data-action="ag-caution-ok" data-id="${l.id}"><p class="small">Caution : <b>${money(l.deposit)}</b>.${sortie ? '' : ' <b style="color:var(--warn)">Conseil : faites d\'abord l\'état des lieux de sortie.</b>'}</p>
      ${degats.length ? `<p class="small">Dégradations relevées à la sortie : ${degats.map(([n, p]) => `<b>${esc(n)}</b>${p.rq ? ` (${esc(p.rq)})` : ''}`).join(', ')}.</p>` : ''}
      <div class="form-grid"><div class="field"><label>Retenue pour loyers impayés</label><input class="input" type="number" name="r_impayes" min="0" value="${Math.min(impayes, +l.deposit)}"></div>
      <div class="field"><label>Retenue pour réparations</label><input class="input" type="number" name="r_degats" min="0" value="0"></div>
      <div class="field"><label>Motif des réparations</label><input class="input" name="motif" value="${esc(degats.map(([n]) => n).join(', '))}"></div>
      <div class="field"><label>Date de restitution</label><input class="input" type="date" name="date" value="${ymd()}" max="${ymd()}" required></div></div>
      <div class="row" style="gap:10px"><button class="btn">Restituer</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`); }
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-edl-ok"],form[data-action="ag-preavis-ok"],form[data-action="ag-revision-ok"],form[data-action="ag-caution-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!estGestionnaire(u) || !droit(u, 'gestion')) return refuse('Action non autorisée pour votre profil.');
  const l = bailDe(u, f.dataset.id); if (!l) return;
  const d = formData(f), a = f.dataset.action;
  if (a === 'ag-edl-ok') {
    const k = f.dataset.k, ex = edlDe(l).find(x => x.kind === k);
    const rec = {date: d.date, pieces: PIECES.map((p, i) => ({etat: d['etat_' + i], rq: (d['rq_' + i] || '').trim()})), elec: d.elec, eau: d.eau, cles: +d.cles || 0};
    if (ex) DB.updateItem(DB.K.edl, ex.id, rec); else DB.addItem(DB.K.edl, {ownerId: u.id, leaseId: l.id, kind: k, ...rec});
    audit('État des lieux', `${k} · ${l.tenant}`); toast('État des lieux enregistré.');
  }
  if (a === 'ag-preavis-ok') {
    if (d.depart < d.recu) return refuse('Le départ ne peut pas précéder la réception du préavis.');
    DB.updateItem(DB.K.leases, l.id, {preavis: {recu: d.recu, depart: d.depart}}); audit('Préavis', `${l.tenant} · départ ${d.depart}`); toast(`Préavis enregistré : départ le ${dateFr(d.depart)}.`);
  }
  if (a === 'ag-revision-ok') {
    const n = arrondi(d.rent); if (!(n > 0)) return refuse('Indiquez le nouveau loyer.');
    if (!/^\d{4}-\d{2}$/.test(d.mois) || d.mois < curMonth()) return refuse('Choisissez un mois à venir (ou le mois en cours).');
    let nb = 0;
    DB.filterItems(DB.K.rents, r => r.leaseId === l.id && r.month >= d.mois && !r.paidAt && !rPaid(r)).forEach(r => { DB.updateItem(DB.K.rents, r.id, {amount: n + (+r.penalite || 0)}); nb++; });
    DB.updateItem(DB.K.leases, l.id, {rent: n, revisions: [...(l.revisions || []), {avant: +l.rent, apres: n, mois: d.mois, le: ymd()}]});
    audit('Révision du loyer', `${l.tenant} · ${money(l.rent)} → ${money(n)}`); toast(`Loyer révisé à ${money(n)} : ${nb} échéance${nb > 1 ? 's' : ''} mise${nb > 1 ? 's' : ''} à jour.`);
  }
  if (a === 'ag-caution-ok') {
    if (cautionDe(u, l).statut === 'restituee') return refuse('La caution a déjà été restituée.');
    if (cautionDe(u, l).chez === 'proprietaire') return refuse('La caution est gardée par le propriétaire : c\'est lui qui la restitue.');
    const ri = Math.max(0, +d.r_impayes || 0), rd = Math.max(0, +d.r_degats || 0), dep = +l.deposit || 0;
    if (ri + rd > dep) return refuse(`Les retenues (${money(ri + rd)}) dépassent la caution (${money(dep)}).`);
    if (rd > 0 && !(d.motif || '').trim()) return refuse('Indiquez le motif des réparations retenues.');
    if (!d.date || d.date > ymd()) return refuse('La date ne peut pas être dans le futur.');
    /* La retenue pour impayés solde les loyers en retard, du plus ancien au plus récent. */
    let reste = ri;
    DB.filterItems(DB.K.rents, r => r.leaseId === l.id && !r.paidAt).sort((x, y) => x.month < y.month ? -1 : 1).forEach(r => {
      if (reste <= 0) return; const due = rRest(r); if (due <= 0) return; const v = Math.min(due, reste); reste -= v;
      const pays = [...(r.payments || []), {amount: v, date: d.date, method: 'Retenue sur caution', ref: 'CAUTION-' + l.id.slice(-4)}];
      DB.updateItem(DB.K.rents, r.id, {payments: pays, ...(v === due ? {paidAt: d.date, method: 'Retenue sur caution'} : {})});
    });
    const retenues = [...(ri ? [{motif: 'Loyers impayés', montant: ri}] : []), ...(rd ? [{motif: d.motif.trim(), montant: rd}] : [])];
    DB.updateItem(DB.K.leases, l.id, {cautionStatut: 'restituee', cautionRendue: dep - ri - rd, cautionRendueLe: d.date, retenues});
    audit('Caution restituée', `${l.tenant} · ${money(dep - ri - rd)} rendus`); toast(`Caution restituée : ${money(dep - ri - rd)} rendus à ${l.tenant}.`);
  }
  closeModal(); render();
  const l2 = bailDe(u, l.id); if (l2) modal('Suivi du bail', suiviBail(u, l2));
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-preavis-del"]'); if (!b) return;
  const u = Auth.current(); const l = u && bailDe(u, b.dataset.id); if (!l) return;
  DB.updateItem(DB.K.leases, l.id, {preavis: null}); toast('Préavis annulé.'); closeModal(); render();
});

/* --- F. Pénalité de retard ------------------------------------------------- */
retoucheGestion(['rents'], (h, u) => {
  const R = regles(u.role === 'agency' ? u : {}); if (!R.penalitePct) return h;
  return h.replace(/<button class="btn sm" data-action="g-pay" data-id="([\w]+)">Encaisser<\/button>/g, (m, id) => {
    const r = DB.findItem(DB.K.rents, id); if (!r || r.penalite || r.paidAt) return m;
    const due = new Date(r.month + '-' + String(((DB.findItem(DB.K.leases, r.leaseId) || {}).dueDay || 5)).padStart(2, '0'));
    const jours = Math.floor((Date.now() - due) / 86400000);
    return jours > R.penaliteJours ? m + `<button class="btn ghost sm" data-action="ag-penalite" data-id="${id}">Pénalité</button>` : m; });
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-penalite"]'); if (!b) return;
  const u = Auth.current(); if (!estGestionnaire(u) || !droit(u, 'gestion')) return refuse('Action non autorisée pour votre profil.');
  const r = DB.findItem(DB.K.rents, x => x.id === b.dataset.id && x.ownerId === u.id); if (!r || r.penalite) return;
  const pen = arrondi((+r.amount) * regles(u).penalitePct / 100);
  confirmDialog({title: 'Appliquer la pénalité de retard', message: `${money(pen)} (${regles(u).penalitePct} %) s'ajoutent au loyer de ${monthLabel(r.month)}.`, confirmLabel: 'Appliquer',
    onConfirm: () => { DB.updateItem(DB.K.rents, r.id, {amount: (+r.amount) + pen, penalite: pen}); audit('Pénalité de retard', `${monthLabel(r.month)} · ${money(pen)}`); toast('Pénalité ajoutée au loyer.'); render(); }});
});

/* --- G. Une seule équipe ----------------------------------------------------- */
const membresDe = u => DB.filterItems(DB.K.users, x => x.parentId === u.id);
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/agents$'); if (!r) return;
  r.fn = () => {
    const u = Auth.guard('agency'); if (!u) return false;
    if (u.member) { toast('Espace réservé au responsable de l\'agence.', 'bad'); go(Auth.home(u)); return false; }
    const equipe = membresDe(u), props = myProps(u), fees = feesDe(u), visites = DB.getData(DB.K.visits);
    const cartes = equipe.map(m => {
      const biens = props.filter(p => p.agentId === m.id), f = fees.filter(x => concerne(x, m.id));
      const vis = visites.filter(v => biens.some(p => p.id === v.propertyId));
      const due = f.filter(x => x.status === 'paye' && !x.agentPaidAt).reduce((s, x) => s + partDe(x, m.id), 0);
      return `<tr><td><div class="row">${avatarHtml(m, 40)}<span><b>${esc(m.firstName)} ${esc(m.lastName)}</b><br><span class="small muted">${esc(m.titre || MEMBER_LABEL[m.role] || '')} · ${esc(m.phone || '')}</span></span></div></td>
        <td>${biens.length}</td><td>${vis.length}</td><td>${money(f.reduce((s, x) => s + x.ht, 0))}</td><td><b>${money(due)}</b></td>
        <td>${badge(m.status === 'actif' ? 'Actif' : 'Suspendu', m.status === 'actif' ? 'ok' : 'bad')}</td>
        <td><button class="btn ghost sm" data-action="ag-attribuer" data-id="${m.id}">Attribuer des biens</button></td></tr>`; });
    return shellApp(u, page('Équipe', 'Vos agents et gestionnaires : leurs biens, leurs visites et leur commission.', `<a class="btn" href="#/manage/team">${icon('plus', 16)} Ajouter un membre</a>`) +
      `<p class="small muted" style="margin:0 0 14px">Chaque membre se connecte avec sa CNI. Ses droits se règlent dans <a href="#/manage/team">Gestion › Équipe & accès</a>. La commission (${regles(u).agentPct} % des honoraires HT, partagée à ${regles(u).partRentree} % pour l'agent qui a rentré le bien) est due une fois les honoraires encaissés.</p>` +
      gTable(['Membre', 'Biens', 'Visites', 'Honoraires générés', 'Commission due', 'Statut', ''], cartes, ['Aucun membre', 'Ajoutez un agent : il pourra se connecter et suivre ses biens.']));
  };
})();
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-attribuer"]'); if (!b) return;
  const u = Auth.current(); if (!u || u.role !== 'agency' || u.member) return;
  const m = DB.findItem(DB.K.users, x => x.id === b.dataset.id && x.parentId === u.id); if (!m) return;
  const props = myProps(u);
  modal(`Biens suivis par ${m.firstName}`, `<form data-action="ag-attribuer-ok" data-id="${m.id}"><p class="small muted">Un bien n'a qu'un agent : le cocher ici le retire à son agent actuel.</p>
    <div class="stack" style="gap:8px;max-height:50vh;overflow:auto">${props.map(p => { const autre = p.agentId && p.agentId !== m.id ? DB.findItem(DB.K.users, p.agentId) : null;
      return `<label class="check"><input type="checkbox" name="p_${p.id}" ${p.agentId === m.id ? 'checked' : ''}> ${esc(p.title)}${autre ? ` <span class="small muted">(${esc(autre.firstName)})</span>` : ''}</label>`; }).join('')}</div>
    <div class="row" style="gap:10px;margin-top:14px"><button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-attribuer-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency' || u.member) return;
  const m = DB.findItem(DB.K.users, x => x.id === f.dataset.id && x.parentId === u.id); if (!m) return;
  const d = formData(f); let n = 0;
  myProps(u).forEach(p => { const coche = !!d['p_' + p.id];
    if (coche && p.agentId !== m.id) { DB.updateItem(DB.K.properties, p.id, {agentId: m.id}); n++; }
    if (!coche && p.agentId === m.id) DB.updateItem(DB.K.properties, p.id, {agentId: ''}); });
  audit('Attribution', `${m.firstName} ${m.lastName}`); toast(`Biens de ${m.firstName} mis à jour.`); closeModal(); render();
}, true);

/* --- H. Clients : demandes et biens correspondants ------------------------- */
const sansAcc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function biensPour(u, dm) {
  return myProps(u).filter(p => {
    if (['vendu', 'loue', 'archive'].includes(p.status)) return false;
    if (dm.transaction === 'location' ? p.transaction !== 'location' : p.transaction === 'location') return false;
    if (dm.type && sansAcc(p.type) !== sansAcc(dm.type)) return false;
    if (+dm.budget && +p.price > +dm.budget * 1.1) return false;
    if (+dm.rooms && +p.rooms < +dm.rooms) return false;
    if (dm.lieu && !sansAcc([p.quartier, p.city, p.commune, p.region].join(' ')).includes(sansAcc(dm.lieu).trim())) return false;
    return true; });
}
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/clients$'); if (!r) return;
  const ancienne = r.fn;
  r.fn = (...a) => {
    const h = ancienne(...a); if (h === false) return h;
    const u = Auth.current(), dms = DB.filterItems(DB.K.demandes, x => x.ownerId === u.id && x.status !== 'close').slice().reverse(), equipe = membresDe(u);
    const lien = id => location.href.split('#')[0] + (typeof annonceHref === 'function' ? annonceHref(gProp(id)) : '#/property/' + id);
    const bloc = `<form class="card" data-action="ag-demande" style="margin:0 0 18px" data-sub="Ce que cherche le client"><h4 style="margin-top:0">Nouvelle demande client</h4>
      <div class="form-grid">
        <div class="field"><label>Client</label><input class="input" name="name" required placeholder="Nom complet"></div>
        <div class="field"><label>Téléphone</label><input class="input" type="tel" name="phone" required placeholder="77 000 00 00"></div>
        <div class="field"><label>Il cherche à</label><select class="input" name="transaction"><option value="location">Louer</option><option value="vente">Acheter</option></select></div>
        <div class="field"><label>Type de bien</label><select class="input" name="type"><option value="">Peu importe</option>${['appartement', 'maison', 'villa', 'studio', 'chambre', 'terrain', 'bureau', 'local commercial'].map(t => `<option>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Budget maximum (FCFA)</label><input class="input" type="number" name="budget" min="0"></div>
        <div class="field"><label>Quartier ou ville</label><input class="input" name="lieu" placeholder="Almadies, Mermoz, Thiès…"></div>
        <div class="field"><label>Chambres minimum</label><input class="input" type="number" name="rooms" min="0" value="0"></div>
        <div class="field"><label>Agent qui suit</label><select class="input" name="agentId"><option value="">Moi</option>${equipe.map(m => `<option value="${m.id}">${esc(m.firstName)} ${esc(m.lastName)}</option>`).join('')}</select></div>
      </div><button class="btn">Enregistrer la demande</button></form>
      <h3 style="margin:0 0 10px">Demandes en cours</h3>` +
      gTable(['Client', 'Recherche', 'Biens qui correspondent', ''], dms.map(dm => {
        const bs = biensPour(u, dm), ag = dm.agentId ? DB.findItem(DB.K.users, dm.agentId) : null;
        const msg = `Bonjour ${dm.name}, voici des biens qui correspondent à votre recherche :\n` + bs.slice(0, 3).map(p => `• ${p.title} — ${money(p.price)}\n${lien(p.id)}`).join('\n');
        const wa = String(dm.phone || '').replace(/\D/g, ''), tel = wa.length === 9 ? '221' + wa : wa;
        return `<tr><td><b>${esc(dm.name)}</b><br><span class="small muted">${esc(dm.phone)}${ag ? ' · ' + esc(ag.firstName) : ''}</span></td>
          <td class="small">${dm.transaction === 'location' ? 'Louer' : 'Acheter'} ${esc(dm.type || 'un bien')}${dm.lieu ? ' · ' + esc(dm.lieu) : ''}${+dm.budget ? ' · ≤ ' + money(dm.budget) : ''}${+dm.rooms ? ' · ' + dm.rooms + ' ch. min.' : ''}</td>
          <td class="small dm-biens">${bs.length ? bs.slice(0, 3).map(p => `<a href="#/bien/${p.id}">${esc(p.title)}</a> · ${money(p.price)}`).join('<br>') + (bs.length > 3 ? `<br><span class="muted">+ ${bs.length - 3} autre(s)</span>` : '') : '<span class="muted">Aucun pour l\'instant</span>'}</td>
          <td><div class="row" style="gap:6px">${bs.length && tel ? `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(msg)}">Envoyer</a>` : ''}<button class="btn ghost sm" data-action="agent-planif" data-dm="${dm.id}">Visite</button><button class="btn ghost sm" data-action="ag-demande-close" data-id="${dm.id}">Clore</button></div></td></tr>`; }),
        ['Aucune demande', 'Notez ce que cherche chaque client : les biens qui correspondent s\'affichent tout seuls.']) + `<h3 style="margin:22px 0 10px">Contacts</h3>`;
    return h.replace(/(<\/div>\s*)(<div class="table-wrap">|<div class="empty">)/, `$1${bloc}$2`);
  };
})();
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-demande"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency') return;
  if (!droit(u, 'visites')) return refuse('Action non autorisée pour votre profil.');
  const d = formData(f);
  if (!d.name.trim()) return refuse('Indiquez le nom du client.');
  if (String(d.phone).replace(/\D/g, '').length < 9) return refuse('Indiquez un téléphone valide (9 chiffres).');
  const tel = String(d.phone).replace(/\D/g, '');
  if (DB.findItem(DB.K.demandes, x => x.ownerId === u.id && x.status !== 'close' && String(x.phone).replace(/\D/g, '') === tel && x.transaction === d.transaction))
    return refuse('Ce client a déjà une demande en cours pour ce type de recherche : modifiez-la ou closez-la.');
  if (d.agentId && !DB.findItem(DB.K.users, x => x.id === d.agentId && x.parentId === u.id)) return refuse('Agent inconnu.');
  const dm = DB.addItem(DB.K.demandes, {ownerId: u.id, name: d.name.trim(), phone: d.phone.trim(), transaction: d.transaction === 'vente' ? 'vente' : 'location', type: d.type || '',
    budget: +d.budget || 0, lieu: (d.lieu || '').trim(), rooms: +d.rooms || 0, agentId: d.agentId || (u.member ? u.member.id : ''), status: 'active', createdAt: now()});
  const n = biensPour(u, dm).length;
  toast(n ? `Demande enregistrée : ${n} bien${n > 1 ? 's' : ''} correspond${n > 1 ? 'ent' : ''} déjà.` : 'Demande enregistrée. Elle sera comparée à chaque nouveau bien.'); render();
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-demande-close"]'); if (!b) return;
  const u = Auth.current(); const dm = u && DB.findItem(DB.K.demandes, x => x.id === b.dataset.id && x.ownerId === u.id); if (!dm) return;
  DB.updateItem(DB.K.demandes, dm.id, {status: 'close', closedAt: ymd()}); toast('Demande close.'); render();
});

/* --- À traiter : ce qui demande une action --------------------------------- */
const _todoAg = todoList;
todoList = function (u, s) {
  const t = _todoAg(u, s);
  if (!estGestionnaire(u)) return t;
  const baux = gMine('leases', u);
  baux.filter(l => l.status === 'actif' && l.preavis && l.preavis.depart).forEach(l => {
    const j = daysBetween(ymd(), l.preavis.depart);
    if (j <= 30) t.push([`Départ de ${l.tenant} ${j >= 0 ? 'dans ' + j + ' j' : 'dépassé'}`, `Préavis · état des lieux de sortie et caution à préparer`, '#/manage/leases', 'calendar', 'warn']); });
  const aRendre = baux.filter(l => { const c = cautionDe(u, l); return l.status !== 'actif' && c.chez !== 'proprietaire' && c.statut === 'detenue' && +l.deposit > 0; });
  if (aRendre.length) t.push([`${aRendre.length} caution${aRendre.length > 1 ? 's' : ''} à restituer`, aRendre.map(l => l.tenant).slice(0, 2).join(', '), u.role === 'agency' ? '#/agency/commissions' : '#/manage/leases', 'key', 'warn']);
  if (u.role === 'agency' && droit(u, 'finances')) {
    const dus = feesDe(u).filter(f => f.status === 'du');
    if (dus.length) t.push([`${dus.length} honoraire${dus.length > 1 ? 's' : ''} à encaisser`, money(dus.reduce((a, f) => a + f.ttc, 0)), '#/agency/commissions', 'wallet', 'warn']);
  }
  return t;
};

/* --- I. Menu de l'agence complété (sans doublon) --------------------------- */
(() => {
  const M = MENUS_RAW.agency; if (!M) return;
  const ajoute = (apres, item) => { if (M.some(m => m[0] === item[0])) return; const i = M.findIndex(m => m[0] === apres); M.splice(i < 0 ? M.length : i + 1, 0, item); };
  ajoute('#/agency/properties', ['#/agency/clients', 'Clients', 'users']);
  ajoute('#/agency/clients', ['#/agency/visits', 'Visites', 'calendar']);
  ajoute('#/manage/rents', ['#/manage/deals', 'Ventes', 'tag']);
  ajoute('#/manage/transfers', ['#/agency/commissions', 'Honoraires', 'wallet']);
  ajoute('#/agency/messages', ['#/agency/agents', 'Équipe', 'briefcase']);
})();

/* Pastilles des formulaires de ce module. */
if (typeof DS_FORM_IC !== 'undefined') DS_FORM_IC.unshift([/ag-regles/, 'settings'], [/ag-demande/, 'users'], [/ag-mv-new/, 'tag']);

/* Menu de l'agence allégé : Messages, Maintenance, Dépenses et Rapports
   restent accessibles (barre du bas, cloche, tiroirs de Gestion) mais ne
   figurent plus dans le menu latéral. */
(() => {
  const M = MENUS_RAW.agency; if (!M) return;
  ['#/agency/messages', '#/manage/tickets', '#/manage/expenses', '#/manage/reports'].forEach(h => {
    const i = M.findIndex(m => m[0] === h); if (i >= 0) M.splice(i, 1); });
})();

/* Menu encore allégé : Visites, Équipe et Gestion sortent du menu latéral.
   Accès conservés : Gestion par la barre du bas ; Visites depuis la page
   Clients ; Équipe depuis les Paramètres. */
(() => {
  const M = MENUS_RAW.agency; if (!M) return;
  ['#/agency/visits', '#/agency/agents', '#/manage'].forEach(h => { const i = M.findIndex(m => m[0] === h); if (i >= 0) M.splice(i, 1); });
  const lier = (re, f) => { const r = routes.find(x => x.re.source === re); if (!r) return; const g = r.fn; r.fn = (...a) => { const h = g(...a); return h === false ? h : f(h); }; };
  lier('^\\/agency\\/clients$', h => h.replace('<h2>Clients</h2>', '<h2>Clients</h2>').replace(/(<div class="page-head">[\s\S]*?<div class="row">)/, `$1<a class="btn ghost" href="#/agency/visits">${icon('calendar', 16)} Visites</a>`));
  lier('^\\/agency\\/settings$', h => h.replace('<div class="stack" style="gap:18px">', `<div class="stack" style="gap:18px"><a class="card ds-lien" href="#/agency/agents"><span class="fhead-ic">${icon('users', 21)}</span><span><b>Équipe</b><span>Agents, biens attribués, commissions</span></span>${icon('arrowRight', 18)}</a>`));
})();

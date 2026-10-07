/* ==========================================================================
   MODULE : reste.js — derniers points du cahier des charges :
   maintenance en trois états avec catégories (§13), jour d'échéance du bail
   (§9), statut « archivée » pour une unité (§7), devis soumis à la validation
   du propriétaire au-delà d'un seuil (§14).
   ========================================================================== */

/* ---------- §13 : trois états, six catégories ---------- */
const MCAT = ['Plomberie', 'Électricité', 'Climatisation', 'Peinture', 'Serrurerie', 'Autre'];
const MOLD = {ouvert:'nouvelle', 'assigné':'en cours', resolu:'terminée', 'résolu':'terminée', 'fermé':'terminée'};
TKS.splice(0, TKS.length, 'nouvelle', 'en cours', 'terminée');
Object.assign(TICKET_LABEL, {nouvelle:'Nouvelle', 'en cours':'En cours', 'terminée':'Terminée'});
Object.assign(TICKET_TONE, {nouvelle:'warn', 'en cours':'info', 'terminée':'ok'});
tkSt = t => MOLD[t.status] || (TKS.includes(t.status) ? t.status : 'nouvelle');
EXP.tickets = u => [['Bien', 'Problème', 'Catégorie', 'Priorité', 'Prestataire', 'Coût', 'Statut'],
  gMine('tickets', u).map(t => [(gProp(t.propertyId) || {}).title, t.title, t.category || 'Autre', t.priority || 'normale', provName(t.providerId), t.cost, tkSt(t)])];

/* ---------- §9 : jour d'échéance du bail ---------- */
const dueDayOf = l => Math.min(28, Math.max(1, +(l && l.dueDay) || 5));
rentState = function (r) {
  if (r.paidAt) return ['Payé', 'ok'];
  const l = DB.findItem(DB.K.leases, r.leaseId), d = String(dueDayOf(l)).padStart(2, '0');
  return `${r.month}-${d}` < ymd() ? ['En retard', 'bad'] : ['À venir', 'info'];
};

/* ---------- §7 : unité archivée ---------- */
let GSHOW_ARCH = false;
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="g8-uarch"],[data-action="g8-arch-toggle"],[data-action="q-ok"],[data-action="q-no"]'), u = Auth.current(); if (!el || !u) return;
  const id = el.dataset.id, a = el.dataset.action;
  if (a === 'g8-arch-toggle') { GSHOW_ARCH = !GSHOW_ARCH; render(); return; }
  if (a === 'g8-uarch') { const x = DB.findItem(DB.K.units, y => y.id === id && y.ownerId === u.id); if (!x || x.status === 'occupée') return;
    const back = x.status === 'archivee';
    DB.updateItem(DB.K.units, id, {status: back ? 'libre' : 'archivee'});
    audit('Unité ' + x.ref, back ? 'réactivée' : 'archivée'); toast(back ? x.ref + ' réactivée.' : x.ref + ' archivée.'); render(); return; }
  /* ---------- §14 : accord du propriétaire sur un devis ---------- */
  const d = DB.findItem(DB.K.docs, y => y.id === id && y.ownerId === u.id); if (!d) return;
  if (a === 'q-no') { DB.updateItem(DB.K.docs, id, {status: 'refusé', ownerDecision: 'refusé', decidedAt: now()}); audit('Devis refusé par le propriétaire', d.ref); render(); return; }
  const o = DB.findItem(DB.K.owners, (gProp(d.propertyId) || {}).clientOwnerId) || {};
  promptDialog({title: 'Accord du propriétaire', label: 'Qui a donné son accord ?', value: o.name || '',
    onConfirm: v => { DB.updateItem(DB.K.docs, id, {status: 'envoyé', ownerDecision: 'approuvé', decidedBy: v, decidedAt: now()});
      audit('Devis approuvé par le propriétaire', `${d.ref} · ${v}`); toast('Accord enregistré : le devis suit son cours.'); render(); }});
});
const seuilOf = u => { const v = (u.docInfo || {}).seuil; return v == null || v === '' ? 100000 : +v; };
const needsOwnerOk = (u, d) => { if (u.role !== 'agency' || d.type !== 'DEV') return false;
  const p = gProp(d.propertyId); return !!(p && p.clientOwnerId) && dTot(d) > seuilOf(u); };
const _mkDoc = mkDoc;
mkDoc = function (u, type, o) {
  const d = _mkDoc(u, type, o);
  if (needsOwnerOk(u, d)) { DB.updateItem(DB.K.docs, d.id, {status: 'à valider', ownerDecision: 'attente'}); toast('Montant au-dessus du seuil : ce devis attend l\'accord du propriétaire.', 'bad'); return DB.findItem(DB.K.docs, d.id); }
  return d;
};
const _dState = dState;
dState = d => d.status === 'à valider' ? ['Accord du propriétaire attendu', 'warn'] : _dState(d);
const _gtR = gTab;
gTab = function (u, tab) {
  if (tab === 'units') return _gtR(u, tab) + `<div style="margin-top:12px"><button class="btn ghost sm" data-action="g8-arch-toggle">${GSHOW_ARCH ? 'Masquer' : 'Afficher'} les unités archivées</button></div>`;
  if (tab !== 'docs') return _gtR(u, tab);
  return _gtR(u, tab).replace(/<button class="btn sm" data-action="g2-ok" data-id="([\w]+)">Accepter<\/button><button class="btn ghost sm" data-action="g2-no" data-id="\1">Refuser<\/button>/g,
    (m, id) => { const d = DB.findItem(DB.K.docs, id);
      return d && d.status === 'à valider'
        ? `<button class="btn sm" data-action="q-ok" data-id="${id}">Accord reçu</button><button class="btn ghost sm" data-action="q-no" data-id="${id}">Refusé</button>` : m; });
};

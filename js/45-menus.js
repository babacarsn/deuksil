/* ==========================================================================
   MODULE : menus.js — menus conformes au cahier des charges (§3, §18, §23)
   et documents rattachés à leur objet : justificatif d'une dépense, pièces
   d'un bail (§24).
   ========================================================================== */

/* ---------- §3 : propriétaire ---------- */
MENUS_RAW.owner = [
  ['#/owner/dashboard', 'Tableau de bord', 'grid'], ['#/owner/properties', 'Mes biens', 'home'],
  ['#/manage/tenants', 'Locataires', 'users'], ['#/manage/rents', 'Loyers', 'money'],
  ['#/manage/expenses', 'Dépenses', 'repeat'], ['#/manage/tickets', 'Maintenance', 'settings'],
  ['#/coffre', 'Documents', 'file'], ['#/manage/reports', 'Rapports', 'chart'],
  ['#/owner/messages', 'Messages', 'message'], ['#/manage', 'Gestion', 'briefcase'],
  ['#/owner/profile', 'Paramètres', 'user']];

/* ---------- §18 : agence ---------- */
MENUS_RAW.agency = [
  ['#/agency/dashboard', 'Tableau de bord', 'grid'], ['#/manage/owners', 'Propriétaires', 'user'],
  ['#/manage/mandates', 'Mandats', 'file'], ['#/agency/properties', 'Biens', 'building'],
  ['#/manage/units', 'Unités', 'layers'], ['#/manage/tenants', 'Locataires', 'users'],
  ['#/manage/rents', 'Loyers', 'money'], ['#/manage/docs', 'Devis & Factures', 'card'],
  ['#/manage/expenses', 'Dépenses', 'repeat'], ['#/manage/tickets', 'Maintenance', 'settings'],
  ['#/manage/transfers', 'Reversements', 'trendUp'], ['#/coffre', 'Documents', 'file'],
  ['#/manage/reports', 'Rapports', 'chart'], ['#/agency/messages', 'Messages', 'message'],
  ['#/manage', 'Gestion', 'briefcase'], ['#/agency/settings', 'Paramètres', 'settings']];

/* ---------- §23 : locataire ---------- */
MENUS_RAW.tenant = [
  ['#/tenant/home', 'Mon logement', 'home'], ['#/tenant/rents', 'Mon loyer', 'money'],
  ['#/tenant/payments', 'Mes paiements', 'card'], ['#/tenant/quittances', 'Mes quittances', 'checkCircle'],
  ['#/tenant/tickets', 'Maintenance', 'settings'], ['#/coffre', 'Documents', 'file'],
  ['#/tenant/messages', 'Messages', 'message']];
Object.assign(PILL, {
  owner:  [['#/owner/dashboard', '#/owner/properties'], ['#/owner/property/new', 'Publier', 'plus'], ['#/manage/rents', '#/owner/messages']],
  agency: [['#/agency/dashboard', '#/agency/properties'], ['#/owner/property/new', 'Publier', 'plus'], ['#/manage/rents', '#/agency/messages']],
  tenant: [['#/tenant/home', '#/tenant/rents'], ['#/tenant/tickets', 'Signaler', 'plus'], ['#/tenant/quittances', '#/coffre']]
});
DRAWERS.tenant = ['quittances', 'contrats', 'identite', 'assurance', 'autres'];

/* ---------- Espace locataire : paiements et quittances ---------- */
const tLease = u => DB.findItem(DB.K.leases, u.leaseId);
route(/^\/tenant\/(payments|quittances)$/, which => {
  const u = Auth.current();
  if (!u || u.role !== 'tenant') { toast('Espace réservé aux locataires.', 'bad'); go('#/login'); return false; }
  const l = tLease(u), rents = DB.filterItems(DB.K.rents, r => r.leaseId === u.leaseId && r.paidAt).sort((a, b) => a.paidAt < b.paidAt ? 1 : -1);
  if (which === 'payments') {
    const total = rents.reduce((s, r) => s + r.amount, 0);
    return shellApp(u, page('Mes paiements', 'Tout ce que vous avez déjà réglé.') +
      `<div class="kpis" style="margin-bottom:16px">${kpi(rents.length, 'Paiements')}${kpi(money(total), 'Total versé', 'ok')}${kpi(l ? money(l.deposit) : '—', 'Caution versée')}</div>` +
      (rents.length ? rents.map(r => `<div class="bcard" style="cursor:default"><div class="top"><b>${monthLabel(r.month)}</b>${badge(esc(r.method || 'Encaissé par le bailleur'), 'info')}<span class="amt">${money(r.amount)}</span></div>
        <div class="sub">Payé le ${dateFr(r.paidAt)}${r.payRef ? ' · réf. ' + esc(r.payRef) : ''}</div></div>`).join('')
        : '<div class="empty"><b>Aucun paiement</b><p class="small">Vos règlements apparaîtront ici.</p></div>'));
  }
  return shellApp(u, page('Mes quittances', 'Une quittance par loyer payé, téléchargeable en PDF.') +
    (rents.length ? rents.map(r => `<div class="bcard" style="cursor:default"><div class="top"><b>Quittance de ${monthLabel(r.month)}</b><span class="amt">${money(r.amount)}</span></div>
      <div class="sub">Payé le ${dateFr(r.paidAt)}</div><div style="margin-top:9px">${pdfBtn('QUIT-' + r.id)}</div></div>`).join('')
      : '<div class="empty"><b>Aucune quittance</b><p class="small">Dès qu\'un loyer est réglé, sa quittance arrive ici.</p></div>'));
});

/* ---------- §24 : justificatif d'une dépense, pièces d'un bail ---------- */
async function attachDoc(u, file, name, cat, propertyId, srcRef) {
  let dataUrl = await readFileAsDataUrl(file), mime = file.type, n = name || file.name;
  if ((mime || '').startsWith('image/')) { try { const pdf = await imageToPdf(dataUrl, n.replace(/\.[^.]+$/, '')); dataUrl = await b64(pdf); mime = 'application/pdf'; n = n.replace(/\.[^.]+$/, '') + '.pdf'; } catch {} }
  const rec = DB.addItem(DB.K.documents, {ownerId: u.id, name: n, mime, dataUrl, cat, propertyId: propertyId || '', expiry: '', srcRef: srcRef || ''});
  return DB.lastWriteOk ? rec : null;
}
const _gtM = gTab;
gTab = function (u, tab) {
  const h = _gtM(u, tab);
  if (tab === 'expenses') return h.replace('<button class="btn">Enregistrer la dépense</button>',
    '<div class="field"><label>Justificatif (facultatif)</label><input class="input" type="file" name="proof" accept=".pdf,image/*"></div><button class="btn">Enregistrer la dépense</button>');
  if (tab !== 'leases') return h;
  /* bouton « Joindre » sur chaque bail */
  return h.replace(/<button class="btn ghost sm" data-action="g-end-lease" data-id="([\w]+)">Mettre fin<\/button>/g,
    (m, id) => `<button class="btn ghost sm" data-action="l-doc" data-id="${id}">Joindre</button>` + m);
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="l-doc"]'), u = Auth.current(); if (!el || !u) return;
  const l = DB.findItem(DB.K.leases, x => x.id === el.dataset.id && x.ownerId === u.id); if (!l) return;
  const joint = DB.filterItems(DB.K.documents, d => d.ownerId === u.id && d.srcRef === 'BAIL-' + l.id);
  modal('Pièces du bail · ' + l.tenant, `<form data-action="l-doc-save" data-id="${l.id}">
    <div class="field"><label>Document</label><select class="input" name="kind"><option>Bail signé</option><option>État des lieux d'entrée</option><option>État des lieux de sortie</option><option>Attestation d'assurance</option><option>Autre pièce</option></select></div>
    <div class="field"><label>Fichier (PDF ou image, 4 Mo max)</label><input class="input" type="file" name="file" accept=".pdf,image/*" required></div>
    <button class="btn block">Joindre au bail</button></form>
    ${joint.length ? `<p class="small muted" style="margin:14px 0 6px">Déjà joint à ce bail</p>` + joint.map(d => `<div class="bcard" style="cursor:default"><div class="top"><b>${esc(d.name)}</b><span class="amt small muted">${dateFr(d.createdAt)}</span></div></div>`).join('') : ''}`);
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-action="l-doc-save"]'), u = Auth.current(); if (!f || !u) return;
  e.preventDefault(); const l = DB.findItem(DB.K.leases, x => x.id === f.dataset.id && x.ownerId === u.id);
  const file = f.querySelector('[type=file]').files[0], d = formData(f); if (!l || !file) return;
  try {
    const rec = await attachDoc(u, file, `${d.kind} · ${l.tenant}`, 'contrats', l.propertyId, 'BAIL-' + l.id);
    if (!rec) return; audit('Pièce jointe au bail', `${d.kind} · ${l.tenant}`); closeModal(); toast('Pièce jointe au bail et rangée dans « Contrats ».'); render();
  } catch { toast('Fichier trop volumineux (4 Mo max) ou illisible.', 'bad'); }
});
/* justificatif au moment d'enregistrer une dépense */
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action="g2-expense"]'), u = Auth.current(); if (!f || !u) return;
  const input = f.querySelector('[name=proof]'), file = input && input.files[0]; if (!file) return;
  setTimeout(async () => {
    const x = gMine('expenses', u).slice(-1)[0]; if (!x) return;
    try { const rec = await attachDoc(u, file, `Justificatif ${x.ref}`, 'autres', x.propertyId, 'DEP-' + x.id);
      if (rec) { DB.updateItem(DB.K.expenses, x.id, {proofId: rec.id}); toast('Justificatif rangé avec la dépense.'); render(); } } catch {}
  }, 60);
});

/* ==========================================================================
   MODULE : complements.js — groupe A, suite.
     A4. PDF : facture d'honoraires, état des lieux, reçu de caution.
     A5. Alerte : un nouveau bien correspond à la demande d'un client.
     A6. Relevé du mandant : ventes nettes d'honoraires, TVA ; reconduction
         tacite des baux (réglable).
   ========================================================================== */

/* --- A4. Trois documents PDF dans le style des autres ---------------------- */
const PIECES_EDL = typeof PIECES !== 'undefined' ? PIECES : ['Entrée / séjour', 'Chambre(s)', 'Cuisine', 'Salle d\'eau / WC', 'Extérieur / balcon'];
const ETAT_EDL = {bon: 'Bon état', moyen: 'Usure normale', mauvais: 'Dégradé'};
const refCourte = id => String(id || '').slice(-6).toUpperCase();

function pdfFactureHonoraires(f, u) {
  const I = issuer(u), p = gProp(f.propertyId) || {}, l = f.leaseId && DB.findItem(DB.K.leases, f.leaseId), d = f.dealId && DB.findItem(DB.K.deals, f.dealId);
  const [doc, y0] = pdfBegin('FACTURE', f.ref, f.createdAt, f.ref); let y = y0;
  pdfPill(doc, 195, 38, f.status === 'paye' ? 'Payée' : 'À payer', f.status === 'paye' ? [31, 122, 77] : [180, 134, 63]); y += 6;
  y = pdfParties(doc, y, {t: 'Émetteur', lines: issuerLines(I)}, {t: 'Facturé à', lines: [f.payerName || (f.payer === 'locataire' ? 'Le locataire' : f.payer === 'acquereur' ? 'L\'acquéreur' : 'Le vendeur'), p.title && 'Bien : ' + p.title, [p.quartier, p.city].filter(Boolean).join(', ')].filter(Boolean)});
  const objet = f.kind === 'vente'
    ? `Honoraires de vente${d ? ' — vente à ' + d.buyer : ''}${p.title ? ' — ' + p.title : ''}`
    : `Frais de location${l ? ' — bail de ' + l.tenant + ', loyer ' + fc(l.rent) + '/mois' : ''}`;
  y = pdfTable(doc, y, [{h: 'Désignation', w: 130}, {h: 'Montant HT', w: 50, a: 'r'}], [[objet, fc(f.ht)]]);
  const rows = [['Total HT', fc(f.ht)]]; if (f.tva) rows.push([`TVA (${Math.round(f.tva / f.ht * 100)} %)`, fc(f.tva)]); rows.push(['Total TTC', fc(f.ttc), true]);
  if (f.status === 'paye') rows.push(['Payé le ' + d8(f.paidAt), fc(f.ttc)], ['Reste à payer', fc(0), true]);
  y = pdfTotals(doc, y + 2, rows);
  y = pdfPara(doc, y, 'Conditions', I.terms || (f.kind === 'vente' ? 'Honoraires dus à la signature de l\'acte de vente, selon le mandat de vente.' : 'Frais dus à la signature du bail, selon le barème de l\'agence.') + ' Modes acceptés : espèces, virement, Wave, Orange Money.');
  if (I.bank) y = pdfPara(doc, y, 'Coordonnées de paiement', I.bank);
  return pdfEnd(doc, u, f.ref);
}
function pdfEtatDesLieux(e, u) {
  const I = issuer(u), l = DB.findItem(DB.K.leases, e.leaseId) || {}, p = gProp(l.propertyId) || {}, ref = `EDL-${e.kind === 'entree' ? 'E' : 'S'}-${refCourte(l.id)}`;
  const entree = e.kind === 'sortie' ? DB.findItem(DB.K.edl, x => x.leaseId === e.leaseId && x.kind === 'entree') : null;
  const [doc, y0] = pdfBegin('ÉTAT DES LIEUX', ref, e.date, ref); let y = y0;
  pdfPill(doc, 195, 38, e.kind === 'entree' ? 'Entrée' : 'Sortie', [15, 48, 87]); y += 6;
  y = pdfParties(doc, y, {t: 'Bailleur', lines: issuerLines(I)}, {t: 'Locataire', lines: [l.tenant, l.phone && 'Tél : ' + l.phone, p.title && 'Bien : ' + p.title, [p.quartier, p.city].filter(Boolean).join(', ')].filter(Boolean)});
  const cols = entree ? [{h: 'Pièce', w: 50}, {h: 'À l\'entrée', w: 35}, {h: 'À la sortie', w: 35}, {h: 'Remarques', w: 60}] : [{h: 'Pièce', w: 55}, {h: 'État', w: 40}, {h: 'Remarques', w: 85}];
  y = pdfTable(doc, y, cols, PIECES_EDL.map((n, i) => { const s = (e.pieces || [])[i] || {}, a = entree && (entree.pieces || [])[i] || {};
    return entree ? [n, ETAT_EDL[a.etat] || '—', ETAT_EDL[s.etat] || '—', s.rq || ''] : [n, ETAT_EDL[s.etat] || '—', s.rq || '']; }));
  y = pdfTable(doc, y, [{h: 'Relevés', w: 90}, {h: 'Valeur', w: 90}], [['Compteur d\'électricité', e.elec || '—'], ['Compteur d\'eau', e.eau || '—'], ['Clés remises', String(e.cles || 0)]]);
  y = pdfPara(doc, y + 2, null, `État des lieux ${e.kind === 'entree' ? 'd\'entrée' : 'de sortie'} établi contradictoirement le ${d8(e.date)}, en deux exemplaires. Les parties reconnaissent l'exactitude des constatations ci-dessus.`);
  pdfSign(doc, y + 2, 'Le bailleur ou son mandataire', 'Le locataire'); return pdfEnd(doc, u, ref);
}
function pdfRecuCaution(l, u) {
  const I = issuer(u), p = gProp(l.propertyId) || {}, rendue = l.cautionStatut === 'restituee', ref = `CAU-${refCourte(l.id)}`;
  const [doc, y0] = pdfBegin(rendue ? 'RESTITUTION DE CAUTION' : 'REÇU DE CAUTION', ref, rendue ? l.cautionRendueLe : l.start, ref); let y = y0;
  y = pdfParties(doc, y, {t: rendue ? 'Restituée par' : 'Reçue par', lines: issuerLines(I)}, {t: rendue ? 'Restituée à' : 'Versée par', lines: [l.tenant, l.phone && 'Tél : ' + l.phone, p.title && 'Bien : ' + p.title].filter(Boolean)});
  const dep = +l.deposit || 0;
  if (!rendue) {
    y = pdfTotals(doc, y, [['Dépôt de garantie reçu', fc(dep), true]]);
    y = pdfPara(doc, y + 2, null, `Reçu de ${l.tenant} la somme de ${fc(dep)} (${enLettres(dep)} francs CFA) à titre de dépôt de garantie pour le bail débutant le ${d8(l.start)}. Cette somme n'est pas un loyer : elle sera restituée en fin de bail, après état des lieux de sortie, déduction faite des sommes dues justifiées.`);
  } else {
    const ret = l.retenues || [], tot = ret.reduce((s, r) => s + r.montant, 0);
    y = pdfTable(doc, y, [{h: 'Détail', w: 130}, {h: 'Montant', w: 50, a: 'r'}], [['Dépôt de garantie versé', fc(dep)], ...ret.map(r => ['Retenue : ' + r.motif, '- ' + fc(r.montant)])]);
    y = pdfTotals(doc, y + 2, [['Total des retenues', fc(tot)], ['Montant restitué', fc(l.cautionRendue || dep - tot), true]]);
    y = pdfPara(doc, y + 2, null, `Restitué à ${l.tenant} la somme de ${fc(l.cautionRendue || dep - tot)} le ${d8(l.cautionRendueLe)}, au titre du dépôt de garantie. Les retenues ci-dessus sont justifiées par l'état des lieux de sortie et le décompte des loyers.`);
  }
  pdfSign(doc, y + 2, rendue ? 'Le bailleur ou son mandataire' : 'Le bailleur ou son mandataire', 'Le locataire'); return pdfEnd(doc, u, ref);
}
/* Branchés sur le mécanisme commun (bouton g6-pdf, droits des membres). */
const _pdfForA4 = pdfFor;
pdfFor = function (name, u) {
  let m;
  if (/^HON-/.test(name)) { if (u.role === 'tenant') return; const f = DB.findItem(DB.K.fees, x => x.ref === name && (u.role === 'admin' || x.ownerId === u.id)); return f && ['finances', pdfFactureHonoraires, f, u.role === 'admin' ? DB.findItem(DB.K.users, f.ownerId) : u]; }
  if ((m = name.match(/^EDL-(.+)$/))) { const e = DB.findItem(DB.K.edl, x => x.id === m[1] && x.ownerId === u.id); return e && ['gestion', pdfEtatDesLieux, e, u]; }
  if ((m = name.match(/^CAU-(.+)$/))) { const l = DB.findItem(DB.K.leases, x => x.id === m[1] && x.ownerId === u.id && +x.deposit > 0); return l && ['gestion', pdfRecuCaution, l, u]; }
  return _pdfForA4(name, u);
};
const btnPdf = (id, txt) => `<button class="btn ghost sm" data-action="g6-pdf" data-id="${esc(id)}">${icon('file', 14)} ${txt}</button>`;
/* Dans « Suivi du bail » : un PDF par état des lieux, et le reçu de caution. */
if (typeof suiviBail === 'function') {
  const _suiviA4 = suiviBail;
  suiviBail = function (u, l) {
    let h = _suiviA4(u, l);
    const e = DB.filterItems(DB.K.edl, x => x.leaseId === l.id).sort((a, b) => a.kind === 'entree' ? -1 : 1);
    const docs = [...e.map(x => btnPdf('EDL-' + x.id, 'EDL ' + (x.kind === 'entree' ? 'entrée' : 'sortie'))), ...(+l.deposit > 0 ? [btnPdf('CAU-' + l.id, l.cautionStatut === 'restituee' ? 'Reçu de restitution' : 'Reçu de caution')] : [])];
    return docs.length ? h.replace(/<\/div>\s*$/, `<div class="suivi-docs" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${docs.join('')}</div></div>`) : h;
  };
}
/* Sur « Honoraires & cautions » : la facture de chaque honoraire. */
function boutonsFactures() {
  if (location.hash.split('?')[0] !== '#/agency/commissions') return;
  document.querySelectorAll('#app table tbody tr:not([data-fac])').forEach(tr => {
    tr.dataset.fac = '1';
    const ref = (tr.querySelector('td b') || {}).textContent || ''; if (!/^HON-/.test(ref)) return;
    const z = tr.querySelector('td:last-child'); if (z) z.insertAdjacentHTML('beforeend', ' ' + btnPdf(ref, 'Facture'));
  });
}
new MutationObserver(() => requestAnimationFrame(() => { try { boutonsFactures(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});

/* --- A5. Un nouveau bien correspond à la demande d'un client --------------
   Les biens qui correspondent à une demande s'affichaient sur la page
   Clients, mais personne n'était prévenu quand un nouveau bien arrivait.
   Désormais, quand un bien en ligne de l'agence correspond à une demande
   active, l'agent qui suit le client (ou l'agence) reçoit une notification,
   une seule fois par bien. Les biens qui correspondaient déjà à la création
   de la demande ne déclenchent pas d'alerte (ils étaient affichés). */
function verifierCorrespondances() {
  let u = null; try { u = Auth.current(); } catch (e) {}
  if (!u || u.role !== 'agency' || typeof biensPour !== 'function') return 0;
  let n = 0;
  DB.filterItems(DB.K.demandes, d => d.ownerId === u.id && d.status !== 'close').forEach(dm => {
    const ok = biensPour(u, dm).filter(p => p.listingStatus === 'publiee');
    if (!Array.isArray(dm.vus)) { DB.updateItem(DB.K.demandes, dm.id, {vus: ok.map(p => p.id)}); return; }
    const neufs = ok.filter(p => !dm.vus.includes(p.id)); if (!neufs.length) return;
    neufs.forEach(p => { notify(dm.agentId || u.id, `Nouveau bien pour ${dm.name} : « ${p.title} » · ${money(p.price)}. Envoyez-le-lui depuis Clients.`, '#/agency/clients?s=Demandes en cours'); n++; });
    DB.updateItem(DB.K.demandes, dm.id, {vus: dm.vus.concat(neufs.map(p => p.id))});
  });
  return n;
}
/* Une demande créée retient les biens déjà proposés. */
const _addItemDemande = DB.addItem;
DB.addItem = function (k, item) {
  const x = _addItemDemande.call(DB, k, item);
  if (k === DB.K.properties) setTimeout(() => { try { verifierCorrespondances(); } catch (e) {} }, 0);
  if (k === DB.K.demandes) setTimeout(() => { try { verifierCorrespondances(); } catch (e) {} }, 0);
  return x;
};
const _updateDemande = DB.updateItem;
DB.updateItem = function (k, id, patch) {
  const x = _updateDemande.call(DB, k, id, patch);
  if (k === DB.K.properties && patch && ('listingStatus' in patch || 'status' in patch || 'price' in patch)) setTimeout(() => { try { verifierCorrespondances(); } catch (e) {} }, 0);
  return x;
};
addEventListener('hashchange', () => { try { verifierCorrespondances(); } catch (e) {} });

/* --- A6. Relevé du mandant : ventes nettes et TVA ; historique conservé ----
   a) Une relation close gardait sa fiche mais ses biens étaient détachés :
      le compte de gestion (qui ne retient que les biens rattachés) ne
      montrait plus l'historique. Les biens de l'ancienne relation sont
      réintégrés pour le relevé, jusqu'à la date de clôture.
   b) Le relevé précise la TVA comprise dans la commission de gestion.
   c) Les ventes conclues par l'agence pour le mandant apparaissent avec le
      prix, les honoraires à la charge du vendeur et le net vendeur. */
if (typeof relevesPour === 'function') {
  relevesPour = function (u, fiche) {
    const base = myProps, filtre = DB.filterItems, fin = fiche.status === 'close' ? fiche.closedAt : null;
    myProps = x => DB.getData(DB.K.properties).filter(p => p.clientOwnerId === fiche.id || p.exClientOwnerId === fiche.id).map(p => p.exClientOwnerId === fiche.id ? {...p, clientOwnerId: fiche.id} : p);
    DB.filterItems = function (k, pred) { const r = filtre.call(DB, k, pred); return fin && (k === DB.K.rents || k === DB.K.fpay || k === DB.K.expenses) ? r.filter(x => String(x.paidAt || x.createdAt || x.date || '').slice(0, 10) <= fin) : r; };
    try { return relevesMandant({...u, ownerRec: fiche.id}) + complementsReleve(fiche); } finally { myProps = base; DB.filterItems = filtre; }
  };
}
function complementsReleve(fiche) {
  const agence = DB.findItem(DB.K.users, fiche.ownerId); if (!agence) return '';
  const R = typeof regles === 'function' ? regles(agence) : {}, c = typeof compteGestion === 'function' ? compteGestion(agence, fiche) : {com: 0};
  const tva = R.tva && R.tvaPct ? Math.round(c.com - c.com / (1 + R.tvaPct / 100)) : 0;
  const biens = new Set(DB.getData(DB.K.properties).filter(p => p.clientOwnerId === fiche.id || p.exClientOwnerId === fiche.id).map(p => p.id));
  const ventes = DB.filterItems(DB.K.deals, d => d.ownerId === agence.id && d.stage === 'signe' && biens.has(d.propertyId)).map(d => {
    const f = DB.findItem(DB.K.fees, x => x.dealId === d.id), prix = typeof prixVente === 'function' ? prixVente(d) : (+d.price || 0);
    const charge = f && f.payer !== 'acquereur' ? f.ttc : 0;
    return {d, p: gProp(d.propertyId) || {}, prix, f, charge, net: prix - charge};
  });
  return `${c.com ? `<p class="small muted" style="margin:14px 0 0">Commission de gestion sur la période : <b>${money(c.com)}</b>${tva ? `, dont TVA ${money(tva)} (${R.tvaPct} %)` : R.tva === false ? ', sans TVA' : ''}.</p>` : ''}
    ${ventes.length ? `<h3 style="margin:24px 0 12px">Ventes conclues par l'agence</h3>` + gTable(['Bien', 'Signée le', 'Prix de vente', 'Honoraires à votre charge', 'Net vendeur'], ventes.map(v => `<tr>
      <td class="small"><b>${esc(v.p.title || '')}</b><br><span class="muted">${esc(v.d.buyer || '')}</span></td><td class="small">${dateFr(v.d.signedAt || v.d.updatedAt)}</td><td>${money(v.prix)}</td>
      <td>${v.f ? (v.f.payer === 'acquereur' ? '<span class="small muted">payés par l\'acquéreur</span>' : money(v.charge) + (v.f.tva ? ` <span class="small muted">dont TVA ${money(v.f.tva)}</span>` : '')) : '<span class="small muted">non facturés</span>'}</td><td><b>${money(v.net)}</b></td></tr>`), ['', '']) +
      `<p class="small muted" style="margin:8px 0 0">Le prix est versé chez le notaire ; les honoraires à la charge du vendeur sont déduits du net qui vous revient.</p>` : ''}`;
}

/* --- A6 d) Reconduction tacite des baux (réglable, désactivée par défaut) --
   Un bail arrivé à échéance sans préavis restait « actif » sans échéances
   au-delà de sa fin : plus aucun loyer n'était attendu. Si le bailleur (ou
   l'agence) l'active, un tel bail est reconduit pour sa durée initiale
   (12 mois au plus) : les échéances sont créées, les parties prévenues, et
   l'opération est journalisée. Sinon, rien ne change. */
const reconductionActive = u => !!(u && (u.regles || {}).reconductionTacite);
function reconduireBaux() {
  let u = null; try { u = Auth.current(); } catch (e) {}
  if (!u || !['owner', 'agency'].includes(u.role) || (u.member && !(u.perms || []).includes('gestion'))) return 0;
  const proprio = DB.findItem(DB.K.users, u.id); if (!reconductionActive(proprio)) return 0;
  let n = 0;
  DB.filterItems(DB.K.leases, l => l.ownerId === u.id && l.status === 'actif' && !l.preavis && leaseEnd(l) < ymd()).forEach(l => {
    const k = Math.min(12, Math.max(1, +l.dureeInitiale || +l.months || 12)), depart = leaseEnd(l);
    if (typeof bailEnConflit === 'function' && bailEnConflit(l.propertyId, l.unitId, depart, k, l.id)) return;
    const deja = new Set(DB.filterItems(DB.K.rents, r => r.leaseId === l.id).map(r => r.month));
    for (let i = l.months; i < l.months + k; i++) { const m = moisCle(l.start, i); if (!deja.has(m)) DB.addItem(DB.K.rents, {ownerId: l.ownerId, leaseId: l.id, month: m, amount: +l.rent, paidAt: null}); }
    DB.updateItem(DB.K.leases, l.id, {months: l.months + k, dureeInitiale: l.dureeInitiale || l.months, reconductions: [...(l.reconductions || []), {le: ymd(), depuis: depart, mois: k}]});
    audit('Bail reconduit tacitement', `${l.tenant} · ${k} mois à partir du ${dateFr(depart)}`);
    notify(u.id, `Bail de ${l.tenant} reconduit tacitement pour ${k} mois (échu le ${dateFr(depart)}, sans préavis).`, '#/manage/leases');
    const loc = typeof locataireDuBail === 'function' && locataireDuBail(l); if (loc) notify(loc.id, `Votre bail est reconduit pour ${k} mois aux mêmes conditions (loyer ${money(l.rent)}).`, '#/tenant/rents');
    n++;
  });
  return n;
}
addEventListener('hashchange', () => { try { reconduireBaux(); } catch (e) {} });
[2500].forEach(t => setTimeout(() => { try { reconduireBaux(); } catch (e) {} }, t));
/* Le réglage : dans les règles de l'agence, et dans le profil du propriétaire. */
function caseReconduction() {
  const u = Auth.current(); if (!u || u.member) return;
  const moi = DB.findItem(DB.K.users, u.id), coche = reconductionActive(moi) ? 'checked' : '';
  const lib = `Reconduction tacite des baux : un bail échu sans préavis est prolongé automatiquement pour sa durée initiale (12 mois au plus), loyers compris`;
  const f = document.querySelector('form[data-action="ag-regles"]');
  if (f && !f.querySelector('[name="reconductionTacite"]')) {
    const btn = f.querySelector('button:not([type=button])');
    btn.insertAdjacentHTML('beforebegin', `<label class="check" style="margin:0 0 14px"><input type="checkbox" name="reconductionTacite" ${coche}> ${lib}</label><br>`);
  }
  if (u.role === 'owner' && location.hash === '#/owner/profile') {
    const c = document.querySelector('#app .content'); if (!c || c.querySelector('form[data-action="regles-proprio"]')) return;
    c.insertAdjacentHTML('beforeend', `<form class="card" data-action="regles-proprio" style="max-width:640px;margin-top:18px" data-sub="Gestion locative"><h4>Mes règles de location</h4>
      <label class="check" style="margin:0 0 14px"><input type="checkbox" name="reconductionTacite" ${coche}> ${lib}</label><br>
      <button class="btn">Enregistrer</button></form>`);
  }
}
new MutationObserver(() => requestAnimationFrame(() => { try { caseReconduction(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-regles"], form[data-action="regles-proprio"]'); if (!f) return;
  const u = Auth.current(); if (!u || u.member) return;
  const v = !!(f.querySelector('[name="reconductionTacite"]') || {}).checked;
  /* Les autres règles de l'agence sont enregistrées par 90-agence-metier.js ;
     on complète ensuite, sans écraser. */
  setTimeout(() => { const moi = DB.findItem(DB.K.users, u.id); DB.updateItem(DB.K.users, u.id, {regles: {...(moi.regles || {}), reconductionTacite: v}}); if (f.dataset.action === 'regles-proprio') { toast('Règles enregistrées.'); render(); } else try { reconduireBaux(); } catch (err) {} }, 0);
  if (f.dataset.action === 'regles-proprio') { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

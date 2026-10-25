/* ==========================================================================
   MODULE : coherence.js — audit logique de l'espace propriétaire.
   Les règles « un bien, un engagement » étaient vérifiées à la création
   d'un dossier ou d'un bail, mais pas aux autres portes : signature d'une
   vente depuis un écran resté ouvert, statut changé à la main dans la liste
   des biens, suppression d'un bien loué, bail antidaté qui chevauche le
   précédent, bail échu impossible à prolonger, identifiant forgé dans un
   formulaire. Ce module ferme ces portes au moment où l'on écrit.

   Les écouteurs sont posés sur `window` en phase de capture : ils passent
   AVANT ceux du document, y compris ceux qui arrêtent la propagation
   (le formulaire de vente, par exemple). Ils ne font que refuser ; quand
   tout est en règle, l'action d'origine s'exécute normalement.

   Limite assumée : tout ceci s'exécute dans le navigateur. En production,
   chaque règle doit être revérifiée par le serveur, dans une transaction
   (voir README, § 80).
   ========================================================================== */

/* --- 0. Outils ------------------------------------------------------------ */
/* Dates 'AAAA-MM-JJ' calculées en UTC : pas de décalage d'un jour selon le fuseau. */
const jourPlus = (d, n) => {
  const [y, m, j] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, j + n)).toISOString().slice(0, 10);
};
const moisCle = (start, i) => {
  const [y, m] = String(start).slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + i, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
function refuser(e, msg, form) {
  e.preventDefault(); e.stopImmediatePropagation();
  if (form) formError(form, msg);
  toast(msg, 'bad');
}
const estGestionnaire = u => u && ['owner', 'agency'].includes(u.role);

/* --- 1. Périodes de bail : pas de chevauchement --------------------------- */
/* Fin effective d'un bail : sa date de fin s'il court encore (même échu,
   le logement reste occupé tant qu'on n'y a pas mis fin), sinon la date de
   départ enregistrée. Un bail terminé avant cette règle n'a pas de date de
   départ : on retient la plus proche entre sa fin prévue et sa clôture. */
function finEffective(l) {
  if (l.status === 'actif') {
    const fin = leaseEnd(l);
    return fin < ymd() ? '9999-12-31' : fin;           // échu mais pas libéré : toujours occupé
  }
  if (l.endedAt) return String(l.endedAt).slice(0, 10);
  return [leaseEnd(l), String(l.updatedAt || '').slice(0, 10)].filter(Boolean).sort()[0];
}
/* Le bail qui occuperait déjà ce logement pendant la période demandée. */
function bailEnConflit(propertyId, unitId, start, months, saufId) {
  const debut = String(start).slice(0, 10), fin = leaseEnd({start: debut, months: +months || 1});
  return DB.getData(DB.K.leases).find(l => l.id !== saufId
    && (unitId ? l.unitId === unitId : l.propertyId === propertyId && !l.unitId)
    && debut < finEffective(l) && fin > String(l.start).slice(0, 10)) || null;
}
const motifChevauchement = l => `Ce logement est occupé par ${l.tenant} jusqu'au ${dateFr(finEffective(l) === '9999-12-31' ? leaseEnd(l) : finEffective(l))}`
  + (l.status === 'actif' ? ' (bail en cours)' : '') + ` : le nouveau bail doit commencer après.`;

window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="g-lease"], form[data-action="g8-lease"]');
  if (!f) return;
  const u = Auth.current(); if (!estGestionnaire(u)) return;
  const d = formData(f);
  if (!d.start || !/^\d{4}-\d{2}-\d{2}/.test(d.start)) return refuser(e, 'Indiquez la date de début du bail.', f);
  let propertyId = d.propertyId, unitId = '';
  if (f.dataset.action === 'g8-lease') {
    const x = DB.findItem(DB.K.units, y => y.id === f.dataset.id && y.ownerId === u.id);
    if (!x) return refuser(e, 'Unité introuvable.', f);
    propertyId = x.propertyId; unitId = x.id;
  }
  if (!myProps(u).some(p => p.id === propertyId)) return refuser(e, 'Choisissez un de vos biens.', f);
  const c = bailEnConflit(propertyId, unitId, d.start, Math.min(36, Math.max(1, +d.months || 1)));
  if (c) refuser(e, motifChevauchement(c), f);
}, true);

/* --- 2. Prolonger un bail ------------------------------------------------- */
/* Règle retenue : même locataire, même logement → le bail est PROLONGÉ
   (avenant : sa durée s'allonge, les nouvelles échéances s'ajoutent à la
   suite, le loyer peut être révisé et l'historique est gardé dans
   `renewals`). Nouveau locataire → nouveau bail, qui ne peut commencer
   qu'après le départ du précédent (§ 1). Un bail échu n'est jamais libéré
   tout seul : le logement reste occupé jusqu'à « Mettre fin ». */
retoucheGestion(['leases'], function (h) {
  return h.replace(/<button class="btn ghost sm" data-action="g-end-lease" data-id="([\w]+)">/g,
    (m, id) => `<button class="btn ghost sm" data-action="g-renew-open" data-id="${id}">Prolonger</button>` + m);
});
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="g-renew-open"]');
  if (!b) return;
  const u = Auth.current(); if (!estGestionnaire(u)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (u.member && !u.perms.includes('gestion')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
  const l = DB.findItem(DB.K.leases, x => x.id === b.dataset.id && x.ownerId === u.id && x.status === 'actif');
  if (!l) return;
  const fin = leaseEnd(l), echu = fin < ymd();
  modal('Prolonger le bail', `<form data-action="g-renew" data-id="${l.id}">
    <p class="small">Bail de <b>${esc(l.tenant)}</b> · ${echu ? `<b style="color:var(--bad)">échu depuis le ${dateFr(fin)}</b>` : `se termine le ${dateFr(fin)}`}.</p>
    <div class="form-grid">
      <div class="field"><label>Prolonger de (mois)</label><input class="input" type="number" min="1" max="36" name="months" value="12" required></div>
      <div class="field"><label>Loyer pendant la prolongation (FCFA)</label><input class="input" type="number" min="1" name="rent" value="${l.rent}" required></div></div>
    <p class="small muted">Les échéances reprennent au mois qui suit la fin actuelle, sans doublon.${echu ? ' Les mois écoulés depuis l\'échéance deviennent exigibles.' : ''}</p>
    <div class="row" style="justify-content:flex-end;gap:10px;margin-top:12px"><button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
    <button class="btn">Prolonger</button></div></form>`);
}, true);
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="g-renew"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!estGestionnaire(u)) return;
  if (u.member && !u.perms.includes('gestion')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
  if (f.dataset.sent) return;
  const l = DB.findItem(DB.K.leases, x => x.id === f.dataset.id && x.ownerId === u.id && x.status === 'actif');
  if (!l) { toast('Bail introuvable ou déjà terminé.', 'bad'); return; }
  const d = formData(f), k = Math.round(+d.months), loyer = Math.round(+d.rent) || l.rent;
  if (!(k >= 1 && k <= 36)) return formError(f, 'La prolongation va de 1 à 36 mois.');
  if (!(loyer > 0)) return formError(f, 'Indiquez le loyer.');
  const depart = leaseEnd(l), c = bailEnConflit(l.propertyId, l.unitId, depart, k, l.id);
  if (c) return formError(f, motifChevauchement(c));
  f.dataset.sent = '1';
  const deja = new Set(DB.filterItems(DB.K.rents, r => r.leaseId === l.id).map(r => r.month));
  let ajoutes = 0;
  for (let i = l.months; i < l.months + k; i++) {
    const m = moisCle(l.start, i);
    if (deja.has(m)) continue;
    DB.addItem(DB.K.rents, {ownerId: l.ownerId, leaseId: l.id, month: m, amount: loyer, paidAt: null});
    ajoutes++;
  }
  DB.updateItem(DB.K.leases, l.id, {months: l.months + k, rent: loyer,
    renewals: [...(l.renewals || []), {at: ymd(), from: depart, months: k, rent: loyer, previousRent: l.rent}]});
  audit('Bail prolongé', `${l.tenant} · +${k} mois · ${money(loyer)}/mois`);
  const t = DB.findItem(DB.K.users, x => x.leaseId === l.id || (Array.isArray(x.leaseIds) && x.leaseIds.includes(l.id)));
  if (t) notify(t.id, `Votre bail est prolongé de ${k} mois, jusqu'au ${dateFr(leaseEnd({start: l.start, months: l.months + k}))}.`, '#/tenant/home');
  closeModal(); toast(`Bail prolongé jusqu'au ${dateFr(leaseEnd({start: l.start, months: l.months + k}))} : ${ajoutes} échéance${ajoutes > 1 ? 's' : ''} ajoutée${ajoutes > 1 ? 's' : ''}.`);
  render();
}, true);

/* --- 3. Ventes : revérifier à la promesse et à la signature -------------- */
function motifEtapeVente(d, etape) {
  const p = gProp(d.propertyId);
  if (!p) return 'Le bien de ce dossier n\'existe plus.';
  if (p.ownerId !== d.ownerId) return 'Ce bien n\'appartient pas au titulaire du dossier.';
  const autreSigne = DB.findItem(DB.K.deals, x => x.id !== d.id && x.propertyId === p.id && x.stage === 'signe');
  if (autreSigne || (p.status === 'vendu' && d.stage !== 'signe')) {
    return `${p.title} est déjà vendu${autreSigne && autreSigne.buyer ? ' à ' + autreSigne.buyer : ''} : ce dossier ne peut plus aboutir.`;
  }
  const baux = bauxDuBien(p);
  if (baux.length) return `${p.title} est loué à ${baux[0].tenant} : mettez fin au bail avant de ${etape === 'signe' ? 'signer la vente' : 'promettre la vente'}.`;
  if (unitesDuBien(p).some(x => x.status === 'occupée')) return `${p.title} a des unités occupées : il ne peut pas être vendu libre.`;
  /* Deux promesses ne coexistent pas ; à la signature, le premier signé l'emporte (règle ci-dessus). */
  const autrePromesse = etape === 'promesse' && DB.findItem(DB.K.deals, x => x.id !== d.id && x.propertyId === p.id && x.stage === 'promesse');
  if (autrePromesse) return `Une promesse de vente est déjà signée avec ${autrePromesse.buyer} pour ${p.title}.`;
  return '';
}
const _franchirEtape = franchirEtape;
franchirEtape = function (d, etape) {
  if (d && (etape === 'signe' || etape === 'promesse')) {
    const m = motifEtapeVente(d, etape);
    if (m) { toast(m, 'bad'); render(); return; }
  }
  return _franchirEtape(d, etape);
};
/* L'ancien tableau des ventes (sélecteur d'étape) passe par la même règle. */
window.addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('[data-action="g-stage"]');
  if (!s || s.value !== 'signe') return;
  const u = Auth.current(), d = u && DB.findItem(DB.K.deals, x => x.id === s.dataset.id && x.ownerId === u.id);
  if (!d) return;
  const m = motifEtapeVente(d, 'signe');
  if (m) { e.stopImmediatePropagation(); toast(m, 'bad'); render(); }
}, true);
/* Un dossier ne s'ouvre que sur un de SES biens, et l'ancien formulaire suit la règle commune. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="v-new"], form[data-action="g-deal"]');
  if (!f) return;
  const u = Auth.current(); if (!estGestionnaire(u)) return;
  const id = formData(f).propertyId;
  if (!id) return;
  if (!myProps(u).some(p => p.id === id)) return refuser(e, 'Choisissez un de vos biens.', f);
  const m = motifIndisponible(gProp(id), 'vente');
  if (m) refuser(e, m, f);
}, true);

/* --- 4. Statut d'un bien : il découle des baux et des ventes ------------ */
function motifStatut(p, v) {
  const baux = bauxDuBien(p), occ = unitesDuBien(p).some(x => x.status === 'occupée');
  const signe = venteConclue(p), ouvert = venteOuverte(p);
  if ((p.status === 'vendu' || signe) && v !== 'vendu') return `${p.title} a été vendu${signe && signe.buyer ? ' à ' + signe.buyer : ''} : son statut ne peut plus changer.`;
  if ((baux.length || occ) && v !== 'loue') return `${p.title} est loué${baux[0] ? ' à ' + baux[0].tenant : ''} : mettez fin au bail (Gestion › Locataires & baux) avant de changer son statut.`;
  if (v === 'vendu' && p.status !== 'vendu') return ouvert ? `Un dossier de vente est en cours avec ${ouvert.buyer} : signez-le depuis le dossier.`
    : `Pour marquer ${p.title} vendu, enregistrez la vente dans Gestion › Ventes : l'acte et la facture sont établis au passage.`;
  if (v === 'loue' && !baux.length && !occ) return `Pour marquer ${p.title} loué, créez son bail dans Gestion › Locataires & baux : l'échéancier des loyers en dépend.`;
  if (v === 'archive' && ouvert) return `Un dossier de vente est en cours avec ${ouvert.buyer} : abandonnez-le ou signez-le d'abord.`;
  return '';
}
window.addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('[data-action="set-status"]');
  if (!s) return;
  const u = Auth.current(), p = u && gProp(s.dataset.id);
  if (!p || p.ownerId !== u.id || p.status === s.value) return;     // l'action d'origine refuse les biens d'autrui
  const m = motifStatut(p, s.value);
  if (m) { e.stopImmediatePropagation(); toast(m, 'bad'); render(); }
}, true);

/* --- 5. Supprimer ou archiver un bien engagé ----------------------------- */
function motifSuppression(p) {
  const baux = bauxDuBien(p);
  if (baux.length || unitesDuBien(p).some(x => x.status === 'occupée')) return `${p.title} est loué${baux[0] ? ' à ' + baux[0].tenant : ''} : mettez fin au bail avant de le supprimer.`;
  const ouvert = venteOuverte(p), signe = venteConclue(p);
  if (ouvert) return `Un dossier de vente est en cours avec ${ouvert.buyer} pour ${p.title}.`;
  if (signe) return `${p.title} a été vendu : il reste dans votre historique avec ses documents. Archivez-le plutôt.`;
  const ids = new Set(DB.filterItems(DB.K.leases, l => l.propertyId === p.id).map(l => l.id));
  const dus = DB.filterItems(DB.K.rents, r => ids.has(r.leaseId) && rRest(r) > 0 && rentState(r)[1] === 'bad');
  if (dus.length) return `${p.title} a ${dus.length} loyer${dus.length > 1 ? 's' : ''} impayé${dus.length > 1 ? 's' : ''} (${money(dus.reduce((s, r) => s + rRest(r), 0))}) : le supprimer effacerait cette créance. Archivez-le plutôt.`;
  const fac = DB.filterItems(DB.K.docs, d => d.type === 'FAC' && d.propertyId === p.id && dRest(d) > 0);
  if (fac.length) return `${p.title} a ${fac.length} facture${fac.length > 1 ? 's' : ''} non soldée${fac.length > 1 ? 's' : ''} : archivez-le plutôt.`;
  return '';
}
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="delete-prop"], [data-action="archive"]');
  if (!b) return;
  const u = Auth.current(), p = u && gProp(b.dataset.id);
  if (!p || p.ownerId !== u.id) return;
  const m = b.dataset.action === 'delete-prop' ? motifSuppression(p) : motifStatut(p, 'archive');
  if (m) refuser(e, m);
}, true);

/* --- 6. Identifiants forgés ---------------------------------------------- */
/* La page d'édition vérifie le propriétaire à l'affichage ; l'écriture le
   vérifie aussi (un data-id modifié dans l'inspecteur ne passe plus). */
const _saveProperty78 = saveProperty;
saveProperty = function (form, id, intent) {
  if (id) {
    const u = Auth.current(), p = DB.findItem(DB.K.properties, id);
    if (!u || !p || p.ownerId !== u.id) { toast('Ce bien ne vous appartient pas.', 'bad'); return; }
  }
  return _saveProperty78(form, id, intent);
};
/* Les membres d'équipe : les ventes relèvent de « gestion », la liste des
   biens de « biens » — y compris pour une action injectée à la main. */
const _permFor78 = permFor;
permFor = function (path) {
  if (/^\/vente\//.test(path)) return 'gestion';
  if (/^\/bien\//.test(path)) return 'biens';
  return _permFor78(path);
};
['click', 'submit', 'change'].forEach(ev => window.addEventListener(ev, e => {
  const el = e.target.closest && e.target.closest('[data-action]'), u = Auth.current();
  if (!el || !u || !u.member) return;
  const a = el.dataset.action;
  const perm = /^v-/.test(a) ? 'gestion' : /^(set-status|delete-prop|archive|pause|publish)$/.test(a) ? 'biens' : '';
  if (perm && !u.perms.includes(perm)) refuser(e, 'Action non autorisée pour votre profil.');
}, true));

/* --- 7. Contrats : renouvellement sans chevauchement --------------------- */
const contratEnConflit = (c, debut, fin) => DB.getData(DB.K.contracts).find(x => x.id !== c.id && x.renewedFrom !== c.id
  && x.ownerId === c.ownerId && x.type === c.type && c.propertyId && x.propertyId === c.propertyId
  && x.status === 'actif' && debut <= x.end && fin >= x.start);
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="g3-renew"], [data-action="g3-activate"]');
  if (!b) return;
  const u = Auth.current(); if (!estGestionnaire(u)) return;
  if (u.member && !u.perms.includes('gestion')) return;             // refusé par le contrôle des rôles
  const c = DB.findItem(DB.K.contracts, x => x.id === b.dataset.id && x.ownerId === u.id);
  if (!c) return;
  if (b.dataset.action === 'g3-activate') {
    const x = contratEnConflit(c, c.start, c.end);
    if (x) refuser(e, `Le contrat ${x.ref} couvre déjà ce bien du ${dateFr(x.start)} au ${dateFr(x.end)}.`);
    return;
  }
  e.preventDefault(); e.stopImmediatePropagation();
  if (!['actif', 'expiré'].includes(c.status)) return;
  /* Le nouveau contrat commence le LENDEMAIN de la fin du précédent et dure autant. */
  const duree = Math.max(1, daysBetween(c.start, c.end)), debut = jourPlus(c.end, 1), fin = jourPlus(debut, duree);
  const x = contratEnConflit(c, debut, fin);
  if (x) { toast(`Le contrat ${x.ref} couvre déjà ce bien sur cette période.`, 'bad'); return; }
  const n = DB.addItem(DB.K.contracts, {...c, id: undefined, createdAt: undefined, updatedAt: undefined,
    ref: nref('CTR', 'contracts'), start: debut, end: fin, status: 'actif', renewedFrom: c.id});
  DB.updateItem(DB.K.contracts, c.id, {status: 'renouvelé'});
  audit('Contrat renouvelé', `${c.ref} → ${n.ref}`); render();
  autoFileThen('contract', n, `Renouvelé : ${n.ref}, du ${dateFr(debut)} au ${dateFr(fin)}`);
}, true);


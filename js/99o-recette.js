/* ==========================================================================
   99o-recette.js — corrections issues de la recette du 22 novembre 2026
   (fichiers tests/uat/*_TESTE.xlsx). Chargé après tous les autres modules.

   1. Session expirée : les fonctions serveur (gerer-acces, assistant-ia)
      renouvellent la session puis, si elle est perdue, le disent clairement ;
      « Se déconnecter » déconnecte toujours, même si le serveur refuse.
   2. Documents : identité complète de l'émetteur (adresse, NINEA, RCCM) sur
      les aperçus et les PDF ; HT / TVA / TTC ; la TVA suit le devis jusqu'à
      la facture ; un devis accepté peut devenir directement une facture.
   3. Compte du mandant : une facture de l'agence n'est plus comptée comme
      un loyer encaissé pour le propriétaire (sauf si elle est faite pour lui).
   4. Espace du mandant : ses biens en lecture seule, avec le bail et les loyers.
   5. Honoraires de location créés à chaque nouveau bail d'agence ; la caution
      n'est « détenue » qu'une fois reçue.
   6. Revenus par mois : les acomptes comptent ; finances de l'agence : le
      résultat est la commission, pas les loyers des mandants.
   7. Comptes ouverts par un tiers : « Nouveau mot de passe », droits d'un
      membre modifiables, journal juste.
   ========================================================================== */

/* --- 1. Session ------------------------------------------------------------ */
const SESSION_PERDUE = 'Votre session a expiré. Reconnectez-vous pour continuer (vos données sont enregistrées).';
let sessionPerdueSignalee = false;
async function sessionPerdue() {
  if (sessionPerdueSignalee) return; sessionPerdueSignalee = true;
  try { closeModal(); } catch (e) {}
  try { sessionStorage.setItem('deuksil_login_motif', SESSION_PERDUE); } catch (e) {}
  try { await Auth.logout(true); } catch (e) {}
  sessionPerdueSignalee = false;
  go('#/login'); toast(SESSION_PERDUE, 'bad');
}
const estRefusSession = (error, corps) => {
  const st = error && error.context && error.context.status;
  return st === 401 || /401|Session invalide|JWT|expired|Connexion requise/i.test(String((corps && corps.message) || (error && error.message) || ''));
};
/* Toutes les fonctions serveur passent par SB.functions.invoke : un refus pour
   session périmée est réessayé une fois après renouvellement du jeton. */
if (typeof SB !== 'undefined' && SB && SB.functions && !SB.functions.__recette) {
  const _invoke = SB.functions.invoke.bind(SB.functions);
  SB.functions.__recette = true;
  SB.functions.invoke = async function (nom, opts) {
    let r = await _invoke(nom, opts);
    if (!r.error || !DB.session) return r;
    let corps = null; try { corps = await r.error.context.clone().json(); } catch (e) {}
    if (!estRefusSession(r.error, corps)) return r;
    let ok = false;
    try { const {data, error} = await SB.auth.refreshSession(); ok = !error && data && data.session; if (ok) DB.session = data.session; } catch (e) {}
    if (ok) { r = await _invoke(nom, opts); if (!r.error) return r; try { corps = await r.error.context.clone().json(); } catch (e) { corps = null; } if (!estRefusSession(r.error, corps)) return r; }
    setTimeout(sessionPerdue, 0);
    const err = new Error(SESSION_PERDUE); err.context = {status: 401, json: async () => ({message: SESSION_PERDUE}), clone() { return this; }};
    return {data: null, error: err};
  };
}
/* Déconnexion : la session locale est effacée quoi que réponde le serveur
   (403 « session introuvable » quand elle a déjà été révoquée). */
Auth.logout = (function (prec) {
  return async function (silencieux) {
    try { closeModal(); } catch (e) {}
    try { resetSessionUiState(); } catch (e) {}
    try { await Promise.race([DB.attendre(), new Promise(ok => setTimeout(ok, 4000))]); } catch (e) {}
    this.enCours = true;
    try {
      let r = null; try { r = await SB.auth.signOut(); } catch (e) { r = {error: e}; }
      if (r && r.error) { try { await SB.auth.signOut({scope: 'local'}); } catch (e) {} }
      try { Object.keys(localStorage).filter(k => k === 'deuksil-auth' || /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      DB.session = null;
      try { await DB.charger(); } catch (e) { console.warn('[DEUKSIL] rechargement après déconnexion', e); }
    } finally { this.enCours = false; }
    if (!silencieux) { go('#/'); toast('Vous êtes déconnecté.'); }
  };
})(Auth.logout);
/* Les surcouches de déconnexion des modules IA (fermeture du panneau) restent
   appliquées : elles appellent Auth.logout, désormais fiable. */

/* Messages de l'assistant quand la session est perdue : plus « Connectez-vous »
   alors qu'on l'est (la session est renouvelée ou l'on est renvoyé à la connexion). */

/* --- 2. Documents ------------------------------------------------------------ */
const titulaireDe = u => (u && u.member && u.member.parentId ? DB.findItem(DB.K.users, u.member.parentId) : null) || (u && u.parentId ? DB.findItem(DB.K.users, u.parentId) : null) || u;
issuer = function (u) {
  const T = titulaireDe(u) || u || {}, i = T.docInfo || u.docInfo || {};
  return {name: i.name || ownerLabel(u), address: i.address || T.address || '', phone: i.phone || T.phone || u.phone || '', email: i.email || T.email || '',
    ninea: i.ninea || T.ninea || '', rccm: i.rccm || T.rccm || '', bank: i.bank || '', terms: i.terms || ''};
};
function blocEmetteur(u) {
  const I = issuer(u), L = [I.address, I.phone && 'Tél. ' + I.phone, I.email, [I.ninea && 'NINEA ' + I.ninea, I.rccm && 'RCCM ' + I.rccm].filter(Boolean).join(' · ')].filter(Boolean);
  return `<div><b style="font-size:1.25em">${esc(I.name)}</b>${L.map(l => `<br><small>${esc(l)}</small>`).join('')}</div>`;
}
const pourCompteDe = p => { const f = p && p.clientOwnerId && DB.findItem(DB.K.owners, p.clientOwnerId); return f ? f.name : ''; };
const montantsDoc = d => {
  const brut = (d.items || []).reduce((t, i) => t + (+i.qty || 0) * (+i.price || 0), 0), remise = Math.round(brut * (+d.discount || 0) / 100), ht = brut - remise;
  return {brut, remise, ht, tva: dTot(d) - ht, ttc: dTot(d)};
};
docHtml = function (d, u) {
  const p = gProp(d.propertyId), cr = dCred(d), pd = dPaid(d), m = montantsDoc(d), mandant = pourCompteDe(p);
  const ligne = (l, v, b) => `<tr><td style="padding:3px 0">${b ? '<b>' + l + '</b>' : l}</td><td align=right style="padding:3px 0">${b ? '<b>' + v + '</b>' : v}</td></tr>`;
  return `<div style="font-family:sans-serif;color:#0C2745"><div style="display:flex;justify-content:space-between;gap:16px">${blocEmetteur(u)}
    <div style="text-align:right"><b style="font-size:1.2em">${DT[d.type].toUpperCase()}</b><br>${esc(d.ref)}<br><small>${dateFr(d.createdAt)}${d.type === 'FAC' ? ' · échéance ' + dateFr(d.due) : ''}</small></div></div>
    <p><b>Client :</b> ${esc(d.client)}${d.clientPhone ? ' · ' + esc(d.clientPhone) : ''}${p ? '<br><b>Bien :</b> ' + esc(p.title) : ''}${mandant && d.pourMandant ? `<br><small>Pour le compte de ${esc(mandant)}</small>` : ''}</p>
    <table style="width:100%;border-collapse:collapse"><tr style="background:#eee"><th align=left>Désignation</th><th>Qté</th><th align=right>P.U. HT</th><th align=right>Total HT</th></tr>
    ${(d.items || []).map(i => `<tr><td>${esc(i.label)}</td><td align=center>${i.qty}</td><td align=right>${money(i.price)}</td><td align=right>${money(i.qty * i.price)}</td></tr>`).join('')}</table>
    <table style="margin:10px 0 0 auto;min-width:260px">${m.remise ? ligne('Total brut HT', money(m.brut)) + ligne(`Remise ${d.discount} %`, '−' + money(m.remise)) : ''}
      ${ligne('Total HT', money(m.ht))}${d.tax ? ligne(`TVA ${d.tax} %`, money(m.tva)) : ligne('TVA', 'non applicable')}${ligne('Total TTC', money(m.ttc), true)}
      ${d.type === 'FAC' ? `${cr ? ligne('Avoirs', '−' + money(cr)) : ''}${ligne('Déjà payé', money(pd))}${ligne('Reste à payer', money(dRest(d)), true)}` : ''}</table>
    <small>Paiement : espèces, virement, Wave, Orange Money. ${d.type === 'DEV' || d.type === 'PF' ? 'Document non contractuel avant acceptation.' : ''}</small></div>`;
};
/* La TVA (et le téléphone du client) suivent le devis jusqu'à la facture. */
mkDoc = (function (prec) {
  return function (u, type, o) {
    o = {...o};
    if (o.parentId && type !== 'AV') {
      const par = DB.findItem(DB.K.docs, o.parentId);
      if (par) { if (o.tax == null && par.tax) o.tax = par.tax; if (!o.clientPhone && par.clientPhone) o.clientPhone = par.clientPhone; if (o.pourMandant == null && par.pourMandant) o.pourMandant = true; }
    }
    return prec(u, type, o);
  };
})(mkDoc);
/* Devis accepté : « → Facture » directement, sans passer par la proforma. */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="rc-dev-fac"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(), d = u && DB.findItem(DB.K.docs, x => x.id === b.dataset.id && x.ownerId === (u.member ? u.member.parentId : u.id));
  if (!d || d.type !== 'DEV' || d.status !== 'accepté' || hasChild(d)) return;
  const n = mkDoc(u, 'FAC', {client: d.client, propertyId: d.propertyId, items: d.items, discount: d.discount, parentId: d.id, status: 'émise'});
  render(); toast(`Facture ${n.ref} créée à partir du devis ${d.ref}.`);
  try { autoFileThen('doc', n, `${n.ref} créée à partir de ${d.ref}`); } catch (x) {}
});
function retoucherListeDocs() {
  if (!/^#\/manage\/docs/.test(location.hash)) return;
  document.querySelectorAll('#app [data-action="g2-next"][data-id]:not([data-rc])').forEach(b => {
    b.dataset.rc = '1';
    const d = DB.findItem(DB.K.docs, b.dataset.id); if (!d) return;
    if (d.type === 'DEV') { b.textContent = '→ Proforma'; b.classList.add('ghost'); b.insertAdjacentHTML('beforebegin', `<button class="btn sm" data-action="rc-dev-fac" data-id="${d.id}" title="Le client a accepté : créer la facture">→ Facture</button>`); }
  });
}

/* Quittance : émetteur complet, propriétaire pour le compte duquel l'agence encaisse, montant réellement payé. */
gReceipt = function (r) {
  const l = DB.findItem(DB.K.leases, r.leaseId) || {}, p = gProp(l.propertyId), u = Auth.current(), paye = rPaid(r) || (r.paidAt ? +r.amount : 0);
  const mandant = pourCompteDe(p), bailleur = issuer(u).name, partiel = !r.paidAt && paye < +r.amount;
  const body = `${blocEmetteur(u)}<h2 style="margin-top:18px">${partiel ? 'Reçu d\'acompte' : 'Quittance de loyer'}</h2><p><b>Période :</b> ${monthLabel(r.month)}</p>
    <p>${esc(bailleur)}${mandant ? `, agissant pour le compte de <b>${esc(mandant)}</b> (propriétaire),` : ''} reconnaît avoir reçu de <b>${esc(l.tenant || '')}</b> la somme de <b>${money(paye)}</b>${partiel ? ` sur un loyer de ${money(r.amount)} (reste ${money(r.amount - paye)})` : ''} au titre du loyer de « ${esc(p ? p.title : '')} »${r.paidAt ? `, payé le ${dateFr(r.paidAt)}` : ''}.</p>
    <p>Fait à ${esc(p ? p.city : 'Dakar')}, le ${dateFr(r.paidAt || now())}.</p><p>Signature : ${esc(bailleur)}</p>`;
  modal(partiel ? 'Reçu d\'acompte' : 'Quittance', `<div class="card pad-s">${body}</div><div class="row" style="margin-top:12px;gap:8px">${dlLink('', 'QUIT-' + r.id)}<button class="btn ghost" data-action="close-modal">Fermer</button></div>`);
};
mandateHtml = (function (prec) {
  return function (m, u) {
    const I = issuer(u), comp = [I.address, I.phone && 'tél. ' + I.phone, I.ninea && 'NINEA ' + I.ninea, I.rccm && 'RCCM ' + I.rccm].filter(Boolean).join(', ');
    let h = prec(m, u);
    if (comp) h = h.replace(/(<b>Le mandataire :<\/b> [^<]*)/, `$1, ${esc(comp)}`);
    if (m.status !== 'actif' && m.endedAt) h = h.replace(/au (\d{2} \S+ \d{4})\./, `au $1 (résilié le ${dateFr(m.endedAt)}).`);
    return h;
  };
})(mandateHtml);

/* --- 3. Compte du mandant : ce qui est encaissé POUR lui ------------------------
   Une facture de l'agence (honoraires, client tiers) rattachée à un bien du
   mandant n'est pas son argent. Seules les factures marquées « pour le compte
   du propriétaire » (case du formulaire) entrent dans son compte. */
const pourLeMandant = x => { const d = DB.findItem(DB.K.docs, x.docId); return !!(d && d.pourMandant); };
ownerBalance = (function (prec) {
  return function (u, o, month) {
    const b = prec(u, o, month); if (!month) return b;
    const ids = new Set(myProps(u).filter(p => p.clientOwnerId === o.id).map(p => p.id));
    const exclu = horsVentes(gMine('fpay', u)).filter(x => ids.has(x.propertyId) && String(x.createdAt || '').slice(0, 7) === month && !pourLeMandant(x)).reduce((s, x) => s + (+x.amount || 0), 0);
    if (!exclu) return b;
    const encaisse = Math.max(0, b.encaisse - exclu), com = Math.round(encaisse * (b.rate || 0) / 100);
    return {...b, encaisse, com, net: encaisse - b.dep - com};
  };
})(ownerBalance);
/* Case « pour le compte du propriétaire » dans le formulaire d'un document d'agence. */
function caseMandantDoc() {
  const f = document.querySelector('.modal form[data-action="g2-save-doc"]:not([data-rc])'); if (!f) return;
  f.dataset.rc = '1';
  const u = Auth.current(); if (!u || u.role !== 'agency') return;
  const sel = f.querySelector('select[name="propertyId"]'); if (!sel) return;
  const z = document.createElement('label'); z.className = 'small rc-pm'; z.style.cssText = 'display:none;margin:4px 0 10px;gap:8px;align-items:center';
  z.innerHTML = '<input type="checkbox" name="pourMandant"> Facture émise pour le compte du propriétaire (son argent : comptée dans son relevé)';
  sel.closest('.field').after(z);
  const maj = () => { const p = gProp(sel.value); z.style.display = p && p.clientOwnerId ? 'flex' : 'none'; };
  sel.addEventListener('change', maj); maj();
  /* TVA : pré-remplie avec le taux de l'agence et total affiché pendant la saisie. */
  if (!f.querySelector('[name="tax"]')) {
    const R = typeof regles === 'function' ? regles(u) : {}, taux = R.tva && R.tvaPct ? R.tvaPct : 0;
    const d = f.querySelector('[name="discount"]'); if (d) d.closest('.field').insertAdjacentHTML('afterend', `<div class="field"><label>TVA (%)</label><input class="input" type="number" min="0" max="30" step="0.5" name="tax" value="${taux}"></div>`);
  }
  const tot = document.createElement('p'); tot.className = 'small rc-total'; tot.style.cssText = 'margin:6px 0 10px;text-align:right';
  f.querySelector('button.btn.block, button.btn:last-of-type').before(tot);
  const calc = () => { const v = n => +((f.querySelector(`[name="${n}"]`) || {}).value || 0); let ht = 0; for (let i = 0; i < 6; i++) ht += v('q' + i) * v('p' + i);
    ht = Math.round(ht * (1 - v('discount') / 100)); const tva = Math.round(ht * v('tax') / 100); tot.innerHTML = `Total HT <b>${money(ht)}</b> · TVA ${money(tva)} · <b>Total TTC ${money(ht + tva)}</b>`; };
  f.addEventListener('input', calc); calc();
}
/* Le formulaire d'origine ignore la TVA et la case : on les reporte sur le document créé. */
let docSaisi = null;
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="g2-save-doc"]'); if (!f) return;
  const t = f.querySelector('[name="tax"]'), c = f.querySelector('[name="pourMandant"]');
  docSaisi = {tax: t ? Math.max(0, +t.value || 0) : null, pourMandant: !!(c && c.checked && c.closest('label').style.display !== 'none')};
  setTimeout(() => { docSaisi = null; }, 0);
}, true);
DB.addItem = (function (prec) {
  return function (k, item) {
    if (k === DB.K.docs && docSaisi && item && !item.parentId) { item = {...item}; if (docSaisi.tax != null && item.tax == null) item.tax = docSaisi.tax; if (docSaisi.pourMandant) item.pourMandant = true; }
    return prec.call(DB, k, item);
  };
})(DB.addItem);

/* --- 4. Espace du mandant : ses biens, en lecture seule ------------------------ */
const bauxDuBienConfie = id => DB.filterItems(DB.K.leases, l => l.propertyId === id).sort((a, b) => String(b.start).localeCompare(String(a.start)));
function carteBienConfie(p) {
  const bail = bauxDuBienConfie(p.id).find(l => l.status === 'actif'), rents = bail ? DB.filterItems(DB.K.rents, r => r.leaseId === bail.id) : [];
  const retard = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad').reduce((s, r) => s + rRest(r), 0);
  return `<a class="card rc-bien" href="#/mandant/bien/${p.id}">
    <div class="photo rc-bien-ph">${p.photos && p.photos[0] ? `<img src="${esc(typeof photoBien === 'function' ? photoBien(p, 0, 's') : p.photos[0])}" alt="" loading="lazy">` : icon('home', 28)}</div>
    <div style="min-width:0;flex:1"><div class="row-between" style="gap:8px;align-items:flex-start"><b>${esc(p.title)}</b>${badge(STATUS_LABEL[p.status] || p.status, STATUS_TONE[p.status] || '')}</div>
      <div class="small muted">${esc([p.quartier, p.city].filter(Boolean).join(', '))} · ${money(p.price)}${p.transaction === 'location' ? ' / mois' : ''}</div>
      <div class="small" style="margin-top:6px">${bail ? `${icon('user', 13)} Locataire : <b>${esc(bail.tenant)}</b> · loyer ${money(bail.rent)}${retard ? ` · <span style="color:var(--bad)">${money(retard)} en retard</span>` : ''}` : '<span class="muted">Pas de bail en cours</span>'}</div></div>
    ${icon('arrowRight', 18)}</a>`;
}
function pageBiensConfies(u) {
  const biens = myProps(u), fiche = DB.findItem(DB.K.owners, u.ownerRec) || {}, agence = DB.findItem(DB.K.users, fiche.ownerId) || {};
  return page('Mes biens confiés', `Gérés par ${esc(agence.agencyName || 'votre agence')} : consultez leur situation, vos relevés et vos documents.`, `<a class="btn ghost" href="#/mandant/releves">${icon('money', 16)} Mes relevés</a>`) +
    (biens.length ? `<div class="stack" style="gap:12px">${biens.map(carteBienConfie).join('')}</div>`
      : `<div class="empty"><b>Aucun bien rattaché pour l'instant</b><p class="small">Votre agence rattache vos biens à votre fiche. Contactez-la si un bien manque.</p></div>`) +
    `<p class="small muted" style="margin-top:16px">${icon('info', 14)} La mise en ligne, les prix et les baux sont gérés par votre agence. Pour un changement, écrivez-lui depuis Messages.</p>`;
}
function pageBienConfie(u, p) {
  const baux = bauxDuBienConfie(p.id), fiche = DB.findItem(DB.K.owners, u.ownerRec) || {}, agence = DB.findItem(DB.K.users, fiche.ownerId) || {};
  const ligneBail = l => {
    const R = DB.filterItems(DB.K.rents, r => r.leaseId === l.id).sort((a, b) => a.month < b.month ? 1 : -1);
    return `<div class="card" style="margin-top:14px"><div class="row-between" style="flex-wrap:wrap;gap:8px"><h3 style="margin:0">Bail de ${esc(l.tenant)}</h3>${badge(l.status === 'actif' ? 'En cours' : 'Terminé', l.status === 'actif' ? 'ok' : '')}</div>
      <div class="grid rc-infos" style="margin-top:12px">${[['Loyer', money(l.rent) + ' / mois'], ['Caution', +l.deposit ? money(l.deposit) : 'Aucune'], ['Début', dateFr(l.start)], ['Fin', dateFr(leaseEnd(l))], ['Échéance', 'le ' + (l.dueDay || 5) + ' du mois']]
        .map(([a, b]) => `<div><div class="small muted">${a}</div><b>${b}</b></div>`).join('')}</div>
      ${R.length ? `<h4 style="margin:16px 0 8px">Loyers</h4>` + gTable(['Mois', 'Loyer', 'Encaissé', 'État'], R.map(r => { const [lab, t] = rentState(r); return `<tr><td class="small">${monthLabel(r.month)}</td><td>${money(r.amount)}</td><td>${money(rPaid(r))}</td><td>${badge(lab, t)}</td></tr>`; }), ['', '']) : ''}</div>`;
  };
  const deps = DB.filterItems(DB.K.expenses, x => x.propertyId === p.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `<a class="small" href="#/owner/properties">${icon('arrowLeft', 14)} Mes biens confiés</a>` +
    page(esc(p.title), `${esc([p.quartier, p.commune, p.city].filter((x, i, a) => x && a.indexOf(x) === i).join(', '))} · géré par ${esc(agence.agencyName || 'votre agence')}`,
      p.listingStatus === 'publiee' ? `<a class="btn ghost" href="#/property/${p.id}">${icon('eye', 16)} Voir l'annonce</a>` : '') +
    `<div class="kpis">${kpi(STATUS_LABEL[p.status] || p.status, 'Situation')}${kpi(money(p.price), p.transaction === 'location' ? 'Loyer affiché' : 'Prix affiché')}${kpi(p.views || 0, 'Vues de l\'annonce')}</div>` +
    (baux.length ? baux.map(ligneBail).join('') : `<div class="empty" style="margin-top:14px"><b>Pas de bail sur ce bien</b><p class="small">Votre agence recherche un locataire ou le bien est en vente.</p></div>`) +
    (deps.length ? `<h3 style="margin:22px 0 10px">Dépenses engagées</h3>` + gTable(['Date', 'Nature', 'Montant'], deps.map(x => `<tr><td class="small">${dateFr(x.date)}</td><td class="small">${esc(capitaliser(x.cat || ''))} · ${esc(x.supplier || '')}</td><td>${money(x.amount)}</td></tr>`), ['', '']) : '') +
    `<p class="small muted" style="margin-top:16px">Ces informations viennent de votre agence. Le détail de l'argent encaissé et reversé est dans <a href="#/mandant/releves">Mes relevés</a>.</p>`;
}
const capitaliser = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
route(/^\/mandant\/bien\/([\w-]+)$/, id => {
  const u = Auth.current(); if (!u || !estMandant(u)) { go(u ? Auth.home(u) : '#/login'); return false; }
  const p = myProps(u).find(x => x.id === id);
  if (!p) { toast('Ce bien n\'est pas rattaché à votre fiche.', 'bad'); go('#/owner/properties'); return false; }
  return shellApp(u, pageBienConfie(u, p));
});
/* « Mes biens », « Ouvrir », « Modifier » : pour un mandant, la version lecture seule. */
(() => {
  const avant = (src, f) => { const r = routes.find(x => x.re.source === src); if (r) { const g = r.fn; r.fn = (...a) => f(g, ...a); } };
  avant('^\\/owner\\/properties$', (g, ...a) => { const u = Auth.current(); return estMandant(u) ? shellApp(u, pageBiensConfies(u)) : g(...a); });
  const versLecture = (g, id, ...a) => { const u = Auth.current(); if (estMandant(u) && id && id !== 'new') { go('#/mandant/bien/' + id); return false; }
    if (estMandant(u)) { toast('Vos biens sont ajoutés par votre agence.', 'warn'); go('#/owner/properties'); return false; } return g(id, ...a); };
  avant('^\\/owner\\/property\\/(new|[\\w-]+)$', versLecture);
  avant('^\\/bien\\/([\\w-]+)(?:\\/(apercu|unites|finances|travaux|docs|suivi))?$', versLecture);
})();

/* --- 5. Honoraires de location et caution ------------------------------------ */
/* Tout nouveau bail d'une agence (formulaire Locataires, Unités › Louer, assistant)
   reçoit ses frais de location ; la caution est « attendue » jusqu'à sa réception. */
let bauxEnCreation = 0;
DB.addItem = (function (prec) {
  return function (k, item) {
    if (k === DB.K.leases && item && !DB.findItem(DB.K.leases, item.id || '')) bauxEnCreation++;
    const x = prec.call(DB, k, item);
    if (k === DB.K.leases && x && bauxEnCreation) {
      bauxEnCreation--;
      try {
        const owner = DB.findItem(DB.K.users, x.ownerId);
        if (owner && owner.role === 'agency') {
          const l = DB.findItem(DB.K.leases, x.id);
          if (l && +l.deposit > 0 && (!l.cautionStatut || l.cautionStatut === 'detenue') && !l.cautionRecue) DB.updateItem(DB.K.leases, l.id, {cautionChez: l.cautionChez || regles(owner).caution, cautionStatut: 'attendue'});
          if (!feesDe(owner).some(f => f.leaseId === x.id)) honoraireBail(owner, DB.findItem(DB.K.leases, x.id));
        }
      } catch (e) { console.warn('[DEUKSIL] honoraires du bail', e); }
    }
    /* Journal : « Membre créé » seulement une fois le compte réellement ouvert. */
    if (k === DB.K.audit && item && item.action === 'Membre créé' && dernierMembre) {
      const id = dernierMembre; dernierMembre = null;
      (async () => { await DB.attendre(); if (DB.findItem(DB.K.users, id)) prec.call(DB, k, item); })();
      return item;
    }
    if (k === DB.K.users && item && item.mdpProvisoire && (item.parentId || item.ownerRef || item.mandantOf)) dernierMembre = x && x.id;
    return x;
  };
})(DB.addItem);
let dernierMembre = null;
cautionDe = (function (prec) { return (u, l) => { const c = prec(u, l); return c; }; })(cautionDe);
/* Cautions « détenues » : seulement celles reçues. */
function cautionAttendue(l) { return l && l.cautionStatut === 'attendue' && +l.deposit > 0; }
suiviBail = (function (prec) {
  return function (u, l) {
    let h = prec(u, l);
    if (cautionAttendue(l)) h = h.replace(/(<b>Caution<\/b><span>)[^<]*(<\/span><\/div>)(<button[^>]*data-action="ag-caution"[^>]*>[^<]*<\/button>)?/,
      `$1${money(l.deposit)} attendus : pas encore reçue$2<button class="btn sm" data-action="rc-caution-recue" data-id="${l.id}">Caution reçue</button>`);
    return h;
  };
})(suiviBail);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="rc-caution-recue"]'); if (!b) return;
  e.preventDefault(); const u = Auth.current(), l = u && DB.findItem(DB.K.leases, b.dataset.id); if (!l) return;
  confirmDialog({title: 'Caution reçue', message: `Confirmez la réception de la caution de ${money(l.deposit)} versée par ${l.tenant}.`, confirmLabel: 'Confirmer la réception', onConfirm: () => {
    DB.updateItem(DB.K.leases, l.id, {cautionStatut: 'detenue', cautionRecue: now()}); audit('Caution reçue', `${l.tenant} · ${money(l.deposit)}`); toast('Caution enregistrée comme reçue.'); render(); }});
});

/* --- 6. Rapports et finances ---------------------------------------------------- */
/* Revenus par mois / par bien : les loyers comptent à la date de chaque versement (acomptes compris). */
repData = (function (prec) {
  return function (u, type, y) {
    const r = prec(u, type, y);
    if (!['revenus', 'revenus_bien'].includes(type) || !r || !r.rows) return r;
    const Y = String(y), lp = id => (DB.findItem(DB.K.leases, id) || {}).propertyId;
    const vers = gMine('rents', u).flatMap(x => rPays(x).map(p => ({leaseId: x.leaseId, date: String(p.date || ''), amount: +p.amount || 0}))).filter(v => v.date.startsWith(Y));
    if (type === 'revenus') r.rows.forEach((row, i) => { const k = `${Y}-${String(i + 1).padStart(2, '0')}`; row[1] = vers.filter(v => v.date.startsWith(k)).reduce((s, v) => s + v.amount, 0); row[3] = row[1] + row[2]; });
    else { const props = myProps(u); r.rows.forEach((row, i) => { const p = props[i]; if (!p || row[0] !== p.title) return; row[1] = vers.filter(v => lp(v.leaseId) === p.id).reduce((s, v) => s + v.amount, 0); row[3] = row[1] + row[2]; }); }
    r.total = [r.total[0], ...[1, 2, 3].map(i => r.rows.reduce((s, row) => s + (+row[i] || 0), 0))];
    return r;
  };
})(repData);
/* Finances d'une agence : l'argent des mandants n'est pas son résultat. */
function kpisFinanceAgence(u) {
  const props = myProps(u), mand = new Set(props.filter(p => p.clientOwnerId).map(p => p.id)), lp = id => (DB.findItem(DB.K.leases, id) || {}).propertyId;
  const docs = gMine('docs', u).filter(d => d.type === 'FAC'), pays = horsVentes(gMine('fpay', u));
  const loyers = gMine('rents', u).flatMap(r => rPays(r).map(p => ({bien: lp(r.leaseId), m: +p.amount || 0})));
  const pourMandants = loyers.filter(x => mand.has(x.bien)).reduce((s, x) => s + x.m, 0) + pays.filter(p => pourLeMandant(p)).reduce((s, p) => s + p.amount, 0);
  const propres = loyers.filter(x => !mand.has(x.bien)).reduce((s, x) => s + x.m, 0);
  const factAgence = pays.filter(p => !pourLeMandant(p)).reduce((s, p) => s + p.amount, 0);
  const com = gMine('owners', u).reduce((s, o) => s + compteGestion(u, o).com, 0);
  const hono = (typeof feesDe === 'function' ? feesDe(u) : []).filter(f => f.status === 'paye' && !gMine('fpay', u).some(p => p.feeId === f.id)).reduce((s, f) => s + (+f.ttc || 0), 0);
  const dep = gMine('expenses', u).filter(x => !mand.has(x.propertyId)).reduce((s, x) => s + x.amount, 0) + gMine('tickets', u).filter(t => !t.expenseId && !mand.has(t.propertyId)).reduce((s, t) => s + (+t.cost || 0), 0);
  const impayes = docs.reduce((s, d) => s + dRest(d), 0) + gMine('rents', u).filter(r => !r.paidAt && rentState(r)[1] === 'bad').reduce((s, r) => s + rRest(r), 0);
  const revenus = com + factAgence + propres + hono;
  return `<div class="kpis">${kpi(money(docs.reduce((s, d) => s + dTot(d) - dCred(d), 0)), 'Facturé par l\'agence')}${kpi(money(pourMandants), 'Encaissé pour les mandants')}
    ${kpi(money(revenus), 'Revenus de l\'agence', 'ok')}${kpi(money(impayes), 'Impayés', 'bad')}${kpi(money(dep), 'Dépenses de l\'agence')}${kpi(money(revenus - dep), 'Résultat de l\'agence', 'brand')}</div>
    <p class="small muted" style="margin:10px 0 0">Revenus de l'agence = commissions de gestion (${money(com)}) + factures encaissées (${money(factAgence)}) + honoraires (${money(hono)})${propres ? ` + loyers de vos propres biens (${money(propres)})` : ''}. Les loyers encaissés pour les mandants leur reviennent (voir Reversements).</p>`;
}
retoucheGestion(['finance'], function (h, u) {
  if (!u || u.role !== 'agency' && !(u.member && (DB.findItem(DB.K.users, u.member.parentId) || {}).role === 'agency')) return h;
  const T = u.member ? DB.findItem(DB.K.users, u.member.parentId) : u;
  return h.replace(/<div class="kpis">[\s\S]*?<\/div>\s*(?=<div class="card")/, kpisFinanceAgence(T));
});
/* Accueil de la Gestion : compteurs justes. */
if (typeof GMETA === 'object') {
  if (GMETA.contracts) GMETA.contracts[2] = u => { const n = gMine('contracts', u).filter(c => c.status === 'actif').length + gMine('leases', u).filter(l => l.status === 'actif').length + gMine('mandates', u).filter(m => m.status === 'actif').length; return n + ' actif(s) (baux et mandats compris)'; };
  if (GMETA.transfers) GMETA.transfers[2] = u => { const s = gMine('owners', u).reduce((t, o) => t + Math.max(0, compteGestion(u, o).solde), 0); return s ? money(s) + ' à reverser' : 'Rien en attente'; };
}

/* --- 7. Comptes ouverts par un tiers --------------------------------------------- */
/* « Nouveau mot de passe » sur chaque compte que l'on a ouvert (membre d'équipe,
   locataire, mandant). La fonction serveur accepte toujours pour un membre de
   l'équipe ; pour un locataire ou un mandant, tant qu'il n'a pas choisi le sien. */
function boutonsComptesOuverts() {
  const u = Auth.current(); if (!u || u.member || !['owner', 'agency'].includes(u.role)) return;
  document.querySelectorAll('#app [data-action="g4-del"][data-id]:not([data-rc]), #app [data-action="g4-toggle"][data-id]:not([data-rc]), #app [data-action="ag-attribuer"][data-id]:not([data-rc])').forEach(b => {
    b.dataset.rc = '1';
    const c = DB.findItem(DB.K.users, b.dataset.id); if (!c || !createurDe(c, u)) return;
    const ligne = b.closest('tr') || b.parentElement;
    if (!ligne.querySelector('[data-action="mdp-regenerer"]')) b.insertAdjacentHTML('beforebegin', `<button class="btn ghost sm" data-action="mdp-regenerer" data-id="${c.id}" title="Générer un nouveau mot de passe provisoire pour ${esc(c.firstName || '')}">${icon('key', 14)} Nouveau mot de passe</button>`);
    if (c.parentId === u.id && !ligne.querySelector('[data-action="rc-droits"]')) b.insertAdjacentHTML('beforebegin', `<button class="btn ghost sm" data-action="rc-droits" data-id="${c.id}">${icon('settings', 14)} Droits</button>`);
  });
}
/* Le bouton existant refusait d'avance quand le compte n'était plus « provisoire » :
   on laisse le serveur décider (il accepte pour l'équipe) et l'on explique sinon. */
window.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-action="mdp-regenerer"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(), c = DB.findItem(DB.K.users, b.dataset.id);
  if (!u || u.member || !createurDe(c, u)) return toast('Action non autorisée.', 'bad');
  confirmDialog({title: 'Nouveau mot de passe provisoire', message: `Un nouveau mot de passe sera créé pour ${displayName(c)} ; l'ancien ne fonctionnera plus. ${c.firstName || 'La personne'} choisira le sien à la connexion.`, confirmLabel: 'Créer le mot de passe', onConfirm: async () => {
    try {
      const r = await appelerFonction('gerer-acces', {action: 'mot-de-passe', id: c.id});
      DB.updateItem(DB.K.users, c.id, {mdpProvisoire: true});
      audit('Mot de passe provisoire régénéré', displayName(c));
      montrerMotDePasseProvisoire(c, r.motDePasse);
    } catch (err) {
      const m = String(err.message || '');
      toast(/a choisi son mot de passe/.test(m) ? `${c.firstName || 'Cette personne'} a déjà choisi son mot de passe : elle peut utiliser « Mot de passe oublié » sur la page de connexion.` : m || 'Action impossible.', 'bad');
    }
  }});
}, true);
/* Droits d'un membre : modifiables après la création. */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="rc-droits"]'); if (!b) return;
  e.preventDefault(); const u = Auth.current(), m = DB.findItem(DB.K.users, b.dataset.id); if (!u || !m || m.parentId !== u.id) return;
  modal(`Droits de ${esc(displayName(m))}`, `<form data-action="rc-droits-ok" data-id="${m.id}"><p class="small muted">Cochez ce que ${esc(m.firstName || 'ce membre')} peut faire. L'administration du compte et l'équipe restent à vous.</p>
    <div class="field"><label>Rôle</label><select class="input" name="role"><option value="manager" ${m.role === 'manager' ? 'selected' : ''}>Gestionnaire</option><option value="agent" ${m.role === 'agent' ? 'selected' : ''}>Agent</option></select></div>
    <div class="stack" style="gap:8px;margin:10px 0 16px">${Object.entries(PERMS).map(([k, v]) => `<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="perm_${k}" ${(m.perms || []).includes(k) ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</div>
    <button class="btn block">Enregistrer les droits</button></form>`);
});
document.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="rc-droits-ok"]'); if (!f) return;
  e.preventDefault(); const u = Auth.current(), m = DB.findItem(DB.K.users, f.dataset.id); if (!u || !m || m.parentId !== u.id) return;
  const d = formData(f), perms = Object.keys(PERMS).filter(k => d['perm_' + k]), role = ['manager', 'agent'].includes(d.role) ? d.role : m.role;
  DB.updateItem(DB.K.users, m.id, {perms, role}); audit('Droits modifiés', `${displayName(m)} : ${perms.map(k => PERMS[k]).join(', ') || 'aucun'}`);
  closeModal(); toast(`Droits de ${m.firstName || 'ce membre'} enregistrés : ils s'appliquent à sa prochaine action.`); render();
});
/* L'adresse de connexion affichée dans la fiche d'identifiants est celle du site utilisé (99n-menus-cni.js). */

/* --- 8. Locataire ---------------------------------------------------------------- */
Auth.home = (function (prec) { return function (u) { return u && u.role === 'tenant' && u.leaseId ? '#/tenant/home' : prec.call(this, u); }; })(Auth.home);
if (Array.isArray(MENUS_RAW.tenant) && !MENUS_RAW.tenant.some(m => m[0] === '#/tenant/payments')) {
  const i = MENUS_RAW.tenant.findIndex(m => m[0] === '#/tenant/rents');
  MENUS_RAW.tenant.splice(i >= 0 ? i + 1 : 2, 0, ['#/tenant/payments', 'Mes paiements', 'card']);
}
bandeauRetard = function () {
  const u = Auth.current(); if (!u || u.role !== 'tenant' || !u.leaseId) return;
  const c = document.querySelector('.main > .content'); if (!c || c.querySelector('.retard-bandeau')) return;
  if (!/^#\/tenant\/(home|rents)/.test(location.hash)) return;
  const dus = DB.filterItems(DB.K.rents, r => r.leaseId === u.leaseId && !r.paidAt).filter(r => rentState(r)[1] === 'bad'); if (!dus.length) return;
  const total = dus.reduce((s, r) => s + rRest(r), 0), relance = dus.find(r => r.remindedAt);
  const d = document.createElement('div'); d.className = 'retard-bandeau';
  d.innerHTML = `<span class="rb-ic">${icon('alert', 18)}</span><div style="min-width:0"><b>${dus.length} loyer${dus.length > 1 ? 's' : ''} en retard · <span class="rb-montant">${money(total)}</span> à régler</b>
    <div class="small">${relance ? `Votre bailleur vous a relancé le ${dateFr(relance.remindedAt)}.` : 'Réglez auprès de votre bailleur, qui enregistrera le paiement.'}</div></div><a class="btn sm" href="#/tenant/messages" style="margin-left:auto">Le contacter</a>`;
  c.prepend(d);
};
/* Bailleur réel (propriétaire mandant) et caution sur « Mon logement » ; contrat du bail. */
function blocBailLocataire(u) {
  const l = DB.findItem(DB.K.leases, u.leaseId); if (!l) return '';
  const p = gProp(l.propertyId) || {}, bailleur = DB.findItem(DB.K.users, l.ownerId) || {}, mandant = pourCompteDe(p);
  const nomB = bailleur.role === 'agency' ? bailleur.agencyName : displayName(bailleur);
  const C = typeof cautionDe === 'function' ? cautionDe(bailleur, l) : {statut: ''}, cau = +l.deposit > 0 ? (C.statut === 'restituee' ? `${money(l.cautionRendue || 0)} rendus le ${dateFr(l.cautionRendueLe)}` : C.statut === 'attendue' ? `${money(l.deposit)} · à verser` : `${money(l.deposit)} · versée`) : 'Aucune';
  return `<div class="card rc-bail-loc" style="margin-top:18px"><h3 style="margin:0 0 12px">Mon bail</h3><div class="grid rc-infos">
    ${[['Logement', esc(p.title || '')], ['Adresse', esc([p.quartier, p.city].filter(Boolean).join(', '))], ['Loyer', money(l.rent) + ' / mois'], ['Échéance', 'le ' + (l.dueDay || 5) + ' du mois'], ['Caution', cau],
       ['Période', `${dateFr(l.start)} → ${dateFr(leaseEnd(l))}`], [mandant ? 'Propriétaire' : 'Bailleur', esc(mandant || nomB || '') + (!mandant && bailleur.role === 'agency' ? ' (agence)' : '')], ...(mandant ? [['Géré par', esc(nomB || '')]] : [])]
      .map(([a, b]) => `<div><div class="small muted">${a}</div><b>${b}</b></div>`).join('')}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-action="g6-pdf" data-id="BAIL-${l.id}">${icon('file', 16)} Mon contrat de bail (PDF)</button><a class="btn ghost" href="#/tenant/payments">${icon('card', 16)} Mes paiements</a></div></div>`;
}
/* Contrat de location tiré du bail (PDF) : pour le locataire comme pour le bailleur. */
pdfFor = (function (prec) {
  return function (name, u) {
    const m = /^BAIL-([\w-]+)$/.exec(name);
    if (!m) return prec(name, u);
    const l = DB.findItem(DB.K.leases, m[1]); if (!l) return;
    const T = titulaireDe(u);
    if (!(u.role === 'admin' || (u.role === 'tenant' && (u.leaseIds || [u.leaseId]).includes(l.id)) || l.ownerId === (T && T.id))) return;
    const ref = 'BAIL-' + String(l.id).slice(0, 8).toUpperCase();
    const c = {type: 'location', ref, party: l.tenant, start: l.start, end: leaseEnd(l), amount: l.rent, deposit: l.deposit, charges: l.charges || 0, propertyId: l.propertyId, status: l.status === 'actif' ? 'actif' : 'résilié', createdAt: l.createdAt || l.start, conditions: pourCompteDe(gProp(l.propertyId)) ? `Le Bailleur agit en qualité de mandataire de ${pourCompteDe(gProp(l.propertyId))}, propriétaire du bien.` : ''};
    return ['gestion', (x, iss) => { const f = pdfContract(x, iss); f.name = ref + '.pdf'; return f; }, c, DB.findItem(DB.K.users, l.ownerId) || u];
  };
})(pdfFor);
/* Maintenance : description, urgence, photo ; confirmation claire. */
function formulaireTicket() {
  const f = document.querySelector('#app form[data-action="t-ticket"]:not([data-rc])'); if (!f) return;
  f.dataset.rc = '1';
  const cat = f.querySelector('[name="category"]'); if (!cat) return;
  cat.closest('.field').insertAdjacentHTML('afterend', `<div class="field"><label>Urgence</label><select class="input" name="priority"><option value="normale">Normale</option><option value="urgente">Urgente (fuite, panne d'électricité, sécurité)</option><option value="faible">Peut attendre</option></select></div>
    <div class="field"><label>Décrivez le problème</label><textarea class="input" name="note" rows="3" maxlength="2000" placeholder="Où ? Depuis quand ? Ce que vous avez constaté."></textarea></div>
    <div class="field"><label>Photo (facultatif)</label><input class="input" type="file" name="photo" accept="image/*"></div>`);
}
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="t-ticket"]'); if (!f || !f.dataset.rc) return;
  const u = Auth.current(); if (!u || u.role !== 'tenant') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const l = DB.findItem(DB.K.leases, u.leaseId), d = formData(f), t = String(d.title || '').trim(); if (!l || !t) return;
  const envoyer = photo => {
    DB.addItem(DB.K.tickets, {ownerId: l.ownerId, propertyId: l.propertyId, title: t, category: MCAT.includes(d.category) ? d.category : 'Autre', priority: ['urgente', 'faible'].includes(d.priority) ? d.priority : 'normale',
      note: String(d.note || '').trim().slice(0, 2000), photo: photo || '', cost: 0, status: 'nouvelle', tenantId: u.id});
    notify(l.ownerId, `${d.priority === 'urgente' ? 'URGENT · ' : ''}Maintenance signalée par ${u.firstName} : ${t}`, '#/manage/tickets');
    modal('Demande envoyée', `<p>Votre bailleur a reçu votre signalement « <b>${esc(t)}</b> ».</p><p class="small muted">Vous suivez son avancement sur cette page (Nouvelle → En cours → Terminée) et vous serez prévenu à chaque étape.</p><button class="btn block" data-action="close-modal">Compris</button>`);
    render();
  };
  const fic = f.querySelector('[name="photo"]').files[0];
  if (!fic) return envoyer('');
  if (fic.size > 8e6) return toast('Photo trop lourde (8 Mo au plus).', 'bad');
  const r = new FileReader(); r.onload = () => envoyer(r.result); r.onerror = () => envoyer(''); r.readAsDataURL(fic);
}, true);

/* --- 9. Retouches après chaque affichage ---------------------------------------- */
function retouchesRecette() {
  const u = Auth.current(); if (!u) return;
  retoucherListeDocs(); caseMandantDoc(); boutonsComptesOuverts(); formulaireTicket();
  if (u.role === 'tenant') {
    const c = document.querySelector('.main > .content');
    if (c && /^#\/tenant\/home/.test(location.hash) && !c.querySelector('.rc-bail-loc')) { const k = c.querySelector('.kpis'); const h = blocBailLocataire(u); if (h) (k || c.lastElementChild || c).insertAdjacentHTML(k ? 'afterend' : 'beforeend', h); }
    /* « Client » → « Locataire » dans le cadre de l'espace et le profil. */
    document.querySelectorAll('.side-user .small.muted, .topbar .crumb').forEach(x => { if (/\bClient\b/.test(x.textContent)) x.textContent = x.textContent.replace(/\bClient\b/, 'Locataire'); });
    if (/^#\/client\/profile/.test(location.hash)) document.querySelectorAll('#app b, #app span, #app td, #app div').forEach(x => { if (x.children.length === 0 && x.textContent.trim() === 'Client') x.textContent = 'Locataire'; });
    if (/Espace Client/.test(document.title)) document.title = document.title.replace('Espace Client', 'Espace Locataire');
    /* Caution : « versée » seulement si elle l'est. */
    if (/^#\/tenant\/payments/.test(location.hash)) { const l = DB.findItem(DB.K.leases, u.leaseId); if (l && cautionAttendue(l)) document.querySelectorAll('#app .kpis > *').forEach(k => { if (/Caution versée/.test(k.textContent)) k.innerHTML = k.innerHTML.replace('Caution versée', 'Caution (à verser)'); }); }
  }
}
if (typeof MutationObserver === 'function' && document.body) {
  let prevu = false;
  new MutationObserver(() => { if (prevu) return; prevu = true; requestAnimationFrame(() => { prevu = false; try { retouchesRecette(); } catch (e) { console.warn('[DEUKSIL] retouches', e); } }); })
    .observe(document.body, {childList: true, subtree: true});
}

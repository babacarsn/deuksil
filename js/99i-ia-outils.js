/* ==========================================================================
   99i-ia-outils.js — Outils de l'assistant DEUKSIL dans les écrans :
   1. rédaction d'annonce            (formulaire d'un bien)
   2. relance d'impayé               (Gestion → Loyers)
   3. rapport du mois / relevé       (Gestion, Gestion → Rapports)
   4. rapprochement demandes / biens (Agence → Clients)
   5. estimation de prix             (formulaire d'un bien)
   6. aide à la modération           (Administration → Modération des annonces)
   7. résumé d'une conversation      (Messagerie)
   8. lecture d'une facture / reçu   (Gestion → Dépenses)
   Chaque outil calcule d'abord ce qu'il peut sans IA (chiffres, comparables,
   signaux) ; l'IA rédige ou explique. Rien n'est enregistré sans un clic de
   l'utilisateur. Les consignes sont fixées par la fonction serveur
   « assistant-ia » (mode « tache »), qui vérifie la connexion, le rôle et
   l'offre payante pour les données personnelles.
   ========================================================================== */
/* sansAccents (86-portraits) : minuscules, sans accents. */
const IAO_TAB = s => sansAccents(String(s || ""));
const iaoMed = L => { const a = L.filter(x => Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return 0; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const iaoQ = (L, q) => { const a = L.filter(x => Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return 0; const i = (a.length - 1) * q, b = Math.floor(i); return a[b] + (a[Math.min(b + 1, a.length - 1)] - a[b]) * (i - b); };
const iaoArr = n => Math.round(n / 5000) * 5000;
const iaoTel = t => { const w = String(t || '').replace(/\D/g, ''); return w.length === 9 ? '221' + w : w; };

/* --- Appel de l'outil côté serveur ---------------------------------------- */
async function iaoTache(tache, donnees, extra = {}) {
  if (typeof SB === 'undefined' || !SB) { const e = new Error('Assistant indisponible.'); e.code = 'hors'; throw e; }
  return iaAppeler({mode: 'tache', tache, donnees, ...extra});
}
function iaoJson(t) {
  const s = String(t || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(s); } catch (e) { const m = s.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw e; }
}
const iaoErreur = e => e && (e.code === 'gestion_off' || e.code === 'connexion' || e.code === 413 || /réservé|Image invalide|Trop de/.test(e.message || ''))
  ? e.message : 'L\'assistant ne répond pas pour le moment. Réessayez dans un instant.';
const iaoAttente = txt => `<div class="row ia-att" style="gap:8px;align-items:center"><span class="ai-dots"><i></i><i></i><i></i></span><span class="small muted">${esc(txt)}</span></div>`;
const iaoBtn = (attr, label) => `<button type="button" class="btn ghost sm ia-btn" ${attr}>${icon('sparkle', 14)} ${esc(label)}</button>`;
function iaoCopier(txt, btn) {
  const ok = () => { if (btn) { const t = btn.textContent; btn.textContent = 'Copié'; setTimeout(() => { btn.textContent = t; }, 1500); } };
  try { navigator.clipboard.writeText(txt).then(ok, () => toast('Sélectionnez le texte puis copiez-le.', 'warn')); } catch (e) { toast('Sélectionnez le texte puis copiez-le.', 'warn'); }
}
const iaoMoi = () => { const u = Auth.current(); return u ? (u.role === 'agency' ? (u.agencyName || displayName(u)) : `${u.firstName} ${u.lastName}`) : ''; };
const iaoGestion = (u, k) => !!u && ['owner', 'agency'].includes(u.role) && !u.ownerRec && iaPeut(u, k);

/* ===== 1. Rédaction d'annonce ============================================ */
function iaoFormBien(f) {
  const d = new FormData(f), g = k => (d.get(k) || '').toString().trim();
  return {transaction: g('transaction'), type: g('type'), titre_actuel: g('title'), notes: g('description').slice(0, 2000),
    prix: +g('price') || null, surface: +g('surface') || null, region: g('region'), ville: g('city'), commune: g('commune'), quartier: g('quartier'),
    chambres: +g('rooms') || 0, salles_de_bain: +g('baths') || 0, equipements: d.getAll('amenities'), disponible_le: g('availableFrom')};
}
async function iaoAnnonce(f) {
  const v = iaoFormBien(f);
  if (!v.type || !v.ville) return toast('Indiquez au moins le type de bien et la ville.', 'warn');
  modal('Rédiger l\'annonce', `<div id="iao-annonce">${iaoAttente('L\'assistant rédige le titre et la description…')}</div>`);
  try {
    const r = iaoJson(await iaoTache('annonce', v));
    const box = $('#iao-annonce'); if (!box) return;
    box.innerHTML = `<div class="field"><label for="iao-titre">Titre proposé</label><input class="input" id="iao-titre" value="${esc(r.titre || '')}" maxlength="90"></div>
      <div class="field"><label for="iao-desc">Description proposée</label><textarea id="iao-desc" rows="10">${esc(r.description || '')}</textarea></div>
      <p class="small muted">Relisez et corrigez : l'annonce reste sous votre responsabilité.</p>
      <div class="row" style="gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-iao="fermer">Annuler</button><button type="button" class="btn" data-iao="annonce-ok">Utiliser ce texte</button></div>`;
    box.querySelector('[data-iao="annonce-ok"]').onclick = () => {
      const t = f.querySelector('[name="title"]'), ds = f.querySelector('[name="description"]');
      if (t) { t.value = $('#iao-titre').value; t.dispatchEvent(new Event('input', {bubbles: true})); }
      if (ds) { ds.value = $('#iao-desc').value; ds.dispatchEvent(new Event('input', {bubbles: true})); }
      closeModal(); toast('Titre et description remplis. Pensez à enregistrer.');
    };
  } catch (e) { const box = $('#iao-annonce'); if (box) box.innerHTML = `<p>${esc(iaoErreur(e))}</p>`; }
}

/* ===== 5. Estimation de prix ============================================== */
function iaoComparables(v, exclureId) {
  const ville = IAO_TAB(v.ville), quartier = IAO_TAB(v.quartier), type = IAO_TAB(v.type);
  return DB.getData(DB.K.properties).filter(p => p.id !== exclureId && +p.price > 0 && p.transaction === v.transaction
      && IAO_TAB(p.type) === type && IAO_TAB(p.city) === ville && !['brouillon', 'refusee'].includes(p.listingStatus))
    .map(p => {
      let score = 0;
      if (quartier && IAO_TAB(p.quartier) === quartier) score += 3;
      if (v.surface && +p.surface) score += Math.max(0, 2 - Math.abs(+p.surface - v.surface) / v.surface * 4);
      if (v.chambres && +p.rooms) score += Math.max(0, 1 - Math.abs(+p.rooms - v.chambres) / 2);
      return {p, score};
    }).sort((a, b) => b.score - a.score).slice(0, 15).map(x => x.p);
}
function iaoEstimLocale(v, C) {
  if (!C.length) return null;
  const parM2 = C.filter(p => +p.surface > 0).map(p => p.price / p.surface);
  if (v.surface && parM2.length >= 2) return {min: iaoArr(iaoQ(parM2, .25) * v.surface), max: iaoArr(iaoQ(parM2, .75) * v.surface), base: `${parM2.length} annonces, prix au m² médian ${money(Math.round(iaoMed(parM2)))}`};
  const prix = C.map(p => +p.price);
  return {min: iaoArr(iaoQ(prix, .25)), max: iaoArr(iaoQ(prix, .75)), base: `${prix.length} annonces, prix médian ${money(Math.round(iaoMed(prix)))}`};
}
async function iaoEstimer(f) {
  const v = iaoFormBien(f), C = iaoComparables(v, f.dataset.id), loc = iaoEstimLocale(v, C);
  const unite = v.transaction === 'location' ? ' / mois' : '';
  modal('Estimer le prix', `<div id="iao-estim">
    ${loc ? `<div class="card" style="margin-bottom:12px"><b>Fourchette calculée : ${money(loc.min)} – ${money(loc.max)}${unite}</b><div class="small muted">D'après ${esc(loc.base)} de même type à ${esc(v.ville)} sur DEUKSIL.</div></div>`
      : `<p>Pas encore d'annonce comparable (même type, même ville, même transaction) sur DEUKSIL : impossible d'estimer pour l'instant.</p>`}
    <div id="iao-estim-ia">${C.length ? iaoAttente('L\'assistant analyse les comparables…') : ''}</div>
    <p class="small muted" style="margin-top:10px">Fourchette indicative tirée des annonces DEUKSIL, pas une expertise immobilière.</p></div>`);
  if (!C.length) return;
  const comp = C.map(p => ({titre: p.title, quartier: p.quartier, surface: +p.surface || null, chambres: +p.rooms || 0, prix: +p.price, statut: p.status}));
  try {
    const r = iaoJson(await iaoTache('estimation', {bien: v, comparables: comp, statistiques: loc}));
    const box = $('#iao-estim-ia'); if (!box) return;
    const min = iaoArr(+r.min || 0), max = iaoArr(+r.max || 0);
    box.innerHTML = `<div class="card"><b>Avis de l'assistant : ${min && max ? `${money(min)} – ${money(max)}${unite}` : 'fourchette non déterminée'}</b>
      <div class="small muted">Fiabilité : ${esc(r.fiabilite || '—')}</div><p class="small" style="margin:8px 0 0">${esc(r.explication || '')}</p>
      ${min && max ? `<div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn sm" data-iao="prix" data-v="${Math.round((min + max) / 2)}">Mettre ${money(Math.round((min + max) / 2))} dans le prix</button></div>` : ''}</div>`;
    const b = box.querySelector('[data-iao="prix"]'); if (b) b.onclick = () => { const i = f.querySelector('[name="price"]'); if (i) { i.value = b.dataset.v; i.dispatchEvent(new Event('input', {bubbles: true})); } closeModal(); toast('Prix rempli : vous pouvez l\'ajuster.'); };
  } catch (e) { const box = $('#iao-estim-ia'); if (box) box.innerHTML = `<p class="small muted">${esc(iaoErreur(e))}</p>`; }
}

/* ===== 2. Relance d'impayé ================================================ */
function iaoRelanceLocale(d) {
  return `Bonjour ${d.locataire},\n\nSauf erreur de notre part, ${d.mois_impayes.length > 1 ? `les loyers de ${d.mois_impayes.join(', ')} restent` : `le loyer de ${d.mois_impayes[0]} reste`} à régler, soit ${money(d.reste_du)} pour ${d.bien}.\n`
    + `Merci de procéder au règlement ou de me contacter pour convenir d'une solution.\n\nCordialement,\n${d.bailleur}`;
}
async function iaoRelance(id) {
  const u = Auth.current(), r = DB.findItem(DB.K.rents, id); if (!u || !r) return;
  const l = DB.findItem(DB.K.leases, r.leaseId) || {}, du = DB.filterItems(DB.K.rents, x => x.leaseId === r.leaseId && !x.paidAt && rentState(x)[1] === 'bad').sort((a, b) => a.month < b.month ? -1 : 1);
  const d = {locataire: String(l.tenant || 'Madame, Monsieur').split(' ')[0], bien: (gProp(l.propertyId) || {}).title || 'le logement', bailleur: iaoMoi(),
    mois_impayes: du.map(x => monthLabel(x.month)), reste_du: du.reduce((s, x) => s + x.amount - rPaid(x), 0),
    jours_de_retard: du.length ? Math.max(0, daysBetween(du[0].month + '-05', ymd())) : 0, relances_deja_faites: du.reduce((m, x) => Math.max(m, +x.reminders || 0), 0)};
  modal('Message de relance', `<div id="iao-rel">${iaoAttente('L\'assistant rédige un message adapté au retard…')}</div>`);
  let txt, note = '';
  try { txt = (await iaoTache('relance', d)).trim(); } catch (e) { txt = iaoRelanceLocale(d); note = iaoErreur(e) + ' Voici un modèle à adapter.'; }
  const box = $('#iao-rel'); if (!box) return;
  const tel = iaoTel(l.phone), loc = typeof locataireDuBail === 'function' ? locataireDuBail(l) : null;
  box.innerHTML = `${note ? `<p class="small muted">${esc(note)}</p>` : ''}<p class="small muted">${esc(l.tenant || '')} · ${d.mois_impayes.length} loyer(s) en retard · ${money(d.reste_du)}</p>
    <textarea id="iao-rel-txt" rows="9">${esc(txt)}</textarea>
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px">
      <button type="button" class="btn ghost sm" data-iao="copier">Copier</button>
      ${tel ? `<a class="btn ghost sm" id="iao-wa" target="_blank" rel="noopener" href="#">${icon('phone', 14)} WhatsApp</a>` : ''}
      ${loc ? `<button type="button" class="btn sm" data-iao="rel-envoyer">Envoyer dans son espace</button>` : ''}</div>
    ${loc ? '' : '<p class="small muted" style="margin-top:8px">Ce locataire n\'a pas encore d\'accès à son espace : utilisez WhatsApp ou copiez le message.</p>'}`;
  const ta = $('#iao-rel-txt');
  box.querySelector('[data-iao="copier"]').onclick = e => iaoCopier(ta.value, e.currentTarget);
  const wa = $('#iao-wa'); if (wa) { const maj = () => { wa.href = `https://wa.me/${tel}?text=${encodeURIComponent(ta.value)}`; }; maj(); ta.addEventListener('input', maj); }
  const env = box.querySelector('[data-iao="rel-envoyer"]');
  if (env) env.onclick = () => {
    du.forEach(x => DB.updateItem(DB.K.rents, x.id, {remindedAt: now(), reminders: (+x.reminders || 0) + 1}));
    DB.addItem(DB.K.tmsgs, {leaseId: l.id, from: 'owner', read: false, text: ta.value.trim()});
    notify(loc.id, `Rappel de loyer : ${money(d.reste_du)} restent à régler.`, '#/tenant/rents');
    closeModal(); toast(`Relance envoyée à ${loc.firstName} dans son espace.`); render();
  };
}

/* ===== 3. Rapport du mois / relevé d'un mandant ========================== */
function iaoChiffres(u, mois) {
  const R = gMine('rents', u).filter(r => r.month === mois), D = gMine('docs', u).filter(d => d.type === 'FAC');
  return {loyers_attendus: R.reduce((s, r) => s + r.amount, 0), loyers_encaisses: R.reduce((s, r) => s + rPaid(r), 0),
    impayes_cumules: gMine('rents', u).filter(r => !r.paidAt && rentState(r)[1] === 'bad').reduce((s, r) => s + r.amount - rPaid(r), 0),
    factures_a_encaisser: D.filter(d => dRest(d) > 0).reduce((s, d) => s + dRest(d), 0),
    depenses_du_mois: gMine('expenses', u).filter(x => (x.date || '').startsWith(mois)).reduce((s, x) => s + x.amount, 0)};
}
function iaoRapport() {
  const u = Auth.current(); if (!iaoGestion(u, 'rents')) return;
  const mois = [0, 1, 2].map(i => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });
  const owners = u.role === 'agency' && iaPeut(u, 'owners') ? gMine('owners', u) : [];
  modal('Rapport du mois', `<div class="form-grid">
      <div class="field"><label for="iao-mois">Mois</label><select class="input" id="iao-mois">${mois.map(m => `<option value="${m}">${esc(monthLabel(m))}</option>`).join('')}</select></div>
      ${owners.length ? `<div class="field"><label for="iao-pour">Pour</label><select class="input" id="iao-pour"><option value="">Tout mon espace</option>${owners.map(o => `<option value="${o.id}">Relevé de ${esc(o.name)}</option>`).join('')}</select></div>` : ''}</div>
    <button type="button" class="btn" data-iao="rapport-go">${icon('sparkle', 15)} Préparer le rapport</button><div id="iao-rap" style="margin-top:14px"></div>`);
  $('[data-iao="rapport-go"]').onclick = async () => {
    const m = $('#iao-mois').value, oid = ($('#iao-pour') || {}).value, box = $('#iao-rap');
    let tache, donnees, entete;
    if (oid) {
      const o = DB.findItem(DB.K.owners, oid), b = ownerBalance(u, o, m), ids = myProps(u).filter(p => p.clientOwnerId === o.id).map(p => p.id);
      const tr = gMine('transfers', u).filter(t => t.ownerId2 === o.id);
      donnees = {agence: iaoMoi(), proprietaire: o.name, periode: monthLabel(m), taux_commission: b.rate, encaisse: b.encaisse, depenses: b.dep, commission: b.com, net: b.net,
        deja_reverse_ce_mois: tr.filter(t => t.month === m).reduce((s, t) => s + t.amount, 0),
        trois_derniers_mois: mois.map(k => ({mois: monthLabel(k), ...ownerBalance(u, o, k)})),
        biens: myProps(u).filter(p => ids.includes(p.id)).map(p => ({titre: p.title, statut: STATUS_LABEL[p.status] || p.status})),
        loyers_en_retard: gMine('rents', u).filter(r => ids.includes((DB.findItem(DB.K.leases, r.leaseId) || {}).propertyId) && !r.paidAt && rentState(r)[1] === 'bad').map(r => ({mois: r.month, montant: r.amount - rPaid(r)}))};
      tache = 'releve'; entete = `<div class="kpis">${kpi(money(b.encaisse), 'Encaissé')}${kpi(money(b.dep), 'Dépenses')}${kpi(money(b.com), 'Commission')}${kpi(money(b.net), 'Net propriétaire', 'brand')}</div>`;
    } else {
      const c = iaoChiffres(u, m);
      donnees = {mois: monthLabel(m), chiffres_du_mois: c, espace: iaContexte(u)}; tache = 'rapport';
      entete = `<div class="kpis">${kpi(money(c.loyers_encaisses) + ' / ' + money(c.loyers_attendus), 'Loyers encaissés / attendus')}${kpi(money(c.impayes_cumules), 'Impayés cumulés', c.impayes_cumules ? 'bad' : 'ok')}${kpi(money(c.factures_a_encaisser), 'Factures à encaisser')}${kpi(money(c.depenses_du_mois), 'Dépenses du mois')}</div>`;
    }
    box.innerHTML = entete + `<div id="iao-rap-txt" style="margin-top:12px">${iaoAttente('L\'assistant rédige le rapport…')}</div>`;
    try {
      const t = await iaoTache(tache, donnees), z = $('#iao-rap-txt'); if (!z) return;
      z.innerHTML = `<textarea id="iao-rap-ta" rows="14">${esc(t.trim())}</textarea><div class="row" style="justify-content:flex-end;margin-top:8px"><button type="button" class="btn ghost sm" data-iao="copier">Copier</button></div>`;
      z.querySelector('[data-iao="copier"]').onclick = e => iaoCopier($('#iao-rap-ta').value, e.currentTarget);
    } catch (e) { const z = $('#iao-rap-txt'); if (z) z.innerHTML = `<p class="small muted">${esc(iaoErreur(e))} Les chiffres ci-dessus sont calculés par DEUKSIL.</p>`; }
  };
}

/* ===== 4. Rapprochement demandes / biens (agence) ======================== */
async function iaoRapprocher(dmId) {
  const u = Auth.current(), dm = DB.findItem(DB.K.demandes, dmId); if (!u || !dm) return;
  const lieu = IAO_TAB(dm.lieu || '').trim(), type = IAO_TAB(dm.type || '');
  const C = DB.getData(DB.K.properties).filter(p => !['vendu', 'loue', 'archive'].includes(p.status) && ['publiee', 'pause'].includes(p.listingStatus || 'publiee')
      && (dm.transaction === 'location' ? p.transaction === 'location' : p.transaction !== 'location'))
    .map(p => { let s = 0; if (type && IAO_TAB(p.type) === type) s += 3; if (lieu && IAO_TAB([p.quartier, p.city, p.commune].join(' ')).includes(lieu)) s += 3;
      if (+dm.budget) s += +p.price <= +dm.budget ? 2 : +p.price <= +dm.budget * 1.2 ? 0.5 : -3; if (+dm.rooms) s += +p.rooms >= +dm.rooms ? 1 : -1; if (p.ownerId === u.id) s += 0.5; return {p, s}; })
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 15).map(x => x.p);
  modal(`Biens pour ${dm.name}`, `<div id="iao-rap2">${C.length ? iaoAttente('L\'assistant compare les biens à la demande…') : '<p>Aucun bien disponible ne s\'approche de cette demande pour l\'instant.</p>'}</div>`);
  if (!C.length) return;
  const ligne = (p, raison, ecart) => `<div class="card" style="padding:12px;margin-bottom:8px"><a href="#/property/${p.id}" data-iao="fermer"><b>${esc(p.title)}</b></a>
    <div class="small muted">${esc(p.quartier || '')}, ${esc(p.city)} · ${money(p.price)}${+p.rooms ? ' · ' + p.rooms + ' ch.' : ''}${p.ownerId === u.id ? ' · votre portefeuille' : ''}</div>
    ${raison ? `<div class="small" style="margin-top:4px">${esc(raison)}</div>` : ''}${ecart ? `<div class="small muted">À noter : ${esc(ecart)}</div>` : ''}</div>`;
  try {
    const cand = C.map((p, i) => ({id: 'b' + (i + 1), titre: p.title, type: p.type, transaction: p.transaction, prix: +p.price, ville: p.city, quartier: p.quartier, surface: +p.surface || null, chambres: +p.rooms || 0, meuble: !!p.furnished, portefeuille_agence: p.ownerId === u.id}));
    const r = iaoJson(await iaoTache('rapprochement', {demande: {transaction: dm.transaction, type: dm.type || '', budget_max: +dm.budget || null, lieu: dm.lieu || '', chambres_min: +dm.rooms || 0}, candidats: cand}));
    const box = $('#iao-rap2'); if (!box) return;
    const choix = (r.biens || []).map(x => ({p: C[+String(x.id).replace(/\D/g, '') - 1], x})).filter(y => y.p);
    box.innerHTML = (choix.length ? choix.map(({p, x}) => ligne(p, x.raison, x.ecart)).join('') : '<p>L\'assistant ne retient aucun bien pour cette demande.</p>')
      + (r.conseil ? `<p class="small muted">${esc(r.conseil)}</p>` : '');
  } catch (e) {
    const box = $('#iao-rap2'); if (box) box.innerHTML = `<p class="small muted">${esc(iaoErreur(e))} Biens les plus proches selon les critères :</p>` + C.slice(0, 5).map(p => ligne(p)).join('');
  }
}

/* ===== 6. Aide à la modération (administrateur) ========================== */
const iaoMots = t => new Set(IAO_TAB(t).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
const iaoSim = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return n / (a.size + b.size - n); };
async function iaoModerer(id) {
  const p = DB.findItem(DB.K.properties, id); if (!p) return;
  const tous = DB.getData(DB.K.properties).filter(x => x.id !== p.id);
  const comp = tous.filter(x => x.transaction === p.transaction && IAO_TAB(x.type) === IAO_TAB(p.type) && IAO_TAB(x.city) === IAO_TAB(p.city) && +x.price > 0);
  const med = iaoMed(comp.map(x => +x.price)), ecart = med ? Math.round((p.price / med - 1) * 100) : null;
  const mp = iaoMots((p.title || '') + ' ' + (p.description || ''));
  const proches = tous.map(x => ({x, s: iaoSim(mp, iaoMots((x.title || '') + ' ' + (x.description || '')))})).filter(y => y.s >= 0.45).sort((a, b) => b.s - a.s).slice(0, 3);
  const coord = /(\+?221)?\s?7[05678][\s.]?\d{3}[\s.]?\d{2}[\s.]?\d{2}|@[a-z0-9-]+\.[a-z]{2,}|wa\.me|whats ?app/i.test(p.description || '');
  const signaux = [ecart === null ? 'Pas de comparable pour juger le prix.' : `Prix ${ecart >= 0 ? '+' : ''}${ecart} % par rapport au prix médian de ${comp.length} annonce(s) comparable(s) (${money(Math.round(med))}).`,
    proches.length ? `Texte très proche de : ${proches.map(y => `« ${y.x.title} » (${Math.round(y.s * 100)} %${y.x.ownerId === p.ownerId ? ', même annonceur' : ', autre annonceur'})`).join(', ')}.` : 'Aucun texte très proche d\'une autre annonce.',
    coord ? 'Coordonnées (téléphone, e-mail ou WhatsApp) écrites dans la description.' : '', !(p.photos || []).length ? 'Aucune photo.' : ''].filter(Boolean);
  modal(`Analyse : ${p.title}`, `<div class="card" style="margin-bottom:12px"><b>Signaux calculés</b><ul class="small" style="margin:6px 0 0;padding-left:18px">${signaux.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
    <div id="iao-mod">${iaoAttente('L\'assistant examine l\'annonce…')}</div>`);
  try {
    const r = iaoJson(await iaoTache('moderation', {annonce: {titre: p.title, type: p.type, transaction: p.transaction, prix: +p.price, surface: +p.surface || null, chambres: +p.rooms || 0, ville: p.city, quartier: p.quartier, description: String(p.description || '').slice(0, 3000), nombre_photos: (p.photos || []).length},
      signaux, annonces_proches: proches.map(y => ({titre: y.x.title, prix: +y.x.price, similarite: Math.round(y.s * 100), meme_annonceur: y.x.ownerId === p.ownerId, description: String(y.x.description || '').slice(0, 600)}))}));
    const box = $('#iao-mod'); if (!box) return;
    const ton = {faible: 'ok', moyenne: 'warn', elevee: 'bad', 'élevée': 'bad'}[sansAccents(r.vigilance || '')] || 'info';
    box.innerHTML = `<div class="card"><div class="row-between"><b>Avis de l'assistant</b>${badge('Vigilance ' + (r.vigilance || '—'), ton)}</div>
      ${(r.points || []).length ? `<ul class="small" style="margin:8px 0 0;padding-left:18px">${r.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="small" style="margin:8px 0 0"><b>Recommandation :</b> ${esc(r.recommandation || '—')}. ${esc(r.explication || '')}</p>
      <p class="small muted" style="margin:8px 0 0">La décision reste la vôtre.</p></div>`;
  } catch (e) { const box = $('#iao-mod'); if (box) box.innerHTML = `<p class="small muted">${esc(iaoErreur(e))}</p>`; }
}

/* ===== 7. Résumé d'une conversation ======================================= */
async function iaoResumer() {
  const B = [...document.querySelectorAll('#msg-list .bubble')].slice(-80).map(b => {
    const c = b.cloneNode(true), dt = c.querySelector('.small'); const date = dt ? dt.textContent.trim() : ''; if (dt) dt.remove();
    return {de: b.classList.contains('me') ? 'moi' : 'interlocuteur', date, texte: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 800)};
  }).filter(m => m.texte);
  if (B.length < 2) return toast('Pas assez de messages à résumer.', 'warn');
  modal('Résumé de la conversation', `<div id="iao-res">${iaoAttente('L\'assistant lit la conversation…')}</div>`);
  try { const t = await iaoTache('resume', {messages: B}); const box = $('#iao-res'); if (box) box.innerHTML = `<div style="white-space:pre-wrap">${esc(t.trim())}</div>`; }
  catch (e) { const box = $('#iao-res'); if (box) box.innerHTML = `<p class="small muted">${esc(iaoErreur(e))}</p>`; }
}

/* ===== 8. Lecture d'une facture ou d'un reçu ============================== */
function iaoImage(file) {
  return new Promise((ok, ko) => {
    if (!/^image\//.test(file.type)) return ko(new Error('Choisissez une photo (JPEG, PNG…).'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82).split(',')[1]); };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Image illisible.')); };
    img.src = url;
  });
}
async function iaoLirePiece(input) {
  const f = input.closest('form'), file = input.files && input.files[0], etat = f.querySelector('.iao-piece-etat'); if (!file) return;
  etat.innerHTML = iaoAttente('Lecture de la pièce…');
  try {
    const data = await iaoImage(file);
    const r = iaoJson(await iaoTache('piece', {categories: EXPC}, {image: {mime: 'image/jpeg', data}}));
    const met = (n, v) => { const el = f.querySelector(`[name="${n}"]`); if (el && v !== null && v !== undefined && v !== '') { el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); return 1; } return 0; };
    let n = met('supplier', r.fournisseur) + met('amount', Number.isFinite(+r.montant) && +r.montant > 0 ? Math.round(+r.montant) : '') + met('date', /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : '');
    if (EXPC.includes(r.categorie)) n += met('cat', r.categorie);
    etat.innerHTML = `<span class="small">${n ? `${n} champ(s) rempli(s)${r.reference ? ' · réf. ' + esc(r.reference) : ''}${r.objet ? ' · ' + esc(r.objet) : ''}. <b>Vérifiez avant d'enregistrer.</b>` : 'Rien de lisible sur cette image : remplissez à la main.'}</span>`;
  } catch (e) { etat.innerHTML = `<span class="small muted">${esc(e.message && !e.code ? e.message : iaoErreur(e))}</span>`; }
  input.value = '';
}

/* ===== Placement des boutons dans les écrans ============================== */
function iaoPoser() {
  const u = Auth.current(); if (!u) return;
  const h = (location.hash || '').split('?')[0];
  /* 1 et 5 : formulaire d'un bien */
  document.querySelectorAll('form[data-action="save-property"]').forEach(f => {
    if (f.dataset.iao) return; f.dataset.iao = '1';
    const ds = f.querySelector('[name="description"]'), pr = f.querySelector('[name="price"]');
    if (ds) ds.closest('.field').insertAdjacentHTML('beforeend', `<div class="row ia-row">${iaoBtn('data-iao="annonce"', 'Rédiger avec l\'assistant')}</div>`);
    if (pr) pr.closest('.field').insertAdjacentHTML('beforeend', `<div class="row ia-row">${iaoBtn('data-iao="estimer"', 'Estimer le prix')}</div>`);
  });
  /* 2 : loyers en retard */
  if (iaoGestion(u, 'rents')) document.querySelectorAll('[data-action="relance-interne"]').forEach(b => {
    if (b.dataset.iao) return; b.dataset.iao = '1';
    b.insertAdjacentHTML('afterend', iaoBtn(`data-iao="relance" data-id="${esc(b.dataset.id)}"`, 'Message'));
  });
  /* 3 : rapport du mois (Gestion et Rapports) */
  if (iaoGestion(u, 'rents') && /^#\/manage(\/reports)?$/.test(h)) {
    const tete = document.querySelector('#app .page-head > .row');
    if (tete && !tete.querySelector('[data-iao="rapport"]')) tete.insertAdjacentHTML('afterbegin', iaoBtn('data-iao="rapport"', 'Rapport du mois'));
  }
  /* 4 : demandes de clients (agence) */
  if (u.role === 'agency') document.querySelectorAll('[data-action="agent-planif"][data-dm]').forEach(b => {
    if (b.dataset.iao) return; b.dataset.iao = '1';
    b.insertAdjacentHTML('beforebegin', iaoBtn(`data-iao="rapprocher" data-id="${esc(b.dataset.dm)}"`, 'Suggestions'));
  });
  /* 6 : modération */
  if (u.role === 'admin' && /^#\/admin\/listings$/.test(h)) document.querySelectorAll('#app tbody tr').forEach(tr => {
    const a = tr.querySelector('[data-action="validate"][data-id], [data-action="reject"][data-id]'); if (!a || tr.dataset.iao) return; tr.dataset.iao = '1';
    a.insertAdjacentHTML('beforebegin', iaoBtn(`data-iao="moderer" data-id="${esc(a.dataset.id)}"`, 'Analyser'));
  });
  /* 7 : messagerie */
  const ml = document.querySelector('#msg-list');
  if (ml && ml.querySelectorAll('.bubble').length >= 4 && !document.querySelector('[data-iao="resumer"]'))
    ml.insertAdjacentHTML('beforebegin', `<div class="row ia-row" style="justify-content:flex-end;padding:6px 10px 0">${iaoBtn('data-iao="resumer"', 'Résumer la conversation')}</div>`);
  /* 8 : dépenses */
  if (iaoGestion(u, 'expenses')) document.querySelectorAll('form[data-action="g2-expense"]').forEach(f => {
    if (f.dataset.iao) return; f.dataset.iao = '1';
    f.insertAdjacentHTML('afterbegin', `<div class="field ia-piece"><label for="iao-piece">Lire une facture ou un reçu (photo)</label>
      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><input type="file" id="iao-piece" accept="image/*" capture="environment" data-iao="piece">
      <span class="iao-piece-etat small muted">L'assistant remplit fournisseur, montant, date et catégorie ; vous vérifiez.</span></div></div>`);
  });
}
let iaoMinuteur = 0;
new MutationObserver(() => { clearTimeout(iaoMinuteur); iaoMinuteur = setTimeout(() => { try { iaoPoser(); } catch (e) { console.warn('[IA] outils', e); } }, 120); })
  .observe(document.body, {childList: true, subtree: true});

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-iao]'); if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.iao, f = b.closest('form');
  if (a === 'fermer') { if (b.tagName !== 'A') e.preventDefault(); closeModal(); return; }
  const actions = {annonce: () => iaoAnnonce(f), estimer: () => iaoEstimer(f), relance: () => iaoRelance(b.dataset.id), rapport: iaoRapport,
    rapprocher: () => iaoRapprocher(b.dataset.id), moderer: () => iaoModerer(b.dataset.id), resumer: iaoResumer};
  if (!actions[a]) return;
  e.preventDefault(); e.stopPropagation(); actions[a]();
}, true);
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('input[data-iao="piece"]')) iaoLirePiece(e.target); });
document.head.insertAdjacentHTML('beforeend', '<style>.ia-row{margin-top:6px;gap:8px}.ia-btn{gap:6px}.ia-btn .ic{color:var(--brand)}'
  + '.ia-piece{background:var(--surface-2);border-radius:12px;padding:10px 12px}#iao-rel-txt,#iao-rap-ta,#iao-desc{width:100%;font:inherit;line-height:1.5}</style>');

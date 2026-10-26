/* ==========================================================================
   MODULE : ventes.js — vendre un bien, pas seulement suivre un acheteur.
   L'écran « Ventes » était un tableau de cinq étapes : on y notait un nom et
   une offre, on passait le dossier à « Vendu », le bien changeait de statut
   et c'était tout. Aucun document, aucun encaissement, aucune date, et
   quarante-huit millions de francs qui n'apparaissaient dans aucun rapport.
   La vente devient un dossier : un prix, un mode de règlement, des dates,
   des documents émis au bon moment et un acquéreur qui reçoit les siens.
   ========================================================================== */

/* --- 1. Le dossier de vente -------------------------------------------- */
const VSTAGES = [['prospect', 'Prospect'], ['visite', 'Visite'], ['offre', 'Offre'],
                 ['promesse', 'Promesse'], ['signe', 'Vendu']];
const VTONE = {prospect: '', visite: 'info', offre: 'warn', promesse: 'warn', signe: 'ok'};
const VLAB = Object.fromEntries(VSTAGES);

const MODES = {
  unique: ['Règlement unique', "Un seul encaissement, à la signature de l'acte."],
  acompte: ['Acompte puis solde', "Un acompte à la promesse, le solde à l'acte."],
  echelonne: ['Échéancier libre', 'Plusieurs versements datés, utile pour un terrain.']
};

/* Le plan de règlement, calculé à la création puis figé sur le dossier. */
function planDeVente(mode, prix, acompte, n, debut) {
  const p = Math.max(0, +prix || 0);
  if (mode === 'acompte') {
    const a = Math.min(p, Math.max(0, +acompte || 0));
    return [{n: 1, label: 'Acompte', amount: a, due: debut, quand: 'promesse'},
            {n: 2, label: 'Solde', amount: p - a, due: '', quand: 'signe'}];
  }
  if (mode === 'echelonne') {
    const k = Math.max(2, Math.min(36, +n || 3));
    const base = Math.floor(p / k);
    return [...Array(k)].map((_, i) => ({
      n: i + 1, label: `Versement ${i + 1} sur ${k}`,
      amount: i === k - 1 ? p - base * (k - 1) : base,
      due: addDays(debut || now(), i * 30).slice(0, 10),
      quand: i === 0 ? 'promesse' : 'manuel'}));
  }
  return [{n: 1, label: 'Prix de vente', amount: p, due: '', quand: 'signe'}];
}

const venteDe = id => DB.findItem(DB.K.deals, id);
const prixVente = d => +d.price || +d.offer || 0;
const planDe = d => Array.isArray(d.plan) && d.plan.length ? d.plan
  : planDeVente(d.mode || 'unique', prixVente(d), d.deposit, d.tranches, d.promiseAt);

const factureDe = l => l.docId ? DB.findItem(DB.K.docs, l.docId) : null;
const encaisseVente = d => planDe(d).reduce((s, l) => {
  const f = factureDe(l); return s + (f ? dPaid(f) : 0);
}, 0);

/* --- 2. Les documents de la vente --------------------------------------- */
function factureTranche(u, d, ligne) {
  if (ligne.docId && DB.findItem(DB.K.docs, ligne.docId)) return DB.findItem(DB.K.docs, ligne.docId);
  const p = gProp(d.propertyId) || {};
  const f = mkDoc(u, 'FAC', {
    client: d.buyer, clientId: d.clientId || '', propertyId: d.propertyId,
    clientPhone: d.buyerPhone || '', dealId: d.id,
    due: ligne.due || addDays(now(), 30).slice(0, 10),
    items: [{label: `${ligne.label} · vente ${p.title || 'du bien'}`, qty: 1, price: ligne.amount}]
  });
  const plan = planDe(d).map(x => x.n === ligne.n ? {...x, docId: f.id} : x);
  DB.updateItem(DB.K.deals, d.id, {plan});
  return f;
}

function contratDeVente(u, d, genre) {
  const p = gProp(d.propertyId) || {};
  const dejaRef = genre === 'promesse' ? d.promiseRef : d.actRef;
  if (dejaRef && DB.findItem(DB.K.contracts, c => c.ref === dejaRef)) return null;
  const debut = genre === 'promesse' ? (d.promiseAt || ymd()) : (d.signedAt || ymd());
  const fin = genre === 'promesse' ? (d.deadline || addDays(debut, 90).slice(0, 10))
                                   : addDays(debut, 365).slice(0, 10);
  const c = DB.addItem(DB.K.contracts, {
    ownerId: u.id, ref: nref('CTR', 'contracts'), type: 'vente',
    party: d.buyer, clientId: d.clientId || '', propertyId: d.propertyId,
    start: debut, end: fin, amount: prixVente(d),
    deposit: d.mode === 'acompte' ? (+d.deposit || 0) : 0, charges: 0,
    dealId: d.id, genre,
    conditions: genre === 'promesse'
      ? `Promesse de vente portant sur ${p.title || 'le bien'}, au prix de ${money(prixVente(d))}. `
        + `Règlement : ${MODES[d.mode || 'unique'][0].toLowerCase()}. `
        + `L'acte doit être signé au plus tard le ${dateFr(fin)}.`
      : `Vente de ${p.title || 'le bien'} à ${d.buyer}, au prix de ${money(prixVente(d))}, `
        + `soldée le ${dateFr(debut)}.`,
    status: 'actif'});
  DB.updateItem(DB.K.deals, d.id, genre === 'promesse' ? {promiseRef: c.ref} : {actRef: c.ref});
  audit(genre === 'promesse' ? 'Promesse de vente' : 'Acte de vente', `${c.ref} · ${d.buyer}`);
  return c;
}

/* --- 3. Ce que chaque étape déclenche ----------------------------------- */
function franchirEtape(d, etape) {
  const u = Auth.current();
  if (!u || !d) return;
  const faits = [];
  const maj = {stage: etape};

  if (etape === 'promesse') {
    if (!d.promiseAt) maj.promiseAt = ymd();
    if (!d.deadline) maj.deadline = addDays(maj.promiseAt || d.promiseAt || ymd(), 90).slice(0, 10);
    DB.updateItem(DB.K.deals, d.id, maj);
    const f = venteDe(d.id);
    const c = contratDeVente(u, f, 'promesse');
    if (c) faits.push('promesse de vente ' + c.ref);
    planDe(f).filter(l => l.quand === 'promesse' && l.amount > 0).forEach(l => {
      const doc = factureTranche(u, venteDe(d.id), l);
      if (doc) faits.push(`facture ${doc.ref} (${money(l.amount)})`);
    });
  } else if (etape === 'signe') {
    if (!d.signedAt) maj.signedAt = ymd();
    DB.updateItem(DB.K.deals, d.id, maj);
    const f = venteDe(d.id);
    const c = contratDeVente(u, f, 'acte');
    if (c) faits.push('acte de vente ' + c.ref);
    planDe(f).filter(l => l.quand === 'signe' && l.amount > 0).forEach(l => {
      const doc = factureTranche(u, venteDe(d.id), l);
      if (doc) faits.push(`facture ${doc.ref} (${money(l.amount)})`);
    });
    /* Le bien quitte le marché : vendu, et l'annonce retirée. */
    DB.updateItem(DB.K.properties, d.propertyId, {status: 'vendu', listingStatus: 'archivee'});
    faits.push('bien marqué vendu et annonce retirée');
    audit('Vente conclue', `${(gProp(d.propertyId) || {}).title || ''} · ${d.buyer}`);
  } else {
    DB.updateItem(DB.K.deals, d.id, maj);
  }

  /* L'acquéreur est tenu au courant — ses documents l'attendent. */
  if (d.clientId && faits.length) {
    const p = gProp(d.propertyId) || {};
    notify(d.clientId,
      etape === 'signe' ? `Vente de ${p.title || 'votre bien'} signée : vos documents sont dans votre coffre.`
                        : `Promesse de vente pour ${p.title || 'un bien'} : vos documents sont disponibles.`,
      '#/coffre/contrats');
  }
  if (faits.length) toast(faits.join(' · ') + '.');
  else toast(`Dossier passé à « ${VLAB[etape]} ».`);
  render();
}

/* --- 4. L'écran Ventes -------------------------------------------------- */
vueGestion(['deals'], function (u, tab) {
  const ventes = gMine('deals', u).slice().reverse();
  const aVendre = biensVendables(u);   /* voir exclusif.js : un bien, un engagement */
  const ecartes = myProps(u).filter(p => VENDABLE.includes(p.transaction)).length - aVendre.length;
  const ouverts = ventes.filter(d => d.stage !== 'signe');
  const conclus = ventes.filter(d => d.stage === 'signe');
  const encaisse = ventes.reduce((s, d) => s + encaisseVente(d), 0);
  const attendu = ventes.reduce((s, d) => s + prixVente(d), 0) - encaisse;
  const urgents = ouverts.filter(d => d.deadline && daysBetween(ymd(), d.deadline) <= 15);

  const carte = d => {
    const p = gProp(d.propertyId) || {};
    const plan = planDe(d), paye = encaisseVente(d), prix = prixVente(d);
    const pct = prix ? Math.round(paye / prix * 100) : 0;
    const reste = d.deadline && d.stage !== 'signe' ? daysBetween(ymd(), d.deadline) : null;
    return `<a class="vcard" href="#/vente/${d.id}">
      <div class="row-between" style="gap:10px;align-items:flex-start">
        <div style="min-width:0">
          <b>${esc(p.title || 'Bien retiré')}</b>
          <div class="small muted">${esc(d.buyer || 'Acquéreur à désigner')}${
            d.clientId ? '' : ' · sans compte'}</div>
        </div>
        ${badge(VLAB[d.stage] || d.stage, VTONE[d.stage] || '')}
      </div>
      <div class="vprix">${money(prix)}</div>
      <div class="vbar"><i style="width:${Math.min(100, pct)}%"></i></div>
      <div class="row-between small muted">
        <span>${money(paye)} encaissé · ${pct} %</span>
        <span>${esc(MODES[d.mode || 'unique'][0])}${plan.length > 1 ? ' · ' + plan.length + ' versements' : ''}</span>
      </div>
      ${reste !== null && reste <= 15
        ? `<div class="small" style="color:var(--bad);margin-top:6px">${
            reste < 0 ? 'Promesse expirée depuis ' + (-reste) + ' j' : 'Acte à signer sous ' + reste + ' j'}</div>`
        : ''}</a>`;
  };

  return `<div class="kpis">
      ${kpiRich(ouverts.length, 'Dossiers en cours', 'briefcase', 'brand', null)}
      ${kpiRich(conclus.length, 'Ventes conclues', 'checkCircle', 'ok', null)}
      ${kpiRich(money(encaisse), 'Encaissé sur ventes', 'money', 'ok', null)}
      ${kpiRich(money(attendu), 'Reste à encaisser', 'clock', attendu > 0 ? 'warn' : '', null)}
    </div>
    ${urgents.length ? `<div class="card" style="margin-top:16px;border-color:#F3D3D6;background:var(--bad-soft)">
      <b class="small">${urgents.length} promesse${urgents.length > 1 ? 's' : ''} arrive${urgents.length > 1 ? 'nt' : ''} à échéance</b>
      <div class="small muted">${urgents.map(d => esc((gProp(d.propertyId) || {}).title || '')).join(', ')}</div></div>` : ''}

    <form class="card" data-action="v-new" style="margin:18px 0">
      <h4 style="margin-top:0">Vendre un bien</h4>
      <div class="form-grid">
        <div class="field"><label>Bien à vendre</label>
          <select class="input" name="propertyId" required>${
            gOpts(aVendre) || '<option value="">Aucun bien en vente</option>'}</select>
          ${aVendre.length ? '' : `<div class="small muted" style="margin-top:5px">${
            myProps(u).some(p => VENDABLE.includes(p.transaction))
              ? "Tous vos biens en vente sont déjà engagés : vendus, loués, ou dans un dossier en cours."
              : "Aucun de vos biens n'est en vente. À la première étape de la publication d'un bien, choisissez « Vente » ou « Terrain » plutôt que « Location »."}</div>`}
          ${ecartes ? `<div class="small muted" style="margin-top:5px">${ecartes} bien${
            ecartes > 1 ? 's sont écartés' : ' est écarté'} : déjà vendu, loué, ou engagé dans un dossier en cours.</div>` : ''}</div>
        <div class="field"><label>Prix de vente (FCFA)</label>
          <input class="input" type="number" min="1" name="price" required></div>
      </div>
      <div class="vgo">
        <button class="btn" name="go" value="vendre">${icon('check', 16)} Vendre maintenant</button>
        <button class="btn ghost" name="go" value="suivre">Suivre le dossier</button>
      </div>
      <p class="small muted" style="margin:10px 0 0">
        <b>Vendre maintenant</b> établit l'acte de vente et la facture, et marque le bien vendu.
        <b>Suivre le dossier</b> ouvre une négociation : visite, offre, promesse, puis signature.</p>
      <p class="err" id="v-err"></p></form>

    ${ventes.length ? `<h3 style="margin:22px 0 12px">Dossiers</h3><div class="vgrid">${ventes.map(carte).join('')}</div>`
      : `<div class="empty"><b>Aucun dossier de vente</b>
         <p class="small">Ouvrez un dossier : promesse, acte et factures sont établis au fil des étapes.</p></div>`}`;
});

/* Le formulaire montre ce qui sert, et rien d'autre. */
document.addEventListener('change', e => {
  const s = e.target.closest('[data-action="v-mode"]');
  if (!s) return;
  const f = s.closest('form');
  f.querySelector('.v-acompte').hidden = s.value !== 'acompte';
  f.querySelector('.v-echelonne').hidden = s.value !== 'echelonne';
  const a = f.querySelector('[data-v-aide]');
  if (a) a.textContent = (MODES[s.value] || MODES.unique)[1];
});

/* Le prix part de celui de la fiche du bien. */
document.addEventListener('change', e => {
  const s = e.target.closest('form[data-action="v-new"] [name="propertyId"]');
  if (!s) return;
  const p = gProp(s.value), champ = s.closest('form').querySelector('[name="price"]');
  if (p && champ && (!champ.value || champ.dataset.auto === champ.value)) {
    champ.value = p.price || '';
    champ.dataset.auto = String(p.price || '');
  }
});

document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-action="v-new"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  const d = formData(f);
  const sel = f.querySelector('[data-action="bc-acquereur"]');
  const compte = sel && sel.value ? DB.findItem(DB.K.users, sel.value) : null;
  const nom = (d.buyer || '').trim() || (compte ? `${compte.firstName} ${compte.lastName}`.trim() : '');
  if (!d.propertyId) return formError(f, 'Choisissez le bien à vendre.');
  if (!nom) return formError(f, "Indiquez l'acquéreur.");
  if (!+d.price) return formError(f, 'Indiquez le prix de vente.');
  /* Ce gestionnaire arrête la propagation : la règle « un bien, un
     engagement » doit donc être vérifiée ici, pas dans un écouteur posé
     plus tard. Un écran resté ouvert ne connaît pas le bail signé entre
     temps. */
  const motif = motifIndisponible(gProp(d.propertyId), 'vente');
  if (motif) { toast(motif, 'bad'); return formError(f, motif); }
  clearFormError(f);

  /* Tout le reste a une valeur par défaut raisonnable : règlement unique,
     promesse datée d'aujourd'hui, trois mois pour signer. Le propriétaire
     ajuste depuis la fiche s'il en a besoin, au moment où cela se décide. */
  const v = DB.addItem(DB.K.deals, {
    ownerId: u.id, propertyId: d.propertyId, buyer: nom,
    clientId: compte ? compte.id : '', buyerPhone: compte ? compte.phone : '',
    offer: +d.price, price: +d.price, mode: 'unique', deposit: 0, tranches: 0,
    promiseAt: '', deadline: '', signedAt: '',
    plan: planDeVente('unique', +d.price, 0, 0, ymd()), stage: 'prospect'});
  audit('Dossier de vente', `${nom} · ${money(+d.price)}`);

  const direct = (e.submitter && e.submitter.value) === 'vendre';
  if (!direct) { toast(`Dossier ouvert pour ${nom}.`); go('#/vente/' + v.id); return; }
  go('#/vente/' + v.id);
  setTimeout(() => confirmerSignature(venteDe(v.id)), 60);
}, true);

/* --- 5. La fiche d'une vente -------------------------------------------- */
function ficheVente(u, d) {
  const p = gProp(d.propertyId) || {};
  const plan = planDe(d), prix = prixVente(d), paye = encaisseVente(d);
  const i = VSTAGES.findIndex(s => s[0] === d.stage);

  const etapes = `<div class="vsteps">${VSTAGES.map(([k, l], j) => `
    <div class="vstep ${j < i ? 'done' : j === i ? 'on' : ''}">
      <i>${j < i ? icon('check', 13) : j + 1}</i><span>${l}</span></div>`).join('')}</div>`;

  const dates = [['Promesse signée le', d.promiseAt], ["Acte à signer avant le", d.deadline],
                 ['Vente signée le', d.signedAt]].filter(x => x[1]);

  const ligneHtml = l => {
    const f = factureDe(l);
    const etat = !f ? badge('À facturer', '')
      : dRest(f) <= 0 ? badge('Réglé', 'ok')
      : dPaid(f) > 0 ? badge('Partiel', 'warn') : badge(...dState(f));
    return `<tr><td class="small"><b>${esc(l.label)}</b>${
        l.due ? `<br><span class="muted">échéance ${dateFr(l.due)}</span>` : ''}</td>
      <td>${money(l.amount)}</td><td>${etat}</td>
      <td><div class="row" style="gap:6px">${f
        ? `<a class="btn ghost sm" href="#/manage/docs">${esc(f.ref)}</a>`
          + (dRest(f) > 0 ? `<button class="btn sm" data-action="g2-pay" data-id="${f.id}">Encaisser</button>` : '')
        : `<button class="btn sm" data-action="v-facturer" data-id="${d.id}" data-n="${l.n}">Émettre la facture</button>`
      }</div></td></tr>`;
  };

  const docs = [
    d.promiseRef && ['Promesse de vente', d.promiseRef],
    d.actRef && ['Acte de vente', d.actRef]
  ].filter(Boolean);

  const signe = d.stage === 'signe';
  const aPromesse = !!d.promiseRef;

  /* Deux gestes font la vente : la promesse et la signature. Les autres
     étapes ne servent qu'à suivre une négociation : on les range dans une
     liste discrète au lieu d'obliger à cliquer quatre fois. */
  const actions = signe ? '' : `<div class="card vact">
      <b class="small">Que voulez-vous faire ?</b>
      <div class="vact-b">
        ${aPromesse ? '' : `<button class="btn ghost" data-action="v-promesse" data-id="${d.id}">
          ${icon('file', 16)} Établir la promesse</button>`}
        <button class="btn" data-action="v-signer-d" data-id="${d.id}">
          ${icon('check', 16)} Signer la vente</button>
      </div>
      <p class="small muted" style="margin:10px 0 0">${aPromesse
        ? "La promesse est établie. Signer la vente produit l'acte, la facture du solde, et retire le bien du marché."
        : "Signer directement produit l'acte et la facture. Passer par une promesse ajoute un engagement écrit, un acompte et une date limite."}</p>
      <div class="row-between vact-s">
        <span class="small muted">Où en est la négociation ?</span>
        <select class="input" data-action="v-etape-sel" data-id="${d.id}">
          ${VSTAGES.filter(x => x[0] !== 'signe').map(([k, l]) =>
            `<option value="${k}"${k === d.stage ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>`;

  return crumbHtml('#/manage/deals', 'Ventes', p.title || 'Dossier') +
    page(p.title || 'Bien retiré', `Vente à ${esc(d.buyer)}${d.clientId ? '' : ' · sans compte DEUKSIL'}`) +
    etapes +
    `<div class="kpis" style="margin-top:16px">
      ${kpiRich(money(prix), 'Prix de vente', 'money', 'brand', null)}
      ${kpiRich(money(paye), 'Encaissé', 'checkCircle', paye >= prix ? 'ok' : '', null)}
      ${kpiRich(money(prix - paye), 'Reste dû', 'clock', prix - paye > 0 ? 'warn' : 'ok', null)}
      ${kpiRich(MODES[d.mode || 'unique'][0], 'Règlement', 'repeat', 'info', null)}
    </div>

    ${actions}

    ${dates.length ? `<h3 style="margin:22px 0 10px">Calendrier</h3>
      <div class="card">${dates.map(([l, v]) => `<div class="row-between small" style="padding:6px 0">
        <span class="muted">${l}</span><b>${dateFr(v)}</b></div>`).join('')}</div>` : ''}

    <h3 style="margin:22px 0 10px">Règlement</h3>
    ${gTable(['Versement', 'Montant', 'État', ''], plan.map(ligneHtml),
      ['Aucun versement', 'Le plan de règlement se fixe en établissant la promesse.'])}

    <h3 style="margin:22px 0 10px">Documents</h3>
    ${docs.length ? `<div class="card">${docs.map(([l, r]) =>
        `<div class="row-between small" style="padding:7px 0">
          <span>${l}</span><a href="#/manage/contracts"><b>${esc(r)}</b></a></div>`).join('')}</div>`
      : `<p class="small muted">Les contrats sont établis quand vous cliquez « Établir la promesse » ou « Signer la vente ».</p>`}
    ${d.clientId ? `<p class="small muted" style="margin-top:10px">${icon('check', 14)}
      ${esc(d.buyer)} retrouve ces documents dans son propre espace.</p>`
      : `<p class="small muted" style="margin-top:10px">${esc(d.buyer)} n'a pas de compte DEUKSIL :
      ses documents restent à lui transmettre vous-même.</p>`}

    <div style="margin-top:22px">
      <button class="btn ghost sm" data-action="v-annuler" data-id="${d.id}">Abandonner ce dossier</button>
    </div>`;
}

route(/^\/vente\/([\w-]+)$/, vid => {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) { toast('Espace réservé aux propriétaires.', 'bad'); go('#/login'); return false; }
  const d = DB.findItem(DB.K.deals, x => x.id === vid && x.ownerId === u.id);
  if (!d) { toast('Dossier introuvable.', 'bad'); go('#/manage/deals'); return false; }
  return shellApp(u, ficheVente(u, d));
});

/* --- 6. Les actions de la fiche ----------------------------------------- */
/* La promesse se décide au moment où on l'établit : c'est là qu'on demande
   le mode de règlement et la date limite, pas à l'ouverture du dossier. */
function demanderPromesse(d) {
  const prix = prixVente(d);
  modal('Établir la promesse de vente', `<form data-action="v-promesse-ok" data-id="${d.id}">
    <p class="small muted" style="margin-top:0">${esc(d.buyer)} · ${money(prix)}</p>
    <div class="field"><label>Comment le prix sera-t-il réglé ?</label>
      <select class="input" name="mode" data-action="v-mode">${
        Object.entries(MODES).map(([k, [l]]) =>
          `<option value="${k}"${k === (d.mode || 'unique') ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="small muted" style="margin-top:5px" data-v-aide>${MODES[d.mode || 'unique'][1]}</div></div>
    <div class="form-grid v-acompte" ${(d.mode === 'acompte') ? '' : 'hidden'}>
      <div class="field"><label>Montant de l'acompte (FCFA)</label>
        <input class="input" type="number" min="0" max="${prix}" name="deposit"
          value="${d.deposit || Math.round(prix * 0.2)}"></div></div>
    <div class="form-grid v-echelonne" ${(d.mode === 'echelonne') ? '' : 'hidden'}>
      <div class="field"><label>Nombre de versements</label>
        <input class="input" type="number" min="2" max="36" name="tranches"
          value="${d.tranches || 3}"></div></div>
    <div class="form-grid">
      <div class="field"><label>Promesse signée le</label>
        <input class="input" type="date" name="promiseAt" value="${d.promiseAt || ymd()}" required></div>
      <div class="field"><label>Acte à signer avant le</label>
        <input class="input" type="date" name="deadline"
          value="${d.deadline || addDays(now(), 90).slice(0, 10)}" required></div></div>
    <div class="row" style="gap:10px;margin-top:16px">
      <button type="button" class="btn ghost" style="flex:1" data-action="close-modal">Annuler</button>
      <button class="btn" style="flex:1">${icon('check', 16)} Établir la promesse</button></div>
    <p class="err" id="v-perr"></p></form>`);
}

function confirmerSignature(d) {
  if (!d) return;
  const p = gProp(d.propertyId) || {}, reste = prixVente(d) - encaisseVente(d);
  modal('Signer la vente ?', `<p class="small">Le bien <b>${esc(p.title || '')}</b> passera en
    « Vendu », son annonce sera retirée, et l'acte de vente${reste > 0
      ? ` ainsi que la facture de <b>${money(reste)}</b>` : ''} ${reste > 0 ? 'seront établis' : 'sera établi'}
    au nom de <b>${esc(d.buyer)}</b>.</p>
    <div class="row" style="gap:10px;margin-top:16px">
      <button class="btn ghost" style="flex:1" data-action="close-modal">Annuler</button>
      <button class="btn" style="flex:1" data-action="v-signer" data-id="${d.id}">${icon('check', 16)} Signer</button>
    </div>`);
}

document.addEventListener('click', e => {
  const u = Auth.current(); if (!u) return;
  const mien = id => DB.findItem(DB.K.deals, x => x.id === id && x.ownerId === u.id);

  const pr = e.target.closest('[data-action="v-promesse"]');
  if (pr) { e.preventDefault(); const d = mien(pr.dataset.id); if (d) demanderPromesse(d); return; }

  const sd = e.target.closest('[data-action="v-signer-d"]');
  if (sd) { e.preventDefault(); confirmerSignature(mien(sd.dataset.id)); return; }

  const sg = e.target.closest('[data-action="v-signer"]');
  if (sg) {
    e.preventDefault();
    const d = mien(sg.dataset.id);
    closeModal();
    if (d) franchirEtape(d, 'signe');
    return;
  }

  const fa = e.target.closest('[data-action="v-facturer"]');
  if (fa) {
    e.preventDefault();
    const d = mien(fa.dataset.id); if (!d) return;
    const l = planDe(d).find(x => String(x.n) === fa.dataset.n); if (!l) return;
    const f = factureTranche(u, d, l);
    if (d.clientId) notify(d.clientId, `Facture ${f.ref} : ${money(l.amount)} · ${l.label}.`, '#/coffre/factures');
    toast(`Facture ${f.ref} établie.`);
    render();
    return;
  }

  const an = e.target.closest('[data-action="v-annuler"]');
  if (an) {
    e.preventDefault();
    const d = mien(an.dataset.id); if (!d) return;
    const emis = planDe(d).filter(l => factureDe(l)).length + (d.promiseRef ? 1 : 0) + (d.actRef ? 1 : 0);
    modal('Abandonner ce dossier ?', `<p class="small">Le dossier de vente à <b>${esc(d.buyer)}</b> sera supprimé.
      ${emis ? `<b>${emis} document${emis > 1 ? 's ont' : ' a'} déjà été établi${emis > 1 ? 's' : ''}</b> :
        ${emis > 1 ? 'ils restent' : 'il reste'} dans vos archives et devra${emis > 1 ? 'ont' : ''} être annulé${emis > 1 ? 's' : ''} séparément.`
        : "Aucun document n'a encore été établi."}</p>
      <div class="row" style="gap:10px;margin-top:16px">
        <button class="btn ghost" style="flex:1" data-action="close-modal">Garder</button>
        <button class="btn" style="flex:1;background:var(--bad);border-color:var(--bad)"
          data-action="v-annuler-ok" data-id="${d.id}">Abandonner</button></div>`);
    return;
  }

  const ok = e.target.closest('[data-action="v-annuler-ok"]');
  if (ok) {
    e.preventDefault();
    const d = mien(ok.dataset.id);
    closeModal();
    if (!d) return;
    audit('Dossier de vente abandonné', `${d.buyer} · ${(gProp(d.propertyId) || {}).title || ''}`);
    DB.deleteItem(DB.K.deals, d.id);
    toast('Dossier abandonné.');
    go('#/manage/deals');
  }
});

/* L'établissement de la promesse : on fige le plan de règlement ici. */
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-action="v-promesse-ok"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u) return;
  const d = DB.findItem(DB.K.deals, x => x.id === f.dataset.id && x.ownerId === u.id);
  if (!d) return;
  const v = formData(f), prix = prixVente(d);
  if (v.mode === 'acompte' && +v.deposit > prix) {
    return formError(f, "L'acompte ne peut pas dépasser le prix de vente.");
  }
  if (v.deadline < v.promiseAt) {
    return formError(f, "L'acte ne peut pas être signé avant la promesse.");
  }
  DB.updateItem(DB.K.deals, d.id, {
    mode: v.mode, deposit: +v.deposit || 0, tranches: +v.tranches || 0,
    promiseAt: v.promiseAt, deadline: v.deadline,
    plan: planDeVente(v.mode, prix, +v.deposit, +v.tranches, v.promiseAt)});
  closeModal();
  franchirEtape(venteDe(d.id), 'promesse');
}, true);

/* Le suivi de la négociation, sans document. */
document.addEventListener('change', e => {
  const s = e.target.closest('[data-action="v-etape-sel"]');
  if (!s) return;
  const u = Auth.current(); if (!u) return;
  const d = DB.findItem(DB.K.deals, x => x.id === s.dataset.id && x.ownerId === u.id);
  if (!d) return;
  if (s.value === 'promesse') { demanderPromesse(d); return; }
  DB.updateItem(DB.K.deals, d.id, {stage: s.value});
  toast(`Dossier à l'étape « ${VLAB[s.value]} ».`);
  render();
});

/* --- 7. Les ventes entrent dans les rapports ---------------------------- */
REPT.ventes = 'Ventes de biens';
const _repDataV = repData;
repData = function (u, type, y) {
  if (type !== 'ventes') return _repDataV(u, type, y);
  const Y = String(y);
  const rows = gMine('deals', u)
    .filter(d => (d.signedAt || d.createdAt || '').startsWith(Y))
    .map(d => {
      const paye = encaisseVente(d), prix = prixVente(d);
      return [(gProp(d.propertyId) || {}).title || '—', d.buyer || '', VLAB[d.stage] || d.stage,
              prix, paye, prix - paye];
    });
  return {head: ['Bien', 'Acquéreur', 'Étape', 'Prix', 'Encaissé', 'Reste dû'], rows,
          total: ['TOTAL', '', '', ...[3, 4, 5].map(i => rows.reduce((s, r) => s + r[i], 0))],
          money: [3, 4, 5]};
};

/* --- 8. Le greffon « acquéreur » suit le nouveau formulaire ------------- */
new MutationObserver(() => requestAnimationFrame(() => {
  try {
    const f = document.querySelector('.main form[data-action="v-new"]');
    if (f && !f.dataset.bc) {
      f.dataset.bc = '1';
      const champ = document.createElement('div');
      champ.className = 'field';
      const liste = clientsDuProprietaire(Auth.current());
      champ.innerHTML = `<label>Qui est l'acquéreur ?</label>
        <select class="input" data-action="bc-acquereur">
          <option value="">— Une personne sans compte —</option>
          ${liste.map(c => `<option value="${c.id}">${esc(c.firstName + ' ' + c.lastName)}${
            c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}
        </select>
        <div class="field" style="margin-top:12px"><label>Acquéreur</label>
          <input class="input" name="buyer" required placeholder="Nom complet"></div>
        <div class="small muted" style="margin-top:5px">${liste.length
          ? 'Choisir un client rattache la vente à son compte : il recevra ses documents.'
          : 'Aucun client enregistré : saisissez le nom, les documents resteront à transmettre.'}</div>`;
      f.querySelector('[name="price"]').closest('.field').after(champ);
      /* Le prix du bien déjà sélectionné : inutile de le retaper. */
      const sel = f.querySelector('[name="propertyId"]');
      const prix = f.querySelector('[name="price"]');
      const p = sel && gProp(sel.value);
      if (p && prix && !prix.value) { prix.value = p.price || ''; prix.dataset.auto = String(p.price || ''); }
    }
  } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

document.addEventListener('change', e => {
  const s = e.target.closest('[data-action="bc-acquereur"]');
  if (!s) return;
  const f = s.closest('form'), nom = f.querySelector('[name="buyer"]');
  const c = s.value ? DB.findItem(DB.K.users, s.value) : null;
  if (!nom) return;
  if (c) { nom.value = `${c.firstName || ''} ${c.lastName || ''}`.trim(); nom.readOnly = true; }
  else { nom.readOnly = false; nom.value = ''; }
});

/* --- 10. La promesse et l'acte ne sont pas le même document ------------- */
/* Les deux sortaient sous le titre « CONTRAT DE VENTE », avec les mêmes
   articles : l'acte annonçait que les parties « s'engagent à finaliser la
   vente », alors qu'elle était faite. Et une promesse honorée par la
   signature était tamponnée « expiré » parce que sa date de fin était
   passée. Chaque pièce a désormais son titre, ses articles et son état. */
function articlesVente(c, p, moi, verse) {
  const bien = p ? `${p.title} (${[p.quartier, p.city].filter(Boolean).join(', ')}`
    + `${p.surface ? ', ' + p.surface + ' m²' : ''}${p.rooms ? ', ' + p.rooms + ' pièces' : ''})`
    : 'le bien désigné par les parties';
  const reste = Math.max(0, (c.amount || 0) - verse);

  if (c.genre === 'acte') {
    return [
      ['Objet', `${moi} (le Vendeur) vend et transfère à ${c.party} (l'Acquéreur), `
        + `qui accepte, la pleine propriété de : ${bien}.`],
      ['Prix', `La vente est conclue au prix de ${fc(c.amount)}.`
        + (verse ? ` L'Acquéreur a réglé ${fc(verse)} à ce jour.` : '')
        + (reste ? ` Il reste dû ${fc(reste)}, payable selon les modalités convenues entre les parties.`
                 : ' Le Vendeur en donne quittance pour solde de tout compte.')],
      ['Propriété et jouissance', `L'Acquéreur est propriétaire du bien à compter du ${d8(c.start)} `
        + `et en a la jouissance à la même date, libre de tout occupant sauf convention contraire.`],
      ['Titre de propriété et formalités', 'Le Vendeur déclare être propriétaire du bien et le céder '
        + "libre de toute charge non déclarée. Les parties s'obligent à faire constater la présente "
        + "vente par acte authentique devant notaire et à accomplir les formalités d'enregistrement "
        + 'et de mutation auprès des services compétents.'],
      ['Frais', "Les frais d'acte, droits d'enregistrement, taxes et honoraires de notaire sont à la "
        + "charge de l'Acquéreur, sauf accord contraire des parties."],
      ['Déclarations', 'Les parties déclarent avoir la capacité de contracter et avoir pris connaissance '
        + "de l'état du bien, des documents remis et des servitudes éventuelles."]
    ];
  }
  return [
    ['Objet', `${moi} (le Promettant) s'engage à vendre à ${c.party} (le Bénéficiaire), `
      + `qui s'engage à acquérir : ${bien}.`],
    ['Prix et modalités de règlement', `Le prix est arrêté à ${fc(c.amount)}.`
      + (c.deposit ? ` Un acompte de ${fc(c.deposit)} est versé à la signature des présentes.` : '')
      + (reste ? ` Le solde, soit ${fc(reste)}, sera réglé au plus tard à la signature de l'acte.` : '')],
    ['Délai', `L'acte de vente doit être signé au plus tard le ${d8(c.end)}. `
      + 'Passé ce terme et sauf prorogation écrite, les parties reprennent leur liberté.'],
    ['Titre de propriété', 'Le Promettant déclare être propriétaire du bien et libre de toute charge non '
      + "déclarée. Le Bénéficiaire est invité à faire contrôler le titre foncier et la situation du bien "
      + 'par un notaire avant tout paiement définitif.'],
    ["Sort de l'acompte", "Si la vente ne se réalise pas du fait du Bénéficiaire, l'acompte reste acquis "
      + 'au Promettant à titre de dédommagement. Si elle ne se réalise pas du fait du Promettant, '
      + "l'acompte est restitué. Toute autre répartition doit être convenue par écrit."],
    ['Frais', "Les frais d'acte, droits d'enregistrement et honoraires sont répartis selon l'accord "
      + 'des parties ou les usages.']
  ];
}

const _pdfContractV = pdfContract;
pdfContract = function (c, u) {
  if (c.type !== 'vente' || !c.genre) return _pdfContractV(c, u);
  const I = issuer(u), p = gProp(c.propertyId);
  const titre = c.genre === 'acte' ? 'ACTE DE VENTE' : 'PROMESSE DE VENTE';
  const [doc, y0] = pdfBegin(titre, c.ref, c.createdAt, c.ref);
  let y = y0;

  /* Une promesse suivie d'un acte est réalisée, pas expirée. */
  const v = c.dealId ? venteDe(c.dealId) : null;
  const verse = v ? encaisseVente(v) : 0;
  const etat = c.genre === 'acte' ? ['Signé', [31, 122, 77]]
    : v && v.stage === 'signe' ? ['Réalisée', [31, 122, 77]]
    : v && v.deadline && v.deadline < ymd() ? ['Échue', [185, 56, 56]]
    : ['En cours', [15, 48, 87]];
  pdfPill(doc, 195, 38, etat[0], etat[1]);
  y += 6;

  const role = c.genre === 'acte' ? ['Le Vendeur', "L'Acquéreur"]
                                  : ['Le Promettant', 'Le Bénéficiaire'];
  y = pdfParties(doc, y, {t: role[0], lines: issuerLines(I)},
    {t: role[1], lines: [c.party, p && p.title,
      p && [p.quartier, p.city].filter(Boolean).join(', ')].filter(Boolean)});

  const art = articlesVente(c, p, I.name, verse);
  if (c.conditions && c.genre !== 'acte') art.push(['Conditions particulières', c.conditions]);
  art.push(['Droit applicable', 'Le présent acte est soumis au droit sénégalais. '
    + "À défaut d'accord amiable, les tribunaux compétents du lieu du bien seront saisis."]);
  art.forEach(([t, x], i) => { y = pdfPara(doc, y, `Article ${i + 1} — ${t}`, x); });

  y = pdfPara(doc, y + 2, null, `Fait à ${(p && p.city) || 'Dakar'}, le ${d8(c.start)}, `
    + "en deux exemplaires originaux. Modèle généré par DEUKSIL à titre indicatif : il ne remplace "
    + "pas l'intervention d'un notaire, obligatoire pour la mutation d'un bien immobilier.");
  pdfSign(doc, y, role[0], role[1]);
  return pdfEnd(doc, u, c.ref);
};

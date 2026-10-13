/* ==========================================================================
   MODULE : agence.js — audit logique de l'espace agence.
   La chaîne PROPRIÉTAIRE → MANDAT → LOYERS → COMMISSION → REVERSEMENT
   raisonnait mois par mois : un reversement couvrant juillet et août,
   enregistré en octobre, n'était rattaché à aucun des deux mois, qui
   restaient « à reverser » — l'argent pouvait partir deux fois. Une dépense
   saisie après coup sur un mois déjà reversé n'était imputée nulle part.

   Chaque propriétaire a désormais un COMPTE :
       dû   = Σ par mois (encaissé − dépenses − commission du mandat du mois)
       solde = dû − déjà reversé
   Un reversement est un montant quelconque, jusqu'au solde, à n'importe
   quelle date. Un solde négatif (dépenses supérieures aux encaissements)
   est à retenir sur le prochain reversement.

   S'ajoutent : le taux du mandat en vigueur le mois considéré, l'exclusivité
   des mandats (un bien, un mandant ; un mandant, un mandat à la fois), les
   droits des agents, la suppression d'un mandant protégée et une page
   Commissions calculée sur les vrais encaissements.
   ========================================================================== */

/* --- 1. Le mandat du mois ---------------------------------------------------- */
const finMandat = m => String(m.endedAt || m.end || '9999-12-31').slice(0, 10);
function mandatDuMois(u, ownerId2, mois) {
  const debut = mois + '-01', fin = mois + '-31';
  return gMine('mandates', u).filter(m => m.ownerId2 === ownerId2 && m.start <= fin && finMandat(m) >= debut)
    .sort((a, b) => a.start < b.start ? 1 : -1)[0] || null;
}
/* Taux d'un mois : celui du mandat en vigueur ce mois-là. Hors mandat (avant
   le premier, après une résiliation ou une échéance), pas de commission. Une
   fiche sans aucun mandat (données antérieures aux mandats) garde son taux. */
function tauxDuMois(u, o, mois) {
  const m = mois ? mandatDuMois(u, o.id, mois) : mandateOf(u, o.id);
  if (m) return +m.rate;
  return gMine('mandates', u).some(x => x.ownerId2 === o.id) ? 0 : (+o.rate || 0);
}

/* Le solde d'un mois : même calcul qu'avant, au taux du mandat de ce mois. */
const _ownerBalance81 = ownerBalance;
ownerBalance = function (u, o, month) {
  if (!month) {
    const c = compteGestion(u, o);
    return {encaisse: c.enc, dep: c.dep, rate: tauxDuMois(u, o, ''), com: c.com, net: c.du};
  }
  const b = _ownerBalance81(u, o, month), rate = tauxDuMois(u, o, month), com = Math.round(b.encaisse * rate / 100);
  return {...b, rate, com, net: b.encaisse - b.dep - com};
};
/* Relevé annuel : commission mois par mois, au taux de chaque mois. */
const _ownerStats81 = ownerStats;
ownerStats = function (u, o, y) {
  const s = _ownerStats81(u, o, y);
  s.com = [...Array(12)].reduce((x, _, i) => x + ownerBalance(u, o, `${y}-${String(i + 1).padStart(2, '0')}`).com, 0);
  s.net = s.rev - s.dep - s.com;
  return s;
};

/* --- 2. Le compte du propriétaire ------------------------------------------- */
function moisDuCompte(u, o) {
  const ids = new Set(myProps(u).filter(p => p.clientOwnerId === o.id).map(p => p.id));
  const baux = new Set(gMine('leases', u).filter(l => ids.has(l.propertyId)).map(l => l.id));
  const dates = [];
  gMine('rents', u).filter(r => baux.has(r.leaseId)).forEach(r => rPays(r).forEach(p => dates.push(String(p.date))));
  gMine('fpay', u).filter(x => ids.has(x.propertyId)).forEach(x => dates.push(String(x.createdAt)));
  gMine('expenses', u).filter(x => ids.has(x.propertyId)).forEach(x => dates.push(String(x.date)));
  const debut = dates.map(d => d.slice(0, 7)).filter(d => /^\d{4}-\d{2}$/.test(d)).sort()[0];
  if (!debut) return [];
  const out = [], fin = curMonth();
  for (let m = debut, i = 0; m <= fin && i < 240; i++) { out.push(m); m = moisCle(m + '-01', 1); }
  return out;
}
function compteGestion(u, o) {
  let enc = 0, dep = 0, com = 0, du = 0;
  const mois = moisDuCompte(u, o).map(m => { const b = ownerBalance(u, o, m); enc += b.encaisse; dep += b.dep; com += b.com; du += b.net; return {m, ...b}; });
  const reversements = gMine('transfers', u).filter(t => t.ownerId2 === o.id);
  const verse = reversements.reduce((s, t) => s + (+t.amount || 0), 0);
  return {enc, dep, com, du, verse, solde: du - verse, mois, reversements};
}
const soldeMandant = compteGestion;   // nom distinct de compteMandant (59-mandant), qui crée l'accès du mandant

/* --- 3. L'écran Reversements -------------------------------------------------- */
function reversementsTab(u) {
  const owners = gMine('owners', u), comptes = owners.map(o => ({o, c: compteGestion(u, o)}));
  const aReverser = comptes.reduce((s, x) => s + Math.max(0, x.c.solde), 0);
  const aRetenir = comptes.reduce((s, x) => s + Math.max(0, -x.c.solde), 0);
  const verse = comptes.reduce((s, x) => s + x.c.verse, 0);
  const com12 = owners.reduce((s, o) => s + monthsBack(12).reduce((x, m) => x + ownerBalance(u, o, m).com, 0), 0);
  const hist = gMine('transfers', u).slice().sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  const detail = [];
  monthsBack(6).forEach(m => owners.forEach(o => { const b = ownerBalance(u, o, m); if (b.encaisse || b.dep) detail.push({m, o, b}); }));
  return `<div class="kpis">${kpi(money(aReverser), 'Solde à reverser', aReverser ? 'bad' : 'ok')}${kpi(money(verse), 'Déjà reversé', 'ok')}${kpi(money(com12), 'Commission agence (12 mois)', 'brand')}</div>
    <p class="small muted" style="margin:14px 0 10px">Pour chaque propriétaire : loyers et factures encaissés − dépenses − commission du mandat = dû ; dû − déjà reversé = solde.
      Un reversement peut couvrir plusieurs mois ou une partie du solde.${aRetenir ? ` <b>${money(aRetenir)}</b> sont à retenir sur de prochains reversements (dépenses supérieures aux encaissements).` : ''}</p>
    <h3 style="margin:18px 0 10px">Comptes des propriétaires</h3>` +
    gTable(['Propriétaire', 'Encaissé', 'Dépenses', 'Commission', 'Dû', 'Déjà reversé', 'Solde', ''], comptes.filter(x => x.c.mois.length || x.c.verse).map(({o, c}) => `<tr>
      <td class="small"><b>${esc(o.name)}</b><br><span class="muted">mandat : ${tauxDuMois(u, o, curMonth())} %</span></td>
      <td>${money(c.enc)}</td><td>${money(c.dep)}</td><td>${money(c.com)}</td><td>${money(c.du)}</td><td>${money(c.verse)}</td>
      <td>${c.solde > 0 ? `<b>${money(c.solde)}</b>` : c.solde < 0 ? badge('À retenir ' + money(-c.solde), 'warn') : badge('À jour', 'ok')}</td>
      <td>${c.solde > 0 ? `<button class="btn sm" data-action="t-pay" data-o="${o.id}">Reverser</button>` : ''}</td></tr>`),
      ['Aucun compte', 'Dès qu\'un loyer est encaissé pour un propriétaire mandant, son compte apparaît ici.']) +
    `<h3 style="margin:24px 0 10px">Détail des 6 derniers mois</h3>` +
    gTable(['Mois', 'Propriétaire', 'Encaissé', 'Dépenses', 'Commission', 'Net du mois'], detail.map(({m, o, b}) => `<tr>
      <td class="small">${monthLabel(m)}</td><td class="small">${esc(o.name)}</td><td>${money(b.encaisse)}</td><td>${money(b.dep)}</td>
      <td>${money(b.com)} <span class="muted small">(${b.rate} %)</span></td><td><b style="color:var(--${b.net < 0 ? 'bad' : 'ink'})">${money(b.net)}</b></td></tr>`),
      ['Rien sur la période', 'Aucun encaissement ni dépense pour vos mandants ces six derniers mois.']) +
    `<h3 style="margin:24px 0 10px">Historique des reversements</h3>` +
    gTable(['Référence', 'Date', 'Propriétaire', 'Montant', 'Mode', ''], hist.map(t => `<tr>
      <td class="small"><b>${esc(t.ref)}</b></td><td class="small">${dateFr(t.paidOn || t.createdAt)}</td><td class="small">${esc((DB.findItem(DB.K.owners, t.ownerId2) || {}).name || '—')}</td>
      <td><b>${money(t.amount)}</b></td><td class="small">${esc(t.method || '')}${t.payRef ? ' · ' + esc(t.payRef) : ''}</td>
      <td><button class="btn ghost sm" data-action="t-recu" data-id="${t.id}">Reçu</button></td></tr>`),
      ['Aucun reversement', 'Les reversements enregistrés apparaissent ici avec leur reçu.']);
}
vueGestion(['transfers'], u => reversementsTab(u));

const peutAgir = (u, droit) => !u.member || u.perms.includes(droit);
function refuserAgence(e, msg, form) {
  e.preventDefault(); e.stopImmediatePropagation();
  if (form) formError(form, msg); toast(msg, 'bad');
}

/* Ouvrir la fenêtre de reversement : le montant proposé est le solde. */
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="t-pay"]');
  if (!b) return;
  const u = Auth.current(); if (!u) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (!peutAgir(u, 'finances')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
  const o = DB.findItem(DB.K.owners, x => x.id === b.dataset.o && x.ownerId === u.id); if (!o) return;
  const c = compteGestion(u, o);
  if (c.solde <= 0) { toast(`Rien à reverser à ${o.name}.`); return; }
  modal('Reverser à ' + o.name, `<p class="small muted">Dû : ${money(c.du)} · déjà reversé : ${money(c.verse)} · <b>solde : ${money(c.solde)}</b></p>
    <form data-action="t-save" data-o="${o.id}"><div class="form-grid">
      <div class="field"><label>Montant versé (FCFA)</label><input class="input" type="number" min="1" max="${c.solde}" name="amount" value="${c.solde}" required></div>
      <div class="field"><label>Date du versement</label><input class="input" type="date" name="date" value="${ymd()}" max="${ymd()}" required></div>
      <div class="field"><label>Mode</label><select class="input" name="method">${PAYM.map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Référence (facultatif)</label><input class="input" name="ref" placeholder="N° de virement, Wave…"></div></div>
    <p class="small muted" style="margin:0 0 10px">Un montant inférieur au solde laisse le reste à reverser plus tard.</p>
    <button class="btn block">Enregistrer le reversement</button></form>`);
}, true);

/* Enregistrer : montant positif, au plus le solde, référence unique. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="t-save"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u) return;
  if (!peutAgir(u, 'finances')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
  if (f.dataset.sent) return;
  const o = DB.findItem(DB.K.owners, x => x.id === f.dataset.o && x.ownerId === u.id);
  if (!o) { toast('Propriétaire introuvable.', 'bad'); return; }
  const d = formData(f), m = Math.round(+d.amount), c = compteGestion(u, o), ref = (d.ref || '').trim(), date = d.date || ymd();
  if (!(m > 0)) return formError(f, 'Indiquez le montant versé.');
  if (m > c.solde) return formError(f, c.solde > 0 ? `Le montant dépasse le solde dû à ${o.name} (${money(c.solde)}).` : `Rien n'est dû à ${o.name} pour l'instant.`);
  if (date > ymd()) return formError(f, 'La date du versement ne peut pas être dans le futur.');
  if (ref && gMine('transfers', u).some(t => String(t.payRef || '').trim().toLowerCase() === ref.toLowerCase())) return formError(f, `La référence « ${ref} » est déjà enregistrée sur un autre reversement.`);
  f.dataset.sent = '1';
  const t = DB.addItem(DB.K.transfers, {ownerId: u.id, ownerId2: o.id, ref: nref('REV', 'transfers'), month: date.slice(0, 7), paidOn: date,
    amount: m, method: PAYM.includes(d.method) ? d.method : 'Virement', payRef: ref,
    encaisse: c.enc, dep: c.dep, com: c.com, du: c.du, soldeAvant: c.solde, soldeApres: c.solde - m, rate: tauxDuMois(u, o, date.slice(0, 7)), status: 'reversé'});
  audit('Reversement', `${t.ref} · ${o.name} · ${money(m)}`);
  closeModal(); toast(`Reversement de ${money(m)} enregistré.${c.solde - m > 0 ? ' Reste à reverser : ' + money(c.solde - m) + '.' : ''}`); render();
}, true);

/* Le reçu montre le compte avant et après le versement. */
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="t-recu"]');
  if (!b) return;
  const u = Auth.current(), t = u && DB.findItem(DB.K.transfers, x => x.id === b.dataset.id && x.ownerId === u.id);
  if (!t) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const o = DB.findItem(DB.K.owners, t.ownerId2) || {};
  const html = `<div style="font-family:sans-serif;color:#0C2745"><h2>REÇU DE REVERSEMENT ${esc(t.ref)}</h2>
    <p>Versé à <b>${esc(o.name || '')}</b> la somme de <b>${money(t.amount)}</b> (${esc(t.method || '')}), le ${dateFr(t.paidOn || t.createdAt)}.</p>
    ${t.soldeAvant !== undefined ? `<p class="small">Compte de gestion : encaissé ${money(t.encaisse)} · dépenses ${money(t.dep)} · commission ${money(t.com)} · déjà reversé avant ce versement ${money(t.du - t.soldeAvant)}.<br>
      Solde avant : ${money(t.soldeAvant)} · solde après : ${money(t.soldeApres)}.</p>`
      : `<p class="small">Au titre de la gestion de ${monthLabel(t.month)} · encaissé ${money(t.encaisse)} · dépenses ${money(t.dep)} · commission ${money(t.com)} (${t.rate} %).</p>`}
    ${t.payRef ? `<p>Référence : ${esc(t.payRef)}</p>` : ''}</div>`;
  modal('Reçu ' + t.ref, `<div class="card pad-s">${html}</div>`);
}, true);

/* --- 4. Mandats exclusifs ---------------------------------------------------- */
const chevauche = (a1, b1, a2, b2) => a1 <= b2 && a2 <= b1;
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="m-new"]');
  if (!f) return;
  const u = Auth.current(); if (!u) return;
  if (!peutAgir(u, 'gestion')) return refuserAgence(e, 'Action non autorisée pour votre profil.');
  const d = formData(f), o = DB.findItem(DB.K.owners, x => x.id === d.ownerId2 && x.ownerId === u.id);
  if (!o) return refuserAgence(e, 'Choisissez un de vos propriétaires.', f);
  if (!d.start || !d.end || d.end <= d.start) return refuserAgence(e, 'La date de fin doit suivre la date de début.', f);
  const coches = Object.keys(d).filter(k => k.startsWith('p_')).map(k => k.slice(2));
  const miens = new Set(myProps(u).map(p => p.id));
  const etranger = coches.find(id => !miens.has(id));
  if (etranger) return refuserAgence(e, 'Un des biens cochés ne fait pas partie de vos biens.', f);
  const actifs = gMine('mandates', u).filter(m => m.status === 'actif');
  const doublon = actifs.find(m => m.ownerId2 === o.id && chevauche(d.start, d.end, m.start, finMandat(m)));
  if (doublon) return refuserAgence(e, `${o.name} a déjà un mandat actif (${doublon.ref}, ${doublon.rate} %) sur cette période : résiliez-le ou faites commencer le nouveau après le ${dateFr(finMandat(doublon))}.`, f);
  for (const id of coches) {
    const p = gProp(id), autre = actifs.find(m => m.ownerId2 !== o.id && m.properties.includes(id) && chevauche(d.start, d.end, m.start, finMandat(m)));
    if (autre) return refuserAgence(e, `${p.title} est déjà confié par ${(DB.findItem(DB.K.owners, autre.ownerId2) || {}).name || 'un autre propriétaire'} (${autre.ref}).`, f);
    if (p.clientOwnerId && p.clientOwnerId !== o.id) return refuserAgence(e, `${p.title} est rattaché à ${(DB.findItem(DB.K.owners, p.clientOwnerId) || {}).name || 'un autre propriétaire'} : détachez-le de sa fiche d'abord.`, f);
  }
}, true);
/* Résilier : la date de fin réelle borne la commission. */
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="m-end"]');
  if (!b) return;
  const u = Auth.current(); if (!u) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (!peutAgir(u, 'gestion')) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
  const m = DB.findItem(DB.K.mandates, x => x.id === b.dataset.id && x.ownerId === u.id && x.status === 'actif'); if (!m) return;
  confirmDialog({title: 'Résilier le mandat', message: `${m.ref} prend fin aujourd'hui : plus aucune commission n'est prélevée au titre de ce mandat après cette date. Les sommes déjà dues au propriétaire restent à reverser.`,
    confirmLabel: 'Résilier', danger: true, onConfirm: () => {
      DB.updateItem(DB.K.mandates, m.id, {status: 'résilié', endedAt: ymd()}); audit('Mandat résilié', m.ref); render(); }});
}, true);
/* --- 5. Droits des agents (membres d'équipe) -------------------------------- */
['click', 'submit', 'change'].forEach(ev => window.addEventListener(ev, e => {
  const el = e.target.closest && e.target.closest('[data-action]'), u = Auth.current();
  if (!el || !u || !u.member) return;
  const a = el.dataset.action;
  const droit = /^t-/.test(a) ? 'finances' : /^m-/.test(a) ? 'gestion' : '';
  if (droit && !u.perms.includes(droit)) refuserAgence(e, 'Action non autorisée pour votre profil.');
}, true));

/* --- 6. Supprimer un mandant ------------------------------------------------- */
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="g9-odel"]');
  if (!b) return;
  const u = Auth.current(), o = u && DB.findItem(DB.K.owners, x => x.id === b.dataset.id && x.ownerId === u.id);
  if (!o) return;
  const actif = gMine('mandates', u).find(m => m.ownerId2 === o.id && m.status === 'actif');
  if (actif) return refuserAgence(e, `${o.name} a un mandat actif (${actif.ref}) : résiliez-le avant de supprimer sa fiche.`);
  const c = compteGestion(u, o);
  if (c.solde) return refuserAgence(e, c.solde > 0 ? `${money(c.solde)} restent à reverser à ${o.name} : soldez son compte avant de supprimer sa fiche.`
    : `${o.name} doit encore ${money(-c.solde)} à l'agence : régularisez avant de supprimer sa fiche.`);
}, true);

/* --- 7. À traiter : les reversements suivent le solde ------------------------ */
const _todoList81 = todoList;
todoList = function (u, s) {
  const t = _todoList81(u, s).filter(x => x[2] !== '#/manage/transfers');
  if (u.role === 'agency' && peutAgir(u, 'finances')) {
    const dus = gMine('owners', u).map(o => ({o, s: compteGestion(u, o).solde})).filter(x => x.s > 0);
    if (dus.length) t.splice(1, 0, [`${dus.length} reversement${dus.length > 1 ? 's' : ''} à effectuer`,
      `${money(dus.reduce((x, d) => x + d.s, 0))} · ${dus.map(d => d.o.name).slice(0, 2).join(', ')}`, '#/manage/transfers', 'repeat', 'warn']);
  }
  return t;
};

/* --- 8. Commissions : les vrais chiffres ------------------------------------- */
const TAUX_HONO_VENTE = 3;    // honoraires de vente estimés, en % du prix
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/commissions$');
  if (!r) return;
  r.fn = () => {
    const u = Auth.guard('agency'); if (!u) return false;
    const owners = gMine('owners', u), mois = monthsBack(12).reverse();
    const parMois = mois.map(m => ({m, rows: owners.map(o => ({o, b: ownerBalance(u, o, m)})).filter(x => x.b.com)}));
    const gestion = parMois.reduce((s, x) => s + x.rows.reduce((a, r) => a + r.b.com, 0), 0);
    const debut = mois[0] + '-01';
    const ventes = gMine('deals', u).filter(d => d.stage === 'signe' && String(d.signedAt || d.updatedAt || '') >= debut);
    const locations = gMine('leases', u).filter(l => String(l.start) >= debut);
    const honoV = ventes.reduce((s, d) => s + Math.round(prixVente(d) * TAUX_HONO_VENTE / 100), 0);
    const honoL = locations.reduce((s, l) => s + (+l.rent || 0), 0);
    const parMandant = owners.map(o => ({o, com: mois.reduce((s, m) => s + ownerBalance(u, o, m).com, 0), taux: tauxDuMois(u, o, curMonth())})).filter(x => x.com);
    const max = Math.max(1, ...parMois.map(x => x.rows.reduce((a, r) => a + r.b.com, 0)));
    return shellApp(u, page('Commissions', 'Ce que l\'agence a gagné sur les 12 derniers mois.') + `
      <div class="kpis">${kpi(money(gestion), 'Commissions de gestion (prélevées)', 'brand')}${kpi(money(honoV + honoL), 'Honoraires estimés', 'ok')}${kpi(money(gestion + honoV + honoL), 'Total')}</div>
      <p class="small muted" style="margin:14px 0 18px">Les commissions de gestion sont calculées sur les loyers et factures réellement encaissés pour vos mandants, au taux du mandat de chaque mois : ce sont celles que retiennent les reversements.
        Les honoraires sont une estimation : ${TAUX_HONO_VENTE} % du prix des ventes signées, un mois de loyer par bail signé.</p>
      <div class="card" style="margin-bottom:18px"><b>Commissions de gestion par mois</b>
        <div class="bars" style="margin-top:12px">${parMois.map((x, i) => { const v = x.rows.reduce((a, r) => a + r.b.com, 0);
          return `<div class="bar"><div class="col"><i style="height:${Math.round(v / max * 100)}%${i === 11 ? ';background:var(--brand)' : ''}" title="${money(v)}"></i></div><span class="small ${i === 11 ? '' : 'muted'}">${x.m.slice(5)}</span></div>`; }).join('')}</div></div>
      <h3 style="margin:0 0 10px">Par propriétaire</h3>` +
      gTable(['Propriétaire', 'Taux actuel', 'Commission (12 mois)'], parMandant.map(x => `<tr><td class="small"><b>${esc(x.o.name)}</b></td><td>${x.taux} %</td><td><b>${money(x.com)}</b></td></tr>`),
        ['Aucune commission', 'Les commissions apparaissent dès qu\'un loyer est encaissé pour un propriétaire sous mandat.']) +
      `<h3 style="margin:24px 0 10px">Honoraires estimés</h3>` +
      gTable(['Opération', 'Bien', 'Date', 'Base', 'Honoraires'], [
        ...ventes.map(d => `<tr><td>${badge('Vente', 'ok')}</td><td class="small"><b>${esc((gProp(d.propertyId) || {}).title || '')}</b></td><td class="small">${dateFr(d.signedAt || d.updatedAt)}</td><td>${money(prixVente(d))}</td><td><b>${money(Math.round(prixVente(d) * TAUX_HONO_VENTE / 100))}</b></td></tr>`),
        ...locations.map(l => `<tr><td>${badge('Location', 'info')}</td><td class="small"><b>${esc((gProp(l.propertyId) || {}).title || '')}</b>${l.unitRef ? ' · ' + esc(l.unitRef) : ''}</td><td class="small">${dateFr(l.start)}</td><td>${money(l.rent)} / mois</td><td><b>${money(l.rent)}</b></td></tr>`)],
        ['Aucune opération', 'Les ventes signées et les baux conclus sur 12 mois apparaissent ici.']));
  };
})();

/* --- 9. Les relevés du mandant : le même compte que celui de l'agence -------- */
/* Le relevé du mandant recalculait de son côté : seuls les loyers portant un
   identifiant de bien, sans les dépenses, au taux de la fiche. Il affichait
   donc un « reste à percevoir » différent du solde de l'agence. Il lit
   désormais le compte de gestion tenu par l'agence. */
relevesMandant = function (u) {
  const fiche = DB.findItem(DB.K.owners, u.ownerRec) || {}, agence = DB.findItem(DB.K.users, fiche.ownerId);
  if (!agence) return page('Mes relevés', '') + `<div class="empty"><b>Agence introuvable</b><p class="small">Contactez votre agence.</p></div>`;
  const c = compteGestion(agence, fiche), taux = tauxDuMois(agence, fiche, curMonth());
  const recents = c.mois.slice().reverse().filter(x => x.encaisse || x.dep);
  return page('Mes relevés', `Ce que ${esc(agence.agencyName || 'votre agence')} a encaissé sur vos biens, retenu et reversé.`) +
    `<div class="kpis">
      ${kpiRich(money(c.enc), 'Encaissé pour vous', 'money', 'ok')}
      ${kpiRich(money(c.dep + c.com), `Dépenses et commission${taux ? ' · ' + taux + ' %' : ''}`, 'repeat', 'gold')}
      ${kpiRich(money(c.du), 'Net vous revenant', 'chart', 'brand')}
      ${kpiRich(money(Math.max(0, c.solde)), c.solde < 0 ? 'Avance de l\'agence à régulariser' : 'Reste à percevoir', 'alert', c.solde > 0 ? 'bad' : 'ok',
        {label: money(c.verse) + ' déjà reversé', tone: ''})}
    </div>
    <h3 style="margin:24px 0 12px">Mois par mois</h3>
    ${gTable(['Mois', 'Encaissé', 'Dépenses', 'Commission', 'Net'], recents.map(x => `<tr><td class="small">${esc(monthLabel(x.m))}</td>
      <td>${money(x.encaisse)}</td><td>${money(x.dep)}</td><td>${money(x.com)} <span class="small muted">(${x.rate} %)</span></td><td><b>${money(x.net)}</b></td></tr>`),
      ['Rien d\'encaissé', 'Les loyers perçus par votre agence apparaîtront ici.'])}
    <h3 style="margin:24px 0 12px">Reversements reçus</h3>
    ${gTable(['Référence', 'Date', 'Montant', 'Mode'], c.reversements.slice().sort((a, b) => a.createdAt < b.createdAt ? 1 : -1).map(t => `<tr>
      <td class="small"><b>${esc(t.ref)}</b></td><td class="small">${dateFr(t.paidOn || t.createdAt)}</td><td><b>${money(t.amount)}</b></td><td class="small">${esc(t.method || '')}</td></tr>`),
      ['Aucun reversement', 'Les versements de votre agence apparaîtront ici.'])}`;
};

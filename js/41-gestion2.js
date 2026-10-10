/* ==========================================================================
   MODULE : gestion2.js — chaîne agence du cahier des charges :
   PROPRIÉTAIRE → MANDAT → BIENS → LOYERS → COMMISSION → REVERSEMENT,
   plus la recherche globale, la maintenance en trois états et le jour
   d'échéance du bail.
   ========================================================================== */
Object.assign(DB.K, {mandates:'deuksil_mandates', transfers:'deuksil_transfers'});
GTABS.splice(GTABS.findIndex(t => t[0] === 'owners') + 1, 0, ['mandates', 'Mandats de gestion'], ['transfers', 'Reversements']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit|contracts|providers|team|identity|units|tenants|reports|owners|tmsgs|mandates|transfers)$/;
Object.assign(GMETA, {
  mandates: ['file', 'Le droit de gérer les biens d\'un propriétaire', u => { const a = gMine('mandates', u).filter(m => m.status === 'actif').length; return a + ' mandat(s) actif(s)'; }],
  transfers:['repeat', 'Ce que vous devez reverser à chaque propriétaire', u => { const n = gMine('transfers', u).filter(t => t.status === 'à reverser').length; return n ? n + ' à reverser' : 'Rien en attente'; }]
});
GGROUPS[1][2] = ['owners', 'mandates', 'transfers', 'tmsgs', 'deals'];
const MSERV = ['Recherche de locataires', 'Encaissement des loyers', 'Suivi technique', 'Relances et impayés', 'Reporting mensuel'];
const MST = {actif:'ok', 'expiré':'bad', 'résilié':''};

/* ---------- Mandats ---------- */
const mandateOf = (u, ownerId) => gMine('mandates', u).find(m => m.ownerId2 === ownerId && m.status === 'actif');
const commissionRate = (u, o) => { const m = mandateOf(u, o.id); return m ? m.rate : (o.rate || 0); };
function syncMandates(u) {
  const today = ymd();
  gMine('mandates', u).filter(m => m.status === 'actif' && m.end && m.end < today).forEach(m => { DB.updateItem(DB.K.mandates, m.id, {status: 'expiré'}); audit('Mandat expiré', m.ref); });
}
function mandatesTab(u) {
  syncMandates(u);
  const list = gMine('mandates', u).slice().reverse(), owners = gMine('owners', u), props = myProps(u);
  const pname = id => (gProp(id) || {}).title || '';
  return `<form class="card" data-action="m-new" style="margin-bottom:18px"><h4 style="margin-top:0">Nouveau mandat de gestion</h4>
    <p class="small muted" style="margin-top:0">Sans mandat actif, un bien ne devrait pas être géré pour le compte d'un propriétaire.</p>
    <div class="form-grid"><div class="field"><label>Propriétaire</label><select class="input" name="ownerId2" required>${owners.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('') || '<option value="">Ajoutez d\'abord un propriétaire</option>'}</select></div>
      <div class="field"><label>Commission (%)</label><input class="input" type="number" min="0" max="50" step="0.5" name="rate" value="8" required></div>
      <div class="field"><label>Début</label><input class="input" type="date" name="start" value="${ymd()}" required></div>
      <div class="field"><label>Fin</label><input class="input" type="date" name="end" value="${addDays(now(), 365).slice(0, 10)}" required></div></div>
    <div class="field"><label>Biens confiés</label><div class="row" style="gap:12px;flex-wrap:wrap">${props.map(p => `<label class="small"><input type="checkbox" name="p_${p.id}"> ${esc(p.title)}</label>`).join('') || '<span class="small muted">Aucun bien</span>'}</div></div>
    <div class="field"><label>Services inclus</label><div class="row" style="gap:12px;flex-wrap:wrap">${MSERV.map((sv, i) => `<label class="small"><input type="checkbox" name="s_${i}" ${i < 3 ? 'checked' : ''}> ${sv}</label>`).join('')}</div></div>
    <button class="btn">Créer le mandat</button></form>` +
    gTable(['N°', 'Propriétaire', 'Biens', 'Commission', 'Période', 'Statut', ''], list.map(m => {
      const o = DB.findItem(DB.K.owners, m.ownerId2) || {}, soon = m.status === 'actif' && daysBetween(ymd(), m.end) <= 30;
      return `<tr><td class="small"><b>${m.ref}</b></td><td class="small">${esc(o.name || '—')}</td>
        <td class="small">${m.properties.map(pname).filter(Boolean).join(', ') || '<span class="muted">aucun</span>'}</td><td>${m.rate} %</td>
        <td class="small muted">${dateFr(m.start)} → ${dateFr(m.end)}${soon ? '<br>' + badge('Expire dans ' + daysBetween(ymd(), m.end) + ' j', 'warn') : ''}</td>
        <td>${badge(m.status, MST[m.status])}</td>
        <td><div class="row" style="gap:6px"><button class="btn ghost sm" data-action="m-view" data-id="${m.id}">Voir</button>
        ${m.status === 'actif' ? `<button class="btn ghost sm" data-action="m-end" data-id="${m.id}">Résilier</button>` : ''}</div></td></tr>`;
    }), ['Aucun mandat', 'Le mandat fixe la commission et les biens que vous gérez pour un propriétaire.']);
}
function mandateHtml(m, u) {
  const o = DB.findItem(DB.K.owners, m.ownerId2) || {}, me = ownerLabel(u);
  return `<div style="font-family:sans-serif;color:#0F3057"><h2>MANDAT DE GESTION IMMOBILIÈRE</h2><p><b>N° ${m.ref}</b> — ${m.status}</p>
    <p><b>Le mandant :</b> ${esc(o.name)}${o.cni ? ', CNI ' + esc(o.cni) : ''}${o.address ? ', ' + esc(o.address) : ''}<br><b>Le mandataire :</b> ${esc(me)}</p>
    <p><b>Biens confiés :</b> ${m.properties.map(id => esc((gProp(id) || {}).title || '')).filter(Boolean).join(' · ') || 'à préciser'}</p>
    <p><b>Durée :</b> du ${dateFr(m.start)} au ${dateFr(m.end)}.<br><b>Commission :</b> ${m.rate} % des loyers encaissés.</p>
    <p><b>Services inclus :</b> ${m.services.join(' · ') || '—'}</p>
    <p>Le mandataire rend compte au mandant des loyers encaissés, des dépenses engagées et du solde reversé.</p>
    <p style="margin-top:36px">Signatures du mandant et du mandataire</p><small>Modèle indicatif, à faire valider par un professionnel du droit.</small></div>`;
}

/* ---------- Reversements ---------- */
function ownerBalance(u, o, month) {
  const ids = myProps(u).filter(p => p.clientOwnerId === o.id).map(p => p.id), lp = id => (DB.findItem(DB.K.leases, id) || {}).propertyId;
  const inM = d => !month || (d || '').slice(0, 7) === month;
  const loyers = gMine('rents', u).filter(r => r.paidAt && inM(r.paidAt) && ids.includes(lp(r.leaseId))).reduce((s, r) => s + r.amount, 0);
  const autres = horsVentes(gMine('fpay', u)).filter(x => inM(x.createdAt) && ids.includes(x.propertyId)).reduce((s, x) => s + x.amount, 0);
  const dep = gMine('expenses', u).filter(x => inM(x.date) && ids.includes(x.propertyId)).reduce((s, x) => s + x.amount, 0);
  const encaisse = loyers + autres, rate = commissionRate(u, o), com = Math.round(encaisse * rate / 100);
  return {encaisse, dep, rate, com, net: encaisse - dep - com};
}
const monthsBack = n => [...Array(n)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });
function transfersTab(u) {
  const owners = gMine('owners', u), done = gMine('transfers', u);
  const paid = (oid, m) => done.find(t => t.ownerId2 === oid && t.month === m);
  const rows = [];
  monthsBack(4).forEach(m => owners.forEach(o => { const b = ownerBalance(u, o, m); if (b.encaisse <= 0 && b.dep <= 0) return;
    const t = paid(o.id, m); rows.push({o, m, b, t}); }));
  const due = rows.filter(r => !r.t).reduce((s, r) => s + Math.max(0, r.b.net), 0);
  return `<div class="kpis">${kpi(money(due), 'Reste à reverser', due ? 'bad' : 'ok')}${kpi(money(rows.filter(r => r.t).reduce((s, r) => s + r.t.amount, 0)), 'Déjà reversé', 'ok')}${kpi(money(rows.reduce((s, r) => s + r.b.com, 0)), 'Commission agence', 'brand')}</div>
  <p class="small muted" style="margin:14px 0 10px">Loyers encaissés − dépenses − commission = montant dû au propriétaire, mois par mois.</p>` +
    gTable(['Mois', 'Propriétaire', 'Encaissé', 'Dépenses', 'Commission', 'À reverser', 'Statut', ''], rows.map(({o, m, b, t}) => `<tr>
      <td class="small">${monthLabel(m)}</td><td class="small"><b>${esc(o.name)}</b></td><td>${money(b.encaisse)}</td><td>${money(b.dep)}</td>
      <td>${money(b.com)} <span class="muted small">(${b.rate} %)</span></td><td><b>${money(Math.max(0, b.net))}</b></td>
      <td>${t ? badge('Reversé le ' + dateFr(t.createdAt), 'ok') : badge('À reverser', 'warn')}</td>
      <td>${t ? `<button class="btn ghost sm" data-action="t-recu" data-id="${t.id}">Reçu</button>`
        : `<button class="btn sm" data-action="t-pay" data-o="${o.id}" data-m="${m}" data-a="${Math.max(0, b.net)}">Reverser</button>`}</td></tr>`),
      ['Aucun reversement', 'Dès qu\'un loyer est encaissé pour un propriétaire, son reversement apparaît ici.']);
}

/* ---------- Recherche globale ---------- */
let GSEARCH = '';
function globalSearch(u, q) {
  const s = q.trim().toLowerCase(); if (s.length < 2) return [];
  const hit = v => String(v || '').toLowerCase().includes(s), out = [];
  myProps(u).filter(p => hit(p.title) || hit(p.city) || hit(p.quartier)).forEach(p => out.push(['Bien', p.title, `${p.quartier}, ${p.city}`, '#/manage/units']));
  gMine('owners', u).filter(o => hit(o.name) || hit(o.phone)).forEach(o => out.push(['Propriétaire', o.name, o.phone, '#/manage/owners']));
  gMine('leases', u).filter(l => hit(l.tenant) || hit(l.phone)).forEach(l => out.push(['Locataire', l.tenant, `${(gProp(l.propertyId) || {}).title || ''}${l.unitRef ? ' · ' + l.unitRef : ''} · ${money(l.rent)}`, '#/manage/tenants']));
  gMine('units', u).filter(x => hit(x.ref)).forEach(x => out.push(['Unité', x.ref, `${(gProp(x.propertyId) || {}).title || ''} · ${x.status}`, '#/manage/units']));
  gMine('docs', u).filter(d => hit(d.ref) || hit(d.client)).forEach(d => out.push([DT[d.type], d.ref, `${d.client} · ${money(dTot(d))}`, '#/manage/docs']));
  gMine('fpay', u).filter(p => hit(p.ref) || hit(p.rec) || hit(p.client)).forEach(p => out.push(['Paiement', p.ref, `${p.client} · ${money(p.amount)}`, '#/manage/fpay']));
  gMine('contracts', u).filter(c => hit(c.ref) || hit(c.party)).forEach(c => out.push(['Contrat', c.ref, `${c.party} · ${c.status}`, '#/manage/contracts']));
  return out.slice(0, 30);
}
const EXTRA = {
  owner:  [['#/owner/property/new', 'Ajouter un bien', 'plus', 'Publier une nouvelle annonce'], ['#/owner/visits', 'Demandes de visite', 'calendar', 'Confirmer ou refuser une visite'],
           ['#/owner/statistics', 'Statistiques', 'chart', 'Vues et performance de vos annonces'], ['#/owner/profile', 'Mon profil', 'user', 'Vos informations de compte']],
  agency: [['#/owner/property/new', 'Ajouter un bien', 'plus', 'Publier une nouvelle annonce'], ['#/agency/agents', 'Agents', 'agent', 'Votre équipe commerciale'],
           ['#/agency/clients', 'Clients', 'users', 'Prospects et acheteurs suivis'], ['#/agency/visits', 'Visites', 'calendar', 'Demandes à confirmer'],
           ['#/agency/commissions', 'Commissions', 'money', 'Ce que l\'agence a gagné'], ['#/owner/profile', 'Profil agence', 'user', 'Vos informations publiques']]
};
const _hub = manageHub;
manageHub = function (u) {
  const html = _hub(u);
  const bar = `<form class="card sbar" data-action="gs-form">
    <div class="row" style="gap:10px"><input class="input" name="q" id="gs-q" placeholder="Rechercher un bien, un locataire, une facture…" value="${esc(GSEARCH)}" autocomplete="off">
    <button class="btn" type="submit" aria-label="Rechercher">${icon('search', 16)}</button></div></form>`;
  const res = GSEARCH ? globalSearch(u, GSEARCH) : [];
  const list = GSEARCH ? (res.length ? `<div class="card" style="margin-bottom:20px">${res.map(([t, n, d, h]) => `<a class="trow" href="${h}"><span class="badge info">${esc(t)}</span><div class="txt" style="min-width:0"><b>${esc(n)}</b><div class="sub">${esc(d)}</div></div>${icon('arrowRight', 16)}</a>`).join('')}</div>`
    : `<div class="empty" style="margin-bottom:20px"><b>Aucun résultat</b><p class="small">Rien ne correspond à « ${esc(GSEARCH)} ».</p></div>`) : '';
  return html.replace('<div class="gsection">', bar + list + '<div class="gsection">');
};
document.addEventListener('submit', e => {
  if (e.target.closest('[data-action="sb-noop"]')) { e.preventDefault(); return; }
  const f = e.target.closest('[data-action="gs-form"]'); if (!f) return;
  e.preventDefault(); GSEARCH = (formData(f).q || '').trim(); render();
  setTimeout(() => { const i = $('#gs-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 30);
});

/* ---------- Onglets ---------- */
vueGestion(['mandates'], u => mandatesTab(u));
vueGestion(['transfers'], u => transfersTab(u));
/* commission : le mandat fait foi */
const _ownerStats = ownerStats;
ownerStats = function (u, o, y) { const s = _ownerStats(u, o, y), r = commissionRate(u, o); s.com = Math.round(s.rev * r / 100); s.net = s.rev - s.dep - s.com; return s; };

/* ---------- Actions ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action^="m-"],[data-action^="t-"]'), u = Auth.current(); if (!el || !u || el.tagName === 'FORM') return;
  const a = el.dataset.action, id = el.dataset.id, mine = k => DB.findItem(DB.K[k], x => x.id === id && x.ownerId === u.id);
  if (a === 'm-view' && mine('mandates')) { const m = mine('mandates'); modal(m.ref, `<div class="card pad-s">${mandateHtml(m, u)}</div><div style="margin-top:12px">${pdfBtn(m.ref)}</div>`); }
  if (a === 'm-end' && mine('mandates')) confirmDialog({title: 'Résilier le mandat', message: 'Vous ne gérerez plus les biens de ce propriétaire.', confirmLabel: 'Résilier', danger: true,
    onConfirm: () => { DB.updateItem(DB.K.mandates, id, {status: 'résilié'}); audit('Mandat résilié', mine('mandates').ref); render(); }});
  if (a === 't-pay') { const o = DB.findItem(DB.K.owners, x => x.id === el.dataset.o && x.ownerId === u.id); if (!o) return;
    const amount = +el.dataset.a, m = el.dataset.m;
    modal('Reverser à ' + o.name, `<p class="small muted">Période : <b>${monthLabel(m)}</b> · Montant dû : <b>${money(amount)}</b></p>
      <form data-action="t-save" data-o="${o.id}" data-m="${m}"><div class="field"><label>Montant versé (FCFA)</label><input class="input" type="number" min="0" name="amount" value="${amount}" required></div>
      <div class="field"><label>Mode</label><select class="input" name="method">${PAYM.map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Référence (facultatif)</label><input class="input" name="ref"></div><button class="btn block">Enregistrer le reversement</button></form>`); }
  if (a === 't-recu' && mine('transfers')) { const t = mine('transfers'), o = DB.findItem(DB.K.owners, t.ownerId2) || {};
    const html = `<div style="font-family:sans-serif;color:#0F3057"><h2>REÇU DE REVERSEMENT ${t.ref}</h2>
      <p>Versé à <b>${esc(o.name)}</b> la somme de <b>${money(t.amount)}</b> (${esc(t.method)}) au titre de la gestion de ${monthLabel(t.month)}, le ${dateFr(t.createdAt)}.</p>
      <p class="small">Encaissé ${money(t.encaisse)} · dépenses ${money(t.dep)} · commission ${money(t.com)} (${t.rate} %).</p>${t.payRef ? `<p>Référence : ${esc(t.payRef)}</p>` : ''}</div>`;
    modal('Reçu ' + t.ref, `<div class="card pad-s">${html}</div>`); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action="m-new"],[data-action="t-save"]'), u = Auth.current(); if (!f || !u) return;
  e.preventDefault(); const d = formData(f);
  if (f.dataset.action === 'm-new') {
    const o = DB.findItem(DB.K.owners, x => x.id === d.ownerId2 && x.ownerId === u.id); if (!o) { toast('Choisissez un propriétaire.', 'bad'); return; }
    if (d.end <= d.start) { toast('La date de fin doit suivre la date de début.', 'bad'); return; }
    const props = myProps(u).filter(p => d['p_' + p.id]).map(p => p.id), services = MSERV.filter((sv, i) => d['s_' + i]);
    const m = DB.addItem(DB.K.mandates, {ownerId: u.id, ownerId2: o.id, ref: nref('MDT', 'mandates'), rate: Math.min(50, Math.max(0, +d.rate || 0)),
      start: d.start, end: d.end, properties: props, services, status: 'actif'});
    props.forEach(pid => DB.updateItem(DB.K.properties, pid, {clientOwnerId: o.id}));
    DB.updateItem(DB.K.owners, o.id, {rate: m.rate});
    audit('Mandat créé', `${m.ref} · ${o.name}`); render(); autoFileThen('mandate', m, m.ref + ' créé');
  }
  if (f.dataset.action === 't-save') {
    const o = DB.findItem(DB.K.owners, x => x.id === f.dataset.o && x.ownerId === u.id), m = f.dataset.m; if (!o) return;
    if (DB.findItem(DB.K.transfers, x => x.ownerId === u.id && x.ownerId2 === o.id && x.month === m)) { closeModal(); toast('Ce mois est déjà reversé.', 'bad'); return; }
    const b = ownerBalance(u, o, m);
    const t = DB.addItem(DB.K.transfers, {ownerId: u.id, ownerId2: o.id, ref: nref('REV', 'transfers'), month: m, amount: +d.amount || 0,
      method: d.method, payRef: (d.ref || '').trim(), encaisse: b.encaisse, dep: b.dep, com: b.com, rate: b.rate, status: 'reversé'});
    audit('Reversement', `${t.ref} · ${o.name} · ${money(t.amount)}`); notify(u.id, `Reversement ${t.ref} enregistré pour ${o.name}.`, '#/manage/transfers');
    closeModal(); toast(`Reversement enregistré : ${money(t.amount)}.`); render();
  }
});
/* le mandat s'archive en PDF comme les autres documents */
function pdfMandate(m, u) {
  const I = issuer(u), o = DB.findItem(DB.K.owners, m.ownerId2) || {};
  const [doc, y0] = pdfBegin('MANDAT DE GESTION', m.ref, m.createdAt, m.ref);
  let y = pdfParties(doc, y0, {t: 'Le mandataire', lines: issuerLines(I)}, {t: 'Le mandant', lines: [o.name, o.phone && 'Tél : ' + o.phone, o.address].filter(Boolean)});
  y = pdfPara(doc, y, 'Article 1 — Objet', `Le mandant confie au mandataire la gestion des biens suivants : ${m.properties.map(id => (gProp(id) || {}).title).filter(Boolean).join(', ') || 'à préciser'}.`);
  y = pdfPara(doc, y, 'Article 2 — Durée', `Le mandat est conclu du ${d8(m.start)} au ${d8(m.end)}.`);
  y = pdfPara(doc, y, 'Article 3 — Commission', `Le mandataire perçoit ${m.rate} % des loyers encaissés, prélevés avant reversement au mandant.`);
  y = pdfPara(doc, y, 'Article 4 — Services inclus', m.services.join(' · ') || 'Selon accord des parties.');
  y = pdfPara(doc, y, 'Article 5 — Reddition de comptes', 'Un relevé des loyers encaissés, des dépenses et du solde reversé est remis au mandant à chaque période convenue.');
  pdfSign(doc, y + 2, 'Le mandant', 'Le mandataire');
  return pdfEnd(doc, u, m.ref);
}
const _autoFile = autoFile;
autoFile = async function (kind, obj) {
  if (kind !== 'mandate') return _autoFile(kind, obj);
  const u = Auth.current(); if (!u || !obj || archived(obj.ref)) return null;
  try {
    await loadPdf(); const f = pdfMandate(obj, u);
    const rec = DB.addItem(DB.K.documents, {ownerId: u.id, name: f.name, mime: 'application/pdf', dataUrl: await b64(f.blob),
      cat: 'contrats', propertyId: '', expiry: '', srcRef: obj.ref, auto: true});
    return DB.lastWriteOk ? rec : null;
  } catch { return null; }
};
const _pdfFor = pdfFor;
pdfFor = function (name, u) {
  if (/^MDT-/.test(name)) { const m = DB.findItem(DB.K.mandates, x => x.ref === name && x.ownerId === u.id); return m && ['gestion', pdfMandate, m, u]; }
  return _pdfFor(name, u);
};

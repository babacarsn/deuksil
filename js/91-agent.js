/* ==========================================================================
   MODULE : agent.js — l'espace de l'agent immobilier (membre d'une agence,
   rôle « agent »). Il réutilise les écrans de l'agence avec un filtre « les
   miens » : aucun écran en double.
     1. Menu et barre du bas de l'agent (Messages et Visites retrouvés).
     2. Son tableau de bord : visites du jour et à venir, ses biens, ses
        clients, sa commission, ce qu'il a à traiter.
     3. Mes biens par défaut, « Toute l'agence » en un clic ; un bien qu'il
        publie lui est attribué.
     4. Mes visites, avec compte rendu (intéressé, pas intéressé, offre,
        à revoir) ; une offre sur un bien à vendre ouvre un dossier de vente.
     5. Mes clients : ses demandes seulement.
     6. Mes commissions : les siennes seulement.
     7. Mon profil : téléphone et mot de passe.
   ========================================================================== */
const estAgent = u => !!(u && u.member && u.member.role === 'agent');
const moi = u => u.member;
const biensAgent = u => myProps(u).filter(p => p.agentId === moi(u).id);
const visitesAgent = u => DB.filterItems(DB.K.visits, v => v.ownerId === u.id && (v.agentId === moi(u).id || (gProp(v.propertyId) || {}).agentId === moi(u).id));

/* --- 1. Menu et barre du bas -------------------------------------------- */
const MENU_AGENT = [
  ['#/agency/dashboard', 'Tableau de bord', 'grid'], ['#/agency/properties', 'Mes biens', 'home'],
  ['#/agency/visits', 'Mes visites', 'calendar'], ['#/agency/clients', 'Mes clients', 'users'],
  ['#/agency/messages', 'Messages', 'message'], ['#/agent/commissions', 'Mes commissions', 'wallet'],
  ['#/agent/profil', 'Mon profil', 'user']];
(() => {
  const base = MENUS_RAW.agency;
  Object.defineProperty(MENUS_RAW, 'agency', {configurable: true, enumerable: true,
    get() { let u = null; try { u = Auth.current(); } catch (e) {} return estAgent(u) ? MENU_AGENT : base; },
    set(v) { /* le menu de l'agence reste modifiable par les autres modules */ base.splice(0, base.length, ...v); }});
})();
const BARRE_AGENT = [['#/agency/dashboard', 'Accueil', 'grid'], ['#/agency/properties', 'Mes biens', 'home'],
  ['#/owner/property/new', 'Publier', 'plus', 'fab'], ['#/agency/visits', 'Visites', 'calendar'], ['#/agency/messages', 'Messages', 'message']];
const _tabBarAgent = tabBarHtml;
tabBarHtml = function (u, path) {
  if (!estAgent(u)) return _tabBarAgent(u, path);
  const actif = h => path === h.slice(1) || path.startsWith(h.slice(1) + '/');
  return `<nav class="tabbar" aria-label="Navigation principale">${BARRE_AGENT.filter(([h]) => memberCan(u, permFor(h.slice(1)))).map(([h, l, ic, fab]) =>
    fab ? `<a class="tab-fab" href="${h}"><i>${icon(ic, 22)}</i><span>${esc(l)}</span></a>`
        : `<a href="${h}" class="tab-item ${actif(h) ? 'active' : ''}">${icon(ic, 21)}<span>${esc(l)}</span></a>`).join('')}</nav>`;
};
/* Un bien publié par un agent lui est attribué d'office. */
const _addItemAgent = DB.addItem.bind(DB);
DB.addItem = function (k, item) {
  if (k === DB.K.properties && item && !item.agentId) { try { const u = Auth.current(); if (estAgent(u) && item.ownerId === u.id) item = {...item, agentId: moi(u).id, apporteurId: moi(u).id}; } catch (e) {} }
  return _addItemAgent(k, item);
};

/* --- 2. Tableau de bord de l'agent ---------------------------------------- */
const VISITE_CR = {interesse: ['Intéressé', 'ok'], offre: ['A fait une offre', 'ok'], revoir: ['À revoir', 'warn'], pas: ['Pas intéressé', '']};
function heureVisite(v) { return (v.date || '') + ' ' + (v.time || '00:00'); }
function tableauAgent(u) {
  const m = moi(u), aujourd = ymd(), vis = visitesAgent(u), biens = biensAgent(u);
  const aVenir = vis.filter(v => ['attente', 'acceptee', 'reportee'].includes(v.status) && v.date >= aujourd).sort((a, b) => heureVisite(a) < heureVisite(b) ? -1 : 1);
  const duJour = aVenir.filter(v => v.date === aujourd), aConfirmer = vis.filter(v => v.status === 'attente');
  const sansCR = vis.filter(v => ['acceptee', 'terminee'].includes(v.status) && v.date && v.date < aujourd && !v.cr);
  const dms = DB.filterItems(DB.K.demandes, d => d.ownerId === u.id && d.status !== 'close' && d.agentId === m.id);
  const sansBien = dms.filter(d => !biensPour(u, d).length);
  const fees = DB.filterItems(DB.K.fees, f => f.ownerId === u.id && concerne(f, m.id));
  const du = fees.filter(f => f.status === 'paye' && !f.agentPaidAt).reduce((s, f) => s + partDe(f, m.id), 0);
  const mois = curMonth(), gagneMois = fees.filter(f => String(f.createdAt || '').slice(0, 7) === mois).reduce((s, f) => s + partDe(f, m.id), 0);
  const attente = fees.filter(f => f.status === 'du').reduce((s, f) => s + partDe(f, m.id), 0);
  const mini = (href, tone, ic, lab, val, foot) => `<a class="pd-card pd-mini" data-tone="${tone}" href="${href}"><span class="pd-ic">${icon(ic, 22)}</span>
    <span class="pd-lab">${lab}</span><b class="pd-val">${val}</b><span class="pd-foot">${foot}</span></a>`;
  const ligneVisite = v => { const p = gProp(v.propertyId) || {}, c = clientVisite(v);
    return `<a class="trow" href="#/agency/visits"><span class="itile sm">${icon('calendar', 17)}</span><div class="txt" style="min-width:0"><b>${v.date === aujourd ? 'Aujourd\'hui' : dateFr(v.date)} · ${esc(v.time || '')}</b>
      <div class="sub">${esc(displayName(c) || 'Client')} · ${esc(p.title || '')}${v.status === 'attente' ? ' · à confirmer' : ''}</div></div>${icon('arrowRight', 16)}</a>`; };
  const todo = [
    ...(aConfirmer.length ? [[`${pluriel(aConfirmer.length, 'visite')} à confirmer`, 'Acceptez, reportez ou refusez', '#/agency/visits', 'calendar', 'warn']] : []),
    ...(sansCR.length ? [[`${pluriel(sansCR.length, 'compte rendu', 'comptes rendus')} de visite à faire`, sansCR.slice(0, 2).map(v => (gProp(v.propertyId) || {}).title).join(', '), '#/agency/visits', 'file', 'warn']] : []),
    ...(sansBien.length ? [[`${pluriel(sansBien.length, 'client')} sans bien correspondant`, sansBien.slice(0, 2).map(d => d.name).join(', ') + ' · élargissez la recherche ou rentrez un bien', '#/agency/clients', 'users', '']] : [])];
  return shellApp(u, `<div class="hero-banner" style="min-height:170px">
      <div class="scene-bg"><img src="${PHOTOS.bnAgency}" alt="" loading="lazy"></div>
      <div class="content"><span class="wave">Bonjour ${esc(m.firstName)}</span>
        <h1 style="font-size:1.5rem">${duJour.length ? `${pluriel(duJour.length, 'visite')} aujourd'hui` : 'Votre journée'}</h1>
        <div class="hero-pills"><a href="#/agency/visits" data-action="agent-planif">${icon('calendar', 15)} Planifier une visite</a><a href="#/agency/clients">${icon('users', 15)} Nouvelle demande</a></div></div></div>
    <div class="pd">
      <section class="pd-card pd-rev" data-tone="brand"><div class="pd-rev-head"><div style="min-width:0"><h3 class="pd-h">Ma commission</h3><p class="pd-sub">À recevoir de l'agence</p></div>
        <div class="pd-month">${icon('calendar', 18)}<b>${moisCourt(mois)} ${mois.slice(0, 4)}</b></div></div>
        <div class="pd-big">${money(du)}</div>
        <p class="pd-note">${icon('wallet', 17)}<span>${money(gagneMois)} gagnés ce mois · ${money(attente)} en attente d'encaissement par l'agence</span></p>
        <a class="pd-more" href="#/agent/commissions"><span>Voir mes commissions</span>${icon('arrowRight', 17)}</a></section>
      <div class="pd-duo pa-quad">
        ${mini('#/agency/visits', duJour.length ? 'gold' : 'brand', 'calendar', 'Visites aujourd\'hui', String(duJour.length), `${aVenir.length} à venir`)}
        ${mini('#/agency/visits', aConfirmer.length ? 'bad' : 'ok', aConfirmer.length ? 'alert' : 'checkCircle', 'À confirmer', String(aConfirmer.length), 'demandes de visite')}
        ${mini('#/agency/properties', 'info', 'home', 'Mes biens', String(biens.length), `${biens.filter(p => ['disponible', 'discussion'].includes(p.status)).length} disponibles`)}
        ${mini('#/agency/clients', 'ok', 'users', 'Mes clients', String(dms.length), 'demandes en cours')}
      </div>
      <section class="pd-card pd-todo" data-tone="brand"><div class="pd-pat-head"><h3 class="pd-h">Prochaines visites</h3><a class="pd-all" href="#/agency/visits">Tout voir ${icon('arrowRight', 16)}</a></div>
        ${aVenir.length ? aVenir.slice(0, 4).map(ligneVisite).join('') : '<p class="pd-foot" style="margin:4px 0 0">Aucune visite prévue.</p>'}</section>
      <section class="pd-card pd-todo" data-tone="${todo.length ? 'bad' : 'ok'}"><div class="pd-pat-head"><h3 class="pd-h">À traiter</h3>${todo.length ? `<span class="badge bad">${todo.length}</span>` : ''}</div>
        ${todo.length ? todo.map(([t, sub, h, ic, tone]) => `<a class="trow" href="${h}"><span class="itile sm ${tone === 'warn' ? 'gold' : ''}">${icon(ic, 17)}</span><div class="txt" style="min-width:0"><b>${esc(t)}</b><div class="sub">${esc(sub)}</div></div>${icon('arrowRight', 16)}</a>`).join('')
          : '<p class="pd-foot" style="margin:4px 0 0">Rien à traiter.</p>'}</section>
      <section class="pd-actions"><h3 class="pd-h" style="margin-bottom:12px">Actions rapides</h3><div class="qa-grid">
        ${[['#/owner/property/new', 'Ajouter un bien', 'plus', 'brand'], ['#/agency/clients', 'Nouvelle demande client', 'users', 'ok'], ['#/agency/visits', 'Planifier une visite', 'calendar', 'gold', 'agent-planif'], ['#/agent/commissions', 'Mes commissions', 'wallet', 'info']]
          .map(([h, l, ic, t, a]) => `<a class="quick-card pd-qa" data-tone="${t}" href="${h}"${a ? ` data-action="${a}"` : ''}><div class="ic-bubble">${icon(ic, 17)}</div><b>${l}</b></a>`).join('')}</div></section>
    </div>`);
}
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/dashboard$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => { const u = Auth.current(); return estAgent(u) ? tableauAgent(u) : f(...a); };
})();

/* --- 3. Mes biens / Toute l'agence ----------------------------------------- */
let agentPortee = 'miens';
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/properties$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => {
    const u = Auth.current(); if (!estAgent(u)) return f(...a);
    const tous = myProps(u), miens = tous.filter(p => p.agentId === moi(u).id);
    const base = myProps;
    if (agentPortee === 'miens') myProps = x => base(x).filter(p => p.agentId === moi(u).id);
    let h; try { h = f(...a); } finally { myProps = base; }
    if (h === false) return h;
    const seg = `<div class="seg" style="margin:0 0 14px" role="tablist">
      <button type="button" class="seg-b ${agentPortee === 'miens' ? 'on' : ''}" data-action="agent-portee" data-v="miens">${icon('user', 16)} Mes biens <span class="bf-c">${miens.length}</span></button>
      <button type="button" class="seg-b ${agentPortee === 'tous' ? 'on' : ''}" data-action="agent-portee" data-v="tous">${icon('building', 16)} Toute l'agence <span class="bf-c">${tous.length}</span></button></div>`;
    h = h.replace(/<(h[12])>Portefeuille de biens<\/\1>/, '<$1>Mes biens</$1>');
    return h.includes('<div class="rfiltre') ? h.replace('<div class="rfiltre', seg + '<div class="rfiltre')
      : h.replace(/(<div class="page-head">[\s\S]*?<div class="row">[\s\S]*?<\/div><\/div>)/, `$1${seg}`);
  };
})();
document.addEventListener('click', e => { const b = e.target.closest('[data-action="agent-portee"]'); if (!b) return; agentPortee = b.dataset.v; render(); });

/* --- 4. Mes visites + compte rendu ---------------------------------------- */
(() => {
  const r = routes.find(x => x.re.source === '^\\/(owner|agency)\\/visits$'); if (!r) return;
  const f = r.fn;
  r.fn = (role, ...a) => {
    const u = Auth.current(); if (role !== 'agency' || !u || u.role !== 'agency') return f(role, ...a);
    if (u.member && !memberCan(u, 'visites')) { toast('Accès non autorisé pour votre profil.', 'bad'); go(Auth.home(u)); return false; }
    const agent = estAgent(u), aujourd = ymd();
    const vis = (agent ? visitesAgent(u) : DB.filterItems(DB.K.visits, v => v.ownerId === u.id)).slice().sort((x, y) => heureVisite(x) < heureVisite(y) ? 1 : -1);
    const nomAgent = id => { const a = id && DB.findItem(DB.K.users, id); return a ? a.firstName : ''; };
    const rows = vis.map(v => { const c = clientVisite(v), p = gProp(v.propertyId) || {}, cr = v.cr && VISITE_CR[v.cr.outcome];
      const sansAgent = !agent && !(v.agentId || p.agentId) && ['attente', 'acceptee', 'reportee'].includes(v.status) && (v.date || '') >= aujourd;
      const passee = v.date && v.date <= aujourd;
      return `<tr><td><div class="row">${avatarHtml(c, 36)}<div><b class="small">${esc(displayName(c) || 'Client')}</b><div class="small muted"><a href="${telHref(c.phone)}" style="color:inherit;text-decoration:none">${icon('phone', 11)} ${esc(c.phone || '')}</a></div></div></div></td>
        <td class="small">${esc(p.title || '—')}${!agent && (v.agentId || p.agentId) ? `<br><span class="muted">Agent : ${esc(nomAgent(v.agentId || p.agentId))}</span>` : ''}${sansAgent ? '<br>' + badge('Sans agent', 'warn') : ''}</td>
        <td>${v.date === aujourd ? '<b>Aujourd\'hui</b>' : dateFr(v.date)}<div class="small muted">${esc(v.time || '')}</div></td>
        <td>${badge(VISIT_LABEL[v.status] || v.status, VISIT_TONE[v.status])}${cr ? '<br>' + badge(cr[0], cr[1]) : ''}${v.cr && v.cr.note ? `<div class="small muted" style="margin-top:4px">${esc(v.cr.note)}</div>` : ''}</td>
        <td><div class="row" style="gap:6px">
          ${v.status === 'attente' ? `<button class="btn sm" data-action="visit-status" data-id="${v.id}" data-s="acceptee">Accepter</button><button class="btn ghost sm" data-action="visit-status" data-id="${v.id}" data-s="reportee">Reporter</button><button class="btn ghost sm" data-action="visit-status" data-id="${v.id}" data-s="refusee">Refuser</button>` : ''}
          ${['acceptee', 'terminee'].includes(v.status) && passee ? `<button class="btn ${v.cr ? 'ghost ' : ''}sm" data-action="agent-cr" data-id="${v.id}">${v.cr ? 'Modifier le compte rendu' : 'Compte rendu'}</button>` : ''}
          ${v.status === 'acceptee' && !passee ? `<button class="btn ghost sm" data-action="visit-status" data-id="${v.id}" data-s="reportee">Reporter</button>` : ''}
          ${sansAgent ? `<button class="btn sm" data-action="ag-confier" data-id="${v.id}">Confier</button>` : ''}
        </div></td></tr>`; });
    const planif = `<button class="btn" data-action="agent-planif">${icon('plus', 16)} Planifier une visite</button>`;
    return shellApp(u, page(agent ? 'Mes visites' : 'Visites', agent ? 'Les visites de vos biens : confirmez-les, puis notez ce que le client en a pensé.' : 'Toutes les visites de l\'agence et leurs comptes rendus.', planif) +
      gTable(['Client', 'Bien', 'Créneau', 'État', ''], rows, ['Aucune visite', agent ? 'Les demandes de visite sur vos biens apparaîtront ici.' : 'Publiez une annonce pour recevoir des demandes de visite.']));
  };
})();
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="agent-cr"]'); if (!b) return;
  const u = Auth.current(); if (!u || u.role !== 'agency' || !memberCan(u, 'visites') && u.member) return;
  const v = DB.findItem(DB.K.visits, x => x.id === b.dataset.id && x.ownerId === u.id); if (!v) return;
  if (estAgent(u) && !visitesAgent(u).some(x => x.id === v.id)) return toast('Cette visite ne vous est pas attribuée.', 'bad');
  const p = gProp(v.propertyId) || {}, cr = v.cr || {};
  modal('Compte rendu de visite', `<form data-action="agent-cr-ok" data-id="${v.id}" data-sub="${esc(p.title || '')}"><p class="small muted" style="margin-top:0">${esc(p.title || '')} · ${dateFr(v.date)}</p>
    <div class="field"><label>Le client est</label><select class="input" name="outcome" data-action="agent-cr-type">${Object.entries(VISITE_CR).map(([k, [l]]) => `<option value="${k}" ${cr.outcome === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field" data-cr-offre style="${cr.outcome === 'offre' ? '' : 'display:none'}"><label>Montant proposé (FCFA)</label><input class="input" type="number" name="offre" min="1" value="${cr.offre || ''}"></div>
    <div class="field"><label>Note</label><textarea class="input" name="note" placeholder="Ce qui a plu, ce qui bloque, prochaine étape…">${esc(cr.note || '')}</textarea></div>
    <div class="row" style="gap:10px"><button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
});
document.addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('[data-action="agent-cr-type"]'); if (!s) return;
  const z = s.form.querySelector('[data-cr-offre]'); if (z) z.style.display = s.value === 'offre' ? '' : 'none';
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="agent-cr-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency') return;
  if (u.member && !memberCan(u, 'visites')) return toast('Action non autorisée pour votre profil.', 'bad');
  const v = DB.findItem(DB.K.visits, x => x.id === f.dataset.id && x.ownerId === u.id); if (!v) return;
  if (estAgent(u) && !visitesAgent(u).some(x => x.id === v.id)) return toast('Cette visite ne vous est pas attribuée.', 'bad');
  const d = formData(f); if (!VISITE_CR[d.outcome]) return;
  if (d.outcome === 'offre' && !(+d.offre > 0)) return toast('Indiquez le montant proposé.', 'bad');
  const cr = {outcome: d.outcome, note: (d.note || '').trim(), offre: d.outcome === 'offre' ? +d.offre : 0, by: u.member ? u.member.id : u.id, at: now()};
  DB.updateItem(DB.K.visits, v.id, {cr, status: 'terminee', agentId: v.agentId || (gProp(v.propertyId) || {}).agentId || ''});
  let msg = 'Compte rendu enregistré.';
  const p = gProp(v.propertyId), client = clientVisite(v);
  if (d.outcome === 'offre' && p && p.transaction !== 'location' && !DB.findItem(DB.K.deals, x => x.propertyId === p.id && x.clientId === v.clientId && x.stage !== 'signe')) {
    DB.addItem(DB.K.deals, {ownerId: u.id, propertyId: p.id, clientId: v.clientId || '', buyer: displayName(client) || 'Acquéreur', phone: (client || {}).phone || '', offer: cr.offre, price: cr.offre, stage: 'offre', agentId: cr.by, createdAt: now()});
    notify(u.id, `Offre de ${money(cr.offre)} sur « ${p.title} » (visite de ${displayName(client) || 'un client'}) : dossier de vente ouvert.`, '#/manage/deals');
    msg = 'Compte rendu enregistré : un dossier de vente est ouvert pour l\'offre.';
  } else if (u.member) notify(u.id, `Compte rendu de ${u.member.firstName} : ${VISITE_CR[d.outcome][0]} pour « ${(p || {}).title || ''} ».`, '#/agency/visits');
  audit('Compte rendu de visite', `${(p || {}).title || ''} · ${VISITE_CR[d.outcome][0]}`);
  closeModal(); toast(msg); render();
}, true);

/* --- 5. Mes clients : ses demandes seulement ------------------------------- */
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/clients$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => {
    const u = Auth.current(); if (!estAgent(u)) return f(...a);
    /* Pendant l'affichage, les demandes vues sont celles de l'agent. */
    const base = DB.filterItems;
    DB.filterItems = function (k, pred) { const res = base.call(DB, k, pred); return k === DB.K.demandes ? res.filter(x => x.agentId === moi(u).id) : res; };
    let h; try { h = f(...a); } finally { DB.filterItems = base; }
    if (h === false) return h;
    return h.replace(/<(h[12])>Clients<\/\1>/, '<$1>Mes clients</$1>')
      .replace(/<div class="field"><label>Agent qui suit<\/label>[\s\S]*?<\/select><\/div>/, '');
  };
})();

/* --- 6. Mes commissions ------------------------------------------------------ */
route(/^\/agent\/commissions$/, () => {
  const u = Auth.current();
  if (!estAgent(u)) { toast('Page réservée aux agents.', 'bad'); go(u ? Auth.home(u) : '#/login'); return false; }
  const me = moi(u).id, R = regles(u);
  const fees = DB.filterItems(DB.K.fees, f => f.ownerId === u.id && concerne(f, me)).slice().reverse();
  const verse = fees.filter(f => f.agentPaidAt).reduce((s, f) => s + partDe(f, me), 0);
  const du = fees.filter(f => f.status === 'paye' && !f.agentPaidAt).reduce((s, f) => s + partDe(f, me), 0);
  const attente = fees.filter(f => f.status === 'du').reduce((s, f) => s + partDe(f, me), 0);
  const role = f => !f.apporteurId ? 'Rentrée et conclusion' : f.apporteurId === me ? 'Vous avez rentré le bien' : 'Vous avez conclu';
  const rows = fees.map(f => { const p = gProp(f.propertyId) || {};
    const etat = f.agentPaidAt ? badge('Versée le ' + dateFr(f.agentPaidAt), 'ok') : f.status === 'paye' ? badge('À recevoir', 'warn') : badge('En attente du client', '');
    return `<tr><td class="small"><b>${esc(p.title || '—')}</b><br><span class="muted">${f.kind === 'vente' ? 'Vente' : 'Location'} · ${dateFr(f.createdAt)}</span></td>
      <td>${money(f.ht)}</td><td><b>${money(partDe(f, me))}</b><br><span class="small muted">${role(f)}</span></td><td>${etat}</td></tr>`; });
  return shellApp(u, page('Mes commissions', `Part agent : ${R.agentPct} % des honoraires hors taxes. Si un collègue a rentré le bien, il en garde ${R.partRentree} %.`) +
    `<div class="kpis">${kpi(money(du), 'À recevoir de l\'agence', 'warn')}${kpi(money(verse), 'Déjà versé', 'ok')}${kpi(money(attente), 'En attente d\'encaissement', 'brand')}${kpi(String(fees.length), 'Locations et ventes conclues', 'brand')}</div>
    <p class="small muted" style="margin:12px 0 16px">Une commission devient « à recevoir » quand l'agence a encaissé ses honoraires auprès du client.</p>` +
    gTable(['Affaire', 'Honoraires HT', 'Ma part', 'État'], rows, ['Aucune commission pour l\'instant', 'Chaque location ou vente conclue sur un de vos biens vous rapporte une part des honoraires.']));
});

/* --- 7. Mon profil ------------------------------------------------------------ */
route(/^\/agent\/profil$/, () => {
  const u = Auth.current();
  if (!u || !u.member) { go(u ? Auth.home(u) : '#/login'); return false; }
  const m = DB.findItem(DB.K.users, u.member.id) || u.member;
  return shellApp(u, page('Mon profil', `${MEMBER_LABEL[m.role] || 'Membre'} chez ${esc(u.agencyName || ownerLabel(u))}`) + `
    <form class="card" data-action="agent-profil" style="max-width:640px" data-sub="Vos coordonnées"><h4>Mes informations</h4>
      <div class="form-grid"><div class="field"><label>Prénom</label><input class="input" value="${esc(m.firstName)}" disabled></div>
        <div class="field"><label>Nom</label><input class="input" value="${esc(m.lastName)}" disabled></div>
        <div class="field"><label>Adresse e-mail (identifiant de connexion)</label><input class="input" value="${esc(m.email || '')}" disabled></div>
        <div class="field"><label>Téléphone</label><input class="input" type="tel" name="phone" value="${esc(m.phone || '')}" required></div></div>
      <p class="small muted">Nom et adresse e-mail se modifient par le responsable de l'agence.</p>
      <button class="btn">Enregistrer</button></form>
    <form class="card" data-action="agent-mdp" style="max-width:640px;margin-top:16px" data-sub="8 caractères minimum"><h4>Changer mon mot de passe</h4>
      <div class="form-grid"><div class="field"><label for="ag-mdp-ancien">Mot de passe actuel</label><input class="input" id="ag-mdp-ancien" type="password" name="ancien" required autocomplete="current-password"></div>
        <div class="field"><label for="ag-mdp-nouveau">Nouveau mot de passe</label><input class="input" id="ag-mdp-nouveau" type="password" name="nouveau" minlength="8" required autocomplete="new-password" placeholder="8 caractères minimum"></div>
        <div class="field"><label for="ag-mdp-confirme">Confirmer</label><input class="input" id="ag-mdp-confirme" type="password" name="confirme" minlength="8" required autocomplete="new-password" placeholder="Retapez le mot de passe"></div></div>
      <button class="btn">Changer le mot de passe</button></form>`);
});
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="agent-profil"],form[data-action="agent-mdp"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || !u.member) return;
  const m = DB.findItem(DB.K.users, u.member.id); if (!m) return;
  const d = formData(f);
  if (f.dataset.action === 'agent-profil') {
    if (String(d.phone).replace(/\D/g, '').length < 9) return toast('Indiquez un téléphone valide (9 chiffres).', 'bad');
    DB.updateItem(DB.K.users, m.id, {phone: d.phone.trim()}); toast('Téléphone enregistré.');
  } else {
    if (d.nouveau === d.ancien) return toast('Choisissez un mot de passe différent de l\'actuel.', 'bad');
    const refus = refusNouveauMotDePasse(d.nouveau, d.confirme); if (refus) return toast(refus, 'bad');
    const err = await changerMonMotDePasse(d.ancien, d.nouveau); if (err) return toast(err, 'bad');
    audit('Mot de passe modifié', `${m.firstName} ${m.lastName}`); toast('Mot de passe changé.'); f.reset();
  }
  render();
}, true);

/* Le panneau du compte (mobile) et le menu mènent l'agent à son profil. */
if (typeof DS_FORM_IC !== 'undefined') DS_FORM_IC.unshift([/agent-profil/, 'user'], [/agent-mdp/, 'key'], [/agent-cr/, 'file']);

/* ==========================================================================
   Suite — six pratiques d'agence :
     8.  Planifier une visite soi-même (client sans compte possible).
     9.  Visites sans agent : signalées au responsable, qui les confie.
     10. Messages : l'agent voit ses conversations et celles que personne ne
         suit encore ; le responsable voit tout.
     11. Rappels : la veille et le jour de chaque visite.
     12. Biens publiés par un agent : validés par le responsable (réglable).
     13. Commission partagée rentrée / sortie (voir agence-metier.js).
   ========================================================================== */
const chiffres9 = x => String(x || '').replace(/\D/g, '').slice(-9);
/* Le client d'une visite : un compte, ou un nom et un téléphone notés par l'agent. */
function clientVisite(v) {
  const c = v.clientId && DB.findItem(DB.K.users, v.clientId);
  return c || {firstName: v.clientName || 'Client', lastName: '', phone: v.clientPhone || '', role: 'client'};
}
const agentDeVisite = v => v.agentId || (gProp(v.propertyId) || {}).agentId || '';

/* --- 8. Planifier une visite ------------------------------------------------ */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="agent-planif"]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  /* L'agence, ses agents, et le propriétaire indépendant (pas le mandant, dont l'agence s'occupe). */
  const u = Auth.current(); if (!u || !['agency', 'owner'].includes(u.role) || (typeof estMandant === 'function' && estMandant(u))) return;
  if (u.member && !memberCan(u, 'visites')) return toast('Action non autorisée pour votre profil.', 'bad');
  const dm = b.dataset.dm && DB.findItem(DB.K.demandes, x => x.id === b.dataset.dm && x.ownerId === u.id);
  const agent = estAgent(u);
  const biens = (agent && agentPortee === 'miens' && biensAgent(u).length ? biensAgent(u) : myProps(u))
    .filter(p => !['vendu', 'archive', 'loue'].includes(p.status) && p.listingStatus !== 'archivee');
  if (!biens.length) return toast('Aucun bien disponible à faire visiter.', 'bad');
  const conseille = dm ? (biensPour(u, dm)[0] || {}).id : '';
  const equipe = agent ? [] : membresDe(u).filter(m => m.role === 'agent' && m.status === 'actif');
  modal('Planifier une visite', `<form data-action="agent-planif-ok" data-sub="Rendez-vous pris avec le client"${dm ? ` data-dm="${dm.id}"` : ''}>
    <div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>Bien à visiter</label><select class="input" name="propertyId" required>${biens.map(p => `<option value="${p.id}" ${p.id === conseille ? 'selected' : ''}>${esc(p.title)} · ${money(p.price)}</option>`).join('')}</select></div>
      <div class="field"><label>Client</label><input class="input" name="name" required placeholder="Nom complet" value="${esc(dm ? dm.name : '')}"></div>
      <div class="field"><label>Téléphone</label><input class="input" type="tel" name="phone" required placeholder="77 000 00 00" value="${esc(dm ? dm.phone : '')}"></div>
      <div class="field"><label>Date</label><input class="input" type="date" name="date" required min="${ymd()}" value="${ymd()}"></div>
      <div class="field"><label>Heure</label><input class="input" type="time" name="time" required value="10:00" step="900"></div>
      ${equipe.length ? `<div class="field" style="grid-column:1/-1"><label>Agent qui fait visiter</label><select class="input" name="agentId"><option value="">L'agent du bien (ou moi)</option>${equipe.map(m => `<option value="${m.id}">${esc(m.firstName)} ${esc(m.lastName)}</option>`).join('')}</select></div>` : ''}
      <div class="field" style="grid-column:1/-1"><label>Note (facultatif)</label><input class="input" name="note" placeholder="Point de rendez-vous, accès, clés…"></div>
    </div>
    <div class="row" style="gap:10px;margin-top:6px"><button class="btn">Planifier</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
}, true);
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="agent-planif-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || !['agency', 'owner'].includes(u.role) || (typeof estMandant === 'function' && estMandant(u))) return;
  if (u.member && !memberCan(u, 'visites')) return toast('Action non autorisée pour votre profil.', 'bad');
  const d = formData(f), p = DB.findItem(DB.K.properties, x => x.id === d.propertyId && x.ownerId === u.id);
  if (!p) return toast(u.role === 'agency' ? 'Choisissez un bien de l\'agence.' : 'Choisissez un de vos biens.', 'bad');
  if (!String(d.name || '').trim()) return toast('Indiquez le nom du client.', 'bad');
  if (chiffres9(d.phone).length < 9) return toast('Indiquez un téléphone valide (9 chiffres).', 'bad');
  if (!d.date || d.date < ymd()) return toast('La date ne peut pas être passée.', 'bad');
  if (!/^\d\d:\d\d$/.test(d.time || '')) return toast('Indiquez l\'heure du rendez-vous.', 'bad');
  if (d.date === ymd() && d.time < new Date().toTimeString().slice(0, 5)) return toast('Cette heure est déjà passée.', 'bad');
  if (DB.findItem(DB.K.visits, v => v.propertyId === p.id && v.date === d.date && v.time === d.time && ['acceptee', 'attente'].includes(v.status)))
    return toast('Ce bien a déjà une visite à cette date et à cette heure.', 'bad');
  if (d.agentId && !DB.findItem(DB.K.users, x => x.id === d.agentId && x.parentId === u.id)) return toast('Agent inconnu.', 'bad');
  const tel = chiffres9(d.phone), compte = DB.findItem(DB.K.users, x => x.role === 'client' && chiffres9(x.phone) === tel);
  if (compte && DB.findItem(DB.K.visits, v => v.propertyId === p.id && v.clientId === compte.id && ['acceptee', 'attente'].includes(v.status) && v.date >= ymd())) return toast('Ce client a déjà une visite prévue pour ce bien.', 'bad');
  const agentId = estAgent(u) ? moi(u).id : (d.agentId || p.agentId || '');
  DB.addItem(DB.K.visits, {ownerId: u.id, propertyId: p.id, clientId: compte ? compte.id : '', clientName: d.name.trim(), clientPhone: d.phone.trim(),
    date: d.date, time: d.time, status: 'acceptee', agentId, note: (d.note || '').trim(), source: u.role === 'owner' ? 'proprietaire' : 'agence', planifieePar: u.member ? u.member.id : u.id, createdAt: now()});
  if (p.status === 'disponible') DB.updateItem(DB.K.properties, p.id, {status: 'discussion'});
  if (compte) notify(compte.id, `Visite confirmée : « ${p.title} » le ${dateFr(d.date)} à ${d.time}.`, '#/client/visits');
  if (agentId && agentId !== (u.member || {}).id) notify(agentId, `Nouvelle visite pour vous : « ${p.title} » le ${dateFr(d.date)} à ${d.time} avec ${d.name.trim()}.`, '#/agency/visits');
  audit('Visite planifiée', `${p.title} · ${dateFr(d.date)} ${d.time}`);
  closeModal(); toast(`Visite planifiée le ${dateFr(d.date)} à ${d.time}.`);
  const ecran = `#/${u.role}/visits`; if (location.hash !== ecran) go(ecran); else render();
}, true);

/* --- 9. Confier une visite sans agent ---------------------------------------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-confier"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(); if (!u || u.role !== 'agency' || estAgent(u)) return;
  const v = DB.findItem(DB.K.visits, x => x.id === b.dataset.id && x.ownerId === u.id); if (!v) return;
  const equipe = membresDe(u).filter(m => m.role === 'agent' && m.status === 'actif');
  if (!equipe.length) return toast('Ajoutez d\'abord un agent dans Paramètres › Équipe.', 'bad');
  const p = gProp(v.propertyId) || {};
  modal('Confier la visite', `<form data-action="ag-confier-ok" data-id="${v.id}" data-sub="${esc(p.title || '')}"><p class="small muted" style="margin-top:0">${esc(p.title || '')} · ${dateFr(v.date)} ${esc(v.time || '')}</p>
    <div class="field"><label>Agent</label><select class="input" name="agentId" required>${equipe.map(m => `<option value="${m.id}">${esc(m.firstName)} ${esc(m.lastName)}</option>`).join('')}</select></div>
    <label class="check" style="margin:0 0 14px"><input type="checkbox" name="bien" checked> Lui confier aussi le bien (ses prochaines visites lui iront)</label><br>
    <div class="row" style="gap:10px"><button class="btn">Confier</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-confier-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency' || estAgent(u)) return;
  const v = DB.findItem(DB.K.visits, x => x.id === f.dataset.id && x.ownerId === u.id); if (!v) return;
  const d = formData(f), m = DB.findItem(DB.K.users, x => x.id === d.agentId && x.parentId === u.id && x.role === 'agent'); if (!m) return toast('Agent inconnu.', 'bad');
  DB.updateItem(DB.K.visits, v.id, {agentId: m.id});
  const p = gProp(v.propertyId);
  if (d.bien && p && !p.agentId) DB.updateItem(DB.K.properties, p.id, {agentId: m.id});
  notify(m.id, `Visite confiée : « ${(p || {}).title || ''} » le ${dateFr(v.date)} à ${v.time || ''}.`, '#/agency/visits');
  audit('Visite confiée', `${(p || {}).title || ''} → ${m.firstName}`);
  closeModal(); toast(`Visite confiée à ${m.firstName}.`); render();
}, true);

/* --- 10. Messages : chacun ses conversations ---------------------------------- */
function filVisible(u, t) {
  if (!estAgent(u)) return true;
  const me = moi(u).id;
  if (t.agentId) return t.agentId === me;
  const p = t.propertyId && gProp(t.propertyId);
  if (p && p.agentId) return p.agentId === me;
  const autre = DB.findItem(DB.K.users, (t.participants || []).find(x => x !== u.id)) || {}, tel = chiffres9(autre.phone || t.phone);
  const dm = tel && DB.findItem(DB.K.demandes, d => d.ownerId === u.id && d.status !== 'close' && d.agentId && chiffres9(d.phone) === tel);
  if (dm) return dm.agentId === me;
  return true;   // personne ne suit encore ce client : visible de tous
}
const _filterAgent = DB.filterItems;
DB.filterItems = function (k, pred) {
  const res = _filterAgent.call(DB, k, pred);
  let u = null; try { u = Auth.current(); } catch (e) {}
  if (!u || !u.member) return res;
  if (k === DB.K.messages && estAgent(u)) return res.filter(t => filVisible(u, t));
  if (k === DB.K.notifications) {
    /* Les notifications personnelles d'un membre s'ajoutent à celles de l'agence. */
    const perso = _filterAgent.call(DB, k, n => n.userId === u.member.id && pred({...n, userId: u.id}));
    return perso.length ? res.concat(perso).sort((a, b) => (a.createdAt || '') < (b.createdAt || '') ? -1 : 1) : res;
  }
  return res;
};
/* Le premier agent qui répond devient celui qui suit la conversation. */
const _updateAgent = DB.updateItem;
DB.updateItem = function (k, id, patch) {
  if (k === DB.K.messages && patch && patch.items) {
    let u = null; try { u = Auth.current(); } catch (e) {}
    if (estAgent(u)) {
      const t = DB.findItem(DB.K.messages, id);
      if (t && !filVisible(u, t)) { toast('Cette conversation est suivie par un collègue.', 'bad'); return null; }
      const dernier = patch.items[patch.items.length - 1];
      if (t && !t.agentId && dernier && dernier.senderId === u.id) patch = {...patch, agentId: moi(u).id};
    }
  }
  return _updateAgent.call(DB, k, id, patch);
};
/* « Tout marquer comme lu » couvre aussi les notifications personnelles. */
document.addEventListener('click', e => {
  if (!e.target.closest('[data-action="read-all"]')) return;
  const u = Auth.current(); if (!u || !u.member) return;
  DB.getData(DB.K.notifications).filter(n => n.userId === u.member.id && !n.read).forEach(n => _updateAgent.call(DB, DB.K.notifications, n.id, {read: true}));
}, true);

/* --- 11. Rappels de visite (la veille et le jour même) ----------------------
   Envoyés par la base (app.generer_rappels, chaque matin) à l'agent chargé de la
   visite, ou au titulaire de l'espace. */

/* --- 12. Validation des biens publiés par un agent -------------------------- */
LISTING_LABEL.avalider = 'À valider par l\'agence';
LISTING_TONE.avalider = 'warn';
const doitValider = u => estAgent(u) && regles(u).validationAgents !== false;
let agentSoumis = null;
function soumettre(u, titre) {
  agentSoumis = titre;
  setTimeout(() => { agentSoumis = null; }, 2500);
  notify(u.id, `${moi(u).firstName} ${moi(u).lastName} a soumis « ${titre} » : à valider avant la mise en ligne.`, '#/agency/properties');
}
const _addItemValid = DB.addItem;
DB.addItem = function (k, item) {
  let u = null; try { u = Auth.current(); } catch (e) {}
  if (k === DB.K.properties && item && item.listingStatus === 'publiee' && doitValider(u) && item.ownerId === u.id) {
    const x = _addItemValid.call(DB, k, {...item, listingStatus: 'avalider', soumisPar: moi(u).id, soumisLe: now()});
    soumettre(u, x.title); return x;
  }
  return _addItemValid.call(DB, k, item);
};
const _updateValid = DB.updateItem;
DB.updateItem = function (k, id, patch) {
  let u = null; try { u = Auth.current(); } catch (e) {}
  if (k === DB.K.properties && patch && patch.listingStatus === 'publiee' && doitValider(u)) {
    const avant = DB.findItem(DB.K.properties, id);
    if (avant && avant.listingStatus !== 'publiee') {
      const x = _updateValid.call(DB, k, id, {...patch, listingStatus: 'avalider', soumisPar: moi(u).id, soumisLe: now(), renvoiMotif: ''});
      if (x) soumettre(u, x.title); return x;
    }
  }
  return _updateValid.call(DB, k, id, patch);
};
/* Le message « en ligne » devient « envoyé au responsable ». */
const _toastAgent = toast;
toast = function (m, ton) {
  if (agentSoumis && ton !== 'bad' && ton !== 'warn' && /publi|en ligne/i.test(String(m))) {
    const titre = agentSoumis; agentSoumis = null;
    setTimeout(() => { if (/^#\/bien\//.test(location.hash)) go('#/agency/properties'); }, 40);
    return _toastAgent(`« ${titre} » est envoyé au responsable : il sera en ligne dès sa validation.`, 'ok');
  }
  return _toastAgent(m, ton);
};
/* Le responsable valide ou renvoie, depuis la liste des biens. */
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/properties$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => {
    const h = f(...a); if (h === false) return h;
    const u = Auth.current(); if (!u || estAgent(u)) return h;
    const aVal = DB.filterItems(DB.K.properties, p => p.ownerId === u.id && p.listingStatus === 'avalider');
    if (!aVal.length) return h;
    const nom = id => { const m = DB.findItem(DB.K.users, id); return m ? `${m.firstName} ${m.lastName}` : 'Un agent'; };
    const carte = `<section class="card" id="a-valider" style="margin:0 0 16px"><h4 style="margin-top:0">${icon('clock', 17)} ${pluriel(aVal.length, 'bien')} à valider</h4>
      <p class="small muted" style="margin:0 0 10px">Publiés par vos agents : vérifiez le prix, les photos et la description avant la mise en ligne.</p>
      ${aVal.map(p => `<div class="av-row"><div class="av-t"><span class="itile sm gold">${icon('home', 17)}</span><div style="min-width:0"><b>${esc(p.title)}</b><div class="small muted">${esc(nom(p.soumisPar || p.agentId))} · ${money(p.price)}${p.soumisLe ? ' · ' + dateFr(p.soumisLe) : ''}</div></div></div>
        <div class="av-b"><button class="btn sm" data-action="ag-valider-bien" data-id="${p.id}">Valider</button><button class="btn ghost sm" data-action="ag-renvoyer-bien" data-id="${p.id}">Renvoyer</button><a class="btn ghost sm" href="#/owner/property/${p.id}">Voir</a></div></div>`).join('')}</section>`;
    return h.replace(/(<\/div>\s*)(<div class="rfiltre|<div class="table-wrap">|<div class="empty">)/, `$1${carte}$2`);
  };
})();
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ag-valider-bien"],[data-action="ag-renvoyer-bien"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(); if (!u || u.role !== 'agency' || estAgent(u)) return toast('Réservé au responsable de l\'agence.', 'bad');
  const p = DB.findItem(DB.K.properties, x => x.id === b.dataset.id && x.ownerId === u.id && x.listingStatus === 'avalider'); if (!p) return;
  const agentId = p.soumisPar || p.agentId;
  if (b.dataset.action === 'ag-valider-bien') {
    DB.updateItem(DB.K.properties, p.id, {listingStatus: 'publiee', publishedAt: now(), valideLe: now()});
    if (agentId) notify(agentId, `« ${p.title} » est validé et en ligne.`, '#/bien/' + p.id);
    audit('Bien validé', p.title); toast(`« ${p.title} » est en ligne.`); render(); return;
  }
  modal('Renvoyer à l\'agent', `<form data-action="ag-renvoyer-ok" data-id="${p.id}" data-sub="${esc(p.title)}">
    <div class="field"><label>Ce qu'il faut corriger</label><textarea class="input" name="motif" required placeholder="Prix trop haut, photos floues, description incomplète…"></textarea></div>
    <div class="row" style="gap:10px"><button class="btn">Renvoyer</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="ag-renvoyer-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'agency' || estAgent(u)) return;
  const p = DB.findItem(DB.K.properties, x => x.id === f.dataset.id && x.ownerId === u.id); if (!p) return;
  const motif = String(formData(f).motif || '').trim(); if (!motif) return toast('Indiquez ce qu\'il faut corriger.', 'bad');
  DB.updateItem(DB.K.properties, p.id, {listingStatus: 'brouillon', renvoiMotif: motif});
  const agentId = p.soumisPar || p.agentId;
  if (agentId) notify(agentId, `« ${p.title} » est à corriger : ${motif}`, '#/owner/property/' + p.id);
  audit('Bien renvoyé à l\'agent', p.title); closeModal(); toast('Bien renvoyé à l\'agent.'); render();
}, true);

/* --- « À traiter » du responsable : biens à valider, visites sans agent ---- */
const _todoAgent = todoList;
todoList = function (u, s) {
  const t = _todoAgent(u, s);
  if (!u || u.role !== 'agency' || estAgent(u)) return t;
  const aVal = DB.filterItems(DB.K.properties, p => p.ownerId === u.id && p.listingStatus === 'avalider');
  if (aVal.length) t.unshift([`${pluriel(aVal.length, 'bien')} à valider`, aVal.slice(0, 2).map(p => p.title).join(', '), '#/agency/properties', 'home', 'warn']);
  const sans = DB.filterItems(DB.K.visits, v => v.ownerId === u.id && ['attente', 'acceptee', 'reportee'].includes(v.status) && (v.date || '') >= ymd() && !agentDeVisite(v));
  if (sans.length && membresDe(u).some(m => m.role === 'agent' && m.status === 'actif'))
    t.unshift([`${pluriel(sans.length, 'visite')} sans agent`, 'Confiez-les à un agent de l\'équipe', '#/agency/visits', 'calendar', 'warn']);
  return t;
};
/* L'agent voit pourquoi un bien lui a été renvoyé. */
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/properties$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => {
    const h = f(...a); if (h === false) return h;
    const u = Auth.current(); if (!estAgent(u)) return h;
    const ren = biensAgent(u).filter(p => p.renvoiMotif && p.listingStatus === 'brouillon');
    if (!ren.length) return h;
    const bloc = `<section class="card" style="margin:0 0 16px;border-color:var(--warn)"><h4 style="margin-top:0">${icon('alert', 17)} À corriger avant publication</h4>
      ${ren.map(p => `<div class="av-row"><div class="av-t"><span class="itile sm gold">${icon('crayon', 17)}</span><div style="min-width:0"><b>${esc(p.title)}</b><div class="small muted">${esc(p.renvoiMotif)}</div></div></div><div class="av-b"><a class="btn sm" href="#/owner/property/${p.id}">Corriger</a></div></div>`).join('')}</section>`;
    return h.replace(/(<div class="seg")/, `${bloc}$1`);
  };
})();
if (typeof DS_FORM_IC !== 'undefined') DS_FORM_IC.unshift([/agent-planif/, 'calendar'], [/ag-confier/, 'user'], [/ag-renvoyer/, 'file']);

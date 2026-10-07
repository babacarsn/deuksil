/* ==========================================================================
   MODULE : dashboard.js — tableau de bord du propriétaire et de l'agence
   répondant aux quatre questions du cahier des charges : ce que je gère,
   ce que je gagne, ce qui pose problème, ce que je dois faire maintenant.
   ========================================================================== */
const curMonth = () => now().slice(0, 7);
function dashStats(u) {
  const props = myProps(u), units = gMine('units', u), leases = gMine('leases', u), actifs = leases.filter(l => l.status === 'actif');
  /* une unité déclarée compte comme unité ; un bien sans unité compte pour une */
  const withUnits = new Set(units.map(x => x.propertyId));
  const nUnits = units.length + props.filter(p => !withUnits.has(p.id)).length;
  const occUnits = units.filter(x => x.status === 'occupée').length + props.filter(p => !withUnits.has(p.id) && actifs.some(l => l.propertyId === p.id && !l.unitId)).length;
  const m = curMonth(), rents = gMine('rents', u);
  const duMois = rents.filter(r => r.month === m);
  const attendus = duMois.reduce((s, r) => s + r.amount, 0);
  const encaisses = rents.filter(r => r.paidAt && r.paidAt.slice(0, 7) === m).reduce((s, r) => s + r.amount, 0)
    + gMine('fpay', u).filter(p => p.createdAt.slice(0, 7) === m).reduce((s, p) => s + p.amount, 0);
  const retards = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
  const impayes = retards.reduce((s, r) => s + r.amount, 0)
    + gMine('docs', u).filter(d => d.type === 'FAC' && dRest(d) > 0 && d.due < ymd()).reduce((s, d) => s + dRest(d), 0);
  const depenses = gMine('expenses', u).filter(x => x.date.slice(0, 7) === m).reduce((s, x) => s + x.amount, 0)
    + gMine('tickets', u).filter(t => !t.expenseId && (t.createdAt || '').slice(0, 7) === m).reduce((s, t) => s + t.cost, 0);
  return {props, nUnits, occUnits, vacantes: nUnits - occUnits, attendus, encaisses, impayes, depenses, net: encaisses - depenses, retards, actifs};
}
/* « À traiter » : uniquement ce qui demande une action aujourd'hui */
function todoList(u, s) {
  const t = [];
  if (s.retards.length) t.push([`${s.retards.length} loyer${s.retards.length > 1 ? 's' : ''} en retard`, money(s.retards.reduce((x, r) => x + r.amount, 0)), '#/manage/rents', 'money', 'bad']);
  const finBail = s.actifs.filter(l => { const d = daysBetween(ymd(), leaseEnd(l)); return d >= 0 && d <= 45; });
  if (finBail.length) t.push([`${finBail.length} bail${finBail.length > 1 ? 's' : ''} bientôt échu${finBail.length > 1 ? 's' : ''}`, finBail.map(l => l.tenant).join(', '), '#/manage/leases', 'briefcase', 'warn']);
  const mnt = gMine('tickets', u).filter(x => tkSt(x) !== 'terminée');
  if (mnt.length) t.push([`${mnt.length} demande${mnt.length > 1 ? 's' : ''} de maintenance`, mnt.map(x => x.title).slice(0, 2).join(', '), '#/manage/tickets', 'settings', 'info']);
  const devis = gMine('docs', u).filter(d => d.type === 'DEV' && d.status === 'envoyé');
  if (devis.length) t.push([`${devis.length} devis en attente de réponse`, devis.map(d => d.client).slice(0, 2).join(', '), '#/manage/docs', 'layers', 'info']);
  const ctr = gMine('contracts', u).filter(c => c.status === 'actif' && daysBetween(ymd(), c.end) >= 0 && daysBetween(ymd(), c.end) <= 30);
  if (ctr.length) t.push([`${ctr.length} contrat${ctr.length > 1 ? 's' : ''} à renouveler`, ctr.map(c => c.ref).join(', '), '#/manage/contracts', 'file', 'warn']);
  const vis = DB.filterItems(DB.K.visits, v => v.ownerId === u.id && v.status === 'attente');
  if (vis.length) t.push([`${vis.length} demande${vis.length > 1 ? 's' : ''} de visite`, 'À confirmer ou refuser', `#/${u.role}/visits`, 'calendar', 'info']);
  if (u.role === 'agency') {
    const owners = gMine('owners', u), done = gMine('transfers', u), m = curMonth();
    const due = owners.filter(o => !done.find(x => x.ownerId2 === o.id && x.month === m) && ownerBalance(u, o, m).net > 0);
    if (due.length) t.push([`${due.length} reversement${due.length > 1 ? 's' : ''} à effectuer`, due.map(o => o.name).slice(0, 2).join(', '), '#/manage/transfers', 'repeat', 'warn']);
  }
  const msg = DB.filterItems(DB.K.tmsgs, x => x.from === 'tenant' && !x.read && gMine('leases', u).some(l => l.id === x.leaseId));
  if (msg.length) t.push([`${msg.length} message${msg.length > 1 ? 's' : ''} de locataire`, 'Non lu(s)', '#/manage/tmsgs', 'message', 'info']);
  return t;
}
const dashKpi = (n, l, ic, tone) => kpiRich(n, l, ic, tone || 'brand', null);
function monthIncome(u, m) {
  return gMine('rents', u).filter(r => r.paidAt && r.paidAt.slice(0, 7) === m).reduce((x, r) => x + r.amount, 0)
    + gMine('fpay', u).filter(p => p.createdAt.slice(0, 7) === m).reduce((x, p) => x + p.amount, 0);
}
function monthSpend(u, m) {
  return gMine('expenses', u).filter(x => x.date.slice(0, 7) === m).reduce((t, x) => t + x.amount, 0)
    + gMine('tickets', u).filter(t => !t.expenseId && (t.createdAt || '').slice(0, 7) === m).reduce((t, x) => t + x.cost, 0);
}
const prevMonth = m => { const d = new Date(m + '-01'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
/* variation par rapport au mois précédent, affichée seulement si elle a du sens */
function variation(now_, before, goodWhenUp = true) {
  if (!before) return now_ ? {label: 'Premier mois enregistré', tone: ''} : null;
  const pc = Math.round((now_ - before) / before * 100);
  if (!pc) return {label: 'Stable par rapport au mois dernier', tone: ''};
  const up = pc > 0, good = up === goodWhenUp;
  return {label: `${up ? '+' : ''}${pc} % par rapport au mois dernier`, tone: good ? 'ok' : 'bad', up};
}
const vHtml = v => v ? `<div class="kvar ${v.tone}">${v.up === undefined ? '' : icon(v.up ? 'trendUp' : 'trendDown', 13)}${esc(v.label)}</div>` : '';

/* Premiers pas : un compte sans bien n'affiche pas un mur de zéros */
function dashOnboarding(u) {
  const steps = [['Ajoutez un bien', 'Adresse, type, surface et photos. Un immeuble peut ensuite recevoir ses unités.', 'home', '#/owner/property/new', 'Commencer'],
    ['Créez le bail', 'Locataire, loyer, caution, durée. Les échéances se créent toutes seules.', 'users', '', ''],
    ['Encaissez les loyers', 'Chaque paiement enregistré produit sa quittance et alimente vos revenus.', 'money', '', '']];
  return `<div class="onb-hero"><span class="badge info">Premiers pas</span>
      <h2 style="margin:12px 0 6px">Bienvenue ${esc(u.firstName)}, commençons par votre premier bien</h2>
      <p class="small" style="margin:0;max-width:56ch;opacity:.86">Trois étapes suffisent pour suivre vos loyers, vos dépenses et vos locataires depuis DEUKSIL.</p></div>
    <div class="onb-steps">${steps.map(([t, d, ic, href, cta], i) => `<div class="card onb${i ? ' soon' : ''}"><span class="onb-n">${i + 1}</span>
      <span class="itile">${icon(ic, 19)}</span><b style="display:block;margin:12px 0 5px">${t}</b>
      <p class="small muted" style="margin:0 0 ${cta ? '15px' : '0'}">${d}</p>
      ${cta ? `<a class="btn sm" href="${href}">${cta} ${icon('arrowRight', 14)}</a>` : ''}</div>`).join('')}</div>`;
}

function dashHtml(u) {
  const s = dashStats(u), todo = todoList(u, s), occ = s.nUnits ? Math.round(s.occUnits / s.nUnits * 100) : 0;
  if (!s.props.length) return dashOnboarding(u);
  const m = curMonth(), pm = prevMonth(m);
  const netNow = s.encaisses - s.depenses, netBefore = monthIncome(u, pm) - monthSpend(u, pm);
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); });
  const vals = months.map(x => monthIncome(u, x)), max = Math.max(1, ...vals);
  const actions = u.role === 'agency'
    ? [['#/manage/owners', 'Ajouter un propriétaire', 'user'], ['#/owner/property/new', 'Ajouter un bien', 'plus'], ['#/manage/rents', 'Encaisser un loyer', 'money'], ['#/manage/docs', 'Créer une facture', 'layers']]
    : [['#/owner/property/new', 'Ajouter un bien', 'plus'], ['#/manage/leases', 'Ajouter un locataire', 'users'], ['#/manage/rents', 'Encaisser un loyer', 'money'], ['#/manage/expenses', 'Ajouter une dépense', 'repeat']];
  return `
    <h3 style="margin:22px 0 12px">Ce que vous gagnez <span class="small muted" style="font-weight:500">· ${monthLabel(m)}</span></h3>
    <div class="dash-top">
      <div class="hero-kpi">
        <div class="row" style="gap:9px;align-items:center;margin-bottom:12px">
          <span class="hk-ic">${icon('trendUp', 18)}</span><span class="small" style="opacity:.86">Revenu net du mois</span></div>
        <div class="hk-n">${money(netNow)}</div>
        ${vHtml(variation(netNow, netBefore))}
      </div>
      ${kpiRich(money(s.encaisses), 'Encaissé', 'money', 'ok', variation(s.encaisses, monthIncome(u, pm)))}
      ${kpiRich(money(s.impayes), 'Impayés', 'alert', s.impayes ? 'bad' : 'ok', s.retards.length ? {label: `${s.retards.length} loyer${s.retards.length > 1 ? 's' : ''} en retard`, tone: 'bad'} : null)}
    </div>

    <div class="dash-mid">
      <div class="card"><div class="row-between" style="margin-bottom:14px"><b>Revenus des 6 derniers mois</b><span class="small muted">encaissé</span></div>
        <div class="bars">${months.map((x, i) => `<div class="bar"><div class="col"><i style="height:${Math.round(vals[i] / max * 100)}%${i === 5 ? ';background:var(--brand)' : ''}" title="${money(vals[i])}"></i></div>
          <span class="small ${i === 5 ? '' : 'muted'}">${x.slice(5)}</span></div>`).join('')}</div></div>
      <div class="card ring-card">
        <div class="ring" style="--pc:${occ}"><div class="hole">${occ} %</div></div>
        <div style="min-width:0"><b>Occupation</b><div class="small muted" style="margin-top:3px">${s.occUnits} unité${s.occUnits > 1 ? 's' : ''} louée${s.occUnits > 1 ? 's' : ''} sur ${s.nUnits}</div>
          ${s.vacantes ? `<div class="small" style="color:var(--warn);font-weight:600;margin-top:6px">${s.vacantes} vacante${s.vacantes > 1 ? 's' : ''}</div>` : ''}</div></div>
      <div class="card"><b>Patrimoine</b>
        <div class="row-between small" style="padding:6px 0;margin-top:8px"><span class="muted">Biens</span><b>${s.props.length}</b></div>
        <div class="row-between small" style="padding:6px 0"><span class="muted">Unités</span><b>${s.nUnits}</b></div>
        <div class="row-between small" style="padding:6px 0"><span class="muted">Locataires</span><b>${s.actifs.length}</b></div>
        <div class="row-between small" style="padding:6px 0"><span class="muted">Dépenses du mois</span><b>${money(s.depenses)}</b></div></div>
    </div>

    <div class="two-col" style="margin-top:24px;align-items:start">
      <div class="card"><div class="row-between" style="margin-bottom:12px"><h3 style="margin:0">À traiter</h3>${todo.length ? `<span class="badge bad">${todo.length}</span>` : ''}</div>
        ${todo.length ? todo.map(([t, d, h, ic, tone]) => `<a class="trow" href="${h}"><span class="itile sm ${tone === 'bad' ? 'orange' : tone === 'warn' ? 'gold' : ''}">${icon(ic, 17)}</span>
          <div class="txt" style="min-width:0"><b>${esc(t)}</b><div class="sub">${esc(d)}</div></div>${icon('arrowRight', 16)}</a>`).join('')
          : `<div class="empty" style="padding:28px 16px;border:0;background:transparent"><b>Rien à traiter</b><p class="small">Aucun retard, aucune demande en attente.</p></div>`}</div>
      <div><h3 style="margin:0 0 10px">Actions rapides</h3><div class="qa-grid">
        ${actions.map(([h, l, ic]) => `<a class="quick-card" href="${h}"><div class="ic-bubble" style="background:var(--brand-soft);color:var(--brand)">${icon(ic, 17)}</div><b>${l}</b></a>`).join('')}
      </div></div>
    </div>`;
}
/* Le tableau de bord est reconstruit en entier : bandeau puis les quatre réponses. */
function dashHero(u) {
  const agency = u.role === 'agency';
  return `<div class="hero-banner" style="min-height:170px">
      <div class="scene-bg"><img src="${agency ? PHOTOS.bnAgency : PHOTOS.bnOwner}" alt="" loading="lazy"></div>
      <div class="content">
        <span class="wave">Bonjour ${esc(u.firstName)}</span>
        <h1 style="font-size:1.5rem">${agency ? 'Votre portefeuille et vos mandats' : 'Votre portefeuille en un coup d\'œil'}</h1>
        <div class="hero-pills">
          <a href="#/owner/property/new">${icon('plus', 15)} Ajouter un bien</a>
          <a href="#/${u.role}/visits">${icon('calendar', 15)} Demandes de visite</a>
        </div>
      </div>
    </div>`;
}
['owner', 'agency'].forEach(role => {
  const r = routes.find(x => x.re.source === `^\\/${role}\\/dashboard$`); if (!r) return;
  r.fn = () => { const u = Auth.guard(role); if (!u) return false; return shellApp(u, dashHero(u) + dashHtml(u)); };
});

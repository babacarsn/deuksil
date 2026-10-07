/* ==========================================================================
   MODULE : espaces.js — mise au même niveau que l'accueil propriétaire des
   trois autres espaces d'accueil : locataire, investisseur, promoteur.
   Même vocabulaire visuel : bandeau photo, KPI principal en dégradé,
   KPI secondaires à bulles, actions rapides.
   ========================================================================== */

/* Remplace un bloc <div class="…">…</div> en comptant les div imbriquées. */
function swapBlock(html, startTag, replacement) {
  const i = html.indexOf(startTag); if (i < 0) return html;
  const re = /<\/?div\b[^>]*>/gi; re.lastIndex = i;
  let d = 0, m, end = -1;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { d--; if (d === 0) { end = m.index + m[0].length; break; } }
    else d++;
  }
  if (end < 0) return html;
  return html.slice(0, i) + replacement + html.slice(end);
}

/* Bandeau d'accueil commun aux espaces secondaires. */
function spaceHero(photo, hello, title, pills) {
  return `<div class="hero-banner" style="min-height:170px">
      <div class="scene-bg"><img src="${photo}" alt="" loading="lazy"></div>
      <div class="content">
        <span class="wave">${esc(hello)}</span>
        <h1 style="font-size:1.5rem">${esc(title)}</h1>
        <div class="hero-pills">${pills.map(([h, l, ic]) => `<a href="${h}">${icon(ic, 15)} ${esc(l)}</a>`).join('')}</div>
      </div>
    </div>`;
}

/* KPI principal en dégradé, comme « Revenu net du mois » sur l'accueil. */
function heroKpi(label, value, iconName, note) {
  return `<div class="hero-kpi">
      <div class="row" style="gap:9px;align-items:center;margin-bottom:12px">
        <span class="hk-ic">${icon(iconName, 18)}</span><span class="small" style="opacity:.86">${esc(label)}</span></div>
      <div class="hk-n">${value}</div>
      ${note ? `<div class="kvar ${note[1] || ''}">${esc(note[0])}</div>` : ''}
    </div>`;
}

function qaGrid(title, actions) {
  return `<h3 style="margin:24px 0 10px">${esc(title)}</h3><div class="qa-grid">
    ${actions.map(([h, l, ic]) => `<a class="quick-card" href="${h}"><div class="ic-bubble" style="background:var(--brand-soft);color:var(--brand)">${icon(ic, 17)}</div><b>${esc(l)}</b></a>`).join('')}
  </div>`;
}

/* ---------- Locataire : accueil entièrement reconstruit ---------- */
const _tenantRoute = routes.find(r => r.re.source === '^\\/tenant\\/(home|rents|tickets)$');
if (_tenantRoute) {
  const _tFn = _tenantRoute.fn;
  _tenantRoute.fn = tab => {
    if (tab !== 'home') return _tFn(tab);
    const u = Auth.current();
    if (!u || u.role !== 'tenant') return _tFn(tab);
    const l = DB.findItem(DB.K.leases, u.leaseId);
    if (!l) return _tFn(tab);
    const p = gProp(l.propertyId);
    const rents = DB.filterItems(DB.K.rents, r => r.leaseId === u.leaseId).sort((a, b) => a.month < b.month ? -1 : 1);
    const next = rents.find(r => !r.paidAt);
    const late = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
    const paid = rents.filter(r => r.paidAt);
    const photo = p ? ((p.photos && p.photos.length) ? p.photos[0] : (p.type ? demoPhotos(p)[0] : PHOTOS.cover)) : PHOTOS.cover;

    const hero = spaceHero(PHOTOS.bnClient, 'Bonjour ' + u.firstName, 'Votre logement et vos loyers',
      [['#/tenant/quittances', 'Mes quittances', 'file'], ['#/tenant/tickets', 'Signaler un problème', 'alert']]);

    const band = `<h3 style="margin:22px 0 12px">Votre prochain loyer${next ? ` <span class="small muted" style="font-weight:500">· ${monthLabel(next.month)}</span>` : ''}</h3>
      <div class="dash-top">
        ${heroKpi(next ? 'À régler · ' + monthLabel(next.month) : 'Aucun loyer en attente', money(next ? next.amount : 0), 'money',
          next ? (late.length ? ['Échéance dépassée', 'bad'] : ['Échéance à venir', '']) : ['Vous êtes à jour', 'ok'])}
        ${kpiRich(late.length, 'Loyer' + (late.length > 1 ? 's' : '') + ' en retard', 'alert', late.length ? 'bad' : 'ok',
          late.length ? {label: money(late.reduce((s, r) => s + (r.amount || 0), 0)) + ' à régulariser', tone: 'bad'} : {label: 'Rien en retard', tone: 'ok'})}
        ${kpiRich(money(l.rent), 'Loyer mensuel', 'repeat', 'brand', {label: paid.length + ' loyer' + (paid.length > 1 ? 's' : '') + ' déjà réglé' + (paid.length > 1 ? 's' : ''), tone: ''})}
      </div>`;

    const logement = `<h3 style="margin:24px 0 12px">Mon logement</h3>
      <div class="card" style="padding:0;overflow:hidden">
        <div style="height:168px;overflow:hidden"><img src="${photo}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"></div>
        <div style="padding:16px 17px 17px">
          <div class="row-between" style="gap:12px;align-items:flex-start">
            <div style="min-width:0"><b style="font-size:1.05rem">${esc(p ? p.title : 'Votre logement')}</b>
              <div class="small muted" style="margin-top:3px">${p ? esc(p.quartier + ', ' + p.city) : ''}</div></div>
            ${badge(l.status === 'actif' ? 'Bail actif' : 'Bail terminé', l.status === 'actif' ? 'ok' : '')}
          </div>
          <div class="row-between small" style="padding:9px 0 0;margin-top:11px;border-top:1px solid var(--line)">
            <span class="muted">Début du bail</span><b>${dateFr(l.start)}</b></div>
          <div class="row-between small" style="padding:7px 0"><span class="muted">Fin du bail</span><b>${dateFr(leaseEnd(l))}</b></div>
          <div class="row-between small" style="padding:7px 0"><span class="muted">Caution versée</span><b>${money(l.deposit)}</b></div>
        </div>
      </div>`;

    const actions = qaGrid('Actions rapides', [
      ['#/tenant/rents', 'Mes loyers', 'money'],
      ['#/tenant/quittances', 'Mes quittances', 'file'],
      ['#/tenant/tickets', 'Signaler un problème', 'alert'],
      ['#/tenant/messages', 'Contacter le propriétaire', 'message']]);

    return shellApp(u, hero + band + logement + actions);
  };
}

/* ---------- Investisseur : bandeau + bande de KPI ---------- */
const _investRoute = routes.find(r => r.re.source === '^\\/invest\\/home$');
if (_investRoute) {
  const _iFn = _investRoute.fn;
  _investRoute.fn = () => {
    const html = _iFn();
    if (typeof html !== 'string') return html;
    const u = Auth.current(); if (!u) return html;
    const A = DB.filterItems(DB.K.iassets, a => a.ownerId === u.id);
    const inv = sumA(A, a => a.buy), val = sumA(A, a => a.value);
    const rent = sumA(A, a => a.rent) * 12, ch = sumA(A, a => a.charges) * 12;
    const plus = val - inv, cash = Math.round((rent - ch) / 12);

    const hero = spaceHero(PHOTOS.bnOwner, 'Bonjour ' + u.firstName, 'Votre patrimoine en un coup d\'œil',
      [['#/coffre', 'Mes documents', 'file']]);
    const band = `<h3 style="margin:22px 0 12px">Ce que vaut votre patrimoine</h3>
      <div class="dash-top">
        ${heroKpi('Valeur actuelle', money(val), 'trendUp',
          inv ? [(plus >= 0 ? '+' : '') + Math.round(plus / inv * 100) + ' % depuis l\'achat', plus >= 0 ? 'ok' : 'bad'] : null)}
        ${kpiRich(money(plus), 'Plus-value', 'chart', plus < 0 ? 'bad' : 'ok', {label: money(inv) + ' investis', tone: ''})}
        ${kpiRich(inv ? ((rent - ch) / inv * 100).toFixed(1) + ' %' : '—', 'Rendement net annuel', 'money', 'brand',
          {label: money(cash) + ' par mois', tone: cash < 0 ? 'bad' : ''})}
      </div>
      <div class="kpis" style="margin-top:14px">
        ${kpiRich(A.length, 'Actif' + (A.length > 1 ? 's' : '') + ' en portefeuille', 'home', 'info')}
        ${kpiRich(money(rent), 'Loyers encaissés par an', 'repeat', 'gold')}
      </div>`;
    const head = page('Mon patrimoine', 'Suivez la valeur, les loyers et la rentabilité de vos investissements.');
    return swapBlock(html.replace(head, hero + band), '<div class="kpis">', '');
  };
}

/* ---------- Promoteur : bandeau + bande de KPI ---------- */
const _promoRoute = routes.find(r => r.re.source === '^\\/promo\\/home$');
if (_promoRoute) {
  const _pFn = _promoRoute.fn;
  _promoRoute.fn = () => {
    const html = _pFn();
    if (typeof html !== 'string') return html;
    const u = Auth.current(); if (!u) return html;
    const PR = DB.filterItems(DB.K.programs, p => p.ownerId === u.id);
    const L = DB.filterItems(DB.K.lots, l => l.ownerId === u.id);
    const sold = L.filter(l => l.status === 'vendu'), res = L.filter(l => l.status === 'réservé');
    const ca = sumA(sold, l => l.price), pc = L.length ? Math.round(sold.length / L.length * 100) : 0;

    const hero = spaceHero(PHOTOS.bnPromo, 'Bonjour ' + u.firstName, 'Vos programmes et leurs ventes',
      [['#/coffre', 'Mes documents', 'file']]);
    const band = `<h3 style="margin:22px 0 12px">Où en sont vos ventes</h3>
      <div class="dash-top">
        ${heroKpi('Chiffre d\'affaires vendu', money(ca), 'trendUp',
          L.length ? [sold.length + ' lot' + (sold.length > 1 ? 's' : '') + ' vendu' + (sold.length > 1 ? 's' : '') + ' sur ' + L.length + ' (' + pc + ' %)', pc >= 50 ? 'ok' : ''] : null)}
        ${kpiRich(res.length, 'Lot' + (res.length > 1 ? 's' : '') + ' réservé' + (res.length > 1 ? 's' : ''), 'calendar', 'gold',
          {label: money(sumA(res, l => l.price)) + ' à confirmer', tone: ''})}
        ${kpiRich(L.length - sold.length - res.length, 'Lot' + (L.length - sold.length - res.length > 1 ? 's' : '') + ' encore disponible' + (L.length - sold.length - res.length > 1 ? 's' : ''), 'home', 'info',
          {label: PR.length + ' programme' + (PR.length > 1 ? 's' : ''), tone: ''})}
      </div>`;
    const head = page('Mes programmes', 'Programmes immobiliers, lots et avancement des ventes.');
    return swapBlock(html.replace(head, hero + band), '<div class="kpis">', '');
  };
}

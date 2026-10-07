/* ==========================================================================
   MODULE : components.js — coquilles, cartes, graphiques
   ========================================================================== */
function shellPublic(content) {
  const u = Auth.current();
  return `<header class="nav"><div class="wrap nav-in">
      <a class="logo" href="#/"><img src="${LOGO_DARK}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
      <nav class="nav-links">
        <a href="#/search">Rechercher</a><a href="#/#comment">Comment ça marche</a>
        <a href="#/#proprietaires">Propriétaires</a><a href="#/#agences">Agences</a><a href="#/#faq">Questions</a>
      </nav>
      <div class="row">${u
        ? `<a class="btn sm" href="${Auth.home(u)}">Mon espace</a>`
        : `<a class="btn ghost sm" href="#/login">Se connecter</a><a class="btn sm" href="#/register">Créer un compte</a>`}</div>
    </div></header>${content}`;
}

const MENUS_RAW = {
  client: [['#/client/dashboard','Tableau de bord','grid'],['#/search','Rechercher','search'],['#/client/favorites','Mes favoris','heart'],
           ['#/client/visits','Mes visites','calendar'],['#/client/messages','Messages','message'],['#/client/alerts','Mes alertes','bell'],['#/client/profile','Mon profil','user']],
  owner:  [['#/owner/dashboard','Tableau de bord','grid'],['#/owner/properties','Mes biens','home'],['#/owner/property/new','Ajouter un bien','plus'],
           ['#/owner/visits','Demandes de visite','calendar'],['#/owner/messages','Messages','message'],['#/owner/statistics','Statistiques','chart'],
           ['#/owner/documents','Documents','file'],['#/owner/profile','Mon profil','user']],
  agency: [['#/agency/dashboard','Tableau de bord','grid'],['#/agency/properties','Biens','building'],['#/owner/property/new','Ajouter un bien','plus'],
           ['#/agency/agents','Agents','agent'],['#/agency/clients','Clients','users'],['#/agency/visits','Visites','calendar'],
           ['#/agency/messages','Messages','message'],['#/agency/commissions','Commissions','money'],['#/owner/documents','Documents','file'],
           ['#/agency/settings','Paramètres','settings'],['#/owner/profile','Profil agence','user']],
  admin:  [['#/admin/dashboard','Tableau de bord','grid'],['#/admin/users','Utilisateurs','users'],['#/admin/listings','Validation des annonces','checkCircle'],
           ['#/admin/properties','Tous les biens','home'],
           ['#/admin/reports','Statistiques','chart'],['#/admin/settings','Paramètres','settings']]
};

/* Menus filtrés selon les permissions d'un membre d'équipe (voir rbac.js) */
window.__menuRdy = false;
const MENUS = new Proxy(MENUS_RAW, {get(t, k) {
  const m = t[k]; if (!window.__menuRdy || !Array.isArray(m)) return m;
  const u = Auth.current(); return u && u.member ? m.filter(([h]) => memberCan(u, permFor(h.slice(1)))) : m; }});

function tabBarHtml(u, path) {
  const items = MENUS[u.role];
  const primary = items.slice(0, 4);
  const rest = items.slice(4);
  const restActive = rest.some(([h]) => path === h.slice(1));
  return `<nav class="tabbar" aria-label="Navigation principale">
    ${primary.map(([h, l, i]) => `<a href="${h}" class="tab-item ${path === h.slice(1) ? 'active' : ''}">${icon(i, 21)}<span>${esc(l)}</span></a>`).join('')}
    <button class="tab-item ${restActive ? 'active' : ''}" data-action="open-more-menu">${icon('dots', 21)}<span>Plus</span></button>
  </nav>`;
}
function openMoreMenu(u) {
  const items = MENUS[u.role].slice(4);
  modal('Menu', `<div class="stack">
    ${items.map(([h, l, i]) => `<a href="${h}" class="more-row" data-action="nav-close-modal">${icon(i, 18)}<span>${esc(l)}</span></a>`).join('')}
    <button class="more-row" data-action="logout" style="color:var(--bad)">${icon('close', 18)}<span>Se déconnecter</span></button>
  </div>`);
}

function sidebarBadge(u, href) {
  const path = href.slice(1);
  if (path === '/client/favorites') return {n: DB.filterItems(DB.K.favorites, f => f.userId === u.id).length, tone: 'bad'};
  if (path === '/client/visits') return {n: DB.filterItems(DB.K.visits, v => v.clientId === u.id && v.status === 'attente').length, tone: 'warn'};
  if (path === '/client/messages') return {n: DB.filterItems(DB.K.messages, t => t.participants.includes(u.id)).length, tone: 'info'};
  if (path === '/client/alerts') return {n: DB.filterItems(DB.K.searches, s => s.userId === u.id).length, tone: 'ok'};
  if (path === '/owner/visits' && ['owner', 'agency'].includes(u.role)) return {n: DB.filterItems(DB.K.visits, v => v.ownerId === u.id && v.status === 'attente').length, tone: 'warn'};
  if (path === '/owner/messages' && ['owner', 'agency'].includes(u.role)) return {n: DB.filterItems(DB.K.messages, t => t.participants.includes(u.id)).length, tone: 'info'};
  if (path === '/admin/listings') return {n: DB.filterItems(DB.K.properties, p => p.listingStatus === 'attente').length, tone: 'warn'};
  return null;
}
function shellApp(u, content) {
  const path = location.hash.replace('#', '');
  const unread = DB.filterItems(DB.K.notifications, n => n.userId === u.id && !n.read).length;
  checkNotifySound(u);
  const title = ownerLabel(u);
  const roleLabel = (u.member ? {manager:'Gestionnaire', agent:'Agent'}[u.member.role] : {client:'Client', owner:'Propriétaire', agency:'Agence', admin:'Administration', tenant:'Client', investor:'Investisseur', promoter:'Promoteur'}[u.role]);
  return `<div class="app">
    <aside class="side" id="sidebar">
      <a class="logo" href="#/"><img src="${LOGO_LIGHT}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
      <nav>${MENUS[u.role].map(([h, l, i]) => {
        const b = sidebarBadge(u, h);
        return `<a href="${h}" class="${path === h.slice(1) ? 'active' : ''}"><span class="ico">${icon(i, 17)}</span>${l}${b && b.n ? `<span class="sidebar-badge" style="background:var(--${b.tone}-soft);color:var(--${b.tone})">${b.n}</span>` : ''}</a>`;
      }).join('')}</nav>
      <div class="side-user">
        <div class="row">${avatarHtml(u, 36)}
          <div style="min-width:0"><div style="font-weight:600;font-size:.88rem;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div>
          <div class="small muted">${roleLabel}</div></div></div>
        <button class="btn sm block" style="margin-top:11px" data-action="logout">Se déconnecter</button>
      </div>
      <div class="side-foot">DEUKSIL © ${new Date().getFullYear()} · Sénégal</div>
    </aside>
    <div class="main">
      <div class="topbar">
        <span class="crumb">DEUKSIL · ${roleLabel}</span>
        <div class="row">
          <button class="bell" data-action="sound-toggle" aria-label="${soundEnabled() ? 'Couper le son des notifications' : 'Activer le son des notifications'}" title="${soundEnabled() ? 'Son activé' : 'Son coupé'}">${icon(soundEnabled() ? 'volumeOn' : 'volumeOff', 16)}</button>
          <button class="bell" data-action="notifications" aria-label="Notifications">${icon('bell', 17)}${unread ? `<b>${unread}</b>` : ''}</button>
          <button class="btn ghost sm" data-action="theme" aria-label="${isDarkTheme() ? 'Passer au thème clair' : 'Passer au thème sombre'}" title="${isDarkTheme() ? 'Thème clair' : 'Thème sombre'}">${icon(isDarkTheme() ? 'sun' : 'moon', 16)}</button>
        </div>
      </div>
      <div class="content">${content}</div>
    </div>
    ${tabBarHtml(u, path)}
    <button class="ai-fab" data-action="open-ai-chat" aria-label="Assistant DEUKSIL">${icon('sparkle', 34)}</button>
  </div>`;
}

function page(title, subtitle, actions = '') {
  return `<div class="page-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p class="muted" style="margin:4px 0 0">${esc(subtitle)}</p>` : ''}</div><div class="row">${actions}</div></div>`;
}
function kpi(n, l, tone) { return `<div class="kpi"><div class="n" ${tone ? `style="color:var(--${tone})"` : ''}>${n}</div><div class="l">${esc(l)}</div></div>`; }
function dailyBuckets(records, days = 7) {
  const labels = [], counts = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('fr-FR', {weekday: 'short'}).replace('.', ''));
    counts.push(records.filter(r => (r.createdAt || '').slice(0, 10) === key).length);
  }
  return {labels, counts};
}
function periodTrend(records, days = 7) {
  const cutoff1 = addDays(now(), -days), cutoff2 = addDays(now(), -days * 2);
  const recent = records.filter(r => r.createdAt >= cutoff1).length;
  const prior = records.filter(r => r.createdAt >= cutoff2 && r.createdAt < cutoff1).length;
  if (prior === 0) return recent > 0 ? {label: `+${recent} cette semaine`, tone: 'ok'} : null;
  const pct = Math.round(((recent - prior) / prior) * 100);
  if (pct === 0) return {label: 'Stable cette semaine', tone: ''};
  return {label: `${pct > 0 ? '+' : ''}${pct}% cette semaine`, tone: pct > 0 ? 'ok' : 'bad'};
}
function kpiRich(n, l, iconName, tone, trend) {
  return `<div class="kpi-rich" data-tone="${tone || 'brand'}">
    <div class="kpi-icon" style="background:var(--${tone}-soft);color:var(--${tone})">${icon(iconName, 19)}</div>
    <div class="n">${n}</div><div class="l">${esc(l)}</div>
    ${trend ? `<div class="kvar ${trend.tone || ''}">${trend.up === undefined ? '' : icon(trend.up ? 'trendUp' : 'trendDown', 12)}${esc(trend.label)}</div>` : ''}
  </div>`;
}
function badge(text, tone = '') { return `<span class="badge ${tone}"><i class="dot"></i>${esc(text)}</span>`; }

let compareIds = [];
const pricePerSqm = p => p.surface ? Math.round(p.price / p.surface) : 0;
function propertyCard(p, favIds = [], compareMode = false) {
  const owner = DB.findItem(DB.K.users, p.ownerId) || {};
  const unit = p.transaction === 'location' ? '<span class="small muted" style="font-weight:500"> / mois</span>' : '';
  const feats = p.transaction === 'terrain'
    ? [`${p.surface} m²`, 'Terrain nu']
    : [`${p.rooms} ch.`, `${p.baths} sdb`, `${p.surface} m²`];
  return `<article class="prop">
    ${photoHtml(p, {fav: favIds.includes(p.id)})}
    <div class="body">
      <div class="row-between" style="gap:8px;align-items:flex-start">
        <h3>${esc(p.title)}</h3>${badge(STATUS_LABEL[p.status], STATUS_TONE[p.status])}</div>
      <div class="small muted">${icon('pin', 13)} ${esc(p.quartier)}, ${esc(p.city)}</div>
      <div class="price">${money(p.price)}${unit}</div>
      <div class="small muted" style="margin-top:-6px">${money(pricePerSqm(p))}/m²</div>
      <div class="feat">${feats.map(f => `<span>${esc(f)}</span>`).join('')}</div>
      ${compareMode ? `<label class="check small"><input type="checkbox" data-action="toggle-compare" data-id="${p.id}" ${compareIds.includes(p.id) ? 'checked' : ''}>Comparer</label>` : ''}
      <div class="foot">
        <span class="row" style="gap:8px;min-width:0">
${avatarHtml(owner, 26)}
          <span class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${owner.role === 'agency' ? esc(owner.agencyName || 'Agence') : 'Propriétaire vérifié'}</span>
        </span>
        <a class="btn sm" href="#/property/${p.id}">Voir le bien</a>
      </div>
    </div></article>`;
}
function compareBarHtml() {
  if (!compareIds.length) return '';
  const items = compareIds.map(id => DB.findItem(DB.K.properties, id)).filter(Boolean);
  return `<div class="compare-bar">
    <div class="row" style="gap:10px;overflow:auto">
      ${items.map(p => `<span class="badge">${esc(p.title.slice(0, 22))}<button data-action="toggle-compare" data-id="${p.id}" aria-label="Retirer de la comparaison">${icon('close', 11)}</button></span>`).join('')}
    </div>
    <div class="row" style="gap:8px;flex:none">
      <button class="btn ghost sm" data-action="clear-compare">Vider</button>
      <button class="btn sm" data-action="go-compare" ${items.length < 2 ? 'disabled' : ''}>${icon('scale', 15)} Comparer (${items.length})</button>
    </div></div>`;
}

/* --- Graphiques SVG (sans librairie externe) --- */
function barChart(data, {height = 190, color = 'var(--brand)', money: isMoney} = {}) {
  const max = Math.max(1, ...data.map(d => d[1]));
  const w = 100 / data.length;
  return `<svg viewBox="0 0 100 ${height / 3}" preserveAspectRatio="none" style="width:100%;height:${height}px;overflow:visible">
    ${data.map((d, i) => {
      const h = (d[1] / max) * (height / 3 - 12);
      return `<rect x="${i * w + w * .18}" y="${height / 3 - 10 - h}" width="${w * .64}" height="${h}" rx="1.2" fill="${color}" opacity="${.45 + .55 * (d[1] / max)}"><title>${esc(d[0])} : ${isMoney ? money(d[1]) : d[1]}</title></rect>
      <text x="${i * w + w / 2}" y="${height / 3 - 3}" font-size="2.6" text-anchor="middle" fill="currentColor" opacity=".6">${esc(d[0])}</text>`;
    }).join('')}
  </svg>`;
}
function lineChart(data, {height = 190} = {}) {
  const max = Math.max(1, ...data.map(d => d[1])), H = height / 3 - 10;
  const pts = data.map((d, i) => [i * (100 / (data.length - 1 || 1)), H - (d[1] / max) * (H - 4) + 2]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg viewBox="0 0 100 ${height / 3}" preserveAspectRatio="none" style="width:100%;height:${height}px;overflow:visible">
    <path d="${path} L100 ${H} L0 ${H} Z" fill="var(--brand)" opacity=".10"/>
    <path d="${path}" fill="none" stroke="var(--brand)" stroke-width="1" vector-effect="non-scaling-stroke"/>
    ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="1" fill="var(--brand)"><title>${esc(data[i][0])} : ${data[i][1]}</title></circle>`).join('')}
    ${data.map((d, i) => `<text x="${pts[i][0]}" y="${H + 6}" font-size="2.6" text-anchor="middle" fill="currentColor" opacity=".6">${esc(d[0])}</text>`).join('')}
  </svg>`;
}
function dualLineChart(labels, seriesA, seriesB, {height = 190, colorA = 'var(--brand)', colorB = 'var(--gold)'} = {}) {
  const max = Math.max(1, ...seriesA, ...seriesB), H = height / 3 - 10;
  const x = i => i * (100 / (labels.length - 1 || 1));
  const line = (vals, color) => {
    const pts = vals.map((v, i) => [x(i), H - (v / max) * (H - 4) + 2]);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return {path, pts};
  };
  const a = line(seriesA, colorA), b = line(seriesB, colorB);
  return `<svg viewBox="0 0 100 ${height / 3}" preserveAspectRatio="none" style="width:100%;height:${height}px;overflow:visible">
    <path d="${a.path} L100 ${H} L0 ${H} Z" fill="${colorA}" opacity=".08"/>
    <path d="${a.path}" fill="none" stroke="${colorA}" stroke-width="1" vector-effect="non-scaling-stroke"/>
    <path d="${b.path}" fill="none" stroke="${colorB}" stroke-width="1" vector-effect="non-scaling-stroke"/>
    ${a.pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r=".9" fill="${colorA}"><title>${esc(labels[i])} : ${seriesA[i]}</title></circle>`).join('')}
    ${b.pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r=".9" fill="${colorB}"><title>${esc(labels[i])} : ${seriesB[i]}</title></circle>`).join('')}
    ${labels.map((l, i) => `<text x="${x(i)}" y="${H + 6}" font-size="2.6" text-anchor="middle" fill="currentColor" opacity=".6">${esc(l)}</text>`).join('')}
  </svg>`;
}
function donutList(data) {
  const total = data.reduce((s, d) => s + d[1], 0) || 1;
  return `<div class="stack">${data.map(d => `<div>
    <div class="row-between small"><span>${esc(d[0])}</span><b>${d[1]}</b></div>
    <div class="progress"><i style="width:${(d[1] / total * 100).toFixed(0)}%"></i></div></div>`).join('')}</div>`;
}

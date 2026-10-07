/* ==========================================================================
   MODULE : rbac.js — rôles gestionnaire / agent (équipe d'un propriétaire ou
   d'une agence, permissions configurables) et locataire (espace dédié).
   Un membre d'équipe agit sur les données de son parent, limité à ses permissions.
   ========================================================================== */
const PERMS = {biens:'Biens et annonces', visites:'Visites et clients', messages:'Messagerie', gestion:'Baux, loyers, contrats, maintenance', finances:'Finances (factures, paiements, dépenses)', documents:'Documents'};
const MEMBER_DEFAULT = {manager:['biens', 'visites', 'messages', 'gestion', 'documents'], agent:['biens', 'visites', 'messages']};
const MEMBER_LABEL = {manager:'Gestionnaire', agent:'Agent'};

/* Session : un membre est vu comme son parent (mêmes données), avec son nom et ses permissions */
const _cur = Auth.current.bind(Auth);
Auth.current = function () {
  const u = _cur(); if (!u || !u.parentId) return u;
  const p = DB.findItem(DB.K.users, u.parentId);
  if (!p || p.status === 'suspendu' || u.status === 'suspendu') return null;
  return {...p, firstName: u.firstName, lastName: u.lastName, phone: u.phone, member: u, perms: u.perms || []};
};
const _home = Auth.home;
Auth.home = function (u) {
  if (u.role === 'tenant') return '#/tenant/home';
  if (u.parentId) return _home.call(this, {role: (DB.findItem(DB.K.users, u.parentId) || {}).role});
  return _home.call(this, u);
};

/* Quelle permission faut-il pour ouvrir cette page ? ('admin' = jamais délégable) */
function permFor(path) {
  if (/^\/(owner|agency)\/(properties|property\/)/.test(path)) return 'biens';
  if (/^\/(owner|agency)\/visits|^\/agency\/clients/.test(path)) return 'visites';
  if (/^\/(owner|agency|client)\/messages/.test(path)) return 'messages';
  if (/^\/owner\/documents/.test(path)) return 'documents';
  const m = path.match(/^\/manage\/(\w+)/);
  if (m) return {docs:'finances', fpay:'finances', expenses:'finances', finance:'finances', audit:'finances', team:'admin', identity:'admin', reports:'finances'}[m[1]] || 'gestion';
  if (/^\/agency\/(agents|settings|commissions)|^\/(owner|agency)\/(subscription|statistics|profile)/.test(path)) return 'admin';
  return null;
}
const memberCan = (u, p) => !p || (p !== 'admin' && u.perms.includes(p));
routes.forEach(r => {
  const f = r.fn;
  r.fn = (...a) => {
    const u = Auth.current(), path = location.hash.slice(1);
    if (u && u.member && !memberCan(u, permFor(path))) { toast('Accès non autorisé pour votre profil.', 'bad'); go(Auth.home(u)); return false; }
    if (u && ['tenant', 'investor', 'promoter'].includes(u.role) && /^\/(owner|agency|manage|admin)\//.test(path)) { toast('Espace non accessible à votre profil.', 'bad'); go(Auth.home(u)); return false; }
    if (u && u.member && /^\/manage\//.test(path)) {   /* n'afficher que les onglets autorisés */
      const saved = GTABS.slice(); GTABS.splice(0, GTABS.length, ...saved.filter(t => memberCan(u, permFor('/manage/' + t[0]))));
      try { return f(...a); } finally { GTABS.splice(0, GTABS.length, ...saved); }
    }
    return f(...a);
  };
});
/* Application côté logique : même une action injectée à la main est refusée */
['click', 'submit', 'change'].forEach(ev => document.addEventListener(ev, e => {
  const el = e.target.closest && e.target.closest('[data-action]'), u = Auth.current(); if (!el || !u) return;
  const a = el.dataset.action; let deny = false;
  if (u.member) deny = /^g4-/.test(a) ? true : /^g2-/.test(a) ? !u.perms.includes('finances') : /^(g-|g3-|g[89]-|g-stage)/.test(a) ? !u.perms.includes('gestion') : false;
  if (u.role === 'tenant' && /^g[1-5]?-/.test(a)) deny = true;
  if (deny) { e.stopImmediatePropagation(); e.preventDefault(); toast('Action non autorisée pour votre profil.', 'bad'); }
}, true));

/* Gestion : onglet « Équipe & accès » (réservé au titulaire du compte) */
GTABS.push(['team', 'Équipe & accès']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit|contracts|providers|team)$/;
const _g4 = gTab;
gTab = function (u, tab) {
  if (tab !== 'team') return _g4(u, tab);
  if (u.member) return '';
  const team = DB.filterItems(DB.K.users, x => x.parentId === u.id), tenants = DB.filterItems(DB.K.users, x => x.ownerRef === u.id && x.role === 'tenant');
  const free = gMine('leases', u).filter(l => l.status === 'actif' && !tenants.some(t => t.leaseId === l.id));
  return `<form class="card" data-action="g4-member" style="margin-bottom:18px"><h4 style="margin-top:0">Ajouter un membre d'équipe</h4><div class="form-grid">
    <div class="field"><label>Prénom</label><input class="input" name="firstName" required></div><div class="field"><label>Nom</label><input class="input" name="lastName" required></div>
    <div class="field"><label>CNI (13 chiffres, fictive)</label><input class="input" name="cni" required pattern="\\d{13}"></div><div class="field"><label>Téléphone</label><input class="input" name="phone"></div>
    <div class="field"><label>Mot de passe</label><input class="input" type="password" name="password" minlength="6" required></div>
    <div class="field"><label>Rôle</label><select class="input" name="role"><option value="manager">Gestionnaire</option><option value="agent">Agent</option></select></div></div>
    <p class="small"><b>Permissions</b> (l'administration du compte, l'abonnement et l'équipe ne sont jamais délégables)</p>
    <div class="row" style="gap:14px;flex-wrap:wrap;margin-bottom:12px">${Object.entries(PERMS).map(([k, v]) => `<label class="small"><input type="checkbox" name="perm_${k}" ${MEMBER_DEFAULT.agent.includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div>
    <button class="btn">Créer le compte</button><p class="err" id="g4-err"></p></form>` +
    gTable(['Nom', 'Rôle', 'Permissions', 'Statut', ''], team.map(m => `<tr><td class="small"><b>${esc(m.firstName)} ${esc(m.lastName)}</b><br><span class="muted">${m.cni}</span></td><td>${badge(MEMBER_LABEL[m.role], 'info')}</td>
      <td class="small">${(m.perms || []).map(p => esc(PERMS[p])).join(', ') || '—'}</td><td>${badge(m.status === 'actif' ? 'Actif' : 'Suspendu', m.status === 'actif' ? 'ok' : 'bad')}</td>
      <td><div class="row" style="gap:6px"><button class="btn ghost sm" data-action="g4-toggle" data-id="${m.id}">${m.status === 'actif' ? 'Suspendre' : 'Réactiver'}</button><button class="btn ghost sm" data-action="g4-del" data-id="${m.id}" aria-label="Supprimer">${icon('trash', 14)}</button></div></td></tr>`), ['Aucun membre', 'Ajoutez un gestionnaire ou un agent avec des permissions précises.']) +
    `<form class="card" data-action="g4-tenant" style="margin:24px 0 18px"><h4 style="margin-top:0">Donner un accès à un locataire</h4><div class="form-grid">
    <div class="field"><label>Bail</label><select class="input" name="leaseId" required>${free.map(l => `<option value="${l.id}">${esc(l.tenant)} — ${esc((gProp(l.propertyId) || {}).title || '')}</option>`).join('') || '<option value="">Aucun bail sans accès</option>'}</select></div>
    <div class="field"><label>CNI du locataire (13 chiffres)</label><input class="input" name="cni" required pattern="\\d{13}"></div>
    <div class="field"><label>Mot de passe</label><input class="input" type="password" name="password" minlength="6" required></div></div><button class="btn">Créer l'accès locataire</button></form>` +
    gTable(['Locataire', 'CNI', 'Bail', ''], tenants.map(t => `<tr><td class="small"><b>${esc(t.firstName)} ${esc(t.lastName)}</b></td><td class="small">${t.cni}</td><td class="small">${esc((gProp((DB.findItem(DB.K.leases, t.leaseId) || {}).propertyId) || {}).title || '—')}</td><td><button class="btn ghost sm" data-action="g4-del" data-id="${t.id}" aria-label="Supprimer">${icon('trash', 14)}</button></td></tr>`), ['Aucun accès locataire', 'Le locataire pourra suivre ses loyers et signaler un problème.']);
};
function g4User(u, d, extra) {
  const err = m => { $('#g4-err') && ($('#g4-err').textContent = m); toast(m, 'bad'); return null; };
  if (!/^\d{13}$/.test(d.cni)) return err('La CNI doit comporter 13 chiffres.');
  if (DB.findItem(DB.K.users, x => x.cni === d.cni)) return err('Un compte existe déjà avec cette CNI.');
  if ((d.password || '').length < 6) return err('Mot de passe : 6 caractères minimum.');
  return DB.addItem(DB.K.users, {cni: d.cni, firstName: d.firstName, lastName: d.lastName, phone: d.phone || '', password: d.password, status: 'actif', registrationPaid: true, agencyName: '', address: '', agencyDesc: '', ...extra});
}
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action^="g4-"]'), u = Auth.current(); if (!f || !u || u.member) return;
  e.preventDefault(); const a = f.dataset.action, d = formData(f);
  if (a === 'g4-member') {
    if (!['manager', 'agent'].includes(d.role)) return;
    const perms = Object.keys(PERMS).filter(k => d['perm_' + k]);
    const m = g4User(u, d, {role: d.role, parentId: u.id, perms}); if (!m) return;
    audit('Membre créé', `${m.firstName} ${m.lastName} (${MEMBER_LABEL[m.role]})`); toast('Compte créé. Il se connecte avec sa CNI.'); render();
  }
  if (a === 'g4-tenant') {
    const l = DB.findItem(DB.K.leases, x => x.id === d.leaseId && x.ownerId === u.id && x.status === 'actif'); if (!l) { toast('Choisissez un bail actif.', 'bad'); return; }
    const [fn, ...ln] = l.tenant.split(' '), t = g4User(u, {...d, firstName: fn, lastName: ln.join(' ') || '-', phone: l.phone}, {role: 'tenant', leaseId: l.id, ownerRef: u.id}); if (!t) return;
    audit('Accès locataire', l.tenant); toast('Accès locataire créé.'); render();
  }
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action^="g4-"]'), u = Auth.current(); if (!el || !u || u.member) return;
  const a = el.dataset.action, x = DB.findItem(DB.K.users, y => y.id === el.dataset.id && (y.parentId === u.id || y.ownerRef === u.id)); if (!x) return;
  if (a === 'g4-toggle') { DB.updateItem(DB.K.users, x.id, {status: x.status === 'actif' ? 'suspendu' : 'actif'}); audit('Statut membre', x.firstName + ' ' + x.lastName); render(); }
  if (a === 'g4-del') confirmDialog({title: 'Supprimer le compte', message: `${x.firstName} ${x.lastName} ne pourra plus se connecter.`, confirmLabel: 'Supprimer', danger: true, onConfirm: () => { DB.deleteItem(DB.K.users, x.id); audit('Compte supprimé', x.firstName + ' ' + x.lastName); render(); }});
});

/* Espace locataire */
MENUS_RAW.tenant = [['#/tenant/home', 'Mon logement', 'home'], ['#/tenant/rents', 'Mes loyers', 'money'], ['#/tenant/tickets', 'Maintenance', 'settings']];
route(/^\/tenant\/(home|rents|tickets)$/, tab => {
  const u = Auth.current();
  if (!u || u.role !== 'tenant') { toast('Espace réservé aux locataires.', 'bad'); go('#/login'); return false; }
  const l = DB.findItem(DB.K.leases, u.leaseId), p = l && gProp(l.propertyId), rents = DB.filterItems(DB.K.rents, r => r.leaseId === u.leaseId).sort((a, b) => a.month < b.month ? -1 : 1);
  if (!l) return shellApp(u, page('Mon espace', '') + `<div class="empty"><b>Bail introuvable</b><p class="small">Contactez votre propriétaire.</p></div>`);
  const next = rents.find(r => !r.paidAt), late = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
  if (tab === 'home') return shellApp(u, page('Bonjour ' + u.firstName, 'Votre logement et votre prochain loyer.') +
    `<div class="kpis">${kpi(money(l.rent), 'Loyer mensuel')}${kpi(next ? monthLabel(next.month) : '—', 'Prochaine échéance')}${kpi(late.length, 'Loyers en retard', late.length ? 'bad' : 'ok')}${kpi(money(l.deposit), 'Caution versée')}</div>
    <div class="card" style="margin-top:18px"><b>${esc(p ? p.title : '')}</b><p class="small muted">${p ? esc(p.quartier + ', ' + p.city) : ''}</p>
    <p class="small">Bail du ${dateFr(l.start)} au ${dateFr(leaseEnd(l))} · ${l.status === 'actif' ? 'actif' : 'terminé'}</p></div>`);
  if (tab === 'rents') return shellApp(u, page('Mes loyers', 'Historique et échéances.') + gTable(['Mois', 'Montant', 'État', 'Payé le', 'Mode'], rents.map(r => { const [lab, t] = rentState(r); return `<tr><td class="small">${monthLabel(r.month)}</td><td>${money(r.amount)}</td><td>${badge(lab, t)}</td><td class="small muted">${dateFr(r.paidAt)}</td><td class="small muted">${r.paidAt ? esc(r.method || '') : ''}</td></tr>`; }), ['Aucun loyer', 'Vos échéances apparaîtront ici.']));
  const tk = DB.filterItems(DB.K.tickets, t => t.tenantId === u.id).slice().reverse();
  return shellApp(u, page('Maintenance', 'Signalez un problème dans votre logement.') + `<form class="card" data-action="t-ticket" style="margin-bottom:18px"><div class="field"><label>Quel est le problème ?</label><input class="input" name="title" required placeholder="Fuite d'eau, panne de courant…"></div>
    <div class="field"><label>Catégorie</label><select class="input" name="category">${MCAT.map(c => `<option>${c}</option>`).join('')}</select></div><button class="btn">Envoyer au propriétaire</button></form>` +
    gTable(['Problème', 'Statut', 'Date'], tk.map(t => `<tr><td class="small"><b>${esc(t.title)}</b></td><td>${badge(TICKET_LABEL[t.status], TICKET_TONE[t.status])}</td><td class="small muted">${dateFr(t.createdAt)}</td></tr>`), ['Aucune demande', 'Vos signalements et leur avancement s\'affichent ici.']));
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action="t-ticket"]'), u = Auth.current(); if (!f || !u || u.role !== 'tenant') return;
  e.preventDefault(); const l = DB.findItem(DB.K.leases, u.leaseId), t = formData(f).title.trim(); if (!l || !t) return;
  DB.addItem(DB.K.tickets, {ownerId: l.ownerId, propertyId: l.propertyId, title: t, category: MCAT.includes(formData(f).category) ? formData(f).category : 'Autre', cost: 0, status: 'nouvelle', tenantId: u.id});
  notify(l.ownerId, `Maintenance signalée par ${u.firstName} : ${t}`, '#/manage/tickets'); toast('Demande envoyée.'); render();
});

/* Comptes de démonstration : gestionnaire, agent, locataire */
function seedV4() {
  if (DB.findItem(DB.K.users, x => x.cni === '1900000000011')) return;
  const owner = DB.findItem(DB.K.users, x => x.cni === '1900000000003'), agency = DB.findItem(DB.K.users, x => x.cni === '1900000000004'); if (!owner || !agency) return;
  const base = {password: 'demo123', status: 'actif', registrationPaid: true, agencyName: '', address: '', agencyDesc: ''};
  DB.addItem(DB.K.users, {...base, cni: '1900000000011', firstName: 'Moussa', lastName: 'Gestionnaire', phone: '770000011', role: 'manager', parentId: owner.id, perms: MEMBER_DEFAULT.manager});
  DB.addItem(DB.K.users, {...base, cni: '1900000000012', firstName: 'Aïssatou', lastName: 'Agent', phone: '770000012', role: 'agent', parentId: agency.id, perms: MEMBER_DEFAULT.agent});
  const pr = myProps(owner).find(p => p.transaction === 'location'); if (!pr) return;
  const l = DB.addItem(DB.K.leases, {ownerId: owner.id, propertyId: pr.id, tenant: 'Fatou Ndiaye', phone: '770000013', rent: pr.price || 250000, deposit: 500000, start: addDays(now(), -90).slice(0, 10), months: 12, status: 'actif'});
  const s = new Date(l.start);
  for (let i = 0; i < 12; i++) { const m = new Date(s.getFullYear(), s.getMonth() + i, 1); DB.addItem(DB.K.rents, {ownerId: owner.id, leaseId: l.id, month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, amount: l.rent, paidAt: i < 2 ? addDays(l.start, i * 30) : null}); }
  DB.addItem(DB.K.users, {...base, cni: '1900000000013', firstName: 'Fatou', lastName: 'Ndiaye', phone: '770000013', role: 'tenant', leaseId: l.id, ownerRef: owner.id});
  DB.updateItem(DB.K.properties, pr.id, {status: 'loue'});
}
const _seed = seedIfNeeded;
seedIfNeeded = function (f) { _seed(f); seedV4(); };
window.__menuRdy = true;

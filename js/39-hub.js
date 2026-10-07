/* ==========================================================================
   MODULE : hub.js — accueil de la Gestion présenté en tiroirs par catégorie,
   avec icône et compteur propres à chaque section (comme le coffre documents).
   ========================================================================== */
const GMETA = {
  leases:   ['briefcase', 'Baux en cours, caution et échéancier', u => gMine('leases', u).filter(l => l.status === 'actif').length + ' bail(s) actif(s)'],
  units:    ['building', 'Lots d\'un immeuble loués séparément', u => { const x = gMine('units', u); return x.length ? `${x.filter(y => y.status === 'occupée').length}/${x.length} occupée(s)` : 'Aucune unité'; }],
  tenants:  ['users', 'Contact, bail et situation de chacun', u => gMine('leases', u).length + ' locataire(s)'],
  owners:   ['user', 'Mandants, commission et relevés', u => gMine('owners', u).length + ' propriétaire(s)'],
  tmsgs:    ['message', 'Échanges avec vos locataires', u => { const ids = gMine('leases', u).map(l => l.id), n = DB.getData(DB.K.tmsgs).filter(m => ids.includes(m.leaseId) && m.from === 'tenant' && !m.read).length; return n ? n + ' non lu(s)' : 'À jour'; }],
  contracts:['file', 'Location, mandat, vente, prestation', u => gMine('contracts', u).filter(c => c.status === 'actif').length + ' actif(s)'],
  rents:    ['money', 'Encaissement, quittances et relances', u => { const n = gMine('rents', u).filter(r => !r.paidAt && rentState(r)[1] === 'bad').length; return n ? n + ' en retard' : 'Aucun retard'; }],
  tickets:  ['settings', 'Pannes, travaux et interventions', u => { const n = gMine('tickets', u).filter(t => tkSt(t) !== 'terminée').length; return n ? n + ' en cours' : 'Rien en cours'; }],
  providers:['agent', 'Plombiers, électriciens, artisans', u => gMine('providers', u).length + ' prestataire(s)'],
  deals:    ['trendUp', 'Du prospect à la signature', u => gMine('deals', u).filter(d => d.stage !== 'signe').length + ' en cours'],
  docs:     ['layers', 'Devis, proformas, factures, avoirs', u => { const n = gMine('docs', u).filter(d => d.type === 'FAC' && dRest(d) > 0).length; return n ? n + ' facture(s) à encaisser' : 'Tout est soldé'; }],
  fpay:     ['card', 'Encaissements et reçus', u => gMine('fpay', u).length + ' paiement(s)'],
  expenses: ['repeat', 'Charges et factures fournisseurs', u => money(gMine('expenses', u).reduce((s, x) => s + x.amount, 0))],
  finance:  ['chart', 'Encaissé, impayés et résultat net', () => 'Vue d\'ensemble'],
  reports:  ['file', 'Revenus, impayés, occupation, PDF', () => '6 rapports'],
  audit:    ['clock', 'Qui a fait quoi, et quand', u => gMine('audit', u).length + ' entrée(s)'],
  team:     ['users', 'Gestionnaires, agents et accès locataire', u => DB.filterItems(DB.K.users, x => x.parentId === u.id).length + ' membre(s)'],
  identity: ['user', 'Nom, NINEA, RCCM sur vos documents', () => 'Émetteur des PDF']
};
const GGROUPS = [
  ['Location', 'Baux, unités, locataires et loyers', ['leases', 'units', 'tenants', 'rents', 'contracts']],
  ['Relation', 'Propriétaires mandants et messagerie', ['owners', 'tmsgs', 'deals']],
  ['Technique', 'Interventions et artisans', ['tickets', 'providers']],
  ['Finances', 'Facturation, encaissements et pilotage', ['docs', 'fpay', 'expenses', 'finance', 'reports']],
  ['Administration', 'Équipe, identité et traçabilité', ['team', 'identity', 'audit']]
];
const gLabel = k => (GTABS.find(t => t[0] === k) || [k, k])[1];
const gAllowed = (u, k) => !u.member || memberCan(u, permFor('/manage/' + k));

function manageHub(u) {
  const card = k => { const m = GMETA[k]; if (!m) return '';
    let info = ''; try { info = m[2](u); } catch { info = ''; }
    return `<a class="drawer" href="#/manage/${k}"><div class="dico">${icon(m[0], 20)}</div>
      <div class="txt"><b>${esc(gLabel(k))}</b><div class="small muted desk">${esc(m[1])}</div><div class="small muted mob">${esc(info)}</div></div>
      <span class="dn">${esc(info)}</span>${icon('arrowRight', 18)}</a>`; };
  const extra = (EXTRA[u.role] || []).filter(() => !u.member);
  const extraHtml = extra.length ? `<div class="gsection"><h3>Autres espaces</h3><p class="small muted">Les pages qui ne sont pas dans le menu principal</p><div class="coffre">${extra.map(([h, t, ic, d]) => `<a class="drawer" href="${h}"><div class="dico">${icon(ic, 20)}</div><div class="txt"><b>${esc(t)}</b><div class="small muted desk">${esc(d)}</div><div class="small muted mob">${esc(d)}</div></div>${icon('arrowRight', 18)}</a>`).join('')}</div></div>` : '';
  const groups = GGROUPS.map(([t, d, keys]) => { const ks = keys.filter(k => gAllowed(u, k)); if (!ks.length) return '';
    return `<div class="gsection"><h3>${t}</h3><p class="small muted">${d}</p><div class="coffre">${ks.map(card).join('')}</div></div>`; }).join('') + extraHtml;
  return shellApp(u, page('Gestion', 'Chaque domaine dans son tiroir : ouvrez celui dont vous avez besoin.') + groups);
}
route(/^\/manage$/, () => {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) { toast('Espace réservé aux propriétaires et agences.', 'bad'); go('#/login'); return false; }
  return manageHub(u);
});
/* le menu et la barre du bas pointent vers l'accueil de la Gestion */
['owner', 'agency'].forEach(r => { const m = MENUS_RAW[r]; const e = m && m.find(x => x[0] === '#/manage/leases'); if (e) e[0] = '#/manage'; });
['owner', 'agency'].forEach(r => { const c = PILL[r]; if (c) c.forEach(part => part.forEach && part.forEach((h, i) => { if (h === '#/manage/leases') part[i] = '#/manage'; })); });

/* sur une section : fil de retour compact au lieu de la longue bande d'onglets */
const _mroute = routes.find(r => /manage\\\//.test(r.re.source) || /manage\\\/\(/.test(r.re.source));
document.head.insertAdjacentHTML('beforeend', '<style>'
  + '.gsection{margin-bottom:26px}.gsection h3{margin:0 0 2px}.gsection > p{margin:0 0 12px}'
  + '.gsection .coffre{margin:0}'
  + '.gback{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}'
  + '.gback .bk{width:36px;height:36px;border-radius:11px;border:1px solid var(--line-strong);background:var(--surface);display:grid;place-items:center;color:var(--ink);text-decoration:none;flex:none}'
  + '.gback .bk:hover{border-color:var(--brand);color:var(--brand)}'
  + '.gback .cur{font-weight:700;color:var(--ink)}.gback .sep{color:var(--muted)}'
  + '.gback select{max-width:210px;margin-left:auto;font-size:.85rem;padding:7px 10px}'
  + '@media (max-width:760px){.gback select{max-width:none;margin-left:0;width:100%;order:3}}'
  + '</style>');

/* anciennes adresses de la période payante : redirection silencieuse */
route(/^\/(owner|agency)\/subscription$/, () => { const u = Auth.current(); go(u ? Auth.home(u) : '#/login'); return false; });
route(/^\/admin\/(payments|subscriptions)$/, () => { const u = Auth.current(); go(u ? Auth.home(u) : '#/login'); return false; });

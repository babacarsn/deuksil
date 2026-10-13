/* ==========================================================================
   MODULE : tableau-agence.js — le tableau de bord de l'agence reprend la
   structure et le style de celui du propriétaire (80), avec ce dont une
   agence a besoin chaque jour :
     1. Commissions du mois : ce que l'agence a gagné, au taux des mandats.
     2. Quatre indicateurs : encaissé pour les mandants, loyers impayés,
        solde à reverser, mandats actifs.
     3. Évolution des encaissements sur six mois.
     4. Mon portefeuille : propriétaires, biens gérés, locataires, ventes.
     5. À traiter, puis les quatre actions rapides de l'agence.
   Un agent sans droit « finances » ne voit pas les montants : seulement
   le portefeuille, ce qu'il a à traiter et les actions de son ressort.
   ========================================================================== */

function paStats(u) {
  const s = dashStats(u), m = curMonth(), pm = prevMonth(m), owners = gMine('owners', u);
  const comDuMois = mois => owners.reduce((x, o) => x + ownerBalance(u, o, mois).com, 0);
  const comptes = owners.map(o => ({o, c: compteGestion(u, o)}));
  const rents = gMine('rents', u), retards = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
  const mois = [...Array(6)].map((_, i) => moisCle(m + '-01', i - 5));
  const mandats = gMine('mandates', u).filter(x => x.status === 'actif');
  return {s, m, owners, comptes, mandats, retards,
    com: comDuMois(m), comAvant: comDuMois(pm),
    impayes: retards.reduce((x, r) => x + rRest(r), 0),
    aReverser: comptes.reduce((x, k) => x + Math.max(0, k.c.solde), 0),
    nbAReverser: comptes.filter(k => k.c.solde > 0).length,
    mois, revenus: mois.map(x => monthIncome(u, x)), coms: mois.map(comDuMois)};
}

function paCommissions(d) {
  const v = variation(d.com, d.comAvant);
  return `<section class="pd-card pd-rev" data-tone="brand" aria-labelledby="pa-com-t">
    <div class="pd-rev-head">
      <div style="min-width:0"><h3 id="pa-com-t" class="pd-h">Commissions de l'agence</h3><p class="pd-sub">Gestion locative du mois</p></div>
      <div class="pd-month">${icon('calendar', 18)}<b>${moisCourt(d.m)} ${d.m.slice(0, 4)}</b></div>
    </div>
    <div class="pd-big">${money(d.com)}</div>
    <p class="pd-note">${icon('wallet', 17)}<span>Prélevées sur les loyers encaissés pour vos mandants</span></p>
    ${v ? `<p class="pd-var ${v.tone}">${v.up === undefined ? '' : icon(v.up ? 'trendUp' : 'trendDown', 14)}${esc(v.label)}</p>` : ''}
    <a class="pd-more" href="#/agency/commissions"><span>Voir le détail des commissions</span>${icon('arrowRight', 17)}</a>
  </section>`;
}

function paMinis(d) {
  const n = d.retards.length;
  const mini = (href, tone, ic, lab, val, foot, bad) => `<a class="pd-card pd-mini" data-tone="${tone}" href="${href}">
    <span class="pd-ic ${tone === 'bad' ? 'warn' : tone === 'gold' ? 'warn' : 'ok'}">${icon(ic, 22)}</span>
    <span class="pd-lab">${lab}</span><b class="pd-val${bad ? ' bad' : ''}">${val}</b><span class="pd-foot">${foot}</span></a>`;
  return `<div class="pd-duo pa-quad">
    ${mini('#/manage/rents', 'ok', 'wallet', 'Encaissé ce mois', money(d.s.encaisses), 'Loyers et factures, hors ventes')}
    ${mini('#/manage/rents', n ? 'bad' : 'ok', n ? 'alert' : 'checkCircle', 'Loyers impayés', money(d.impayes), n ? pluriel(n, 'loyer') + ' en retard' : 'Aucun retard', !!n)}
    ${mini('#/manage/transfers', d.aReverser ? 'gold' : 'ok', 'repeat', 'Solde à reverser', money(d.aReverser), d.nbAReverser ? pluriel(d.nbAReverser, 'propriétaire') + ' à payer' : 'Tous les comptes sont à jour')}
    ${mini('#/manage/mandates', 'info', 'file', 'Mandats actifs', String(d.mandats.length), pluriel(d.owners.length, 'propriétaire') + ' mandant' + (d.owners.length > 1 ? 's' : ''))}
  </div>`;
}

function paEvolution(d) {
  const max = Math.max(1, ...d.revenus), total = d.revenus.reduce((a, b) => a + b, 0), com = d.coms.reduce((a, b) => a + b, 0);
  return `<section class="pd-card pd-evo" data-tone="info" aria-labelledby="pa-evo-t">
    <div class="pd-evo-head">
      <div><h3 id="pa-evo-t" class="pd-h">Évolution des encaissements</h3><p class="pd-sub">Les 6 derniers mois</p></div>
      <span class="pd-evo-ic" aria-hidden="true">${icon('barres', 24)}</span>
    </div>
    <ul class="pd-bars">${d.mois.map((k, i) => {
      const v = d.revenus[i], pc = Math.round(v / max * 100);
      return `<li class="${i === 5 ? 'now' : ''}"><span class="pd-m">${moisCourt(k)}</span>
        <span class="pd-track" role="img" aria-label="${moisCourt(k)} : ${money(v)}, dont ${money(d.coms[i])} de commission"><i style="width:${v ? Math.max(pc, 2) : 0}%"></i></span>
        <span class="pd-amt">${v ? montantCourt(v) : '—'}</span></li>`; }).join('')}</ul>
    <p class="pd-foot" style="margin:14px 0 0">${total ? `${money(total)} encaissés en six mois, dont ${money(com)} de commissions pour l'agence` : 'Aucun encaissement sur la période : les paiements enregistrés apparaîtront ici.'}</p>
  </section>`;
}

function paPortefeuille(u, d) {
  const props = d.s.props, geres = props.filter(p => p.clientOwnerId).length;
  const loues = props.filter(p => p.status === 'loue').length, dispo = props.filter(p => ['disponible', 'discussion'].includes(p.status)).length;
  const ventes = gMine('deals', u), ouverts = ventes.filter(v => v.stage !== 'signe').length;
  const premier = (props.find(p => p.photos && p.photos.length) || {}).photos;
  const items = [
    ['#/manage/owners', PHOTOS.villa2, 'Propriétaires mandants',
      d.owners.length ? `${pluriel(d.owners.length, 'propriétaire')} · ${pluriel(d.mandats.length, 'mandat actif', 'mandats actifs')}` : 'Ajoutez les propriétaires qui vous confient leurs biens'],
    ['#/agency/properties', premier ? premier[0] : PHOTOS.villa1, 'Biens gérés',
      `${pluriel(props.length, 'bien')} · ${geres} sous mandat · ${pluriel(loues, 'loué')} · ${pluriel(dispo, 'disponible')}`],
    ['#/manage/leases', PHOTOS.maison1, 'Locataires & baux',
      d.s.actifs.length ? pluriel(d.s.actifs.length, 'bail actif', 'baux actifs') : 'Aucun bail en cours'],
    ['#/manage/deals', PHOTOS.villa3, 'Ventes',
      ventes.length ? `${pluriel(ouverts, 'dossier')} en cours · ${pluriel(ventes.length - ouverts, 'vente conclue', 'ventes conclues')}` : 'Aucun dossier de vente']
  ];
  return `<section class="pd-card pd-pat" data-tone="gold" aria-labelledby="pa-pf-t">
    <div class="pd-pat-head"><h3 id="pa-pf-t" class="pd-h">Mon portefeuille</h3>
      <a class="pd-all" href="#/manage">Tout voir ${icon('arrowRight', 16)}</a></div>
    <div class="pd-pat-list">${items.map(([h, img, t, sub]) => `<a class="pd-item" href="${h}">
      <span class="pd-thumb"><img src="${esc(img)}" alt="" loading="lazy"></span>
      <span class="pd-item-txt"><b>${esc(t)}</b><span class="pd-item-sub">${esc(sub)}</span><span class="pd-go">Accéder à la liste</span></span>
      ${icon('arrowRight', 18)}</a>`).join('')}</div>
  </section>`;
}

const PA_ACTIONS = [
  ['#/manage/owners', 'Ajouter un propriétaire', 'user', 'brand', 'gestion'],
  ['#/owner/property/new', 'Ajouter un bien', 'plus', 'ok', 'biens'],
  ['#/manage/rents', 'Encaisser un loyer', 'money', 'gold', 'gestion'],
  ['#/manage/docs', 'Créer une facture', 'layers', 'info', 'finances']
];
function paActions(u) {
  const acts = PA_ACTIONS.filter(a => !u.member || u.perms.includes(a[4]));
  if (!acts.length) return '';
  return `<section class="pd-actions" aria-labelledby="pa-act-t"><h3 id="pa-act-t" class="pd-h" style="margin-bottom:12px">Actions rapides</h3>
    <div class="qa-grid">${acts.map(([h, l, ic, tone]) => `<a class="quick-card pd-qa" data-tone="${tone}" href="${h}">
      <div class="ic-bubble">${icon(ic, 17)}</div><b>${l}</b></a>`).join('')}</div></section>`;
}

function tableauAgence(u) {
  const d = paStats(u), finances = !u.member || u.perms.includes('finances');
  if (!d.s.props.length && !d.owners.length) return `<div class="pd">${paActions(u)}</div>`;
  return `<div class="pd">
    ${finances ? `<div class="pd-top">
      <div class="pd-left">${paCommissions(d)}${paMinis(d)}</div>
      ${paEvolution(d)}
    </div>` : ''}
    <div class="pd-bottom">${paPortefeuille(u, d)}<div class="pd-left">${pdATraiter(u, d)}${paActions(u)}</div></div>
  </div>`;
}

(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/dashboard$');
  if (!r) return;
  r.fn = () => {
    const u = Auth.guard('agency'); if (!u) return false;
    return shellApp(u, dashHero(u) + tableauAgence(u));
  };
})();
/* Styles : css/02-refonte.css, § « Tableau de bord de l'agence ». */

/* « À traiter » de l'agence : un bien géré sans mandat actif n'a pas de base
   juridique pour la commission ; un mandat qui expire doit être renouvelé. */
const _todoList82 = todoList;
todoList = function (u, s) {
  const t = _todoList82(u, s);
  if (u.role !== 'agency' || (u.member && !u.perms.includes('gestion'))) return t;
  const actifs = gMine('mandates', u).filter(m => m.status === 'actif');
  const sansMandat = gMine('owners', u).filter(o => myProps(u).some(p => p.clientOwnerId === o.id) && !actifs.some(m => m.ownerId2 === o.id));
  if (sansMandat.length) t.push([`${pluriel(sansMandat.length, 'propriétaire')} sans mandat actif`,
    sansMandat.map(o => o.name).slice(0, 2).join(', ') + ' · biens gérés sans mandat signé', '#/manage/mandates', 'file', 'warn']);
  const bientot = actifs.filter(m => { const j = daysBetween(ymd(), m.end); return j >= 0 && j <= 30; });
  if (bientot.length) t.push([`${pluriel(bientot.length, 'mandat')} à renouveler`,
    bientot.map(m => `${m.ref} (${dateFr(m.end)})`).slice(0, 2).join(', '), '#/manage/mandates', 'file', 'warn']);
  return t;
};

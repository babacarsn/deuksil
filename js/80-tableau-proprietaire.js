/* ==========================================================================
   MODULE : tableau-proprietaire.js — refonte du tableau de bord du
   propriétaire, sur la structure validée :
     1. Revenus locatifs : les loyers encaissés du mois, gros chiffre,
        badge du mois, lien vers le détail.
     2. Deux cartes côte à côte : total encaissé ce mois, loyers impayés.
     3. Évolution des revenus : six mois en barres horizontales.
     4. Mon patrimoine : biens, locataires, ventes, documents, avec photo.
     5. À traiter : ce qui demande une action aujourd'hui.
   Tous les chiffres sont calculés sur les versements réels (acomptes
   compris, voir § 80 du README) : aucun graphique illustratif.
   L'agence garde son tableau de bord actuel.
   ========================================================================== */

ICONS.wallet = '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17"/><path d="M4 7.5h15.5A1.5 1.5 0 0 1 21 9v6a1.5 1.5 0 0 1-1.5 1.5H16a3 3 0 0 1 0-6h5"/><circle cx="16.2" cy="13.5" r=".6"/>';
ICONS.barres = '<path d="M4 20h16"/><path d="M6.5 16.5v-4M10.5 16.5v-7M14.5 16.5v-5M18.5 16.5V6"/><path d="M5 10l5-4 4 3 6-5"/>';

const MOIS_COURT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const moisCourt = k => MOIS_COURT[+k.slice(5, 7) - 1];
/* « 1 250 000 » devient « 1,25 M » sur les barres, où la place manque. */
const montantCourt = n => n >= 1e6 ? (n / 1e6).toLocaleString('fr-FR', {maximumFractionDigits: 2}) + ' M'
  : n >= 1e3 ? Math.round(n / 1e3).toLocaleString('fr-FR') + ' k' : String(n);
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? (plusieurs || un + 's') : un}`;

function pdStats(u) {
  const s = dashStats(u), m = curMonth(), pm = prevMonth(m), rents = gMine('rents', u);
  const loyersMois = encLoyers(rents, m), loyersAvant = encLoyers(rents, pm);
  const retards = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
  const impayes = retards.reduce((x, r) => x + rRest(r), 0);
  const mois = [...Array(6)].map((_, i) => moisCle(m + '-01', i - 5));
  const revenus = mois.map(x => monthIncome(u, x));
  const props = s.props;
  const parStatut = k => props.filter(p => p.status === k).length;
  const ventes = gMine('deals', u);
  const docs = DB.filterItems(DB.K.documents, d => d.ownerId === u.id).length
    + gMine('docs', u).length + gMine('contracts', u).length;
  return {s, m, loyersMois, loyersAvant, retards, impayes, mois, revenus, props, parStatut, ventes, docs};
}

function pdRevenus(d) {
  const v = variation(d.loyersMois, d.loyersAvant);
  return `<section class="pd-card pd-rev" data-tone="brand" aria-labelledby="pd-rev-t">
    <div class="pd-rev-head">
      <div style="min-width:0"><h3 id="pd-rev-t" class="pd-h">Revenus locatifs</h3><p class="pd-sub">Loyers encaissés</p></div>
      <div class="pd-month">${icon('calendar', 18)}<b>${moisCourt(d.m)} ${d.m.slice(0, 4)}</b></div>
    </div>
    <div class="pd-big">${money(d.loyersMois)}</div>
    <p class="pd-note">${icon('wallet', 17)}<span>Revenus effectivement encaissés pendant le mois</span></p>
    ${v ? `<p class="pd-var ${v.tone}">${v.up === undefined ? '' : icon(v.up ? 'trendUp' : 'trendDown', 14)}${esc(v.label)}</p>` : ''}
    <a class="pd-more" href="#/manage/finance"><span>Voir le détail des revenus</span>${icon('arrowRight', 17)}</a>
  </section>`;
}

function pdDuo(d) {
  const n = d.retards.length;
  return `<div class="pd-duo">
    <a class="pd-card pd-mini" data-tone="ok" href="#/manage/fpay">
      <span class="pd-ic ok">${icon('wallet', 22)}</span>
      <span class="pd-lab">Total encaissé ce mois</span>
      <b class="pd-val">${money(d.s.encaisses)}</b>
      <span class="pd-foot">Loyers et factures, hors ventes</span></a>
    <a class="pd-card pd-mini" data-tone="${n ? 'bad' : 'ok'}" href="#/manage/rents">
      <span class="pd-ic ${n ? 'warn' : 'ok'}">${icon(n ? 'alert' : 'checkCircle', 22)}</span>
      <span class="pd-lab">Loyers impayés</span>
      <b class="pd-val${n ? ' bad' : ''}">${money(d.impayes)}</b>
      <span class="pd-foot">${n ? pluriel(n, 'loyer') + ' en retard' : 'Aucun retard'}</span></a>
  </div>`;
}

function pdEvolution(d) {
  const max = Math.max(1, ...d.revenus), total = d.revenus.reduce((a, b) => a + b, 0);
  return `<section class="pd-card pd-evo" data-tone="info" aria-labelledby="pd-evo-t">
    <div class="pd-evo-head">
      <div><h3 id="pd-evo-t" class="pd-h">Évolution des revenus</h3><p class="pd-sub">Les 6 derniers mois</p></div>
      <span class="pd-evo-ic" aria-hidden="true">${icon('barres', 24)}</span>
    </div>
    <ul class="pd-bars">${d.mois.map((k, i) => {
      const v = d.revenus[i], pc = Math.round(v / max * 100);
      return `<li class="${i === 5 ? 'now' : ''}"><span class="pd-m">${moisCourt(k)}</span>
        <span class="pd-track" role="img" aria-label="${moisCourt(k)} : ${money(v)}"><i style="width:${v ? Math.max(pc, 2) : 0}%"></i></span>
        <span class="pd-amt">${v ? montantCourt(v) : '—'}</span></li>`; }).join('')}</ul>
    <p class="pd-foot" style="margin:14px 0 0">${total ? `${money(total)} encaissés en six mois · loyers et factures, hors ventes` : 'Aucun encaissement sur la période : les paiements enregistrés apparaîtront ici.'}</p>
  </section>`;
}

function pdPatrimoine(d) {
  const loues = d.parStatut('loue'), dispo = d.parStatut('disponible') + d.parStatut('discussion');
  const enVente = d.props.filter(p => VENDABLE.includes(p.transaction) && p.status !== 'vendu').length;
  /* Occupation sur les seuls logements à louer : un terrain en vente n'est pas « vacant ». */
  const locs = d.props.filter(p => p.transaction === 'location'), unites = DB.getData(DB.K.units).filter(x => locs.some(p => p.id === x.propertyId) && x.status !== 'archivee');
  const avecUnites = new Set(unites.map(x => x.propertyId)), sansUnites = locs.filter(p => !avecUnites.has(p.id));
  const total = unites.length + sansUnites.length;
  const occupes = unites.filter(x => x.status === 'occupée').length + sansUnites.filter(p => d.s.actifs.some(l => l.propertyId === p.id && !l.unitId)).length;
  const occ = total ? Math.round(occupes / total * 100) : 0;
  const ouverts = d.ventes.filter(v => v.stage !== 'signe').length, conclus = d.ventes.length - ouverts;
  const premier = (d.props.find(p => p.photos && p.photos.length) || {}).photos;
  const items = [
    ['#/owner/properties', premier ? premier[0] : PHOTOS.villa1, 'Mes biens immobiliers',
      `${pluriel(d.props.length, 'bien')} · ${pluriel(loues, 'loué')} · ${pluriel(dispo, 'disponible')}${enVente ? ' · ' + enVente + ' en vente' : ''}`],
    ['#/manage/leases', PHOTOS.maison1, 'Locataires & baux',
      d.s.actifs.length ? `${pluriel(d.s.actifs.length, 'bail actif', 'baux actifs')} · ${occupes} logement${occupes > 1 ? 's' : ''} occupé${occupes > 1 ? 's' : ''} sur ${total} (${occ} %)` : 'Aucun bail en cours'],
    ['#/manage/deals', PHOTOS.villa3, 'Ventes',
      d.ventes.length ? `${pluriel(ouverts, 'dossier')} en cours · ${pluriel(conclus, 'vente conclue', 'ventes conclues')}` : 'Aucun dossier de vente'],
    ['#/coffre', PHOTOS.bureau, 'Documents', d.docs ? `${pluriel(d.docs, 'document')} rangés dans le coffre` : 'Contrats, factures et quittances']
  ];
  return `<section class="pd-card pd-pat" data-tone="gold" aria-labelledby="pd-pat-t">
    <div class="pd-pat-head"><h3 id="pd-pat-t" class="pd-h">Mon patrimoine</h3>
      <a class="pd-all" href="#/owner/properties">Voir tout ${icon('arrowRight', 16)}</a></div>
    <div class="pd-pat-list">${items.map(([h, img, t, sub]) => `<a class="pd-item" href="${h}">
      <span class="pd-thumb"><img src="${esc(img)}" alt="" loading="lazy"></span>
      <span class="pd-item-txt"><b>${esc(t)}</b><span class="pd-item-sub">${esc(sub)}</span><span class="pd-go">Accéder à la liste</span></span>
      ${icon('arrowRight', 18)}</a>`).join('')}</div>
  </section>`;
}

function pdATraiter(u, d) {
  const todo = todoList(u, d.s);
  return `<section class="pd-card pd-todo" data-tone="${todo.length ? 'bad' : 'ok'}" aria-labelledby="pd-todo-t">
    <div class="pd-pat-head"><h3 id="pd-todo-t" class="pd-h">À traiter</h3>${todo.length ? `<span class="badge bad">${todo.length}</span>` : ''}</div>
    ${todo.length ? todo.map(([t, sub, h, ic, tone]) => `<a class="trow" href="${h}"><span class="itile sm ${tone === 'bad' ? 'orange' : tone === 'warn' ? 'gold' : ''}">${icon(ic, 17)}</span>
      <div class="txt" style="min-width:0"><b>${esc(t)}</b><div class="sub">${esc(sub)}</div></div>${icon('arrowRight', 16)}</a>`).join('')
      : `<p class="pd-foot" style="margin:4px 0 0">Rien à traiter : aucun retard, aucune demande en attente.</p>`}
  </section>`;
}

function tableauProprietaire(u) {
  if (!myProps(u).length) return dashOnboarding(u);
  const d = pdStats(u);
  return `<div class="pd">
    <div class="pd-top">
      <div class="pd-left">${pdRevenus(d)}${pdDuo(d)}</div>
      ${pdEvolution(d)}
    </div>
    <div class="pd-bottom">${pdPatrimoine(d)}${pdATraiter(u, d)}</div>
  </div>`;
}

(() => {
  const r = routes.find(x => x.re.source === '^\\/owner\\/dashboard$');
  if (!r) return;
  r.fn = () => {
    const u = Auth.guard('owner'); if (!u) return false;
    return shellApp(u, dashHero(u) + tableauProprietaire(u));
  };
})();

/* Styles : css/02-refonte.css, § « Tableau de bord du propriétaire ». */

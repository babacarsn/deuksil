/* ==========================================================================
   MODULE : tableaux.js — la structure et les bulles du tableau de bord du
   propriétaire (80) et de l'agence (82) pour tous les autres espaces :
   client, locataire, administrateur et propriétaire mandant (les espaces
   investisseur et promoteur ont été retirés, voir 57-roles).

   Un seul gabarit (tbPage) assemble les mêmes blocs, chacun dans sa couleur :
     1. une grande carte (bulle bleue) : le chiffre qui compte pour ce rôle ;
     2. quatre petites cartes (vert, rouge ou doré, doré, violet) ;
     3. une évolution en barres horizontales (bulle violette) ;
     4. une liste avec photos (bulle dorée) ;
     5. « À traiter » (bulle rouge s'il y a quelque chose, verte sinon) ;
     6. les actions rapides, chacune dans sa couleur.
   Styles : les classes .pd-* de css/02-refonte.css.
   ========================================================================== */

/* --- 1. Le gabarit --------------------------------------------------------- */
function tbGrand(c) {
  return `<section class="pd-card pd-rev" data-tone="brand" aria-label="${esc(c.title)}">
    <div class="pd-rev-head">
      <div style="min-width:0"><h3 class="pd-h">${esc(c.title)}</h3><p class="pd-sub">${esc(c.sub || '')}</p></div>
      ${c.badge ? `<div class="pd-month">${icon(c.badgeIc || 'calendar', 18)}<b>${esc(c.badge)}</b></div>` : ''}
    </div>
    <div class="pd-big">${c.big}</div>
    ${c.note ? `<p class="pd-note">${icon(c.noteIc || 'wallet', 17)}<span>${c.note}</span></p>` : ''}
    ${c.v ? `<p class="pd-var ${c.v.tone || ''}">${c.v.up === undefined ? '' : icon(c.v.up ? 'trendUp' : 'trendDown', 14)}${esc(c.v.label)}</p>` : ''}
    ${c.more ? `<a class="pd-more" href="${c.more[0]}"><span>${esc(c.more[1])}</span>${icon('arrowRight', 17)}</a>` : ''}
  </section>`;
}
/* [lien, ton, icône, libellé, valeur, pied, valeur en rouge ?] ; tons : ok, bad, gold, info */
function tbMinis(list) {
  return `<div class="pd-duo pa-quad">${list.map(([h, tone, ic, lab, val, foot, bad]) => `<a class="pd-card pd-mini" data-tone="${tone}" href="${h}">
    <span class="pd-ic ${tone === 'bad' || tone === 'gold' ? 'warn' : tone === 'info' ? 'info' : 'ok'}">${icon(ic, 22)}</span>
    <span class="pd-lab">${esc(lab)}</span><b class="pd-val${bad ? ' bad' : ''}">${val}</b><span class="pd-foot">${esc(foot || '')}</span></a>`).join('')}</div>`;
}
/* rows : [{label, v, disp, now}] — barres proportionnelles à v */
function tbBarres(c) {
  const max = Math.max(1, ...c.rows.map(r => r.v));
  return `<section class="pd-card pd-evo" data-tone="info" aria-label="${esc(c.title)}">
    <div class="pd-evo-head"><div><h3 class="pd-h">${esc(c.title)}</h3><p class="pd-sub">${esc(c.sub || '')}</p></div>
      <span class="pd-evo-ic" aria-hidden="true">${icon('barres', 24)}</span></div>
    ${c.rows.length ? `<ul class="pd-bars">${c.rows.map(r => `<li class="${r.now ? 'now' : ''}"><span class="pd-m" title="${esc(r.label)}">${esc(r.label)}</span>
      <span class="pd-track" role="img" aria-label="${esc(r.label)} : ${esc(r.disp)}"><i style="width:${r.v > 0 ? Math.max(Math.round(r.v / max * 100), 2) : 0}%"></i></span>
      <span class="pd-amt">${r.v ? esc(r.disp) : '—'}</span></li>`).join('')}</ul>` : ''}
    <p class="pd-foot" style="margin:14px 0 0">${c.foot || ''}</p>
  </section>`;
}
/* items : [lien, photo, titre, sous-titre, texte du lien] */
function tbListe(c) {
  return `<section class="pd-card pd-pat" data-tone="gold" aria-label="${esc(c.title)}">
    <div class="pd-pat-head"><h3 class="pd-h">${esc(c.title)}</h3>${c.all ? `<a class="pd-all" href="${c.all[0]}">${esc(c.all[1])} ${icon('arrowRight', 16)}</a>` : ''}</div>
    <div class="pd-pat-list">${c.items.map(([h, img, t, sub, go]) => `<a class="pd-item" href="${h}">
      <span class="pd-thumb"><img src="${esc(img)}" alt="" loading="lazy"></span>
      <span class="pd-item-txt"><b>${esc(t)}</b><span class="pd-item-sub">${esc(sub)}</span><span class="pd-go">${esc(go || 'Accéder à la liste')}</span></span>
      ${icon('arrowRight', 18)}</a>`).join('')}</div>
  </section>`;
}
/* rows : [titre, détail, lien, icône, ton (bad|warn|info)] */
function tbATraiter(c) {
  const n = c.rows.length;
  return `<section class="pd-card pd-todo" data-tone="${n ? 'bad' : 'ok'}" aria-label="${esc(c.title || 'À traiter')}">
    <div class="pd-pat-head"><h3 class="pd-h">${esc(c.title || 'À traiter')}</h3>${n ? `<span class="badge bad">${n}</span>` : ''}</div>
    ${n ? c.rows.map(([t, sub, h, ic, tone]) => `<a class="trow" href="${h}"><span class="itile sm ${tone === 'bad' ? 'orange' : tone === 'warn' ? 'gold' : ''}">${icon(ic, 17)}</span>
      <div class="txt" style="min-width:0"><b>${esc(t)}</b><div class="sub">${esc(sub)}</div></div>${icon('arrowRight', 16)}</a>`).join('')
      : `<p class="pd-foot" style="margin:4px 0 0">${esc(c.vide || 'Rien à traiter pour le moment.')}</p>`}
  </section>`;
}
/* [lien, libellé, icône, ton (brand|ok|gold|info), action à ouvrir] */
function tbActions(list) {
  if (!list || !list.length) return '';
  return `<section class="pd-actions"><h3 class="pd-h" style="margin-bottom:12px">Actions rapides</h3>
    <div class="qa-grid">${list.map(([h, l, ic, tone, ouvrir]) => `<a class="quick-card pd-qa" data-tone="${tone}" href="${h}"${ouvrir ? ` data-ouvrir="${ouvrir}"` : ''}>
      <div class="ic-bubble">${icon(ic, 17)}</div><b>${esc(l)}</b></a>`).join('')}</div></section>`;
}
function tbPage(c) {
  const haut = c.grand || c.minis || c.barres;
  return `<div class="pd">
    ${haut ? `<div class="pd-top">
      <div class="pd-left">${c.grand ? tbGrand(c.grand) : ''}${c.minis ? tbMinis(c.minis) : ''}</div>
      ${c.barres ? tbBarres(c.barres) : ''}
    </div>` : ''}
    ${c.liste || c.todo || c.actions ? `<div class="pd-bottom">${c.liste ? tbListe(c.liste) : '<div></div>'}<div class="pd-left">${c.todo ? tbATraiter(c.todo) : ''}${tbActions(c.actions)}</div></div>` : ''}
    ${c.apres || ''}
  </div>`;
}
const tbMois6 = () => [...Array(6)].map((_, i) => moisCle(curMonth() + '-01', i - 5));
const badgeMois = m => `${moisCourt(m)} ${m.slice(0, 4)}`;
/* Photo d'un bien : la sienne, sinon son illustration neutre (jamais la photo d'un autre bien) ;
   la photo décorative « repli » ne sert que lorsqu'aucun bien n'est concerné. */
const photoDe = (p, repli) => p ? ((p.photos && p.photos.length) ? p.photos[0] : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sceneSvg(p))) : repli;
const remplacerRoute = (source, fn) => { const r = routes.find(x => x.re.source === source); if (r) r.fn = fn; return r; };

/* --- 2. Client ------------------------------------------------------------- */
function biensPourAlerte(criteres) {
  const garde = searchState;
  searchState = {transaction: '', region: '', city: '', quartier: '', type: '', min: '', max: '', rooms: '', baths: '', surface: '', furnished: false, parking: false, sort: 'recent', page: 1, q: '', ...(criteres || {})};
  try { return applySearch(); } finally { searchState = garde; }
}
function tableauClient(u) {
  const m = curMonth(), pubs = published();
  const favs = DB.filterItems(DB.K.favorites, f => f.userId === u.id);
  const visits = DB.filterItems(DB.K.visits, v => v.clientId === u.id);
  const alerts = DB.filterItems(DB.K.searches, s => s.userId === u.id);
  const aVenir = visits.filter(v => v.status === 'acceptee' && String(v.date) >= ymd()).sort((a, b) => a.date < b.date ? -1 : 1);
  const enAttente = visits.filter(v => v.status === 'attente');
  const nonLus = typeof conversationsDe === 'function' ? conversationsDe(u).reduce((s, c) => s + c.nonLus, 0) : 0;
  const pourVous = alerts.length ? new Set(alerts.flatMap(a => biensPourAlerte(a.criteria).map(p => p.id))).size : pubs.length;
  const nouveaux = mois => pubs.filter(p => String(p.createdAt || '').startsWith(mois)).length;
  const favProps = favs.map(f => gProp(f.propertyId)).filter(Boolean), perdus = favProps.filter(p => ['loue', 'vendu'].includes(p.status));
  const reco = mixed(pubs), fi = favs.map(f => f.propertyId);
  return tbPage({
    grand: {title: alerts.length ? 'Biens pour vos alertes' : 'Biens disponibles', sub: alerts.length ? `Annonces en ligne qui répondent à ${pluriel(alerts.length, 'alerte')}` : 'Annonces vérifiées en ligne',
      badge: badgeMois(m), big: pluriel(pourVous, 'bien'), noteIc: 'sparkle', note: `${pluriel(nouveaux(m), 'nouvelle annonce', 'nouvelles annonces')} ce mois-ci`,
      more: ['#/search', 'Lancer une recherche']},
    minis: [
      ['#/client/favorites', 'bad', 'heart', 'Mes favoris', String(favs.length), perdus.length ? `${perdus.length} plus disponible${perdus.length > 1 ? 's' : ''}` : 'Tous encore disponibles'],
      ['#/client/visits', 'ok', 'calendar', 'Visites à venir', String(aVenir.length), aVenir[0] ? 'Prochaine le ' + dateFr(aVenir[0].date) : `${enAttente.length} en attente de réponse`],
      ['#/client/messages', 'info', 'message', 'Messages non lus', String(nonLus), nonLus ? 'Des réponses vous attendent' : 'Vous êtes à jour'],
      ['#/client/alerts', 'gold', 'bell', 'Mes alertes', String(alerts.length), alerts.length ? 'Recherches enregistrées' : 'Enregistrez une recherche']],
    barres: {title: 'Nouvelles annonces', sub: 'Les 6 derniers mois', rows: tbMois6().map((k, i) => { const v = nouveaux(k); return {label: moisCourt(k), v, disp: String(v), now: i === 5}; }),
      foot: `${pluriel(pubs.length, 'annonce')} en ligne aujourd'hui : locations, ventes et terrains vérifiés.`},
    liste: {title: 'Mon espace', all: ['#/search', 'Rechercher'], items: [
      ['#/client/favorites', photoDe(favProps[0], PHOTOS.villa2), 'Mes favoris', favs.length ? `${pluriel(favs.length, 'bien')} mis de côté` : 'Touchez le cœur d\'une annonce pour la garder'],
      ['#/client/visits', PHOTOS.maison2, 'Mes visites', visits.length ? `${pluriel(visits.length, 'demande')} · ${aVenir.length} à venir` : 'Aucune visite demandée'],
      ['#/client/alerts', PHOTOS.terrain, 'Mes alertes', alerts.length ? `${pluriel(alerts.length, 'recherche')} surveillée${alerts.length > 1 ? 's' : ''}` : 'Soyez prévenu des nouvelles annonces'],
      ['#/client/messages', PHOTOS.bureau, 'Mes messages', nonLus ? `${pluriel(nonLus, 'message')} non lu${nonLus > 1 ? 's' : ''}` : 'Vos échanges avec les propriétaires et agences']]},
    todo: {title: 'À suivre', vide: 'Rien en attente : lancez une recherche ou enregistrez une alerte.', rows: [
      ...aVenir.slice(0, 2).map(v => [`Visite le ${dateFr(v.date)}${v.time ? ' à ' + v.time : ''}`, (gProp(v.propertyId) || {}).title || '', '#/client/visits', 'calendar', 'info']),
      ...(enAttente.length ? [[`${pluriel(enAttente.length, 'demande')} de visite en attente`, 'Le propriétaire n\'a pas encore répondu', '#/client/visits', 'clock', 'warn']] : []),
      ...(nonLus ? [[`${pluriel(nonLus, 'message')} non lu${nonLus > 1 ? 's' : ''}`, 'Ouvrez votre messagerie', '#/client/messages', 'message', 'info']] : []),
      ...(perdus.length ? [[`${pluriel(perdus.length, 'favori')} n'est plus disponible`.replace('favoris n\'est', 'favoris ne sont'), perdus.map(p => p.title).slice(0, 2).join(', '), '#/client/favorites', 'heart', 'bad']] : [])]},
    actions: [['#/search', 'Rechercher un bien', 'search', 'info'], ['#/client/favorites', 'Mes favoris', 'heart', 'brand'],
      ['#/client/alerts', 'Créer une alerte', 'bell', 'gold'], ['#/compare', 'Comparer des biens', 'scale', 'ok']],
    apres: recoHtml(reco, fi)});
}
const _clientRoute83 = routes.find(r => r.re.source.includes('client') && r.re.source.includes('dashboard'));
if (_clientRoute83) _clientRoute83.fn = () => {
  const u = Auth.guard('client'); if (!u) return false;
  return shellApp(u, `<div class="hero-card hero-photo" style="border-radius:26px;padding:26px 24px 24px;color:#fff;position:relative;overflow:hidden">
      <img class="hp-bg" src="${PHOTOS.bnClient}" alt="" loading="eager">
      <p style="margin:0 0 8px;opacity:.9;position:relative">Bonjour, <b>${esc(u.firstName)}</b></p><h1 style="font-size:clamp(1.7rem,4.6vw,2.6rem);max-width:14ch;color:#fff">Trouvez le bien qui vous correspond au <span style="color:#D0A361">Sénégal</span></h1>
      <p style="color:#CCD8E6;max-width:44ch;margin:10px 0 0">Locations, ventes et terrains, tout est ici.</p>${searchPill()}</div>` + tableauClient(u));
};

/* --- 3. Locataire ---------------------------------------------------------- */
function tableauLocataire(u, l) {
  const p = gProp(l.propertyId), m = curMonth(), Y = m.slice(0, 4);
  const rents = DB.filterItems(DB.K.rents, r => r.leaseId === l.id).sort((a, b) => a.month < b.month ? -1 : 1);
  const late = rents.filter(r => !r.paidAt && rentState(r)[1] === 'bad'), next = rents.find(r => !r.paidAt && rentState(r)[1] !== 'bad');
  const du = late.reduce((s, r) => s + rRest(r), 0) + (next && next.month <= m ? rRest(next) : 0);
  const verse = mois => rents.reduce((s, r) => s + rPays(r).filter(x => String(x.date).startsWith(mois)).reduce((a, x) => a + (+x.amount || 0), 0), 0);
  const fin = leaseEnd(l), jours = daysBetween(ymd(), fin);
  const tickets = DB.filterItems(DB.K.tickets, t => t.tenantId === u.id), ouverts = tickets.filter(t => tkSt(t) !== 'terminée');
  const quittances = rents.filter(r => r.paidAt).length;
  const nonLus = typeof conversationsDe === 'function' ? conversationsDe(u).reduce((s, c) => s + c.nonLus, 0) : 0;
  const echeance = r => `${String(dueDayOf(l)).padStart(2, '0')}/${r.month.slice(5)}/${r.month.slice(0, 4)}`;
  return tbPage({
    grand: {title: 'Mon loyer', sub: late.length ? 'Loyers en retard et loyer du mois' : next ? 'Prochaine échéance' : 'Situation de mes loyers',
      badge: badgeMois(late.length || !next ? m : next.month), big: money(late.length ? du : next ? rRest(next) : 0),
      noteIc: late.length ? 'alert' : 'wallet',
      note: late.length ? `${pluriel(late.length, 'loyer')} en retard : à régler au plus vite` : next ? `À régler avant le ${echeance(next)}` : 'Vous êtes à jour de vos loyers',
      v: late.length ? {label: 'Retard de paiement', tone: 'bad'} : null, more: ['#/tenant/rents', 'Voir mes loyers']},
    minis: [
      ['#/tenant/rents', late.length ? 'bad' : 'ok', late.length ? 'alert' : 'checkCircle', 'Loyers en retard', money(late.reduce((s, r) => s + rRest(r), 0)), late.length ? pluriel(late.length, 'mois', 'mois') + ' à régulariser' : 'Aucun retard', !!late.length],
      ['#/tenant/payments', 'ok', 'wallet', `Payé en ${Y}`, money(verse(Y)), `${pluriel(quittances, 'quittance')} disponible${quittances > 1 ? 's' : ''}`],
      ['#/tenant/rents', 'info', 'repeat', 'Loyer mensuel', money(l.rent), 'Échéance le ' + dueDayOf(l) + ' du mois'],
      ['#/tenant/home', 'gold', 'calendar', 'Fin du bail', dateFr(fin), jours < 0 ? 'Bail échu : voyez avec votre bailleur' : `Dans ${pluriel(jours, 'jour')}`]],
    barres: {title: 'Mes paiements', sub: 'Les 6 derniers mois', rows: tbMois6().map((k, i) => { const v = verse(k); return {label: moisCourt(k), v, disp: montantCourt(v), now: i === 5}; }),
      foot: `${money(tbMois6().reduce((s, k) => s + verse(k), 0))} versés en six mois.`},
    liste: {title: 'Mon logement', items: [
      ['#/tenant/rents', photoDe(p, PHOTOS.cover), p ? p.title : 'Mon logement', p ? `${p.quartier}, ${p.city} · bail du ${dateFr(l.start)} au ${dateFr(fin)}` : `Bail jusqu'au ${dateFr(fin)}`, 'Voir mes loyers'],
      ['#/tenant/quittances', PHOTOS.bureau, 'Mes quittances', quittances ? `${pluriel(quittances, 'quittance')} à télécharger` : 'Elles arrivent à chaque loyer réglé', 'Voir mes quittances'],
      ['#/tenant/tickets', PHOTOS.maison3, 'Mes demandes d\'intervention', ouverts.length ? `${pluriel(ouverts.length, 'demande')} en cours` : 'Signalez une panne ou un problème', 'Voir mes demandes'],
      ['#/tenant/messages', PHOTOS.villa4, 'Mon propriétaire', nonLus ? `${pluriel(nonLus, 'message')} non lu${nonLus > 1 ? 's' : ''}` : 'Échangez avec votre bailleur', 'Ouvrir la messagerie']]},
    todo: {vide: 'Rien à traiter : vous êtes à jour.', rows: [
      ...late.map(r => [`Loyer de ${monthLabel(r.month)} en retard`, money(rRest(r)) + ' à régler', '#/tenant/rents', 'money', 'bad']).slice(0, 3),
      ...(next && daysBetween(ymd(), next.month + '-' + String(dueDayOf(l)).padStart(2, '0')) <= 7 ? [[`Loyer de ${monthLabel(next.month)} bientôt dû`, `${money(rRest(next))} avant le ${echeance(next)}`, '#/tenant/rents', 'clock', 'warn']] : []),
      ...ouverts.slice(0, 2).map(t => [t.title, 'Intervention ' + tkSt(t), '#/tenant/tickets', 'settings', 'info']),
      ...(jours >= 0 && jours <= 60 ? [['Votre bail se termine bientôt', `Le ${dateFr(fin)} : parlez du renouvellement avec votre bailleur`, '#/tenant/messages', 'calendar', 'warn']] : []),
      ...(nonLus ? [[`${pluriel(nonLus, 'message')} non lu${nonLus > 1 ? 's' : ''}`, 'De votre propriétaire', '#/tenant/messages', 'message', 'info']] : [])]},
    actions: [['#/tenant/rents', 'Mes loyers', 'money', 'brand'], ['#/tenant/quittances', 'Mes quittances', 'file', 'ok'],
      ['#/tenant/tickets', 'Signaler un problème', 'alert', 'gold'], ['#/tenant/messages', 'Contacter le propriétaire', 'message', 'info']]});
}
const _tenantRoute83 = routes.find(r => r.re.source === '^\\/tenant\\/(home|rents|tickets)$');
if (_tenantRoute83) {
  const _t83 = _tenantRoute83.fn;
  _tenantRoute83.fn = tab => {
    if (tab !== 'home') return _t83(tab);
    const u = Auth.current();
    if (!u || u.role !== 'tenant') return _t83(tab);
    const l = DB.findItem(DB.K.leases, u.leaseId);
    if (!l) return _t83(tab);
    const hero = spaceHero(PHOTOS.bnClient, 'Bonjour ' + u.firstName, 'Votre logement et vos loyers',
      [['#/tenant/quittances', 'Mes quittances', 'file'], ['#/tenant/tickets', 'Signaler un problème', 'alert']]);
    return shellApp(u, hero + tableauLocataire(u, l));
  };
}

/* --- 4. Administrateur ----------------------------------------------------- */
function tableauAdmin(u) {
  const m = curMonth(), users = DB.getData(DB.K.users), props = DB.getData(DB.K.properties);
  const reports = DB.getData(DB.K.reports).filter(r => r.status === 'nouveau');
  const pending = props.filter(p => p.listingStatus === 'attente'), suspendus = users.filter(x => x.status === 'suspendu');
  const nvx = mois => users.filter(x => String(x.createdAt || '').startsWith(mois)).length;
  const annMois = mois => props.filter(p => String(p.createdAt || '').startsWith(mois)).length;
  const pubs = props.filter(p => p.listingStatus === 'publiee' && listable(p));   // « en ligne » = visible dans la recherche (bien ni loué ni vendu)
  const role = r => users.filter(x => x.role === r).length;
  return tbPage({
    grand: {title: 'Activité de la plateforme', sub: 'Annonces créées ce mois', badge: badgeMois(m), big: pluriel(annMois(m), 'annonce'),
      noteIc: 'users', note: `${pluriel(nvx(m), 'nouveau compte', 'nouveaux comptes')} ce mois-ci`, v: variation(annMois(m), annMois(prevMonth(m))),
      more: ['#/admin/properties', 'Voir tous les biens']},
    minis: [
      ['#/admin/users', 'info', 'users', 'Utilisateurs', String(users.length), `${role('owner')} propriétaires · ${role('agency')} agences`],
      ['#/admin/listings', 'ok', 'checkCircle', 'Annonces publiées', String(pubs.length), `sur ${pluriel(props.length, 'bien')}`],
      ['#/admin/signalements', reports.length ? 'bad' : 'ok', 'alert', 'Signalements', String(reports.length), reports.length ? 'À examiner' : 'Aucun en attente', !!reports.length],
      ['#/admin/listings', 'gold', 'clock', 'À valider', String(pending.length), pending.length ? 'Annonces en attente' : 'Rien en attente']],
    barres: {title: 'Nouveaux comptes', sub: 'Les 6 derniers mois', rows: tbMois6().map((k, i) => { const v = nvx(k); return {label: moisCourt(k), v, disp: String(v), now: i === 5}; }),
      foot: `${pluriel(users.length, 'compte')} au total, dont ${role('client')} clients et ${role('tenant')} locataires.`},
    liste: {title: 'Plateforme', items: [
      ['#/admin/users', PHOTOS.bureau, 'Utilisateurs', `${pluriel(users.length, 'compte')} · ${suspendus.length} suspendu${suspendus.length > 1 ? 's' : ''}`],
      ['#/admin/listings', PHOTOS.villa1, 'Annonces', `${pubs.length} en ligne · ${pending.length} à valider`],
      ['#/admin/signalements', PHOTOS.maison2, 'Signalements', reports.length ? `${pluriel(reports.length, 'signalement')} à traiter` : 'Aucun signalement en attente'],
      ['#/admin/verifications', PHOTOS.villa3, 'Vérifications', 'Niveaux de confiance des comptes et des annonces']]},
    todo: {vide: 'Rien à traiter : aucune annonce ni aucun signalement en attente.', rows: [
      ...(pending.length ? [[`${pluriel(pending.length, 'annonce')} à valider`, pending.map(p => p.title).slice(0, 2).join(', '), '#/admin/listings', 'home', 'warn']] : []),
      ...(reports.length ? [[`${pluriel(reports.length, 'signalement')} à examiner`, 'Annonces signalées par les utilisateurs', '#/admin/signalements', 'alert', 'bad']] : []),
      ...(suspendus.length ? [[`${pluriel(suspendus.length, 'compte')} suspendu${suspendus.length > 1 ? 's' : ''}`, suspendus.map(displayName).slice(0, 2).join(', '), '#/admin/users', 'user', 'info']] : [])]},
    actions: [['#/admin/listings', 'Valider les annonces', 'checkCircle', 'ok'], ['#/admin/signalements', 'Signalements', 'alert', 'gold'],
      ['#/admin/users', 'Utilisateurs', 'users', 'brand'], ['#/admin/settings', 'Paramètres', 'settings', 'info']],
    apres: `<section class="pd-card pd-todo" data-tone="info" aria-label="Activité récente"><div class="pd-pat-head"><h3 class="pd-h">Activité récente</h3></div>
      ${DB.getData(DB.K.activity).slice(-6).reverse().map(a => `<div class="trow" style="cursor:default"><span class="itile sm">${icon('sparkle', 15)}</span>
        <div class="txt" style="min-width:0"><b style="font-weight:500">${esc(a.text)}</b><div class="sub">${dateTimeFr(a.createdAt)}</div></div></div>`).join('') || '<p class="pd-foot">Aucune activité.</p>'}</section>`});
}
remplacerRoute('^\\/admin\\/dashboard$', () => {
  const u = Auth.guard('admin'); if (!u) return false;
  return shellApp(u, spaceHero(PHOTOS.bnAgency, 'Bonjour ' + u.firstName, 'Administration DEUKSIL', [['#/admin/listings', 'Annonces à valider', 'checkCircle'], ['#/admin/users', 'Utilisateurs', 'users']]) + tableauAdmin(u));
});

/* --- 5. Propriétaire mandant : ses biens sont gérés par une agence ---------- */
function tableauMandant(u) {
  const fiche = DB.findItem(DB.K.owners, u.ownerRec) || {}, agence = DB.findItem(DB.K.users, fiche.ownerId);
  if (!agence) return tbPage({todo: {rows: [], vide: 'Votre agence est introuvable : contactez-la.'}});
  const m = curMonth(), c = compteGestion(agence, fiche), b = ownerBalance(agence, fiche, m), taux = tauxDuMois(agence, fiche, m);
  const biens = myProps(u), mandat = mandateOf(agence, fiche.id);
  return tbPage({
    grand: {title: 'Revenus de vos biens', sub: `Encaissés par ${agence.agencyName || 'votre agence'}`, badge: badgeMois(m), big: money(b.encaisse),
      note: 'Loyers et factures encaissés ce mois pour vous', v: variation(b.encaisse, ownerBalance(agence, fiche, prevMonth(m)).encaisse),
      more: ['#/mandant/releves', 'Voir mes relevés']},
    minis: [
      ['#/mandant/releves', 'ok', 'chart', 'Net vous revenant', money(c.du), 'Après dépenses et commission'],
      ['#/mandant/releves', c.solde > 0 ? 'gold' : 'ok', 'repeat', 'Reste à percevoir', money(Math.max(0, c.solde)), c.solde > 0 ? 'Votre agence vous le doit' : 'Vous êtes à jour'],
      ['#/mandant/releves', 'info', 'wallet', 'Déjà reversé', money(c.verse), pluriel(c.reversements.length, 'versement')],
      ['#/mandant/releves', 'info', 'file', 'Commission de l\'agence', taux + ' %', mandat ? `Mandat ${mandat.ref} jusqu'au ${dateFr(mandat.end)}` : 'Taux de votre fiche']],
    barres: {title: 'Net des 6 derniers mois', sub: 'Ce qui vous revient, mois par mois', rows: tbMois6().map((k, i) => { const v = Math.max(0, ownerBalance(agence, fiche, k).net); return {label: moisCourt(k), v, disp: montantCourt(v), now: i === 5}; }),
      foot: `${money(c.enc)} encaissés pour vous depuis le début du mandat.`},
    liste: {title: 'Mes biens confiés', all: ['#/owner/properties', 'Tout voir'], items: biens.slice(0, 4).map(p => ['#/owner/properties', photoDe(p, PHOTOS.villa1), p.title, `${p.quartier}, ${p.city} · ${STATUS_LABEL[p.status] || p.status}`, 'Voir le bien'])},
    todo: {title: 'À suivre', vide: 'Rien en attente : votre compte est à jour.', rows: [
      ...(c.solde > 0 ? [[`${money(c.solde)} à percevoir`, `Montant dû par ${agence.agencyName || 'votre agence'}`, '#/mandant/releves', 'repeat', 'warn']] : []),
      ...(mandat && daysBetween(ymd(), mandat.end) <= 30 ? [['Votre mandat arrive à échéance', `Le ${dateFr(mandat.end)}`, '#/coffre', 'file', 'warn']] : [])]},
    actions: [['#/mandant/releves', 'Mes relevés', 'money', 'brand'], ['#/owner/properties', 'Mes biens confiés', 'home', 'ok'],
      ['#/coffre', 'Mes documents', 'file', 'gold'], ['#/owner/messages', 'Écrire à mon agence', 'message', 'info']]});
}
remplacerRoute('^\\/owner\\/dashboard$', () => {
  const u = Auth.guard('owner'); if (!u) return false;
  return shellApp(u, dashHero(u) + (estMandant(u) ? tableauMandant(u) : tableauProprietaire(u)));
});

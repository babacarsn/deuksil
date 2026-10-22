/* =============================================================================
   MODULE : 99f-stats.js — page « Statistiques » de l'administration
   L'ancienne page dessinait ses barres dans un SVG étiré : sur ordinateur les
   noms de régions se chevauchaient, les rôles restaient en anglais (owner,
   tenant…), « Revenus par type » restait vide sans explication et le dernier
   graphique comptait des biens sous le titre « Transactions ».
   Même contenu, en barres horizontales lisibles à toutes les largeurs.
   ============================================================================= */
(() => {
  const ROLES_FR = {admin: 'Administration', owner: 'Propriétaires', agency: 'Agences', client: 'Clients', tenant: 'Locataires',
    manager: 'Gestionnaires', agent: 'Agents', investor: 'Investisseurs', promoter: 'Promoteurs'};
  const TYPES_FR = {appartement: 'Appartements', villa: 'Villas', maison: 'Maisons', studio: 'Studios', chambre: 'Chambres',
    terrain: 'Terrains', bureau: 'Bureaux', 'local commercial': 'Locaux commerciaux'};
  const PAIEMENTS_FR = {inscription: 'Inscriptions', registration: 'Inscriptions', abonnement: 'Abonnements', boost: 'Mises en avant', annonce: 'Annonces'};

  function barres(titre, sous, lignes, {argent = false, vide = 'Aucune donnée pour le moment.', max = 8} = {}) {
    let l = lignes.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (l.length > max) { const reste = l.slice(max - 1).reduce((s, [, v]) => s + v, 0); l = [...l.slice(0, max - 1), ['Autres', reste]]; }
    const haut = Math.max(1, ...l.map(([, v]) => v)), total = l.reduce((s, [, v]) => s + v, 0);
    return `<section class="card stat-carte"><div class="stat-tete"><h3>${esc(titre)}</h3><span class="stat-total">${argent ? money(total) : total}</span></div>
      <p class="small muted" style="margin:2px 0 14px">${esc(sous)}</p>
      ${l.length ? `<ul class="pd-bars stat-bars">${l.map(([lab, v], i) => `<li class="${i === 0 ? 'now' : ''}"><span class="pd-m" title="${esc(lab)}">${esc(lab)}</span>
        <span class="pd-track" role="img" aria-label="${esc(lab)} : ${argent ? money(v) : v}"><i style="width:${Math.max(Math.round(v / haut * 100), 3)}%"></i></span>
        <span class="pd-amt">${argent ? money(v) : v}</span></li>`).join('')}</ul>`
        : `<p class="small muted" style="margin:0">${esc(vide)}</p>`}</section>`;
  }

  const r = routes.find(x => x.re.source === '^\\/admin\\/reports$');
  if (!r) return;
  r.fn = () => {
    const u = Auth.guard('admin'); if (!u) return false;
    const props = DB.getData(DB.K.properties), users = DB.getData(DB.K.users), pays = DB.getData(DB.K.payments) || [];
    const compte = (liste, cle) => Object.entries(liste.reduce((a, x) => { const k = cle(x); if (k) a[k] = (a[k] || 0) + 1; return a; }, {}));
    const parRegion = compte(props, p => p.region);
    const parType = compte(props, p => TYPES_FR[p.type] || p.type);
    const parRole = compte(users.filter(x => x.role !== 'admin'), x => ROLES_FR[x.role] || x.role);
    const encaisse = Object.entries(pays.filter(p => p.status === 'paye').reduce((a, p) => { const k = PAIEMENTS_FR[p.type] || p.type || 'Autres'; a[k] = (a[k] || 0) + p.amount; return a; }, {}));
    return shellApp(u, page('Statistiques', 'Lecture consolidée de l\'activité.') + `
      <div class="stat-grille">
        ${barres('Biens par région', `${props.length} biens référencés`, parRegion)}
        ${barres('Biens par type', 'Toutes transactions confondues', parType)}
        ${barres('Comptes par profil', `${parRole.reduce((s, [, v]) => s + v, 0)} comptes, hors administration`, parRole)}
        ${barres('Encaissements de la plateforme', 'Paiements reçus par DEUKSIL, par nature', encaisse, {argent: true, vide: 'Aucun paiement encaissé par la plateforme pour le moment.'})}
      </div>`);
  };
})();

/* ==========================================================================
   VUE : landing
   ========================================================================== */
route(/^\/(?:#[\w-]+)?$/, () => {
  const pubs = published();
  const popular = [...pubs].sort((a, b) => b.views - a.views).slice(0, 6);
  const counts = {
    location: pubs.filter(p => p.transaction === 'location').length,
    vente: pubs.filter(p => p.transaction === 'vente').length,
    terrain: pubs.filter(p => p.transaction === 'terrain').length
  };
  return shellPublic(`
  <section class="hero"><div class="wrap hero-grid">
    <div>
      <h1>Le logement au Sénégal, sans les allers-retours.</h1>
      <p class="lede">DEUKSIL rassemble les locations, ventes et terrains vérifiés, du Plateau à Ziguinchor. Vous voyez ce qui est réellement disponible, vous contactez directement, vous planifiez la visite.</p>
      <form class="searchbar" data-action="quick-search">
        <select name="transaction"><option value="location">Location</option><option value="vente">Vente</option><option value="terrain">Terrain</option></select>
        <select name="region"><option value="">Toutes les régions</option>${Object.keys(LOCATIONS).map(r => `<option>${r}</option>`).join('')}</select>
        <select name="type"><option value="">Tous les types</option>${PROPERTY_TYPES.map(t => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
        <button class="btn">${icon('search', 16)} Rechercher</button>
      </form>
      <div class="row small muted" style="margin-top:14px;gap:18px;flex-wrap:wrap">
        <span>${counts.location} locations</span><span>${counts.vente} biens à vendre</span><span>${counts.terrain} terrains</span></div>
    </div>
    <div class="hero-card">
      <div class="photo" style="aspect-ratio:16/11"><img src="${PHOTOS.cover}" alt="" loading="lazy"></div>
      <div class="hero-chip">${icon('checkCircle', 15)} Dossier vérifié par DEUKSIL</div>
      <div style="padding:18px">
        <div class="row-between"><b>${esc(popular[0]?.title || 'Villa contemporaine')}</b>${badge('Disponible', 'ok')}</div>
        <div class="small muted">${icon('pin', 13)} ${esc(popular[0]?.quartier || 'Ngor')}, ${esc(popular[0]?.city || 'Dakar')}</div>
        <div class="row-between" style="margin-top:12px">
          <span style="font-family:var(--display);font-size:1.4rem;font-weight:600;color:var(--brand)">${money(popular[0]?.price || 1200000)}</span>
          <a class="btn sm" href="#/property/${popular[0]?.id || ''}">Voir le bien</a></div>
      </div>
    </div>
  </div></section>

  <section class="section" id="comment"><div class="wrap">
    <p class="kicker">Comment ça marche</p><h2>Trois étapes, pas dix visites inutiles</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:26px">
      ${[['1','Créez votre compte','Inscription gratuite avec votre numéro de CNI. Aucun frais, aucun abonnement.'],
         ['2','Cherchez et filtrez','Par ville, quartier, budget, nombre de chambres. Seules les annonces validées apparaissent.'],
         ['3','Visitez et décidez','Vous contactez le propriétaire, vous proposez une date, il confirme dans son espace.']]
        .map(([n, t, d]) => `<div class="card"><div style="font-family:var(--display);font-size:2rem;font-weight:600;color:var(--gold)">${n}</div><h3 style="margin:6px 0">${t}</h3><p class="muted small" style="margin:0">${d}</p></div>`).join('')}
    </div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="row-between"><div><p class="kicker">Les plus consultés</p><h2>Biens populaires cette semaine</h2></div>
      <a class="btn ghost sm" href="#/search">Voir toutes les annonces</a></div>
    <div class="props" style="margin-top:24px">${popular.map(p => propertyCard(p)).join('')}</div>
  </div></section>

  <section class="section" id="proprietaires"><div class="wrap two-col">
    <div class="card" style="background:var(--brand);color:#fff;border:0">
      <h2 style="color:#fff">Vous êtes propriétaire</h2>
      <p style="opacity:.9">Publiez vos biens, recevez des demandes de personnes déjà inscrites et vérifiées, et gardez la main sur vos disponibilités.</p>
      <ul class="small" style="opacity:.92;line-height:2;padding-left:18px">
        <li>Inscription gratuite, sans abonnement ni commission</li>
        <li>Annonces illimitées</li>
        <li>Suivi des vues, des contacts et des visites</li></ul>
      <a class="btn gold" href="#/register?role=owner">Publier un bien</a>
    </div>
    <div class="card" id="agences">
      <h2>Vous êtes une agence</h2>
      <p class="muted">Gérez vos agents, vos mandats et vos clients au même endroit, sans abonnement ni limite de portefeuille.</p>
      <ul class="small muted" style="line-height:2;padding-left:18px">
        <li>Biens et agents illimités</li>
        <li>Mandats, relevés de gestion et commissions</li>
        <li>Facturation, loyers et maintenance inclus</li></ul>
      <a class="btn" style="margin-top:14px" href="#/register?role=agency">Créer un compte agence</a>
    </div>
  </div></section>

  <section class="section"><div class="wrap stat-band">
    ${[[DB.getData(DB.K.properties).length, 'biens référencés'], [DB.getData(DB.K.users).length, 'comptes actifs'],
       [Object.values(LOCATIONS).reduce((s, c) => s + Object.keys(c).length, 0), 'villes couvertes'],
       [DB.getData(DB.K.visits).length, 'visites organisées']]
      .map(([n, l]) => `<div><div class="n">${n}</div><div class="muted small">${l}</div></div>`).join('')}
  </div></section>

  <section class="section"><div class="wrap">
    <p class="kicker">Ils utilisent DEUKSIL</p><h2>Ce qu'en disent propriétaires et locataires</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:26px">
      ${[['Aïcha Diouf','Locataire à Sacré-Cœur','J\'ai trouvé mon appartement en trois jours. Je voyais tout de suite si le bien était encore disponible, ça m\'a évité des visites pour rien.'],
         ['Mamadou Fall','Propriétaire, Almadies','Depuis que je publie sur DEUKSIL, je reçois des demandes de personnes déjà identifiées. Je perds moins de temps qu\'avec les annonces sur les groupes WhatsApp.'],
         ['Cheikh Gueye','Teranga Immobilier, agence','La gestion de nos agents et de nos mandats est enfin centralisée. Nos clients voient l\'état réel de chaque bien, ça évite les malentendus.']]
        .map(([n, role, quote]) => `<div class="card">
          <p style="font-family:var(--display);font-size:1.05rem;font-weight:500;line-height:1.5">"${quote}"</p>
          <div class="row" style="margin-top:16px"><div class="avatar" style="background:${avatarColor(n)}">${n.split(' ').map(x => x[0]).join('')}</div>
          <div><b class="small">${n}</b><div class="small muted">${role}</div></div></div></div>`).join('')}
    </div>
  </div></section>

  <section class="section faq" id="faq"><div class="wrap" style="max-width:760px">
    <p class="kicker">Questions fréquentes</p><h2>Ce qu'on nous demande le plus</h2>
    ${[["DEUKSIL est-il payant ?", "Non : l'inscription et l'utilisation sont gratuites, sans abonnement. Chaque profil reste rattaché à un numéro de CNI, ce qui limite les faux comptes."],
       ["Les annonces sont-elles à jour ?", "Chaque propriétaire met à jour le statut de son bien : disponible, en discussion, loué ou vendu. Une annonce louée disparaît des résultats de recherche."],
       ["Comment se passe une visite ?", "Vous proposez une date et une heure depuis la fiche du bien. Le propriétaire accepte, refuse ou reporte, et vous recevez une notification."],
       ["DEUKSIL prend-il une commission sur les loyers ?", "Non. Aucune commission n'est prélevée sur vos loyers ni sur vos ventes."]]
      .map(([q, a]) => `<details><summary>${q}</summary><p class="muted" style="margin:10px 0 0">${a}</p></details>`).join('')}
  </div></section>

  <footer class="site"><div class="wrap">
    <div class="row-between" style="align-items:flex-start;gap:30px">
      <div style="max-width:320px"><a class="logo" href="#/" style="color:#fff"><img src="${LOGO_LIGHT}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
        <p class="small" style="opacity:.7;margin-top:10px">Plateforme immobilière sénégalaise.</p></div>
      <div class="stack"><b class="small">Plateforme</b><a href="#/search">Rechercher</a><a href="#/register">Créer un compte</a><a href="#/login">Se connecter</a></div>
      <div class="stack"><b class="small">Légal</b><a href="#/legal/mentions">Mentions légales</a><a href="#/legal/cgu">Conditions d'utilisation</a><a href="#/legal/confidentialite">Confidentialité</a></div>
    </div>
    <p class="small" style="opacity:.55;margin-top:32px">© ${new Date().getFullYear()} DEUKSIL</p>
  </div></footer>`);
});

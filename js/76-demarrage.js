/* ==========================================================================
   Démarrage
   ========================================================================== */
function bootSkeletonHtml() {
  return `<div class="nav"><div class="wrap nav-in">
      <div class="skeleton" style="height:30px;width:150px;border-radius:8px"></div>
      <div class="row" style="gap:10px"><div class="skeleton" style="height:34px;width:90px;border-radius:999px"></div>
        <div class="skeleton" style="height:34px;width:120px;border-radius:999px"></div></div>
    </div></div>
    <div class="wrap" style="padding-top:64px">
      <div class="skeleton" style="height:44px;width:60%;border-radius:10px;margin-bottom:14px"></div>
      <div class="skeleton" style="height:44px;width:38%;border-radius:10px;margin-bottom:26px"></div>
      <div class="skeleton" style="height:72px;width:100%;max-width:640px;border-radius:18px;margin-bottom:40px"></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;padding-bottom:60px">
        ${[1, 2, 3].map(() => `<div class="skeleton" style="height:300px;border-radius:16px"></div>`).join('')}
      </div>
    </div>`;
}
$('#app').innerHTML = bootSkeletonHtml();
/* Thème unique, clair : on efface une ancienne préférence « sombre ». */
document.documentElement.dataset.theme = 'light';
try { localStorage.removeItem('deuksil_theme_pref'); } catch (e) {}
/* Si l'hôte (navigateur, application) pose data-theme="dark" sur la page, on
   le remet en clair : l'application n'a qu'un thème. */
new MutationObserver(() => {
  if (document.documentElement.dataset.theme !== 'light') document.documentElement.dataset.theme = 'light';
}).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
/* Démarrage : session Supabase, puis lecture des données autorisées, puis premier affichage. */
function ecranIndisponible(titre, texte) {
  $('#app').innerHTML = `<section class="wrap" style="max-width:560px;padding:80px 0;text-align:center">
    <h1 style="font-size:1.6rem">${esc(titre)}</h1><p class="muted">${esc(texte)}</p>
    <button class="btn" data-recharger>Réessayer</button></section>`;
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-recharger]')) location.reload(); });
async function demarrer() {
  if (!SB) return ecranIndisponible('Configuration incomplète', 'L\'adresse du serveur et la clé publique Supabase ne sont pas renseignées (js/00-config.js).');
  try {
    const manquantes = await DB.charger();
    if (manquantes.includes('properties')) throw new Error('lecture impossible');
  } catch (e) {
    console.error('[DEUKSIL] démarrage', e);
    return ecranIndisponible('Service momentanément indisponible', 'Impossible de joindre le serveur DEUKSIL. Vérifiez votre connexion internet, puis réessayez.');
  }
  /* Les modules sont des <script> successifs : la lecture réseau peut aboutir avant
     que les derniers soient exécutés. Le premier affichage attend qu'ils le soient
     tous (sinon la page s'affiche sans les compléments des modules suivants). */
  if (document.readyState === 'loading') await new Promise(ok => document.addEventListener('DOMContentLoaded', ok, {once: true}));
  DB.pret = true;
  if (!location.hash) location.hash = '#/';
  render();
  /* Session changée ailleurs (autre onglet, retour de Google, lien de récupération). */
  let derniere = DB.session ? DB.session.user.id : null;
  /* Le rappel ne doit jamais attendre un autre appel Supabase Auth : supabase-js
     tient un verrou pendant qu'il s'exécute (blocage de signOut / getSession).
     Le travail est donc reporté juste après (setTimeout). */
  SB.auth.onAuthStateChange((evt, session) => {
    DB.session = session;
    if (evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED') return;
    if (evt === 'PASSWORD_RECOVERY') { setTimeout(() => go('#/reinitialiser-mot-de-passe'), 0); return; }
    const id = session ? session.user.id : null;
    if (id === derniere) return;
    derniere = id;
    setTimeout(async () => { if (Auth.enCours) return; await DB.charger(); render(); }, 0);
  });
  /* Données à jour : au retour sur l'onglet (au plus toutes les 30 s) et toutes les 60 s pour les messages. */
  const rafraichir = async (tables) => {
    if (document.visibilityState !== 'visible' || !DB.session || document.querySelector('.modal')) return;
    const a = document.activeElement; if (a && a.matches && a.matches('input, textarea, select')) return;
    await DB.attendre();
    await Promise.all(tables.map(k => DB.relire(DB.K[k])));
    render();
  };
  document.addEventListener('visibilitychange', () => { if (Date.now() - (DB.chargeLe || 0) > 30000) { DB.chargeLe = Date.now(); rafraichir(Object.keys(TABLE_DE).filter(k => k !== 'users')); } });
  setInterval(() => rafraichir(['notifications', 'messages', 'tmsgs', 'visits']), 60000);
}
demarrer();
initAi();

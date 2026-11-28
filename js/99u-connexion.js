/* ==========================================================================
   99u-connexion.js — Retour de connexion (Google, lien reçu par e-mail)
   Bug (28/11) : après « Continuer avec Google », la page se rechargeait et l'on
   restait déconnecté, ou l'on arrivait sur l'accueil public sans aller plus loin.
   1. Le retour se faisait sur l'adresse fixe du site (deuksil.com) alors que la
      connexion avait commencé ailleurs (www.deuksil.com, ancienne adresse) : le
      code de sécurité gardé par le navigateur ne correspondait plus et la session
      ne s'ouvrait pas. Le retour se fait maintenant sur la page même
      (js/47-google.js, adresseDeRetour).
   2. Au retour, la personne est conduite où elle doit aller : « Compléter mon
      profil » pour un nouveau compte (téléphone, type de compte, mot de passe…),
      sinon son espace. Si la connexion a échoué, elle voit pourquoi au lieu
      d'une page qui se recharge sans rien dire.
   ========================================================================== */
/* Un numéro de téléphone = un compte : vérifié avant d'envoyer l'inscription
   (la base refuse de toute façon un doublon ; ici le message est clair). */
if (typeof startRegistration === 'function') {
  const _inscrire = startRegistration;
  startRegistration = async function (data) {
    try {
      const {data: libre, error} = await SB.rpc('telephone_libre', {tel: String((data && data.phone) || '')});
      if (!error && libre === false) return {error: 'Ce numéro de téléphone est déjà utilisé par un autre compte DEUKSIL. Utilisez un autre numéro, ou connectez-vous au compte existant (« Mot de passe oublié » si besoin).'};
    } catch (e) { /* vérification indisponible : la base tranchera */ }
    return _inscrire(data);
  };
}
(() => {
  const MESSAGES = [
    [/Database error saving new user|duplicate|already/i, 'Impossible de créer le compte : cette adresse e-mail, ce numéro de téléphone ou ce numéro de CNI est déjà utilisé par un autre compte. Connectez-vous à ce compte (« Mot de passe oublié » si besoin).'],
    [/code verifier|invalid flow state|flow_state|both auth code and code verifier/i, 'La connexion a été commencée sur une autre adresse du site ou un autre navigateur. Recommencez « Continuer avec Google » depuis cette page.'],
    [/expired|invalid/i, 'Le lien de connexion a expiré ou a déjà servi. Recommencez la connexion.'],
    [/access_denied|cancel/i, 'Connexion Google annulée.']
  ];
  const clair = m => { const t = (MESSAGES.find(([re]) => re.test(m || '')) || [])[1]; return t || ('La connexion n\'a pas abouti' + (m ? ' : ' + m : '.')); };

  /* Ce que l'adresse contient au chargement (supabase-js la nettoie ensuite). */
  const R = window.__retourAuth || {search: location.search, hash: location.hash};
  const q = new URLSearchParams(R.search);
  const h = new URLSearchParams((R.hash.match(/[#&](error[^#]*)$/) || [])[1] || '');
  const erreur = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error') || '';
  const avecCode = q.has('code');
  /* Lien « mot de passe oublié » : supabase-js signale la récupération (PASSWORD_RECOVERY)
     pendant son démarrage, avant que le site n'écoute ; on la repère donc ici, tôt. */
  if (avecCode && (R.recuperation || /^#\/reinitialiser-mot-de-passe/.test(R.hash))) window.__recuperationMdp = true;
  let depuisGoogle = false;
  try { depuisGoogle = !!sessionStorage.getItem('deuksil_retour_google'); sessionStorage.removeItem('deuksil_retour_google'); } catch (e) {}
  if (!erreur && !avecCode && !depuisGoogle) return;

  const nettoyer = () => {
    try {
      const u = new URL(location.href);
      ['code', 'error', 'error_code', 'error_description', 'state'].forEach(k => u.searchParams.delete(k));
      let hash = u.hash.replace(/[#&]error[^#]*$/, '');
      if (!hash || hash === '#') hash = '#/';
      history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + hash);
    } catch (e) {}
  };
  const suite = () => {
    nettoyer();
    const u = Auth.current();
    if (u && window.__recuperationMdp) { go('#/reinitialiser-mot-de-passe'); render(); return; }
    if (u) {
      const aCompleter = typeof profilACompleter === 'function' && profilACompleter(u);
      if (aCompleter) { go('#/completer-profil'); toast('Bienvenue sur DEUKSIL : complétez votre profil pour continuer.'); return; }
      const ici = location.hash.replace(/\?.*$/, '');
      if (!ici || ici === '#/' || ici === '#/login' || ici === '#/register') go(Auth.home(u));
      return;
    }
    if (erreur || depuisGoogle || avecCode) {
      try { sessionStorage.setItem('deuksil_login_motif', clair(erreur)); } catch (e) {}
      go('#/login'); toast(clair(erreur), 'bad');
    }
  };
  /* Attendre le premier affichage (session lue, données chargées). */
  const t0 = Date.now();
  (function attendre() {
    if (typeof DB !== 'undefined' && DB.pret) return setTimeout(suite, 50);
    if (Date.now() - t0 > 20000) return;
    setTimeout(attendre, 100);
  })();
})();

/* ==========================================================================
   Après « Publier » : on arrive sur l'annonce publiée (vue des visiteurs),
   avec un bandeau « Votre annonce est en ligne » : Gérer ce bien · Partager.
   ========================================================================== */
(() => {
  const css = document.createElement('style');
  css.textContent = `.pub-ok{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#E9F7EF;border:1px solid #B7E1C7;color:#14532D;border-radius:14px;padding:12px 16px;margin:14px 0}
.pub-ok .pub-ok-t{flex:1 1 260px;min-width:0;font-weight:600}.pub-ok .pub-ok-t span{display:block;font-weight:400;font-size:.88rem;color:#256B42}
.pub-ok .btn{white-space:nowrap}`;
  document.head.appendChild(css);
  const avant = afterRender;
  afterRender = function () {
    const r = avant.apply(this, arguments);
    try {
      const pid = window.__vientDePublier;
      if (!pid) return r;
      const ici = typeof idBienDeLaPage === 'function' ? idBienDeLaPage() : null;
      if (ici !== pid) { if (!/^#\/(annonce|property)\//.test(location.hash)) window.__vientDePublier = null; return r; }
      const app = document.querySelector('#app'); if (!app || app.querySelector('.pub-ok')) return r;
      const contenu = app.querySelector('.main .content'); if (!contenu) return r;
      const bien = DB.findItem(DB.K.properties, pid), enLigne = !bien || bien.listingStatus === 'publiee';
      const retour = contenu.querySelector(':scope > .gback');
      (retour || contenu).insertAdjacentHTML(retour ? 'afterend' : 'afterbegin', `<div class="pub-ok" role="status">${icon('check', 20)}
        <div class="pub-ok-t">${enLigne ? 'Votre annonce est en ligne' : 'Votre annonce est envoyée pour validation'}<span>${enLigne ? 'Voici ce que voient les visiteurs.' : 'Voici ce que verront les visiteurs dès qu\'elle sera validée.'}</span></div>
        <button type="button" class="btn sm ghost" data-fb-partager="${esc(pid)}">${icon('share' in ICONS ? 'share' : 'arrowRight', 15)} Partager</button>
        <a class="btn sm" href="#/bien/${esc(pid)}">Gérer ce bien</a></div>`);
    } catch (e) {}
    return r;
  };
})();

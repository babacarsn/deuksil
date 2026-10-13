/* ==========================================================================
   MODULE : espace.js — revenir à son espace depuis le site public.
   Un utilisateur connecté qui passe par l'accueil retrouve « Mon espace »
   dans l'en-tête (aussi sur téléphone) et en tête du menu hamburger (38-ds3).
   Les pages « Se connecter » et « Créer un compte » le renvoient directement
   à son espace : il est déjà connecté (pour changer de compte, il se
   déconnecte d'abord).
   ========================================================================== */
routes.forEach(r => {
  if (!/^\^\\\/(login|register)/.test(r.re.source)) return;
  const f = r.fn;
  r.fn = (...a) => {
    const u = Auth.current();
    if (u) { go(Auth.home(u)); return false; }
    return f(...a);
  };
});

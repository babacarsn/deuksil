/* ==========================================================================
   00-config.js — RÉGLAGES DU DÉPLOIEMENT (le seul fichier à modifier).
   Chargé en tout premier. Tant qu'un réglage est vide, la fonction
   correspondante reste en mode local : les formulaires s'affichent et se
   remplissent normalement, mais ce qui exige un serveur (envoi d'un code par
   e-mail ou SMS, connexion Google) l'indique à l'utilisateur au lieu de
   faire semblant.
   ========================================================================== */
const DEUKSIL_CONFIG = {
  /* Adresse du serveur (API), sans « / » final. Ex. 'https://api.deuksil.sn'.
     Vide : comptes enregistrés dans le navigateur, aucun envoi de code. */
  apiBase: '',

  /* Identifiant client OAuth 2.0 de Google (console Google Cloud →
     Identifiants → « ID client OAuth », type Application Web).
     Ex. '1234567890-abcdefg.apps.googleusercontent.com'.
     Vide : le bouton « Continuer avec Google » annonce que ce mode de
     connexion n'est pas encore activé. */
  googleClientId: '',

  /* Routes de l'API appelées par les formulaires (POST, corps JSON).
     Réponse attendue : 2xx en cas de succès, sinon {message: '…'}. */
  routes: {
    inscription:        '/auth/register',          // {role, firstName, lastName, email, phone, cni, password, agencyName?, address?, ninea?, rccm?}
    motDePasseOublie:   '/auth/password/forgot',   // {identifiant}
    reinitialisation:   '/auth/password/reset',    // {identifiant, code, password}
    verifierEmail:      '/auth/email/verify',      // {email, code}
    renvoyerCode:       '/auth/email/resend',      // {email}
    google:             '/auth/google',            // {credential}  → {user: {email, firstName, lastName}}
    contact:            '/contact'                 // {name, email, phone, subject, message}
  }
};

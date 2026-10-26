/* ==========================================================================
   00-config.js — RÉGLAGES PUBLICS DU DÉPLOIEMENT (seul fichier à modifier).
   Chargé en premier. Ne contient QUE des valeurs publiques : la clé « anon /
   publishable » de Supabase est faite pour être visible dans le navigateur ;
   ce sont les politiques RLS de la base qui protègent les données.
   NE JAMAIS mettre ici la clé service_role (ni aucun autre secret).
   Valeurs : Supabase → Project Settings → API (voir README_SUPABASE.md §3).
   ========================================================================== */
const DEUKSIL_CONFIG = {
  supabaseUrl: 'https://fqrmulupzaqmvjoybela.supabase.co',          // ex. 'https://abcdefghijklmno.supabase.co'
  supabaseAnonKey: 'sb_publishable_wxCyWMCe_w50pBtSkb6CDQ_UayTczfE',      // clé « anon » (ou « publishable ») du projet
  /* Connexion Google : true une fois le fournisseur Google activé dans
     Supabase (Authentication → Providers → Google). */
  googleActif: true,
  /* Adresse publique du site (redirections après connexion Google ou lien e-mail). */
  siteUrl: 'https://deuksil.vercel.app',   // adresse publique du site (retours de connexion Google et liens e-mail)
  /* Éditeur du site (mentions légales, politique de confidentialité).
     Un champ vide s'affiche « à compléter » : à renseigner avant l'ouverture. */
  editeur: {
    raisonSociale: '', formeJuridique: '', adresse: '', ninea: '', rccm: '',
    directeurPublication: '', email: '', hebergeurSite: '',
    regionDonnees: ''          // région du projet Supabase, ex. 'eu-west-3 (Paris)'
  }
};

/* ==========================================================================
   MODULE : auth.js — session Supabase Auth + protection des routes
   La session (jeton JWT) est tenue par supabase-js ; le rôle vient TOUJOURS de
   la table profiles (jamais du navigateur). Les droits réels sont appliqués
   par la base (RLS) : les gardes ci-dessous ne servent qu'à la navigation.
   ========================================================================== */
function resetSessionUiState() {
  compareIds = []; ownerBulkSelected = []; bulkSelected = [];
  formPhotos = []; formPhotosFor = null;
  openThread = null; mobileThreadOpen = false;
  aiChatHistory = []; aiChatBusy = false;
  searchState = {transaction:'', region:'', city:'', quartier:'', type:'', min:'', max:'', rooms:'', baths:'', surface:'', furnished:false, parking:false, sort:'recent', page:1};
}
const MESSAGES_AUTH = {
  'Invalid login credentials': 'Adresse e-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Adresse e-mail non confirmée : saisissez le code reçu par e-mail.',
  'User already registered': 'Un compte existe déjà avec cette adresse e-mail.',
  'Token has expired or is invalid': 'Code invalide ou expiré. Demandez un nouveau code.',
  'New password should be different from the old password.': 'Choisissez un mot de passe différent de l\'actuel.',
  'Password should be at least 8 characters.': 'Mot de passe : 8 caractères minimum.'
};
const messageAuth = e => {
  if (!e) return '';
  if (MESSAGES_AUTH[e.message]) return MESSAGES_AUTH[e.message];
  if (/rate limit|too many/i.test(e.message || '')) return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
  if (/Database error saving new user/i.test(e.message || '')) return 'Impossible de créer le compte : cette adresse e-mail ou ce numéro de CNI est déjà utilisé.';
  if (/Failed to fetch|NetworkError/i.test(e.message || '')) return 'Connexion au serveur impossible. Vérifiez votre connexion.';
  return e.message || 'Erreur d\'authentification.';
};
const Auth = {
  current() {
    const id = DB.session && DB.session.user ? DB.session.user.id : null;
    return id ? DB.findItem(DB.K.users, id) : null;
  },
  /* Connexion par adresse e-mail et mot de passe. Renvoie {user} ou {error}. */
  async login(email, password) {
    this.enCours = true;   // le chargement est fait ici, pas une seconde fois par onAuthStateChange
    try {
      const {data, error} = await SB.auth.signInWithPassword({email: String(email || '').trim().toLowerCase(), password});
      if (error) return {error: messageAuth(error)};
      DB.session = data.session;
      try { resetSessionUiState(); } catch (e) {}
      await DB.charger();
    } finally { this.enCours = false; }
    const u = this.current();
    if (!u) { await SB.auth.signOut(); DB.session = null; return {error: 'Profil introuvable pour ce compte. Contactez l\'assistance.'}; }
    if (u.status === 'suspendu') { await this.logout(true); return {error: 'Compte suspendu. Contactez le support DEUKSIL.'}; }
    return {user: u};
  },
  async logout(silencieux) {
    try { closeModal(); } catch (e) {}
    try { resetSessionUiState(); } catch (e) {}
    await DB.attendre();
    this.enCours = true;
    try {
      await SB.auth.signOut();
      DB.session = null;
      await DB.charger();
    } finally { this.enCours = false; }
    if (!silencieux) { go('#/login'); toast('Vous êtes déconnecté.'); }
  },
  home(u) { return {client:'#/client/dashboard', owner:'#/owner/dashboard', agency:'#/agency/dashboard', admin:'#/admin/dashboard'}[u.role]; },
  guard(role) {
    const u = this.current();
    if (!u) { toast('Connectez-vous pour accéder à cet espace.', 'bad'); go('#/login'); return null; }
    if (u.role !== role) { toast("Cet espace n'est pas accessible avec votre rôle.", 'bad'); go(this.home(u)); return null; }
    return u;
  }
};

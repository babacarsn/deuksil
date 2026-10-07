/* ==========================================================================
   MODULE : auth.js — session + protection des routes (simulation)
   ========================================================================== */
function resetSessionUiState() {
  compareIds = []; ownerBulkSelected = []; bulkSelected = [];
  formPhotos = []; formPhotosFor = null;
  openThread = null; mobileThreadOpen = false;
  aiChatHistory = []; aiChatBusy = false;
  searchState = {transaction:'', region:'', city:'', quartier:'', type:'', min:'', max:'', rooms:'', baths:'', surface:'', furnished:false, parking:false, sort:'recent', page:1};
}
const Auth = {
  current() { try { const id = JSON.parse(localStorage.getItem(DB.K.session)); return id ? DB.findItem(DB.K.users, id.id) : null; } catch { return null; } },
  login(cni, password) {
    const v = String(cni).trim().toLowerCase();
    const u = DB.findItem(DB.K.users, x => x.cni === v || String(x.email || '').toLowerCase() === v);
    if (!u) return {error: "Aucun compte n'est associé à cette adresse."};
    if (u.password !== password) return {error: 'Mot de passe incorrect.'};
    if (u.status === 'suspendu') return {error: 'Compte suspendu. Contactez le support DEUKSIL.'};
    resetSessionUiState();
    localStorage.setItem(DB.K.session, JSON.stringify({id: u.id, at: now()}));
    return {user: u};
  },
  logout() { closeModal(); resetSessionUiState(); localStorage.removeItem(DB.K.session); go('#/login'); toast('Vous êtes déconnecté.'); },
  home(u) { return {client:'#/client/dashboard', owner:'#/owner/dashboard', agency:'#/agency/dashboard', admin:'#/admin/dashboard'}[u.role]; },
  guard(role) {
    const u = this.current();
    if (!u) { toast('Connectez-vous pour accéder à cet espace.', 'bad'); go('#/login'); return null; }
    if (u.role !== role) { toast("Cet espace n'est pas accessible avec votre rôle.", 'bad'); go(this.home(u)); return null; }
    return u;
  }
};

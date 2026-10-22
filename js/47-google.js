/* ==========================================================================
   MODULE : google.js — « Continuer avec Google » (Google Identity Services).
   Activé par DEUKSIL_CONFIG.googleClientId (js/00-config.js).
   - Sans identifiant client : le bouton explique que ce mode de connexion
     n'est pas encore activé et propose l'adresse e-mail.
   - Avec identifiant client : la fenêtre officielle de Google s'ouvre ; le
     jeton reçu (JWT signé par Google) est envoyé au serveur
     (DEUKSIL_CONFIG.apiBase + routes.google), qui DOIT vérifier la signature
     et l'audience avant d'ouvrir une session. Sans serveur, le jeton est lu
     dans le navigateur (audience et date contrôlées, signature non vérifiée) :
     acceptable pour des essais, pas pour la production.
   - Adresse inconnue : la page d'inscription s'ouvre, pré-remplie.
   ========================================================================== */
const gmailOf = u => u.email || `${(u.firstName || 'user').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${(u.lastName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '')}@gmail.com`.replace(/\.@/, '@');
/* chaque compte de démonstration reçoit une adresse Gmail stable */
function seedEmails() {
  DB.getData(DB.K.users).filter(u => !u.email).forEach(u => DB.updateItem(DB.K.users, u.id, {email: gmailOf(u)}));
}
etapeAmorcage('adresses Gmail', seedEmails);
setTimeout(seedEmails, 900);

const gLogo = (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-4H24v7.3h12.1c-.2 1.9-1.6 4.9-4.5 6.9l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.6"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3 0-6.7 5.2-.1.3C7.9 41 15.4 46 24 46"/><path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l0-.3-6.8-5.3-.2.1C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 9.9l7-5.5"/><path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 7.9 6 4.5 13.2l7 5.4C13.3 13.3 18.2 9.5 24 9.5"/></svg>`;

document.head.insertAdjacentHTML('beforeend', '<style>'
  + '.g-btn{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;min-height:52px;border-radius:14px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font:600 .95rem var(--font);cursor:pointer;transition:background .18s,border-color .18s,transform .12s}'
  + '.g-btn:hover{background:var(--surface-2);border-color:var(--brand)} .g-btn:active{transform:scale(.985)}'
  + '.g-one{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font:inherit;color:var(--ink);margin-bottom:12px;transition:border-color .18s,background .18s,transform .12s;box-shadow:var(--sh-2)}'
  + '.g-one:hover{border-color:var(--brand);background:var(--surface-2)} .g-one:active{transform:scale(.99)}'
  + '.g-one .txt{min-width:0;flex:1} .g-one b{display:block;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-one .sub{font-size:.78rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:.85rem;flex:none}'
  + '.g-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:11px 12px;border:0;border-radius:12px;background:none;cursor:pointer;font:inherit;color:var(--ink);transition:background .16s}'
  + '.g-row:hover{background:var(--surface-2)}'
  + '.g-row .txt{min-width:0;flex:1}.g-row b{display:block;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-row .sub{display:block;font-size:.78rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-row svg{flex:none;color:var(--muted)}'
  + '.g-head{display:flex;align-items:center;gap:10px;margin-bottom:4px;font-weight:600}'
  + '.g-note{font-size:.76rem;color:var(--muted);line-height:1.5;margin:12px 0 0}'
  + '</style>');

/* Chargement unique du script officiel de Google. */
let gsiPret = null;
function chargerGoogle() {
  if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
  if (gsiPret) return gsiPret;
  gsiPret = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = () => ok(); s.onerror = () => { gsiPret = null; ko(new Error('chargement impossible')); };
    document.head.appendChild(s);
  });
  return gsiPret;
}
/* Lecture du contenu d'un jeton Google (sans vérifier sa signature). */
function lireJetonGoogle(jwt) {
  try {
    const b = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const txt = decodeURIComponent(atob(b + '==='.slice((b.length + 3) % 4)).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    return JSON.parse(txt);
  } catch (e) { return null; }
}
const CLE_PREREMPLI = 'deuksil_inscription_google';
function ouvrirSessionGoogle(profil) {
  const email = String(profil.email || '').trim().toLowerCase();
  if (!email) { toast('Google n\'a pas transmis d\'adresse e-mail.', 'bad'); return; }
  const u = DB.findItem(DB.K.users, x => String(x.email || '').toLowerCase() === email && !x.doublonDe);
  closeModal();
  if (!u) {
    try { sessionStorage.setItem(CLE_PREREMPLI, JSON.stringify({email, firstName: profil.given_name || profil.firstName || '', lastName: profil.family_name || profil.lastName || '', t: Date.now()})); } catch (e) {}
    toast('Aucun compte DEUKSIL avec cette adresse : complétez votre inscription.');
    go('#/register'); return;
  }
  if (u.status === 'suspendu') { toast('Ce compte est suspendu. Contactez le support DEUKSIL.', 'bad'); return; }
  try { resetSessionUiState(); } catch (e) {}
  if (!u.emailVerifie) DB.updateItem(DB.K.users, u.id, {emailVerifie: true, emailVerifieLe: now(), emailVerifiePar: 'google'});
  localStorage.setItem(DB.K.session, JSON.stringify({id: u.id, at: now()}));
  toast(`Bienvenue ${u.role === 'agency' && u.agencyName ? u.agencyName : u.firstName}.`);
  go(Auth.home(u));
}
async function recevoirJetonGoogle(rep) {
  const jeton = rep && rep.credential; if (!jeton) return;
  const C = DEUKSIL_CONFIG;
  if (C.apiBase) {
    try { const r = await Serveur.envoyer('google', {credential: jeton}); return ouvrirSessionGoogle((r && r.user) || {}); }
    catch (e) { toast(e.message || 'Connexion Google refusée par le serveur.', 'bad'); return; }
  }
  const p = lireJetonGoogle(jeton);
  if (!p || p.aud !== C.googleClientId || !/accounts\.google\.com$/.test(p.iss || '') || (p.exp || 0) * 1000 < Date.now()) { toast('Réponse de Google invalide ou expirée. Réessayez.', 'bad'); return; }
  if (p.email_verified === false) { toast('Adresse Google non vérifiée : utilisez votre adresse e-mail et votre mot de passe.', 'bad'); return; }
  ouvrirSessionGoogle(p);
}
function connexionGoogle() {
  const id = (DEUKSIL_CONFIG.googleClientId || '').trim();
  if (!id) {
    modal('Continuer avec Google', `<div class="g-head">${gLogo(20)} <span>Connexion avec Google</span></div>
      <p class="small" style="margin:8px 0 0">La connexion avec un compte Google n'est pas encore activée sur DEUKSIL.</p>
      <p class="small muted">En attendant, connectez-vous avec votre adresse e-mail et votre mot de passe, ou créez un compte.</p>
      <div class="row" style="gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-action="close-modal">Utiliser mon e-mail</button><a class="btn ghost" href="#/register" data-action="close-modal">Créer un compte</a></div>`);
    return;
  }
  modal('Continuer avec Google', `<div class="g-head">${gLogo(20)} <span>Connexion avec Google</span></div>
    <p class="small muted" style="margin:6px 0 14px">Choisissez votre compte Google dans la fenêtre sécurisée de Google.</p>
    <div id="g-bouton" style="min-height:44px;display:flex;justify-content:center"><div class="spinner" style="margin:6px auto"></div></div>
    <p class="g-note">DEUKSIL reçoit uniquement votre nom et votre adresse e-mail. Votre mot de passe Google n'est jamais transmis.</p>`);
  chargerGoogle().then(() => {
    google.accounts.id.initialize({client_id: id, callback: recevoirJetonGoogle, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true, context: 'signin'});
    const z = document.getElementById('g-bouton'); if (!z) return; z.innerHTML = '';
    google.accounts.id.renderButton(z, {type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'left', locale: 'fr', width: Math.min(320, z.clientWidth || 320)});
  }).catch(() => {
    const z = document.getElementById('g-bouton');
    if (z) z.innerHTML = '<p class="small" style="color:var(--bad);margin:0">Le service de Google ne répond pas. Vérifiez votre connexion et réessayez.</p>';
  });
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-action="g-choose"]')) { e.preventDefault(); connexionGoogle(); }
});

/* ==========================================================================
   MODULE : google.js — « Continuer avec Google » (Supabase Auth, OAuth).
   Activé par DEUKSIL_CONFIG.googleActif une fois le fournisseur Google
   configuré dans Supabase (Authentication → Providers → Google ; voir
   README_SUPABASE.md). Google renvoie vers le site ; supabase-js échange
   le code (PKCE) contre une session : aucun jeton n'est lu à la main.
   Un compte créé par Google est un compte client sans téléphone ni CNI :
   la page « Compléter mon profil » demande ce qui manque (type de compte,
   téléphone, CNI, conditions d'utilisation) avant d'aller plus loin.
   ========================================================================== */
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

async function connexionGoogle() {
  if (!DEUKSIL_CONFIG.googleActif) {
    modal('Continuer avec Google', `<div class="g-head">${gLogo(20)} <span>Connexion avec Google</span></div>
      <p class="small" style="margin:8px 0 0">La connexion avec un compte Google n'est pas encore activée sur DEUKSIL.</p>
      <p class="small muted">En attendant, connectez-vous avec votre adresse e-mail et votre mot de passe, ou créez un compte.</p>
      <div class="row" style="gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-action="close-modal">Utiliser mon e-mail</button><a class="btn ghost" href="#/register" data-action="close-modal">Créer un compte</a></div>`);
    return;
  }
  const retour = (DEUKSIL_CONFIG.siteUrl || location.origin + location.pathname).replace(/#.*$/, '');
  const {error} = await SB.auth.signInWithOAuth({provider: 'google', options: {redirectTo: retour, queryParams: {prompt: 'select_account'}}});
  if (error) toast(messageAuth(error), 'bad');   // sinon le navigateur part chez Google
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-action="g-choose"]')) { e.preventDefault(); connexionGoogle(); }
});

/* --- Compléter son profil (compte créé par Google) ---------------------------- */
const viaGoogle = () => { const m = (DB.session && DB.session.user && DB.session.user.app_metadata) || {}; return (m.providers || [m.provider]).includes('google'); };
const profilACompleter = u => !!u && !u.member && !u.parentId && !u.ownerRef && !u.mandantOf && ['client', 'owner', 'agency'].includes(u.role) && !u.cguAccepteesLe && viaGoogle();
route(/^\/completer-profil$/, () => {
  const u = Auth.current();
  if (!u) { go('#/login'); return false; }
  if (!profilACompleter(u)) { go(Auth.home(u)); return false; }
  const req = '<span class="req" title="Champ obligatoire">*</span>';
  return shellPublic(`<section class="wrap" style="max-width:640px;padding:34px 0 60px">
    <form class="card" data-action="completer-profil" novalidate>
      <h1 style="font-size:1.5rem;margin:0 0 6px">Bienvenue ${esc(u.firstName || '')}</h1>
      <p class="small muted" style="margin:0 0 16px">Votre compte Google est relié à DEUKSIL (${esc(u.email || '')}). Il reste quelques informations à compléter.</p>
      <p class="wiz-q">Quel type de compte souhaitez-vous ?</p>
      <div class="opts">${[['client', 'user', 'Client', 'Recherche, favoris, contact et visites'], ['owner', 'home', 'Propriétaire', 'Publication de biens et gestion locative'], ['agency', 'building', 'Agence', 'Portefeuille, agents et mandats']]
        .map(([k, ic, l, d]) => `<label class="opt"><input type="radio" name="role" value="${k}" ${k === u.role ? 'checked' : ''}><span class="oic">${icon(ic, 22)}</span><span>${l}<small>${d}</small></span></label>`).join('')}</div>
      <div id="cp-agence" class="${u.role === 'agency' ? '' : 'hidden'}">
        <div class="field"><label for="cp-agname">Nom de l'agence ${req}</label><input class="input" id="cp-agname" name="agencyName" value="${esc(u.agencyName || '')}" autocomplete="organization"></div>
        <div class="field"><label for="cp-adresse">Adresse de l'agence ${req}</label><input class="input" id="cp-adresse" name="address" value="${esc(u.address || '')}" autocomplete="street-address"></div></div>
      <div class="form-grid">
        <div class="field"><label for="cp-tel">Téléphone ${req}</label><input class="input" id="cp-tel" name="phone" type="tel" inputmode="tel" placeholder="77 123 45 67" value="${esc(u.phone || '')}" autocomplete="tel" required></div>
        <div class="field"><label for="cp-cni">Numéro de CNI (facultatif)</label><input class="input" id="cp-cni" name="cni" inputmode="numeric" maxlength="13" placeholder="13 chiffres" value="${esc(u.cni || '')}" ${u.cni ? 'readonly' : ''}></div></div>
      <div class="field"><label class="check" style="align-items:flex-start;font-weight:500"><input type="checkbox" name="cgu" value="oui" required style="margin-top:2px">
        <span>J'accepte les <a href="#/legal/cgu" target="_blank">conditions d'utilisation</a> et la <a href="#/legal/confidentialite" target="_blank">politique de confidentialité</a> de DEUKSIL. ${req}</span></label></div>
      <div class="f-zone-err"></div>
      <button class="btn block">Enregistrer et continuer</button>
      <p class="small" style="margin:14px 0 0;text-align:center"><a href="#/" data-action="logout">Se déconnecter</a></p>
    </form></section>`);
});
document.addEventListener('change', e => {
  if (e.target.name === 'role' && e.target.closest('form[data-action="completer-profil"]')) $('#cp-agence').classList.toggle('hidden', e.target.value !== 'agency');
});
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="completer-profil"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!profilACompleter(u)) return;
  const d = formData(f), t = k => String(d[k] || '').trim();
  if (!['client', 'owner', 'agency'].includes(d.role)) return erreurIci(f, 'role', 'Choisissez le type de compte.');
  if (d.role === 'agency' && t('agencyName').length < 2) return erreurIci(f, 'agencyName', 'Indiquez le nom de l\'agence.');
  if (d.role === 'agency' && t('address').length < 3) return erreurIci(f, 'address', 'Indiquez l\'adresse de l\'agence.');
  if (!telSenegal(d.phone)) return erreurIci(f, 'phone', 'Numéro de téléphone invalide : 9 chiffres, par exemple 77 123 45 67.');
  const cniSaisie = t('cni').replace(/\s/g, '');
  if (cniSaisie && !/^\d{13}$/.test(cniSaisie)) return erreurIci(f, 'cni', 'Le numéro de CNI comporte 13 chiffres (ou laissez le champ vide).');
  if (!d.cgu) return erreurIci(f, 'cgu', 'Acceptez les conditions d\'utilisation pour continuer.');
  const b = f.querySelector('button:not([type="button"])'); b.disabled = true;
  try {
    if (d.role !== u.role) { const {error} = await SB.rpc('changer_type_compte', {nouveau: d.role}); if (error) throw error; }
    const patch = {phone: t('phone'), cgu_acceptees_le: new Date().toISOString(), ...(u.cni || !cniSaisie ? {} : {cni: cniSaisie}),
      ...(d.role === 'agency' ? {agency_name: t('agencyName'), address: t('address')} : {})};
    const {error} = await SB.from('profiles').update(patch).eq('id', u.id); if (error) throw error;
  } catch (err) {
    b.disabled = false;
    return erreurIci(f, /cni/i.test(err.message || '') || err.code === '23505' ? 'cni' : '', err.code === '23505' ? 'Ce numéro de CNI est déjà utilisé par un autre compte.' : messageErreur(err));
  }
  await DB.relire(DB.K.users);
  toast('Profil complété. Bienvenue sur DEUKSIL.'); go(Auth.home(Auth.current()));
}, true);
/* Tant que le profil n'est pas complété, on y revient. */
addEventListener('hashchange', () => {
  try { const u = Auth.current(); if (profilACompleter(u) && !/^#\/(completer-profil|legal\/)/.test(location.hash)) go('#/completer-profil'); } catch (e) {}
});

/* ==========================================================================
   VUE : inscription (CNI) + paiement simulé
   ========================================================================== */
route(/^\/register/, () => {
  const preset = (location.hash.split('role=')[1] || 'client').replace(/[^a-z]/g, '');
  const r = ['client', 'owner', 'agency'].includes(preset) ? preset : 'client';
  return shellPublic(`
  <section class="section" style="border:0"><div class="wrap" style="max-width:640px">
    <h2>Créer mon compte DEUKSIL</h2>
    <p class="muted small">L'identification se fait par numéro de CNI. Utilisez un numéro fictif : cette version est une démonstration.</p>
    <form class="card" data-action="register" style="margin-top:18px">
      <div class="field"><label>Type de compte</label>
        <div class="choice">
          ${[['client','Client', 'Recherche, favoris et visites'],
             ['owner','Propriétaire', 'Publication de biens et gestion locative'],
             ['agency','Agence', 'Portefeuille, agents et mandats'],
             ['investor','Investisseur', 'Suivi de patrimoine et rentabilité'],
             ['promoter','Promoteur', 'Programmes immobiliers et lots']]
            .map(([v, l, d]) => `<label><input type="radio" name="role" value="${v}" ${v === r ? 'checked' : ''}><span><b>${l}</b><br><span class="small muted">${d}</span></span></label>`).join('')}
        </div></div>
      <div id="agency-fields" class="${r === 'agency' ? '' : 'hidden'}">
        <div class="field"><label>Nom de l'agence</label><input class="input" name="agencyName" placeholder="Teranga Immobilier"></div>
        <div class="field"><label>Adresse</label><input class="input" name="address" placeholder="Almadies, Dakar"></div>
      </div>
      <div class="field"><label>Numéro de CNI (13 chiffres)</label><input class="input" name="cni" inputmode="numeric" maxlength="13" placeholder="1900000000123" required></div>
      <div class="form-grid">
        <div class="field"><label>Prénom</label><input class="input" name="firstName" required></div>
        <div class="field"><label>Nom</label><input class="input" name="lastName" required></div>
      </div>
      <div class="field"><label>Téléphone</label><input class="input" name="phone" placeholder="+221 77 123 45 67" required></div>
      <div class="form-grid">
        <div class="field"><label>Mot de passe</label><div class="pw-wrap"><input class="input" type="password" name="password" required><button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Afficher le mot de passe">${icon('eye', 16)}</button></div></div>
        <div class="field"><label>Confirmation</label><div class="pw-wrap"><input class="input" type="password" name="password2" required><button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Afficher le mot de passe">${icon('eye', 16)}</button></div></div>
      </div>
      <div id="reg-err"></div>
      <button class="btn block">Continuer vers le paiement</button>
      <p class="small muted" style="margin:14px 0 0;text-align:center">Déjà inscrit ? <a href="#/login">Se connecter</a></p>
    </form>
  </div></section>`);
});

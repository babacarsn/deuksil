/* ==========================================================================
   VUE : connexion
   ========================================================================== */
route(/^\/login$/, () => shellPublic(`
  <section class="section" style="border:0"><div class="wrap" style="max-width:460px">
    <h2>Connexion à votre espace</h2>
    <p class="muted small">Identifiez-vous avec le numéro de CNI utilisé à l'inscription.</p>
    <form class="card" data-action="login" style="margin-top:18px">
      <div class="field"><label>Numéro de CNI</label><input class="input" name="cni" inputmode="numeric" placeholder="1900000000002" required></div>
      <div class="field"><label>Mot de passe</label><div class="pw-wrap"><input class="input" name="password" type="password" placeholder="••••••••" required><button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Afficher le mot de passe">${icon('eye', 16)}</button></div></div>
      <div id="login-err"></div>
      <button class="btn block">Se connecter</button>
      <p class="small muted" style="margin:14px 0 0;text-align:center">Pas encore de compte ? <a href="#/register">Créer un compte</a></p>
    </form>
    <div class="card" style="margin-top:16px;background:var(--surface-2)">
      <b class="small">Comptes de démonstration</b>
      <div class="stack small" style="margin-top:10px">
        ${[['Client','1900000000002','demo123'],['Propriétaire','1900000000003','demo123'],['Agence','1900000000004','demo123'],['Administrateur','1900000000001','admin123']]
          .map(([r, c, p]) => `<div class="row-between"><span>${r} · <code>${c}</code> · <code>${p}</code></span>
            <button class="btn ghost sm" data-action="fill-login" data-cni="${c}" data-pwd="${p}">Utiliser</button></div>`).join('')}
      </div>
      <p class="small muted" style="margin:12px 0 0">Simulation : les mots de passe sont stockés en clair dans le navigateur, uniquement pour la démonstration.</p>
    </div>
  </div></section>`));

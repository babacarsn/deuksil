/* ==========================================================================
   VUE : connexion — écran en deux panneaux (photo et promesse à gauche,
   formulaire à droite), d'après la maquette fournie.
   ========================================================================== */
document.head.insertAdjacentHTML('beforeend', '<style>'
  + '.auth{display:grid;grid-template-columns:1fr 1fr;min-height:100vh;background:var(--surface-2)}'
  + '.auth-side{position:relative;overflow:hidden;background:var(--nav);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:42px 46px}'
  + '.auth-side img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}'
  + '.auth-side::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(105deg,rgba(12,39,69,.95) 0%,rgba(12,39,69,.82) 42%,rgba(12,39,69,.52) 100%),linear-gradient(0deg,rgba(12,39,69,.7),transparent 45%)}'
  + '.auth-side > *{position:relative;z-index:2}'
  + '.auth-side .logo{color:#fff;font-size:1.5rem;font-weight:700}.auth-side .logo .mark{width:34px;height:34px}'
  + '.auth-side h1{color:#fff;font-size:clamp(1.8rem,2.6vw,2.4rem);font-weight:700;letter-spacing:-.03em;line-height:1.18;margin:0 0 14px;max-width:15ch;text-shadow:0 2px 18px rgba(0,16,32,.55)}'
  + '.auth-side h1 span{color:var(--gold);display:block}'
  + '.auth-side p{color:#D2DEEA;font-size:1rem;line-height:1.6;max-width:34ch;margin:0 0 26px;text-shadow:0 1px 10px rgba(0,16,32,.5)}'
  + '.auth-feat{display:flex;align-items:center;gap:22px;flex-wrap:wrap;color:#E6EDF4;font-size:.9rem;font-weight:500}'
  + '.auth-feat span{display:flex;align-items:center;gap:9px}.auth-feat svg{color:var(--gold)}'
  + '.auth-main{display:flex;flex-direction:column;padding:26px 32px 40px;overflow-y:auto}'
  + '.auth-top{display:flex;justify-content:flex-end}'
  + '.auth-box{width:100%;max-width:430px;margin:auto;padding:14px 0}'
  + '.auth-box .logo{justify-content:center;margin-bottom:18px;font-size:1.55rem}'
  + '.auth-badge{display:flex;width:max-content;margin:0 auto 18px;align-items:center;gap:8px;padding:7px 14px;border-radius:99px;background:var(--brand-soft);color:var(--brand);font-size:.76rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}'
  + '.auth-box h2{text-align:center;margin:0 0 6px;font-size:1.75rem}'
  + '.auth-box .lede{text-align:center;color:var(--muted);margin:0 0 24px}'
  + '.auth-box .field{margin-bottom:16px}'
  + '.ifield{position:relative}.ifield .ifx{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none;display:flex;align-items:center}'
  + '.ifield .input{padding-left:48px;padding-right:46px;min-height:52px;border-radius:14px}'
  + '.ifield .pw-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:var(--muted);cursor:pointer;padding:8px;border-radius:9px}'
  + '.ifield .pw-toggle:hover{color:var(--brand)}'
  + '.auth-forgot{display:inline-flex;align-items:center;gap:6px;float:right;margin:-2px 0 22px;padding:7px 12px;border-radius:99px;'
  + 'background:var(--surface);border:1px solid var(--line);color:var(--brand);font-size:.8rem;font-weight:600;text-decoration:none;transition:background .18s,border-color .18s,transform .14s}'
  + '.auth-forgot:hover{background:var(--brand-soft);border-color:var(--brand)}'
  + '.auth-forgot:active{transform:scale(.97)}'
  + '.auth-forgot svg{opacity:.8}'
  + '.auth-box form::after{content:"";display:block;clear:both}'
  + '.auth-box .btn.block{min-height:54px;border-radius:14px;font-size:.98rem;gap:10px}'
  + '.auth-or{display:flex;align-items:center;gap:14px;margin:22px 0;color:var(--muted);font-size:.82rem}'
  + '.auth-or::before,.auth-or::after{content:"";flex:1;height:1px;background:var(--line)}'
  + '@media (max-width:980px){.auth{grid-template-columns:1fr}.auth-side{display:none}.auth-main{min-height:100vh;padding:18px 16px 32px}}'
  + '</style>');

route(/^\/login$/, () => `<div class="auth">
  <aside class="auth-side">
    <img class="bg" src="${PHOTOS.cover}" alt="" loading="eager">
    <a class="logo" href="#/"><img src="${LOGO_LIGHT}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
    <div>
      <h1>Votre immobilier,<span>simplement maîtrisé.</span></h1>
      <p>Recherchez, gérez et développez vos biens depuis un espace unique.</p>
      <div class="auth-feat">
        <span>${icon('home', 19)} Biens</span>
        <span>${icon('users', 19)} Clients</span>
        <span>${icon('checkCircle', 19)} Gestion simplifiée</span>
      </div>
    </div>
    <p class="small" style="margin:0;color:#8FA6BC">DEUKSIL © ${new Date().getFullYear()} · Sénégal</p>
  </aside>

  <main class="auth-main">
    <div class="auth-top"><a class="small muted" href="#/" style="display:flex;align-items:center;gap:7px;text-decoration:none">${icon('arrowLeft', 16)} Retour à l'accueil</a></div>
    <div class="auth-box">
      <a class="logo" href="#/"><img src="${LOGO_DARK}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
      <span class="auth-badge">${icon('lock', 14)} Espace sécurisé</span>
      <h2>Bienvenue sur DEUKSIL</h2>
      <p class="lede">Connectez-vous à votre espace immobilier.</p>

      <button type="button" class="g-btn" data-action="g-choose">${gLogo(19)} Continuer avec Google</button>
      <div class="auth-or">ou avec votre adresse e-mail</div>

      <form data-action="login">
        <div class="field"><label for="au-cni">Adresse e-mail</label>
          <div class="ifield"><span class="ifx">${icon('user', 18)}</span>
            <input class="input" id="au-cni" name="cni" type="email" placeholder="vous@exemple.com" required autocomplete="username"></div></div>
        <div class="field" style="margin-bottom:6px"><label for="au-pwd">Mot de passe</label>
          <div class="ifield"><span class="ifx">${icon('lock', 18)}</span>
            <input class="input" id="au-pwd" name="password" type="password" placeholder="Votre mot de passe" required autocomplete="current-password">
            <button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Afficher le mot de passe">${icon('eye', 18)}</button></div></div>
        <a class="auth-forgot" href="#/mot-de-passe-oublie">${icon('alert', 14)} Mot de passe oublié ?</a>
        <div id="login-err"></div>
        <button class="btn block">Se connecter ${icon('arrowRight', 17)}</button>
      </form>

      <p class="small muted" style="text-align:center;margin:18px 0 0">Vous n'avez pas encore de compte ? <a href="#/register"><b>Créer un compte</b></a></p>


    </div>
  </main>
</div>`);

/* « Mot de passe oublié ? » mène à la page dédiée (js/99g-formulaires.js). */

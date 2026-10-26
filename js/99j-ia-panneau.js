/* ==========================================================================
   99j-ia-panneau.js — Fenêtre de l'assistant DEUKSIL (interface seulement).
   Corrige :
   * le chat ouvert dans une petite fenêtre générique : il a maintenant son
     propre panneau, fixe, au-dessus du contenu et de la barre d'onglets
     (bureau : panneau à droite ; téléphone : plein écran, qui reste au-dessus
     du clavier grâce à visualViewport) ;
   * la saisie : zone de texte qui s'agrandit, Entrée pour envoyer sur
     ordinateur (Maj+Entrée = nouvelle ligne), police 16 px (pas de zoom iOS) ;
   * le défilement : la liste défile seule (la page derrière ne bouge plus),
     reste en bas à chaque nouveau message, bouton « nouveaux messages » ;
   * le bouton rond : masqué pendant la conversation et pendant une saisie
     au téléphone, et une marge en bas des pages pour ne plus cacher les
     derniers boutons (« Suivant », « Clore »…).
   Les identifiants utilisés par les autres modules sont conservés :
   #ai-chat-list, form[data-action="ai-chat-send"], #ai-chat-text, ai-voice.
   ========================================================================== */
(() => {
  const tactile = () => matchMedia('(pointer: coarse)').matches;
  const petit = () => matchMedia('(max-width: 760px)').matches;
  let panneau = null, retourFocus = null;

  document.head.insertAdjacentHTML('beforeend', `<style>
  #ia-panneau{position:fixed;z-index:79;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#0E1A2B);
    right:24px;bottom:24px;width:min(420px,calc(100vw - 48px));height:min(640px,calc(100dvh - 48px));
    border-radius:22px;box-shadow:0 24px 60px -18px rgba(12,39,69,.45),0 0 0 1px rgba(12,39,69,.08);overflow:hidden;animation:iaIn .22s cubic-bezier(.2,.8,.3,1)}
  @keyframes iaIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
  #ia-panneau .iap-tete{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 18px;border-bottom:1px solid var(--line,#E3EAF4);flex:none;background:var(--surface,#fff)}
  #ia-panneau .iap-tete h3{margin:0;font-size:1.02rem;flex:1;min-width:0}
  #ia-panneau .iap-tete .sous{display:block;font-weight:400;font-size:.78rem;color:var(--muted,#5A6B80);margin-top:1px}
  #ia-panneau .iap-ic{width:40px;height:40px;border-radius:12px;border:1px solid var(--line,#E3EAF4);background:var(--surface,#fff);display:grid;place-items:center;cursor:pointer;color:var(--ink,#0E1A2B);flex:none}
  #ia-panneau .iap-ic:hover{border-color:var(--brand,#0C2745)}
  #ia-panneau .iap-ic:focus-visible,#ia-panneau button:focus-visible,#ia-panneau textarea:focus-visible{outline:2px solid var(--brand,#0C2745);outline-offset:2px}
  #ia-panneau .ai-chat{flex:1;min-height:0;height:auto;display:flex;flex-direction:column;position:relative}
  #ia-panneau .ai-chat-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;
    display:flex;flex-direction:column;gap:10px;padding:16px 16px 12px}
  #ia-panneau .ai-chat-list .bubble{max-width:86%;font-size:.95rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
  #ia-panneau .ai-chat-input{flex:none;display:flex;align-items:flex-end;gap:8px;border-top:1px solid var(--line,#E3EAF4);
    padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:var(--surface,#fff);margin:0}
  #ia-panneau #ai-chat-text{flex:1;min-width:0;resize:none;font:inherit;font-size:16px;line-height:1.4;max-height:140px;min-height:44px;
    padding:10px 12px;border:1px solid var(--line-strong,#C9D5E3);border-radius:14px;background:var(--surface,#fff);color:inherit;overflow-y:auto}
  #ia-panneau .mic-btn,#ia-panneau .iap-env{width:44px;height:44px;flex:none;border-radius:14px;display:grid;place-items:center;padding:0}
  #ia-panneau .iap-env{border:0;background:var(--nav,#0C2745);color:#fff;cursor:pointer}
  #ia-panneau .iap-env:disabled{opacity:.45;cursor:default}
  #ia-panneau .iap-bas{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);border:0;border-radius:999px;padding:7px 14px;
    background:var(--nav,#0C2745);color:#fff;font:600 .8rem/1 var(--font,inherit);box-shadow:0 8px 20px -8px rgba(12,39,69,.6);cursor:pointer;display:none}
  #ia-panneau .iap-bas.on{display:block}
  html.ia-ouvert .ai-fab,html.ia-ouvert .haut{display:none!important}
  @media (max-width:760px){
    #ia-panneau{left:0;right:0;top:0;bottom:auto;width:100%;height:var(--iap-h,100dvh);border-radius:0;box-shadow:none;animation:none;
      padding-top:env(safe-area-inset-top,0px)}
    html.ia-ouvert,html.ia-ouvert body{overflow:hidden!important}
    html.saisie-en-cours .ai-fab{display:none!important}
    .main > .content{padding-bottom:calc(150px + env(safe-area-inset-bottom,0px))!important}
  }
  @media (min-width:761px){.main > .content{padding-bottom:110px!important}}
  @media (prefers-reduced-motion:reduce){#ia-panneau{animation:none}}
  </style>`);

  /* Hauteur réelle visible (clavier ouvert compris) au téléphone. */
  const ajuster = () => {
    if (!panneau || !petit()) return;
    const vv = window.visualViewport;
    panneau.style.setProperty('--iap-h', (vv ? vv.height : innerHeight) + 'px');
    panneau.style.top = (vv ? vv.offsetTop : 0) + 'px';
    const l = $('#ai-chat-list'); if (l && enBas) l.scrollTop = l.scrollHeight;
  };
  if (window.visualViewport) { visualViewport.addEventListener('resize', ajuster); visualViewport.addEventListener('scroll', ajuster); }
  addEventListener('resize', ajuster);

  /* Défilement : rester en bas tant que l'utilisateur n'est pas remonté lire. */
  let enBas = true;
  const majBas = () => { const l = $('#ai-chat-list'), b = panneau && panneau.querySelector('.iap-bas'); if (!l || !b) return;
    enBas = l.scrollHeight - l.clientHeight - l.scrollTop < 40; if (enBas) b.classList.remove('on'); };
  const _rendu = renderAiChatInPlace;
  renderAiChatInPlace = function () {
    const l = $('#ai-chat-list'), etaitEnBas = enBas, pos = l ? l.scrollTop : 0;
    _rendu();                                    // (l'ancien rendu descend toujours tout en bas)
    const l2 = $('#ai-chat-list'); if (!l2 || !panneau) return;
    if (etaitEnBas || !l) l2.scrollTop = l2.scrollHeight;
    else { l2.scrollTop = pos; const b = panneau.querySelector('.iap-bas'); if (b) b.classList.add('on'); }
    const env = panneau.querySelector('.iap-env'); if (env) env.disabled = !!aiChatBusy;
  };

  const auto = t => { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; };

  function fermer() {
    if (!panneau) return;
    panneau.remove(); panneau = null;
    document.documentElement.classList.remove('ia-ouvert');
    if (retourFocus && document.contains(retourFocus)) retourFocus.focus();
  }
  window.fermerAssistant = fermer;

  openAiChat = function () {
    if (panneau) { $('#ai-chat-text')?.focus(); return; }
    closeModal();
    retourFocus = document.activeElement;
    panneau = document.createElement('section');
    panneau.id = 'ia-panneau'; panneau.setAttribute('role', 'dialog'); panneau.setAttribute('aria-modal', petit() ? 'true' : 'false'); panneau.setAttribute('aria-labelledby', 'iap-titre');
    panneau.innerHTML = `<div class="iap-tete">
        <h3 id="iap-titre">Assistant DEUKSIL<span class="sous">${Auth.current() ? 'Questions sur votre espace ou sur DEUKSIL' : 'Questions sur DEUKSIL et vos recherches'}</span></h3>
        <button type="button" class="iap-ic" data-iap="nouveau" aria-label="Nouvelle conversation" title="Nouvelle conversation">${icon('plus', 18)}</button>
        <button type="button" class="iap-ic" data-iap="fermer" aria-label="Fermer l'assistant" title="Fermer">${icon('close', 18)}</button></div>
      <div class="ai-chat">
        <div class="ai-chat-list" id="ai-chat-list" aria-live="polite"></div>
        <button type="button" class="iap-bas" data-iap="bas">Nouveaux messages ↓</button>
        <form class="ai-chat-input" data-action="ai-chat-send">
          <button type="button" class="mic-btn btn ghost" data-action="ai-voice" aria-label="Dicter votre question">${icon('mic', 18)}</button>
          <textarea id="ai-chat-text" name="msg" rows="1" placeholder="Posez votre question…" autocomplete="off" aria-label="Votre question"></textarea>
          <button class="iap-env" type="submit" aria-label="Envoyer">${icon('arrowRight', 18)}</button>
        </form></div>`;
    document.body.appendChild(panneau);
    document.documentElement.classList.add('ia-ouvert');
    enBas = true;
    if (!aiChatHistory.length) aiChatCharger();
    renderAiChatInPlace(); ajuster();
    const t = $('#ai-chat-text'), l = $('#ai-chat-list');
    l.addEventListener('scroll', majBas, {passive: true});
    t.addEventListener('input', () => auto(t));
    t.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !tactile()) { e.preventDefault(); if (t.value.trim()) t.form.requestSubmit(); }
    });
    t.form.addEventListener('submit', () => setTimeout(() => { auto(t); enBas = true; const l2 = $('#ai-chat-list'); if (l2) l2.scrollTop = l2.scrollHeight; t.focus(); }, 0));
    panneau.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); fermer(); return; }
      if (e.key === 'Tab' && petit()) {
        const f = [...panneau.querySelectorAll('button:not([disabled]),textarea,a[href]')]; if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    setTimeout(() => { if (!tactile()) t.focus(); }, 30);
  };

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-iap]'); if (!b) return;
    e.preventDefault();
    const a = b.dataset.iap;
    if (a === 'fermer') fermer();
    if (a === 'bas') { const l = $('#ai-chat-list'); if (l) { l.scrollTop = l.scrollHeight; enBas = true; b.classList.remove('on'); } }
    if (a === 'nouveau') {
      if (aiChatBusy) return;
      aiChatHistory = []; try { localStorage.removeItem(aiCle()); } catch (er) {}
      renderAiChatInPlace(); $('#ai-chat-text')?.focus();
    }
  });
  /* Un lien suivi depuis l'assistant (suggestion, recherche) : au téléphone on referme. */
  addEventListener('hashchange', () => { if (panneau && petit()) fermer(); });
  /* Déconnexion : le panneau se ferme. */
  const _logout = Auth.logout;
  Auth.logout = async function (...a) { fermer(); return _logout.apply(this, a); };

  /* Téléphone : pendant une saisie dans la page, le bouton rond ne recouvre pas le champ. */
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('input:not([type=checkbox]):not([type=radio]),textarea,select') && !e.target.closest('#ia-panneau')) document.documentElement.classList.add('saisie-en-cours'); });
  document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches('input,textarea,select')) document.documentElement.classList.remove('saisie-en-cours'); }, 60));
})();

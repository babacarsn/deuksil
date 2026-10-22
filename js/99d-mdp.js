/* =============================================================================
   MODULE : 99d-mdp.js — l'œil sur TOUS les champs de mot de passe
   Connexion, inscription et changement de mot de passe avaient déjà le bouton ;
   les autres formulaires (accès d'un membre ou d'un locataire, mot de passe de
   l'agent, sécurité du compte, premier mot de passe) ne l'avaient pas.
   Chaque champ de mot de passe sans bouton reçoit le même bouton « œil »
   (data-action="toggle-pw", géré par js/27-actions.js).
   ============================================================================= */
(() => {
  function equiper(input) {
    if (input.dataset.oeil) return;
    input.dataset.oeil = '1';
    const suivant = input.nextElementSibling;
    if (suivant && suivant.matches('.pw-toggle, [data-action="toggle-pw"]')) return;   // déjà équipé
    let wrap = input.parentElement;
    if (!wrap.classList.contains('pw-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'pw-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    input.insertAdjacentHTML('afterend', `<button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Afficher le mot de passe">${icon('eye', 16)}</button>`);
  }
  const tout = () => document.querySelectorAll('input[type="password"]:not([data-oeil])').forEach(equiper);
  new MutationObserver(tout).observe(document.body, {childList: true, subtree: true});
  tout();
})();

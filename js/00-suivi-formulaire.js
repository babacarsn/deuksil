/* Chargé en premier : retient le formulaire qui vient d'être envoyé, pour
   que ses erreurs puissent s'afficher à côté du bon champ (94-finalisation.js).
   Aucun autre effet. */
let FORM_SOUMIS = null;
window.addEventListener('submit', e => { FORM_SOUMIS = {f: e.target, t: Date.now()}; }, true);

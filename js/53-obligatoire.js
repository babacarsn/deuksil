/* ==========================================================================
   MODULE : obligatoire.js — champs réellement obligatoires.
   Beaucoup de formulaires laissaient passer un enregistrement incomplet :
   un bail sans téléphone, une dépense sans date, une facture sans nom
   d'émetteur. On marque ces champs comme requis — le navigateur refuse
   l'envoi et signale le champ — et on ajoute un astérisque sur l'intitulé
   pour prévenir avant la saisie plutôt qu'après.
   Ne sont visés que les champs dont l'absence fausse une donnée ou un
   document : le reste demeure facultatif.
   ========================================================================== */
const OBLIGATOIRES = {
  'save-property':        ['region', 'city', 'quartier'],   // une annonce sans localisation est introuvable
  'g-lease':              ['phone'],                        // joindre le locataire
  'g-deal':               ['offer'],                        // une vente sans montant n'a pas de sens
  'g2-expense':           ['date'],                         // sans date, les totaux mensuels sont faux
  'g3-contract':          ['amount'],                       // montant du contrat
  'g4-member':            ['phone'],                        // contact du membre d'équipe
  'g4-identity':          ['name'],                         // figure sur tous les PDF
  'save-profile':         ['firstName', 'lastName', 'phone'],
  'g9-owner':             ['rate'],                         // base du calcul de commission
  'save-agency-settings': ['agencyName'],                   // en-tête des documents
  'g9-iasset':            ['value', 'date'],                // sans valeur, la plus-value est fausse
};

function marquerObligatoires(racine) {
  (racine || document).querySelectorAll('form[data-action]').forEach(f => {
    const liste = OBLIGATOIRES[f.getAttribute('data-action')];
    if (!liste) return;
    liste.forEach(n => {
      const champ = f.querySelector(`[name="${n}"]`);
      if (!champ || champ.required) return;
      champ.required = true;
      const bloc = champ.closest('.field');
      const lab = bloc && bloc.querySelector('label');
      if (lab && !lab.querySelector('.req')) {
        const e = document.createElement('span');
        e.className = 'req'; e.textContent = '*';
        e.title = 'Champ obligatoire';
        lab.appendChild(e);
      }
    });
  });
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { marquerObligatoires(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});
marquerObligatoires();

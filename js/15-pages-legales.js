/* ==========================================================================
   VUES : pages légales (contenu de démonstration)
   ========================================================================== */
const LEGAL_PAGES = {
  mentions: {title:'Mentions légales', body:`
    <p><b>Éditeur.</b> DEUKSIL est un projet de démonstration à but illustratif. Aucune société n'est réellement exploitée sous ce nom dans le cadre de cette version.</p>
    <p><b>Hébergement.</b> Cette version fonctionne entièrement dans le navigateur : les données sont stockées localement (<code>localStorage</code>) et ne transitent par aucun serveur.</p>
    <p><b>Propriété intellectuelle.</b> La marque, le nom « DEUKSIL » et les éléments graphiques de cette démonstration sont fictifs et ne doivent pas être réutilisés commercialement.</p>
    <p><b>Contact.</b> Cette démonstration n'assure pas de support utilisateur réel.</p>`},
  cgu: {title:"Conditions générales d'utilisation", body:`
    <p>Ces conditions décrivent, à titre d'exemple, le fonctionnement envisagé d'une future version de DEUKSIL.</p>
    <p><b>1. Objet.</b> DEUKSIL met en relation des personnes recherchant un bien immobilier avec des propriétaires ou des agences au Sénégal.</p>
    <p><b>2. Comptes.</b> L'inscription requiert un numéro de CNI et le règlement des frais correspondant au type de compte choisi. Toute fausse déclaration peut entraîner la suspension du compte.</p>
    <p><b>3. Annonces.</b> Les annonces sont vérifiées avant publication. DEUKSIL ne garantit pas l'exactitude des informations fournies par les propriétaires et agences.</p>
    <p><b>4. Gratuité.</b> L'inscription et l'utilisation de DEUKSIL sont gratuites : aucun frais, aucun abonnement et aucune commission sur les loyers ou les ventes.</p>
    <p><b>5. Responsabilité.</b> DEUKSIL agit en tant qu'intermédiaire technique et n'est pas partie aux contrats de bail ou de vente conclus entre utilisateurs.</p>
    <p class="muted small">Dans cette démonstration, ces conditions n'ont pas de valeur contractuelle réelle.</p>`},
  confidentialite: {title:'Politique de confidentialité', body:`
    <p><b>Données collectées.</b> Dans cette démonstration, les informations saisies (identité, CNI fictive, téléphone, annonces, messages) restent stockées uniquement dans le navigateur utilisé, via <code>localStorage</code>.</p>
    <p><b>Aucun partage.</b> Aucune donnée n'est transmise à un serveur, à un tiers ou à un service publicitaire.</p>
    <p><b>Suppression.</b> Vider les données du site ou utiliser le bouton « Réinitialiser la démonstration » efface l'ensemble des informations enregistrées.</p>
    <p><b>Version production.</b> Une version réelle collecterait des données à caractère personnel et serait soumise à la réglementation applicable en matière de protection des données ; voir la section correspondante du README du projet.</p>`}
};
route(/^\/legal\/(mentions|cgu|confidentialite)$/, key => {
  const pg = LEGAL_PAGES[key];
  return shellPublic(`<section class="section" style="border:0"><div class="wrap" style="max-width:760px">
    ${backBar('#/', 'Accueil')}
    <h2 style="margin-top:16px">${pg.title}</h2>
    <div class="card" style="margin-top:18px">${pg.body}</div>
  </div></section>`);
});

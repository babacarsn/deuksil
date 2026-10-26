/* ==========================================================================
   VUES : pages légales.
   Les informations sur l'éditeur viennent de DEUKSIL_CONFIG.editeur
   (js/00-config.js) ; un champ non renseigné s'affiche « à compléter »
   au lieu d'être inventé. Le texte doit être relu par un juriste avant
   l'ouverture au public (voir README_SUPABASE.md, liste de mise en ligne).
   ========================================================================== */
const ED = () => (typeof DEUKSIL_CONFIG !== 'undefined' && DEUKSIL_CONFIG.editeur) || {};
const aCompleter = v => v ? esc(v) : '<span class="muted">(à compléter)</span>';
const LEGAL_PAGES = {
  mentions: {title: 'Mentions légales', body: () => { const E = ED(); return `
    <p><b>Éditeur.</b> ${aCompleter(E.raisonSociale)} — ${aCompleter(E.formeJuridique)}, siège : ${aCompleter(E.adresse)}.
      NINEA : ${aCompleter(E.ninea)} · RCCM : ${aCompleter(E.rccm)}.</p>
    <p><b>Directeur de la publication.</b> ${aCompleter(E.directeurPublication)}.</p>
    <p><b>Contact.</b> ${aCompleter(E.email)} — ou la page <a href="#/contact">Contact</a>.</p>
    <p><b>Hébergement.</b> Site : ${aCompleter(E.hebergeurSite)}. Données (base de données, comptes et fichiers) : Supabase (supabase.com), région d’hébergement ${aCompleter(E.regionDonnees)}.</p>
    <p><b>Propriété intellectuelle.</b> La marque, le nom « DEUKSIL » et les éléments graphiques du site sont protégés ; toute reproduction sans autorisation est interdite. Les annonces et leurs photos restent la propriété de leurs auteurs.</p>`; }},
  cgu: {title: "Conditions générales d'utilisation", body: () => `
    <p><b>1. Objet.</b> DEUKSIL met en relation des personnes recherchant un bien immobilier avec des propriétaires ou des agences au Sénégal, et fournit des outils de gestion locative et commerciale.</p>
    <p><b>2. Comptes.</b> L'inscription demande une adresse e-mail valide, un numéro de téléphone et un numéro de CNI, qui sert à limiter les faux comptes et n'est jamais affiché publiquement. Toute fausse déclaration peut entraîner la suspension du compte. Chacun est responsable de la confidentialité de son mot de passe.</p>
    <p><b>3. Annonces.</b> L'annonceur garantit l'exactitude de ses annonces et dispose des droits sur les photos publiées. DEUKSIL peut retirer une annonce signalée ou contraire à la loi. Les informations foncières sont déclaratives tant qu'elles ne portent pas la mention « vérifié par DEUKSIL ».</p>
    <p><b>4. Gratuité.</b> L'inscription et l'utilisation de DEUKSIL sont gratuites : aucun frais, aucun abonnement et aucune commission sur les loyers ou les ventes. Aucun paiement ne transite par DEUKSIL.</p>
    <p><b>5. Responsabilité.</b> DEUKSIL agit en tant qu'intermédiaire technique et n'est pas partie aux contrats de bail ou de vente conclus entre utilisateurs.</p>
    <p><b>6. Suspension et suppression.</b> Un compte qui enfreint ces conditions peut être suspendu. Chaque utilisateur peut supprimer son compte depuis son profil.</p>`},
  confidentialite: {title: 'Politique de confidentialité', body: () => { const E = ED(); return `
    <p><b>Responsable du traitement.</b> ${aCompleter(E.raisonSociale)}, ${aCompleter(E.adresse)} — ${aCompleter(E.email)}.</p>
    <p><b>Données collectées.</b> Identité (nom, prénom), adresse e-mail, téléphone, numéro de CNI, et ce que vous saisissez dans le service : annonces, photos, messages, visites, baux, loyers, documents. Les mots de passe sont gérés par le service d'authentification et conservés uniquement sous forme chiffrée.</p>
    <p><b>Finalités.</b> Fonctionnement du compte, mise en relation, gestion locative et commerciale, sécurité (lutte contre les faux comptes et la fraude), assistance.</p>
    <p><b>Destinataires.</b> Chaque information n'est visible que par les personnes concernées (par exemple : votre bailleur voit les données de votre bail ; un visiteur ne voit que les annonces publiées). Les données sont hébergées par Supabase (base de données, authentification, fichiers). Aucune donnée n'est vendue ni utilisée à des fins publicitaires.</p>
    <p><b>Durée de conservation.</b> Pendant la durée du compte, puis supprimées à sa suppression, sauf obligation légale de conservation (pièces comptables).</p>
    <p><b>Vos droits.</b> Accès, rectification, opposition et suppression, conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, en écrivant à ${aCompleter(E.email)} ou via la page <a href="#/contact">Contact</a>. Vous pouvez saisir la Commission de protection des données personnelles (CDP).</p>`; }}
};
route(/^\/legal\/(mentions|cgu|confidentialite)$/, key => {
  const pg = LEGAL_PAGES[key];
  return shellPublic(`<section class="section" style="border:0"><div class="wrap" style="max-width:760px">
    ${backBar('#/', 'Accueil')}
    <h2 style="margin-top:16px">${pg.title}</h2>
    <div class="card" style="margin-top:18px">${pg.body()}</div>
  </div></section>`);
});

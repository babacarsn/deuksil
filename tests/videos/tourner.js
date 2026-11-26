/* Tournage des tutoriels de la page Aide (videos/guides/).
   node tests/videos/tourner.js            → toutes les vidéos
   node tests/videos/tourner.js publier bail → seulement celles-ci
   Prérequis : Playwright + Chromium, ffmpeg (voir tests/videos/LISEZMOI.md). */
const path = require('path'), fs = require('fs');
const {filmer, arreter} = require('./studio');
const RACINE = path.join(__dirname, '../..'), SORTIE = path.join(RACINE, 'videos/guides');
const PH = n => `img/photos/${n}.jpg`;
const T0 = '2026-11-02T09:00:00Z';

/* Données fictives plus riches que celles du banc : des annonces avec de vraies photos. */
function enrichir(D, ID) {
  const ann = (id, o) => ({id, owner_id: ID.proprio, title: '', type: 'appartement', transaction: 'location', price: 0, region: 'Dakar', city: 'Dakar', commune: '', quartier: '',
    surface: 80, rooms: 2, baths: 1, status: 'disponible', listing_status: 'publiee', description: 'Logement lumineux, proche des commerces et des transports.', amenities: ['Climatisation', 'Gardien'],
    photos: [], views: 12, contacts: 2, verif_level: 'none', published_at: T0, extra: {}, created_at: T0, updated_at: T0, ...o});
  D.properties.find(p => p.id === ID.p1).photos = [PH('villa2'), PH('maison1'), PH('local1')];
  D.properties.find(p => p.id === ID.p2).photos = [PH('local2')];
  D.properties.find(p => p.id === ID.p3).photos = [PH('villa1'), PH('villa3')];
  D.properties.push(
    ann('c0000000-0000-4000-8000-000000000011', {title: 'Appartement F4 vue mer', commune: 'Ngor', quartier: 'Almadies', price: 650000, rooms: 3, baths: 2, surface: 120, photos: [PH('villa4'), PH('maison2')]}),
    ann('c0000000-0000-4000-8000-000000000012', {title: 'Studio meublé Mermoz', type: 'studio', commune: 'Mermoz', quartier: 'Mermoz', price: 200000, rooms: 1, surface: 35, photos: [PH('maison3')]}),
    ann('c0000000-0000-4000-8000-000000000013', {title: 'Maison 5 pièces avec jardin', type: 'maison', commune: 'Ouakam', quartier: 'Ouakam', price: 900000, rooms: 4, baths: 3, surface: 220, photos: [PH('maison1'), PH('villa2')], owner_id: ID.agence}),
    ann('c0000000-0000-4000-8000-000000000014', {title: 'Terrain 300 m² à Diamniadio', type: 'terrain', transaction: 'vente', city: 'Diamniadio', commune: 'Diamniadio', quartier: 'Pôle urbain', price: 18000000, rooms: 0, baths: 0, surface: 300, photos: [PH('terrain')]}),
    ann('c0000000-0000-4000-8000-000000000015', {title: 'Bureaux 150 m² Plateau', type: 'bureau', commune: 'Plateau', quartier: 'Plateau', price: 1200000, rooms: 0, baths: 1, surface: 150, photos: [PH('bureau')], owner_id: ID.agence})
  );
  D.leases.push({id: 'd0000000-0000-4000-8000-000000000002', owner_id: ID.proprio, property_id: 'c0000000-0000-4000-8000-000000000011', tenant: 'Moussa Ndiaye', phone: '776543210', rent: 650000, deposit: 1300000, start: '2026-09-01', months: 12, due_day: 5, status: 'actif', renewals: [], revisions: [], retenues: [], extra: {}, created_at: T0, updated_at: T0});
  D.properties.find(p => p.id === 'c0000000-0000-4000-8000-000000000011').status = 'loue';
  ['2026-09', '2026-10', '2026-11'].forEach((m, i) => D.rents.push({id: `r0000000-0000-4000-8000-00000000002${i}`, owner_id: ID.proprio, lease_id: 'd0000000-0000-4000-8000-000000000002', month: m, amount: 650000, paid_at: i < 2 ? m + '-05' : null, method: 'Wave', payments: i < 2 ? [{date: m + '-05', amount: 650000, method: 'Wave'}] : [], reminders: 0, extra: {}, created_at: T0, updated_at: T0}));
  D.visits.push({id: 'v0000000-0000-4000-8000-000000000001', owner_id: ID.proprio, property_id: ID.p3, client_id: ID.client, date: '2026-11-28', time: '10:00', status: 'attente', note: 'Bonjour, je suis disponible samedi matin.', extra: {}, created_at: T0, updated_at: T0},
    {id: 'v0000000-0000-4000-8000-000000000002', owner_id: ID.agence, property_id: 'c0000000-0000-4000-8000-000000000013', client_id: ID.client, agent_id: ID.agent, date: '2026-11-29', time: '15:30', status: 'attente', note: 'Visite avec mon épouse si possible.', extra: {}, created_at: T0, updated_at: T0});
}
const prep = extra => (D, ID) => { enrichir(D, ID); if (extra) extra(D, ID); };

/* ----------------------------------------------------------------------------------- */
const SCENES = {
  rechercher: {qui: null, hash: '#/', titre: 'Rechercher un logement', espace: 'Visiteur, Client, Locataire', async scenario(t) {
    await t.clic({texte: 'Rechercher', dans: 'header'}, 'Cliquez sur <b>Rechercher</b>');
    await t.clic({texte: 'À louer', dans: '#app'}, 'Choisissez <b>À louer</b> ou <b>À vendre</b>');
    await t.legende('Précisez votre budget (et, si vous voulez, le type de bien)');
    await t.saisir('form[data-action="search"] [name="max"]', '700000');
    await t.clic('form[data-action="search"] button[type="submit"], form[data-action="search"] .btn:not(.ghost)', 'Lancez la recherche');
    await t.legende('Les annonces correspondantes s\'affichent, avec photo, prix et quartier', 2600);
    await t.affiche();
    await t.clic('article.carte-bien .cb-corps', 'Cliquez sur une annonce pour l\'ouvrir');
    await t.legende('La fiche montre les photos, le prix, l\'adresse et les équipements', 2400);
    await t.clic('.gallery .photo', 'Cliquez sur une photo pour l\'agrandir');
    await t.attendre(1200); await t.fermer();
    await t.defiler(500);
    await t.legende('Depuis la fiche : favori, demande de visite, message ou partage', 2600);
  }},
  'favoris-alertes': {qui: 'client', hash: '#/search', titre: 'Favoris, comparaison et alertes', espace: 'Client, Locataire', async scenario(t) {
    await t.clic('article.carte-bien [data-action="toggle-fav"]', 'Le <b>cœur</b> ajoute l\'annonce à vos favoris', {direct: true});
    await t.clic('article.carte-bien >> nth=0 >> .cf-cmp input', 'Cochez <b>Comparer</b> sur deux annonces ou plus', {direct: true});
    await t.clic('article.carte-bien >> nth=1 >> .cf-cmp input', null, {direct: true});
    await t.clic('.cf-cmp-barre a', 'Puis cliquez sur <b>Comparer</b>');
    await t.legende('Prix, surface, pièces : tout est côte à côte', 2600);
    await t.affiche();
    await t.aller('#/search');
    await t.clic('[data-action="save-search"]', 'Dans la recherche, <b>Créer une alerte</b> vous prévient des nouvelles annonces');
    await t.siPresent('.modal input', async () => { await t.saisir('.modal input', 'Appartement Dakar'); await t.clic({texte: 'Créer l\'alerte', dans: '.modal'}); });
    await t.clic({texte: 'Mes favoris', dans: '#sidebar'}, 'Retrouvez vos annonces dans <b>Mes favoris</b>');
    await t.attendre(800);
    await t.clic({texte: 'Mes alertes', dans: '#sidebar'}, 'Et vos recherches enregistrées dans <b>Mes alertes</b>');
    await t.attendre(1200);
  }},
  'visite-contact': {qui: 'client', hash: '#/property/c0000000-0000-4000-8000-000000000012', titre: 'Demander une visite', espace: 'Client, Locataire', async scenario(t) {
    await t.legende('Sur la fiche d\'un bien qui vous intéresse…', 2000);
    await t.clic('[data-action="ask-visit"]', 'Cliquez sur <b>Demander une visite</b>');
    await t.legende('Choisissez la date et l\'heure qui vous conviennent');
    await t.saisir('.modal [name="date"]', '2026-12-05', {lent: 20});
    await t.saisir('.modal [name="time"]', '10:30');
    await t.saisir('.modal [name="message"]', 'Bonjour, je suis disponible samedi matin. Merci !', {lent: 22});
    await t.affiche();
    await t.clic({texte: 'Envoyer la demande', dans: '.modal'}, 'Envoyez la demande');
    await t.legende('L\'annonceur est prévenu. Suivez sa réponse dans <b>Mes visites</b>', 2400);
    await t.clic({texte: 'Mes visites', dans: '#sidebar'});
    await t.attendre(1500);
  }},
  'creer-compte': {qui: null, hash: '#/', titre: 'Créer son compte', espace: 'Visiteur', async scenario(t) {
    await t.clic({texte: 'Créer un compte', dans: 'header'}, 'Cliquez sur <b>Créer un compte</b>');
    await t.clic({texte: 'Propriétaire', dans: '#app form'}, 'Choisissez votre profil : client, propriétaire ou agence');
    await t.clic({texte: 'Suivant', dans: '#app form'});
    await t.legende('Vos informations : nom, e-mail, téléphone');
    await t.saisir('[name="firstName"]', 'Aminata');
    await t.saisir('[name="lastName"]', 'Sow');
    await t.saisir('[name="email"]', 'aminata.sow@exemple.sn', {lent: 25});
    await t.saisir('[name="phone"]', '771234567');
    await t.siPresent({texte: 'Suivant', dans: '#app form'}, () => t.clic({texte: 'Suivant', dans: '#app form'}));
    await t.legende('Un mot de passe : 8 caractères au moins, avec des lettres et des chiffres');
    await t.saisir('[name="password"]', 'Teranga2026');
    await t.saisir('[name="password2"]', 'Teranga2026');
    await t.cocher('[name="cgu"]');
    await t.affiche();
    await t.clic({texte: 'Créer', dans: '#app form[data-action="register"]', role: 'button'}, 'Validez la création du compte');
    await t.attendre(800);
    await t.legende('Saisissez le code à 6 chiffres reçu par e-mail : votre compte est actif', 3000);
  }},
  publier: {qui: 'proprio', hash: '#/owner/dashboard', titre: 'Publier un bien', espace: 'Propriétaire, Agence, Agent', async scenario(t) {
    await t.clic({texte: 'Mes biens', dans: '#sidebar'}, 'Ouvrez <b>Mes biens</b> dans le menu');
    await t.clic({texte: 'Ajouter un bien'}, 'Puis cliquez sur <b>Ajouter un bien</b>');
    await t.legende('Étape 1 : la transaction et le type de bien');
    await t.clic({texte: 'Location', dans: '#wiz'});
    await t.clic({texte: 'Appartement', dans: '#wiz'});
    await t.clic({texte: 'Suivant', dans: '#wiz'});
    await t.legende('Étape 2 : le titre, la description et le prix');
    await t.saisir('#wiz [name="title"]', 'Appartement F3 lumineux à Sacré-Cœur');
    await t.saisir('#wiz [name="description"]', 'Trois pièces au 2e étage, cuisine équipée, parking, proche des commerces.', {lent: 18});
    await t.saisir('#wiz [name="price"]', '400000');
    await t.saisir('#wiz [name="surface"]', '95');
    await t.legende('Puis l\'adresse : commune et quartier');
    await t.saisir('#wiz [name="commune"]', 'Sicap');
    await t.saisir('#wiz [name="quartier"]', 'Sacré-Cœur 3');
    await t.saisir('#wiz [name="rooms"]', '2');
    await t.saisir('#wiz [name="baths"]', '1');
    await t.clic({texte: 'Suivant', dans: '#wiz'});
    await t.legende('Étape 3 : les photos. La première sert de couverture');
    await t.page.locator('#wiz input[type="file"]').first().setInputFiles(['villa2', 'maison1', 'local1', 'maison2'].map(n => path.join(RACINE, PH(n))));
    await t.attendre(2500);
    await t.affiche();
    await t.legende('Vérifiez, puis cliquez sur <b>Enregistrer et publier</b>');
    await t.clic({texte: 'Enregistrer et publier', dans: '#wiz, #app'});
    await t.attendre(800);
    await t.siPresent('.modal button:has-text("Publier")', async () => { await t.legende('Un récapitulatif s\'affiche : confirmez la publication'); await t.clic('.modal button:has-text("Publier")'); });
    await t.legende('Votre annonce est en ligne. Une annonce d\'agent part d\'abord en validation chez l\'agence', 3200);
  }},
  visites: {qui: 'proprio', hash: '#/owner/dashboard', titre: 'Répondre aux demandes de visite', espace: 'Propriétaire, Agence, Agent', async scenario(t) {
    await t.clic({texte: 'Visites', dans: '#sidebar'}, 'Ouvrez <b>Visites</b> : le chiffre indique les demandes en attente');
    await t.legende('Chaque demande : le bien, le client, le créneau et son message', 2600);
    await t.affiche();
    await t.clic({texte: 'Accepter', dans: '#app'}, 'Cliquez sur <b>Accepter</b> (ou <b>Refuser</b>)');
    await t.siPresent('.modal button', async () => { await t.clic('.modal button:not(.ghost):not([data-action="close-modal"])'); });
    await t.legende('Le client est prévenu dans son espace. Après la visite, marquez-la comme réalisée', 3000);
  }},
  bail: {qui: 'proprio', hash: '#/owner/dashboard', titre: 'Ajouter un locataire et son bail', espace: 'Propriétaire, Agence, Gestionnaire', async scenario(t) {
    await t.clic({texte: 'Locataires', dans: '#sidebar'}, 'Ouvrez <b>Locataires</b>');
    await t.defilerVers('form[data-action="g-lease"]');
    await t.legende('Remplissez le formulaire du bail : le bien, puis le locataire');
    await t.choisir('form[data-action="g-lease"] [name="propertyId"]', 'c0000000-0000-4000-8000-000000000012');
    await t.saisir('form[data-action="g-lease"] [name="tenant"]', 'Awa Ndiaye');
    await t.saisir('form[data-action="g-lease"] [name="phone"]', '771234567');
    await t.legende('Le loyer, la caution, le début et la durée');
    await t.saisir('form[data-action="g-lease"] [name="rent"]', '200000');
    await t.saisir('form[data-action="g-lease"] [name="deposit"]', '400000');
    await t.saisir('form[data-action="g-lease"] [name="start"]', '2026-12-01', {lent: 20});
    await t.saisir('form[data-action="g-lease"] [name="months"]', '12');
    await t.affiche();
    await t.clic({texte: 'Créer le bail', dans: 'form[data-action="g-lease"]'}, 'Cliquez sur <b>Créer le bail et l\'échéancier</b>');
    await t.legende('Le bail est créé et les loyers de chaque mois sont prêts dans <b>Loyers</b>', 2800);
    await t.legende('Pour donner au locataire son espace : <b>Équipe & accès › Ouvrir l\'accès locataire</b>', 3000);
  }},
  'loyer-quittance': {qui: 'agence', hash: '#/agency/dashboard', titre: 'Encaisser un loyer et remettre la quittance', espace: 'Propriétaire, Agence, Gestionnaire', async scenario(t) {
    await t.clic({texte: 'Loyers', dans: '#sidebar'}, 'Ouvrez <b>Loyers</b>');
    await t.legende('Chaque mois : payé, partiel, en retard. Le reste à payer est indiqué', 2600);
    await t.clic('[data-action="g-pay"]', 'Sur le mois concerné, cliquez sur <b>Encaisser</b>');
    await t.legende('Saisissez le montant reçu, la date et le moyen de paiement');
    await t.saisir('.modal [name="amount"]', '200000');
    await t.choisir('.modal [name="method"]', 'Wave');
    await t.affiche();
    await t.clic({texte: 'Enregistrer le paiement', dans: '.modal'});
    await t.legende('Le loyer passe à « Payé ». Un paiement partiel est aussi accepté', 2400);
    await t.clic('[data-action="g-receipt"]', 'Cliquez sur <b>Quittance</b>');
    await t.legende('La quittance est prête : <b>Télécharger le PDF</b> pour l\'envoyer au locataire', 3000);
    await t.fermer();
  }},
  'devis-facture': {qui: 'agence', hash: '#/agency/dashboard', titre: 'Faire un devis puis une facture', espace: 'Propriétaire, Agence, Gestionnaire', async scenario(t) {
    await t.clic({texte: 'Devis & Factures', dans: '#sidebar'}, 'Ouvrez <b>Devis & Factures</b>');
    await t.clic({texte: '+ Devis', dans: '#app'}, 'Cliquez sur <b>+ Devis</b>');
    await t.legende('Le client, puis les lignes : désignation, quantité, prix');
    await t.saisir('.modal [name="client"]', 'Société Teranga Services');
    await t.saisir('.modal [name="clientPhone"]', '338201234');
    await t.saisir('.modal [name="l0"]', 'Frais de dossier');
    await t.saisir('.modal [name="q0"]', '1');
    await t.saisir('.modal [name="p0"]', '50000');
    await t.saisir('.modal [name="l1"]', 'État des lieux');
    await t.saisir('.modal [name="q1"]', '1');
    await t.saisir('.modal [name="p1"]', '25000');
    await t.choisir('.modal [name="tax"]', '18');
    await t.legende('Le total HT, la TVA et le total TTC s\'affichent', 2200);
    await t.affiche();
    await t.clic({texte: 'Créer', dans: '.modal'});
    await t.attendre(900);
    await t.legende('Le devis est créé : son aperçu s\'ouvre, avec le PDF à envoyer au client', 2600);
    await t.fermer();
    await t.clic('[data-action="g2-ok"]', 'Le client accepte ? Cliquez sur <b>Accepter</b>', {direct: true});
    await t.clic('[data-action="rc-dev-fac"]', 'Puis sur <b>→ Facture</b> : la facture reprend tout le devis', {direct: true});
    await t.attendre(600);
    await t.clic('[data-action="g2-view"]', 'Cliquez sur <b>Voir</b> pour l\'aperçu et le PDF', {direct: true});
    await t.legende('HT, TVA, TTC, et vos NINEA et RCCM : la facture est prête à envoyer', 3000);
    await t.fermer();
  }},
  depense: {qui: 'proprio', hash: '#/owner/dashboard', titre: 'Enregistrer une dépense', espace: 'Propriétaire, Agence, Gestionnaire', async scenario(t) {
    await t.clic({texte: 'Finances', dans: '#sidebar'}, 'Ouvrez <b>Finances</b>');
    await t.legende('Puis <b>Dépenses</b> dans le menu de la gestion');
    await t.aller('#/manage/expenses');
    await t.defilerVers('form[data-action="g2-expense"]');
    await t.legende('Le bien, le fournisseur, la catégorie et le montant');
    await t.choisir('form[data-action="g2-expense"] [name="propertyId"]', 'c0000000-0000-4000-8000-000000000011');
    await t.saisir('form[data-action="g2-expense"] [name="supplier"]', 'Plomberie Diop');
    await t.choisir('form[data-action="g2-expense"] [name="cat"]', {index: 1});
    await t.saisir('form[data-action="g2-expense"] [name="amount"]', '45000');
    await t.choisir('form[data-action="g2-expense"] [name="method"]', 'Wave');
    await t.legende('Joignez la facture du fournisseur (photo ou PDF)');
    await t.page.locator('form[data-action="g2-expense"] [name="proof"]').setInputFiles(path.join(RACINE, PH('bureau'))).catch(() => {});
    await t.affiche();
    await t.clic({texte: 'Enregistrer la dépense', dans: '#app'});
    await t.legende('La dépense compte dans vos finances et, pour un mandant, dans son relevé', 2800);
  }},
  equipe: {qui: 'agence', hash: '#/agency/dashboard', titre: 'Ajouter un membre à l\'équipe', espace: 'Agence, Propriétaire', async scenario(t) {
    await t.clic({texte: 'Équipe', dans: '#sidebar'}, 'Ouvrez <b>Équipe</b>');
    await t.clic({texte: 'Ajouter un membre', dans: '#app'}, 'Cliquez sur <b>Ajouter un membre</b>');
    await t.defilerVers('form[data-action="g4-member"]');
    await t.legende('Son nom, son e-mail (son identifiant) et son téléphone');
    await t.saisir('form[data-action="g4-member"] [name="firstName"]', 'Cheikh');
    await t.saisir('form[data-action="g4-member"] [name="lastName"]', 'Fall');
    await t.saisir('form[data-action="g4-member"] [name="email"]', 'cheikh.fall@exemple.sn', {lent: 25});
    await t.saisir('form[data-action="g4-member"] [name="phone"]', '776665544');
    await t.choisir('form[data-action="g4-member"] [name="role"]', 'agent');
    await t.legende('Cochez ce qu\'il peut faire : biens, visites, messages…');
    await t.cocher('form[data-action="g4-member"] [name="perm_biens"]');
    await t.cocher('form[data-action="g4-member"] [name="perm_visites"]');
    await t.cocher('form[data-action="g4-member"] [name="perm_messages"]');
    await t.clic({texte: 'Créer le compte', dans: 'form[data-action="g4-member"]'});
    await t.attendre(1200);
    await t.legende('Ses identifiants s\'affichent : envoyez-les par <b>WhatsApp</b> ou e-mail', 3200);
    await t.affiche();
    await t.fermer();
    await t.legende('Sur sa ligne : <b>Droits</b> et <b>Nouveau mot de passe</b> restent disponibles', 3000);
  }},
  mandant: {qui: 'agence', hash: '#/agency/dashboard', titre: 'Ajouter un propriétaire et lui ouvrir son espace', espace: 'Agence', async scenario(t) {
    await t.clic({texte: 'Propriétaires', dans: '#sidebar'}, 'Ouvrez <b>Propriétaires</b>');
    await t.defilerVers('form[data-action="g9-owner"]');
    await t.legende('Le propriétaire qui vous confie ses biens : nom, téléphone, e-mail, commission');
    await t.saisir('form[data-action="g9-owner"] [name="name"]', 'Fatou Diagne');
    await t.saisir('form[data-action="g9-owner"] [name="phone"]', '775554433');
    await t.saisir('form[data-action="g9-owner"] [name="email"]', 'fatou.diagne@exemple.sn', {lent: 25});
    await t.saisir('form[data-action="g9-owner"] [name="rate"]', '8');
    await t.clic({texte: 'Ajouter', dans: 'form[data-action="g9-owner"]'});
    await t.attendre(800);
    await t.clic('[data-action="g9-ofiche"]', 'Ouvrez sa <b>Fiche</b>');
    await t.legende('Rattachez-lui ses biens : ses loyers et dépenses iront dans son relevé', 2600);
    await t.siPresent('.modal [name="propertyId"]', async () => { await t.choisir('.modal [name="propertyId"]', {index: 1}); await t.clic({texte: 'Rattacher', dans: '.modal'}); });
    await t.fermer();
    await t.siPresent({texte: 'Ouvrir l\'accès', dans: '#app'}, async () => { await t.clic({texte: 'Ouvrir l\'accès', dans: '#app'}, '<b>Ouvrir l\'accès</b> lui crée son espace en lecture seule'); await t.clic({texte: 'Valider', dans: '.modal'}); await t.attendre(1200); await t.legende('Ses identifiants s\'affichent : transmettez-les par WhatsApp ou e-mail', 2800); await t.affiche(); await t.fermer(); });
    await t.legende('Il voit ses biens, ses loyers et ses relevés, sans pouvoir les modifier', 3000);
  }},
  mandat: {qui: 'agence', hash: '#/agency/dashboard', titre: 'Créer un mandat de gestion', espace: 'Agence', preparer: D => { D.mandates = []; }, async scenario(t) {
    await t.clic({texte: 'Mandats', dans: '#sidebar'}, 'Ouvrez <b>Mandats</b>');
    await t.defilerVers('form[data-action="m-new"]');
    await t.legende('Choisissez le propriétaire : sa commission est reprise');
    await t.choisir('form[data-action="m-new"] [name="ownerId2"]', {index: 0});
    await t.legende('Cochez les biens confiés et les services');
    await t.cocher('form[data-action="m-new"] [name^="p_"]');
    await t.cocher('form[data-action="m-new"] [name="s_0"]');
    await t.cocher('form[data-action="m-new"] [name="s_1"]');
    await t.saisir('form[data-action="m-new"] [name="start"]', '2026-12-01', {lent: 20});
    await t.saisir('form[data-action="m-new"] [name="end"]', '2027-11-30', {lent: 20});
    await t.affiche();
    await t.clic({texte: 'Créer le mandat', dans: '#app'});
    await t.clic('[data-action="m-view"]', 'Cliquez sur <b>Voir</b> pour l\'aperçu et le PDF à faire signer');
    await t.attendre(1500);
    await t.legende('Mandant, mandataire (NINEA, RCCM), biens, commission et durée', 3000);
    await t.fermer();
  }},
  reversement: {qui: 'agence', hash: '#/agency/dashboard', titre: 'Relevé et reversement au propriétaire', espace: 'Agence', async scenario(t) {
    await t.clic({texte: 'Reversements', dans: '#sidebar'}, 'Ouvrez <b>Reversements</b>');
    await t.legende('Pour chaque propriétaire : encaissé, dépenses, commission et solde à reverser', 3000);
    await t.affiche();
    await t.clic('[data-action="t-pay"]', 'Après le virement, cliquez sur <b>Reverser</b>');
    await t.choisir('.modal [name="method"]', 'Wave');
    await t.saisir('.modal [name="ref"]', 'WAVE-2611-001');
    await t.clic({texte: 'Enregistrer le reversement', dans: '.modal'});
    await t.legende('Le reversement est noté ; le propriétaire le voit dans <b>Mes relevés</b>', 3000);
  }},
  locataire: {qui: 'locataire', hash: '#/tenant/home', titre: 'Mon logement : bail, loyers et paiements', espace: 'Locataire', async scenario(t) {
    await t.legende('<b>Mon logement</b> résume votre situation', 2200);
    await t.defilerVers('.rc-bail-loc');
    await t.legende('Votre bail : loyer, caution, échéance, bailleur. Le contrat est en PDF', 3000);
    await t.affiche();
    await t.clic({texte: 'Mon loyer', dans: '#sidebar'}, '<b>Mon loyer</b> : chaque mois et ce qui reste à payer');
    await t.attendre(1500);
    await t.clic({texte: 'Mes paiements', dans: '#sidebar'}, '<b>Mes paiements</b> : tous vos versements, acomptes compris');
    await t.attendre(1500);
    await t.clic({texte: 'Mes quittances', dans: '#sidebar'}, '<b>Mes quittances</b> : vos reçus, à télécharger en PDF');
    await t.attendre(1800);
  }},
  maintenance: {qui: 'locataire', hash: '#/tenant/home', titre: 'Signaler un problème dans le logement', espace: 'Locataire', async scenario(t) {
    await t.clic({texte: 'Maintenance', dans: '#sidebar'}, 'Ouvrez <b>Maintenance</b>');
    await t.legende('Décrivez le problème : titre, catégorie, urgence');
    await t.saisir('form[data-action="t-ticket"] [name="title"]', 'Fuite sous l\'évier de la cuisine');
    await t.choisir('form[data-action="t-ticket"] [name="category"]', 'Plomberie');
    await t.choisir('form[data-action="t-ticket"] [name="priority"]', 'urgente');
    await t.saisir('form[data-action="t-ticket"] [name="note"]', 'L\'eau coule depuis ce matin quand on ouvre le robinet.', {lent: 20});
    await t.legende('Ajoutez une photo : la réparation sera plus rapide');
    await t.page.locator('form[data-action="t-ticket"] [name="photo"]').setInputFiles(path.join(RACINE, PH('local1'))).catch(() => {});
    await t.affiche();
    await t.clic({texte: 'Envoyer', dans: 'form[data-action="t-ticket"]'});
    await t.attendre(800);
    await t.legende('Votre bailleur est prévenu. Suivez l\'avancement : Nouvelle → En cours → Terminée', 3200);
    await t.fermer();
  }},
  'mandant-releves': {qui: 'mandant', hash: '#/owner/dashboard', titre: 'Suivre mes biens et mes relevés', espace: 'Propriétaire avec agence', async scenario(t) {
    await t.clic({texte: 'Mes biens confiés', dans: '#sidebar'}, 'Ouvrez <b>Mes biens confiés</b>');
    await t.legende('Chaque bien : son locataire, son loyer et les retards éventuels', 2600);
    await t.clic('a.rc-bien', 'Cliquez sur un bien pour le détail');
    await t.defiler(420, 1200);
    await t.legende('Le bail, les loyers mois par mois et les dépenses engagées', 2800);
    await t.affiche();
    await t.clic({texte: 'Mes relevés', dans: '#sidebar'}, '<b>Mes relevés</b> : ce que l\'agence a encaissé pour vous');
    await t.legende('Encaissé, commission de l\'agence, dépenses et net à vous reverser', 3000);
  }},
  'profil-cni': {qui: 'client', hash: '#/client/dashboard', titre: 'Mon profil, mot de passe et CNI', espace: 'Tous les espaces', async scenario(t) {
    await t.clic({texte: 'Mon profil', dans: '#sidebar'}, 'Ouvrez <b>Mon profil</b> (ou <b>Paramètres</b>)');
    await t.legende('Mettez à jour vos coordonnées et votre photo');
    await t.saisir('#app [name="phone"]', '771112233');
    await t.siPresent('#app [name="cni"]', async () => { await t.legende('Votre numéro de CNI (13 chiffres) : il est demandé avant de publier une annonce'); await t.saisir('#app [name="cni"]', '1987654321098'); });
    await t.affiche();
    await t.clic('#app form button[type="submit"], #app form .btn:not(.ghost)', 'Puis enregistrez');
    await t.defilerVers('#app >> text=Changer mon mot de passe');
    await t.legende('Pour changer de mot de passe : <b>Changer mon mot de passe</b>, juste en dessous', 3200);
  }}
};

(async () => {
  fs.mkdirSync(SORTIE, {recursive: true});
  const voulues = process.argv.slice(2), ids = voulues.length ? voulues : Object.keys(SCENES);
  for (const id of ids) {
    const sc = SCENES[id]; if (!sc) { console.log('inconnue :', id); continue; }
    try {
      const r = await filmer({id, sortie: SORTIE, preparer: prep(sc.preparer), ...sc});
      console.log(`OK  ${id} : ${r.duree.toFixed(1)} s, ${(r.taille / 1024).toFixed(0)} Ko, ${r.images} images${r.erreurs.length ? ' · erreurs page : ' + r.erreurs.slice(0, 3).join(' / ') : ''}`);
    } catch (e) { console.log(`ÉCHEC ${id} : ${e.message.split('\n')[0]}`); }
  }
  arreter();
})();

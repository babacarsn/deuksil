# DEUKSIL — Historique des modifications

## 26 novembre 2026 — Aide : tutoriels vidéo

- **Chargement à la demande** : les pages ne chargent que 3 Ko pour l'aide ; le code de la page Aide (19 Ko) et les vignettes ne sont téléchargés qu'à la première visite de « Aide », et une vidéo seulement quand on ouvre son tutoriel. Vignettes réduites à 640 px (1,3 Mo → 330 Ko).
- Bouton **« Aide »** à la fin du menu de chaque espace (ordinateur et téléphone) et dans l'en-tête du site public.
- Page **`#/aide`** : les tutoriels de l'espace de la personne en premier, onglets pour les autres espaces, recherche (« facture », « visite »…), lecteur vidéo avec les étapes écrites et un bouton « Ouvrir cet écran » ; lien direct `#/aide?video=<id>`.
- **18 vidéos** (`videos/guides/`) tournées sur l'application avec des données fictives : rechercher, favoris et alertes, demander une visite, créer son compte, publier un bien, visites, bail, encaisser un loyer et quittance, devis puis facture, dépense, équipe, propriétaire mandant, mandat, reversement, espace locataire, maintenance, relevés du mandant, profil et CNI.
- Outils de tournage : `tests/videos/` (studio et scénarios, à rejouer quand un écran change) ; le banc d'essai sert les photos déposées et charge en 2 s.
- Le site publie désormais le dossier `videos/` (vercel.json) ; le service worker ne met pas les vidéos en cache.
- « Bonjour, <nom de l'agence> » sur le tableau de bord de l'agence.

## 22 novembre 2026 — corrections de la recette (6 fichiers UAT testés)

- **PDF** : jsPDF est servi par le site (`js/vendor/`), la CSP bloquait la copie cdnjs ; message clair si la génération échoue. Tous les PDF (quittances, devis, factures, reçus, mandats, rapports, contrat de bail) fonctionnent.
- **Relevé du mandant** : les loyers portent désormais leur bien (migration `20261122000100`) ; le mandant voit les mêmes montants que l'agence. Une facture de l'agence n'est plus comptée dans l'argent du mandant (case « pour le compte du propriétaire »).
- **Espace mandant** : « Mes biens confiés » en lecture seule, fiche de chaque bien avec bail, loyers et dépenses ; plus de Modifier / Pause / Ajouter.
- **Session expirée** : renouvellement automatique puis message « reconnectez-vous » (gerer-acces, assistant) ; « Se déconnecter » vide la session même si le serveur répond 403 et ramène à l'accueil ; plus de faux « Membre créé » au journal.
- **Documents** : HT / TVA / TTC, la TVA suit le devis jusqu'à la facture, « Devis → Facture » direct, NINEA / RCCM / adresse sur les aperçus et PDF, quittance « pour le compte de » ; total affiché dans le formulaire.
- **Finances** : revenus par mois avec les acomptes ; résultat de l'agence = commissions + factures + honoraires (pas les loyers des mandants) ; honoraires créés à chaque bail d'agence ; caution « attendue » jusqu'à sa réception ; compteurs justes dans l'accueil Gestion.
- **Comptes** : « Nouveau mot de passe » sur chaque compte ouvert (agent, gestionnaire, locataire, mandant), droits d'un membre modifiables, adresse de connexion = site utilisé.
- **Locataire** : arrivée sur « Mon logement », libellé « Locataire », bloc « Mon bail » (caution, bailleur), contrat de bail PDF, « Mes paiements » au menu, bandeau de retard juste (acomptes déduits), maintenance avec urgence, description, photo et confirmation.
- **Public** : contact enregistré avec accusé, toutes les erreurs affichées d'un coup ; inscription avec une adresse déjà utilisée signalée ; message adapté à chaque action d'un visiteur (affiché sur la page de connexion) ; signalement sans compte ; fiche d'un bien : adresse sans répétition, « Voir sur une carte », partager (WhatsApp, lien), référence lisible, badges cohérents, pas de « 0 chambre », vues des visiteurs comptées, actions de propriétaire sur sa propre annonce, barre d'action fixe sur téléphone ; recherche : « Créer une alerte » et case « Comparer ».
- **Formulaires** : astérisques sur les champs obligatoires, message en français sous le champ, plus de quartier « Almadies » ni de « 0 chambre » pré-remplis, CNI invraisemblable refusée, photos en trop signalées, la page ne remonte plus en haut après une mise à jour.
- **Divers** : relance d'impayé confirmée (une par jour), mandat sans modification cachée de la commission de la fiche (pré-remplie), visite acceptée sur un bien loué sans changer son statut, fin de bail « remettre en location » cochée, nom de l'agence et de l'agent affichés, titre d'onglet sans doublon, bulle de l'assistant plus discrète sur téléphone.
- Fonction `gerer-acces` : nouveau mot de passe toujours possible pour un membre de l'équipe.

## 12 novembre 2026 (3) — Branche « test » et nouvelle recette

- Branche `test` : version à tester avant publication ; adresse Vercel stable https://deuksil-git-test-babacarsns-projects.vercel.app
- Recette utilisateur mise à jour (`tests/uat/`) : 9 fichiers (dont un nouveau pour le propriétaire mandant) + `00_Comptes_de_test.xlsx` (comptes à créer, prérequis Supabase). 270 tests, chemins d'accès ordinateur et téléphone.
- Menu ordinateur : les entrées de la barre du bas gardent l'ordre de la barre (Gestion puis Messages).
- Recette rangée dans l'ordre de test, étape par étape (colonne « Étape »), et `README_CONFIGURATION_SUPABASE.md` : ce qu'il faut configurer dans Supabase pour les modifications des 11 et 12 novembre.

## 12 novembre 2026 (2) — Menu ordinateur, comptes et relations

Détail : `docs/COMPTES_ET_RELATIONS.md`.
- **Menu latéral (ordinateur seulement)** : reprend tout ce que la barre du bas du téléphone affiche, lu dans la barre elle-même. Le téléphone (barre du bas et tiroir) n'est plus modifié.
- **Mandant** : sa fiche est enfin reliée à son compte à l'ouverture de l'accès (il voyait un espace vide). Migration `20261112000200_relations_comptes.sql`, avec réparation des mandants existants.
- **Identifiants** : fenêtre « Accès créé : identifiants à transmettre » (adresse, identifiant, mot de passe provisoire ; Copier, WhatsApp, e-mail) pour agent, gestionnaire, mandant, locataire.
- **Équipe** : bouton « Nouveau mot de passe » pour les agents et gestionnaires qui ne se sont pas encore connectés.
- Message clair si la fonction serveur `gerer-acces` n'est pas déployée ou est injoignable.
- Tests : 34 scénarios de relations en base (agent, gestionnaire, mandant, locataire, isolement entre agences, sécurité de la liaison), 43 cas côté site.

## 12 novembre 2026 — Audit de la CNI (tous les comptes)

Détail : `docs/AUDIT_CNI.md`.
- **Doublon de CNI** (cause la plus fréquente de « CNI non renseignée alors qu'on l'a saisie ») : message clair « déjà utilisé par un autre compte », côté site et côté base ; fenêtre « CNI non enregistrée » après la réponse du serveur au lieu de « Profil mis à jour ».
- **Formulaire du bien** : la CNI est demandée avant le récapitulatif « Publier cette annonce ? », qui refermait aussitôt le formulaire de CNI.
- **Bouton Publier d'une carte** : succès annoncé seulement après confirmation du serveur.
- Message d'échec d'enregistrement d'une annonce selon la vraie cause (plus de « vérifiez la connexion » à tort).
- Formulaire d'équipe : la CNI d'un membre est sans effet sur la publication (précision affichée).
- **Migration `20261112000100_cni_fiabilite.sql`** : message de refus juste (titulaire / membre, « Paramètres »), refus clair d'une CNI déjà utilisée, fonction `public.cni_espace_renseignee()`. Aucune suppression. Option désactivée : une CNI par type de compte.
- Tests : 22 scénarios SQL (`supabase/tests-cni/`), 27 cas côté site (`tests/test-menus-cni.js`).

## 11 novembre 2026 — Correctifs de la recette (UAT Agence)

- **CNI** : au clic sur « Publier », si la CNI du compte manque, un formulaire s'ouvre (13 chiffres, refus clair d'un numéro invalide ou déjà utilisé) ; la publication reprend toute seule après enregistrement. Un agent est informé que le titulaire du compte doit la renseigner. La CNI se renseigne aussi dans **Paramètres de l'agence** (nouvelle carte, avec lien vers « Mes informations » : NINEA, RCCM). Avant : le message renvoyait vers « Mon profil », page absente du menu de l'agence. Règle côté base inchangée (migration 20261028000100).
- **Menus** : tout ce que la barre du bas montre sur téléphone figure aussi dans le menu latéral de l'ordinateur (Publier un bien, Gestion, Messages…), pour propriétaire, agence, agent, gestionnaire et mandant. Calcul automatique à partir des barres (`js/99n-menus-cni.js`).
- **Agence** : « Visites » et « Équipe » reviennent dans le menu latéral (création des agents introuvable).
- **CNI affichée mais refusée par le serveur** : le site se resynchronise (le formulaire de CNI réapparaît) et affiche la vraie raison d'un refus (CNI déjà utilisée, écriture refusée…). Diagnostic : `docs/CORRECTIFS_UAT_AGENCE.md` §5.
- Aucune migration SQL. Voir `docs/CORRECTIFS_UAT_AGENCE.md` pour les contrôles Supabase.
- Outil de versionnage : empreintes indépendantes des fins de ligne (Windows/Linux) ; `.gitattributes` impose LF dans le dépôt.

## 3 novembre 2026 — Assistant qui consulte et agit ; mode clair seul

### Assistant de l'espace (docs/ASSISTANT_IA.md)
- L'assistant d'un utilisateur connecté lit **toute la base visible par son compte**, à la demande, au lieu d'un résumé tronqué. Il couvre 32 collections (biens, baux, loyers, pièces, paiements, dépenses, contrats, travaux, ventes, mandants, mandats, états des lieux, visites, journal…), avec une lecture détaillée de tous les champs. L'administration lit tous les espaces.
- Il **répond à toutes les questions** : sur les données (toujours lues, jamais inventées), sur DEUKSIL et sur tout autre sujet (avec ses connaissances, en signalant l'incertitude).
- Il filtre, trie et **calcule** (sommes, moyennes, comptes, regroupements par mois) dans l'application.
- Il **agit avec confirmation** : facture, devis, proforma, conversion, avoir, encaissement de facture ou de loyer (acompte compris), relance, dépense, intervention, visite, bail, modification ou création de bien, dossier de vente. Client : demande de visite, favori. Locataire : signalement.
  - Rien n'est écrit sans un clic sur « Confirmer ».
  - Mêmes contrôles et mêmes règles de base (RLS) que les écrans ; droits des membres d'équipe respectés ; aucune suppression.
- Fonction `assistant-ia` : nouveau mode `agent`.
  - Connexion et offre payante obligatoires.
  - Consignes et outils fixés côté serveur ; conversation contrôlée en forme et en taille.
  - Signatures de raisonnement renvoyées intactes.
- Sans offre payante déclarée, l'application revient automatiquement à l'ancien assistant.
- Tests : `tests/ia-agent.js`, 26/26, avec un faux Gemini. Le vrai modèle reste à essayer en recette.
- Réponse locale corrigée : une annonce n'attend pas de validation avant d'apparaître dans la recherche.

### Corrections trouvées par l'analyse complète (balayage de toutes les pages et de tous les boutons)
- Profil d'un locataire : « Type undefined » affiché ; affiche maintenant « Client » (même libellé que le menu).
- Administration : refuser une annonce, ou toute modification faite dans l'espace d'un autre, écrivait dans le journal de cet espace ; la base le refusait (403) et un message d'erreur apparaissait. Le journal détaillé n'est plus écrit hors de son propre espace.
- Ventes : un membre d'équipe sans le droit « finances » voyait « Émettre la facture » et « Encaisser » ; la base refusait (403). Les boutons sont masqués pour lui (la référence de la facture reste affichée), et l'action est refusée avec un message clair.
- Interventions : un membre sans le droit « finances » qui clôturait une intervention avec un coût déclenchait la création d'une dépense refusée (403). L'intervention est clôturée avec son coût, et un message indique que la dépense est à saisir par une personne ayant accès aux finances.
- Annonces : un membre d'équipe qui ajoutait un favori ou demandait une visite recevait un refus de la base (403). Ces actions personnelles lui sont maintenant refusées avec un message clair (compte client personnel).
- Fonction `assistant-ia` : limite de 40 demandes par minute et par adresse IP (réglable par `DEUKSIL_IA_PAR_MINUTE`), pour protéger la clé Gemini contre un usage abusif.
- Nouveau test `tests/balayage.js` : chaque page atteignable de chaque profil, sur ordinateur et sur téléphone, puis chaque bouton et les boutons des fenêtres ouvertes. Il signale erreurs JavaScript, refus de la base, textes « undefined / NaN / null », pages vides, débordements et images cassées.

### Corrections trouvées par l'analyse du 3 novembre (assistant)
- « Compter » (combien de biens, de loyers…) échouait dès qu'une collection avait des lignes : corrigé, et testé sur les 32 collections de chaque profil.
- « Nouvelle conversation » ou déconnexion pendant une carte « Confirmer » : la conversation suivante pouvait partir dans un état invalide. L'échange en cours est maintenant arrêté proprement, sans écriture.
- Après une erreur au milieu d'un échange (réseau, refus), la conversation envoyée au modèle restait incohérente : l'échange inachevé est retiré.
- Longues conversations : les anciens résultats d'outils sont allégés, pour ne pas atteindre la limite du serveur.
- Administration : lecture des mandants, honoraires et demandes de clients de tous les espaces.

### Affichage
- Mode clair seul. L'application l'imposait déjà ; la page de démonstration n'a plus de variante sombre.

## 3 novembre 2026 — Contrat, performance, démonstration, tests, documentation (phases 5 à 10)

### Performance (mesures : docs/PERFORMANCES.md)
- **Accueil visiteur, 24 000 annonces, mobile ralenti : 246,6 s → 7,8 s** avant le premier écran.
  - Cause : `DB.findItem` recopiait chaque élément avant de le tester, une fois par annonce (93 % du temps, profil CPU).
  - Le prédicat lit désormais la mémoire ; seul le résultat est copié.
- **`published()`** : résultat gardé tant que biens, unités, baux et comptes n'ont pas changé ; `listable` et `ownerSubscriptionActive` lisent sans copie. Propriétaire : 14,8 s → 7,0 s.
- **Catalogue progressif** pour le visiteur, le client et le locataire : 48 annonces pour le premier écran, le reste en arrière-plan. Les écrans qui ont besoin de tout attendent (squelette) au lieu de montrer des résultats partiels.
- **Lecture des tables** par pages de 1 000, 4 en parallèle, tri complété par l'identifiant.
- **Annuaire** : lu par pages. PostgREST le tronquait à 1 000 propriétaires et agences.
- **Cache** : fichiers `js/` et `css/` versionnés (`outils/versionner-site.js`), gardés un an (`vercel.json`) ; service worker adapté ; détection des mises à jour par `index.html` seul. Visite répétée : 51 Ko et 1,5 s.

### Sécurité
- En-têtes HTTP (`vercel.json`) : `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`.

### Photos
- Traitement extrait dans `js/00-photos-traitement.js`, partagé avec la démonstration.
- Contrôle d'intégrité JPEG : les « photos animées » (vidéo ajoutée après l'image) sont acceptées, et un JPEG tronqué derrière une miniature EXIF est refusé.

### Ajouts
- `DEMO/index.html` : démonstration indépendante. Vraie compression des fichiers choisis, envoi simulé et signalé comme tel, galerie, refus, limite de 20.
- Tests :
  - `tests/chargement.js` (9) ;
  - `tests/versions.js` (4) ;
  - `supabase/tests-local/perf/chargement.js` (mesures dans le navigateur).
- Passerelle de la réplique : mode `HEBERGEMENT=1` (compression, ETag / 304, règles de `vercel.json`).
- Documentation :
  - `docs/ARCHITECTURE.md`, `FRONTEND.md`, `BACKEND.md`, `DATABASE.md`, `STORAGE.md`, `SECURITY.md` ;
  - `docs/CONTRACT_FRONTEND_BACKEND.md`, `TESTS.md`, `PLAN_DEPLOIEMENT.md` ;
  - `AUDIT_COMPLET.md`.

### Limites connues
- Écrans d'administration avec un très gros volume : non utilisables (≈ 1 million de lignes chargées). Pagination côté serveur à prévoir.
- Le visiteur télécharge encore tout le catalogue, en arrière-plan.

## 2 novembre 2026 — Photos des biens (phases 2 à 4)

Détail : [docs/IMAGES.md](docs/IMAGES.md). Audit préalable : `AUDIT_COMPLET.md`.

### Corrections

- **Envoi des photos et photos de profil refusé** (« Action non autorisée ») :
  - cause : `upsert: true` sans politique SELECT sur les compartiments publics ;
  - correction : `upsert: false` pour `photos` et `avatars` (`js/03-storage.js`, `js/99k-photos.js`) ;
  - le compartiment `documents` garde son comportement.
- **Annonce perdue** quand un envoi échouait, après un faux « Annonce publiée » :
  - l'annonce n'est enregistrée qu'une fois les photos envoyées ;
  - on ne quitte le formulaire qu'après la confirmation de la base ;
  - en cas d'échec, la saisie reste à l'écran.
- **Fiche : seules 3 photos sur 20 visibles** : galerie complète et visionneuse.
- **Lien « Modifier » d'un bien** → « Cette adresse n'existe pas » : la route n'acceptait pas les tirets des UUID (`js/24-espace-proprietaire.js`).
- **Injection d'attribut** par une URL de photo non échappée (`photoHtml`, `propertyCard`) : URL échappées, et forme contrôlée en base.
- **Fichiers non image ignorés sans message**, JPEG tronqué accepté : contrôle du vrai format et de l'intégrité, motif affiché.
- **Agent** pouvant supprimer, par l'API, les photos des biens de ses collègues : interdit.
- **Fichiers orphelins** jamais supprimés : file de suppression et nettoyage planifié.
- **Suppression de fichier sans effet** pour un utilisateur (pas de politique de lecture) : lecture de ses propres fichiers ouverte à l'API, rien de plus.

### Ajouts

- `js/99k-photos.js`, `css/04-photos.css` :
  - variantes 480 / 960 / 1 600 px, en WebP ou JPEG ;
  - envoi avec progression réelle ;
  - reprise par photo ;
  - couverture, ordre, remplacement ;
  - `srcset` ;
  - placeholder, image de repli ;
  - visionneuse.
- Migration `supabase/migrations/20261102000100_photos.sql` :
  - `properties.photos_meta` ;
  - contrôles des photos ;
  - politiques Storage resserrées ;
  - file `app.fichiers_a_supprimer` ;
  - fonctions `nettoyage_*` réservées à `service_role`.
- Fonction Edge `supabase/functions/nettoyer-fichiers` : mode simulation, secret `DEUKSIL_CLE_NETTOYAGE`.
- Tests `tests/photos.js` : 27 cas (formulaire, échecs, affichage, sécurité, nettoyage), tous réussis sur la réplique ; suites existantes inchangées et réussies (RLS 65/65, formulaires 27/27, CNI 13/13, accès 14/14, sonde 9 profils, aucune écriture inattendue, aucune injection).
- Outillage local :
  - la passerelle de la réplique accepte le multipart de supabase-js et le type WebP ;
  - `fonction-nettoyage-locale.ts`.

### Inchangé

- Design, couleurs, typographie ; limite de 20 photos (interface + base).
- `properties.photos` et tous les écrans qui la lisent.
- Anciennes photos : toujours affichées, modifiables, et supprimées par le nettoyage quand elles sont retirées.

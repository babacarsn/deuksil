# DEUKSIL — Audit avant simplification et finalisation

Date : 18 octobre 2026. Base auditée : commit `be3eb15` (étiquette Git `avant-finalisation`).

## 1. Ce qu'est l'application

- **Technologie** : application web monopage en JavaScript sans framework. `index.html` charge 95 modules `js/NN-nom.js` dans l'ordre et 2 feuilles de style (`css/01-base.css`, `css/02-refonte.css`). Les modules plus récents complètent les plus anciens : ils remplacent des fonctions ou des routes, ou ajoutent des écouteurs.
- **Fichiers non chargés** : 8 fichiers de `js/` ne sont pas référencés par `index.html` (anciennes versions). Ils sont conservés et ne s'exécutent pas.
- **Données** : tout est stocké dans le `localStorage` du navigateur via l'objet `DB` (`js/03-storage.js`, 6 méthodes). Il n'y a ni serveur ni base de données.
- **Authentification** : connexion par numéro de CNI et mot de passe, vérifiée dans le navigateur. La session est enregistrée dans le `localStorage`.
- **Mots de passe** : stockés en clair. Tous les comptes de démonstration utilisent `demo123`.
- **Rôles** :
  - admin, propriétaire (`owner`), agence (`agency`), client, locataire (`tenant`), investisseur, promoteur ;
  - membres d'un compte (`manager` et `agent`, avec `parentId` et `perms`) ;
  - mandant : un compte propriétaire avec `ownerRec`, qui suit en lecture seule les biens qu'il a confiés à une agence.
- **Tableaux de bord et actions rapides à protéger** :
  - `js/80-tableau-proprietaire.js` (propriétaire) ;
  - `js/82-tableau-agence.js` (agence) ;
  - `js/83-tableaux.js` (admin, client, locataire) ;
  - `js/91-agent.js` (agent) ;
  - les actions rapides (`.qa-grid`, `.pd-qa`) ;
  - les animations de `js/85-animations.js` et la couche de design de `js/89-design.js`.

## 2. Problèmes constatés (vérifiés par test, classés par priorité)

| # | Priorité | Problème | Où | Preuve |
|---|---|---|---|---|
| P1 | Critique | L'inscription publique crée un compte **administrateur** si l'on modifie le choix du rôle dans la page | `js/27-actions.js` `startRegistration` (aucune liste blanche) | Sonde : rôle « admin » créé |
| P2 | Critique | Une agence qui enregistre un mandant déjà inscrit (même CNI ou téléphone) **crée un second compte** avec la même CNI. Le propriétaire est dupliqué, et ce compte en double permet à l'agence de lier quelqu'un sans son accord | `js/60-mandant.js` `compteMandant` | Sonde : 2 comptes avec la CNI 1900000000003 |
| P3 | Haute | Un agent peut **modifier, mettre en pause ou archiver le bien d'un collègue** | Route `#/owner/property/:id` (`js/38-ds3.js`) et actions `pause`, `archive`, `delete-prop` (`js/27-actions.js`) : la seule vérification est `ownerId` = compte de l'agence | Sonde : bien du collègue mis en pause |
| P4 | Haute | Formulaire d'un bien : « Terrain » est présenté comme une 3ᵉ opération à côté de Location et Vente. Pour un terrain, il demande chambres, salles de bain et équipements, et ne demande aucune information foncière (statut, référence, documents, vérification) | `js/38-ds3.js` (assistant), `js/27-actions.js` `saveProperty` | Lecture du code et rendu |
| P5 | Moyenne | Le propriétaire ne voit pas ensemble ses biens en gestion directe et ses biens confiés à une agence. Un mandant n'a qu'une seule relation possible (`ownerRec`) | `js/60-mandant.js` | Lecture du code |
| P6 | Moyenne | L'admin suspend ou réactive un compte **sans confirmation et sans trace** dans le journal | `js/27-actions.js` `user-toggle` | Sonde : 0 entrée de journal |
| P7 | Info | Limites de production (voir section 4) | Architecture | — |

### Points vérifiés et conformes

Ils ont été testés et ne demandent pas de correction :

- **Cloisonnement entre agences** : une nouvelle agence ne voit ni les biens, ni les baux, ni les loyers, ni les clients des autres.
- **Bail sur le bien d'un autre compte** (formulaire forgé) : refusé.
- **Cautions** : non comptées dans « Encaissé ». Le module Honoraires & cautions les suit à part.
- **Paiement partiel** : le solde restant est conservé (`rPaid`, `rRest`).
- **Honoraires** : un seul honoraire par bail ou par vente (`creerHonoraire`). Les encaissements et les versements de commission sont journalisés (`audit`).
- **Location et vente** : un bail n'est possible que sur un bien en location, un dossier de vente que sur un bien à vendre.
- **Messagerie entre tous les acteurs** : `tests/messagerie-acteurs.js`, 29 contrôles.
- **Liens et raccourcis** : `tests/liens-precis.js` (25 contrôles) et `tests/audit-liens.js` (463 liens, 8 profils).

## 3. Plan de correction (étape 3)

1. P1 : liste blanche des rôles à l'inscription.
2. P3 : un agent ne modifie, ne met en pause et n'archive que ses propres biens. La suppression d'un bien est réservée au responsable.
3. P4 :
   - le formulaire propose deux opérations, Location et Vente ;
   - il s'adapte au type : un terrain a son unité de surface, son statut foncier, sa référence, ses documents et son statut de vérification « non vérifié », sans chambres ;
   - le libellé du prix suit l'opération ;
   - la donnée interne `transaction: 'terrain'` est conservée, pour la recherche et les modules existants.
4. P2 et P5 :
   - aucune création de compte en double : si le mandant a déjà un compte, l'agence envoie une demande de rattachement, que le propriétaire accepte ou refuse ;
   - le propriétaire garde son compte et ses biens, et voit à part ses « Biens confiés à une agence » ;
   - la fin de la relation ne supprime ni le compte ni l'historique.
5. P6 : confirmation et journal pour la suspension et la réactivation d'un compte.

## 4. Limites qui empêchent une mise en production (non corrigeables sans serveur)

- **Aucun serveur.** Toutes les autorisations sont vérifiées dans le navigateur. Un utilisateur averti peut modifier ses données ou ses droits avec les outils du navigateur (`localStorage`).
- **Mots de passe en clair** dans le navigateur, sans hachage côté serveur, sans limitation des tentatives, sans réinitialisation par SMS ou e-mail.
- **Données propres à chaque appareil** : rien n'est partagé entre utilisateurs ni entre appareils. Un message envoyé n'arrive que si le destinataire utilise le même navigateur. C'est le fonctionnement normal d'une démonstration.
- **Paiements simulés** (PayDunya et Wave en mode démonstration) ; PDF générés dans le navigateur.
- **Comptes de démonstration** (mot de passe `demo123`) et jeu de données fictif. À conserver pour les tests, à séparer des comptes réels.
- **Vérification** : la vérification des pièces et des titres fonciers n'est que déclarative ; aucune vérification réelle n'est branchée.
- **Pour une mise en production**, il faut :
  - une API (authentification avec hachage des mots de passe, sessions sécurisées) ;
  - une base de données ;
  - des contrôles d'accès côté serveur, qui reprennent les règles de `31-rbac.js`, `91-agent.js` et `60-mandant.js` ;
  - un stockage de fichiers ;
  - de vrais paiements et de vraies notifications.

  La couche `DB` (6 méthodes) a été conçue pour être remplacée par des appels à cette API.

## 5. Corrections effectuées (étape 3) — `js/94-finalisation.js`

Toutes les corrections tiennent dans un seul module, chargé en dernier. Les tableaux de bord, les actions rapides, l'identité visuelle et les animations n'ont pas été modifiés.

| # | Correction | Commit |
|---|---|---|
| P1 | L'inscription publique n'accepte que les rôles client, propriétaire, agence, investisseur et promoteur. Une tentative refusée est inscrite au journal de la plateforme. | `P1 : …` |
| P3 | Un agent ne modifie, ne met en pause, ne publie et n'archive que les biens qui lui sont attribués : fiche de modification, boutons, actions forgées, enregistrement. La suppression d'un bien est réservée au responsable. Les boutons d'action sont retirés des biens des collègues dans la vue « Toute l'agence ». | `P3 : …` |
| P4 | Formulaire d'un bien : deux opérations, Location ou Vente. Le type « Terrain » adapte le formulaire : unité m² ou ha, statut foncier (obligatoire pour une vente), référence, viabilisation, documents disponibles ; il n'y a plus de chambres ni d'équipements. Le libellé du prix suit l'opération. La fiche publique affiche les informations foncières avec la mention « déclaré par l'annonceur · non vérifié par DEUKSIL ». La donnée `transaction: 'terrain'` est conservée. | `P4 : …` |
| P2/P5 | **Doublons :** une seule fiche par propriétaire dans une agence (CNI ou téléphone), et aucun second compte pour un propriétaire déjà inscrit : il reçoit une **demande de rattachement** qu'il accepte ou refuse. Rien ne lui est montré avant son accord. **Après l'accord :** il voit à part ses « Biens confiés à une agence » et les relevés de l'agence, et garde la gestion directe de ses propres biens. L'agence n'obtient aucun droit sur ces biens. **Fin de relation :** « Clore la relation » remplace la suppression de la fiche ; le compte et l'historique (loyers, reversements) sont conservés. | `P2/P5 : …` |
| P6 | **Suspension d'un compte :** confirmation, inscription au journal et aucune donnée supprimée. Jamais sur un compte administrateur. **Session :** une session déjà ouverte est fermée dès la suspension (avant, la vérification n'avait lieu qu'à la connexion). **Suppression définitive :** inscrite au journal. | `P6 : …` |
| S1 | Les suppressions définitives qui n'en avaient pas demandent maintenant une confirmation : dossier ou intervention de l'ancienne vue, prestataire, lot, agent. | `Confirmation …` |

## 6. Tests exécutés après les corrections (étapes 4 et 5)

Tous ont été lancés dans Chromium avec Playwright, sur l'application réelle.

- **Corrections** : `tests/finalisation.js`, **44/44**. Les contrôles sont décrits dans le fichier, un par correction.
- **Empreinte des tableaux de bord** : `tests/empreinte.js`, **56/56 identiques** à la référence d'avant les corrections. Elle couvre les 8 profils : sections, actions rapides et leurs destinations, nombre de tuiles, menu, barre du bas, animations.
- **Liens** : `tests/audit-liens.js`, **467 liens**, 8 profils, **0 problème** (aucune page inexistante, aucun refus, aucune erreur).
- **Boutons** : `tests/audit-boutons.js`, tous les boutons non destructifs de chaque page, 8 profils, **0 erreur JavaScript**. Les « aucun effet visible » restants sont des listes déroulantes, l'export CSV, le carrousel et le bouton « Précédent » à la 1ʳᵉ étape.
- **Suites existantes, toutes passées** :
  - agent 24/24, agent-pratiques 24/24, agence-metier 26/26 ;
  - messagerie-acteurs 29/29, liens-precis 25/25 ;
  - membres-acces : aucun accès anormal ;
  - regression, tableaux, recherche, espace-parcours, design-tuiles, design-montants, audit-agence : aucun échec.
- **Échec connu et attendu** : audit-proprietaire S4 « Contrôle côté serveur ». Il n'y a pas de serveur (voir section 4).
- **Remarque** : lancées toutes en même temps (16 navigateurs), quelques suites échouent par manque de temps (délais d'attente). Relancées seules, elles passent toutes. Cette exécution a aussi révélé un vrai défaut, corrigé et testé : la surface saisie en hectares était perdue si l'on attendait plus de 1,5 s sur le récapitulatif.

## 7. Risques restants et actions avant mise en production

1. **Serveur** : réaliser un serveur (API et base de données) et y reporter toutes les règles d'accès. Aujourd'hui elles ne protègent que l'interface (voir section 4).
2. **Authentification** : hacher les mots de passe ; limiter les tentatives ; prévoir la réinitialisation. Le message de connexion distingue aussi « compte inconnu » et « mot de passe incorrect » : à unifier.
3. **Comptes en double déjà présents** : ceux créés avant cette correction (mandant ayant la même CNI qu'un autre compte) ne sont pas fusionnés automatiquement. Un rapprochement manuel est nécessaire s'il en existe dans des données réelles.
4. **Données foncières** : elles restent déclaratives. Prévoir un circuit de vérification (pièces, consultation des Domaines ou du Cadastre) avant d'afficher « vérifié ».
5. **Paiements, SMS et e-mails** : les brancher sur de vrais services (aujourd'hui simulés).
6. **Comptes et données de démonstration** : ils sont clairement signalés sur la page de connexion. À séparer des comptes réels lors de la mise en production.

---

# Partie 2 — Navigation, formulaires, parcours (§5, §6, §9, §11)

## 8. Constats (mesurés)

| # | Domaine | Constat | Preuve |
|---|---|---|---|
| N1 | Formulaires | La saisie est bien conservée après une erreur. Mais les erreurs métier (CNI, téléphone, montant…) ne s'affichent que dans un bandeau temporaire, loin du champ. L'erreur du bail est générique (« Locataire et loyer sont obligatoires » alors que seul le loyer est faux) et s'affiche en bas du formulaire. | Sonde sur 7 formulaires |
| N2 | Parcours « Modifier une annonce » | Pour changer un prix, il faut traverser les 3 étapes de l'assistant, puis confirmer : 4 à 5 clics. | Bouton « Enregistrer » absent avant la dernière étape |
| N3 | Parcours « Planifier une visite » | Un propriétaire indépendant ne peut pas planifier une visite. Seules l'agence et l'agent le peuvent. Son menu n'a pas non plus d'entrée « Visites », alors que les demandes de visite sont au cœur de son activité. | Écran Visites du propriétaire, menu |
| N4 | Menus | Le même écran (`#/manage/tickets`) s'intitule « Travaux » chez le propriétaire et « Maintenance » chez le gestionnaire. La barre du bas du mandant n'a que 2 entrées, sans relevés, documents ni messages. | Empreinte des menus |
| — | Conformes | Enregistrer un paiement (bouton « Encaisser » sur chaque loyer, raccourcis filtrés), consulter un document (aperçu ou PDF direct), consulter une demande (raccourci filtré). Les choix de menu faits pour l'agence (Visites, Équipe et Gestion retirés) sont conservés. | Mesure des parcours |

## 9. Corrections de la partie 2

| # | Correction | Fichiers |
|---|---|---|
| N1 | **Erreurs sous le champ :** quand une erreur survient à l'envoi d'un formulaire, son message s'affiche aussi sous le champ en cause. Le champ est entouré de rouge, reçoit le curseur, et l'assistant revient à la bonne étape si besoin. Corriger le champ efface le message. **Règle générale :** elle s'applique à tous les formulaires, sans les modifier un par un. **Bail :** le message générique est remplacé par « Indiquez un loyer mensuel supérieur à 0 ». | `js/00-suivi-formulaire.js` (chargé en premier), `js/94-finalisation.js`, styles `.champ-err` |
| N2 | **Modifier une annonce :** « Enregistrer les modifications » est disponible à chaque étape. Une annonce en ligne reste en ligne, sans récapitulatif à confirmer. Changer un prix passe de 5 ou 6 clics à 3. La création d'un bien garde l'assistant complet. | `js/94-finalisation.js` |
| N3 | **Visites du propriétaire indépendant :** il planifie ses visites avec le même bouton et la même fenêtre que l'agence ; un client sans compte est accepté. Son menu gagne « Visites », tout comme celui de son gestionnaire. Le mandant n'est pas concerné, puisque l'agence s'occupe de ses biens. | `js/91-agent.js` (droits de la fenêtre), `js/24-espace-proprietaire.js` (nom d'un client sans compte), `js/94-finalisation.js` |
| N4 | **Un nom par écran :** « Travaux » partout, et « Locataires » mène au même écran pour le propriétaire et son gestionnaire. **Barre du bas du mandant :** elle est complète (Accueil, Biens confiés, Relevés, Documents, Messages). | `js/94-finalisation.js` |

## 10. Tests de la partie 2 (exécutés)

- **`tests/finalisation.js` : 64/64.** Il couvre les parties 1 et 2 (N1 5/5, N2 4/4, N3 6/6, N4 5/5).
- **Empreinte :** seules les 3 différences voulues apparaissent (entrée « Visites » dans les menus du propriétaire et du gestionnaire, intitulés du gestionnaire, barre du mandant). Les sections, actions rapides, tuiles et animations des tableaux de bord sont identiques. La nouvelle référence est enregistrée : **56/56**.
- **Audits :** 467 liens sur 8 profils, **0 problème** ; boutons sur 8 profils, **0 erreur JavaScript**.
- **Suites existantes :**
  - agent 24/24, agent-pratiques 24/24, agence-metier 26/26 ;
  - messagerie-acteurs 29/29, liens-precis 25/25 ;
  - membres-acces : aucun accès anormal ;
  - regression, tableaux, recherche, espace-parcours, design, audit-agence : aucun échec.
  - Seul échec : audit-proprietaire S4 (contrôle côté serveur), attendu.
- **Défaut de minutage corrigé :** lancé en même temps que tout le reste, le test P4a a vu pendant une fraction de seconde la 3ᵉ option « Terrain ». Elle est désormais masquée dès la construction de la page, plus après l'affichage.

---

# Partie 3 — Informations au bon moment, fiabilité métier (§9, §10, §12)

## 11. Constats (sondés)

| # | Constat | Preuve |
|---|---|---|
| I1 | **Bug d'état :** accepter une demande de visite sur un bien **loué** (ou vendu) le fait passer « En discussion ». C'est un état incompatible avec son bail actif. Les changements manuels de statut, eux, sont bien protégés par `78-coherence.js`. | Sonde : bien loué → « discussion » après acceptation |
| I2 | **Statut trompeur :** 12 biens loués ou vendus s'affichent « Publiée » dans les listes du propriétaire et de l'agence, et l'admin les compte comme « en ligne ». La recherche, elle, les masque à juste titre (`listable()`). L'annonceur croit donc son annonce visible alors qu'elle ne l'est pas. | Sonde : 12 annonces « publiées » sur des biens loués ou vendus |
| — | **Conformes :** une action terminée disparaît de « À traiter » (visite acceptée, travaux résolus, loyers payés, contrat renouvelé). Les encaissements sont journalisés. Aucun chiffre inventé n'est affiché : le graphique de vues à valeurs calculées (`24-espace-proprietaire.js`) appartient à un ancien tableau de bord qui n'est plus affiché, et la croissance des comptes de l'admin vient des dates réelles. Les espaces client et admin passent les audits de liens et de boutons. | Sonde, audits |

## 12. Corrections de la partie 3

| # | Correction | Fichiers |
|---|---|---|
| I1 | **Un bien engagé ne repasse jamais « En discussion » :** loué (bail actif), vendu ou archivé, quel que soit le chemin (acceptation de visite, planification…). Un bien disponible passe toujours « En discussion » quand une visite est acceptée, comme avant. La règle est posée au niveau des données. | `js/94-finalisation.js` |
| I2 | **« Publiée » veut dire « visible dans la recherche » :** dans les listes du propriétaire et de l'agence, une annonce cachée parce que le bien est loué, vendu ou sans lot libre affiche « Hors ligne · loué » (ou vendu…), avec une explication au survol. **Admin :** la tuile « Annonces publiées » ne compte plus que les annonces visibles (38 sur 52 dans les données de démonstration, contre 51 affichées avant). | `js/94-finalisation.js`, `js/83-tableaux.js` (une ligne de calcul ; la tuile n'est pas modifiée) |

## 13. Tests de la partie 3 (exécutés)

- `tests/finalisation.js` : **70/70**, parties 1 à 3. Contrôles de la partie 3 : I1 2/2, I2 3/3, I3 1/1 (« À traiter » ne garde pas un contrat renouvelé).
- Empreinte des tableaux de bord : **56/56 identiques**.
- Audits : 467 liens sur 8 profils, **0 problème** ; boutons sur 8 profils, **0 erreur JavaScript**.
- Suites existantes : toutes passées. Seul échec : audit-proprietaire S4 (contrôle côté serveur), attendu.

## 14. Ce qui reste hors de portée sans serveur

Les sections 4 et 7 restent valables : authentification sécurisée, contrôles côté serveur, base de données partagée, vrais paiements et notifications, vérification réelle des titres fonciers, rapprochement manuel d'éventuels doublons créés avant la correction P2. **L'application est prête pour des tests et des démonstrations, pas pour une mise en production.**

---

# Partie 4 — Ce qui peut être renforcé sans serveur (§8, §13)

## 15. Constats

| # | Constat | Où |
|---|---|---|
| S1 | **Mots de passe stockés en clair** dans le navigateur (`users[].password`). Deux endroits les vérifient : la connexion et le changement de mot de passe d'un agent. | `08-auth.js`, `91-agent.js` |
| S2 | **La connexion révèle si un compte existe** : « Aucun compte n'est associé… » d'un côté, « Mot de passe incorrect » de l'autre. Le nombre d'essais n'est **pas limité**. | `08-auth.js` |
| S3 | **Doublons créés avant la correction P2** (même CNI ou même téléphone) : aucun outil pour les repérer ni les rapprocher. | Espace admin |
| S4 | **Comptes de démonstration indiscernables** des comptes réels dans l'administration. La page de connexion les présente bien comme comptes de démonstration. | `#/admin/users` |

## 16. Corrections de la partie 4 — `js/95-securite.js`

| # | Correction |
|---|---|
| S1 | **Mots de passe stockés sous forme d'empreinte, jamais en clair.** Empreinte salée et répétée : SHA-256, sel aléatoire de 96 bits propre à chaque compte, 1 500 tours. Elle est calculée à chaque écriture (inscription, membre d'équipe, comptes créés par une agence ou un propriétaire, changement de mot de passe). Les comptes existants sont convertis au chargement. Le mot de passe en clair n'est jamais conservé. La fonction SHA-256 a été vérifiée contre celle de Node.js. Une vérification prend environ 9 ms. |
| S2 | **Connexion :** un seul message, « Identifiant ou mot de passe incorrect », qui ne révèle plus si un compte existe. Après 5 essais manqués sur un identifiant, il faut attendre 5 minutes ; les autres comptes ne sont pas concernés. |
| S3 | **Doublons, côté admin :** carte « Doublons possibles » dans Utilisateurs. Une même CNI est une correspondance fiable ; un même téléphone est un indice à vérifier. « Garder celui-ci » suspend l'autre compte et le relie au compte gardé (`doublonDe`). Rien n'est supprimé, le compte suspendu peut être réactivé, et la décision est journalisée. |
| S4 | **Comptes de démonstration :** ils portent le badge « Démo » dans l'administration (`demo: true`). Un compte réel créé par inscription ne l'a pas. |

**Tests :**
- `tests/securite.js` : **17/17**.
- Deux anciens tests lisaient le mot de passe en clair. Ils vérifient désormais par `verifierMotDePasse` ou par la vraie connexion, sans rien perdre de ce qu'ils contrôlent.
- Régression complète : finalisation 70/70, empreinte 56/56, agent 24/24, agent-pratiques 24/24, agence-metier 26/26, messagerie 29/29, liens-precis 25/25. Membres, regression, tableaux, recherche, parcours, design et audit-agence passent sans échec. Seul échec : S4 « côté serveur », attendu.
- Audits de liens et de boutons de l'admin : 0 problème.

**Limites, à dire clairement :**
- L'empreinte protège contre la lecture directe des mots de passe dans le navigateur. Elle ne remplace pas une authentification serveur : quelqu'un qui contrôle le navigateur peut toujours modifier les données.
- La pause après 5 échecs est enregistrée dans le navigateur ; un serveur devra l'appliquer de son côté.
- Les comptes créés par une agence ou un propriétaire (mandant, locataire, agent) reçoivent toujours le mot de passe de démonstration `demo123`. En production, il faudra un lien d'activation envoyé par SMS ou par e-mail.

---

# Groupe A — Compléments faisables sans serveur

| # | Ajout | Où |
|---|---|---|
| A1 | **Changer son mot de passe**, pour tous les profils (propriétaire, client, locataire, agence, admin). L'ancien mot de passe est vérifié ; le mot de passe de démonstration est refusé. Le gestionnaire accède à « Mon profil » depuis son menu. | `js/95-securite.js` |
| A2 | **Mot de passe provisoire :** un compte réel créé par un tiers (mandant, locataire, membre d'équipe) reçoit un mot de passe aléatoire. Il est montré une seule fois au créateur et n'est jamais stocké en clair. À la première connexion, la personne doit choisir le sien avant d'accéder à quoi que ce soit. Le créateur peut en générer un nouveau tant que la personne n'a pas choisi le sien. Les comptes de démonstration gardent `demo123`. | `js/95-securite.js` |
| A3 | **Vérification foncière par l'admin** (page Vérifications) : liste des terrains, « Marquer vérifié » (les 3 contrôles sont exigés) ou refus motivé. L'annonceur est prévenu et la décision est journalisée. La mention « Vérifié par DEUKSIL » tombe si la référence, le statut ou les documents changent ; elle est conservée pour une modification sans rapport. | `js/95-securite.js` |
| A4 | **PDF :** état des lieux (entrée, ou sortie comparée à l'entrée, avec compteurs et clés) ; reçu de caution (dépôt, ou restitution avec retenues) ; facture d'honoraires (HT, TVA, TTC). Les boutons sont dans « Suivi du bail » et sur la page Honoraires, et les droits sont respectés (un agent sans droit Finances ne peut pas éditer de facture). | `js/96-complements.js` |
| A5 | **Alerte de correspondance :** un nouveau bien en ligne qui correspond à la demande d'un client prévient l'agent qui suit ce client, une seule fois par bien. Les biens déjà proposés à la création de la demande ne déclenchent pas d'alerte. | `js/96-complements.js` |
| A6 | **Relevé du mandant :** TVA comprise dans la commission de gestion ; ventes conclues avec les honoraires à la charge du vendeur déduits (net vendeur). Corrigé au passage : après une relation close, le relevé gardait la fiche mais perdait l'historique des loyers ; il est conservé. **Reconduction tacite des baux**, désactivée par défaut, réglable dans les règles de l'agence et dans le profil du propriétaire : bail échu sans préavis prolongé de sa durée initiale (12 mois au plus), échéances créées, parties prévenues, opération journalisée, une seule fois. | `js/96-complements.js` |
| A7 | **Archivage :** 8 anciens modules non chargés déplacés dans `js/_archives/` (avec un LISEZMOI). Aucune référence ne les visait. | `js/_archives/` |

**Tests :**
- `tests/groupe-a.js` : **37/37**. Les PDF sont réellement générés : jsPDF est servi localement au navigateur de test, puis le texte des fichiers est vérifié avec `pdftotext`.
- Régression : securite 17/17, finalisation 70/70, empreinte 56/56, agent 24/24, agent-pratiques 24/24, agence-metier 26/26, messagerie 29/29, liens-precis 25/25. Membres, regression, tableaux, recherche, parcours, design et audit-agence passent sans échec. Seul échec : S4 « côté serveur », attendu.
- Audits : 476 liens sur 8 profils, **0 problème** ; boutons sur 8 profils, **0 erreur JavaScript**.
- Lancés en parallèle (9 navigateurs), recherche S1 et groupe A A1 ont échoué une fois par manque de temps. Relancés seuls, ils passent ; les attentes du test A1 ont été allongées.
- L'empreinte n'a changé que sur l'entrée « Mon profil » du gestionnaire, ajoutée exprès.

**Ce qui reste (section 7, nécessite un serveur) :** authentification et droits côté serveur, base partagée, vrais paiements, SMS et e-mails (dont l'envoi automatique du mot de passe provisoire), vérification foncière auprès des Domaines et du Cadastre, hébergement, déclaration auprès de la CDP.

## 18. Application installée (PWA) : mises à jour automatiques

- `sw.js` (service worker, « réseau d'abord ») : en ligne, chaque ouverture prend les fichiers publiés les plus récents ; hors connexion, la dernière copie sert.
- `js/99-maj.js` : à chaque retour au premier plan (au plus toutes les 2 min, et toutes les 10 min si l'application reste ouverte), comparaison des fichiers publiés (ETag / date / taille) avec ceux du démarrage. Changement → rechargement immédiat, ou bandeau « Mettre à jour » si une saisie est en cours.
- Les données (localStorage) ne sont jamais effacées par une mise à jour.
- Conditions : site servi en **https** (Netlify, Vercel, GitHub Pages…), `sw.js` à la racine à côté de `index.html`. Ne fonctionne pas dans l'aperçu claude.ai (fenêtre intégrée) ni en ouvrant le fichier en local.
- Publier une mise à jour = remplacer les fichiers sur l'hébergement. Rien d'autre à faire. Changer `VERSION` dans `sw.js` seulement si l'on modifie `sw.js` lui-même.
- Test : `tests/maj-pwa.js` (serveur local) — enregistrement, rechargement automatique après modification d'un fichier, données conservées, bandeau si saisie, ouverture hors ligne : 8/8.

## 19. Audit et finalisation de la démo (cahier « Audit et finalisation complète »)

### A. Audit réalisé (outils : `tests/audit-global.js`, `audit-liens.js`, `audit-boutons.js`)
- 9 profils (dont visiteur) × toutes les pages de menu × 3 largeurs (390, 820, 1280 px) : **aucun débordement horizontal, aucune erreur JS**, aucune image sans texte alternatif.
- Boutons : 0 erreur JS sur 8 profils ; les « sans effet visible » relevés sont des listes déroulantes, des téléchargements (CSV/PDF), des sélecteurs de fichier et des flèches de défilement (vérifiées à la main : elles défilent).
- Liens : 476 liens, 0 problème.
- Messagerie : une seule icône (bulle) partout ; liste, fil, envoi, pièces jointes, non-lus et état vide fonctionnent.
- Problèmes trouvés : titre de page identique partout, pas de description ni de balises de partage, pas de H1 sur la plupart des pages, adresse d'annonce technique (`property_001`), noms de personnes dans certaines adresses de raccourci (`?q=Tacko Samb`), lien d'annonce envoyé au client pointant vers une page privée, fiche d'un bien loué ou vendu proposant encore « Demander une visite », fin de bail remettant automatiquement le bien en location, un bien « Loué » sans bail dans les données, locataire sans « Messages » dans la barre du bas.

### B/C. Corrections (`js/98b-finitions.js`, ajustements ciblés)
- Fin de bail : nouvel état « Libération à confirmer » (absent de la recherche, propriétaire prévenu) ; case « logement libéré » dans la fenêtre de fin de bail pour remettre en location tout de suite.
- Statuts : un bien « Loué » sans bail actif passe en « Libération à confirmer ».
- Fiche publique d'un bien loué, vendu ou hors ligne : plus de visite ni de contact, message clair et lien vers les biens disponibles.
- Adresses : annonces en `#/annonce/<titre>-<référence opaque>` ; anciennes adresses redirigées ; tous les liens réécrits. Noms remplacés par un jeton dans les raccourcis. Lien WhatsApp envoyé au client = annonce publique.
- Référencement : titre, description, canonique, Open Graph, Twitter, robots par page ; JSON-LD `RealEstateListing` sur les annonces, `WebSite` + recherche sur l'accueil ; espaces privés en `noindex,nofollow` ; un H1 par page.
- Accès direct à une page privée sans connexion → connexion → retour sur la page demandée.
- Locataire : « Messages » (même icône, compteur non lu) dans la barre du bas, à la place de « Mes quittances » (accessible depuis Mon loyer et le menu).

### D. Vérification
- `tests/finitions.js` 21/21 ; toutes les suites existantes au vert ; empreinte mise à jour (seul changement : barre du locataire).

### E. Limites
- Application à routage par ancre (`#/…`) : les moteurs n'indexent pas chaque annonce séparément. Un vrai référencement demandera un rendu serveur ou un pré-rendu des pages publiques, un `sitemap.xml` et des URL sans `#` — à faire avec l'hébergement.
- Référence opaque dans l'adresse ≠ sécurité : les contrôles d'accès devront être faits par le serveur.
- Paiements, SMS, e-mails : simulés, présentés comme tels.

## 20. Retours de recette — Partie 3 (Agence et agent)
- 13 OK, 1 KO.
- **AG4 « Confier un client » (KO : bouton introuvable)** : la fonction n'existait que pour les visites (responsable), pas pour les demandes clients. Ajout d'un bouton « Confier » sur chaque demande que l'agent suit (le responsable : toutes) → choix d'un collègue actif + note → la demande passe chez le collègue, qui est prévenu ; elle disparaît des demandes de l'agent. Trois demandes de démonstration (deux suivies par Aïssatou, une par Ousmane) pour pouvoir tester tout de suite.
- Régression trouvée et corrigée au passage : depuis le passage des titres en H1, les titres « Mes biens » et « Mes clients » de l'agent ne remplaçaient plus « Portefeuille de biens » / « Clients ».
- Test : `tests/confier-client.js` 7/7.

## 21. Retours de recette — Partie 2 (Propriétaire)
- 12 OK, 2 KO.
- **P6 (KO : « je peux marquer terminée une visite pas encore arrivée »)** : le bouton « Marquer terminée » n'apparaît plus avant la date de la visite, et l'action est refusée si elle est déclenchée quand même (message avec la date prévue).
- **P10 (KO : « pas trouvé comment me lier à une agence »)** : seule l'agence pouvait proposer le rattachement. Le propriétaire peut maintenant le demander : Mon profil › « Confier la gestion à une agence » (raccourci « Confier à une agence » dans Mes biens) → choix de l'agence + message → l'agence voit la demande en tête de Gestion › Propriétaires, fixe sa commission et accepte (fiche mandant reliée au compte existant, sans second compte) ou refuse ; le propriétaire est prévenu et peut annuler une demande en attente.
- Test : `tests/recette-p2.js` 10/10.

## 22. Tableaux de bord sur ordinateur (21/10/2026)

- **Problème :** sur grand écran, les blocs des tableaux de bord étaient alignés par rangées, ce qui laissait de grands vides sous le graphique et sous « Mon portefeuille ». Les compteurs et les actions rapides étaient aussi très hauts.
- **Correction :** `js/99c-bureau.js` et `css/03-bureau.css`, actifs uniquement au-delà de 900 px de large.
  - Les blocs sont répartis en deux colonnes indépendantes, et le dernier bloc de chaque colonne s'étire pour que les deux colonnes finissent à la même hauteur.
  - Dans « À traiter », la flèche est alignée au bord droit.
  - Le tableau de l'agent passe sur deux colonnes.
  - « Mon espace » (client) affiche ses quatre compteurs sur une ligne.
  - « Activité récente » (administration) passe sur deux colonnes.
  - À partir de 1400 px, les compteurs et les actions rapides deviennent compacts (icône à gauche).
- **Mobile inchangé :** j'ai comparé la position de chaque élément avec et sans la correction, à 360, 390, 600, 768 et 900 px. Les seules différences relevées sont des données de démo qui varient d'une exécution à l'autre.
- **Tests :**
  - la référence de `empreinte` a été refaite, car l'ordre des sections change sur ordinateur (colonne de gauche, puis colonne de droite) ;
  - le cas R5 de `regression` a été mis à jour : depuis la section 20, une fin de bail donne « libération à confirmer ».

## 23. Œil sur tous les champs de mot de passe (21/10/2026)

- **Avant :** seuls la connexion, l'inscription et l'assistant d'inscription avaient le bouton « œil ». Les autres formulaires ne l'avaient pas :
  - accès d'un membre d'équipe ou d'un locataire ;
  - changement de mot de passe (client, propriétaire, agence, administration, agent) ;
  - premier mot de passe d'un compte ouvert par un tiers.
- **Correction :** `js/99d-mdp.js` ajoute le même bouton à tout champ de mot de passe qui n'en a pas, y compris aux formulaires futurs.
- **Test :** `tests/mdp-oeil.js` vérifie 22 champs sur 9 écrans (bouton présent, placé dans le champ, affiche puis masque la saisie), 22 sur 22.

## 24. Finitions professionnelles sur ordinateur (21/10/2026)

**Méthode.** J'ai parcouru l'application à 1440 px de large, pour 7 profils : 234 pages, chacune photographiée et passée au détecteur (boutons bruts, blocs collés, débordements). J'ai ensuite vérifié les fenêtres de dialogue principales.

Les corrections sont dans `js/99e-pro.js` et `css/03-bureau.css`. Elles ne s'appliquent qu'au-delà de 900 px de large.

- **Tableaux :**
  - montants, dates, périodes et téléphones ne se coupent plus sur 2 ou 3 lignes ;
  - les boutons d'action tiennent sur une ligne : à partir de 4 actions, les actions secondaires passent en icône, avec le libellé en info-bulle ;
  - en-têtes en petites capitales, marges réduites quand il y a beaucoup de colonnes ;
  - sur une fenêtre étroite, un tableau trop large revient au retour à la ligne plutôt que de déborder.
  - Exemples : « Portefeuille de biens » débordait de la page à 1440 px, et les boutons de « Locataires & baux » et des signalements tenaient sur 2 ou 3 lignes. C'est corrigé.
- **Champs « fichier » :** l'ancien bouton du navigateur « Choose File » est remplacé par un bouton dans le style de l'application (dépenses, travaux, pièces du bail).
- **Cases à cocher en série :** biens confiés, services du mandat et permissions d'équipe s'affichent en grille de pastilles ; la case cochée est surlignée.
- **Pages de Gestion :** le fil d'Ariane, le choix de section et l'export tiennent sur une seule barre, au lieu de 3 lignes.
- **Visites :** « Suite à une visite » passe sous le titre de la page.
- **Profil et paramètres :** les cartes « mot de passe », « règles » et « confier à une agence » rejoignent la colonne de gauche ; elles n'ont plus des largeurs différentes.
- **Ajouter un bien :** l'assistant est centré et élargi à 920 px.
- **Devis et factures :** la fenêtre est plus large, et chaque ligne (désignation, quantité, prix) tient sur une ligne. Le titre dit « Nouvelle facture » au lieu de « Nouveau facture ».
- **Statistiques (administration, `js/99f-stats.js`, toutes largeurs) :**
  - avant : les noms de régions se chevauchaient, les rôles restaient en anglais, « Revenus par type » était vide sans explication, et un graphique de biens était titré « Transactions » ;
  - maintenant : des barres horizontales lisibles, en français, avec un total par carte.
- **Textes d'exemple dans les champs (toutes largeurs) :**
  - l'adresse du client affichait « Ex. Mamadou Diallo » ;
  - « Nouveau mot de passe » affichait « Ex. 004512 », parce que « nouveau » contient « eau ».
  - Les deux sont corrigés.

**Mobile inchangé.** J'ai comparé la position de chaque élément avec et sans les modules de bureau, à 390, 768 et 900 px, sur 13 pages et sur les tableaux de bord. Les seules différences sont aussi présentes entre deux exécutions identiques : ce sont des données de démo variables.

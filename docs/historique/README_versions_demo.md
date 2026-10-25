> **Document historique** (versions de démonstration, avant le passage à Supabase). Il décrit des fonctions qui n'existent plus (stockage local, comptes de démonstration, paiements simulés). La référence actuelle est `README_SUPABASE.md`.

# DEUKSIL — simulation d'un SaaS immobilier sénégalais

Démonstration front-end complète et fonctionnelle : HTML5, CSS3, JavaScript vanilla et `localStorage`.
Aucun backend, aucune base de données distante, aucune API de paiement réelle.

> **Avertissement**
> Cette version est une simulation front-end. Les données d'identité et les mots de passe sont stockés
> localement, en clair, uniquement pour la démonstration. Une version production devra utiliser un backend
> sécurisé, du chiffrement, une authentification adaptée et une gestion conforme aux exigences légales
> applicables. Aucun numéro de CNI réel n'est utilisé : toutes les identités sont fictives.

---

## 0. Mise en ligne : formulaires et réglages

Tous les réglages du déploiement sont dans **`js/00-config.js`** (seul fichier à modifier) :

| Réglage | Rôle | Vide (par défaut) |
|---|---|---|
| `apiBase` | Adresse du serveur, ex. `https://api.deuksil.sn` | Comptes enregistrés dans le navigateur, aucun envoi de code |
| `googleClientId` | ID client OAuth Google (type « Application Web ») | « Continuer avec Google » annonce que ce mode n'est pas encore activé |
| `routes` | Chemins de l'API appelés par les formulaires | — |

Formulaires réels (js/99g-formulaires.js, 38-ds3.js, 46-connexion.js, 47-google.js) :

- **Inscription** `#/register` : profil (Client, Propriétaire, Agence), prénom, nom, **adresse e-mail** (sert à se
  connecter), téléphone (9 chiffres, Sénégal), CNI (13 chiffres), mot de passe (8 caractères, lettre et chiffre),
  confirmation, acceptation des conditions. Agence : nom, adresse, NINEA et RCCM (facultatifs). E-mail et CNI
  uniques. Les liens de l'accueil cochent le bon profil : « Publier un bien » → Propriétaire, « Créer un compte
  agence » → Agence.
- **Mot de passe oublié** `#/mot-de-passe-oublie` → **Nouveau mot de passe** `#/reinitialiser-mot-de-passe`
  (code à 6 chiffres reçu par e-mail ou SMS).
- **Vérification de l'adresse e-mail** `#/verifier-email` (code à 6 chiffres, renvoi du code).
- **Contact** `#/contact` (lien « Nous écrire » du pied de page). Sans serveur, le message est enregistré et
  l'administration est notifiée.
- **Google** : bouton officiel de Google ; le jeton reçu est envoyé à `POST {apiBase}/auth/google`, où le serveur
  doit vérifier la signature et l'audience. Adresse connue → connexion ; adresse inconnue → inscription pré-remplie.

Routes appelées quand `apiBase` est renseigné (POST, JSON ; erreur → `{message}` affiché tel quel) :
`/auth/register`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/email/verify`, `/auth/email/resend`,
`/auth/google`, `/contact`. Sans serveur, ce qui exige un envoi (codes) le dit à l'utilisateur et propose
l'assistance ; rien n'est simulé.

Activer Google : console Google Cloud → API et services → Identifiants → Créer un ID client OAuth (Application Web) →
« Origines JavaScript autorisées » : l'adresse du site (ex. `https://deuksil.sn`) → copier l'ID dans `googleClientId`.

Les éléments de démonstration (bloc « Comptes de démonstration » de la page de connexion, comptes et annonces du jeu
de test) restent en place : ils sont à retirer un par un avant l'ouverture au public.

Tests : `node tests/formulaires.js` (34 vérifications).

## 1. Présentation

DEUKSIL rassemble locations, ventes et terrains au Sénégal dans un seul produit, avec quatre espaces :

| Rôle | Paie | Peut faire |
|---|---|---|
| Client | 1 000 FCFA à l'inscription | rechercher, mettre en favori, contacter, demander une visite, créer des alertes |
| Propriétaire | 5 000 FCFA + 5 000 FCFA/mois | créer des biens, publier, gérer statuts, demandes, visites, messages, statistiques, abonnement |
| Agence | 15 000 FCFA + formule (STARTER 25 000 / BUSINESS 60 000 / ENTERPRISE 150 000 FCFA) | tout ce que fait un propriétaire + agents, clients, commissions, quotas de formule |
| Administrateur | — | utilisateurs, validation des annonces, biens, paiements, abonnements, statistiques, paramètres |

## 2. Lancement

Ouvrir `deuksil.html` dans un navigateur (double-clic suffit), ou utiliser le lien de l'artifact publié.
Au premier lancement, le jeu de données de démonstration est créé automatiquement dans le `localStorage`.

## 3. Comptes de démonstration

| Rôle | CNI (fictive) | Mot de passe |
|---|---|---|
| Administrateur | `1900000000001` | `admin123` |
| Client | `1900000000002` | `demo123` |
| Propriétaire | `1900000000003` | `demo123` |
| Agence (Teranga Immobilier) | `1900000000004` | `demo123` |

Autres comptes fictifs : clients `1900000000005` / `1900000000006`, propriétaire `1900000000007`,
agence suspendue `1900000000008` (sert à tester le blocage de connexion).

L'écran de connexion propose un bouton « Utiliser » qui remplit les identifiants.

## 4. Scénarios testables de bout en bout

**Client** : inscription → paiement Wave/Orange Money simulé → compte actif → recherche filtrée →
fiche du bien → favori → contact (ouvre une conversation) → demande de visite → notification à l'acceptation.

**Propriétaire** : inscription → frais + abonnement simulés → tableau de bord → ajout d'un bien →
publication (l'annonce passe en *En attente de validation*) → l'admin valide → l'annonce apparaît dans la
recherche → réception d'une demande → acceptation (le bien passe en *En discussion*) → renouvellement d'abonnement.

**Agence** : inscription → choix de formule → dashboard → ajout d'agents (bloqué au-delà du quota) →
ajout de biens (bloqué au-delà du quota) → clients → visites → commissions estimées.

**Admin** : connexion → KPI et graphiques → validation/refus d'annonces → suspension d'un compte →
paiements → abonnements → export JSON → réinitialisation de la démo.

Règles de cohérence appliquées : un bien passé en *Loué* ou *Vendu* sort des résultats de recherche et
notifie ceux qui l'avaient en favori ; publier sans abonnement valide est refusé ; une annonce validée
déclenche une notification d'alerte aux recherches enregistrées correspondantes.

## 5. Données et `localStorage`

Toutes les écritures passent par une couche unique (`DB`) — jamais de `localStorage.setItem` dispersé :

```js
DB.getData(key)              DB.addItem(key, item)       DB.findItem(key, idOuPredicat)
DB.setData(key, valeur)      DB.updateItem(key, id, {})  DB.filterItems(key, predicat)
DB.deleteItem(key, id)
```

Collections : `deuksil_users`, `deuksil_properties`, `deuksil_favorites`, `deuksil_visits`,
`deuksil_messages`, `deuksil_notifications`, `deuksil_payments`, `deuksil_subscriptions`,
`deuksil_agents`, `deuksil_searches`, `deuksil_activity`, plus la session `deuksil_current_user`.

Chaque objet porte `id`, `createdAt`, `updatedAt` (ex. `property_001`), ce qui rend la migration vers une
base relationnelle immédiate. Le statut de publication d'une annonce est porté par le bien lui-même
(`listingStatus` : brouillon / attente / publiée / refusée / pause / archivée), distinct de son statut
commercial (`status` : disponible / en discussion / loué / vendu / archivé).

## 6. Paiements simulés

Wave et Orange Money, avec choix du moyen, animation de traitement, référence au format
`DZL-AAAAMMJJ-XXXX`, création d'une transaction dans `deuksil_payments`, puis activation du compte ou
prolongation de l'abonnement de 30 jours. **Aucun appel réseau, aucun paiement réel.**

## 7. Structure

Le livrable est un fichier unique et autonome (`deuksil.html`) pour pouvoir être ouvert et partagé sans
serveur. Le code est découpé en modules commentés, dans l'ordre suivant, et chaque bloc correspond à un
fichier de l'architecture cible :

```
DEUKSIL/
├── index.html                     ← la coquille HTML + #app
├── assets/css/style.css           ← bloc « Design system » (tokens, composants, responsive)
└── assets/js/
    ├── utils.js                   ← helpers, formats, photos générées
    ├── storage.js                 ← couche DB (localStorage)
    ├── seed.js                    ← jeu de démonstration
    ├── ui.js                      ← toasts, modales
    ├── auth.js                    ← session CNI + protection des routes
    ├── payments.js                ← simulation Wave / Orange Money
    ├── router.js                  ← routage par hash
    ├── components.js              ← coquilles, cartes, graphiques SVG
    ├── views-*.js                 ← landing, client, owner, agency, admin
    └── actions.js                 ← délégation d'événements
```

Pour éclater le fichier : couper aux commentaires `MODULE :` / `VUE :` et charger les scripts dans cet ordre.

Routes (hash) : `#/`, `#/login`, `#/register`, `#/search`, `#/property/:id`, `#/client/*`, `#/owner/*`,
`#/agency/*`, `#/admin/*`. Un utilisateur connecté est redirigé s'il tente d'ouvrir l'espace d'un autre rôle.

## 8. Ajouts récents

- **Photos réelles** : le formulaire d'ajout/modification d'un bien permet d'importer de vraies images
  (JPG/PNG, 20 photos maximum pour un propriétaire comme pour une agence). Chaque image est redimensionnée et compressée dans le navigateur (canvas,
  1080 px de côté maximum, JPEG qualité 70 %) avant d'être stockée en base64 dans `localStorage`, avec
  vignettes, réorganisation implicite (première photo = couverture) et suppression individuelle. Un bien
  sans photo continue d'afficher l'illustration générée automatiquement.
- **Recherche enrichie** : tri (récents, prix croissant/décroissant, plus vus, plus grande surface),
  pagination (9 résultats par page) et chips de filtres actifs avec suppression individuelle.
- **Boîtes de dialogue maison** : suppression, désactivation de compte et réinitialisation de la démo
  passent par des modales stylées (`confirmDialog` / `promptDialog`) plutôt que par les `confirm()` /
  `prompt()` natifs du navigateur.
- **Pages légales** : Mentions légales, CGU et Politique de confidentialité, reliées depuis le footer.
- **Section avis clients** sur la page d'accueil, entre les statistiques et la FAQ.

## 9. Accessibilité, comparateur et finitions

- **Modales accessibles** : piège de focus au clavier (Tab reste dans la boîte de dialogue), fermeture par
  Échap, `role="dialog"` avec `aria-labelledby`, restitution du focus à l'élément déclencheur à la fermeture.
- **Comparateur de biens** : case « Comparer » sur chaque carte de résultat (3 biens maximum), barre
  flottante récapitulative, page `#/compare` avec tableau comparatif sur 14 critères (prix, prix au m²,
  surface, équipements, statut…).
- **Actions groupées côté admin** : sélection multiple des annonces en attente, validation ou refus en un
  clic pour toute la sélection.
- **Page Documents** (propriétaires et agences) : dépôt de pièces justificatives (image ou PDF, 4 Mo max
  par fichier), liste, aperçu, téléchargement, suppression.
- **Page Paramètres agence** : informations générales, préférences de notification (simulées), zone de
  danger avec suppression de compte (confirmation obligatoire, purge des biens et documents associés).
- **Photo de profil** : upload et suppression d'un avatar, compressé et stocké en base64, repris dans la
  sidebar, le profil, les tableaux d'utilisateurs et la fiche d'un bien.
- **Prix au m²** affiché sur les cartes d'annonces et la fiche détail.
- **Page 404** illustrée avec des raccourcis vers l'accueil et la recherche, au lieu d'un texte brut.
- **Bouton de thème** : icône soleil/lune plutôt qu'un simple texte, préférence mémorisée.
- **Écran de démarrage** : un bref skeleton animé s'affiche le temps que les données de démonstration
  soient prêtes, pour éviter l'apparition instantanée qui trahissait un rendu purement local.

## 10. Limites de la démo

- Données locales au navigateur : rien n'est partagé entre deux appareils, vider le cache efface tout.
- Mots de passe en clair, pas de vérification d'identité réelle, pas de contrôle de CNI.
- Pas de carte géographique interactive ni de temps réel : les notifications restent locales.
- Les statistiques mélangent données réelles du stockage et valeurs simulées pour l'historique.
- Les préférences de notification (e-mail/SMS) sont enregistrées mais n'envoient rien réellement.
- Un propriétaire de démonstration (`user_owner2`) a volontairement un abonnement expiré dans les données
  de départ, pour illustrer le filtre décrit en section 24 : ses biens n'apparaissent pas dans la recherche
  tant que son abonnement n'est pas renouvelé (14 annonces visibles sur 22 au premier chargement, au lieu de
  20 dans les versions précédentes). Ce n'est pas un bug — utilisez le compte `1900000000007` / `demo123`
  et l'onglet Abonnement pour le renouveler et voir ses biens réapparaître.

## 11. Identité visuelle

Le logo fourni (mark "D + maison" en navy et or, décliné fond clair / fond sombre) a été détouré à partir
des deux fichiers transmis et intégré en base64 directement dans la page — aucune requête externe. Il
remplace le logo dessiné en CSS dans la barre de navigation, la sidebar et le pied de page, avec la variante
adaptée à chaque fond (navy sur clair, blanc sur sombre).

La palette du produit a été refondue pour correspondre au logo :

```
--brand   navy profond   #0F3057   boutons, liens, éléments actifs
--gold    bronze/or      #B4862F   accents premium, badges "vérifié", séparateurs
--nav     navy quasi-noir #0A2138  fond de la sidebar et du pied de page
--bg      gris-bleu pâle #F4F6F8  fond général de l'application
```

Les couleurs de statut (disponible/vert, attente/ambre, refusé/rouge, information/bleu) restent des couleurs
sémantiques standard, volontairement indépendantes de l'identité de marque.

## 12. PWA et notifications sonores

**Installation.** La page embarque un manifeste Web App (icônes 192/512, couleur de thème, mode
`standalone`) ainsi que les balises Apple (`apple-touch-icon`, `apple-mobile-web-app-capable`), tout en
base64 pour rester un fichier unique. Depuis la page ouverte en onglet plein (pas dans l'aperçu intégré du
chat), un navigateur compatible propose « Installer l'application » / « Ajouter à l'écran d'accueil », avec
l'icône DEUKSIL (le mark navy/or détouré depuis votre logo) comme icône d'application.

**Carillon sonore.** Chaque nouvelle notification déclenche un carillon à deux notes généré par Web Audio
(aucun fichier audio embarqué). Le son se déclenche dès qu'une notification apparaît pour l'utilisateur
actuellement connecté — pas à chaque nouvel affichage, seulement quand le nombre de notifications non lues
augmente réellement. Un bouton haut-parleur dans la barre supérieure permet de couper/réactiver le son ; la
préférence est mémorisée. Le panneau de notifications propose aussi d'activer les alertes natives du
navigateur (`Notification` du navigateur) quand elles sont disponibles.

**Ce que cette version ne fait pas.** Il n'y a pas de service worker ni de notifications reçues quand
l'onglet est fermé : cela demanderait un serveur de push et des clés VAPID, hors du périmètre d'une
démonstration sans backend. Le son ne joue que pendant que la page est ouverte et qu'un événement crée une
notification pour l'utilisateur courant.

## 14. Navigation mobile

Sous 760px, le menu hamburger et le tiroir latéral ont été remplacés par une barre d'onglets fixe en bas
d'écran (comme une app native) : les 4 entrées les plus utilisées du rôle, plus un onglet « Plus » qui ouvre
le reste du menu (dont la déconnexion) dans une feuille modale. Au-dessus de 760px, la sidebar complète reste
affichée normalement ; rien ne change côté desktop.

## 16. Corrections

- **Déconnexion depuis le menu mobile « Plus »** : le bouton « Se déconnecter » ne fermait pas la fenêtre
  du menu avant de rediriger, laissant un fond sombre bloqué au-dessus de la page de connexion (bug de
  z-index). La déconnexion ferme désormais systématiquement toute fenêtre ouverte avant de rediriger.
- **Redirection immédiate** : les redirections (déconnexion, accès refusé à un espace, session invalide)
  s'appliquent désormais de façon synchrone — la bonne page s'affiche tout de suite, sans dépendre du délai
  du navigateur pour détecter le changement d'adresse.
- **Vignette photo dans « Mes biens »** : la liste des biens du propriétaire et de l'agence affiche
  maintenant une vignette de la photo de couverture réellement importée (ou l'illustration générée si aucune
  photo n'a été ajoutée), avec le nombre de photos du bien. Le mécanisme d'affichage de la vraie photo de
  couverture (carte de recherche, page d'accueil, fiche détail, favoris) fonctionnait déjà correctement ;
  seule cette liste de gestion n'affichait aucun visuel.

## 18. Dernière série de corrections

- **Filtres de recherche en direct** : sélectionner une région met désormais à jour la liste des villes
  immédiatement (et la ville met à jour les quartiers), sans avoir à cliquer sur "Rechercher" au préalable —
  aligné sur le comportement déjà utilisé dans le formulaire d'ajout de bien.
- **Actions groupées sur "Mes biens"** : le propriétaire et l'agence peuvent désormais sélectionner plusieurs
  biens (case à cocher, "tout sélectionner") pour les mettre en pause, les archiver ou les supprimer en une
  fois, avec confirmation avant suppression.
- **Validation de formulaire stylée** : le formulaire d'ajout de bien (titre, prix, surface), le formulaire
  d'ajout d'agent (CNI fictive à 13 chiffres, champs requis) et la demande de visite (date pas dans le passé)
  affichent désormais un message d'erreur dans le même style que l'inscription, au lieu de compter uniquement
  sur la validation native du navigateur.
- **Affichage/masquage du mot de passe** : une icône œil sur les champs de connexion et d'inscription permet
  de vérifier ce qu'on a tapé.
- **Messagerie sur petit écran** : sur mobile, la liste des conversations et la conversation ouverte
  s'affichent désormais l'une à la place de l'autre (avec un bouton retour), au lieu d'être empilées — le
  champ de saisie reste toujours visible sans avoir à faire défiler la page.

## 20. Carte de recherche géographique

Un bouton « Liste / Carte » sur la page de recherche fait apparaître une carte schématique du Sénégal,
dessinée en SVG (même logique que les illustrations de biens : aucune tuile externe, aucun appel réseau —
Google Maps et OpenStreetMap ne peuvent pas être chargés dans cet environnement publié). Les six régions
sont positionnées approximativement les unes par rapport aux autres ; ce n'est **pas** une carte
géoréférencée, une mention le précise sous la carte.

Chaque région affiche une bulle dont la taille suit le nombre de biens correspondant aux filtres déjà
actifs (transaction, type, budget…). Cliquer une région ouvre la liste de ses villes avec un compteur par
ville ; cliquer une ville applique le filtre et bascule automatiquement vers la liste des résultats. Un
bouton « Voir tous les biens de la région » permet aussi de filtrer sans choisir de ville précise.

## 22. Paiements — simulation fidèle à PayDunya

Tous les paiements (inscription, abonnement, renouvellement, changement de formule) passent désormais par
une simulation calquée sur le vrai fonctionnement de [PayDunya](https://developers.paydunya.com), l'agrégateur
recommandé pour ce marché (voir la conversation sur l'architecture des paiements). Ce choix suit exactement
la structure réelle de leur API publique :

- **Étape 1 — création de facture**, imite `POST /v1/checkout-invoice/create` : génère un jeton au format
  `test_XXXXXXXXXX` (identique au format des jetons sandbox réels de PayDunya) et une URL de la forme
  `https://app.paydunya.com/sandbox-checkout/invoice/{token}` (affichée à titre de référence uniquement —
  ce n'est pas un vrai lien, il ne doit pas être cliqué).
- **Étape 2 — page de paiement hébergée**, imite la page de paiement PayDunya elle-même : le client choisit
  parmi Orange Money, Wave, Free Money ou une carte bancaire, exactement les moyens que PayDunya propose
  réellement au Sénégal.
- **Étape 3 — confirmation**, imite `GET /v1/checkout-invoice/confirm/{token}` : renvoie une structure avec
  `response_code: "00"`, `status: "completed"`, une empreinte (`hash`) et les informations du client — le
  même format que la vraie réponse de confirmation PayDunya.

Chaque paiement enregistré dans `deuksil_payments` porte désormais un objet `paydunya` avec ce jeton, ce
hash et ce statut, consultable via un bouton « Reçu » dans l'historique des paiements (propriétaire, agence,
administrateur). Cette fidélité au format réel de PayDunya n'est pas cosmétique : le jour où un vrai backend
est branché, le modèle de données côté frontend correspond déjà à ce que l'API de PayDunya renverra
réellement, ce qui simplifie directement le branchement.

**Ce que cette simulation ne fait pas, volontairement :**
- Aucun appel réseau vers `app.paydunya.com` — impossible et dangereux depuis un frontend pur : les clés
  `PAYDUNYA-MASTER-KEY` / `PAYDUNYA-PRIVATE-KEY` / `PAYDUNYA-TOKEN` ne doivent jamais exister côté navigateur.
- Aucune vraie clé, aucun vrai jeton PayDunya n'est reproduit ; tout est généré aléatoirement à chaque
  paiement simulé.
- Un bandeau « Bac à sable — simulation » reste affiché en permanence sur l'écran de paiement pour qu'il ne
  soit jamais confondu avec la vraie interface PayDunya.

## 24. Corrections de logique métier

- **Abonnement expiré et visibilité des annonces.** La recherche et la page d'accueil vérifient désormais,
  pour chaque bien, que l'abonnement de son propriétaire ou de son agence est toujours actif
  (`ownerSubscriptionActive`). Un abonnement expiré retire automatiquement ses annonces de la recherche
  publique, sans action manuelle — auparavant, seule la publication d'une *nouvelle* annonce était bloquée ;
  les annonces déjà publiées restaient visibles indéfiniment après expiration.
- **Suppression réellement complète.** `cascadeDeleteProperty()` et `cascadeDeleteUser()` remplacent les
  suppressions partielles précédentes. Supprimer un bien retire aussi ses favoris et ses demandes de visite
  associées. Supprimer un compte (par l'administrateur ou par l'utilisateur lui-même) retire désormais
  réellement : ses biens (et leurs favoris/visites), ses conversations, ses documents, son abonnement, ses
  alertes de recherche et, pour une agence, ses agents — ce que le message de confirmation annonçait mais que
  le code ne faisait pas entièrement auparavant.

## 26. Appel téléphonique direct

Le numéro de téléphone n'est plus caché derrière « communiqué après le premier échange ». Sur la fiche d'un
bien, un client connecté voit un vrai lien `tel:` avec le numéro du propriétaire — un clic (ou un tap sur
mobile) lance directement l'appel via le composeur du téléphone. Un visiteur non connecté voit à la place un
bouton « Voir le numéro » qui l'invite à se connecter, cohérent avec le reste du modèle (favoris, message,
visite). Le même lien `tel:` a été ajouté côté propriétaire dans le tableau des demandes de visite (numéro du
client) et dans l'en-tête de la messagerie (numéro du correspondant), pour que l'appel direct fonctionne dans
les deux sens.

## 28. Double réservation et vérification de propriété

- **Double réservation de visite bloquée.** Accepter une demande de visite vérifie désormais qu'aucune
  autre demande n'est déjà acceptée pour le même bien, à la même date et à la même heure. En cas de
  conflit, l'action est refusée avec un message invitant à reporter la demande plutôt qu'à l'accepter.
- **Vérification de propriété sur les mutations.** Publier, mettre en pause, archiver, supprimer un bien ou
  changer son statut vérifie maintenant que le bien appartient bien à l'utilisateur connecté
  (`ownsProperty`) ; activer ou supprimer un agent vérifie qu'il appartient à l'agence connectée
  (`ownsAgent`). Accepter, refuser ou reporter une visite vérifie que la demande a bien été adressée au
  propriétaire connecté. Ces contrôles n'ont pas d'impact visible aujourd'hui — l'interface ne montre
  jamais l'identifiant d'un bien qui n'appartient pas à l'utilisateur — mais modélisent exactement ce
  qu'un backend réel devra imposer côté serveur, et protègent contre toute incohérence si l'état de
  l'application venait à être manipulé directement (extension navigateur, console, etc.).

## 30. Notifications cliquables

Chaque notification porte désormais un lien contextuel (`notify(userId, texte, lien)`) et devient un vrai
bouton dans le panneau : cliquer dessus marque la notification comme lue, ferme le panneau et navigue
directement vers l'endroit concerné — l'abonnement pour une alerte d'expiration, la fiche du bien pour une
validation ou un match d'alerte de recherche, la messagerie ou les visites pour une nouvelle demande, en
tenant compte du rôle réel du destinataire (`roleLink`) puisque propriétaire et agence n'utilisent pas les
mêmes routes.

## 32. Bugs corrigés après un audit systématique

- **Fuite d'état entre utilisateurs.** Comparateur de biens, photos en cours d'ajout sur un formulaire non
  enregistré, sélections groupées, région sélectionnée sur la carte et conversation ouverte pouvaient
  rester en mémoire d'une session à l'autre si on changeait d'utilisateur sans recharger la page — au point
  qu'un second utilisateur pouvait voir les photos qu'un premier était en train d'ajouter sans les avoir
  enregistrées. `resetSessionUiState()` remet tout à zéro à chaque connexion, déconnexion et
  réinitialisation de la démonstration.
- **Échec de sauvegarde silencieusement ignoré (le plus sérieux).** Quand le stockage local était plein,
  `DB.setData` absorbait l'erreur en interne et l'affichait dans un message — mais les fonctions appelantes
  (enregistrer un bien, un document, une photo de profil) n'avaient aucun moyen de le savoir : elles
  affichaient quand même leur propre message de succès, vidaient le formulaire et redirigeaient
  l'utilisateur, qui perdait ses données sans le comprendre. `DB.setData` expose maintenant le résultat
  réel de l'écriture (`DB.lastWriteOk`), et les trois flux concernés vérifient ce résultat avant de
  confirmer quoi que ce soit à l'utilisateur.
- Vérifié à cette occasion et jugés sains : échappement HTML de tous les champs texte libres (description
  d'un bien, présentation d'une agence) contre l'injection, cohérence des dates de renouvellement
  d'abonnement, remise à zéro de la pagination à chaque changement de filtre.

  Le même contrôle (`DB.lastWriteOk`) a ensuite été étendu à tous les flux critiques restants : la
  confirmation de paiement PayDunya (un paiement non enregistrable affiche désormais une alerte avec la
  référence à transmettre au support plutôt qu'un faux succès), la création de compte à l'inscription, la
  création d'une demande de visite et l'ajout d'un agent. Dans chaque cas, un échec de stockage bloque
  proprement l'action et garde l'utilisateur sur son formulaire au lieu de le rediriger sur un succès fictif.

## 35. Tableaux de bord premium (tous les rôles)

Le traitement visuel du tableau de bord client — cartes KPI avec icône dans une bulle colorée, bannière
d'en-tête avec scène illustrée, listes cliquables à icône (`list-item`), cartes d'accès rapide — a été étendu
aux trois autres rôles :

- **Propriétaire** : bannière de bienvenue, 5 cartes KPI illustrées, accès rapides, demandes de visite en
  liste cliquable avec avatar.
- **Agence** : bannière avec la formule et les quotas, 6 cartes KPI, visites à traiter en liste avec avatar
  et bouton d'action direct.
- **Administration** : 8 cartes KPI illustrées (sans bannière photo, pour rester un outil opérationnel plutôt
  que vitrine), annonces à valider et activité récente en listes à icône.

Toutes les icônes et couleurs restent puisées dans la palette de marque (navy/or + tons sémantiques
ok/warn/bad/info) plutôt que des couleurs arbitraires, et les bannières utilisent les scènes SVG générées
déjà existantes plutôt que des photos externes, impossibles à charger dans cet environnement publié.

## 37. Assistant de recherche par IA (réel, pas simulé)

Contrairement aux paiements PayDunya, cette fonctionnalité appelle réellement Claude, via la capacité
`sample` fournie par l'environnement de publication. Sur la page de recherche, un encart « Assistant de
recherche » permet de décrire ce qu'on cherche en une phrase (« F3 meublé pas cher à Almadies ») ; l'assistant
traduit la phrase en filtres réels (région, ville, quartier, type, budget, meublé…) et lance la recherche.

Points importants :
- **Disponible uniquement dans la page publiée par Anthropic.** Le fichier ouvert seul (double-clic, aperçu
  local) n'a pas accès à `window.claude` : l'encart ne s'affiche simplement pas, sans erreur.
- **Validation stricte des réponses.** Toute valeur renvoyée par l'IA qui ne correspond pas exactement à une
  région, ville ou type existant dans nos données est ignorée plutôt qu'appliquée à l'aveugle
  (`sanitizeAiFilters`), pour éviter qu'une hallucination ne casse silencieusement la recherche.
- **Pas d'appel automatique.** L'assistant ne se déclenche que sur une action explicite de la personne
  (soumission du formulaire), jamais au chargement de la page.

## 39. Bouton flottant — assistant disponible partout

Un bouton rond fixé en bas à droite (au-dessus de la barre d'onglets sur mobile) donne accès à l'assistant
DEUKSIL depuis n'importe quel tableau de bord — client, propriétaire, agence, administration — pas seulement
la page de recherche. Il ouvre une conversation libre avec Claude, avec deux façons de saisir sa question :

- **Texte** : champ de saisie classique.
- **Voix** : bouton micro utilisant la reconnaissance vocale du navigateur (Web Speech API, `fr-FR`) ; le
  texte reconnu se place dans le champ pour relecture avant envoi, rien n'est envoyé automatiquement. Repli
  propre (message d'avertissement) si le navigateur ne prend pas en charge la dictée.

La conversation garde son fil (questions et réponses précédentes renvoyées à chaque appel, puisque la
capacité n'a pas de mémoire propre), avec un jeu d'instructions de contexte adapté à DEUKSIL et au rôle de
la personne connectée. Comme pour l'assistant de recherche, tout est réinitialisé à la déconnexion, et le
bouton ne s'affiche que si la capacité est réellement disponible.

## 40. VERSION PRODUCTION

```
Frontend        React ou Next.js, design system repris tel quel, rendu serveur pour le SEO des annonces
Backend         API REST/GraphQL (NestJS, Django ou Laravel), règles métier déplacées côté serveur
Database        PostgreSQL : users, properties, listings, visits, messages, payments, subscriptions, agents
Authentication  OTP SMS + mot de passe haché (argon2), JWT courts + refresh, rôles et permissions serveur,
                vérification d'identité par pièce justificative traitée par un prestataire agréé
Storage         S3 ou équivalent pour photos et documents, redimensionnement et filigrane à l'upload
Payments        Intégration Wave et Orange Money (webhooks de confirmation, réconciliation, facturation)
Maps            Cartographie des biens et recherche par rayon (Mapbox ou Google Maps)
Notifications   E-mail transactionnel, SMS, push, digest des alertes de recherche
Security        HTTPS strict, rate limiting, journalisation, chiffrement au repos, sauvegardes,
                conformité à la protection des données personnelles (CDP, loi 2008-12) et durée de rétention
```

La migration côté front se limite à remplacer les six méthodes de `DB` par des appels API : le reste du
code ne connaît pas le `localStorage`.

## 40. Gestion complète (propriétaires et agences)

Nouveau menu **Gestion** (`#/manage/...`) : baux et locataires (échéancier généré, alerte de fin de bail), loyers
(encaissement, quittance téléchargeable, relance WhatsApp des retards), maintenance (coûts, statuts), pipeline de
ventes (prospect → vendu, le bien passe en « Vendu ») et finances (encaissé, impayés, charges, net, taux
d'occupation, rentabilité par bien). Collections : `deuksil_leases`, `deuksil_rents`, `deuksil_tickets`, `deuksil_deals`.

## 41. V2 — cycle commercial, dépenses, rentabilité, journal

Onglets Gestion : **Devis & Factures** (DEV/PF/FAC/AV numérotés, cycle devis → proforma → facture, liés par `parentId`),
**Paiements** (PAY + reçu REC, paiement partiel, mode Wave/Orange Money/espèces…), **Dépenses** (DEP, 12 catégories),
**Finances** (facturé, encaissé, impayés, net, graphique 6 mois, rentabilité par bien) et **Journal** d'audit.
Collections : `deuksil_docs`, `deuksil_fpay`, `deuksil_expenses`, `deuksil_audit`. Documents téléchargeables en HTML imprimable en PDF.

## 42. V3 — contrats, prestataires, exports, téléchargements

Onglets Gestion : **Contrats** (CTR-AAAA-NNNNN ; location, mandat, vente, prestation ; brouillon → actif → expiré / résilié /
renouvelé ; expiration automatique à l'affichage ; renouvellement qui crée un nouveau contrat lié), **Prestataires**
(annuaire d'artisans), et bouton **Exporter en CSV** sur baux, loyers, contrats, devis/factures, paiements, dépenses.
Les téléchargements (quittances, factures, reçus, contrats, CSV) passent par `saveFile()` : capacité `downloads` sur la
page publiée, téléchargement classique quand le fichier est ouvert en local.

## 43. V4 — rôles et permissions (RBAC)

Nouveaux rôles : **gestionnaire** et **agent** (membres d'équipe d'un propriétaire ou d'une agence, permissions configurables
parmi biens, visites, messagerie, gestion, finances, documents) et **locataire** (espace dédié : logement, loyers, signalement
de maintenance). L'administration du compte, l'abonnement et l'équipe ne sont jamais délégables.
Application côté logique : garde de routes (`permFor`), menus filtrés, onglets filtrés, et blocage des actions injectées
(écouteurs en phase de capture). Création : Gestion > « Équipe & accès ».
Comptes de démo (mot de passe `demo123`) : gestionnaire `1900000000011` (équipe du propriétaire 3), agent `1900000000012`
(agence 4), locataire `1900000000013` (bail Fatou Ndiaye).

## 44. V5 — confiance : signalements et vérification

Bouton **Signaler** sur la fiche d'un bien (9 motifs, un signalement ouvert par utilisateur et par bien, notification aux admins).
Page admin **Signalements** : examiner, demander des modifications (message au propriétaire), suspendre (annonce en pause),
restaurer, supprimer (cascade), classer sans suite. Page admin **Vérifications** : niveaux non vérifié / identité vérifiée /
professionnel vérifié (comptes) et annonce vérifiée / bien vérifié (annonces), affichés sur la fiche avec un avertissement
précisant que cela ne vaut pas validation juridique ou foncière. Collection : `deuksil_reports`.

## 45. V6 — documents PDF

Devis, proformas, factures, avoirs, reçus, quittances de loyer et contrats (location, mandat, vente, prestation) sont
générés en **PDF A4** avec le logo DEUKSIL : émetteur (nom, adresse, téléphone, e-mail, NINEA, RCCM), client, lignes,
remise, TVA 18 % optionnelle, totaux, paiements reçus, reste à payer, montant en lettres (reçus et quittances), coordonnées
de paiement, zones de signature, pied de page avec pagination. Un aperçu s'ouvre juste après la création, avec le bouton
« Télécharger le PDF ». Gestion > « Mes informations » renseigne l'émetteur. jsPDF 2.5.1 est chargé à la demande depuis
cdnjs (connexion Internet requise). Le droit de générer un PDF suit les permissions (finances / gestion).

## 46. V7 — coffre de documents en tiroirs

Entrée **Documents** dans le menu de chaque espace (`#/coffre`, `#/coffre/<tiroir>`). Les documents générés (factures, devis et
proformas, avoirs, reçus, quittances, contrats) sont rangés automatiquement ; les documents déposés (pièces d'identité,
titres et propriété, assurances, techniques, justificatifs de revenus, autres) le sont dans le tiroir choisi, avec bien
concerné et date d'expiration facultatifs (alerte à 30 jours). Tiroirs par rôle : propriétaire/agence/admin (11), locataire (5),
client (3). Recherche, aperçu, PDF, téléchargement et suppression. Le locataire télécharge ses quittances et son contrat en PDF
au nom de son bailleur ; l'admin consulte tous les documents. Les permissions des membres d'équipe s'appliquent par tiroir.

## 47. V8 — icône dessinée de l'assistant

L'icône générique de l'assistant est remplacée par une icône propre à DEUKSIL : une **bulle de discussion en forme de maison**
(immobilier + conversation) avec une **étincelle dorée** (intelligence). Le bouton flottant reçoit un fond dégradé bleu nuit,
un anneau doré, une légère pulsation (désactivée si « réduire les animations ») et une infobulle « Assistant DEUKSIL » au survol.
L'icône (`ICONS.sparkle`) s'adapte aux thèmes clair/sombre et remplace aussi l'ancienne étincelle dans la recherche IA.

## 48. V9 — unités, fiches locataires, rapports, rappels, maintenance, tableaux

- **Unités** (Gestion > Unités) : un immeuble contient des unités (A01, A02…) avec étage, surface, pièces, loyer, charges et statut
  libre / occupée / en maintenance. « Louer » crée le bail et l'échéancier ; la fin de bail libère l'unité. Taux d'occupation.
- **Fiches locataires** : contact, bien et unité, bail, caution, loyers payés ou en retard, maintenance, appel et WhatsApp.
- **Rapports** (permission finances) : revenus par mois, revenus par bien, dépenses par catégorie, impayés, occupation,
  rentabilité par bien, par année ; export PDF (avec logo) et CSV.
- **Rappels automatiques** (sans doublon) : loyer bientôt dû ou en retard (propriétaire et locataire), facture en retard,
  contrat qui expire sous 30 jours, document expiré ou expirant.
- **Maintenance complète** : MNT-AAAA-NNNNN, priorité, prestataire, photo, étapes ouvert → assigné → en cours → résolu → fermé,
  dépense DEP créée à la résolution et liée au bien (non comptée deux fois), notification au locataire.
- **Tableaux** : tri par clic sur l'en-tête, pagination (10 lignes), recherche sur les listes principales.

## 49. V10 — propriétaires, locataire en ligne, investisseur, promoteur, audit

- **Fiches propriétaires** (Gestion > Propriétaires) : mandants d'une agence (identité, type, commission %), biens rattachés,
  revenus, dépenses, commission et montant à reverser ; **relevé de gestion PDF**.
- **Locataire** : paiement du loyer en ligne (Wave, Orange Money, Free Money — simulé, PayDunya à brancher), quittance
  automatique dans Documents, et **messagerie** avec le propriétaire (Gestion > Messages locataires côté bailleur).
- **Investisseur** (`#/invest/home`) : actifs, valeur, plus-value, rendement net, cash-flow, relevé de patrimoine PDF.
- **Promoteur** (`#/promo/home`) : programmes, lots (disponible / réservé / vendu avec acquéreur), avancement et CA vendu.
  Les deux rôles sont proposés à l'inscription (frais provisoires : 3 000 et 10 000 FCFA, à valider).
- **Journal d'audit détaillé** : ancienne et nouvelle valeur de chaque modification (documents, contrats, baux, loyers,
  dépenses, biens, propriétaires), export CSV.
- Statut de bien **« En maintenance »** ajouté (le statut « Archivé » existait déjà).
Comptes de démo (demo123) : investisseur `1900000000021`, promoteur `1900000000022` ; l'agence `1900000000004` a deux mandants.

## 50. Audit des bugs et de la logique (corrections)

Corrigé : tableaux sans en-tête qui bloquaient tri et pagination ; tri des dates ; numéros de référence en double après
suppression (maintenant : plus grand numéro de l'année + 1) ; date de fin de bail (mois calendaires, plus de dérive de 5 jours) ;
rendement affiché sur les biens en location (calculé seulement pour les biens à vendre) ; un locataire ne voit plus les contrats
d'un autre locataire du même bien ; droits des membres d'équipe sur les exports CSV financiers, l'aperçu des factures et les
documents déposés ; suppression d'un bien ou d'un compte (unités, tickets, baux, loyers, données liées nettoyés) ;
suppression d'une dépense liée à un ticket (le coût disparaissait des rapports) ; avoir limité au reste à payer ;
expiration automatique des contrats sans ouvrir l'onglet ; double paiement d'un loyer ; rappels dédupliqués dans la base (et non
par navigateur) ; bail classique refusé sur un bien qui a des unités ; nom, téléphone et journal d'un document généré par un
membre d'équipe (l'émetteur est le titulaire du compte).
Limites connues : voir le rapport d'audit remis avec cette version (sécurité côté serveur, mots de passe, stockage local).

## 51. Refonte de l'interface d'après les références

Système de design relevé sur les 9 captures fournies et appliqué à toute l'application :
navy profond #00192F (en-tête, barre latérale, pastille de navigation), feuille de contenu blanche aux coins
supérieurs arrondis (26 px) remontant sous l'en-tête, cartes blanches à filet 1 px sans ombre, pastilles d'icônes
teintées (bleu / vert / orange / doré), accent doré #F0B429 réservé au bouton central et aux actions clés,
typographie sans serif unique (les titres ne sont plus en serif), rayons 12/16/26 px, ombres quasi supprimées.
Composants ajoutés d'après les références : `.trow` (ligne-tuile icône + titre + sous-titre + chevron), `.choices`
(grille de tuiles de choix), `.steps` et `.progress-seg` (étapes et progression), `.itile` (pastille d'icône).
Tiroirs du coffre refaits sur le modèle « Mes demandes ». Mobile : galerie d'un bien en carrousel horizontal à
accroche, modale en feuille montante à en-tête collant, bande d'onglets Gestion défilante.

## 52. Allègement de l'interface mobile

Barre du bas : 91 → 61 px (libellés .58rem, icônes 21 px, bouton central 40 px). En-tête mobile resserré, logo 24 → 19 px.
Échelle typographique mobile : corps 15 → 14 px, titres de page 24 → 20 px, boutons, champs, tableaux et badges réduits
en proportion ; densité des cartes, pastilles d'icônes (46 → 40 px) et cellules de tableau resserrée.
Accueil : barre de recherche 66 → 48 px, tuiles de catégorie 131 → 101 px (icônes 64 → 46 px), bloc « Le marché en un
coup d'œil » 202 → 161 px. La silhouette de carte du Sénégal, qui chevauchait le titre de ce bloc, a été supprimée
(markup et styles `.mapo`).

## 53. Photothèque de démonstration

Les décors dessinés en SVG sont remplacés par 12 photos réelles fournies, compressées (760 px, JPEG progressif) et
encodées dans le fichier : `PHOTOS` et `PHOTO_SETS` associent un jeu de photos à chaque type de bien (villa, maison,
appartement, studio, chambre, duplex, immeuble, terrain, bureau, local commercial). `photoHtml()` utilise d'abord les
photos propres au bien, puis ce jeu par défaut. Photo de couverture : villa contemporaine avec piscine au crépuscule,
cadrée en 16/9 — retenue car son ciel dégagé et sa zone sombre à gauche laissent le titre lisible. Elle est utilisée
sur le bandeau public et sur les bandeaux des espaces propriétaire, agence et client. Le fichier passe de 1,0 à 2,2 Mo.

## 54. Bandeaux des espaces et états de la barre du bas

Bandeaux : quatre photos de villa recadrées en 16/6 (1280×480) pour rester lisibles à faible hauteur, une par espace —
`bnClient` (villa avec piscine, ciel bleu), `bnOwner` (villa éclairée au crépuscule), `bnAgency` (villa avec allée),
`bnPromo` (villa avec auvent). Le bandeau du tableau de bord client, auparavant un simple dégradé, reçoit sa photo avec
voile dégradé (`.hero-photo`) afin que le titre et la barre de recherche restent lisibles.
Barre du bas : le surlignage de l'onglet actif n'entoure plus tout l'onglet (icône + libellé) mais seulement l'icône,
soit une pastille de 47×27 px. Ajout des états `:hover` (pastille discrète et libellé en blanc, bouton central éclairci)
et `:active` (léger enfoncement), limités aux appareils avec pointeur via `@media (hover:hover)`.

## 55. Gestion présentée en tiroirs

`#/manage` devient l'accueil de la Gestion : les 18 sections sont rangées en tiroirs (mêmes cartes que le coffre
documents) répartis en 5 catégories — Location, Relation, Technique, Finances, Administration. Chaque tiroir porte une
icône adaptée, une description et un compteur calculé en direct (baux actifs, loyers en retard, unités occupées,
factures à encaisser, messages non lus, membres d'équipe…). Les tiroirs sont filtrés selon les permissions du membre.
Sur une section, la longue bande d'onglets défilante est remplacée par un fil de retour compact
(flèche + « Gestion › Section ») et un sélecteur pour sauter directement à une autre section.

## 56. Plateforme gratuite — suppression de la monétisation

Retiré : constante `PRICING`, formules d'agence (BASIC / BUSINESS / PRO) et leurs limites de biens et d'agents, frais
d'inscription, abonnement mensuel propriétaire, renouvellement, pages Abonnement (propriétaire, agence) et pages admin
Paiements et Abonnements, bandeau et notification d'expiration, blocage de connexion « frais non réglés », blocage de
publication pour abonnement expiré, données de démonstration (paiements, abonnements). `ownerSubscriptionActive()`
renvoie toujours vrai : plus aucune annonce n'est retirée pour non-paiement. Les anciennes adresses redirigent vers le
tableau de bord. Textes mis à jour : accueil public, FAQ, conditions, assistant, choix du rôle à l'inscription,
paramètres admin. Indicateurs admin « Abonnements actifs » et « Revenus simulés » remplacés par « Signalements à
traiter » et « Messages échangés ». Un compte créé est actif immédiatement.
Conservé : le paiement du loyer par le locataire à son propriétaire, et la facturation que propriétaires et agences
adressent à leurs propres clients — ce sont leurs revenus, pas ceux de la plateforme.
Barre du bas réduite une nouvelle fois : 61 → 52 px (libellés .54rem, icônes 19 px, bouton central 36 px).

## 57. Archivage automatique en PDF

Dès qu'un document est créé, son PDF est produit et rangé tout seul dans le tiroir correspondant : devis et proforma →
Devis & proformas, facture → Factures, avoir → Avoirs, reçu de paiement → Reçus, quittance (encaissement par le bailleur
ou paiement en ligne du locataire) → Quittances, contrat (création et renouvellement) → Contrats. `autoFile()` génère,
encode et enregistre la pièce avec un `srcRef` ; `vaultItems()` fusionne alors l'entrée calculée et la pièce archivée
pour n'afficher qu'une ligne, avec « Voir » et « Télécharger ». Aucun doublon si le document est recréé.
Les pièces déposées en image (CNI, titre foncier, attestation) sont converties en PDF A4 via un canvas — tout format
lisible par le navigateur est accepté, l'image est réduite à 1600 px et titrée avec la date de dépôt.
Si la connexion manque, la création aboutit quand même et seul le PDF est différé (message explicite).
Bouton central de la barre du bas : 36 → 30 px, avec un peu d'air au-dessus et au-dessous.

## 58. Signature : le logo tient lieu de D

Le symbole du logo étant un D, le mot qui l'accompagne devient « EUKSIL » : l'ensemble se lit « DEUKSIL ». Appliqué aux
six emplacements (barre publique, barre latérale, en-tête mobile, tiroir de navigation, pied de page, écran d'accueil).
L'espace entre le symbole et le mot est resserré à 3 px pour que les deux se lisent d'un seul tenant. Le nom complet
reste écrit en entier partout ailleurs : titre du navigateur, PDF, textes, attribut `alt` des images.

## 59. Catégories : les cinq tiennent sur une ligne

La bande de catégories, auparavant un défilement horizontal où la cinquième tuile restait coupée, devient une grille
fixe de 5 colonnes égales : plus aucun débordement, vérifié de 320 à 430 px de large. Sur mobile, les libellés passent
à une version courte (Tous, Maisons, Apparts, Terrains, Locaux), les pastilles d'icône descendent à 42 px et les écarts
à 5 px ; le libellé complet reste affiché sur les écrans larges. L'ensemble est posé dans un bloc blanc à filet fin,
coins arrondis et ombre douce, qui le détache du fond.

## 60. Suppression de la vue carte

La bascule Liste / Carte de la recherche est retirée, ainsi que tout ce qui en dépendait : silhouette du Sénégal
(`senegalMapSvg`, style `.senegal-map`), vue `mapViewHtml()`, grille des villes par région (`mapCityGrid`),
positions `REGION_POS`, compteurs `regionCounts()`, état `searchView` / `mapSelectedRegion` et les actions
`map-region`, `map-region-clear`, `map-city`, `map-region-view-all`, `set-search-view`. La recherche affiche
directement la liste des résultats. Motif : la carte n'était pas géoréférencée et n'apportait pas de repère fiable ;
une vraie carte demandera un fond cartographique et les coordonnées des biens.

## 61. Chaîne agence : mandat → commission → reversement

Deux tiroirs ajoutés dans la catégorie Relation.
**Mandats de gestion** (`MDT-AAAA-NNNNN`) : propriétaire mandant, biens confiés (cochés, rattachés automatiquement),
commission en %, période, services inclus, statut actif / expiré / résilié (expiration automatique à l'affichage).
Le mandat fait foi pour la commission : `commissionRate()` prend le taux du mandat actif, sinon le taux de la fiche.
Le PDF du mandat (5 articles) est généré et rangé dans le tiroir Contrats dès la création.
**Reversements** (`REV-AAAA-NNNNN`) : pour chaque propriétaire et chaque mois, loyers encaissés − dépenses − commission
= montant dû ; enregistrement du versement (mode, référence), statut à reverser / reversé, reçu consultable.
**Recherche globale** en tête de l'accueil Gestion : biens, propriétaires, locataires, unités, devis et factures,
paiements, contrats — résultats groupés par type avec lien direct vers la section.

## 62. Tableau de bord selon le cahier des charges

Le tableau de bord du propriétaire et celui de l'agence répondent aux quatre questions attendues, en gardant leur bandeau.
**Ce que vous gérez** : biens, unités, unités occupées, unités vacantes, taux d'occupation. Un bien sans unité déclarée
compte pour une unité, ce qui évite de forcer la saisie d'unités sur une maison individuelle.
**Ce que vous gagnez** (mois en cours) : loyers attendus, encaissé, impayés, dépenses, revenu net.
**À traiter** : uniquement ce qui demande une action — loyers en retard, baux échus sous 45 jours, demandes de
maintenance ouvertes, devis sans réponse, contrats à renouveler, demandes de visite, messages de locataires non lus et,
pour l'agence, les reversements du mois non effectués. Chaque ligne mène directement à l'écran concerné.
**Actions rapides** : les cinq du cahier des charges, différentes pour le propriétaire et pour l'agence.

## 63. Fiche d'un bien en six onglets

Nouvelle page `#/bien/<id>/<onglet>`, atteinte par « Ouvrir » depuis Mes biens. Six onglets :
**Vue générale** (photo, informations, description, propriétaire mandant et sa commission ; à droite le revenu mensuel
avec le taux d'occupation, le détail du mois en cours et un bloc « À traiter » limité à ce bien), **Unités**
(indicateurs puis une carte par unité, loyer en retard signalé, bouton Louer si vacante ; un bien sans unité déclarée
compte pour une seule unité), **Finances** (revenus, impayés, dépenses, net, loyers du bien, dépenses par poste,
rentabilité calculée seulement pour un bien en vente), **Maintenance**, **Documents** (contrats et pièces du bien) et
**Historique** (baux, loyers payés, interventions, dépenses, contrats, du plus récent au plus ancien).
Aucun débordement horizontal, vérifié de 320 à 430 px : sur mobile les six onglets passent en grille fixe avec libellé
court, les tableaux deviennent des cartes, les textes longs sont coupés par des points de suspension et les montants
peuvent aller à la ligne dans leur carte.

## 64. Derniers points du cahier des charges

**§13 Maintenance** : trois états seulement — nouvelle → en cours → terminée (les anciens états sont convertis à la
volée) — et six catégories : plomberie, électricité, climatisation, peinture, serrurerie, autre. Le locataire choisit
aussi la catégorie en signalant un problème. La dépense liée est créée à la clôture, et l'export CSV reprend catégorie,
priorité et prestataire.
**§9 Jour d'échéance** : réglable de 1 à 28 à la création d'un bail, qu'il porte sur un bien entier ou sur une unité.
Le retard d'un loyer est calculé d'après ce jour, et non plus d'après le 5 fixe.
**§7 Unité archivée** : quatrième statut, avec un bouton Archiver / Réactiver. Les unités archivées sortent des listes
et des compteurs ; un bouton les réaffiche à la demande.
**§14 Devis à valider** : une agence règle son seuil dans Gestion › Mes informations (100 000 FCFA par défaut).
Au-delà, un devis portant sur un bien sous mandat passe en « Accord du propriétaire attendu » et ne peut devenir une
proforma tant que l'accord n'est pas enregistré, avec le nom de la personne qui l'a donné, ou refusé.

## 65. Menus par rôle et documents rattachés

**§3 Propriétaire** (11 entrées) : Tableau de bord, Mes biens, Locataires, Loyers, Dépenses, Maintenance, Documents,
Rapports, Messages, Gestion, Paramètres. **§18 Agence** (15) : Tableau de bord, Propriétaires, Mandats, Biens, Unités,
Locataires, Loyers, Devis & Factures, Dépenses, Maintenance, Reversements, Documents, Rapports, Gestion, Paramètres —
Devis et Factures sont réunis, puisqu'ils partagent le même écran. **§23 Locataire** (7) : Mon logement, Mon loyer,
Mes paiements, Mes quittances, Maintenance, Documents, Messages. L'entrée « Gestion » est conservée pour les sections
qui ne sont pas au premier niveau (unités, baux, contrats, prestataires, finances, équipe, journal). La barre mobile
suit les mêmes destinations.
Deux écrans locataire : **Mes paiements** (historique, mode, référence, total versé, caution) et **Mes quittances**
(une carte par loyer réglé, PDF téléchargeable).
**§24 Documents rattachés** : justificatif facultatif au moment d'enregistrer une dépense (converti en PDF, rangé dans
le coffre, consultable depuis la ligne de la dépense), et bouton « Joindre » sur chaque bail pour le bail signé, les
états des lieux d'entrée et de sortie et l'attestation d'assurance, rangés dans le tiroir Contrats.

## 66. Plus de paiement dans l'application

Le paiement du loyer en ligne par le locataire est retiré : écran, formulaire et traitement supprimés. Aucun argent ne
transite par DEUKSIL. Le locataire consulte ses loyers, leur état et le mode de règlement enregistré.
En contrepartie, **l'enregistrement d'un paiement** par le bailleur devient complet (§11) : montant reçu, date du
paiement, mode (espèces, virement, Wave, Orange Money, carte, autre) et référence. L'enregistrement met le loyer à
« payé », trace l'opération au journal, prévient le locataire, génère la quittance et l'archive dans son tiroir.
Le mode apparaît ensuite dans Mes loyers et Mes paiements côté locataire.

## 67. Correction : barre du bas disparue sur les tableaux de bord

La refonte du tableau de bord (§62) découpait le HTML du shell jusqu'au dernier `</div>` : la barre du bas et le bouton
de l'assistant étaient emportés avec la coupe, sur les tableaux de bord propriétaire et agence seulement. Le tableau de
bord est désormais reconstruit en entier (`dashHero()` + `dashHtml()` passés à `shellApp`), sans découpe.
Deux effets de bord des menus allégés (§65) sont corrigés dans la foulée : le bouton central ne dépend plus d'une entrée
de menu (il avait disparu puisque « Ajouter un bien » n'est plus au menu), et les pages sorties du menu restent
atteignables grâce à un bloc **Autres espaces** sur l'accueil Gestion — demandes de visite, statistiques, profil pour le
propriétaire ; agents, clients, visites, commissions, profil pour l'agence. Messages est rendu au menu de l'agence.

## 68. Icônes sur les indicateurs du tableau de bord

Les dix indicateurs du tableau de bord passent de la carte sobre à la carte à pastille d'icône (`kpiRich`), comme
partout ailleurs dans l'application : Biens (maison), Unités (immeuble), Unités occupées (coche), Unités vacantes
(porte), Taux d'occupation (courbe), Loyers attendus (calendrier), Encaissé (pièce), Impayés (alerte), Dépenses
(flèches), Revenu net (tendance). Chaque pastille reprend la teinte de son état : vert pour l'encaissé, rouge pour les
impayés, doré pour les dépenses.

## 69. Une seule barre de recherche

Toutes les barres de recherche adoptent le dessin de celle de l'accueil Gestion : une carte blanche à filet fin
contenant le champ pleine largeur et un bouton carré bleu nuit à loupe. Un helper unique, `sBar(placeholder)`, les
produit toutes — listes de la Gestion (dépenses, baux, loyers, contrats, ventes, journal, prestataires, locataires,
unités), maintenance, propriétaires et coffre documents. Le filtrage en direct est inchangé ; la touche Entrée ne
recharge plus la page. Sur mobile la carte et le bouton se resserrent, sans débordement.

## 70. Un seul fil de retour

Tous les retours adoptent le dessin du fil de la Gestion : une flèche dans un carré encadré, puis le chemin
« Origine › Page en cours ». Un helper unique, `backBar(lien, libellé, page)`, les produit tous — tiroir du coffre
(« Tous les tiroirs › Factures »), fiche d'un bien (« Mes biens › titre du bien »), section de la Gestion
(« Gestion › Loyers »), fiche publique d'une annonce et pages légales. Les anciens liens soulignés « ← Tous les
tiroirs » et « ← Mes biens » disparaissent. Le style vit désormais dans la feuille principale et non dans un module.
Sur mobile le carré et les écarts se resserrent, et un titre long est coupé par des points de suspension.

## 71. Panneau de compte et retrait des biens loués

**Panneau de compte** : il s'ouvre désormais en superposition, juste sous l'en-tête, à n'importe quel endroit de la
page — plus besoin de remonter en haut. Il descend avec une animation courte (220 ms, désactivée si l'appareil réduit
les animations), assombrit le fond, se ferme en touchant ce fond et se referme au changement de page.
**Un bien loué quitte la recherche** : `listable()` remplace l'ancien filtre. Un bien au statut loué, vendu, en
maintenance ou archivé n'apparaît plus aux visiteurs, et un bien portant un bail actif non plus, même si son statut
n'a pas suivi. Un immeuble reste visible tant qu'au moins une unité est libre, et disparaît quand toutes sont prises.
Dès qu'une unité se libère ou qu'un bail prend fin, l'annonce revient. Le message affiché à la création d'un bail
l'annonce explicitement. Les données de démonstration sont rendues cohérentes (le bien loué à Fatou Ndiaye passe au
statut loué).

## 72. Animations et carrousel des biens

Couche d'animations courte et régulière, toutes coupées sous `prefers-reduced-motion` :
entrée de page (les blocs montent de 10 px en 340 ms, décalés de 40 ms), contenu d'un onglet (glissement depuis la
droite, 300 ms), cartes et lignes de liste (apparition décalée), indicateurs (léger agrandissement), fenêtres et
messages (montée douce), survol (carte soulevée de 3 px, pastille d'icône agrandie de 7 %) et appui (léger
enfoncement). Aucune animation ne dépasse 340 ms.
**Carrousel** : au-delà de trois biens, la bande « Recommandés pour vous » défile toute seule de la droite vers la
gauche, en boucle continue (les cartes sont écrites deux fois), avec un fondu sur les bords. Elle s'arrête au survol et
au doigt, et la vitesse s'adapte au nombre de biens ainsi qu'à la taille de l'écran. En dessous de quatre biens, la
bande reste un simple défilement manuel.

## 73. Page de connexion en deux panneaux

Nouvel écran de connexion d'après la maquette fournie. À gauche, un panneau pleine hauteur : photo de villa sous un
voile dégradé, logo, promesse « Votre immobilier, simplement maîtrisé » avec la seconde ligne en doré, phrase
d'accroche et trois repères (Biens, Clients, Gestion simplifiée). À droite, le formulaire centré : logo, pastille
« Espace sécurisé », titre, sous-titre, champ CNI et champ mot de passe à icône avec œil, lien « Mot de passe
oublié ? » (qui explique honnêtement que la réinitialisation n'est pas branchée dans cette démonstration), bouton
« Se connecter → » pleine largeur, lien vers l'inscription, séparateur « ou » et accès secondaire.
Les comptes de démonstration sont conservés sous le formulaire, enrichis du compte locataire. Sous 980 px le panneau
de gauche disparaît et le formulaire prend toute la largeur. Une icône `lock` a été ajoutée au jeu d'icônes, et la
classe du conteneur d'icône renommée pour éviter la collision avec la classe `ic` des SVG.

## 74. Panneau de compte animé et lien « Mot de passe oublié »

Le panneau de compte glisse maintenant dans les deux sens : il descend à l'ouverture (260 ms, léger rebond) et remonte
à la fermeture, au lieu de disparaître d'un coup — `visibility` différée remplace la bascule `display`. Son contenu
suit en cascade (avatar agrandi, puis les trois entrées décalées de 40 ms), et le chevron à côté des notifications
pivote de 180°. Tout est coupé sous `prefers-reduced-motion`.
Le lien « Mot de passe oublié ? » devient une pastille encadrée avec une icône, alignée à droite sous le champ, qui se
teinte au survol et s'enfonce légèrement au clic.

## 75. Animations : compléments après audit

Un audit des styles a montré que les cartes de la page Recherche portent la classe `.prop` et non `.pc` : elles
n'avaient donc aucune animation. Ajouté : apparition décalée des résultats, carte soulevée de 4 px au survol et léger
zoom de la photo (500 ms). Ajouté aussi : battement du cœur quand on met un bien en favori, agrandissement du cœur au
survol, transitions sur les badges, les lignes de tableau et le voile du tiroir latéral. Tout reste coupé sous
`prefers-reduced-motion`.

## 76. Connexion par compte Google (simulée)

La connexion ne passe plus par le numéro de CNI mais par l'adresse Gmail. Deux chemins :
un bouton **« Continuer avec Google »** qui ouvre un
sélecteur listant les comptes « présents sur cet appareil », avec avatar, nom, adresse et rôle, plus l'entrée
« Utiliser un autre compte » ; et le formulaire **adresse Gmail + mot de passe**. `Auth.login()` accepte désormais
l'adresse comme le numéro de CNI, ce qui n'invalide aucun ancien accès. Chaque compte reçoit une adresse Gmail
construite à partir de son nom.
Aucun échange n'a lieu avec Google : il n'y a ni serveur ni OAuth. Le sélecteur le dit explicitement en bas du panneau.
Un vrai « Se connecter avec Google » exigera un identifiant client OAuth et une vérification du jeton côté serveur.

## 77. Connexion : ajustements

La barre « Continuer en tant que … » est retirée : l'écran s'ouvre directement sur « Continuer avec Google », puis le
formulaire. L'icône du champ d'adresse passe de la bulle de message à la silhouette, plus juste pour un identifiant.

## 78. Bulles dégradées sur les cartes d'indicateur

Chaque carte d'indicateur reçoit deux bulles en dégradé radial, une grande en haut à droite et une plus discrète en bas
à gauche, placées sous le contenu. Leur teinte suit l'état de la carte (`data-tone`) : bleu pour le portefeuille, vert
pour l'encaissé, rouge pour les impayés, doré pour les dépenses et les unités vacantes. Les bulles s'agrandissent
doucement au survol. Les cartes d'action rapide reçoivent une bulle unique, en bleu. Rendu vérifié en thème clair et
sombre, sans débordement.

## 79. Accueil : hiérarchie, repères et premiers pas

Les dix cartes égales laissent place à trois niveaux. **Le revenu net** devient une carte large en dégradé bleu avec sa
bulle dorée ; Encaissé et Impayés restent à côté. **Une variation par rapport au mois précédent** s'affiche sous chaque
montant, avec sa flèche et sa couleur (`variation()` compare le mois en cours au précédent et dit « Premier mois
enregistré » quand la comparaison n'a pas de sens). **Un graphique des revenus sur six mois** (barres animées, mois en
cours en bleu plein), **un anneau d'occupation** en `conic-gradient` et **une carte Patrimoine** regroupent les chiffres
secondaires : biens, unités, locataires, dépenses du mois.
**Compte neuf** : un propriétaire sans bien ne voit plus dix zéros mais un accueil « Premiers pas » en trois étapes
numérotées, seule la première étant active.
Mobile : le revenu net garde sa largeur, les autres cartes passent à deux colonnes, le graphique et l'anneau prennent
toute la largeur.

## 80. Audit logique de l'espace propriétaire (biens, paiements, baux, accès)

Chaque point de la liste d'audit a été **testé dans l'application en marche** (navigateur automatisé, démo
neuve à chaque test, actions déclenchées comme par l'interface, y compris depuis un écran resté ouvert ou avec
un identifiant forgé). Les tests sont rejouables : `tests/audit-proprietaire.js` (25 cas) et
`tests/regression.js` (parcours normaux + tour des pages par rôle). Résultat : **17 échecs sur 25 cas ; 16 corrigés**.
Le n° S4 (contrôle serveur) ne peut pas l'être sans backend.

| # | Règle | Avant | Correction |
|---|---|---|---|
| V1 | Pas deux dossiers de vente ouverts sur un bien | déjà respecté | — |
| V2 | Un bien n'est pas vendu deux fois | deux dossiers pouvaient être signés | la promesse et la signature revérifient la règle au moment d'écrire (`motifEtapeVente`) : le premier signé l'emporte |
| V3 | Un bien occupé n'est pas vendu | un dossier ouvert avant le bail se signait quand même | idem : bail actif ou unité occupée → refus |
| V4 | Statut manuel cohérent (bien loué) | « Disponible » accepté avec un bail en cours, l'annonce revenait dans la recherche | le statut découle des baux et des ventes (`motifStatut`) |
| V5 | Statut manuel cohérent (bien vendu) | un bien vendu repassait « Disponible » | un bien vendu ne change plus de statut ; « Vendu » / « Loué » s'obtiennent par une vente ou un bail |
| V6 | Suppression d'un bien engagé | supprimer un bien loué terminait le bail et **effaçait les loyers impayés** | refus si bail actif, vente en cours ou signée, loyers impayés, factures non soldées → archivage proposé |
| V7 | Pas de baux chevauchants | un bail antidaté pouvait commencer avant le départ du précédent | contrôle des périodes par logement (`bailEnConflit`), sur les baux de bien et d'unité |
| V8 | Deux onglets ouverts | l'autre onglet gardait un écran périmé | écoute de l'évènement `storage` : l'écran se redessine (ou prévient si une saisie est en cours) |
| P1 | Paiement partiel ≠ paiement intégral | un acompte marquait le loyer « Payé » et **remplaçait le montant dû** : la dette disparaissait | modèle de versements (ci-dessous) |
| P2 | Reste dû = dû − paiements | non calculable | `rRest(r)` ; le solde rend le loyer payé |
| P3 | Pas de trop-perçu | 3× le loyer accepté, le loyer devenait ce montant | refus au-delà du reste dû ; date future refusée |
| P4–P5 | Facture créée ≠ encaissée ; reste dû exact | déjà respecté (`dState`, `dRest`) | — |
| P6–P7 | Un paiement compté une fois | respecté tant qu'un loyer ne se payait qu'en une fois | avec les acomptes : formulaire verrouillé après envoi, et une référence de transaction ne se saisit qu'une fois (`refDejaUtilisee`) |
| P8 | Impayés et encaissé justes | impayés = montant entier, acomptes absents des revenus | tableaux de bord, finances, fiche d'un bien, relevés mandants, rapports et espace locataire passent par `encLoyers` / `rRest` |
| C1 | Un bail échu ne libère pas le bien | déjà respecté | — |
| C2 | Renouvellement sans chevauchement | aucun moyen de prolonger un bail : après l'échéance, plus aucun loyer n'était dû | bouton **Prolonger** : avenant sur le même bail, échéances ajoutées à la suite, sans doublon, loyer révisable, historique `renewals` |
| C3 | Renouvellement de contrat | le nouveau contrat commençait le jour de fin du précédent (un jour en double) | il commence le lendemain, dure autant, et refuse un contrat actif concurrent sur le même bien |
| C4 | Fin de bail et impayés | « Mettre fin » **supprimait tous les loyers non encaissés**, dettes comprises | date de départ demandée ; seuls les loyers des mois suivant le départ sont annulés (`terminerBail`) |
| C5 | Retard selon le jour d'échéance du bail | déjà respecté (§ 9) | les acomptes s'affichent « Partiel · reste … » |
| S1 | Identifiant forgé à l'écriture | un `data-id` modifié dans l'inspecteur réécrivait le bien d'un autre compte | `saveProperty` vérifie le propriétaire à l'écriture |
| S2 | Actions sur les données d'autrui | un dossier de vente s'ouvrait sur le bien d'un autre compte | `v-new` / `g-deal` exigent un de ses biens ; membres d'équipe : ventes → droit « gestion », liste des biens → droit « biens » |
| S3 | URL forgée | déjà refusée (fiche, édition, dossier de vente) | `/vente/` et `/bien/` ajoutés au contrôle des droits des membres |
| S4 | Contrôles côté serveur | **impossible ici** | voir ci-dessous |

**Modèle des loyers.** `amount` est le montant **dû** et n'est jamais remplacé. Chaque versement est ajouté à
`payments` (`amount`, `date`, `method`, `ref`) ; `paidAt` n'est posé qu'au solde, et la quittance n'est émise
qu'à ce moment (un acompte produit une notification au locataire avec le reste à régler). Les loyers saisis
avant cette version (sans `payments`) comptent comme un versement unique : aucune migration n'est nécessaire.

**Règles retenues pour les baux.** Même locataire, même logement → **prolongation** du bail existant (avenant).
Nouveau locataire → **nouveau bail**, qui ne peut commencer qu'après le départ du précédent. Un bail échu
n'est jamais libéré automatiquement : le logement reste occupé tant qu'on n'a pas cliqué « Mettre fin ».

**S4 — ce que le serveur devra garantir.** Dans cette démo, toutes les données de tous les comptes sont dans
le `localStorage` du navigateur : n'importe qui peut les lire ou les modifier depuis la console, et les mots de
passe sont en clair. Les contrôles ajoutés ici empêchent les erreurs et les manipulations par l'interface, pas
une attaque. En production :
- authentification réelle (mots de passe hachés, session côté serveur) ; l'identité vient de la session, jamais d'un champ envoyé par le client ;
- chaque requête filtrée par `owner_id` côté serveur (ou politique RLS PostgreSQL) : un identifiant inconnu ou d'un autre compte répond 404 ;
- règles d'exclusivité en contraintes de base : index unique partiel « une vente signée par bien », contrainte d'exclusion PostgreSQL sur la période des baux d'un même logement (`EXCLUDE USING gist (logement WITH =, daterange(debut, fin) WITH &&)`) ;
- signature d'une vente, création d'un bail et encaissement dans une transaction avec verrou de ligne (`SELECT … FOR UPDATE`) : deux utilisateurs ne peuvent pas valider en même temps deux opérations incompatibles ;
- table `paiements` à part, avec clé d'idempotence par envoi de formulaire et unicité de la référence de transaction ;
- les règles de ce module (`78-coherence.js`) réécrites côté serveur à l'identique ; celles du navigateur ne servent plus qu'à afficher l'erreur plus tôt.

Fichiers : `js/78-coherence.js` (nouveau), `js/28-gestion.js` (versements, fin de bail), `js/44-reste.js`
(état d'un loyer), `js/05-seed.js`, `js/29-finance.js`, `js/36-v9.js`, `js/37-v10.js`, `js/41-gestion2.js`,
`js/42-dashboard.js`, `js/43-fiche.js`, `js/45-menus.js`, `js/62-assistance.js`, `index.html`.

## 81. Recherche en temps réel, tiroirs de Gestion, mise en page mobile

**Toutes les barres de recherche filtrent pendant la frappe** (`js/79-recherche.js`), sans bouton ni Entrée.
La comparaison ignore accents et majuscules, et plusieurs mots doivent tous apparaître (« aout » trouve
« août », « loyer fatou » croise les deux).
- **Accueil de la Gestion** : seuls les tiroirs concernés par les lettres tapées restent affichés (« loy » →
  Loyers, « artisan » → Prestataires, « facture » → Devis & Factures). Chaque tiroir a une liste de mots
  associés (`MOTS_TIROIR`) : « quittance », « impayé », « panne », « NINEA »… mènent au bon endroit. Les biens,
  locataires, factures, paiements et contrats correspondants s'affichent dessous (« Dans vos données »).
  Entrée ouvre le premier tiroir trouvé.
- **Listes de Gestion** (barre « Rechercher… ») : lignes et cartes filtrées en direct, avec le nombre de
  résultats ; le filtre d'état des loyers (En retard / À venir / Encaissés) se combine avec le texte. Les dossiers
  de vente reçoivent une barre dès trois dossiers.
- **Mes biens** et les listes filtrées automatiquement : même règle d'accents.
- **Recherche de biens** : le champ libre et les filtres détaillés (prix, chambres, surface, quartier, type,
  meublé, parking) s'appliquent pendant la saisie, le curseur reste dans le champ. Sur l'accueil public, les
  biens correspondants sont proposés sous la barre au fil des lettres.

**Mise en page.**
- Les filtres « Tous / Location / Vente » ne touchent plus la barre de recherche (marges des `.rfiltre`).
- **Champs de date sur mobile** : Safari iOS donne aux champs date une largeur propre qui ignore `width:100%`,
  et le champ dépassait de sa carte. Les champs date/heure sont ramenés à la largeur de la colonne, texte aligné
  à gauche, et les colonnes de formulaire acceptent de rétrécir (`min-width:0`). Vérifié sans débordement à
  375 px de large (émulation Chromium ; un contrôle sur un iPhone réel reste conseillé).

## 82. Tableau de bord du propriétaire (refonte) et étapes de vente

**Tableau de bord** (`js/80-tableau-proprietaire.js`, styles en fin de `css/02-refonte.css`), sur la structure validée :
1. **Revenus locatifs** : loyers encaissés du mois, badge du mois, variation par rapport au mois précédent,
   lien « Voir le détail des revenus ».
2. **Total encaissé ce mois** (loyers et factures, hors ventes) et **Loyers impayés** (reste dû des loyers en
   retard), côte à côte.
3. **Évolution des revenus** : six mois en barres horizontales, mois en cours en bleu foncé, montant au bout de
   chaque barre. Données réelles, acomptes compris : plus de graphique illustratif.
4. **Mon patrimoine** : biens, locataires et baux, ventes, documents, chacun avec sa photo et ses chiffres.
   L'occupation ne compte que les logements à louer (un terrain en vente n'est pas « vacant »).
5. **À traiter** : retards, maintenance, contrats à renouveler, visites.
6. **Actions rapides** : ajouter un bien, un locataire, un acheteur, un document ; chaque carte dans sa couleur.
Le bandeau photo d'accueil et l'écran « Premiers pas » (compte sans bien) sont conservés. L'agence garde son
tableau de bord.

**Étapes d'une vente** : la rangée de pastilles défilait et coupait « Vendu » sur mobile. Les cinq étapes
tiennent maintenant sur une ligne de cinq colonnes égales, pastille reliée par un trait et libellé dessous.

## 83. Mode clair uniquement

L'application n'a qu'un thème, clair. Les restes de l'ancien mode sombre sont retirés (lecture de la préférence
`deuksil_theme_pref` dans `60-demarrage.js`). La page interdit aussi au navigateur de l'assombrir de lui-même :
`color-scheme: only light` en CSS et en balise meta (mode sombre automatique de Chrome Android, de certains
téléphones, ou thème sombre de l'application qui affiche la page), et un `data-theme="dark"` posé par l'hôte est
remis à `light`.

## 84. Audit logique de l'espace agence

Testé dans l'application en marche, comme l'espace propriétaire : `tests/audit-agence.js` (12 cas). **Avant : 9
échecs sur les 11 premiers cas ; tous corrigés** (`js/81-agence.js`). Le 12e cas, ajouté avec la correction des relevés,
passe aussi.

| # | Règle | Avant | Correction |
|---|---|---|---|
| A1 | Un reversement qui règle plusieurs mois d'un coup n'est pas redemandé | le reversement était rattaché à un seul mois ; les autres restaient « à reverser » (risque de payer deux fois) | **compte par propriétaire** : dû cumulé − déjà reversé = solde ; un reversement est un montant libre jusqu'au solde |
| A2 | Pas de reversement supérieur au solde | accepté | refusé, avec le solde affiché |
| A3 | Pas de reversement nul | 0 FCFA enregistré, mois marqué « reversé » | refusé |
| A4 | Une dépense saisie après un reversement est imputée | perdue (mois déjà clos) | le solde devient négatif : « à retenir » sur le prochain reversement |
| A5 | Un bien, un mandant | un bien passait d'un mandant à l'autre sans prévenir | refusé : bien déjà confié ou rattaché à un autre propriétaire |
| A6 | Un mandant, un mandat à la fois | deux mandats actifs (8 % et 12 %) sur la même période | refusé si les périodes se chevauchent |
| A7 | Commission au taux du mandat du mois | taux du mandat actif aujourd'hui, appliqué à tout l'historique | taux du mandat en vigueur chaque mois ; hors mandat (avant, après résiliation), pas de commission |
| A8 | Droits des agents | un agent sans droit « finances » pouvait reverser et créer des mandats | reversements → « finances », mandats → « gestion » |
| A9 | Supprimer un mandant | possible avec un mandat actif ou un solde dû | refusé tant qu'il reste un mandat actif ou un solde |
| A10 | Page Commissions | « simulation » : un mois de loyer par bien loué, 3 % par bien vendu | commissions de gestion réelles (12 mois, par mois et par propriétaire) + honoraires estimés, signalés comme tels |
| A11 | Identifiants forgés | déjà refusé | — |
| A12 | Relevé du mandant = compte de l'agence | recalcul à part : sans les dépenses ni les acomptes, au taux de la fiche | le relevé lit le compte de gestion de l'agence |

**Écran Reversements** : comptes des propriétaires (encaissé, dépenses, commission, dû, déjà reversé, solde),
détail des 6 derniers mois, historique des reversements avec reçu (solde avant / après). « À traiter » du tableau
de bord suit le solde.

**Résiliation d'un mandat** : la date de résiliation est enregistrée (`endedAt`) et borne la commission.

**Fichiers non chargés** : `54-comptes.js`, `55-vie.js`, `56-roles.js`, `57-bail-client.js`, `58-interactions.js`,
`59-mandant.js` et `60-demarrage.js` sont d'anciennes versions absentes de `index.html` : les modifier n'a aucun effet.

## 85. Tableau de bord de l'agence

Même structure, même style et mêmes bulles de couleur que le tableau de bord du propriétaire (§ 82), avec ce dont
l'agence a besoin (`js/82-tableau-agence.js`) :
1. **Commissions de l'agence** du mois (gestion locative, au taux des mandats), variation, lien vers le détail.
2. **Quatre indicateurs** : encaissé ce mois, loyers impayés, solde à reverser aux propriétaires, mandats actifs.
3. **Évolution des encaissements** sur six mois, avec la part des commissions.
4. **Mon portefeuille** : propriétaires mandants, biens gérés, locataires et baux, ventes, avec photos.
5. **À traiter** : retards, reversements dus, propriétaires dont les biens sont gérés **sans mandat actif**, mandats
   à renouveler dans les 30 jours, maintenance, visites.
6. **Actions rapides** : ajouter un propriétaire, ajouter un bien, encaisser un loyer, créer une facture.
Un agent sans droit « finances » ne voit pas les montants (cartes 1 à 3) et seulement les actions de son ressort.

## 86. Tous les tableaux de bord sur le même modèle

`js/83-tableaux.js` fournit un gabarit unique (`tbPage`) qui reprend la structure et les bulles colorées des tableaux
de bord propriétaire et agence : grande carte (bleu), quatre petites cartes (vert, rouge, doré, violet), évolution en
barres horizontales (violet), liste avec photos (doré), « À traiter » (rouge ou vert), actions rapides.
- **Client** : biens disponibles (ou correspondant à ses alertes), favoris, visites à venir, messages non lus, alertes,
  nouvelles annonces sur 6 mois, « Mon espace », « À suivre » (visites, réponses, favoris devenus indisponibles), puis
  les biens recommandés. Le bandeau photo avec la barre de recherche est conservé.
- **Locataire** : mon loyer (retards et prochaine échéance), loyers en retard, payé dans l'année, loyer mensuel, fin du
  bail, paiements sur 6 mois, « Mon logement » (bail, quittances, interventions, propriétaire).
- **Administrateur** : activité de la plateforme, utilisateurs, annonces publiées, signalements, annonces à valider,
  nouveaux comptes sur 6 mois, accès aux écrans d'administration, activité récente.
- **Propriétaire mandant** (biens gérés par une agence) : revenus de ses biens, net, reste à percevoir, déjà reversé,
  taux de commission, net sur 6 mois, biens confiés. Les chiffres viennent du compte de gestion de l'agence (§ 84) ;
  avant, ce tableau de bord affichait des zéros, les loyers étant enregistrés côté agence.
Les espaces investisseur et promoteur ont été retirés dans une version antérieure (`57-roles.js`) ; le LISEZMOI
n'annonce plus leurs comptes de test.

## 87. Accueil d'après la maquette (public et client)

`js/84-accueil.js`, styles en fin de `css/02-refonte.css`, photo `img/photos/couverture.jpg`.
- **Couverture** plein cadre sous l'entête (logo blanc + « EUKSIL », menu), « Dakar, Sénégal », titre « Trouvez votre
  prochain bien immobilier au Sénégal », barre de recherche à cheval sur la photo. La photo est très claire à gauche
  (soleil) : un voile marine dégradé et une ombre douce sur le texte gardent le titre lisible, la maison reste visible.
- **Cinq catégories** : Maisons, Appartements, Terrains, Locaux commerciaux, Biens à découvrir (libellés courts sur
  téléphone). La catégorie active est en marine, soulignée de bleu.
- **Biens immobiliers en vedette** : trois cartes (une maison, un appartement, un terrain parmi les plus consultés),
  pastille de type sur la photo, favori, chambres, surface, prix, « Voir plus ». Trois colonnes sur ordinateur,
  défilement au doigt sur téléphone.
- **À la une — Bureaux & commerces** : « Découvrir » ouvre la recherche filtrée sur les bureaux et locaux commerciaux
  (filtre `pro`, retirable comme les autres).
- **Accueil du client** : même page, avec « Mon espace » (favoris, visites, messages, alertes) dans les cartes à bulles.
- **Proportions** : resserrées sur la maquette (titre, catégories, cartes, encart). Sur téléphone, les trois biens en vedette tiennent côte à côte et l'encart « À la une » reste en deux colonnes.

## 88. Un seul bleu : celui du logo

Le logo est marine **#0C2745** et doré **#D0A361**. L'application utilisait une quinzaine d'autres bleus (bleus vifs
#3D8BFF, #1F7BFF, #1D6FE8, marines voisins #00192F, #0F3057…). Ils sont tous remplacés par la famille du logo :
`--brand` / `--nav` #0C2745 (marine du logo), `--brand-2` #081B31 (même teinte, plus foncée), `--info` #1F4673 (même
teinte, plus claire : liens, étiquettes, barres), `--brand-soft` / `--info-soft` #E7ECF3 (voile clair). Sur la photo de
couverture, « Sénégal » passe au doré du logo. Couleur du navigateur (`theme-color`, manifeste) : #0C2745.
Restent volontairement : le violet des bulles « évolution » et « mandats », et le bleu Google du bouton de connexion
Google (charte de Google).

## 89. Recherche de l'accueil et défilement des biens

**Bug corrigé** : en tapant dans la barre de recherche de l'accueil, la liste des biens proposés passait **sous** les
catégories et les cartes (le bandeau isolait son contenu sans priorité d'affichage). Le bandeau passe au premier plan
et la liste devient un menu déroulant posé sur la page (ombre, hauteur limitée, défilement interne).

**Photo de couverture** : filtre sombre uniforme (`brightness(.7)`) en plus du voile marine.

**Défilement des biens en vedette** : neuf biens (tour à tour maison, appartement, terrain, local), trois à l'écran,
un nouveau toutes les 4 secondes ; flèches sur ordinateur, glissement au doigt sur téléphone, flèches du clavier quand
la bande a le focus. Le défilement s'arrête quand on survole, touche ou parcourt la bande, quand l'onglet est caché, et
ne démarre pas si le système demande de réduire les animations.

## 90. Accueil : bas de page d'après la maquette

- **Mon activité récente** (compte connecté) : bandeau voilé de marine, lignes blanches avec pastille ronde selon le
  type (retard en rouge, document, visite ou message en marine), date à droite, « Voir tout ».
- **Comment ça marche** : « Trois étapes pour trouver le bon bien », cartes numérotées 01 / 02 / 03 en doré du logo,
  séparées du texte par un filet (empilées sur téléphone, trois colonnes sur ordinateur).
- **Vous êtes propriétaire** (carte marine, « propriétaire » en doré, coches dorées, bouton doré « Publier un bien »,
  logo en filigrane) et **Vous êtes une agence** (carte blanche, « agence » en doré, bouton marine « Créer un compte
  agence »), côte à côte sur ordinateur.
- **Chiffres** : biens référencés, comptes actifs, villes couvertes, visites organisées, avec pictogramme (2 × 2 sur
  téléphone, une ligne sur ordinateur).
Les témoignages, la FAQ et le pied de page restent inchangés.

## 91. Témoignages qui défilent et questions fréquentes illustrées

- **Témoignages** : cartes d'après la maquette (guillemets, citation, pastille aux initiales, nom et rôle), qui
  **défilent** comme les biens en vedette (trois à l'écran sur ordinateur, un sur téléphone, un nouveau toutes les
  4 secondes, flèches, glissement au doigt). Cinq témoignages. **Ce sont des exemples** : la section l'indique
  (« Exemples de démonstration ») ; il faudra les remplacer par de vrais avis, avec l'accord de leurs auteurs, avant
  la mise en ligne.
- **Questions fréquentes** : chaque question a son icône — publier (flèche vers le haut), gratuité (FCFA), annonces
  à jour (coche), visite (calendrier), commission (pourcentage), version de démonstration (fiole). Réponses dépliables,
  chevron qui pivote. Nouvelle question « Comment publier un bien sur DEUKSIL ? » ; la réponse sur la version finale ne
  parle plus de paiements simulés (il n'y a plus de paiement dans l'application).

## 92. Pied de page prêt pour la mise en ligne

- Plus aucune mention « démonstration », « simulation », « comptes de test » ni « réinitialiser les données » dans le pied de page.
- Nouveau pied de page (js/84-accueil.js, `piedDePage()`) : marque + coordonnées, colonnes Explorer, Professionnels, Aide, Légal ; barre basse « © année DEUKSIL. Tous droits réservés. · Conçu au Sénégal · Haut de page ».
- Coordonnées et réseaux sociaux à renseigner dans `DEUKSIL_CONTACT` (en haut de la section pied de page de js/84-accueil.js) : un champ vide n'est pas affiché, rien n'est inventé.
- La réinitialisation des données de test reste accessible depuis les paramètres administrateur.

## 93. Animations

Module js/85-animations.js + section « Animations » de css/02-refonte.css.
- Transition douce à chaque changement de page ; rien ne se rejoue quand la même page se redessine (recherche, filtres).
- Accueil : photo de couverture qui avance lentement, titre / texte / recherche qui arrivent en cascade, reflet doré sur « Sénégal ».
- Blocs qui apparaissent au défilement, en cascade (catégories, biens, étapes, profils, chiffres, avis, FAQ, cartes des tableaux de bord, pied de page).
- Compteurs qui défilent jusqu'à leur valeur (chiffres de l'accueil, montants des tableaux de bord) ; barres du graphique qui se remplissent.
- Survol : cartes qui se soulèvent, photos qui zooment, icônes qui basculent, flèches qui avancent ; onde au clic sur les boutons.
- Bulles des tableaux de bord qui respirent, alerte des impayés qui pulse, ombre de l'en-tête au défilement, fenêtres et notifications qui glissent.
- Réglage « réduire les animations » de l'appareil respecté : tout s'affiche sans mouvement.

## 94. Bouton flottant « Remonter en haut »

- Bouton rond bleu nuit du logo, flèche blanche, anneau doré qui se remplit au fil de la lecture de la page.
- Apparaît en glissant après environ un écran de défilement, disparaît en haut de page.
- Au clic, la page glisse jusqu'en haut (accélère puis ralentit) ; molette, doigt ou clavier interrompent le glissement. Le lien « Haut de page » du pied de page utilise le même glissement.
- Se place automatiquement au-dessus de l'assistant et de la barre d'onglets du mobile.
- Test : tests/bouton-haut.js.

## 95. Bouton « Remonter en haut » limité à l'accueil, portraits de profil

- Le bouton flottant n'apparaît plus que sur la page d'accueil publique.
- js/86-portraits.js : chaque compte sans photo affiche un portrait illustré d'une personne noire (homme ou femme selon le prénom ; teint, coiffure — afro, tresses, foulard, voile, chignon, calotte —, barbe, lunettes, tenue et fond variés, toujours les mêmes pour un compte). Dessinés en SVG dans le projet : aucun visage réel, aucun droit à payer. La photo ajoutée par l'utilisateur reste prioritaire. Les témoignages de l'accueil utilisent aussi ces portraits.
- Pour forcer le genre d'un compte : champ `sexe` ('F' ou 'M') sur l'utilisateur.

## 96. Barre de recherche de l'accueil

- La barre est à cheval : le bord bas de la photo passe exactement au milieu de la barre (moitié sur la photo, moitié sur le blanc), accueil public comme accueil client. Le décalage est porté par l'animation d'entrée (`pillIn`), qui l'annulait auparavant.
- Sur téléphone, texte d'aide raccourci : « Ville, quartier, type de bien… ».

## 97. Bugs causés par les animations — analyse et corrections

Cause principale : l'animation de changement de page posait un `transform` sur `#app` (gardé à la fin par `animation-fill-mode: both`). Un transform, même neutre, fait de l'élément le repère des descendants `position: fixed` : la barre d'onglets, le panneau du compte et le bouton de l'assistant se plaçaient alors par rapport à la page entière, plus par rapport à l'écran.
- Barre d'onglets du bas : collée en bas du document et entraînée par le défilement (les « vibrations »). → Corrigé : la transition de page ne joue plus que sur l'opacité, sans remplissage.
- Déconnexion : le panneau du compte s'ouvrait en haut du document (hors de l'écran dès qu'on avait défilé). → Corrigé par la même cause ; il s'ouvre sous l'en-tête, là où l'on est.
- Apparition des blocs : la transition de survol des cartes écrasait celle de l'apparition (cartes qui « sautaient » sans fondu). → Apparition jouée par une animation `rvIn` (remplissage `backwards` seulement), qui ne laisse aucun transform derrière elle.
- Onde au clic : elle forçait `position: relative; overflow: hidden` sur le bouton (pouvait déplacer un bouton absolu/fixe et couper pastilles ou menus). → L'onde vit dans son propre cadre ; un bouton déjà positionné garde son positionnement.
- Impression : les blocs pas encore apparus restaient invisibles. → Tout est visible à l'impression.
Tests : tests/anim-diag.js (barre et panneau à l'écran), tests/anim-logout.js (déconnexion des 5 rôles), tests/anim-fixes.js (aucun élément fixe « décroché » sur toutes les pages de chaque rôle, mobile et ordinateur).

## 98. Noms des comptes féminins

Awa Diallo → Alimatou Gueye (administratrice) · Fatou Ndiaye → Tacko Samb (cliente / locataire) · Aminata Ba → Soda Niang (cliente) · Seynabou Diop → Ndèye Sophie (propriétaire).
- Jeu de départ mis à jour (05-seed, 31-rbac, 55/56-vie, 51-uatfix, 66-ventes).
- js/87-noms.js : met à jour une seule fois les données déjà enregistrées dans un navigateur (comptes, baux, messages, notifications, journal).
- Portraits : Alimatou, Tacko (et d'autres prénoms) reconnus comme féminins.

## 99. Nouveau logo : le D sans encadrement, suivi de « EUKSIL »

- img/logo-d-blanc.svg (fonds bleu nuit) et img/logo-d-bleu.svg (fonds clairs) : le D redessiné en vectoriel (net à toutes les tailles), pilier doré #C89858, sans les coins de l'ancien carré.
- img/logo-clair.png (qui gardait les « encadrements ») est supprimé ; LOGO_LIGHT / LOGO_DARK pointent vers les SVG.
- Versions PNG (logo-d-blanc.png, logo-d-bleu.png) pour les PDF ; icônes de l'application (icone-2/3/192/512) refaites : D blanc sur fond bleu nuit.
- Pied de page : le logo n'est plus voilé (opacité 1).

## 100. Logo aligné sur les lettres, icônes à fond blanc

- Le D fait office de première lettre : `.logo .mark` mesure `1cap` (hauteur des capitales de la police) et repose sur la ligne de base — le bas du D est au niveau du bas de « EUKSIL », le haut au niveau du haut des lettres. SVG recadré au plus juste (viewBox 5 2 278.5 291). Même règle dans le tiroir mobile et sur la page de connexion.
- Logo agrandi d'environ 30 % (taille de police du .logo selon l'endroit : 1,6 à 1,9 rem), le D suit grâce à 1cap.
- Icônes de l'application (PWA, apple-touch, onglet) : D bleu nuit sur fond blanc ; manifest background_color #FFFFFF. Sur un téléphone où l'application est déjà installée, la désinstaller puis la réinstaller pour voir la nouvelle icône.

## 101. Revenir à son espace depuis l'accueil

- Connecté, sur l'accueil : bouton « Mon espace » (avec la photo de profil) dans l'en-tête, visible aussi sur téléphone (avant, il était masqué sur mobile).
- Menu hamburger de l'accueil : connecté → « Mon espace » en tête et « Se déconnecter » en bas ; visiteur → « Se connecter » / « Créer un compte » comme avant.
- js/88-espace.js : #/login et #/register renvoient un utilisateur déjà connecté vers son espace.
- Tests : tests/espace-menu.js, tests/espace-parcours.js.
- « EUKSIL » réduit à 64 % du D (`.logo > span{font-size:.64em}`), le bas des lettres sur le même trait que le bas du D ; bloc recentré verticalement dans les en-têtes.
- « EUKSIL » légèrement remonté (`top:-.14em`) par rapport au bas du D, à la demande.

## 102. Refonte d'après les maquettes « Ventes » et « Locataires & baux »

js/89-design.js (habillage, aucune logique modifiée) + section « Refonte d'après maquettes » de css/02-refonte.css.
- Titre de page souligné d'un trait doré ; fil d'Ariane en pastille bleue (retour rond, maison avant « Gestion ») ; menu de section sorti en carte avec chevron.
- Tuiles d'indicateurs : pastille ronde, flèche « voir le détail » (fait défiler jusqu'à la liste), fond teinté selon la couleur ; petites tuiles alignées sur le même style.
- Recherche : champ haut et bouton bleu nuit carré ; « Exporter » avec icône.
- Formulaires : en-tête avec pastille d'icône, titre et sous-titre, trait de séparation ; champs hauts et arrondis avec icône à gauche selon la donnée (bien, immeuble, personne, téléphone, montant, date, lieu…) et chevron dessiné pour les listes ; aides précédées d'un « i ».
- Montants affichés avec espaces (85 000 000) ; l'application lit toujours le nombre brut (formData et .value). Test : tests/design-montants.js.
- Bouton de l'assistant : bulle de discussion bleu nuit avec pastille dorée.

## 103. Maquette « Mes biens » appliquée à toutes les listes

js/89-design.js (suite) + css/02-refonte.css (§ « Maquette Mes biens »).
- Boutons d'action avec icône selon le libellé : Ouvrir/Voir (œil), Modifier (crayon), Mettre en pause, Réactiver, Archiver, Supprimer, Quittance, Encaisser, Relancer, Télécharger, Envoyer, Accepter, Refuser, Renouveler… ; plus hauts et arrondis sur mobile, bouton principal bleu nuit, secondaires blancs bordés.
- Puces de filtre avec icône (Tous, Location, Vente, Terrain, En retard, À venir, Encaissés…) et compteur en pastille, sur une seule ligne sur téléphone ; « 12 biens » en gras.
- Barre « Filtrer cette liste » dans une carte, loupe à gauche, réglages à droite.
- Fiches (tableaux en cartes sur mobile) : carte blanche arrondie, grande photo, titre en gras, lignes libellé / valeur, liste d'état avec chevron, pastille « Publiée » agrandie.
- Appliqué partout : propriétaire, agence, gestion (loyers, baux…), administration.
- Tuiles simples (Finances, Loyers…) converties au même format : pastille ronde avec icône choisie d'après le libellé (Facturé, Encaissé, Impayés, Dépenses, Résultat net…), couleur de la tuile, flèche. Test : tests/design-tuiles.js (aucune tuile sans icône).

## 104. Tous les tableaux de bord au style des maquettes

Propriétaire, agence, client, locataire, administration (et mandant) : cartes blanches arrondies ; bulles décoratives remplacées par un fond teinté (chaque bloc garde sa couleur) ; tuiles et actions rapides avec pastille ronde colorée et flèche dans un rond ; « À traiter » en lignes-cartes avec pastille ronde et flèche ; listes (patrimoine, portefeuille, logement) avec vignettes arrondies et flèche ronde ; « Voir tout » en pastille ; barres du graphique arrondies.
- Listes des tableaux de bord (Mon patrimoine, Mon portefeuille, Mon logement, Plateforme) : icône dans une pastille ronde colorée à la place de la photo.

## 105. Espace agence — premier passage

- Tour des 16 pages de l'agence sur téléphone : aucune erreur, nouveau style appliqué partout.
- Pages courtes (Devis & Factures, Messages…) : la feuille blanche descend jusqu'en bas de l'écran (plus de pan bleu nuit sous le contenu).
- Tuiles : icônes adaptées pour Unités (immeuble), Occupées (clé), Libres (porte), Taux (pourcentage), Tiroirs, Expirent bientôt.

## 106. Logique métier de l'agence (js/90-agence-metier.js)

Tout passe par les écrans existants, sans écran ni notion en double.
- **Règles de l'agence** (Paramètres) : frais de location (mois de loyer, défaut 1), honoraires de vente (% , défaut 3, payés par le vendeur ou l'acquéreur), TVA (défaut 18 %), qui garde la caution (défaut l'agence), part de l'agent (défaut 20 %), pénalité de retard (défaut 0 = aucune), révision annuelle proposée.
- **Mandat de vente** : même formulaire que le mandat de gestion, choix « Gestion / Vente » ; prix, honoraires, payeur, exclusivité, durée ; un bien loué ou déjà sous mandat de vente n'est pas proposé ; passe à « vendu » à la signature.
- **Honoraires réels** : frais de location créés à la signature d'un bail saisi dans l'application, honoraires de vente à la signature d'une vente (taux du mandat de vente, sinon la règle) ; HT, TVA, TTC ; un seul par bail ou par vente ; aucun inventé pour les baux déjà présents (« Facturer » depuis le suivi du bail).
- **Honoraires & cautions** (remplace « Commissions ») : honoraires à encaisser / encaissés, commission de gestion et sa part de TVA, cautions détenues ; encaisser, payer l'agent.
- **Suivi du bail** (un bouton par bail, propriétaire et agence) : état des lieux d'entrée et de sortie (5 pièces, compteurs, clés ; la sortie rappelle l'état d'entrée), préavis de départ, révision du loyer (échéances à venir non payées mises à jour), caution (retenues pour impayés — qui soldent les loyers en retard — et pour réparations, avec motif ; jamais plus que la caution), frais d'agence.
- **Pénalité de retard** : bouton sur un loyer en retard au-delà du délai, une seule fois par loyer.
- **Équipe unique** : les anciens « agents » (liste sans connexion) deviennent des membres de l'équipe ; page Équipe : biens, visites, honoraires générés, commission due ; « Attribuer des biens » (un agent par bien) ; droits dans Gestion › Équipe & accès.
- **Clients** : demandes (louer/acheter, type, budget, lieu, chambres, agent) avec les biens qui correspondent et envoi de la sélection par WhatsApp ; pas de demande en double.
- **À traiter** : départs annoncés, cautions à restituer, honoraires à encaisser.
- **Menu** : Clients, Visites, Ventes, Honoraires, Équipe ajoutés (sans doublon).
- Test : tests/agence-metier.js (26 vérifications).
- Menu de l'agence allégé : Messages, Maintenance, Dépenses et Rapports retirés du menu latéral (toujours accessibles par la barre du bas, la cloche et les tiroirs de Gestion).
- Menu de l'agence : Visites, Équipe et Gestion retirés aussi ; accès par la page Clients (bouton Visites), les Paramètres (carte Équipe) et la barre du bas (Gestion).
- Textes d'exemple (placeholders) ajoutés automatiquement dans tous les champs qui n'en avaient pas, selon la donnée (nom, téléphone, e-mail, CNI, montant, adresse, taux…).

## 107. Densité : blocs plus compacts

Section « Densité » de css/02-refonte.css : tuiles, pastilles (52 → 38 px), chiffres, cartes de tableau de bord, actions rapides, « À traiter », formulaires (champs 54 → 44 px, en-têtes), fil d'Ariane, recherche, puces de filtre, fiches mobiles et boutons réduits d'environ un quart ; même style.

## 108. Espace de l'agent (js/91-agent.js)

Un agent (membre d'une agence, rôle « agent ») réutilise les écrans de l'agence avec le filtre « les miens » : aucun écran en double.
- **Menu** : Tableau de bord, Mes biens, Mes visites, Mes clients, Messages, Mes commissions, Mon profil. **Barre du bas** : Accueil, Mes biens, Publier, Visites, Messages (Messages et Visites étaient devenus inaccessibles).
- **Tableau de bord de l'agent** : visites du jour (titre), sa commission à recevoir, visites aujourd'hui / à confirmer, ses biens, ses clients, prochaines visites, à traiter (visites à confirmer, comptes rendus à faire, clients sans bien correspondant), actions rapides. Plus aucun lien vers une page qui lui est interdite.
- **Mes biens** par défaut, « Toute l'agence » en un clic ; un bien qu'il publie lui est attribué.
- **Mes visites** et **compte rendu** (intéressé, a fait une offre + montant, à revoir, pas intéressé, note) ; une offre sur un bien à vendre ouvre un dossier de vente (stade « offre ») et prévient l'agence. Le responsable voit les comptes rendus et l'agent de chaque visite.
- **Mes clients** : ses demandes seulement (créées à son nom).
- **Mes commissions** : les siennes seulement (à recevoir, versé, en attente d'encaissement).
- **Mon profil** : téléphone, mot de passe (ancien vérifié, 6 caractères, confirmation) ; nom et CNI réservés au responsable.
- Démonstration : biens de Teranga répartis une fois entre les agents actifs (ceux qui ont des visites d'abord).
- Sécurité : la page « Honoraires & cautions » et la vue Visites, remplacées, ont retrouvé leur contrôle d'accès ; messages « mot de passe : demo123 » réservés au responsable ; « Établir le bail » masqué sans droit gestion.
- Tests : tests/agent.js (24), tests/membres-acces.js (28 adresses × chaque membre : aucun accès anormal).

## 109. Pratiques d'agence côté agent (js/91-agent.js, js/90-agence-metier.js)

- **Planifier une visite** : bouton sur « Mes visites », le tableau de bord et chaque demande client. Bien, client (avec ou sans compte), date, heure, note. Visite confirmée d'office, au nom de l'agent ; créneau déjà pris refusé ; le client qui a un compte est prévenu.
- **Visites sans agent** : signalées dans « À traiter » du responsable ; bouton « Confier » sur la visite (option : confier aussi le bien).
- **Messages** : l'agent voit les fils de ses biens et de ses clients, plus ceux que personne ne suit ; le premier qui répond devient l'agent du fil. Il ne peut pas écrire dans le fil d'un collègue. Le responsable voit tout.
- **Rappels** : notification la veille et le jour de chaque visite, à l'agent concerné (ou au responsable si aucun agent), une seule fois par visite. Les notifications personnelles d'un membre s'ajoutent à celles de l'agence.
- **Validation des biens** : un bien publié par un agent passe en « À valider par l'agence » ; le responsable valide ou renvoie avec un motif, que l'agent voit dans « Mes biens ». Réglable dans Paramètres › Règles de l'agence.
- **Commission partagée** : l'agent qui a rentré le bien (`apporteurId`) et celui qui conclut (visite du futur locataire, ou offre de vente) se partagent la part agent selon « Dont part de l'agent qui a rentré le bien » (50 % par défaut). Un seul agent touche tout.
- Test : `tests/agent-pratiques.js` (24 contrôles).

## 110. Messagerie : une boîte par personne, pour tous les acteurs (js/92-messagerie.js)

- Constat (test `tests/messagerie-acteurs.js`) : les échanges locataire ↔ propriétaire / agence passaient par le canal du bail, que le bailleur ne lisait que dans Gestion › Messages locataires (absent du menu de l'agence). Ce qu'écrivait le locataire n'arrivait pas dans « Messages », et une réponse partie de « Messages » n'arrivait pas dans le bail. Un fil client ↔ agence existait en double.
- Le propriétaire et l'agence ont désormais, comme le locataire, une seule boîte : une conversation par personne, qui réunit discussions et échanges du bail (pastille « Locataire »). La réponse à un locataire repart dans le bail ; le locataire répond dans le bail de la conversation ouverte.
- L'agent (sans droit sur les baux) ne voit pas les échanges du bail ; le responsable et le gestionnaire les voient.
- Notifications : elles mènent toujours à la boîte « Messages » du destinataire ; l'ancien lien `#/manage/tmsgs` y redirige.
- Pastille « Messages » : compte aussi les messages de locataires non lus.
- Fils en double entre deux mêmes personnes fusionnés au chargement.
- La bulle de l'assistant est masquée sur l'écran Messages (elle couvrait « Envoyer » sur mobile).
- Test : `tests/messagerie-acteurs.js` (29 contrôles : client, propriétaire, gestionnaire, agence, agent, locataire, mandant).

## 111. Chaque raccourci mène à la bonne section (js/93-liens.js, js/11-router.js)

- Audit `tests/audit-liens.js` (463 liens, 8 profils) : aucune page inexistante ni erreur, mais les raccourcis ouvraient la page générale (« 2 loyers en retard » → tous les loyers, « Ajouter un locataire » → la liste des baux, etc.) et deux tuiles menaient le gestionnaire à « Accès non autorisé ».
- Le routeur comprend des précisions dans l'adresse : `?f=` filtre (retard, nonpaye, paye, confirmer, aujourdhui, avenir, encours, renouveler, impayee, suspendu, sansagent, crafaire, aencaisser), `?q=` recherche, `?s=` section, `?form=` formulaire, `?ouvrir=` action. Elles sont retirées de l'adresse et appliquées à l'arrivée : lignes filtrées avec un bandeau « Filtré : … · Tout afficher », section mise en vue sous l'en-tête, formulaire ouvert avec le premier champ prêt, fenêtre ouverte.
- Règles générales (`REGLES`) : selon la page visée et le texte du raccourci, le lien reçoit sa précision — pour tous les tableaux de bord et listes. Le menu et les rubriques de Gestion ouvrent la rubrique entière.
- Écran Loyers : nouveau bouton « À encaisser » (retards + à venir).
- Un raccourci vers une page interdite au profil (membre) est remplacé par l'équivalent autorisé ou désactivé ; anciennes adresses (`#/manage/tmsgs`, `#/tenant/messages`) remplacées directement.
- « Fin du bail » (locataire) mène à ses contrats au lieu de recharger l'accueil.
- Audit des boutons `tests/audit-boutons.js` : seule erreur réelle, le logo des PDF ne se chargeait pas quand l'application est ouverte depuis un fichier → logo intégré (`js/00-logo-pdf.js`).
- Mobile : une cellule de tableau à plusieurs lignes (titre, catégorie, badge) passe sous son libellé au lieu de déborder.
- Test : `tests/liens-precis.js` (25 clics réels vérifiés).

## 112. Simplification et finalisation (js/94-finalisation.js, AUDIT.md)

Audit complet, problèmes classés et corrigés un par un avec un test pour chacun (`tests/finalisation.js`, 44 contrôles). L'empreinte des tableaux de bord et des actions rapides (`tests/empreinte.js`) reste identique. Détail, résultats des tests, risques restants et prérequis de production : **AUDIT.md**. Version de départ : étiquette Git `avant-finalisation`.
Partie 2 (navigation, formulaires, parcours) : erreurs affichées sous le champ concerné, modification d'annonce en 3 clics, visites planifiées par le propriétaire indépendant, un nom par écran, barre du bas complète pour le mandant — voir AUDIT.md §8 à §10.

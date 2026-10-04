# DEUKSIL — simulation d'un SaaS immobilier sénégalais

Démonstration front-end complète et fonctionnelle : HTML5, CSS3, JavaScript vanilla et `localStorage`.
Aucun backend, aucune base de données distante, aucune API de paiement réelle.

> **Avertissement**
> Cette version est une simulation front-end. Les données d'identité et les mots de passe sont stockés
> localement, en clair, uniquement pour la démonstration. Une version production devra utiliser un backend
> sécurisé, du chiffrement, une authentification adaptée et une gestion conforme aux exigences légales
> applicables. Aucun numéro de CNI réel n'est utilisé : toutes les identités sont fictives.

---

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
  (JPG/PNG, 8 photos maximum). Chaque image est redimensionnée et compressée dans le navigateur (canvas,
  1280 px de large maximum, JPEG qualité 72 %) avant d'être stockée en base64 dans `localStorage`, avec
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

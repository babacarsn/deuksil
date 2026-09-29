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

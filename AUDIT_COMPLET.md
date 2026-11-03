# DEUKSIL — Audit complet : images, Storage, PostgreSQL, performance

Date : 2 novembre 2026 · Phase 1 de la mission (audit seul : **aucun fichier du projet n'a été modifié**).

## 0. Méthode et limites

| Élément | Ce qui a été fait |
|---|---|
| Code examiné | Copie de travail du projet (`index.html`, `css/`, 105 fichiers `js/`, 9 migrations SQL, 2 fonctions Edge, outils, tests). Les références `fichier:ligne` renvoient à cette copie. |
| Exécution | **Réplique locale** de Supabase (PostgreSQL 16, PostgREST, GoTrue, émulation de Storage), comptes et données de démonstration. Chaque test d'écriture a été suivi d'une remise à zéro des données. |
| Production | **Non touchée.** Ni lecture ni écriture sur le projet Supabase hébergé, ni sur deuksil.vercel.app. |
| Images de test | 6 fichiers **synthétiques** (une photo du dossier `img/photos` agrandie avec du bruit pour imiter un capteur de téléphone) : 4032×3024 JPEG (4,7 Mo), 3000×2000 PNG (11,8 Mo), 8000×6000 JPEG (12,4 Mo), portrait avec orientation EXIF 6 (4,7 Mo), JPEG tronqué, fichier texte nommé `.jpg`. Les poids obtenus ne sont pas ceux de vraies photos : le bruit artificiel les rend plutôt pessimistes. |
| Réseau | Mesures locales **sans compression HTTP** (la passerelle de test ne compresse pas). Vercel compresse : les octets réels seront plus faibles (voir §6). Les durées ne valent donc qu'en ordre de grandeur. |
| Secrets | Aucun secret n'est reproduit ici. Vérifié : aucune clé `service_role` dans le code du navigateur. |

Légende : **[CONSTATÉ]** = vérifié dans le code et, quand c'est indiqué, reproduit sur la réplique. **[RECOMMANDATION]** = proposition, pas un défaut observé. **[À VÉRIFIER]** = non vérifiable ici.

---

## 1. Architecture actuelle

- **Application monopage sans framework.** `index.html` charge **106 scripts** dans l'ordre (`js/vendor/supabase-js-2.45.4.min.js`, puis `js/00-…` à `js/99j-…`) et 3 feuilles de style.
- **Routeur par hash** (`js/11-router.js`) : `route(regex, fonction)` produit du HTML en chaîne, injecté dans `#app`.
- **Évolution par surcouches.** Les modules récents redéfinissent les fonctions des anciens. Par exemple, `saveProperty` est défini dans `27-actions.js:82` puis remplacé 4 fois (`63-publication.js:118`, `67-exclusif.js:144`, `78-coherence.js:233`, `94-finalisation.js:58`). Le formulaire de bien est réécrit par `38-ds3.js:166` puis adapté par `94-finalisation.js` et `98b-finitions.js`. **Conséquence pour la suite : toute modification doit viser la dernière surcouche active, sinon elle est écrasée.**
- **Couche de données** (`js/03-storage.js`) :
  - Au démarrage, `DB.charger()` lit **toutes les lignes de toutes les tables** que la RLS autorise pour le profil (`03-storage.js:461-479`, `tablesALire` `:384-389`). Les lignes sont mises en mémoire.
  - Les écrans lisent cette mémoire de façon synchrone (`DB.getData`, `findItem`…).
  - Chaque écriture s'applique d'abord en mémoire, puis part dans une file vers Supabase (`planifier`/`vider`, `:104-153`). En cas de refus, la table est relue depuis la base.
- **Serveur : Supabase.**
  - Auth (PKCE).
  - PostgreSQL : 32 tables `public`, toutes sous RLS.
  - 3 compartiments Storage.
  - 2 fonctions Edge : `gerer-acces` (création et suppression de comptes, clé service côté serveur uniquement) et `assistant-ia`.
- **PWA** : `sw.js` en « réseau d'abord » avec copie hors ligne. Aucun `vercel.json` : en-têtes de cache par défaut de Vercel.

## 2. Technologies

HTML/CSS/JavaScript natif, supabase-js 2.45.4 (copie locale), PostgreSQL (extensions pgcrypto, uuid-ossp, pg_trgm, unaccent, btree_gist, pg_stat_statements), Supabase Auth/Storage/Edge Functions (Deno), Playwright pour les tests, Vercel pour l'hébergement. Aucune dépendance de build : pas de bundler, pas de minification du code applicatif.

## 3. Fonctionnement actuel du système d'images

### 3.1 Parcours d'un ajout de bien avec photos

1. **Formulaire.** Un propriétaire ou une agence ouvre `#/owner/property/new`, un assistant en 3 étapes (`38-ds3.js:166-193`). Photos à l'étape 3 : `photoUploadHtml()` (`24-espace-proprietaire.js:144-160`), champ `<input type="file" accept="image/*" multiple>`.
2. **Sélection** (`27-actions.js:363-374`). Le nombre de fichiers est tronqué à `20 − déjà présentes`. Chaque fichier passe par `readImageAsDataUrl` (`24-espace-proprietaire.js:112-130`) :
   - lecture en data URL ;
   - décodage par `<img>` ;
   - redimensionnement à **1080 px** maximum sur le grand côté ;
   - ré-encodage **JPEG qualité 0,7** par canvas.

   Le résultat est une chaîne base64 gardée dans la variable globale `formPhotos`.
3. **Aperçu.** Grille de miniatures avec un bouton « retirer ». La **couverture est toujours la photo n° 1** : aucun choix, aucun réordonnancement.
4. **Enregistrement** (`saveProperty`, `27-actions.js:82-116` + surcouches) :
   - `DB.addItem`/`updateItem` du bien avec `photos: formPhotos.slice()` (base64) ;
   - puis **immédiatement** `formPhotos = []` et `go('#/owner/properties')` (`:115-116`) : l'utilisateur quitte l'écran **avant** l'envoi ;
   - le message « Annonce publiée » ou « Brouillon enregistré » s'affiche avant tout envoi réel.
5. **Envoi** (asynchrone, dans la file) : `preparerFichiers` (`03-storage.js:204-209`) dépose **toutes les photos en parallèle** (`Promise.all`) dans le compartiment `photos`, chemin `<espace>/<bien>/<uuid>.jpg`, avec **`upsert: true`** (`:199`). Il remplace ensuite chaque data URL par l'**URL publique complète**.
6. **Base.** Ces URL vont dans `properties.photos` (`text[]`, contrainte `cardinality(photos) <= 20`, `20261022000200_tables.sql:93`).
7. **Affichage.** `p.photos[0]` (ou `[index]`) est placé tel quel dans un `<img src loading="lazy">`. **Même fichier pour toutes les tailles d'affichage.**

### 3.2 Constats reproduits sur la réplique (script `audit/images.js`, résultats `audit/images.json`)

| # | Constat | Mesure |
|---|---|---|
| I1 | **[CONSTATÉ — critique] L'envoi des photos échoue** sur la réplique : `upsert: true` sans politique SELECT sur `storage.objects` pour `photos`/`avatars`. Message à l'utilisateur : « Action non autorisée pour votre compte. » Le bien n'est pas créé. | La documentation Supabase confirme : un upsert exige aussi les droits SELECT et UPDATE ; INSERT suffit seulement avec `upsert: false`. Reproduit en SQL : INSERT simple accepté, INSERT … ON CONFLICT refusé. **[À VÉRIFIER en production]** : sur un projet de test, pas sur la production. La photo de profil (`avatars`, même code) est concernée de la même façon. |
| I2 | **[CONSTATÉ]** Compression : 4,7–12,4 Mo en entrée → **76–84 Ko** en JPEG 1080 px. Proportions respectées. Orientation EXIF respectée (portrait → 810×1080). | 5 fichiers sur 6 acceptés en 4,3 s. |
| I3 | **[CONSTATÉ]** Un fichier non image est **ignoré sans message** : le toast dit « Photos ajoutées. » alors qu'un fichier a été rejeté (`.catch(() => null)`, `27-actions.js:368`). | `pas_une_image.jpg` disparu, aucun avertissement. |
| I4 | **[CONSTATÉ]** Un JPEG tronqué est **accepté** et converti en un fichier de 5 961 octets (contenu partiel ; non contrôlé visuellement). | — |
| I5 | **[CONSTATÉ]** La limite de 20 fonctionne côté interface (21 → 20, message, champ désactivé) **et côté base** (contrainte `<= 20`). | — |
| I6 | **[CONSTATÉ]** Les 20 photos en cours d'édition restent en base64 en mémoire du navigateur. | ≈ 2,2 Mo (20 photos). |
| I7 | **[CONSTATÉ]** Envoi (après neutralisation de l'upsert **dans le banc de test seulement**) : 20 requêtes simultanées, aucune barre de progression, aucune reprise individuelle. | 1,67 Mo envoyés en 0,4 s (réseau local). |
| I8 | **[CONSTATÉ]** Un envoi qui échoue fait échouer **tout le bien**. Le bien disparaît (relecture), l'utilisateur est déjà sur une autre page, sa saisie est perdue, et les photos déjà déposées restent. | 2e dépôt coupé → bien absent en base, **2 fichiers orphelins**, toast « Connexion impossible… ». |
| I9 | **[CONSTATÉ]** Retirer une photo d'un bien : l'URL quitte la base, **le fichier reste** dans Storage. | 19 URL en base, 20 fichiers. |
| I10 | **[CONSTATÉ]** Supprimer un bien : **tous ses fichiers restent**, toujours lisibles publiquement. | 20 fichiers après suppression ; URL → HTTP 200. Aucun appel `storage.remove` dans le code (grep : 0 occurrence hors outil d'administration `supabase/outils/vider-fichiers.js`). |
| I11 | **[CONSTATÉ]** Les photos d'un **brouillon** sont publiques par URL (compartiment public). Les chemins contiennent des UUID, donc difficiles à deviner. | HTTP 200 sans compte. |
| I12 | **[CONSTATÉ]** Remplacer une photo n'existe pas : il faut retirer puis ajouter (fichier ancien orphelin, cf. I9). | — |
| I13 | **[CONSTATÉ]** Format unique : tout est converti en JPEG, nommé `.jpg`. Pas de WebP. | — |
| I14 | **[CONSTATÉ]** Les fichiers `.heic` (iPhone) ne sont pas traités spécifiquement. Un navigateur qui ne sait pas les décoder les rejette silencieusement (cf. I3). **[À VÉRIFIER]** sur iPhone et Android réels. | — |

### 3.3 Affichage (script `audit/affichage.js`, bien de test avec 8 photos)

| # | Constat |
|---|---|
| A1 | **[CONSTATÉ — important] La fiche publique n'affiche que les 3 premières photos** (`21-fiche-detaillee-d-un-bien.js:17-18`, bande horizontale). Il n'y a aucune galerie ni visionneuse : **les photos 4 à 20 ne sont jamais visibles** par un visiteur, alors que la carte annonce « 1/8 ». |
| A2 | **[CONSTATÉ]** Carte de recherche affichée en **172×129 px CSS**, mais l'image téléchargée est le fichier complet (en production : 1080 px, ≈ 80 Ko). Pas de `srcset`, pas de miniature. |
| A3 | **[CONSTATÉ]** `loading="lazy"` est présent sur les photos de biens (cartes, fiche, tableaux). Pas de `width`/`height` : léger décalage de mise en page pendant le chargement. Pas de placeholder dédié ; les images en erreur n'ont pas d'image de remplacement (`onerror` absent). Une annonce sans photo affiche une illustration SVG (`sceneSvg`). |
| A4 | **[CONSTATÉ — sécurité]** L'URL de photo est insérée **sans échappement** dans `src="…"` par `photoHtml` (`01-utils.js:12-14`) et `propertyCard` (`98-cartes.js:41-45`). Un guillemet dans une valeur de `photos` injecte un attribut ; test : `data-injecte="1"` apparaît dans le HTML produit. Autres endroits correctement échappés : `84-accueil.js:57`, `83-tableaux.js:53`. La CSP (`script-src 'self'`, sans `unsafe-inline`) empêche l'exécution de gestionnaires inline, ce qui limite l'impact. La base n'impose aucune forme aux valeurs de `photos` : un propriétaire peut y écrire n'importe quel texte ou une URL externe, via l'API. |

## 4. Supabase Storage

| Compartiment | Public | Limite | Types | Chemins |
|---|---|---|---|---|
| photos | oui | 5 Mo | jpeg, png, webp | `<espace>/<bien>/<uuid>.jpg` |
| avatars | oui | 2 Mo | jpeg, png, webp | `<utilisateur>/<uuid>.jpg` |
| documents | non (URL signées 6 h) | 10 Mo | pdf, images, Office, txt | `<espace>/…`, `conv/<conv>/…`, `bail/<bail>/…` |

Politiques (`20261022000600_stockage.sql`) : dépôt, remplacement et suppression via `app.dossier_autorise`.

- **[CONSTATÉ — bon]** Le 1er dossier doit être l'espace de l'utilisateur, avec le droit « biens » pour `photos`. Un compte ne peut donc pas écrire chez un autre (vérifié en SQL).
- **[CONSTATÉ]** Pas de politique SELECT pour `photos` et `avatars` : sans conséquence pour la lecture publique, mais **bloquant pour l'upsert** (I1).
- **[CONSTATÉ]** Le 2e dossier (`<bien>`) n'est pas contrôlé :
  - un membre peut déposer des fichiers dans un dossier qui ne correspond à aucun de ses biens ;
  - un **agent** ayant le droit « biens » peut supprimer, par l'API, les fichiers des biens de ses collègues, alors que la RLS de `properties` lui interdit de modifier ces biens (`20261022000400_rls.sql:47-51`).
- **[CONSTATÉ]** Aucun plafond du nombre de fichiers par bien côté Storage : la limite de 20 ne porte que sur les références en base.
- **[CONSTATÉ]** Aucun nettoyage des orphelins, ni à la suppression d'un compte (`gerer-acces` n'appelle pas Storage).
- **[CONSTATÉ]** Le contrôle du type repose sur le type déclaré. Les fichiers produits par l'interface sont de vrais JPEG (ré-encodés par canvas), mais un appel direct à l'API peut déclarer `image/jpeg` pour un autre contenu. **[À VÉRIFIER]** : contrôle réel du contenu par le service Storage hébergé.
- Rappel Supabase : supprimer des lignes de `storage.objects` en SQL laisse les fichiers physiques. Le nettoyage doit passer par l'API Storage.

## 5. PostgreSQL

- **Tables** : 32 tables `public`, **RLS activée sur toutes** (vérifié dans le catalogue), 2 à 8 politiques chacune. Clés primaires UUID générées dans le navigateur (`uid()`), acceptées telles quelles.
- **Biens et photos.** Pas de table de photos. `properties.photos text[]` contient des URL complètes. Pas de métadonnées : format, poids, dimensions, ordre explicite, couverture. La couverture se déduit de la position.
- **Intégrité** :
  - `properties.owner_id` → `profiles` ON DELETE CASCADE ;
  - déclencheur `controler_annonce` : niveau de vérification, changement d'espace, compteurs, CNI avant publication ;
  - contrainte `cardinality(photos) <= 20`.
- **Index sur `properties`** : `owner_id`, `agent_id` (partiel), `client_owner_id` (partiel), `created_at` des annonces publiées (partiel). Justifiés et mesurés dans `docs/INDEX.md` et `docs/PERFORMANCES.md` (migration 0800, gains ÷4 à ÷1424 sur 1 million de lignes synthétiques).
- **[CONSTATÉ]** **35 clés étrangères sans index de tête**, par exemple `units.owner_id`, `conversations.property_id`, `deals.property_id`, `contracts.property_id`, `documents.property_id`, `billing_payments.property_id`, `fees.property_id`, `sale_mandates.property_id`, `visits.agent_id`, `lease_messages.owner_id`. Sans index, la suppression d'un bien ou d'un profil parcourt ces tables entièrement (contrôles ON DELETE). **[RECOMMANDATION]** : mesurer avant d'ajouter, comme pour la migration 0800, et ne garder que les index utiles.
- **Transactions.** Chaque écriture est une requête PostgREST indépendante. Exemple : bien + photos + notification = plusieurs requêtes sans transaction commune. Les dépendances sont ordonnées (`ORDRE_ECRITURE`) et les erreurs 23503 rejouées une fois.
- **Concurrence.** Dernier écrit gagnant : pas de contrôle de version sur `updated_at`. **[CONSTATÉ]** Une modification de `extra` réécrit tout le jsonb (`03-storage.js:176`).
- **Doublons.** Identifiant attribué par le navigateur, donc pas de doublon en cas de nouvelle tentative de la même opération. Un double clic sur « Publier » passe par une fenêtre de confirmation (`63-publication.js:118-123`). **[À VÉRIFIER]** : double clic sur « Enregistrer le brouillon ».

## 6. Requêtes et chargement (mesures locales, `audit/perf.js`, `audit/perf.json`)

| Profil | Appels REST au démarrage | Tables en mémoire | Requêtes totales | Octets (non compressés) | Données prêtes |
|---|---:|---:|---:|---:|---:|
| Visiteur | 3 | 2 | 118 | 1,92 Mo | 1,9 s |
| Visiteur, réseau ralenti 1,6 Mbit/s, 150 ms | 3 | 2 | 119 | 1,99 Mo | 13,8 s |
| Propriétaire | 45 | 14 | 160 | 1,95 Mo | 2,4 s |
| Agence | 33 | 11 | 148 | 1,95 Mo | 2,1 s |
| Administrateur | 35 | 19 | 150 | 2,03 Mo | 2,1 s |

- **[CONSTATÉ]** Code chargé avant le premier écran : **106 scripts, 1,40 Mo** (gzip ≈ 413 Ko, brotli ≈ 306 Ko, calculés sur le fichier concaténé), plus 213 Ko de CSS (gzip ≈ 47 Ko). Tous les écrans de tous les profils sont chargés pour chaque visiteur.
- **[CONSTATÉ]** Le visiteur télécharge **toutes les annonces publiées** et l'annuaire de tous les propriétaires et agences. `toutesLesLignes` (`03-storage.js:333-341`) enchaîne des pages de 1 000 lignes jusqu'à la fin, **l'une après l'autre**. Recherche, filtres et pagination se font ensuite en mémoire (`19-map.js:50-52`).
  - Mesure : 1 017 octets JSON par annonce sans photos (36 colonnes, dont `description` et `extra`).
  - **Calcul (pas une mesure)** : une URL de photo de production fait environ 187 caractères. Avec 20 photos, une annonce pèse ≈ 4,7 Ko de JSON. Pour 5 000 annonces publiées : ≈ 23 Mo non compressés, en 5 requêtes successives, avant l'affichage des données. C'est le **premier verrou de montée en charge**, avant même les images.
- **[CONSTATÉ]** Pas de N+1 « par ligne » : une requête par table. Mais le chargement est total. Les connectés font 33 à 45 appels REST au démarrage, et rechargent une table entière après chaque refus d'écriture.
- **[CONSTATÉ]** Documents privés : URL signées par lots de 100 au chargement (bien).
- **[CONSTATÉ]** Cache. Pas d'en-têtes personnalisés. Le service worker revalide chaque fichier à chaque ouverture (`fetch(req, {cache: 'no-cache'})`), soit plus de 100 allers-retours conditionnels sur mobile. Photos : `cacheControl` par défaut de supabase-js. **[À VÉRIFIER]** : valeur effective sur le projet hébergé.

## 7. Sécurité

| Point | État |
|---|---|
| Clé `service_role` dans le navigateur | **[CONSTATÉ — bon]** absente. Utilisée seulement par `gerer-acces` via variable d'environnement. |
| Rôles fournis par le navigateur | **[CONSTATÉ — bon]** rôle, droits, vérification et CNI contrôlés en base (RLS, déclencheurs `proteger_profil`, `controler_annonce`). |
| RLS | **[CONSTATÉ — bon]** sur toutes les tables ; suites existantes `securite-rls.test.js` (65/65 à la dernière exécution), accès, XSS. |
| CSP | **[CONSTATÉ — bon]** stricte sur les scripts. `img-src https:` autorise toute image externe (cf. A4). |
| Échappement des URL de photos | **[CONSTATÉ — à corriger]** A4. |
| Storage | **[CONSTATÉ]** I1 (upsert), 2e dossier non contrôlé, droit de suppression des agents, orphelins, photos de brouillons publiques. |
| Tests existants | **[CONSTATÉ]** Le test F6 (`tests/formulaires.js:112-115`) vérifie la sélection de 20 photos mais **jamais leur envoi**. C'est pourquoi I1 n'a pas été détecté. |

## 8. Problèmes identifiés (constatés), par priorité

| Priorité | Réf. | Problème |
|---|---|---|
| **P0 bloquant** | I1 | Envoi des photos et avatars refusé (upsert sans SELECT) : à confirmer sur un projet de test, mais reproduit et conforme à la documentation Supabase. |
| P0 | I8 | Un échec d'envoi supprime tout le bien après que l'utilisateur a quitté l'écran ; saisie perdue, message trompeur affiché avant l'envoi. |
| P1 | A1 | Photos 4 à 20 jamais visibles par les visiteurs. |
| P1 | A4 | URL de photo non échappée dans 2 gabarits ; valeurs de `photos` non contrôlées en base. |
| P1 | §6 | Chargement de toutes les annonces publiées (et de toutes les données de l'espace) au démarrage. |
| P1 | I9, I10, I12 | Fichiers orphelins à chaque retrait, échec ou suppression ; photos d'annonces supprimées toujours publiques. |
| P2 | A2 | Même image de 1080 px pour une carte de 172 px ; pas de variantes. |
| P2 | I3, I4, I14 | Rejets silencieux ; fichier corrompu accepté ; HEIC non géré. |
| P2 | §4 | Agent pouvant supprimer les fichiers des biens de ses collègues ; 2e dossier non contrôlé. |
| P2 | — | Pas de choix de couverture, pas de réordonnancement, pas de remplacement. |
| P3 | §5 | 35 clés étrangères sans index (impact à mesurer). |
| P3 | §6 | 106 scripts non minifiés ; revalidation de chaque fichier à chaque ouverture. |

## 9. Risques en cas de forte croissance

1. **Données.** Le temps avant affichage et la mémoire du téléphone croissent avec le nombre d'annonces (§6). Au-delà de quelques milliers d'annonces, l'ouverture devient lente sur réseau mobile.
2. **Bande passante.** Chaque carte télécharge une image pleine taille ; une page de résultats coûte plusieurs fois le nécessaire.
3. **Stockage.** Les orphelins s'accumulent sans limite et sont facturés. Rien ne permet de les détecter aujourd'hui.
4. **Écritures.** Une connexion instable fait perdre des annonces entières (I8).
5. **Comptes nombreux.** L'annuaire public est renvoyé en entier à chaque visiteur.

## 10. Ce qui fonctionne correctement

- Compression côté navigateur : poids divisé par environ 60 sur les images de test, orientation respectée, proportions conservées.
- Limite de 20 appliquée côté interface **et** base.
- RLS complète, contrôles métier en base, absence de secret dans le navigateur, CSP.
- Index justifiés et mesurés (migration 0800) ; URL signées pour les documents privés.
- `loading="lazy"` sur les photos de biens ; illustration de repli sans photo.
- Organisation des chemins par espace puis par bien ; noms de fichiers UUID (pas de collision).
- Outils de sauvegarde et de restauration (base + fichiers), réplique locale complète avec émulation Storage soumise à la RLS.

## 11. À conserver

- Le contrat `DB.*` et la mémoire locale pour les données de gestion (petits volumes par espace). Le remplacer serait une reconstruction.
- `properties.photos text[]`, **lu par 10 modules** (cartes, tableaux de bord, accueil, fiche, IA) : le garder comme liste d'affichage, compatible avec les données existantes.
- La convention de chemin `photos/<espace>/<bien>/…` et `app.dossier_autorise`.
- La contrainte des 20 photos en base ; le déclencheur `controler_annonce`.
- La compression côté navigateur (gratuite, déjà en place), à enrichir plutôt qu'à remplacer.

## 12. À améliorer

- Dépôt : `upsert: false`, un fichier à la fois avec progression réelle, reprise individuelle, envoi **avant** l'enregistrement du bien, utilisateur maintenu sur l'écran jusqu'au résultat.
- Variantes et `srcset`/`sizes` ; galerie complète sur la fiche.
- Messages : fichier refusé, nombre de photos optimisées, échec par photo.
- Échappement des URL ; contrôle en base du format des valeurs de `photos`.
- Politiques Storage : 2e dossier = bien de l'espace ; agent limité à ses biens.
- Annonces publiques : chargement paginé côté serveur pour le visiteur (catalogue), au lieu du tout-en-mémoire.

## 13. Manquant

- Métadonnées des photos (format, poids, dimensions, variante, ordre, couverture).
- Nettoyage des fichiers orphelins (retrait, échec, suppression de bien ou de compte) et contrôle de cohérence base ↔ Storage.
- Choix de la couverture, réordonnancement, remplacement.
- Tests d'envoi réel de photos (la suite actuelle s'arrête à la sélection).

## 14. Recommandations techniques

**R1 — Correctif immédiat, indépendant du reste.** Passer `upsert: false` dans `deposer()` (`03-storage.js:199`). Les noms sont des UUID neufs : l'écrasement n'est jamais utile. Une seule ligne, aucun changement de base.
- Alternative backend : ajouter une politique SELECT miroir pour `photos` et `avatars`. Moins bonne : elle ouvre `list()` sur ces dossiers.
- Avant tout, **vérifier sur un projet Supabase de test** que l'envoi échoue bien aujourd'hui, puis qu'il passe avec le correctif.

**R2 — Variantes générées dans le navigateur.**
- Supabase propose des transformations d'images à la volée, **facturées** (plans Pro et supérieurs : 100 images d'origine incluses, puis 5 $ par tranche de 1 000).
- Générer les variantes au moment de la sélection est gratuit et cohérent avec l'existant (canvas).
- Proposition, à valider par mesure en phase 2 :

| Variante | Largeur | Usage |
|---|---|---|
| `s` | 480 px | listes, tableaux |
| `m` | 960 px | cartes ; un téléphone à densité 3 affiche une carte de ~360 px CSS ≈ 1 080 px physiques |
| `l` | 1 600 px | fiche, galerie |

- Format WebP si le navigateur sait l'**encoder** (testé à l'exécution : `canvas.toBlob('image/webp')` renvoie bien `image/webp`), sinon JPEG. Qualité réglée par mesure sur de vraies photos, pas fixée d'avance.
- Le navigateur choisit la variante via `srcset`/`sizes` ; la variante `l` n'est chargée que dans la galerie.

**R3 — Données des photos.**
- Ajouter une table `property_photos` : id, property_id (FK cascade), owner_id, chemin de base, format, largeur, hauteur, poids par variante (jsonb), position, `is_cover`, created_at.
- RLS calquée sur `properties` ; index `(property_id, position)` ; déclencheur de plafond à 20.
- **Garder `properties.photos`**, recalculé par déclencheur (URL `m`, couverture en tête) : les modules existants continuent de fonctionner sans changement.
- Les anciennes annonces (URL simples) restent valides ; une migration non destructive crée leurs lignes `property_photos` sans variantes.

**R4 — Nettoyage.**
- File `app.fichiers_a_supprimer`, alimentée par déclencheur à la suppression d'une photo, d'un bien ou d'un compte.
- Fonction Edge planifiée qui supprime ces fichiers **par l'API Storage** (clé service côté serveur uniquement).
- Rapport de cohérence : fichiers sans ligne, lignes sans fichier. Il ne supprime rien sans délai de grâce : 24 h pour les dépôts inachevés.

**R5 — Politiques Storage.**
- Pour `photos` : le 2e dossier doit être un bien de l'espace, et un agent ne peut écrire ou supprimer que pour ses biens attribués.
- Plafond de fichiers par bien vérifié en base au moment de l'enregistrement.

**R6 — Catalogue paginé** (hors images, mais c'est le premier frein de croissance).
- Pour le visiteur et la recherche : une fonction `rechercher_annonces(filtres, tri, page)` côté base.
- Colonnes nécessaires seulement, couverture seule, 20 résultats par page. Index adaptés aux filtres réels (région, ville, type, prix).
- Les espaces de gestion gardent le chargement actuel.
- À traiter **après** les images, en lot séparé : c'est un changement de comportement de la recherche.

**R7 — Livraison du code** (plus tard, lot séparé). Concaténation et minification des 106 scripts au moment de la publication, sans changer le code source. Cache long sur les fichiers versionnés.

## 15. Plan de modification frontend (après validation)

| Lot | Contenu | Fichiers visés (dernière surcouche active) |
|---|---|---|
| F0 | `upsert: false` (R1) | `js/03-storage.js` |
| F1 | Échappement des URL de photos | `js/01-utils.js`, `js/98-cartes.js` |
| F2 | Module `photos` : contrôle du type réel (signature des octets), décodage, orientation, variantes s/m/l, WebP ou JPEG, messages par fichier | nouveau `js/9xx-photos.js`, branché sur `photos-input` |
| F3 | Sélecteur : aperçu, compteur x/20, retrait, remplacement, réordonnancement (glisser et boutons), choix de couverture | remplace `photoUploadHtml` par surcouche |
| F4 | Envoi à la sélection, un fichier à la fois (2 en parallèle au plus), progression réelle (XHR `upload.onprogress`), reprise par photo, boutons verrouillés pendant l'envoi, enregistrement du bien seulement quand tout est déposé | module F2 + surcouche de `saveProperty` |
| F5 | Affichage : `srcset`/`sizes`, `width`/`height`, placeholder, image de repli `onerror`, galerie complète de la fiche avec visionneuse | `photoHtml`, `propertyCard`, fiche (`98b-finitions.js`) |
| F6 | Tests Playwright : envoi réel, 21e photo, corrompue, échec et reprise, suppression, couverture, ordre | `tests/` |

Design inchangé : composants, couleurs et typographie existants.

## 16. Plan de modification backend (après validation)

| Lot | Contenu | Réversible |
|---|---|---|
| B1 | Migration `property_photos` + RLS + index + déclencheurs (plafond 20, synchronisation de `properties.photos`) | oui : suppression de la table, `photos` intact |
| B2 | Reprise non destructive des photos existantes vers `property_photos` | oui |
| B3 | Politiques Storage resserrées (2e dossier, agent) | oui : anciennes politiques conservées dans la migration |
| B4 | File de suppression + fonction Edge planifiée + rapport de cohérence (lecture seule d'abord) | oui |
| B5 | Contrôle en base du format des valeurs de `photos` (préfixe du compartiment du projet) : contrainte `NOT VALID` d'abord, sans bloquer les lignes existantes | oui |
| B6 | Mesure puis index des clés étrangères utiles | oui |
| B7 | `CONTRACT_FRONTEND_BACKEND.md` : fonctions, chemins, erreurs, reprises | — |

Chaque migration est testée sur la réplique (suites RLS, formulaires, CNI, accès, XSS), puis sur un projet Supabase de test, **jamais d'abord en production**.

## 17. Risques et protections

| Risque | Protection |
|---|---|
| Surcouches qui écrasent une correction | Modifier la dernière surcouche ; test de non-régression sur l'écran réel (Playwright), pas sur la fonction isolée |
| Anciennes annonces sans variantes | Repli : l'URL d'origine sert pour toutes les tailles ; aucune donnée réécrite |
| Encodage WebP indisponible (anciens Safari) | Détection à l'exécution, repli JPEG |
| Suppression d'un fichier encore utilisé | File de suppression alimentée uniquement par la base ; délai de grâce ; rapport en lecture seule avant activation |
| Migration en production | Sauvegarde (`supabase/sauvegarde/`) avant, migrations additives, aucune suppression de colonne ou de donnée sans votre accord |
| Différences réplique / Supabase hébergé (Storage émulé) | Recette sur un projet Supabase de test avant la production |

---

### Décisions à prendre avant la phase 2

1. **Valider R1 tout de suite** (une ligne, frontend) après vérification sur un projet de test ? C'est indépendant du reste et peut débloquer l'ajout de photos.
2. **Table `property_photos` (R3)** : d'accord pour une nouvelle table, `properties.photos` étant conservé et synchronisé ?
3. **Variantes 480 / 960 / 1 600 px** générées dans le navigateur (gratuit) plutôt que les transformations Supabase (payantes) ?
4. **Catalogue paginé (R6)** : dans cette mission, ou lot suivant ?
5. **Projet Supabase de test** disponible pour la recette avant production ?

### Annexes (fichiers fournis à côté)

`audit/images.js` et `images.json`, `audit/affichage.js` et `affichage.json`, `audit/perf.js` et `perf.json` : scripts exécutés et résultats bruts. Le banc convertit le multipart en corps brut, car l'émulation locale de Storage ne lit pas le multipart que le vrai Supabase accepte. Pour mesurer la suite de la chaîne après I1, il a aussi neutralisé l'upsert (variable `SANS_UPSERT`). Ces deux adaptations ne concernent que le banc, pas l'application.

Sources externes :

- [Supabase — Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase — 403 « new row violates row-level security policy » à l'envoi](https://supabase.com/kb/troubleshooting/storage-error-403-forbidden-new-row-violates-row-level-security-policy-on-upload)
- [Supabase — Usage des transformations d'images](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations)
- [Supabase — Fichiers orphelins et suppression par SQL](https://supabase.com/kb/troubleshooting/storage-unexpectedly-high-usage-or-exceed_storage_size_quota-errors)

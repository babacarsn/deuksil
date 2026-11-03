# DEUKSIL — Photos des biens

État au 2 novembre 2026 (phases 2 à 4 de la mission images). Ce document décrit le fonctionnement réel après les changements, les responsabilités frontend et backend, et la mise en service.

## 1. Ce qui change pour l'utilisateur

| Avant | Après |
|---|---|
| Photos réduites à 1 080 px en JPEG, gardées en mémoire, envoyées **après** avoir quitté le formulaire | Photos contrôlées, optimisées et **envoyées dès la sélection**, avec une progression réelle |
| Un seul envoi raté faisait disparaître toute l'annonce | L'annonce n'est enregistrée qu'une fois toutes les photos envoyées ; en cas d'échec, la saisie reste à l'écran |
| Fichier invalide ignoré sans message | Motif affiché sous la photo (pas une photo, photo endommagée, trop petite, HEIC illisible…) |
| Couverture = 1re photo, ordre figé | Choix de la couverture (étoile), flèches et glisser-déposer pour l'ordre, bouton Remplacer |
| La fiche montrait 3 photos sur 20 | Toutes les photos : bande défilante sur téléphone, bouton « N photos », visionneuse plein écran (flèches, clavier, glissement) |
| Même image de 1 080 px pour une carte de 172 px | Le navigateur choisit la variante adaptée à l'écran (480, 960 ou 1 600 px) |
| Photos retirées et biens supprimés : fichiers conservés indéfiniment | Fichiers inutiles supprimés par un nettoyage planifié |
| Le lien « Modifier » d'un bien ouvrait « Cette adresse n'existe pas » | Corrigé : la route acceptait les identifiants sans tiret, pas les UUID |

Messages affichés : « Photo ajoutée et optimisée », « Envoi : 3/8 photos · 5 restantes », « Échec de l'envoi » + « Réessayer », « Nouvelle tentative d'envoi », « Limite de 20 photos atteinte », « Photo supprimée », « Photo définie comme couverture », « Photo remplacée ». Aucun terme technique (WebP, compression) n'est montré.

## 2. Traitement d'une photo (navigateur, `js/00-photos-traitement.js`, utilisé par `js/99k-photos.js` et `DEMO/`)

1. **Contrôles.**
   - Taille ≤ 30 Mo.
   - **Vrai format lu dans les premiers octets** : JPEG, PNG, WebP, GIF, HEIC/AVIF. Le nom et le type déclaré ne comptent pas.
   - JPEG et PNG **complets** : marqueur de fin de l'image principale présent ; les données ajoutées après, comme la vidéo d'une « photo animée », sont acceptées.
   - Décodage réussi.
   - ≤ 80 mégapixels.
   - Grand côté ≥ 300 px.
2. **Orientation** appliquée (EXIF, `imageOrientation: 'from-image'`), proportions conservées, **aucun recadrage**.
3. **Variantes** (grand côté, jamais agrandi) :

   | Variante | Taille | Usage |
   |---|---|---|
   | `s` | 480 px | listes, tableaux, cartes sur écran simple densité |
   | `m` | 960 px | cartes sur écran haute densité, bande de la fiche |
   | `l` | 1 600 px | visionneuse |

   Si deux variantes auraient la même taille (photo plus petite que 960 ou 1 600 px), aucune copie n'est créée : la description pointe vers le fichier existant (`"fichier": "m"`).
4. **Format.**
   - WebP si le navigateur sait l'encoder (vérifié au premier usage), sinon JPEG.
   - Qualité 0,80 à 0,85.
   - Réduction par moitiés successives puis lissage « high » : pas de crénelage.
   - Les métadonnées (EXIF, GPS) ne sont pas recopiées : le canvas ne les transmet pas.
5. **Envoi.**
   - Une photo à la fois, deux en parallèle au plus.
   - Corps brut via `XMLHttpRequest` : progression réelle en octets.
   - `x-upsert: false` (un nom n'est jamais réutilisé) et `cache-control: max-age=31536000`.
   - Une reprise automatique après une coupure, puis bouton « Réessayer » : seules les variantes manquantes de cette photo sont renvoyées.
   - Retour du réseau : les envois coupés reprennent seuls.
   - Fermer l'onglet pendant un envoi : demande de confirmation.

### Mesures (réplique locale, Chromium, fichiers synthétiques bruités — voir `supabase/tests-local/resultats/photos.json`)

| Fichier d'origine | s | m | l |
|---|---:|---:|---:|
| JPEG 4032×3024, 4,7 Mo | 480×360, 18 Ko | 960×720, 50 Ko | 1600×1200, 111 Ko |
| PNG 3000×2000, 11,8 Mo | 480×320, 17 Ko | 960×640, 47 Ko | 1600×1067, 123 Ko |
| JPEG 8000×6000, 12,4 Mo | 480×360, 18 Ko | 960×720, 49 Ko | 1600×1200, 102 Ko |
| Portrait EXIF 6, 4,7 Mo | 360×480, 18 Ko | 720×960, 50 Ko | 1200×1600, 110 Ko |
| Photo réelle 760×570, 88 Ko | 480×360, 28 Ko | 760×570, 66 Ko | = m |

Ce que ces mesures montrent :
- **Avant**, chaque photo pesait environ 80 Ko (JPEG 1 080 px) et cette même image servait partout.
- **Téléchargement** : une carte de recherche sur un écran de 390 px de densité 1 charge la variante `s` (18 Ko au lieu d'environ 80 Ko). Sur un écran de densité 3, le navigateur choisit `m` (50 Ko). La visionneuse charge `l`, plus nette que l'ancienne image de 1 080 px.
- **Stockage** : environ 180 Ko par photo au lieu de 80 Ko, soit environ 3,6 Mo pour une annonce de 20 photos au lieu de 1,6 Mo. C'est le prix des trois tailles. Les copies inutiles sont évitées et les fichiers orphelins supprimés.
- Durées sur un téléphone réel : non mesurées. Chromium sur serveur, sans limitation : 4 photos lourdes traitées et envoyées en 9,5 s.

## 3. Données (backend, migration `20261102000100_photos.sql`)

- **`properties.photos`** (inchangé) : URL publiques de la variante `m`, la couverture en tête. Tous les écrans existants la lisent sans changement.
- **`properties.photos_meta`** (nouveau, `jsonb`, ≤ 20) : une entrée par photo, **dans le même ordre**.
  - Exemple :
    ```json
    {"id": "<uuid>", "dossier": "<espace>/<bien>/<uuid>", "ext": "webp",
     "v": {"s": {"w": 480, "h": 360, "o": 17950}, "m": {"w": 960, "h": 720, "o": 50248}, "l": {"w": 1600, "h": 1200, "o": 111384}},
     "src": {"type": "jpeg", "o": 4734400, "w": 4032, "h": 3024}}
    ```
  - Une photo antérieure est décrite par `{"legacy": true}`. Une liste vide est acceptée pour les anciennes annonces.
- **Écriture atomique.** Photos et description partent dans **la même requête** que le bien (insertion ou mise à jour d'une seule ligne) : il n'y a pas d'état intermédiaire.
- **Contrôles en base** (déclencheur `controler_photos`), appliqués aux **nouvelles** valeurs seulement : les anciennes annonces restent modifiables.

  | Contrôle | Erreur |
  |---|---|
  | 20 photos au plus | 23514 |
  | URL sans espace, guillemet ni chevron | 22023 |
  | URL dans le dossier `photos/<espace du bien>/<bien>/` | 42501 |
  | Description alignée sur `photos` (nombre, ordre, variante `m`), dossier au bon format, sans doublon | 23514 / 23505 |

## 4. Storage

Chemin d'une photo : `photos/<espace>/<bien>/<photo>/<s|m|l>.<webp|jpg>`. Les anciens chemins `photos/<espace>/<bien>/<uuid>.jpg` restent valides.

| Règle (`app.dossier_autorise`, politiques de `storage.objects`) | Effet |
|---|---|
| 1er dossier = espace de l'utilisateur, droit « biens » | inchangé |
| 2e dossier = un bien **de cet espace**, ou un bien pas encore créé | nouveau : impossible de déposer pour le bien d'un autre |
| Agent : seulement les biens qui lui sont attribués | nouveau : un agent ne touche plus aux photos des biens de ses collègues |
| Remplacer ou supprimer un fichier **encore référencé** par une annonce ou un profil | refusé aux utilisateurs |
| Photo de profil | dépôt sans remplacement (corrige le refus « Action non autorisée ») |
| Lecture par l'API de ses propres photos et photos de profil | nouveau : nécessaire pour qu'une suppression agisse (dans PostgreSQL, un DELETE qui lit des colonnes ne voit que les lignes autorisées en lecture). Sans cette politique, la suppression répondait « réussi » sans rien supprimer (constaté sur la réplique). Les autres comptes ne voient rien. |

Avant, `upsert: true` sans politique SELECT faisait refuser tout dépôt de photo ou de photo de profil (constat I1 de l'audit, reproduit sur la réplique). Le compartiment `documents` garde son comportement.

## 5. Nettoyage des fichiers

| Cas | Comment |
|---|---|
| Photo retirée d'une annonce enregistrée, annonce supprimée (y compris par suppression du compte) | déclencheur `photos_retirees` → file `app.fichiers_a_supprimer` |
| Photo de profil remplacée, compte supprimé | déclencheur `avatar_retire` → file |
| Photo retirée **avant** l'enregistrement | supprimée tout de suite par le navigateur (la base refuse si elle est encore utilisée) |
| Dépôt jamais enregistré (formulaire abandonné, onglet fermé) | repéré après **24 h de grâce** par `nettoyage_preparer` |
| Fichier référencé mais absent | signalé par `nettoyage_rapport` (`photos_manquantes`), jamais « réparé » automatiquement |

La fonction Edge `nettoyer-fichiers` traite la file **par l'API Storage** : supprimer des lignes de `storage.objects` en SQL laisserait les fichiers. Avant chaque lot, la base relit chaque fichier ; un fichier de nouveau utilisé est conservé. Après 5 échecs, un fichier n'est plus retenté et apparaît dans le rapport.

Les fonctions `public.nettoyage_*` sont exécutables par `service_role` seulement : refus vérifié pour un compte (403) et pour un visiteur (401).

## 6. Contrat frontend / backend

| Opération | Frontend | Backend |
|---|---|---|
| Déposer une variante | `POST /storage/v1/object/photos/<espace>/<bien>/<photo>/<k>.<ext>`, jeton de l'utilisateur, `x-upsert: false`, corps brut, `content-type` image/webp ou image/jpeg | taille ≤ 5 Mo et type autorisé (compartiment) ; règles §4. Réponses : 200 ; 409 = déjà présent, traité comme réussi ; 403 ; 413 ; 415 |
| Enregistrer | `properties.photos` (URL `m`) et `photos_meta` dans la même écriture que le bien | contrôles §3, file de suppression §5 |
| Retirer avant enregistrement | `storage.remove([...])` des variantes déposées | refusé si le fichier est référencé |
| Retirer, remplacer ou réordonner après enregistrement | nouvelle liste `photos` + `photos_meta` | fichiers retirés mis en file |
| Afficher | `photoBien(p, i, 's'|'m'|'l')`, `srcset` d'après `photos_meta` ; à défaut, URL d'origine | lecture publique du compartiment |
| Erreurs | message lisible par photo ; reprise de la seule photo | codes PostgreSQL ci-dessus |

## 7. Affichage

- `photoHtml` et `propertyCard` : URL **échappées** (corrige l'injection d'attribut A4 de l'audit), `srcset` et `sizes`, `width` et `height`.
- Autres écrans (tableaux de bord, accueil) : variantes ajoutées avant le chargement, d'après la taille réelle d'affichage.
- Fiche : première photo en `fetchpriority="high"`, les autres en différé.
- Placeholder animé pendant le chargement (désactivé si l'utilisateur limite les animations) ; image de repli « Photo indisponible » en cas d'erreur.

## 8. Mise en service (projet Supabase de **test** d'abord)

1. Sauvegarde : `supabase/sauvegarde/sauvegarder.sh` (base) et `node supabase/sauvegarde/fichiers.js exporter` (fichiers).
2. Migration : `supabase db push`. Elle applique `20261102000100_photos.sql`, additive : aucune donnée modifiée.
3. Fonction de nettoyage :
   ```
   supabase secrets set DEUKSIL_CLE_NETTOYAGE=<32 caractères aléatoires ou plus>
   supabase functions deploy nettoyer-fichiers --no-verify-jwt
   ```
4. **Simulation d'abord.** `POST https://<projet>.supabase.co/functions/v1/nettoyer-fichiers` avec l'en-tête `x-deuksil-cle` et le corps `{"simulation": true}`. Lire `orphelins_candidats`. Le premier vrai passage supprimera aussi les orphelins accumulés **avant** cette mise à jour : c'est voulu, mais irréversible sans la sauvegarde de l'étape 1.
5. Planification : une fois par heure, avec la même requête sans `simulation`, via Supabase Cron (pg_cron + pg_net) ou tout planificateur HTTP. Le secret reste côté serveur (Vault).
6. Frontend : publier `index.html`, `css/04-photos.css`, `js/99k-photos.js`, `js/03-storage.js`, `js/24-espace-proprietaire.js`, `js/02c-schema.js`.
7. Recette sur le projet de test : `node tests/photos.js` ne s'exécute que sur une URL locale ; à défaut, rejouer à la main les cas P1 à P16 de `supabase/tests-local/resultats/photos.json`.

**Retour arrière** : bloc commenté en fin de migration. Le frontend précédent continue de fonctionner avec la base migrée, car `photos_meta` est facultative.

## 9. Limites connues

- **Navigateurs.** Testé dans Chromium uniquement (réplique locale). À vérifier sur Safari iOS (encodage WebP, sinon repli JPEG prévu), sur un Android d'entrée de gamme (mémoire pour décoder des photos de 50 Mpx et plus) et sur un iPhone qui envoie du HEIC.
- **Plateforme.** Storage et la plateforme Edge hébergés n'ont pas été testés : la réplique émule Storage en appliquant les mêmes politiques RLS.
- **Anciennes photos.** Elles n'ont pas de variantes et restent servies en taille unique. Une reprise pour leur créer des variantes est possible mais n'a pas été faite.
- **Chargement des annonces.** Le chargement complet des annonces publiées au démarrage (point §6 de l'audit) relève de la phase 6 et n'est pas traité ici.

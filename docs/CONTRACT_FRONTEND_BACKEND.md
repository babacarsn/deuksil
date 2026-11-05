# DEUKSIL — Contrat frontend / backend (photos des biens)

Version du 2 novembre 2026. Ce contrat décrit **exactement** ce que l'interface envoie et ce que la base accepte. Le backend ne fait jamais confiance au navigateur : chaque règle notée « contrôlé par » est appliquée côté serveur, même si l'interface la respecte déjà.

Fichiers de référence :
- frontend : `js/00-photos-traitement.js` (traitement), `js/99k-photos.js` (formulaire, envoi, affichage) ;
- backend : `supabase/migrations/20261102000100_photos.sql`, `supabase/functions/nettoyer-fichiers/index.ts`.

## 1. Identifiants et chemins

| Élément | Format | Qui le crée |
|---|---|---|
| `espace` | UUID du compte titulaire (propriétaire ou agence) ; un membre d'équipe agit pour l'espace de son titulaire | base (`app.espace()`) ; l'interface le lit par `DB.espaceId()` |
| `bien` | UUID de `properties.id`, généré par le navigateur **avant** le premier dépôt (bien neuf), réutilisé à l'enregistrement | frontend |
| `photo` | UUID, un par photo | frontend |
| Fichier | `photos/<espace>/<bien>/<photo>/<k>.<ext>`, `k` ∈ `s`, `m`, `l` ; `ext` ∈ `webp`, `jpg` | frontend |
| Ancien fichier (avant le 2 novembre 2026) | `photos/<espace>/<bien>/<uuid>.jpg` | — (lecture seule) |

## 2. Formats acceptés

| Étape | Accepté | Contrôlé par |
|---|---|---|
| Fichier choisi par l'utilisateur | JPEG, PNG, WebP, GIF, HEIC/HEIF, AVIF (lus dans les octets), 30 Mo au plus, 80 Mpx au plus, grand côté ≥ 300 px, JPEG/PNG complets | frontend (le fichier d'origine n'est jamais envoyé) |
| Fichier déposé | `image/webp` ou `image/jpeg` (aussi `image/png` pour les anciens flux), 5 Mo au plus | compartiment `photos` (Storage) |
| Variantes | grand côté 480 / 960 / 1 600 px, jamais agrandi, proportions d'origine | frontend ; décrit dans `photos_meta` |

## 3. Opérations

### 3.1 Déposer une variante

```
POST {SUPABASE_URL}/storage/v1/object/photos/<espace>/<bien>/<photo>/<k>.<ext>
authorization: Bearer <jeton de session de l'utilisateur>
apikey: <clé publique>
content-type: image/webp | image/jpeg
x-upsert: false
cache-control: max-age=31536000
<corps : octets du fichier>
```

| Réponse | Sens | Conduite du frontend |
|---|---|---|
| 200 | déposé | variante suivante |
| 409 (ou message « already exists / Duplicate ») | déjà présent : une tentative précédente a abouti | considéré comme réussi |
| 401 | session expirée | « Session expirée : reconnectez-vous. », pas de reprise automatique |
| 403 | refusé par les politiques (§5) | « Envoi non autorisé pour ce bien. » |
| 413 / 415 | trop lourd / type refusé | message dédié |
| réseau coupé, délai de 90 s dépassé | — | 1 reprise automatique après 2 s, puis « Réessayer » |

L'interface dépose deux photos à la fois au plus. Pour chaque photo, les variantes partent l'une après l'autre ; une reprise ne renvoie que les variantes manquantes.

### 3.2 Enregistrer le bien

Une seule écriture PostgREST sur `public.properties` (insertion ou mise à jour) porte, en plus des champs habituels :

| Colonne | Contenu |
|---|---|
| `photos` (`text[]`, ≤ 20) | URL publique de la variante `m` de chaque photo, **couverture en tête**, dans l'ordre choisi |
| `photos_meta` (`jsonb`, ≤ 20) | une entrée par photo, même ordre : voir §4 ; ou `[]` pour une annonce sans description (anciennes annonces) |

L'interface n'envoie cette écriture que si toutes les photos sont à l'état « envoyée ». Elle attend la confirmation de la base (`DB.attendre()`) avant de quitter le formulaire.

Erreurs renvoyées par la base (déclencheur `app.controler_photos`) :

| Code | Message | Cause |
|---|---|---|
| 23514 | « Une annonce compte 20 photos au plus. » | plus de 20 photos |
| 22023 | « Adresse de photo invalide. » | espace, guillemet, chevron, accent grave, antislash, ou schéma autre que http(s) |
| 42501 | « Chaque photo doit être déposée dans le dossier de ce bien. » | nouvelle URL hors de `photos/<owner_id>/<id>/` |
| 23514 | « Description des photos incohérente (nombre / ordre). » | `photos_meta` non alignée sur `photos` |
| 23514 | « Description de photo invalide. » | dossier, extension ou variante `m` absents ou mal formés |
| 23505 | « Photo en double. » | même dossier deux fois |
| 42501 | « Renseignez un numéro de CNI… » | publication sans CNI (règle existante) |

Seules les **nouvelles** URL sont contrôlées : une ancienne annonce reste modifiable.

### 3.3 Retirer une photo

| Situation | Frontend | Backend |
|---|---|---|
| Photo pas encore enregistrée | `storage.from('photos').remove([...variantes])` | autorisé (politiques « suppression » et « lecture de ses photos ») ; **refusé si le fichier est référencé** par une annonce |
| Photo enregistrée | nouvelle liste `photos` + `photos_meta` (§3.2) | déclencheur `photos_retirees` : fichiers mis en file ; suppression par la fonction de nettoyage |
| Annonce supprimée, ou compte supprimé (cascade) | `DB.deleteItem` | idem, raison « bien supprimé » |

### 3.4 Remplacer ou réordonner

Remplacer = retirer (§3.3) + déposer une nouvelle photo à la même place. Réordonner ou changer de couverture = nouvelle liste (§3.2). La couverture est toujours `photos[0]`.

### 3.5 Lire les variantes

```
URL(k) = photos[i] avec le dernier segment « m.<ext> » remplacé par
         « <photos_meta[i].v[k].fichier ou k>.<photos_meta[i].ext> »
```

- `photoBien(p, i, 's'|'m'|'l')` applique cette règle dans le navigateur.
- `srcset` liste les variantes distinctes avec leur largeur `v[k].w`.
- Sans description, ou avec `{"legacy": true}`, la seule URL est `photos[i]`.
- Une variante absente ou en erreur est remplacée par l'image « Photo indisponible ».

### 3.6 Nettoyage (serveur uniquement)

```
POST {SUPABASE_URL}/functions/v1/nettoyer-fichiers
x-deuksil-cle: <secret DEUKSIL_CLE_NETTOYAGE, 32 caractères au moins>
content-type: application/json
{"simulation": true}            → {"simulation": true, "rapport": {...}}
{"delai_heures": 24}            → {"mis_en_file": n, "supprimes": n, "echecs": n, "rapport": {...}}
```

| Réponse | Sens |
|---|---|
| 401 | mauvaise clé |
| 503 | secret absent ou trop court |
| 405 | méthode autre que POST |

`rapport` :
- `file_a_traiter`, `file_en_echec` (5 tentatives au plus par fichier) ;
- `orphelins_candidats` : fichiers plus vieux que le délai et référencés nulle part ;
- `photos_manquantes` : fichiers référencés mais absents du stockage, 200 au plus.

Les fonctions SQL `public.nettoyage_rapport`, `nettoyage_preparer`, `nettoyage_lot` et `nettoyage_fin` sont exécutables par `service_role` seulement.

## 4. Description d'une photo (`photos_meta[i]`)

```json
{
  "id": "6f1c…",                               // = <photo>
  "dossier": "<espace>/<bien>/<photo>",         // contrôlé : owner_id/id du bien + UUID
  "ext": "webp",                                // "webp" | "jpg"
  "v": {
    "s": {"w": 480,  "h": 360,  "o": 17950},
    "m": {"w": 960,  "h": 720,  "o": 50248},    // m existe toujours, sans « fichier »
    "l": {"w": 1600, "h": 1200, "o": 111384}    // ou {"w":760,"h":570,"o":65816,"fichier":"m"} si identique à m
  },
  "src": {"type": "jpeg", "o": 4734400, "w": 4032, "h": 3024}   // fichier d'origine (informatif)
}
```

`w` et `h` : pixels ; `o` : octets ; `fichier` : variante dont le fichier est réutilisé, pour éviter les copies inutiles.

## 5. Permissions

| Action | Qui | Règle (base) |
|---|---|---|
| Déposer une photo | titulaire de l'espace ou membre ayant le droit « biens » | 1er dossier = son espace ; 2e dossier = bien de son espace ou bien inexistant ; **agent : seulement ses biens attribués** |
| Lire par l'API (lister) | idem, sur son espace | politique « lecture de ses photos » ; les autres comptes ne voient rien |
| Lire par l'URL publique | tout le monde | compartiment public (brouillons compris : chemins non devinables) |
| Supprimer ou remplacer un fichier | idem dépôt | et **fichier non référencé** (`app.fichier_reference`) |
| Écrire `photos` / `photos_meta` | droits de modification du bien (RLS existante) | contrôles §3.2 |
| Nettoyer | fonction `nettoyer-fichiers` (clé service) | — |

## 6. Ce que chaque équipe peut changer sans toucher l'autre

- **Frontend seul** : tailles et qualité des variantes (tant que `m` existe et que `photos_meta` les décrit), nombre d'envois simultanés, messages, présentation.
- **Backend seul** : délai de grâce, fréquence du nettoyage, limites du compartiment (taille, types).
- **Les deux ensemble**, avec une nouvelle version de ce contrat :
  - forme des chemins ;
  - nom ou forme de `photos_meta` ;
  - règle « `photos[i]` = variante `m` » ;
  - limite de 20 photos (interface + contrainte + déclencheur).

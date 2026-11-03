# DEUKSIL — Frontend

Responsabilités de l'équipe frontend et changements du 2 novembre 2026. Design inchangé : couleurs, typographie, composants et navigation existants.

## 1. Organisation du code

- `index.html` charge dans l'ordre (110 scripts) `js/vendor/supabase-js`, puis les modules `js/00-…` à `js/99m-…`, puis les feuilles `css/01` à `css/04`.
- Chaque `src` et chaque `href` porte une empreinte `?v=…` (§4).
- Un module plus récent peut **remplacer** une fonction d'un module plus ancien. Avant de modifier un comportement, chercher sa dernière définition : `grep -n "nomDeFonction =" js/*.js`.

| Fichier ajouté ou modifié | Rôle |
|---|---|
| `js/00-photos-traitement.js` (nouveau) | traitement d'une photo, sans dépendance : vrai format, intégrité, décodage avec orientation, variantes s/m/l, WebP ou JPEG. Partagé avec `DEMO/` |
| `js/99k-photos.js` (nouveau) | formulaire de photos : sélection, envoi avec progression et reprise, ordre, couverture, remplacement ; enregistrement confirmé ; affichage (`srcset`, repli) ; galerie et visionneuse de la fiche |
| `js/99m-ia-agent.js` (nouveau, 3 nov.) | assistant qui consulte et agit : [ASSISTANT_IA.md](ASSISTANT_IA.md) |
| `js/99l-chargement.js` (nouveau) | attente du catalogue progressif (§3) |
| `css/04-photos.css` (nouveau) | styles des éléments ci-dessus, avec les variables du thème |
| `js/03-storage.js` | dépôt sans remplacement ; lecture par pages en parallèle ; catalogue progressif ; `findItem` et `filterItems` sans recopie de la mémoire ; annuaire par pages |
| `js/24-espace-proprietaire.js` | route « Modifier un bien » : accepte les identifiants UUID |
| `js/99-maj.js` | détection des nouvelles versions : `index.html` seul quand les fichiers sont versionnés |
| `js/02c-schema.js` | régénéré (colonne `photos_meta`) |
| `sw.js`, `vercel.json`, `outils/versionner-site.js` | cache (§4) |

## 2. Photos

Comportement, messages et contrat : [IMAGES.md](IMAGES.md) et [CONTRACT_FRONTEND_BACKEND.md](CONTRACT_FRONTEND_BACKEND.md).

Points d'implémentation à connaître :

- **Pas de `render()` global pendant la saisie des photos.** Il ramènerait l'assistant à l'étape 1 : la zone `#ph-zone` se redessine seule, en gardant le focus du clavier.
- L'état du formulaire est dans `window.DEUKSIL_PHOTOS`, en lecture seule pour les tests. `formPhotos` (ancien code) reste synchronisé : URL `m`, ou aperçu pendant l'envoi.
- **Enregistrement.** `DB.addItem` / `DB.updateItem` reçoivent `photosMeta` quand l'écriture vient du formulaire. Pendant l'enregistrement, `go()` et les messages de succès sont retenus jusqu'à la confirmation de la base (`DB.attendre()`). En cas d'échec, la saisie reste à l'écran.
- L'ancien gestionnaire `photos-input` de `27-actions.js` ne reçoit plus l'événement : écoute en phase de capture et `stopImmediatePropagation`.

## 3. Chargement des données

Mesures avant / après : [PERFORMANCES.md](PERFORMANCES.md), section « Chargement de l'application ».

| Changement | Pourquoi |
|---|---|
| `DB.findItem` / `DB.filterItems` testent la mémoire sans la recopier ; seul le résultat est recopié | le profil CPU de l'accueil avec 24 000 annonces montrait 93 % du temps dans la recopie de chaque élément **avant** le test (`findItem`, appelé une fois par annonce) |
| Annuaire lu par pages (`toutesLesLignes('annuaire', …)`) | PostgREST renvoie 1 000 lignes au plus : au-delà de 1 000 propriétaires et agences, des noms manquaient |
| Pages de 1 000 lignes lues 4 par 4 en parallèle, tri complété par `id` | lectures plus courtes ; deux lignes de même date ne peuvent plus manquer ni apparaître deux fois |
| **Catalogue progressif** pour le visiteur, le client et le locataire | le premier écran n'attend que les 48 annonces les plus récentes, plus la fiche ouverte par un lien direct ; le reste arrive en arrière-plan |

Règles du catalogue progressif :

- **Écrans servis tout de suite** : accueil, fiche ouverte par son lien, connexion, inscription, mot de passe, pages légales, contact (`ECRANS_SANS_CATALOGUE` dans `03-storage.js`).
- **Écrans qui ont besoin de tout** (recherche, carte, favoris, espaces…) :
  - `DB.pret` reste faux jusqu'à ce que le catalogue soit complet ;
  - `99l-chargement.js` affiche le squelette de démarrage ;
  - l'écran se dessine dès que le catalogue est complet (événement `deuksil:catalogue`).
- Sur l'accueil, le nombre « N locaux disponibles » n'apparaît qu'une fois le catalogue complet.
- Propriétaires, agences et administrateurs : chargement complet, comme avant. Leurs écrans de gestion ont besoin de toutes leurs données.

Limite assumée : le visiteur finit par télécharger tout le catalogue publié, en arrière-plan. Une recherche paginée côté serveur supprimerait ce téléchargement, mais elle change le fonctionnement de la recherche, de la carte et du comparateur : c'est un lot à part, à décider.

## 4. Cache et versions

1. `node outils/versionner-site.js` ajoute à chaque fichier `js/` et `css/` de `index.html` une empreinte de son contenu (`?v=` + 10 caractères SHA-256), et met à jour `VERSION` dans `sw.js`.
2. `vercel.json` sert ces fichiers versionnés avec `Cache-Control: public, max-age=31536000, immutable`. Sans `?v=`, la règle par défaut de Vercel s'applique : revalidation à chaque fois.
3. `sw.js` sert les fichiers versionnés depuis sa copie locale, puis efface les anciennes versions. `index.html`, les images et le manifeste restent en « réseau d'abord ».
4. `99-maj.js` ne vérifie plus que `index.html` pour détecter une nouvelle version, au lieu d'environ 110 requêtes à chaque retour au premier plan.

**Obligation** : relancer `versionner-site.js` après toute modification d'un `js/` ou d'un `css/`. `--verifier` sert de garde-fou, et le test `tests/versions.js` le vérifie.

## 5. Tests

`tests/photos.js` (27 cas), `tests/versions.js`, `supabase/tests-local/perf/chargement.js` (mesures), en plus des suites existantes. Résultats : [TESTS.md](TESTS.md).

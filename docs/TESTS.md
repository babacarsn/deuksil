# DEUKSIL — Tests réalisés et résultats

Dernière exécution complète : 3 novembre 2026, sur la **réplique locale** remise à zéro avant chaque suite (`supabase/tests-local/replique/preparer.sh`). Aucun test n'a été lancé sur la production. Les scripts refusent une adresse qui n'est pas locale.

## 1. Synthèse

| Suite | Fichier | Résultat |
|---|---|---|
| Photos : formulaire, échecs, affichage, sécurité, nettoyage | `tests/photos.js` | **27/27** |
| Chargement : catalogue progressif, copies, cache, annuaire | `tests/chargement.js` | **9/9** |
| Versions des fichiers et en-têtes | `tests/versions.js` | **4/4** |
| Balayage : chaque page de chaque profil (ordinateur et téléphone), chaque bouton, chaque fenêtre | `tests/balayage.js` (`BOUTONS=1 MODALES=1`) | voir DEUKSIL_Tests.xlsx |
| Assistant qui consulte et agit (faux Gemini) | `tests/ia-agent.js` | **26/26** — détail : [ASSISTANT_IA.md](ASSISTANT_IA.md) §4 |
| Démonstration (`DEMO/index.html`) | script de recette, voir §5 | **14/14** |
| Contrôle d'intégrité des images (7 fichiers) | voir §2 | **7/7** conformes |
| Sécurité multi-comptes (RLS, déclencheurs, fonctions) | `supabase/tests-local/securite-rls.test.js` | **65/65** |
| Formulaires réels (inscription, connexion, contact, photos) | `tests/formulaires.js` | **27/27** |
| CNI avant publication | `tests/cni-publication.js` | **13/13** |
| Accès des comptes | `tests/acces-comptes.js` | **14/14** |
| Toutes les pages de 9 profils | `tests/sonde-pages.js` | **9/9 profils** sans erreur JS ni requête refusée inattendue |
| Écritures sans action de l'utilisateur | `tests/ecritures-auto.js` | **aucune** |
| Injection de script (XSS) | `tests/xss-sonde.js` | **aucune exécution** |

Mesures de performance : [PERFORMANCES.md](PERFORMANCES.md), section « Chargement de l'application ».

## 2. Images (`tests/photos.js` et contrôles directs)

| # | Cas demandé | Résultat observé |
|---|---|---|
| P1 | Une seule photo (vraie photo 760 × 570) | variantes s 480 × 360 (27,8 Ko), m 760 × 570 (65,8 Ko), l = m (pas d'agrandissement ni de copie) ; WebP ; 2 fichiers déposés |
| P2 | Plusieurs photos, grande image 4 032 × 3 024 | 3 variantes : 480 / 960 / 1 600 px de grand côté |
| P3 | Format non accepté, image corrompue, image trop petite | refusés avec motif : « pas une photo », « incomplète ou endommagée », « trop petite (120×120) » |
| P4 | 20 photos, tentative d'une 21e | 20 gardées, « Limite de 20 photos atteinte : 16 ajoutées sur 21 », champ désactivé |
| P5 | Suppression avant enregistrement | fichiers supprimés de Storage tout de suite, « Photo supprimée » |
| P6 | Changement de couverture, changement d'ordre | la 3e passe en 1re avec l'étiquette « Couverture » ; flèches |
| P7 | Upload interrompu, échec d'une seule photo, nouvelle tentative | 2 coupures : 1 reprise automatique, puis « Connexion interrompue pendant l'envoi » ; « Réessayer » n'envoie que cette photo |
| P8 | Connexion lente (envoi ralenti) | progression « Envoi : x/y photos · n restantes · % », boutons d'enregistrement désactivés |
| P9 | Échec de l'enregistrement de l'annonce | formulaire conservé, photos conservées, pas de faux « Brouillon enregistré » |
| P10 | Enregistrement | `photos[i]` = variante m de `photos_meta[i]`, couverture en tête |
| P11 | Remplacement / retrait d'une photo enregistrée | fichiers mis en file de suppression |
| P12 | Affichage de la fiche | toutes les photos (avant : 3), visionneuse, 1re photo prioritaire |
| P13 | Carte de recherche | variante s téléchargée (écran 390 px, densité 1) |
| P14 | Image absente | image de repli « Photo indisponible » |
| P15 | Agent d'agence | photo déposée dans le dossier de l'agence, bien enregistré |
| P16 | Photo de profil | enregistrée (corrige le refus « Action non autorisée ») ; ancienne mise en file |
| — | Image de très grande dimension (8 000 × 6 000, 12,4 Mo) | traitée : 1 600 × 1 200, 102 Ko (mesure `variantes.json` de l'audit) |
| — | Intégrité JPEG / PNG | complets acceptés (normal, progressif, portrait EXIF, PNG, **photo animée** avec vidéo ajoutée après la fin) ; tronqués refusés (avec ou sans en-tête EXIF) |

## 3. Sécurité

| # | Cas | Résultat |
|---|---|---|
| S1 | Autre utilisateur dépose dans le dossier d'un bien qui n'est pas le sien | refusé (403) |
| S2 | Dépôt dans son dossier pour le bien d'un autre | refusé (403) |
| S3 | Suppression d'un fichier appartenant à une annonce, par l'API | refusée (fichier conservé) |
| S4 | Agent sur le bien d'un collègue / titulaire de l'agence | refusé (403) / accepté (200) |
| S5 | URL piégée, URL externe, 21 photos, description incohérente | refusés par la base (400 / 403) |
| S6 | Fonctions de nettoyage appelées par un compte ou un visiteur | refusées (403 / 401) |
| S7 | Clé `service_role` dans le code du navigateur | absente |
| S8 | Lister les fichiers d'un autre compte | liste vide |
| C1 | Fonction de nettoyage sans la bonne clé | refusée (401) |
| C2 | Bien supprimé, puis simulation | fichiers en file, rien de supprimé |
| C3 | Nettoyage réel | orphelins ajoutés, fichiers supprimés, 0 échec, plus aucun fichier du bien |
| RLS | Accès croisés entre comptes, élévation de rôle, injection | 65/65 (suite existante) |

## 4. Chargement (`tests/chargement.js`)

| # | Résultat |
|---|---|
| L1 | premier écran du visiteur avec 48 annonces, catalogue complété ensuite |
| L2 | recherche demandée avant la fin : squelette, pas de résultats partiels |
| L3 | catalogue complet ensuite (51 annonces), recherche juste |
| L4 | lien direct vers la fiche la plus ancienne : affichée avant la fin du catalogue |
| L5 | `findItem` / `filterItems` renvoient des copies : la mémoire n'est pas modifiée |
| L6, L7 | `published()` en cache, invalidé par une écriture (39 → 38) |
| L8 | annuaire lisible par pages |

## 5. Démonstration (`DEMO/index.html`)

Recette automatisée dans Chromium, ordinateur et téléphone en thème sombre :
- totaux calculés ;
- variantes d'une image 4 032 × 3 024 ;
- zoom original / optimisée ;
- coupure, reprise automatique, échec, « Réessayer » ;
- couverture, ordre, retrait ;
- visionneuse ;
- calcul des octets ;
- 3 refus motivés et limite de 20 ;
- aucune erreur JavaScript, aucun défilement horizontal sur téléphone.

## 6. Régression

| Fonction | Couverte par |
|---|---|
| Connexion, inscription, mot de passe | `formulaires.js` F1–F5, `acces-comptes.js` |
| Gestion des biens, modification | `photos.js` P9–P11, `cni-publication.js`, `sonde-pages.js` |
| Propriétaires, locations, ventes, clients, messages, favoris, notifications | `sonde-pages.js` (toutes les pages de 9 profils), `securite-rls.test.js`, `ecritures-auto.js` |
| Consultation des annonces | `photos.js` P12–P13, `chargement.js` L1–L4 |

## 7. Non testé

- Projet Supabase **hébergé** : Storage réel, fonctions Edge déployées, planification du nettoyage.
- Safari (iOS, macOS) : encodage WebP et repli JPEG prévu ; HEIC envoyé par un iPhone.
- Téléphones réels d'entrée de gamme : mémoire pour décoder des photos de 50 Mpx et plus, durées.
- Écrans d'administration avec un très gros volume (≈ 1 million de lignes) : non mesurables, voir [PERFORMANCES.md](PERFORMANCES.md).
- Tests de charge et d'intrusion : hors mandat.

## 8. Relancer

```
bash supabase/tests-local/replique/demarrer.sh            # réplique
MOT_DE_PASSE_TEST=… supabase/tests-local/replique/preparer.sh
node tests/photos.js ; node tests/chargement.js ; node tests/versions.js ; node tests/ia-agent.js
node supabase/tests-local/securite-rls.test.js           # avec SUPABASE_URL, SUPABASE_ANON_KEY
```

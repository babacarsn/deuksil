# DEUKSIL — Architecture

État au 2 novembre 2026. Vue d'ensemble ; le détail est dans les documents de chaque partie.

```
 Navigateur (téléphone, ordinateur)                 Supabase (projet hébergé)
 ┌───────────────────────────────────┐               ┌──────────────────────────────────┐
 │ index.html + 110 scripts js/      │  REST (RLS)   │ PostgreSQL : 32 tables, RLS      │
 │  03-storage.js : données en       │──────────────▶│  schéma app (droits, contrôles)  │
 │  mémoire + file d'écriture        │               │                                  │
 │  00-photos-traitement.js          │  Storage      │ Storage : photos, avatars,       │
 │  99k-photos.js : photos           │──────────────▶│  documents (politiques RLS)      │
 │ sw.js : copie hors ligne          │               │                                  │
 └───────────────────────────────────┘  Auth (PKCE)  │ Auth : comptes, Google           │
          ▲ fichiers statiques                       │                                  │
 ┌────────┴──────────────┐                           │ Fonctions Edge :                 │
 │ Vercel (deuksil.com)  │                           │  gerer-acces (comptes)           │
 │ vercel.json : cache,  │                           │  assistant-ia (Gemini, agent)    │
 │ en-têtes de sécurité  │                           │  nettoyer-fichiers (planifiée)   │
 └───────────────────────┘                           └──────────────────────────────────┘
```

## 1. Choix structurants (existants, conservés)

| Choix | Conséquence |
|---|---|
| HTML / CSS / JavaScript sans framework ni étape de compilation | Le site publié est le code source, plus les empreintes de version (`outils/versionner-site.js`). |
| Modules `js/NN-*.js` chargés dans l'ordre ; un module récent **remplace** des fonctions d'un plus ancien (surcouches) | Une modification vise la **dernière** surcouche active. Exemple : `saveProperty` est redéfini dans 27, 63, 67, 78 et 94, et le flux des photos s'accroche aux écritures (`DB.addItem`, `DB.updateItem`) plutôt qu'à l'une de ces fonctions. |
| Données lues au démarrage et gardées en mémoire ; écrans synchrones (`DB.getData`, `findItem`…) | Écriture immédiate à l'écran, puis envoyée à Supabase ; refus → relecture et message. La base reste la seule référence. |
| Sécurité dans la base (RLS, déclencheurs, fonctions `app.*`) | Le navigateur n'est jamais cru : voir [SECURITY.md](SECURITY.md). |

## 2. Ce qui a changé le 2 novembre 2026

| Domaine | Changement | Document |
|---|---|---|
| Photos | Contrôle du vrai format, 3 tailles en WebP ou JPEG, envoi à la sélection avec progression et reprise, ordre, couverture, galerie complète, nettoyage des fichiers | [IMAGES.md](IMAGES.md), [CONTRACT_FRONTEND_BACKEND.md](CONTRACT_FRONTEND_BACKEND.md), [STORAGE.md](STORAGE.md) |
| Base | `properties.photos_meta`, contrôles des photos, politiques Storage resserrées, file de suppression | [DATABASE.md](DATABASE.md) |
| Chargement | Recherche dans la mémoire sans recopie (le goulot mesuré), annuaire au-delà de 1 000 comptes, pages lues en parallèle, catalogue progressif pour le visiteur et le client | [FRONTEND.md](FRONTEND.md) §3, [PERFORMANCES.md](PERFORMANCES.md) |
| Cache et en-têtes | Fichiers versionnés gardés un an, service worker adapté, en-têtes de sécurité (`vercel.json`) | [FRONTEND.md](FRONTEND.md) §4, [SECURITY.md](SECURITY.md) §3 |
| Corrections | Envoi des photos refusé (upsert), lien « Modifier » d'un bien, injection par URL de photo, suppression de fichier sans effet | [../CHANGELOG.md](../CHANGELOG.md) |

## 3. Répartition des responsabilités

- **Frontend** : saisie, contrôle et optimisation des photos, présentation, messages, retenue de la navigation jusqu'à la confirmation de la base. Voir [FRONTEND.md](FRONTEND.md).
- **Backend** : schéma, RLS, contrôles en base (qui répètent ceux de l'interface), Storage, fonctions Edge, nettoyage. Voir [BACKEND.md](BACKEND.md).
- **Contrat** entre les deux : [CONTRACT_FRONTEND_BACKEND.md](CONTRACT_FRONTEND_BACKEND.md).

## 4. Environnements

| Environnement | Usage |
|---|---|
| Réplique locale (`supabase/tests-local/replique`) | Tous les tests. PostgreSQL 16, PostgREST, Supabase Auth, émulation de Storage soumise aux mêmes politiques RLS, fonctions Edge sous Deno. Mode `HEBERGEMENT=1` pour les mesures : compression et en-têtes de cache comme en ligne. |
| Projet Supabase de test (à créer) | Recette avant production : Storage et fonctions Edge réels. |
| Production | deuksil.com (Vercel) et projet Supabase `fqrmulupzaqmvjoybela`. Aucune opération de cette mission n'y a touché. |

## 5. Démonstration

`DEMO/index.html` : page indépendante qui charge le même `js/00-photos-traitement.js` que l'application. Elle ne se connecte à aucun serveur et ne fait pas partie du site publié.
